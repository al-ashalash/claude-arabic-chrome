/* cml-sync.js — قلب المزامنة الاختيارية (المرحلة ٦): المنطق كله هنا، والغراء في sw.js.
 *
 * هذا الملف هو المصدر الواحد لعقد المزامنة. ما يُزامَن: تصحيحات المستخدم
 * (cml_overrides) وقواعده الذكية (cml_user_patterns) فقط — الإعدادات محلية لكل جهاز.
 *
 * صيغة اللقطة في chrome.storage.sync:
 *   - الحمولة تُحوَّل نصَّ JSON قانونيًّا (مفاتيح اللغات ثم مفاتيح التصحيحات مرتّبةً؛
 *     القواعد مصفوفةً كما هي) ثم تُشرَّح تحت cml_syncd_0..N بحيث لا يتجاوز
 *     (المفتاح + قيمة JSON) بايتاتِ SYNC_ITEM_BYTES للشريحة، والمجموعُ SYNC_TOTAL_BYTES.
 *   - cml_syncmeta: {v:1, rev, at, device, count, hash, chunks}.
 *
 * قاعدة الكتابة الممزّقة: الميتا تُكتب **آخِرًا** (الشرائح ثم الميتا ثم حذفُ الفائض).
 *   القارئ لا يثق إلا بلقطة ميتاها متّسقة: شريحة مفقودة أو بصمة أو عدّ لا يطابقان
 *   ⇒ ليست لقطةً أصلًا (unpack تعيد null بصمت) — فالكتابة الجزئية لا تُفسد أحدًا،
 *   والدفعة التالية تصلحها.
 *
 * التعارض على مستوى المجموعة (حدٌّ مقبول موثّق): لا نحفظ وقتًا لكل تصحيح، بل
 *   للمجموعة كلها — من كان طابعُه (at) أحدثَ فقيمتُه تفوز عند اختلاف قيمتَي مفتاحٍ
 *   واحد. ثمن ذلك: تعديلان متزامنان حقًّا (في نافذة انتشار السحابة) قد يَغلب
 *   أحدُهما الآخرَ في قيمة المفتاح المشترك — نادرٌ ومقبول. أما **وجودُ** العنصر
 *   فاتحادٌ بالهوية لا حسمٌ جملي: التصحيحات بمفتاحها، والقواعد بمفتاح هويتها (re).
 *
 * هوية القاعدة: {en, re, ar} من CMLShared.makePattern — وre هو مُعرّفها المستقر
 *   (صفحة الإعدادات نفسها تُحدِّث القاعدة بمطابقة re في الحفظ والاستيراد سواء).
 *   ★ كان الدمج يأخذ مصفوفة القواعد كلًّا من الطرف الأحدث، فقواعد الجهاز الآخر
 *   تُمحى بلا رجعة (ثلاثُ قواعد محلية + قاعدةٌ بعيدة أحدثُ = قاعدةٌ واحدة).
 *   وترتيبُ الناتج قانوني (الأخصُّ أولًا ثم المفتاح أبجديًّا) لا ترتيبَ إدخال:
 *   ترتيبان مختلفان لمجموعةٍ واحدة = بصمتان مختلفتان = تقاذفُ دفعاتٍ بلا نهاية.
 *
 * شواهد الحذف (tombs) دفترٌ محلي فقط — لا تُرفع للسحابة: {"<لغة>|<مفتاح>": وقتُ الحذف}
 *   للتصحيحات، و{"#p|<re>": وقتُ الحذف} للقواعد — الحذفان على قدمٍ واحدة.
 *   الحذف ينتشر بالغياب: الجهاز الحاذف يدفع لقطةً أحدثَ بلا المفتاح، والمستقبِل
 *   يُسقط ما عنده مما غاب عنها (إن كانت أحدثَ من آخر تعديل محلي). والشاهد يحمي
 *   الحذفَ المحلي من لقطةٍ بعيدة أقدمَ تعيد المفتاح: شاهدٌ أحدثُ من at اللقطة
 *   ⇒ يبقى محذوفًا. يُشذَّب الدفتر بعمر SYNC_TOMB_TTL_MS وسقف SYNC_TOMB_MAX.
 *
 * سباق القراءة-التعديل-الكتابة: بين قراءة cml_overrides وكتابةِ نتيجة الدمج جولةٌ
 *   إلى السحابة — وتصحيحٌ يحفظه المستخدم في تلك الأثناء كان يُدهس ويُسجَّل له شاهدُ
 *   حذفٍ كاذب. فتُعاد القراءة قُبيل الكتابة مباشرةً وتُسنَد نتيجةُ الدمج عليها:
 *   ما تغيّر محليًّا (إضافةً أو تعديلًا أو حذفًا) يفوز، ولا شاهدَ لمفتاحٍ حاضر.
 *
 * الكتابة الممزّقة والإصلاح: ترتيبُ الكتابة يحمي القارئ من لقطةٍ نصفِ مكتوبة، لكنه
 *   لا يحمي من كاتبين متشابكين (شرائح أ، شرائح ب، ميتا ب، ميتا أ ⇒ ميتا فوق شرائح
 *   غيرها) — وكلاهما ظنّ أنه أفلح فلا أحد يُصلح. فالقارئ مصلحٌ أيضًا: unpack=null
 *   وقد سبقت لنا مزامنة (lasthash) ⇒ يُطبع طابعٌ معلّق فتُدفع لقطةٌ متّسقة،
 *   بحارسٍ من دورة الإصلاح (لا إصلاح مع طابعٍ معلّق قائم، ولا إصلاحان في
 *   أقلَّ من SYNC_REPAIR_MIN_MS).
 *
 * حارسا الصدى (كي لا تدور الدفعات على نفسها):
 *   ١) cml_sync_lasthash (محلي): بصمةُ آخر حالة طابقت السحابة — تغيّرٌ محلي بصمته
 *      هي هي ⇒ صدى دمجٍ كتبناه نحن، فلا دفع.
 *   ٢) cml_sync_device (محلي): هوية الجهاز — حدثُ sync ميتاه بهويتنا ⇒ صدى دفعتنا.
 *
 * رقم الدفعة: rev = max(rev البعيد, rev آخر دفعةٍ لنا) + 1. وقبل كل دفعٍ يُدمَج
 *   البعيدُ غيرُ المدموج أولًا — فالدفع لا يدهس بيانات جهازٍ آخر أبدًا.
 *
 * تجاوز الحصة: fits:false من pack ⇒ لا كتابة للسحابة، وتُكتب الحال محليًّا
 *   {status:"overflow", need, at} في cml_sync_state لتعرضها صفحة الإعدادات
 *   (وعند النجاح {status:"ok", bytes, count, at, rev}، وعند فشل كتابة السحابة
 *   {status:"error", error, at} مع بقاء cml_sync_pending فيُعاد الدفع عند الإيقاظ).
 *
 * نقاء: لا chrome.* هنا إطلاقًا — الدالتان handleLocalChange/handleSyncChange
 *   تأخذان بيئةً env = {getLocal(keys,cb), setLocal(obj,cb), getSyncAll(cb),
 *   setSync(obj,cb), removeSync(keys,cb), now()} — أخطاء الكتابة تصل cb أولَ وسيط
 *   (null = نجاح). فتختبرها الصفحات بقشرة مقلّدة كما تستهلكها sw.js ببيئة حقيقية.
 *
 * ثنائي الاستخدام: لا import/export — يفترض تحميل cml-const.js قبله (كترتيب
 *   importScripts في sw.js ومانيفست فايرفوكس سواء).
 */
