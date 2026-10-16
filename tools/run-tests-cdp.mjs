// run-tests-cdp.mjs — مشغّل الاختبارات المتصفحية بلا واجهة وبلا npm (المرحلة ٥).
//
// يشغّل كروم Headless عبر بروتوكول DevTools (CDP) مباشرةً: خادمُ ملفاتٍ مدمجٌ على
// منفذٍ عشوائي، ثم فتحُ كل صفحة اختبار وقراءةُ عنوانها — والعقدُ الواحد في كل
// الصفحات: العنوان «اسم N/N» ولا ينجح إلا بتساوي الطرفين. لا تبعيات: WebSocket
// مدمجة في Node منذ 22 (نفحصها ونصرّح إن غابت).
//
//   node run-tests-cdp.mjs [--filter=swtest] [--chrome="مسار كروم"]
// متغيرات البيئة: CHROME (مسار المتصفح)، CI (يضيف --no-sandbox لعدّائي CI).
// رمز الخروج: 0 كله ناجح، 1 إخفاق أو تعذّر تشغيل.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { ROOT } from "./paths.mjs";
import { tempProfile } from "./cdp-lib.mjs";

if (typeof WebSocket === "undefined") {
  console.error("! يلزم Node 22+ (فيه WebSocket مدمجة) — الحالي: " + process.version);
  process.exit(1);
}

