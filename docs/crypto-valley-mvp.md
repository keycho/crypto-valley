# CRYPTO VALLEY — MVP Technical Design & Architecture
**Version 0.9 (Pre-production) · June 2026**
**Genre:** Cozy multiplayer farming/life sim · **Setting:** Post-collapse digital civilization
**Design law #1:** The game must be fun with every token removed. Crypto is *lore, identity, and ownership* — never power.

---

## 0. Design Pillars & Anti-Pay-to-Win Constitution

| Pillar | Implementation consequence |
|---|---|
| **Cozy first** | No PvP combat in MVP. Death = pass out, lose nothing but time. Energy system is forgiving (no hard lockouts). |
| **Fun without tokens** | All progression (tools, buildings, regions, cosmetics) earnable purely in-game. NFTs mirror in-game items, never gate them. |
| **Server-authoritative** | All economy, inventory, crop, and quest state lives on the server. Client is a renderer + input device. Non-negotiable for a trading economy. |
| **Lazy simulation** | Crops, machines, and timers are computed from timestamps on read, not ticked per-entity. This is what makes 100k farms cheap. |
| **Social gravity** | Town square, world events, and the marketplace are shared spaces; farms are instanced but visitable. |

**Hard rules (enforced in code review, not just policy):**
1. No item, crop, region, or stat is purchasable with fiat/crypto if it affects yield, speed, or access.
2. Wallet connection is optional. Email/guest accounts get 100% of gameplay.
3. NFT mint = *export* of an item you already earned (cosmetics, land deed, relics). Burn-to-import brings it back. The chain is a bragging-rights mirror, not a source of truth for gameplay.
4. No primary token. If a token ever exists, it touches cosmetics and governance only — out of MVP scope entirely.

---

## 1. Full Technical Architecture

### 1.1 System diagram

```
                ┌─────────────────────────────────────────────────┐
                │                   CLIENT (Browser)               │
                │  Next.js 14 (app router)                         │
                │  ├─ /         marketing + login (SSR)            │
                │  ├─ /play     Phaser 3 canvas (CSR, dynamic())   │
                │  ├─ React HUD overlay (Zustand state)            │
                │  └─ @solana/wallet-adapter (lazy-loaded)         │
                └───────┬─────────────────────────┬───────────────┘
                  HTTPS │ REST (auth, market,     │ WSS (realtime:
                        │ inventory, quests)      │ movement, chat,
                        ▼                         ▼ world state)
       ┌────────────────────────┐    ┌─────────────────────────────┐
       │   API SERVER (Node)    │    │   GAME SERVER (Node)         │
       │   Fastify + Zod        │    │   uWebSockets.js             │
       │   - Auth (SIWS + email)│    │   - Zone processes (forked)  │
       │   - Market/auction     │◄──►│   - 10 Hz sim tick           │
       │   - Inventory ops      │ Redis - 20 Hz snapshot broadcast │
       │   - Quest engine       │ pub/  - Interest management      │
       │   - Crafting           │ sub  - Chat relay                 │
       └──────┬─────────────────┘    └──────────┬──────────────────┘
              │                                  │
              ▼                                  ▼
       ┌─────────────────────────────────────────────────┐
       │  PostgreSQL 16 (primary + read replica)          │
       │  - All persistent state (source of truth)        │
       │  - LISTEN/NOTIFY for market events               │
       ├─────────────────────────────────────────────────┤
       │  Redis 7                                         │
       │  - Session cache, presence, zone pub/sub         │
       │  - Rate limits, market orderbook hot cache       │
       ├─────────────────────────────────────────────────┤
       │  Object storage + CDN (assets, tilemaps, atlases)│
       └─────────────────────────────────────────────────┘
              │
              ▼ (async, queue-based — never in request path)
       ┌─────────────────────────────────────────────────┐
       │  CHAIN WORKER (Node, BullMQ queue)               │
       │  - SIWS verification                             │
       │  - cNFT mint/burn (Metaplex Bubblegum)           │
       │  - Helius webhooks → ownership sync              │
       └─────────────────────────────────────────────────┘
```

### 1.2 Why this shape

- **Two server roles, one codebase.** REST handles transactional, low-frequency ops (buy, craft, accept quest) where you want HTTP semantics, idempotency keys, and easy caching. WebSockets handle high-frequency ephemeral state (positions, emotes, chat). Both import the same `packages/sim` and `packages/db` workspaces.
- **Zone processes.** Each map zone (Farm instances pool, Town, Forest, Mountain, Ruins, Marketplace) runs as a logical "room" inside a zone worker. Rooms are assignable to any game-server process via Redis-backed routing, so horizontal scaling = add processes.
- **Chain is async-only.** No gameplay request ever awaits an RPC call to Solana. Mints/burns are queued jobs with status rows the client polls. A Solana outage degrades to "export temporarily unavailable" — the game keeps running.
- **Lazy crop simulation.** A planted crop is a row: `(planted_at, crop_type, watered_until, fertilizer)`. Growth stage is a pure function of `now()` — computed when the tile is rendered or harvested. Zero background work per crop. Machines (kegs, smelters) work identically: `finishes_at` timestamp.

### 1.3 Stack versions

