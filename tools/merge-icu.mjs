// merge-icu.mjs — ★ (ت10-هـ1، ٢٠ جمادى الأولى ١٤٤٨هـ) أداة دمج رسائل ICU المراجَعة (الجمع والاختيار والوسوم) في أصناف مدخلات المحرّك
// القائمة، بلا تغييرٍ في المحرّك: المحرّك لا يعرف ICU، بل يبحث عن نصّ الصفحة بالترتيب: الحرفيّ ← الجموع («… %d …» بصيغها الست) ← الأنماط.
//
// لكل رسالة: تُعدَّد «الأحوال» (كل فرعٍ لكل اختيار — والمتداخل بكل تراكيبه — وكل «خانةٍ» لكل جمع: قيمةٌ مفردة 0 و1 و2 وكل ‎=N‎،
// وقسمٌ عربيٌّ متعدّد القيم few وmany وother تُستثنى منه تلك القيم)، ويُعرض النصّان الإنجليزي والعربي رمزيًّا في كل حال، ويُقطَّعان
// بالوسوم مقاطعَ (كل مقطعٍ عقدةُ نصٍّ مستقلة في الصفحة، BRIEF §4) يُقابَل كلٌّ منها بنظيره بترتيب أحداث الوسوم نفسها — فلا وسمَ في مدخل.
// ثم كل مقطع:
//   ١) بلا متغيّر ⇒ حرفيّ؛
//   ٢) جمعٌ واحدٌ حوله نصٌّ ثابت (مقطعٌ عددُه وحده متغيّرُه، في كل خاناته) ⇒ مدخل جمعٍ بشكل المحرّك (plurals: المفتاح «one» والحقل plural
//      «other» والصيغ الست بـ%d)، وحرفيٌّ لكل فرعٍ لا يُظهر العدد («Remove the other one») أو ‎=N‎ بنصٍّ آخر؛
//   ٣) متغيّراتٌ بلا عدد ⇒ زوجٌ لـgen-patterns.mjs (‎--in=‎ وحرّاس makePattern، و"t" لـ%T)؛
//   ٤) عددٌ متعدّد القيم مع غيره ⇒ نمطٌ لكل قسمٍ عربي يُبنى هنا بصيغة أنماط المحرّك، والعدد يلتقطه **أرقامُ ذلك القسم وحدها**
//      (CAT_RE)، فيأخذ كل عددٍ في الصفحة صيغته العربية الصحيحة؛ وحرّاس makePattern تُحكَّم على القالب نفسه والعدد فيه ثابتٌ مؤقت
//      (لماذا تبقى صادقة: في checkCategory أدناه).
// والقيمة التي يكتبها المستخدم لا تُلتقط %T أبدًا: %T لقائمةٍ صريحة من أسماء متغيّراتٍ تحمل مفردات الموقع (T_VARS)، ويُرفض منها اسمٌ
// يشبه قيمةَ مستخدم (USER_VALUE).
// وما يتعارض يُسرد ولا يُحسم صامتًا: مفتاحٌ قائم، ونمطٌ يظلّل حرفيًّا أو جمعًا أو يُظلَّل به، وحرفيٌّ قائم يظلّل جمعًا مولَّدًا، ونهائيّان
// يُخرجان مفتاحًا واحدًا بقيمتين.
// التشغيل الجاف (الافتراضي، ولا كتابة غيره): كل مدخلٍ مولَّد في مجلد عملٍ متجاهَل، وgen-patterns يُشغَّل على نسخةٍ مؤقتة من الأدوات
// والقاموس، ثم «الذهاب والإياب»: ar.json والمولَّد معًا في نسخة المحرّك (partial-english makeLookup) ويُطلب كل عرضٍ لكل رسالةٍ محوَّلة
// (القيم 0 1 2 3 10 11 99 100 101 102 103 111 1000 وكل ‎=N‎، وكل فرعٍ وتركيب، وكل مقطع) فيجب أن يُرجع عرض النهائي العربي نفسه.
//   node web/code/toolchain/merge-icu.mjs [--t10=<مجلد parts/ وfinal/>] [--parts=n01,s01,…] [--dict=<ar.json>] [--out=<مجلد>]
//        [--t-vars=a,b] [--no-gen-patterns]
// الخروج 0 = لا مخالفةَ غير مفسَّرة في الذهاب والإياب؛ والتفصيل في <out>/report.json (مجلدٌ متجاهَل: فيه نصوص الموقع)، والسجلّ أعداد.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { GLOSSARY, DICTS, EXT, LANGUAGES_JSON } from "./paths.mjs";
import { parseICU, makeLookup } from "./partial-english.mjs";

const { SHARED } = await import(new URL("./domain-arg.mjs", import.meta.url).href);
const HERE = path.dirname(fileURLToPath(import.meta.url));

export const AR_CATS = ["zero", "one", "two", "few", "many", "other"];
const PR_AR = new Intl.PluralRules("ar"), PR_EN = new Intl.PluralRules("en-US");
export const arCat = (n) => PR_AR.select(n);
// ★ أرقام كل قسمٍ عربي (عددٌ صحيح بلا أصفارٍ بادئة، كما يعرضه ICU): zero 0؛ one 1؛ two 2؛ few باقي القسمة على 100 من 3 إلى 10؛
// many منه من 11 إلى 99؛ other الباقي (100 و101 و102 و200 و1000…). والمجموعة تطابق العدد كله لا بعضه: ما قبلها وما بعدها ثابتٌ ليس رقمًا
export const CAT_RE = {
  zero: "0",
  one: "1",
  two: "2",
  few: "(?:[3-9]|(?:[1-9]\\d*)?10|[1-9]\\d*0[3-9])",
  many: "(?:[1-9]\\d*)?(?:1[1-9]|[2-9]\\d)",
  other: "[1-9]\\d*0[0-2]",
};
export const ROUND_NUMS = [0, 1, 2, 3, 10, 11, 99, 100, 101, 102, 103, 111, 1000];
// متغيّرٌ داخل فرع جمعٍ يحمل عددَه منسَّقًا ({n} و{nDays} و{formatted}…) — الشكل (a) في T10D3 §٤: يُعامَل عددَ ذلك الجمع
const PROXY_RE = /^(?:n|n[A-Z0-9]\w*|formatted\w*|\w+Formatted)$/;
const CODE_TAG = /^(code|kbd|pre|mono|monospace|cmd|command|path|file|filename|snippet|samp|tt)$/i;
// %T لمفردات الموقع وحدها (T10D3 §٤ وT10D5 §٤): قائمةٌ صريحة؛ وما يشبه قيمةً يكتبها المستخدم لا يكون %T ولو طُلب
export const T_VARS_DEFAULT = ["periodList", "noun", "nouns", "field"];
export const USER_VALUE = /(?:name|path|e?mail|title|file|folder|dir|host|url|uri|query|search|text|prompt|message|content|comment|user|owner|repo|branch|project|org)s?$/i;
const SENT = "\u0007"; // ثابتٌ مؤقتٌ مكان العدد حين تُحكَّم حرّاس makePattern على القالب
const SAMPLE = "Zeddicus", T_SAMPLE_EN = "Zq Sample Label", T_SAMPLE_AR = "تسميةٌ تجريبية";
const NUMERIC_NAME = /^(count|n|num|number|total|amount|value|max|min|done|used|remaining|limit|size|index|position|step|steps|seats|credits|cost|price|percent|pct|days|hours|minutes|seconds)$|(?:Count|Number|Total|Max|Min|Value)$/;
const STEP = 4096; // سقف الأحوال للرسالة الواحدة