// ---- صفحات الاختبار: الاسم في العنوان هو العقد ----
// ★ (١-٠د) هوية الاختبار وحدّه الأدنى: min = عدد التحققات يوم ثُبّت — صفحةٌ تُسقط تحققاتها
// صامتةً (خطأٌ يُنهيها مبكرًا بعنوانٍ متساوي الطرفين، أو حذفٌ غير مقصود) تُخفق. والتحققات
// الحرجة (★) بأسمائها في test/_critical.json: كلٌّ منها يجب أن يُرى ناجحًا باسمه
// (‎--update-critical‎ يعيد كتابة القائمة بعد تغييرٍ مقصود، ويُراجَع الفرق في الإيداع).
const PAGES = [
  // ★ (ت6-ب، المراجعة، ٥ جمادى الأولى ١٤٤٨هـ — القرار 99) +5 في selftest: «Created {date}» بتاريخين بأسماء الشهور ونصٌّ ليس تاريخًا يبقى،
  // و«12 running» بالشقيق الرقمي و«Trail running» لا يُمسّ بعد حذف «{activeCount} running» العام
  // ★ (ت6-ج، المراجعة، ٥ جمادى الأولى ١٤٤٨هـ) +4 في selftest: «Out of free messages (again) until …» باليوم والوقت والغد معرَّبةً،
  // وصيغةٌ بمسافةٍ ضيقة غير فاصلة قبل PM (كما يكتبها Intl في كروم)
  { file: "_selftest.html", name: "selftest", min: 45 },
  { file: "_ruletest.html", name: "ruletest", min: 20 },
  // ★ (ر7-ب، ٣٠ ربيع الآخر ١٤٤٨هـ) +2 في dirtest (مكوّن الاختصار LTR وفقرةٌ عربية بمفتاحين على اتجاهها)، و+3 في codetest (لافتة صدى العنوان
  // تتبع حارس المتن)، و+4 في apireftest (لافتة «القسم الحالي» في الوثائق، وعزلها اللاتيني، ودفعة الطفرات)، و+2 في options (سطرا حال المحرّك يسقطان بإطفاء التبويب، ومعاينة الخط)
  { file: "_dirtest.html", name: "dirtest", min: 24 },
  // ★ (ر9-ب، ٣ جمادى الأولى ١٤٤٨هـ — القرار 95) إصلاحات app-point.css بالمحرّك الحقيقي وأوراق التطبيق بترتيب المانيفست: حقل البريد في /login
  // (dir="ltr" من الموقع) RTL وهو فارغ وLTR من أول حرف، ولا يمسّ حقلًا LTR غيره، ولا أثر له بإطفاء القلب أو الإضافة
  { file: "_apppointtest.html", name: "apppoint", min: 8 },
  { file: "_termstest.html", name: "terms", min: 19 },
  // ★ (ر8-د، ١ جمادى الأولى ١٤٤٨هـ) +3 في scan (اسمان يبقيان بالإنجليزية مغطّيان وعددهما kept؛ وكان الحدّ 20 والفعلي 23)، و+13 في options
  // (النافذة بلا «اللغة»، والترحيب بحال كل موقع، وجدولا «المواقع» و«لكل موقع»، وعزل المسارات والمضيفين، وتسميات الفحص، وحجم الترجمة المشحون)
  { file: "_scantest.html", name: "scan", min: 26 },
  { file: "_scanlocktest.html", name: "scanlock", min: 8 },
  // ★ (ر8-د، ١ جمادى الأولى ١٤٤٨هـ — N6) ماسح فهرس الصفحات بالمحرّك الحقيقي وقاموس الوثائق المشحون: شارات العناوين (« (Beta)») تُبحث بأصلها، وما
  // يبقى بالإنجليزية بقاعدة النطاق مغطًّى، وقائمة الإبقاء المشحونة من keep-en.json المتتبَّعة وحدها
  { file: "_llmstest.html", name: "llms", min: 7 },
  { file: "_swtest.html", name: "swtest", min: 43 },
  // ★ (ر9-هـ، ٥ جمادى الأولى ١٤٤٨هـ) +2 في rtltest: مركّب html بسمةٍ فيها ‎~=‎ أو مسافة لا يبتلع ما بعده، وزرٌّ بعده موضعه منعكس واستدارته باقية
  // (وكان الحدّ 75 والفعلي 87 قبلهما؛ فالحدّ الآن الفعلي)، و+1 في apireftest: شارة الموقع ‎dir=ltr‎ في الرأس والتذييل تنعكس
  // ★ (ر9، المراجعة الموحّدة، ٥ جمادى الأولى ١٤٤٨هـ) +1 في rtltest: مركّب html بقيمة سمةٍ بين علامتي تنصيص وبصنفٍ فيه محرفٌ مهرَّب (طفرتا compoundLen
  // في التنصيص والهروب كانتا تنجوان)، و+1 في apireftest: شارة الموقع على أصلها والإضافة عاملةٌ والقلب مطفأ (طفرةٌ تحذف [dir="rtl"] كانت تنجو)
  { file: "_rtltest.html", name: "rtltest", min: 90 },
  { file: "_synctest.html", name: "synctest", min: 125 },
  { file: "_thumbtest.html", name: "thumbtest", min: 15 },
  { file: "_livetest.html", name: "livetest", min: 13 },
  { file: "_liveapptest.html", name: "liveapp", min: 7 },
  { file: "_sitelangtest.html", name: "sitelang", min: 14 },
  { file: "_restoretest.html", name: "restoretest", min: 10 },
  { file: "_syncsimtest.html", name: "syncsim", min: 28 },
  { file: "_swmsgtest.html", name: "swmsg", min: 38 },
  { file: "_hosttest.html", name: "hosttest", min: 11 },
  { file: "_routetest.html", name: "routetest", min: 11 },
  { file: "_harvesttest.html", name: "harvest", min: 13 },
  { file: "_codetest.html", name: "codetest", min: 66 },
  { file: "_intercomtest.html", name: "intercom", min: 25 },
  { file: "_holdtest.html", name: "hold", min: 4 },
  { file: "_holdofftest.html", name: "holdoff", min: 3 },
  // الإشارة الأقوى للترطيب (meta.hydrateSignal = "idle"، S6-C): لا كتابة والخيط مشغول، والسقفان كما هما
  { file: "_hydidletest.html", name: "hydidle", min: 8 },
  // ★ (ر4، ٢٨ ربيع الآخر ١٤٤٨هـ) إشارة الترطيب "lang" (الأكاديمية): لا كتابة قبل أن يكتب الموقع <html lang> ثم load والخمول، وكتابتانا نحن
  // لسمة lang لا تُحسبان، وكتابةٌ أثناء التحليل ليست إشارة، وأول كتابةٍ بلغةٍ أخرى تُخمد، والسقف كما هو
  { file: "_hydlangtest.html", name: "hydlang", min: 15 },
  { file: "_blocktest.html", name: "block", min: 76 },
  // مرجع الواجهة البرمجية في الوثائق (S7-B): ما تعرّبه الشركة وحده بجدول النطاقات الحقيقي، والعقد البرمجي على أصله LTR،
  // وصفحات SDK بمفتاح الصفحة القانونية
  // ★ (ر7-ب، المراجعة المستقلة) +2 في apireftest: العنوان ذو الشيفرة السطرية، ولافتة الصفحة المخبوءة
  // ★ (ر8-ج، ٣٠ ربيع الآخر ١٤٤٨هـ) +3 في apireftest: الحاصد لا يحصد لافتة الصدى، واللافتة تتبع عنوانًا أرجعه وضع الكتلة وحده (F4)، وسحب مُغلِّف
  // الإزاحة في الشاشة الضيقة محصورٌ في الحشوة اليمنى (صنف فحص الاتجاه 7d57ba911b95)
  { file: "_apireftest.html", name: "apireftest", min: 43 },
  { file: "_blocksynctest.html", name: "blocksync", min: 17 },
  // ★ (ر8-د، المراجعة) +1 في options: مفتاح إغلاق الترحيب الجديد (يُعرض لمن أغلقه في test-2.0.0-2، ويُمحى القديم)
  // ★ (ر8-د2، ٢ جمادى الأولى ١٤٤٨هـ) +7 في options: «حول» بعناوينه وأقسامه، وقائمة المصادر معدودة، و«ما لا تعرّبه» كالترحيب، ولا «صار/تصير»،
  // ولا «مطفأ» ولا «كلود»، واسما جدولَي «المواقع» والقاموس، ومعدود رسالة حدّ الطول
  // ★ (ر8-د2، المراجعة) +1: جدول القاموس لا يفيض على 600 بكسل، واسم الموقع سطرٌ واحد على 1000
  // ★ (ر9-أ، ٣ جمادى الأولى ١٤٤٨هـ) +3: تاريخ الحصاد المشحون من _meta قاموس الكتل، ورسائل الإضافة بلا صيغة متكلّم ولا Ctrl+F5، وصيغة العدد في version_name
  // ★ (ر9-ج، ٥ جمادى الأولى ١٤٤٨هـ — القرار 100) +1: اسم الإضافة الجديد حرفًا بحرف في المانيفست، ونسخُه الثابتة في الإعدادات والنافذة
  { file: "_optionstest.html", name: "options", min: 151 },
  { file: "_optionsrevtest.html", name: "optionsrev", min: 17 },
  { file: "_titletest.html", name: "titletest", min: 34 },
  // الخط العربي (DESIGN-fonts §٥.٤؛ S6-B): الوحدة والمحرّك وملفات الخطوط الحقيقية في أطر سيناريو
  { file: "_fonttest.html", name: "fonttest", min: 55 },
  // ★ (ر5ب، ٢٩ ربيع الآخر ١٤٤٨هـ — القرار 71) «خط النظام»: بنى خطوط المواقع السبع ببدائل لينكس، والخط الذي رسم العربية والإنجليزية بكل
  // وزن وفي لحظة تحميل خط الموقع — بـ CSS.getPlatformFontsForNode عبر المشغّل (pf: servePlatformFonts)
  { file: "_sysfonttest.html", name: "sysfont", min: 28, pf: true },
  // لا سقف طول (٢١ ربيع الآخر ١٤٤٨هـ، توجيه المالك): الحرفي والقالب والجمع الطويل يُترجم، والطويل الذي لا يطابق بلا كلفة
  // (فهرس الأنماط)، والحماية استثناء المحادثة: جوابٌ يُبثّ ومكتمل ورسالة المستخدم ومربع الكتابة لا تُمسّ
  { file: "_textmaxtest.html", name: "textmax", min: 24 },
  // أسماءٌ كتبها المستخدم في claude.ai (S9-M): المحادثات والمشاريع والجلسات في الشريط الجانبي، وعنوان المحادثة في الرأس،
  // وأسماء المُخرَجات والملفات — لا تُعرَّب ولو طابقت نصَّ واجهة، ولا يحصدها الحاصد (meta.skipSel للتطبيق)
  { file: "_usernamedtest.html", name: "usernamed", min: 20 },
  // الوثائق القانونية الخمس (ر3، ٢٨ ربيع الآخر ١٤٤٨هـ): الجدول والمسارات بأعيانها، والمتن بوضع الكتلة، والتنبيه بسمة data-cml-body، وحارس
  // منتقي اللغة في الصفحة، وغلاف الموقع LTR، والعنوان بفاصل «\» وفي <body>، والتنقّل
  { file: "_legaltest.html", name: "legal", min: 30 },
  // الأكاديمية (ر4، ٢٨ ربيع الآخر ١٤٤٨هـ): الجدول والمسارات، والواجهة والعناوين، وجزر المتن والقائمة واللافتة والمنتقي ومحادثة «اسأل Claude»
  // (لا تُعرَّب ولا تُحصد وLTR)، واتجاه الفقرات بنصّها، والعنوان بذيله، وحارس <html lang>، والمساعدة هيكل، والتنقّل إلى ‎/<لغة>/…‎ وعودته
  { file: "_academytest.html", name: "academy", min: 23 },
];
const filterArg = process.argv.find((a) => a.startsWith("--filter="));
const UPDATE_CRIT = process.argv.includes("--update-critical");
const FILTER = filterArg ? filterArg.split("=")[1] : null;
const chromeArg = process.argv.find((a) => a.startsWith("--chrome="));
const RUN_PAGES = FILTER ? PAGES.filter((p) => p.name.includes(FILTER) || p.file.includes(FILTER)) : PAGES;
if (!RUN_PAGES.length) { console.error("! لا صفحة تطابق المرشِّح: " + FILTER); process.exit(1); }