(function (g) {
  "use strict";
  var C = g.CMLConst;
  var K = C.K;

  // ---- أدوات صغيرة ----------------------------------------------------------

  // طول النص بايتاتِ UTF-8 — حصص كروم بالبايت لا بالحرف (والعربية حرفها بايتان)
  function byteLen(s) {
    if (typeof TextEncoder === "function") return new TextEncoder().encode(s).length;
    // بديل البيئات العتيقة: encodeURIComponent يفكّ الحرف لبايتاته المئوية
    return unescape(encodeURIComponent(s)).length;
  }

  // ★ كروم لا يزن الحصة بـJSON.stringify الذي عندنا، بل بكاتبِ JSON الخاص به —
  // وهو يهرّب «<» و«>» وفاصلَي السطر U+2028/U+2029 إلى ستّ بايتات على صورة u003C.
  // فحمولةٌ كثيفةُ الأقواس الزاويّة (وسمُ HTML في تصحيح، أو قاعدةٌ فيها وسم) كانت
  // تمرّ من فحصنا ويرفضها كروم عند 8192 بايت. نزنُ كما يزن هو: نهرّب قبل القياس.
  var CHROME_ESC = /[<>\u2028\u2029]/g;
  function chromeEsc(c) {
    return "\\u" + ("000" + c.charCodeAt(0).toString(16).toUpperCase()).slice(-4);
  }
  // بايتات قيمةٍ كما يحسبها كروم لحصته (JSON بتهريبه هو، بايتات UTF-8)
  function jsonBytes(v) { return byteLen(JSON.stringify(v).replace(CHROME_ESC, chromeEsc)); }

  // FNV-1a (32 بت) على وحدات الترميز — نسخة محلية عمدًا: لا اعتماد على CMLRtl
  function fnv1a(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      // الضرب في 0x01000193 بجمع إزاحات — يبقى في حساب 32 بت الصحيح فلا يفقد دقة
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }

  // النص القانوني للحمولة: {"o":{لغات مرتبة:{مفاتيح مرتبة}},"p":[القواعد كما هي]}
  // — الترتيب يجعل البصمة والتشريح مستقرَّين مهما اختلف ترتيب المفاتيح في الذاكرة
  function canon(payload) {
    var o = (payload && payload.overrides) || {};
    var p = (payload && payload.patterns) || [];
    var langs = Object.keys(o).sort();
    var parts = [];
    for (var i = 0; i < langs.length; i++) {
      var m = o[langs[i]] || {};
      var keys = Object.keys(m).sort();
      if (!keys.length) continue; // لغة فارغة ضجيج تمثيلي — إسقاطها يوحّد الشكلين
      var kv = [];
      for (var j = 0; j < keys.length; j++) {
        kv.push(JSON.stringify(keys[j]) + ":" + JSON.stringify(m[keys[j]]));
      }
      parts.push(JSON.stringify(langs[i]) + ":{" + kv.join(",") + "}");
    }
    return '{"o":{' + parts.join(",") + '},"p":' + JSON.stringify(p) + "}";
  }

  function hashPayload(payload) { return fnv1a(canon(payload)); }

  // عدّ العناصر (تصحيحات كل اللغات + القواعد) — يدخل الميتا ويُفحص عند القراءة
  function countPayload(payload) {
    var o = (payload && payload.overrides) || {};
    var n = ((payload && payload.patterns) || []).length;
    for (var lang in o) {
      if (Object.prototype.hasOwnProperty.call(o, lang)) n += Object.keys(o[lang] || {}).length;
    }
    return n;
  }

  // ---- التغليف والفك --------------------------------------------------------

  // أكبر عدد أحرف من json بدءًا من pos تبقى شريحتُه (مفتاحًا + قيمة JSON) تحت السقف.
  // بحث ثنائي: البايتات رتيبة مع الطول، وhi مقصوص بالسقف (البايتات ≥ الأحرف دائمًا)
  function sliceLen(json, pos, keyBytes) {
    var lo = 1, hi = Math.min(json.length - pos, C.SYNC_ITEM_BYTES), best = 1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var b = keyBytes + jsonBytes(json.substr(pos, mid));
      if (b <= C.SYNC_ITEM_BYTES) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return best;
  }

  // pack(payload, opt {rev, device, now, prevChunks}) → {sets, removes, bytes, fits, need, meta}
  // sets تضم الميتا لكن العقدَ على الكاتب: الشرائح أولًا ثم الميتا (انظر رأس الملف)
  function pack(payload, opt) {
    opt = opt || {};
    var json = canon(payload);
    var sets = {};
    var total = 0;
    var i = 0, pos = 0;
    while (pos < json.length) {
      var key = K.SYNC_CHUNK_PREFIX + i;
      var kb = byteLen(key);
      var n = sliceLen(json, pos, kb);
      var slice = json.substr(pos, n);
      sets[key] = slice;
      total += kb + jsonBytes(slice);
      pos += n;
      i++;
    }
    var meta = {
      v: 1,
      rev: opt.rev || 1,
      at: opt.now || 0,
      device: opt.device || "",
      count: countPayload(payload),
      hash: fnv1a(json),
      chunks: i,
    };
    sets[K.SYNC_META] = meta;
    total += byteLen(K.SYNC_META) + jsonBytes(meta);
    // الشرائح الفائضة من لقطة أطول سابقة — القارئ يتجاهلها (الميتا لا تعدّها)
    // لكن تركها يأكل الحصة المشتركة
    var removes = [];
    var prev = opt.prevChunks || 0;
    for (var r = i; r < prev; r++) removes.push(K.SYNC_CHUNK_PREFIX + r);
    var fits = total <= C.SYNC_TOTAL_BYTES;
    return { sets: sets, removes: removes, bytes: total, fits: fits, need: total, meta: meta };
  }

  // unpack(لقطة sync كاملة) → {payload, meta} أو null — الممزّق والناقص «لا لقطة» بصمت
  function unpack(snap) {
    if (!snap) return null;
    var meta = snap[K.SYNC_META];
    if (!meta || meta.v !== 1 || typeof meta.chunks !== "number" || meta.chunks < 0) return null;
    var json = "";
    for (var i = 0; i < meta.chunks; i++) {
      var c = snap[K.SYNC_CHUNK_PREFIX + i];
      if (typeof c !== "string") return null; // شريحة مفقودة = كتابة لم تكتمل
      json += c;
    }
    var parsed;
    try { parsed = JSON.parse(json); } catch (e) { return null; }
    if (!parsed || typeof parsed !== "object") return null;
    var payload = { overrides: parsed.o || {}, patterns: parsed.p || [] };
    if (typeof payload.overrides !== "object" || !Array.isArray(payload.patterns)) return null;
    if (hashPayload(payload) !== meta.hash) return null;  // ميتا قديمة فوق شرائح جديدة أو العكس
    if (countPayload(payload) !== meta.count) return null;
    return { payload: payload, meta: meta };
  }

  // ★ (مراجعة الأمن) اللقطة البعيدة كانت تُدمَج حرفيًّا بلا فحصٍ لمحتواها: قاعدةٌ عدائية
  // من جهازٍ آخر (أو حسابٍ اختُرق) تصل المحرّك فيركّبها new RegExp متجاوزةً كلَّ حرّاس
  // makePattern — تراجعٌ أسّيٌّ يجمّد تبويب claude.ai، أو ar غير نصّيّ يقتل المحرّك
  // بـTypeError — ثم تُدفع اللقطةُ المسمومة لكل الأجهزة بهوية الجهاز السليم.
  // القاعدة: القاعدةُ لا تُقبل إلا إذا أعاد makePattern توليدَها من (en, ar) وطابق re
  // المخزَّن — فلا يصل new RegExp إلا ما كان حارسُنا نفسُه ليولّده. والتصحيحُ نصٌّ إلى
  // نصٍّ بطولٍ معقول تحت لغةٍ برمزٍ صحيح، وأسماءُ الأعضاء الموروثة مرفوضة.
  var LANG_RE = /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/;
  var TEXT_CAP = (C && C.TEXT_MAX) || 300;
  function sanitizePayload(payload) {
    var shared = g.CMLShared;
    var o = {}, src = (payload && payload.overrides) || {};
    for (var lang in src) {
      if (!own(src, lang) || !LANG_RE.test(lang)) continue;
      var m = src[lang];
      if (!m || typeof m !== "object" || Array.isArray(m)) continue;
      var out = null;
      for (var k in m) {
        if (!own(m, k) || k === "__proto__" || k === "constructor" || k === "prototype") continue;
        var v = m[k];
        if (!k || typeof v !== "string" || k.length > TEXT_CAP || v.length > TEXT_CAP * 2) continue;
        if (!out) out = {};
        out[k] = v;
      }
      if (out) o[lang] = out;
    }
    var p = [], srcP = Array.isArray(payload && payload.patterns) ? payload.patterns : [];
    for (var i = 0; i < srcP.length; i++) {
      var r = srcP[i];
      if (!r || typeof r !== "object" || typeof r.en !== "string" || typeof r.ar !== "string") continue;
      if (r.en.length > TEXT_CAP || r.ar.length > TEXT_CAP * 2) continue;
      if (!shared || typeof shared.makePattern !== "function") continue; // بلا حارس لا قاعدة
      // المخزَّن يحمل ar بصيغة القالب ($1 $2) وmakePattern يستقبل صيغة {الاسم}: نُعيد بناء
      // صيغة الإدخال من أسماء متغيّرات en بترتيبها، ونطالب بتطابق re وar معًا مع ما يولّده
      var names = [], vm, VR = new RegExp(shared.VAR_RE.source, "g");
      while ((vm = VR.exec(r.en))) names.push(vm[1]);
      var badRef = false;
      var arIn = r.ar.replace(/\$(\d)/g, function (t, g2) {
        var nm = names[+g2 - 1];
        if (nm === undefined) { badRef = true; return t; }
        return "{" + nm + "}";
      });
      if (badRef) continue;
      var gen = shared.makePattern(r.en, arIn);
      if (!gen || gen.ar !== r.ar) continue;
      if (typeof r.re === "string" && r.re !== gen.re) continue; // re مدسوسٌ لا يولّده الحارس
      p.push(gen);
    }
    return { overrides: o, patterns: p };
  }

  // ---- الدمج ----------------------------------------------------------------

  // اختصارٌ للقراءة في الكود الجديد وحده (الباقي على صيغته الصريحة كما كُتب)
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o || {}, k); }

  // بادئة شواهد حذف القواعد — تفصلها عن شواهد التصحيحات "<لغة>|<مفتاح>"
  // (رمز اللغة لا يكون "#p" أبدًا: القائمة عندنا في القاموس)
  var RULE_TOMB = "#p|";

  // هوية القاعدة المستقرة: re هو مُعرّفها في صفحة الإعدادات نفسها (الحفظ والاستيراد
  // كلاهما يُحدِّث القاعدة بمطابقة re)، وما جاء بلا re (ملفٌ يدوي أو بناءٌ قديم)
  // يُعرَّف بتمثيله النصي — هويةٌ مستقرة أيضًا ما دام محتواه هو هو
  function ruleKey(p) {
    if (p && typeof p.re === "string" && p.re) return p.re;
    return "~" + JSON.stringify(p === undefined ? null : p);
  }
  function sameRule(a, b) { return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b); }

  // طول النص الثابت — معيار التخصيص نفسه في CMLShared.sortBySpecificity (لا نستورده:
  // الملف ثنائي الاستخدام وعاملُ الخدمة لا يحمّل cml-shared.js)
  function ruleLiteralLen(p) { return String((p && p.en) || "").replace(/\{[^{}]*\}/g, "").length; }

  // ترتيبٌ قانوني للقواعد: الأخصُّ أولًا (كما يتوقّع المحرّك)، وعند التساوي فالمفتاح
  // أبجديًّا. الحسم بالمفتاح لا بترتيب الإدخال شرطُ التقارب: لو رتّب كلُّ جهازٍ
  // الاتحادَ بترتيب إدخاله لاختلفت البصمتان فتقاذف الجهازان الدفعات بلا نهاية.
  function sortRules(list) {
    return list.map(function (p, i) { return { p: p, k: ruleKey(p), i: i }; })
      .sort(function (a, b) {
        return (ruleLiteralLen(b.p) - ruleLiteralLen(a.p)) ||
               (a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i);
      })
      .map(function (x) { return x.p; });
  }

  // شذّب الشواهد: أسقط ما جاوز العمر، وعند تجاوز السقف أسقط الأقدم أولًا
  function pruneTombs(tombs, nowMs) {
    var out = {};
    var keys = [];
    for (var k in tombs) {
      if (!Object.prototype.hasOwnProperty.call(tombs, k)) continue;
      var t = tombs[k];
      if (typeof t !== "number" || nowMs - t > C.SYNC_TOMB_TTL_MS) continue;
      out[k] = t;
      keys.push(k);
    }
    if (keys.length > C.SYNC_TOMB_MAX) {
      keys.sort(function (a, b) { return out[a] - out[b]; });
      for (var i = 0; i < keys.length - C.SYNC_TOMB_MAX; i++) delete out[keys[i]];
    }
    return out;
  }

  // مفاتيح اختفت بين كتابتَي cml_overrides — ليسجّلها العامل شواهدَ حذف
  function diffRemovedKeys(oldOv, newOv) {
    oldOv = oldOv || {};
    newOv = newOv || {};
    var removed = [];
    for (var lang in oldOv) {
      if (!Object.prototype.hasOwnProperty.call(oldOv, lang)) continue;
      var om = oldOv[lang] || {};
      var nm = newOv[lang] || {};
      for (var k in om) {
        if (Object.prototype.hasOwnProperty.call(om, k) &&
            !Object.prototype.hasOwnProperty.call(nm, k)) {
          removed.push(lang + "|" + k);
        }
      }
    }
    return removed;
  }

  // قواعد اختفت بين كتابتَي cml_user_patterns — شواهدها كشواهد التصحيحات سواء،
  // فحذفُ قاعدةٍ على جهازٍ لا يُحييه دمجٌ بلقطةٍ أقدم
  function diffRemovedRules(oldPats, newPats) {
    var have = {}, removed = [], i, k;
    for (i = 0; i < (newPats || []).length; i++) have[ruleKey(newPats[i])] = 1;
    for (i = 0; i < (oldPats || []).length; i++) {
      k = ruleKey(oldPats[i]);
      if (!have[k] && removed.indexOf(RULE_TOMB + k) < 0) removed.push(RULE_TOMB + k);
    }
    return removed;
  }

  // شاهدُ حذفٍ لمفتاحٍ عاد حاضرًا لا معنى له — ويزاحم غيرَه على سقف الدفتر (٢٠٠)
  function dropTombsPresent(tombs, overrides, patterns) {
    var live = {}, out = {}, lang, k, i;
    for (lang in overrides || {}) {
      if (!own(overrides, lang)) continue;
      var m = overrides[lang] || {};
      for (k in m) { if (own(m, k)) live[lang + "|" + k] = 1; }
    }
    for (i = 0; i < (patterns || []).length; i++) live[RULE_TOMB + ruleKey(patterns[i])] = 1;
    for (k in tombs) { if (own(tombs, k) && !live[k]) out[k] = tombs[k]; }
    return out;
  }

  // mergeIn(المحلي {overrides, patterns, tombs, at?, everSynced?}, البعيد {payload, meta}, الآن)
  //   → {overrides, patterns, tombs, changedLocal}
  // at المحلي: آخر تعديل/دفع محلي (يُشتق في handleSyncChange من state.at وpending).
  // everSynced: هل سبق لهذا الجهاز أن طابق السحابة (lasthash موجود)؟ قبل أول مطابقة
  //   لا معنى لانتشار الحذف بالغياب — فالدمج الأول اتحادٌ صِرف لا يُسقط شيئًا محليًّا.
  function mergeIn(local, remote, nowMs) {
    // ★ التعقيم على باب الدمج لا في unpack: unpack سلامةُ كتابةٍ (بصمتُه بصمةُ السحابة
    // فيصدق حارسُ الصدى)، وما يُقبل إلى التخزين المحلي هو المعقَّم وحده
    if (remote && remote.payload) remote = { payload: sanitizePayload(remote.payload), meta: remote.meta };
    var lo = (local && local.overrides) || {};
    var lp = (local && local.patterns) || [];
    var tombs = pruneTombs((local && local.tombs) || {}, nowMs);
    var lAt = (local && local.at) || 0;
    var ever = !!(local && local.everSynced);
    var ro = (remote && remote.payload && remote.payload.overrides) || {};
    var rp = (remote && remote.payload && remote.payload.patterns) || [];
    var rAt = (remote && remote.meta && remote.meta.at) || 0;
    var localWins = lAt > rAt; // مستوى المجموعة — الحد المقبول الموثّق في الرأس
    // ★ حارس انحراف الساعة (دحضٌ مؤكد): لقطةٌ طابعُها في المستقبل بعيدًا تعني ساعةَ
    // جهازٍ منحرفة — وحينها يصير «الحذف بالغياب» صادقًا أبدًا فتُمحى تصحيحاتُ الجهاز
    // السليم في كل دمج بلا رجعة. فلا نأتمن حداثةَ لقطةٍ كهذه على **الحذف** (يبقى
    // الاتحاد فلا يضيع شيء)، ونُبقي حسمَها لتعارض القيم كما هو — إذ عكسُه يكسر
    // التقارب (كلا الطرفين يرى نفسه فائزًا فيتقاذفان بلا نهاية).
    var trustRecency = rAt <= nowMs + C.SYNC_SKEW_TOLERANCE_MS;

    var out = {};
    var seen = {};
    var lang;
    for (lang in lo) { if (Object.prototype.hasOwnProperty.call(lo, lang)) seen[lang] = 1; }
    for (lang in ro) { if (Object.prototype.hasOwnProperty.call(ro, lang)) seen[lang] = 1; }
    for (lang in seen) {
      var lm = lo[lang] || {};
      var rm = ro[lang] || {};
      var om = {};
      var k;
      for (k in lm) {
        if (!Object.prototype.hasOwnProperty.call(lm, k)) continue;
        if (Object.prototype.hasOwnProperty.call(rm, k)) {
          // موجود في الطرفين: قيمتان مختلفتان يحسمهما طابع المجموعة الأحدث
          om[k] = localWins ? lm[k] : rm[k];
        } else if (!ever || localWins || !trustRecency) {
          // محليٌّ فقط: إضافة لم تُدفع بعد (أو جهاز لم يزامن قط، أو لقطةٌ لا نأتمن
          // حداثتَها لانحراف ساعتها) — تبقى
          om[k] = lm[k];
        }
        // وإلا: اللقطة البعيدة أحدث وقد غاب عنها — حُذف على جهاز آخر فيسقط هنا
        // (العامل سيسجّل له شاهدًا من فرق الكتابة المحلية — توثيقٌ صحيح لا ضرر منه)
      }
      for (k in rm) {
        if (!Object.prototype.hasOwnProperty.call(rm, k)) continue;
        if (Object.prototype.hasOwnProperty.call(lm, k)) continue;
        var tk = lang + "|" + k;
        // حذفناه بعد أن صُنعت هذه اللقطة ⇒ يبقى محذوفًا. ★ ولا يُستثنى من ذلك حين
        // لا تُؤتمن حداثةُ اللقطة: طابعٌ في المستقبل كان يُبطل كلَّ شاهدٍ فيُحيي
        // المحذوف، ثم يمحو الشاهدَ نفسه فلا يبقى للحذف أثرٌ يُحتجّ به أبدًا
        if (tombs[tk] && (!trustRecency || tombs[tk] > rAt)) continue;
        if (tombs[tk]) delete tombs[tk]; // اللقطة أحدث من الشاهد: المفتاح عاد عن قصد فالشاهد لغا
        om[k] = rm[k];
      }
      if (Object.keys(om).length) out[lang] = om;
    }

    // ★ القواعد تُدمج بالهوية كالتصحيحات (دحضٌ مؤكد: الأخذ الجملي من الطرف الأحدث
    // كان يمحو قواعد الجهاز الآخر جملةً — [L1,L2,L3] محليًّا مع [R1] بعيدًا أحدثَ
    // كان يُخرج [R1] وحدها، فثلاثُ قواعد للمستخدم تذهب بلا رجعة). المفتاح re،
    // والقيمة عند التعارض لصاحب الطابع الأحدث، والغياب عن لقطةٍ أحدثَ حذفٌ
    // ينتشر، والشاهدُ يحمي الحذفَ المحلي — أي عقدُ التصحيحات نفسه حرفًا.
    var outP;
    if (JSON.stringify(lp) === JSON.stringify(rp)) {
      outP = lp; // متطابقتان: لا حاجة حتى للترتيب — الطرفان سواء أصلًا
    } else {
      var lmap = {}, rmap = {}, seenR = {}, picked = [], i, rk;
      for (i = 0; i < lp.length; i++) { rk = ruleKey(lp[i]); if (!own(lmap, rk)) lmap[rk] = lp[i]; }
      for (i = 0; i < rp.length; i++) { rk = ruleKey(rp[i]); if (!own(rmap, rk)) rmap[rk] = rp[i]; }
      for (i = 0; i < lp.length; i++) {
        rk = ruleKey(lp[i]);
        if (seenR[rk]) continue;
        seenR[rk] = 1;
        if (own(rmap, rk)) picked.push(localWins ? lmap[rk] : rmap[rk]);
        else if (!ever || localWins || !trustRecency) picked.push(lmap[rk]);
        // وإلا: غابت عن لقطةٍ أحدث ⇒ حُذفت على جهازٍ آخر فتسقط هنا
      }
      for (i = 0; i < rp.length; i++) {
        rk = ruleKey(rp[i]);
        if (seenR[rk]) continue;
        seenR[rk] = 1;
        var rtk = RULE_TOMB + rk;
        if (tombs[rtk] && (!trustRecency || tombs[rtk] > rAt)) continue; // حذفناها بعد اللقطة
        if (tombs[rtk]) delete tombs[rtk];
        picked.push(rmap[rk]);
      }
      outP = sortRules(picked);
    }

    var changedLocal =
      hashPayload({ overrides: out, patterns: outP }) !== hashPayload({ overrides: lo, patterns: lp });
    return { overrides: out, patterns: outP, tombs: tombs, changedLocal: changedLocal };
  }

  // ★ إعادة إسناد نتيجة الدمج على قراءةٍ طازجة (سباق القراءة-التعديل-الكتابة، دحضٌ
  // مؤكد): بين قراءتنا الأولى وكتابتنا جولةٌ إلى السحابة، فتصحيحٌ يحفظه المستخدم في
  // تلك الأثناء كان يُدهس — ويسوء الأمر بشاهد حذفٍ كاذبٍ يسجّله فرقُ كتابتنا فيمنع
  // عودتَه أبدًا. القاعدة: base هو ما قرأناه، fresh ما هو الآن، وما تغيّر بينهما
  // فعلُ المستخدم للتوّ — فيفوز على نتيجة الدمج إضافةً وتعديلًا وحذفًا.
  function rebaseOverrides(merged, base, fresh) {
    // لم يمسّ المستخدمُ شيئًا في تلك الأثناء (الغالب): نتيجةُ الدمج كما هي بلا ضجيج
    if (hashPayload({ overrides: base, patterns: [] }) === hashPayload({ overrides: fresh, patterns: [] })) return merged;
    var out = {}, lang, k, m, c;
    for (lang in merged) { // نسخةٌ قابلة للتعديل بلا مسّ نتيجة الدمج
      if (!own(merged, lang)) continue;
      m = merged[lang] || {}; c = {};
      for (k in m) { if (own(m, k)) c[k] = m[k]; }
      out[lang] = c;
    }
    for (lang in base) { // حُذف محليًّا بعد قراءتنا: لا نُحييه
      if (!own(base, lang)) continue;
      var bm = base[lang] || {}, fm = fresh[lang] || {};
      for (k in bm) { if (own(bm, k) && !own(fm, k) && out[lang]) delete out[lang][k]; }
    }
    for (lang in fresh) { // أُضيف أو عُدّل محليًّا بعد قراءتنا: قيمتُه هي الحق
      if (!own(fresh, lang)) continue;
      var fm2 = fresh[lang] || {}, bm2 = base[lang] || {};
      for (k in fm2) {
        if (!own(fm2, k)) continue;
        if (!own(bm2, k) || bm2[k] !== fm2[k]) { out[lang] = out[lang] || {}; out[lang][k] = fm2[k]; }
      }
    }
    for (lang in out) { if (own(out, lang) && !Object.keys(out[lang]).length) delete out[lang]; }
    return out;
  }

  function rebaseRules(merged, base, fresh) {
    if (JSON.stringify(base || []) === JSON.stringify(fresh || [])) return merged; // لا تغيّر محلي
    var bmap = {}, fmap = {}, out = [], seen = {}, i, k;
    for (i = 0; i < (base || []).length; i++) bmap[ruleKey(base[i])] = base[i];
    for (i = 0; i < (fresh || []).length; i++) fmap[ruleKey(fresh[i])] = fresh[i];
    for (i = 0; i < (merged || []).length; i++) {
      k = ruleKey(merged[i]);
      if (seen[k]) continue;
      if (own(bmap, k) && !own(fmap, k)) continue; // حُذفت محليًّا للتوّ
      seen[k] = 1;
      // عُدّلت محليًّا للتوّ (المفتاح هو هو والمحتوى تغيّر) ⇒ نسخةُ المستخدم
      out.push(own(fmap, k) && !sameRule(fmap[k], bmap[k]) ? fmap[k] : merged[i]);
    }
    for (i = 0; i < (fresh || []).length; i++) { // أُضيفت محليًّا للتوّ
      k = ruleKey(fresh[i]);
      if (seen[k] || own(bmap, k)) continue;
      seen[k] = 1;
      out.push(fresh[i]);
    }
    return sortRules(out);
  }

  // ---- التوصيل (منطق كامل فوق env — بلا chrome) ------------------------------

  // مغلّفات وعود فوق نداءات cb — الأخطاء تصل رفضًا
  function pGetLocal(env, keys) {
    return new Promise(function (res) { env.getLocal(keys, function (r) { res(r || {}); }); });
  }
  function pSetLocal(env, obj) {
    return new Promise(function (res, rej) {
      env.setLocal(obj, function (err) { if (err) rej(new Error(err)); else res(); });
    });
  }
  function pGetSyncAll(env) {
    return new Promise(function (res) { env.getSyncAll(function (r) { res(r || {}); }); });
  }
  function pSetSync(env, obj) {
    return new Promise(function (res, rej) {
      env.setSync(obj, function (err) { if (err) rej(new Error(err)); else res(); });
    });
  }
  function pRemoveSync(env, keys) {
    return new Promise(function (res, rej) {
      env.removeSync(keys, function (err) { if (err) rej(new Error(err)); else res(); });
    });
  }

  // هوية الجهاز: تُنشأ مرة وتبقى — العشوائية تكفي (التصادم بين جهازَي مستخدمٍ واحد وهْم)
  function ensureDevice(env, have) {
    if (have && typeof have === "string") return Promise.resolve(have);
    var id = "d" + env.now().toString(36) + "-" + Math.floor(Math.random() * 0xffffffff).toString(36);
    return pSetLocal(env, keyed(K.SYNC_DEVICE, id)).then(function () { return id; });
  }

  function keyed(k, v) { var o = {}; o[k] = v; return o; }

  // كم شريحة قائمة في اللقطة فعلًا (لحساب الفائض الواجب حذفه) — أقصى فهرس + ١،
  // لا عدّ الميتا: ميتا ممزّقة لا يُركن إليها
  function chunkCountIn(snap) {
    var max = -1;
    for (var k in snap) {
      if (!Object.prototype.hasOwnProperty.call(snap, k)) continue;
      if (k.indexOf(K.SYNC_CHUNK_PREFIX) !== 0) continue;
      var n = parseInt(k.slice(K.SYNC_CHUNK_PREFIX.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
    return max + 1;
  }

  // قفل انشغال على مستوى الوحدة: العامل خيطٌ واحد لكن سلاسل الوعود تتشابك —
  // دفعتان متداخلتان تكرّران rev، فلا بدّ من القفل.
  //
  // ★ لكن الإسقاط الصامت للمتزاحم كان يبتلع **حدث السحابة** ابتلاعًا تامًّا (دحضٌ
  // مؤكد: تصحيحاتٌ تضيع على الجهازين): pending إنما يضمن دفعتَنا نحن، ولا أثر
  // البتّةَ لحدثٍ بعيدٍ أُسقط — فاللقطة البعيدة لا تُدمج أبدًا. فلا يُسقَط شيء:
  //   ١) عَلَمُ إعادةٍ في الذاكرة يستشيره المنتهي فيعيد النداء بعد أن يفرغ.
  //   ٢) وعلامةٌ دائمة (cml_sync_dirty) في التخزين المحلي تنجو من موت العامل،
  //      يلتقطها فحصُ الإيقاظ في sw.js فيعيد الدمج من اللقطة الحاضرة.
  // والقارئ يقرأ اللقطة الحاضرة لا لقطة لحظة الحدث، فحدثٌ اصطناعي يكفي لإعادة النداء.
  var busy = false;
  var rerunLocal = false, rerunSync = false;
  var dirtyMark = false;
  var DRAIN_MAX = 4; // سقفُ إعاداتٍ متتالية في نداءٍ واحد — وما زاد تلتقطه العلامة

  function markDirty(env) {
    if (dirtyMark) return Promise.resolve(); // كُتبت في هذه الحياة — لا تكرار كتابة
    // ★ العلم يُرفع **بعد** نجاح الكتابة لا قبلها: رفعُه أولًا كان يُسكت كلَّ تأجيلٍ
    // لاحقٍ بينما العلامةُ الدائمة غائبة (كتابةٌ أخفقت وابتُلع خطؤها) — فيضيع
    // مسارُ الاسترداد بعد موت العامل لبقيّة حياته.
    return pSetLocal(env, keyed(K.SYNC_DIRTY, 1)).then(function (err) {
      if (!err) dirtyMark = true;
    }, function () {});
  }
  function clearDirty(env) {
    dirtyMark = false;
    return pSetLocal(env, keyed(K.SYNC_DIRTY, 0)).catch(function () {});
  }

  function drain(env, left) {
    if (left <= 0) return Promise.resolve();
    if (rerunSync) {
      rerunSync = false;
      var synth = {}; synth[K.SYNC_META] = {}; // حدثٌ اصطناعي: المقروء هو اللقطة الحاضرة
      return runGuarded(syncCore, env, synth, left - 1);
    }
    if (rerunLocal) {
      rerunLocal = false;
      return runGuarded(localCore, env, null, left - 1);
    }
    return dirtyMark ? clearDirty(env) : Promise.resolve();
  }

  function runGuarded(fn, env, changes, left) {
    busy = true;
    return fn(env, changes).then(
      function (r) { busy = false; return drain(env, left).then(function () { return r; }); },
      function (e) { busy = false; return drain(env, left).then(function () { throw e; }); }
    );
  }

  function guarded(fn, kind) {
    return function (env, changes) {
      if (busy) {
        if (kind === "sync") rerunSync = true; else rerunLocal = true;
        return markDirty(env).then(function () { return { done: "deferred" }; });
      }
      return runGuarded(fn, env, changes, DRAIN_MAX);
    };
  }

  // اللبّ المحلي: يُستدعى بعد مهلة التجميع في العامل، وبـchanges=null عند الإيقاظ
  // (دفعة معلّقة مات العامل قبلها) وفي ذيل دمجِ syncCore
  function localCore(env, changes) {
    var L = [K.SYNC_ENABLED, K.OVERRIDES, K.USER_PATTERNS, K.SYNC_TOMBS,
             K.SYNC_LASTHASH, K.SYNC_STATE, K.SYNC_DEVICE, K.SYNC_PENDING];
    return pGetLocal(env, L).then(function (r) {
      // الموافقة تُقرأ طازجةً في كل مرة: «إعادة الضبط» تطفئ العلم والتصحيحات معًا
      // في كتابة واحدة — القراءة الطازجة هي ما يجعلها محليةً فعلًا فلا تُدفع للسحابة
      if (r[K.SYNC_ENABLED] !== true) {
        if (r[K.SYNC_PENDING]) return pSetLocal(env, keyed(K.SYNC_PENDING, 0)).then(function () {
          return { done: "disabled" };
        });
        return { done: "disabled" };
      }

      var now = env.now();
      var tombs = pruneTombs(r[K.SYNC_TOMBS] || {}, now);
      var tombsDirty = false;

      // تسجيل شواهد الحذف من فرق الكتابة (oldValue→newValue) قبل أي شيء —
      // بعد هذه اللحظة لا أثر للمفاتيح المحذوفة في أي مكان آخر. (وsw.js يكتبها
      // كذلك لحظةَ الحدث نفسِه قبل المؤقّت — فموتُ العامل بينهما لا يُضيّع حذفًا.)
      var removed = [], i;
      if (changes && changes[K.OVERRIDES]) {
        removed = diffRemovedKeys(changes[K.OVERRIDES].oldValue, changes[K.OVERRIDES].newValue);
      }
      if (changes && changes[K.USER_PATTERNS]) {
        removed = removed.concat(
          diffRemovedRules(changes[K.USER_PATTERNS].oldValue, changes[K.USER_PATTERNS].newValue));
      }
      for (i = 0; i < removed.length; i++) { tombs[removed[i]] = now; tombsDirty = true; }
      if (tombsDirty) tombs = pruneTombs(tombs, now);

      var overrides = r[K.OVERRIDES] || {};
      var patterns = r[K.USER_PATTERNS] || [];

      // شاهدُ ما عاد حاضرًا يُسقط: المفتاح أُعيد محليًّا فالشاهد لغوٌ يزاحم على السقف
      var live = dropTombsPresent(tombs, overrides, patterns);
      if (Object.keys(live).length !== Object.keys(tombs).length) { tombs = live; tombsDirty = true; }
      var lasthash = r[K.SYNC_LASTHASH];
      var state = r[K.SYNC_STATE] || {};
      // ★★ التعقيم على الطرفين لا على الوارد وحده: كان الدفعُ يغلّف الحمولة خامًا
      // فيرسل الجهازُ ما لا يقبله أيُّ جهاز (قيمةٌ فوق السقف مثلًا) — فتختلف البصمتان
      // أبدًا وتدور الدفعات بلا سكون (قِيس: 498 دفعةً متناوبة). فالمعقَّم هو ما نحسب
      // بصمتَه وما ندفعه معًا، فيصير نقطةً ثابتة يتّفق عليها الطرفان.
      var clean = sanitizePayload({ overrides: overrides, patterns: patterns });
      overrides = clean.overrides; patterns = clean.patterns;
      var curHash = hashPayload(clean);

      var pre = tombsDirty ? pSetLocal(env, keyed(K.SYNC_TOMBS, tombs)) : Promise.resolve();
      return pre.then(function () {
        // حارس الصدى ١: الحالة المحلية تطابق آخر ما زامنّاه — هذا صدى دمجٍ كتبناه
        if (curHash === lasthash) {
          if (r[K.SYNC_PENDING]) return pSetLocal(env, keyed(K.SYNC_PENDING, 0)).then(function () {
            return { done: "echo" };
          });
          return { done: "echo" };
        }
        return ensureDevice(env, r[K.SYNC_DEVICE]).then(function (device) {
          return pGetSyncAll(env).then(function (snap) {
            var remote = unpack(snap);
            var payload = { overrides: overrides, patterns: patterns };

            // البعيد فيه ما لم نره: الدمج قبل الدفع — الدفع الأعمى يدهس أجهزة أخرى
            var adopt = Promise.resolve(null);
            if (remote && remote.meta.device !== device && hashPayload(remote.payload) !== lasthash) {
              var localAt = Math.max(state.at || 0, r[K.SYNC_PENDING] || 0);
              var m = mergeIn(
                { overrides: overrides, patterns: patterns, tombs: tombs,
                  // everSynced = «حالتي هذه مرفوعةٌ فعلًا» لا «سبق أن زامنت»: بلا هذا
                  // القيد يمحو الحذفُ بالغياب تصحيحاتِ جهازٍ لم يُرفع له شيء (تجاوزُ
                  // السعة، أو دفعةٌ معلّقة لم تنجح) — فقدٌ صامتٌ لكل عمله (دحض مؤكد)
                  at: localAt, everSynced: !!lasthash && curHash === lasthash },
                remote, now
              );
              // ★ قراءةٌ طازجة قُبيل الكتابة: تصحيحٌ حفظه المستخدم أثناء جولة السحابة
              // كان يُدهس ويُسجَّل له شاهدُ حذفٍ كاذب (انظر رأس الملف)
              adopt = pGetLocal(env, [K.OVERRIDES, K.USER_PATTERNS]).then(function (fr) {
                var fo = fr[K.OVERRIDES] || {}, fp = fr[K.USER_PATTERNS] || [];
                payload = {
                  overrides: rebaseOverrides(m.overrides, overrides, fo),
                  patterns: rebaseRules(m.patterns, patterns, fp),
                };
                var mergedHash = hashPayload(payload);
                var w = {};
                // ولا شاهدَ لمفتاحٍ صار حاضرًا في المكتوب (أعاده المستخدم للتوّ)
                w[K.SYNC_TOMBS] = dropTombsPresent(m.tombs, payload.overrides, payload.patterns);
                if (mergedHash !== hashPayload({ overrides: fo, patterns: fp })) {
                  w[K.OVERRIDES] = payload.overrides; w[K.USER_PATTERNS] = payload.patterns;
                }
                if (mergedHash === hashPayload(remote.payload)) {
                  // الدمج طابق البعيدَ تمامًا — تبنٍّ بلا دفع (دفعُ المِثل ضجيج rev)
                  w[K.SYNC_LASTHASH] = mergedHash;
                  w[K.SYNC_PENDING] = 0;
                  return pSetLocal(env, w).then(function () { return "adopted"; });
                }
                // عندنا زيادة على البعيد: تبنَّ الدمج ثم ادفعه (lasthash بعد نجاح الدفع
                // لا قبله — لو كُتب الآن ومات العامل قبل الدفع لظنّ الإيقاظُ الحالةَ صدًى)
                return pSetLocal(env, w).then(function () { return null; });
              });
            }

            return adopt.then(function (early) {
              if (early === "adopted") return { done: "adopted" };
              var rev = Math.max(remote ? remote.meta.rev || 0 : 0, state.rev || 0) + 1;
              var packed = pack(payload, {
                rev: rev, device: device, now: now, prevChunks: chunkCountIn(snap),
              });
              if (!packed.fits) {
                var st = { status: "overflow", need: packed.need, at: now };
                var wOver = {};
                wOver[K.SYNC_STATE] = st;
                wOver[K.SYNC_PENDING] = 0; // الإصرار على دفعٍ لا يسع لن يصلحه الإيقاظ
                return pSetLocal(env, wOver).then(function () { return { done: "overflow" }; });
              }
              // الترتيب عقدُ الكتابة الممزّقة: الشرائح، فالميتا وحدها، فحذف الفائض
              var chunkSets = {};
              for (var kk in packed.sets) {
                if (Object.prototype.hasOwnProperty.call(packed.sets, kk) && kk !== K.SYNC_META) {
                  chunkSets[kk] = packed.sets[kk];
                }
              }
              return pSetSync(env, chunkSets)
                .then(function () { return pSetSync(env, keyed(K.SYNC_META, packed.meta)); })
                .then(function () {
                  return packed.removes.length ? pRemoveSync(env, packed.removes) : null;
                })
                .then(function () {
                  var wOk = {};
                  wOk[K.SYNC_LASTHASH] = hashPayload(payload);
                  wOk[K.SYNC_STATE] = {
                    status: "ok", bytes: packed.bytes, count: packed.meta.count, at: now, rev: rev,
                  };
                  wOk[K.SYNC_PENDING] = 0;
                  return pSetLocal(env, wOk).then(function () { return { done: "pushed", rev: rev }; });
                })
                .catch(function (e) {
                  // فشلت كتابة السحابة (حصة/خنق): تُسجَّل الحال وpending يبقى —
                  // فحص الإيقاظ أو الحدث التالي يعيد المحاولة
                  var wErr = {};
                  wErr[K.SYNC_STATE] = { status: "error", error: String(e && e.message || e), at: now };
                  return pSetLocal(env, wErr).then(function () { return { done: "error" }; });
                });
            });
          });
        });
      });
    });
  }

  // لبّ حدث السحابة: لقطة جديدة من جهاز آخر — فكّها، ادمجها، وادفع الزيادة إن وُجدت
  function syncCore(env, changes) {
    // هل الحدث لمفاتيحنا أصلًا؟ (دفاع رخيص — العامل يرشّح قبل النداء أيضًا)
    var ours = false;
    for (var ck in changes || {}) {
      if (!Object.prototype.hasOwnProperty.call(changes, ck)) continue;
      if (ck === K.SYNC_META || ck.indexOf(K.SYNC_CHUNK_PREFIX) === 0) { ours = true; break; }
    }
    if (!ours) return Promise.resolve({ done: "ignored" });

    var L = [K.SYNC_ENABLED, K.OVERRIDES, K.USER_PATTERNS, K.SYNC_TOMBS,
             K.SYNC_LASTHASH, K.SYNC_STATE, K.SYNC_DEVICE, K.SYNC_PENDING];
    return pGetLocal(env, L).then(function (r) {
      if (r[K.SYNC_ENABLED] !== true) return { done: "disabled" };
      var device = r[K.SYNC_DEVICE];

      // حارس الصدى ٢ (مبكرًا وبلا جلب اللقطة): ميتا الحدث بهويتنا = صدى دفعتنا
      var mc = changes[K.SYNC_META];
      if (mc && mc.newValue && device && mc.newValue.device === device) return { done: "self" };

      return pGetSyncAll(env).then(function (snap) {
        var remote = unpack(snap);
        if (!remote && !snap[K.SYNC_META]) return { done: "empty" }; // مُسحت أو لم تُكتب قط
        if (!remote) {
          // ★ القارئ مصلحٌ لا شاهدٌ صامت: كاتبان متشابكان (شرائح أ، شرائح ب، ميتا ب،
          // ميتا أ) يتركان السحابة ممزّقة **أبدًا** — كلاهما كتب lasthash وصفّر
          // pending فظنّ أنه أفلح، فلا دفعةَ تالية تتمّها. فمن سبقت له مزامنة يطبع
          // طابعًا معلّقًا: المؤقّت أو الإيقاظ يدفع لقطةً متّسقة كاملة.
          var stT = r[K.SYNC_STATE] || {};
          var nowT = env.now();
          if (!r[K.SYNC_LASTHASH]) return { done: "torn" };   // لم نزامن قط: ليس عندنا ما نصلح به
          if (r[K.SYNC_PENDING]) return { done: "torn" };      // دفعةٌ معلّقة أصلًا ستصلحها
          // حارس الدوران: إصلاحٌ واحد كل SYNC_REPAIR_MIN_MS على الأكثر
          if (stT.repairAt && nowT - stT.repairAt < C.SYNC_REPAIR_MIN_MS) return { done: "torn" };
          // ★★ تثبُّتٌ ثانٍ قبل الإصلاح: لقطةٌ تُقرأ أثناء كتابةِ جهازٍ آخر تبدو ممزّقةً
          // وهي سليمةٌ بعد لحظات. وكان الإصلاح يدفع حالتَنا **بلا دمج** (remote=null
          // فيُتخطّى فرعُ التبنّي) وبرقمٍ من state.rev فينزل عن رقم السحابة، فيمحو
          // بالغياب ما دفعه الجهاز الآخر بنجاح — فيضيع التصحيح من الجهازين (قِيس).
          // فالمرّة الأولى تُسجّل الشاهد وحده، والإصلاح لا يقع إلا إن بقي التمزّق.
          if (!stT.tornAt || nowT - stT.tornAt < C.SYNC_TORN_CONFIRM_MS) {
            var stW = {}, wk;
            for (wk in stT) { if (own(stT, wk)) stW[wk] = stT[wk]; }
            if (!stW.tornAt) stW.tornAt = nowT;
            return pSetLocal(env, keyed(K.SYNC_STATE, stW)).then(function () { return { done: "torn" }; });
          }
          var stCopy = {}, sk;
          for (sk in stT) { if (own(stT, sk)) stCopy[sk] = stT[sk]; }
          stCopy.repairAt = nowT;
          stCopy.tornAt = 0; // استُهلك الشاهد
          // رقمُ الدفعة المُصلِحة يعلو ميتا السحابة الحاضرة: أخذُه من state.rev وحده
          // كان يُنزله عن رقمها فتُقرأ لقطتُنا أقدمَ مما هي
          var metaRev = (snap[K.SYNC_META] && snap[K.SYNC_META].rev) || 0;
          if (metaRev > (stCopy.rev || 0)) stCopy.rev = metaRev;
          var wR = {};
          wR[K.SYNC_PENDING] = nowT;
          wR[K.SYNC_STATE] = stCopy;
          wR[K.SYNC_LASTHASH] = null; // وإلا صدَّ حارسُ الصدى الدفعةَ المُصلِحة فبقي التمزّق أبدًا
          return pSetLocal(env, wR).then(function () { return { done: "repair" }; });
        }
        if (device && remote.meta.device === device) return { done: "self" };

        var remoteHash = hashPayload(remote.payload);
        var lasthash = r[K.SYNC_LASTHASH];
        if (remoteHash === lasthash) return { done: "seen" };

        var state = r[K.SYNC_STATE] || {};
        var now = env.now();
        var baseOv = r[K.OVERRIDES] || {}, basePat = r[K.USER_PATTERNS] || [];
        var m = mergeIn(
          {
            overrides: baseOv,
            patterns: basePat,
            tombs: r[K.SYNC_TOMBS] || {},
            at: Math.max(state.at || 0, r[K.SYNC_PENDING] || 0),
            // القيد نفسه هنا (انظر localCore): حالتي المحلية يجب أن تكون هي المرفوعة
            everSynced: !!lasthash && hashPayload({ overrides: baseOv, patterns: basePat }) === lasthash,
          },
          remote, now
        );

        // ★ قراءةٌ طازجة قُبيل الكتابة (كما في localCore): بين قراءتنا وكتابتنا جولةُ
        // getSyncAll، وتصحيحٌ حُفظ فيها كان يُدهس ويُسجَّل له شاهدُ حذفٍ كاذب
        return pGetLocal(env, [K.OVERRIDES, K.USER_PATTERNS]).then(function (fr) {
          var fo = fr[K.OVERRIDES] || {}, fp = fr[K.USER_PATTERNS] || [];
          var outOv = rebaseOverrides(m.overrides, baseOv, fo);
          var outPat = rebaseRules(m.patterns, basePat, fp);
          var mergedHash = hashPayload({ overrides: outOv, patterns: outPat });

          // lasthash = بصمة البعيد (لا الدمج): إن ساوى الدمجُ البعيدَ خمد الصدى هنا،
          // وإن زاد عليه بقيت البصمتان مختلفتين فيدفع localCore الزيادةَ فورًا بعدنا
          var w = {};
          w[K.SYNC_TOMBS] = dropTombsPresent(m.tombs, outOv, outPat);
          w[K.SYNC_LASTHASH] = remoteHash;
          if (mergedHash !== hashPayload({ overrides: fo, patterns: fp })) {
            w[K.OVERRIDES] = outOv; w[K.USER_PATTERNS] = outPat;
          }
          return pSetLocal(env, w).then(function () {
            if (mergedHash === remoteHash) return { done: "merged" };
            return localCore(env, null).then(function (pr) {
              return { done: "merged+push", push: pr && pr.done };
            });
          });
        });
      });
    });
  }

  g.CMLSync = {
    byteLen: byteLen,
    jsonBytes: jsonBytes,     // بايتات القيمة كما يزنها كروم (تهريب < و> وفاصلَي السطر)
    hashPayload: hashPayload,
    countPayload: countPayload,
    pack: pack,
    unpack: unpack,
    mergeIn: mergeIn,
    ruleKey: ruleKey,         // هوية القاعدة — يستهلكها sw.js لشواهد حذف القواعد
    RULE_TOMB: RULE_TOMB,
    diffRemovedKeys: diffRemovedKeys,
    diffRemovedRules: diffRemovedRules,
    dropTombsPresent: dropTombsPresent,
    pruneTombs: pruneTombs,
    clearDirty: clearDirty,   // يمحو علامة «حدثٌ لم يُدمج» — يناديها فحصُ الإيقاظ بعد الدمج
    handleLocalChange: guarded(localCore, "local"),
    handleSyncChange: guarded(syncCore, "sync"),
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
