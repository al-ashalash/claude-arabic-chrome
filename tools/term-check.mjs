// term-check.mjs — مسحُ القاموس كلِّه على قاعدة المصطلحات المُسنَدة (code/glossary/terms-base.json).
//
// لماذا: قاعدةُ المصطلحات تحكم الجُمل الكثيرة، ومصطلحٌ واحد يرد في مئات النصوص.
// الحارس يلتقط النصوص التي يظهر فيها المصطلح الإنجليزي ولا يظهر في ترجمتها جذرُ
// المقابل المعتمد — مرشَّحاتٌ للمراجعة لا أحكامًا (التصريف والسياق قد يبرّران الفرق).
//
//   node term-check.mjs            → تقريرٌ موجز + ملف code/glossary/_term-flags.json
//   node term-check.mjs --strict   → رمز خروج 1 إن وُجدت مخالفات لمصطلحاتٍ decision=adopt
//   (ودائمًا رمز خروج 2 إن خالفت القاعدةُ أو نصوصها أو مسارد CSV قاعدةَ سوار — siwar-lib.mjs siwarViolations
//    وproseViolations وsiwarCsvViolations)
//   node term-check.mjs --siwar-only [--base=<ملف>] [--adopted=<ملف>] [--csv=<ملف> [--csv-name=<اسم>]]…
//                                  → فحص قاعدة سوار وحده (يستعمله حارس pre-commit على النسخة المرحَّلة)
//   node term-check.mjs --domain=<نطاق>   → قاموس النطاق (القاعدة واحدة للمواقع كلها)؛ ملف
//                                          المخالفات في مجلد عمله
import fs from "node:fs";
import path from "node:path";
import { GLOSSARY, DICTS } from "./paths.mjs";
import { siwarViolations, siwarCsvViolations, proseViolations, loadAdopted, docsCsvFiles, ADOPTED } from "./siwar-lib.mjs";

const argOf = (k) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const SIWAR_ONLY = process.argv.includes("--siwar-only");
const base = JSON.parse(fs.readFileSync(argOf("base") || path.join(GLOSSARY, "terms-base.json"), "utf8"));
// ★ حارس سوار (siwar-lib.mjs): يفشل دائمًا برمز 2 — لا مع --strict وحده — إن حملت قاعدة المصطلحات زوجًا من سوار
// ليس مقابلًا معتمدًا، أو نسبت note أو why إلى معجمٍ من سوار صياغةً ليست مقابلًا معتمدًا (أو ورد في note أو why أو
// judged لفظٌ راجعه المشروع ولم يعتمده لذلك المصطلح أكثر مما رُوجع)، أو ذكر مسردُ CSV تحت
// web/code/docs صياغةً من سوار ليست مقابلًا معتمدًا في صفٍّ يُسند إلى سوار. والمقابلات المعتمدة: المقابل وبدائله
// وقائمة glossary/adopted-renderings.json. والعلاج: terms-publish.mjs للقاعدة، ومعرّف المدخل وحده (أو
// «مقابلٌ آخر في المعجم (المدخل …)») في النصوص والمسرد.
{
  const adopted = loadAdopted(argOf("adopted") || ADOPTED);
  const v = siwarViolations(base, adopted);
  const p = proseViolations(base, adopted);
  const csvs = [];
  process.argv.forEach((a, i) => {
    if (!a.startsWith("--csv=")) return;
    const n = process.argv[i + 1];
    csvs.push([a.slice(6), n && n.startsWith("--csv-name=") ? n.slice(11) : a.slice(6)]);
  });
  if (!SIWAR_ONLY && !argOf("base")) for (const f of docsCsvFiles()) csvs.push([f, path.relative(path.resolve(GLOSSARY, "..", "..", ".."), f).replace(/\\/g, "/")]);
  const c = csvs.flatMap(([f, name]) => siwarCsvViolations(fs.readFileSync(f, "utf8"), base, name, adopted));
  if (v.length || p.length || c.length) {
    if (v.length) console.error(`✗ term-check: ${v.length} مصدرًا من سوار بزوجٍ ليس مقابلًا معتمدًا في terms-base.json — أعد كتابتها بـterms-publish.mjs:`);
    for (const x of v.slice(0, 20)) console.error(`  ${x.term} ← ${x.code} ${x.entry || ""}`);
    if (p.length) console.error(`✗ term-check: ${p.length} صياغةً في note/why/judged منسوبةً إلى معجمٍ من سوار أو غير معتمدة للمصطلح — يُكتفى بمعرّف المدخل:`);
    for (const x of p.slice(0, 20)) console.error(`  ${x.term}.${x.field}`);
    if (c.length) console.error(`✗ term-check: ${c.length} صياغةً من سوار ليست مقابلًا معتمدًا في مسارد CSV — يُكتفى بمعرّف المدخل:`);
    for (const x of c.slice(0, 20)) console.error(`  ${x.file} صف ${x.row} (${x.term}): ${x.wording}`);
    process.exit(2);
  }
  if (SIWAR_ONLY) {
    console.log(`✓ قاعدة سوار: ${base.terms.length} مصطلحًا و${csvs.length} مسردًا بلا مخالفة`);
    process.exit(0);
  }
}
const { C, domainArg, domainsOf, dictFile, workDir, batchDir, label, harvestKeys } = await import(new URL("./domain-arg.mjs", import.meta.url).href);
const DOMAIN = domainArg(process.argv);
const dict = JSON.parse(fs.readFileSync(dictFile(DOMAIN), "utf8"));
const strict = process.argv.includes("--strict");

