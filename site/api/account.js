// Vérifie l'accès d'un abonné (en-tête X-Clyento-Sub) : renvoie son offre, ou 401.
const cors = require("../lib/cors");
const subOf = require("../lib/sub");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  const sub = await subOf(req);
  if (!sub) return res.status(401).json({ error: "Abonnement introuvable ou inactif." });
  res.status(200).json({ ok: true, plan: sub.plan, planName: sub.planName, email: sub.email });
};
