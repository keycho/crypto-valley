# CRYPTO VALLEY v2 — World & Economy Expansion
**Layers on top of:** base doc + token addendum. Four pillars: a profession economy, housing-as-identity, NPCs with memory, and Dead Protocol Archaeology promoted from feature to core fantasy.
**The reframe:** v1 was a farming game with crypto lore. v2 is **an archaeology-and-town-life MMO set in the ruins of a collapsed crypto civilization** — farming is how you eat, not why you stay.

---

## 1. The Profession Economy

### 1.1 The problem being solved
In v1, sellers ≈ lucky explorers. Maybe 2% of players ever list a token-tier item. An economy where 98% of players are pure buyers isn't an economy — it's a gift shop. Professions make *earning a role you choose*, not a drop you pray for.

### 1.2 Design rules
- **Professions are specializations, not classes.** Everyone can do everything at base level; a profession is a *certification track* (granted by an NPC mentor at skill 25+) that unlocks the top tier of one discipline. **Max 2 certifications per character** — this is the scarcity that creates trade. You literally cannot be self-sufficient at the high end; you must buy from other players.
- **Every profession's output is another profession's input.** No dead ends. The demand graph must be a closed loop (§1.4).
- **Earning surfaces:** profession outputs are sellable on the bits market always; the *rare tier* of each profession's output is token-tier. Thousands of bits-earners, hundreds of token-earners, by choice and effort rather than RNG.

### 1.3 The six professions

