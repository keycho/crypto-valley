import { WorldActionSchema } from "@crypto-valley/shared";
import type { WorldActionResult, WorldState } from "@crypto-valley/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getWorldState, WorldError, worldAct } from "./service";

const StateQuerySchema = z.object({ characterId: z.string().uuid() });

const errMsg = (e: unknown): string => (e instanceof WorldError ? e.message : "INTERNAL");

export async function worldRoutes(app: FastifyInstance): Promise<void> {
  app.get("/world/state", async (req, reply): Promise<WorldState | WorldActionResult> => {
    const q = StateQuerySchema.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ ok: false, error: "BAD_QUERY" });
    try {
      return await getWorldState(q.data.characterId, Date.now());
    } catch (e) {
      return reply.code(404).send({ ok: false, error: errMsg(e) });
    }
  });

  app.post("/world/act", async (req): Promise<WorldActionResult> => {
    const parsed = WorldActionSchema.safeParse(req.body);
    if (!parsed.success) return { ok: false, error: "BAD_REQUEST" };
    const now = Date.now();
    try {
      const { toast } = await worldAct(parsed.data, now);
      const state = await getWorldState(parsed.data.characterId, now);
      return { ok: true, state, toast };
    } catch (e) {
      if (e instanceof WorldError) return { ok: false, error: e.message };
      // DB helpers throw TypedError with a machine code (PLOT_TAKEN, etc.).
      const code = (e as { code?: string }).code;
      if (typeof code === "string") return { ok: false, error: code };
      throw e;
    }
  });
}
