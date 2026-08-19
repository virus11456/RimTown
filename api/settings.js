// v5.33.0 帳號設定雲端同步:AI 供應商/金鑰/額度隨帳號走,換裝置登入即自動帶入
// 金鑰與存檔同一套 AES-256-GCM 加密後存入 Vercel Blob,不以明文落地
const L = require('./_lib');

module.exports = async (req, res) => {
    const payload = L.authUser(req);
    if (!payload) return L.err(res, 401, 'unauthorized', '請先登入');
    const uname = payload.u.toLowerCase();
    const path = `settings/${uname}.json`;

    if (req.method === 'GET') {
        const data = await L.readJson(path);
        return res.status(200).json({ settings: data || null });
    }

    if (req.method === 'POST') {
        if (!L.rateLimit(`settings:${uname}`, 30, 300)) return L.err(res, 429, 'rate_limited', '請稍後再試');
        const b = req.body || {};
        const prev = (await L.readJson(path)) || {};
        // 空值不覆寫既有欄位(與前端「空欄位不洗掉金鑰」同一原則)
        const s = { ...prev };
        if (b.llm_provider) s.llm_provider = String(b.llm_provider).slice(0, 20);
        if (b.llm_api_key) s.llm_api_key = String(b.llm_api_key).slice(0, 300);
        if (b.fallback_groq_key !== undefined) s.fallback_groq_key = String(b.fallback_groq_key || '').slice(0, 300);
        if (b.npc_llm_budget !== undefined && Number.isFinite(parseInt(b.npc_llm_budget, 10))) {
            // v5.37.0 -1 = 無上限(預設);0 = 關閉;正數 = 每日上限
            s.npc_llm_budget = Math.max(-1, Math.min(9999, parseInt(b.npc_llm_budget, 10)));
        }
        s.updated_at = new Date().toISOString();
        await L.writeJson(path, s);
        return res.status(200).json({ success: true });
    }

    return L.err(res, 405, 'method_not_allowed', 'GET/POST only');
};
