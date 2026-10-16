// rtl-audit.mjs — فحصٌ آليٌّ شاملٌ لعيوب الاتجاه في الصفحات المعرَّبة بالإضافة الحقيقية.
//
// لماذا: كانت عيوب الاتجاه تُكتشف بالعين صفحةً صفحة ويُبلَّغ عنها واحدًا واحدًا. هذه الأداة تقيس
// «الأثر» لا «النية»: تحمّل الصفحة مرّتين في كروم بلا واجهة — مرّةً بلا إضافة (مرجع LTR) ومرّةً
// بالإضافة المحمَّلة فعلًا من مجلدها (Extensions.loadUnpacked) — ثم تقارن هندسة كل عنصرٍ بنظيره:
// ما كان ملاصقًا لليسار في المرجع يجب أن يلاصق اليمين في المعرَّب، وما كان هامشه أيسرَ يجب أن
// يصير أيمن، والأيقونة الاتجاهية يجب أن تنعكس بكسلاتها. وتفحص فوق ذلك النصَّ العربي المحسوب LTR،
// والمحاذاة، والتمرير الأفقي، والعناصر الخارجة عن الشاشة أو المتراكبة، ثم تنسب كل عيبٍ إلى القاعدة
// المسؤولة (الورقة والمحدِّد) عبر CSS.getMatchedStylesForNode وتصنّفه:
//   engine-gap      — قاعدةٌ فيزيائية من الموقع في اللقطة/الورقة الحيّة ولم ينقلب أثرها (أو لا تُقلب)
//   snapshot-stale  — القاعدة من ورقةٍ ليست في لقطة web/code/sitecss-* (والنطاق بلا ورقة حيّة)
//   point-css       — لا قاعدة فيزيائية تُقلب: نمطٌ سطري محسوب، أو سمة عرض، أو افتراضي المتصفح، أو تخطيط
//   intended-ltr    — جزيرة LTR مقصودة (شيفرة، مرجع API، متنٌ إنجليزي لم يُعرَّب بعد)
//
// لا يرسل شيئًا إلى أي جهة: يقرأ الصفحات العامة كما يقرؤها المتصفح، ويكتب نتائجه على القرص وحده.
// ولا يعدّل المستودع: يقرأ الإضافة واللقطات منه فقط.
//
//   node rtl-audit.mjs                      # العيّنة الافتراضية (النطاقات السبعة، عرضان)
//   node rtl-audit.mjs --domains=docs --widths=1366 --only=pricing
//   node rtl-audit.mjs --gate [--baseline=rtl-audit-baseline.json]   # بوابة: خروجٌ 1 عند عيبٍ جديد
//   node rtl-audit.mjs --write-baseline     # يحفظ بصمات العيوب الحالية خطَّ أساسٍ للبوابة
// خيارات: --repo=<مستودع> --ext=<مجلد الإضافة> --out=<مجلد النتائج> --pages=<ملف JSON> --no-shots
//         --chrome=<مسار> --max-h=<سقف ارتفاع اللقطة> --keep-going --verbose
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const flag = (n) => argv.includes(`--${n}`);

// ---- المسارات: المستودع الذي فيه الأداة (web/code/toolchain) أو صريحًا ----
const REPO = [opt("repo", ""), process.env.CML_REPO, path.resolve(HERE, "..", "..", "..")]
  .filter(Boolean).find((p) => fs.existsSync(path.join(p, "web", "user", "extension", "manifest.json")));
if (!REPO) { console.error("! لم أجد المستودع — مرّر --repo=<مسار المستودع> أو CML_REPO"); process.exit(2); }
const EXT = path.resolve(opt("ext", path.join(REPO, "web", "user", "extension")));
const TOOLCHAIN = path.join(REPO, "web", "code", "toolchain");
// النتائج خارج التتبّع: فيها نصوص الصفحات المفحوصة (سطورٌ من المتون الإنجليزية) — لا تُنشر
const OUT = path.resolve(opt("out", path.join(REPO, "web", "code", "_rtl-audit")));
fs.mkdirSync(OUT, { recursive: true });
const SHOTS = path.join(OUT, "rtl-shots");
const DO_SHOTS = !flag("no-shots");
const MAX_H = +opt("max-h", "16000");
const VERBOSE = flag("verbose");

const { findChrome, tempProfile } = await import(pathToFileURL(path.join(TOOLCHAIN, "cdp-lib.mjs")).href);
await import(pathToFileURL(path.join(EXT, "cml-const.js")).href);
await import(pathToFileURL(path.join(EXT, "cml-rtl.js")).href);
await import(pathToFileURL(path.join(EXT, "cml-shared.js")).href);
const CONST = globalThis.CMLConst || globalThis.CML_CONST || null;
const R = globalThis.CMLRtl;
const SHARED = globalThis.CMLShared;

// ---- الإعدادات من جدول النطاقات نفسه (لا نسخة ثانية) ----
function domainsTable() {
  const g = globalThis;
  for (const k of Object.keys(g)) { const v = g[k]; if (v && typeof v === "object" && Array.isArray(v.DOMAINS)) return v.DOMAINS; }
  return [];
}
const DOMAINS = domainsTable();
const DMETA = Object.fromEntries(DOMAINS.map((d) => [d.id, d]));
// لقطة CSS كل نطاق (لتصنيف «لقطة متقادمة»): ما يُولَّد منه ملف rtl-*.css المشحون
const SNAP_DIR = { app: "sitecss", support: "sitecss-intercom", privacy: "sitecss-intercom", docs: "sitecss-docs", code: "sitecss-code",
  legal: "sitecss-legal", academy: "sitecss-academy" };
const OUR_CSS = { app: ["rtl-overrides.css", "app-point.css"], support: ["rtl-intercom.css", "intercom-point.css"],
  privacy: ["rtl-intercom.css", "intercom-point.css"], docs: ["rtl-docs.css", "docs-point.css"], code: ["rtl-code.css", "code-point.css"],
  legal: ["rtl-legal.css", "legal-point.css"], academy: ["rtl-academy.css", "academy-point.css"] };
function snapshotSet(d) {
  const dir = path.join(REPO, "web", "code", SNAP_DIR[d] || "");
  const set = new Set();
  try { for (const f of fs.readdirSync(dir)) if (f.endsWith(".css")) set.add(f); } catch {}
  return set;
}
const SNAP = Object.fromEntries(Object.keys(SNAP_DIR).map((d) => [d, snapshotSet(d)]));
const GEN_TEXT = {};
function genText(d) {
  if (GEN_TEXT[d] !== undefined) return GEN_TEXT[d];
  let t = "";
  for (const f of OUR_CSS[d] || []) { try { t += fs.readFileSync(path.join(EXT, f), "utf8"); } catch {} }
  return (GEN_TEXT[d] = t);
}

// ---- العيّنة الافتراضية ----
const S = "https://support.claude.com/en/", P = "https://privacy.claude.com/en/", D = "https://platform.claude.com/docs/en/";
const CC = "https://code.claude.com/docs/en/";
const LG = "https://www.anthropic.com/legal/";
const AC = "https://academy.claude.com/";
const DEFAULT_PAGES = [
  { d: "app", tag: "login", url: "https://claude.ai/login" },
  { d: "support", tag: "home", url: S },
  { d: "support", tag: "collection", url: S + "collections/4078531-claude" },
  { d: "support", tag: "art-tables-consumption", url: S + "articles/14782391-claude-enterprise-consumption-guide" },
  { d: "support", tag: "art-tables-roles", url: S + "articles/13930452-manage-custom-roles-on-enterprise-plans" },
  { d: "support", tag: "art-code-tables-tips", url: S + "articles/14554000-claude-code-power-user-tips" },
  { d: "support", tag: "art-images-smart-reports", url: S + "articles/16893491-get-started-with-smart-reports" },
  { d: "support", tag: "art-images-sso", url: S + "articles/13132885-set-up-single-sign-on-sso" },
  { d: "support", tag: "art-video-release-notes", url: S + "articles/12138966-release-notes" },
  { d: "support", tag: "art-lists-rbac", url: S + "articles/13930458-set-up-role-based-permissions-on-enterprise-plans" },
  { d: "support", tag: "art-short-certifications", url: S + "articles/10015870-what-certifications-has-anthropic-obtained" },
  // ★ (ر5-ج، ٢٩ ربيع الآخر ١٤٤٨هـ — ملاحظة المالك ٢(أ)) جدول «ما المتاح على كل واجهة» الذي قُصّت بدايته في RTL (فحص الجداول ٦ب)
  { d: "support", tag: "art-tables-cowork", url: S + "articles/15520349-use-claude-cowork-on-web-desktop-and-mobile" },
  { d: "privacy", tag: "home", url: P },
  { d: "privacy", tag: "collection-commercial", url: P + "collections/10663361-commercial-customers" },
  { d: "privacy", tag: "collection-consumers", url: P + "collections/10663362-consumers" },
  { d: "privacy", tag: "art-cookies-table", url: P + "articles/10023541-what-cookies-does-anthropic-use" },
  { d: "privacy", tag: "art-baa", url: P + "articles/8114513-business-associate-agreements-baa-for-commercial-customers" },
  { d: "privacy", tag: "art-support", url: P + "articles/9015913-how-to-get-support" },
  { d: "privacy", tag: "art-policy-updates", url: P + "articles/10301952-updates-to-our-privacy-policy" },
  { d: "privacy", tag: "art-retention", url: P + "articles/15425996-data-retention-practices-for-covered-models" },
  { d: "docs", tag: "intro", url: D + "intro" },
  { d: "docs", tag: "models-overview", url: D + "models/overview" },
  { d: "docs", tag: "pricing", url: D + "about-claude/pricing" },
  { d: "docs", tag: "tool-use-overview", url: D + "agents-and-tools/tool-use/overview" },
  { d: "docs", tag: "api-messages-shell", url: D + "api/messages" },
  { d: "docs", tag: "release-notes", url: D + "release-notes/overview" },
  // ★ (ر5-ج — القرار 75) صفحةٌ من صفحات ت1 بجداول نثرية ضيّقة الخلايا (whitespace-nowrap) على عرض الجوال
  { d: "docs", tag: "tables-sandbox-workers", url: D + "managed-agents/self-hosted-sandboxes-workers" },
  // وثائق Claude Code (Mintlify): الجذر بمساره بعينه (routes.exact)، وصفحاتٌ تمثّل قوالبه — الخفيفة والثقيلة
  // (hooks وsettings)، والتفاعلية بأوراق <style> في المتن (prompt-library وcontext-window)، وسجلّ الإصدارات هيكلًا فقط
  { d: "code", tag: "root-exact", url: "https://code.claude.com/docs" },
  { d: "code", tag: "overview", url: CC + "overview" },
  { d: "code", tag: "quickstart", url: CC + "quickstart" },
  { d: "code", tag: "hooks", url: CC + "hooks" },
  { d: "code", tag: "settings", url: CC + "settings" },
  { d: "code", tag: "agent-sdk-overview", url: CC + "agent-sdk/overview" },
  { d: "code", tag: "plugins-overview", url: CC + "plugins/overview" },
  { d: "code", tag: "prompt-library", url: CC + "prompt-library" },
  { d: "code", tag: "context-window", url: CC + "context-window" },
  { d: "code", tag: "changelog-shell", url: CC + "changelog" },
  // (فحص الاتجاه ٩، ١٦ ربيع الآخر ١٤٤٨هـ) مجموعةٌ متداخلة مفتوحة في الشريط (desktop)، وصفحة أسبوعٍ من «ما الجديد» بروابطها
  // ذات السهم، ودليل claude-directory بأداته التفاعلية — حالاتٌ فاتت العيّنة فمرّت عيوبها
  { d: "code", tag: "desktop", url: CC + "desktop" },
  { d: "code", tag: "whats-new-week", url: CC + "whats-new/2026-w37" },
  { d: "code", tag: "claude-directory", url: CC + "claude-directory" },
  // ★ (ر3، ٢٨ ربيع الآخر ١٤٤٨هـ) الوثائق القانونية الخمس (المسارات بأعيانها): جداول الخصوصية، والقوائم المرقّمة في الشروط، وتبويبات
  // سياسة الاستخدام. وغلاف anthropic.com يبقى LTR عمدًا (legal-point.css) فتُسجَّل علاماته قراراتٍ لا عيوبًا
  { d: "legal", tag: "privacy-tables", url: LG + "privacy" },
  { d: "legal", tag: "non-user-privacy", url: LG + "non-user-privacy-policy" },
  { d: "legal", tag: "cookies-table", url: LG + "cookies" },
  { d: "legal", tag: "aup-tabs", url: LG + "aup" },
  { d: "legal", tag: "consumer-terms-ol", url: LG + "consumer-terms" },
  // ★ (ر4، ٢٨ ربيع الآخر ١٤٤٨هـ) الأكاديمية (دراسة ر4 §5.4): قالبٌ من كل نوع — الرئيسة، وفهرس الدورات، والدورة، والدرس (ودرسٌ من دورات
  // الواجهة البرمجية الطويلة)، وصفحة الكل بمرشّحاتها، والشرح، وحالة استخدامٍ بفيلمها، والمجموعة، ومركز المنتج، والندوات، والمساعدة
  // (هيكل). والمتون وقوائم «في هذه الصفحة» واللافتة والمنتقي ومحتوى المساعدة تبقى LTR عمدًا (academy-point.css) فتُسجَّل علاماتها
  // قراراتٍ لا عيوبًا (ر5، القرار 78)
  { d: "academy", tag: "home", url: AC },
  { d: "academy", tag: "courses-catalogue", url: AC + "courses" },
  { d: "academy", tag: "course", url: AC + "courses/claude-101" },
  { d: "academy", tag: "lesson", url: AC + "courses/claude-101/what-is-claude" },
  { d: "academy", tag: "api-lesson", url: AC + "courses/building-with-the-claude-api/system-prompts" },
  { d: "academy", tag: "all-filters", url: AC + "all" },
  { d: "academy", tag: "tutorial", url: AC + "tutorials/building-a-powerpoint-with-claude" },
  { d: "academy", tag: "use-case-film", url: AC + "use-cases/account-research-brief" },
  { d: "academy", tag: "collection", url: AC + "collections/ai-fluency" },
  { d: "academy", tag: "product-hub", url: AC + "products/claude" },
  { d: "academy", tag: "webinars", url: AC + "webinars" },
  { d: "academy", tag: "help-shell", url: AC + "help/faq" },
];
let PAGES = DEFAULT_PAGES;
if (opt("pages", "")) PAGES = JSON.parse(fs.readFileSync(opt("pages", ""), "utf8"));
const onlyDom = opt("domains", "") ? opt("domains", "").split(",") : null;
if (onlyDom) PAGES = PAGES.filter((p) => onlyDom.includes(p.d));
if (opt("only", "")) { const re = new RegExp(opt("only", ""), "i"); PAGES = PAGES.filter((p) => re.test(p.tag) || re.test(p.url)); }
const WIDTHS = opt("widths", "1366,390").split(",").map(Number).filter(Boolean);
const UA_DESK = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const UA_MOB = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";

