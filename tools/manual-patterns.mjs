// manual-patterns.mjs — المدخل اليدوي الآمن للقوالب التي يرفض شكلَها مولِّدُ الأنماط (ت14-هـ0ب، القرار 142)
//
// لماذا: حرّاس makePattern (gen-patterns) ترفض قالبًا متغيّره في طرفيه، أو بمتغيّرين متجاورين، أو بأكثر من ثلاثة، أو بثابتٍ قصير — لأن نمطه
// العادي ‎(.+?)‎ يطابق نصوصًا غير نصّه أو يلتقط ما يكتبه المستخدم. والحارس صادقٌ ولا يُرخى. فالطريق الآمن لهذه الأشكال وصفةٌ (recipe) يكتب فيها
// المدمِج تعبيرًا بالتقاطٍ مضيَّقٍ لكل متغيّر، والعربية تؤخذ من النهائي المراجَع **عند التطبيق** (مرور الاتساق قد يعدّلها بعد كتابة الوصفة):
//
//   [{ "en": "<نص القالب كما في النهائي>", "regex": "^{count:num} {tier:word} seat\\(s\\) available$",
//      "ar-from": "v01#183" | "t10:v06#32", "why": "<لماذا هذا الشكل آمن>", "sample": "<نصٌّ كما تعرضه الصفحة>", "nl": true?, "override": true? }]
//   ‎"override": true‎: نهائيٌّ يحلّ محلّ عربية نمطٍ قائمٍ بالتعبير نفسه (وبدونه يغلب القائم ويُذكر السبب)
//
// الرموز في التعبير: ‎{اسم:num}‎ عدد (بفاصلة الآلاف أو بدونها)، و‎{اسم:date}‎ تاريخٌ إنجليزي (‎$<اليوم> %M<الشهر>$<السنة>‎ في العربية)، و‎{اسم:token}‎
// رمزٌ بلا بياض، و‎{اسم:word}‎ قيمةٌ حتى أربعة رموز (pattern-shapes.mjs)؛ وما سواها ثابتٌ مهروب. ولا التقاطٌ حرٌّ أبدًا.
// الحرّاس عند التطبيق (كلٌّ يرفض المدخل ويسمّي السبب، ولا يُكتب منه شيء):
//   النهائي موجود ونصّه الإنجليزي هو en؛ كل متغيّرٍ في العربية له رمزٌ في التعبير، وكل رمزٍ اسمُه متغيّرٌ في en؛ لا ‎$n‎ ولا ‎%M…‎ خامٌ في العربية؛
//   التعبير مرسًى (^…$)، ومجموعاته ≤ 9، ولا التقاط إلا بالرموز، وثابتُه حروفٌ مهروبة هي نصُّ القالب نفسه (مراجعة ت14-هـ0ب)، وفي ثابته كلمةٌ من حرفين؛ ورمزان لا يفصلهما إلا بياض لا يكونان word كليهما
//   (قسمةٌ ملتبسة)؛ والعيّنة (sample) تطابق وناتجها بلا «{»؛ ولا يطابق مفتاحًا حرفيًّا في القاموس؛ ولا نصًّا من ‎--corpus‎ (نصوص الصفحة لرسائل أخرى:
//   نمطٌ أوسع من قالبه)؛ وتعبيرٌ قائمٌ بعربيةٍ أخرى يبقى (القائم يغلب).
//
//   node web/code/toolchain/manual-patterns.mjs --recipe=<file> --finals=t14=<dir>[,t10=<dir>] [--domain=app] [--corpus=<texts.json>]
//        [--check] [--report=<file>]
//   ‎--finals‎: أول مجموعةٍ هي الافتراضية لـ«<part>#<n>» (n من 1)؛ ‎--check‎ يحكم ولا يكتب القاموس.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SHAPES, normalizeIcuArgs } from "./pattern-shapes.mjs";

