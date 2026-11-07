// partial-english.mjs — ★ (ت10-0، ١٣ جمادى الأولى ١٤٤٨هـ — القرار 123) بوابة «اللفظ الإنجليزي وسط العربية»: تعرض قاموسَ النطاق على إنجليزية
// الفهرس الحالي بسلسلة المحرّك (القاموس الحرفي ← الجموع ← الأنماط، بمُحلِّلات cml-shared نفسها: patternIndex وfillPattern وpatternRes)،
// وتسرد كلَّ مخرَجٍ عربيٍّ بقي فيه لفظٌ إنجليزيٌّ عاديّ من المصدر — كـ«إزالة the other 3» من نمطٍ عامّ يترجم بعض الجملة (ر30-أ: 812 في claude.ai).
//
// ★ (ت10-هـ1، ٢٠ جمادى الأولى ١٤٤٨هـ) ويُحكم على كل مخرَج: النمط (ما جاء من التقاطه الخام)، والحرفيّ (overrides ثم strings، كالمحرّك)، والجمع (صيغته
// العربية بالعدد)، ومقطع الوسم الباقي بجوار مترجَم. وكان الحرفيّ والجمع يمرّان بلا حكم، فمدخلٌ يترك لفظًا عاديًّا وسط العربية لا يُرى.
//
// ما لا يُعدّ لفظًا عاديًّا (فلا يُحسب):
//   - الأسماء: كل كلمةٍ فيها حرفٌ كبير في أولها أو وسطها (Claude، GitHub، Projects بين قوسين، macOS، mTLS)، والرابط الصغير بين كلمتين لاتينيتين
//     بحرفٍ كبير (Claude for Chrome، Git for Windows)، وكل كلمةٍ لا ترد في المصدر الإنجليزي نفسه؛
//   - الرموز: كلمةٌ تلاصقها علامةُ رمز (. _ / \ @ : # = ~ $ < > { } [ ] ` أو رقم) أو تسبقها «--»، كـ ~/.ssh وknown_hosts و--verbose؛ أو في كتلةٍ بلا بياضٍ
//     فيها علامةُ رمز (anthropic/claude-code-ide)، أو بين علامتي ‎`…`‎، أو امتدادٌ وملفٌّ نقطيّ (‎.md‎، ‎.claude‎)؛
//   - المتغيّرات وقيمها النموذجية: الفهرس يُعرض بقيمٍ نموذجية (أعداد، و«Zeddicus» لما سواها)، فلا محتوى مستخدمٍ في العرض أصلًا؛
//   - ما تُبقيه ترجماتنا المراجَعة عمدًا: كلمةٌ صغيرةٌ لاتينية في نصٍّ عربيٍّ مراجَع من القاموس نفسه (قيمةٌ حرفية أو صيغ جمع: ssh وgit ونحوهما) ونادرةٌ
//     في إنجليزية الفهرس (ترد بحرفٍ صغير في أقلّ من 25 رسالة) مقبولةٌ في مخرَج النمط والمقطع (allowedTokens). وفي مخرَج الحرفيّ والجمع يُشترط معهما أن
//     يُبقيها نصٌّ مراجَعٌ آخرُ غيرُ نصّه (allowedFor): فلا يُعفي النصُّ نفسَه، ولا مفتاحان بالعربية نفسها أحدُهما الآخر، ولا تصحيحُ المستخدم شيئًا.
//     وما سوى ذلك ثغرة: يُصلحها مدخل، أو يقرّها خطّ الأساس بعد مراجعةٍ تصنّفها إبقاءً متعمَّدًا.
// والحكم على مخرَجٍ فيه حرفٌ عربي وحده: النصّ الإنجليزي كلّه ثغرةٌ لا خلط (completeness وفحص الترجمة).
//
// البوابة: كل حالةٍ ببصمتها (fp64 للرسالة الإنجليزية، لا نصّ) في خطّ الأساس web/code/test/partial-english-baseline.json؛ فحالةٌ جديدة تُخرج 1،
// ونقصُ الحالات يُطبع تحسّنًا يُكتب بـ‎--write-baseline‎. ولا نصَّ موقعٍ في الملف ولا في السجلّ: أعدادٌ وبصمات، و‎--list=<ملف>‎ للتفصيل خارج المستودع.
//   node web/code/toolchain/partial-english.mjs [--domain=app] [--catalog=<en-by-id.json | ملفٌّ نصّي بسطرٍ لكل رسالة>] [--write-baseline] [--list=<out.json>] [--baseline=<ملف>]
// الفهرس: ‎--catalog‎، وإلا web/code/glossary/claude-ALL-strings.txt للتطبيق (كـcross-check-patterns) ثم ‎_live-catalog.txt‎ (harvest-live.mjs: القوالب بلا رسائل
// الجمع والوسوم، فيُفحص ما فيه وحده)، وحصاد DOM لغيره؛ وبلا فهرسٍ سطرُ معلومةٍ والخروج 0
// (الفهرس خاصٌّ لا يُلتزم: يُجلب إلى /tmp ويُحذف — CLAUDE.md §6).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GLOSSARY, ROOT, CODE } from "./paths.mjs";