// ---------------- العرض الرمزي ----------------
function collectVars(ast) {
  const pv = new Map(), sv = new Map(), args = new Set(), meta = { offset: false, ord: false, tags: false };
  (function walk(ns) {
    for (const n of ns) {
      if (n.t === "plural") {
        if (n.offset) meta.offset = true;
        if (n.ord) meta.ord = true;
        const s = pv.get(n.name) || new Set();
        for (const k in n.opts) { if (k[0] === "=") s.add(+k.slice(1)); walk(n.opts[k]); }
        pv.set(n.name, s);
      } else if (n.t === "select") {
        const s = sv.get(n.name) || new Set();
        for (const k in n.opts) { s.add(k); walk(n.opts[k]); }
        sv.set(n.name, s);
      } else if (n.t === "tag") { meta.tags = true; walk(n.kids); }
      else if (n.t === "arg") args.add(n.name);
    }
  })(ast);
  return { pv, sv, args, meta };
}
// المتغيّرات التي تحمل عدد جمعٍ منسَّقًا: داخل فروع جمعٍ واحدٍ لا غير، في الجانبين
function proxies(asts, pvars, svars) {
  const where = new Map();
  for (const ast of asts) (function walk(ns, V) {
    for (const n of ns) {
      if (n.t === "arg" && !pvars.has(n.name) && !svars.has(n.name)) {
        const w = where.get(n.name) || new Set(); w.add(V || "∅"); where.set(n.name, w);
      } else if (n.t === "plural") { for (const k in n.opts) walk(n.opts[k], n.name); }
      else if (n.t === "select") { for (const k in n.opts) walk(n.opts[k], V); }
      else if (n.t === "tag") walk(n.kids, V);
    }
  })(ast, null);
  const out = new Map();
  for (const [x, w] of where) if (PROXY_RE.test(x) && w.size === 1 && !w.has("∅")) out.set(x, [...w][0]);
  return out;
}
function cellsOf(exact) {
  const ex = [...exact].sort((a, b) => a - b);
  const cells = ex.map((n) => ({ exact: true, n }));
  for (const cat of ["few", "many", "other"]) {
    let rep = null;
    for (let n = 3; n < 100000 && rep === null; n++) if (arCat(n) === cat && !exact.has(n)) rep = n;
    cells.push({ exact: false, cat, rep, excl: ex.filter((n) => arCat(n) === cat) });
  }
  return cells;
}
function pickBranch(node, cell, side) {
  const o = node.opts;
  if (cell.exact) return o["=" + cell.n] || o[(side === "en" ? PR_EN : PR_AR).select(cell.n)] || o.other || [];
  return (side === "en" ? o[PR_EN.select(cell.rep)] : o[cell.cat]) || o.other || [];
}
// ⇒ {slots: [{toks, code}], sig: [أحداث الوسوم]} — الرمز: {k:"lit",v} أو {k:"arg",name} أو {k:"num",v:اسم الجمع}
function renderSym(ast, S, ctx, side) {
  const slots = [{ toks: [], code: false }], sig = [], open = [];
  const put = (t) => { const s = slots[slots.length - 1]; s.toks.push(t); if (open.some((x) => CODE_TAG.test(x))) s.code = true; };
  const brk = (ev) => { sig.push(ev); slots.push({ toks: [], code: false }); };
  (function walk(ns, V) {
    for (const n of ns) {
      if (n.t === "text") put({ k: "lit", v: n.v });
      else if (n.t === "pound") put(V ? { k: "num", v: V } : { k: "lit", v: "#" });
      else if (n.t === "arg") {
        if (ctx.pvars.has(n.name)) put({ k: "num", v: n.name });
        else if (ctx.proxy.has(n.name)) put({ k: "num", v: ctx.proxy.get(n.name) });
        else if (ctx.svars.has(n.name) && S.sel[n.name] !== undefined && S.sel[n.name] !== "other") put({ k: "lit", v: S.sel[n.name] });
        else put({ k: "arg", name: n.name });
      } else if (n.t === "tag") { brk("<" + n.name); open.push(n.name); walk(n.kids, V); open.pop(); brk("/" + n.name); }
      else if (n.t === "select") walk(n.opts[S.sel[n.name]] || n.opts.other || [], V);
      else if (n.t === "plural") walk(pickBranch(n, S.cell[n.name], side), n.name);
    }
  })(ast, null);
  return { slots, sig };
}
// تطبيع رموز المقطع: العدد ذو الخانة المفردة يصير رقمه — إلا إن لاصق متغيّرًا حرًّا، فيبقى عددًا يُلتقط بحدّه (وإلا ابتلع الحرُّ أرقامًا
// قبله: «{sign}0 …» طابق «Zeddicus100 …»)، وتُدمج الثوابت المتجاورة، ويُقصّ الطرفان (textKey: القصّ وحده)
function mergeLits(toks) {
  const out = [];
  for (const t of toks) {
    if (t.k === "lit" && !t.v) continue;
    if (t.k === "lit" && out.length && out[out.length - 1].k === "lit") out[out.length - 1] = { k: "lit", v: out[out.length - 1].v + t.v };
    else out.push(t.k === "lit" ? { k: "lit", v: t.v } : t);
  }
  return out;
}
function normToks(toks, S) {
  const m = mergeLits(toks);
  const out = mergeLits(m.map((t, i) => {
    if (t.k !== "num" || !S.cell[t.v] || !S.cell[t.v].exact) return t;
    const a = m[i - 1], b = m[i + 1];
    return (a && a.k === "arg") || (b && b.k === "arg") ? t : { k: "lit", v: String(S.cell[t.v].n) };
  }));
  if (out.length && out[0].k === "lit") { out[0].v = out[0].v.replace(/^\s+/, ""); if (!out[0].v) out.shift(); }
  if (out.length && out[out.length - 1].k === "lit") { const l = out[out.length - 1]; l.v = l.v.replace(/\s+$/, ""); if (!l.v) out.pop(); }
  return out;
}
const phId = (t) => (t.k === "arg" ? "a:" + t.name : t.k === "num" ? "n:" + t.v : null);
const tplStr = (toks) => toks.map((t) => (t.k === "lit" ? t.v : "{" + (t.k === "arg" ? t.name : t.v) + "}")).join("");
const keyStr = (toks, S) => toks.map((t) => (t.k === "lit" ? t.v : t.k === "arg" ? "{" + t.name + "}" : "{#" + t.v + ":" + (S.cell[t.v].exact ? "=" + S.cell[t.v].n : S.cell[t.v].cat) + "}")).join("");

