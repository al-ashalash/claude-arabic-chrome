// drift-map.mjs — ★ (DX0-0، ١٩ جمادى الأولى ١٤٤٨هـ) خريطة الانجراف: كل كتلةٍ محصودة بلا عربيةٍ تطابقها ← أقرب كتلةٍ قديمة لها عربية.
//
// لماذا: نقّح الموقع نصوص صفحاته بعد ترجمتها (ر29-أ §2)، فصارت كتلٌ كثيرة تختلف عن نظيرتها المترجمة بكلماتٍ قليلة أو بوسمٍ وحده، وبصمتها
// جديدة فلا يطابقها القاموس ويحجز حارسُ المتن صفحتها. فبدل إعادة الترجمة يُكيَّف العربي القديم: لكل كتلةٍ غير مغطّاة أقربُ كتلةٍ قديمة
// (من الصفحة نفسها أولًا، ثم من الموقع كله) بالتشابه في النص الإنجليزي، مع بصمتها وعربيتها وقدر الفرق، وصنفٌ من ثلاثة:
//   same    النص المرئي نفسه حرفًا بحرف والوسوم وحدها تغيّرت (غلافٌ، أو امتداد رابط، أو شيفرةٌ جديدة): يُنقل العربي ويُعدَّل موضع العناصر النائبة
//   edited  تشابهٌ لا يقل عن ‎--min-sim‎ (افتراضه 0.5) وكلمتان مشتركتان على الأقل: يُكيَّف العربي، ومعه الكلمات المضافة والمحذوفة. والفرق
//           والتشابه بعد تطبيع الطباعة (الفاصلة العليا وعلامتا التنصيص المنحنية إلى المستقيمة، والنقاط الثلاث، والمسافة غير الفاصلة): نقّح الموقع
//           «Claude's» إلى «Claude’s» في كل صفحة، وهو لا يغيّر العربي؛ فما لم يختلف إلا بها typo: true (يُنقل العربي ويُراجَع ولا يُترجم)
//   new     ما سواه: يُترجم من أوله
//
//   node web/code/toolchain/drift-map.mjs --domain=docs --harvest=<blocks-*.json>[,…] [--old=<ملفٌ أو مجلد>[,…]] [--batches=<مجلد>[,…]]
//        [--dict=<ar-*.blocks.json>] [--out=map.json] [--min-sim=0.5]
//        [--parts=<مجلد> --part-name=dx0 --part-words=4800 --part-blocks=260 --order=<بادئة>|<بادئة>…]
//   ‎--parts‎: أجزاء الترجمة من الخريطة نفسها: صفحات البادئات بترتيبها أولًا (صفحة البادئة نفسها ثم ما تحتها)، ثم الباقي بترتيب الحصاد؛ وكتل
//        الصفحة الواحدة متجاورة بترتيبها، ولا تُقسم إلا صفحةٌ تزيد وحدها على الحجم، والبصمة في جزءٍ واحد (أول صفحةٍ تظهر فيها بهذا الترتيب).
//        الجزء ‎[{fp, src, class, base?, diff?}]‎ (صيغة p4 ومعها الأساس العربي للمعدَّل)، ومعه ‎<الاسم>-manifest.json‎ (صفحات كل جزءٍ وأعداده).
//        والمجلد لا يُكتب فوق أجزاءٍ قائمة باسمه (قد تكون بيد المترجمين)
//
// المصادر القديمة (الافتراض من مجلد عمل النطاق): الإنجليزية من حصادات الكتل السابقة (_harvest/**/blocks-*.json، عدا الحصاد الجديد) ومن دفعات
// المتون (_blk_batches/*.json: ‎[{fp, src, ar}]‎)، والعربية من قاموس الكتل المشحون أولًا ثم من الدفعات (مترجمٌ لم يُدمج). وصفحة الكتلة القديمة من
// خرائط الصفحات في تلك الحصادات. والكلمات بعدّ الحاصد نفسه (harvest-dom: الذرّات البرمجية <cN>…</cN> لا تُعدّ).
// لا شبكة ولا متصفح. والخرج JSON: رأسٌ بالأعداد، ثم سطرٌ لكل كتلة.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---- دوالّ خالصة (يختبرها selftest-tools) ----
// الكلمات كما يعدّها الحاصد (harvest-dom wordsOf): بلا الذرّات البرمجية وبلا العناصر النائبة
export function wordsOf(s) {
  return (String(s).replace(/<c(\d+)>[\s\S]*?<\/c\1>/g, " ").replace(/<[^>]+>/g, " ").match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
}
// النص المرئي: القالب بلا عناصره النائبة (ومحتوى الذرّة البرمجية نصٌّ مرئي يبقى)، بمسافاتٍ مطبَّعة
export function plainOf(tpl) {
  return String(tpl).replace(/<\/?[abisgc]\d{1,4}\/?>/g, " ").replace(/\s+/g, " ").trim();
}
export function tokensOf(tpl) { const p = plainOf(tpl); return p ? p.split(" ") : []; }
// تطبيع الطباعة للمقارنة وحدها (لا للبصمة): ‘ ’ ʼ ← '، و“ ” ← "، و… ← ...، والمسافتان غير الفاصلتين ← مسافة
export function typoOf(s) {
  return String(s).replace(/[\u2018\u2019\u02BC]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u2026/g, "...").replace(/[\u00A0\u202F]/g, " ");
}
const typoToks = (tpl) => { const p = typoOf(plainOf(tpl)).replace(/\s+/g, " ").trim(); return p ? p.split(" ") : []; };
// مفتاح الفهرس: الكلمة بحروفٍ صغيرة بلا ترقيمٍ على طرفيها
const normTok = (t) => t.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
// هيكل القالب: العناصر النائبة بلا أرقامها (لوصف ما تغيّر من الوسوم)
export function skeletonOf(tpl) { return (String(tpl).match(/<\/?[abisgc]\d{1,4}\/?>/g) || []).map((t) => t.replace(/\d+/, "")).join(""); }

// أطول تتابعٍ مشترك بين قائمتي كلمات ← {lcs, added (في الجديد وحده), removed (في القديم وحده)}. وفوق 4 ملايين خانة يُكتفى بالفرق بالعدد
export function wordDiff(oldT, newT) {
  const n = oldT.length, m = newT.length;
  if (!n || !m) return { lcs: 0, added: newT.slice(), removed: oldT.slice() };
  if (n * m > 4e6) {
    const cnt = new Map();
    for (const t of oldT) cnt.set(t, (cnt.get(t) || 0) + 1);
    const added = [];
    for (const t of newT) { const c = cnt.get(t) || 0; if (c > 0) cnt.set(t, c - 1); else added.push(t); }
    const removed = [];
    for (const [t, c] of cnt) for (let i = 0; i < c; i++) removed.push(t);
    return { lcs: m - added.length, added, removed };
  }
  const W = m + 1, L = new Uint32Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i * W + j] = oldT[i] === newT[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
  const added = [], removed = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (oldT[i] === newT[j]) { i++; j++; }
    else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) removed.push(oldT[i++]);
    else added.push(newT[j++]);
  }
  while (i < n) removed.push(oldT[i++]);
  while (j < m) added.push(newT[j++]);
  return { lcs: L[0], added, removed };
}
// التشابه: ضعف المشترك على مجموع الطولين (0…1)
export function simOf(d, n, m) { return n + m ? (2 * d.lcs) / (n + m) : 1; }

