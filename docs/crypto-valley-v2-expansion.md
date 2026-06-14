# CRYPTO VALLEY v2 — World & Economy Expansion
**Layers on top of:** base doc + token addendum. Four pillars: a profession economy, land-as-identity, NPCs with memory, and the Advance-Through-the-Ages climb promoted from feature to core fantasy.
**The reframe:** v1 was a farming game with crypto lore. v2 is **a shared-world build-and-flip MMO where you claim land and grow it from the Stone Age toward the year 3000** — farming is how you fund the climb, not why you stay.

---

## 1. The Profession Economy

### 1.1 The problem being solved
In v1, sellers ≈ lucky landholders. Maybe 2% of players ever list a token-tier asset. An economy where 98% of players are pure buyers isn't an economy — it's a gift shop. Professions make *earning a role you choose*, not a parcel you pray flips.

### 1.2 Design rules
- **Professions are specializations, not classes.** Everyone can do everything at base level; a profession is a *certification track* (granted by an NPC mentor at skill 25+) that unlocks the top tier of one discipline. **Max 2 certifications per character** — this is the scarcity that creates trade. You literally cannot be self-sufficient at the high end; you must buy from other players.
- **Every profession's output is another profession's input.** No dead ends. The demand graph must be a closed loop (§1.4).
- **Earning surfaces:** profession outputs are sellable on the shards market always; the *rare tier* of each profession's output is token-tier. Thousands of shards-earners, hundreds of token-earners, by choice and effort rather than RNG.

### 1.3 The six professions