// ---------------- القسم: أرقامه وحرّاسه ----------------
export function catGroup(cell) {
  if (cell.exact) return "(" + cell.n + ")";
  const ex = cell.excl && cell.excl.length ? "(?!(?:" + cell.excl.join("|") + ")(?!\\d))" : "";
  return "(" + ex + CAT_RE[cell.cat] + ")";
}
const capCache = new Map();
function boundedCap(name) {
  if (!capCache.has(name)) {
    const p = SHARED.makePatternBounded("Zq zq {" + name + "} zq", "{" + name + "}");
    capCache.set(name, p ? p.re.slice("^Zq zq ".length, p.re.length - " zq$".length) : null);
  }
  return capCache.get(name);
}
// ★ نمط القسم: لماذا تبقى حرّاس makePattern صادقة. تُحكَّم على القالب نفسه والعددُ فيه ثابتٌ مؤقت (SENT) — makePattern أولًا ثم
// makePatternBounded كما يفعل gen-patterns — فتبقى كما هي: سقف المتغيّرات الحرّة (3)، والحرّان المتلاصقان (ReDoS)، والمحفوف بحرّين بلا
// مرساة، والثابت القصير، و$رقم، والمتغيّر العربي المخترع، و%T لما في "t" وحده. والتغيير الوحيد تضييقُ التقاط العدد من (.+?) إلى أرقام
// قسمه: والتضييق لا يزيد ما يطابقه النمط أبدًا. وما يخصّ العدد يُفحص هنا: لا يلاصق متغيّرًا آخر بلا ثابتٍ بينهما ولا رقمًا في ثابته
// (فلا يُقتطع عددٌ من عدد)، وفي الثابت كلمةٌ لاتينية (فلا يترجم نمطٌ عددًا وحده)، والمجموعات ≤ 9 ($n و%Tn برقمٍ واحد).
export function checkCategory(enToks, arToks, tv) {
  const ph = enToks.filter((t) => t.k !== "lit");
  if (ph.length > 9) return { why: "groups>9" };
  for (let i = 0; i < enToks.length; i++) {
    const t = enToks[i];
    if (t.k !== "num") continue;
    const a = enToks[i - 1], b = enToks[i + 1];
    // عددٌ يلاصق عددًا يُقتطع أحدهما من الآخر؛ ومتغيّرٌ حرٌّ يلاصق العدد يُلتقط بحدٍّ لا رقمَ عنده (ADJ_BEFORE/ADJ_AFTER في buildCategory)
    if ((a && a.k === "num") || (b && b.k === "num")) return { why: "number-adjacent-number" };
    if ((a && a.k === "lit" && /\d$/.test(a.v)) || (b && b.k === "lit" && /^\d/.test(b.v))) return { why: "number-adjacent-digit" };
  }
  const lit = enToks.filter((t) => t.k === "lit").map((t) => t.v).join("");
  if (!/[A-Za-z]{2}/.test(lit)) return { why: "no-word" };
  const free = enToks.filter((t) => t.k === "arg");
  if (!free.length) return { ok: true, bounded: false };
  const enS = enToks.map((t) => (t.k === "num" ? SENT : t.k === "arg" ? "{" + t.name + "}" : t.v)).join("");
  const arS = arToks.map((t) => (t.k === "num" ? SENT : t.k === "arg" ? "{" + t.name + "}" : t.v)).join("");
  const opt = tv.length ? { t: tv.filter((x) => free.some((f) => f.name === x)) } : undefined;
  if (SHARED.makePattern(enS, arS, opt)) return { ok: true, bounded: false };
  if (SHARED.makePatternBounded(enS, arS, opt)) return { ok: true, bounded: true };
  return { why: "guard" };
}
export function buildCategory(enToks, arToks, S, tv) {
  const g = checkCategory(enToks, arToks, tv);
  if (!g.ok) return { why: g.why };
  let re = "^";
  const first = new Map();
  let k = 0;
  for (let i = 0; i < enToks.length; i++) {
    const t = enToks[i];
    if (t.k === "lit") { re += SHARED.escapeRe(t.v); continue; }
    k++;
    const id = phId(t);
    if (!first.has(id)) first.set(id, k);
    if (t.k === "num") { re += catGroup(S.cell[t.v]); continue; }
    const nb = enToks[i + 1], pb = enToks[i - 1];
    // ★ متغيّرٌ حرٌّ قبل العدد بلا ثابتٍ بينهما ({sign}{count}): ينتهي بغير رقم، فيأخذ العددُ أرقامه كلها — وإلا اقتطع الكسولُ رقمًا من
    // أوله فطابق قسمٌ آخر ذيلَه («+13» few بـ«+1» و«3»). وبعده كذلك يبدأ بغير رقم. والمحدود لا يُجمع مع هذا: يُرفض
    if ((nb && nb.k === "num") || (pb && pb.k === "num")) {
      if (g.bounded && !tv.includes(t.name)) return { why: "number-adjacent-bounded" };
      re += nb && nb.k === "num" ? "(.*?\\D)" : "(\\D.*?)";
      continue;
    }
    re += tv.includes(t.name) || !g.bounded ? "(.+?)" : (boundedCap(t.name) || "(.+?)");
  }
  re += "$";
  let ar = "";
  for (const t of arToks) {
    if (t.k === "lit") { if (/\$\d|%[MWPCT]\d/.test(t.v)) return { why: "template-symbol" }; ar += t.v; continue; }
    const n = first.get(phId(t));
    if (!n) return { why: "invented-var" };
    ar += (t.k === "arg" && tv.includes(t.name) ? "%T" : "$") + n;
  }
  try { new RegExp(re); } catch { return { why: "bad-regex" }; }
  const p = { en: tplStr(enToks), re, ar };
  if (g.bounded) p.b = 1;
  return { p };
}

