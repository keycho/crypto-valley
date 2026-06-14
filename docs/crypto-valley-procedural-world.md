# CRYPTO VALLEY — Procedural World Architecture
**Supersedes:** base doc §6 (map design) and the zone model for the open land. Handcrafted zones survive only as the **Core** (Town Square, Hall of Land, Marketplace, NPC houses, Starter Farms) plus **10 story landmarks**. Everything beyond the town walls is generated and claimable.
**Prime directive:** the world is a *pure function of a seed*. Servers and clients run the same generator; the database stores only what players *changed*. That single decision is what makes a 100x world cost ~0x.

> ## ⚠ v3 REVISION — Compact Heartland, Advancing Frontier
> **This supersedes the ring/overworld sizing below.** Final world shape, locked with the 2D top-down decision:
>
> **The settled land is Stardew-sized.** Total playable surface ≈ a 512×512-tile disc (frontier edge at radius 256): the handcrafted Core (Town, farm district, Hall of Land, Marketplace, ~96-tile radius) ringed by **4–6 authored-feeling procedural screens** — Forest, Mountain Edge, Coast, Plains — each roughly one Stardew map in size. Generated once from the seed, then *frozen and hand-polished* before launch (generate → review in sandbox → stamp fixes). Small enough to memorize, dense enough that 10–15 players claiming and working land cross paths constantly. Stardew's whole world is ~50–100k walkable tiles; this matches it.
>
> **The growth moves outward — the world climbs the ages.** As the collective **Age Meter** rises, the shared **frontier** recedes and opens **procedurally generated frontier regions** — the same room-graph zones from §3, now organized by how recently the frontier unlocked them rather than by raw distance:
> - **Frontier tier = age.** The earliest-settled bands hold Stone- and Bronze-age land; the freshly opened bands carry the newer ages players are racing toward. *Advancing the frontier is advancing through time* — the history graph's eras map directly to frontier tiers, so the deeper you go into newly-unlocked land the further along the age ladder it sits. The "endless somewhere to claim next" promise is fully kept; it just opens as the world levels up, the way new game-stages always did.
> - Frontier tier replaces ring tier everywhere: resource tables, parcel size class, build-tech availability, age band.
> - **Landmarks redistribute: 3 in the heartland** (Sunrise Henge, Coastal Foundry, Skyward Spire — visible anchors), **7 along the frontier as age milestones** (the Year-3000 Skyline at the far edge of the most-advanced band = the long-term goal players talk about).
> - **The frontier stays** — as the visible horizon of unclaimed land and as the live-ops dial: each Age-Meter milestone opens a new region for everyone. The machinery below remains correct; only the dial's default changed.
>
> **What this kills:** the infinite overworld, super-chunk room sharding at launch (one open-land room suffices), and overworld road networks. **What survives untouched:** seeded determinism, client-side generation + deltas (now applied to frontier regions), chunk streaming (used inside large regions), the region generator, the history graph, resource nodes (daily rotation across the heartland + inside frontier regions), and the sandbox as the validation tool.

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
- **Server-side authority:** resource-node yields, rare-find rolls, and interactable outcomes are *also* seeded-deterministic, but the server alone executes the roll and writes the delta — clients can render a resource node, they can't know what it yields. (Seed hierarchy splits into a `visualSeed` the client gets and a `lootSeed` it never does.)
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
Infinite overworld on a chunk grid; the handcrafted **Core** occupies chunks (−2..2, −2..2) and is stamped over generation (handcrafted always wins). Coordinates radiate outward; **distance from the Core = how recently the frontier opened it** — land gets newer, more advanced, and richer in build-tech the further out the Age Meter has pushed. That gradient *is* the infinite expansion loop.

```
World (seed)
├── Core (handcrafted stamp): Town, Hall of Land, Marketplace, NPC houses, Farm district
├── Rings (distance bands): r0 Outskirts → r1 Frontier → r2 New Lands → r3 The Far Edge
├── Regions (Voronoi cells over ring space, ~24×24 chunks each), biome per cell:
│     Forest · Mountains · Plains · Highlands · Settlement · Coastal
├── Features per chunk (seeded placement): claimable land parcels, cave entrances,
│     buildable clearings, resource nodes (trees → wood, rocks → stone), flora
└── Landmarks (10 handcrafted): deterministically placed, one per sector arc (§4)
```

