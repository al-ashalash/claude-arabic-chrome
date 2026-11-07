// fetch-gate.mjs — ★ (ر24-د2، مراجعة ر24-د F-03، ٢٠ جمادى الأولى ١٤٤٨هـ) بوابة طلبات الشبكة في ملفات الإضافة.
//
// لماذا: مطابقات سكربتات المحتوى تمنح عاملَ الخدمة وصفحاتِ الإضافة وصولًا مُعتمَدًا بلا CORS إلى المواقع المترجمة (سلوك كروم)، فجلبٌ إليها بلا
// credentials:"omit" يحمل ملفات تعريف الارتباط ويقرأ بيانات الحساب. والوعد في «حول» أن الإضافة لا ترسل شيئًا من عند المستخدم؛ وكان يحفظه انضباط الكود وحده.
// فهذه البوابة تُخفق متى:
//   ١) نداءُ fetch( (مجرّدًا أو عضوًا: self.fetch( وglobalThis.fetch(…) وسيطُه الثاني ليس كائنًا حرفيًّا فيه credentials: "omit" في مستواه الأعلى،
//      ما لم يكن وسيطه الأول chrome.runtime.getURL(…) (ملفٌّ من الحزمة نفسها)؛
//   ٢) أو ذُكر fetch في الكود بلا نداء (إسنادٌ يتجاوز القاعدة) إلا بعد typeof؛
//   ٣) أو ذُكرت واجهة طلبٍ أخرى لا تحكمها القاعدة: XMLHttpRequest وsendBeacon وEventSource وWebSocket.
// والتعليقات ونصوص السلاسل والتعابير النمطية لا تُحسب (مقطِّعٌ صغير يكفي كود الإضافة المكتوب باليد؛ والقواميس المولَّدة سلسلةٌ واحدة في JSON.parse).
//   node web/code/toolchain/fetch-gate.mjs        الخروج 0 = لا مخالفة (ويستدعيها check-syntax.mjs، البوابة 1 في RULES §8)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// يعيد نسختين بطول المصدر: code (التعليقات والسلاسل والتعابير النمطية مسافات) وfull (التعليقات وحدها مسافات)
export function maskJs(src) {
  const n = src.length, code = src.split(""), full = src.split("");
  const blank = (a, b, both) => { for (let k = a; k < b; k++) if (src[k] !== "\n") { code[k] = " "; if (both) full[k] = " "; } };
  let i = 0, prev = ""; // آخر محرفٍ دالٍّ في الكود (لتمييز التعبير النمطي من القسمة)
  const tmplStack = [];  // عمق الأقواس داخل ${…} لكل حرفية مائلة مفتوحة
  let braceDepth = 0;
  const regexOk = () => prev === "" || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev) || /\b(?:return|typeof|case|do|else|in|of|new|delete|void|throw)$/.test(code.slice(Math.max(0, i - 8), i).join(""));
  function readTemplate(start) { // من بعد ` حتى ` أو ${
    let k = start;
    while (k < n) {
      if (src[k] === "\\") { k += 2; continue; }
      if (src[k] === "`") return { end: k + 1, open: false };
      if (src[k] === "$" && src[k + 1] === "{") return { end: k + 2, open: true };
      k++;
    }
    return { end: n, open: false };
  }
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { const e = src.indexOf("\n", i); const end = e < 0 ? n : e; blank(i, end, true); i = end; continue; }
    if (c === "/" && d === "*") { const e = src.indexOf("*/", i + 2); const end = e < 0 ? n : e + 2; blank(i, end, true); i = end; continue; }
    if (c === "'" || c === '"') {
      let k = i + 1;
      while (k < n && src[k] !== c && src[k] !== "\n") k += src[k] === "\\" ? 2 : 1;
      blank(i + 1, Math.min(k, n), false); i = k + 1; prev = c; continue;
    }
    if (c === "`" || (c === "}" && tmplStack.length && tmplStack[tmplStack.length - 1] === braceDepth)) {
      if (c === "}") tmplStack.pop();
      const t = readTemplate(i + 1);
      blank(i + 1, t.open ? t.end - 2 : t.end - 1, false);
      if (t.open) tmplStack.push(braceDepth);
      i = t.end; prev = "`"; continue;
    }
    if (c === "/" && regexOk()) {
      let k = i + 1, cls = false;
      while (k < n && src[k] !== "\n") {
        if (src[k] === "\\") { k += 2; continue; }
        if (src[k] === "[") cls = true; else if (src[k] === "]") cls = false; else if (src[k] === "/" && !cls) break;
        k++;
      }
      blank(i + 1, k, false); i = k + 1; while (i < n && /[a-z]/.test(src[i])) i++; prev = "/"; continue;
    }
    if (c === "{") braceDepth++; else if (c === "}") braceDepth--;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return { code: code.join(""), full: full.join("") };
}