// ---------------- تحويل رسالة ----------------
// ⇒ {ok, why?, cls, literals:[{en,ar}], plurals:{key:{plural?,forms}}, pairs:[{en,ar,t?}], cats:[{en,re,ar,b?}], identity, symbolOnly, codeSkipped}
export function convertMessage(enMsg, arMsg, opts = {}) {
  const tvAll = (opts.tVars || T_VARS_DEFAULT).filter((x) => !USER_VALUE.test(x));
  let enAst, arAst;
  try { enAst = parseICU(enMsg); arAst = parseICU(arMsg); } catch (e) { return { ok: false, why: "parse: " + String(e.message || e).slice(0, 40) }; }
  const E = collectVars(enAst), A = collectVars(arAst);
  if (E.meta.offset || A.meta.offset || E.meta.ord || A.meta.ord) return { ok: false, why: "offset-or-ordinal" };
  for (const v of A.pv.keys()) if (!E.pv.has(v) && !E.args.has(v)) return { ok: false, why: "ar-only-plural-var" };
  const pvars = new Map();
  for (const [v, s] of E.pv) pvars.set(v, new Set(s));
  for (const [v, s] of A.pv) { const t = pvars.get(v) || new Set(); for (const n of s) t.add(n); pvars.set(v, t); }
  const svars = new Map();
  for (const M of [E.sv, A.sv]) for (const [v, s] of M) { const t = svars.get(v) || new Set(["other"]); for (const k of s) t.add(k); svars.set(v, t); }
  for (const v of svars.keys()) if (pvars.has(v)) return { ok: false, why: "var-both-plural-and-select" };
  const ctx = { pvars: new Set(pvars.keys()), svars: new Set(svars.keys()), proxy: proxies([enAst, arAst], new Set(pvars.keys()), new Set(svars.keys())) };
  // الأحوال: حاصل ضرب فروع الاختيارات وخانات الجموع
  let sits = [{ sel: {}, cell: {} }];
  for (const [v, keys] of svars) { sits = sits.flatMap((s) => [...keys].map((k) => ({ sel: { ...s.sel, [v]: k }, cell: s.cell }))); if (sits.length > STEP) return { ok: false, why: "too-many-situations" }; }
  const cellsByVar = new Map();
  for (const [v, ex] of pvars) {
    const exact = new Set([0, 1, 2, ...ex]);
    cellsByVar.set(v, cellsOf(exact));
    sits = sits.flatMap((s) => cellsByVar.get(v).map((c) => ({ sel: s.sel, cell: { ...s.cell, [v]: c } })));
    if (sits.length > STEP) return { ok: false, why: "too-many-situations" };
  }
  const tv = tvAll.filter((x) => E.args.has(x) || A.args.has(x));
  const pairs = []; // {slot, S, en, ar}
  let symbolOnly = 0, codeSkipped = 0, identity = 0;
  for (const S of sits) {
    const RE = renderSym(enAst, S, ctx, "en"), RA = renderSym(arAst, S, ctx, "ar");
    if (RE.sig.join("|") !== RA.sig.join("|")) return { ok: false, why: "tag-order-differs" };
    for (let i = 0; i < RE.slots.length; i++) {
      const en = normToks(RE.slots[i].toks, S), ar = normToks(RA.slots[i].toks, S);
      if (RE.slots[i].code || RA.slots[i].code) { if (en.length) codeSkipped++; continue; }
      if (!en.length && !ar.length) continue;
      if (!en.length) return { ok: false, why: "ar-text-without-en-node" };
      if (!ar.length) return { ok: false, why: "empty-ar-fragment" };
      const enIds = new Set(en.map(phId).filter(Boolean));
      for (const t of ar) if (t.k !== "lit" && !enIds.has(phId(t))) return { ok: false, why: "ar-placeholder-not-in-en-fragment" };
      pairs.push({ slot: i, S, en, ar });
    }
  }
  // مقطعٌ إنجليزيٌّ واحد بعربيّتين في حالين ⇒ التباس (اختيارٌ أُضيف في العربية وحدها على قيمةٍ لا تظهر في النص)
  const seen = new Map(), uniq = [];
  for (const p of pairs) {
    const k = keyStr(p.en, p.S), a = keyStr(p.ar, p.S);
    if (seen.has(k)) {
      if (seen.get(k).a !== a) {
        const q = seen.get(k).p, bySel = Object.keys(p.S.sel).some((v) => p.S.sel[v] !== q.S.sel[v]);
        return { ok: false, why: bySel ? "ambiguous: select not shown in the English" : "ambiguous: number not shown in the English" };
      }
      continue;
    }
    seen.set(k, { a, p }); uniq.push(p);
  }
  const res = { ok: true, literals: [], plurals: {}, pairs: [], cats: [], identity: 0, symbolOnly: 0, codeSkipped, tVars: tv };
  // ٢) مدخل الجمع: لكل مقطعٍ وحالِ ما سوى جمعٍ واحد V، إن كان عدد V متغيّرَه الوحيد في كل خاناته
  const consumed = new Set();
  if (pvars.size >= 1) {
    const groups = new Map();
    for (const p of uniq) {
      for (const V of pvars.keys()) {
        const ctxKey = p.slot + "\u0001" + JSON.stringify(p.S.sel) + "\u0001" + [...pvars.keys()].filter((x) => x !== V).map((x) => x + "=" + JSON.stringify(p.S.cell[x])).join(",") + "\u0001" + V;
        (groups.get(ctxKey) || groups.set(ctxKey, []).get(ctxKey)).push(p);
      }
    }
    for (const [gk, ps] of groups) {
      const V = gk.slice(gk.lastIndexOf("\u0001") + 1);
      if (ps.some((p) => consumed.has(p))) continue;
      const pe = pluralEntry(ps, V, cellsByVar.get(V));
      if (!pe) continue;
      ps.forEach((p) => consumed.add(p));
      if (Object.prototype.hasOwnProperty.call(res.plurals, pe.key) && JSON.stringify(res.plurals[pe.key]) !== JSON.stringify(pe.spec)) return { ok: false, why: "two plural entries one key" };
      res.plurals[pe.key] = pe.spec;
      for (const l of pe.literals) res.literals.push(l);
    }
  }
  for (const p of uniq) {
    if (consumed.has(p)) continue;
    const enT = tplStr(p.en), arT = tplStr(p.ar);
    const hasNum = p.en.some((t) => t.k === "num"), hasArg = p.en.some((t) => t.k === "arg");
    if (!hasNum && !hasArg) {
      if (!/[A-Za-z]/.test(enT)) { if (enT !== arT) res.symbolOnly++; continue; } // رموزٌ وحدها: مفتاحٌ عامٌّ يمسّ كل عقدةٍ مثلها، فلا يُولَّد
      res.literals.push({ en: enT, ar: arT });
      continue;
    }
    if (enT === arT && p.en.length === p.ar.length) { res.identity++; continue; } // قيمةٌ وحدها أو قالبٌ مطابق: لا ترجمة
    // قالبٌ ثابتُه رموزٌ وحدها («{x}?»): لا كلمة تميّزه، فلا يُولَّد (يبقى كما في الصفحة) كالمقطع الرمزي
    if (!/[A-Za-z]/.test(p.en.filter((t) => t.k === "lit").map((t) => t.v).join(""))) { res.symbolOnly++; continue; }
    if (!hasNum) {
      if (p.en.some((t) => t.k === "lit" && /[{}]/.test(t.v)) || p.ar.some((t) => t.k === "lit" && /[{}]/.test(t.v))) return { ok: false, why: "brace-in-literal" };
      const t = tv.filter((x) => p.en.some((y) => y.k === "arg" && y.name === x));
      res.pairs.push(t.length ? { en: enT, ar: arT, t } : { en: enT, ar: arT });
      continue;
    }
    const b = buildCategory(p.en, p.ar, p.S, tv);
    if (!b.p) return { ok: false, why: "category: " + b.why };
    res.cats.push(b.p);
  }
  res.cls = classify(pvars, svars, E.meta.tags || A.meta.tags, res);
  return res;
}
// الصنف بشكل الناتج: الجمع مدخلُ جمعٍ أو أنماطُ أقسام (ولو كان فيه وسم أو اختيار)، ثم الوسوم، ثم الاختيار، وما سواها نصٌّ مجرّد
function classify(pvars, svars, tags, res) {
  if (pvars.size) return res.cats.length ? "category" : "plural-entry";
  return tags ? "rich" : svars.size ? "select" : "plain";
}
// مدخل الجمع لمجموعة مقاطع V (أو null): الخانات المتعدّدة بقالبٍ إنجليزيٍّ واحد عددُه متغيّرُه الوحيد، والعربية لكل قسمٍ عددُها مرةً على الأكثر
function pluralEntry(ps, V, cells) {
  const byCell = new Map();
  for (const p of ps) {
    const c = p.S.cell[V];
    const id = c.exact ? "=" + c.n : c.cat;
    if (byCell.has(id)) return null;
    byCell.set(id, p);
  }
  if (byCell.size !== cells.length) return null;
  const onlyV = (toks) => toks.every((t) => t.k === "lit" || (t.k === "num" && t.v === V));
  const nNum = (toks) => toks.filter((t) => t.k === "num").length;
  let other = null;
  for (const cat of ["few", "many", "other"]) {
    const p = byCell.get(cat);
    if (!onlyV(p.en) || nNum(p.en) !== 1 || !onlyV(p.ar) || nNum(p.ar) > 1) return null;
    const t = tplStr(p.en).replace("{" + V + "}", "%d");
    if (other === null) other = t; else if (other !== t) return null;
  }
  if (/%d[\s\S]*%d/.test(other) || !/[A-Za-z]/.test(other)) return null;
  const forms = new Array(6), literals = [];
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reOf = (t) => new RegExp("^" + esc(t).replace("%d", "(\\d+)") + "$");
  for (const cat of ["few", "many", "other"]) forms[AR_CATS.indexOf(cat)] = tplStr(byCell.get(cat).ar).replace("{" + V + "}", "%d");
  let one = null;
  // الخانات المفردة: يُرجَع عرضُها الإنجليزي (العدد مفكوكٌ إلى رقمه) إلى قالبه — فقالب other بالعدد نفسه، أو قالب one (n=1)، أو حرفيّ
  const exactRaw = (p, n) => p.en.map((t) => (t.k === "num" ? { k: "lit", v: String(n) } : t)).map((t) => t.v).join("");
  for (const c of cells.filter((x) => x.exact)) {
    const p = byCell.get("=" + c.n);
    const enText = tplStr(p.en); // الخانة المفردة: normToks جعل عددها رقمًا
    const arText = tplStr(p.ar);
    if (p.en.some((t) => t.k !== "lit") || p.ar.some((t) => t.k !== "lit")) return null;
    const cat = arCat(c.n), fi = AR_CATS.indexOf(cat);
    const arForm = arText.split(String(c.n)).length === 2 ? arText.replace(String(c.n), "%d") : arText;
    if (reOf(other).test(enText)) {
      // مغطًّى بقالب other: العربية يجب أن تكون صيغة قسمه
      if (c.n <= 2) { if (forms[fi] === undefined) forms[fi] = arForm; else if (forms[fi].replace("%d", c.n) !== arText) return null; }
      else if (forms[fi].replace("%d", c.n) !== arText) return null;
    } else if (c.n === 1 && /1/.test(enText) && (() => { const t = enText.replace(/(^|\D)1(?!\d)/, "$1%d"); return t !== enText && t.indexOf("%d") >= 0 && !/%d[\s\S]*%d/.test(t) && reOf(t).test(enText) ? (one = t) : false; })()) {
      forms[fi] = arForm;
    } else {
      if (reOf(other).test(enText)) return null;
      literals.push({ en: enText, ar: arText });
      if (c.n <= 2 && forms[fi] === undefined) forms[fi] = arForm;
    }
    void exactRaw;
  }
  for (let i = 0; i < 6; i++) if (forms[i] === undefined) return null;
  for (const f of forms) if (/%d[\s\S]*%d/.test(f)) return null;
  // حرفيٌّ يطابقه تعبير الجمع يظلّله (البناء يرفضه): لا مدخل جمع
  for (const l of literals) if (reOf(other).test(l.en) || (one && reOf(one).test(l.en))) return null;
  const spec = one && one !== other ? { plural: other, forms } : { forms };
  return { key: one && one !== other ? one : other, spec, literals };
}

