#!/bin/bash
# v11.13.0「工作與求職」改前改後對照：同一組種子各跑一次，結果一行一個寫進 OUT（跑過的種子會跳過，可以接著跑）。
# 用法：bash scripts/tools/ab/jobs-run.sh http://localhost:8189/ base.jsonl     # 基準（v11.12.2）
#       bash scripts/tools/ab/jobs-run.sh http://localhost:8198/ new.jsonl      # 改後（claude/jobs-1）
#       node scripts/tools/ab/jobs-cmp.js base.jsonl new.jsonl                  # 每項平均±標準誤與差幾個標準誤
D="$(dirname "$0")"; LOCK=${LOCK-}
for s in ${SEEDS:-501 502 503 504 505 506 507 508}; do
  if [ -n "$LOCK" ]; then flock "$LOCK" node "$D/jobs-measure.js" "$1" "$2" $s >> "$2.log" 2>&1; else node "$D/jobs-measure.js" "$1" "$2" $s >> "$2.log" 2>&1; fi
done
echo DONE >> "$2.log"
