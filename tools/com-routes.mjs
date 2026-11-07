// com-routes.mjs — ★ (ر15، ٦ جمادى الأولى ١٤٤٨هـ) قائمة المسارات المترجمة في claude.com لحارس مسار النطاق com (routes.exact).
//
// لماذا: النطاق بالقاعدة «ما تترجمه الشركة نترجمه» (دراسة ر14 §٢أ، وافتراض السؤال 15: لغةٌ واحدة على الأقل). وفي claude.com ثلاثمئة
// صفحةٍ ونيّف تترجمها الشركة بأعيانها بين ألفي صفحةٍ إنجليزية، وتتغيّر مع كل نشر — فلا تُكتب باليد. تُشتقّ من مصدرين علنيين:
//   ١) خريطة الموقع (https://claude.com/sitemap.xml): مسارٌ إنجليزي له نسخةٌ بادئتُها بادئةُ لغةٍ (‎/<locale>/…‎) مترجَم؛
//   ٢) روابط ‎<link rel="alternate" hreflang>‎ في الصفحة الإنجليزية نفسها: تزيد على الخريطة فهارسَ تترجم الشركة قالبها (فهارس المصادر).
// وبادئات اللغات تُعرف من روابط hreflang في الصفحة الرئيسة نفسها لا من قائمةٍ مكتوبة هنا. وما تحت بادئات routes.full في جدول النطاقات
// (السوق ‎/marketplace/‎ كلّه — مترجمٌ كلّه ونسخه المترجمة خارج الخريطة) لا يدخل القائمة: البادئة تغطّيه.
//
// المخرج كتلةٌ مولَّدة في cml-const.js بين علامتَي «<com-routes>» و«</com-routes>»: مساراتٌ فقط (لا نصّ من الموقع)، مرتّبةٌ بلا تكرار، ومعها
// أعدادها. ومنها يقرؤها كل سياق: سكربت المحتوى، وعامل الخدمة (طلب القطع لا يُقبل إلا لمسارٍ كامل)، والإعدادات، والبناء (يحقنها في
// dict-com.js ويفحص شكلها)، والحصاد في ر17/ر19. والكتلة لا تُكتب إلا إن تغيّرت القائمة نفسها، فإعادة التشغيل على الموقع نفسه لا تغيّر بايتًا.
//
//   node web/code/toolchain/com-routes.mjs                  جلبٌ وحسابٌ ومقارنةٌ بالكتلة، بلا كتابة (رمز 0، أو 2 إن رفضت البوابة)
//   node web/code/toolchain/com-routes.mjs --write          يكتب الكتلة إن تغيّرت القائمة واجتازت البوابة، ثم أعد البناء (build.mjs)
// خيارات:
//   --save=<dir>      يحفظ المدخلات (inputs.json: مساراتٌ وأعدادٌ فقط، بلا رموز لغات ولا نصّ) لإعادة الحساب بلا شبكة
//   --from=<dir>      يحسب من مدخلاتٍ محفوظة بلا شبكة (المراجعة، والفحص الذاتي selftest-tools)؛ وبعتبةٍ أعلى من التي جُلبت لها ينبّه ولا يكتب
//   --min-locales=N   عتبة «ما تترجمه الشركة» (السؤال 15 للمالك؛ الافتراض 1، والبديلان 4 و6 — دراسة ر14 §٢ب)
//   --accept-drop     يقبل هبوط العدد فوق الحدّ (قرار المنسّق، ويُذكر في تقرير المرحلة)
//   --accept-errors   يقبل إخفاق جلب صفحاتٍ فوق الحدّ (كذلك)
//   --concurrency=N   (الافتراض 6)  --json=<file> تقريرٌ آلي  --cml-const=<file> ملفٌّ بديل للكتلة (للفحص الذاتي وحده)
// البوابة: تُرفض الكتابة إن هبط العدد عن السابق بأكثر من DROP_MAX، أو كانت القائمة فارغة، أو أخفق جلب أكثر من ERR_MAX من الصفحات
// (صفحةٌ لم تُقرأ روابطها قد تسقط من القائمة صامتةً).
// كل أمرٍ شبكي: NODE_USE_ENV_PROXY=1 node … (القاعدة في CLOUD-RUNBOOK).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { EXT } from "./paths.mjs";

export const SITE = "https://claude.com";
export const DROP_MAX = 0.10;   // أقصى هبوطٍ في العدد يُقبل بلا قرار
export const ERR_MAX = 0.01;    // أقصى نسبة صفحاتٍ يُقبل إخفاق جلبها بلا قرار
export const BEGIN = "<com-routes>", END = "</com-routes>";
const DOMAIN = "com";

