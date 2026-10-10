// Valida HTML, JSON-LD, links internos, imagens locais e sitemap/robots.
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { HtmlValidate } from "html-validate";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
let failed = 0;
const fail = (msg) => { failed++; console.error("✗", msg); };
const ok = (msg) => console.log("✓", msg);

const validator = new HtmlValidate({
  extends: ["html-validate:recommended"],
  rules: {
    "no-inline-style": "off",
    "no-trailing-whitespace": "off",
    "void-style": "off",
    "attribute-boolean-style": "off",
    "prefer-native-element": "off",
    "no-redundant-role": "off",
    "long-title": "off",
    "element-permitted-content": "off",
    "wcag/h30": "off",
    "attr-quotes": "off",
    "doctype-style": "off",
    "text-content": "off",
    "heading-level": "error",
  },
});
const report = await validator.validateString(html, "index.html");
if (report.valid) ok("HTML válido (html-validate)");
else for (const r of report.results) for (const m of r.messages) fail(`HTML ${m.line}:${m.column} [${m.ruleId}] ${m.message}`);

// JSON-LD
for (const [, body] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
  try { JSON.parse(body); ok("JSON-LD é JSON válido"); } catch (e) { fail(`JSON-LD inválido: ${e.message}`); }
}

// IDs únicos e âncoras
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dup.length) fail(`IDs duplicados: ${dup}`); else ok("IDs únicos");
for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) if (!ids.includes(id)) fail(`Âncora sem destino: #${id}`);
ok("Âncoras internas resolvem");

// Arquivos locais referenciados
for (const [, p] of html.matchAll(/(?:src|href)="((?:assets|styles|script)[^"#?]*)"/g)) {
  if (!existsSync(resolve(root, p))) fail(`Arquivo ausente: ${p}`);
}
for (const f of ["styles.css", "script.js", "assets/js/reveal-image.js", "assets/logo-ronda-charrua-128.png", "robots.txt", "sitemap.xml"]) {
  if (!existsSync(resolve(root, f))) fail(`Arquivo ausente: ${f}`);
}
ok("Arquivos locais presentes");

// Imagens: alt e dimensões
for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
  if (!/\salt="/.test(tag)) fail(`<img> sem alt: ${tag.slice(0, 80)}`);
  if (!/\swidth="/.test(tag) || !/\sheight="/.test(tag)) fail(`<img> sem width/height: ${tag.slice(0, 80)}`);
}
ok("Imagens com alt e dimensões");

// Contatos preservados
for (const needle of ["5554996893919", "instagram.com/ctgrondacharrua", "facebook.com/CTGRondaCharruaRS", "Rodovia dos Romeiros", "28 de maio de 1953", "Pelo Rio Grande o Rodeio das Tradições"]) {
  if (!html.includes(needle)) fail(`Conteúdo obrigatório ausente: ${needle}`);
}
ok("Contatos, redes e lema preservados");

// SEO básico
const h1 = (html.match(/<h1\b/g) || []).length;
if (h1 !== 1) fail(`Esperado 1 <h1>, encontrado ${h1}`); else ok("Um único <h1>");
if (!/<link rel="canonical"/.test(html)) fail("canonical ausente");
if (!/<meta property="og:image"/.test(html)) fail("og:image ausente");
if (!/<html lang="pt-BR"/.test(html)) fail("lang ausente");
if (!readFileSync(resolve(root, "sitemap.xml"), "utf8").includes("https://ctg-ronda-charrua.vercel.app/")) fail("sitemap sem URL");
if (!readFileSync(resolve(root, "robots.txt"), "utf8").includes("Sitemap:")) fail("robots sem Sitemap");
ok("SEO básico presente");

if (failed) { console.error(`\n${failed} falha(s)`); process.exit(1); }
console.log("\nTodas as verificações estáticas passaram.");
