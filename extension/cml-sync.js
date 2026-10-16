/* cml-sync.js — قلب المزامنة الاختيارية (المرحلة ٦): المنطق كله هنا، والغراء في sw.js.
 *
 * هذا الملف هو المصدر الواحد لعقد المزامنة. ما يُزامَن: تصحيحات المستخدم وقواعده
 * الذكية فقط — الإعدادات محلية لكل جهاز. والمزامنة **مساحات** (createSpace): مساحة
 * التطبيق بمفاتيح 1.0.0 نفسها (cml_overrides/cml_user_patterns ↔ cml_syncmeta
 * وcml_syncd_0..N) لا تتغيّر صيغتها أبدًا، ولكل نطاقٍ جديد مساحةٌ مستقلة بمفاتيح لا تبدأ
 * ببادئة 1.0.0 (فلا يعدّها جهازٌ قديم من شرائحه). لكل مساحةٍ قفلُها ودفاترها وحالُها.
 *
 * صيغة اللقطة في chrome.storage.sync (لكل مساحة):
 *   - الحمولة نصُّ JSON قانوني (اللغات ثم المفاتيح مرتّبةً؛ القواعد مصفوفةً) مشرَّحٌ
 *     تحت <prefix>0..N بحيث لا يتجاوز (المفتاح + قيمة JSON) SYNC_ITEM_BYTES للشريحة.
 *   - الميتا: {v:1, rev, at, device, count, hash, chunks, anc?}. anc حقلٌ اختياري
 *     يتجاهله قارئ 1.0.0 (لا يفحص إلا v وchunks وhash وcount، والبصمة على الحمولة
 *     وحدها) — فاللقطة تبقى مقروءةً عنده حرفًا بحرف.
 *
 * قاعدة الكتابة الممزّقة: الميتا تُكتب **آخِرًا** (الشرائح ثم الميتا ثم حذفُ الفائض).
 *   القارئ لا يثق إلا بلقطةٍ ميتاها متّسقة (inspect: empty/valid/unsupported/incomplete).
 *
 * ★★ السببية (مراجعتان مستقلتان ١٢ ربيع الآخر ١٤٤٨هـ): «الحذف بالغياب» بطابع المجموعة
 *   لا يعرف من رأى ماذا — فإضافةٌ دون اتصالٍ غلبتها لقطةٌ لم ترها كانت تُحذف من الجميع،
 *   وإعادةُ إضافة عنصرٍ محذوف كانت تُمحى، وساعةٌ منحرفة كانت تُحيي المحذوف. فصار لكل
 *   عنصرٍ **نقطة** [الجهاز، العدّاد] تسمّي آخر كتابةٍ له، ولكل لقطةٍ **متّجه إصدارات**
 *   vv = {الجهاز: أعلى عدّاد رآه} — يُكتبان في حقلٍ x داخل الحمولة يتجاهله قارئ 1.0.0
 *   (لا يقرأ إلا o وp، والبصمةُ والعدّ عليهما وحدهما). والحكم بلا ساعة:
 *   - عنصرٌ عندنا غائبٌ عن لقطةٍ **رأت نقطتَه** (vv يغطيها) ⇒ حُذف هناك عن علم فيُحذف.
 *   - عنصرٌ عندنا لم ترَ اللقطةُ نقطتَه ⇒ كتابةٌ متزامنة أو دون اتصال: يبقى.
 *   - عنصرٌ في اللقطة **رأينا نقطتَه** وليس عندنا ⇒ حذفناه نحن: لا يُعاد.
 *   - عنصرٌ في اللقطة لم نرَ نقطتَه ⇒ إضافةٌ جديدة (أو إعادةُ إضافةٍ بنقطةٍ جديدة): يُؤخذ.
 *   - قيمتان مختلفتان: من رأى كتابةَ الآخر ثم غيّرها فهو الأحدث؛ وإلا فالأعلى عدّادًا ثم
 *     اسمُ الجهاز (حسمٌ حتميّ يتّفق عليه الطرفان).
 *   المتّجه يكبر بعدد الأجهزة لا بطول التاريخ (لا سقف يُنسي). ومحليًّا لكل مساحة «المعروف»
 *   (known: هوية العنصر ← بصمة قيمته ونقطتها) و«المتّجه» (vv). عنصرٌ تغيّرت قيمتُه عن المعروف
 *   كتابةٌ محلية لم تُنشر، ينال نقطةً جديدة [جهازنا، عدّادٌ جديد] عند الدفع.
 *   جسر الترقية: جهازٌ حالُه مطابقةٌ لآخر ما زامنه في 1.0.0 تُعطى عناصرُه نقطةً مشتركة
 *   ["~",0] ومتّجهُه {"~":0} — فأجهزةُ 1.0.0 المتزامنة يرى بعضُها بعضًا من أول دفعة.
 *   ولقطةٌ بلا x (كتبها 1.0.0) تُحكم بالقاعدة القديمة كما هي (everSynced وشواهد الحذف)،
 *   مع حارسٍ واحد: حذفٌ محلي لم يُنشر (العنصر ما زال في «المعروف») لا تُلغيه لقطةٌ بعيدة.
 *
 * هوية القاعدة: {en, re, ar} من CMLShared.makePattern — وre مُعرّفها المستقر. وترتيب
 *   القواعد قانوني (الأخصُّ أولًا ثم المفتاح) كي لا تختلف البصمتان لمجموعةٍ واحدة.
 *
 * شواهد الحذف (tombs) دفترٌ محلي: {"<لغة>|<مفتاح>": وقتُ الحذف} و{"#p|<re>": وقتُ الحذف}.
 *   كل قراءة-كتابةٍ له تحت قفلٍ واحد، وكاتب الجولة يضمّ ما استجدّ فيه منذ قراءته.
 *
 * سباق القراءة-التعديل-الكتابة: تُعاد القراءة قُبيل الكتابة (commitLocal) وتُسنَد نتيجةُ
 *   الدمج عليها: ما غيّره المستخدم في أثناء الجولة يفوز، وما حذفه فيها لا يُحييه الدمج.
 *
 * التمزّق: قارئٌ يرى لقطةً غير متّسقة يسجّل بصمتَها (tornSig) ووقتَها وموعدَ إعادة
 *   فحصها، ولا يُصلح (يدفع فوقها) إلا إن بقيت **اللقطةُ نفسُها** ممزّقةً بعد المهلة؛
 *   وأيُّ قراءةٍ متّسقة تمحو الشاهد.
 *
 * حارسا الصدى: lasthash (آخر حالةٍ طابقت السحابة) وهوية الجهاز في الميتا.
 *
 * نقاء: لا chrome.* هنا — بيئة env = {getLocal(keys, cb(r, err)), setLocal(obj, cb(err)),
 *   removeLocal(keys, cb(err)), getSyncAll(cb(r, err)), setSync(obj, cb(err)),
 *   removeSync(keys, cb(err)), now()}. خطأ القراءة يصل وسيطًا ثانيًا، ولا كتابة بعده.
 *
 * ثنائي الاستخدام: لا import/export — يفترض تحميل cml-const.js قبله.
 */
