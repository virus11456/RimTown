#!/bin/bash
# 一支一支跑指定的測試，結果寫進一個檔（每支一行：名稱、通過/失敗數，失敗的項目列在下面，最後一行 ALLDONE）。
# 用法：bash scripts/tools/run-set.sh <埠> <結果檔> v111012_test.js v6950_test.js …
# 需要本機服務：cd chrome-extension && python3 -m http.server <埠>
# 同一台機器上有別人也在跑測試時，用同一把鎖排隊（LOCK 可換；不想排隊就設 LOCK=）。
port=$1; out=$2; shift 2; : > "$out"
cd "$(dirname "$0")/../.."
LOCK=${LOCK-/tmp/rimtown-test.lock}
for t in "$@"; do
  if [ -n "$LOCK" ]; then r=$(flock "$LOCK" env BASE=http://localhost:$port/ timeout 900 node "scripts/$t" 2>&1 | tail -60); else r=$(env BASE=http://localhost:$port/ timeout 900 node "scripts/$t" 2>&1 | tail -60); fi
  echo "$t :: $(echo "$r" | grep -E 'passed|通過' | tail -1) :: FAILS: $(echo "$r" | grep -cE '^FAIL|✗')" >> "$out"
  echo "$r" | grep -E '^FAIL|✗' | cut -c1-300 >> "$out"
done
echo ALLDONE >> "$out"