// جذرٌ عربي مبسّط للمطابقة: يُسقط التشكيل والتطويل وأداة التعريف والسوابق (و/ف/ب/ل/ك)
// والضمائر اللاحقة الشائعة، ويوحّد الألفات — كافٍ لالتقاط الحضور لا للتحليل الصرفي
function stem(s) {
  return s.normalize("NFC")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    // كرسيّ الهمزة يتغيّر قبل الضمير (أعضاء ← أعضائها، شراء ← شرائك، عملاء ← عملائه)
    .replace(/[ئؤ]/g, "ء")
    .replace(/ة/g, "ه").replace(/ى/g, "ي"); // في كل كلمة لا في آخر النصّ فقط
}
function arHasTerm(ar, term) {
  const t = stem(term).split(/\s+/);
  const a = stem(ar);
  // كل كلمةٍ من المقابل يجب أن تظهر (بعد نزع أداة التعريف والسابقة) في الترجمة
  return t.every((w) => {
    const core = w.replace(/^ال/, "");
    if (core.length < 3) return a.includes(w);
    // السوابق الملتصقة: و/ف/ب/ك/ل/ال/لل/بال… وحروف المضارعة والسين (يُثبَّت، ستثبّت، نثبّت) —
    // حتى ثلاثة حروف من هذه المجموعة قبل الجذر
    let pat = core.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // التاء المربوطة تصير مفتوحةً قبل الضمير واللاحقة (مؤسسة ← مؤسستك، خطة ← خطتنا، رسالة ← رسالتك)
    if (/ه$/.test(pat)) pat = pat.slice(0, -1) + "[هت]";
    return new RegExp("(^|[^\\u0600-\\u06FF])[وفبكلاسيتن]{0,3}" + pat + "[\\u0600-\\u06FF]{0,4}(?=[^\\u0600-\\u06FF]|$)").test(a);
  });
}
const flags = [];
let checked = 0;
for (const t of base.terms) {
  if (t.decision === "context" || t.decision === "fix") continue; // تُحسم بشريًّا في المراجعة
  const en = t.en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("(^|[^A-Za-z])" + en + "(?:s|es)?(?=[^A-Za-z]|$)", "i");
  for (const [key, ar] of Object.entries(dict.strings)) {
    if (!re.test(key)) continue;
    // المصطلح جزءٌ من اسم منتجٍ يبقى إنجليزيًّا (Claude Security، Claude Code…) — ليس مخالفة
    if (new RegExp("Claude " + en, "i").test(key) && !new RegExp("(^|[^A-Za-z])" + en + "(?:s|es)?(?=[^A-Za-z]|$)", "i").test(key.replace(new RegExp("Claude " + en, "gi"), ""))) continue;
    checked++;
    // المفتاح الذي يُترك بالإنجليزية عمدًا (علامة/رمز) لا يُعدّ مخالفة
    if (/^[A-Za-z0-9 .\-_/()]+$/.test(ar)) continue;
    // إبقاءُ المصطلح إنجليزيًّا في الترجمة إبقاءٌ متعمَّد (ترويسة Authorization، اسم منتج) — ليس مخالفة
    if (new RegExp("(^|[^A-Za-z])" + en + "(?:s|es)?(?=[^A-Za-z]|$)", "i").test(ar)) continue;
    const forms = (t.forms || [t.ar]).concat(t.ksaa ? [t.ksaa] : []);
    if (!forms.some((f) => arHasTerm(ar, f))) {
      flags.push({ term: t.en, expect: t.ar, decision: t.decision, en: key, ar });
    }
  }
}
const byTerm = {};
for (const f of flags) byTerm[f.term] = (byTerm[f.term] || 0) + 1;
fs.mkdirSync(workDir(DOMAIN), { recursive: true });
fs.writeFileSync(path.join(workDir(DOMAIN), "_term-flags.json"), JSON.stringify(flags, null, 1), "utf8");
console.log(`قاعدة المصطلحات: ${base.terms.length} | نصوص فُحصت: ${checked} | مرشَّحات للمراجعة: ${flags.length}`);
for (const [k, v] of Object.entries(byTerm).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${k}: ${v}`);
const hard = flags.filter((f) => f.decision === "adopt");
if (strict && hard.length) { console.error(`✗ ${hard.length} مخالفة لمصطلحاتٍ معتمدة`); process.exit(1); }
