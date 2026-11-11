// Crée une session Stripe Checkout (abonnement mensuel) pour l'une des trois offres.
// La clé est lue dans la variable d'environnement STRIPE_SECRET_KEY (jamais dans le code).

const cors = require("../lib/cors");

const PRICES = { essentiel: "clyento_essentiel", pro: "clyento_pro", complet: "clyento_complet" };

async function stripe(path, params) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? "POST" : "GET",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error && j.error.message || `Stripe ${r.status}`);
  return j;
}

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Le paiement n'est pas encore activé." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const key = PRICES[body.plan];
  if (!key) return res.status(400).json({ error: "Offre inconnue." });

  try {
    const prices = await stripe(`prices?active=true&lookup_keys[]=${key}`);
    const price = prices.data[0];
    if (!price) return res.status(500).json({ error: "Offre introuvable dans Stripe." });

    const origin = /^https:\/\/(www\.)?clyento-ai\.com$/.test(req.headers.origin || "") ? req.headers.origin : `https://${req.headers.host}`;
    const clip = s => String(s || "").slice(0, 480);
    const session = await stripe("checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]": price.id,
      "line_items[0][quantity]": "1",
      success_url: `${origin}/merci.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#tarifs`,
      locale: "fr",
      allow_promotion_codes: "true",
      billing_address_collection: "required",
      "tax_id_collection[enabled]": "true",
      "metadata[plan]": body.plan,
      "metadata[activite]": clip(body.desc),
      "metadata[site]": clip(body.site),
      "metadata[cible]": clip(body.target),
      "metadata[zone]": clip(body.zone),
      "subscription_data[metadata][plan]": body.plan,
      "subscription_data[metadata][activite]": clip(body.desc),
      "subscription_data[metadata][site]": clip(body.site),
    });
    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(502).json({ error: "Le paiement n'a pas pu démarrer. Réessayez dans un instant." });
  }
};
