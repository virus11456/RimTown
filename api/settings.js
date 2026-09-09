// v5.33.0 帳號設定雲端同步:額度隨帳號走,換裝置登入即自動帶入
// v5.65.0 AI 全面內建:所有 AI 金鑰只存在 Vercel 環境變數(LLM_*/GROQ_API_KEY),
// 帳號設定不再保存任何玩家金鑰;舊版留下的 llm_api_key/fallback_groq_key 在讀取時過濾、寫入時清除
const L = require('./_lib');

module.exports = async (req, res) => {
    const payload = L.authUser(req);
    if (!payload) return L.err(res, 401, 'unauthorized', '請先登入');
    const uname = payload.u.toLowerCase();
    const path = `settings/${uname}.json`;

    if (req.method === 'GET') {
        const data = await L.readJson(path);
        if (data) { delete data.llm_api_key; delete data.fallback_groq_key; delete data.llm_provider; }
        return res.status(200).json({ settings: data || null });
    }

    if (req.method === 'POST') {
        if (!L.rateLimit(`settings:${uname}`, 30, 300)) return L.err(res, 429, 'rate_limited', '請稍後再試');
        const b = req.body || {};
        const prev = (await L.readJson(path)) || {};
        const s = { ...prev };
        // v5.65.0 玩家金鑰不再落地:不論前端送什麼,舊欄位一律清掉
        delete s.llm_api_key; delete s.fallback_groq_key; delete s.llm_provider;
        if (b.npc_llm_budget !== undefined && Number.isFinite(parseInt(b.npc_llm_budget, 10))) {
            // v5.37.0 -1 = 無上限(預設);0 = 關閉;正數 = 每日上限
            s.npc_llm_budget = Math.max(-1, Math.min(9999, parseInt(b.npc_llm_budget, 10)));
        }
        // v5.73.0 AI 對話語言(auto=跟隨介面 / zh / en)隨帳號同步
        if (['auto', 'zh', 'en'].includes(b.dialogue_lang)) s.dialogue_lang = b.dialogue_lang;
        s.updated_at = new Date().toISOString();
        await L.writeJson(path, s);
        return res.status(200).json({ success: true });
    }

    return L.err(res, 405, 'method_not_allowed', 'GET/POST only');
};