| Layer | Choice | Notes |
|---|---|---|
| Frontend framework | Next.js 14+, TypeScript strict | Phaser mounted in a client-only component via `next/dynamic({ ssr: false })` |
| Game engine | Phaser 3.80 | Arcade physics only; tilemaps from Tiled (.tmj) |
| HUD/UI | React + Zustand + Tailwind | Phaser ↔ React via a typed event bus (`mitt`) |
| API | Fastify 4 + Zod schemas | OpenAPI generated from Zod |
| Realtime | uWebSockets.js | ~10x throughput of `ws`; msgpack-encoded frames |
| ORM | Drizzle | SQL-first, migrations checked into repo |
| Queue | BullMQ (Redis) | Chain ops, mail delivery, event scheduling |
| Solana | @solana/web3.js, @solana/wallet-adapter, Metaplex Umi + Bubblegum (cNFTs), Helius (RPC + webhooks) | Devnet for MVP |
| Auth | SIWS (signed message) or email magic link → httpOnly session cookie + short-lived WS token | |
| Infra (MVP) | Railway (api, game, worker) + Neon/Supabase Postgres + Upstash Redis + Cloudflare CDN | Matches your existing deployment habits |

### 1.4 Time & calendar system (server-global)

- **1 game day = 20 real minutes.** Day phases: dawn (2m) → day (10m) → dusk (2m) → night (6m). Client renders the cycle from a single synced `world_epoch` timestamp — no per-tick time messages.
- **1 season = 7 real days** (504 game days/year feel is wrong, so: **1 season = 28 game days = ~9.3 real hours of active play**, calendar shown in-game).
- Season order: **Accumulation → Bull Market → Alt Season → Bear Market**, looping. Season index = `floor((now - world_epoch) / SEASON_MS) % 4`. Deterministic everywhere — client, API, and game server all derive it identically.
- Weather rolls per game-day per zone from a seeded RNG (`seed = hash(world_epoch_day, zone_id)`) so all servers agree without coordination.

---

## 2. Database Schema (PostgreSQL 16)

Full DDL. Conventions: `uuid` PKs (v7 for index locality), `created_at/updated_at` everywhere (omitted below for brevity except where load-bearing), soft quantities as `bigint`, money as `bigint` (smallest unit of soft currency "Bits" ⓑ).

