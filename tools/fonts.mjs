// fonts.mjs — الخطوط العربية المحزومة: التنزيل المأذون، والبوابة، وملف النسبة.
//
// الخطوط بياناتٌ محزومة داخل الإضافة (extension/fonts/)، ولا يُطلب منها شيءٌ من الشبكة وقت التشغيل:
// يقرأ عامل الخدمة الملف المختار وحده من الحزمة، ويبلغ الصفحةَ عبر التخزين المحلي و FontFace(ArrayBuffer).
// ومصدر كل ملفٍّ وحجمه وبصمته في قفلٍ واحد: web/code/fonts.lock.json في مجلد العمل، و tools/fonts.lock.json في النشر.
//
//   node fonts.mjs fetch --approved    يجلب ملفات القفل وحدها (لكل خطٍّ ملفه وترخيصه) — يدويًّا بعد موافقة المالك، ولا يعمل في CI
//   node fonts.mjs verify [--release]  البوابة (تستوردها verify-package عبر verifyFonts). مع --release يصير المعلَّق خطأً
//   node fonts.mjs credits             يولّد extension/fonts/CREDITS.txt من القفل توليدًا ثابت البايتات
//   node fonts.mjs measure --out=<مجلد> [--apply]
//                                      المعايرة (§٤.٦): كروم بلا واجهة، ولا شبكة إلا صفحة وثائق المنصة لارتفاع x؛ تكتب
//                                      calibration.json والتقرير ولوحة العيّنات، ومع --apply تكتب المعايرة في القفل وتُسقط ما لم يجتز
//                                      (وترفض إن لم يجتز خطٌّ واحد). خيارات: --brand-from=<json> --report-only --scenario=<مجلد>
//                                      --cost-only (يعيد قياس كلفة الإقلاع وحدها على calibration.json بعد هدوء المعالج)
//                                      --prune=<px> --only=<id,…> --stats-only. والعلاج النقطي للقصّ يُقرأ من *-point.css
//                                      (القواعد المعلَّقة على C.FONT_ATTR) لا من خيار، والمرجع «اليوم» بلا علاج
//   node fonts.mjs clamp --from=<inventory.json>
//                                      يكتب web/code/fonts.clamp.json من حصر مواضع القطع بعدد الأسطر (line-clamp): أزواج
//                                      (حجم / ارتفاع سطر) الحقيقية لكل لقطة، وهي ما يقيسه measure في عناصر القطع
//   node fonts.mjs clamp-css           يولّد مرآة --cml-ff (قائمة خط كل عنصرٍ كما يعلنها الموقع، بترتيب أوراقه وطبقاته)
//                                      ومحدِّدات العلاج لما تحت الجذور، في *-point.css من اللقطات
//
// ما تضيفه المعايرة إلى القفل لاحقًا، وتفحصه البوابة متى وُجد:
//   lock.reference = { B: { ui: {x, asc, desc}, read: {x, asc, desc} }, measured: {hijri, gregorian},
//                      spotFix: { attr, sig, files: { "<ملف>-point.css": { margins: {محدِّد: "0.16em"|"2px"|"none"}, exclude } } } | null }
//     (صندوق سطر خط العلامة وارتفاع x لكل دور، بوحدة em؛ والعلاج النقطي الذي قيس به، وبصمته تفحصها البوابة)
//   font.calib = { m: { ui: {s, a, d}, read: {s, a, d} },
//                  heights: [{ px, lh, share, deepest, ref: { share, deepest } }] }
//     (share نسبة العبارات المقصوصة عند الارتفاع، و deepest أعمق قصٍّ بالبكسل، و ref نظيرهما لخط النظام اليوم)
//   والفهرس C.FONTS في cml-const.js يحمل m نفسها لكل خط.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as P from "./paths.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// مجلد العمل يصدّر CODE (والقفل فيه)؛ نسخة النشر سطحية والقفل بجوار الأداة في tools/
export const LOCK_PATH = P.CODE ? path.join(P.CODE, "fonts.lock.json") : path.join(HERE, "fonts.lock.json");
export const FONTS_DIR = path.join(P.EXT, "fonts");
const REPO_ROOT = P.CODE ? path.resolve(P.ROOT, "..") : P.ROOT; // حيث LICENSE و NOTICE
const CREDITS = "CREDITS.txt";

// حدود الحجم كما في التصميم، ما لم يعلنها الفهرس (C.FONT_MAX_BYTES …) فتُقدَّم قيمه
const DEF = { FONT_MAX_BYTES: 184320, FONT_BUDGET_BYTES: 409600, FONT_CACHE_MAX_CHARS: 250000 };
const RESERVED_IDS = new Set(["site", "system"]);
const ID_RE = /^[a-z0-9-]+$/;
const OFL_TITLE = "SIL OPEN FONT LICENSE Version 1.1";
// لا يُجلب إلا من هذين الشكلين: ملف woff2 على مضيف Google للخطوط، وترخيصٌ من google/fonts على التزامٍ مثبَّت
const FONT_URL_RE = /^https:\/\/fonts\.gstatic\.com\/s\/[a-z0-9]+\/v\d+\/[A-Za-z0-9_-]+\.woff2$/;
const licenceUrlRe = (commit) => new RegExp("^https://raw\\.githubusercontent\\.com/google/fonts/" + commit + "/ofl/[a-z0-9]+/OFL\\.txt$");
// لقطة CSS كل نطاق (مجلد العمل وحده؛ لا تُنشر) — كما في rtl-audit.mjs
const SNAP_DIR = { app: "sitecss", support: "sitecss-intercom", privacy: "sitecss-intercom", docs: "sitecss-docs", code: "sitecss-code",
  legal: "sitecss-legal", academy: "sitecss-academy" };
const snapPath = (dir) => path.resolve(HERE, "..", dir); // code/<لقطة> في العمل، و <الجذر>/<لقطة> في النشر إن أنشأها المساهم
const BLOCK_0590 = /[\u0590-\u05FF]/; // الكتلة ممنوعةٌ في نصوص المشروع كلها (قاعدة المالك)

// ───────────────────────────── أدوات عامة ─────────────────────────────
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const fmtN = (n) => n.toLocaleString("en-US");

export function readLock(p = LOCK_PATH) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
// JSON بمسافتين، والمصفوفات القصيرة من القيم البسيطة على سطرٍ واحد — تنسيقٌ ثابت فلا ضجيج في الفروق
export function formatLock(lock) {
  return JSON.stringify(lock, null, 2).replace(/\[\n\s*([^\[\]{}]*?)\n\s*\]/g, (m, inner) => {
    const one = "[" + inner.split(/,\n\s*/).join(", ") + "]";
    return one.length <= 100 ? one : m;
  }) + "\n";
}

// التاريخ اليوم بتوقيت الرياض: هجريًّا (أم القرى، بالأرقام الهندية) وميلاديًّا (ISO)
export function today(d = new Date()) {
  const parts = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab",
    { timeZone: "Asia/Riyadh", day: "numeric", month: "long", year: "numeric" }).formatToParts(d);
  const get = (t) => (parts.find((p) => p.type === t) || {}).value;
  const gregorian = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return { hijri: `${get("day")} ${get("month")} ${get("year")}هـ`, gregorian };
}

// ───────────────────────────── WOFF2 ─────────────────────────────
// قراءةٌ دنيا تكفي للتحقق: الترويسة، ودليل الجداول، وفكّ brotli، ثم محاور fvar ونسخة الخط من name.
const TAGS = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ",
  "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB",
  "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar",
  "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf",
  "Glat", "Gloc", "Feat", "Sill"];

function base128(buf, pos) {
  let v = 0;
  for (let i = 0; i < 5; i++) {
    if (pos.i >= buf.length) throw new Error("دليل الجداول مبتور");
    const b = buf[pos.i++];
    if (i === 0 && b === 0x80) throw new Error("UIntBase128 يبدأ بصفر");
    v = v * 128 + (b & 0x7f);
    if (v > 0xffffffff) throw new Error("UIntBase128 يفيض");
    if (!(b & 0x80)) return v;
  }
  throw new Error("UIntBase128 أطول من خمسة بايتات");
}

function parseFvar(d) {
  if (!d) return [];
  const off = d.readUInt16BE(4), count = d.readUInt16BE(8), size = d.readUInt16BE(10);
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const axes = [];
  for (let i = 0; i < count; i++) {
    const o = off + i * size;
    axes.push({ tag: d.toString("binary", o, o + 4), min: r3(d.readInt32BE(o + 4) / 65536),
      default: r3(d.readInt32BE(o + 8) / 65536), max: r3(d.readInt32BE(o + 12) / 65536) });
  }
  return axes;
}

function parseNameVersion(d) {
  if (!d) return null;
  const count = d.readUInt16BE(2), strOff = d.readUInt16BE(4);
  let best = null;
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    const plat = d.readUInt16BE(r), enc = d.readUInt16BE(r + 2), lang = d.readUInt16BE(r + 4);
    const id = d.readUInt16BE(r + 6), len = d.readUInt16BE(r + 8), o = strOff + d.readUInt16BE(r + 10);
    if (id !== 5) continue;
    const raw = Buffer.from(d.subarray(o, o + len));
    if (plat === 3 && (enc === 1 || enc === 10)) {
      const s = raw.swap16().toString("utf16le");
      if (!best || lang === 0x409) best = s;
    } else if (plat === 1 && !best) best = raw.toString("binary");
  }
  return best;
}

export function woff2Info(buf) {
  if (buf.length < 48 || buf.toString("binary", 0, 4) !== "wOF2") throw new Error("ليس WOFF2: الترويسة ليست wOF2");
  const flavor = buf.toString("binary", 4, 8);
  if (flavor === "ttcf") throw new Error("مجموعة خطوط (ttcf) لا يقبلها القفل");
  if (buf.readUInt32BE(8) !== buf.length) throw new Error(`الطول في الترويسة ${buf.readUInt32BE(8)} والملف ${buf.length}`);
  const numTables = buf.readUInt16BE(12), compLen = buf.readUInt32BE(20);
  const pos = { i: 48 }, tables = [];
  for (let t = 0; t < numTables; t++) {
    const flags = buf[pos.i++];
    const idx = flags & 0x3f, ver = flags >> 6;
    const tag = idx === 63 ? buf.toString("binary", pos.i, (pos.i += 4)) : TAGS[idx];
    const orig = base128(buf, pos);
    // glyf و loca: الإصدار 0 هو المحوَّل؛ وغيرهما: كل إصدارٍ غير 0 محوَّل
    const transformed = tag === "glyf" || tag === "loca" ? ver === 0 : ver !== 0;
    tables.push({ tag, transformed, len: transformed ? base128(buf, pos) : orig });
  }
  if (pos.i + compLen > buf.length) throw new Error("البيانات المضغوطة أطول من الملف");
  let data;
  try { data = zlib.brotliDecompressSync(buf.subarray(pos.i, pos.i + compLen)); }
  catch (e) { throw new Error("لا يُفكّ ضغط brotli: " + e.message); }
  let off = 0;
  for (const t of tables) { t.off = off; off += t.len; }
  if (off !== data.length) throw new Error(`أطوال الجداول ${off} والمفكوك ${data.length}`);
  const table = (tag) => {
    const t = tables.find((x) => x.tag === tag);
    return t && !t.transformed ? data.subarray(t.off, t.off + t.len) : null;
  };
  return { flavor, tables: tables.map((t) => t.tag), axes: parseFvar(table("fvar")), version: parseNameVersion(table("name")) };
}

// ───────────────────────────── الترخيص ─────────────────────────────
// نصُّ OFL 1.1 حرفيًّا، وفي رأسه (قبل العنوان) سطر الحقوق المتوقَّع، والأسماء المحجوزة فيه هي ما في القفل ولا تحجز اسم الخط نفسه
export function licenceProblems(text, entry) {
  const errs = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const ti = lines.findIndex((l) => l.trim().startsWith(OFL_TITLE));
  if (ti < 0) errs.push(`ليس نصَّ SIL OFL 1.1 (العنوان «${OFL_TITLE}» غائب)`);
  const head = lines.slice(0, ti < 0 ? lines.length : ti).map((l) => l.trim());
  if (!head.includes(entry.copyright)) errs.push("سطر الحقوق المتوقَّع غائبٌ من رأس الترخيص: " + entry.copyright);
  const rfn = [];
  for (const l of head) {
    const m = /Reserved Font Names?\s+(.*)$/i.exec(l);
    if (m) for (const q of m[1].matchAll(/[“"]([^”"]+)[”"]/g)) rfn.push(q[1]);
  }
  const want = entry.reservedFontNames || [];
  if (JSON.stringify([...rfn].sort()) !== JSON.stringify([...want].sort()))
    errs.push(`الأسماء المحجوزة في الترخيص ${JSON.stringify(rfn)} والقفل ${JSON.stringify(want)}`);
  if (rfn.some((n) => n.toLowerCase() === String(entry.family).toLowerCase())) errs.push("الترخيص يحجز اسم الخط نفسه، فلا يُشحن باسمه");
  return errs;
}

// ───────────────────────────── بنية القفل ─────────────────────────────
function wghtOf(e) {
  return Array.isArray(e.wght) && e.wght.length === 2 && e.wght.every((n) => typeof n === "number") ? e.wght : null;
}

export function lockProblems(lock) {
  const errs = [];
  if (!lock || lock.format !== 1) return ["القفل بلا format: 1"];
  const commit = lock.source && lock.source.licenceCommit;
  if (!/^[0-9a-f]{40}$/.test(commit || "")) errs.push("source.licenceCommit ليس التزامًا كاملًا (40 حرفًا ست عشريًّا)");
  if (!Array.isArray(lock.fonts) || !lock.fonts.length) return errs.concat("القفل بلا خطوط");
  const ids = new Set(), fams = new Set(), urls = new Set();
  const licRe = licenceUrlRe(commit || "x");
  for (const e of lock.fonts) {
    const id = e.id;
    if (typeof id !== "string" || !ID_RE.test(id)) { errs.push("معرّفٌ غير صالح: " + JSON.stringify(id)); continue; }
    if (RESERVED_IDS.has(id)) errs.push(id + ": معرّفٌ محجوز");
    if (ids.has(id)) errs.push(id + ": معرّفٌ مكرّر");
    ids.add(id);
    if (typeof e.family !== "string" || !e.family.trim()) errs.push(id + ": بلا family");
    else if (fams.has(e.family.toLowerCase())) errs.push(id + ": العائلة مكرّرة: " + e.family); else fams.add(e.family.toLowerCase());
    if (!FONT_URL_RE.test(e.url || "")) errs.push(id + ": رابط الخط ليس ملف woff2 على fonts.gstatic.com: " + e.url);
    if (!licRe.test(e.licenceUrl || "")) errs.push(id + ": رابط الترخيص ليس OFL.txt في google/fonts على الالتزام المثبَّت: " + e.licenceUrl);
    for (const u of [e.url, e.licenceUrl]) { if (urls.has(u)) errs.push(id + ": رابطٌ مكرّر: " + u); urls.add(u); }
    for (const k of ["bytes", "licenceBytes"]) if (!Number.isInteger(e[k]) || e[k] <= 0) errs.push(id + ": " + k + " ليس عددًا صحيحًا موجبًا");
    const w = wghtOf(e);
    if (!w) errs.push(id + ": wght ليس [أدنى، أعلى]");
    else if (!(w[0] <= 400 && w[1] >= 700)) errs.push(`${id}: محور wght ${w[0]}–${w[1]} لا يغطي 400–700`);
    if (!/^Copyright /.test(e.copyright || "")) errs.push(id + ": سطر الحقوق لا يبدأ بـ Copyright");
    if (!Array.isArray(e.reservedFontNames)) errs.push(id + ": reservedFontNames ليس مصفوفة");
    else if (e.reservedFontNames.some((n) => String(n).toLowerCase() === String(e.family).toLowerCase())) errs.push(id + ": اسمه محجوز في رخصته");
    for (const k of ["sha256", "licenceSha256"]) if (e[k] != null && !/^[0-9a-f]{64}$/.test(e[k])) errs.push(id + ": " + k + " ليس sha256");
  }
  return errs;
}

// ───────────────────────────── CREDITS.txt ─────────────────────────────
export function creditsText(lock) {
  const fonts = lock.fonts;
  for (const f of fonts) {
    if (!f.fetched || !/^\d{4}-\d{2}-\d{2}$/.test(f.fetched.gregorian || "")) throw new Error(f.id + ": لا تاريخ تنزيلٍ في القفل — شغّل fetch --approved أولًا");
    if ((f.reservedFontNames || []).some((n) => n.toLowerCase() === f.family.toLowerCase())) throw new Error(f.id + ": اسمه محجوز، ونصّ النسبة يقول غير ذلك");
  }
  const dates = [...new Set(fonts.map((f) => f.fetched.gregorian))].sort();
  const one = dates.length === 1;
  const head = [
    "Arabic fonts bundled with this extension",
    "These font files are NOT covered by the extension's MIT licence. Each is licensed under the",
    "SIL Open Font License, Version 1.1; its full text, with its copyright notice, is in the file named below.",
    `They are the Arabic-subset WOFF2 files served by Google Fonts (https://fonts.google.com), downloaded on ${one ? dates[0] : "the date shown after each entry"}.`,
    "Subsetting makes them Modified Versions under the OFL; they remain under the OFL and keep their names,",
    "because none of these names is a Reserved Font Name. They are not sold separately.",
    "",
  ];
  const rows = fonts.map((f) => [f.id + ".woff2", f.family, f.copyright, f.id + ".OFL.txt" + (one ? "" : `  (downloaded ${f.fetched.gregorian})`)]);
  const w = [0, 1, 2].map((i) => Math.max(...rows.map((r) => r[i].length)) + 3);
  return head.concat(rows.map((r) => r[0].padEnd(w[0]) + r[1].padEnd(w[1]) + r[2].padEnd(w[2]) + r[3])).join("\n") + "\n";
}

// ───────────────────────────── fetch --approved ─────────────────────────────
// طلب GET واحد بلا اتباعٍ للتحويل (أي حالٍ غير 200 رفض)، وبلا ضغطٍ في النقل (البايتات كما هي)، وبسقف الحجم المسجَّل
function download(url, maxBytes) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    const req = https.get(url, { headers: { "user-agent": "fonts.mjs", "accept-encoding": "identity" }, timeout: 30000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); finish({ status: res.statusCode, body: null }); return; }
      const chunks = [];
      let n = 0, over = false;
      res.on("data", (c) => {
        n += c.length;
        if (n > maxBytes) { over = true; req.destroy(); } else chunks.push(c);
      });
      res.on("end", () => finish({ status: 200, body: over ? null : Buffer.concat(chunks), over }));
      res.on("error", (e) => finish({ status: 200, body: null, over, error: over ? null : e.message }));
      res.on("close", () => finish({ status: 200, body: null, over, error: over ? null : "انقطع النقل" }));
    });
    req.on("timeout", () => req.destroy(new Error("انقضت المهلة")));
    req.on("error", (e) => finish({ status: 0, body: null, error: e.message }));
  });
}

async function cmdFetch(args) {
  if (process.env.CI || process.env.GITHUB_ACTIONS) { console.error("✗ fetch لا يعمل في CI: الخطوط تُجلب يدويًّا بعد الموافقة، ثم تُودَع"); return 1; }
  if (!args.includes("--approved")) {
    console.error("✗ fetch يحتاج --approved: يجلب ملفات القفل من الشبكة، فلا يعمل إلا بعد موافقة المالك على القائمة");
    return 2;
  }
  const lock = readLock();
  const bad = lockProblems(lock);
  if (bad.length) { console.error("✗ القفل مختلّ — لم يُجلب شيء:\n  - " + bad.join("\n  - ")); return 1; }

  const got = [], errs = [];
  for (const e of lock.fonts) {
    for (const kind of ["font", "licence"]) {
      const url = kind === "font" ? e.url : e.licenceUrl;
      const want = kind === "font" ? e.bytes : e.licenceBytes;
      const file = e.id + (kind === "font" ? ".woff2" : ".OFL.txt");
      const r = await download(url, want);
      const row = { id: e.id, kind, file, status: r.status, bytes: r.body ? r.body.length : null, sha: r.body ? sha256(r.body) : null, body: r.body };
      got.push(row);
      const why = [];
      if (r.status !== 200) why.push("الحال " + r.status + (r.error ? " (" + r.error + ")" : ""));
      else if (r.over) why.push("أكبر من " + want + " بايت");
      else if (!r.body) why.push("انقطع النقل" + (r.error ? ": " + r.error : ""));
      else if (r.body.length !== want) why.push(`الحجم ${r.body.length} والقفل ${want}`);
      else if (kind === "font") {
        try {
          const info = woff2Info(r.body);
          const ax = info.axes.find((a) => a.tag === "wght");
          if (!ax) why.push("لا محور wght في fvar");
          else if (ax.min !== e.wght[0] || ax.max !== e.wght[1]) why.push(`محور wght في الملف ${ax.min}–${ax.max} والقفل ${e.wght.join("–")}`);
          row.info = info;
        } catch (x) { why.push(x.message); }
      } else {
        why.push(...licenceProblems(r.body.toString("utf8"), e));
      }
      const pinned = kind === "font" ? e.sha256 : e.licenceSha256;
      if (!why.length && pinned && pinned !== row.sha) why.push("البصمة تغيّرت عند المصدر (القفل " + pinned.slice(0, 16) + "…) — يلزم فحصٌ وموافقةٌ جديدان");
      row.why = why;
      if (why.length) errs.push(`${file}: ${why.join("؛ ")}`);
    }
  }
  printFetchTable(got);
  if (errs.length) {
    console.error("\n✗ رُفض التنزيل — لم يُكتب شيء:\n  - " + errs.join("\n  - "));
    return 1;
  }

  // الكتابة بعد اجتياز الملفات كلها: لا ملفٌّ جزئي ولا قفلٌ نصف محدَّث
  fs.mkdirSync(FONTS_DIR, { recursive: true });
  const when = today();
  let wrote = 0, lockChanged = false;
  for (const row of got) {
    const fp = path.join(FONTS_DIR, row.file);
    const onDisk = fs.existsSync(fp) ? sha256(fs.readFileSync(fp)) : null;
    if (onDisk !== row.sha) { fs.writeFileSync(fp, row.body); wrote++; row.written = true; }
    const e = lock.fonts.find((x) => x.id === row.id);
    const key = row.kind === "font" ? "sha256" : "licenceSha256";
    if (e[key] !== row.sha) { e[key] = row.sha; e.fetched = when; lockChanged = true; }
    if (row.kind === "font") {
      const axes = row.info.axes, version = row.info.version;
      if (JSON.stringify(e.axes) !== JSON.stringify(axes)) { e.axes = axes; lockChanged = true; }
      if (version && e.fontVersion !== version) { e.fontVersion = version; lockChanged = true; }
    }
  }
  if (lockChanged) {
    // ترتيبٌ ثابت للحقول: ما كتبه الإنسان أولًا، ثم ما يملؤه التنزيل
    const ORDER = ["id", "family", "css", "url", "bytes", "sha256", "wght", "axes", "fontVersion", "licenceUrl", "licenceBytes",
      "licenceSha256", "copyright", "reservedFontNames", "fetched"];
    lock.fonts = lock.fonts.map((e) => {
      const o = {};
      for (const k of ORDER) if (k in e) o[k] = e[k];
      for (const k of Object.keys(e)) if (!(k in o)) o[k] = e[k];
      return o;
    });
    fs.writeFileSync(LOCK_PATH, formatLock(lock), "utf8");
  }
  console.log(`\n✓ ${got.length} ملفًّا اجتازت الفحص؛ كُتب منها ${wrote}` + (lockChanged ? `، وحُدِّث القفل (${when.hijri} = ${when.gregorian})` : "، والقفل كما هو (البصمات لم تتغيّر)"));
  return 0;
}

function printFetchTable(rows) {
  console.log("الملف".padEnd(26) + "الحال  " + "البايتات".padStart(9) + "  sha256");
  for (const r of rows) {
    console.log(r.file.padEnd(26) + String(r.status).padEnd(7) + (r.bytes == null ? "—" : fmtN(r.bytes)).padStart(9) + "  " + (r.sha || "—") + (r.why && r.why.length ? "  ✗" : ""));
  }
}

