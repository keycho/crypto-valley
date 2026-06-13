# CRYPTO VALLEY — Procedural World Architecture
**Supersedes:** base doc §6 (map design) and the zone model for wilderness. Handcrafted zones survive only as the **Core** (Town Square, Museum, Marketplace, NPC houses, Starter Farms) plus **10 story landmarks**. Everything beyond the town walls is generated.
**Prime directive:** the world is a *pure function of a seed*. Servers and clients run the same generator; the database stores only what players *changed*. That single decision is what makes a 100x world cost ~0x.

> ## ⚠ v3 REVISION — Compact Surface, Infinite Underground
> **This supersedes the ring/overworld sizing below.** Final world shape, locked with the 2D top-down decision:
>
> **The surface is Stardew-sized.** Total playable surface ≈ a 512×512-tile disc (Static wall at radius 256): the handcrafted Core (Town, farm district, Museum, Marketplace, ~96-tile radius) ringed by **4–6 authored-feeling procedural screens** — Forest, Mountain Edge, Coast, Wastes — each roughly one Stardew map in size. Generated once from the seed, then *frozen and hand-polished* before launch (generate → review in sandbox → stamp fixes). Small enough to memorize, dense enough that 10–15 players in the wild cross paths constantly. Stardew's whole world is ~50–100k walkable tiles; this matches it.
>
> **The infinity moves underground.** 4–6 fixed surface entrances (the Mountain crack, the Drowned Exchange stairwell, the well behind Granny's…) lead into **procedurally generated ruin strata** — the instanced room-graph dungeons from §3, now organized by depth instead of distance:
> - **Depth = time.** L1–L5: late-Cascade era. L6–L15: the boom years. L16+: founding era. *Digging down is digging back through history* — the history graph's eras map directly to strata, so deeper fragments are older documents. The "endless somewhere unexplored" promise is fully kept; it just points down, like Stardew's mines always did.
> - Depth tier replaces ring tier everywhere: loot tables, ruin size class, corruption intensity, fragment era.
> - **Landmarks redistribute: 3 on the surface** (Validator Temple, Drowned Exchange, Genesis Observatory — visible anchors), **7 underground as depth milestones** (Great Oracle Core at the bottom of the deepest shaft = the long-term goal players talk about).
> - **The Static stays** — as the surface horizon (lore intact) and as the live-ops dial: a future "Static recession" can open a second surface region if population ever justifies it. The machinery below remains correct; only the dial's default changed.
>
> **What this kills:** the infinite overworld, super-chunk room sharding at launch (one wilderness room suffices), and overworld road networks. **What survives untouched:** seeded determinism, client-side generation + deltas (now applied to dungeon levels), chunk streaming (used inside large strata), the ruin generator, the history graph, dig sites (daily rotation across the small surface + inside ruins), and the sandbox as the validation tool.

---
## 0. The one architectural trick everything hangs on

```
world_state(x, y) = generate(WORLD_SEED, x, y)   ⊕   deltas(x, y)
                    └── pure, deterministic,           └── tiny, DB-backed:
                        runs identically on             looted nodes, dug tiles,
                        client & server,                opened doors, discoveries,
                        costs zero storage              player structures
```

- **Client-side generation:** the generator lives in `packages/worldgen` (pure TS, zero IO, shared like `packages/sim`). The client generates terrain locally the instant it knows the seed — the server never streams tilemaps. A chunk's network cost is *only its delta list* (usually <1 KB, often zero).
- **Server-side authority:** loot contents, relic rolls, and interactable outcomes are *also* seeded-deterministic, but the server alone executes the roll and writes the delta — clients can render a dig site, they can't know what's inside it. (Seed hierarchy splits into a `visualSeed` the client gets and a `lootSeed` it never does.)
- **Same-seed guarantee:** `WORLD_SEED` is global and permanent for the live world. Test worlds = different seeds. Generator versioned (`GEN_V`); any generator change after launch only applies to chunks with no deltas and beyond the explored frontier (never reshape ground someone built on).

```ts
// packages/worldgen/seed.ts — hierarchical seeding, the spine of determinism
const h = (...parts: (string|number)[]) => xxhash64(parts.join(':'));   // fast, stable
export const seeds = {
  region:   (ws: bigint, rx: number, ry: number)        => h(ws, 'rg', rx, ry),
  chunk:    (ws: bigint, cx: number, cy: number)        => h(ws, 'ck', cx, cy),
  feature:  (ck: bigint, i: number)                     => h(ck, 'ft', i),
  ruin:     (ws: bigint, id: string)                    => h(ws, 'ruin', id),
  loot:     (ws: bigint, featureId: string, srv: 1)     => h(ws, 'loot', featureId), // server-only branch
  history:  (ws: bigint)                                => h(ws, 'hist'),
};
```

---

## 1. World structure & biome generation

### 1.1 Layout
Infinite overworld on a chunk grid; the handcrafted **Core** occupies chunks (−2..2, −2..2) and is stamped over generation (handcrafted always wins). Coordinates radiate outward; **distance from the Core = depth of history** — strata get older, stranger, and richer the further you walk. That gradient *is* the infinite exploration loop.

```
World (seed)
├── Core (handcrafted stamp): Town, Museum, Marketplace, NPC houses, Farm district
├── Rings (distance bands): r0 Outskirts → r1 Frontier → r2 Deep Ruinlands → r3 The Silence
├── Regions (Voronoi cells over ring space, ~24×24 chunks each), biome per cell:
│     Forest · Mountains · Wastelands · Oracle Zones · Ancient City Ruins · Coastal
├── Features per chunk (seeded placement): dig sites, cave entrances, validator ruins,
│     abandoned facilities, hidden archaeology zones, resource nodes, flora
└── Landmarks (10 handcrafted): deterministically placed, one per sector arc (§4)
```

### 1.2 Biome assignment (cheap and good enough)
Two low-frequency simplex noise fields + ring index:
- `elevation(x,y)` → coast / lowland / highland / peaks
- `corruption(x,y)` → how badly the Cascade hit here: drives palette shift, glitch-FX density, ruin frequency, data-fragment richness, and ambient audio. **Corruption is the crypto-native replacement for a moisture map** — it makes the *lore* legible in the terrain.
- Biome = lookup table over (elevation band × corruption band × ring), then Voronoi-cell majority vote so regions feel coherent rather than noisy. Oracle Zones only spawn at corruption > 0.75 (rare, eerie, high-value).

### 1.3 World sizing: The Static (population-scaled frontier)

An infinite generator does NOT mean an infinite *playable* world. With <100 players, density is everything — players must trip over each other. So the playable radius is a **live-ops dial**, not a constant:

- **The Static:** beyond the current frontier radius, the world dissolves into corrupted signal — a visible wall of glitching static (lore-native: the unindexed dead zone the Oracle never mapped). Hard barrier, gorgeous to look at, screams "later."
- **Launch frontier: ~512 tiles radius** (rings shrunk to [256, 512] live, everything beyond Static-locked). That's ~200 chunks of wilderness — a few minutes' walk edge to edge, dense enough that 10–15 players in the wild *will* cross paths.
- **The frontier recedes as population grows** — and every recession is a content beat: "The Static is lifting over the eastern Ruinlands" = new region, new history-graph entities, new landmark revealed, server-wide event. World growth IS the live-ops calendar. (This also makes the append-only history graph rule load-bearing: new rings ship with new orgs.)
- **Density floor rule:** target ≥1 interesting feature per 1.5 chunks inside the live frontier, with features *clustered along old roads* (seeded path network between landmarks) rather than uniform — roads concentrate players on shared routes, which is where encounters happen.

**Finding each other (the rest of the answer is social design, not geometry):**
- One shared wilderness shard at launch — no instancing splits below ~150 CCU.
- World map shows **friend pins** (live) and **player trails** — faint footstep traces of anyone who passed in the last game-day. An "empty" chunk that shows three trails feels inhabited; this is the cheapest MMO-feel trick that exists.
- Dig-site discoveries broadcast to zone chat ("Keycho unearthed something in the Western Frontier") with a map ping — discoveries become magnets.
- World events spawn *inside* the live frontier only, sized as gathering moments.
- Repaired validators = fast-travel nodes → chokepoints → familiar faces.

### 1.4 Within-chunk generation passes (per 64×64 chunk, ~2–4 ms)
1. **Terrain:** biome tile palette via noise thresholds; coast/rivers from elevation field.
2. **Autotiling:** marching-squares pass picks edge/corner tiles (one 47-tile blob set per biome = the entire terrain art budget).
3. **Features:** Poisson-disk sampling seeded by `seeds.chunk`; feature table weighted by biome + ring (e.g., Deep Ruinlands chunk: 35% nothing, 25% dig site, 15% ruin entrance, 10% cave, 10% facility, 5% hidden archaeology zone).
4. **Flora/props/debris:** density from corruption; props from biome prop tables.
5. **Stamps:** if a landmark or Core region overlaps, overwrite with the handcrafted Tiled map.

---

## 2. Chunk streaming system

### 2.1 Client (Phaser)
- **64×64 tiles** (16 px) = 1024² px per chunk. Keep a **5×5 chunk window** around the player: generate into pooled `Phaser.Tilemaps` layers on a worker-ish budget (generation in a Web Worker via the pure `packages/worldgen`, main thread only blits), evict LRU beyond radius 4. Prefetch in movement direction.
- Render layers per chunk: ground / detail / collision (data-only) / above. Lighting samples corruption for ambient tint.
- **Delta application:** on chunk enter-window, ask server `{t:'chunk_sub', cx, cy}` → server replies with delta list + live entities; on evict, `chunk_unsub`.

### 2.2 Server
- The wilderness is sharded into **super-chunk rooms** (8×8 chunks = one room/process slot, registry in Redis as before). Players hand off between rooms at super-chunk borders (state transfer = position + velocity; inventory etc. is DB-backed so handoff is trivial). MVP: one process owns all wild rooms; the sharding seam is just *there* for later.
- Server generates chunks on demand too (same package), but only needs **collision + feature manifests**, not render data — and caches them LRU in memory. Nothing generated is ever persisted.
- **Interest management** now keys on chunk subscriptions instead of radius math: you receive entity updates for chunks you're subscribed to.

### 2.3 Persistence: the delta tables (the only world state in PG)
```sql
CREATE TABLE chunk_deltas (
  cx int NOT NULL, cy int NOT NULL,
  idx smallint NOT NULL,              -- tile index within chunk (y*64+x)
  kind text NOT NULL,                 -- looted|dug|tilled|door_open|destroyed|placed:<defId>
  data jsonb, by uuid, at timestamptz DEFAULT now(),
  PRIMARY KEY (cx, cy, idx, kind)
);
CREATE INDEX deltas_by_chunk ON chunk_deltas(cx, cy);

CREATE TABLE chunk_discovery (        -- fog-of-war per character; fills the world map
  character_id uuid NOT NULL, cx int NOT NULL, cy int NOT NULL,
  at timestamptz DEFAULT now(),
  PRIMARY KEY (character_id, cx, cy)
);

CREATE TABLE feature_state (          -- per-feature server state (loot rolled? respawn epoch?)
  feature_id text PRIMARY KEY,        -- 'ck:31:-12:ft:3'
  state text NOT NULL,                -- pristine|looted|exhausted
  respawn_epoch int,                  -- node-style features re-roll on world-day epochs
  first_found_by uuid, found_at timestamptz
);
```
Resource nodes re-seed per world-day (seeded by epoch — same trick as weather), so the wilds replenish with zero rows written. Only *story-grade* features (ruins, treasuries, hidden zones) persist `looted` permanently — scarcity where it matters, renewal where it doesn't.

---

## 3. Ruin generation (1000+ ruins from ~20 room prefabs)

Ruins are **instanced interiors**: entering a ruin entrance warps you into a generated room-scene built from `seeds.ruin(ws, featureId)` — so the overworld stays light and ruins can be arbitrarily deep.

### 3.1 Pipeline: template-graph assembly (not WFC — simpler, art-controllable)
1. **Room prefabs** authored in Tiled: ~20 templates (Treasury, Oracle Chamber, Archive, Dormitory, Power Core, Vault, Data Center, Corridor ×3, Junction, Collapsed Hall, Server Stacks, Cistern, Shrine, Antechamber, Stairwell, Maintenance, Hidden Cache, Boss-scale Atrium). Each prefab declares **sockets** (door anchors with direction) + tags (`depth_min`, `rarity`, `loot_table`, `unique_per_ruin`).
2. **Layout graph:** seeded random walk with constraints — pick size class from ring (Outskirts: 3–5 rooms; Deep Ruinlands: 8–16; The Silence: up to 25 + sub-levels via Stairwell prefab). Grammar rules: exactly one entrance Antechamber; Vault/Treasury only behind ≥2 rooms; Power Core unique; ≥1 loop in layouts >6 rooms (loops make spaces feel designed, not generated).
3. **Spatial solve:** place prefabs on a coarse grid, connect sockets with corridor prefabs; fail-and-retry up to 8 layouts (deterministic — retries consume the same seed stream, so everyone gets the identical ruin).
4. **Decoration pass:** per-room prop tables + corruption-driven damage overlays (rubble, glitch tiles, flooding in Cisterns) + light sources.
5. **Population pass (server-only `lootSeed`):** dig spots, lootables, fragment spawns, the rare sealed wallet. One **"signature"** element per ruin rolled from a quirk table (flooded power core; archive overrun by glowcaps; a dormitory where every bed is made except one) — the 5% weirdness that makes the 95% template feel handcrafted.
6. **Naming:** from the history graph (§5): *"Substation Veyra-9 · Helios Accord"* — ruins belong to generated organizations, which is what stitches exploration to archaeology.

### 3.2 Variety math (sanity check)
20 prefabs × layout topology (10³–10⁶ valid graphs per size class) × decoration rolls × signature quirks × biome skins (each prefab has per-biome tilesets — same geometry, 6 looks) ⇒ effective uniqueness far beyond what any player exhausts. The *art* cost is 20 rooms + 6 tileset skins + prop sheets. That's the whole dungeon budget.

---

## 4. The 10 handcrafted landmarks (where the craft budget goes)
Validator Temple · Great Oracle Core · Treasury Vault · Compiler Archive · Genesis Observatory · Memory Cathedral · The Drowned Exchange · Cascade Epicenter · The Last Block · Alice's Origin Lab.

- **Placement:** deterministic seeded sampling — one landmark per 36° sector arc, each within a prescribed ring (Temple in r1, Oracle Core in r3, etc.), snapped to valid terrain. Same seed → same locations, but *players don't get a published map* — finding them is content. Procedural fragments drop **coordinate hints** to landmarks (the lore literally navigates you).
- Each landmark = handcrafted Tiled map + one authored quest/puzzle + one unique trophy/codex chapter. Ten of these is ~3 weeks of content work and they anchor the entire world's credibility: players forgive infinite generated ruins when the special places are *special*.

---

## 5. Procedural archaeology: the History Graph

### 5.1 The trick that beats mad-libs
Pure grammar generation ("The {ORG} {BUILDING} was abandoned after {DISASTER} by {FOUNDER}") feels random after ten reads because nothing ever *recurs*. Fix: generate the **history first, fragments second.**

At world-genesis (one-time job from `seeds.history`), generate a causal graph and persist it. **Launch size: small on purpose** — recurrence is the whole trick, and recurrence density is inversely proportional to graph size. Players will remember the Helios Accord, Mira Hash, and the Cascade; they will not remember 150 people. Start at:
- **20 organizations** (protocols, DAOs, validator guilds, exchanges) with names, sigils (procedural glyph gen), founding era, HQ region, fate
- **40 founders/figures** with names, roles, org affiliations, relationships (rival/mentor/married/betrayed), fates
- **5 disasters** culminating in the Cascade, each with causes linked to orgs/figures and an affected-region footprint
- **~15 treasuries/artifact hoards** owned by orgs, status (lost/looted/sealed), region hints

The graph is append-only by design: post-launch expansions add orgs/figures into *unexplored rings* (new strata = new history), so growing it later never contradicts what players already pieced together.
- **Timeline:** every entity stamped with era dates; a constraint pass guarantees causal sanity (no one founds an org after their own disappearance)

```sql
CREATE TABLE history_entities (
  id text PRIMARY KEY,                -- 'org:helios_accord', 'fig:mira_hash'
  kind text NOT NULL,                 -- org|figure|disaster|treasury
  name text NOT NULL, era int4range NOT NULL,
  attrs jsonb NOT NULL,               -- role, fate, sigil seed, region, …
  links jsonb NOT NULL                -- [{rel:'founded', to:'org:helios_accord'}, …]
);
```

### 5.2 Fragments are *views into the graph*
A protocol fragment = (template × graph query × seed). ~40 authored templates per document type — governance posts, panic-logs, validator records, AI logs, love letters, audit reports, eulogies — each with slots filled from a *connected subgraph*, not independent rolls:

> *"Risk memo, internal — Helios Accord. If Veyra's feed desyncs again we pull collateral, I don't care what **Mira** says. — recovered from Substation Veyra-9"*

…and three ruins later you find Mira Hash's own log contradicting it. **Entities recur, documents disagree, players piece together what actually happened.** That's archaeology, not flavor text. The codex auto-organizes fragments by entity — collect all fragments touching an org and its codex chapter "completes" (museum-donatable as a set).

- **Names:** syllable-grammar generators per culture-cluster (3 phoneme sets), reserved-word blocklist, profanity filter, and a **uniqueness check + fictional-only guard** — generated names/tickers are checked against a denylist of real projects and public figures so the generator can never accidentally produce a real person or real token. Same line as always: pattern, never person.
- **Quantity control:** thousands of *fragment instances* from 40 templates × the graph, but **token-tier relic caps stay global and daily** (base doc rule). Procedural abundance of lore; engineered scarcity of value. Infinite world, sound economy.

### 5.3 Generated quests from the same graph
Daily-board templates can now query history: *"Professor Hash wants any fragment mentioning the Helios Accord"* / *"locate Substation Veyra-9"* — generated objectives that feel authored because the nouns are consistent. Free content, forever.

---

## 6. Revised build order (your phases, made concrete)

| Phase | Weeks | Builds | Exit criteria |
|---|---|---|---|
| **1 — Town & people** | 1–6 | Core handcrafted maps, farm loop, housing interiors, NPC memory engine, 10 NPCs, quests | Playtest: testers name a favorite NPC; a furnished room exists |
| **2 — The world machine** | 7–11 | `packages/worldgen`: seeds, biomes, autotiling, chunk streaming (client worker + server manifests), delta tables, fog-of-war map, ruin generator + 20 prefabs, 3 of 10 landmarks | Walk 30 minutes in one direction: no two ruins identical, no loading hitch >16 ms, deltas survive restart |
| **3 — Archaeology** | 12–16 | History graph genesis, fragment templates, excavation v2, codex, Museum + donations, remaining 7 landmarks | Two players independently reconstruct the same org's story from different ruins |
| **4 — Economy** | 17–21 | Markets/auctions/trade (Shards), professions ×4, commissions, stalls, sparks/featured farms, world events | Relic: survey→validate→auction→placard between two players; fuzz tests green |
| **5 — Token** | 22–26 | SIWS, cNFT export, vault airlock, anti-bot, hardening, beta, legal window | Game demonstrably fun in beta **before** any token flips on |

Same 26-week envelope as the scope lock — Phase 2 replaces what was previously hand-mapping Forest/Mountain/Ruins, and the trade is favorable: ~3 weeks of generator engineering buys an unbounded world instead of 3 fixed zones.

### Cut-lines within the generator (if Phase 2 slips)
Drop in order: cave systems (ruins cover the fantasy) → coastal biome → Oracle Zones (fold into Wastelands) → ring r3. **Never drop:** determinism, client-side generation, the history graph. Those three are the architecture.

---

## 7. Why this hits "100x perceived scale" honestly

| Cost (one-time) | Yield (unbounded) |
|---|---|
| 6 biome tilesets + autotile blobs | infinite coherent terrain |
| 20 room prefabs + 6 skins | 1000s of distinct ruins |
| 40 fragment templates + name grammars | 1000s of cross-referencing documents |
| 1 history-graph generator | a civilization with figures players argue about |
| 10 landmarks + Core maps | the credibility anchor that makes the rest believable |

The illusion isn't the noise function — every survival game has one. The illusion is **recurrence**: the same dead organizations, the same names, the same disaster told from opposing sides, found in places no developer ever looked at. Generated geography, *coherent* history. That's what makes a small team's world feel ancient instead of random.
