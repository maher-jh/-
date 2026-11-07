// خادم استوديو أفلام الأطفال 3D (اختياري، بلا مكتبات): يقدّم الملفات الثابتة ويولّد صوت الحوار عبر مزوّد TTS.
// المفتاح يُقرأ من البيئة فقط ولا يصل إلى المتصفح.
//   TTS_PROVIDER=openai | elevenlabs     TTS_API_KEY=...     (اختياري) TTS_BASE_URL  TTS_MODEL  PORT
// تشغيل:  TTS_PROVIDER=openai TTS_API_KEY=sk-... node studio-server.js   ثم افتح http://localhost:8787
const http = require("http"), fs = require("fs"), path = require("path"), https = require("https"), { URL } = require("url");
const PORT = Number(process.env.PORT) || 8787, ROOT = __dirname;
const PROVIDER = (process.env.TTS_PROVIDER || "").toLowerCase(), KEY = process.env.TTS_API_KEY || "";
const available = (PROVIDER === "openai" || PROVIDER === "elevenlabs") && !!KEY;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml" };

function send(res, code, body, type = "application/json; charset=utf-8") { res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(body); }
const fail = (res, code, msg) => send(res, code, JSON.stringify({ error: msg }));

function upstream(urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr), lib = u.protocol === "http:" ? http : https;
    const rq = lib.request(u, { method: "POST", headers: { ...headers, "Content-Length": Buffer.byteLength(body) }, timeout: 30000 }, (r) => {
      const chunks = []; r.on("data", (c) => chunks.push(c)); r.on("end", () => resolve({ status: r.statusCode, body: Buffer.concat(chunks), type: r.headers["content-type"] || "audio/mpeg" }));
    });
    rq.on("timeout", () => rq.destroy(new Error("انتهت مهلة مزوّد الصوت"))); rq.on("error", reject); rq.end(body);
  });
}

async function tts({ text, voice, speed }) {
  const j = JSON.stringify;
  if (PROVIDER === "openai") {
    const base = process.env.TTS_BASE_URL || "https://api.openai.com";
    return upstream(base + "/v1/audio/speech", { "Content-Type": "application/json", Authorization: "Bearer " + KEY },
      j({ model: process.env.TTS_MODEL || "gpt-4o-mini-tts", voice: voice || "alloy", input: text, speed, response_format: "mp3" }));
  }
  const base = process.env.TTS_BASE_URL || "https://api.elevenlabs.io";
  if (!voice) throw new Error("ElevenLabs يحتاج معرّف صوت (voice id) في لوحة الصوت");
  return upstream(`${base}/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, { "Content-Type": "application/json", "xi-api-key": KEY },
    j({ text, model_id: process.env.TTS_MODEL || "eleven_multilingual_v2" }));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "GET" && url.pathname === "/api/tts/status")
    return send(res, 200, JSON.stringify(available ? { available: true, provider: PROVIDER } : { available: false, reason: "لم يُضبط TTS_PROVIDER وTTS_API_KEY على الخادم، فلا صوت حوار في الفيديو." }));
  if (req.method === "POST" && url.pathname === "/api/tts") {
    if (!available) return fail(res, 503, "خدمة الصوت غير مضبوطة على الخادم (TTS_PROVIDER وTTS_API_KEY)");
    let raw = ""; req.on("data", (c) => { raw += c; if (raw.length > 20000) req.destroy(); });
    req.on("end", async () => {
      let b; try { b = JSON.parse(raw); } catch (e) { return fail(res, 400, "طلب غير صالح"); }
      const text = String(b.text || "").trim().slice(0, 1000); if (!text) return fail(res, 400, "النص فارغ");
      const speed = Math.min(1.5, Math.max(0.5, Number(b.speed) || 1));
      try {
        const r = await tts({ text, voice: String(b.voice || "").slice(0, 80), speed });
        if (r.status !== 200) return fail(res, 502, `رفض مزوّد الصوت الطلب (HTTP ${r.status})`);
        send(res, 200, r.body, r.type);
      } catch (e) { fail(res, 502, e.message || "تعذّر الاتصال بمزوّد الصوت"); }
    });
    return;
  }
  if (req.method !== "GET") return fail(res, 405, "غير مسموح");
  let f = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[\/\\])+/, ""); if (f === "/" || f === path.sep) f = "/index.html";
  const full = path.join(ROOT, f); if (!full.startsWith(ROOT) || path.basename(full) === "studio-server.js") return fail(res, 404, "غير موجود");
  fs.readFile(full, (e, d) => e ? fail(res, 404, "غير موجود") : send(res, 200, d, MIME[path.extname(full)] || "application/octet-stream"));
}).listen(PORT, () => console.log(`الاستوديو: http://localhost:${PORT}  |  TTS: ${available ? PROVIDER : "غير مفعّل"}`));
