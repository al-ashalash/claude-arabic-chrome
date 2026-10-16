// smoke-extension.mjs — اختبار دخانٍ بالإضافة المحمَّلة فعلًا (مراجعة كودكس ٢٨).
//
// اختبارات القشرة (run-tests-cdp) تمتحن المنطق بقشرة chrome مقلَّدة، ولا ترى المانيفست
// ولا العالم المعزول ولا عامل الخدمة الحقيقي ولا ترتيب CSS. هذا المشغّل يحمّل مجلد الإضافة
// نفسه في كروم بلا واجهة، ويخدم صفحاتٍ اختبارية على **عناوين النطاقات الحقيقية** محليًّا:
//   - كروم يوجَّه بـ--host-resolver-rules فتذهب claude.ai وsupport.claude.com
//     وprivacy.claude.com وplatform.claude.com وcode.claude.com وwww.anthropic.com وacademy.claude.com إلى خادمٍ محلي (https بشهادةٍ تُولَّد عند
//     التشغيل في مجلدٍ مؤقت — لا مفتاح خاصًّا في المستودع)، فتُحقن سكربتات المحتوى كما
//     تُحقن عند المستخدم، بلا شبكةٍ خارجية ولا حساب.
//   - التحميل بـExtensions.loadUnpacked عبر قناة الأنابيب: كروم الرسمي ترك --load-extension
//     منذ الإصدار 137، وهذا طريقه الموثّق للاختبار.
//
//   node smoke-extension.mjs [--chrome=…] [--shots=<مجلد لقطات>]
// يحتاج openssl لتوليد الشهادة؛ بغيابه تُتخطّى اختبارات الصفحات تصريحًا وتبقى صفحات الإضافة.
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { EXT } from "./paths.mjs";
import { tempProfile } from "./cdp-lib.mjs";

// عدد المواقع وأسماؤها من الجدول نفسه (لا «الأربعة» مكتوبةً — تصدق متى زيد موقع)
await import(pathToFileURL(path.join(EXT, "cml-const.js")).href);
const IDS = globalThis.CMLConst.DOMAINS.map((d) => d.id);

const argv = process.argv.slice(2);
const chromeArg = (argv.find((a) => a.startsWith("--chrome=")) || "").slice(9) || process.env.CHROME || "";
const SHOTS = (argv.find((a) => a.startsWith("--shots=")) || "").slice(8);

function findChrome() {
  if (chromeArg) { if (fs.existsSync(chromeArg)) return chromeArg; console.error("! المسار الصريح غير موجود: " + chromeArg); process.exit(1); }
  const c = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    (process.env.LOCALAPPDATA || "") + "/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium-browser", "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  for (const p of c) { try { if (p && fs.existsSync(p)) return p; } catch {} }
  return null;
}

// ---- الشهادة المؤقتة ----
// ★ (ر5، ٢٩ ربيع الآخر ١٤٤٨هـ) المجلد المؤقت (الشهادة وملف كروم) بأداة السلسلة المشتركة (cdp-lib tempProfile): يُحذف بعد خروج كروم، ومعه
// احتياطٌ متزامن عند خروج العملية — فلا يبقى مفتاح الشهادة ولا الملف إن خرجت الأداة مبكرًا (لا كروم، أو استثناءٌ قبل الإغلاق)
const prof = tempProfile("cml-smoke-");
const tmp = prof.root;
function makeCert() {
  const key = path.join(tmp, "k.pem"), crt = path.join(tmp, "c.pem");
  const r = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", crt, "-days", "2",
    "-subj", "/CN=cml-smoke", "-addext", "subjectAltName=DNS:claude.ai,DNS:support.claude.com,DNS:privacy.claude.com,DNS:platform.claude.com,DNS:code.claude.com,DNS:www.anthropic.com,DNS:academy.claude.com"],
    { encoding: "utf8", env: Object.assign({}, process.env, { MSYS_NO_PATHCONV: "1" }) });
  if (r.status !== 0 || !fs.existsSync(key)) return null;
  return { key: fs.readFileSync(key), cert: fs.readFileSync(crt) };
}

// ---- صفحات النطاقات الاختبارية (محتوى اصطناعي من صنع المشروع) ----
function bigCss() {
  let s = "@layer base,utilities;";
  for (let i = 0; i < 1200; i++) s += ".u" + i + "{margin-left:" + (i % 40) + "px;padding-right:2px}";
  return s;
}
const PAGES = {
  "claude.ai": {
    "/new": '<!doctype html><html lang="en"><head><link rel="stylesheet" href="/site.css">' +
      '<style>@font-face{font-family:"anthropic-sans";src:local("Arial"),local("DejaVu Sans"),local("Liberation Sans");font-weight:300 800;unicode-range:U+0000-00FF}' +
      'button{font-family:"anthropic-sans",system-ui}</style></head><body><button id="t1">New chat</button><div id="t2">Settings</div><div class="prose"><p id="msg">Settings</p><svg width="1" height="1"><style>.zq-chat{margin-left:3px}</style></svg></div></body></html>',
    "/site.css": bigCss(),
  },
  "support.claude.com": {
    "/en/": '<!doctype html><html lang="en"><body><div id="__next"><div dir="ltr"><h1 id="h">Help Center</h1><div class="prose"><p id="art">Settings</p></div></div></div></body></html>',
  },
  "privacy.claude.com": {
    "/en/": '<!doctype html><html lang="en"><body><h1>Privacy Center</h1></body></html>',
  },
  "platform.claude.com": {
    "/docs/en/intro": '<!doctype html><html lang="en"><body><h1 id="h">Intro</h1></body></html>',
    // ★ (S6-C) صفحة Claude Platform on AWS بقطعتها الحقيقية: صفّان من جدول «الصفحات المتاحة» (علامتا إبقاءٍ في القطعة، والقاموس
    // يعرّب نصّيهما)، والنصّ نفسه في الرأس خارج المتن، وقائمة حزم SDK في الشريط («C#» و«Python»)، وإشارة الترطيب بعد لحظة
    "/docs/en/build-with-claude/claude-platform-on-aws": '<!doctype html><html lang="en"><body><header><span id="hdrRl">Rate limits</span></header>' +
      '<aside><div><a href="#"><span id="sdkCs">C#</span></a></div><div><a href="#"><span id="sdkPy">Python</span></a></div></aside>' +
      '<div class="docs-prose"><h1>Claude Platform on AWS</h1><table><tbody><tr><td id="awsRl"><b>Rate limits</b></td><td id="awsMs"><b>Memory stores</b></td></tr></tbody></table></div>' +
      '<script>setTimeout(function(){document.body.appendChild(document.createElement("next-route-announcer"));},600);</script></body></html>',
    "/settings/keys": '<!doctype html><html lang="en"><body><h1 id="h">Keys</h1></body></html>',
    // نسخة ‎.md‎ الخام لصفحةٍ تحت المطابقة: المحرّك خاملٌ فيها (حارس نوع المستند) — كانت تبقى مخفيّةً بالإمساك
    "/docs/en/intro.md": "# Intro\n\nZq markdown body.\n",
    // فهرس الصفحات العام (ماسح llms): عناوين في المسار الكامل والهيكل، وما خارج حارس المسار
    // وقسمُ لغةٍ أخرى لا يُعدّان — محتوى اصطناعي من صنع المشروع
    "/llms.txt": [
      "# Smoke docs", "", "## English", "", "### Get started",
      "- [Intro to Claude](https://platform.claude.com/docs/en/intro.md): intro",
      "- [Zq Untranslated Page](https://platform.claude.com/docs/en/zq.md)",
      "### Zq Reference Group",
      "- [Zq Shell Page](https://platform.claude.com/docs/en/api/zq.md)",
      "- [Zq Outside Page](https://platform.claude.com/settings/zq.md)",
      "## Other",
      "### Zq Other Group",
      "- [Zq Other Language](https://platform.claude.com/docs/xx/zq.md)",
    ].join("\n"),
  },
};