// جذر الخدمة يصمد في البنيتين: مجلد العمل (web/code/test) والنشر (test/)
const TESTDIR = fs.existsSync(path.join(ROOT, "code", "test")) ? "code/test" : "test";
const CRIT_PATH = path.join(ROOT, TESTDIR, "_critical.json");
let CRIT = {};
try { CRIT = JSON.parse(fs.readFileSync(CRIT_PATH, "utf8")); } catch {}

// ---- 1) اعثر على كروم ----
function findChrome() {
  // مسارٌ صريح (--chrome أو CHROME) غيرُ موجود = خطأٌ صريح — كان يسقط بصمت إلى
  // متصفح النظام فتجري الاختبارات على غير ما طُلب وتوهم النتيجة
  const explicit = (chromeArg && chromeArg.split("=").slice(1).join("=")) || process.env.CHROME;
  if (explicit) {
    if (fs.existsSync(explicit)) return explicit;
    console.error("! المسار الصريح للمتصفح غير موجود: " + explicit);
    process.exit(1);
  }
  const candidates = [
    // ويندوز
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    (process.env.LOCALAPPDATA || "") + "/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    // لينكس (عدّاؤو CI) وماك
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser", "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return null;
}

// ---- 2) خادم الملفات المدمج (منفذ عشوائي — لا يزاحم خادم التطوير 8794) ----
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".woff2": "font/woff2" };
function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      // ترميزٌ مشوّه كان يرمي URIError غير ملتقطة فيقتل المشغّل كله بلا تنظيف
      let url;
      try { url = decodeURIComponent(req.url.split("?")[0]); }
      catch { res.writeHead(400); res.end(); return; }
      const fp = path.join(ROOT, url);
      const base = path.resolve(ROOT);
      // حدُّ المسار بفاصلٍ لاحق: startsWith وحدها كانت تُخرج مجلدًا شقيقًا يشارك البادئة
      if (fp !== base && !fp.startsWith(base + path.sep)) { res.writeHead(403); res.end(); return; }
      fs.readFile(fp, (err, data) => {
        if (err) { res.writeHead(404); res.end("not found"); return; }
        res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream" });
        res.end(data);
      });
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

