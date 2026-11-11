#!/bin/zsh
# Construit site/index.html (page complète) à partir de index.html (source de l'artifact)
cd "$(dirname "$0")"
mkdir -p site
{
  echo '<!doctype html>'
  echo '<html lang="fr">'
  echo '<head>'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">'
  echo '<link rel="icon" href="/favicon.svg" type="image/svg+xml">'
  echo '<style>[hidden]{display:none!important}img{max-width:100%}body{margin:0}</style>'
  cat index.html
  echo '</html>'
} > site/index.html
cat > site/favicon.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M78 22 A40 40 0 1 0 78 78" fill="none" stroke="#111" stroke-width="17"/><path d="M42 50 L54 62 L80 36" fill="none" stroke="#111" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></svg>
SVG
echo "site/ prêt"
