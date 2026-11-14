// Outils partagés : lecture du site du client, géolocalisation, registre national des entreprises.
// Données publiques (SIRENE, RNE). Les entreprises opposées à la prospection commerciale sont exclues.

const REGISTRY = "https://recherche-entreprises.api.gouv.fr/search";
const GEO = "https://geo.api.gouv.fr/communes";

// Activité du client -> types d'entreprises à cibler (codes NAF). L'ordre compte : la première règle qui correspond gagne.
const TARGETS = [
  { re: /agence web|site(s)? (web|internet|vitrine)|cr[ée]ation de site|webflow|wordpress|\bseo\b|r[ée]f[ée]rencement|d[ée]veloppeu|marketing|community manag|r[ée]seaux sociaux|graphis|webdesign/,
    label: "Cabinets, artisans et restaurants établis", naf: ["86.23Z", "86.21Z", "69.10Z", "43.22A", "43.21A", "56.10A"], tranches: "01,02,03,11,12" },
  { re: /plomb|chauffag|sanitaire|[ée]lectric|serrur|vitrier|menuisi|peintre|peinture|ma[çc]on|couvreur|climatis|d[ée]pann|r[ée]nov|multiservice|second [œo]euvre/,
    label: "Syndics, agences immobilières, hôtels", naf: ["68.32A", "68.31Z", "55.10Z"], tranches: "01,02,03,11,12,21" },
  { re: /expert.?compta|comptab|gestion administrative|\bpaie\b|fiscal/,
    label: "Commerces, restaurants et artisans", naf: ["47.71Z", "47.11B", "56.10A", "56.10C", "43.22A", "96.02A"], tranches: "01,02,03,11" },
  { re: /nettoyage|m[ée]nage|propret[ée]/,
    label: "Bureaux, cabinets médicaux, syndics", naf: ["69.10Z", "69.20Z", "86.21Z", "86.23Z", "68.32A", "70.22Z"] },
  { re: /informatique|maintenance|infog[ée]rance|cyber|r[ée]seau/,
    label: "Cabinets comptables, avocats, médecins", naf: ["69.20Z", "69.10Z", "86.21Z", "86.23Z", "71.11Z"] },
  { re: /traiteur|plateaux? repas|[ée]v[ée]nementiel/,
    label: "Entreprises de conseil, agences, organisateurs d'événements", naf: ["70.22Z", "73.11Z", "82.30Z"], tranches: "03,11,12,21" },
  { re: /coach|sport|fitness|yoga|pilates|nutrition|di[ée]t[ée]ti|bien-[êe]tre|massage|sophro|naturo|ost[ée]o/,
    label: "Kinés et salles de sport (partenaires)", naf: ["86.90E", "93.13Z", "93.12Z"], b2c: true },
  { re: /restaurant|\bbar\b|caf[ée]|boulang|p[âa]tiss|coiff|esth[ée]ti|boutique|fleuris|librair|[ée]picerie|cave [àa] vin/,
    label: "Hôtels et entreprises voisines (partenaires)", naf: ["55.10Z", "70.22Z", "69.20Z", "69.10Z"], b2c: true },
  { re: /photo|vid[ée]o|film|drone/,
    label: "Agences immobilières, hôtels, restaurants", naf: ["68.31Z", "55.10Z", "56.10A"] },
  { re: /transport|livraison|coursier|logisti|d[ée]m[ée]nag/,
    label: "Grossistes, e-commerçants, industriels", naf: ["46.90Z", "47.91B", "46.69B", "25.62B"] },
  { re: /avocat|juriste|juridique/,
    label: "PME en croissance (10 à 99 salariés)", naf: ["62.01Z", "70.22Z", "46.90Z"], tranches: "11,12,21" },
  { re: /assuran|courtier|mutuelle|pr[ée]voyance|patrimoine/,
    label: "Artisans, commerçants et professions libérales", naf: ["43.22A", "43.21A", "86.21Z", "69.10Z"] },
  { re: /imprim|enseigne|signal[ée]tique|objets? publicitaires?|textile/,
    label: "Commerces, restaurants, clubs sportifs", naf: ["56.10A", "47.71Z", "93.12Z"] },
  { re: /formation|formateur|consultant|conseil|recrutement|rh\b/,
    label: "PME de 10 à 99 salariés", naf: ["62.01Z", "46.90Z", "43.21A", "71.12B"], tranches: "11,12,21" },
];
const DEFAULT_TARGET = { label: "PME locales de 10 à 49 salariés", naf: null, tranches: "11,12" };

