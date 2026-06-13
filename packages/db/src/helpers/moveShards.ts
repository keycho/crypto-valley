import { and, eq, sql } from "drizzle-orm";

import type { Tx } from "../client";
import { TypedError } from "../errors";
import { characters, ledger } from "../schema";

/**
 * The ONLY function in the codebase that writes `characters.shards`.
 *
 * - Atomic, guarded UPDATE (no read-then-write): the WHERE clause refuses to
 *   apply the delta if it would drive the balance negative. Under READ COMMITTED
 *   the guard is re-evaluated against the latest committed value when concurrent
 *   writers serialize on the row lock, so exactly the affordable mutations win —
 *   this is what makes concurrent withdrawals dupe-proof.
 * - Writes a `ledger` row in the SAME transaction as the balance change.
 *
 * @returns the character's new shard balance.
 * @throws TypedError `INSUFFICIENT_FUNDS` if the delta would make the balance negative.
 * @throws TypedError `CHARACTER_NOT_FOUND` if no such character exists.
 */
export async function moveShards(
  tx: Tx,
  characterId: string,
  delta: number,
  reason: string,
  ref?: string,
): Promise<number> {
  const updated = await tx
    .update(characters)
    .set({ shards: sql`${characters.shards} + ${delta}` })
    .where(
      and(eq(characters.id, characterId), sql`${characters.shards} + ${delta} >= 0`),
    )
    .returning({ shards: characters.shards });

  if (updated.length === 0) {
    const exists = await tx
      .select({ id: characters.id })
      .from(characters)
      .where(eq(characters.id, characterId));
    if (exists.length === 0) {
      throw new TypedError("CHARACTER_NOT_FOUND", `no character ${characterId}`);
    }
    throw new TypedError(
      "INSUFFICIENT_FUNDS",
      `character ${characterId} cannot move ${delta} shards`,
    );
  }

  await tx.insert(ledger).values({
    characterId,
    deltaShards: delta,
    reason,
    ref: ref ?? null,
  });

  return updated[0].shards;
}
