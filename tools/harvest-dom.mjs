// harvest-dom.mjs — حاصد نصوص الواجهة من صفحات النطاق الحيّة (١-٠د). أداة بناءٍ على جهاز
// المطوّر: الإضافة نفسها لا تجمع شيئًا مما تقرؤه، وهذا الحاصد يقرأ الصفحات العامة وحده.
//
// المفاتيح تطابق ما يبحث عنه المحرّك حرفًا بحرف: الحاصد يحقن cml-shared.js في الصفحة ويستدعي
// harvestDom — القواعد نفسها التي يمشي بها المحرّك (DOM_RULES، textKey، حارس المسار)؛
// واختبار _harvesttest يثبت التطابق في الاتجاهين. و«ما لم يُترجم» يُعرف بالمحرّك الحقيقي
// على قاموس النطاق المشحون (probe-lookup.html) لا بنسخةٍ من سلسلة البحث.
//
//   node harvest-dom.mjs --domain=support --url=https://support.claude.com/en/ [--url=…]
//        [--urls=ملف-بسطرٍ-لكل-عنوان] [--crawl=20] [--quiet=1500] [--max-wait=20000]
//        [--out=مسار.json] [--chrome=…] [--headful]
//   node harvest-dom.mjs --domain=… --from=<حصادٌ سابق.json>   ← بلا زحف: يعيد فحص مفاتيحه على القاموس الحالي
//   ‎--llms‎ (نطاقٌ بفهرس صفحات، meta.scan="llms"): قائمة العناوين من فهرسه العام (meta.llms، وافتراضه /llms.txt) — كل
//        رابطٍ من أصل النطاق يُبقيه حارس المسار (الإنجليزية وحدها: ‎/docs/<locale>/‎ الأخرى خاملة)، بلا لاحقة ‎.md‎؛ ومعها
//        المسارات الكاملة بعينها (routes.exact) — وتُضمّ إلى ما مُرِّر بـ‎--url‎/‎--urls‎
//   ‎--blocks‎ (نطاقٌ ذو متون، meta.bodies): ويحصد الكتل أيضًا بالتطبيع نفسه الذي يبحث به المحرّك
//        (CMLShared.harvestBlocks) ← _harvest/blocks-<الوقت>.json (خريطة الصفحات وحال كل كتلة) و_blk_todo/todo-<الوقت>.json
//        (ما يُترجم بترتيب الزحف: [{fp, src}]). الحال: ui كتلةٌ من عقدةٍ واحدة يترجمها قاموس الواجهة، group-ui صفُّ
//        لافتاتٍ بنودُه كلها في قاموس الواجهة، dict في قاموس الكتل، kept قُضي بإبقائها إنجليزية، todo ما سواها.
//   ‎--expand‎: يفتح كل <details> مغلقٍ داخل المتن قبل الحصاد (محتوى الأكورديون لا يُركَّب قبل فتحه).
//   ★ (S7-B، ٢١ ربيع الآخر ١٤٤٨هـ — مرجع الواجهة البرمجية في الوثائق) خياراتٌ لحصادٍ مستقلٍّ لقسمٍ من الموقع:
//   ‎--prefix=/docs/en/api/‎: يُبقي من القائمة (‎--llms‎ و‎--url‎ و‎--urls‎) ما بدأ مساره بالبادئة وحدها.
//   ‎--ui-zone=<محدِّد>‎ (مع ‎--blocks‎): كتلٌ داخل المتن هي أسماءٌ لا جمل (عنوان الصفحة وبنود المسار وعناوين الطرق في المرجع)
//        يترجمها قاموس الواجهة لا قاموس الكتل — فما لم يُترجم منها حالُه ui-name (لا todo)، ونصوصها (والبنود في صفّ اللافتات)
//        في names-<الوقت>.json/.txt بجوار الحصاد؛ وكتلةٌ من عقدةٍ واحدة خارجها نصُّها اسمٌ منها (وصفٌ يساوي عنوانه) مثلها.
//   ‎--known=<مجلد>[,<مجلد>…]‎: بصماتٌ في دفعات ‎[{fp,…}]‎ بتلك المجلدات (قطعٌ قيد الترجمة أو مترجمةٌ لم تُدمج) حالُها queued لا todo.
//   ‎--todo-dir=<مجلد>‎: موضع todo-<الوقت>.json (افتراضه <مجلد عمل النطاق>/_blk_todo)؛ و‎--chunk=250 --chunk-name=docs-api‎:
//        وقطعٌ بصيغة p4 ‏‎[{fp, src}]‎ في ‎--chunk-dir‎ (افتراضه <todo-dir>/p4) باسم <الاسم>-NNN.json — كتل الصفحة الواحدة متجاورة
//        ولا تُقسم إلا صفحةٌ تزيد وحدها على الحجم؛ ومجموعاتُ ‎--chunk-groups=<بادئة>|<بادئة>‎ تبدأ كلٌّ منها قطعةً جديدة.
//
// المنطقة (meta.bodySel): ما وقع داخل متن المقالة «body» (يُترجم في المرحلة ٤)، وما سواه
// «ui» (الواجهة: المرحلة ١)؛ ومفتاحٌ في الموضعين «both» يُعدّ من الواجهة.
//
// الناتج: <مجلد عمل النطاق>/_harvest/harvest-<الوقت>.json (كل مفتاح: أنواعه وعدده وأول
// صفحاته وهل يترجمه القاموس الحالي) و….missing.txt (غير المترجم، سطرًا لكل مفتاح)؛ و….missing-ui.txt (غير المترجم من الواجهة)،
// و★ (ر5) ….missing-body-attrs.txt (سماتٌ داخل المتن بلا ترجمة: لا تترجمها قطع المتون، ويترجمها قاموس الواجهة وحده).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { EXT } from "./paths.mjs";
import { C, SHARED, domainArg, workDir, label, blocksDictFile } from "./domain-arg.mjs";
import { launch, settle } from "./cdp-lib.mjs";

