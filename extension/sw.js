/* sw.js — عامل الخدمة (المرحلة ٤): غراءُ كروم حول المحكّم — المنطق كله في
 * cml-arbiter.js (النسخة الواحدة التي تختبرها _swtest.html بسيناريوهات التبويبات).
 *
 * عاملُ MV3 عابرٌ (يُقتل بعد خمول ~30ث) وهذا كافٍ هنا: طلبُ الاتصال يوقظه،
 * ومنفذُ الزاحف المفتوح ونبضاتُه تبقيانه حيًّا طوالَ الزحف، وموتُه بين الفحوص
 * لا يفقد شيئًا (لا حالة تستحق البقاء — المنحة حياتُها حياةُ منفذها أصلًا،
 * وإن مات أثناء زحفٍ نادرًا فمنفذ الزاحف ينقطع فيعيد طلبَ المنحة فورًا).
 */
// الملف الواحد يخدم بيئتين: عاملَ خدمة في كروم، وصفحةَ أحداث في فايرفوكس MV3
// (الذي لا يشغّل عمال خدمة أصلًا). في الصفحة لا وجود لـimportScripts، ولا حاجة
// إليها: مانيفست فايرفوكس يسرد cml-const وcml-arbiter وcml-sync قبل هذا الملف في
// background.scripts بالترتيب نفسه، فالكائنات حاضرة قبل أن نصل هنا.
if (typeof importScripts === "function") importScripts("cml-const.js", "cml-shared.js", "cml-rtl.js", "cml-arbiter.js", "cml-sync.js");

// نسخةٌ حيّة من مفتاح الحجز القديم كي تكون استشارةُ المحكّم متزامنة (انظر رأس المحكّم).
// المفتاح يعيش في session حيث تتوفّر، وإلا في local — كما يكتبه المحرّك تمامًا.
var legacyClaim = null;
function claimArea() {
  try { return chrome.storage.session || chrome.storage.local; } catch (e) { return chrome.storage.local; }
}
function readLegacyClaim() {
  try {
    claimArea().get([CMLConst.K.SCAN_CLAIM], function (r) {
      void chrome.runtime.lastError;
      var c = (r && r[CMLConst.K.SCAN_CLAIM]) || null;
      // ★ (مراجعة كودكس) مرآةُ منحةٍ كتبها عاملٌ سابق ثم مات: المنحة نفسها في ذاكرته ماتت
      // معه، فالمرآة يتيمة — كانت تُعدّ «زاحفًا حيًّا» حتى يتقادم طابعها (90ث) فيُرفض كل
      // فحصٍ جديد بلا زاحفٍ فعلي. تُمحى عند الإقلاع؛ وحجزُ التبويبات القديمة (بهويتها لا
      // "sw-grant") يبقى كما هو.
      if (c && c.id === "sw-grant") {
        try { claimArea().remove(CMLConst.K.SCAN_CLAIM, function () { void chrome.runtime.lastError; }); } catch (e) {}
        c = null;
      }
      legacyClaim = c;
    });
  } catch (e) {}
}
readLegacyClaim();

var arbiter = CMLArbiter.createArbiter(null, {
  legacyBusy: function () {
    return !!(legacyClaim && legacyClaim.at && Date.now() - legacyClaim.at < CMLConst.CLAIM_STALE_MS);
  },
  onGrant: function (kind, at) {
    var v = { id: "sw-grant", kind: kind, at: at };
    legacyClaim = v;
    var o = {}; o[CMLConst.K.SCAN_CLAIM] = v;
    try { claimArea().set(o, function () { void chrome.runtime.lastError; }); } catch (e) {}
  },
  onRelease: function () {
    legacyClaim = null;
    try { claimArea().remove(CMLConst.K.SCAN_CLAIM, function () { void chrome.runtime.lastError; }); } catch (e) {}
  },
});

chrome.runtime.onConnect.addListener(function (port) {
  if (port.name === CMLConst.PORT_CRAWL) arbiter.attach(port);
});

// استعلام الحالة (صفحة الإعدادات قبل بدء فحص): ردٌّ متزامن — لا true فلا قناة تُترك معلقة
// ★ المحرّك الحيّ: المحتوى يرسل عناوين أوراق الموقع وبصمتَها، والعامل يردّ بورقة القلب
// — من الذاكرة إن طابقت البصمة، وإلا جلبًا وبناءً وتخزينًا. العملُ هنا لا في الصفحة:
// البناء متزامنٌ ووقوعُه في خيط الصفحة يظهر تلعثمًا عند كل تحديثٍ للموقع. وكلفتُه (ورقة الوثائق 881 ك.ب، بعد S8-C):
// 0.3–0.5 ث من زمن خيط العامل (كانت 0.8–1 ث) — والساعةُ أضعافُ ذلك والجهاز مشغول: عمليةُ الإضافة في الخلفية بأولويةٍ منخفضة.
// (الأصول تُخدَم بـaccess-control-allow-origin: * فيجلبها العامل بلا صلاحية مضيف.)
// ★★ خريطةٌ بالبصمة لا خانةٌ واحدة: طلبٌ ببصمةٍ جديدة كان يدهس القائم فيصل ردُّ
// البناء الأول إلى صاحب البصمة الثانية (فتخمد ورقةُ اللقطة على ورقةٍ ليست لها)،
// والأولُ لا يُردّ عليه أبدًا. والقائمةُ محفوظةٌ في مغلَّف الطلب نفسِه.
var liveBuilding = Object.create(null);

