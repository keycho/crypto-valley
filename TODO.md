# TODO

## Done — M0 / P0: monorepo scaffold

- pnpm + turborepo workspace (`apps/{web,api,game-server}`, `packages/{shared,sim,worldgen,db,content,config}`)
- `CLAUDE.md` agent rules; design docs in `/docs`
- Tooling: turbo pipeline, vitest, eslint, drizzle-kit config, docker-compose Postgres 16, CI
- Verified: `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm dev` (web :3000, api `/health`, game-server ping→pong)

## Next session

- [ ] **P1 — DB schema + dupe-proof ledger helpers (docs/crypto-valley-mvp.md §2)**

  Implement the Drizzle schema (accounts → ledger tables; skip token/auction tables
  for now), generate the initial migration, and add `packages/db` helpers
  `moveShards(tx, characterId, delta, reason, ref)` and `moveItems(tx, ops[])` with
  row locking ordered by PK and a `ledger` row written **in the same transaction**.
  Vitest integration tests against the docker-compose Postgres covering: concurrent
  `moveItems` can't dupe, negative-balance Shards rejected. Acceptance: tests pass.
