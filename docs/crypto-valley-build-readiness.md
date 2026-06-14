# CRYPTO VALLEY — Build Readiness Pack
**Purpose:** everything to lock and prepare BEFORE the first Claude Code prompt, plus the CLAUDE.md and the M0 prompt sequence itself. Claude Code is only as good as the constraints it's given — this pack is the constraints.

---

## 1. Art direction & pipeline (decide this FIRST — it shapes the code)

The screenshot's look = 16px tiles, rich palette, heavy decoration layering, point-light night rendering. Code can replicate the *systems*; the tiles themselves are the bottleneck. Solo-dev plan, in order of leverage:

1. **Buy a coherent base pack, don't generate or commission the base.** Strong candidates to evaluate on itch.io (check current licenses before purchase): *LimeZu Modern Interiors/Exteriors* (huge, modern props — good for the modern age), *Sprout Lands* (farming/crops, very Stardew-warm), plus prop packs covering the other ages (rustic/medieval through future). One pack family = one coherent style; mixing packs is what makes indie games look like asset soup.
2. **Palette-shift to own it.** Define the Crypto Valley **Warm Ages** palette (earthy natural greens, warm browns, golden light) and a per-age remap (stone → bronze → … → future), then batch-remap the purchased tiles with a palette-swap script (Aseprite CLI or a 50-line script — Claude Code task). The per-age palette transformation IS the visual identity — see `docs/art-bible.md`.
3. **Commission only hero assets** (5–10 items): the 10 NPC portrait sets, a few age landmarks, the age-transition VFX, player character base + outfit layers, logo. ~Budget one commission batch.
4. **Age transitions as an effect, not tiles:** when land/the world advances an age, a Phaser post-FX flourish (a warm light-bloom + dust/pollen motes radiating from the upgraded structure) plays over normal tiles — the one sanctioned "loud" moment (art-bible §6), and it costs zero new art.

**Locked technical art constants (Claude Code needs these on day one):**
- Tile size: **16px**, render scale 3x (logical viewport ~427×240 → crisp at 1280×720)
- `pixelArt: true`, no antialiasing, integer camera positions
- Tiled (.tmj) maps; layer convention: `ground / ground_detail / collision / objects / above / lights`
- Texture atlases via free-tex-packer or TexturePacker; one atlas per category (terrain / props / characters / ui)
- Character: 4-direction, 4-frame walk, 16×32 sprite, layered (body/hair/outfit) for customization

---

## 2. Decisions to lock before prompting (the 10-minute checklist)

| Decision | Recommendation | Why now |
|---|---|---|
| Project codename in code | `crypto-valley` (rename later is cheap; cashtag/brand is a launch decision) | repo/package names everywhere |
| Tile size & zoom | 16px / 3x (above) | bakes into every map and sprite |
| Package manager / repo | pnpm workspaces + turborepo, single GitHub repo | Claude Code works dramatically better in a monorepo with shared types |
| DB host | Neon or Supabase Postgres (you know Supabase — use it) | connection strings in .env from day 1 |
| Deploy | Railway: `api`, `game-server`; Vercel: `web` | matches your stack; Vercel MCP already connected for deploys/logs |
| Realtime lib | Start with `ws` (simple), port to uWebSockets.js only if profiling demands | uWS has install friction; don't pay it at 100 CCU |
| ORM | Drizzle | SQL-first, great with Claude Code |
| World seed | Pick the production seed NOW in the sandbox (browse seeds until the surface screens look right), record it | the frozen surface gets hand-polished against ONE seed |
| Auth at M0 | Email magic link only; SIWS later | keeps M0 small |

**Do before first prompt:** create repo → drop the 6 spec docs + sandbox + worldgen-core.js into `/docs` → write CLAUDE.md (template below) → set up Neon/Supabase + Railway/Vercel projects → buy + unzip the asset pack into `/assets-src`.

---

## 3. CLAUDE.md (drop this at repo root, edit the bracketed bits)

```markdown
# Crypto Valley — agent instructions

Cozy 2D top-down multiplayer farming/building MMO. Stardew-like, themed around
advancing through the ages (Stone Age → year 3000). Phaser 3 + Next.js client,
Node WS game server, Fastify API, Postgres (Drizzle), Redis.

## Source of truth
Design docs live in /docs — READ THE RELEVANT DOC BEFORE IMPLEMENTING A SYSTEM:
- architecture & schema: docs/crypto-valley-mvp.md
- scope (what is IN/OUT of launch): docs/crypto-valley-scope-lock.md
- world generation: docs/crypto-valley-procedural-world.md (v3 header supersedes ring sizing)
- economy/token rules: docs/crypto-valley-token-addendum.md
Never implement anything on the DELAY list in scope-lock without being asked.

## Hard rules
- Server-authoritative: client never mutates inventory, currency, tiles, or quest
  state locally. All economy mutations go through packages/db helpers
  moveShards/moveItems/moveTokens which write ledger rows in the same transaction.
- packages/sim and packages/worldgen are PURE (no IO, no Date.now() — time is a
  parameter). They are imported by client AND server. Determinism is sacred:
  same seed + inputs = same outputs, always. Add a test when you touch them.
- No token/payment code outside packages/economy + apps/chain-worker.
  Everything is denominated in Shards until further notice.
- 16px tiles, pixelArt true, integer camera. Tiled layer names:
  ground/ground_detail/collision/objects/above/lights.
- TypeScript strict everywhere. Zod-validate every WS message and HTTP body.

## Workflow
- pnpm monorepo: apps/web, apps/api, apps/game-server, packages/{shared,sim,worldgen,db,content,economy}
- Conventional commits. One milestone task per PR-sized change.
- After schema changes: pnpm db:generate && pnpm db:migrate, commit the migration.
- Tests: vitest. packages/sim and packages/worldgen require tests; apps are
  smoke-tested via pnpm test:e2e (playwright) where present.
- Run pnpm typecheck && pnpm test before declaring any task done.

## Environment
- Postgres: [NEON/SUPABASE URL in .env, never committed]
- Deploy: web→Vercel, api+game-server→Railway. Don't deploy unless asked.
```