| Profession | Mentor | Produces | Rare/token tier | Who buys |
|---|---|---|---|---|
| **Archaeologist** | Professor Hash | Relics, protocol fragments, dig-site maps, codex entries | Validated relics, sealed wallets, site-discovery naming rights | Collectors, Designers (display pieces), museums (§4.6) |
| **Blacksmith** | Builder Ben → forge-master arc | Tools T3+, machine parts, structure components | Masterwork tools (visible glow, maker's mark, +durability not +power), commissioned with engraved maker provenance | Everyone (tools wear), Builders (components) |
| **Builder** | Builder Ben | On-site construction service: builds/upgrades structures on *other players'* farms at a material discount, exclusive blueprints | Landmark blueprints (observatories, bathhouses, museum wings) | Homeowners — i.e. everyone (§2) |
| **Designer** | new NPC: **Vex the Curator** (ex-NFT-gallery AI, exquisite taste, devastating reviews) | Furniture, wallpaper/flooring, palette dyes, **layout templates** (sellable room/farm designs others can apply if they own the materials) | Limited-run furniture lines (numbered editions, /50), contest-winning templates | Homeowners, contest entrants |
| **Breeder** | new NPC: **Mara the Tender** (runs the creature sanctuary) | **Daemons** — small data-creatures (§1.5) with inherited traits; companions + farm helpers | High-generation pattern/animation combos; named lineages | Everyone (companions are the #1 status-adjacent purchase in every cozy game) |
| **Merchant** | Mina Mint | Runs a persistent **player shop stall** in the Marketplace: buy-orders, regional arbitrage (zone vendors price differently), bulk contracts | Stall upgrades/locations are auctioned (token sink); top merchants get the ticker-board featured slot | Everyone who'd rather play than trade |

### 1.4 The demand loop (the actual design artifact)

```
 Archaeologist ──relics/fragments──► Designer ──furniture/templates──► Homeowners
      ▲                                  ▲                                │
      │ tools/scanners                   │ dyes need crops                │ commissions
 Blacksmith ◄──ores/bars── miners        │                                ▼
      ▲                              Farmers ──feed──► Breeder ──daemons─► Everyone
      │ components                                        │
   Builder ◄──construction contracts── Homeowners ◄───────┘ (farm-helper daemons)
      ▲
   Merchant (liquidity layer: buys everything, sells everything, smooths all edges)
```

Audit rule for every new item added to the game, forever: *name the profession that makes it and the profession that needs it.* If either answer is "nobody," redesign.

### 1.5 Daemons (the Breeder's product, scoped honestly)
Not pets-as-NFT-speculation. Daemons are Tamagotchi-meets-Chao-Garden data-creatures:
- **Traits:** body pattern (visual gene grid), glow color, idle animation, personality (affects emotes), and ONE utility trait from a capped list (carries 4 extra stack slots, auto-waters 3 tiles, sniffs dig sites at +5% — all convenience, ≤ what a mid-tier tool gives, never combat/yield power).
- **Breeding:** two daemons + incubator (Builder-made) + feed (Farmer-grown) → offspring inherits via simple dominant/recessive grid with low mutation chance. Deterministic-ish: parents' genes visible, so breeding is a *puzzle*, not a slot machine.
- **Hard caps:** 3 daemons active per player, breeding cooldown 1 real day, generation cap 10. Caps are what keep this cozy instead of CryptoKitties.
- ⚠️ **Legal note:** RNG breeding outcomes sold for tokens is loot-box-adjacent. Mitigation already in the design: visible genetics + low mutation = mostly deterministic outcomes. Keep mutation odds published. Flag for the same counsel review as tournaments.

### 1.6 Schema delta
```sql
CREATE TABLE certifications (
  character_id uuid REFERENCES characters(id),
  profession   text NOT NULL,          -- archaeologist|blacksmith|builder|designer|breeder|merchant
  granted_at   timestamptz NOT NULL DEFAULT now(),
  mastery      int NOT NULL DEFAULT 0, -- profession-specific progression
  PRIMARY KEY (character_id, profession)
);
-- enforce max 2 via app-layer check on insert

CREATE TABLE commissions (             -- Builder/Blacksmith/Designer work orders
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  poster_id uuid NOT NULL, taker_id uuid,
  kind text NOT NULL,                  -- build|smith|design
  spec jsonb NOT NULL,                 -- what & where
  pay_bits bigint, pay_token bigint,   -- escrowed on post
  status text NOT NULL DEFAULT 'open'  -- open|taken|done|disputed|cancelled
);

CREATE TABLE daemons (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_id uuid NOT NULL REFERENCES characters(id),
  name text, genes jsonb NOT NULL,     -- {pattern, glow, anim, personality, utility}
  generation int NOT NULL DEFAULT 1,
  parents uuid[], born_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT false
);

CREATE TABLE shop_stalls (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  merchant_id uuid NOT NULL UNIQUE,
  location_slot int NOT NULL UNIQUE,   -- finite stalls = the merchant scarcity
  name text, banner jsonb,
  lease_until timestamptz NOT NULL     -- token-denominated lease auction
);
```

---

## 2. Housing & Identity (the status economy)

### 2.1 Why this is the real token sink
Roblox/Habbo/ACNH proved the same thing: people pay more for *being seen* than for *being strong*. Status items are the perfect token good — infinite demand ceiling, zero gameplay power, and they make the world prettier for everyone else (positive externality, unlike P2W's negative one).

### 2.2 Systems
- **Interior mode:** entering your house switches to a room grid (8×6 → up to 16×12 via Builder upgrades). Furniture placement free-form on a half-tile grid, wallpaper/floor per room, light sources affect the night render. All furniture is Designer-craftable; rare lines are limited editions.
- **Exterior identity:** fences, paths, banners, topiary, daemon roaming, custom farm name + motto on the gate plaque (plaque rename = small token sink).
- **Farm ratings — visitor-driven, anti-gameable:** visitors leave a 1-tap "spark" (one per farm per real day, must have spent 60s+ on the farm, account age ≥7 days, diminishing weight from repeat visitors and friend-cluster visits). Rating = 28-day rolling sparks, decayed. No numeric score wars — farms display a *tier emblem* (Seedling → Homestead → Landmark → Wonder).
- **Visitor counter** on the gate plaque (lifetime + this-season). Pure vanity, costs nothing, works absurdly well.
- **Featured farms:** the Town Square notice board + a warp pedestal rotate 6 farms daily — 3 algorithmic (top spark velocity in each tier, so newbies get featured too) + 3 curated by Vex with a one-line acid review ("The chromatic fencing is a crime I respect."). Being Vex-featured is the status hit people will grind weeks for. Cost: one content-curation cron + one NPC's snark table.
- **Housing contests:** seasonal, themed ("Bear Market Bunker," "Bull Run Rooftop"). Entry free. Judging = community sparks (50%) + NPC judge panel scores (50%, deterministic rubric: palette cohesion, density, theme tags). Prizes: trophies (displayable), exclusive furniture blueprint for the Designer profession, featured slot, modest token pool from the creator-fee treasury.
- **Visiting loop glue:** daily quest "visit 2 farms" (Pip delivers you), spark-back notifications, "X is visiting your farm" toast — every system nudges traffic toward player spaces.

### 2.3 Schema delta
```sql
CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  kind text NOT NULL DEFAULT 'interior',
  w int NOT NULL, h int NOT NULL,
  wallpaper text, flooring text
);
CREATE TABLE furniture_placements (
  room_id uuid NOT NULL REFERENCES rooms(id),
  idx int NOT NULL,
  item_id text NOT NULL, x numeric NOT NULL, y numeric NOT NULL, rot int DEFAULT 0,
  PRIMARY KEY (room_id, idx)
);
CREATE TABLE farm_sparks (
  farm_id uuid NOT NULL, visitor_id uuid NOT NULL, day date NOT NULL,
  weight numeric NOT NULL DEFAULT 1.0,
  PRIMARY KEY (farm_id, visitor_id, day)
);
CREATE MATERIALIZED VIEW farm_ratings AS
  SELECT farm_id, sum(weight * exp(-extract(epoch FROM now()-day::timestamptz)/2419200)) AS score
  FROM farm_sparks WHERE day > now() - interval '28 days' GROUP BY farm_id;
-- refreshed every 10 min; tier thresholds in content config
```

---

## 3. NPCs With Memory (town life as the retention engine)

### 3.1 The architecture of "Olivia remembers"
NPC memory is already half-built: `npc_relationships.flags` + the domain-event pipeline. v2 formalizes it:

- **Memory events:** a whitelist of ~40 domain events per NPC gets written into `flags.memories[]` as compact tuples: `{ev:'gifted_loved', item:'moonflower', season:1, day:142}`, `{ev:'helped_event', type:'oracle_malfunction'}`, `{ev:'sold_relic_of_her_creator'}` (yes — if you auction a relic Olivia cares about, she knows, and it costs you a heart).
- **Dialogue trees read memory:** condition language extends with `memory:gifted_loved.count>=3`, `memory:helped_event.oracle_malfunction`, `since(memory.X) > 20d`. Authored lines reference specifics: *"You still carrying that scanner Hash gave you? He doesn't lend those."*
- **Callbacks, not chatbots:** this stays 100% authored + deterministic. (An LLM ambient-dialogue layer is a tempting v3 experiment — cost, latency, and tone-control make it wrong for MVP. Authored callbacks at 30 per NPC produce 90% of the "she remembers me" magic at 0% of the risk.)

### 3.2 Season-reactive arcs (the world has weather *and* fortune)
Each NPC has a **state machine keyed to the season cycle**, persisted in world-level config (same for all players — it's the town's shared story) plus per-player branches:

- **Rugged Ron / Bear Market:** the first Bear Market after launch, Ron's pawn shop is foreclosed (world event: his stall boarded up, Ron sleeping in the Marketplace doorway). Town quest chain: players collectively donate materials/bits to a rebuild meter (visible thermometer in Town Square — Habbo-style collective goals). If funded by season's end → Ron reopens with a "FRIENDS OF RON" plaque listing top contributors (status!). If not → he moves into Granny Genesis's spare room and the shop stays boarded until next cycle. *The economy season produces a story consequence; the story produces a social goal; the goal produces a status reward.* That's the whole game in one arc.
- **Oracle Olivia / Alt Season:** her predictions go haywire as chaos peaks; her personal arc about trusting intuition over data advances one chapter per Alt Season.
- **Agent Alice / the long arc:** after a player community milestone (10k total memory shards recovered server-wide), Alice announces she's found the signal source and **walks into the deep Ruins and disappears** — gone from the world for one full season cycle. Players who reached hearts 8+ receive fragmented transmissions (mail) during her absence. She returns changed at the next Accumulation — with the key to the Ruins' lowest level (new content gate). NPCs leaving *creates* presence. Nobody forgets the season Alice was gone.
- **Granny Genesis:** one new "before the Collapse" story per real month, drip-feeding the lore (§4) — town-hall readings, attendance is a world event.

### 3.3 Implementation cost honesty
This is a writing problem more than an engineering problem. Engine work: extend condition parser, add `npc_world_state` table, add the collective-goal meter component, mail system (already trivial). Content work: ~30 memory callbacks × 10 NPCs + 4 seasonal arcs ≈ the single biggest content line item in v2. Budget it like one (see roadmap).

```sql
CREATE TABLE npc_world_state (        -- shared town story state
  npc_id text PRIMARY KEY,
  arc text NOT NULL, stage int NOT NULL DEFAULT 0,
  meter jsonb,                        -- collective goals: {target, progress, contributors top-N}
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE mail (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  to_id uuid NOT NULL, from_npc text, from_player uuid,
  subject text, body text, attachments jsonb,
  read boolean DEFAULT false, sent_at timestamptz DEFAULT now()
);
```

---

## 4. Dead Protocol Archaeology — the core fantasy

### 4.1 The pitch
> **You live in the ruins of a collapsed crypto civilization. Dig it up. Decode it. Decide what it meant.**

Not "Stardew but blockchain" — *Spiritfarer meets Indiana Jones in the wreckage of 2021.* The crypto layer stops being theme paint and becomes the archaeology itself. This is the thing no other game owns, and it's natively yours: you've already built oracles, watched protocols die, and closed a peg program for good — the lore writes itself from lived material.

### 4.2 The Collapse (canon, one paragraph)
A thousand years ago, the Chain Cities ran on the Great Oracle — a network that priced everything, settled everything, remembered everything. Then came the Cascade: a single corrupted feed, leverage on leverage, validators going dark in waves, treasuries draining in a night. The civilization didn't burn; it *halted*. Finalized, forever pending. The survivors' descendants — you — farm the quiet land above the buried machines, and the machines are starting to hum again.

### 4.3 Excavation gameplay (deeper than "dig, get relic")
Dig sites become **multi-stage micro-dungeons**:
1. **Survey** — scanner sweep minigame (signal-strength hot/cold on a tile grid) marks excavation squares.
2. **Excavate** — layered digging; brittle finds need brushes (Blacksmith-made) or they shatter into fragments (still useful, less valuable). Risk/care tradeoff, ACNH-fossil-meets-Minesweeper.
3. **Decode** — fragments + Data Fragments at the Compiler reconstruct what you found: a relic, a *protocol fragment* (lore document), a wallet, or coordinates to a deeper site.
4. **Validate** — Deva authenticates provenance (timestamp, site, finder) → relic becomes token-tier tradeable AND a codex entry.

### 4.4 What you find (the content taxonomy)
| Find class | What it is | Examples |
|---|---|---|
| **Abandoned validators** | Repairable structures in the world — fix one (Builder + Blacksmith + Energy Cells, multi-player effort) and it becomes a regional buff beacon (cosmetic light pillar + fast-travel node) with the repairers' names engraved | Validator 7 "The Honest One" — the only one that didn't go dark |
| **Forgotten AI agents** | Recoverable NPCs! Major digs can wake a minor agent who joins the town as a vendor/curiosity. Town population *grows through archaeology* | a market-maker bot that now haggles over turnips; Alice's siblings |
| **Extinct memecoins** | Collectible coin relics of *fictional* dead tokens, each with a one-line epitaph; collectible sets by "era" | $WAGMI ("it was not, in fact, gonna make it"), $TULIP, $FLOOF, $UPONLY. **Fictional analogs only** — parody-adjacent homage, never real tickers or real founders. Same doxxing-adjacent line we've held before: mock the pattern, never the person. |
| **Lost treasuries** | Server-wide hunts: a treasury's location is split across N protocol fragments held by *different players* — forcing trade/cooperation to assemble the map. Opening one is a scheduled world event; contents are bits + relics + one unique trophy | "The DAO That Sleeps" |
| **Broken oracle networks** | The long meta-quest: repairing Great Oracle nodes (one per region) is the server's overarching collective goal, gated behind everything else. Endgame = the town votes what the restored Oracle should be *for* | the final story beat asks the only question that matters: *should it come back?* |

### 4.5 Protocol fragments = lore as loot
Every fragment is a readable document — a governance post, a panicked dev log from the Cascade, a love letter between two traders, Validator 7's final block comment. Collected fragments assemble into **codex chapters** (the game's lorebook, browsable in-game). Writing the Collapse as found documents is cheap to produce, infinitely memeable (players will screenshot fragments), and turns lore from skippable text into *the loot itself*.

### 4.6 The Museum (the system that ties all four pillars together)
A buildable Town institution (collective goal, Builder-profession showcase). Players **donate** validated relics and fragment sets to fill its wings — donor name on the placard, forever (the ACNH museum + RuneScape PoH trophy case, fused). Donating is the *opposite of selling*: a permanent status sink that pulls token-tier items out of circulation (deflationary!) in exchange for pure prestige. Curator: Vex. Opening night of each completed wing = a world event with Granny Genesis cutting the ribbon.

---

## 5. Roadmap impact

| Change | Where it lands |
|---|---|
| Excavation v2 (survey/excavate/decode/validate) | replaces v1 "dig → roll table" in **M5** — same slot, deeper system |
| NPC memory + condition parser + mail | **M3** grows by 1 week |
| Seasonal arcs (Ron, Olivia) + collective-goal meter | new **M5.7**, 1.5 weeks; Alice's disappearance + Museum + treasuries are *post-launch live-ops content* (they're better as live moments anyway) |
| Housing interiors + sparks + featured farms | new **M4.5**, 2 weeks (contests = live-ops) |
| Professions: certifications, commissions, stalls | **M5.5** (the earn-loops milestone) absorbs this — it *is* the earn loop now; +1 week. Daemons ship post-launch (biggest cut-line candidate; the demand graph survives without them at launch) |
| Codex + fragments writing | parallel content track, no engineering milestone |

Net: ~17 → **~21 weeks** to token-live, launch build still playable at week 14. The four additions are also the four best live-ops beats for the first three months post-launch — don't front-load all of them.

---

## 6. What this version is, in one breath
A town that remembers you, built on the bones of a civilization that didn't — where what you dig up, build, breed, and design is worth something *because other players want it*, and the rarest thing in the world is a placard with your name on it.
