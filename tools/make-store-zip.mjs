// make-store-zip.mjs — حزمةُ متجر Chrome: ملفُ ZIP لمحتويات user/extension **نفسها** (لا للمجلد
// الحاوي — المتجر يطلب manifest.json في جذر الأرشيف)، بعد بوابة verify-package وبتسمية الإصدار.
// والبوابة تُشغَّل بـ --release: فحوص الخطوط المعلَّقة (المعايرة، والفهرس، و NOTICE) أخطاءٌ هنا،
// والقيم المبدئية (provisional) مرفوضة — فلا تُحزم للمتجر خطوطٌ لم تُعايَر.
//   node make-store-zip.mjs            → web/dist/claude-arabic-<version>.zip
// لا يُنشر شيءٌ من هنا؛ الرفع إلى لوحة المطوّرين يدويٌّ بقرار المالك.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, EXT } from "./paths.mjs";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
try { execFileSync(process.execPath, [path.join(here, "verify-package.mjs"), "--release"], { stdio: "inherit" }); }
catch { console.error("✗ بوابة الحزمة (--release) أخفقت — لا حزمة"); process.exit(1); }

const manifest = JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"), "utf8"));
const FORBIDDEN = [/\.pem$/i, /\.crx$/i, /\.map$/i, /^\./, /HANDOFF/i, /_خاص/, /test/i];
const bad = fs.readdirSync(EXT).filter((f) => FORBIDDEN.some((re) => re.test(f)));
if (bad.length) { console.error("✗ ملفات لا تُحزَم في مجلد الإضافة:", bad.join(", ")); process.exit(1); }

const dist = path.join(ROOT, "dist");
fs.mkdirSync(dist, { recursive: true });
const out = path.join(dist, `claude-arabic-${manifest.version}.zip`);
fs.rmSync(out, { force: true });
// bsdtar (مضمَّن في ويندوز 10+ وmacOS، وعلى لينكس من حزمة libarchive-tools) يكتب ZIP بامتداد الاسم عبر ‎-a‎؛
// والمسار ‎-C EXT .‎ يجعل manifest.json في الجذر لا داخل مجلد. على ويندوز يُسمّى بمساره
// الكامل لأن tar الذي في PATH قد يكون tar جِت (GNU) فيقرأ ‎C:‎ اسمَ مضيف
// وعلى غير ويندوز يُطلب bsdtar باسمه: tar في لينكس هو tar جِت (GNU)، و‎-a‎ عنده لا يعرف ‎.zip‎ فيكتب
// أرشيف tar بهذا الاسم ويمرّ فحص ‎-tf‎ أدناه — فتوقيع ZIP يُفحص بعد الكتابة
const TAR = process.platform === "win32" ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe") : "bsdtar";
// الأسماء صريحةً لا «.» — كي تخلو مداخلُ الأرشيف من سابقة ‎./‎
try { execFileSync(TAR, ["-a", "-cf", out, "-C", EXT, ...fs.readdirSync(EXT)], { stdio: "inherit" }); }
catch (e) { console.error(`✗ تعذّر تشغيل ${TAR}${e.code === "ENOENT" ? " — على لينكس: apt install libarchive-tools" : ""}`); process.exit(1); }
const sig = Buffer.alloc(4);
{ const fd = fs.openSync(out, "r"); fs.readSync(fd, sig, 0, 4, 0); fs.closeSync(fd); }
if (sig.toString("latin1") !== "PK\x03\x04") { console.error("✗ الأرشيف ليس ZIP (توقيعه ليس PK) — لا تُرفع هذه الحزمة"); process.exit(1); }
const listing = execFileSync(TAR, ["-tf", out], { encoding: "utf8" }).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
if (!listing.includes("manifest.json")) { console.error("✗ manifest.json ليس في جذر الأرشيف"); process.exit(1); }
const size = fs.statSync(out).size;
console.log(`✓ ${path.relative(ROOT, out)} — ${(size / 1024).toFixed(0)} KB، ${listing.filter((s) => !s.endsWith("/")).length} ملفًا، الإصدار ${manifest.version}`);
// سطر الخطوط العربية المحزومة: ما في الأرشيف فعلًا لا ما في القفل
const fontFiles = listing.filter((s) => /^fonts\/[^/]+\.woff2$/.test(s));
const fontBytes = fontFiles.reduce((n, s) => n + fs.statSync(path.join(EXT, s)).size, 0);
console.log(`  الخطوط العربية: ${fontFiles.length} ملفات woff2، ${(fontBytes / 1024).toFixed(1)} KiB` +
  (fontFiles.length ? ` (${fontFiles.map((s) => path.basename(s, ".woff2")).join("، ")})، ومعها تراخيصها و CREDITS.txt` : ""));
