# CRYPTO VALLEY — $PLACEHOLDER Token Economy Addendum
**Supersedes:** §0 hard-rule #4 and §7.4 of the base doc. Everything else in the base doc stands.
**New design law:** Tokens amplify the game; they must never *be* the game. Players who never touch $PLACEHOLDER still get 100% of content. Players who do are trading **scarcity**, not buying **power**.

---

## 0. The uncomfortable math first (read before building)

Every dead P2E game (Axie, STEPN, DeFi Kingdoms at peak) died the same way: **emissions paid to players > value entering from buyers** → sell pressure → price ↓ → "earnings" ↓ → players leave → repeat. The earn loop was the retention loop, so when earning died, the game died.

Crypto Valley inverts this with three structural rules:

1. **No emissions faucet.** The server never prints $PLACEHOLDER as a reward from thin air on a schedule. Every token a player earns was *spent into the economy by another player* (fees, sinks, entries) or comes from a fixed, decaying rewards reserve with a hard floor.
2. **Earning is skill/scarcity-based, not time-based.** Grinding produces *items*; items are only worth tokens if other players want them. The market sets earnings, not the faucet. Bots can grind items, but botted commodity items crash their own price — the system is partially self-balancing.
3. **The fun loop (base doc §5) is the retention engine.** If token price goes to zero, the game is still Stardew-with-friends. That's the survival property no pure P2E game has.

If we can't hold these three, the honest move is to ship without the token.

---

## 1. Dual-currency economy

| | **Bits ⓑ (soft)** | **$PLACEHOLDER (hard, SPL token)** |
|---|---|---|
| Source | In-game faucets (crops, quests, NPC sales) | Bought on DEX, earned via player-to-player flows & reward pools |
| Used for | All core progression: seeds, tools, building, NPC shops, daily life | Premium marketplace tier, auctions for **rare/unique** items, cosmetics, land naming, event entries |
| Tradeable for the other? | **No direct ⓑ↔token swap, ever.** | — |
| Cap | Uncapped, sink-balanced | Fixed supply, deployed before launch |

The firewall between the currencies is the anti-pay-to-win mechanism. You can't buy bits with tokens, so you can't buy progression. What trades in $PLACEHOLDER is the stuff bits can't price: provenance relics, one-of-N event drops, cosmetics, land deeds.

### What players actually do with $PLACEHOLDER (the "play to earn, buy and sell" loop)

```
        EARN                          SPEND / BUY
  ┌──────────────────┐         ┌──────────────────────┐
  │ Sell rare relics  │         │ Buy relics/cosmetics │
  │ Sell 1/N drops    │  ◄────► │ on token marketplace │
  │ Sell cosmetics    │ player- │ Bid in auctions      │
  │ Quest tournaments │ to-     │ Festival entries     │
  │ Event leaderboards│ player  │ Land naming/banners  │
  │ Crafting commissions│       │ Commission crafters  │
  └──────────────────┘         └──────────────────────┘
            ▲                              │
            │   2.5% marketplace fee       ▼
            │  ┌───────────────────────────────┐
            └──┤ 50% → weekly reward pools      │
               │ 30% → treasury (ops/liquidity) │
               │ 20% → burn                     │
               └───────────────────────────────┘
```

**Earn surfaces, concretely:**

1. **Relic & rare-drop sales** (primary). Archaeology, deep ruins, Validator Temple, world events produce items with hard global scarcity (per-day seeded caps, e.g. 14 relics/day worldwide regardless of player count). Scarce + provenance-stamped + only tradeable in $PLACEHOLDER = a real collector market. *Earning = playing well and being early to discoveries.*
2. **Weekly quest tournaments.** Seasonal leaderboards (most festival points, archaeology score, crop-quality contest). Prize pool = 50% of the week's marketplace fees + a decaying slice of the rewards reserve. Pool is **fee-funded**, so payouts scale with real economic activity — it can never outrun inflows.
3. **Crafting commissions.** Master crafters (Crafting 40+) can fulfill player-posted commissions priced in tokens — a profession economy, RuneScape-style.
4. **Event leaderboards.** Meteor mining contribution, Oracle repair speedruns. Small pools, fee-funded.

