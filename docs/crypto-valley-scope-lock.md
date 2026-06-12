# CRYPTO VALLEY — MVP SCOPE LOCK
**Status: LOCKED.** This supersedes the roadmaps in all prior docs. Target: launch in <6 months (26 weeks), token-live shortly after.
**The pitch (canonical, use everywhere):**

> **A cozy MMO where players excavate the ruins of a lost blockchain civilization, build a town that remembers them, and discover relics that become part of the world's permanent history.**

Never again: "crypto Stardew Valley." That sentence is now banned from all decks, tweets, and READMEs.

---

## 1. Locked scope

### SHIP (launch build)
| System | Scope at launch | Notes |
|---|---|---|
| **Core loop** | Farming, gathering, crafting, energy, day/night, 4 crypto-seasons, 6 zones | base doc §5–6, unchanged |
| **Archaeology** | Full v2 excavation (survey → excavate → decode → validate), dig sites, relics w/ provenance, protocol fragments, codex | the flagship system — gets the most polish budget |
| **Housing** | Interiors, furniture placement, exterior identity, sparks, tier emblems, visitor counts, featured farms (algorithmic + Vex-curated) | contests = post-launch |
| **Museum** | All wings buildable, donations, donor placards, Vex curation | wing *opening ceremonies* are post-launch events; building/donating works day one |
| **NPC memory** | Memory events + callback dialogue (~30/NPC), all 10 NPCs, hearts, gifts, story quests, daily board, mail | seasonal *arcs* cut; the memory engine ships |
| **Professions ×4** | **Archaeologist, Builder, Blacksmith, Merchant** — certifications (max 2), commissions board, player stalls | see §2 for the Designer resolution |
| **Economy** | Bits market, auctions, P2P trade, token-tier whitelist on **Shards** (off-chain points) | $PLACEHOLDER deposit/withdraw flips on post-audit + counsel sign-off |
| **Events** | Meteor crash, Oracle malfunction, Market Festival | 3 events, repeatable — enough for a live feel |
| **Solana** | SIWS auth, cNFT relic/deed export-import (devnet → mainnet at token-live) | |

