// academy-prep.mjs — مدخلات الترجمة ت3 لأكاديمية Claude (academy.claude.com): يصنّف كل مفتاحٍ في أحدث حصاد DOM للنطاق بدليلٍ
// من الموقع نفسه، ويكتب قوائم الترجمة وأزواج المتغيّرات وما يبقى إنجليزيًّا بسببه. لا يترجم شيئًا.
//
// ★ (ر4-ب، ٢٨ ربيع الآخر ١٤٤٨هـ) لماذا أداةٌ لا تصنيفٌ باليد: الأكاديمية في 2.0.0 واجهةٌ وعناوين (القرار 69)، وقاعدة النطاق «نعرّب ما
//   تعرّبه الشركة ونُبقي ما تُبقيه» (RULES §1)، ومحتواها يتبدّل مع كل تحديثٍ للدورات — فيُعاد التصنيف مع كل حصاد (دراسة ر4 §10).
//   والأدلة كلها من الموقع:
//   ١) فهرس رسائل الواجهة الإنجليزي ‎/i18n/en.json‎ (رسائل react-intl بمعرّفاتٍ مجزَّأة): الرسالة الحرفية مفتاحٌ واحد، وذات الوسوم
//      تُقسم أجزاءً كما يراها المحرّك (عقدة نصٍّ لكل جزء)، وذات المتغيّرات زوجٌ لـgen-patterns، والجمع (ICU) باليد.
//   ٢) جداول المحتوى الإنجليزية (‎courses-*‎ و‎use-cases-*‎ و‎pathProgress-*‎ و‎collections-*‎ من شجرة وحدات ‎index-*.js‎): عناوين
//      الوحدات والأقسام (تُترجم)، والملخصات والأهداف ووصف الأقسام وبدائل اللقطات و«ما يفعله/ما تحصل عليه» (مؤجَّلةٌ إلى 3.0.0)، ونصوص
//      صفحات المجموعات (widget-copy). تُقرأ نصًّا بتعبيراتٍ نمطية ولا تُنفَّذ أبدًا.
//   ٣) لغات الموقع الأخرى تُكتشف رموزها وقت التشغيل من الموقع نفسه — ولا يُكتب رمزُ لغةٍ ولا اسمُها في أي ملف: فهارسها وجداول محتواها
//      تُجلب إلى الذاكرة وحدها، ولا يبقى منها إلا «مطابقٌ للإنجليزية في كل لغة» نعم/لا لكل معرّف — دليلُ ما تُبقيه الشركة.
//   ٤) العرض المزدوج (‎--pairs‎) لما خارج الفهرس والجداول: صفحةٌ من كل قالب تُعرض بالإنجليزية ثم بكل لغةٍ أخرى بمبدّل الموقع نفسه
//      (اللغة المحفوظة ‎academy.locale‎، دراسة ر4 §1.3؛ وللعائلات التي لها مساراتٌ مترجمة صفحةُ اللغة ‎/<رمز>/…‎ التي يقود إليها المبدّل،
//      لأن المحتوى على المسار الإنجليزي يتبع المسار) في ملف تعريفٍ جديد لكروم بلا واجهة، وتُقارن عقد النص والسمات موضعًا بموضع: ما بقي
//      حرفًا بحرف في كل لغة إنجليزيٌّ عند الشركة. يُحفظ الإنجليزي وحده مع العدّ في ‎_harvest/pairs-<الوقت>.json‎، ويُقرأ أحدثه في كل
//      تشغيلٍ بعده (ولا يُعاد العرض إلا بالوسيط).
//   ٥) القواميس المراجَعة (ar.json وar-<نطاق>.json): ترجمةٌ قائمة لنصٍّ إنجليزيٍّ مطابق تُرفق مرجعًا (ref) لاتساق R30.
//
//   NODE_USE_ENV_PROXY=1 node web/code/toolchain/academy-prep.mjs [--harvest=<حصاد.json>] [--tmp=<مجلد>] [--no-completeness] [--titles-by-scope] [--keep-only]
//   CI=true CHROME=<كروم للاختبار> NODE_USE_ENV_PROXY=1 node web/code/toolchain/academy-prep.mjs --pairs [--pages=/,/all,…] [--pairs-only] [--pair-both]
//   ‎--tmp‎: مجلدٌ يُنشأ فيه مجلد التشغيل المؤقت (افتراضه مجلد النظام المؤقت): الفهرس والجداول الإنجليزية وملف تعريف كروم فيه، ويُحذف
//        كلّه آخر كل تشغيل وعند المقاطعة. والطباعة أعدادٌ لا نصوص.
//
// النواتج (مجلد عمل النطاق glossary/academy — خارج git كلها إلا keep-en.json):
//   _ar_todo/ui-t3-todo.json           نصوص الواجهة للترجمة {en, kinds, zone, pages, count, source, ref?…}
//   _ar_todo/titles-t3-todo.json       عناوين الوحدات والأقسام بسياقها (الدورة والقسم والمجموعة)
//   _ar_todo/hub-t3-todo.json          نصوص صفحات المجموعات العشر كما يعرضها DOM
//   _ar_todo/catalogue-unseen-t3.json  رسائل الفهرس الحرفية التي لم تظهر في صفحةٍ عامة (صفحات الدخول والقوائم والحوارات)
//   _ar_todo/plurals-t3.json           رسائل الجمع (ICU) — باليد
//   _ar_todo/composites-t3.json        نصوصٌ ركّبها الموقع من رسالتين أو أكثر في عقدةٍ واحدة («13 lessons · 2 hr»)
//   _ar_todo/t3-summary.json           الأعداد والكلمات الإنجليزية، والملتبس، وعناوين التبويب، وما بقي بلا تفسير، والتغطية
//   _vars-pairs-academy-t3.json        أزواج المتغيّرات لـgen-patterns (ar فارغٌ حتى ت3؛ needsE2 لما متغيّره عنوان: ‎%T<n>‎ لم يُنفَّذ بعد)
//   keep-en.json                       (متتبَّع) نصوص الواجهة القصيرة: مدخلات اليد تبقى كما هي، ومدخلات الأداة (by: "academy-prep") يُعاد توليدها
//   _keep-en.generated.json            (خارج git، مستودع البيانات) نصوص المحتوى المتروكة: المؤجَّل والأسماء والندوات والعائلة والعناوين وما طال
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DICTS } from "./paths.mjs";
import { C, SHARED, workDir, latestHarvest } from "./domain-arg.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find((x) => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : d; };
const flag = (k) => argv.includes("--" + k);
// ‎--titles-by-scope‎: لا يُرسل للترجمة جزءُ عنوان تبويبٍ قيس أن الشركة تبقيه إنجليزيًّا (الافتراض: يُرسل، RULES §1)
const TITLES_BY_SCOPE = flag("titles-by-scope");
// ★ (ر5، ٢٩ ربيع الآخر ١٤٤٨هـ) ‎--keep-only‎: يُعاد توليد قائمتي الإبقاء وحدهما (keep-en.json و‎_keep-en.generated.json‎)، ولا تُكتب مدخلات
// الترجمة ولا أزواج المتغيّرات ولا الملخص (مدخلات ت3 المنجزة تبقى كما هي)
const KEEP_ONLY = flag("keep-only");
const D = "academy";
const DOM = C.domain(D);
if (!DOM) { console.error("! لا نطاق academy في جدول النطاقات"); process.exit(2); }
const META = DOM.meta || {};
const ORIGIN = DOM.origin;
const WD = workDir(D);
const TODO_DIR = path.join(WD, "_ar_todo");
const HV_DIR = path.join(WD, "_harvest");
const KEEP_FILE = path.join(WD, "keep-en.json");
// ★ (ر4-ب، ٢٨ ربيع الآخر ١٤٤٨هـ) نصوص المحتوى الإنجليزية المتروكة قصدًا لا تُلتزم في ملفٍّ متتبَّع: keep-en.json لنصوص الواجهة القصيرة
// (مدخلات اليد، وأسماء المنتجات والعلامات، ورسائل الفهرس التي تبقيها الشركة، والتسميات والسمات القصيرة، وأسماء النطاقات)، وما سواها
// (المؤجَّل إلى 3.0.0، وأسماء الناس، وبيانات الندوات، وعائلة سمة مخطط الدورة، والعناوين، وكل نصٍّ بطول جملة) في ملفٍّ مولَّد خارج git
// يُحفظ في مستودع البيانات، وتقرؤه بوابة الشمول بعد keep-en.json
const KEEP_GEN_FILE = path.join(WD, "_keep-en.generated.json");
const BY = "academy-prep";
const SUFFIX = " · Claude Academy", BRAND = "Claude Academy";

// ---------- مجلد التشغيل المؤقت: يُحذف آخر التشغيل وعند المقاطعة ----------
const TMP_PARENT = path.resolve(opt("tmp", os.tmpdir()));
fs.mkdirSync(TMP_PARENT, { recursive: true });
const TMP = fs.mkdtempSync(path.join(TMP_PARENT, "academy-prep-"));
let tmpGone = false, chromeLink = null;
// كروم يكتب في ملف تعريفه لحظاتٍ بعد إيقافه: الحذف يُعاد حتى يزول المجلد (انتظارٌ متزامن، فيصلح في معالج الخروج أيضًا)
function dropTmp() {
  if (tmpGone) return; tmpGone = true;
  if (chromeLink) try { fs.unlinkSync(chromeLink); } catch {}
  for (let t = 0; t < 8 && fs.existsSync(TMP); t++) {
    try { fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch {}
    if (fs.existsSync(TMP)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  if (fs.existsSync(TMP)) console.error("⚠ تعذّر حذف مجلد التشغيل المؤقت — احذفه يدويًّا: " + path.basename(TMP));
}
process.on("exit", dropTmp);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => { dropTmp(); process.exit(130); });
// خطأٌ غير ملتقط (أنبوب كروم يُغلق فجأةً مثلًا) لا يترك المجلد المؤقت خلفه
process.on("uncaughtException", (e) => { console.error("✗ " + (e && e.message)); dropTmp(); process.exit(1); });
// ملف تعريف كروم الجديد ومقبس نسخته الوحيدة داخل مجلد التشغيل المؤقت؛ ومسار المقبس محدودٌ بنحو 107 محارف في لينكس، فإن طال
// المجلد فوصلةٌ رمزيةٌ قصيرة إليه في مجلد النظام المؤقت (تُحذف معه)
function chromeTmp() {
  const dir = path.join(TMP, "chrome");
  fs.mkdirSync(dir, { recursive: true });
  if (dir.length <= 60) return dir;
  chromeLink = path.join(os.tmpdir(), "academy-prep-" + process.pid + "-" + Date.now().toString(36));
  fs.symlinkSync(dir, chromeLink);
  return chromeLink;
}

const say = (s) => console.log(s);
const wc = (s) => (String(s).match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;          // كلمات إنجليزية (كما في harvest-dom)
const wcT = (s) => wc(String(s).replace(/\{[^{}]*\}/g, " "));                         // وفي القوالب بلا أسماء المتغيّرات
const hasWord = (s) => /[A-Za-z]{2}/.test(s);                                         // ما لا حرفين لاتينيين فيه تفسّره البوابة وحدها
const norm = (s) => String(s).replace(/\s+/g, " ").trim();
// ومطبَّعٌ بعلامات الاقتباس (نشرٌ يبدّل ' بـ’ بين حصادٍ وآخر): مفتاحُ مطابقةٍ ثانٍ لا يُكتب في النواتج
const qn = (s) => norm(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 1) + "\n", "utf8"); };
const pathOfUrl = (u) => { try { return new URL(u).pathname.replace(/\/+$/, "") || "/"; } catch { return u; } };
function hijri() {
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh" })
    .format(new Date()).replace(/\s*هـ$/, "هـ");
}
// عائلة الصفحة من مسارها (سياقٌ للمترجم)
function family(p) {
  const s = p.split("/").filter(Boolean);
  if (!s.length) return "home";
  const [a, b, c] = s;
  if (a === "courses") return c ? "lesson" : b ? "course" : "courses";
  if (a === "tutorials") return b ? "tutorial" : "tutorials";
  if (a === "use-cases") return b ? "use-case" : "use-cases";
  if (a === "collections") return "collection";
  if (a === "products") return b && c ? (c === "setup" || s[3] ? "setup" : "product-kind") : "product";
  return a;
}

// ---------- الجلب (شبكة الجلسة: NODE_USE_ENV_PROXY=1) ----------
const UA = { "User-Agent": "claude-mutarjim academy-prep (public pages, build-time)" };
async function get(url, { quiet = false } = {}) {
  let err;
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(url, { headers: UA, redirect: "follow" });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.text();
    } catch (e) { err = e; await new Promise((res) => setTimeout(res, 700 * (t + 1))); }
  }
  // عنوانُ ملفّ لغةٍ أخرى لا يُطبع (فيه رمزها)
  throw new Error((quiet ? "(ملفّ لغةٍ أخرى)" : url.replace(ORIGIN, "")) + " — " + (err && err.message));
}