// ★ وثائق Claude Code (Mintlify): صفحةٌ برابط ورقةٍ من الأصل نفسه وورقة <style> في المتن (CSS الموقع الخاص فيها
// إعلانٌ فيزيائي — تقلبه الورقة الحيّة وحدها بعد ضمّ المضمَّنة)، وإشارة الترطيب (next-route-announcer) بعد لحظة
function codePage(title) {
  return '<!doctype html><html lang="en"><head><link rel="stylesheet" href="/docs/_next/static/chunks/zq.css"></head><body>' +
    '<header id="navbar"><a id="cta" href="#">Open Claude Code</a></header><main id="content-container"><div id="content-area">' +
    // (العنصر خارج #content: المتن يأخذ dir لكل كتلة بحسب نصّها، فالإنجليزي LTR يُبقي هامشه يسارًا بحق)
    '<h1 id="h">' + title + '</h1><div id="zq" class="zqcode">Zq</div><div id="content"><p>Zq body text</p></div></div>' +
    '<style data-custom-css-path="style.css">.zqcode{margin-left:7px}</style></main>' +
    '<div id="chat-content"><p id="ans">Overview</p></div>' +
    '<script>setTimeout(function(){document.body.appendChild(document.createElement("next-route-announcer"));},1200);</script></body></html>';
}
PAGES["code.claude.com"] = {
  "/docs": codePage("Overview"),
  "/docs/en/overview": codePage("Overview"),
  "/docs/xx/overview": codePage("Overview"),
  "/docs/en/overview.md": "# Overview\n\nZq markdown body.\n",
  "/docs/_next/static/chunks/zq.css": bigCss(),
  // فهرس الصفحات تحت ‎/docs‎ (meta.llms): المسار الكامل والهيكل ومجموعته، وما خارج حارس المسار لا يُعدّ
  "/docs/llms.txt": [
    "# Zq Code Docs", "", "## Getting started",
    "- [Overview](https://code.claude.com/docs/en/overview.md): overview",
    "- [Zq Code Untranslated](https://code.claude.com/docs/en/zq.md)",
    "### Zq Code Group",
    "- [Zq Code Shell](https://code.claude.com/docs/en/changelog.md)",
    "## Indexes",
    "- [Zq Other Index](https://code.claude.com/docs/_llms/xx.md)",
    "- [Zq Other Language](https://code.claude.com/docs/xx/zq.md)",
  ].join("\n"),
};

// ★ (ر3، ٢٨ ربيع الآخر ١٤٤٨هـ) الوثائق القانونية في www.anthropic.com/legal: صفحةٌ اصطناعية بأصناف CSS Modules كأصناف الموقع (غلافٌ
// إنجليزي، ورأس الوثيقة بتاريخه، ومنتقي لغة الوثيقة بقيمته المختارة، ومتنٌ بلا قطعةٍ في الحزمة بعد)، وإشارة الترطيب بعد لحظة؛
// والأرشيف خاملٌ بحارس المسار (المسارات الخمسة بأعيانها)
function legalPage() {
  return '<!doctype html><html lang="en"><head><title>Zq Policy \\ Anthropic</title></head><body>' +
    '<header class="SiteHeader-module-scss-module__zq__root" id="lgHdr"><a href="#">Zq Header</a></header>' +
    '<article class="LegalPageDetail-module-scss-module__zq__legal-page"><header class=""><h1 id="lgH1">Zq Policy</h1>' +
    '<div class="LegalPageDetail-module-scss-module__zq__metadata"><span>Effective <time id="lgDate">October 8, 2026</time></span>' +
    '<div class="LegalPageDetail-module-scss-module__zq__language-options"><div class="css-zq-container"><div class="css-zq-singleValue" id="lgLang">English</div></div></div>' +
    '</div></header><div class="LegalPageDetail-module-scss-module__zq__body" id="lgBody"><p>Zq body paragraph.</p></div></article>' +
    '<script>setTimeout(function(){document.body.appendChild(document.createElement("next-route-announcer"));},600);</script></body></html>';
}
// ووثيقةٌ يبدأ منتقيها بلغةٍ أخرى من التحميل الأول (الخادم يختار لغة بلد الزائر إن وُجدت ترجمتها — دراسة ر3 §0)
PAGES["www.anthropic.com"] = { "/legal/privacy": legalPage(), "/legal/archive/zq": legalPage(),
  "/legal/cookies": legalPage().replace(">English</div>", ">Zq Other</div>") };

// ★ (ر4، ٢٨ ربيع الآخر ١٤٤٨هـ) الأكاديمية في academy.claude.com: صفحة درسٍ اصطناعية (ترويسة، وmain بعنوانٍ وملخصٍ إنجليزي ومتنٍ
// ‎article.mdx-article‎، وتذييلٌ بمنتقي اللغة)، والموقع يكتب لغة واجهته في <html lang> بعد التحميل (أثر IntlProvider عند التركيب) —
// إشارة الترطيب "lang"؛ وصفحة لغةٍ أخرى ‎/<لغة>/…‎ خاملةٌ بحارس المسار
function academyPage() {
  return '<!doctype html><html lang="en"><head><title>Zq Lesson · Claude Academy</title></head><body>' +
    '<header class="fixed" id="acHdr"><span>Claude Academy</span></header>' +
    '<main><h1 id="acH1">Zq Lesson</h1><p class="text-lede" id="acSum">Zq summary of the lesson.</p>' +
    '<article class="mdx-article" id="acArt"><p>Zq body paragraph.</p></article></main>' +
    '<footer><div data-cds="Combobox"><button role="combobox"><span id="acPick">English</span></button></div></footer>' +
    '<script>window.addEventListener("load",function(){setTimeout(function(){document.documentElement.lang="en";},300);});</script></body></html>';
}
PAGES["academy.claude.com"] = { "/courses/zq/zq-lesson": academyPage(), "/xx/courses": academyPage() };