// ---------------- عرض النهائي للذهاب والإياب ----------------
// ⇒ [{vals, en:[مقاطع], ar:[مقاطع]}] بقيمٍ فعلية: كل تركيبٍ من فروع الاختيارات، وكل عددٍ من ROUND_NUMS و=N لكل جمع
export function concreteRenders(enMsg, arMsg, tVars) {
  const enAst = parseICU(enMsg), arAst = parseICU(arMsg);
  const E = collectVars(enAst), A = collectVars(arAst);
  const pv = new Map(), sv = new Map();
  for (const M of [E.pv, A.pv]) for (const [v, s] of M) { const t = pv.get(v) || new Set(ROUND_NUMS); for (const n of s) t.add(n); pv.set(v, t); }
  for (const M of [E.sv, A.sv]) for (const [v, s] of M) { const t = sv.get(v) || new Set(["other"]); for (const k of s) t.add(k); sv.set(v, t); }
  const proxy = proxies([enAst, arAst], new Set(pv.keys()), new Set(sv.keys()));
  let vals = [{}];
  for (const [v, keys] of sv) vals = vals.flatMap((x) => [...keys].map((k) => ({ ...x, ["§" + v]: k })));
  for (const [v, nums] of pv) vals = vals.flatMap((x) => [...nums].map((n) => ({ ...x, [v]: n })));
  const out = [];
  if (vals.length > 20000) { vals = vals.slice(0, 20000); out.truncated = true; } // سقفٌ معلَن: يُعدّ في التقرير (roundTrip.truncated)
  for (const val of vals) out.push({ vals: val, en: fragsOf(enAst, val, "en", proxy, sv, tVars), ar: fragsOf(arAst, val, "ar", proxy, sv, tVars) });
  return out;
}
function fragsOf(ast, val, side, proxy, sv, tVars) {
  const frags = [""], code = [false], open = [];
  const put = (x) => { frags[frags.length - 1] += x; if (open.some((t) => CODE_TAG.test(t))) code[code.length - 1] = true; };
  const brk = () => { frags.push(""); code.push(false); };
  const argVal = (name) => {
    if (val[name] !== undefined) return String(val[name]);
    if (proxy.has(name)) return String(val[proxy.get(name)]);
    if (sv.has(name)) { const k = val["§" + name]; return k === "other" ? SAMPLE : k; }
    if (tVars.includes(name)) return side === "en" ? T_SAMPLE_EN : T_SAMPLE_AR;
    return NUMERIC_NAME.test(name) ? "7" : SAMPLE;
  };
  (function walk(ns, num) {
    for (const n of ns) {
      if (n.t === "text") put(n.v);
      else if (n.t === "pound") put(String(num));
      else if (n.t === "arg") put(argVal(n.name));
      else if (n.t === "tag") { brk(); open.push(n.name); walk(n.kids, num); open.pop(); brk(); }
      else if (n.t === "select") { const k = val["§" + n.name]; walk(n.opts[k] || n.opts.other || [], num); }
      else if (n.t === "plural") {
        const x = val[n.name], o = n.opts;
        walk(o["=" + x] || o[(side === "en" ? PR_EN : PR_AR).select(x)] || o.other || [], x);
      }
    }
  })(ast, undefined);
  return frags.map((f, i) => ({ t: f.trim(), code: code[i] }));
}

// نصٌّ يطابقه تعبير نمطٍ قائم: كل مجموعةٍ عليا بالقيمة v والثابتُ بلا هروبه؛ وما فيه بنيةٌ أخرى خارج المجموعات لا يُعرض (يُرجَع [])
function sampleRe(src, v) {
  let s = src.replace(/^\^/, "").replace(/\$$/, ""), out = "", depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\") { if (depth === 0) { if (/[dDwWsSbB1-9]/.test(s[i + 1] || "")) return []; out += s[i + 1] || ""; } i++; continue; }
    if (ch === "(") { if (depth === 0) out += v; depth++; continue; }
    if (ch === ")") { depth--; continue; }
    if (depth === 0 && /[[\]{}|*+?.^$]/.test(ch)) return [];
    if (depth === 0) out += ch;
  }
  return depth === 0 ? [out] : [];
}