const WHY = {
  "68.32A": "Gère des immeubles en copropriété : besoins réguliers d'entretien et de dépannage.",
  "68.31Z": "Agence immobilière : des biens à remettre en état avant location ou vente.",
  "55.10Z": "Hôtel : entretien continu et clientèle de passage à orienter.",
  "86.23Z": "Cabinet dentaire : patients qui cherchent en ligne, visibilité locale décisive.",
  "86.21Z": "Cabinet médical : activité locale, patients à orienter.",
  "86.90E": "Kinésithérapie : des patients qui doivent reprendre une activité encadrée.",
  "93.13Z": "Salle de sport : clientèle déjà active, partenariats possibles.",
  "69.10Z": "Cabinet d'avocats : bureaux à équiper et à entretenir.",
  "69.20Z": "Cabinet comptable : bureaux et données sensibles à gérer.",
  "70.22Z": "Conseil aux entreprises : équipes en bureaux, besoins réguliers.",
  "73.11Z": "Agence de communication : événements et clients à recevoir.",
  "82.30Z": "Organisation d'événements : prestataires à trouver en continu.",
  "43.22A": "Plombier-chauffagiste établi : activité locale, peu de temps pour sa gestion.",
  "43.21A": "Électricien établi : activité locale, peu de temps pour sa gestion.",
  "56.10A": "Restaurant : activité locale, clientèle et visibilité à entretenir.",
  "56.10C": "Restauration rapide : commerce de proximité.",
  "47.71Z": "Boutique de prêt-à-porter : commerce indépendant.",
  "47.11B": "Commerce d'alimentation de proximité.",
  "96.02A": "Salon de coiffure : commerce indépendant.",
  "46.90Z": "Commerce de gros : flux de marchandises réguliers.",
  "47.91B": "Vente à distance : colis à expédier chaque jour.",
  "62.01Z": "Éditeur de logiciels : entreprise en croissance.",
};

const TRANCHES = { "00": "0 salarié", "01": "1 à 2 salariés", "02": "3 à 5 salariés", "03": "6 à 9 salariés", "11": "10 à 19 salariés",
  "12": "20 à 49 salariés", "21": "50 à 99 salariés", "22": "100 à 199 salariés", "31": "200 à 249 salariés", "32": "250 à 499 salariés" };
const QUALITES_OK = /pr[ée]sident|g[ée]rant|directeur g[ée]n[ée]ral|directeur|associ[ée]|administrateur|exploitant/i;