const { domainArg, dictFile } = await import(new URL("./domain-arg.mjs", import.meta.url).href);
const { EXT } = await import(new URL("./paths.mjs", import.meta.url).href);
await import(pathToFileURL(path.join(EXT, "cml-shared.js")).href);
const SH = globalThis.CMLShared;

const argv = process.argv.slice(2);
const opt = (k) => { const a = argv.find((x) => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : null; };
const CHECK = argv.includes("--check");
const recipeFile = opt("recipe"), finalsArg = opt("finals");
if (!recipeFile || !finalsArg) { console.error("usage: manual-patterns.mjs --recipe=<file> --finals=<set>=<dir>[,…] [--domain=app] [--corpus=<texts.json>] [--check] [--report=<file>]"); process.exit(2); }
const sets = finalsArg.split(",").map((x) => { const i = x.indexOf("="); return i > 0 ? [x.slice(0, i), x.slice(i + 1)] : ["", x]; });
const DEF = sets[0][0];
const finalsCache = new Map();
function finalOf(ref) {
  const m = /^(?:([a-z0-9]+):)?([a-z]+\d+[a-z]?)#(\d+)$/.exec(String(ref || ""));
  if (!m) return { why: "bad-ar-from" };
  const set = m[1] || DEF, dir = (sets.find((s) => s[0] === set) || [])[1];
  if (!dir) return { why: "unknown-finals-set " + set };
  const f = path.join(dir, m[2] + ".json");
  if (!finalsCache.has(f)) { try { finalsCache.set(f, JSON.parse(fs.readFileSync(f, "utf8"))); } catch { finalsCache.set(f, null); } }
  const arr = finalsCache.get(f), it = arr && arr[+m[3] - 1];
  return it && typeof it.en === "string" && typeof it.ar === "string" ? it : { why: "no-final" };
}

const DOMAIN = domainArg(process.argv);
const AR = dictFile(DOMAIN);
const dict = JSON.parse(fs.readFileSync(AR, "utf8"));
const S = dict.strings || {};
const RES = SH.toolRes(S);
const keys = Object.keys(S);
const corpusFile = opt("corpus");
const corpus = corpusFile ? JSON.parse(fs.readFileSync(corpusFile, "utf8")) : null;
const existing = new Map((dict.patterns || []).map((p) => [p.re, p]));
const recipe = JSON.parse(fs.readFileSync(recipeFile, "utf8"));
const VAR = /\{([A-Za-z_$][\w$]*)\}/g;
const TOKEN = /\{([A-Za-z_$][\w$]*):(num|date|token|word)\}/g;
const unNl = (s) => s.replace(/\\n/g, "\n");

// التعبير بالرموز ← تعبيرٌ بمجموعاتٍ مرقّمة، ولكل متغيّرٍ رقمُ مجموعته الأولى ونوعه
export function expand(rx) {
  const groups = []; // {name, kind, first}
  let g = 0, prevEnd = -1, prevKind = null, adjWords = false, out = "", at = 0;
  let mm;
  TOKEN.lastIndex = 0;
  while ((mm = TOKEN.exec(rx))) {
    const between = rx.slice(at, mm.index);
    if (prevEnd >= 0 && /^(?:\\?\s|\\u00A0)*$/.test(between) && prevKind === "word" && mm[2] === "word") adjWords = true;
    out += between + SHAPES[mm[2]];
    if (!groups.some((x) => x.name === mm[1])) groups.push({ name: mm[1], kind: mm[2], first: g + 1 });
    g += mm[2] === "date" ? 3 : 1;
    at = mm.index + mm[0].length; prevEnd = at; prevKind = mm[2];
  }
  out += rx.slice(at);
  return { re: out, groups, count: g, adjWords };
}
// الثابت: التعبير بلا رموزه، والمجموعاتُ الحرّة فيه (قوسٌ غير مهروب لا يبدأ بـ?)
function freeCaptures(rx) {
  const s = rx.replace(TOKEN, "");
  for (let i = 0; i < s.length; i++) { if (s[i] === "\\") { i++; continue; } if (s[i] === "[") { for (i++; i < s.length && s[i] !== "]"; i++) if (s[i] === "\\") i++; continue; } if (s[i] === "(" && s[i + 1] !== "?") return true; }
  return false;
}
const literalOf = (rx) => rx.replace(TOKEN, " ").replace(/\\(.)/g, "$1").replace(/^\^|\$$/g, "");
// ★ (مراجعة ت14-هـ0ب) التعبير هو القالب نفسه: ثابتُه حروفٌ مهروبة لا غير (لا محرفٌ خاص غير مهروب ولا صنفٌ كـ‎\d‎ و‎\s‎ ولا ‎(?:…)‎)، وبعد فكّ
// هروبه ووضع ‎{اسم}‎ مكان كل رمز يساوي نصَّ القالب حرفًا. وإلا كان النمط أوسع من قالبه (‎(?:.*)‎ أو ‎.+‎ في الثابت) أو لرسالةٍ غير رسالته
// والحرّاس السابقة لا ترى ذلك: freeCaptures لا تعدّ إلا الأقواس الملتقطة، والعيّنة يكتبها صاحب الوصفة. يُرجع null لثابتٍ غير حرفي
export function templateOf(rx) {
  const body = rx.replace(/^\^/, "").replace(/\$$/, "");
  const lit = (s) => {
    let o = "";
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === "\\") {
        const nx = s[i + 1];
        if (nx === "u" && /^[0-9A-Fa-f]{4}$/.test(s.slice(i + 2, i + 6))) { o += String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16)); i += 5; continue; }
        if (nx === undefined || /[A-Za-z0-9]/.test(nx)) return null; // ‎\d \s \w \b \1‎…: صنفٌ أو مرجعٌ لا حرف
        o += nx; i++; continue;
      }
      if (/[\^$.|?*+()[\]{}]/.test(ch)) return null;                // محرفٌ خاص غير مهروب: يطابق أكثر من حرفه
      o += ch;
    }
    return o;
  };
  const re = new RegExp(TOKEN.source, "g");
  let out = "", at = 0, mm;
  while ((mm = re.exec(body))) { const piece = lit(body.slice(at, mm.index)); if (piece === null) return null; out += piece + "{" + mm[1] + "}"; at = mm.index + mm[0].length; }
  const tail = lit(body.slice(at));
  return tail === null ? null : out + tail;
}

