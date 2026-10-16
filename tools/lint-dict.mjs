// lint-dict.mjs — فحوص صحة القاموس والعقود الآلية (المرحلة ١ من خطة الإطلاق).
// يخرج بـ0 عند السلامة و1 عند أي فشل — فيصلح بوابةً في CI وقبل كل دمج.
//
// الفحوص:
//  ١) ★ المفاتيح المكررة بمسح نصي خام — JSON.parse يُبقي الأخير صامتًا، فدفعةٌ فيها
//     مفتاح مكرر بترجمة أسوأ تدهس الأفضل بلا أثر، ولا أداة أخرى تراها.
//  ٢) أزواج فارغة أو غير نصية.
//  ٣) قواعد فاسدة التعبير أو مراجع $n بلا مجموعة مقابلة.
//  ٤) ترتيب التخصيص قائم فعلًا (بالدالة المشتركة نفسها لا بنسخة).
//  ٥) ★ حارس عقد الحصاد: نصّ unescapeLiteral في harvest-all-strings.js مطابق للمشترك
//     — السكربت ذاتي الاكتفاء حكمًا (يُلصق في وحدة التحكم) فنسخته قسرية، والعقد
//     «أبقِهما متطابقتين» صار آليًا بهذا الفحص لا يدويًا.
//  ٦) تحذيرات مصطلح (لا تُفشل): chat بلا «محادث»، skill بلا «مهار».
//  ٧) ★ مفاتيح لا يطابقها المحرّك أبدًا (١-٠د): محفوفةٌ ببياض (المحرّك يقصّ النصّ قبل البحث
//     بـCMLShared.textKey) — مدخلٌ ميّتٌ يوهم بتغطيةٍ غير موجودة. (لا سقف طول: المحرّك يطلب المفتاح مهما طال منذ ٢١ ربيع الآخر ١٤٤٨هـ)
//
//   node lint-dict.mjs [--domain=<نطاق>|all]   (الافتراضي all: قواميس المواقع كلها)
import fs from "node:fs";
import path from "node:path";
import * as __P from "./paths.mjs";
const { DICTS } = __P;
const CODE = __P.CODE || null; // غير مُصدَّر في بنية النشر — فحارس الحصاد تطويري وحده

await import(new URL("file:///" + path.join(__P.EXT, "cml-shared.js").split(path.sep).join("/")).href);
const { sortBySpecificity, patternLiteralLen } = globalThis.CMLShared;

const { C, domainArg, domainsOf, dictFile, label } = await import(new URL("./domain-arg.mjs", import.meta.url).href);
const SEL = domainArg(process.argv, { allowAll: true, fallback: "all" });
let fails = 0, warns = 0;
const fail = (m) => { console.error("✗ " + m); fails++; };
const warn = (m) => { console.warn("⚠ " + m); warns++; };

for (const D of domainsOf(SEL)) {
const AR = dictFile(D);
if (!fs.existsSync(AR)) { fail(`${label(D)}: قاموسه غير موجود — ${path.basename(AR)}`); continue; }
console.log(`
— ${label(D)}: ${path.basename(AR)}`);
const raw = fs.readFileSync(AR, "utf8");

// ١) المفاتيح المكررة — مسح خام قبل التحليل، **داخل قسم strings وحده**
// (درسٌ من أول تشغيل: الإزاحة وحدها لا تكفي نطاقًا — قسم notes التوثيقي يشارك المستوى
// نفسه فأنذر كذبًا. الحدّ الصحيح بمطابقة أقواس القسم الحقيقية لا بالإزاحة.)
{
  const start = raw.indexOf('"strings": {');
  let depth = 0, end = -1;
  for (let i = raw.indexOf("{", start); i < raw.length; i++) {
    if (raw[i] === "{") depth++;
    else if (raw[i] === "}" && --depth === 0) { end = i; break; }
    else if (raw[i] === '"') { // تخطَّ النصوص كي لا تخدعنا أقواس داخلها
      for (i++; i < raw.length; i++) { if (raw[i] === "\\") i++; else if (raw[i] === '"') break; }
    }
  }
  const sec = raw.slice(start, end);
  const seen = new Map();
  // مرساة السطر ضرورية مع الشريحة: بدونها تلتقط القيمُ المنتهية بعلامة اقتباس متبوعةً
  // بمفتاح — والمفاتيح في strings على إزاحة 4 حصرًا (build.mjs يكتبها كذلك)
  const keyRe = /^\s{4}"((?:[^"\\]|\\.)*)"\s*:/gm;
  let m, dup = 0;
  while ((m = keyRe.exec(sec))) {
    const k = m[1];
    if (seen.has(k)) { dup++; if (dup <= 5) fail(`مفتاح مكرر في strings (الأخير يدهس الأول صامتًا): "${k.slice(0, 60)}"`); }
    seen.set(k, 1);
  }
  if (dup > 5) fail(`… و${dup - 5} مفتاحًا مكررًا آخر`);
  if (!dup) console.log(`✓ لا مفاتيح مكررة في strings (${seen.size.toLocaleString("en")} فُحص خامًا داخل حدود القسم)`);
}

const dict = JSON.parse(raw);
const strings = dict.strings || {};
const patterns = dict.patterns || [];

// ٢) أزواج فارغة أو غير نصية
{
  let bad = 0;
  for (const [k, v] of Object.entries(strings)) {
    if (typeof v !== "string" || !v.trim() || !k.trim()) { bad++; if (bad <= 3) fail(`زوج فاسد: ${JSON.stringify(k).slice(0, 60)} ← ${JSON.stringify(v).slice(0, 40)}`); }
  }
  if (!bad) console.log(`✓ الأزواج كلها نصية غير فارغة (${Object.keys(strings).length.toLocaleString("en")})`);
}

