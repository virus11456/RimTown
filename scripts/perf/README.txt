模擬效能量測與影子比對（claude/tick-perf-1 這一輪）。腳本裡的路徑寫死成當時的暫存目錄，用之前改成自己的。

bench.js       BASE=… RS=亂數種子 OS=開局種子 node bench.js <tier> <days>：換日那一格與平常一格的耗時
cpu.js         同上加 Chrome CPU 取樣：自身耗時前幾名；TARGET=函式前綴（看呼叫路徑，標出是否在 SCAN.run 裡）、UNDER=函式前綴（看底下的耗時）
shadow.js      跑一座城後回報 window.__SH（每項影子比對的次數與不一致數）與經過的季節
shadow_checks.patch  影子比對用的暫時副本：把 chrome-extension 整個複製一份，在副本根目錄 patch -p1 套上，另開一個埠給 shadow.js 用（不要套進 repo）
ab.js          A=網址 B=網址 node ab.js <tier> <days> <seed>：兩邊固定亂數、時鐘、住哪一棟後各跑一次，逐日比 serialize() 的雜湊；
               NORM=1 把店面攤位座標歸零（座標看地圖層，同一版兩次跑也不一樣）
det.js         同一版開兩頁比較，找出第一個亂數取用次數不同的那一格與呼叫位置（找不可重現的來源用）
run*.sh        批次與續跑（跑過的組合會跳過）