// ---------------- الأداة ----------------
function readParts(dir, only) {
  const fin = path.join(dir, "final"), prt = path.join(dir, "parts");
  const names = fs.readdirSync(fin).filter((f) => /^[nsr]\d\d\.json$/.test(f)).map((f) => f.slice(0, 3)).filter((p) => !only || only.includes(p)).sort();
  const out = [];
  for (const p of names) {
    const final = JSON.parse(fs.readFileSync(path.join(fin, p + ".json"), "utf8"));
    const items = fs.existsSync(path.join(prt, p + ".json")) ? JSON.parse(fs.readFileSync(path.join(prt, p + ".json"), "utf8")) : [];
    final.forEach((f, i) => out.push({ part: p, idx: i, en: f.en, ar: f.ar, item: items[i] || {} }));
  }
  return out;
}
// المستبعَد: ما لم يعد في الموقع (todo.json inventory: removed-from-site) وما تسمّيه الشكوك كذلك
function removedSet(dir) {
  const s = new Set();
  try {
    const t = JSON.parse(fs.readFileSync(path.join(dir, "todo.json"), "utf8"));
    for (const x of t.inventory || []) if (x.fate === "removed-from-site") s.add(x.part + "\u0001" + x.en);
  } catch {}
  try {
    for (const f of fs.readdirSync(path.join(dir, "final")).filter((n) => /doubts/.test(n) && n.endsWith(".json"))) {
      const d = JSON.parse(fs.readFileSync(path.join(dir, "final", f), "utf8"));
      for (const x of Array.isArray(d) ? d : d.doubts || []) if (x && x.part && x.en && /removed-from-site|no longer on the site/i.test(String(x.issue || ""))) s.add(x.part + "\u0001" + x.en);
    }
  } catch {}
  return s;
}
const nl = (s, on) => (on ? s.replace(/\\n/g, "\n") : s);
// gen-patterns الحقيقي على نسخةٍ مؤقتة (الأدوات والإضافة بلا مولَّداتها وlanguages.json وقاموسٍ مؤقت)
function runGenPatterns(dict, pairs) {
  const box = fs.mkdtempSync(path.join(os.tmpdir(), "cml-merge-icu-"));
  try {
    const ROOTW = path.resolve(HERE, "..", "..");
    const inBox = (p) => path.join(box, path.relative(ROOTW, p));
    fs.cpSync(HERE, inBox(HERE), { recursive: true });
    fs.cpSync(LANGUAGES_JSON, inBox(LANGUAGES_JSON));
    fs.cpSync(EXT, inBox(EXT), { recursive: true, filter: (src) => !/^(bodies|fonts|dictionary\.js|dict-[a-z]+\.js)(?:[\\/]|$)/.test(path.relative(EXT, src)) });
    fs.mkdirSync(inBox(DICTS), { recursive: true });
    fs.mkdirSync(inBox(GLOSSARY), { recursive: true });
    fs.writeFileSync(path.join(inBox(DICTS), "ar.json"), JSON.stringify(dict), "utf8");
    const pf = path.join(box, "pairs.json");
    fs.writeFileSync(pf, JSON.stringify(pairs), "utf8");
    const r = spawnSync(process.execPath, [path.join(inBox(HERE), "gen-patterns.mjs"), "--domain=app", "--in=" + pf], { encoding: "utf8", timeout: 600000 });
    if (r.status !== 0) throw new Error("gen-patterns: " + (r.stderr || r.stdout).slice(-300));
    const after = JSON.parse(fs.readFileSync(path.join(inBox(DICTS), "ar.json"), "utf8"));
    let rej = [];
    try { rej = JSON.parse(fs.readFileSync(path.join(inBox(GLOSSARY), "_patterns-rejected.json"), "utf8")); } catch {}
    return { patterns: after.patterns || [], rejected: rej, log: (r.stdout || "").trim().split("\n").slice(-2).join(" | ") };
  } finally { fs.rmSync(box, { recursive: true, force: true }); }
}

// تجميع مدخلات الرسائل المحوَّلة، ونهائيّان بمفتاحٍ واحد وقيمتين يُسردان (الأول يبقى)
function aggregate(conv, conflict) {
  const lits = new Map(), plurals = new Map(), pairs = new Map(), cats = new Map(), from = new Map();
  for (const c of conv) {
    const r = c.r, src = c.src;
    for (const l of r.literals) {
      if (lits.has(l.en)) { if (lits.get(l.en) !== l.ar) conflict("two-finals-one-key", { key: "literal", a: from.get("l" + l.en), b: src }); continue; }
      lits.set(l.en, l.ar); from.set("l" + l.en, src);
    }
    for (const [k, v] of Object.entries(r.plurals)) {
      if (plurals.has(k)) { if (JSON.stringify(plurals.get(k)) !== JSON.stringify(v)) conflict("two-finals-one-key", { key: "plural", a: from.get("p" + k), b: src }); continue; }
      plurals.set(k, v); from.set("p" + k, src);
    }
    for (const p of r.pairs) {
      if (pairs.has(p.en)) { if (pairs.get(p.en).ar !== p.ar) conflict("two-finals-one-key", { key: "pattern pair", a: from.get("t" + p.en), b: src }); continue; }
      pairs.set(p.en, p); from.set("t" + p.en, src);
    }
    for (const x of r.cats) {
      if (cats.has(x.re)) { if (cats.get(x.re).ar !== x.ar) conflict("two-finals-one-key", { key: "category pattern", a: from.get("c" + x.re), b: src }); continue; }
      cats.set(x.re, x); from.set("c" + x.re, src);
    }
  }
  return { lits, plurals, pairs: [...pairs.values()], cats: [...cats.values()], from };
}

