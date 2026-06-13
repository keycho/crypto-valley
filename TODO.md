# TODO

## Done — M0 / P0: monorepo scaffold

- pnpm + turborepo workspace (`apps/{web,api,game-server}`, `packages/{shared,sim,worldgen,db,content,config}`)
- `CLAUDE.md` agent rules; design docs in `/docs`
- Tooling: turbo pipeline, vitest, eslint, drizzle-kit config, docker-compose Postgres 16, CI
- Verified: `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm dev` (web :3000, api `/health`, game-server ping→pong)

## Done — P1: DB schema + dupe-proof ledger helpers (docs/crypto-valley-mvp.md §2)

- Drizzle schema: accounts, characters, item_defs, inventory_slots, farms, farm_tiles,
  crops, structures, machine_jobs, ledger (currency = **shards**; UUIDv7 in app code
  with `gen_random_uuid()` safety net; all CHECK/unique/partial indexes preserved)
- Initial migration `drizzle/0000_green_chameleon.sql` (generated + committed)
- `moveShards` — guarded atomic UPDATE + same-transaction ledger row; the only
  exported writer of `characters.shards`; throws `INSUFFICIENT_FUNDS`
- `moveItems` — PK-ordered `FOR UPDATE` locking (deadlock-free), stack_max
  merge/overflow, all-or-nothing, never leaves qty ≤ 0; throws `INSUFFICIENT_ITEMS`
- `packages/content/items.json` (20-item catalog) + CI `validate` + idempotent `db:seed`
- Tests (vitest vs Postgres, throwaway schema per run): all six mandatory cases green,
  incl. 20-way concurrent withdrawal split and 50× deadlock loop
- CI runs a Postgres 16 service for the db tests

## Next session

- [ ] **P2 — Phaser shell in Next.js (docs/crypto-valley-build-readiness.md §4 P2)**

  Mount Phaser 3 via `next/dynamic({ ssr: false })` on `/play`: Boot/Preload/World
  scenes, a placeholder Tiled map with the six standard layers, 16px tiles at 3× zoom,
  `pixelArt: true`, arcade physics, WASD+arrows movement with collision, y-sorted player
  vs the `above` layer, and a React HUD (Zustand) clock placeholder. Acceptance: a
  walkable town in the browser at 60fps with no sub-pixel jitter.
