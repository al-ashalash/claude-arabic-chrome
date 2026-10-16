// cross-check-patterns.mjs — الفحص العرضي للقواعد على المدوّنة الحيّة (حارسان):
//   ١) صفر مفاتيح قاموس يظللها نمط (تكرار لحارس build.mjs على الحصاد الحي).
//      ★ (ر9-ب، ٣ جمادى الأولى ١٤٤٨هـ — القرار 96) باستثناء shadowGuard نفسه: الأنماط المحدودة الالتقاط (b) والمعلَّمة lit
//      لا تُعدّ، ويُطبع عدد ما استُثني للسجلّ.
//   ٢) ★ في كل تعدّد تطابق، الفائز (أول نمط) هو الأخصّ — أطول نص ثابت.
//      كان الترتيب الأبجدي يجعل الأعم يبتلع الأخص فيُخرج ترجمة خاطئة (39 حالة قيست).
// (أُعيد بناؤه في المرحلة ٠ بعد ضياعه من المساحة المؤقتة — 2026-08-29)
//   node cross-check-patterns.mjs [--domain=<نطاق>|all]   (الافتراضي all؛ مدوّنة النطاقات
//   غير التطبيق أحدثُ حصاد DOM لها إن وُجد)
import fs from "node:fs";
import path from "node:path";
import { GLOSSARY, DICTS } from "./paths.mjs";

const { C, domainArg, domainsOf, dictFile, workDir, batchDir, label, harvestKeys } = await import(new URL("./domain-arg.mjs", import.meta.url).href);
let bad = 0;
for (const D of domainsOf(domainArg(process.argv, { allowAll: true, fallback: "all" }))) {
console.log(`\n— ${label(D)}`);
const dict = JSON.parse(fs.readFileSync(dictFile(D), "utf8"));
const strings = dict.strings || {};
const pats = (dict.patterns || [])
  .map((p) => { try { return { re: new RegExp(p.re), en: p.en, ar: p.ar, exempt: !!(p.b || p.lit) }; } catch { return null; } })
  .filter(Boolean);

const catPath = path.join(GLOSSARY, "claude-ALL-strings.txt");
const hk = D === "app" ? null : harvestKeys(D);
const cat = D !== "app" ? (hk ? [...new Set(hk.keys)] : [])
  : fs.existsSync(catPath)
  ? [...new Set(fs.readFileSync(catPath, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean))]
  : [];

// ١) لا نمط يظلّل مفتاح قاموس
// ★ (ر9-ب، ٣ جمادى الأولى ١٤٤٨هـ — القرار 96) كحارس build.mjs (shadowGuard): النمط المحدود الالتقاط (b) والمعلَّم lit يُستثنى، فتصادمه
// مع مفتاحٍ حرفي مقبولٌ بقصد (الحرفيّ يسبق الأنماط فيبقى كلٌّ بترجمته). وما يطابقه نمطٌ غير مستثنًى تظليلٌ ولو طابقه مستثنًى معه.
// وكان يعدّها فيخرج 1 في كل دفعةٍ إلى المستودع العام، وكلُّ ما عدّه (claude.ai 5,222، وClaude Code 412) من هذين النوعين وحدهما
const shadowPats = pats.filter((x) => !x.exempt), exemptPats = pats.filter((x) => x.exempt);
let shadow = 0, exempted = 0;
for (const k of Object.keys(strings)) {
  const p = shadowPats.find((x) => x.re.test(k));
  if (p) { shadow++; if (shadow <= 5) console.log(`  تظليل: ${JSON.stringify(k)} ← ${JSON.stringify(p.en)}`); }
  else if (exemptPats.some((x) => x.re.test(k))) exempted++;
}
console.log(`مفاتيح يظللها نمط: ${shadow}  (يجب 0) — ومستثنًى بقصدٍ كما في build.mjs (نمطٌ محدود الالتقاط b أو lit): ${exempted}`);
if (shadow) bad++;

// ٢) الفائز الأخصّ في كل تعدّد تطابق
const litLen = (en) => String(en).replace(/\{[^{}]*\}/g, "").length;
let multi = 0, wrongWinner = 0;
const wrongEx = [];
for (const s of cat) {
  if (strings[s] !== undefined) continue;
  const hits = pats.filter((x) => x.re.test(s));
  if (hits.length < 2) continue;
  multi++;
  const best = hits.reduce((a, b) => (litLen(b.en) > litLen(a.en) ? b : a));
  if (hits[0] !== best) {
    wrongWinner++;
    if (wrongEx.length < 5) wrongEx.push({ s, won: hits[0].en, should: best.en });
  }
}
console.log(`نصوص يغطيها أكثر من نمط: ${multi} من ${cat.length}`);
console.log(`★ حالات يفوز فيها الأعمّ على الأخصّ: ${wrongWinner}  (يجب 0)`);
wrongEx.forEach((e) => console.log(`  «${e.s}»\n     فاز: ${JSON.stringify(e.won)}\n     الأولى: ${JSON.stringify(e.should)}`));
if (wrongWinner) bad++;
if (!cat.length && D !== "app") console.log("✓ (لا حصاد DOM لهذا النطاق بعد — حارس الفائز الخاطئ ينتظر harvest-dom.mjs؛ حارس التظليل أعلاه جرى على القاموس كاملًا)");
else if (!cat.length) console.log("✓ (حارس الفائز الخاطئ على الحصاد الكامل يُفحص في مجلد التطوير وحده — ملف الحصاد خاص لا يُنشر؛ حارس التظليل أعلاه جرى على القاموس كاملًا)");
}

process.exit(bad ? 1 : 0);