// ---- قناة CDP بالأنابيب (fd3 للكتابة، fd4 للقراءة، رسائل بفاصل \0) ----
function pipeCdp(proc) {
  let nextId = 1, buf = "";
  const pending = new Map(), listeners = [];
  const out = proc.stdio[3], inp = proc.stdio[4];
  inp.on("data", (d) => {
    buf += d.toString("utf8");
    let i;
    while ((i = buf.indexOf("\0")) >= 0) {
      const raw = buf.slice(0, i); buf = buf.slice(i + 1);
      let m; try { m = JSON.parse(raw); } catch { continue; }
      if (m.id && pending.has(m.id)) {
        const { res, rej } = pending.get(m.id); pending.delete(m.id);
        m.error ? rej(new Error(m.error.message || JSON.stringify(m.error))) : res(m.result);
      } else if (m.method) listeners.forEach((f) => { try { f(m); } catch {} });
    }
  });
  function send(method, params, sessionId) {
    return new Promise((res, rej) => {
      const id = nextId++;
      pending.set(id, { res, rej });
      const msg = { id, method, params: params || {} };
      if (sessionId) msg.sessionId = sessionId;
      out.write(JSON.stringify(msg) + "\0");
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error("مهلة CDP: " + method)); } }, 30000);
    });
  }
  return { send, on: (f) => listeners.push(f) };
}