// وسائط نداءٍ يبدأ قوسه عند open: نصوص الوسائط من full مقسومةً على فواصل المستوى الأعلى
function callArgs(m, open) {
  let depth = 0, k = open, start = open + 1; const args = [];
  for (; k < m.code.length; k++) {
    const ch = m.code[k];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") { depth--; if (depth === 0) { args.push(m.full.slice(start, k)); return args; } }
    else if (ch === "," && depth === 1) { args.push(m.full.slice(start, k)); start = k + 1; }
  }
  return null;
}
// خصائص المستوى الأعلى في كائنٍ حرفي (النص بين القوسين)
function topProps(objText) {
  const inner = objText.trim().slice(1, -1); const m = maskJs(inner); const out = []; let depth = 0, start = 0;
  for (let k = 0; k <= m.code.length; k++) {
    const ch = m.code[k];
    if (k === m.code.length || (ch === "," && depth === 0)) { out.push(m.full.slice(start, k).trim()); start = k + 1; continue; }
    if (ch === "(" || ch === "[" || ch === "{") depth++; else if (ch === ")" || ch === "]" || ch === "}") depth--;
  }
  return out;
}
function isObjectLiteral(t) {
  t = t.trim(); if (t[0] !== "{" || t[t.length - 1] !== "}") return false;
  const m = maskJs(t); let depth = 0;
  for (let k = 0; k < m.code.length; k++) { const ch = m.code[k]; if (ch === "{" || ch === "(" || ch === "[") depth++; else if (ch === "}" || ch === ")" || ch === "]") { depth--; if (depth === 0 && k !== m.code.length - 1) return false; } }
  return true;
}
const OMIT = /^(?:credentials|"credentials"|'credentials')\s*:\s*(["'])omit\1$/;
// ★ (مراجعة ر24-د2) الأخير يغلب في الكائن الحرفي: credentials:"omit" لا تحمي إن تلتها credentials أخرى، أو نشرٌ (...) أو مفتاحٌ محسوب ([…]) قد يبدّلها
const CRED = /^(?:credentials|"credentials"|'credentials')\s*(?::|$)/; // ومعها المختصرة ‎{ credentials }‎ (متغيّرٌ لا يُعرف)
function omitWins(props) {
  const k = props.map((p) => CRED.test(p)).lastIndexOf(true);
  return k >= 0 && OMIT.test(props[k]) && !props.slice(k + 1).some((p) => /^(?:\.\.\.|\[)/.test(p));
}
const NET = /^(["'`])(?:fetch|XMLHttpRequest|sendBeacon|EventSource|WebSocket)\1$/;
const lineOf = (src, i) => src.slice(0, i).split("\n").length;

// مخالفات ملفٍّ واحد: [{line, why}]
export function fetchViolations(src) {
  const m = maskJs(src), out = [];
  const re = /\bfetch\b|\b(?:XMLHttpRequest|sendBeacon|EventSource|WebSocket)\b/g; let x;
  while ((x = re.exec(m.code))) {
    const at = x.index, word = x[0];
    if (at > 0 && /[\w$]/.test(m.code[at - 1])) continue;
    if (word !== "fetch") { out.push({ line: lineOf(src, at), why: "واجهة طلبٍ لا تحكمها البوابة: " + word }); continue; }
    let k = at + 5; while (k < m.code.length && /\s/.test(m.code[k])) k++;
    if (m.code[k] !== "(") {
      if (/\btypeof\s*$/.test(m.code.slice(Math.max(0, at - 12), at))) continue;
      out.push({ line: lineOf(src, at), why: "fetch مذكورٌ بلا نداء (إسنادٌ يتجاوز البوابة)" }); continue;
    }
    const args = callArgs(m, k);
    if (!args) { out.push({ line: lineOf(src, at), why: "نداء fetch لا يُغلق" }); continue; }
    if (/^chrome\.runtime\.getURL\s*\(/.test((args[0] || "").trim())) continue;
    const opt = args[1];
    if (opt && isObjectLiteral(opt) && omitWins(topProps(opt))) continue;
    out.push({ line: lineOf(src, at), why: "نداء fetch بلا credentials: \"omit\" في كائن خياراته (وليس ملفًّا من الحزمة بـchrome.runtime.getURL)" });
  }
  // ★ (مراجعة ر24-د2) والفهرس النصّي (self["fetch"](…)) يُخفي الاسم عن المقطِّع لأنه سلسلة: قوسان مربّعان في الكود لا يحويان إلا سلسلةً هي اسم واجهة طلب
  const brk = /\[\s*(["'`])[^"'`\n]*\1\s*\]/g;
  while ((x = brk.exec(m.code))) {
    const lit = m.full.slice(x.index, x.index + x[0].length).replace(/^\[\s*|\s*\]$/g, "");
    if (NET.test(lit)) out.push({ line: lineOf(src, x.index), why: "واجهة طلبٍ بفهرسٍ نصّي يتجاوز البوابة: " + lit });
  }
  out.sort((a, b) => a.line - b.line);
  return out;
}

// كل ملفات ‎.js‎ في مجلد الإضافة: [{file, line, why}]
export function scanDir(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort())
    for (const v of fetchViolations(fs.readFileSync(path.join(dir, f), "utf8"))) out.push(Object.assign({ file: f }, v));
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { EXT } = await import("./paths.mjs");
  const bad = scanDir(EXT);
  for (const b of bad) console.error(`✗ ${b.file}:${b.line} ${b.why}`);
  console.log(bad.length ? `✗ بوابة الجلب: ${bad.length} مخالفة` : "✓ بوابة الجلب: كل fetch في الإضافة بلا اعتماد أو من الحزمة");
  process.exit(bad.length ? 1 : 0);
}
