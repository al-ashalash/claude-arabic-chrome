// verify-package.mjs — بوابة CI الخامسة: سلامة الحزمة قبل أي تسليم.
// تفحص: المانيفست (بنيته، صلاحياته المقتصرة على storage، وجود كل ملف يشير إليه)،
// ومصنوعات محرّك الاتجاه، والخطوط العربية المحزومة (fonts.mjs)، وألّا يتسرب ملفٌ ممنوع إلى مجلد الإضافة،
// ★ (ر8-ب) ومطابقةَ قائمتي المعاجم والمصادر في «حول» وREADME لملف المصادر حيث يوجد (check-sources.mjs).
//   node verify-package.mjs [--release]
// مع --release (تمرّره make-store-zip و make-release وسير الإصدار) يصير كل فحصٍ معلَّق خطأً،
// فلا تُحزم حزمةٌ خطوطها بلا معايرة أو قيمها مبدئية (provisional).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { EXT, GLOSSARY } from "./paths.mjs";
import { siwarViolations, siwarCsvViolations, proseViolations, loadAdopted, docsCsvFiles } from "./siwar-lib.mjs";
import { verifyFonts } from "./fonts.mjs";
import { checkSources } from "./check-sources.mjs";

const RELEASE = process.argv.includes("--release");
const errs = [];
function need(cond, msg) { if (!cond) errs.push(msg); }
function exists(rel) { return fs.existsSync(path.join(EXT, rel)); }

// ---- المانيفست ----
const mf = JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"), "utf8"));
need(mf.manifest_version === 3, "manifest_version يجب أن يكون 3");
need(/^\d+\.\d+\.\d+$/.test(mf.version || ""), "version ليس بصيغة x.y.z: " + mf.version);
need(Array.isArray(mf.permissions) && mf.permissions.length === 1 && mf.permissions[0] === "storage",
  "الصلاحيات يجب أن تبقى [storage] وحدها — وجدت: " + JSON.stringify(mf.permissions));
