# CTG Ronda Charrua

Site institucional do **CTG Ronda Charrua**, Farroupilha/RS.

## Produção

- Vercel: https://ctg-ronda-charrua.vercel.app/
- Repositório oficial: `Wspinheiro111/rondacharrua`

## Stack

HTML, CSS e JavaScript estático, com Framer Motion/React carregados como módulos ESM apenas para o componente de `RevealImage`.

## Efeito de imagem

As imagens principais de Atividades e Galeria usam `IntersectionObserver` para disparar a animação de `clip-path: inset(100% 0 0 0)` para `inset(0% 0 0 0)` em 0,8 s `easeOut`, respeitando `prefers-reduced-motion`.

## Deploy

A raiz do repositório é publicável diretamente na Vercel.
