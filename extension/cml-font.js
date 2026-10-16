/* cml-font.js — وحدة الخط العربي (2.0.0؛ DESIGN-fonts §٤.٣–٤.٧، وتعديلات S5b-B وS5d-B).
 *
 * ما تفعله: تبني من بايتات الخط المختار (نسخة base64 كتبها عامل الخدمة وحده في cml_font_data، ويقرؤها
 * المحرّك في قراءة get() الوحيدة) أوجهًا FontFace(ArrayBuffer) **تحت أسماء عائلات الموقع نفسه** بواصفاتها
 * (weight وstyle وstretch) منسوخةً حرفًا من كائن الموقع وقت التشغيل، وبمدى المحارف العربية وحده
 * (C.FONT_AR_RANGE). فالحروف الإنجليزية والأرقام الغربية والمسافة والأيقونات تبقى برسم الموقع حرفًا (ث١).
 *
 * ما لا تفعله: لا تجلب شيئًا (لا شبكة ولا عنوان إضافة، ث٣)، ولا تحقن <style> ولا نصَّ @font-face، ولا تقرأ
 * نصًّا ولا ورقةً ولا محدِّدًا من الصفحة (ث٤). قراءتاها الوحيدتان خاصيتان: متغيّرا الخط على <html> في
 * Intercom (الإلحاق)، وfont-family المحسوب لخمسة عناصر كتب فيها المحرّك ترجمته (reach).
 *
 * والسمة data-cml-font (C.FONT_ATTR) على <html> بلا قيمة ما دام لنا وجهٌ مسجَّل، وتُزال مع آخر وجه: عليها
 * يُعلَّق العلاج النقطي وعلاج القطع في *-point.css (S5b-B وS5d-B).
 *
 * ★ (ر5ب، ٢٩ ربيع الآخر ١٤٤٨هـ — القرار 71) «خط النظام»: مدخلٌ بلا بايتات (C.FONT_SYS، local: true) فتُبنى أوجهٌ بمصدر local() لخط
 * الجهاز العربي (لكل نطاق وزنٍ وجهٌ)، بمدى FONT_AR_RANGE وحده وبلا تجاوزٍ مقاسي، بقواعد تجربة ر5ب لكل بنية خط
 * (project/study/fonts/notes/system-font-spike.md) — وهي في passSys:
 *   ١) عائلةٌ من القائمة بوجوهٍ ثابتة الوزن (المساعدة، وClaude Code، وعناوين الخصوصية): مرآةٌ لكل وجهٍ بواصفاته حرفًا ومصدرُها وجه النظام
 *      لوزنه (O3)؛ فلا تنشأ مجموعة وزنٍ جديدة ولا يتغيّر اختيار حرفٍ إنجليزي.
 *   ٢) وجهٌ متغيّر الوزن (مداه وزنان): لا يُضاف تحت عائلته شيء (O1: وجهٌ واحد يرسم كل وزنٍ عاديًّا؛ O5: وجهان يُسقطان الإنجليزية).
 *   ٣) عائلةٌ من القائمة لها رفيقةٌ «<العائلة> Fallback» من next/font (وثائق المنصة والوثائق القانونية؛ meta.fontFallback): الأوجه تحت
 *      الرفيقة لا تحت العائلة — وجهٌ عربي بواصف وجهها نفسه (O2)، ولكل نطاق وزنٍ آخر مجموعةٌ فيها مرآةٌ لوجهها اللاتيني بمقاييسه
 *      (عريضةٌ من 600 فأعلى وعاديةٌ دونه) ثم وجهٌ عربي (O7): فالإنجليزي لحظة تحميل خط الموقع يبقى في الرفيقة بكل وزن.
 *   ٤) رصّةٌ تبلغ خط النظام (system-ui وأخواته: claude.ai والأكاديمية ومتن الخصوصية): لا شيء، فالعربية تسقط إليه.
 *   ٥) متغيّر Intercom لا يبلغ خط النظام ولا عائلةً مخدومة قبل اسمٍ عام (sans-serif…): «cml-ar» أولًا كالإلحاق، ووجوهها وجوه النظام (O4).
 * ولا فكّ ولا نسخة ولا font-ensure، ووجهٌ لم يجد اسمه في الجهاز ليس فشلًا (يُتخطّى إلى ما بعده كما يتخطّاه المتصفح). والسمة كما هي:
 * ما دام لنا وجه، فعلاجا القصّ في *-point.css كما هما (وأوجه «cml-ar-today» فيهما هي أوجه ويندوز نفسها).
 *
 * الواجهة (CMLFont.create(opts) ← F):
 *   F.sync(on, entry, b64) — متكافئ التكرار بحسب المعرّف والبصمة والحال. on=false أو entry=null ⇒ يحذف كل
 *       شيء فورًا (الإطفاء و«خط الموقع»). b64=null ⇒ «ينتظر النسخة» ولا يمسّ ما هو قائم. ويعيد false إن
 *       رُفضت النسخة (فكٌّ فاشل أو طولٌ أو ترويسةٌ خاطئة) فيطلب المحرّك إصلاحها في الإقلاع.
 *   F.check()   — من مراقب الترجمة قبل الرسم: أول نداءٍ يرفع درجة البناء، وبعده تمريرةٌ إن تغيّر document.fonts.size.
 *   F.mirror()  — تمريرة مصالحةٍ كاملة الآن.
 *   F.clear()   — يحذف أوجهنا ومتغيّرات الإلحاق والسمة.
 *   F.lostVars()— محا الموقع السمة أو متغيّر الإلحاق عن <html> وأوجهُنا قائمة (watchHtml يعيد التثبيت).
 *   F.note(el)  — عنصرٌ كتب فيه المحرّك ترجمته (أول خمسة) لقياس البلوغ.
 *   F.stats()   — {faces, families, reach, …}؛ reach: ok | none | off | err | wait.
 *
 * ثنائي الاستخدام كـcml-const: سكربتٌ كلاسيكي يعلن globalThis.CMLFont، بلا أثرٍ قبل create(). */