// ═══════════════════════ كروم عبر أنبوب DevTools (مع الأحداث) ═══════════════════════
async function launchChrome(withExt) {
  const exe = findChrome(opt("chrome", ""));
  if (!exe) throw new Error("لم أجد كروم — مرّر --chrome=<المسار>");
  // ★ (ر5) الملف المؤقت يُحذف بعد خروج كروم فعلًا، ومعه احتياطٌ عند خروج العملية (cdp-lib tempProfile)
  const prof = tempProfile("cml-rtlaudit-", "p");
  const args = ["--headless=new", "--remote-debugging-pipe", `--user-data-dir=${prof.dir}`, "--no-first-run",
    "--no-default-browser-check", "--disable-gpu", "--mute-audio", "--hide-scrollbars", "--window-size=1366,900",
    "--force-device-scale-factor=1", "--lang=en-US"];
  if (withExt) args.push("--enable-unsafe-extension-debugging");
  if (process.env.CI) args.push("--no-sandbox", "--disable-dev-shm-usage");
  const proc = spawn(exe, args, { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
  prof.track(proc);
  proc.stderr.on("data", () => {});
  let nextId = 1, buf = "";
  const pending = new Map(), listeners = new Set();
  proc.stdio[4].on("data", (d) => {
    buf += d.toString("utf8");
    let i;
    while ((i = buf.indexOf("\0")) >= 0) {
      const raw = buf.slice(0, i); buf = buf.slice(i + 1);
      let m; try { m = JSON.parse(raw); } catch { continue; }
      if (m.id && pending.has(m.id)) {
        const { res, rej, timer } = pending.get(m.id); pending.delete(m.id); clearTimeout(timer);
        m.error ? rej(new Error(m.error.message || JSON.stringify(m.error))) : res(m.result);
      } else if (m.method) for (const f of listeners) { try { f(m); } catch {} }
    }
  });
  function send(method, params, sessionId, timeoutMs = 60000) {
    return new Promise((res, rej) => {
      const id = nextId++;
      const timer = setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error("مهلة CDP: " + method)); } }, timeoutMs);
      pending.set(id, { res, rej, timer });
      const msg = { id, method, params: params || {} };
      if (sessionId) msg.sessionId = sessionId;
      proc.stdio[3].write(JSON.stringify(msg) + "\0");
    });
  }
  // وعدٌ يتمّ بعد خروج كروم وحذف ملفه (كان مؤقّتًا unref() تسبقه نهاية العملية فتتراكم الملفات)
  function close() {
    for (const s of [proc.stdio[3], proc.stdio[4], proc.stderr]) { try { s.destroy(); } catch {} }
    return prof.close();
  }
  await send("Browser.getVersion");
  let extId = null;
  if (withExt) extId = (await send("Extensions.loadUnpacked", { path: EXT })).id;
  return { send, on: (f) => { listeners.add(f); return () => listeners.delete(f); }, close, extId };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function evalIn(b, s, expr, timeoutMs = 60000) {
  const r = await b.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, s, timeoutMs);
  if (r.exceptionDetails) throw new Error("تقييم: " + (r.exceptionDetails.text || "") + " " + JSON.stringify(r.exceptionDetails.exception || {}).slice(0, 300));
  return r.result ? r.result.value : undefined;
}
async function until(b, s, expr, ms) {
  const t0 = Date.now(); let v;
  while (Date.now() - t0 < ms) { try { v = await evalIn(b, s, expr, 10000); if (v) return v; } catch {} await wait(200); }
  return v;
}
async function settle(b, s, quietMs = 1200, maxMs = 15000) {
  return evalIn(b, s, `new Promise(function (res) {
    var last = Date.now(), t0 = Date.now();
    var mo = new MutationObserver(function () { last = Date.now(); });
    mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
    (function tick() { if (Date.now() - last >= ${quietMs} || Date.now() - t0 >= ${maxMs}) { mo.disconnect(); res(Date.now() - t0); return; } setTimeout(tick, 100); })();
  })`, maxMs + 5000);
}

// ═══════════════════════ PNG: فكٌّ وترميزٌ أدنى (بلا تبعيات) ═══════════════════════
function decodePNG(buf) {
  let p = 8, w = 0, h = 0, bd = 8, ct = 6, il = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; il = data[12]; }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (bd !== 8 || il) throw new Error("PNG غير مدعوم: عمق " + bd + " تشابك " + il);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct]; if (!ch) throw new Error("نوع لون غير مدعوم " + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = new Uint8Array(w * h * 4), prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[rp++];
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b2 = prev[x], c = x >= ch ? prev[x - ch] : 0, v = raw[rp++];
      let r;
      switch (f) {
        case 0: r = v; break; case 1: r = v + a; break; case 2: r = v + b2; break; case 3: r = v + ((a + b2) >> 1); break;
        case 4: { const pp = a + b2 - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b2), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b2 : c); break; }
        default: r = v;
      }
      cur[x] = r & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, i = x * ch;
      if (ch === 4) { out[o] = cur[i]; out[o + 1] = cur[i + 1]; out[o + 2] = cur[i + 2]; out[o + 3] = cur[i + 3]; }
      else if (ch === 3) { out[o] = cur[i]; out[o + 1] = cur[i + 1]; out[o + 2] = cur[i + 2]; out[o + 3] = 255; }
      else if (ch === 2) { out[o] = out[o + 1] = out[o + 2] = cur[i]; out[o + 3] = cur[i + 1]; }
      else { out[o] = out[o + 1] = out[o + 2] = cur[i]; out[o + 3] = 255; }
    }
    prev.set(cur);
  }
  return { w, h, px: out };
}
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function encodePNG(img) {
  const { w, h, px } = img, raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(px.buffer, px.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, "ascii"), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
function crop(img, x, y, w, h) {
  x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y)); w = Math.max(1, Math.min(img.w - x, Math.round(w))); h = Math.max(1, Math.min(img.h - y, Math.round(h)));
  const px = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) px.set(img.px.subarray(((y + j) * img.w + x) * 4, ((y + j) * img.w + x + w) * 4), j * w * 4);
  return { w, h, px };
}
function gray(img) { const g = new Float32Array(img.w * img.h); for (let i = 0; i < g.length; i++) g[i] = 0.299 * img.px[i * 4] + 0.587 * img.px[i * 4 + 1] + 0.114 * img.px[i * 4 + 2]; return g; }
// فرقٌ متوسط بين صورتين رماديتين بأفضل إزاحةٍ ضمن ±1 (تعويض كسور البكسل)
function mad(a, aw, ah, b, bw, bh, mirrorA) {
  const w = Math.min(aw, bw) - 2, h = Math.min(ah, bh) - 2; if (w < 3 || h < 3) return Infinity;
  let best = Infinity;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    let s = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ax = mirrorA ? aw - 1 - (x + 1) : x + 1, ay = y + 1, bx = x + 1 + dx, by = y + 1 + dy;
      if (bx < 0 || by < 0 || bx >= bw || by >= bh) continue;
      s += Math.abs(a[ay * aw + ax] - b[by * bw + bx]);
    }
    best = Math.min(best, s / (w * h));
  }
  return best;
}
function sideBySide(a, b, gap = 8) {
  const w = a.w + gap + b.w, h = Math.max(a.h, b.h), px = new Uint8Array(w * h * 4).fill(255);
  for (let y = 0; y < a.h; y++) px.set(a.px.subarray(y * a.w * 4, (y + 1) * a.w * 4), (y * w) * 4);
  for (let y = 0; y < b.h; y++) px.set(b.px.subarray(y * b.w * 4, (y + 1) * b.w * 4), (y * w + a.w + gap) * 4);
  for (let y = 0; y < h; y++) for (let x = a.w; x < a.w + gap; x++) { const o = (y * w + x) * 4; px[o] = 230; px[o + 1] = 0; px[o + 2] = 120; px[o + 3] = 255; }
  return { w, h, px };
}
function scaleUp(img, k) {
  if (k <= 1) return img;
  const w = img.w * k, h = img.h * k, px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = ((y / k | 0) * img.w + (x / k | 0)) * 4, o = (y * w + x) * 4; px[o] = img.px[s]; px[o + 1] = img.px[s + 1]; px[o + 2] = img.px[s + 2]; px[o + 3] = 255; }
  return { w, h, px };
}

// ═══════════════════════ الجامع داخل الصفحة ═══════════════════════
// يمشي DOM من body ويسجّل لكل عنصرٍ ظاهر: مفتاح مساره (فهارس الأبناء — يطابق نظيره بين
// التحميلين)، ومستطيله بإحداثيات الصفحة، والاتجاه والمحاذاة والهوامش والحشوات والحدود والإزاحات
// المحسوبة، ولكل «حاوية كتلة» نصَّها ومدى سطرها الأخير (أثر المحاذاة الفعلي لا قيمتها).
function COLLECT(o) {
  var AR = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, LA = /[A-Za-z]/g;
  function cnt(s, re) { var m = s.match(re); return m ? m.length : 0; }
  var de = document.documentElement, body = document.body, se = document.scrollingElement || de;
  var sx = window.scrollX, sy = window.scrollY, vw = de.clientWidth;
  // مسار «هيكل فقط»: يُستثنى محتوى المرجع في التحميلين (المرجع LTR بلا سمة المسار يُحكم بالعنوان)
  var shell = (de.getAttribute("data-cml-route") === "shell" || o.forceShell) && o.shellSel;
  var ISL = "pre, code, kbd, samp, .katex, math, [role='math']" + (shell ? ", " + o.shellSel : "");
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, LINK: 1, META: 1, BR: 1, WBR: 1, SOURCE: 1, TRACK: 1 };
  var INLINE = { inline: 1, contents: 1, "inline list-item": 0 };
  var recs = [], blocks = {}, N = 0, MAX = o.max || 15000, truncated = false;
  function r1(v) { return Math.round(v * 10) / 10; }
  function px(v) { var f = parseFloat(v); return isNaN(f) ? null : r1(f); }
  function clsOf(el) { var c = el.getAttribute("class"); return c ? String(c).replace(/\s+/g, " ").trim().slice(0, 160) : ""; }
  function inl(el) {
    var st = el.getAttribute && el.getAttribute("style"); if (!st) return "";
    var m = st.match(/(?:^|;)\s*(left|right|inset[\w-]*|margin[\w-]*|padding[\w-]*|transform|translate|float|text-align|direction)\s*:/gi);
    return m ? m.map(function (x) { return x.replace(/[;:\s]/g, "").toLowerCase(); }).join(",") : "";
  }
  function nameTokens(el) {
    var t = [], e = el;
    for (var i = 0; i < 4 && e && e !== body; i++, e = e.parentElement) {
      t.push(clsOf(e), e.getAttribute("aria-label") || "", e.getAttribute("data-testid") || "", e.getAttribute("data-icon") || "",
        e.getAttribute("rel") || "", e.getAttribute("title") || "", e.getAttribute("role") || "", e.id || "");
      if (i === 0 && e.querySelector) { var u = e.querySelector("use"); if (u) t.push(u.getAttribute("href") || u.getAttribute("xlink:href") || ""); var ti = e.querySelector("title"); if (ti) t.push(ti.textContent); }
    }
    return t.join(" ").replace(/\s+/g, " ").trim().slice(0, 300);
  }
  function clipState(el, r) {
    // 0: داخل الإطار، 1: يخرج عن عرض الصفحة بلا قاطع، 2: يقطعه سلفٌ ذو overflow
    if (r.left >= -1 && r.right <= vw + 1) return 0;
    for (var a = el.parentElement; a && a !== de; a = a.parentElement) {
      var cs = getComputedStyle(a);
      if (cs.overflowX !== "visible") { var ar = a.getBoundingClientRect(); if (r.left < ar.left - 1 || r.right > ar.right + 1) return 2; return 0; }
    }
    return 1;
  }
  // ★ (ر5-ج، ٢٩ ربيع الآخر ١٤٤٨هـ — ملاحظة المالك ٢(أ)) هندسة الجدول من صندوق قصّه: أقرب سلفٍ يقصّ أو يمرّر أفقيًّا (overflow-x غير
  // visible)، أو الجدول نفسه إن كان كتلةً تمرّر (display:block)، وإلا إطار الصفحة. والمقيس موضع الجدول في «الراحة» (قبل أي تمريرٍ أفقي:
  // الموضع الحالي مضافًا إليه scrollLeft، وهو صفرٌ عند بداية الحاوية في الاتجاهين): so ما خرج منه عن الحافّة اليمنى للصندوق، وeo ما خرج
  // عن اليسرى. ففي حاويةٍ RTL تمرّر لا يُبلغ ما خرج يمينًا أبدًا (أصل التمرير يمينها)، وفي حاويةٍ LTR يختفي حتى يُمرَّر إليه
  function tableBox(el, r) {
    var cs0 = getComputedStyle(el), self = cs0.overflowX !== "visible" && !/table/.test(cs0.display);
    var s = self ? el : null;
    for (var a = el.parentElement; !s && a && a !== de; a = a.parentElement) if (getComputedStyle(a).overflowX !== "visible") s = a;
    var minL = self ? Infinity : r.left, maxR = self ? -Infinity : r.right;
    for (var i = 0; el.rows && i < el.rows.length && i < 400; i++) {
      var q = el.rows[i].getBoundingClientRect(); if (q.width < 1) continue;
      minL = Math.min(minL, q.left); maxR = Math.max(maxR, q.right);
    }
    if (!(maxR > minL)) return null;
    var inL, inR, sl, sDir, sOv, desc;
    if (s && s !== body) {
      var sr = s.getBoundingClientRect(), scs = getComputedStyle(s);
      inL = sr.left + s.clientLeft; inR = inL + s.clientWidth; sl = s.scrollLeft; sDir = scs.direction; sOv = scs.overflowX;
      desc = s.localName + (s.id ? "#" + s.id : "") + (clsOf(s) ? "." + clsOf(s).split(" ").slice(0, 2).join(".") : "");
    } else {
      inL = 0; inR = vw; sl = sx; sDir = getComputedStyle(de).direction; sOv = s ? getComputedStyle(s).overflowX : "viewport"; desc = s ? "body" : "(الصفحة)";
    }
    var head = el.rows && el.rows[0] ? el.rows[0].textContent || "" : "";
    return { s: desc, sDir: sDir, sOv: sOv, vp: s && s !== body ? 0 : 1, self: self ? 1 : 0,
      so: r1(maxR + sl - inR), eo: r1(inL - (minL + sl)), w: r1(maxR - minL), cw: r1(inR - inL), har: cnt(head, AR), hla: cnt(head, LA) };
  }
  // ---- نصوص الكتل: كل عقدة نصٍّ تُنسب إلى أقرب سلفٍ غير سطري (حاوية الفقرة) ----
  function addText(tn, bkey, bel) {
    var s = tn.nodeValue; if (!s || !/\S/.test(s)) return;
    var B = blocks[bkey]; if (!B) return;
    if (B.txt.length < 240) B.txt += (B.txt ? " " : "") + s.replace(/\s+/g, " ").trim();
    B.ar += cnt(s, AR); B.la += cnt(s, LA);
    if (/[\u2192\u27F6\u2794\u279C\u279D\u279E\u21D2]/.test(s)) B.arrowR = 1;
    if (/[\u2190\u27F5\u21D0]/.test(s)) B.arrowL = 1;
    var rg = document.createRange(); rg.selectNodeContents(tn);
    var rs = rg.getClientRects();
    for (var i = 0; i < rs.length; i++) { var q = rs[i]; if (q.width < 0.5) continue; B.lines.push([q.top + sy, q.bottom + sy, q.left + sx, q.right + sx]); }
  }
  function walk(el, key, pkey, bkey, isl, depth) {
    if (N >= MAX) { truncated = true; return; }
    var tag = el.localName;
    if (SKIP[el.nodeName]) return;
    var cs = getComputedStyle(el);
    if (cs.display === "none") return;
    var r = el.getBoundingClientRect();
    // المخفيّ بصريًّا لقارئ الشاشة (‎.sr-only‎: 1×1 مقصوص) ليس سطحًا يُرى — فلا يُحكم على موضعه
    var vis = r.width > 1.5 && r.height > 1.5 && cs.visibility === "visible";
    var island = isl || (el.matches && el.matches(ISL));
    var isBlock = !(cs.display in INLINE) || tag === "svg" || tag === "img";
    var myB = isBlock ? key : bkey;
    var rec = null;
    if (vis || cs.display === "contents") {
      N++;
      rec = { k: key, p: pkey, b: bkey, t: tag, c: clsOf(el), id: el.id || "", x: r1(r.left + sx), y: r1(r.top + sy), w: r1(r.width), h: r1(r.height),
        dir: cs.direction, ta: cs.textAlign, ub: cs.unicodeBidi, disp: cs.display, pos: cs.position, fl: cs.float,
        ml: px(cs.marginLeft), mr: px(cs.marginRight), pl: px(cs.paddingLeft), pr: px(cs.paddingRight),
        bl: px(cs.borderLeftWidth), br: px(cs.borderRightWidth),
        // غير الأفقية: لا يغيّرها التعريب ولا القلب — تغيّرها أثرٌ جانبي لأوراقنا (نسخٌ تُعاد بتخصيصٍ أعلى)
        bt: cs.borderTopStyle === "none" ? 0 : px(cs.borderTopWidth), bb: cs.borderBottomStyle === "none" ? 0 : px(cs.borderBottomWidth),
        mt: px(cs.marginTop), mb: px(cs.marginBottom), pt: px(cs.paddingTop), pb: px(cs.paddingBottom),
        fz: px(cs.fontSize), fw: cs.fontWeight, bg: cs.backgroundColor, vis: cs.visibility, ov: cs.overflowX + "/" + cs.overflowY,
        btc: cs.borderTopColor, bbc: cs.borderBottomColor,
        rad: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(px).join(","),
        L: cs.position === "static" ? null : px(cs.left), R: cs.position === "static" ? null : px(cs.right),
        tf: cs.transform !== "none" ? cs.transform : "", tr: cs.translate !== "none" ? cs.translate : "", sc: cs.scale !== "none" ? cs.scale : "", ro: cs.rotate !== "none" ? cs.rotate : "",
        fd: cs.flexDirection, jc: cs.justifyContent, ovx: cs.overflowX,
        isl: island ? 1 : 0, da: el.getAttribute("dir"), dcm: el.getAttribute("data-cml-dir") ? 1 : 0, nf: el.hasAttribute("data-cml-noflip") ? 1 : 0,
        inl: inl(el), role: el.getAttribute("role") || "", lbl: (el.getAttribute("aria-label") || "").slice(0, 60),
        oob: vis ? clipState(el, r) : 0, blk: isBlock ? 1 : 0 };
      if (tag === "ul" || tag === "ol" || tag === "li") { rec.lst = cs.listStyleType; rec.lsp = cs.listStylePosition; }
      if (tag === "table" && vis && !island) { var tbx = tableBox(el, r); if (tbx) rec.tb = tbx; }
      if (vis && r.width <= 64 && r.height <= 64) rec.nm = nameTokens(el);
      if (tag === "input" || tag === "textarea") { var ph = el.getAttribute("placeholder") || el.value || ""; rec.ph = ph.slice(0, 80); rec.phar = cnt(ph, AR); rec.phla = cnt(ph, LA); }
      if (isBlock) {
        var bl = px(cs.borderLeftWidth) || 0, br = px(cs.borderRightWidth) || 0;
        blocks[key] = { txt: "", ar: 0, la: 0, lines: [], cl: r1(r.left + sx + bl + (px(cs.paddingLeft) || 0)), cr: r1(r.right + sx - br - (px(cs.paddingRight) || 0)) };
      }
      recs.push(rec);
    }
    if (island && depth > 0 && el.matches && el.matches(ISL) && !isl) { /* جذر الجزيرة وحده */ }
    if (island || tag === "svg" || tag === "math") {
      // الجزيرة: يُعدّ نصّها لكتلتها (لتمييز العربي داخل الشيفرة) بلا نزولٍ في عناصرها
      if (island && rec) { var t = el.textContent || ""; rec.iar = cnt(t, AR); rec.itxt = t.replace(/\s+/g, " ").trim().slice(0, 80); }
      return;
    }
    var i = 0;
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1) { walk(c, key + "/" + i, rec ? key : pkey, myB, island, depth + 1); i++; }
      else if (c.nodeType === 3 && (vis || cs.display === "contents")) addText(c, myB, el);
    }
    // حقول الإدخال: العنصر نفسه كتلة نصّه
    if (rec && rec.ph && blocks[key]) { blocks[key].txt = rec.ph; blocks[key].ar = rec.phar; blocks[key].la = rec.phla; }
  }
  // مفتاح المسار يبدأ بفهرس body بين أبناء html (ثابت) ثم فهارس أبناء العناصر
  walk(body, "b", null, null, false, 0);
  // تلخيص سطور الكتل: المدى الكامل والسطر الأخير
  for (var k in blocks) {
    var B = blocks[k]; if (!B.lines.length) { delete blocks[k]; continue; }
    var top = Infinity, bot = -Infinity, l = Infinity, rr = -Infinity;
    var lastBot = -Infinity; B.lines.forEach(function (q) { if (q[1] > lastBot) lastBot = q[1]; });
    var ll = Infinity, lr = -Infinity, nLines = {};
    B.lines.forEach(function (q) {
      top = Math.min(top, q[0]); bot = Math.max(bot, q[1]); l = Math.min(l, q[2]); rr = Math.max(rr, q[3]);
      nLines[Math.round(q[0] / 4)] = 1;
      if (q[1] > lastBot - 4 && q[0] < lastBot) { ll = Math.min(ll, q[2]); lr = Math.max(lr, q[3]); }
    });
    B.tl = r1(l); B.tr = r1(rr); B.ll = r1(ll); B.lr = r1(lr); B.nl = Object.keys(nLines).length; delete B.lines;
  }
  var wrap = document.querySelector("#__next > div[dir]");
  var links = Array.prototype.slice.call(document.querySelectorAll('link[rel~="stylesheet"][href]')).filter(function (l) { return !l.disabled; }).map(function (l) { return l.href; });
  var live = document.getElementById("cml-live-rtl");
  return {
    meta: { url: location.href, title: document.title, vw: vw, vh: window.innerHeight, sw: se.scrollWidth, cw: se.clientWidth, sh: se.scrollHeight,
      htmlDir: de.getAttribute("dir"), lang: de.getAttribute("lang"), cml: de.getAttribute("data-cml"), rtl: de.getAttribute("data-cml-rtl"),
      route: de.getAttribute("data-cml-route"), hold: de.hasAttribute("data-cml-hold") || de.hasAttribute("data-cml-boot"),
      live: !!live, liveBytes: live ? live.textContent.length : 0, wrapDir: wrap ? wrap.getAttribute("dir") : null, sheets: links,
      bodyDir: getComputedStyle(body).direction, recs: N, truncated: truncated,
      challenge: /just a moment|attention required|verify you are human/i.test(document.title + " " + (body.innerText || "").slice(0, 300)) },
    recs: recs, blocks: blocks,
  };
}

