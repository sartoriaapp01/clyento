// Liste d'attente au prix fondateur, en attendant l'ouverture des paiements.
// Chaque inscription est envoyée par e-mail à l'équipe via Resend (clé RESEND_API_KEY,
// destinataire WAITLIST_TO, par défaut contact@clyento-ai.com). Rien n'est stocké ailleurs.

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
  const us = body.source === "us"; // liste d'attente de la page américaine (/us), messages en anglais
  const T = us ? { bad: "Please enter a valid email.", consent: "Please tick the box so we can email you.", off: "Signups are not open yet. Email us at contact@clyento-ai.com.", fail: "Something went wrong. Please try again, or email contact@clyento-ai.com." }
    : { bad: "Adresse e-mail invalide.", consent: "Merci de cocher la case pour être recontacté.", off: "L'inscription n'est pas encore activée. Écrivez-nous à contact@clyento-ai.com.", fail: "L'inscription n'a pas pu être enregistrée. Réessayez, ou écrivez-nous à contact@clyento-ai.com." };
  const email = clip(body.email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: T.bad });
  const search = body.source === "recherche"; // e-mail laissé dans le questionnaire, avant la recherche
  if (!search && !body.consent) return res.status(400).json({ error: T.consent });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(503).json({ error: T.off });

  const plan = PLANS[body.plan] ? PLANS[body.plan] + " / mois, prix fondateur garanti à vie" : "Pas encore choisie";
  const rows = [
    ["E-mail", email], ...(us ? [["Marché", "États-Unis (page /us)"]] : [["Offre", plan]]), ["Prénom", body.prenom], ["Entreprise", body.entreprise], ["Site", body.site],
    ["Activité", body.activite], ["Zone", body.zone], ["Cible", body.cible], ["Objectif", body.objectif],
  ].filter(([, v]) => clip(v));
  const html = `<h2>${us ? "Nouvelle inscription · liste d'attente États-Unis" : search ? "Nouvelle recherche sur Clyento" : "Nouvelle inscription · liste d'attente Clyento"}</h2><table cellpadding="6">${(search ? rows.filter(([k]) => k !== "Offre") : rows).map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v)}</td></tr>`).join("")}</table>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.WAITLIST_FROM || "Clyento <onboarding@resend.dev>",
        to: [process.env.WAITLIST_TO || "contact@clyento-ai.com"],
        reply_to: email,
        subject: us ? `US · liste d'attente · ${clip(body.activite, 60) || email} · ${clip(body.zone, 40)}` : search ? `Recherche · ${clip(body.prenom, 40) || email} · ${clip(body.activite, 60)}`
          : `Liste d'attente · ${clip(body.prenom, 40) || email} · ${PLANS[body.plan] || "offre non choisie"} · prix fondateur`,
        html,
      }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}`);
    res.status(200).json({ ok: true });
  } catch {
    res.status(502).json({ error: T.fail });
  }
};
