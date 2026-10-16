// completeness.mjs — بوابة الشمول قبل كل إصدار: هل كل ما يُفترض تعريبه معرَّب، ولم يسقط نصٌّ بين المصدر والحزمة؟
//
// لماذا (طلب المالك قبل 1.1.0): «فحصٌ للتأكد من شمولية المواقع المفترض ترجمتها، وأنه لم يسقط أي نص مع الكم الكبير
// من النصوص». النسب وحدها لا تكفي: نصٌّ يسقط في الدمج أو البناء لا تراه نسبة التغطية، وصفحةٌ لم تُحصد قطّ لا تظهر
// في أي مدوّنة أصلًا. فالبوابة ثلاث طبقاتٍ مستقلة، ولكلٍّ منها مصدرُ حقيقةٍ غيرُ الذي تفحصه:
//
//  ١) النطاق (المواقع والصفحات): المانيفست يطابق جدول النطاقات مطابقاتٍ واستثناءات؛ وقائمةُ صفحات كل موقعٍ من فهرسه
//     العام (خريطة الموقع أو llms.txt) تُقسَم بحارس المسار نفسه إلى «مقصود» و«خامل»، ثم يُقارَن المقصود بما حُصد:
//     صفحةٌ مقصودة لم تُحصد = نصوصُها لم تدخل القاموس أصلًا. وعنوانٌ إنجليزي يُخمده الحارس، أو غير إنجليزي يفعّله، خلل.
//  ٢) النصوص: مدوّنة كل موقع (حصاد الحزم للتطبيق ومعه كتالوج سطح المكتب إن مُرِّر، وحصاد DOM للبقية، وحصاد الكتل
//     للمتون) تُقاس على القاموس **بمنطق المحرّك** (حرفي ثم نمط ثم جمع). وما يُترك إنجليزيًّا قصدًا مسجّلٌ بسببه في
//     keep-en.json بمجلد عمل النطاق (ونصوص المحتوى منه في ‎_keep-en.generated.json‎ خارج git) — فلا يبقى «باقٍ» بلا تفسير.
//     ★ (ر5) والسمات داخل المتن (aria-label وtitle وalt وplaceholder في موقعٍ ذي متون) فئةٌ مستقلة بقاموس الواجهة: تُعدّ وتُذكر ولا تُسقط البوابة.
//  ٣) السلامة («لم يسقط نص»): لا مفتاح مكرر ولا قيمة فارغة؛ المتغيّرات {x} والوسوم متطابقة في كل زوج؛ كل عنصرٍ في
//     الدفعات المترجمة حاضرٌ في القاموس (أو خلفه قيمةٌ أحدث)؛ القاموس المبنيّ في الإضافة يطابق مصدره مفتاحًا مفتاحًا
//     وقيمةً قيمة؛ وقطع المتون تحمل كل كتلةٍ مدموجة لكل صفحة.
//
// الطبقة الرابعة (ما يبقى إنجليزيًّا على الصفحة بالإضافة الحقيقية) في rtl-audit.mjs لأنه يحمّل الإضافة فعلًا.
//
//   node completeness.mjs [--domain=<نطاق>|all] [--ext=<مجلد الإضافة>] [--catalog=<كتالوج JSON إضافي للتطبيق>]
//                         [--offline] [--strict] [--max-missing=<عدد>] [--json=<ملف التقرير>]
//   ‎--offline‎: بلا جلب الفهارس العامة (تُعلَن الطبقة ١ ناقصةً لا ناجحة).
//   ‎--strict‎: رمز خروج 1 إن وُجد خللُ سلامة أو نطاق، أو باقٍ غير مفسَّر فوق ‎--max-missing‎ (افتراضه 0).
//   ★ (S7-B، ٢١ ربيع الآخر ١٤٤٨هـ — مرجع الواجهة البرمجية صار مسارًا كاملًا في الوثائق، فصفحاته الـ492 مقصودةٌ كلّها لا عيّنةَ هيكل):
//   ‎--harvest-dir=<مجلد>[,<مجلد>…]‎: مجلدات حصادٍ إضافية للنطاق (حصادٌ مستقلّ لقسمٍ منه، كمرجع الوثائق) — أحدثُ حصاد DOM وأحدثُ
//        حصاد كتلٍ في كلٍّ منها يُضمّان إلى أحدثهما في مجلد عمل النطاق: صفحاتٍ ومفاتيحَ وكتلًا.
//   ‎--section=<بادئة مسار>[,…]‎: قسمٌ يُقاس وحده أيضًا (المقصود والمحصود ولم يُحصد، وكتل صفحاته) — ‎--section=/docs/en/api/‎.
//   والعنوان يُقارن بمساره القانوني ومنه meta.pageAlias (صفحات SDK في المرجع هي صفحاتها القانونية).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DICTS, EXT as EXT0 } from "./paths.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { C, SHARED, domainArg, domainsOf, dictFile, workDir, batchDir, label, blocksDictFile, blockBatchDir, latestBlocksHarvest, latestHarvest } =
  await import(new URL("./domain-arg.mjs", import.meta.url).href);
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find((x) => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : d; };
const flag = (k) => argv.includes("--" + k);
const SEL = domainArg(process.argv, { allowAll: true, fallback: "all" });
const EXT = path.resolve(opt("ext", EXT0));
const STRICT = flag("strict"), OFFLINE = flag("offline");
const MAX_MISSING = +opt("max-missing", "0");
const HARVEST_DIRS = opt("harvest-dir", "").split(",").filter(Boolean).map((p) => path.resolve(p));
for (const d of HARVEST_DIRS) if (!fs.existsSync(d)) { console.error("! ‎--harvest-dir‎ غير موجود: " + d); process.exit(2); }
const SECTIONS = opt("section", "").split(",").filter(Boolean);
// أحدث ملفٍّ باسمٍ يطابق النمط في مجلد (حصاد DOM أو حصاد كتل) — أو null
function latestIn(dir, re) {
  const f = fs.readdirSync(dir).filter((n) => re.test(n)).sort().pop();
  return f ? path.join(dir, f) : null;
}

const report = { at: new Date().toISOString(), ext: EXT, domains: {}, failures: [], warnings: [] };
const fail = (d, layer, msg, detail) => { report.failures.push({ d, layer, msg, detail }); };
const warn = (d, layer, msg, detail) => { report.warnings.push({ d, layer, msg, detail }); };
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const VAR = /\{([A-Za-z_$][\w$]*)\}/g;
const varsOf = (s) => { const o = []; let m; VAR.lastIndex = 0; while ((m = VAR.exec(String(s)))) o.push(m[1]); return o.sort().join(","); };
const TAG = /<\/?([A-Za-z][\w-]*)\b[^>]*>/g;
const tagsOf = (s) => { const o = []; let m; TAG.lastIndex = 0; while ((m = TAG.exec(String(s)))) o.push(m[0].startsWith("</") ? "/" + m[1] : m[1]); return o.sort().join(","); };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------- المانيفست ----------
let manifest = null;
try { manifest = readJson(path.join(EXT, "manifest.json")); } catch (e) { fail("*", "scope", "لا مانيفست في " + EXT); }

