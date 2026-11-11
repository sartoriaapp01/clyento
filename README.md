# Clyento

Site de [clyento-ai.com](https://clyento-ai.com) : un questionnaire en cinq étapes, puis une recherche de vrais prospects dans le registre national des entreprises, avec une analyse du site du client et des messages rédigés par Claude.

## Organisation

| Fichier | Rôle |
|---|---|
| `index.html` | La page, à modifier ici (HTML, CSS et JavaScript dans un seul fichier) |
| `build.sh` | Construit `site/index.html` à partir de `index.html` |
| `site/` | Ce qui est déployé sur Vercel |
| `site/api/site.js` | Lecture rapide du site du client (pages, titres, extraits) |
| `site/api/analyze.js` | Analyse de l'activité par Claude : cible, codes NAF, ville |
| `site/api/search.js` | Recherche dans le registre (recherche-entreprises.api.gouv.fr) et rédaction des messages |
| `site/api/checkout.js` | Paiement des abonnements avec Stripe Checkout |
| `site/lib/` | Code partagé : lecture des sites, registre, appels à Claude |

## Lancer et déployer

```sh
./build.sh                      # régénère site/index.html
cd site && npm install
vercel dev                      # en local
vercel deploy --prod            # en production
```

Deux variables d'environnement sont nécessaires sur Vercel (jamais dans le code) :

- `ANTHROPIC_API_KEY` : clé de l'API Claude
- `STRIPE_SECRET_KEY` : clé Stripe ; les prix sont retrouvés par leurs `lookup_key` (`clyento_essentiel`, `clyento_pro`, `clyento_complet`)

## Données

Les entreprises viennent des données publiques SIRENE et RNE. Celles qui se sont opposées à la prospection commerciale sont exclues.
