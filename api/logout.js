module.exports = async (req, res) => {
    // JWT 無伺服器端狀態,前端丟棄 token 即登出
    return res.status(200).json({ success: true });
};