### 1.2 Biome assignment (cheap and good enough)
Two low-frequency simplex noise fields + ring index:
- `elevation(x,y)` → coast / lowland / highland / peaks
- `corruption(x,y)` → how far this land has climbed the ages: drives the per-age palette shift, structure density, build-tech richness, resource-node richness, and ambient audio. **This "age band" field is the warm-themed replacement for a moisture map** — it makes the *age progression* legible in the terrain. (Kept as the identifier `corruption` in the generator for compatibility.)
- Biome = lookup table over (elevation band × `corruption` band × ring), then Voronoi-cell majority vote so regions feel coherent rather than noisy. Highland frontier regions only spawn at `corruption` > 0.75 (rare, freshly-advanced, high-value).

### 1.3 World sizing: The Frontier (Age-Meter-scaled, population-aware)

An infinite generator does NOT mean an infinite *playable* world. With <100 players, density is everything — players must trip over each other. So the claimable radius is a **live-ops dial**, not a constant — and the dial is the collective **Age Meter**:

- **The Frontier:** beyond the current frontier radius lies unclaimed, not-yet-opened land — a visible warm horizon of wild country the settlement hasn't reached. Soft barrier, gorgeous to look at, screams "soon."
- **Launch frontier: ~512 tiles radius** (rings shrunk to [256, 512] live, everything beyond frontier-locked). That's ~200 chunks of open land — a few minutes' walk edge to edge, dense enough that 10–15 players working their claims *will* cross paths.
- **The frontier recedes as the world advances** — and every recession is a content beat: "The frontier is opening over the eastern Plains" = new region, new history-graph entities, new landmark revealed, server-wide event triggered when the collective Age Meter hits a milestone. World growth IS the live-ops calendar. (This also makes the append-only history graph rule load-bearing: new rings ship with new orgs.)
- **Density floor rule:** target ≥1 interesting feature per 1.5 chunks inside the live frontier, with features *clustered along old roads* (seeded path network between landmarks) rather than uniform — roads concentrate players on shared routes, which is where encounters happen.

**Finding each other (the rest of the answer is social design, not geometry):**
- One shared open-land shard at launch — no instancing splits below ~150 CCU.
- World map shows **friend pins** (live) and **player trails** — faint footstep traces of anyone who passed in the last game-day. An "empty" chunk that shows three trails feels inhabited; this is the cheapest MMO-feel trick that exists.
- Land claims and big builds broadcast to zone chat ("Keycho raised a Bronze-age workshop in the Western Frontier") with a map ping — new claims become magnets.
- World events spawn *inside* the live frontier only, sized as gathering moments.
- Town waystones / advanced transit hubs = fast-travel nodes → chokepoints → familiar faces.

### 1.4 Within-chunk generation passes (per 64×64 chunk, ~2–4 ms)
1. **Terrain:** biome tile palette via noise thresholds; coast/rivers from elevation field.
2. **Autotiling:** marching-squares pass picks edge/corner tiles (one 47-tile blob set per biome = the entire terrain art budget).
3. **Features:** Poisson-disk sampling seeded by `seeds.chunk`; feature table weighted by biome + ring (e.g., New Lands chunk: 35% nothing, 25% claimable parcel, 15% buildable clearing, 10% cave, 10% resource cluster, 5% landmark anchor).
4. **Flora/props/scatter:** density from `corruption` (the age band); props from biome prop tables.
5. **Stamps:** if a landmark or Core region overlaps, overwrite with the handcrafted Tiled map.

---

## 2. Chunk streaming system

### 2.1 Client (Phaser)
- **64×64 tiles** (16 px) = 1024² px per chunk. Keep a **5×5 chunk window** around the player: generate into pooled `Phaser.Tilemaps` layers on a worker-ish budget (generation in a Web Worker via the pure `packages/worldgen`, main thread only blits), evict LRU beyond radius 4. Prefetch in movement direction.
- Render layers per chunk: ground / detail / collision (data-only) / above. Lighting samples `corruption` (the age band) for the per-age ambient tint.
- **Delta application:** on chunk enter-window, ask server `{t:'chunk_sub', cx, cy}` → server replies with delta list + live entities; on evict, `chunk_unsub`.

### 2.2 Server
- The open land is sharded into **super-chunk rooms** (8×8 chunks = one room/process slot, registry in Redis as before). Players hand off between rooms at super-chunk borders (state transfer = position + velocity; inventory etc. is DB-backed so handoff is trivial). MVP: one process owns all open-land rooms; the sharding seam is just *there* for later.
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
Resource nodes re-seed per world-day (seeded by epoch — same trick as weather), so the open land replenishes with zero rows written. Only *story-grade* features (landmarks, treasuries, claimed parcels) persist their state permanently — scarcity where it matters, renewal where it doesn't.

---

## 3. Frontier-region generation (1000+ regions from ~20 area prefabs)