// ── تحليلٌ خالص (يمتحنه الفحص الذاتي بلا شبكة) ───────────────────────────────────────────────
// مسارٌ بصيغة الحارس: بلا شرطةٍ ختامية (إلا الجذر)، بلا استعلامٍ ولا مرساة
export function normPath(p) {
  let s = String(p || "").split(/[?#]/)[0];
  if (!s.startsWith("/")) s = "/" + s;
  s = s.replace(/\/{2,}/g, "/");
  return s.length > 1 ? s.replace(/\/+$/, "") || "/" : "/";
}
// عناوين <loc> في خريطةٍ أو فهرس خرائط: {locs, children}
export function parseSitemap(xml) {
  const t = String(xml || "");
  const locs = [...t.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, "&"));
  return /<sitemapindex[\s>]/i.test(t) ? { locs: [], children: locs } : { locs, children: [] };
}
// روابط hreflang في المستند كله (Next.js يبثّ بيانات الرأس أحيانًا في آخر <body>): [{lang, href}] — بأيّ ترتيبٍ للسمات وأيّ حالة حروف
export function alternatesOf(html, base = SITE) {
  const out = [];
  for (const m of String(html || "").matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const attr = (n) => { const r = new RegExp("\\b" + n + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i").exec(tag); return r ? (r[1] ?? r[2] ?? r[3]) : null; };
    const rel = attr("rel"), lang = attr("hreflang"), href = attr("href");
    if (!lang || !href || !/(^|\s)alternate(\s|$)/i.test(rel || "")) continue;
    let u; try { u = new URL(href.replace(/&amp;/g, "&"), base); } catch { continue; }
    out.push({ lang: lang.toLowerCase(), href: u.href, host: u.host, path: normPath(u.pathname) });
  }
  return out;
}
const firstSeg = (p) => normPath(p).split("/")[1] || "";
// بادئات اللغات من روابط صفحةٍ إنجليزية: المقطع الأول لكل رابطٍ ليس الإنجليزية ولا x-default على المضيف نفسه
export function prefixesOf(alts, host = new URL(SITE).host) {
  const s = new Set();
  for (const a of alts) if (a.host === host && a.lang !== "x-default" && !/^en(-|$)/.test(a.lang)) { const f = firstSeg(a.path); if (f) s.add(f); }
  return s;
}
// عدد اللغات في روابط صفحةٍ إنجليزية (بادئاتٌ مختلفة)
export function localeCount(alts, host = new URL(SITE).host) { return prefixesOf(alts, host).size; }
// ★ (مراجعة ر15، ٦ جمادى الأولى ١٤٤٨هـ) مسارات الخريطة ← {english, localized}: المسارات الإنجليزية، ولكل مسارٍ مترجَم عددُ بادئات اللغات المختلفة التي
// تحمله — لا عددُ عناوينه: عنوانٌ مكرَّر في الخريطة كان يُعدّ لغتين فيرفع المسار فوق عتبةٍ أعلى من 1 (السؤال 15: أربعٌ أو الست)
export function splitSitemap(locs, P) {
  const english = [], by = new Map();
  for (const p of locs) {
    const f = firstSeg(p);
    if (!P.has(f)) { english.push(p); continue; }
    const s = normPath("/" + p.split("/").slice(2).join("/"));
    if (!by.has(s)) by.set(s, new Set());
    by.get(s).add(f);
  }
  const localized = {};
  for (const [s, set] of by) localized[s] = set.size;
  return { english, localized };
}
// مسارٌ تحت إحدى بادئات routes.full (كما يحكم routeMode: المسار وبعده شرطة)
export function underFull(p, full) { const x = normPath(p) + "/"; return (full || []).some((f) => x.startsWith(f)); }

// الحساب من المدخلات: inputs = {english: [...], localized: {مسار: عدد}, hreflang: {مسار: عدد}, redirects: [...]}
export function compute(inputs, { minLocales = 1, full = [] } = {}) {
  const red = new Set(inputs.redirects || []);
  const english = [...new Set((inputs.english || []).map(normPath))].filter((p) => !red.has(p));
  const loc = inputs.localized || {}, hl = inputs.hreflang || {};
  const exact = [], why = { sitemap: 0, hreflangOnly: 0 };
  for (const p of english) {
    if (underFull(p, full)) continue;
    const a = +loc[p] || 0, b = +hl[p] || 0;
    if (Math.max(a, b) < minLocales) continue;
    exact.push(p);
    if (a >= minLocales) why.sitemap++; else why.hreflangOnly++;
  }
  exact.sort();
  const orphans = Object.keys(loc).filter((p) => !english.includes(p) && !red.has(p)).length;
  return { exact, why, english: english.length, orphans };
}
// البوابة: هبوط العدد، والقائمة الفارغة، وإخفاق الجلب
export function gate(prev, next, { errors = 0, fetched = 0, acceptDrop = false, acceptErrors = false } = {}) {
  const why = [];
  if (!next.length) why.push("القائمة الجديدة فارغة");
  if (prev.length && next.length < prev.length * (1 - DROP_MAX) && !acceptDrop)
    why.push(`هبط العدد من ${prev.length} إلى ${next.length} (أكثر من ${Math.round(DROP_MAX * 100)}٪) — راجع الموقع، أو مرّر --accept-drop بقرار`);
  if (fetched && errors / fetched > ERR_MAX && !acceptErrors)
    why.push(`أخفق جلب ${errors} من ${fetched} صفحةً (أكثر من ${Math.round(ERR_MAX * 100)}٪) — أعد التشغيل، أو مرّر --accept-errors بقرار`);
  return { ok: !why.length, why };
}
// الكتلة في نصّ cml-const.js: {exact, meta, start, end} أو null
export function readBlock(text) {
  const a = text.indexOf(BEGIN), b = text.indexOf(END);
  if (a < 0 || b < a) return null;
  const start = text.lastIndexOf("\n", a) + 1, end = text.indexOf("\n", b) + 1 || text.length;
  const body = text.slice(start, end);
  const arr = /var COM_EXACT = (\[[\s\S]*?\]);/.exec(body), meta = /var COM_EXACT_META = (\{[^\n]*\});/.exec(body);
  if (!arr || !meta) return null;
  try { return { exact: JSON.parse(arr[1]), meta: JSON.parse(meta[1]), start, end }; } catch { return null; }
}
export function renderBlock(exact, meta) {
  return "  // ═══ " + BEGIN + " مولَّدٌ بـ«node web/code/toolchain/com-routes.mjs --write» من خريطة claude.com وروابط hreflang — لا يُعدَّل باليد ═══\n" +
    "  // مساراتُ الصفحات التي تترجمها الشركة بأعيانها (حارس المسار exact لنطاق com)، وأعدادها: الخريطة كلها، والإنجليزية، والمترجمة فيها،\n" +
    "  // وما دخل من الخريطة، وما دخل من روابط hreflang وحدها، وعتبة اللغات (السؤال 15)، ويوم آخر تغيّرٍ في القائمة\n" +
    "  var COM_EXACT = [\n" + exact.map((p) => "    " + JSON.stringify(p)).join(",\n") + "\n  ];\n" +
    "  var COM_EXACT_META = " + JSON.stringify(meta) + ";\n" +
    "  // ═══ " + END + " ═══\n";
}
// القائمة صالحة الشكل: مساراتٌ بصيغة الحارس، مرتّبةٌ بلا تكرار (يفحصها البناء أيضًا)
export function badPaths(list) {
  const bad = [];
  (list || []).forEach((p, i) => {
    if (typeof p !== "string" || p !== normPath(p) || /\s/.test(p)) bad.push(String(p));
    else if (i && !(list[i - 1] < p)) bad.push(p + " (ترتيبٌ أو تكرار)");
  });
  return bad;
}

// ── الجلب ─────────────────────────────────────────────────────────────────────────────────
async function get(url, { tries = 3, timeoutMs = 45000 } = {}) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetch(url, { redirect: "manual", signal: ac.signal, headers: { "accept-language": "en-US,en;q=0.9", "accept": "text/html,application/xml;q=0.9,*/*;q=0.8" } });
      const text = r.status >= 300 && r.status < 400 ? "" : await r.text();
      clearTimeout(t);
      if (r.status >= 500 || r.status === 429) { last = new Error("HTTP " + r.status); await new Promise((res) => setTimeout(res, 1500 * (i + 1))); continue; }
      return { status: r.status, text, location: r.headers.get("location") };
    } catch (e) { clearTimeout(t); last = e; await new Promise((res) => setTimeout(res, 1000 * (i + 1))); }
  }
  throw last || new Error("fetch failed");
}
async function pool(items, n, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.max(1, n) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } });
  await Promise.all(workers);
}
async function fetchInputs({ minLocales, full, concurrency }) {
  const host = new URL(SITE).host;
  // ١) بادئات اللغات من الصفحة الرئيسة الإنجليزية
  const home = await get(SITE + "/");
  if (home.status !== 200) throw new Error("الصفحة الرئيسة: HTTP " + home.status);
  const P = prefixesOf(alternatesOf(home.text), host);
  if (!P.size) throw new Error("لا روابط hreflang في الصفحة الرئيسة — لا تُعرف بادئات اللغات");
  // ٢) الخريطة (وفهرس خرائط إن صار كذلك: أبناؤه على المضيف نفسه وحده)
  const locs = [];
  const queue = [SITE + "/sitemap.xml"], seen = new Set();
  while (queue.length) {
    const u = queue.shift();
    if (seen.has(u)) continue;
    seen.add(u);
    const r = await get(u);
    if (r.status !== 200) throw new Error("الخريطة " + new URL(u).pathname + ": HTTP " + r.status);
    const sm = parseSitemap(r.text);
    for (const c of sm.children) { try { if (new URL(c).host === host) queue.push(c); } catch {} }
    for (const l of sm.locs) { try { const x = new URL(l); if (x.host === host) locs.push(normPath(x.pathname)); } catch {} }
  }
  const { english, localized } = splitSitemap(locs, P);
  // ٣) روابط hreflang في الصفحات الإنجليزية التي لم تحسمها الخريطة (والعتبة > 1 تحتاج عدد الصفحات المحسومة أيضًا)
  const todo = [...new Set(english)].filter((p) => !underFull(p, full) && (minLocales > 1 || !(localized[p] >= 1))).sort();
  const hreflang = {}, redirects = [], errors = [], extra = new Set();
  let done = 0;
  await pool(todo, concurrency, async (p) => {
    try {
      const r = await get(SITE + p);
      if (r.status >= 300 && r.status < 400) redirects.push(p);
      else if (r.status !== 200) errors.push(p + " (HTTP " + r.status + ")");
      else {
        const alts = alternatesOf(r.text);
        for (const f of prefixesOf(alts, host)) if (!P.has(f)) extra.add(f);
        hreflang[p] = localeCount(alts, host);
      }
    } catch (e) { errors.push(p + " (" + (e && e.message || e) + ")"); }
    if (++done % 100 === 0) process.stderr.write(`  … ${done}/${todo.length}\n`);
  });
  // minLocales: العتبة التي جُلبت لها روابط hreflang — بعتبة 1 لا تُقرأ روابط الصفحات المترجمة في الخريطة (حُسمت)، فلا تجيب المدخلات عتبةً أعلى
  return { v: 1, site: SITE, fetchedAt: new Date().toISOString(), minLocales, prefixes: P.size, extraPrefixes: extra.size, sitemap: locs.length,
    english: [...new Set(english)].sort(), localized, hreflang, redirects: redirects.sort(), errors: errors.sort(), fetched: todo.length };
}

