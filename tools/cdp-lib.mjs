// cdp-lib.mjs — كروم بلا واجهة عبر أنبوب DevTools (بلا منفذ ولا تبعيات) لأدوات البناء.
// الأنبوب لا منفذ: لا يزاحم خادمًا ولا يُفتح لغير هذه العملية. (smoke-extension.mjs يحمل
// نسخته لأنه يحمّل الإضافة بخياراتٍ خاصة؛ هذه للأدوات التي تقرأ صفحاتٍ عادية.)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export function findChrome(explicit) {
  const want = explicit || process.env.CHROME || "";
  if (want) {
    if (fs.existsSync(want)) return want;
    throw new Error("المسار الصريح للمتصفح غير موجود: " + want);
  }
  const c = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    (process.env.LOCALAPPDATA || "") + "/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium-browser", "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  for (const p of c) { try { if (p && fs.existsSync(p)) return p; } catch {} }
  return null;
}

// ★ (ر5، ٢٩ ربيع الآخر ١٤٤٨هـ) ملف تعريف كروم المؤقت لأدوات السلسلة كلها: كان يُحذف بمؤقّتٍ unref() لا ينتظره أحد، فتخرج العملية
// قبله وتتراكم الملفات في مجلد النظام المؤقت (77 مجلدًا و3.1 غ.ب. في الحاوية). فالإغلاق الآن: إنهاء كروم ثم انتظار خروجه فعلًا بسقفٍ
// قصير (وبعده SIGKILL)، ثم الحذف بإعادات؛ ومعه احتياطٌ متزامن عند خروج العملية (process.on("exit")) يقتل كروم ويحذف ما بقي إن خرجت
// الأداة قبل الإغلاق (process.exit، أو استثناءٌ لم يُلتقط). ومجلد مقبس النسخة الواحدة الذي يربطه الملف بوصلة SingletonSocket
// (‎org.chromium.Chromium.*‎ في مجلد النظام المؤقت) يحذفه كروم في خروجه السليم وحده، فيُحذف هنا إن بقي بعد قتلٍ قسري.
//   const prof = tempProfile("cml-x-"[, "profile"])  ← {root, dir}: dir يُمرَّر إلى ‎--user-data-dir‎ (و"" = الجذر نفسه)
//   prof.track(proc) بعد التشغيل، ثم ‎await prof.close()‎ (يُعاد الوعد نفسه إن تكرّر النداء)
const SINGLETON_DIR = /^(?:org\.chromium\.Chromium|com\.google\.Chrome(?:\.\w+)?)\.[A-Za-z0-9]+$/;
export function tempProfile(prefix, sub = "profile") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const dir = sub ? path.join(root, sub) : root;
  let proc = null, closing = null;
  const alive = () => !!proc && proc.exitCode === null && proc.signalCode === null;
  // مجلد المقبس (إن بقيت وصلته في الملف): يُحذف بعد خروج كروم وحده، وبشرط أن يكون مجلدَ مقبسٍ مباشرةً تحت مجلد النظام المؤقت
  function dropSingleton() {
    let target;
    try { target = fs.readlinkSync(path.join(dir, "SingletonSocket")); } catch { return; }
    const sd = path.dirname(target);
    if (!SINGLETON_DIR.test(path.basename(sd)) || path.resolve(path.dirname(sd)) !== path.resolve(os.tmpdir())) return;
    try { fs.rmSync(sd, { recursive: true, force: true }); } catch {}
  }
  function dropNow() {
    if (!fs.existsSync(root)) return true;
    if (!alive()) dropSingleton();
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 }); } catch {}
    return !fs.existsSync(root);
  }
  // احتياط الخروج متزامن: قتلٌ قسري (فلا يحذف كروم مقبسه بنفسه) ثم حذف المقبس والملف.
  // ★ (ر5-ج، ٢٩ ربيع الآخر ١٤٤٨هـ — مراجعة ر5-أ F4) إن خرجت العملية وكروم ما زال يُقلع بقي الملف في 6 من 15 تجربة: عمليات كروم الفرعية
  // تكتب فيه لحظاتٍ بعد قتل أمّها فيسبقها الحذف الواحد. فالحذف يُعاد بنومٍ متزامنٍ قصير (Atomics.wait؛ لا حلقة أحداث عند الخروج) حتى يثبت
  // غيابُ الملف ثلاث مراتٍ متتالية، بسقف ثلاث ثوانٍ — في مسار الخروج غير المنظَّم وحده (الإغلاق المنتظَر يزيل هذا المستمع قبله)
  function sleepSync(ms) { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch {} }
  function onExit() {
    let killed = false;
    if (alive()) { try { proc.kill("SIGKILL"); killed = true; } catch {} dropSingleton(); }
    if (dropNow() && !killed) return;
    for (let t0 = Date.now(), quiet = 0; quiet < 3 && Date.now() - t0 < 3000;) {
      sleepSync(50);
      dropSingleton();
      quiet = dropNow() ? quiet + 1 : 0;
    }
  }
  process.on("exit", onExit);
  return {
    root, dir,
    track(p) { proc = p; },
    close(capMs = 5000) {
      if (closing) return closing;
      closing = (async () => {
        if (alive()) {
          const exited = new Promise((r) => proc.once("exit", r));
          try { proc.kill(); } catch {}   // SIGTERM: يُغلق كروم بسلام فيحذف مقبسه بنفسه
          let t = null;
          const ok = await Promise.race([exited.then(() => true), new Promise((r) => { t = setTimeout(() => r(false), capMs); })]);
          clearTimeout(t);
          if (!ok) {
            try { proc.kill("SIGKILL"); } catch {}
            await Promise.race([exited, new Promise((r) => { t = setTimeout(r, 1000); })]);
            clearTimeout(t);
          }
        }
        // عمليات كروم الفرعية قد تكتب لحظةً بعد خروج أمّها: إعاداتٌ بتراجع (وما لم يُحذف يبقى لاحتياط الخروج)
        for (let i = 0; i < 5 && !dropNow(); i++) await new Promise((r) => setTimeout(r, 200 * (i + 1)));
        if (!fs.existsSync(root)) process.removeListener("exit", onExit);
        try { if (proc) proc.unref(); } catch {}
      })();
      return closing;
    },
  };
}

