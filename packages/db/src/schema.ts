import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ============ IDENTITY ============

export const accounts = pgTable("accounts", {
  // UUIDv7 is generated in app code (see uuidv7 in helpers/seed). The
  // gen_random_uuid() default is only a safety net — Postgres 16 has no uuidv7().
  id: uuid("id").primaryKey().defaultRandom(),
  // The doc specifies citext; we use text + UNIQUE for P1 (case-insensitive
  // auth lands with wallets/email later, which are out of P1 scope).
  email: text("email").unique(),
  status: text("status").notNull().default("active"), // active | banned | deleted
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const characters = pgTable(
  "characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .unique()
      .references(() => accounts.id),
    name: text("name").notNull().unique(),
    appearance: jsonb("appearance").notNull(),
    // Currency is "Shards" (doc's "bits" naming is superseded).
    shards: bigint("shards", { mode: "number" }).notNull().default(500),
    energy: integer("energy").notNull().default(100),
    energyUpdated: timestamp("energy_updated", { withTimezone: true }).notNull().defaultNow(),
    posZone: text("pos_zone").notNull().default("farm"),
    posX: integer("pos_x").notNull().default(25),
    posY: integer("pos_y").notNull().default(25),
    skills: jsonb("skills")
      .notNull()
      .default({ farming: 0, mining: 0, foraging: 0, crafting: 0, archaeology: 0 }),
    tutorialStep: integer("tutorial_step").notNull().default(0),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => [
    check("characters_shards_nonneg", sql`${t.shards} >= 0`),
    check("characters_name_len", sql`length(${t.name}) between 3 and 16`),
  ],
);

// ============ ITEMS & INVENTORY ============

export const itemDefs = pgTable("item_defs", {
  id: text("id").primaryKey(), // 'wood', 'iron_hoe', 'seed_bitberry'
  category: text("category").notNull(),
  stackMax: integer("stack_max").notNull().default(999),
  baseValue: bigint("base_value", { mode: "number" }).notNull().default(0),
  tradeable: boolean("tradeable").notNull().default(true),
  mintable: boolean("mintable").notNull().default(false),
  meta: jsonb("meta").notNull().default({}),
});

export const inventorySlots = pgTable(
  "inventory_slots",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id),
    container: text("container").notNull().default("backpack"), // backpack | storage:<id>
    slot: integer("slot").notNull(),
    itemId: text("item_id")
      .notNull()
      .references(() => itemDefs.id),
    qty: integer("qty").notNull(),
    instanceMeta: jsonb("instance_meta"), // durability, relic provenance, etc.
  },
  (t) => [
    primaryKey({ columns: [t.characterId, t.container, t.slot] }),
    check("inventory_qty_pos", sql`${t.qty} > 0`),
    index("inv_by_item").on(t.characterId, t.itemId),
  ],
);

// ============ LAND, TILES, STRUCTURES ============

export const farms = pgTable("farms", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .unique()
    .references(() => characters.id),
  name: text("name").notNull().default("Abandoned Plot"),
  layoutRev: integer("layout_rev").notNull().default(0),
  deedAssetId: text("deed_asset_id"),
});

export const farmTiles = pgTable(
  "farm_tiles",
  {
    farmId: uuid("farm_id")
      .notNull()
      .references(() => farms.id),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    state: text("state").notNull(), // tilled | watered | path | debris_rock | debris_tree
    wateredUntil: timestamp("watered_until", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.farmId, t.x, t.y] })],
);

export const crops = pgTable(
  "crops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("farm_id")
      .notNull()
      .references(() => farms.id),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    cropId: text("crop_id")
      .notNull()
      .references(() => itemDefs.id),
    plantedAt: timestamp("planted_at", { withTimezone: true }).notNull().defaultNow(),
    wateredUntil: timestamp("watered_until", { withTimezone: true }),
    growthCreditMs: bigint("growth_credit_ms", { mode: "number" }).notNull().default(0),
    fertilizer: text("fertilizer"),
    seasonPlanted: integer("season_planted").notNull(),
  },
  (t) => [unique("crops_farm_xy").on(t.farmId, t.x, t.y)],
);

export const structures = pgTable(
  "structures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // A structure belongs to EITHER a private farm (machines) OR a town plot
    // (P7 free-form building) — exactly one, enforced by structures_owner_xor.
    farmId: uuid("farm_id").references(() => farms.id),
    plotId: uuid("plot_id").references(() => plots.id),
    defId: text("def_id").notNull(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    // Footprint in tiles, denormalized from the content def so bounds/overlap
    // checks are pure DB (a structure's footprint never changes on upgrade).
    w: integer("w").notNull().default(1),
    h: integer("h").notNull().default(1),
    rotation: integer("rotation").notNull().default(0),
    level: integer("level").notNull().default(1), // structure TIER (hut=1 .. skyscraper=6)
    state: jsonb("state").notNull().default({}),
  },
  (t) => [
    check("structures_owner_xor", sql`(${t.farmId} is null) <> (${t.plotId} is null)`),
    index("structures_by_plot").on(t.plotId),
  ],
);

export const machineJobs = pgTable(
  "machine_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    structureId: uuid("structure_id")
      .notNull()
      .references(() => structures.id),
    recipeId: text("recipe_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishesAt: timestamp("finishes_at", { withTimezone: true }).notNull(),
    collected: boolean("collected").notNull().default(false),
  },
  (t) => [index("jobs_ready").on(t.structureId).where(sql`not ${t.collected}`)],
);

// ============ TOWN PLOTS (claimable land) ============

