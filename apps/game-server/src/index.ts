import { WebSocketServer } from "ws";
import { z } from "zod";

import { makePong, PingMessageSchema } from "@crypto-valley/shared";

// Validate runtime config at the boundary (CLAUDE.md: zod-validate inputs).
const EnvSchema = z.object({
  GAME_SERVER_PORT: z.coerce.number().int().positive().default(8080),
});
const env = EnvSchema.parse(process.env);

const wss = new WebSocketServer({ port: env.GAME_SERVER_PORT });

wss.on("listening", () => {
  console.log(`game-server listening on ws://localhost:${env.GAME_SERVER_PORT}`);
});

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString());
    } catch {
      return; // ignore non-JSON frames
    }

    // Every WS message is zod-validated before it is acted on.
    const ping = PingMessageSchema.safeParse(payload);
    if (ping.success) {
      socket.send(JSON.stringify(makePong()));
    }
  });
});
