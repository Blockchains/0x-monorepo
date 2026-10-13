#!/usr/bin/env node
/**
 * High-activity Kuru Flow trader for Monad mainnet.
 * Quotes + broadcasts repeated MON ⇄ USDC swaps to generate live on-chain usage.
 *
 * Env:
 *   MONAD_RPC_URL          (default https://rpc.monad.xyz)
 *   KURU_PRIVATE_KEY       0x-prefixed EOA key (required for live)
 *   KURU_TRADE_AMOUNT_MON  per-leg size in MON (default 0.05)
 *   KURU_LOOPS             round-trips (default 20)
 *   KURU_DRY_RUN           if "1", quote only (no broadcast)
 *   KURU_DELAY_MS          pause between legs (default 1500)
 *
 * Contracts: https://docs.kuru.io/contracts/Contract-addresses
 */
import { createWalletClient, createPublicClient, http, parseEther, formatEther, formatUnits, encodeFunctionData, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz';
const API = process.env.KURU_API_BASE_URL || 'https://ws.kuru.io/api';
const ENTRY = '0xb3e6778480b2E488385E8205eA05E20060B813cb';
const USDC = '0x754704Bc059F8C67012fEd69BC8A327a5aafb603';
const NATIVE = '0x0000000000000000000000000000000000000000';
const AMOUNT = parseEther(process.env.KURU_TRADE_AMOUNT_MON || '0.05');
const LOOPS = Number(process.env.KURU_LOOPS || '20');
const DELAY = Number(process.env.KURU_DELAY_MS || '1500');
const DRY = process.env.KURU_DRY_RUN === '1';

const chain = {
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

const erc20 = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function decimals() view returns (uint8)',
]);

async function token(user) {
  const r = await fetch(`${API}/generate-token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user_address: user }),
  });
  const j = await r.json();
  if (!j.token) throw new Error(`auth failed: ${JSON.stringify(j)}`);
  return j.token;
}

async function quote(user, tokenIn, tokenOut, amount) {
  const jwt = await token(user);
  const r = await fetch(`${API}/quote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ userAddress: user, tokenIn, tokenOut, amount: String(amount), autoSlippage: true }),
  });
  const j = await r.json();
  if (j.status !== 'success') throw new Error(`quote failed: ${j.message || JSON.stringify(j)}`);
  const cd = j.transaction.calldata.startsWith('0x') ? j.transaction.calldata : `0x${j.transaction.calldata}`;
  return { ...j, calldata: cd, to: j.transaction.to || ENTRY, value: BigInt(j.transaction.value || '0') };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const key = process.env.KURU_PRIVATE_KEY;
  if (!key && !DRY) {
    console.error('Set KURU_PRIVATE_KEY (or KURU_DRY_RUN=1 for quotes only).');
    process.exit(1);
  }

  const pub = createPublicClient({ chain, transport: http(RPC) });
  let account = null;
  let wallet = null;
  if (key) {
    account = privateKeyToAccount(key);
    wallet = createWalletClient({ account, chain, transport: http(RPC) });
  }
  const user = account?.address || '0x1111111111111111111111111111111111111111';

  console.log(JSON.stringify({
    mode: DRY ? 'dry-run' : 'live',
    user,
    amountMon: formatEther(AMOUNT),
    loops: LOOPS,
    entrypoint: ENTRY,
    chainId: 143,
  }, null, 2));

  let trades = 0;
  for (let i = 0; i < LOOPS; i++) {
    // MON -> USDC
    const buy = await quote(user, NATIVE, USDC, AMOUNT);
    console.log(`[${i + 1}/${LOOPS}] BUY quote minOut=${buy.minOut} value=${buy.value}`);
    if (!DRY) {
      const hash = await wallet.sendTransaction({ to: buy.to, data: buy.calldata, value: buy.value });
      const rc = await pub.waitForTransactionReceipt({ hash });
      console.log(`  buy tx ${hash} status=${rc.status}`);
      trades++;
    }
    await sleep(DELAY);

    // USDC -> MON (native out)
    const usdcBal = account
      ? await pub.readContract({ address: USDC, abi: erc20, functionName: 'balanceOf', args: [user] })
      : BigInt(buy.output || buy.minOut || '0');
    if (usdcBal === 0n) {
      console.log('  skip sell: zero USDC');
      continue;
    }
    // Ensure allowance for Flow entrypoint
    if (!DRY) {
      const allow = await pub.readContract({ address: USDC, abi: erc20, functionName: 'allowance', args: [user, ENTRY] });
      if (allow < usdcBal) {
        const data = encodeFunctionData({ abi: erc20, functionName: 'approve', args: [ENTRY, usdcBal] });
        const ah = await wallet.sendTransaction({ to: USDC, data });
        await pub.waitForTransactionReceipt({ hash: ah });
        console.log(`  approve tx ${ah}`);
      }
    }
    const sell = await quote(user, USDC, NATIVE, usdcBal);
    console.log(`[${i + 1}/${LOOPS}] SELL quote minOut=${sell.minOut} usdcIn=${formatUnits(usdcBal, 6)}`);
    if (!DRY) {
      const hash = await wallet.sendTransaction({ to: sell.to, data: sell.calldata, value: sell.value });
      const rc = await pub.waitForTransactionReceipt({ hash });
      console.log(`  sell tx ${hash} status=${rc.status}`);
      trades++;
    }
    await sleep(DELAY);
  }
  console.log(JSON.stringify({ done: true, trades, dryRun: DRY }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
