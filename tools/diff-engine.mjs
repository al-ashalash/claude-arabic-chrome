// diff-engine.mjs — قياس التغطية بسلسلة المحرك نفسها (قاموس ← جموع ← قواعد)
// (وُطّن من مساحة العمل المؤقتة في المرحلة ٠ — 2026-08-29)
// فرز مطابق لسلسلة المحرّك: قاموس ← جموع ← أنماط (بدلالات %M/%W/%P/%C نفسها)
// ★ (ر12، ٥ جمادى الأولى ١٤٤٨هـ — PLAN-3.0.0 E2) و%T<n> كالمحرّك: الالتقاط مفتاحٌ حرفيٌّ في القاموس (cml-shared litLookup) وإلا لم يطابق النمط
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, GLOSSARY, DICTS, EXT } from "./paths.mjs";
await import(pathToFileURL(path.join(EXT, "cml-shared.js")).href);
const SHARED = globalThis.CMLShared;
const G = GLOSSARY;
const AR = path.join(DICTS, 'ar.json');

const dict = JSON.parse(fs.readFileSync(AR, "utf8"));
const strings = dict.strings || {};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pluralRes = [];
for (const [eng, spec] of Object.entries(dict.plurals || {}))
  for (const pat of [eng, spec.plural])
    if (pat) pluralRes.push(new RegExp("^" + esc(pat).replace("%d", "(\\d+)") + "$"));

const MONTHS = new Set("Jan January Feb February Mar March Apr April May Jun June Jul July Aug August Sep Sept September Oct October Nov November Dec December".split(" "));
const WDAYS = new Set("Mon Monday Tue Tuesday Wed Wednesday Thu Thursday Fri Friday Sat Saturday Sun Sunday".split(" "));
const PERIODS = new Set(["AM", "PM"]);
const patRes = (dict.patterns || []).map((p) => { try { return { re: new RegExp(p.re), ar: p.ar }; } catch { return null; } }).filter(Boolean);

function coveredByPattern(text) {
  if (!/[A-Za-z]/.test(text)) return false;
  for (const p of patRes) {
    const m = text.match(p.re);
    if (!m) continue;
    let bad = false;
    p.ar.replace(/%M(\d)/g, (t, g) => { if (!MONTHS.has(m[+g])) bad = true; return t; })
        .replace(/%W(\d)/g, (t, g) => { if (!WDAYS.has(m[+g])) bad = true; return t; })
        .replace(/%P(\d)/g, (t, g) => { if (!PERIODS.has(m[+g])) bad = true; return t; })
        .replace(/%T(\d)/g, (t, g) => { if (SHARED.litLookup([strings], m[+g]) === undefined) bad = true; return t; });
    if (!bad) return true;
  }
  return false;
}

const cat = [...new Set(fs.readFileSync(`${G}/claude-ALL-strings.txt`, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean))];
const plain = [], vars = [];
let haveStr = 0, havePl = 0, havePat = 0;
for (const s of cat) {
  if (strings[s] !== undefined) { haveStr++; continue; }
  if (pluralRes.some((re) => re.test(s))) { havePl++; continue; }
  if (coveredByPattern(s)) { havePat++; continue; }
  if (/\{[A-Za-z_$][\w$]*\}/.test(s)) vars.push(s); else plain.push(s);
}
plain.sort(); vars.sort();
fs.writeFileSync(`${G}/_missing-plain.txt`, plain.join("\n"), "utf8");
fs.writeFileSync(`${G}/_missing-vars.txt`, vars.join("\n"), "utf8");
const covered = haveStr + havePl + havePat;
console.log(`catalog: ${cat.length}`);
console.log(`covered: dictionary ${haveStr}, plurals ${havePl}, patterns ${havePat} = ${covered} (${(covered / cat.length * 100).toFixed(1)}%)`);
console.log(`MISSING plain: ${plain.length} | MISSING vars: ${vars.length} | total ${plain.length + vars.length}`);