// ★★ (مراجعة كودكس ١١ و١٤) العامل لا يثق بما يُرسَل إليه:
//   ١) المرسلُ تبويبٌ على نطاقٍ مشمول (sender.url)، لا ما يدّعيه الطلب.
//   ٢) كل ورقةٍ https على نطاقٍ مسموح أو على أصل الصفحة نفسها، وبلا تحويلٍ إلى غيره
//      (redirect:"error")، وبلا بيانات اعتماد، وبمهلةٍ وسقفِ حجمٍ لكلٍّ وللمجموع.
//   ٣) **الكلُّ أو لا شيء**: ورقةٌ فشلت، أو عددٌ فوق السقف، أو @import ⇒ لا بناء ولا تخزين —
//      فلا تُختم بصمةُ المجموعة الكاملة على ناتجٍ جزئي يُخمد اللقطة (قِيس: ورقتان نجحت
//      واحدة فقُبل الناتج وخُزّن sources:1، و١٣ ورقة جُلب منها ١٢ وقُبل).
// الصفحات المأذون لها بطلب ورقةٍ حيّة: نطاقاتٌ في جدول النطاقات سمتُها live (١-٠ب)
var LIVE_FETCH_HOSTS = /(^|\.)claude\.ai$|(^|\.)anthropic\.com$|(^|\.)claude\.com$/;
function hostOf(u) { try { var x = new URL(u); return x.protocol === "https:" ? x.hostname : null; } catch (e) { return null; } }
function utf8Len(s) { try { return new TextEncoder().encode(s).length; } catch (e) { return s.length * 3; } }
function fetchSheet(url) {
  var ctl = typeof AbortController === "function" ? new AbortController() : null;
  var timer = setTimeout(function () { if (ctl) ctl.abort(); }, CMLConst.RTL_LIVE_FETCH_MS);
  return fetch(url, { redirect: "error", credentials: "omit", signal: ctl ? ctl.signal : undefined })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      var len = +(res.headers.get("content-length") || 0);
      if (len && len > CMLConst.RTL_LIVE_SOURCE_MAX_BYTES) throw new Error("too-large");
      return res.text();
    })
    .then(function (t) {
      clearTimeout(timer);
      if (typeof t !== "string" || !t.length) throw new Error("empty");
      if (utf8Len(t) > CMLConst.RTL_LIVE_SOURCE_MAX_BYTES) throw new Error("too-large");
      return t;
    }, function (e) { clearTimeout(timer); throw e; });
}
function buildLive(sheets, fp, pageHost, domainId, cb) {
  // ذاكرةٌ لكل نطاق (التطبيق على مفتاحه القديم): تبويبان على نطاقين لا يتقاذفان خانةً واحدة
  var LIVE_KEY = CMLConst.key(CMLConst.K.RTL_LIVE, domainId);
  chrome.storage.local.get([LIVE_KEY], function (r) {
    var have = !chrome.runtime.lastError && r && r[LIVE_KEY];
    if (have && have.fp === fp && have.css) { cb({ css: have.css, cached: true }); return; }
    if (liveBuilding[fp]) { liveBuilding[fp].push(cb); return; }
    var waiting = liveBuilding[fp] = [cb];
    var done = function (payload) {
      delete liveBuilding[fp];
      for (var i = 0; i < waiting.length; i++) { try { waiting[i](payload); } catch (e) {} }
    };
    // الورقة المضمَّنة نصُّها في الطلب نفسه (من المستند، تحقّق منه validLiveRequest) فلا جلب لها؛ وعناوينها
    // النسبية تبقى كما هي (ورقتنا تُحقن في المستند نفسه فأساسها أساسه)
    Promise.all(sheets.map(function (x) { return x.url ? fetchSheet(x.url) : Promise.resolve(x.inline); })).then(function (texts) {
      // البناء متزامنٌ طويل (ورقة الوثائق ~880 ك.ب: ثوانٍ على جهازٍ مشغول) — يُقدَّم عليه ردُّ قطعة المتن المنتظَر (afterBodies)
      afterBodies(function () {
      var total = 0;
      for (var i = 0; i < texts.length; i++) total += utf8Len(texts[i]);
      if (total > CMLConst.RTL_LIVE_TOTAL_MAX_BYTES) { done(null); return; }
      var recs = texts.map(function (t, j) { return { text: t, base: sheets[j].url || null, media: sheets[j].media }; });
      // ★ الرميةُ تُلتقط: كانت تترك القفل قائمًا فتُبتلع كل الطلبات اللاحقة بلا ردّ
      var built = null;
      try { built = CMLRtl.buildLiveSheet(recs, {}); } catch (e) { built = null; }
      // ★ ورقةٌ مضمَّنة شاذّة (أخطاء تحليلٍ فوق البوابة في CSS مولَّدٍ بالجافاسكربت مثلًا) لا تُسقط الورقة الحيّة كلّها:
      // يُعاد البناء من الروابط وحدها — وهو ما كان يُبنى قبل ضمّ المضمَّنة، فلا يسوء نطاقٌ بضمّها
      var linkRecs = recs.filter(function (r, j) { return !!sheets[j].url; });
      if (!built && linkRecs.length && linkRecs.length < recs.length) {
        try { built = CMLRtl.buildLiveSheet(linkRecs, {}); } catch (e) { built = null; }
      }
      // بناءٌ أخفق (بوابتا الصحّة، @import) ⇒ لا نكتب شيئًا فتبقى ورقةُ اللقطة عاملة
      var bytes = built ? utf8Len(built.css) : 0;
      if (!built || bytes > CMLConst.RTL_LIVE_MAX_BYTES) { done(null); return; }
      var rec = { fp: fp, css: built.css, at: Date.now(), sources: sheets.length, requested: sheets.length,
                  host: pageHost, domain: domainId, bytes: bytes, flipped: built.stats.flipped, rules: built.rules };
      var w2 = {}; w2[LIVE_KEY] = rec;
      evictLive(LIVE_KEY, bytes, function () {
      chrome.storage.local.set(w2, function () {
        // الحفظ فشل (سعةٌ مثلًا): الورقة تُطبَّق لهذا التبويب، ولا ندّعي أنها خُزّنت
        var failed = !!chrome.runtime.lastError;
        done({ css: rec.css, cached: false, stored: !failed });
      });
      });
      });
    }, function () { done(null); });
  });
}

// ★ ميزانيةٌ كلية لذاكرة الأوراق الحيّة (مراجعة كودكس ١٤): ورقةٌ لكل نطاقٍ حيّ، وسعةُ التخزين
// المحلي 5 م.ب في أدنى إصدارٍ مدعوم — فقبل حفظ ورقةٍ جديدة تُطرد الأقدمُ من أوراق النطاقات
// الأخرى حتى يسع المجموع الميزانية (والمطرودة تُبنى من جديد عند أول زيارة، والاتجاه لا يتأثر).
// ★ (2.0.0، DESIGN-fonts §٢.٢ وث٩) والميزانية لصنف cache كلِّه: نسخة الخط العربي (cml_font_data) تدخل المجموع، فورقةٌ
// جديدة تطرد الأقدم من الأوراق حتى تسعها مع النسخة، وكتابةُ النسخة (keepKey = مفتاحها) تطرد من الأوراق ما يلزم لها.
// والنسخة نفسها لا تُطرد هنا أبدًا، ولا يُمسّ صنف data ولا الإعدادات.
function evictLive(keepKey, newBytes, cb) {
  var keys = CMLConst.DOMAINS.filter(function (d) { return d.meta && d.meta.live; })
    .map(function (d) { return CMLConst.key(CMLConst.K.RTL_LIVE, d.id); });
  var FD = CMLConst.K.FONT_DATA;
  chrome.storage.local.get(keys.concat(FD ? [FD] : []), function (r) {
    if (chrome.runtime.lastError || !r) { cb(); return; }
    var others = keys.filter(function (k) { return k !== keepKey && r[k] && r[k].css; })
      .map(function (k) { return { k: k, at: r[k].at || 0, bytes: r[k].bytes || utf8Len(r[k].css) }; })
      .sort(function (a, b) { return a.at - b.at; });
    var total = newBytes, drop = [];
    if (FD && keepKey !== FD && r[FD] && typeof r[FD].b64 === "string") total += r[FD].b64.length;
    others.forEach(function (o) { total += o.bytes; });
    while (total > CMLConst.RTL_LIVE_BUDGET_BYTES && others.length) { var o = others.shift(); total -= o.bytes; drop.push(o.k); }
    if (!drop.length) { cb(); return; }
    chrome.storage.local.remove(drop, function () { void chrome.runtime.lastError; cb(); });
  });
}
// خطأ السعة عند كتابة نسخة الخط: تُطرد الأوراق الحيّة كلها (تُبنى من جديد عند أول زيارة، والاتجاه لا يتأثر)
function dropAllLive(cb) {
  var keys = CMLConst.DOMAINS.filter(function (d) { return d.meta && d.meta.live; })
    .map(function (d) { return CMLConst.key(CMLConst.K.RTL_LIVE, d.id); });
  chrome.storage.local.remove(keys, function () { void chrome.runtime.lastError; cb(); });
}

