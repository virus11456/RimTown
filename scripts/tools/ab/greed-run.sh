#!/bin/bash
# 11.11.0「窮與貪」改前改後對照：同一組種子各跑一次，結果一行一個寫進 OUT（跑過的種子會跳過，可以接著跑）。
# 用法：bash scripts/tools/ab/greed-run.sh http://localhost:8193/ base.jsonl     # 基準（發佈分支）
#       bash scripts/tools/ab/greed-run.sh http://localhost:8196/ new.jsonl      # 改後（claude/greed-1）
#       node scripts/tools/ab/greed-cmp.js base.jsonl new.jsonl                  # 每項平均±標準誤與差幾個標準誤
D="$(dirname "$0")"; LOCK=${LOCK-/tmp/rimtown-test.lock}
for s in 501 502 503 504 505 506 507 508; do
  if [ -n "$LOCK" ]; then flock "$LOCK" node "$D/greed-measure.js" "$1" "$2" $s >> "$2.log" 2>&1; else node "$D/greed-measure.js" "$1" "$2" $s >> "$2.log" 2>&1; fi
done
echo DONE >> "$2.log"
