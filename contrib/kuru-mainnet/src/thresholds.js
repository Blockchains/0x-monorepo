import addresses from './addresses.json' with { type: 'json' };

/** High-activity agent trading thresholds for Kuru mainnet. */
export const KURU_AGENT_THRESHOLDS = addresses.agentThresholds;

export const KURU_MAINNET = {
  chainId: addresses.chainId,
  contracts: addresses.contracts,
  tokens: addresses.tokens,
  markets: addresses.markets,
  flow: addresses.flow,
  source: addresses.source,
};

export default KURU_MAINNET;