// يشغّل كروم ويعيد {send, openPage, evalIn, until, closePage, close}
export async function launch({ chrome, extraArgs = [], headless = true } = {}) {
  const exe = chrome || findChrome();
  if (!exe) throw new Error("لم أجد كروم — مرّر --chrome=<المسار> أو CHROME.");
  const prof = tempProfile("cml-cdp-");
  const args = [
    "--remote-debugging-pipe", `--user-data-dir=${prof.dir}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--mute-audio",
    "--window-size=1366,900", ...extraArgs,
  ];
  if (headless) args.unshift("--headless=new");
  if (process.env.CI) args.push("--no-sandbox", "--disable-dev-shm-usage");
  const proc = spawn(exe, args, { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
  prof.track(proc);
  proc.stderr.on("data", () => {});
  let nextId = 1, buf = "";
  const pending = new Map();
  const out = proc.stdio[3], inp = proc.stdio[4];
  inp.on("data", (d) => {
    buf += d.toString("utf8");
    let i;
    while ((i = buf.indexOf("\0")) >= 0) {
      const raw = buf.slice(0, i); buf = buf.slice(i + 1);
      let m; try { m = JSON.parse(raw); } catch { continue; }
      if (m.id && pending.has(m.id)) {
        const { res, rej, timer } = pending.get(m.id); pending.delete(m.id);
        clearTimeout(timer);
        m.error ? rej(new Error(m.error.message || JSON.stringify(m.error))) : res(m.result);
      }
    }
  });
  function send(method, params, sessionId, timeoutMs = 60000) {
    return new Promise((res, rej) => {
      const id = nextId++;
      const timer = setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error("مهلة CDP: " + method)); } }, timeoutMs);
      pending.set(id, { res, rej, timer });
      const msg = { id, method, params: params || {} };
      if (sessionId) msg.sessionId = sessionId;
      out.write(JSON.stringify(msg) + "\0");
    });
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function openPage(url) {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    await send("Page.enable", {}, sessionId);
    await send("Page.navigate", { url }, sessionId);
    return { targetId, sessionId };
  }
  async function evalIn(sessionId, expr, timeoutMs) {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sessionId, timeoutMs);
    if (r.exceptionDetails) {
      throw new Error("خطأ في التقييم: " + (r.exceptionDetails.text || "") + " " +
        JSON.stringify(r.exceptionDetails.exception || {}).slice(0, 300));
    }
    return r.result ? r.result.value : undefined;
  }
  async function until(sessionId, expr, ms = 15000) {
    const t0 = Date.now();
    let v;
    while (Date.now() - t0 < ms) {
      try { v = await evalIn(sessionId, expr); if (v) return v; } catch {}
      await wait(200);
    }
    return v;
  }
  async function closePage(targetId) { try { await send("Target.closeTarget", { targetId }); } catch {} }
  // الأنابيب تُغلق مع العملية وإلا أبقت Node حيًّا بعد انتهاء الأداة. ★ (ر5) ويُعاد وعدٌ يتمّ بعد خروج كروم وحذف ملفه
  // (tempProfile): من ينتظره يجد الملف محذوفًا، ومن لا ينتظره تبقى عمليته حيّةً حتى يتمّ (أو يحذفه احتياط الخروج)
  function close() {
    for (const s of [out, inp, proc.stderr]) { try { s.destroy(); } catch {} }
    return prof.close();
  }
  return { send, openPage, evalIn, until, closePage, close, wait };
}

// ينتظر هدوء الصفحة: اكتمال التحميل ثم فترةٌ بلا طفراتٍ في DOM (الترطيب والبيانات المتأخرة)
export async function settle(cdp, sessionId, { quietMs = 1500, maxMs = 20000 } = {}) {
  await cdp.until(sessionId, "document.readyState === 'complete'", maxMs);
  return cdp.evalIn(sessionId, `new Promise(function (res) {
    var last = Date.now(), t0 = Date.now();
    var mo = new MutationObserver(function () { last = Date.now(); });
    mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
    (function tick() {
      if (Date.now() - last >= ${quietMs} || Date.now() - t0 >= ${maxMs}) { mo.disconnect(); res(Date.now() - t0); return; }
      setTimeout(tick, 100);
    })();
  })`, maxMs + 5000);
}
