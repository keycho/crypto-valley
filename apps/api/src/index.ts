import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";

import { farmRoutes } from "./farm/routes";
import { worldRoutes } from "./world/routes";

// Validate runtime config at the boundary (CLAUDE.md: zod-validate inputs).
const EnvSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3001),
});
const env = EnvSchema.parse(process.env);

const HealthResponseSchema = z.object({ ok: z.literal(true) });

const app = Fastify({ logger: true });

// Dev: the web app (localhost:3000) calls this API directly.
await app.register(cors, { origin: true });
await app.register(farmRoutes);
await app.register(worldRoutes);

app.get("/health", async () => HealthResponseSchema.parse({ ok: true }));

app
  .listen({ port: env.API_PORT, host: "0.0.0.0" })
  .then((address) => {
    app.log.info(`api listening on ${address}`);
  })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