// ═══════════════════════ تشغيل صفحة ═══════════════════════
const T = (label, t0) => { if (VERBOSE) console.log(`    ⏱ ${label} ${((Date.now() - t0) / 1000).toFixed(1)}ث`); return Date.now(); };
async function loadPage(b, page, width, isExt) {
  let tt = Date.now(); const who = isExt ? "ext" : "ref";
  const mobile = width < 600, vh = mobile ? 844 : 900;
  const { targetId } = await b.send("Target.createTarget", { url: "about:blank" });
  const { sessionId: s } = await b.send("Target.attachToTarget", { targetId, flatten: true });
  const sheetsById = new Map();
  const netFail = [], cssStatus = [];
  const off = b.on((m) => {
    if (m.sessionId !== s) return;
    if (m.method === "CSS.styleSheetAdded") sheetsById.set(m.params.header.styleSheetId, m.params.header);
    else if (m.method === "Network.loadingFailed" && m.params.type === "Stylesheet") netFail.push(m.params.errorText + (m.params.blockedReason ? "/" + m.params.blockedReason : ""));
    else if (m.method === "Network.responseReceived" && m.params.type === "Stylesheet") cssStatus.push(m.params.response.status);
  });
  try {
    await b.send("Page.enable", {}, s);
    await b.send("Network.enable", {}, s);
    await b.send("Emulation.setDeviceMetricsOverride", { width, height: vh, deviceScaleFactor: 1, mobile }, s);
    await b.send("Emulation.setUserAgentOverride", { userAgent: mobile ? UA_MOB : UA_DESK, acceptLanguage: "en-US,en" }, s);
    if (isExt) { await b.send("DOM.enable", {}, s); await b.send("CSS.enable", {}, s); }
    await b.send("Page.navigate", { url: page.url }, s);
    await until(b, s, "document.readyState === 'complete'", 30000);
    tt = T(who + " تحميل", tt);
    let extState = null, liveWait = null;
    if (isExt) {
      extState = await until(b, s, `(function(){var h=document.documentElement;return h.getAttribute('data-cml')==='on'&&!h.hasAttribute('data-cml-hold')&&!h.hasAttribute('data-cml-boot')?'on':'';})()`, 15000);
      // ورقة الاتجاه الحيّة (meta.live): العامل يجلب أوراق الموقع ويقلبها — ننتظرها ليُفحص ما يراه المستخدم
      // (قِيس على claude.ai: أوراقٌ ١٫٥ م.ب ⇒ الورقة الحيّة بعد ~٢٠–٣٠ ث من التحميل في الزيارة الأولى، ثم من الذاكرة)
      if (DMETA[page.d] && DMETA[page.d].meta && DMETA[page.d].meta.live) {
        liveWait = Date.now();
        const ok = await until(b, s, "document.documentElement.getAttribute('data-cml-rtl')==='live'", +opt("live-wait", "60") * 1000);
        liveWait = ok ? Date.now() - liveWait : -1;
      }
    }
    await settle(b, s, 1200, 15000);
    tt = T(who + " هدوء", tt);
    // الأوراق كلها محمَّلة ومطبَّقة (Next.js يضيف بعضها بعد الترطيب، والتحميل لا يطفر DOM فلا يراه settle)
    let sheetsOk = await until(b, s, `(function(){var l=[].slice.call(document.querySelectorAll('link[rel~="stylesheet"][href]')).filter(function(x){return !x.disabled&&!/print/.test(x.media||'');});
      return l.length>0&&l.every(function(x){return !!x.sheet;})&&document.fonts.status==='loaded';})()`, 20000);
    if (!sheetsOk) {
      // ورقةٌ لم تُطبَّق (قِيس: يقع أحيانًا في كروم بلا واجهة مع تحميلين متوازيين) ⇒ إعادة تحميلٍ واحدة
      await b.send("Page.reload", { ignoreCache: true }, s);
      await wait(800);
      await until(b, s, "document.readyState === 'complete'", 30000);
      if (isExt) await until(b, s, `(function(){var h=document.documentElement;return h.getAttribute('data-cml')==='on'&&!h.hasAttribute('data-cml-hold');})()`, 15000);
      await settle(b, s, 1200, 15000);
      sheetsOk = await until(b, s, `[].slice.call(document.querySelectorAll('link[rel~="stylesheet"][href]')).every(function(x){return x.disabled||!!x.sheet;})`, 20000);
    }
    // الإطار بطول الصفحة كلها: هندسةٌ واحدة للجامع واللقطة (لا تمرير، ولا تغيّر عند التصوير)
    const docH = await evalIn(b, s, "Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)");
    const H = Math.max(vh, Math.min(docH || vh, MAX_H));
    await b.send("Emulation.setDeviceMetricsOverride", { width, height: H, deviceScaleFactor: 1, mobile }, s);
    await wait(700); await settle(b, s, 700, 6000);
    const shellSel = (DMETA[page.d] && DMETA[page.d].meta && DMETA[page.d].meta.shellSel) || "";
    tt = T(who + " أوراق+إطار", tt);
    const routes = (DMETA[page.d] && DMETA[page.d].meta && DMETA[page.d].meta.routes) || null;
    // حارس المسار نفسه (SHARED.routeMode) لا مقارنة بادئةٍ خام: البادئة بشرطتها الختامية تُضاف للمسار قبل المقارنة (مراجعة المحرّك ٤)
    const forceShell = !!routes && SHARED.routeMode(routes, new URL(page.url).pathname) === "shell";
    const snap = await evalIn(b, s, "(" + COLLECT.toString() + ")(" + JSON.stringify({ shellSel, forceShell, max: 15000 }) + ")", 120000);
    tt = T(who + " جمع", tt);
    snap.meta.docH = docH; snap.meta.H = H; snap.meta.extState = extState; snap.meta.liveWaitMs = liveWait; snap.meta.sheetsOk = !!sheetsOk;
    snap.meta.cssNet = { status: cssStatus.slice(0, 20), failed: netFail.slice(0, 10) };
    snap.meta.bodyMargin = await evalIn(b, s, "getComputedStyle(document.body).marginLeft");
    let img = null;
    try {
      const shot = await b.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, s, 120000);
      const raw = Buffer.from(shot.data, "base64");
      img = decodePNG(raw);
      if (flag("raw-shots")) { fs.mkdirSync(path.join(OUT, "raw"), { recursive: true }); fs.writeFileSync(path.join(OUT, "raw", `${page.d}-${page.tag}-${width}-${isExt ? "rtl" : "ltr"}.png`), raw); }
    } catch (e) { if (VERBOSE) console.log("  ! لقطة: " + e.message); }
    tt = T(who + " لقطة", tt);
    return { s, targetId, snap, img, sheetsById, off, H, d: page.d };
  } catch (e) { off(); try { await b.send("Target.closeTarget", { targetId }); } catch {} throw e; }
}
async function closePage(b, run) { if (!run) return; try { run.off(); } catch {} try { await b.send("Target.closeTarget", { targetId: run.targetId }); } catch {} }