const title = s => (s || "").toLowerCase().replace(/(^|[\s\-'])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase());

async function getJson(url, ms = 6000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { "user-agent": "Clyento/1.0" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (j && !Array.isArray(j)) Object.defineProperty(j, "__url", { value: url });
  return j;
}

const UA = { "user-agent": "Mozilla/5.0 (compatible; Clyento/1.0)" };
const OFFER_LINK = /(service|prestation|offre|tarif|prix|pricing|solution|produit|product|formation|cours|ecole|school|boutique|shop|catalogue|expertise|accompagnement|a-propos|about|qui-sommes|notre-agence|realisation|cas-client|methode)/i;
const SKIP_LINK = /(legal|mention|privacy|confidential|cgv|cgu|conditions|terms|cookie|contact|help|aide|faq|login|connexion|signup|inscription|panier|cart|account|compte|remboursement)/i;

function parsePage(html) {
  const pick = re => (html.match(re) || [])[1] || "";
  const decode = t => t.replace(/&#x27;|&#39;|&rsquo;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");
  const title = decode(pick(/<title[^>]*>([^<]{1,200})/i)).replace(/\s+/g, " ").trim();
  const meta = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,400})/i);
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, " ").trim();
  return { title, meta, body };
}

// Lit la page d'accueil puis jusqu'à 4 pages qui décrivent l'offre (services, tarifs, à propos…).
async function readSite(raw) {
  let url;
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw); } catch { return null; }
  const out = { domain: url.hostname.replace(/^www\./, ""), title: "", text: "", postcode: "", pages: [] };
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: "follow", headers: UA });
    const html = (await r.text()).slice(0, 400000);
    const home = parsePage(html);
    out.title = home.title;
    out.pages.push({ path: "/", title: home.title, text: `${home.meta} ${home.body}`.slice(0, 3000) });
    out.postcode = (home.body.match(/\b((?:0[1-9]|[1-8]\d|9[0-5])\d{3})\s+[A-ZÉÈ][A-Za-zÀ-ÿ\-' ]{2,}/) || [])[1] || "";

    const base = new URL(r.url || url);
    const seen = new Set(["/"]), links = [], others = [];
    for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
      let u; try { u = new URL(m[1], base); } catch { continue; }
      if (u.hostname.replace(/^www\./, "") !== out.domain || /\.(pdf|jpe?g|png|webp|svg|zip)$/i.test(u.pathname)) continue;
      const path = u.pathname.replace(/\/$/, "") || "/";
      const label = m[2].replace(/<[^>]+>/g, " ").trim();
      if (seen.has(path) || SKIP_LINK.test(path)) continue;
      seen.add(path);
      const offer = OFFER_LINK.test(path) || OFFER_LINK.test(label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-"));
      (offer ? links : others).push(u.origin + path);
    }
    links.push(...others);
    links.length = Math.min(links.length, 4);
    const pages = await Promise.all(links.map(async l => {
      try {
        const pr = await fetch(l, { signal: AbortSignal.timeout(4000), redirect: "follow", headers: UA });
        if (!pr.ok) return null;
        const pg = parsePage((await pr.text()).slice(0, 300000));
        return { path: new URL(l).pathname, title: pg.title, text: `${pg.meta} ${pg.body}`.slice(0, 1800) };
      } catch { return null; }
    }));
    out.pages.push(...pages.filter(Boolean));
    if (!out.postcode) for (const pg of out.pages) { const m = pg.text.match(/\b((?:0[1-9]|[1-8]\d|9[0-5])\d{3})\s+[A-ZÉÈ][A-Za-zÀ-ÿ\-' ]{2,}/); if (m) { out.postcode = m[1]; break; } }
    out.text = out.pages.map(pg => `${pg.title} ${pg.text}`).join(" ");
  } catch { /* site injoignable : on continue avec la description */ }
  return out;
}

async function findPlace(desc, postcode) {
  const m = desc.match(/(?:^|[\s,(])(?:à|a|sur|vers|pr[èe]s de|autour de|r[ée]gion|secteur)\s+((?:[A-ZÉÈ][\wÀ-ÿ'\-]+)(?:[\s\-](?:sur|en|le|la|les|de|du|[A-ZÉÈ][\wÀ-ÿ'\-]+))*)/);
  const tries = [];
  if (m) tries.push(`${GEO}?nom=${encodeURIComponent(m[1])}&boost=population&limit=1&fields=nom,codeDepartement,codesPostaux,population`);
  if (postcode) tries.push(`${GEO}?codePostal=${postcode}&limit=1&fields=nom,codeDepartement,codesPostaux,population`);
  for (const u of tries) {
    try { const [c] = await getJson(u, 4000); if (c) return c; } catch {}
  }
  return null;
}


const NAF_RE = /^\d{2}\.\d{2}[A-Z]$/;
const TRANCHE_CODES = new Set(["00", "01", "02", "03", "11", "12", "21", "22", "31", "32", "41", "42", "51", "52", "53"]);

function guessTarget(desc, siteText) {
  const d = desc.toLowerCase();
  return TARGETS.find(t => t.re.test(d)) || TARGETS.find(t => t.re.test(`${d} ${siteText}`.toLowerCase())) || DEFAULT_TARGET;
}

// Cherche dans le registre et renvoie les entreprises avec un décideur identifié, triées par pertinence.
async function searchRegistry({ naf, tranches, place, rayon = "zone" }) {
  const base = new URLSearchParams({ etat_administratif: "A", per_page: "25", page: "1" });
  if (naf && naf.length) base.set("activite_principale", naf.join(","));
  if (tranches && tranches.length) base.set("tranche_effectif_salarie", tranches.join(","));
  if (!naf || !naf.length) base.set("categorie_entreprise", "PME");

  let data, zone = "France entière";
  if (place && rayon === "departement") {
    const dep = new URLSearchParams(base); dep.set("departement", place.codeDepartement);
    data = await getJson(`${REGISTRY}?${dep}`);
    zone = `${place.nom} et son département (${place.codeDepartement})`;
  } else if (place) {
    const local = new URLSearchParams(base); local.set("code_postal", place.codesPostaux.slice(0, 40).join(","));
    data = await getJson(`${REGISTRY}?${local}`);
    zone = place.nom;
    if (rayon !== "ville" && data.total_results < 40) {
      const dep = new URLSearchParams(base); dep.set("departement", place.codeDepartement);
      data = await getJson(`${REGISTRY}?${dep}`);
      zone = `${place.nom} et son département (${place.codeDepartement})`;
    }
  } else {
    data = await getJson(`${REGISTRY}?${base}`);
  }

  const results = [...(data.results || [])];
  if (data.total_results > 25) {
    try { const u = new URL(data.__url); u.searchParams.set("page", "2"); results.push(...((await getJson(u.toString())).results || [])); } catch {}
  }
  const usable = [];
  for (const r of results) {
    if (r.opposition_diffusion_commerciale || r.statut_diffusion !== "O") continue;
    const ei = !!(r.complements && r.complements.est_entrepreneur_individuel);
    const boss = (r.dirigeants || []).find(d => d.type_dirigeant === "personne physique" && d.nom && (QUALITES_OK.test(d.qualite || "") || (ei && !d.qualite)));
    if (!boss) continue;
    const etab = (r.matching_etablissements || [])[0] || r.siege || {};
    const tranche = r.tranche_effectif_salarie;
    let score = 70;
    if (["01", "02", "03", "11", "12"].includes(tranche)) score += 8;
    if (place && etab.libelle_commune && etab.libelle_commune.toLowerCase().startsWith(place.nom.toLowerCase().slice(0, 5))) score += 6;
    if (r.date_creation && r.date_creation < "2022") score += 3;
    usable.push({
      name: title(r.nom_raison_sociale || r.nom_complet).replace(/\b(Sas|Sarl|Sa|Eurl|Sci|Sasu|Snc)\b/g, s => s.toUpperCase()),
      siren: r.siren || "",
      naf: r.activite_principale,
      activity: r.libelle_activite_principale || "",
      city: title(etab.libelle_commune || ""),
      size: TRANCHES[tranche] || "",
      created: (r.date_creation || "").slice(0, 4),
      boss: { first: title((boss.prenoms || "").split(" ")[0]), last: title(boss.nom.replace(/\s*\(.*?\)/g, "")), role: boss.qualite ? boss.qualite.replace(/ de (SAS|SA|SARL|SASU|EURL)$/i, "") : "Entrepreneur individuel" },
      why: WHY[r.activite_principale] || "Activité compatible avec votre offre, dans votre zone.",
      score,
    });
  }
  usable.sort((a, b) => b.score - a.score);
  return { total: data.total_results || 0, capped: (data.total_results || 0) >= 10000, zone, usable };
}

module.exports = { readSite, findPlace, guessTarget, searchRegistry, NAF_RE, TRANCHE_CODES, GEO, getJson };