function validLiveRequest(msg, sender) {
  if (!msg || typeof msg.fp !== "string" || !Array.isArray(msg.sheets)) return null;
  var pageHost = sender && sender.tab && hostOf(sender.url || "");
  var dom = pageHost && CMLConst.domainOfUrl(sender.url);
  if (!dom || !dom.meta || !dom.meta.live) return null;
  if (!msg.sheets.length || msg.sheets.length > CMLConst.RTL_LIVE_SHEETS_MAX) return null;
  var out = [];
  for (var i = 0; i < msg.sheets.length; i++) {
    var x = msg.sheets[i];
    var media = x && typeof x.media === "string" ? x.media.slice(0, 200) : "";
    // ★ ورقةٌ مضمَّنة (<style> من المستند نفسه — وثائق Claude Code): نصٌّ غير فارغ دون سقف الورقة الواحدة،
    // وبلا @import (لا نتبعه). لا عنوان لها فلا جلب ولا مضيف — والكلُّ أو لا شيء كسائر الأوراق
    if (x && typeof x.inline === "string" && x.url === undefined) {
      // وفي نطاقٍ اختارها وحده (meta.liveInline — ١٦ ربيع الآخر ١٤٤٨هـ): طلبٌ من التطبيق أو غيره يحمل ورقةً مضمَّنة
      // يُرفض كلُّه فلا يُبنى ولا يُخزَّن منه شيء — حارسٌ ثانٍ خلف المحرّك لاستثناء المحادثة
      if (!dom.meta.liveInline) return null;
      if (!x.inline.length || x.inline.indexOf("{") < 0 || /@import\b/i.test(x.inline) ||
          utf8Len(x.inline) > CMLConst.RTL_LIVE_SOURCE_MAX_BYTES) return null;
      out.push({ inline: x.inline, media: media });
      continue;
    }
    if (!x || typeof x.url !== "string") return null;
    var h = hostOf(x.url);
    if (!h || !(LIVE_FETCH_HOSTS.test(h) || h === pageHost)) return null;
    out.push({ url: x.url, media: media });
  }
  return { sheets: out, pageHost: pageHost, domain: dom.id };
}
// مفتاح الورقة في البصمة — هو نفسه liveKey في engine.js: الرابط بعنوانه، والمضمَّنة ببصمة نصّها
function liveKey(x) {
  return (x.url ? x.url : "inline:" + CMLRtl.fnv1a(x.inline)) + (x.media ? " @" + x.media : "");
}

