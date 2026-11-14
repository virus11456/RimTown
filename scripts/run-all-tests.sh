#!/bin/bash
# 全套回歸：scripts/ 裡每一支 *_test.js 各跑一次，3 支同時跑；沒過的再單獨重跑兩次。
# 用法：bash scripts/run-all-tests.sh            # 全部
#       bash scripts/run-all-tests.sh v92 v6771  # 只跑檔名含這些字的
# 結果：test-results/summary.txt（每支一行：結束碼 名稱 通過/失敗數），各支輸出在 test-results/<名稱>.log
# 需要本機 8126 服務 chrome-extension/；沒開的話這支腳本會自己開，跑完關掉。
# 不跑 loopaudit_test（一次要跑很多天的生態檢查，太久；要用時單獨跑）。
set -u
cd "$(dirname "$0")/.."
OUT=test-results; rm -rf "$OUT"; mkdir -p "$OUT"
PAR=${PAR:-3}; TMO=${TMO:-600}

SRV=""
if ! curl -s -o /dev/null http://localhost:8126/index.html; then
  (cd chrome-extension && exec python3 -m http.server 8126 >/dev/null 2>&1) & SRV=$!
  sleep 1
fi
trap '[ -n "$SRV" ] && kill $SRV 2>/dev/null' EXIT

list=$(ls scripts/*_test.js | grep -v loopaudit_test)
if [ $# -gt 0 ]; then pat=$(printf '%s|' "$@"); list=$(echo "$list" | grep -E "${pat%|}"); fi
total=$(echo "$list" | wc -l)
echo "跑 $total 支測試（同時 $PAR 支，每支最多 ${TMO} 秒）…"

run1() { f=$1; n=$(basename "$f" .js); timeout "$TMO" node "$f" > "$OUT/$n.log" 2>&1; c=$?; echo "$c $n $(grep -E '[0-9]+ passed' "$OUT/$n.log" | tail -1)" >> "$OUT/summary.txt"; }
export -f run1; export OUT TMO
echo "$list" | xargs -P "$PAR" -I{} bash -c 'run1 {}'

sort -k2 "$OUT/summary.txt" -o "$OUT/summary.txt"
fails=$(awk '$1!=0 {print $2}' "$OUT/summary.txt")
ok=$(awk '$1==0' "$OUT/summary.txt" | wc -l)
checks=$(awk '$1==0 {s+=$3} END{print s+0}' "$OUT/summary.txt")
echo "第一輪：$ok / $total 支通過（$checks 項檢查）"

# 沒過的單獨重跑兩次：機器滿載時會有逾時或偶發；單獨跑兩次都過才算偶發，否則就是真的壞了
still=""
for n in $fails; do
  r=""; for i in 1 2; do timeout "$TMO" node "scripts/$n.js" > "$OUT/$n.rerun$i.log" 2>&1; r="$r$?"; done
  if [ "$r" = "00" ]; then echo "  $n：第一輪沒過，單獨重跑兩次都過（偶發；看 $OUT/$n.log 寫下原因）"
  else echo "  $n：單獨重跑仍然失敗 ← 要修"; still="$still $n"; fi
done

if [ -n "$still" ]; then echo "失敗：$still"; exit 1; fi
echo "全部通過"