need(!mf.host_permissions, "لا host_permissions في هذه الإضافة");
// ★ (مراجعة الأمن) الصلاحيات وحدها لا تحدّ المدى: مانيفستٌ يوسَّع بأي طريقٍ أخرى كان
// يمرّ من هنا ثم يُحزَم ويُنشر. فكلُّ سطحٍ يوسّع المدى ممنوعٌ صراحةً، ونطاقاتُ المطابقة
// محصورةٌ في claude.ai — تغييرُ أيٍّ منها قرارٌ يُتَّخذ هنا بالتصريح لا بالمرور الصامت.
// والخط العربي المحزوم لا يرفع هذا المنع: لا يبلغ الصفحةَ بعنوان chrome-extension:// (فلا
// web_accessible_resources)، ولا يُجلب من الشبكة (فلا content_security_policy)، بل يقرأ عامل
// الخدمة الملف المختار من الحزمة ويكتبه في chrome.storage، ويبنيه المحرّك في الصفحة
// بـ FontFace(ArrayBuffer). ويُعاد الفحص نفسه في verifyFonts أدناه حارسًا ثانيًا.
for (const k of ["optional_permissions", "optional_host_permissions", "externally_connectable",
                 "web_accessible_resources", "content_security_policy", "declarative_net_request"]) {
  need(!(k in mf), "المفتاح " + k + " يوسّع مدى الإضافة وليس في عقدها");
}
// ★ (١-٠ب) مداخل المانيفست تطابق جدول النطاقات حرفًا: قائمةٌ مغلقة (لا تعبيرٌ نمطي يتّسع
// بالسهو)، ولكل مدخلٍ نطاقُه وقاموسُه وترتيبُه الإلزامي. توسيعُ المدى قرارٌ في cml-const.js
// يمرّ من هنا بالتصريح.
await import(pathToFileURL(path.join(EXT, "cml-const.js")).href);
const DOMAINS = globalThis.CMLConst.DOMAINS;
const SNAPSHOTS = ["rtl-overrides.css", "rtl-intercom.css", "rtl-docs.css", "rtl-code.css", "rtl-legal.css", "rtl-academy.css"];
const seenDomains = new Set();
for (const cs of mf.content_scripts || []) {
  need(Array.isArray(cs.matches) && cs.matches.length > 0, "content_scripts بلا matches");
  need(!cs.match_about_blank && !cs.match_origin_as_fallback, "content_scripts تمتدّ إلى أُطرٍ خارج النطاق");
  const dom = DOMAINS.find((d) => JSON.stringify(d.matches) === JSON.stringify(cs.matches));
  if (!dom) { errs.push("مدخلٌ لا يطابق نطاقًا في الجدول: " + JSON.stringify(cs.matches)); continue; }
  need(!seenDomains.has(dom.id), "نطاقٌ بمدخلين: " + dom.id);
  seenDomains.add(dom.id);
  const wantJs = ["cml-const.js", "cml-shared.js", "cml-rtl.js"].concat(dom.id === "app" ? ["rtl-coverage.js"] : [], ["cml-font.js", dom.dict, "engine.js"]);
  need(JSON.stringify(cs.js) === JSON.stringify(wantJs), dom.id + ": ترتيب السكربتات ليس الإلزامي: " + JSON.stringify(cs.js));
  need(Array.isArray(cs.css) && cs.css[0] === "base.css", dom.id + ": base.css أولًا (يعلن الطبقات) — وجدت: " + JSON.stringify(cs.css));
  need((cs.css || []).filter((c) => SNAPSHOTS.includes(c)).length <= 1, dom.id + ": أكثر من لقطة اتجاه");
  need(cs.run_at === "document_start", dom.id + ": run_at يجب أن يكون document_start");
  need(!!cs.all_frames === !!dom.allFrames, dom.id + ": all_frames يخالف الجدول");
  need(JSON.stringify(cs.exclude_matches || []) === JSON.stringify(dom.excludeMatches || []), dom.id + ": exclude_matches يخالف الجدول");
  // القاموس يعلن نطاقه نفسه (المحرّك يعرف نطاقه منه)
  try {
    const src = fs.readFileSync(path.join(EXT, dom.dict), "utf8");
    const ctx = {}; ctx.globalThis = ctx;
    vm.runInNewContext(src, ctx, { timeout: 20000 });
    const payload = ctx.CLAUDE_L10N || null;
    need(payload && payload.domain === dom.id, dom.id + ": قاموسه " + dom.dict + " لا يعلن نطاقه");
  } catch (e) { errs.push(dom.id + ": تعذّر فحص قاموسه " + dom.dict + ": " + e.message); }
}
for (const d of DOMAINS) need(seenDomains.has(d.id), "نطاقٌ في الجدول بلا مدخلٍ في المانيفست: " + d.id);
need(!mf.permissions.some((p) => /^(?:https?|file|ftp):|^\*|^<all_urls>$/.test(p)), "نطاق مضيف مدسوس في permissions");
need(mf.background && mf.background.service_worker === "sw.js", "background.service_worker يجب أن يكون sw.js");

// ---- حدود المتجر (فحص الإطلاق 2026-09-18، G16): رفضٌ صامت يُكتشف هنا لا في لوحة المطوّرين ----
need(typeof mf.name === "string" && mf.name.length <= 75, "name يتجاوز 75 حرفًا: " + (mf.name || "").length);
need(typeof mf.short_name === "string" && mf.short_name.length <= 16, "short_name يتجاوز 16 حرفًا");
need(typeof mf.description === "string" && mf.description.length <= 132, "description يتجاوز 132 حرفًا: " + (mf.description || "").length);
need(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(mf.homepage_url || ""), "homepage_url مفقود أو ليس رابط المستودع");
for (const [size, file] of Object.entries(mf.icons || {})) {
  const fp = path.join(EXT, file);
  if (!fs.existsSync(fp)) continue; // يُبلَّغ عنه في فحص المراجع أدناه
  const b = fs.readFileSync(fp);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  need(String(w) === size && String(h) === size, "أبعاد الأيقونة " + file + " هي " + w + "×" + h + " لا " + size + "×" + size);
}

