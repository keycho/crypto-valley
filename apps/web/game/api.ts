import type {
  ActionResult,
  FarmAction,
  FarmState,
  WorldAction,
  WorldActionResult,
  WorldState,
} from "@crypto-valley/shared";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Ensure the single-player dev character exists; returns its id. */
export async function bootstrap(): Promise<string> {
  const r = await fetch(`${BASE}/dev/bootstrap`, { method: "POST" });
  const j = (await r.json()) as { characterId: string };
  return j.characterId;
}

/** Create a fresh player character (persists name + appearance); returns its id. */
export async function createCharacter(
  name: string,
  appearance: { sheet: string },
): Promise<string> {
  const r = await fetch(`${BASE}/dev/character`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, appearance }),
  });
  const j = (await r.json()) as { characterId: string };
  return j.characterId;
}

export async function fetchState(characterId: string): Promise<FarmState> {
  const r = await fetch(`${BASE}/farm/state?characterId=${characterId}`);
  return (await r.json()) as FarmState;
}

export async function act(body: FarmAction): Promise<ActionResult> {
  const r = await fetch(`${BASE}/farm/act`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await r.json()) as ActionResult;
}

/** Town/plot state: plots (owner + tier), gather nodes, and the player's me. */
export async function fetchWorld(characterId: string): Promise<WorldState> {
  const r = await fetch(`${BASE}/world/state?characterId=${characterId}`);
  return (await r.json()) as WorldState;
}

export async function worldAct(body: WorldAction): Promise<WorldActionResult> {
  const r = await fetch(`${BASE}/world/act`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await r.json()) as WorldActionResult;
}
