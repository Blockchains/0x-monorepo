/** Kuru mainnet contracts + Flow quote helpers.
 * Source: https://docs.kuru.io/contracts/Contract-addresses
 */
import type { Address, Hex } from 'viem';

export const KURU_API = 'https://ws.kuru.io/api';
export const MONAD_CHAIN_ID = 143;

/** Official Kuru mainnet addresses (docs.kuru.io). */
export const KURU = {
  flowEntrypoint: '0xb3e6778480b2E488385E8205eA05E20060B813cb' as Address,
  flowRouter: '0x0d3a1BE29E9dEd63c7a5678b31e847D68F71FFa2' as Address,
  forwarder: '0x974E61BBa9C4704E8Bcc1923fdC3527B41323FAA' as Address,
  marginAccount: '0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5' as Address,
  monadDeployer: '0xe29309e308af3EE3B1a414E97c37A58509f27D1E' as Address,
  router: '0xd651346d7c789536ebf06dc72aE3C8502cd695CC' as Address,
  markets: {
    monAusd: '0x131a2e70a5b31a517a74b8c567149bc294470da9' as Address,
    monUsdc: '0x065C9d28E428A0db40191a54d33d5b7c71a9C394' as Address,
  },
} as const;

/** Observed Flow aggregator selector (native + ERC-20 swaps). Output credits msg.sender. */
export const KURU_FLOW_SWAP_SELECTOR = '0xce1e7030' as Hex;

export type KuruQuote = {
  status: 'success' | 'error' | string;
  output: string;
  minOut: string;
  message?: string;
  transaction: { to: Address; calldata: string; value: string };
};

export async function kuruToken(userAddress: string): Promise<string> {
  const r = await fetch(`${KURU_API}/generate-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_address: userAddress }),
  });
  if (!r.ok) throw new Error(`Kuru auth failed (${r.status})`);
  const j = await r.json();
  if (!j.token) throw new Error('Kuru auth: missing token');
  return j.token as string;
}

export async function kuruQuote(args: {
  userAddress: string;
  tokenIn: Address | string;
  tokenOut: Address | string;
  amount: bigint | string;
  autoSlippage?: boolean;
  slippageTolerance?: number;
}): Promise<KuruQuote> {
  const token = await kuruToken(args.userAddress);
  const r = await fetch(`${KURU_API}/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      userAddress: args.userAddress,
      tokenIn: args.tokenIn,
      tokenOut: args.tokenOut,
      amount: String(args.amount),
      autoSlippage: args.autoSlippage ?? true,
      ...(args.slippageTolerance != null ? { slippageTolerance: args.slippageTolerance } : {}),
    }),
  });
  const j = (await r.json()) as KuruQuote;
  if (!r.ok || j.status !== 'success' || !j.transaction?.calldata) {
    throw new Error(j.message || `Kuru quote failed (${r.status})`);
  }
  return j;
}

export function kuruCalldata(quote: KuruQuote): Hex {
  const c = quote.transaction.calldata;
  return (c.startsWith('0x') ? c : `0x${c}`) as Hex;
}
