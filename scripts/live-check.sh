#!/bin/bash
# 上線後檢查：等 rimtown.cc 換成指定版本，再把線上所有程式與樣式檔抓下來掃金鑰。
# 用法：bash scripts/live-check.sh 9.29.2
# 有任何金鑰樣式出現就失敗（exit 1）。金鑰只能放在 Vercel 環境變數，網頁原始碼裡一個都不能有。
set -u
VER=${1:?用法：bash scripts/live-check.sh <版本號>}
SITE=${SITE:-https://rimtown.cc}
KEYS='gsk_|sk-[A-Za-z0-9]{16}|vercel_blob_rw_|AIza'

echo "等 $SITE 換成 v$VER…"
for i in $(seq 1 60); do
  v=$(curl -s "$SITE/sw.js?t=$RANDOM" | grep -o "rimtown-v[0-9.]*" | head -1)
  [ "$v" = "rimtown-v$VER" ] && break
  sleep 10
done
[ "$v" = "rimtown-v$VER" ] || { echo "十分鐘內沒有換成 v$VER（現在是 $v）"; exit 1; }
echo "線上已是 $v"

D=$(mktemp -d); cd "$D"
curl -s "$SITE/sw.js?t=$RANDOM" -o sw.js; curl -s "$SITE/?t=$RANDOM" -o index.html; curl -s "$SITE/town?t=$RANDOM" -o town.html
( grep -o "'\./[^']*'" sw.js | tr -d "'" | sed 's#^\./##'
  grep -oh 'src="[^"]*\.js[^"]*"' index.html town.html | sed 's/src="//;s/"$//;s/?.*//'
  grep -oh 'href="[^"]*\.css[^"]*"' index.html town.html | sed 's/href="//;s/"$//;s/?.*//'
) | grep -v '^http' | grep -E '\.(js|css|html|json)$' | sort -u > list.txt

n=0; bad=0
while read -r f; do
  mkdir -p "$(dirname "f/$f")"
  code=$(curl -s -o "f/$f" -w '%{http_code}' "$SITE/$f?t=$RANDOM")
  [ "$code" != 200 ] && { echo "  HTTP $code $f"; bad=1; }
  n=$((n+1))
done < list.txt
echo "抓了 $n 個檔"

hits=$(grep -rlE "$KEYS" f sw.js index.html town.html | wc -l)
echo "金鑰命中：$hits"
rm -rf "$D"
[ "$hits" -eq 0 ] || { echo "有金鑰出現在網頁原始碼裡，立刻處理"; exit 1; }
[ "$bad" -eq 0 ] || echo "（有檔案載入失敗，檢查一下 sw.js 的清單）"
echo "OK"
