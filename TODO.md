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

## Done — P2: Phaser shell + walkable town (docs/crypto-valley-build-readiness.md §4 P2)

- Asset pipeline: `apps/web/scripts/build-tileset.mts` composes a purpose-built
  atlas (+ manifest) from named LimeZu Singles; `gen-town-map.mts` deterministically
  generates `town.tmj` (60×50, six standard layers). Picks documented in
  `apps/web/game/ASSETS.md`; runtime assets in `apps/web/public/assets/`
- Phaser 3.80.1 on `/play` via the existing `dynamic({ ssr:false })` boundary:
  Boot/Preload(loading bar)/World scenes, `pixelArt`+`roundPixels`, camera zoom 3,
  arcade physics vs invisible collision layer, canopies/roofs on `above` (depth 10)
- Player: Adam 16×32, 6-frame 4-direction walk, WASD+arrows, 90 px/s normalized
  diagonals, feet-only body, integer camera follow
- HUD bridge: typed mitt bus → Zustand → Clock (1 game-min/s) + dev-only FPS
- Verified headless (Playwright/Chromium, WebGL): exact 135px in 1.5s, house+water
  collision stops, canopy occlusion both ways, clock ticking, zero console errors

## Done — P3: Farming core (single-player loop)

- packages/sim: pure `cropStage()` (grows only while watered; lazy, schema-fit) +
  `regenEnergy()` + action costs — determinism unit tests
- packages/content: `crops.ts` (bitberry) + `farm.ts` (starter-plot layout shared
  by map gen + API)
- packages/shared: zod farm action/state protocol (every HTTP body validated)
- apps/api: server-authoritative loop — `/dev/bootstrap`, `GET /farm/state`
  (lazy stages + energy regen), `POST /farm/act` (hoe/water/plant/harvest in one
  transaction; range + energy + zone validated; inventory via `moveItems`, XP on
  harvest); `@fastify/cors`
- apps/web: farm zone map + town↔farm edge warp; synthesized soil (bare/tilled/
  watered-dark) + 5-stage bitberry sprites; Phaser `FarmController` (soil + crop
  rendering, optimistic action, 1.5s growth poll); React hotbar (number keys +
  click), inventory panel, energy/XP bar, toast
- Verified in-browser: walk to farm, till/plant/water a row, crops advance
  `000→444` on the fast clock, harvest → +6 Bitberry / +36 XP, energy spent,
  out-of-range + not-ready rejected. Screenshots in docs/screenshots/farm-*.png

## Next session

- [ ] **P4 — multiplayer presence (docs/crypto-valley-build-readiness.md §4 P3)**

  WS protocol (hello/move/snap/chat subset) in `packages/shared` with Zod;
  game-server single Town room at 10 Hz validating speed+collision against the
  same `.tmj`; client connects with a dev token, sends move intents ≤15/s,
  interpolates remote players 100 ms back with local prediction + snap
  reconciliation; zone-local chat. Acceptance: two browsers see each other move;
  a teleport-hack message is rejected.

  WS protocol (hello/move/snap/chat subset) in `packages/shared` with Zod schemas.
  game-server: single Town room, 10 Hz tick, speed+collision validation against the
  same `town.tmj`, dirty-entity snapshot broadcast. Client: dev-token connect, move
  intents ≤15/s, remote players interpolated 100 ms back, local prediction with snap
  reconciliation, zone-local chat box. Acceptance: two browsers see each other move
  smoothly; chat works; a teleport-hack message is rejected by the server.
