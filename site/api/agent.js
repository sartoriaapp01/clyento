// Agent de prospection de Clyento : chaque matin de semaine, cherche de petites entreprises qui pourraient
// utiliser Clyento, rédige un message pour chacune et envoie la liste à contact@clyento-ai.com.
// Lancé par Vercel Cron (vercel.json). Protégé par CRON_SECRET (variable Vercel) ou la clé des fondateurs.
// Rien n'est envoyé aux prospects : l'équipe relit et envoie elle-même.

const crypto = require("crypto");
const { searchRegistry, GEO, getJson } = require("../lib/core");
const ai = require("../lib/ai");
const addContacts = require("../lib/places");

const FOUNDER_HASH = "594193e1517c865eb7ef2eb6458f2d5f57c5692f9ca8bd26f5dff7db273038ec";
const N = 15; // prospects par jour

// Cibles de Clyento : petits indépendants et TPE qui vendent à des entreprises ou cherchent des partenaires
const SEGMENTS = [
  { label: "Électriciens", naf: ["43.21A"] },
  { label: "Plombiers et chauffagistes", naf: ["43.22A", "43.22B"] },
  { label: "Agences de communication", naf: ["73.11Z"] },
  { label: "Entreprises de nettoyage", naf: ["81.21Z", "81.22Z"] },
  { label: "Menuisiers", naf: ["43.32A", "43.32B"] },
  { label: "Consultants et conseil aux entreprises", naf: ["70.22Z"] },
  { label: "Peintres en bâtiment", naf: ["43.34Z"] },
  { label: "Traiteurs", naf: ["56.21Z"] },
  { label: "Photographes", naf: ["74.20Z"] },
  { label: "Dépannage et services informatiques", naf: ["62.02A", "95.11Z"] },
  { label: "Coachs sportifs et salles de sport", naf: ["93.13Z", "85.51Z"] },
];
const CITIES = ["Levallois-Perret", "Courbevoie", "Boulogne-Billancourt", "Neuilly-sur-Seine", "Clichy", "Puteaux", "Issy-les-Moulineaux", "Paris", "Nanterre", "Rueil-Malmaison", "Saint-Denis", "Montreuil"];

const CLYENTO = {
  firstName: "Jean-Michel Bejani", siteTitle: "Clyento", domain: "clyento-ai.com",
  objectif: "faire essayer la recherche gratuite de Clyento",
  atouts: "première recherche gratuite et sans carte bancaire ; abonnement dès 12,99 € par mois, sans engagement ; aucun réglage, on décrit juste son métier",
  infos: "Clyento est un site français. Le prospect est un petit indépendant ou une TPE qui manque sans doute de temps pour prospecter.",
  summary: "Clyento trouve les entreprises qui ont besoin des services d'un artisan, coach, commerçant ou freelance, identifie leur dirigeant et rédige le message de prospection.",
  why: "Les petites entreprises vivent du bouche-à-oreille et n'ont ni le temps ni les outils pour prospecter.",
};
const DESC = "Clyento : site qui trouve des clients professionnels pour les artisans, coachs, commerçants et freelances, et écrit les messages de prospection à leur place.";

const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const allowed = req => {
  const auth = String(req.headers.authorization || "");
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const k = String(req.headers["x-clyento-test"] || (req.query && req.query.test) || "");
  return !!k && crypto.createHash("sha256").update(k).digest("hex") === FOUNDER_HASH;
};