```sql
-- ============ IDENTITY ============
CREATE TABLE accounts (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  email           citext UNIQUE,                  -- nullable: wallet-only accounts
  status          text NOT NULL DEFAULT 'active', -- active | banned | deleted
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wallets (                            -- 0..n wallets per account
  address         text PRIMARY KEY,               -- base58 Solana pubkey
  account_id      uuid NOT NULL REFERENCES accounts(id),
  verified_at     timestamptz NOT NULL,           -- SIWS signature time
  is_primary      boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX wallets_one_primary ON wallets(account_id) WHERE is_primary;

CREATE TABLE characters (                         -- 1 per account in MVP
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  account_id      uuid NOT NULL UNIQUE REFERENCES accounts(id),
  name            text NOT NULL UNIQUE CHECK (length(name) BETWEEN 3 AND 16),
  appearance      jsonb NOT NULL,                 -- sprite layers: body, hair, outfit ids
  bits            bigint NOT NULL DEFAULT 500 CHECK (bits >= 0),
  energy          int NOT NULL DEFAULT 100,
  energy_updated  timestamptz NOT NULL DEFAULT now(), -- energy regen computed lazily
  pos_zone        text NOT NULL DEFAULT 'farm',
  pos_x           int NOT NULL DEFAULT 25, pos_y int NOT NULL DEFAULT 25,
  skills          jsonb NOT NULL DEFAULT '{"farming":0,"mining":0,"foraging":0,"crafting":0,"archaeology":0}',
  tutorial_step   int NOT NULL DEFAULT 0,
  last_seen_at    timestamptz
);

-- ============ ITEMS & INVENTORY ============
CREATE TABLE item_defs (                          -- static catalog, seeded from JSON
  id              text PRIMARY KEY,               -- 'wood', 'iron_hoe', 'seed_bitberry'
  category        text NOT NULL,                  -- resource|seed|crop|tool|machine|decoration|relic|consumable
  stack_max       int NOT NULL DEFAULT 999,
  base_value      bigint NOT NULL DEFAULT 0,      -- NPC vendor reference price
  tradeable       boolean NOT NULL DEFAULT true,
  mintable        boolean NOT NULL DEFAULT false, -- can be exported as cNFT
  meta            jsonb NOT NULL DEFAULT '{}'     -- tool tier, energy restore, etc.
);

CREATE TABLE inventory_slots (
  character_id    uuid NOT NULL REFERENCES characters(id),
  container       text NOT NULL DEFAULT 'backpack', -- backpack|storage:<structure_id>
  slot            int  NOT NULL,
  item_id         text NOT NULL REFERENCES item_defs(id),
  qty             int  NOT NULL CHECK (qty > 0),
  instance_meta   jsonb,                          -- durability, relic provenance, etc.
  PRIMARY KEY (character_id, container, slot)
);
CREATE INDEX inv_by_item ON inventory_slots(character_id, item_id);

-- ============ LAND, TILES, STRUCTURES ============
CREATE TABLE farms (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_id        uuid NOT NULL UNIQUE REFERENCES characters(id),
  name            text NOT NULL DEFAULT 'Abandoned Plot',
  layout_rev      int NOT NULL DEFAULT 0,         -- bump to invalidate client cache
  deed_asset_id   text                            -- cNFT asset id if deed exported
);

CREATE TABLE farm_tiles (                         -- only NON-DEFAULT tiles stored
  farm_id         uuid NOT NULL REFERENCES farms(id),
  x int NOT NULL, y int NOT NULL,
  state           text NOT NULL,                  -- tilled|watered|path|debris_rock|debris_tree
  watered_until   timestamptz,
  PRIMARY KEY (farm_id, x, y)
);

CREATE TABLE crops (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  farm_id         uuid NOT NULL REFERENCES farms(id),
  x int NOT NULL, y int NOT NULL,
  crop_id         text NOT NULL REFERENCES item_defs(id),
  planted_at      timestamptz NOT NULL DEFAULT now(),
  watered_until   timestamptz,                    -- growth pauses while dry
  growth_credit_ms bigint NOT NULL DEFAULT 0,     -- accumulated watered time
  fertilizer      text,
  season_planted  int NOT NULL,                   -- dies if out-of-season at harvest check
  UNIQUE (farm_id, x, y)
);

CREATE TABLE structures (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  farm_id         uuid NOT NULL REFERENCES farms(id),
  def_id          text NOT NULL,                  -- house|barn|workshop|solar_generator|oracle_tower|deco_*
  x int NOT NULL, y int NOT NULL, rotation int NOT NULL DEFAULT 0,
  level           int NOT NULL DEFAULT 1,
  state           jsonb NOT NULL DEFAULT '{}'     -- e.g. generator charge, tower scan cooldown
);

CREATE TABLE machine_jobs (                       -- lazy crafting/processing
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  structure_id    uuid NOT NULL REFERENCES structures(id),
  recipe_id       text NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finishes_at     timestamptz NOT NULL,
  collected       boolean NOT NULL DEFAULT false
);
CREATE INDEX jobs_ready ON machine_jobs(structure_id) WHERE NOT collected;

-- ============ NPCs, DIALOGUE, QUESTS ============
CREATE TABLE npc_relationships (
  character_id    uuid NOT NULL REFERENCES characters(id),
  npc_id          text NOT NULL,                  -- 'builder_ben', 'oracle_olivia', ...
  points          int NOT NULL DEFAULT 0,         -- 250 pts per heart, 10 hearts
  talked_today_on date,                           -- daily-talk point gating
  gifts_this_week int NOT NULL DEFAULT 0,
  flags           jsonb NOT NULL DEFAULT '{}',    -- dialogue tree memory
  PRIMARY KEY (character_id, npc_id)
);

CREATE TABLE quest_progress (
  character_id    uuid NOT NULL REFERENCES characters(id),
  quest_id        text NOT NULL,                  -- static defs in packages/content
  status          text NOT NULL DEFAULT 'active', -- active|complete|claimed
  objectives      jsonb NOT NULL DEFAULT '{}',    -- {"gather_wood": 32, "talk_ben": true}
  accepted_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, quest_id)
);

-- ============ ECONOMY ============
CREATE TABLE market_listings (                    -- order-book style, RuneScape GE-lite
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  seller_id       uuid NOT NULL REFERENCES characters(id),
  item_id         text NOT NULL REFERENCES item_defs(id),
  qty             int NOT NULL CHECK (qty > 0),
  qty_remaining   int NOT NULL,
  price_each      bigint NOT NULL CHECK (price_each > 0),
  status          text NOT NULL DEFAULT 'open',   -- open|filled|cancelled|expired
  expires_at      timestamptz NOT NULL
);
CREATE INDEX listings_book ON market_listings(item_id, price_each) WHERE status = 'open';

CREATE TABLE auctions (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  seller_id       uuid NOT NULL REFERENCES characters(id),
  item_id         text NOT NULL,
  qty             int NOT NULL,
  instance_meta   jsonb,                          -- relics auction with provenance
  min_bid         bigint NOT NULL,
  buyout          bigint,
  ends_at         timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'live'    -- live|settled|cancelled
);

CREATE TABLE auction_bids (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  auction_id      uuid NOT NULL REFERENCES auctions(id),
  bidder_id       uuid NOT NULL REFERENCES characters(id),
  amount          bigint NOT NULL,                -- escrowed from bits on insert
  outbid          boolean NOT NULL DEFAULT false
);

CREATE TABLE trades (                             -- direct P2P trade window
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  a_id uuid NOT NULL, b_id uuid NOT NULL,
  a_offer jsonb NOT NULL DEFAULT '[]', b_offer jsonb NOT NULL DEFAULT '[]',
  a_locked boolean DEFAULT false, b_locked boolean DEFAULT false,
  status text NOT NULL DEFAULT 'open'             -- open|completed|cancelled
);

CREATE TABLE ledger (                             -- append-only economy audit trail
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  character_id    uuid NOT NULL,
  delta_bits      bigint NOT NULL,
  reason          text NOT NULL,                  -- 'market_sale', 'quest_reward', ...
  ref             uuid,
  at              timestamptz NOT NULL DEFAULT now()
);

-- ============ SOCIAL & WORLD ============
CREATE TABLE friendships (
  a uuid NOT NULL, b uuid NOT NULL,               -- a < b enforced in app layer
  status text NOT NULL DEFAULT 'pending',
  PRIMARY KEY (a, b)
);

CREATE TABLE world_events (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  type            text NOT NULL,                  -- meteor|oracle_malfunction|ai_awakening|market_festival
  zone            text NOT NULL,
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'     -- spawn tables, coordinates
);

CREATE TABLE discoveries (                        -- archaeology / hidden areas
  character_id    uuid NOT NULL REFERENCES characters(id),
  discovery_id    text NOT NULL,                  -- 'secret_cave', 'buried_server_room', 'validator_temple', relic ids
  found_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, discovery_id)
);

-- ============ CHAIN MIRROR ============
CREATE TABLE nft_exports (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  character_id    uuid NOT NULL REFERENCES characters(id),
  item_id         text NOT NULL,
  instance_meta   jsonb,
  direction       text NOT NULL,                  -- export (mint) | import (burn)
  status          text NOT NULL DEFAULT 'queued', -- queued|submitted|confirmed|failed
  asset_id        text,                           -- Bubblegum asset id
  tx_sig          text,
  error           text
);
```

