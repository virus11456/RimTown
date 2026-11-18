#!/bin/bash
# 用法：runshadow.sh <標籤>；已經跑完的組合會跳過（容器重啟後可以接著跑）
P=/tmp/claude-0/-home-user-RimTown/72a40dd3-e516-5832-817f-26aaf9ca7e72/scratchpad/perf
TAG=$1; OUT=$P/shadow_$TAG.out; touch $OUT
for cfg in "3 7 22 130" "3 11 5 130" "3 3 9 70" "2 7 22 130" "2 13 17 130"; do set -- $cfg
  key="T$1 rs$2 os$3 d$4"; grep -q "^$key {" $OUT && continue
  r=$(flock /tmp/rimtown-test-B.lock env BASE=http://localhost:8297/ RS=$2 OS=$3 node $P/shadow.js $1 $4 2>&1 | tail -1)
  echo "$key $r" >> $OUT
done
echo DONE >> $OUT