function card(p, i) {
  const c = p.contact || {}, m = p.ai;
  const links = [
    c.phone && `☎ ${esc(c.phone)}`,
    c.site && `<a href="${esc(c.site)}">${esc(c.site.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, ""))}</a>`,
    p.siren && `<a href="https://annuaire-entreprises.data.gouv.fr/entreprise/${esc(p.siren)}">Fiche entreprise</a>`,
    `<a href="https://www.google.com/search?q=${encodeURIComponent([p.brand || p.name, p.city, "téléphone"].join(" "))}">Chercher le contact</a>`,
  ].filter(Boolean).join(" · ");
  const body = m ? `Objet : ${esc(m.email_objet)}\n\nBonjour ${esc(p.boss.first)} ${esc(p.boss.last)},\n\n${esc(m.email_corps)}\n\nBien cordialement,\nJean-Michel Bejani\nClyento · clyento-ai.com\n\nVos coordonnées proviennent du registre national des entreprises (RNE). Si vous ne souhaitez plus être contacté, il suffit de me le dire.` : "";
  return `<div style="border:1px solid #e5e5e0;border-radius:12px;padding:16px;margin:0 0 14px;font-family:Arial,sans-serif">
    <div style="font-size:16px"><b>${i + 1}. ${esc(p.brand || p.name)}</b> · ${esc(p.activity)}</div>
    <div style="color:#555;margin:4px 0">${esc(p.boss.first)} ${esc(p.boss.last)}, ${esc(p.boss.role)} · ${esc(p.address || p.city)}${p.size ? ` · ${esc(p.size)}` : ""}</div>
    <div style="margin:4px 0 10px;font-size:13px">${links}</div>
    ${m && m.linkedin ? `<div style="font-size:13px;color:#555;margin-bottom:8px"><b>LinkedIn :</b> ${esc(m.linkedin)}</div>` : ""}
    ${body ? `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px;background:#f6f8f7;border-radius:8px;padding:12px;margin:0">${body}</pre>` : "<i>Message indisponible aujourd'hui.</i>"}
  </div>`;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!allowed(req)) return res.status(401).json({ error: "Non autorisé." });
  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(503).json({ error: "RESEND_API_KEY manquante." });

  const day = Math.floor(Date.now() / 86400000);
  const seg = SEGMENTS[day % SEGMENTS.length];
  const cityName = CITIES[Math.floor(day / SEGMENTS.length) % CITIES.length];
  let place = null;
  try { [place] = await getJson(`${GEO}?nom=${encodeURIComponent(cityName)}&boost=population&limit=1&fields=nom,codeDepartement,codesPostaux,population`, 5000); } catch {}

  let found;
  try { found = await searchRegistry({ naf: seg.naf, tranches: ["00", "01", "02", "03"], place, rayon: "zone" }); }
  catch { return res.status(502).json({ error: "Registre indisponible." }); }
  const list = found.usable.slice(0, N);
  if (!list.length) return res.status(200).json({ ok: true, sent: 0, note: "Aucun prospect aujourd'hui." });

  const contacts = addContacts(list).catch(() => {});
  let outs = [];
  try { outs = await ai.pitch(CLYENTO, DESC, list); } catch { outs = []; }
  outs.forEach((m, i) => { if (m) list[i].ai = m; });
  await contacts;

  const html = `<div style="font-family:Arial,sans-serif;max-width:680px">
    <h2 style="margin:0 0 4px">${list.length} prospects pour Clyento · ${esc(seg.label)}</h2>
    <p style="color:#555;margin:0 0 16px">${esc(found.zone)} · indépendants et TPE · ${found.total} entreprises au total dans ce segment.<br>
    Relisez chaque message, ajustez-le si besoin, puis envoyez-le vous-même. Pensez à noter qui vous avez contacté.</p>
    ${list.map(card).join("")}</div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.WAITLIST_FROM || "Clyento <onboarding@resend.dev>", to: [process.env.WAITLIST_TO || "contact@clyento-ai.com"],
      subject: `Agent prospection · ${list.length} prospects · ${seg.label} · ${found.zone}`, html }),
  });
  if (!r.ok) return res.status(502).json({ error: `Envoi de l'e-mail impossible (Resend ${r.status}).` });
  res.status(200).json({ ok: true, sent: list.length, segment: seg.label, zone: found.zone });
};
