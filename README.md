# Crypto Valley

> A cozy MMO where players excavate the ruins of a lost blockchain civilization,
> build a town that remembers them, and discover relics that become part of the
> world's permanent history.

A 2D top-down multiplayer farming/archaeology game. This repository is a
**pnpm + turborepo monorepo**. Design docs live in [`/docs`](./docs); agent rules
live in [`CLAUDE.md`](./CLAUDE.md).

> **Status:** M0 scaffold. No gameplay yet — this commit only proves the toolchain
> (install / typecheck / test / dev) end to end.

## Stack

- **Client** — Next.js 14 (app router) + Phaser 3 _(Phaser lands next milestone)_
- **API** — Fastify 4 + Zod
- **Game server** — Node + `ws`
- **Database** — PostgreSQL 16 via Drizzle
- TypeScript `strict` everywhere; vitest for tests.

## Layout

```
apps/
  web/          Next.js 14 — marketing + /play (client-only mount)
  api/          Fastify 4 + Zod — GET /health
  game-server/  Node + ws — replies to {"t":"ping"} with {"t":"pong"}
packages/
  shared/       cross-package zod schemas (e.g. the ping message)
  sim/          PURE deterministic gameplay logic (no IO)
  worldgen/     PURE deterministic world generation (no IO)
  db/           Drizzle config + economy/ledger helpers (schema: next milestone)
  content/      game data as code
  config/       shared tsconfig base + eslint config
```

## Getting started

```bash
pnpm install                 # install the workspace
cp .env.example .env         # configure DATABASE_URL / ports
docker compose up -d         # local Postgres 16 (optional until there's a schema)
pnpm dev                     # boots web (:3000), api (:3001), game-server (:8080)
```

## Scripts (run from the repo root)

| Script            | What it does                                         |
| ----------------- | ---------------------------------------------------- |
| `pnpm dev`        | Runs web, api, and game-server concurrently (turbo)  |
| `pnpm build`      | Builds every app/package                             |
| `pnpm typecheck`  | `tsc --noEmit` across the workspace                  |
| `pnpm test`       | Runs vitest across every package                     |
| `pnpm lint`       | ESLint across the workspace                          |
| `pnpm db:generate`| Drizzle Kit — generate a migration from the schema   |
| `pnpm db:migrate` | Drizzle Kit — apply migrations to `DATABASE_URL`     |

## Quick smoke test

```bash
curl http://localhost:3001/health        # -> {"ok":true}
node -e "const ws=new WebSocket('ws://localhost:8080');ws.onopen=()=>ws.send(JSON.stringify({t:'ping'}));ws.onmessage=e=>{console.log(e.data);process.exit(0)}"
# -> {"t":"pong"}
```