const argv = process.argv.slice(2);
const opt = (name, def) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : def; };
const D = domainArg(process.argv);
const DOM = C.domain(D);
const META = DOM.meta || {};

let urls = argv.filter((x) => x.startsWith("--url=")).map((x) => x.slice(6));
const urlsFile = opt("urls", "");
if (urlsFile) urls = urls.concat(fs.readFileSync(urlsFile, "utf8").split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith("#")));
// ★ (وثائق Claude Code) الفهرس العام مصدرُ القائمة: الملفّ نفسه الذي يقرؤه ماسح llms في المحرّك وبوابة الشمول —
// فما تعدّه البوابة «مقصودًا» هو بعينه ما يُحصد. روابطه نسخ ‎.md‎ للصفحات، فتُنزع اللاحقة لتُحصد صفحتها
if (argv.includes("--llms")) {
  if (META.scan !== "llms") { console.error(`! ${label(D)} بلا فهرس صفحات (meta.scan ليس llms)`); process.exit(2); }
  const src = DOM.origin + (typeof META.llms === "string" && META.llms.charAt(0) === "/" ? META.llms : "/llms.txt");
  const res = await fetch(src, { redirect: "error", headers: { "User-Agent": "claude-mutarjim harvest (public index, build-time)" } });
  if (!res.ok) { console.error(`! تعذّر جلب ${src}: HTTP ${res.status}`); process.exit(1); }
  const txt = await res.text();
  const fromIdx = [];
  for (const m of txt.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) {
    let u; try { u = new URL(m[1]); } catch { continue; }
    if (u.origin !== DOM.origin) continue;
    // والمسار القانوني: «…/index» مسارُ أبيه (الفهرس يذكر ‎/docs/en/whats-new/index‎ والموقع ‎/docs/en/whats-new‎ — مراجعة
    // القيود، ١٦ ربيع الآخر ١٤٤٨هـ)؛ ومفتاح الصفحة في الحصاد من SHARED.pageKey بالقاعدة نفسها
    const p = u.pathname.replace(/\.md$/, "").replace(/\/index$/, "") || "/";
    if (SHARED.routeMode(META.routes, p) === "inactive") continue;
    fromIdx.push(u.origin + p);
  }
  for (const p of (META.routes && META.routes.exact) || []) fromIdx.push(DOM.origin + p);
  console.log(`فهرس ${src}: ${fromIdx.length} عنوانًا في مسارات النطاق`);
  urls = urls.concat(fromIdx);
}
// ★ (S7-B) قسمٌ من الموقع وحده (‎--prefix‎): ما بدأ مساره بالبادئة — قبل البداية الافتراضية فلا تُستبدل بها قائمةٌ صُفّيت كلّها
const PREFIX = opt("prefix", "");
if (PREFIX) {
  const n0 = urls.length;
  urls = urls.filter((u) => { try { return new URL(u).pathname.indexOf(PREFIX) === 0; } catch { return false; } });
  console.log(`البادئة ${PREFIX}: ${urls.length} عنوانًا من ${n0}`);
  if (!urls.length) { console.error("! لا عنوان تحت البادئة"); process.exit(2); }
}
// البداية الافتراضية: أول مسارٍ كامل، وإلا بادئة المطابقة في المانيفست (مركزا المساعدة والخصوصية تحت ‎/en/‎)
if (!urls.length) urls = [META.routes && META.routes.full ? DOM.origin + META.routes.full[0] : DOM.matches[0].replace(/\*$/, "")];
const CRAWL = Math.max(0, +opt("crawl", "0") || 0);
const QUIET = +opt("quiet", "1500") || 1500;
const MAXW = +opt("max-wait", "20000") || 20000;
const BLOCKS = argv.includes("--blocks");
if (BLOCKS && !(META.bodies && META.bodySel)) { console.error(`! ${label(D)} بلا متون (meta.bodies) — لا حصاد كتل`); process.exit(2); }
const UI_ZONE = opt("ui-zone", "");
const CHUNK_N = Math.max(0, +opt("chunk", "0") || 0);
const CHUNK_NAME = opt("chunk-name", D);
const CHUNK_GROUPS = opt("chunk-groups", "").split("|").filter(Boolean);
if (CHUNK_N && !/^[a-z0-9][a-z0-9-]*$/.test(CHUNK_NAME)) { console.error(`! ‎--chunk-name‎ حروفٌ صغيرة وأرقام وشرطات: «${CHUNK_NAME}»`); process.exit(2); }
const TODO_DIR = path.resolve(opt("todo-dir", path.join(workDir(D), "_blk_todo")));
const CHUNK_DIR = path.resolve(opt("chunk-dir", path.join(TODO_DIR, "p4")));
// قطعٌ بالاسم نفسه قائمةٌ قبل زحفٍ طويل ⇒ خروجٌ الآن لا بعده (قد تكون بيد المترجمين)؛ ‎--overwrite-chunks‎ يأذن صراحةً
if (CHUNK_N && fs.existsSync(CHUNK_DIR) && !argv.includes("--overwrite-chunks")) {
  const clash = fs.readdirSync(CHUNK_DIR).filter((n) => n.startsWith(CHUNK_NAME + "-") && /-\d{3}\.json$/.test(n));
  if (clash.length) { console.error(`! في ${CHUNK_DIR} قطعٌ باسم ${CHUNK_NAME}-NNN (${clash.length}) — ‎--overwrite-chunks‎ أو اسمٌ آخر`); process.exit(2); }
}
const pageGroup = new Map(); // مفتاح الصفحة ← رقم أول مجموعةٍ يطابق محدِّدُها شيئًا فيها (‎--chunk-groups‎)
// بصماتٌ قيد الترجمة أو مترجمةٌ لم تُدمج بعد (‎--known‎): لا تُعاد إلى الطابور
const KNOWN = new Set();
for (const dir of opt("known", "").split(",").filter(Boolean)) {
  if (!fs.existsSync(dir)) { console.error("! ‎--known‎ مجلدٌ غير موجود: " + dir); process.exit(2); }
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    let arr; try { arr = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
    if (Array.isArray(arr)) for (const x of arr) if (x && typeof x.fp === "string") KNOWN.add(x.fp);
  }
}

