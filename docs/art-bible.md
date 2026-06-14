# CRYPTO VALLEY — ART BIBLE
**Direction: "Warm Ages"** — a cozy world you advance through time, from the Stone
Age to the year 3000, rendered with Hyper-Light-Drifter discipline: a small, rich
palette, bold readable shapes, and strong atmospheric light. Earthy greens, warm
browns, golden light. Every sprite, shader, light, and UI panel answers to that
sentence. This document supersedes the prior "Overgrown Terminal / dead-civ"
direction and is the authority for all visual sessions; reference it as
`docs/art-bible.md` in every prompt that touches aesthetics.

> One-liner (use everywhere): _A cozy world you build across the ages — watch your
> land grow from a Stone-Age clearing into a golden future city._

---

## 1. The three laws

**LAW 1 — Cozy and warm, always.**
The world is inviting at every age. Earthy natural greens, warm browns, and golden
light are the spine; even the far future glows warm, never cold. Never grim, never
horror, never the rain-soaked-neon cyberpunk cliché. If a screenshot feels cold,
sterile, or bleak, it's wrong. Warmth is the brand.

**LAW 2 — Discipline over clutter (the Hyper Light Drifter rule).**
A deliberately *limited* but rich palette per scene; bold, instantly readable
silhouettes; generous negative space; light doing the heavy lifting. Few colors,
strong shapes, strong atmosphere. Restraint beats detail — a calm, composed frame
reads as quality. If a screen is busy, noisy, or has muddy mid-values, it's wrong.

**LAW 3 — Light is the atmosphere.**
Mood comes from lighting and painterly depth, not from filters. Strong ambient +
directional light, layered depth (foreground / mid / far with gentle atmospheric
haze), and bloom *only where earned*. Post-processing is scarce, local, and
purposeful — **never a global screen filter**. A frame should feel lit, not
processed.

---

## 2. THE AGES — the visual identity

The game's theme is **ADVANCE THROUGH THE AGES.** Land and players progress through
six eras, and **each age has its own disciplined palette.** As a region advances,
its tiles, structures, foliage, and lighting all shift to the next age's palette —
**this transformation is the wow, and the core of the brand.** The same composed,
cozy frame, re-coloured era by era, is the thing players screenshot and share.

Each age keeps the LAW-1 warm spine (greens, browns, golden light) but leans its
own way. Palettes below are *targets* — limited sets of ~6, HLD-tight:

| Age | Lean | Ground | Structures | Foliage | Light signature | Signature accent | One image |
|---|---|---|---|---|---|---|---|
| **1 · Stone** | earthy ochre | `#C9A368` tan-ochre | `#8A6A45` mud & timber | `#7E8A5A` sage | low warm sun, big shadows | ember firelight `#E08A3C` | a thatched hut by a fire in a golden clearing |
| **2 · Bronze** | terracotta | `#C06A45` terracotta | `#9A5A3A` fired clay | `#6E7A40` olive | dusty gold haze | bronze glint `#D9A24E` | a clay ziggurat catching the last sun |
| **3 · Medieval** | mossy green-grey | `#7E8470` moss-stone | `#6E4E38` weathered wood, `#54584E` slate | `#3E5240` deep moss | overcast soft + torchlight | torch amber `#E89A4C` | a mossy keep, banners, warm windows at dusk |
| **4 · Industrial** | soot & amber | `#5A524A` soot | `#8A4E3A` brick, `#46423E` iron | `#5E6A48` scrub | smog-ochre sky, gaslight | furnace amber `#F09A3C` | brick chimneys and warm gaslamps under amber smog |
| **5 · Modern** | warm concrete & glass | `#B8AE9C` warm concrete | `#6E6A62` steel, `#8FB0B4` warm glass | `#6E8C52` park green | window-spill, one warm sign | warm signage `#F0844C` | a plaza of warm-lit glass towers at golden hour |
| **6 · Future (≈3000)** | **warm** neon | `#B0A488` bio-concrete | `#EDE4CE` bone-white forms | `#5EA06A` living green | soft global glow, warm bloom | amber `#FFB24C`, rose `#F06A8C`, bio-green `#7BE0A0` | a luminous garden-city — neon that feels like sunrise, not Blade Runner |

**Future age rule:** the future is **warm-neon** — golds, warm rose, living green.
Cold electric cyan/blue may *accent* but must never dominate; year 3000 is hopeful
and lush, the opposite of cold cyberpunk.

