/* options.js — settings page for «تعريب كلود (Claude) لنسخة الويب (غير رسمي)» (Arabic-only).
   Wires the UI to chrome.storage.local. No network of its own — يقرأ من ملفات الإضافة نفسها
   (قواميس المواقع وفهارس المتون المشحونة) لا غير، والوجه البعيد الوحيد هو chrome.storage.sync
   لقسم المزامنة الاختيارية (المتصفح ينقلها ضمن حساب المستخدم، لا اتصال منا).

   ═══ «الموقع» و«المواقع كلها» (إعادة البناء — v2-scope/options-page.md) ═══
   - «المواقع كلها» أولًا وافتراضيًّا (داخل initDomainBar وحدها: صفحات الاختبار بلا الرأس تبقى على
     التطبيق). و«الكل» ليس موقعًا زائفًا: لا إسقاط إلى التطبيق — كل قسمٍ يعمل على scopeIds()،
     أي الموقع المختار أو المواقع كلها، وما لا معنى له في «الكل» (إضافة تصحيحٍ مفرد، إعادة ضبط موقع)
     يطلب اختيار الموقع صراحةً.
   - تخطيطٌ واحد لكل الاختيارات: الأقسام نفسها ([data-sec]) بالترتيب نفسه دائمًا؛ وما لا ينطبق
     على موقعٍ يُعطَّل (fieldset disabled) وسببُه مكتوبٌ خارجه (C.caps) — لا إخفاء صامت.
   - المفتاح الرئيس بوّابة: مفاتيح المواقع تُعرض بحالها الفعلية ومعطّلةً عند إطفائه، واختياراتها
     محفوظة؛ والتجميع في الاتجاه المعاكس («يعمل في N من M» / «لا موقع مفعّل»).
   - كل شيء من جدول CMLConst.DOMAINS: إضافة موقعٍ صفٌّ في الجدول لا تعديلٌ هنا. */
