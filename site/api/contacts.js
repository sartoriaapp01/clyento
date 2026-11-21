// E-mail et LinkedIn des dirigeants via Dropcontact (API asynchrone, conforme RGPD, sans base de données).
// Actif seulement si DROPCONTACT_KEY est défini dans Vercel. Un crédit Dropcontact n'est consommé que si un e-mail est trouvé.
// POST {people:[{first,last,company,city,site}]} -> {id}   puis   GET ?id=... -> {ready, data:[{email,linkedin,phone}]}

const cors = require("../lib/cors");
const limited = require("../lib/limit");
const subOf = require("../lib/sub");
const clip = (s, n = 120) => String(s || "").replace(/[\r\n]+/g, " ").trim().slice(0, n);

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.DROPCONTACT_KEY;
  if (!key) return res.status(200).json({ off: true });
  const H = { "X-Access-Token": key, "Content-Type": "application/json" };
  try {
    if (req.method === "POST") {
      const sub = await subOf(req);
      if (sub ? limited(req, res, "s-contacts", 300, { key: sub.id, msg: "Vous avez atteint la limite du jour pour votre abonnement. Elle se renouvelle demain." }) : limited(req, res, "contacts", 4)) return;
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const people = (body.people || []).slice(0, 3).map(p => ({
        first_name: clip(p.first, 60), last_name: clip(p.last, 80), company: clip(p.company),
        website: clip(p.site, 200) || undefined, num_siren: clip(p.siren, 14) || undefined,
      })).filter(p => p.last_name && p.company);
      if (!people.length) return res.status(400).json({ error: "Aucun contact à rechercher." });
      const r = await fetch("https://api.dropcontact.io/batch", { method: "POST", headers: H, body: JSON.stringify({ data: people, siren: true, language: "fr" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.request_id) return res.status(502).json({ error: "Recherche de contacts indisponible." });
      return res.status(200).json({ id: j.request_id });
    }
    if (req.method === "GET") {
      const id = clip(req.query && req.query.id, 80);
      if (!/^[\w-]+$/.test(id)) return res.status(400).json({ error: "Demande invalide." });
      const r = await fetch(`https://api.dropcontact.io/batch/${id}`, { headers: H });
      const j = await r.json().catch(() => ({}));
      if (!j.success) return res.status(200).json({ ready: false });
      const data = (j.data || []).map(d => {
        const mails = Array.isArray(d.email) ? d.email : [];
        const best = mails.find(m => /nominative/i.test(m.qualification || "")) || mails[0];
        return { email: best ? best.email : "", linkedin: d.linkedin || "", phone: d.phone || d.mobile_phone || "" };
      });
      return res.status(200).json({ ready: true, data });
    }
    res.status(405).json({ error: "Méthode non autorisée." });
  } catch {
    res.status(502).json({ error: "Recherche de contacts indisponible." });
  }
};
