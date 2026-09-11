#!/usr/bin/env bash
# Publica o site. Troca a versão dos assets (?v=...) para que o navegador de
# quem já visitou baixe os arquivos novos em vez de usar o cache, e sobe pro
# GitHub Pages.
#
#   ./publicar.sh "mensagem do commit"
set -e
cd "$(dirname "$0")"

versao=$(date +%Y%m%d%H%M)
sed -i -E "s/\?v=[0-9]+/?v=$versao/g" index.html scene.js

if git diff --quiet && git diff --cached --quiet; then
  echo "nada para publicar"
  exit 0
fi

git add -A
git commit -q -m "${1:-chore: publicar atualizacao}"
git push -q origin master

echo "publicado — versao dos assets: $versao"
echo "https://ribeirou.github.io/portfolio-ribas/"
