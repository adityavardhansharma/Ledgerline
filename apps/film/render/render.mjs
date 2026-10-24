// Renders the film frame by frame: a Vite server for the film, headless Chromium with time stopped (virtual-time.js),
// one screenshot per frame piped into ffmpeg. Usage:
//   node render/render.mjs [--fps 60] [--from 0] [--to <end>] [--out out/ledgerline.mp4] [--stills dir --every 30]
//   [--audio out/score.wav]
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const fps = Number(arg("fps", 60));
const from = Number(arg("from", 0));
const stills = arg("stills", null);
const every = Number(arg("every", 1));
const out = resolve(root, arg("out", "out/ledgerline-launch.mp4"));
const audio = arg("audio", null);
const browserBin = arg("chrome", process.env.CHROME ?? "chromium");
const port = 9339;

// A production build: no dev overlay in the frame, and no reload halfway through when Vite finds a new dependency.
const config = join(root, "vite.config.ts");
await build({ configFile: config, logLevel: "error", build: { outDir: join(root, "out/site"), emptyOutDir: true, target: "esnext" } });
const server = await preview({ configFile: config, logLevel: "warn", build: { outDir: join(root, "out/site") }, preview: { port: 5198, strictPort: true } });
const url = `http://localhost:5198/?capture=1&seek=${from}`;

const profile = mkdtempSync(join(tmpdir(), "ll-film-"));
const chrome = spawn(browserBin, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--window-size=1920,1080",
  "--hide-scrollbars",
  "--mute-audio",
  "--force-device-scale-factor=1",
  "--force-color-profile=srgb",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

async function json(path, method = "GET") {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}${path}`, { method });
      if (r.ok) return r.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Chromium did not start");
}
await json("/json/version");
const target = await json("/json/new?about:blank", "PUT");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => {
  ws.onopen = r;
  ws.onerror = j;
});
let seq = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(`${msg.error.message}`));
    else resolve(msg.result);
  } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    console.error("[page]", msg.params.args.map((a) => a.value ?? a.description).join(" "));
  } else if (msg.method === "Runtime.exceptionThrown") {
    console.error("[page]", msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }, { name: "prefers-reduced-motion", value: "no-preference" }] });
await send("Page.addScriptToEvaluateOnNewDocument", { source: readFileSync(join(here, "virtual-time.js"), "utf8") });
await send("Page.navigate", { url });

for (let i = 0; ; i++) {
  if (await evaluate("window.__filmReady === true").catch(() => false)) break;
  if (i > 600) throw new Error("The film never said it was ready");
  await new Promise((r) => setTimeout(r, 100));
}
const length = await evaluate("window.__filmLength");
if (arg("probe", null)) {
  await evaluate(`window.__advance(${Number(arg("probe-at", 0)) * 1000})`);
  console.log(JSON.stringify(await evaluate(arg("probe", null)), null, 2));
  chrome.kill();
  await server.close();
  process.exit(0);
}
const to = Number(arg("to", length));
const total = Math.round((to - from) * fps);
console.log(`Rendering ${from}s → ${to}s at ${fps} fps: ${total} frames`);

let ffmpeg = null;
if (stills) mkdirSync(resolve(root, stills), { recursive: true });
else {
  mkdirSync(dirname(out), { recursive: true });
  const input = ["-y", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-"];
  const withAudio = audio ? ["-ss", String(from), "-i", resolve(root, audio), "-c:a", "aac", "-b:a", "256k", "-shortest"] : [];
  ffmpeg = spawn("ffmpeg", [...input, ...withAudio, "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "ignore", "inherit"] });
}

const started = Date.now();
await evaluate("window.__advance(0)");
for (let i = 0; i < total; i++) {
  if (i > 0) await evaluate(`window.__advance(${1000 / fps})`);
  if (i % every !== 0) continue;
  const shot = await send("Page.captureScreenshot", { format: stills ? "png" : "jpeg", quality: stills ? undefined : 95 });
  const data = Buffer.from(shot.data, "base64");
  if (stills) writeFileSync(resolve(root, stills, `${(from + i / fps).toFixed(2).padStart(7, "0")}.png`), data);
  else if (!ffmpeg.stdin.write(data)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
  if (i % fps === 0) {
    const rate = (i + 1) / ((Date.now() - started) / 1000);
    process.stdout.write(`\r${(from + i / fps).toFixed(1)}s  ${i + 1}/${total} frames  ${rate.toFixed(1)} fps  ~${Math.round((total - i) / rate)}s left   `);
  }
}
process.stdout.write("\n");
if (ffmpeg) {
  ffmpeg.stdin.end();
  await new Promise((r) => ffmpeg.on("close", r));
  console.log(`Wrote ${out}`);
}
ws.close();
chrome.kill();
await server.close();
process.exit(0);