// ٣) القواعد: تعبير صالح + مراجع $n مقابلة + حقول كاملة
{
  let bad = 0;
  patterns.forEach((p, i) => {
    if (!p || typeof p.re !== "string" || typeof p.ar !== "string" || typeof p.en !== "string") { bad++; return fail(`قاعدة ${i} ناقصة الحقول`); }
    let re;
    try { re = new RegExp(p.re); } catch (e) { bad++; return fail(`قاعدة ${i} تعبيرها فاسد: ${p.re.slice(0, 50)}`); }
    const groups = (p.re.match(/\((?!\?)/g) || []).length;
    for (const mm of p.ar.matchAll(/\$(\d)/g)) {
      const n = +mm[1];
      if (n === 0 || n > groups) { bad++; fail(`قاعدة «${p.en.slice(0, 40)}»: $${n} بلا مجموعة مقابلة (${groups})`); }
    }
  });
  if (!bad) console.log(`✓ القواعد سليمة التعبير والمراجع (${patterns.length.toLocaleString("en")})`);
}

// ٤) ترتيب التخصيص — بالدالة المشتركة نفسها
{
  const sorted = sortBySpecificity(patterns);
  let broken = -1;
  for (let i = 0; i < patterns.length; i++) if (patterns[i] !== sorted[i]) { broken = i; break; }
  if (broken >= 0) fail(`ترتيب التخصيص مكسور عند القاعدة ${broken}: «${patterns[broken].en.slice(0, 40)}» (ثابتها ${patternLiteralLen(patterns[broken])}) — أعد التوليد أو الفرز`);
  else console.log("✓ القواعد مرتبة بالتخصيص (الأخصّ أولًا)");
}

// ٧) مفاتيح ميّتة: المفتاح هو ما يبحث به المحرّك بعينه (textKey) أو لا يُطابَق أبدًا
{
  // المفتاح يُطلب مهما طال (engine.js KEY_MAX = Infinity، توجيه المالك ٢١ ربيع الآخر ١٤٤٨هـ) — فالميّت هنا ما حفّه البياض وحده
  const KEY_MAX = Infinity;
  let dead = 0;
  for (const k of Object.keys(strings)) {
    if (globalThis.CMLShared.textKey(k, KEY_MAX) !== k) {
      dead++;
      if (dead <= 5) fail(`مفتاحٌ لا يطابقه المحرّك (بياضٌ في طرفيه): ${JSON.stringify(k).slice(0, 70)}`);
    }
  }
  if (dead > 5) fail(`… و${dead - 5} مفتاحًا ميّتًا آخر`);
  if (!dead) console.log("✓ كل مفتاحٍ يطابقه المحرّك كما هو (لا بياض في الأطراف؛ ولا سقف طول)");
}

// ٦) تحذيرات المصطلح (لا تُفشل)
{
  let t = 0;
  for (const [k, v] of Object.entries(strings)) {
    if (/\bchats?\b/i.test(k) && !/محادث|Chat/.test(v)) { t++; if (t <= 3) warn(`chat بلا «محادثة»: ${JSON.stringify(k).slice(0, 50)}`); }
  }
  if (t > 3) warn(`… و${t - 3} تحذير مصطلح آخر`);
}

}

// ٥) حارس عقد الحصاد: النسخة القسرية مطابقة نصيًا للمشتركة
{
  const norm = (s) => s.replace(/\/\/[^\n]*/g, "").replace(/\s+/g, " ").trim();
  const extractFn = (src, name) => {
    const i = src.indexOf("function " + name);
    if (i < 0) return null;
    let depth = 0, j = src.indexOf("{", i);
    for (let k = j; k < src.length; k++) {
      if (src[k] === "{") depth++;
      else if (src[k] === "}" && --depth === 0) return src.slice(j, k + 1);
    }
    return null;
  };
  const harvPath = CODE ? path.join(CODE, "tools", "harvest-all-strings.js") : null;
  if (!harvPath || !fs.existsSync(harvPath)) {
    console.log("✓ (حارس الحصاد يُفحص في مجلد التطوير وحده — سكربته الخاص لا يُنشر)");
  } else {
  const sharedSrc = fs.readFileSync(path.join(__P.EXT, "cml-shared.js"), "utf8");
  const harvSrc = fs.readFileSync(harvPath, "utf8");
  const a = extractFn(sharedSrc, "unescapeLiteral");
  // في الحصاد الدالة سهمية داخل IIFE — نلتقط جسدها بين علامتين معروفتين
  const hm = harvSrc.match(/let s = \(\(\) => \{([\s\S]*?)\}\)\(\);/);
  if (!a) fail("لم أجد unescapeLiteral في cml-shared.js");
  else if (!hm) warn("لم أجد النسخة القسرية في harvest-all-strings.js — تأكد يدويًا من التطابق");
  else {
    // مقارنة جوهرية: الخطوات الثلاث (فك \' ، تحويل \xNN، الإهراب الذري) + JSON.parse
    const steps = ["replace(/\\\\'/g", "\\\\x([0-9a-fA-F]{2})", "\\\\[\\s\\S]|\"", "JSON.parse"];
    const missing = steps.filter((s) => !norm(hm[1]).includes(norm(s)) && !hm[1].includes(s));
    if (missing.length) fail(`نسخة الحصاد القسرية انحرفت عن المشتركة — خطوات مفقودة: ${missing.length}`);
    else console.log("✓ نسخة الحصاد القسرية من unescapeLiteral مطابقة جوهريًا للمشتركة");
  }
  }
}

console.log(fails ? `\n✗ ${fails} فشلًا و${warns} تحذيرًا` : `\n✓ القاموس سليم (${warns} تحذيرًا)`);
process.exit(fails ? 1 : 0);