// ---- 3) عميل CDP خام فوق WebSocket المدمجة ----
function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1, dead = false;
    const pending = new Map();
    // موتُ كروم أو سقوطُ القناة وسط التشغيل كان يترك وعود send معلقةً إلى الأبد —
    // حتى سقفُ الصفحة (60ث) عالقٌ على await نفسِه. الإغلاق يرفض المعلّق كله فورًا.
    function die(msg) {
      if (dead) return;
      dead = true;
      for (const { rej } of pending.values()) rej(new Error(msg));
      pending.clear();
    }
    ws.onopen = () => resolve({ send, close: () => { try { ws.close(); } catch {} } });
    ws.onerror = (e) => { reject(new Error("تعذّر الاتصال بـCDP: " + (e && e.message))); die("سقطت قناة CDP"); };
    ws.onclose = () => die("أُغلقت قناة CDP (مات المتصفح؟)");
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.id && pending.has(m.id)) {
        const { res, rej } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? rej(new Error(m.error.message || JSON.stringify(m.error))) : res(m.result);
      }
      // الأحداث لا تعنينا: نستطلع العنوان استطلاعًا — أبسط وأصلب من انتظار أحداث التحميل
    };
    function send(method, params, sessionId) {
      return new Promise((res, rej) => {
        if (dead) return rej(new Error("قناة CDP ميتة"));
        const id = nextId++;
        pending.set(id, { res, rej });
        ws.send(JSON.stringify(sessionId ? { id, method, params: params || {}, sessionId } : { id, method, params: params || {} }));
      });
    }
  });
}

