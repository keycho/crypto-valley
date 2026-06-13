import { and, eq, inArray } from "drizzle-orm";

import type { Tx } from "../client";
import { TypedError } from "../errors";
import { inventorySlots, itemDefs } from "../schema";

export interface MoveItemOp {
  characterId: string;
  /** Defaults to "backpack". */
  container?: string;
  itemId: string;
  /** Positive = add, negative = remove. */
  qty: number;
}

interface Slot {
  slot: number;
  itemId: string;
  qty: number;
}

const containerKey = (characterId: string, container: string): string =>
  `${characterId}::${container}`;

/**
 * The single, all-or-nothing helper for inventory mutations.
 *
 * Strategy:
 *  1. Lock every affected container's rows with `SELECT ... FOR UPDATE`, ordered
 *     by primary key (containers processed in sorted order, rows ordered by slot).
 *     Identical per-container queries + a sorted container loop give a globally
 *     consistent lock order, so two transactions touching the same slots in
 *     opposite op-order can never deadlock.
 *  2. Simulate ALL ops against the locked snapshot (validate-then-apply). A
 *     failing op throws before any write, so the op list is atomic.
 *  3. Flush the diff: emptied slots are deleted (never left at qty <= 0), changed
 *     slots updated, overflow written to new slots at the lowest free index.
 *
 * @throws TypedError `INSUFFICIENT_ITEMS` if a removal exceeds the amount owned.
 * @throws TypedError `ITEM_NOT_FOUND` if an op references an unknown item.
 */
export async function moveItems(tx: Tx, ops: MoveItemOp[]): Promise<void> {
  const normalized = ops
    .map((o) => ({
      characterId: o.characterId,
      container: o.container ?? "backpack",
      itemId: o.itemId,
      qty: o.qty,
    }))
    .filter((o) => o.qty !== 0);
  if (normalized.length === 0) return;

  // stack_max for every item touched (static catalog — no locking needed).
  const itemIds = [...new Set(normalized.map((o) => o.itemId))];
  const defs = await tx
    .select({ id: itemDefs.id, stackMax: itemDefs.stackMax })
    .from(itemDefs)
    .where(inArray(itemDefs.id, itemIds));
  const stackMax = new Map(defs.map((d) => [d.id, d.stackMax]));
  for (const id of itemIds) {
    if (!stackMax.has(id)) throw new TypedError("ITEM_NOT_FOUND", `unknown item: ${id}`);
  }

  // Distinct (character, container) pairs, sorted for a deterministic lock order.
  const pairs = [
    ...new Map(
      normalized.map((o) => [
        containerKey(o.characterId, o.container),
        { characterId: o.characterId, container: o.container },
      ]),
    ).values(),
  ].sort((a, b) =>
    containerKey(a.characterId, a.container) < containerKey(b.characterId, b.container)
      ? -1
      : 1,
  );

  const models = new Map<string, Map<number, Slot>>();
  const originals = new Map<string, Map<number, Slot>>();
  for (const p of pairs) {
    const rows = await tx
      .select()
      .from(inventorySlots)
      .where(
        and(
          eq(inventorySlots.characterId, p.characterId),
          eq(inventorySlots.container, p.container),
        ),
      )
      .orderBy(inventorySlots.slot)
      .for("update");
    const model = new Map<number, Slot>();
    const original = new Map<number, Slot>();
    for (const r of rows) {
      model.set(r.slot, { slot: r.slot, itemId: r.itemId, qty: r.qty });
      original.set(r.slot, { slot: r.slot, itemId: r.itemId, qty: r.qty });
    }
    models.set(containerKey(p.characterId, p.container), model);
    originals.set(containerKey(p.characterId, p.container), original);
  }

  // Simulate every op; a failure here throws before any DB write (all-or-nothing).
  for (const op of normalized) {
    const model = models.get(containerKey(op.characterId, op.container))!;
    const max = stackMax.get(op.itemId)!;
    if (op.qty > 0) addToModel(model, op.itemId, op.qty, max);
    else removeFromModel(model, op.itemId, -op.qty);
  }

  // Flush the diff per container.
  for (const p of pairs) {
    const key = containerKey(p.characterId, p.container);
    const model = models.get(key)!;
    const original = originals.get(key)!;
    const touched = new Set<number>([...original.keys(), ...model.keys()]);
    for (const slot of touched) {
      const before = original.get(slot);
      const after = model.get(slot);
      const where = and(
        eq(inventorySlots.characterId, p.characterId),
        eq(inventorySlots.container, p.container),
        eq(inventorySlots.slot, slot),
      );
      if (before && !after) {
        await tx.delete(inventorySlots).where(where);
      } else if (!before && after) {
        await tx.insert(inventorySlots).values({
          characterId: p.characterId,
          container: p.container,
          slot,
          itemId: after.itemId,
          qty: after.qty,
        });
      } else if (before && after && (before.itemId !== after.itemId || before.qty !== after.qty)) {
        await tx
          .update(inventorySlots)
          .set({ itemId: after.itemId, qty: after.qty })
          .where(where);
      }
    }
  }
}

function addToModel(model: Map<number, Slot>, itemId: string, qty: number, max: number): void {
  let remaining = qty;
  // Merge into existing stacks of this item, lowest slot first.
  const existing = [...model.values()]
    .filter((s) => s.itemId === itemId)
    .sort((a, b) => a.slot - b.slot);
  for (const s of existing) {
    if (remaining <= 0) break;
    const space = max - s.qty;
    if (space > 0) {
      const take = Math.min(space, remaining);
      s.qty += take;
      remaining -= take;
    }
  }
  // Overflow into new slots at the lowest free index.
  while (remaining > 0) {
    const idx = lowestFreeSlot(model);
    const take = Math.min(max, remaining);
    model.set(idx, { slot: idx, itemId, qty: take });
    remaining -= take;
  }
}

function removeFromModel(model: Map<number, Slot>, itemId: string, need: number): void {
  const stacks = [...model.values()]
    .filter((s) => s.itemId === itemId)
    .sort((a, b) => a.slot - b.slot);
  const owned = stacks.reduce((sum, s) => sum + s.qty, 0);
  if (owned < need) {
    throw new TypedError("INSUFFICIENT_ITEMS", `need ${need} ${itemId}, have ${owned}`);
  }
  let remaining = need;
  for (const s of stacks) {
    if (remaining <= 0) break;
    const take = Math.min(s.qty, remaining);
    s.qty -= take;
    remaining -= take;
    if (s.qty <= 0) model.delete(s.slot); // never leave a row at qty <= 0
  }
}

function lowestFreeSlot(model: Map<number, Slot>): number {
  let i = 0;
  while (model.has(i)) i++;
  return i;
}
