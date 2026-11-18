#!/bin/bash
P=/tmp/claude-0/-home-user-RimTown/72a40dd3-e516-5832-817f-26aaf9ca7e72/scratchpad/perf
OUT=$P/ab_norm.out; touch $OUT; sed -i '/^DONE$/d' $OUT
run() { key="$1 $2 $3 $4 $5"; grep -q "^$key {" $OUT && return; r=$(flock /tmp/rimtown-test-B.lock env NORM=1 A=$4 B=$5 node $P/ab.js $1 $2 $3 2>&1 | tail -1); echo "$key $r" >> $OUT; }
while pgrep -f runab.sh > /dev/null; do sleep 10; done
run 3 60 22 http://localhost:8300/ http://localhost:8300/
run 3 60 22 http://localhost:8300/ http://localhost:8195/
run 3 60 5 http://localhost:8300/ http://localhost:8195/
run 3 40 9 http://localhost:8300/ http://localhost:8195/
echo DONE >> $OUT