| Profession | Mentor | Produces | Rare/token tier | Who buys |
|---|---|---|---|---|
| **Surveyor** | Professor Hash | Parcel surveys, age-tech blueprints, frontier claim-maps, deed records | Prime frontier claim-rights, certified deeds, region-naming rights | Flippers, Designers (showcase parcels), the leaderboard board (§4.6) |
| **Blacksmith** | Builder Ben → forge-master arc | Tools T3+, machine parts, structure components | Masterwork tools (visible glow, maker's mark, +durability not +power), commissioned with engraved maker's record | Everyone (tools wear), Builders (components) |
| **Builder** | Builder Ben | On-site construction service: builds/upgrades structures on *other players'* land at a material discount, exclusive blueprints | Landmark blueprints (observatories, bathhouses, skyline towers) | Landholders — i.e. everyone (§2) |
| **Designer** | new NPC: **Vex the Curator** (ex-gallery curation AI, exquisite taste, devastating reviews) | Furniture, wallpaper/flooring, palette dyes, **layout templates** (sellable room/parcel designs others can apply if they own the materials) | Limited-run furniture lines (numbered editions, /50), contest-winning templates | Landholders, contest entrants |
| **Breeder** | new NPC: **Mara the Tender** (runs the creature sanctuary) | **Daemons** — small companion-creatures (§1.5) with inherited traits; companions + land helpers | High-generation pattern/animation combos; named lineages | Everyone (companions are the #1 status-adjacent purchase in every cozy game) |
| **Merchant** | Mina Mint | Runs a persistent **player shop stall** in the Marketplace: buy-orders, regional arbitrage (zone vendors price differently), bulk contracts | Stall upgrades/locations are auctioned (token sink); top merchants get the ticker-board featured slot | Everyone who'd rather play than trade |

### 1.4 The demand loop (the actual design artifact)

```
 Surveyor ──parcels/blueprints──► Designer ──furniture/templates──► Landholders
      ▲                                ▲                                │
      │ tools/scanners                 │ dyes need crops                │ commissions
 Blacksmith ◄──ores/bars── miners      │                                ▼
      ▲                            Farmers ──feed──► Breeder ──daemons─► Everyone
      │ components                                      │
   Builder ◄──construction contracts── Landholders ◄────┘ (land-helper daemons)
      ▲
   Merchant (liquidity layer: buys everything, sells everything, smooths all edges)
```

Audit rule for every new item added to the game, forever: *name the profession that makes it and the profession that needs it.* If either answer is "nobody," redesign.

### 1.5 Daemons (the Breeder's product, scoped honestly)
Not pets-as-NFT-speculation. Daemons are Tamagotchi-meets-Chao-Garden companion-creatures:
- **Traits:** body pattern (visual gene grid), glow color, idle animation, personality (affects emotes), and ONE utility trait from a capped list (carries 4 extra stack slots, auto-waters 3 tiles, scouts unclaimed frontier parcels at +5% — all convenience, ≤ what a mid-tier tool gives, never combat/yield power).
- **Breeding:** two daemons + incubator (Builder-made) + feed (Farmer-grown) → offspring inherits via simple dominant/recessive grid with low mutation chance. Deterministic-ish: parents' genes visible, so breeding is a *puzzle*, not a slot machine.
- **Hard caps:** 3 daemons active per player, breeding cooldown 1 real day, generation cap 10. Caps are what keep this cozy instead of CryptoKitties.
- ⚠️ **Legal note:** RNG breeding outcomes sold for tokens is loot-box-adjacent. Mitigation already in the design: visible genetics + low mutation = mostly deterministic outcomes. Keep mutation odds published. Flag for the same counsel review as tournaments.

### 1.6 Schema delta
```sql
CREATE TABLE certifications (
  character_id uuid REFERENCES characters(id),
  profession   text NOT NULL,          -- surveyor|blacksmith|builder|designer|breeder|merchant
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
  pay_shards bigint, pay_token bigint,   -- escrowed on post
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

## 2. Land & Identity (the status economy)

### 2.1 Why this is the real token sink
Roblox/Habbo/ACNH proved the same thing: people pay more for *being seen* than for *being strong*. Status builds are the perfect token good — infinite demand ceiling, zero gameplay power, and they make the world prettier for everyone else (positive externality, unlike P2W's negative one). And because land is the scarce, tradeable asset, a beautifully developed parcel is *also* a more valuable one to flip — vanity and value pull the same direction.

### 2.2 Systems
- **Interior mode:** entering your house switches to a room grid (8×6 → up to 16×12 via Builder upgrades). Furniture placement free-form on a half-tile grid, wallpaper/floor per room, light sources affect the night render. All furniture is Designer-craftable; rare lines are limited editions. The room renders in your land's current **age palette** — a Stone-Age den and a year-3000 loft are the same grid, re-tinted by how far you've climbed.
- **Exterior identity:** fences, paths, banners, topiary, daemon roaming, custom land name + motto on the gate plaque (plaque rename = small token sink). The free-form structure stack (hut → cabin → house → tower → high-rise → skyscraper) is itself the loudest identity statement — your skyline *is* your reputation.
- **Land ratings — visitor-driven, anti-gameable:** visitors leave a 1-tap "spark" (one per parcel per real day, must have spent 60s+ on the land, account age ≥7 days, diminishing weight from repeat visitors and friend-cluster visits). Rating = 28-day rolling sparks, decayed. No numeric score wars — parcels display a *tier emblem* (Seedling → Homestead → Landmark → Wonder).
- **Visitor counter** on the gate plaque (lifetime + this-season). Pure vanity, costs nothing, works absurdly well.
- **Featured lands:** the Town Square notice board + a warp pedestal rotate 6 parcels daily — 3 algorithmic (top spark velocity in each tier, so newbies get featured too) + 3 curated by Vex with a one-line acid review ("The chromatic fencing is a crime I respect."). Being Vex-featured is the status hit people will grind weeks for. Cost: one content-curation cron + one NPC's snark table.
- **Build contests:** seasonal, themed ("Bear Market Bunker," "Bull Run Rooftop"). Entry free. Judging = community sparks (50%) + NPC judge panel scores (50%, deterministic rubric: palette cohesion, density, theme tags). Prizes: trophies (displayable), exclusive furniture blueprint for the Designer profession, featured slot, modest token pool from the trading-fee treasury.
- **Visiting loop glue:** daily quest "visit 2 lands" (Pip delivers you), spark-back notifications, "X is visiting your land" toast — every system nudges traffic toward player spaces.

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

- **Memory events:** a whitelist of ~40 domain events per NPC gets written into `flags.memories[]` as compact tuples: `{ev:'gifted_loved', item:'moonflower', season:1, day:142}`, `{ev:'helped_event', type:'market_crash'}`, `{ev:'sold_land_she_helped_you_clear'}` (yes — if you flip a parcel Olivia helped you settle, she knows, and it costs you a heart).
- **Dialogue trees read memory:** condition language extends with `memory:gifted_loved.count>=3`, `memory:helped_event.market_crash`, `since(memory.X) > 20d`. Authored lines reference specifics: *"You still carrying that surveyor's scanner Hash gave you? He doesn't lend those."*
- **Callbacks, not chatbots:** this stays 100% authored + deterministic. (An LLM ambient-dialogue layer is a tempting v3 experiment — cost, latency, and tone-control make it wrong for MVP. Authored callbacks at 30 per NPC produce 90% of the "she remembers me" magic at 0% of the risk.)

### 3.2 Season-reactive arcs (the world has weather *and* fortune)
Each NPC has a **state machine keyed to the season cycle**, persisted in world-level config (same for all players — it's the town's shared story) plus per-player branches:

- **Rugged Ron / Bear Market:** the first Bear Market after launch, Ron's land office is foreclosed (world event: his stall boarded up, Ron sleeping in the Marketplace doorway). Town quest chain: players collectively donate materials/shards to a rebuild meter (visible thermometer in Town Square — Habbo-style collective goals). If funded by season's end → Ron reopens with a "FRIENDS OF RON" plaque listing top contributors (status!). If not → he moves into Granny Genesis's spare room and the office stays boarded until next cycle. *The market season produces a story consequence; the story produces a social goal; the goal produces a status reward.* That's the whole game in one arc.
- **Surveyor Olivia / a wild Alt Season:** her parcel-value reads go haywire as the market churns; her personal arc about trusting her own eye over the charts advances one chapter per Alt Season.
- **Agent Alice / the long arc:** when the world's collective **Age Meter** crosses a major threshold server-wide, Alice announces she's going to scout the new frontier herself and **walks past the edge of the map and disappears** — gone from the world for one full season cycle. Players who reached hearts 8+ receive fragmented dispatches (mail) during her absence. She returns changed at the next Accumulation — with the key that opens the freshly-advanced frontier tier (new content gate). NPCs leaving *creates* presence. Nobody forgets the season Alice was gone.
- **Granny Genesis:** one new "back when this was all a Stone-Age clearing" story per real month, drip-feeding the world's history through the ages (§4) — town-hall readings, attendance is a world event.

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

## 4. Advance Through the Ages — the core fantasy

### 4.1 The pitch
> **You claim a Stone-Age clearing. Work it. Build it up. Climb the ages until your land is a year-3000 skyline.**

Not "Stardew but blockchain" — *Civilization's tech climb meets Spiritfarer's warmth, on a parcel you own.* The crypto layer stops being theme paint and becomes the *market* itself: land is the scarce asset, and the climb is what makes a parcel worth flipping. This is the thing no other cozy game owns, and it's natively yours: the economy, the seasons, the leaderboard all run on the same advance-through-time spine.

### 4.2 The two climbs (canon, one paragraph)
Every player starts primitive — a thatched hut on bare ground — and climbs **all six ages personally**: Stone → Bronze → Medieval → Industrial → Modern → Future. Above that, a single **collective Age Meter** advances a shared **frontier**: as the whole world's activity pushes the meter, new land and new age-tech unlock for *everyone*, and the world itself visibly leaps forward an era. Late joiners still get the full personal climb *and* a richer, further-advanced world to climb into; early players hold the prime, appreciating land they settled first. The world advances together, but the ground under your feet is yours.

### 4.3 Land development (deeper than "claim, get parcel")
Claiming and advancing a parcel becomes a **multi-stage progression**:
1. **Survey** — scanner sweep minigame (signal-strength hot/cold on a tile grid) marks the most promising squares of an unclaimed frontier parcel.
2. **Work it** — layered clearing and gathering; brittle ground features need care-tools (Blacksmith-made) or they crumble into low-grade materials (still useful, less valuable). Risk/care tradeoff, ACNH-fossil-meets-Minesweeper.
3. **Build** — materials + age-tech blueprints at the Workbench raise the next structure tier (hut → cabin → house → … ), unlock a craft, or open a survey path to an adjacent frontier parcel.
4. **Certify** — Deva registers the deed (timestamp, parcel, owner, age reached) → the developed parcel becomes a token-tier tradeable asset AND gets a permanent entry in its ownership history.

### 4.4 What you build toward (the content taxonomy)
| Find class | What it is | Examples |
|---|---|---|
| **Age-tech landmarks** | Buildable shared structures on the frontier — raise one (Builder + Blacksmith + Energy Cells, multi-player effort) and it becomes a regional buff beacon (cosmetic light pillar + fast-travel node) with the builders' names engraved | the Bronze-Age Beacon "The First Light" — the spark that opened the second age |
| **Awakened helper-agents** | Recoverable NPCs! Major frontier pushes can wake a dormant helper-agent who joins the town as a vendor/curiosity. Town population *grows as the world advances* | a market-maker bot that now haggles over turnips; Alice's siblings |
| **Extinct memecoins** | Collectible trophy-coins of *fictional* dead tokens, each with a one-line epitaph; collectible sets by "era" | $WAGMI ("it was not, in fact, gonna make it"), $TULIP, $FLOOF, $UPONLY. **Fictional analogs only** — parody-adjacent homage, never real tickers or real founders. Same doxxing-adjacent line we've held before: mock the pattern, never the person. |
| **Land Rushes** | Server-wide claim events: a new frontier tier opens and its prime parcels are surfaced across N claim-maps held by *different players* — forcing trade/cooperation to assemble the routes. Opening one is a scheduled world event; rewards are shards + claim-rights + one unique trophy | "The Rush for the High Plateau" |
| **The Grand Age Advance** | The long meta-quest: pushing the collective Age Meter past each era threshold (one campaign per advance) is the server's overarching collective goal, gated behind everything else. Endgame = the town votes which direction the next age should lean | the final story beat asks the only question that matters: *what do we build next?* |

### 4.5 Age records = lore as reward
Every record is a readable document — a town-charter from the first Bronze settlers, a giddy dev log from the night the Modern age unlocked, a love letter between two traders, the deed-comment on the parcel that founded the High Plateau. Collected records assemble into **Chronicle chapters** (the game's lorebook of the climb, browsable in-game). Writing the world's history through the ages as found documents is cheap to produce, infinitely memeable (players will screenshot records), and turns lore from skippable text into *a reward in itself*.

### 4.6 The Hall of Land (the system that ties all four pillars together)
A buildable Town institution (collective goal, Builder-profession showcase). It is the home of the **leaderboard** and the rotating **featured lands**, rendered as the **land-as-canvas** mosaic — every showcased parcel reads as a clean colour block at zoom-out, the player-painted map made public. Players can **enshrine** a certified prime parcel into a permanent public wing — owner name on the placard, forever, with its full ownership history beside it (the ACNH gallery + RuneScape PoH trophy case, fused). Enshrining is the *opposite of flipping*: a permanent status sink that takes a token-tier parcel off the trade market (deflationary on land supply!) in exchange for pure prestige. Curator: Vex. Opening night of each completed wing = a world event with Granny Genesis cutting the ribbon.

---

## 5. Roadmap impact

| Change | Where it lands |
|---|---|
| Land development v2 (survey/work/build/certify) | replaces v1 "claim → roll table" in **M5** — same slot, deeper system |
| NPC memory + condition parser + mail | **M3** grows by 1 week |
| Seasonal arcs (Ron, Olivia) + collective-goal meter | new **M5.7**, 1.5 weeks; Alice's disappearance + Hall of Land + Land Rushes are *post-launch live-ops content* (they're better as live moments anyway) |
| Land interiors + sparks + featured lands | new **M4.5**, 2 weeks (contests = live-ops) |
| Professions: certifications, commissions, stalls | **M5.5** (the earn-loops milestone) absorbs this — it *is* the earn loop now; +1 week. Daemons ship post-launch (biggest cut-line candidate; the demand graph survives without them at launch) |
| Chronicle + age-records writing | parallel content track, no engineering milestone |

Net: ~17 → **~21 weeks** to token-live, launch build still playable at week 14. The four additions are also the four best live-ops beats for the first three months post-launch — don't front-load all of them.

---

## 6. What this version is, in one breath
A town that remembers you and a world that climbs the ages with you — where the land you claim, build, breed, and design on is worth something *because other players want it*, and the rarest thing in the world is a placard with your name on the parcel that founded an age.