(function (g) {
  "use strict";
  var C = g.CMLConst;
  var K = C.K;

  // ---- أدوات صغيرة ----------------------------------------------------------

  // طول النص بايتاتِ UTF-8 — حصص كروم بالبايت لا بالحرف (والعربية حرفها بايتان)
  function byteLen(s) {
    if (typeof TextEncoder === "function") return new TextEncoder().encode(s).length;
    return unescape(encodeURIComponent(s)).length;
  }

  // ★ كروم يزن الحصة بكاتب JSON الخاص به — يهرّب «<» و«>» وU+2028/U+2029 إلى ستّ بايتات
  var CHROME_ESC = /[<>\u2028\u2029]/g;
  function chromeEsc(c) {
    return "\\u" + ("000" + c.charCodeAt(0).toString(16).toUpperCase()).slice(-4);
  }
  function jsonBytes(v) { return byteLen(JSON.stringify(v).replace(CHROME_ESC, chromeEsc)); }

  // FNV-1a (32 بت) على وحدات الترميز — نسخة محلية عمدًا
  function fnv1a(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o || {}, k); }
  function keyed(k, v) { var o = {}; o[k] = v; return o; }
  function copyObj(o) { var c = {}, k; for (k in o || {}) { if (own(o, k)) c[k] = o[k]; } return c; }

  // النص القانوني للحمولة: {"o":{لغات مرتبة:{مفاتيح مرتبة}},"p":[القواعد كما هي]}
  function canon(payload) {
    var o = (payload && payload.overrides) || {};
    var p = (payload && payload.patterns) || [];
    var langs = Object.keys(o).sort();
    var parts = [];
    for (var i = 0; i < langs.length; i++) {
      var m = o[langs[i]] || {};
      var keys = Object.keys(m).sort();
      if (!keys.length) continue;
      var kv = [];
      for (var j = 0; j < keys.length; j++) {
        kv.push(JSON.stringify(keys[j]) + ":" + JSON.stringify(m[keys[j]]));
      }
      parts.push(JSON.stringify(langs[i]) + ":{" + kv.join(",") + "}");
    }
    return '{"o":{' + parts.join(",") + '},"p":' + JSON.stringify(p) + "}";
  }

  function hashPayload(payload) { return fnv1a(canon(payload)); }

  function countPayload(payload) {
    var o = (payload && payload.overrides) || {};
    var n = ((payload && payload.patterns) || []).length;
    for (var lang in o) {
      if (own(o, lang)) n += Object.keys(o[lang] || {}).length;
    }
    return n;
  }

  // ---- مفاتيح المساحة الافتراضية (التطبيق — صيغة 1.0.0 المجمَّدة) ------------------
  var APP_KEYS = { meta: K.SYNC_META, prefix: K.SYNC_CHUNK_PREFIX };
  function keysOf(opt) {
    return { meta: (opt && opt.meta) || APP_KEYS.meta, prefix: (opt && opt.prefix) || APP_KEYS.prefix };
  }

  // ---- التغليف والفك --------------------------------------------------------

  function sliceLen(json, pos, keyBytes) {
    var lo = 1, hi = Math.min(json.length - pos, C.SYNC_ITEM_BYTES), best = 1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var b = keyBytes + jsonBytes(json.substr(pos, mid));
      if (b <= C.SYNC_ITEM_BYTES) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return best;
  }

  // pack(payload, opt {rev, device, now, prevChunks, x, meta, prefix, cap})
  //   → {sets, removes, bytes, fits, need, meta}
  // x (نقاط العناصر ومتّجه الإصدارات) يُلحق بنصّ الحمولة حقلًا ثالثًا؛ والبصمةُ على o وp وحدهما
  // كما يحسبها قارئ 1.0.0 — فلقطتنا تبقى صالحةً عنده ويتجاهل x
  function pack(payload, opt) {
    opt = opt || {};
    var ks = keysOf(opt);
    var body = canon(payload);
    var json = opt.x ? body.slice(0, -1) + ',"x":' + JSON.stringify(opt.x) + "}" : body;
    var sets = {};
    var total = 0;
    var i = 0, pos = 0;
    while (pos < json.length) {
      var key = ks.prefix + i;
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
      hash: fnv1a(body),
      chunks: i,
    };
    sets[ks.meta] = meta;
    total += byteLen(ks.meta) + jsonBytes(meta);
    var removes = [];
    var prev = opt.prevChunks || 0;
    for (var r = i; r < prev; r++) removes.push(ks.prefix + r);
    var cap = typeof opt.cap === "number" ? opt.cap : C.SYNC_TOTAL_BYTES;
    return { sets: sets, removes: removes, bytes: total, fits: total <= cap, need: total, meta: meta };
  }

  // كم شريحة قائمة في اللقطة فعلًا — أقصى فهرس + ١، لا عدّ الميتا
  function chunkCountIn(snap, prefix) {
    prefix = prefix || APP_KEYS.prefix;
    var max = -1;
    for (var k in snap || {}) {
      if (!own(snap, k) || k.indexOf(prefix) !== 0) continue;
      var n = parseInt(k.slice(prefix.length), 10);
      if (!isNaN(n) && String(n) === k.slice(prefix.length) && n > max) max = n;
    }
    return max + 1;
  }

  // unpack(لقطة، مفاتيح؟) → {payload, meta} أو null — الممزّق والناقص «لا لقطة» بصمت
  function unpack(snap, opt) {
    if (!snap) return null;
    var ks = keysOf(opt);
    var meta = snap[ks.meta];
    if (!meta || meta.v !== 1 || typeof meta.chunks !== "number" || meta.chunks < 0) return null;
    var json = "";
    for (var i = 0; i < meta.chunks; i++) {
      var c = snap[ks.prefix + i];
      if (typeof c !== "string") return null;
      json += c;
    }
    var parsed;
    try { parsed = JSON.parse(json); } catch (e) { return null; }
    if (!parsed || typeof parsed !== "object") return null;
    var payload = { overrides: parsed.o || {}, patterns: parsed.p || [] };
    if (typeof payload.overrides !== "object" || !Array.isArray(payload.patterns)) return null;
    if (hashPayload(payload) !== meta.hash) return null;
    if (countPayload(payload) !== meta.count) return null;
    var xd = decodeX(parsed);
    return { payload: payload, meta: meta, dots: xd ? xd.dots : null, vv: xd ? xd.vv : null };
  }

  // inspect(لقطة، مفاتيح؟) → {kind, remote, meta} — نتيجة قراءةٍ صريحة (مراجعة كودكس ٢)
  function inspect(snap, opt) {
    var ks = keysOf(opt);
    var meta = snap && snap[ks.meta];
    if (!meta) return { kind: chunkCountIn(snap || {}, ks.prefix) > 0 ? "incomplete" : "empty", remote: null, meta: null };
    if (typeof meta !== "object" || meta.v !== 1) return { kind: "unsupported", remote: null, meta: meta };
    var remote = unpack(snap, ks);
    return remote ? { kind: "valid", remote: remote, meta: meta } : { kind: "incomplete", remote: null, meta: meta };
  }

  // بصمة لقطةٍ غير متّسقة بعينها: الميتا والشرائح الحاضرة — تمزّقٌ آخرُ بصمتُه أخرى
  function tornSig(snap, ins, opt) {
    var ks = keysOf(opt);
    var n = chunkCountIn(snap || {}, ks.prefix), body = "";
    for (var i = 0; i < n; i++) body += "\u0001" + (typeof snap[ks.prefix + i] === "string" ? snap[ks.prefix + i] : "~");
    var m = ins && ins.meta;
    return (m ? m.rev + ":" + m.hash + ":" + m.chunks : "-") + ":" + n + ":" + fnv1a(body);
  }

  // ---- التعقيم (مراجعة الأمن) ------------------------------------------------
  var LANG_RE = /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/;
  var TEXT_CAP = (C && C.TEXT_MAX) || 300;
  // lim (اختياري، لكل مساحة): {keyMax, valMax, keyRe} — مساحة الفقرات مفاتيحُها بصماتٌ وقيمُها قوالب طويلة
  function sanitizePayload(payload, lim) {
    var shared = g.CMLShared;
    var keyMax = (lim && lim.keyMax) || TEXT_CAP, valMax = (lim && lim.valMax) || TEXT_CAP * 2, keyRe = (lim && lim.keyRe) || null;
    var o = {}, src = (payload && payload.overrides) || {};
    for (var lang in src) {
      if (!own(src, lang) || !LANG_RE.test(lang)) continue;
      var m = src[lang];
      if (!m || typeof m !== "object" || Array.isArray(m)) continue;
      var out = null;
      for (var k in m) {
        if (!own(m, k) || k === "__proto__" || k === "constructor" || k === "prototype") continue;
        var v = m[k];
        if (!k || typeof v !== "string" || k.length > keyMax || v.length > valMax || (keyRe && !keyRe.test(k))) continue;
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
      if (!shared || typeof shared.makePattern !== "function") continue;
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
      if (typeof r.re === "string" && r.re !== gen.re) continue;
      p.push(gen);
    }
    return { overrides: o, patterns: p };
  }

  // ---- الهويات والدفاتر -----------------------------------------------------

  var RULE_TOMB = "#p|";
  function ruleKey(p) {
    if (p && typeof p.re === "string" && p.re) return p.re;
    return "~" + JSON.stringify(p === undefined ? null : p);
  }
  function sameRule(a, b) { return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b); }
  function ruleLiteralLen(p) { return String((p && p.en) || "").replace(/\{[^{}]*\}/g, "").length; }
  function sortRules(list) {
    return list.map(function (p, i) { return { p: p, k: ruleKey(p), i: i }; })
      .sort(function (a, b) {
        return (ruleLiteralLen(b.p) - ruleLiteralLen(a.p)) ||
               (a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i);
      })
      .map(function (x) { return x.p; });
  }

  function pruneTombs(tombs, nowMs) {
    var out = {};
    var keys = [];
    for (var k in tombs) {
      if (!own(tombs, k)) continue;
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

  function diffRemovedKeys(oldOv, newOv) {
    oldOv = oldOv || {};
    newOv = newOv || {};
    var removed = [];
    for (var lang in oldOv) {
      if (!own(oldOv, lang)) continue;
      var om = oldOv[lang] || {};
      var nm = newOv[lang] || {};
      for (var k in om) {
        if (own(om, k) && !own(nm, k)) removed.push(lang + "|" + k);
      }
    }
    return removed;
  }

  function diffRemovedRules(oldPats, newPats) {
    var have = {}, removed = [], i, k;
    for (i = 0; i < (newPats || []).length; i++) have[ruleKey(newPats[i])] = 1;
    for (i = 0; i < (oldPats || []).length; i++) {
      k = ruleKey(oldPats[i]);
      if (!have[k] && removed.indexOf(RULE_TOMB + k) < 0) removed.push(RULE_TOMB + k);
    }
    return removed;
  }

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

  // بصمة قيمة عنصر (تصحيحٍ نصّي أو قاعدة)
  function vh(v) { return fnv1a(typeof v === "string" ? "s" + v : "j" + JSON.stringify(v)); }
  // عناصر الحمولة بهوياتها: [{id, v}] بترتيب canon (اللغات ثم المفاتيح مرتّبةً، ثم القواعد بترتيبها)
  function itemsOf(payload) {
    var out = [], o = (payload && payload.overrides) || {}, langs = Object.keys(o).sort(), i, j;
    for (i = 0; i < langs.length; i++) {
      var m = o[langs[i]] || {}, keys = Object.keys(m).sort();
      for (j = 0; j < keys.length; j++) out.push({ id: langs[i] + "|" + keys[j], v: m[keys[j]], lang: langs[i] });
    }
    var p = (payload && payload.patterns) || [];
    for (i = 0; i < p.length; i++) out.push({ id: RULE_TOMB + ruleKey(p[i]), v: p[i], rule: true });
    return out;
  }
  function validDot(d) {
    return Array.isArray(d) && d.length === 2 && typeof d[0] === "string" && d[0].length <= 40 &&
      typeof d[1] === "number" && d[1] >= 0 && d[1] === Math.floor(d[1]);
  }
  // x = {v:1, devs:[…], vv:[…], o:{لغة:[[i,c]…]}, p:[[i,c]…]} — مصفوفاتٌ موازية لترتيب canon
  // فلا تتكرّر نصوص المفاتيح (كلفة العنصر نحو ثماني بايتات)
  function encodeX(payload, dots, vv) {
    var devs = [], idx = {}, k;
    function di(d) { if (!own(idx, d)) { idx[d] = devs.length; devs.push(d); } return idx[d]; }
    for (k in vv || {}) { if (own(vv, k)) di(k); }
    var xo = {}, xp = [], items = itemsOf(payload);
    for (var i = 0; i < items.length; i++) {
      var d = dots[items[i].id];
      var e = validDot(d) ? [di(d[0]), d[1]] : [di("?"), 0];
      if (items[i].rule) xp.push(e);
      else (xo[items[i].lang] = xo[items[i].lang] || []).push(e);
    }
    var vva = devs.map(function (d) { return (vv && typeof vv[d] === "number") ? vv[d] : 0; });
    return { v: 1, devs: devs, vv: vva, o: xo, p: xp };
  }
  // فكّ x على الحمولة الخام (قبل التعقيم): أي عيبٍ في البنية أو الأطوال ⇒ null (فالقاعدة القديمة)
  function decodeX(parsed) {
    var x = parsed && parsed.x;
    if (!x || typeof x !== "object" || x.v !== 1 || !Array.isArray(x.devs) || !Array.isArray(x.vv) ||
        x.devs.length !== x.vv.length || x.devs.length > 256) return null;
    var devs = x.devs, vv = {}, i, j;
    for (i = 0; i < devs.length; i++) {
      if (typeof devs[i] !== "string" || devs[i].length > 40 || typeof x.vv[i] !== "number" || x.vv[i] < 0) return null;
      if (devs[i] !== "?") vv[devs[i]] = Math.max(vv[devs[i]] || 0, x.vv[i]);
    }
    var dots = {}, o = parsed.o || {}, langs = Object.keys(o).sort();
    function dot(e) {
      if (!Array.isArray(e) || e.length !== 2 || typeof e[0] !== "number" || e[0] < 0 || e[0] >= devs.length ||
          typeof e[1] !== "number" || e[1] < 0) return undefined;
      return [devs[e[0]], e[1]];
    }
    for (i = 0; i < langs.length; i++) {
      var m = o[langs[i]] || {}, keys = Object.keys(m).sort();
      if (!keys.length) continue;
      var arr = x.o && x.o[langs[i]];
      if (!Array.isArray(arr) || arr.length !== keys.length) return null;
      for (j = 0; j < keys.length; j++) {
        var d = dot(arr[j]);
        if (!d) return null;
        if (d[0] !== "?") dots[langs[i] + "|" + keys[j]] = d;
      }
    }
    var p = parsed.p || [];
    if (!Array.isArray(x.p) || x.p.length !== p.length) return null;
    for (i = 0; i < p.length; i++) {
      var dp = dot(x.p[i]);
      if (!dp) return null;
      if (dp[0] !== "?") dots[RULE_TOMB + ruleKey(p[i])] = dp;
    }
    return { dots: dots, vv: vv };
  }
  function vvMax(a, b) {
    var out = {}, k;
    for (k in a || {}) { if (own(a, k) && typeof a[k] === "number") out[k] = a[k]; }
    for (k in b || {}) { if (own(b, k) && typeof b[k] === "number" && !(out[k] >= b[k])) out[k] = b[k]; }
    return out;
  }
  // «المعروف»: هوية ← {h: بصمة القيمة، d: نقطتها} لعناصر حمولةٍ لها نقاط
  function knownFrom(payload, dots) {
    var out = {}, items = itemsOf(payload);
    for (var i = 0; i < items.length; i++) {
      var d = dots && dots[items[i].id];
      if (validDot(d)) out[items[i].id] = { h: vh(items[i].v), d: d };
    }
    return out;
  }
  // جسر الترقية من 1.0.0: حالٌ مطابقة لآخر ما زامنه الجهاز ⇒ نقطةٌ مشتركة ["~",0] لكل عنصر
  var LEGACY_DOT = ["~", 0];
  // ★ (المراجعة الثالثة) عدّادٌ هجين: يصعد لكل جهازٍ كما كان (فالتغطية بالمتّجه على حالها)، ولا
  // يقلّ عن دقائق الساعة — فحسمُ «المتزامنتين» يقدّم الأحدث كتابةً. كان العدّاد المحض يقدّم
  // كتابةً قديمة من جهازٍ كثير الدفع على كتابةٍ أحدث من جهازٍ ترقّى للتوّ (عدّاده 1) فتضيع
  function hlc(prev, ms) {
    var m = Math.floor(((ms || 0) - C.SYNC_HLC_EPOCH_MS) / 60000);
    return Math.max((prev || 0) + 1, m > 0 ? m : 0);
  }
  function bootstrapKnown(clean) {
    var dots = {}, items = itemsOf(clean);
    for (var i = 0; i < items.length; i++) dots[items[i].id] = LEGACY_DOT;
    return knownFrom(clean, dots);
  }

  // ---- الدمج ----------------------------------------------------------------

  // mergeIn(المحلي, البعيد {payload, meta, dots?, vv?}, الآن)
  //   → {overrides, patterns, tombs, dots, vv, changedLocal}
  // المحلي: {overrides, patterns, tombs, at, everSynced, known?, vv?, device?}
  //   at/everSynced/tombs: للقطة كتبها 1.0.0 (بلا x) وحدها — انظر رأس الملف
  function mergeIn(local, remote, nowMs, lim) {
    // التعقيم على باب الدمج: ما يُقبل إلى التخزين المحلي هو المعقَّم وحده (بحدود المساحة)
    if (remote && remote.payload) remote = { payload: sanitizePayload(remote.payload, lim), meta: remote.meta, dots: remote.dots, vv: remote.vv };
    var lo = (local && local.overrides) || {};
    var lp = (local && local.patterns) || [];
    var tombs = pruneTombs((local && local.tombs) || {}, nowMs);
    var lAt = (local && local.at) || 0;
    var ever = !!(local && local.everSynced);
    var known = (local && local.known) || {};
    var lvv = (local && local.vv) || {};
    var me = (local && local.device) || "?";
    var ro = (remote && remote.payload && remote.payload.overrides) || {};
    var rp = (remote && remote.payload && remote.payload.patterns) || [];
    var meta = (remote && remote.meta) || {};
    var rAt = meta.at || 0;
    var rdots = remote && remote.dots, rvv = remote && remote.vv;
    var hasX = !!(rdots && rvv);
    var localWins = lAt > rAt;
    // حارس انحراف الساعة للقاعدة القديمة وحدها: الحكم بالنقاط لا يستعمل الساعة أصلًا
    var trustRecency = rAt <= nowMs + C.SYNC_SKEW_TOLERANCE_MS;
    var myNext = [me, hlc(lvv[me], lAt || nowMs)];   // كتابتنا غير المنشورة: وقتُ تعديلها
    var outDots = {};

    // ★ (المراجعة الثالثة) ثلاثة أحوالٍ لنقطة العنصر عندنا، ولكلٍّ حكمه:
    //   null   — كتابةٌ محلية لم تُنشر (لا غير: ما أُخذ من لقطةٍ بلا x يُسجَّل بالنقطة القديمة)،
    //            فهي في الحسم «كتابتنا التالية» myNext.
    //   قديمة  — ["~",0]: جسرُ الترقية أو لقطةُ 1.0.0. لا تاريخ سببيًّا وراءها، فلا تُعدّ
    //            مغطّاةً ولا مغطِّية أبدًا — كان متّجهُ كل جهازٍ ترقّى يحمل "~" فيحسب نفسه رأى
    //            كل كتابةٍ من عهد 1.0.0 ولو فاتته، فيحذف إضافاتها ويعيد قيمها القديمة —
    //            ويُحكم فيها بقاعدة 1.0.0 نفسها (الشواهد والأحدث).
    //   سببيّة — [جهاز، عدّاد]: التغطية والحسم الحتميّ.
    function ldot(id, lv) { var k = known[id]; return (k && validDot(k.d) && k.h === vh(lv)) ? k.d : null; }
    function causal(d) { return validDot(d) && String(d[0]).charAt(0) !== "~"; }
    function cov(d, vv) { return causal(d) && !!vv && typeof vv[d[0]] === "number" && vv[d[0]] >= d[1]; }
    function later(a, b) { return a[1] !== b[1] ? a[1] > b[1] : String(a[0]) > String(b[0]); }
    function legacyOr(d) { return validDot(d) ? d : LEGACY_DOT; }

    function both(id, lv, rv) {
      var ld = ldot(id, lv), rd = hasX ? rdots[id] : null;
      if (sameRule(lv, rv)) {
        // القيمة واحدة: تُتبنّى نقطةُ المنشور ما لم يكن عندنا الأحدث وقد رآه — نقطةٌ محلية لم
        // تبلغ السحابة كانت تبقى فلا يغطّيها حذفٌ لاحق من جهازٍ آخر فيعود المحذوف
        if (hasX && validDot(rd)) outDots[id] = (ld && cov(ld, rvv) && later(ld, rd)) ? ld : rd;
        else outDots[id] = legacyOr(ld);
        return lv;
      }
      if (hasX) {
        var lc = ld === null || causal(ld);          // كتابتنا (منشورةً أو لا) سببيّة
        if (ld && cov(ld, rvv)) { outDots[id] = legacyOr(rd); return rv; }   // رأوا كتابتنا ثم غيّروها
        if (lc && causal(rd)) {
          if (cov(rd, lvv)) { outDots[id] = ld; return lv; }                 // رأينا كتابتهم ثم غيّرناها
          if (later(rd, ld || myNext)) { outDots[id] = rd; return rv; }       // متزامنتان: حسمٌ حتميّ
          outDots[id] = ld;
          return lv;
        }
        // طرفٌ قديم بلا دليل تغطية: قاعدة 1.0.0 (الأحدث)
      }
      if (localWins) { outDots[id] = ld; return lv; }
      outDots[id] = legacyOr(hasX ? rd : null);
      return rv;
    }
    function localOnlyKeep(id, lv) {
      var ld = ldot(id, lv);
      if (hasX && ld === null) { outDots[id] = null; return true; }  // كتابتنا غير المنشورة
      if (hasX && causal(ld)) {
        if (cov(ld, rvv)) return false;          // رأوه وحذفوه
        outDots[id] = ld;
        return true;
      }
      // لقطةٌ من 1.0.0، أو عنصرٌ قديم: القاعدة القديمة
      if (trustRecency && ever && !localWins) return false;
      outDots[id] = ld;
      return true;
    }
    function remoteOnlyTake(id, rv) {
      var t = tombs[id];
      var rd = hasX ? rdots[id] : null;
      if (causal(rd)) {
        if (cov(rd, lvv)) return false;          // رأينا هذه الكتابة وليست عندنا: حذفناها
        if (t) delete tombs[id];                 // كتابةٌ لم نرها (إضافةٌ أو إعادةُ إضافة): تُؤخذ
        outDots[id] = rd;
        return true;
      }
      // لقطةٌ من 1.0.0 أو عنصرٌ قديم: الشواهد والقاعدة القديمة، وحذفٌ لم يُنشر (ما زال في المعروف) نافذ
      var kn = known[id];
      if (kn && kn.h === vh(rv)) return false;
      if (t) {
        if (!trustRecency) return false;
        if (t > rAt) return false;
        if (kn) return false;
        delete tombs[id];
      }
      outDots[id] = LEGACY_DOT;                  // يدخل «المعروف» فلا يُحسب كتابةً محلية عند الدفع
      return true;
    }

    var out = {}, seen = {}, lang, k;
    for (lang in lo) { if (own(lo, lang)) seen[lang] = 1; }
    for (lang in ro) { if (own(ro, lang)) seen[lang] = 1; }
    for (lang in seen) {
      var lm = lo[lang] || {}, rm = ro[lang] || {}, om = {};
      for (k in lm) {
        if (!own(lm, k)) continue;
        var id = lang + "|" + k;
        if (own(rm, k)) om[k] = both(id, lm[k], rm[k]);
        else if (localOnlyKeep(id, lm[k])) om[k] = lm[k];
      }
      for (k in rm) {
        if (!own(rm, k) || own(lm, k)) continue;
        if (remoteOnlyTake(lang + "|" + k, rm[k])) om[k] = rm[k];
      }
      if (Object.keys(om).length) out[lang] = om;
    }

    var outP;
    var lmap = {}, rmap = {}, seenR = {}, picked = [], i2, rk;
    for (i2 = 0; i2 < lp.length; i2++) { rk = ruleKey(lp[i2]); if (!own(lmap, rk)) lmap[rk] = lp[i2]; }
    for (i2 = 0; i2 < rp.length; i2++) { rk = ruleKey(rp[i2]); if (!own(rmap, rk)) rmap[rk] = rp[i2]; }
    for (i2 = 0; i2 < lp.length; i2++) {
      rk = ruleKey(lp[i2]);
      if (seenR[rk]) continue;
      seenR[rk] = 1;
      if (own(rmap, rk)) picked.push(both(RULE_TOMB + rk, lmap[rk], rmap[rk]));
      else if (localOnlyKeep(RULE_TOMB + rk, lmap[rk])) picked.push(lmap[rk]);
    }
    for (i2 = 0; i2 < rp.length; i2++) {
      rk = ruleKey(rp[i2]);
      if (seenR[rk]) continue;
      seenR[rk] = 1;
      if (remoteOnlyTake(RULE_TOMB + rk, rmap[rk])) picked.push(rmap[rk]);
    }
    // الترتيب القانوني ما لم يطابق المحليُّ البعيدَ حرفًا: ترتيبُ الإدراج المحلي كان يبقى فيدفع
    // جهازان متساويا المحتوى مختلفا الترتيب أحدُهما للآخر بلا نهاية (المراجعة الثالثة)
    outP = JSON.stringify(lp) === JSON.stringify(rp) ? lp : sortRules(picked);

    var dots = {};
    for (var di in outDots) { if (own(outDots, di) && validDot(outDots[di])) dots[di] = outDots[di]; }
    var changedLocal =
      hashPayload({ overrides: out, patterns: outP }) !== hashPayload({ overrides: lo, patterns: lp });
    return { overrides: out, patterns: outP, tombs: tombs, dots: dots,
             vv: hasX ? vvMax(lvv, rvv) : vvMax(lvv, {}), changedLocal: changedLocal };
  }

  // ★ إعادة إسناد نتيجة الدمج على قراءةٍ طازجة: base ما قرأناه، fresh ما هو الآن، وما
  // تغيّر بينهما فعلُ المستخدم للتوّ — فيفوز إضافةً وتعديلًا وحذفًا.
  function rebaseOverrides(merged, base, fresh) {
    if (hashPayload({ overrides: base, patterns: [] }) === hashPayload({ overrides: fresh, patterns: [] })) return merged;
    var out = {}, lang, k, m, c;
    for (lang in merged) {
      if (!own(merged, lang)) continue;
      m = merged[lang] || {}; c = {};
      for (k in m) { if (own(m, k)) c[k] = m[k]; }
      out[lang] = c;
    }
    for (lang in base) {
      if (!own(base, lang)) continue;
      var bm = base[lang] || {}, fm = fresh[lang] || {};
      for (k in bm) { if (own(bm, k) && !own(fm, k) && out[lang]) delete out[lang][k]; }
    }
    for (lang in fresh) {
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
    if (JSON.stringify(base || []) === JSON.stringify(fresh || [])) return merged;
    var bmap = {}, fmap = {}, out = [], seen = {}, i, k;
    for (i = 0; i < (base || []).length; i++) bmap[ruleKey(base[i])] = base[i];
    for (i = 0; i < (fresh || []).length; i++) fmap[ruleKey(fresh[i])] = fresh[i];
    for (i = 0; i < (merged || []).length; i++) {
      k = ruleKey(merged[i]);
      if (seen[k]) continue;
      if (own(bmap, k) && !own(fmap, k)) continue;
      seen[k] = 1;
      out.push(own(fmap, k) && !sameRule(fmap[k], bmap[k]) ? fmap[k] : merged[i]);
    }
    for (i = 0; i < (fresh || []).length; i++) {
      k = ruleKey(fresh[i]);
      if (seen[k] || own(bmap, k)) continue;
      seen[k] = 1;
      out.push(fresh[i]);
    }
    return sortRules(out);
  }

  // ما ترفضه المزامنة (نصٌّ فوق السقف، قاعدةٌ لا يولّدها الحارس) لا يُرفع ولا يُحذف محليًّا:
  // يُضمّ إلى نتيجة الدمج حيث لم يحسم الدمجُ مفتاحَه
  function withLocalExtras(m, raw, clean) {
    var ov = {}, lang, k, src;
    for (lang in m.overrides || {}) {
      if (!own(m.overrides, lang)) continue;
      src = m.overrides[lang] || {};
      ov[lang] = copyObj(src);
    }
    var ro = raw.overrides || {}, co = clean.overrides || {};
    for (lang in ro) {
      if (!own(ro, lang)) continue;
      var rm = ro[lang];
      if (!rm || typeof rm !== "object" || Array.isArray(rm)) continue;
      for (k in rm) {
        if (!own(rm, k)) continue;
        if (co[lang] && own(co[lang], k)) continue;
        if (ov[lang] && own(ov[lang], k)) continue;
        if (!ov[lang]) ov[lang] = {};
        ov[lang][k] = rm[k];
      }
    }
    var pats = (m.patterns || []).slice(), have = {}, cleanKeys = {}, i, added = false;
    for (i = 0; i < (clean.patterns || []).length; i++) cleanKeys[ruleKey(clean.patterns[i])] = 1;
    for (i = 0; i < pats.length; i++) have[ruleKey(pats[i])] = 1;
    for (i = 0; i < (raw.patterns || []).length; i++) {
      var rk = ruleKey(raw.patterns[i]);
      if (cleanKeys[rk] || have[rk]) continue;
      have[rk] = 1; pats.push(raw.patterns[i]); added = true;
    }
    return { overrides: ov, patterns: added ? sortRules(pats) : pats };
  }

  function mergeFreshTombs(computed, base, fresh) {
    var out = {}, k, t;
    for (k in computed || {}) { if (own(computed, k)) out[k] = computed[k]; }
    for (k in fresh || {}) {
      if (!own(fresh, k)) continue;
      t = fresh[k];
      if (typeof t !== "number") continue;
      if (own(base, k) && !(t > base[k])) continue;
      if (!own(out, k) || out[k] < t) out[k] = t;
    }
    return out;
  }

  // شاهدٌ استجدّ أثناء الجولة = حذفٌ لم يُنشر ولم تره أي لقطة ⇒ يُمضى على نتيجة الدمج دائمًا
  function vetoFreshTombs(out, fo, fp, freshTombs, baseTombs) {
    var livePat = {}, i;
    for (i = 0; i < (fp || []).length; i++) livePat[ruleKey(fp[i])] = 1;
    var dropRules = {}, anyRule = false;
    for (var k in freshTombs || {}) {
      if (!own(freshTombs, k)) continue;
      var t = freshTombs[k];
      if (typeof t !== "number") continue;
      if (own(baseTombs, k) && !(t > baseTombs[k])) continue;
      if (k.indexOf(RULE_TOMB) === 0) {
        var rk = k.slice(RULE_TOMB.length);
        if (!livePat[rk]) { dropRules[rk] = 1; anyRule = true; }
        continue;
      }
      var bar = k.indexOf("|");
      if (bar < 1) continue;
      var lang = k.slice(0, bar), key = k.slice(bar + 1);
      if (fo[lang] && own(fo[lang], key)) continue;
      if (out.overrides[lang] && own(out.overrides[lang], key)) {
        delete out.overrides[lang][key];
        if (!Object.keys(out.overrides[lang]).length) delete out.overrides[lang];
      }
    }
    if (anyRule) out.patterns = out.patterns.filter(function (p) { return !dropRules[ruleKey(p)]; });
    return out;
  }

  function cloneOut(o) {
    var ov = {}, lang;
    for (lang in o.overrides || {}) { if (own(o.overrides, lang)) ov[lang] = copyObj(o.overrides[lang]); }
    return { overrides: ov, patterns: (o.patterns || []).slice() };
  }

  function stateNoTorn(st) {
    var c = copyObj(st);
    delete c.tornAt; delete c.tornSig;
    return c;
  }

  // ---- مغلّفات البيئة ---------------------------------------------------------
  function readError(where, msg) {
    var e = new Error("read " + where + ": " + msg);
    e.readError = true;
    return e;
  }
  function pGetLocal(env, keys) {
    return new Promise(function (res, rej) {
      env.getLocal(keys, function (r, err) { if (err) rej(readError("local", err)); else res(r || {}); });
    });
  }
  function pSetLocal(env, obj) {
    return new Promise(function (res, rej) {
      env.setLocal(obj, function (err) { if (err) rej(new Error(err)); else res(); });
    });
  }
  function pRemoveLocal(env, keys) {
    return new Promise(function (res, rej) {
      if (typeof env.removeLocal !== "function") { rej(new Error("removeLocal غير متاح")); return; }
      env.removeLocal(keys, function (err) { if (err) rej(new Error(err)); else res(); });
    });
  }
  function pGetSyncAll(env) {
    return new Promise(function (res, rej) {
      env.getSyncAll(function (r, err) { if (err) rej(readError("sync", err)); else res(r || {}); });
    });
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

  function ensureDevice(env, have) {
    if (have && typeof have === "string") return Promise.resolve(have);
    var id = "d" + env.now().toString(36) + "-" + Math.floor(Math.random() * 0xffffffff).toString(36);
    return pSetLocal(env, keyed(K.SYNC_DEVICE, id)).then(function () { return id; });
  }

  function pickRetry(a, b) {
    if (!b || !b.retryAt) return a;
    if (!a || !a.retryAt) return b;
    return b.retryAt < a.retryAt ? b : a;
  }
  function withRetry(r, d) {
    var p = pickRetry(r && r.retryAt ? r : null, d);
    if (!p || p === r) return r;
    var o = copyObj(r || {});
    o.retry = p.retry; o.retryAt = p.retryAt;
    return o;
  }

  // ---- المساحة ---------------------------------------------------------------
  // cfg = {id, meta, prefix, budget(snap)→بايتات, L: {overrides, patterns, tombs, lasthash,
  //        state, pending, dirty, recheck, known, vv}}
  // المفاتيح المشتركة بين المساحات: SYNC_ENABLED (موافقةٌ واحدة) وSYNC_DEVICE وSYNC_GEN.
  var spaces = [];

  function createSpace(cfg) {
    var L = cfg.L;
    var KS = { meta: cfg.meta, prefix: cfg.prefix };
    var budget = typeof cfg.budget === "function" ? cfg.budget : function () { return C.SYNC_TOTAL_BYTES; };
    // lim: حدود المعقِّم لهذه المساحة (null = حدود الواجهة)؛ low: أدنى أولوية (تُخلى لغيرها)
    var LIM = cfg.lim || null, LOW = !!cfg.low;

    // قفل الانشغال: العامل خيطٌ واحد لكن سلاسل الوعود تتشابك. لا يُسقَط متزاحم: علمُ
    // إعادةٍ في الذاكرة، وعلامةٌ دائمة (dirty) تنجو من موت العامل.
    var busy = false;
    var rerunLocal = false, rerunSync = false;
    var dirtyMark = false;
    var syncUnread = false; // آخرُ جولة سحابةٍ لم تقرأ اللقطة: العلامة الدائمة لا تُمحى
    var DRAIN_MAX = 4;
    var idleWaiters = [];
    var tombChain = Promise.resolve();

    function whenIdle() {
      return busy ? new Promise(function (res) { idleWaiters.push(res); }) : Promise.resolve();
    }
    function flushIdle() {
      if (busy || !idleWaiters.length) return;
      var w = idleWaiters; idleWaiters = [];
      for (var i = 0; i < w.length; i++) { try { w[i](); } catch (e) {} }
    }
    function markDirty(env) {
      if (dirtyMark) return Promise.resolve();
      return pSetLocal(env, keyed(L.dirty, 1)).then(function () { dirtyMark = true; }, function () {});
    }
    function clearDirty(env) {
      dirtyMark = false;
      return pSetLocal(env, keyed(L.dirty, 0)).catch(function () {});
    }

    // drain يعيد أبكر موعد إعادةٍ طلبته جولةٌ أُعيدت (كانت نتائجها تُرمى فلا يُسلَّح مؤقّت)
    function drain(env, left) {
      if (left <= 0) return Promise.resolve(null);
      if (rerunSync) {
        rerunSync = false;
        return runGuarded(syncCore, env, keyed(KS.meta, {}), left - 1);
      }
      if (rerunLocal) {
        rerunLocal = false;
        return runGuarded(localCore, env, null, left - 1);
      }
      if (dirtyMark && !syncUnread) return clearDirty(env).then(function () { return null; });
      return Promise.resolve(null);
    }
    function runGuarded(fn, env, changes, left) {
      busy = true;
      return fn(env, changes).then(
        function (r) { busy = false; return drain(env, left).then(function (d) { return withRetry(r, d); }); },
        function (e) { busy = false; return drain(env, left).then(function () { throw e; }); }
      );
    }
    function guarded(fn, kind) {
      return function (env, changes) {
        if (busy) {
          if (kind === "sync") rerunSync = true; else rerunLocal = true;
          return markDirty(env).then(function () { return { done: "deferred" }; });
        }
        return runGuarded(fn, env, changes, DRAIN_MAX).then(
          function (r) { flushIdle(); return r; },
          function (e) { flushIdle(); throw e; });
      };
    }

    function withTombLock(fn) {
      var run = tombChain.then(fn, fn);
      tombChain = run.then(function () {}, function () {});
      return run;
    }
    function recordTombs(env, removed, stamp) {
      return withTombLock(function () {
        return pGetLocal(env, [L.tombs]).then(function (r) {
          var t = copyObj(r[L.tombs] || {});
          for (var i = 0; i < (removed || []).length; i++) t[removed[i]] = stamp;
          var o = {};
          o[L.tombs] = pruneTombs(t, stamp);
          o[L.pending] = stamp;
          return pSetLocal(env, o);
        }, function () {
          return pSetLocal(env, keyed(L.pending, stamp));
        });
      });
    }
    function writeTombs(env, computed, base) {
      return withTombLock(function () {
        return pGetLocal(env, [L.tombs]).then(function (r) {
          return pSetLocal(env, keyed(L.tombs, mergeFreshTombs(computed, base, r[L.tombs] || {})));
        });
      });
    }

    // تعديلُ المستخدم الجزئي (رأس applyTermEdits في cml-shared.js) تحت قفل الدفتر نفسه الذي
    // تكتب تحته نتيجةُ الدمج: قراءةٌ طازجة ثم كتابةٌ واحدة لما تغيّر — فلا يطمس أحدُهما الآخر
    // gen (اختياري): جيلُ الإدارة الذي بدأت عليه العملية — أمرٌ مرّ بحوار تأكيدٍ ثم وقعت قبله
    // «إعادة ضبط» أو أمرُ إدارة لا يُكتب على حالٍ لم يره صاحبه
    function editLocal(env, lang, ops, gen) {
      return withTombLock(function () {
        return pGetLocal(env, [L.overrides, L.patterns, K.SYNC_GEN]).then(function (r) {
          if (typeof gen === "number" && (r[K.SYNC_GEN] || 0) !== gen) return { stale: true };
          var res = g.CMLShared.applyTermEdits(r[L.overrides], r[L.patterns], lang, ops,
            { textMax: LIM ? Math.ceil(LIM.valMax / 2) : TEXT_CAP, maxTerms: C.IMPORT_MAX_TERMS, maxRules: C.IMPORT_MAX_RULES,
              keyRe: LIM && LIM.keyRe });
          var w = {};
          if (res.ovChanged) w[L.overrides] = res.overrides;
          if (res.patChanged) w[L.patterns] = res.patterns;
          if (!res.ovChanged && !res.patChanged) return res.report;
          return pSetLocal(env, w).then(function () { return res.report; });
        });
      });
    }

    // الكتابة المحلية لنتيجة الدمج — قراءةٌ طازجة تحت قفل الدفتر ثم ذرّةٌ واحدة:
    // جيلٌ تغيّر ⇒ لا كتابة؛ ما غيّره المستخدم يفوز؛ ما حذفه للتوّ لا يُحيى؛ والمرفوع يُعقَّم بعدُ
    function commitLocal(env, gen0, raw, merged, computedTombs, baseTombs, extraFor) {
      return withTombLock(function () {
        return pGetLocal(env, [L.overrides, L.patterns, L.tombs, K.SYNC_ENABLED, K.SYNC_GEN, L.pending])
          .then(function (fr) {
            if (fr[K.SYNC_ENABLED] !== true || (fr[K.SYNC_GEN] || 0) !== gen0) return { superseded: true };
            var fo = fr[L.overrides] || {}, fp = fr[L.patterns] || [];
            var out = {
              overrides: rebaseOverrides(merged.overrides, raw.overrides, fo),
              patterns: rebaseRules(merged.patterns, raw.patterns, fp),
            };
            out = vetoFreshTombs(cloneOut(out), fo, fp, fr[L.tombs] || {}, baseTombs);
            var push = sanitizePayload(out, LIM);
            var w = (extraFor && extraFor(push, fr)) || {};
            w[L.tombs] = dropTombsPresent(
              mergeFreshTombs(computedTombs, baseTombs, fr[L.tombs] || {}), out.overrides, out.patterns);
            if (hashPayload(out) !== hashPayload({ overrides: fo, patterns: fp })) {
              w[L.overrides] = out.overrides; w[L.patterns] = out.patterns;
            }
            return pSetLocal(env, w).then(function () { return { out: out, push: push }; });
          });
      });
    }
    // ★ (مراجعة مستقلة) صفرُ الطابع المعلّق بشرط أنه لم يتغيّر منذ قراءتنا: تعديلٌ يقع أثناء
    // الجولة يكتب طابعًا جديدًا ويسلّح مؤقّت التجميع، وكان صفرُ آخر الجولة يمحوه — فإن مات
    // العامل قبل المؤقّت لم يُدفع ذلك التعديل أبدًا (لا طابع يلتقطه الإيقاظ)
    function pendingClear(env, seen) {
      return pGetLocal(env, [L.pending]).then(function (x) {
        if ((x[L.pending] || 0) !== (seen || 0)) return null;
        return pSetLocal(env, keyed(L.pending, 0));
      }).catch(function () {});
    }
    function stillCurrent(env, gen0) {
      return pGetLocal(env, [K.SYNC_ENABLED, K.SYNC_GEN]).then(function (r) {
        return r[K.SYNC_ENABLED] === true && (r[K.SYNC_GEN] || 0) === gen0;
      });
    }
    function readFailed(env, e, retryKind) {
      var st = { status: "error", error: String((e && e.message) || e), at: env.now(), read: true };
      return pSetLocal(env, keyed(L.state, st)).catch(function () {}).then(function () {
        return { done: "read-error", retry: retryKind, retryAt: env.now() + C.SYNC_RETRY_MS };
      });
    }
    // وقت آخر تعديلٍ محلي: طابعُ «الإصلاح» ليس تعديلًا فلا يرجّح قيمنا على لقطةٍ أحدث
    function localEditAt(state, pending) {
      var p = pending || 0;
      if (state && state.repairAt && p === state.repairAt) p = 0;
      return Math.max((state && state.at) || 0, p);
    }

    var LK = [K.SYNC_ENABLED, L.overrides, L.patterns, L.tombs, L.lasthash, L.state, K.SYNC_DEVICE,
              L.pending, K.SYNC_GEN, L.known, L.vv, L.recheck];

    // ★ دفترٌ خالٍ: لا بصمة آخر مزامنة ولا متّجه ولا «معروف» — حالُ مساحةٍ أُعيد ضبطها وحدها
    // (C.keysOfDomain يمحو دفترها ويُبقي هويةَ الجهاز العامة). لقطةُ السحابة عندها من جهازنا نفسه،
    // وحارسُ «الصدى» (meta.device === device) كان يعدّها صدانا فلا يُدمجها أبدًا، ثم تدفع الجولةُ
    // التالية حالَنا الفارغة فوقها — فيضيع ما وعدت إعادةُ الضبط بإبقائه. دفترٌ خالٍ لا يعرف شيئًا
    // عمّا في السحابة فلا صدى عنده: يُدمج كأنه جهازٌ آخر (اتحادًا، ولا شواهد حذف).
    function freshLedger(r) {
      return !r[L.lasthash] && !(r[L.vv] && Object.keys(r[L.vv]).length) &&
             !(r[L.known] && Object.keys(r[L.known]).length);
    }

    // ★ (المراجعة الثالثة) لقطةٌ حمولتُها ما رأيناه لكن فيها ما لا نعرفه سببيًّا: متّجهٌ فيه
    // كتابةٌ لم نضمّها (تعديلٌ ثم رجوعٌ إلى القيمة نفسها على جهازٍ آخر)، أو نقطةٌ عندنا لم
    // تبلغها. اختصارُ «رأيناها» بالبصمة وحدها كان يُبقينا على نقاطٍ قديمة فيضيع تعديلنا
    // اللاحق ويعود ما نحذفه — فهذه تمرّ بالدمج (بلا دفع، إذ الحمولة واحدة).
    function causalNews(r, remote) {
      if (!remote || !remote.dots || !remote.vv) return false;
      var lvv = r[L.vv] || {}, kn = r[L.known] || {}, k;
      for (k in remote.vv) {
        if (own(remote.vv, k) && k.charAt(0) !== "~" && !(lvv[k] >= remote.vv[k])) return true;
      }
      for (k in kn) {
        var d = own(kn, k) && kn[k] && kn[k].d;
        if (validDot(d) && d[0].charAt(0) !== "~" && !(remote.vv[d[0]] >= d[1])) return true;
      }
      return false;
    }

    // «المعروف» والمتّجه من التخزين، مع جسر الترقية من 1.0.0 (جهازٌ بلا متّجه): آخرُ ما زامنه
    // الجهاز (lasthash) يُعرف محتواه من السحابة إن كانت لقطتُها هي هي — وهو الأدقّ، إذ قد
    // يكون الجهاز حذف شيئًا قبل أول جولةٍ له بعد التحديث — وإلا فمن حاله إن طابقه. فتُعطى
    // عناصرُه النقطة المشتركة ["~",0] ويُحفظ ذلك فورًا؛ وبلا مصدرٍ مطابق فسلالةٌ جديدة (اتحاد).
    function initCausal(env, r, clean, lasthash, remote) {
      if (r[L.vv]) return Promise.resolve({ known: r[L.known] || {}, vv: r[L.vv] });
      var known = {}, vv = {};
      if (lasthash && remote && hashPayload(remote.payload) === lasthash) {
        var src = sanitizePayload(remote.payload, LIM);
        known = remote.dots ? knownFrom(src, remote.dots) : bootstrapKnown(src);
        vv = remote.vv ? vvMax(remote.vv, {}) : { "~": 0 };
      } else if (lasthash && hashPayload(clean) === lasthash) {
        known = bootstrapKnown(clean);
        vv = { "~": 0 };
      }
      var w = {}; w[L.known] = known; w[L.vv] = vv;
      return pSetLocal(env, w).then(function () { return { known: known, vv: vv }; },
        function () { return { known: known, vv: vv }; });
    }

    // اللبّ المحلي: بعد مهلة التجميع في العامل، وعند الإيقاظ (changes=null)، وفي ذيل دمجِ syncCore
    function localCore(env, changes) {
      return pGetLocal(env, LK).then(function (r) {
        if (r[K.SYNC_ENABLED] !== true) {
          if (r[L.pending]) return pSetLocal(env, keyed(L.pending, 0)).then(function () { return { done: "disabled" }; });
          return { done: "disabled" };
        }
        var gen0 = r[K.SYNC_GEN] || 0;
        var now = env.now();
        var baseTombs = r[L.tombs] || {};
        var tombs = pruneTombs(baseTombs, now);
        var tombsDirty = false;
        var removed = [], i;
        if (changes && changes[L.overrides]) {
          removed = diffRemovedKeys(changes[L.overrides].oldValue, changes[L.overrides].newValue);
        }
        if (changes && changes[L.patterns]) {
          removed = removed.concat(diffRemovedRules(changes[L.patterns].oldValue, changes[L.patterns].newValue));
        }
        for (i = 0; i < removed.length; i++) { tombs[removed[i]] = now; tombsDirty = true; }
        if (tombsDirty) tombs = pruneTombs(tombs, now);

        var raw = { overrides: r[L.overrides] || {}, patterns: r[L.patterns] || [] };
        var live = dropTombsPresent(tombs, raw.overrides, raw.patterns);
        if (Object.keys(live).length !== Object.keys(tombs).length) { tombs = live; tombsDirty = true; }
        var lasthash = r[L.lasthash];
        var state = r[L.state] || {};
        var clean = sanitizePayload(raw, LIM);
        var curHash = hashPayload(clean);

        var pre = tombsDirty ? writeTombs(env, tombs, baseTombs) : Promise.resolve();
        return pre.then(function () {
          if (curHash === lasthash) {
            if (r[L.pending]) return pendingClear(env, r[L.pending]).then(function () { return { done: "echo" }; });
            return { done: "echo" };
          }
          return ensureDevice(env, r[K.SYNC_DEVICE]).then(function (device) {
            return pGetSyncAll(env).then(function (snap) {
              var ins = inspect(snap, KS);
              return initCausal(env, r, clean, lasthash, ins.remote).then(function (cs) {

              if (ins.kind === "unsupported") {
                var wU = {};
                wU[L.state] = { status: "unsupported", v: ins.meta && ins.meta.v, at: now };
                wU[L.pending] = 0;
                return pSetLocal(env, wU).then(function () { return { done: "unsupported" }; });
              }

              // لقطةٌ غير متّسقة: لا دفع فوقها إلا إن بقيت **هي نفسُها** ممزّقةً بعد المهلة
              if (ins.kind === "incomplete") {
                var sig = tornSig(snap, ins, KS);
                if (!(state.tornSig === sig && state.tornAt && now - state.tornAt >= C.SYNC_TORN_CONFIRM_MS)) {
                  var stW = copyObj(state);
                  if (stW.tornSig !== sig) { stW.tornAt = now; stW.tornSig = sig; }
                  return pSetLocal(env, keyed(L.state, stW)).then(function () {
                    return { done: "torn-wait", retry: "local", retryAt: stW.tornAt + C.SYNC_TORN_CONFIRM_MS + 1000 };
                  });
                }
              }

              var remote = ins.remote;
              var payload = clean;
              var known = cs.known, vv = cs.vv;
              var step;
              if (remote && (remote.meta.device !== device || freshLedger(r)) &&
                  (hashPayload(remote.payload) !== lasthash || causalNews(r, remote))) {
                var m = mergeIn(
                  { overrides: clean.overrides, patterns: clean.patterns, tombs: tombs,
                    at: localEditAt(state, r[L.pending]),
                    everSynced: !!lasthash && curHash === lasthash,
                    known: cs.known, vv: cs.vv, device: device },
                  remote, now, LIM);
                var remoteHash = hashPayload(remote.payload);
                // ما عرفناه بعد الدمج: قيم الدمج ونقاطها (لا ما أعاد المستخدم كتابته أثناءه)
                known = knownFrom(m, m.dots);
                vv = m.vv;
                var adopted = false;
                step = commitLocal(env, gen0, raw, withLocalExtras(m, raw, clean), m.tombs, baseTombs,
                  function (push, fr) {
                    var wA = {};
                    wA[L.known] = known;
                    wA[L.vv] = vv;
                    if (hashPayload(push) !== remoteHash) return wA;
                    // الدمج طابق البعيد: تبنٍّ بلا دفع
                    adopted = true;
                    wA[L.lasthash] = remoteHash;
                    if ((fr[L.pending] || 0) === (r[L.pending] || 0)) wA[L.pending] = 0;
                    if (state.tornAt || state.tornSig) wA[L.state] = stateNoTorn(state);
                    return wA;
                  }).then(function (c) {
                    if (c.superseded) return "superseded";
                    if (adopted) return "adopted";
                    payload = c.push;
                    return null;
                  });
              } else {
                step = stillCurrent(env, gen0).then(function (ok) { return ok ? null : "superseded"; });
              }

              return step.then(function (early) {
                if (early === "adopted") return { done: "adopted" };
                if (early === "superseded") return { done: "superseded" };
                var metaRev = ins.meta && typeof ins.meta.rev === "number" ? ins.meta.rev : 0;
                var rev = Math.max(remote ? remote.meta.rev || 0 : 0, metaRev, state.rev || 0) + 1;
                // نقاط الدفعة: ما لم يتغيّر عن «المعروف» بنقطته، وكلُّ كتابةٍ محلية لم تُنشر بنقطةٍ
                // جديدة [جهازنا، عدّادٌ جديد] — ويصعد عدّادُنا في المتّجه بها
                var ctr = hlc(vv[device], now), dots = {}, dirty = false, items = itemsOf(payload);
                for (var ii = 0; ii < items.length; ii++) {
                  var kn = known[items[ii].id];
                  if (kn && validDot(kn.d) && kn.h === vh(items[ii].v)) dots[items[ii].id] = kn.d;
                  else { dots[items[ii].id] = [device, ctr]; dirty = true; }
                }
                var vvPush = vvMax(vv, {});
                if (dirty) vvPush[device] = ctr;
                var packOpt = {
                  rev: rev, device: device, now: now, prevChunks: chunkCountIn(snap, KS.prefix),
                  x: encodeX(payload, dots, vvPush), meta: KS.meta, prefix: KS.prefix, cap: budget(snap),
                };
                var packed = pack(payload, packOpt);
                // ★ (المراجعة الثالثة) مجموعةٌ تسعها المساحة في 1.0.0 لا تفيض بعد التحديث بسبب x
                // (نحو ثماني بايتات للعنصر): تُدفع بلا x فيقرؤها الجميع بقاعدة 1.0.0 — دقةٌ أقل قرب
                // السقف خيرٌ من مزامنةٍ في اتجاهٍ واحد
                if (!packed.fits) { packOpt.x = null; packed = pack(payload, packOpt); }
                if (!packed.fits) {
                  var wOver = {};
                  wOver[L.state] = { status: "overflow", need: packed.need, cap: budget(snap), at: now };
                  // ★ المساحة الدنيا لا تُبقي لقطتها القديمة في السحابة حين لا تسع: تُفسح لما هو أعلى منها
                  // (السحابة الفارغة تُدمج بعدُ اتحادًا عند كل جهاز، فلا فقد)
                  if (LOW && ourCloudKeys(snap).length) {
                    wOver[L.lasthash] = null;
                    return pRemoveSync(env, ourCloudKeys(snap)).catch(function () {})
                      .then(function () { return pSetLocal(env, wOver); })
                      .then(function () { return pendingClear(env, r[L.pending]); })
                      .then(function () { return { done: "overflow" }; });
                  }
                  // لا إعادة لدفعٍ لا يسع — إلا تعديلًا جديدًا (حذفُ تصحيحاتٍ ليسع مثلًا) طُبع أثناء الجولة
                  return pSetLocal(env, wOver).then(function () { return pendingClear(env, r[L.pending]); })
                    .then(function () { return { done: "overflow" }; });
                }
                var chunkSets = {};
                for (var kk in packed.sets) {
                  if (own(packed.sets, kk) && kk !== KS.meta) chunkSets[kk] = packed.sets[kk];
                }
                return yieldLow(env, snap, packed.bytes).then(function () { return pSetSync(env, chunkSets); })
                  .then(function () { return pSetSync(env, keyed(KS.meta, packed.meta)); })
                  .then(function () { return packed.removes.length ? pRemoveSync(env, packed.removes) : null; })
                  .then(function () {
                    var h = hashPayload(payload);
                    var wOk = {};
                    wOk[L.lasthash] = h;
                    wOk[L.state] = { status: "ok", bytes: packed.bytes, count: packed.meta.count, at: now, rev: rev };
                    wOk[L.known] = knownFrom(payload, dots);
                    wOk[L.vv] = vvPush;
                    if (r[L.recheck]) wOk[L.recheck] = 0;
                    return pSetLocal(env, wOk).then(function () { return pendingClear(env, r[L.pending]); })
                      .then(function () { return { done: "pushed", rev: rev }; });
                  }, function (e) {
                    // فشلت كتابة السحابة: الحال تُسجَّل والطابع المعلّق يُحفظ (ولو جئنا من ذيل دمجٍ
                    // بلا طابع) — فيعيدها المؤقّت أو الإيقاظ
                    var wErr = {};
                    wErr[L.state] = { status: "error", error: String(e && e.message || e), at: now };
                    wErr[L.pending] = r[L.pending] || now;
                    return pSetLocal(env, wErr).then(function () {
                      return { done: "error", retry: "local", retryAt: now + C.SYNC_RETRY_MS };
                    });
                  });
              });
              });
            });
          });
        });
      }).catch(function (e) {
        if (e && e.readError) return readFailed(env, e, "local");
        throw e;
      });
    }

    // لبّ حدث السحابة: لقطة من جهاز آخر — فكّها، ادمجها، وادفع الزيادة إن وُجدت
    function syncCore(env, changes) {
      var oursEv = false;
      for (var ck in changes || {}) {
        if (!own(changes, ck)) continue;
        if (ck === KS.meta || ck.indexOf(KS.prefix) === 0) { oursEv = true; break; }
      }
      if (!oursEv) return Promise.resolve({ done: "ignored" });

      return pGetLocal(env, LK).then(function (r) {
        if (r[K.SYNC_ENABLED] !== true) { syncUnread = false; return { done: "disabled" }; }
        var device = r[K.SYNC_DEVICE];
        var gen0 = r[K.SYNC_GEN] || 0;
        var state = r[L.state] || {};
        // حكمٌ متّسق (غير «انتظر»): يُمحى موعد إعادة الفحص وشاهد التمزّق، ومعه ما يُمرَّر
        function settled(res, extra) {
          syncUnread = false;
          var w = extra || {};
          if (r[L.recheck]) w[L.recheck] = 0;
          if (state.tornAt || state.tornSig) w[L.state] = stateNoTorn(state);
          if (!Object.keys(w).length) return res;
          return pSetLocal(env, w).then(function () { return res; }, function () { return res; });
        }

        var mc = changes[KS.meta], fresh = freshLedger(r);
        if (mc && mc.newValue && device && mc.newValue.device === device && !fresh) return settled({ done: "self" });

        return pGetSyncAll(env).then(function (snap) {
          var ins = inspect(snap, KS);
          if (ins.kind === "empty" || (ins.kind === "incomplete" && !ins.meta)) {
            // ★ السحابة مُسحت (أو لم تُكتب): أساسُنا لم يعد يصف ما فيها — فأول لقطةٍ تأتي بعدُ
            // تُدمج اتحادًا لا حذفًا (كانت لقطةٌ صغيرة تمحو تصحيحات هذا الجهاز كلها)
            var wE = {};
            if (r[L.lasthash]) wE[L.lasthash] = null;
            return settled({ done: "empty" }, wE);
          }
          if (ins.kind === "unsupported") return settled({ done: "unsupported" });
          if (ins.kind === "incomplete") {
            syncUnread = false;
            var nowT = env.now();
            // لم نزامن قط (لا بصمة ولا سلالة): ليس عندنا ما نصلح به. والمسحُ يمحو البصمة
            // والأساس لا السلالة، فجهازٌ زامن قبل المسح يبقى أهلًا للإصلاح
            if (!r[L.lasthash] && !(r[L.vv] && Object.keys(r[L.vv]).length)) return { done: "torn" };
            if (r[L.pending]) return { done: "torn" };      // دفعةٌ معلّقة أصلًا ستصلحها
            if (state.repairAt && nowT - state.repairAt < C.SYNC_REPAIR_MIN_MS) return { done: "torn" };
            var sig = tornSig(snap, ins, KS);
            if (!(state.tornSig === sig && state.tornAt && nowT - state.tornAt >= C.SYNC_TORN_CONFIRM_MS)) {
              var stW = copyObj(state);
              if (stW.tornSig !== sig) { stW.tornAt = nowT; stW.tornSig = sig; }
              var due = stW.tornAt + C.SYNC_TORN_CONFIRM_MS + 1000;
              var wT = {};
              wT[L.state] = stW;
              wT[L.recheck] = due;
              return pSetLocal(env, wT).then(function () { return { done: "torn", retry: "sync", retryAt: due }; });
            }
            // التمزّق هو هو بعد المهلة: الإصلاح بدفعةٍ متّسقة (tornAt/tornSig يبقيان فتراها
            // localCore مثبَّتةً فتدفع فورًا — إلا إن تبدّلت اللقطة في الأثناء)
            var stCopy = copyObj(state);
            stCopy.repairAt = nowT;
            var metaRev = (ins.meta && ins.meta.rev) || 0;
            if (metaRev > (stCopy.rev || 0)) stCopy.rev = metaRev;
            var wR = {};
            wR[L.pending] = nowT;
            wR[L.state] = stCopy;
            wR[L.lasthash] = null;
            wR[L.recheck] = 0;
            return pSetLocal(env, wR).then(function () { return { done: "repair" }; });
          }
          var remote = ins.remote;
          if (device && remote.meta.device === device && !fresh) return settled({ done: "self" });
          // ★ لقطة تطبيقٍ بلا x كتبها جهازٌ بنواة 1.0.0 (لا يعرف الإخلاء ولا مفاتيح الفقرات): تُخلى الفقرات
          // الآن إن ضيّقت عليه سقفه كاملًا، وميزانيتها تحجزه ما دامت لقطته هي القائمة (domainBudget)
          if (cfg.id === "app" && !remote.dots) yieldLow(env, snap, C.SYNC_TOTAL_BYTES).catch(function () {});

          var remoteHash = hashPayload(remote.payload);
          var lasthash = r[L.lasthash];
          if (remoteHash === lasthash && !causalNews(r, remote)) return settled({ done: "seen" });

          syncUnread = false;
          var now = env.now();
          var raw = { overrides: r[L.overrides] || {}, patterns: r[L.patterns] || [] };
          var clean = sanitizePayload(raw, LIM);
          var baseTombs = r[L.tombs] || {};
          return initCausal(env, r, clean, lasthash, remote).then(function (cs) {
          var m = mergeIn(
            { overrides: clean.overrides, patterns: clean.patterns, tombs: baseTombs,
              at: localEditAt(state, r[L.pending]),
              everSynced: !!lasthash && hashPayload(clean) === lasthash,
              known: cs.known, vv: cs.vv, device: device },
            remote, now, LIM);
          return commitLocal(env, gen0, raw, withLocalExtras(m, raw, clean), m.tombs, baseTombs,
            function () {
              // lasthash = بصمة البعيد: إن زاد الدمجُ عليه دفعه localCore بعدنا بنقاطه
              var w = {};
              w[L.lasthash] = remoteHash;
              w[L.known] = knownFrom(m, m.dots);
              w[L.vv] = m.vv;
              if (r[L.recheck]) w[L.recheck] = 0;
              if (state.tornAt || state.tornSig) w[L.state] = stateNoTorn(state);
              return w;
            }).then(function (c) {
              if (c.superseded) return { done: "superseded" };
              if (hashPayload(c.push) === remoteHash) return { done: "merged" };
              return localCore(env, null).then(function (pr) {
                return { done: "merged+push", push: pr && pr.done, retry: pr && pr.retry, retryAt: pr && pr.retryAt };
              });
            });
          });
        });
      }).catch(function (e) {
        if (!(e && e.readError)) throw e;
        // حدثٌ لم نستطع قراءته: العلامة الدائمة تضمن إعادته عند الإيقاظ، ولا يمحوها drain
        syncUnread = true;
        return markDirty(env).then(function () { return readFailed(env, e, "sync"); });
      });
    }

    // ★ (المرحلة ٢) أولوية الواجهة: ميزانيتها لا تعدّ مفاتيح المساحات الدنيا (تصحيحات الفقرات)، فإن لم
    // تسع السحابةُ الفعلية دفعتَها مُحيت تلك المفاتيح قبل الكتابة وسُجّلت حالُ أصحابها «أُخليت» مع طابعٍ
    // معلّق فتعيد المحاولة بميزانيتها الجديدة. محوُ مساحةٍ من السحابة لا يمحو شيئًا محليًّا: لقطةٌ فارغة
    // تُدمج بعدها اتحادًا لا حذفًا (syncCore، «empty») — فلا فقدَ على أي جهاز.
    function yieldLow(env, snap, need) {
      if (LOW) return Promise.resolve();
      // ★ (مراجعة المرحلة ٢) كل مفتاحٍ أدنى يُحسب ويُخلى — ولو لمساحةٍ لا يعرفها هذا البناء (إصدارٌ آخر) —
      // لأن ميزانية الواجهة تتجاهلها كلها؛ ولا إخلاء إلا إن جعل الدفعَ يسع (وإلا فإخلاءٌ فدفعٌ فاشل فإعادة
      // رفعٍ فإخلاء… كل عشرين ثانية)
      var used = 0, lowBytes = 0, lowKeys = [], hit = {};
      for (var k in snap || {}) {
        if (!own(snap, k) || k === KS.meta || k.indexOf(KS.prefix) === 0) continue;
        var kb = byteLen(k) + jsonBytes(snap[k]);
        used += kb;
        if (!isLowKey(k)) continue;
        lowKeys.push(k); lowBytes += kb;
        for (var i = 0; i < spaces.length; i++) {
          if (spaces[i].low && spaces[i].owns(k)) { hit[i] = spaces[i]; break; }
        }
      }
      var room = C.SYNC_CHROME_TOTAL - C.SYNC_DOMAIN_MARGIN - used;
      if (!lowKeys.length || need <= room || need > room + lowBytes) return Promise.resolve();
      var now = env.now(), w = {};
      for (var j in hit) {
        if (!own(hit, j)) continue;
        w[hit[j].L.state] = { status: "yielded", at: now };
        w[hit[j].L.pending] = now;
        w[hit[j].L.lasthash] = null;   // أساسُها لم يعد يصف السحابة (كما يفعل حدث «empty») فلا «صدى» يُسكتها
      }
      return pRemoveSync(env, lowKeys).then(function () { return pSetLocal(env, w).catch(function () {}); });
    }

    function ourCloudKeys(all) {
      var keys = [];
      for (var k in all || {}) {
        if (!own(all, k)) continue;
        if (k === KS.meta || k.indexOf(KS.prefix) === 0) keys.push(k);
      }
      return keys;
    }

    var sp = {
      id: cfg.id, keys: KS, L: L, low: LOW, lim: LIM,
      handleLocalChange: guarded(localCore, "local"),
      handleSyncChange: guarded(syncCore, "sync"),
      recordTombs: recordTombs,
      editLocal: editLocal,
      clearDirty: clearDirty,
      ourCloudKeys: ourCloudKeys,
      owns: function (k) { return k === KS.meta || k.indexOf(KS.prefix) === 0; },
      // للمنسّق وحده: إمساكٌ حصري وتحريرٌ مع تصريف المؤجَّل
      _whenIdle: whenIdle,
      _isBusy: function () { return busy; },
      _hold: function () { busy = true; },
      _release: function (env) {
        busy = false;
        return drain(env, DRAIN_MAX).then(function () { flushIdle(); });
      },
      _dropQueued: function () { rerunLocal = false; },
      _resetMarks: function () { rerunLocal = false; rerunSync = false; dirtyMark = false; syncUnread = false; },
    };
    spaces.push(sp);
    return sp;
  }

  // ---- أوامر الإدارة: كاتبٌ واحد (مراجعة كودكس ٦) --------------------------------
  // تنتظر فراغ **كل** المساحات ثم تمسكها معًا، وترفع جيل المزامنة، ولا تردّ إلا بعد التمام.
  function holdAll() {
    return Promise.all(spaces.map(function (s) { return s._whenIdle(); })).then(function () {
      for (var i = 0; i < spaces.length; i++) { if (spaces[i]._isBusy()) return holdAll(); }
      for (var j = 0; j < spaces.length; j++) spaces[j]._hold();
      return null;
    });
  }
  function releaseAll(env) {
    return Promise.all(spaces.map(function (s) { return s._release(env); }));
  }

  // مساحاتُ موقعٍ واحد (مساحة واجهته ومساحة فقراته إن كانت) — أو كلها بلا موقع
  function spacesOf(dom) {
    if (!dom) return spaces;
    return spaces.filter(function (sp) { return sp.id === dom || sp.id === "blocks:" + dom; });
  }
  function wipeCloud(env, gen, list) {
    list = list || spaces;
    return pGetSyncAll(env).then(function (all) {
      var keys = [];
      for (var i = 0; i < list.length; i++) keys = keys.concat(list[i].ourCloudKeys(all));
      if (!keys.length) return { ok: true, empty: true };
      return pRemoveSync(env, keys).then(function () {
        // دفعةٌ مؤجّلة من قبل المسح لا تُعيد رفع ما مُحي للتوّ
        for (var j = 0; j < list.length; j++) list[j]._dropQueued();
        var rm = [], w = {};
        return pGetLocal(env, list.map(function (s) { return s.L.state; })).then(function (st) {
          for (var s = 0; s < list.length; s++) {
            var L = list[s].L;
            rm.push(L.lasthash);
            var prev = st[L.state] || {};
            w[L.state] = { status: "wiped", at: env.now(), rev: prev.rev || 0 };
            w[L.pending] = 0;
          }
          w[K.SYNC_GEN] = gen;
          return pRemoveLocal(env, rm).then(function () { return pSetLocal(env, w); });
        }).then(function () { return { ok: true }; }, function (e) {
          return { ok: true, stateErr: String((e && e.message) || e) };
        });
      });
    }).catch(function (e) { return { error: String((e && e.message) || e) }; });
  }

  function admin(env, op, opt) {
    opt = opt || {};
    return holdAll().then(function () {
      return pGetLocal(env, [K.SYNC_GEN]).then(function (r) {
        var gen = (r[K.SYNC_GEN] || 0) + 1;
        var w = {};
        if (op === "enable") {
          w[K.SYNC_ENABLED] = true; w[K.SYNC_GEN] = gen;
          return pSetLocal(env, w).then(function () { return { ok: true }; });
        }
        if (op === "disable") {
          for (var i = 0; i < spaces.length; i++) { spaces[i]._dropQueued(); w[spaces[i].L.pending] = 0; }
          w[K.SYNC_ENABLED] = false; w[K.SYNC_GEN] = gen;
          return pSetLocal(env, w).then(function () { return { ok: true }; });
        }
        if (op === "wipe") return wipeCloud(env, gen);
        if (op === "reset") {
          // ★ إعادة ضبط موقعٍ واحد (opt.domain مع opt.keys من العامل بعد التحقق): المسحُ البعيد
          // وتصفيرُ العلامات لمساحاته وحدها — فلا تُمحى سحابةُ المواقع الأخرى ولا تسقط دفعاتُها المعلّقة
          var list = spacesOf(opt.domain);
          var pre = opt.wipe ? wipeCloud(env, gen, list) : Promise.resolve({ ok: true, skipped: true });
          return pre.then(function (res) {
            if (res.error) return res;
            for (var j = 0; j < list.length; j++) list[j]._resetMarks();
            var rmKeys = opt.keys || C.RESET_KEYS;
            // موقعٌ واحد مُسحت سحابتُه فعلًا: حالُه «مُحي ما رُفع» (كتبها wipeCloud للتوّ) تبقى صادقةً
            // معروضة — لا تُمحى مع دفتره فيبدو كأنه لم يُرفع شيءٌ قط
            if (opt.domain && res.ok && !res.empty && !res.skipped) {
              var keepSt = list.map(function (s) { return s.L.state; });
              rmKeys = rmKeys.filter(function (k) { return keepSt.indexOf(k) < 0; });
            }
            return pRemoveLocal(env, rmKeys).then(function () {
              return pSetLocal(env, keyed(K.SYNC_GEN, gen));
            }).then(function () { res.reset = true; return res; },
              function (e) { return { error: String((e && e.message) || e), wiped: !!(res.ok && !res.empty && !res.skipped) }; });
          });
        }
        return { error: "أمرٌ مجهول: " + op };
      });
    }).then(function (res) {
      return releaseAll(env).then(function () { return res; });
    }, function (e) {
      return releaseAll(env).then(function () { return { error: String((e && e.message) || e) }; });
    });
  }

  // ---- مساحة التطبيق (صيغة 1.0.0 المجمَّدة) ------------------------------------
  var APP = createSpace({
    id: "app", meta: K.SYNC_META, prefix: K.SYNC_CHUNK_PREFIX,
    budget: function () { return C.SYNC_TOTAL_BYTES; },
    L: {
      overrides: K.OVERRIDES, patterns: K.USER_PATTERNS, tombs: K.SYNC_TOMBS, lasthash: K.SYNC_LASTHASH,
      state: K.SYNC_STATE, pending: K.SYNC_PENDING, dirty: K.SYNC_DIRTY, recheck: K.SYNC_RECHECK,
      known: K.SYNC_KNOWN, vv: K.SYNC_VV,
    },
  });

  // ---- مساحات النطاقات (١-٠ب): مفاتيح محلية بلاحقة النطاق، ومفاتيح سحابةٍ لا تبدأ ببادئة
  // 1.0.0 (cml_syncd_) فلا يعدّها جهازٌ قديم من شرائحه ولا يمسحها مسحُه. وسعتُها ما تبقّى
  // من سقف كروم الكلي بعد سائر المفاتيح ناقصًا هامشًا (قرار المالك ق١٠: بأفضل جهد — ما لا يسع
  // يبقى محليًّا بحالٍ صريحة «overflow» ويُعاد عند أول تغيير، بلا فقدٍ ولا مساسٍ بمساحة التطبيق).
  function isLowKey(k) { return k.indexOf("cmlbm_") === 0 || k.indexOf("cmlbc_") === 0; }
  function appBytes(snap) {
    var b = 0;
    for (var k in snap || {}) if (own(snap, k) && (k === APP_KEYS.meta || k.indexOf(APP_KEYS.prefix) === 0)) b += byteLen(k) + jsonBytes(snap[k]);
    return b;
  }
  function domainBudget(ownsKey, low) {
    return function (snap) {
      var used = 0, mine = 0;
      for (var k in snap || {}) {
        if (!own(snap, k)) continue;
        if (ownsKey(k)) { mine += byteLen(k) + jsonBytes(snap[k]); continue; }
        if (!low && isLowKey(k)) continue;   // الواجهة لا ترى الفقرات عائقًا: تُخليها عند الحاجة (yieldLow)
        used += byteLen(k) + jsonBytes(snap[k]);
      }
      var room = C.SYNC_CHROME_TOTAL - C.SYNC_DOMAIN_MARGIN - used;
      if (!low) return Math.max(0, room);
      // ★ الهامش على النموّ الصافي وحده: لقطةٌ لا تزيد على ما تشغله المساحة الآن تُستبدل دائمًا (حذفٌ يُرفع
      // ولو ضاق الهامش)؛ وما دامت لقطة التطبيق القائمة من نواة 1.0.0 (بلا x) يُحجز لها سقفها كاملًا
      var reserve = C.SYNC_BLOCK_HEADROOM, app = unpack(snap, APP_KEYS);
      if (app && !app.dots) reserve = Math.max(reserve, C.SYNC_TOTAL_BYTES - appBytes(snap));
      return Math.max(0, room - reserve, Math.min(mine, room));
    };
  }
  var DOMAIN_SPACES = {};
  (C.DOMAINS || []).forEach(function (d) {
    if (d.id === "app") return;
    var meta = "cmlm_" + d.id, prefix = "cmlc_" + d.id + "_";
    function ownsKey(k) { return k === meta || k.indexOf(prefix) === 0; }
    function lk(base) { return C.key(base, d.id); }
    DOMAIN_SPACES[d.id] = createSpace({
      id: d.id, meta: meta, prefix: prefix,
      budget: domainBudget(ownsKey),
      L: {
        overrides: lk(K.OVERRIDES), patterns: lk(K.USER_PATTERNS), tombs: lk(K.SYNC_TOMBS),
        lasthash: lk(K.SYNC_LASTHASH), state: lk(K.SYNC_STATE), pending: lk(K.SYNC_PENDING),
        dirty: lk(K.SYNC_DIRTY), recheck: lk(K.SYNC_RECHECK), known: lk(K.SYNC_KNOWN), vv: lk(K.SYNC_VV),
      },
    });
  });
  // ★★ مساحات تصحيحات الفقرات (المرحلة ٢، قرار المالك ق٢): لكل نطاقٍ ذي متون مساحةٌ بأدنى أولوية —
  // مفاتيح سحابةٍ مستقلة (cmlbm_/cmlbc_)، ومفاتيحها بصماتٌ وقيمها قوالب حتى BLOCK_VAL_MAX، والقواعد فيها فارغة
  // دائمًا (cml_block_pat). الفيضُ كما في مساحات النطاقات: لا يُدفع ما لا يسع، ويبقى محليًّا بحالٍ صريحة.
  var BLOCK_SPACES = {};
  (C.DOMAINS || []).forEach(function (d) {
    if (!d.meta || !d.meta.bodies) return;
    var meta = "cmlbm_" + d.id, prefix = "cmlbc_" + d.id + "_";
    function ownsKey(k) { return k === meta || k.indexOf(prefix) === 0; }
    function lk(base) { return C.key(base, d.id); }
    BLOCK_SPACES[d.id] = createSpace({
      id: "blocks:" + d.id, meta: meta, prefix: prefix, low: true,
      lim: { keyMax: 16, valMax: C.BLOCK_VAL_MAX || 8000, keyRe: /^[0-9a-f]{16}$/ },
      budget: domainBudget(ownsKey, true),
      L: {
        overrides: lk("cml_block_ov"), patterns: lk("cml_block_pat"), tombs: lk("cml_bsync_tombs"),
        lasthash: lk("cml_bsync_lasthash"), state: lk("cml_bsync_state"), pending: lk("cml_bsync_pending"),
        dirty: lk("cml_bsync_dirty"), recheck: lk("cml_bsync_recheck"), known: lk("cml_bsync_known"), vv: lk("cml_bsync_vv"),
      },
    });
  });
  function spaceOfBlocks(id) { return BLOCK_SPACES[id] || null; }
  // المساحة التي يملكها مفتاحٌ محلي (تصحيحاتٌ أو قواعد) أو مفتاح سحابة
  function spaceOfLocal(k) {
    for (var i = 0; i < spaces.length; i++) {
      if (spaces[i].L.overrides === k || spaces[i].L.patterns === k || spaces[i].L.pending === k) return spaces[i];
    }
    return null;
  }
  function spaceOfDomain(id) { return id === "app" ? APP : (DOMAIN_SPACES[id] || null); }
  function spaceOfCloud(k) {
    for (var i = 0; i < spaces.length; i++) if (spaces[i].owns(k)) return spaces[i];
    return null;
  }

  g.CMLSync = {
    byteLen: byteLen,
    jsonBytes: jsonBytes,
    hashPayload: hashPayload,
    countPayload: countPayload,
    pack: pack,
    unpack: unpack,
    inspect: inspect,
    tornSig: tornSig,
    sanitizePayload: sanitizePayload,
    mergeIn: mergeIn,
    encodeX: encodeX,
    decodeX: decodeX,
    knownFrom: knownFrom,
    ruleKey: ruleKey,
    RULE_TOMB: RULE_TOMB,
    diffRemovedKeys: diffRemovedKeys,
    diffRemovedRules: diffRemovedRules,
    dropTombsPresent: dropTombsPresent,
    pruneTombs: pruneTombs,
    mergeFreshTombs: mergeFreshTombs,
    createSpace: createSpace,
    spaces: spaces,
    app: APP,
    domainSpaces: DOMAIN_SPACES,
    spaceOfLocal: spaceOfLocal,
    spaceOfDomain: spaceOfDomain,
    spaceOfBlocks: spaceOfBlocks,
    blockSpaces: BLOCK_SPACES,
    spaceOfCloud: spaceOfCloud,
    // واجهة مساحة التطبيق (كما كانت) — sw.js والاختبارات القائمة
    recordTombs: APP.recordTombs,
    clearDirty: APP.clearDirty,
    handleLocalChange: APP.handleLocalChange,
    handleSyncChange: APP.handleSyncChange,
    admin: admin,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
