#!/bin/bash
# 用法：runbench.sh <標籤> [BASE]；已經跑完的組合會跳過
P=/tmp/claude-0/-home-user-RimTown/72a40dd3-e516-5832-817f-26aaf9ca7e72/scratchpad/perf
TAG=$1; B=${2:-http://localhost:8195/}; OUT=$P/bench_$TAG.out; touch $OUT; sed -i '/^DONE$/d' $OUT
for cfg in "3 7 22" "3 11 5" "2 7 22" "2 11 5"; do set -- $cfg
  for rep in 1 2; do key="T$1 rs$2 os$3 #$rep"; grep -q "^$key {" $OUT && continue
    r=$(flock /tmp/rimtown-test-B.lock env BASE=$B RS=$2 OS=$3 node $P/bench.js $1 30 2>&1 | tail -1)
    echo "$key $r" >> $OUT
  done
done
echo DONE >> $OUT