### DELAY (post-launch content drops — already designed, zero rework)
| Drop | Why it's better later |
|---|---|
| ❌ Breeding / Daemons | Biggest scope + loot-box-adjacent legal review; ships as its own marketing beat |
| ❌ Lost treasury mega-events | Needs a *population* to split the map fragments across — literally works better with players |
| ❌ Alice disappearance arc | An NPC vanishing only matters to people who've met her. Needs weeks of attachment first |
| ❌ Validator restoration meta-campaign | The season-long collective goal — this is the month-4+ retention spine, not a launch feature |
| ❌ Advanced seasonal stories (incl. Ron's foreclosure) | Ron's arc is the **first** live drop, timed to the first real Bear Market rotation — a story that responds to the live world beats one shipped in the box |

---

## 2. The Designer gap (resolved)
Ship list has Housing + Museum but no Designer profession — someone has to make furniture. Resolution, cheapest-correct version:

- **At launch:** furniture, wallpaper, and dyes are ordinary **Crafting-skill recipes** (everyone can make them; nice ones gated by Crafting level + rare materials from Archaeology/Mining — which feeds the demand graph anyway). Vex sells a small rotating NPC stock so day-one houses aren't empty.
- **Post-launch (Designer drop, ~month 2):** Designer certification arrives with the *premium* layer — limited-edition lines, sellable layout templates, and the first housing contest. The profession launches *into* an existing furniture meta instead of having to bootstrap one.

Launch profession count = 4. Tighter is better: four professions with real demand beats six with thin markets.

---

## 3. 26-week roadmap (rebuilt around the lock)

| Phase | Weeks | Milestones | Exit criteria |
|---|---|---|---|
| **Foundations** | 1–3 | M0 skeleton + M1 farm core | Two browsers walk a farm; full solo farm-day is fun (playtest #1, kill-switch) |
| **World** | 4–6 | M2: Forest/Mountain, skills, crafting, machines, furniture recipes | Gather→craft→tool-upgrade loop + first furnished room |
| **Town** | 7–10 | M3+: dialogue engine, **memory events + callbacks**, 10 NPCs, quests, mail | Playtest #2: testers name a favorite NPC unprompted — if they can't, stop and fix |
| **Economy** | 11–14 | M4: markets/auctions/trade (Shards-denominated), ledgers, fuzz tests · M4.5: housing sparks/tiers/featured | Zero dupes under fuzz; testers visit each other's farms without being told to |
| **Archaeology & professions** | 15–19 | M5: excavation v2, Ruins, codex, Museum donations · M5.5: 4 professions, certifications, commissions, stalls | A relic goes survey→validate→auction→museum placard end-to-end between two players |
| **Seasons & events** | 20–21 | Season rotation live, 3 world events, Validator-Temple-lite (puzzle floor, trophy) | A season flip visibly changes crops/weather/music; a meteor draws a crowd |
| **Hardening & chain** | 22–25 | M6/M7: SIWS, cNFT export, vault + airlock (devnet), anti-bot v1, withdrawal tooling, load test, closed beta (200 players), **legal review window opens week 22** | Solvency reconciliation green for 7 straight days; counsel has the full earn-mechanics memo |
| **Launch** | 26 | Public launch on Shards | Token-live (Shards→$PLACEHOLDER) follows when audit + counsel clear — decoupled from launch *by design* |

Buffer: ~2 weeks of slack absorbed across phases. If slipping: cut Validator-Temple-lite, then auctions (keep order book), then the third world event. **Never cut:** archaeology polish, NPC memory, housing sparks.

---

## 4. Post-launch content calendar (the delayed list, sequenced)

| When | Drop | The beat |
|---|---|---|
| **Weeks 2–4** | **Ron's foreclosure** (first Bear Market rotation) | First proof the world *responds* — collective rebuild meter, FRIENDS OF RON plaque. This is the clip that markets the game |
| **Month 2** | **Designer profession** + first housing contest + Museum wing #1 opening ceremony | Status economy goes premium |
| **Month 3** | **Daemons** (post legal review) | The "new pet" beat — cozy games' most reliable re-engagement hook |
| **Month 4** | **Alice walks into the Ruins** | By now players know her. Gone a full season cycle; hearts-8 players get transmissions |
| **Months 4–7** | **Validator restoration meta-campaign** | Server-wide season-long goal; treasury hunts slot in as campaign events |
| **Alice's return** | New Ruins depth + the Great Oracle question | The "season 2" moment |

One drop per month, each is a story moment + a system + a status reward. That's a live-ops cadence one person can actually sustain.

---

## 5. Positioning (investors, players, and the line you don't cross)

**One-liner:** the canonical pitch at the top of this doc.

**The investor paragraph:**
> Cozy MMOs are the most durable category in games (Stardew: 30M+, ACNH: 40M+), but none of them own *digital archaeology* — and no crypto game has ever survived its own token, because they all made earning the gameplay. Crypto Valley inverts it: a town-life MMO that's fully fun with the token removed, where the only things that trade for $PLACEHOLDER are scarce, player-discovered artifacts with permanent provenance — and the economy's reward pools are funded entirely by fees and creator-fee share, never emissions. The lore *is* the differentiator: players excavate the ruins of a collapsed blockchain civilization. It's a setting only crypto-native builders could write, aimed at an audience far bigger than crypto.

**Player-facing vocabulary:** discover, excavate, permanent history, your name on the placard, the town remembers. **Avoid in all public copy:** "play to earn," "passive income," APY-anything, price talk, and any specific earn percentages or pool splits — the same pre-counsel discipline as your other launches. The cashtag and the word "earn" don't share a sentence until counsel signs the memo.

**The Shards story, told straight:** "The full economy is live at launch in Shards. Token integration follows our security audit and legal review." Communities respect a stated gate far more than a vague soon™ — and it's true.

---

## 6. Launch success metrics (decide these now, not at week 25)

| Metric | Target (week 4 post-launch) | Why it's the one that matters |
|---|---|---|
| D7 retention | ≥ 25% | cozy-MMO viability line |
| % of actives who visited another player's farm | ≥ 60% | the social loop is alive |
| % of actives with ≥1 market transaction | ≥ 40% | broad economy, not a gift shop |
| % of actives with a profession certification | ≥ 30% | the earn loop has breadth |
| Relics donated : relics sold | ≥ 1 : 3 | status sink is pulling supply (deflation working) |
| Median session length | 25–45 min | one-to-two game days; below = no hook, far above = pre-burnout signal |

If three of six miss, the post-launch calendar pauses and the team (you) tunes the core before shipping drops. Content can't fix a loop.