---

## 3. The base palette (the warm spine across all ages)

Shared natural anchors every age tints from. Keep ramps to **max 4 values per
material** — painterly, no banding.

| Role | Hex | Notes |
|---|---|---|
| Sunlit ground / path | `#C2A878` | warm tan; never grey-cold |
| Earth / wood (warm brown) | `#8A5A3C` (mid), `#4E342A` (deep) | the brown spine |
| Foliage green (natural) | `#6E8C52` (mid), `#3E5B3A` (deep), `#A7B86A` (highlight) | earthy, olive-leaning — NOT neon |
| Dry grass / wheat | `#D9B86A` | warm fields |
| Stone | `#9A9082` warm grey | warm, never blue-grey |
| Water | `#5C8AA6` warm-shifted, `#9FC6D6` highlights | never electric blue |
| Golden light | `#F2C879` | the signature glow |
| Warm white | `#F5ECD6` | plaster, paper, bone of buildings |
| Warm shadow / outline | `#2E2018` | near-black, warm — never pure black |

**Accent discipline:** accents (an age's signature colour, a sign, a fire) are
*scarce by law* — roughly **≤10% of any frame.** Scarcity is what makes a glow
read as special. Bloom is reserved for true light sources, never for flat fills.

---

## 4. Lighting & atmosphere (Phaser pipeline)

1. **Day-cycle ambient curve** (lerped over the in-game day): dawn `#FFD9A0` → noon
   `#FBF1DA` (near-neutral, slightly warm) → dusk `#FF9E6B` → night `#2B2A40`
   (deep warm blue-violet). **Dusk and dawn are the hero windows** (screenshot
   time). Each age tints this curve toward its lean.
2. **Painterly depth:** separate fore / mid / far; far layers get a faint warm
   atmospheric haze and slightly lower contrast so the world feels deep, not flat.
   Parallax is subtle.
3. **Point lights:** warm sources (windows, fires, lanterns) radius 3–5 tiles,
   `#FFB769`, gentle flicker. Age accents (a furnace, a future sign) get their
   colour with a slow sine pulse (3–5 s, ±15%). Interiors are **always** warm-lit —
   home is the safest-feeling place in the game.
4. **Bloom is earned:** only real light sources bloom. No bloom on flat colour.
5. **Post-FX is local and rare** (LAW 3): no global screen filters. Any effect
   (heat-shimmer over a forge, a shimmer on a future field) is zone-masked and
   subtle. The "age transition" may use a brief, sanctioned full-frame flourish
   (see §6) — that is the one loud moment, and it is warm.

---

## 5. Shape & sprite rules

- **Silhouette first.** A structure must be recognisable as a black shape before
  any detail. Bold, chunky, readable forms (HLD/Stardew density) over fussy detail.
- 16px grid; 16×32 characters. **Max 4 values per material ramp.** Selective
  dark-warm outline (`#2E2018`) on characters and interactables; terrain gets none.
- **Read at zoom-out too.** Because land zooms out to a canvas (§7), every
  structure needs a clean, distinct top-down "footprint colour" that stays legible
  when it's only a few pixels — pick the footprint hue deliberately.
- **One asset, many ages.** Author each tile/structure once in the base palette,
  then the palette-shift pipeline (§9) remaps it per age. The remap *is* the
  identity, so author with clean, separable value ramps that re-tint cleanly.
- **Animation economy:** grass/banners sway (2f), water (4f), fire/accent flicker
  (2–3f), pulse via light not frames. Stillness is part of the calm — a too-busy
  screen breaks the mood.

## 6. Age transitions (the spectacle)

Advancing an age is the headline moment. When a region levels up:
- the tiles/structures cross-fade from the old age's palette to the new one
  (a short sweep, ~0.6–1.0 s, ideally radiating from the upgraded structure);
- a brief warm light-bloom + dust/pollen motes sell the "time leaps forward";
- new-age structure silhouettes swap in on the same footprints.
This is the single sanctioned "loud" effect, and it is warm and celebratory —
never a glitch. Design every age's assets so a frame looks deliberately composed
*immediately after* the transform.

## 7. Land as canvas (planned feature — design for it now)

Land is claimable in **small units** (fine-grained parcels, finer than a building
footprint), and the world supports a **zoom-out canvas view** where all claimed
land renders as a top-down mosaic. Players (and brands) place coloured
tiles/structures to **spell words, draw pixel art, or render project logos** in
their claimed land — a living, player-painted map. This is also the **B2B
advertising** surface: a project can claim a region and display its logo to
everyone who zooms out.

Art implications, bake them in:
- **A constrained per-parcel palette** (a small, curated swatch set) so the
  aggregate mosaic stays cohesive and on-brand instead of a rainbow mess — the
  canvas should look like *this game*, even when crowd-authored.
- **Footprint-legible assets** (§5): each placeable reads as one clean colour block
  at canvas zoom.
- **Two render targets per scene:** the immersive close diorama AND the clean
  zoom-out mosaic; structures must look intentional in both. Grid/parcel lines are
  faint and warm at zoom-out, never harsh.
- Keep it cozy and tasteful at scale — restraint (LAW 2) applies to the crowd
  canvas too; tools should nudge toward harmony (limited palette, snapping).

## 8. UI direction

Cozy, warm, and disciplined. Panels are warm dark casing (`#2B2218`) with
`#F5ECD6` text; the active age's signature colour is the highlight/positive accent,
so the UI itself shifts subtly with the era. Few elements, generous spacing, strong
hierarchy — the same restraint as the world. Dialogue/portraits always warm-lit
(people are alive and hopeful). No blacklight UI, no cold chrome.

## 9. Pipeline integration

- **Palette-shift per age:** author in the §3 base palette; `tools/palette-shift/`
  holds a remap table **per age** (base → age palette). One sprite set renders all
  six ages via remap; the table is checked into the repo so re-runs are
  deterministic. This pipeline is the literal implementation of the §2 identity.
- **Lighting/atmosphere:** the ambient curve, per-age tint, and light registry are
  content config, not code constants.
- **Land canvas:** the zoom-out mosaic renderer + the constrained parcel palette
  are first-class deliverables, designed alongside the close-up art.
- **Every visual prompt** from now on includes: "Follow docs/art-bible.md — Laws
  1–3, the current age's §2 palette, and the §3 warm spine are non-negotiable."

> **Implementation note:** the codebase currently still ships the legacy warm
> "Overgrown Terminal" palette (warm earth base + scarce green/purple/cyan tech
> accents) from the prior direction. Reskinning the live assets to this "Warm
> Ages" direction — and standing up the per-age palette-shift + the land-canvas
> renderer — is a dedicated future art pass; this doc is the target it migrates to.

## 10. Commission brief (paste-ready)

> Style target: cozy top-down pixel art, 16px grid, max-4-value ramps, selective
> dark-warm outlines on characters; **Hyper Light Drifter discipline** (limited
> rich palette, bold readable silhouettes, strong atmospheric light) meets Stardew
> warmth. Theme: **advance through the ages** (Stone → year 3000); deliver each
> asset so it re-tints cleanly per age (palette tables attached, §2/§3). Warmth is
> mandatory — the future is warm-neon, not cold cyberpunk.
> Deliverables, priority order:
> 1. Player base 16×32, 4-dir × 4-frame walk + 2-frame idle, layered to match the
>    LimeZu generator conventions.
> 2. One "age set" pilot: a hut/house/tower footprint rendered in all six age
>    palettes (proves the transformation identity).
> 3. Ground + foliage tilesets in the §3 base palette, authored for clean per-age
>    remap.
> 4. The land-canvas swatch set + a sample zoom-out mosaic spelling a word.
> 5. Age-transition VFX frames (warm bloom + motes).
> Reference: [Hyper Light Drifter palettes & light], [Stardew warmth & density],
> [a clean pixel mosaic / r/place-style canvas for the land feature].

## 11. Forbidden list (the fastest art reviews ever)

✗ Cold cyberpunk / Blade Runner rain-neon ✗ electric cyan or blue as an ambient
dominant ✗ global screen filters or post-process haze over the whole frame ✗ grim,
bleak, or horror decay (gore, corpses, jump-scare darkness) ✗ muddy mid-value
clutter / busy frames (LAW 2) ✗ rainbow/garish land-canvas (use the constrained
swatch set) ✗ pure-black shadows (use warm near-black `#2E2018`) ✗ sci-fi chrome
sterility — even the year 3000 is a place you'd want to live.