// ★★ (المرحلة ٢) قطع المتون: ملفّاتٌ في حزمة الإضافة نفسها (bodies/<نطاق>/<لغة>/<قطعة>.json) يقرؤها
// العامل لسكربت المحتوى — لا اتصال بأحد، وصفرُ بايتٍ من المتون في غير صفحاتها. المرسلُ تبويبٌ على
// نطاقٍ ذي متون (sender.url)، والمسار من النطاق نفسه وفي مساره الكامل، والقطعة تُعرف من فهرس النطاق
// فلا يُطلب ملفٌّ غير موجود؛ وذاكرةٌ صغيرة لآخر القطع (العامل يموت خاملًا فتُقرأ من جديد — ملفٌّ محلي).
var bodiesIndex = Object.create(null), bodiesCache = new Map(), BODIES_CACHE_MAX = 24;
// ★ (S8-C، المراجعة العدائية، ٢٢ ربيع الآخر ١٤٤٨هـ) ردُّ القطعة أولًا: بناء الورقة الحيّة متزامنٌ طويل، وقِيس في عاملٍ بارد
// (أول صفحةٍ في الوثائق بعد التثبيت أو بعد تغيّر CSS الموقع): طلب القطعة عند 6.2 ث وطلب الورقة بعده بـ12 مث، فجُلبت ورقةٌ
// من 881 ك.ب وبُنيت 31 ث والمعالج مشغولٌ بغيرنا، وجلبُ القطعة المحلي ينتظر خلفها — فبقي المتن إنجليزيًّا 10–45 ث بعد تعريب
// العنوان والشريط (وهو «الإخفاق المتقطّع» في وصف messages/create في S7-B، وتعثّر فحص الدخان «صفحة AWS بقطعتها»).
// فالبناء ينتظر حتى تُجاب طلباتُ القطع القائمة، بسقفٍ لا يجوِّعه (طلبٌ يصل أثناء البناء ينتظر كما كان — المعالج واحد)
var bodiesInflight = 0, bodiesIdleQ = [], BODIES_FIRST_MAX_MS = 4000;
function afterBodies(fn) {
  if (!bodiesInflight) { fn(); return; }
  var ran = false, go = function () { if (!ran) { ran = true; fn(); } };
  bodiesIdleQ.push(go);
  setTimeout(go, BODIES_FIRST_MAX_MS);
}
function bodiesSettled() {
  if (bodiesInflight > 0) bodiesInflight--;
  if (bodiesInflight) return;
  var q = bodiesIdleQ; bodiesIdleQ = [];
  // مهلةُ صفرٍ بعد sendResponse: تخرج الرسالة قبل أن يحجز البناءُ المتزامن المعالج
  if (q.length) setTimeout(function () { q.forEach(function (f) { try { f(); } catch (e) {} }); }, 0);
}
function packagedJson(rel) {
  return fetch(chrome.runtime.getURL(rel)).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
}
function bodiesShard(domId, lang, shard) {
  var ik = domId + "/" + lang;
  // (S8-C) فهرسٌ تعذّرت قراءته لا يُحفظ فارغًا ما بقي العامل حيًّا (كان يُسقط كل قطع النطاق حتى يموت العامل): يُعاد في الطلب التالي
  var idx = bodiesIndex[ik] || (bodiesIndex[ik] = packagedJson("bodies/" + ik + "/index.json").then(function (x) {
    var set = Object.create(null);
    (x && Array.isArray(x.shards) ? x.shards : []).forEach(function (sh) { set[sh] = 1; });
    return set;
  }, function () { delete bodiesIndex[ik]; return Object.create(null); }));
  return idx.then(function (set) {
    if (!set[shard]) return null;
    var ck = ik + "/" + shard;
    if (bodiesCache.has(ck)) { var v = bodiesCache.get(ck); bodiesCache.delete(ck); bodiesCache.set(ck, v); return v; }
    return packagedJson("bodies/" + ck + ".json").then(function (x) {
      // القطعة: ترجماتُ كتل الصفحة، وعلاماتُ «يبقى كما في المصدر» لكتلها (keep — بصماتٌ فقط؛ S6-C)
      var blocks = x && x.blocks && typeof x.blocks === "object" ? x.blocks : null;
      var keep = x && Array.isArray(x.keep) ? x.keep.filter(function (fp) { return typeof fp === "string" && /^[0-9a-f]{16}$/.test(fp); }) : [];
      var part = blocks || keep.length ? { blocks: blocks || {}, keep: keep } : null;
      bodiesCache.set(ck, part);
      while (bodiesCache.size > BODIES_CACHE_MAX) bodiesCache.delete(bodiesCache.keys().next().value);
      return part;
    }, function () { return null; });
  });
}
// ═══ الخط العربي (2.0.0 — DESIGN-fonts §٤.٢): عامل الخدمة هو الكاتب الوحيد لـ cml_font_data ═══════════════
// يقرأ ملف الخط المختار من حزمة الإضافة نفسها (لا شبكة ولا web_accessible_resources)، ويتحقق من ترويسته wOF2 ومن
// طوله، ويكتب نسخة base64 {id, v: البصمة، b64} أو {id, v, err}؛ فيقرؤها المحرّك في قراءة get() الوحيدة عند
// document_start ويبني منها FontFace(ArrayBuffer). الكتابات متسلسلة في سلسلة وعودٍ واحدة فلا يتداخل محفِّزان،
// وكلُّ دورٍ يقرأ الاختيار الحاضر فتنتهي التغييرات السريعة إلى آخرها. والسعة في ميزانية صنف cache (ث٩).
var fontChain = Promise.resolve();
var FONT_FETCH_MS = 10000;
function ensureFontCache(force) {
  var run = function () { return fontEnsureOnce(!!force); };
  fontChain = fontChain.then(run, run);
  return fontChain;
}
function fontEnsureOnce(force) {
  var K = CMLConst.K;
  return new Promise(function (resolve) {
    chrome.storage.local.get([K.FONT, K.FONT_DATA], function (r) {
      if (chrome.runtime.lastError || !r) { resolve("read-error"); return; }
      // الغياب وكل قيمةٍ مجهولة ← الافتراضي، و«خط الموقع» ← لا نسخة (C.fontResolve)
      var want = CMLConst.fontResolve(r[K.FONT]), have = r[K.FONT_DATA];
      if (!want) {
        if (have === undefined) { resolve("none"); return; }
        chrome.storage.local.remove(K.FONT_DATA, function () { void chrome.runtime.lastError; resolve("removed"); });
        return;
      }
      var same = !!have && typeof have === "object" && have.id === want.id && have.v === want.sha;
      var whole = same && typeof have.b64 === "string" && have.b64.length === Math.ceil(want.bytes / 3) * 4;
      // المطابِقة تنهي الدور ولو كان فيها err: كتابتُنا نفسها تطلق onChanged فلا حلقة، والخطأ لا يُعاد على البصمة
      // نفسها إلا بطلب font-ensure (المحرّك في الإقلاع، أو زرّ «إعادة المحاولة»)
      if (!force && (whole || same)) { resolve("same"); return; }
      // ★ (المراجعة العدائية S6-B) وطلب font-ensure لا يأتي إلا ممن رفض النسخة (المحرّك: فكٌّ أو ترويسةٌ أو تحليلٌ فاشل)
      // أو من صفحة الإعدادات: فالنسخة «الكاملة» الطول لا يُكتفى بها حتى تطابق بايتاتُها بصمةَ الفهرس، وإلا بقيت نسخةٌ
      // تالفة بطولٍ صحيح بلا إصلاحٍ أبدًا — والسليمة لا يُعاد جلبها
      (whole ? sha16(b64Buf(have.b64)) : Promise.resolve(null)).then(function (h) {
        if (whole && h === want.sha) { resolve("same"); return; }
        // ملفٌّ من الحزمة نفسها لا يتأخر؛ والمهلة حارسٌ لسلسلة الكتابات من أن تتعطّل كلها بجلبٍ لا يعود
        var ctl = typeof AbortController === "function" ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctl) ctl.abort(); }, FONT_FETCH_MS);
        fetch(chrome.runtime.getURL(want.file), ctl ? { signal: ctl.signal } : undefined).then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.arrayBuffer();
        }).then(function (buf) {
          clearTimeout(timer);
          var u = new Uint8Array(buf);
          if (u.length !== want.bytes || u[0] !== 0x77 || u[1] !== 0x4f || u[2] !== 0x46 || u[3] !== 0x32) throw new Error("ليس ملف الفهرس");
          // والبصمة أيضًا (حيث توجد crypto.subtle): ملفٌّ بالطول نفسه وبايتاتٍ أخرى ليس ملف الفهرس
          return sha16(buf).then(function (fh) {
            if (fh && fh !== want.sha) throw new Error("بصمةٌ غير بصمة الفهرس");
            return { id: want.id, v: want.sha, b64: CMLShared.bufToB64(buf) };
          });
        }).then(function (rec) { writeFontData(rec, resolve); },
                function () { clearTimeout(timer); writeFontData({ id: want.id, v: want.sha, err: "file" }, resolve); });
      });
    });
  });
}
// بصمة الفهرس (sha): أول ستة عشر حرفًا ست عشريًّا من SHA-256 لبايتات الملف — null حيث لا crypto.subtle أو تعذّر الحساب
function sha16(buf) {
  var sub = self.crypto && self.crypto.subtle;
  if (!buf || !sub || typeof sub.digest !== "function") return Promise.resolve(null);
  return sub.digest("SHA-256", buf).then(function (d) {
    var u = new Uint8Array(d), s = "";
    for (var i = 0; i < 8; i++) s += (u[i] < 16 ? "0" : "") + u[i].toString(16);
    return s;
  }, function () { return null; });
}
function b64Buf(b64) { try { return CMLShared.b64ToBuf(b64); } catch (e) { return null; } }
function writeFontData(rec, done) {
  var K = CMLConst.K;
  var put = function (obj, cb) {
    var o = {}; o[K.FONT_DATA] = obj;
    chrome.storage.local.set(o, function () { var e = chrome.runtime.lastError; cb(e ? String(e.message || e) : null); });
  };
  // قبل الكتابة: الأوراق الحيّة الأقدم تُطرد حتى تسع الميزانيةُ النسخة (evictLive يحسبها في المجموع)
  evictLive(K.FONT_DATA, rec.b64 ? rec.b64.length : 0, function () {
    put(rec, function (err) {
      if (!err) { done("written"); return; }
      if (!rec.b64 || !/QUOTA/i.test(err)) { done("write-error"); return; }
      // امتلأ التخزين مع ذلك (صنف data كبير): تُطرد الأوراق الحيّة كلها وتُعاد المحاولة مرةً، ثم سجلُّ quota —
      // ولا يُمسّ صنف data ولا الإعدادات أبدًا
      dropAllLive(function () {
        put(rec, function (err2) {
          if (!err2) { done("written"); return; }
          put({ id: rec.id, v: rec.v, err: "quota" }, function () { done("quota"); });
        });
      });
    });
  });
}
// صفحةٌ في نطاقٍ معروف (سكربت المحتوى في الإقلاع) — الإطار الأعلى وحده يرسل، والنطاق من عنوان المرسل نفسه
function fromKnownTab(sender) {
  return !!(sender && sender.tab && hostOf(sender.url || "") && CMLConst.domainOfUrl(sender.url));
}

