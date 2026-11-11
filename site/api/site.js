// Lecture rapide du site du client : renvoie les pages lues (titre + extrait), sans analyse.
// Sert à afficher tout de suite ce que Clyento a trouvé sur le site, avant la réponse de l'IA.

const { readSite } = require("../lib/core");
const cors = require("../lib/cors");

const decode = t => (t || "").replace(/&#x27;|&#39;|&rsquo;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");
const clip = (t, n) => { t = decode(t).replace(/\s+/g, " ").trim(); if (t.length <= n) return t; const c = t.slice(0, n); return c.slice(0, c.lastIndexOf(" ") > 40 ? c.lastIndexOf(" ") : n) + "…"; };

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  const url = String(req.query.url || "").slice(0, 300).trim();
  if (!url) return res.status(400).json({ error: "Adresse du site manquante." });
  const web = await readSite(url);
  if (!web) return res.status(400).json({ error: "L'adresse du site n'est pas valide." });
  res.status(200).json({
    domain: web.domain,
    pages: (web.pages || []).map(pg => ({ path: pg.path, title: clip(pg.title, 90), excerpt: clip(pg.text, 150) })),
  });
};
