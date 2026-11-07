/* cml-rtl.js — محرّك الاتجاه الجذري: النسخة الواحدة من تحليل CSS وقلبه منطقيًّا
 * (المرحلة ٣ من خطة الإطلاق).
 *
 * يستهلكه ثلاثة: مولّد rtl-overrides.css في Node (code/toolchain/gen-rtl.mjs)،
 * و«طبيب الاتجاه» في المتصفح (engine.js — يكشف ما استجدّ في CSS الموقع ولا تغطيه
 * ملفاتنا)، وصفحة الاختبار _rtltest.html. تعريف «الفيزيائي» وكيف يُقلب يجب أن يكون
 * واحدًا عند الثلاثة وإلا أبلغ الطبيبُ هراءً — فهو هنا مرة واحدة (درس cml-shared).
 *
 * المبدأ (قرار الخطة): نقلب **الأصناف لا المحسوب**. المواضع التي تحسبها جافاسكربت
 * تُكتب أنماطًا سطرية (inline) فلا تُمسّ إطلاقًا — لا !important فوقها ولا قراءة لها.
 *
 * طريقة القلب: **الخصائص المنطقية** لا القلب الفيزيائي الأعمى. `margin-left` تصير
 * `margin-inline-start` — فتنقلب في RTL من تلقاء نفسها، وتبقى في مكانها داخل جزر
 * LTR (pre/code/[data-cml-noflip] التي نضبط direction:ltr عليها) وداخل فقرات
 * dir=auto الإنجليزية: الصواب يَنبثق من حوسبة المتصفح نفسها لا من حالات خاصة عندنا.
 *
 * سلّم التخصيص الموحّد (جوهر صحة التعاقب — صيغته الثانية بعد دحضٍ تجريبي لصيغة
 * «القسمين بالترتيب» الأولى): محدِّد الموقع يُلفّ في ‎:where()‎ فيصفر تخصيصه، ثم
 * يُبنى تخصيصنا سلّمًا بمعرّفات داخل ‎:not()‎ — المصفِّرات (2,1,1) دون المنطقيات
 * والمطابقات (3,1,1) دون معزَّزات قصد المؤلف (4,1,1). فعنصر عليه ‎.ml-2 و.mr-4
 * معًا: مصفِّر كلٍّ يخسر أمام منطقيِّ الآخر بالتخصيص لا بالترتيب — قانونًا بنيويًّا
 * يصمد مهما تفاوت تخصيص محدِّدات الموقع (كان التفاوت يكسر صيغة الترتيب: 130
 * مصفِّرًا حقيقيًّا فوق مستوى الأداة، حتى (0,9,1) في dframe).
 *
 * طبقات التعاقب (@layer): الموقع على Tailwind v4 بطبقات مسماة، والطبقة المتأخرة
 * تغلب المتقدمة بصرف النظر عن التخصيص. مخرجاتنا العادية **بلا طبقات** (فتغلب طبقات
 * الموقع كلها — مطلوب)، والترتيب داخل مستوى السلّم الواحد = (رتبة طبقة الموقع، ثم
 * موضع القاعدة) — ومع توحيد التخصيص صار هذا الترتيب قانونَ الطبقات نفسَه لا
 * تقريبًا له. أما إعلانات ‎!important‎ فقانون الطبقات فيها منقلب (المبكر يغلب)،
 * فتُبثّ في ‎@layer cml-imp‎ تُعلَن أولَ الورقة فتغلب مهمّاتِ الموقع كلَّها —
 * وطبقة ‎cml-point‎ تُعلن قبلها ليبقى لإصلاحات base.css النقطية الكلمةُ الأخيرة.
 *
 * النسخ المطابقة: إعلانات الموقع المتناظرة/المنطقية في العائلات المتنازَعة الخانات
 * تُعاد كما هي في مستوى المنطقيات بمواضعها — وإلا محاها مصفِّرُ قاعدةٍ مجاورة.
 *
 * متغيّرات الإزاحة السينية (‎--tw-translate-x ونحوها): تُقلب **عند التصريح لا عند
 * الاستعمال** بحيلة calc(القيمة * -1) الصالحة لكل طول — ولو قلبنا الموضعين معًا
 * لتعادلا قلبًا مزدوجًا فيعود الأصل. استعمالات translateX بقيم حرفية مباشرة
 * (لا متغيّر فيها) تُقلب في موضعها.
 *
 * ثنائي الاستخدام: لا import/export — سكربت كلاسيكي في المتصفح ووحدة ESM صالحة في
 * Node (التعيين على globalThis يعمل في كليهما).
 */
