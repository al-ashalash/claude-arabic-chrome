// check-sources.mjs — ★ (ر8-ب، ٣٠ ربيع الآخر ١٤٤٨هـ) قائمتا «المعاجم والمصادر» في صفحة «حول» (extension/options.html) وفي README
// تطابقان ملف المصادر في مستودع التطوير (project/decisions/SOURCES-lexicons.md) بندًا بندًا: القسم (سعودي أو مساند) والترتيب والاسم
// والجهة ووسم «سوار»، والأعدادُ بين قوسين في العناوين، وأعدادُ جملتَي README العربية والإنجليزية حيث وُجدتا.
//
// لماذا: القوائم تُنسخ من الملف باليد (القرار 48)، وفحص _optionstest يرى أن أعداد «حول» تطابق بنودها لا أنها بنود الملف — فاسمٌ أو جهةٌ
// أو ترتيبٌ ينحرف والأعداد متسقة كان يمرّ (مراجعة ر8-أ، F14). والملف وREADME خارج جذر خادم الاختبارات (web/) فلا تبلغهما صفحة
// اختبار؛ فالفحص هنا، ويشغّله verify-package. وحيث لا ملف مصادر (المستودع العام) يُصرَّح بالتخطّي ولا يُخفق شيء.
//   node web/code/toolchain/check-sources.mjs     ← رمز الخروج 1 عند أي اختلاف
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, EXT } from "./paths.mjs";

const REPO = path.resolve(ROOT, "..");
const SOURCES_MD = path.join(REPO, "project", "decisions", "SOURCES-lexicons.md");
const README = path.join(REPO, "README.md");
const OPTIONS = path.join(EXT, "options.html");
const SIWAR = "سوار";
const SEC = { sa: "السعودية", ot: "المساندة" };
const CAP = 6; // أول ستة اختلافاتٍ لكل قائمة: بندٌ ناقص في أولها يُزيح ما بعده كلّه

// ★ (ر8-ب، المراجعة المستقلة) تغييرُ الصياغة وحده لا يُخفق الفحص، والاختلافُ في البنود يُخفقه: جُرِّبت ست عشرة صياغةً بالبنود نفسها
// فأخفقت عشرٌ منها (بندٌ ملفوف على سطرين في README كسائر فقراته، ومنه «(سوار)» في سطر التتمّة، وبياضٌ مكرَّر في خلية الملف وحده —
// القوائم مطبَّعة وهو لا، ورأسُ جدولٍ أُعيدت صياغته، وسمةٌ زائدة على ‎.n‎، وصنفان على وسم «سوار»، وسمة id بعلامتَي اقتباسٍ مفردتين،
// وكيانٌ عددي للشرطة، وبنودٌ بـ«*»، و<summary> على أسطر)؛ فصارت كلها تمرّ، والاختلافات المتعمَّدة الثلاثة عشر ما زالت تُخفقه
const norm = (s) => s.replace(/\s+/g, " ").trim();
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) => s.replace(/&(?:(amp|lt|gt|quot|apos|nbsp)|#(\d+)|#x([0-9a-f]+));/gi, (m0, k, d, h) => {
  if (k) return ENT[k.toLowerCase()];
  const cp = d ? +d : parseInt(h, 16);
  return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m0;
});
// قيمة سمة class فيها الصنف المطلوب بين أصنافٍ أخرى أو وحده، بأي علامتَي اقتباس
const hasClass = (c) => `\\bclass=["'](?:[^"']*\\s)?${c}(?:\\s[^"']*)?["']`;

