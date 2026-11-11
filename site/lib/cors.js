// Autorise le site principal à appeler l'API via l'adresse de secours clyento.vercel.app.
const ALLOWED = new Set(["https://clyento-ai.com", "https://www.clyento-ai.com"]);

module.exports = function cors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  return false;
};