// ───────────────────────────── فحص CSS اللقطات ─────────────────────────────
// ماسحٌ خطّي للكتل الداخلية: لكل كتلةٍ لا كتلة داخلها تمهيدُها (المحدِّد أو @font-face) ونصُّها
export function innerBlocks(css) {
  const s = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [], stack = [];
  let mark = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") { stack.push({ prelude: s.slice(mark, i).trim(), start: i + 1, nested: false }); if (stack.length > 1) stack[stack.length - 2].nested = true; mark = i + 1; }
    else if (ch === "}") {
      const b = stack.pop();
      if (b && !b.nested) out.push({ prelude: b.prelude, body: s.slice(b.start, i) });
      mark = i + 1;
    } else if (ch === ";") mark = i + 1;
  }
  return out;
}
function snapshotCss() {
  const res = {};
  for (const dir of new Set(Object.values(SNAP_DIR))) {
    const p = snapPath(dir);
    let files = [];
    try { files = fs.readdirSync(p).filter((f) => f.endsWith(".css")).sort(); } catch {}
    if (files.length) res[dir] = files.map((f) => ({ file: dir + "/" + f, css: fs.readFileSync(path.join(p, f), "utf8") }));
  }
  return res;
}
function declFamilies(body) {
  const out = [];
  for (const d of body.split(";")) {
    const m = /^\s*font-family\s*:\s*([\s\S]+?)\s*$/i.exec(d);
    if (m) out.push(m[1].replace(/\s*!important$/i, ""));
  }
  return out;
}
const LANG_AR = (prelude) => {
  for (const m of prelude.matchAll(/:lang\(([^)]*)\)/gi))
    if (m[1].split(",").some((x) => /^ar(-|$)/i.test(x.trim().replace(/^["']|["']$/g, "")))) return true;
  for (const m of prelude.matchAll(/\[\s*lang\s*[|^]?=\s*["']?([^"'\]\s]+)/gi)) if (/^ar(-|$)/i.test(m[1])) return true;
  return false;
};
const TOUCHES_FONT = (body) => body.split(";").some((d) => /^\s*(--font-[\w-]*|font-family|font)\s*:/i.test(d));

// ───────────────────────────── verify ─────────────────────────────
function rangesOf(str) {
  const out = [];
  for (const part of String(str).split(",")) {
    const m = /^\s*U\+([0-9A-F]{1,6})(?:-([0-9A-F]{1,6}))?\s*$/i.exec(part);
    if (!m) return null;
    out.push([parseInt(m[1], 16), parseInt(m[2] || m[1], 16)]);
  }
  return out;
}
const near = (a, b, tol) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol;

export async function verifyFonts({ release = false } = {}) {
  const errors = [], pending = [], notes = [];
  const err = (m) => errors.push(m);
  const pend = (m) => (release ? errors : pending).push(m);

  await import(pathToFileURL(path.join(P.EXT, "cml-const.js")).href);
  const C = globalThis.CMLConst || {};
  try { await import(pathToFileURL(path.join(P.EXT, "cml-shared.js")).href); } catch (e) { err("cml-shared.js لا يُحمَّل: " + e.message); }
  const SH = globalThis.CMLShared || {};
  const lim = (k) => (typeof C[k] === "number" ? C[k] : DEF[k]);

  // ---- القفل ----
  let lock = null;
  try { lock = readLock(); } catch (e) { err("القفل لا يُقرأ (" + path.basename(LOCK_PATH) + "): " + e.message); }
  if (!lock) return { ok: false, errors, pending, notes };
  lockProblems(lock).forEach(err);
  if (BLOCK_0590.test(fs.readFileSync(LOCK_PATH, "utf8"))) err("القفل فيه محرفٌ من الكتلة U+0590–05FF");
  const fonts = Array.isArray(lock.fonts) ? lock.fonts : [];

  // ---- الملفات: كل ملفٍّ موجود، يبدأ بـ wOF2، بطوله وبصمته، ومحوره كما في القفل ----
  let total = 0;
  for (const e of fonts) {
    if (!e.sha256 || !e.licenceSha256) { err(e.id + ": لا بصمة في القفل — لم يُنزَّل (fetch --approved)"); continue; }
    const fp = path.join(FONTS_DIR, e.id + ".woff2");
    if (!fs.existsSync(fp)) { err("fonts/" + e.id + ".woff2 مفقود"); continue; }
    const b = fs.readFileSync(fp);
    total += b.length;
    if (b.length !== e.bytes) err(`${e.id}.woff2: ${b.length} بايت والقفل ${e.bytes}`);
    if (sha256(b) !== e.sha256) err(e.id + ".woff2: البصمة لا تطابق القفل");
    if (b.length > lim("FONT_MAX_BYTES")) err(`${e.id}.woff2: ${b.length} بايت فوق الحد ${lim("FONT_MAX_BYTES")}`);
    if (Math.ceil(b.length / 3) * 4 > lim("FONT_CACHE_MAX_CHARS")) err(`${e.id}: نسخة base64 تتجاوز ${lim("FONT_CACHE_MAX_CHARS")} حرفًا`);
    try {
      const info = woff2Info(b);
      const ax = info.axes.find((a) => a.tag === "wght");
      const w = wghtOf(e);
      if (!ax) err(e.id + ": لا محور wght في الملف — ليس متغيّرًا");
      else if (w && (ax.min !== w[0] || ax.max !== w[1])) err(`${e.id}: محور wght في الملف ${ax.min}–${ax.max} والقفل ${w.join("–")}`);
      if (e.axes && JSON.stringify(e.axes) !== JSON.stringify(info.axes)) err(e.id + ": محاور الملف غير المسجّلة في القفل");
    } catch (x) { err(e.id + ".woff2: " + x.message); }
    const lp = path.join(FONTS_DIR, e.id + ".OFL.txt");
    if (!fs.existsSync(lp)) { err("fonts/" + e.id + ".OFL.txt مفقود"); continue; }
    const lb = fs.readFileSync(lp);
    if (sha256(lb) !== e.licenceSha256) {
      // النص حرفيٌّ بنهايات CRLF؛ فإن طابق بعد إعادتها فالتحويل من git لا من المصدر
      const crlf = Buffer.from(lb.toString("binary").replace(/\r?\n/g, "\r\n"), "binary");
      err(e.id + ".OFL.txt: " + (sha256(crlf) === e.licenceSha256
        ? "حُوِّلت نهايات أسطره (CRLF) — يلزم «*.OFL.txt -text» في .gitattributes"
        : `البصمة لا تطابق القفل (${lb.length} بايت والقفل ${e.licenceBytes})`));
    }
    licenceProblems(lb.toString("utf8"), e).forEach((m) => err(e.id + ".OFL.txt: " + m));
  }
  if (total > lim("FONT_BUDGET_BYTES")) err(`مجموع الخطوط ${total} بايت فوق الميزانية ${lim("FONT_BUDGET_BYTES")}`);

  // ---- النسبة، ولا ملف شاردًا في fonts/ ----
  try {
    const want = creditsText(lock), cp = path.join(FONTS_DIR, CREDITS);
    if (!fs.existsSync(cp)) err("fonts/CREDITS.txt مفقود — شغّل fonts.mjs credits");
    else if (fs.readFileSync(cp, "utf8").replace(/\r\n/g, "\n") !== want) err("fonts/CREDITS.txt لا يطابق ما يولّده القفل — شغّل fonts.mjs credits");
  } catch (x) { err("CREDITS: " + x.message); }
  if (fs.existsSync(FONTS_DIR)) {
    const allowed = new Set([CREDITS, ...fonts.flatMap((e) => [e.id + ".woff2", e.id + ".OFL.txt"])]);
    for (const ent of fs.readdirSync(FONTS_DIR, { withFileTypes: true })) {
      if (ent.isDirectory() || !allowed.has(ent.name)) err("ملفٌّ شارد في fonts/: " + ent.name);
      else if (/\.txt$/.test(ent.name) && BLOCK_0590.test(fs.readFileSync(path.join(FONTS_DIR, ent.name), "utf8"))) err("fonts/" + ent.name + ": محرفٌ من الكتلة U+0590–05FF");
    }
  }

  // ---- المانيفست: الأذون [storage] وحدها، ولا WAR ولا CSP ----
  try {
    const mf = JSON.parse(fs.readFileSync(path.join(P.EXT, "manifest.json"), "utf8"));
    if (JSON.stringify(mf.permissions) !== JSON.stringify(["storage"])) err("الأذون ليست [\"storage\"] وحدها: " + JSON.stringify(mf.permissions));
    for (const k of ["web_accessible_resources", "content_security_policy"]) if (k in mf) err("المانيفست فيه " + k + " — الخط يبلغ الصفحات عبر التخزين لا عبر عنوان");
  } catch (x) { err("manifest.json: " + x.message); }

  // ---- الفهرس في cml-const.js ----
  const cat = Array.isArray(C.FONTS) ? C.FONTS : null;
  const ext = []; // نصوص الإضافة (للمنع أدناه)
  (function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, ent.name);
      if (ent.isDirectory()) walk(fp);
      else if (/\.(js|css|html|json|txt|md)$/i.test(ent.name)) ext.push(fp);
    }
  })(P.EXT);
  const cmlFont = [];
  // ★ (القرار 77، ٢٨ ربيع الآخر ١٤٤٨هـ) فحص مضيف خطوط Google على ملفات الإضافة التي تُحمَّل فعلًا، دون قطع المتون (bodies/):
  // القطعة بياناتٌ يقرؤها العامل ويُدرج نصَّها في الصفحة، ولا تُحمَّل موردًا؛ وكتلٌ من متون Claude Code تذكر المضيف نصًّا
  // في قوائم النطاقات المسموح بها للشبكة. وغرض الفحص باقٍ: لا سكربت ولا ورقة أنماط ولا صفحة في الحزمة تشير إلى المضيف
  const BODIES = path.join(P.EXT, "bodies") + path.sep;
  for (const fp of ext) {
    const t = fs.readFileSync(fp, "utf8");
    if (!fp.startsWith(BODIES) && /fonts\.(googleapis|gstatic)\.com/i.test(t)) err("مضيف خطوط Google في الحزمة: " + path.relative(P.EXT, fp));
    if (t.includes("--cml-font")) cmlFont.push(path.relative(P.EXT, fp));
  }
  if (!cat) {
    pend("الفهرس C.FONTS غائبٌ عن cml-const.js (يُكتب بعد المعايرة) — فحوص الفهرس (المعرّفات ومطابقة القفل والافتراضي) معلَّقة");
    if (cmlFont.length) pend("الخط القديم --cml-font باقٍ في: " + cmlFont.join("، ") + " (يُحذف مع الفهرس)");
  } else {
    if (cmlFont.length) err("الخط القديم --cml-font باقٍ في: " + cmlFont.join("، "));
    const byId = new Map(fonts.map((e) => [e.id, e]));
    const seen = new Set();
    for (const f of cat) {
      if (!f || typeof f.id !== "string" || !ID_RE.test(f.id)) { err("معرّفٌ غير صالح في الفهرس: " + JSON.stringify(f && f.id)); continue; }
      if (RESERVED_IDS.has(f.id)) err(f.id + ": معرّفٌ محجوز في الفهرس");
      if (seen.has(f.id)) err(f.id + ": مكرّرٌ في الفهرس");
      seen.add(f.id);
      const e = byId.get(f.id);
      if (!e) { err(f.id + ": في الفهرس وليس في القفل"); continue; }
      if (f.family !== e.family) err(`${f.id}: العائلة في الفهرس «${f.family}» والقفل «${e.family}»`);
      if (f.file !== "fonts/" + f.id + ".woff2") err(f.id + ": file ليس fonts/" + f.id + ".woff2");
      if (f.bytes !== e.bytes) err(`${f.id}: bytes في الفهرس ${f.bytes} والقفل ${e.bytes}`);
      if (typeof f.sha !== "string" || !/^[0-9a-f]{8,64}$/.test(f.sha) || !(e.sha256 || "").startsWith(f.sha)) err(f.id + ": sha في الفهرس ليس بادئةً لبصمة القفل");
      if (JSON.stringify(f.wght) !== JSON.stringify(e.wght)) err(`${f.id}: wght في الفهرس ${JSON.stringify(f.wght)} والقفل ${JSON.stringify(e.wght)}`);
      if (f.provisional) (release ? err : (m) => notes.push(m))(f.id + ": قيمه مبدئية (provisional)" + (release ? " — لا تُشحن" : ""));
    }
    for (const e of fonts) if (!seen.has(e.id)) err(e.id + ": في القفل وليس في الفهرس");
    if (!seen.has(C.FONT_DEFAULT)) err("FONT_DEFAULT ليس في الفهرس: " + JSON.stringify(C.FONT_DEFAULT));
    if (C.FONT_SITE !== "site") err("FONT_SITE ليس \"site\"");
    if (C.FONT_SYSTEM !== undefined && C.FONT_SYSTEM !== "system") err("FONT_SYSTEM ليس \"system\"");
  }

  // ---- المدى: لا يمسّ الحروف الإنجليزية وامتداداتها (U+0000-024F) ولا الشرطتين (U+2010-2011)، ويشمل U+0600-06FF ----
  if (C.FONT_AR_RANGE === undefined) { if (cat) err("FONT_AR_RANGE غائب"); }
  else {
    const rs = rangesOf(C.FONT_AR_RANGE);
    if (!rs) err("FONT_AR_RANGE لا يُحلَّل: " + C.FONT_AR_RANGE);
    else {
      const hit = (lo, hi) => rs.some(([a, b]) => a <= hi && b >= lo);
      if (hit(0x0000, 0x024f)) err("FONT_AR_RANGE يمسّ U+0000–024F");
      if (hit(0x2010, 0x2011)) err("FONT_AR_RANGE يمسّ U+2010–2011");
      const merged = rs.slice().sort((x, y) => x[0] - y[0]).reduce((acc, [a, b]) => {
        const last = acc[acc.length - 1];
        if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b); else acc.push([a, b]);
        return acc;
      }, []);
      if (!merged.some(([a, b]) => a <= 0x0600 && b >= 0x06ff)) err("FONT_AR_RANGE لا يشمل U+0600–06FF كله");
    }
  }

  // ---- المعايرة: صندوق العلامة، وقيم m، والقصّ لا يزيد على خط النظام عند كل ارتفاع ----
  const calibrated = fonts.filter((e) => e.calib);
  if (!calibrated.length) pend("المعايرة لم تُسجَّل في القفل بعد (calib لكل خط، و reference.B)");
  else {
    for (const e of fonts) if (!e.calib) err(e.id + ": بلا تقرير معايرة (calib) وغيره معايَر");
    const B = lock.reference && lock.reference.B;
    for (const role of ["ui", "read"]) {
      const b = B && B[role];
      if (!b || !["x", "asc", "desc"].every((k) => typeof b[k] === "number" && b[k] > 0)) err(`reference.B.${role} ليس {x, asc, desc} أعدادًا موجبة`);
    }
    for (const e of calibrated) {
      const m = e.calib.m || {};
      for (const role of ["ui", "read"]) {
        const v = m[role], b = B && B[role];
        if (!v || !["s", "a", "d"].every((k) => typeof v[k] === "number" && isFinite(v[k]))) { err(`${e.id}: m.${role} ليس {s, a, d} أعدادًا`); continue; }
        if (!(v.s >= 0.9 && v.s <= 1.2)) err(`${e.id}: s للدور ${role} = ${v.s} خارج [0.90، 1.20]`);
        if (b && !near(v.a * v.s, b.asc, 0.005)) err(`${e.id}: a×s للدور ${role} = ${(v.a * v.s).toFixed(4)} و B.asc ${b.asc}`);
        if (b && !near(v.d * v.s, b.desc, 0.005)) err(`${e.id}: d×s للدور ${role} = ${(v.d * v.s).toFixed(4)} و B.desc ${b.desc}`);
      }
      const hs = e.calib.heights;
      if (!Array.isArray(hs) || !hs.length) err(e.id + ": تقرير المعايرة بلا ارتفاعات");
      else for (const h of hs) {
        const tag = `${e.id} @ ${h.px}/${h.lh}`;
        if (![h.share, h.deepest].every((x) => typeof x === "number") || !h.ref || ![h.ref.share, h.ref.deepest].every((x) => typeof x === "number")) { err(tag + ": أرقام القصّ ناقصة"); continue; }
        if (h.share > h.ref.share + 1e-9) err(`${tag}: يُقصّ ${(h.share * 100).toFixed(1)}٪ وخط النظام ${(h.ref.share * 100).toFixed(1)}٪`);
        if (h.deepest > h.ref.deepest + 1e-9) err(`${tag}: أعمق قصٍّ ${h.deepest} بكسل وخط النظام ${h.ref.deepest}`);
      }
      const f = cat && cat.find((x) => x.id === e.id);
      if (f && JSON.stringify(f.m) !== JSON.stringify(e.calib.m)) err(e.id + ": m في الفهرس لا تطابق تقرير المعايرة في القفل");
      // علاج القطع: الوجه المضغوط بين CLAMP_S_MIN و s الوجه الرئيس، بتجاوزي صندوق العلامة، ولا يقصّ أكثر من اليوم عند أزواجه
      for (const [c, x] of Object.entries(e.calib.clamp || {})) {
        if (x && x.today === true) continue;
        const tag = `${e.id} @ القطع ${c}`, b = B && B.ui, sMain = m.ui && m.ui.s;
        if (!x || ![x.s, x.a, x.d].every((v) => typeof v === "number" && isFinite(v))) { err(tag + ": ليس {s, a, d} ولا {today: true}"); continue; }
        if (!(x.s >= CLAMP_S_MIN && (sMain == null || x.s <= sMain))) err(`${tag}: s_c = ${x.s} خارج [${CLAMP_S_MIN}، ${sMain}]`);
        if (b && (!near(x.a * x.s, b.asc, 0.005) || !near(x.d * x.s, b.desc, 0.005))) err(tag + ": a×s_c و d×s_c لا يساويان صندوق العلامة");
        if (!Array.isArray(x.heights) || !x.heights.length) err(tag + ": بلا أزواج مقيسة");
        else for (const h of x.heights) if (!h.ref || h.share > h.ref.share + 1e-9 || h.deepest > h.ref.deepest + 1e-9)
          err(`${tag} ${h.px}/${h.lh}: يُقصّ ${(h.share * 100).toFixed(1)}٪/${h.deepest} واليوم ${h.ref ? (h.ref.share * 100).toFixed(1) + "٪/" + h.ref.deepest : "؟"}`);
      }
      if (f && f.clamp !== undefined) {
        const want = e.calib.clamp ? Object.fromEntries(Object.entries(e.calib.clamp).map(([c, x]) => [c, x.today ? null : { s: x.s, a: x.a, d: x.d }])) : null;
        if (JSON.stringify(f.clamp) !== JSON.stringify(want)) err(e.id + ": clamp في الفهرس لا يطابق تقرير المعايرة في القفل");
      }
    }
  }
  // علاج القطع بعدد الأسطر الذي قيست به المعايرة لم يتغيّر في *-point.css، ولا حصرُ أزواجه (fonts.clamp.json)
  const cf = lock.reference && lock.reference.clampFix;
  if (cf) {
    const now = readClampFix(cf.attr, P.EXT, C.FONT_AR_RANGE || DESIGN_AR_RANGE);
    if (now.errors.length) now.errors.forEach(err);
    else if (now.sig !== cf.sig) err(`علاج القطع بعدد الأسطر في *-point.css تغيّر بعد المعايرة (البصمة ${now.sig.slice(0, 12)} والقفل ${String(cf.sig).slice(0, 12)}) — أعد «fonts.mjs measure --apply»`);
    if (cf.data && fs.existsSync(CLAMP_PATH)) {
      try { const d = readClampData(); if (d.sig !== cf.data.sig) err(`fonts.clamp.json تغيّر بعد المعايرة (${d.sig.slice(0, 12)} والقفل ${String(cf.data.sig).slice(0, 12)}) — أعد «fonts.mjs measure --apply»`); }
      catch (x) { err("fonts.clamp.json: " + x.message); }
    } else if (cf.data) notes.push("fonts.clamp.json ليس هنا — فحص بصمة الحصر يجري في مجلد العمل وحده");
  }
  // العلاج النقطي الذي قيست به المعايرة لم يتغيّر في *-point.css (المصدر الوحيد): وإلا فالأرقام في القفل لا تصف المشحون
  const sf = lock.reference && lock.reference.spotFix;
  if (sf) {
    const now = readSpotFix(sf.attr);
    if (now.errors.length) now.errors.forEach(err);
    else if (now.sig !== sf.sig) err(`العلاج النقطي للقصّ في *-point.css تغيّر بعد المعايرة (البصمة ${now.sig.slice(0, 12)} والقفل ${String(sf.sig).slice(0, 12)}) — أعد «fonts.mjs measure --apply»`);
    if (C.FONT_ATTR && sf.attr !== C.FONT_ATTR) err(`العلاج معلَّقٌ على [${sf.attr}] والوحدة تكتب ${C.FONT_ATTR}`);
  }
  // الفهرس بلا معايرة: لا يُقبل إلا والقيم كلها موسومةٌ مبدئية، ولا يُشحن كذلك
  if (cat && !calibrated.length) {
    if (cat.length && cat.every((f) => f && f.provisional)) (release ? err : (m) => notes.push(m))("الفهرس كله مبدئي والقفل بلا معايرة");
    else err("الفهرس مكتوبٌ بقيمٍ غير موسومة مبدئية، والقفل بلا معايرة — لا يُبنى على قيمٍ غير مقيسة");
  }

  // ---- NOTICE في الجذر يستثني extension/fonts/ من رخصة MIT ----
  const np = path.join(REPO_ROOT, "NOTICE");
  if (!fs.existsSync(np)) pend("NOTICE غائبٌ عن الجذر (يستثني extension/fonts/ من رخصة MIT)");
  else {
    const t = fs.readFileSync(np, "utf8");
    if (!t.includes("extension/fonts/") || !/SIL Open Font License/.test(t)) err("NOTICE لا يستثني extension/fonts/ من رخصة MIT باسم SIL Open Font License");
  }

  // ---- القائمة المغلقة لعائلات كل نطاق (بنيةٌ تُفحص في البنيتين) ----
  const doms = (C.DOMAINS || []).filter((d) => d.meta && d.meta.fontFamilies);
  const namesOf = (d) => (Array.isArray(d.meta.fontFamilies) ? d.meta.fontFamilies : Object.keys(d.meta.fontFamilies));
  const normOk = typeof SH.normFamily === "function";
  const nf = (x) => String(SH.normFamily(x)).toLowerCase(); // المتصفح يطابق العائلات بلا حساسيةٍ لحالة الحروف
  if (!doms.length) pend("meta.fontFamilies غائبة عن جدول النطاقات — القائمة المغلقة وفحص الانجراف معلَّقان");
  else {
    for (const d of C.DOMAINS || []) if (!(d.meta && d.meta.fontFamilies)) err(d.id + ": بلا meta.fontFamilies وغيره معرَّف");
    if (!normOk) err("CMLShared.normFamily غائبة، والمطابقة لا تكون إلا مطبَّعة");
    else for (const d of doms) for (const n of namesOf(d))
      if (nf(n) !== String(n).toLowerCase()) err(`${d.id}: الاسم «${n}» في meta.fontFamilies غير مطبَّع`);
  }

  // ---- الانجراف وقواعد :lang(ar) في لقطات CSS المواقع (مجلد العمل وحده؛ لا تُنشر) ----
  const snaps = snapshotCss();
  if (!Object.keys(snaps).length) notes.push("لا لقطات CSS هنا — فحصا الانجراف و :lang(ar) يجريان في مجلد العمل وحده");
  else {
    const blocks = {};
    for (const [dir, files] of Object.entries(snaps)) blocks[dir] = files.map((f) => ({ file: f.file, blocks: innerBlocks(f.css) }));
    // قواعد :lang(ar) أو [lang=ar] تمسّ متغيّر خطٍّ أو font-family: فشلٌ إلا بقرارٍ مكتوب في القفل
    const decided = new Set((lock.langArDecisions || []).map((d) => d.file + "\u0000" + d.selector));
    let langHits = 0;
    for (const files of Object.values(blocks)) for (const f of files) for (const b of f.blocks) {
      if (!LANG_AR(b.prelude) || !TOUCHES_FONT(b.body)) continue;
      langHits++;
      if (!decided.has(f.file + "\u0000" + b.prelude)) err(`${f.file}: قاعدة «${b.prelude.slice(0, 120)}» تمسّ خط العربية — يلزم قرارٌ مكتوب في langArDecisions`);
    }
    notes.push(`قواعد :lang(ar) التي تمسّ الخط في اللقطات: ${langHits}`);
    // مرآة --cml-ff في كل ملف نقطةٍ فيه علاج القطع: مطابقةٌ لما تولّده لقطته اليوم (وإلا فقائمة خطٍّ قديمة تغيّر حرفًا إنجليزيًّا)
    const cfx = readClampFix(C.FONT_ATTR || "data-cml-font", P.EXT, C.FONT_AR_RANGE || DESIGN_AR_RANGE);
    cfx.errors.forEach(err);
    for (const [dir, e] of Object.entries(cfx.dirs)) {
      if (!blocks[dir]) continue;
      const css = fs.readFileSync(path.join(P.EXT, e.file), "utf8"), at = C.FONT_ATTR || "data-cml-font";
      const m = clampMirror(dir, { roots: clampRootsOf(css, at), fams: mirroredFamilies(dir, C), attr: at });
      if (m && withMirror(css, m.css) !== css) err(`${e.file}: مرآة ${CLAMP_VAR} لا تطابق لقطة ${dir}/ — شغّل «fonts.mjs clamp-css»`);
    }
    // الانجراف: كل عائلةٍ في meta.fontFamilies معلنةٌ في @font-face في لقطة نطاقها، مطبَّعةً على الطرفين
    if (doms.length && normOk) for (const d of doms) {
      const dir = SNAP_DIR[d.id];
      if (!dir) { err(d.id + ": نطاقٌ بلا لقطةٍ معروفة لفحص الانجراف"); continue; }
      if (!blocks[dir]) { notes.push(d.id + ": لا لقطة " + dir + " هنا — تخطّي الانجراف"); continue; }
      const declared = new Set();
      for (const f of blocks[dir]) for (const b of f.blocks)
        if (/^@font-face$/i.test(b.prelude)) for (const fam of declFamilies(b.body)) declared.add(nf(fam));
      for (const n of namesOf(d)) if (!declared.has(nf(n))) err(`${d.id}: العائلة «${n}» لم تعد معلنةً في @font-face في ${dir}/ — أعاد الموقع تسميتها؟`);
    }
    // ★ (ر5ب، ٢٩ ربيع الآخر ١٤٤٨هـ) «خط النظام»: رفيقات «<عائلةٍ من القائمة> Fallback» في لقطة كل نطاقٍ له meta.fontFallback مصدرُها local(<الاسم>)
    // حرفًا (منه تُبنى مراياها اللاتينية في cml-font.js)، وفيها رفيقةٌ واحدةٌ على الأقل — وإلا فالمرايا بخطٍّ غير خط الموقع
    if (doms.length && normOk) for (const d of doms) {
      const fbName = d.meta.fontFallback, dir = SNAP_DIR[d.id];
      if (fbName === undefined || !blocks[dir]) continue;
      const bases = new Set(namesOf(d).map((n) => nf(n) + " fallback"));
      const want = "local(" + nf(fbName) + ")";
      let seen = 0;
      for (const f of blocks[dir]) for (const b of f.blocks) {
        if (!/^@font-face$/i.test(b.prelude)) continue;
        const fam = declFamilies(b.body).map(nf).find((x) => bases.has(x));
        if (!fam) continue;
        seen++;
        const src = (/(?:^|;)\s*src\s*:\s*([^;]+)/i.exec(b.body) || [])[1] || "";
        const got = src.replace(/\s+/g, " ").trim().replace(/local\(\s*(["']?)([^"')]+)\1\s*\)/gi, (m, q, n) => "local(" + nf(n) + ")");
        if (got !== want) err(`${d.id}: رفيقة «${fam}» في ${dir}/ مصدرها ${src.trim()} لا ${want} (meta.fontFallback) — مرايا «خط النظام» اللاتينية لا تطابقها`);
      }
      if (!seen) err(`${d.id}: meta.fontFallback = «${fbName}» ولا رفيقة «<عائلة> Fallback» في @font-face في ${dir}/`);
    }
  }

  return { ok: !errors.length, errors, pending, notes, fonts: fonts.length, bytes: total };
}

// ═════════════════════════════ measure: المعايرة (§٤.٦ «الحبر مقابل الفسحة») ═════════════════════════════
// يدويٌّ لا يعمل في CI، ويشغّل كروم بلا واجهة (نسخةً واحدة في كل مرة). لا شبكة إلا صفحة وثائق المنصة العامة
// التي يُقاس منها ارتفاع x لخطَّي العلامة؛ وسائر القياس على about:blank من ملفات الحزمة.

// ---- ١. الارتفاعات ذات القصّ من لقطات CSS ----
const CLIP_RE = /(^|;)\s*(?:overflow(?:-x|-y|-block|-inline)?\s*:\s*(?:hidden|clip)\b|(?:-webkit-)?line-clamp\s*:\s*\d|text-overflow\s*:\s*ellipsis)/i;
const BASE_SEL = /^(?::root|:host|html|body|\.cds-root)(?:\s*,\s*(?::root|:host|html|body|\.cds-root))*$/i;
const UTIL_SEL = /^\.(?:[\w-]|\\.)+$/; // صنفٌ واحدٌ بلا سلالةٍ ولا شبه صنف
// أداةٌ طباعية تجتمع مع .truncate في الوسم: text-* أو font-* بعد بادئات الحالات (sm\: و \! و min-\[…\]\:)، لا أصناف المكوّنات
const TYPE_UTIL = (sel) => UTIL_SEL.test(sel) && /^(?:text|font)-/.test(sel.slice(1).replace(/^(?:\\!|(?:[\w-]|\\[^:])*?\\:)+/, ""));
const IGNORED_VARS = new Set(["--tw-leading"]); // أدوات leading-* تُمثَّل بـ line-height:1 وحده (أضيقها)
const SITE_OF_DIR = { sitecss: "claude.ai", "sitecss-intercom": "support/privacy", "sitecss-docs": "platform docs", "sitecss-code": "code docs",
  "sitecss-legal": "legal documents", "sitecss-academy": "academy" };
// ملف الإصلاحات النقطية لكل لقطة (كما في build.mjs POINT): فيه العلاج النقطي للقصّ المعلَّق على سمة الخط
// (ر3: legal-point.css بلا قاعدةٍ على سمة الخط، فلا يدخل بصمتي العلاج ولا تتغيّر المعايرة؛ وكذلك academy-point.css في ر4)
export const POINT_CSS = { sitecss: "app-point.css", "sitecss-intercom": "intercom-point.css", "sitecss-docs": "docs-point.css", "sitecss-code": "code-point.css",
  "sitecss-legal": "legal-point.css", "sitecss-academy": "academy-point.css" };

// ---- ١ب. العلاج النقطي للقصّ كما هو في *-point.css (المصدر الوحيد؛ لا نسخة هنا) ----
// كل قاعدةٍ في ملفٍّ من POINT_CSS يحمل تمهيدها [<attr>] (C.FONT_ATTR) علاجٌ: محدِّداتها ما في :is(…) (أو التمهيد بلا
// بوابته إن لم يكن :is)، وهامشها من الإعلانين المهمّين:
//   overflow: clip + overflow-clip-margin: <n>px|<k>em ← يُقصّ الحبر بعد n بكسل (أو k × حجم خط العنصر) من صندوق الحشوة
//   overflow-x: clip + overflow-y: visible             ← لا قصّ رأسيًّا (هامشٌ لا نهائي، ويُكتب 1e6)
// وما سوى ذلك (أو بلا !important فيغلبه hidden الموقع) خطأٌ يوقف القياس، فلا يُقاس علاجٌ لا يعمل.
const NO_VCLIP = 1e6;
const normSel = (s) => String(s).replace(/\s+/g, " ").replace(/\s*([>+~,])\s*/g, "$1").trim();
function splitTop(s) { // يقسم على الفواصل في المستوى الأعلى (لا داخل الأقواس)
  const out = []; let lvl = 0, cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[") lvl++; else if (ch === ")" || ch === "]") lvl--;
    if (ch === "," && !lvl) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(normSel).filter(Boolean);
}
export function readSpotFix(attr = "data-cml-font", extDir = P.EXT) {
  const dirs = {}, errors = [];
  for (const [dir, file] of Object.entries(POINT_CSS)) {
    let css;
    try { css = fs.readFileSync(path.join(extDir, file), "utf8"); } catch { continue; }
    for (const b of innerBlocks(css)) {
      if (!b.prelude.includes("[" + attr + "]")) continue;
      if (/(?:^|;)\s*font-family\s*:/i.test(b.body)) continue; // علاج القطع بعدد الأسطر (readClampFix)، لا هامش فيه
      const decl = {};
      for (const d of b.body.split(";")) {
        const i = d.indexOf(":");
        if (i > 0) { const v = d.slice(i + 1).trim(); decl[d.slice(0, i).trim().toLowerCase()] = { v: v.replace(/\s*!important\s*$/i, "").toLowerCase(), imp: /!important\s*$/i.test(v) }; }
      }
      const has = (k, v) => decl[k] && decl[k].imp && (v === undefined || decl[k].v === v);
      let margin = null;
      if (has("overflow", "clip") && has("overflow-clip-margin")) {
        const m = /^(\d*\.?\d+)(px|em)$/.exec(decl["overflow-clip-margin"].v);
        if (m) margin = parseFloat(m[1]) + m[2];
      } else if (has("overflow-x", "clip") && has("overflow-y", "visible")) margin = "none";
      if (margin === null) { errors.push(`${file}: قاعدة «${normSel(b.prelude).slice(0, 100)}» معلَّقة على [${attr}] ولا تُفهم علاجًا (overflow: clip !important مع overflow-clip-margin: <n>px !important، أو overflow-x: clip و overflow-y: visible مهمَّين)`); continue; }
      const k = b.prelude.indexOf(":is(");
      let sels, rest = "";
      if (k >= 0) {
        let j = k + 4, lvl = 1;
        for (; j < b.prelude.length && lvl; j++) { if (b.prelude[j] === "(") lvl++; else if (b.prelude[j] === ")") lvl--; }
        sels = splitTop(b.prelude.slice(k + 4, j - 1));
        rest = normSel(b.prelude.slice(j));
      } else sels = [normSel(b.prelude.slice(b.prelude.indexOf("]", b.prelude.indexOf("[" + attr + "]")) + 1))];
      const e = dirs[dir] || (dirs[dir] = { file, rules: [] });
      e.rules.push({ selectors: sels, margin, exclude: rest || null });
    }
  }
  // لكل لقطة: المحدِّدات وهامشها (إن تعدّدت القواعد على محدِّدٍ واحد فالقياس يأخذ الأضيق عند كل حجم)
  for (const e of Object.values(dirs)) {
    e.margins = {};
    for (const r of e.rules) for (const s of r.selectors) e.margins[s] = e.margins[s] ? e.margins[s] + "|" + r.margin : r.margin;
  }
  const canon = Object.fromEntries(Object.entries(dirs).sort().map(([d, e]) => [e.file, { margins: Object.fromEntries(Object.entries(e.margins).sort()),
    exclude: [...new Set(e.rules.map((r) => r.exclude).filter(Boolean))].sort() }]));
  return { attr, dirs, errors, canon, sig: sha256(Buffer.from(JSON.stringify(canon))) };
}
// الهامش بالبكسل لعنصرٍ حجم خطه F: «2px» ← 2، و«0.16em» ← 0.16 × F، و«none» ← لا قصّ رأسي؛ والمتعدّد «a|b» ← أضيقها
export function marginPx(spec, F) {
  return Math.min(...String(spec).split("|").map((x) => (x === "none" ? NO_VCLIP : /em$/.test(x) ? parseFloat(x) * F : parseFloat(x))));
}

// ---- ١ج. علاج القطع بعدد الأسطر (line-clamp) كما هو في *-point.css ----
// هامش القصّ لا يصلح هنا: السطر التالي للحدّ مرسومٌ تحت الصندوق، فالهامش يُظهر أعالي حروفه. فتُرسم العربية في عنصر القطع
// وكل ما تحته بعائلةٍ تُلحق أولَ قائمة خطه، والإعلان واحدٌ في كل موقع:
//   font-family: "cml-ar-compact", "cml-ar-today", var(--cml-ff) !important
//   - CLAMP_FAMILY تسجّلها الوحدة (S6-B) من بايتات الخط المختار نفسه بـ size-adjust أصغر (s_c ≥ CLAMP_S_MIN) وتجاوزاتٍ
//     a = B.asc/s_c و d = B.desc/s_c، ومداها C.FONT_AR_RANGE — إن اجتاز بها الخطُّ ارتفاعاتِ القطع الحقيقية في الموقع (calib.clamp)؛
//   - وإلا لم تسجّلها، فتقع العربية على CLAMP_TODAY: أوجه @font-face في الملف نفسه بمصدر local() ومدًى عربي بلا تجاوز، بمدى وزنٍ
//     لكل وجه يطابق ما يختاره ويندوز لـ "Segoe UI" عند كل وزن (1–1000) ومائلًا — فترسم كالمرجع «Segoe UI» في القياس حرفًا؛
//   - ثم var(--cml-ff): قائمة خط العنصر كما يعلنها الموقع (مرآةٌ يولّدها «clamp-css» من اللقطات بترتيبها وطبقاتها)، فلا يتغيّر حرفٌ إنجليزي.
// والقاعدة قاعدتان: الجذور (عنصر القطع نفسه، مكتوبةٌ باليد) وما تحتها ممّا يعلن الموقع له خطًّا يحمل عائلةً معكوسة أو متغيّرًا
// (مولَّدةٌ في كتلة المرآة: «<الجذور> <المحدِّد الأخير>»)؛ وما سواه يرث العلاج من أبيه، وما يعلن له الموقع خطَّ نظامٍ صريحًا
// (monospace مجرّد مثلًا) يبقى كما هو: عربيته اليوم كما هي، ولا يُكسر حجم monospace (13 ← 16).
// والارتفاعات الحقيقية في عناصر القطع من حصر مواضعها (CLAMP_PATH)، لا أحجام الأدوات كلها.
export const CLAMP_FAMILY = "cml-ar-compact", CLAMP_TODAY = "cml-ar-today", CLAMP_VAR = "--cml-ff";
export const CLAMP_S_MIN = 0.85;
export const CLAMP_PATH = P.CODE ? path.join(P.CODE, "fonts.clamp.json") : path.join(HERE, "fonts.clamp.json");
const CLAMP_DECL = `"${CLAMP_FAMILY}", "${CLAMP_TODAY}", var(${CLAMP_VAR})`;
const MIRROR_BEGIN = "/* ── مرآة " + CLAMP_VAR, MIRROR_END = "/* ── نهاية مرآة " + CLAMP_VAR + " ── */";
const normRange = (r) => String(r).replace(/\s+/g, "").toUpperCase();
// اسم الصنف بلا هروب: «.\@max-xs\/row\:line-clamp-3» ← «@max-xs/row:line-clamp-3»
const classTokens = (sel) => [...String(sel).matchAll(/\.((?:[\w-]|\\[0-9a-fA-F]{1,6}\s?|\\.)+)/g)].map((m) =>
  m[1].replace(/\\([0-9a-fA-F]{1,6})\s?/g, (x, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\(.)/g, "$1"));

// مدى الوزن في واصف font-weight: «400» أو «376 499» أو normal/bold
const weightRange = (w) => { const t = String(w || "400").trim().toLowerCase().replace(/^normal$/, "400").replace(/^bold$/, "700").split(/\s+/).map(Number);
  return t.length === 2 ? t : [t[0], t[0]]; };
const coversRegular = (t) => { const [a, b] = weightRange(t.weight); return a <= 400 && 400 <= b && t.style === "normal" && t.locals.some((x) => /^segoe ?ui$/i.test(x)); };
// يقسم المحدِّد على المركِّبات في المستوى الأعلى (لا داخل الأقواس أو المعقوفين أو النص): «.a :is(b,c)>code» ← [".a", ":is(b,c)", "code"]
function compounds(sel) {
  const out = []; let cur = "", lvl = 0, q = null;
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (q) { cur += ch; if (ch === "\\") { cur += sel[++i] || ""; } else if (ch === q) q = null; continue; }
    if (ch === "\\") { cur += ch + (sel[++i] || ""); continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === "(" || ch === "[") lvl++; else if (ch === ")" || ch === "]") lvl--;
    if (!lvl && /[\s>+~]/.test(ch)) { if (cur) out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
const CLAMP_HEAD = (attr) => new RegExp('^html\\[data-cml=(["\']?)on\\1\\]\\[' + attr.replace(/[-]/g, "\\-") + "\\]\\s+");
// «:is(LIST) REST» ← { list, rest } (REST بلا المسافة الأولى)، أو null
function splitIs(s) {
  if (!s.startsWith(":is(")) return null;
  let j = 4, lvl = 1;
  for (; j < s.length && lvl; j++) { if (s[j] === "(") lvl++; else if (s[j] === ")") lvl--; }
  return { list: splitTop(s.slice(4, j - 1)), rest: s.slice(j).trim() };
}

export function readClampFix(attr = "data-cml-font", extDir = P.EXT, arRange = DESIGN_AR_RANGE) {
  const dirs = {}, errors = [];
  for (const [dir, file] of Object.entries(POINT_CSS)) {
    let css;
    try { css = fs.readFileSync(path.join(extDir, file), "utf8"); } catch { continue; }
    const today = [], rules = [], subjects = [], subjectRoots = new Set();
    for (const b of innerBlocks(css)) {
      if (/^@font-face$/i.test(b.prelude)) {
        const d = Object.fromEntries(declsOf(b.body));
        if ((d["font-family"] || "").replace(/["']/g, "").trim() !== CLAMP_TODAY) continue;
        const locals = [...(d.src || "").matchAll(/local\(\s*["']?([^"')]+?)["']?\s*\)/g)].map((m) => m[1]);
        const extra = Object.keys(d).filter((k) => !["font-family", "src", "font-weight", "font-style", "unicode-range"].includes(k));
        if (!locals.length || /url\(/i.test(d.src || "")) errors.push(`${file}: وجه ${CLAMP_TODAY} مصدره غير local() — لا يُجلب للعربية شيء`);
        if (extra.length) errors.push(`${file}: وجه ${CLAMP_TODAY} فيه ${extra.join("، ")} — يلزم أن يكون وجه اليوم كما هو بلا تجاوزٍ ولا size-adjust`);
        if (normRange(d["unicode-range"] || "") !== normRange(arRange)) errors.push(`${file}: مدى وجه ${CLAMP_TODAY} لا يطابق C.FONT_AR_RANGE`);
        today.push({ weight: d["font-weight"] || "400", style: d["font-style"] || "normal", locals });
        continue;
      }
      if (!b.prelude.includes("[" + attr + "]")) continue;
      const fam = /(?:^|;)\s*font-family\s*:\s*([^;]+)/i.exec(b.body);
      if (!fam) continue; // قواعد العلاج النقطي للقصّ (readSpotFix)
      const v = fam[1].trim(), imp = /!important\s*$/i.test(v), val = v.replace(/\s*!important\s*$/i, "").replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ");
      if (!imp || val !== CLAMP_DECL) { errors.push(`${file}: قاعدة «${normSel(b.prelude).slice(0, 100)}» معلَّقة على [${attr}] وخطها «${v}» — المفهوم علاجًا: font-family: ${CLAMP_DECL} !important`); continue; }
      // كل محدِّد: «html[data-cml="on"][attr] :is(<الجذور>)» (القاعدة المكتوبة) أو «… :is(<الجذور>) <محدِّدٌ أخير>» (المولَّدة في المرآة)
      for (const s of splitTop(b.prelude)) {
        const head = CLAMP_HEAD(attr).exec(s), x = head && splitIs(s.slice(head[0].length));
        if (!x) { errors.push(`${file}: محدِّد علاج القطع «${s.slice(0, 100)}» ليس «html[data-cml="on"][${attr}] :is(…) […]»`); continue; }
        if (!x.rest) rules.push(...x.list);
        else { x.list.forEach((r) => subjectRoots.add(r)); if (!subjects.includes(x.rest)) subjects.push(x.rest); }
      }
    }
    if (!rules.length) { if (today.length || subjects.length) errors.push(`${file}: أوجه ${CLAMP_TODAY} أو محدِّداتٌ مولَّدة بلا قاعدة جذور العلاج`); continue; }
    if (!today.some(coversRegular))
      errors.push(`${file}: لا وجه ${CLAMP_TODAY} يشمل مداه الوزنَ 400 (normal) من local("Segoe UI") — وهو وجه المرجع «اليوم» في القياس`);
    if (!css.includes(MIRROR_BEGIN) || !css.includes(MIRROR_END)) errors.push(`${file}: مرآة ${CLAMP_VAR} غائبة — شغّل «fonts.mjs clamp-css»`);
    if (subjects.length && (subjectRoots.size !== new Set(rules).size || rules.some((r) => !subjectRoots.has(r))))
      errors.push(`${file}: جذور القاعدة المولَّدة في المرآة لا تطابق جذور القاعدة المكتوبة — شغّل «fonts.mjs clamp-css»`);
    // الجذور: [class*="…"] و [style*="…"] (تشمل كل صنفٍ أو نمطٍ فيه النص، وما تحته بالوراثة والقاعدة المولَّدة)، وما سواها حرفي
    const generic = { class: [], style: [] }, exact = new Set();
    for (const s of rules) {
      const base = s.replace(/(?:>\*)+$/, "");
      const g = /^\[(class|style)\*=["']([^"']+)["']\]$/.exec(base);
      if (g) { if (!generic[g[1]].includes(g[2])) generic[g[1]].push(g[2]); } else exact.add(base);
    }
    dirs[dir] = { file, selectors: rules, subjects, generic, exact: [...exact].sort(), today };
  }
  const canon = Object.fromEntries(Object.entries(dirs).sort().map(([, e]) => [e.file, { selectors: e.selectors.slice().sort(), subjects: e.subjects.slice().sort(),
    today: e.today.map((t) => t.weight + "|" + t.style + "|" + t.locals.join("/")).sort() }]));
  return { attr, dirs, errors, canon, sig: sha256(Buffer.from(JSON.stringify(canon))) };
}
// هل تشمل قاعدةُ علاج القطع في لقطةٍ قاعدةَ الموقع هذه (كل محدِّداتها)؟ الصنف الذي فيه النص العام (line-clamp-) في أي موضعٍ
// من المحدِّد يشمل عنصره وما تحته (بالوراثة، وبالقاعدة المولَّدة آخر المرآة لما يعلن له الموقع خطًّا)، والحرفي يطابق المحدِّد نفسه
export function clampCovers(entry, prelude) {
  if (!entry) return false;
  return splitTop(prelude).every((p) => entry.exact.includes(p) ||
    classTokens(p).some((c) => entry.generic.class.some((g) => c.includes(g))));
}

// ---- ١د. حصر مواضع القطع ← fonts.clamp.json (ما يقيسه measure في عناصر القطع) ----
const INVENTORY_DIR = { "claude.ai": "sitecss", support: "sitecss-intercom", privacy: "sitecss-intercom", "support+privacy": "sitecss-intercom",
  "platform docs": "sitecss-docs", "code docs": "sitecss-code", "legal documents": "sitecss-legal", academy: "sitecss-academy" };
export function clampDataFrom(inv, sourceName = "inventory.json") {
  if (!Array.isArray(inv)) throw new Error("الحصر ليس مصفوفة مدخلات");
  const ctx = {}, skipped = {}, unknown = new Set();
  for (const e of inv) {
    const dir = INVENTORY_DIR[e.site];
    if (!dir) { unknown.add(e.site); continue; }
    const why = e.excludeFromPairs ? "خارج الإضافة أو حيّ الحساب" : !(typeof e.fontSize === "number" && typeof e.lineHeight === "number") ? "حجمٌ غير محلول" : null;
    if (why) { skipped[why] = (skipped[why] || 0) + 1; continue; }
    const c = ctx[dir] || (ctx[dir] = { point: POINT_CSS[dir], pairs: new Map() });
    const key = r2(e.fontSize) + "/" + r2(e.lineHeight);
    if (!c.pairs.has(key)) c.pairs.set(key, { px: r2(e.fontSize), lh: r2(e.lineHeight), n: 0, lines: new Set(), sites: new Set(), examples: [] });
    const p = c.pairs.get(key);
    p.n += e.count || 1;
    for (const l of Array.isArray(e.lines) ? e.lines : []) p.lines.add(l);
    p.sites.add(e.site);
    const ex = String(e.selector || "").replace(/\s+/g, " ").slice(0, 90);
    if (ex && p.examples.length < 3 && !p.examples.includes(ex)) p.examples.push(ex);
  }
  if (unknown.size) throw new Error("مواقع لا تُعرف لقطتها في الحصر: " + [...unknown].join("، "));
  const contexts = {};
  for (const dir of Object.keys(ctx).sort()) contexts[dir] = { point: ctx[dir].point, pairs: [...ctx[dir].pairs.values()].sort((a, b) => a.px - b.px || a.lh - b.lh)
    .map((p) => ({ px: p.px, lh: p.lh, n: p.n, lines: [...p.lines].sort((a, b) => a - b), sites: [...p.sites].sort(), examples: p.examples })) };
  return { format: 1, made: today(), source: sourceName, entries: inv.length, skipped, contexts };
}
export function readClampData(p = CLAMP_PATH) {
  const raw = fs.readFileSync(p);
  const d = JSON.parse(raw.toString("utf8"));
  if (d.format !== 1 || !d.contexts) throw new Error(path.basename(p) + ": بلا format: 1 أو contexts");
  for (const [dir, c] of Object.entries(d.contexts)) {
    if (!POINT_CSS[dir]) throw new Error(`${path.basename(p)}: لقطةٌ لا تُعرف: ${dir}`);
    for (const x of c.pairs || []) if (!(x.px >= 6 && x.px <= 96 && x.lh > 0)) throw new Error(`${path.basename(p)}: زوجٌ غير صالح في ${dir}: ${JSON.stringify(x)}`);
  }
  return { ...d, sig: sha256(raw) };
}
async function cmdClamp(args) {
  const from = argVal(args, "from", null);
  if (!from) { console.error("الاستعمال: node fonts.mjs clamp --from=<inventory.json>   (حصر مواضع line-clamp: site، fontSize، lineHeight، lines، count …)"); return 2; }
  const data = clampDataFrom(JSON.parse(fs.readFileSync(path.resolve(from), "utf8")), path.basename(from));
  const text = JSON.stringify(data, null, 1).replace(/\[\n\s*([^\[\]{}]*?)\n\s*\]/g, (m, inner) => { const one = "[" + inner.split(/,\n\s*/).join(", ") + "]"; return one.length <= 120 ? one : m; }) + "\n";
  if (BLOCK_0590.test(text)) { console.error("✗ في الحصر محرفٌ من الكتلة U+0590–05FF — لم يُكتب شيء"); return 1; }
  fs.writeFileSync(CLAMP_PATH, text, "utf8");
  console.log(`✓ كُتب ${path.relative(process.cwd(), CLAMP_PATH)}: ` + Object.entries(data.contexts).map(([d, c]) => `${d} ${c.pairs.length} زوجًا`).join("، ") +
    `؛ واستُبعد ${Object.entries(data.skipped).map(([k, n]) => n + " (" + k + ")").join("، ") || "لا شيء"}`);
  return 0;
}

// ---- ١هـ. مرآة --cml-ff: قائمة خط كل عنصرٍ كما يعلنها الموقع، مولَّدةً من اللقطة ----
// لكل قاعدةٍ في اللقطة تعلن font-family (أو font) يُكتب «<محدِّداتها> { --cml-ff: <القيمة> }» بشروطها (@media و@supports و@container
// و@scope) وبترتيبها في المستند (ترتيب أوراق _manifest.json كما تحمّلها الصفحة) **وفي طبقاتها**: طبقات الموقع (@layer theme, base …)
// تُعاد طبقاتٍ متداخلة داخل cml-point بترتيبها المعلن، وما ليس في طبقةٍ يبقى مباشرةً في cml-point فيغلبها كما يغلبها في الموقع.
// فيفوز في المرآة ما يفوز في الموقع (الطبقة ثم التخصيص ثم الترتيب)، والمتغيّر يُورَّث كما تُورَّث العائلة. وأدنى الطبقات قيم المتصفح.
// والقوائم الحرفية تُكتب بأسماء العائلات المعروفة (القائمة أدناه، وكل عائلةٍ تعلنها أوجه @font-face في اللقطة نفسها) ويُسقط غيرها
// (خطوط نظامٍ لحروفٍ أخرى؛ لا يُكتب اسمها في الكود)، ولا تُكتب initial أبدًا: متغيّرٌ باطل يُبطل إعلان العلاج فيرث العنصر خطَّ أبيه.
const FAMILY_OK = /^(?:anthropic.*|katex_.*|inter|arial|georgia|cambria|times|times new roman|courier new|consolas|menlo|monaco|sf mono|sfmono-regular|liberation mono|roboto|helvetica|helvetica neue|segoe ui|segoe ui emoji|segoe ui symbol|apple color emoji|noto color emoji|noto sans|noto serif|system-ui|-apple-system|blinkmacsystemfont|sans-serif|serif|monospace|cursive|fantasy|emoji|math|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|opendyslexic|atkinson hyperlegible next|comic sans ms|codicon|anthropicons-variable|papermono|cmu typewriter text|tiempos text regular|styrene|n)$/i;
const famNorm = (n) => String(n).trim().replace(/^(["'])([\s\S]*)\1$/, "$2").replace(/\\(.)/g, "$1").trim().toLowerCase();
// كتل القواعد بسلسلة شروطها، وأسماء الطبقات (مسارًا منقوطًا) بترتيب ظهورها الأول — من كتل @layer وعبارات «@layer a, b;» معًا
function blocksWithChain(css, layers = []) {
  const s = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [], stack = [];
  let mark = 0, q = null, anon = 0;
  const layerPath = () => stack.filter((x) => x.layer).map((x) => x.layer);
  const addLayer = (p) => { const k = p.join("."); if (!layers.includes(k)) layers.push(k); };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === "\\") i++; else if (ch === q) q = null; continue; }
    if (ch === "\\") { i++; continue; } // هروبٌ خارج النص (اسم صنفٍ فيه علامة تنصيصٍ مهروبة): ليس بداية نص
    if (ch === '"' || ch === "'") { q = ch; continue; }
    if (ch === "{") {
      const prelude = s.slice(mark, i).trim(), m = /^@layer\b\s*([^\s{]*)/i.exec(prelude);
      const layer = m ? (m[1] || "cml-anon-" + ++anon) : null;
      stack.push({ prelude: layer ? "@layer " + layer : prelude, start: i + 1, nested: false, layer });
      if (layer) addLayer(layerPath());
      if (stack.length > 1) stack[stack.length - 2].nested = true; mark = i + 1;
    } else if (ch === "}") { const b = stack.pop(); if (b && !b.nested) out.push({ prelude: b.prelude, body: s.slice(b.start, i), chain: stack.map((x) => x.prelude) }); mark = i + 1; }
    else if (ch === ";") {
      const st = s.slice(mark, i).trim(), m = /^@layer\s+([^{]+)$/i.exec(st);
      if (m) for (const n of m[1].split(",").map((x) => x.trim()).filter(Boolean)) addLayer([...layerPath(), n]);
      mark = i + 1;
    }
  }
  return out;
}
// أوراق اللقطة بترتيب المستند: _manifest.json ‏css[] (كما تحمّلها الصفحة)، ثم ما بقي أبجديًّا
function snapFiles(dir) {
  const p = snapPath(dir);
  let all = [];
  try { all = fs.readdirSync(p).filter((f) => f.endsWith(".css")); } catch { return []; }
  let order = [];
  try { order = (JSON.parse(fs.readFileSync(path.join(p, "_manifest.json"), "utf8")).css || []).map((x) => (typeof x === "string" ? x : x && x.file)).filter(Boolean); } catch {}
  const out = [];
  for (const f of order) if (all.includes(f) && !out.includes(f)) out.push(f);
  for (const f of all.sort()) if (!out.includes(f)) out.push(f);
  return out;
}
// العائلات التي يُرسم فيها الوجه العربي الرئيس في لقطةٍ ما: meta.fontFamilies لنطاقاتها، و«cml-ar» (الإلحاق، §٤.٤)
export function mirroredFamilies(dir, C = globalThis.CMLConst || {}) {
  const set = new Set(["cml-ar"]);
  for (const d of C.DOMAINS || []) if (SNAP_DIR[d.id] === dir && d.meta && d.meta.fontFamilies)
    for (const n of Array.isArray(d.meta.fontFamilies) ? d.meta.fontFamilies : Object.keys(d.meta.fontFamilies)) set.add(famNorm(n));
  return set;
}
function splitList(v) { const out = []; let q = null, cur = "", lvl = 0;
  for (const ch of v) { if (q) { cur += ch; if (ch === q) q = null; continue; } if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === "(") lvl++; else if (ch === ")") lvl--; if (ch === "," && !lvl) { out.push(cur.trim()); cur = ""; } else cur += ch; }
  if (cur.trim()) out.push(cur.trim()); return out; }
// القيمة المرآة: var() والكلمات المفتاحية كما هي، والأسماء غير المعروفة تُسقط (ولا initial: انظر أعلاه)؛ first = أُسقط أولُ اسم
function mirrorValue(v, declared = new Set()) {
  const kw = /^(inherit|initial|unset|revert|revert-layer)$/i.exec(v.trim());
  if (kw) return { v: kw[1].toLowerCase(), dropped: 0 };
  const parts = splitList(v), keep = [];
  let dropped = 0, first = false;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i], name = famNorm(p);
    if (/var\(/i.test(p) || FAMILY_OK.test(name) || declared.has(name)) keep.push(p);
    else { dropped++; if (i === 0) first = true; }
  }
  return { v: keep.join(", "), dropped, first, empty: !keep.length };
}
// هل يلزم العنصرَ الذي تعلن له القاعدةُ هذا الخطَّ علاجٌ صريح؟ نعم إن احتملت قائمته وجهنا العربي الرئيس: متغيّرٌ (لا يُعرف ما يحمل)
// أو عائلةٌ معكوسة، أو revert-layer. أما inherit/unset فيرث خطَّ أبيه المعالَج بنفسه، وقائمة نظامٍ صريحة (monospace، system-ui …)
// لا وجه لنا فيها فعربيتها اليوم كما هي — وإلحاق عائلةٍ بـ monospace المجرّد يكسر حجمه (13 ← 16 بكسل)
function needsTreatment(v, fams) {
  if (/var\(/i.test(v) || /^\s*revert-layer\s*$/i.test(v)) return true;
  if (/^\s*(inherit|initial|unset|revert)\s*$/i.test(v)) return false;
  return splitList(v).some((p) => fams.has(famNorm(p)));
}
function familyOfFont(v) { // font: [style variant weight stretch] size[/lh] family | كلمة مفتاحية
  const t = v.trim();
  if (/^(inherit|initial|unset|revert|revert-layer)$/i.test(t)) return t;
  const m = /(?:^|\s)(?:\d*\.?\d+(?:px|rem|em|%|pt|vw|vh|ex|ch)|0|(?:xx?x?-)?(?:small|large)|medium|larger|smaller)(?:\s*\/\s*\S+)?\s+(.+)$/i.exec(t);
  return m ? m[1].trim() : null; // كلمات خط النظام (caption، -apple-system-body …) بلا قائمة: لا تُمثَّل
}
// جذور العلاج من القاعدة المكتوبة في ملف النقطة: «html[data-cml="on"][attr] :is(<الجذور>) { font-family: … }»
export function clampRootsOf(cssText, attr = "data-cml-font") {
  const roots = [];
  for (const b of innerBlocks(cssText)) {
    if (!b.prelude.includes("[" + attr + "]") || !/(?:^|;)\s*font-family\s*:/i.test(b.body)) continue;
    for (const s of splitTop(b.prelude)) { const h = CLAMP_HEAD(attr).exec(s), x = h && splitIs(s.slice(h[0].length)); if (x && !x.rest) for (const r of x.list) if (!roots.includes(r)) roots.push(r); }
  }
  return roots;
}
export function clampMirror(dir, { roots = [], fams = mirroredFamilies(dir), attr = "data-cml-font" } = {}) {
  const p = snapPath(dir);
  const files = snapFiles(dir);
  if (!files.length) return null;
  const sheets = files.map((f) => fs.readFileSync(path.join(p, f), "utf8"));
  // العائلات التي تعلنها اللقطة نفسها بأوجه @font-face (خطوط ويب الموقع): معروفةٌ وإن غابت عن FAMILY_OK
  const declared = new Set();
  for (const t of sheets) for (const b of innerBlocks(t)) if (/^@font-face$/i.test(b.prelude)) { const d = Object.fromEntries(declsOf(b.body)); if (d["font-family"]) declared.add(famNorm(d["font-family"])); }
  const rows = [], layers = [];
  let dropped = 0, firstDropped = 0, empty = 0;
  for (const t of sheets) for (const b of blocksWithChain(t, layers)) {
    if (b.prelude.startsWith("@")) continue;
    if (b.chain.some((c) => !/^@(media|supports|container|layer|scope)\b/i.test(c))) continue; // @font-face و@keyframes والتداخل
    let val = null, imp = false;
    for (const d of b.body.split(";")) {
      const m = /^\s*(font-family|font)\s*:\s*([\s\S]+?)\s*$/i.exec(d);
      if (!m) continue;
      const raw = m[2].replace(/\s*!important$/i, ""), fam = m[1].toLowerCase() === "font" ? familyOfFont(raw) : raw;
      if (fam) { val = fam; imp = /!important$/i.test(m[2]); }
    }
    if (val === null) continue;
    const sels = splitTop(b.prelude).filter((s) => !/::|:(?:before|after|placeholder|first-line|first-letter|marker|selection)\b/i.test(s));
    if (!sels.length) continue;
    const mv = mirrorValue(val, declared);
    dropped += mv.dropped; if (mv.first) firstDropped++;
    if (mv.empty) { empty++; continue; } // لا اسم معروفًا: لا يُكتب (يرث المتغيّرُ قائمةَ الأب)، ويُحصى
    const chain = b.chain.map((c) => c.replace(/\s+/g, " "));
    const line = sels.join(",") + "{" + CLAMP_VAR + ":" + mv.v + (imp ? "!important" : "") + "}";
    const key = chain.join("\u0000") + "\u0001" + line;
    const at = rows.findIndex((r) => r.key === key);
    if (at >= 0) rows.splice(at, 1); // المكرَّر يُبقى في موضعه الأخير، فهو موضعه في التتالي
    rows.push({ key, chain, line, sels, treat: needsTreatment(val, fams) });
  }
  // محدِّدات العلاج المولَّدة: لكل محدِّدٍ في قاعدةٍ يلزم عنصرَها علاج «<مركِّبه الأخير>:is(<المحدِّد كاملًا>)» تحت الجذور، بشروط
  // قاعدته (@media و@supports و@container؛ وبداية @scope تُلحق بالمحدِّد). فلا يُعالَج إلا ما يعلن له الموقعُ نفسُه هذا الخط —
  // لا كلُّ code تحت الجذر وفي الموقع code بـ monospace مجرّد (فينكسر حجمه 13 ← 16) — ويبقى المركِّب الأخير مفتاحَ المطابقة
  // (لا «<الجذور> *» على كل عنصر). وسلفُ المحدِّد قد يقع فوق الجذر أو تحته، فـ :is() لا تشترط موضعه.
  const subjects = [], groups = [];
  if (roots.length) for (const r of rows) if (r.treat) {
    const cond = r.chain.filter((c) => /^@(media|supports|container)\b/i.test(c));
    const scope = r.chain.map((c) => /^@scope\s*\(/i.exec(c) && c).filter(Boolean).pop();
    let start = null;
    if (scope) { let j = scope.indexOf("(") + 1, lvl = 1; const a = j; for (; j < scope.length && lvl; j++) { if (scope[j] === "(") lvl++; else if (scope[j] === ")") lvl--; } start = scope.slice(a, j - 1).trim(); }
    const key = cond.join("\u0000");
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, cond, subj: [] }));
    for (const s of r.sels) {
      const c = compounds(s), last = c[c.length - 1];
      if (!last || /:scope\b|&/.test(s) || /^(?:html|body|:root|:host)\b/i.test(last)) continue; // لا يكون تحت جذر
      const full = start ? `:where(${start}) ${s}` : s;
      const subj = /^\*?$/.test(last.replace(/:not\([^)]*\)/g, "")) ? `:is(${full})` : c.length === 1 && !start ? last : `${last}:is(${full})`;
      if (!g.subj.includes(subj)) g.subj.push(subj);
      if (!subjects.includes(subj)) subjects.push(subj);
    }
  }
  const top = layers.filter((l) => !l.includes(".")), nested = layers.filter((l) => l.includes("."));
  const L = [`${MIRROR_BEGIN}: مولَّدة من لقطة ${dir}/ بـ «node web/code/toolchain/fonts.mjs clamp-css»، فلا تُحرَّر باليد. ──`,
    `   تعريف متغيّرٍ لا يقرؤه إلا علاج القطع (المعلَّق على السمة)، فلا أثر له في الرسم: ${rows.length} قاعدة بترتيب أوراق الموقع وطبقاته` +
      (top.length ? ` (${top.join("، ")})` : "") + (dropped ? `، وأُسقط من القوائم الحرفية ${dropped} اسمًا غير معروف (${firstDropped} منها أولُ قائمته)` : "") +
      (empty ? `، و${empty} قائمةً بلا اسمٍ معروف لم تُكتب` : "") + `؛ ثم ${subjects.length} محدِّدًا لما تحت الجذور يعلن له الموقع خطًّا قد يحمل وجهنا. */`,
    "@layer cml-point {",
    `@layer cml-ua${top.length ? ", " + top.join(", ") : ""};`];
  for (const n of nested) { const parts = n.split("."); L.push(parts.slice(0, -1).map((x) => "@layer " + x + "{").join("") + "@layer " + parts[parts.length - 1] + ";" + "}".repeat(parts.length - 1)); }
  L.push(`@layer cml-ua{:where(code,kbd,samp,pre,tt,xmp,listing,plaintext,textarea){${CLAMP_VAR}:monospace}:where(math){${CLAMP_VAR}:math}}`);
  let open = [];
  for (const r of rows) {
    let k = 0;
    while (k < open.length && k < r.chain.length && open[k] === r.chain[k]) k++;
    while (open.length > k) { open.pop(); L.push("}".padStart(open.length + 1)); }
    for (const c of r.chain.slice(k)) { L.push(" ".repeat(open.length) + c + "{"); open.push(c); }
    L.push(" ".repeat(open.length) + r.line);
  }
  while (open.length) { open.pop(); L.push("}".padStart(open.length + 1)); }
  const head = `html[data-cml="on"][${attr}] :is(${roots.join(", ")}) `;
  for (const g of groups) if (g.subj.length) {
    L.push(...g.cond.map((c, i) => " ".repeat(i) + c + "{"));
    const ind = " ".repeat(g.cond.length);
    L.push(g.subj.map((s) => ind + head + s).join(",\n") + " {", `${ind}  font-family: ${CLAMP_DECL} !important;`, ind + "}");
    for (let i = g.cond.length - 1; i >= 0; i--) L.push(" ".repeat(i) + "}");
  }
  L.push("}", MIRROR_END);
  const css = L.join("\n") + "\n";
  if (BLOCK_0590.test(css)) throw new Error(dir + ": في المرآة محرفٌ من الكتلة U+0590–05FF");
  return { css, rules: rows.length, dropped, firstDropped, empty, subjects: subjects.length, layers: top };
}
// يستبدل كتلة المرآة في ملف النقطة (أو يلحقها آخره إن غابت)؛ ويعيد النص الجديد دون كتابة إن طُلب
export function withMirror(cssText, mirror) {
  const a = cssText.indexOf(MIRROR_BEGIN), b = cssText.indexOf(MIRROR_END);
  if (a >= 0 && b > a) return cssText.slice(0, a) + mirror.trimEnd() + cssText.slice(b + MIRROR_END.length);
  return cssText.trimEnd() + "\n\n" + mirror;
}
// ★ (ر5، ٢٩ ربيع الآخر ١٤٤٨هـ — ملاحظة ر3 L5) هل يحتاج ملف النقطة مرآة ‎--cml-ff‎؟ المرآة لا يقرؤها إلا علاج القطع، فملفٌّ بلا جذور علاجٍ
// ولا كتلة مرآةٍ قائمة (legal-point.css وacademy-point.css) يُترك كما هو بايتًا — كان «clamp-css» يُلحق به مرآةً لا يقرؤها شيء (217 سطرًا
// في الأول و42 في الثاني). وملفٌّ بكتلةٍ قائمة تُجدَّد كتلته كما كان (ولو بلا جذور: تُكتب المرآة بلا محدِّدات علاج)
export function clampCssNeeds(cssText, attr = "data-cml-font") {
  const roots = clampRootsOf(cssText, attr);
  const mirror = cssText.includes(MIRROR_BEGIN) || cssText.includes(MIRROR_END);
  return { roots, mirror, needs: roots.length > 0 || mirror };
}
async function cmdClampCss() {
  await import(pathToFileURL(path.join(P.EXT, "cml-const.js")).href);
  const C = globalThis.CMLConst || {}, attr = C.FONT_ATTR || "data-cml-font";
  for (const [dir, file] of Object.entries(POINT_CSS)) {
    const fp = path.join(P.EXT, file);
    if (!fs.existsSync(fp)) continue;
    const old = fs.readFileSync(fp, "utf8");
    const need = clampCssNeeds(old, attr);
    if (!need.needs) { console.log(`ℹ ${file}: لا جذور علاج قطعٍ فيه ولا مرآة — يُترك كما هو`); continue; }
    const m = clampMirror(dir, { roots: need.roots, fams: mirroredFamilies(dir, C), attr });
    if (!m) { console.log(`ℹ ${file}: لا لقطة ${dir}/ هنا — لم تُولَّد مرآته`); continue; }
    const next = withMirror(old, m.css);
    if (next !== old) fs.writeFileSync(fp, next, "utf8");
    console.log(`${next !== old ? "✓ كُتبت" : "✓ طازجة"} مرآة ${file}: ${m.rules} قاعدة في الطبقات (${m.layers.join("، ") || "—"})، أُسقط ${m.dropped} اسمًا (${m.firstDropped} أولُ قائمته)، ${m.empty} قائمةً بلا اسمٍ معروف، و${m.subjects} محدِّدًا للعلاج`);
  }
  return 0;
}
// قاعدة قطعٍ نصّي: سطرٌ واحد (overflow مخفيٌّ أو مقصوص مع nowrap أو ellipsis) أو line-clamp، لا sr-only ولا ::placeholder.
// وبلا حجم خطٍّ يرث عنصرُها حجمَه، فتمثّله أحجام الأدوات (مراجعة S5-B): فلا يُحسب علاجُ .truncate لأحجام الأدوات في
// موقعٍ ما دامت فيه قاعدةٌ كهذه لا يشملها العلاج — ومنها line-clamp أبدًا، لأن الهامش يُظهر أعالي السطر التالي للحدّ
const OV_CLIP = /(^|;)\s*overflow(?:-x|-y|-inline|-block)?\s*:\s*(?:hidden|clip)\b/i;
const ONE_LINE = /(^|;)\s*(?:white-space\s*:\s*(?:nowrap|pre)\b|text-wrap(?:-mode)?\s*:\s*nowrap\b|text-overflow\s*:\s*ellipsis)/i;
const CLAMP = /(^|;)\s*(?:-webkit-)?line-clamp\s*:\s*(?!none\b|unset\b|initial\b|inherit\b)\S/i;
const SR_ONLY = /(^|;)\s*(?:clip\s*:\s*rect\(|clip-path\s*:\s*inset\(\s*50%)/i;
const textClipRule = (b) => !SR_ONLY.test(b.body) && !/:placeholder\b/i.test(b.prelude) && (CLAMP.test(b.body) || (OV_CLIP.test(b.body) && ONE_LINE.test(b.body)));
// هامش العلاج (نصًّا) لمصدر ارتفاعٍ واحد، أو null إن لم يشمله العلاج (الأداة الطباعية تُعالَج بعلاج .truncate في موقعها،
// بشرط ألّا يبقى في الموقع قطعٌ نصّيٌّ بلا حجم خطٍّ خارج العلاج: blockers[dir])
function fixMarginOf(fix, src, blockers) {
  const e = fix && fix.dirs[src.dir];
  if (!e) return null;
  if (src.kind === "utility") return blockers && blockers[src.dir] && blockers[src.dir].length ? null : e.margins[".truncate"] ?? null;
  if (src.kind !== "rule") return null;
  const ms = splitTop(src.pre || src.sel).map((p) => e.margins[p]);
  return ms.every((m) => m !== undefined) ? ms.join("|") : null;
}

function declsOf(body) {
  const out = [];
  for (const d of body.split(";")) {
    const i = d.indexOf(":");
    if (i > 0) out.push([d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).replace(/!important\s*$/i, "").trim()]);
  }
  return out;
}
// var(--x, fb) ← كل قيمةٍ ممكنة في السياق (يغلب تعريفُ السياق تعريفَ الجذر)، والناتج بدائل نصية محدودة العدد
function substVars(expr, lookup, depth = 0) {
  const i = expr.indexOf("var(");
  if (i < 0) return [expr];
  if (depth > 10) return [];
  let j = i + 4, lvl = 1, comma = -1;
  for (; j < expr.length && lvl; j++) {
    if (expr[j] === "(") lvl++;
    else if (expr[j] === ")") lvl--;
    else if (expr[j] === "," && lvl === 1 && comma < 0) comma = j;
  }
  const end = j - 1;
  const name = expr.slice(i + 4, comma < 0 ? end : comma).trim();
  const fb = comma < 0 ? null : expr.slice(comma + 1, end).trim();
  let alts = IGNORED_VARS.has(name) ? [] : lookup(name);
  if (!alts.length && fb !== null) alts = [fb];
  const out = [];
  for (const a of alts) for (const s of substVars(expr.slice(0, i) + a + expr.slice(end + 1), lookup, depth + 1)) {
    if (!out.includes(s)) out.push(s);
    if (out.length >= 24) return out;
  }
  return out;
}
// حاسبٌ صغير لـ calc/min/max/clamp بوحدتين: px و num (rem = 16px، و em و % على أساسٍ يُمرَّر)
function evalCss(str, emBase) {
  const toks = [];
  const re = /\s*(?:(\d*\.?\d+(?:e[+-]?\d+)?)(px|rem|em|%|[a-z]+)?|([-+*/(),])|([a-z-]+)\()/giy;
  let m, pos = 0;
  const s = String(str).trim();
  while (pos < s.length) {
    re.lastIndex = pos;
    m = re.exec(s);
    if (!m || m.index !== pos) throw new Error("لا يُحلَّل: " + s);
    pos = re.lastIndex;
    if (m[1] !== undefined) toks.push({ n: parseFloat(m[1]), u: (m[2] || "").toLowerCase() });
    else if (m[3]) toks.push({ op: m[3] });
    else if (m[4]) { toks.push({ fn: m[4].toLowerCase() }); }
    while (pos < s.length && /\s/.test(s[pos])) pos++;
  }
  let k = 0;
  const peek = () => toks[k], take = () => toks[k++];
  const need = (op) => { const t = take(); if (!t || t.op !== op) throw new Error("متوقَّع " + op); };
  const num = (t) => {
    if (t.u === "" ) return { v: t.n, d: "num" };
    if (t.u === "px") return { v: t.n, d: "px" };
    if (t.u === "rem") return { v: t.n * 16, d: "px" };
    if (t.u === "em") return { v: t.n * emBase, d: "px" };
    if (t.u === "%") return { v: (t.n / 100) * emBase, d: "px" };
    throw new Error("وحدةٌ غير مدعومة: " + t.u);
  };
  function factor() {
    const t = take();
    if (!t) throw new Error("نهايةٌ مبكرة");
    if (t.op === "-") { const f = factor(); return { v: -f.v, d: f.d }; }
    if (t.op === "(") { const e = expr(); need(")"); return e; }
    if (t.fn) {
      const args = [expr()];
      while (peek() && peek().op === ",") { take(); args.push(expr()); }
      need(")");
      if (t.fn === "calc") return args[0];
      const same = args.every((a) => a.d === args[0].d);
      if (!same) throw new Error("وحدات مختلطة في " + t.fn);
      if (t.fn === "min") return { v: Math.min(...args.map((a) => a.v)), d: args[0].d };
      if (t.fn === "max") return { v: Math.max(...args.map((a) => a.v)), d: args[0].d };
      if (t.fn === "clamp" && args.length === 3) return { v: Math.max(args[0].v, Math.min(args[1].v, args[2].v)), d: args[0].d };
      throw new Error("دالةٌ غير مدعومة: " + t.fn);
    }
    if (t.n !== undefined) return num(t);
    throw new Error("رمزٌ غير متوقَّع");
  }
  function term() {
    let a = factor();
    while (peek() && (peek().op === "*" || peek().op === "/")) {
      const op = take().op, b = factor();
      if (op === "*") { if (a.d === "px" && b.d === "px") throw new Error("px×px"); a = { v: a.v * b.v, d: a.d === "px" || b.d === "px" ? "px" : "num" }; }
      else { if (b.d === "px") { if (a.d !== "px") throw new Error("num/px"); a = { v: a.v / b.v, d: "num" }; } else a = { v: a.v / b.v, d: a.d }; }
    }
    return a;
  }
  function expr() {
    let a = term();
    while (peek() && (peek().op === "+" || peek().op === "-")) {
      const op = take().op, b = term();
      if (a.d !== b.d) throw new Error("جمع وحدات مختلفة");
      a = { v: op === "+" ? a.v + b.v : a.v - b.v, d: a.d };
    }
    return a;
  }
  const r = expr();
  if (k !== toks.length) throw new Error("بقيةٌ لم تُحلَّل");
  return r;
}
const r2 = (x) => Math.round(x * 100) / 100;

// clampFix (readClampFix) و clampData (readClampData): قواعد line-clamp التي يشملها علاج القطع لا تمنع علاج .truncate لأحجام
// الأدوات، ولا تدخل قائمة الوجه الرئيس؛ وتُقاس عناصرها بأزواجها الحقيقية (من الحصر، ومن قواعد القطع ذات الحجم في اللقطة) في
// سياق لقطتها (clamp[dir]). والزوج المحصور في لقطةٍ لا علاج قطعٍ فيها يدخل قائمة الوجه الرئيس بلا علاج.
export function extractHeights({ fix = null, clampFix = null, clampData = null } = {}) {
  const found = new Map(); // "px/lh" ← مدخل
  const notes = [];
  const blockers = {}; // لقطة ← قواعد قطعٍ نصّي بلا حجم خطٍّ لا يشملها العلاج (تمنع حسابه لأحجام الأدوات فيها)
  const clamp = {}; // لقطة ← Map("px/lh" ← زوج قطعٍ بعدد الأسطر)
  const addClamp = (dir, px, lh, src) => {
    const m = clamp[dir] || (clamp[dir] = new Map()), key = r2(px) + "/" + r2(lh);
    if (!m.has(key)) m.set(key, { px: r2(px), lh: r2(lh), n: 0, sources: [] });
    const e = m.get(key);
    e.n += src.n || 1;
    if (e.sources.length < 4) e.sources.push(src);
  };
  const dirs = [...new Set(Object.values(SNAP_DIR))];
  for (const dir of dirs) {
    const p = snapPath(dir);
    let files = [];
    try { files = fs.readdirSync(p).filter((f) => f.endsWith(".css")).sort(); } catch {}
    if (!files.length) { notes.push(dir + ": لا لقطة"); continue; }
    const blocks = [];
    for (const f of files) for (const b of innerBlocks(fs.readFileSync(path.join(p, f), "utf8"))) blocks.push({ ...b, file: f, decls: declsOf(b.body) });
    const fe = fix && fix.dirs[dir], ce = clampFix && clampFix.dirs[dir];
    const clampTreated = (b) => !!ce && CLAMP.test(b.body) && clampCovers(ce, b.prelude);
    if (fe) {
      const bl = blocks.filter((b) => !b.decls.some(([k]) => k === "font-size") && textClipRule(b) && !splitTop(b.prelude).every((s) => fe.margins[s] !== undefined) && !clampTreated(b));
      blockers[dir] = [...new Set(bl.map((b) => normSel(b.prelude)))];
      if (blockers[dir].length) notes.push(`${dir}: لا يُحسب العلاج لأحجام الأدوات — ${blockers[dir].length} قاعدة قطعٍ نصّي بلا حجم خطٍّ خارجه (${new Set(bl.filter((b) => CLAMP.test(b.body)).map((b) => normSel(b.prelude))).size} منها line-clamp): ${blockers[dir].slice(0, 6).join(" ، ")}${blockers[dir].length > 6 ? " …" : ""}`);
    }
    if (ce) {
      const n = new Set(blocks.filter(clampTreated).map((b) => normSel(b.prelude))).size;
      notes.push(`${dir}: ${n} قاعدة line-clamp يشملها علاج القطع (${ce.file})`);
      // سياقٌ بلا أزواجٍ محصورة: لا يُعرف ما يقيسه، فيُسجَّل فارغًا فيقع على وجه اليوم (لا s_c بلا دليل)
      if (!clamp[dir]) clamp[dir] = new Map();
    }
    // تعريفات المتغيّرات بحسب التمهيد، وأساس ارتفاع السطر الموروث (unitless في body ثم html)
    const defs = new Map();
    for (const b of blocks) for (const [k, v] of b.decls) if (k.startsWith("--")) {
      if (!defs.has(k)) defs.set(k, []);
      defs.get(k).push({ v, sel: b.prelude, base: BASE_SEL.test(b.prelude) });
    }
    let baseLh = null;
    for (const sel of ["body", "html", ":host"]) {
      for (const b of blocks) if (b.prelude === sel) for (const [k, v] of b.decls) if (k === "line-height" && /^\d*\.?\d+$/.test(v)) baseLh = baseLh || parseFloat(v);
      if (baseLh) break;
    }
    baseLh = baseLh || 1.5;
    const hasTruncate = blocks.some((b) => b.prelude === ".truncate" && CLIP_RE.test(b.body));
    const lookupIn = (ctx) => (name) => {
      const d = defs.get(name) || [];
      const own = ctx ? d.filter((x) => x.sel === ctx).map((x) => x.v) : [];
      if (own.length) return [own[own.length - 1]];
      const base = d.filter((x) => x.base).map((x) => x.v);
      if (base.length) return [...new Set(base)];
      return [...new Set(d.filter((x) => !UTIL_SEL.test(x.sel) || !/^\.leading-/.test(x.sel)).map((x) => x.v))];
    };
    const varsIn = (s, acc = new Set(), depth = 0) => {
      for (const m of String(s).matchAll(/var\(\s*(--[\w-]+)/g)) {
        if (acc.has(m[1]) || depth > 10) continue;
        acc.add(m[1]);
        for (const x of defs.get(m[1]) || []) varsIn(x.v, acc, depth + 1);
      }
      return acc;
    };
    let clipNoSize = 0;
    for (const b of blocks) {
      const clip = CLIP_RE.test(b.body);
      const sizeD = b.decls.filter(([k]) => k === "font-size").pop();
      const lhD = b.decls.filter(([k]) => k === "line-height").pop();
      const util = TYPE_UTIL(b.prelude) && !!sizeD;
      if (!sizeD) { if (clip) clipNoSize++; continue; }
      if (!clip && !(util && hasTruncate)) continue;
      const kind = clip ? "rule" : "utility";
      // السياقات: الجذر، وكل تمهيدٍ يعرّف متغيّرًا تستعمله القاعدة (غير أدوات leading-*)
      const used = varsIn(sizeD[1] + " " + (lhD ? lhD[1] : ""));
      const ctxs = new Set([null]);
      for (const n of used) if (!IGNORED_VARS.has(n)) for (const x of defs.get(n) || []) if (!x.base && !/^\.leading-/.test(x.sel)) ctxs.add(x.sel);
      for (const ctx of ctxs) {
        const look = lookupIn(ctx);
        for (const sv of substVars(sizeD[1], look)) {
          let F;
          try { const r = evalCss(sv, 16); if (r.d !== "px") continue; F = r.v; } catch { continue; }
          if (!(F >= 8 && F <= 72)) continue;
          const lhAlts = lhD ? substVars(lhD[1], look) : [String(baseLh)];
          for (const lv of lhAlts) {
            let L;
            try { const r = evalCss(lv, F); L = r.d === "px" ? r.v : r.v * F; } catch { continue; }
            if (!(L > 0)) continue;
            if (kind === "rule" && clampTreated(b)) { addClamp(dir, F, L, { kind: "rule", sel: b.prelude.slice(0, 80) }); continue; }
            const key = r2(F) + "/" + r2(L);
            if (!found.has(key)) found.set(key, { px: r2(F), lh: r2(L), sources: [] });
            const e = found.get(key);
            const src = { dir, sel: b.prelude.slice(0, 80), kind, lhFrom: lhD ? "rule" : "inherited " + baseLh };
            src.fixMargin = fixMarginOf(fix, { dir, kind, pre: b.prelude }, blockers);
            if (!e.sources.some((x) => x.dir === src.dir && x.sel === src.sel)) e.sources.push(src);
          }
        }
      }
    }
    notes.push(`${dir}: ${blocks.length} كتلة، وأساس السطر الموروث ${baseLh}، و.truncate ${hasTruncate ? "موجود" : "غائب"}، وقواعد قصٍّ بلا حجم خطٍّ (تُمثَّل بأحجام الأدوات) ${clipNoSize}`);
  }
  // الحدّ الأدنى في التصميم (§٤.٦): يُضاف ما لم تستخرجه الأداة، موسومًا بمصدره
  const floor = [
    [14, 20, "text-sm (التصميم)"], [13, 17, "caption (التصميم)"], [12, 15, "footnote (التصميم)"],
    [14, 14, "line-height:1 — .leading-none مع .truncate"], [16, 27.2, "متن RTL بـ 1.7 (base.css:18-20)"],
  ];
  for (const [F, L, why] of floor) {
    const key = r2(F) + "/" + r2(L);
    if (!found.has(key)) found.set(key, { px: F, lh: L, sources: [] });
    const e = found.get(key);
    const src = { dir: F === 16 ? "base.css" : "sitecss", sel: why, kind: F === 16 ? "rtl-body" : "utility", lhFrom: "design" };
    src.fixMargin = fixMarginOf(fix, src, blockers);
    e.sources.push(src);
  }
  // أزواج القطع المحصورة (fonts.clamp.json): في سياق لقطتها إن عالجها ملف نقطتها، وإلا في القائمة الرئيسة بلا علاج
  if (clampData) for (const [dir, c] of Object.entries(clampData.contexts)) for (const x of c.pairs) {
    if (clampFix && clampFix.dirs[dir] && clamp[dir]) { addClamp(dir, x.px, x.lh, { kind: "inventory", n: x.n, sel: (x.examples || [])[0] || "", lines: x.lines }); continue; }
    const key = r2(x.px) + "/" + r2(x.lh);
    if (!found.has(key)) found.set(key, { px: r2(x.px), lh: r2(x.lh), sources: [] });
    found.get(key).sources.push({ dir, sel: "line-clamp: " + ((x.examples || [])[0] || ""), kind: "clamp", lhFrom: "inventory", fixMargin: null });
  }
  if (clampFix) for (const dir of Object.keys(clampFix.dirs)) if (clamp[dir] && !clamp[dir].size)
    notes.push(`${dir}: علاج القطع بلا أزواجٍ محصورة في fonts.clamp.json — يقع سياقه على وجه اليوم`);
  const list = [...found.values()].map((e) => {
    // الارتفاع «قابلٌ للعلاج» إن شمل العلاجُ النقطي (readSpotFix) كلَّ مصادره: القواعد بمحدِّداتها، والأدوات بـ .truncate
    // في موقعها؛ وهامشه أضيق هوامش مصادره. ومتن RTL (base.css) لا يشمله علاجٌ أبدًا
    e.fixable = e.sources.every((x) => x.fixMargin != null);
    e.margin = e.fixable ? Math.round(Math.min(...e.sources.map((x) => marginPx(x.fixMargin, e.px))) * 1000) / 1000 : 0;
    e.marginSpec = e.fixable ? [...new Set(e.sources.map((x) => x.fixMargin))].join("|") : null;
    e.ratio = Math.round((e.lh / e.px) * 1000) / 1000;
    e.claude = e.sources.some((x) => x.dir === "sitecss");
    return e;
  }).sort((a, b) => a.px - b.px || a.lh - b.lh);
  const clampOut = Object.fromEntries(Object.entries(clamp).sort().map(([d, m]) => [d, [...m.values()].sort((a, b) => a.px - b.px || a.lh - b.lh)]));
  return { list, clamp: clampOut, notes };
}

// ---- ٢. المدوّنة: كل عبارةٍ عربية ≤ 40 حرفًا في القواميس المشحونة (النصوص، وصيغ الجمع، وقوالب الأنماط) ----
const HAS_AR = /[؀-ۿݐ-ݿࡰ-ࣿﭐ-﷿ﹰ-ﻼ]/;
export function buildCorpus(maxLen = 40) {
  const set = new Set();
  let files = 0, total = 0;
  const add = (s) => {
    if (typeof s !== "string") return;
    total++;
    const t = s.replace(/\$\d+|%\d*\$?[ds]|\{[^{}]*\}/g, "3").trim(); // العناصر النائبة ← رقمٌ غربي (بخط الموقع كما في الواقع)
    if (t && [...t].length <= maxLen && HAS_AR.test(t)) set.add(t);
  };
  for (const f of fs.readdirSync(P.DICTS).filter((x) => /\.json$/.test(x)).sort()) {
    const d = JSON.parse(fs.readFileSync(path.join(P.DICTS, f), "utf8"));
    files++;
    for (const v of Object.values(d.strings || {})) add(v);
    for (const v of Object.values(d.plurals || {})) for (const x of (v && v.forms) || []) add(x);
    for (const p of d.patterns || []) add(p && p.ar);
  }
  return { phrases: [...set].sort(), files, total };
}

// ---- ٣. صندوق العلامة وارتفاع x من صفحة وثائق المنصة العامة (الطلب الشبكي الوحيد في المعايرة) ----
export const BRAND_PAGE = "https://platform.claude.com/docs/en/intro";
const CHROME_QUIET = ["--disable-background-networking", "--disable-component-update", "--disable-sync", "--disable-default-apps",
  "--no-pings", "--disable-domain-reliability", "--disable-client-side-phishing-detection", "--renderer-process-limit=1"];

// صندوق العلامة المتوقَّع من وجوه «… Fallback» في لقطة الوثائق: asc = ascent-override × size-adjust (والمثل للنزول)
export function brandFromSnapshot() {
  const out = {};
  let files = [];
  try { files = fs.readdirSync(snapPath("sitecss-docs")).filter((f) => f.endsWith(".css")); } catch {}
  for (const f of files) for (const b of innerBlocks(fs.readFileSync(path.join(snapPath("sitecss-docs"), f), "utf8"))) {
    if (!/^@font-face$/i.test(b.prelude)) continue;
    const d = Object.fromEntries(declsOf(b.body));
    const fam = (d["font-family"] || "").replace(/["']/g, "");
    const m = /^anthropic(Sans|Serif) Fallback$/.exec(fam);
    if (!m) continue;
    const pct = (k) => parseFloat(d[k]) / 100, sa = pct("size-adjust");
    out[m[1] === "Sans" ? "ui" : "read"] = { asc: Math.round(pct("ascent-override") * sa * 10000) / 10000, desc: Math.round(pct("descent-override") * sa * 10000) / 10000 };
  }
  return out;
}

export async function measureBrand(chrome) {
  const { launch, settle } = await import("./cdp-lib.mjs");
  const host = new URL(BRAND_PAGE).host;
  // كل مضيفٍ غير صفحة الوثائق لا يُحلّ: لا تحليلات ولا طرفٌ ثالث
  const cdp = await launch({ chrome, extraArgs: [...CHROME_QUIET, `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE ${host}`] });
  try {
    const { targetId, sessionId } = await cdp.openPage(BRAND_PAGE);
    await settle(cdp, sessionId, { quietMs: 1200, maxMs: 25000 });
    const r = await cdp.evalIn(sessionId, `(async () => {
      const fams = {}; document.fonts.forEach((f) => { const n = f.family.replace(/^["']|["']$/g, ""); if (/^anthropic(Sans|Serif)$/.test(n)) fams[n] = (fams[n] || []).concat(f.weight + "|" + f.style); });
      const out = { url: location.href, title: document.title, fams, roles: {} };
      const cv = document.createElement("canvas").getContext("2d");
      for (const [role, fam] of [["ui", "anthropicSans"], ["read", "anthropicSerif"]]) {
        if (!fams[fam]) { out.roles[role] = { missing: fam }; continue; }
        await document.fonts.load("400 1000px " + fam, "xHg");
        const ok = document.fonts.check("400 1000px " + fam, "x");
        cv.font = "400 1000px " + fam;
        const x = cv.measureText("x"), H = cv.measureText("H");
        // الصندوق كما يرسمه المتصفح: سطرٌ بارتفاعٍ عادي وعلامةٌ على خط الأساس
        const el = document.createElement("div"); el.style.cssText = "position:absolute;top:0;left:0;white-space:nowrap;line-height:normal;font:400 1000px " + fam;
        el.textContent = "Hx"; const p = document.createElement("span"); p.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline"; el.appendChild(p);
        document.body.appendChild(el); const rc = el.getBoundingClientRect(), base = p.getBoundingClientRect().bottom; el.remove();
        out.roles[role] = { fam, loaded: ok, px: 1000, x: x.actualBoundingBoxAscent / 1000, cap: H.actualBoundingBoxAscent / 1000,
          asc: x.fontBoundingBoxAscent / 1000, desc: x.fontBoundingBoxDescent / 1000, domUp: (base - rc.top) / 1000, domDown: (rc.bottom - base) / 1000 };
      }
      return out;
    })()`, 60000);
    await cdp.closePage(targetId);
    return r;
  } finally {
    try { await cdp.send("Browser.close", {}, null, 3000); } catch {}
    cdp.close();
  }
}

// ---- ٤. محرّك القياس داخل الصفحة (about:blank، وكل مضيفٍ لا يُحلّ) ----
// الحبر بـ measureText في لوحة رسم: حدود الرموز كما يرسمها المتصفح بحجمها الفعلي (مقرَّبةً إلى البكسل كما في الرسم)،
// والفسحة من DOM بوجهٍ يحمل صندوق العلامة. الحروف الإنجليزية بخط Segoe UI المحلي بمدًى لا يشمل العربية (موضع خط العلامة)،
// والعربية بالخط المقيس وحده، و size-adjust مكافئٌ لرسمه بحجم F×s (يُتحقَّق منه في الصفحة).
const PAGE_ENGINE = String.raw`(() => {
  const E = window.CAL = {};
  const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length % 2 ? b[b.length >> 1] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2; };
  const pct = (x) => (Math.round(x * 100000) / 1000) + "%";
  const dec = (s) => Uint8Array.fromBase64 ? Uint8Array.fromBase64(s).buffer : E.atobDec(s);
  E.atobDec = (s) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  E.init = async (cfg) => {
    E.cfg = cfg; E.cv = document.createElement("canvas").getContext("2d");
    E.arRe = new RegExp("[" + cfg.arClass + "]", "u");
    E.N = cfg.corpus.length;
    E.ar = cfg.corpus.map((t) => Array.from(t, (ch) => (E.arRe.test(ch) ? ch : " ")).join(""));
    // الحبر يُقاس كلمةً كلمة: حدود العبارة العمودية أقصى حدود كلماتها (التشكيل لا يعبر المسافة)، والكلمات الفريدة أقلّ من العبارات بكثير
    const wi = new Map(); E.words = []; E.pw = E.ar.map((t) => t.split(/ +/).filter(Boolean).map((w) => { if (!wi.has(w)) { wi.set(w, E.words.length); E.words.push(w); } return wi.get(w); }));
    E.W = E.words.length;
    E.la = cfg.corpus.map((t) => Array.from(t, (ch) => (E.arRe.test(ch) ? " " : ch)).join(""));
    E.hasLa = E.la.map((t) => /\S/.test(t));
    E.buf = {}; E.faces = [];
    const add = async (ff) => { document.fonts.add(ff); E.faces.push(ff); await ff.load(); return ff.status; };
    const st = {};
    for (const role of ["ui", "read"]) {
      const b = cfg.B[role];
      st["Site_" + role] = await add(new FontFace("Site_" + role, "local('Segoe UI')", { unicodeRange: cfg.siteRange, ascentOverride: pct(b.asc), descentOverride: pct(b.desc), lineGapOverride: "0%" }));
    }
    for (const f of cfg.fonts) {
      E.buf[f.id] = dec(f.b64);
      st["Ink_" + f.id] = await add(new FontFace("Ink_" + f.id, E.buf[f.id], { unicodeRange: cfg.AR, weight: "100 1000" }));
    }
    // وجه «اليوم» في علاج القطع (cml-ar-today بوزن 400) بمصدره ومداه كما في *-point.css، بلا تجاوز
    if (cfg.today) st.Today = await add(new FontFace("CmlToday", cfg.today, { unicodeRange: cfg.AR }));
    E.cache = new Map(); E.em = {};
    return st;
  };
  E.fam = (id) => (id === "ref" ? '"Segoe UI"' : id === "today" ? "CmlToday" : "Ink_" + id);
  // حبر الكلمات wIdx بحجمٍ فعليٍّ px: [up, down] بالبكسل
  E.inkW = (id, px, wIdx, weight) => {
    const cv = E.cv; cv.font = (weight || 400) + " " + px + "px " + E.fam(id);
    const up = new Float32Array(wIdx.length), dn = new Float32Array(wIdx.length);
    for (let k = 0; k < wIdx.length; k++) { const m = cv.measureText(E.words[wIdx[k]]); up[k] = m.actualBoundingBoxAscent; dn[k] = m.actualBoundingBoxDescent; }
    return { up, dn };
  };
  E.allW = () => { const a = new Array(E.W); for (let i = 0; i < E.W; i++) a[i] = i; return a; };
  E.emOf = (id, weight) => { const k = id + "|" + (weight || 400); if (!E.em[k]) { const r = E.inkW(id, 200, E.allW(), weight); for (let i = 0; i < E.W; i++) { r.up[i] /= 200; r.dn[i] /= 200; } E.em[k] = r; } return E.em[k]; };
  // حبر كل الكلمات بحجمٍ فعلي: المرشَّحة تُقاس، وغيرها بالتقدير المتدرّج (وهو بعيدٌ عن الحدّ بأكثر من PRUNE)
  E.wordsAt = (id, Ef, needUp, needDn) => {
    const em = E.emOf(id), up = new Float32Array(E.W), dn = new Float32Array(E.W), cand = [];
    for (let w = 0; w < E.W; w++) {
      up[w] = Math.ceil(em.up[w] * Ef - 0.01); dn[w] = Math.ceil(em.dn[w] * Ef - 0.01);
      if (up[w] > needUp || dn[w] > needDn) cand.push(w);
    }
    if (cand.length) { const ex = E.inkW(id, Ef, cand); for (let k = 0; k < cand.length; k++) { up[cand[k]] = ex.up[k]; dn[cand[k]] = ex.dn[k]; } }
    return { up, dn, cand: cand.length };
  };
  E.phraseInk = (wa, i) => { let u = 0, d = 0; for (const w of E.pw[i]) { if (wa.up[w] > u) u = wa.up[w]; if (wa.dn[w] > d) d = wa.dn[w]; } return [u, d]; };
  E.latin = (px) => {
    const k = "la|" + px; if (E.cache.has(k)) return E.cache.get(k);
    const cv = E.cv; cv.font = "400 " + px + "px Site_ui";
    const up = new Float32Array(E.N), dn = new Float32Array(E.N);
    for (let i = 0; i < E.N; i++) if (E.hasLa[i]) { const m = cv.measureText(E.la[i]); up[i] = m.actualBoundingBoxAscent; dn[i] = m.actualBoundingBoxDescent; }
    const r = { up, dn }; E.cache.set(k, r); return r;
  };
  E.room = (role, px, lh) => {
    const el = document.createElement("div");
    el.style.cssText = "position:absolute;top:0;left:0;white-space:nowrap;font-family:Site_" + role + ";font-size:" + px + "px;line-height:" + lh + "px";
    el.textContent = "Hx"; const p = document.createElement("span"); p.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline"; el.appendChild(p);
    document.body.appendChild(el); const r = el.getBoundingClientRect(), b = p.getBoundingClientRect().bottom; el.remove();
    return { up: b - r.top, down: r.bottom - b, h: r.height };
  };
  // تحقّق النموذج: (١) size-adjust يساوي الرسم بحجم F×s، (٢) حبر العبارة = أقصى حبر كلماتها، (٣) خطأ التقدير المتدرّج محدود
  E.check = async (id, px, s) => {
    const cv = E.cv, idx = []; for (let i = 0; i < E.N; i += 5) idx.push(i);
    const res = { id, px, s };
    const all = E.inkW(id, px * s, E.allW());
    cv.font = "400 " + (px * s) + "px " + E.fam(id);
    let wv = 0; for (const i of idx) { const m = cv.measureText(E.ar[i]), [u, d] = E.phraseInk(all, i); wv = Math.max(wv, Math.abs(m.actualBoundingBoxAscent - u), Math.abs(m.actualBoundingBoxDescent - d)); }
    res.phraseVsWords = +wv.toFixed(3);
    if (id !== "ref") {
      const fam = "Chk_" + id + "_" + Math.round(s * 100);
      const ff = new FontFace(fam, E.buf[id], { unicodeRange: E.cfg.AR, weight: "100 1000", sizeAdjust: pct(s) }); document.fonts.add(ff); await ff.load();
      cv.font = "400 " + px + "px " + fam; let adj = 0;
      for (const i of idx) { const m = cv.measureText(E.ar[i]), [u, d] = E.phraseInk(all, i); adj = Math.max(adj, Math.abs(m.actualBoundingBoxAscent - u), Math.abs(m.actualBoundingBoxDescent - d)); }
      document.fonts.delete(ff); res.sizeAdjustVsScaled = +adj.toFixed(3);
    }
    const em = E.emOf(id); let lo = 0, hi = 0;
    for (let w = 0; w < E.W; w++) for (const [x, e] of [[all.up[w], em.up[w]], [all.dn[w], em.dn[w]]]) { const d = x - Math.ceil(e * px * s - 0.01); if (d < lo) lo = d; if (d > hi) hi = d; }
    res.estErr = [+lo.toFixed(3), +hi.toFixed(3)];
    return res;
  };
  // نسبة المقصوص وأعمقه لكل ارتفاع، ومعها العلاج النقطي (هامش h.margin بعد صندوق الحشوة) للارتفاعات القابلة له.
  // التقدير المتدرّج يصفّي الكلمات البعيدة عن الحدّ بأكثر من prune، والقياس الفعلي يحكم في الباقي (prune = Infinity: كلها فعلية).
  // refs (اختياري: {key: [n, deepest]} لخط النظام اليوم بلا علاج) ← need: أصغر هامشٍ يجتاز به الخطُّ عند الارتفاع (للاطلاع)
  E.stats = (id, s, role, heights, prune, refs) => {
    const out = [], groups = new Map();
    for (const h of heights) { if (!groups.has(h.px)) groups.set(h.px, []); groups.get(h.px).push(h); }
    const r1 = (x) => Math.round(x * 10) / 10;
    for (const [F, hs] of groups) {
      const Ef = F * s, la = E.latin(F);
      const needUp = Math.min(...hs.map((h) => h.rooms[role].up)) - prune, needDn = Math.min(...hs.map((h) => h.rooms[role].down)) - prune;
      const wa = E.wordsAt(id, Ef, needUp, needDn);
      const pu = new Float32Array(E.N), pd = new Float32Array(E.N);
      for (let i = 0; i < E.N; i++) { const [u, d] = E.phraseInk(wa, i); pu[i] = Math.max(u, la.up[i]); pd[i] = Math.max(d, la.dn[i]); }
      for (const h of hs) {
        const room = h.rooms[role], margin = h.fixable ? h.margin : 0, ds = refs && h.fixable ? [] : null;
        let n = 0, nFix = 0, deep = 0, nUp = 0, nDn = 0, worst = -1;
        for (let i = 0; i < E.N; i++) {
          const u = pu[i] - room.up, d = pd[i] - room.down, depth = Math.max(0, u, d);
          if (depth > 0.5) { n++; if (u > 0.5) nUp++; if (d > 0.5) nDn++; if (ds) ds.push(depth); }
          if (h.fixable && depth - margin > 0.5) nFix++;
          if (depth > deep) { deep = depth; worst = i; }
        }
        let need = null;
        if (ds && refs[h.key]) { // أصغر هامش m: عددُ ما يتجاوز m + 0.5 ≤ عدد المرجع، و (الأعمق − m) ≤ أعمق المرجع
          const [rn, rd] = refs[h.key]; ds.sort((a, b) => b - a);
          need = Math.max(0, ds.length > rn ? ds[rn] - 0.5 : 0, deep - rd - 0.05);
          need = Math.ceil(need * 10 - 1e-9) / 10;
        }
        out.push({ key: h.key, n, nUp, nDn, share: n / E.N, deepest: r1(deep), shareFix: (h.fixable ? nFix : n) / E.N,
          deepestFix: r1(h.fixable ? Math.max(0, deep - margin) : deep), need, worst: worst >= 0 ? E.cfg.corpus[worst] : null, cand: wa.cand });
      }
    }
    const order = new Map(heights.map((h, i) => [h.key, i]));
    return out.sort((a, b) => order.get(a.key) - order.get(b.key));
  };
  // جسم الحرف العربي: وسيط ارتفاع حبر «ـسـ ـصـ ـمـ و» فوق خط الأساس بـ em (عند size-adjust 100٪)
  E.body = (id) => { const cv = E.cv; cv.font = "400 1000px " + E.fam(id);
    const v = E.cfg.bodyGlyphs.map((g) => cv.measureText(g).actualBoundingBoxAscent / 1000); return { body: med(v), each: v.map((x) => Math.round(x * 10000) / 10000) }; };
  // العرض: متوسط عرض العبارات بحجم 14 بكسل بالتركيب الفعلي (حروف الموقع الإنجليزية، وعربيتنا بـ size-adjust)
  E.width = async (id, s) => {
    let fam = 'Site_ui, "Segoe UI"';
    E.made = E.made || new Set();
    if (id !== "ref") { fam = "W_" + id + "_" + Math.round(s * 1000); if (!E.made.has(fam)) { E.made.add(fam);
      // الوجهان بواصفاتٍ واحدة (الوزن والنمط والتمدد) وإلا لم ينضمّا في عائلةٍ واحدة وسقطت الحروف الإنجليزية إلى خط المتصفح
      const a = new FontFace(fam, "local('Segoe UI')", { unicodeRange: E.cfg.siteRange }); const b = new FontFace(fam, E.buf[id], { unicodeRange: E.cfg.AR, sizeAdjust: pct(s) });
      document.fonts.add(a); document.fonts.add(b); await a.load(); await b.load(); } }
    const cv = E.cv; cv.font = "400 14px " + fam; let w = 0;
    for (let i = 0; i < E.N; i++) w += cv.measureText(E.cfg.corpus[i]).width;
    return w / E.N;
  };
  // الزر تحت line-height: normal: سطرٌ عربي ببناء a و d يساوي نظيره الإنجليزي
  E.button = async (id, m, role) => {
    const fam = "Btn_" + id + "_" + role;
    const a = new FontFace(fam, "local('Segoe UI')", { unicodeRange: E.cfg.siteRange, ascentOverride: pct(E.cfg.B[role].asc), descentOverride: pct(E.cfg.B[role].desc), lineGapOverride: "0%" });
    const b = new FontFace(fam, E.buf[id], { unicodeRange: E.cfg.AR, sizeAdjust: pct(m.s), ascentOverride: pct(m.a), descentOverride: pct(m.d), lineGapOverride: "0%" });
    document.fonts.add(a); document.fonts.add(b); await a.load(); await b.load();
    const h = (t, f) => { const el = document.createElement("button"); el.style.cssText = "font:400 14px " + (f || fam) + ";line-height:normal;padding:4px 8px;border:0"; el.textContent = t; document.body.appendChild(el); const v = el.getBoundingClientRect().height; el.remove(); return v; };
    const siteOnly = h("New chat", "Site_" + role);
    const en = h("New chat"), ar = h("محادثة جديدة"), mixed = h("محادثة Claude");
    document.fonts.delete(a); document.fonts.delete(b);
    return { siteOnly, en, ar, mixed };
  };
  // كلفة الإقلاع: فكّ base64 ثم بناء الوجه وإضافته (وسيط 5)، بـ fromBase64 (الحاضر) وبحلقة atob (أرضية Chrome 102)
  E.cost = async (id, b64, runs, warm) => {
    warm = warm === undefined ? 2 : warm;
    const one = async (useAtob, r) => {
      const t0 = performance.now();
      const buf = useAtob || !Uint8Array.fromBase64 ? E.atobDec(b64) : Uint8Array.fromBase64(b64).buffer;
      const t1 = performance.now();
      const ff = new FontFace("Cost_" + id + "_" + (useAtob ? "a" : "f") + r + "_" + Math.random().toString(36).slice(2), buf, { unicodeRange: E.cfg.AR, weight: "300 800", style: "normal", display: "swap" });
      const t2 = performance.now();
      document.fonts.add(ff);
      const t3 = performance.now();
      await ff.loaded;
      const t4 = performance.now();
      document.fonts.delete(ff);
      return { decode: t1 - t0, face: t2 - t1, add: t3 - t2, boot: t3 - t0, loaded: t4 - t0, status: ff.status };
    };
    const res = {};
    for (const mode of ["fromBase64", "atob"]) {
      const rs = [];
      for (let r = 0; r < runs + warm; r++) { const x = await one(mode === "atob", r); if (r >= warm) rs.push(x); await new Promise((z) => setTimeout(z, 60)); } // التسخين لا يُحسب
      const pick = (k) => med(rs.map((x) => x[k]));
      res[mode] = { decode: pick("decode"), face: pick("face"), add: pick("add"), boot: pick("boot"), loaded: pick("loaded"), all: rs.map((x) => Math.round(x.boot * 10) / 10), status: rs[0].status };
    }
    res.hasFromBase64 = !!Uint8Array.fromBase64;
    return res;
  };
  return true;
})()`;

// ---- ٥. جمع القياسات ----
// مدى التصميم (§٤.٥)، ويُقدَّم عليه C.FONT_AR_RANGE متى كتبه الفهرس
export const DESIGN_AR_RANGE = "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+204F, U+2E41, " +
  "U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB, U+10E60-10E7E, U+10EC2-10EC4, U+10EFC-10EFF, " +
  "U+1EE00-1EE03, U+1EE05-1EE1F, U+1EE21-1EE22, U+1EE24, U+1EE27, U+1EE29-1EE32, U+1EE34-1EE37, U+1EE39, U+1EE3B, " +
  "U+1EE42, U+1EE47, U+1EE49, U+1EE4B, U+1EE4D-1EE4F, U+1EE51-1EE52, U+1EE54, U+1EE57, U+1EE59, U+1EE5B, U+1EE5D, " +
  "U+1EE5F, U+1EE61-1EE62, U+1EE64, U+1EE67-1EE6A, U+1EE6C-1EE72, U+1EE74-1EE77, U+1EE79-1EE7C, U+1EE7E, " +
  "U+1EE80-1EE89, U+1EE8B-1EE9B, U+1EEA1-1EEA3, U+1EEA5-1EEA9, U+1EEAB-1EEBB, U+1EEF0-1EEF1";
// موضع خط العلامة: كل ما خرج عن المدى العربي (Segoe UI المحلي يحمل العربية، فتُستثنى منه)
const SITE_RANGE = "U+0000-05FF, U+0700-074F, U+0780-086F, U+2000-200B, U+200F-204E, U+2050-2E40, U+2E42-FB4F, U+FE00-FE6F, U+FF00-FFFF";
const BODY_GLYPHS = ["ـسـ", "ـصـ", "ـمـ", "و"];
const S_MIN = 0.9, S_MAX = 1.2, K_BODY = 1.0;
const clampS = (x) => Math.min(S_MAX, Math.max(S_MIN, x));
const floor2 = (x) => Math.floor(x * 100 + 1e-9) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;

function arClassOf(range) {
  return rangesOf(range).map(([a, b]) => (a === b ? `\\u{${a.toString(16)}}` : `\\u{${a.toString(16)}}-\\u{${b.toString(16)}}`)).join("");
}

// يجتاز الخطُّ عند s إن لم تزد عند أي ارتفاعٍ نسبةُ المقصوص ولا أعمقُه على خط النظام اليوم (بالعلاج النقطي أو بدونه).
// والعلاج معلَّقٌ على سمة الخط (C.FONT_ATTR) فلا يسري على «اليوم» أبدًا: المرجع بلا علاجٍ في الحالين.
// strict (للاطلاع لا للحكم): المرجع بالعلاج نفسه، أي لو سرى العلاج على الخيارات كلها
export function passesAt(st, ref, fix, strict = false) {
  const fails = [];
  const byKey = new Map(ref.map((r) => [r.key, r]));
  for (const h of st) {
    const r = byKey.get(h.key);
    const [n, d] = fix ? [h.shareFix, h.deepestFix] : [h.share, h.deepest];
    const [rn, rd] = fix && strict ? [r.shareFix, r.deepestFix] : [r.share, r.deepest];
    if (n > rn + 1e-12 || d > rd + 1e-9) fails.push({ key: h.key, share: n, deepest: d, ref: { share: rn, deepest: rd } });
  }
  return fails;
}

// كلفة الإقلاع (§٤.٧): عادية، ثم بإبطاء المعالج أربعة أضعاف (للاطلاع). والأرقام تتبع حِمل الجهاز، فتنتظر هدوءه (نافذة 3 ثوانٍ
// بحِملٍ ≤ 40٪، إلى دقيقتين) وتسجّل حِمله قبلها وفي أثناء القياس العادي (os.cpus، ومنه كروم نفسه)
const cpuT = () => os.cpus().reduce((a, c) => { const x = c.times; a.idle += x.idle; a.total += x.user + x.nice + x.sys + x.idle + x.irq; return a; }, { idle: 0, total: 0 });
const cpuBusy = (a, b) => Math.round(100 * (1 - (b.idle - a.idle) / Math.max(1, b.total - a.total)));
async function costPhase(cdp, sessionId, ev, items, log = console.log) {
  const cpu = { cores: os.cpus().length, before: 100, waited: 0 };
  for (let i = 0; i < 40; i++) { const a = cpuT(); await cdp.wait(3000); cpu.before = cpuBusy(a, cpuT()); cpu.waited += 3; if (cpu.before <= 40) break; }
  log(`حِمل المعالج قبل قياس الكلفة: ${cpu.before}٪ (بعد ${cpu.waited} ث)`);
  // بالتناوب: جولة تسخينٍ للخطوط كلها (تسخينان لكلٍّ لا يُحسبان)، ثم خمس جولاتٍ في كلٍّ منها قياسٌ واحد لكل خط، والوسيط
  // لكل خط. فلا يتحمّل الخط الأول وحده كلفةَ أول بناءٍ في الصفحة، ولا تقع ضوضاء لحظةٍ على خطٍّ واحد
  const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length % 2 ? b[b.length >> 1] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2; };
  const c1 = cpuT();
  for (const rate of [1, 4]) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate }, sessionId);
    for (const it of items) await ev(`CAL.cost(${JSON.stringify(it.rec.id)}, ${JSON.stringify(it.b64)}, 1, 2)`);
    const got = new Map(items.map((it) => [it.rec.id, []]));
    for (let r = 0; r < 5; r++) for (const it of items) got.get(it.rec.id).push(await ev(`CAL.cost(${JSON.stringify(it.rec.id)}, ${JSON.stringify(it.b64)}, 1, 0)`));
    for (const it of items) {
      const rs = got.get(it.rec.id), res = { hasFromBase64: rs[0].hasFromBase64 };
      for (const mode of ["fromBase64", "atob"]) {
        const pick = (k) => med(rs.map((x) => x[mode][k]));
        res[mode] = { decode: pick("decode"), face: pick("face"), add: pick("add"), boot: pick("boot"), loaded: pick("loaded"),
          all: rs.map((x) => Math.round(x[mode].boot * 10) / 10), status: rs[0][mode].status };
      }
      (it.rec.cost = it.rec.cost || {})["x" + rate] = res;
    }
    if (rate === 1) cpu.during = cpuBusy(c1, cpuT());
  }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }, sessionId);
  return cpu;
}
// إعادة قياس الكلفة وحدها على نتيجة قياسٍ سابق (--cost-only): حين كان الجهاز مشغولًا في القياس الكامل
async function costOnly(data, { chrome, log = console.log } = {}) {
  await import(pathToFileURL(path.join(P.EXT, "cml-const.js")).href);
  const C = globalThis.CMLConst || {};
  const AR = C.FONT_AR_RANGE || DESIGN_AR_RANGE;
  const { launch } = await import("./cdp-lib.mjs");
  const cdp = await launch({ chrome, extraArgs: [...CHROME_QUIET, "--host-resolver-rules=MAP * ~NOTFOUND"] });
  try {
    const { sessionId } = await cdp.openPage("about:blank");
    await cdp.wait(300);
    const ev = (expr, ms = 600000) => cdp.evalIn(sessionId, expr, ms);
    await ev(PAGE_ENGINE);
    const fonts = data.fonts.map((f) => ({ id: f.id, b64: fs.readFileSync(path.join(FONTS_DIR, f.id + ".woff2")).toString("base64") }));
    await ev(`CAL.init(${JSON.stringify({ AR, arClass: arClassOf(AR), siteRange: SITE_RANGE, B: data.B, bodyGlyphs: BODY_GLYPHS, corpus: ["ا"], fonts })})`);
    for (const f of data.fonts) f.cost = {};
    data.cpu = await costPhase(cdp, sessionId, ev, data.fonts.map((f) => ({ rec: f, b64: fonts.find((x) => x.id === f.id).b64 })), log);
    data.costMeasured = { when: today(), gregorianISO: new Date().toISOString() };
    return data;
  } finally {
    try { await cdp.send("Browser.close", {}, null, 3000); } catch {}
    cdp.close();
  }
}

async function collectCalibration({ outDir, brandFrom, prune, only, chrome, statsOnly, log = console.log }) {
  const lock = readLock();
  const fonts = lock.fonts.filter((e) => (!only || only.includes(e.id)) && fs.existsSync(path.join(FONTS_DIR, e.id + ".woff2")));
  await import(pathToFileURL(path.join(P.EXT, "cml-const.js")).href);
  const C = globalThis.CMLConst || {};
  const AR = C.FONT_AR_RANGE || DESIGN_AR_RANGE;
  if (!C.FONT_ATTR) throw new Error("C.FONT_ATTR غائب من cml-const.js — لا يُعرف على أيّ سمةٍ يُعلَّق العلاج النقطي");
  const fix = readSpotFix(C.FONT_ATTR);
  if (fix.errors.length) throw new Error("العلاج النقطي لا يُفهم:\n  - " + fix.errors.join("\n  - "));
  const clampFix = readClampFix(C.FONT_ATTR, P.EXT, AR);
  if (clampFix.errors.length) throw new Error("علاج القطع بعدد الأسطر لا يُفهم:\n  - " + clampFix.errors.join("\n  - "));
  let clampData = null;
  if (Object.keys(clampFix.dirs).length) {
    try { clampData = readClampData(); } catch (e) { throw new Error("علاج القطع في *-point.css بلا حصرٍ صالح لأزواجه (" + path.basename(CLAMP_PATH) + "): " + e.message + " — شغّل «fonts.mjs clamp --from=<inventory.json>»"); }
  }
  const { list: heights, clamp: clampCtx, notes } = extractHeights({ fix, clampFix, clampData });
  heights.forEach((h) => { h.key = h.px + "/" + h.lh; });
  // سياقات القطع: لكل لقطةٍ عالجها ملف نقطتها أزواجُها الحقيقية، ومفتاحها «<ملف>:<px>/<lh>»
  const CTX = Object.fromEntries(Object.keys(clampCtx).map((d) => [d, POINT_CSS[d].replace(/-point\.css$/, "")]));
  const clampH = Object.entries(clampCtx).flatMap(([d, ps]) => ps.map((x) => ({ ...x, ctx: CTX[d], dir: d, key: CTX[d] + ":" + x.px + "/" + x.lh })));
  const margins = [...new Set(heights.filter((h) => h.fixable).map((h) => h.marginSpec))];
  log(`العلاج النقطي (من *-point.css على [${fix.attr}]): ${Object.values(fix.dirs).map((e) => e.file + " " + Object.keys(e.margins).length + " محدِّدات").join("، ") || "لا شيء"}؛ الهامش ${margins.join("، ") || "—"}؛ البصمة ${fix.sig.slice(0, 12)}`);
  log(`علاج القطع بعدد الأسطر: ${Object.entries(clampCtx).map(([d, ps]) => CTX[d] + " " + ps.length + " زوجًا").join("، ") || "لا شيء"}؛ البصمة ${clampFix.sig.slice(0, 12)}` +
    (clampData ? `؛ الحصر ${clampData.made.hijri} (${clampData.sig.slice(0, 12)})` : ""));
  const todayFace = Object.values(clampFix.dirs).flatMap((e) => e.today).find(coversRegular);
  const todaySrc = todayFace ? todayFace.locals.map((n) => `local("${n}")`).join(", ") : null;
  const corpus = buildCorpus();
  log(`المدوّنة: ${fmtN(corpus.phrases.length)} عبارةً عربيةً فريدة ≤ 40 حرفًا (من ${fmtN(corpus.total)} نصًّا في ${corpus.files} قواميس)`);
  log(`الارتفاعات ذات القصّ: ${heights.length} (بأحجام خطٍّ مختلفة: ${new Set(heights.map((h) => h.px)).size})`);

  // صندوق العلامة: الصعود والنزول من لقطة الوثائق (دقيقان)، ويؤكّدهما القياس الحيّ؛ و x من القياس الحيّ وحده
  let brand;
  if (brandFrom) brand = JSON.parse(fs.readFileSync(brandFrom, "utf8"));
  else { log("قياس خطَّي العلامة من " + BRAND_PAGE + " …"); brand = await measureBrand(chrome); brand.at = new Date().toISOString(); }
  fs.writeFileSync(path.join(outDir, "brand.json"), JSON.stringify(brand, null, 1));
  const snap = brandFromSnapshot();
  const B = {};
  for (const role of ["ui", "read"]) {
    const m = brand.roles && brand.roles[role];
    if (!m || !(m.x > 0)) throw new Error("قياس العلامة ناقص للدور " + role + ": " + JSON.stringify(m));
    const s = snap[role] || { asc: r4(m.asc), desc: r4(m.desc) };
    if (Math.abs(s.asc - m.asc) > 0.0011 || Math.abs(s.desc - m.desc) > 0.0011)
      throw new Error(`صندوق العلامة في اللقطة (${s.asc}/${s.desc}) لا يطابق القياس الحيّ (${m.asc}/${m.desc}) للدور ${role}`);
    B[role] = { x: r4(m.x), asc: s.asc, desc: s.desc };
  }
  log("B = " + JSON.stringify(B));

  const { launch } = await import("./cdp-lib.mjs");
  const cdp = await launch({ chrome, extraArgs: [...CHROME_QUIET, "--host-resolver-rules=MAP * ~NOTFOUND"] });
  const t0 = Date.now();
  try {
    const ver = await cdp.send("Browser.getVersion");
    const { sessionId } = await cdp.openPage("about:blank");
    await cdp.wait(300);
    const ev = (expr, ms = 600000) => cdp.evalIn(sessionId, expr, ms);
    await ev(PAGE_ENGINE);
    const cfg = { AR, arClass: arClassOf(AR), siteRange: SITE_RANGE, B, bodyGlyphs: BODY_GLYPHS, corpus: corpus.phrases, today: todaySrc,
      fonts: fonts.map((e) => ({ id: e.id, b64: fs.readFileSync(path.join(FONTS_DIR, e.id + ".woff2")).toString("base64") })) };
    const st = await ev(`CAL.init(${JSON.stringify(cfg)})`);
    const bad = Object.entries(st).filter(([, v]) => v !== "loaded");
    if (bad.length) throw new Error("أوجهٌ لم تُحمَّل: " + JSON.stringify(bad));
    // الفسحة لكل ارتفاعٍ ودور (الرئيسة وأزواج القطع معًا)
    const all = heights.concat(clampH);
    const rooms = await ev(`(${JSON.stringify(all.map((h) => [h.px, h.lh]))}).map(([px, lh]) => ({ ui: CAL.room("ui", px, lh), read: CAL.room("read", px, lh) }))`);
    all.forEach((h, i) => { h.rooms = rooms[i]; });
    const sameRooms = all.every((h) => Math.abs(h.rooms.ui.up - h.rooms.read.up) < 1e-6 && Math.abs(h.rooms.ui.down - h.rooms.read.down) < 1e-6);
    log("الفسحة محسوبة؛ فسحة الدورين " + (sameRooms ? "متطابقة عند كل ارتفاع" : "مختلفة"));
    const H = heights.map((h) => ({ key: h.key, px: h.px, fixable: h.fixable, margin: h.margin, rooms: h.rooms }));
    // عناصر القطع بلا هامش (overflow: hidden كما هو)، وبدور ui (عائلةٌ واحدة لكل الأدوار في عنصر القطع)
    const HC = clampH.map((h) => ({ key: h.key, px: h.px, fixable: false, margin: 0, rooms: h.rooms }));
    const statsC = async (id, s) => (HC.length ? ev(`CAL.stats(${JSON.stringify(id)}, ${s}, "ui", ${JSON.stringify(HC)}, ${id === "ref" || id === "today" ? "Infinity" : prune}, null)`) : []);
    // خط النظام ملمَّحٌ من ويندوز فيبتعد تقديره المتدرّج عن الفعلي: يُقاس كله فعليًّا (prune = Infinity)
    let refs = { ui: null, read: null };
    const statsOf = async (id, s) => {
      const pr = id === "ref" ? "Infinity" : prune;
      const ui = await ev(`CAL.stats(${JSON.stringify(id)}, ${s}, "ui", ${JSON.stringify(H)}, ${pr}, ${JSON.stringify(refs.ui)})`);
      const read = sameRooms ? ui : await ev(`CAL.stats(${JSON.stringify(id)}, ${s}, "read", ${JSON.stringify(H)}, ${pr}, ${JSON.stringify(refs.read)})`);
      return { ui, read };
    };
    // تحقّق النموذج
    const checks = [];
    for (const [id, px, s] of [["ref", 14, 1], ["ref", 12, 1], ...fonts.flatMap((e) => [[e.id, 14, 1], [e.id, 12, 0.93], [e.id, 30, 1]])]) {
      checks.push(await ev(`CAL.check(${JSON.stringify(id)}, ${px}, ${s})`));
    }
    log("تحقّق النموذج: " + JSON.stringify(checks));
    for (const c of checks) {
      if (c.phraseVsWords > 0.05) throw new Error(`حبر العبارة لا يساوي أقصى حبر كلماتها (${c.id} @ ${c.px}: ${c.phraseVsWords})`);
      if (c.sizeAdjustVsScaled !== undefined && c.sizeAdjustVsScaled > 0.05) throw new Error(`size-adjust لا يكافئ الرسم بحجم F×s (${c.id}: ${c.sizeAdjustVsScaled})`);
      if (c.id !== "ref" && c.estErr[1] >= prune - 0.5) throw new Error(`خطأ التقدير المتدرّج ${c.estErr[1]} بكسل لـ ${c.id} @ ${c.px} — ارفع --prune فوق ${c.estErr[1] + 0.5}`);
    }
    const refBody = await ev(`CAL.body("ref")`);
    let tt = Date.now();
    const ref = await statsOf("ref", 1);
    log(`خط النظام اليوم (Segoe UI): ${Date.now() - tt} مللي ثانية`);
    for (const role of ["ui", "read"]) refs[role] = Object.fromEntries(ref[role].map((r) => [r.key, [r.n, r.deepest]]));
    // المرجع في عناصر القطع، ووجه «اليوم» كما يعلنه CSS: يلزم أن يساوي المرجع عند كل زوج (وإلا فليس وجهَ اليوم)
    const refC = await statsC("ref", 1), todayC = todaySrc ? await statsC("today", 1) : [];
    const todayOff = todayC.filter((x, i) => Math.abs(x.share - refC[i].share) > 1e-12 || Math.abs(x.deepest - refC[i].deepest) > 1e-9);
    if (todayOff.length) throw new Error(`وجه ${CLAMP_TODAY} (${todaySrc}) لا يرسم كالمرجع عند ${todayOff.map((x) => x.key).join("، ")} — ليس وجهَ اليوم`);
    if (HC.length) log(`عناصر القطع: ${HC.length} زوجًا في ${Object.keys(clampCtx).length} سياقات؛ وجه ${CLAMP_TODAY} يساوي المرجع عند كلٍّ منها`);
    const refWidth = await ev(`CAL.width("ref", 1)`);
    const fixSummary = { attr: fix.attr, sig: fix.sig, canon: fix.canon };
    const out = { chrome: ver.product, when: today(), gregorianISO: new Date().toISOString(), margin: margins.length === 1 ? margins[0] : margins, prune,
      fixDirs: Object.keys(fix.dirs), fix: fixSummary, AR, B, brand, snapshotB: snap,
      clampFix: { attr: clampFix.attr, sig: clampFix.sig, canon: clampFix.canon }, clampData: clampData ? { sig: clampData.sig, made: clampData.made, source: clampData.source } : null,
      clampHeights: clampH.map(({ rooms, ...x }) => ({ ...x, rooms })), clampCtx: CTX, todaySrc,
      corpus: { n: corpus.phrases.length, total: corpus.total, files: corpus.files }, heights, notes, sameRooms, checks,
      ref: { body: refBody, stats: ref, width: refWidth, clamp: refC }, fonts: [] };
    for (const e of fonts) {
      tt = Date.now();
      const body = await ev(`CAL.body(${JSON.stringify(e.id)})`);
      const sx = { ui: B.ui.x * K_BODY / body.body, read: B.read.x * K_BODY / body.body };
      const memo = new Map();
      const at = async (s) => { s = Math.round(s * 100) / 100; if (!memo.has(s)) memo.set(s, await statsOf(e.id, s)); return memo.get(s); };
      const raw = await at(1);
      const search = {};
      for (const role of ["ui", "read"]) for (const fix of [false, true]) {
        const hi = floor2(clampS(sx[role]));
        const ok = async (s) => !passesAt((await at(s))[role], ref[role], fix).length;
        let s = null;
        if (await ok(hi)) s = hi;
        else if (await ok(S_MIN)) {
          let lo = S_MIN, top = hi;
          while (top - lo > 0.0101) { const mid = Math.round(((lo + top) / 2) * 100) / 100; if (mid <= lo || mid >= top) break; if (await ok(mid)) lo = mid; else top = mid; }
          s = lo;
        }
        search[role + (fix ? "+fix" : "")] = s;
      }
      const stats = {};
      for (const [k, s] of Object.entries(search)) if (s !== null) stats[k] = { s, st: (await at(s))[k.split("+")[0]], fails: [] };
      const failsAt = {};
      for (const role of ["ui", "read"]) for (const fix of [false, true]) failsAt[role + (fix ? "+fix" : "")] = passesAt((await at(S_MIN))[role], ref[role], fix);
      const points = {};
      for (const [k, v] of memo) points[k] = v.ui;
      const rec = { id: e.id, family: e.family, bytes: e.bytes, body, sx, raw: raw.ui, search, stats, failsAtMin: failsAt, evaluated: [...memo.keys()].sort(), points };
      // علاج القطع: لكل سياقٍ أكبرُ s_c في [CLAMP_S_MIN، s الوجه الرئيس] يجتاز به أزواجَه كلها (لا تزيد نسبة المقصوص ولا أعمقه على
      // اليوم بلا هامش)، وإلا فـ null: لا تُسجَّل المضغوطة فتقع العربية على وجه اليوم (يساوي المرجع بالقياس أعلاه)
      const sMain = search.ui != null ? search.ui : search["ui+fix"] != null ? search["ui+fix"] : floor2(clampS(sx.ui));
      const memoC = new Map();
      const atC = async (s) => { s = Math.round(s * 100) / 100; if (!memoC.has(s)) memoC.set(s, await statsC(e.id, s)); return memoC.get(s); };
      rec.clamp = {};
      for (const ctx of Object.values(CTX)) {
        const keys = new Set(clampH.filter((h) => h.ctx === ctx).map((h) => h.key));
        if (!keys.size) { rec.clamp[ctx] = { s: null, hi: sMain, pairs: 0, why: "لا أزواج محصورة", failsAtMin: [], failsAtHi: [] }; continue; }
        const failsAtC = async (s) => passesAt((await atC(s)).filter((x) => keys.has(x.key)), refC.filter((x) => keys.has(x.key)), false);
        let sc = null;
        if (!(await failsAtC(sMain)).length) sc = sMain;
        else if (!(await failsAtC(CLAMP_S_MIN)).length) {
          let lo = CLAMP_S_MIN, top = sMain;
          while (top - lo > 0.0101) { const mid = Math.round(((lo + top) / 2) * 100) / 100; if (mid <= lo || mid >= top) break; if (!(await failsAtC(mid)).length) lo = mid; else top = mid; }
          sc = lo;
        }
        rec.clamp[ctx] = { s: sc, hi: sMain, pairs: keys.size, failsAtMin: sc === null ? await failsAtC(CLAMP_S_MIN) : [], failsAtHi: await failsAtC(sMain) };
      }
      rec.clampPoints = Object.fromEntries(memoC);
      out.fonts.push(rec);
      log(`${e.id}: body ${body.body.toFixed(4)}، s_x ${sx.ui.toFixed(3)}، s_clip ${JSON.stringify(search)}، القطع ${Object.entries(rec.clamp).map(([c, x]) => c + "=" + (x.s ?? "اليوم")).join(" ")} — ${((Date.now() - tt) / 1000).toFixed(1)} ث (${memo.size}+${memoC.size} نقاط)`);
    }
    if (statsOnly) { out.seconds = Math.round((Date.now() - t0) / 1000); return out; }
    // العرض والزر بالقيم النهائية (تُحسب هنا لكل خطٍّ بـ s الدور ui مع العلاج وبدونه)
    for (const f of out.fonts) {
      // s المعتمد إن اجتاز (بالعلاج إن لزم)، وإلا s_x محصورًا في [0.90، 1.20] للاطلاع وحده
      f.sUse = f.search.ui != null ? f.search.ui : f.search["ui+fix"] != null ? f.search["ui+fix"] : floor2(clampS(f.sx.ui));
      f.width = { raw: await ev(`CAL.width(${JSON.stringify(f.id)}, 1)`), use: await ev(`CAL.width(${JSON.stringify(f.id)}, ${f.sUse})`) };
      f.button = await ev(`CAL.button(${JSON.stringify(f.id)}, ${JSON.stringify({ s: f.sUse, a: B.ui.asc / f.sUse, d: B.ui.desc / f.sUse })}, "ui")`);
    }
    out.cpu = await costPhase(cdp, sessionId, ev, out.fonts.map((f) => ({ rec: f, b64: cfg.fonts.find((x) => x.id === f.id).b64 })), log);
    out.seconds = Math.round((Date.now() - t0) / 1000);
    return out;
  } finally {
    try { await cdp.send("Browser.close", {}, null, 3000); } catch {}
    cdp.close();
  }
}

// ---- ٦. الحكم (§٢.١ الشرط 8، و§٤.٦، و§٤.٧، وق١) ----
export const bootBudget = (bytes) => 10 + 0.15 * (bytes / 1024);
export function verdictOf(data) {
  const rows = data.fonts.map((f) => {
    const need = {};
    for (const role of ["ui", "read"]) need[role] = f.search[role] != null ? { s: f.search[role], fix: false } : f.search[role + "+fix"] != null ? { s: f.search[role + "+fix"], fix: true } : null;
    const clipOk = !!(need.ui && need.read);
    const boot = f.cost && f.cost.x1 ? f.cost.x1.fromBase64.boot : null, budget = bootBudget(f.bytes);
    const costOk = boot != null && boot <= budget;
    const m = clipOk ? Object.fromEntries(["ui", "read"].map((role) => {
      const s = need[role].s, b = data.B[role];
      return [role, { s, a: r4(b.asc / s), d: r4(b.desc / s) }];
    })) : null;
    const why = [];
    if (!clipOk) {
      const fl = f.failsAtMin.ui, flx = f.failsAtMin["ui+fix"];
      why.push(`يقصّ أكثر من خط النظام اليوم حتى بأصغر حجمٍ مسموح (s = ${S_MIN.toFixed(2)}): عند ${flx.length} ارتفاعًا من ${data.heights.length} مع العلاج النقطي، و${fl.length} بدونه`);
    }
    if (!costOk && boot != null) why.push(`كلفة الإقلاع ${boot.toFixed(1)} مللي ثانية فوق ميزانيته ${budget.toFixed(1)}`);
    // علاج القطع لكل سياق: {s, a, d} للوجه المضغوط، أو null فوجه اليوم (لا يُسقط خطًّا: وجه اليوم لا يزيد القصّ بالبناء)
    const clamp = f.clamp ? Object.fromEntries(Object.entries(f.clamp).map(([c, x]) => [c, x.s == null ? null
      : { s: x.s, a: r4(data.B.ui.asc / x.s), d: r4(data.B.ui.desc / x.s) }])) : null;
    return { id: f.id, family: f.family, bytes: f.bytes, clipOk, costOk, keep: clipOk && costOk, needsFix: clipOk && (need.ui.fix || need.read.fix), m, clamp, why };
  });
  const kept = rows.filter((r) => r.keep);
  return { rows, kept, def: kept.length ? kept[0].id : null };
}

// ---- ٧. التقرير (عربي بتاريخٍ هجري) ----
const pctS = (x) => (x * 100).toFixed(1) + "٪";
const KEY_HEIGHTS = ["14/20", "12/16", "12.24/16", "13/17", "12/15", "11.29/15.06", "14/14", "13/17.55", "13/18.2", "14/22.4", "16/24", "16/27.2"];
export function calibrationReport(data, s3) {
  const V = verdictOf(data);
  const ref = new Map(data.ref.stats.ui.map((r) => [r.key, r]));
  const H = new Map(data.heights.map((h) => [h.key, h]));
  const keys = KEY_HEIGHTS.filter((k) => H.has(k));
  const at = (f, s) => f.points[String(s)] || f.points[s];
  const L = [];
  const p = (...x) => L.push(...x);
  const noneKept = !V.kept.length;
  p(`# تقرير معايرة الخطوط العربية`, "",
    `**${data.when.hijri}** (${data.when.gregorian}) · ${data.chrome} بلا واجهة على ويندوز 10، بكثافة بكسلٍ 1 · \`node web/code/toolchain/fonts.mjs measure\``, "");
  p("## الخلاصة", "");
  if (noneKept) {
    p(`- **لم يجتز أيُّ خطٍّ من الستة قاعدةَ القبول** (§٢.١ الشرط 8، §٤.٦): كلُّها يقصّ من الحروف والحركات أكثر مما يقصّ Segoe UI اليوم عند ارتفاعاتٍ كثيرة من المواقع، **حتى بأصغر حجمٍ تسمح به القاعدة (s = 0.90) ومع العلاج النقطي للقصّ (§٣.٢)**.`,
      `- **السبب الغالب ذيول الحروف تحت خط الأساس** (ي ن ر و ع ج …)، لا الحركات: Segoe UI العربي مضغوطٌ رأسيًّا على غير المعتاد، ففسحة ما تحت خط الأساس في صفٍّ مقطوعٍ ارتفاعه 20 بكسل (5 بكسل عند 14 بكسل) تسع ذيوله ولا تسع ذيول الخطوط الستة.`,
      `- **فلا افتراضيَّ بقاعدة ق١** (أولُ خطٍّ يجتاز بترتيب الطلبات)، لأن أحدًا لم يجتز.`,
      `- **لم يُحذف شيء ولم يُعدَّل القفل.** إسقاط الستة يُفرغ القفل فتسقط البوابة وتتوقف المجموعتان ٣ و٤، وإعادة التنزيل بعد الحذف تحتاج موافقةً جديدة (الموافقة القائمة لتنزيلٍ واحد). والتصميم يوجب إبلاغ المالك بالدليل قبل S6-B. فالأداة ترفض \`--apply\` حين لا يجتاز خطٌّ واحد.`,
      `- **المطلوب قرار المالك** (البدائل في §٧).`, "");
  } else {
    p(`- **يُبقى:** ${V.kept.map((r) => r.family).join("، ")}. **ويُسقط:** ${V.rows.filter((r) => !r.keep).map((r) => r.family + " (" + r.why.join("؛ ") + ")").join("، ") || "لا شيء"}.`,
      `- **الافتراضي:** ${V.rows.find((r) => r.id === V.def).family}${V.def === "cairo" ? "" : " (بقاعدة ق١: Cairo لم يجتز)"}.`, "");
  }
  // مثال رقمي حاسم عند text-sm
  const k0 = "14/20";
  if (H.has(k0)) {
    const R = ref.get(k0);
    p(`**عند \`text-sm\` ‏14/20 بكسل** (عناوين الشريط الجانبي في claude.ai، ونظيرتها في وثائق المنصة ووثائق Claude Code): يقصّ Segoe UI اليوم ${pctS(R.share)} من العبارات، وأعمق قصٍّ ${R.deepest} بكسل.`, "");
    p("| الخط | s = 1: المقصوص / الأعمق | s = 0.90: المقصوص / الأعمق |", "|---|---|---|");
    for (const f of data.fonts) {
      const a = at(f, 1).find((x) => x.key === k0), b = at(f, 0.9).find((x) => x.key === k0);
      p(`| ${f.family} | ${pctS(a.share)} / ${a.deepest} | ${pctS(b.share)} / ${b.deepest} |`);
    }
    p(`| *Segoe UI اليوم* | *${pctS(R.share)} / ${R.deepest}* | — |`, "");
  }

  p("## ١. المنهج", "");
  p(`- **المدوّنة:** كل عبارةٍ فيها حرفٌ عربي وطولها ≤ 40 حرفًا في القواميس الخمسة المشحونة (النصوص، وصيغ الجمع، وقوالب الأنماط، والعناصر النائبة رقمٌ غربي): **${fmtN(data.corpus.n)} عبارة** من ${fmtN(data.corpus.total)} نصًّا. بحركاتها وشدّاتها كما هي.`,
    `- **الارتفاعات:** تستخرجها الأداة من لقطات CSS (\`sitecss\` و\`sitecss-intercom\` و\`sitecss-docs\` و\`sitecss-code\`): كل زوج (حجم / ارتفاع سطر) في قاعدةٍ فيها قصّ (\`overflow: hidden|clip\` أو \`line-clamp\` أو \`text-overflow: ellipsis\`)، وكل أداةٍ طباعية (\`text-*\`/\`font-*\`) في موقعٍ فيه \`.truncate\`، مع حلّ المتغيّرات بحسب سياقاتها (ومنها \`--cds-rem-scale\` = 16/17). وأُضيف الحدّ الأدنى في التصميم إن لم يُستخرج. فكانت **${data.heights.length} ارتفاعًا** بـ${new Set(data.heights.map((h) => h.px)).size} حجمًا (الملحق أ). وأدوات \`leading-*\` تمثّلها \`line-height:1\` (أضيقها).`,
    `- **الفسحة:** من DOM لكل ارتفاع، بوجهٍ يحمل صندوق العلامة (أول خطٍّ متاح)، فيدخل تقريب المتصفح لخط الأساس إلى البكسل.`,
    `- **الحبر:** \`measureText\` بحجم الرسم الفعلي (F×s)، وهي حدود الرموز كما تُرسم مقرَّبةً إلى البكسل. والحروف الإنجليزية في العبارة بخط الموقع، والعربية بالخط المقيس. **والمقصوص:** عبارةٌ يتجاوز حبرها الفسحة بأكثر من نصف بكسل من فوق أو من تحت.`,
    `- **المرجع:** Segoe UI بالقياس نفسه وفي الصندوق نفسه، بلا تقديرٍ ولا تصفية (كل كلمةٍ مقيسةٌ فعليًّا بكل حجم).`,
    `- **العلاج النقطي:** يُقرأ من \`*-point.css\` نفسها (القواعد المعلَّقة على \`[${data.fix ? data.fix.attr : "data-cml-font"}]\`، §٣.٢): \`overflow: clip; overflow-clip-margin: ${data.margin}\` بدل \`hidden\` على \`.truncate\` في المواقع الخمسة وعلى قواعد المكوّنات التي تقصّ. فيسري على الارتفاع الذي يشمل العلاجُ كلَّ مصادره (${data.heights.filter((h) => h.fixable).length} ارتفاعًا من ${data.heights.length}). **ولا يسري على المرجع:** العلاج معلَّقٌ على سمة الخط فلا يراه من لا خطَّ له، فـ«اليوم» بلا علاجٍ في الحكم.`,
    `- **البحث عن s:** يبدأ من s_x محصورًا في [0.90، 1.20]، فإن لم يجتز فبحثٌ ثنائي إلى 0.90 بخطوة 0.01، للدورين وبالعلاج وبدونه.`, "");
  const chk = data.checks;
  const worstEst = Math.max(...chk.filter((c) => c.id !== "ref").map((c) => c.estErr[1]));
  p(`**تحقّق النموذج قبل القياس** (يوقف الأداة إن اختلّ):`,
    `- \`size-adjust\` يطابق الرسم بحجم F×s تمامًا (أكبر فرق ${Math.max(...chk.filter((c) => c.sizeAdjustVsScaled !== undefined).map((c) => c.sizeAdjustVsScaled))} بكسل).`,
    `- حبر العبارة = أقصى حبر كلماتها (أكبر فرق ${Math.max(...chk.map((c) => c.phraseVsWords))} بكسل)، فتُقاس الكلمات الفريدة مرةً لكل حجم.`,
    `- التقدير المتدرّج (من حجم 200 بكسل) لا يزيد الفعليُّ عليه بأكثر من ${worstEst} بكسل في الخطوط الستة، والتصفية بهامش ${data.prune} بكسل، فلا تسقط عبارةٌ قريبةٌ من الحدّ. أما Segoe UI فملمَّحٌ يزيد فعليُّه ${Math.max(...chk.filter((c) => c.id === "ref").map((c) => c.estErr[1]))} بكسل، فقِيس كله فعليًّا.`,
    `- فسحة الدورين (ui وread) ${data.sameRooms ? "متطابقةٌ عند كل ارتفاع، فحسابهما واحد" : "مختلفة، فحُسب كلٌّ على حدة"}.`, "");

  p("## ٢. صندوق العلامة وارتفاع x", "");
  p(`قيس ارتفاع x من العائلتين نفسيهما في ${BRAND_PAGE} بحجم 1000 بكسل (الطلب الشبكي الوحيد، وكل مضيفٍ غيره لا يُحلّ)، وأُخذ الصعود والنزول من وجوه «Fallback» في \`sitecss-docs\` (ascent-override × size-adjust) وأكّدهما القياس الحيّ في حدود التقريب إلى البكسل.`, "",
    "| الدور | العائلة | B.x | B.asc | B.desc | القياس الحيّ: الصعود / النزول |", "|---|---|---|---|---|---|");
  for (const role of ["ui", "read"]) {
    const b = data.B[role], m = data.brand.roles[role];
    p(`| ${role} | ${m.fam} | ${b.x} | ${b.asc} | ${b.desc} | ${m.asc} / ${m.desc} |`);
  }
  p("", `وجسم الحرف العربي في Segoe UI اليوم ${data.ref.body.body.toFixed(4)} em، أي أن العربية اليوم ترتسم بنحو ${(data.ref.body.body / data.B.ui.x * 100).toFixed(0)}٪ من ارتفاع x للحروف الإنجليزية في العلامة.`, "");

  p("## ٣. الجدول لكل خط", "");
  p("`body` وسيط حبر «ـسـ ـصـ ـمـ و» فوق خط الأساس. `s_x = B.x / body` محصورًا في [0.90، 1.20]. `s_clip` أكبر s يجتاز (— = لا يجتاز حتى 0.90). والعرض متوسط عرض عبارات المدوّنة بحجم 14 بكسل موازنةً بـ Segoe UI.", "",
    "| الخط | body (em) | s_x | s_clip بلا علاج / بالعلاج | s المعتمد | a / d | ارتفاعاتٌ يسقط عندها بـ s = 0.90 (بلا علاج / بالعلاج) | العرض |", "|---|---|---|---|---|---|---|---|");
  for (const f of data.fonts) {
    const r = V.rows.find((x) => x.id === f.id);
    const sx = clampS(f.sx.ui);
    const sc = (k) => (f.search[k] == null ? "—" : f.search[k].toFixed(2));
    const ww = f.width ? (f.width.use / data.ref.width) : null;
    p(`| ${f.family} | ${f.body.body.toFixed(4)} | ${f.sx.ui.toFixed(3)} ← ${sx.toFixed(2)} | ${sc("ui")} / ${sc("ui+fix")} | ${r.m ? r.m.ui.s.toFixed(2) : "لا يُعتمد"} | ${r.m ? r.m.ui.a + " / " + r.m.ui.d : `(${r4(data.B.ui.asc / f.sUse)} / ${r4(data.B.ui.desc / f.sUse)} عند ${f.sUse})`} | ${f.failsAtMin.ui.length} / ${f.failsAtMin["ui+fix"].length} | ${ww ? (ww * 100).toFixed(0) + "٪ عند " + f.sUse : "—"} |`);
  }
  p(`| *Segoe UI اليوم* | *${data.ref.body.body.toFixed(4)}* | — | — | — | — | — | *100٪* |`, "");
  p(`والدور read مثل ui في كل خط (${data.B.read.x === data.B.ui.x ? "ارتفاع x واحد في العائلتين" : "بقيمه"}، والفسحة واحدة)، و a×s = B.asc و d×s = B.desc بالبناء.`, "");

  p("### ٣.١ نسبة المقصوص وأعمقه عند الارتفاعات المسمّاة في التصميم وفي claude.ai", "",
    "كل خلية: المقصوص٪ / الأعمق بالبكسل. الأعلى بلا علاج، والسطر الثاني (↳) بالعلاج النقطي حيث ينطبق. **بالخط العريض** ما يزيد على Segoe UI.", "");
  p("| الارتفاع | Segoe UI اليوم | " + data.fonts.map((f) => f.family + " (s=0.90)").join(" | ") + " |", "|---|---|" + data.fonts.map(() => "---").join("|") + "|");
  for (const k of keys) {
    const R = ref.get(k), h = H.get(k);
    const cell = (x, fix) => {
      const [sh, dp, rs, rd] = fix ? [x.shareFix, x.deepestFix, R.share, R.deepest] : [x.share, x.deepest, R.share, R.deepest];
      const t = pctS(sh) + " / " + dp;
      return sh > rs + 1e-12 || dp > rd + 1e-9 ? "**" + t + "**" : t;
    };
    p(`| ${k}${h.fixable ? " ✚" : ""} | ${pctS(R.share)} / ${R.deepest} | ` + data.fonts.map((f) => cell(at(f, 0.9).find((x) => x.key === k), false)).join(" | ") + " |");
    if (h.fixable) p(`| ↳ بالعلاج | (اليوم بلا علاج) | ` + data.fonts.map((f) => cell(at(f, 0.9).find((x) => x.key === k), true)).join(" | ") + " |");
  }
  p("", "✚ = ارتفاعٌ يشمل العلاجُ النقطي كلَّ مصادره، فيُحكم فيه بالسطر ↳ موازنةً بـ Segoe UI اليوم بلا علاج.", "");
  if (data.fix) {
    p("### ٣.٢ العلاج النقطي كما قيس", "",
      `\`overflow: clip; overflow-clip-margin: ${data.margin}\` من \`*-point.css\` على \`html[data-cml="on"][${data.fix.attr}]\` (البصمة \`${data.fix.sig.slice(0, 12)}\`، ويحفظها القفل فتسقط البوابة إن تغيّر بعد المعايرة):`, "");
    for (const [file, e] of Object.entries(data.fix.canon)) p(`- \`${file}\`: ${Object.entries(e.margins).map(([s, m]) => "\`" + s.replace(/\|/g, "¦") + "\`" + (m === data.margin ? "" : " (" + m + ")")).join("، ")}${e.exclude.length ? " — ويُستثنى " + e.exclude.map((x) => "\`" + x + "\`").join("، ") : ""}.`);
    p("", "**أصغر هامشٍ يكفي كل خط** عند s المعتمد (أو 0.90 إن لم يجتز): أكبر ما يحتاجه عند الارتفاعات المعالَجة ليساوي Segoe UI اليوم، و«بالعلاج على الجميع» الحكم لو سرى العلاج نفسه على المرجع أيضًا (للاطلاع):", "",
      "| الخط | s | أصغر هامشٍ يكفي (بكسل) | أشدّ ارتفاعاته | بالعلاج على الجميع: ارتفاعاتٌ يسقط عندها |", "|---|---|---|---|---|");
    for (const f of data.fonts) {
      const r = V.rows.find((x) => x.id === f.id), s = r.m ? r.m.ui.s : 0.9, st = at(f, s) || at(f, 0.9);
      const fx = st.filter((x) => x.need != null), worst = fx.reduce((a, b) => (b.need > (a ? a.need : -1) ? b : a), null);
      const strict = passesAt(st, data.ref.stats.ui, true, true);
      p(`| ${f.family} | ${s.toFixed(2)} | ${worst ? worst.need.toFixed(1) : "—"} | ${worst ? worst.key : "—"} | ${strict.length}${strict.length ? " (" + strict.slice(0, 4).map((x) => x.key).join("، ") + (strict.length > 4 ? "…" : "") + ")" : ""} |`);
    }
    p("");
  }
  if (data.clampHeights && data.clampHeights.length) {
    const ctxs = [...new Set(Object.values(data.clampCtx))];
    const refC = new Map(data.ref.clamp.map((r) => [r.key, r]));
    p("### ٣.٣ علاج القطع بعدد الأسطر (line-clamp)", "",
      `\`font-family: "${CLAMP_FAMILY}", "${CLAMP_TODAY}", var(${CLAMP_VAR}) !important\` على جذور القطع (وما تحتها يرثها، وما يعلن له الموقع خطًّا قد يحمل وجهنا تشمله قاعدةٌ مولَّدة آخر المرآة على أي عمق) في \`*-point.css\` (البصمة \`${data.clampFix.sig.slice(0, 12)}\`)، ` +
      `بأزواج (حجم / ارتفاع سطر) حقيقية من حصر المواضع (\`fonts.clamp.json\`${data.clampData ? "، " + data.clampData.made.hijri : ""}) لا بأحجام الأدوات كلها. ` +
      `في كل سياق (ملف نقطة) أكبرُ s_c بين ${CLAMP_S_MIN.toFixed(2)} وs الوجه الرئيس لا تزيد عنده نسبة المقصوص ولا أعمقه على Segoe UI اليوم بلا هامش، عند كل زوج؛ ` +
      `وإلا فـ«اليوم»: لا يُسجَّل الوجه المضغوط فتقع العربية على \`${CLAMP_TODAY}\` (${data.todaySrc || "—"})، وقد قيس فساوى المرجع عند كل زوج.`, "",
      "| السياق | الأزواج | Segoe UI اليوم: أكبر نسبة / أعمق |", "|---|---|---|");
    for (const c of ctxs) {
      const hs = data.clampHeights.filter((h) => h.ctx === c), rs = hs.map((h) => refC.get(h.key));
      p(`| ${c} | ${hs.length}: ${hs.map((h) => h.px + "/" + h.lh).join("، ") || "—"} | ${rs.length ? pctS(Math.max(...rs.map((r) => r.share))) + " / " + Math.max(...rs.map((r) => r.deepest)) : "—"} |`);
    }
    p("", "| الخط | s الوجه الرئيس | " + ctxs.join(" | ") + " |", "|---|---|" + ctxs.map(() => "---").join("|") + "|");
    for (const f of data.fonts) {
      if (!f.clamp) continue;
      const cell = (c) => { const x = f.clamp[c]; if (!x) return "—"; if (x.s != null) return "**" + x.s.toFixed(2) + "**";
        return "اليوم" + (x.failsAtMin.length ? ` (يسقط عند ${CLAMP_S_MIN.toFixed(2)} في ${x.failsAtMin.length}: ${x.failsAtMin.slice(0, 3).map((y) => y.key.split(":")[1]).join("، ")}${x.failsAtMin.length > 3 ? "…" : ""})` : x.why ? ` (${x.why})` : ""); };
      p(`| ${f.family} | ${(Object.values(f.clamp)[0] || {}).hi ?? "—"} | ` + ctxs.map(cell).join(" | ") + " |");
    }
    p("", `**بالخط العريض** s_c للوجه المضغوط (يُسجَّل بـ size-adjust = s_c وتجاوزي B.asc/s_c وB.desc/s_c)، و«اليوم» سياقٌ لا يجتاز فيه الخط بأي s_c ≥ ${CLAMP_S_MIN.toFixed(2)}، فتبقى عربيته فيه كما هي اليوم.`, "");
  }

  if (s3) {
    const V3 = verdictOf({ ...s3, fonts: s3.fonts.map((f) => ({ ...f, cost: { x1: { fromBase64: { boot: 0 } } } })) });
    p("## ٤. سيناريو للمالك: العلاج النقطي على `.truncate` في المواقع الخمسة، وبلا قصٍّ رأسيٍّ فيها", "",
      `أُعيد القياس نفسه وقد عُدَّ كل ارتفاعٍ لا يأتي إلا من أداةٍ طباعية مع \`.truncate\` — في أي موقع — مُعالَجًا بـ \`overflow-x: clip; overflow-y: visible\` (البديل الثاني في §٤.٦، ممثَّلًا بهامشٍ لا نهائي). فيبقى القصّ في قواعد المكوّنات التي تقصّ بنفسها وحدها (${s3.heights.filter((h) => !h.fixable).length} ارتفاعًا من ${s3.heights.length}).`, "",
      "| الخط | s_clip | ارتفاعاتٌ يسقط عندها بـ s = 0.90 | الحكم في هذا السيناريو |", "|---|---|---|---|");
    for (const f of s3.fonts) {
      const r = V3.rows.find((x) => x.id === f.id);
      p(`| ${f.family} | ${f.search["ui+fix"] == null ? "—" : f.search["ui+fix"].toFixed(2)} | ${f.failsAtMin["ui+fix"].length} | ${r.clipOk ? "يجتاز القصّ" : "لا يجتاز"} |`);
    }
    const H3 = new Map(s3.heights.map((h) => [h.key, h]));
    const src3 = (k) => { const h = H3.get(k); return h ? h.sources.slice(0, 2).map((x) => (SITE_OF_DIR[x.dir] || x.dir) + " `" + x.sel.replace(/\\/g, "").replace(/\|/g, "¦").slice(0, 42) + "`").join("، ") : ""; };
    p("", "**ما بقي من السقوط عند s = 0.90** (ن = نسبة المقصوص، ع = الأعمق؛ والقوسان: الخط مقابل Segoe UI):", "");
    for (const f of s3.fonts) {
      const fl = f.failsAtMin["ui+fix"];
      p(`- **${f.family}** (${fl.length}): ` + fl.map((x) => `${x.key} [${x.share > x.ref.share + 1e-12 ? "ن" : ""}${x.deepest > x.ref.deepest + 1e-9 ? "ع" : ""}: ${pctS(x.share)}/${x.deepest} مقابل ${pctS(x.ref.share)}/${x.ref.deepest}] — ${src3(x.key)}`).join("؛ "));
    }
    const near = s3.fonts.filter((f) => f.failsAtMin["ui+fix"].length && f.failsAtMin["ui+fix"].every((x) => (H3.get(x.key) || { sources: [] }).sources.every((y) => y.dir === "sitecss-intercom")));
    if (near.length) p("", `**فـ${near.map((f) => f.family).join(" و")} لا يسقط${near.length > 1 ? "ان" : ""} في هذا السيناريو إلا عند قواعد مكوّناتٍ في مركزي المساعدة والخصوصية**، ويمكن أن يعالجها \`intercom-point.css\` معالجةً نقطية كذلك، ثم يُعاد القياس ليحكم. ولم يُقَس ذلك بعد.`);
    p("");
  }

  p("## ٥. كلفة بناء الوجه (§٤.٧)", "",
    "فكّ base64 ثم `new FontFace(ArrayBuffer)` وإضافته، وسيط 5 بعد تسخينين. الميزانية `10 + 0.15 × KiB` مللي ثانية. " +
      (data.cpu ? `حِمل المعالج في الجهاز كله (${data.cpu.cores} أنوية): ${data.cpu.before}٪ في الثواني الثلاث قبل القياس، و${data.cpu.during}٪ في أثنائه (ومنه كروم نفسه)` + (data.costMeasured ? `، وأُعيد قياسها وحدها (\`--cost-only\`) في ${data.costMeasured.when.hijri}.` : ".") : "لم يُسجَّل حِمل المعالج في هذا القياس."), "",
    "| الخط | KiB | الميزانية | fromBase64: فكّ + بناء | الخمس | حلقة atob (أرضية Chrome 102) | ×4 إبطاء (للاطلاع) | ضمن الميزانية؟ |", "|---|---|---|---|---|---|---|---|");
  for (const f of data.fonts) {
    const c = f.cost, b = bootBudget(f.bytes);
    p(`| ${f.family} | ${(f.bytes / 1024).toFixed(1)} | ${b.toFixed(1)} | ${c.x1.fromBase64.decode.toFixed(1)} + ${c.x1.fromBase64.face.toFixed(1)} = **${c.x1.fromBase64.boot.toFixed(1)}** | ${c.x1.fromBase64.all.join("، ")} | ${c.x1.atob.boot.toFixed(1)} | ${c.x4.fromBase64.boot.toFixed(1)} | ${c.x1.fromBase64.boot <= b ? "نعم" : "لا"} |`);
  }
  p("", "والتحليل متزامن: الوجه `loaded` فور بنائه، فلا انتظار بعده.", "");

  p("## ٦. الزر تحت `line-height: normal` (§٤.٦ حدّ القبول 3)", "",
    "زرٌّ بحشوة 4/8 بكسل وحجم 14، وعائلةٌ فيها وجه الموقع ووجهنا **بواصفاتٍ واحدة**. بـ a = B.asc/s و d = B.desc/s يساوي الزرُّ العربي الإنجليزيَّ:", "",
    "| الخط | s | الموقع وحده | إنجليزي | عربي | مختلط |", "|---|---|---|---|---|---|");
  for (const f of data.fonts) if (f.button) p(`| ${f.family} | ${f.sUse} | ${f.button.siteOnly} | ${f.button.en} | ${f.button.ar} | ${f.button.mixed} |`);
  p("", "**ملاحظةٌ للتنفيذ (S6-B):** إن اختلفت واصفات الوزن بين وجه الموقع ووجهنا لم ينضمّا، فسقطت الحروف الإنجليزية إلى خط المتصفح الافتراضي وتغيّر صندوقها (رأيناه في مسوّدة الأداة: سطرٌ إنجليزي 16 بكسل بدل 18). وهذا ما يمنعه نسخ الواصفات حرفيًّا في §٤.٣، ويحرسه الاختبار ★3.", "");

  p("## ٧. الحكم والبدائل للمالك", "");
  p("| الخط | القصّ | الكلفة | الحكم |", "|---|---|---|---|");
  for (const r of V.rows) p(`| ${r.family} | ${r.clipOk ? "يجتاز" + (r.needsFix ? " (بالعلاج)" : "") : "لا يجتاز"} | ${r.costOk ? "ضمن الميزانية" : "فوقها"} | ${r.keep ? "يُبقى" : "لا يُشحن: " + r.why.join("؛ ")} |`);
  p("");
  if (noneKept) {
    p("القاعدة كما كُتبت تُسقط الستة، فلا يبقى في 2.0.0 خطٌّ يُختار. **والقرار للمالك قبل المجموعة ٣**، وهذه البدائل كما تُظهرها الأرقام، ولم يُنفَّذ منها شيء:", "",
      "1. **إبقاء القاعدة:** لا خطَّ في 2.0.0. تُحذف الملفات الاثنا عشر ويُفرَّغ القفل، ويبقى من الميزة حذفُ الخط المفروض اليوم (§٤.٩) و«خط النظام» إن أُقرّ (ق٦).",
      "2. **توسيع العلاج النقطي** إلى `.truncate` في المواقع الخمسة بلا قصٍّ رأسي، ومعه قواعد المكوّنات القليلة الباقية (§٤ أعلاه)، ثم الحكم بالقاعدة على ما بقي بإعادة القياس. وهو أقرب البدائل إلى القاعدة المقرّة وإلى Cairo افتراضيًّا. وله ثمنه: حبرٌ يدخل حاشية الصف المجاور ببكسلٍ أو أكثر (خ٢٢)، ويُفحص بفحص الاتجاه الشامل، والتصميم اليوم يضع العلاج في claude.ai وحده.",
      "3. **تعديل القاعدة نفسها:** أن يُقاس القصّ في الصفوف المقطوعة وحدها (لا في كل أداةٍ طباعية)، أو أن يُحكم بالنسبة دون «الأعمق» الذي تحكمه عبارةٌ واحدة، أو بسماحٍ مكتوب. وهذا تغييرٌ في معيارٍ أقرّه المالك.",
      "4. **قبول قصٍّ أكثر من اليوم في الصفوف المقطوعة** ثمنًا للخط المختار، بقرارٍ مكتوب يُذكر في «حول».", "",
      "وفي كل بديل يُعاد تشغيل `measure` ثم `--apply`، فيُكتب القفل والفهرس من القياس لا باليد.", "");
  }

  p("## ٨. حدود القياس", "",
    "- ويندوز بكثافة بكسلٍ 1 وحده. ولا ماك (خ١٦).",
    "- حروف الموقع الإنجليزية ممثَّلة بـ Segoe UI المحلي بصندوق العلامة، لأن ملف خط العلامة لا يُحفظ. ولا أثر لذلك في الحكم: الحروف الإنجليزية واحدةٌ في كل الخيارات.",
    "- الوزن 400 وحده في الحكم. والصفوف المقطوعة أفقيًّا تُحسب كاملةً (الجزء المخفي بعلامة الحذف محسوبٌ أيضًا)، وهذا في صالح الحذر.",
    "- المرجع «اليوم» Segoe UI كما في التصميم؛ وفي بعض المواضع قد يرسم الموقع العربية اليوم بغيره من سلسلة خطوطه.",
    `- ${data.notes.join("؛ ")}.`, "");

  p("## الملحق أ: الارتفاعات ذات القصّ", "",
    `${data.heights.length} ارتفاعًا. «قاعدة» = قاعدةٌ تقصّ بنفسها؛ «أداة» = أداةٌ طباعية في موقعٍ فيه \`.truncate\`. والفسحة فوق/تحت خط الأساس بالبكسل. والأعمدة الأخيرة المقصوص٪/الأعمق بـ s = 0.90 بلا علاج.`, "",
    "| الارتفاع | النسبة | الفسحة | المصدر | Segoe UI | " + data.fonts.map((f) => f.family).join(" | ") + " |", "|---|---|---|---|---|" + data.fonts.map(() => "---").join("|") + "|");
  const short = (s) => (s.dir === "base.css" ? "base.css" : SITE_OF_DIR[s.dir] || s.dir) + ": `" + s.sel.replace(/\\/g, "").replace(/\|/g, "¦").slice(0, 40) + "` (" + (s.kind === "rule" ? "قاعدة" : s.kind === "utility" ? "أداة" : "متن") + ")";
  for (const h of data.heights) {
    const R = ref.get(h.key);
    p(`| ${h.key}${h.fixable ? " ✚" : ""} | ${h.ratio} | ${h.rooms.ui.up}/${+h.rooms.ui.down.toFixed(2)} | ${short(h.sources[0])}${h.sources.length > 1 ? " +" + (h.sources.length - 1) : ""} | ${pctS(R.share)}/${R.deepest} | ` +
      data.fonts.map((f) => { const x = at(f, 0.9).find((y) => y.key === h.key); const bad = x.share > R.share + 1e-12 || x.deepest > R.deepest + 1e-9; const t = pctS(x.share) + "/" + x.deepest; return bad ? "**" + t + "**" : t; }).join(" | ") + " |");
  }
  p("");
  return L.join("\n");
}

// ---- ٨. لوحة العيّنات (مسوّدة): الخطوط مضمَّنةً في الصفحة نفسها، ولا طلب شبكيًّا ----
const SAMPLE_UI = "محادثة جديدة · الإعدادات والمشاريع · اسأل Claude عن ملف README.md في 3 ثوانٍ";
const STRESS = ["لَأَنْ، لِإِنْ، لَآ، لّٰهِ، مُؤْمِنٌ، سُئِلَ، شَيْءٌ، ٱلْكِتَٰبُ، ـهـ", "ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ", "ﷺ ﷻ",
  "٠١٢٣٤٥٦٧٨٩ | 0123456789 | ٣٫١٤ | ١٬٠٠٠ | ٪٥٠", "اسأل Claude عن ملف README.md في 3 ثوانٍ", "١٩ ربيع الآخر ١٤٤٨هـ"];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function specimenHtml(data) {
  const V = verdictOf(data);
  const fonts = data.fonts.map((f) => ({ id: f.id, family: f.family, s: f.sUse, b64: fs.readFileSync(path.join(FONTS_DIR, f.id + ".woff2")).toString("base64") }));
  const rows = [["14/20", 14, 20, "text-sm مع .truncate (عناوين الشريط الجانبي)"], ["12/16", 12, 16, "text-xs"], ["12.24/16", 12.24, 16, "caption بـ rem-scale"],
    ["12/15", 12, 15, "footnote"], ["14/14", 14, 14, "leading-none"]];
  const worst = new Set(["الإعدادات والمشاريع", "محادثة جديدة"]);
  for (const f of data.fonts) for (const k of ["14/20", "12/15"]) { const x = (f.points["0.9"] || []).find((y) => y.key === k); if (x && x.worst) worst.add(x.worst); }
  for (const k of ["14/20", "12/15"]) { const x = data.ref.stats.ui.find((y) => y.key === k); if (x && x.worst) worst.add(x.worst); }
  const cfg = { B: data.B, AR: data.AR, SITE: SITE_RANGE, fonts: fonts.map(({ id, family, s }) => ({ id, family, s })), margin: data.margin };
  const verdict = Object.fromEntries(V.rows.map((r) => [r.id, r.keep ? "يُبقى" : "لا يجتاز القاعدة"]));
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>لوحة عيّنات الخطوط</title>
<style>
:root{--bg:#f6f5f2;--fg:#1f1e1d;--mut:#6b6a66;--line:#d9d6ce;--card:#fff;--dark:#262624;--darkfg:#ece9e1;--bad:#b3261e}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#1b1a19;--fg:#ece9e1;--mut:#a19f98;--line:#3a3935;--card:#232220}}
:root[data-theme="dark"]{--bg:#1b1a19;--fg:#ece9e1;--mut:#a19f98;--line:#3a3935;--card:#232220}
*{box-sizing:border-box}body{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:15px/1.6 "Segoe UI",system-ui,sans-serif}
h1{font-size:22px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px}.mut{color:var(--mut);font-size:13px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;margin:14px 0;max-width:1180px}
.card h3{margin:0 0 6px;font-size:16px}.tag{font-size:12px;border:1px solid var(--line);border-radius:99px;padding:1px 8px;margin-inline-start:8px;color:var(--mut)}
.tag.bad{color:var(--bad);border-color:var(--bad)}
.panes{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:760px){.panes{grid-template-columns:1fr}}
.pane{border-radius:8px;padding:10px;overflow:hidden}.light{background:#fff;color:#1f1e1d;border:1px solid #e6e3da}.dark{background:var(--dark);color:var(--darkfg)}
.grid{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;align-items:baseline}.lbl{font:11px/1.4 "Segoe UI",sans-serif;color:#8a877f;white-space:nowrap;direction:ltr}
.ln{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.clips{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}
.cl{border:1px dashed #c9c5ba;padding:0 6px;background:#fff;color:#1f1e1d}.cl .lbl{white-space:normal;display:block;margin:2px 0}
.cl .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:rgba(255,196,0,.14)}
.cl .t.fix{overflow:clip;overflow-clip-margin:${data.margin}}
.stress{font-size:18px;line-height:2}
</style></head><body>
<h1>لوحة عيّنات الخطوط العربية — مسوّدة</h1>
<p class="mut">${esc(data.when.hijri)} · من قياس <code>fonts.mjs measure</code>. الحروف الإنجليزية بـ Segoe UI المحلي بصندوق العلامة (موضع خط العلامة، لأن ملفه لا يُحفظ)، والعربية بخط كل بطاقةٍ وبقيمة s المكتوبة عليها (s_x محصورًا للخط الذي لم يجتز، للاطلاع). الخلفية الصفراء صندوق السطر: ما خرج عنه مقصوص.</p>
<div id="app"></div>
<script>
const CFG = ${JSON.stringify(cfg)};
const B64 = ${JSON.stringify(Object.fromEntries(fonts.map((f) => [f.id, f.b64])))};
const VERDICT = ${JSON.stringify(verdict)};
const SAMPLE = ${JSON.stringify(SAMPLE_UI)}, STRESS = ${JSON.stringify(STRESS)}, WORST = ${JSON.stringify([...worst].slice(0, 12))};
const ROWS = ${JSON.stringify(rows)};
const pct = (x) => (Math.round(x * 100000) / 1000) + "%";
const dec = (s) => { if (Uint8Array.fromBase64) return Uint8Array.fromBase64(s).buffer; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
const LAT = { 400: "Segoe UI", 500: "Segoe UI", 600: "Segoe UI Semibold", 700: "Segoe UI Bold" };
async function faces(fam, buf, s) {
  const b = CFG.B.ui, list = [];
  for (const w of [400, 500, 600, 700]) {
    // الوجهان بالواصفات نفسها (الوزن) فينضمّان: الحروف الإنجليزية من وجه الموقع، والعربية من وجهنا
    list.push(new FontFace(fam, "local('" + LAT[w] + "')", { weight: String(w), unicodeRange: CFG.SITE, ascentOverride: pct(b.asc), descentOverride: pct(b.desc), lineGapOverride: "0%" }));
    if (buf) list.push(new FontFace(fam, buf, { weight: String(w), unicodeRange: CFG.AR, sizeAdjust: pct(s), ascentOverride: pct(b.asc / s), descentOverride: pct(b.desc / s), lineGapOverride: "0%" }));
  }
  for (const f of list) { document.fonts.add(f); await f.load().catch(() => {}); }
}
function el(tag, attrs, kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) (k === "text" ? (e.textContent = v) : e.setAttribute(k, v)); for (const c of kids || []) e.appendChild(c); return e; }
function pane(cls, fam) {
  const g = el("div", { class: "grid" });
  for (const px of [13, 14, 15, 16]) for (const w of [400, 500, 600, 700]) {
    g.appendChild(el("span", { class: "lbl", text: px + "px · " + w }));
    g.appendChild(el("div", { class: "ln", style: "font-family:" + fam + ',"Segoe UI";font-size:' + px + "px;font-weight:" + w + ";line-height:1.5", text: SAMPLE }));
  }
  return el("div", { class: "pane " + cls }, [g]);
}
function clips(fam) {
  const box = el("div", { class: "clips" });
  for (const [key, px, lh, why] of ROWS) for (const fix of [false, true]) {
    const c = el("div", { class: "cl" }, [el("div", { class: "lbl", text: key + " · " + why + (fix ? " · بالعلاج النقطي" : " · اليوم") })]);
    for (const t of WORST) c.appendChild(el("div", { class: "t" + (fix ? " fix" : ""), style: "font-family:" + fam + ',"Segoe UI";font-size:' + px + "px;line-height:" + lh + "px", text: t }));
    box.appendChild(c);
  }
  return box;
}
(async () => {
  const app = document.getElementById("app");
  const all = [{ id: "ref", family: "Segoe UI (اليوم)", s: 1 }].concat(CFG.fonts);
  for (const f of all) {
    const fam = "Spec_" + f.id.replace(/-/g, "_");
    await faces(fam, f.id === "ref" ? null : dec(B64[f.id]), f.s);
    const v = VERDICT[f.id];
    const card = el("section", { class: "card" }, [
      el("h3", {}, [document.createTextNode(f.family), el("span", { class: "tag", text: "s = " + f.s }), ...(v ? [el("span", { class: "tag" + (v === "يُبقى" ? "" : " bad"), text: v })] : [])]),
      el("div", { class: "panes" }, [pane("light", fam), pane("dark", fam)]),
      el("h4", { class: "mut", text: "صفوفٌ مقطوعة بارتفاعات claude.ai" }), clips(fam),
      el("h4", { class: "mut", text: "نصوص الإجهاد (18 بكسل، line-height: 2)" }),
      el("div", { class: "pane light stress", style: "font-family:" + fam + ',"Segoe UI"' }, STRESS.map((t) => el("div", { text: t })))]);
    app.appendChild(card);
  }
  document.body.setAttribute("data-ready", "1");
})();
</script>
</body></html>
`;
}

// يكتب نتيجة المعايرة في القفل ويُسقط ما لم يجتز — ولا يعمل إن لم يجتز خطٌّ واحد (لا يُفرَّغ القفل بلا قرار المالك)
export function applyCalibration(data, lockPath = LOCK_PATH, fontsDir = FONTS_DIR) {
  const V = verdictOf(data);
  if (!V.kept.length) return { ok: false, why: "لم يجتز أيُّ خطٍّ المعايرة — لم يُحذف شيء ولم يُكتب القفل؛ القرار للمالك" };
  const lock = readLock(lockPath);
  const ref = new Map(data.ref.stats.ui.map((r) => [r.key, r]));
  // العلاج النقطي كما قيس (من *-point.css) ببصمته: البوابة تعيد قراءته وتسقط إن تغيّر بعد المعايرة
  lock.reference = { B: data.B, measured: data.when, page: BRAND_PAGE, chrome: data.chrome, corpus: data.corpus.n, heights: data.heights.length,
    spotFix: V.kept.some((r) => r.needsFix) && data.fix ? { attr: data.fix.attr, sig: data.fix.sig, files: data.fix.canon } : null,
    // علاج القطع بعدد الأسطر كما قيس، وحصر أزواجه: البوابة تعيد قراءتهما وتسقط إن تغيّرا بعد المعايرة
    clampFix: data.clampFix && data.clampHeights && data.clampHeights.length ? { attr: data.clampFix.attr, sig: data.clampFix.sig, files: data.clampFix.canon,
      data: data.clampData, pairs: data.clampHeights.length } : null };
  const refC = new Map(((data.ref && data.ref.clamp) || []).map((r) => [r.key, r]));
  const dropped = [];
  lock.fonts = lock.fonts.filter((e) => {
    const r = V.rows.find((x) => x.id === e.id);
    if (!r) return true;
    if (r.keep) {
      const f = data.fonts.find((x) => x.id === e.id);
      const pts = f.points[String(r.m.ui.s)];
      // المرجع «اليوم» بلا علاجٍ دائمًا (العلاج معلَّقٌ على سمة الخط فلا يراه من لا خطَّ له)
      e.calib = { m: r.m, heights: pts.map((h) => { const R = ref.get(h.key), fix = r.needsFix;
        const [px, lh] = h.key.split("/").map(Number);
        return { px, lh, share: +(fix ? h.shareFix : h.share).toFixed(6), deepest: fix ? h.deepestFix : h.deepest, ref: { share: +R.share.toFixed(6), deepest: R.deepest } }; }) };
      // لكل سياق قطع: الوجه المضغوط بقيمه وأرقام أزواجه، أو {today: true}
      if (r.clamp) e.calib.clamp = Object.fromEntries(Object.entries(r.clamp).map(([c, m]) => {
        if (!m) return [c, { today: true }];
        const st = (f.clampPoints[String(m.s)] || []).filter((h) => h.key.startsWith(c + ":"));
        return [c, { ...m, heights: st.map((h) => { const R = refC.get(h.key), [px, lh] = h.key.split(":")[1].split("/").map(Number);
          return { px, lh, share: +h.share.toFixed(6), deepest: h.deepest, ref: { share: +R.share.toFixed(6), deepest: R.deepest } }; }) }];
      }));
      return true;
    }
    dropped.push({ id: e.id, family: e.family, reason: r.why.join("؛ "), when: data.when });
    for (const ext of [".woff2", ".OFL.txt"]) { try { fs.unlinkSync(path.join(fontsDir, e.id + ext)); } catch {} }
    return false;
  });
  if (dropped.length) lock.dropped = (lock.dropped || []).concat(dropped);
  fs.writeFileSync(lockPath, formatLock(lock), "utf8");
  return { ok: true, kept: V.kept.map((r) => r.id), dropped, def: V.def };
}

// ───────────────────────────── measure (CLI) ─────────────────────────────
const argVal = (args, k, d) => { const a = args.find((x) => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : d; };
// العلاج النقطي وهامشه لا يُمرَّران هنا: يُقرآن من *-point.css وحدها (readSpotFix)، فلا يُحكم بعلاجٍ غير المشحون
const MEASURE_FLAGS = ["out", "brand-from", "scenario", "report", "specimen", "prune", "only", "chrome"];
async function cmdMeasure(args) {
  if (process.env.CI || process.env.GITHUB_ACTIONS) { console.error("✗ measure يدويٌّ ولا يعمل في CI"); return 1; }
  const unknown = args.filter((a) => !["--apply", "--report-only", "--stats-only", "--cost-only"].includes(a) && !MEASURE_FLAGS.some((k) => a.startsWith("--" + k + "=")));
  if (unknown.length || !args.some((a) => a.startsWith("--out="))) {
    console.error((unknown.length ? "✗ خيارٌ غير معروف: " + unknown.join(" ") + "\n" : "") +
      "الاستعمال: node fonts.mjs measure --out=<مجلد> [--brand-from=<json>] [--report-only | --cost-only] [--scenario=<مجلد>] [--apply]\n" +
      "  [--report=<ملف>] [--specimen=<ملف>] [--prune=2.5] [--only=<id,…>] [--stats-only] [--chrome=<مسار>]\n" +
      "  (العلاج النقطي للقصّ يُقرأ من *-point.css المعلَّق على C.FONT_ATTR — لا خيار له)");
    return 2;
  }
  const outDir = path.resolve(argVal(args, "out", path.join(os.tmpdir(), "cml-fonts-calibration")));
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "calibration.json");
  let data;
  if (args.includes("--report-only")) data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  else if (args.includes("--cost-only")) {
    data = await costOnly(JSON.parse(fs.readFileSync(jsonPath, "utf8")), { chrome: argVal(args, "chrome", undefined) });
    fs.writeFileSync(jsonPath, JSON.stringify(data));
    console.log(`✓ أُعيد قياس الكلفة في ${jsonPath} (حِمل المعالج ${data.cpu.before}٪ قبله و${data.cpu.during}٪ في أثنائه)`);
  }
  else {
    const only = argVal(args, "only", "") ? argVal(args, "only", "").split(",") : null;
    data = await collectCalibration({ outDir, brandFrom: argVal(args, "brand-from", null),
      prune: parseFloat(argVal(args, "prune", "2.5")), only, chrome: argVal(args, "chrome", undefined), statsOnly: args.includes("--stats-only") });
    fs.writeFileSync(jsonPath, JSON.stringify(data));
    console.log(`✓ القياسات في ${jsonPath} (${data.seconds} ث)`);
  }
  if (!data.fonts.length || !data.fonts[0].cost) { console.log("ℹ قياسٌ جزئي (--stats-only أو --only): لا تقرير ولا تطبيق"); return 0; }
  // سيناريو اختياري يُعرض في التقرير (مثل العلاج النقطي موسَّعًا): مجلد قياسٍ آخر
  const scen = argVal(args, "scenario", null);
  const s3 = scen ? JSON.parse(fs.readFileSync(path.join(path.resolve(scen), "calibration.json"), "utf8")) : null;
  const reportPath = path.resolve(argVal(args, "report", path.join(outDir, "calibration.md")));
  const specPath = path.resolve(argVal(args, "specimen", path.join(outDir, "specimen.html")));
  fs.writeFileSync(reportPath, calibrationReport(data, s3), "utf8");
  fs.writeFileSync(specPath, specimenHtml(data), "utf8");
  const V = verdictOf(data);
  console.log(`✓ التقرير: ${reportPath}\n✓ لوحة العيّنات: ${specPath}`);
  for (const r of V.rows) console.log(`  ${r.keep ? "✓" : "✗"} ${r.family}${r.keep ? (r.needsFix ? " (بالعلاج النقطي)" : "") + " s=" + r.m.ui.s : ": " + r.why.join("؛ ")}` +
    (r.clamp ? "؛ القطع: " + Object.entries(r.clamp).map(([c, m]) => c + "=" + (m ? m.s : "اليوم")).join(" ") : ""));
  console.log(V.def ? `  الافتراضي: ${V.def}` : "  لا افتراضيّ: لم يجتز أيُّ خط");
  if (args.includes("--apply")) {
    const r = applyCalibration(data);
    if (!r.ok) { console.error("✗ " + r.why); return 3; }
    console.log(`✓ القفل: أُبقي ${r.kept.join("، ")}، وأُسقط ${r.dropped.map((x) => x.id).join("، ") || "لا شيء"}؛ الافتراضي ${r.def}. شغّل: node fonts.mjs credits && node fonts.mjs verify`);
  }
  return 0;
}

// ───────────────────────────── CLI ─────────────────────────────
async function cmdVerify(args) {
  const r = await verifyFonts({ release: args.includes("--release") });
  for (const n of r.notes) console.log("ℹ " + n);
  for (const p of r.pending) console.log("⧗ معلَّق: " + p);
  if (!r.ok) {
    console.error("✗ بوابة الخطوط أخفقت:");
    for (const e of r.errors) console.error("  - " + e);
    return 1;
  }
  console.log(`✓ الخطوط سليمة: ${r.fonts} خطوط، ${fmtN(r.bytes)} بايت (${(r.bytes / 1024).toFixed(1)} KiB)` + (r.pending.length ? `، و${r.pending.length} فحوصٍ معلَّقة` : ""));
  return 0;
}

function cmdCredits() {
  const lock = readLock();
  const bad = lockProblems(lock);
  if (bad.length) { console.error("✗ القفل مختلّ:\n  - " + bad.join("\n  - ")); return 1; }
  const text = creditsText(lock);
  const fp = path.join(FONTS_DIR, CREDITS);
  if (fs.existsSync(fp) && fs.readFileSync(fp, "utf8") === text) { console.log("✓ CREDITS.txt طازج — لم يُكتب شيء"); return 0; }
  fs.mkdirSync(FONTS_DIR, { recursive: true });
  fs.writeFileSync(fp, text, "utf8");
  console.log(`✓ كُتب fonts/CREDITS.txt (${lock.fonts.length} خطوط، ${Buffer.byteLength(text)} بايت)`);
  return 0;
}

const same = (a, b) => (process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b);
if (process.argv[1] && same(path.resolve(process.argv[1]), fileURLToPath(import.meta.url))) {
  const [cmd, ...args] = process.argv.slice(2);
  let code;
  try {
    if (cmd === "fetch") code = await cmdFetch(args);
    else if (cmd === "verify") code = await cmdVerify(args);
    else if (cmd === "credits") code = cmdCredits();
    else if (cmd === "measure") code = await cmdMeasure(args);
    else if (cmd === "clamp") code = await cmdClamp(args);
    else if (cmd === "clamp-css") code = await cmdClampCss();
    else {
      console.error("الاستعمال: node fonts.mjs fetch --approved | verify [--release] | credits | measure --out=<مجلد> [--apply] | clamp --from=<inventory.json> | clamp-css");
      code = 2;
    }
  } catch (e) { console.error("✗ " + (e && e.stack || e)); code = 1; }
  process.exitCode = code;
}
