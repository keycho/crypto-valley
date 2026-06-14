# Crypto Valley

> A cozy shared-world MMO where you claim land, work it, and build it up through
> the ages — from a Stone-Age clearing to a year-3000 skyline. Your land is yours
> to develop, flip, and show off as the whole world climbs the ages together.

A 2D top-down multiplayer farming/building MMO themed around **advancing through
the ages**. This repository is a **pnpm + turborepo monorepo**. Design docs live
in [`/docs`](./docs); agent rules live in [`CLAUDE.md`](./CLAUDE.md).

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
pnpm install   # install the workspace
pnpm play      # ONE command: Postgres + game-server + api + web, fast clock,
               # auto dev-bootstrap. Open http://localhost:3000/play
```

`pnpm play` reuses a running Postgres if it finds one, otherwise starts the
docker-compose Postgres 16. To run the pieces by hand instead:

```bash
cp .env.example .env         # configure DATABASE_URL / ports
docker compose up -d         # local Postgres 16
pnpm dev                     # boots web (:3000), api (:3001), game-server (:8080)
```

## Scripts (run from the repo root)

| Script            | What it does                                         |
| ----------------- | ---------------------------------------------------- |
| `pnpm play`       | Everything to play locally (Postgres + all 3 servers, fast clock, auto-bootstrap) |
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
