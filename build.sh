#!/usr/bin/env bash
# 產出 Vercel 靜態站:wordpress/ 的前端檔 + chrome-extension/icons
# 兩種情境都支援:
#   1. Vercel 從 GitHub import(repo 已 checkout,直接複製)
#   2. deploy_to_vercel 只上傳這三個設定檔(需先 clone repo)
set -euo pipefail

if [ -d wordpress ]; then
  SRC=.
else
  git clone --depth 1 -b claude/ai-town-simulation-EOWZ8 https://github.com/virus11456/RimTown.git repo
  SRC=repo
fi

mkdir -p public
cp "$SRC"/wordpress/*.js "$SRC"/wordpress/*.css "$SRC"/wordpress/*.html public/
cp "$SRC"/wordpress/pwa-manifest.json public/
cp -r "$SRC"/chrome-extension/icons public/icons
# v5.69.1 首頁圖片(3D 搶先看等)
if [ -d "$SRC"/chrome-extension/img ]; then
  mkdir -p public/img
  cp -R "$SRC"/chrome-extension/img/. public/img/
fi
