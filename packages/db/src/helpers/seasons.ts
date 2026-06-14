import {
  computePrizes,
  PLOT_BASE_VALUE,
  PRIZE_RANKS,
  structureValue,
} from "@crypto-valley/content";
import { and, desc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";

import type { Tx } from "../client";
import { characters, plots, seasonResults, seasonScores, seasons, structures, treasury } from "../schema";
import { moveShards } from "./moveShards";

type SeasonRow = typeof seasons.$inferSelect;

export interface SeasonBoardEntry {
  characterId: string;
  name: string;
  score: number;
  rank: number;
}
export interface SeasonTrophy {
  seasonNumber: number;
  board: string;
  rank: number;
  prize: number;
}
export interface SeasonState {
  number: number;
  endsAt: number;
  pool: number;
  profitBoard: SeasonBoardEntry[];
  portfolioBoard: SeasonBoardEntry[];
  me: { profit: number; portfolioValue: number; profitRank: number | null; portfolioRank: number | null };
  trophies: SeasonTrophy[];
  /** Set when THIS call rolled a season over (for an end-of-season notice). */
  ended: { number: number; pool: number; paid: number } | null;
}

/** Every current land-owner's portfolio value (plot base + structures' value). */
async function portfolioValues(tx: Tx): Promise<Map<string, number>> {
  const owned = await tx
    .select({ ownerId: plots.ownerId, plotId: plots.id })
    .from(plots)
    .where(isNotNull(plots.ownerId));
  const structRows = await tx
    .select({ plotId: structures.plotId, defId: structures.defId })
    .from(structures)
    .where(isNotNull(structures.plotId));
  const structsByPlot = new Map<string, string[]>();
  for (const s of structRows) {
    if (!s.plotId) continue;
    const list = structsByPlot.get(s.plotId) ?? [];
    list.push(s.defId);
    structsByPlot.set(s.plotId, list);
  }
  const values = new Map<string, number>();
  for (const o of owned) {
    if (!o.ownerId) continue;
    let v = (values.get(o.ownerId) ?? 0) + PLOT_BASE_VALUE;
    for (const defId of structsByPlot.get(o.plotId) ?? []) v += structureValue(defId);
    values.set(o.ownerId, v);
  }
  return values;
}

/** Create season `number` (idempotent against the number + single-active unique). */
async function startSeason(tx: Tx, number: number, now: number, lengthMs: number): Promise<SeasonRow> {
  const [row] = await tx
    .insert(seasons)
    .values({ number, startedAt: new Date(now), endsAt: new Date(now + lengthMs) })
    .onConflictDoNothing()
    .returning();
  if (row) return row;
  const [existing] = await tx.select().from(seasons).where(eq(seasons.number, number));
  return existing;
}

/** End a due season: rank both boards, pay the pool to the top finishers
 *  (treasury→winners, ledgered), record results + trophies, start the next. */
async function endSeason(
  tx: Tx,
  season: SeasonRow,
  now: number,
  lengthMs: number,
): Promise<{ number: number; pool: number; paid: number; next: SeasonRow }> {
  const profitTop = await tx
    .select({ cid: seasonScores.characterId, score: seasonScores.profit })
    .from(seasonScores)
    .where(and(eq(seasonScores.seasonId, season.id), gt(seasonScores.profit, 0)))
    .orderBy(desc(seasonScores.profit))
    .limit(PRIZE_RANKS);

  const pv = await portfolioValues(tx);
  const portfolioTop = [...pv.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, PRIZE_RANKS);

  const prizes = computePrizes(season.poolShards);
  let paid = 0;
  const award = async (cid: string, board: "profit" | "portfolio", i: number, prize: number): Promise<void> => {
    if (prize > 0) {
      await moveShards(tx, cid, prize, "season_prize", season.id);
      paid += prize;
    }
    await tx.insert(seasonResults).values({
      seasonId: season.id,
      seasonNumber: season.number,
      characterId: cid,
      board,
      rank: i + 1,
      prizeShards: prize,
    });
  };
  for (let i = 0; i < profitTop.length; i++) await award(profitTop[i].cid, "profit", i, prizes.profit[i] ?? 0);
  for (let i = 0; i < portfolioTop.length; i++) await award(portfolioTop[i][0], "portfolio", i, prizes.portfolio[i] ?? 0);

  if (paid > 0) {
    await tx
      .update(treasury)
      .set({ balance: sql`greatest(0, ${treasury.balance} - ${paid})` })
      .where(eq(treasury.currency, "shards"));
  }

  await tx.update(seasons).set({ status: "ended" }).where(eq(seasons.id, season.id));
  const next = await startSeason(tx, season.number + 1, now, lengthMs);
  return { number: season.number, pool: season.poolShards, paid, next };
}

/** The active season — created on first use, and rolled over if past its end.
 *  Guarded by the row lock + the single-active unique index (idempotent end). */
export async function currentSeason(
  tx: Tx,
  now: number,
  lengthMs: number,
): Promise<{ season: SeasonRow; ended: SeasonState["ended"] }> {
  // Fast path: a plain read — no row lock, so ordinary actions never contend.
  let [s] = await tx.select().from(seasons).where(eq(seasons.status, "active"));
  let ended: SeasonState["ended"] = null;
  if (s && s.endsAt.getTime() <= now) {
    // Due → take the lock + re-check under it (only one tx rolls it over).
    const [locked] = await tx.select().from(seasons).where(eq(seasons.id, s.id)).for("update");
    if (locked && locked.status === "active" && locked.endsAt.getTime() <= now) {
      const r = await endSeason(tx, locked, now, lengthMs);
      ended = { number: r.number, pool: r.pool, paid: r.paid };
      s = r.next;
    } else {
      [s] = await tx.select().from(seasons).where(eq(seasons.status, "active"));
    }
  }
  if (!s) s = await startSeason(tx, 1, now, lengthMs);
  return { season: s, ended };
}

/** Credit/debit a player's running season profit (in the sale's transaction). */
export async function addSeasonProfit(
  tx: Tx,
  seasonId: string,
  characterId: string,
  delta: number,
  now: number,
): Promise<void> {
  await tx
    .insert(seasonScores)
    .values({ seasonId, characterId, profit: delta, updatedAt: new Date(now) })
    .onConflictDoUpdate({
      target: [seasonScores.seasonId, seasonScores.characterId],
      set: { profit: sql`${seasonScores.profit} + ${delta}`, updatedAt: new Date(now) },
    });
}

/** Accrue a market fee into the current season's prize pool. */
export async function addSeasonPool(tx: Tx, seasonId: string, fee: number): Promise<void> {
  if (fee <= 0) return;
  await tx
    .update(seasons)
    .set({ poolShards: sql`${seasons.poolShards} + ${fee}` })
    .where(eq(seasons.id, seasonId));
}

/** Full season state for a player: current season + both boards + my standing +
 *  permanent trophies. Rolls the season over if due (so it's self-advancing). */
export async function buildSeasonState(
  tx: Tx,
  characterId: string,
  now: number,
  lengthMs: number,
  topN: number,
): Promise<SeasonState> {
  const { season, ended } = await currentSeason(tx, now, lengthMs);

  // profit board + my profit rank
  const profitRows = await tx
    .select({ cid: seasonScores.characterId, name: characters.name, score: seasonScores.profit })
    .from(seasonScores)
    .innerJoin(characters, eq(seasonScores.characterId, characters.id))
    .where(and(eq(seasonScores.seasonId, season.id), gt(seasonScores.profit, 0)))
    .orderBy(desc(seasonScores.profit))
    .limit(topN);
  const profitBoard = profitRows.map((r, i) => ({ characterId: r.cid, name: r.name, score: r.score, rank: i + 1 }));
  const [myScore] = await tx
    .select({ profit: seasonScores.profit })
    .from(seasonScores)
    .where(and(eq(seasonScores.seasonId, season.id), eq(seasonScores.characterId, characterId)));
  const myProfit = myScore?.profit ?? 0;
  let profitRank: number | null = null;
  if (myProfit > 0) {
    const [{ c }] = await tx
      .select({ c: sql<number>`count(*)::int` })
      .from(seasonScores)
      .where(and(eq(seasonScores.seasonId, season.id), gt(seasonScores.profit, myProfit)));
    profitRank = c + 1;
  }

  // portfolio board + my portfolio rank
  const pv = await portfolioValues(tx);
  const sorted = [...pv.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const ids = sorted.slice(0, topN).map(([cid]) => cid);
  const nameRows = ids.length
    ? await tx.select({ id: characters.id, name: characters.name }).from(characters).where(inArray(characters.id, ids))
    : [];
  const nameMap = new Map(nameRows.map((r) => [r.id, r.name]));
  const portfolioBoard = sorted
    .slice(0, topN)
    .map(([cid, score], i) => ({ characterId: cid, name: nameMap.get(cid) ?? "?", score, rank: i + 1 }));
  const myPortfolioValue = pv.get(characterId) ?? 0;
  const myIdx = sorted.findIndex(([cid]) => cid === characterId);
  const portfolioRank = myIdx >= 0 ? myIdx + 1 : null;

  const trophyRows = await tx
    .select()
    .from(seasonResults)
    .where(eq(seasonResults.characterId, characterId))
    .orderBy(desc(seasonResults.seasonNumber));
  const trophies = trophyRows.map((r) => ({
    seasonNumber: r.seasonNumber,
    board: r.board,
    rank: r.rank,
    prize: r.prizeShards,
  }));

  return {
    number: season.number,
    endsAt: season.endsAt.getTime(),
    pool: season.poolShards,
    profitBoard,
    portfolioBoard,
    me: { profit: myProfit, portfolioValue: myPortfolioValue, profitRank, portfolioRank },
    trophies,
    ended,
  };
}
