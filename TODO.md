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

## Done — P4: Shared-town multiplayer

- packages/shared: zod + msgpack net protocol (join/move/chat/emote ->
  welcome/snapshot/playerJoined/playerLeft/chat/emote/error), PROTOCOL_VERSION
  gating; shared Tiled collision loader + `isMoveLegal` (client + server validate
  identically). Round-trip + collision unit tests.
- apps/game-server: one shared "town" room, 10Hz snapshots, speed-cap + collision
  validation vs town.tmj, join/leave broadcasts, dev token `?token=dev:<id>`,
  malformed-message resilient.
- apps/api: `POST /dev/character` (persists name + appearance, one fresh
  character per player).
- apps/web: character-creation screen (name + 4 LimeZu looks), `systems/net.ts`,
  `RemotePlayer` (interpolated 100ms behind, name labels), self prediction +
  snap reconciliation, zone chat (Enter/Esc, typing gates movement), "N online".
  Farm (P3) preserved — warping to the farm disconnects from town.
- Verified with 3 headless tabs: see each other move smoothly with labels, chat
  round-trips, teleport rejected + corrected, typing doesn't move, garbage
  doesn't crash, disconnect despawns in 1s, farming still works.
  Screenshot: docs/screenshots/town-multiplayer.png

## Done — P5a: Floating island world

- gen-town-map reworked into a bounded floating island (ellipse + hashed
  value-noise, ~50x40) with organic edges crumbling into void; tiles outside are
  empty so the dark space shows through. Composed core: central plaza + terminal,
  two streets radiating to the rim, buildings ringing the plaza, overgrowth
  thickening to the edges. Void-adjacent tiles are invisible collision (can't walk
  off). Deterministic.
- Client: deep-space background + parallax starfield (subtle drift) + soft
  drop-shadow + rocky south-edge underside so the island reads as floating;
  town camera pulled back to an integer diorama zoom; self-reconcile threshold
  raised so prediction never rubber-bands.
- Multiplayer/chat/farm-warp/collision all preserved (3-tab suite green).
  Hero shots: docs/screenshots/town-island-{noon,dusk}.png.

## Done — P6: Land plots — claim, develop, upgrade, own

- The island is divided into a fixed ring of **12 claimable 6×6 plots** (content
  `PLOTS`, marked in the town `objects` layer; the map generator lays a foundation
  pad + clears decoration under each). The decorative houses were removed — the
  plots ARE the buildings now.
- Schema: `plots` (plot_index, owner_id nullable, tier, claimed_at, x/y/w/h;
  one-plot-per-owner partial-unique index + tier CHECK) and `world_nodes` (shared
  gather respawn). Migration `0001_sticky_lake` committed.
- Server-authoritative + dupe-proof DB helpers: `claimPlot` (row-locked, one per
  owner, Shards fee via `moveShards` — ledgered) and `upgradePlot` (locks, computes
  next tier, consumes wood/stone via `moveItems` + Shards via `moveShards`, atomic).
  Tests incl. a 5-way concurrent claim race → exactly one winner.
- Tier ladder in `packages/content` (empty → shack → cottage → house → manor →
  mansion), escalating wood/stone/shards. Synthesized 6-frame building spritesheet
  (stake → mansion, the mansion bearing the town's scarce cold glow) + 4-frame
  gather sheet (tree/stump/rock/rubble).
- Earn loop: choppable trees (→wood) + mineable rocks (→stone) on the island,
  same energy/range/server-validation pattern as farming; respawn on the game-day.
- API `/world/state` + `/world/act` (claim/upgrade/chop/mine); client
  `TownController` (renders plots, per-tier buildings, owner nameplates, gather
  nodes; Space + the HUD `PlotPanel` drive validated actions; polls so everyone
  sees upgrades). `content` made browser-safe (JSON import, no `node:fs`).
- Verified: claim spends Shards + shows a nameplate; can't claim a 2nd or someone
  else's; chop/mine fill wood/stone; the full tier ladder to mansion consumes
  materials + Shards (ledgered) and the sprite grows; a second client sees the
  mansion and it **persists after the owner disconnects**; multiplayer/chat/farm
  preserved. Screenshots: docs/screenshots/p6-plot*.png. typecheck/test/lint green.

## Done — P7: Free-form plot building (place structures, build a skyline)

- **Supersedes P6's per-plot tier ladder.** A claimed plot is now a CANVAS: the
  owner places multiple structures freely, and the hut→skyscraper chain applies
  PER-STRUCTURE. Removed `upgradePlot`, the `PLOT_TIERS` ladder, and `plots.tier`.
- Schema (migration `0002_gray_micromacro`): extend `structures` for plots —
  `plot_id` FK, denormalized `w`/`h` footprint, `farm_id` made nullable,
  `structures_owner_xor` CHECK (farm XOR plot), `structures_by_plot` index; reuse
  `level` as the per-structure tier. Drop `plots.tier`.
- Content `structures.ts`: vertical chain **hut → cabin → house → tower →
  high-rise → skyscraper** (shared 2×2 footprint — only the sprite grows taller) +
  standalone **wall / gate / lamp / data-node**; cost/nextTier/footprint/frame per
  def; `nextStructure`, `structureRefund`, `PLACEABLE_STRUCTURES`.
- DB helpers (server-authoritative, ledgered): `placeStructure` (locks the owner's
  plot, validates bounds + non-overlap, consumes wood/stone + Shards),
  `upgradeStructure` (in place, optimistic-concurrency on `def_id`),
  `removeStructure` (50% refund). 11 helper tests.
- Wire: WorldState carries `structures`; WorldAction is a discriminated union
  (claim | chop | mine | place | upgrade | remove).
- Client: synthesized 10-frame `structures.png` (hut..skyscraper with a green
  beacon crown + wall/gate/lamp/cyan data-node) + a `plot_stake` marker;
  `TownController` renders free-form structures (y-sorted), runs **build mode** (a
  ghost preview, green/red, click your plot to place; Esc/Done to exit), and
  click-to-select for upgrade/remove; `PlotPanel` is the build HUD (palette +
  cost, claim, inspect/upgrade/remove).
- Verified (curl + two headless browsers): place hut (persists, materials+Shards
  consumed) → upgrade hut→skyscraper (sprite grows) → remove (exact 50% refund);
  rejects off-plot/out-of-bounds, overlap, non-placeable def, no-plot, and
  insufficient-materials; **y-sort correct** (south skyscraper depth 496 > north
  hut 448); a fresh client sees the skyline and it **persists after the owner
  disconnects**; multiplayer/chat/island/farming preserved. Screenshots:
  docs/screenshots/p7-*.png. typecheck/test (54)/lint green.

## Done — P8: Quests (new-player onboarding + earn loop)

- Event-sourced, server-authoritative quest engine. Actions emit a typed
  `QuestEvent`; active quests advance IN the action's transaction (no polling
  race); rewards (Shards + items) are granted via the ledgered moveShards/
  moveItems ONLY on claim.
