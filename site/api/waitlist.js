// Liste d'attente au prix fondateur, en attendant l'ouverture des paiements.
// Chaque inscription est envoyée par e-mail à l'équipe via Resend (clé RESEND_API_KEY,
// destinataire WAITLIST_TO, par défaut jeanmichel.bejani@clyento-ai.com). Rien n'est stocké ailleurs.

const cors = require("../lib/cors");

const PLANS = { essentiel: "Essentiel · 12,99 €", pro: "Pro · 24,99 €", complet: "Accès complet · 49,99 €" };
const clip = (s, n = 300) => String(s || "").replace(/[\r\n]+/g, " ").trim().slice(0, n);
const esc = s => clip(s, 600).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });

  let body = {};
  try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); }
  catch { return res.status(400).json({ error: "Demande illisible." }); }

  if (body.website) return res.status(200).json({ ok: true }); // champ piège anti-robots
  const email = clip(body.email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: "Adresse e-mail invalide." });
  if (!body.consent) return res.status(400).json({ error: "Merci de cocher la case pour être recontacté." });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(503).json({ error: "L'inscription n'est pas encore activée. Écrivez-nous à contact@clyento-ai.com." });

  const plan = PLANS[body.plan] || "Pas encore choisie";
  const rows = [
    ["E-mail", email], ["Offre", plan], ["Prénom", body.prenom], ["Entreprise", body.entreprise],
    ["Activité", body.activite], ["Zone", body.zone], ["Cible", body.cible],
  ].filter(([, v]) => clip(v));
  const html = `<h2>Nouvelle inscription · liste d'attente Clyento</h2><table cellpadding="6">${rows.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v)}</td></tr>`).join("")}</table>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.WAITLIST_FROM || "Clyento <onboarding@resend.dev>",
        to: [process.env.WAITLIST_TO || "jeanmichel.bejani@clyento-ai.com"],
        reply_to: email,
        subject: `Liste d'attente · ${clip(body.prenom, 40) || email} · ${plan}`,
        html,
      }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}`);
    res.status(200).json({ ok: true });
  } catch {
    res.status(502).json({ error: "L'inscription n'a pas pu être enregistrée. Réessayez, ou écrivez-nous à contact@clyento-ai.com." });
  }
};