// الصنف بحكم أقرب كتلة: same بالنص المرئي نفسه، وedited بالتشابه وكلمتين مشتركتين، وإلا new
export function classify(newTpl, best, minSim = 0.5) {
  if (!best) return "new";
  if (plainOf(newTpl) === plainOf(best.src)) return "same";
  if (typoOf(plainOf(newTpl)) === typoOf(plainOf(best.src))) return "edited";
  return best.sim >= minSim && best.lcs >= 2 ? "edited" : "new";
}

// فهرس الكتل القديمة ذات العربية: [{fp, src, ar, from, pages:Set}] ← فهرسٌ مقلوب بالكلمة، وكتل كل صفحة
export function buildIndex(olds) {
  const byTok = new Map(), byPage = new Map(), toks = [];
  olds.forEach((o, id) => {
    const t = typoToks(o.src); toks.push(t);
    for (const k of new Set(t.map(normTok).filter(Boolean))) { let a = byTok.get(k); if (!a) byTok.set(k, a = []); a.push(id); }
    for (const p of o.pages || []) { let a = byPage.get(p); if (!a) byPage.set(p, a = []); a.push(id); }
  });
  return { olds, toks, byTok, byPage };
}
// أقرب كتلةٍ قديمة: مرشّحو الصفحة نفسها كلهم، ومن الموقع من يشاركها أندرَ كلماتها؛ يُرتَّبون بتداخل الكلمات ثم يُحسب الفرق لأعلاهم.
// والصفحة نفسها أولًا: تُقدَّم كتلتها ما لم تزد عليها كتلةٌ من غيرها بأكثر من 0.05 في التشابه
export function closest(ix, tpl, pages, { top = 8, rare = 12 } = {}) {
  const t = typoToks(tpl), nk = t.map(normTok).filter(Boolean);
  const same = new Set();
  for (const p of pages || []) for (const id of ix.byPage.get(p) || []) same.add(id);
  const score = new Map();
  for (const id of same) score.set(id, 0);
  const uniq = [...new Set(nk)].filter((k) => ix.byTok.has(k)).sort((a, b) => ix.byTok.get(a).length - ix.byTok.get(b).length).slice(0, rare);
  for (const k of uniq) for (const id of ix.byTok.get(k)) score.set(id, (score.get(id) || 0) + 1);
  if (!score.size) return null;
  // تداخل الكلمات (متعدّد المجموعات) لترتيبٍ أولي رخيص
  const bag = new Map(); for (const k of nk) bag.set(k, (bag.get(k) || 0) + 1);
  const dice = (id) => {
    const c = new Map(bag); let inter = 0; const o = ix.toks[id];
    for (const w of o) { const k = normTok(w); const v = c.get(k) || 0; if (v > 0) { inter++; c.set(k, v - 1); } }
    return (2 * inter) / ((nk.length + o.length) || 1);
  };
  const ranked = (ids) => ids.map((id) => [id, dice(id)]).sort((a, b) => b[1] - a[1]).slice(0, top);
  const exact = (id) => {
    const d = wordDiff(ix.toks[id], t);
    return { id, d, sim: simOf(d, ix.toks[id].length, t.length) };
  };
  const pick = (ids) => { let b = null; for (const [id] of ranked(ids)) { const e = exact(id); if (!b || e.sim > b.sim) b = e; } return b; };
  const bs = same.size ? pick([...same]) : null;
  const others = [...score.keys()].filter((id) => !same.has(id)).sort((a, b) => score.get(b) - score.get(a)).slice(0, 60);
  const bo = others.length ? pick(others) : null;
  const b = bs && (!bo || bs.sim + 0.05 >= bo.sim) ? Object.assign(bs, { samePage: true }) : bo ? Object.assign(bo, { samePage: false }) : bs;
  if (!b) return null;
  const o = ix.olds[b.id];
  return { fp: o.fp, src: o.src, ar: o.ar, from: o.from, page: [...(o.pages || [])][0] || null, samePage: !!b.samePage,
    sim: Math.round(b.sim * 1000) / 1000, lcs: b.d.lcs, added: b.d.added, removed: b.d.removed };
}

