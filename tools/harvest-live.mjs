// harvest-live.mjs — حصادٌ حيٌّ من حزم claude.ai العامة بمنطق فحص الإضافة نفسِه،
// ثم فرزُ ما لم يُترجَم بعدُ إلى دفعاتٍ جاهزة للترجمة.
//
// لماذا هنا لا في المتصفح: الفحص في الإضافة يخدم المستخدم (قائمة يراها)، وهذا يخدم
// المشرف (ملفاتُ عملٍ للترجمة). والمنطق واحدٌ عمدًا — فكِّ الحرفيات من cml-shared،
// وعتبات النص من cml-const، والمرشِّحات نفسها — كي لا يترجم أحدُهما ما يرفضه الآخر.
//
// ويزيد عليه الحاصدُ (٢٠ ربيع الآخر ١٤٤٨هـ): قراءةَ الحرفيات بين علامتي الاقتباس المائلة، وقاعدةَ خطر الخلط، وعدَّ
// القالب الذي له نمطٌ بمفتاحه مغطًّى — فالفرز هنا أدقّ من قائمة الفحص في الإضافة، وما يُترجم به لا يرفضه المحرّك.
//
//   node harvest-live.mjs [--entry=<اسم ملف الدخول>] [--batch=650] [--prov]
// المخرجات في code/glossary/: ‎_live-catalog.txt و‎_live-missing.txt و‎_live-mixed.txt و‎_live_batches/‎
// — كلها متجاهَلة في git وليست في النشر (مادة الموقع خام).
import fs from "node:fs";
import path from "node:path";
import { GLOSSARY, DICTS, EXT } from "./paths.mjs";

await import(new URL("file:///" + path.join(EXT, "cml-const.js").split(path.sep).join("/")).href);
await import(new URL("file:///" + path.join(EXT, "cml-shared.js").split(path.sep).join("/")).href);
const CONST = globalThis.CMLConst, SHARED = globalThis.CMLShared;

const BASE = "https://assets-proxy.anthropic.com/claude-ai/v2/assets/v1/";
// زحف حزم التطبيق وحده: نصوص المواقع الأخرى تُحصد من صفحاتها بـharvest-dom.mjs
{
  const { domainArg: dA } = await import(new URL("./domain-arg.mjs", import.meta.url).href);
  const d = dA(process.argv);
  if (d !== "app") {
    console.error(`! harvest-live يزحف حزم تطبيق claude.ai وحده — لنطاق ${d} استعمل: node harvest-dom.mjs --domain=${d}`);
    process.exit(2);
  }
}
const entryArg = process.argv.find((a) => a.startsWith("--entry="));
const batchArg = process.argv.find((a) => a.startsWith("--batch="));
const BATCH = batchArg ? parseInt(batchArg.split("=")[1], 10) : 650;

// ملف الدخول: يُمرَّر، أو يُكتشف من صفحة الدخول العامة
let seed = entryArg ? entryArg.split("=")[1] : null;
if (!seed) {
  const html = await fetch("https://claude.ai/login", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0 Safari/537.36" },
  }).then((r) => (r.ok ? r.text() : "")).catch(() => "");
  const m = html.match(/assets\/v1\/(index-[A-Za-z0-9_-]+\.js)/);
  if (m) seed = m[1];
}
if (!seed) { console.error("! تعذّر اكتشاف ملف الدخول — مرّره: --entry=index-XXXX.js"); process.exit(1); }
console.log("ملف الدخول:", seed);

