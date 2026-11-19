import { chromium } from "playwright";
import fs from "node:fs/promises";
const b = await chromium.launch({
  channel: "chrome",
  headless: false,
  chromiumSandbox: true,
  args: ["--force-renderer-accessibility"],
});
const c = await b.newContext({
  permissions: ["microphone"],
  viewport: { width: 1300, height: 900 },
});
const p = await c.newPage();
await p.goto("http://127.0.0.1:4320");
await p.waitForTimeout(2000);
const capture = await p.evaluate(async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const track = stream.getAudioTracks()[0];
    const devices = await navigator.mediaDevices.enumerateDevices();
    const ctx = new AudioContext();
    await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    source.connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    let peak = 0;
    for (let i = 0; i < 50; i++) {
      analyser.getFloatTimeDomainData(buffer);
      peak = Math.max(peak, Math.sqrt(buffer.reduce((s, n) => s + n * n, 0) / buffer.length));
      await new Promise((r) => setTimeout(r, 100));
    }
    const result = {
      device: track.label,
      state: track.readyState,
      sampleRate: track.getSettings().sampleRate,
      audioInputs: devices.filter((d) => d.kind === "audioinput").map((d) => d.label),
      peakRms: peak,
    };
    stream.getTracks().forEach((t) => t.stop());
    await ctx.close();
    return result;
  } catch (e) {
    return { error: e.name, message: e.message };
  }
});
console.log(JSON.stringify({ capture }));
const recognition = await p.evaluate(
  () =>
    new Promise((resolve) => {
      const C = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!C) return resolve({ unsupported: true });
      const r = new C();
      r.lang = "en-IN";
      r.interimResults = false;
      let done = false;
      const finish = (result) => {
        if (done) return;
        done = true;
        r.abort();
        resolve(result);
      };
      r.onresult = (e) =>
        finish({ transcript: e.results[0][0].transcript, confidence: e.results[0][0].confidence });
      r.onerror = (e) => finish({ error: e.error });
      r.onend = () => finish({ endedWithoutResult: true });
      r.start();
      setTimeout(() => finish({ timeout: true }), 60000);
    }),
);
console.log(JSON.stringify({ recognition }));
await fs.mkdir("artifacts", { recursive: true });
await fs.writeFile(
  "artifacts/real-microphone.json",
  JSON.stringify(
    { testedAt: new Date().toISOString(), fakeMedia: false, capture, recognition },
    null,
    2,
  ),
);
console.log("Real microphone test complete; browser retained for NVDA testing.");
await new Promise((r) => setTimeout(r, 600000));
await b.close();
