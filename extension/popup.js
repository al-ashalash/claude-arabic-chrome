/* popup.js — the extension menu. Wires the controls to chrome.storage.local; the
   content script (engine.js) reacts live. languages.json is read only to normalise
   the stored language (cml_lang) — there is no language picker (ر8-د، N1). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var enabled = $("enabled");
  var src = $("src"), dst = $("dst"), saveBtn = $("save"), status = $("status");
  var rtlToggle = $("rtl");
  var chatrtlToggle = $("chatrtl");
  var current = "ar";
  // نطاق التبويب الحالي: يُسأل سكربتُ المحتوى نفسه في الإطار الأعلى (قرار المالك ق١ —
  // بلا إذن tabs)؛ وتبويبٌ لا يجيب إمّا خارج المواقع أو مفتوحٌ قبل تحديث الإضافة
  var tabDomain = null;
  var SITE = (CMLConst.K && CMLConst.K.SITE_ON) || "cml_site";
  var ALL_IDS = CMLConst.DOMAINS.map(function (d) { return d.id; });
  // ★ المفتاح الرئيس بوّابة (كصفحة الإعدادات): مفتاح التبويب يُعرض بحاله الفعلية (master && site)
  // ومعطَّلًا عند إطفاء الرئيس، واختيارُ الموقع محفوظ؛ والتجميع المعاكس: المواقع كلها مطفأة ⇒ سطرٌ يقوله
  var RUN = { master: true, site: {} };
  function readRun(cb) {
    chrome.storage.local.get(["cml_enabled"].concat(ALL_IDS.map(function (d) { return SITE + "." + d; })), function (s) {
      s = s || {};
      RUN.master = s.cml_enabled !== false;
      ALL_IDS.forEach(function (d) { RUN.site[d] = s[SITE + "." + d] !== false; });
      cb();
    });
  }
  // ★ النافذة تحت سقف كروم (600 بكسل): سطرُ البوابة سطرٌ واحد، وحين يظهر يأخذ مكان ملاحظة التبويب
  // والتلميح السفلي معًا (كلاهما أقلّ شأنًا والتعريب موقوف) — فلا تزيد النافذة بظهوره. قِيس في
  // _optionstest: تبويب التطبيق وتبويب مقالة، والرئيس مطفأ، كلاهما دون 600.
  // وسطرُ حال الخط (DESIGN-fonts §٣.٥) يأخذ مكان التلميح السفلي كذلك: النافذة على السقف تمامًا بدونه (قِيس في _optionstest)
  var tabNoteText = "", fontNoteText = "";
  // ★ (ر6-د، ٣٠ ربيع الآخر ١٤٤٨هـ — القرار 84) سطرُ الصفحة التي حجب حارسُ المتن متنها، بسببه من جواب التبويب (bodies.guard.why، والسمة
  // data-cml-held): "drift" تغيّر متنها في الموقع بعد ترجمتها، و"none" لا ترجمة لمتنها في هذا الإصدار. وسببٌ غائبٌ (محرّكٌ أقدم) على الأول
  // كما كان. يُقال في ملاحظة التبويب، وفي صندوق تصحيح الفقرة إن طُلب فيها تصحيح
  var HELD_NOTE = {
    drift: "تغيّر متن هذه الصفحة في الموقع بعد ترجمتها، فيبقى إنجليزيًّا كلُّه حتى تُحدَّث ترجمته.",
    none: "لم يُعرَّب متن هذه الصفحة في هذا الإصدار، فيبقى إنجليزيًّا كلُّه."
  };
  function heldNote(why) { return why === "none" ? HELD_NOTE.none : HELD_NOTE.drift; }
  // ★ (ر7-ب، ٣٠ ربيع الآخر ١٤٤٨هـ — الفحص الحيّ ر7، L7) سطرا حال المحرّك في التبويب — حجبُ المتن (tabNoteLive) والخط — من جوابه لحظةَ فتح
  // النافذة: كانا يبقيان بعد إطفاء «هذا التبويب» حتى تُفتح النافذة من جديد، والمحرّك قد خمد في الموقع فلا حجب ولا خط. فيسقطان ما دام الموقع
  // مطفأً (من النافذة نفسها أو من الإعدادات بالتحديث الحيّ) ويعودان بإعادة تشغيله، فالصفحة هي هي. وسطرا الخمول (مسارٌ خارج النطاق، ولغة الموقع)
  // يصفان الصفحة لا المحرّك فيبقيان
  var tabNoteLive = false;
  function tabOn() { return !!tabDomain && RUN.master && RUN.site[tabDomain] !== false; }
  function renderNotes() {
    var gate = $("gateNote"), note = $("tabNote"), foot = $("footHint"), fn = $("fontNote");
    var g = gate && gate.textContent, on = tabOn();
    var tn = tabNoteLive && !on ? "" : tabNoteText, fnt = on ? fontNoteText : "";
    if (note) { note.textContent = tn; note.classList.toggle("hidden", !!g || !tn); }
    if (fn) { fn.textContent = fnt; fn.classList.toggle("hidden", !!g || !fnt); }
    if (foot) foot.classList.toggle("hidden", !!g || !!tn || !!fnt);
  }
  function renderGate() {
    enabled.checked = RUN.master;
    var inp = $("siteOn"), note = $("gateNote");
    if (tabDomain) {
      inp.checked = RUN.master ? RUN.site[tabDomain] !== false : false;
      inp.disabled = !RUN.master;
    }
    var allOff = ALL_IDS.every(function (d) { return RUN.site[d] === false; });
    var t = !RUN.master ? "التعريب متوقّف في المواقع كلها، واختيارُ كل موقعٍ محفوظ."
      : allOff ? "لا موقع مفعّل: المواقع كلها متوقّفة." : "";
    if (note) { note.textContent = t; note.classList.toggle("hidden", !t); }
    renderNotes();
  }
  function detectTab(cb) {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var t = tabs && tabs[0];
        if (!t || typeof t.id !== "number") { cb(null, null); return; }
        chrome.tabs.sendMessage(t.id, { type: "cml-hello" }, { frameId: 0 }, function (res) {
          var err = chrome.runtime.lastError;
          if (!err && res && res.domain) { cb(res, t); return; }
          cb(null, t);
        });
      });
    } catch (e) { cb(null, null); }
  }
  function renderTab() {
    var lab = $("tabLabel"), sw = $("siteSwitch");
    detectTab(function (hello, tab) {
      var guess = tab && tab.url ? CMLConst.domainOfUrl(tab.url) : null;
      var d = hello ? CMLConst.domain(hello.domain) : null;
      tabDomain = d ? d.id : null;
      if (d) {
        lab.textContent = "هذا التبويب: " + d.name;
        sw.classList.remove("hidden");
        readRun(renderGate);
        // المسار من جدول النطاقات لا اسمٌ مكتوب («الوثائق»): يصدق في كل موقعٍ له حارس مسار. وبمقطع اللغة كما هو
        // (code.claude.com/docs/en/): عنوانُ الموقع المختصر بلا /en/ كان يصف الصفحة نفسها في /docs/<locale>/ (مراجعة القيود ٧)
        // ★ (ر4، ٢٨ ربيع الآخر ١٤٤٨هـ) وعنوانٌ صريح في الجدول (meta.siteLabel) يسبق أول بادئة: بادئات الأكاديمية كثيرة، وأولاها («‎/all/‎»)
        // كانت تقول «تعمل في academy.claude.com/all/ وحدها» في صفحة لغةٍ أخرى من الموقع
        var lbl = d.meta && d.meta.siteLabel;
        var rt = d.meta && d.meta.routes, scope = lbl ? lbl : rt && rt.full && rt.full[0] ? d.host + rt.full[0] : CMLConst.siteLabel(d.id);
        // ★ (ر3، ٢٨ ربيع الآخر ١٤٤٨هـ) نطاقٌ مساراته صفحاتٌ بأعيانها لا بادئات (الوثائق القانونية الخمس): «تعمل في …/legal وحدها» كانت
        // تُقال في صفحةٍ تحت ‎/legal‎ نفسه (وثيقةٌ أخرى أو الأرشيف) فتُناقض نفسها. (ر4) ومثله عنوانٌ صريح هو المضيف كلّه وحارسُ المسار
        // يحصر العمل في بعض صفحاته
        var only = (lbl && rt) || (rt && !(rt.full && rt.full.length) && rt.exact && rt.exact.length) ? "صفحاتٍ بعينها من " : "";
        tabNoteText = hello.route === "inactive"
          ? "هذه الصفحة خارج ما تُعرّبه الإضافة من «" + d.name + "»: تعمل في " + only + "\u2066" + scope + "\u2069 وحدها." : "";
        // ★ (حارس لغة الموقع، ١٦ ربيع الآخر ١٤٤٨هـ) الموقع بلغةٍ غير الإنجليزية (إعداد الحساب): الإضافة خاملة فيه — سببٌ وعلاج
        // ★ (ر3) والحكم من منتقي اللغة في الصفحة (siteLangBy "sel"، الوثائق القانونية): العلاج في الصفحة نفسها لا في الإعدادات
        // ★ (ر5، ٢٩ ربيع الآخر ١٤٤٨هـ — مراجعة ر4-أ L6) وعلاجٌ خاصٌّ بالموقع من جدول النطاقات (meta.siteLangHow): الأكاديمية تُختار لغتها
        // من منتقي التذييل لا من إعدادات الحساب؛ وما لا علاج له في الجدول على الجملة العامة كما كانت حرفًا
        var how = d.meta && typeof d.meta.siteLangHow === "string" && d.meta.siteLangHow ? d.meta.siteLangHow : "اجعلها English من إعداداتها";
        if (hello.siteLang) tabNoteText = hello.siteLangBy === "sel"
          ? "الوثيقة معروضةٌ بلغةٍ غير الإنجليزية من منتقي اللغة في الصفحة — اختر منه English لتعمل الإضافة."
          : "واجهة \u2066" + d.host + "\u2069 بلغةٍ غير الإنجليزية — " + how + " لتعمل الإضافة.";
        // ★ (ر6-د — القرار 84) متن الصفحة محجوب والإضافة عاملةٌ فيها (مسارٌ كامل): سطرٌ بسببه. ولا يجتمع مع السطرين قبله (كلاهما خمول)
        var gd = hello.bodies && hello.bodies.guard;
        tabNoteLive = !!(hello.enabled !== false && hello.route === "full" && gd && gd.held);
        if (tabNoteLive) tabNoteText = heldNote(gd.why);
      } else {
        lab.textContent = "هذا التبويب";
        sw.classList.add("hidden");
        tabNoteLive = false;
        readRun(renderGate); // سطر البوابة يُقال في كل تبويب (الرئيس مطفأ، أو المواقع كلها مطفأة)
        // بلا إذن tabs لا يُعرف عنوان التبويب غالبًا، فالجملة تقول الاحتمالين بصدق
        tabNoteText = guess
          ? "هذا تبويب «" + guess.name + "» لكنه فُتح قبل تحديث الإضافة — حدّثه (Ctrl+Shift+R) ليُعرَّب."
          : "هذه الصفحة ليست من مواقع Claude التي تُعرّبها الإضافة — أو فُتحت قبل تحديثها، فحدّثها (Ctrl+Shift+R) إن كانت منها.";
      }
      // ★ (DESIGN-fonts §٣.٥) سطر حال الخط من ردّ cml-hello نفسه: مطبَّق، أو لم يجد خطوط الموقع، أو تعذّر — ولا شيء
      // مع «خط الموقع كما هو» ولا والإضافة خاملة (للخمول سطره الموجود)
      var fr = hello && hello.enabled !== false && hello.font ? hello.font.reach : null;
      fontNoteText = fr === "ok" ? "الخط: مطبَّق" : fr === "none" ? "الخط: لم يجد خطوط هذا الموقع"
        : fr === "err" ? "الخط: تعذّر تحميله؛ أعد تحميل الصفحة" : "";
      renderNotes();
      // اتجاه المحادثة لموقعٍ له محادثات (مصفوفة القدرات)، لا لمعرّفٍ مكتوب
      var caps = d && CMLConst.caps ? CMLConst.caps(d.id) : null;
      $("chatRow").classList.toggle("hidden", !!caps && !caps.chat.on);
      saveBtn.disabled = !tabDomain;
      // تصحيح الفقرات: في صفحات المتون وحدها (مسارٌ كامل في نطاقٍ ذي متون)
      $("blkBox").classList.toggle("hidden", !(hello && hello.bodies && hello.route === "full"));
      blkTab = tab;
    });
  }

  // ★ (ر8-د، ١ جمادى الأولى ١٤٤٨هـ — N1) لا مُنتقي لغة: الإضافة عربيةٌ وحدها. ويبقى تطبيعُ اللغة المخزَّنة كما كان حرفًا (current لسطري
  // التصحيح، وcml_lang للمحرّك): رمزٌ لا يعرفه languages.json يُردّ إلى الافتراضي ويُكتب، فلا يتغيّر سلوك الترجمة
  function load() {
    fetch(chrome.runtime.getURL("languages.json"))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var LANGS = data.languages || [];
        chrome.storage.local.get(["cml_lang", "cml_enabled", "cml_rtl", "cml_chatrtl"], function (s) {
          current = s.cml_lang || data.default || (LANGS[0] && LANGS[0].code) || "ar";
          // رمزٌ مخزَّن لا يعرفه languages.json كان يحوّل الحفظ إلى دلوٍ ميت ويُصمت الترجمة كلها
          if (!LANGS.some(function (l) { return l.code === current; })) {
            current = data.default || (LANGS[0] && LANGS[0].code) || "ar";
            chrome.storage.local.set({ cml_lang: current }, function () { void chrome.runtime.lastError; });
          }
          RUN.master = s.cml_enabled !== false;
          enabled.checked = RUN.master;
          if (rtlToggle) rtlToggle.checked = s.cml_rtl !== false;
          if (chatrtlToggle) chatrtlToggle.checked = s.cml_chatrtl !== false;
        });
      })
      .catch(function () { status.textContent = "تعذّر تحميل إعدادات الإضافة؛ أعد فتح هذه النافذة."; });
  }

  enabled.addEventListener("change", function () {
    chrome.storage.local.set({ cml_enabled: enabled.checked });
  });
  // تحديثٌ حيّ: ما غيّرته صفحة الإعدادات أو تبويبٌ آخر ينعكس هنا فورًا
  try {
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area !== "local") return;
      var runHit = Object.keys(ch).some(function (k) { return k === "cml_enabled" || k.indexOf(SITE + ".") === 0; });
      if (runHit) readRun(renderGate);
      if (ch.cml_rtl && rtlToggle) rtlToggle.checked = ch.cml_rtl.newValue !== false;
      if (ch.cml_chatrtl && chatrtlToggle) chatrtlToggle.checked = ch.cml_chatrtl.newValue !== false;
    });
  } catch (e) {}
  $("siteOn").addEventListener("change", function () {
    if (!tabDomain) return;
    var k = SITE + "." + tabDomain;
    // ★ (ر7-ب، L7) السطران من حال المفتاح فورًا، لا بعد ارتداد التخزين وحده (onChanged يعيده بالقيمة نفسها)
    RUN.site[tabDomain] = $("siteOn").checked;
    renderNotes();
    if ($("siteOn").checked) chrome.storage.local.remove(k, function () { void chrome.runtime.lastError; });
    else { var o = {}; o[k] = false; chrome.storage.local.set(o, function () { void chrome.runtime.lastError; }); }
  });
  if (rtlToggle) rtlToggle.addEventListener("change", function () {
    chrome.storage.local.set({ cml_rtl: rtlToggle.checked });
  });
  if (chatrtlToggle) chatrtlToggle.addEventListener("change", function () {
    chrome.storage.local.set({ cml_chatrtl: chatrtlToggle.checked });
  });
  saveBtn.addEventListener("click", function () {
    var a = (src.value || "").trim(), b = (dst.value || "").trim();
    if (!a || !b) { status.textContent = "املأ الحقلين."; return; }
    if (!tabDomain) { status.textContent = "افتح صفحةً من مواقع Claude أولًا."; return; }
    var max = CMLConst.TEXT_MAX || 300;
    if (a.length > max || b.length > max * 2) { status.textContent = "أطول من الحدّ (" + chars(max) + " للنص، و" + chars(max * 2) + " للترجمة) — لا يُطبَّق."; return; }
    // التصحيح لنطاق التبويب وحده، أمرًا جزئيًّا يطبّقه العامل تحت قفل المزامنة (كالخيارات)؛
    // والنصُّ بمتغيّرات قاعدةٌ ذكية لا مطابقةٌ حرفية لن تصادف المعروض أبدًا
    var op = /\{[A-Za-z_$][\w$]*\}/.test(a) ? { op: "rule", en: a, ar: b } : { op: "set", k: a, v: b };
    chrome.runtime.sendMessage({ type: "terms-edit", d: tabDomain, lang: current, ops: [op] }, function (res) {
      var bad = chrome.runtime.lastError || !res || res.error || !res.report ||
                (res.report.set + res.report.rule) === 0;
      if (bad) { status.textContent = op.op === "rule" ? "تعذّر الحفظ — تأكّد من نسخ كل {متغيّر} كما هو." : "تعذّر الحفظ."; return; } // لا نجاحَ معلَنًا بعد كتابةٍ فاشلة
      status.textContent = "تم الحفظ ✓";
      src.value = ""; dst.value = "";
      setTimeout(function () { status.textContent = ""; }, 2500);
    });
  });

  // ---------- تصحيح فقرة (المرحلة ٢) ----------
  var blkTab = null, blkCur = null, blkStatus = $("blkStatus");
  function blkMsg(t) {
    blkStatus.textContent = t;
    if (t) try { blkStatus.scrollIntoView({ block: "nearest" }); } catch (e) {}
  }
  // ★ في حقلٍ من اليمين تُرسم «<» و«>» معكوسةً بين نصّين عربيين فيبدو الإغلاق </a1> ذاتيًّا <a1/> والعكس:
  // يُعرض كل رمزٍ معزولًا من اليسار (LRI…PDI) ويُنزع العزل قبل أي فحصٍ أو حفظ (القوالب المخزَّنة بلا عزل)
  var LRI = String.fromCharCode(0x2066), PDI = String.fromCharCode(0x2069);
  // ★ (ر8-د2) عدد الحروف بمعدوده (قاعدة arCount في صفحة الإعدادات): «300 حرف»، و«11 حرفًا»، و«5 أحرف»
  function chars(n) {
    var m = n % 100, s = n.toLocaleString("en");
    return n === 1 ? "حرف واحد" : n === 2 ? "حرفان" : m >= 3 && m <= 10 ? s + " أحرف" : m >= 11 && m <= 99 ? s + " حرفًا" : s + " حرف";
  }
  var PH_ANY = /<c(\d{1,4})>[\s\S]*?<\/c\1>|<\/?[abisgc]\d{1,4}\/?>/g;
  var ISO_RE = new RegExp("[" + String.fromCharCode(0x2066) + "-" + String.fromCharCode(0x2069) + "]", "g");
  function isoTokens(s) { return String(s || "").replace(PH_ANY, function (t) { return LRI + t + PDI; }); }
  function unIso(s) { return String(s || "").replace(ISO_RE, ""); }
  $("blkGet").addEventListener("click", function () {
    blkMsg(""); $("blkEdit").classList.add("hidden"); blkCur = null;
    if (!blkTab || typeof blkTab.id !== "number") { blkMsg("افتح مقالةً من مواقع Claude أولًا."); return; }
    chrome.tabs.sendMessage(blkTab.id, { type: "cml-block-at" }, { frameId: 0 }, function (res) {
      if (chrome.runtime.lastError || !res) { blkMsg("لم تُجب الصفحة — حدّثها (Ctrl+Shift+R) ثم أعد المحاولة."); return; }
      if (res.error) {
        // ★ (ر6-د) «التعليمات البرمجية» لا «الشيفرة» في النص الظاهر (دليل الأسلوب §13)
        blkMsg(res.error === "nosel" ? "لم يُحدَّد نصٌّ من متن المقالة — حدّد كلمةً من الفقرة ثم أعد المحاولة."
          : res.error === "code" ? "هذه تعليماتٌ برمجية، وتبقى كما هي."
          : res.error === "noblock" ? "لا نصَّ يُترجم في هذا الموضع."
          // ★ (ر6-ب) حارس المتن المختلط حجب متن الصفحة. ★ (ر6-د) والسطر بسببه: تغيّر المتن، أو لا ترجمة له في هذا الإصدار
          : res.error === "held" ? heldNote(res.why)
          : "التعريب متوقّف في هذه الصفحة.");
        return;
      }
      if (res.ui) {
        // عنوانٌ أو بندٌ من قاموس الواجهة: يُصحَّح بالنموذج العادي أعلاه
        src.value = res.en; dst.value = res.ar || ""; dst.focus();
        blkMsg("هذا نصٌّ من قاموس الواجهة — عدّله في «إضافة أو تصحيح ترجمة» أعلاه ثم احفظ.");
        return;
      }
      blkCur = res;
      $("blkSrc").textContent = res.src;
      $("blkAr").value = isoTokens(res.ar || "");
      $("blkAr").placeholder = res.ar ? "" : "لا ترجمة لهذه الفقرة بعد — اكتبها هنا بالرموز نفسها";
      $("blkDel").classList.toggle("hidden", !res.mine);
      $("blkEdit").classList.remove("hidden");
      $("blkAr").focus();
    });
  });
  function blkEdit(ops, okMsg) {
    if (!tabDomain || !blkCur) return;
    chrome.runtime.sendMessage({ type: "terms-edit", d: tabDomain, blocks: true, lang: current, ops: ops }, function (res) {
      var r = !chrome.runtime.lastError && res && !res.error && res.report;
      if (!r || (r.set + r.del) === 0) { blkMsg("تعذّر الحفظ."); return; }
      blkMsg(okMsg);
      // الحال بعد الكتابة: ما يظهر الآن وهل التصحيح للمستخدم (فالتراجع بعد حفظٍ أو حذفٍ ممكن)
      if (ops[0].op === "set") { blkCur.ar = ops[0].v; blkCur.mine = true; }
      else { blkCur.ar = blkCur.shipped || null; blkCur.mine = false; $("blkAr").value = isoTokens(blkCur.ar || ""); }
      $("blkDel").classList.toggle("hidden", !blkCur.mine);
    });
  }
  $("blkSave").addEventListener("click", function () {
    if (!blkCur) return;
    var v = unIso($("blkAr").value).trim();
    if (!v) { blkMsg("اكتب ترجمة الفقرة."); return; }
    var why = CMLShared.checkBlock(blkCur.src, v);
    if (why) { blkMsg("لم يُحفظ: " + why + (why.indexOf("كما في الأصل") >= 0 ? "." : " — انسخ الرموز كما في الأصل وبترتيبها.")); return; }
    if (v === blkCur.ar) { blkMsg("لم يتغيّر شيء."); return; }
    if (v.length > (CMLConst.BLOCK_VAL_MAX || 8000)) { blkMsg("أطول من الحدّ — لا يُحفظ."); return; }
    blkEdit([{ op: "set", k: blkCur.fp, v: v }], "حُفظ تصحيح الفقرة ✓");
  });
  $("blkDel").addEventListener("click", function () {
    if (!blkCur) return;
    blkEdit([{ op: "del", k: blkCur.fp }], blkCur.shipped
      ? "حُذف تصحيحك — تعود الفقرة إلى ترجمة الإضافة ✓"
      : "حُذف تصحيحك — ولا ترجمة لهذه الفقرة في الإضافة بعد، فتعود إنجليزية ✓");
  });

  var openOpt = document.getElementById("openOptions");
  if (openOpt) openOpt.addEventListener("click", function (e) {
    e.preventDefault();
    // (ج٥) الإعدادات تُفتح على موقع التبويب: النافذة والصفحة من أصلٍ واحد، فتكتب النافذة اختيار
    // الصفحة المحفوظ قبل فتحها، وإشارةَ تسليمٍ لمرةٍ واحدة (cml_ui_goto) ينتقل بها تبويبُ إعداداتٍ
    // مفتوحٌ أصلًا — بلا إذنٍ جديد. (الصفحة لا تتبع cml_ui_domain حيًّا: تكتبه هي عند كل تبديل)
    if (tabDomain) {
      try {
        localStorage.setItem("cml_ui_domain", tabDomain);
        localStorage.setItem("cml_ui_goto", JSON.stringify({ d: tabDomain, t: Date.now() }));
      } catch (e2) {}
    }
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
    else window.open(chrome.runtime.getURL("options.html"));
  });

  load();
  renderTab();
})();
