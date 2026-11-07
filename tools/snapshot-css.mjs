// snapshot-css.mjs — لقطةُ أوراق CSS العامة لصفحةٍ من الموقع بترتيب المستند (مدخل gen-rtl).
//   node snapshot-css.mjs --target=intercom|docs|code|legal|academy|com|app --url=<صفحة> [--url=<صفحة>…] [--out=<مجلد>]
// يفتح كل صفحة في كروم بلا واجهة (بعد الترطيب)، ويقرأ أوراقها بترتيب المستند: <link rel=stylesheet>
// **و<style> المضمَّنة** (فحص الاتجاه الشامل: قوالب المنصة الجديدة وأوراق الموقع المضمَّنة كانت خارج اللقطة)،
// ثم ينزّل الروابط عامّةً (بلا اعتماد) ويكتب _manifest.json ({css:[{file, url, media, sha256, inline?}]}).
// الصفحات المتعددة تُجمع اتحادًا بترتيب أول ظهور (قالب المقالة وقالب الرئيسة وقالب المجموعة معًا) —
// فالترتيب عقد: قواعد الموقع غير المطبَّقة تتحاكم بالترتيب عند تساوي التخصيص.
// ورقةٌ يتعذّر تنزيلها (ورقة خطوطٍ تردّ 400 مثلًا) تُترك بتنبيهٍ ولا يسقط كل شيء.
// يكتب في مجلد الهدف (sitecss-<هدف> بجوار toolchain) بعد تفريغه من ‎.css‎ القديمة وحدها.
// ★ (ر29-ط، ١٩ جمادى الأولى ١٤٤٨هـ — C1 من ر29-ز) وصفحةُ تحقّقٍ (Cloudflare) بدل صفحة الموقع تُرفض: كانت الأداة تخرج ناجحةً وتكتب ورقتي
// التحقّق المضمَّنتين لقطةً، فتُفرغ مجلدًا حقيقيًّا (sitecss لـclaude.ai). تُعرف كما يعرفها فحص الاتجاه (CHALLENGE_PROBE في cdp-lib.mjs: سكربت التحدّي
// أو متغيّره أو نموذجه بلا شرط، والعنوان والنصّ وحدهما بحالة 403 أو 503)، فتخرج الأداة بالرمز 3 وبرسالةٍ عربية ولا تكتب شيئًا ولا تمسّ اللقطة القائمة.
// ★ (مراجعة ر29-ط، ١٩ جمادى الأولى ١٤٤٨هـ) وصفحةُ خطأٍ HTTP (الحالة 400 فما فوق) تُرفض كذلك بالرمز 3 ولا يُكتب شيء: صفحة الحجب من Cloudflare
// («Access denied»، الخطأ 1020، بالحالة 403) لا يعرفها فحص التحقّق، وصفحة 404 أو 5xx ليست صفحة الموقع — وكلٌّ منها كان يُكتب لقطةً فيُفرغ المجلد.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { launch, settle, CHALLENGE_PROBE } from "./cdp-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const DIRS = { app: "sitecss", intercom: "sitecss-intercom", docs: "sitecss-docs", code: "sitecss-code", legal: "sitecss-legal",
  academy: "sitecss-academy", com: "sitecss-com" };
const target = opt("target", "");
const urls = argv.filter((x) => x.startsWith("--url=")).map((x) => x.slice(6));
const url = urls[0] || "";
if (!DIRS[target] || !url) { console.error("usage: node snapshot-css.mjs --target=" + Object.keys(DIRS).join("|") + " --url=<صفحة> [--url=…]"); process.exit(2); }
const OUT = path.resolve(opt("out", path.join(HERE, "..", DIRS[target])));