// ═══════════════════════ المقارنة ═══════════════════════
const sgn = (v, tol) => (v > tol ? 1 : v < -tol ? -1 : 0);
const clsSig = (c) => (c || "").split(" ").filter((t) => t && !/^(active|open|selected|hover|focus|is-|data-state|hidden|visible)/i.test(t)).sort().join(" ");
function jacc(a, b) { const A = new Set(a.split(" ").filter(Boolean)), B = new Set(b.split(" ").filter(Boolean)); if (!A.size && !B.size) return 1; let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i); }
function samePair(a, b) { return a && b && a.t === b.t && (a.c === b.c || jacc(clsSig(a.c), clsSig(b.c)) >= 0.6); }
function shortSel(r) {
  const cls = (r.c || "").split(" ").filter(Boolean).filter((x) => !/^(?:[a-z]{1,3}:|\[|__)/.test(x)).slice(0, 3);
  return r.t + (r.id ? "#" + r.id : "") + (cls.length ? "." + cls.join(".") : "");
}
function sigOf(r) { return r.t + "|" + clsSig(r.c).split(" ").filter((x) => !/\d{3,}/.test(x)).slice(0, 6).join(" "); }
const LANDMARK = /(^|[\s_-])(nav|sidebar|side-bar|toc|table-of-contents|DocsToc|DocsShell_toc|breadcrumb|header|footer|menu|aside|drawer)/i;
const DIRECTIONAL = /chevron|arrow|caret|angle-(?:left|right)|\bnext\b|\bprev(?:ious)?\b|\bback\b|\bforward\b|breadcrumb|pagination|carousel/i;
const NOT_DIRECTIONAL = /down|up\b|external|open-in-new|arrow-up-right|up-right|sort|expand-more|expand-less|download|upload|link-out/i;

// ---- مطابقة الشجرتين: كل عنصرٍ في المعرَّب بنظيره في الأصل ----
// مفتاح المسار وحده هشّ: عنصرٌ واحدٌ زائدٌ في أعلى الصفحة (شريطُ إعلانٍ، أو مُعلِن المسار في Next.js) يزيح
// فهارس كل ما بعده. فالمطابقة محاذاةٌ متدرّجة: أبناء كل زوجٍ متطابق يُحاذَون بأطول تتابعٍ مشترك (LCS)
// على (الوسم + الأصناف الثابتة)، ثم يُنزَل في كل زوج.
function pairTrees(Rs, Es) {
  const kidsOf = (recs) => { const m = new Map(); for (const r of recs) { const k = r.p || "#"; if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
  const RK = kidsOf(Rs.recs), EK = kidsOf(Es.recs);
  const pair = new Map();
  const eq = (a, b) => a.t === b.t && (a.c === b.c || jacc(clsSig(a.c), clsSig(b.c)) >= 0.6) && (a.id === b.id || !a.id || !b.id || /\d{3,}|_R_|:r/.test(a.id + b.id));
  const rRoot = Rs.recs.find((r) => r.k === "b"), eRoot = Es.recs.find((r) => r.k === "b");
  if (!rRoot || !eRoot) return pair;
  const stack = [[rRoot, eRoot]];
  while (stack.length) {
    const [r, e] = stack.pop();
    pair.set(e.k, r);
    const A = RK.get(r.k) || [], B = EK.get(e.k) || [];
    if (!A.length || !B.length) continue;
    if (A.length === B.length && A.every((x, i) => eq(x, B[i]))) { for (let i = 0; i < A.length; i++) stack.push([A[i], B[i]]); continue; }
    const n = A.length, m = B.length;
    if (n * m > 9e6) { for (let i = 0; i < Math.min(n, m); i++) if (eq(A[i], B[i])) stack.push([A[i], B[i]]); continue; }
    const W = m + 1, dp = new Uint16Array((n + 1) * W);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      dp[i * W + j] = eq(A[i], B[j]) ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (eq(A[i], B[j]) && dp[i * W + j] === dp[(i + 1) * W + j + 1] + 1) { stack.push([A[i], B[j]]); i++; j++; }
      else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) i++; else j++;
    }
  }
  return pair;
}

function compare(page, width, Rs, Es, PR) {
  const F = [];
  const RE = new Map(Rs.recs.map((r) => [r.k, r])), EE = new Map(Es.recs.map((r) => [r.k, r]));
  PR = PR || pairTrees(Rs, Es);
  const vw = Es.meta.cw;
  const add = (f) => { F.push(Object.assign({ d: page.d, page: page.tag, url: page.url, width }, f)); };
  const container = (map, r) => { let p = r.p ? map.get(r.p) : null; while (p && !(p.w > r.w + 4) ) p = p.p ? map.get(p.p) : null; return p; };
  const inIslandLtr = (r) => r.isl || r.nf;
  const hasRtlCtx = (r, map) => r.dir === "rtl";
  // ---- ١) نصٌّ عربيٌّ في كتلةٍ محسوبة LTR ----
  for (const [k, B] of Object.entries(Es.blocks)) {
    const r = EE.get(k); if (!r) continue;
    if (B.ar < 2 || B.ar < B.la * 0.6) continue;           // الكتلة عربية الغالب
    if (r.dir === "ltr") {
      // كلمةٌ عربيةٌ مفردة بلا محايدات لا يختلّ ترتيبها في سياق LTR — يبقى أثرُها في الموضع والمحاذاة وحدهما
      const single = /^[؀-ۿݐ-ݿ]+$/.test(B.txt.replace(/[⁦-⁩‎‏]/g, "").trim());
      add({ check: "text-ltr", key: k, el: r, text: B.txt.slice(0, 90), isl: r.isl, sev: r.isl ? "low" : single ? "low" : "high",
        detail: `كتلةٌ عربية (${B.ar} حرفًا عربيًّا/${B.la} لاتينيًّا) محسوبة direction:ltr — ترتيب علامات الترقيم والكلمات اللاتينية يختلّ` });
    } else if (r.ub === "plaintext") {
      const first = (B.txt.match(/[A-Za-z\u0600-\u06FF]/) || [""])[0];
      if (/[A-Za-z]/.test(first)) add({ check: "text-ltr", key: k, el: r, text: B.txt.slice(0, 90), sev: "medium",
        detail: "unicode-bidi:plaintext وأول حرفٍ قويٍّ لاتيني ⇒ الفقرة العربية تُعرض LTR" });
    }
    // سهمٌ نصّي «→» في نصٍّ عربي RTL يشير إلى الوراء
    if (B.arrowR && r.dir === "rtl") add({ check: "arrow-glyph", key: k, el: r, text: B.txt.slice(0, 90), sev: "medium",
      detail: "المحرف → (غير معكوس في خوارزمية الاتجاه) داخل نصٍّ عربي RTL يشير إلى الخلف — يُستبدل بـ← في القاموس" });
  }
  // عنصرٌ سطريٌّ LTR داخل كتلة RTL يحمل نصًّا عربيًّا (عزلٌ مقلوب)
  for (const r of Es.recs) {
    if (r.blk || r.dir !== "ltr" || r.isl) continue;
    const B = r.b && Es.blocks[r.b]; const pb = r.b && EE.get(r.b);
    if (!pb || pb.dir !== "rtl") continue;
    // النص الخاص بالعنصر السطري غير محفوظ منفصلًا؛ نكتفي بسمة dir الصريحة على السطري
    if (r.da === "ltr" && B && B.ar > 2) add({ check: "text-ltr", key: r.k, el: r, text: (B.txt || "").slice(0, 90), sev: "medium",
      detail: "عنصرٌ سطري dir=ltr داخل فقرة RTL عربية" });
  }
  // حقول الإدخال: عنصرٌ نائبُه عربي ومحسوبٌ LTR أو محاذاته يسار
  for (const r of Es.recs) {
    if (!r.ph || !(r.phar > 1) || r.isl) continue;
    if (r.dir === "ltr") add({ check: "text-ltr", key: r.k, el: r, text: r.ph, sev: "high", detail: "حقل إدخال بنصٍّ نائبٍ عربي ومحسوبٌ direction:ltr" });
    else if (/left/.test(r.ta)) add({ check: "align", key: r.k, el: r, text: r.ph, sev: "medium", detail: `حقل إدخال عربي بمحاذاة ${r.ta}` });
  }
  // ---- ٢) المحاذاة الفعلية (السطر الأخير) لكتلةٍ عربية ----
  for (const [k, B] of Object.entries(Es.blocks)) {
    const r = EE.get(k); if (!r || r.dir !== "rtl" || r.isl) continue;
    if (B.ar < 2 || B.ar < B.la * 0.6) continue;
    // المحاذاة يحكمها text-align في حاويات الكتل وحدها؛ في flex/grid يحكم التخطيطُ (يغطيه فحص الانعكاس)
    if (!/^(block|list-item|table-cell|inline-block|flow-root|table-caption)$/.test(r.disp)) continue;
    const gapL = B.ll - B.cl, gapR = B.cr - B.lr, width = B.cr - B.cl;
    if (!(width > 40)) continue;
    if (gapL + gapR < 24) continue;                             // السطر ممتلئ تقريبًا: لا أثر ظاهر
    const eSide = sgn(gapR - gapL, Math.max(8, width * 0.04)); // +1: يلاصق اليسار
    if (eSide <= 0) continue;
    const rr = PR.get(k), RB = rr && Rs.blocks[rr.k];
    let rSide = null;
    if (rr && RB && samePair(rr, r)) rSide = sgn((RB.cr - RB.lr) - (RB.ll - RB.cl), Math.max(8, (RB.cr - RB.cl) * 0.04));
    if (rSide === 0) continue;                                   // كان في الوسط في الأصل: لا توقّع
    if (/center|justify/.test(r.ta) && rSide === null) continue;
    add({ check: "align", key: k, el: r, text: B.txt.slice(0, 90), sev: r.t === "td" || r.t === "th" ? "medium" : "medium",
      detail: `كتلةٌ عربية RTL سطرُها الأخير ملاصقٌ لليسار (فراغ يسار ${Math.round(gapL)}px، يمين ${Math.round(gapR)}px؛ text-align:${r.ta})` });
  }
  // ---- ٣) الانعكاس الهندسي: جانب العنصر من حاويته يجب أن ينقلب ----
  for (const e of Es.recs) {
    if (!(e.w >= 4 && e.h >= 4) || inIslandLtr(e) || e.disp === "inline") continue;   // السطري يحكمه text-align (فحص المحاذاة)
    const r = PR.get(e.k); if (!samePair(r, e)) continue;
    const ce = container(EE, e), cr = container(RE, r);
    if (!ce || !cr || PR.get(ce.k) !== cr) continue;
    if (ce.dir !== "rtl" || ce.isl || cr.dir !== "ltr") continue;
    // جزيرة LTR صريحة (المحرّك يضع dir بحسب النص — بند فهرسٍ إنجليزي مثلًا): لا يُتوقَّع انعكاسها
    if (e.dir === "ltr") continue;
    { let a = e.p ? EE.get(e.p) : null, ltrUp = false; while (a && a !== ce) { if (a.dir === "ltr") { ltrUp = true; break; } a = a.p ? EE.get(a.p) : null; } if (ltrUp) continue; }
    if (Math.abs(ce.w - cr.w) > Math.max(40, cr.w * 0.25)) continue; // الحاوية تغيّرت كثيرًا: لا حكم
    // الحكم بحافّتَي البداية والنهاية لا بالمركز: عنصرٌ اتّسع بعد الترجمة (نصٌّ التفّ سطرين) يبدو
    // «ملاصقًا» للجهة الأخرى وهو منعكسٌ تمامًا — فالانعكاس أن تصير إزاحةُ يساره الأصلية إزاحةَ يمينه
    const dlR = r.x - cr.x, drR = cr.x + cr.w - (r.x + r.w), dlE = e.x - ce.x, drE = ce.x + ce.w - (e.x + e.w);
    const tol = Math.max(4, cr.w * 0.03);
    if (Math.abs(dlR - drR) <= Math.max(6, cr.w * 0.05)) continue;          // متوسّطٌ أو ممتلئ في الأصل
    const mirroredEdge = Math.abs(drE - dlR) <= tol || Math.abs(dlE - drR) <= tol;
    const sameEdge = Math.abs(dlE - dlR) <= tol || Math.abs(drE - drR) <= tol;
    if (mirroredEdge || !sameEdge) continue;
    const rs = dlR < drR ? 1 : -1;
    // نصٌّ سطري داخل سطرٍ يسار—والكتلة عربية: يغطيه فحص المحاذاة
    const land = LANDMARK.test(e.c + " " + e.t + " " + e.role) || e.t === "nav" || e.t === "aside";
    const big = e.w >= 160 || land;
    add({ check: "not-mirrored", key: e.k, el: e, container: shortSel(ce), sev: big ? "high" : e.w >= 12 ? "medium" : "low",
      detail: `العنصر يلاصق ${rs > 0 ? "اليسار" : "اليمين"} من حاويته في الأصل وبقي كذلك بعد القلب (حاوية RTL)` +
        (e.pos !== "static" ? ` — position:${e.pos} left:${e.L} right:${e.R}` : "") + (e.fl !== "none" ? ` float:${e.fl}` : "") +
        (e.inl ? ` [نمط سطري: ${e.inl}]` : "") });
  }
  // ---- ٤) الخصائص الفيزيائية غير المنعكسة (السبب): هامش/حشوة/حدّ/إزاحة/طفو ----
  const FAM = [["margin", "ml", "mr"], ["padding", "pl", "pr"], ["border", "bl", "br"], ["inset", "L", "R"]];
  for (const e of Es.recs) {
    if (inIslandLtr(e)) continue;
    const r = PR.get(e.k); if (!samePair(r, e) || r.dir !== "ltr") continue;
    // ★ (فحص الاتجاه لوثائق Claude Code ٩، ١٦ ربيع الآخر ١٤٤٨هـ) الحكم باتجاه العنصر نفسه لا باتجاه الصفحة: عنصرٌ بقي LTR
    // (نصٌّ إنجليزي في صفحةٍ RTL، باتجاهٍ لكل كتلة) حشوتُه وهامشه على جهتهما الأصلية — فانعكاسُهما عيب. كانت هذه العناصر
    // تُتخطّى كلها (e.dir !== "rtl") فمرّ فهرسٌ قلبت قاعدةٌ نقطيةٌ حشوة بنوده الإنجليزية إلى اليمين (143 بندًا بلا تداخل)
    if (e.dir === "ltr") {
      for (const [fam, a, b2] of FAM.slice(0, 2)) {
        const ra = r[a], rb = r[b2], ea = e[a], eb = e[b2];
        if ([ra, rb, ea, eb].some((v) => v === null || v === undefined)) continue;
        const d0 = ra - rb, d1 = ea - eb, tol = 2.9;
        if (Math.abs(d0) < tol || sgn(d1, tol) !== -sgn(d0, tol)) continue;   // على جهته (أو متناظر): سليم
        const mag = Math.abs(d0);
        add({ check: "box-mirrored-ltr", key: e.k, el: e, prop: fam, sev: mag >= 8 ? "medium" : "low",
          detail: `عنصرٌ اتجاهه LTR (نصٌّ إنجليزي) انعكس ${fam}: الأصل ${a}=${ra} ${b2}=${rb} ⇒ ${a}=${ea} ${b2}=${eb} — ما بقي LTR يبقى على جهته` });
      }
      continue;
    }
    if (e.dir !== "rtl") continue;
    for (const [fam, a, b2] of FAM) {
      if (fam === "inset" && (e.pos === "static" || r.pos === "static")) continue;
      const ra = r[a], rb = r[b2], ea = e[a], eb = e[b2];
      if ([ra, rb, ea, eb].some((v) => v === null || v === undefined)) continue;
      if (fam === "inset" && (e.pos === "relative" || e.pos === "sticky") && ra === 0 && rb === 0) continue;
      const d0 = ra - rb, d1 = ea - eb;
      const tol = fam === "border" ? 0.9 : 2.9;
      if (Math.abs(d0) < tol) continue;
      if (fam === "margin" && e.disp.startsWith("inline") && !e.disp.includes("block") && !e.disp.includes("flex") && !e.disp.includes("grid")) { /* هوامش السطري تُعدّ أيضًا */ }
      if (sgn(d1, tol) !== sgn(d0, tol)) continue;                 // انقلب (أو صار متناظرًا)
      const re = new RegExp("(^|,)" + (fam === "inset" ? "(left|right|inset)" : fam) + "");
      if (e.inl && re.test(e.inl)) { add({ check: "box-not-mirrored", key: e.k, el: e, prop: fam, sev: "low", computed: true,
        detail: `${fam}: ${a}=${ea} ${b2}=${eb} (الأصل ${ra}/${rb}) من نمطٍ سطري يحسبه جافاسكربت الموقع` }); continue; }
      const mag = Math.abs(d0);
      add({ check: "box-not-mirrored", key: e.k, el: e, prop: fam, sev: fam === "inset" ? (mag >= 24 ? "high" : "medium") : mag >= 8 ? "medium" : "low",
        detail: `${fam}: الأصل ${a}=${ra} ${b2}=${rb} ⇒ بعد القلب ${a}=${ea} ${b2}=${eb} (لم ينعكس)` });
    }
    if (r.fl && r.fl !== "none" && !/inline-(start|end)/.test(r.fl) && e.fl === r.fl) add({ check: "box-not-mirrored", key: e.k, el: e, prop: "float", sev: "medium", detail: `float:${e.fl} لم ينقلب` });
  }
  // ---- ٤ب) الأثر الجانبي: خصائص غير أفقية تغيّرت (حدود علوية/سفلية، هوامش رأسية، حجم الخط، العرض، الخلفية) ----
  const COL = [["bt", "border-top-width", 0.9], ["bb", "border-bottom-width", 0.9], ["mt", "margin-top", 1.5], ["mb", "margin-bottom", 1.5],
    ["pt", "padding-top", 1.5], ["pb", "padding-bottom", 1.5], ["fz", "font-size", 0.6]];
  for (const e of Es.recs) {
    if (inIslandLtr(e)) continue;
    const r = PR.get(e.k); if (!samePair(r, e)) continue;
    const diffs = [];
    for (const [f, name, tol] of COL) { if (r[f] === null || e[f] === null || r[f] === undefined) continue; if (Math.abs(r[f] - e[f]) > tol) diffs.push(`${name}: ${r[f]}→${e[f]}`); }
    if (r.disp !== e.disp && !(r.disp === "none" || e.disp === "none")) diffs.push(`display: ${r.disp}→${e.disp}`);
    if (r.bg !== e.bg) diffs.push(`background-color: ${r.bg}→${e.bg}`);
    if (r.bt > 0 && e.bt > 0 && r.btc !== e.btc) diffs.push(`border-top-color: ${r.btc}→${e.btc}`);
    if (r.bb > 0 && e.bb > 0 && r.bbc !== e.bbc) diffs.push(`border-bottom-color: ${r.bbc}→${e.bbc}`);
    if (r.fw !== e.fw) diffs.push(`font-weight: ${r.fw}→${e.fw}`);
    if (r.pos !== e.pos) diffs.push(`position: ${r.pos}→${e.pos}`);
    if (r.ov !== e.ov) diffs.push(`overflow: ${r.ov}→${e.ov}`);
    // زوايا الإطار: المتوقَّع تبادل اليسار واليمين
    if (e.dir !== "rtl" || r.dir !== "ltr") { /* جزيرة LTR أو عنصرٌ لم ينقلب اتجاهه: لا توقّع لتبادل الزوايا */ }
    else if (r.rad && e.rad && r.rad !== e.rad) {
      const [a, b2, c, d2] = r.rad.split(","), mir = [b2, a, d2, c].join(",");
      if (e.rad !== mir) diffs.push(`border-radius: ${r.rad}→${e.rad} (المتوقَّع ${mir})`);
    } else if (r.rad && e.rad && r.rad === e.rad) {
      const [a, b2, c, d2] = r.rad.split(",").map(Number);
      if (Math.abs(a - b2) > 0.9 || Math.abs(c - d2) > 0.9) diffs.push(`border-radius غير منعكس: ${r.rad}`);
    }
    if (!diffs.length) continue;
    const props = diffs.map((x) => x.split(":")[0].replace(/ .*/, "")).join(",");
    const visible = diffs.some((x) => /border-(top|bottom)-(width|color)|background|display|position|overflow|font-size|radius/.test(x));
    add({ check: "collateral", key: e.k, el: e, prop: props, sev: visible ? "high" : "medium", diffs,
      detail: "خاصيةٌ لا علاقة لها بالاتجاه تغيّرت بعد تفعيل الإضافة: " + diffs.join("؛ ") });
  }
  // ---- ٥) القوائم: حشوة العلامة في الجهة الخطأ ----
  for (const e of Es.recs) {
    if ((e.t !== "ul" && e.t !== "ol") || e.isl || e.dir !== "rtl" || !e.lst || e.lst === "none") continue;
    if ((e.pr || 0) < 8 && (e.pl || 0) >= 8) add({ check: "list-marker", key: e.k, el: e, prop: "padding", sev: "medium",
      detail: `قائمة RTL بعلامات (${e.lst}) وحشوتها يسارية (padding-left:${e.pl} padding-right:${e.pr}) ⇒ العلامة تخرج يمينًا أو تلاصق النص` });
  }
  // ---- ٦) الجداول: أول خلية يجب أن تكون يمينًا في RTL ----
  for (const e of Es.recs) {
    if (e.t !== "tr" || e.dir !== "rtl" || e.isl) continue;
    const cells = Es.recs.filter((c) => c.p === e.k && (c.t === "td" || c.t === "th"));
    if (cells.length < 2) continue;
    if (cells[0].x < cells[cells.length - 1].x) add({ check: "table-order", key: e.k, el: e, sev: "high", detail: "صفٌّ RTL أولُ خلاياه يسارًا" });
  }
  // ---- ٦ب) ★ (ر5-ج، ٢٩ ربيع الآخر ١٤٤٨هـ — ملاحظة المالك ٢(أ)) كل جدول RTL في صندوق قصّه (tableBox في الجامع): الجدول الأعرض من
  // حاويته يمرّر فيها، ويبدأ عند حافّتها اليمنى، ويفيض نحو اليسار، ولا يضيع منه شيء. فيُعلَّم:
  //   عالٍ  table-clip/start-clip   — بدايته (اليمين) خارج الحافّة اليمنى في الراحة ولا تُبلغ (حاويةٌ RTL تمرّر، أو قاصّة، أو الصفحة RTL):
  //                                    خلية العمود الأول تفقد أوائل كلماتها («ء المهام…» في جدول Cowork)
  //   عالٍ  table-clip/start-hidden — بدايته مخفيّةٌ في الراحة لأن أصل التمرير يسار (حاويةٌ LTR تمرّر): تُبلغ بالتمرير، ويُرى آخرُ الجدول أولًا
  //   متوسط table-clip/end-clip     — نهايته (اليسار) خارج الحافّة اليسرى ولا تُبلغ (حاويةٌ قاصّة، أو LTR تمرّر)
  //   متوسط table-scroll            — الجدول نفسه يُخرج الصفحة إلى تمريرٍ أفقي (لا حاوية تمرّره)
  //   عالٍ  table-dir               — جدولٌ رؤوسه عربية محسوبٌ LTR في صفحةٍ RTL: أعمدته بترتيب اليسار وبدايته يسارًا (dir=auto على غلافه
  //                                    حسمه أولُ لاتينيٍّ في خلاياه — جدول ملفات تعريف الارتباط الأول في الخصوصية)
  // وما كان في الأصل LTR على مثاله (البداية يسارًا هناك) فمن الموقع نفسه: منخفضٌ موسومٌ preExisting
  for (const e of Es.recs) {
    if (e.t === "table" && e.tb && !e.isl && e.dir === "ltr" && Es.meta.htmlDir === "rtl" && e.tb.har >= 2 && e.tb.har > e.tb.hla)
      add({ check: "table-dir", key: e.k, el: e, sev: "high", tb: e.tb,
        detail: `جدولٌ رؤوسُه عربية (${e.tb.har} حرفًا عربيًّا/${e.tb.hla} لاتينيًّا) محسوبٌ direction:ltr في صفحةٍ RTL — عموده الأول يسارًا` });
    if (e.t !== "table" || !e.tb || e.isl || e.dir !== "rtl") continue;
    const tb = e.tb, r = PR.get(e.k), rtb = samePair(r, e) && r.tb ? r.tb : null, TOL = 2;
    const scrolls = /auto|scroll/.test(tb.sOv) || tb.vp;
    const box = `الحاوية ${tb.s} (overflow-x:${tb.sOv}، direction:${tb.sDir}${tb.self ? "، الجدول نفسه يمرّر" : ""})`;
    if (tb.so > TOL) {
      const hidden = scrolls && tb.sDir === "ltr";
      const pre = !!rtb && rtb.eo > TOL;
      add({ check: "table-clip", prop: hidden ? "start-hidden" : "start-clip", key: e.k, el: e, sev: pre ? "low" : "high", preExisting: pre, tb,
        detail: `جدولٌ RTL بدايتُه (يمينه) خارج الحافّة اليمنى لصندوق قصّه بـ${Math.round(tb.so)}px في الراحة — ` +
          (hidden ? "مخفيّةٌ حتى يُمرَّر إليها (أصل التمرير يسار)" : "لا تُبلغ بالتمرير") + ` — عرض الجدول ${tb.w}px والصندوق ${tb.cw}px — ${box}` +
          (pre ? ` (وفي الأصل LTR بدايته خارج اليسار بـ${Math.round(rtb.eo)}px)` : "") });
    }
    if (tb.eo > TOL && (!scrolls || (tb.sDir === "ltr" && !tb.vp))) {
      const pre = !!rtb && rtb.so > TOL;
      add({ check: "table-clip", prop: "end-clip", key: e.k, el: e, sev: pre ? "low" : "medium", preExisting: pre, tb,
        detail: `جدولٌ RTL نهايتُه (يساره) خارج الحافّة اليسرى بـ${Math.round(tb.eo)}px ولا تُبلغ — ${box}` + (pre ? " (وفي الأصل LTR نهايته خارج اليمين)" : "") });
    }
    if (tb.vp && tb.eo > TOL && Es.meta.sw > Es.meta.cw + 1) {
      const pre = !!rtb && rtb.vp && (rtb.so > TOL || rtb.eo > TOL) && Rs.meta.sw > Rs.meta.cw + 1;
      add({ check: "table-scroll", key: e.k, el: e, sev: pre ? "low" : "medium", preExisting: pre, tb,
        detail: `جدولٌ بلا حاويةٍ تمرّره يُخرج الصفحة إلى تمريرٍ أفقي: يتجاوز يسارها بـ${Math.round(tb.eo)}px (scrollWidth=${Es.meta.sw} > ${Es.meta.cw})` +
          (pre ? " (والأصل LTR يمرّر بالجدول نفسه)" : "") });
    }
  }
  // ---- ٧) التمرير الأفقي والعناصر الخارجة عن الشاشة ----
  if (Es.meta.sw > Es.meta.cw + 1) {
    const pre = Rs.meta.sw > Rs.meta.cw + 1;
    const culprits = Es.recs.filter((r) => r.oob === 1 && !(r.p && EE.get(r.p) && EE.get(r.p).oob === 1)).slice(0, 6);
    add({ check: "h-overflow", key: culprits[0] ? culprits[0].k : "b", el: culprits[0] || Es.recs[0], sev: pre ? "low" : "high", preExisting: pre,
      detail: `تمريرٌ أفقي: scrollWidth=${Es.meta.sw} > clientWidth=${Es.meta.cw}` + (pre ? ` (موجودٌ في الأصل LTR أيضًا: ${Rs.meta.sw})` : "") +
        (culprits.length ? " — المتسبّب: " + culprits.map((c) => `${shortSel(c)} [x=${c.x}, w=${c.w}]`).join("، ") : "") });
  }
  for (const e of Es.recs) {
    if (!e.oob || (e.pos !== "absolute" && e.pos !== "fixed") || e.isl) continue;
    const r = PR.get(e.k); if (!samePair(r, e) || r.oob) continue;
    add({ check: "offscreen", key: e.k, el: e, sev: e.w >= 40 ? "high" : "medium",
      detail: `عنصرٌ ${e.pos} داخل الشاشة في الأصل وخارجها بعد القلب (${e.oob === 2 ? "مقصوصٌ بسلفٍ ذي overflow" : "خارج عرض الصفحة"}) left:${e.L} right:${e.R} x=${e.x}` });
  }
  // ---- ٨) التراكب: أخوان تراكبا بعد القلب ولم يتراكبا قبله ----
  const kids = new Map();
  // السطريات تُستثنى: مستطيلُ عنصرٍ سطريٍّ ملتفٍّ على سطرين يحيط بالسطرين فيبدو «متراكبًا» مع جاره
  for (const e of Es.recs) { if (!e.p || e.w < 4 || e.h < 4 || e.disp === "inline" || e.isl) continue; if (!kids.has(e.p)) kids.set(e.p, []); kids.get(e.p).push(e); }
  const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  for (const [pk, list] of kids) {
    if (list.length < 2 || list.length > 40) continue;
    const pe = EE.get(pk); if (pe && pe.isl) continue;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const small = Math.min(a.w * a.h, b.w * b.h); if (small < 64) continue;
      const oe = inter(a, b) / small; if (oe < 0.3) continue;
      const ra = PR.get(a.k), rb = PR.get(b.k); if (!samePair(ra, a) || !samePair(rb, b)) continue;
      const small0 = Math.min(ra.w * ra.h, rb.w * rb.h) || 1;
      if (inter(ra, rb) / small0 > 0.05) continue;
      add({ check: "overlap", key: a.k, el: a, other: shortSel(b), sev: "high",
        detail: `تراكبٌ بعد القلب (${Math.round(oe * 100)}% من الأصغر) بين ${shortSel(a)} و${shortSel(b)} — لم يتراكبا في الأصل` });
    }
  }
  // ---- ٩) مسار التنقّل (breadcrumbs): الأول يمينًا ----
  for (const e of Es.recs) {
    if (!/breadcrumb/i.test(e.c + " " + e.lbl) || e.dir !== "rtl") continue;
    const links = Es.recs.filter((c) => c.t === "a" && c.k.startsWith(e.k + "/"));
    if (links.length >= 2 && links[0].x < links[links.length - 1].x) add({ check: "breadcrumb-order", key: e.k, el: e, sev: "high", detail: "أول عناصر مسار التنقّل يسارًا في صفحة RTL" });
  }
  return F;
}

