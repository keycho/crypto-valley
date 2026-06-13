import Fastify from "fastify";
import { z } from "zod";

// Validate runtime config at the boundary (CLAUDE.md: zod-validate inputs).
const EnvSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3001),
});
const env = EnvSchema.parse(process.env);

const HealthResponseSchema = z.object({ ok: z.literal(true) });

const app = Fastify({ logger: true });

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
