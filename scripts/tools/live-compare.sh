#!/bin/bash
# 上線後檢查：線上每一個前端檔跟這個分支的 chrome-extension/ 逐字相同嗎。
# 用法：bash scripts/tools/live-compare.sh            # 比 https://rimtown.cc
#       SITE=https://<預覽網址> bash scripts/tools/live-compare.sh
# 只做 GET。有任何檔不同就 exit 1 並列出來。town.html／index.html 線上走乾淨網址（/town、/），用 -L 跟著轉。
set -u
cd "$(dirname "$0")/../.."
SITE=${SITE:-https://rimtown.cc}; D=$(mktemp -d); n=0; bad=0
for f in $(cd chrome-extension && ls *.js *.css *.html pwa-manifest.json vendor/* 2>/dev/null); do
  curl -sL "$SITE/$f?t=$RANDOM" -o "$D/x" || { echo "抓不到 $f"; bad=$((bad+1)); continue; }
  if cmp -s "$D/x" "chrome-extension/$f"; then n=$((n+1)); else echo "不同：$f"; bad=$((bad+1)); fi
done
rm -rf "$D"; echo "逐字相同 $n 個，不同 $bad 個"
[ "$bad" -eq 0 ]
