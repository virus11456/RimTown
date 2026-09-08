# Low-poly 資產規範

32 色單一 palette.png（16×16，前 32 格使用；UV 在色格中心）；flat shading、roughness=1、metallic=0，全部由 Blender Python 重建。GLB Y-up、底面中心原點、meter。Godot 統一覆寫為同一個 StandardMaterial3D。模型尺寸為建模包圍盒上限；世界 footprint 依 D-07 保留原格網。

配色 0–7 地形、8–15 建築、16–23 村民、24–27 道具、28–31 季節。跨類共用相同色格。

| 色號 | Hex |
|---|---|
| 00 | #5e9e58 |
| 01 | #77ad61 |
| 02 | #447b52 |
| 03 | #b79970 |
| 04 | #8d9891 |
| 05 | #438eaa |
| 06 | #dcc598 |
| 07 | #574e42 |
| 08 | #dfc59a |
| 09 | #b87556 |
| 10 | #a54f45 |
| 11 | #6b7968 |
| 12 | #886447 |
| 13 | #4b4540 |
| 14 | #eedca8 |
| 15 | #9bbfc0 |
| 16 | #eed2ad |
| 17 | #c69470 |
| 18 | #684835 |
| 19 | #342d35 |
| 20 | #597d8e |
| 21 | #8b5e7c |
| 22 | #c5a65b |
| 23 | #77915c |
| 24 | #625c50 |
| 25 | #d49a51 |
| 26 | #f1bb69 |
| 27 | #668569 |
| 28 | #e8ece2 |
| 29 | #c57a4c |
| 30 | #9aa794 |
| 31 | #e2cd7f |


## 資產清單

清單與工具共用 tools/asset_manifest.json。角色組合全身 ≤600（三種部件上限合計 500）；身體含大頭與兩個深色眼面。小孩比例縮短、年長者輕駝背；性格差異用配件/髮型和姿態，不改角色資料。