// ================================================================
// ١) شجرة الوحدات: من ‎index-*.js‎ (الاستيراد الثابت والديناميكي) إلى جداول المحتوى — بلا متون الدروس (‎assets/v1/content/‎)
// ولا نصوص أدواتها (‎*-copy-*‎)؛ وجداول اللغات الأخرى (‎content-<رمز>-meta-*‎) تُعرف عناوينها ولا تُتبع هنا
// ================================================================
const CONTENT_NAME = /^(courses|use-cases|pathProgress|collections)-[A-Za-z0-9_-]+\.js$/;
const LOCALE_META = /(?:^|\/)content-([A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,4})?)-meta-[A-Za-z0-9_-]+\.js$/;
const REC_RE = /\{kind:"(course|lesson|tutorial|use-case|learning-path)",id:"([^"\\]+)",/g;
async function crawl() {
  const html = await get(ORIGIN + "/");
  if (!html) throw new Error("الصفحة الرئيسة لا تُجلب");
  const em = /<script[^>]*type="module"[^>]*src="([^"]+\.js)"/.exec(html) || /<script[^>]*src="([^"]+\/index-[^"]+\.js)"/.exec(html);
  if (!em) throw new Error("لا وحدة دخول index-*.js في الصفحة الرئيسة");
  const seen = new Set(), queue = [], localeMeta = new Map(), localeMods = [];
  let files = 0, bytes = 0;
  const note = (p) => {
    if (!p || seen.has(p)) return;
    const lm = LOCALE_META.exec(p);
    if (lm) { if (lm[1].toLowerCase() !== "en" && !localeMeta.has(lm[1])) localeMeta.set(lm[1], p); return; }
    if (/\/assets\/v1\/content\//.test(p) || /-copy-[A-Za-z0-9_-]+\.js$/.test(p)) return;
    seen.add(p); queue.push(p);
  };
  for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)) note(m[1]);
  note(em[1]);
  const content = [], code = [];
  fs.mkdirSync(path.join(TMP, "content"), { recursive: true });
  while (queue.length) {
    const batch = queue.splice(0, 24);
    await Promise.all(batch.map(async (p) => {
      const s = await get(ORIGIN + p);
      if (s === null) return;
      files++; bytes += s.length;
      const base = path.posix.basename(p), dir = path.posix.dirname(p);
      if (CONTENT_NAME.test(base) && (/\{kind:"(course|lesson|tutorial|use-case|learning-path)",id:"/.test(s) || /Copy for \/collections\//.test(s))) {
        const f = path.join(TMP, "content", base);
        fs.writeFileSync(f, s, "utf8");
        content.push(f);
      }
      if (/^locale-/.test(base)) localeMods.push(s);
      code.push(s);
      const refs = new Set();
      for (const m of s.matchAll(/["'`](\.{1,2}\/[A-Za-z0-9_.\-\/]+\.js)["'`]/g)) refs.add(path.posix.normalize(path.posix.join(dir, m[1])));
      for (const m of s.matchAll(/["'`](\/assets\/[A-Za-z0-9_.\-\/]+\.js)["'`]/g)) refs.add(m[1]);
      for (const m of s.matchAll(/["'`](assets\/v1\/[A-Za-z0-9_.\-\/]+\.js)["'`]/g)) refs.add("/" + m[1]);
      for (const r of refs) note(r);
    }));
  }
  return { content: content.sort(), localeMeta, localeMods, files, bytes, code };
}

// ================================================================
// ٢) قارئ حرفيّات جافاسكربت (كائنات المحتوى في الحزمة المصغّرة) — قراءةٌ لا تنفيذ
// ================================================================
const skipWs = (s, i) => { while (i < s.length && /\s/.test(s[i])) i++; return i; };
function readStr(s, i) {
  const q = s[i]; let j = i + 1, out = "", expr = false;
  while (j < s.length && s[j] !== q) {
    const ch = s[j];
    if (ch === "\\") {
      const n = s[j + 1];
      if (n === "n") out += "\n"; else if (n === "t") out += "\t"; else if (n === "r") out += "\r";
      else if (n === "b") out += "\b"; else if (n === "f") out += "\f"; else if (n === "v") out += "\v"; else if (n === "0") out += "\0";
      else if (n === "x") { out += String.fromCharCode(parseInt(s.substr(j + 2, 2), 16)); j += 4; continue; }
      else if (n === "u") {
        if (s[j + 2] === "{") { const e = s.indexOf("}", j); out += String.fromCodePoint(parseInt(s.slice(j + 3, e), 16)); j = e + 1; continue; }
        out += String.fromCharCode(parseInt(s.substr(j + 2, 4), 16)); j += 6; continue;
      } else if (n === "\n" || n === "\r") { /* وصل سطر */ }
      else out += n;
      j += 2; continue;
    }
    if (q === "`" && ch === "$" && s[j + 1] === "{") { j = skipBalanced(s, j + 1); expr = true; continue; }
    out += ch; j++;
  }
  return { v: out, end: j + 1, expr };
}
function skipBalanced(s, j) {
  const open = s[j], close = open === "(" ? ")" : open === "[" ? "]" : "}";
  let d = 0;
  for (; j < s.length; j++) {
    const c = s[j];
    if (c === '"' || c === "'" || c === "`") { j = readStr(s, j).end - 1; continue; }
    if (c === open) d++;
    else if (c === close) { d--; if (!d) return j + 1; }
  }
  return j;
}
function lit(s, i) {
  i = skipWs(s, i);
  const c = s[i];
  if (c === "{") {
    const o = {}; i++;
    for (let guard = 0; guard < 100000; guard++) {
      i = skipWs(s, i);
      if (s[i] === "}") return { v: o, end: i + 1 };
      if (s.startsWith("...", i)) { i = lit(s, i + 3).end; i = skipWs(s, i); if (s[i] === ",") i++; continue; }
      let key;
      if (s[i] === '"' || s[i] === "'") { const r = readStr(s, i); key = r.v; i = r.end; }
      else { const m = /^[\w$]+/.exec(s.slice(i, i + 200)); if (!m) throw new Error("key@" + i); key = m[0]; i += key.length; }
      i = skipWs(s, i);
      if (s[i] === ":") { const r = lit(s, i + 1); o[key] = r.v; i = r.end; } else o[key] = undefined;
      i = skipWs(s, i);
      if (s[i] === ",") i++; else if (s[i] !== "}") throw new Error("obj@" + i);
    }
    throw new Error("obj-loop");
  }
  if (c === "[") {
    const a = []; i++;
    for (let guard = 0; guard < 100000; guard++) {
      i = skipWs(s, i);
      if (s[i] === "]") return { v: a, end: i + 1 };
      if (s[i] === ",") { a.push(undefined); i++; continue; }
      const r = lit(s, i); a.push(r.v); i = skipWs(s, r.end);
      if (s[i] === ",") i++; else if (s[i] !== "]") throw new Error("arr@" + i);
    }
    throw new Error("arr-loop");
  }
  if (c === '"' || c === "'" || c === "`") { const r = readStr(s, i); return { v: r.expr ? undefined : r.v, end: r.end }; }
  if (s.startsWith("!0", i)) return { v: true, end: i + 2 };
  if (s.startsWith("!1", i)) return { v: false, end: i + 2 };
  if (s.startsWith("void 0", i)) return { v: undefined, end: i + 6 };
  const num = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(s.slice(i, i + 40));
  if (num) return { v: +num[0], end: i + num[0].length };
  const id = /^[\w$.]+/.exec(s.slice(i, i + 300));
  if (id) {
    let j = i + id[0].length;
    while (s[j] === "(" || s[j] === "[") j = skipBalanced(s, j);
    if (s.startsWith("=>", skipWs(s, j))) throw new Error("fn@" + i);
    return { v: id[0] === "null" ? null : id[0] === "true" ? true : id[0] === "false" ? false : undefined, end: j };
  }
  throw new Error("value@" + i);
}

// ================================================================
// ٣) جداول المحتوى: سجلات الوحدات (kind/id/shared/typed) ومساراتها، ونصوص صفحات المجموعات (widget-copy)
// ================================================================
function recordsOf(s) {
  const out = [];
  for (const m of s.matchAll(REC_RE)) {
    let r; try { r = lit(s, m.index); } catch { continue; }
    const vm = /([\w$]+)=$/.exec(s.slice(Math.max(0, m.index - 64), m.index));
    out.push({ kind: m[1], id: m[2], obj: r.v || {}, fmVar: vm ? vm[1] : null });
  }
  return out;
}
// متغيّر السجل ← مسار ملفّه في academy-content (المسار يعطي الرابط والدورة)
function unitPaths(s) {
  const mod2fm = new Map(), fm2path = new Map();
  for (const m of s.matchAll(/([\w$]+)=[\w$]+\(\{[^{}]*?frontmatter:\(\)=>([\w$]+)/g)) mod2fm.set(m[1], m[2]);
  for (const m of s.matchAll(/"(?:\.\.\/)+academy-content\/([^"]+?)\.mdx":([\w$]+)(?=[,}])/g)) {
    const fm = mod2fm.get(m[2]);
    if (fm) fm2path.set(fm, m[1]);
  }
  return fm2path;
}
// نصوص widget-copy لصفحات المجموعات: slug ← Map(k ← النص)
function hubCopyOf(s) {
  const out = new Map();
  let from = 0;
  for (;;) {
    const at = s.indexOf("kind: widget-copy", from);
    if (at < 0) break;
    from = at + 10;
    const open = s.lastIndexOf("`", at);
    if (open < 0) continue;
    const r = readStr(s, open);
    if (r.end <= at) continue;
    from = r.end;
    const pm = /Copy for \/collections\/([a-z0-9-]+)/.exec(r.v);
    if (!pm) continue;
    const m = out.get(pm[1]) || new Map();
    for (const c of r.v.matchAll(/<Copy k="([^"]+)">([\s\S]*?)<\/Copy>/g)) m.set(c[1], c[2]);
    out.set(pm[1], m);
  }
  return out;
}
// وحدات المجموعة: ‎V("<slug>", e => ({… items: [{kind, slug}] …}))‎ — سياقٌ للمترجم فقط (أفضل جهد)
function collectionUnits(s, slugs) {
  const vars = new Map();
  for (const m of s.matchAll(/([\w$]+)=(\[\{kind:"[a-z-]+",slug:"[^"]+"\}(?:,\{kind:"[a-z-]+",slug:"[^"]+"\})*\])/g))
    vars.set(m[1], [...m[2].matchAll(/\{kind:"([a-z-]+)",slug:"([^"]+)"\}/g)].map((x) => x[1] + "/" + x[2]));
  const at = slugs.map((sl) => [sl, s.indexOf(`"${sl}":`)]).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]);
  const out = new Map();
  at.forEach(([sl, i], n) => {
    const seg = s.slice(i, n + 1 < at.length ? at[n + 1][1] : i + 20000);
    const units = new Set([...seg.matchAll(/\{kind:"([a-z-]+)",slug:"([^"]+)"\}/g)].map((x) => x[1] + "/" + x[2]));
    for (const v of seg.matchAll(/items:([\w$]+)[,}]/g)) for (const u of vars.get(v[1]) || []) units.add(u);
    out.set(sl, units);
  });
  return out;
}
const KIND_AR = { course: "دورة", lesson: "درس", tutorial: "شرح", "use-case": "حالة استخدام", "learning-path": "مسار تعلّم", section: "قسم دورة" };
function readContent(files) {
  const units = [], hub = new Map(), colTexts = [];
  for (const f of files) {
    const s = fs.readFileSync(f, "utf8");
    const paths = unitPaths(s);
    for (const r of recordsOf(s)) units.push({ ...r, path: r.fmVar ? paths.get(r.fmVar) || null : null });
    for (const [sl, m] of hubCopyOf(s)) hub.set(sl, m);
    if (/academy-content\/collections\/[a-z0-9-]+\.copy\.mdx/.test(s)) colTexts.push(s);
  }
  const bySlug = new Map();
  for (const u of units) {
    const sh = (u.obj && u.obj.shared) || {}, ty = (u.obj && u.obj.typed) || {};
    u.title = typeof sh.title === "string" ? sh.title : null;
    const segs = (u.path || "").split("/");
    if (u.kind === "course") { u.slug = segs[1] || null; u.url = u.slug ? "/courses/" + u.slug : null; }
    else if (u.kind === "lesson") { u.courseSlug = segs[1] || null; u.slug = (segs[3] || "").replace(/^\d+-/, "") || null; u.folder = segs[3] || null; u.url = u.courseSlug && u.slug ? `/courses/${u.courseSlug}/${u.slug}` : null; }
    else if (u.kind === "tutorial" || u.kind === "use-case") { u.slug = segs[1] || null; u.url = u.slug ? `/${segs[0]}/${u.slug}` : null; }
    else { u.slug = segs[1] || null; u.url = null; }
    u.summary = typeof sh.summary === "string" ? sh.summary : null;
    u.objectives = Array.isArray(ty.objectives) ? ty.objectives.filter((x) => typeof x === "string") : [];
    u.sections = Array.isArray(ty.sections) ? ty.sections.filter(Boolean).map((x) => ({
      title: typeof x.title === "string" ? x.title : null, description: typeof x.description === "string" ? x.description : null,
      lessons: Array.isArray(x.lessons) ? x.lessons : [], alts: (Array.isArray(x.screenshots) ? x.screenshots : []).map((y) => y && y.alt).filter((y) => typeof y === "string"),
    })) : [];
    u.what = typeof ty.what === "string" ? ty.what : null;
    u.youGet = typeof ty.youGet === "string" ? ty.youGet : null;
    u.products = Array.isArray(sh.products) ? sh.products : [];
    // حقول النص الأخرى في بيانات الوحدة (جمهور الدورة، ومتطلّباتها، ووسوم الميزات…): محتوى غير العنوان ← 3.0.0 كالملخص
    u.otherText = [];
    const SKIPK = /^(id|kind|visibility|slug|slugs|image|thumbnail|pictogram|level|roleTier|audience|primaryMedia|status|updatedAt|publicationDate|comp|indicators|tags|products|departments|industries|objectiveIds|taught|related|lessons|courseIds|prerequisitePathIds|enrichmentIds|themes|uses|connectors|required|optional|title|summary|objectives|sections|what|youGet)$/;
    (function walk(o, at) {
      if (Array.isArray(o)) { for (const x of o) walk(x, at); return; }
      if (o && typeof o === "object") { for (const [k2, v] of Object.entries(o)) if (!SKIPK.test(k2)) walk(v, at ? at + "." + k2 : k2); return; }
      if (typeof o === "string" && /[A-Za-z]{2}/.test(o) && !/^\.?\/?[\w./-]+\.(png|jpe?g|svg|webp|gif|mp4)$/i.test(o) && !/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(o)) u.otherText.push([at, o]);
    })({ shared: sh, typed: ty, migrated: (u.obj && u.obj.migrated) || {} }, "");
    if (u.slug) bySlug.set(u.kind + "/" + u.slug, u);
  }
  const courses = new Map(units.filter((u) => u.kind === "course" && u.slug).map((u) => [u.slug, u]));
  for (const u of units) if (u.kind === "lesson") {
    const c = courses.get(u.courseSlug);
    u.course = c || null;
    if (c) {
      const sec = c.sections.find((x) => x.lessons.some((l) => l === u.slug || l === u.folder || (u.slug && String(l).indexOf(u.slug + "-") === 0)));
      u.section = sec ? sec.title : null;
    }
  }
  // المجموعات التي تعرض الوحدة (سياق)
  const inCol = new Map();
  for (const s of colTexts) for (const [sl, set] of collectionUnits(s, [...hub.keys()])) for (const k of set) {
    const a = inCol.get(k) || new Set(); a.add(sl); inCol.set(k, a);
  }
  for (const u of units) u.collections = [...(inCol.get(u.kind + "/" + u.slug) || [])].sort();
  return { units, hub, bySlug };
}
// فهرسٌ للمقارنة بلغةٍ أخرى: المعرّف ← العنوان، والدورة ← عناوين أقسامها، و(المجموعة، المفتاح) ← النص
function contentIndex(text) {
  const titles = new Map(), secs = new Map();
  for (const r of recordsOf(text)) {
    const sh = (r.obj && r.obj.shared) || {}, ty = (r.obj && r.obj.typed) || {};
    if (typeof sh.title === "string") titles.set(r.id, sh.title);
    if (r.kind === "course" && Array.isArray(ty.sections)) secs.set(r.id, ty.sections.map((x) => (x && typeof x.title === "string" ? x.title : null)));
  }
  const hub = new Map();
  for (const [sl, m] of hubCopyOf(text)) for (const [k, v] of m) hub.set(sl + "\u0000" + k, v);
  return { titles, secs, hub };
}

// ================================================================
// ٤) رسائل ICU (react-intl): وسوم ‎<x>…</x>‎ ومتغيّرات ‎{x}‎ و‎{x, number}‎ وجمع ‎{x, plural, …}‎ و‎#‎ — تحليلٌ يكفي للتصنيف
// ================================================================
function parseIcu(msg) {
  let i = 0;
  function nodes(stop, inPlural) {
    const out = []; let text = "";
    const flush = () => { if (text) { out.push({ t: "text", v: text }); text = ""; } };
    while (i < msg.length) {
      const c = msg[i];
      if (c === "'") {
        if (msg[i + 1] === "'") { text += "'"; i += 2; continue; }
        if (/[{}<#]/.test(msg[i + 1] || "")) {
          let j = i + 1;
          while (j < msg.length && msg[j] !== "'") text += msg[j++];
          i = j + 1; continue;
        }
        text += c; i++; continue;
      }
      if (c === "{") { flush(); out.push(arg()); continue; }
      if (c === "}") { if (stop === "}") break; text += c; i++; continue; }
      if (c === "#" && inPlural) { flush(); out.push({ t: "pound" }); i++; continue; }
      if (c === "<") {
        const rest = msg.slice(i, i + 80);
        const cl = /^<\/([A-Za-z][\w-]*)>/.exec(rest);
        if (cl && stop === "tag:" + cl[1]) break;
        const self = /^<([A-Za-z][\w-]*)\s*\/>/.exec(rest);
        if (self) { flush(); out.push({ t: "tag", name: self[1], kids: [] }); i += self[0].length; continue; }
        const op = /^<([A-Za-z][\w-]*)>/.exec(rest);
        if (op) {
          flush(); i += op[0].length;
          const kids = nodes("tag:" + op[1], inPlural);
          const cl2 = /^<\/([A-Za-z][\w-]*)>/.exec(msg.slice(i, i + 80));
          if (cl2) i += cl2[0].length;
          out.push({ t: "tag", name: op[1], kids }); continue;
        }
      }
      text += c; i++;
    }
    flush();
    return out;
  }
  function word() { i = skipWs(msg, i); const m = /^[^\s,{}]+/.exec(msg.slice(i)); const w = m ? m[0] : ""; i += w.length; i = skipWs(msg, i); return w; }
  function arg() {
    i++;
    const name = word();
    if (msg[i] === "}") { i++; return { t: "arg", name }; }
    if (msg[i] !== ",") { const e = skipBalanced(msg, i - 1); i = e; return { t: "arg", name }; }
    i++;
    const type = word();
    if (msg[i] === "}") { i++; return { t: "arg", name, type }; }
    if (/^(plural|selectordinal|select)$/.test(type)) {
      i++; // ,
      const options = {};
      for (let g = 0; g < 200; g++) {
        i = skipWs(msg, i);
        if (msg[i] === "}") { i++; break; }
        const sel = word();
        if (/^offset:/.test(sel)) continue;
        if (msg[i] !== "{") break;
        i++;
        options[sel] = nodes("}", type !== "select");
        i++; // }
      }
      return { t: "plural", name, type, options };
    }
    // ‎{x, number, ::…}‎ وأمثالها: الأسلوب يُتخطّى
    let d = 1;
    while (i < msg.length && d) { if (msg[i] === "{") d++; else if (msg[i] === "}") d--; i++; }
    return { t: "arg", name, type };
  }
  return nodes(null, false);
}
const NUM_TYPES = /^(number|plural|selectordinal)$/;
// متغيّرٌ عدديٌّ باسمه (كما في completeness وharvest-live): يلتقط رقمًا لا كلامًا
const NUM_NAME = /^(count|n|num|number|total|percent|pct|percentage|amount|size|limit|days?|hours?|minutes?|mins?|seconds?|secs?|weeks?|months?|years?|remaining|used|max|min|index|position|price|cost|credits?|seats?|tokens?|quantity|qty|value|answered|passing|failed|passed|pending|skipped|elapsed|delta|current|completed|done|shown|correct|score|points|k|added|additions|deletions|rating)$/i;
const isNumArg = (n) => (n.type && NUM_TYPES.test(n.type)) || NUM_NAME.test(n.name);
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// أجزاء الرسالة كما يراها المحرّك: كل وسمٍ يقطع عقدة النص (فالجزء ما بين حدود الوسوم)
function fragmentsOf(ast) {
  const frags = []; let cur = [];
  const push = () => { if (cur.length) frags.push(cur); cur = []; };
  (function walk(ns) {
    for (const n of ns) {
      if (n.t === "tag") { push(); walk(n.kids); push(); }
      else cur.push(n);
    }
  })(ast);
  push();
  return frags;
}
// الجزء نصًّا بمتغيّراتٍ ‎{x}‎ (للأزواج)، وتعبيرًا نمطيًّا لمطابقة مفاتيح الحصاد، وعدد حروفه الثابتة
function simpleOf(ns, plName) {
  return ns.map((n) => n.t === "text" ? n.v : n.t === "arg" ? `{${n.name}}` : n.t === "pound" ? `{${plName || "count"}}` :
    n.t === "plural" ? `{${n.name}}` : "").join("");
}
// المتغيّر مجموعةٌ ملتقطة (لمعرفة قيمته: عنوانٌ أم لا)، والعدديّ رقمٌ وحده
function reOf(ns, inner) {
  return ns.map((n) => {
    if (n.t === "text") return escRe(n.v);
    if (n.t === "pound") return "\\d[\\d.,]*";
    if (n.t === "arg") return isNumArg(n) ? (inner ? "\\d[\\d.,]*%?" : "(\\d[\\d.,]*%?)") : inner ? ".+?" : "(.+?)";
    if (n.t === "plural") return "(?:" + Object.values(n.options).map((o) => reOf(o, true)).join("|") + ")";
    return "";
  }).join("");
}
const allNumeric = (ns) => ns.every((n) => n.t !== "arg" || isNumArg(n)) && ns.every((n) => n.t !== "plural" || Object.values(n.options).every(allNumeric));
function lettersOf(ns) {
  let n = 0;
  for (const x of ns) {
    if (x.t === "text") n += (x.v.match(/[A-Za-z]/g) || []).length;
    else if (x.t === "plural") n += Math.min(...Object.values(x.options).map((o) => lettersOf(o)));
  }
  return n;
}
const varsOfNodes = (ns, acc = []) => { for (const n of ns) { if (n.t === "arg" || n.t === "plural") acc.push(n.name); if (n.t === "plural") for (const o of Object.values(n.options)) varsOfNodes(o, acc); } return acc; };
const hasPlural = (ns) => ns.some((n) => n.t === "plural" || (n.t === "tag" && hasPlural(n.kids)));
// متغيّرٌ قيمتُه عنوانٌ (يحتاج ‎%T<n>‎ — E2)
const TITLE_VAR = /title|section|lesson|course|path|collection|unit|tutorial|usecase|heading/i;

function analyseCatalogue(cat) {
  const msgs = [];
  for (const [id, en] of Object.entries(cat)) {
    if (typeof en !== "string") continue;
    let ast; try { ast = parseIcu(en); } catch { ast = [{ t: "text", v: en }]; }
    const plural = hasPlural(ast);
    const frags = fragmentsOf(ast).map((ns) => {
      const raw = simpleOf(ns);
      // ‎display‎: الجزء للعرض على المترجم — الجمع بصيغة other («{count} lessons») لا ‎{count}‎ وحده
      const display = ns.map((n) => n.t === "plural" ? simpleOf(n.options.other || Object.values(n.options)[0] || [], n.name) : n.t === "text" ? n.v : n.t === "arg" ? `{${n.name}}` : "").join("").trim();
      return { nodes: ns, text: raw.trim(), display, vars: [...new Set(varsOfNodes(ns))], letters: lettersOf(ns), numeric: allNumeric(ns),
        re: new RegExp("^" + reOf(ns).trim() + "$"), plural: hasPlural(ns) };
    }).filter((f) => f.text);
    const rich = ast.some((n) => n.t === "tag");
    const vars = [...new Set(frags.flatMap((f) => f.vars))];
    const type = plural ? "plural" : vars.length ? (rich ? "rich-var" : "var") : rich ? "rich" : "plain";
    msgs.push({ id, en, ast, frags, rich, vars, type });
  }
  return msgs;
}

// ================================================================
// ٥) العرض المزدوج (‎--pairs‎): الإنجليزي وحده يُحفظ مع العدّ
// ================================================================
const TEMPLATES = [
  ["home", "/"], ["courses", "/courses"], ["course", "/courses/claude-101"], ["lesson", "/courses/claude-101/what-is-claude"],
  ["all", "/all"], ["tutorials", "/tutorials"], ["tutorial", "/tutorials/building-a-powerpoint-with-claude"],
  ["use-cases", "/use-cases"], ["use-case", "/use-cases/account-research-brief"], ["collection", "/collections/ai-fluency"],
  ["product", "/products/claude"], ["setup", "/products/claude/setup"], ["webinars", "/webinars"], ["login", "/login"],
  ["help", "/help/faq"],
  // صفحاتٌ بأقسامٍ لا تظهر في الأولى: دورةٌ بجمهورٍ ومتطلّبات، ودورةٌ بلقطات أقسام، وصفحة اختبار، ومراكز المنتجات الأخرى وإعدادها
  ["course-audience", "/courses/building-with-the-claude-api"], ["course-shots", "/courses/ai-capabilities-and-limitations"],
  ["quiz", "/courses/ai-capabilities-and-limitations/course-quiz"], ["product-code", "/products/code"], ["product-cowork", "/products/cowork"],
  ["product-platform", "/products/platform"], ["product-tag", "/products/tag"], ["setup-code", "/products/code/setup"],
  ["setup-cowork", "/products/cowork/setup"], ["help-mcp", "/help/mcp"],
];
function collector(skip) {
  return `(function () {
  var skip = ${JSON.stringify(skip)};
  function inSkip(el) { try { return !!(skip && el.closest && el.closest(skip)); } catch (e) { return false; } }
  var cache = new Map();
  function seg(el) { var i = 1, s = el.previousElementSibling; while (s) { if (s.nodeName === el.nodeName) i++; s = s.previousElementSibling; } return el.nodeName.toLowerCase() + i; }
  function pathOf(el) { if (cache.has(el)) return cache.get(el); var p = (el.parentElement ? pathOf(el.parentElement) + "/" : "") + seg(el); cache.set(el, p); return p; }
  function region(el) { return el.closest("[data-base-ui-portal]") ? "portal" : el.closest("header.fixed") ? "site-header" : el.closest("footer") ? "footer" : el.closest("main") ? "main" : "body"; }
  var BAD = "script,style,noscript,template,textarea,code,pre,kbd,samp";
  var out = [], counts = new Map(), tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n;
  while ((n = tw.nextNode())) {
    var p = n.parentElement; if (!p || p.closest(BAD) || p.isContentEditable || inSkip(p)) continue;
    var v = (n.nodeValue || "").trim(); if (!v) continue;
    var pp = pathOf(p), k = (counts.get(pp) || 0) + 1; counts.set(pp, k);
    out.push(["text", pp + "#" + k, v, region(p)]);
  }
  document.body.querySelectorAll("[placeholder],[aria-label],[title],[alt]").forEach(function (el) {
    if (inSkip(el)) return;
    ["placeholder", "aria-label", "title", "alt"].forEach(function (a) { var v = (el.getAttribute(a) || "").trim(); if (v) out.push(["attr:" + a, pathOf(el) + "@" + a, v, region(el)]); });
  });
  // ★ (مراجعة ر4-ب) وعنوان التبويب موضعٌ كغيره: تبقيه الشركة إنجليزيًّا في عائلاتٍ وتترجمه في أخرى
  var tt = (document.title || "").replace(/\\s+/g, " ").trim();
  if (tt) out.push(["title", "head#title", tt, "head"]);
  return { lang: document.documentElement.getAttribute("lang") || "", items: out };
})()`;
}
async function runPairs(codes, harvestPages) {
  process.env.TMPDIR = chromeTmp(); // ملف تعريف كروم الجديد داخل مجلد التشغيل المؤقت (يُحذف آخره)
  const { launch, settle } = await import(new URL("./cdp-lib.mjs", import.meta.url).href);
  // ‎--add-pages=/a,/b‎: تُعرض هذه وحدها وتُضمّ إلى أحدث ملف عرضٍ سابق (صفحاته الأخرى كما هي) — فالعرض يُستكمل ولا يُعاد كلّه
  const addOnly = opt("add-pages", "");
  const prevPairs = addOnly ? latestPairs() : null;
  const want = addOnly ? addOnly.split(",").map((p) => [TEMPLATES.find((t) => t[1] === p.trim()) ? TEMPLATES.find((t) => t[1] === p.trim())[0] : "added", p.trim()])
    : opt("pages", "") ? opt("pages", "").split(",").map((p, k) => ["page" + (k + 1), p.trim()]) : TEMPLATES;
  const known = new Set(harvestPages.map((p) => pathOfUrl(p.url)));
  const pages = want.map(([t, p]) => {
    if (!known.size || known.has(p.replace(/\/+$/, "") || "/")) return [t, p];
    const alt = [...known].find((k) => family(k) === family(p));   // صفحةٌ أخرى من العائلة إن تغيّر الموقع
    return [t, alt || p];
  });
  const cdp = await launch({ chrome: opt("chrome", "") || process.env.CHROME || undefined });
  const items = [], pageRecs = [];
  // ‎prefixed‎: صفحة اللغة نفسها ‎/<رمز><المسار>‎ (للعائلات التي لها مساراتٌ مترجمة — دراسة ر4 §1.1)؛ وإلا فاللغة المحفوظة على المسار الإنجليزي
  async function render(p, code, prefixed) {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    try {
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: code
        ? `try{localStorage.setItem("academy.locale",${JSON.stringify(code)})}catch(e){}`
        : `try{localStorage.removeItem("academy.locale")}catch(e){}` }, sessionId);
      await cdp.send("Page.navigate", { url: ORIGIN + (prefixed ? "/" + code + (p === "/" ? "" : p) : p) }, sessionId);
      await settle(cdp, sessionId, { quietMs: 2000, maxMs: 30000 });
      const mode = SHARED.routeMode(META.routes, p);
      return await cdp.evalIn(sessionId, collector(SHARED.harvestSkip(META, mode)), 60000);
    } finally { await cdp.closePage(targetId); }
  }
  // مقارنة عرضٍ بلغةٍ أخرى بالعرض الإنجليزي موضعًا بموضع. الموضع نفسه (المسار في الشجرة + نوع العقدة أو السمة) بالقيمة نفسها = باقٍ؛
  // وما لم يُطابق موضعُه يُقابَل بمواضع القيمة نفسها في العرض الآخر التي لم تُطابِق موضعها الإنجليزي (ترتيبٌ انتقل)؛ والباقي «تغيّر» —
  // فـ«Sign in» في الرأس (تغيّر) وفي بطاقة الدرس (باقٍ) يُحكم كلٌّ في موضعه ولا يستعير أحدهما الآخر. ولما تغيّر: كم محرفًا بقي من
  // أوله وآخره (عددٌ لا نصّ) — نصٌّ مركّبٌ تُبقي الشركة بعضه وتترجم بعضه
  function compare(en, lo) {
    const enAt = new Map(en.items.map((x) => [x[0] + "|" + x[1], x[2]]));
    const loAt = new Map(lo.items.map((x) => [x[0] + "|" + x[1], x[2]]));
    const spare = new Map();
    for (const x of lo.items) if (enAt.get(x[0] + "|" + x[1]) !== x[2]) { const kk = x[0] + "|" + x[2]; spare.set(kk, (spare.get(kk) || 0) + 1); }
    let aligned = 0;
    const res = en.items.map((x) => {
      const at = x[0] + "|" + x[1];
      if (loAt.has(at)) aligned++;
      if (loAt.get(at) === x[2]) return { kept: true };
      const kk = x[0] + "|" + x[2], left = spare.get(kk) || 0;
      if (left > 0) { spare.set(kk, left - 1); return { kept: true }; }
      const lv = loAt.get(at);
      if (typeof lv !== "string") return { kept: false, pre: 0, suf: 0 };
      let a = 0; while (a < x[2].length && a < lv.length && x[2][a] === lv[a]) a++;
      let b = 0; while (b < x[2].length - a && b < lv.length - a && x[2][x[2].length - 1 - b] === lv[lv.length - 1 - b]) b++;
      return { kept: false, pre: a, suf: b };
    });
    return { res, aligned };
  }
  const LOCALIZED = new Set(["home", "all", "courses", "course", "lesson", "tutorials", "tutorial", "use-cases", "use-case"]);
  try {
    for (const [tpl, p] of pages) {
      let en;
      try { en = await render(p, null, false); } catch (e) { say(`  ⚠ ${p}: تعذّر العرض الإنجليزي — ${e.message}`); continue; }
      if (!/^en(-|$)/i.test(en.lang || "en")) { say(`  ⚠ ${p}: العرض الإنجليزي ليس إنجليزيًّا — تُرك`); continue; }
      // لكل موضعٍ إنجليزي: كم لغةً بقي فيها كما هو وكم لغةً تغيّر فيها. والعائلات التي لها مساراتٌ مترجمة تُعرض بمسار اللغة نفسه: باللغة
      // المحفوظة على المسار الإنجليزي تتبع الواجهةُ اللغةَ ويتبع المحتوى المسار (دراسة ر4 §1.3) — فعناوين الأقسام ومقدّمات الصفحات من جداول
      // المحتوى كانت ستُعدّ «إنجليزيةً عند الشركة» وهي مترجمةٌ في صفحة اللغة. ‎--pair-both‎: العرضان معًا، والباقي ما بقي فيهما
      const variants = !LOCALIZED.has(family(p)) ? [false] : flag("pair-both") ? [false, true] : [true];
      const st = en.items.map(() => ({ kept: 0, changed: 0 }));
      let switched = 0, aligned = 0, total = 0;
      for (const code of codes) {
        const per = [];
        for (const prefixed of variants) {
          let lo;
          try { lo = await render(p, code, prefixed); } catch (e) { say(`  ⚠ ${p}: تعذّر عرضٌ بلغةٍ أخرى — ${String(e.message).replace(/"[^"]*"/g, "…").replace(/\/[A-Za-z-]{2,8}\//g, "/…/")}`); per.length = 0; break; }
          if (String(lo.lang || "").toLowerCase() !== code.toLowerCase()) { per.length = 0; break; }
          const c = compare(en, lo);
          lo = null; // نصوص اللغة الأخرى لا تبقى
          aligned += c.aligned; total += en.items.length;
          per.push(c.res);
        }
        if (per.length !== variants.length) continue;
        switched++;
        en.items.forEach((x, k) => {
          const rs = per.map((r) => r[k]);
          if (rs.every((r) => r.kept)) { st[k].kept++; return; }
          st[k].changed++;
          const ch = rs.filter((r) => !r.kept);
          const a = Math.min(...ch.map((r) => r.pre)), b = Math.min(...ch.map((r) => r.suf));
          st[k].pre = Math.min(st[k].pre === undefined ? a : st[k].pre, a); st[k].suf = Math.min(st[k].suf === undefined ? b : st[k].suf, b);
        });
      }
      pageRecs.push({ template: tpl, path: p, enItems: en.items.length, locales: switched, variants: variants.length, alignedPct: total ? +(100 * aligned / total).toFixed(1) : 0 });
      en.items.forEach((x, k) => items.push({ en: x[2], kind: x[0], region: x[3], page: p, kept: st[k].kept, changed: st[k].changed, of: switched,
        ...(st[k].changed ? { keptHead: st[k].pre || 0, keptTail: st[k].suf || 0 } : {}) }));
      say(`  • ${p}  [${tpl}]  ${en.items.length} موضعًا إنجليزيًّا · لغاتٌ عُرضت ${switched}/${codes.length} · عروضٌ لكل لغة ${variants.length}`);
    }
  } finally { await cdp.close(); }   // ★ (ر5) الإغلاق ينتظر خروج كروم وحذف ملف تعريفه (cdp-lib tempProfile) — بدل مهلة الثانيتين
  if (prevPairs) {
    const prev = readJson(prevPairs), done = new Set(pageRecs.map((r) => r.path));
    pageRecs.unshift(...(prev.pages || []).filter((r) => !done.has(r.path)));
    items.unshift(...(prev.items || []).filter((it) => !done.has(it.page)));
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  const out = path.join(HV_DIR, `pairs-${stamp}.json`);
  writeJson(out, { _tool: "academy-prep --pairs", domain: D, at: new Date().toISOString(), locales: codes.length,
    note: "English strings only, with counts: kept = locales where the string stayed byte-identical at its DOM position (or at a moved position of the same string) in every render of that locale (stored locale on the English path, and the locale's own path for families that have one), changed = locales where it did not; keptHead/keptTail = characters kept at the start/end of a changed string (minimum over locales).",
    pages: pageRecs, items });
  return out;
}
function latestPairs() {
  if (!fs.existsSync(HV_DIR)) return null;
  const f = fs.readdirSync(HV_DIR).filter((n) => /^pairs-.*\.json$/.test(n)).sort().pop();
  return f ? path.join(HV_DIR, f) : null;
}

// ================================================================
// ٦) أسماء اللغات (لفحص الحساسية) — تُبنى في الذاكرة من Intl.DisplayNames على كل رمزين لاتينيين، فلا يُكتب رمزٌ ولا اسم
// ================================================================
function languageNames() {
  const en = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });
  const ar = new Intl.DisplayNames(["ar"], { type: "language", fallback: "none" });
  const okEn = new Set([en.of("en"), en.of("ar")]), okAr = new Set([ar.of("en"), ar.of("ar")]);
  const A = "abcdefghijklmnopqrstuvwxyz", names = new Set(), arNames = new Set();
  for (const x of A) for (const y of A) {
    let n, a;
    try { n = en.of(x + y); a = ar.of(x + y); } catch { continue; }
    if (n && !okEn.has(n) && /^[A-Z][a-z]{3,}$/.test(n)) names.add(n);
    if (a && !okAr.has(a) && /^[\u0621-\u064A ]{4,}$/.test(a)) arNames.add(a);
  }
  return { en: [...names].map((n) => new RegExp("\\b" + n + "\\b")), ar: [...arNames].map((n) => new RegExp("(^|[^\\u0621-\\u064A])" + n + "($|[^\\u0621-\\u064A])")) };
}
const FORBID = (s) => { let n = 0; for (const ch of s) { const c = ch.codePointAt(0); if ((c >= 0x590 && c <= 0x5ff) || (c >= 0xfb1d && c <= 0xfb4f)) n++; } return n; };

// ================================================================
// التشغيل
// ================================================================
async function main() {
  const t0 = Date.now();
  say(`academy-prep — ${C.domain(D).name} (${D})`);
  // --- الحصاد ---
  const hvFile = opt("harvest", "") ? path.resolve(opt("harvest", "")) : latestHarvest(D);
  const hv = hvFile && fs.existsSync(hvFile) ? readJson(hvFile) : null;
  if (!hv && !flag("pairs-only")) { say("! لا حصاد DOM للنطاق (harvest-dom.mjs --domain=academy) — لا تصنيف"); process.exitCode = 2; return; }
  if (hv && hv.domain && hv.domain !== D) { say("! الحصاد لنطاقٍ آخر"); process.exitCode = 2; return; }

  // --- الشجرة والفهرس الإنجليزي ---
  const g = await crawl();
  say(`شجرة الوحدات: ${g.files} وحدة (${(g.bytes / 1e6).toFixed(1)} MB في الذاكرة) — جداول المحتوى الإنجليزية ${g.content.length}`);
  const enCatTxt = await get(ORIGIN + "/i18n/en.json");
  if (!enCatTxt) throw new Error("لا فهرس إنجليزي /i18n/en.json");
  fs.writeFileSync(path.join(TMP, "en.json"), enCatTxt, "utf8");
  const enCat = readJson(path.join(TMP, "en.json"));
  const ids = Object.keys(enCat);

  // --- رموز اللغات الأخرى من الموقع (الذاكرة وحدها) ---
  let cands = [...g.localeMeta.keys()];
  if (!cands.length) for (const s of g.localeMods) for (const m of s.matchAll(/\[((?:"[a-z]{2,3}(?:-[A-Za-z0-9]{2,4})?",?){3,})\]/g)) {
    const arr = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    if (arr.includes("en")) for (const c of arr) if (c !== "en" && !cands.includes(c)) cands.push(c);
  }
  const locales = [];          // [{code, cat}] — الرمز والفهرس في الذاكرة فقط
  for (const code of cands) {
    let txt; try { txt = await get(`${ORIGIN}/i18n/${code}.json`, { quiet: true }); } catch { txt = null; }
    if (!txt) continue;
    let j; try { j = JSON.parse(txt); } catch { continue; }
    if (!j || typeof j !== "object" || ids.filter((id) => own(j, id)).length < ids.length / 2) continue;
    locales.push({ code, cat: j });
  }
  if (!locales.length) throw new Error("لم تُكتشف لغةٌ أخرى للموقع — الدليل ٣ غائب");
  // لكل معرّف: مطابقٌ للإنجليزية في كل لغة؟ (وما غاب عن لغةٍ يُعدّ لا)
  const catSame = new Map(), catMissing = new Set();
  for (const id of ids) {
    let same = true;
    for (const L of locales) { if (!own(L.cat, id)) { catMissing.add(id); same = false; } else if (L.cat[id] !== enCat[id]) same = false; }
    catSame.set(id, same);
  }
  // والرسالة ذات الوسوم جزءًا جزءًا: جزءٌ يبقى حرفًا بحرف بين أجزاء رسالة كل لغة («Claude Academy» داخل ‎<block>‎ في «Sign in to …»)
  const fragSame = new Map();
  const fragTexts = (m) => { try { return fragmentsOf(parseIcu(m)).map((ns) => simpleOf(ns).trim()).filter(Boolean); } catch { return []; } };
  for (const id of ids) {
    if (typeof enCat[id] !== "string" || !/<[A-Za-z][\w-]*\s*\/?>/.test(enCat[id]) || catSame.get(id)) continue;
    for (const f of fragTexts(enCat[id])) {
      let n = 0;
      for (const L of locales) if (own(L.cat, id) && fragTexts(L.cat[id]).includes(f)) n++;
      fragSame.set(id + "\u0000" + f, n === locales.length);
    }
  }
  for (const L of locales) L.cat = null;
  const fragKept = (id, text) => catSame.get(id) || fragSame.get(id + "\u0000" + text) === true;
  say(`الفهرس: ${ids.length} رسالة · لغاتٌ أخرى ${locales.length} · مطابقٌ للإنجليزية في كلها ${[...catSame.values()].filter(Boolean).length} · غائبٌ عن لغةٍ ${catMissing.size}`);

  // --- المحتوى الإنجليزي ومقارنته بجداول اللغات الأخرى (الذاكرة وحدها) ---
  const content = readContent(g.content);
  const units = content.units;
  const enIdx = { titles: new Map(units.filter((u) => u.title).map((u) => [u.id, u.title])), secs: new Map(), hub: new Map() };
  for (const u of units) if (u.kind === "course") enIdx.secs.set(u.id, u.sections.map((x) => x.title));
  for (const [sl, m] of content.hub) for (const [k, v] of m) enIdx.hub.set(sl + "\u0000" + k, v);
  const tState = new Map(), sState = new Map(), hState = new Map();   // المعرّف ← {same, diff, miss}
  const bump = (M, k, f) => { const o = M.get(k) || { same: 0, diff: 0, miss: 0 }; o[f]++; M.set(k, o); };
  let contentLocales = 0;
  for (const L of locales) {
    const url = g.localeMeta.get(L.code);
    if (!url) continue;
    let txt; try { txt = await get(ORIGIN + url, { quiet: true }); } catch { txt = null; }
    if (!txt) continue;
    const li = contentIndex(txt);
    txt = null;
    if (!li.titles.size) continue;
    contentLocales++;
    for (const [id, t] of enIdx.titles) bump(tState, id, !li.titles.has(id) ? "miss" : li.titles.get(id) === t ? "same" : "diff");
    for (const [cid, arr] of enIdx.secs) arr.forEach((t, k) => {
      if (!t) return;
      const la = li.secs.get(cid);
      bump(sState, cid + "#" + k, !la || la[k] == null ? "miss" : la[k] === t ? "same" : "diff");
    });
    for (const [k, v] of enIdx.hub) bump(hState, k, !li.hub.has(k) ? "miss" : norm(li.hub.get(k)) === norm(v) ? "same" : "diff");
  }
  const keptBy = (M, k) => { const o = M.get(k); return !!o && contentLocales > 0 && o.same === contentLocales; };
  const missIn = (M, k) => { const o = M.get(k); return !!o && o.miss > 0; };
  say(`المحتوى: ${units.length} وحدة (${Object.entries(units.reduce((m, u) => (m[u.kind] = (m[u.kind] || 0) + 1, m), {})).map(([k, v]) => k + " " + v).join("، ")}) · نصوص المجموعات ${enIdx.hub.size} في ${content.hub.size} صفحة · جداول لغاتٍ أخرى قُورنت ${contentLocales}`);

  // --- العرض المزدوج ---
  if (flag("pairs") || flag("pairs-only") || opt("add-pages", "")) {
    const np = (opt("add-pages", "") || opt("pages", "")) ? (opt("add-pages", "") || opt("pages", "")).split(",").length : TEMPLATES.length;
    say(`العرض المزدوج: ${np} صفحة × (الإنجليزية + ${locales.length} لغة)${opt("add-pages", "") ? " — تُضمّ إلى العرض السابق" : ""}`);
    const pf = await runPairs(locales.map((L) => L.code), hv ? hv.pages || [] : []);
    say(`  ← ${path.relative(WD, pf)}`);
    if (flag("pairs-only")) { finish(t0); return; }
  }
  const pairsFile = latestPairs();
  const pairs = pairsFile ? readJson(pairsFile) : null;
  // النص ← مواضعه في العروض: باقٍ في كل لغة / تغيّر في لغةٍ على الأقل
  const pv = new Map();
  const alignOf = new Map(((pairs && pairs.pages) || []).map((p) => [p.path, p.alignedPct]));
  if (pairs) for (const it of pairs.items) {
    if (!it.of) continue;
    const o = pv.get(it.en) || { kept: 0, changed: 0, changedHi: 0, regions: new Set(), pages: new Set(), keptAt: [], changedAt: [] };
    if (it.kept === it.of) { o.kept++; o.keptAt.push(it.region + " " + it.page + " (" + it.kind + ")"); }
    else { o.changed++; if ((alignOf.get(it.page) || 0) >= 80) o.changedHi++; o.changedAt.push(it.region + " " + it.page + " (" + it.kind + ")"); }
    o.regions.add(it.region); o.pages.add(it.page);
    pv.set(it.en, o);
  }

  // --- القواميس المراجَعة (ref) ---
  const refDicts = fs.readdirSync(DICTS).filter((n) => /^ar(-[a-z]+)?\.json$/.test(n) && n !== "ar-academy.json")
    .sort((a, b) => (a === "ar.json" ? -1 : b === "ar.json" ? 1 : a.localeCompare(b)));
  const refMaps = refDicts.map((n) => [n, (readJson(path.join(DICTS, n)).strings) || {}]);
  function refOf(en) {
    const hits = [];
    for (const [n, S] of refMaps) if (own(S, en) && typeof S[en] === "string" && S[en] !== en) hits.push({ ar: S[en], from: n });
    if (!hits.length) return {};
    const alt = hits.slice(1).filter((h) => h.ar !== hits[0].ar);
    return { ref: hits[0].ar, refFrom: hits[0].from, ...(alt.length ? { refAlt: alt } : {}) };
  }

  // --- الفهرس: أجزاءٌ حرفية، ومتغيّرات، وجمع ---
  const msgs = analyseCatalogue(enCat);
  const plainFrag = new Map();      // نص الجزء ← [{id, whole?}]
  const plainFragQ = new Map();     // والمطبَّع بعلامات الاقتباس ← [{id, whole?, text}]
  const varMsgs = [], varMsgsLoose = [];   // أجزاءٌ بمتغيّرات/جمع: حروفٌ ثابتة تكفي للمطابقة وحدها، أو تكفي داخل مركّبٍ («2 hr»)
  for (const m of msgs) for (const f of m.frags) {
    if (!f.vars.length && !f.plural) {
      (plainFrag.get(f.text) || plainFrag.set(f.text, []).get(f.text)).push({ id: m.id, whole: m.rich ? m.en : null });
      (plainFragQ.get(qn(f.text)) || plainFragQ.set(qn(f.text), []).get(qn(f.text))).push({ id: m.id, whole: m.rich ? m.en : null, text: f.text });
      continue;
    }
    if (f.letters >= 3 || (f.letters >= 2 && f.numeric)) varMsgs.push({ m, f });
    if (f.letters >= 1 && f.numeric) varMsgsLoose.push({ m, f });
  }
  // «{count} {noun}» واسمُه من رسالة جمعٍ بلا # («1 quiz»، «8 quizzes»): مطابقةٌ مركّبة تُنسب إلى رسالة الجمع
  const countNoun = msgs.find((m) => m.type === "var" && /^\{count\} \{noun\}$/.test(m.en));
  for (const m of msgs) {
    if (m.type !== "plural" || m.ast.length !== 1 || m.ast[0].t !== "plural") continue;
    const opts = Object.values(m.ast[0].options);
    if (!opts.every((o) => o.every((x) => x.t === "text"))) continue;
    const forms = [...new Set(opts.map((o) => o.map((x) => x.v).join("").trim()))].filter(Boolean);
    if (!forms.length) continue;
    varMsgs.push({ m, f: { text: "{count} " + forms.join("/"), vars: ["count"], letters: 3, numeric: true, plural: true,
      re: new RegExp("^(\\d[\\d.,]*) (?:" + forms.map(escRe).join("|") + ")$") }, viaCountNoun: countNoun ? countNoun.id : null });
  }

  // --- مفردات المحتوى للمطابقة ---
  const unitTitle = new Map();      // نص ← [وحدة]
  const secTitle = new Map();       // نص ← [{course, idx}]
  const deferred = new Map();       // نص ← نوع الحقل
  const addTo = (M, k, v) => { if (typeof k !== "string" || !k.trim()) return; (M.get(k) || M.set(k, []).get(k)).push(v); };
  const DEF_AR = { summary: "ملخص وحدةٍ يظهر خارج المتن", objective: "هدف تعلّمٍ في بطاقة «ما ستتعلّمه»", sectionDesc: "وصف قسمٍ في صفحة الدورة",
    alt: "نصٌّ بديل للقطة قسمٍ في صفحة الدورة", what: "«ما يفعله» في حالة الاستخدام", youGet: "«ما تحصل عليه» في حالة الاستخدام" };
  for (const u of units) {
    if (u.title) addTo(unitTitle, qn(u.title), u);
    if (u.summary) deferred.set(qn(u.summary), deferred.get(qn(u.summary)) || "summary");
    for (const o of u.objectives) deferred.set(qn(o), deferred.get(qn(o)) || "objective");
    if (u.what) deferred.set(qn(u.what), deferred.get(qn(u.what)) || "what");
    if (u.youGet) deferred.set(qn(u.youGet), deferred.get(qn(u.youGet)) || "youGet");
    for (const [f, v] of u.otherText) if (!deferred.has(qn(v))) deferred.set(qn(v), "field:" + f);
    u.sections.forEach((sct, k) => {
      if (sct.title) addTo(secTitle, qn(sct.title), { course: u, idx: k });
      if (sct.description) deferred.set(qn(sct.description), deferred.get(qn(sct.description)) || "sectionDesc");
      for (const a of sct.alts) deferred.set(qn(a), deferred.get(qn(a)) || "alt");
    });
  }
  const hubText = new Map();        // نصٌّ مطبَّع ← [{slug, k}]
  const hubFrag = new Map();        // جزءٌ (نصٌّ فيه وسوم أو Markdown) ← [{slug, k, whole}]
  for (const [sl, m] of content.hub) for (const [k, v] of m) {
    const t = norm(v);
    addTo(hubText, qn(t), { slug: sl, k });
    if (/<[A-Za-z][^>]*>|\[[^\]]+\]\([^)]+\)|\*\*/.test(t))
      for (const part of t.replace(/\[([^\]]+)\]\([^)]+\)/g, "\u0001$1\u0001").replace(/\*\*([^*]+)\*\*/g, "\u0001$1\u0001").split(/<[^>]+>|\u0001/))
        if (norm(part)) addTo(hubFrag, qn(part), { slug: sl, k, whole: t });
  }

  // --- keep-en الحالي: مدخلات اليد ---
  const keepJ = fs.existsSync(KEEP_FILE) ? readJson(KEEP_FILE) : { _about: "", updated: "", keep: [] };
  const keepGenJ = fs.existsSync(KEEP_GEN_FILE) ? readJson(KEEP_GEN_FILE) : { keep: [] };
  // مدخلات اليد: في keep-en.json (لا تُمسّ)، وما أُضيف باليد إلى الملف المولَّد (بلا by) يبقى فيه كما هو
  const manual = (keepJ.keep || []).filter((k) => k && k.by !== BY);
  const manualGen = (keepGenJ.keep || []).filter((k) => k && k.by !== BY && !manual.some((m) => m.en === k.en));
  const manualSet = new Map(manual.concat(manualGen).map((k) => [k.en, k.why]));
  const genKeep = new Map();        // en ← why (مدخلات الأداة)
  const genCat = new Map();         // en ← صنفها (يقرّر الملف: المتتبَّع أو المولَّد)
  const addKeep = (en, why, cat) => { if (!hasWord(en) || manualSet.has(en) || genKeep.has(en)) return; genKeep.set(en, why); genCat.set(en, cat); };

  // ================================================================
  // التصنيف: كل مفتاحٍ في الحصاد في صنفٍ واحد
  // ================================================================
  const Q3 = " — افتراضٌ حتى يجيب المالك عن السؤال Q3";
  const rows = hv.keys || [];
  const hvPages = (hv.pages || []).filter((p) => !p.error && p.keys);
  const cls = new Map();            // صنف ← عدد
  const tick = (k) => cls.set(k, (cls.get(k) || 0) + 1);
  const ui = new Map(), titles = new Map(), hub = new Map(), varSeen = new Map(), composites = new Map();
  const tabs = [], ambiguous = new Map(), unverified = [];
  const patternKeys = new Set(), compositeKeys = new Set();   // نسخ الرسائل ذات المتغيّرات والمركّبات: تغطّيها الأنماط بعد ت3
  const pagesOf = (r) => (r.pages || []).map(pathOfUrl).slice(0, 5);
  const zoneOf = (en) => { const o = pvOf(en); return o ? [...o.regions].sort().join("+") : "ui"; };
  // سياق الالتباس: النص نفسه يُعرَّب في موضعٍ ويُبقى في آخر
  const amb = (en, kept, translated, note) => {
    const a = ambiguous.get(en) || { en, kept: new Set(), translated: new Set(), notes: new Set() };
    for (const x of kept) a.kept.add(x);
    for (const x of translated) a.translated.add(x);
    if (note) a.notes.add(note);
    ambiguous.set(en, a);
  };
  function pushUi(r, source, extra = {}) {
    if (r.fromPairs && source === "harvest-only") source = "pairs-only";
    const e = ui.get(r.key) || { en: r.key, kinds: r.kinds, zone: zoneOf(r.key), pages: pagesOf(r), count: r.count, source, ...extra, ...refOf(r.key) };
    ui.set(r.key, e);
    return e;
  }
  function matchVars(key, loose) {
    const hits = [];
    for (const x of loose ? varMsgs.concat(varMsgsLoose) : varMsgs) {
      const m = x.f.re.exec(key);
      if (m) hits.push({ ...x, caps: m.slice(1).filter((c) => c !== undefined) });
    }
    return hits;
  }
  const isTitleText = (c) => unitTitle.has(qn(c)) || secTitle.has(qn(c));
  // تحقّق العرض المزدوج لنصٍّ خارج الفهرس والجداول
  const pvQ = new Map();
  for (const [en, o] of pv) if (!pvQ.has(qn(en))) pvQ.set(qn(en), o);
  const pvOf = (en) => pv.get(en) || pvQ.get(qn(en)) || null;
  const pairSays = (en) => { const o = pvOf(en); if (!o) return "unseen"; return o.kept && o.changed ? "ambiguous" : o.kept ? "kept" : "translated"; };
  // في بناء الموقع الحالي؟ (نصٌّ مكتوبٌ في وحدات الواجهة) — وما ليس فيه ولا في الفهرس والجداول: أزاله نشرٌ بعد الحصاد، أو بياناتٌ من واجهةٍ برمجية
  const inCode = (str) => { const e = JSON.stringify(str).slice(1, -1); return g.code.some((c) => c.includes(str) || c.includes(e)); };
  const DOMAIN_RE = /^(?:[a-z0-9-]+\.)+(?:com|ai|org|io|dev|net)$/i;
  // سمة زرّ مخطط الدورة في صفحة الدرس: واحدةٌ لكل درس، صدرُها مكتوبٌ في الشيفرة خارج الفهرس. العرض المزدوج يقيس هل يبقى صدرها
  // حرفًا بحرف في كل لغة (keptHead) وهل تبقى كلّها
  const ARIA_FAMILY = /^Show course lessons\. /, ARIA_HEAD = "Show course lessons. ".length;
  const ariaItems = pairs ? pairs.items.filter((it) => it.of && ARIA_FAMILY.test(it.en)) : [];
  const ariaFully = ariaItems.length > 0 && ariaItems.every((it) => it.kept === it.of);
  const ariaHead = ariaItems.length > 0 && ariaItems.every((it) => it.kept === it.of || (it.keptHead || 0) >= ARIA_HEAD);
  const ariaVerified = ariaFully || ariaHead;
  let ariaKeys = 0, pickerDrift = null;
  const stale = [];   // ما ليس في بناء الموقع الحالي ولا فهرسه ولا جداوله ولا في العروض: لا يُرسل للترجمة
  const webinarsVerified = [...pv.values()].some((o) => o.pages.has("/webinars"));

  let tickPrefix = "";
  const tickP = (k) => tick(tickPrefix + k);
  for (const r of rows) classifyRow(r);
  // نصوص العروض المزدوجة التي لم يرها الحصاد (الموقع تغيّر بعده، أو حالةٌ لم تظهر): تُصنَّف بالقواعد نفسها، مصدرها «pairs-only»
  const hvKeySet = new Set(rows.map((r) => r.key));
  // ★ (مراجعة ر4-ب) وإن كان العرض المزدوج أقدم من الحصاد فنصُّه في صفحةٍ حصدها الحصاد الأحدث ولم يرها لا يُرسل للترجمة: أزاله نشرٌ، أو
  // استثناه محدِّدٌ تغيّر بعد العرض (قيمة منتقي اللغة «English» بعد ‎body [lang]‎ في ACADEMY_SKIP) — يُعدّ ويُذكر في الملخص وحده
  const pairsOlder = !!(pairs && pairs.at && hv.at && pairs.at < hv.at);
  const hvPaths = new Set(hvPages.map((p) => pathOfUrl(p.final || p.url)));
  const pairsDropped = new Map();
  tickPrefix = "pairs-only/";
  if (pairs) {
    const extra = new Map();
    for (const it of pairs.items) {
      if (hvKeySet.has(it.en) || !hasWord(it.en)) continue;
      if (pairsOlder && hvPaths.has(it.page)) {
        const d = pairsDropped.get(it.en) || { en: it.en, kinds: [], count: 0, pages: [] };
        if (!d.kinds.includes(it.kind)) d.kinds.push(it.kind);
        d.count++;
        if (d.pages.length < 3 && !d.pages.includes(it.page)) d.pages.push(it.page);
        pairsDropped.set(it.en, d);
        continue;
      }
      const e = extra.get(it.en) || { key: it.en, kinds: [], count: 0, pages: [], zone: "ui", fromPairs: true };
      if (!e.kinds.includes(it.kind)) e.kinds.push(it.kind);
      e.count++;
      if (e.pages.length < 3 && !e.pages.includes(ORIGIN + it.page)) e.pages.push(ORIGIN + it.page);
      extra.set(it.en, e);
    }
    for (const r of extra.values()) classifyRow(r);
    for (let k = 0; k < pairsDropped.size; k++) tick("pairs-only/dropped:harvest-newer");
  }
  tickPrefix = "";
  function classifyRow(r) {
    const tick = tickP;
    if (r.zone === "body") { tick("body"); return; }
    const k = r.key, n = norm(k);
    // ١) عنوان التبويب (يُشتقّ بعد ت3 ولا يُترجم وحده)
    if (k.endsWith(SUFFIX) || k.startsWith(BRAND + " · ")) { tabs.push(r); tick("tab-title"); return; }
    // ٢) لا كلمة فيه — تفسّره البوابة وحدها
    if (!hasWord(k)) { tick("no-word"); return; }
    const cat = plainFrag.get(k) || plainFrag.get(n) || plainFragQ.get(qn(k)) || null;
    const catIds = cat ? [...new Set(cat.map((x) => x.id))] : [];
    const catText = cat ? (plainFrag.has(k) ? k : plainFrag.has(n) ? n : plainFragQ.get(qn(k))[0].text) : null;
    const catKept = catIds.length > 0 && catIds.every((id) => fragKept(id, catText));
    const catTr = catIds.filter((id) => !fragKept(id, catText));
    // ٣) عنوان وحدةٍ أو قسم
    const tu = unitTitle.get(qn(k)), ts = secTitle.get(qn(k));
    if (tu || ts) {
      const all = (tu || []).map((u) => ({ kind: u.kind, keep: keptBy(tState, u.id), miss: missIn(tState, u.id) }))
        .concat((ts || []).map((x) => ({ kind: "section", keep: keptBy(sState, x.course.id + "#" + x.idx), miss: missIn(sState, x.course.id + "#" + x.idx) })));
      const keepAll = all.every((x) => x.keep);
      if (keepAll) {
        addKeep(k, `scope: عنوان ${[...new Set(all.map((x) => KIND_AR[x.kind]))].join(" و")} تبقيه الشركة بحروفه في جداول محتواها المترجمة كلها (اسمُ منتجٍ أو علامة) — قِيس بمقارنة جداول اللغات الأخرى في الذاكرة (ر4-ب)`, "title");
        tick("keep:title-company"); return;
      }
      if (all.some((x) => x.keep)) amb(k, ["عنوانٌ تبقيه الشركة في وحدةٍ"], ["ويُترجم في وحدةٍ أخرى"], "title-mixed");
      if (catIds.length && catKept) amb(k, ["رسالة فهرسٍ تبقيها الشركة"], ["عنوان وحدةٍ تترجمه الشركة"], "title-vs-catalogue");
      const prev = titles.get(k);
      const t = prev || { en: k, kinds: [], units: [], count: r.count, seen: true, pages: pagesOf(r), ...(catIds.length ? { catalogue: catIds } : {}), ...refOf(k) };
      for (const u of tu || []) if (t.units.length < 6) t.units.push({ kind: u.kind, id: u.id, ...(u.url ? { url: u.url } : {}),
        ...(u.course ? { course: u.course.title } : {}), ...(u.section ? { section: u.section } : {}), ...(u.collections.length ? { collections: u.collections } : {}) });
      for (const x of ts || []) if (t.units.length < 6) t.units.push({ kind: "section", course: x.course.title, ...(x.course.url ? { url: x.course.url } : {}) });
      t.kinds = [...new Set(t.kinds.concat(all.map((x) => x.kind)))];
      if (all.some((x) => x.miss)) t.missingInSomeLocale = true;
      titles.set(k, t);
      tick("title"); return;
    }
    // ٤) رسالةٌ حرفية من الفهرس (أو جزءٌ من رسالةٍ بوسوم)
    if (catIds.length) {
      if (catKept) {
        const p = pairSays(k);
        // (وتغيّرُ بعض مواضعه لا يكفي: اسم المنتج يدخل جملًا مترجمة فينقص عدد مواضعه في صفحة اللغة الأخرى)
        // وصفحةٌ ضعيفة المحاذاة (بنيةُ صفحة اللغة غير بنية الإنجليزية) لا تشهد وحدها
        if (p === "translated" && pvOf(k).changedHi > 0) amb(k, ["رسالة فهرسٍ مطابقة للإنجليزية في كل لغة"], ["كل مواضعه تغيّرت في العرض المزدوج"], "catalogue-vs-pairs");
        addKeep(k, `scope: ${cat.some((x) => x.whole) ? "جزءٌ من رسالةٍ" : "رسالةٌ"} في فهرس رسائل الواجهة (${catIds.join("، ")}) تبقيها الشركة بالإنجليزية في عروضها المترجمة كلها — قِيس بمقارنة فهارس اللغات الأخرى في الذاكرة (ر4-ب)${Q3}`, "catalogue");
        tick("keep:catalogue-company"); return;
      }
      if (catIds.some((id) => fragKept(id, catText))) amb(k, catIds.filter((id) => fragKept(id, catText)).map((id) => "رسالة فهرس " + id + " مطابقة في كل لغة"), catTr.map((id) => "رسالة فهرس " + id + " مترجمة"), "catalogue-duplicate");
      const ps = pairSays(k);
      if (ps === "ambiguous" || ps === "kept") {
        const o = pvOf(k);
        amb(k, o.keptAt.slice(0, 4), ["رسالة فهرس مترجمة: " + catTr.join("، ")].concat(o.changedAt.slice(0, 3)), "pairs-kept-somewhere");
      }
      if (manualSet.has(k)) amb(k, ["مدخلٌ يدويّ في keep-en: " + manualSet.get(k).slice(0, 60)], ["رسالة فهرس مترجمة: " + catTr.join("، ")], "keep-en-vs-catalogue");
      const whole = cat.find((x) => x.whole);
      pushUi(r, "catalogue:" + catTr[0], { ...(catTr.length > 1 ? { ids: catTr } : {}), ...(whole ? { fragmentOf: whole.whole } : {}),
        ...(ambiguous.has(k) ? { ambiguous: true } : {}), ...(manualSet.has(k) ? { inKeepEn: true } : {}) });
      tick("ui:catalogue"); return;
    }
    // ٥) نصوص صفحات المجموعات (قبل المؤجَّل: عنوان صفحة المجموعة قد يساوي وسم موضوعٍ في بيانات وحدة)
    const hx = hubText.get(qn(k)) || hubFrag.get(qn(k));
    if (hx) {
      const keys = hx.map((x) => x.slug + "\u0000" + x.k);
      if (keys.every((kk) => keptBy(hState, kk))) {
        addKeep(k, `scope: من نصوص صفحة المجموعة ‎/collections/${hx[0].slug}‎ (${hx[0].k}) تبقيه الشركة بالإنجليزية في جداول محتواها المترجمة كلها — قِيس في الذاكرة (ر4-ب)${Q3}`, "hub");
        tick("keep:hub-company"); return;
      }
      const e = hub.get(k) || { en: k, page: "/collections/" + hx[0].slug, k: hx[0].k, kinds: r.kinds, count: r.count, pages: pagesOf(r), seen: !r.fromPairs,
        ...(hx.length > 1 ? { also: hx.slice(1, 6).map((x) => "/collections/" + x.slug + " " + x.k) } : {}), ...(hx[0].whole ? { fragmentOf: hx[0].whole } : {}),
        ...(keys.some((kk) => missIn(hState, kk)) ? { missingInSomeLocale: true } : {}), ...refOf(k) };
      hub.set(k, e);
      tick("hub"); return;
    }
    // ٦) مؤجَّلٌ إلى 3.0.0 (القرار 69)
    if (deferred.has(qn(k))) {
      const fld = deferred.get(qn(k));
      if (/(owner|author)$/i.test(fld)) { addKeep(k, `name: اسم شخصٍ في بيانات الوحدة (‎${fld.slice(6)}‎) يبقى بحروفه — ر4-ب`, "name"); tick("keep:name"); return; }
      addKeep(k, `deferred: 3.0.0 (decision 69) — ${DEF_AR[fld] || "حقل ‎" + fld.slice(6) + "‎ من بيانات الوحدة (محتوى غير العنوان)"}`, "deferred");
      tick("keep:deferred"); return;
    }
    // ٧) نسخةٌ من رسالةٍ بمتغيّرات أو جمع (نمطٌ بعد ت3)
    const vh = matchVars(k);
    if (vh.length) {
      for (const x of vh) {
        const o = varSeen.get(x.m.id) || { count: 0, keys: 0, examples: [], titleCaps: 0 };
        o.count += r.count; o.keys++;
        if (o.examples.length < 2 && !o.examples.includes(k)) o.examples.push(k);
        if (x.caps.some(isTitleText)) o.titleCaps++;
        varSeen.set(x.m.id, o);
        if (x.viaCountNoun) { const c = varSeen.get(x.viaCountNoun) || { count: 0, keys: 0, examples: [], titleCaps: 0 }; c.count += r.count; c.keys++; if (c.examples.length < 2) c.examples.push(k); varSeen.set(x.viaCountNoun, c); }
      }
      patternKeys.add(k);
      tick(vh.some((x) => x.f.plural) ? "vars:plural-instance" : vh.some((x) => x.caps.some(isTitleText)) ? "vars:instance-title(E2)" : "vars:instance"); return;
    }
    // ٨) مركّبٌ من رسالتين أو أكثر في عقدةٍ واحدة («13 lessons · 2 hr»)
    const parts = k.split(/ · | — | \| /);
    if (parts.length > 1) {
      // شكل المركّب: رقمٌ ‎{n}‎، ورسالةٌ حرفية بنصّها، وعنوانٌ ‎{title}‎، ورسالةٌ بمتغيّرات بقالبها — والمعرّفات في ids
      const ids = [];
      const shape = parts.map((p) => {
        if (!hasWord(p)) return p.replace(/\d[\d.,]*/g, "{n}");
        const pf = plainFrag.get(p); if (pf) { ids.push(pf[0].id); return p; }
        if (unitTitle.has(qn(p)) || secTitle.has(qn(p))) return "{title}";
        const vv = matchVars(p, true); if (vv.length) { ids.push(vv[0].m.id); return vv[0].f.display || vv[0].f.text; }
        return null;
      });
      if (shape.every((x) => x !== null)) {
        const sep = k.match(/ · | — | \| /g) || [];
        const sh = shape.map((x, j) => x + (j < sep.length ? sep[j] : "")).join("");
        const o = composites.get(sh) || { shape: sh, ids: [...new Set(ids)], count: 0, keys: 0, examples: [], needsE2: shape.includes("{title}") };
        o.count += r.count; o.keys++; if (o.examples.length < 3) o.examples.push(k);
        composites.set(sh, o);
        compositeKeys.add(k);
        tick("composite"); return;
      }
    }
    // ٩) خارج الفهرس والجداول: العرض المزدوج يحكم
    if (ARIA_FAMILY.test(k) && ariaVerified) {
      // (سببٌ قصير: 497 مدخلًا، والتفصيل في t3-summary.json ‎ambiguous‎)
      addKeep(k, ariaFully
        ? "scope: سمة aria-label لزرّ مخطط الدورة، واحدةٌ لكل درس («Show course lessons. …» مكتوبٌ في الشيفرة) — تبقيه الشركة بالإنجليزية في كل لغة (عرضٌ مزدوج، ر4-ب)" + Q3
        : "scope: سمة aria-label لزرّ مخطط الدورة، واحدةٌ لكل درس («Show course lessons. …»): صدرها تبقيه الشركة بالإنجليزية في كل لغة وتترجم موضع الدرس فيها — نصٌّ مركّب يبقى كلّه إنجليزيًّا في 2.0.0 (عرضٌ مزدوج، ر4-ب؛ التفصيل في t3-summary)", "aria");
      ariaKeys++;
      tick("keep:aria-family"); return;
    }
    if (DOMAIN_RE.test(k)) { addKeep(k, "brand: اسم نطاقٍ في نصّ رابط (عنوان موقع) يبقى بحروفه كما يُكتب — ر4-ب", "domain"); tick("keep:domain"); return; }
    // قيمة منتقي اللغة في التذييل (اسم لغة الواجهة الحالية ‎span[lang=en]‎): أُريد لها الاستثناء في ACADEMY_SKIP، ومحدِّدها لم يعد يطابق
    // المنتقي الجديد بعد نشر الموقع (زرٌّ يفتح حوارًا بدل ‎[role=combobox]‎) — تبقى كما هي، والانجراف في الملخص
    if (k === "English" && (r.kinds || []).includes("text") && !r.fromPairs) {
      pickerDrift = { key: k, count: r.count, pages: pagesOf(r).slice(0, 3) };
      addKeep(k, "scope: القيمة الحالية لمنتقي لغة الموقع في التذييل (اسم لغة الواجهة) — أُريد لها الاستثناء في ACADEMY_SKIP، ومحدِّدها ‎footer [role=combobox] > span:first-child‎ لم يعد يطابق المنتقي بعد نشر الموقع الجديد (ر4-ب)؛ تبقى كما هي حتى يُصلَح المحدِّد", "picker");
      tick("keep:picker-value"); return;
    }
    const ps = pairSays(k);
    const onlyWebinars = (r.pages || []).length > 0 && (r.pages || []).every((u) => pathOfUrl(u) === "/webinars");
    if (manualSet.has(k)) {
      if (ps === "translated" || ps === "ambiguous") { const o = pvOf(k); amb(k, ["مدخلٌ يدويّ في keep-en"].concat(o.keptAt.slice(0, 3)), o.changedAt.slice(0, 4), "keep-en-vs-pairs"); }
      tick("keep:manual"); return;
    }
    if (ps === "kept") {
      const o = pvOf(k);
      // بيانات الندوات (صفحة ‎/webinars‎، وبطاقاتها في الرئيسة ومراكز المنتجات): عناوينُ وأوصافٌ ومواعيد، وأسماء المتحدّثين (سمة alt
      // لصورة المتحدّث، أو اسمٌ من كلمتين إلى أربع بحروفٍ كبيرة)
      if (onlyWebinars || o.pages.has("/webinars")) {
        const isName = ((r.kinds || []).length === 1 && r.kinds[0] === "attr:alt") ||
          (/^[A-Z][a-zA-Z'’.-]+(?: [A-Z][a-zA-Z'’.-]+){1,3}$/.test(k) && !/\b(AI|Claude|Code|Cowork|Webinar|Live|Series|Session|Advanced|Foundations|Building|Measuring|Your|With|For|The|And|On|In|To|Of|A)\b/.test(k));
        addKeep(k, isName ? "name: اسم متحدّثٍ في صفحة الندوات يبقى بحروفه — وتبقيه الشركة كذلك في عروضها المترجمة كلها (عرضٌ مزدوج، ر4-ب)"
          : "scope: من بيانات الندوات في ‎/webinars‎ (عنوانٌ أو وصفٌ أو موعد) — تبقيها الشركة بالإنجليزية في عروضها المترجمة كلها (عرضٌ مزدوج لصفحة ‎/webinars‎، ر4-ب)" + Q3, isName ? "name" : "webinar");
        tick(isName ? "keep:webinar-name" : "keep:webinar"); return;
      }
      if ((r.kinds || []).length === 1 && r.kinds[0] === "attr:alt" && /^[A-Z][a-zA-Z'’.-]+(?: [A-Z][a-zA-Z'’.-]+){1,3}$/.test(k)) {
        addKeep(k, `name: اسم شخصٍ (نصٌّ بديل لصورته) يبقى بحروفه — وتبقيه الشركة كذلك في عروضها المترجمة كلها (عرضٌ مزدوج للصفحة ‎${[...o.pages][0]}‎، ر4-ب)`, "name");
        tick("keep:name"); return;
      }
      addKeep(k, `scope: نصٌّ خارج فهرس الرسائل تبقيه الشركة بالإنجليزية في عروضها المترجمة كلها — قِيس بعرضٍ مزدوج للصفحة ‎${[...o.pages][0]}‎ بكل لغةٍ أخرى (ر4-ب)${Q3}`, "pairs");
      tick("keep:pairs-company"); return;
    }
    if (ps === "ambiguous") {
      const o = pvOf(k);
      amb(k, o.keptAt.slice(0, 4), o.changedAt.slice(0, 4), "pairs-mixed");
      pushUi(r, "harvest-only", { ambiguous: true });
      tick("ui:harvest-ambiguous"); return;
    }
    // ★ (مراجعة ر4-ب) «تغيّر» في صفحاتٍ ضعيفة المحاذاة وحدها (صفحة اللغة بقالبٍ غير قالب الإنجليزية: ‎/tutorials‎ و‎/use-cases‎) غيابٌ لا ترجمة:
    // النص بلا نظيرٍ في عرض اللغة الأخرى — فيُرسل «لم يُتحقَّق» كالذي لم يظهر في العروض
    if (ps === "translated" && !pvOf(k).changedHi) { pushUi(r, "harvest-only", { verified: false, weakPairs: true }); unverified.push(k); tick("ui:harvest-unverified(weak-pairs)"); return; }
    if (ps === "translated") { pushUi(r, "harvest-only"); tick("ui:harvest-translated"); return; }
    if (onlyWebinars && webinarsVerified) {
      // صفحة الندوات عُرضت ولم يظهر فيها النص (بياناتٌ تتبدّل): تُعامل كبيانات الندوات
      addKeep(k, "scope: من بيانات الندوات في ‎/webinars‎ (عنوانٌ أو وصفٌ أو متحدّث) — تبقيها الشركة بالإنجليزية في عروضها المترجمة كلها (عرضٌ مزدوج لصفحة ‎/webinars‎، ر4-ب)" + Q3, "webinar");
      tick("keep:webinar"); return;
    }
    // لم يظهر في العروض: يُرسل للترجمة موسومًا «لم يُتحقَّق» (الأصل في نصّ الموقع أن يُعرَّب)
    if (!inCode(k)) { stale.push({ en: k, kinds: r.kinds, pages: pagesOf(r), count: r.count }); tick("stale:not-in-build"); return; }
    pushUi(r, "harvest-only", { verified: false, inCode: true });
    unverified.push(k);
    tick("ui:harvest-unverified");
  }
  if (ariaKeys && !ariaFully) amb("Show course lessons. {title} — Lesson {number} of {count} · {course}",
    ["صدرها «Show course lessons.» مكتوبٌ في الشيفرة وتبقيه الشركة في كل لغة (عرضٌ مزدوج)"],
    ["«Lesson N of M» فيها من فهرس الرسائل تترجمه الشركة، والعنوانان يتبعان المسار"], "mixed-string:" + ariaKeys + " keys");
  // ---------- رسائل الفهرس المطابقة في كل لغة ولم تظهر في الحصاد: تبقى إنجليزيةً كذلك (للفهرس كله، دراسة ر4 §6.4) ----------
  const hvKeys = new Set(rows.map((r) => r.key));
  for (const m of msgs) if (m.type !== "plural") for (const f of m.frags) {
    if (!fragKept(m.id, f.text) || f.vars.length || !hasWord(f.text) || hvKeys.has(f.text)) continue;
    addKeep(f.text, `scope: ${m.rich ? "جزءٌ من رسالةٍ" : "رسالةٌ"} في فهرس رسائل الواجهة (${m.id}) تبقيها الشركة بالإنجليزية في عروضها المترجمة كلها — قِيس بمقارنة فهارس اللغات الأخرى في الذاكرة؛ لم تظهر في صفحةٍ عامة (ر4-ب)${Q3}`, "catalogue");
  }

  // ================================================================
  // القوائم
  // ================================================================
  // العناوين التي لم تظهر في الحصاد (صفحاتٌ لم تُحصد أو وحداتٌ لا تُعرض): تُضاف كلها (القرار الافتراضي ١: العناوين كلها)
  const seenTitles = new Set([...titles.keys()].map(qn));
  const keepNow = new Map([...manualSet, ...genKeep]);
  for (const u of units) {
    if (!u.title || seenTitles.has(qn(u.title)) || keepNow.has(u.title) || ui.has(u.title)) continue;
    if (keptBy(tState, u.id)) { addKeep(u.title, `scope: عنوان ${KIND_AR[u.kind]} تبقيه الشركة بحروفه في جداول محتواها المترجمة كلها (اسمُ منتجٍ أو علامة) — قِيس بمقارنة جداول اللغات الأخرى في الذاكرة (ر4-ب)`, "title"); continue; }
    const t = titles.get(u.title) || { en: u.title, kinds: [], units: [], count: 0, seen: false, pages: [], ...refOf(u.title) };
    if (t.units.length < 6) t.units.push({ kind: u.kind, id: u.id, ...(u.url ? { url: u.url } : {}), ...(u.course ? { course: u.course.title } : {}),
      ...(u.section ? { section: u.section } : {}), ...(u.collections.length ? { collections: u.collections } : {}) });
    if (!t.kinds.includes(u.kind)) t.kinds.push(u.kind);
    if (missIn(tState, u.id)) t.missingInSomeLocale = true;
    titles.set(u.title, t);
  }
  for (const u of units) if (u.kind === "course") u.sections.forEach((sct, k) => {
    if (!sct.title || titles.has(sct.title) || keepNow.has(sct.title) || genKeep.has(sct.title) || ui.has(sct.title)) return;
    if (keptBy(sState, u.id + "#" + k)) { addKeep(sct.title, `scope: عنوان قسم دورة تبقيه الشركة بحروفه في جداول محتواها المترجمة كلها — قِيس بمقارنة جداول اللغات الأخرى في الذاكرة (ر4-ب)`, "title"); return; }
    titles.set(sct.title, { en: sct.title, kinds: ["section"], units: [{ kind: "section", course: u.title, ...(u.url ? { url: u.url } : {}) }], count: 0, seen: false, pages: [], ...refOf(sct.title) });
  });
  // نصوص المجموعات التي لم يرها الحصاد (صفحةٌ جديدة بعد الحصاد، أو حالةٌ لا تظهر): تُضاف بنصّها المطبَّع، seen:false
  for (const [sl, m] of content.hub) for (const [kk, v] of m) {
    const t = norm(v), key = sl + "\u0000" + kk;
    const marked = /<[A-Za-z][^>]*>|\[[^\]]+\]\([^)]+\)|\*\*/.test(t);
    const frags = marked ? t.replace(/\[([^\]]+)\]\([^)]+\)/g, "\u0001$1\u0001").replace(/\*\*([^*]+)\*\*/g, "\u0001$1\u0001").split(/<[^>]+>|\u0001/).map(norm).filter(Boolean) : [t];
    for (const f of frags) {
      if (!hasWord(f) || hub.has(f) || ui.has(f) || titles.has(f) || keepNow.has(f) || genKeep.has(f) || hvKeySet.has(f)) continue;
      if (keptBy(hState, key)) { addKeep(f, `scope: من نصوص صفحة المجموعة ‎/collections/${sl}‎ (${kk}) تبقيه الشركة بالإنجليزية في جداول محتواها المترجمة كلها — قِيس في الذاكرة؛ لم يظهر في الحصاد (ر4-ب)${Q3}`, "hub"); continue; }
      hub.set(f, { en: f, page: "/collections/" + sl, k: kk, kinds: [], count: 0, pages: [], seen: false, ...(marked ? { fragmentOf: t } : {}),
        ...(missIn(hState, key) ? { missingInSomeLocale: true } : {}), ...refOf(f) });
    }
  }
  const KORDER = ["course", "section", "lesson", "tutorial", "use-case", "learning-path"];
  const titleList = [...titles.values()].map((t) => ({ ...t, kind: KORDER.find((x) => t.kinds.includes(x)) || t.kinds[0] }))
    .sort((a, b) => KORDER.indexOf(a.kind) - KORDER.indexOf(b.kind) || ((a.units[0] && a.units[0].course) || a.en).localeCompare((b.units[0] && b.units[0].course) || b.en) || a.en.localeCompare(b.en))
    .map(({ kind, kinds, ...t }) => ({ en: t.en, kind, ...(kinds.length > 1 ? { kinds } : {}), ...t }));

  const SORDER = (s) => (s.startsWith("catalogue:") ? 0 : 1);
  let uiList = [...ui.values()].sort((a, b) => SORDER(a.source) - SORDER(b.source) || b.count - a.count || a.en.localeCompare(b.en));
  const hubList = [...hub.values()].sort((a, b) => a.page.localeCompare(b.page) || b.count - a.count);

  // رسائل الفهرس الحرفية التي لم تظهر (صفحات الدخول والقوائم والحوارات) — لا ما تبقيه الشركة
  const inLists = new Set([...ui.keys(), ...titles.keys(), ...hub.keys()]);
  const unseen = new Map();
  for (const m of msgs) {
    if (m.type === "plural" || catSame.get(m.id)) continue;
    for (const f of m.frags) {
      if (f.vars.length || f.plural || !hasWord(f.text) || fragKept(m.id, f.text) || hvKeys.has(f.text) || inLists.has(f.text) || keepNow.has(f.text) || genKeep.has(f.text)) continue;
      const e = unseen.get(f.text) || { en: f.text, kinds: [], zone: "signed-in-or-hidden", pages: [], count: 0, source: "catalogue:" + m.id, ...(m.rich ? { fragmentOf: m.en } : {}), ...refOf(f.text) };
      if (e.source !== "catalogue:" + m.id) e.ids = [...new Set((e.ids || [e.source.slice(10)]).concat(m.id))];
      unseen.set(f.text, e);
    }
  }
  const unseenList = [...unseen.values()].sort((a, b) => a.en.localeCompare(b.en));

  // أزواج المتغيّرات (الرسائل بلا جمع) — جزءًا جزءًا كما يراها المحرّك
  const varsPairs = [];
  for (const m of msgs) {
    if (m.type === "plural") continue;
    for (const f of m.frags) {
      if (!f.vars.length) continue;
      const seen = varSeen.get(m.id);
      // متغيّرٌ قيمتُه عنوان: باسمه، أو بدليل الحصاد (قيمةٌ ملتقطة هي عنوان وحدةٍ أو قسم)
      const titleVars = f.vars.filter((v) => TITLE_VAR.test(v) || (v === "page" && !/\{page\} of/.test(f.text)) || (v === "item" && /video/i.test(f.text)));
      const byEvidence = !!(seen && seen.titleCaps);
      varsPairs.push({ en: f.text, ar: "", id: m.id, ...(f.text !== m.en ? { icu: m.en } : {}), seen: !!seen, count: seen ? seen.count : 0,
        ...(seen ? { keys: seen.keys, examples: seen.examples } : {}), ...(titleVars.length || byEvidence ? { needsE2: true, titleVars: titleVars.length ? titleVars : ["(بدليل الحصاد)"] } : {}),
        ...(catSame.get(m.id) ? { companySame: true } : {}), ...(f.letters < 3 && !(f.letters >= 2 && f.numeric) ? { templateOnly: true } : {}) });
    }
  }
  // رسالتان بنصٍّ إنجليزيٍّ واحد (معرّفان) زوجٌ واحد — gen-patterns كان سيعدّ الثاني «مكررًا»
  {
    const byEn = new Map();
    for (const v of varsPairs) {
      const o = byEn.get(v.en);
      if (!o) { byEn.set(v.en, v); continue; }
      o.ids = [...new Set((o.ids || [o.id]).concat(v.id))];
      o.seen = o.seen || v.seen; o.count = Math.max(o.count, v.count);
      if (v.examples && !o.examples) o.examples = v.examples;
      if (v.needsE2) { o.needsE2 = true; o.titleVars = [...new Set((o.titleVars || []).concat(v.titleVars || []))]; }
      if (!v.companySame) delete o.companySame;
    }
    varsPairs.length = 0; varsPairs.push(...byEn.values());
  }
  // قالب عائلة سمة مخطط الدورة (خارج الفهرس): نمطٌ واحد مع E2 يُبقي صدرها الإنجليزي كما تفعل الشركة
  if (ariaKeys) varsPairs.push({ en: "Show course lessons. {title} — Lesson {number} of {count} · {course}", ar: "", id: "harvest-family:show-course-lessons",
    seen: true, count: ariaKeys, keys: ariaKeys, needsE2: true, titleVars: ["title", "course"], companyKeepsHead: "Show course lessons.",
    note: "aria-label مكتوبٌ في الشيفرة خارج الفهرس؛ مُستبقًى في keep-en حتى يُقرَّر E2" });
  const plurals = msgs.filter((m) => m.type === "plural").map((m) => {
    const pl = []; (function walk(ns) { for (const n of ns) { if (n.t === "plural") pl.push(n); if (n.t === "tag") walk(n.kids); } })(m.ast);
    const seen = varSeen.get(m.id);
    return { id: m.id, en: m.en, arg: pl.map((p) => p.name).join(","), forms: Object.fromEntries(pl.flatMap((p) => Object.entries(p.options).map(([k, ns]) => [k, simpleOf(ns, p.name)]))),
      seen: !!seen, count: seen ? seen.count : 0, ...(seen ? { examples: seen.examples } : {}), ...(catSame.get(m.id) ? { companySame: true } : {}) };
  });
  const compList = [...composites.values()].sort((a, b) => b.count - a.count);

  // ================================================================
  // عناوين التبويب (البند ٤): (أ) بادئةٌ تُترجم + لاحقةٌ تبقى، (ب) حرفيٌّ كاملٌ مشتقٌّ بعد ت3
  // ================================================================
  const dictAc = (readJson(path.join(DICTS, "ar-academy.json")).strings) || {};
  const willHave = (p) => ui.has(p) || titles.has(p) || hub.has(p) || unseen.has(p) || own(dictAc, p);
  const isKept = (p) => p === BRAND || keepNow.has(p) || genKeep.has(p);
  // جزءٌ من عنوان تبويبٍ ليس في القوائم ولا في القاموس ولا مُستبقًى (وسم الرئيسة، وعناوين صفحات المساعدة ومراكز المنتجات): يُضاف إلى قائمة
  // الواجهة («tab-title-part») حتى يكتمل المشتقّ بعد ت3 — والعنوان المركّب لا يُترجم بعضه (RULES §1)
  // ★ (مراجعة ر4-ب) بشرط أن يُقاس أن الشركة تترجم ذلك العنوان (document.title في العرض المزدوج): قِيس أنها تبقي عناوين التبويب إنجليزيةً في
  // كل لغة في صفحات اللغة المحفوظة (المجموعات ومراكز المنتجات وإعدادها والندوات والدخول والمساعدة) وفي ‎/courses‎ ووسم الرئيسة — فالجزء
  // الذي لا يظهر إلا في عنوانٍ تبقيه الشركة، أو في عنوانٍ لم يُقَس، لا يُرسل للترجمة ويُذكر في الملخص
  const tabStat = { total: tabs.length, prefix2: 0, prefix2Ready: 0, prefix2Kept: 0, prefix2Queued: 0, derived: 0, derivedReady: 0, derivedQueued: 0, queuedParts: 0, stale: 0, sample: [],
    measured: { kept: 0, translated: 0, ambiguous: 0, unseen: 0 }, companyKeeps: [], partsNotQueued: [] };
  const tabPart = new Map();
  for (const r of tabs) {
    const k = r.key;
    const tv = pairSays(k);
    tabStat.measured[tv]++;
    if (tv === "kept" && tabStat.companyKeeps.length < 40) tabStat.companyKeeps.push(k);
    const parts = (k.endsWith(SUFFIX) ? k.slice(0, -SUFFIX.length).split(" · ") : k.split(" · ")).map((x) => x.trim()).filter(Boolean);
    const body = parts.filter((x) => x !== BRAND);
    const missing = body.filter((x) => !willHave(x) && !isKept(x) && hasWord(x));
    // جزءٌ ليس في بناء الموقع الحالي: عنوانُ صفحةٍ غيّرها النشر بعد الحصاد — لا يُرسل للترجمة
    if (missing.some((x) => !inCode(x))) { stale.push({ en: k, kinds: r.kinds, pages: pagesOf(r), count: r.count, tabTitle: true }); tabStat.stale++; continue; }
    for (const x of missing) {
      if (tv !== "translated" && tv !== "ambiguous") {
        if (!tabStat.partsNotQueued.some((y) => y.part === x)) tabStat.partsNotQueued.push({ part: x, title: k, verdict: tv === "kept" ? "company keeps this tab title English in every localized view" : "tab title not measured by the pair renders", queued: !TITLES_BY_SCOPE });
        // ★ (ت3، ٢٨ ربيع الآخر ١٤٤٨هـ) يُسجَّل القياس دائمًا، ولا يُحجب الجزء إلا بـ‎--titles-by-scope‎: فالقاعدة المكتوبة «تُترجم عناوين التبويب
        // في كل موقع» (RULES §1) حتى يحسم المالك سؤال ت3 عن العناوين التي تبقيها الشركة إنجليزية
        if (TITLES_BY_SCOPE) continue;
      }
      const o = tabPart.get(x) || { count: 0, pages: [] };
      o.count += r.count;
      for (const u of pagesOf(r)) if (o.pages.length < 3 && !o.pages.includes(u)) o.pages.push(u);
      tabPart.set(x, o);
    }
    if (k.endsWith(SUFFIX) && body.length === 1) {
      tabStat.prefix2++;
      if (isKept(body[0])) tabStat.prefix2Kept++; else if (!missing.length) tabStat.prefix2Ready++; else tabStat.prefix2Queued++;
    } else {
      tabStat.derived++;
      if (!missing.length) tabStat.derivedReady++; else tabStat.derivedQueued++;
    }
    if (missing.length && tabStat.sample.length < 30) tabStat.sample.push(k);
  }
  for (const [x, o] of tabPart) ui.set(x, { en: x, kinds: ["title-part"], zone: "head", pages: o.pages, count: o.count, source: "tab-title-part", ...refOf(x) });
  tabStat.queuedParts = tabPart.size;
  uiList = [...ui.values()].sort((a, b) => SORDER(a.source) - SORDER(b.source) || b.count - a.count || a.en.localeCompare(b.en));

  // ================================================================
  // keep-en.json: اليد كما هي + مدخلات الأداة
  // ================================================================
  // الملف المتتبَّع لنصوص الواجهة القصيرة وحدها: صنفٌ من الواجهة، وتسميةٌ قصيرة (≤ 40 محرفًا وخمس كلمات، بلا نهاية جملة)، ولا تحوي
  // عنوان وحدةٍ أو قسم؛ والمحتوى كله (المؤجَّل والأسماء والندوات والعائلة والعناوين وما طال) إلى الملف المولَّد
  const CONTENT_CATS = new Set(["deferred", "name", "webinar", "aria", "title"]);
  const allTitles = new Set([...unitTitle.keys(), ...secTitle.keys()]);
  const longTitles = [...allTitles].filter((t) => t.split(" ").length >= 2);
  const shortLabel = (x) => x.length <= 40 && wc(x) <= 5 && !/[.!?…]$/.test(x.trim());
  const hasTitle = (x) => allTitles.has(qn(x)) || longTitles.some((t) => qn(x).includes(t));
  const isTracked = (en) => !CONTENT_CATS.has(genCat.get(en)) && shortLabel(en) && !hasTitle(en);
  const byEn = (a, b) => (a.en < b.en ? -1 : a.en > b.en ? 1 : 0);
  const genEntries = [...genKeep].map(([en, why]) => ({ en, why, by: BY }));
  // ★ (ر5، ٢٩ ربيع الآخر ١٤٤٨هـ — ت3) ما صار ar-academy.json يترجمه حرفيًّا (قيمةٌ غير المفتاح) لا يبقى في قائمتي الإبقاء، من الأداة كان أو من
  // اليد: قرّر القاموس تعريبه فليس إنجليزيًّا مقصودًا (بطاقة الدخول في صفحات الدروس: تبقيها الشركة إنجليزيةً في كل لغة، وعُرّبت بالسؤال q106).
  // كانت الأداة تعيدها مع كل تشغيل من دليلها. والحرفيّ وحده: نصٌّ مُبقًى لا يغطّيه إلا نمطٌ تناقضٌ تكشفه بوابة الشمول (خطر الخلط) فلا يُسقط هنا
  const trAc = (en) => own(dictAc, en) && typeof dictAc[en] === "string" && dictAc[en] !== en;
  const droppedTr = { tool: [], hand: [] };
  const notTr = (e) => { if (!trAc(e.en)) return true; (e.by === BY ? droppedTr.tool : droppedTr.hand).push(e.en); return false; };
  const keepAll = manual.concat(genEntries.filter((e) => isTracked(e.en))).filter(notTr).sort(byEn);
  const keepGenAll = manualGen.concat(genEntries.filter((e) => !isTracked(e.en))).filter(notTr).sort(byEn);
  // نبذة keep-en.json: نصّ اليد كما هو، وجملة الأداة تُعاد كل تشغيل (لا تتراكم)
  const ABOUT_MARK = " ومدخلاتُ academy-prep.mjs";
  const ABOUT_ADD = ABOUT_MARK + " (by: \"academy-prep\") يعيد توليدها كلَّ تشغيلٍ بدليلها (مقارنة الفهارس وجداول المحتوى باللغات الأخرى في الذاكرة، والعرض المزدوج، والقرار 69)، وهنا نصوص الواجهة القصيرة وحدها؛ ونصوص المحتوى المتروكة (المؤجَّل إلى 3.0.0، وأسماء الناس، وبيانات الندوات، وسمة مخطط الدورة لكل درس، والعناوين، وما طال) في ‎_keep-en.generated.json‎ خارج git (مستودع البيانات)، وتقرأ بوابة الشمول الملفين.";
  const aboutHand = (keepJ._about || "").split(ABOUT_MARK)[0];
  // ★ (مراجعة ر4-ب) التاريخ لا يتغيّر إن لم يتغيّر المحتوى: إعادة التشغيل في يومٍ آخر لا تُحدث فرقًا في الملف المتتبَّع
  const sameAs = (j, about, keep) => !!(j && j.updated && j._about === about && JSON.stringify(j.keep || []) === JSON.stringify(keep));
  const aboutKeep = aboutHand + ABOUT_ADD;
  writeJson(KEEP_FILE, { _about: aboutKeep, updated: sameAs(keepJ, aboutKeep, keepAll) ? keepJ.updated : hijri(), keep: keepAll });
  const aboutGen = "نصوص المحتوى الإنجليزية في أكاديمية Claude المتروكة قصدًا — يولّدها academy-prep.mjs (ر4-ب) ويعيد توليدها كل تشغيل، لكلٍّ سببه: المؤجَّل إلى 3.0.0 بالقرار 69 (الملخصات والأهداف ووصف الأقسام وبدائل اللقطات وجمهور الدورة ومتطلّباتها)، وأسماء الناس، وبيانات الندوات، وسمة مخطط الدورة لكل درس، والعناوين التي تبقيها الشركة، وكل نصٍّ بطول جملة. خارج git (قاعدة ‎web/code/glossary/*/_*.json‎) ويُحفظ في مستودع البيانات؛ وتقرؤه بوابة الشمول بعد keep-en.json (الأول يغلب في مفتاحٍ مكرر).";
  writeJson(KEEP_GEN_FILE, { _about: aboutGen, updated: sameAs(keepGenJ, aboutGen, keepGenAll) ? keepGenJ.updated : hijri(), keep: keepGenAll });
  say(`قائمتا الإبقاء: keep-en.json ${keepAll.length} (يد ${keepAll.filter((e) => e.by !== BY).length}) · _keep-en.generated.json ${keepGenAll.length}` +
    ` · أُسقط ما يترجمه ar-academy.json حرفيًّا: من الأداة ${droppedTr.tool.length}، ومن اليد ${droppedTr.hand.length}`);
  if (droppedTr.hand.length) say("  ⚠ مدخلات يدٍ صار القاموس يترجمها فأُسقطت: " + droppedTr.hand.length + " (الأعداد لا النصوص)");
  if (KEEP_ONLY) { say("‎--keep-only‎: كُتبت قائمتا الإبقاء وحدهما"); finish(t0); return; }

  // ================================================================
  // الملفات
  // ================================================================
  const files = {
    ui: path.join(TODO_DIR, "ui-t3-todo.json"), titles: path.join(TODO_DIR, "titles-t3-todo.json"), hub: path.join(TODO_DIR, "hub-t3-todo.json"),
    unseen: path.join(TODO_DIR, "catalogue-unseen-t3.json"), plurals: path.join(TODO_DIR, "plurals-t3.json"), composites: path.join(TODO_DIR, "composites-t3.json"),
    vars: path.join(WD, "_vars-pairs-academy-t3.json"), summary: path.join(TODO_DIR, "t3-summary.json"), stale: path.join(TODO_DIR, "notinbuild-t3.json"),
  };
  writeJson(files.stale, stale.sort((a, b) => b.count - a.count));
  writeJson(files.ui, uiList); writeJson(files.titles, titleList); writeJson(files.hub, hubList); writeJson(files.unseen, unseenList);
  writeJson(files.plurals, plurals); writeJson(files.composites, compList); writeJson(files.vars, varsPairs);

  // --- التغطية قبل ت3 (completeness) وما بقي بلا تفسير ---
  let cov = null;
  if (!flag("no-completeness")) {
    const jf = path.join(TMP, "completeness.json");
    const r = spawnSync(process.execPath, [path.join(HERE, "completeness.mjs"), "--domain=" + D, "--json=" + jf], { encoding: "utf8", env: process.env });
    if (fs.existsSync(jf)) {
      const rep = readJson(jf).domains[D] || {};
      const inv = ((rep.text || {}).inventories || [])[0] || {};
      cov = { scope: { index: rep.scope.index, intended: rep.scope.intended, shell: rep.scope.shell, harvested: rep.scope.harvested, notHarvested: rep.scope.notHarvested, failed: (rep.scope.failed || []).length, idle: rep.scope.idle },
        interface: { total: inv.total, covered: inv.covered, keptEnglish: inv.keptEnglish, missing: inv.missing, pct: inv.pct },
        failures: readJson(jf).failures.filter((f) => f.d === D).map((f) => f.msg), exit: r.status };
      const missF = path.join(WD, "_completeness-missing-1.txt");
      const miss = fs.existsSync(missF) ? fs.readFileSync(missF, "utf8").split("\n").filter(Boolean) : [];
      const queued = new Set([...ui.keys(), ...titles.keys(), ...hub.keys()]);
      const tabSet = new Set(tabs.map((r) => r.key));
      const pending = new Set([...patternKeys, ...compositeKeys]);
      cov.missingQueued = miss.filter((s) => queued.has(s)).length;
      cov.missingTabTitles = miss.filter((s) => tabSet.has(s)).length;
      cov.missingPatternPending = miss.filter((s) => !queued.has(s) && !tabSet.has(s) && pending.has(s)).length;
      const staleSet = new Set(stale.map((x) => x.en));
      cov.missingNotInBuild = miss.filter((s) => staleSet.has(s) && !tabSet.has(s)).length;
      const open = miss.filter((s) => !queued.has(s) && !tabSet.has(s) && !pending.has(s) && !staleSet.has(s));
      cov.unexplained = open.length;
      cov.unexplainedSample = open.slice(0, 30);
    } else cov = { error: "completeness لم يكتب تقريره", exit: r.status, stderr: (r.stderr || "").split("\n").slice(-3) };
  }

  // --- الأعداد والكلمات ---
  const words = (arr, f = (x) => x.en) => arr.reduce((n, x) => n + wc(f(x)), 0);
  const bySource = {};
  for (const e of uiList) { const s = e.source.startsWith("catalogue:") ? (e.fragmentOf ? "catalogue-fragment" : "catalogue") : e.verified === false ? e.source + "-unverified" : e.source; bySource[s] = bySource[s] || { n: 0, words: 0 }; bySource[s].n++; bySource[s].words += wc(e.en); }
  const titleKinds = {};
  for (const t of titleList) { titleKinds[t.kind] = titleKinds[t.kind] || { n: 0, words: 0, seen: 0 }; titleKinds[t.kind].n++; titleKinds[t.kind].words += wc(t.en); if (t.seen) titleKinds[t.kind].seen++; }
  const genCats = {};
  for (const [en, why] of genKeep) { const c = why.split(":")[0]; genCats[c] = (genCats[c] || 0) + 1; void en; }
  const ambList = [...ambiguous.values()].map((a) => ({ en: a.en, translatedAt: [...a.translated], keptAt: [...a.kept], kinds: [...a.notes],
    recommendation: "translate", why: "الموضع الذي تترجمه الشركة واجهةٌ يعمل فيها القارئ؛ والقاموس حرفيٌّ فمدخلٌ واحد يخدم الموضعين (الافتراض في ملخص ر4-ب)" }));
  const summary = {
    _tool: "academy-prep", at: new Date().toISOString(), hijri: hijri(),
    inputs: { harvest: path.basename(hvFile), harvestPages: (hv.pages || []).length, harvestPagesOk: hvPages.length, harvestUniqueKeys: rows.length,
      catalogueMessages: ids.length, otherLocales: locales.length, contentLocales, contentUnits: units.length, hubCopy: enIdx.hub.size,
      pairs: pairs ? { file: path.basename(pairsFile), pages: pairs.pages.length, locales: pairs.locales, items: pairs.items.length } : null },
    classes: Object.fromEntries([...cls].sort((a, b) => b[1] - a[1])),
    outputs: {
      "ui-t3-todo": { n: uiList.length, words: words(uiList), bySource },
      "titles-t3-todo": { n: titleList.length, words: words(titleList), seen: titleList.filter((t) => t.seen).length, byKind: titleKinds },
      "hub-t3-todo": { n: hubList.length, words: words(hubList), seen: hubList.filter((h) => h.seen).length, pages: [...new Set(hubList.map((h) => h.page))].length },
      "catalogue-unseen-t3": { n: unseenList.length, words: words(unseenList) },
      "_vars-pairs-academy-t3": { n: varsPairs.length, words: varsPairs.reduce((n, v) => n + wcT(v.en), 0), seen: varsPairs.filter((v) => v.seen).length, needsE2: varsPairs.filter((v) => v.needsE2).length, companySame: varsPairs.filter((v) => v.companySame).length },
      "plurals-t3": { n: plurals.length, words: plurals.reduce((n, p) => n + wcT(Object.values(p.forms).join(" ")), 0), seen: plurals.filter((p) => p.seen).length },
      "composites-t3": { n: compList.length, keys: compList.reduce((n, c) => n + c.keys, 0), needsE2: compList.filter((c) => c.needsE2).length },
      "keep-en": { total: keepAll.length, manual: manual.length, generated: keepAll.length - manual.length, bytes: fs.statSync(KEEP_FILE).size,
        byCategory: keepAll.filter((e) => e.by).reduce((m, e) => (m[genCat.get(e.en)] = (m[genCat.get(e.en)] || 0) + 1, m), {}) },
      "_keep-en.generated": { total: keepGenAll.length, manual: manualGen.length, generated: keepGenAll.length - manualGen.length, bytes: fs.statSync(KEEP_GEN_FILE).size,
        byCategory: keepGenAll.filter((e) => e.by).reduce((m, e) => (m[genCat.get(e.en)] = (m[genCat.get(e.en)] || 0) + 1, m), {}) },
      keepByReason: genCats,
    },
    t3Words: { interfacePublic: words(uiList), titles: words(titleList), hubCopy: words(hubList), catalogueUnseen: words(unseenList), vars: varsPairs.reduce((n, v) => n + wcT(v.en), 0),
      plurals: plurals.reduce((n, p) => n + wcT(Object.values(p.forms).join(" ")), 0) },
    tabTitles: tabStat,
    ambiguous: ambList,
    unverified: { n: unverified.length, note: "harvest-only strings not on any pair-rendered template page but present in the current site build (a component's own text; inCode:true), or changed only on weakly aligned pair pages where the localized view uses another layout (weakPairs:true): queued for ت3 (translate by default), marked verified:false", sample: unverified.slice(0, 40) },
    notInBuild: { n: stale.length, keys: stale.length, words: stale.reduce((n, x) => n + wc(x.en), 0), file: "_ar_todo/notinbuild-t3.json",
      note: "harvest strings absent from the current site build, catalogue, content tables and pair renders: removed by the site deploy that happened during the harvest (or composed at run time); NOT queued for translation — a re-harvest drops or confirms them" },
    pairsOnlyDropped: { n: pairsDropped.size, pairsAt: pairs ? pairs.at : null, harvestAt: hv.at || null, sample: [...pairsDropped.values()].slice(0, 20),
      note: "pair-render strings absent from a newer harvest of the same page (removed by a deploy, or excluded by a skip selector changed after the pair renders): NOT queued for translation; re-run --pairs after the harvest to refresh the verdicts" },
    selectorDrift: pickerDrift ? { ...pickerDrift, selector: "footer [role=combobox] > span:first-child (ACADEMY_SKIP, academy-point.css)",
      note: "after the deploy the footer language picker is a CDS button opening a dialog; its value is span[lang=en] and no [role=combobox] remains in the footer, so the skip and LTR rules for the picker value no longer match" } : null,
    coverageBeforeT3: cov,
    deferredFieldsInHarvest: [...genKeep].filter(([, w]) => w.startsWith("deferred:")).reduce((m, [, w]) => { const f = w.replace(/^deferred: 3\.0\.0 \(decision 69\) — /, ""); m[f] = (m[f] || 0) + 1; return m; }, {}),
  };
  summary.t3Words.total = Object.values(summary.t3Words).reduce((a, b) => a + b, 0);
  writeJson(files.summary, summary);

  // --- فحص الحساسية للنواتج (أعدادٌ فقط) ---
  const LN = languageNames();
  const scan = {};
  for (const [nm, f] of Object.entries({ ...files, keepEn: KEEP_FILE, keepGen: KEEP_GEN_FILE, ...(pairsFile ? { pairs: pairsFile } : {}) })) {
    const t = fs.readFileSync(f, "utf8");
    scan[nm] = { forbidden: FORBID(t), langEn: LN.en.filter((re) => re.test(t)).length, langAr: LN.ar.filter((re) => re.test(t)).length };
  }

  // --- الجدول ---
  say("\n— الأصناف (مفاتيح الحصاد الفريدة " + rows.length + ") —");
  for (const [k, v] of [...cls].sort((a, b) => b[1] - a[1])) say(`  ${k.padEnd(26)} ${String(v).padStart(6)}`);
  say("\n— النواتج —");
  const line = (a, n, w, x = "") => say(`  ${a.padEnd(30)} ${String(n).padStart(6)}  ${String(w).padStart(7)} كلمة  ${x}`);
  line("ui-t3-todo.json", uiList.length, words(uiList), Object.entries(bySource).map(([k, v]) => `${k} ${v.n}/${v.words}`).join(" · "));
  line("titles-t3-todo.json", titleList.length, words(titleList), Object.entries(titleKinds).map(([k, v]) => `${k} ${v.n}/${v.words}`).join(" · "));
  line("hub-t3-todo.json", hubList.length, words(hubList));
  line("catalogue-unseen-t3.json", unseenList.length, words(unseenList));
  line("_vars-pairs-academy-t3.json", varsPairs.length, summary.t3Words.vars, `يُرى ${summary.outputs["_vars-pairs-academy-t3"].seen} · needsE2 ${summary.outputs["_vars-pairs-academy-t3"].needsE2}`);
  line("plurals-t3.json", plurals.length, summary.t3Words.plurals, `يُرى ${summary.outputs["plurals-t3"].seen}`);
  line("composites-t3.json", compList.length, "-", `مفاتيح ${summary.outputs["composites-t3"].keys} · needsE2 ${summary.outputs["composites-t3"].needsE2}`);
  line("notinbuild-t3.json (لا يُترجم)", stale.length, summary.notInBuild.words, "ليس في بناء الموقع الحالي (نشرٌ أثناء الحصاد)");
  const catLine = (o) => Object.entries(o).map(([k, v]) => k + " " + v).join("، ");
  line("keep-en.json (متتبَّع)", keepAll.length, "-", `يد ${manual.length} + أداة ${keepAll.length - manual.length} (${catLine(summary.outputs["keep-en"].byCategory)}) · ${(summary.outputs["keep-en"].bytes / 1024).toFixed(1)} KB`);
  line("_keep-en.generated.json", keepGenAll.length, "-", `أداة ${keepGenAll.length - manualGen.length}${manualGen.length ? " + يد " + manualGen.length : ""} (${catLine(summary.outputs["_keep-en.generated"].byCategory)}) · ${(summary.outputs["_keep-en.generated"].bytes / 1024).toFixed(1)} KB`);
  say(`  مجموع كلمات ت3 (كل القوائم): ${summary.t3Words.total}`);
  say(`\nعناوين التبويب ${tabStat.total}: (أ) بادئةٌ + لاحقة ${tabStat.prefix2} (جاهزةٌ بعد ت3 ${tabStat.prefix2Ready}، تبقى إنجليزية ${tabStat.prefix2Kept}، بجزءٍ أُضيف للقائمة ${tabStat.prefix2Queued}) · (ب) حرفيٌّ مشتقّ ${tabStat.derived} (جاهزٌ بعد ت3 ${tabStat.derivedReady}، بجزءٍ أُضيف ${tabStat.derivedQueued}) · أجزاءٌ أُضيفت إلى قائمة الواجهة ${tabStat.queuedParts} (ولم تُضَف ${tabStat.partsNotQueued.length}) · عناوين ليست في البناء الحالي ${tabStat.stale} · قِيس في العروض: تبقيه الشركة ${tabStat.measured.kept}، تترجمه ${tabStat.measured.translated}، مختلط ${tabStat.measured.ambiguous}، لم يُقَس ${tabStat.measured.unseen}`);
  say(`ملتبس (يُعرَّب في موضعٍ ويُبقى في آخر): ${ambList.length} · خارج الفهرس ولم يُتحقَّق بعرض: ${unverified.length}`);
  if (cov && !cov.error) say(`التغطية قبل ت3 (completeness): مقصود ${cov.scope.intended} · محصود ${cov.scope.harvested} · لم يُحصد ${cov.scope.notHarvested} · الواجهة ${cov.interface.total} ← مغطّى ${cov.interface.covered} + مُستبقًى ${cov.interface.keptEnglish} = ${cov.interface.pct}% · باقٍ ${cov.interface.missing} (في قوائم ت3 ${cov.missingQueued} · عناوين تبويب ${cov.missingTabTitles} · أنماطٌ بعد ت3 ${cov.missingPatternPending} · ليس في البناء الحالي ${cov.missingNotInBuild} · بلا تفسير ${cov.unexplained})`);
  else if (cov) say(`⚠ completeness: ${cov.error} (exit ${cov.exit})`);
  say("\nفحص الحساسية (أعداد): " + Object.entries(scan).map(([k, v]) => `${k} ${v.forbidden}/${v.langEn}/${v.langAr}`).join(" · ") + "  (نطاقٌ محظور/اسم لغةٍ إنجليزي/عربي)");
  if (Object.values(scan).some((v) => v.forbidden || v.langEn || v.langAr)) { say("⚠ في النواتج ما يخالف قواعد الحساسية — راجعه قبل أي نقل"); process.exitCode = 1; }
  finish(t0);
}
function finish(t0) {
  dropTmp();
  say(`\nحُذف مجلد التشغيل المؤقت (الفهرس والجداول) · ${((Date.now() - t0) / 1000).toFixed(0)} ث`);
}

try { await main(); }
catch (e) { console.error("✗ " + e.message); process.exitCode = 1; }
finally { dropTmp(); }