// ---- ١٠) الأيقونات الاتجاهية: انعكاس البكسلات ----
function iconChecks(page, width, Rs, Es, Rimg, Eimg, stats, PR) {
  const F = [];
  stats = stats || {};
  if (!Rimg || !Eimg) return F;
  PR = PR || pairTrees(Rs, Es);
  let n = 0;
  for (const e of Es.recs) {
    if (!e.nm || e.isl || e.w < 6 || e.h < 6 || e.w > 48 || e.h > 48) continue;
    if (!/^(svg|img|i|span)$/.test(e.t)) continue;
    if (e.t === "span" && !/icon/i.test(e.c)) continue;
    const r = PR.get(e.k); if (!samePair(r, e) || Math.abs(r.w - e.w) > 2 || Math.abs(r.h - e.h) > 2) continue;
    if (r.y + r.h > Rimg.h || e.y + e.h > Eimg.h) continue;
    if (++n > 400) break;
    stats.candidates = (stats.candidates || 0) + 1;
    const A = crop(Rimg, r.x - 1, r.y - 1, r.w + 2, r.h + 2), B = crop(Eimg, e.x - 1, e.y - 1, e.w + 2, e.h + 2);
    const ga = gray(A), gb = gray(B);
    let mean = 0; for (const v of ga) mean += v; mean /= ga.length;
    let contrast = 0; for (const v of ga) contrast += Math.abs(v - mean); contrast /= ga.length;
    if (contrast < 6) { stats.blank = (stats.blank || 0) + 1; continue; }
    const asym = mad(ga, A.w, A.h, ga, A.w, A.h, true) / contrast;
    if (asym < 0.45) { stats.symmetric = (stats.symmetric || 0) + 1; continue; }   // متناظرة أفقيًّا: لا معنى للقلب
    const dSame = mad(ga, A.w, A.h, gb, B.w, B.h, false), dFlip = mad(ga, A.w, A.h, gb, B.w, B.h, true);
    const flipped = dFlip < dSame * 0.6, same = dSame < dFlip * 0.6;
    const directional0 = DIRECTIONAL.test(e.nm) && !NOT_DIRECTIONAL.test(e.nm);
    if (flipped) { stats.flipped = (stats.flipped || 0) + 1; if (directional0) stats.flippedDirectional = (stats.flippedDirectional || 0) + 1; }
    if (!same) { if (!flipped) stats.changed = (stats.changed || 0) + 1; continue; }
    stats.kept = (stats.kept || 0) + 1;
    const directional = DIRECTIONAL.test(e.nm) && !NOT_DIRECTIONAL.test(e.nm);
    const inNav = /breadcrumb|pagination|nav|toc|sidebar|menu/i.test(e.nm);
    F.push({ d: page.d, page: page.tag, url: page.url, width, check: directional ? "icon-not-flipped" : "icon-asymmetric-kept",
      key: e.k, el: e, sev: directional ? (inNav ? "high" : "medium") : "info",
      pix: { asym: +asym.toFixed(2), dSame: +dSame.toFixed(1), dFlip: +dFlip.toFixed(1) },
      detail: (directional ? "أيقونة اتجاهية لم تنعكس" : "أيقونة غير متناظرة بقيت على حالها (للمراجعة)") + ` — ${e.nm.slice(0, 90)}`,
      _crop: { A, B } });
  }
  return F;
}