// ---------- القاموس بمنطق المحرّك ----------
function matcherOf(dict) {
  const S = dict.strings || {};
  // ★ (٢١ ربيع الآخر ١٤٤٨هـ، توجيه المالك: لا سقف طول) الأنماط بفهرس المحرّك نفسه (cml-shared patternIndex) وشرطه: ما تلتقطه
  // المتغيّرات من النص مجتمعةً ≤ PATTERN_CAPTURE_MAX — فالنص الطويل يُقاس كما يعرضه المحرّك (قالبه الطويل يغطّيه، ونمطٌ قصيرٌ
  // عامّ لا يُعدّ غطاءً له)، وبلا مسحٍ خطيٍّ لآلاف التعبيرات على كل نصٍّ طويل
  const rawPats = (dict.patterns || []).map((p) => { try { return { re: new RegExp(p.re), ar: p.ar, src: p.re }; } catch { return null; } }).filter(Boolean);
  const pidx = SHARED.patternIndex(rawPats.map((p) => p.src));
  const CAPMAX = C.PATTERN_CAPTURE_MAX;
  const firstPat = (s) => { const r = pidx.find(s, (i) => (rawPats[i].re.test(s) ? { i } : null), CAPMAX); return r ? rawPats[r.i] : null; };
  const plur = [];
  for (const [en, sp] of Object.entries(dict.plurals || {}))
    for (const p of [en, sp && sp.plural]) if (p) plur.push(new RegExp("^" + esc(p).replace("%d", "(\\d+)") + "$"));
  // ★ (المراجعة العدائية، ٢١ ربيع الآخر ١٤٤٨هـ) القالب ({x}) يُحكم كما يحكم harvest-live (ب): نمطٌ بمفتاحه نفسه (p.en === s)
  // يغطّيه، أو عرضُه بقيمٍ نموذجية (رقمٌ لمتغيّرات العدّ، وكلمةٌ علمٌ لغيرها) كما يراه المستخدم. التقاطٌ عدديٌّ أو أيامُ أسبوعٍ
  // صريحة لا يطابق نصَّ «{x}» نفسه، فكان تضييقُ نمطٍ عريض («{users} users» ⇒ رقم) يُعدّ هنا «باقيًا» كاذبًا وهو مغطًّى وقت العرض
  const patEn = new Set((dict.patterns || []).map((p) => p.en));
  const ONE_VAR = /\{[A-Za-z_$][\w$]*\}/;
  const NUMERIC_NAME = /^(count|n|num|number|total|percent|pct|percentage|amount|size|limit|days?|hours?|minutes?|mins?|seconds?|secs?|weeks?|months?|years?|remaining|used|max|min|index|position|price|cost|credits?|seats?|tokens?|quantity|qty|value|answered|passing|failed|passed|pending|skipped|elapsed|delta)$/i; // كما في harvest-live
  const sampleOf = (s) => s.replace(/\{([A-Za-z_$][\w$]*)\}/g, (m, n) => (NUMERIC_NAME.test(n) ? "3" : "Zeddicus"));
  const plain = (s) => S[s] !== undefined ? "literal" : firstPat(s) ? "pattern" : plur.some((r) => r.test(s)) ? "plural" : null;
  // (والعرض بالقيم النموذجية لا يُعدّ غطاءً إن أخرج كلامًا إنجليزيًّا ليس من القيم ولا من عربية النمط — قاعدة mixedVarOf نفسها)
  const f = (s) => {
    const how = plain(s);
    if (how || !ONE_VAR.test(s)) return how;
    if (patEn.has(s)) return "pattern";
    const t = sampleOf(s);
    if (S[t] !== undefined) return "literal";
    if (plur.some((r) => r.test(t))) return "plural";
    const p = firstPat(t);
    if (!p) return null;
    const m = t.match(p.re);
    const out = p.ar.replace(/\$(\d)/g, (x, g) => (m[+g] !== undefined ? m[+g] : ""));
    const allowed = new Set(["Zeddicus", ...(p.ar.match(/[A-Za-z]{2,}/g) || [])]);
    return (out.split("Zeddicus").join(" ").match(/[A-Za-z]{2,}/g) || []).some((w) => !allowed.has(w)) ? null : "pattern";
  };
  // ناتج النمط الأول المطابق بترتيب القاموس (كالمحرّك): $n وحدها تُعوَّض؛ وقواعد الشهور والأيام والأماكن تُترك (صحيحةٌ حتمًا)
  f.render = (s) => {
    const p = firstPat(s);
    if (!p) return null;
    const m = s.match(p.re);
    if (/%[MWPC]\d/.test(p.ar)) return null;
    return { out: p.ar.replace(/\$(\d)/g, (x, g) => (m[+g] !== undefined ? m[+g] : "")), caps: m.slice(1).filter((c) => c !== undefined) };
  };
  f.S = S;
  return f;
}
// ★ (ر4-ب، ٢٨ ربيع الآخر ١٤٤٨هـ) وبعده ملفٌّ مولَّد ‎_keep-en.generated.json‎ في مجلد عمل النطاق: نصوص المحتوى الإنجليزية المتروكة قصدًا
// (المؤجَّل إلى 3.0.0 وأسماء الناس وبيانات الندوات…) لا تُلتزم في ملفٍّ متتبَّع — نصوص المواقع مكانها مستودع البيانات — فيبقى keep-en.json
// لنصوص الواجهة القصيرة، ويُقرأ المولَّد بعده (خارج git بقاعدة ‎web/code/glossary/*/_*.json‎). والأول يغلب في مفتاحٍ مكرر بين الملفين،
// وداخل الملف الواحد كما كان؛ والنطاق الذي لا ملفّ مولَّدًا له لا يتغيّر شيءٌ عنده
function keepEnOf(d) {
  const out = new Map();
  for (const name of ["keep-en.json", "_keep-en.generated.json"]) {
    const f = path.join(workDir(d), name);
    if (!fs.existsSync(f)) continue;
    const j = readJson(f);
    for (const [en, why] of new Map((j.keep || []).map((k) => [k.en, k.why]))) if (!out.has(en)) out.set(en, why);
  }
  return out;
}
// مفتاحٌ مكرر بمسحٍ نصيٍّ خام (JSON.parse يُبقي الأخير صامتًا)
function rawDuplicateKeys(file) {
  const txt = fs.readFileSync(file, "utf8");
  const i = txt.indexOf('"strings"');
  if (i < 0) return [];
  const seen = new Set(), dup = [];
  const re = /^\s*"((?:[^"\\]|\\.)*)"\s*:/gm;
  re.lastIndex = i;
  let depth = 0, m;
  // حدود كائن strings: من أول { بعد المفتاح إلى القوس المغلق المقابل
  const start = txt.indexOf("{", i);
  let end = start;
  for (let k = start; k < txt.length; k++) {
    const ch = txt[k];
    if (ch === '"') { k++; while (k < txt.length && txt[k] !== '"') { if (txt[k] === "\\") k++; k++; } continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (!depth) { end = k; break; } }
  }
  re.lastIndex = start;
  while ((m = re.exec(txt)) && m.index < end) { const k = m[1]; if (seen.has(k)) dup.push(k); else seen.add(k); }
  return dup;
}
function builtDict(domain) {
  const f = path.join(EXT, domain.dict);
  if (!fs.existsSync(f)) return null;
  const sb = {};
  vm.createContext(sb); // globalThis داخل السياق هو sb نفسه
  vm.runInContext(fs.readFileSync(f, "utf8"), sb);
  return sb.CLAUDE_L10N || null;
}

