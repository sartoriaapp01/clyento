// Abonnés : rédige le message personnalisé (et cherche le téléphone / site) d'un prospect choisi dans la liste.
const ai = require("../lib/ai");
const cors = require("../lib/cors");
const limited = require("../lib/limit");
const subOf = require("../lib/sub");
const addContacts = require("../lib/places");
const clip = (s, n = 200) => String(s || "").slice(0, n);

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });
  const sub = await subOf(req);
  if (!sub) return res.status(401).json({ error: "Réservé aux abonnés." });
  if (limited(req, res, "s-pitch", 300, { key: sub.id, msg: "Vous avez atteint la limite du jour pour votre abonnement. Elle se renouvelle demain." })) return;
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const p = body.profile || {}, x = body.prospect || {}, b = x.boss || {};
  if (!x.name || !b.last) return res.status(400).json({ error: "Prospect incomplet." });
  const pr = { name: clip(x.name), brand: clip(x.brand), activity: clip(x.activity), naf: clip(x.naf, 10), city: clip(x.city, 80), address: clip(x.address),
    size: clip(x.size, 80), created: clip(x.created, 4), boss: { first: clip(b.first, 60), last: clip(b.last, 80), role: clip(b.role, 80) } };
  const contacts = addContacts([pr]).catch(() => {});
  let m = null;
  try { [m] = await ai.pitch(p, clip(body.desc, 500), [pr]); } catch { m = null; }
  await contacts;
  res.status(200).json({
    ai: m ? { objet: m.email_objet, corps: m.email_corps, linkedin: m.linkedin, appel: m.appel } : null,
    why: m ? m.raison : "", contact: pr.contact || null,
  });
};
