import {
  type Appearance,
  decodeS2C,
  type Dir,
  encodeMsg,
  type PlayerDto,
  PROTOCOL_VERSION,
  type SnapEntry,
} from "@crypto-valley/shared";

export interface NetHandlers {
  onWelcome: (youId: string, players: PlayerDto[]) => void;
  onSnapshot: (players: SnapEntry[]) => void;
  onJoined: (player: PlayerDto) => void;
  onLeft: (id: string) => void;
  onChat: (fromId: string, name: string, msg: string) => void;
}

const MOVE_INTERVAL_MS = 1000 / 15; // coalesce move intents to <=15/s

/** Thin browser WebSocket transport for the shared town (msgpack + zod). */
export class CvNet {
  private ws?: WebSocket;
  private seq = 0;
  private lastMoveSentAt = 0;
  youId = "";

  constructor(
    private readonly url: string,
    private readonly handlers: NetHandlers,
  ) {}

  connect(characterId: string, name: string, appearance: Appearance): void {
    const ws = new WebSocket(`${this.url}?token=dev:${characterId}`);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onopen = () => this.raw({ t: "join", v: PROTOCOL_VERSION, characterId, name, appearance });
    ws.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      const m = decodeS2C(e.data);
      if (!m) return;
      switch (m.t) {
        case "welcome":
          this.youId = m.youId;
          this.handlers.onWelcome(m.youId, m.players);
          break;
        case "snapshot":
          this.handlers.onSnapshot(m.players);
          break;
        case "playerJoined":
          this.handlers.onJoined(m.player);
          break;
        case "playerLeft":
          this.handlers.onLeft(m.id);
          break;
        case "chat":
          this.handlers.onChat(m.fromId, m.name, m.msg);
          break;
        default:
          break;
      }
    };
  }

  /** Coalesced move intent; `force` bypasses the rate limit (e.g. a stop). */
  sendMove(x: number, y: number, dir: Dir, moving: boolean, force = false): void {
    const now = performance.now();
    if (!force && now - this.lastMoveSentAt < MOVE_INTERVAL_MS) return;
    this.lastMoveSentAt = now;
    this.raw({ t: "move", seq: ++this.seq, x: Math.round(x), y: Math.round(y), dir, moving });
  }

  sendChat(msg: string): void {
    this.raw({ t: "chat", msg: msg.slice(0, 200) });
  }

  private raw(msg: unknown): void {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(encodeMsg(msg as never));
      }
    } catch {
      /* socket closing */
    }
  }

  disconnect(): void {
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = undefined;
  }
}
