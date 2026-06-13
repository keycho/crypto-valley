# CRYPTO VALLEY — ART BIBLE
**Direction: "Overgrown Terminal"** — a thousand-year-old machine, asleep under a garden, dreaming in purple.
Every sprite, shader, light, and UI panel answers to that sentence. This document is the authority for all visual sessions; reference it as `docs/art-bible.md` in every prompt that touches aesthetics.

---

## 1. The three laws

**LAW 1 — Warm base, cold ghosts.**
The world's default is Stardew-warm: golden light, earthy concrete, green overgrowth. The neon accents exist ONLY where dead technology is still faintly alive. Glow is scarce, therefore sacred. If a screenshot has more than ~3 glow sources outside an Oracle Zone, it's wrong.

**LAW 2 — Nature is winning, gently.**
Decay is rendered as a garden, not a wound. Weeds through pavement, trees through roofs, moss on machines, birds on antennas. Never bleak, never gory, never horror. Melancholy + warmth = the tone.

**LAW 3 — The glitch is archaeology, not style.**
Corruption FX are localized and meaningful: corrupted zones, relics, the Static, deep strata. Intensity scales with the corruption field and depth. NEVER a global filter. A glitch on screen means "the world's memory is misfiring here."

---

## 2. Palette

### 2.1 The warm base (world default — palette-shift target for LimeZu tiles)
| Role | Hex | Notes |
|---|---|---|
| Sunlit ground / paths | `#C8A06B` | golden sand-concrete |
| Concrete / asphalt | `#8C8276` | warm grey, never blue-grey |
| Deep earth / shadows | `#5C4A3D` | chocolate, not black |
| Overgrowth green (mid) | `#6FA05A` | the reclaiming green |
| Overgrowth green (deep) | `#3E6B43` | canopy/shade |
| Dry grass / wheat | `#D9B86A` | bear-market fields |
| Water | `#3D6E8F` warm-shifted, `#7FB6C9` highlights | never electric blue |
| Wood / structures | `#9C6B4A` | |
| Warm white (daylight) | `#F2E8D5` | paper, plaster, bones of buildings |

### 2.2 The cold ghosts (accents ONLY — tech that still lives)
| Role | Hex | Where it may appear |
|---|---|---|
| **Oracle purple** | `#8B5CF6` (core), `#C4B5FD` (bloom) | oracle tech, relics, the Static, Olivia's tower, deep strata |
| **Terminal green** | `#34D399` (core), `#A7F3D0` (bloom) | living screens, validators, data fragments, codex UI |
| **Signal cyan** | `#22D3EE` (core), `#A5F3FC` (bloom) | water-adjacent tech, antennas at night, daemon glow |
| Dead screen | `#1A1D24` | screens that DON'T work (most of them) |
| Static pink-noise | `#BE5CFF` at 30–60% | The Static wall only |

**Ratio law:** any given screen ≈ 90% warm base / ≤10% cold accents. Oracle Zones and deep ruins invert toward 60/40 — that inversion IS the eeriness.

### 2.3 Night palette
Night is NOT desaturated day. Ambient shifts to deep blue-violet (`#2B2640` ambient multiply), warm interior lights spill `#FFB769`, and the cold accents gain bloom radius. Night is when the dead city dreams — the few living machines become landmarks.

---

## 3. Lighting rules (Phaser pipeline)

1. **Day cycle ambient curve:** dawn `#FFD9A0` → noon `#FFF7EA` (near-neutral) → dusk `#FF9E6B` → night `#2B2640`. Lerp over the 20-min day; dusk is the hero window (screenshot time).
2. **Point lights:** warm sources (windows, lanterns, fires) radius 3–5 tiles, `#FFB769`. Cold sources (living tech) radius 2–3 tiles, their accent color, subtle pulse (sine, 3–5s period, ±15% intensity) — machines *breathe*, flames *flicker*.
3. **Interiors:** always warm-lit. Home is the safest-feeling place in the game.
4. **The corruption shader** (post-FX, zone-masked): chromatic aberration (offset scales with corruption 0→3px) + horizontal scanline displacement bursts (random, 0.2–0.6s apart at max corruption) + slight palette rotation toward purple. Applied via a corruption-field mask texture, never full-screen. Relic pickups trigger a 0.4s full-sprite glitch flash — the one sanctioned "loud" use.
5. **No bloom on warm lights.** Bloom is reserved for cold accents — it's how the eye learns "glow = old tech = investigate."

---

## 4. Zone mood sheets

