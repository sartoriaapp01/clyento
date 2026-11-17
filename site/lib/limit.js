// Limite les recherches gratuites par connexion (adresse IP), pour protéger les crédits Claude.
// Compteur gardé en mémoire : il repart à zéro quand Vercel relance la fonction, ce qui suffit contre les abus courants.
// Les fondateurs testent sans limite : le site ouvert une fois avec ?test=<clé des fondateurs>.

const crypto = require("crypto");
// Empreinte de la clé des fondateurs (la clé elle-même n'est pas dans le code) ; TEST_KEY dans Vercel reste possible en plus.
const FOUNDER_HASH = "594193e1517c865eb7ef2eb6458f2d5f57c5692f9ca8bd26f5dff7db273038ec";
const isTester = k => !!k && (k === process.env.TEST_KEY || crypto.createHash("sha256").update(String(k)).digest("hex") === FOUNDER_HASH);
const hits = new Map(); // "étape:ip" -> [horodatages]
const DAY = 24 * 3600 * 1000;

function ipOf(req) {
  return String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
}

// Renvoie true si la demande dépasse la limite (et a déjà répondu au navigateur).
module.exports = function limited(req, res, step, max) {
  if (isTester(req.headers["x-clyento-test"])) return false;
  const id = `${step}:${ipOf(req)}`, now = Date.now();
  const list = (hits.get(id) || []).filter(t => now - t < DAY);
  if (list.length >= max) {
    res.status(429).json({ error: "Vous avez déjà utilisé vos recherches gratuites. Inscrivez-vous à la liste d'attente pour en faire d'autres à l'ouverture des abonnements.", used: true });
    return true;
  }
  list.push(now); hits.set(id, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < DAY)) hits.delete(k);
  return false;
};
