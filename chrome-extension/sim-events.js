// RimTown - sim-events.js：v6.38.0 事件卡（上帝視角）。觀察者唯一的「手」：從 30 張卡裡挑一張打出去，事件落地後
// 看村民怎麼反應——相關村民各自用 LLM 說第一反應（寫進記憶、冒泡泡）、之後幾天的對話與反思帶著這件事、
// 村民提對策提案、日報報導；「反應追蹤」記下誰說了什麼、提了什麼案、七天後鎮上變成怎樣。
// 掛在 world.eventCards；每日由 World 換日流程呼叫 daily(world)。卡牌效果全走既有系統（天氣／考驗／事件／關係／倉庫）。
'use strict';

// 卡面文字都是翻譯鍵；{占位} 由 play() 回傳的 summary 填
const EVENT_CARDS = [
    // ---------- 天災 ----------
    { id: 'drought', cat: 'disaster', icon: '☀️', name: '旱災', desc: '連日烈日，水井見底，田裡的作物發黃。', effect: '天氣轉乾旱 3 天、食物 −15%、開啟「糧荒」考驗', cd: 20, jobs: ['farmer', 'cook'], loc: 'farm',
      play(w, S) { S._weather(w, 'drought', 3); const n = S._takePct(w, 'food', 0.15); S._farmPenalty(w, 0.3, 5); S._trial(w, 'famine'); return { n }; } },
    { id: 'storm', cat: 'disaster', icon: '⛈️', name: '暴風雨', desc: '狂風暴雨掀了屋瓦，工地的鷹架倒了一半。', effect: '天氣轉暴風雨 2 天、木材 −20、工程進度 −20%、全鎮心情 −5', cd: 15, jobs: ['carpenter', 'guard'], loc: 'town_square',
      play(w, S) { S._weather(w, 'storm', 2); S._take(w, 'wood', 20); S._projectSetback(w, 0.2); S._moodAll(w, -5); return {}; } },
    { id: 'coldsnap', cat: 'disaster', icon: '🥶', name: '寒流', desc: '一夜之間氣溫驟降，柴火燒得比吃飯還快。', effect: '天氣轉雪 3 天、食物 −10%、木材 −15、全鎮心情 −8', cd: 15, jobs: ['doctor', 'tailor'], loc: 'town_square',
      play(w, S) { S._weather(w, 'snow', 3); S._takePct(w, 'food', 0.10); S._take(w, 'wood', 15); S._moodAll(w, -8); return {}; } },
    { id: 'fire', cat: 'disaster', icon: '🔥', name: '火災', desc: '深夜一處倉房起火，半鎮的人提水救火到天亮。', effect: '木材 −30%、食物 −10%、全鎮心情 −10；守衛與木匠印象最深', cd: 25, jobs: ['guard', 'carpenter'], loc: 'general_store',
      play(w, S) { const wood = S._takePct(w, 'wood', 0.30); S._takePct(w, 'food', 0.10); S._moodAll(w, -10); S._projectSetback(w, 0.15); return { n: wood }; } },
    { id: 'plague', cat: 'disaster', icon: '🤒', name: '瘟疫', desc: '咳嗽聲從一戶傳到一戶，診所外排起了隊。', effect: '開啟「瘟疫」考驗、草藥 −50%、三人病倒（心情 −15）', cd: 30, jobs: ['doctor', 'priest'], loc: 'clinic',
      play(w, S) { S._trial(w, 'plague'); S._takePct(w, 'herbs', 0.5); const sick = S._pickN(w, 3); for (const a of sick) { a.moodModifier = (a.moodModifier || 0) - 15; a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'health', '我病倒了，躺了好幾天，渾身沒力。', {}, 8, []); } return { names: sick.map(a => a.name).join(t('、')), affected: sick.map(a => a.agentId) }; } },
    { id: 'locusts', cat: 'disaster', icon: '🦗', name: '蝗災', desc: '黑壓壓的蟲群過境，田裡只剩光桿。', effect: '生長中的作物全毀、食物 −20%、農夫心情 −20', cd: 30, jobs: ['farmer'], loc: 'farm',
      play(w, S) { let k = 0; for (const p of (w.farm?.plots || [])) if (p.state === 'growing' || p.state === 'ready') { p.state = 'withered'; k++; } S._takePct(w, 'food', 0.2); for (const a of S._npcs(w)) if (a.job?.key === 'farmer') a.moodModifier = (a.moodModifier || 0) - 20; return { n: k }; } },
    { id: 'quake', cat: 'disaster', icon: '🌍', name: '地震', desc: '地面晃了十幾秒，牆上的裂縫一路爬到屋頂。', effect: '工程進度 −40%、石材 −25、全鎮心情 −12', cd: 40, jobs: ['carpenter', 'miner'], loc: 'town_square',
      play(w, S) { S._projectSetback(w, 0.4); S._take(w, 'stone', 25); S._moodAll(w, -12); return {}; } },
    { id: 'flood', cat: 'disaster', icon: '🌊', name: '洪水', desc: '河水漫過堤岸，低處的人家連夜搬到高地。', effect: '天氣轉雨 3 天、食物 −10%、布料 −30%、兩人暫避他鄉 2 天', cd: 25, jobs: ['farmer', 'guard'], loc: 'farm',
      play(w, S) { S._weather(w, 'rain', 3); S._takePct(w, 'food', 0.1); S._takePct(w, 'cloth', 0.3); const ev = S._pickN(w, 2); for (const a of ev) S._travel(w, a, '洪水來了，先去鄰鎮避一避', 2); return { names: ev.map(a => a.name).join(t('、')), affected: ev.map(a => a.agentId) }; } },
    // ---------- 人禍 ----------
    { id: 'caravan_robbed', cat: 'mishap', icon: '🏴', name: '商隊被劫', desc: '出鎮的貨車在隘口被攔下，貨跟錢都沒了。', effect: '銀幣 −20%、商人心情 −15、開啟「匪患」考驗', cd: 20, jobs: ['trader', 'guard'], loc: 'general_store',
      play(w, S) { const n = S._takePct(w, 'silver', 0.2); for (const a of S._npcs(w)) if (a.job?.key === 'trader') a.moodModifier = (a.moodModifier || 0) - 15; S._trial(w, 'bandits'); return { n }; } },
    { id: 'rumor', cat: 'mishap', icon: '🗣️', name: '流言', desc: '一句沒頭沒尾的話在井邊傳開，兩個人的名字被綁在一起。', effect: '隨機兩人好感 −25，容易引出調解提案', cd: 12, jobs: ['priest'], loc: 'town_square',
      play(w, S) { const [a, b] = S._pair(w); if (!a) return {}; S._aff(a, b, -25); S._aff(b, a, -25); a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '鎮上在傳我和{other}的閒話，聽了很不是滋味。', { other: b.name }, 7, [b.name]); b.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '鎮上在傳我和{other}的閒話，聽了很不是滋味。', { other: a.name }, 7, [a.name]); return { names: `${a.name}${t('、')}${b.name}`, affected: [a.agentId, b.agentId] }; } },
    { id: 'theft', cat: 'mishap', icon: '🕵️', name: '竊案', desc: '公庫的鎖被撬了，少了一袋銀幣和幾把工具。', effect: '銀幣 −60、工具 −3、守衛心情 −8、一人被懷疑', cd: 15, jobs: ['guard'], loc: 'town_hall',
      play(w, S) { S._take(w, 'silver', 60); S._take(w, 'tools', 3); const sus = S._pickN(w, 1)[0]; for (const a of S._npcs(w)) { if (a.job?.key === 'guard') a.moodModifier = (a.moodModifier || 0) - 8; if (sus && a !== sus && Math.random() < 0.4) S._aff(a, sus, -8); } sus?.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '公庫失竊，有人在背後說是我。我沒有。', {}, 8, []); return { names: sus?.name || '', affected: sus ? [sus.agentId] : [] }; } },
    { id: 'taxman', cat: 'mishap', icon: '📜', name: '稅吏上門', desc: '外地來的稅吏帶著公文，把帳本翻了個底朝天。', effect: '銀幣 −25%、全鎮心情 −6', cd: 20, jobs: ['mayor', 'trader'], loc: 'town_hall',
      play(w, S) { const n = S._takePct(w, 'silver', 0.25); S._moodAll(w, -6); return { n }; } },
    { id: 'bad_brew', cat: 'mishap', icon: '🤢', name: '壞了的餐食', desc: '昨晚的湯有點酸，今早一半人捂著肚子。', effect: '餐食 −50%、四人心情 −10 並對廚師不滿', cd: 15, jobs: ['cook', 'doctor'], loc: 'tavern',
      play(w, S) { S._takePct(w, 'meals', 0.5); const cook = S._npcs(w).find(a => a.job?.key === 'cook'); const vic = S._pickN(w, 4, (a) => a !== cook); for (const a of vic) { a.moodModifier = (a.moodModifier || 0) - 10; if (cook) S._aff(a, cook, -10); a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'health', '吃壞肚子躺了一天，一想到那鍋湯就反胃。', {}, 6, cook ? [cook.name] : []); } return { names: vic.map(a => a.name).join(t('、')), affected: vic.map(a => a.agentId).concat(cook ? [cook.agentId] : []) }; } },
    { id: 'raid', cat: 'mishap', icon: '⚔️', name: '匪徒襲擊', desc: '號角在半夜響起，火把從鎮外的林子裡湧出來。', effect: '立刻一場襲擊：守衛夠就擋下，不夠就被搶糧搶錢', cd: 20, jobs: ['guard'], loc: 'guardpost',
      play(w, S) { const ev = w.events?._triggerRaid?.(w); return { n: ev ? t(ev.name) : '' }; } },
    { id: 'price_crash', cat: 'mishap', icon: '📉', name: '物價崩盤', desc: '外地商會聯手壓價，鎮上的貨賣不出好價錢。', effect: '開啟「商會壓價」考驗、銀幣 −10%', cd: 25, jobs: ['trader', 'mayor'], loc: 'general_store',
      play(w, S) { S._trial(w, 'pricewar'); const n = S._takePct(w, 'silver', 0.1); return { n }; } },
    { id: 'scandal', cat: 'mishap', icon: '📰', name: '鎮長醜聞', desc: '一封匿名信貼在公所門口，說鎮長私下挪了公款。', effect: '全鎮對鎮長好感 −15、鎮長心情 −20', cd: 30, jobs: ['mayor', 'priest'], loc: 'town_hall',
      play(w, S) { const m = S._npcs(w).find(a => a.job?.key === 'mayor'); if (!m) return {}; for (const a of S._npcs(w)) if (a !== m) S._aff(a, m, -15); m.moodModifier = (m.moodModifier || 0) - 20; m.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '有人匿名指控我挪用公款。我得想辦法澄清。', {}, 9, []); return { names: m.name, affected: [m.agentId] }; } },
    // ---------- 機運 ----------
    { id: 'bumper', cat: 'fortune', icon: '🌾', name: '豐收', desc: '今年的穀穗沉得壓彎了稈，倉房堆到門口。', effect: '食物 +120、全鎮心情 +8', cd: 15, jobs: ['farmer', 'cook'], loc: 'farm',
      play(w, S) { w.stockpile.add('food', 120, w.tickCount, t('事件卡：豐收'), 'event'); w.trials?.onPlayerGain?.('food', 120); S._moodAll(w, 8); return {}; } },
    { id: 'gold_rumor', cat: 'fortune', icon: '⛏️', name: '金礦傳聞', desc: '獵人說在山裡看見閃光的石頭，整鎮都在談。', effect: '發現一處新探索區、金屬 +10；容易引出探險提案', cd: 30, jobs: ['miner', 'researcher'], loc: 'quarry',
      play(w, S) { const zid = S._discover(w); w.stockpile.add('metal', 10, w.tickCount, t('事件卡：金礦傳聞'), 'event'); return { n: zid || '' }; } },
    { id: 'stranger', cat: 'fortune', icon: '🧳', name: '神秘旅人', desc: '一個背著大包袱的人在客棧住下，說想在這裡安家。', effect: '一位新居民搬來', cd: 15, jobs: ['mayor', 'trader'], loc: 'tavern',
      play(w, S) { const before = new Set(Object.keys(w.agents)); w.events?._spawnImmigrant?.(w); const nid = Object.keys(w.agents).find(k => !before.has(k)); const nw = nid ? w.agents[nid] : null; return { names: nw?.name || '', affected: nw ? [nw.agentId] : [] }; } },
    { id: 'letter', cat: 'fortune', icon: '✉️', name: '失散親人來信', desc: '郵差送來一封泛黃的信，署名是多年沒消息的人。', effect: '一人心情 +10 並出門探親 4 天', cd: 20, jobs: [], loc: 'tavern',
      play(w, S) { const a = S._pickN(w, 1)[0]; if (!a) return {}; a.moodModifier = (a.moodModifier || 0) + 10; a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'family', '收到失散多年的親人來信，我決定去看看。', {}, 9, []); S._travel(w, a, '收到失散多年的親人來信，去探親', 4); return { names: a.name, affected: [a.agentId] }; } },
    { id: 'grand_caravan', cat: 'fortune', icon: '🐪', name: '行商大隊', desc: '一整列駱駝停在鎮口，貨多到攤位擺不下。', effect: '來一位帶雙倍貨、價格更好的商人', cd: 15, jobs: ['trader'], loc: 'general_store',
      play(w, S) { w.trade?._spawnMerchant?.(w); const m = w.trade?.merchant; if (m) { m.daysRemaining = 4; for (const o of m.offers) { o.amount = Math.round(o.amount * 2); o.price = Math.round(o.price * (o.isBuying ? 1.25 : 0.8) * 10) / 10; } } return { n: m?.name || '' }; } },
    { id: 'bequest', cat: 'fortune', icon: '💰', name: '慈善遺產', desc: '一位早年離鎮的老人過世，遺囑把積蓄留給了小鎮。', effect: '銀幣 +200、全鎮心情 +5', cd: 30, jobs: ['mayor', 'priest'], loc: 'town_hall',
      play(w, S) { w.stockpile.add('silver', 200, w.tickCount, t('事件卡：慈善遺產'), 'event'); w.trials?.onPlayerGain?.('silver', 200); S._moodAll(w, 5); return {}; } },
    { id: 'prodigy', cat: 'fortune', icon: '✨', name: '天降奇才', desc: '有人一夜之間開了竅，做出來的東西連老師傅都看呆。', effect: '隨機一人本行技能升一級；容易引出表揚提案', cd: 20, jobs: [], loc: 'workshop',
      play(w, S) { const a = S._pickN(w, 1, (x) => !!x.job?.key)[0]; if (!a) return {}; const JS = (typeof JOB_SKILL_MAP !== 'undefined') ? JOB_SKILL_MAP : {}; const prim = JS[a.job.key]?.primary?.[0]; const sk = prim ? a.skills?.skills?.[prim] : null; if (sk) { const need = (typeof xpForLevel === 'function') ? xpForLevel((sk.level || 0) + 1) - sk.xp : 120; sk.addXp(Math.max(120, need + 10)); } a.moodModifier = (a.moodModifier || 0) + 10; a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'work', '今天手感好得不像話，連自己都嚇到。', {}, 7, []); return { names: a.name, affected: [a.agentId] }; } },
    // ---------- 人際 ----------
    { id: 'old_grudge', cat: 'social', icon: '💢', name: '舊帳重翻', desc: '酒過三巡，多年前的那件事又被翻出來吵。', effect: '鎮上關係最差的兩人再 −30', cd: 15, jobs: ['priest', 'mayor'], loc: 'tavern',
      play(w, S) { const [a, b] = S._worstPair(w); if (!a) return {}; S._aff(a, b, -30); S._aff(b, a, -30); a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '又跟{other}為多年前的事吵了一架。', { other: b.name }, 8, [b.name]); b.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '又跟{other}為多年前的事吵了一架。', { other: a.name }, 8, [a.name]); return { names: `${a.name}${t('、')}${b.name}`, affected: [a.agentId, b.agentId] }; } },
    { id: 'wedding', cat: 'social', icon: '💒', name: '婚禮邀請', desc: '鎮上感情最好的一對發了喜帖，廣場要擺桌了。', effect: '最親密的兩人好感 +20、全鎮心情 +15、食物 −30', cd: 30, jobs: ['cook', 'priest'], loc: 'town_square',
      play(w, S) { const [a, b] = S._bestPair(w); if (!a) return {}; S._aff(a, b, 20); S._aff(b, a, 20); S._moodAll(w, 15); S._take(w, 'food', 30); for (const x of S._npcs(w)) x.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '{a}和{b}在廣場辦了喜宴，大家吃到半夜。', { a: a.name, b: b.name }, 6, [a.name, b.name]); return { names: `${a.name}${t('、')}${b.name}`, affected: [a.agentId, b.agentId] }; } },
    { id: 'inheritance', cat: 'social', icon: '⚖️', name: '遺產之爭', desc: '一棟老屋沒留遺囑，兩家人都說是自己的。', effect: '同行兩人好感 −20、各得 20 銀幣的律師費帳單（公庫 −40）', cd: 25, jobs: ['mayor', 'priest'], loc: 'town_hall',
      play(w, S) { const [a, b] = S._sameJobPair(w); if (!a) return {}; S._aff(a, b, -20); S._aff(b, a, -20); S._take(w, 'silver', 40); return { names: `${a.name}${t('、')}${b.name}`, affected: [a.agentId, b.agentId] }; } },
    { id: 'hero_return', cat: 'social', icon: '🎖️', name: '英雄歸來', desc: '出遠門的人回來了，帶著一身傳奇和一袋禮物。', effect: '在外的人立刻回來；全鎮對他好感 +10、公庫 +40', cd: 20, jobs: ['guard'], loc: 'guardpost',
      play(w, S) { const tr = w.events?._travellingAgents || []; let a = null; if (tr.length) { const back = tr[0]; try { w.events._returnAgent(w, back); } catch (e) {} w.events._travellingAgents = tr.filter(x => x !== back); a = w.agents[back.agentData?.agentId]; } if (!a) a = S._pickN(w, 1)[0]; if (!a) return {}; for (const x of S._npcs(w)) if (x !== a) S._aff(x, a, 10); w.stockpile.add('silver', 40, w.tickCount, t('事件卡：英雄歸來'), 'event'); a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '回鎮那天大家都來迎接我，像個英雄一樣。', {}, 8, []); return { names: a.name, affected: [a.agentId] }; } },
    { id: 'love_letter', cat: 'social', icon: '💌', name: '情書誤送', desc: '一封沒寫收信人的情書被交到了錯的人手上。', effect: '三人三角：A 對 B +15、C 吃醋 −10', cd: 15, jobs: [], loc: 'tavern',
      play(w, S) { const tri = S._pickN(w, 3); if (tri.length < 3) return {}; const [a, b, c] = tri; S._aff(a, b, 15); S._aff(c, a, -10); S._aff(c, b, -5); a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'love', '我寫的信送錯了人，結果{b}看了。好尷尬。', { b: b.name }, 8, [b.name]); c.memory?.addT?.(w.tickCount, w.clock.timeStr, 'love', '{a}寫給{b}的情書被我看到了，心裡酸酸的。', { a: a.name, b: b.name }, 8, [a.name, b.name]); return { names: `${a.name}${t('、')}${b.name}${t('、')}${c.name}`, affected: tri.map(x => x.agentId) }; } },
    { id: 'old_friend', cat: 'social', icon: '🤝', name: '老友來訪', desc: '多年不見的朋友路過小鎮，住了一晚，講了一夜的往事。', effect: '一人心情 +12、全鎮心情 +4；帶來一箱禮物（布料 +10、草藥 +6）', cd: 12, jobs: [], loc: 'tavern',
      play(w, S) { const a = S._pickN(w, 1)[0]; if (a) { a.moodModifier = (a.moodModifier || 0) + 12; a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '老朋友來看我，聊到天亮。', {}, 7, []); } S._moodAll(w, 4); w.stockpile.add('cloth', 10, w.tickCount, t('事件卡：老友來訪'), 'event'); w.stockpile.add('herbs', 6, w.tickCount, t('事件卡：老友來訪'), 'event'); return { names: a?.name || '', affected: a ? [a.agentId] : [] }; } },
    { id: 'apology', cat: 'social', icon: '🙏', name: '公開道歉', desc: '有人在廣場上，當著大家的面低下了頭。', effect: '關係最差的兩人：七成機率 +25 和好，否則場面更僵 −5', cd: 15, jobs: ['priest'], loc: 'town_square',
      play(w, S) { const [a, b] = S._worstPair(w); if (!a) return {}; const ok = Math.random() < 0.7; const d = ok ? 25 : -5; S._aff(a, b, d); S._aff(b, a, d); a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', ok ? '我在廣場向{other}道了歉，話說開了。' : '我在廣場向{other}道歉，但對方沒領情。', { other: b.name }, 8, [b.name]); b.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', ok ? '{other}當眾向我道歉，我接受了。' : '{other}當眾道歉，但我還過不去。', { other: a.name }, 8, [a.name]); return { names: `${a.name}${t('、')}${b.name}`, n: ok ? t('和好了') : t('沒談攏'), affected: [a.agentId, b.agentId] }; } },
];
const EVENT_CARD_CATS = { disaster: { icon: '🌪️', label: '天災' }, mishap: { icon: '🕳️', label: '人禍' }, fortune: { icon: '🍀', label: '機運' }, social: { icon: '💞', label: '人際' } };

