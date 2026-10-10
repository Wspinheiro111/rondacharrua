// Teste em Chromium: overflow horizontal, erros de console, menu, formulário,
// reduced motion e RevealImage. Imagens externas são substituídas por um
// placeholder local para o teste rodar offline.
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "tools/test-results");
mkdirSync(out, { recursive: true });
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain" };
const server = createServer((req, res) => {
  const path = resolve(root, "." + (req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0]));
  if (!path.startsWith(root) || !existsSync(path)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }).end(readFileSync(path));
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/`;

const svg = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#5a121b"/></svg>`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let failed = 0;
const fail = (m) => { failed++; console.error("✗", m); };
const ok = (m) => console.log("✓", m);

async function open(width, height, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: opts.reduced ? "reduce" : "no-preference", hasTouch: width < 900 });
  await ctx.route(/^https:\/\/(media\.ofarroupilha|cdn-images-site-arauto)/, (r) => r.fulfill({ contentType: "image/svg+xml", body: svg(1024, 683) }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|google\.com\/maps/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  await page.goto(base, { waitUntil: "load" });
  return { ctx, page, errors };
}

async function scrollThrough(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 500) { await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y); await page.waitForTimeout(60); }
}

const viewports = [[360, 740], [375, 812], [390, 844], [430, 932], [768, 1024], [1440, 900]];
for (const [w, h] of viewports) {
  const { ctx, page, errors } = await open(w, h);
  await scrollThrough(page);
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) fail(`${w}px: scroll horizontal (${overflow}px)`); else ok(`${w}px: sem scroll horizontal`);
  const cut = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && (r.right > document.documentElement.clientWidth + 1 || r.left < -1) && !el.closest(".hero-media-wrap,.menu:not(.open),.skip-link,.gallery figure,.hero-photo-frame,.reveal-image-frame,.sr-only");
  }).map((el) => el.className || el.tagName).slice(0, 5));
  if (cut.length) fail(`${w}px: elementos fora da tela: ${cut}`);
  const mounted = await page.evaluate(() => document.querySelectorAll(".reveal-image-frame img").length);
  if (mounted !== 4) fail(`${w}px: RevealImage montou ${mounted}/4 imagens`);
  const hidden = await page.evaluate(() => [...document.querySelectorAll(".reveal-image-frame")].filter((f) => !f.closest(".slide:not(:first-child)") && getComputedStyle(f).clipPath.startsWith("inset(100%")).length);
  if (hidden) fail(`${w}px: ${hidden} imagem(ns) do RevealImage ficaram recortadas (invisíveis)`);
  if (errors.length) fail(`${w}px: erros de console: ${errors.join(" | ")}`);
  if (w < 700) {
    const btn = await page.evaluate(() => { const r = document.querySelector(".whatsapp-float").getBoundingClientRect(); return { r: r.right, b: r.bottom }; });
    if (btn.r > w || btn.b > h) fail(`${w}px: WhatsApp fora da tela`);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/home-${w}.png` });
  await ctx.close();
}

// Menu mobile
{
  const { ctx, page } = await open(375, 812);
  const t = page.locator(".menu-toggle");
  await t.click();
  if ((await t.getAttribute("aria-expanded")) !== "true") fail("menu não abriu");
  await page.keyboard.press("Escape");
  if ((await t.getAttribute("aria-expanded")) !== "false") fail("Esc não fechou o menu"); else ok("menu abre e fecha com Esc");
  await t.click();
  await page.locator('.menu a[href="#contato"]').click();
  if (await page.locator(".menu.open").count()) fail("menu não fechou ao navegar"); else ok("menu fecha ao escolher link");
  await ctx.close();
}

// Formulário
{
  const { ctx, page } = await open(390, 844);
  await page.evaluate(() => { window.__opened = null; window.open = (u) => { window.__opened = u; return {}; }; });
  await page.locator("#contato").scrollIntoViewIfNeeded();
  await page.click('#contact-form button[type="submit"]');
  const invalid = await page.locator('#contact-form [aria-invalid="true"]').count();
  if (invalid !== 4) fail(`validação: esperados 4 campos inválidos, obtidos ${invalid}`); else ok("formulário vazio é bloqueado com erros por campo");
  await page.fill("#nome", "Maria Teste");
  await page.fill("#telefone", "(54) 99999-0000");
  await page.selectOption("#assunto", "Eventos");
  await page.fill("#mensagem", "Quero saber sobre eventos.");
  await page.click('#contact-form button[type="submit"]');
  const url = await page.evaluate(() => window.__opened);
  if (!url || !url.startsWith("https://wa.me/5554996893919?text=") || !decodeURIComponent(url).includes("Maria Teste")) fail(`envio WhatsApp incorreto: ${url}`);
  else ok("envio abre wa.me/5554996893919 com a mensagem");
  await page.evaluate(() => { window.open = () => null; });
  await page.click('#contact-form button[type="submit"]');
  if (!(await page.locator("#form-status a").count())) fail("sem link alternativo quando o pop-up é bloqueado"); else ok("link alternativo aparece se o navegador bloquear a aba");
  await ctx.close();
}

// Lema: palavras acendem com o scroll
{
  const { ctx, page } = await open(1440, 900);
  await page.evaluate(() => { const r = document.querySelector(".motto").getBoundingClientRect(); window.scrollTo({ top: window.scrollY + r.top - 200, behavior: 'instant' }); });
  await page.waitForTimeout(200);
  const lit = await page.locator(".motto-text span.lit").count();
  if (lit < 3) fail(`lema: apenas ${lit} palavras acesas no meio da seção`); else ok(`lema: ${lit}/7 palavras acesas no scroll`);
  await ctx.close();
}

// Galeria: botões avançam o carrossel
{
  const { ctx, page } = await open(1440, 900);
  await page.locator("#galeria").scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => document.getElementById("track").scrollLeft);
  await page.click('[data-slide="1"]');
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => document.getElementById("track").scrollLeft);
  if (after <= before) fail("galeria: botão próxima não avançou"); else ok("galeria: botões rolam o carrossel");
  const second = await page.evaluate(() => getComputedStyle(document.querySelectorAll("#track .reveal-image-frame")[1]).clipPath);
  if (second.startsWith("inset(100%")) fail("galeria: 2ª foto não foi revelada após avançar"); else ok("galeria: foto seguinte é revelada ao avançar");
  await ctx.close();
}

// Reduced motion
{
  const { ctx, page, errors } = await open(390, 844, { reduced: true });
  const r = await page.evaluate(() => ({
    reveal: getComputedStyle(document.querySelector(".reveal")).opacity,
    words: [...document.querySelectorAll(".motto-text span")].every((s) => getComputedStyle(s).opacity === "1"),
    sticky: getComputedStyle(document.querySelector(".motto")).position,
  }));
  if (r.reveal !== "1" || !r.words || r.sticky !== "static") fail(`reduced motion não respeitado: ${JSON.stringify(r)}`); else ok("prefers-reduced-motion: conteúdo visível, sem sticky/parallax");
  if (errors.length) fail(`reduced motion: erros ${errors}`);
  await ctx.close();
}

await browser.close(); server.close();
if (failed) { console.error(`\n${failed} falha(s)`); process.exit(1); }
console.log("\nTodos os testes de navegador passaram. Capturas em tools/test-results/");