// ---- الزحف (كما في المحرك: معبّر الإشارات نفسه، وتوازٍ محدود) ----
// ★ (تحديث ٢٠ ربيع الآخر ١٤٤٨هـ) ‎\.js(?![\w.])‎: كان «x-abcdef.json» (رسوم Lottie) يُقتطع «x-abcdef.js» فيُطلب ملفٌ لا وجود له
const REF = /[A-Za-z0-9_]+-[A-Za-z0-9_-]{6,}\.js(?![\w.])/g;
// ★ والحرفية بعلامتي الاقتباس المائلة (`…`) بلا استيفاء ‎${}‎: 41 رسالةً في 17 حزمة كانت لا تُقرأ (أكثرها مطالبات بدء،
// ومعها نصوص واجهة). ما فيه ‎${‎ لا يطابق أصلًا (نصُّه يُبنى وقت التشغيل فلا مفتاح ثابتًا له)
const DM = /(?:"?defaultMessage"?):\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\$]|\\[\s\S]|\$(?!\{))*)`)/g;
// حرفية القالب ← صيغةٌ يفكّها unescapeLiteral: هروبُ ` و$ و' يُفكّ (JSON لا يعرفه) بتمريرةٍ ذرّية تبتلع كل هروبٍ بأكمله،
// ووصلُ السطر (\ ثم سطر) يُحذف كما في اللغة، والأسطر الخام تصير \n (JSON يرفض محارف التحكم الخام)
function templateToQuoted(t) {
  return t.replace(/\r\n?/g, "\n")
    .replace(/\\([\s\S])/g, (x, c) => (c === "`" || c === "$" || c === "'" ? c : c === "\n" ? "" : x))
    .replace(/\n/g, "\\n").replace(/\t/g, "\\t");
}
const CTRL_RE = new RegExp("[\\u0000-\\u001f\\u007f]");
const seen = new Set([seed]), queue = [seed], msgs = new Set();
let ok = 0, ghosts = 0, failed = 0;
// ★ المنشأ: أي حزمةٍ حملت كل نصّ (لحزمة «النصوص بمواضعها» المُعدَّة لفريق الموقع)، وأسماءُ
// ملفات CSS المُشار إليها في الحزم (لتجديد لقطة sitecss عند تغيّر أسمائها المُجزّأة)
const PROV = process.argv.includes("--prov");
const prov = new Map(), cssRefs = new Set();
const CSS_REF = /[A-Za-z0-9_]+-[A-Za-z0-9_-]{6,}\.css/g;