| GLB | 類別 | 三角面上限 | 色格 | 尺寸上限 X/Y/Z |
|---|---|---:|---|---|
| ter_grass.glb | terrain | 12 | [0, 1, 2, 3, 4, 5, 6, 7] | [1, 0.18, 1] |
| ter_grass_light.glb | terrain | 12 | [0, 1, 2, 3, 4, 5, 6, 7] | [1, 0.18, 1] |
| ter_forest.glb | terrain | 12 | [0, 1, 2, 3, 4, 5, 6, 7] | [1, 0.18, 1] |
| ter_dirt.glb | terrain | 12 | [0, 1, 2, 3, 4, 5, 6, 7] | [1, 0.18, 1] |
| ter_stone.glb | terrain | 12 | [0, 1, 2, 3, 4, 5, 6, 7] | [1, 0.18, 1] |
| ter_water.glb | terrain | 12 | [0, 1, 2, 3, 4, 5, 6, 7] | [1, 0.18, 1] |
| ter_sand.glb | terrain | 12 | [0, 1, 2, 3, 4, 5, 6, 7] | [1, 0.18, 1] |
| ter_soil.glb | terrain | 12 | [0, 1, 2, 3, 4, 5, 6, 7] | [1, 0.18, 1] |
| road_straight.glb | road | 24 | [3, 4] | [1, 0.2, 1] |
| road_corner.glb | road | 24 | [3, 4] | [1, 0.2, 1] |
| road_t.glb | road | 24 | [3, 4] | [1, 0.2, 1] |
| road_cross.glb | road | 24 | [3, 4] | [1, 0.2, 1] |
| bld_house_a.glb | house | 300 | [8, 9, 10, 12, 13, 14] | [2, 2.8, 2] |
| bld_house_b.glb | house | 300 | [8, 9, 10, 12, 13, 14] | [2, 2.8, 2] |
| bld_house_c.glb | house | 300 | [8, 9, 10, 12, 13, 14] | [2, 2.8, 2] |
| bld_town_hall.glb | large | 800 | [8, 10, 11, 12, 13, 14, 15] | [4, 6, 3] |
| bld_factory.glb | large | 800 | [8, 10, 11, 12, 13, 14, 15] | [4, 6, 3] |
| bld_lighthouse.glb | large | 800 | [8, 10, 11, 12, 13, 14, 15] | [4, 6, 3] |
| bld_market.glb | building | 800 | [8, 9, 10, 11, 12, 13, 14, 15] | [4, 4, 3] |
| bld_farmhouse.glb | building | 800 | [8, 9, 10, 11, 12, 13, 14, 15] | [4, 4, 3] |
| bld_mine.glb | building | 800 | [8, 9, 10, 11, 12, 13, 14, 15] | [4, 4, 3] |
| bld_chapel.glb | building | 800 | [8, 9, 10, 11, 12, 13, 14, 15] | [4, 4, 3] |
| bld_clinic.glb | building | 800 | [8, 9, 10, 11, 12, 13, 14, 15] | [4, 4, 3] |
| bld_library.glb | building | 800 | [8, 9, 10, 11, 12, 13, 14, 15] | [4, 4, 3] |
| bld_coach_station.glb | building | 800 | [8, 9, 10, 11, 12, 13, 14, 15] | [4, 4, 3] |
| bld_dock.glb | building | 800 | [8, 9, 10, 11, 12, 13, 14, 15] | [4, 4, 3] |
| bld_saltworks.glb | building | 800 | [8, 9, 10, 11, 12, 13, 14, 15] | [4, 4, 3] |
| bld_tavern.glb | building | 800 | [8, 9, 10, 11, 12, 13, 14, 15] | [4, 4, 3] |
| bld_workshop.glb | building | 800 | [8, 9, 10, 11, 12, 13, 14, 15] | [4, 4, 3] |
| bld_guardpost.glb | building | 800 | [8, 9, 10, 11, 12, 13, 14, 15] | [4, 4, 3] |
| prop_tree_pine.glb | tree | 60 | [2, 12, 23, 29] | [1.7, 3, 1.7] |
| prop_tree_oak.glb | tree | 60 | [2, 12, 23, 29] | [1.7, 3, 1.7] |
| prop_tree_birch.glb | tree | 60 | [2, 12, 23, 29] | [1.7, 3, 1.7] |
| prop_crop_1.glb | crop | 30 | [1, 23, 31] | [0.6, 1, 0.6] |
| prop_crop_2.glb | crop | 30 | [1, 23, 31] | [0.6, 1, 0.6] |
| prop_crop_3.glb | crop | 30 | [1, 23, 31] | [0.6, 1, 0.6] |
| prop_fence.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_lamp.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_well.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_campfire.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_rock.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_bush.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_flower.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_barrel.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_crate.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_table.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_chair.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_bed.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_anvil.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_furnace.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_counter.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_bookshelf.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_altar.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_bridge.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_stall.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_weapon_rack.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_rug.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_cauldron.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_bench.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_grave.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_flag.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_lantern.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| prop_snowman.glb | prop | 80 | [12, 13, 24, 25, 26, 27, 28, 29, 30, 31] | [2, 2, 2] |
| chr_body_m.glb | body | 360 | [16, 17, 18, 19, 20, 21, 22, 23] | [0.8, 1.6, 0.6] |
| chr_body_f.glb | body | 360 | [16, 17, 18, 19, 20, 21, 22, 23] | [0.8, 1.6, 0.6] |
| chr_body_child.glb | body | 360 | [16, 17, 18, 19, 20, 21, 22, 23] | [0.8, 1.6, 0.6] |
| chr_body_elder.glb | body | 360 | [16, 17, 18, 19, 20, 21, 22, 23] | [0.8, 1.6, 0.6] |
| chr_hair_01.glb | hair | 60 | [18, 19, 30] | [0.62, 0.38, 0.62] |
| chr_hair_02.glb | hair | 60 | [18, 19, 30] | [0.62, 0.38, 0.62] |
| chr_hair_03.glb | hair | 60 | [18, 19, 30] | [0.62, 0.38, 0.62] |
| chr_hair_04.glb | hair | 60 | [18, 19, 30] | [0.62, 0.38, 0.62] |
| chr_hair_05.glb | hair | 60 | [18, 19, 30] | [0.62, 0.38, 0.62] |
| chr_hair_06.glb | hair | 60 | [18, 19, 30] | [0.62, 0.38, 0.62] |
| acc_hat_farmer.glb | accessory | 80 | [12, 13, 22, 24, 25] | [0.8, 0.9, 0.8] |
| acc_hat_miner.glb | accessory | 80 | [12, 13, 22, 24, 25] | [0.8, 0.9, 0.8] |
| acc_hat_cook.glb | accessory | 80 | [12, 13, 22, 24, 25] | [0.8, 0.9, 0.8] |
| acc_hat_guard.glb | accessory | 80 | [12, 13, 22, 24, 25] | [0.8, 0.9, 0.8] |
| acc_hat_priest.glb | accessory | 80 | [12, 13, 22, 24, 25] | [0.8, 0.9, 0.8] |
| acc_tool_pickaxe.glb | accessory | 80 | [12, 13, 22, 24, 25] | [0.8, 0.9, 0.8] |
| acc_tool_hammer.glb | accessory | 80 | [12, 13, 22, 24, 25] | [0.8, 0.9, 0.8] |
| acc_tool_hoe.glb | accessory | 80 | [12, 13, 22, 24, 25] | [0.8, 0.9, 0.8] |
| acc_tool_fishing.glb | accessory | 80 | [12, 13, 22, 24, 25] | [0.8, 0.9, 0.8] |
| acc_tool_book.glb | accessory | 80 | [12, 13, 22, 24, 25] | [0.8, 0.9, 0.8] |


## 地點與模型對照

住宅三區／residential_extra_*→house variants；town_hall→town_hall；tavern→tavern；general_store→market；farm→farmhouse＋crops；quarry→mine（harbor→saltworks）；workshop→workshop；clinic→clinic；library→library（harbor→lighthouse）；guardpost→guardpost；chapel→chapel；river→bridge（harbor→dock）；well／town_square→well；forest／park→樹與花；hill／cave→rock。既有建築 upgrade 共享相應輪廓、沿用原 siteX/siteY；7 種 processing factory 共用 factory 基體與標籤，未新增玩法。

## 粒子與動畫

雨／雪／落葉／螢火蟲四種 GPUParticles3D；四邊形最多 2 triangles／粒子，使用調色盤色格。天氣與季節由存檔決定，冬地用色格 28。日夜燈光只讀 clock。相機 35°/45°、90° steps、寬 8–40 格；375px 触控拖曳／雙指縮放。人物先靜止，可用 ≤1s 程序動畫展示 idle/walk/work/sleep/talk，但觀賞版不推進模擬。

## 驗證

Blender verify.py 檢查每個 GLB 三角數、尺寸、flat normals、材質、UV 中心、底面、有限座標與退化面。Godot showcase 排列全資產截圖；同檔重新生成並比較 mesh 資料摘要。Web 使用 compatibility renderer，不依賴 SSAO 等不支援效果。