// ═══════════════════════ النسبة إلى القاعدة المسؤولة ═══════════════════════
const PHYS = {
  margin: ["margin-left", "margin-right", "margin"], padding: ["padding-left", "padding-right", "padding"],
  border: ["border-left-width", "border-right-width", "border-left", "border-right", "border-width", "border"],
  inset: ["left", "right", "inset"], float: ["float"], align: ["text-align"], text: ["direction", "unicode-bidi"],
  geo: ["left", "right", "inset", "margin-left", "margin-right", "margin", "float", "transform", "translate", "justify-content", "justify-self", "text-align", "padding-left", "padding-right"],
};
function collateralProps(diffs) {
  const out = new Set();
  for (const d of diffs) {
    const p = d.split(":")[0].trim();
    out.add(p);
    const m = p.match(/^(border|margin|padding)-(top|bottom)/);
    if (m) { out.add(m[1]); if (m[1] === "border") { out.add("border-" + m[2]); out.add("border-width"); out.add("border-style"); out.add("border-" + m[2] + "-style"); } out.add(m[1] + "-block"); out.add(m[1] + "-block-" + (m[2] === "top" ? "start" : "end")); }
    if (p === "font-size") { out.add("font"); }
    if (p === "background-color") out.add("background");
    if (p.startsWith("border-radius")) { ["border-radius", "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius", "border-start-start-radius", "border-start-end-radius", "border-end-start-radius", "border-end-end-radius"].forEach((x) => out.add(x)); }
  }
  return [...out];
}
function selPath(key) { return key.split("/").slice(1).reduce((s, i) => s + " > :nth-child(" + (+i + 1) + ")", "body"); }
async function matchedFor(b, s, key) {
  const doc = await b.send("DOM.getDocument", { depth: 0 }, s);
  const q = await b.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: selPath(key) }, s);
  if (!q.nodeId) return null;
  return b.send("CSS.getMatchedStylesForNode", { nodeId: q.nodeId }, s);
}
function sheetInfo(run, id) { const h = id && run.sheetsById.get(id); return h ? { url: h.sourceURL || "", origin: h.origin, inline: !!h.isInline } : { url: "", origin: "", inline: false }; }
function isOurs(sel, sh) { return /data-cml/.test(sel) || /^chrome-extension:/.test(sh.url); }
const stripImp = (v) => String(v || "").replace(/\s*!\s*important\s*$/i, "").trim();
function declsOf(run, m, props, level) {
  const out = [];
  const push = (rule, style, kind) => {
    for (const p of (style && style.cssProperties) || []) {
      if (!props.includes(p.name) || p.disabled || p.parsedOk === false || !p.value) continue;
      if (!p.range && kind === "rule" && style.cssProperties.some((q) => q.range && q.name === p.name)) continue; // ضمنيّ مكرّر
      const sh = rule ? sheetInfo(run, rule.styleSheetId) : { url: "", origin: kind };
      const sel = rule ? rule.selectorList.text : kind;
      const ours = rule ? isOurs(sel, sh) : false;
      let sheet = sh.url ? path.basename(sh.url.split("?")[0]) : (sh.inline ? "(inline <style>)" : "");
      if (ours && /^chrome-extension:/.test(sh.url || "") === false) sheet = /data-cml-rtl="live"/.test(sel) ? "#cml-live-rtl (الورقة الحيّة)" : /data-cml-rtl="v2"/.test(sel) ? (OUR_CSS[run.d] || ["rtl-*.css"])[0] : "base.css/" + ((OUR_CSS[run.d] || ["", "*-point.css"])[1]);
      else if (rule && rule.origin === "injected" && !sheet) sheet = "(content-script css)";
      const inlineSheet = !ours && !!sh.inline;
      if (inlineSheet) sheet = "(<style> مضمَّن في الصفحة)";
      out.push({ prop: p.name, value: stripImp(p.value), important: !!p.important || /!\s*important/i.test(p.value), sel: sel.slice(0, 220), sheet,
        sheetUrl: sh.url, inlineSheet, origin: rule ? rule.origin : kind, ours, level,
        media: rule && rule.media && rule.media.length ? rule.media.map((x) => x.text).join(" & ") : "",
        layer: rule && rule.layers && rule.layers.length ? rule.layers.map((x) => x.text).join(".") : "" });
    }
  };
  if (!m) return out;
  if (m.attributesStyle) push(null, m.attributesStyle, "attributes");
  for (const rm of m.matchedCSSRules || []) push(rm.rule, rm.rule.style, "rule");
  if (m.inlineStyle) push(null, m.inlineStyle, "inline");
  return out;
}
// الإعلان الفائز بين إعلاناتٍ لخاصيةٍ واحدة (وأسماؤها المنطقية/المختصرة من مجموعتها) على عنصرٍ واحد:
// CDP يرتّب القواعد تصاعديًّا في التعاقب؛ والمهمّات: المتصفح أولًا، ثم المطبَّقة (أبكر طبقةٍ — وطبقتا
// cml-point/cml-imp معلنتان أولًا فتغلبان)، ثم غير المطبَّقة (الأخيرة)؛ والعادية: غير المطبَّقة تغلب المطبَّقة.
function pickWinner(ds) {
  if (!ds.length) return null;
  const imp = ds.filter((x) => x.important);
  if (imp.length) {
    const ua = imp.filter((x) => x.origin === "user-agent"); if (ua.length) return ua[0];
    const lay = imp.filter((x) => x.layer);
    if (lay.length) return lay.find((x) => /cml-point/.test(x.layer)) || lay.find((x) => /cml-imp/.test(x.layer)) || lay[0];
    return imp[imp.length - 1];
  }
  const inl = ds.filter((x) => x.origin === "inline"); if (inl.length) return inl[inl.length - 1];
  const unl = ds.filter((x) => !x.layer && x.origin !== "user-agent" && x.origin !== "attributes"); if (unl.length) return unl[unl.length - 1];
  const lay = ds.filter((x) => x.layer); if (lay.length) return lay[lay.length - 1];
  return ds[ds.length - 1];
}
// مجموعة الخاصية المنطقية: أسماءٌ تتنافس على الخانة الفيزيائية نفسها (في عنصرٍ RTL)
function groupOf(longhand, rtl) {
  const S = (a, b) => (rtl ? b : a);
  let m;
  if ((m = /^(margin|padding)-(left|right)$/.exec(longhand))) {
    const lg = m[2] === "left" ? S("inline-start", "inline-end") : S("inline-end", "inline-start");
    return [longhand, m[1], m[1] + "-inline", m[1] + "-" + lg];
  }
  if ((m = /^border-(left|right)-width$/.exec(longhand))) {
    const lg = m[1] === "left" ? S("inline-start", "inline-end") : S("inline-end", "inline-start");
    return [longhand, "border", "border-width", "border-" + m[1], "border-inline", "border-inline-width", "border-" + lg, "border-" + lg + "-width"];
  }
  if (longhand === "left" || longhand === "right") {
    const lg = longhand === "left" ? S("inline-start", "inline-end") : S("inline-end", "inline-start");
    return [longhand, "inset", "inset-inline", "inset-" + lg];
  }
  if ((m = /^(margin|padding)-(top|bottom)$/.exec(longhand))) return [longhand, m[1], m[1] + "-block", m[1] + "-block-" + (m[2] === "top" ? "start" : "end")];
  if ((m = /^border-(top|bottom)-(width|style|color)$/.exec(longhand))) {
    const be = "border-block-" + (m[1] === "top" ? "start" : "end");
    return [longhand, "border", "border-" + m[1], "border-" + m[2], "border-block", "border-block-" + m[2], be, be + "-" + m[2]];
  }
  if (/radius/.test(longhand)) return [longhand, "border-radius", "border-start-start-radius", "border-start-end-radius", "border-end-start-radius", "border-end-end-radius"];
  if (longhand === "font-size") return [longhand, "font"];
  if (longhand === "background-color") return [longhand, "background"];
  return [longhand];
}
function winnerFor(run, m, longhand, rtl, inheritable) {
  const names = groupOf(longhand, rtl);
  const levels = [m].concat(inheritable ? (m.inherited || []) : []);
  for (let i = 0; i < levels.length; i++) {
    const ds = declsOf(run, levels[i], names, i);
    if (!ds.length) continue;
    return { win: pickWinner(ds), all: ds };
  }
  return null;
}
const PHYS_RE = /^(margin-left|margin-right|padding-left|padding-right|left|right|float|clear|border-left|border-right|border-left-width|border-right-width)$/;
function isPhysicalDecl(x) {
  return PHYS_RE.test(x.prop) || (x.prop === "text-align" && /^(left|right|-webkit-left|-webkit-right)$/.test(x.value)) ||
    (/^(margin|padding|inset|border-width)$/.test(x.prop) && x.value.split(/\s+/).length === 4) ||
    (/^(transform|translate)$/.test(x.prop) && /translate|matrix/.test(x.value)) || (x.prop === "justify-content" && /left|right/.test(x.value));
}
// تصنيف إعلانٍ فائزٍ من الموقع (فيزيائي لم ينقلب أثره)
function classifySiteDecl(top, d, live) {
  const a = R.analyzeDecl(top.prop, top.value) || { kind: "none" };
  const inSnap = SNAP[d] && SNAP[d].has(top.sheet);
  if (a.kind === "physical-unflippable") return { cls: "engine-gap", rule: top, why: `إعلانٌ فيزيائي لا يقلبه cml-rtl (${a.reason}): ${top.prop}:${top.value}` };
  if (top.inlineSheet) return { cls: live ? "engine-gap" : "snapshot-stale", rule: top,
    why: live ? "القاعدة في <style> مضمَّن في الصفحة، والورقة الحيّة تُبنى من أوراق <link> وحدها" : "القاعدة في <style> مضمَّن في الصفحة، ولقطة snapshot-css.mjs تأخذ أوراق <link> وحدها" };
  if (!live && top.sheetUrl && !inSnap && !/^chrome-extension:/.test(top.sheetUrl))
    return { cls: "snapshot-stale", rule: top, why: `الورقة ${top.sheet} ليست في لقطة web/code/${SNAP_DIR[d]} (النطاق بلا ورقة حيّة)` };
  if (a.kind === "flip") {
    const emitted = live ? null : genText(d).includes(top.sel.split(",")[0].trim().slice(0, 60));
    return { cls: "engine-gap", rule: top, why: top.important ? "إعلانٌ فيزيائي !important يفوز على قلبنا (طبقة cml-imp لا تطابقه أو تخسر أمامه)"
      : emitted === false ? "القلب لم يُبثّ لهذا المحدِّد في rtl-*.css" : "قاعدة القلب لا تطابق العنصر أو تخسر في التعاقب (محدِّد/سياق/طبقة)" };
  }
  return { cls: "point-css", rule: top, why: `إعلان الموقع ${top.prop}:${top.value} (${top.sheet}) — لا يُقلب آليًّا` };
}
function ourKind(w) { return /data-cml-rtl=/.test(w.sel) ? "generated" : "point"; }
function classify(f, W, meta, decls) {
  const d = f.d, live = meta.rtl === "live";
  decls = decls || [];
  if (f.el && (f.el.isl || f.el.nf)) return { cls: "intended-ltr", why: "جزيرة LTR (شيفرة/مرجع API/سطح محسوب)" };
  if (f.check === "h-overflow" && f.preExisting) return { cls: "site-preexisting", why: "التمرير موجود في الأصل LTR" };
  if (f.check === "arrow-glyph") return { cls: "dictionary", why: "المحرف في نصّ الترجمة نفسه" };
  if (f.check.startsWith("icon")) return { cls: f.check === "icon-not-flipped" ? "point-css" : "review", why: "لا قاعدة قلبٍ للأيقونة — يحتاج scaleX(-1) مشروطًا بالاتجاه" };
  if (f.check === "text-ltr" || f.check === "table-dir") {
    if (f.el.da === "auto") return { cls: "engine-gap", why: "dir=auto (يضعه المحرّك على الحاوية) حسمه أولُ حرفٍ قويٍّ لاتيني في محتوى إنجليزي — فورث النصُّ العربي LTR" + (f.ltrRoot ? " — الجذر: " + f.ltrRoot : "") };
    if (f.el.da === "ltr" && f.el.dcm) return { cls: "engine-gap", why: "المحرّك نفسه وضع dir=ltr على كتلةٍ عربية (resolveDir/dirSel)" };
    if (f.el.da === "ltr") return { cls: "engine-gap", why: "سمة dir=ltr من الموقع ولم يُعِدها المحرّك (خارج dirSel/الغلاف)" };
    if (W && W.ours) return { cls: "intended-ltr", rule: W, why: "قفل LTR من أوراقنا (" + W.sel.slice(0, 60) + ") — نصٌّ عربي داخل جزيرة: راجع الترجمة" };
    if (W && !W.ours && W.value === "ltr") return { cls: "point-css", rule: W, why: "الموقع يفرض direction:ltr (" + W.sheet + " :: " + W.sel.slice(0, 60) + ")" };
    return { cls: "engine-gap", why: "الاتجاه موروثٌ LTR من سلفٍ لم يُقلب" + (f.ltrRoot ? " (" + f.ltrRoot + ")" : "") };
  }
  if (f.check === "collateral") {
    if (!W) return { cls: "review", why: "تغيّرٌ غير أفقي بلا إعلانٍ مطابق على العنصر (موروثٌ أو أثرُ خط)" };
    if (W.ours) {
      const site = decls.filter((x) => !x.ours && x.origin !== "user-agent" && x.origin !== "attributes");
      const lost = site.length ? site[site.length - 1] : null;
      return { cls: "engine-gap", rule: W, why: (ourKind(W) === "generated"
        ? "نسخةٌ مُعادة من أوراقنا المولَّدة (مختصرٌ متناظر يُبثّ كاملًا بخاناته العمودية) تغلب إعلان الموقع"
        : "قاعدةٌ نقطية من أوراقنا تغلب إعلان الموقع") + (lost ? ` — الخاسر: ${lost.sheet} :: ${lost.sel.slice(0, 70)} { ${lost.prop}: ${lost.value} }` : "") };
    }
    return { cls: "review", rule: W, why: "الفائز إعلانٌ من الموقع نفسه — التغيّر أثرُ تخطيطٍ أو خط" };
  }
  if (f.check === "align") {
    if (!W) return { cls: "point-css", why: "لا text-align معلن (الافتراضي start) — أثرُ تخطيط" };
    if (W.ours) return { cls: ourKind(W) === "point" ? "point-css" : "engine-gap", rule: W,
      why: (ourKind(W) === "point" ? "قاعدةٌ نقطية منّا تفرض المحاذاة" : "قاعدةٌ مولَّدة منّا تفرض المحاذاة") + ` (${W.sel.slice(0, 110)} { text-align:${W.value}${W.important ? " !important" : ""} })` +
        (W.level ? ` — موروثةٌ من سلفٍ على بعد ${W.level}` : "") };
    if (/^(left|right|-webkit-left|-webkit-right)$/.test(W.value)) return classifySiteDecl(W, d, live);
    return { cls: "point-css", rule: W, why: `text-align:${W.value} من ${W.sheet} — المحاذاة ليست فيزيائية؛ أثرُ تخطيط` };
  }
  if (f.check === "box-not-mirrored" || f.check === "box-mirrored-ltr" || f.check === "list-marker") {
    if (!W) return { cls: "point-css", why: "لا إعلان على العنصر — افتراضيُّ المتصفح أو أثرٌ محسوب" };
    if (W.origin === "inline") return { cls: "point-css", rule: W, why: "نمطٌ سطري يحسبه جافاسكربت الموقع (" + W.prop + ":" + W.value + ")" };
    if (W.origin === "attributes") return { cls: "point-css", rule: W, why: "سمة عرضٍ في HTML (" + W.prop + ":" + W.value + ")" };
    if (W.origin === "user-agent") return { cls: "point-css", rule: W, why: "افتراضيُّ المتصفح (" + W.prop + ":" + W.value + ")" };
    if (W.ours) return { cls: ourKind(W) === "point" ? "point-css" : "engine-gap", rule: W, why: "إعلانٌ من أوراقنا يفرض الجهة: " + W.sel.slice(0, 100) + " { " + W.prop + ":" + W.value + " }" };
    if (isPhysicalDecl(W) || PHYS_RE.test(W.prop)) return classifySiteDecl(W, d, live);
    return { cls: "engine-gap", rule: W, why: `الفائز ${W.prop}:${W.value} (${W.sheet}) — منطقيٌّ/مختصرٌ ولم ينعكس أثره` };
  }
  // ★ (ر5-ج) الجدول خارج صندوقه: من الموقع إن كان كذلك في الأصل LTR؛ وإلا فالهامش السالب الفائز في جهة الخروج (attribute) إن وُجد
  if (f.check === "table-clip" || f.check === "table-scroll") {
    if (f.preExisting) return { cls: "site-preexisting", why: "الجدول خارج صندوقه في الأصل LTR أيضًا (من الموقع نفسه)" };
    if (W && W.ours) return { cls: ourKind(W) === "point" ? "point-css" : "engine-gap", rule: W,
      why: (ourKind(W) === "point" ? "قاعدةٌ نقطية منّا" : "إعلانٌ من أوراقنا المولَّدة (قلبٌ أو نسخةٌ مطابقة)") + ` يدفع الجدول خارج صندوقه: ${W.sel.slice(0, 100)} { ${W.prop}:${W.value} }` };
    if (W) return classifySiteDecl(W, d, live);
    return { cls: "point-css", why: "أثرُ تخطيط: الجدول أعرض من صندوقه وأصلُ التمرير أو القصُّ يُضيّع جهته" };
  }
  // الانعكاس الهندسي/الخروج/التراكب: أقرب إعلانٍ فيزيائي من الموقع على العنصر أو سلفيه
  const phys = decls.filter((x) => !x.ours && x.origin !== "user-agent" && isPhysicalDecl(x));
  if (phys.length) return classifySiteDecl(phys[phys.length - 1], d, live);
  const inl = decls.filter((x) => x.origin === "inline");
  if (inl.length) return { cls: "point-css", rule: inl[0], why: "نمطٌ سطري يحسبه جافاسكربت الموقع (" + inl.map((x) => x.prop + ":" + x.value).join("; ").slice(0, 100) + ")" };
  const ourPhys = decls.filter((x) => x.ours && /left|right/.test(x.prop + " " + x.value));
  if (ourPhys.length) { const o = ourPhys[ourPhys.length - 1]; return { cls: ourKind(o) === "point" ? "point-css" : "engine-gap", rule: o, why: "من أوراقنا نحن: " + o.sel.slice(0, 90) + " { " + o.prop + ":" + o.value + " }" }; }
  return { cls: "point-css", why: "لا إعلانٌ فيزيائي على العنصر أو سلفيه — أثرُ تخطيطٍ أو محسوب" };
}
const GEO_PROPS = ["left", "right", "inset", "inset-inline", "inset-inline-start", "inset-inline-end", "margin-left", "margin-right", "margin", "margin-inline", "margin-inline-start", "margin-inline-end",
  "float", "transform", "translate", "justify-content", "justify-self", "text-align", "padding-left", "padding-right", "padding", "padding-inline", "padding-inline-start", "padding-inline-end"];