// ---- 4) التشغيل ----
const chrome = findChrome();
if (!chrome) {
  console.error("! لم أجد كروم/كروميوم. مرّر المسار: --chrome=... أو متغير البيئة CHROME.");
  process.exit(1);
}
const server = await startServer();
const port = server.address().port;
// ★ (ر5، ٢٩ ربيع الآخر ١٤٤٨هـ) الملف المؤقت بأداة السلسلة المشتركة (cdp-lib tempProfile): إنهاءٌ وانتظار الخروج بسقفٍ ثم SIGKILL، ثم
// الحذف بإعادات — ومعه احتياطٌ متزامن عند خروج العملية لما يخرج قبل الإغلاق، ومجلد المقبس إن بقي بعد قتلٍ قسري
const prof = tempProfile("cml-cdp-", "");
const udd = prof.dir;
const args = [
  "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${udd}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu",
  "--disable-extensions", "--mute-audio",
];
if (process.env.CI) args.push("--no-sandbox", "--disable-dev-shm-usage");
const proc = spawn(chrome, args, { stdio: ["ignore", "ignore", "pipe"] });
prof.track(proc);
let stderrBuf = "";
proc.stderr.on("data", (d) => { stderrBuf += d; });

function cleanup(code) {
  try { server.close(); } catch {}
  // انتظر خروج كروم فعلًا (لا مهلة عمياء): على ويندوز تبقى أقفال ملفاته بعد kill
  // لعشرات المللي ثانية فكان مجلد الملف الشخصي المؤقت يتسرب حتى في الخروج السليم —
  // ثم أعِد المحاولة بتراجعٍ لأن التحرير قد يتأخر عن حدث الخروج نفسه (tempProfile.close).
  prof.close().then(() => process.exit(code));
}
process.on("SIGINT", () => cleanup(1));