---

## 4. The M0→M1 prompt sequence for Claude Code

Run these as **separate sessions/tasks in order** — each is one reviewable unit with explicit acceptance criteria. Don't merge them into one mega-prompt; agents drift on mega-prompts.

**P0 — Monorepo scaffold**
> Scaffold the monorepo per CLAUDE.md: pnpm workspaces + turborepo with apps/web (Next.js 14, TS strict), apps/api (Fastify+Zod), apps/game-server (Node + ws), and empty packages/{shared,sim,worldgen,db,content}. Shared tsconfig/eslint in packages/config. Add pnpm scripts: dev (all), typecheck, test (vitest), db:generate/migrate (drizzle, postgres URL from env). Acceptance: pnpm install && pnpm typecheck && pnpm dev boots all three apps with hello-world endpoints.

**P1 — DB schema + helpers**
> Implement the Drizzle schema from docs/crypto-valley-mvp.md §2 (accounts→ledger tables only; skip token/auction tables for now). Generate the initial migration. Implement packages/db helpers moveShards(tx, characterId, delta, reason, ref) and moveItems(tx, ops[]) with row locking ordered by PK, ledger writes in-transaction, and vitest integration tests against a local postgres (docker-compose file included) covering: concurrent moveItems can't dupe, negative-balance shards rejected. Acceptance: tests pass.

**P2 — Phaser shell in Next.js**
> In apps/web, mount Phaser 3.80 via next/dynamic ssr:false on /play. Boot/Preload/World scenes. Load the placeholder Tiled map at assets/maps/town.tmj (create a 60x50 placeholder with the 6 standard layers using the tileset at assets-src/[PACK]). 16px tiles, 3x zoom, pixelArt:true, arcade physics, WASD+arrows movement with collision layer, y-sorted player vs 'above' layer. React HUD overlay (Zustand) showing a clock placeholder. Acceptance: walkable town in browser, 60fps, no sub-pixel jitter.

**P3 — Multiplayer presence**
> Implement the WS protocol from docs (hello/move/snap/chat subset) in packages/shared with Zod schemas. game-server: single Town room, 10Hz tick, validates speed+collision against the same .tmj, broadcasts dirty-entity snapshots. Client: connect with a dev token, send move intents max 15/s, interpolate remote players 100ms behind, local prediction with snap reconciliation. Zone-local chat with a minimal HUD chat box. Acceptance: two browser windows see each other move smoothly; chat works; server rejects a teleport-hack test message.

**P4 — Auth + persistence**
> Fastify: email magic-link auth (dev mode: log the link) creating accounts+characters rows; session cookie; GET /me; WS token endpoint minting 60s JWTs the game-server verifies. Persist character position on disconnect and every 30s. Acceptance: refresh the page, you're the same character in the same place.

**P5 — Worldgen package + sandbox parity**
> Port docs/worldgen-core.js to packages/worldgen as typed pure modules (seed.ts noise.ts biomes.ts regions.ts landmarks.ts history.ts) with vitest determinism tests (same-seed equality, known-seed snapshot checksums). Rebuild the dev sandbox at apps/web/dev/worldgen to import the package directly so the tool and the game can never drift. Acceptance: tests pass; sandbox renders identically to docs/worldgen-sandbox.html for seed [PROD_SEED].

After P5 you're at the end of week ~2 with the skeleton standing, and the next prompts follow the scope-lock roadmap (farm tiles → crops → energy → inventory…). Write each from the relevant doc section the same way: context pointer + task + acceptance criteria.

---

## 5. Claude Code working tips for this project
- Point it at ONE doc section per task ("implement §5.2 crops from docs/crypto-valley-mvp.md") — the docs were written to be consumed this way.
- Have it write the test first for anything in sim/worldgen/db; determinism and dupe-safety regress silently otherwise.
- Keep a running TODO.md it updates each session — cheap continuity between sessions.
- Review every migration by hand. Agents are great at schema, casual about indexes.
- When output drifts cozy→generic, paste the screenshot you just sent me into the session. A reference image re-anchors visual work better than any adjective.
