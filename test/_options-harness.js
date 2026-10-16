/* _options-harness.js — قشرة صفحتي اختبار الخيارات (_optionstest و_optionsrevtest): إطارٌ بصفحة
   الإعدادات أو النافذة الحقيقية فوق قشرة chrome جديدة وعامل خدمةٍ حقيقي (sw.js في الإطار نفسه)،
   وأدوات التحقق والانتظار. الصفحة تعرّف قبلها jsErrors وجدول النتائج #tbl.
   خيارات makeFrame: tabs (قشرة chrome.tabs للنافذة)، noAccess (permissions.contains ⇒ false:
   «الوصول إلى المواقع» مقيَّد في المتصفح — ج٣)، manifest (ما يُرجعه runtime.getManifest بدل مانيفست القشرة — ر8-ب). */
var EXT = new URL("../extension/", location.href).href;
var EXT_ID = "cmloptstest";
var XURL = "chrome-extension://" + EXT_ID + "/";
var tb = document.querySelector("#tbl tbody"), pass = 0, total = 0;
function check(name, expect, got) {
  total++; var ok = String(expect) === String(got); if (ok) pass++;
  var tr = document.createElement("tr");
  [name, expect, got].forEach(function (v) { var td = document.createElement("td"); td.textContent = v; tr.appendChild(td); });
  var s = document.createElement("td"); s.className = ok ? "ok" : "bad"; s.textContent = ok ? "✓" : "✗"; tr.appendChild(s);
  tb.appendChild(tr);
  document.title = (window.TEST_NAME || "options") + " " + pass + "/" + total + " …";
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function until(pred, ms) {
  var t0 = Date.now();
  return new Promise(function (res) {
    (function tick() {
      var v = false; try { v = pred(); } catch (e) {}
      if (v || Date.now() - t0 > (ms || 5000)) { res(v); return; }
      setTimeout(tick, 60);
    })();
  });
}
var FIX = {}; // ملفات الإضافة المزيّفة (فهرس المتون المشحون) — وما سواها يُقرأ من مجلد الإضافة نفسه
var OPTS_HTML = null, POPUP_HTML = null;

// ---- إطارٌ بصفحة الإعدادات أو النافذة الحقيقية فوق قشرةٍ جديدة وعاملٍ حقيقي ----
function makeFrame(page, seed, opts) {
  opts = opts || {};
  var box = document.getElementById("frames");
  box.innerHTML = ""; // إطارٌ واحد حيّ: أحداث localStorage لا تنتقل إلى إطارٍ قديم
  var mock = makeChromeMock({ session: true, sync: { itemBytes: 8192, totalBytes: 102400 } });
  Object.assign(mock.localStore, seed || {});
  var L = { message: [], connect: [], changed: 0 }, removes = [];
  var ch = mock.chrome;
  ch.runtime.id = EXT_ID;
  ch.runtime.getURL = function (p) { return XURL + (p || ""); };
  // ★ (ر8-ب) الاسم المختصر اسمُ 2.0.0 (short_name في المانيفست) لا اسم 1.0.0؛ وopts.manifest يستبدل المانيفست كلّه (احتياط الاسم في «حول»)
  // ★ (ر9-ج) والاسم المختصر «تعريب كلود» بالقرار 100
  ch.runtime.getManifest = function () { return opts.manifest || { short_name: "تعريب كلود", version: "2.0.0", version_name: "2.0.0 — اختبار" }; };
  ch.runtime.onMessage = { addListener: function (fn) { L.message.push(fn); } };
  ch.runtime.onConnect = { addListener: function (fn) { L.connect.push(fn); } };
  ch.runtime.openOptionsPage = function () { L.openedOptions = (L.openedOptions || 0) + 1; };
  var sender = { id: EXT_ID, url: XURL + page, tab: { id: 9 } };
  ch.runtime.sendMessage = function (msg, cb) {
    setTimeout(function () {
      var answered = false, async = false;
      function respond(v) { if (answered) return; answered = true; setTimeout(function () { if (cb) cb(v); }, 0); }
      L.message.forEach(function (fn) { if (fn(msg, sender, respond) === true) async = true; });
      if (!async && !answered && cb) cb(undefined);
    }, 0);
  };
  // المتصفح الحقيقي يبثّ onChanged عند الحذف أيضًا (القشرة المشتركة تصمت عمدًا لصفحاتٍ قديمة)
  var rm = ch.storage.local.remove;
  ch.storage.local.remove = function (keys, cb) {
    var list = Array.isArray(keys) ? keys : [keys], chg = {};
    list.forEach(function (k) { removes.push(k); if (mock.localStore[k] !== undefined) chg[k] = { oldValue: mock.localStore[k] }; });
    rm(keys, function () {
      if (Object.keys(chg).length) mock.fireChanged(chg, "local");
      if (cb) cb();
    });
  };
  var addL = ch.storage.onChanged.addListener;
  ch.storage.onChanged.addListener = function (fn) { L.changed++; addL(fn); };
  if (opts.tabs) ch.tabs = opts.tabs;
  // «الوصول إلى المواقع» مقيَّدٌ في المتصفح (كروم «عند النقر»، أو فايرفوكس بلا منح): contains ⇒ false
  if (opts.noAccess) ch.permissions = {
    contains: function (q, cb) { setTimeout(function () { cb(false); }, 0); },
    onAdded: { addListener: function () {} }, onRemoved: { addListener: function () {} },
  };
  var env = { mock: mock, L: L, removes: removes, blobs: [], confirms: [], w: null };
  window.__install = function (w) {
    env.w = w;
    w.chrome = ch;
    w.addEventListener("error", function () { jsErrors++; });
    var realFetch = w.fetch.bind(w);
    w.fetch = function (u, o) {
      var s = String(u);
      if (s.indexOf(XURL) === 0) {
        var rel = s.slice(XURL.length);
        if (FIX[rel] !== undefined) return Promise.resolve(new w.Response(FIX[rel] === null ? "" : JSON.stringify(FIX[rel]), { status: FIX[rel] === null ? 404 : 200 }));
        return realFetch(EXT + rel, o);
      }
      return Promise.reject(new Error("لا شبكة في الاختبار: " + s));
    };
    w.URL.createObjectURL = function (b) { env.blobs.push(b); return "blob:test"; };
    w.URL.revokeObjectURL = function () {};
    w.HTMLAnchorElement.prototype.click = function () {};
    w.confirm = function (m) { env.confirms.push(m); return true; };
  };
  var html = page === "options.html" ? OPTS_HTML : POPUP_HTML;
  var head = '<base href="' + EXT + '"><script>parent.__install(window);<\/script>';
  html = html.replace("<head>", "<head>" + head);
  if (page === "options.html") {
    html = html.replace('<script src="cml-shared.js"><\/script>',
      '<script src="cml-shared.js"><\/script><script src="cml-rtl.js"><\/script><script src="cml-arbiter.js"><\/script>' +
      '<script src="cml-sync.js"><\/script><script src="sw.js"><\/script>');
  }
  var ifr = document.createElement("iframe");
  ifr.srcdoc = html;
  box.appendChild(ifr);
  return until(function () { return env.w && env.w.document.readyState === "complete"; }, 15000).then(function () {
    env.$ = function (id) { return env.w.document.getElementById(id); };
    env.store = mock.localStore;
    return sleep(250).then(function () { return env; });
  });
}
function pick(env, v) {
  var s = env.$("domainSel"); s.value = v; s.dispatchEvent(new env.w.Event("change"));
  return sleep(120);
}
function toggle(env, id, val) {
  var el = env.$(id); el.focus(); if (el.checked !== val) el.click(); return sleep(80);
}
function visible(el) { return !!(el && el.getClientRects().length > 0); }
function sectionsShown(env) {
  return [].slice.call(env.w.document.querySelectorAll("[data-sec]")).map(function (s) { return s.getAttribute("data-sec") + (visible(s) ? "" : "(مخفي)"); }).join(",");
}
function blobText(env) { var b = env.blobs[env.blobs.length - 1]; return b ? b.text() : Promise.resolve(""); }