// الملف: جدولان تحت «## المصادر السعودية» و«## المصادر المساندة…»، وكل صفٍّ «| الاسم | الجهة | المنصة (سوار أو —) | الأعداد… |»
function parseSourcesMd(text) {
  const items = [], errors = [];
  let sec = null;
  // الخلايا مطبَّعة البياض كقائمتَي «حول» وREADME؛ والرأسُ الصفُّ الذي يليه الفاصل أيًّا كان نصّه
  const cells = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(norm);
  const isSep = (l) => /^\s*\|/.test(l || "") && cells(l).every((x) => /^:?-+:?$/.test(x));
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) sec = /^##\s+المصادر السعودية/.test(line) ? "sa" : /^##\s+المصادر المساندة/.test(line) ? "ot" : null;
    if (!sec || !/^\s*\|/.test(line) || isSep(line) || isSep(lines[i + 1])) continue; // الفاصل، ورأس الجدول فوقه
    const c = cells(line);
    if (c.length < 3 || !c[0] || !c[1]) { errors.push("ملف المصادر: صفٌّ مختلّ: " + line.slice(0, 80)); continue; }
    if (c[2] !== SIWAR && c[2] !== "—") errors.push(`ملف المصادر: منصةٌ غير معروفة «${c[2]}» في «${c[0]}»`);
    items.push({ sec, text: c[0] + " — " + c[1], siwar: c[2] === SIWAR });
  }
  if (!items.some((x) => x.sec === "sa") || !items.some((x) => x.sec === "ot")) errors.push("ملف المصادر: لا جدول للمصادر السعودية أو للمساندة");
  return { items, errors };
}