| Zone | Base mood | Palette lean | Light signature | One image |
|---|---|---|---|---|
| **Town** | Lived-in civic square, hopeful | warmest in game | window-spill, string lights, ONE flickering public terminal | laundry lines between dead lamp posts |
| **Farm district** | Domestic, yours | warm + heavy green | your windows at night | crops in the shadow of a dead antenna tower |
| **Forest** | Soft, secretive | deep greens, gold shafts | god-rays day, glowcaps `#34D399` night | a server rack as a planter |
| **Mountain edge** | Open, wind, distance | grey-warm stone, dry grass | harsh clean daylight | solar farm glittering on a ridge |
| **Coast** | Wistful | sand + warm water | low sun glare | a half-sunken exchange sign in the shallows |
| **Oracle Zones** | Wrong, humming | 60/40 inversion, purple dominates | constant low pulse, shader at mid intensity | grass growing in perfect concentric circles |
| **Ruins L1–5** | Recent past, dusty | warm dark + green accents | your lantern + sparse live consoles | a desk with a mug, 1000 years of dust |
| **Ruins L16+** | Founding era, alien | cold dominates, warm is YOUR light only | shader near max, long shadows | architecture that predates the visual language above it |
| **The Static** | The edge of memory | `#BE5CFF` noise on `#1A1D24` | animated static, soft hum | a road that dissolves mid-stride |

---

## 5. Sprite & tile rules

- 16px grid, 16×32 characters. **Max 4 values per material ramp** (LimeZu-compatible) — painterly AA, no banding.
- **Outline rule:** characters/interactables get selective dark-warm outlines (`#3A2E26`); terrain has none. Readability without sticker-look.
- **Tech props age in three states** wherever feasible: dead (90% of instances, `#1A1D24` screens) / flickering (rare, animated 2–3 frames) / alive (story-placed only, full accent + light). The same vending machine sprite in three states is cheaper than three props and teaches the world's logic.
- **Overgrowth overlays:** a sheet of moss/vine/weed-crack decals designed to layer ON TOP of city tiles — this is how "nature winning" scales without redrawing the pack.
- **Animation economy:** grass sway (2f), water (4f), screen flicker (2–3f), accent pulse via light not frames. Stillness is part of the mood — a too-busy screen breaks "asleep."

## 6. UI direction

Diegetic-leaning: panels read as recovered terminal hardware — warm dark casing (`#2B2218`), `#F2E8D5` text, terminal-green for interactive/positive, oracle-purple for archaeology/codex, signal-cyan for social. LimeZu UI pack re-skinned via the same palette shift. Dialogue portraits in warm light always (people are alive; the world is what's asleep). Subtle 1px scanline texture on codex/relic panels only — UI glitch effects obey LAW 3 like everything else.

## 7. Commission brief (paste-ready for the pixel artist)

> Style target: Stardew Valley density, 16px grid, max-4-value ramps, selective dark-warm outlines on characters. World: cozy post-collapse — nature reclaiming dead tech, "Ghibli ruins meets Stardew." Palette file attached (sections 2.1–2.2 of this doc): warm earth base; neon purple/green/cyan ONLY as scarce living-tech accents.
> Deliverables, priority order:
> 1. Player base 16×32, 4-dir × 4-frame walk + 2-frame idle, in body/hair/outfit layers matching LimeZu generator conventions
> 2. 10 NPC portrait sets, 48×48, 3 expressions each (neutral/happy/troubled) — warm-lit, painterly
> 3. 3 surface landmarks (Validator Temple, Drowned Exchange, Genesis Observatory) as multi-tile structures, dusk-lit, one cold accent each
> 4. The Static: tileable 32×32 animated noise wall, 4 frames, `#BE5CFF`/`#1A1D24`
> 5. Overgrowth decal sheet (moss, vines, weed-cracks) designed to overlay urban tiles
> Reference images: [Stardew screenshot], [Hyper Light Drifter ruins], [the dithered bust glitch — brand language for corruption].

## 8. Forbidden list (the fastest art reviews ever)

✗ Rain-soaked neon streets / Blade Runner haze ✗ magenta-cyan as ambient color ✗ global glitch filters ✗ horror decay (gore, corpses, jump-scare darkness) ✗ electric-blue water ✗ blacklight UI ✗ more than 3 glow sources in a warm-zone screenshot ✗ sci-fi chrome — every machine here was built to be lived with, then abandoned mid-breakfast.

## 9. Pipeline integration

- **Palette-shift session (P5–P6):** batch remap LimeZu sheets to §2.1; script lives at `tools/palette-shift/`; mapping table checked into repo so new pack updates re-shift identically.
- **Lighting session:** implements §3 exactly; the ambient curve and light registry are content config, not code constants.
- **Every visual prompt** from now on includes: "Follow docs/art-bible.md — Laws 1–3 and the §2 palette are non-negotiable."
