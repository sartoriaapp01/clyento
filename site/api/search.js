// Étape 2 : cherche les prospects dans le registre national des entreprises, puis Claude personnalise les 3 premiers.

const { searchRegistry, NAF_RE, TRANCHE_CODES } = require("../lib/core");
const ai = require("../lib/ai");
const cors = require("../lib/cors");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const desc = String(body.desc || "").slice(0, 500);
  const p = body.profile || {};
  if (!p.summary) return res.status(400).json({ error: "Relancez la recherche depuis le formulaire." });

  const naf = (p.naf || []).filter(c => NAF_RE.test(c)).slice(0, 6);
  const tranches = (p.tranches || []).filter(t => TRANCHE_CODES.has(t));
  const place = p.place && Array.isArray(p.place.codesPostaux) ? p.place : null;

  let found;
  try {
    found = await searchRegistry({ naf, tranches, place, rayon: p.rayon });
    if (!found.usable.length && tranches.length) found = await searchRegistry({ naf, tranches: [], place, rayon: p.rayon });
  } catch {
    return res.status(502).json({ error: "Le registre des entreprises ne répond pas. Réessayez dans un instant." });
  }
  if (!found.usable.length) return res.status(404).json({ error: "Aucun décideur trouvé pour cette cible. Précisez votre activité ou votre ville." });

  const top = found.usable.slice(0, 3);
  const rest = found.usable.slice(3, 6);
  try {
    const outs = await ai.pitch(p, desc, top);
    outs.forEach((m, i) => {
      if (m) Object.assign(top[i], { ai: { objet: m.email_objet, corps: m.email_corps, linkedin: m.linkedin, appel: m.appel }, why: m.raison, score: Math.max(60, Math.min(98, m.score)) });
    });
    top.sort((a, b) => b.score - a.score);
    top.forEach((t, i) => { if (i && t.score >= top[i - 1].score) t.score = top[i - 1].score - 2; });
  } catch { /* Claude indisponible : on garde les raisons et modèles standards */ }
  top.forEach((t, i) => { if (!t.ai) t.score = Math.min(96 - i * 3, t.score + 4); });
  const last = top[top.length - 1].score;

  res.status(200).json({
    profile: { ...p, zone: found.zone },
    total: found.total,
    capped: found.capped,
    prospects: top,
    locked: rest.map((r, i) => ({ name: r.name.split(" ")[0] + " ●●●●●", city: r.city, size: r.size, score: last - 3 - i * 4 })),
  });
};
