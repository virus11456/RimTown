// 擬人化智能體 D1：共用主觀評估流程（離線影子模式）
// 設計：DESIGN_HUMANLIKE_D0.md 5.2～5.5、DESIGN_HUMANLIKE_D1.md
//
// 這個檔案「不」載入正式遊戲（town.html、sw.js 都沒有它），只由測試腳本注入。
// 它不決定任何人該在乎什麼、該選什麼：
//   - 沒有事件名稱判斷（不看 kind === 'asked' 之類）、沒有選項分數、沒有機率、沒有亂數。
//   - 引擎事實（成本、算術、合法性）由領域 adapter 經「讀取器」提供；主觀理解與選擇由可替換的評估器提出。
//   - 影子流程不執行任何動作、不寫世界、不寫角色記憶或心理。
//
// 主要介面：
//   PSY.snapshot(w, adapter, event)        決策前快照：只經讀取器取本人可知資料，記下讀取清單
//   PSY.tap(DECIDE, adapter, sink)         掛在選擇點的候選清單之後，只拍快照放進外部 sink，回傳值原封不動
//   PSY.evaluate(snap, chain, opts)        兩階段評估（先 appraisal 凍結，再 choice），含驗證、快取、故障處理
//   PSY.validateInput / validateAppraisal / validateChoice
//   PSY.ReplayEvaluator(fixtures)          人工標記的固定回應重播（只供工程測試，不是角色行為）
//   PSY.ResearchLog、PSY.diff、PSY.sha256、PSY.stable
const PSY = (() => {
    const CONTRACT = 1;

    // ---------------- 小工具：穩定序列化、SHA-256、深凍結、深拷貝 ----------------
    const stable = (v) => {
        if (v === undefined) return 'null';
        if (v === null || typeof v !== 'object') return JSON.stringify(v);
        if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
        return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
    };
    // 純 JS SHA-256（同步、瀏覽器與 Node 結果相同；測試會對照 Node crypto）
    const K256 = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    function utf8(s) { const out = []; for (let i = 0; i < s.length; i++) { let c = s.charCodeAt(i); if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) { const d = s.charCodeAt(i + 1); if (d >= 0xdc00 && d < 0xe000) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; } } if (c < 0x80) out.push(c); else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63)); else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); } return out; }
    function sha256(str) {
        const b = utf8(String(str)); const l = b.length * 8; b.push(0x80); while (b.length % 64 !== 56) b.push(0);
        for (let i = 7; i >= 0; i--) b.push(i >= 4 ? 0 : (l >>> (i * 8)) & 255);
        let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]; const W = new Array(64);
        const rr = (x, n) => (x >>> n) | (x << (32 - n));
        for (let o = 0; o < b.length; o += 64) {
            for (let i = 0; i < 16; i++) W[i] = (b[o + i * 4] << 24) | (b[o + i * 4 + 1] << 16) | (b[o + i * 4 + 2] << 8) | b[o + i * 4 + 3];
            for (let i = 16; i < 64; i++) { const s0 = rr(W[i - 15], 7) ^ rr(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = rr(W[i - 2], 17) ^ rr(W[i - 2], 19) ^ (W[i - 2] >>> 10); W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0; }
            let [a, bb, c, d, e, f, g, h] = H;
            for (let i = 0; i < 64; i++) { const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K256[i] + W[i]) | 0, S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), mj = (a & bb) ^ (a & c) ^ (bb & c), t2 = (S0 + mj) | 0; h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0; }
            H = [H[0] + a, H[1] + bb, H[2] + c, H[3] + d, H[4] + e, H[5] + f, H[6] + g, H[7] + h].map(x => x | 0);
        }
        return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
    }
    const hashOf = (v) => sha256(stable(v));
    const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
    function freeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) freeze(o[k]); } return o; }

    // ---------------- 讀取器：adapter 只能經過這裡讀世界 ----------------
    // 每次讀取都記進 manifest（讀了什麼、屬於誰、為什麼可以讀）。讀別人私有的欄位直接丟 BoundaryError。
    class BoundaryError extends Error { constructor(m) { super(m); this.name = 'BoundaryError'; } }
    function reader(w, selfId) {
        const manifest = []; const note = (path, owner, why) => manifest.push({ path, owner, why });
        const self = w.agents?.[selfId]; if (!self) throw new BoundaryError('no_self');
        const isSelf = (id) => id === selfId;
        const R = {
            selfId, manifest,
            // 本人的私有狀態
            selfCash() { note('wallet.bal[self]', 'self', 'own_money'); const v = w.wallet?.bal?.[selfId]; return typeof v === 'number' ? Math.round(v * 100) / 100 : null; },
            cashOf(id) { if (!isSelf(id)) throw new BoundaryError('read_other_cash:' + id); return R.selfCash(); },
            selfState() { note('agent[self].needs/mood/personality', 'self', 'own_state'); return { name: self.name, age: self.age ?? null, mood: typeof self.mood === 'number' ? Math.round(self.mood) : null, needs: clone(self.needs ? Object.fromEntries(Object.entries(self.needs).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, Math.round(v)])) : {}), traits: clone(self.personality?.traits || []), values: clone(self.personality?.values || []), job: self.job?.key || null }; },
            selfMemories() { note('agent[self].memory.entries', 'self', 'own_memory'); return clone((self.memory?.entries || []).map(e => ({ tick: e.tick ?? 0, content: String(e.content ?? ''), importance: e.importance ?? 5, cat: e.category || '', rel: (e.relatedAgents || []).slice() }))); },
            ownFeeling(otherId) { note('agent[self].relationships[' + otherId + ']', 'self', 'own_feeling'); const r = self.relationships?.relationships?.[otherId]; return r ? { affinity: Math.round(r.affinity || 0), trust: Math.round(r.trust || 0), status: r.status || null } : null; },
            // 本人是當事人的紀錄（自己借出去／借進來的錢）
            ownLoans() { note('dark.debts[l=self|r=self]', 'self', 'party_to_record'); return clone((w.dark?.debts || []).filter(d => d.l === selfId || d.r === selfId).map(d => ({ l: d.l, r: d.r, n: d.n, day: d.day, due: d.due, done: !!d.done }))); },
            ownBankLoan() { note('bank.loans[self]', 'self', 'party_to_record'); const L = w.bank?.loans?.[selfId]; return L ? { owed: Math.round((L.owed || 0) * 100) / 100 } : null; },
            // 同住家人：誰是家人是公開的身分關係；家人的病痛視為同一戶看得見的事
            household() { note('family(spouse/parents/children)', 'household', 'household_identity'); const out = []; const RR = self.relationships?.relationships || {};
                for (const id of Object.keys(RR).sort()) { const o = w.agents[id]; if (o && !o.isDead && RR[id].status === 'married') out.push({ id, name: o.name, rel: 'spouse', age: o.age ?? null }); }
                for (const o of Object.values(w.agents).sort((x, y) => String(x.agentId).localeCompare(String(y.agentId)))) { if (!o || o.isDead || o === self) continue; if ((self._parentNames || []).includes(o.name) && !out.some(x => x.id === o.agentId)) out.push({ id: o.agentId, name: o.name, rel: 'parent', age: o.age ?? null }); if ((o._parentNames || []).includes(self.name) && !out.some(x => x.id === o.agentId)) out.push({ id: o.agentId, name: o.name, rel: 'child', age: o.age ?? null }); }
                return out; },
            ailmentsOf(id, hh) { const ok = isSelf(id) || (hh || []).some(x => x.id === id); if (!ok) throw new BoundaryError('read_other_health:' + id); note('health.a[' + (isSelf(id) ? 'self' : 'household') + ']', isSelf(id) ? 'self' : 'household', 'visible_in_household'); return clone((w.health?.a?.[id] || []).map(x => ({ k: x.k, s: x.s, p: x.p }))); },
            // 公開資訊：名字、大致年紀、職業
            publicOf(id) { const o = w.agents?.[id]; note('agent[' + id + '].public', 'public', 'public_identity'); return o ? { id, name: o.name, job: o.job?.key || null, age: o.age ?? null } : null; },
            day() { note('clock.day', 'public', 'calendar'); return typeof w._absDay === 'function' ? w._absDay() : 0; },
            tick() { note('tickCount', 'public', 'calendar'); return w.tickCount || 0; },
        };
        return R;
    }

    // 不改寫任何資料的記憶檢索（與 Memory.retrieve 同公式，但不寫 _bi 快取、不碰原物件）
    const bigrams = (s) => { const t = String(s || '').replace(/\s+/g, ''); const set = new Set(); for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2)); return set; };
    function recallPure(mems, focalText, focalNames, n, nowTick) {
        const q = bigrams(focalText);
        return mems.map((e, idx) => {
            const age = Math.max(0, (nowTick - e.tick) / 96); const rec = Math.pow(0.85, age); const imp = Math.min(10, e.importance || 5) / 10;
            const eb = bigrams(e.content); let ov = 0; for (const b of q) if (eb.has(b)) ov++;
            const dice = (q.size + eb.size) ? (2 * ov) / (q.size + eb.size) : 0; let hit = 0; for (const nm of focalNames) if ((e.rel || []).includes(nm) || e.content.includes(nm)) hit = 1;
            return { e, idx, s: 0.5 * rec + 3 * Math.min(1, dice * 2 + hit * 0.6) + 2 * imp };
        }).sort((a, b) => b.s - a.s || b.e.tick - a.e.tick || a.idx - b.idx).slice(0, n).sort((a, b) => a.e.tick - b.e.tick || a.idx - b.idx);
    }
    const memId = (e) => 'm_' + sha256(e.tick + '|' + e.content).slice(0, 10);

    // 共用的通用行動：每種事件都可以選（不決定誰會選）
    const GENERIC = [
        { opt: 'defer', label: '先不決定，晚點再說', params: {}, cost: {}, engine_now: 'not_supported' },
        { opt: 'ask', label: '先問清楚再決定', params: { question: { type: 'text' } }, cost: {}, engine_now: 'not_supported' },
        { opt: 'consult', label: '找信得過的人商量', params: { who: { type: 'agent_or_none' } }, cost: {}, engine_now: 'not_supported' },
    ];

    // ---------------- 快照 ----------------
    // adapter.build(R, event) 回傳 { seen, views, obligations, options, derived, focus:{text,names}, label }
    // 這裡補上本人狀態、家人、可取用記憶、編號、版本，並凍結。
    function snapshot(w, adapter, event, opts = {}) {
        const t0 = { rnd: 0 }; const mr = Math.random; let r;
        Math.random = function () { t0.rnd++; return 0.5; }; // 快照不准用亂數：不往下呼叫（不消耗世界的亂數序列），只計數讓測試抓到
        try {
            const R = reader(w, event.agent);
            const dom = adapter.build(R, event);
            const st = R.selfState(); const cashV = R.selfCash(); const hh = R.household(); const nowT = R.tick(); const d = R.day();
            const mems = R.selfMemories();
            const rec = recallPure(mems, dom.focus?.text || '', dom.focus?.names || [], opts.recallN || 6, nowT);
            const recall = rec.map(x => ({ id: memId(x.e), text: x.e.content, days_ago: Math.round((nowT - x.e.tick) / 96), src: 'memory' }));
            const self = { id: event.agent, name: st.name, cash: cashV == null ? { id: 's_cash', v: null, status: 'unknown' } : { id: 's_cash', v: cashV }, age: st.age, mood: st.mood, needs: st.needs, traits: st.traits, values: st.values, job: st.job, household: hh, obligations: dom.obligations || [] };
            const options = (dom.options || []).concat(GENERIC.map(g => clone(g)));
            const body = { contract: CONTRACT, label: dom.label || null, day: d, self, seen: dom.seen || [], recall, views: dom.views || [], options, derived: dom.derived || [] };
            body.versions = { state: hashOf(body.self).slice(0, 16), knowledge: hashOf([body.seen, body.recall, body.views]).slice(0, 16), candidates: hashOf(body.options).slice(0, 16) };
            const ids = { agent: event.agent, event: event.id, decision: event.decision || event.id, world: event.world || null };
            r = { input: freeze({ ...body, ids }), audit: { manifest: R.manifest, rnd: 0 } };
        } catch (e) {
            r = { input: null, audit: { error: e.name === 'BoundaryError' ? 'boundary:' + e.message : 'snapshot_error:' + e.message, rnd: 0 } };
        } finally { Math.random = mr; }
        r.audit.rnd = t0.rnd; return r;
    }

    // 所有可以被引用的編號
    function idSet(input) {
        const s = new Set(); if (!input) return s; const add = (x) => x && x.id && s.add(x.id);
        add(input.self?.cash); (input.self?.obligations || []).forEach(add); (input.seen || []).forEach(add); (input.recall || []).forEach(add); (input.views || []).forEach(add); (input.derived || []).forEach(add);
        (input.options || []).forEach(o => s.add('opt:' + o.opt)); return s;
    }

    // ---------------- 驗證 ----------------
    const VIEW_KINDS = ['own_feeling', 'own_experience', 'promise', 'said', 'heard', 'public', 'unknown'];
    const FORBIDDEN_INPUT_KEYS = ['outcome', 'result', 'old_choice', 'oldPick', 'pick', 'base', 'lean', 'score', 'prob', 'weight'];
    function validateInput(input) {
        const errs = []; if (!input) return ['no_input'];
        if (input.contract !== CONTRACT) errs.push('contract_mismatch');
        const walk = (v, p) => { if (v && typeof v === 'object') for (const k of Object.keys(v)) { if (FORBIDDEN_INPUT_KEYS.includes(k)) errs.push('forbidden_key:' + p + k); walk(v[k], p + k + '.'); } };
        walk(input, '');
        const ids = []; const push = (x) => x && x.id && ids.push(x.id); push(input.self?.cash); (input.self?.obligations || []).forEach(push); ['seen', 'recall', 'views', 'derived'].forEach(k => (input[k] || []).forEach(push));
        if (new Set(ids).size !== ids.length) errs.push('duplicate_ids');
        const ops = (input.options || []).map(o => o.opt); if (new Set(ops).size !== ops.length) errs.push('duplicate_options');
        // 對他人的看法：引擎只能提供本人的感受、本人經歷、對方說過的話（承諾不是事實）、轉述、公開資訊、未知；不能替角色推測
        for (const v of input.views || []) if (!VIEW_KINDS.includes(v.kind)) errs.push('view_kind:' + v.id + ':' + v.kind);
        return errs;
    }

    const STATUS = ['derived', 'inferred', 'unknown'];
    const nums = (s) => (String(s).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    function sourceText(input, id) {
        const pools = [[input.self?.cash], input.self?.obligations, input.seen, input.recall, input.views, input.derived];
        for (const p of pools) for (const x of p || []) if (x && x.id === id) return stable(x);
        if (id.startsWith('opt:')) { const o = (input.options || []).find(z => 'opt:' + z.opt === id); return o ? stable(o) : ''; }
        return '';
    }
    // 回傳 { ok, errors[], notes[] }：errors 讓這份評估作廢；notes 是證據不足之類，要記錄但不等於越界
    function validateAppraisal(input, ap) {
        const errors = [], notes = []; const ids = idSet(input);
        if (!ap || typeof ap !== 'object') return { ok: false, errors: ['not_object'], notes };
        if (ap.contract !== CONTRACT) errors.push('contract_mismatch');
        if (!Array.isArray(ap.concerns) || !ap.concerns.length) errors.push('no_concerns');
        const cids = new Set(); for (const c of ap.concerns || []) { if (!c.id || cids.has(c.id)) errors.push('concern_id:' + c.id); cids.add(c.id); if (!c.what) errors.push('concern_text:' + c.id); for (const e of c.ev || []) if (!ids.has(e)) errors.push('unknown_source:' + e); if (!(c.ev || []).length) notes.push('concern_without_source:' + c.id); }
        if (!ap.reading || !ap.reading.what) errors.push('no_reading');
        const optIds = (input.options || []).map(o => o.opt); const covered = new Map();
        for (const im of ap.impacts || []) {
            if (!optIds.includes(im.opt)) { errors.push('impact_unknown_option:' + im.opt); continue; }
            covered.set(im.opt, (covered.get(im.opt) || 0) + 1);
            for (const k of ['like', 'dislike']) for (const c of im[k] || []) if (!cids.has(c)) errors.push('impact_unknown_concern:' + im.opt + ':' + c);
            for (const x of im.expect || []) {
                if (!STATUS.includes(x.status)) errors.push('expect_status:' + im.opt);
                for (const e of x.ev || []) if (!ids.has(e)) errors.push('unknown_source:' + e);
                if (x.status === 'derived') {
                    if (!(x.ev || []).length) notes.push('unsupported_assertion:' + im.opt + ':' + x.what);
                    else { const src = (x.ev || []).map(e => sourceText(input, e)).join(' '); const srcN = new Set(nums(src).map(String)); for (const n of nums(x.what)) if (!srcN.has(String(n))) notes.push('number_not_in_sources:' + im.opt + ':' + n); }
                }
                if (x.status === 'inferred' && !(x.ev || []).length) notes.push('inference_without_basis:' + im.opt);
            }
        }
        for (const nc of ap.not_considered || []) { if (!optIds.includes(nc.opt)) errors.push('nc_unknown_option:' + nc.opt); covered.set(nc.opt, (covered.get(nc.opt) || 0) + 1); }
        for (const o of optIds) { const n = covered.get(o) || 0; if (n === 0) errors.push('option_not_addressed:' + o); }
        // 評估階段不能先選，也不能宣布結果
        for (const k of ['opt', 'choice', 'act', 'result', 'outcome', 'success', 'agreed']) if (k in ap) errors.push('appraisal_has_' + k);
        return { ok: errors.length === 0, errors, notes };
    }
    const OUTCOME_KEYS = ['result', 'outcome', 'success', 'agreed', 'accepted', 'paid', 'rel_change', 'delta', 'affinity', 'trust'];
    function paramOk(spec, v) {
        if (!spec) return v === undefined;
        if (spec.type === 'int') return Number.isInteger(v) && v >= spec.min && v <= spec.max;
        if (spec.type === 'text') return v === undefined || typeof v === 'string';
        if (spec.type === 'agent_or_none') return v === undefined || v === null || typeof v === 'string';
        return false;
    }
    function validateChoice(input, ap, ch) {
        const errors = []; if (!ch || typeof ch !== 'object') return { ok: false, errors: ['not_object'] };
        if (ch.contract !== CONTRACT) errors.push('contract_mismatch');
        const op = (input.options || []).find(o => o.opt === ch.opt); if (!op) return { ok: false, errors: errors.concat('illegal_option:' + ch.opt) };
        const ps = op.params || {}; const given = ch.params || {};
        for (const k of Object.keys(given)) if (!(k in ps)) errors.push('unknown_param:' + k);
        for (const k of Object.keys(ps)) if (!paramOk(ps[k], given[k])) errors.push('bad_param:' + k);
        const cids = new Set((ap.concerns || []).map(c => c.id)); for (const c of ch.because || []) if (!cids.has(c)) errors.push('because_unknown:' + c);
        if (!(ch.because || []).length) errors.push('no_because');
        const considered = new Set((ap.impacts || []).map(i => i.opt)); if (!considered.has(ch.opt)) errors.push('chose_unconsidered_option');
        for (const k of OUTCOME_KEYS) if (k in ch || (ch.act && k in ch.act)) errors.push('claims_outcome:' + k);
        for (const k of ['concerns', 'impacts', 'reading', 'not_considered']) if (k in ch) errors.push('choice_rewrites_' + k);
        if (ch.act && ch.act.opt && ch.act.opt !== ch.opt) errors.push('act_mismatch');
        return { ok: errors.length === 0, errors };
    }

    // ---------------- 評估器 ----------------
    // 介面：{ id, version, contract, appraise(input) → Promise<物件或字串>, choose(input, appraisal) → Promise<物件或字串> }
    const conforms = (ev) => !!ev && ev.contract === CONTRACT && typeof ev.appraise === 'function' && typeof ev.choose === 'function' && !!ev.id && !!ev.version;
    // 人工標記的固定回應：只供工程測試。沒有人工標記（label）的回應一律拒用。
    function ReplayEvaluator(fixtures, meta = {}) {
        const used = new Map();
        const get = (input, stage) => { const key = inputKey(input); const f = fixtures[key]; if (!f) throw Object.assign(new Error('no_fixture'), { fail: 'no_response' }); if (f.label !== 'TEST_FIXTURE_HANDWRITTEN') throw Object.assign(new Error('unlabeled_fixture'), { fail: 'unlabeled_fixture' }); used.set(key + stage, (used.get(key + stage) || 0) + 1); return clone(f[stage]); };
        return { id: meta.id || 'replay-fixture', version: meta.version || '1', contract: CONTRACT, fixture: true, used,
            appraise: async (input) => get(input, 'appraisal'), choose: async (input) => get(input, 'choice') };
    }
    // 快取與重播的鍵：本人、相關輸入、候選參數、契約版本（不含每次事件都不同的編號與日期）
    function inputKey(input) { if (!input) return null; const { ids, day, ...rest } = input; return hashOf({ agent: ids?.agent, rest }); }
    function cacheKey(input, ev) { return hashOf({ k: inputKey(input), ev: ev.id + '@' + ev.version, c: CONTRACT }); }

    const parse = (raw) => { if (raw && typeof raw === 'object') return { v: raw }; try { return { v: JSON.parse(String(raw)) }; } catch (e) { return { err: 'bad_json' }; } };
    const withTimeout = (p, ms) => new Promise((res, rej) => { const h = setTimeout(() => rej(Object.assign(new Error('timeout'), { fail: 'timeout' })), ms); p.then(v => { clearTimeout(h); res(v); }, e => { clearTimeout(h); rej(e); }); });

    // 兩階段評估。chain：依序嘗試的評估器（都要符合契約）；cache：Map；log：ResearchLog
    // 回傳一筆研究紀錄。任何技術問題都記在 status/fail，不會替角色產生選擇。
    async function evaluate(snap, chain, opts = {}) {
        const { cache = null, log = null, timeoutMs = 2000 } = opts; const input = snap?.input;
        const rec = { contract: CONTRACT, ids: input?.ids || null, input_key: inputKey(input), input_hash: input ? hashOf(input) : null, versions: input?.versions || null, tries: [], status: 'pending', fail: null, appraisal: null, appraisal_hash: null, choice: null, evaluator: null, from_cache: false, notes: [] };
        const finish = () => { if (log) log.add(rec); return rec; };
        if (!input) { rec.fail = snap?.audit?.error || 'no_input'; return finish(); }
        const ie = validateInput(input); if (ie.length) { rec.fail = 'invalid_input'; rec.notes = ie; return finish(); }
        if (cache) for (const ev of chain) { if (!conforms(ev)) continue; const hit = cache.get(cacheKey(input, ev)); if (hit) { Object.assign(rec, { status: 'done', appraisal: hit.appraisal, appraisal_hash: hit.appraisal_hash, choice: hit.choice, evaluator: hit.evaluator, from_cache: true, notes: hit.notes.slice() }); return finish(); } }
        for (const ev of chain) {
            const tr = { evaluator: ev && ev.id ? ev.id + '@' + ev.version : 'unknown', fail: null };
            rec.tries.push(tr);
            if (!conforms(ev)) { tr.fail = 'evaluator_not_conforming'; continue; }
            try {
                const view = freeze(clone(input)); // 評估器拿到的是唯讀副本，看不到 audit
                const a0 = parse(await withTimeout(Promise.resolve(ev.appraise(view)), timeoutMs)); if (a0.err) { tr.fail = a0.err + '@appraisal'; continue; }
                const va = validateAppraisal(input, a0.v); if (!va.ok) { tr.fail = 'invalid_appraisal'; tr.errors = va.errors; continue; }
                const ap = freeze(clone(a0.v)); const aHash = hashOf(ap);
                const c0 = parse(await withTimeout(Promise.resolve(ev.choose(view, ap)), timeoutMs)); if (c0.err) { tr.fail = c0.err + '@choice'; continue; }
                const vc = validateChoice(input, ap, c0.v); if (!vc.ok) { tr.fail = vc.errors.some(e => e.startsWith('illegal_option')) ? 'illegal_option' : 'invalid_choice'; tr.errors = vc.errors; continue; }
                if (hashOf(ap) !== aHash) { tr.fail = 'appraisal_mutated'; continue; }
                Object.assign(rec, { status: 'done', fail: null, appraisal: ap, appraisal_hash: aHash, choice: freeze(clone(c0.v)), evaluator: { id: ev.id, version: ev.version, fixture: !!ev.fixture }, notes: va.notes });
                if (cache) cache.set(cacheKey(input, ev), { appraisal: rec.appraisal, appraisal_hash: aHash, choice: rec.choice, evaluator: rec.evaluator, notes: va.notes.slice() });
                return finish();
            } catch (e) { tr.fail = e.fail || ('error:' + e.message); }
        }
        // 全部失敗：技術性待處理。不替角色選任何行動，也不寫進心理。
        rec.status = 'pending'; rec.fail = rec.tries.length ? rec.tries[rec.tries.length - 1].fail : 'no_evaluator'; return finish();
    }

    // ---------------- 研究紀錄與比較 ----------------
    class ResearchLog {
        constructor() { this.rows = []; this.byDecision = new Map(); this.rejected = []; }
        add(rec) { const k = rec.ids?.decision; if (k && this.byDecision.has(k)) { this.rejected.push({ decision: k, reason: 'duplicate_response' }); return false; } if (k) this.byDecision.set(k, rec); this.rows.push(rec); return true; }
        toJSON() { return { contract: CONTRACT, rows: this.rows, rejected: this.rejected }; }
    }
    function diff(a, b, p = '', out = []) {
        if (stable(a) === stable(b)) return out;
        if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) === !Array.isArray(b)) {
            const ks = new Set([...Object.keys(a), ...Object.keys(b)]); for (const k of [...ks].sort()) diff(a[k], b[k], p ? p + '.' + k : k, out);
        } else out.push({ path: p, a: a === undefined ? '(無)' : a, b: b === undefined ? '(無)' : b });
        return out;
    }

    // ---------------- 影子掛勾 ----------------
    // 包住選擇點的候選清單函式：原函式先跑、回傳值原封不動；之後只拍快照放進外部 sink。
    // 不呼叫 run、不碰 AI、不寫世界。任何錯誤都吞掉並記在 sink 裡，不會影響原流程。
    function tap(DECIDE, adapter, sink) {
        const K = DECIDE?.KINDS?.[adapter.observes]; if (!K || K._psyTapped) return () => {};
        const orig = K.options; const seen = new Set();
        K.options = function (w, a, ctx) {
            const out = orig.apply(this, arguments);
            try {
                const ev = adapter.eventOf(w, a, ctx); const key = ev && ev.id;
                if (ev && !seen.has(key)) {
                    seen.add(key);
                    const before = (w.decide?.log?.[a.agentId] || []).length; // 給測試核對「快照在決定之前」，不給評估器
                    const s = snapshot(w, adapter, ev); s.audit.log_len_before = before; s.audit.kind = adapter.observes; sink.push(s);
                }
            } catch (e) { sink.push({ input: null, audit: { error: 'tap_error:' + e.message } }); }
            return out;
        };
        K._psyTapped = true;
        return () => { K.options = orig; delete K._psyTapped; };
    }

    return { CONTRACT, stable, sha256, hashOf, freeze, clone, BoundaryError, reader, recallPure, snapshot, idSet, validateInput, validateAppraisal, validateChoice, conforms, ReplayEvaluator, inputKey, cacheKey, evaluate, ResearchLog, diff, tap, GENERIC };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PSY; else if (typeof globalThis !== 'undefined') globalThis.PSY = PSY;