function validBodiesRequest(msg, sender) {
  var dom = sender && sender.tab && hostOf(sender.url || "") && CMLConst.domainOfUrl(sender.url);
  if (!dom || !dom.meta || !dom.meta.bodies || !msg) return null;
  var path = typeof msg.path === "string" && msg.path.length <= 2048 && msg.path.charAt(0) === "/" ? msg.path : null;
  var lang = typeof msg.lang === "string" && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(msg.lang) ? msg.lang : null;
  if (!path || !lang || CMLConst.domainOfUrl(dom.origin + path) !== dom) return null;
  if (CMLShared.routeMode(dom.meta.routes, path) !== "full") return null;
  return { dom: dom, lang: lang, page: CMLShared.pageKey(dom.meta, path) };
}

// صفحاتُ الإضافة نفسها (الإعدادات والنافذة) — لا سكربتات المحتوى ولا غيرها
// ★ (مراجعة مستقلة، حرجة) صفحة الإعدادات تُفتح في تبويب (open_in_tab) فيحمل مرسلُها tab —
// واشتراطُ غيابه كان يرفض كل أوامرها. الحدّ الصحيح أصلُ الإضافة: سكربت المحتوى أصلُه
// صفحةُ الموقع (https) لا chrome-extension://، فلا يمرّ.
function fromExtensionPage(sender) {
  try {
    var base = chrome.runtime.getURL("");
    if (!sender || sender.id !== chrome.runtime.id || typeof sender.url !== "string") return false;
    if (sender.url.indexOf(base) !== 0) return false;
    if (typeof sender.origin === "string" && sender.origin && base.indexOf(sender.origin) !== 0) return false;
    return true;
  } catch (e) { return false; }
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg && msg.type === "status") { sendResponse(arbiter.status()); return false; }
  // ★ إصلاح نسخة الخط (DESIGN-fonts §٤.٢): بلا حمولةٍ في الطلب ولا في الردّ؛ من تبويبٍ في نطاقٍ معروف أو من صفحات
  // الإضافة («إعادة المحاولة») — وما سواهما يُتجاهل
  if (msg && msg.type === "font-ensure") {
    if (!fromExtensionPage(sender) && !fromKnownTab(sender)) { sendResponse(null); return false; }
    ensureFontCache(true).then(function () { try { sendResponse({ ok: true }); } catch (e) {} });
    return true;
  }
  // ★ أوامر إدارة المزامنة (مراجعة كودكس ٦): كاتبٌ واحد هنا بدل كتابة الصفحة رأسًا —
  // الأمر ينتظر فراغ الجولة الجارية، والردّ بعد التمام لا قبله
  if (msg && msg.type === "sync-admin" && typeof msg.op === "string") {
    if (!fromExtensionPage(sender)) { sendResponse({ error: "مرسلٌ غير مأذون" }); return false; }
    var aopt = { wipe: !!msg.wipe };
    // ★ إعادة ضبط موقعٍ واحد: النطاق معروفٌ في الجدول، وكل مفتاحٍ مُرسَل من مفاتيحه المحلية
    // (C.keysOfDomain — وهي جزءٌ من RESET_KEYS) — لا يُمرَّر مفتاحٌ عامّ ولا مفتاحُ موقعٍ آخر
    if (msg.domain !== undefined || msg.keys !== undefined) {
      var allowed = msg.op === "reset" && typeof msg.domain === "string" && CMLConst.domain(msg.domain)
        ? CMLConst.keysOfDomain(msg.domain) : null;
      var ks = Array.isArray(msg.keys) ? msg.keys : null;
      if (!allowed || !ks || !ks.length || ks.length > allowed.length ||
          ks.some(function (k) { return typeof k !== "string" || allowed.indexOf(k) < 0 || CMLConst.RESET_KEYS.indexOf(k) < 0; })) {
        sendResponse({ error: "مفاتيح إعادة الضبط لا تخصّ الموقع المذكور" });
        return false;
      }
      aopt.domain = msg.domain;
      aopt.keys = ks.slice();
    }
    // ★ إعادة ضبط موقعٍ والمزامنة مفعّلة: حذفُ مفاتيحه حدثُ تخزينٍ يبلغ syncQueue كأن المستخدم حذف
    // تصحيحاته كلها — فكانت تُكتب شواهدُ حذفٍ وطابعٌ ثم تُدفع لقطةٌ فارغة فوق سحابة الموقع، فيضيع ما
    // وعد التأكيدُ بإبقائه. فتُعلَّم مساحاتُه قبل الأمر، ويُهمَل حدثُ الإزالة ما دامت العلامة (انظر g.queue)
    var mine = aopt.domain ? GLUES.filter(function (g) { return g.sp.id === aopt.domain || g.sp.id === "blocks:" + aopt.domain; }) : [];
    mine.forEach(function (g) { resetting[g.sp.id] = Infinity; });
    CMLSync.admin(syncEnv, msg.op, aopt).then(function (res) {
      // مؤقّتات الدفع والإعادة من قبل الأمر لا معنى لها بعده — ومنها المسحُ الذي مسح فعلًا
      // (كان مؤقّتٌ مسلَّح قبله يعيد رفع كل شيء بعد ثوانٍ بلا تعديل)
      var wiped = msg.op === "wipe" && res && res.ok && !res.empty;
      if (aopt.domain) {
        // إعادة ضبط موقعٍ واحد: مؤقّتاتُ مساحاته وحدها — دفعاتُ المواقع الأخرى المعلّقة تبقى.
        // والعلامة تبقى لحظةً بعد الأمر: حدثُ الإزالة قد يصل بعد ردّ الحذف نفسه
        mine.forEach(function (g) { g.cancel(); resetting[g.sp.id] = Date.now() + RESET_MARK_MS; });
        // بلا مسح: ما رُفع من الموقع يعود إلى هذا الجهاز الآن كما يقول التأكيد — سحبٌ فدمج (الدفتر
        // الخالي لا يعدّ لقطةَ جهازه صدًى، رأس freshLedger في cml-sync.js). ومع المسح لا دفع بعده
        if (res && res.reset && !aopt.wipe && syncEnabled !== false) mine.forEach(function (g) { g.pull(); });
      } else if (msg.op === "reset" || msg.op === "disable" || wiped) {
        adminEpoch++;
        cancelAllSyncTimers();
      }
      try { sendResponse(res); } catch (e) {}
    }, function (e) {
      mine.forEach(function (g) { resetting[g.sp.id] = Date.now() + RESET_MARK_MS; });
      try { sendResponse({ error: String((e && e.message) || e) }); } catch (e2) {}
    });
    return true; // ردٌّ غير متزامن
  }
  // تعديل التصحيحات من صفحات الإضافة (الخيارات والنافذة) أمرًا جزئيًّا يطبّقه كاتبُ المساحة
  if (msg && msg.type === "terms-edit") {
    // blocks: تصحيحات الفقرات (مساحتها الدنيا) — المفاتيح بصمات، والقيم قوالب يتحقّق منها المعقِّم
    var tsp = typeof msg.d === "string" && (msg.blocks === true ? CMLSync.spaceOfBlocks(msg.d) : CMLSync.spaceOfDomain(msg.d));
    if (!fromExtensionPage(sender) || !tsp || !Array.isArray(msg.ops) || msg.ops.length > 50000) {
      sendResponse({ error: "forbidden" });
      return false;
    }
    tsp.editLocal(syncEnv, typeof msg.lang === "string" ? msg.lang : "ar", msg.ops,
                  typeof msg.gen === "number" ? msg.gen : undefined).then(
      function (rep) { sendResponse(rep && rep.stale ? { error: "stale" } : { ok: true, report: rep }); },
      function (e) { sendResponse({ error: String((e && e.message) || e) }); });
    return true;
  }
  if (msg && msg.type === "bodies") {
    var breq = validBodiesRequest(msg, sender);
    if (!breq) { sendResponse(null); return false; }
    bodiesInflight++;
    bodiesShard(breq.dom.id, breq.lang, CMLShared.shardOf(breq.page)).then(function (part) {
      try { sendResponse(part ? { page: breq.page, blocks: part.blocks, keep: part.keep } : null); } catch (e) {}
      bodiesSettled();
    }, function () { try { sendResponse(null); } catch (e) {} bodiesSettled(); });
    return true; // ردٌّ غير متزامن
  }
  if (msg && msg.type === "rtlcss") {
    var req = validLiveRequest(msg, sender);
    if (!req) { sendResponse(null); return false; }
    // البصمة يحسبها العامل من المجموعة التي تحقّق منها — لا ما يدّعيه الطلب
    // ورقمُ مراجعة المحرّك فيها (فحص الاتجاه الشامل، ق١): ورقةٌ بناها محرّكٌ سابق لا تُعاد من الذاكرة بعد التحديث
    // والمضمَّنة ببصمة نصّها المتحقَّق منه: تغيّر CSS الموقع المضمَّن يعيد البناء كتغيّر عنوان ورقة
    var fpW = CMLRtl.fnv1a("r" + (CMLRtl.REV || 1) + "|" + req.sheets.map(liveKey).join("|"));
    buildLive(req.sheets, fpW, req.pageHost, req.domain, function (payload) { try { sendResponse(payload); } catch (e) {} });
    return true; // ردٌّ غير متزامن
  }
  return false;
});