export function run(o) {
  const dict0 = JSON.parse(fs.readFileSync(o.dict, "utf8"));
  const removed = removedSet(o.t10);
  const msgs = readParts(o.t10, o.parts);
  const R = { parts: {}, classes: {}, entries: {}, notConverted: [], excluded: [], conflicts: [], roundTrip: null, unitCheck: [] };
  const conflict = (kind, detail) => R.conflicts.push({ kind, ...detail });
  let conv = [];
  for (const m of msgs) {
    const P = (R.parts[m.part] = R.parts[m.part] || { messages: 0, converted: 0, excluded: 0, notConverted: 0, classes: {} });
    P.messages++;
    if (removed.has(m.part + "\u0001" + m.en)) { P.excluded++; R.excluded.push({ part: m.part, idx: m.idx, why: "removed-from-site" }); continue; }
    const on = m.item && m.item.nl === true;
    const en = nl(m.en, on), ar = nl(m.ar, on);
    const r = convertMessage(en, ar, { tVars: o.tVars });
    const src = m.part + "#" + (m.idx + 1);
    if (!r.ok) { P.notConverted++; R.notConverted.push({ part: m.part, idx: m.idx, src, why: r.why }); continue; }
    conv.push({ m, en, ar, r, src });
  }
  const S0 = dict0.strings || {}, P0 = dict0.plurals || {};
  const own = (o2, k) => Object.prototype.hasOwnProperty.call(o2, k);
  const before = new Map((dict0.patterns || []).map((p) => [p.re, p]));
  // ٣) أزواج gen-patterns: يُشغَّل الحقيقي على القاموس بعد الحرفيّات الجديدة (الحرفيّ أولًا ثم الأنماط: RULES §9)؛ ورسالةٌ رُفض زوجٌ منها
  // لا تُحوَّل كلها (وإلا بقي مقطعٌ منها إنجليزيًّا بين مقاطع عربية)، ثم يُعاد حتى يستقرّ
  let agg, litOut, genAdded = [], genRejected = [], genLog = "";
  for (let round = 0; round < 4; round++) {
    const tmpConf = [];
    agg = aggregate(conv, (k, d) => tmpConf.push({ kind: k, ...d }));
    litOut = [...agg.lits].filter(([en]) => !own(S0, en)).map(([en, ar]) => ({ en, ar }));
    if (!agg.pairs.length || o.noGen) { genAdded = []; genRejected = []; break; }
    const dictL = { ...dict0, strings: { ...S0 } };
    for (const l of litOut) dictL.strings[l.en] = l.ar;
    const g = runGenPatterns(dictL, agg.pairs);
    genAdded = g.patterns.filter((p) => !before.has(p.re));
    genRejected = g.rejected; genLog = g.log;
    const rej = new Map(genRejected.map((x) => [x.en, x.why]));
    // والزوج الذي طابق تعبيرُه نمطًا قائمًا بعربيةٍ أخرى (gen-patterns يعدّه «مكررًا» ويُبقي القائم) رفضٌ كذلك
    for (const p of agg.pairs) {
      const opt = p.t ? { t: p.t } : undefined;
      const mp = SHARED.makePattern(p.en, p.ar, opt) || SHARED.makePatternBounded(p.en, p.ar, opt);
      if (mp && before.has(mp.re) && before.get(mp.re).ar !== mp.ar) rej.set(p.en, "pattern-re-in-ar.json-with-other-arabic");
    }
    const bad = conv.filter((c) => c.r.pairs.some((p) => rej.has(p.en)));
    if (!bad.length) break;
    for (const c of bad) {
      const w = rej.get(c.r.pairs.find((p) => rej.has(p.en)).en);
      R.notConverted.push({ part: c.m.part, idx: c.m.idx, src: c.src, why: "gen-patterns: " + String(w).split(":")[0] });
    }
    conv = conv.filter((c) => !bad.includes(c));
  }
  agg = aggregate(conv, conflict);
  for (const c of conv) {
    const P = R.parts[c.m.part];
    P.converted++;
    P.classes[c.r.cls] = (P.classes[c.r.cls] || 0) + 1;
    R.classes[c.r.cls] = (R.classes[c.r.cls] || 0) + 1;
  }
  for (const x of R.notConverted) R.parts[x.part].notConverted = R.notConverted.filter((y) => y.part === x.part).length;
  const survivingPairEn = new Set(agg.pairs.map((p) => p.en.trim()));
  genAdded = genAdded.filter((p) => survivingPairEn.has(String(p.en).trim()));
  // تعارضات القاموس القائم
  litOut = [];
  let same = 0;
  for (const [en, ar] of agg.lits) {
    if (own(S0, en)) { if (S0[en] !== ar) conflict("key-in-ar-strings", { src: agg.from.get("l" + en) }); else same++; continue; }
    litOut.push({ en, ar });
  }
  const plOut = {};
  const oldPlTexts = new Set(Object.entries(P0).flatMap(([k, v]) => [k, v.plural].filter(Boolean)));
  for (const [k, v] of agg.plurals) {
    if (oldPlTexts.has(k) || (v.plural && oldPlTexts.has(v.plural))) { conflict("key-in-ar-plurals", { src: agg.from.get("p" + k) }); continue; }
    plOut[k] = v;
  }
  const catOut = agg.cats;
  const added = genAdded.concat(catOut);
  // القاموس المدموج للذهاب والإياب: الحرفيّ القائم يغلب (merge-batches)، والجمع القائم يبقى (merge-plurals)، والأنماط بفرز التخصيص (gen-patterns)
  const merged = { ...dict0, strings: { ...S0 }, plurals: { ...P0, ...plOut }, patterns: SHARED.sortBySpecificity((dict0.patterns || []).concat(added)) };
  for (const l of litOut) merged.strings[l.en] = l.ar;
  if (!own(merged.strings, T_SAMPLE_EN)) merged.strings[T_SAMPLE_EN] = T_SAMPLE_AR;
  // ظلال حارس البناء (shadowGuard): حرفيٌّ يطابقه نمطٌ (غير b/lit) أو جمع ⇒ البناء يرفضه
  const TRES = SHARED.toolRes(merged.strings);
  const esc = SHARED.escapeRe;
  const mk = (p) => { try { return { re: new RegExp(p.re), ar: p.ar, src: "pattern", en: p.en }; } catch { return null; } };
  const hits = (r, key) => (/%[MWPT]\d/.test(r.ar || "") ? SHARED.patternApply(r.re, r.ar, key, TRES) !== null : r.re.test(key));
  const newRes = added.filter((p) => !p.b && !p.lit).map(mk).filter(Boolean);
  for (const [k, v] of Object.entries(plOut)) for (const t of [k, v.plural]) if (t) newRes.push({ re: new RegExp("^" + esc(t).replace("%d", "(\\d+)") + "$"), src: "plural", en: k });
  const newIdx = SHARED.patternIndex(newRes.map((r) => r.re.source));
  const newLit = new Set(litOut.map((l) => l.en));
  for (const key of Object.keys(merged.strings)) {
    const h = newIdx.find(key, (i) => (hits(newRes[i], key) ? newRes[i] : null));
    if (h) conflict((newLit.has(key) ? "new-literal" : "existing-literal") + "-shadows-new-" + h.src, { key: newLit.has(key) ? key : "(existing key)", by: h.en });
  }
  const oldRes = (dict0.patterns || []).filter((p) => !p.b && !p.lit).map(mk).filter(Boolean);
  for (const [k, v] of Object.entries(P0)) for (const t of [k, v.plural]) if (t) { try { oldRes.push({ re: new RegExp("^" + esc(t).replace("%d", "(\\d+)") + "$"), src: "plural", en: k }); } catch {} }
  const oldIdx = SHARED.patternIndex(oldRes.map((r) => r.re.source));
  for (const l of litOut) {
    const h = oldIdx.find(l.en, (i) => (hits(oldRes[i], l.en) ? oldRes[i] : null));
    if (h) conflict("new-literal-shadows-existing-" + h.src, { key: l.en, by: h.en });
  }
  // جمعٌ جديد يأخذ نصًّا كان يترجمه نمطٌ قائم (الجموع تسبق الأنماط في المحرّك)
  const L0 = makeLookup(dict0);
  for (const [k, v] of Object.entries(plOut)) for (const t of [k, v.plural]) {
    if (!t) continue;
    for (const n of [1, 3, 11, 100]) { const x = L0.lookup(t.replace("%d", n)); if (x && x.how === "pattern") { conflict("new-plural-takes-text-of-existing-pattern", { key: k, by: x.pat && x.pat.en }); break; } }
  }
  R.entries = { literals: litOut.length, literalsSame: same, plurals: Object.keys(plOut).length, pairs: agg.pairs.length, genAdded: genAdded.length, genRejected: genRejected.length, cats: catOut.length, genLog };
  // ★ الذهاب والإياب
  const L = makeLookup(merged);
  const genSet = new Set(added.map((p) => p.re)), plSet = new Set(Object.keys(plOut));
  // ★ (مراجعة ت10-هـ1) نمطٌ مولَّد يأخذ نصًّا كان يترجمه نمطٌ قائم: فرزُ التخصيص قد يقدّمه عليه (العدد المفرد ثابتٌ في تعبيره فيطول ثابته)،
  // والذهاب والإياب لا يرى ذلك لأنه يعرض رسائل ت10 وحدها. فيُعرض قالب كل نمطٍ قائم بقيمٍ نموذجية (الأعداد، وZeddicus لغير العددي)، وما
  // ترجمه النمط القائم ثم صار مخرَجُه آخر بمدخلٍ مولَّد يُسرد
  const takenFrom = new Set();
  for (const p of dict0.patterns || []) {
    if (!p || !p.re || p.b || p.lit) continue;
    let reP; try { reP = new RegExp(p.re); } catch { continue; }
    const texts = new Set();
    for (const n of ["0", "1", "2", "3", "11", "100", SAMPLE]) {
      if (p.en) { texts.add(p.en.replace(/\{(\w+)\}/g, (_, v) => (NUMERIC_NAME.test(v) ? n : SAMPLE))); texts.add(p.en.replace(/\{\w+\}/g, n)); }
      // وقالب "en" قد يكون عامًّا وتعبيرُه مخصَّصًا بالوحدة («… free Zqunits of …»): فيُعرض التعبير نفسه، كل مجموعةٍ عليا بالقيمة
      for (const t of sampleRe(p.re, n)) texts.add(t);
    }
    for (const t of texts) {
      if (!reP.test(t)) continue;
      const a = L0.lookup(t);
      if (a.how !== "pattern" || !a.pat || a.pat.src !== p.re) continue;
      const b = L.lookup(t);
      if (b.out === a.out || b.how !== "pattern" || !b.pat || !genSet.has(b.pat.src) || takenFrom.has(p.re + "\u0001" + b.pat.src)) continue;
      takenFrom.add(p.re + "\u0001" + b.pat.src);
      conflict("new-pattern-takes-text-of-existing-pattern", { key: p.en || p.re, by: b.pat.en });
    }
  }
  const mis = [], why = {}, shadowed = new Map(), truncated = [];
  let checked = 0;
  for (const c of conv) {
    const rs = concreteRenders(c.en, c.ar, c.r.tVars || []);
    if (rs.truncated) truncated.push(c.src);
    for (const r of rs) {
      if (r.en.length !== r.ar.length) { why["fragment-count"] = (why["fragment-count"] || 0) + 1; mis.push({ src: c.src, why: "fragment-count" }); continue; }
      for (let i = 0; i < r.en.length; i++) {
        const e = r.en[i], a = r.ar[i];
        if (!e.t || e.code || a.code) continue;
        checked++;
        const got = L.lookup(e.t);
        const out = got && typeof got === "object" ? got.out : got;
        if (out === a.t) continue;
        if ((out === null || out === undefined) && e.t === a.t) continue; // مطابقٌ بلا مدخل (قيمةٌ وحدها)
        let w = "unexplained";
        if (!/[A-Za-z]/.test(e.t.replace(new RegExp(SAMPLE + "|" + T_SAMPLE_EN, "g"), ""))) w = "symbol-only fragment, not keyed";
        else if (got && got.how === "exact" && own(S0, e.t)) w = "existing literal wins (key-in-ar-strings)";
        else if (got && got.how === "exact" && agg.lits.has(e.t) && agg.from.get("l" + e.t) !== c.src) w = "another final holds the key (two-finals-one-key)";
        else if (got && got.how === "plural" && !plSet.has(got.key)) w = "existing plural wins";
        else if (got && got.how === "plural" && agg.from.get("p" + got.key) !== c.src) w = "another final holds the key (two-finals-one-key)";
        else if (got && got.how === "pattern" && got.pat && !genSet.has(got.pat.src)) w = "existing pattern wins";
        if (w.startsWith("existing pattern") || w.startsWith("existing plural")) {
          const by = got.how === "pattern" ? got.pat.en : got.key, k2 = c.src + "\u0001" + by;
          if (!shadowed.has(k2)) { shadowed.set(k2, 1); conflict("new-entry-shadowed-by-existing-" + got.how, { src: c.src, by }); }
        }
        why[w] = (why[w] || 0) + 1;
        if (mis.length < 600) mis.push({ src: c.src, vals: r.vals, why: w, en: e.t, want: a.t, got: out === undefined ? null : out });
      }
    }
  }
  R.roundTrip = { messages: conv.length, checked, mismatches: Object.values(why).reduce((x, y) => x + y, 0), byReason: why, unexplained: why.unexplained || 0, truncated };
  // (d) الوحدة: مدخلات ar.json لكل وحدةٍ تسبق النمط العام — قالبٌ فيه {unit}/{displayUnit} يُعرض بوحداتٍ شائعة ويُسمّى المترجِم
  for (const c of conv) {
    if (!/\{(?:unit|displayUnit)\}/.test(c.en)) continue;
    for (const u of ["day", "week", "month", "year"]) {
      for (const r of concreteRenders(c.en.replace(/\{(?:unit|displayUnit)\}/g, u), c.ar, c.r.tVars || [])) {
        const ns = Object.values(r.vals).filter((x) => typeof x === "number");
        if (!ns.some((n) => n === 1 || n === 3 || n === 11)) continue;
        for (const e of r.en) {
          if (!e.t || !e.t.includes(u) || !/[A-Za-z]{2}/.test(e.t)) continue;
          const g = L.lookup(e.t);
          const by = !g || !g.how ? "none (stays English)" : g.how === "pattern" && genSet.has(g.pat.src) ? "generic (unit stays English inside Arabic)" : "existing " + g.how;
          R.unitCheck.push({ src: c.src, unit: u, n: ns.join(","), by });
        }
      }
    }
  }
  return { R, out: { literals: litOut, plurals: plOut, pairs: agg.pairs, catPatterns: catOut, genAdded, genRejected, mismatches: mis } };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d = "") => { const a = process.argv.find((x) => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : d; };
  const o = {
    t10: path.resolve(arg("t10", path.join(GLOSSARY, "_app-gap-20261024", "t10"))),
    dict: path.resolve(arg("dict", path.join(DICTS, "ar.json"))),
    parts: arg("parts", "") ? arg("parts", "").split(",") : null,
    tVars: arg("t-vars", "") ? arg("t-vars", "").split(",") : T_VARS_DEFAULT,
    noGen: process.argv.includes("--no-gen-patterns"),
  };
  const OUT = path.resolve(arg("out", path.join(GLOSSARY, "_t10h")));
  const refusedT = o.tVars.filter((x) => USER_VALUE.test(x));
  if (refusedT.length) console.log(`✗ %T مرفوض لقيمة مستخدم: ${refusedT.join("، ")} (يُلتقط خامًا $n)`);
  const { R, out } = run(o);
  fs.mkdirSync(OUT, { recursive: true });
  const w = (f, x) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(x, null, 1) + "\n", "utf8");
  w("literals.json", out.literals);
  w("plurals.json", out.plurals);
  w("pairs.json", out.pairs);
  w("category-patterns.json", { patterns: out.catPatterns });
  w("gen-patterns-added.json", { patterns: out.genAdded });
  w("gen-patterns-rejected.json", out.genRejected);
  w("mismatches.json", out.mismatches);
  w("report.json", R);
  const nc = {};
  for (const x of R.notConverted) { const k = x.why.split(":")[0] + (x.why.startsWith("category") ? ":" + x.why.split(": ")[1] : ""); nc[k] = (nc[k] || 0) + 1; }
  const cf = {};
  for (const x of R.conflicts) cf[x.kind] = (cf[x.kind] || 0) + 1;
  const conv = Object.values(R.parts).reduce((a, p) => a + p.converted, 0), all = Object.values(R.parts).reduce((a, p) => a + p.messages, 0);
  console.log(`رسائل: ${all} — حُوِّل ${conv}، ومستبعَد ${R.excluded.length}، ولم يُحوَّل ${R.notConverted.length}`);
  console.log(`الأصناف: ${JSON.stringify(R.classes)}`);
  console.log(`المدخلات: حرفيّ ${R.entries.literals} (ومطابقٌ قائم ${R.entries.literalsSame || 0})، جمع ${R.entries.plurals}، أزواج gen-patterns ${R.entries.pairs} (أُضيف ${R.entries.genAdded}، رُفض ${R.entries.genRejected})، أنماط أقسام ${R.entries.cats}`);
  console.log(`لم يُحوَّل: ${JSON.stringify(nc)}`);
  console.log(`التعارضات: ${JSON.stringify(cf)}`);
  console.log(`الذهاب والإياب: ${R.roundTrip.checked} مقطعًا — مخالفات ${R.roundTrip.mismatches} ${JSON.stringify(R.roundTrip.byReason)} — غير مفسَّرة ${R.roundTrip.unexplained} (يجب 0)`);
  console.log(`← ${path.basename(OUT)}/ (متجاهَل)`);
  process.exit(R.roundTrip.unexplained ? 1 : 0);
}
