// Limite les recherches gratuites par connexion (adresse IP), pour protéger les crédits Claude.
// Compteur gardé en mémoire : il repart à zéro quand Vercel relance la fonction, ce qui suffit contre les abus courants.
// Les fondateurs testent sans limite : le site ouvert une fois avec ?test=<clé des fondateurs>.
// Les abonnés ont leur propre compteur (par abonnement), plus large : opts = { key, msg }.

const crypto = require("crypto");
// Empreinte de la clé des fondateurs (la clé elle-même n'est pas dans le code) ; TEST_KEY dans Vercel reste possible en plus.
const FOUNDER_HASH = "594193e1517c865eb7ef2eb6458f2d5f57c5692f9ca8bd26f5dff7db273038ec";
const isTester = k => !!k && (k === process.env.TEST_KEY || crypto.createHash("sha256").update(String(k)).digest("hex") === FOUNDER_HASH);
const hits = new Map(); // "étape:ip" -> [horodatages]
const DAY = 24 * 3600 * 1000;
const FREE_MSG = "Vous avez déjà utilisé vos recherches gratuites. Abonnez-vous pour lancer toutes les recherches que vous voulez.";

function ipOf(req) {
  return String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
}

// Renvoie true si la demande dépasse la limite (et a déjà répondu au navigateur).
module.exports = function limited(req, res, step, max, opts = {}) {
  if (isTester(req.headers["x-clyento-test"])) return false;
  const id = `${step}:${opts.key || ipOf(req)}`, now = Date.now();
  const list = (hits.get(id) || []).filter(t => now - t < DAY);
  if (list.length >= max) {
    res.status(429).json(opts.msg ? { error: opts.msg } : { error: FREE_MSG, used: true });
    return true;
  }
  list.push(now); hits.set(id, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < DAY)) hits.delete(k);
  return false;
};