// ★ ترحيل أول إقلاعٍ لـ2.0.0 (قرار المالك ق٣): زرٌّ رئيس للجميع ومفتاحٌ لكل نطاق، ومن أطفأ
// التعريب في 1.0.0 تبقى عنده النطاقات الجديدة مطفأة — فإن أعاد الرئيس لم يُفاجأ بمواقع لم
// يخترها. مرّةً واحدة بعلامة، ولا يمسّ من ثبّت 2.0.0 جديدًا (لا cml_enabled=false عنده).
function migrateV2() {
  var K = CMLConst.K;
  chrome.storage.local.get([K.V2_INIT, K.ENABLED], function (r) {
    if (chrome.runtime.lastError || !r || r[K.V2_INIT]) return;
    var w = {}; w[K.V2_INIT] = 1;
    if (r[K.ENABLED] === false) {
      CMLConst.DOMAINS.forEach(function (d) { if (d.id !== "app") w[K.SITE_ON + "." + d.id] = false; });
    }
    chrome.storage.local.set(w, function () { void chrome.runtime.lastError; });
  });
}
migrateV2();

// نسخة الخط عند التثبيت والتحديث (وإعادة تحميل النسخة غير المحزومة) وعند بدء المتصفح — والقشور بلا هذين الحدثين
try { if (chrome.runtime.onInstalled) chrome.runtime.onInstalled.addListener(function () { ensureFontCache(); }); } catch (e) {}
try { if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(function () { ensureFontCache(); }); } catch (e) {}

// فتحُ مساحة session لسكربتات المحتوى كان رهينَ فتحِ صفحة الإعدادات (هي من يضبطه) —
// ضبطُه هنا أيضًا عند كل إيقاظ يفكّ ذلك الاعتماد الترتيبي (رخيصٌ وآمن التكرار).
try {
  var p = chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" });
  if (p && typeof p.catch === "function") p.catch(function () {}); // الرفض غير المعالَج يلوّث سجل العامل
} catch (e) {}

// ── المزامنة الاختيارية (المرحلة ٦): غراءُ كروم حول CMLSync — المنطق والعقد كله
// في cml-sync.js. دور هذا الملف: بيئة فوق chrome.storage، وترشيح الأحداث، والتجميع.