- Schema (migration `0003`): `quest_progress` (character_id, quest_id, status
  active→complete→claimed, objectives jsonb, `day` for daily resets).
- Content `quests.ts`: onboarding chain **Stake Your Claim → Timber → First
  Foundations → Reach for the Sky → Rising Skyline** (each unlocks the next) +
  repeatable dailies (wood / harvest / build). Pure engine core
  (`objectiveProgress`/`applyEvent`/`questComplete`/`gameDay`); `validate.ts`
  checks every reward/objective item + unlock resolves. 7 content tests.
- DB helpers: `ensureQuests` (auto-assign Q1 + reset stale dailies per game-day),
  `advanceQuests` (match an event against active quests), `claimQuest` (locked +
  status-checked; grants once, unlocks next). 7 helper tests incl. no-double-claim
  + concurrent-claim race.
- Wire: WorldState carries `quests` (per-objective progress views); WorldAction
  gains `claimQuest`. Hooked into world claim/chop/mine/place/upgrade (with a
  "✓ Quest" toast) and farm createCharacter (assign) + harvest (advance).
- Client: a `QuestLog` panel (toggle button / `Q`) with per-objective progress
  bars + Claim buttons, an always-on `QuestTracker`, and a claimable dot on the
  Quests button — styling kept separate from logic for the coming reskin.
- Verified (curl + browser): a new character auto-gets Q1 + dailies; claiming a
  plot completes Q1; claiming the reward grants 50 Shards + 20 wood (ledgered) and
  unlocks Q2; chop advances Q2 + the wood daily live; can't claim an incomplete
  quest, can't double-claim; dailies reset on the game-day; progress persists.
  Screenshots: docs/screenshots/p8-quest-*.png. typecheck/test (68)/lint green.

## Done — P8.5: onboarding + theme cleanup

- **Findable gather nodes.** Added an onboarding cluster of trees + rocks right
  around the plaza/plot ring (nearest tree is 3 tiles from spawn; 12 trees total),
  all validated walkable/off-plot. Gather nodes now render a warm "interactable"
  gold ring (distinct from baked decoration), and while a wood quest (Timber /
  daily) is active the nearest tree gets a brighter ring + a "Wood ↓" ping — so a
  brand-new player following Timber finds wood in seconds.
- **Ages-themed build palette.** Removed "Data Node" (scrapped archaeology
  leftover); the build palette is now Hut / Wall / Gate / Lamp + the
  hut→skyscraper chain. Re-coloured the tower/skyscraper crown lights from
  terminal-green to warm amber and dropped the dead-civ palette refs in the sprite
  generator. structures.png is now 9 frames. No structure-system changes.
- Verified (browser): a fresh character finds + chops a nearby tree; palette shows
  no Data Node; multiplayer/plots/building/quests/farming intact. typecheck/test
  (68)/lint green. Screenshots: docs/screenshots/p8_5-*.png.

## Next session

- [ ] **P9 — land income (tax) + marketplace (buy/sell items)**

  Passive land income / a tax on harvestable resource-nodes other players use, and
  a player marketplace to buy/sell items for Shards (order-book `market_listings`
  is sketched in docs §2). Plot trading + new islands also still pending.