const results = [];
let failures = 0;
function check(name, expect, got) {
  const ok = String(expect) === String(got);
  if (!ok) failures++;
  results.push((ok ? "✓ " : "✗ ") + name + (ok ? "" : "  — المتوقَّع: " + expect + " | الناتج: " + got));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = findChrome();
if (!chrome) { console.error("! لم أجد كروم."); process.exit(1); }
const certs = makeCert();
let server = null, port = 0;
if (certs) {
  server = https.createServer(certs, (req, res) => {
    const host = String(req.headers.host || "").split(":")[0];
    const site = PAGES[host] || {};
    const url = (req.url || "/").split("?")[0];
    const body = site[url];
    if (body === undefined) { res.writeHead(404); res.end("not found"); return; }
    const type = url.endsWith(".css") ? "text/css; charset=utf-8" : url.endsWith(".txt") ? "text/plain; charset=utf-8"
      : url.endsWith(".md") ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8";
    res.writeHead(200, { "Content-Type": type, "Access-Control-Allow-Origin": "*" });
    res.end(body);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  port = server.address().port;
}
const udd = prof.dir;
const args = [
  "--headless=new", "--remote-debugging-pipe", "--enable-unsafe-extension-debugging",
  `--user-data-dir=${udd}`, "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--mute-audio",
  "--ignore-certificate-errors",
];
if (port) args.push("--host-resolver-rules=" + Object.keys(PAGES).map((h) => `MAP ${h} 127.0.0.1:${port}`).join(", "));
if (process.env.CI) args.push("--no-sandbox", "--disable-dev-shm-usage");
const proc = spawn(chrome, args, { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
prof.track(proc);
let stderr = "";
proc.stderr.on("data", (d) => { stderr += d; });
const cdp = pipeCdp(proc);

async function openPage(url) {
  const { targetId } = await cdp.send("Target.createTarget", { url });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  return { targetId, sessionId };
}
async function evalIn(sessionId, expr) {
  const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) throw new Error("خطأ في التقييم: " + (r.exceptionDetails.text || "") + " " + JSON.stringify(r.exceptionDetails.exception || {}).slice(0, 200));
  return r.result ? r.result.value : undefined;
}
async function until(sessionId, expr, ms) {
  const t0 = Date.now();
  let v;
  while (Date.now() - t0 < (ms || 8000)) {
    try { v = await evalIn(sessionId, expr); if (v) return v; } catch {}
    await wait(200);
  }
  return v;
}
async function shot(sessionId, name) {
  if (!SHOTS) return;
  try {
    fs.mkdirSync(SHOTS, { recursive: true });
    const r = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, sessionId);
    fs.writeFileSync(path.join(SHOTS, name + ".png"), Buffer.from(r.data, "base64"));
  } catch (e) { results.push("ℹ تعذّرت لقطة " + name + ": " + e.message); }
}

try {
  await cdp.send("Browser.getVersion");
  const { id } = await cdp.send("Extensions.loadUnpacked", { path: path.resolve(EXT) });
  check("كروم حمّل الإضافة من المجلد (المانيفست صالح)", "true", !!id);

  // ١) صفحة الإعدادات: «المواقع كلها» أولًا وافتراضيًّا، وتخطيطٌ واحد لكل اختيار، وأمر إدارةٍ حقيقي إلى العامل
  const opt = await openPage(`chrome-extension://${id}/options.html`);
  await until(opt.sessionId, "document.getElementById('domainSel') && document.getElementById('domainSel').options.length", 8000);
  check("الإعدادات: قائمة الموقع بالنطاقات (" + IDS.length + ") و«الكل»", String(IDS.length + 1),
    await evalIn(opt.sessionId, "document.getElementById('domainSel').options.length"));
  check("★ الإعدادات: «المواقع كلها» الخيار الأول والافتراضي", "all/all",
    await evalIn(opt.sessionId, "var s=document.getElementById('domainSel'); s.options[0].value + '/' + s.value"));
  // (ج٣) الحال الفعلية تشمل وصول المتصفح: permissions.contains بلا إذنٍ جديد — في كروم الافتراضي كلها مفعّلة
  await until(opt.sessionId, "document.getElementById('siteSt_docs') && document.getElementById('siteSt_docs').textContent === 'مفعّل'", 5000);
  await until(opt.sessionId, "document.getElementById('siteSt_code') && document.getElementById('siteSt_code').textContent === 'مفعّل'", 5000);
  check("★ الإعدادات: الحال الفعلية لكل موقع «مفعّل» (والوصول ممنوح)", IDS.map(() => "مفعّل").join(","),
    await evalIn(opt.sessionId, JSON.stringify(IDS) + ".map(function(d){return document.getElementById('siteSt_'+d).textContent;}).join(',')"));
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1000, height: 1400, deviceScaleFactor: 1, mobile: false }, opt.sessionId);
  await shot(opt.sessionId, "options-all");
  const SECS = "[].slice.call(document.querySelectorAll('[data-sec]')).map(function(s){return s.getAttribute('data-sec')+(s.getClientRects().length?'':'(مخفي)');}).join(',')";
  const secAll = await evalIn(opt.sessionId, SECS);
  let sameSecs = true;
  for (const v of IDS) {
    await evalIn(opt.sessionId, `var s=document.getElementById('domainSel'); s.value='${v}'; s.dispatchEvent(new Event('change')); true`);
    await wait(400);
    if ((await evalIn(opt.sessionId, SECS)) !== secAll) sameSecs = false;
    if (v === "support") {
      check("★ الإعدادات: «مركز المساعدة» يعطّل الفحص بسببٍ مكتوب (لا يُخفيه)", "false/true/true",
        (await evalIn(opt.sessionId, "document.getElementById('scanSection').classList.contains('hidden')")) + "/" +
        (await evalIn(opt.sessionId, "document.getElementById('scanFs').disabled")) + "/" +
        (await evalIn(opt.sessionId, "document.getElementById('scanWhy').textContent.indexOf('مركز المساعدة') >= 0")));
      await shot(opt.sessionId, "options-support");
    }
  }
  check("★ الإعدادات: الأقسام نفسها في الاختيارات كلها (" + (IDS.length + 1) + ") ولا قسم مخفي", "true/false", sameSecs + "/" + (secAll.indexOf("مخفي") >= 0));
  // ★ الخط العربي (DESIGN-fonts §٣.٢، §٤.٢): البطاقة بعد «التشغيل»، والعامل الحقيقي كتب نسخة الافتراضي عند التثبيت
  // ★ (ر8-د، ١ جمادى الأولى ١٤٤٨هـ — N3) و«المواقع» بعد «التشغيل» مباشرةً (طلب المالك)، ثم «الخط العربي»
  check("الإعدادات: «المواقع» بعد «التشغيل» مباشرةً، ثم بطاقة «الخط العربي»", "run,sites,font", secAll.split(",").slice(0, 3).join(","));
  const DEF = globalThis.CMLConst.fontResolve(undefined);
  const fdat = await until(opt.sessionId, "new Promise(function(r){chrome.storage.local.get(['cml_font_data'],function(s){var d=s.cml_font_data;r(d&&typeof d.b64==='string'?d.id+'/'+d.v+'/'+d.b64.length:'');});})", 8000);
  check("★ العامل الحقيقي كتب نسخة الخط الافتراضي عند التثبيت (onInstalled)", DEF.id + "/" + DEF.sha + "/" + Math.ceil(DEF.bytes / 3) * 4, fdat);
  // لا فيضان أفقي على عرض الهاتف
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 375, height: 800, deviceScaleFactor: 1, mobile: true }, opt.sessionId);
  await evalIn(opt.sessionId, "var s=document.getElementById('domainSel'); s.value='all'; s.dispatchEvent(new Event('change')); true");
  await wait(500);
  check("★ الإعدادات: لا فيضان أفقي على 375px", "true",
    // عند الإخفاق: العناصر الفائضة بأسمائها (أوسعُ من العرض أو خارجه) — تشخيصٌ لا تخمين
    await evalIn(opt.sessionId, "(function(){var W=document.documentElement.clientWidth;if(document.documentElement.scrollWidth<=W+1)return true;" +
      "return [].slice.call(document.querySelectorAll('body *')).filter(function(e){var r=e.getBoundingClientRect();return r.width&&(r.right>W+1||r.left<-1);})" +
      ".slice(0,8).map(function(e){var r=e.getBoundingClientRect();return e.tagName+(e.id?'#'+e.id:'')+'['+Math.round(r.left)+','+Math.round(r.right)+']';}).join(' ');})()"));
  await shot(opt.sessionId, "options-all-375");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1000, height: 1400, deviceScaleFactor: 1, mobile: false }, opt.sessionId);
  await evalIn(opt.sessionId, "var s=document.getElementById('domainSel'); s.value='app'; s.dispatchEvent(new Event('change')); true");
  const adm = await evalIn(opt.sessionId,
    "new Promise(function(r){chrome.runtime.sendMessage({type:'sync-admin',op:'disable'},function(x){r(JSON.stringify(x||null));});})");
  check("★ العامل يقبل أمر الإدارة من صفحة الإعدادات (في تبويب)", '{"ok":true}', adm);
  // تعديل التصحيحات أمرٌ جزئي يطبّقه العامل الحقيقي على مفتاح النطاق
  const ed = await evalIn(opt.sessionId,
    "new Promise(function(r){chrome.runtime.sendMessage({type:'terms-edit',d:'support',lang:'ar',ops:[{op:'set',k:'Smoke key',v:'مفتاح الدخان'}]}," +
    "function(x){chrome.storage.local.get(['cml_overrides.support'],function(s){r(!!(x&&x.ok)+'/'+((s['cml_overrides.support']||{}).ar||{})['Smoke key']);});});})");
  check("★ العامل يطبّق تعديل التصحيحات الجزئي على مفتاح نطاقه", "true/مفتاح الدخان", ed);
  // إعادة ضبط موقعٍ واحد عبر العامل الحقيقي: مفاتيحه وحدها، ومفاتيح غيره باقية؛ ومفتاحٌ غريب يُرفض
  const rs = await evalIn(opt.sessionId,
    "new Promise(function(r){chrome.storage.local.set({cml_overrides:{ar:{'Smoke app':'تطبيق'}}},function(){" +
    "chrome.runtime.sendMessage({type:'sync-admin',op:'reset',domain:'support',keys:['cml_overrides']},function(bad){" +
    "chrome.runtime.sendMessage({type:'sync-admin',op:'reset',domain:'support',keys:CMLConst.keysOfDomain('support')},function(x){" +
    "chrome.storage.local.get(['cml_overrides','cml_overrides.support'],function(s){r(!!(bad&&bad.error)+'/'+!!(x&&x.ok)+'/'+!!s.cml_overrides+'/'+!!s['cml_overrides.support']);});});});});})");
  check("★ العامل: إعادة ضبط «مركز المساعدة» وحده تُبقي التطبيق، ويرفض مفتاحًا لا يخصّه", "true/true/true/false", rs);

  if (!port) {
    results.push("ℹ لا openssl هنا: تُخطّيت اختبارات صفحات النطاقات (سكربتات المحتوى)");
  } else {
    // ٢) التطبيق: التعريب والاتجاه، واستثناء المحادثة، والورقة الحيّة من العامل الحقيقي
    const app = await openPage("https://claude.ai/new");
    const on = await until(app.sessionId, "document.documentElement.getAttribute('data-cml')==='on' && document.getElementById('t1')", 8000);
    check("التطبيق: سكربت المحتوى حُقن (data-cml=on)", "true", !!on);
    check("التطبيق: الاتجاه واللغة", "rtl/ar",
      (await evalIn(app.sessionId, "document.documentElement.dir")) + "/" + (await evalIn(app.sessionId, "document.documentElement.lang")));
    // ★ (ر5-ج، المراجعة المستقلة E9) يُنتظر التعريب كسائر الفحوص: كان يُقرأ فور data-cml=on، فأخفق مرةً والجهاز مشغولٌ بعد الاختبارات
    const t1Tr = await until(app.sessionId, "document.getElementById('t1').textContent !== 'New chat'", 8000);
    check("التطبيق: عُرّبت تسميةٌ من القاموس", "true", !!t1Tr);
    check("التطبيق: نصّ المحادثة (.prose) لا يُمسّ", "Settings", await evalIn(app.sessionId, "document.getElementById('msg').textContent"));
    // ★ الخط العربي بالإضافة الحقيقية: وجهٌ عربيّ المدى تحت عائلة الموقع نفسها (من عالم سكربت المحتوى إلى document.fonts)، والسمة
    const AR_FACE = "(function(){var n=0;document.fonts.forEach(function(f){if(/^U\\+600-6FF/i.test(f.unicodeRange)&&f.family.replace(/[\"']/g,'')==='anthropic-sans')n++;});return n;})()";
    const arN = await until(app.sessionId, AR_FACE + " > 0 && document.documentElement.hasAttribute('data-cml-font') && " + AR_FACE, 8000);
    check("★ التطبيق: وجه الخط العربي تحت anthropic-sans بمداه العربي، والسمة data-cml-font على <html>", "true", !!arN);
    const live = await until(app.sessionId, "document.documentElement.getAttribute('data-cml-rtl')==='live' && !!document.getElementById('cml-live-rtl')", 15000);
    check("★ التطبيق: الورقة الحيّة بناها العامل الحقيقي وحُقنت (البوابة live)", "true", !!live);
    const layerFirst = await evalIn(app.sessionId,
      "(function(){for (var i=0;i<document.styleSheets.length;i++){var s=document.styleSheets[i];try{var r=s.cssRules;if(r&&r.length&&r[0].cssText.indexOf('@layer cml-point, cml-imp')===0)return true;}catch(e){}}return 'no-base-first';})()");
    check("التطبيق: إعلان الطبقات في ورقة الإضافة الأولى", "true", layerFirst);
    // ★ (١٦ ربيع الآخر ١٤٤٨هـ) ورقة <style> داخل المحادثة (.prose) لا تدخل الورقة الحيّة: لا في المحقونة ولا في المخزَّنة لدى العامل
    const chatCss = await evalIn(opt.sessionId, "new Promise(function(r){chrome.storage.local.get(['cml_rtl_live'],function(s){var v=s.cml_rtl_live;r(!!v && typeof v.css==='string' ? String(v.css.indexOf('zq-chat')>=0) : 'none');});})");
    check("★ التطبيق: ورقةٌ داخل المحادثة (.prose) لا تُرسل ولا تُخزَّن", "false/false",
      chatCss + "/" + (await evalIn(app.sessionId, "(document.getElementById('cml-live-rtl')||{textContent:''}).textContent.indexOf('zq-chat')>=0")));
    await shot(app.sessionId, "app");

    // ٣) مركز المساعدة: قاموسه، واتجاهه، و.prose يُعرَّب هنا (الاستثناء للتطبيق وحده)
    const sup = await openPage("https://support.claude.com/en/");
    const son = await until(sup.sessionId, "document.documentElement.getAttribute('data-cml')==='on'", 8000);
    check("مركز المساعدة: سكربت المحتوى حُقن بقاموس نطاقه", "true/rtl", !!son + "/" + (await evalIn(sup.sessionId, "document.documentElement.dir")));
    // ★ (مراجعة القيود ٤) لا قراءة قبل وجود المستند: تحت الحمل لا يكون documentElement قد وُجد بعد مهلةٍ ثابتة فيرمي التقييم
    // (خطأ نوعٍ أسقط تحققًا مختلفًا في كل تشغيل) — انتظارُ جاهزيته أولًا، والقراءة آمنةٌ لو غاب
    const INERT = "(function(){var h=document.documentElement;return h?['data-cml','dir','data-cml-hold','data-cml-boot'].map(function(a){return String(h.getAttribute(a));}).join('/'):'no-document';})()";
    const READY = "document.readyState!=='loading' && !!document.documentElement";
    // ٤) منصة المطوّرين: خاملٌ خارج /docs/en/، وعاملٌ فيه
    const con = await openPage("https://platform.claude.com/settings/keys");
    await until(con.sessionId, READY, 8000); await wait(1500);
    check("★ لوحة المطوّرين خارج /docs: خاملٌ تمامًا (لا سمات ولا إخفاء)", "null/null/null",
      (await evalIn(con.sessionId, "(function(){var h=document.documentElement;return h?['data-cml','dir','data-cml-boot'].map(function(a){return String(h.getAttribute(a));}).join('/'):'no-document';})()")));
    const doc = await openPage("https://platform.claude.com/docs/en/intro");
    const don = await until(doc.sessionId, "document.documentElement.getAttribute('data-cml')==='on'", 8000);
    check("الوثائق داخل /docs/en/: عامل", "true", !!don);
    // ★ (S6-C) الإضافة الحقيقية بقطعة الصفحة الحقيقية عبر العامل الحقيقي: علامات الإبقاء (merge-blocks ← البناء ← العامل) تسبق
    // قاموس الواجهة في صفوف الجدول، والقاموس يعمل خارج المتن؛ و«C#» في الشريط معزولةٌ؛ والبوابة بإشارة الخمول (hydrateSignal)
    const aws = await openPage("https://platform.claude.com/docs/en/build-with-claude/claude-platform-on-aws");
    await until(aws.sessionId, "!!document.getElementById('hdrRl') && document.getElementById('hdrRl').textContent!=='Rate limits'", 12000);
    await wait(1000);
    check("★ الوثائق (صفحة AWS بقطعتها): علامات الإبقاء تسبق قاموس الواجهة في الجدول، والقاموس يعرّب النص نفسه خارج المتن",
      "Rate limits/Memory stores/حدود المعدل",
      await evalIn(aws.sessionId, "['awsRl','awsMs','hdrRl'].map(function(i){return document.getElementById(i).textContent.replace(/[\\u2066-\\u2069]/g,'');}).join('/')"));
    check("★ الوثائق: «C#» في الشريط الجانبي معزولةٌ بـLRI…PDI (لا «#C»)، و«Python» كما هي", "true/Python",
      await evalIn(aws.sessionId, "(document.getElementById('sdkCs').textContent===String.fromCharCode(0x2066)+'C#'+String.fromCharCode(0x2069))+'/'+document.getElementById('sdkPy').textContent"));
    const awsGate = await evalIn(opt.sessionId, `new Promise(function (r) {
      chrome.tabs.query({}, function (tabs) {
        var left = tabs.length, out = "none-answered";
        tabs.forEach(function (t) {
          chrome.tabs.sendMessage(t.id, { type: "cml-hello" }, { frameId: 0 }, function (res) {
            void chrome.runtime.lastError;
            if (res && res.domain === "docs" && res.bodies && /claude-platform-on-aws/.test(res.bodies.page || "")) out = res.text;
            if (--left === 0) r(out);
          });
        });
      });
    })`);
    check("★ الوثائق: بوابة النصوص فُتحت بإشارة الخمول بعد الترطيب (hydrateSignal)", "open:hydrated+idle", awsGate);
    await shot(aws.sessionId, "docs-aws");
    await cdp.send("Target.closeTarget", { targetId: aws.targetId }).catch(() => {});
    // ★ نسخة ‎.md‎ الخام تحت مطابقة الوثائق: المحرّك خاملٌ تمامًا (لا اتجاه ولا إمساك يُخفي الصفحة)
    const dmd = await openPage("https://platform.claude.com/docs/en/intro.md");
    await until(dmd.sessionId, READY, 8000); await wait(1500);
    check("★ الوثائق: نسخة ‎.md‎ الخام خاملةٌ تمامًا (حارس نوع المستند)", "null/null/null/null", await evalIn(dmd.sessionId, INERT));
    // ٤ب) وثائق Claude Code: ‎/docs‎ بعينه كامل، و‎/docs/<locale>/‎ الأخرى خاملة، و‎.md‎ خامل، والورقة الحيّة تقلب المضمَّن
    const cod = await openPage("https://code.claude.com/docs/en/overview");
    const cdon = await until(cod.sessionId, "document.documentElement.getAttribute('data-cml')==='on' && document.documentElement.getAttribute('dir')==='rtl'", 8000);
    check("وثائق Claude Code داخل ‎/docs/en/‎: عامل", "true/full", !!cdon + "/" + (await evalIn(cod.sessionId, "document.documentElement.getAttribute('data-cml-route')")));
    const clive = await until(cod.sessionId, "document.documentElement.getAttribute('data-cml-rtl')==='live' && !!document.getElementById('cml-live-rtl')", 20000);
    check("★ وثائق Claude Code: الورقة الحيّة تقلب CSS الموقع المضمَّن في المتن (margin-left:7px ← يمين)", "true/0px/7px",
      !!clive + "/" + (await evalIn(cod.sessionId, "getComputedStyle(document.getElementById('zq')).marginLeft")) + "/" +
      (await evalIn(cod.sessionId, "getComputedStyle(document.getElementById('zq')).marginRight")));
    const cgate = await until(cod.sessionId, "document.getElementById('h').textContent !== 'Overview'", 8000);
    check("★ وثائق Claude Code: بعد إشارة الترطيب يُعرَّب الرأس، وجواب المساعد (#chat-content) لا يُمسّ", "true/Overview",
      !!cgate + "/" + (await evalIn(cod.sessionId, "document.getElementById('ans').textContent")));
    const croot = await openPage("https://code.claude.com/docs");
    const cron = await until(croot.sessionId, "document.documentElement.getAttribute('data-cml')==='on'", 8000);
    check("★ وثائق Claude Code: ‎/docs‎ بعينه كامل (routes.exact)", "true/full", !!cron + "/" + (await evalIn(croot.sessionId, "document.documentElement.getAttribute('data-cml-route')")));
    const cxx = await openPage("https://code.claude.com/docs/xx/overview");
    await until(cxx.sessionId, READY, 8000); await wait(1500);
    check("★ وثائق Claude Code: ‎/docs/<locale>/‎ الأخرى خاملة تمامًا", "null/null/null/null", await evalIn(cxx.sessionId, INERT));
    const cmd = await openPage("https://code.claude.com/docs/en/overview.md");
    await until(cmd.sessionId, READY, 8000); await wait(1500);
    check("★ وثائق Claude Code: نسخة ‎.md‎ الخام خاملة تمامًا", "null/null/null/null", await evalIn(cmd.sessionId, INERT));
    // ٤ج) ★ (ر3) الوثائق القانونية بالإضافة الحقيقية: المسار بعينه كامل بقاموسه المبنيّ (نمط التاريخ) وأوراقه (legal-point.css: الغلاف LTR،
    // ولا تنبيه بلا كتلةٍ معرَّبة)، ومنتقي لغة الصفحة بلغةٍ أخرى يُخمدها، والأرشيف خامل
    const lg = await openPage("https://www.anthropic.com/legal/privacy");
    const lgon = await until(lg.sessionId, "document.documentElement.getAttribute('data-cml')==='on' && !!document.getElementById('lgDate') && document.getElementById('lgDate').textContent!=='October 8, 2026'", 12000);
    check("★ الوثائق القانونية: المسار بعينه كامل، والصفحة RTL وغلافها LTR (legal-point.css)، والتاريخ بنمط القاموس المبنيّ، ولا تنبيه بلا قطعة",
      "true/full/rtl/ltr/8 أكتوبر 2026/none",
      !!lgon + "/" + (await evalIn(lg.sessionId, "document.documentElement.getAttribute('data-cml-route')")) + "/" +
      (await evalIn(lg.sessionId, "document.documentElement.dir")) + "/" +
      (await evalIn(lg.sessionId, "getComputedStyle(document.getElementById('lgHdr')).direction")) + "/" +
      (await evalIn(lg.sessionId, "document.getElementById('lgDate').textContent")) + "/" +
      (await evalIn(lg.sessionId, "getComputedStyle(document.getElementById('lgBody'),'::before').content")));
    // منتقي لغة الوثيقة يبدّل قيمته المختارة (React يكتب نصّها في مكانه): لغةٌ أخرى ⇒ خمولٌ تام والتاريخ على أصله
    await evalIn(lg.sessionId, "document.getElementById('lgLang').firstChild.nodeValue='Zq Other'; true");
    const lgoff = await until(lg.sessionId, "document.documentElement.getAttribute('data-cml')===null", 6000);
    check("★ الوثائق القانونية: منتقي لغة الصفحة بلغةٍ أخرى ⇒ خمولٌ تام (meta.siteLangSel)", "true/null/en/October 8, 2026",
      !!lgoff + "/" + (await evalIn(lg.sessionId, "String(document.documentElement.getAttribute('dir'))")) + "/" +
      (await evalIn(lg.sessionId, "document.documentElement.lang")) + "/" + (await evalIn(lg.sessionId, "document.getElementById('lgDate').textContent")));
    // ★ (مراجعة ر3) منتقي الصفحة بلغةٍ أخرى من التحميل الأول: خمولٌ من البداية (لا إمساك ولا اتجاه ولا تعريب)، ثم English ⇒ تعمل
    const lgg = await openPage("https://www.anthropic.com/legal/cookies");
    await until(lgg.sessionId, READY, 8000); await wait(2500);
    check("★ الوثائق القانونية: منتقي الصفحة بلغةٍ أخرى من التحميل الأول ⇒ خمولٌ تام من البداية", "null/null/null/null|en|October 8, 2026",
      (await evalIn(lgg.sessionId, INERT)) + "|" + (await evalIn(lgg.sessionId, "document.documentElement.lang")) + "|" +
      (await evalIn(lgg.sessionId, "document.getElementById('lgDate').textContent")));
    await evalIn(lgg.sessionId, "document.getElementById('lgLang').firstChild.nodeValue='English'; true");
    const lggOn = await until(lgg.sessionId, "document.documentElement.getAttribute('data-cml')==='on'", 6000);
    check("★ الوثائق القانونية: ثم English في المنتقي ⇒ تعمل", "true/rtl/8 أكتوبر 2026",
      !!lggOn + "/" + (await evalIn(lgg.sessionId, "document.documentElement.dir")) + "/" + (await evalIn(lgg.sessionId, "document.getElementById('lgDate').textContent")));
    const lga = await openPage("https://www.anthropic.com/legal/archive/zq");
    await until(lga.sessionId, READY, 8000); await wait(1500);
    check("★ الوثائق القانونية: الأرشيف خاملٌ تمامًا (الوثائق الخمس بأعيانها)", "null/null/null/null", await evalIn(lga.sessionId, INERT));
    // ٤د) ★ (ر4) الأكاديمية بالإضافة الحقيقية: الدرس الإنجليزي كامل RTL ومتنه LTR (academy-point.css) وملخصه LTR بنصّه (dirSel)، وبوابة
    // النصوص تفتحها كتابة الموقع لـ<html lang> ثم الخمول (hydrateSignal "lang") ولغة الصفحة ar بعدها؛ وصفحة ‎/<لغة>/…‎ خاملة؛ وكتابة
    // الموقع لغةً أخرى في <html lang> (اختيارٌ محفوظ أو لغة المتصفح) تُخمدها
    const ac = await openPage("https://academy.claude.com/courses/zq/zq-lesson");
    const acon = await until(ac.sessionId, "document.documentElement.getAttribute('data-cml')==='on' && document.readyState==='complete'", 12000);
    // (الملخص الإنجليزي يأخذ dir=auto فيحسمه المتصفح LTR بأول حرفٍ قوي)
    check("★ الأكاديمية: الدرس كامل، والصفحة RTL ومتنها LTR (academy-point.css) وملخصها الإنجليزي LTR (dirSel)", "true/full/rtl/ltr/auto:ltr",
      !!acon + "/" + (await evalIn(ac.sessionId, "document.documentElement.getAttribute('data-cml-route')")) + "/" +
      (await evalIn(ac.sessionId, "document.documentElement.dir")) + "/" +
      (await evalIn(ac.sessionId, "getComputedStyle(document.getElementById('acArt')).direction")) + "/" +
      (await until(ac.sessionId, "(function(){var e=document.getElementById('acSum'),d=e.getAttribute('dir');return d?d+':'+getComputedStyle(e).direction:'';})()", 4000)));
    const AC_GATE = `new Promise(function (r) {
      chrome.tabs.query({}, function (tabs) {
        var left = tabs.length, out = "none-answered";
        tabs.forEach(function (t) {
          chrome.tabs.sendMessage(t.id, { type: "cml-hello" }, { frameId: 0 }, function (res) {
            void chrome.runtime.lastError;
            if (res && res.domain === "academy" && res.route === "full") out = res.text;
            if (--left === 0) r(out);
          });
        });
      });
    })`;
    const t0g = Date.now();
    let acGate = await evalIn(opt.sessionId, AC_GATE);
    while (acGate === "wait" && Date.now() - t0g < 8000) { await wait(250); acGate = await evalIn(opt.sessionId, AC_GATE); }
    check("★ الأكاديمية: بوابة النصوص فتحتها كتابة الموقع لـ<html lang> ثم الخمول (hydrateSignal \"lang\")، ولغة الصفحة ar بعدها", "open:lang+idle/ar",
      acGate + "/" + (await until(ac.sessionId, "document.documentElement.lang==='ar' && 'ar'", 4000)));
    const acx = await openPage("https://academy.claude.com/xx/courses");
    await until(acx.sessionId, READY, 8000); await wait(1500);
    check("★ الأكاديمية: صفحة ‎/<لغة>/…‎ خاملةٌ تمامًا (حارس المسار)", "null/null/null/null", await evalIn(acx.sessionId, INERT));
    await evalIn(ac.sessionId, "document.documentElement.lang='xx'; true");
    const acoff = await until(ac.sessionId, "document.documentElement.getAttribute('data-cml')===null", 6000);
    check("★ الأكاديمية: الموقع يكتب لغةً أخرى في <html lang> ⇒ خمولٌ تام (حارس siteLang)", "true/null/xx",
      !!acoff + "/" + (await evalIn(ac.sessionId, "String(document.documentElement.getAttribute('dir'))")) + "/" + (await evalIn(ac.sessionId, "document.documentElement.lang")));
    // ٥) نطاقٌ غير مشمول في المانيفست: مركز الخصوصية بلغةٍ أخرى لا يُحقن
    const priv = await openPage("https://privacy.claude.com/en/");
    const pon = await until(priv.sessionId, "document.documentElement.getAttribute('data-cml')==='on'", 8000);
    check("مركز الخصوصية: حُقن", "true", !!pon);
    // ٦) ما تسأله النافذة المنبثقة: نطاقُ كل تبويبٍ بمراسلة إطاره الأعلى (قرار المالك ق١)
    // (بلا إذن tabs لا يُرى عنوان التبويب — والنافذة لا تحتاجه: الجواب يحمل النطاق نفسه)
    const hello = await evalIn(opt.sessionId, `new Promise(function (r) {
      chrome.tabs.query({}, function (tabs) {
        var out = [], left = tabs.length;
        if (!left) r("[]");
        tabs.forEach(function (t) {
          chrome.tabs.sendMessage(t.id, { type: "cml-hello" }, { frameId: 0 }, function (res) {
            void chrome.runtime.lastError;
            if (res && res.domain) out.push(res.domain + ":" + res.route);
            if (--left === 0) r(JSON.stringify(out.sort()));
          });
        });
      });
    })`);
    // (والتبويبان الخامان ‎.md‎ لا يجيبان أصلًا: المحرّك لم يعمل فيهما)
    check("★ النافذة: كل تبويبٍ يُجيب بنطاقه وحال حارسه", "academy:full,academy:inactive,app:full,code:full,code:full,code:inactive,docs:full,docs:inactive,legal:full,legal:full,legal:inactive,privacy:full,support:full",
      JSON.parse(hello || "[]").join(","));
    // ★ وفي الردّ حال الخط (م٨): تبويب التطبيق «ok» (وجهٌ معكوس، والمحرّك كتب ترجمته في عنصرٍ بعائلته)
    const fontHello = await evalIn(opt.sessionId, `new Promise(function (r) {
      chrome.tabs.query({}, function (tabs) {
        var left = tabs.length, out = "none-answered";
        tabs.forEach(function (t) {
          chrome.tabs.sendMessage(t.id, { type: "cml-hello" }, { frameId: 0 }, function (res) {
            void chrome.runtime.lastError;
            if (res && res.domain === "app" && res.font) out = res.font.reach + "/" + res.font.id;
            if (--left === 0) r(out);
          });
        });
      });
    })`);
    check("★ النافذة والبطاقة: ردّ cml-hello من التطبيق يحمل حال الخط (ok والافتراضي)", "ok/" + globalThis.CMLConst.FONT_DEFAULT, fontHello);
    // ٧) «فحص المواقع كلها» من «الكل»: بالتتابع على كل موقعٍ له ماسح — التطبيق (فحص الحزم؛ الصفحة
    // الاصطناعية بلا ملفات فيُصرَّح بالخطأ) ثم الوثائق (ماسح llms بقراءة llms.txt من أصل التبويب)
    await evalIn(opt.sessionId, "var s=document.getElementById('domainSel'); s.value='all'; s.dispatchEvent(new Event('change')); true");
    await wait(500);
    await evalIn(opt.sessionId, "document.getElementById('startScan').click(); true");
    const got = await until(opt.sessionId, "new Promise(function(r){chrome.storage.local.get(['cml_scan_result','cml_scan_result.docs','cml_scan_result.code'],function(s){" +
      "var a=s.cml_scan_result,d=s['cml_scan_result.docs'],c=s['cml_scan_result.code'];r(a&&d&&c&&a.status!=='running'&&d.status!=='running'&&c.status!=='running'?JSON.stringify({a:a.status,d:d,c:c}):'');});})", 60000);
    const res = got ? JSON.parse(got) : { d: {}, c: {} };
    const L = (res.d.list || []).concat(res.d.varList || []);
    check("★ «فحص المواقع كلها» يشمل التطبيق والوثائق بنتائج مفصولة", "error/done/llms",
      res.a + "/" + res.d.status + "/" + res.d.source);
    check("★ ماسح llms: عناوين المسار والهيكل ومجموعاتها وحدها، وغير المترجَم منها", "5/true/true/false/false/false",
      res.d.found + "/" + L.includes("Zq Untranslated Page") + "/" + L.includes("Zq Shell Page") + "/" +
      L.includes("Intro to Claude") + "/" + L.includes("Zq Outside Page") + "/" + L.includes("Zq Other Language"));
    // ★ وثائق Claude Code: فهرسها من ‎/docs/llms.txt‎ (meta.llms) لا من جذر المضيف — عناوين ‎/docs/en/‎ والهيكل ومجموعته
    const LC = (res.c.list || []).concat(res.c.varList || []);
    check("★ «فحص المواقع كلها» يشمل وثائق Claude Code بفهرسها تحت ‎/docs‎، وما خارج حارس المسار لا يُعدّ", "done/llms/4/true/true/true/false/false",
      res.c.status + "/" + res.c.source + "/" + res.c.found + "/" + LC.includes("Zq Code Untranslated") + "/" + LC.includes("Zq Code Shell") + "/" +
      LC.includes("Zq Code Group") + "/" + LC.includes("Zq Other Language") + "/" + LC.includes("Zq Other Index"));
    // صفُّ موقعٍ بلا فحص لا يكرّر «بلا فحص» (عمودُ نوع الفحص بجواره يقولها) ولا يعرض مصطلحات البناء
    // (الصفّ يُرسم بعد حدث التخزين لا معه: يُنتظر رسمُه قبل الحكم)
    const ROWS = "(document.getElementById('scanRes_docs').textContent.indexOf('وجد')===0)+'/'+(document.getElementById('scanRes_app').textContent.indexOf('تعذّر')===0)+'/'+" +
      "(document.getElementById('scanRes_support').textContent.indexOf('بلا فحص')<0&&document.getElementById('scanRes_support').textContent.indexOf('المتون')<0)";
    await until(opt.sessionId, ROWS + "==='true/true/true'", 5000);
    check("الإعدادات: صفّا الفحص يعرضان النتيجتين، و«مركز المساعدة» بلا تكرارٍ ولا مصطلح «المتون»", "true/true/true",
      await evalIn(opt.sessionId, ROWS));
    await shot(opt.sessionId, "options-all-scanned");
    // ★ حارس المسار: صفحةٌ خاملة من مضيف الوثائق (لوحة المطوّرين) لا تجيب طلب فحص الوثائق —
    // يُغلق تبويبُ /docs/ ويُرسل طلبٌ للوثائق فلا يُكتب حتى إشعارُ استلام
    try { await cdp.send("Target.closeTarget", { targetId: doc.targetId }); } catch {}
    await wait(300);
    const guard = await evalIn(opt.sessionId, "new Promise(function(r){chrome.storage.local.remove('cml_scan_result.docs',function(){" +
      "chrome.storage.session.set({cml_scan_request:{d:'docs',kind:'scan',at:Date.now(),id:'smoke-guard-'+Date.now()}},function(){" +
      "setTimeout(function(){chrome.storage.local.get(['cml_scan_result.docs'],function(s){r(JSON.stringify(s['cml_scan_result.docs']||null));});},3000);});});})");
    check("★ حارس المسار: تبويبُ لوحة المطوّرين (خارج /docs) لا يجيب فحص الوثائق", "null", guard);
  }
} catch (e) {
  failures++;
  results.push("✗ استثناء: " + (e && e.message) + (stderr ? " | " + stderr.slice(-300) : ""));
} finally {
  console.log(results.join("\n"));
  console.log(failures ? `\n✗ الدخان: ${failures} إخفاق` : "\n✓ الدخان: الإضافة المحمَّلة سليمة");
  try { server && server.close(); } catch {}
  try { await cdp.send("Browser.close"); } catch {}
  // انتظار الخروج بسقفٍ ثم SIGKILL، ثم الحذف بإعادات (كان الحذف يجري بعد السقف ولو بقي كروم حيًّا يكتب في ملفه)
  await prof.close();
  process.exit(failures ? 1 : 0);
}