(function (g) {
  "use strict";

  var GATE = 'html[data-cml-rtl="v2"]';
  var PH = String.fromCharCode(1); // نائب داخلي — لا يرد في CSS سليم
  // مواضع القفز في المحلّل (عامّةٌ بـlastIndex يُضبط قبل كل exec — لا نداء يتداخل بين الضبط والتنفيذ)
  var READ_RE = /[\/"'\\()\[\]{};]/g;
  var BLOCK_RE = /[\/"'\\{}]/g;
  var STR_DQ_RE = /["\\]/g, STR_SQ_RE = /['\\]/g;
  var SPLIT_SEMI_RE = /[\\"'()\[\];]/g, SPLIT_COMMA_RE = /[\\"'()\[\],]/g;
  var BRACKET_RE = /[()\[\]]/;
  var IMPORTANT_RE = /!\s*important\s*$/i;

  // ---------- 1) محلّل CSS متدرّج ----------
  // يتحمل: التعليقات، السلاسل بمحارفها المهرَّبة، url() غير المقتبس، أقواس التداخل،
  // @media/@supports/@container (تُحفظ سياقًا)، @layer (يُنزَل فيه وتُحفظ رتبته)،
  // والتداخل الحديث (& يُستبدل بالأب). @keyframes/@font-face/@page/@property/
  // @counter-style تُتخطى كتلًا كاملة — الحركات أرضُ «المحسوب» فلا نمسّها.
  function parseCss(text) {
    var rules = [];        // {sel, decls:[{prop,value,important}], ctx:[..], layer, idx}
    var imports = [];      // روابط @import — يتبعها الطبيب مستوى واحدًا
    var layerOrder = [];   // أسماء الطبقات بترتيب أول ظهور/تصريح
    var layerSeen = {};
    var stats = { parseErrors: 0, skippedAt: 0, animatedPhysical: 0 };
    var customDecls = [];  // [[الاسم، القيمة]…] لكل خاصيةٍ مخصّصة بترتيبها، والفارغة بقيمة "" (انظر varTable)
    var i = 0, n = text.length;

    function noteLayer(name) {
      if (name && !layerSeen[name]) { layerSeen[name] = 1; layerOrder.push(name); }
    }
    /* ★ (S8-C، المراجعة العدائية، ٢٢ ربيع الآخر ١٤٤٨هـ) المسح يقفز إلى المحرف ذي الشأن التالي بتعبيرٍ نمطيٍّ أصيل
     * وينسخ ما بينهما قطعةً واحدة (slice) — لا نداءَ دالةٍ ولا إلحاقَ محرفٍ لكل محرف. ورقةُ الوثائق (881 ك.ب) كانت
     * تُبنى في عامل الخدمة 11.8–31 ث والمعالج مشغول، والمِلمَح جُلُّه في skipOpaque وreadUntil. والعلّة ليست مسارًا
     * تربيعيًّا بل كثرةُ العمل لكل محرف: عمليةُ الإضافة في الخلفية بأولويةٍ منخفضة، فلا ينال خيطُ العامل والجهازُ
     * مشغولٌ إلا عُشرَ نواةٍ أو أقل (قِيس بالتتبّع: 0.48 ث من زمن الخيط امتدّت 56 ث) — فالساعةُ تتبع العملَ مضروبًا.
     * والدلالة هي هي حرفًا بحرف (المخرجات بالبايت على أوراق المواقع كلها وعلى عشرين ألف مدخلٍ عشوائي). */
    // يقفز فوق سلسلةٍ تبدأ عند j (بمحارفها المهرَّبة)؛ غيرُ المغلقة تمتد إلى النهاية
    function skipString(j) {
      var re = text.charAt(j) === '"' ? STR_DQ_RE : STR_SQ_RE, m;
      re.lastIndex = j + 1;
      while ((m = re.exec(text))) {
        if (m[0] === "\\") { re.lastIndex = m.index + 2; continue; }
        return m.index + 1;
      }
      return n;
    }
    // يقفز فوق تعليقٍ يبدأ عند j؛ غيرُ المغلق يمتد إلى النهاية
    function skipComment(j) {
      var e = text.indexOf("*/", j + 2);
      return e === -1 ? n : e + 2;
    }
    // يجمع نصًّا حتى أول محرف فاصل في عمق أقواس صفر؛ يرجع {chunk, stop, next}.
    // التعليقات تُسقَط إسقاطًا (لا تُلحق) — وإلا التصقت بالمحدِّد الذي يليها.
    // (stopChars من «{;}» وحدها — والمحارف الأخرى ذات الشأن لا تكون فاصلًا)
    function readUntil(j, stopChars) {
      var depth = 0, out = "", m;
      while (j < n) {
        READ_RE.lastIndex = j;
        if (!(m = READ_RE.exec(text))) { out += text.slice(j); break; }
        var k = m.index, c = m[0];
        if (k > j) out += text.slice(j, k);
        if (c === "/") {
          if (text.charCodeAt(k + 1) === 42) { j = skipComment(k); continue; }
          out += c; j = k + 1; continue;
        }
        if (c === '"' || c === "'") { j = skipString(k); out += text.slice(k, j); continue; }
        if (c === "\\") { out += text.slice(k, k + 2); j = k + 2; continue; }
        // قوس إغلاق كتلة داخل عمق أقواس مفتوح = قيمة مكسورة (قوس دائري لم يُغلق).
        // بلا هذا التصفير كان قوسٌ واحد غير متوازن يبتلع بقية الورقة كلها بصمت —
        // فيعمى الطبيب عمًى لا يُبلَّغ عنه. (الفاصلة المنقوطة لا تُصفِّر: شرعية داخل
        // url(data:...;base64) غير المقتبسة.)
        if (c === "}" && depth > 0) { depth = 0; stats.parseErrors++; }
        if (c === "(" || c === "[") depth++;
        else if (c === ")" || c === "]") { if (depth > 0) depth--; }
        else if (depth === 0 && stopChars.indexOf(c) !== -1) return { chunk: out, stop: c, next: k + 1 };
        out += c; j = k + 1;
      }
      return { chunk: out, stop: "", next: n };
    }
    // يتخطى كتلة { ... } كاملة (القوس الفاتح استُهلك قبل النداء)
    function skipBlock(j) {
      var depth = 1, m;
      while (j < n && depth > 0) {
        BLOCK_RE.lastIndex = j;
        if (!(m = BLOCK_RE.exec(text))) return n;
        var k = m.index, c = m[0];
        if (c === "/") { j = text.charCodeAt(k + 1) === 42 ? skipComment(k) : k + 1; continue; }
        if (c === '"' || c === "'") { j = skipString(k); continue; }
        if (c === "\\") { j = k + 2; continue; }
        if (c === "{") depth++;
        else depth--;
        j = k + 1;
      }
      return j;
    }
    function splitTop(s, sep) {
      var re = sep === ";" ? SPLIT_SEMI_RE : SPLIT_COMMA_RE;
      var parts = [], depth = 0, start = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(s))) {
        var j = m.index, c = m[0];
        if (c === "\\") { re.lastIndex = j + 2; continue; }
        if (c === '"' || c === "'") {
          var e = j + 1;
          while (e < s.length && s[e] !== c) { if (s[e] === "\\") e++; e++; }
          re.lastIndex = e + 1; continue;
        }
        if (c === "(" || c === "[") depth++;
        else if (c === ")" || c === "]") depth--;
        else if (depth === 0) { parts.push(s.slice(start, j)); start = j + 1; } // c === sep
      }
      parts.push(s.slice(start));
      return parts;
    }
    function pushDecls(sel, body, ctx, layer) {
      var decls = [];
      var parts = splitTop(body, ";");
      for (var d = 0; d < parts.length; d++) {
        var t = parts[d].trim();
        if (!t) continue;
        // أولُ نقطتين في عمق صفر: هي أولاهما ما لم يسبقها قوس (الغالب) — وإلا العدُّ محرفًا محرفًا
        var colon = t.indexOf(":"), br = t.search(BRACKET_RE);
        if (colon !== -1 && br !== -1 && br < colon) {
          colon = -1;
          for (var j = 0, depth = 0; j < t.length; j++) {
            var c = t[j];
            if (c === "(" || c === "[") depth++;
            else if (c === ")" || c === "]") depth--;
            else if (c === ":" && depth === 0) { colon = j; break; }
          }
        }
        if (colon === -1) { stats.parseErrors++; continue; }
        var prop = t.slice(0, colon).trim();
        var value = t.slice(colon + 1).trim();
        var important = false;
        if (value.indexOf("!") !== -1 && IMPORTANT_RE.test(value)) { important = true; value = value.replace(IMPORTANT_RE, "").trim(); }
        // ★ (ر16-أ2) كلُّ تصريحٍ لخاصيةٍ مخصّصة يُسجَّل لجدول المتغيّرات (varTable) — والفارغُ منها خاصةً، فهو «متغيّر التبديل» الذي يكذّب عدَّ الأجزاء
        if (prop.slice(0, 2) === "--") customDecls.push([prop, value]);
        // «متغيّرات التبديل» (‎--x: ;‎ بقيمة فارغة) CSS صالحٌ محايد اتجاهيًّا — تُهمل بصمت
        if (!value && prop.slice(0, 2) === "--") continue;
        if (!prop || !value) { stats.parseErrors++; continue; }
        decls.push({ prop: prop.charAt(0) === "-" ? prop : prop.toLowerCase(), value: value, important: important });
      }
      if (decls.length) {
        rules.push({ sel: sel.replace(/\s+/g, " ").trim(), decls: decls, ctx: ctx, layer: layer, idx: rules.length });
      }
    }
    // محدِّد التداخل: يركَّب على الأب (استبدال & إن وُجد وإلا سليل)
    function nestSel(parentSel, childSel) {
      var parents = splitTop(parentSel, ",");
      var children = splitTop(childSel, ",");
      var out = [];
      for (var p = 0; p < parents.length; p++) {
        for (var c = 0; c < children.length; c++) {
          var ch = children[c].trim(), pa = parents[p].trim();
          // & المهرَّبة (\&) جزءٌ من اسم صنفٍ لا مرجعُ تداخل — كانت تُستبدل فتُنتج محدِّدًا هراءً
          var hasAmp = /(^|[^\\])&/.test(ch);
          out.push(hasAmp ? ch.replace(/(^|[^\\])&/g, function (m0, pre) { return pre + pa; }) : pa + " " + ch);
        }
      }
      return out.join(", ");
    }
    // بادئة @: يرجع {kind:"cond",ctx} أو {kind:"layer",name} أو {kind:"scope",start,end} أو null (تخطٍّ)
    function classifyAt(prelude) {
      if (/^@(media|supports|container)\b/i.test(prelude)) return { kind: "cond", cond: prelude.replace(/\s+/g, " ") };
      var ml = /^@layer\b\s*([^{]*)$/i.exec(prelude);
      if (ml) return { kind: "layer", name: (ml[1] || "").trim() || "(anonymous)" };
      return scopePrelude(prelude);
    }
    // ★ (ر5-ج، ٢٩ ربيع الآخر ١٤٤٨هـ — القرار 75) ‎@scope (S) to (E)‎ كانت تُتخطّى كتلةً كاملة، وفيها نثرُ التصميم (CDS) كلّه في وثائق
    // المنصّة وclaude.ai: ‎@scope(.prose) to (.not-prose,[data-not-prose]) { th,td{padding:.4375em .75em} … }‎ (131 قاعدةً في الوثائق و92 في
    // التطبيق، منطقيةٌ أو متناظرة كلها: حشوة الخلايا وحدود الجداول وشيفرة السطر وkbd وpre وdetails). فلم تُعَد لها نسخٌ مطابقة، فغلبتها نسخةُ
    // مُصفِّر Tailwind ‎:where(*){padding-inline:0;border-inline:0 solid}‎ في سلّمنا: فقدت خلايا الجداول حشوتها الأفقية في RTL (صنفا th/td
    // في فحص الاتجاه على 390). فتُسطَّح القواعد المحدودة إلى محدِّدٍ غير محدود بمعناها: الجذر ‎:where(S)‎ سلفًا ضمنيًّا (أو مكان ‎:scope‎
    // و‎&‎)، والحدّ ‎:not(:where(E), :where(E) *)‎ على الموضوع قبل العنصر الزائف — بلا تخصيصٍ زائد (المحدود يحمل تخصيص محدِّده وحده)،
    // فتمرّ في القلب والنسخ المطابقة بترتيب الموقع كسائر قواعده. والفرق الباقي قربُ النطاق (scope proximity) بعد التخصيص، ولا أثر له هنا.
    // ★ (ر5-ج، المراجعة المستقلة) والتسطيح أضيقُ من النطاق لا أوسع (قِيس في كروم): يستثني ما تحت E ولو كان E فوق الجذر أو بين جذرين
    // متداخلين، فيبقى ذلك على حاله قبل التسطيح. وما كان يوسّعه يُترك كما كان: جذرٌ أو حدٌّ فيه ‎:scope‎ أو ‎&‎ أو يبدأ بمركِّب (‎:scope‎ خارج
    // النطاق جذرُ المستند، والمحدِّد النسبي يبطل في ‎:where()‎ فيسقط الحدّ كلّه)، ومحدِّدٌ يبدأ بـ‎+‎ أو ‎~‎ (إخوةُ الجذر خارجه أبدًا)، أو فيه
    // ‎:scope‎ أو ‎&‎ في غير صدره (داخل ‎:not()‎ أو ‎:has()‎ مثلًا). ولا شيء من ذلك في أوراق المواقع اليوم
    var SCOPE_REF_RE = /:scope(?![\w-])|(^|[^\\])&/, SCOPE_REL_RE = /:scope(?![\w-])|(^|[^\\])&|(^|,)\s*[>+~]/;
    function scopePrelude(p) {
      var m = /^@scope\b\s*/i.exec(p);
      if (!m) return null;
      var k = m[0].length;
      function group(str, at) { // (…) متوازنٌ من الموضع at ⇒ {v, next} أو null
        if (str.charAt(at) !== "(") return null;
        for (var q = at, depth = 0; q < str.length; q++) {
          var c = str.charAt(q);
          if (c === "\\") { q++; continue; }
          if (c === "(") depth++;
          else if (c === ")" && --depth === 0) return { v: str.slice(at + 1, q).trim(), next: q + 1 };
        }
        return null;
      }
      var s = group(p, k);
      if (!s || !s.v) return null;
      var rest = p.slice(s.next).trim(), end = null;
      if (rest) {
        var t = /^to\s*/i.exec(rest);
        var e = t && group(rest, t[0].length);
        if (!e || !e.v || rest.slice(e.next).trim()) return null;
        end = e.v;
      }
      if (SCOPE_REL_RE.test(s.v) || (end !== null && SCOPE_REL_RE.test(end))) return null;
      return { kind: "scope", start: s.v, end: end };
    }
    var PSEUDO_EL_RE = /(?<!\\)(?:::|:(?:before|after|first-line|first-letter)(?![\w-]))/;
    function scopeSel(prelude, sc) {
      var root = ":where(" + sc.start + ")";
      var lim = sc.end ? ":not(:where(" + sc.end + "),:where(" + sc.end + ") *)" : "";
      var parts = splitTop(prelude, ","), out = [];
      for (var q = 0; q < parts.length; q++) {
        var s = parts[q].trim();
        if (!s) continue;
        var lead = /^(?::scope(?![\w-])|&)/.exec(s), body = lead ? s.slice(lead[0].length) : s;
        if (/^\s*[+~]/.test(body) || SCOPE_REF_RE.test(body)) continue; // يتّسع عن النطاق (أعلاه) ⇒ يُسقط
        s = lead ? root + body : root + " " + s;
        if (lim) { var pm = PSEUDO_EL_RE.exec(s); s = pm ? s.slice(0, pm.index) + lim + s.slice(pm.index) : s + lim; }
        out.push(s);
      }
      return out.join(", ");
    }
    // كتلة قاعدة: خليط إعلانات وقواعد متداخلة. depth: سقف تداخل وقائي — تداخل
    // بآلاف المستويات (مدخل عدائي) كان يفجّر مكدس الاستدعاء؛ فوق السقف تُتخطى الكتلة.
    function parseRuleBody(j, sel, ctx, layer, depth) {
      if (depth > 100) { stats.parseErrors++; return skipBlock(j); }
      var declText = "";
      while (j < n) {
        var r = readUntil(j, "{;}");
        if (r.stop === "{") {
          var prelude = r.chunk.trim();
          // قيمة كتلية لخاصية مخصصة (--x: {...}) — CSS صالح؛ كانت تُقرأ قاعدةً
          // متداخلة وهمية بمحدِّد هراء فيبلغ الطبيب عنها كذبًا. تُتخطى قيمتها كلها.
          if (/^--/.test(prelude)) { j = skipBlock(r.next); continue; }
          // ★ (ر24-ب2، ١٢ جمادى الأولى ١٤٤٨هـ — مراجعة Codex CX-006) الإعلانات السابقة لقاعدةٍ متداخلة تُدفع قبلها: كانت تتراكم حتى قوس
          // الإغلاق وتُدفع بعد القواعد المتداخلة كلها، فتأخذ موضعًا بعدها فتغلبها عند تساوي التخصيص المسطَّح — ‎.probe{margin-left:10px;
          // @media(…){margin-left:20px}}‎ كان يصير 10px والأصل 20px. وما بعد القاعدة المتداخلة قاعدةٌ مستقلةٌ بعدها بمحدِّد الأب نفسه، كما يرتّبها
          // المتصفح (الإعلانات المتداخلة بعد القاعدة). والحكم واحدٌ في قواعد @ المتداخلة وقواعد &
          if (declText) { pushDecls(sel, declText, ctx, layer); declText = ""; }
          if (prelude.charAt(0) === "@") {
            var at = classifyAt(prelude);
            if (at && at.kind === "cond") j = parseRuleBody(r.next, sel, ctx.concat([at.cond]), layer, depth + 1);
            else if (at && at.kind === "layer") { noteLayer(at.name); j = parseRuleBody(r.next, sel, ctx, at.name, depth + 1);
            } else { j = skipAtBlock(prelude, r.next); }
          } else {
            j = parseRuleBody(r.next, nestSel(sel, prelude), ctx, layer, depth + 1);
          }
        } else if (r.stop === ";") {
          declText += r.chunk + ";";
          j = r.next;
        } else { // "}" أو نهاية النص
          declText += r.chunk;
          j = r.next;
          break;
        }
      }
      pushDecls(sel, declText, ctx, layer);
      return j;
    }
    // تخطي كتلة @ غير مدعومة، مع إحصاء الحركات الاتجاهية: @keyframes فيها إزاحات
    // سينية لا نقلبها بقرار (أرض المحسوب) — لكن الصمت عنها يكسر عقد «كل فيزيائيٍّ
    // إمّا مقلوب وإمّا مُصرَّحٌ بعجزه»، فتُعدّ ويُبلّغ الطبيب عددها.
    function skipAtBlock(prelude, j) {
      var start = j;
      var end = skipBlock(j);
      stats.skippedAt++;
      if (/^@(?:(?:-webkit-)?keyframes|starting-style)/i.test(prelude) &&
          /translatex\s*\(|translate3d\s*\(|translate\s*\(|[^-\w](left|right)\s*:/i.test(text.slice(start, end))) {
        stats.animatedPhysical++;
      }
      return end;
    }
    function parseGroup(j, ctx, layer, depth, scope) {
      // يستهلك محتوى كتلة (أو المستوى الأعلى) حتى قوس إغلاقها. scope: نطاق ‎@scope‎ المحيط (قواعده تُسطَّح بـscopeSel)
      if (depth > 100) { stats.parseErrors++; return skipBlock(j); }
      while (j < n) {
        var r = readUntil(j, "{;}");
        if (r.stop === "{") {
          var prelude = r.chunk.trim();
          if (!prelude) { j = skipBlock(r.next); continue; }
          if (prelude.charAt(0) === "@") {
            var at = classifyAt(prelude);
            if (at && at.kind === "cond") j = parseGroup(r.next, ctx.concat([at.cond]), layer, depth + 1, scope);
            else if (at && at.kind === "layer") { noteLayer(at.name); j = parseGroup(r.next, ctx, at.name, depth + 1, scope);
            } else if (at && at.kind === "scope" && !scope) { stats.scoped = (stats.scoped || 0) + 1; j = parseGroup(r.next, ctx, layer, depth + 1, at);
            } else { j = skipAtBlock(prelude, r.next); } // ومنها ‎@scope‎ داخل ‎@scope‎ (نادرة): تُتخطّى كما كانت
          } else {
            var ssel = scope ? scopeSel(prelude, scope) : prelude;
            j = ssel ? parseRuleBody(r.next, ssel, ctx, layer, depth + 1) : skipBlock(r.next);
          }
        } else if (r.stop === ";") {
          var st = r.chunk.trim();
          var mi = /^@import\s+(?:url\(\s*)?["']?([^"')\s]+)/i.exec(st);
          if (mi) imports.push(mi[1]);
          var ls = /^@layer\b\s+([^;{]+)$/i.exec(st);
          if (ls) {
            var names = ls[1].split(",");
            for (var q = 0; q < names.length; q++) noteLayer(names[q].trim());
          }
          j = r.next;
        } else if (r.stop === "}") {
          return r.next; // نهاية الكتلة — ارجع للأب
        } else {
          return n;
        }
      }
      return j;
    }
    var pos = 0;
    while (pos < n) {
      var before = pos;
      pos = parseGroup(pos, [], null, 0); // قوس إغلاق شارد بالمستوى الأعلى يعيدنا هنا فنكمل
      if (pos <= before) break;           // وقاية من الدوران
    }
    return { rules: rules, imports: imports, layerOrder: layerOrder, stats: stats, vars: customDecls };
  }

  // ---------- 2) جداول القلب ----------
  var SIDE_LOGICAL = {
    "margin-left": "margin-inline-start", "margin-right": "margin-inline-end",
    "padding-left": "padding-inline-start", "padding-right": "padding-inline-end",
    "left": "inset-inline-start", "right": "inset-inline-end",
    "border-left": "border-inline-start", "border-right": "border-inline-end",
    "border-left-width": "border-inline-start-width", "border-right-width": "border-inline-end-width",
    "border-left-style": "border-inline-start-style", "border-right-style": "border-inline-end-style",
    "border-left-color": "border-inline-start-color", "border-right-color": "border-inline-end-color",
    "border-top-left-radius": "border-start-start-radius",
    "border-top-right-radius": "border-start-end-radius",
    "border-bottom-left-radius": "border-end-start-radius",
    "border-bottom-right-radius": "border-end-end-radius",
    "scroll-margin-left": "scroll-margin-inline-start", "scroll-margin-right": "scroll-margin-inline-end",
    "scroll-padding-left": "scroll-padding-inline-start", "scroll-padding-right": "scroll-padding-inline-end",
  };
  // الزوايا لا يكفي فيها المنطقي وحده: الإعلان الفيزيائي الأصلي يبقى فعّالًا على
  // زاويته فتستدير الزاويتان معًا — فلها مُصفِّر كبقية الجوانب (unset = القيمة البدئية).
  var SHORTHAND4 = {
    "margin": ["margin-top", "margin-inline-end", "margin-bottom", "margin-inline-start"],
    "padding": ["padding-top", "padding-inline-end", "padding-bottom", "padding-inline-start"],
    "inset": ["inset-block-start", "inset-inline-end", "inset-block-end", "inset-inline-start"],
    "border-width": ["border-top-width", "border-inline-end-width", "border-bottom-width", "border-inline-start-width"],
    "border-style": ["border-top-style", "border-inline-end-style", "border-bottom-style", "border-inline-start-style"],
    "border-color": ["border-top-color", "border-inline-end-color", "border-bottom-color", "border-inline-start-color"],
    "scroll-margin": ["scroll-margin-top", "scroll-margin-inline-end", "scroll-margin-bottom", "scroll-margin-inline-start"],
    "scroll-padding": ["scroll-padding-top", "scroll-padding-inline-end", "scroll-padding-bottom", "scroll-padding-inline-start"],
  };
  var ALREADY_LOGICAL = /^(margin|padding|inset|border|scroll-margin|scroll-padding)-(inline|block)|^border-(start|end)-(start|end)-radius/;

  /* ★ (ر16-أ2، ٦ جمادى الأولى ١٤٤٨هـ) أجزاء القيمة في العمق صفر: تفصلها المسافات (وأخواتها في CSS: السطر والجدولة)
   * **وقوسُ الإغلاق** العائد إلى العمق صفر إذا التصق به ما بعده. المُصغِّر يكتب ‎padding:var(--sp-8)var(--sp-12)‎ بلا مسافةٍ
   * بعد القوس، وهما في CSS مكوِّنان (القوس يُنهي الدالة)؛ وكانت القسمة على المسافات وحدها تعدّهما جزءًا واحدًا «متناظرًا»
   * فتنسخ القيمة كلها في ‎padding-inline‎ — فيقرأ المتصفح بدايةً 8 ونهايةً 12 بدل 12 و12، وتبطل الثلاث والأربع الملتصقة عند
   * الحوسبة فتصير الحشوة صفرًا (220 إعلانًا في ورقة claude.com، و3 في أزرار لافتة الموافقة في code.claude.com).
   * ولا تُقسم بعد القوس إن تلاه فاصلٌ له شأنه («,» أو «/» أو قوسٌ آخر). والسلاسل المقتبسة قطعةٌ واحدة لا يُعدّ ما فيها. */
  function splitVals(v) {
    var parts = [], depth = 0, cur = "";
    for (var j = 0; j < v.length; j++) {
      var c = v[j];
      if (c === '"' || c === "'") { // سلسلة: قطعةٌ واحدة بمحارفها المهرَّبة
        var e = j + 1;
        while (e < v.length && v[e] !== c) { if (v[e] === "\\") e++; e++; }
        cur += v.slice(j, e + 1); j = e; continue;
      }
      if (c === "\\") { cur += v.slice(j, j + 2); j++; continue; }
      if (c === "(") depth++;
      else if (c === ")") depth--;
      if (depth === 0 && WS_RE.test(c)) { if (cur) { parts.push(cur); cur = ""; } }
      else {
        cur += c;
        if (c === ")" && depth === 0 && j + 1 < v.length && !GLUE_STOP_RE.test(v.charAt(j + 1))) { parts.push(cur); cur = ""; }
      }
    }
    if (cur) parts.push(cur);
    return parts;
  }
  var WS_RE = /[ \t\n\r\f]/, GLUE_STOP_RE = /[ \t\n\r\f,\/)]/;
  /* ★ (ر16-أ2) جدول المتغيّرات: «متغيّر التبديل» (var عارية قيمتُها بياض، كـ‎--_prose-noscope: ;‎ في claude.ai، أو احتياطٌ فارغ
   * ‎var(--tw-rotate-x, )‎ في تايلويند) يجعل عدَّ أجزاء المختصر كاذبًا، فكانت كلُّ var عارية في مختصرٍ ذي جزأين فأكثر تُصنَّف
   * «متعذّرة» فلا تُقلب ولا تُنسخ — ومصفِّراتُ القواعد الأخرى على العنصر نفسه تمحوها (روابط القوائم 12/12 ← 0/0 في claude.com).
   * والأمان يُعرف من مجموعة الأوراق نفسها التي يقلبها المولِّد (اللقطة وقت البناء، وأوراق الصفحة في الورقة الحيّة): المتغيّرُ جزءٌ
   * واحدٌ إذا كان **كلُّ** تصريحٍ له في المجموعة مكوِّنًا واحدًا غيرَ فارغ (ولا كلمةً عامّةً كـinitial)، وكان احتياطُه — إن وُجد —
   * مكوِّنًا واحدًا كذلك؛ وغيرُ المصرَّح به جزءٌ واحدٌ بشرط احتياطٍ من مكوِّنٍ واحد. وما سوى ذلك (فارغٌ في موضعٍ ما، أو متعدّد،
   * أو مجهولٌ بلا احتياط) يبقى على حماية التبديل كما كان. والقيمة التي هي نفسها var() تُحلّ بالقاعدة ذاتها (والدَّور = غير آمن).
   * حدُّه المعروف: متغيّرٌ تكتبه جافاسكربت أو سمةُ style بقيمةٍ متعددة الأجزاء مع تصريحٍ مفرد في الأوراق — لا يُرى من الأوراق. */
  var CSS_WIDE_RE = /^(?:initial|inherit|unset|revert|revert-layer)$/i;
  function varTable(lists) {
    var decl = new Map();
    for (var a = 0; a < (lists || []).length; a++) {
      var L = lists[a] || [];
      for (var b = 0; b < L.length; b++) {
        var nm = L[b][0], val = String(L[b][1] || "").trim();
        var set = decl.get(nm);
        if (!set) { set = new Set(); decl.set(nm, set); }
        set.add(val);
      }
    }
    var memo = new Map();
    function state(nm) { // "one" | "none" (غير مصرَّح) | "bad"
      var s = memo.get(nm);
      if (s !== undefined) return s;
      var set = decl.get(nm);
      if (!set) { memo.set(nm, "none"); return "none"; }
      memo.set(nm, "bad"); // حارس الدَّور
      s = "one";
      set.forEach(function (val) { if (s === "one" && !oneTok(val)) s = "bad"; });
      memo.set(nm, s);
      return s;
    }
    function oneTok(val) {
      if (!val) return false;
      var p = splitVals(val);
      if (p.length !== 1 || CSS_WIDE_RE.test(p[0])) return false;
      return isVarPart(p[0]) ? onePart(p[0]) : true;
    }
    function onePart(part) {
      var inner = part.slice(part.indexOf("(") + 1, -1);
      var args = splitTopComma(inner), nm = args[0].trim();
      var fb = args.length > 1 ? args.slice(1).join(",").trim() : null;
      var fbOk = fb === null ? null : oneTok(fb);
      var st = state(nm);
      if (st === "one") return fb === null || fbOk;
      if (st === "none") return fbOk === true;
      return false;
    }
    return { one: function (part) { return isVarPart(part) && onePart(part); }, size: decl.size };
  }
  // جزءٌ هو var() عارية كاملة: يبدأ بها ويُغلَق قوسُها في آخره (‎var(--a)px‎ أو ‎var(--a),b‎ ليسا كذلك)
  function isVarPart(x) {
    if (!/^var\(/i.test(x) || x.charAt(x.length - 1) !== ")") return false;
    for (var j = 4, d = 1; j < x.length; j++) {
      var c = x.charAt(j);
      if (c === "(") d++;
      else if (c === ")") { d--; if (d === 0) return j === x.length - 1; }
    }
    return false;
  }
  // كلُّ أجزاء var العارية آمنةٌ بالجدول؟ (بلا جدولٍ: لا — فيبقى السلوك القديم)
  function varsCounted(parts, vars) {
    if (!vars) return false;
    for (var j = 0; j < parts.length; j++) if (/^var\(/i.test(parts[j]) && !vars.one(parts[j])) return false;
    return true;
  }
  function expand4(parts) {
    if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
    if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
    if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]];
    if (parts.length === 4) return parts;
    return null;
  }
  var ZERO_RE = /^-?0(\.0+)?([a-z%]+)?$/i;
  var SIMPLE_LEN_RE = /^-?(\d*\.)?\d+([a-z%]+)?$/i;
  function isZero(v) { return v === "0" || ZERO_RE.test(v); }
  // قلب قيمة سينية: البسيطة بقلب الإشارة، والحسابية بلفّها في calc(v * -1).
  // var() العارية تُستثنى عمدًا: قد تكون «متغيّر تبديل» قيمتُه مسافة (كما في
  // ‎--_prose-noscope بموقعنا) — وcalc(مسافة * -1) يُبطل الإعلان كله عند الحوسبة.
  // استثناء الاستثناء: var(--spacing) وحدة تايلويند v4 المسجّلة طولًا حكمًا —
  // بياضُها مستحيل، فلفُّها آمن (بدونها بقيت ‎.translate-x-1‎ وحدها بلا قلب).
  function flipX(v) {
    if (isZero(v)) return v;
    if (SIMPLE_LEN_RE.test(v)) return v.charAt(0) === "-" ? v.slice(1) : "-" + v;
    if (/^(calc|min|max|clamp)\(/i.test(v) || /^var\(--spacing\)$/i.test(v)) return "calc(" + v + " * -1)";
    return null; // var() عارية أو كلمة مفتاحية أو ما لا نفهمه — لا قلب أعمى
  }
  var XVAR_RE = /translate-x/i; // متغيّرات الإزاحة السينية (تايلويند وأشباهه)
  function flipTransform(value) {
    // يقلب المعامل السيني لـ translateX/translate/translate3d باستخراج أقواس متوازن.
    // معاملٌ يمرّر متغيّر إزاحة سينية يُترك — قلبُ تصريح المتغيّر يغطيه (لا قلب مزدوج).
    var out = "", j = 0, changed = true, touched = false;
    var re = /(translateX|translate3d|translate)\(/gi;
    var m;
    while ((m = re.exec(value))) {
      var start = m.index, open = re.lastIndex; // بعد القوس الفاتح
      var depth = 1, k = open;
      while (k < value.length && depth > 0) {
        if (value[k] === "(") depth++;
        else if (value[k] === ")") depth--;
        k++;
      }
      if (depth !== 0) return null; // أقواس مكسورة
      var inner = value.slice(open, k - 1);
      var args = splitTop2(inner, ",");
      var x = args[0].trim();
      var fx;
      if (XVAR_RE.test(x)) fx = x;          // متغيّر إزاحة — قلبه عند تصريحه
      else {
        fx = flipX(x);
        if (fx === null) return null;       // معامل لا نفهمه ⇒ لا نمسّ التحويل كله
        if (fx !== x) touched = true;
      }
      args[0] = fx;
      out += value.slice(j, start) + m[1] + "(" + args.join(",") + ")";
      j = k;
      re.lastIndex = k;
    }
    if (j === 0) return null;   // لا translate فيه
    out += value.slice(j);
    // قلبُ الإزاحة وحدها في سلسلة فيها دوران/إمالة يعطي شكلًا ليس الأصلَ ولا مرآتَه
    // (الدوران غير التبديلي) — حالة sheet-card-under الحقيقية. نمتنع فيُصرّح الطبيب.
    if (touched && /rotate|skew/i.test(value)) return null;
    return touched ? out : PH;  // PH = فيه translate لكن عبر متغيّرات فقط (مغطًّى)
    function splitTop2(s, sep) {
      var parts = [], depth = 0, cur = "";
      for (var q = 0; q < s.length; q++) {
        var c = s[q];
        if (c === "(") depth++;
        else if (c === ")") depth--;
        if (c === sep && depth === 0) { parts.push(cur); cur = ""; }
        else cur += c;
      }
      parts.push(cur);
      return parts;
    }
  }
  function splitTopComma(v) {
    // فصل على الفواصل في العمق صفر (فواصل rgba() وvar() محمية)
    var parts = [], depth = 0, cur = "";
    for (var j = 0; j < v.length; j++) {
      var c = v[j];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      if (c === "," && depth === 0) { parts.push(cur); cur = ""; }
      else cur += c;
    }
    parts.push(cur);
    return parts;
  }
  function maskCalls(value, name, store) {
    // يحجب نداءات دالة (بأقواس متوازنة — فواصل var() الاحتياطية قد تحوي أقواسًا)
    var out = "", j = 0;
    var re = new RegExp(name + "\\(", "gi");
    var m;
    while ((m = re.exec(value))) {
      var k = re.lastIndex, depth = 1;
      while (k < value.length && depth > 0) {
        if (value[k] === "(") depth++;
        else if (value[k] === ")") depth--;
        k++;
      }
      store.push(value.slice(m.index, k));
      out += value.slice(j, m.index) + PH + (store.length - 1) + PH;
      j = k;
      re.lastIndex = k;
    }
    return out + value.slice(j);
  }
  function swapWords(value) {
    // left↔right ككلمات كاملة — للخلفيات والتدرجات ومواضع الأصل. url() وvar()
    // تُحجبان أولًا: كلمة left داخل اسم متغيّر (var(--edge-left)) ليست اتجاهًا،
    // وقلبُها ينتج مرجعًا لمتغيّر لا وجود له فيُبطل الإعلان كله.
    var masked = [];
    var t = maskCalls(maskCalls(value, "url", masked), "var", masked);
    var swapped = t.replace(/\bleft\b|\bright\b/gi, function (w) {
      return w.toLowerCase() === "left" ? "right" : "left";
    });
    if (swapped === t) return null;
    return swapped.replace(new RegExp(PH + "(\\d+)" + PH, "g"), function (_, k) { return masked[+k]; });
  }
  function shadowHasX(value) {
    // ظلّ بإزاحة أفقية غير صفرية؟ لكل ظلّ (فواصل العمق صفر): أول طولٍ هو x
    var shadows = splitTopComma(value);
    for (var s = 0; s < shadows.length; s++) {
      var toks = splitVals(shadows[s].trim());
      for (var t = 0; t < toks.length; t++) {
        if (SIMPLE_LEN_RE.test(toks[t])) {
          if (!isZero(toks[t])) return true;
          break; // x صفر — انتقل للظل التالي
        }
      }
    }
    return false;
  }

  /* ★ (ر30-ب، ١٣ جمادى الأولى ١٤٤٨هـ — القرار 124، ثغرات ملف «فحص الاتجاه» عند المالك: 23 تدرّجًا بزاوية في claude.ai) زاوية التدرّج الخطي.
   * المصغِّر يكتب ‎to right‎ زاويةً (90deg) و‎to left‎ (270deg)، فكانت كل زاويةٍ غير رأسية عجزًا يصرّح به الطبيب. ومرآة التدرّج الخطي حول المحور
   * الرأسي هي عكس زاويته: θ ↦ 360−θ (والدورة 1turn و400grad و2π rad) — 90 ↦ 270، و105 ↦ 255، و45 ↦ 315، والرأسيّ (0 و180) على حاله. فيُقلب
   * كلُّ ‎linear-gradient‎ و‎repeating-linear-gradient‎ في القيمة بزاويته، والمكتوبُ بكلمات الجهة تقلبه swapWords كما كان. ويبقى عجزًا:
   *   - الصيغة القديمة ذات البادئة (‎-webkit-linear-gradient(<زاوية>)‎ زاويتها من الشرق عكس عقارب الساعة)، والمخروطي بزاوية (‎conic-gradient(from …)‎:
   *     مرآته عكسُ ترتيب محطّاته لا زاويته وحدها)؛
   *   - وخاصيةٌ غير الخلفية والقناع (‎border-image‎ وأمثالها)، ومختصر الخلفية أو القناع إذا كان فيه موضعٌ أو مقاسٌ عددي خارج الدوالّ (يُقلب مع
   *     الزاوية موضعه أيضًا، ولا نعرف أيّ أعداده السيني).
   * والحارسان قبله كما هما: القاعدة المشروطة بـRTL لا تُقلب (فتغلب نسختها في المستوى الرابع)، والقيمة التي تقرأ متغيّرًا يبدّله الموقع تحت RTL تُترك. */
  var ANGLE_FULL = { deg: 360, grad: 400, rad: 2 * Math.PI, turn: 1 };
  var ANGLE_TOK_RE = /^(-?(?:\d*\.)?\d+)(deg|grad|rad|turn)$/i;
  function mirrorAngle(tok) {
    var m = ANGLE_TOK_RE.exec(tok);
    if (!m) return null;
    var full = ANGLE_FULL[m[2].toLowerCase()], v = parseFloat(m[1]);
    var r = ((full - v) % full + full) % full, v0 = ((v % full) + full) % full;
    if (Math.abs(r - v0) < 1e-6 || Math.abs(Math.abs(r - v0) - full) < 1e-6) return tok; // رأسيّ: مرآته هو
    return String(+r.toFixed(4)) + m[2];
  }
  var GRAD_CALL_RE = /(-webkit-|-moz-|-o-)?(repeating-)?(linear|radial|conic)-gradient\(/gi;
  /* ★ (ر30-ب2 — مراجعة ر30-ب، O4) طبقةٌ شعاعية أو مخروطية موضعُها السيني عدديٌّ غير موسَّط (‎radial-gradient(circle at 20% 30%, …)‎ و‎at 8px 0‎
   * و‎at calc(…) 50%‎) لا تنعكس بعكس زاوية جارتها الخطية: فعكسُ الزاوية وحدها يقلب نصف القيمة ويترك نصفها. فالقيمة كلها عجزٌ (gradient-angle) كما
   * كانت قبل ر30-ب. والموسَّط (‎at center‎ و‎at 50% 0‎ و‎at top‎) مرآةُ نفسه، وكلمة الحافّة (‎at left top‎ و‎at right 10px top 20%‎) تقلبها swapWords
   * مع الزاوية فتنعكس. ولا أثر لهذا في قيمةٍ لا تُعكس فيها زاويةٌ خطية (تبقى كما كانت). */
  function gradPositioned(first) {
    var at = /(?:^|\s)at\s+([\s\S]+)$/i.exec(first);
    if (!at) return false;
    var pos = splitVals(at[1].trim());
    if (pos.length > 2) return false; // حافّةٌ بإزاحة (‎left 10px top 20%‎): الكلمة تنقلب بإزاحتها
    var x = /^(?:top|bottom)$/i.test(pos[0] || "") ? (pos[1] || "center") : (pos[0] || "center");
    if (/^(?:left|right|center)$/i.test(x)) return false;
    return !/^50%$/.test(x);
  }
  // القيمة بزوايا تدرّجاتها الخطية معكوسة ⇒ {value, changed}؛ أو null إن كان فيها ما لا يُعكس بزاويته (البادئة القديمة، والمخروطي بزاوية،
  // وطبقةٌ شعاعية أو مخروطية بموضعٍ غير موسَّط إلى جانب زاويةٍ تُعكس)
  function flipGradients(value) {
    var out = "", j = 0, changed = false, positioned = false, m;
    GRAD_CALL_RE.lastIndex = 0;
    while ((m = GRAD_CALL_RE.exec(value))) {
      var open = GRAD_CALL_RE.lastIndex, depth = 1, k = open;
      while (k < value.length && depth > 0) { if (value[k] === "(") depth++; else if (value[k] === ")") depth--; k++; }
      if (depth !== 0) return null;
      var kind = m[3].toLowerCase(), inner = value.slice(open, k - 1);
      var args = splitTopComma(inner), lead = args[0].match(/^\s*/)[0], first = args[0].trim();
      if (kind === "linear") {
        var toks = splitVals(first);
        var a = toks.length ? mirrorAngle(toks[0]) : null;
        if (a !== null && a !== toks[0]) {
          if (m[1]) return null; // الصيغة القديمة: زاويتها من الشرق عكس عقارب الساعة
          toks[0] = a; args[0] = lead + toks.join(" ");
          out += value.slice(j, open) + args.join(",") + ")";
          j = k; changed = true;
        }
      } else if (kind === "conic" && /(?:^|\s)from\s/i.test(first) && /\d(?:deg|grad|rad|turn)\b/i.test(first)) {
        return null;
      } else if (gradPositioned(first)) {
        positioned = true; // ★ (ر30-ب2، O4) لا يُحكم إلا بعد معرفة أن في القيمة زاويةً تُعكس
      }
      GRAD_CALL_RE.lastIndex = k;
    }
    if (positioned && changed) return null;
    return { value: changed ? out + value.slice(j) : value, changed: changed };
  }
  var GRAD_PROP_RE = /^(?:background|background-image|(?:-webkit-)?mask|(?:-webkit-)?mask-image)$/;
  var GRAD_SHORT_RE = /^(?:background|(?:-webkit-)?mask)$/;
  var ANGLED_GRAD_RE = /(?:linear|conic)-gradient\(\s*-?(?:\d*\.)?\d+(?:deg|grad|rad|turn)/i;
  // تدرّجٌ بزاوية: {kind:"flip"…} بعكس زواياه، أو عجزٌ (gradient-angle)، أو null إن لم يكن فيه زاويةٌ غير رأسية
  function gradientDecl(prop, v) {
    if (!ANGLED_GRAD_RE.test(v)) return null;
    var fg = flipGradients(v);
    if (fg === null) return { kind: "physical-unflippable", reason: "gradient-angle" };
    if (!fg.changed) return null; // زواياه رأسية كلها
    if (!GRAD_PROP_RE.test(prop)) return { kind: "physical-unflippable", reason: "gradient-angle" };
    if (GRAD_SHORT_RE.test(prop)) {
      var rest = maskCalls(fg.value, "[a-z-]+", []); // ما خارج الدوالّ: موضعٌ أو مقاسٌ عددي؟
      if (/\d/.test(rest.replace(new RegExp(PH + "\\d+" + PH, "g"), "").replace(/#[0-9a-f]{3,8}\b/gi, ""))) return { kind: "physical-unflippable", reason: "gradient-angle" }; // (اللون السداسي ليس موضعًا)
    }
    var sw = swapWords(fg.value);
    return { kind: "flip", flips: [{ prop: prop, value: sw !== null ? sw : fg.value }], neutral: [], grad: true };
  }
  /* ★ (مراجعة ر30-ب) موضعُ البلاطة في القاعدة نفسها. عكسُ الزاوية يعكس الصورة داخل بلاطتها، فلا يكون مرآةً إلا إذا انعكس موضع البلاطة معها:
   * ‎.filter-selector{background-image:linear-gradient(45deg,…),linear-gradient(135deg,…);background-position:calc(100% - 17px) 50%,calc(100% - 12px) 50%}‎
   * يرسم سهم القائمة بمثلّثين متجاورين، فعكسُ زاويتيهما وموضعاهما على حالهما يفكّ السهم إلى أذنين. فإن كان في القاعدة موضعٌ للعائلة نفسها (الخلفية أو
   * القناع) لا نقلبه وليس وسطًا في كل طبقاته، بقي التدرّج على حاله عجزًا (gradient-angle) كما كان قبل ر30-ب؛ وما لا موضع له (البلاطة الصندوقُ كلّه)
   * أو موضعُه مقلوبٌ معه أو وسطٌ يُعكس. يستعمله المولّد والورقة الحيّة (buildLiveSheet) والطبيب (engine.js) فيتّفقون. */
  var GRAD_POS_RE = { bg: /^background-position(?:-x)?$/, mask: /^(?:-webkit-)?mask-position(?:-x)?$/ };
  function gradPlacementKept(decls, d, vars) {
    var re = /mask/.test(decls[d].prop) ? GRAD_POS_RE.mask : GRAD_POS_RE.bg;
    for (var i = 0; i < decls.length; i++) {
      if (i === d || !re.test(decls[i].prop)) continue;
      var a = analyzeDecl(decls[i].prop, decls[i].value, vars);
      if (a && a.kind === "flip") continue;
      var layers = splitTopComma(String(decls[i].value));
      for (var l = 0; l < layers.length; l++) {
        var x = splitVals(layers[l].trim())[0] || "";
        if (!/^(?:center|50%)$/i.test(x)) return true;
      }
    }
    return false;
  }
  var GRAD_KEPT = { kind: "physical-unflippable", reason: "gradient-angle" };

  /* تحليل إعلان واحد. يرجع أحد:
   *  {kind:"flip", flips:[{prop,value}...], neutral:[{prop,value}...]}  — يُقلب
   *  {kind:"physical-unflippable", reason}  — فيزيائي لكن لا نقلبه (يُصرّح به الطبيب)
   *  {kind:"logical"}   — منطقي/واعٍ بالاتجاه أصلًا (يُحصى بِشارةَ صحةٍ للموقع)
   *  null               — لا علاقة له بالاتجاه
   * تعريف «الفيزيائي» عند الطبيب = kind يبدأ بـ flip أو physical.
   * vars (اختياري، ر16-أ2): جدول varTable من مجموعة الأوراق نفسها — به تُعدّ var العارية الآمنة في المختصرات جزءًا واحدًا؛
   * وبلا جدولٍ (الطبيب) يبقى المختصر ذو var العارية على حماية التبديل كما كان. */
  function analyzeDecl(prop, value, vars) {
    var v = value;
    if (prop.charAt(0) === "-" && prop.charAt(1) === "-") {
      // خصائص مخصصة: لا نقلب إلا متغيّر الإزاحة السينية (تايلويند يمرّر كل إزاحات
      // translate عبره — قلبُ التصريح يقلبها جميعًا، والسطريّ المحسوب لا يمرّ به أصلًا)
      if (XVAR_RE.test(prop)) {
        var fx = flipX(v);
        if (fx !== null && fx !== v) return { kind: "flip", flips: [{ prop: prop, value: fx }], neutral: [] };
        if (fx === null) return { kind: "physical-unflippable", reason: "var-translate-keyword" };
      }
      return null;
    }
    if (ALREADY_LOGICAL.test(prop)) return { kind: "logical" };

    var side = SIDE_LOGICAL[prop];
    if (side) {
      return { kind: "flip", flips: [{ prop: side, value: v }], neutral: [{ prop: prop, value: "unset" }] };
    }
    if (SHORTHAND4[prop] !== undefined) {
      var parts = splitVals(v);
      var e4 = expand4(parts);
      if (!e4) return { kind: "physical-unflippable", reason: "shorthand-odd" };
      // «متغيّر تبديل» بين القيم (var عارية قد تكون بياضًا) يجعل عدّ الأجزاء نفسه
      // كاذبًا — فالتفكيك إلى خانات يُنتج زوايا/جوانب خاطئة (حالة prose الحقيقية).
      // ★ (ر16-أ2) إلا أن يشهد جدولُ المتغيّرات أن كلَّ var عارية فيه مكوِّنٌ واحدٌ أبدًا: فالعدُّ صادق، فيُقلب أو يُنسخ كغيره
      if (parts.some(function (x) { return /^var\(/i.test(x); }) && !varsCounted(parts, vars)) {
        return e4[1] === e4[3] && parts.length < 2 ? null : { kind: "physical-unflippable", reason: "shorthand-var-toggle" };
      }
      if (e4[1] === e4[3]) return null; // متناظر — لا شأن للاتجاه به
      var slots = SHORTHAND4[prop];
      // ★ (فحص الاتجاه الشامل، ق١) الخانتان الأفقيتان وحدهما: العمودية لا يغيّرها الاتجاه، وبثُّها بتخصيصنا
      // العالي كان يغلب أدوات الموقع العمودية على العنصر نفسه (‎.mt-8‎ و‎.border-b‎ و‎.py-1‎) فيمحوها. والمختصر
      // الأصلي باقٍ في طبقة الموقع بخاناته العمودية، وأفقيّتاه تغلبهما منطقيّتانا هنا
      return { kind: "flip", flips: [
        { prop: slots[1], value: e4[1] }, { prop: slots[3], value: e4[3] },
      ], neutral: [] };
    }
    if (prop === "border-radius") {
      // الفاصل البيضاوي «/» يُعتدّ به في العمق صفر فقط — القسمة داخل calc() ليست
      // بيضاوية (ست قواعد حقيقية بالموقع صُنّفت متعذّرة كذبًا قبل هذا التمييز)
      var sd = 0, ell = false;
      for (var si = 0; si < v.length; si++) {
        if (v[si] === "(") sd++;
        else if (v[si] === ")") sd--;
        else if (v[si] === "/" && sd === 0) { ell = true; break; }
      }
      if (ell) return { kind: "physical-unflippable", reason: "radius-elliptical" };
      var rparts = splitVals(v);
      var rp = expand4(rparts);
      if (!rp) return { kind: "physical-unflippable", reason: "radius-odd" };
      if (rparts.length > 1 && rparts.some(function (x) { return /^var\(/i.test(x); }) && !varsCounted(rparts, vars)) {
        return { kind: "physical-unflippable", reason: "shorthand-var-toggle" }; // متغيّر تبديل يكذّب العدّ
      }
      if (rp[0] === rp[1] && rp[2] === rp[3]) return null; // متناظر أفقيًّا
      return { kind: "flip", flips: [
        { prop: "border-start-start-radius", value: rp[0] },
        { prop: "border-start-end-radius", value: rp[1] },
        { prop: "border-end-end-radius", value: rp[2] },
        { prop: "border-end-start-radius", value: rp[3] },
      ], neutral: [] };
    }
    if (prop === "text-align") {
      // start/end لا left/right: داخل جزر LTR وفقرات dir=auto تعود للأصل من تلقائها
      if (/^left$/i.test(v)) return { kind: "flip", flips: [{ prop: "text-align", value: "start" }], neutral: [] };
      if (/^right$/i.test(v)) return { kind: "flip", flips: [{ prop: "text-align", value: "end" }], neutral: [] };
      return null;
    }
    if (prop === "float" || prop === "clear") {
      // القيمة المنطقية (كروم 118+) تحترم الجزر؛ الفيزيائية قبلها احتياط لكروم 102–117
      if (/^left$/i.test(v)) return { kind: "flip", flips: [{ prop: prop, value: "right" }, { prop: prop, value: "inline-start" }], neutral: [] };
      if (/^right$/i.test(v)) return { kind: "flip", flips: [{ prop: prop, value: "left" }, { prop: prop, value: "inline-end" }], neutral: [] };
      return null;
    }
    if (prop === "transform") {
      var ft = flipTransform(v);
      if (ft === PH) return null;         // إزاحاته عبر متغيّرات — تصريحاتها تغطيه
      if (ft !== null) return { kind: "flip", flips: [{ prop: "transform", value: ft }], neutral: [] };
      // كان /translate/ يوسم translateY(-50%) عجزًا كاذبًا: العجز إزاحةٌ سينية في سلسلةٍ لا تُقلب، أو مصفوفة
      if (/(?:^|[^a-z-])translate(?:x|3d)?\s*\(/i.test(v)) return { kind: "physical-unflippable", reason: "transform-complex" };
      if (/matrix(?:3d)?\s*\(/i.test(v)) return { kind: "physical-unflippable", reason: "transform-matrix" };
      return null;
    }
    if (prop === "translate") {
      // خاصية translate المستقلة: أول قيمة هي السينية
      var tv = splitVals(v);
      if (!tv.length || /^none$/i.test(v)) return null;
      var x0 = tv[0];
      if (XVAR_RE.test(x0)) return null;  // متغيّر إزاحة — تصريحه يغطيه
      var fx2 = flipX(x0);
      if (fx2 === null) return { kind: "physical-unflippable", reason: "translate-keyword" };
      if (fx2 === x0) return null;        // صفر — محايد
      tv[0] = fx2;
      return { kind: "flip", flips: [{ prop: "translate", value: tv.join(" ") }], neutral: [] };
    }
    // ★ (ر30-ب) تدرّجٌ بزاويةٍ غير رأسية: يُقلب بعكس زاويته في الخلفية والقناع (gradientDecl)، وإلا صُرّح به عجزًا — قبل فروع الخلفية
    var gd = gradientDecl(prop, v);
    if (gd) return gd;
    if (prop === "background" || prop === "background-image") {
      var swb = swapWords(v);
      if (swb !== null) return { kind: "flip", flips: [{ prop: prop, value: swb }], neutral: [] };
      return null;
    }
    // ★ transform-origin وperspective-origin **لا تُقلبان** (قرارٌ بعد دحضٍ حيّ): هما
    // منشأُ التحويلات — أي أرضُ «المحسوب بجافاسكربت» التي تعهّدنا ألّا نمسّها؛ ولا
    // أثر لهما في موضع التخطيط أصلًا، فمرآتُهما لا تكسب المستخدم شيئًا. وقد كسر
    // قلبُهما مكوّنًا حقيقيًّا: مؤشر «محادثة/العمل المشترك» منشؤه origin-left فقُلب
    // إلى 100% مع مرساته، والموقعُ يحسب إزاحته من اليسار — فوقع على القرص الخطأ.
    if (prop === "transform-origin" || prop === "perspective-origin") return null;
    if (prop === "background-position" || prop === "object-position") {
      var sw = swapWords(v);
      if (sw !== null) return { kind: "flip", flips: [{ prop: prop, value: sw }], neutral: [] };
      // المُصغِّر يحوّل الكلمات إلى أرقام (left → 0، right → 100%) فالاتجاه يُعبَّر
      // عدديًّا: أول قيمةٍ هي السينية — النسبةُ تُعكس حول المئة، والطولُ المطلق لا
      // يُعكس بأمان (لا نعرف عرض المرجع) فيُصرَّح به عجزًا بدل الصمت.
      var ptoks = splitVals(v);
      if (ptoks.length >= 1 && ptoks.length <= 2 && !/var\(|calc\(/i.test(v)) {
        var px = ptoks[0];
        var pm = /^(\d*\.?\d+)%$/.exec(px);
        if (pm || px === "0") {
          var pn = pm ? parseFloat(pm[1]) : 0;
          if (pn === 50) return null; // المنتصف محايد
          ptoks[0] = (100 - pn) + "%";
          return { kind: "flip", flips: [{ prop: prop, value: ptoks.join(" ") }], neutral: [] };
        }
        if (SIMPLE_LEN_RE.test(px) && !isZero(px)) {
          return { kind: "physical-unflippable", reason: "position-numeric" };
        }
      }
      return null;
    }
    if (prop === "box-shadow" || prop === "text-shadow") {
      // قرار موثَّق: الظلال لا تمسّ التخطيط ولا الاستعمال — لا تُقلب، وتُحصى للطبيب
      if (shadowHasX(v)) return { kind: "physical-unflippable", reason: "shadow" };
      return null;
    }
    if (prop === "direction" || prop === "unicode-bidi") return { kind: "logical" };
    // عائلة mask كانت لا تُحلَّل أصلًا (لا قلب ولا تصريح) — كلمات الجهة تُقلب كالخلفية
    if (/^(?:-webkit-)?mask(?:-image|-position|-position-x)?$/.test(prop) && /\b(?:left|right)\b/i.test(v)) {
      var mv = v.replace(/\b(left|right)\b/gi, function (w) { return w.toLowerCase() === "left" ? "right" : "left"; });
      return { kind: "flip", flips: [{ prop: prop, value: mv }], neutral: [] };
    }
    return null;
  }

  // ---------- 3) البادئة والفرز والتسلسل ----------
  function prefixSelector(sel) {
    var parts = splitTopComma(sel);
    var out = [];
    for (var j = 0; j < parts.length; j++) {
      var s = parts[j].trim();
      if (!s) continue;
      var m = /^(html|:root)(?![-\w])/.exec(s);
      if (m) out.push(GATE + s.slice(m[0].length));
      else out.push(GATE + " " + s);
    }
    return out.join(",");
    function splitTopComma(str) {
      var ps = [], depth = 0, cur = "";
      for (var q = 0; q < str.length; q++) {
        var c = str[q];
        if (c === "\\") { cur += c + (str[q + 1] || ""); q++; continue; }
        if (c === "(" || c === "[") depth++;
        else if (c === ")" || c === "]") depth--;
        if (c === "," && depth === 0) { ps.push(cur); cur = ""; }
        else cur += c;
      }
      ps.push(cur);
      return ps;
    }
  }
  /* سلّم التخصيص الموحّد (درس الدحض التجريبي): دعوى «المنطقي يغلب المصفِّر دومًا»
   * بطلت متى تفاوت تخصيص محدِّدات الموقع (130 مصفِّرًا فوق مستوى الأداة في الملف
   * المولّد، حتى (0,9,1) في dframe) — فالتخصيص يُحسم قبل الترتيب. الحل: يُصفَّر
   * تخصيص محدِّد الموقع بلفّه في ‎:where()‎، ويُبنى تخصيصُنا نحن سلّمًا بمعرّفات
   * داخل ‎:not()‎ (تخصيص :not = أخصُّ وسائطها):
   *   المستوى ٢ للمصفِّرات (2,1,1) < ٣ للمنطقيات والمطابقات (3,1,1) < ٤ للمعزَّزات (4,1,1)
   * فكلُّ منطقيٍّ يغلب كلَّ مصفِّر بنيويًّا، والترتيب داخل المستوى الواحد (رتبة
   * الطبقة ثم الموضع) يُطابق تعاقب الموقع مطابقةً تامة — وبهذا يُستعاد قانون
   * الطبقات نفسُه الذي كان الفرزُ وحده عاجزًا عن استعادته لما اختلف التخصيص. */
  /* ★★ استثناءُ السطح المحسوب من قواعد **المراسي** وحدها: عنصرٌ مطلقٌ يحسب الموقعُ
   * إزاحتَه بجافاسكربت (قائمةٌ منبثقة، مؤشرٌ منزلق) لا يُقلب مرساه — أما اتجاهُ نصّه
   * فيتبع الصفحة. وكان الاستثناء يُنفَّذ بفرض direction:ltr عليه، فانقلبت قوائمُ
   * منبثقةٌ كاملةٌ إلى اليسار (شُخّص حيًّا). و:not(:where(…)) صفرُ تخصيصٍ فلا يزحزح السلّم. */
  var NOFLIP_EXEMPT = ':not(:where([data-cml-noflip="computed"]))';
  var DIR_AWARE_RE = /\[dir\s*[=\]]|:dir\(/; // قاعدةٌ واعيةٌ بالاتجاه (سمة dir أو :dir())
  /* ★ (ر29-ب، ١٣ جمادى الأولى ١٤٤٨هـ — القرار 123، الخطر الكامن الذي كشفته ر30-أ) شرطُ RTL بلغة الصفحة أو بصنفٍ لا بسمة dir: ‎:lang(ar)‎
   * و‎[lang=ar]‎ و‎[lang|=ar]‎ و‎[lang^=ar]‎ وصنف ‎.rtl‎. كان المولّد يقلبها قلبَه لقاعدةٍ من اليسار، فإذا كتب الموقع ‎lang=ar‎ (يكتبها نصُّه
   * الأول لمن يختار عربيته الرسمية) انقلبت مرتين. فهي كالمشروطة بـ‎dir=rtl‎: لا تُقلب، وتُعاد في المستوى الرابع قصدًا للموقع.
   * والموجبُ وحده شرط: ‎:not(.rtl)‎ و‎:not(:lang(ar))‎ قاعدةٌ لغير RTL تنطبق في صفحتنا (لا نضع الصنف ولا اللغة) فتُقلب كغيرها. */
  var LANG_AR_RE = /:lang\(\s*(?:[^()]*,\s*)?["']?ar(?:-[a-z0-9-]+)?["']?\s*(?:,[^()]*)?\)|\[\s*lang\s*[|^]?=\s*["']?ar(?:-[a-z0-9-]+)?["']?(?:\s+[is])?\s*\]/i;
  var RTL_CLASS_RE = /\.rtl(?![\w\\-])/;
  var RTL_DIR_RE = /:dir\(\s*rtl\s*\)|\[dir\s*=\s*"?rtl"?\]/i;
  // المحدِّد بلا مجموعات ‎:not(…)‎ (المنفيُّ فيها ليس شرطًا موجبًا)؛ يتخطّى المهرَّب والسلاسل
  function positiveSel(sel) {
    if (sel.indexOf(":not(") === -1) return sel;
    var out = "", i = 0, n = sel.length;
    while (i < n) {
      var c = sel[i];
      if (c === "\\") { out += sel.substr(i, 2); i += 2; continue; }
      if (c === '"' || c === "'") { var j = skipStr(i); out += sel.slice(i, j); i = j; continue; }
      if (c === ":" && sel.substr(i, 5) === ":not(") {
        var depth = 0, k = i + 4;
        while (k < n) {
          var ck = sel[k];
          if (ck === "\\") { k += 2; continue; }
          if (ck === '"' || ck === "'") { k = skipStr(k); continue; }
          if (ck === "(") depth++;
          else if (ck === ")") { depth--; if (depth === 0) break; }
          k++;
        }
        i = k + 1; continue;
      }
      out += c; i++;
    }
    return out;
    function skipStr(at) { // من علامة التنصيص إلى ما بعد نظيرتها
      var q = sel[at], m = at + 1;
      while (m < n && sel[m] !== q) m += sel[m] === "\\" ? 2 : 1;
      return m + 1;
    }
  }
  // شرطٌ موجبٌ بلغة العربية أو بصنف ‎.rtl‎ (خارج ‎:not()‎)
  function langRtl(sel) {
    if (sel.indexOf("lang") === -1 && sel.indexOf(".rtl") === -1) return false;
    var s = positiveSel(sel);
    return LANG_AR_RE.test(s) || RTL_CLASS_RE.test(s);
  }
  // نوع القاعدة: 1 مخرجاتنا، 2 واعيةٌ بالاتجاه (سمة dir أو ‎:dir()‎ أو شرط RTL باللغة أو الصنف)، 0 سواها — للمولّد والطبيب معًا
  function condKind(sel) {
    if (sel.indexOf("data-cml") !== -1) return 1;
    return DIR_AWARE_RE.test(sel) || langRtl(sel) ? 2 : 0;
  }
  // شرط RTL موجبٌ (خارج ‎:not()‎): القواعد التي يعرّف بها الموقع متغيّراته تحت RTL
  function rtlPositive(sel) {
    return (/rtl/i.test(sel) && RTL_DIR_RE.test(positiveSel(sel))) || langRtl(sel);
  }
  /* ★ (ر29-ب — القلب المزدوج بالمتغيّرات، حواف التلاشي في ‎.scroll-fade‎ و‎.scroll-fade-x‎) الموقع يبدّل متغيّرات الجهتين تحت RTL
   * (‎.scroll-fade-x:where(:root[dir=rtl] :dir(rtl)){--cds-scroll-fade-left: …right-raw…}‎) ويُبقي مستهلكها فيزيائيًّا (تدرّج القناع
   * ‎to right‎ وحشو التمرير الأيسر)، فقلبُنا للمستهلك يعيد الحافّتين إلى جهة LTR. فالمتغيّرات التي يعرّفها الموقع في قاعدةٍ RTL موجبة
   * تُجمع من الأوراق نفسها، وإعلانٌ فيزيائيٌّ يستهلك أحدها لا يُقلب ولا يُصفَّر ولا يُنسخ: الموقع يعالج جهته بنفسه. */
  var VAR_USE_RE = /var\(\s*(--[\w-]+)/g;
  var SITE_RTL_VAR = { kind: "site-rtl-var" }; // علامة الإعلان المتروك لجهة الموقع (مرجعٌ واحد يُقارن بالهوية)
  /* ★ (ر30-ب، ١٣ جمادى الأولى ١٤٤٨هـ — مراجع ر29-ب، البند 1) الحارس بنطاق المكوّن. كان يجمع كلَّ متغيّرٍ معرَّفٍ تحت شرط RTL موجب أينما كان، ومنها
   * أدواتٌ لعنصرٍ بعينه لا تبدّل الجهتين: ‎.rtl\:scroll-fade-hide-left{--cds-scroll-fade-left-on:0}‎ تُخفي حافّةً واحدة، فكان حشو التمرير الذي يقرأ
   * ‎-left-on‎ يُترك فيزيائيًّا في كل مكان، والقناعُ بجانبه مقلوب (الورقتان الاحتياطيتان للتطبيق والأكاديمية: الحشو في جهةٍ غير جهة التلاشي). فصار المتغيّر
   * متروكًا للموقع في حالين:
   *   ١) مرآةٌ حقيقية، تُترك لكل مستهلك: قاعدة RTL تعيّنه بقيمةٍ فيها كلمة جهة (‎left‎ و‎to left‎) أو زاوية، أو تقرأ نظيره من الجهة الأخرى (‎--…-left‎
   *      من ‎--…-right-raw‎)، أو أداةُ خاصيةٍ اعتباطية تسمّي المتغيّر نفسه (‎.\[\&\:dir\(rtl\)\]\:\[--x\:…\]‎ و‎.rtl\:\[--_meter-dir\:1\]‎): قصدٌ صريح لذلك المتغيّر؛
   *   ٢) وفي المكوّن نفسه: قاعدة RTL مركّبُها الأخير (العنصر الذي تعيّن عليه) يشترك مع محدِّد المستهلك في صنفٍ أو معرِّفٍ أو سمةٍ خاصّة (المكوّن نفسه، أو
   *      سلفٌ في محدِّد المستهلك)، وتعيّن المتغيّر أو تقرؤه معادلةُ تبديلها (قيمةُ متغيّرٍ تعيّنه) — ‎.scroll-fade-x:where(:root[dir=rtl] :dir(rtl))‎ يبدّل الحافّتين
   *      بمعادلةٍ تقرأ ‎-left-on‎ و‎-right-on‎، فحشو ‎.scroll-fade-x‎ متروكٌ مع قناعه. وقراءة متغيّرٍ في خاصيةٍ عادية (لونُ حدٍّ)، أو متغيّرٍ لا جهة في اسمه
   *      (مسافةٌ عامّة)، ليست تبديلًا.
   * وما سوى ذلك (أداةٌ مسمّاة بقيمةٍ ثابتة لعنصرٍ آخر) يُقلب مستهلكه كغيره. */
  var SIDE_WORD_RE = /\b(?:left|right)\b/i, ANGLE_IN_RE = /\d(?:deg|grad|rad|turn)\b/i;
  var ARB_VAR_RE = /\\\[(--[\w-]+)\\:/g;
  var TOKEN_RE = /([.#])((?:\\.|[\w-]|[^\x00-\x7f])+)|\[\s*([\w-]+)/g;
  // علاماتٌ عامّة لا تعيّن مكوّنًا: مجموعات Tailwind وأقرانها، والسمات والحالات المشتركة بين المكوّنات
  var GENERIC_TOK_RE = /^(?:[.](?:group|peer)(?:\\\/|$)|[.](?:dark|light)$|\[(?:dir|lang|class|style|id|role|type|href|open|hidden|aria-[\w-]+|data-(?:state|orientation|side|align|highlighted|disabled|selected|checked|open|closed|active|ending-style|starting-style))$)/;
  // أصناف المحدِّد ومعرِّفاته وأسماء سماته خارج ‎:not()‎ (مهرَّبةً كما كُتبت) — للمستهلك: مركّباته كلها، فالسلف المشترك منها
  function compTokens(sel) {
    var out = [], s = positiveSel(sel), m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(s))) {
      var t = m[3] ? "[" + m[3] : m[1] + m[2];
      if (!GENERIC_TOK_RE.test(t) && out.indexOf(t) === -1) out.push(t);
    }
    return out;
  }
  // ولقاعدة RTL: مركّبها الأخير وحده (العنصر الذي تعيّن عليه المتغيّر) بلا مجموعات الشرط الوظيفية (‎:where(:root[dir=rtl] …)‎ وأمثالها)
  function subjectTokens(sel) {
    var parts = splitSelList(sel), out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = positiveSel(parts[i]), depth = 0, cut = 0, q = 0, t = "";
      for (q = 0; q < p.length; q++) {
        var c = p[q];
        if (c === "\\") { q++; continue; }
        if (c === "(" || c === "[") depth++;
        else if (c === ")" || c === "]") depth--;
        else if (depth === 0 && /[\s>+~]/.test(c)) cut = q + 1;
      }
      var last = p.slice(cut), k = 0;
      while (k < last.length) { // يُسقط ‎:name(…)‎ كاملةً
        var ch = last[k];
        if (ch === "\\") { t += last.substr(k, 2); k += 2; continue; }
        if (ch === ":" && /^:{1,2}[\w-]+\(/.test(last.slice(k))) {
          var o = last.indexOf("(", k), d2 = 0, e = o;
          for (; e < last.length; e++) { if (last[e] === "(") d2++; else if (last[e] === ")") { d2--; if (d2 === 0) break; } }
          k = e + 1; continue;
        }
        t += ch; k++;
      }
      var tk = compTokens(t);
      for (var j = 0; j < tk.length; j++) if (out.indexOf(tk[j]) === -1) out.push(tk[j]);
    }
    return out;
  }
  function sideOf(name) { return /left/i.test(name) ? "left" : /right/i.test(name) ? "right" : null; }
  function sideBase(name) { return name.replace(/left|right/gi, "#").replace(/-raw$/i, ""); } // ‎--a-left‎ و‎--a-right-raw‎ نظيران
  // قيمةٌ تبدّل الجهة: كلمة جهة أو زاوية خارج أسماء المتغيّرات، أو قراءةُ نظيرٍ من الجهة الأخرى
  function mirrorValue(prop, value) {
    var bare = String(value).replace(/--[\w-]+/g, "");
    if (SIDE_WORD_RE.test(bare) || ANGLE_IN_RE.test(bare)) return true;
    var side = sideOf(prop); if (!side) return false;
    var base = sideBase(prop), m;
    VAR_USE_RE.lastIndex = 0;
    while ((m = VAR_USE_RE.exec(value))) { var s2 = sideOf(m[1]); if (s2 && s2 !== side && sideBase(m[1]) === base) return true; }
    return false;
  }
  function rtlVarsOf(rules) {
    var glob = Object.create(null), any = Object.create(null), idx = Object.create(null);
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (r.sel.indexOf("data-cml") !== -1 || !rtlPositive(r.sel)) continue;
      var arb = Object.create(null), am;
      ARB_VAR_RE.lastIndex = 0;
      while ((am = ARB_VAR_RE.exec(r.sel))) arb[am[1]] = 1;
      var vars = Object.create(null), n = 0;
      for (var d = 0; d < r.decls.length; d++) {
        var p = r.decls[d].prop, val = String(r.decls[d].value), m;
        if (p.charAt(0) !== "-" || p.charAt(1) !== "-") continue; // قراءةٌ في خاصيةٍ عادية (لونٌ أو مسافة) ليست تبديلًا للمتغيّر
        any[p] = 1; vars[p] = 1; n++;
        if (arb[p] === 1 || mirrorValue(p, val)) glob[p] = 1;
        VAR_USE_RE.lastIndex = 0;
        // وما تقرؤه معادلةُ التبديل نفسها من متغيّرات الجهة (‎-left-on‎ في ‎--…-left: calc(…-right-raw… * …-left-on)‎)؛ ومسافةٌ عامّة تقرؤها (‎--df-nav-extent‎) ليست منه
        while ((m = VAR_USE_RE.exec(val))) if (sideOf(m[1])) { vars[m[1]] = 1; n++; }
      }
      if (!n) continue;
      var toks = subjectTokens(r.sel);
      for (var t = 0; t < toks.length; t++) (idx[toks[t]] = idx[toks[t]] || []).push(vars);
    }
    return { glob: glob, any: any, idx: idx, memo: new Map() };
  }
  // sel: محدِّد المستهلك (بلا محدِّدٍ لا يُترك إلا المرآة الحقيقية). ويقبل مجموعةً مجرّدة {اسم: 1} كما كان قبل ر30-ب: كلُّها مرايا
  function rtlVarHeld(value, info, sel) {
    if (!info || String(value).indexOf("var(") === -1) return false;
    var glob = info.glob || info, names = [], m;
    VAR_USE_RE.lastIndex = 0;
    while ((m = VAR_USE_RE.exec(value))) { if (glob[m[1]] === 1) return true; names.push(m[1]); }
    if (!sel || !info.idx) return false;
    var toks = info.memo.get(sel);
    if (!toks) { toks = compTokens(sel); info.memo.set(sel, toks); }
    for (var t = 0; t < toks.length; t++) {
      var L = info.idx[toks[t]];
      if (!L) continue;
      for (var k = 0; k < L.length; k++) for (var q = 0; q < names.length; q++) if (L[k][names[q]] === 1) return true;
    }
    return false;
  }
  // خصائصُ المرساة وحدها تحمل الاستثناء — وإلحاقُه بكل قاعدةٍ يضخّم الورقة بلا فائدة
  var ANCHOR_PROPS = {
    "left": 1, "right": 1, "inset-inline-start": 1, "inset-inline-end": 1, "inset-inline": 1,
    "inset": 1, "transform": 1, "translate": 1, "--tw-translate-x": 1,
    "margin-inline-start": 1, "margin-inline-end": 1, "margin-left": 1, "margin-right": 1,
  };
  /* ★ (ر24-ب2، ١٢ جمادى الأولى ١٤٤٨هـ — مراجعة Codex CX-007) الجزر من اليسار: داخل جزيرة LTR (‎direction:ltr‎ من ISLANDS_CSS) تبقى التحويلات
   * المنطقية على معناها الأصلي من تلقاء نفسها (‎inset-inline-start‎ يسارٌ فيها)، أما القيمة الفيزيائية المقلوبة فلا يُرجعها الاتجاه: ‎left:50%;
   * transform:translateX(-50%)‎ كان يصير فيها ‎inset-inline-start:50%; translateX(50%)‎ فيزيح العنصر بعرضه كلِّه. فهذه القيم وحدها تُستثنى في الجزر
   * وأحفادها — الشيفرة (pre وcode وkbd وsamp) وعلامتُنا ‎[data-cml-noflip="ltr"]‎ (والفارغة) — ويبقى التحويل المنطقي فيها كما هو، فلا يُفصل عنه بديله
   * المحلّي. والاستثناء ‎:not(:where(…))‎ صفرُ تخصيصٍ فلا يزحزح السلّم. ومتغيّر الإزاحة السينية يُستثنى حيث يُصرَّح به: تايلويند يصرّح به على العنصر
   * الذي يستعمله، فإن صُرّح به خارج الجزيرة واستُعمل داخلها ورثته مقلوبًا (حدٌّ معروف). */
  var ISLAND_SEL = ["pre", "code", "kbd", "samp", '[data-cml-noflip="ltr"]', '[data-cml-noflip=""]'];
  var ISLAND_EXEMPT = ":not(:where(" + ISLAND_SEL.concat(ISLAND_SEL.map(function (s) { return s + " *"; })).join(",") + "))";
  /* ★ (ر24-ب4، ١٢ جمادى الأولى ١٤٤٨هـ — بقية CX-007) جزر أوراق ‎*-point.css‎: تعلنها الورقة بمحدِّدات الموقع (‎direction:ltr‎ على كتلة شيفرةٍ
   * أو مسارٍ أو إطار)، فكانت القيم الفيزيائية المقلوبة تُطبَّق داخلها. وعلامتُها التي نملكها إعلانُ ‎--cml-island: ltr‎ في قاعدة الجزيرة نفسها
   * (ISLAND_MARK): فالجزيرة ما أعلنته ورقتُنا جزيرةً، لا ما يُستنبط من CSS الموقع. islandSelectors تقرأ محدِّدات القواعد الحاملة للعلامة من نصّ
   * الورقة (المولّد من الملف، والعامل من نسخة الحزمة)، وislandExempt يضمّها وأحفادَها إلى استثناء الجزر المسمّاة في ورقة ذلك الموقع وحدها.
   * ومحدِّد الجزيرة يُنقل بشرطه كما هو (بوابة html وحال المتن ومسار الهيكل)، فلا تُستثنى الجزيرة إلا حين تكون جزيرةً فعلًا. والقاعدة الحاملة
   * للعلامة تكون في المستوى الأعلى (لا @media ولا @supports): شرطٌ لا يُنقل إلى المحدِّد يُرفض في errors */
  var ISLAND_MARK = "--cml-island";
  function islandSelectors(cssText) {
    var out = [], errors = [], p;
    try { p = parseCss(String(cssText || "")); } catch (e) { return { sels: out, errors: ["parse"] }; }
    for (var i = 0; i < p.rules.length; i++) {
      var r = p.rules[i], marked = false;
      for (var d = 0; d < r.decls.length; d++) if (r.decls[d].prop === ISLAND_MARK) marked = true;
      if (!marked) continue;
      if (r.ctx && r.ctx.length) { errors.push("ctx:" + r.sel.slice(0, 80)); continue; }
      var parts = splitSelList(r.sel);
      for (var k = 0; k < parts.length; k++) {
        var sel = parts[k].replace(/\s+/g, " ").trim();
        if (sel && out.indexOf(sel) === -1) out.push(sel);
      }
    }
    return { sels: out, errors: errors };
  }
  // استثناء الجزر لورقةٍ بعينها: المسمّاة ثم جزر ورقة الموقع (بلا جزرٍ إضافية هو ISLAND_EXEMPT حرفًا بحرف، فلا تتغيّر ورقةٌ بلا جزر)
  function islandExempt(extra) {
    if (!extra || !extra.length) return ISLAND_EXEMPT;
    var named = ISLAND_SEL.concat(ISLAND_SEL.map(function (s) { return s + " *"; }));
    return ":not(:where(" + named.concat(extra, extra.map(function (s) { return s + " *"; })).join(",") + "))";
  }
  var PHYS_VALUE = { "transform": 1, "translate": 1, "background": 1, "background-image": 1, "background-position": 1, "object-position": 1 };
  function physValue(prop) {
    return PHYS_VALUE[prop] === 1 || (prop.charAt(0) === "-" && prop.charAt(1) === "-") || /^(?:-webkit-)?mask/.test(prop);
  }
  function anchorish(decls) {
    for (var i = 0; i < decls.length; i++) if (ANCHOR_PROPS[decls[i].prop]) return true;
    return false;
  }

  function prefixTier(sel, tier, exempt) {
    var ids = "";
    for (var k = 0; k < tier; k++) ids += "#cml" + k;
    var head = GATE + ":not(" + ids + ")";
    var parts = splitList(sel);
    var out = [];
    for (var j = 0; j < parts.length; j++) {
      var s = parts[j].trim();
      if (!s) continue;
      // العناصر الزائفة (::before وأخواتها والقديمة :before/:after) **لا تصح داخل
      // :where()** — والقائمة المتسامحة تُسقط ما فيها فتموت القاعدة كلها بصمت
      // (حالة حقيقية: قلب placeholder محرر ProseMirror على :before). تُفصل خارج اللف.
      // (?<!\\) — نقطتا أصناف تايلويند المهرَّبتان (‎.hover\:after\:x‎) ليستا زائفًا
      var pm2 = /(?<!\\)(?:::|:(?:before|after|first-line|first-letter)(?![\w-]))/.exec(s);
      var pi = pm2 ? pm2.index : -1;
      var core = pi === -1 ? s : s.slice(0, pi);
      var pseudo = pi === -1 ? "" : s.slice(pi);
      var m = /^(html|:root)(?![-\w])/.exec(core);
      if (m) {
        // متجذّر في html: مركّبُه يلتصق بالرأس داخل :where، وذيلُه (إن وجد) يُلفّ بعده
        var rest = core.slice(m[0].length);
        // ★ (ر9-هـ، ٥ جمادى الأولى ١٤٤٨هـ) آخرُ المركّب أولُ مسافةٍ أو رابطٍ (> + ~) في المستوى الأعلى وحده (compoundLen). كان يُقطع عند أول
        // محرفٍ منها أينما وقع، فقُطعت سمةٌ بمطابقة الكلمة (‎~=‎) في متغيّر Tailwind الجديد في وثائق Claude Code
        // (‎html[data-auth-pending~=nav] .auth-nav-pending\:max-lg\:mx-4‎) إلى ‎:where([data-auth-pending) ~ :where(=nav] …)‎: معقوفٌ وقوسٌ
        // مفتوحان يبتلعان في الورقة الحيّة كلَّ قاعدةٍ بعدها حتى آخرها (177 من 1,189 قاعدةً في overview: قرأ المتصفح 1,012، ومع الإصلاح
        // 1,189)، من المنطقيات والنسخ المطابقة، ومنها قاعدتا زرّ طيّ الفهرس
        // ‎#toc-collapse-toggle‎ (موضعُه inset-inline-end واستدارتُه 9999px) — فبقي مصفِّرُ right وحده فلصق الزرُّ بحافة الشاشة اليمنى، وغلبت
        // استدارتَه نسخةُ تمهيد Tailwind ‎button{border-radius:0}‎ فصار مربّعًا (صنفا فحص الاتجاه e222fbffd940 و361aee9e69f8)
        var cm = rest.slice(0, compoundLen(rest));
        var tail = rest.slice(cm.length).trim();
        var comb = "";
        if (/^[>+~]/.test(tail)) { comb = tail.charAt(0) + " "; tail = tail.slice(1).trim(); }
        out.push(head + (cm ? ":where(" + cm + ")" : "") + (tail ? " " + comb + ":where(" + tail + ")" : "") + (exempt || "") + pseudo);
      } else if (/^[>+~]/.test(core)) {
        out.push(head + " " + s + (exempt || "")); // بقايا تداخل نادرة — بلا لفّ (تخصيصها يبقى كما هو)
      } else if (!core.trim()) {
        out.push(head + " *" + (exempt || "") + pseudo); // زائفٌ عارٍ (::selection مثلًا)
      } else if (pseudo && /[\s>+~]$/.test(core)) {
        // الزائف لسليلٍ ضمني (".a ::before") — العنصر الكوني يحفظ الدلالة بعد اللف
        var tc = /[>+~]\s*$/.exec(core);
        out.push(head + " :where(" + core.replace(/[\s>+~]+$/, "") + ") " + (tc ? tc[0].trim() + " " : "") + "*" + (exempt || "") + pseudo);
      } else {
        out.push(head + " :where(" + core.trim() + ")" + (exempt || "") + pseudo);
      }
    }
    return out.join(",");
    // طولُ المركّب الأول في المستوى الأعلى: المعقوفات والأقواس والسلاسل وما بعد الهروب داخله، فلا تقطعه ‎~=‎ في سمة،
    // ولا ‎+‎ في ‎:nth-child(2n+1)‎، ولا مسافةٌ في ‎:not(.a .b)‎ أو في قيمة سمةٍ بين علامتي تنصيص
    function compoundLen(str) {
      var depth = 0, qt = null;
      for (var q = 0; q < str.length; q++) {
        var c = str.charAt(q);
        if (c === "\\") { q++; continue; }
        if (qt) { if (c === qt) qt = null; continue; }
        if (c === '"' || c === "'") { qt = c; continue; }
        if (c === "(" || c === "[") depth++;
        else if (c === ")" || c === "]") depth--;
        else if (depth <= 0 && /[\s>+~]/.test(c)) return q;
      }
      return str.length;
    }
    function splitList(str) {
      var ps = [], depth = 0, cur = "";
      for (var q = 0; q < str.length; q++) {
        var c = str[q];
        if (c === "\\") { cur += c + (str[q + 1] || ""); q++; continue; }
        if (c === "(" || c === "[") depth++;
        else if (c === ")" || c === "]") depth--;
        if (c === "," && depth === 0) { ps.push(cur); cur = ""; }
        else cur += c;
      }
      ps.push(cur);
      return ps;
    }
  }
  // «النسخ المطابقة»: إعلانُ موقعٍ متناظرٌ أو منطقيٌّ أصلًا قد يتقاسم خاناتِه
  // الفيزيائية مع مصفِّراتنا ومنطقياتنا — وبقاؤه في طبقات الموقع (سلّمنا يعلوها
  // كلَّها) يعني أن مصفِّرًا من قاعدةٍ أخرى على العنصر نفسه يمحوه (دحضٌ مؤكد:
  // unset يمحو نصفَ قطرٍ متناظرٍ مجاور). النسخة المطابقة تُعيده في مستوى
  // المنطقيات بموضعه من تعاقب الموقع. وقصًّا للحجم لا تُبثّ إلا لما تتقاطع
  // خاناتُه فعلًا مع خاناتٍ بثثناها (slotsOf أدناه) — لا لكل العائلات جزافًا.
  // النسخة المطابقة بخاناتها الأفقية وحدها: [{prop, value}] — الخاصية كما هي إن كانت أفقيةً أصلًا (منطقية inline،
  // أو left/right، أو زوايا الإطار)، وnull إن لم يبقَ فيها أفقيٌّ متنازَع (عمودية خالصة: block/top/bottom)
  var VERTICAL_ONLY = /(^|-)(top|bottom)(-|$)|(^|-)block(-|$)/;
  function identitySplit(prop, value) {
    // النسخ المطابقة متناظرةٌ أفقيًّا (غير المتناظر يُقلب لا يُنسخ) ⇒ تُبثّ بالمختصر المنطقي الأفقي (‎-inline‎)؛
    // وما لم يتناظر لسببٍ ما يبقى كما كان احتياطًا
    var m = /^(margin|padding|scroll-margin|scroll-padding|inset)$/.exec(prop);
    if (m) {
      var e4 = expand4(splitVals(value));
      if (!e4 || e4[1] !== e4[3]) return [{ prop: prop, value: value }];
      return [{ prop: prop + "-inline", value: e4[1] }];
    }
    if (prop === "border") return [{ prop: "border-inline", value: value }];
    m = /^border-(width|style|color)$/.exec(prop);
    if (m) {
      var e = expand4(splitVals(value));
      if (!e || e[1] !== e[3]) return [{ prop: prop, value: value }];
      return [{ prop: "border-inline-" + m[1], value: e[1] }];
    }
    if (/radius/.test(prop)) return [{ prop: prop, value: value }];
    if (VERTICAL_ONLY.test(prop)) return null;
    return [{ prop: prop, value: value }];
  }
  function slotsOf(prop) {
    if (/translate-x$/.test(prop)) return ["tx"];
    if (prop.charAt(0) === "-") return null;
    var m;
    if ((m = /^(margin|padding|scroll-margin|scroll-padding)(-(.+))?$/.exec(prop))) {
      var fam = { margin: "m", padding: "p", "scroll-margin": "sm", "scroll-padding": "sp" }[m[1]];
      var side = m[3];
      if (!side) return [fam + "-l", fam + "-r", fam + "-t", fam + "-b"];
      if (side === "left") return [fam + "-l"];
      if (side === "right") return [fam + "-r"];
      if (side === "top") return [fam + "-t"];
      if (side === "bottom") return [fam + "-b"];
      if (/^inline/.test(side)) return [fam + "-l", fam + "-r"];
      if (/^block/.test(side)) return [fam + "-t", fam + "-b"];
      return null;
    }
    if (prop === "inset") return ["i-l", "i-r", "i-t", "i-b"];
    if (prop === "left") return ["i-l"];
    if (prop === "right") return ["i-r"];
    if (prop === "top") return ["i-t"];
    if (prop === "bottom") return ["i-b"];
    if (/^inset-inline/.test(prop)) return ["i-l", "i-r"];
    if (/^inset-block/.test(prop)) return ["i-t", "i-b"];
    if (/radius$/.test(prop)) {
      if (prop === "border-radius") return ["r-tl", "r-tr", "r-br", "r-bl"];
      if (/top-left/.test(prop)) return ["r-tl"];
      if (/top-right/.test(prop)) return ["r-tr"];
      if (/bottom-left/.test(prop)) return ["r-bl"];
      if (/bottom-right/.test(prop)) return ["r-br"];
      return ["r-tl", "r-tr", "r-br", "r-bl"]; // المنطقية start-start وأخواتها — زوج بحسب الاتجاه؛ نعمّم
    }
    if ((m = /^border(-(left|right|top|bottom|inline-start|inline-end|inline|block-start|block-end|block))?(-(width|style|color))?$/.exec(prop))) {
      var sides = !m[2] ? ["l", "r", "t", "b"]
        : m[2] === "left" ? ["l"] : m[2] === "right" ? ["r"] : m[2] === "top" ? ["t"] : m[2] === "bottom" ? ["b"]
        : /^inline/.test(m[2]) ? ["l", "r"] : ["t", "b"];
      var chans = m[4] ? [m[4].charAt(0)] : ["w", "s", "c"];
      var outSl = [];
      for (var a1 = 0; a1 < sides.length; a1++) for (var b1 = 0; b1 < chans.length; b1++) outSl.push("b" + chans[b1] + "-" + sides[a1]);
      return outSl;
    }
    if (prop === "text-align") return ["ta"];
    if (prop === "float") return ["fl"];
    if (prop === "clear") return ["cl"];
    if (prop === "transform") return ["tf"];
    if (prop === "translate") return ["tx"];
    if (prop === "transform-origin") return ["to"];
    if (prop === "perspective-origin") return ["po"];
    if (prop === "background-position") return ["bp"];
    if (prop === "object-position") return ["op"];
    return null;
  }

  // تقسيمُ قائمة محدِّدات على الفواصل خارج الأقواس والمعقوفات والسلاسل
  function splitSelList(str) {
    var out = [], depth = 0, q = null, cur = "";
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i);
      if (q) { cur += c; if (c === "\\") { cur += str.charAt(++i); } else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === "\\") { cur += c + str.charAt(++i); continue; }
      if (c === "(" || c === "[") depth++;
      else if (c === ")" || c === "]") depth--;
      if (c === "," && depth === 0) { out.push(cur); cur = ""; continue; }
      cur += c;
    }
    if (cur.trim()) out.push(cur);
    return out;
  }
  // تخصيصُ محدِّدٍ واحد رقمًا واحدًا (معرّفات×10⁶ + أصناف×10³ + عناصر): :where صفر،
  // و:is/:not/:has تأخذ أعلى تخصيصٍ في وسائطها. الهروب (\:) لا يُعدّ رمزًا.
  function specificity(sel) {
    // كل استبدالٍ أدناه لا يقع إلا على محرفه (\ ( [ # : .) — فيُتخطّى إن غاب (المحدِّد البسيط هو الغالب)
    var s = String(sel);
    if (s.indexOf("\\") !== -1) s = s.replace(SPEC_ESC_RE, "_");
    var a = 0, b = 0, c = 0, m;
    while (s.indexOf("(") !== -1 && (m = SPEC_FN_RE.exec(s))) {
      var st = m.index + m[0].length, d = 1, e = st;
      while (e < s.length && d > 0) { var ch2 = s.charAt(e); if (ch2 === "(") d++; else if (ch2 === ")") d--; e++; }
      var inner = s.slice(st, e - 1);
      if (m[1].toLowerCase() !== "where") {
        var best = 0, parts = splitSelList(inner);
        for (var pi2 = 0; pi2 < parts.length; pi2++) best = Math.max(best, specificity(parts[pi2]));
        a += Math.floor(best / 1000000); b += Math.floor(best / 1000) % 1000; c += best % 1000;
      }
      s = s.slice(0, m.index) + " " + s.slice(e);
    }
    if (s.indexOf("[") !== -1) s = s.replace(/\[[^\]]*\]/g, function () { b++; return " "; });
    if (s.indexOf("#") !== -1) s = s.replace(/#[\w-]+/g, function () { a++; return " "; });
    if (s.indexOf("::") !== -1) s = s.replace(/::[\w-]+/g, function () { c++; return " "; });
    if (s.indexOf(":") !== -1) s = s.replace(/:[\w-]+(?:\([^)]*\))?/g, function () { b++; return " "; });
    if (s.indexOf(".") !== -1) s = s.replace(/\.[\w-]+/g, function () { b++; return " "; });
    var tm = s.match(SPEC_TYPE_RE); // الأخير: يكفي عدُّ المطابقات (هي مطابقاتُ الاستبدال نفسها)
    if (tm) c += tm.length;
    return a * 1000000 + b * 1000 + c;
  }
  var SPEC_TYPE_RE = /(^|[\s>+~])([a-zA-Z][\w-]*)/g;
  var SPEC_ESC_RE = /\\(?:[0-9a-fA-F]{1,6}\s?|.)/g;
  var SPEC_FN_RE = /:(where|is|not|has|matches|-webkit-any)\(/i;
  // الفاصل \u0001 لا يرد في CSS: «|» كان يرد في @supports selector(a|b) فيُغلق القوس مرتين
  function ctxKey(ctx) { return ctx.join("\u0001"); }
  // الحالة متدرّجة: بصمةُ (أ + ب) = متابعةُ حالة أ على ب — فتُحسب بادئةُ القاعدة مرةً لكل إعلاناتها
  function fnvStep(h, str) {
    for (var j = 0; j < str.length; j++) {
      h ^= str.charCodeAt(j);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h;
  }
  function fnvHex(h) { return ("0000000" + h.toString(16)).slice(-8); }
  function fnv1a(str) { return fnvHex(fnvStep(0x811c9dc5, str)); }
  // مفتاح التغطية عمدًا بلا طبقة: أسماء الطبقات قد تتبدل بين نشرات الموقع
  // والمقصود «هل هذا (السياق، المحدِّد، الخاصية) مغطًّى؟»
  function coveragePrefix(ctx, sel) {
    return fnvStep(0x811c9dc5, ctxKey(ctx) + "{" + sel.replace(/\s+/g, " ").trim() + "}");
  }
  function coverageKey(ctx, sel, prop) { return fnvHex(fnvStep(coveragePrefix(ctx, sel), prop)); }
  /* ★ (ر30-ب2، ١٤ جمادى الأولى ١٤٤٨هـ — حدّا «فحص الاتجاه»، R29B §٤) القائمة كما يقسمها القلب: قائمةُ محدِّداتٍ متفاوتة التخصيص تُفصل قاعدةً لكل محدِّد
   * (كي يُفرز كلٌّ بحقّه، flipSheet)، فبصماتُ تغطيتها بصماتُ أجزائها لا بصمةُ القائمة كلها؛ والمتساوية التخصيص (والمحدِّد الواحد) تبقى كما كُتبت.
   * وكان الطبيب يبصم القائمة كلها دائمًا فيرى المقلوبَ ثغرة (8 ثغراتٍ كاذبة في ملف المالك). فالقسمةُ هنا واحدةٌ للقلب والطبيب: {sels, specs} */
  function specParts(sel) {
    // بلا فاصلةٍ أصلًا فهو محدِّدٌ واحد — لا حاجة إلى التقسيم (الغالب)
    if (sel.indexOf(",") === -1) return { sels: [sel], specs: [specificity(sel)] };
    var parts = splitSelList(sel);
    if (parts.length < 2) return { sels: [sel], specs: [specificity(sel)] };
    var specs = parts.map(specificity), same = specs.every(function (s) { return s === specs[0]; });
    if (same) return { sels: [sel], specs: [specs[0]] };
    return { sels: parts.map(function (x) { return x.trim(); }), specs: specs };
  }
  function coverageSels(sel) { return specParts(sel).sels; }

  /* يقلب قائمة قواعد (من parseCss واحد أو أكثر). opts.layerOrder يعيد ترتيب البثّ
   * بحسب رتبة الطبقة (الطبقة المتأخرة تغلب، وغير المطبَّق يغلب الكل فيُبثّ أخيرًا).
   * يرجع { neutral: [rule], logical: [rule], coverage: [hash..], stats }. */
  function flipSheet(rules, opts) {
    var layerOrder = (opts && opts.layerOrder) || [];
    var vars = (opts && opts.vars) || null; // ★ (ر16-أ2) جدول varTable من مجموعة الأوراق نفسها (بلا جدولٍ: حماية التبديل كما كانت)
    var islandEx = islandExempt(opts && opts.islands); // ★ (ر24-ب4) جزر ورقة الموقع (islandSelectors) مع المسمّاة
    function rank(layer) {
      if (layer === null || layer === undefined) return layerOrder.length + 1; // غير مطبَّق — يغلب الكل
      var r = layerOrder.indexOf(layer);
      return r === -1 ? layerOrder.length : r;
    }
    // ★ لفُّ المحدِّد في :where() يُسقط تخصيصَه، فقاعدتان للموقع في الطبقة نفسها بتخصيصَين
    // مختلفين كانتا تُحسمان عندنا بالترتيب وحده — بينما يحسمهما الموقع بالتخصيص (قِيس: 1,891
    // زوجًا يتقاسمان الخانة والأسبقُ فيها أعلى تخصيصًا). فالفرز: الطبقة، ثم تخصيصُ المحدِّد
    // الأصلي تصاعديًّا (الأعلى يُبثّ آخِرًا فيغلب عند تساوي التخصيص المسطَّح)، ثم الموضع.
    // وقائمةُ محدِّداتٍ متفاوتةِ التخصيص تُفصل قاعدةً لكل محدِّد كي يُفرز كلٌّ بحقّه.
    var expanded = [];
    for (var ei = 0; ei < rules.length; ei++) {
      var er = rules[ei], sp = specParts(er.sel);
      if (sp.sels.length === 1) { er.spec = sp.specs[0]; expanded.push(er); continue; }
      for (var pi = 0; pi < sp.sels.length; pi++) {
        var clone = {}; for (var kk in er) { if (Object.prototype.hasOwnProperty.call(er, kk)) clone[kk] = er[kk]; }
        clone.sel = sp.sels[pi]; clone.spec = sp.specs[pi]; clone.idx = er.idx + pi / 1000;
        expanded.push(clone);
      }
    }
    var sorted = expanded.sort(function (a, b) {
      var ra = rank(a.layer), rb = rank(b.layer);
      if (ra !== rb) return ra - rb;
      if (a.spec !== b.spec) return a.spec - b.spec;
      return a.idx - b.idx; // فرز مستقر بالموضع الأصلي
    });
    var neutral = [], neutralImp = [], logical = [], logicalImp = [];
    var dirBoost = [], dirBoostImp = [], coverage = [], covSeen = {};
    // ★ إزالة التكرار (مراجعة كودكس ٩، مثبتة في كروم): كانت تُبقي **أولَ** ظهورٍ لـ(سياق
    // + محدِّد + خاصية + قيمة) وتُهمل الأهمية — فـ‎.a{ml:1px}.a{ml:2px}.a{ml:1px}‎ صارت
    // يمينًا 2px والأصل 1px، ونسخةُ ‎!important‎ المكرّرة تسقط فيبقى الهامش في الجهتين.
    // والصواب إبقاءُ **آخِر** ظهورٍ بالمفتاح نفسه مع الطبقة والأهمية: المحدِّد نفسه يطابق
    // العناصر نفسها في السياق نفسه، فالظهور الأخير يغلب كلَّ ما بينهما كما كان يغلبه
    // الأول وأكثر — فحذفُ ما قبله لا يغيّر الحسم لأي عنصر.
    // (المفتاح: الرتبة، فبصمةُ التغطية رقمًا لا ستّ عشريًّا — تكافؤٌ واحد، و«!» بعدها لا يكون رقمًا فلا التباس)
    var lastAt = new Map();
    var stats = { flipped: 0, neutralized: 0, identity: 0, unflippable: {}, logicalAlready: 0, dirAware: 0, dirBoosted: 0, gateSkipped: 0, rules: rules.length, rtlVarHeld: 0, langRtl: 0, gradient: 0 };
    // ★ (ر29-ب) متغيّرات الموقع المعرَّفة تحت شرط RTL موجب، من الأوراق نفسها (المولّد من اللقطة، والحيّ من أوراق الصفحة)
    var rtlVars = rtlVarsOf(rules);
    // قواعد الموقع المشروطة بـRTL (أدوات ‎rtl:‎ و‎:dir(rtl)‎) هي **قصد المؤلف** في RTL،
    // وتخصيصها واطئ (:where) فقلبُنا المعزَّز للأداة الأساس كان سيدهسها على العناصر
    // الجامعة للصنفين. الحل: تُبثّ نسخة منها معزَّزةً بالبوابة في قسمٍ ثالثٍ **بعد**
    // المنطقيات — فتفوز حيث وُجدت، ويبقى قلب الأساس حيث لا توجد. المشروطة بـLTR
    // (‏:dir(ltr)) تُترك كما هي: جزرُنا تعمل بخاصية direction لا بسمة dir فلا تلمسها.
    var RTL_COND_RE = new RegExp(":dir\\(\\s*rtl\\s*\\)|\\[dir\\s*=\\s*\"?rtl\"?\\]", "i");
    // التمرير الأول: أي الخانات الفيزيائية سنبثّ فيها فعلًا؟ (مصفِّرات + منطقيات)
    // النسخ المطابقة في التمرير الثاني تُشرَط بتقاطع خاناتها مع هذه — قصًّا للحجم
    var contested = {};
    function markSlots(prop) {
      var sl = slotsOf(prop);
      if (sl) for (var z = 0; z < sl.length; z++) contested[sl[z]] = 1;
    }
    // ★ (S8-C) ما يتكرّر في التمريرات الثلاثة يُحسب مرةً لكل قاعدة: نوعُها (1 مخرجاتنا، 2 واعيةٌ بالاتجاه)،
    // وتحليلُ إعلاناتها (analyzeDecl دالةٌ خالصة في الخاصية والقيمة)، ومفاتيحُ إزالة التكرار وبصماتُ التغطية
    var kindAt = new Array(sorted.length), anAt = new Array(sorted.length);
    var keyAt = new Array(sorted.length), covAt = new Array(sorted.length);
    var flipTails = new Set(); // ذيول مفاتيح المقلوبات (القيمة + علامة الأهمية) — انظر التمرير الثاني
    for (var r0 = 0; r0 < sorted.length; r0++) {
      var rule0 = sorted[r0];
      kindAt[r0] = condKind(rule0.sel);
      if (kindAt[r0]) continue;
      var an0 = anAt[r0] = new Array(rule0.decls.length);
      for (var d0 = 0; d0 < rule0.decls.length; d0++) {
        var a0 = an0[d0] = analyzeDecl(rule0.decls[d0].prop, rule0.decls[d0].value, vars);
        // ★ (ر29-ب) فيزيائيٌّ يستهلك متغيّرًا يبدّله الموقع تحت RTL: جهته من الموقع — لا قلب ولا تصفير ولا نسخة مطابقة
        if (a0 && a0.kind !== "logical" && rtlVarHeld(rule0.decls[d0].value, rtlVars, rule0.sel)) { a0 = an0[d0] = SITE_RTL_VAR; continue; }
        // ★ (مراجعة ر30-ب) تدرّجٌ بزاوية وموضعُ بلاطته في القاعدة لا ينقلب: يبقى عجزًا (gradPlacementKept)
        if (a0 && a0.grad && gradPlacementKept(rule0.decls, d0, vars)) { a0 = an0[d0] = GRAD_KEPT; continue; }
        if (!a0 || a0.kind !== "flip") continue;
        flipTails.add(rule0.decls[d0].value + (rule0.decls[d0].important ? "!i" : ""));
        for (var f0 = 0; f0 < a0.flips.length; f0++) markSlots(a0.flips[f0].prop);
        for (var q0 = 0; q0 < a0.neutral.length; q0++) markSlots(a0.neutral[q0].prop);
      }
    }
    // (الخانات المتنازَعة ثبتت بعد التمرير الأول — فالجواب لكل خاصيةٍ يُحسب مرة)
    var idNeed = new Map();
    function identityNeeded(prop) {
      var v = idNeed.get(prop);
      if (v !== undefined) return v;
      var sl = slotsOf(prop);
      v = false;
      if (sl) for (var z = 0; z < sl.length; z++) if (contested[sl[z]]) { v = true; break; }
      idNeed.set(prop, v);
      return v;
    }
    // آخِرُ ظهورٍ لكل مفتاح. لا يُسأل عنه إلا المقلوب — لكن مفتاحَ غيرِه قد يساويه (تصادمُ بصمةٍ بقيمةٍ واحدة)
    // فيحسم أيَّهما الأخير؛ فيُحسب مفتاحُ غير المقلوب أيضًا متى كان ذيلُه ذيلَ مقلوب. ولا يتساوى مفتاحان إلا
    // بتساوي ذيلَيهما: صدرُ المفتاح أرقامٌ وفاصلٌ لا «!» فيه، فأولُ «!» حدُّه — فما سوى ذلك لا أثر له ويُتخطّى
    for (var rl = 0; rl < sorted.length; rl++) {
      var ruleL = sorted[rl];
      if (kindAt[rl]) continue;
      var preL = -1, rkL = "", keysL = null, covL = null;
      for (var dl = 0; dl < ruleL.decls.length; dl++) {
        var decL = ruleL.decls[dl], aL = anAt[rl][dl];
        var tailL = decL.value + (decL.important ? "!i" : "");
        if (!(aL && aL.kind === "flip") && !flipTails.has(tailL)) continue;
        if (preL === -1) {
          preL = coveragePrefix(ruleL.ctx, ruleL.sel); rkL = rank(ruleL.layer) + "\u0002";
          keysL = keyAt[rl] = new Array(ruleL.decls.length); covL = covAt[rl] = new Array(ruleL.decls.length);
        }
        covL[dl] = fnvStep(preL, decL.prop);
        keysL[dl] = rkL + covL[dl] + "!" + tailL;
        lastAt.set(keysL[dl], rl * 100000 + dl);
      }
    }
    for (var r = 0; r < sorted.length; r++) {
      var rule = sorted[r];
      if (kindAt[r] === 1) { stats.gateSkipped++; continue; } // مخرجاتنا نحن
      if (kindAt[r] === 2) {
        stats.dirAware++;
        var byLang = !DIR_AWARE_RE.test(rule.sel); // ★ (ر29-ب) واعيةٌ بشرط اللغة أو الصنف وحده
        if (byLang) stats.langRtl++;
        if (byLang || RTL_COND_RE.test(rule.sel)) {
          var bn = [], bi = [];
          for (var bx = 0; bx < rule.decls.length; bx++) (rule.decls[bx].important ? bi : bn).push(rule.decls[bx]);
          if (bn.length) dirBoost.push({ sel: prefixTier(rule.sel, 4), decls: bn, ctx: rule.ctx });
          if (bi.length) dirBoostImp.push({ sel: prefixTier(rule.sel, 4), decls: bi, ctx: rule.ctx, _o: impOrder(rule, r) });
          stats.dirBoosted++;
        }
        continue;
      }
      var flips = [], neut = [], pvals = [];
      for (var d = 0; d < rule.decls.length; d++) {
        var dec = rule.decls[d];
        var a = anAt[r][d];
        if (a === SITE_RTL_VAR) { stats.rtlVarHeld++; continue; }
        if (!a || a.kind === "logical") {
          if (a) stats.logicalAlready++;
          // النسخة المطابقة: محايدٌ أو منطقيٌّ خاناتُه متنازَعةٌ فعلًا يُعاد بثُّه
          // كما هو في مستوى المنطقيات — وإلا محاه مصفِّرُ قاعدةٍ مجاورة
          if (identityNeeded(dec.prop)) {
            // ★ (ق١) لا يُعاد المختصر كاملًا: ‎:where(*){padding:0;margin:0;border:0 solid}‎ كان يُبثّ بتخصيصنا خارج
            // الطبقات فيمحو الهوامش والحشوات والحدود العمودية لأدوات الموقع (5,958 عنصرًا في 43 من 49 تشغيلًا)
            var parts0 = identitySplit(dec.prop, dec.value);
            if (parts0 === null) { stats.identitySkipped = (stats.identitySkipped || 0) + 1; continue; }
            for (var ip = 0; ip < parts0.length; ip++) flips.push({ prop: parts0[ip].prop, value: parts0[ip].value, important: dec.important });
            stats.identity++;
          }
          continue;
        }
        if (a.kind === "physical-unflippable") {
          stats.unflippable[a.reason] = (stats.unflippable[a.reason] || 0) + 1;
          continue;
        }
        var ck = fnvHex(covAt[r][d]);
        if (!covSeen[ck]) { covSeen[ck] = 1; coverage.push(ck); }
        if (lastAt.get(keyAt[r][d]) !== r * 100000 + d) { stats.deduped = (stats.deduped || 0) + 1; continue; }
        // ★ (ر24-ب2، CX-007) القيمة الفيزيائية المقلوبة (إزاحةٌ سينية، أو كلمة جهةٍ أو موضعٌ في خلفيةٍ أو قناع) تُفصل لتحمل استثناء الجزر
        for (var f = 0; f < a.flips.length; f++) (physValue(a.flips[f].prop) ? pvals : flips).push({ prop: a.flips[f].prop, value: a.flips[f].value, important: dec.important });
        for (var q = 0; q < a.neutral.length; q++) neut.push({ prop: a.neutral[q].prop, value: a.neutral[q].value, important: dec.important });
        stats.flipped++;
        if (a.grad) stats.gradient++; // ★ (ر30-ب) تدرّجٌ بزاوية عُكست زاويته
      }
      // فرز المهمّات: !important داخل طبقات الموقع يقلب قانون الطبقات (المهمّ المبكر
      // يغلب المتأخر) فيهزم مهمّاتُ الموقع المطبَّقةُ مهمّاتِنا غيرَ المطبَّقة — لذا
      // تُفصل الإعلانات الحاملة له لتُبثّ داخل ‎@layer cml-imp‎ المعلَنة أولَ الورقة.
      // (البادئة تُبنى لما له ناتجٌ وحده — وكانت تُبنى مرتين لكل قاعدة ثم تُهمل في الغالب)
      if (neut.length) pushSplit(neutral, neutralImp, prefixTier(rule.sel, 2, anchorish(neut) ? NOFLIP_EXEMPT : ""), neut, rule.ctx, impOrder(rule, r));
      // (استثناء السطح المحسوب يُحكم على إعلانات القاعدة كلها كما كان قبل فصل القيم الفيزيائية، فلا يتغيّر لغير الجزر شيء)
      var anch = anchorish(flips) || anchorish(pvals);
      if (flips.length) pushSplit(logical, logicalImp, prefixTier(rule.sel, 3, anch ? NOFLIP_EXEMPT : ""), flips, rule.ctx, impOrder(rule, r));
      if (pvals.length) pushSplit(logical, logicalImp, prefixTier(rule.sel, 3, (anch ? NOFLIP_EXEMPT : "") + islandEx), pvals, rule.ctx, impOrder(rule, r));
      stats.neutralized += neut.length;
    }
    // ★ ترتيب المهمّات مستقلٌّ عن ترتيب العاديات (مراجعة كودكس ١٠، مثبتة في كروم): في
    // المهمّات ينقلب قانون الطبقات — الطبقةُ الأسبق تغلب، وغيرُ المطبَّق أضعفُها — وكنّا
    // نبثّها بترتيب العاديات فيغلب في طبقتنا الواحدة ‎cml-imp‎ ما كان مغلوبًا عند الموقع
    // (‎@layer first,second‎ بهامشين مهمّين: الأصل 1px، والمقلوب كان 2px). فتُرتَّب هنا
    // بأولوية المهمّات: الأضعف أولًا فالأقوى آخِرًا، والتخصيصُ فالموضعُ داخل الطبقة.
    sortImp(neutralImp); sortImp(logicalImp); sortImp(dirBoostImp);
    return {
      neutral: neutral, neutralImp: neutralImp,
      logical: logical, logicalImp: logicalImp,
      dirBoost: dirBoost, dirBoostImp: dirBoostImp,
      coverage: coverage, stats: stats,
    };
    function pushSplit(normalList, impList, sel, decls, ctx, order) {
      if (!decls.length) return;
      var nd = [], id = [];
      for (var x = 0; x < decls.length; x++) (decls[x].important ? id : nd).push(decls[x]);
      if (nd.length) normalList.push({ sel: sel, decls: nd, ctx: ctx });
      if (id.length) impList.push({ sel: sel, decls: id, ctx: ctx, _o: order });
    }
    // أولوية المهمّات: غير المطبَّق -1 (أضعفها)، ثم الطبقات بعكس ترتيبها (الأسبق أقوى)
    function impOrder(rule, pos) {
      var ik = (rule.layer === null || rule.layer === undefined) ? -1 : (layerOrder.length + 1) - rank(rule.layer);
      return { ik: ik, spec: rule.spec || 0, pos: pos };
    }
    function sortImp(list) {
      list.sort(function (a, b) {
        var oa = a._o || { ik: 0, spec: 0, pos: 0 }, ob = b._o || { ik: 0, spec: 0, pos: 0 };
        return (oa.ik - ob.ik) || (oa.spec - ob.spec) || (oa.pos - ob.pos);
      });
    }
  }

  function serializeRules(list) {
    // تجميع القواعد المتتالية ذات السياق الواحد تحت غلاف شرطي واحد، بترتيبها
    var out = [], open = null;
    for (var r = 0; r < list.length; r++) {
      var rule = list[r];
      var key = ctxKey(rule.ctx);
      if (key !== open) {
        if (open) out.push(closeOf(open));
        for (var c = 0; c < rule.ctx.length; c++) out.push(rule.ctx[c] + "{");
        open = key || null;
      }
      var decls = [];
      for (var d = 0; d < rule.decls.length; d++) {
        var dec = rule.decls[d];
        decls.push(dec.prop + ":" + dec.value + (dec.important ? " !important" : ""));
      }
      out.push(rule.sel + "{" + decls.join(";") + "}");
    }
    if (open) out.push(closeOf(open));
    return out.join("\n");
    function closeOf(key) { return "}".repeat(key.split("\u0001").length); }
  }

  // جزر LTR: داخلها تبقى الخصائص المنطقية على يسارها لأن direction:ltr يحسمها،
  // وdir=auto في المحادثة يحسم كل فقرة بلغتها — الصواب انبثاقي لا حالات خاصة.
  /* ★★ عقدان كانا مخلوطين في سمةٍ واحدة، وخلطُهما أعطبَ واجهاتٍ كاملة:
   *   ١) «جزيرةُ قراءة»: نصٌّ يُقرأ من اليسار مهما كان اتجاه الصفحة — الشيفرة والمقتطفات.
   *   ٢) «سطحٌ محسوب»: عنصرٌ مطلقٌ يحسب الموقعُ إزاحتَه بجافاسكربت (قائمةٌ منبثقة، مؤشرٌ
   *      منزلق) — فلا نقلب مرساتَه الفيزيائية كي لا نخالف حسابَه.
   * وكان [data-cml-noflip] يجرّ الاثنين معًا فيفرض direction:ltr على السطح المحسوب —
   * فتنقلب **قائمةُ الحساب المنبثقة كلها إلى اليسار** (شُخّص حيًّا على شاشة حقيقية:
   * السمة عندنا نحن، والقائمة داخلها). والصواب أن السطح المحسوب يبقى على اتجاه الصفحة
   * وإنما يُستثنى من قلب المراسي وحده. فصار للقراءة قيمةٌ صريحة "ltr"، وللسطح "computed"
   * ولا اتجاه له. (ولذا اختفى العطل في المحرّك النقطي: هذه الورقة خلف بوابة v2.) */
  var ISLANDS_CSS =
    GATE + " pre," + GATE + " code," + GATE + " kbd," + GATE + " samp," +
    GATE + ' [data-cml-noflip="ltr"],' + GATE + " [data-cml-noflip=\"\"]{direction:ltr;}\n" +
    GATE + " pre," + GATE + " code{text-align:start;unicode-bidi:isolate;}\n";

  /* ★ المحرّك الحيّ (buildLiveSheet): يبني ورقة القلب من **نصوص CSS الموقع كما هي الآن**
   * لا من لقطةٍ مبنيّةٍ وقت الإصدار. العلّة الجذرية التي يعالجها: الموقع يشحن حزمًا جديدة
   * (أسماء ملفاتٍ ببصماتٍ جديدة وأصنافٍ مستجدّة)، فتصير لقطتُنا متقادمةً وتتساقط تغطيتُنا
   * تدريجيًّا حتى يفقد المستخدم الاتجاه ولا يملك إلا التبديل اليدوي إلى المحرّك النقطي.
   * البوابة هنا "live" لا "v2": فما إن تُطبَّق الورقةُ الحيّة حتى تخمد ورقةُ اللقطة
   * حرفيًّا (بوابتها v2) — فلا تتزاحمان أبدًا، وإخفاقُ الحيّ يُبقي اللقطة عاملة.
   * والترتيب هنا هو ترتيب gen-rtl نفسه: جزرٌ، فمهمّات، فمصفِّرات، فمنطقيات، فمعزَّزات. */
  var LIVE_GATE = 'html[data-cml-rtl="live"]';
  // ★ (ر9-د، ٥ جمادى الأولى ١٤٤٨هـ) عتبتا «المدخل الهزيل» للورقة الحيّة. كانتا عتبتَي المولّد للتطبيق (1000 قاعدة و200 مقلوبٍ)،
  // وهما معايَرتان على اتحاد أوراق الموقع كلها في لقطته؛ أما مدخل الحيّ فأوراق الصفحة الحاضرة كاملةً (الكلُّ أو لا شيء في العامل)،
  // والصفحة الخفيفة أوراقُها الكاملة قليلة. قِيس: claude.ai/login بوكيل مستخدمٍ محمول (الموقع يختار الحزمة بالوكيل لا بالعرض) ورقتان
  // فيهما 2,675 قاعدة و87 مقلوبًا، فكانت تُرفض «هزيلة» وتبقى اللقطة عليها أبدًا (فحص الاتجاه بعرض 390: الورقة الحيّة لم تُحقن).
  // فعتبة المقلوب الآن أدنى عتبات المولّد لموقعٍ كامل (60: Intercom والوثائق)، وعتبة القواعد باقية. والناتج لما يُقبل لم يتغيّر،
  // فلا تتغيّر REV
  var LIVE_MIN_RULES = 1000, LIVE_MIN_FLIPPED = 60;
  // ★ (مراجعة كودكس ١٣) المدخل سجلّاتٌ {text, base, media} بترتيب المستند — والنصُّ
  // المجرّد مقبولٌ للتوافق. وسيطُ الورقة يصير سياقًا (@media) على قواعدها، والعناوين
  // النسبية في القيم تُطلق على عنوان الورقة (نسخُها إلى <style> في الصفحة يغيّر أساسَها
  // فتنكسر الصورة)، و@import لا نتبعه فنرفض البناء صراحةً وتبقى اللقطة عاملة.
  // info (اختياري) يستقبل سبب الرفض.
  var URL_IN_VALUE = /url\(\s*(['"]?)([^'")]*)\1\s*\)/g;
  function absolutizeUrls(value, base) {
    if (!base || value.indexOf("url(") === -1 || typeof URL !== "function") return value;
    return value.replace(URL_IN_VALUE, function (all, q, u) {
      if (!u || /^(?:data:|#|[a-z][a-z0-9+.-]*:)/i.test(u)) return all;
      try { return "url(" + q + new URL(u, base).href + q + ")"; } catch (e) { return all; }
    });
  }
  // ★ (ر24-ب4) opts.islands: محدِّدات جزر ورقة الموقع النقطية (islandSelectors) — يمرّرها العامل من نسخة الحزمة
  function buildLiveSheet(texts, info, opts) {
    info = info || {};
    var all = [], layerOrder = [], parseErrors = 0, varLists = [];
    for (var i = 0; i < texts.length; i++) {
      var src = texts[i];
      var rec = typeof src === "string" ? { text: src } : (src || {});
      var p = parseCss(String(rec.text || ""));
      if (p.imports && p.imports.length) { info.reason = "import"; return null; }
      var media = String(rec.media || "").trim();
      var mediaCtx = media && !/^(?:all|screen)$/i.test(media) ? "@media " + media : null;
      for (var rr = 0; rr < p.rules.length; rr++) {
        var rule = p.rules[rr];
        if (mediaCtx) rule.ctx = [mediaCtx].concat(rule.ctx || []);
        if (rec.base) {
          for (var dd = 0; dd < rule.decls.length; dd++) {
            rule.decls[dd].value = absolutizeUrls(rule.decls[dd].value, rec.base);
          }
        }
      }
      parseErrors += p.stats.parseErrors;
      varLists.push(p.vars);
      for (var L = 0; L < p.layerOrder.length; L++) {
        if (layerOrder.indexOf(p.layerOrder[L]) === -1) layerOrder.push(p.layerOrder[L]);
      }
      for (var r = 0; r < p.rules.length; r++) { p.rules[r].idx = all.length; all.push(p.rules[r]); }
    }
    // بوابتا صحّةٍ كبوابتَي المولّد: مدخلٌ هزيلٌ أو أخطاءُ تحليلٍ كثيرة ⇒ لا ورقة
    // (فتبقى اللقطة عاملةً بدل ورقةٍ ناقصةٍ تُفسد الصفحة)
    if (parseErrors > 50) { info.reason = "parse"; return null; }
    var out = flipSheet(all, { layerOrder: layerOrder, vars: varTable(varLists), islands: opts && opts.islands });
    // ★ (ر29-ب) والمتروك لجهة الموقع (rtlVarHeld) فيزيائيٌّ في المدخل كالمقلوب، فيُعدّ معه: كان يُنقص العدّ فرُفضت ورقة /login بعرض 390 «هزيلة»
    // (حزمة المحمول، أدنى العتبة بقليل) فعادت اللقطة المتقادمة — قِيس في فحص الاتجاه (app-login-390: rtl/v2 بستة أصنافٍ عالية)
    if (all.length < LIVE_MIN_RULES || out.stats.flipped + out.stats.rtlVarHeld < LIVE_MIN_FLIPPED) { info.reason = "thin"; return null; }
    var impRules = out.neutralImp.concat(out.logicalImp, out.dirBoostImp);
    var css = "@layer cml-point, cml-imp;\n" + ISLANDS_CSS +
      (impRules.length ? "@layer cml-imp{\n" + serializeRules(impRules) + "\n}\n" : "") +
      serializeRules(out.neutral) + "\n" + serializeRules(out.logical) + "\n" +
      serializeRules(out.dirBoost) + "\n";
    // تبديل البوابة على الناتج كاملًا (الجزر تحمل البوابة نفسها) — تبديلٌ نصّي على سلسلةٍ
    // ثابتةٍ نحن كتبناها، فلا يطال محتوى قاعدةٍ من الموقع
    css = css.split(GATE).join(LIVE_GATE);
    // ★ (ر30-ب2) وبصماتُ تغطيتها: يقارن بها «فحص الاتجاه» ما دامت هذه الورقة هي المطبَّقة (لا بصمات اللقطة المشحونة)
    return { css: css, stats: out.stats, rules: all.length, coverage: out.coverage };
  }

  g.CMLRtl = {
    LIVE_GATE: LIVE_GATE,
    // مراجعة المحرّك: تدخل بصمة الورقة الحيّة فتُبنى من جديد عند كل إصلاحٍ في القلب (لا تبقى ورقةُ محرّكٍ قديم
    // مخزَّنةً ما دامت عناوين أوراق الموقع كما هي). ٢: النسخ المطابقة والمختصرات أفقيةٌ وحدها (فحص الاتجاه ق١)
    // ٣ ★ (ر5-ج): قواعد ‎@scope‎ تُسطَّح فتدخل القلب والنسخ المطابقة (حشوة خلايا الجداول في النثر)
    // ٤ ★ (ر9-هـ): مركّب html يُقطع في المستوى الأعلى وحده (compoundLen) — فلا تبقى في الذاكرة ورقةٌ حيّة مبتورة بُنيت قبله
    // ٥ ★ (ر16-أ2): القيم الملتصقة بعد القوس تُقسم، وvar العارية الآمنة بجدول المتغيّرات تُعدّ في المختصرات — فلا تبقى ورقةٌ حيّة بنسخٍ ملتصقة
    // ٦ ★ (ر24-ب2): الإعلانات السابقة لقاعدةٍ متداخلة تُدفع قبلها (CX-006)، والقيم الفيزيائية لا تُقلب داخل جزر LTR (CX-007)
    // ٧ ★ (ر24-ب4): ولا داخل جزر أوراق ‎*-point.css‎ (علامتها ‎--cml-island‎؛ بقية CX-007)
    // ٨ ★ (ر29-ب): شرط RTL باللغة أو بصنف ‎.rtl‎ لا يُقلب ويُعاد قصدًا للموقع، ومستهلك متغيّرٍ يبدّله الموقع تحت RTL لا يُقلب (حواف التلاشي)
    // ٩ ★ (ر30-ب): زاوية التدرّج الخطي تُعكس (θ ↦ 360−θ)، وحارس متغيّرات الموقع بنطاق المكوّن (المرآة الحقيقية، أو قاعدة RTL على المكوّن نفسه)
    // ١٠ ★ (ر30-ب2): التدرّج بزاوية مع طبقةٍ شعاعية أو مخروطية بموضعٍ عددي غير موسَّط يبقى عجزًا (O4) — فلا تبقى ورقةٌ حيّة بنصف قيمةٍ معكوس
    REV: 10,
    buildLiveSheet: buildLiveSheet,
    GATE: GATE,
    parseCss: parseCss,
    analyzeDecl: analyzeDecl,
    varTable: varTable,
    flipSheet: flipSheet,
    serializeRules: serializeRules,
    prefixSelector: prefixSelector,
    coverageKey: coverageKey,
    coverageSels: coverageSels, // ★ (ر30-ب2) أجزاء القائمة كما تُبصم في التغطية (الطبيب)
    fnv1a: fnv1a,
    ISLANDS_CSS: ISLANDS_CSS,
    ISLAND_EXEMPT: ISLAND_EXEMPT,
    ISLAND_MARK: ISLAND_MARK,
    islandSelectors: islandSelectors,
    islandExempt: islandExempt,
    // ★ (ر29-ب) الحارسان للطبيب أيضًا (engine.js): نوع القاعدة، ومتغيّرات الموقع تحت RTL ومستهلكها المتروك له
    condKind: condKind,
    langRtl: langRtl,
    rtlVarsOf: rtlVarsOf,
    rtlVarHeld: rtlVarHeld,
    // ★ (ر30-ب) للفحص الذاتي والطبيب: عكس زاوية التدرّج، وعلامات المكوّن
    mirrorAngle: mirrorAngle,
    flipGradients: flipGradients,
    gradPlacementKept: gradPlacementKept,
    compTokens: compTokens,
    subjectTokens: subjectTokens,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