**Key invariants enforced in transactions, not triggers:**
- Every bits mutation writes a `ledger` row in the same transaction (single helper `moveBits(tx, ...)`).
- Inventory mutations go through one `moveItems(tx, ops[])` helper that locks rows `FOR UPDATE` ordered by PK to prevent deadlocks and dupes.
- Market fills: `UPDATE ... WHERE qty_remaining >= $n RETURNING` — optimistic, no read-then-write races.

---

## 3. Multiplayer Architecture

### 3.1 Topology

- **Zones are rooms.** Static zones (Town, Forest, Mountain, Ruins, Marketplace) are singleton rooms in MVP, sharded by instance later. Farms are **on-demand rooms**: spun up when the owner or a visitor enters, hibernated (state flushed to PG) after 60s empty.
- **Gateway-less MVP:** the client connects directly to the game server with `?token=<short-lived WS JWT>` minted by the API. At scale, a thin gateway routes connections to the process owning the target room (room→process mapping in Redis).
- **Tick model:**
  - **Input rate:** client sends movement intents at most 15/s (coalesced).
  - **Sim tick: 10 Hz** — validates movement against collision grid, advances event logic.
  - **Broadcast: 10 Hz snapshots** of dirty entities only, msgpack-encoded, interest-filtered to a 32-tile radius (only matters in Town/events; farms have ≤8 players).
  - Client interpolates remote players 100ms in the past; local player uses prediction + reconciliation (positions are tile-grid, so corrections are cheap snaps).
- **Movement validation is cheap-authoritative:** server checks speed cap and collision per intent; it does not re-simulate physics. Cozy game — anti-cheat budget goes to the economy, not movement.

### 3.2 Protocol (`packages/shared/protocol.ts`)

```ts
// Client → Server
type C2S =
  | { t: 'move';   seq: number; dir: 0|1|2|3|4; x: number; y: number } // 4=stop
  | { t: 'act';    seq: number; action: 'hoe'|'water'|'plant'|'harvest'|'chop'|'mine'|'forage'|'dig'; x: number; y: number; itemId?: string }
  | { t: 'place';  defId: string; x: number; y: number; rot: number }
  | { t: 'chat';   channel: 'local'|'zone'|'whisper'; to?: string; msg: string }
  | { t: 'emote';  id: string }
  | { t: 'warp';   zone: string }                  // door/exit trigger
  | { t: 'npc';    npcId: string; choiceId?: string };

// Server → Client
type S2C =
  | { t: 'hello';  charId: string; zone: ZoneSnapshot; worldEpoch: number; season: 0|1|2|3 }
  | { t: 'snap';   tick: number; ents: EntityDelta[] }          // 10 Hz, dirty-only
  | { t: 'ack';    seq: number; ok: boolean; err?: string }     // action results
  | { t: 'tile';   zone: string; x: number; y: number; patch: TilePatch } // crop stage, tilled, etc.
  | { t: 'inv';    patch: InvPatch[] }                          // server-pushed inventory truth
  | { t: 'chat';   from: string; channel: string; msg: string }
  | { t: 'dlg';    npcId: string; node: DialogueNode }          // current dialogue node + choices
  | { t: 'event';  ev: WorldEventState }                        // meteor down at (x,y)!
  | { t: 'toast';  kind: 'quest'|'levelup'|'discovery'|'relic'; data: unknown };
```

Every state-mutating action returns an `ack` keyed by client `seq`; the client applies optimistic UI and rolls back on `ok:false`. **Inventory and bits are never mutated optimistically** — the HUD waits for the `inv` patch (sub-100ms feels instant; dupes feel like a crisis).

### 3.3 Action pipeline (server)

```
ws message → zod parse → rate limiter (per-type budgets)
  → energy check (lazy regen: energy = min(100, stored + elapsed/regen_rate))
  → range check (player within 1.5 tiles of target)
  → zone rules (can't hoe in Town) → sim handler (pure fn from packages/sim)
  → PG transaction (inventory + tile + ledger + quest progress hooks)
  → broadcast tile patch to room + inv patch to actor
```

Quest progress is event-sourced off the same pipeline: every successful action emits a typed domain event (`item_gathered`, `crop_harvested`, `npc_talked`, `structure_built`), and the quest engine pattern-matches active quest objectives against it inside the same transaction.

### 3.4 Cross-cutting realtime

- **Chat:** zone-local via room broadcast; whispers and friend presence via Redis pub/sub channel per character.
- **World events:** a BullMQ repeatable scheduler picks events from a weighted table per season, inserts `world_events`, and publishes to all zone processes; zones translate to spawns/visuals.
- **Market:** REST for placing/filling; PG `NOTIFY market_fill` → API → WS push so your "sold!" toast arrives while you're fishing in the Forest.

---

## 4. Monorepo Folder Structure (pnpm workspaces + turborepo)