// بيئة CMLSync فوق واجهات كروم الحقيقية — أخطاء الكتابة تُمرَّر (lastError غير
// المقروء يصيح في سجل العامل، وقارئه هنا هو معالج الأخطاء الفعلي في CMLSync)
// ★ القراءة تُمرِّر خطأها كالكتابة (مراجعة كودكس ٥): ابتلاعُه وإعادةُ {} كان يجعل
// سحابةً لم تُقرأ «فارغة» فيُكتب فوقها
function lastErr() {
  var e = chrome.runtime.lastError;
  return e ? (e.message || String(e)) : null;
}
var syncEnv = {
  getLocal: function (keys, cb) {
    chrome.storage.local.get(keys, function (r) { var e = lastErr(); cb(e ? null : (r || {}), e); });
  },
  removeLocal: function (keys, cb) {
    chrome.storage.local.remove(keys, function () { cb(lastErr()); });
  },
  setLocal: function (obj, cb) {
    chrome.storage.local.set(obj, function () {
      cb(chrome.runtime.lastError ? chrome.runtime.lastError.message : null);
    });
  },
  getSyncAll: function (cb) {
    chrome.storage.sync.get(null, function (r) { var e = lastErr(); cb(e ? null : (r || {}), e); });
  },
  setSync: function (obj, cb) {
    chrome.storage.sync.set(obj, function () {
      cb(chrome.runtime.lastError ? chrome.runtime.lastError.message : null);
    });
  },
  removeSync: function (keys, cb) {
    chrome.storage.sync.remove(keys, function () {
      cb(chrome.runtime.lastError ? chrome.runtime.lastError.message : null);
    });
  },
  now: function () { return Date.now(); },
};

// ★ علم الموافقة مخبوءًا: كان الطابع يُكتب مع كل حفظ تصحيحٍ ولو لم تُفعَّل المزامنة
// قطّ — كتابةٌ في كل حفظ بلا معنى. يُقرأ عند الإيقاظ ويُحدَّث من onChanged نفسه،
// وقبل أول قراءة (null) لا نمنع شيئًا: localCore يقرأ الموافقة طازجةً ويصفّر الطابع.
var syncEnabled = null;
// عصرُ الإدارة: يزيد مع كل أمرٍ يُلغي ما قبله؛ مؤقّتٌ سُلّح في عصرٍ سابق لا يعمل بعده
var adminEpoch = 0;
// مساحاتٌ تُعاد ضبطُها الآن (معرّف المساحة ← نهاية العلامة بالمللي ثانية): حدثُ إزالة تصحيحاتها
// من إعادة الضبط ليس حذفًا من المستخدم فلا شواهد له ولا طابع ولا دفع (انظر g.queue)
var resetting = Object.create(null);
var RESET_MARK_MS = 3000;
function isResetting(id) { var t = resetting[id]; if (!t) return false; if (Date.now() < t) return true; delete resetting[id]; return false; }

// ── غراءٌ لكل مساحة مزامنة (١-٠ب): التطبيق ثم النطاقات، ولكلٍّ مؤقّتُ تجميعه ومُراكمُه
// ومؤقّتُ إعادته — فتعديلٌ في مركز المساعدة لا يؤخّر دفعةً للتطبيق ولا يختلط بشواهدها.
//
// تجميع الدفع: التعديلات المتتابعة (استيراد قاموس، حذف متتالٍ) دفعةٌ واحدة بعد مهلة
// SYNC_PUSH_DEBOUNCE_MS. المؤقّت وحده لا يُؤتمن — العامل قد يُقتل قبل أن يطلق — فيُكتب
// طابعُ المساحة المعلّق قبل المؤقّت، وفحصُ الإيقاظ يلتقط طابعًا تُرك أكثر من
// SYNC_WAKE_GRACE_MS فيدفع فورًا. والإعادةُ (قراءةٌ أو كتابةٌ فشلت، أو سحابةٌ ممزّقة تنتظر
// التثبّت) بمؤقّتٍ ما دام العامل حيًّا، وإن مات فالطابع أو العلامة وموعد التثبّت يلتقطها الإيقاظ.
function glueFor(sp) {
  var g = { sp: sp, timer: null, accum: null, retryTimer: null };
  function synth() { var s = {}; s[sp.keys.meta] = {}; return s; }
  g.after = function (res) {
    if (!res || !res.retryAt) return;
    var wait = Math.max(1000, res.retryAt - Date.now());
    var kind = res.retry, epoch = adminEpoch;
    if (g.retryTimer) clearTimeout(g.retryTimer);
    g.retryTimer = setTimeout(function () {
      g.retryTimer = null;
      if (epoch !== adminEpoch) return;
      var p = kind === "sync" ? sp.handleSyncChange(syncEnv, synth()) : sp.handleLocalChange(syncEnv, null);
      p.then(g.after).catch(function () {});
    }, wait);
  };
  g.arm = function (acc) {
    if (g.timer) clearTimeout(g.timer);
    var epochQ = adminEpoch;
    g.timer = setTimeout(function () {
      g.timer = null;
      if (epochQ !== adminEpoch) return;
      var a = g.accum;
      g.accum = null;
      sp.handleLocalChange(syncEnv, a).then(g.after).catch(function () {});
    }, CMLConst.SYNC_PUSH_DEBOUNCE_MS);
  };
  g.queue = function (changes) {
    var L = sp.L, watched = [L.overrides, L.patterns];
    // إزالةٌ جاءت من إعادة ضبط هذا الموقع (المساحة معلَّمة، والمفتاحان غائبان بعد الحدث): تُهمَل —
    // لا شواهد حذفٍ ولا طابع ولا مؤقّت. وأيُّ كتابةٍ فيها قيمةٌ (تبنّي السحابة، أو تعديلٌ جديد) تمرّ
    if (isResetting(sp.id) && watched.some(function (k) { return !!changes[k]; }) &&
        watched.every(function (k) { return !changes[k] || changes[k].newValue === undefined; })) return;
    for (var i = 0; i < watched.length; i++) {
      var k = watched[i];
      if (!changes[k]) continue;
      if (!g.accum) g.accum = {};
      if (!g.accum[k]) g.accum[k] = { oldValue: changes[k].oldValue, newValue: changes[k].newValue };
      else g.accum[k].newValue = changes[k].newValue;
    }
    // ★ شواهدُ الحذف تُحسب هنا وتُكتب دائمةً مع الطابع في كتابةٍ واحدة: الفرقُ لا يُستخرج
    // إلا من هذا الحدث نفسِه (oldValue لا أثر له بعده) — وتحت قفل دفتر المساحة الواحد
    var removed = [];
    if (changes[L.overrides]) removed = CMLSync.diffRemovedKeys(changes[L.overrides].oldValue, changes[L.overrides].newValue);
    if (changes[L.patterns]) {
      removed = removed.concat(CMLSync.diffRemovedRules(changes[L.patterns].oldValue, changes[L.patterns].newValue));
    }
    var stamp = Date.now();
    if (removed.length) sp.recordTombs(syncEnv, removed, stamp).catch(function () {});
    else { var o2 = {}; o2[L.pending] = stamp; chrome.storage.local.set(o2, function () { void chrome.runtime.lastError; }); }
    g.arm();
  };
  // طابعٌ كتبه اللبّ نفسُه (إصلاحُ سحابةٍ ممزّقة مثلًا): سلّح له مؤقّتًا وإلا نام إلى الإقلاع التالي
  g.poke = function () {
    if (syncEnabled === false || g.timer) return;
    g.timer = setTimeout(function () {
      g.timer = null;
      sp.handleLocalChange(syncEnv, null).then(g.after).catch(function () {});
    }, CMLConst.SYNC_PUSH_DEBOUNCE_MS);
  };
  g.cancel = function () {
    if (g.timer) { clearTimeout(g.timer); g.timer = null; }
    if (g.retryTimer) { clearTimeout(g.retryTimer); g.retryTimer = null; }
    g.accum = null;
  };
  // سحبُ لقطة السحابة ودمجُها الآن (بعد إعادة ضبط الموقع بلا مسح)
  g.pull = function () {
    return sp.handleSyncChange(syncEnv, synth()).then(g.after).catch(function () {});
  };
  // فحص الإيقاظ لهذه المساحة (r يحمل مفاتيحها):
  //   ١) علامةُ «حدثُ سحابةٍ لم يُدمج»: أُجّل لانشغال القفل ثم مات العامل ⇒ دمجٌ الآن.
  //   ٢) موعدُ تثبّتٍ من سحابةٍ رُئيت ممزّقة: حان ⇒ فحصٌ الآن، وإلا فمؤقّتٌ لبقيّته.
  //   ٣) طابعٌ معلّق: أقدم من المهلة ⇒ دفعٌ فوري، وأحدث ⇒ مؤقّتٌ لبقيّة المهلة.
  g.wake = function (r) {
    var L = sp.L;
    var dirty = r[L.dirty], recheck = r[L.recheck];
    if (dirty || (recheck && recheck <= Date.now())) {
      sp.handleSyncChange(syncEnv, synth())
        .then(function (res) {
          g.after(res);
          return dirty && res && res.done !== "read-error" ? sp.clearDirty(syncEnv) : null;
        })
        .catch(function () {});
    } else if (recheck) {
      g.after({ retry: "sync", retryAt: recheck });
    }
    var t = r[L.pending];
    if (!t) return;
    var waited = Date.now() - t;
    if (waited > CMLConst.SYNC_WAKE_GRACE_MS) {
      sp.handleLocalChange(syncEnv, null).then(g.after).catch(function () {});
    } else if (!g.timer) {
      g.timer = setTimeout(function () {
        g.timer = null;
        sp.handleLocalChange(syncEnv, null).then(g.after).catch(function () {});
      }, CMLConst.SYNC_WAKE_GRACE_MS - waited);
    }
  };
  return g;
}
var GLUES = CMLSync.spaces.map(glueFor);
function cancelAllSyncTimers() { GLUES.forEach(function (g) { g.cancel(); }); }

