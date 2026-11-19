// Coordonnées publiques d'un prospect via Google Places (téléphone, site, fiche Google Maps).
// Actif seulement si la variable GOOGLE_PLACES_KEY est définie dans Vercel. Sinon, rien n'est appelé.
// Coût : niveau « Enterprise » de Text Search (1 000 appels gratuits par mois chez Google, puis payant).

const FIELDS = "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.businessStatus";

async function lookup(p, key) {
  const query = [p.brand || p.name, p.address || p.city].filter(Boolean).join(" ");
  if (!query) return null;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
      body: JSON.stringify({ textQuery: query, languageCode: "fr", regionCode: "FR", maxResultCount: 1 }),
    });
    if (!r.ok) return null;
    const pl = ((await r.json()).places || [])[0];
    if (!pl || pl.businessStatus === "CLOSED_PERMANENTLY") return null;
    // Vérifie que la fiche trouvée est bien dans la même commune que le prospect
    const city = String(p.city || "").toLowerCase().slice(0, 5);
    if (city && pl.formattedAddress && !pl.formattedAddress.toLowerCase().includes(city)) return null;
    const out = { phone: pl.nationalPhoneNumber || "", site: pl.websiteUri || "", maps: pl.googleMapsUri || "" };
    return out.phone || out.site || out.maps ? out : null;
  } catch { return null; } finally { clearTimeout(t); }
}

module.exports = async function addContacts(list) {
  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key || !list.length) return;
  const res = await Promise.all(list.map(p => lookup(p, key)));
  res.forEach((c, i) => { if (c) list[i].contact = c; });
};
