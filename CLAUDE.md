# Crypto Valley — agent instructions

A cozy 2D top-down multiplayer farming/building MMO. Stardew-like, themed around
**advancing through the ages** — every player claims land and grows it from the
Stone Age toward the year 3000, while the whole world advances together. Stack:
**Phaser 3 + Next.js 14** client, **Node + ws** game server, **Fastify 4** API,
**PostgreSQL via Drizzle**, TypeScript strict everywhere.

> Canonical pitch (use everywhere): _A cozy shared-world MMO where you claim land,
> work it, and build it up through the ages — from a Stone-Age clearing to a
> year-3000 skyline. Your land is yours to develop, flip, and show off as the
> whole world climbs the ages together._

The visual identity is the **Warm Ages** look + the per-age palette transformation
(see `docs/art-bible.md`). The old "collapsed blockchain civilization / Overgrown
Terminal / archaeology" theme is **superseded** — do not reintroduce dead-civ,
ruins-excavation, relics/data-nodes, the Cascade, or the Static.

## Source of truth

Design docs live in `/docs`. **Read the relevant doc before implementing a system** —
they were written to be consumed one section per task.

- Architecture & DB schema: `docs/crypto-valley-mvp.md`
- Scope — what is IN/OUT of launch: `docs/crypto-valley-scope-lock.md` (LOCKED; supersedes prior roadmaps)
- World generation: `docs/crypto-valley-procedural-world.md`
- Economy / token rules: `docs/crypto-valley-token-addendum.md`
- Build readiness & prompt sequence: `docs/crypto-valley-build-readiness.md`

Never implement anything on the DELAY list in the scope-lock without being asked.

## Hard rules (enforced in code review, not just policy)

- **Server-authoritative.** The client never mutates inventory, currency, tiles, or
  quest state locally — it is a renderer + input device. All economy mutations go
  through `packages/db` helpers (e.g. `moveShards`, `moveItems`) that write an
  append-only `ledger` row **in the same transaction** as the mutation. No exceptions:
  a trading economy treats dupes like a smart-contract exploit.
- **`packages/sim` and `packages/worldgen` are PURE.** No IO, no `Date.now()` — time
  is always a parameter. Same seed + inputs ⇒ same outputs, **always**. These packages
  are imported by both the client and the servers; determinism is sacred. Tests are
  **required** whenever you touch them.
- **Currency is "Shards"** (off-chain points) everywhere. There is **no token, wallet,
  or payment code anywhere yet** — do not add any. NFTs/Solana are out of current scope.
- **Art constants:** 16px tiles, 3× zoom, `pixelArt: true`, integer camera positions.
  Tiled (`.tmj`) layer names, in order: `ground / ground_detail / collision / objects / above / lights`.
- **Validate everything at the boundary.** Zod-validate every WebSocket message and
  every HTTP body. TypeScript `strict` is on in every package.

## Workflow

- pnpm workspaces + turborepo. Apps: `apps/web`, `apps/api`, `apps/game-server`.
  Packages: `packages/{shared,sim,worldgen,db,content,config}`.
- **Conventional commits.** One milestone-sized, reviewable change per task.
- After schema changes: `pnpm db:generate && pnpm db:migrate`, and commit the migration.
- Tests run on **vitest**. `packages/sim` and `packages/worldgen` require tests.
- **Run `pnpm typecheck && pnpm test` before declaring any task done.**

## Environment

- Postgres connection string lives in `.env` as `DATABASE_URL` (see `.env.example`);
  never commit `.env`. A local Postgres 16 is provided via `docker-compose.yml`.
- Don't deploy unless explicitly asked.
