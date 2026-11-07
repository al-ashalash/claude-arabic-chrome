// gen-patterns.mjs — توليد القواعد النمطية من أزواج {en,ar} بحرّاس makePattern + فرز التخصيص
// (وُطّن من مساحة العمل المؤقتة في المرحلة ٠ — 2026-08-29)
// توليد القواعد النمطية من أزواج النصوص ذات المتغيرات.
// منطق التوليد منقول حرفياً من makePattern في options.js، مع حارسين خاصين بالشحن الجماعي:
// تعارض المدوّنة، ورمز القالب $رقم. ★ والفرز بالتخصيص على القائمة **كاملة** في النهاية.
// ★ (ر12، ٥ جمادى الأولى ١٤٤٨هـ — PLAN-3.0.0 E2) زوجٌ يحمل ‎"t": [أسماء متغيّرات]‎ يُولَّد بـ‎%T<n>‎ لتلك المتغيّرات (التقاطٌ مفتاحٌ حرفيٌّ في
// قاموس النطاق، وإلا لم يطابق النمط فيبقى النصّ إنجليزيًّا كلّه — cml-shared fillPattern). والقاعدة الموثَّقة في makePattern: قالبٌ متغيّراته
// كلُّها %T لا يُرفض لأنه «عامّ» لهذا السبب وحده (محفوفٌ بمتغيّرين أو ثابتُه قصير — حدُّه القاموس)، وما يمسّ الأمان باقٍ؛ وقالبٌ يخلط %T
// بمتغيّرٍ حرّ تسري عليه الحرّاس كما كانت. وتعارضُه مع مفتاحٍ حرفي بحكم المحرّك: يطابق تعبيرُه وكلُّ التقاطٍ %T مفتاح. ورمزٌ خامٌ في عربية
// الزوج (‎$n‎ أو ‎%M/%W/%P/%C/%T<n>‎) يُرفض «template-symbol» كما كان — الزوج يكتب أسماء المتغيّرات لا الرموز
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
const { makePattern, makePatternBounded, sortBySpecificity, toolRes, patternApply } = globalThis.CMLShared;
// ★ (ت14-هـ0ب، القرار 142) أشكال الالتقاط المضيَّقة (pattern-shapes.mjs): ‎{x, number}‎ عددٌ و‎{x, date}‎ تاريخ، والحقل ‎"m": [أسماء]‎ لمتغيّرٍ تعرض
// الصفحة قيمته تاريخًا إنجليزيًّا («Until Dec 5, 2026») فيُكتب ‎$<اليوم> %M<الشهر>$<السنة>‎، والفقرات (سطرٌ فارغ) تُولَّد فقرةً فقرةً كما تعرضها الصفحة
const { normalizeIcuArgs, narrowPattern, splitParagraphs } = await import(new URL("./pattern-shapes.mjs", import.meta.url).href);
// ★ (بوابة الشمول ١٤٤٨هـ) ما يرفضه makePattern لقصر ثابته أو لتصادمه مع مفتاحٍ حرفي يُجرَّب بالتقاطٍ محدود
// (قيمةٌ لا جملة) بدل أن يبقى إنجليزيًّا بصمت؛ ‎--no-bounded‎ يعيد السلوك القديم
const BOUNDED = !process.argv.includes("--no-bounded");

const dict = JSON.parse(fs.readFileSync(AR, "utf8"));
const dictKeys = Object.keys(dict.strings || {});
const TRES = toolRes(dict.strings || {});
if (BASE_PATTERNS && fs.existsSync(BASE_PATTERNS)) {
  dict.patterns = JSON.parse(fs.readFileSync(BASE_PATTERNS, "utf8")).patterns || [];
  console.log(`base patterns (from backup): ${dict.patterns.length}`);
} else {
  console.log(`base patterns (in place): ${(dict.patterns || []).length}`);
}
const existing = new Set((dict.patterns || []).map((p) => p.re));
// ★ (ت14-هـ0ب) زوجٌ يحمل ‎"override": true‎ (نهائيٌّ مراجَع يحلّ محلّ عربيةٍ قائمة، كالمختلط في ت14: PLAN «a mixed item's final replaces the current value»)
// يستبدل عربية النمط القائم ذي التعبير نفسه؛ وبدونه يبقى القائم كما كان («مكرر»). كان التعبير المكرر يُسقط النهائي بصمت فيبقى نصف إنجليزي
const byRe = new Map((dict.patterns || []).map((p) => [p.re, p]));
let replaced = 0;

