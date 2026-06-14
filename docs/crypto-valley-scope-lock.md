# CRYPTO VALLEY — MVP SCOPE LOCK
**Status: LOCKED.** This supersedes the roadmaps in all prior docs. Target: launch in <6 months (26 weeks), token-live shortly after.
**The pitch (canonical, use everywhere):**

> **A cozy shared-world MMO where you claim land, work it, and build it up through the ages — from a Stone-Age clearing to a year-3000 skyline. Your land is yours to develop, flip, and show off as the whole world climbs the ages together.**

Never again: "crypto Stardew Valley." That sentence is now banned from all decks, tweets, and READMEs.

> **Theme note:** the old "collapsed blockchain civilization / Overgrown Terminal / archaeology" setting is SUPERSEDED by the **Warm Ages** direction (see `docs/art-bible.md`). Drop dead-civ, ruins-excavation, relics/data-nodes, the Cascade, and the Static everywhere.

---

## 1. Locked scope

### SHIP (launch build)
| System | Scope at launch | Notes |
|---|---|---|
| **Core loop** | Farming, gathering, crafting, energy, day/night, 4 crypto-seasons, 6 zones | base doc §5–6, unchanged |
| **Advance the Ages** | Per-land + per-player progression Stone → year 3000; the world's shared **Age Meter** + frontier unlocks; the per-age palette transformation | the flagship system — gets the most polish budget |
| **Land & building** | Claimable land parcels, free-form structures (hut → … → skyscraper) with in-place upgrades, the zoomed-out **land canvas** (place art/logos), owner nameplates | the thing players own, develop, and show off |
| **Land market (flip)** | Buy / develop / sell land; price discovery, a public **leaderboard**, "featured lands" (algorithmic + Vex-curated) | contests = post-launch |
| **NPC memory** | Memory events + callback dialogue (~30/NPC), all 10 NPCs, hearts, gifts, story quests, daily board, mail | seasonal *arcs* cut; the memory engine ships |
| **Professions ×4** | **Prospector, Builder, Blacksmith, Merchant** — certifications (max 2), commissions board, player stalls | see §2 for the Designer resolution |
| **Economy** | Shards market, land auctions, P2P trade, **seasons** with prize pools funded by a cut of trading fees, token-tier whitelist on **Shards** (off-chain points) | $PLACEHOLDER deposit/withdraw flips on post-audit + counsel sign-off |
| **Events** | Age-Advance ceremony, Land Rush, Market Festival | 3 events, repeatable — enough for a live feel |
| **Solana** | SIWS auth, cNFT land-deed export-import (devnet → mainnet at token-live) | |