function syncQueue(changes) {
  if (syncEnabled === false) return; // بلا موافقة لا طابع ولا مؤقّت ولا كتابة
  if (syncEnabled === null) {
    // نافذةُ إقلاعٍ لم يُقرأ فيها العلم بعد: نقرؤه ثم نُعاود — الكتابةُ على الشك
    // كانت تُبقي ما أزالته المعالجةُ الثامنة (طابعٌ في كل حفظٍ بلا مزامنةٍ أصلًا)
    chrome.storage.local.get([CMLConst.K.SYNC_ENABLED], function (r) {
      void chrome.runtime.lastError;
      syncEnabled = !!(r && r[CMLConst.K.SYNC_ENABLED] === true);
      if (syncEnabled) syncQueue(changes);
    });
    return;
  }
  var all = !Object.keys(changes).length; // لحظة الموافقة: مزامنةٌ أولى لكل المساحات
  GLUES.forEach(function (g) {
    if (all || changes[g.sp.L.overrides] || changes[g.sp.L.patterns]) g.queue(changes);
  });
}

chrome.storage.onChanged.addListener(function (changes, area) {
  // المرآة تبقى حيّة: التبويب الساقط إلى الطبقة القديمة يكتب المفتاح، فنراه فورًا
  if (changes[CMLConst.K.SCAN_CLAIM]) legacyClaim = changes[CMLConst.K.SCAN_CLAIM].newValue || null;
  if (area === "local") {
    // الخط: تغيّر الاختيار، أو حُذفت النسخة (إعادة الضبط) أو تغيّرت — والدور يقرأ الحاضر فيكتب ما يلزم أو لا شيء
    if (changes[CMLConst.K.FONT] || changes[CMLConst.K.FONT_DATA]) ensureFontCache();
    // العلم المخبوء يُحدَّث أولًا: لحظةُ الموافقة نفسها تمرّ من هنا قبل syncQueue
    if (changes[CMLConst.K.SYNC_ENABLED]) {
      syncEnabled = changes[CMLConst.K.SYNC_ENABLED].newValue === true;
    }
    var touched = GLUES.some(function (g) { return changes[g.sp.L.overrides] || changes[g.sp.L.patterns]; });
    if (touched) {
      syncQueue(changes);
    } else if (changes[CMLConst.K.SYNC_ENABLED] && changes[CMLConst.K.SYNC_ENABLED].newValue === true) {
      // لحظة الموافقة: مزامنة أولى فورية (سحبُ ما في السحابة ودمجُه ثم دفعُ الاتحاد)
      syncQueue({});
    }
    GLUES.forEach(function (g) {
      var pc = changes[g.sp.L.pending];
      if (!touched && pc && pc.newValue) g.poke();
    });
  } else if (area === "sync") {
    GLUES.forEach(function (g) {
      for (var k in changes) {
        if (Object.prototype.hasOwnProperty.call(changes, k) && g.sp.owns(k)) {
          g.sp.handleSyncChange(syncEnv, changes).then(g.after).catch(function () {});
          return;
        }
      }
    });
  }
});

function syncWakeCheck() {
  var keys = [CMLConst.K.SYNC_ENABLED];
  GLUES.forEach(function (g) { var L = g.sp.L; keys.push(L.pending, L.dirty, L.recheck); });
  chrome.storage.local.get(keys, function (r) {
    if (chrome.runtime.lastError) return; // لا قراءة ⇒ لا حكم؛ الحدث التالي يعيد الكرّة
    syncEnabled = !!(r && r[CMLConst.K.SYNC_ENABLED] === true);
    if (!syncEnabled) return;
    GLUES.forEach(function (g) { g.wake(r || {}); });
  });
}
syncWakeCheck();