Frontier regions are **instanced explorable zones**: stepping past a frontier marker loads you into a generated area-scene built from `seeds.ruin(ws, featureId)` (`ruin` kept as the generator's identifier) — so the heartland stays light and frontier regions can be arbitrarily large.

### 3.1 Pipeline: template-graph assembly (not WFC — simpler, art-controllable)
1. **Area prefabs** authored in Tiled: ~20 templates (Grove, Stone Quarry, Orchard, Homestead, Workshop, Granary, Trading Post, Trail ×3, Crossroads, Open Glade, Lumber Camp, Mill Pond, Henge, Gateway, Outpost, Hidden Cache, Plaza-scale Commons). Each prefab declares **sockets** (path anchors with direction) + tags (`depth_min`, `rarity`, `loot_table`, `unique_per_ruin`).
2. **Layout graph:** seeded random walk with constraints — pick size class from ring (Outskirts: 3–5 areas; New Lands: 8–16; The Far Edge: up to 25 + sub-regions via Gateway prefab). Grammar rules: exactly one entrance Gateway; Granary/Trading Post only behind ≥2 areas; the central Workshop unique; ≥1 loop in layouts >6 areas (loops make spaces feel designed, not generated).
3. **Spatial solve:** place prefabs on a coarse grid, connect sockets with trail prefabs; fail-and-retry up to 8 layouts (deterministic — retries consume the same seed stream, so everyone gets the identical region).
4. **Decoration pass:** per-area prop tables + age-band-driven dressing (overgrowth, weathering, ponds in Mill areas) + light sources.
5. **Population pass (server-only `lootSeed`):** harvest spots, resource nodes, rare-find spawns, the occasional sealed cache. One **"signature"** element per region rolled from a quirk table (a flooded mill pond; an orchard overrun by glowcaps; a homestead where every field is tilled except one) — the 5% weirdness that makes the 95% template feel handcrafted.
6. **Naming:** from the history graph (§5): *"Veyra-9 Holdings · Helios Accord"* — regions belong to generated organizations, which is what stitches exploration to the world's living history.

### 3.2 Variety math (sanity check)
20 prefabs × layout topology (10³–10⁶ valid graphs per size class) × decoration rolls × signature quirks × biome skins (each prefab has per-biome tilesets — same geometry, 6 looks) ⇒ effective uniqueness far beyond what any player exhausts. The *art* cost is 20 areas + 6 tileset skins + prop sheets. That's the whole region budget.

---

## 4. The 10 handcrafted landmarks (where the craft budget goes)
Sunrise Henge · Year-3000 Skyline · Founders' Cache · Great Library · Skyward Spire · Memory Hall · Coastal Foundry · The First Hearth · The Last Quarry · Alice's Origin Homestead.

- **Placement:** deterministic seeded sampling — one landmark per 36° sector arc, each within a prescribed ring (Henge in r1, Skyline in r3, etc.), snapped to valid terrain. Same seed → same locations, but *players don't get a published map* — finding them is content. Procedural records drop **coordinate hints** to landmarks (the world's history literally navigates you).
- Each landmark = handcrafted Tiled map + one authored quest/puzzle + one unique trophy/chronicle chapter. Ten of these is ~3 weeks of content work and they anchor the entire world's credibility: players forgive infinite generated regions when the special places are *special*.

---

## 5. The world's living history: the History Graph

### 5.1 The trick that beats mad-libs
Pure grammar generation ("The {ORG} {BUILDING} was founded after {EVENT} by {FOUNDER}") feels random after ten reads because nothing ever *recurs*. Fix: generate the **history first, records second.**

At world-genesis (one-time job from `seeds.history`), generate a causal graph and persist it. **Launch size: small on purpose** — recurrence is the whole trick, and recurrence density is inversely proportional to graph size. Players will remember the Helios Accord, Mira Hash, and the Great Migration; they will not remember 150 people. Start at:
- **20 organizations** (guilds, settlements, trade leagues, founding clans) with names, sigils (procedural glyph gen), founding era, home region, legacy
- **40 founders/figures** with names, roles, org affiliations, relationships (rival/mentor/married/allied), legacies
- **5 turning-point events** spanning the ages (a Great Migration, a boom, a famine, a golden age), each with causes linked to orgs/figures and an affected-region footprint
- **~15 treasuries/heirloom hoards** owned by orgs, status (lost/claimed/sealed), region hints

The graph is append-only by design: post-launch expansions add orgs/figures into *newly-opened frontier rings* (new land = new history), so growing it later never contradicts what players already pieced together.
- **Timeline:** every entity stamped with era dates that map onto the age ladder; a constraint pass guarantees causal sanity (no one founds an org after their own departure)

