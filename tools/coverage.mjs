// coverage.mjs — قياسُ تغطية القاموس على آخر حصادٍ حيّ (code/glossary/_live-catalog.txt)
// بمنطق المحرّك: مطابقةٌ حرفية ثم نمطٌ ثم صيغةُ جمع. يُخرج النسبة وقائمة الباقي.
import fs from "node:fs";
import path from "node:path";
import { GLOSSARY, DICTS } from "./paths.mjs";

const { C, domainArg, domainsOf, dictFile, workDir, batchDir, label, harvestKeys } = await import(new URL("./domain-arg.mjs", import.meta.url).href);
// ‎--domain=<نطاق>‎: مدوّنةُ غير التطبيق أحدثُ حصاد DOM له (harvest-dom.mjs)
const DOMAIN = domainArg(process.argv);
let cat;
if (DOMAIN === "app") {
  const catPath = path.join(GLOSSARY, "_live-catalog.txt");
  if (!fs.existsSync(catPath)) { console.error("! لا حصاد حيّ — شغّل harvest-live.mjs أولًا"); process.exit(1); }
  cat = fs.readFileSync(catPath, "utf8").split(/\r?\n/).filter(Boolean);
} else {
  const hk = harvestKeys(DOMAIN);
  if (!hk) { console.error(`! لا حصاد DOM لـ${label(DOMAIN)} — شغّل harvest-dom.mjs --domain=${DOMAIN} أولًا`); process.exit(1); }
  cat = hk.keys;
}
const d = JSON.parse(fs.readFileSync(dictFile(DOMAIN), "utf8"));
const S = d.strings;
const pats = (d.patterns || []).map((p) => { try { return new RegExp(p.re); } catch { return null; } }).filter(Boolean);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const plur = [];
for (const [en, sp] of Object.entries(d.plurals || {}))
  for (const p of [en, sp.plural]) if (p) plur.push(new RegExp("^" + esc(p).replace("%d", "(\\d+)") + "$"));

let hit = 0;
const miss = [];
for (const s of cat) {
  if (S[s] !== undefined || pats.some((r) => r.test(s)) || plur.some((r) => r.test(s))) hit++;
  else miss.push(s);
}
const noVar = miss.filter((s) => !/\{/.test(s));
console.log(`نصوص الموقع الحيّة: ${cat.length} | المغطّى: ${hit} = ${(hit / cat.length * 100).toFixed(1)}% | الباقي: ${miss.length} (بلا متغيّرات ${noVar.length} · بمتغيّرات ${miss.length - noVar.length})`);
console.log("عيّنة الباقي:", noVar.slice(0, 8).map((s) => JSON.stringify(s.slice(0, 36))).join(" · "));
fs.mkdirSync(workDir(DOMAIN), { recursive: true });
fs.writeFileSync(path.join(workDir(DOMAIN), "_live-missing-after.txt"), miss.join("\n") + "\n", "utf8");
