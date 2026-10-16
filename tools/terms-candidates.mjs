// terms-candidates.mjs — المرحلة ٣: المصطلحات المرشّحة من متون النطاقات (حصاد الكتل)، أحادية وثنائية وثلاثية،
// بتكرار ≥ MINF وصفحات ≥ MIND، بلا كلمات الوظيفة ولا أسماء العلامات ولا ما في قاعدة المصطلحات أصلًا.
// ومع كل مرشّح: عدّه في كل نطاق، وسياقان قصيران، وما يقابله في قواميس الواجهة (أمثلةٌ مترجمة فيها المصطلح).
//   node terms-candidates.mjs <out.json> [--minf=10] [--mind=4]
import fs from "node:fs";
import path from "node:path";
import { GLOSSARY as G, DICTS } from "./paths.mjs";
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith("--" + k + "=")); return a ? +a.split("=")[1] : d; };
const MINF = arg("minf", 10), MIND = arg("mind", 4);
const OUT = process.argv[2];
const STOP = new Set(("a an the and or of to in on for with by from at as is are be was were been being this that these those it its you your yours we our us they them their he she his her not no nor if then than so such can cannot can't may might will would should could must do does did done doing have has had having into onto over under about after before between through during without within up down out off more most less least other others same own each any all both few many much some very also just only new use used uses using make makes made get gets got set sets see sees how what which who whom whose when where why via per etc one two three four five first second next last vs i me my mine here there now once again further while because until upon either neither whether both yet still even ever always never often already able like also e.g i.e etc eg ie let lets let's want need needs well way ways may also however instead such").split(/\s+/));
const BRAND = /^(claude|anthropic|opus|sonnet|haiku|fable|mythos|max|pro|team|enterprise|google|microsoft|slack|github|chrome|windows|macos|linux|ios|android|aws|bedrock|vertex|azure|python|typescript|javascript|java|go|ruby|php|curl|json|yaml|http|https|url|api|sdk|cli|mcp|ui|id|ids|os|pdf|csv|oauth|saml|scim|sso|gcp|jwt|zdr|tpm|rpm|itpm|otpm|mtok|mcp)$/;
const base = JSON.parse(fs.readFileSync(G + "/terms-base.json", "utf8")).terms.map((t) => t.en.toLowerCase());
const baseSet = new Set(base);
function latest(d) { const dir = path.join(G, d, "_harvest"); const f = fs.readdirSync(dir).filter((n) => /^blocks-.*\.json$/.test(n)).sort().pop(); return f ? path.join(dir, f) : null; }
function plain(t) { return t.replace(/<c(\d+)>[\s\S]*?<\/c\1>/g, " ¦ ").replace(/<\/?[abisgc]\d+\/?>/g, " ").replace(/\s+/g, " ").trim(); }
function toks(s) { return s.toLowerCase().replace(/[’']/g, "'").split(/[^a-z0-9'\-¦]+/).filter(Boolean); }
const stats = new Map(); // term → {n, pages:Set, dom:{d:n}, ctx:[]}
for (const d of ["privacy", "support", "docs"]) {
  const f = latest(d);
  if (!f) { console.warn("! لا حصاد كتل لـ" + d); continue; }
  const hv = JSON.parse(fs.readFileSync(f, "utf8"));
  const pagesOf = new Map();
  for (const [pk, fps] of Object.entries(hv.pages)) for (const fp of fps) { if (!pagesOf.has(fp)) pagesOf.set(fp, []); pagesOf.get(fp).push(pk); }
  for (const b of hv.blocks) {
    const text = plain(b.tpl), words = toks(text);
    const pgs = pagesOf.get(b.fp) || [];
    const seen = new Set();
    for (let n = 1; n <= 3; n++) {
      for (let i = 0; i + n <= words.length; i++) {
        const g = words.slice(i, i + n);
        if (g.some((w) => w === "¦" || /^\d/.test(w) || w.length < 2)) continue;
        if (STOP.has(g[0]) || STOP.has(g[n - 1])) continue;
        if (g.every((w) => STOP.has(w) || BRAND.test(w))) continue;
        if (n === 1 && (g[0].length < 4 || BRAND.test(g[0]))) continue;
        if (BRAND.test(g[0]) && n > 1 && BRAND.test(g[n - 1])) continue;
        const k = g.join(" ");
        if (seen.has(k)) continue;
        seen.add(k);
        let s = stats.get(k);
        if (!s) { s = { n: 0, pages: new Set(), dom: {}, ctx: [] }; stats.set(k, s); }
        const c = Math.max(1, pgs.length);
        s.n += c; s.dom[d] = (s.dom[d] || 0) + c;
        for (const p of pgs) s.pages.add(d + ":" + p);
        if (s.ctx.length < 2 && text.length < 260) s.ctx.push(text);
      }
    }
  }
}
// ما في قواميس الواجهة: أمثلةٌ مترجمة تحوي المصطلح (مفتاحًا قصيرًا أولًا)
const dicts = ["ar.json", "ar-support.json", "ar-privacy.json", "ar-docs.json"].map((f) => JSON.parse(fs.readFileSync(path.join(DICTS, f), "utf8")).strings || {});
const entries = []; for (const d of dicts) for (const [en, ar] of Object.entries(d)) entries.push([en, ar]);
entries.sort((a, b) => a[0].length - b[0].length);
// الجمع يُطوى في مفرده متى وُجد (models ← model، policies ← policy): العدّ والصفحات والسياق للمفرد
function singular(k) {
  const w = k.split(" "), last = w[w.length - 1];
  const cands = [];
  if (/ies$/.test(last)) cands.push(last.slice(0, -3) + "y");
  if (/(ses|xes|ches|shes)$/.test(last)) cands.push(last.slice(0, -2));
  if (/s$/.test(last) && !/ss$/.test(last)) cands.push(last.slice(0, -1));
  for (const c of cands) { const kk = w.slice(0, -1).concat(c).join(" "); if (stats.has(kk)) return kk; }
  return null;
}
for (const [k, s] of [...stats.entries()]) {
  const sg = singular(k);
  if (!sg) continue;
  const t = stats.get(sg);
  t.n += s.n; for (const p of s.pages) t.pages.add(p);
  for (const d in s.dom) t.dom[d] = (t.dom[d] || 0) + s.dom[d];
  t.plural = k;
  stats.delete(k);
}
let out = [...stats.entries()].filter(([k, s]) => s.n >= MINF && s.pages.size >= MIND && !baseSet.has(k) && !baseSet.has(s.plural || ""))
  .map(([k, s]) => ({ en: k, plural: s.plural || undefined, n: s.n, pages: s.pages.size, dom: s.dom, ctx: s.ctx }));
// ثنائيةٌ لا تزيد على أحاديتها (جزءٌ من ثلاثية أكثر شيوعًا) تُترك للأطول إن تساوى العدّ
const byK = new Map(out.map((x) => [x.en, x]));
out = out.filter((x) => { const w = x.en.split(" "); if (w.length !== 2) return true;
  for (const [k, y] of byK) if (y.en.split(" ").length === 3 && y.en.includes(x.en) && y.n >= x.n * 0.9) return false; return true; });
for (const x of out) {
  const re = new RegExp("\\b" + x.en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "s?\\b", "i");
  x.ui = entries.filter(([en]) => re.test(en)).slice(0, 4).map(([en, ar]) => en.slice(0, 80) + " ⇒ " + ar.slice(0, 80));
}
out.sort((a, b) => b.n - a.n);
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
const by = (n) => out.filter((x) => x.en.split(" ").length === n).length;
console.log(`مرشّحات: ${out.length} (أحادية ${by(1)}، ثنائية ${by(2)}، ثلاثية ${by(3)})`);
console.log(out.slice(0, 40).map((x) => x.en + " " + x.n + "/" + x.pages).join(" | "));
