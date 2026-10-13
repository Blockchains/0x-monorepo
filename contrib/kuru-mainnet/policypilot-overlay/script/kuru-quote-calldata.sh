#!/usr/bin/env bash
# Print Kuru Flow calldata for MON -> USDC (for forge fork tests / debugging).
# Usage: ./script/kuru-quote-calldata.sh [userAddress] [amountWei]
set -euo pipefail
USER="${1:-0x1111111111111111111111111111111111111111}"
AMT="${2:-100000000000000000}"
TOKEN=$(curl -s -X POST https://ws.kuru.io/api/generate-token \
  -H 'content-type: application/json' \
  -d "{\"user_address\":\"${USER}\"}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
curl -s -X POST https://ws.kuru.io/api/quote \
  -H 'content-type: application/json' \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"userAddress\":\"${USER}\",\"tokenIn\":\"0x0000000000000000000000000000000000000000\",\"tokenOut\":\"0x754704Bc059F8C67012fEd69BC8A327a5aafb603\",\"amount\":\"${AMT}\",\"autoSlippage\":true}" \
| python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("status")=="success", d; cd=d["transaction"]["calldata"]; print(cd if cd.startswith("0x") else "0x"+cd)'