/**
 * The shared island's claimable building plots (P6). Rows mirror the fixed
 * `PLOTS` grid in packages/content (seeded idempotently). Ownership is mutated
 * ONLY server-side, in a transaction, via the `claimPlot`/`buyPlot` helpers
 * (which ledger the Shards spend). `owner_id` null = unclaimed. A plot is a
 * CANVAS — what's built on it lives in `structures` (P7), not a per-plot tier.
 * Players may own MULTIPLE plots (portfolio flipping, P9), capped in code.
 */
export const plots = pgTable(
  "plots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stable content index — the key clients claim/buy against. */
    plotIndex: integer("plot_index").notNull().unique(),
    ownerId: uuid("owner_id").references(() => characters.id), // null = unclaimed
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    // Footprint (tiles), copied from content so the API needn't import the map.
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    w: integer("w").notNull(),
    h: integer("h").notNull(),
  },
  (t) => [index("plots_by_owner").on(t.ownerId)],
);

// ============ LAND MARKET (P9) ============

/**
 * Player-to-player land listings (the flip market). At most ONE active listing
 * per plot (partial-unique index). A sale is server-authoritative + dupe-proof:
 * `buyPlot` locks the active listing row by the `status='active'` predicate so two
 * concurrent buyers can't both win. Currency is `shards` for now but carried on
 * the row so the native token can slot in later.
 */
export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    plotId: uuid("plot_id")
      .notNull()
      .references(() => plots.id),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => characters.id),
    price: bigint("price", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("shards"),
    status: text("status").notNull().default("active"), // active | sold | cancelled
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    soldTo: uuid("sold_to").references(() => characters.id),
    soldAt: timestamp("sold_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("listings_one_active_per_plot")
      .on(t.plotId)
      .where(sql`${t.status} = 'active'`),
    index("listings_by_status").on(t.status),
    check("listings_price_pos", sql`${t.price} > 0`),
  ],
);

/**
 * The house treasury — accrues the market fee cut from each land sale (funds
 * season prize pools later). One row per currency.
 */
export const treasury = pgTable("treasury", {
  currency: text("currency").primaryKey(),
  balance: bigint("balance", { mode: "number" }).notNull().default(0),
});

/**
 * Shared-world gathering nodes (choppable trees / mineable rocks). A row exists
 * only once a node has been harvested; `harvested_at` drives the respawn timer.
 * Node positions/kinds live in packages/content (`GATHER_NODES`).
 */
export const worldNodes = pgTable("world_nodes", {
  nodeId: text("node_id").primaryKey(),
  harvestedAt: timestamp("harvested_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============ QUESTS ============

/**
 * Per-character quest state (P8). Rows are created server-side: the onboarding
 * chain's first quest + the daily quests are auto-assigned, and completing+
 * claiming a story quest assigns its `unlocks`. `objectives` maps an objective
 * INDEX ("0","1") to its numeric progress; `status` walks active → complete →
 * claimed. Rewards are granted ONLY on claim, via moveShards/moveItems (ledgered)
 * in the same transaction. `day` stamps the game-day a daily was (re)assigned so
 * dailies reset once per game-day; null for story quests. Quest defs live in
 * packages/content.
 */
export const questProgress = pgTable(
  "quest_progress",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id),
    questId: text("quest_id").notNull(),
    status: text("status").notNull().default("active"), // active | complete | claimed
    objectives: jsonb("objectives").notNull().default({}),
    day: integer("day"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.characterId, t.questId] })],
);

// ============ ECONOMY ============

export const ledger = pgTable(
  "ledger",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    characterId: uuid("character_id").notNull(), // intentionally no FK: append-only audit trail
    deltaShards: bigint("delta_shards", { mode: "number" }).notNull(),
    reason: text("reason").notNull(), // 'market_sale', 'quest_reward', ...
    ref: uuid("ref"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ledger_by_character").on(t.characterId, t.at)],
);

// ============ SEASONS / LEADERBOARD (P10) ============

/**
 * Time-boxed competitive seasons. Exactly one is `active` (partial-unique index).
 * `pool_shards` accrues each land-sale fee DURING the season; at `ends_at` the
 * season is ENDED — the pool is paid to the top finishers (treasury→winners,
 * ledgered), results are recorded, the scoreboard resets, and a fresh season
 * starts. A reset NEVER touches assets (land/buildings/Shards/items).
 */
export const seasons = pgTable(
  "seasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: integer("number").notNull().unique(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("active"), // active | ended
    poolShards: bigint("pool_shards", { mode: "number" }).notNull().default(0),
  },
  (t) => [uniqueIndex("seasons_one_active").on(t.status).where(sql`${t.status} = 'active'`)],
);

/**
 * Running competitive PROFIT for a (season, character): credited the sale price
 * when you sell land, debited the price when you buy — so a flip nets positive.
 * Updated in the SAME transaction as the sale (row-locked, race-safe).
 */
export const seasonScores = pgTable(
  "season_scores",
  {
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id),
    profit: bigint("profit", { mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.seasonId, t.characterId] })],
);

/**
 * The permanent record of season winners — the source of a character's trophy
 * flags (survives the scoreboard reset forever).
 */
export const seasonResults = pgTable(
  "season_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id),
    seasonNumber: integer("season_number").notNull(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id),
    board: text("board").notNull(), // profit | portfolio
    rank: integer("rank").notNull(),
    prizeShards: bigint("prize_shards", { mode: "number" }).notNull().default(0),
    awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("season_results_by_character").on(t.characterId)],
);
