# Kuru mainnet (live) — high-threshold agent trading

Official Monad mainnet contracts from [docs.kuru.io/contracts/Contract-addresses](https://docs.kuru.io/contracts/Contract-addresses), plus tooling so an agent can drive **max real active Flow trading** on Kuru.

> Kuru is a **spot** CLOB + Flow aggregator (not perpetual futures). “Wild trading” here means high-frequency / high-size spot Flow volume.

## Live contracts (chain 143)

| Contract | Address |
| --- | --- |
| KuruFlowEntrypoint | `0xb3e6778480b2E488385E8205eA05E20060B813cb` |
| KuruFlowRouter | `0x0d3a1BE29E9dEd63c7a5678b31e847D68F71FFa2` |
| KuruForwarder | `0x974E61BBa9C4704E8Bcc1923fdC3527B41323FAA` |
| MarginAccount | `0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5` |
| MonadDeployer | `0xe29309e308af3EE3B1a414E97c37A58509f27D1E` |
| Router (market factory) | `0xd651346d7c789536ebf06dc72aE3C8502cd695CC` |

Tokens: WMON, AUSD, USDC. Markets: MON-AUSD, MON-USDC. Full JSON: `src/addresses.json`.

Flow swap selector observed on mainnet: `0xce1e7030` (output credits **msg.sender**).

## High thresholds (agent / vault)

See `agentThresholds` in `src/addresses.json`:

- Vault / global deploy caps up to **100 / 10_000 MON** (for a new factory)
- Token approval caps: **1,000,000 USDC/AUSD**, **100 WMON**
- Wild trader defaults: **0.05 MON** legs × **20** loops

## Wild trader (live usage)

```bash
cd contrib/kuru-mainnet
npm install
export MONAD_RPC_URL=https://rpc.monad.xyz
export KURU_PRIVATE_KEY=0x...          # funded Monad mainnet key
export KURU_TRADE_AMOUNT_MON=0.05
export KURU_LOOPS=20
npm run trade:wild
```

Dry-run quotes only:

```bash
KURU_DRY_RUN=1 KURU_LOOPS=3 npm run trade:dry
```

## PolicyPilot overlay

This agent run is attached to `0x-monorepo`, but the product that needed Kuru enabled is **PolicyPilot** (`Blockchains/policypilot-monad`). Push to that repo was denied for this token.

Apply the enablement there with either:

1. **Overlay copy** — copy files from `policypilot-overlay/` onto a PolicyPilot checkout (paths match the repo layout), or  
2. **Patch** — `git apply contrib/kuru-mainnet/policypilot-monad-kuru.patch` inside `policypilot-monad`.

That overlay:

- Marks **Kuru live** in `web/src/lib/services.ts` + `frontend/dapps.json`
- Raises token caps + launch defaults toward factory vaultCap
- Adds agent **📈 Kuru** action via Flow quotes
- Allows factory deploy up to 100 MON vault / 10k global
- Adds fork test `AgentVaultForkKuruTest` + `executor/kuru-wild-trader.mjs`

Verified on a Monad fork: Flow entrypoint has code; vault allowlist of `0xce1e7030` works; live API quotes MON⇄USDC successfully.
