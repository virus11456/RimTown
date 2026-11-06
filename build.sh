#!/usr/bin/env bash
# 產出 Vercel 靜態站:chrome-extension/ 的前端檔(js/css/html、pwa-manifest、vendor/、icons/、img/)→ public/
# (v6.83.0 之後拿掉 wordpress/ 鏡像,chrome-extension/ 是唯一來源;資料夾名稱沿用,擴充功能版已在 v6.50.0 移除)
# 兩種情境都支援:
#   1. Vercel 從 GitHub import(repo 已 checkout,直接複製)
#   2. deploy_to_vercel 只上傳這三個設定檔(需先 clone repo)
set -euo pipefail

if [ -d chrome-extension ]; then
  SRC=chrome-extension
else
  git clone --depth 1 -b claude/ai-town-simulation-EOWZ8 https://github.com/virus11456/RimTown.git repo
  SRC=repo/chrome-extension
fi

rm -rf public
mkdir -p public
cp "$SRC"/*.js "$SRC"/*.css "$SRC"/*.html public/
cp "$SRC"/pwa-manifest.json public/
# v6.27.1 子目錄(vendor/three.min.js)也要上
if [ -d "$SRC"/vendor ]; then mkdir -p public/vendor; cp -R "$SRC"/vendor/. public/vendor/; fi
cp -R "$SRC"/icons public/icons
# v5.69.1 首頁圖片(3D 搶先看等)
if [ -d "$SRC"/img ]; then mkdir -p public/img; cp -R "$SRC"/img/. public/img/; fi
