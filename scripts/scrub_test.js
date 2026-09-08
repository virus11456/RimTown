// 存檔清理測試:World.scrubAssistantLeaks 深度掃描,清掉 AI 助理漏出的拒絕/自報身分文字,不誤傷正常台詞
const fs = require('fs'); const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'chrome-extension', 'simulation.js'), 'utf8');
function extractStatic(name) {
  const i = src.indexOf('    static ' + name + '(');
  let j = src.indexOf('{', i), depth = 0;
  for (let k = j; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}') { depth--; if (!depth) return src.slice(i + 4, k + 1); } }
}
require(path.join(__dirname, '..', 'chrome-extension', 's2t.js'));
const World = eval('(class World {\n' + extractStatic('looksLikeAssistantLeak') + '\n' + extractStatic('scrubAssistantLeaks') + '\n})');
const LEAK = "I can't do this. I'm Kiro, an AI development environment designed to help with software engineering, infrastructure, and technical tasks. I'm not designed for roleplay scenarios.";
const save = {
  version: 5, tickCount: 100,
  agents: { player: { chatHistory: [ { speaker: '旅人', text: '你好' }, { speaker: '黃莉', text: LEAK }, { speaker: '黃莉', text: '(壓低聲音) 千真萬確!吳達和楊鋒鬧翻了' } ] },
            npc1: { memory: { entries: [ { content: '看到吳達正忙著鍛鐵', importance: 2 }, { content: LEAK, importance: 5 } ] }, dailyPlan: { goals: ['08:00 去田裡', LEAK] }, mood: '我不是故意要瞞你的' } },
  npcConversationLog: [ { agentA: 'A', agentB: 'B', dialogue: [ { speaker: 'A', text: '早安' }, { speaker: 'B', text: "As an AI assistant, I can't roleplay." } ], summary: '寒暄' } ],
  dramaArchive: [ { title: '對嗆', lines: ['吳達: 你少來!'] }, { title: LEAK, lines: [] } ],
  dailyNews: { items: [ { headline: '抱歉，我是一個AI語言模型，無法扮演角色。' }, { headline: '鹽場豐收' } ] },
  messageLog: [ { type: 'system', text: '已同步至雲端。' } ],
  cn: { line: '哈？(挠了挠头) 你这问的是啥呢？我跟老寡妇就是帮她修个屋顶啊', list: ['我跟秀儿结婚二十年了', '皇后說：後面的人請往前站'] },
};
const removed = World.scrubAssistantLeaks(save);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
ok(removed === 6, 'removed count = 6 (got ' + removed + ')');
ok(save.agents.player.chatHistory.length === 2 && save.agents.player.chatHistory[1].text.startsWith('(壓低聲音)'), 'chat leak removed, normal kept');
ok(save.agents.npc1.memory.entries.length === 1, 'memory leak removed');
ok(save.agents.npc1.dailyPlan.goals.length === 1, 'plan string leak removed');
ok(save.agents.npc1.mood === '我不是故意要瞞你的', 'normal Chinese line untouched');
ok(save.npcConversationLog[0].dialogue.length === 1, 'dialogue line leak removed');
ok(save.dramaArchive.length === 1, 'drama leak removed');
ok(save.dailyNews.items.length === 1 && save.dailyNews.items[0].headline === '鹽場豐收', 'news leak removed');
ok(save.messageLog.length === 1, 'system message kept');
ok(World.looksLikeAssistantLeak('你好，我是吳達，鎮上的鐵匠。') === false, 'self-intro of a villager is not a leak');
ok(save.cn.line === '哈？(撓了撓頭) 你這問的是啥呢？我跟老寡婦就是幫她修個屋頂啊', 'simplified line converted (got ' + save.cn.line + ')');
ok(save.cn.list[0] === '我跟秀兒結婚二十年了' && save.cn.list[1] === '皇后說：後面的人請往前站', 'array strings: simplified converted, traditional untouched');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
