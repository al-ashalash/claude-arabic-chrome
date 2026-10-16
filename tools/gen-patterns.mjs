// gen-patterns.mjs — توليد القواعد النمطية من أزواج {en,ar} بحرّاس makePattern + فرز التخصيص
// (وُطّن من مساحة العمل المؤقتة في المرحلة ٠ — 2026-08-29)
// توليد القواعد النمطية من أزواج النصوص ذات المتغيرات.
// منطق التوليد منقول حرفياً من makePattern في options.js، مع حارسين خاصين بالشحن الجماعي:
// تعارض المدوّنة، ورمز القالب $رقم. ★ والفرز بالتخصيص على القائمة **كاملة** في النهاية.
import fs from "node:fs";
import path from "node:path";
import { ROOT, GLOSSARY, DICTS } from "./paths.mjs";

const { C, domainArg, domainsOf, dictFile, workDir, batchDir, label, harvestKeys } = await import(new URL("./domain-arg.mjs", import.meta.url).href);
// ‎--domain=<نطاق>‎: قاموس النطاق، ومدخلاته الافتراضية أزواجُ المتغيّرات في مجلد عمله
const DOMAIN = domainArg(process.argv);
const G = workDir(DOMAIN);
const AR = dictFile(DOMAIN);
const BASE_PATTERNS = process.argv.slice(2).find((a) => !a.startsWith("--"));
// المدخلات تُمرَّر بالسطر (‎--in=مسار‎) وإلا فقائمةُ الدفعات التاريخية — فالتوليد
// يتكرر مع كل حصادٍ جديد، وتثبيتُ المسارات في الشيفرة كان يُلزم تعديلَها كل مرة
const inArgs = process.argv.filter((x) => x.startsWith("--in=")).map((x) => x.slice(5));
const INPUTS = inArgs.length ? inArgs : DOMAIN !== "app"
  ? (fs.existsSync(G) ? fs.readdirSync(G).filter((f) => /^_vars-pairs-.*\.json$/.test(f)).sort().map((f) => `${G}/${f}`) : [])
  : [
  `${G}/_vars-pairs-desktop.json`,
  `${G}/_vars-pairs-web-20260814b.json`,
  `${G}/_vars-pairs-20260815.json`,
  `${G}/_vars-pairs-20260828.json`,
];

// النسخة الواحدة من makePattern وفرز التخصيص — من cml-shared.js (سكربت ثنائي الاستخدام)
// عبر EXT من ملف المسارات لا مسارٍ نسبيٍّ لبنية العمل: في نسخة النشر السطحية لا يوجد
// ../../user/ (مراجعة كودكس: الأداة كانت تنكسر من checkout النشر)
{
  const { EXT: EXT_P } = await import(new URL("./paths.mjs", import.meta.url).href);
  const { pathToFileURL } = await import("node:url");
  await import(pathToFileURL((await import("node:path")).join(EXT_P, "cml-shared.js")).href);
}
const { makePattern, makePatternBounded, sortBySpecificity } = globalThis.CMLShared;
// ★ (بوابة الشمول ١٤٤٨هـ) ما يرفضه makePattern لقصر ثابته أو لتصادمه مع مفتاحٍ حرفي يُجرَّب بالتقاطٍ محدود
// (قيمةٌ لا جملة) بدل أن يبقى إنجليزيًّا بصمت؛ ‎--no-bounded‎ يعيد السلوك القديم
const BOUNDED = !process.argv.includes("--no-bounded");

const dict = JSON.parse(fs.readFileSync(AR, "utf8"));
const dictKeys = Object.keys(dict.strings || {});
if (BASE_PATTERNS && fs.existsSync(BASE_PATTERNS)) {
  dict.patterns = JSON.parse(fs.readFileSync(BASE_PATTERNS, "utf8")).patterns || [];
  console.log(`base patterns (from backup): ${dict.patterns.length}`);
} else {
  console.log(`base patterns (in place): ${(dict.patterns || []).length}`);
}
const existing = new Set((dict.patterns || []).map((p) => p.re));

let seen = 0, keptEn = 0, guardRej = 0, corpusRej = 0, tmplRej = 0, dup = 0, added = 0, bounded = 0;
const newPats = [], rejects = [];
for (const f of INPUTS) {
  if (!fs.existsSync(f)) { console.warn("! غير موجود:", f.split("/").pop()); continue; }
  for (const p of JSON.parse(fs.readFileSync(f, "utf8"))) {
    if (!p || typeof p.en !== "string" || typeof p.ar !== "string") continue;
    seen++;
    const en = p.en.trim(), ar = p.ar.trim();
    if (!ar || ar === en) { keptEn++; continue; }
    if (/\$\d/.test(ar) || /%[MWPC]\d/.test(ar)) { tmplRej++; rejects.push({ why: "template-symbol", en }); continue; }
    // ★ (مراجعة دمج ت3، ٢٩ ربيع الآخر ١٤٤٨هـ) زوجٌ يطلب الالتقاط المحدود (bounded: true) يُبنى به مباشرة: قالبٌ لم يُرَ في صفحةٍ
    // عامة فلا يُعرف شكل قيمته، ونمطه العادي (.+?) يبتلع جملةً إنجليزية فيخرجها مختلطة («From {start} to {end}» حوّل ملخّصَين
    // إنجليزيين، و«{n} sources» يجعل «Data sources» «المصادر (Data)»). فالتقاطه قيمةٌ لا جملة: رقمٌ لمتغيّر العدد، وإلا أربعة رموز
    let pat = p.bounded === true ? null : makePattern(en, ar), why = null;
    if (!pat) why = p.bounded === true ? "bounded-requested" : "guard";
    else {
      if (existing.has(pat.re)) { dup++; continue; }
      const re = new RegExp(pat.re);
      const clash = dictKeys.find((k) => re.test(k));
      if (clash) why = "matches-literal: " + clash;
    }
    if (why) {
      // الالتقاط المحدود: تصادمه مع مفتاحٍ حرفي لا يضرّ (الحرفي يسبق الأنماط في المحرّك)؛ وخطر الخلط على غير المترجَم
      // تفحصه بوابة الشمول على الحصاد كله
      const bp = BOUNDED ? makePatternBounded(en, ar) : null;
      if (!bp) { if (why === "guard" || why === "bounded-requested") guardRej++; else corpusRej++; rejects.push({ why, en }); continue; }
      if (existing.has(bp.re)) { dup++; continue; }
      pat = bp; bounded++;
    }
    existing.add(pat.re);
    newPats.push(pat);
    added++;
  }
}

// ★ الفرز بالتخصيص — النسخة المشتركة (الترتيب دلالي: الأخص أولاً)
dict.patterns = sortBySpecificity((dict.patterns || []).concat(newPats));

fs.writeFileSync(AR, JSON.stringify(dict, null, 2) + "\n", "utf8");
fs.writeFileSync(`${G}/_patterns-rejected.json`, JSON.stringify(rejects, null, 1), "utf8");
console.log(`أزواج: ${seen} | إنجليزي: ${keptEn} | حارس: ${guardRej} | قالب: ${tmplRej} | تعارض: ${corpusRej} | مكرر: ${dup} | بالتقاطٍ محدود: ${bounded}`);
console.log(`أُضيف: ${added} ← المجموع ${dict.patterns.length}`);