// ---------- الفهرس العام لصفحات الموقع ----------
async function fetchText(url) {
  const r = await fetch(url, { headers: { "User-Agent": "claude-mutarjim completeness gate (public index, build-time)" }, redirect: "follow" });
  if (!r.ok) throw new Error(url + " → HTTP " + r.status);
  return r.text();
}
// ★ (مراجعة القيود لوثائق Claude Code، ١٦ ربيع الآخر ١٤٤٨هـ) المصدران معًا لا أولُهما وحده: فهرس llms.txt وخريطة الموقع
// يُضمّان، والعنوان بمساره القانوني («…/index» مسارُ أبيه كما في SHARED.pageKey، وبلا شرطةٍ ختامية) — كان الفهرس وحده
// يُقرأ فيُعدّ ‎/docs/en/whats-new/index‎ محصودًا والموقعُ (رابطه القانوني وشريطه وخريطته) يقول ‎/docs/en/whats-new‎
function canonUrl(u) {
  try { const x = new URL(u); x.hash = ""; x.search = ""; x.pathname = (x.pathname.replace(/\/+$/, "").replace(/\/index$/, "")) || "/"; return x.href; }
  catch { return u; }
}
async function siteIndex(domain) {
  const out = new Set();
  const tried = [];
  const meta = domain.meta || {};
  const sources = meta.scan === "llms" ? [domain.origin + (meta.llms || "/llms.txt")] : [];
  sources.push(domain.origin + "/sitemap.xml");
  for (const src of sources) {
    try {
      const txt = await fetchText(src);
      const n0 = out.size;
      if (/\.xml$/.test(src)) {
        const locs = [...txt.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
        // فهرس خرائط: خرائط فرعية تُجلب مرّةً واحدة
        const subs = locs.filter((u) => /sitemap[^/]*\.xml$/i.test(u));
        for (const s of subs) { try { const t2 = await fetchText(s); for (const m of t2.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) out.add(canonUrl(m[1])); tried.push(s); } catch (e) { warn(domain.id, "scope", "خريطةٌ فرعية تعذّرت: " + s); } }
        for (const u of locs) if (!subs.includes(u)) out.add(canonUrl(u));
      } else {
        for (const m of txt.matchAll(/\((https?:\/\/[^)\s]+)\)/g)) out.add(canonUrl(m[1].replace(/\.md$/, "")));
      }
      tried.push(src + " (+" + (out.size - n0) + ")");
    } catch (e) { tried.push(src + " ✗ " + e.message); }
  }
  return { urls: [...out], tried };
}
// ★ صفحاتٌ مقصودة لا تُحصد أبدًا بقرارٍ مسجَّل بسببه (<مجلد عمل النطاق>/scope-exempt.json: {pages:[{url, why, date}]}) —
// كقرارات فحص الاتجاه: لا يُعفى عنوانٌ من الشمول إلا بسببٍ مكتوب (صفحةٌ يحجبها تحدّي Cloudflare عن المتصفح الآلي مثلًا)
function scopeExemptOf(d) {
  const f = path.join(workDir(d), "scope-exempt.json");
  if (!fs.existsSync(f)) return new Map();
  return new Map((readJson(f).pages || []).map((x) => [canonUrl(x.url), x.why || ""]));
}
function matchesUrl(patterns, url) {
  return (patterns || []).some((p) => new RegExp("^" + p.split("*").map(esc).join(".*") + "$").test(url));
}

