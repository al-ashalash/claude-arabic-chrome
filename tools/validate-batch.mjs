// validate-batch.mjs — تحقّقٌ آليٌّ من دفعة ترجمة قبل دمجها: كل سطرٍ في المدخل له زوجٌ واحد
// بنصٍّ إنجليزي حرفي، والمتغيّرات والوسوم في العربية هي نفسها في الإنجليزية، ولا ترجمة فارغة.
//   node validate-batch.mjs <chunk.txt> <out.json>     → يطبع الملخّص ويخرج 1 عند أي خلل
//   node validate-batch.mjs --mode=block <todo.json> <out.json>   → دفعة كتل المتون (validate-blocks.mjs)
//   node validate-batch.mjs --icu-ar <chunk.txt> <out.json>   → ★ (ت10-0، ١٣ جمادى الأولى ١٤٤٨هـ) رسائل ICU بالعربية: كل جمعٍ في العربية بأقسامها الست
//     (zero وone وtwo وfew وmany وother، و=N المذكورة في الإنجليزية)، وكل اختيارٍ بفروع الإنجليزية نفسها، والمتغيّرات والوسوم هي هي — بمحلِّل ICU
//     في partial-english.mjs؛ وبلا الخيار يبقى فحص الفروع بالتساوي كما كان
//     ★ (ر29-س، ٢٠ جمادى الأولى ١٤٤٨هـ) والوسوم فيه بالعرض لا بالنصّ الخام: وسمٌ داخل فرعٍ يتكرّر في أقسام العربية الست، فتُقارَن وسوم كل عرضٍ
//     إنجليزيٍّ بوسوم عرضه العربي عند القيم نفسها (icuTagErrors أدناه)
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.argv.includes("--mode=block")) {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL("./validate-blocks.mjs", import.meta.url)),
    ...process.argv.slice(2).filter((a) => a !== "--mode=block")], { stdio: "inherit" });
  process.exit(r.status === null ? 1 : r.status);
}
const ICU_AR = process.argv.includes("--icu-ar");
const [chunkPath, outPath] = process.argv.slice(2).filter((a) => a !== "--icu-ar");
const icuMod = ICU_AR ? await import(new URL("./partial-english.mjs", import.meta.url).href) : null;
const AR6 = ["zero", "one", "two", "few", "many", "other"];
// شجرة ICU ← {plural: {اسم: [مفاتيح]}, select: {اسم: [مفاتيح]}, args: [أسماء]} — لكل اسمٍ أول ظهوره (والمتداخل يُجمع بالاسم)
function icuShape(src) {
  const sh = { plural: {}, select: {}, args: new Set() };
  (function walk(ns) {
    for (const n of ns) {
      if (n.t === "arg") sh.args.add(n.name);
      else if (n.t === "plural" || n.t === "select") {
        const b = n.t === "plural" ? sh.plural : sh.select;
        b[n.name] = [...new Set([...(b[n.name] || []), ...Object.keys(n.opts)])];
        sh.args.add(n.name);
        for (const k in n.opts) walk(n.opts[k]);
      } else if (n.t === "tag") walk(n.kids);
    }
  })(icuMod.parseICU(src));
  return sh;
}
function icuArErrors(en, ar) {
  let E, A;
  try { E = icuShape(en); } catch (e) { return ["ICU الإنجليزية لا تُحلَّل"]; }
  try { A = icuShape(ar); } catch (e) { return ["ICU العربية لا تُحلَّل: " + e.message]; }
  const out = [];
  if ([...E.args].sort().join("|") !== [...A.args].sort().join("|")) out.push("متغيّرات ICU مختلّة");
  for (const [nm, ks] of Object.entries(E.plural)) {
    const ak = A.plural[nm];
    if (!ak) { out.push(`الجمع {${nm}} غائب`); continue; }
    const need = [...new Set([...AR6, ...ks.filter((k) => /^=\d+$/.test(k))])];
    const miss = need.filter((k) => !ak.includes(k)), bad = ak.filter((k) => !need.includes(k));
    if (miss.length) out.push(`الجمع {${nm}} بلا: ${miss.join(" ")}`);
    if (bad.length) out.push(`الجمع {${nm}} بفرعٍ غريب: ${bad.join(" ")}`);
  }
  for (const nm of Object.keys(A.plural)) if (!E.plural[nm]) out.push(`جمعٌ زائد {${nm}}`);
  for (const [nm, ks] of Object.entries(E.select)) {
    const ak = A.select[nm] || [];
    if (ks.slice().sort().join("|") !== ak.slice().sort().join("|")) out.push(`فروع الاختيار {${nm}} مختلّة`);
  }
  for (const nm of Object.keys(A.select)) if (!E.select[nm]) out.push(`اختيارٌ زائد {${nm}}`);
  return out;
}
// ★ (ر29-س) وسوم رسالة ICU في عروضها. توقيع TAGS على النصّ الخام يعدّ وسمَ الفرع مرةً لكل فرع: في الإنجليزية مرتين (one وother)، وفي العربية
// الصحيحة ستًّا (zero…other، الموجز §4) فيُرفض ما هو سليم. فكما تعرض الصفحة: الإنجليزية بقواعد جمع en-US، والعربية بقواعد ar، عند القيم نفسها —
// NUMS من partial-english.mjs (0 و1 و2 و3 و11 و100: الأقسام الست كلها في العربية) وكل مفتاح =N في أيٍّ من الجانبين (لكل جمعٍ كل قيمة)، ولكل اختيارٍ
// كلُّ فرعٍ من فروع الجانبين والبقية other — ثم وسوم كل عرضٍ إنجليزي هي وسوم عرضه العربي **بترتيبها**: كل مقطعٍ يفصله وسمٌ عقدةُ نصٍّ مستقلة
// في الصفحة يُترجم وحده (المحرّك عقدةً عقدة، وsplit المقاطع في partial-english)، والإضافة لا تنقل عنصرًا؛ فالمقطع العربي الأول للعنصر الأول
// وهكذا، والموجز §4 يطلب الوسوم بأسمائها وتداخلها وكل مقطعٍ «في ترتيبه» — والمجموعة وحدها تقبل وسمين متبادلَين أو تداخلًا مقلوبًا فيقع النص في
// غير عنصره. والوسم يُعدّ بـTAGS نفسه (بحروفه بلا بياض: ‎<b/>‎ غير ‎<b></b>‎، والوسم الناقص والشارد يُعدّان كما في الخام)، فيُستبدل قبل التحليل
// بعلامةٍ تبدأ بـ«<» لا يليها اسم وسم (يقرؤها محلِّل partial-english نصًّا، و‎'<‎ تبدأ الاقتباس فيها كما في الوسم) فلا تتغيّر بنية الجمع والاختيار.
// ويُرجع null — فيبقى فحص اليوم على الخام — حين لا وسم داخل فرع جمعٍ أو اختيار في الجانبين (وسومٌ خارج كل جمعٍ واختيار)، أو لا يُحلَّل أحدهما
// (وicuArErrors تذكر ذلك)، أو فيه حرفا العلامة.
// (مراجعة ر29-س) والاختيارات بكل تراكيب فروعها لا فرعًا فرعًا والبقية other: الاختيار داخل فرعٍ من اختيارٍ آخر (s02 وs04) لا يُعرض فرعُه إلا وأبوه
// على فرعه، فكان الوسم الساقط فيه يمرّ (وكان العدّ الخام يرفضه)؛ وفوق TAG_CAP فرعًا فرعًا كما كان. والجمع بـoffset:k يُعرض كذلك عند NUMS+k،
// وإلا لم يبلغ القسمُ (القيمة − k) other العربية أبدًا (‎0…100 − 1 أعلاها 99، many‎).
const MARK_A = String.fromCharCode(0xe000), MARK_B = String.fromCharCode(0xe001);
const MARK_RE = new RegExp("<" + MARK_A + "(\\d+)" + MARK_B, "g");
const TAG_CAP = 4096; // عروض الجموع المتعددة (كل قيمةٍ لكل جمع): فوقها القيمة نفسها لكل الجموع، كما يعرض renders في partial-english
const PR_RULES = {
  en: { card: new Intl.PluralRules("en-US"), ord: new Intl.PluralRules("en-US", { type: "ordinal" }) },
  ar: { card: new Intl.PluralRules("ar"), ord: new Intl.PluralRules("ar", { type: "ordinal" }) },
};
const ownOpt = (o, k) => (k !== undefined && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
function icuTagModel(src) {
  if (src.includes(MARK_A) || src.includes(MARK_B)) return null;
  const toks = [];
  const marked = src.replace(TAGS, (m) => { toks.push(m.replace(/\s+/g, "")); return "<" + MARK_A + (toks.length - 1) + MARK_B; });
  let ast;
  try { ast = icuMod.parseICU(marked); } catch { return null; }
  const m = { ast, toks, inside: 0, plural: new Set(), select: new Map(), eq: new Set(), off: new Set() };
  (function walk(ns, depth) {
    for (const n of ns) {
      if (n.t === "text") { if (depth) m.inside += (n.v.match(MARK_RE) || []).length; }
      else if (n.t === "tag") walk(n.kids, depth); // وسمٌ لا يطابقه TAGS (‎<0>‎): لا يُعدّ كما في الخام، ويُمشى ما فيه
      else if (n.t === "plural") {
        m.plural.add(n.name); if (n.offset) m.off.add(n.offset);
        for (const k in n.opts) { const q = /^=(\d+)$/.exec(k); if (q) m.eq.add(+q[1]); walk(n.opts[k], depth + 1); }
      } else if (n.t === "select") {
        const ks = m.select.get(n.name) || new Set();
        m.select.set(n.name, ks); // قبل فروعه: فالخطأ يسمّي الاختيار الأب قبل ما فيه
        for (const k in n.opts) { ks.add(k); walk(n.opts[k], depth + 1); }
      }
    }
  })(ast, 0);
  return m;
}
// وسوم عرضٍ واحد بترتيبها: v.num لقيم الجموع، وv.sel لفرع الاختيار (الغائب other)؛ وقسم الجمع كما تختاره المكتبة: =N بالقيمة نفسها ثم القسم ثم other
function icuTagSeq(m, v, rules) {
  const seq = [], cats = {};
  (function walk(ns) {
    for (const n of ns) {
      if (n.t === "text") { for (const x of n.v.matchAll(MARK_RE)) seq.push(m.toks[+x[1]]); }
      else if (n.t === "tag") walk(n.kids);
      else if (n.t === "select") {
        const key = ownOpt(v.sel, n.name) !== undefined ? v.sel[n.name] : "other";
        walk(ownOpt(n.opts, key) || ownOpt(n.opts, "other") || Object.values(n.opts)[0] || []);
      } else if (n.t === "plural") {
        const num = ownOpt(v.num, n.name) !== undefined ? v.num[n.name] : 3, k = num - (n.offset || 0);
        const cat = (n.ord ? rules.ord : rules.card).select(k), exact = ownOpt(n.opts, "=" + num);
        if (!(n.name in cats)) cats[n.name] = exact ? "=" + num : ownOpt(n.opts, cat) ? cat : "other";
        walk(exact || ownOpt(n.opts, cat) || ownOpt(n.opts, "other") || []);
      }
    }
  })(m.ast);
  return { seq, cats };
}
function icuTagErrors(en, ar) {
  const E = icuTagModel(en), A = icuTagModel(ar);
  if (!E || !A || (!E.inside && !A.inside)) return null;
  const shifted = [...new Set([...E.off, ...A.off])].flatMap((k) => icuMod.NUMS.map((x) => x + k));
  const nums = [...new Set([...icuMod.NUMS, ...shifted, ...E.eq, ...A.eq])].sort((x, y) => x - y);
  const pls = [...new Set([...E.plural, ...A.plural])];
  let numVs = [{}];
  if (pls.length && nums.length ** pls.length <= TAG_CAP) {
    for (const nm of pls) numVs = numVs.flatMap((c) => nums.map((n) => ({ ...c, [nm]: n })));
  } else if (pls.length) numVs = nums.map((n) => Object.fromEntries(pls.map((nm) => [nm, n])));
  const sels = new Map(E.select);
  for (const [nm, ks] of A.select) sels.set(nm, new Set([...(sels.get(nm) || []), ...ks]));
  const selL = [...sels].map(([nm, ks]) => [nm, [...ks]]);
  let selVs = [{}];
  if (selL.length && selL.reduce((p, [, ks]) => p * ks.length, 1) <= TAG_CAP) {
    for (const [nm, ks] of selL) selVs = selVs.flatMap((c) => ks.map((k) => ({ ...c, [nm]: k })));
  } else if (selL.length) selVs = selL.flatMap(([nm, ks]) => ks.map((k) => ({ [nm]: k })));
  const bad = [];
  let all = 0;
  for (const num of numVs) for (const sel of selVs) {
    all++;
    const e = icuTagSeq(E, { num, sel }, PR_RULES.en), a = icuTagSeq(A, { num, sel }, PR_RULES.ar);
    if (e.seq.join("") !== a.seq.join("")) bad.push({ num, sel, e, a });
  }
  if (!bad.length) return [];
  const at = (b) => [...Object.entries(b.num).map(([k, x]) => `${k}=${x}`), ...Object.entries(b.sel).map(([k, x]) => `${k}=${x}`)].join("، ");
  const show = (s) => (s.seq.length ? "«" + s.seq.join("") + "»" : "بلا وسم");
  const cat = (s) => (Object.keys(s.cats).length ? " [" + Object.entries(s.cats).map(([k, c]) => `${k}:${c}`).join(" ") + "]" : "");
  const b0 = bad[0];
  return [`وسوم مختلّة في العروض (المختلّ ${bad.length} من ${all}: عند ${bad.slice(0, 8).map(at).join("؛ ")}${bad.length > 8 ? "؛ …" : ""}) — أولها: ` +
    `الإنجليزية ${show(b0.e)}${cat(b0.e)} والعربية ${show(b0.a)}${cat(b0.a)}`];
}
if (!chunkPath || !outPath) { console.error("الاستعمال: node validate-batch.mjs <chunk.txt> <out.json>"); process.exit(2); }
const lines = fs.readFileSync(chunkPath, "utf8").split("\n").filter(Boolean);
let arr;
try { arr = JSON.parse(fs.readFileSync(outPath, "utf8")); } catch (e) { console.error("✗ JSON غير صالح:", e.message); process.exit(1); }
if (!Array.isArray(arr)) { console.error("✗ ليس مصفوفة"); process.exit(1); }

// ما يُحفظ حرفيًّا: {var}، ${var}، مفاتيح فروع ICU (one/other/…) — تُقارَن كمجموعات مرتَّبة
const VARS = /\$?\{[A-Za-z_$][\w$]*(?:,\s*(?:plural|select|selectordinal|number|date|time)[^{}]*)?/g;
const TAGS = /<\/?[a-zA-Z][\w-]*\s*\/?>/g;
const ICU_KEYS = /\b(one|other|zero|two|few|many|=\d+)\s*\{/g;
function sig(s, re) { return (s.match(re) || []).map((x) => x.replace(/\s+/g, "")).sort().join("|"); }

const errors = [];
const seen = new Map();
for (const [i, p] of arr.entries()) {
  if (!p || typeof p.en !== "string" || typeof p.ar !== "string") { errors.push(`#${i}: عنصر ناقص`); continue; }
  if (seen.has(p.en)) errors.push(`#${i}: مكرّر: ${p.en.slice(0, 60)}`);
  seen.set(p.en, p.ar);
  if (!p.ar.trim()) errors.push(`#${i}: ترجمة فارغة: ${p.en.slice(0, 60)}`);
  const icuAr = ICU_AR && /\{[^{}]*,\s*(plural|select|selectordinal)\s*,/.test(p.en);
  // (‎--icu-ar‎) رسالة ICU: متغيّراتها وفروعها بمحلِّلها أدناه (توقيع VARS يقرأ أول فرعٍ بعد «plural,» فيختلف بأقسام العربية حتمًا)
  if (!icuAr && sig(p.en, VARS) !== sig(p.ar, VARS)) errors.push(`#${i}: متغيّرات مختلّة: ${p.en.slice(0, 60)}`);
  // (ر29-س) رسالة ICU في وسومها وسمٌ داخل فرع: وسوم كل عرضٍ بعرضه (icuTagErrors)؛ وما سواها (وبلا ‎--icu-ar‎) فحص اليوم على الخام
  const tagErrs = icuAr ? icuTagErrors(p.en, p.ar) : null;
  if (tagErrs) for (const e of tagErrs) errors.push(`#${i}: ${e}: ${p.en.slice(0, 60)}`);
  else if (sig(p.en, TAGS) !== sig(p.ar, TAGS)) errors.push(`#${i}: وسوم مختلّة: ${p.en.slice(0, 60)}`);
  if (icuAr) {
    for (const e of icuArErrors(p.en, p.ar)) errors.push(`#${i}: ${e}: ${p.en.slice(0, 60)}`);
  } else {
    if (sig(p.en, ICU_KEYS) !== sig(p.ar, ICU_KEYS)) errors.push(`#${i}: فروع ICU مختلّة: ${p.en.slice(0, 60)}`);
    if ((p.en.match(/#/g) || []).length !== (p.ar.match(/#/g) || []).length && /plural/.test(p.en)) errors.push(`#${i}: عدد # مختلف: ${p.en.slice(0, 60)}`);
  }
  if (/[\u0590-\u05FF]/.test(p.ar)) errors.push(`#${i}: حروف غير مسموحة`);
}
const missing = lines.filter((l) => !seen.has(l));
const extra = [...seen.keys()].filter((k) => !lines.includes(k));
const kept = arr.filter((p) => p && p.en === p.ar).length;
const translated = arr.length - kept;
for (const m of missing.slice(0, 15)) errors.push(`مفقود: ${m.slice(0, 70)}`);
for (const x of extra.slice(0, 15)) errors.push(`زائد (ليس في المدخل حرفيًّا): ${x.slice(0, 70)}`);

console.log(`المدخل ${lines.length} | المخرَج ${arr.length} | مترجَم ${translated} | مُبقًى ${kept} | مفقود ${missing.length} | زائد ${extra.length} | أخطاء ${errors.length}`);
for (const e of errors.slice(0, 40)) console.log("  ✗", e);
if (errors.length > 40) console.log("  … و" + (errors.length - 40) + " أخرى");
process.exit(errors.length ? 1 : 0);