async function attribute(b, run, f) {
  const rtl = f.el && f.el.dir === "rtl";
  let W = null, decls = [];
  try {
    if (f.check === "text-ltr" || f.check === "table-dir") {
      // أعلى سلفٍ LTR تحت أبٍ RTL: هو مصدر الاتجاه
      const info = await evalIn(b, run.s, `(function(){var e=document.querySelector(${JSON.stringify(selPath(f.key))});if(!e)return null;var root=e,p=e.parentElement;
        while(p&&getComputedStyle(p).direction==='ltr'&&p!==document.documentElement){root=p;p=p.parentElement;}
        var path=[],x=root;for(var i=0;i<4&&x&&x!==document.body;i++,x=x.parentElement)path.unshift(x.localName+(x.id?'#'+x.id:'')+(x.getAttribute('class')?'.'+String(x.getAttribute('class')).split(' ')[0]:''));
        var k=[],y=root;while(y&&y!==document.body){var par=y.parentElement;k.unshift(Array.prototype.indexOf.call(par.children,y));y=par;}
        return {sel:path.join(' > '),dir:root.getAttribute('dir'),dcm:root.getAttribute('data-cml-dir'),key:'b/'+k.join('/'),same:root===e};})()`);
      if (info) { f.ltrRoot = info.sel + (info.dir ? ` [dir=${info.dir}]` : ""); f.el = Object.assign({}, f.el, { da: info.dir || f.el.da, dcm: info.dcm ? 1 : f.el.dcm }); }
      const m = await matchedFor(b, run.s, info && info.key && info.key !== "b/" ? info.key : f.key);
      const r = m && winnerFor(run, m, "direction", false, false);
      if (r) { W = r.win; decls = r.all; }
    } else if (f.check === "collateral") {
      const m = await matchedFor(b, run.s, f.key);
      const lh = (f.diffs || []).map((x) => x.split(":")[0].trim()).find((p) => /^(border-(top|bottom)-(width|color)|margin-(top|bottom)|padding-(top|bottom)|font-size|background-color)$/.test(p));
      const r = m && lh && winnerFor(run, m, lh, rtl, false);
      if (r) { W = r.win; decls = r.all; }
    } else if (f.check === "align") {
      const m = await matchedFor(b, run.s, f.key);
      const r = m && winnerFor(run, m, "text-align", true, true);
      if (r) { W = r.win; decls = r.all; }
    } else if (f.check === "box-not-mirrored" || f.check === "box-mirrored-ltr" || f.check === "list-marker") {
      const m = await matchedFor(b, run.s, f.key);
      const fam = f.check === "list-marker" ? "padding" : f.prop;
      const sides = fam === "margin" ? ["margin-left", "margin-right"] : fam === "padding" ? ["padding-left", "padding-right"] : fam === "border" ? ["border-left-width", "border-right-width"]
        : fam === "inset" ? ["left", "right"] : ["float"];
      // الجهة ذات القيمة الأكبر بعد القلب هي التي تحمل عدم التناظر
      const v = { "margin-left": f.el.ml, "margin-right": f.el.mr, "padding-left": f.el.pl, "padding-right": f.el.pr, "border-left-width": f.el.bl, "border-right-width": f.el.br, left: f.el.L, right: f.el.R };
      const side = sides.length === 2 ? (Math.abs(v[sides[0]] || 0) >= Math.abs(v[sides[1]] || 0) ? sides[0] : sides[1]) : sides[0];
      const r = m && winnerFor(run, m, side, rtl, false);
      if (r) { W = r.win; decls = r.all; }
    } else if (f.check === "table-clip" || f.check === "table-scroll") {
      // ★ (ر5-ج) الهامش الفائز في جهة الخروج (اليمين للبداية، واليسار للنهاية): سالبُه يدفع الجدول خارج صندوقه
      const m = await matchedFor(b, run.s, f.key);
      const r = m && winnerFor(run, m, /^start/.test(f.prop || "") ? "margin-right" : "margin-left", rtl, false);
      if (r) { decls = r.all; if (r.win && parseFloat(r.win.value) < 0) W = r.win; }
    } else {
      const m = await matchedFor(b, run.s, f.key);
      decls = m ? declsOf(run, m, GEO_PROPS, 0) : [];
      if (m && !decls.some((x) => !x.ours && x.origin !== "user-agent" && isPhysicalDecl(x))) {
        for (let i = 0; i < Math.min(2, (m.inherited || []).length); i++) {
          const dd = declsOf(run, m.inherited[i], GEO_PROPS, i + 1).filter((x) => !x.ours && x.origin !== "user-agent");
          if (dd.length) { decls = decls.concat(dd); break; }
        }
      }
    }
  } catch (e) { f.attrError = e.message; }
  const c = classify(f, W, run.snap.meta, decls);
  f.cls = c.cls; f.why = c.why;
  if (c.rule) f.rule = { sheet: c.rule.sheet, sel: c.rule.sel, decl: `${c.rule.prop}:${c.rule.value}${c.rule.important ? " !important" : ""}`, media: c.rule.media, layer: c.rule.layer, level: c.rule.level, ours: !!c.rule.ours };
  f.decls = decls.slice(-8).map((x) => `${x === W ? "★ " : ""}${x.ours ? "[ours] " : ""}${x.sheet || x.origin} :: ${x.sel.slice(0, 120)} { ${x.prop}: ${x.value}${x.important ? " !important" : ""} }${x.layer ? " @layer " + x.layer : ""}${x.level ? " (سلف " + x.level + ")" : ""}`);
}

// ═══════════════════════ تجميع وتعليم ولقطات ═══════════════════════
const SEV_RANK = { high: 3, medium: 2, low: 1, info: 0 };
function groupKey(f) { return [f.d, f.check, f.prop || "", sigOf(f.el || { t: "?", c: "" })].join("§"); }
function fingerprint(f) { return crypto.createHash("sha1").update(groupKey(f)).digest("hex").slice(0, 12); }
function dedupe(F) {
  const g = new Map();
  for (const f of F) {
    const k = groupKey(f) + "§" + f.width;
    if (!g.has(k)) { f.count = 1; f.examples = [f.key]; g.set(k, f); }
    else { const h = g.get(k); h.count++; if (h.examples.length < 4) h.examples.push(f.key); if (SEV_RANK[f.sev] > SEV_RANK[h.sev]) h.sev = f.sev; }
  }
  return [...g.values()];
}
async function annotate(b, run, list, file) {
  const boxes = list.map((f, i) => ({ n: i + 1, x: f.el.x, y: f.el.y, w: Math.max(6, f.el.w), h: Math.max(6, f.el.h), sev: f.sev }));
  await evalIn(b, run.s, `(function(bx){var L=document.createElement('div');L.id='cml-audit-overlay';L.style.cssText='position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;direction:ltr';
    bx.forEach(function(q){var c=q.sev==='high'?'#e0005a':q.sev==='medium'?'#ff8c00':'#1e88e5';var d=document.createElement('div');
      d.style.cssText='position:absolute;box-sizing:border-box;border:2px solid '+c+';left:'+(q.x-scrollX)+'px;top:'+(q.y-scrollY)+'px;width:'+q.w+'px;height:'+q.h+'px;';
      var t=document.createElement('span');t.textContent=q.n;t.style.cssText='position:absolute;left:-2px;top:-16px;font:bold 11px/14px sans-serif;background:'+c+';color:#fff;padding:0 3px;border-radius:2px';
      d.appendChild(t);L.appendChild(d);});(document.body||document.documentElement).appendChild(L);return bx.length;})(${JSON.stringify(boxes)})`);
  const shot = await b.send("Page.captureScreenshot", { format: "jpeg", quality: 62, captureBeyondViewport: false }, run.s, 120000);
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  await evalIn(b, run.s, "(function(){var o=document.getElementById('cml-audit-overlay');if(o)o.remove();return 1;})()");
}
function evidenceCrop(Rimg, Eimg, Rrec, Erec, file) {
  const pad = 24;
  const cw = Math.min(700, Math.max(Rrec.w, Erec.w) + pad * 2), ch = Math.min(260, Math.max(Rrec.h, Erec.h) + pad * 2);
  const a = crop(Rimg, Rrec.x + Rrec.w / 2 - cw / 2, Rrec.y + Rrec.h / 2 - ch / 2, cw, ch);
  const e = crop(Eimg, Erec.x + Erec.w / 2 - cw / 2, Erec.y + Erec.h / 2 - ch / 2, cw, ch);
  const k = Math.max(1, Math.min(4, Math.floor(160 / Math.max(a.h, 1))));
  fs.writeFileSync(file, encodePNG(sideBySide(scaleUp(a, k), scaleUp(e, k))));
}