// عنوان CDP يُقرأ من ملف DevToolsActivePort داخل مجلد الملف الشخصي المؤقت
async function browserWsUrl() {
  const f = path.join(udd, "DevToolsActivePort");
  for (let i = 0; i < 100; i++) {
    if (proc.exitCode !== null) throw new Error("كروم خرج مبكرًا (" + proc.exitCode + "): " + stderrBuf.slice(-400));
    try {
      const [p, wsPath] = fs.readFileSync(f, "utf8").split("\n");
      if (p && wsPath) return `ws://127.0.0.1:${p.trim()}${wsPath.trim()}`;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("لم يكتب كروم DevToolsActivePort خلال 15 ثانية. " + stderrBuf.slice(-400));
}

// ★ (ر5ب، ٢٩ ربيع الآخر ١٤٤٨هـ) خدمة «الخط الذي رسم العقدة» لصفحات الاختبار: صفحةٌ تضع طلبًا في window.__cmlPFq ({id, n}) وعُقده في
// window.__cmlPFn[id] (ولو داخل إطارٍ من الأصل نفسه)، فيسأل المشغّل CSS.getPlatformFontsForNode لكلٍّ منها ويردّ بـ window.__cmlPFdone(id,
// [["PostScript:عدد الحروف", …], …]) — فيُمتحن الخط المرسوم فعلًا لا عرضُه. وصفحةٌ تُفتح بلا المشغّل لا يأتيها ردّ فتقيس بنفسها
async function servePlatformFonts(cdp, sessionId, st) {
  let q = "";
  try {
    const r = await cdp.send("Runtime.evaluate", { expression: "window.__cmlPFq && window.__cmlPFq.length ? JSON.stringify(window.__cmlPFq.splice(0)) : ''", returnByValue: true }, sessionId);
    q = (r && r.result && r.result.value) || "";
  } catch { return; }
  if (!q) return;
  if (!st.enabled) { await cdp.send("DOM.enable", {}, sessionId); await cdp.send("CSS.enable", {}, sessionId); st.enabled = true; }
  for (const req of JSON.parse(q)) {
    const out = [];
    try {
      await cdp.send("DOM.getDocument", { depth: 0 }, sessionId);
      for (let i = 0; i < req.n; i++) {
        let fonts = ["?"];
        try {
          const ev = await cdp.send("Runtime.evaluate", { expression: `window.__cmlPFn[${+req.id}][${i}]` }, sessionId);
          const { nodeId } = await cdp.send("DOM.requestNode", { objectId: ev.result.objectId }, sessionId);
          const pf = await cdp.send("CSS.getPlatformFontsForNode", { nodeId }, sessionId);
          fonts = (pf.fonts || []).map((x) => (x.postScriptName || x.familyName) + ":" + x.glyphCount);
        } catch (e) { fonts = ["ERR " + String(e && e.message || e).slice(0, 80)]; }
        out.push(fonts);
      }
    } catch (e) { out.push(["ERR " + String(e && e.message || e).slice(0, 80)]); }
    try { await cdp.send("Runtime.evaluate", { expression: `window.__cmlPFdone(${+req.id}, ${JSON.stringify(out)})` }, sessionId); } catch {}
  }
}

let failures = 0;
try {
  const cdp = await connectCdp(await browserWsUrl());
  const pages = RUN_PAGES;
  console.log(`المتصفح: ${path.basename(chrome)} | الخادم: 127.0.0.1:${port}/${TESTDIR} | صفحات: ${pages.length}\n`);

  for (const pg of pages) {
    const url = `http://127.0.0.1:${port}/${TESTDIR}/${pg.file}?cdp`;
    const t0 = Date.now();
    const { targetId } = await cdp.send("Target.createTarget", { url });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    let title = "", verdict = "مهلة", stable = 0, last = "";
    const RE = new RegExp("^" + pg.name + " (\\d+)/(\\d+)$"); // مرساة $: الوسطية تحمل «…» فلا تطابق
    const pfState = { enabled: false };
    for (let i = 0; i < 240; i++) { // 240 × 250ms = 60ث سقفًا للصفحة
      await new Promise((r) => setTimeout(r, 250));
      if (pg.pf) await servePlatformFonts(cdp, sessionId, pfState);
      try {
        const ev = await cdp.send("Runtime.evaluate", { expression: "document.title", returnByValue: true }, sessionId);
        title = (ev && ev.result && ev.result.value) || "";
      } catch { continue; }
      const m = RE.exec(title);
      if (!m) { stable = 0; last = ""; continue; }
      // العقد: العنوان الختامي وحده «اسم N/N» حرفًا بحرف — والوسطيةُ تُلحق «…»
      // فتُقصيها مرساةُ $ بنيويًّا (كانت «27/27» الوسطية المتساوية تخدع النافذة).
      // نافذة ثبات قصيرة تبقى دفاعًا عن أي كتابة متزامنة مع القراءة.
      if (title === last) { stable++; } else { stable = 0; last = title; }
      if (stable >= 4) { verdict = m[1] === m[2] && +m[2] > 0 ? "نجح" : "أخفق"; break; }
    }
    // الحدّ الأدنى، ثم الحرجة بأسمائها (صفحات جدول النتائج #tbl)
    let why = "";
    const mm = RE.exec(title);
    if (verdict === "نجح" && pg.min && mm && +mm[2] < pg.min) { verdict = "أخفق"; why = ` — ${mm[2]} تحققًا أقل من الحدّ الأدنى ${pg.min}`; }
    if (verdict === "نجح") {
      try {
        const rv = await cdp.send("Runtime.evaluate", { expression: "Array.from(document.querySelectorAll('#tbl tbody tr')).map(function (tr) { var c = tr.cells; return [c[0] ? c[0].textContent : '', c.length ? c[c.length - 1].textContent : '']; })", returnByValue: true }, sessionId);
        const rows = (rv && rv.result && rv.result.value) || [];
        const stars = rows.filter((r) => r[0].indexOf("★") >= 0);
        const okNames = new Set(stars.filter((r) => r[1] === "✓").map((r) => r[0]));
        if (UPDATE_CRIT) { if (stars.length) CRIT[pg.file] = stars.map((r) => r[0]); else delete CRIT[pg.file]; }
        const want = CRIT[pg.file] || [];
        const lost = want.filter((n) => !okNames.has(n));
        if (lost.length) { verdict = "أخفق"; why = ` — تحققاتٌ حرجة غابت أو لم تنجح: ${lost.slice(0, 3).map((n) => "«" + n.slice(0, 60) + "»").join("، ")}${lost.length > 3 ? " و" + (lost.length - 3) + " غيرها" : ""}`; }
        const fresh = stars.filter((r) => !want.includes(r[0]));
        if (fresh.length && !UPDATE_CRIT) why += ` (ℹ ${fresh.length} حرجٌ جديد خارج القائمة — ‎--update-critical‎)`;
      } catch {}
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const ok = verdict === "نجح";
    if (!ok) failures++;
    console.log(`${ok ? "✓" : "✗"} ${pg.file.padEnd(20)} ${title || "(بلا عنوان)"} — ${verdict} (${secs}ث)${why}`);
    // ‎--dump: نص الصفحة للتشخيص (يُطبع دومًا عند الإخفاق أيضًا — عدّاء CI لا شاشة له)
    if (process.argv.includes("--dump") || !ok) {
      try {
        const bt = await cdp.send("Runtime.evaluate", { expression: "(function(){var NL=String.fromCharCode(10);var t=document.body.innerText;var bad=t.split(NL).filter(function(l){return l.indexOf(String.fromCharCode(10007))>=0;});return (bad.length?'-- failures --'+NL+bad.join(NL)+NL+'-- tail --'+NL:'')+t.slice(-1500);})()", returnByValue: true }, sessionId);
        console.log("---- نص الصفحة ----\n" + ((bt.result && bt.result.value) || "") + "\n-------------------");
      } catch {}
    }
    try { await cdp.send("Target.closeTarget", { targetId }); } catch {}
  }
  if (UPDATE_CRIT) {
    const sorted = {};
    for (const k of Object.keys(CRIT).sort()) sorted[k] = CRIT[k];
    fs.writeFileSync(CRIT_PATH, JSON.stringify(sorted, null, 1) + "\n", "utf8");
    console.log("\nℹ كُتبت قائمة التحققات الحرجة: " + path.relative(ROOT, CRIT_PATH));
  }
  console.log(failures ? `\n✗ أخفقت ${failures} صفحة` : "\n✓ الصفحات كلها خضراء");
  try { await cdp.send("Browser.close"); } catch {}
} catch (e) {
  console.error("✗ " + (e && e.message ? e.message : e));
  failures = failures || 1;
}
cleanup(failures ? 1 : 0);
