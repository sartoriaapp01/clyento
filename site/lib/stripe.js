// Appels à l'API Stripe avec la clé STRIPE_SECRET_KEY (variable d'environnement Vercel, jamais dans le code).
module.exports = async function stripe(path, params) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? "POST" : "GET",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error && j.error.message || `Stripe ${r.status}`);
  return j;
};