export function build(r) {
  if (!r || typeof r.en !== "string" || typeof r.regex !== "string") return { why: "bad-entry" };
  const fin = finalOf(r["ar-from"]);
  if (fin.why) return { why: fin.why };
  if (fin.en !== r.en) return { why: "final-en-differs" };
  let en = r.nl ? unNl(r.en) : r.en, ar = r.nl ? unNl(fin.ar) : fin.ar;
  const nz = normalizeIcuArgs(en, ar);
  if (nz.why) return { why: nz.why };
  en = nz.en; ar = nz.ar.trim();
  if (!ar || ar === en) return { why: "final-keeps-english" };
  if (/\$\d/.test(ar) || /%[MWPCT]\d/.test(ar)) return { why: "template-symbol" };
  const rx = r.nl ? unNl(r.regex) : r.regex;
  if (!/^\^/.test(rx) || !/\$$/.test(rx)) return { why: "not-anchored" };
  if (freeCaptures(rx)) return { why: "free-capture" };
  const tm = templateOf(rx);
  if (tm === null) return { why: "not-literal" };
  if (tm !== en.trim()) return { why: "regex-differs-from-template" };
  if (!/[A-Za-z]{2}/.test(literalOf(rx))) return { why: "no-word" };
  const ex = expand(rx);
  if (ex.adjWords) return { why: "adjacent-words" };
  if (ex.count > 9) return { why: "groups>9" };
  if (!ex.groups.length) return { why: "no-placeholder" };
  const enVars = new Set([...en.matchAll(VAR)].map((m) => m[1]));
  for (const gr of ex.groups) if (!enVars.has(gr.name)) return { why: "token-not-in-en " + gr.name };
  let bad = null;
  const arOut = ar.replace(VAR, (w, name) => {
    const gr = ex.groups.find((x) => x.name === name);
    if (!gr) { bad = "ar-name-without-token " + name; return w; }
    return gr.kind === "date" ? "$" + (gr.first + 1) + " %M" + gr.first + "$" + (gr.first + 2) : "$" + gr.first;
  });
  if (bad) return { why: bad };
  let re;
  try { re = new RegExp(ex.re); } catch { return { why: "bad-regex" }; }
  const samples = [].concat(r.sample || []).map((x) => (r.nl ? unNl(x) : x));
  for (const smp of samples) {
    const res = SH.patternApply(re, arOut, smp, RES);
    if (res === null || /[{}]/.test(res.out)) return { why: "sample-does-not-fit" };
  }
  const lit = keys.find((k) => re.test(k) && SH.patternApply(re, arOut, k, RES) !== null);
  if (lit) return { why: "matches-literal", detail: lit.slice(0, 40) };
  if (corpus) {
    const own = new Set(samples);
    const hit = corpus.find((t) => typeof t === "string" && !own.has(t) && re.test(t));
    if (hit) return { why: "matches-other-text", detail: hit.slice(0, 40) };
  }
  return { pat: { en, re: ex.re, ar: arOut } };
}