// ================================================================
for (const d of domainsOf(SEL)) {
  const domain = C.domain(d);
  const R = report.domains[d] = { name: domain.name, scope: {}, text: {}, integrity: {} };

  // ---------- ١) النطاق ----------
  if (manifest) {
    const cs = (manifest.content_scripts || []).find((c) => (c.js || []).includes(domain.dict));
    if (!cs) fail(d, "scope", "لا مدخل مانيفست يحمل " + domain.dict);
    else {
      const a = JSON.stringify([...cs.matches].sort()), b = JSON.stringify([...domain.matches].sort());
      if (a !== b) fail(d, "scope", "مطابقات المانيفست تخالف الجدول", { manifest: cs.matches, table: domain.matches });
      if (!!cs.all_frames !== !!domain.allFrames) fail(d, "scope", "all_frames يخالف الجدول");
      if (JSON.stringify(cs.exclude_matches || []) !== JSON.stringify(domain.excludeMatches || []))
        fail(d, "scope", "استثناءات المانيفست تخالف الجدول", { manifest: cs.exclude_matches, table: domain.excludeMatches });
      // إطاراتٌ مضمَّنة من مضيفٍ فرعي داخل موقعٍ غير معرَّب (عروض assets.claude.ai في claude.com): مطابقةٌ بنجمة
      // مع all_frames بلا استثناءٍ لها تحقن المحرّك فيها فتنقلب وتُعرَّب داخل صفحةٍ غير معرَّبة
      if (cs.all_frames && cs.matches.some((m) => /\*\./.test(m)) && d === "app" &&
          !(cs.exclude_matches || []).some((m) => /assets\.claude\.ai/.test(m)))
        fail(d, "scope", "إطارات assets.claude.ai غير مستثناة (مطابقة ‎*.claude.ai‎ مع all_frames)");
      R.scope.matches = cs.matches; R.scope.exclude = cs.exclude_matches || [];
    }
  }
  // ★ (S7-B) حصاد مجلد عمل النطاق ومعه أحدثُ ما في مجلدات ‎--harvest-dir‎ (حصادٌ مستقلّ لقسمٍ من الموقع)
  // ★ (S9-M، ٢٢ ربيع الآخر ١٤٤٨هـ) وحصادُ ‎--harvest-dir‎ لنطاقه وحده (حقل domain فيه): مع ‎--domain=all‎ كان حصاد مرجع الوثائق يُضمّ
  // إلى مركز المساعدة والخصوصية ووثائق Claude Code فتُعدّ كتله الـ2,421 وصفحاته الـ501 «باقيةً» فيها (88.48% و29.68% كذبًا)
  const ofDomain = (f) => { try { const h = readJson(f); return !h.domain || h.domain === d; } catch { return false; } };
  const harvests = [latestHarvest(d)].concat(HARVEST_DIRS.map((x) => latestIn(x, /^harvest-.*\.json$/)).filter((f) => f && ofDomain(f))).filter(Boolean);
  const blocksHvs = [latestBlocksHarvest(d)].concat(HARVEST_DIRS.map((x) => latestIn(x, /^blocks-.*\.json$/)).filter((f) => f && ofDomain(f))).filter(Boolean);
  const harvest = harvests[0] || null, blocksHv = blocksHvs[0] || null;
  // العنوان بمساره القانوني ومنه meta.pageAlias (صفحة SDK في المرجع هي صفحتها القانونية) — لا مفتاح Intercom (رقمٌ لا مسار)
  const dmeta = domain.meta || {};
  const canonD = (u) => {
    const c = canonUrl(u);
    if (!dmeta.pageAlias || dmeta.intercom) return c;
    try { const x = new URL(c); x.pathname = SHARED.pageKey(dmeta, x.pathname); return x.href; } catch { return c; }
  };
  const harvestedUrls = new Set();
  // ★ (مراجعتا القيود والمحرّك، ١٦ ربيع الآخر ١٤٤٨هـ) صفحةٌ أخفق حصادها (خطأٌ مسجَّل: تحدّي Cloudflare، أو تحويلٌ إلى خارج
  // النطاق، أو مهلة) أو لم يُحصد منها مفتاحٌ واحد ليست «محصودة»: تُعدّ وحدها بسببها، وتبقى في «لم تُحصد» ما لم يُعفِها قرار
  const failedPages = [];
  for (const hf of harvests) for (const p of readJson(hf).pages || []) {
    if (p.error || !p.keys) { failedPages.push({ url: p.url, why: p.error || "لم يُحصد منها مفتاح (مهلة أو صفحة فارغة)" }); continue; }
    harvestedUrls.add(p.url); if (p.final) harvestedUrls.add(p.final);
  }
  for (const bf0 of blocksHvs) { const us = readJson(bf0).urls || {}; for (const u of Array.isArray(us) ? us : Object.values(us)) harvestedUrls.add(typeof u === "string" ? u : u.url); }
  R.scope.harvests = harvests.map((f) => path.basename(path.dirname(path.dirname(f))) + "/" + path.basename(path.dirname(f)) + "/" + path.basename(f));
  if (d !== "app") {
    if (OFFLINE) warn(d, "scope", "الفهرس العام لم يُجلب (‎--offline‎) — شمول الصفحات غير مقيس");
    else {
      const idx = await siteIndex(domain);
      R.scope.indexSources = idx.tried;
      if (!idx.urls.length) fail(d, "scope", "تعذّر جلب فهرس صفحات الموقع — شمول الصفحات غير مقيس", idx.tried);
      const intended = [], idle = [], misrouted = [], shellPages = [];
      for (const u of idx.urls) {
        let url; try { url = new URL(u); } catch { continue; }
        if (url.origin !== domain.origin) continue;
        const inMatch = matchesUrl(domain.matches, url.href) || matchesUrl(domain.matches, url.origin + url.pathname);
        const mode = inMatch ? SHARED.routeMode(domain.meta && domain.meta.routes, url.pathname) : "unmatched";
        // مقطع اللغة في المسار (/<رمز>/ أو /docs/<رمز>/): الإنجليزي مقصود، وغيره خامل حتمًا — والتعريب لا يمسّ صفحةً بلغةٍ أخرى
        const loc = /^\/(?:docs\/)?([a-z]{2}(?:-[a-z]{2,4})?)(?:\/|$)/i.exec(url.pathname);
        const english = !loc || loc[1].toLowerCase() === "en";
        if (mode === "full") { intended.push(url.href); if (!english) misrouted.push("مفعَّلٌ بلغةٍ أخرى: " + url.href); }
        else if (mode === "shell") { shellPages.push(url.href); if (!english) misrouted.push("مفعَّلٌ بلغةٍ أخرى: " + url.href); }
        else { idle.push(url.href); if (loc && loc[1].toLowerCase() === "en") misrouted.push("إنجليزيٌّ خامل: " + url.href); }
      }
      const norm = canonD;
      for (const f of failedPages) harvestedUrls.delete(f.url);
      const hv = new Set([...harvestedUrls].map(norm));
      const exempt = scopeExemptOf(d);
      const exempted = intended.filter((u) => !hv.has(norm(u)) && exempt.has(norm(u)));
      const notHarvested = intended.filter((u) => !hv.has(norm(u)) && !exempt.has(norm(u)));
      R.scope.failed = failedPages.map((f) => ({ url: f.url, why: f.why, exempt: exempt.has(norm(f.url)) ? exempt.get(norm(f.url)) : null }));
      R.scope.exempt = exempted.map((u) => ({ url: u, why: exempt.get(norm(u)) }));
      if (failedPages.length) warn(d, "scope", `${failedPages.length} صفحةً أخفق حصادها (لا تُعدّ محصودة) — ${failedPages.filter((f) => exempt.has(norm(f.url))).length} منها معفاةٌ بقرار`,
        R.scope.failed.slice(0, 20));
      // الهيكل (سجلّ إصدارات Claude Code؛ وكان مرجع الوثائق قبل S7-B): المتن إنجليزي بقرار، والواجهة مشتركة — يكفي أن تُحصد منه صفحاتٌ تمثّل قوالبه
      const shellHarvested = shellPages.filter((u) => hv.has(norm(u))).length;
      R.scope.shell = shellPages.length; R.scope.shellHarvested = shellHarvested;
      if (shellPages.length && !shellHarvested) fail(d, "scope", `${shellPages.length} صفحة هيكلٍ ولا واحدة منها محصودة — واجهة قالبها غير مقيسة`);
      R.scope.index = idx.urls.length; R.scope.intended = intended.length; R.scope.idle = idle.length;
      R.scope.harvested = [...hv].length; R.scope.notHarvested = notHarvested.length; R.scope.exempted = exempted.length;
      if (notHarvested.length) fail(d, "scope", `${notHarvested.length} صفحةً مقصودة من ${intended.length} لم تُحصد — نصوصها لم تدخل القاموس`, notHarvested.slice(0, 50));
      if (misrouted.length) fail(d, "scope", `${misrouted.length} عنوانًا يخالف حارس المسار (غير إنجليزي مفعَّل أو إنجليزي خامل)`, misrouted.slice(0, 30));
      // ★ (S7-B) أقسامٌ تُقاس وحدها (‎--section‎، كمرجع الوثائق): المقصود والمحصود ولم يُحصد في كلٍّ منها
      R.scope.sections = {};
      for (const sp of SECTIONS) {
        const inSec = (u) => { try { return new URL(u).pathname.indexOf(sp) === 0; } catch { return false; } };
        const si = intended.filter(inSec), sn = notHarvested.filter(inSec), se = exempted.filter(inSec);
        R.scope.sections[sp] = { intended: si.length, harvested: si.length - sn.length - se.length, notHarvested: sn.length, exempted: se.length,
          sample: sn.slice(0, 10) };
      }
    }
  }

  // ---------- ٢) النصوص ----------
  const dictPath = dictFile(d);
  const dict = fs.existsSync(dictPath) ? readJson(dictPath) : { strings: {}, patterns: [], plurals: {} };
  const covers = matcherOf(dict);
  const keep = keepEnOf(d);
  const inventories = [];
  let bodyAttrKeys = null;   // ★ (ر5) سمات المتن من حصاد DOM — null: النطاق بلا متن أو بلا حصاد DOM
  if (d === "app") {
    const live = path.join(workDir(d), "_live-catalog.txt");
    if (fs.existsSync(live)) inventories.push({ name: "حزم claude.ai (harvest-live)", source: true, at: fs.statSync(live).mtime.toISOString().slice(0, 10),
      items: fs.readFileSync(live, "utf8").split(/\r?\n/).filter(Boolean) });
    else fail(d, "text", "لا حصاد حيّ للتطبيق — شغّل harvest-live.mjs");
    const cat = opt("catalog", "");
    if (cat) {
      // كتالوج رسائل الواجهة (مفتاح ← نص) — الرسائل بصيغة ICU المركّبة تُعدّ ولا تُقاس حرفيًّا (يغطيها النمط والجمع وقت العرض)
      const j = readJson(cat);
      const vals = Object.values(j).map((v) => typeof v === "string" ? v : v && v.defaultMessage).filter((v) => typeof v === "string");
      inventories.push({ name: "كتالوج " + path.basename(cat), items: vals.filter((v) => !/\{[^}]*,\s*(plural|select|selectordinal)\s*,/.test(v)),
        icu: vals.filter((v) => /\{[^}]*,\s*(plural|select|selectordinal)\s*,/.test(v)).length });
    }
  } else if (harvests.length) {
    // المتن (zone=body) يُترجم بوضع الكتلة فيُقاس في طبقة المتون؛ هنا الواجهة وما يتكرر فيها وفي المتن (ui/both)
    // (والحصادات كلها معًا: مجلد عمل النطاق ومجلدات ‎--harvest-dir‎)
    const hk = [].concat(...harvests.map((f) => readJson(f).keys || []));
    inventories.push({ name: "واجهة (حصاد DOM " + harvests.map((f) => path.basename(f)).join(" + ") + ")", dom: true, items: hk.filter((r) => r.zone !== "body").map((r) => r.key) });
    // ★ (ر5، ٢٩ ربيع الآخر ١٤٤٨هـ — ملاحظة ر3) السمات داخل المتن (aria-label وtitle وalt وplaceholder، zone=body): لا تقيسها طبقة المتون (الكتلة
    // عقدُ نصٍّ لا سمات) ولا الواجهة أعلاه (منطقتها body)، ويترجمها قاموس الواجهة وحده. تُقاس بمنطقه هنا فئةً مستقلة تُذكر ولا تُسقط البوابة
    // ولو مع ‎--strict‎ (تنبيهٌ وحده) — شرط البوابة كما كان حتى يقرّر المنسِّق
    if (domain.meta && domain.meta.bodySel)
      bodyAttrKeys = [...new Set(hk.filter((r) => r.zone === "body" && (r.kinds || []).some((k) => String(k).indexOf("attr:") === 0)).map((r) => r.key))];
  } else fail(d, "text", "لا حصاد DOM لـ" + label(d));
  R.text.inventories = [];
  for (const inv of inventories) {
    const uniq = [...new Set(inv.items)];
    let hit = 0, kept = 0; const miss = [], mixed = [];
    const by = { literal: 0, pattern: 0, plural: 0 };
    for (const s of uniq) {
      const how = covers(s);
      // ★ خطر الخلط (حزم التطبيق مصدرٌ لا عرض): نصٌّ حرفيّ بلا متغيّر لا يطابقه إلا نمط = سيُعرض بعربيةٍ يتخلّلها
      // باقٍ إنجليزي («Add a flag» ← «أضِف a flag»). يُترجم حرفيًّا أو يُضيَّق نمطه — لا يُحسب مغطًّى
      if (how === "pattern" && inv.source && !/\{[A-Za-z_$][\w$]*\}/.test(s)) {
        const r = covers.render(s);
        // خلطٌ حقيقي: قيمةٌ ملتقطة هي في الحقيقة كلامٌ إنجليزي لا اسم — أداةُ تعريف، أو كلمةٌ صغيرة الحرف الأول،
        // أو كلمةٌ يترجمها القاموس نفسه («Read» ← «قراءة») — فتبقى إنجليزيةً وسط العربية
        const wordy = (c) => /^(a|an|the)$/i.test(c) || /^[a-z]{2,}/.test(c) || (/^[A-Za-z][A-Za-z ]*$/.test(c) && covers.S[c] !== undefined && covers.S[c] !== c);
        if (r && r.out !== s && r.caps.some(wordy)) { mixed.push(s + "  ⇒  " + r.out); continue; }
      }
      // ★ (مراجعة دمج ت3، ٢٩ ربيع الآخر ١٤٤٨هـ) نصٌّ مُبقًى بقرار (keep-en) لا يعرّبه إلا نمطٌ أو جمع = نمطٌ عامّ ابتلع ما قرّرنا إبقاءه:
      // «From {start} to {end}» عرض ملخّصَين مؤجَّلين إلى 3.0.0 مختلطين («من learner إلى trainer: what it means…») وكانا يُعدّان هنا مغطّيَين.
      // تناقضٌ لا غطاء. في حصاد DOM وحده (ما يعرضه الموقع)، ففحص الخلط أعلاه لحزم التطبيق وحدها
      if (inv.dom && (how === "pattern" || how === "plural") && keep.has(s)) { const r = covers.render(s); mixed.push(s + "  ⇒  " + (r ? r.out : how)); continue; }
      if (how) { hit++; by[how]++; continue; }
      if (keep.has(s) || !/[A-Za-z]{2}/.test(s)) { kept++; continue; } // مُستبقًى بقرار، أو لا نصَّ لاتينيًّا فيه
      miss.push(s);
    }
    const rec = { name: inv.name, total: uniq.length, covered: hit, keptEnglish: kept, missing: miss.length, mixed: mixed.length,
      pct: +(100 * (hit + kept) / Math.max(1, uniq.length)).toFixed(2), by, icu: inv.icu };
    R.text.inventories.push(rec);
    fs.mkdirSync(workDir(d), { recursive: true });
    fs.writeFileSync(path.join(workDir(d), `_completeness-missing-${R.text.inventories.length}.txt`), miss.join("\n") + "\n", "utf8");
    if (miss.length > MAX_MISSING) (STRICT ? fail : warn)(d, "text", `${inv.name}: ${miss.length} نصًّا بلا ترجمة ولا قرار إبقاء`, miss.slice(0, 20));
    const mixedFile = path.join(workDir(d), "_completeness-mixed.txt");
    if (mixed.length) {
      fail(d, "text", `${inv.name}: ${mixed.length} نصًّا حرفيًّا لا يغطّيه إلا نمط — سيُعرض مختلطًا`, mixed.slice(0, 20));
      fs.writeFileSync(mixedFile, mixed.join("\n") + "\n", "utf8");
    } else fs.rmSync(mixedFile, { force: true });
  }
  // ★ (ر5) السمات داخل المتن: بمنطق المحرّك على قاموس الواجهة (حرفي ثم نمط ثم جمع)، ثم قرار الإبقاء، وما لا حرفين لاتينيين فيه؛ وخطر الخلط
  // (مُبقًى لا يعرّبه إلا نمطٌ أو جمع) يُعدّ فيها ولا يُسقط البوابة. والباقي في ‎_completeness-body-attrs.txt‎ (خارج git)
  if (bodyAttrKeys) {
    let hit = 0, kept = 0; const miss = [], mixed = [];
    for (const s of bodyAttrKeys) {
      const how = covers(s);
      if ((how === "pattern" || how === "plural") && keep.has(s)) { mixed.push(s); continue; }
      if (how) { hit++; continue; }
      if (keep.has(s) || !/[A-Za-z]{2}/.test(s)) { kept++; continue; }
      miss.push(s);
    }
    R.text.bodyAttrs = { total: bodyAttrKeys.length, covered: hit, keptEnglish: kept, missing: miss.length, mixed: mixed.length,
      pct: +(100 * (hit + kept) / Math.max(1, bodyAttrKeys.length)).toFixed(2), blocking: false };
    fs.mkdirSync(workDir(d), { recursive: true });
    fs.writeFileSync(path.join(workDir(d), "_completeness-body-attrs.txt"), miss.join("\n") + "\n", "utf8");
    if (miss.length || mixed.length) warn(d, "text", `سماتٌ داخل المتن (فئةٌ مستقلة لا تُسقط البوابة): ${miss.length} بلا ترجمة ولا قرار إبقاء` +
      (mixed.length ? `، و${mixed.length} مُبقاةٌ يعرّبها نمط` : ""), miss.slice(0, 20));
  } else if (domain.meta && domain.meta.bodySel && d !== "app") R.text.bodyAttrs = null;
  // المتون (وضع الكتلة)
  if (domain.meta && domain.meta.bodies) {
    if (!blocksHv) warn(d, "text", "لا حصاد كتل — المتون غير مقيسة");
    else {
      // حصادات الكتل كلها معًا: الكتلة ببصمتها مرّةً (الأحدث يغلب، فحاله أطزج)، وخريطة الصفحات مضمومة
      const hv = { blocks: [], pages: {} };
      const byFp = new Map();
      for (const bf0 of blocksHvs) {
        const h0 = readJson(bf0);
        for (const b of h0.blocks || []) byFp.set(b.fp, b);
        Object.assign(hv.pages, h0.pages || {});
      }
      hv.blocks = [...byFp.values()];
      const bf = blocksDictFile(d);
      const bd = fs.existsSync(bf) ? readJson(bf) : { blocks: {}, kept: [] };
      const B = bd.blocks || {}, K = new Set(bd.kept || []);
      let tr = 0, kp = 0, single = 0; const missFp = [];
      const tplOf = new Map((hv.blocks || []).map((b) => [b.fp, b]));
      for (const b of hv.blocks || []) {
        if (Object.prototype.hasOwnProperty.call(B, b.fp)) { tr++; continue; }
        if (K.has(b.fp)) { kp++; continue; }
        // ما صنّفه الحاصد واجهةً (status=ui: العناوين وبنود الفهرس و«مقالات ذات صلة») أو كتلةً من عقدةٍ واحدة يمرّ بقاموس
        // الواجهة (المحرّك: الواجهة ثم الكتلة) — مغطًّى إن غطّى القاموسُ نصَّه، وإلا فهو باقٍ حقيقي
        const plain = String(b.tpl || "").replace(/<c\d+>[\s\S]*?<\/c\d+>/g, " ").replace(/<\/?[abisgc]\d+\/?>/g, "").replace(/\s+/g, " ").trim();
        if ((b.status === "ui" || b.status === "ui-name" || b.single) && (covers(plain) || keep.has(plain) || !/[A-Za-z]{2}/.test(plain))) { single++; continue; }
        // ★ (٢٠ ربيع الآخر ١٤٤٨هـ) صفُّ لافتات (status=group-ui): المحرّك يعرّب كل بندٍ وحده بقاموس الواجهة (ex.group في
        // blockPass) — فيُقاس بندًا بندًا لا نصًّا مضمومًا (كان يُعدّ باقيًا وهو معرَّبٌ على الصفحة: بطاقات النماذج في /docs/en/intro)
        // (S7-B) وكتلة أسماءٍ في المرجع (ui-name) صفُّ لافتاتٍ كذلك — عنوان المورد الفرعي «الأب › المورد»
        if (b.status === "group-ui" || (b.status === "ui-name" && /<[as]\d+>[\s\S]*<[as]\d+>/.test(String(b.tpl || "")))) {
          const items = String(b.tpl || "").replace(/<c\d+>[\s\S]*?<\/c\d+>/g, "\u0000").split(/<\/?[abisgc]\d+\/?>|\u0000/)
            .map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
          if (items.length && items.every((x) => covers(x) || keep.has(x) || !/[A-Za-z]{2}/.test(x))) { single++; continue; }
        }
        missFp.push(b.fp);
      }
      const pagesIncomplete = [];
      for (const [pk, fps] of Object.entries(hv.pages || {})) {
        const m = fps.filter((fp) => missFp.includes(fp)).length;
        if (m) pagesIncomplete.push([pk, m, fps.length]);
      }
      // ★ (S7-B) الأقسام (‎--section‎): كتل صفحاتها وحدها — مترجمٌ أو عبر الواجهة أو باقٍ
      const missSet = new Set(missFp);
      R.text.sections = {};
      for (const sp of SECTIONS) {
        const pks = Object.keys(hv.pages || {}).filter((pk) => pk.indexOf(sp) === 0 || (pk + "/").indexOf(sp) === 0);
        const fps = new Set([].concat(...pks.map((pk) => hv.pages[pk])));
        const miss = [...fps].filter((fp) => missSet.has(fp)).length;
        R.text.sections[sp] = { pages: pks.length, blocks: fps.size, missing: miss, pagesIncomplete: pagesIncomplete.filter(([pk]) => pks.includes(pk)).length,
          pct: +(100 * (fps.size - miss) / Math.max(1, fps.size)).toFixed(2) };
      }
      R.text.bodies = { harvest: blocksHvs.map((f) => path.basename(f)).join(" + "), blocks: (hv.blocks || []).length, translated: tr, keptSource: kp, viaUi: single,
        missing: missFp.length, pages: Object.keys(hv.pages || {}).length, pagesIncomplete: pagesIncomplete.length,
        pct: +(100 * (tr + kp + single) / Math.max(1, (hv.blocks || []).length)).toFixed(2) };
      if (missFp.length) (STRICT ? fail : warn)(d, "text", `المتون: ${missFp.length} كتلةً بلا ترجمة في ${pagesIncomplete.length} صفحة من ${Object.keys(hv.pages || {}).length}`,
        pagesIncomplete.slice(0, 15).map(([pk, m, n]) => `${pk}: ${m}/${n}`));
      void tplOf;
    }
  }

  // ---------- ٣) السلامة ----------
  const I = R.integrity;
  if (fs.existsSync(dictPath)) {
    const dups = rawDuplicateKeys(dictPath);
    if (dups.length) fail(d, "integrity", `${dups.length} مفتاحًا مكررًا في ${path.basename(dictPath)} (JSON.parse يُسقط الأول صامتًا)`, dups.slice(0, 20));
    const S = dict.strings || {};
    const empty = Object.entries(S).filter(([, v]) => typeof v !== "string" || !v.trim()).map(([k]) => k);
    if (empty.length) fail(d, "integrity", `${empty.length} قيمةً فارغة`, empty.slice(0, 20));
    const varBad = [], tagBad = [];
    for (const [k, v] of Object.entries(S)) {
      if (typeof v !== "string") continue;
      if (varsOf(k) !== varsOf(v)) varBad.push(k);
      if (tagsOf(k) !== tagsOf(v)) tagBad.push(k);
    }
    if (varBad.length) fail(d, "integrity", `${varBad.length} زوجًا تختلف متغيّراته {x} بين الأصل والترجمة`, varBad.slice(0, 20));
    if (tagBad.length) warn(d, "integrity", `${tagBad.length} زوجًا تختلف وسومه`, tagBad.slice(0, 20));
    // الدفعات المترجمة ← القاموس: لا عنصر يضيع في الدمج
    const bdir = batchDir(d);
    let batchItems = 0, present = 0, superseded = 0, viaPattern = 0; const lost = [], guarded = [];
    const dictKeys = Object.keys(S);
    const seenBatch = new Set();
    if (fs.existsSync(bdir)) for (const f of fs.readdirSync(bdir).filter((n) => n.endsWith(".json"))) {
      let arr; try { arr = readJson(path.join(bdir, f)); } catch { fail(d, "integrity", "دفعةٌ تالفة JSON: " + f); continue; }
      if (!Array.isArray(arr)) continue;
      for (const p of arr) {
        if (!p || typeof p.en !== "string" || typeof p.ar !== "string" || !p.ar.trim() || p.ar === p.en) continue;
        batchItems++;
        if (S[p.en] !== undefined) { if (S[p.en] === p.ar) present++; else superseded++; continue; }
        if (covers(p.en)) { viaPattern++; continue; }
        if (S[p.en.trim()] !== undefined) { present++; continue; } // مفتاحٌ محفوفٌ ببياض حُفظ مقصوصًا (المحرّك يقصّ قبل البحث)
        if (seenBatch.has(p.en)) continue;
        if (!/[A-Za-z]/.test(p.en)) continue; // فاصلٌ أو رمزٌ منفرد لا نصَّ فيه

        seenBatch.add(p.en);
        if (/\{[A-Za-z_$][\w$]*\}/.test(p.en)) {
          // المتغيّرات تصير أنماطًا بحرّاس المحرّك: ما يرفضه الحارس لعمومه أو لتعارضه مع مفتاحٍ حرفي متروكٌ بقرارٍ آلي
          const pat = SHARED.makePattern(p.en.trim(), p.ar.trim());
          if (!pat) { guarded.push("حارس: " + p.en); continue; }
          const re = new RegExp(pat.re);
          const clash = dictKeys.find((k) => re.test(k));
          if (clash) { guarded.push("تعارض: " + p.en); continue; }
        }
        lost.push(f + ": " + p.en);
      }
    }
    I.batches = { items: batchItems, present, superseded, viaPatternOrPlural: viaPattern, guarded: guarded.length, lost: lost.length };
    if (guarded.length) {
      warn(d, "integrity", `${guarded.length} نصًّا بمتغيّرات مترجمًا يرفضه حارس الأنماط (عامٌّ جدًّا أو يتعارض مع مفتاحٍ حرفي) — يبقى إنجليزيًّا حتى يُعالَج`, guarded.slice(0, 15));
      fs.writeFileSync(path.join(workDir(d), "_completeness-guarded.txt"), guarded.join("\n") + "\n", "utf8");
    }
    if (lost.length) fail(d, "integrity", `${lost.length} عنصرًا مترجمًا في الدفعات غائبٌ عن القاموس (سقط في الدمج أو حُذف بلا أثر)`, lost.slice(0, 25));
    // القاموس المبنيّ ← المصدر: مفتاحًا مفتاحًا وقيمةً قيمة
    const built = builtDict(domain);
    if (!built) fail(d, "integrity", "لا قاموس مبنيّ في الإضافة: " + domain.dict);
    else {
      const bs = (built.dicts && built.dicts.ar && built.dicts.ar.strings) || {};
      const srcKeys = Object.keys(S), bKeys = Object.keys(bs);
      const notBuilt = srcKeys.filter((k) => bs[k] === undefined);
      const extra = bKeys.filter((k) => S[k] === undefined);
      const differ = srcKeys.filter((k) => bs[k] !== undefined && bs[k] !== S[k]);
      const bp = ((built.dicts.ar || {}).patterns || []).length, sp = (dict.patterns || []).length;
      I.build = { source: srcKeys.length, built: bKeys.length, notBuilt: notBuilt.length, extra: extra.length, differ: differ.length, patterns: [sp, bp] };
      if (notBuilt.length || differ.length || extra.length || sp !== bp)
        fail(d, "integrity", `القاموس المبنيّ لا يطابق مصدره (ناقص ${notBuilt.length}، زائد ${extra.length}، مختلف ${differ.length}، أنماط ${sp}/${bp}) — أعد البناء`,
          notBuilt.concat(differ).slice(0, 20));
    }
  } else if (d !== "app") warn(d, "integrity", "لا قاموس واجهة بعدُ: " + path.basename(dictPath));
  if (domain.meta && domain.meta.bodies) {
    const bf = blocksDictFile(d);
    if (fs.existsSync(bf)) {
      const bd = readJson(bf);
      const B = bd.blocks || {};
      // دفعات الكتل ← القاموس
      const bbd = blockBatchDir(d);
      let items = 0, lost = [];
      if (fs.existsSync(bbd)) for (const f of fs.readdirSync(bbd).filter((n) => n.endsWith(".json"))) {
        let arr; try { arr = readJson(path.join(bbd, f)); } catch { fail(d, "integrity", "دفعة كتلٍ تالفة: " + f); continue; }
        for (const p of Array.isArray(arr) ? arr : []) {
          if (!p || !p.fp || typeof p.ar !== "string" || p.ar === p.src) continue;
          items++;
          if (!Object.prototype.hasOwnProperty.call(B, p.fp)) lost.push(f + ": " + p.fp);
        }
      }
      I.blockBatches = { items, lost: lost.length };
      if (lost.length) fail(d, "integrity", `${lost.length} كتلةً مترجمة في الدفعات غائبةٌ عن قاموس الكتل (رفضها الدمج أو سقطت)`, lost.slice(0, 25));
      // قاموس الكتل ← القطع المبنية
      const dir = path.join(EXT, "bodies", d, "ar");
      const idxF = path.join(dir, "index.json");
      if (!fs.existsSync(idxF)) fail(d, "integrity", "لا فهرس قطع متون مبنيّ: bodies/" + d + "/ar/index.json");
      else {
        let missingInShards = 0, pagesChecked = 0;
        for (const [pk, fps] of Object.entries(bd.pages || {})) {
          const sf = path.join(dir, SHARED.shardOf(SHARED.pageKey(domain.meta, pk)) + ".json"); // بالمفتاح القانوني كالبناء
          pagesChecked++;
          if (!fs.existsSync(sf)) { missingInShards += fps.length; continue; }
          const part = readJson(sf).blocks || {};
          for (const fp of fps) if (part[fp] !== B[fp]) missingInShards++;
        }
        I.shards = { pages: pagesChecked, missingOrStale: missingInShards };
        if (missingInShards) fail(d, "integrity", `${missingInShards} كتلةً مدموجة غائبة أو قديمة في القطع المبنية — أعد البناء`);
      }
    }
  }
}