(function () {
  "use strict";

  // ---------- جمعُ المعدود العربي ----------
  // القاعدة: 0 ← جمع، 1 ← مفرد + واحد/واحدة، 2 ← مثنى، 3–10 ← جمع، 11–99 ← مفرد منصوب،
  // والمئات والألوف الصحيحة (100، 200، 1000…) وما شابه ← مفرد مجرور. تُقاس على آخر رقمين.
  // forms = { s: مفرد، d: مثنى مرفوع، o: مثنى مجرور/منصوب، p: جمع، a: مفرد منصوب، f: مؤنث؟ }
  // g=true حين يقع المعدود بعد حرف جرّ أو مضافًا إليه أو مفعولًا («بعد قراءة ملفين»، «قرأ ملفين»).
  // g="acc" للمفعول به خاصةً: يفترق عن المجرور في المفرد وحده («وجد نصًّا واحدًا»، «قرأ ملفًا واحدًا»).
  // لا تُلحق المعدودَ صفةٌ في الرسائل («N نصًّا آخر») لأنها تحتاج مطابقةً ثانية؛ أعِد صياغة الجملة بدلها
  // (أو اكتبه تسميةً: «المحصود: N»).
  // والرقم مجمَّع المراتب (20,000) كسائر أعداد الصفحة.
  function arCount(n, f, g) {
    n = Number(n) || 0;
    var m = n % 100, ns = n.toLocaleString("en");
    if (n === 0) return "0 " + f.p;
    if (n === 1) return g === "acc" ? f.a + (f.f ? " واحدةً" : " واحدًا") : f.s + (f.f ? " واحدة" : " واحد");
    if (n === 2) return g ? f.o : f.d;
    if (m >= 3 && m <= 10) return ns + " " + f.p;
    if (m >= 11 && m <= 99) return ns + " " + f.a;
    return ns + " " + f.s;
  }
  var N = {
    file:   { s: "ملف", d: "ملفان", o: "ملفين", p: "ملفات", a: "ملفًا" },
    text:   { s: "نصّ", d: "نصّان", o: "نصّين", p: "نصوص", a: "نصًّا" },
    rule:   { s: "قاعدة", d: "قاعدتان", o: "قاعدتين", p: "قواعد", a: "قاعدةً", f: true },
    spot:   { s: "موضع", d: "موضعان", o: "موضعين", p: "مواضع", a: "موضعًا" },
    elem:   { s: "عنصر", d: "عنصران", o: "عنصرين", p: "عناصر", a: "عنصرًا" },
    fix:    { s: "تصحيح", d: "تصحيحان", o: "تصحيحين", p: "تصحيحات", a: "تصحيحًا" },
    line:   { s: "سطر", d: "سطران", o: "سطرين", p: "أسطر", a: "سطرًا" },
    sec:    { s: "ثانية", d: "ثانيتان", o: "ثانيتين", p: "ثوانٍ", a: "ثانيةً", f: true },
    result: { s: "نتيجة", d: "نتيجتان", o: "نتيجتين", p: "نتائج", a: "نتيجةً", f: true },
    para:   { s: "تصحيح فقرة", d: "تصحيحا فقرتين", o: "تصحيحي فقرتين", p: "تصحيحات فقرات", a: "تصحيحَ فقرة" },
    sheet:  { s: "ملف تصميم", d: "ملفا تصميم", o: "ملفي تصميم", p: "ملفات تصميم", a: "ملفَّ تصميم" },
    site:   { s: "موقع", d: "موقعان", o: "موقعين", p: "مواقع", a: "موقعًا" },
    page:   { s: "صفحة", d: "صفحتان", o: "صفحتين", p: "صفحات", a: "صفحةً", f: true },
    title:  { s: "عنوان", d: "عنوانان", o: "عنوانين", p: "عناوين", a: "عنوانًا" },
    // ★ (ر8-د — N5) فقرات المقالات (غير «تصحيح فقرة» أعلاه) والكلمات والألوف لحجم الترجمة في بطاقة القاموس
    parag:  { s: "فقرة", d: "فقرتان", o: "فقرتين", p: "فقرات", a: "فقرةً", f: true },
    word:   { s: "كلمة", d: "كلمتان", o: "كلمتين", p: "كلمات", a: "كلمةً", f: true },
    thou:   { s: "ألف", d: "ألفان", o: "ألفين", p: "آلاف", a: "ألفًا" },
    // ★ (ر8-د2) الحروف في رسائل حدّ الطول: «أطول من 300 حرف» لا «300 حرفًا» (المعدود بعد المئات مفردٌ مجرور)
    char:   { s: "حرف", d: "حرفان", o: "حرفين", p: "أحرف", a: "حرفًا" },
  };
  var $ = function (id) { return document.getElementById(id); };
  var LANG = "ar"; // Arabic-only build
  var C = CMLConst;
  var KEYS = C.RESET_KEYS;

  // ★ حالة التنسيق العابرة في storage.session (تُمحى بإغلاق المتصفح — لا حجز خالد).
  // هذه الصفحة سياقٌ موثوق، فهي التي تفتح session لسكربتات المحتوى قبل أول طلب فحص.
  // القشرة تسقط إلى local حيث لا session (قشور الاختبار) بسلوك الأمس نفسه.
  var SESS = (chrome.storage && chrome.storage.session) || chrome.storage.local;
  try {
    if (chrome.storage.session && chrome.storage.session.setAccessLevel)
      chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" });
  } catch (e) {}

  // ═══ النطاق المختار ═══════════════════════════════════════════════════════════
  // DOM: معرّف موقعٍ أو "all". الافتراضي هنا التطبيق (قشور الاختبار تحمّل الصفحة بلا #domainSel
  // وتعتمد عليه)، و«الكل» الافتراضي للصفحة الحقيقية يُضبط في initDomainBar وحدها.
  var DOM = "app";
  var ALL_IDS = C.DOMAINS.map(function (x) { return x.id; });
  var SITE = (C.K && C.K.SITE_ON) || "cml_site";
  var ENG_SITE = (C.K && C.K.ENGINE_SITE) || "cml_engine_site";
  var SCOPED = { cml_overrides: 1, cml_user_patterns: 1, cml_scan_result: 1, cml_bad_rules: 1,
                 cml_rtldoc_result: 1, cml_rtl_live: 1, cml_recon_dismissed: 1, cml_block_ov: 1 };
  function physFor(d, k) { return SCOPED[k] ? C.key(k, d) : k; }
  function isAll() { return DOM === "all"; }
  // الأقسام كلها تعمل على هذه القائمة: الموقع المختار، أو المواقع كلها — لا «التطبيق متنكّرًا»
  function scopeIds() { return isAll() ? ALL_IDS.slice() : [DOM]; }
  var NOCAPS = { scan: { on: false, why: "" }, rtlDoc: { on: false, why: "" }, live: { on: false, why: "" },
                 chat: { on: false, why: "" }, bodies: { on: false, why: "" } };
  function capsOf(d) { return C.caps(d) || NOCAPS; }
  function dname(d) { return (C.domain(d) || {}).name || d; }
  function qn(d) { return "«" + dname(d) + "»"; }
  function hostOf(d) { return (C.domain(d) || {}).host || d; }
  function siteKey(d) { return SITE + "." + d; }
  function engKey(d) { return ENG_SITE + "." + d; }
  function joinAnd(arr) { return arr.join(" و"); }
  function namesOf(ids) { return joinAnd(ids.map(qn)); }
  function hostsOf(ids) { return ids.map(hostOf).join("، "); }

  function getD(d, keys, cb) {
    var list = Array.isArray(keys) ? keys : [keys];
    var ph = list.map(function (k) { return physFor(d, k); });
    chrome.storage.local.get(ph, function (r) {
      var out = {};
      for (var i = 0; i < list.length; i++) if (r && r[ph[i]] !== undefined) out[list[i]] = r[ph[i]];
      cb(out);
    });
  }
  // تمرير خطأ الكتابة إلى النداء: التخزين له سقف، وامتلاؤه يُفشل الكتابة بصمت — فكان
  // المستخدم يرى «تم الاستيراد ✓» ولم يُحفظ شيء. النداء يستقبل الخطأ إن وقع.
  function setD(d, obj, cb) {
    var o = {};
    for (var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) o[physFor(d, k)] = obj[k]; }
    chrome.storage.local.set(o, function () {
      var e = chrome.runtime && chrome.runtime.lastError;
      (cb || function () {})(e || null);
    });
  }
  // قراءةٌ لمواقع عدّة بمفاتيحها المنطقية: per[d] = {مفتاح: قيمة}
  function readMany(ids, keys, cb) {
    var ph = [], map = [];
    ids.forEach(function (d) { keys.forEach(function (k) { ph.push(physFor(d, k)); map.push([d, k]); }); });
    chrome.storage.local.get(ph, function (r) {
      var per = {};
      ids.forEach(function (d) { per[d] = {}; });
      for (var i = 0; i < ph.length; i++) if (r && r[ph[i]] !== undefined) per[map[i][0]][map[i][1]] = r[ph[i]];
      cb(per);
    });
  }
  // سقوف الاستيراد: ملف واحد لا يجوز أن يجمّد الصفحة ولا أن يملأ التخزين.
  var IMPORT_MAX_BYTES = C.IMPORT_MAX_BYTES;
  var IMPORT_MAX_TERMS = C.IMPORT_MAX_TERMS;
  var IMPORT_MAX_RULES = C.IMPORT_MAX_RULES;
  var BACKUP_VERSION = 2;   // صيغة النسخة الاحتياطية — موثّقةٌ في BACKUP-FORMAT.md بمستودع المشروع
  // flash يضع علمًا أثناء عرض الرسالة، فلا تدهسها إعادةُ رسمٍ متزامنة (renderScan مثلًا)
  // isErr اختياري؛ وبغيابه تُستنتج من صدر الرسالة (صيغُ الإخفاق المعتمدة في الصفحة)
  function flash(el, msg, isErr) {
    if (!el) return;
    el.textContent = msg;
    var err = isErr !== undefined ? !!isErr : /^(?:تعذّر|خطأ|فشل|لا يمكن|✗|أُخفق|اختر|لم يُحذف)/.test(msg || "");
    if (el.classList) el.classList.toggle("err", err);
    if (!msg) { delete el.dataset.flashing; return; }
    el.dataset.flashing = "1";
    setTimeout(function () {
      if (el.textContent === msg) el.textContent = "";
      delete el.dataset.flashing;
    }, 3000);
  }
  function norm(s) { return String(s || "").toLowerCase(); }
  // ★ معقِّمٌ واحد لحدود النص (مراجعة كودكس ٢٤): تصحيحُ المستخدم محدودٌ بـ TEXT_MAX (المحرّك نفسه بلا سقف طول منذ ٢١ ربيع
  // الآخر ١٤٤٨هـ، أما المزامنة فلا ترفع مفتاحًا فوقه ولا ترجمةً فوق ضعفه) — فحفظُ ما يتجاوزهما وعدٌ كاذب؛ يُرفض بسببه عند الحفظ والإضافة والاستيراد
  var TEXT_CAP = C.TEXT_MAX || 300;
  function tooLong(en, ar) { return String(en || "").length > TEXT_CAP || String(ar || "").length > TEXT_CAP * 2; }
  function show(id, on) { var el = $(id); if (el) el.classList.toggle("hidden", !on); }
  function setText(id, t) { var el = $(id); if (el) el.textContent = t; }
  // ★ (ر8-د — N4) نصٌّ بمقاطع: السلسلة نصٌّ، و{ltr: …} مضيفٌ أو مسارٌ في <bdi dir="ltr"> — والفواصل العربية بين المعزولات خارجها، فلا
  // يقلبها الخطّ اللاتيني حولها («claude.ai. platform.claude.com/docs.» كانت تُرسم بنقاطٍ مكان الفواصل)
  function setParts(id, parts) {
    var el = $(id);
    if (!el) return;
    el.textContent = "";
    parts.forEach(function (p) {
      if (typeof p === "string") { if (p) el.appendChild(document.createTextNode(p)); return; }
      var b = document.createElement("bdi"); b.dir = "ltr"; b.textContent = p.ltr; el.appendChild(b);
    });
  }
  function ltrList(list, sep) { var out = []; list.forEach(function (x, i) { if (i) out.push(sep); out.push({ ltr: x }); }); return out; }

  // ---------- التواريخ: بالهجري (تقويم أم القرى) — قاعدة المالك في النصوص العربية ----------
  function hDate(ts) {
    var d = new Date(ts || 0);
    try { return d.toLocaleDateString("ar-u-ca-islamic-umalqura-nu-arab", { day: "numeric", month: "long", year: "numeric" }); }
    catch (e) { return d.toISOString().slice(0, 10); }
  }
  function hDateTime(ts) {
    var d = new Date(ts || 0), t = "";
    try { t = d.toLocaleTimeString("ar-u-nu-arab", { hour: "2-digit", minute: "2-digit" }); } catch (e) {}
    return hDate(ts) + (t ? "، " + t : "");
  }
  // تاريخٌ نصّي YYYY-MM-DD (من البناء) بتوقيته المحلي لا UTC — فلا ينزلق يومًا
  function hDateStr(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
    return m ? hDate(new Date(+m[1], +m[2] - 1, +m[3]).getTime()) : "";
  }
  // ★ نظامُ أرقامٍ واحد في السطر الواحد: التاريخ الهجري بالأرقام الهندية (قاعدة المالك)، فالسطر الذي
  // يحمله تُكتب أعدادُه بها أيضًا — لا «وجد 5 نصوص · ١٤ ربيع الآخر». يُطبَّق على السطر بعد تأليفه
  // من نصوصنا وحدها، وقبل ضمّ ما ليس منّا إليه (نصّ خطأٍ من المتصفح مثلًا). وفاصلُ المراتب «٬».
  var AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
  function datedLine(s) {
    return String(s).replace(/(\d),(?=\d{3}(?!\d))/g, "$1٬").replace(/(\d)\.(?=\d)/g, "$1٫")
      .replace(/[0-9]/g, function (c) { return AR_DIGITS.charAt(+c); });
  }

  // ★ التعديل أمرٌ جزئي (رأس applyTermEdits في cml-shared.js): يطبّقه العامل على قراءةٍ طازجة
  // تحت قفل المزامنة، فلا تطمس الصفحةُ دمجًا وقع بين قراءتها وكتابتها. وبلا عاملٍ (صفحات
  // الاختبار) تطبّقه الصفحة بالدالة نفسها. cb(err, report{set, del, rule, unrule, capped, skipped})
  // gen (اختياري): جيل الإدارة عند بدء عمليةٍ تمرّ بحوار تأكيد (readGen) — يرفضها الكاتب إن
  // تغيّر بعدها (إعادة ضبطٍ من تبويبٍ آخر مثلًا) فلا تُكتب على حالٍ لم يره المستخدم
  function readGen(cb) {
    chrome.storage.local.get([C.K.SYNC_GEN], function (r) {
      void chrome.runtime.lastError;
      cb((r && r[C.K.SYNC_GEN]) || 0);
    });
  }
  var STALE_MSG = "تغيّرت الحال أثناء التأكيد (أُعيد الضبط أو تغيّرت المزامنة) — لم يُكتب شيء؛ أعد المحاولة.";
  function hasWorker() { return !!(chrome.runtime && typeof chrome.runtime.sendMessage === "function"); }
  function editTerms(d, ops, cb, gen) {
    function direct() {
      getD(d, ["cml_overrides", "cml_user_patterns", C.K.SYNC_GEN], function (s) {
        if (typeof gen === "number" && (s[C.K.SYNC_GEN] || 0) !== gen) { cb("stale"); return; }
        var res = CMLShared.applyTermEdits(s.cml_overrides, s.cml_user_patterns, LANG, ops,
          { textMax: TEXT_CAP, maxTerms: IMPORT_MAX_TERMS, maxRules: IMPORT_MAX_RULES });
        var w = {};
        if (res.ovChanged) w.cml_overrides = res.overrides;
        if (res.patChanged) w.cml_user_patterns = res.patterns;
        if (!res.ovChanged && !res.patChanged) { cb(null, res.report); return; }
        setD(d, w, function (err) { cb(err || null, res.report); });
      });
    }
    if (!hasWorker()) { direct(); return; }
    try {
      chrome.runtime.sendMessage({ type: "terms-edit", d: d, lang: LANG, ops: ops, gen: gen }, function (res) {
        var e = chrome.runtime.lastError;
        if (e || !res) { cb(e ? (e.message || String(e)) : "لا ردّ من خلفية الإضافة"); return; }
        if (res.error) { cb(res.error); return; }
        cb(null, res.report);
      });
    } catch (e2) { cb(String((e2 && e2.message) || e2)); }
  }
  // تصحيحات الفقرات: كاتبُ مساحتها في العامل؛ وبلا عاملٍ (القشور) مسارٌ مباشر بالحدود نفسها تقريبًا
  function editBlocks(d, ops, cb, gen) {
    function direct() {
      getD(d, ["cml_block_ov", C.K.SYNC_GEN], function (s) {
        if (typeof gen === "number" && (s[C.K.SYNC_GEN] || 0) !== gen) { cb("stale"); return; }
        var all = Object.assign({}, s.cml_block_ov || {}), m = Object.assign({}, all[LANG] || {});
        var rep = { set: 0, del: 0, skipped: 0, capped: 0 };
        ops.forEach(function (o) {
          if (o.op === "del") {
            if (m[o.k] !== undefined && (o.ifv === undefined || m[o.k] === o.ifv)) { delete m[o.k]; rep.del++; }
          } else if (o.op === "set" && /^[0-9a-f]{16}$/.test(o.k) && typeof o.v === "string" &&
                     o.v.length <= (C.BLOCK_VAL_MAX || 8000)) { m[o.k] = o.v; rep.set++; }
          else rep.skipped++;
        });
        all[LANG] = m;
        setD(d, { cml_block_ov: all }, function (err) { cb(err || null, rep); });
      });
    }
    if (!hasWorker()) { direct(); return; }
    try {
      chrome.runtime.sendMessage({ type: "terms-edit", d: d, blocks: true, lang: LANG, ops: ops, gen: gen }, function (res) {
        var e = chrome.runtime.lastError;
        if (e || !res) { cb(e ? (e.message || String(e)) : "لا ردّ من خلفية الإضافة"); return; }
        if (res.error) { cb(res.error); return; }
        cb(null, res.report);
      });
    } catch (e2) { cb(String((e2 && e2.message) || e2)); }
  }
  // ما تُرجم لم يعد «غير مترجَم» — يُنظَّف من نتيجة الفحص المعروضة (ذاكرةُ عرضٍ لا تُزامَن)
  function dropFromScan(d, keys) {
    var gone = Object.create(null);
    keys.forEach(function (k) { gone[k] = 1; });
    getD(d, ["cml_scan_result"], function (s) {
      var sr = s.cml_scan_result;
      if (!sr || !(sr.list || sr.varList)) return;
      var rp = (sr.list || []).filter(function (x) { return !gone[x]; });
      var rv = (sr.varList || []).filter(function (x) { return !gone[x]; });
      var removed = ((sr.list || []).length - rp.length) + ((sr.varList || []).length - rv.length);
      if (!removed) return;
      // `missing` هو العدد الحقيقي وقد يفوق المعروض (القصّ عند 4000)، فيُنقص بما حُذف فعلًا
      setD(d, { cml_scan_result: Object.assign({}, sr, {
        list: rp, varList: rv, missing: Math.max(0, (sr.missing || 0) - removed), shown: rp.length + rv.length,
      }) });
    });
  }

  function download(name, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type || "application/json;charset=utf-8" }));
    var a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  // لاحقة اسم الملف بحسب النطاق: لا شيء للتطبيق وحده، و«-<id>» لموقع، و«-كل-المواقع» للكل
  function fileSuffix() { return isAll() ? "-كل-المواقع" : DOM === "app" ? "" : "-" + DOM; }

  // ---------- حول الإضافة، ونصوص الخصوصية من جدول النطاقات ----------
  function fillAbout() {
    try {
      var m = chrome.runtime.getManifest();
      // ★ (ر8-ب) الاحتياط (مانيفستٌ بلا short_name ولا name — لا يقع في كروم) هو اسم 2.0.0 المختصر كما في options.html، لا اسم 1.0.0
      // (مراجعة ر8-أ، F17)؛ ويمتحنه _optionstest بمانيفستٍ بلا اسم فيقارنه بـshort_name في manifest.json
      $("aboutName").textContent = m.short_name || m.name || "تعريب كلود"; // ★ (ر9-ج) الاسم المختصر بالقرار 100
      $("aboutVersion").textContent = m.version_name || ("v" + (m.version || "—"));
    } catch (e) {}
    var ps = $("privSites");
    if (ps) {
      ps.textContent = "";
      C.DOMAINS.forEach(function (d, i) {
        if (i) ps.appendChild(document.createTextNode(i === C.DOMAINS.length - 1 ? " و" : "، "));
        ps.appendChild(document.createTextNode("«" + d.name + "» ("));
        var b = document.createElement("bdi"); b.dir = "ltr"; b.textContent = C.siteLabel(d.id);
        ps.appendChild(b); ps.appendChild(document.createTextNode(")"));
      });
    }
    var pl = $("privLiveSites");
    if (pl) pl.textContent = namesOf(ALL_IDS.filter(function (d) { return capsOf(d).live.on; })) || "لا موقع";
    var pk = $("privScanKinds");
    if (pk) {
      var parts = [];
      var byKind = function (k) { return ALL_IDS.filter(function (d) { return capsOf(d).scan.kind === k; }); };
      // «ملفات الواجهة» كتسمية الفحص في جدوله (caps.scan.label) — لا «الواجهة البرمجية» التي هي API في الصفحة نفسها
      if (byKind("app").length) parts.push("ملفات الواجهة العامة (التعليمات البرمجية التي يحمّلها متصفحك لعرض الصفحة) في " + namesOf(byKind("app")));
      if (byKind("llms").length) parts.push("فهرس الصفحات العام (llms.txt) في " + namesOf(byKind("llms")));
      pk.textContent = parts.join("، و") || "لا فحص في أيٍّ من المواقع";
    }
    // نسبة الخطوط العربية المضمَّنة (DESIGN-fonts §٣.٤، §٦): من الفهرس، وكل اسمٍ رابطٌ إلى ملف ترخيصه داخل الإضافة
    var fc = $("fontCreditNames"), FL = C.FONTS || [];
    if (fc) {
      fc.textContent = "";
      FL.forEach(function (e, i) {
        if (i) fc.appendChild(document.createTextNode(i === FL.length - 1 ? " و" : "، "));
        var a = document.createElement("a");
        a.href = "fonts/" + e.id + ".OFL.txt"; a.target = "_blank"; a.rel = "noopener"; a.dir = "ltr";
        a.id = "fontCredit_" + e.id; a.textContent = e.family;
        fc.appendChild(a);
      });
    }
    if ($("fontCredits")) show("fontCredits", FL.length > 0);
    // ★ (ر8-د2 — N7) «ما لا تعرّبه» في «حول» بالجملة نفسها التي في بطاقة الترحيب (fillKeep معرَّفةٌ بعدُ، وتُرفع الدالة)
    fillKeep("aboutKeepEn");
  }

  // ---------- القواميس: قاموس كل موقعٍ يُحمَّل عند الحاجة من ملفات الإضافة ----------
  // options.html يحمّل قاموس التطبيق وحده؛ ملفُ النطاق يعلن CLAUDE_L10N فنلتقطه ثم نعيد قاموس التطبيق
  var DICT = {};
  if (globalThis.CLAUDE_L10N) DICT[globalThis.CLAUDE_L10N.domain || "app"] = globalThis.CLAUDE_L10N;
  var APP_L10N = globalThis.CLAUDE_L10N || null;
  function stringsOf(d) {
    var L = DICT[d];
    return (L && L.dicts && L.dicts[LANG] && L.dicts[LANG].strings) || {};
  }
  // (ج٦) وسمُ المعجم المصدر: القاموس الذي يحمل dicts.<لغة>.lex {النص: اسم المعجم} يُظهره بجوار سطره
  function lexOf(d) {
    var L = DICT[d];
    var x = L && L.dicts && L.dicts[LANG] && L.dicts[LANG].lex;
    return x && typeof x === "object" ? x : null;
  }
  var dictWaiters = {};
  function loadDict(d, cb) {
    if (DICT[d]) { cb(); return; }
    var dom = C.domain(d);
    if (!dom) { cb(); return; }
    if (dictWaiters[d]) { dictWaiters[d].push(cb); return; }
    dictWaiters[d] = [cb];
    var done = function () { var w = dictWaiters[d] || []; delete dictWaiters[d]; w.forEach(function (f) { try { f(); } catch (e) {} }); };
    var el = document.createElement("script");
    el.src = dom.dict;
    el.onload = function () {
      if (globalThis.CLAUDE_L10N && globalThis.CLAUDE_L10N.domain === d) DICT[d] = globalThis.CLAUDE_L10N;
      else if (!DICT[d]) DICT[d] = { dicts: {} };
      globalThis.CLAUDE_L10N = APP_L10N;
      refreshLexOption();
      done();
    };
    el.onerror = function () { DICT[d] = { dicts: {} }; done(); };
    document.head.appendChild(el);
  }
  function loadDicts(ids, cb) {
    var k = 0;
    (function next() { if (k >= ids.length) { cb(); return; } loadDict(ids[k++], next); })();
  }
  function refreshLexOption() {
    var o = $("termFilterLex");
    if (!o) return;
    var any = Object.keys(DICT).some(function (d) { return !!lexOf(d); });
    o.disabled = !any;
    // بلا بيانات مصدرٍ في القواميس المحمّلة يبقى الخيار معطّلًا بسببٍ في نصّه (ج٦: الوسم والمرشِّح محجوزان)
    o.textContent = any ? "بحسب المعجم المصدر" : "بحسب المعجم (غير متاح بعد)";
  }
  // BASE/BASE_KEYS: قاموس النطاق الذي يُرسم الآن (يتبدّل في «الكل» نطاقًا نطاقًا)
  var BASE = stringsOf("app");
  var BASE_KEYS = Object.keys(BASE);
  var renderD = "app";
  function useDomain(d) { renderD = d; BASE = stringsOf(d); BASE_KEYS = Object.keys(BASE); }
  var SEARCH_CAP = 60; // سقف العرض: القاموس عشرات الآلاف، ورسمُها كلها يجمّد الصفحة

  function termRow(en, value, opts) {
    // السطر يعمل على نطاقه الذي رُسم فيه (في «الكل» تتجاور أسطر نطاقاتٍ مختلفة)
    var rowD = renderD, rowBase = BASE;
    var row = document.createElement("div"); row.className = "term";
    var src = document.createElement("div"); src.className = "src";
    src.textContent = en;
    if (opts.tag) {
      var tag = document.createElement("span");
      tag.className = "tag" + (opts.mine ? " mine" : "") + (opts.missing ? " miss" : "");
      tag.textContent = opts.tag;
      src.appendChild(tag);
    }
    if (opts.lex) { var lt = document.createElement("span"); lt.className = "tag"; lt.textContent = opts.lex; src.appendChild(lt); }
    // في «الكل» يحمل كل سطرٍ وسمَ موقعه (العنوان الفاصل وحده لا يكفي عند التمرير)
    if (isAll()) { var st = document.createElement("span"); st.className = "tag"; st.textContent = dname(rowD); src.appendChild(st); }
    var inp = document.createElement("input");
    inp.value = value; inp.setAttribute("aria-label", "ترجمة: " + en);
    inp.dataset.en = en;
    // إعادةُ الرسم كانت تُسقط التركيز إلى body بعد الحفظ بلوحة المفاتيح: نعيده إلى السطر نفسه
    if (pendingFocus && pendingFocus.en === en) {
      var pf = pendingFocus; pendingFocus = null;
      setTimeout(function () { try { (pf.btn ? save : inp).focus(); } catch (e) {} }, 0);
    }
    var acts = document.createElement("div"); acts.className = "acts";

    if (opts.missing) inp.placeholder = "اكتب الترجمة…";

    var save = document.createElement("button"); save.textContent = opts.missing ? "ترجمة" : "حفظ";
    save.dataset.en = en;
    save.setAttribute("aria-label", (opts.missing ? "ترجمة: " : "حفظ ترجمة: ") + en); // 44 زرًّا اسمها «حفظ» لا يميّزها قارئ الشاشة
    save.addEventListener("click", function () {
      var v = (inp.value || "").trim();
      if (!v) { flash($("termsStatus"), "اكتب الترجمة أولًا."); return; }
      if (tooLong(en, v)) { flash($("termsStatus"), "تعذّر الحفظ: الترجمة أطول من " + arCount(TEXT_CAP * 2, N.char, true) + "، فلا تُطبَّق ولا تُزامَن."); return; }
      var isRule = VAR_TEST.test(en), same = !isRule && rowBase[en] !== undefined && v === rowBase[en];
      var ops;
      if (isRule) {
        // نصّ بمتغيّرات: يُحفظ قاعدةً ذكية لا مطابقةً حرفية — الحرفية لن تصادف النص المعروض أبدًا
        if (!makePattern(en, v)) { flash($("termsStatus"), "لا تصلح قاعدةً ذكية: انسخ كل {متغيّر} كما هو وأبقِ نصًّا ثابتًا كافيًا."); return; }
        ops = [{ op: "rule", en: en, ar: v }];
      } else if (same) {
        // مطابقة الأصل ⇒ لا داعي لتصحيحٍ يخزَّن ويظهر في قائمتك بلا فائدة
        ops = [{ op: "del", k: en }];
      } else {
        ops = [{ op: "set", k: en, v: v }];
      }
      editTerms(rowD, ops, function (err) {
        if (err) { flash($("termsStatus"), "تعذّر الحفظ — امتلأت مساحة التخزين أو مُنعت الكتابة."); return; }
        renderTerms();
        if (same) { flash($("termsStatus"), "مطابقةٌ للقاموس، فلم تُحفظ تصحيحًا."); return; }
        dropFromScan(rowD, [en]);
        flash($("termsStatus"), isRule ? "حُفظت قاعدةً ذكية تعمل مع كل القيم ✓" : "تم الحفظ ✓");
      });
    });
    acts.appendChild(save);

    if (opts.rule) {
      // القاعدة الذكية تُحذف بهويتها (re) لا بمفتاحٍ حرفي — فهي ليست في cml_overrides أصلًا
      var delR = document.createElement("button");
      delR.className = "btn-danger";
      delR.textContent = "حذف القاعدة";
      delR.setAttribute("aria-label", "حذف القاعدة: " + en);
      delR.addEventListener("click", function () {
        editTerms(rowD, [{ op: "unrule", re: opts.rule.re }], function (err) {
          if (err) { flash($("termsStatus"), "تعذّر الحفظ."); return; }
          renderTerms();
          flash($("termsStatus"), "حُذفت القاعدة الذكية.");
        });
      });
      acts.appendChild(delR);
    } else if (opts.mine) {
      var del = document.createElement("button");
      del.className = "btn-danger";
      // إن كانت المفردة في القاموس الأساسي فالحذف «استعادة» لا إزالة: يعود نصّ القاموس
      del.textContent = rowBase[en] !== undefined ? "استعادة الأصل" : "حذف";
      del.addEventListener("click", function () {
        editTerms(rowD, [{ op: "del", k: en }], function (err) {
          if (err) { flash($("termsStatus"), "تعذّر الحفظ."); return; }
          renderTerms();
          flash($("termsStatus"), rowBase[en] !== undefined ? "استُعيد نصّ القاموس." : "حُذف التصحيح.");
        });
      });
      acts.appendChild(del);
    }

    row.appendChild(src); row.appendChild(inp); row.appendChild(acts);
    return row;
  }

  function group(list, text) {
    var g = document.createElement("div"); g.className = "grp"; g.textContent = text;
    list.appendChild(g);
  }

  // ═══ مصير تصحيحات المستخدم بعد تحديث الإضافة ═══════════════════════════════
  // `chrome.storage.local` **يبقى** عبر التحديثات، فلا شيء يضيع. لكن تصحيحًا صار له مقابلٌ في
  // القاموس يبقى يحجب أي تحسينٍ لاحق — فالمعالجة **مراجعة** لا حذف:
  //   مطابقة  ⇒ لا فائدة منها، ويُعرض حذفها (بضغطة المستخدم وحده).
  //   مختلفة  ⇒ اختيارُه: يُبقيها أو يعود لنصّ القاموس — ولا نقرّر عنه.
  //   منفردة  ⇒ ليست في القاموس أصلًا، فهي ترجمته وحدها ولا تُمسّ.
  // ★ (ل٨) كل موقعٍ بقاموسه هو بعد تحميله (loadDicts) — لا BASE العامة التي قد لا تكون حُمّلت،
  // وفي «الكل» يُراجع كل موقعٍ على حدة
  function reconcile(ov, base) {
    var same = [], diff = [], only = [];
    Object.keys(ov).forEach(function (k) {
      if (base[k] === undefined) only.push(k);
      else if (base[k] === ov[k]) same.push(k);
      else diff.push(k);
    });
    return { same: same, diff: diff, only: only };
  }
  function reconSig(r) { return r.same.length + ":" + r.diff.length; }
  var reconGen = 0;
  function reconData(ids, cb) {
    loadDicts(ids, function () {
      readMany(ids, ["cml_overrides", "cml_recon_dismissed"], function (per) {
        var rows = [];
        ids.forEach(function (d) {
          var ov = ((per[d].cml_overrides || {})[LANG]) || {};
          var r = reconcile(ov, stringsOf(d));
          rows.push({ d: d, r: r, ov: ov, dismissed: per[d].cml_recon_dismissed === reconSig(r) });
        });
        cb(rows);
      });
    });
  }
  function renderRecon() {
    var box = $("reconBox");
    if (!box) return;
    var gen = ++reconGen;
    reconData(scopeIds(), function (rows) {
      if (gen !== reconGen) return;
      var live = rows.filter(function (x) { return (x.r.same.length || x.r.diff.length) && !x.dismissed; });
      if (!live.length) { box.classList.add("hidden"); return; }
      box.classList.remove("hidden");
      var nSame = 0, nDiff = 0;
      live.forEach(function (x) { nSame += x.r.same.length; nDiff += x.r.diff.length; });
      var el = $("reconLines");
      el.textContent = "";
      if (!isAll()) {
        var r = live[0].r;
        [["ما يطابق نصّ القاموس حرفًا بحرف: ", arCount(r.same.length, N.fix), " — لا أثر له، وحذفُه ينظّف قائمتك ويجعلك ترى أي تحسين لاحق في القاموس."],
         ["ما يختلف عن القاموس: ", arCount(r.diff.length, N.fix), " — هذه ترجمتك أنت وهي الظاهرة. راجعها إن شئت، وأبقِ ما تفضّله."],
         ["ما ليس في القاموس أصلًا: ", arCount(r.only.length, N.fix), " — ترجمتك وحدها، ولا يمسّها شيء."]].forEach(function (p) {
          var div = document.createElement("div");
          div.appendChild(document.createTextNode("• " + p[0]));
          var b = document.createElement("b"); b.textContent = p[1]; div.appendChild(b);
          div.appendChild(document.createTextNode(p[2]));
          el.appendChild(div);
        });
      } else {
        // أجزاءٌ مسمّاة بلا الأصفار — «وليس فيه تصحيح واحد» كانت تُقرأ نفيًا لوجود أي تصحيح
        live.forEach(function (x) {
          var div = document.createElement("div"), p = [];
          if (x.r.same.length) p.push("مطابقٌ للقاموس: " + arCount(x.r.same.length, N.fix));
          if (x.r.diff.length) p.push("مخالفٌ له: " + arCount(x.r.diff.length, N.fix));
          if (x.r.only.length) p.push("لا مقابل له في القاموس: " + arCount(x.r.only.length, N.fix));
          div.textContent = "• " + qn(x.d) + ": " + p.join(" · ");
          el.appendChild(div);
        });
      }
      $("reconDropSame").disabled = !nSame;
      $("reconDropSame").textContent = nSame ? "حذف المطابقة (" + nSame + ")" : "لا مطابقة";
      $("reconShowDiff").disabled = !nDiff;
    });
  }
  function reconDropSame() {
    readGen(function (gen0) {
      reconData(scopeIds(), function (rows) {
        var todo = rows.filter(function (x) { return x.r.same.length; });
        if (!todo.length) return;
        var n = 0; todo.forEach(function (x) { n += x.r.same.length; });
        var where = todo.map(function (x) { return qn(x.d) + ": " + arCount(x.r.same.length, N.fix); }).join("، ");
        if (!confirm("سيُحذف من تصحيحاتك ما يطابق نصّ القاموس حرفًا بحرف — " + where + ".\n\n" +
          "لن يتغيّر شيء فيما تراه على الشاشة — القاموس يعطي النصّ نفسه.\n" +
          "والفائدة أن ترى أي تحسين لاحق في هذه النصوص.\n\nأتتابع؟")) return;
        var k = 0, del = 0, failed = null;
        (function next() {
          if (k >= todo.length || failed) {
            renderTerms(); renderRecon();
            if (failed) { flash($("termsStatus"), failed === "stale" ? STALE_MSG : "تعذّر الحفظ."); return; }
            flash($("termsStatus"), "حُذف ما يطابق القاموس (" + arCount(del, N.fix) + ") ✓ (ما تراه على الشاشة لم يتغيّر)");
            return;
          }
          var x = todo[k++];
          // ifv: لا يُحذف إلا ما بقي كما رآه المستخدم (تعديلٌ وصل بين العرض والتأكيد يبقى)
          editTerms(x.d, x.r.same.map(function (key) { return { op: "del", k: key, ifv: x.ov[key] }; }), function (err, rep) {
            if (err) failed = err; else del += rep.del;
            next();
          }, gen0);
        })();
      });
    });
  }
  function reconDismiss() {
    // نحفظ بصمة الحصيلة لا علمًا مجرّدًا: فإن تغيّرت بعد تحديثٍ لاحق ظهرت اللوحة ثانيةً
    reconData(scopeIds(), function (rows) {
      var left = rows.length;
      if (!left) { renderRecon(); return; }
      rows.forEach(function (x) {
        setD(x.d, { cml_recon_dismissed: reconSig(x.r) }, function () { if (!--left) renderRecon(); });
      });
    });
  }

  var pendingFocus = null; // {en, btn}: السطر الذي كان مركَّزًا قبل إعادة الرسم
  var renderGen = 0;
  function renderTerms() {
    var ae = document.activeElement;
    if (ae && ae.dataset && ae.dataset.en) pendingFocus = { en: ae.dataset.en, btn: ae.tagName === "BUTTON" };
    var list = $("termsList");
    if (!list) return;
    var gen = ++renderGen; // رسمٌ أحدث يُلغي ما قبله (تبديلٌ سريع بين النطاقات)
    if (!isAll()) {
      var d0 = DOM;
      loadDict(d0, function () {
        if (gen !== renderGen) return;
        list.innerHTML = "";
        useDomain(d0);
        renderTermsFor(d0, list, true, function () {});
      });
      return;
    }
    // «الكل»: كل نطاقٍ بعنوانه وأسطره، بالتتابع (قواميس الواجهات صغيرة إلا التطبيق)
    list.innerHTML = "";
    var ids = ALL_IDS.slice(), k = 0, any = 0;
    (function next() {
      if (gen !== renderGen) return;
      if (k >= ids.length) {
        useDomain("app");
        if (!any) {
          var e = document.createElement("div"); e.className = "empty";
          var f = ($("termFilter") && $("termFilter").value) || "all";
          e.textContent = f === "missing"
            ? "لا غير مترجَم معروف في أيٍّ من المواقع: شغّل «فحص الترجمة» في المواقع التي لها فحص، أو اختر موقعًا بعينه."
            : "لا تصحيحات ولا نتائج في أيٍّ من المواقع. ابحث أعلاه، أو اختر موقعًا بعينه.";
          list.appendChild(e);
        }
        return;
      }
      var d = ids[k++];
      loadDict(d, function () {
        if (gen !== renderGen) return;
        var box = document.createElement("div");
        list.appendChild(box);
        useDomain(d);
        renderTermsFor(d, box, false, function (n) {
          if (n) {
            any += n;
            var h = document.createElement("div"); h.className = "grp dom";
            h.textContent = "— " + dname(d) + " —";
            box.insertBefore(h, box.firstChild);
          }
          next();
        });
      });
    })();
  }
  function renderTermsFor(d, list, single, done) {
    var q = norm($("termSearch") && $("termSearch").value);
    // التصفية بالمصدر: الكل / قاموس الإضافة (المترجَم) / غير المترجَم من الفحص / تصحيحاتك / المعجم
    var filter = ($("termFilter") && $("termFilter").value) || "all";
    getD(d, ["cml_overrides", "cml_scan_result", "cml_user_patterns"], function (s) {
      useDomain(d);
      var ov = (s.cml_overrides || {})[LANG] || {};
      var sr = s.cml_scan_result;
      var LEX = lexOf(d);
      function empty(txt) { var e = document.createElement("div"); e.className = "empty"; e.textContent = txt; list.appendChild(e); }
      function more(txt) { var m = document.createElement("div"); m.className = "more"; m.textContent = txt; list.appendChild(m); }
      // (ل١٣) موقعٌ بلا فحص: غيرُ المترجَم فيه غير معروف — لا «لا يوجد غير مترجَم» ولا إحالةٌ إلى قسمٍ معطّل
      if (filter === "missing" && !capsOf(d).scan.on) {
        if (single) empty(capsOf(d).scan.why + " فغيرُ المترجَم فيه غير معروفٍ هنا.");
        done(0); return;
      }
      // ★ القواعد الذكية تُعرض مع تصحيحات صاحبها — فيراها ويحذفها وينقلها
      var rules = [];
      if (filter === "all" || filter === "mine") {
        rules = (Array.isArray(s.cml_user_patterns) ? s.cml_user_patterns : []).filter(function (p) {
          return p && typeof p.en === "string" && typeof p.re === "string";
        });
        if (q) rules = rules.filter(function (p) { return norm(p.en).indexOf(q) >= 0 || norm(ruleDisplayAr(p)).indexOf(q) >= 0; });
      }

      // ١) تصحيحاتك (ميزة التعديل فوق المصدر)
      var mine = [];
      if (filter === "all" || filter === "mine" || filter === "diverged") {
        mine = Object.keys(ov).sort();
        // «المختلفة»: لها مقابلٌ في القاموس ونصُّك يخالفه — وهي وحدها التي تحتاج قرارك
        if (filter === "diverged") mine = mine.filter(function (k) { return BASE[k] !== undefined && BASE[k] !== ov[k]; });
        if (q) mine = mine.filter(function (k) { return norm(k).indexOf(q) >= 0 || norm(ov[k]).indexOf(q) >= 0; });
      }

      // ٢) قاموس الإضافة (المترجَم) — بحرف واحد تكون النتائج بالآلاف، فنطلب حرفين
      var searching = q.length >= 2;
      var hits = [], truncated = 0;
      var lexMode = filter === "lex" && !!LEX;
      if (((filter === "all" || filter === "dict") && searching) || lexMode) {
        for (var i = 0; i < BASE_KEYS.length; i++) {
          var k = BASE_KEYS[i];
          if (ov[k] !== undefined) continue;                       // معروضة في «تصحيحاتك»
          if (lexMode && !LEX[k]) continue;
          if (q && norm(k).indexOf(q) < 0 && norm(BASE[k]).indexOf(q) < 0) continue;
          if (hits.length < SEARCH_CAP) hits.push(k); else truncated++;
        }
        hits.sort(function (a, b) { return a.length - b.length || a.localeCompare(b); }); // الأقصر أقرب للمطلوب
      }

      // ٣) غير المترجَم — ما جلبه آخر فحص (يُعرض في تصفيته وحدها لئلا يزدحم «الكل»)
      var missing = [], missTotal = 0, missTrunc = 0;
      if (filter === "missing") {
        var pool = ((sr && sr.list) || []).concat((sr && sr.varList) || []);
        // المعروض قد يكون أقل من الحقيقي (قُصّ عند 4000) — نُظهر الحقيقي في العنوان
        missTotal = (sr && sr.missing) || pool.length;
        pool.forEach(function (k2) {
          if (q && norm(k2).indexOf(q) < 0) return;
          if (missing.length < SEARCH_CAP) missing.push(k2); else missTrunc++;
        });
        missing.sort(function (a, b) { return a.length - b.length || a.localeCompare(b); });
        if (sr && sr.capped) missTrunc += Math.max(0, missTotal - pool.length); // المقصوص لا يُعرض أصلاً
      }

      var shownN = mine.length + hits.length + missing.length + rules.length;
      if (!shownN && !single) { done(0); return; }
      if (!shownN) {
        if (filter === "missing") {
          empty(sr && sr.status === "done"
            ? (missTotal ? "لا نتائج مطابقة لبحثك في غير المترجَم." : "لا نصوص غير مترجَمة — المصدر مطابق لآخر فحص ✓")
            : "لم يُجرَ فحص بعد. شغّله من «فحص الترجمة» أعلاه.");
        } else if (filter === "dict") {
          empty(searching ? "لا نتائج مطابقة في قاموس الإضافة." : "اكتب حرفين على الأقل للبحث في قاموس الإضافة.");
        } else if (filter === "mine") {
          empty(q ? "لا تصحيحات مطابقة." : "لا تصحيحات بعد. عدّل أي ترجمة من القاموس فيُحفظ تعديلك هنا.");
        } else if (filter === "lex") {
          empty(LEX ? "لا نتائج مطابقة." : "لا بيانات مصدرٍ للمصطلحات في قاموس هذا الموقع بعد.");
        } else {
          empty(q
            ? (searching ? "لا نتائج مطابقة." : "اكتب حرفين على الأقل للبحث في القاموس.")
            : "ابحث أعلاه لتجد أي ترجمة وتعدّلها، أو اختر تصفيةً لتصفّح مصدرًا بعينه.");
        }
        done(0);
        return;
      }

      if (mine.length) {
        group(list, filter === "diverged"
          ? "تصحيحاتك التي تخالف القاموس (" + mine.length + ") — «استعادة الأصل» تُرجعك إلى نصّ القاموس"
          : (q ? "تصحيحاتك المطابقة للبحث (" + mine.length + ")" : "تصحيحاتك (" + mine.length + ")"));
        mine.forEach(function (k3) {
          var row = termRow(k3, ov[k3], { mine: true, tag: "تصحيحك" });
          // في «المختلفة» نُظهر نصّ القاموس تحت السطر ليقارن المستخدم ويقرّر
          if (filter === "diverged" && BASE[k3] !== undefined) {
            var hint = document.createElement("div");
            hint.className = "more";
            hint.style.cssText = "grid-column:1/-1;padding:2px 0 0;margin:0";
            hint.textContent = "نصّ القاموس: " + BASE[k3];
            row.appendChild(hint);
          }
          list.appendChild(row);
        });
      }
      if (rules.length) {
        group(list, (q ? "قواعدك الذكية المطابقة للبحث (" : "قواعدك الذكية (") + rules.length +
          ") — تعمل مع كل القيم مكان {المتغيّر}");
        rules.forEach(function (p) {
          list.appendChild(termRow(p.en, ruleDisplayAr(p), { mine: true, rule: p, tag: "قاعدة ذكية" }));
        });
      }
      if (missing.length) {
        group(list, "غير المترجَم من الفحص (" + missing.length + (missTrunc ? " من " + missTotal : "") + ") — اكتب الترجمة واضغط «ترجمة»");
        missing.forEach(function (k4) { list.appendChild(termRow(k4, "", { mine: false, missing: true, tag: "غير مترجَم" })); });
        if (missTrunc) more("وهناك أيضًا " + arCount(missTrunc, N.text) + " لم تُعرض — ضيّق البحث، أو ترجمها دفعةً بأزرار «تنزيل أمر الترجمة» ثم «استيراد الترجمات» أدناه.");
      }
      if (hits.length) {
        group(list, "قاموس الإضافة (" + hits.length + (truncated ? " من " + (hits.length + truncated) : "") + ")");
        hits.forEach(function (k5) { list.appendChild(termRow(k5, BASE[k5], { mine: false, tag: "القاموس", lex: LEX && LEX[k5] })); });
        if (truncated) more("وهناك أيضًا " + arCount(truncated, N.result) + " لم تُعرض — ضيّق البحث لتراها.");
      }
      if (filter === "all" && !searching && q.length === 1) {
        more("اكتب حرفين على الأقل للبحث في قاموس الإضافة.");
      }
      done(shownN);
    });
  }

  // ★ (ل٩) التصحيح لموقعٍ بعينه: في «الكل» يُختار الموقع صراحةً ولا يُفترض — كان يُكتب للتطبيق بصمت
  function addTarget() {
    if (!isAll()) return DOM;
    var sel = $("newDomain");
    var v = sel && sel.value;
    return v && C.domain(v) ? v : null;
  }
  function addTerm() {
    var a = ($("newSrc").value || "").trim(), b = ($("newDst").value || "").trim();
    var d = addTarget();
    if (!d) {
      flash($("termsStatus"), "اختر الموقع الذي يُضاف إليه التصحيح أولًا — في «المواقع كلها» لا يُفترض موقع.", true);
      if ($("newDomain")) $("newDomain").focus();
      return;
    }
    if (!a || !b) { flash($("termsStatus"), "املأ الحقلين."); return; }
    if (tooLong(a, b)) { flash($("termsStatus"), "تعذّر الحفظ: النص أطول من " + arCount(TEXT_CAP, N.char, true) + " أو الترجمة أطول من " + arCount(TEXT_CAP * 2, N.char, true) + "، فلا يُطبَّق ولا يُزامَن."); return; }
    var where = d === "app" && !isAll() ? "" : " إلى " + qn(d);
    // نصٌّ بمتغيّرات قاعدةٌ ذكية هنا كما في حفظ السطر والاستيراد (مسارٌ واحد)
    if (VAR_TEST.test(a)) {
      var pr = makePattern(a, b);
      if (!pr) { flash($("termsStatus"), "لا تصلح قاعدةً ذكية: انسخ كل {متغيّر} كما هو وأبقِ نصًّا ثابتًا كافيًا."); return; }
      editTerms(d, [{ op: "rule", en: a, ar: b }], function (err) {
        if (err) { flash($("termsStatus"), "تعذّر الحفظ — " + err, true); return; }
        $("newSrc").value = ""; $("newDst").value = ""; renderTerms();
        flash($("termsStatus"), "أُضيفت" + where + " قاعدةٌ ذكية تعمل مع كل القيم ✓");
      });
      return;
    }
    editTerms(d, [{ op: "set", k: a, v: b }], function (err) {
      if (err) { flash($("termsStatus"), "تعذّر الحفظ — " + err, true); return; } // كان يعلن النجاح والمخزن خالٍ
      $("newSrc").value = ""; $("newDst").value = ""; renderTerms();
      flash($("termsStatus"), "أُضيف التصحيح" + where + " ✓");
    });
  }

  // تصحيحات نطاقٍ وقواعده بصيغة النسخة الاحتياطية (القواعد بصيغة {الاسم} فيعيدها الاستيراد)
  function termsSection(d, cb) {
    getD(d, ["cml_overrides", "cml_user_patterns", "cml_block_ov"], function (s) {
      // تصحيحات الفقرات (المرحلة ٢): البصمة ← القالب العربي — قسمٌ اختياري في الصيغة ٢ (BACKUP-FORMAT.md)
      var bo = ((s.cml_block_ov || {})[LANG]) || {}, blocks = {}, nB = 0;
      Object.keys(bo).sort().forEach(function (k) { blocks[k] = bo[k]; nB++; });
      var ov = (s.cml_overrides || {})[LANG] || {};
      var arr = Object.keys(ov).sort().map(function (k) { return { en: k, ar: ov[k] }; });
      var rules = (Array.isArray(s.cml_user_patterns) ? s.cml_user_patterns : [])
        .filter(function (p) { return p && typeof p.en === "string" && typeof p.re === "string"; })
        .map(function (p) { return { en: p.en, ar: ruleDisplayAr(p) }; });
      var sec = { terms: arr, rules: rules };
      if (nB) sec.blocks = blocks;
      cb(sec);
    });
  }
  function nBlocks(sec) { return sec && sec.blocks ? Object.keys(sec.blocks).length : 0; }
  // ★ صيغةٌ موثّقة ذات إصدار ونطاق: _version:2 مع domain لنطاقٍ واحد، أو domains لـ«الكل»
  function exportMyTerms() {
    var ids = scopeIds();
    var out = {}, nT = 0, nR = 0, nB = 0, k = 0;
    (function next() {
      if (k < ids.length) {
        var d = ids[k++];
        termsSection(d, function (sec) {
          if (sec.terms.length || sec.rules.length || nBlocks(sec)) {
            out[d] = sec; nT += sec.terms.length; nR += sec.rules.length; nB += nBlocks(sec);
          }
          next();
        });
        return;
      }
      if (!nT && !nR && !nB) { flash($("termsStatus"), "لا تصحيحات ولا قواعد لتصديرها."); return; }
      var file = { _app: "claude-mutarjim", _kind: "terms", _version: BACKUP_VERSION, lang: LANG };
      if (isAll()) file.domains = out;
      else {
        file.domain = DOM; file.terms = out[DOM].terms; file.rules = out[DOM].rules;
        if (out[DOM].blocks) file.blocks = out[DOM].blocks;
      }
      download("تعريب-كلود-تصحيحاتي" + fileSuffix() + ".json", JSON.stringify(file, null, 2));
      flash($("termsStatus"), "تم التصدير (" + arCount(nT, N.fix) + (nR ? " و" + arCount(nR, N.rule) : "") +
        (nB ? " و" + arCount(nB, N.para) : "") + ").");
    })();
  }

  // ★ تصدير المصدر كاملاً — بصيغتين (bare: الإنجليزية وحدها، وإلا مع الترجمات الحالية)، ويُضمّ إليهما
  // ما جلبه آخر فحص ولم يُترجَم. (ل١٠، ل١١) الملف يحمل موقعه: domain لموقعٍ، وdomains لـ«الكل» —
  // كلُّ موقعٍ بقاموسه هو لا بقاموس ما رُسم آخِرًا
  function exportSource(bare) {
    var ids = scopeIds();
    loadDicts(ids, function () {
      readMany(ids, ["cml_overrides", "cml_scan_result"], function (per) {
        var secs = {}, total = 0, untranslated = 0;
        ids.forEach(function (d) {
          var base = stringsOf(d), ov = ((per[d].cml_overrides || {})[LANG]) || {}, sr = per[d].cml_scan_result;
          var seen = Object.create(null), arr = [];
          var push = function (en, ar) {
            if (seen[en]) return;
            seen[en] = 1;
            arr.push({ en: en, ar: bare ? "" : (ar || "") });
          };
          Object.keys(base).forEach(function (k) { push(k, ov[k] !== undefined ? ov[k] : base[k]); });
          Object.keys(ov).forEach(function (k) { push(k, ov[k]); });   // تصحيحات لنصوص خارج القاموس
          ((sr && sr.list) || []).concat((sr && sr.varList) || []).forEach(function (k) {
            if (!seen[k]) untranslated++;
            push(k, "");                                               // غير مترجَم ⇒ يبقى فارغاً في الحالتين
          });
          arr.sort(function (a, b) { return a.en.localeCompare(b.en); });
          secs[d] = { count: arr.length, terms: arr };
          total += arr.length;
        });
        var file = {
          _app: "claude-mutarjim",
          _kind: bare ? "source-bare" : "source-full",
          _version: BACKUP_VERSION,
          _note: bare
            ? "النصوص الإنجليزية وحدها. املأ حقل ar لكل سطر ثم استورد الملف من «استيراد الترجمات»."
            : "النصوص مع ترجماتها الحالية. الأسطر الفارغة هي ما لم يُترجَم بعد.",
          lang: LANG,
        };
        if (isAll()) file.domains = secs;
        else { file.domain = DOM; file.count = secs[DOM].count; file.terms = secs[DOM].terms; }
        download((bare ? "تعريب-كلود-المصدر-بلا-ترجمة" : "تعريب-كلود-المصدر-مترجَمًا") + fileSuffix() + ".json",
          JSON.stringify(file, null, 2));
        flash($("termsStatus"), "صُدِّر " + arCount(total, N.text) + (isAll() ? " من " + arCount(ids.length, N.site, true) : " من " + qn(DOM)) +
          (untranslated ? " (منها ما لم يُترجَم من الفحص: " + untranslated.toLocaleString("en") + ")" : "") + " ✓");
      });
    });
  }

  // parse a terms/translation file into {en:ar} pairs (accepts several shapes)
  // المفتاح يُقصّ ويُسقط الفارغ: المحرّك يقصّ نصّ الصفحة قبل البحث، فمفتاحٌ محفوفٌ ببياض
  // أو فارغ كان يُخزَّن حرفيًّا ولا يطابق شيئًا أبدًا — مدخلٌ ميّت في «تصحيحاتك»
  function putPair(out, k, v) { k = String(k || "").trim(); if (k) out[k] = v; }
  // ★ ملفٌّ منظَّم (نسخة احتياطية أو تصدير أو ردّ أمر الترجمة): الأزواج من terms وrules وحدهما —
  // كان الملف ذو الإصدار بلا terms (فقراتٌ وحدها مثلًا) يسقط إلى فرع «الكائن المسطّح» فتُستورد
  // حقولُ رأسه (_app، _kind، lang، domain…) تصحيحاتٍ للواجهة.
  // والحكم بتوقيع الملف وأنواع قيمه لا بوجود المفتاح: «terms» و«data» و«domain» نصوصٌ حقيقية في
  // واجهات المواقع («terms» ← الشروط)، فكائنٌ مسطّح يترجمها كان يُعدّ منظَّمًا فلا يُستورد منه شيء
  function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
  function isStructured(obj) {
    if (!isObj(obj)) return false;
    return obj._app === "claude-mutarjim" || typeof obj._kind === "string" || typeof obj._version === "number" ||
      Array.isArray(obj.terms) || Array.isArray(obj.rules) || isObj(obj.blocks) || isObj(obj.domains) ||
      (isObj(obj.data) && isObj(obj.data.cml_overrides));
  }
  function parsePairs(obj) {
    var out = {};
    var arr = null;
    if (Array.isArray(obj)) arr = obj;
    else if (isObj(obj) && isObj(obj.data) && isObj(obj.data.cml_overrides)) {
      // اشتراط النصّية: بدونه تُكتب كائنات في القاموس فتظهر «[object Object]» مكان الترجمة
      var o = obj.data.cml_overrides[LANG] || obj.data.cml_overrides.ar || {};
      Object.keys(o).forEach(function (k) { if (typeof o[k] === "string") putPair(out, k, o[k]); });
      return out;
    } else if (obj && typeof obj === "object" && isStructured(obj)) {
      arr = Array.isArray(obj.terms) ? obj.terms : [];
    } else if (isObj(obj)) {
      // كائنٌ مسطّح {الإنجليزي: العربي}: كل قيمةٍ نصّية تصحيح — وما بدأ بشرطةٍ سفلية حقلُ رأسٍ لا نصّ
      Object.keys(obj).forEach(function (k) { if (typeof obj[k] === "string" && k.charAt(0) !== "_") putPair(out, k, obj[k]); });
      return out;
    }
    if (arr) arr.forEach(function (p) { if (p && typeof p.en === "string" && typeof p.ar === "string") putPair(out, p.en, p.ar); });
    // القواعد الذكية (من التصدير ذي الإصدار ٢) بصيغة {الاسم}: الاستيراد يعيد توليدها بالحارس
    if (obj && !Array.isArray(obj) && Array.isArray(obj.rules)) {
      obj.rules.forEach(function (p) {
        if (p && typeof p.en === "string" && typeof p.ar === "string" && VAR_TEST.test(p.en)) putPair(out, p.en, p.ar);
      });
    }
    return out;
  }

  // تصحيحات الفقرات من ملفٍّ: بصمةٌ ست عشرية ← قالبٌ عربي يُحلَّل سليمًا بطولٍ مقبول؛ وما سواه يُترك
  function parseBlocks(d, sec) {
    var out = {};
    if (!capsOf(d).bodies.on || !sec || !sec.blocks || typeof sec.blocks !== "object" || Array.isArray(sec.blocks)) return out;
    Object.keys(sec.blocks).forEach(function (k) {
      var v = sec.blocks[k];
      if (/^[0-9a-f]{16}$/.test(k) && typeof v === "string" && v.trim() && v.length <= (C.BLOCK_VAL_MAX || 8000) &&
          CMLShared.parseTemplate(v)) out[k] = v.trim();
    });
    return out;
  }

  // ---------- توليد القواعد الذكية ----------
  // النسخة الواحدة في cml-shared.js (حُقن قبلنا في options.html) — هنا أسماء محلية فقط.
  var VAR_RE = CMLShared.VAR_RE;
  var makePattern = CMLShared.makePattern;
  var VAR_TEST = /\{[A-Za-z_$][\w$]*\}/;
  // القاعدة المخزَّنة تحمل ar بصيغة القالب ($1 $2)؛ العرض والتصدير بصيغة الإدخال {الاسم}
  function ruleDisplayAr(p) {
    var names = [], m, R = new RegExp(VAR_RE.source, "g");
    while ((m = R.exec(String(p.en || "")))) names.push(m[1]);
    return String(p.ar || "").replace(/\$(\d)/g, function (t, d) {
      var nm = names[+d - 1];
      return nm === undefined ? t : "{" + nm + "}";
    });
  }
  function plainTpl(s) {
    return String(s).replace(/<c(\d+)>([\s\S]*?)<\/c\1>/g, "$2").replace(/<\/?[abisgc]\d+\/?>/g, "");
  }

  // (ل١٠) الملف بلا حقل موقع يُسأل عن موقعه — والافتراض الموقع المختار، ولا افتراض في «الكل»
  function askDomain(cb) {
    var box = $("importAsk"), sel = $("importAskSel");
    if (!box || !sel) { cb(isAll() ? null : DOM); return; } // قشور الاختبار: الموقع المختار
    sel.innerHTML = "";
    var ph = document.createElement("option"); ph.value = ""; ph.textContent = "اختر الموقع…";
    sel.appendChild(ph);
    ALL_IDS.forEach(function (d) { var o = document.createElement("option"); o.value = d; o.textContent = dname(d); sel.appendChild(o); });
    sel.value = isAll() ? "" : DOM;
    var st = $("importAskStatus");
    if (st) flash(st, "");
    box.classList.remove("hidden");
    try { sel.focus(); } catch (e) {}
    // إغلاق السؤال: التركيز إلى زرّ الاستيراد قبل الإخفاء — وإلا سقط إلى body مع العنصر المخفي
    function close() {
      var back = $("scanImportBtn");
      if (back) { try { back.focus(); } catch (e) {} }
      box.classList.add("hidden");
    }
    // خصائص لا مستمعون: كل سؤالٍ يستبدل نداءه فلا تتراكم
    $("importAskGo").onclick = function () {
      // الخطأ بجوار المُنتقي نفسه (لا في بطاقةٍ أخرى قد تكون معطّلة أو خارج الشاشة)
      if (!sel.value) { flash(st, "اختر الموقع الذي يُستورد إليه الملف أولًا.", true); try { sel.focus(); } catch (e) {} return; }
      close();
      cb(sel.value);
    };
    $("importAskCancel").onclick = function () { close(); cb(null); };
  }

  function importTermsFile(file, statusEl) {
    // سقف الحجم قبل القراءة: ملف بمئات الميغابايتات يجمّد التبويب في FileReader نفسه
    if (file && file.size > IMPORT_MAX_BYTES) {
      flash(statusEl, "الملف أكبر من اللازم (" + Math.round(file.size / 1048576) + " ميغابايت). الحدّ الأقصى 5 ميغابايت.");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var obj; try { obj = JSON.parse(reader.result); } catch (e) { flash(statusEl, "ملف غير صالح."); return; }
      // أقسام بحسب النطاق: domains للنسخة الشاملة، وdomain لنطاقٍ واحد، والملف بلا نطاق يُسأل عنه
      var sections = [], unknown = [];
      // حقلا الموقع يُقرآن من الملف المنظَّم وحده: «domain» في كائنٍ مسطّح نصٌّ من الواجهة لا اسمُ موقع
      if (isStructured(obj) && isObj(obj.domains)) {
        Object.keys(obj.domains).forEach(function (d) {
          if (!C.domain(d)) { unknown.push(d); return; }
          sections.push({ d: d, pairs: parsePairs(obj.domains[d]), blocks: parseBlocks(d, obj.domains[d]) });
        });
        confirmImport(obj, sections, unknown, false, statusEl);
      } else if (isStructured(obj) && typeof obj.domain === "string") {
        if (C.domain(obj.domain)) sections.push({ d: obj.domain, pairs: parsePairs(obj), blocks: parseBlocks(obj.domain, obj) });
        else unknown.push(obj.domain);
        confirmImport(obj, sections, unknown, false, statusEl);
      } else {
        askDomain(function (d) {
          if (!d) { flash(statusEl, "أُلغي الاستيراد."); return; }
          sections.push({ d: d, pairs: parsePairs(obj), blocks: obj && !Array.isArray(obj) ? parseBlocks(d, obj) : {} });
          confirmImport(obj, sections, unknown, true, statusEl);
        });
      }
    };
    reader.readAsText(file);
  }
  function confirmImport(obj, sections, unknown, asked, statusEl) {
    var nT = 0, nR = 0, nB = 0;
    sections.forEach(function (x) {
      x.keys = Object.keys(x.pairs).filter(function (k) { return typeof x.pairs[k] === "string" && x.pairs[k].trim(); });
      x.nRules = x.keys.filter(function (k) { return VAR_TEST.test(k); }).length;
      x.bkeys = Object.keys(x.blocks);
      nT += x.keys.length - x.nRules; nR += x.nRules; nB += x.bkeys.length;
    });
    sections = sections.filter(function (x) { return x.keys.length || x.bkeys.length; });
    if (!nT && !nR && !nB) {
      flash(statusEl, unknown.length ? "الملف لموقعٍ لا تعرفه الإضافة (" + unknown.join("، ") + ") — لم يُستورد شيء." : "لا ترجمات في الملف.");
      return;
    }
    // ★ تأكيد صريح قبل الكتابة بعدٍّ صحيح لكل صنف ومعاينةٍ له: الملف يستطيع تغيير نصّ أي زرّ في
    // مواقع Claude، فمن حقّ المستخدم أن يرى ماذا يدخل — وتصحيحاتُ الفقرات منه
    function parts(t, r, b) {
      var p = [];
      if (t) p.push(arCount(t, N.fix));
      if (r) p.push(arCount(r, N.rule));
      if (b) p.push(arCount(b, N.para));
      return p.join(" و");
    }
    var where = sections.map(function (x) { return qn(x.d) + ": " + parts(x.keys.length - x.nRules, x.nRules, x.bkeys.length); }).join("\n  ");
    var sample = [], bsample = [];
    sections.forEach(function (x) {
      x.keys.forEach(function (k) { if (sample.length < 5) sample.push("  " + k + "  ←  " + x.pairs[k]); });
      x.bkeys.forEach(function (k) {
        if (bsample.length >= 3) return;
        var t = plainTpl(x.blocks[k]);
        bsample.push("  " + (t.length > 90 ? t.slice(0, 90) + "…" : t));
      });
    });
    // ملفٌّ من إصدارٍ أحدث (BACKUP-FORMAT.md): يُستورد ما تفهمه هذه النسخة ويُصرَّح بذلك
    var newer = obj && obj._app === "claude-mutarjim" && typeof obj._version === "number" && obj._version > BACKUP_VERSION;
    var msg = "سيُستورد " + parts(nT, nR, nB) + ":\n  " + where +
      (asked ? "\n\n(الملف لا يذكر موقعه، فيُستورد إلى " + qn(sections[0].d) + " كما اخترت.)" : "") +
      (sample.length ? "\n\nأول التصحيحات:\n" + sample.join("\n") : "") +
      (bsample.length ? "\n\nأول تصحيحات الفقرات:\n" + bsample.join("\n") : "") +
      (unknown.length ? "\n\n(ويُتجاهل قسمٌ لموقعٍ مجهول: " + unknown.join("، ") + ")" : "") +
      (newer ? "\n\n(الملف من إصدارٍ أحدث من الإضافة: يُستورد منه ما تفهمه هذه النسخة — التصحيحات والقواعد والفقرات — ويُترك غيره.)" : "") +
      "\n\n⚠ ملف الترجمة يغيّر نصوص الأزرار والتسميات — فلا تستورد إلا من مصدر تثق به.\n\nأتتابع؟";
    readGen(function (gen0) {
      if (!confirm(msg)) { flash(statusEl, "أُلغي الاستيراد."); return; }
      var k2 = 0, sum = { plain: 0, pat: 0, skip: 0, capped: 0, blocks: 0 }, failed = null;
      (function next() {
        if (k2 >= sections.length || failed) {
          renderTerms(); renderBlocks(); renderStats();
          if (failed) { flash(statusEl, failed); return; }
          var m2 = "تم استيراد " + arCount(sum.plain + sum.pat, N.line, true) + " ✓";
          if (sum.pat) m2 += " (منها قواعد ذكية: " + arCount(sum.pat, N.rule) + ")";
          if (sum.blocks) m2 += " و" + arCount(sum.blocks, N.para);
          if (sum.skip) m2 += " — وأُهمل ما لا يصلح (قاعدةٌ ذكية غير صالحة أو نصٌّ أطول من الحدّ: " + arCount(sum.skip, N.line) + ")";
          if (sum.capped) m2 += " — وما تجاوز الحدَّ الأقصى لم يُستورد: " + arCount(sum.capped, N.line);
          flash(statusEl, m2);
          return;
        }
        var sec = sections[k2++];
        var afterPairs = function (res) {
          if (res.error) { failed = res.error; next(); return; }
          sum.plain += res.plain; sum.pat += res.pat; sum.skip += res.skip; sum.capped += res.capped;
          if (!sec.bkeys.length) { next(); return; }
          // تصحيحات الفقرات إلى مساحتها (مفاتيحُها بصمات، وقوالبها فُحصت في parseBlocks)
          editBlocks(sec.d, sec.bkeys.map(function (k) { return { op: "set", k: k, v: sec.blocks[k], cap: 1 }; }), function (err, rep) {
            if (err) failed = err === "stale" ? STALE_MSG : "تعذّر حفظ تصحيحات الفقرات.";
            else { sum.blocks += rep.set; sum.skip += rep.skipped; sum.capped += rep.capped; }
            next();
          }, gen0);
        };
        if (sec.keys.length) importInto(sec.d, sec.pairs, sec.keys, afterPairs, gen0);
        else afterPairs({ plain: 0, pat: 0, skip: 0, capped: 0 });
      })();
    });
  }

  function importInto(tgt, pairs, keys, done, gen) {
    // أمرٌ جزئي واحد للقسم كله (رأس editTerms): السقوف والمعقِّم يطبّقها العامل على قراءةٍ طازجة
    var ops = [], taken = [], nSkip = 0;
    keys.forEach(function (k) {
      var v = pairs[k];
      if (typeof v !== "string" || !v || tooLong(k, v)) { nSkip++; return; }   // لا يُطبَّق ولا يُزامَن
      if (VAR_TEST.test(k)) {
        if (!makePattern(k, v)) { nSkip++; return; }        // فشل حارس الأمان — تُتجاهل بأمان
        ops.push({ op: "rule", en: k, ar: v, cap: 1 });
      } else {
        ops.push({ op: "set", k: k, v: v, cap: 1 });        // السقف على الجديد لا على تحديث الموجود
      }
      taken.push(k);
    });
    editTerms(tgt, ops, function (err, rep) {
      if (err) { done({ error: err === "stale" ? STALE_MSG : "تعذّر الحفظ — امتلأت مساحة التخزين أو مُنعت الكتابة. لم يُحفظ هذا القسم." }); return; }
      dropFromScan(tgt, taken);
      done({ plain: rep.set, pat: rep.rule, skip: nSkip + rep.skipped, capped: rep.capped });
    }, gen);
  }

  // الأمر الكامل (التعليمات + النصوص لكل موقع) — يُكتب في الملف نفسه لا في الحافظة وحدها.
  // secs = [{d, keys, varKeys}]؛ والردّ المطلوب يحمل موقعه (domain أو domains) فيعود الاستيراد إليه
  function buildPrompt(secs) {
    var many = secs.length > 1, total = 0;
    secs.forEach(function (s) { total += s.keys.length + s.varKeys.length; });
    var where = secs.map(function (s) { return C.siteLabel(s.d); }).join("، ");
    var fmt = many
      ? '{"domains": {' + secs.map(function (s) { return '"' + s.d + '": [{"en":"…","ar":"…"}]'; }).join(", ") + "}}"
      : '{"domain": "' + secs[0].d + '", "terms": [{"en":"النص الإنجليزي كما هو","ar":"الترجمة العربية"}]}';
    var out = [
      "ترجم نصوص واجهة المستخدم التالية (من " + (many ? "المواقع: " : "موقع ") + where + ") إلى العربية.",
      "",
      "القواعد:",
      "1) عربية فصحى موجزة بأسلوب واجهات البرامج — لا حشو ولا ترجمة حرفية ركيكة.",
      "2) تبقى إنجليزية كما هي: Claude، Anthropic، Cowork، Opus، Sonnet، Haiku، Fable، Max،",
      "   MCP، API، SDK، CLI، JSON، URL، PDF، CSV، GitHub، Google، Slack، Chrome، Windows،",
      "   macOS، Linux، iOS، Android، وأسماء الملفات والمسارات والتعليمات البرمجية.",
      "3) أسماء الميزات الكبرى: تُكتب «الترجمة (English)» إذا كان النص عنوانًا أو زرًّا مستقلًّا",
      "   — مثل: المشاريع (Projects)، المُخرَجات (Artifacts)، المهارات (Skills)،",
      "   الموصّلات (Connectors)، الذاكرة (Memory)، البرمجة (Code)، العمل المشترك (Cowork).",
      "   أما داخل الجُمل فتُستعمل العربية وحدها بلا قوسين.",
      "   ملاحظة: «Code» تعني «البرمجة» لا «الأكواد».",
      "4) إن كان النص علامة تجارية أو رمزًا برمجيًّا لا يُترجم، اجعل ترجمته مطابقة للأصل.",
      "5) حافظ على الرموز في مواضعها: %d و{...} والنقاط الثلاث … وعلامات مثل ×.",
      "6) وحّد ترجمة المصطلح الواحد في كل النصوص.",
      "",
      "أعد النتيجة **بصيغة JSON فقط** بلا أي شرح قبلها أو بعدها، وبهذا الشكل تمامًا" + (many ? " (كل موقعٍ تحت اسمه)" : "") + ":",
      fmt,
      "",
      "احرص أن يكون حقل en منسوخًا حرفيًّا بلا تغيير في علامات الترقيم أو المسافات،",
      "وأن يكون عدد العناصر مساويًا لمجموع الأسطر أدناه (" + total + ").",
    ];
    secs.forEach(function (s) {
      if (many) out.push("", "## الموقع " + s.d + " — " + dname(s.d) + " (" + C.siteLabel(s.d) + ")");
      out.push("", "### نصوص ثابتة (" + arCount(s.keys.length, N.line) + ")", "----------------------------------------", s.keys.join("\n"));
      if (s.varKeys.length) {
        out.push("",
          "### نصوص فيها متغيّرات (" + arCount(s.varKeys.length, N.line) + ")",
          "هذه تتحول عندي إلى قواعد ذكية تعمل مع كل القيم، فالتزم بها:",
          "- انسخ كل متغيّر بين قوسين معقوفين **كما هو حرفيًّا** ({count}، {name}…) ولا تترجمه ولا تغيّر اسمه.",
          "- ضع المتغيّر في موضعه الطبيعي من الجملة العربية.",
          "- لا تحذف متغيّرًا ولا تخترع متغيّرًا غير موجود في الأصل.",
          "مثال: \"Delete {count} chats?\" ← \"حذف {count} محادثة؟\"",
          "----------------------------------------",
          s.varKeys.join("\n"));
      }
    });
    return out.join("\n");
  }

  // ═══ التغطية المشحونة (وقت البناء): فهرس المتون bodies/<موقع>/<لغة>/index.json ═══
  // لمواقع المقالات: {pages: المعرَّب، harvested: المحصود، harvestedAt} — ملفٌّ من الإضافة نفسها لا شبكة
  var COVER = {};
  function loadCover(d, cb) {
    if (COVER[d] !== undefined) { cb(COVER[d]); return; }
    if (!capsOf(d).bodies.on) { COVER[d] = null; cb(null); return; }
    var url = null;
    try { url = chrome.runtime.getURL("bodies/" + d + "/" + LANG + "/index.json"); } catch (e) {}
    if (!url || typeof fetch !== "function") { COVER[d] = null; cb(null); return; }
    fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (x) {
      if (!x || typeof x !== "object") COVER[d] = null;
      else COVER[d] = {
        pages: typeof x.pages === "number" ? x.pages : (Array.isArray(x.shards) ? x.shards.length : 0),
        harvested: typeof x.harvested === "number" ? x.harvested : null,
        harvestedAt: typeof x.harvestedAt === "string" ? x.harvestedAt : null,
      };
      cb(COVER[d]);
    }, function () { COVER[d] = null; cb(null); });
  }
  function loadCovers(ids, cb) {
    var k = 0;
    (function next() { if (k >= ids.length) { cb(); return; } loadCover(ids[k++], next); })();
  }
  // بلا بياناتٍ مشحونة لا شيء (لا «متون» ولا «تغطية» — مصطلحا بناءٍ داخليان). وبها تسمياتٌ لا تحتاج
  // مطابقة المعدود وصفتِه («من صفحتين محصودة» كانت خطأً)، وبتاريخٍ هجري فأرقام السطر أرقامُه
  function coverText(d) {
    if (!capsOf(d).bodies.on) return "";
    var x = COVER[d];
    if (!x) return "";
    var t = "الصفحات المعرَّبة: " + x.pages.toLocaleString("en") +
      (x.harvested ? " · المحصودة من الموقع: " + x.harvested.toLocaleString("en") : "") +
      (x.harvestedAt ? " · حصاد " + hDateStr(x.harvestedAt) : "") + " — تُحدَّث مع كل إصدارٍ للإضافة.";
    return x.harvestedAt ? datedLine(t) : t;
  }

  // ═══ حجم الترجمة (★ ر8-د، ١ جمادى الأولى ١٤٤٨هـ — N5): يُحسب وقت البناء ويُشحن في قاموس كل موقع (dicts.<لغة>.counts) ═══
  // strings نصوص الواجهة المترجَمة، وblocks فقرات المقالات المشحونة (★ المراجعة: ما تشير إليه صفحاتها وحده)، وwords الكلمات العربية
  // فيهما — والصفحة تعرضها ولا تعدّ شيئًا. كان عمود
  // «القاموس» نصوصَ الواجهة وحدها فبدا claude.ai أكبر المواقع، ومركزُ المساعدة ووثائق المطوّرين أكبر منه بمقالاتهما
  function sizeOf(d) {
    var L = DICT[d], c = L && L.dicts && L.dicts[LANG] && L.dicts[LANG].counts;
    return c && typeof c === "object" ? c : null;
  }
  function numOf(n) { return (Number(n) || 0).toLocaleString("en"); }
  // الكلمات مقرَّبةً في خلية الجدول: «≈ 298 ألفًا»، و«≈ 1.03 مليون»، وما دون الألف بعدده
  // ★ (ر8-د، المراجعة) وما يُقرَّب إلى ألف ألف (999,500 فأكثر) يُكتب بالمليون لا «1,000 ألف»
  function wordsShort(n) {
    n = Number(n) || 0;
    if (!n) return "—";
    if (n < 1000) return numOf(n);
    var k = Math.round(n / 1000);
    if (k < 1000) return "≈ " + (k === 1 ? "ألف" : arCount(k, N.thou));
    return "≈ " + (Math.round(n / 1e4) / 100).toLocaleString("en") + " مليون";
  }
  // والعبارة في السطر: «نحو 298 ألف كلمة عربية» (الألف مضافٌ إلى الكلمة)
  function wordsPhrase(n) {
    n = Number(n) || 0;
    if (n < 1000) return "<b>" + esc(arCount(n, N.word)) + "</b> عربية";
    var k = Math.round(n / 1000), m = k % 100;
    if (k >= 1000) return "نحو <b>" + (Math.round(n / 1e4) / 100).toLocaleString("en") + " مليون</b> كلمة عربية";
    return "نحو <b>" + (k === 1 ? "ألف" : k === 2 ? "ألفا" : numOf(k) + (m >= 3 && m <= 10 ? " آلاف" : " ألف")) + "</b> كلمة عربية";
  }
  function sizeHtml(c) {
    var t = "<b>" + esc(arCount(c.strings, N.text)) + "</b> للواجهة";
    if (c.blocks) t += " و<b>" + esc(arCount(c.blocks, N.parag)) + "</b> من المقالات";
    return t + (c.words ? "، " + wordsPhrase(c.words) : "");
  }

  // ═══ الإحصاء: دائرتا التغطية للموقع المفحوص، وفي «الكل» على المواقع المفحوصة وحدها + جدولٌ لكل موقع ═══
  // (ل١٢) لا يُقسم مقامٌ على غير جنسه: القاموس يُعدّ لكل موقع، والتغطية من فحص الموقع نفسه
  var DONUT_C = 201.06; // محيط الدائرة r=32
  function setDonut(el, pct) {
    if (!el) return;
    el.setAttribute("stroke-dasharray", (pct / 100 * DONUT_C).toFixed(1) + " " + DONUT_C);
    el.classList.toggle("zero", !(pct > 0));
  }
  var statsGen = 0;
  function renderStats() {
    var line = $("statLine");
    if (!$("donutT") || !line) return; // صفحة اختبار بلا دوائر
    var gen = ++statsGen, ids = scopeIds();
    loadDicts(ids, function () {
      readMany(ids, ["cml_scan_result", "cml_overrides", "cml_user_patterns", "cml_block_ov", C.K.BAD_RULES], function (per) {
        loadCovers(ids, function () {
          if (gen !== statsGen) return;
          var F = 0, M = 0, scanned = [], scannable = ids.filter(function (d) { return capsOf(d).scan.on; });
          ids.forEach(function (d) {
            var r = per[d].cml_scan_result;
            if (capsOf(d).scan.on && r && r.status === "done" && r.found > 0) {
              F += r.found; M += Math.min(r.missing || 0, r.found); scanned.push(d);
            }
          });
          var pctU = F ? Math.min(100, Math.round(M / F * 100)) : 0;
          setDonut($("donutT"), F ? 100 - pctU : 0);
          setDonut($("donutU"), F ? pctU : 0);
          setText("pctT", F ? (100 - pctU) + "٪" : "؟");
          setText("pctU", F ? pctU + "٪" : "؟");
          // (§٥-٤) الدائرتان لموقعٍ له فحص وحده — ولغيره سطرُ القاموس بلا دوائر فارغة
          show("donutBoxT", scannable.length > 0);
          show("donutBoxU", scannable.length > 0);
          // ★ (ر8-د — N5) حجم الترجمة من البناء لا من عدّ القاموس المحمَّل
          var sz = function (d) { var c = sizeOf(d); return c ? sizeHtml(c) : "<b>—</b>"; };
          var html = "";
          if (!isAll()) {
            var d = DOM, r = per[d].cml_scan_result;
            if (!capsOf(d).scan.on) {
              html = "قاموس " + esc(qn(d)) + ": " + sz(d) + "؛ يُحدَّث مع كل إصدارٍ للإضافة. " + esc(capsOf(d).scan.why) +
                (coverText(d) ? "<br>" + esc(coverText(d)) : "");
            } else if (F) {
              // تسمياتٌ لا تحتاج مطابقة المعدود («وجد 5 عنوانًا» كانت خطأً)، وبتاريخٍ هجري فأرقام السطر أرقامُه
              html = datedLine("قاموس " + esc(qn(d)) + ": " + sz(d) + " · آخر فحص (" + esc(hDate(r.at)) + "): " +
                (r.source === "llms" ? "العناوين" : "النصوص") + " <b>" + r.found.toLocaleString("en") + "</b>، وغيرُ المترجَم منها <b>" +
                (r.missing || 0).toLocaleString("en") + "</b>.") +
                ((r.missing || 0)
                  ? " <b>لترجمتها:</b> «تنزيل أمر الترجمة» ثم «استيراد الترجمات» أدناه، أو اختر «غير المترجَم» في التصفية."
                  : " المصدر مطابق لآخر فحص ✓");
            } else {
              html = "قاموس " + esc(qn(d)) + ": " + sz(d) + ". لقياس نسبة التغطية وجلب غير المترجَم، شغّل «فحص الترجمة» أعلاه.";
            }
          } else {
            // ★ (ر8-د — N5) المجموع من أحجام المواقع المشحونة: نصوص الواجهة وفقرات المقالات والكلمات العربية
            var tot = { strings: 0, blocks: 0, words: 0 };
            ids.forEach(function (x) { var c = sizeOf(x) || {}; tot.strings += c.strings || 0; tot.blocks += c.blocks || 0; tot.words += c.words || 0; });
            // نصوص التطبيق وعناوين الوثائق كلٌّ باسمه — لا تُجمع في «نصًّا» واحدة
            var parts = scanned.map(function (x) {
              var rx = per[x].cml_scan_result;
              return esc(qn(x)) + ": " + (rx.source === "llms" ? "العناوين" : "النصوص") + " <b>" + rx.found.toLocaleString("en") +
                "</b>، وغيرُ المترجَم منها <b>" + Math.min(rx.missing || 0, rx.found).toLocaleString("en") + "</b>";
            });
            html = "في " + esc(arCount(ids.length, N.site, true)) + ": " + sizeHtml(tot) + ". " +
              (F ? "الدائرتان على المواقع المفحوصة وحدها — " + parts.join("؛ ") + "."
                 : scannable.length ? "لا فحص بعد في المواقع التي لها فحص (" + esc(namesOf(scannable)) + ")." : "") +
              " والتفصيل لكل موقعٍ في الجدول أدناه.";
          }
          ids.forEach(function (d) {
            var br = per[d][C.K.BAD_RULES];
            var n = br ? (br.patterns || 0) + (br.plurals || 0) : 0;
            // القواعد الفاسدة تُصرَّح لا تُبتلع: المحرك يعدّها في compile ويكتبها متى تغيّرت
            if (n) html += "<br>⚠ " + (isAll() ? esc(qn(d)) + ": " : "") + "<b>" + n + "</b> من قواعدك المحفوظة تالفةٌ لا تُطبَّق — أعد استيرادها، أو احذفها من «تصحيحاتك».";
          });
          line.innerHTML = html;
          renderStatsTable(ids, per);
        });
      });
    });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function renderStatsTable(ids, per) {
    var tbl = $("statsTable"), body = $("statsBody");
    if (!tbl || !body) return;
    tbl.classList.toggle("hidden", !isAll());
    if (!isAll()) return;
    body.textContent = "";
    ids.forEach(function (d) {
      var p = per[d], r = p.cml_scan_result, cap = capsOf(d);
      var cov;
      if (cap.scan.on) cov = r && r.status === "done" && r.found > 0
        ? datedLine(Math.max(0, 100 - Math.round((r.missing || 0) / r.found * 100)) + "٪ من " + r.found.toLocaleString("en") + " (" + hDate(r.at) + ")")
        : "لم يُفحص بعد";
      else cov = coverText(d) || "—";
      var ov = ((p.cml_overrides || {})[LANG]) || {};
      var rules = Array.isArray(p.cml_user_patterns) ? p.cml_user_patterns.length : 0;
      var bo = ((p.cml_block_ov || {})[LANG]) || {};
      var tr = document.createElement("tr");
      // ★ (ر8-د — N5) «نصوص الواجهة» و«فقرات المقالات» و«الكلمات» من البناء (sizeOf) مكان «القاموس»؛ وأعمدة تصحيحاتك كما هي
      var sc = sizeOf(d);
      [["الموقع", dname(d)], ["نصوص الواجهة", sc ? numOf(sc.strings) : "—"], ["فقرات المقالات", sc && cap.bodies.on ? numOf(sc.blocks) : "—"],
       ["الكلمات", sc ? wordsShort(sc.words) : "—"], ["التغطية", cov],
       ["تصحيحاتك", String(Object.keys(ov).length)], ["قواعدك", String(rules)],
       ["الفقرات", cap.bodies.on ? String(Object.keys(bo).length) : "—"]].forEach(function (c, i) {
        var td = document.createElement("td"); td.setAttribute("data-label", c[0]); td.textContent = c[1];
        if (i >= 1 && i <= 3) td.id = "size_" + ["", "strings", "blocks", "words"][i] + "_" + d;
        if (i) td.className = c[0] === "التغطية" ? "cov" : "num"; // سطر التغطية يلتفّ (لا فيضان على الهاتف)
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }

  // ═══ الفحصان (الترجمة والاتجاه): منسّقٌ واحد بالتتابع — طلبٌ بنطاقه، وانتظار النتيجة، ثم التالي ═══
  // المحرّك يرشّح الطلبات بنطاقها (reqForMe)، والمحكّم في العامل يمنع زحفين معًا — فالتتابع يوافقه.
  // موقعٌ بلا تبويبٍ مفتوح لا يُفشل الكل: يُذكر ويُتجاوز إلى ما بعده (قرار المالك: «الكل بالتتابع
  // ونتائج مفصولة» — كلٌّ في مفتاح نطاقه).
  var reqSeq = 0;
  function newRequest(kind, d) {
    reqSeq++;
    return { d: d || "app", kind: kind, at: Date.now(),
             id: Date.now().toString(36) + "-" + reqSeq + "-" + Math.floor(Math.random() * 1e9).toString(36) };
  }
  var JOBK = {
    scan: { res: C.K.SCAN_RESULT, req: C.K.SCAN_REQUEST, cap: "scan", wait: 12, kind: "scan" },
    rtldoc: { res: C.K.RTLDOC_RESULT, req: C.K.RTLDOC_REQUEST, cap: "rtlDoc", wait: 20, kind: "rtldoc" },
  };
  var JOB = { scan: null, rtldoc: null };
  // ملاحظةٌ عابرة لكل موقع: {k: "sent"|"noTab"|"stalled"|"stopped"|"master"|"off"|"noAccess"}
  var NOTE = { scan: {}, rtldoc: {} };
  // سطرُ ختام آخر تشغيلٍ في «الكل» (صفًّا واحدًا كان أو المواقع كلها) — يبقى حتى تشغيلٍ آخر أو تبديل الموقع
  var END = { scan: "", rtldoc: "" };
  function stalled(r) { return !r.at || Date.now() - r.at > C.HEARTBEAT_STALL_MS; }
  // أين يُفتح التبويب: المضيف ومساره (platform.claude.com/docs) — صفحاتُ المضيف خارج المسار لا تفحص
  function tabWhere(d) { return C.siteLabel(d) || hostOf(d); }
  // لماذا لا يعمل موقعٌ الآن — ثلاثة أسبابٍ متمايزة ولكلٍّ علاجُه (ج٣): الرئيس، أو مفتاحه، أو وصول المتصفح
  function offReason(d) { return !RUN.master ? "master" : RUN.site[d] === false ? "off" : RUN.access[d] === false ? "noAccess" : null; }
  function jobRender(kind) { if (kind === "scan") renderScanSection(); else renderRtlDocSection(); }
  function jobStatusEl(kind) { return kind === "scan" ? $("scanStatus") : $("rtlDocStatus"); }

  // «أيوجد زحف حيّ الآن؟» — يُسأل عامل الخدمة أولًا، ويُسقَط إلى فحص مفتاح الحجز القديم
  // ونبضِ نتائج «جارٍ» في المواقع كلها حيث لا عامل يرد (قشور الاختبار، أو عاملٌ متعطل).
  function askBusy(cb) {
    var done = false;
    function legacy() {
      SESS.get([C.K.SCAN_CLAIM], function (s) {
        var c = s[C.K.SCAN_CLAIM];
        if (c && c.id && c.at && Date.now() - c.at < C.CLAIM_STALE_MS) { cb(true); return; }
        // زحفُ وضعِ المحكّم لا يكتب مفتاح الحجز القديم أصلًا — فإن تأخر ردُّ العامل دلّنا عليه
        // نبضُ نتيجةٍ «جارٍ» حديث في أي موقع بدل إنكارٍ كاذب
        readMany(ALL_IDS, [C.K.SCAN_RESULT, C.K.RTLDOC_RESULT], function (per) {
          function fresh(x) { return !!(x && x.status === "running" && x.at && Date.now() - x.at < C.HEARTBEAT_STALL_MS); }
          cb(ALL_IDS.some(function (d) { return fresh(per[d][C.K.SCAN_RESULT]) || fresh(per[d][C.K.RTLDOC_RESULT]); }));
        });
      });
    }
    var t = setTimeout(function () { if (done) return; done = true; legacy(); }, 300);
    try {
      if (!hasWorker()) { done = true; clearTimeout(t); legacy(); return; }
      chrome.runtime.sendMessage({ type: "status" }, function (r) {
        if (done) return;
        done = true;
        try { clearTimeout(t); } catch (e) {}
        if (chrome.runtime.lastError || !r) { legacy(); return; }
        if (!r.busy) { cb(false); return; }
        // العامل يقول «مشغول» — والحكم للنبض (legacy يفحص الحجز ونبضَي «جارٍ»)، لا للمنفذ وحده
        legacy();
      });
    } catch (e) {
      if (!done) { done = true; try { clearTimeout(t); } catch (e2) {} legacy(); }
    }
  }

  function startJob(kind, ids) {
    if (JOB[kind]) return;
    ids = ids.filter(function (d) { return capsOf(d)[JOBK[kind].cap].on; });
    if (!ids.length) return;
    askBusy(function (busy) {
      if (JOB[kind]) return;
      if (busy) {
        flash(jobStatusEl(kind), kind === "scan"
          ? "فحصٌ جارٍ الآن في تبويبٍ آخر — انتظر انتهاءه أو أوقفه."
          : "فحصٌ جارٍ الآن (فحص الترجمة أو فحص الاتجاه) — انتظر انتهاءه ثم أعد المحاولة.", true);
        resumeRunning(kind);
        return;
      }
      // prev: نتيجة كل موقعٍ قبل مسحها — تُعاد إن لم يُجب تبويبُه (انظر restorePrev)
      var run = { kind: kind, ids: ids, i: -1, cur: null, timer: null, waited: 0, stopped: false, multi: ids.length > 1,
                  inAll: isAll(), seen: [], prev: {} };
      ids.forEach(function (d) { delete NOTE[kind][d]; });
      END[kind] = "";
      JOB[kind] = run;
      jobButtons(kind);
      nextInJob(run);
    });
  }
  function nextInJob(run) {
    if (run.timer) { clearInterval(run.timer); run.timer = null; }
    if (JOB[run.kind] !== run) return;
    if (run.stopped) { endJob(run); return; }
    run.i++;
    if (run.i >= run.ids.length) { endJob(run); return; }
    var d = run.ids[run.i], K = JOBK[run.kind];
    // في «الكل» يُتجاوز الموقع الموقوف بسببه المكتوب (الرئيس، أو مفتاحه، أو وصول المتصفح) — ولا يفشل الكل
    if (run.multi && !effOn(d)) {
      NOTE[run.kind][d] = { k: offReason(d) || "off" }; run.seen.push(d); jobRender(run.kind); nextInJob(run); return;
    }
    run.cur = d; run.waited = 0;
    // ★ النتيجة السابقة تُحفظ قبل مسحها: كان «فحص المواقع كلها» يمحو نتائج كل موقعٍ تبويبُه مغلق
    // (قائمةَ غير المترجَم وأمرَ الترجمة والدائرتين) وهو يقول «يُذكر ويُتجاوز»
    getD(d, [K.res], function (s) {
      if (JOB[run.kind] !== run || run.cur !== d) return;
      var old = s[K.res];
      run.prev[d] = old && old.status !== "running" ? old : null;
      var p = {}; p[K.res] = null;
      setD(d, p);
      // ★ (مراجعة كودكس ٢٢) الطلب يحمل نطاقه وهويةً فريدة: تبويبات النطاقات الأخرى تتجاهله
      var w = {};
      if (run.kind === "scan") { w[C.K.SCAN_CANCEL] = null; w[C.K.SCAN_CLAIM] = null; }
      w[K.req] = newRequest(K.kind, d);
      try { SESS.set(w); } catch (e) {}
      NOTE[run.kind][d] = { k: "sent" };
      jobRender(run.kind);   // سطرُ «أُرسل الطلب…» يكتبه الرسم (للموقع أو لصفّه في «الكل»)
      run.timer = setInterval(function () { pollJob(run); }, 1000);
    });
  }
  // موقعٌ لم يُجب (لا تبويب، أو انقطع، أو أُوقف قبل أن يجيب): نتيجتُه السابقة تعود كما كانت،
  // إلا إن وصلت في الأثناء نتيجةٌ جديدة منتهية — فهي الأصدق
  function restorePrev(run, d, cb) {
    var K = JOBK[run.kind], old = run.prev ? run.prev[d] : null;
    if (run.prev) delete run.prev[d];
    if (!old) { if (cb) cb(); return; }
    getD(d, [K.res], function (s) {
      var cur = s[K.res];
      if (cur && cur.status !== "running") { if (cb) cb(); return; }
      var p = {}; p[K.res] = old;
      setD(d, p, function () { if (cb) cb(); });
    });
  }
  function pollJob(run) {
    var d = run.cur, K = JOBK[run.kind];
    run.waited++;
    getD(d, [K.res], function (s) {
      if (JOB[run.kind] !== run || run.cur !== d) return;
      var r = s[K.res];
      if (!r) {
        // المحرّك يكتب إشعار استلام فور وصول الطلب؛ فبلوغُ المهلة بلا نتيجة يعني أنه لا سكربت حيّ
        // في أي تبويبٍ من هذا الموقع (أو تبويبٌ فُتح قبل تحديث الإضافة فانفصل)
        if (run.waited >= K.wait) { NOTE[run.kind][d] = { k: "noTab" }; restorePrev(run, d); run.seen.push(d); jobRender(run.kind); nextInJob(run); }
        return;
      }
      delete NOTE[run.kind][d];
      if (r.status === "running") {
        if (stalled(r)) { NOTE[run.kind][d] = { k: "stalled" }; restorePrev(run, d); run.seen.push(d); jobRender(run.kind); nextInJob(run); return; }
        jobRender(run.kind);
        return;
      }
      if (run.prev) delete run.prev[d];
      run.seen.push(d);
      jobRender(run.kind);
      nextInJob(run);
    });
  }
  // سطرُ الختام في «الكل»: للمواقع كلها ملخّص، ولصفٍّ واحد حالُ موقعه — لا يبقى «أُرسل الطلب…» بعد أن انتهى
  function endLine(run) {
    if (run.multi) return (run.stopped ? "أُوقف الفحص." : "انتهى فحص المواقع بالتتابع.") + " والنتيجة لكل موقعٍ في صفّه أعلاه.";
    var d = run.ids[0], n = NOTE[run.kind][d];
    if (n && n.k !== "sent") return qn(d) + ": " + noteText(run.kind, d, n);
    return run.stopped ? qn(d) + ": أُوقف الفحص." : "انتهى فحص " + qn(d) + " — ونتيجته في صفّه أعلاه.";
  }
  function endJob(run) {
    if (run.timer) { clearInterval(run.timer); run.timer = null; }
    if (JOB[run.kind] === run) JOB[run.kind] = null;
    if (run.inAll && isAll()) END[run.kind] = endLine(run);
    jobButtons(run.kind);
    jobRender(run.kind);
  }
  // فحصٌ جارٍ فُتحت الصفحة أثناءه (أو من صفحةٍ أخرى): يُستأنف الاستطلاع والزر معطَّل والإيقاف ظاهر
  function resumeRunning(kind) {
    if (JOB[kind]) return;
    var K = JOBK[kind];
    readMany(ALL_IDS, [K.res], function (per) {
      if (JOB[kind]) return;
      var d = ALL_IDS.filter(function (x) { var r = per[x][K.res]; return r && r.status === "running" && !stalled(r); })[0];
      if (!d) return;
      var run = { kind: kind, ids: [d], i: 0, cur: d, timer: null, waited: 0, stopped: false, multi: false,
                  inAll: isAll(), seen: [], prev: {} };
      JOB[kind] = run;
      jobButtons(kind);
      run.timer = setInterval(function () { pollJob(run); }, 1000);
    });
  }
  function jobButtons(kind) {
    var busy = !!JOB[kind];
    if (kind === "scan") {
      var anyScan = scopeIds().some(function (d) { return capsOf(d).scan.on; });
      if ($("startScan")) $("startScan").disabled = busy || !anyScan;
      show("cancelScan", busy);
      ALL_IDS.forEach(function (d) { var b = $("scanBtn_" + d); if (b) b.disabled = busy || !capsOf(d).scan.on; });
    } else if ($("startRtlDoc")) {
      $("startRtlDoc").disabled = busy || !scopeIds().some(function (d) { return capsOf(d).rtlDoc.on; });
    }
  }
  function stopScan() {
    var run = JOB.scan, d = run && run.cur ? run.cur : (isAll() ? "app" : DOM);
    if (run) run.stopped = true;
    try { SESS.set({ cml_scan_cancel: newRequest("cancel", d) }); } catch (e) {}
    $("scanStatus").textContent = "جارٍ الإيقاف…";
    // مخرج مضمون: لو لم يكن ثمة زاحفٌ حيّ يستجيب (أُغلق تبويبه) بقيت الصفحة عالقة على
    // «جارٍ الإيقاف…» بلا نهاية. فبعد ثانيتين ننظّف الحالة بأنفسنا ونحرّر الحجز — وتعود
    // نتيجةُ الموقع السابقة كما كانت (لم يُجب أحدٌ فلا نتيجة جديدة تحلّ محلّها)
    setTimeout(function () {
      getD(d, [C.K.SCAN_RESULT], function (s) {
        var r = s[C.K.SCAN_RESULT];
        if (r && r.status !== "running") { if (run && JOB.scan === run) endJob(run); return; } // استجاب الزاحف فعلًا
        var old = run && run.prev ? run.prev[d] : null;
        if (run && run.prev) delete run.prev[d];
        var p = {}; p[C.K.SCAN_RESULT] = old || null;
        setD(d, p, function () {
          try { SESS.set({ cml_scan_claim: null }); } catch (e) {}
          NOTE.scan[d] = { k: "stopped" };
          if (JOB.scan) endJob(JOB.scan);
          renderScanSection();
        });
      });
    }, 2000);
  }

  // ---- فحص الترجمة: العرض ----
  // اسمُ الزرّ كما في العرض الحاضر: «بدء الفحص» في موقعٍ بعينه، و«فحص» الصفّ أو «فحص المواقع كلها» في «الكل»
  function btnName(kind) {
    if (kind !== "scan") return "«بدء فحص الاتجاه»";
    return isAll() ? "«فحص» في صفّه أو «فحص المواقع كلها»" : "«بدء الفحص»";
  }
  function noteText(kind, d, n) {
    var h = tabWhere(d), btn = btnName(kind);
    if (n.k === "sent") return "أُرسل الطلب… تأكّد أن تبويبًا من " + h + " مفتوح.";
    if (n.k === "master") return "لم يُفحص: التعريب موقوفٌ بالمفتاح الرئيس.";
    if (n.k === "off") return "لم يُفحص: الموقع متوقّف في جدول «المواقع» — فعّله ليُفحص.";
    if (n.k === "noAccess") return "لم يُفحص: المتصفح لا يصل إلى الموقع — اسمح للإضافة بالوصول إليه من إعدادات الإضافات.";
    if (n.k === "stopped") return "أُوقف الفحص." + (isAll() ? "" : " اضغط " + btn + " متى شئت.");
    if (n.k === "stalled") return "انقطع الفحص — غالبًا أُغلق تبويب " + h + " أو أُعيد تحميل الإضافة. افتحه وحدّثه ثم أعد الفحص.";
    // noTab
    return "لم يستجب أي تبويبٍ من " + h + ". الأرجح أنه غير مفتوح، أو مفتوحٌ منذ ما قبل تحديث الإضافة فانفصل عنها. " +
      "الحل: افتح صفحةً من " + h + " واضغط Ctrl+Shift+R (تحديث كامل) وانتظر اكتمال التحميل، ثم عُد هنا واضغط " + btn + ".";
  }
  // المعدود بحسب نوع الماسح: نصوص الواجهة، أو عناوين الصفحات (فهرس llms.txt)
  function foundNoun(d, r) { return (r && r.source === "llms") || capsOf(d).scan.kind === "llms" ? N.title : N.text; }
  // ملخّص نتيجةٍ منتهية — وفيها تاريخٌ هجري فأعدادُها بأرقامه (datedLine)
  function scanDoneText(d, r) {
    return datedLine("وجد " + arCount(r.found || 0, foundNoun(d, r), "acc") + "، غيرُ المترجَم منها " +
      (r.missing || 0).toLocaleString("en") + " · " + hDate(r.at)) + (r.failed ? " · ⚠ ناقصة" : "");
  }
  function scanShort(d, r) {
    var n = NOTE.scan[d];
    // موقعٌ بلا فحص: عمودُ «الفحص» بجواره يقول «بلا فحص» — فهنا التغطية المشحونة إن وُجدت، وإلا شرطة
    if (!capsOf(d).scan.on) return coverText(d) || "—";
    var done = !!(r && r.status === "done");
    // الملاحظة (تُجووز، لم يُجب، انقطع، أُوقف) ومعها النتيجة السابقة المحفوظة إن كانت
    if (n && n.k !== "sent") return noteText("scan", d, n) + (done ? " — والمعروض نتيجة الفحص السابق: " + scanDoneText(d, r) : "");
    if (n && !r) return noteText("scan", d, n);
    if (!r || !r.status) return "لم يُجرَ فحص بعد";
    if (r.status === "running") {
      if (stalled(r)) return noteText("scan", d, { k: "stalled" });
      return "جارٍ الفحص… قرأ " + arCount(r.fetched || 0, N.file, "acc") + " ووجد " + arCount(r.found || 0, foundNoun(d, r), "acc");
    }
    if (r.status === "cancelled") return "أُوقف الفحص.";
    if (r.status === "error") return "تعذّر الفحص: " + String(r.error || "خطأ").slice(0, 160);
    return scanDoneText(d, r);
  }
  var scanRowsBuilt = false;
  function buildScanRows() {
    var body = $("scanBody");
    if (!body || scanRowsBuilt) return;
    scanRowsBuilt = true;
    ALL_IDS.forEach(function (d) {
      var cap = capsOf(d);
      var tr = document.createElement("tr"); tr.dataset.d = d;
      var t1 = document.createElement("td"); t1.setAttribute("data-label", "الموقع");
      var b = document.createElement("b"); b.textContent = dname(d); t1.appendChild(b);
      var hs = document.createElement("div"); hs.className = "host"; var bd = document.createElement("bdi"); bd.dir = "ltr"; bd.textContent = C.siteLabel(d);
      hs.appendChild(bd); t1.appendChild(hs);
      var t2 = document.createElement("td"); t2.setAttribute("data-label", "الفحص"); t2.textContent = cap.scan.label;
      var t3 = document.createElement("td"); t3.setAttribute("data-label", "النتيجة"); t3.id = "scanRes_" + d;
      var t4 = document.createElement("td");
      var btn = document.createElement("button"); btn.id = "scanBtn_" + d; btn.className = "ghost"; btn.textContent = "فحص";
      btn.setAttribute("aria-label", "فحص " + dname(d));
      // الزرّ المعطّل يُوصف بسبب تعطيله (caps) لا بخانة النتيجة
      if (cap.scan.on) btn.setAttribute("aria-describedby", "scanRes_" + d);
      else {
        var why = document.createElement("span"); why.className = "vh"; why.id = "scanNoWhy_" + d; why.textContent = cap.scan.why;
        t4.appendChild(why);
        btn.setAttribute("aria-describedby", why.id);
      }
      btn.disabled = !cap.scan.on;
      btn.addEventListener("click", function () { startJob("scan", [d]); });
      t4.appendChild(btn);
      tr.appendChild(t1); tr.appendChild(t2); tr.appendChild(t3); tr.appendChild(t4);
      body.appendChild(tr);
    });
  }
  var scanGen = 0;
  function renderScanSection() {
    var cnt = $("scanCount");
    if (!cnt) return;
    var gen = ++scanGen, ids = scopeIds();
    loadCovers(ids, function () {
      readMany(ids, [C.K.SCAN_RESULT], function (per) {
        if (gen !== scanGen) return;
        var tbl = $("scanTable");
        if (tbl) tbl.classList.toggle("hidden", !isAll());
        if (isAll()) {
          ids.forEach(function (d) { setText("scanRes_" + d, scanShort(d, per[d][C.K.SCAN_RESULT])); });
          var yes = ids.filter(function (d) { return capsOf(d).scan.on; }), no = ids.filter(function (d) { return !capsOf(d).scan.on; });
          // ★ (ر8-د — N4) بتسميات عمود «الفحص» نفسها: ما يفحصه المتصفح في كل موقع، وما تُحدَّث ترجمته عند كل إصدار
          var byKind = ["app", "llms"].map(function (k) {
            var L = yes.filter(function (x) { return capsOf(x).scan.kind === k; });
            return L.length ? capsOf(L[0]).scan.label + " في " + namesOf(L) : "";
          }).filter(Boolean);
          cnt.textContent = (byKind.length ? "يفحص المتصفح " + byKind.join("، و") : "لا موقع له فحص في المتصفح") +
            (no.length ? " · وتُحدَّث ترجمة غيرها " + capsOf(no[0]).scan.label + ": " + namesOf(no) : "");
          $("startScan").textContent = "فحص المواقع كلها";
          // سطرُ الحال في «الكل»: تقدّمُ التشغيل الجاري، أو ختامُ آخر تشغيل، وإلا فارغ — لا يبقى فيه
          // نصُّ موقعٍ سابق يناقض الصفوف
          var run = JOB.scan, st = $("scanStatus");
          if (st && !st.dataset.flashing) {
            var txt = END.scan || "";
            if (run && run.cur) {
              var r = per[run.cur] && per[run.cur][C.K.SCAN_RESULT];
              var pre = run.multi ? "(" + (run.i + 1) + " من " + run.ids.length + ") " : "";
              if (r && r.status === "running" && !stalled(r)) {
                var done = r.fetched || 0, left = r.queued || 0;
                var pct = done + left > 0 ? Math.min(99, Math.round((done / (done + left)) * 100)) : 0;
                txt = pre + "يفحص " + qn(run.cur) + ": نحو " + pct + "٪…";
              } else txt = pre + qn(run.cur) + ": " + noteText("scan", run.cur, { k: "sent" });
            }
            st.classList.remove("err");
            st.textContent = txt;
          }
        } else {
          renderScanSingle(DOM, per[DOM][C.K.SCAN_RESULT]);
        }
        jobButtons("scan");
        if (!JOB.scan) ids.forEach(function (d) {
          var r = per[d][C.K.SCAN_RESULT];
          if (r && r.status === "running" && !stalled(r)) resumeRunning("scan");
        });
      });
    });
  }
  function renderScanSingle(d, r) {
    var cnt = $("scanCount"), st = $("scanStatus"), cap = capsOf(d), h = tabWhere(d);
    var btn = $("startScan");
    if (btn) btn.textContent = r && r.status === "done" ? "إعادة الفحص" : "بدء الفحص";
    // لا تدهس رسالةً وامضة (تأكيد أو خطأ)، وارفع صنف الخطأ عن سطر الحال
    function status(t) { if (st && !st.dataset.flashing) { st.classList.remove("err"); st.textContent = t; } }
    // الفرعان المبكّران يمحوان السطر كذلك: كان يبقى فيه نصُّ «الكل» أو موقعٍ سابق
    if (!cap.scan.on) { cnt.textContent = "لا فحص لهذا الموقع"; status(""); return; }
    var n = NOTE.scan[d], noun = foundNoun(d, r);
    if (n && (!r || (n.k !== "sent" && r.status !== "running"))) {
      cnt.textContent = n.k === "noTab" ? "لم يصل الطلب" : n.k === "sent" ? "أُرسل الطلب…" : n.k === "stopped" ? "أُوقف الفحص" : "انقطع الفحص";
      status(noteText("scan", d, n) + (r && r.status === "done" ? " ونتيجة الفحص السابق (" + hDate(r.at) + ") باقيةٌ كما هي." : ""));
      return;
    }
    if (!r || !r.status) { cnt.textContent = "لم يُجرَ فحص بعد"; status(""); return; }
    if (r.status === "running") {
      // نبض متوقّف ⇒ الزاحف مات (أُغلق تبويبه مثلًا). بدونه تبقى الصفحة عالقة على «جارٍ» بلا استرداد.
      if (stalled(r)) {
        cnt.textContent = "انقطع الفحص";
        status("توقّف بعد قراءة " + arCount((r.fetched || 0), N.file, true) + " — غالبًا أُغلق تبويب " + h +
          " أو أُعيد تحميل الإضافة. افتحه وحدّث الصفحة ثم أعد الفحص.");
        return;
      }
      cnt.textContent = "جارٍ الفحص…";
      var done = r.fetched || 0, left = r.queued || 0;
      var pct = done + left > 0 ? Math.min(99, Math.round((done / (done + left)) * 100)) : 0;
      status("التقدّم نحو " + pct + "٪ — قرأ " + arCount(done, N.file, "acc") + "، ووجد " + arCount((r.found || 0), noun, "acc") + "…");
      return;
    }
    if (r.status === "error" || r.status === "cancelled") {
      cnt.textContent = r.status === "cancelled" ? "أُوقف الفحص" : "تعذّر الفحص";
      status(r.status === "cancelled"
        ? "أُوقف بعد قراءة " + arCount((r.fetched || 0), N.file, true) + ". اضغط «بدء الفحص» للإعادة."
        : (r.error || "حدث خطأ ما."));
      return;
    }
    var nVars = (r.varList || []).length;
    cnt.textContent = r.missing ? ("غير المترجَم: " + arCount(r.missing, noun)) : "كل شيء مترجَم ✓";
    var msg = r.source === "llms"
      ? "قُرئ فهرس الصفحات العام ووُجد فيه " + arCount((r.found || 0), N.title) + " في " + arCount((r.seconds || 0), N.sec, true) + "."
      : "فُحص " + arCount((r.fetched || 0), N.file) + " و" + arCount((r.found || 0), N.text) + " في " + arCount((r.seconds || 0), N.sec, true) + ".";
    if (nVars) msg += " ومنها ما فيه متغيّرات، فيُحوَّل عند ترجمته إلى قاعدةٍ ذكية: " + arCount(nVars, noun) + ".";
    // ★ (ر8-د — N6) ما يبقى بالإنجليزية بقاعدة النطاق (أسماء المنتجات والنماذج والرموز…) مغطًّى لا «غير مترجَم»، وعددُه هنا وحده
    if (r.kept) msg += " ومنها ما يبقى بالإنجليزية عمدًا (أسماء المنتجات والنماذج ونحوها) فيُعدّ مترجَمًا: " + arCount(r.kept, noun) + ".";
    if (r.capped) msg += " (عُرض أول 4000 نصّ)";
    // إخفاق الجلب يعني نتيجةً ناقصة — والسكوت عنه يجعل «تمّ» يبدو اكتمالًا وليس به
    if (r.failed) msg += " ⚠ تعذّر جلب " + arCount(r.failed, N.file, true) + "، فالنتيجة ناقصة — أعد الفحص.";
    msg += " آخر فحص: " + hDateTime(r.at) + ".";
    msg += r.missing
      ? " غيرُ المترجَم في «إدارة قاموس التعريب» أدناه — النِّسَب والقائمة وأدوات الترجمة."
      : " المصدر مطابق لأحدث نسخة من الموقع ✓";
    status(datedLine(msg));
  }

  // «تنزيل أمر الترجمة»: للموقع المختار، أو ملفٌّ واحد بأقسامٍ لكل موقعٍ له نتيجة في «الكل»
  function exportScan() {
    var ids = scopeIds().filter(function (d) { return capsOf(d).scan.on; });
    // الحال بجوار الزرّ في بطاقة القاموس (بطاقة الفحص قد تكون معطّلةً باهتة في هذا الموقع)
    var st = $("xferStatus") || $("termsStatus");
    if (!ids.length) { flash(st, "لا فحص لـ" + qn(DOM) + " — غيرُ المترجَم فيه غير معروف، فلا أمر ترجمةٍ له.", true); return; }
    readMany(ids, [C.K.SCAN_RESULT], function (per) {
      var secs = [], scannedAny = false, n = 0;
      ids.forEach(function (d) {
        var r = per[d][C.K.SCAN_RESULT];
        if (r && r.status === "done") scannedAny = true;
        var plain = (r && r.list) || [], vars = (r && r.varList) || [];
        if (plain.length || vars.length) { secs.push({ d: d, keys: plain, varKeys: vars }); n += plain.length + vars.length; }
      });
      if (!secs.length) {
        flash(st, scannedAny ? "لا نصوص غير مترجَمة في آخر فحص" + (isAll() ? " للمواقع المفحوصة" : "") + "."
          : "لم يُجرَ فحص بعد — شغّله من «فحص الترجمة» أعلاه.", !scannedAny);
        return;
      }
      download("أمر-ترجمة-كلود" + fileSuffix() + ".txt", buildPrompt(secs), "text/plain;charset=utf-8");
      flash(st, "نُزّل الملف (" + arCount(n, N.text) + (secs.length > 1 ? " من " + arCount(secs.length, N.site, true) : "") +
        ") وفيه الأمر كاملًا — ألصقه في محادثةٍ مع Claude.");
    });
  }

  // ---------- الاتجاه (RTL): المحرّك الافتراضي + تجاوزُه لكل موقع ----------
  // الشامل (v2) هو الافتراضي، فاختيارُه لا يُخزَّن قيمةً بل بمحو المفتاح — غيابُ المفتاح افتراضٌ،
  // ووجودُه اختيارٌ صريح للبديل. وتجاوزُ الموقع cml_engine_site.<id> يغلب الافتراضي في موقعه وحده.
  function engName(v) { return v === "v1" ? "المبسّط" : "الشامل"; }
  function loadRtlEngine() {
    if (!$("rtlEngineV2")) return; // صفحة اختبار بلا قسم الاتجاه
    chrome.storage.local.get([C.K.RTL_ENGINE], function (s) {
      var v1 = s[C.K.RTL_ENGINE] === "v1";
      $("rtlEngineV1").checked = v1;
      $("rtlEngineV2").checked = !v1;
    });
  }
  function followers() { return ALL_IDS.filter(function (d) { return RUN.eng[d] !== "v1" && RUN.eng[d] !== "v2"; }); }
  function setRtlEngine(v) {
    var f = followers();
    var tail = f.length ? " — يسري فورًا على تبويبات " + hostsOf(f) + (f.length < ALL_IDS.length ? "، وتبقى المواقع ذات الاختيار الخاص على اختيارها." : ".")
      : " — ولكل المواقع اختيارٌ خاص في جدول «لكل موقع»، فلا يسري الافتراضي الآن على أيٍّ منها.";
    if (v === "v1") {
      var patch = {}; patch[C.K.RTL_ENGINE] = "v1";
      chrome.storage.local.set(patch, function () {
        if (chrome.runtime.lastError) { flash($("rtlEngineStatus"), "تعذّر الحفظ."); return; }
        flash($("rtlEngineStatus"), "أصبح الافتراضي المبسّط" + tail);
      });
    } else {
      chrome.storage.local.remove(C.K.RTL_ENGINE, function () {
        flash($("rtlEngineStatus"), "عاد الافتراضي إلى الشامل (الموصى به)" + tail);
      });
    }
  }
  function fillEngineWhy() {
    var el = $("rtlEngineV2Why");
    if (!el) return;
    var live = ALL_IDS.filter(function (d) { return capsOf(d).live.on; }), snap = ALL_IDS.filter(function (d) { return !capsOf(d).live.on; });
    // (ع٨) الوعد بإعادة الضبط التلقائية لا يصدق إلا في المواقع ذات الورقة الحيّة
    el.textContent = "يعكس الواجهة كلها من اليمين إلى اليسار: القوائم والأزرار والأشرطة والمسافات، وتبقى التعليمات البرمجية والمعادلات من اليسار كما ينبغي." +
      (live.length ? " وفي " + namesOf(live) + " تعيد الإضافة ضبط الاتجاه من ملفات الموقع الجديدة تلقائيًّا كلما حدّث تصميمه." : "") +
      (snap.length ? " وفي " + namesOf(snap) + " يأتي الاتجاه من لقطةٍ مشحونة مع الإضافة تُحدَّث مع كل إصدار." : "");
    var el1 = $("rtlEngineV1Why");
    if (el1 && snap.length) el1.textContent = "يصحّح المواضع الأساسية وحدها ويترك بقية الواجهة كما هي، ويوقف لقطة الاتجاه الشاملة في " +
      namesOf(snap) + ". لا تختره إلا إذا ظهر خللٌ ولم يزل بتحديث الإضافة؛ والأولى أن تختاره للموقع المعطوب وحده من جدول «لكل موقع» أدناه.";
  }

  // حال الورقة الحيّة لكل موقعٍ حيّ في النطاق، وزرُّ إعادة بنائها (ولقطة الإصدار لغيره) — ويُحدَّث
  // معها عمود «الاتجاه من» في جدول «لكل موقع» (قسم الاتجاه، ★ ر8-د)
  function renderRtlLive() {
    var keys = ALL_IDS.map(function (d) { return physFor(d, C.K.RTL_LIVE); });
    chrome.storage.local.get(keys, function (s) {
      var rec = {};
      ALL_IDS.forEach(function (d, i) { rec[d] = s[keys[i]]; });
      ALL_IDS.forEach(function (d) {
        var cell = $("siteDir_" + d);
        if (!cell) return;
        var r = rec[d];
        cell.textContent = !capsOf(d).live.on ? "لقطة الإصدار"
          : (r && r.css ? datedLine("ورقة حيّة · " + hDate(r.at)) : "ورقة حيّة (لم تُبنَ بعد)");
      });
      var box = $("rtlLiveInfo");
      if (!box) return;
      var ids = scopeIds(), liveIds = ids.filter(function (d) { return capsOf(d).live.on; });
      box.textContent = "";
      ids.forEach(function (d) {
        var cap = capsOf(d), r = rec[d], pre = isAll() ? qn(d) + ": " : "", t;
        if (!cap.live.on) { if (!isAll()) return; t = pre + "لقطة الإصدار — تُحدَّث مع كل إصدارٍ للإضافة."; }
        else if (!r || !r.css) t = pre + "لم يُضبط الاتجاه من الموقع بعد — يجري ذلك تلقائيًّا عند أول فتحٍ لـ" + hostOf(d) +
          "، وحتى ذلك الحين تعمل الإعدادات المضمّنة في الإضافة.";
        else t = datedLine(pre + "الاتجاه مضبوط من الموقع — المعكوس: " + arCount((r.flipped || 0), N.spot) + " من " +
          arCount((r.sources || 0), N.sheet, true) + " (" + Math.round((r.bytes || 0) / 1024) + " كيلوبايت) — آخر ضبطٍ " + hDateTime(r.at) + ".");
        var div = document.createElement("div"); div.textContent = t; box.appendChild(div);
      });
      var why = $("rtlLiveWhy");
      if (why) { why.textContent = !isAll() && !liveIds.length ? capsOf(DOM).live.why : ""; why.classList.toggle("hidden", !why.textContent); }
      var btn = $("rtlLiveRebuild");
      if (btn) {
        btn.dataset.ids = liveIds.join(",");
        btn.disabled = !liveIds.length;
        btn.textContent = isAll() ? "إعادة الضبط في المواقع الحيّة كلها (" + liveIds.length + ")" : "إعادة ضبط الاتجاه من " + hostOf(DOM);
      }
    });
  }
  function rtlLiveRebuild() {
    // محوُ الورقة المخزَّنة يكفي: أولُ تبويبٍ من الموقع يُعيد بناءها من ملفاته الحاضرة
    var ids = (($("rtlLiveRebuild") || {}).dataset.ids || "").split(",").filter(function (d) { return !!C.domain(d); });
    if (!ids.length) return;
    chrome.storage.local.remove(ids.map(function (d) { return physFor(d, C.K.RTL_LIVE); }), function () {
      void chrome.runtime.lastError;
      renderRtlLive();
      flash($("rtlEngineStatus"), "سيُعاد ضبط الاتجاه من الموقع عند أول فتحٍ أو تحديثٍ لتبويب " + hostsOf(ids) + ".");
    });
  }

  // ---- فحص الاتجاه: يجري داخل صفحة الموقع (runRtlDoc) لأنه وحده يقرأ ملفات تنسيقه ----
  function renderRtlDocSection() {
    var cnt = $("rtlDocCount");
    if (!cnt) return;
    var ids = scopeIds().filter(function (d) { return capsOf(d).rtlDoc.on; });
    setText("rtlDocWarn", ids.length ? "افتح تبويب " + hostsOf(ids) + " واتركه مفتوحًا، ثم اضغط «بدء فحص الاتجاه». يستغرق ثوانيَ معدودة." : "");
    jobButtons("rtldoc");
    if (!ids.length) { cnt.textContent = "لا فحص اتجاهٍ لهذا الموقع"; show("rtlDocBox", false); setText("rtlDocStatus", ""); return; }
    readMany(ids, [C.K.RTLDOC_RESULT], function (per) {
      if (ids.length === 1) renderRtlDocOne(ids[0], per[ids[0]][C.K.RTLDOC_RESULT], isAll());
      else {
        show("rtlDocBox", false);
        cnt.textContent = "فحص الاتجاه في " + namesOf(ids);
        var st = $("rtlDocStatus");
        if (!st.dataset.flashing) st.textContent = ids.map(function (d) {
          var r = per[d][C.K.RTLDOC_RESULT], n = NOTE.rtldoc[d];
          return qn(d) + ": " + (n && !r ? noteText("rtldoc", d, n) : !r ? "لم يُجرَ فحص بعد"
            : r.status === "done" ? (r.uncovered ? "لم يُعكس بعد: " + arCount(r.uncovered, N.rule) : "مضبوط بالكامل ✓")
            : r.status === "error" ? "تعذّر الفحص" : "جارٍ…");
        }).join(" · ");
      }
      if (!JOB.rtldoc) ids.forEach(function (d) {
        var r = per[d][C.K.RTLDOC_RESULT];
        if (r && r.status === "running" && !stalled(r)) resumeRunning("rtldoc");
      });
    });
  }
  function renderRtlDocOne(d, r, prefixed) {
    var cnt = $("rtlDocCount"), st = $("rtlDocStatus"), box = $("rtlDocBox"), h = hostOf(d);
    var pre = prefixed ? qn(d) + ": " : "";
    cnt.style.color = "";
    var n = NOTE.rtldoc[d];
    if (n && !r) {
      cnt.textContent = pre + (n.k === "noTab" ? "لم يصل الطلب" : n.k === "sent" ? "أُرسل الطلب…" : "انقطع الفحص");
      if (!st.dataset.flashing) st.textContent = noteText("rtldoc", d, n);
      return;
    }
    if (!r || !r.status) { cnt.textContent = pre + "لم يُجرَ فحص بعد"; if (box) box.classList.add("hidden"); return; }
    if (r.status === "running") {
      // نبض متوقّف ⇒ مات الفاحص — كقاعدة فحص الترجمة
      if (stalled(r)) {
        cnt.textContent = pre + "انقطع الفحص";
        st.textContent = "توقّف بعد قراءة " + arCount((r.fetched || 0), N.file, true) + " — غالبًا أُغلق تبويب " + h + " أو أُعيد تحميل الإضافة. افتحه وحدّث الصفحة ثم أعد الفحص.";
        return;
      }
      cnt.textContent = pre + "جارٍ الفحص…";
      st.textContent = "قرأ " + arCount(r.fetched || 0, N.sheet, true) + "…";
      return;
    }
    if (r.status === "error") {
      cnt.textContent = pre + "تعذّر الفحص";
      st.textContent = r.error || "حدث خطأ ما.";
      if (box) box.classList.add("hidden");
      return;
    }
    if ($("startRtlDoc")) $("startRtlDoc").textContent = "إعادة فحص الاتجاه";
    var unc = r.uncovered || 0;
    var shown = (r.list || []).length;
    if (unc) cnt.textContent = pre + "لم يُعكس بعد: " + arCount(unc, N.rule);
    else { cnt.textContent = pre + "✓ الاتجاه مضبوط بالكامل"; cnt.style.color = "var(--ok)"; }
    var msg = "فُحص " + arCount((r.files || 0), N.file) + " وفيها " + arCount((r.rules || 0), N.rule) + "، منها ما يذكر يمينًا أو يسارًا (" +
      arCount((r.physical || 0), N.rule) + "): المُعالَج " + (r.covered || 0) +
      " وغيرُ المغطّى " + unc + (unc && shown < unc ? " (يُعرض أول " + shown + ")" : "") +
      "، في " + arCount((r.seconds || 0), N.sec, true) + ".";
    // 404 «إشارات وهمية» لا تُعدّ نقصًا؛ وإخفاق الشبكة الباقي بعد الإعادة هو النقص الحق
    if (r.failed) msg += " ⚠ تعذّر جلب " + arCount(r.failed, N.file, true) + " لخللٍ في الشبكة رغم إعادة المحاولة، فالنتيجة ناقصة — أعد الفحص.";
    // ★ (ر8-د2، المراجعة) العددُ بعد تسميته مباشرةً لا بعد جملةٍ معترضة، والفعل مبنيٌّ للمجهول كـ«فُحص» في صدر الرسالة (لا فاعل مذكورًا لـ«تجاهل»)
    if (r.ghosts) msg += " وأُهملت إشاراتٌ وهمية: " + r.ghosts.toLocaleString("en") + "، وهي أسماءٌ تشبه الملفات داخل النصوص لا ملفاتٌ حقيقية، وهذا طبيعي.";
    msg += " وفي التنسيقات التي يكتبها الموقع في عناصره مباشرةً فُحص " + arCount((r.inlineChecked || 0), N.elem) + "، في " +
      (r.inlinePhysical || 0).toLocaleString("en") + " منها يمينٌ أو يسار — وهذه لا تمسّها الإضافة عمدًا.";
    if (r.at) msg += " آخر فحص: " + hDateTime(r.at) + ".";
    if (!st.dataset.flashing) st.textContent = r.at ? datedLine(msg) : msg;
    if (!box) return;
    if (!unc) { box.classList.add("hidden"); return; }
    var listEl = $("rtlDocList");
    listEl.innerHTML = "";
    (r.list || []).forEach(function (x) {
      var dv = document.createElement("div");
      dv.className = "ditem";
      dv.textContent = x.sel + " — " + x.prop;
      listEl.appendChild(dv);
    });
    box.classList.remove("hidden");
  }
  // النتيجة كاملة تُنزَّل ملفًا — للإرفاق بمسألة على المستودع
  function exportRtlDoc() {
    var ids = scopeIds().filter(function (d) { return capsOf(d).rtlDoc.on; });
    readMany(ids, [C.K.RTLDOC_RESULT], function (per) {
      var got = ids.filter(function (d) { var r = per[d][C.K.RTLDOC_RESULT]; return r && r.status === "done"; });
      if (!got.length) { flash($("rtlDocStatus"), "لا نتيجة للتنزيل — شغّل فحص الاتجاه أولًا."); return; }
      var file = { _app: "claude-mutarjim", _kind: "rtl-doctor" };
      if (got.length === 1) { file.domain = got[0]; file.result = per[got[0]][C.K.RTLDOC_RESULT]; }
      else { file.domains = {}; got.forEach(function (d) { file.domains[d] = per[d][C.K.RTLDOC_RESULT]; }); }
      download("فحص-الاتجاه-كلود" + fileSuffix() + ".json", JSON.stringify(file, null, 2));
      flash($("rtlDocStatus"), "نُزّلت النتيجة كاملة ✓");
    });
  }

  // ---------- المزامنة الاختيارية بين الأجهزة (المرحلة ٦) ----------
  // المنطق كله في cml-sync.js يقوده sw.js — لهذه الصفحة: الموافقة الصريحة، وعرضُ الحال كما هي
  // (ولكل موقعٍ مساحته)، والمسح المستقل (زرُّه قسميٌّ يُرى في الحالين).
  var SYNC_TOTAL_KB = Math.round(C.SYNC_TOTAL_BYTES / 1000);

  // مفاتيحنا وحدها في مساحة المزامنة — لموقعٍ واحد أو للمواقع كلها (مساحة التطبيق ومساحات
  // المواقع وفقراتها: C.CLOUD_KEYS) — لا نمسّ فيها سواها أبدًا
  function cloudPrefixes(d) {
    if (!d) return C.CLOUD_KEYS;
    if (d === "app") return [C.K.SYNC_META, C.K.SYNC_CHUNK_PREFIX];
    return ["cmlm_" + d, "cmlc_" + d + "_", "cmlbm_" + d, "cmlbc_" + d + "_"];
  }
  function ourSyncKeys(all, d) {
    var keys = [], pre = cloudPrefixes(d);
    for (var k in (all || {})) {
      if (!Object.prototype.hasOwnProperty.call(all, k)) continue;
      if (pre.some(function (p) { return k === p || (p.charAt(p.length - 1) === "_" && k.indexOf(p) === 0); })) keys.push(k);
    }
    return keys;
  }
  // «أفي حسابك شيءٌ مرفوع الآن؟» — تُسأل مساحةُ المزامنة نفسُها لا الحالُ المحلية (قد تكذب).
  // null متى تعذّر السؤال أصلًا — وحينها لا ندّعي علمًا لا نملكه.
  function probeSyncArea(cb, d) {
    try {
      if (!chrome.storage || !chrome.storage.sync) { cb(null, "غير متاحة هنا"); return; }
      chrome.storage.sync.get(null, function (all) {
        var e = chrome.runtime && chrome.runtime.lastError;
        if (e) { cb(null, e.message); return; }
        cb(ourSyncKeys(all, d));
      });
    } catch (e) { cb(null, String((e && e.message) || e)); }
  }
  function renderWipeBox(enabled) {
    var btn = $("syncWipeBtn"), note = $("syncWipeNote");
    if (!btn) return; // قشور الاختبار بلا هذا القسم
    btn.disabled = true;
    if (note) note.textContent = "جارٍ التحقق من مساحة المزامنة…";
    probeSyncArea(function (keys, err) {
      if (!keys) {
        btn.disabled = true;
        if (note) note.textContent = "تعذّر التحقق من مساحة المزامنة (" + (err || "خطأ غير معروف") +
          ") — فلا نعرف أفيها من هذه الإضافة شيء أم لا. أعد فتح هذه الصفحة، وإن تكرّر فتحقّق من مزامنة كروم في متصفحك.";
        return;
      }
      if (!keys.length) {
        btn.disabled = true;
        if (note) note.textContent = "لا شيء مرفوع من هذه الإضافة في حسابك الآن — فلا شيء يُمحى، والزرّ معطَّل حتى يُرفع شيء.";
        return;
      }
      btn.disabled = false;
      if (note) note.textContent = enabled
        ? "في حسابك نسخةٌ مرفوعة من تصحيحاتك وقواعدك. ومحوُها لا يوقف المزامنة: ما دامت مفعّلةً هنا رُفعت نسختُك من جديد عند أول تعديل."
        : "المزامنة متوقّفة على هذا الجهاز، ونسختُك المرفوعة سابقًا لا تزال في حسابك — امسحها بالزرّ أعلاه، ولا حاجة إلى إعادة التفعيل.";
    });
  }
  function syncStText(st, noun, isApp) {
    if (!st || !st.status) return "—";
    if (st.status === "ok") return st.at ? datedLine("رُفع (" + arCount(st.count || 0, noun) + ") · " + hDate(st.at)) : "رُفع (" + arCount(st.count || 0, noun) + ")";
    if (st.status === "overflow") return isApp ? "⚠ لم يُرفع: أكبر من مساحة المزامنة، ومحفوظٌ على جهازك"
      : "⚠ لم يُرفع: لا سعة باقية في مساحة المزامنة، ومحفوظٌ على جهازك";
    if (st.status === "yielded") return "أُخليت سعتُها لتصحيحات الواجهة، وتبقى على جهازك";
    if (st.status === "error") return "⚠ تعذّر الرفع الأخير، ويُعاد تلقائيًّا";
    if (st.status === "wiped") return "مُحي ما رُفع";
    if (st.status === "unsupported") return "⚠ في حسابك صيغةٌ أحدث — لم يُرفع شيء";
    return st.status;
  }
  // حال مساحة كل موقع — الواجهة والفقرات، والتطبيق منها — ويُبرَز صفُّ الموقع المختار
  function renderSyncDomains() {
    var el = $("syncDomainsLine");
    if (!el) return;
    var keys = [];
    ALL_IDS.forEach(function (id) { keys.push(C.key(C.K.SYNC_STATE, id)); keys.push(C.key("cml_bsync_state", id)); });
    chrome.storage.local.get(keys, function (s) {
      el.textContent = "";
      var rows = ALL_IDS.filter(function (id) { return s[C.key(C.K.SYNC_STATE, id)] || s[C.key("cml_bsync_state", id)]; });
      if (!rows.length) return;
      var tbl = document.createElement("table"); tbl.className = "grid";
      var th = document.createElement("thead"), hr = document.createElement("tr");
      ["الموقع", "تصحيحات الواجهة", "تصحيحات الفقرات"].forEach(function (t) { var h = document.createElement("th"); h.scope = "col"; h.textContent = t; hr.appendChild(h); });
      th.appendChild(hr); tbl.appendChild(th);
      var tb = document.createElement("tbody");
      rows.forEach(function (id) {
        var tr = document.createElement("tr");
        if (id === DOM) tr.className = "sel";
        [["الموقع", dname(id)], ["تصحيحات الواجهة", syncStText(s[C.key(C.K.SYNC_STATE, id)], N.fix, id === "app")],
         ["تصحيحات الفقرات", capsOf(id).bodies.on ? syncStText(s[C.key("cml_bsync_state", id)], N.para) : "—"]].forEach(function (c) {
          var td = document.createElement("td"); td.setAttribute("data-label", c[0]); td.textContent = c[1]; tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      el.appendChild(tbl);
    });
  }
  function renderSync() {
    renderSyncDomains();
    var off = $("syncOff"), on = $("syncOn");
    if (!off && !on && !$("syncWipeBtn")) return; // قشور الاختبار بلا هذا القسم
    chrome.storage.local.get([C.K.SYNC_ENABLED, C.K.SYNC_STATE], function (s) {
      var enabled = s[C.K.SYNC_ENABLED] === true;
      if (off) off.classList.toggle("hidden", enabled);
      if (on) on.classList.toggle("hidden", !enabled);
      renderWipeBox(enabled); // قسميٌّ: يُرسم في الحالين قبل أي خروج مبكر
      if (!enabled) return;
      var st = s[C.K.SYNC_STATE];
      var line = $("syncStateLine"), fill = $("syncBarFill");
      if (!line) return;
      var pre = "مساحة " + qn("app") + ": ";
      function pct(b) { return Math.min(100, Math.round((b || 0) / C.SYNC_TOTAL_BYTES * 100)); }
      if (st && st.status === "ok") {
        var kb = Math.round((st.bytes || 0) / 100) / 10; // بمنزلة عشرية: اللقطات الصغيرة لا تظهر صفرًا
        line.innerHTML = datedLine(esc(pre) + "آخر رفع " + esc(hDateTime(st.at)) + " — <b>" +
          (st.count || 0).toLocaleString("en") + "</b> من تصحيحاتك وقواعدك، <b>" +
          kb.toLocaleString("en") + "</b> كيلوبايت من " + SYNC_TOTAL_KB.toLocaleString("en") + " كيلوبايت. وحالُ سائر المواقع في الجدول أدناه.");
        if (fill) { fill.style.width = pct(st.bytes) + "%"; fill.style.background = "var(--brand)"; }
      } else if (st && st.status === "overflow") {
        // صادقة لا مهوِّنة: لم يُرفع شيء من هذه الدفعة، والمحلي كامل لم يُمسّ
        var needKb = Math.ceil((st.need || 0) / 1000);
        line.innerHTML = esc(pre) + "⚠ <b>لم يُرفع شيء:</b> تصحيحاتُك أكبر من مساحة المزامنة (تحتاج نحو " +
          needKb.toLocaleString("en") + " كيلوبايت والحدّ الأقصى " + SYNC_TOTAL_KB.toLocaleString("en") +
          "). كلُّها محفوظة محليًّا كما هي — احذف بعض التصحيحات، أو انقلها بين أجهزتك ملفًّا من «تصدير تصحيحاتك فقط».";
        if (fill) { fill.style.width = "100%"; fill.style.background = "var(--danger)"; }
      } else if (st && st.status === "wiped") {
        line.innerHTML = esc(pre) + "مُحي ما كان مرفوعًا (" + esc(hDateTime(st.at)) +
          ") — <b>لا شيء مرفوع في حسابك الآن</b>. والمزامنة ما زالت مفعّلةً على هذا الجهاز، " +
          "فأول تعديل في تصحيحاتك أو قواعدك يرفعها من جديد.";
        if (fill) { fill.style.width = "0"; fill.style.background = "var(--brand)"; }
      } else if (st && st.status === "error") {
        // الأرقامُ الهندية لما كتبناه وحده — نصُّ خطأ المتصفح يُضمّ بعدُ كما جاء
        line.textContent = datedLine(pre + "⚠ تعذّر الرفع الأخير (" + hDateTime(st.at) +
          ") — لم تُرفع هذه الدفعة، وتصحيحاتك كلها محفوظة على جهازك كما هي. ") +
          "قال المتصفح: " + (st.error || "خطأ غير معروف") + " — وأكثرُ أسبابه كثرةُ الكتابات في الدقيقة، وكروم يحدّها. " +
          "وتُعاد المحاولة تلقائيًّا عند أول تعديل أو إيقاظ للإضافة؛ ولاستعجالها عدّل تصحيحًا أو أعد تحميل الإضافة.";
        if (fill) { fill.style.width = "0"; fill.style.background = "var(--danger)"; }
      } else if (st && st.status === "unsupported") {
        line.textContent = pre + "⚠ لم يُرفع شيء: في حسابك نسخةٌ مرفوعة بصيغةٍ أحدث من هذا الإصدار " +
          "(من إصدارٍ أحدث للإضافة على جهازٍ آخر)، فلا نكتب فوقها كي لا تتلف. " +
          "تصحيحاتك كلها محفوظة على جهازك كما هي — حدّث الإضافة هنا لتعود المزامنة.";
        if (fill) { fill.style.width = "0"; fill.style.background = "var(--danger)"; }
      } else if (st && st.status) {
        line.textContent = pre + "حالُ آخر دفعة: «" + st.status + "» — وهي حالٌ لا تعرفها هذه الصفحة، " +
          "فلا نستطيع تأكيد أن الرفع تمّ. وتصحيحاتك محفوظة على جهازك كما هي على كل حال. " +
          "حدّث الإضافة أو أعد فتح هذه الصفحة.";
        if (fill) { fill.style.width = "0"; fill.style.background = "var(--brand)"; }
      } else {
        line.textContent = "فُعّلت المزامنة ✓ — أول رفع يجري خلال ثوانٍ وستظهر حاله هنا.";
        if (fill) { fill.style.width = "0"; fill.style.background = "var(--brand)"; }
      }
    });
  }

  // ★ أوامر الإدارة تمرّ بالعامل (مراجعة كودكس ٦): ينتظر فراغ الجولة ثم ينفّذ ويرفع جيل المزامنة،
  // ولا يردّ إلا بعد التمام. بيئةٌ بلا مراسلة (قشور الاختبار) ⇒ null فيسلك المستدعي مساره المباشر.
  function syncAdmin(op, opts, cb) {
    if (!hasWorker()) { cb(null); return; }
    var msg = { type: "sync-admin", op: op };
    if (opts && opts.wipe) msg.wipe = true;
    if (opts && opts.domain) { msg.domain = opts.domain; msg.keys = opts.keys; }
    try {
      chrome.runtime.sendMessage(msg, function (res) {
        var e = chrome.runtime.lastError;
        if (e) { cb({ error: e.message || String(e) }); return; }
        cb(res || { error: "لا ردّ من خلفية الإضافة" });
      });
    } catch (e2) { cb({ error: String((e2 && e2.message) || e2) }); }
  }
  function syncConfirm() {
    syncAdmin("enable", null, function (res) {
      if (!res) { syncConfirmDirect(); return; }
      if (res.error) { flash($("syncStatus"), "تعذّر تفعيل المزامنة (" + res.error + ")."); return; }
      var c = $("syncConsent"); if (c) c.classList.add("hidden");
      renderSync();
      flash($("syncStatus"), "فُعّلت المزامنة ✓");
    });
  }
  function syncConfirmDirect() {
    chrome.storage.local.get([C.K.OVERRIDES], function (s) {
      var patch = {};
      patch[C.K.SYNC_ENABLED] = true;
      // وخزة أول رفع: إعادة كتابة التصحيحات بقيمتها الحالية حدثُ تخزينٍ يلتقطه العامل
      patch[C.K.OVERRIDES] = s[C.K.OVERRIDES] || {};
      chrome.storage.local.set(patch, function () {
        if (chrome.runtime.lastError) { flash($("syncStatus"), "تعذّر تفعيل المزامنة."); return; }
        var c = $("syncConsent"); if (c) c.classList.add("hidden");
        renderSync();
        flash($("syncStatus"), "فُعّلت المزامنة ✓");
      });
    });
  }
  var SYNC_OFF_MSG = "أُوقفت المزامنة على هذا الجهاز، وما رُفع سابقًا باقٍ في حسابك. ولمسحه زرُّ «مسح ما رُفع من حسابك»، وهو ظاهرٌ الآن ولا يحتاج إلى إعادة التفعيل.";
  function syncDisable() {
    syncAdmin("disable", null, function (res) {
      if (!res) {
        var patch = {}; patch[C.K.SYNC_ENABLED] = false;
        chrome.storage.local.set(patch, function () {
          if (chrome.runtime.lastError) { flash($("syncStatus"), "تعذّر الحفظ."); return; }
          renderSync();
          flash($("syncStatus"), SYNC_OFF_MSG);
        });
        return;
      }
      if (res.error) { flash($("syncStatus"), "تعذّر الإيقاف (" + res.error + ")."); return; }
      renderSync();
      flash($("syncStatus"), SYNC_OFF_MSG);
    });
  }
  // لبّ المسح البعيد في المسار المباشر (بلا عامل): لموقعٍ واحد (d) أو للكل.
  // النداء يستقبل: {empty:true} إن لم يكن ثمة ما يُمحى، أو {ok:true}، أو {error:"…"}.
  function wipeRemote(cb, d) {
    probeSyncArea(function (keys, err) {
      if (!keys) { cb({ error: err || "مساحة المزامنة غير متاحة" }); return; }
      if (!keys.length) { cb({ empty: true }); return; }
      try {
        chrome.storage.sync.remove(keys, function () {
          var e = chrome.runtime && chrome.runtime.lastError;
          if (e) { cb({ error: e.message }); return; }
          // حالٌ صادقة بعد المسح، ومحوُ بصمة آخر حالةٍ طابقت السحابة — وإلا عدّ حارسُ الصدى الحالةَ
          // المحلية «مزامَنةً» فلم يُرفع شيءٌ أبدًا بعد المسح والمزامنةُ مفعّلة
          var ids = d ? [d] : ALL_IDS;
          var stK = ids.map(function (x) { return C.key(C.K.SYNC_STATE, x); });
          chrome.storage.local.get(stK, function (s) {
            chrome.storage.local.remove(ids.map(function (x) { return C.key(C.K.SYNC_LASTHASH, x); }), function () {
              var e2 = chrome.runtime && chrome.runtime.lastError;
              var patch = {};
              stK.forEach(function (k) { patch[k] = { status: "wiped", at: Date.now(), rev: ((s || {})[k] || {}).rev || 0 }; });
              chrome.storage.local.set(patch, function () {
                var e3 = chrome.runtime && chrome.runtime.lastError;
                var bad = e2 || e3;
                cb({ ok: true, stateErr: bad ? String(bad.message || bad) : null });
              });
            });
          });
        });
      } catch (e2) {
        cb({ error: String((e2 && e2.message) || e2) });
      }
    }, d);
  }
  function syncWipe() {
    if (!confirm("سيُمحى كل ما رفعته هذه الإضافة إلى مساحة مزامنة حسابك، للمواقع كلها.\n\n" +
      "نسخُ أجهزتك المحلية لا تُمسّ. وما دامت المزامنة مفعّلةً على جهازٍ ما فسيُرفع من جديد عند أول تعديل فيه.\n\nأتتابع؟")) return;
    function done(res) {
      renderSync();
      if (res.error) { flash($("syncStatus"), "تعذّر المسح: " + res.error); return; }
      if (res.empty) { flash($("syncStatus"), "مساحة المزامنة خالية أصلًا — لا شيء يُمحى."); return; }
      flash($("syncStatus"), "مُحي ما رُفع من حسابك ✓ — نسخ أجهزتك المحلية باقية كما هي." +
        (res.stateErr ? " (لكن تعذّر تحديث الحال المعروضة: " + res.stateErr + " — أعد فتح الصفحة.)" : ""));
    }
    syncAdmin("wipe", null, function (res) {
      if (!res) { wipeRemote(done); return; }
      done(res);
    });
  }

  // ---------- فخّ أذونات المضيف منذ فايرفوكس 127 ----------
  // فايرفوكس MV3 لا يمنح أذوناتِ مواقع سكربتات المحتوى عند التثبيت؛ فنكشف الحال هنا ونعرض زرّ منح.
  // الخطأ الآمن «لا لوحة»: لوحةٌ كاذبة في كروم أسوأُ من غيابها في فايرفوكس.
  var FF_ORIGINS = [];
  C.DOMAINS.forEach(function (d) { d.matches.forEach(function (m) { if (FF_ORIGINS.indexOf(m) < 0) FF_ORIGINS.push(m); }); });
  function isFirefox() {
    try {
      return typeof browser !== "undefined" && browser.runtime &&
        typeof browser.runtime.getBrowserInfo === "function";
    } catch (e) { return false; }
  }
  function initFfPermBox() {
    var box = $("ffPermBox"), btn = $("ffPermGrant"), st = $("ffPermStatus");
    if (!box || !btn) return; // قشور الاختبار بلا هذه اللوحة
    try {
      if (!isFirefox()) return;
      if (!browser.permissions || typeof browser.permissions.contains !== "function") return;
      browser.permissions.contains({ origins: FF_ORIGINS }).then(function (granted) {
        if (!granted) box.classList.remove("hidden");
      }).catch(function () {});
      btn.addEventListener("click", function () {
        // request داخل معالج النقر مباشرةً: فايرفوكس يشترط إيماءةَ مستخدم حية
        try {
          browser.permissions.request({ origins: FF_ORIGINS }).then(function () {
            return browser.permissions.contains({ origins: FF_ORIGINS });
          }).then(function (granted) {
            checkAccess();
            if (!st) return;
            st.classList.remove("hidden");
            if (granted) {
              box.classList.add("hidden");
              st.textContent = "مُنح الإذن ✓ — حدّث الآن تبويبات مواقع Claude المفتوحة (Ctrl+Shift+R) لتظهر بالعربية.";
            } else {
              flash(st, "لم يُمنح الإذن — اضغط الزر ثم اختر «السماح» في حوار فايرفوكس.");
            }
          }).catch(function () {});
        } catch (e) {}
      });
    } catch (e) {}
  }

  // ---------- إعادة الضبط: بنطاقين — موقعٌ واحد، أو كل شيء ----------
  // محليةٌ بالعقد، وللمستخدم خيارٌ صريح يوسّعها إلى الطرف البعيد (للموقع: مساحتُه وحدها).
  function resetSiteTarget() {
    var sel = $("resetSiteSel");
    var v = sel ? sel.value : (isAll() ? "" : DOM);
    return C.domain(v) ? v : null;
  }
  function resetSite() {
    var d = resetSiteTarget();
    if (!d) { flash($("dangerStatus"), "اختر الموقع الذي تعيد ضبطه أولًا.", true); if ($("resetSiteSel")) $("resetSiteSel").focus(); return; }
    var also = !!($("resetWipeSync") && $("resetWipeSync").checked);
    var msg = "سيُحذف من هذا الجهاز كل ما يخصّ " + qn(d) + " وحده:\n" +
      "مفتاح تشغيله واختيار محرّكه، وتصحيحاتك وقواعدك الذكية وتصحيحات الفقرات فيه، ونتائج فحصه وورقة اتجاهه.\n\n" +
      "وتبقى المواقع الأخرى والإعدادات العامة كما هي.\n" +
      (also ? "ويُمحى أولًا ما رُفع من هذا الموقع إلى مساحة مزامنة حسابك؛ فإن تعذّر ذلك لم يُحذف من جهازك شيء.\n"
            : "وما رُفع منه إلى مساحة مزامنة حسابك يبقى هناك، ويعود إلى هذا الجهاز ما دامت المزامنة مفعّلة.\n") +
      "\nلا يمكن التراجع. أتتابع؟";
    if (!confirm(msg)) return;
    var keys = C.keysOfDomain(d);
    syncAdmin("reset", { wipe: also, domain: d, keys: keys }, function (res) {
      if (!res) {
        var local = function (extra) {
          chrome.storage.local.remove(keys, function () { flash($("dangerStatus"), "أُعيد ضبط " + qn(d) + " وحده." + (extra || "")); loadState(); });
        };
        if (!also) { local(); return; }
        wipeRemote(function (r2) {
          if (r2.error) { flash($("dangerStatus"), "لم يُعَد الضبط ولم يُحذف من جهازك شيء: تعذّر مسح ما رُفع (" + r2.error + ")."); return; }
          local(r2.empty ? " ولم يكن في حسابك شيء مرفوع منه." : " ومُحي ما رُفع منه ✓");
        }, d);
        return;
      }
      if (res.error) { flash($("dangerStatus"), "لم يُعَد الضبط ولم يُحذف من جهازك شيء: " + res.error); return; }
      var extra = !also ? "" : (res.empty ? " ولم يكن في حسابك شيء مرفوع منه." : " ومُحي ما رُفع منه ✓");
      flash($("dangerStatus"), "أُعيد ضبط " + qn(d) + " وحده." + extra);
      loadState();
    });
  }
  function resetAll() {
    var also = !!($("resetWipeSync") && $("resetWipeSync").checked);
    var sites = "المواقع كلها (" + namesOf(ALL_IDS) + ")";
    var msg = also
      ? "سيُحذف من هذا الجهاز كل شيء في " + sites + ": الإعدادات العامة، وتشغيل كل موقعٍ ومحرّكه، وتصحيحاتك وقواعدك الذكية وتصحيحات الفقرات، ونتائج الفحص.\n" +
        "ويُمحى أيضًا ما رُفع إلى مساحة مزامنة حسابك في جوجل.\n\n" +
        "يُمحى المرفوع أولًا؛ فإن تعذّر لم يُحذف من جهازك شيء.\n" +
        "ونسخُ أجهزتك الأخرى المحلية لا تُمسّ.\n\nلا يمكن التراجع. أتتابع؟"
      : "سيُحذف من هذا الجهاز وحده كل شيء في " + sites + ": الإعدادات العامة، وتشغيل كل موقعٍ ومحرّكه، وتصحيحاتك وقواعدك الذكية وتصحيحات الفقرات، ونتائج الفحص.\n\n" +
        "وما رُفع سابقًا إلى مساحة مزامنة حسابك في جوجل يبقى هناك كما هو،\n" +
        "ويعود إلى هذا الجهاز كاملًا متى أعدتَ تفعيل المزامنة.\n" +
        "ولمحوه معه: ألغِ هذه الرسالة، وعلّم «وامسح أيضًا ما رُفع إلى حسابك في جوجل».\n\n" +
        "لا يمكن التراجع. أتتابع؟";
    if (!confirm(msg)) return;
    // عبر العامل: ينتظر فراغ جولة المزامنة ثم يمسح (إن طُلب) ويحذف المحلي ويرفع الجيل
    syncAdmin("reset", { wipe: also }, function (res) {
      if (!res) { resetDirect(also); return; }
      if (res.error) {
        flash($("dangerStatus"), "لم يُعَد الضبط ولم يُحذف من جهازك شيء: " + res.error +
          (also ? " — أعد المحاولة، أو أزل العلامة لتقتصر على إعادة الضبط المحلية." : ""));
        return;
      }
      var extra = !also
        ? " وما رُفع إلى حسابك باقٍ هناك — امسحه بزرّ «مسح ما رُفع من حسابك» في قسم المزامنة."
        : (res.empty ? " ولم يكن في حسابك شيء مرفوع." : " ومُحي ما رُفع إلى حسابك ✓");
      flash($("dangerStatus"), "أُعيد ضبط كل شيء." + extra);
      loadState();
    });
  }
  // المسار المباشر القديم — لبيئةٍ بلا مراسلةٍ مع العامل وحدها (قشور الاختبار)
  function resetDirect(also) {
    function local(extra) {
      chrome.storage.local.remove(KEYS, function () {
        flash($("dangerStatus"), "أُعيد ضبط كل شيء." + (extra || ""));
        loadState();
      });
    }
    if (!also) { local(" وما رُفع إلى حسابك باقٍ هناك — امسحه بزرّ «مسح ما رُفع من حسابك» في قسم المزامنة."); return; }
    // البعيد أولًا: لو حُذف المحلي أوّلًا ثم أخفق المسح، ضاع علمُ المزامنة والدفاتر وبقي المرفوع
    wipeRemote(function (res) {
      if (res.error) {
        flash($("dangerStatus"), "لم يُعَد الضبط ولم يُحذف من جهازك شيء: تعذّر مسح ما رُفع (" +
          res.error + "). أعد المحاولة، أو أزل العلامة لتقتصر على إعادة الضبط المحلية.");
        return;
      }
      local(res.empty ? " ولم يكن في حسابك شيء مرفوع." : " ومُحي ما رُفع إلى حسابك ✓");
    });
  }

  // ---------- حذف كل التصحيحات: الواجهة والقواعد و(ل١٤) الفقرات، ويقول ذلك ----------
  function clearAllOv() {
    readGen(function (gen0) {
      var ids = scopeIds();
      readMany(ids, ["cml_overrides", "cml_user_patterns", "cml_block_ov"], function (per) {
        var plan = [], tT = 0, tR = 0, tB = 0;
        ids.forEach(function (d) {
          var ov = ((per[d].cml_overrides || {})[LANG]) || {};
          var pats = (Array.isArray(per[d].cml_user_patterns) ? per[d].cml_user_patterns : []).filter(Boolean);
          var bo = ((per[d].cml_block_ov || {})[LANG]) || {};
          var nT = Object.keys(ov).length, nR = pats.length, nB = Object.keys(bo).length;
          if (!nT && !nR && !nB) return;
          plan.push({ d: d, ov: ov, pats: pats, bo: bo, nT: nT, nR: nR, nB: nB });
          tT += nT; tR += nR; tB += nB;
        });
        if (!plan.length) { flash($("termsStatus"), "لا تصحيحات لتُحذف" + (isAll() ? " في أيٍّ من المواقع." : " في " + qn(DOM) + ".")); return; }
        var lines = plan.map(function (x) {
          var p = [];
          if (x.nT) p.push(arCount(x.nT, N.fix));
          if (x.nR) p.push(arCount(x.nR, N.rule));
          if (x.nB) p.push(arCount(x.nB, N.para));
          return "  " + qn(x.d) + ": " + p.join(" و");
        });
        if (!confirm("سيُحذف من هذا الجهاز كل ما صحّحته في " + (isAll() ? "المواقع كلها" : qn(DOM)) + ":\n" + lines.join("\n") +
          "\n\nويشمل ذلك تصحيحاتِ الواجهة والقواعد الذكية وتصحيحاتِ الفقرات في المقالات.\n" +
          "ولا يمكن التراجع؛ فإن شئت فصدّر نسخةً أولًا من «تصدير تصحيحاتك فقط».\n\nأتتابع؟")) return;
        var k = 0, failed = null, got = { t: 0, r: 0, b: 0 };
        (function next() {
          if (k >= plan.length || failed) {
            renderTerms(); renderBlocks(); renderStats(); renderRecon();
            if (failed) { flash($("termsStatus"), failed === "stale" ? STALE_MSG : "تعذّر حذف بعضها."); return; }
            flash($("termsStatus"), "حُذفت: " + [got.t ? arCount(got.t, N.fix) : "", got.r ? arCount(got.r, N.rule) : "", got.b ? arCount(got.b, N.para) : ""]
              .filter(Boolean).join(" و") + ".");
            return;
          }
          var x = plan[k++];
          // يُحذف ما رآه المستخدم (بقيمته) لا ما وصل بعد التأكيد
          var ops = Object.keys(x.ov).map(function (key) { return { op: "del", k: key, ifv: x.ov[key] }; })
            .concat(x.pats.map(function (p) { return { op: "unrule", re: p.re }; }));
          var afterTerms = function () {
            if (!x.nB) { next(); return; }
            editBlocks(x.d, Object.keys(x.bo).map(function (key) { return { op: "del", k: key, ifv: x.bo[key] }; }), function (err, rep) {
              if (err) failed = err === "stale" ? "stale" : "fail"; else got.b += rep.del;
              next();
            }, gen0);
          };
          if (!ops.length) { afterTerms(); return; }
          editTerms(x.d, ops, function (err, rep) {
            if (err) { failed = err === "stale" ? "stale" : "fail"; next(); return; }
            got.t += rep.del; got.r += rep.unrule || 0;
            afterTerms();
          }, gen0);
        })();
      });
    });
  }

  // ---------- تصحيحات الفقرات (المرحلة ٢): مراجعةٌ وحذف — والتصحيح نفسه من النافذة على الصفحة ----------
  function renderBlocks() {
    var box = $("blkList");
    if (!box) return;
    var ds = scopeIds().filter(function (d) { return capsOf(d).bodies.on; });
    if (!ds.length) { box.textContent = ""; setText("blkCount", ""); return; }
    var keys = ds.map(function (d) { return C.key("cml_block_ov", d); });
    chrome.storage.local.get(keys, function (r) {
      var q = (($("blkSearch") || {}).value || "").trim();
      box.textContent = "";
      var n = 0, all = 0;
      ds.forEach(function (d, i) {
        var m = ((r[keys[i]] || {})[LANG]) || {};
        Object.keys(m).forEach(function (fp) {
          all++;
          var txt = plainTpl(m[fp]);
          if (q && txt.indexOf(q) < 0) return;
          n++;
          if (n > 200) return;   // العرض بسقف؛ والبحث يصل إلى ما وراءه
          var row = document.createElement("div");
          row.className = "row";
          var t = document.createElement("span");
          t.style.flex = "1"; t.style.fontSize = "13px";
          t.textContent = (isAll() ? qn(d) + " — " : "") + (txt.length > 180 ? txt.slice(0, 180) + "…" : txt);
          t.title = txt;
          var del = document.createElement("button");
          del.textContent = "حذف";
          del.setAttribute("aria-label", "حذف تصحيح الفقرة: " + (txt.length > 60 ? txt.slice(0, 60) + "…" : txt));
          del.addEventListener("click", function () {
            editBlocks(d, [{ op: "del", k: fp, ifv: m[fp] }], function (err, rep) {
              // رسالةٌ صادقة: لا ندري هنا أللفقرة ترجمةٌ في الإضافة أم لا — فنقول الحالين؛ وحذفٌ لم يقع
              // (تغيّر التصحيح بعد عرضه) يُقال كذلك لا يُعلَن نجاحًا
              if (err) flash($("blkStatusO"), err === "stale" ? STALE_MSG : "تعذّر الحذف.", true);
              else if (!rep || !rep.del) flash($("blkStatusO"), "لم يُحذف شيء: تغيّر هذا التصحيح بعد عرضه — راجع القائمة ثم أعد المحاولة.", true);
              else flash($("blkStatusO"), "حُذف تصحيحك — تعود الفقرة إلى ترجمة الإضافة إن كانت لها ترجمة، وإلا إلى نصّها الإنجليزي ✓", false);
              renderBlocks();
            });
          });
          row.appendChild(t); row.appendChild(del);
          box.appendChild(row);
        });
      });
      setText("blkCount", !all ? "لا تصحيحات فقرات بعد."
        : q ? "المطابق: " + arCount(n, N.para) + " من " + arCount(all, N.para, true)
        : arCount(all, N.para) + (n > 200 ? " (يُعرض أول 200 — ابحث لتصل إلى البقية)" : ""));
    });
  }

  // ═══ حال التشغيل: الرئيس بوّابة، والمواقع بحالها الفعلية، والتجميع في الاتجاه المعاكس ═══
  // الحال الفعلية بمعادلة المحرّك نفسها (master && site) ومعها وصول المتصفح إلى الموقع (ج٣)
  var RUN = { master: true, rtl: true, chat: true, site: {}, eng: {}, engGlobal: null, access: {}, loaded: false };
  function effOn(d) { return RUN.master && RUN.site[d] !== false && RUN.access[d] !== false; }
  function readRun(cb) {
    var keys = ["cml_enabled", "cml_rtl", "cml_chatrtl", C.K.RTL_ENGINE]
      .concat(ALL_IDS.map(siteKey)).concat(ALL_IDS.map(engKey));
    chrome.storage.local.get(keys, function (s) {
      s = s || {};
      RUN.master = s.cml_enabled !== false;
      RUN.rtl = s.cml_rtl !== false;
      RUN.chat = s.cml_chatrtl !== false;
      RUN.engGlobal = s[C.K.RTL_ENGINE] === "v1" ? "v1" : null;
      ALL_IDS.forEach(function (d) {
        RUN.site[d] = s[siteKey(d)] !== false;
        var e = s[engKey(d)];
        RUN.eng[d] = e === "v1" || e === "v2" ? e : null;
      });
      RUN.loaded = true;
      cb();
    });
  }
  function siteState(d) {
    if (!RUN.master) return { t: "موقوف بالمفتاح الرئيس", c: "st-off" };
    if (RUN.site[d] === false) return { t: "متوقّف", c: "st-off" };
    if (RUN.access[d] === false) return { t: "لا يصل إليه المتصفح — اسمح للإضافة بالوصول إلى الموقع من إعدادات الإضافات", c: "st-bad" };
    return { t: "مفعّل", c: "st-on" };
  }
  var sitesBuilt = false;
  // اسم الموقع وعنوانه المختصر معزولًا (خليةُ «الموقع» في جدولي «المواقع» و«لكل موقع»)
  function siteCell(d, t1) {
    var b = document.createElement("b"); b.textContent = dname(d); t1.appendChild(b);
    var hs = document.createElement("div"); hs.className = "host";
    var bd = document.createElement("bdi"); bd.dir = "ltr"; bd.textContent = C.siteLabel(d); hs.appendChild(bd); t1.appendChild(hs);
  }
  // ★ (ر8-د — N3) جدول «المواقع» بعد «التشغيل»: الموقع والتعريب والحال وحدها؛ ومحرّك الاتجاه ومصدره في قسم الاتجاه (buildRtlSites)
  function buildSites() {
    var body = $("sitesBody");
    if (!body || sitesBuilt) return;
    sitesBuilt = true;
    ALL_IDS.forEach(function (d) {
      var cap = capsOf(d);
      var tr = document.createElement("tr"); tr.id = "siteRow_" + d;
      var t1 = document.createElement("td"); t1.setAttribute("data-label", "الموقع");
      siteCell(d, t1);
      // ★ (ر8-د — N3) كل مسارٍ في <bdi dir="ltr">، والنصّ العربي وفواصله خارجه: المسار بين العربية بلا عزلٍ كان يُرسم «legal/privacy/»
      var wh = document.createElement("div"); wh.className = "where";
      (cap.whereSeg || [{ t: cap.where }]).forEach(function (sg) {
        if (sg.p === undefined) { wh.appendChild(document.createTextNode(sg.t)); return; }
        var bp = document.createElement("bdi"); bp.dir = "ltr"; bp.textContent = sg.p; wh.appendChild(bp);
      });
      t1.appendChild(wh);
      var t2 = document.createElement("td"); t2.setAttribute("data-label", "التعريب");
      var sw = document.createElement("span"); sw.className = "switch";
      var inp = document.createElement("input"); inp.type = "checkbox"; inp.id = "siteOn_" + d;
      inp.setAttribute("aria-label", "تفعيل " + qn(d));
      inp.setAttribute("aria-describedby", "siteSt_" + d);
      // (ل٧) تحديثٌ في الموضع: الكتابة وحدها، والرسمُ من onChanged بلا هدمٍ — فلا يسقط التركيز
      inp.addEventListener("change", function () { setSite(d, inp.checked); });
      var sl = document.createElement("span"); sl.className = "slider";
      sw.appendChild(inp); sw.appendChild(sl); t2.appendChild(sw);
      var t3 = document.createElement("td"); t3.setAttribute("data-label", "الحال");
      var st = document.createElement("span"); st.id = "siteSt_" + d; t3.appendChild(st);
      [t1, t2, t3].forEach(function (td) { tr.appendChild(td); });
      body.appendChild(tr);
    });
  }
  // ★ (ر8-د — N3) «لكل موقع» في قسم الاتجاه بعد المحرّك الافتراضي: محرّك اتجاه كل موقع (تجاوزُه cml_engine_site.<موقع>) ومصدرُ اتجاهه —
  // بالمعرّفات نفسها (siteEng_ وsiteDir_)، فالكتابة والتحديث الحيّ وتعطيلها مع «عكس الاتجاه» كما كانت
  var rtlSitesBuilt = false;
  function buildRtlSites() {
    var body = $("rtlSitesBody");
    if (!body || rtlSitesBuilt) return;
    rtlSitesBuilt = true;
    ALL_IDS.forEach(function (d) {
      var cap = capsOf(d);
      var tr = document.createElement("tr"); tr.id = "rtlRow_" + d;
      var t1 = document.createElement("td"); t1.setAttribute("data-label", "الموقع");
      siteCell(d, t1);
      var t4 = document.createElement("td"); t4.setAttribute("data-label", "محرّك الاتجاه");
      var sel = document.createElement("select"); sel.id = "siteEng_" + d;
      sel.setAttribute("aria-label", "محرّك الاتجاه في " + qn(d));
      [["", "يتبع الافتراضي"], ["v2", "الشامل"], ["v1", "المبسّط"]].forEach(function (o) {
        var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; sel.appendChild(op);
      });
      sel.addEventListener("change", function () { setSiteEngine(d, sel.value); });
      t4.appendChild(sel);
      var t5 = document.createElement("td"); t5.setAttribute("data-label", "الاتجاه من");
      var dirc = document.createElement("span"); dirc.id = "siteDir_" + d; dirc.textContent = cap.live.on ? "ورقة حيّة" : "لقطة الإصدار";
      t5.appendChild(dirc);
      [t1, t4, t5].forEach(function (td) { tr.appendChild(td); });
      body.appendChild(tr);
    });
  }
  function setSite(d, on, cb) {
    // الغياب = مفعّل: التفعيل محوٌ للمفتاح، والإطفاء false صريحة
    if (on) chrome.storage.local.remove(siteKey(d), function () { void chrome.runtime.lastError; if (cb) cb(); });
    else { var o = {}; o[siteKey(d)] = false; chrome.storage.local.set(o, function () { void chrome.runtime.lastError; if (cb) cb(); }); }
  }
  function setSiteEngine(d, v) {
    var done = function () {
      void chrome.runtime.lastError;
      var eff = v || (RUN.engGlobal === "v1" ? "v1" : "v2");
      // ★ (ر8-د — N3) الحال بجوار جدول «لكل موقع» في قسم الاتجاه (كانت في بطاقة «المواقع» مع عمودها)
      flash($("rtlSitesStatus") || $("sitesStatus"), qn(d) + ": " + (v ? engName(v) : "يتبع الافتراضي (" + engName(eff) + ")") + " — يسري فورًا على تبويبات " + hostOf(d) + ".", false);
    };
    if (!v) chrome.storage.local.remove(engKey(d), done);
    else { var o = {}; o[engKey(d)] = v; chrome.storage.local.set(o, done); }
  }
  function renderRun() {
    if (!RUN.loaded) return;
    var M = ALL_IDS.length, nOn = ALL_IDS.filter(effOn).length;
    // سببا التوقّف في موقعٍ والرئيسُ مفعّل يُعدّان كلٌّ وحده: مفتاحه في الجدول، أو وصول المتصفح (ج٣) —
    // فلا يُقال «مطفأة في جدول المواقع» ومفاتيحها مفعّلة والعلّة إذنُ المتصفح
    var nOff = ALL_IDS.filter(function (d) { return RUN.site[d] === false; }).length;
    var nNoAcc = ALL_IDS.filter(function (d) { return RUN.site[d] !== false && RUN.access[d] === false; }).length;
    if ($("enabled")) $("enabled").checked = RUN.master;
    if ($("rtl")) $("rtl").checked = RUN.rtl;
    if ($("chatrtl")) $("chatrtl").checked = RUN.chat;
    // التجميع في الاتجاه المعاكس (ج١): الرئيس يعكس ما يجري فعلًا في المواقع
    var ACC_FIX = "اسمح للإضافة بالوصول إليها من إعدادات الإضافات في المتصفح";
    setText("masterState", !RUN.master ? "التعريب متوقّف الآن في المواقع كلها."
      : nOn === M ? "يعمل في المواقع كلها (" + arCount(M, N.site) + ")."
      : nOff === M ? "لا موقع مفعّل — المواقع كلها متوقّفة في جدول «المواقع»."
      : !nNoAcc ? "يعمل في " + nOn + " من " + arCount(M, N.site, true) + "."
      : (nOn ? "يعمل في " + nOn + " من " + arCount(M, N.site, true) : "لا يعمل التعريب الآن في أيٍّ من المواقع") +
        " — المتوقّف منها في جدول «المواقع»: " + nOff + "، وما لا يصل إليه المتصفح: " + nNoAcc + " (" + ACC_FIX + ").");
    var allOff = RUN.master && ALL_IDS.every(function (d) { return RUN.site[d] === false; });
    show("gateBar", !RUN.master);
    show("allOffBar", allOff);
    // بطاقة الخط لا تُعطَّل والتعريب متوقف — يُقال السبب وحسب (لا إخفاء صامت)
    show("fontOffWhy", !RUN.master);
    // والوصف لقارئ الشاشة معه: aria-describedby يقرأ العنصر المُشار إليه ولو كان مخفيًّا، فكان يُعلن «التعريب متوقف»
    // والتعريب يعمل (المراجعة العدائية S6-B، وقِيس بشجرة الإتاحة في كروم)
    var ffs = $("fontFs");
    if (ffs) { if (RUN.master) ffs.removeAttribute("aria-describedby"); else ffs.setAttribute("aria-describedby", "fontOffWhy"); }
    ALL_IDS.forEach(function (d) {
      var inp = $("siteOn_" + d), st = $("siteSt_" + d), row = $("siteRow_" + d), sel = $("siteEng_" + d), rrow = $("rtlRow_" + d);
      // (ل١) البوّابة: الرئيس مطفأ ⇒ المفتاح يُعرض بحاله الفعلية (مطفأ) ومعطَّلًا، واختيارُه محفوظ
      if (inp) {
        inp.checked = RUN.master ? RUN.site[d] !== false : false;
        inp.disabled = !RUN.master;
        inp.setAttribute("aria-describedby", RUN.master ? "siteSt_" + d : "siteSt_" + d + " gateText");
      }
      if (st) { var s = siteState(d); st.textContent = s.t; st.className = s.c; }
      [row, rrow].forEach(function (r) {
        if (!r) return;
        r.classList.toggle("sel", d === DOM);
        if (d === DOM) r.setAttribute("aria-current", "true"); else r.removeAttribute("aria-current");
      });
      if (sel) {
        sel.value = RUN.eng[d] || "";
        sel.disabled = !RUN.rtl;
        if (!RUN.rtl) sel.setAttribute("aria-describedby", "rtlOffWhy"); else sel.removeAttribute("aria-describedby");
      }
    });
    // (ل٥) «عكس الاتجاه» مطفأ ⇒ ما يتبعه معطَّلٌ بسببٍ مكتوب
    var fs = $("rtlFs");
    if (fs) fs.disabled = !RUN.rtl;
    show("rtlOffWhy", !RUN.rtl);
    renderChatRow();
    updateDomainOptions();
  }
  function renderChatRow() {
    var inp = $("chatrtl"), why = $("chatWhy"), lab = $("chatLabel");
    if (!inp || !why) return;
    var owners = ALL_IDS.filter(function (d) { return capsOf(d).chat.on; });
    var na = !isAll() && !capsOf(DOM).chat.on;
    inp.disabled = na;
    why.textContent = na ? capsOf(DOM).chat.why : "";
    why.classList.toggle("hidden", !na);
    if (lab) lab.textContent = "ضبط اتجاه نص المحادثة" + (owners.length && (isAll() || na) ? " (" + namesOf(owners) + (owners.length > 1 ? " وحدها)" : " وحده)") : "");
  }
  // (ج٣) وصول المتصفح إلى كل موقع — بلا إذنٍ جديد (permissions.contains متاحٌ لكل إضافة)
  function checkAccess() {
    var P = chrome.permissions;
    if (!P || typeof P.contains !== "function") return;
    ALL_IDS.forEach(function (d) {
      try {
        P.contains({ origins: C.domain(d).matches }, function (ok) {
          void chrome.runtime.lastError;
          RUN.access[d] = ok !== false;
          renderRun();
        });
      } catch (e) {}
    });
  }

  // ═══ الموقع المختار: القائمة («الكل» أولًا وافتراضيًّا)، ومصفوفة القدرات على الأقسام ═══
  function optText(d) {
    var why = RUN.loaded ? offReason(d) : null;
    return dname(d) + " — " + C.siteLabel(d) + (why ? " (" + (why === "master" ? "موقوف" : why === "off" ? "متوقّف" : "بلا وصول") + ")" : "");
  }
  function updateDomainOptions() {
    var sel = $("domainSel");
    if (!sel) return;
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      o.textContent = o.value === "all" ? "المواقع كلها — " + arCount(ALL_IDS.length, N.site) : optText(o.value);
    }
  }
  function validDom(v) { return v === "all" || !!C.domain(v); }
  function initDomainBar() {
    var sel = $("domainSel");
    if (!sel) return; // قشور الاختبار بلا الرأس: تبقى على التطبيق
    DOM = "all";      // ★ (ل٢) الافتراضي حين لا اختيار محفوظ: «المواقع كلها»
    sel.innerHTML = "";
    var all = document.createElement("option");
    all.value = "all";
    sel.appendChild(all);
    var grp = document.createElement("optgroup"); grp.label = "موقعٌ بعينه";
    ALL_IDS.forEach(function (d) { var o = document.createElement("option"); o.value = d; grp.appendChild(o); });
    sel.appendChild(grp);
    updateDomainOptions();
    var saved = null;
    try { saved = localStorage.getItem("cml_ui_domain"); } catch (e) {}
    if (saved && validDom(saved)) DOM = saved;
    // تسليمٌ من النافذة سبق فتحَ الصفحة: اختيارُه في cml_ui_domain أعلاه، والإشارة نفسها تُستهلك
    try { localStorage.removeItem(GOTO_KEY); } catch (e) {}
    sel.value = DOM;
    sel.addEventListener("change", function () { switchDomain(sel.value, true); });
    // ★ النافذة تكتب موقع تبويبها قبل فتح هذه الصفحة؛ وإن كانت مفتوحةً أصلًا نقلها إليه حدثُ storage —
    // على مفتاح تسليمٍ خاص لمرةٍ واحدة (cml_ui_goto)، لا على cml_ui_domain: هذا تكتبه الصفحة نفسها عند
    // كل تبديل، فكان تبديلُ الموقع في تبويب إعداداتٍ يجرّ كلَّ تبويب إعداداتٍ مفتوح معه (ولو في منتصف
    // سؤال الاستيراد أو إضافة تصحيح)
    window.addEventListener("storage", function (e) {
      if (e.key !== GOTO_KEY || !e.newValue) return;
      var g = null;
      try { g = JSON.parse(e.newValue); } catch (e2) {}
      try { localStorage.removeItem(GOTO_KEY); } catch (e3) {}
      if (g && validDom(g.d) && g.d !== DOM) switchDomain(g.d, false);
    });
  }
  var GOTO_KEY = "cml_ui_goto";
  function switchDomain(v, save) {
    if (!validDom(v)) return;
    DOM = v;
    END.scan = ""; END.rtldoc = "";   // سطرُ ختام «الكل» لا يُحمل إلى موقعٍ بعينه
    if ($("domainSel")) $("domainSel").value = v;
    if (save) { try { localStorage.setItem("cml_ui_domain", v); } catch (e) {} }
    renderCaps();
    loadState();
  }
  // لا إخفاء لقسم: كل قسمٍ في موضعه، ومضمونُه للنطاق، وما لا ينطبق معطّلٌ بسببٍ مكتوب خارج حقله
  function applyNA(whyId, fsId, why) {
    var w = $(whyId), fs = $(fsId);
    if (w) { w.textContent = why || ""; w.classList.toggle("hidden", !why); }
    if (fs) fs.disabled = !!why;
  }
  function renderCaps() {
    var all = isAll(), d = DOM, cap = all ? null : capsOf(d);
    var note = $("domainNote");
    if (note) note.textContent = all
      ? "الأقسام أدناه للمواقع كلها: ما يخصّ كل موقعٍ يظهر في صفٍّ له، وتعمل الأزرار على المواقع كلها، وما وُسم «عام» يسري عليها جميعًا."
      : "الأقسام أدناه لـ" + qn(d) + " (" + C.siteLabel(d) + "): فحصُه واتجاهُه وقاموسُه وتصحيحاتك فيه. وما وُسم «عام» يسري على المواقع كلها، وما لا ينطبق على هذا الموقع يبقى في موضعه معطّلًا مع ذكر سببه.";
    var badge = all ? "كل موقعٍ على حدة" : "لهذا الموقع: " + dname(d);
    setText("scanScope", badge);
    setText("dictScope", badge);
    setText("blkScope", badge);
    setText("rtlScope", all ? "الافتراضي عام · الضبط لكل موقع" : "الافتراضي عام · الضبط لهذا الموقع");
    setText("resetScope", all ? "لموقعٍ تختاره، أو للكل" : "لهذا الموقع، أو للكل");
    // فحص الترجمة
    applyNA("scanWhy", "scanFs", all ? (ALL_IDS.some(function (x) { return capsOf(x).scan.on; }) ? "" : "لا موقع له فحص في المتصفح.") : cap.scan.why);
    var scanIds = (all ? ALL_IDS : [d]).filter(function (x) { return capsOf(x).scan.on; });
    // التبويب المطلوب بمساره (platform.claude.com/docs): صفحاتُ المضيف خارج المسار لا تفحص
    // ★ (ر8-د — N4) وكل مضيفٍ معزولٌ اتجاهيًّا والفاصلة العربية بينها خارج العزل
    setParts("scanWarn", !scanIds.length ? []
      : all ? ["افتح تبويبًا من كل موقعٍ تريد فحصه ("].concat(ltrList(scanIds.map(tabWhere), "، "),
          [") واتركه مفتوحًا، ثم اضغط «فحص المواقع كلها» أو «فحص» في صفّ الموقع: تُفحص بالتتابع، وما لم يُفتح تبويبه يُذكر ويُتجاوز وتبقى نتيجته السابقة."])
      : ["افتح تبويبًا من ", { ltr: tabWhere(d) }, " واتركه مفتوحًا، ثم اضغط «بدء الفحص». " + (cap.scan.kind === "llms" ? "يستغرق ثوانيَ معدودة." : "يستغرق دقيقة أو دقيقتين.")]);
    var cov = $("scanCover");
    if (cov) {
      var showCov = !all && cap.bodies.on && !cap.scan.on;
      cov.classList.add("hidden");
      // بلا بياناتٍ مشحونة لا سطر (لا جملةَ مصطلحاتٍ داخلية بديلًا)
      if (showCov) loadCover(d, function () { if (DOM !== d) return; cov.textContent = coverText(d); cov.classList.toggle("hidden", !cov.textContent); });
    }
    // «تنزيل أمر الترجمة» يُبنى من نتيجة الفحص: بلا ماسحٍ في النطاق يُعطَّل وسببُه بجواره
    var exp = $("scanExport"), expWhy = $("scanExportWhy");
    if (exp) {
      var expOn = (all ? ALL_IDS : [d]).some(function (x) { return capsOf(x).scan.on; });
      exp.disabled = !expOn;
      if (expWhy) {
        expWhy.textContent = expOn ? "" : "أمرُ الترجمة يُبنى من نتيجة «فحص الترجمة»، ولا فحص لـ" + qn(d) +
          " في المتصفح؛ فغيرُ المترجَم فيه غير معروف. و«استيراد الترجمات» يعمل كما هو.";
        expWhy.classList.toggle("hidden", expOn);
      }
    }
    // الاتجاه
    applyNA("rtlDocWhy", "rtlDocFs", all ? (ALL_IDS.some(function (x) { return capsOf(x).rtlDoc.on; }) ? "" : "لا موقع له فحص اتجاه.") : cap.rtlDoc.why);
    // الفقرات
    applyNA("blkWhy", "blkFs", all ? "" : cap.bodies.why);
    // الإضافة: مُنتقي الموقع في «الكل» وحده (إلزامي)
    var nd = $("newDomain");
    if (nd) {
      if (!nd.options.length) {
        var ph = document.createElement("option"); ph.value = ""; ph.textContent = "اختر الموقع…"; nd.appendChild(ph);
        ALL_IDS.forEach(function (x) { var o = document.createElement("option"); o.value = x; o.textContent = dname(x); nd.appendChild(o); });
      }
      nd.classList.toggle("hidden", !all);
      if (!all) nd.value = "";
      show("newDomainNote", all);
    }
    // إعادة الضبط: الموقع المختار افتراضًا، وفي «الكل» يُختار صراحةً
    var rs = $("resetSiteSel");
    if (rs) {
      if (!rs.options.length) {
        var p2 = document.createElement("option"); p2.value = ""; p2.textContent = "اختر الموقع…"; rs.appendChild(p2);
        ALL_IDS.forEach(function (x) { var o = document.createElement("option"); o.value = x; o.textContent = dname(x); rs.appendChild(o); });
      }
      rs.value = all ? "" : d;
      renderResetBtn();
    }
    renderChatRow();
    if (RUN.loaded) renderRun();
    jobButtons("scan"); jobButtons("rtldoc");
  }
  function renderResetBtn() {
    var t = resetSiteTarget(), btn = $("resetSite");
    if (!btn) return;
    btn.disabled = !t;
    btn.textContent = t ? "إعادة ضبط " + qn(t) + " وحده" : "إعادة ضبط موقعٍ واحد";
  }

  // ★ (ر8-د، المراجعة — قرار المنسّق) مفتاح إغلاق الترحيب باسمٍ جديد: البطاقة تُعرض مرّةً لكل مفتاح، ومن أغلقها في test-2.0.0-2
  // (cml_welcome_v2) لم يكن ليرى حال المواقع فيها، فتُعرض للجميع مرّةً أخرى. والقادم من 1.0.0 لم يكتب أيًّا منهما فلا يتغيّر له شيء.
  // والقديم بقيّةُ بناءٍ تجريبي (صنف legacy في KEY_CLASSES) يُمحى هنا عند أول قراءة. وكلاهما محليٌّ لا تمسّه المزامنة
  var WELCOME_K = "cml_welcome_v2b", WELCOME_OLD = "cml_welcome_v2";
  // ★ (ر8-د2 — N7) جملة «وتبقى بالإنجليزية في هذا الإصدار…» من حال المواقع في الجدول (status.en)، لبطاقة الترحيب ولقسم «ما لا تعرّبه» في «حول»
  // معًا — مصدرٌ واحد، فلا تخالف إحداهما الأخرى ولا القائمةَ أعلى البطاقة
  function fillKeep(id) {
    var ke = $(id);
    if (!ke) return;
    var ens = C.DOMAINS.map(function (d) { return d.status && !d.status.full && d.status.en; }).filter(Boolean)
      .concat(["ما غيّرته المواقع أو أضافته بعد إعداده"]);
    ke.textContent = "وتبقى بالإنجليزية في هذا الإصدار " + ens.map(function (t, i) { return i ? "و" + t : t; }).join("، ") + ".";
  }
  function renderWelcome() {
    var box = $("welcomeBox");
    if (!box) return;
    chrome.storage.local.get([WELCOME_K, WELCOME_OLD], function (s) {
      if (s && s[WELCOME_OLD] !== undefined) chrome.storage.local.remove(WELCOME_OLD, function () { void chrome.runtime.lastError; });
      if (s && s[WELCOME_K]) { box.classList.add("hidden"); return; }
      // (ع٦) العدد من الجدول لا «الأربع» مكتوبةً — ويصدق متى زيد موقع
      // ★ (ر8-د، ١ جمادى الأولى ١٤٤٨هـ — N2) «الآن يعمل التعريب» بلفظ المالك، لا «صار» العامّية
      setText("welcomeTitle", "🎉 الآن يعمل التعريب في " + arCount(ALL_IDS.length, N.site, true) + " لـClaude");
      var el = $("welcomeLines");
      el.textContent = "";
      el.appendChild(document.createTextNode("لكلٍّ منها مفتاحه في جدول «المواقع» أدناه، وتختاره من قائمة «الموقع» أعلى الصفحة:"));
      // اسم المضيف معزولٌ اتجاهيًّا: خلطُه بالعربية في سطرٍ واحد كان يقلب ترتيب السطر
      // ★ (ر8-د — N2) وحالُ كل موقعٍ في هذا الإصدار من جدول النطاقات (status: كاملٌ، أو جزئيٌّ بسببه) — مصدرٌ واحد للقائمة وللجملة تحتها
      var partial = 0;
      C.DOMAINS.forEach(function (d) {
        var stt = d.status || {};
        el.appendChild(document.createElement("br"));
        el.appendChild(document.createTextNode("• " + d.name + " — "));
        var b = document.createElement("bdi"); b.dir = "ltr"; b.textContent = C.siteLabel(d.id); el.appendChild(b);
        el.appendChild(document.createTextNode(" — "));
        var sb = document.createElement("b"); sb.id = "welcomeSt_" + d.id;
        sb.textContent = stt.full ? "كامل" : "جزئي"; el.appendChild(sb);
        if (!stt.full) { partial++; if (stt.part) el.appendChild(document.createTextNode(": " + stt.part)); }
      });
      if (partial) {
        el.appendChild(document.createElement("br"));
        el.appendChild(document.createTextNode("وتكتمل المواقع الجزئية في التحديثات القادمة."));
      }
      // ★ (ر8-د — N2) «وتبقى بالإنجليزية في هذا الإصدار…» من الجدول نفسه (status.en لكل موقعٍ جزئي)، فلا تخالف القائمةَ أعلاها؛ وذيلُها
      // العام لما غيّرته المواقع بعد إعداده (وبه وصفُ وثائق المطوّرين). والنصّ في options.html احتياطٌ مطابقٌ لهذا اليوم
      fillKeep("welcomeKeepEn");
      // (DESIGN-fonts §٣.٤) والخط العربي: اسم الافتراضي من الفهرس (C.FONT_DEFAULT) فيتبع قاعدة ق١ إن تغيّر
      var wf = $("welcomeFont"), def = fontDefault();
      if (wf) {
        wf.textContent = "";
        if (def) {
          wf.appendChild(document.createTextNode("وجديدٌ أيضًا: "));
          var bb = document.createElement("b"); bb.textContent = "خطٌّ عربيٌّ تختاره"; wf.appendChild(bb);
          wf.appendChild(document.createTextNode(" — تُرسم الحروف العربية الآن بخط "));
          var bn = document.createElement("bdi"); bn.dir = "ltr"; bn.textContent = def.family; wf.appendChild(bn);
          wf.appendChild(document.createTextNode("، أكثرِ الخطوط العربية طلبًا في Google Fonts، ولك أن تختار غيره أو تعود إلى خط الموقع من قسم «الخط العربي»."));
        }
        wf.classList.toggle("hidden", !def);
        show("welcomeFontBtn", !!def);
      }
      box.classList.remove("hidden");
    });
  }

  // ═══ الخط العربي (DESIGN-fonts §٣.٢–٣.٤): بطاقةٌ عامة بعد «التشغيل» ═════════════════════════════
  // الخيارات من الفهرس CMLConst.FONTS (مصدرٌ واحد للأسماء والعدد والافتراضي)، ثم «خط النظام» (ر5ب) و«خط الموقع كما هو». اختيار الافتراضي
  // يحذف cml_font، وغيرُه يكتب قيمته؛ وعامل الخدمة وحده يكتب النسخة cml_font_data فتراقبها البطاقة لتقول الحال.
  // ولا يُعطَّل شيءٌ والتعريب متوقف (الاختيار حينها بلا ضرر): يظهر #fontOffWhy وحسب.
  var FONT_K = (C.K && C.K.FONT) || "cml_font", FONT_DK = (C.K && C.K.FONT_DATA) || "cml_font_data";
  var FONT = { choice: undefined, data: undefined, pending: null, timer: null, built: false, first: true, reachGen: 0, reachTimer: null };
  function fontEntry(id) {
    var L = C.FONTS || [];
    for (var i = 0; i < L.length; i++) if (L[i] && L[i].id === id) return L[i];
    return null;
  }
  function fontDefault() { return fontEntry(C.FONT_DEFAULT) || (C.FONTS || [])[0] || null; }
  // الخيار المعروض: «خط الموقع»، أو «خط النظام»، أو خطٌّ في الفهرس، وإلا (الغياب، أو قيمةٌ أسقطها إصدارٌ لاحق) الافتراضي.
  // fontNone: الخياران اللذان لا ملفَّ لهما (لا نسخة يكتبها العامل ولا «جارٍ تجهيز»)
  // ★ (ر5ب، القرار 71) و«خط النظام» خيارٌ معروض بنفسه (كان محجوزًا يُعرض «خط الموقع» في S6-B لأنه كان يُرسم كذلك)
  function fontSysOn() { return !!(C.FONT_SYSTEM && C.FONT_SYS); }
  function fontNone(v) { return v === C.FONT_SITE || (!!C.FONT_SYSTEM && v === C.FONT_SYSTEM); }
  function fontShown(v) {
    if (v === C.FONT_SITE) return C.FONT_SITE;
    if (C.FONT_SYSTEM && v === C.FONT_SYSTEM) return fontSysOn() ? C.FONT_SYSTEM : C.FONT_SITE;
    return fontEntry(v) ? v : (fontDefault() || {}).id;
  }
  function fontReady(d, e) {
    return !!(d && e && d.id === e.id && d.v === e.sha && typeof d.b64 === "string" && d.b64.length === Math.ceil(e.bytes / 3) * 4);
  }
  function fontErrOf(d, e) { return d && e && d.id === e.id && d.v === e.sha && d.err ? d.err : null; }
  // وجه المعاينة من الملف المحزوم بعنوانٍ نسبي (صفحة الإضافة لا تحتاج WAR)، بالواصفات نفسها التي تُبنى بها الأوجه في
  // المواقع ومعها مدى المحور وزنًا صريحًا (ن١٤) — فبدونه يُرسم العريض في المعاينة عاديًّا
  function loadPreview(e) {
    if (typeof FontFace !== "function" || !document.fonts) return;
    try {
      var d = CMLShared.fontFaceDesc(e, "ui");
      d.weight = e.wght[0] + " " + e.wght[1];
      var f = new FontFace("cml-prev-" + e.id, "url(" + e.file + ")", d);
      document.fonts.add(f);
      f.load().catch(function () {});
    } catch (x) {}
  }
  // ★ (ر5ب) معاينة «خط النظام»: أوجه local() نفسها التي تُبنى في المواقع، لكل نطاق وزنٍ وجهٌ (C.FONT_SYS)، فالعريض فيها عريضٌ حقًّا
  function loadPreviewSys() {
    if (typeof FontFace !== "function" || !document.fonts || !fontSysOn()) return;
    (C.FONT_SYS.bands || []).forEach(function (b) {
      try {
        var f = new FontFace("cml-prev-" + C.FONT_SYSTEM, C.fontSysSrc(b.w[0]), { weight: b.w[0] + " " + b.w[1], unicodeRange: C.FONT_AR_RANGE });
        document.fonts.add(f);
        f.load().catch(function () {});
      } catch (x) {}
    });
  }
  function buildFontList() {
    var box = $("fontList");
    if (!box || FONT.built) return;
    FONT.built = true;
    var def = fontDefault();
    var opts = (C.FONTS || []).map(function (e) {
      var isDef = !!def && e.id === def.id;
      // وسم الافتراضي والجملة الأولى من شرحه تتبعان C.FONT_DEFAULT (قاعدة ق١) بلا تعديلٍ يدوي
      return { id: e.id, name: e.family, entry: e, tag: isDef ? "تلقائي · الأكثر طلبًا" : "",
               why: (isDef ? "أكثر الخطوط العربية طلبًا في Google Fonts بفارقٍ واسع. " : "") + (e.why || "") };
    });
    // ★ (ر5ب) «خط النظام» قبل «خط الموقع كما هو» (DESIGN-fonts §٣.٢)، ومعاينته بأوجهه المحلية
    if (fontSysOn()) opts.push({ id: C.FONT_SYSTEM, name: "خط النظام", sys: true,
                                 why: "خطُّ جهازك العربي نفسه في كل المواقع، كما كانت الإضافة ترسمه قبل هذا الإصدار، ولا يُضاف ملفٌّ ولا يُجلب شيء." });
    opts.push({ id: C.FONT_SITE, name: "خط الموقع كما هو", site: true,
                why: "لا تضيف الإضافة خطًّا: تُرسم الحروف العربية بخطوط كل موقعٍ كما هي، فتختلف من موضعٍ إلى آخر، ويرسمها في مركزَي المساعدة والخصوصية خطُّ المتصفح القياسي." });
    opts.forEach(function (o) {
      var lab = document.createElement("label");
      lab.className = "engopt fontopt";
      var inp = document.createElement("input");
      inp.type = "radio"; inp.name = "font"; inp.id = "font_" + o.id; inp.value = o.id;
      inp.setAttribute("aria-describedby", "font_" + o.id + "Why");
      inp.addEventListener("change", function () { if (inp.checked) setFont(o.id); });
      var sp = document.createElement("span");
      var b = document.createElement("b");
      if (o.site || o.sys) b.textContent = o.name;
      else { var bd = document.createElement("bdi"); bd.dir = "ltr"; bd.textContent = o.name; b.appendChild(bd); }
      // (مسافةٌ قبل الوسم: بدونها يقرأ قارئ الشاشة الاسمَ والوسم كلمةً واحدة «Cairoتلقائي»)
      if (o.tag) { var tg = document.createElement("span"); tg.className = "tag mine"; tg.textContent = o.tag; b.appendChild(document.createTextNode(" ")); b.appendChild(tg); }
      // سطر المعاينة: واحدٌ لكل الخيارات لتصحّ الموازنة، والتسمية تكفي قارئ الشاشة (aria-hidden)
      var smp = document.createElement("span");
      smp.className = "fontsample"; smp.lang = "ar"; smp.setAttribute("aria-hidden", "true");
      // (ر5ب) و«خط النظام» كذلك: عائلة cml-prev-system من أوجهه المحلية (loadPreviewSys)
      if (!o.site) smp.style.fontFamily = "'cml-prev-" + o.id + "', 'Segoe UI', Tahoma, sans-serif";
      var sb = document.createElement("b");
      sb.textContent = (C.FONT_SAMPLE && C.FONT_SAMPLE.b) || "";
      smp.appendChild(sb);
      smp.appendChild(document.createTextNode((C.FONT_SAMPLE && C.FONT_SAMPLE.t) || ""));
      var why = document.createElement("span");
      why.className = "why"; why.id = "font_" + o.id + "Why"; why.textContent = o.why;
      sp.appendChild(b); sp.appendChild(smp); sp.appendChild(why);
      lab.appendChild(inp); lab.appendChild(sp);
      box.appendChild(lab);
      if (o.sys) loadPreviewSys();
      else if (!o.site) loadPreview(o.entry);
    });
    if ($("fontDefaultName") && def) $("fontDefaultName").textContent = def.family;
  }
  // سطر الحال: الرسائل العابرة بـflash، والدائمة (الانتظار والخطأ) تبقى حتى تتغيّر الحال
  function fontSay(msg, isErr, persist) {
    var el = $("fontStatus");
    if (!el) return;
    if (!persist) { flash(el, msg, !!isErr); return; }
    delete el.dataset.flashing;
    el.textContent = msg;
    el.classList.toggle("err", !!isErr);
  }
  function fontRetryShow(on) { show("fontRetryRow", on); }
  function fontErrText(err) {
    return err === "quota"
      ? "تعذّر حفظ نسخة الخط لأن تخزين الإضافة ممتلئ، ولم يُمسّ شيءٌ من تصحيحاتك. يمكنك تصدير التصحيحات وحذف ما لا تحتاجه، ثم «إعادة المحاولة»."
      : "تعذّر تجهيز ملف الخط من داخل الإضافة، ولم يتغيّر شيء. أعد المحاولة، أو أعد تحميل الإضافة من صفحة الإضافات.";
  }
  function fontEnsure(cb) {
    try {
      if (chrome.runtime && typeof chrome.runtime.sendMessage === "function") {
        chrome.runtime.sendMessage({ type: "font-ensure" }, function (r) { void chrome.runtime.lastError; if (cb) cb(r); });
        return;
      }
    } catch (e) {}
    if (cb) cb(null);
  }
  function renderFont() {
    chrome.storage.local.get([FONT_K, FONT_DK], function (s) {
      s = s || {};
      FONT.choice = s[FONT_K]; FONT.data = s[FONT_DK];
      var shown = fontShown(FONT.choice), inp = $("font_" + shown);
      if (inp && !inp.checked) inp.checked = true;
      var want = fontNone(shown) ? null : fontEntry(shown);
      var first = FONT.first;
      FONT.first = false;
      var p = FONT.pending;
      if (p && p !== want) { FONT.pending = p = null; }
      if (p) {
        var perr = fontErrOf(FONT.data, p);
        if (fontReady(FONT.data, p)) {
          FONT.pending = null;
          if (FONT.timer) { clearTimeout(FONT.timer); FONT.timer = null; }
          fontRetryShow(false);
          fontSay("جُهِّز خط «" + p.family + "»، ويُطبَّق على تبويبات المواقع المفتوحة دون إعادة تحميل.");
          scheduleFontReach(700);
        } else if (perr) {
          FONT.pending = null;
          if (FONT.timer) { clearTimeout(FONT.timer); FONT.timer = null; }
          fontSay(fontErrText(perr), true, true);
          fontRetryShow(true);
        }
        return;
      }
      var err = fontErrOf(FONT.data, want);
      if (err) { fontSay(fontErrText(err), true, true); fontRetryShow(true); return; }
      fontRetryShow(false);
      var st = $("fontStatus");
      // خطأٌ سابق زال (أصلحه عامل الخدمة): يُمحى سطره الدائم
      if (st && !st.dataset.flashing && st.classList.contains("err") && (!want || fontReady(FONT.data, want))) fontSay("", false, true);
      // قيمةٌ محفوظة لم تعد في الفهرس (إصدارٌ لاحق أسقط خطها): يُستعمل الافتراضي ويُقال ذلك — ويُمحى السطر الدائم إذا
      // زال سببه بتغيّر القيمة من غير هذه البطاقة (تبويبٌ آخر أو إعادة الضبط)، فلا يبقى قولٌ لم يعد صادقًا
      var DROPPED = "الخط الذي اخترته لم يعد متاحًا، فاستُعمل الافتراضي.";
      if (FONT.choice !== undefined && !fontNone(FONT.choice) && !fontEntry(FONT.choice)) fontSay(DROPPED, false, true);
      else if (st && !st.dataset.flashing && st.textContent === DROPPED) fontSay("", false, true);
      // أول فتحٍ للصفحة ونسخةٌ غائبة أو ناقصة: يُطلب إصلاحها بصمت (العامل لا يكتب ما لا يلزم)
      if (first && want && !fontReady(FONT.data, want)) fontEnsure();
    });
  }
  function setFont(id) {
    if (FONT.timer) { clearTimeout(FONT.timer); FONT.timer = null; }
    FONT.pending = null;
    fontRetryShow(false);
    var after = function () {
      var e = chrome.runtime && chrome.runtime.lastError;
      if (e) { FONT.pending = null; fontSay("تعذّر الحفظ.", true, true); renderFont(); return; }
      if (id === C.FONT_SITE) { fontSay("حُفظ: عادت الحروف العربية إلى خطوط الموقع."); scheduleFontReach(700); }
      // ★ (ر5ب) «خط النظام» بلا ملف: يُطبَّق على التبويبات المفتوحة فور الحفظ
      if (id === C.FONT_SYSTEM) { fontSay("حُفظ: تُرسم الحروف العربية الآن بخط جهازك."); scheduleFontReach(700); }
      renderFont();
    };
    if (fontNone(id)) { var o = {}; o[FONT_K] = id; chrome.storage.local.set(o, after); return; }
    var entry = fontEntry(id);
    if (!entry) return;
    FONT.pending = entry;
    fontSay("جارٍ تجهيز الخط…", false, true);
    FONT.timer = setTimeout(function () {
      FONT.timer = null;
      if (FONT.pending === entry) fontSay("لم يُجهَّز الخط بعد؛ سيُطبَّق حين يجهز.", false, true);
    }, 5000);
    if (id === (fontDefault() || {}).id) chrome.storage.local.remove(FONT_K, after);
    else { var w = {}; w[FONT_K] = id; chrome.storage.local.set(w, after); }
  }
  function fontRetry() {
    var want = fontEntry(fontShown(FONT.choice));
    if (!want) return;
    fontRetryShow(false);
    FONT.pending = want;
    fontSay("جارٍ تجهيز الخط…", false, true);
    fontEnsure(function () { renderFont(); });
  }
  // سطور الحال لكل موقعٍ مفتوح (م٨ «لا إخفاء صامت»): التبويبات تُسأل برسالة cml-hello الموجودة — بلا إذنٍ جديد،
  // والمعرّفات وحدها تكفي ولا يجيب إلا تبويبٌ فيه الإضافة. ولكل موقعٍ أسوأ حالِ تبويباته
  var REACH_RANK = { err: 4, none: 3, ok: 2, off: 1 };
  function reachLine(d, r) {
    var n = qn(d);
    return r === "ok" ? n + ": الخط مطبَّق."
      : r === "none" ? n + ": لم يجد الخطُّ خطوطَ الموقع المعروفة، فبقيت العربية بخط الموقع. (يحدث إن غيّر الموقع أسماء خطوطه أو قواعده؛ وتُصلحه نسخةٌ لاحقة من الإضافة.)"
      : r === "off" ? n + ": الخط لا يعمل هنا الآن (التعريب أو الموقع متوقّف، أو اختيارك «خط الموقع كما هو»)."
      : n + ": تعذّر تحميل الخط في هذه الصفحة؛ أعد تحميلها.";
  }
  function drawFontReach(per) {
    var ul = $("fontReach");
    if (!ul) return;
    ul.textContent = "";
    ALL_IDS.forEach(function (d) {
      var r = per[d];
      if (!REACH_RANK[r]) return;
      var li = document.createElement("li");
      li.id = "fontReach_" + d;
      li.className = r === "err" || r === "none" ? "bad" : "";
      li.textContent = reachLine(d, r);
      ul.appendChild(li);
    });
  }
  function renderFontReach() {
    var T = chrome.tabs, gen = ++FONT.reachGen;
    if (!T || typeof T.query !== "function" || typeof T.sendMessage !== "function") { drawFontReach({}); return; }
    try {
      T.query({}, function (tabs) {
        void chrome.runtime.lastError;
        tabs = (tabs || []).filter(function (t) { return t && typeof t.id === "number"; });
        var per = {}, left = tabs.length;
        var done = function () { if (gen === FONT.reachGen) drawFontReach(per); };
        if (!left) { done(); return; }
        tabs.forEach(function (t) {
          var one = function (res) {
            void chrome.runtime.lastError;
            var r = res && res.domain && res.font && res.font.reach;
            if (r && REACH_RANK[r] && (!per[res.domain] || REACH_RANK[r] > REACH_RANK[per[res.domain]])) per[res.domain] = r;
            if (--left === 0) done();
          };
          try { T.sendMessage(t.id, { type: "cml-hello" }, { frameId: 0 }, one); } catch (e) { one(null); }
        });
      });
    } catch (e) { drawFontReach({}); }
  }
  function scheduleFontReach(ms) {
    if (FONT.reachTimer) clearTimeout(FONT.reachTimer);
    FONT.reachTimer = setTimeout(function () { FONT.reachTimer = null; renderFontReach(); }, ms || 0);
  }

  // ---------- التحميل والربط ----------
  // loadState: قراءةٌ ورسم — ولا مستمع يُضاف هنا أبدًا (ل٦: كانت تضيف مستمعًا عند كل تبديل)
  function loadState() {
    readRun(renderRun);
    renderTerms();
    renderBlocks();
    renderScanSection();
    renderRtlDocSection();
    renderRtlLive();
    loadRtlEngine();
    renderRecon();   // مراجعة ما بعد التحديث: تظهر وحدها متى كان ثمة ما يُراجَع
    renderStats();
    renderSync();    // قسم المزامنة الاختيارية: حالته من cml_sync_enabled/cml_sync_state
    renderFont();    // الخط العربي: الخيار المحفوظ وحال نسخته
  }

  function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }
  function wire() {
    on("enabled", "change", function () { chrome.storage.local.set({ cml_enabled: $("enabled").checked }); });
    on("enableAllSites", "click", function () {
      // الشريط يختفي مع زرّه متى فُعّلت المواقع: التركيز إلى مفتاح أول موقعٍ قبل ذلك — وإلا سقط إلى
      // body وعاد مستعمل لوحة المفاتيح وقارئ الشاشة إلى رأس الصفحة. ورسالة النجاح في منطقةٍ حيّة
      var first = $("siteOn_" + ALL_IDS[0]) || $("enabled");
      if (first) { try { first.focus(); } catch (e) {} }
      chrome.storage.local.remove(ALL_IDS.map(siteKey), function () {
        void chrome.runtime.lastError;
        flash($("sitesStatus"), "فُعّلت المواقع كلها.", false);
      });
    });
    on("welcomeDismiss", "click", function () {
      var o = {}; o[WELCOME_K] = 1;
      chrome.storage.local.set(o, function () { void chrome.runtime.lastError; renderWelcome(); });
    });
    // «اختيار الخط» في الترحيب: إلى بطاقة الخط، والتركيز على الخيار المختار
    on("welcomeFontBtn", "click", function () {
      var sec = $("fontSection");
      if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: "start" });
      var cur = document.querySelector('#fontList input[name="font"]:checked') || document.querySelector('#fontList input[name="font"]');
      if (cur) { try { cur.focus(); } catch (e) {} }
    });
    on("fontRetry", "click", fontRetry);
    on("rtl", "change", function () { chrome.storage.local.set({ cml_rtl: $("rtl").checked }); });
    on("chatrtl", "change", function () { chrome.storage.local.set({ cml_chatrtl: $("chatrtl").checked }); });

    on("addTerm", "click", addTerm);
    on("termSearch", "input", renderTerms);
    on("exportOv", "click", exportMyTerms);
    on("reconDropSame", "click", reconDropSame);
    on("reconShowDiff", "click", function () {
      $("termFilter").value = "diverged";
      renderTerms();
      $("termsList").scrollIntoView({ block: "nearest" });
    });
    on("reconDismiss", "click", reconDismiss);
    on("exportSrcBare", "click", function () { exportSource(true); });
    on("exportSrcFull", "click", function () { exportSource(false); });
    on("termFilter", "change", renderTerms);
    on("clearAllOv", "click", clearAllOv);

    on("startScan", "click", function () { startJob("scan", scopeIds()); });
    on("cancelScan", "click", stopScan);

    // قسم الاتجاه — ومستمع «إعادة الضبط من الموقع» هنا مرةً واحدة (ل٦)
    on("rtlEngineV2", "change", function () { if ($("rtlEngineV2").checked) setRtlEngine("v2"); });
    on("rtlEngineV1", "change", function () { if ($("rtlEngineV1").checked) setRtlEngine("v1"); });
    on("rtlLiveRebuild", "click", rtlLiveRebuild);
    on("startRtlDoc", "click", function () { startJob("rtldoc", scopeIds()); });
    on("rtlDocExport", "click", exportRtlDoc);

    on("syncEnableBtn", "click", function () { var c = $("syncConsent"); if (c) c.classList.remove("hidden"); });
    on("syncCancel", "click", function () { var c = $("syncConsent"); if (c) c.classList.add("hidden"); });
    on("syncConfirm", "click", syncConfirm);
    on("syncDisableBtn", "click", syncDisable);
    on("syncWipeBtn", "click", syncWipe);

    on("scanExport", "click", exportScan);
    on("scanImportBtn", "click", function () { $("importTransFile").click(); });
    on("importTransFile", "change", function (e) {
      // الحال بجوار زرّ الاستيراد (والقشور بلا هذا السطر: سطر القاموس)
      if (e.target.files && e.target.files[0]) importTermsFile(e.target.files[0], $("xferStatus") || $("termsStatus"));
      e.target.value = "";
    });
    on("resetAll", "click", resetAll);
    on("resetSite", "click", resetSite);
    on("resetSiteSel", "change", renderResetBtn);
    on("blkSearch", "input", renderBlocks);

    // تحديث حي: أي تغيير في التخزين (من المحرك أو النافذة المنبثقة أو تبويب آخر) ينعكس هنا فورًا.
    // حارس التركيز: لا نعيد بناء قائمة والمستخدم يكتب داخلها — نؤجل الرسم إلى خروج التركيز منها.
    var pendingRender = {};
    function focusInside(id) {
      var el = document.activeElement;
      return !!(el && el.closest && el.closest("#" + id));
    }
    function renderOrDefer(id, fn) {
      if (focusInside(id)) { pendingRender[id] = fn; return; }
      fn();
    }
    document.addEventListener("focusout", function () {
      setTimeout(function () {
        Object.keys(pendingRender).forEach(function (id) {
          if (!focusInside(id)) { var fn = pendingRender[id]; delete pendingRender[id]; fn(); }
        });
      }, 50); // بعد انتقال التركيز الفعلي
    });
    try {
      chrome.storage.onChanged.addListener(function (ch, area) {
        // مساحةُ المزامنة خاصةٌ بهذه الإضافة وحدها: دفعةُ جهازٍ آخر أو مسحٌ جرى هناك ⇒ حالُ الزرّ هنا فورًا
        if (area === "sync") { renderSync(); return; }
        if (area !== "local") return;
        var keys = Object.keys(ch);
        function hit(base, scoped) {
          var ids = scoped ? scopeIds() : ALL_IDS;
          return ids.some(function (d) { return ch[physFor(d, base)] !== undefined; });
        }
        // (ج٢) التشغيل والاتجاه ومفاتيح المواقع والمحرّك: تحديثٌ في الموضع بلا loadState
        var runHit = keys.some(function (k) {
          return k === "cml_enabled" || k === "cml_rtl" || k === "cml_chatrtl" || k === C.K.RTL_ENGINE ||
            k.indexOf(SITE + ".") === 0 || k.indexOf(ENG_SITE + ".") === 0;
        });
        if (runHit) readRun(function () { renderRun(); if (JOB.scan || JOB.rtldoc) return; renderScanSection(); });
        if (ch[C.K.RTL_ENGINE]) loadRtlEngine();
        if (hit("cml_overrides", true) || hit("cml_user_patterns", true)) {
          renderOrDefer("termsList", renderTerms); renderStats(); renderRecon();
        }
        if (hit("cml_recon_dismissed", true)) renderRecon();
        if (hit(C.K.SCAN_RESULT, false)) { renderScanSection(); renderStats(); }
        if (hit(C.K.RTLDOC_RESULT, false)) renderRtlDocSection();
        if (hit(C.K.RTL_LIVE, false)) renderRtlLive();
        if (hit(C.K.BAD_RULES, true)) renderStats();
        if (hit("cml_block_ov", true)) { renderBlocks(); renderStats(); }
        var domSync = keys.some(function (k) { return k.indexOf(C.K.SYNC_STATE + ".") === 0 || k.indexOf("cml_bsync_state") === 0; });
        if (ch[C.K.SYNC_ENABLED] || ch[C.K.SYNC_STATE] || domSync) renderSync();
        // الخط العربي (عامّان خارج SCOPED): الخيار ونسخته — في الموضع بلا هدم القائمة، فلا يسقط التركيز؛ وحالُ
        // التبويبات بعد لحظةٍ يطبّقون فيها النسخة الجديدة
        if (ch[FONT_K] || ch[FONT_DK]) { renderFont(); scheduleFontReach(700); }
        if (runHit) scheduleFontReach(700);
      });
    } catch (e) {}
    try {
      if (chrome.permissions && chrome.permissions.onAdded) chrome.permissions.onAdded.addListener(checkAccess);
      if (chrome.permissions && chrome.permissions.onRemoved) chrome.permissions.onRemoved.addListener(checkAccess);
    } catch (e) {}
  }

  fillAbout(); fillEngineWhy(); buildSites(); buildRtlSites(); buildScanRows(); buildFontList(); initDomainBar(); renderCaps();
  wire(); loadState(); checkAccess(); initFfPermBox(); renderWelcome(); renderFontReach();
})();