const cdp = await launch();
let sheets = [];
const seenKey = new Set();
let challenge = null, httpErr = null;
try {
  for (const u of urls) {
    const { targetId, sessionId } = await cdp.openPage(u);
    await settle(cdp, sessionId, { quietMs: 1500, maxMs: 20000 });
    // ★ (ر29-ط) صفحة تحقّقٍ لا صفحة الموقع: لا تُقرأ أوراقها، ولا يُكتب شيء (انظر الرأس)
    const chl = await cdp.evalIn(sessionId, CHALLENGE_PROBE);
    if (chl) { challenge = { url: u, status: chl.status, title: chl.title }; await cdp.closePage(targetId); break; }
    // ★ (مراجعة ر29-ط) وصفحة خطأٍ HTTP ليست صفحة الموقع وإن لم تكن تحقّقًا (انظر الرأس): حالة المستند من سجلّ التنقّل، و0 (مجهولة) لا تُرفض
    const nav = await cdp.evalIn(sessionId, `(function(){ var n = (performance.getEntriesByType("navigation") || [])[0] || {};
      return { status: n.responseStatus || 0, title: String(document.title || "").slice(0, 60) }; })()`);
    if (nav && nav.status >= 400) { httpErr = { url: u, status: nav.status, title: nav.title }; await cdp.closePage(targetId); break; }
    const list = await cdp.evalIn(sessionId, `Array.prototype.slice.call(document.querySelectorAll('link[rel~="stylesheet"][href], style'))
      .filter(function (l) { return !l.disabled && !(l.hasAttribute && l.hasAttribute("data-cml")); })
      .map(function (l) { return l.tagName === "STYLE" ? { inline: l.textContent || "", media: l.media || "" } : { url: l.href, media: l.media || "" }; })
      .filter(function (x) { return x.url || /[{]/.test(x.inline); })`);
    let added = 0;
    for (const x of list) {
      const k = x.url ? "u:" + x.url : "s:" + crypto.createHash("sha256").update(x.inline).digest("hex");
      if (seenKey.has(k)) continue;
      seenKey.add(k); sheets.push(x); added++;
    }
    console.log(`• ${u}: ${list.length} ورقة (${added} جديدة)`);
    await cdp.closePage(targetId);
  }
} finally { cdp.close(); }
if (challenge) {
  console.error(`✗ رُفضت اللقطة: ${challenge.url} صفحةُ تحقّقٍ من Cloudflare (الحالة ${challenge.status || "؟"}، والعنوان «${challenge.title}») لا صفحةُ الموقع.` +
    ` لم يُكتب شيء، وبقي ${path.relative(process.cwd(), OUT) || OUT} كما كان. أعد المحاولة لاحقًا أو من شبكةٍ أخرى، أو خذ اللقطة من متصفحك.`);
  process.exit(3);
}
if (httpErr) {
  console.error(`✗ رُفضت اللقطة: ${httpErr.url} أجابت بالحالة ${httpErr.status} (والعنوان «${httpErr.title}»)، فليست صفحةَ الموقع.` +
    ` لم يُكتب شيء، وبقي ${path.relative(process.cwd(), OUT) || OUT} كما كان. تحقّق من الرابط، أو أعد المحاولة لاحقًا أو من شبكةٍ أخرى، أو خذ اللقطة من متصفحك.`);
  process.exit(3);
}
if (!sheets.length) { console.error("! لا أوراق CSS في الصفحات"); process.exit(1); }

const FORBID_RE = new RegExp("[" + String.fromCharCode(0x590) + "-" + String.fromCharCode(0x5ff) + String.fromCharCode(0xfb1d) + "-" +
  String.fromCharCode(0xfb4f) + "]", "g");
const got = [];
let skippedSheets = 0;
for (const s of sheets) {
  let text;
  if (s.url) {
    const res = await fetch(s.url, { redirect: "error", credentials: "omit" }).catch((e) => ({ ok: false, status: e.message }));
    if (!res.ok) { console.warn(`⚠ تُركت ${s.url}: HTTP ${res.status}`); skippedSheets++; continue; }
    text = await res.text();
  } else text = s.inline;
  const sha256 = crypto.createHash("sha256").update(text).digest("hex");
  // ★ (ر16-أ، ٦ جمادى الأولى ١٤٤٨هـ) محارف الكتلتين الممنوعتين في نصوص المشروع (قاعدة المالك) لا تُكتب في اللقطة حرفًا: تُكتب بهروب CSS
  // الست عشري («\<رمز> »)، فالقاعدة هي هي عند المحلّل ولا يرفض فحصُ الالتزام اللقطة. والمحارف تُبنى من رموزها وقت التشغيل، والبصمة بصمة الورقة كما نُزّلت
  let escaped = 0;
  text = text.replace(FORBID_RE, (ch) => { escaped++; return "\\" + ch.codePointAt(0).toString(16) + " "; });
  if (escaped) console.warn(`ℹ ${s.url || "مضمَّنة"}: ${escaped} محرفًا من الكتلتين الممنوعتين كُتب بهروب CSS`);
  let file;
  if (s.url) {
    const base = path.basename(new URL(s.url).pathname).replace(/[^\w.-]/g, "_") || "sheet.css";
    file = base.endsWith(".css") ? base : base + ".css";
    if (got.some((g) => g.file === file)) file = file.replace(/\.css$/, "-" + sha256.slice(0, 8) + ".css");
  } else file = "inline-" + sha256.slice(0, 12) + ".css";
  got.push({ file, url: s.url || null, inline: !s.url || undefined, media: s.media, text, sha256 });
}
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith(".css")) fs.rmSync(path.join(OUT, f));
for (const g of got) fs.writeFileSync(path.join(OUT, g.file), g.text, "utf8");
fs.writeFileSync(path.join(OUT, "_manifest.json"), JSON.stringify({
  page: url, pages: urls, at: new Date().toISOString(), skipped: skippedSheets,
  css: got.map((g) => ({ file: g.file, url: g.url, inline: g.inline, media: g.media, sha256: g.sha256 })),
}, null, 1) + "\n", "utf8");
console.log(`✓ ${got.length} ورقة بترتيب المستند → ${path.relative(process.cwd(), OUT)} (${(got.reduce((a, g) => a + g.text.length, 0) / 1024).toFixed(0)} ك.ب)`);