const { C, SHARED, domainArg, dictFile, harvestKeys, label } = await import(new URL("./domain-arg.mjs", import.meta.url).href);

export const SAMPLE = "Zeddicus";
export const NUMS = [0, 1, 2, 3, 11, 100];
const NUMERIC_NAME = /^(count|n|num|number|total|amount|value|percent|percentage|days|hours|minutes|seconds|tokens|limit|size|max|min|remaining|used|index|position|step|page|pages|items|files|lines|chars|characters|seats|members|users|credits|cost|price|spend|quantity|qty)$|count$|Count$|Number$|Total$|Percent$|Amount$/;

// ---------------- سلسلة المحرّك (engine.js lookup: overrides ← strings ← tryPlural ← tryPatterns) بقاموس النطاق المشحون ----------------
export function makeLookup(dict) {
  const strings = dict.strings || {};
  const own = (o, k) => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ORDER = ["zero", "one", "two", "few", "many", "other"];
  const PR = new Intl.PluralRules("ar");
  const pIndex = (n) => { const i = ORDER.indexOf(PR.select(n)); return i < 0 ? ORDER.indexOf("other") : i; };
  const pluralRes = [];
  for (const eng in dict.plurals || {}) {
    const spec = dict.plurals[eng], forms = spec.forms || [];
    for (const pat of [eng, spec.plural]) {
      if (!pat) continue;
      const at = pat.indexOf("%d"), pre = at < 0 ? null : pat.slice(0, at), suf = at < 0 ? null : pat.slice(at + 2);
      try { pluralRes.push({ re: new RegExp("^" + esc(pat).replace("%d", "(\\d+)") + "$"), forms, pre, suf, key: eng }); } catch {}
    }
  }
  const DIGIT = /\d/;
  function tryPlural(text) {
    for (const P of pluralRes) {
      if (P.pre !== null && (text.length <= P.pre.length + P.suf.length || !DIGIT.test(text.charAt(P.pre.length)) ||
        !DIGIT.test(text.charAt(text.length - P.suf.length - 1)) || text.lastIndexOf(P.pre, 0) !== 0 ||
        text.indexOf(P.suf, text.length - P.suf.length) !== text.length - P.suf.length)) continue;
      const m = text.match(P.re);
      if (m) { const n = +m[1]; let f = P.forms[pIndex(n)]; if (f === undefined) f = P.forms[P.forms.length - 1] || ""; return { out: f.replace("%d", n), key: P.key }; }
    }
    return null;
  }
  const patRes = [];
  (dict.patterns || []).forEach((p, idx) => { if (!p || !p.re || !p.ar) return; try { patRes.push({ re: new RegExp(p.re), ar: p.ar, src: p.re, en: p.en, idx }); } catch {} });
  const patIdx = SHARED.patternIndex(patRes.map((p) => p.src));
  const RES = SHARED.toolRes(strings);
  function tryPatterns(text) {
    if (!patRes.length || !/[A-Za-z]/.test(text)) return null;
    const hit = patIdx.find(text, (i) => {
      const m = text.match(patRes[i].re);
      if (!m) return null;
      const out = SHARED.fillPattern(patRes[i].ar, m, RES);
      return out === null ? null : { out, i, m };
    }, C.PATTERN_CAPTURE_MAX);
    return hit ? { out: hit.out, pat: patRes[hit.i], m: hit.m } : null;
  }
  const overrides = dict.overrides || {};
  function lookup(raw) {
    const key = SHARED.textKey(raw, Infinity);
    if (!key) return { how: null, out: null };
    const ov = own(overrides, key);
    if (ov !== undefined) return { how: "override", out: ov, key };
    const v = own(strings, key);
    if (v !== undefined) return { how: "exact", out: v, key };
    const pl = tryPlural(key); if (pl) return { how: "plural", out: pl.out, key: pl.key };
    // ★ (ت14-هـ0ب) كالمحرّك: العدد بفاصلة الآلاف للجموع والأنماط (cml-shared degroupDigits)؛ (ت14-هـ2) والجمعُ به يسبق الأنماط، والنمط الأسبق
    // في الفرز يفوز أيًّا كانت صورة العدد التي طابقها (engine.js lookup)
    const dg = SHARED.degroupDigits(key);
    if (dg) { const pl2 = tryPlural(dg.key); if (pl2) return { how: "plural", out: SHARED.regroupDigits(pl2.out, dg), key: pl2.key, grouped: true }; }
    const pt = tryPatterns(key), pt2 = dg ? tryPatterns(dg.key) : null;
    if (pt2 && (!pt || pt2.pat.idx < pt.pat.idx)) return { how: "pattern", out: SHARED.regroupDigits(pt2.out, dg), pat: pt2.pat, m: pt2.m, grouped: true };
    if (pt) return { how: "pattern", out: pt.out, pat: pt.pat, m: pt.m };
    return { how: null, out: null };
  }
  return { lookup, patRes, pluralRes };
}