// عنوانٌ يصلح للحصاد: من النطاق نفسه (مطابقات المانيفست) وحارسُ المسار لا يجعله خاملًا
function eligible(u) {
  let x; try { x = new URL(u); } catch { return null; }
  const dom = C.domainOfUrl(x.href);
  if (!dom || dom.id !== D) return null;
  const mode = SHARED.routeMode(META.routes, x.pathname);
  if (mode === "inactive") return null;
  x.hash = ""; x.search = "";
  return { href: x.href, mode };
}

const SRC = ["cml-const.js", "cml-shared.js"].map((f) => fs.readFileSync(path.join(EXT, f), "utf8")).join("\n;\n");

const LAUNCH = { chrome: opt("chrome", ""), headless: !argv.includes("--headful") };
let cdp = await launch(LAUNCH);
// ★ زحفٌ طويل (مئات الصفحات) لا يسقط كلّه بصفحةٍ علقت: تعذّر فتحها ⇒ تُترك وتُذكر؛ وتتابعُ الإخفاق
// يعني متصفحًا عالقًا ⇒ يُعاد تشغيله ويُستأنف الطابور (قِيس: مهلة Page.enable بعد 154 صفحة أسقطت الحصاد كله)
let openFails = 0;
const skipped = [];
async function openOrSkip(href) {
  for (let t = 0; t < 2; t++) {
    try { const r = await cdp.openPage(href); openFails = 0; return r; }
    catch (err) {
      openFails++;
      console.warn(`⚠ تعذّر فتح ${href} — ${err.message}`);
      if (openFails >= 2) {
        console.warn("  ↻ إعادة تشغيل المتصفح");
        try { cdp.close(); } catch {}
        cdp = await launch(LAUNCH);
        openFails = 0;
      }
    }
  }
  skipped.push(href);
  return null;
}
const keys = new Map();   // key → {kinds:Set, count, pages:[]}
const blocks = new Map(); // fp → {tpl, count, pages:[], single, group}  (--blocks)
const pageBlocks = new Map(); // مفتاح الصفحة → [fp…] بترتيب الوثيقة
const pageUrls = new Map();
let pages = [];
const FROM = opt("from", "");
if (FROM) {
  // إعادة الفحص وحدها: المفاتيح ومناطقها وصفحاتها من الحصاد السابق، ولا زحف
  const prev = JSON.parse(fs.readFileSync(FROM, "utf8"));
  if (prev.domain !== D) { console.error(`! الحصاد لنطاق ${prev.domain} لا ${D}`); process.exit(2); }
  pages = prev.pages || [];
  for (const r of prev.keys || []) keys.set(r.key, { kinds: new Set(r.kinds), count: r.count, pages: r.pages, body: r.zone === "body" || r.zone === "both" ? 1 : 0, ui: r.zone === "body" ? 0 : 1 });
  urls = [];
}
const seen = new Set();
const queue = [];
for (const u of urls) {
  const e = eligible(u);
  if (!e) { console.warn("⚠ خارج النطاق أو خاملٌ بحارس المسار — تُرك: " + u); continue; }
  if (!seen.has(e.href)) { seen.add(e.href); queue.push(e); }
}
let crawled = 0;
try {
  while (queue.length) {
    const e = queue.shift();
    const opened = await openOrSkip(e.href);
    if (!opened) continue;
    const { targetId, sessionId } = opened;
    let got = [], bodyGot = [], blkGot = [], blkGroup = null, links = [], waited = 0, finalUrl = e.href, pageErr = null;
    try {
      waited = await settle(cdp, sessionId, { quietMs: QUIET, maxMs: MAXW });
      finalUrl = await cdp.evalIn(sessionId, "location.href");
      // تحويلٌ إلى خارج النطاق (صفحة دخول مثلًا) ⇒ لا حصاد: مفاتيحها ليست من هذا الموقع
      if (!eligible(finalUrl)) throw new Error("حُوِّل إلى خارج النطاق: " + finalUrl);
      // ★ صفحة تحدّي Cloudflare على العنوان نفسه (قِيس: ‎/docs/en/claude-tag‎ في فهرس وثائق Claude Code يردّ 403 بتحدٍّ
      // مترجَمٍ بلغة المتصفح) ⇒ لا حصاد: نصوصها ليست من واجهة الموقع، وكانت تدخل القاموس «مفاتيح واجهة»
      if (await cdp.evalIn(sessionId, "!!document.querySelector('script[src*=\"/cdn-cgi/challenge-platform/\"], #challenge-form, #challenge-error-text') || typeof window._cf_chl_opt !== 'undefined'")) {
        pageErr = "تحدّي Cloudflare (لا واجهة موقع)";
        throw new Error(pageErr);
      }
      // ★ (ر3، ٢٨ ربيع الآخر ١٤٤٨هـ) وثيقةٌ يعرضها الموقع بلغةٍ أخرى (منتقي لغة الوثيقة في anthropic.com/legal يبدأ بلغة بلد الزائر إن
      // وُجدت ترجمتها، والحاصد قد يعمل من بلدٍ كهذا) ⇒ لا حصاد: كتلها ليست المتن الإنجليزي. وعنصرٌ لا يُوجد إنذارٌ بانجراف المحدِّد
      // (المحرّك عندئذٍ لا يخمد، فالحارس أعمى حتى يُصلَح)
      if (META.siteLangSel) {
        const lab = await cdp.evalIn(sessionId, `(function(){var e=document.querySelector(${JSON.stringify(META.siteLangSel)});` +
          `return e?(e.textContent||"").replace(/\\s+/g," ").trim():null;})()`);
        if (lab === null) console.warn(`⚠ ${e.href} — meta.siteLangSel لا يطابق شيئًا: هل تغيّر مكوّن المنتقي؟`);
        else if ((META.siteLangOk || ["English"]).indexOf(lab) < 0) { pageErr = "الوثيقة معروضةٌ بلغةٍ أخرى من منتقي الصفحة"; throw new Error(pageErr); }
      }
      // ★ (ر4، ٢٨ ربيع الآخر ١٤٤٨هـ) واجهةٌ بلغةٍ أخرى في صفحةٍ بلا بادئة لغة (الأكاديمية تكتب لغة واجهتها في <html lang> بعد التركيب:
      // اختيارٌ محفوظ أو لغة المتصفح، والحاصد قد يعمل بلغة متصفحٍ كهذه) ⇒ لا حصاد: نصوصها ليست واجهة الموقع الإنجليزية. كحارس siteLang في
      // المحرّك، وللنطاقات التي تعلنه وحدها (والصفحات الإنجليزية لا يمسّها)
      if (META.siteLang && await cdp.evalIn(sessionId, "!/^en(-|$)/i.test(document.documentElement.getAttribute('lang') || 'en')")) {
        pageErr = "الواجهة معروضةٌ بلغةٍ أخرى (<html lang>)";
        throw new Error(pageErr);
      }
      await cdp.evalIn(sessionId, SRC + "\n;true");
      // ‎--expand‎: المطويّ في المتن لا يُركَّب قبل فتحه (أكورديونات Mintlify: قِيس في صفحة errors ‏48,665 كلمة في HTML
      // الخادم و15,863 في DOM) — فيُفتح كل <details> مغلقٍ داخل المتن بنقر ملخّصه ثم يُنتظر الهدوء، فتُحصد كتله كما
      // يراها المحرّك حين يفتحها القارئ
      if (argv.includes("--expand") && META.bodySel) {
        const opened = await cdp.evalIn(sessionId, `(function () { var n = 0;
          Array.prototype.forEach.call(document.querySelectorAll(${JSON.stringify(META.bodySel)}), function (root) {
            Array.prototype.forEach.call(root.querySelectorAll("details:not([open]) > summary"), function (s) { try { s.click(); n++; } catch (e) {} });
          }); return n; })()`);
        if (opened) await settle(cdp, sessionId, { quietMs: 800, maxMs: 10000 });
      }
      // المستثنى كما يستثنيه المحرّك: المرجع في shell، وmeta.skipSel (أجوبة المساعد المولَّدة) في كل مسار
      // بلا سقف طول كالمحرّك (٢١ ربيع الآخر ١٤٤٨هـ، توجيه المالك: لا يمنع حدٌّ تقني تعريب نصّ موقعٍ مهما طال)
      const SKIP = JSON.stringify(SHARED.harvestSkip(META, e.mode));
      got = await cdp.evalIn(sessionId,
        `CMLShared.harvestDom(document.documentElement, { chat: ${!!META.chat}, max: Infinity, skip: ${SKIP} })`, 60000);
      if (META.bodySel) {
        bodyGot = await cdp.evalIn(sessionId, `[].concat.apply([], Array.prototype.map.call(document.querySelectorAll(${JSON.stringify(META.bodySel)}),
          function (el) { return CMLShared.harvestDom(el, { chat: ${!!META.chat}, max: Infinity, skip: ${SKIP} }); }))`, 60000);
      }
      // الكتل في المسار الكامل وحده (المحرّك لا يطلب متونًا في shell)
      if (BLOCKS && e.mode === "full") {
        blkGot = await cdp.evalIn(sessionId, `CMLShared.harvestBlocks(document, { body: ${JSON.stringify(META.bodySel)}, skip: ${SKIP} })`, 60000);
        // ‎--ui-zone‎: بصمات الكتل التي نصُّها في منطقة الأسماء — بالحاصد نفسه وجذورُه المنطقة (الحدود والقالب كما هما)
        if (UI_ZONE) {
          const zf = new Set(await cdp.evalIn(sessionId, `CMLShared.harvestBlocks(document, { body: ${JSON.stringify(UI_ZONE)}, skip: ${SKIP} })
            .map(function (b) { return b.fp; })`, 60000));
          for (const h of blkGot) if (zf.has(h.fp)) h.zone = "ui";
        }
        if (CHUNK_GROUPS.length) {
          blkGroup = await cdp.evalIn(sessionId, `(function (gs) { for (var i = 0; i < gs.length; i++) { try { if (document.querySelector(gs[i])) return i; } catch (e) {} }
            return gs.length; })(${JSON.stringify(CHUNK_GROUPS)})`);
        }
      }
      if (CRAWL && crawled < CRAWL) {
        links = await cdp.evalIn(sessionId, "Array.from(document.querySelectorAll('a[href]')).map(function (a) { return a.href; })");
      }
    } catch (err) {
      // ★ كل إخفاقٍ يُسجَّل خطأً في سجلّ الصفحة (مهلة، تحويلٌ إلى خارج النطاق، تحدٍّ): بوابة الشمول لا تعدّها «محصودة»
      pageErr = pageErr || err.message;
      console.warn("⚠ " + e.href + " — " + err.message);
    } finally {
      await cdp.closePage(targetId);
    }
    pages.push(pageErr ? { url: e.href, final: finalUrl, mode: e.mode, keys: 0, settledMs: waited, error: pageErr }
      : { url: e.href, final: finalUrl, mode: e.mode, keys: got.length, settledMs: waited });
    console.log(`• ${e.href}  [${e.mode}]  ${got.length} مفتاحًا`);
    // المنطقة: ما حُصد من المتن يُطرح من حصاد الصفحة بعدده — فالباقي من الواجهة
    const inBody = new Map();
    for (const h of bodyGot) inBody.set(h.key + "\u0000" + h.kind, (inBody.get(h.key + "\u0000" + h.kind) || 0) + 1);
    for (const h of got) {
      let k = keys.get(h.key);
      if (!k) { k = { kinds: new Set(), count: 0, pages: [], body: 0, ui: 0 }; keys.set(h.key, k); }
      k.kinds.add(h.kind); k.count++;
      const bk = h.key + "\u0000" + h.kind, bn = inBody.get(bk) || 0;
      if (bn > 0) { k.body++; inBody.set(bk, bn - 1); } else k.ui++;
      if (k.pages.length < 3 && !k.pages.includes(e.href)) k.pages.push(e.href);
    }
    if (blkGot.length) {
      const pk = SHARED.pageKey(META, new URL(finalUrl).pathname);
      const list = pageBlocks.get(pk) || [];
      for (const h of blkGot) {
        let b = blocks.get(h.fp);
        if (!b) { b = { tpl: h.tpl, count: 0, pages: [], single: h.single, group: h.group }; blocks.set(h.fp, b); }
        else if (b.tpl !== h.tpl) throw new Error(`تعارض بصمة: ${h.fp} لقالبين مختلفين — لا يُكمل الحصاد`);
        if (h.zone === "ui") b.uiZone = true;
        b.count++;
        if (b.pages.length < 3 && !b.pages.includes(pk)) b.pages.push(pk);
        if (!list.includes(h.fp)) list.push(h.fp);
      }
      pageBlocks.set(pk, list);
      pageUrls.set(pk, finalUrl);
      if (blkGroup !== null && !pageGroup.has(pk)) pageGroup.set(pk, blkGroup);
      console.log(`    ${blkGot.length} كتلة (${pk})`);
    }
    for (const l of links) {
      if (crawled >= CRAWL) break;
      const x = eligible(l);
      if (x && !seen.has(x.href)) { seen.add(x.href); queue.push(x); crawled++; }
    }
  }

  // ---- ما لم يُترجم: المحرّك الحقيقي بقاموس النطاق المشحون (المِسبار) ----
  const list = [...keys.keys()];
  const probeUrl = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "probe-lookup.html")).href + "?d=" + D;
  const pr = await cdp.openPage(probeUrl);
  const ready = await cdp.until(pr.sessionId, "window.__probeReady === true && document.readyState === 'complete'", 15000);
  if (!ready) throw new Error("المِسبار لم يحمّل قاموس النطاق — هل بُني dict (build.mjs)؟");
  const missing = new Set();
  const CHUNK = 500;
  for (let i = 0; i < list.length; i += CHUNK) {
    const part = list.slice(i, i + CHUNK);
    const res = await cdp.evalIn(pr.sessionId, `(function (keys) {
      var box = document.getElementById("probe"); box.textContent = "";
      var ps = keys.map(function (k) { var p = document.createElement("p"); p.textContent = k; box.appendChild(p); return p; });
      return new Promise(function (res) { setTimeout(function () {
        res(ps.map(function (p, j) { return p.textContent === keys[j] ? 0 : 1; }));
      }, 900); });
    })(${JSON.stringify(part)})`, 60000);
    res.forEach((t, j) => { if (!t) missing.add(part[j]); });
  }
  await cdp.closePage(pr.targetId);

  // ---- الناتج ----
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13);
  const outPath = opt("out", "") || path.join(workDir(D), "_harvest", `harvest-${stamp}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const rows = list.sort((a, b) => a.localeCompare(b)).map((k) => {
    const v = keys.get(k);
    const zone = !META.bodySel ? "ui" : v.ui && v.body ? "both" : v.body ? "body" : "ui";
    return { key: k, kinds: [...v.kinds].sort(), count: v.count, zone, pages: v.pages, translated: !missing.has(k) };
  });
  fs.writeFileSync(outPath, JSON.stringify({
    _tool: "harvest-dom", domain: D, at: new Date().toISOString(), textMax: null,
    pages, total: rows.length, missing: missing.size, keys: rows,
  }, null, 1), "utf8");
  const missPath = outPath.replace(/\.json$/, "") + ".missing.txt";
  fs.writeFileSync(missPath, rows.filter((r) => !r.translated).map((r) => r.key).join("\n") + "\n", "utf8");
  // وغير المترجم من الواجهة وحدها (المرحلة ١): ما ليس من المتن الخالص
  const uiMiss = rows.filter((r) => !r.translated && r.zone !== "body");
  fs.writeFileSync(missPath.replace(/\.missing\.txt$/, ".missing-ui.txt"), uiMiss.map((r) => r.key).join("\n") + "\n", "utf8");
  if (META.bodySel) console.log(`  منها للواجهة: ${uiMiss.length} (والمتن الخالص ${rows.filter((r) => r.zone === "body").length} — للمرحلة ٤)`);
  // ★ (ر5، ٢٩ ربيع الآخر ١٤٤٨هـ — ملاحظة ر3) السمات داخل المتن (aria-label وtitle وalt وplaceholder) لا تترجمها قطع المتون (الكتلة عقدُ نصٍّ
  // لا سمات)، ويترجمها قاموس الواجهة وحده؛ وكانت تسقط من missing-ui (منطقتها body) ومن الشمول معًا. فئةٌ مستقلة في ملفٍّ بجوار missing-ui،
  // وmissing-ui نفسه كما كان (مدخلات ترجمة الواجهة لا تتغيّر)
  const bodyAttr = META.bodySel ? rows.filter((r) => r.zone === "body" && r.kinds.some((k) => k.indexOf("attr:") === 0)) : [];
  const bodyAttrMiss = bodyAttr.filter((r) => !r.translated);
  if (META.bodySel) {
    fs.writeFileSync(missPath.replace(/\.missing\.txt$/, ".missing-body-attrs.txt"), bodyAttrMiss.map((r) => r.key).join("\n") + "\n", "utf8");
    console.log(`  وسماتٌ داخل المتن بلا ترجمة: ${bodyAttrMiss.length} من ${bodyAttr.length} (يترجمها قاموس الواجهة وحده — فئةٌ مستقلة)`);
  }
  console.log(`\n${label(D)}: ${pages.length} صفحة، ${rows.length} مفتاحًا، غير المترجم ${missing.size}`);
  console.log("  " + outPath + "\n  " + missPath);

  if (skipped.length) console.log(`  ⚠ صفحاتٌ تُركت لتعذّر فتحها (${skipped.length}): ${skipped.slice(0, 5).join(" ، ")}${skipped.length > 5 ? " …" : ""}`);

  // ---- الكتل (--blocks): حال كل كتلة، وما يُترجم بترتيب الزحف ----
  if (BLOCKS) {
    const bj = fs.existsSync(blocksDictFile(D)) ? JSON.parse(fs.readFileSync(blocksDictFile(D), "utf8")) : {};
    const bdict = bj.blocks || {}, bkept = new Set(bj.kept || []);
    const uiOk = (k) => !!k && keys.has(k) && !missing.has(k);
    const noWord = (k) => !k || !/[A-Za-z]/.test(k);
    // ★ (S7-B) ‎--ui-zone‎: نصوص كتل الأسماء — عقدتها الوحيدة، أو بنود صفّ اللافتات (بندٌ بعقدٍ عدّة false: الكتلة كلّها للترجمة)
    const nameTexts = (b) => b.single ? [b.single] : b.group && b.group.every((k) => k !== false) ? b.group.filter((k) => typeof k === "string") : null;
    const names = new Map(); // نصّ ← {count, pages}
    if (UI_ZONE) for (const b of blocks.values()) {
      if (!b.uiZone) continue;
      for (const k of nameTexts(b) || []) {
        let n = names.get(k);
        if (!n) { n = { count: 0, pages: [] }; names.set(k, n); }
        n.count += b.count;
        for (const pk of b.pages) if (n.pages.length < 3 && !n.pages.includes(pk)) n.pages.push(pk);
      }
    }
    const rowsB = [], todo = [], tally = {}, statusOf = new Map();
    for (const [fp, b] of blocks) {
      let status = "todo";
      if (Object.prototype.hasOwnProperty.call(bdict, fp)) status = "dict";
      else if (bkept.has(fp)) status = "kept";
      else if (b.single && uiOk(b.single)) status = "ui";
      // بندٌ بعقدٍ عدّة (false) يحتاج ترجمةً ولا يغطّيه قاموس الواجهة
      else if (b.group && b.group.every((k) => k !== false && (noWord(k) || uiOk(k)))) status = "group-ui";
      // اسمٌ يترجمه قاموس الواجهة (منطقة الأسماء، أو كتلةٌ من عقدةٍ واحدة نصُّها اسمٌ منها) — لا قاموس الكتل
      else if (UI_ZONE && ((b.uiZone && nameTexts(b)) || (b.single && names.has(b.single)))) status = "ui-name";
      else if (KNOWN.has(fp)) status = "queued";
      tally[status] = (tally[status] || 0) + 1;
      statusOf.set(fp, status);
      rowsB.push({ fp, tpl: b.tpl, count: b.count, pages: b.pages, status, ...(b.uiZone ? { zone: "ui" } : {}) });
      if (status === "todo") todo.push({ fp, src: b.tpl });
    }
    const bOut = path.join(path.dirname(outPath), `blocks-${stamp}.json`);
    fs.writeFileSync(bOut, JSON.stringify({
      _tool: "harvest-dom --blocks", domain: D, at: new Date().toISOString(), v: SHARED.BLOCK.V,
      pages: Object.fromEntries(pageBlocks), urls: Object.fromEntries(pageUrls), tally, blocks: rowsB,
      // مجموعة كل صفحةٍ في ‎--chunk-groups‎ (رقم أول محدِّدٍ طابق فيها) — فتُعاد القطع من الحصاد نفسه بلا زحف
      ...(CHUNK_GROUPS.length ? { chunkGroups: CHUNK_GROUPS, groups: Object.fromEntries(pageGroup) } : {}),
    }, null, 1), "utf8");
    const tDir = TODO_DIR;
    fs.mkdirSync(tDir, { recursive: true });
    const tOut = path.join(tDir, `todo-${stamp}.json`);
    fs.writeFileSync(tOut, JSON.stringify(todo, null, 1) + "\n", "utf8");
    // الكلمات: نصُّ الكتلة بلا عناصرها النائبة — والشيفرة (<cN>…</cN>) تُنسخ ولا تُترجم فلا تُعدّ
    const wordsOf = (s) => (String(s).replace(/<c(\d+)>[\s\S]*?<\/c\1>/g, " ").replace(/<[^>]+>/g, " ").match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
    const words = todo.reduce((n, t) => n + wordsOf(t.src), 0);
    console.log(`\nالكتل: ${blocks.size} في ${pageBlocks.size} صفحة — ${Object.entries(tally).map(([k, v]) => k + " " + v).join("، ")}؛ للترجمة ${todo.length} (≈${words} كلمة)`);
    console.log("  " + bOut + "\n  " + tOut);
    if (UI_ZONE) {
      // الأسماء لقاموس الواجهة: ما لم يترجمه القاموس الحالي ولا يخلو من حرفٍ لاتيني
      const nm = [...names].filter(([k]) => !uiOk(k) && !noWord(k)).sort((a, b) => b[1].count - a[1].count)
        .map(([en, v]) => ({ en, count: v.count, pages: v.pages }));
      const nOut = path.join(path.dirname(outPath), `names-${stamp}.json`);
      fs.writeFileSync(nOut, JSON.stringify(nm, null, 1) + "\n", "utf8");
      fs.writeFileSync(nOut.replace(/\.json$/, ".txt"), nm.map((x) => x.en).join("\n") + "\n", "utf8");
      const nw = nm.reduce((n, x) => n + wordsOf(x.en), 0);
      console.log(`الأسماء (منطقة ${UI_ZONE}): ${names.size} نصًّا فريدًا، منها بلا ترجمةٍ في قاموس الواجهة ${nm.length} (≈${nw} كلمة)\n  ${nOut}`);
    }
    if (CHUNK_N) {
      // قطع p4: بترتيب المجموعات ثم الزحف، وكتل الصفحة الواحدة متجاورة؛ وصفحةٌ تزيد وحدها على الحجم تُقسم
      const order = [...pageBlocks.keys()].map((pk, i) => ({ pk, i, g: pageGroup.has(pk) ? pageGroup.get(pk) : CHUNK_GROUPS.length }))
        .sort((a, b) => a.g - b.g || a.i - b.i);
      const emitted = new Set(), chunks = [];
      let cur = [], curG = null;
      const flush = () => { if (cur.length) chunks.push(cur); cur = []; };
      for (const { pk, g } of order) {
        const mine = pageBlocks.get(pk).filter((fp) => statusOf.get(fp) === "todo" && !emitted.has(fp));
        if (!mine.length) continue;
        if (curG !== null && g !== curG) flush();
        curG = g;
        if (cur.length && cur.length + mine.length > CHUNK_N && cur.length >= CHUNK_N / 2) flush();
        for (const fp of mine) {
          emitted.add(fp);
          cur.push({ fp, src: blocks.get(fp).tpl });
          if (cur.length >= Math.round(CHUNK_N * 1.2)) flush();
        }
      }
      flush();
      fs.mkdirSync(CHUNK_DIR, { recursive: true });
      chunks.forEach((c, i) => {
        const f = path.join(CHUNK_DIR, `${CHUNK_NAME}-${String(i).padStart(3, "0")}.json`);
        fs.writeFileSync(f, JSON.stringify(c, null, 1) + "\n", "utf8");
        console.log(`  ${f}  (${c.length} كتلة، ≈${c.reduce((n, t) => n + wordsOf(t.src), 0)} كلمة)`);
      });
    }
  }
} finally {
  cdp.close();
}