const rows = [];
const add = [];
let ok = 0, dup = 0, refused = 0, replacedN = 0;
for (const r of recipe) {
  const b = build(r);
  if (b.why) { refused++; rows.push({ "ar-from": r["ar-from"], en: String(r.en || "").slice(0, 60), status: "refused", why: b.why, detail: b.detail }); continue; }
  const ex0 = existing.get(b.pat.re);
  if (ex0) {
    if (ex0.ar === b.pat.ar) { dup++; rows.push({ "ar-from": r["ar-from"], status: "same-exists" }); }
    // ‎"override": true‎ (نهائيٌّ يحلّ محلّ عربيةٍ قائمة): تُستبدل عربية النمط ذي التعبير نفسه؛ وبدونه يغلب القائم
    else if (r.override === true) { ex0.ar = b.pat.ar; replacedN++; rows.push({ "ar-from": r["ar-from"], status: "replaced" }); }
    else { refused++; rows.push({ "ar-from": r["ar-from"], en: r.en.slice(0, 60), status: "refused", why: "existing-pattern-other-arabic" }); }
    continue;
  }
  existing.set(b.pat.re, b.pat);
  add.push(b.pat); ok++;
  rows.push({ "ar-from": r["ar-from"], status: "added" });
}
if (!CHECK && (add.length || replacedN)) {
  dict.patterns = SH.sortBySpecificity((dict.patterns || []).concat(add));
  fs.writeFileSync(AR, JSON.stringify(dict, null, 2) + "\n", "utf8");
}
const rep = opt("report");
if (rep) fs.writeFileSync(rep, JSON.stringify({ recipe: path.basename(recipeFile), added: ok, replaced: replacedN, sameExists: dup, refused, rows }, null, 1) + "\n", "utf8");
const byWhy = {};
for (const x of rows) if (x.status === "refused") byWhy[x.why.split(" ")[0]] = (byWhy[x.why.split(" ")[0]] || 0) + 1;
console.log(`manual patterns: ${recipe.length} | ${CHECK ? "would add" : "added"}: ${ok} | replaced (override): ${replacedN} | same already: ${dup} | refused: ${refused} ${JSON.stringify(byWhy)}`);
process.exit(0);