```
crypto-valley/
├─ apps/
│  ├─ web/                        # Next.js 14
│  │  ├─ app/(marketing)/page.tsx
│  │  ├─ app/play/page.tsx        # mounts <Game/> dynamic, ssr:false
│  │  ├─ game/                    # all Phaser code lives here, NOT in app/
│  │  │  ├─ main.ts               # Phaser.Game config
│  │  │  ├─ scenes/ Boot.ts Preload.ts World.ts UIBridge.ts
│  │  │  ├─ systems/ net.ts input.ts prediction.ts daynight.ts weather.ts
│  │  │  ├─ entities/ Player.ts RemotePlayer.ts Npc.ts CropLayer.ts StructureLayer.ts
│  │  │  └─ fx/ lighting.ts particles.ts transitions.ts
│  │  ├─ hud/                     # React overlay
│  │  │  ├─ Hotbar.tsx Inventory.tsx Dialogue.tsx QuestLog.tsx
│  │  │  ├─ Market.tsx Auction.tsx TradeWindow.tsx Map.tsx
│  │  │  ├─ Clock.tsx EnergyBar.tsx Chat.tsx Settings.tsx
│  │  │  └─ wallet/ ConnectButton.tsx ExportModal.tsx
│  │  └─ stores/ player.ts inventory.ts quests.ts ui.ts
│  ├─ api/                        # Fastify
│  │  ├─ src/routes/ auth.ts market.ts auctions.ts inventory.ts
│  │  │   crafting.ts quests.ts farm.ts social.ts chain.ts
│  │  ├─ src/services/           # business logic, imports packages/sim
│  │  └─ src/plugins/ session.ts ratelimit.ts idempotency.ts
│  ├─ game-server/               # uWebSockets.js
│  │  ├─ src/rooms/ Room.ts FarmRoom.ts TownRoom.ts WildRoom.ts
│  │  ├─ src/actions/            # one file per C2S action type
│  │  ├─ src/snapshot.ts interest.ts ticker.ts
│  │  └─ src/index.ts            # process bootstrap, Redis room registry
│  └─ chain-worker/              # BullMQ consumers
│     ├─ src/jobs/ mintExport.ts burnImport.ts syncOwnership.ts
│     └─ src/helius/ webhooks.ts
├─ packages/
│  ├─ shared/                    # protocol.ts, zod schemas, constants, time.ts (season math)
│  ├─ sim/                       # PURE deterministic gameplay logic (no IO)
│  │  ├─ crops.ts energy.ts crafting.ts skills.ts movement.ts
│  │  └─ __tests__/              # the most-tested package in the repo
│  ├─ db/                        # drizzle schema, migrations, query helpers (moveBits, moveItems)
│  ├─ content/                   # GAME DATA AS CODE — items.json crops.json recipes.json
│  │  ├─ npcs/ builder_ben.json oracle_olivia.json ... (dialogue trees + quests)
│  │  ├─ quests/ maps/ events/ seasons.json
│  │  └─ validate.ts             # CI gate: every itemId referenced anywhere must exist
│  └─ config/                    # eslint, tsconfig bases
├─ assets-src/                   # Tiled .tmx, Aseprite files → CI exports to CDN
└─ turbo.json pnpm-workspace.yaml
```

The split that matters: **`packages/sim` is pure functions** (state in → state out). The API, the game server, and the client *all* import it — the client uses it for optimistic previews (crop stage rendering, energy bar), the servers use it as truth. One growth formula, three consumers, zero drift.

---

## 5. Core Gameplay Systems

### 5.1 The loop, tuned

A full game day (20 min) of an engaged player: wake → water/harvest (3–4 min) → choose a venture (Forest forage run, Mountain mining, Ruins dig, or Town social/quests; 8–10 min) → craft/queue machines (2 min) → market check (2 min) → free play. Energy (100, regen 1/36s, sleep = full) softly budgets ~120 actions/day so sessions end on a "one more day" cliffhanger, not a wall.

### 5.2 Farming

```ts
// packages/sim/crops.ts — the one true growth function
export function cropStage(c: CropRow, now: number, season: Season): CropView {
  const def = CROPS[c.crop_id];
  // growth only accrues while watered; watering covers a full game day
  const credit = c.growth_credit_ms + overlap(c.watered_until, c.last_credit_at, now);
  const stage = Math.min(def.stages, Math.floor(credit / def.msPerStage));
  const dead = !def.seasons.includes(season) && stage < def.stages;
  return { stage, ready: stage === def.stages, dead, regrows: def.regrow ?? null };
}
```

**Crop tables by season** (12 crops at MVP, 3 per season + 2 all-season):

| Season | Crops | Fantasy |
|---|---|---|
| **Accumulation** | Bitberry (4d, regrow), Cold Storage Squash (6d), Seed Phrase Sprouts (3d) | quiet, foggy, planning |
| **Bull Market** | Pump-kin (5d, huge sell value), Green Candle Corn (4d, regrow), Moonflower (7d, night-blooms) | golden light, fast tempo |
| **Alt Season** | Forkfruit (splits into random variants), Memelon (RNG quality 1–100x meme), Gemroot (rare gem chance) | chaotic, colorful, gambling-adjacent but seeds are cheap |
| **Bear Market** | Hodl Root (12d, survives into next season), Stable Beans (low value, never fails), Wintermint | snow, scarcity, foraging matters more |
| All-season | Datagrass (craft input), Glowcap mushrooms (night only) | |

Bear Market is deliberately the *social* season: crop income drops, so the design pushes players toward mining, ruins archaeology, NPC quests, and the marketplace — scarcity creates trade.

### 5.3 Resources & gathering

| Resource | Source | Tool gate |
|---|---|---|
| Wood | Trees (Farm debris, Forest) | Axe T1–T3 |
| Stone | Rocks (Farm, Mountain) | Pickaxe T1–T3 |
| Metal (Copper/Iron/Chromium) | Mountain ore nodes, depth-tiered | Pickaxe T2+ |
| Data Fragments | Ruins dig sites, Glowcap composting, dead crops | Shovel / Scanner |
| Energy Cells | Solar Generator output, meteor events, deep ruins | — |

Nodes respawn on zone-day boundaries from seeded RNG (same trick as weather) — no respawn timers to persist.

### 5.4 Crafting & machines