// خريطة الحصاد الجديد: blocksNew [{fp, tpl, status, pages}] ← رأسٌ وأسطر
export function mapDrift(blocksNew, olds, { minSim = 0.5, seen = null } = {}) {
  const ix = buildIndex(olds);
  const byFp = new Map(olds.map((o) => [o.fp, o]));
  const rows = [], counts = { same: 0, edited: 0, new: 0 }, words = { same: 0, edited: 0, new: 0 }, tally = {}, typo = { blocks: 0, words: 0 };
  for (const b of blocksNew) {
    tally[b.status] = (tally[b.status] || 0) + 1;
    if (b.status !== "todo") continue;
    let best;
    // بصمةٌ مترجمةٌ في دفعةٍ لم تُدمج: هي نفسها
    const own = byFp.get(b.fp);
    if (own) best = { fp: own.fp, src: own.src, ar: own.ar, from: own.from, page: [...(own.pages || [])][0] || null, samePage: true, sim: 1, lcs: tokensOf(b.tpl).length, added: [], removed: [] };
    else best = closest(ix, b.tpl, b.pages);
    const cls = classify(b.tpl, best, minSim);
    const w = wordsOf(b.tpl);
    counts[cls]++; words[cls] += w;
    if (cls === "edited" && typoOf(plainOf(b.tpl)) === typoOf(plainOf(best.src))) { typo.blocks++; typo.words += w; }
    const row = { fp: b.fp, src: b.tpl, page: (b.pages || [])[0] || null, count: b.count || 1, words: w, class: cls };
    // حُصدت البصمة نفسها قبلُ ولم تُترجم (ثغرةٌ معروفة، لا تنقيحٌ جديد)
    if (seen && seen.has(b.fp) && !own) row.seen = true;
    if (cls !== "new") {
      row.sim = best.sim;
      if (cls === "edited" && typoOf(plainOf(b.tpl)) === typoOf(plainOf(best.src))) row.typo = true;
      row.base = { fp: best.fp, src: best.src, ar: best.ar, from: best.from, page: best.page, samePage: best.samePage };
      row.diff = { added: best.added, removed: best.removed, size: best.added.length + best.removed.length };
      if (cls === "same") row.markup = { old: skeletonOf(best.src), new: skeletonOf(b.tpl) };
    } else if (best) row.near = { fp: best.fp, sim: best.sim };
    rows.push(row);
  }
  return { counts, words, tally, typo, rows };
}