class EventCardSystem {
    constructor() { this.cooldown = {}; this.played = []; this.stats = { played: 0 }; this._lastDay = null; this._todayCount = 0; }
    static MAX_PER_DAY = 2;
    static MAX_REACTIONS = 3;

    _abs(w) { return w._absDay ? w._absDay() : (w.clock.year * 60 + ['春季', '夏季', '秋季', '冬季'].indexOf(w.clock.season) * 15 + w.clock.day); }
    _npcs(w) { return Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_') && a.currentLocation !== 'exploration'); }
    _fill(k, p) { let s = (typeof t === 'function') ? t(k) : k; for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(typeof t === 'function' && typeof b === 'string' ? t(b) : String(b)); return s; }
    card(id) { return EVENT_CARDS.find(c => c.id === id) || null; }

    // ---------- 效果小工具（給卡牌用） ----------
    _take(w, r, n) { const have = w.stockpile.get(r); const k = Math.min(have, n); if (k > 0) w.stockpile.consume(r, k, w.tickCount, t('事件卡'), 'event'); return Math.round(k); }
    _takePct(w, r, pct) { return this._take(w, r, Math.round(w.stockpile.get(r) * pct)); }
    _moodAll(w, d) { for (const a of this._npcs(w)) a.moodModifier = (a.moodModifier || 0) + d; }
    _weather(w, type, days) { const ws = w.weather; if (!ws) return; ws.current = type; ws.duration = days; ws.forecast = []; ws.streak = 0; }
    _farmPenalty(w, pen, days) { if (w.farm) w.farm.moodPenalty = { penalty: -Math.abs(pen), days }; }
    _trial(w, type) { try { return !!w.trials?.force?.(w, type); } catch (e) { return false; } }
    _projectSetback(w, pct) { for (const p of (w.buildings?.projects || [])) if (p.status === 'building') p.workDone = Math.max(0, Math.floor(p.workDone * (1 - pct))); }
    _travel(w, a, reasonKey, days) { try { w.events?._sendAgentTravelling?.(w, a, (typeof tpl === 'function') ? tpl(reasonKey) : reasonKey, days); } catch (e) {} }
    _discover(w) {
        const ex = w.exploration; const Z = (typeof EXPLORATION_ZONES !== 'undefined') ? EXPLORATION_ZONES : []; if (!ex || !Z.length) return null;
        const un = Z.filter(z => !ex.discoveredZones?.[z.id]); if (!un.length) return null;
        const z = un.find(x => x.id === 'abandoned_mine') || un[Math.floor(Math.random() * un.length)];
        ex.discoveredZones[z.id] = { discovered: true, timesExplored: 0, lastExploredTick: 0 };
        w.logMessageT?.('exploration', '🗺️ 發現了新的探索區域：{icon} {zone}！{description}', { icon: z.icon, zone: z.name, description: z.description });
        return z.name;
    }
    _aff(a, b, d) { try { const r = a.relationships?.getOrCreate?.(b.agentId, b.name); r?.modifyAffinity?.(d); if (d < 0) r?.modifyTrust?.(Math.round(d / 3)); } catch (e) {} }
    _pickN(w, n, pred) { const pool = this._npcs(w).filter(a => !pred || pred(a)); const out = []; while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); return out; }
    _pair(w) { return this._pickN(w, 2); }
    _worstPair(w) { let best = null; for (const x of this._npcs(w)) for (const [tid, r] of Object.entries(x.relationships?.relationships || {})) { const y = w.agents[tid]; if (!y || y.isPlayer || y.isDead) continue; if (!best || (r.affinity || 0) < best.v) best = { x, y, v: r.affinity || 0 }; } return best ? [best.x, best.y] : this._pair(w); }
    _bestPair(w) { let best = null; for (const x of this._npcs(w)) for (const [tid, r] of Object.entries(x.relationships?.relationships || {})) { const y = w.agents[tid]; if (!y || y.isPlayer || y.isDead) continue; if (!best || (r.affinity || 0) > best.v) best = { x, y, v: r.affinity || 0 }; } return best ? [best.x, best.y] : this._pair(w); }
    _sameJobPair(w) { const npcs = this._npcs(w); const by = {}; for (const a of npcs) { const k = a.job?.key || '_'; (by[k] = by[k] || []).push(a); } const g = Object.values(by).filter(x => x.length >= 2); if (!g.length) return this._pair(w); const grp = g[Math.floor(Math.random() * g.length)]; return [grp[0], grp[1]]; }

