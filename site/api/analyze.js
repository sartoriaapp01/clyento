// Étape 1 : lit le site du client et définit sa cible (Claude, avec repli sur les règles par mots-clés).

const { readSite, findPlace, guessTarget, NAF_RE, TRANCHE_CODES, GEO, getJson } = require("../lib/core");
const ai = require("../lib/ai");
const cors = require("../lib/cors");

async function placeByName(name) {
  try { const [c] = await getJson(`${GEO}?nom=${encodeURIComponent(name)}&boost=population&limit=1&fields=nom,codeDepartement,codesPostaux,population`, 4000); return c || null; }
  catch { return null; }
}

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  const q = k => String(req.query[k] || "").slice(0, 200).trim();
  const desc = String(req.query.desc || "").slice(0, 600).trim();
  const site = q("url");
  const form = { prenom: q("prenom"), entreprise: q("entreprise"), ville: q("ville"), rayon: ["ville", "zone", "departement", "france"].includes(q("rayon")) ? q("rayon") : "zone",
    cible: q("cible"), objectif: q("objectif"), atouts: q("atouts"), infos: String(req.query.infos || "").slice(0, 700).trim() };
  if (desc.length < 10) return res.status(400).json({ error: "Décrivez ce que vous proposez en une ou deux phrases." });

  let web = site ? await readSite(site) : null;
  if (site && !web) return res.status(400).json({ error: "L'adresse du site n'est pas valide. Exemple : www.monentreprise.fr" });
  if (!web) web = { domain: "", title: "", text: "", postcode: "", pages: [] };

  let a = null;
  try { a = await ai.analyze(desc, web, form); } catch { a = null; }

  const rule = guessTarget(desc, web.text);
  const naf = a ? a.naf.map(c => c.trim().toUpperCase()).filter(c => NAF_RE.test(c)).slice(0, 6) : [];
  const place = form.rayon === "france" ? null
    : (form.ville && await placeByName(form.ville)) || (a && a.ville && await placeByName(a.ville)) || await findPlace(desc, web.postcode);

  res.status(200).json({
    profile: {
      domain: web.domain,
      siteTitle: form.entreprise || (a && a.nom_entreprise) || web.title.split(/\s[|\-–—]\s/)[0].slice(0, 70),
      firstName: form.prenom,
      rayon: form.rayon,
      objectif: form.objectif,
      atouts: form.atouts,
      infos: form.infos,
      summary: a ? a.resume : desc,
      target: a ? a.clients_cibles : rule.label,
      why: a ? a.pourquoi : "",
      b2c: a ? a.vente === "B2C" : (form.cible === "particuliers" || !!rule.b2c),
      naf: naf.length >= 1 ? naf : (rule.naf || []),
      tranches: a ? a.tranches.filter(t => TRANCHE_CODES.has(t)) : (rule.tranches ? rule.tranches.split(",") : []),
      place,
      zone: place ? place.nom : "France entière",
      phrases: a ? a.phrases_recherche.slice(0, 6) : [],
      headline: a ? a.accroche : "",
      pages: (web.pages || []).map(pg => pg.path),
      findings: a ? a.constats.filter(c => c.constat).slice(0, 5).map(c => ({ page: web.domain + (c.page === "/" ? "" : c.page), text: c.constat })) : [],
      ai: !!a,
    },
  });
};