// كل ملف يشير إليه المانيفست موجود فعلًا
const refs = [];
for (const cs of mf.content_scripts || []) {
  for (const f of cs.js || []) refs.push(f);
  for (const f of cs.css || []) refs.push(f);
}
refs.push(mf.background.service_worker);
for (const k in mf.icons || {}) refs.push(mf.icons[k]);
if (mf.action) {
  if (mf.action.default_popup) refs.push(mf.action.default_popup);
  for (const k in mf.action.default_icon || {}) refs.push(mf.action.default_icon[k]);
}
if (mf.options_ui && mf.options_ui.page) refs.push(mf.options_ui.page);
for (const w of mf.web_accessible_resources || []) {
  for (const r of w.resources || []) if (!r.includes("*")) refs.push(r);
}
for (const r of refs) need(exists(r), "ملف يشير إليه المانيفست مفقود: " + r);

// وما يستورده عامل الخدمة (importScripts لا يمر بالمانيفست) — بعد إسقاط التعليقات:
// سطرٌ معلَّق فيه importScripts كان يُفشل البوابة على ملفٍ لا يُستورد أصلًا
const sw = fs.readFileSync(path.join(EXT, "sw.js"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
for (const m of sw.matchAll(/importScripts\(([^)]*)\)/g)) {
  for (const raw of m[1].split(",")) {
    const s = raw.trim();
    const q = /^["']([^"']+)["']$/.exec(s); // الحرفية المقتبسة وحدها تُفحص وجودًا
    if (q) need(exists(q[1]), "ملف يستورده عامل الخدمة مفقود: " + q[1]);
  }
}

// ---- مصنوعات محرّك الاتجاه ----
need(exists("rtl-overrides.css") && fs.statSync(path.join(EXT, "rtl-overrides.css")).size > 50000,
  "rtl-overrides.css مفقود أو هزيل");
try {
  await import(new URL("file:///" + path.join(EXT, "rtl-coverage.js").replace(/\\/g, "/")).href);
  need(globalThis.CMLRtlCoverage && globalThis.CMLRtlCoverage.keys.length > 500,
    "بصمات التغطية أقل من المتوقع: " + (globalThis.CMLRtlCoverage ? globalThis.CMLRtlCoverage.keys.length : 0));
} catch (e) { errs.push("rtl-coverage.js لا يُحمَّل: " + e.message); }

// ---- كل مفتاح تخزينٍ في كود الإضافة مصنَّف (مراجعة كودكس ٢٣): مفتاحٌ بلا صنف لا تمسّه
// «إعادة الضبط» ولا يُعرف أهو بيانات المستخدم أم ذاكرةٌ مؤقتة — فيُمنع قبل أن يُشحن
{
  const C = globalThis.CMLConst;
  // localStorage صفحة الخيارات، لا chrome.storage: الموقع المختار، وإشارة تسليمه من النافذة لمرةٍ واحدة
  const LOCAL_ONLY = new Set(["cml_ui_domain", "cml_ui_goto"]);
  const bases = new Set(C.KEY_CLASSES.map((e) => e.k));
  const bad = new Set();
  for (const f of fs.readdirSync(EXT).filter((n) => n.endsWith(".js"))) {
    const src = fs.readFileSync(path.join(EXT, f), "utf8");
    for (const m of src.matchAll(/["'](cml_[a-z0-9_]+)["']/g)) {
      const k = m[1];
      if (LOCAL_ONLY.has(k) || bases.has(k) || C.CLOUD_KEYS.some((c) => k === c || (c.endsWith("_") && k.startsWith(c)))) continue;
      bad.add(k + " (" + f + ")");
    }
  }
  need(!bad.size, "مفاتيح تخزين بلا صنف في KEY_CLASSES: " + [...bad].join("، "));
  const kept = C.keysOf(["keep"]);
  need(!C.RESET_KEYS.some((k) => kept.includes(k)), "«إعادة الضبط» تمسّ مفتاحًا محفوظًا عمدًا");
  for (const v of Object.values(C.K)) {
    if (C.CLOUD_KEYS.includes(v)) continue;
    need(bases.has(v), "مفتاحٌ في K بلا صنف: " + v);
  }
}

// ---- قطع المتون (المرحلة ٢): كل قطعةٍ في فهرسها موجودةٌ وسليمة وقوالبها تُحلَّل، ولا ملفٌّ خارج الفهرس،
// ولا مجلدٌ لنطاقٍ بلا متون — والعامل لا يقرأ إلا ما في الفهرس ----
{
  await import(pathToFileURL(path.join(EXT, "cml-shared.js")).href);
  const SH = globalThis.CMLShared, root = path.join(EXT, "bodies");
  let files = 0, bytes = 0;
  if (fs.existsSync(root)) {
    for (const d of fs.readdirSync(root)) {
      const dom = DOMAINS.find((x) => x.id === d);
      need(dom && dom.meta && dom.meta.bodies, "قطع متونٍ لنطاقٍ بلا متون: " + d);
      const okLangs = new Set(JSON.parse(fs.readFileSync(path.join(EXT, "languages.json"), "utf8")).languages.map((l) => l.code));
      for (const lang of fs.readdirSync(path.join(root, d))) {
        need(okLangs.has(lang), `bodies/${d}/${lang}: لغةٌ غير مفعّلة`);
        const dir = path.join(root, d, lang);
        let idx = null;
        try { idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")); } catch (e) { errs.push(`bodies/${d}/${lang}: فهرسٌ مفقود أو مختلّ`); continue; }
        need(idx.v === SH.BLOCK.V, `bodies/${d}/${lang}: إصدار التطبيع ${idx.v} والمحرّك ${SH.BLOCK.V}`);
        const listed = new Set(idx.shards || []);
        for (const f of fs.readdirSync(dir)) {
          if (f === "index.json") continue;
          need(f.endsWith(".json") && listed.has(f.slice(0, -5)), `bodies/${d}/${lang}/${f}: خارج الفهرس`);
        }
        for (const sh of listed) {
          const fp = path.join(dir, sh + ".json");
          if (!fs.existsSync(fp)) { errs.push(`bodies/${d}/${lang}/${sh}: في الفهرس ولا ملف`); continue; }
          let j = null;
          try { j = JSON.parse(fs.readFileSync(fp, "utf8")); } catch (e) { errs.push(`bodies/${d}/${lang}/${sh}: JSON مختلّ`); continue; }
          need(SH.shardOf(j.page) === sh, `bodies/${d}/${lang}/${sh}: اسم القطعة لا يطابق صفحتها`);
          const bad = Object.entries(j.blocks || {}).filter(([k, v]) => !/^[0-9a-f]{16}$/.test(k) || typeof v !== "string" ||
            /[\u0590-\u05FF]/.test(v) || !SH.parseTemplate(v));
          need(!bad.length, `bodies/${d}/${lang}/${sh}: ${bad.length} قالبًا مختلًّا`);
          // علامات الإبقاء (S6-C): بصماتٌ فقط — لا نصّ — ولا تتداخل مع ترجمات القطعة نفسها
          if (j.keep !== undefined) {
            const kb = Array.isArray(j.keep) ? j.keep.filter((k) => typeof k !== "string" || !/^[0-9a-f]{16}$/.test(k) ||
              Object.prototype.hasOwnProperty.call(j.blocks || {}, k)) : [null];
            need(!kb.length, `bodies/${d}/${lang}/${sh}: علامات إبقاءٍ مختلّة (${kb.length})`);
          }
          files++; bytes += fs.statSync(fp).size;
        }
      }
    }
  }
  // ★ (S6-C) كل نطاقٍ بمتونٍ له فهرسٌ لكل لغةٍ مفعّلة (ولو فارغًا): العامل يطلبه لكل صفحةٍ من صفحاته، وغيابه
  // خطأُ ERR_FILE_NOT_FOUND في طرفية الإضافة (وثائق Claude Code قبل ترجمة متونها)
  const enabled = JSON.parse(fs.readFileSync(path.join(EXT, "languages.json"), "utf8")).languages.map((l) => l.code);
  for (const dom of DOMAINS.filter((x) => x.meta && x.meta.bodies)) {
    for (const lang of enabled) need(fs.existsSync(path.join(root, dom.id, lang, "index.json")), `bodies/${dom.id}/${lang}/index.json: فهرسٌ مفقود لنطاقٍ بمتون`);
  }
  if (files) console.log(`ℹ قطع المتون: ${files} ملفًا، ${(bytes / 1048576).toFixed(2)} م.ب`);
}

// ---- الخطوط العربية المحزومة (§٥.٤ من تصميم الخطوط): القفل والملفات والتراخيص وNOTICE والفهرس
// والمعايرة والمدى والانجراف عن لقطات المواقع — كلها في fonts.mjs لتعمل وحدها أيضًا (node fonts.mjs verify).
// المعلَّق (ما ينتظر المعايرة أو الفهرس) لا يُفشل البوابة في CI، ويُفشلها مع --release ----
let fontsSummary = "";
{
  const r = await verifyFonts({ release: RELEASE });
  for (const n of r.notes) console.log("ℹ الخطوط: " + n);
  for (const p of r.pending) console.log("⧗ الخطوط، معلَّق: " + p);
  for (const e of r.errors) errs.push("الخطوط: " + e);
  if (r.fonts !== undefined) {
    fontsSummary = ` | الخطوط: ${r.fonts}، ${(r.bytes / 1024).toFixed(1)} KiB` + (r.pending.length ? ` (${r.pending.length} فحوصٍ معلَّقة)` : "");
  }
}

// ---- لا ممنوعات داخل مجلد الإضافة (قاعدة قائمة السماح تحرس النشر — وهذه تحرس CI) ----
// المشي **تعاودي**: مسحُ المستوى الأعلى وحده كان يُمرِّر pem مدسوسًا في icons/ (جُرِّب)
const FORBIDDEN = [/\.pem$/i, /\.crx$/i, /HANDOFF/i, /claude-ALL-strings/i, /en-US\.json$/i, /STORE-LISTING/i];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const fp = path.join(d, e.name);
    if (e.isDirectory()) { walk(fp); continue; }
    need(!FORBIDDEN.some((re) => re.test(e.name)), "ملف ممنوع داخل الإضافة: " + path.relative(EXT, fp));
  }
})(EXT);

// ---- قاعدة سوار (siwar-lib.mjs): حيث قاعدة المصطلحات موجودة (مستودع التطوير) — لا يُلتزم من سوار إلا المقابل المعتمد ----
{
  const tb = path.join(GLOSSARY, "terms-base.json");
  if (fs.existsSync(tb)) {
    const base = JSON.parse(fs.readFileSync(tb, "utf8"));
    const adopted = loadAdopted();
    for (const v of siwarViolations(base, adopted)) errs.push(`قاعدة المصطلحات: مصدرٌ من سوار بزوجٍ ليس مقابلًا معتمدًا: ${v.term} ← ${v.code} ${v.entry || ""}`);
    for (const v of proseViolations(base, adopted)) errs.push(`قاعدة المصطلحات: ${v.term}.${v.field} تنسب إلى معجمٍ من سوار صياغةً ليست مقابلًا معتمدًا`);
    for (const f of docsCsvFiles()) {
      for (const v of siwarCsvViolations(fs.readFileSync(f, "utf8"), base, path.basename(f), adopted)) errs.push(`${v.file} صف ${v.row} (${v.term}): صياغةٌ من سوار ليست مقابلًا معتمدًا`);
    }
  }
}

// ---- ★ (ر8-ب) قائمتا المعاجم والمصادر في «حول» وREADME تطابقان ملف المصادر بندًا بندًا (check-sources.mjs): حيث الملف موجود
// (مستودع التطوير)، وفي المستودع العام يُصرَّح بالتخطّي ----
{
  const r = checkSources();
  if (r.skipped) console.log("ℹ قوائم المصادر: " + r.skipped);
  else {
    for (const n of r.notes) console.log("ℹ قوائم المصادر: " + n);
    for (const e of r.errors) errs.push("قوائم المصادر: " + e);
    if (!r.errors.length) console.log("ℹ قوائم المصادر: " + r.summary);
  }
}

if (errs.length) {
  console.error("✗ بوابة الحزمة أخفقت:");
  for (const e of errs) console.error("  - " + e);
  process.exit(1);
}
console.log(`✓ الحزمة سليمة${RELEASE ? " للإصدار" : ""}: الإصدار ${mf.version} | صلاحيات [storage] | ${refs.length} ملفًا مُشارًا إليه كلها موجودة${fontsSummary}`);