// «حول»: ‎#lexSaudi‎ و‎#lexOther‎، وكل بندٍ «الاسم — الجهة» ثم ‎<span class="tag">سوار</span>‎ للموسوم؛ والأعداد ‎.n‎ في ‎#lexSources‎
// بترتيبها: المجموع ثم السعودية ثم المساندة
function parseAbout(html) {
  const items = [], errors = [];
  for (const [id, sec] of [["lexSaudi", "sa"], ["lexOther", "ot"]]) {
    const m = new RegExp(`<ul\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)</ul>`).exec(html);
    if (!m) { errors.push(`«حول»: لا قائمة ‎#${id}‎`); continue; }
    for (const li of m[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)) {
      const tag = new RegExp(`<span\\b[^>]*${hasClass("tag")}[^>]*>\\s*سوار\\s*</span>`);
      items.push({ sec, siwar: tag.test(li[1]), text: norm(decode(li[1].replace(tag, "").replace(/<[^>]+>/g, ""))) });
    }
  }
  const d = /<details\b[^>]*\bid=["']lexSources["'][^>]*>([\s\S]*?)<\/details>/.exec(html);
  if (!d) errors.push("«حول»: لا قائمة مطويّة ‎#lexSources‎");
  const nRe = new RegExp(`<span\\b[^>]*${hasClass("n")}[^>]*>\\s*(\\d+)\\s*</span>`, "g");
  return { items, errors, counts: d ? [...d[1].matchAll(nRe)].map((x) => +x[1]) : [] };
}

// README: القائمة المطويّة «المعاجم والمصادر التي أُسندت إليها المصطلحات (N)»، وعنوانا قسميها «**المصادر السعودية (N)**»
// و«**المصادر المساندة، غير السعودية (N)**»، وكل بندٍ «- الاسم — الجهة» ثم « (سوار)» للموسوم. والبند الملفوف على أسطر (سطرُ تتمّةٍ
// بلا علامة بند ولا سطرٍ فارغٍ قبله، كما يلفّ README فقراته) بندٌ واحد كما يعرضه Markdown
function parseReadme(md) {
  const items = [], errors = [];
  const m = /<summary\b[^>]*>\s*(?:<(?:b|strong)>\s*)?المعاجم والمصادر التي أُسندت إليها المصطلحات\s*\((\d+)\)\s*(?:<\/(?:b|strong)>\s*)?<\/summary>([\s\S]*?)<\/details>/.exec(md);
  if (!m) return { items, counts: [], errors: ["README: لا قائمة «المعاجم والمصادر التي أُسندت إليها المصطلحات» المطويّة"] };
  const counts = [+m[1]];
  let sec = null, cur = null;
  const flush = () => {
    if (!cur) return;
    const t = norm(cur.raw);
    items.push({ sec: cur.sec, siwar: /\s\(سوار\)$/.test(t), text: t.replace(/\s*\(سوار\)$/, "") });
    cur = null;
  };
  for (const raw of m[2].split(/\r?\n/)) {
    const line = raw.trim();
    const h = /^\*\*المصادر (السعودية|المساندة[^*(]*?)\s*\((\d+)\)\*\*$/.exec(line);
    if (h) { flush(); sec = h[1] === "السعودية" ? "sa" : "ot"; counts.push(+h[2]); continue; }
    const b = /^[-*+]\s+(.*)$/.exec(line);
    if (b) {
      flush();
      if (!sec) { errors.push("README: بندٌ قبل عنوان قسمه: " + line.slice(0, 60)); continue; }
      cur = { sec, raw: b[1] };
      continue;
    }
    if (!line) flush();
    else if (cur) cur.raw += " " + line; // سطر تتمّة
  }
  flush();
  return { items, counts, errors };
}

function compare(label, want, got) {
  const errors = [];
  for (let i = 0; i < Math.max(want.length, got.length); i++) {
    const w = want[i], g = got[i];
    if (!g) errors.push(`${label}: البند ${i + 1} ناقص («${w.text}»)`);
    else if (!w) errors.push(`${label}: البند ${i + 1} زائد («${g.text}»)`);
    else {
      if (g.text !== w.text) errors.push(`${label}: البند ${i + 1} «${g.text}» وفي الملف «${w.text}»`);
      if (g.sec !== w.sec) errors.push(`${label}: البند ${i + 1} («${w.text}») في قسم المصادر ${SEC[g.sec]} وفي الملف ${SEC[w.sec]}`);
      if (g.siwar !== w.siwar) errors.push(`${label}: البند ${i + 1} («${w.text}») وسم «سوار» ${g.siwar ? "زائد" : "ناقص"}`);
    }
  }
  return errors.length > CAP ? errors.slice(0, CAP).concat([`${label}: و${errors.length - CAP} اختلافًا غيرها`]) : errors;
}

export function checkSources() {
  if (!fs.existsSync(SOURCES_MD)) return { skipped: "لا ملف مصادر هنا (project/decisions/SOURCES-lexicons.md في مستودع التطوير) — تخطٍّ", errors: [], notes: [] };
  const errors = [], notes = [];
  const src = parseSourcesMd(fs.readFileSync(SOURCES_MD, "utf8"));
  errors.push(...src.errors);
  const nSa = src.items.filter((x) => x.sec === "sa").length, nOt = src.items.length - nSa;
  const want = [src.items.length, nSa, nOt].join("/");

  const about = parseAbout(fs.readFileSync(OPTIONS, "utf8"));
  errors.push(...about.errors, ...compare("«حول»", src.items, about.items));
  if (about.counts.join("/") !== want) errors.push(`«حول»: الأعداد بين قوسين ${about.counts.join("/") || "—"} وفي الملف ${want} (المجموع/السعودية/المساندة)`);

  if (!fs.existsSync(README)) errors.push("README.md غائبٌ عن جذر المستودع");
  else {
    const md = fs.readFileSync(README, "utf8");
    const rd = parseReadme(md);
    errors.push(...rd.errors, ...compare("README", src.items, rd.items));
    if (rd.counts.join("/") !== want) errors.push(`README: الأعداد بين قوسين ${rd.counts.join("/") || "—"} وفي الملف ${want} (المجموع/السعودية/المساندة)`);
    // وجملتا العدد في الإفصاح (العربية ثم الإنجليزية): تُفحصان حيث وُجدتا، ويُنبَّه إن أعيدت صياغتهما فلم توجدا
    const flat = norm(md);
    for (const [name, re] of [
      ["الجملة العربية", /(\d+) معجمًا ومصدرًا: (\d+) سعوديًّا.*?و(\d+) مساندة غير سعودية/],
      ["الجملة الإنجليزية", /(\d+) lexicons and sources: (\d+) Saudi ones.*?and (\d+) non-Saudi ones/],
    ]) {
      const x = re.exec(flat);
      if (!x) notes.push(`README: لم توجد ${name} لعدد المصادر — لم تُفحص`);
      else if ([x[1], x[2], x[3]].join("/") !== want) errors.push(`README: ${name} تقول ${x[1]}/${x[2]}/${x[3]} وفي الملف ${want}`);
    }
  }
  return { skipped: null, errors, notes, summary: `«حول» وREADME تطابقان ملف المصادر: ${src.items.length} = ${nSa} + ${nOt}` };
}

// تشغيلٌ مستقل
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = checkSources();
  if (r.skipped) { console.log("ℹ " + r.skipped); process.exit(0); }
  for (const n of r.notes) console.log("ℹ " + n);
  if (r.errors.length) {
    console.error("✗ قوائم المصادر لا تطابق ملف المصادر:");
    for (const e of r.errors) console.error("  - " + e);
    process.exit(1);
  }
  console.log("✓ " + r.summary);
}