```sql
CREATE TABLE history_entities (
  id text PRIMARY KEY,                -- 'org:helios_accord', 'fig:mira_hash'
  kind text NOT NULL,                 -- org|figure|disaster|treasury
  name text NOT NULL, era int4range NOT NULL,
  attrs jsonb NOT NULL,               -- role, fate, sigil seed, region, …
  links jsonb NOT NULL                -- [{rel:'founded', to:'org:helios_accord'}, …]
);
```

### 5.2 Records are *views into the graph*
A history record = (template × graph query × seed). ~40 authored templates per document type — council notices, work-logs, charters, traveler's diaries, love letters, ledgers, eulogies — each with slots filled from a *connected subgraph*, not independent rolls:

> *"Charter, internal — Helios Accord. If Veyra's harvest fails again we move the granary, I don't care what **Mira** says. — copied from the Veyra-9 work-log"*

…and three regions later you find Mira Hash's own log contradicting it. **Entities recur, documents disagree, players piece together what actually happened.** That's a living history, not flavor text. The chronicle auto-organizes records by entity — collect all records touching an org and its chronicle chapter "completes" (Hall-of-Land-featured as a set).

- **Names:** syllable-grammar generators per culture-cluster (3 phoneme sets), reserved-word blocklist, profanity filter, and a **uniqueness check + fictional-only guard** — generated names/tickers are checked against a denylist of real projects and public figures so the generator can never accidentally produce a real person or real token. Same line as always: pattern, never person.
- **Quantity control:** thousands of *record instances* from 40 templates × the graph, but **token-tier find caps stay global and daily** (base doc rule). Procedural abundance of history; engineered scarcity of value. Infinite world, sound economy.

### 5.3 Generated quests from the same graph
Daily-board templates can now query history: *"Professor Hash wants any record mentioning the Helios Accord"* / *"locate the Veyra-9 holdings"* — generated objectives that feel authored because the nouns are consistent. Free content, forever.

---

## 6. Revised build order (your phases, made concrete)

| Phase | Weeks | Builds | Exit criteria |
|---|---|---|---|
| **1 — Town & people** | 1–6 | Core handcrafted maps, farm loop, housing interiors, NPC memory engine, 10 NPCs, quests | Playtest: testers name a favorite NPC; a furnished room exists |
| **2 — The world machine** | 7–11 | `packages/worldgen`: seeds, biomes, autotiling, chunk streaming (client worker + server manifests), delta tables, fog-of-war map, region generator + 20 prefabs, 3 of 10 landmarks | Walk 30 minutes in one direction: no two regions identical, no loading hitch >16 ms, deltas survive restart |
| **3 — Land & history** | 12–16 | History graph genesis, record templates, land-claim v2, chronicle, Hall of Land + featured lands, remaining 7 landmarks | Two players independently reconstruct the same org's story from different regions |
| **4 — Economy** | 17–21 | Markets/auctions/trade (Shards), professions ×4, commissions, stalls, sparks/featured farms, world events | Land parcel: claim→build→auction→show-off between two players; fuzz tests green |
| **5 — Token** | 22–26 | SIWS, cNFT export, vault airlock, anti-bot, hardening, beta, legal window | Game demonstrably fun in beta **before** any token flips on |

Same 26-week envelope as the scope lock — Phase 2 replaces what was previously hand-mapping Forest/Mountain/Plains, and the trade is favorable: ~3 weeks of generator engineering buys an unbounded world instead of 3 fixed zones.

### Cut-lines within the generator (if Phase 2 slips)
Drop in order: cave systems (frontier regions cover the fantasy) → coastal biome → Highlands (fold into Plains) → ring r3. **Never drop:** determinism, client-side generation, the history graph. Those three are the architecture.

---

## 7. Why this hits "100x perceived scale" honestly

| Cost (one-time) | Yield (unbounded) |
|---|---|
| 6 biome tilesets + autotile blobs | infinite coherent terrain |
| 20 area prefabs + 6 skins | 1000s of distinct frontier regions |
| 40 record templates + name grammars | 1000s of cross-referencing documents |
| 1 history-graph generator | a living past with figures players argue about |
| 10 landmarks + Core maps | the credibility anchor that makes the rest believable |

The illusion isn't the noise function — every survival game has one. The illusion is **recurrence**: the same organizations, the same names, the same turning-point told from opposing sides, found in places no developer ever looked at. Generated geography, *coherent* history. That's what makes a small team's world feel lived-in instead of random.