### DELAY (post-launch content drops — already designed, zero rework)
| Drop | Why it's better later |
|---|---|
| ❌ Breeding / companions | Biggest scope + loot-box-adjacent legal review; ships as its own marketing beat |
| ❌ Frontier land-rush mega-events | Needs a *population* to race for the newly-unlocked frontier — literally works better with players |
| ❌ Alice's journey arc | An NPC leaving for the far frontier only matters to people who've met her. Needs weeks of attachment first |
| ❌ Grand Age Advance meta-campaign | The season-long collective goal to tick the world to the next age — the month-4+ retention spine, not a launch feature |
| ❌ Advanced seasonal stories (incl. Ron's foreclosure) | Ron's arc is the **first** live drop, timed to the first real Bear Market rotation — a story that responds to the live world beats one shipped in the box |

---

## 2. The Designer gap (resolved)
Ship list has land + building but no Designer profession — someone has to make furniture/décor for interiors and the land canvas. Resolution, cheapest-correct version:

- **At launch:** furniture, wallpaper, dyes, and canvas tiles are ordinary **Crafting-skill recipes** (everyone can make them; nice ones gated by Crafting level + rare materials from Prospecting/Mining — which feeds the demand graph anyway). Vex sells a small rotating NPC stock so day-one builds aren't empty.
- **Post-launch (Designer drop, ~month 2):** Designer certification arrives with the *premium* layer — limited-edition lines, sellable layout/blueprint templates, and the first building contest. The profession launches *into* an existing décor meta instead of having to bootstrap one.

Launch profession count = 4. Tighter is better: four professions with real demand beats six with thin markets.

---

## 3. 26-week roadmap (rebuilt around the lock)

| Phase | Weeks | Milestones | Exit criteria |
|---|---|---|---|
| **Foundations** | 1–3 | M0 skeleton + M1 farm core | Two browsers walk a farm; full solo farm-day is fun (playtest #1, kill-switch) |
| **World** | 4–6 | M2: Forest/Mountain, skills, crafting, machines, furniture recipes | Gather→craft→tool-upgrade loop + first furnished room |
| **Town** | 7–10 | M3+: dialogue engine, **memory events + callbacks**, 10 NPCs, quests, mail | Playtest #2: testers name a favorite NPC unprompted — if they can't, stop and fix |
| **Economy** | 11–14 | M4: markets/auctions/land trade (Shards-denominated), ledgers, fuzz tests · M4.5: land sparks/tiers/featured | Zero dupes under fuzz; testers visit + value each other's land without being told to |
| **Ages & professions** | 15–19 | M5: ages progression + Age Meter, land development depth, the land canvas · M5.5: 4 professions, certifications, commissions, stalls | A parcel goes claim→develop→list→sell end-to-end between two players; a land climbs an age |
| **Seasons & events** | 20–21 | Season rotation live, 3 world events, season leaderboard + prize pool (fee-funded) | A season flip visibly changes crops/weather/music; an Age-Advance ceremony draws a crowd |
| **Hardening & chain** | 22–25 | M6/M7: SIWS, cNFT land-deed export, vault + airlock (devnet), anti-bot v1, withdrawal tooling, load test, closed beta (200 players), **legal review window opens week 22** | Solvency reconciliation green for 7 straight days; counsel has the full earn-mechanics memo |
| **Launch** | 26 | Public launch on Shards | Token-live (Shards→$PLACEHOLDER) follows when audit + counsel clear — decoupled from launch *by design* |

Buffer: ~2 weeks of slack absorbed across phases. If slipping: cut the season leaderboard prize pool (keep the leaderboard), then auctions (keep order book), then the third world event. **Never cut:** the ages progression + palette transformation, NPC memory, land/building sparks.

---

## 4. Post-launch content calendar (the delayed list, sequenced)

| When | Drop | The beat |
|---|---|---|
| **Weeks 2–4** | **Ron's foreclosure** (first Bear Market rotation) | First proof the world *responds* — collective rebuild meter, FRIENDS OF RON plaque. This is the clip that markets the game |
| **Month 2** | **Designer profession** + first building contest + premium décor lines | Status economy goes premium |
| **Month 3** | **Companions** (post legal review) | The "new pet" beat — cozy games' most reliable re-engagement hook |
| **Month 4** | **Alice sets out for the frontier** | By now players know her. Gone a full season cycle; hearts-8 players get letters from the far ages |
| **Months 4–7** | **Grand Age Advance meta-campaign** | Server-wide season-long goal to tick the world to the next age; frontier land-rushes slot in as campaign events |
| **Alice's return** | New frontier age + the next-age question | The "season 2" moment |

One drop per month, each is a story moment + a system + a status reward. That's a live-ops cadence one person can actually sustain.

---

## 5. Positioning (investors, players, and the line you don't cross)

**One-liner:** the canonical pitch at the top of this doc.

**The investor paragraph:**
> Cozy MMOs are the most durable category in games (Stardew: 30M+, ACNH: 40M+), but none of them own *progression through the ages* with player-owned, tradeable land — and no crypto game has ever survived its own token, because they all made earning the gameplay. Crypto Valley inverts it: a cozy town-life MMO that's fully fun with the token removed, where the only scarce thing that trades for $PLACEHOLDER is **land** — players claim it, build it up from the Stone Age to the year 3000, and flip it, competing on a leaderboard and in time-boxed seasons whose prize pools are funded entirely by trading fees and creator-fee share, never emissions. The hook is universal — watch your world grow across the ages — and the land doubles as a canvas brands can advertise on. It's aimed at an audience far bigger than crypto.

**Player-facing vocabulary:** claim, build, advance the ages, develop your land, flip, climb the leaderboard, the whole world climbs together. **Avoid in all public copy:** "play to earn," "passive income," APY-anything, price talk, and any specific earn percentages or pool splits — the same pre-counsel discipline as your other launches. The cashtag and the word "earn" don't share a sentence until counsel signs the memo.

**The Shards story, told straight:** "The full economy is live at launch in Shards. Token integration follows our security audit and legal review." Communities respect a stated gate far more than a vague soon™ — and it's true.

---

## 6. Launch success metrics (decide these now, not at week 25)

| Metric | Target (week 4 post-launch) | Why it's the one that matters |
|---|---|---|
| D7 retention | ≥ 25% | cozy-MMO viability line |
| % of actives who visited another player's land | ≥ 60% | the social loop is alive |
| % of actives with ≥1 market transaction | ≥ 40% | broad economy, not a gift shop |
| % of actives with a profession certification | ≥ 30% | the earn loop has breadth |
| Land developed : land flipped | ≥ 1 : 3 | players are building, not only speculating (a healthy land economy) |
| Median session length | 25–45 min | one-to-two game days; below = no hook, far above = pre-burnout signal |

If three of six miss, the post-launch calendar pauses and the team (you) tunes the core before shipping drops. Content can't fix a loop.