// ---------------- عرض رسالة الفهرس كما تراها الصفحة (ICU مصغّر: المتغيّرات والجمع والاختيار والوسوم) ----------------
// يُرجع [{text, frags}]: لكل عرضٍ نموذجيٍّ نصُّه، ومقاطعه حين تفصلها وسوم (كل مقطعٍ عقدةُ نصٍّ مستقلة في الصفحة يُطلب وحده)
export function parseICU(s) {
  let i = 0;
  function msg(inPl, endTag) {
    const nodes = []; let text = "";
    const flush = () => { if (text) { nodes.push({ t: "text", v: text }); text = ""; } };
    while (i < s.length) {
      const c = s[i];
      if (c === "'") {
        if (s[i + 1] === "'") { text += "'"; i += 2; continue; }
        if (/[{}#<|]/.test(s[i + 1] || "")) { i++; while (i < s.length) { if (s[i] === "'") { if (s[i + 1] === "'") { text += "'"; i += 2; continue; } i++; break; } text += s[i++]; } continue; }
        text += c; i++; continue;
      }
      if (c === "}") break;
      if (c === "#" && inPl) { flush(); nodes.push({ t: "pound" }); i++; continue; }
      if (c === "<") {
        const close = /^<\/([A-Za-z0-9_-]+)\s*>/.exec(s.slice(i));
        if (close) { if (endTag === close[1]) { flush(); i += close[0].length; return nodes; } text += c; i++; continue; }
        const open = /^<([A-Za-z0-9_-]+)\s*(\/)?>/.exec(s.slice(i));
        if (open) { flush(); i += open[0].length; if (open[2]) { nodes.push({ t: "tag", name: open[1], kids: [] }); continue; } nodes.push({ t: "tag", name: open[1], kids: msg(inPl, open[1]) }); continue; }
        text += c; i++; continue;
      }
      if (c === "{") { flush(); i++; nodes.push(arg(inPl)); continue; }
      text += c; i++;
    }
    flush();
    return nodes;
  }
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  function ident() { ws(); const m = /^[^\s,{}#<>]+/.exec(s.slice(i)); if (!m) throw new Error("ident@" + i); i += m[0].length; ws(); return m[0]; }
  function arg(inPl) {
    const name = ident();
    if (s[i] === "}") { i++; return { t: "arg", name }; }
    if (s[i] !== ",") throw new Error("arg@" + i);
    i++; const type = ident();
    if (s[i] === "}") { i++; return { t: "arg", name, fmt: type }; }
    if (s[i] !== ",") throw new Error("type@" + i);
    i++; ws();
    if (type === "plural" || type === "selectordinal" || type === "select") {
      const opts = {}; let offset = 0;
      while (i < s.length && s[i] !== "}") {
        ws();
        if (s.slice(i, i + 7) === "offset:") { i += 7; const m = /^\s*(\d+)/.exec(s.slice(i)); offset = +m[1]; i += m[0].length; ws(); continue; }
        const key = ident();
        if (s[i] !== "{") throw new Error("opt@" + i);
        i++; opts[key] = msg(type !== "select" ? true : inPl);
        if (s[i] !== "}") throw new Error("optEnd@" + i);
        i++; ws();
      }
      i++;
      return { t: type === "select" ? "select" : "plural", ord: type === "selectordinal", name, opts, offset };
    }
    let depth = 0; while (i < s.length) { if (s[i] === "{") depth++; else if (s[i] === "}") { if (depth === 0) break; depth--; } i++; }
    i++;
    return { t: "arg", name, fmt: type };
  }
  const out = msg(false, null);
  if (i < s.length) throw new Error("trailing@" + i);
  return out;
}
const PR_EN = new Intl.PluralRules("en-US"), PR_EN_ORD = new Intl.PluralRules("en-US", { type: "ordinal" });
function collect(nodes, acc) {
  for (const n of nodes) {
    if (n.t === "arg") acc.args.add(n.name);
    else if (n.t === "plural") { acc.plural.add(n.name); for (const k in n.opts) collect(n.opts[k], acc); }
    else if (n.t === "select") { (acc.select[n.name] = acc.select[n.name] || new Set()); for (const k in n.opts) { acc.select[n.name].add(k); collect(n.opts[k], acc); } }
    else if (n.t === "tag") { acc.tags = true; collect(n.kids, acc); }
  }
  return acc;
}
function fmt(nodes, v, pn) {
  // ⇒ مقاطع: المقطع الجديد يبدأ عند كل وسمٍ (فتحًا وإغلاقًا)، كما تفصل الصفحةُ النصَّ عُقدًا
  const frags = [""], code = [false];
  let inCode = 0;
  const put = (x) => { frags[frags.length - 1] += x; if (inCode) code[code.length - 1] = true; };
  const brk = () => { if (frags[frags.length - 1] !== "") { frags.push(""); code.push(false); } };
  (function walk(ns, pnum) {
    for (const n of ns) {
      if (n.t === "text") put(n.v);
      else if (n.t === "pound") put(String(pnum));
      else if (n.t === "arg") put(String(v[n.name] !== undefined ? v[n.name] : NUMERIC_NAME.test(n.name) ? 3 : SAMPLE));
      else if (n.t === "tag") { const c = CODE_TAG.test(n.name || ""); brk(); if (c) inCode++; walk(n.kids, pnum); if (c) inCode--; brk(); }
      else if (n.t === "select") { const key = v["§" + n.name]; walk(n.opts[key] || n.opts.other || Object.values(n.opts)[0] || [], pnum); }
      else if (n.t === "plural") {
        const num = typeof v[n.name] === "number" ? v[n.name] : 3, k = num - (n.offset || 0);
        const cat = (n.ord ? PR_EN_ORD : PR_EN).select(k);
        walk(n.opts["=" + num] || n.opts[cat] || n.opts.other || [], k);
      }
    }
  })(nodes, pn);
  const out = [];
  frags.forEach((f, j) => { const t = f.replace(/\s+/g, " ").trim(); if (t) out.push({ t, code: code[j] }); });
  return out;
}
// وسومٌ تحمل رمزًا لا نصًّا (‎<code>‎ و‎<kbd>‎ ونحوهما): مقطعُها يبقى بحروفه عمدًا، فلا يُعدّ خلطًا
const CODE_TAG = /^(code|kbd|pre|mono|monospace|cmd|command|path|file|filename|snippet|samp|tt)$/i;
export function renders(en) {
  let ast;
  try { ast = parseICU(en); } catch { return [{ text: en, frags: [en], code: [false] }]; }
  const acc = collect(ast, { args: new Set(), plural: new Set(), select: {}, tags: false });
  const vars = [];
  const base = {};
  const plurals = [...acc.plural];
  const selects = Object.entries(acc.select);
  if (!plurals.length && !selects.length) vars.push(base);
  else {
    // كل قيمةٍ نموذجية لكل جمع (معًا)، وكل فرعٍ لكل اختيار (فرعٌ واحدٌ في كل مرة والبقية «other»)
    const nums = plurals.length ? NUMS : [3];
    const branches = selects.length ? selects.flatMap(([nm, ks]) => [...ks].map((k) => ({ ["§" + nm]: k }))) : [{}];
    for (const n of nums) for (const b of branches) { const v = Object.assign({}, b); for (const p of plurals) v[p] = n; vars.push(v); }
  }
  const seen = new Set(), out = [];
  for (const v of vars) {
    const fs_ = fmt(ast, v, 3), frags = fs_.map((x) => x.t);
    const text = frags.join(" ");
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push({ text, frags, code: fs_.map((x) => x.code) });
  }
  return out;
}

// ---------------- الحكم: لفظٌ إنجليزيٌّ عاديٌّ من المصدر بقي في مخرَجٍ عربي ----------------
const HAS_AR = /[؀-ۿ]/;
// ★ (مراجعة ت10-هـ1) الرابط داخل اسمٍ قائمةٌ مغلقة من حروف الربط الصغيرة (Claude for Chrome وGit for Windows وWindows on Arm): كلمةٌ عاديةٌ أخرى بين
// اسمين (Zqalpha reads Zqbeta) لفظٌ إنجليزيٌّ باقٍ يُعدّ، وكذلك and وor وthe (Pro or Max وسط العربية ترجمةٌ ناقصة)
const NAME_LINK = /^(?:for|in|on|of|at|by|to|with|via)$/;
const CODEY = /[_/\\@#=~$<>{}\[\]`\d]/; // والنقطة والنقطتان رمزٌ بين حرفين وحدهما (أدناه): آخر الجملة و«Request access: …» لفظٌ عادي
export function allowedTokens(dict, catalog) {
  // كلماتُ رمزٍ صغيرةٌ لاتينية تُبقيها ترجماتنا المراجَعة (قيمٌ حرفية فيها حرفٌ عربي، وصيغ الجموع): ssh وgit ونحوهما — إلا الكلمة الشائعة في
  // إنجليزية الفهرس (ترد بحرفٍ صغير في 25 رسالةً فأكثر: the وother وfile…)، فهي لفظٌ عاديٌّ ولو أبقته قيمةٌ ما في جملةٍ منقولة
  const freq = new Map();
  for (const { en } of catalog || []) for (const w of new Set(String(en).match(/\b[a-z]{2,}\b/g) || [])) freq.set(w, (freq.get(w) || 0) + 1);
  const allow = new Set();
  const words = (v) => { const out = new Set(); if (typeof v === "string" && HAS_AR.test(v)) for (const w of v.match(/[A-Za-z]{2,}/g) || []) if (/^[a-z]/.test(w) && (freq.get(w) || 0) < 25) out.add(w); return out; };
  // ★ (ت10-هـ1) ومن يُبقيها: لكل كلمةٍ وحداتُ النصّ العربي المراجَع التي تُبقيها (قيمةٌ حرفية بنصّها، أو مدخل جمعٍ بصيغه معًا)، ليُحكم على مخرَج
  // الحرفيّ والجمع بإبقاء غيره (allowedFor) — فالقيمة نفسها لا تُعفي نفسها، ولا مفتاحان بالعربية نفسها أحدُهما الآخر
  const keepers = new Map();
  const addUnit = (unit, vals) => { for (const v of vals) for (const w of words(v)) { allow.add(w); (keepers.get(w) || keepers.set(w, new Set()).get(w)).add(unit); } };
  for (const v of Object.values(dict.strings || {})) addUnit(unitOf("exact", v), [v]);
  for (const sp of Object.values(dict.plurals || {})) addUnit(unitOf("plural", sp.forms), sp.forms || []);
  allow.keepers = keepers;
  return allow;
}
// وحدة النصّ المراجَع: القيمة الحرفية بنصّها، ومدخل الجمع بصيغه كلها (صيغُه الستّ إبقاءٌ واحد)
const unitOf = (how, v) => (how === "plural" ? "p\n" + (v || []).join("\n") : "s\n" + v);
// ★ (ت10-هـ1) الحكم على مخرَج مدخلٍ حرفيٍّ (strings) أو جمع: كلمةٌ صغيرةٌ من المصدر في عربيته إبقاءٌ مراجَعٌ متعمَّد إن كانت نادرةً في إنجليزية الفهرس
// (دون 25 رسالة) وأبقاها نصٌّ عربيٌّ مراجَعٌ آخر غيرُ نصّه — وإلا فهي ثغرة. ومخرَج overrides (تصحيحات المستخدم، لا مراجَعة) لا يُعفي شيئًا بنفسه
export function allowedFor(allow, how, own) {
  const mine = how === "exact" || how === "plural" ? unitOf(how, own) : null;
  return { has: (w) => { const k = allow.keepers && allow.keepers.get(w); if (!k) return false; return k.size > (mine !== null && k.has(mine) ? 1 : 0); } };
}
export function leftover(out, src, allow, caps) {
  if (typeof out !== "string" || !HAS_AR.test(out)) return [];
  const srcW = new Set((String(src).match(/[A-Za-z]{2,}/g) || []).map((w) => w.toLowerCase()));
  // caps (اختياري): الالتقاطات التي يُظهرها النمط خامًا (SHARED.rawCaps) — اللفظ يُعدّ إن جاء منها وحدها، لا من عربية النمط المراجَعة
  const capW = caps ? new Set(caps.filter((c) => c !== SAMPLE && !/^\d+$/.test(c)).flatMap((c) => String(c).match(/[A-Za-z]{2,}/g) || [])) : null;
  const words = [];
  const re = /[A-Za-z]+/g;
  let m;
  while ((m = re.exec(out))) {
    const w = m[0], a = m.index, b = a + w.length;
    if (w.length < 2 || !/^[a-z]/.test(w)) continue;           // الأسماء والمختصرات تبدأ بحرفٍ كبير
    if (/[A-Z]/.test(w)) continue;                               // ★ (ت10-هـ1) وحرفٌ كبيرٌ في وسطها: اسمٌ أو معرّف (macOS وmTLS وheadersHelper)، كحكم المقاطع
    if (!srcW.has(w.toLowerCase())) continue;                    // ليس من المصدر: لم يأتِ من التقاطٍ أو ترجمةٍ ناقصة
    if (capW && !capW.has(w)) continue;                          // ليس من التقاطٍ خام: من عربية النمط نفسها
    if (allow && allow.has(w)) continue;                         // كلمةُ رمزٍ تُبقيها ترجماتنا المراجَعة عمدًا
    const before = out.charAt(a - 1), after = out.charAt(b);
    if (CODEY.test(before) || CODEY.test(after)) continue;       // رمزٌ أو مسارٌ أو متغيّر
    if (/[.:]/.test(before) && /\S/.test(out.charAt(a - 2))) continue;        // a.b أو x:y أو ~/.rc
    if (/[.:]/.test(after) && /[\w/]/.test(out.charAt(b + 1))) continue;      // file.md أو http://
    if (before === "-" && out.charAt(a - 2) === "-") continue;   // --flag
    // ★ (ت10-هـ1) رمزٌ بحدوده لا بجاره وحده: كلمةٌ في كتلةٍ بلا بياضٍ فيها علامةُ رمز (anthropic/claude-code أو x-www-form-urlencoded بعد «/»)،
    // أو بين علامتي ‎`…`‎ (كتلة رمزٍ في النصّ نفسه)
    const tok = out.slice(out.slice(0, a).search(/\S*$/), b + out.slice(b).search(/\s|$/));
    if (CODEY.test(tok) || /\w[.:]\w/.test(tok) || /^[(«“‘"]?\.[A-Za-z]/.test(tok)) continue;   // و‎.md‎ و‎.claude‎: امتدادٌ أو ملفٌّ نقطيّ
    if ((out.slice(0, a).match(/`/g) || []).length % 2 === 1 && out.indexOf("`", b) >= 0) continue;
    // ★ (ت10-هـ1) ورابطٌ صغيرٌ داخل اسمٍ بين كلمتين لاتينيتين بحرفٍ كبير (Claude for Chrome وGit for Windows وWindows on Arm): من الاسم
    // والقيمة النموذجية للالتقاط (Zeddicus) ليست اسمًا: «Zeddicus on Zqcloud» رابطُ جملةٍ بقي من الإنجليزية لا اسمُ منتج
    if (NAME_LINK.test(w) && /(?:^|[^A-Za-z])[A-Z][A-Za-z0-9]* $/.test(out.slice(0, a)) && /^ [A-Z]/.test(out.slice(b)) &&
      !new RegExp("(?:^|[^A-Za-z])" + SAMPLE + " $").test(out.slice(0, a)) && !new RegExp("^ " + SAMPLE + "(?![A-Za-z])").test(out.slice(b))) continue;
    words.push(w);
  }
  return words;
}

// ---------------- الأداة ----------------
function readCatalog(file) {
  const raw = fs.readFileSync(file, "utf8");
  if (/\.json$/i.test(file)) {
    const j = JSON.parse(raw), ids = j.ids || j;
    return Object.entries(ids).map(([id, v]) => ({ id, en: typeof v === "string" ? v : v && v.primary })).filter((x) => typeof x.en === "string" && x.en.trim());
  }
  return [...new Set(raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))].map((en) => ({ id: null, en }));
}
export function scan(dict, catalog) {
  const L = makeLookup(dict), allow = allowedTokens(dict, catalog);
  const cases = [], seen = new Set();
  let rendered = 0;
  for (const { id, en } of catalog) {
    if (seen.has(en)) continue;
    seen.add(en);
    const bad = [];
    for (const r of renders(en)) {
      // رسالةٌ بوسوم: مقاطعها عُقدٌ في الصفحة؛ فمقطعٌ يُترجم ومقطعٌ فيه لفظٌ عاديٌّ يبقى بلا ترجمة عرضٌ مختلطٌ كذلك (fragments)
      const fr = r.frags.length > 1 ? r.frags.map((f) => (/[A-Za-z]/.test(f) ? L.lookup(f) : null)) : null;
      if (fr && fr.some((l) => l && l.out && HAS_AR.test(l.out))) {
        r.frags.forEach((f, j) => {
          if (fr[j] && !fr[j].out && !r.code[j]) {
            // كلمات المقطع الباقي بحكم leftover نفسه (بحرفٍ عربيٍّ وهميّ يجعله «مخرَجًا عربيًّا»): الأسماء والرموز والمسارات والمسموح لا تُعدّ
            const w = leftover("\u0627 " + f, f, allow).filter((x) => !/[A-Z]/.test(x));
            if (w.length) bad.push({ text: f, out: null, how: "fragments", words: w, pattern: null, plural: null });
          }
        });
      }
      for (const f of r.frags) {
        if (!/[A-Za-z]/.test(f)) continue;
        rendered++;
        const l = L.lookup(f);
        // النمط: ما جاء من التقاطه الخام وحده (عربيته مراجَعة). ★ (ت10-هـ1) والحرفيّ (overrides وstrings) والجمع بالقواعد نفسها على مخرَجهما كله،
        // وإبقاؤهما المتعمَّد بـallowedFor: نادرٌ في الفهرس ويُبقيه نصٌّ مراجَعٌ آخر (كانا يمرّان بلا حكم، فمدخلٌ جديدٌ يترك لفظًا عاديًّا لا يُرى)
        const w = l.how === "pattern" ? leftover(l.out, f, allow, SHARED.rawCaps(l.pat.ar, l.m))
          : l.how === "exact" || l.how === "override" || l.how === "plural"
            ? leftover(l.out, f, allowedFor(allow, l.how, l.how === "plural" ? (dict.plurals[l.key] || {}).forms : l.out)) : [];
        if (w.length) bad.push({ text: f, out: l.out, how: l.how, words: w, pattern: l.pat ? l.pat.en : null, plural: l.how === "plural" ? l.key : null });
      }
    }
    if (bad.length) cases.push({ id, en, fp: SHARED.fp64("pe\n" + en), samples: bad });
  }
  return { cases, rendered, messages: seen.size };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d = "") => { const a = process.argv.find((x) => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : d; };
  const D = domainArg(process.argv);
  const BASE = arg("baseline", "") ? path.resolve(arg("baseline", "")) : path.join(CODE, "test", "partial-english-baseline.json");
  let catFile = arg("catalog", "");
  let catalog = null;
  if (catFile) catalog = readCatalog(path.resolve(catFile));
  else if (D === "app") { for (const n of ["claude-ALL-strings.txt", "_live-catalog.txt"]) { const f = path.join(GLOSSARY, n); if (!catalog && fs.existsSync(f)) { catFile = f; catalog = readCatalog(f); } } }
  else { const hk = harvestKeys(D); if (hk) catalog = [...new Set(hk.keys)].map((en) => ({ id: null, en })); }
  if (!catalog) {
    console.log(`ℹ ${label(D)}: لا فهرس إنجليزيًّا هنا (‎--catalog=<ملف>‎، أو claude-ALL-strings.txt في مجلد العمل المتجاهَل) — البوابة تُشغَّل متى وُجد؛ والخروج 0`);
    process.exit(0);
  }
  const dict = JSON.parse(fs.readFileSync(dictFile(D), "utf8"));
  const { cases, rendered, messages } = scan(dict, catalog);
  const listFile = arg("list", "");
  if (listFile) fs.writeFileSync(listFile, JSON.stringify(cases, null, 1), "utf8");
  const byHow = {};
  for (const c of cases) for (const s of c.samples) byHow[s.how] = (byHow[s.how] || 0) + 1;
  console.log(`${label(D)}: ${messages} رسالة، ${rendered} عرضًا نموذجيًّا — رسائلُ يبقى في مخرَجها العربي لفظٌ إنجليزيٌّ من المصدر: ${cases.length}` +
    ` (العروض: ${Object.entries(byHow).map(([k, v]) => k + " " + v).join("، ") || "0"})`);
  let base = {};
  try { base = JSON.parse(fs.readFileSync(BASE, "utf8")); } catch {}
  if (process.argv.includes("--write-baseline")) {
    base[D] = { count: cases.length, messages, at: new Date().toISOString().slice(0, 10), fps: cases.map((c) => c.fp).sort() };
    fs.writeFileSync(BASE, JSON.stringify(base, null, 1) + "\n", "utf8");
    console.log(`✓ كُتب خطّ الأساس لـ${D}: ${cases.length} حالة (بصماتٌ لا نصوص) ← ${path.relative(ROOT, BASE)}`);
    process.exit(0);
  }
  const known = new Set((base[D] && base[D].fps) || []);
  const fresh = cases.filter((c) => !known.has(c.fp));
  if (!base[D]) { console.log(`✗ لا خطّ أساس لـ${D} في ${path.relative(ROOT, BASE)} — اكتبه بـ‎--write-baseline‎ بعد مراجعة الحالات`); process.exit(1); }
  // ما زال من خطّ الأساس صنفان: رسالةٌ في هذا الفهرس صار مخرَجها سليمًا (إصلاح)، ورسالةٌ ليست في هذا الفهرس أصلًا (فهرسٌ أحدث أو جزئيّ كـ_live-catalog.txt
  // بلا رسائل الجمع والوسوم) — فلا يُحسب الغائب إصلاحًا
  const catFp = new Set(catalog.map((x) => SHARED.fp64("pe\n" + x.en))), now = new Set(cases.map((c) => c.fp));
  const fixed = base[D].fps.filter((f) => catFp.has(f) && !now.has(f)).length, absent = base[D].fps.filter((f) => !catFp.has(f)).length;
  console.log(`خطّ الأساس: ${base[D].count} — حالاتٌ جديدة ليست فيه: ${fresh.length} (يجب 0)` +
    (fixed ? ` — وأُصلح منه ${fixed} في هذا الفهرس: تحسّنٌ يُثبَّت بـ‎--write-baseline‎ بعد المراجعة` : "") + (absent ? ` — وليس في هذا الفهرس منه ${absent} (لا يُعدّ إصلاحًا)` : ""));
  for (const c of fresh.slice(0, 10)) console.log(`  ✗ جديد: بصمة ${c.fp} (${c.samples.map((s) => s.how + (s.words.length ? ":" + s.words.length + " لفظ" : "")).join("، ")})${c.id ? " · المعرّف " + c.id : ""}`);
  process.exit(fresh.length ? 1 : 0);
}