(function (g) {
  "use strict";
  var TASK_MS = 40;      // ميزانية المهمة: 40 مث، فيبقى هامشٌ لتفاوت كلفة الوجه دون حدّ المهمة الطويلة 50 مث (§٤.٧)
  var ORPHAN_MS = 2000;  // مهلة اليتيم: وجهٌ لم يبق لدلوه وجهٌ من الموقع يُحذف بعدها أو عند load التالي (ن١٣)
  var SAMPLES = 5;       // عناصر قياس البلوغ (§٤.٣ البند 8)

  // أسماءٌ عامة وخطوط نظام: لا وجه لها يُعكس، وأولُ اسمٍ منها في متغيّر Intercom يعني الإلحاق (§٤.٤)
  var SYS = { "system-ui": 1, "sans-serif": 1, "serif": 1, "monospace": 1, "cursive": 1, "fantasy": 1, "math": 1,
              "emoji": 1, "fangsong": 1, "-apple-system": 1, "blinkmacsystemfont": 1, "segoe ui": 1, "roboto": 1,
              "helvetica": 1, "arial": 1, "inherit": 1, "initial": 1, "unset": 1, "revert": 1 };
  function isSys(n) { return !!SYS[n] || n.indexOf("ui-") === 0; }
  // ★ (ر5ب) في «خط النظام»: أسماءٌ تبلغ خط واجهة النظام نفسه، والأسماء العامة التي يرسمها خطُّ المتصفح القياسي لا خط الواجهة
  var UIFONT = { "system-ui": 1, "-apple-system": 1, "blinkmacsystemfont": 1, "segoe ui": 1 };
  var GENERIC = { "serif": 1, "sans-serif": 1, "monospace": 1, "cursive": 1, "fantasy": 1, "math": 1, "emoji": 1, "fangsong": 1 };
  var BOLD_MIN = 600;    // عتبة العريض المصطنع في كروم: مرآة «Fallback» عريضةٌ من هنا وعاديةٌ دونه (ر5ب)
  function now() { return (g.performance && g.performance.now) ? g.performance.now() : Date.now(); }

  // أول اسمٍ في قائمة font-family (نصًّا كما هو): الفاصلة خارج التنصيص تقطع
  function firstFamily(list) {
    var s = String(list || ""), q = "", out = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === "\\" && i + 1 < s.length) { out += c + s.charAt(++i); continue; }
      if (q) { if (c === q) q = ""; out += c; continue; }
      if (c === '"' || c === "'") { q = c; out += c; continue; }
      if (c === ",") break;
      out += c;
    }
    return out.trim();
  }
  // ★ (ر5ب) أسماء قائمة font-family كلها بترتيبها (نصًّا كما هي): الأول بـ firstFamily ثم ما بعد كل فاصلةٍ خارج التنصيص
  function familiesOf(list) {
    var s = String(list || ""), out = [];
    while (s) {
      var f = firstFamily(s);
      if (f) out.push(f);
      var q = "", cut = -1;
      for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i);
        if (c === "\\") { i++; continue; }
        if (q) { if (c === q) q = ""; continue; }
        if (c === '"' || c === "'") { q = c; continue; }
        if (c === ",") { cut = i; break; }
      }
      s = cut < 0 ? "" : s.slice(cut + 1);
    }
    return out;
  }
  // ★ (ر5ب) مدى unicode-range: نصٌّ ← أزواج [من، إلى] مرتّبة؛ والطرح (مدى الرفيقة بلا العربية) لمرآتها اللاتينية
  function parseRange(str) {
    var out = [];
    String(str || "").split(",").forEach(function (p) {
      p = p.trim().toUpperCase().replace(/^U\+/, "");
      if (!p) return;
      var a, b;
      if (p.indexOf("?") >= 0) { a = parseInt(p.replace(/\?/g, "0"), 16); b = parseInt(p.replace(/\?/g, "F"), 16); }
      else { var ab = p.split("-"); a = parseInt(ab[0], 16); b = ab.length > 1 ? parseInt(ab[1], 16) : a; }
      if (isFinite(a) && isFinite(b) && a <= b) out.push([a, b]);
    });
    return out.sort(function (x, y) { return x[0] - y[0]; });
  }
  function rangeMinus(base, cut) {
    var B = parseRange(base), X = parseRange(cut), out = [];
    if (!B.length) B = [[0, 0x10ffff]];
    B.forEach(function (r) {
      var a = r[0], b = r[1];
      for (var i = 0; i < X.length && a <= b; i++) {
        var x = X[i];
        if (x[1] < a || x[0] > b) continue;
        if (x[0] > a) out.push([a, x[0] - 1]);
        a = x[1] + 1;
      }
      if (a <= b) out.push([a, b]);
    });
    return out.map(function (r) { return "U+" + r[0].toString(16).toUpperCase() + (r[1] !== r[0] ? "-" + r[1].toString(16).toUpperCase() : ""); }).join(", ");
  }
  // مدى الوزن من نصّ الواصف: "normal" و"bold" وعددٌ أو عددان
  function weightRange(w) {
    var s = String(w || "normal").trim().toLowerCase();
    if (s === "normal") return [400, 400];
    if (s === "bold") return [700, 700];
    var p = s.split(/\s+/).map(Number);
    if (!isFinite(p[0])) return [400, 400];
    return [p[0], isFinite(p[1]) ? p[1] : p[0]];
  }
  // الدلو المنتظم: نمطٌ قائم ومدى وزنٍ يشمل 400 (§٤.٣ البند 5)
  function isRegular(f) {
    if (String(f.style || "normal").toLowerCase() !== "normal") return false;
    var r = weightRange(f.weight);
    return r[0] <= 400 && r[1] >= 400;
  }
  function wOF2(buf) {
    var u = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
    return u.length === 4 && u[0] === 0x77 && u[1] === 0x4f && u[2] === 0x46 && u[3] === 0x32;
  }

  function create(opts) {
    opts = opts || {};
    var C = g.CMLConst || {}, SH = g.CMLShared;
    if (!SH || typeof SH.normFamily !== "function" || typeof SH.fontFaceDesc !== "function") return null;
    var doc = g.document;
    var norm = SH.normFamily;
    var RANGE = opts.range || C.FONT_AR_RANGE;
    var ATTR = opts.attr || C.FONT_ATTR || "data-cml-font";
    var MONO = opts.mono !== false;
    var CTX = opts.ctx || null;
    // القائمة المغلقة {عائلةٌ مطبَّعة: دور}؛ والدور mono يسقط كله إن رُفض ق٤ (FONT_MONO=false)
    var FAMS = Object.create(null);
    var src = opts.families || {};
    for (var fk in src) {
      if (!Object.prototype.hasOwnProperty.call(src, fk)) continue;
      var role = src[fk];
      if (role === "mono" && !MONO) continue;
      if (role === "ui" || role === "read" || role === "mono") FAMS[norm(fk)] = role;
    }
    var PREP = Array.isArray(opts.prepend) ? opts.prepend.filter(function (v) { return typeof v === "string" && v.indexOf("--") === 0; }) : [];
    // ★ (ر5ب) اسم الخط المحلي في رفيقات «Fallback» من next/font (meta.fontFallback)؛ وبغيابه لا تُخدم الرفيقات في «خط النظام»
    var FB_NAME = typeof opts.fallback === "string" && opts.fallback ? opts.fallback : null;

    var S = {
      on: false, entry: null, key: null, buf: null, failed: false, tier: 0, size: -1, waiting: false,
      passes: 0, tasks: 0, maxTask: 0, faceMax: 0, bootMs: null, bootFaces: null, built: 0, famHas: Object.create(null), b64: null,
      sys: false, // ★ (ر5ب) «خط النظام»: أوجه local() بلا بايتات (passSys)
    };
    var ours = new Map();    // مفتاح الدلو ← {face, nf, key}: وجهٌ واحدٌ منّا لكل دلوٍ من دلاء الموقع
    var extras = new Map();  // "ar|normal" … "compact|italic" ← {face, key}: cml-ar (الإلحاق) وcml-ar-compact (القطع)
    var sysf = new Map();    // ★ (ر5ب) مفتاح المواصفة ← {face, own, orphan}: أوجه «خط النظام» كلها (المرايا والرفيقات وcml-ar)
    var mine = new Set();    // أوجهنا الحيّة كلها — لا تُحسب من أوجه الموقع في أي تمريرة
    var prep = Object.create(null); // متغيّرٌ ألحقناه ← {val: ما كتبناه، prev: قيمته السطرية قبلنا}
    var queue = new Map();   // أعمال البناء المعلّقة (مفتاحُ العمل ← العمل)
    var flushArmed = false, orphanTimer = null, tierArmed = false;
    var samples = [];

    function live(f) { try { return doc.fonts.has(f); } catch (e) { return false; } }
    function addFace(f) { try { doc.fonts.add(f); return true; } catch (e) { return false; } }
    function delFace(f) {
      mine.delete(f);
      try { doc.fonts.delete(f); } catch (e) {}
    }
    // فشل التحليل أو الإضافة: يُعطَّل الخط في هذا الإطار بلا إعادة، والحال err (§٥.٢)، حتى تصل نسخةٌ أخرى
    function fail() {
      if (S.failed) return;
      S.failed = true;
      wipe();
      // ويُبلَّغ المحرّك فيطلب الإصلاح (font-ensure، مرةً في الصفحة ومن الإطار الأعلى): نسخةٌ بترويسةٍ وطولٍ صحيحين وجسمٍ
      // تالف لا يكشفها إلا التحليل، فبلا طلبٍ لا يصلحها شيء (المراجعة العدائية S6-B)
      if (typeof opts.onFail === "function") { try { opts.onFail(); } catch (e) {} }
    }
    // وجهٌ واحد من البايتات المحفوظة: الواصفات الثلاثة كما أعطيت، والمقاييس من metrics (مدخل الفهرس أو {m:{ui:clamp}})
    function makeFace(family, d3, metrics, role) {
      var d;
      try { d = SH.fontFaceDesc(metrics, role); } catch (e) { fail(); return null; }
      d.unicodeRange = RANGE;
      d.weight = d3.weight; d.style = d3.style; d.stretch = d3.stretch;
      var f;
      try { f = new FontFace(family, S.buf, d); } catch (e) { fail(); return null; }
      if (f.status === "error") { fail(); return null; }
      try { f.loaded.then(null, function () { if (mine.has(f)) fail(); }); } catch (e) {}
      if (!addFace(f)) { fail(); return null; }
      mine.add(f);
      S.built++;
      return f;
    }
    function axis() { var w = S.entry && S.entry.wght; return w && w.length === 2 ? w[0] + " " + w[1] : "normal"; }
    // ★ (ر5ب) جاهزية البناء: نسخةٌ مفكوكة لخطٍّ محزوم، أو «خط النظام» الذي لا نسخة له
    function ready() { return S.on && !S.failed && (S.sys || !!S.buf); }
    // ★ (ر5ب) وجهٌ بمصدر local(): يُحمّله المتصفح عند أول حاجةٍ إليه، ووجهٌ لم يجد اسمه في الجهاز يصير error فيتخطّاه إلى ما بعده —
    // فلا fail() هنا (ليس نسخةً تالفة)، ولا مقاييس: خط النظام بحجمه وصندوقه كما يرسمه النظام (كأوجه «cml-ar-today»)
    function makeLocal(sp) {
      var f;
      try { f = new FontFace(sp.fam, sp.src, sp.d); } catch (e) { return null; }
      if (!addFace(f)) return null;
      mine.add(f);
      S.built++;
      return f;
    }

    // ── أعمال البناء: وجهٌ لدلو، أو وجهٌ خاص (cml-ar وcml-ar-compact) — والجديد يُضاف قبل حذف القديم فلا ومضة
    function runJob(j) {
      if (j.s) { // ★ (ر5ب) وجهٌ من مواصفات «خط النظام»
        if (!ready() || !S.sys || sysf.has(j.s)) return;
        var fs = makeLocal(j.sp);
        if (fs) sysf.set(j.s, { face: fs, own: j.sp.own, orphan: 0 });
        return;
      }
      if (!S.on || !S.buf || S.failed || S.sys) return;
      var old = j.x ? extras.get(j.x) : ours.get(j.k), f;
      if (old && old.key === S.key && live(old.face)) return;
      if (j.x) {
        var parts = j.x.split("|"), clamp = parts[0] === "compact" ? clampVals() : null;
        if (parts[0] === "compact" && !clamp) return;
        f = makeFace(parts[0] === "compact" ? "cml-ar-compact" : "cml-ar", { weight: axis(), style: parts[1], stretch: "normal" },
                     clamp ? { m: { ui: clamp } } : S.entry, "ui");
        if (!f) return;
        extras.set(j.x, { face: f, key: S.key });
      } else {
        f = makeFace(j.b.fam, { weight: j.b.weight, style: j.b.style, stretch: j.b.stretch }, S.entry, j.b.role);
        if (!f) return;
        ours.set(j.k, { face: f, nf: j.b.nf, key: S.key, orphan: 0 });
      }
      if (old && old.face !== f) delFace(old.face);
    }
    function enqueue(id, job) { if (!queue.has(id)) queue.set(id, job); }
    // يبني ما في الطابور ما دامت المهمة دون TASK_MS، والزائد إلى الإطار التالي. والتقدير أكبرُ كلفة وجهٍ بُني فعلًا في
    // هذا الإطار (S.faceMax)، لا كلفة العمل السابق: فالعمل الذي لا يبني شيئًا (وجهه قائم) كان يُصفّر التقدير، والوجه
    // الرخيص قبل غالٍ كان يُدخل الغالي في المهمة نفسها — وقِيس على صفحة وثائقٍ حيّة 54.7 مث (المراجعة العدائية S6-B)
    function flush() {
      flushArmed = false;
      if (!queue.size) return;
      var t0 = now(), n = 0;
      S.tasks++;
      var it = queue.keys();
      while (queue.size) {
        if (n && now() - t0 + S.faceMax > TASK_MS) { armFlush(); break; }
        var id = it.next().value;
        if (id === undefined) { it = queue.keys(); continue; }
        var job = queue.get(id);
        queue.delete(id);
        var t1 = now(), b0 = S.built;
        runJob(job);
        var c = now() - t1;
        if (S.built > b0 && c > S.faceMax) S.faceMax = c;
        n++;
        if (S.failed) { queue.clear(); break; }
      }
      var dt = now() - t0;
      if (dt > S.maxTask) S.maxTask = dt;
      writeAttr();
      try { S.size = doc.fonts.size; } catch (e) {}
    }
    function armFlush() {
      if (flushArmed) return;
      flushArmed = true;
      var done = false, go = function () { if (done) return; done = true; flush(); };
      try { if (typeof g.requestAnimationFrame === "function") g.requestAnimationFrame(go); } catch (e) {}
      setTimeout(go, 50); // تبويبٌ في الخلفية لا إطارات فيه: المهلة تكمل البناء
    }

    // ── السمة على <html>: ما دام لنا وجه
    function writeAttr() {
      var h = doc.documentElement;
      if (!h) return;
      var have = mine.size > 0;
      if (have && !h.hasAttribute(ATTR)) h.setAttribute(ATTR, "");
      else if (!have && h.hasAttribute(ATTR)) h.removeAttribute(ATTR);
    }

    // ── الإلحاق (§٤.٤): متغيّرا Intercom يبدآن بخط نظامٍ أو باسمٍ بلا وجهٍ معلَن ⇒ "cml-ar" أولًا
    function prepActive() { for (var v in prep) return true; return false; }
    function unprepend(v) {
      var h = doc.documentElement, p = prep[v];
      delete prep[v];
      if (!h || !h.style || !p) return;
      if (h.style.getPropertyValue(v).trim() === p.val) {
        h.style.removeProperty(v);
        if (p.prev) h.style.setProperty(v, p.prev);
      }
    }
    // reread: تُقرأ قيمة الموقع نفسها (تُرفع كتابتنا لحظةً في المهمة نفسها فلا يُرسم شيء) — في محفّزات الأوراق
    // وحدها، فما تغيّر في CSS الموقع تحت كتابتنا يُرى؛ وفي سواها يكفي أن كتابتنا قائمة
    // ★ (ر5ب) في «خط النظام» (served = العائلات المخدومة بمرايانا): يُلحق «cml-ar» بمتغيّرٍ لا تبلغ رصّتُه خطَّ واجهة النظام ولا عائلةً
    // مخدومة قبل أن يقع على اسمٍ عام أو تنتهي (O4) — فرصّة system-ui (متن الخصوصية) ورصّةٌ أولها عائلةٌ مخدومة (المساعدة) لا تُمسّان
    function sysWantsAr(site, declared, served) {
      var fs = familiesOf(site);
      for (var i = 0; i < fs.length; i++) {
        var n = norm(fs[i]);
        if (n === "cml-ar" || UIFONT[n] || served[n]) return false;
        if (GENERIC[n]) return true;
      }
      return true;
    }
    function prependPass(declared, reread, served) {
      var h = doc.documentElement;
      if (!h || !h.style || !PREP.length) return;
      for (var i = 0; i < PREP.length; i++) {
        var v = PREP[i], cur = prep[v];
        if (cur && !reread && h.style.getPropertyValue(v).trim() === cur.val) continue;
        var prev = cur ? cur.prev : h.style.getPropertyValue(v).trim();
        if (cur) { h.style.removeProperty(v); if (prev) h.style.setProperty(v, prev); }
        var site = "";
        try { site = g.getComputedStyle(h).getPropertyValue(v).trim(); } catch (e) {}
        var first = site ? norm(firstFamily(site)) : "";
        var want = !!site && first !== "cml-ar" && (served ? sysWantsAr(site, declared, served) : (isSys(first) || !declared[first]));
        if (want) {
          var val = '"cml-ar", ' + site;
          h.style.setProperty(v, val);
          prep[v] = { val: h.style.getPropertyValue(v).trim(), prev: prev };
        } else delete prep[v];
      }
    }

    function clampVals() {
      var c = S.entry && S.entry.clamp && CTX ? S.entry.clamp[CTX] : null;
      return c && typeof c.s === "number" && typeof c.a === "number" && typeof c.d === "number" ? c : null;
    }

    // ── التمريرة: المصالحة مع أوجه الموقع الحاضرة (§٤.٣ البند 6)
    function pass(why) {
      if (!ready() || !doc.fonts) return;
      if (S.sys) { passSys(why); return; }
      S.passes++;
      var site = new Map(), declared = Object.create(null), famHas = Object.create(null);
      try {
        doc.fonts.forEach(function (f) {
          if (mine.has(f)) return;
          var nf = norm(f.family);
          declared[nf] = 1;
          var role = FAMS[nf];
          if (!role) return;
          famHas[nf] = 1;
          var k = nf + "|" + f.weight + "|" + f.style + "|" + f.stretch;
          var b = site.get(k);
          if (!b) {
            b = { fam: f.family, nf: nf, weight: f.weight, style: f.style, stretch: f.stretch, role: role, used: false, regular: isRegular(f) };
            site.set(k, b);
          }
          if (f.status === "loading" || f.status === "loaded") b.used = true;
        });
      } catch (e) { return; }
      S.famHas = famHas;
      var t = now();
      // ١) أوجهنا: يبقى ما له دلو، ويُستبدل فورًا ما ظهر لعائلته وجهٌ بواصفاتٍ أخرى (خ١)، ويُحذف اليتيم بعد مهلة
      ours.forEach(function (rec, k) {
        if (site.has(k)) {
          rec.orphan = 0;
          if (!live(rec.face)) addFace(rec.face); // حذفته الصفحة: يُعاد عند هذا المحفِّز الطبيعي وحده
          return;
        }
        if (famHas[rec.nf]) { ours.delete(k); delFace(rec.face); return; }
        if (!rec.orphan) { rec.orphan = t; armOrphan(); }
        else if (why === "load" || t - rec.orphan >= ORPHAN_MS) { ours.delete(k); delFace(rec.face); }
        else armOrphan();
      });
      // ٢) ما يُبنى: الإقلاع وجه ui المنتظم وحده، ثم المنتظم للأدوار كلها، وسائر الدلاء عند الاستعمال
      site.forEach(function (b, k) {
        var rec = ours.get(k);
        if (rec && rec.key === S.key) return;
        var want = !!rec || b.used || (b.regular && (S.tier >= 1 || b.role === "ui"));
        if (want) enqueue(k, { k: k, b: b });
      });
      // ٣) الإلحاق، ثم الأوجه الخاصة
      // الإعادة تقرأ قيمة الموقع تحت كتابتنا في كل تمريرةٍ إلا «الاستعمال» (حدث loading) — فورقةٌ جديدة غيّرت المتغيّر تُرى
      if (PREP.length) prependPass(declared, why !== "loading");
      var needAr = prepActive();
      var needCompact = S.tier >= 1 && !!clampVals() && (ours.size > 0 || queue.size > 0 || needAr);
      // ووجه cml-ar المائل بعد الإقلاع (كالدلاء غير المنتظمة): في الإقلاع وجهٌ واحد (§٤.٣ البند 5) — وكان مركز الخصوصية
      // يبني فيه وجهين فيطول إخفاء الصفحة (قِيس 22–24 مث بوجهين، المراجعة العدائية S6-B)
      ["normal", "italic"].forEach(function (st) {
        xNeed("ar|" + st, needAr && (st === "normal" || S.tier >= 1));
        xNeed("compact|" + st, needCompact);
      });
      flush();
      writeAttr();
      try { S.size = doc.fonts.size; } catch (e) {}
    }
    // ★ (ر5ب) تمريرة «خط النظام»: المطلوب كله (مواصفاتٌ بمفاتيحها) من حالة document.fonts الحاضرة بقواعد رأس الملف، ثم المصالحة.
    // والمفتاح يحمل ما يتغيّر به الوجه (واصفات الوجه الذي نعكسه ومقاييس الرفيقة)، فما تغيّر في الموقع يُبنى من جديد ويُحذف القديم
    function passSys(why) {
      S.passes++;
      var bands = (S.entry && S.entry.bands) || [];
      var buckets = [], declared = Object.create(null), famHas = Object.create(null), fbs = Object.create(null);
      try {
        doc.fonts.forEach(function (f) {
          if (mine.has(f)) return;
          var nf = norm(f.family);
          declared[nf] = 1;
          if (FAMS[nf]) { famHas[nf] = 1; buckets.push({ f: f, nf: nf, r: weightRange(f.weight) }); return; }
          // رفيقة next/font: «<عائلةٌ من القائمة> Fallback» (بعد التطبيع)
          var base = nf.length > 9 && nf.slice(-9) === " fallback" ? nf.slice(0, -9) : "";
          if (base && FAMS[base]) (fbs[base] = fbs[base] || []).push(f);
        });
      } catch (e) { return; }
      S.famHas = famHas;
      // served: العائلات المخدومة (برفيقتها أو بمراياها) — بها يُحكم على الإلحاق؛ وviaFb: ما خدمته رفيقتها فلا مرايا تحتها
      var want = new Map(), served = Object.create(null), viaFb = Object.create(null);
      function bandOf(w) { for (var i = 0; i < bands.length; i++) if (w >= bands[i].w[0] && w <= bands[i].w[1]) return bands[i]; return null; }
      function srcOf(b) { return b ? b.names.map(function (n) { return 'local("' + String(n).replace(/["\\]/g, "") + '")'; }).join(", ") : ""; }
      // ٣) الرفيقة: وجهٌ واحدٌ قائم بوزنٍ واحد كما تولّده next/font، وإلا فلا شيء؛ والعائلة تُخدم منها (لا مرايا تحتها)
      for (var base in fbs) {
        var fl = fbs[base], ff = fl[0], fr = ff ? weightRange(ff.weight) : null;
        if (!FB_NAME || !famHas[base] || fl.length !== 1 || fr[0] !== fr[1] || String(ff.style).toLowerCase() !== "normal") continue;
        served[base] = viaFb[base] = 1;
        var W = fr[0], met = { sizeAdjust: ff.sizeAdjust, ascentOverride: ff.ascentOverride, descentOverride: ff.descentOverride,
                               lineGapOverride: ff.lineGapOverride };
        var sig = [ff.family, ff.weight, ff.stretch, ff.unicodeRange, met.sizeAdjust, met.ascentOverride, met.descentOverride, met.lineGapOverride].join("|");
        // المرآة اللاتينية بمدى الرفيقة منقوصًا منه العربي: فلا تسبق الوجه العربي في حروفه أيًّا كان ترتيب الإضافة
        var latR = rangeMinus(ff.unicodeRange, RANGE);
        var group = function (a, b, band) {
          var wr = a + " " + b, k = "fb|" + base + "|" + wr + "|" + sig;
          var dl = { weight: wr, style: ff.style, stretch: ff.stretch, unicodeRange: latR };
          for (var mk in met) if (met[mk]) dl[mk] = met[mk];
          want.set(k + "|lat", { fam: ff.family, own: base, src: C.fontFallbackSrc(FB_NAME, a >= BOLD_MIN), d: dl });
          want.set(k + "|ar", { fam: ff.family, own: base, src: srcOf(band), d: { weight: wr, style: ff.style, stretch: ff.stretch, unicodeRange: RANGE } });
        };
        bands.forEach(function (b) {
          var lo = b.w[0], hi = b.w[1];
          if (W < lo || W > hi) { group(lo, hi, b); return; }
          // نطاق وزن الرفيقة نفسه: وجهٌ عربي بواصفها حرفًا فيدخل مجموعتها (O2)، وما حوله من النطاق مجموعتان (O7)
          want.set("fb|" + base + "|own|" + sig, { fam: ff.family, own: base, src: srcOf(b),
            d: { weight: ff.weight, style: ff.style, stretch: ff.stretch, unicodeRange: RANGE } });
          if (lo < W) group(lo, W - 1, b);
          if (W < hi) group(W + 1, hi, b);
        });
      }
      // ١) الوجوه الثابتة لعائلةٍ لا تخدمها رفيقة (O3)، و٢) المتغيّرة لا شيء تحتها
      buckets.forEach(function (bk) {
        var f = bk.f;
        if (bk.r[0] !== bk.r[1] || viaFb[bk.nf]) return;
        var b = bandOf(bk.r[0]);
        if (!b) return;
        served[bk.nf] = 1;
        want.set("o3|" + bk.nf + "|" + f.weight + "|" + f.style + "|" + f.stretch, { fam: f.family, own: bk.nf, src: srcOf(b),
          d: { weight: f.weight, style: f.style, stretch: f.stretch, unicodeRange: RANGE } });
      });
      // ٥) الإلحاق في Intercom (O4)، وأوجه «cml-ar» لكل نطاقٍ قائمًا ومائلًا (المائل بوجهٍ قائم فلا ميل مصطنع في العربية)
      if (PREP.length) prependPass(declared, why !== "loading", served);
      if (prepActive()) ["normal", "italic"].forEach(function (st) {
        bands.forEach(function (b) {
          want.set("ar|" + b.w[0] + "|" + st, { fam: "cml-ar", own: "cml-ar", src: srcOf(b),
            d: { weight: b.w[0] + " " + b.w[1], style: st, unicodeRange: RANGE } });
        });
      });
      // المصالحة: يبقى المطلوب (ويُعاد إن حذفته الصفحة)، ويُحذف فورًا ما لم يعد مطلوبًا وعائلته حاضرة (تغيّرت واصفاتها) أو كان
      // من «cml-ar»، ويبقى اليتيم مهلةً كالدلاء (ورقةٌ تُستبدل)، ثم يُبنى الجديد بترتيبه
      var t = now();
      sysf.forEach(function (rec, k) {
        if (want.has(k)) { rec.orphan = 0; if (!live(rec.face)) addFace(rec.face); return; }
        if (rec.own === "cml-ar" || famHas[rec.own]) { sysf.delete(k); delFace(rec.face); return; }
        if (!rec.orphan) { rec.orphan = t; armOrphan(); }
        else if (why === "load" || t - rec.orphan >= ORPHAN_MS) { sysf.delete(k); delFace(rec.face); }
        else armOrphan();
      });
      want.forEach(function (sp, k) { if (!sysf.has(k)) enqueue("s|" + k, { s: k, sp: sp }); });
      flush();
      writeAttr();
      try { S.size = doc.fonts.size; } catch (e) {}
    }
    // وجهٌ خاص (cml-ar أو cml-ar-compact): يُبنى أو يُستبدل بالخط الجديد، ويُعاد إن حذفته الصفحة، ويُحذف حين لا يلزم
    function xNeed(x, need) {
      var rec = extras.get(x);
      if (!need) {
        queue.delete(x);
        if (rec) { extras.delete(x); delFace(rec.face); }
        return;
      }
      if (rec && rec.key === S.key) { if (!live(rec.face)) addFace(rec.face); return; }
      enqueue(x, { x: x });
    }
    function armOrphan() {
      if (orphanTimer) return;
      orphanTimer = setTimeout(function () { orphanTimer = null; pass("orphan"); }, ORPHAN_MS + 50);
    }
    function armTier() {
      if (tierArmed || S.tier >= 1) return;
      tierArmed = true;
      var done = false, go = function () { if (done) return; done = true; if (S.tier < 1) { S.tier = 1; pass("tier"); } };
      try { if (typeof g.requestAnimationFrame === "function") g.requestAnimationFrame(go); } catch (e) {}
      setTimeout(go, 500);
    }
    // يحذف أوجهنا كلها ومتغيّرات الإلحاق والسمة (ولا يمسّ النسخة المفكوكة: إعادة التشغيل بلا فكٍّ جديد)
    function wipe() {
      queue.clear();
      if (orphanTimer) { clearTimeout(orphanTimer); orphanTimer = null; }
      mine.forEach(function (f) { try { doc.fonts.delete(f); } catch (e) {} });
      mine.clear(); ours.clear(); extras.clear(); sysf.clear();
      for (var v in prep) unprepend(v);
      writeAttr();
    }

    function sync(on, entry, b64) {
      if (!on || !entry) {
        S.on = false; S.waiting = false;
        if (mine.size || prepActive() || queue.size || (doc.documentElement && doc.documentElement.hasAttribute(ATTR))) wipe();
        return true;
      }
      // ★ (ر5ب) «خط النظام» (مدخلٌ بلا بايتات): لا نسخة تُنتظر ولا فكّ. والانتقال بين الطريقين يمحو أوجه الطريق الآخر أولًا
      // (أوجه «خط النظام» غير أوجه الدلاء) ثم يبني الجديد في المهمة نفسها، فلا إطار بلا خط
      if (entry.local) {
        var lkey = entry.id + "|" + (entry.v || ""), lwas = S.on && S.sys;
        if (!S.sys || S.key !== lkey) { if (mine.size || prepActive() || queue.size) wipe(); S.tier = 1; }
        S.on = true; S.sys = true; S.key = lkey; S.entry = entry; S.failed = false; S.waiting = false;
        if (!lwas) pass("sync"); else if (lostVars()) pass("restore"); else check();
        return true;
      }
      if (S.sys) { wipe(); S.sys = false; S.key = null; } // من «خط النظام» إلى خطٍّ محزوم: لا يبقى وجهٌ محلي بجوار أوجه الدلاء
      var key = entry.id + "|" + entry.sha, wasOn = S.on;
      S.on = true;
      if (b64 == null) { // ينتظر النسخة: ما هو قائمٌ يبقى (لا ومضة إلى خط النظام عند التبديل)
        S.waiting = key !== S.key || !S.buf;
        return true;
      }
      // نسخةٌ جديدة النصّ تحت المعرّف والبصمة أنفسهما (أصلحها العامل بعد فشل التحليل) تُفكّ من جديد؛ والنصّ نفسه
      // (المرجع نفسه في كل نداءٍ من applyChrome) يُقارَن بالمؤشّر فلا كلفة
      if (key !== S.key || !S.buf || b64 !== S.b64) {
        var t0 = now(), buf = null;
        try { buf = SH.b64ToBuf(b64); } catch (e) { buf = null; }
        if (!buf || buf.byteLength !== entry.bytes || !wOF2(buf)) { // نسخةٌ تالفة تُرفض فلا يُضاف شيء (ث٧)
          S.waiting = key !== S.key || !S.buf;
          return false;
        }
        if (S.buf && key === S.key) wipe(); // الأوجه المبنية من النصّ القديم لا تبقى بجوار الجديدة
        S.buf = buf; S.b64 = b64; S.key = key; S.entry = entry; S.failed = false; S.waiting = false;
        pass("sync");
        if (S.bootMs === null) { S.bootMs = now() - t0; S.bootFaces = mine.size; }
        armTier();
        return true;
      }
      S.waiting = false;
      if (!wasOn || lostVars()) pass("restore"); else check();
      return true;
    }
    function check() {
      if (!ready()) return;
      if (S.tier < 1) { S.tier = 1; pass("check"); return; }
      var n = -1;
      try { n = doc.fonts.size; } catch (e) {}
      if (n !== S.size) pass("check");
    }
    function lostVars() {
      var h = doc.documentElement;
      if (!h) return false;
      if (mine.size && !h.hasAttribute(ATTR)) return true;
      for (var v in prep) if (!h.style || h.style.getPropertyValue(v).trim() !== prep[v].val) return true;
      return false;
    }
    function note(el) {
      if (!el || el.nodeType !== 1) return;
      if (samples.length < SAMPLES) { if (samples.indexOf(el) < 0) samples.push(el); return; }
      for (var i = 0; i < samples.length; i++) if (!samples[i].isConnected) { samples[i] = el; return; }
    }
    // البلوغ (م٨): أولُ اسمٍ في font-family المحسوب لعناصر كتبنا فيها — عائلةٌ نعكسها أو cml-ar* ⇒ ok
    function reach() {
      if (S.failed) return "err";
      if (!S.on) return "off";
      if (!S.sys && !S.buf) return "wait";
      var fam = Object.create(null), k;
      ours.forEach(function (r) { fam[r.nf] = 1; });
      for (k in S.famHas) fam[k] = 1;
      var seen = false;
      for (var i = 0; i < samples.length; i++) {
        var el = samples[i];
        if (!el || !el.isConnected) continue;
        var ff = "";
        try { ff = g.getComputedStyle(el).fontFamily; } catch (e) { continue; }
        seen = true;
        var n = norm(firstFamily(ff));
        if (fam[n] || n.indexOf("cml-ar") === 0) return "ok";
        // ★ (ر5ب) وفي «خط النظام» رصّةٌ أولها خط نظامٍ أو اسمٌ عام تبلغ خط الجهاز من نفسها (القاعدة ٤)
        if (S.sys && isSys(n)) return "ok";
      }
      if (!seen) return ours.size || sysf.size || prepActive() || (S.sys && Object.keys(S.famHas).length) ? "ok" : "none";
      return "none";
    }
    function stats() {
      var fams = Object.create(null), nf = 0, comp = 0;
      ours.forEach(function (r) { if (!fams[r.nf]) { fams[r.nf] = 1; nf++; } });
      sysf.forEach(function (r) { if (r.own !== "cml-ar" && !fams[r.own]) { fams[r.own] = 1; nf++; } }); // ★ (ر5ب)
      extras.forEach(function (r, x) { if (x.indexOf("compact|") === 0) comp++; });
      return { faces: mine.size, families: nf, reach: reach(), id: S.entry && S.on ? S.entry.id : null,
               compact: comp, prepend: Object.keys(prep).length, passes: S.passes, tasks: S.tasks,
               maxTask: Math.round(S.maxTask * 10) / 10, faceMax: Math.round(S.faceMax * 10) / 10, bootMs: S.bootMs === null ? null : Math.round(S.bootMs * 10) / 10, bootFaces: S.bootFaces,
               built: S.built, tier: S.tier, pending: queue.size, sys: S.sys && S.on };
    }

    // ── المحفِّزات (تُركَّب مرةً عند الإنشاء، أي عند document_start): الأوراق ومراحل الصفحة والاستعمال
    function trigger(why) { if (ready()) pass(why); }
    try {
      doc.addEventListener("load", function (e) {
        var t = e && e.target;
        if (t && (t.nodeName === "LINK" || t.nodeName === "STYLE")) trigger("load");
      }, true);
      if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { trigger("dcl"); }, { once: true });
      g.addEventListener("load", function () { trigger("load"); }, { once: true });
      // الاستعمال: loading حين يبدأ تحميل وجهٍ من الموقع، وloadingdone احتياطًا — كروم لا يطلق loading لوجهٍ يُحمَّل
      // في اللحظة نفسها (local() مثلًا)، فيصل loadingdone وحده
      if (doc.fonts && doc.fonts.addEventListener) {
        doc.fonts.addEventListener("loading", function () { trigger("loading"); });
        doc.fonts.addEventListener("loadingdone", function () { trigger("loading"); });
      }
    } catch (e) {}

    var inst = { sync: sync, check: check, mirror: function () { pass("mirror"); }, clear: function () { S.on = false; wipe(); },
                 lostVars: lostVars, note: note, stats: stats };
    api.last = inst; // للاختبار والتشخيص: عالم سكربت المحتوى معزول، فلا تراه الصفحة
    return inst;
  }

  var api = { create: create, firstFamily: firstFamily, isRegular: isRegular, last: null };
  g.CMLFont = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
