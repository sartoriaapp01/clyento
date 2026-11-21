// Reconnaît un abonné : le navigateur envoie l'identifiant de sa session de paiement Stripe (en-tête X-Clyento-Sub).
// On vérifie chez Stripe que la session est payée et que l'abonnement est toujours actif (résultat gardé 10 minutes).
const stripe = require("./stripe");

const cache = new Map(); // id -> { at, sub }
const TTL = 10 * 60 * 1000;
const OK = new Set(["active", "trialing", "past_due"]);
const PLANS = { essentiel: "Essentiel", pro: "Pro", complet: "Accès complet" };

async function check(id) {
  const s = await stripe(`checkout/sessions/${id}?expand[]=subscription`);
  const subn = s.subscription && typeof s.subscription === "object" ? s.subscription : null;
  if (s.status !== "complete" || !subn || !OK.has(subn.status)) return null;
  const plan = (s.metadata && s.metadata.plan) || (subn.metadata && subn.metadata.plan) || "";
  return { id, plan, planName: PLANS[plan] || "Abonnement", email: (s.customer_details && s.customer_details.email) || "" };
}

module.exports = async function subOf(req) {
  const id = String(req.headers["x-clyento-sub"] || "").trim();
  if (!/^cs_(live|test)_[A-Za-z0-9]{10,200}$/.test(id) || !process.env.STRIPE_SECRET_KEY) return null;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL) return hit.sub;
  let sub = null;
  try { sub = await check(id); } catch { if (hit) return hit.sub; return null; }
  cache.set(id, { at: Date.now(), sub });
  if (cache.size > 2000) cache.clear();
  return sub;
};
