# CTG Ronda Charrua

Site institucional do **CTG Ronda Charrua**, Farroupilha/RS.

## Produção

- Vercel: https://ctg-ronda-charrua.vercel.app/
- Repositório oficial: `Wspinheiro111/rondacharrua`

## Stack

HTML, CSS e JavaScript estático. O componente `RevealImage` (React + Framer Motion) é empacotado com esbuild em `assets/js/reveal-image.js` e carregado sob demanda pouco antes da primeira imagem aparecer. Não há GSAP.

## Estrutura

- `index.html`, `styles.css`, `script.js`: o site publicado.
- `src/reveal-image.js`: fonte do RevealImage.
- `assets/js/reveal-image.js`: bundle gerado (versionado, é o que a Vercel serve).
- `tools/`: build e testes (não publicados, ver `.vercelignore`).

## Desenvolvimento

```bash
cd tools
npm install
npm run build   # regenera assets/js/reveal-image.js
npm test        # HTML, JSON-LD, links, acessibilidade básica e testes em Chromium (360 a 1440 px)
```

Os testes de navegador usam o Chromium do Playwright (`CHROMIUM_PATH` para outro caminho) e substituem as fotos externas por um placeholder para rodar offline.

## Imagens

Somente fotografias reais publicadas por O Farroupilha / Estampa da Tradição e Portal Arauto, com crédito. Não usar imagens geradas por IA nem de outros CTGs.

## Movimento

Reveal on scroll, parallax discreto no hero, lema com destaque palavra a palavra (sticky) e RevealImage. Tudo respeita `prefers-reduced-motion`.

## Deploy

A raiz do repositório é publicável diretamente na Vercel (projeto `ctg-ronda-charrua`).