function chew(tx, name) {
  for (const m of tx.match(REF) || []) if (!seen.has(m)) { seen.add(m); queue.push(m); }
  for (const c of tx.match(CSS_REF) || []) cssRefs.add(c);
  let m;
  DM.lastIndex = 0;
  while ((m = DM.exec(tx))) {
    const s0 = m[3] != null ? SHARED.unescapeLiteral(templateToQuoted(m[3]), false)
      : SHARED.unescapeLiteral(m[1] != null ? m[1] : m[2], m[1] == null);
    if (s0 === null) continue;
    // الحرفية المائلة متعددة الأسطر: فقراتها (بسطرٍ فارغ) عقدٌ مستقلة في الصفحة عادةً، والمحرّك يطابق نصَّ العقدة كما هو
    // (textKey يقصّ ولا يضمّ البياض) — فالنصّ المضموم كله مفتاحٌ لا يُرى أبدًا. تُحصد الفقرات كما قسّمها عارض المُحاوِر
    for (const part of m[3] != null ? s0.split(/\n[ \t]*\n/) : [s0]) take(part, name);
  }
}
function take(s0, name) {
  const s = s0.replace(/\s+/g, " ").trim();
  // ★ (٢١ ربيع الآخر ١٤٤٨هـ، توجيه المالك) لا سقف طول: المحرّك يطلب النصّ مهما طال، فيُحصد ويُقاس مهما طال
  if (!s || s.length < 2) return;
  if (!/[A-Za-z]/.test(s)) return;
  if (CTRL_RE.test(s)) return;
  if (/^[#\/]|^\d|https?:|www\.|[@\\^~`|=]/.test(s) || /^[a-z]+([A-Z][a-z]+)+$/.test(s) || (/_/.test(s) && !/ /.test(s))) return;
  if (/\{[^{}]*,\s*(plural|select|selectordinal)\s*,/.test(s)) return;
  if (/<\/?[A-Za-z][^>]*>/.test(s)) return;
  if (/\{/.test(s) && !/^[^{}]*(\{[A-Za-z_$][\w$]*\}[^{}]*)+$/.test(s)) return;
  msgs.add(s);
  if (PROV) { const a = prov.get(s); if (a) { if (a.length < 4 && !a.includes(name)) a.push(name); } else prov.set(s, [name]); }
}
while (queue.length) {
  const batch = queue.splice(0, 12);
  const texts = await Promise.all(batch.map((n) =>
    fetch(BASE + n).then((r) => (r.ok ? r.text() : (r.status === 404 ? null : undefined))).catch(() => undefined)));
  for (const [i, t] of texts.entries()) {
    if (t === null) ghosts++;
    else if (t === undefined) failed++;
    else { ok++; chew(t, batch[i]); }
  }
  if (ok % 300 < 12) process.stdout.write(`\rملفات: ${ok} | طابور: ${queue.length} | نصوص: ${msgs.size}   `);
}
console.log(`\nحُصد: ${ok} ملفًا (${ghosts} إشارة وهمية، ${failed} إخفاق) | نصوص الواجهة: ${msgs.size}`);

// ---- الفرز: ما لم يُترجَم بعدُ ولا يغطيه نمطٌ ولا جمع ----
const d = JSON.parse(fs.readFileSync(path.join(DICTS, "ar.json"), "utf8"));
const strings = d.strings || {};
// الأنماط بترتيب القاموس (المحرّك يأخذ أول نمطٍ مطابق) مع en وar لعرض الناتج كما يراه المستخدم
const pats = (d.patterns || []).map((p) => { try { return { re: new RegExp(p.re), ar: p.ar, en: p.en, src: p.re }; } catch { return null; } }).filter(Boolean);
// ★ (٢١ ربيع الآخر ١٤٤٨هـ، لا سقف طول) بفهرس المحرّك نفسه وشرطه (cml-shared patternIndex، PATTERN_CAPTURE_MAX): النصّ الطويل يُحكم
// عليه كما يعرضه المحرّك، وبلا مسحٍ خطيٍّ لآلاف التعبيرات على كل نصٍّ طويل
const pidx = SHARED.patternIndex(pats.map((p) => p.src));
const firstPat = (s) => { const r = pidx.find(s, (i) => (pats[i].re.test(s) ? { i } : null), CONST.PATTERN_CAPTURE_MAX); return r ? pats[r.i] : null; };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const plurRes = [];
for (const [en, spec] of Object.entries(d.plurals || {}))
  for (const pat of [en, spec.plural]) if (pat) plurRes.push(new RegExp("^" + esc(pat).replace("%d", "(\\d+)") + "$"));
const byPattern = (s) => !!firstPat(s);
const byPlural = (s) => plurRes.some((re) => re.test(s));
function render(s) {
  const p = firstPat(s);
  if (!p) return null;
  const m = s.match(p.re);
  if (/%[MWPC]\d/.test(p.ar)) return null;                    // قواعد الشهور والأيام والأماكن: صحيحةٌ حتمًا
  return { out: p.ar.replace(/\$(\d)/g, (x, g) => (m[+g] !== undefined ? m[+g] : "")), caps: m.slice(1).filter((c) => c !== undefined), en: p.en, ar: p.ar };
}
const VAR = /\{[A-Za-z_$][\w$]*\}/;
// ★ (ب) قالبٌ له نمطٌ بمفتاحه نفسه (p.en === s) مغطًّى: الالتقاط العددي ‎([^\s]*\d[^\s]*)‎ لا يطابق نصَّ «{value}» نفسه،
// فكان اختبار التعبير على القالب يعدّه «باقيًا» كاذبًا ويعيده إلى دفعات الترجمة في كل حصاد
const patEn = new Set(pats.map((p) => p.en));
// ★ (أ) خطر الخلط بقاعدة completeness.mjs نفسها: حرفيٌّ بلا متغيّر لا يغطّيه إلا نمطٌ قيمتُه الملتقطة كلامٌ إنجليزي
// (أداة تعريف، أو كلمةٌ صغيرة الحرف الأول، أو كلمةٌ يترجمها القاموس) ⇒ يُعرض مختلطًا «Log in للمتابعة» ⇒ يحتاج مفتاحًا حرفيًّا
const wordy = (c) => /^(a|an|the)$/i.test(c) || /^[a-z]{2,}/.test(c) || (/^[A-Za-z][A-Za-z ]*$/.test(c) && strings[c] !== undefined && strings[c] !== c);
function mixedOf(s) {
  const r = render(s);
  return r && r.out !== s && r.caps.some(wordy) ? r : null;
}
// ★ (أ) والقالب بمتغيّرات يُعرض بقيمٍ نموذجية (رقمٌ لمتغيّرات العدّ، وكلمةٌ علمٌ لغيرها) كما يراه المستخدم، ثم يُحكم:
//   template-only — لا يغطّيه وقت العرض شيء (طابق النمطُ نصَّ «{…}» لا القيمة)؛
//   mixed — أول نمطٍ مطابق يُخرج كلماتٍ إنجليزية ليست من القيم ولا من عربية النمط (Remove 3 and submit ⇒ «إزالة 3 and submit»)
const NUMERIC_NAME = /^(count|n|num|number|total|percent|pct|percentage|amount|size|limit|days?|hours?|minutes?|mins?|seconds?|secs?|weeks?|months?|years?|remaining|used|max|min|index|position|price|cost|credits?|seats?|tokens?|quantity|qty|value|answered|passing|failed|passed|pending|skipped|elapsed|delta)$/i; // delta: نسبةٌ منسَّقة (cml-shared NUMERIC_VAR، ٢١ ربيع الآخر ١٤٤٨هـ)
const SAMPLE_WORD = "Zeddicus";
function mixedVarOf(s) {
  const sample = s.replace(/\{([A-Za-z_$][\w$]*)\}/g, (m, n) => (NUMERIC_NAME.test(n) ? "3" : SAMPLE_WORD));
  if (strings[sample] !== undefined) return null;
  const r = render(sample);
  if (!r) return byPlural(sample) ? null : { why: "template-only", out: null };
  const allowed = new Set([SAMPLE_WORD, ...(r.ar.match(/[A-Za-z]{2,}/g) || [])]);
  // القيم النموذجية تُنزع قبل العدّ: «{latency}ms» تصير «Zeddicusms» فلا يُحسب «ms» (وهو في عربية النمط) كلمةً دخيلة
  const extra = (r.out.split(SAMPLE_WORD).join(" ").match(/[A-Za-z]{2,}/g) || []).filter((w) => !allowed.has(w));
  return extra.length ? { why: "mixed", out: r.out, pattern: r.en } : null;
}
const mixed = [];
function isMissing(s) {
  if (strings[s] !== undefined) return false;
  if (VAR.test(s)) {
    if (patEn.has(s)) return false;
    // الحكم بالعرض لا بنصّ القالب: «{tokens} tokens» يغطّيه وقت العرض نمطُ «{count} tokens» (التقاطٌ عددي لا يطابق «{tokens}»)
    const r = mixedVarOf(s);
    if (!r) return false;
    if (r.why === "template-only" && !byPattern(s) && !byPlural(s)) return true;   // باقٍ صريح لا خلط فيه
    mixed.push(s + "  ⇒  " + (r.out === null ? "(" + r.why + ")" : r.out));
    return true;
  }
  if (byPattern(s)) {
    const r = mixedOf(s);
    if (r) { mixed.push(s + "  ⇒  " + r.out); return true; }
    return false;
  }
  return !byPlural(s);
}

const missing = [...msgs].filter(isMissing).sort();

fs.mkdirSync(GLOSSARY, { recursive: true });
fs.writeFileSync(path.join(GLOSSARY, "_live-catalog.txt"), [...msgs].sort().join("\n") + "\n", "utf8");
fs.writeFileSync(path.join(GLOSSARY, "_live-missing.txt"), missing.join("\n") + "\n", "utf8");
// ما يُعرض مختلطًا (داخلٌ في الباقي وفي الدفعات) بناتجه — للمراجعة وحدها
fs.writeFileSync(path.join(GLOSSARY, "_live-mixed.txt"), mixed.sort().join("\n") + (mixed.length ? "\n" : ""), "utf8");
if (mixed.length) console.log(`خطر الخلط: ${mixed.length} نصًّا يغطّيه نمطٌ بناتجٍ مختلط (عُدّ باقيًا) → _live-mixed.txt`);
if (PROV) {
  fs.writeFileSync(path.join(GLOSSARY, "_live-provenance.json"), JSON.stringify({
    entry: seed, base: BASE, harvested: ok, css: [...cssRefs].sort(),
    strings: Object.fromEntries([...prov.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
  }), "utf8");
  console.log(`المنشأ: ${prov.size} نصًّا بحزمها، و${cssRefs.size} ملف CSS مُشارًا إليه → _live-provenance.json`);
}

// دفعات مرقّمة: نصوصٌ ثابتة ونصوصٌ بمتغيّرات مفصولة (لكلٍّ عقدُ ترجمةٍ مختلف)
const plain = missing.filter((s) => !/\{[A-Za-z_$][\w$]*\}/.test(s));
const vars = missing.filter((s) => /\{[A-Za-z_$][\w$]*\}/.test(s));
const outDir = path.join(GLOSSARY, "_live_batches");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
let n = 0;
for (const [kind, list] of [["plain", plain], ["vars", vars]]) {
  for (let i = 0; i < list.length; i += BATCH) {
    const slice = list.slice(i, i + BATCH);
    fs.writeFileSync(path.join(outDir, `${kind}_${String(n).padStart(2, "0")}.txt`), slice.join("\n") + "\n", "utf8");
    n++;
  }
}
console.log(`غير مترجَم: ${missing.length} (ثابت ${plain.length} · بمتغيّرات ${vars.length}) → ${n} دفعة في code/glossary/_live_batches/`);