**Deliberately absent:** daily login token rewards, token-per-crop, token-per-action. Those are the emissions that kill games. (xploited's staked-lobby model is different — that's peer-staked, zero-sum per round; the same peer-funded principle is what we're applying here.)

---

## 2. Token design — $PLACEHOLDER is a pump.fun launch

This changes the tokenomics section entirely. pump.fun gives you: 1B fixed supply, all of it minted into the bonding curve at launch, no vesting, no allocation mechanics, mint authority handled by the platform, graduation to PumpSwap once the curve fills. You don't design the tokenomics — you design *around* them.

| Reality of pump.fun | Consequence for the game |
|---|---|
| No team/treasury/rewards allocation exists | The only way to hold a reserve is the **dev buy at launch** — fully visible on-chain, so size it for credibility (large dev buys get flagged as exit setups). Whatever the game treasury holds, publish the address day one. |
| **Creator fee share** on trading volume | This is your actual sustainable funding source. Route creator fees → treasury multisig → split: tournament prize pools / ops / periodic burns. It's the pump.fun-native version of the fee-funded reward pool — pools scale with *speculative* volume, not just in-game volume. Make this split public and automatic. |
| Price = pure meme velocity, ±90% weeks are normal | Denominate everything in-game in **token units, never USD**. Scarcity caps and auction dynamics absorb volatility; a relic is "worth 2M $PLACEHOLDER" by player consensus, and the game doesn't care what that is in dollars. No in-game system may reference a USD price feed. |
| Token exists (or trades) before the game does | The Shards→token swap plan in §5 still holds, but expect the community to front-run it. Announce the *mechanism* (in-game marketplace tier) early, the *date* late. |
| Anyone can buy the float | Whale-proofing now matters more: token-tier items are auction/scarcity-priced (whales bid up cosmetics — fine, that's the point), and the bits firewall keeps them out of progression entirely. |

**Reward pool design, pump.fun edition:** weekly tournament pool = (creator fee share routed to pools) + (50% of in-game marketplace fees). Both inputs are demand-funded — zero emissions, the death-spiral math from §0 still holds. Burns come from the 20% fee slice plus named sinks, executed as visible on-chain burns from the treasury (the burn ticker in the Marketplace zone now shows real txs).

**What you lose vs. a designed launch:** no lockups means nothing stops early snipers from owning supply, and no rewards reserve means the first weeks' prize pools are funded purely by your dev-buy treasury and early creator fees — budget for thin pools until volume exists. What you gain: instant liquidity, a community that arrives before the game, and zero "when token" pressure.

---

## 3. On-chain ↔ in-game architecture

The base doc's rule survives: **no gameplay request awaits an RPC.** Tokens enter and exit through an airlock.

```
Wallet (player custody)                     Game (server custody)
┌──────────────────┐   deposit (transfer    ┌──────────────────────┐
│ $PLACEHOLDER ATA  │ ──to vault + memo)──► │ token_balances (DB)   │
│                  │                        │  - instant in-game    │
│                  │ ◄──withdraw (queued,── │  - marketplace trades │
└──────────────────┘    rate-limited,       │    settle in DB, free │
                        2FA, hot-wallet     │    & instant          │
                        limits + timelock)  └──────────────────────┘
```

- **Deposits:** player transfers to a program-owned vault with their character memo (or per-user derived deposit address). Helius webhook → chain-worker credits `token_balances` after N confirmations. ~30s, one-time per top-up.
- **In-game trades settle off-chain** in the DB ledger — instant, feeless, dupe-protected by the same `moveBits`-style helper (`moveTokens(tx, …)` + append-only `token_ledger`). This is what makes an auction house *fun* (no wallet popup per bid).
- **Withdrawals:** queued BullMQ job, daily per-account limits, large withdrawals (>X) go through a 24h timelock + manual review. Hot wallet holds <5% of vault; rest in multisig cold storage (Squads).
- **Solvency invariant:** `SUM(token_balances) + pending_withdrawals == vault_onchain_balance`, checked by a reconciliation job every 10 min; mismatch = automatic withdrawal freeze + page.

### Schema additions

```sql
CREATE TABLE token_balances (
  character_id uuid PRIMARY KEY REFERENCES characters(id),
  amount       bigint NOT NULL DEFAULT 0 CHECK (amount >= 0)   -- 6dp base units
);

CREATE TABLE token_ledger (        -- append-only, mirrors `ledger`
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  character_id uuid NOT NULL,
  delta bigint NOT NULL,
  reason text NOT NULL,            -- deposit|withdraw|sale|purchase|fee|prize|burn_sink
  ref uuid, at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE token_transfers (     -- chain airlock
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  character_id uuid NOT NULL,
  direction text NOT NULL,         -- deposit|withdraw
  amount bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|confirmed|review|failed
  tx_sig text, dest_address text, review_reason text
);

ALTER TABLE market_listings ADD COLUMN currency text NOT NULL DEFAULT 'bits'; -- bits|token
ALTER TABLE auctions        ADD COLUMN currency text NOT NULL DEFAULT 'bits';
-- token listings allowed only for item_defs.meta->>'tokenTier' = 'true' (rare/cosmetic whitelist)
```

---

## 4. The new threat model (real money changes everything)

The moment items sell for tokens, you're running a target, not a game. Budget for this — it's now the largest engineering line item after the game itself.

| Threat | Mitigation |
|---|---|
| **Bot farms grinding sellables** | Hard global scarcity caps on token-tier drops (botting commodity items only crashes bits prices); drop weighting by account age + quest progress + heart levels (expensive to fake); behavioral detection on action cadence; device/IP clustering |
| **Sybil tournament farming** | Entry requirements (account age, skill levels); prize curves flat at the tail; one prize per device/payment cluster |
| **Dupe bugs** | Single mutation helpers + append-only ledgers (already designed); now add: invariant checker job (global item counts vs expected), canary items, bug bounty before mainnet |
| **Account theft** | Withdrawal address allowlist with 48h add-delay; email confirm on withdrawals; session invalidation on password/wallet change |
| **Vault compromise** | Hot/cold split, Squads multisig, withdrawal rate limits, reconciliation freeze |
| **RMT outside the game** | Don't fight it hard — the token *is* the sanctioned RMT channel; fight account-sharing for tournament prizes only |
| **Insider risk** | No admin endpoint can mint balances; treasury ops on-chain via multisig only |

---

## 5. Legal flags — these now gate the roadmap, not just the copy

I'm not a lawyer and this needs real counsel before TGE or any earn mechanic goes live — same gate you're holding xploited's staked lobbies behind, and the surfaces here are bigger:

1. **Securities exposure:** a token whose marketing says "play to earn" invites the strongest possible Howey framing (expectation of profit from the efforts of others). Positioning, allocation, and team-sale lockups need counsel sign-off; marketing copy doubly so.
2. **Money transmission / VASP:** the custodial deposit-withdraw vault (§3) looks like custody of customer funds. Depending on jurisdiction this can trigger licensing or force a non-custodial redesign (escrow program per trade — slower UX, cleaner law).
3. **Gambling surfaces:** tournament entry fees + prize pools, and Memelon-style RNG-quality crops *sold for tokens*, both need review. Entry-fee tournaments may need to become free-entry/sponsored-pool.
4. **KYC/AML & geo-fencing:** withdrawal thresholds will likely require KYC; certain jurisdictions need blocking at the token layer.
5. **Tax reporting** obligations on player earnings in some jurisdictions.

**Concrete sequencing consequence:** ship the entire game with the token-tier marketplace running on a **testnet/points placeholder** ("Shards") through beta. Swap Shards → $PLACEHOLDER only after counsel clears the structure. Zero gameplay rework, full legal optionality, and you get real economy telemetry before real money touches it.

---

## 6. Updated roadmap delta

| Milestone | Change |
|---|---|
| M4 · Economy | Add `currency` dimension to market/auctions; token-tier item whitelist; `token_balances` + ledgers; everything denominated in **Shards** (off-chain points) |
| **M5.5 · Earn loops** (new, +2 wks) | Weekly tournaments, fee→pool→payout pipeline, commissions board, scarcity caps, anti-bot v1 |
| M6 · Solana | Adds: vault program (or per-user deposit addresses), deposit/withdraw airlock, reconciliation job, Squads multisig setup — **devnet** |
| **M7 · Hardening** (new, +3 wks) | Economy fuzz/load tests, bug bounty, withdrawal review tooling, KYC vendor integration, legal review window |
| **TGE** | Only after M7 exit + counsel sign-off. Shards convert 1:1 or snapshot-airdrop — decide with counsel |

Net: **12 → ~17 weeks** to token-live, but playable-game timeline is unchanged — the token rides behind the game, never in front of it.

---

## 7. The pitch line that survives both audiences

> *Cozy MMO where everything you find is really yours, the rarest things you discover trade for real value, and none of it is for sale to whales.*

Earned scarcity → player-to-player demand → fee-funded rewards. The token economy is downstream of the game being good — which is the only configuration in which both survive.