    // ---------- 狀態 ----------
    canPlay(w, id) {
        const c = this.card(id); if (!c) return { ok: false, why: 'unknown' };
        const day = this._abs(w); if (this._lastDay !== day) { this._lastDay = day; this._todayCount = 0; }
        const left = (this.cooldown[id] || -999) + c.cd - day;
        if (left > 0) return { ok: false, why: 'cooldown', days: left };
        if (this._todayCount >= EventCardSystem.MAX_PER_DAY) return { ok: false, why: 'daily' };
        return { ok: true };
    }
    hand(w) {
        const day = this._abs(w); if (this._lastDay !== day) { this._lastDay = day; this._todayCount = 0; }
        return EVENT_CARDS.map(c => { const left = Math.max(0, (this.cooldown[c.id] || -999) + c.cd - day); return { id: c.id, cat: c.cat, catIcon: EVENT_CARD_CATS[c.cat].icon, catLabel: t(EVENT_CARD_CATS[c.cat].label), icon: c.icon, name: t(c.name), desc: t(c.desc), effect: t(c.effect), cd: c.cd, left, dailyFull: this._todayCount >= EventCardSystem.MAX_PER_DAY }; });
    }

    // ---------- 打出 ----------
    play(w, id) {
        const can = this.canPlay(w, id); if (!can.ok) return { ok: false, why: can.why, days: can.days };
        const c = this.card(id); const day = this._abs(w);
        let res = {};
        try { res = c.play(w, this) || {}; } catch (e) { console.warn('[EventCards] play', id, e); return { ok: false, why: 'error' }; }
        this.cooldown[id] = day; this._todayCount++; this.stats.played++;
        const name = t(c.name), desc = t(c.desc);
        const detail = [desc, res.names ? `${t('牽涉')}${t('：')}${res.names}` : '', res.n ? `${t('（')}${res.n}${t('）')}` : ''].filter(Boolean).join(' ');
        const entry = { id: c.id, day, cat: c.cat, icon: c.icon, name: c.name, detail, affected: res.affected || [], loc: c.loc, reactions: [], proposals: [], snap: this._snapshot(w, day), outcome: null };
        this.played.push(entry); if (this.played.length > 30) this.played = this.played.slice(-30);
        // 全鎮都記得、日報頭條、對話話題
        for (const a of this._npcs(w)) a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'event', '鎮上出了事：{name}——{desc}', { name: c.name, desc: c.desc }, entry.affected.includes(a.agentId) ? 9 : 5, []);
        w.events?.conversationTopics?.push(name); if (w.events) w.events.conversationTopics = w.events.conversationTopics.slice(-5);
        w.events?.eventLog?.push([w.clock.timeStr, { name, description: desc, severity: c.cat === 'fortune' ? 'minor' : 'major', effects: {}, event_type: 'card' }]);
        w.logMessageT?.('event', '🃏 {name}：{desc}', { name: c.name, desc: c.desc });
        w.dailyNews?.collectEvent?.('event', `${name}${t('：')}${desc}`, 9, []);
        try { w.onEventCard?.('played', this.toEntry(w, entry)); } catch (e) {}
        // 反應：牽涉的人優先，再來是相關職業，最後隨機，最多三人（LLM 非同步）
        const npcs = this._npcs(w); const pick = [];
        for (const id2 of entry.affected) { const a = w.agents[id2]; if (a && npcs.includes(a) && !pick.includes(a)) pick.push(a); }
        for (const j of (c.jobs || [])) for (const a of npcs) if (a.job?.key === j && !pick.includes(a)) pick.push(a);
        while (pick.length < EventCardSystem.MAX_REACTIONS && pick.length < npcs.length) { const a = npcs[Math.floor(Math.random() * npcs.length)]; if (!pick.includes(a)) pick.push(a); }
        this._react(w, entry, pick.slice(0, EventCardSystem.MAX_REACTIONS), `${name}${t('：')}${desc}`);
        return { ok: true, entry: this.toEntry(w, entry) };
    }
    async _react(w, entry, npcs, eventText) {
        const eng = w.conversationEngine;
        for (let i = 0; i < npcs.length; i++) {
            const npc = npcs[i];
            let text = '';
            try { if (eng?.reactToEvent) text = await eng.reactToEvent(w, npc, eventText, entry.cat); } catch (e) { console.warn('[EventCards] react', e); }
            let fb = false; if (!text) { text = this._fallbackLine(npc, entry.cat, entry.reactions.map(r => r.text)); fb = true; } // v6.74.1 預設台詞要標出來,同一張卡不重複
            entry.reactions.push({ agentId: npc.agentId, name: npc.name, text, fb });
            npc.memory?.addT?.(w.tickCount, w.clock.timeStr, 'event', '關於「{name}」我說：{text}', { name: entry.name, text }, 6, []);
            w.logMessageT?.('event', '💬 {who}：{text}', { who: npc.name, text }, npc.name);
            try { w.onEventCard?.('reaction', this.toEntry(w, entry), npc, text); } catch (e) {}
            await new Promise(r => setTimeout(r, 1200)); // 泡泡錯開
        }
    }
    _fallbackLine(npc, cat, used = []) {
        const tr = npc.personality?.traits || [];
        const P = {
            disaster: [tr.includes('optimist') ? '撐過去就好了，大家一起扛。' : tr.includes('pessimist') ? '我就知道遲早會出事……' : '先把能救的救回來再說。', '老天爺這是在考驗我們嗎？'],
            mishap:   [tr.includes('kind') ? '誰最倒楣？我去看看能幫什麼。' : tr.includes('greedy') ? '損失算誰的？公庫可別全賠。' : '這事得查清楚，不能就這樣算了。', '鎮上最近怎麼這麼不太平。'],
            fortune:  [tr.includes('greedy') ? '好事！這下公庫鬆口氣了。' : tr.includes('shy') ? '真的嗎……那太好了。' : '太好了！今晚該喝一杯。', '好運來了就要抓住。'],
            social:   [tr.includes('shy') ? '這種事……我還是別多嘴。' : tr.includes('charismatic') ? '我去勸勸，話說開就好了。' : '鎮上這麼小，什麼都藏不住。', '唉，人跟人之間的事最難。'],
        };
        const arr = (P[cat] || P.social).map(x => t(x)); const fresh = arr.filter(x => !used.includes(x)); const pool = fresh.length ? fresh : arr; return pool[Math.floor(Math.random() * pool.length)];
    }

    // ---------- 每日：接上後續提案、七天後變化 ----------
    daily(w) {
        const day = this._abs(w);
        if (this._lastDay !== day) { this._lastDay = day; this._todayCount = 0; }
        const ps = w.proposals; if (!ps) return;
        for (const e of this.played) {
            if (day - e.day <= 4) {
                for (const p of ps.items) if (p.createdDay >= e.day && p.createdDay <= e.day + 3 && !e.proposals.includes(p.id)) e.proposals.push(p.id);
            }
            if (!e.outcome && e.snap && day - e.day >= 7) {
                const now = this._snapshot(w, day), s = e.snap;
                e.outcome = { silver: now.silver - s.silver, food: now.food - s.food, mood: now.mood - s.mood, pop: now.pop - s.pop };
                w.logMessageT?.('event', '📈 「{name}」七天後：{text}', { name: e.name, text: this.outcomeText(e.outcome) });
                try { w.onEventCard?.('outcome', this.toEntry(w, e)); } catch (err) {}
            }
        }
    }
    _snapshot(w, day) { const n = this._npcs(w); return { day, silver: Math.round(w.stockpile?.get?.('silver') || 0), food: Math.round(w.stockpile?.get?.('food') || 0), mood: Math.round(n.length ? n.reduce((a, x) => a + (x.mood || 0), 0) / n.length : 0), pop: n.length }; }
    outcomeText(o) { if (!o) return ''; const sg = (n) => (n > 0 ? '+' : '') + n; const parts = []; if (o.mood) parts.push(`${t('心情')} ${sg(o.mood)}`); if (o.silver) parts.push(`${t('公庫')} ${sg(o.silver)}`); if (o.food) parts.push(`${t('食物')} ${sg(o.food)}`); if (o.pop) parts.push(`${t('人口')} ${sg(o.pop)}`); return parts.length ? parts.join(t('、')) : t('鎮上沒什麼變化'); }
    toEntry(w, e) {
        const ps = w.proposals;
        return { id: e.id, day: e.day, cat: e.cat, catLabel: t(EVENT_CARD_CATS[e.cat]?.label || ''), icon: e.icon, name: t(e.name), detail: e.detail, affected: e.affected, loc: e.loc,
            reactions: e.reactions.map(r => ({ agentId: r.agentId, name: t(r.name), text: r.text, fb: !!r.fb })),
            proposals: (e.proposals || []).map(id => { const p = ps?.byId?.(id); return p ? { id, title: ps.title(p), status: p.status, kind: p.kind, proposer: t(p.proposerName) } : { id }; }),
            outcome: e.outcome, outcomeText: e.outcome ? this.outcomeText(e.outcome) : '', daysAgo: this._abs(w) - e.day };
    }
    toDict(w) { return { hand: this.hand(w), played: this.played.slice(-8).reverse().map(e => this.toEntry(w, e)), stats: this.stats, perDay: EventCardSystem.MAX_PER_DAY, todayLeft: Math.max(0, EventCardSystem.MAX_PER_DAY - this._todayCount) }; }
    serialize() { return { cooldown: this.cooldown, played: this.played.slice(-30), stats: this.stats, lastDay: this._lastDay, todayCount: this._todayCount }; }
    loadFrom(d) { if (!d) return; this.cooldown = d.cooldown || {}; this.played = d.played || []; this.stats = d.stats || { played: 0 }; this._lastDay = d.lastDay ?? null; this._todayCount = d.todayCount || 0; }
}
if (typeof window !== 'undefined') { window.EventCardSystem = EventCardSystem; window.EVENT_CARDS = EVENT_CARDS; window.EVENT_CARD_CATS = EVENT_CARD_CATS; }