// ── التشغيل ───────────────────────────────────────────────────────────────────────────────
async function main(argv) {
  const opt = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
  const flag = (n) => argv.includes(`--${n}`);
  const minLocales = Math.max(1, parseInt(opt("min-locales", "1"), 10) || 1);
  const CML = path.resolve(opt("cml-const", path.join(EXT, "cml-const.js")));
  await import(pathToFileURL(CML).href + "?t=" + Date.now());
  const C = globalThis.CMLConst, dom = C && C.domain(DOMAIN);
  if (!dom || !dom.meta || !dom.meta.routes) { console.error("✗ لا نطاق com بحارس مسارٍ في " + CML); return 2; }
  const full = dom.meta.routes.full || [];
  const text = fs.readFileSync(CML, "utf8");
  const block = readBlock(text);
  if (!block) { console.error(`✗ لا كتلة ${BEGIN}…${END} صالحة في ${path.basename(CML)}`); return 2; }

  const from = opt("from", "");
  let inputs;
  if (from) inputs = JSON.parse(fs.readFileSync(path.join(from, "inputs.json"), "utf8"));
  else {
    if (typeof fetch !== "function") { console.error("✗ يلزم Node 18+ (fetch)"); return 2; }
    console.log(`… جلب خريطة ${SITE} وروابط hreflang (التوازي ${opt("concurrency", "6")})`);
    inputs = await fetchInputs({ minLocales, full, concurrency: Math.max(1, parseInt(opt("concurrency", "6"), 10) || 6) });
  }
  const save = opt("save", "");
  if (save) { fs.mkdirSync(save, { recursive: true }); fs.writeFileSync(path.join(save, "inputs.json"), JSON.stringify(inputs, null, 1) + "\n", "utf8"); }

  // ★ (مراجعة ر15) مدخلاتٌ محفوظة لعتبةٍ أدنى (الافتراض 1) لا تجيب عتبةً أعلى: روابط hreflang للصفحات المترجمة في الخريطة لم تُقرأ، وقد تزيد
  // على الخريطة لغةً (‎/customers/delightai-qa‎ اليوم: ثلاثٌ في الخريطة وأربعٌ في روابطها — عتبة 4 تعطي 239 حيًّا و238 من مدخلات عتبة 1). فيُنبَّه
  // ولا يُكتب منها شيء؛ والكتابة بعتبةٍ أعلى من جلبٍ حيّ بها
  const fetchedFor = Math.max(1, +inputs.minLocales || 1);
  const partial = !!from && minLocales > 1 && fetchedFor < minLocales;
  if (partial) console.log(`⚠ المدخلات جُلبت لعتبة ${fetchedFor}: روابط hreflang لم تُقرأ للصفحات المترجمة في الخريطة، فقد تنقص القائمة عن جلبٍ حيّ بعتبة ${minLocales}`);
  const r = compute(inputs, { minLocales, full });
  const prev = block.exact || [];
  const ps = new Set(prev), ns = new Set(r.exact);
  const added = r.exact.filter((p) => !ps.has(p)), removed = prev.filter((p) => !ns.has(p));
  const errors = (inputs.errors || []).length, fetched = inputs.fetched || 0;
  const g = gate(prev, r.exact, { errors, fetched, acceptDrop: flag("accept-drop"), acceptErrors: flag("accept-errors") });
  const bad = badPaths(r.exact);
  if (bad.length) g.why.push("مساراتٌ بشكلٍ غير صالح: " + bad.slice(0, 5).join("، "));
  const ok = g.ok && !bad.length;

  console.log(`الخريطة: ${inputs.sitemap ?? "—"} عنوانًا؛ إنجليزية ${r.english}، ومسارات مترجمة ${Object.keys(inputs.localized || {}).length} ببادئات ${inputs.prefixes ?? "—"}` +
    `${inputs.extraPrefixes ? ` (و${inputs.extraPrefixes} بادئةً في الروابط لا في الرئيسة)` : ""}، ومترجمةٌ بلا أصلٍ إنجليزي ${r.orphans}`);
  console.log(`hreflang: ${fetched} صفحةً جُلبت، تحويل ${(inputs.redirects || []).length}، إخفاق ${errors}`);
  console.log(`القائمة (عتبة ${minLocales} لغة): ${r.exact.length} مسارًا — من الخريطة ${r.why.sitemap}، ومن hreflang وحدها ${r.why.hreflangOnly}؛ ` +
    `وكانت ${prev.length}: +${added.length} −${removed.length}`);
  for (const p of added.slice(0, 40)) console.log("  + " + p);
  for (const p of removed.slice(0, 40)) console.log("  − " + p);
  if (added.length > 40 || removed.length > 40) console.log("  …");
  for (const e of (inputs.errors || []).slice(0, 10)) console.log("  ! " + e);
  for (const w of g.why) console.log("✗ " + w);

  const jsonOut = opt("json", "");
  const date = (inputs.fetchedAt || new Date().toISOString()).slice(0, 10);
  const meta = { at: date, sitemap: inputs.sitemap || 0, english: r.english, localized: Object.keys(inputs.localized || {}).length,
    fromSitemap: r.why.sitemap, fromHreflang: r.why.hreflangOnly, minLocales, exact: r.exact.length };
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ ok, why: g.why, added, removed, meta, errors: inputs.errors || [] }, null, 1) + "\n", "utf8");
  if (!ok) return 2;
  const same = !added.length && !removed.length && (block.meta || {}).minLocales === minLocales;
  if (!flag("write")) { console.log(same ? "✓ القائمة كما هي في الكتلة" : "ℹ القائمة تغيّرت — مرّر --write لكتابتها ثم أعد البناء"); return 0; }
  if (partial) { console.log(`✗ لا كتابة من مدخلاتٍ جُلبت لعتبة ${fetchedFor} بعتبة ${minLocales} — اجلب حيًّا بها`); return 2; }
  if (same) { console.log("✓ القائمة كما هي — لم يُكتب شيء"); return 0; }
  const next = text.slice(0, block.start) + renderBlock(r.exact, meta) + text.slice(block.end);
  fs.writeFileSync(CML, next, "utf8");
  console.log(`✓ كُتبت الكتلة في ${path.basename(CML)} (${r.exact.length} مسارًا) — أعد البناء: node web/code/toolchain/build.mjs`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error("✗ " + (e && e.stack || e)); process.exit(1); });
}