let seen = 0, keptEn = 0, guardRej = 0, corpusRej = 0, tmplRej = 0, dup = 0, added = 0, bounded = 0;
let icuRej = 0, narrowed = 0, paraSplit = 0, paraLit = 0, paraBad = 0;
const newPats = [], rejects = [];
const VAR_IN = /\{[A-Za-z_$][\w$]*\}/;
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
for (const f of INPUTS) {
  if (!fs.existsSync(f)) { console.warn("! غير موجود:", f.split("/").pop()); continue; }
  for (const p of JSON.parse(fs.readFileSync(f, "utf8"))) {
    if (!p || typeof p.en !== "string" || typeof p.ar !== "string") continue;
    seen++;
    // ★ (ت14-هـ0ب) الفقرات: الصفحة تعرض كل فقرةٍ عقدةَ نصٍّ وحدها (الماسح يقسمها بالسطر الفارغ)، فمدخل الرسالة كاملةً لا يُطلب. تُولَّد أزواج
    // الفقرات بترتيبها إن تساوى عددها في الطرفين: ما لا متغيّر فيه حرفيٌّ (لا يغلب مدخلًا قائمًا)، وما فيه متغيّرٌ قالبٌ بحرّاسه؛ والرسالة كاملةً كما كانت
    const sp = splitParagraphs(p.en.trim(), p.ar.trim());
    if (sp && sp.why) { paraBad++; rejects.push({ why: "paragraph-count " + sp.en + "/" + sp.ar, en: p.en.trim() }); }
    const subs = sp && sp.pairs ? sp.pairs : [];
    if (subs.length) paraSplit++;
    for (const q of subs) {
      if (VAR_IN.test(q.en)) { handle(Object.assign({}, p, { en: q.en, ar: q.ar, t: (p.t || []).filter((n) => q.en.includes("{" + n + "}")), m: (p.m || []).filter((n) => q.en.includes("{" + n + "}")) }), true); continue; }
      if (!q.ar || q.ar === q.en || /\{[A-Za-z_$]/.test(q.en)) continue;
      dict.strings = dict.strings || {};
      if (!hasOwn(dict.strings, q.en)) { dict.strings[q.en] = q.ar; dictKeys.push(q.en); paraLit++; }
    }
    handle(p, false);
  }
}
function handle(p, isPara) {
  {
    let en = p.en.trim(), ar = p.ar.trim();
    if (!ar || ar === en) { if (!isPara) keptEn++; return; }
    if (/\$\d/.test(ar) || /%[MWPCT]\d/.test(ar)) { tmplRej++; rejects.push({ why: "template-symbol", en }); return; }
    // ★ (ت14-هـ0ب) ‎{x, number}‎ و‎{x, date}‎ ← ‎{x}‎ بالتقاطٍ مضيَّق؛ وما سواهما من ICU (الجمع والاختيار والوقت) لأداة ICU أو للمدخل اليدوي
    const nz = normalizeIcuArgs(en, ar);
    if (nz.why) { icuRej++; rejects.push({ why: nz.why, en }); return; }
    en = nz.en; ar = nz.ar;
    const kinds = Object.assign({}, nz.kinds);
    // "m": متغيّراتٌ تعرض الصفحة قيمتها تاريخًا إنجليزيًّا — أسماءٌ من القالب نفسه، وإلا رُفض الزوج (كاسمٍ غريبٍ في "t")
    if (Array.isArray(p.m)) for (const n of p.m) {
      if (typeof n !== "string" || !en.includes("{" + n + "}")) { guardRej++; rejects.push({ why: "m-name", en }); return; }
      kinds[n] = "date";
    }
    const narrow = (pp) => { if (!pp || !Object.keys(kinds).length) return pp; const np = narrowPattern(pp, kinds); if (np.why) return { why: np.why }; if (np !== pp) narrowed++; return np; };
    // (ر12) متغيّرات %T: أسماءٌ من القالب نفسه، وإلا رُفض الزوج كله (makePattern يرفض الاسم الغريب)
    const opt = Array.isArray(p.t) && p.t.length ? { t: p.t } : undefined;
    // ★ (مراجعة دمج ت3، ٢٩ ربيع الآخر ١٤٤٨هـ) زوجٌ يطلب الالتقاط المحدود (bounded: true) يُبنى به مباشرة: قالبٌ لم يُرَ في صفحةٍ
    // عامة فلا يُعرف شكل قيمته، ونمطه العادي (.+?) يبتلع جملةً إنجليزية فيخرجها مختلطة («From {start} to {end}» حوّل ملخّصَين
    // إنجليزيين، و«{n} sources» يجعل «Data sources» «المصادر (Data)»). فالتقاطه قيمةٌ لا جملة: رقمٌ لمتغيّر العدد، وإلا أربعة رموز
    let pat = p.bounded === true ? null : narrow(makePattern(en, ar, opt)), why = null;
    if (pat && pat.why) { why = pat.why; pat = null; }
    else if (!pat) why = p.bounded === true ? "bounded-requested" : "guard";
    else {
      if (existing.has(pat.re)) { if (p.override === true && byRe.has(pat.re) && byRe.get(pat.re).ar !== pat.ar) { byRe.get(pat.re).ar = pat.ar; replaced++; } else dup++; return; }
      const re = new RegExp(pat.re), fill = /%[MWPT]\d/.test(pat.ar);
      const clash = dictKeys.find((k) => (fill ? patternApply(re, pat.ar, k, TRES) !== null : re.test(k)));
      if (clash) why = "matches-literal: " + clash;
    }
    if (why) {
      // الالتقاط المحدود: تصادمه مع مفتاحٍ حرفي لا يضرّ (الحرفي يسبق الأنماط في المحرّك)؛ وخطر الخلط على غير المترجَم
      // تفحصه بوابة الشمول على الحصاد كله
      let bp = BOUNDED ? narrow(makePatternBounded(en, ar, opt)) : null;
      if (bp && bp.why) { why = bp.why; bp = null; }
      if (!bp) { if (why === "guard" || why === "bounded-requested") guardRej++; else corpusRej++; rejects.push({ why, en }); return; }
      if (existing.has(bp.re)) { if (p.override === true && byRe.has(bp.re) && byRe.get(bp.re).ar !== bp.ar) { byRe.get(bp.re).ar = bp.ar; replaced++; } else dup++; return; }
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
console.log(`(ت14-هـ0ب) استُبدلت عربية نمطٍ قائم (override): ${replaced} | ICU مرفوض: ${icuRej} | التقاطٌ مضيَّق (عدد أو تاريخ): ${narrowed} | رسائل بفقرات: ${paraSplit} (حرفيّات فقرات جديدة: ${paraLit}، عددٌ مختلف: ${paraBad})`);
console.log(`أُضيف: ${added} ← المجموع ${dict.patterns.length}`);
