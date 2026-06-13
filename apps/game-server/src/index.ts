import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  type Appearance,
  type CollisionGrid,
  decodeC2S,
  type Dir,
  encodeMsg,
  isMoveLegal,
  parseCollision,
  PROTOCOL_VERSION,
  type S2C,
  type TmjMap,
} from "@crypto-valley/shared";
import { WebSocketServer, type WebSocket } from "ws";
import { z } from "zod";

const EnvSchema = z.object({
  GAME_SERVER_PORT: z.coerce.number().int().positive().default(8080),
  GAME_TOWN_MAP: z.string().optional(),
});
const env = EnvSchema.parse(process.env);

// Load the shared town map for server-authoritative collision + spawn.
const TOWN_PATH =
  env.GAME_TOWN_MAP ??
  fileURLToPath(new URL("../../web/public/assets/maps/town.tmj", import.meta.url));
const townMap = JSON.parse(readFileSync(TOWN_PATH, "utf8")) as TmjMap;
const grid: CollisionGrid = parseCollision(townMap);
const SPAWN = (() => {
  const obj = townMap.layers
    .flatMap((l) => (l as { objects?: Array<{ name: string; x: number; y: number }> }).objects ?? [])
    .find((o) => o.name === "spawn");
  return { x: obj?.x ?? (townMap.width / 2) * townMap.tilewidth, y: obj?.y ?? (townMap.height / 2) * townMap.tilewidth };
})();

const TICK_MS = 100; // 10 Hz
const MAX_SPEED = 90; // px/s (matches client PLAYER_SPEED)
const SPEED_TOLERANCE = 1.7; // diagonal + latency slack
const CHAT_COOLDOWN_MS = 1000;

interface Player {
  id: string;
  ws: WebSocket;
  name: string;
  appearance: Appearance;
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
  lastSeq: number;
  lastMoveAt: number;
  lastChatAt: number;
}

const players = new Map<string, Player>();
let tick = 0;

/** Dev token `dev:<characterId>`. Swap for signed-token verification at P5. */
function verifyToken(token: string): { characterId: string } | null {
  if (token.startsWith("dev:")) {
    const id = token.slice(4);
    return id ? { characterId: id } : null;
  }
  return null;
}

const toDto = (p: Player) => ({
  id: p.id,
  name: p.name,
  appearance: p.appearance,
  x: Math.round(p.x),
  y: Math.round(p.y),
  dir: p.dir,
  moving: p.moving,
});

function send(ws: WebSocket, msg: S2C): void {
  try {
    ws.send(encodeMsg(msg));
  } catch {
    /* socket closing */
  }
}
function broadcast(msg: S2C, exceptId?: string): void {
  const buf = encodeMsg(msg);
  for (const p of players.values()) {
    if (p.id === exceptId) continue;
    try {
      p.ws.send(buf);
    } catch {
      /* drop */
    }
  }
}

const wss = new WebSocketServer({ port: env.GAME_SERVER_PORT });
wss.on("listening", () =>
  console.log(`game-server (town room) on ws://localhost:${env.GAME_SERVER_PORT}`),
);

wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const ident = verifyToken(url.searchParams.get("token") ?? "");
  if (!ident) {
    send(ws, { t: "error", code: "AUTH" });
    ws.close();
    return;
  }

  let pid = "";
  let joined = false;

  ws.on("message", (raw: Buffer) => {
    const msg = decodeC2S(raw); // null for anything malformed -> ignored
    if (!msg) return;

    if (msg.t === "join") {
      if (msg.v !== PROTOCOL_VERSION) {
        send(ws, { t: "error", code: "VERSION_MISMATCH" });
        ws.close();
        return;
      }
      if (joined) return;
      pid = ident.characterId;
      players.get(pid)?.ws.close(); // replace a stale session for the same id
      const player: Player = {
        id: pid,
        ws,
        name: msg.name,
        appearance: msg.appearance,
        x: SPAWN.x,
        y: SPAWN.y,
        dir: "down",
        moving: false,
        lastSeq: -1,
        lastMoveAt: Date.now(),
        lastChatAt: 0,
      };
      players.set(pid, player);
      joined = true;
      send(ws, {
        t: "welcome",
        v: PROTOCOL_VERSION,
        youId: pid,
        tick,
        players: [...players.values()].map(toDto),
      });
      broadcast({ t: "playerJoined", player: toDto(player) }, pid);
      return;
    }

    if (!joined) return; // must join before anything else
    const p = players.get(pid);
    if (!p) return;

    if (msg.t === "move") {
      if (msg.seq <= p.lastSeq) return; // stale / out of order
      const now = Date.now();
      const dt = Math.max(0.001, (now - p.lastMoveAt) / 1000);
      const maxDist = MAX_SPEED * dt * SPEED_TOLERANCE + 2;
      p.lastSeq = msg.seq;
      p.lastMoveAt = now;
      if (isMoveLegal(grid, p.x, p.y, msg.x, msg.y, maxDist)) {
        p.x = msg.x;
        p.y = msg.y;
        p.dir = msg.dir;
        p.moving = msg.moving;
      } else {
        // Rejected (speed/wall): keep authoritative pos. The next snapshot
        // carries it, so the sender reconciles and others never saw the jump.
        p.dir = msg.dir;
      }
    } else if (msg.t === "chat") {
      const now = Date.now();
      if (now - p.lastChatAt < CHAT_COOLDOWN_MS) return; // 1 msg/sec
      p.lastChatAt = now;
      broadcast({ t: "chat", fromId: p.id, name: p.name, msg: msg.msg });
    } else if (msg.t === "emote") {
      broadcast({ t: "emote", id: p.id, emote: msg.id }, p.id);
    }
  });

  const drop = (): void => {
    if (joined && players.get(pid)?.ws === ws) {
      players.delete(pid);
      broadcast({ t: "playerLeft", id: pid });
    }
  };
  ws.on("close", drop);
  ws.on("error", drop);
});

// 10 Hz authoritative snapshot of all town players.
setInterval(() => {
  tick++;
  if (players.size === 0) return;
  broadcast({
    t: "snapshot",
    tick,
    players: [...players.values()].map((p) => ({
      id: p.id,
      x: Math.round(p.x),
      y: Math.round(p.y),
      dir: p.dir,
      moving: p.moving,
    })),
  });
}, TICK_MS);