- **Hand-craft** (instant, at Workshop bench): tools, fences, paths, decorations, storage chests.
- **Machine jobs** (timed, lazy `finishes_at`): Smelter (ore→bars, 30m), Compiler (Data Fragments→Software components, 1h), Fermenter (crops→goods, 2–6h), Solar Generator (passive Energy Cells, cap 6/day), **Oracle Tower** (consumes Energy Cells to "scan": reveals one dig-site hint or tomorrow's market demand spike — *information*, the most crypto resource of all).
- Recipes in `packages/content/recipes.json`: `{ id, station, inputs: [{item, qty}], output, ms, skillReq }`. ~40 recipes at MVP.

### 5.5 Skills (RuneScape DNA)

Five skills — Farming, Mining, Foraging, Crafting, Archaeology — XP per action, levels 1–50 at MVP. Levels gate recipes and node tiers, give small speed/yield bumps (≤25% total), and unlock zone shortcuts (Mining 15 opens the Mountain tunnel to Ruins). Visible level-up toasts + zone-chat shoutouts at milestones (the RuneScape dopamine, cozy-fied).

### 5.6 NPC system — the cast of 10

Relationship: 2,500 points = 10 hearts. Points from daily talks (+20), gifts (loved +80 / liked +45 / disliked −20, 2/week), quests (+150–400). Heart gates unlock dialogue branches, recipes, and personal quests.

| NPC | Role / Location | Personality hook | Signature quest line |
|---|---|---|---|
| **Builder Ben** | Carpenter, Town | Cheerful, overbuilds everything | Upgrades your house; finale: rebuild the Town bridge to Mountain |
| **Oracle Olivia** | Oracle Tower keeper, Town edge | Speaks in probabilities, secretly lonely | Teaches Oracle Tower crafting; arc about the malfunctioning Great Oracle |
| **Agent Alice** | Wandering ex-AI agent | Glitches mid-sentence, fragmented memory | Recover her 7 memory shards from the Ruins → she "reboots" (major story beat) |
| **Rugged Ron** | Pawn shop, Marketplace | Paranoid, burned in the Collapse, heart of gold | Teaches scam-spotting (gameplay: appraise fake relics); redemption arc |
| **Professor Hash** | Archaeologist, Ruins camp | Academic, hopeless at practical life | Archaeology skill mentor; relic codex; opens the Validator Temple |
| **Mina Mint** | General store, Town | Brisk, numbers brain, festival organizer | Runs Market Festival; unlock auction house access early via her quests |
| **Sol the Lightkeeper** | Solar farm, Mountain foothills | Serene, solar-punk monk | Energy Cell economy tutor; meteor event first responder |
| **Deva the Validator** | Ancient sentinel NPC, Ruins | Formal, 10,000 years of logs, dry wit | Lore exposition; stamps "validated" on your relic discoveries |
| **Pip** | Kid courier, everywhere | Fast, nosy, knows every shortcut | Delivery questline that teaches the map; reveals the Secret Cave |
| **Granny Genesis** | Oldest resident, Town | Remembers "before the Collapse", baker | Cooking recipes; the questline that quietly explains the entire lore |

**Dialogue tree format** (`packages/content/npcs/*.json`):

```jsonc
{
  "npc": "rugged_ron",
  "nodes": {
    "root": { "match": [
      { "if": "quest:fake_relic.active", "goto": "fake_relic_check" },
      { "if": "hearts>=6", "goto": "warm_root" },
      { "goto": "cold_root" } ] },
    "cold_root": {
      "say": ["Hmph. Touch nothing.", "You here to gawk or trade?"],
      "choices": [
        { "label": "Just saying hi.", "fx": "+points:20/day", "goto": "end" },
        { "label": "What happened to your arm?", "req": "hearts>=2", "goto": "collapse_story_1" },
        { "label": "[Gift]", "goto": "@gift" } ] }
  }
}
```

The server walks this tree; the client only renders `dlg` nodes. Conditions (`quest:`, `hearts>=`, `season:`, `flag:`) are evaluated against `npc_relationships.flags` + quest state — NPCs *remember*.

### 5.7 Quests

Three tiers: **Story** (hand-authored, ~20 at MVP, gated by hearts/skills/season), **Daily board** (generated from templates: gather/deliver/craft, posted at Town board), **Discovery** (triggered by finding hidden things). Objective types the engine supports: `gather`, `deliver`, `craft`, `talk`, `reach_zone`, `harvest`, `place_structure`, `discover`, `attend_event`.

### 5.8 Seasons → systemic deltas (`packages/content/seasons.json`)

```jsonc
{ "bear_market": {
    "cropTable": ["hodl_root","stable_beans","wintermint","datagrass"],
    "spawnMods": { "ore": 1.3, "forage": 0.7, "data_fragments": 1.2 },
    "weatherTable": { "snow": 0.4, "fog": 0.3, "clear": 0.3 },
    "events": ["meteor:0.15/day", "ai_awakening:0.05/day"],
    "cosmetics": { "townBanners": "bear", "music": "bear_suite", "palette": "cool_shift" } } }
```

### 5.9 Exploration & discoveries

- **Secret Cave** (Forest): waterfall tile is walk-through-able; Pip hints at hearts 4. Glowcap farm + a lost wallet relic.
- **Buried Server Room** (Mountain): revealed by mining the cracked wall (Mining 20) *or* by a meteor strike landing nearby (event-driven world change). Contains the Compiler recipe and Agent Alice shard #4.
- **Ancient Validator Temple** (deep Ruins): opens only when a player presents 3 validated relics to Deva. Inside: the MVP's "endgame" — a puzzle floor that awards the **Genesis Block** decoration (mintable, purely cosmetic, the flex item).
- **Dig sites**: 6 spawn per game-day across zones (seeded RNG); Shovel + Archaeology skill → relic table roll. Relics carry `instance_meta` provenance: `{ foundBy, foundAt, site }` — provenance makes auctions interesting.

### 5.10 World events (BullMQ scheduled, weighted by season)

| Event | Duration | What happens |
|---|---|---|
| **Meteor crash** | 30 min | Impact site in Mountain/Forest; Energy Cells + Chromium ore; co-op mining (shared node HP) |
| **Oracle malfunction** | 1 game-day | Olivia's tower spews scrambled hints; mini-quest to deliver Data Fragments; fixers get a rare scan |
| **Lost AI awakening** | 45 min | A friendly rogue agent wanders a zone trading absurd offers (3 Pump-kins for a relic?); despawns forever-ish |
| **Market Festival** | Real Saturday, 2h | Town Square stalls, 0% market fees, fishing contest, seasonal cosmetics vendor (bits only) |

---

## 6. Map Design

All zones authored in **Tiled**, 16×16px tiles, exported `.tmj` to CDN. Layers: `ground`, `ground_detail`, `collision`, `above` (y-sorted canopies), `objects` (spawn markers, doors, dig-site anchors), `lights` (point-light markers for night).

| Zone | Size (tiles) | Purpose | Notable |
|---|---|---|---|
| **Starter Farm** | 50×40 (instanced per player) | Home base; debris-clearing is the tutorial | River edge (future fishing), deed stone (NFT export point), house plot |
| **Town Square** | 60×50 | Social hub; NPC homes, quest board, Mina's store, Ben's workshop | Plaza = event stage; clock tower shows season/day |
| **Forest** | 70×60 | Foraging, wood, Glowcaps at night | Waterfall (Secret Cave), Pip's shortcut web |
| **Mountain** | 70×70 | Mining, vertical switchbacks, Sol's solar farm | Cracked wall (Server Room), tunnel to Ruins (Mining 15) |
| **Ancient Digital Ruins** | 80×60 | Archaeology, lore, late-MVP content | Corrupted-pixel aesthetic, Deva's gate, Validator Temple door |
| **Marketplace** | 40×35 | Economy hub: order board, auction house, Ron's pawn shop | Ticker board shows live item prices (real data from PG) |

Connection graph: Farm ↔ Town ↔ {Forest, Marketplace}; Forest ↔ Mountain; Mountain ↔ Ruins (gated); Town ↔ Ruins (long path, opens after Ben's bridge quest).

---

## 7. Solana Integration Plan

### 7.1 Principles
- **Optional, additive, async.** The chain mirrors achievement; gameplay never reads from it synchronously.
- **MVP = devnet.** Mainnet only after economy audit.

### 7.2 Auth: Sign-In With Solana (SIWS)
1. `GET /auth/siws-challenge` → server nonce (stored in Redis, 5 min TTL).
2. Wallet signs the standard SIWS message; `POST /auth/siws` verifies via `tweetnacl`, upserts `wallets` row, sets httpOnly session.
3. Email magic-link path issues the identical session — downstream code never cares which.
4. Linking flow lets an email account attach a wallet later (and vice versa).

### 7.3 Optional NFT ownership — the export/import model
- **What's mintable:** Land Deed (farm name + layout snapshot image), Relics (with provenance metadata), earned cosmetics. `item_defs.mintable` whitelist; **never tools, seeds, resources, or anything with stats.**
- **Export:** player uses the Deed Stone / Ron's shop → item moves `inventory → nft_exports(queued)` in one tx (escrowed, unusable in-game) → chain-worker mints a **compressed NFT** (Metaplex Bubblegum — ~0.0001 SOL each, server-paid, rate-limited 5/week/account) to the player's wallet → status `confirmed`.
- **Import:** player burns the cNFT (worker verifies via Helius webhook + on-demand check) → item re-enters inventory with provenance intact.
- **Failure handling:** every job idempotent via `nft_exports.id` as client-side dedupe key; `failed` status refunds the escrowed item.
- **Trading NFTs happens off-platform** (Tensor etc.) — we deliberately don't build NFT trading; the in-game auction house trades the *in-game* items, keeping the economy server-authoritative.

### 7.4 What we explicitly do NOT do at MVP
No token, no on-chain marketplace, no staking, no play-to-earn emissions, no NFT-gated land. (Notably: this also keeps the legal surface near zero — same posture as keeping earn/burn mechanics out of public copy on your other projects.)

---

## 8. Wireframes (MVP screens)

### 8.1 In-world HUD
```
┌──────────────────────────────────────────────────────────────┐
│ ☀ Bull Market · Day 12 · 14:20   ⛅            ⓑ 12,480      │
│ ┌────────┐                                      ┌──────────┐ │
│ │ MiniMap│                                      │ Quests ▸ │ │
│ └────────┘                                      │ ◦ Ben: 8/│ │
│                                                 │   20 wood│ │
│                 [ Phaser world canvas ]         └──────────┘ │
│                                                              │
│  Energy ▰▰▰▰▰▰▰▱▱▱ 68                                        │
│ ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐  [💬 Chat]  [🎒] [🗺] [⚙]   │
│ │🪓│⛏│🪣│🌱│🌱│  │  │  │  │  │   1–0 hotbar                │
│ └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘                              │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 Inventory + crafting (tabbed panel, ESC/I)
```
┌─ Backpack ─ Craft ─ Skills ─ Relics ────────────── ✕ ─┐
│ ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐   Iron Axe            │
│ │64││12││ 3││  ││  ││  │…  ┌────────────────┐   │
│ └──┘└──┘└──┘└──┘└──┘└──┘   │ 5× Iron Bar  ✔ │   │
│  wood stone bar             │ 2× Wood      ✔ │   │
│ drag-drop · shift-split     │ Crafting Lv 8 ✔│   │
│                             └───[ CRAFT ]────┘   │
└──────────────────────────────────────────────────┘
```

### 8.3 NPC dialogue
```
┌──────────────────────────────────────────────┐
│ ┌────────┐  RUGGED RON          ♥♥♥♡♡♡♡♡♡♡  │
│ │portrait│  "Hmph. Touch nothing."           │
│ └────────┘                                   │
│  ▸ Just saying hi.                           │
│  ▸ What happened to your arm?     [2♥ req]   │
│  ▸ Give a gift…                              │
└──────────────────────────────────────────────┘
```

### 8.4 Marketplace (order board)
```
┌─ MARKET ── Buy ─ Sell ─ My Orders ─ Auctions ───────── ✕ ─┐
│ 🔎 pump-kin            Price chart ▁▂▄▆█▆  (7-day)        │
│ ┌────────────────────────────────────────────┐            │
│ │ SELL ORDERS          qty      ⓑ each        │            │
│ │ pump-kin             ×38      142   [BUY]   │            │
│ │ pump-kin             ×12      145   [BUY]   │            │
│ └────────────────────────────────────────────┘            │
│ Your listing: [item ▼] [qty] [price] → fee 2% → [POST]    │
└────────────────────────────────────────────────────────────┘
```

### 8.5 Trade window (mirrored two-pane, both must lock then confirm — classic dupe-proof two-phase commit).

---

## 9. MVP Roadmap & Milestones (12 weeks, solo + AI-assisted)

| Milestone | Weeks | Scope | Exit criteria |
|---|---|---|---|
| **M0 · Skeleton** | 1 | Monorepo, CI, Drizzle migrations, Next+Phaser shell, Tiled pipeline, deploy to Railway | Walk around an empty Town with 2 browsers seeing each other |
| **M1 · Farm Core** | 2–3 | Farm instancing, tools, tilling/water/plant/harvest, energy, day/night, inventory, lazy crop sim | Full single-player farm day loop is *fun* |
| **M2 · World** | 4–5 | Forest + Mountain, gathering nodes, skills/XP, crafting bench, 3 machines, storage | Gather→craft→upgrade tool progression works |
| **M3 · NPCs & Quests** | 6–7 | Dialogue engine, 10 NPCs, relationships/gifts, quest engine, 12 story quests, daily board | New player has 3 days of guided content |
| **M4 · Economy** | 8–9 | Marketplace order board, auctions, P2P trade window, ledger/audit, price ticker, Marketplace zone | Two players complete the full trade triangle; zero dupes under fuzz test |
| **M5 · Seasons, Ruins & Events** | 10–11 | 4-season system, Ruins zone, archaeology, relics, discoveries, 4 world events, Validator Temple | A season rollover visibly changes the world; meteor event draws a crowd |
| **M6 · Solana + Polish** | 12 | SIWS, devnet cNFT export/import, onboarding/tutorial via Pip, audio, juice pass, closed alpha (50 players) | Wallet-less player reports zero friction; export/import round-trips a relic |

**Cut-line discipline:** if behind, cut (in order): auctions (keep order board), Validator Temple, 2 world events, NFT import (keep export). Never cut: farm feel, NPC dialogue, the market board.

**Definition of fun checkpoints:** end of M1 and M3, run a 5-tester playtest; if Day-2 return intent < 60%, stop and tune before adding systems.

---

## 10. Production Scaling Plan

| Stage | CCU | Changes |
|---|---|---|
| **Alpha** | ≤200 | Single game-server process, singleton zones, Neon PG, Upstash Redis. Done — this is the MVP architecture as-is. |
| **Beta** | 2k | Split zone rooms across N game-server processes (Redis room registry + thin WS gateway). PG read replica for market/leaderboards. Town shards into instances of 80 with friend-priority placement. |
| **Launch** | 10k+ | Regional game-server clusters; msgpack→flatbuffers for snapshots; `crops`/`inventory_slots` partitioned by hash(character_id); ledger → monthly partitions; market matching moves to a single-writer Redis-backed matcher with PG WAL persistence; asset CDN with versioned atlases. |
| **Ongoing** | — | Observability from day 1: pino → Loki, OpenTelemetry traces on the action pipeline, Grafana econ dashboards (bits faucets vs sinks daily — the #1 live-ops chart for a trading game). Economy anomaly alerts (any account ±50k bits/day). |

**Live-ops levers built into content-as-code:** seasons.json, event weights, crop values, and recipes are data — rebalancing is a content deploy, not a code release.

---

## Appendix A — Energy & economy starting constants

| Constant | Value | Rationale |
|---|---|---|
| Energy max / regen | 100 / 1 per 36s (full in 1 game-hour of sleep) | ~120 actions per game day |
| Action costs | hoe 2 · water 1 · chop 3 · mine 3 · dig 4 | venture runs ≈ 25 actions |
| Starting bits | 500 | one round of seeds + a gift |
| Market fee | 2% (0% during festivals) | primary bits sink |
| Bits faucets | crops 60% · quests 25% · gathering sales 15% | monitored on the econ dashboard |
| Heart points/heart | 250 | 10 hearts ≈ 3 weeks of dailies or focused gifting |

## Appendix B — Risks

1. **Economy dupes** — mitigated by single-helper mutations, ledger, fuzz tests in M4. Highest-severity risk; treat like a smart-contract audit.
2. **Crypto theming alienating cozy players** — the theme is *archaeological* (post-collapse), not promotional. Playtest with non-crypto users at M3.
3. **Scope** — the cut-line list exists for a reason; M1 fun-check is the kill-switch for feature creep.
4. **NFT legal surface** — cosmetics-only, no token, no promises of value. Same legal-review gate before any mainnet or marketing copy mentioning ownership.
