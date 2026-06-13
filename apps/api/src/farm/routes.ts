import { FarmActionSchema } from "@crypto-valley/shared";
import type { ActionResult, FarmState } from "@crypto-valley/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { act, ActionError, bootstrap, getFarmState } from "./service";

const StateQuerySchema = z.object({ characterId: z.string().uuid() });

const errMsg = (e: unknown): string =>
  e instanceof ActionError ? e.message : "INTERNAL";

export async function farmRoutes(app: FastifyInstance): Promise<void> {
  // Dev-only: ensure the single-player character exists (no auth yet, pre-P4).
  app.post("/dev/bootstrap", async () => bootstrap());

  app.get("/farm/state", async (req, reply): Promise<FarmState | ActionResult> => {
    const q = StateQuerySchema.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ ok: false, error: "BAD_QUERY" });
    try {
      return await getFarmState(q.data.characterId, Date.now());
    } catch (e) {
      return reply.code(404).send({ ok: false, error: errMsg(e) });
    }
  });

  app.post("/farm/act", async (req): Promise<ActionResult> => {
    const parsed = FarmActionSchema.safeParse(req.body);
    if (!parsed.success) return { ok: false, error: "BAD_REQUEST" };
    const now = Date.now();
    try {
      const { toast } = await act(parsed.data, now);
      const state = await getFarmState(parsed.data.characterId, now);
      return { ok: true, state, toast };
    } catch (e) {
      if (e instanceof ActionError) return { ok: false, error: e.message };
      throw e;
    }
  });
}