// ═══════════════════════ التشغيل ═══════════════════════
const started = Date.now();
fs.mkdirSync(OUT, { recursive: true });
if (DO_SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(path.join(SHOTS, "crops"), { recursive: true }); }
let commit = "";
try { commit = spawnSync("git", ["-C", REPO, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).stdout.trim(); } catch {}
const manifest = JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"), "utf8"));
console.log(`فحص الاتجاه — الإضافة ${manifest.version} (${commit || "?"}) من ${EXT}\n${PAGES.length} صفحة × ${WIDTHS.join("/")} = ${PAGES.length * WIDTHS.length} تشغيلًا مزدوجًا`);

const refB = await launchChrome(false), extB = await launchChrome(true);
console.log("✓ كروم المرجع وكروم الإضافة (" + extB.extId + ")");
const results = [];
const ATTR_CACHE = new Map();   // بصمة الصنف ⇒ نسبته (تُعاد في الصفحات التالية بلا نداءٍ جديد)
try {
  for (const page of PAGES) {
    for (const width of WIDTHS) {
      const t0 = Date.now();
      const tag = `${page.d}-${page.tag}-${width}`;
      let Rrun = null, Erun = null;
      const entry = { d: page.d, tag: page.tag, url: page.url, width, findings: [], meta: null, refMeta: null, error: null, shot: null };
      try {
        [Rrun, Erun] = await Promise.all([loadPage(refB, page, width, false), loadPage(extB, page, width, true)]);
        entry.meta = Erun.snap.meta; entry.refMeta = Rrun.snap.meta;
        if (flag("dump")) { fs.mkdirSync(path.join(OUT, "dumps"), { recursive: true }); fs.writeFileSync(path.join(OUT, "dumps", tag + ".json"), JSON.stringify({ ref: Rrun.snap, ext: Erun.snap })); }
        const m = Erun.snap.meta;
        if (m.challenge || Rrun.snap.meta.challenge) { entry.error = "تحدّي Cloudflare/حجب — الصفحة غير قابلة للوصول بلا واجهة"; throw new Error(entry.error); }
        if (m.cml !== "on") { entry.error = "المحرّك لم يعمل على الصفحة (data-cml≠on)"; }
        if (!Rrun.snap.meta.sheetsOk || !m.sheetsOk) { entry.error = `أوراق CSS لم تُطبَّق (${!Rrun.snap.meta.sheetsOk ? "المرجع" : "المعرَّب"}: ${JSON.stringify((!Rrun.snap.meta.sheetsOk ? Rrun : Erun).snap.meta.cssNet)}) — لا مقارنة`; throw new Error(entry.error); }
        entry.iconStats = {};
        const PR = pairTrees(Rrun.snap, Erun.snap);
        let F = compare(page, width, Rrun.snap, Erun.snap, PR).concat(iconChecks(page, width, Rrun.snap, Erun.snap, Rrun.img, Erun.img, entry.iconStats, PR));
        entry.pairing = { ext: Erun.snap.recs.length, ref: Rrun.snap.recs.length, paired: PR.size };
        // صفحةٌ: لقطة CSS متقادمة (للنطاقات بلا ورقة حيّة) أو الحيّة لم تعمل
        const siteSheets = (m.sheets || []).filter((u) => !/^chrome-extension:/.test(u));
        const miss = siteSheets.filter((u) => !SNAP[page.d].has(path.basename(u.split("?")[0])));
        entry.snapshot = { sheets: siteSheets.map((u) => path.basename(u.split("?")[0])), missing: miss.map((u) => path.basename(u.split("?")[0])), live: m.rtl === "live", gate: m.rtl };
        if (miss.length && m.rtl !== "live") F.push({ d: page.d, page: page.tag, url: page.url, width, check: "snapshot-stale", key: "b", el: Erun.snap.recs[0] || { t: "body", c: "" },
          sev: "high", cls: "snapshot-stale", why: "أوراق الصفحة ليست في اللقطة", detail: `${miss.length}/${siteSheets.length} من أوراق الصفحة ليست في web/code/${SNAP_DIR[page.d]}: ${entry.snapshot.missing.join("، ")}` });
        if (DMETA[page.d] && DMETA[page.d].meta && DMETA[page.d].meta.live && m.rtl !== "live") F.push({ d: page.d, page: page.tag, url: page.url, width, check: "live-sheet-missing", key: "b", el: Erun.snap.recs[0] || { t: "body", c: "" },
          sev: "high", cls: "engine-gap", why: "الورقة الحيّة لم تُحقن", detail: `data-cml-rtl=${m.rtl} (المتوقَّع live)` });
        F = dedupe(F);
        F.sort((a, b) => SEV_RANK[b.sev] - SEV_RANK[a.sev] || (b.count || 1) - (a.count || 1));
        // النسبة إلى القاعدة: للممثّل الأول من كل مجموعة (سقفٌ للصفحة)
        let tA = Date.now();
        let nAttr = 0;
        const budget = Date.now() + (+opt("attr-budget", "90") * 1000);   // claude.ai: CSS.getMatchedStylesForNode بطيءٌ (~١٤ث للنداء)
        for (const f of F) {
          if (f.cls || f.sev === "info" || (f.check === "h-overflow" && !f.el)) continue;
          // مفتاح النسبة: بصمة الصنف؛ والأثر الجانبي بالخصائص المتغيّرة نفسها (سببه في الغالب قاعدةٌ واحدة عامة
          // من أوراقنا) — فنداءٌ واحد لكل مجموعة خصائص في النطاق بدل نداءٍ لكل عنصر (CDP بطيءٌ على الأوراق الكبيرة)
          const fp = (m.rtl || "-") + "|" + (f.check === "collateral" ? "col|" + f.d + "|" + (f.diffs || []).map((x) => x.split(":")[0].trim()).sort().join(",") : fingerprint(f));
          if (ATTR_CACHE.has(fp)) { Object.assign(f, ATTR_CACHE.get(fp), { attrFrom: f.check === "collateral" ? "same-props" : "cache" }); continue; }
          if (nAttr >= 60 || Date.now() > budget) { f.attrSkipped = "budget"; continue; }
          nAttr++; await attribute(extB, Erun, f);
          // الأثر الجانبي يُعاد لعناصر أخرى بالخصائص نفسها: السبب (القاعدة الفائزة) مشترك، أمّا «الخاسر» وقائمة الإعلانات فخاصّةٌ بالعنصر
          if (!f.attrError) ATTR_CACHE.set(fp, f.check === "collateral"
            ? { cls: f.cls, why: String(f.why || "").replace(/ — الخاسر: .*$/, ""), rule: f.rule }
            : { cls: f.cls, why: f.why, rule: f.rule, decls: f.decls, ltrRoot: f.ltrRoot });
        }
        for (const f of F) if (!f.cls) {
          if (f.attrSkipped) { f.cls = "unattributed"; f.why = "لم تُنسب إلى قاعدة (ميزانية الوقت) — أعد بـ--attr-budget أكبر"; continue; }
          const c = classify(f, null, m, []); f.cls = c.cls; f.why = c.why;
        }
        tA = T(`نسبة (${nAttr})`, tA);
        // اللقطات: الصفحة معلَّمةً + قصاصات المقارنة (الأصل | المعرَّب) لأعلى العيوب
        if (DO_SHOTS) {
          const shown = F.filter((f) => f.sev !== "info" && f.el && f.el.w).slice(0, 40);
          entry.shot = `rtl-shots/${tag}.jpg`;
          try { await annotate(extB, Erun, shown, path.join(OUT, entry.shot)); } catch (e) { entry.shotError = e.message; }
          if (flag("ref-shots")) { try { const sh = await refB.send("Page.captureScreenshot", { format: "jpeg", quality: 55 }, Rrun.s, 120000); entry.refShot = `rtl-shots/${tag}-ltr-ref.jpg`; fs.writeFileSync(path.join(OUT, entry.refShot), Buffer.from(sh.data, "base64")); } catch {} }
          shown.forEach((f, i) => { f.n = i + 1; });
          let nc = 0;
          for (const f of F) {
            if (nc >= 6 || f.sev === "info" || f.sev === "low" || !f.el || !f.el.w) continue;
            const Rrec = PR.get(f.key);
            if (!Rrec || !Rrun.img || !Erun.img) continue;
            // عنصرٌ خارج الصورة (صفحةٌ تجاوزت سقف الارتفاع أو نمت بعد ضبط الإطار): لا قصاصة
            if (Rrec.y + Rrec.h > Rrun.img.h || f.el.y + f.el.h > Erun.img.h || Rrec.w < 2 || Rrec.h < 2) continue;
            const file = `rtl-shots/crops/${tag}-${String(f.n || nc + 1).padStart(2, "0")}-${f.check}.png`;
            try { evidenceCrop(Rrun.img, Erun.img, Rrec, f.el, path.join(OUT, file)); f.crop = file; nc++; } catch {}
          }
        }
        for (const f of F) { delete f._crop; f.fp = fingerprint(f); f.sel = f.el ? shortSel(f.el) : ""; f.path = selPath(f.key || "b");
          if (f.el) f.css = { dir: f.el.dir, ta: f.el.ta, disp: f.el.disp, pos: f.el.pos, margin: `${f.el.ml}/${f.el.mr}`, padding: `${f.el.pl}/${f.el.pr}`, inset: `${f.el.L}/${f.el.R}`, float: f.el.fl, transform: f.el.tf || f.el.sc || f.el.ro || "", box: `x=${f.el.x} y=${f.el.y} w=${f.el.w} h=${f.el.h}` };
          delete f.el; }
        entry.findings = F;
      } catch (e) { entry.error = entry.error || e.message; }
      finally { await closePage(refB, Rrun); await closePage(extB, Erun); }
      const c = entry.findings.reduce((a, f) => (a[f.sev] = (a[f.sev] || 0) + 1, a), {});
      console.log(`${entry.error ? "✗" : "•"} ${tag.padEnd(46)} ${((Date.now() - t0) / 1000).toFixed(0)}ث  عالٍ ${c.high || 0} متوسط ${c.medium || 0} منخفض ${c.low || 0}` +
        (entry.meta ? `  [${entry.meta.htmlDir || "-"}/${entry.meta.rtl || "-"} عناصر ${entry.meta.recs}${entry.meta.truncated ? "+" : ""}]` : "") + (entry.error ? "  " + entry.error : ""));
      results.push(entry);
      if (!flag("keep-going") && entry.error && /CDP|كروم/.test(entry.error)) throw new Error(entry.error);
    }
  }
} finally { await Promise.all([refB.close(), extB.close()]); }

// ---- التجميع عبر الصفحات: أصناف العيوب مرتّبةً بالأولوية ----
const groups = new Map();
for (const e of results) for (const f of e.findings) {
  const k = f.fp;
  if (!groups.has(k)) groups.set(k, { fp: k, d: f.d, check: f.check, prop: f.prop || "", sel: f.sel, sev: f.sev, cls: f.cls, why: f.why, rule: f.rule || null, pages: new Set(), widths: new Set(), count: 0, sample: f });
  const g = groups.get(k); g.pages.add(f.page); g.widths.add(f.width); g.count += f.count || 1; if (SEV_RANK[f.sev] > SEV_RANK[g.sev]) g.sev = f.sev;
}
const G = [...groups.values()].map((g) => Object.assign(g, { pages: [...g.pages], widths: [...g.widths], score: SEV_RANK[g.sev] * 100 + g.pages.size * 10 + Math.min(9, g.count) }))
  .sort((a, b) => b.score - a.score);
// ---- الأسباب الجذرية: كل قاعدةٍ مسؤولة (ورقة + محدِّد + إعلان) وما تسبّبت فيه عبر الصفحات ----
const causes = new Map();
for (const e of results) for (const f of e.findings) {
  if (!f.rule || f.sev === "info") continue;
  const k = [f.d === "privacy" ? "support" : f.d, f.rule.sheet, f.rule.sel, f.rule.decl].join("§");
  if (!causes.has(k)) causes.set(k, { d: f.d, sheet: f.rule.sheet, sel: f.rule.sel, decl: f.rule.decl, ours: f.rule.ours, cls: f.cls, checks: new Set(), elements: 0, groups: new Set(), pages: new Set(), sev: f.sev, sample: f.why });
  const c = causes.get(k); c.checks.add(f.check + (f.prop ? "/" + f.prop : "")); c.elements += f.count || 1; c.groups.add(f.fp); c.pages.add(f.d + ":" + f.page);
  if (SEV_RANK[f.sev] > SEV_RANK[c.sev]) c.sev = f.sev;
}
const CAUSES = [...causes.values()].map((c) => ({ d: c.d, sheet: c.sheet, sel: c.sel, decl: c.decl, ours: c.ours, cls: c.cls, sev: c.sev, why: c.sample,
  checks: [...c.checks], elements: c.elements, groups: c.groups.size, pages: [...c.pages] })).sort((a, b) => SEV_RANK[b.sev] - SEV_RANK[a.sev] || b.elements - a.elements);
const report = { at: new Date().toISOString(), repo: REPO, commit, extVersion: manifest.version, widths: WIDTHS, ms: Date.now() - started,
  totals: { pages: results.length, errors: results.filter((e) => e.error).length, findings: results.reduce((a, e) => a + e.findings.length, 0), groups: G.length },
  groups: G.map((g) => ({ fp: g.fp, d: g.d, check: g.check, prop: g.prop, sel: g.sel, sev: g.sev, cls: g.cls, why: g.why, rule: g.rule, pages: g.pages, widths: g.widths, count: g.count,
    detail: g.sample.detail, text: g.sample.text, crop: g.sample.crop, path: g.sample.path, css: g.sample.css, decls: g.sample.decls, url: g.sample.url, ltrRoot: g.sample.ltrRoot })),
  causes: CAUSES,
  pages: results };
fs.writeFileSync(path.join(OUT, "rtl-audit-results.json"), JSON.stringify(report, null, 1));

// ---- ملخّص نصّي ----
const byCls = {}, bySev = {};
for (const g of G) { byCls[g.cls] = (byCls[g.cls] || 0) + 1; bySev[g.sev] = (bySev[g.sev] || 0) + 1; }
console.log(`\nالأسباب الجذرية (قواعد مسؤولة): ${CAUSES.length}`);
for (const c of CAUSES.slice(0, 15)) console.log(`  [${c.sev}] ${c.cls} ${c.sheet} :: ${c.sel.slice(0, 90)} { ${c.decl} } — ${c.elements} عنصرًا في ${c.pages.length} صفحة (${c.checks.join("، ")})`);
console.log(`\nأصناف العيوب: ${G.length} — بالشدّة ${JSON.stringify(bySev)} — بالتصنيف ${JSON.stringify(byCls)}`);
for (const g of G.filter((x) => x.sev === "high" || x.sev === "medium").slice(0, 40))
  console.log(`  [${g.sev}] ${g.d} ${g.check}${g.prop ? "/" + g.prop : ""} ${g.sel} ×${g.count} في ${g.pages.length} صفحة — ${g.cls}: ${g.why}`);

// ---- البوابة ----
// خطّ الأساس والقرارات متتبَّعان بجوار الاختبارات (بصماتٌ ومحدِّدات فقط — لا نصوص صفحات).
// ★ (مراجعة الفحص، د-٤) لا يدخل خطَّ الأساس عيبٌ «عالٍ» إلا بقرارٍ مسجَّل في ملف القرارات (سببه مكتوب)،
// والبوابة تُخفق أيضًا إن زاد عدد العناصر تحت بصمةٍ مقبولة (انتشار عيبٍ معروف إلى صفحاتٍ جديدة).
const TESTDIR = path.join(REPO, "web", "code", "test");
const baseFile = path.resolve(opt("baseline", path.join(TESTDIR, "rtl-audit-baseline.json")));
const decFile = path.resolve(opt("decisions", path.join(TESTDIR, "rtl-audit-decisions.json")));
let decisions = [];
try { decisions = JSON.parse(fs.readFileSync(decFile, "utf8")).decisions || []; } catch {}
// page (اختياري): تعبيرٌ نمطي على وسوم الصفحات — القرار لا يغطّي الصنف إلا إن وقع في صفحاته وحدها (قرارٌ بلا page يعمّ النطاق)
function decisionOf(g) {
  return decisions.find((x) => (!x.d || x.d === g.d) && (!x.check || x.check === g.check) &&
    (!x.sel || new RegExp(x.sel).test(g.sel)) &&
    (!x.page || (g.pages || []).every((p) => new RegExp(x.page).test(p)))) || null;
}
if (flag("write-baseline")) {
  const hiNoDecision = G.filter((g) => g.sev === "high" && !decisionOf(g));
  if (hiNoDecision.length) {
    console.error(`\n✗ لا يُكتب خطّ الأساس: ${hiNoDecision.length} صنفٌ عالٍ بلا قرارٍ مسجَّل في ${decFile}`);
    for (const g of hiNoDecision) console.error(`  ${g.fp} ${g.d} ${g.check} ${g.sel} ×${g.count} — ${g.why}`);
    process.exit(1);
  }
  fs.writeFileSync(baseFile, JSON.stringify({ at: report.at, commit, extVersion: manifest.version,
    fps: G.filter((g) => g.sev !== "info").map((g) => ({ fp: g.fp, sev: g.sev, d: g.d, check: g.check, sel: g.sel, count: g.count,
      decision: (decisionOf(g) || {}).decision })) }, null, 1));
  console.log("✓ خطّ الأساس: " + baseFile);
}
if (flag("gate")) {
  let known = new Map();
  try { known = new Map(JSON.parse(fs.readFileSync(baseFile, "utf8")).fps.map((x) => [x.fp, x])); } catch {}
  const fresh = G.filter((g) => (g.sev === "high" || g.sev === "medium") && g.cls !== "intended-ltr" && g.cls !== "site-preexisting" &&
    (!known.has(g.fp) || (known.get(g.fp).count != null && g.count > known.get(g.fp).count)));
  const errs = results.filter((e) => e.error && !/Cloudflare/.test(e.error));
  if (fresh.length || errs.length) {
    console.error(`\n✗ البوابة: ${fresh.length} صنف عيبٍ جديد (عالٍ/متوسط) و${errs.length} صفحة أخفقت`);
    for (const g of fresh.slice(0, 30)) console.error(`  ${g.fp} [${g.sev}] ${g.d} ${g.check} ${g.sel} — ${g.why}`);
    process.exit(1);
  }
  console.log("✓ البوابة: لا عيب جديد فوق خطّ الأساس");
}