// ---------- lint-dict: عقود القاموس الآلية (مفاتيح لا يطابقها المحرّك، قواعد فاسدة…) ----------
for (const d of domainsOf(SEL)) {
  if (!fs.existsSync(dictFile(d))) continue;
  const r = spawnSync(process.execPath, [path.join(HERE, "lint-dict.mjs"), "--domain=" + d], { encoding: "utf8" });
  report.domains[d].integrity.lint = r.status === 0 ? "ok" : "fail";
  if (r.status !== 0) fail(d, "integrity", "lint-dict أخفق", (r.stdout + r.stderr).split("\n").filter((l) => /✗|!|فشل|خطأ/.test(l)).slice(0, 10));
}

// ---------- التقرير ----------
const L = { scope: "النطاق", text: "النصوص", integrity: "السلامة" };
for (const [d, R] of Object.entries(report.domains)) {
  console.log(`\n■ ${label(d)}`);
  if (R.scope.index !== undefined) console.log(`  النطاق: فهرس ${R.scope.index} عنوانًا ← مقصود ${R.scope.intended}${R.scope.shell ? ` · هيكل ${R.scope.shell} (محصودٌ منها ${R.scope.shellHarvested})` : ""} · خامل ${R.scope.idle} · محصود ${R.scope.harvested} · مقصودٌ لم يُحصد ${R.scope.notHarvested}${R.scope.exempted ? ` · معفًى بقرار ${R.scope.exempted}` : ""}${(R.scope.failed || []).length ? ` · أخفق حصاده ${R.scope.failed.length}` : ""}`);
  for (const inv of R.text.inventories || []) console.log(`  النصوص: ${inv.name}: ${inv.total} ← مغطّى ${inv.covered} (حرفي ${inv.by.literal} · نمط ${inv.by.pattern} · جمع ${inv.by.plural}) + مُستبقًى ${inv.keptEnglish} = ${inv.pct}% · باقٍ ${inv.missing}${inv.mixed ? ` · خطر خلط ${inv.mixed}` : ""}${inv.icu ? ` · ICU مركّبة ${inv.icu}` : ""}`);
  if (R.text.bodies) { const b = R.text.bodies; console.log(`  المتون: ${b.blocks} كتلة في ${b.pages} صفحة ← مترجم ${b.translated} · مُستبقًى ${b.keptSource} · عبر الواجهة ${b.viaUi} = ${b.pct}% · باقٍ ${b.missing} (صفحاتٌ ناقصة ${b.pagesIncomplete})`); }
  if (R.text.bodyAttrs) { const a = R.text.bodyAttrs; console.log(`  سمات المتن (فئةٌ مستقلة، لا تُسقط البوابة): ${a.total} ← مغطّى ${a.covered} + مُستبقًى ${a.keptEnglish} = ${a.pct}% · باقٍ ${a.missing}${a.mixed ? ` · خطر خلط ${a.mixed}` : ""}`); }
  else if (R.text.bodyAttrs === null) console.log("  سمات المتن (فئةٌ مستقلة): لا حصاد DOM — غير مقيسة");
  for (const [sp, x] of Object.entries(R.scope.sections || {})) console.log(`  القسم ${sp}: مقصود ${x.intended} · محصود ${x.harvested} · لم يُحصد ${x.notHarvested}${x.exempted ? ` · معفًى ${x.exempted}` : ""}`);
  for (const [sp, x] of Object.entries(R.text.sections || {})) console.log(`  القسم ${sp} (المتون): ${x.blocks} كتلة في ${x.pages} صفحة ← باقٍ ${x.missing} = ${x.pct}% (صفحاتٌ ناقصة ${x.pagesIncomplete})`);
  const I = R.integrity;
  if (I.batches) console.log(`  السلامة: دفعات ${I.batches.items} ← حاضر ${I.batches.present} · خلفه أحدث ${I.batches.superseded} · عبر نمط/جمع ${I.batches.viaPatternOrPlural} · يرفضه حارس الأنماط ${I.batches.guarded} · ضائع ${I.batches.lost}`);
  if (I.build) console.log(`  البناء: مصدر ${I.build.source} ↔ مبنيّ ${I.build.built} · ناقص ${I.build.notBuilt} · زائد ${I.build.extra} · مختلف ${I.build.differ} · أنماط ${I.build.patterns.join("/")}`);
  if (I.blockBatches) console.log(`  الكتل: دفعات ${I.blockBatches.items} · ضائع ${I.blockBatches.lost}${I.shards ? ` · القطع: ${I.shards.pages} صفحة، ناقص/قديم ${I.shards.missingOrStale}` : ""}`);
  if (I.lint) console.log(`  lint-dict: ${I.lint}`);
}
if (report.warnings.length) { console.log(`\nتنبيهات (${report.warnings.length}):`); for (const w of report.warnings) console.log(`  ⚠ [${w.d}/${L[w.layer]}] ${w.msg}`); }
if (report.failures.length) { console.log(`\nإخفاقات (${report.failures.length}):`); for (const f of report.failures) console.log(`  ✗ [${f.d}/${L[f.layer]}] ${f.msg}`); }
const out = opt("json", "");
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 1));
console.log(report.failures.length ? `\n✗ بوابة الشمول: ${report.failures.length} إخفاقًا` : "\n✓ بوابة الشمول: لا إخفاق");
if (STRICT && report.failures.length) process.exit(1);