// أجزاء الترجمة: rows (أسطر الخريطة) وpages ({مفتاح الصفحة: [fp…]} بترتيب الحصاد) ← [{id, pages, items}]. order: بادئاتٌ تتقدّم صفحاتُها
// (المطابقة: الصفحة نفسها أو ما تحتها)، ثم الباقي بترتيبه. والجزء يُغلق ببلوغ maxWords كلمةً أو maxBlocks كتلة؛ وصفحةٌ لا تتسع لما بقي من الجزء
// تبدأ جزءًا جديدًا إلا أن تكون أكبر من جزءٍ كامل فتُقسم
export function partition(rows, pages, { order = [], maxWords = 4800, maxBlocks = 260, name = "dx0" } = {}) {
  const byFp = new Map(rows.map((r) => [r.fp, r]));
  const keys = Object.keys(pages);
  const rank = (pk) => { for (let i = 0; i < order.length; i++) if (pk === order[i] || pk.indexOf(order[i].replace(/\/$/, "") + "/") === 0) return i; return order.length; };
  const sorted = keys.map((pk, i) => [pk, rank(pk), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map((x) => x[0]);
  const taken = new Set(), parts = [];
  let cur = null;
  const open = () => { cur = { id: `${name}-${String(parts.length).padStart(3, "0")}`, pages: [], items: [], words: 0 }; parts.push(cur); };
  for (const pk of sorted) {
    const its = [];
    for (const fp of pages[pk]) { const r = byFp.get(fp); if (r && !taken.has(fp)) { taken.add(fp); its.push(r); } }
    if (!its.length) continue;
    const w = its.reduce((a, r) => a + r.words, 0);
    if (!cur || (cur.items.length && (cur.words + w > maxWords || cur.items.length + its.length > maxBlocks) && w <= maxWords && its.length <= maxBlocks)) open();
    for (const r of its) {
      if (cur.items.length && (cur.words + r.words > maxWords || cur.items.length >= maxBlocks)) open();
      if (!cur.pages.includes(pk)) cur.pages.push(pk);
      const it = { fp: r.fp, src: r.src, class: r.class };
      if (r.base) { it.base = { fp: r.base.fp, src: r.base.src, ar: r.base.ar, sim: r.sim }; it.diff = r.diff; }
      cur.items.push(it); cur.words += r.words;
    }
  }
  // ما لا صفحة له في الخريطة (لا يكون من حصادٍ واحد) في جزءٍ أخير
  const rest = rows.filter((r) => !taken.has(r.fp));
  if (rest.length) { open(); for (const r of rest) { cur.items.push({ fp: r.fp, src: r.src, class: r.class, ...(r.base ? { base: { fp: r.base.fp, src: r.base.src, ar: r.base.ar, sim: r.sim }, diff: r.diff } : {}) }); cur.words += r.words; } }
  return parts;
}

// ---- الأداة ----
function listJson(p, re) {
  if (!fs.existsSync(p)) return [];
  if (fs.statSync(p).isFile()) return [p];
  const out = [];
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const f = path.join(p, e.name);
    if (e.isDirectory()) out.push(...listJson(f, re));
    else if (re.test(e.name)) out.push(f);
  }
  return out.sort();
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (name, def) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : def; };
  const { domainArg, workDir, blocksDictFile } = await import("./domain-arg.mjs");
  const D = domainArg(process.argv);
  const harvests = opt("harvest", "").split(",").filter(Boolean);
  if (!harvests.length) { console.error("! ‎--harvest=<blocks-*.json>‎ مطلوب"); process.exit(2); }
  const newSet = new Set(harvests.map((f) => path.resolve(f)));
  const oldFiles = opt("old", path.join(workDir(D), "_harvest")).split(",").filter(Boolean)
    .flatMap((p) => listJson(p, /^blocks-.*\.json$/)).filter((f) => !newSet.has(path.resolve(f)));
  const batchFiles = opt("batches", path.join(workDir(D), "_blk_batches")).split(",").filter(Boolean).flatMap((p) => listJson(p, /\.json$/))
    .filter((f) => !/[\\/]_draft[\\/]/.test(f));
  const dictFile = opt("dict", blocksDictFile(D));
  const minSim = +opt("min-sim", "0.5");
  if (!(minSim > 0 && minSim <= 1)) { console.error("! ‎--min-sim‎ بين 0 و1"); process.exit(2); }
  const dict = fs.existsSync(dictFile) ? (JSON.parse(fs.readFileSync(dictFile, "utf8")).blocks || {}) : {};

  // الجديد: حصادٌ أو أكثر يُضمّ بالبصمة (الصفحات اتحاد، والحال واحدة لأنها من القاموس نفسه)
  const nb = new Map(), meta = [], newPages = {};
  for (const f of harvests) {
    const h = JSON.parse(fs.readFileSync(f, "utf8"));
    if (h.domain !== D) { console.error(`! ${f}: حصادٌ لنطاق ${h.domain} لا ${D}`); process.exit(2); }
    meta.push({ file: path.basename(f), at: h.at, pages: Object.keys(h.pages || {}).length });
    for (const [pk, fps] of Object.entries(h.pages || {})) { const a = newPages[pk] || (newPages[pk] = []); for (const fp of fps) if (!a.includes(fp)) a.push(fp); }
    for (const b of h.blocks) {
      const x = nb.get(b.fp);
      if (!x) nb.set(b.fp, { fp: b.fp, tpl: b.tpl, status: b.status, count: b.count || 1, pages: (b.pages || []).slice() });
      else { x.count += b.count || 1; for (const p of b.pages || []) if (!x.pages.includes(p)) x.pages.push(p); }
    }
  }
  // القديم: الإنجليزية (الدفعات ثم الحصادات) والصفحات، والعربية (القاموس ثم الدفعات)
  const en = new Map(), pagesOf = new Map(), arBatch = new Map(), seen = new Set();
  for (const f of batchFiles) {
    let a; try { a = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; }
    if (!Array.isArray(a)) continue;
    for (const x of a) {
      if (!x || typeof x.fp !== "string" || typeof x.src !== "string") continue;
      if (!en.has(x.fp)) en.set(x.fp, x.src);
      if (typeof x.ar === "string" && x.ar && !arBatch.has(x.fp)) arBatch.set(x.fp, x.ar);
    }
  }
  for (const f of oldFiles) {
    let h; try { h = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; }
    if (h.domain !== D || !Array.isArray(h.blocks)) continue;
    for (const b of h.blocks) { seen.add(b.fp); if (!en.has(b.fp)) en.set(b.fp, b.tpl); }
    for (const [pk, fps] of Object.entries(h.pages || {})) for (const fp of fps) { let s = pagesOf.get(fp); if (!s) pagesOf.set(fp, s = new Set()); s.add(pk); }
  }
  const olds = [];
  let noEn = 0;
  for (const [fp, src] of en) {
    const ar = Object.prototype.hasOwnProperty.call(dict, fp) ? dict[fp] : arBatch.get(fp);
    if (typeof ar !== "string") continue;
    olds.push({ fp, src, ar, from: Object.prototype.hasOwnProperty.call(dict, fp) ? "dict" : "batch", pages: pagesOf.get(fp) || new Set() });
  }
  for (const fp of Object.keys(dict)) if (!en.has(fp)) noEn++;
  const res = mapDrift([...nb.values()], olds, { minSim, seen });
  const seenN = res.rows.filter((r) => r.seen).length;
  const out = opt("out", "");
  const head = {
    _tool: "drift-map", domain: D, at: new Date().toISOString(), harvest: meta, minSim,
    old: { harvests: oldFiles.map((f) => path.basename(f)), batches: batchFiles.length, withArabic: olds.length, dictWithoutEnglish: noEn },
    tally: res.tally, counts: res.counts, words: res.words, typoOnly: res.typo, seenBefore: seenN,
  };
  console.log(JSON.stringify(head, null, 1));
  if (out) {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(Object.assign(head, { blocks: res.rows }), null, 1) + "\n", "utf8");
    console.log("  " + out);
  }
  const partsDir = opt("parts", "");
  if (partsDir) {
    const name = opt("part-name", "dx0");
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) { console.error(`! ‎--part-name‎ حروفٌ صغيرة وأرقام وشرطات: «${name}»`); process.exit(2); }
    fs.mkdirSync(partsDir, { recursive: true });
    const clash = fs.readdirSync(partsDir).filter((n) => n.startsWith(name + "-") && /-\d{3}\.json$/.test(n));
    if (clash.length) { console.error(`! في ${partsDir} أجزاءٌ باسم ${name}-NNN (${clash.length}) — اسمٌ آخر أو مجلدٌ آخر`); process.exit(2); }
    const order = opt("order", "").split("|").filter(Boolean);
    const parts = partition(res.rows, newPages, { order, name, maxWords: +opt("part-words", "4800") || 4800, maxBlocks: +opt("part-blocks", "260") || 260 });
    const man = [];
    for (const p of parts) {
      fs.writeFileSync(path.join(partsDir, p.id + ".json"), JSON.stringify(p.items, null, 1) + "\n", "utf8");
      const c = { same: 0, edited: 0, new: 0 }, w = { same: 0, edited: 0, new: 0 };
      for (const it of p.items) { c[it.class]++; w[it.class] += wordsOf(it.src); }
      man.push({ id: p.id, pages: p.pages, blocks: p.items.length, words: p.words, counts: c, wordsByClass: w });
    }
    fs.writeFileSync(path.join(partsDir, name + "-manifest.json"), JSON.stringify({ _tool: "drift-map --parts", domain: D, at: head.at, order, parts: man }, null, 1) + "\n", "utf8");
    console.log(`  ${parts.length} جزءًا في ${partsDir}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
