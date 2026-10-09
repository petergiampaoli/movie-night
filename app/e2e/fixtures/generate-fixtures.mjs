// Generates deterministic media fixtures for the UI test suite.
//
// Why: the suite streams real video into a real <video> element so that
// play/pause assertions are meaningful. There is no ffmpeg on the build
// machine, so instead we let Chrome's own MediaRecorder encode a tiny
// WebM (VP8) from a canvas stream. Run with:  npm run fixtures:gen
//
// The generated files under ./movies are committed so the suite is
// reproducible without re-running this script.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const moviesDir = path.join(here, "movies");

const MOVIES = [
  {
    dir: "Alpha (2019)",
    file: "Alpha (2019).webm",
    color: "#1e3a8a",
    label: "ALPHA",
  },
  {
    dir: "Bravo (2020)",
    file: "Bravo (2020).webm",
    color: "#7c2d12",
    label: "BRAVO",
    poster: true,
    info: {
      title: "Bravo",
      year: 2020,
      tagline: "Everyone has a secret.",
      overview:
        "A retired safecracker is pulled back for one last job, only to find the vault already open.",
      rating: 8.1,
      voteCount: 12456,
      genres: ["Thriller", "Crime"],
      runtime: 118,
      source: "fixture",
      fetchedAt: "2020-01-01T00:00:00.000Z",
    },
  },
  {
    dir: "Delta (2022)",
    file: "Delta (2022).webm",
    color: "#166534",
    label: "DELTA",
  },
  {
    dir: "Charlie Show",
    file: "Charlie Show S01E01.webm",
    color: "#6b21a8",
    label: "CHARLIE S01E01",
  },
  {
    dir: "Charlie Show",
    file: "Charlie Show S01E02.webm",
    color: "#831843",
    label: "CHARLIE S01E02",
  },
];

async function recordWebm(page, color, label) {
  const bytes = await page.evaluate(
    async ({ color, label }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      const stream = canvas.captureStream(15);

      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : "video/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      const chunks = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      const stopped = new Promise((resolve) => (rec.onstop = resolve));

      rec.start();
      const start = performance.now();
      await new Promise((resolve) => {
        function frame() {
          const t = performance.now() - start;
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 320, 240);
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 30px sans-serif";
          ctx.fillText(label, 18, 90);
          ctx.font = "16px monospace";
          ctx.fillText(`${Math.floor(t)}ms`, 18, 130);
          if (t < 1200) requestAnimationFrame(frame);
          else resolve();
        }
        requestAnimationFrame(frame);
      });
      rec.stop();
      await stopped;

      const blob = new Blob(chunks, { type: "video/webm" });
      const buf = await blob.arrayBuffer();
      return Array.from(new Uint8Array(buf));
    },
    { color, label }
  );
  return Buffer.from(bytes);
}

async function makePoster(page, label, color) {
  const dataUrl = await page.evaluate(
    ({ label, color }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      const grad = ctx.createLinearGradient(0, 0, 0, 480);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "#0b0b0b");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 320, 480);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "bold 44px sans-serif";
      ctx.fillText(label, 24, 250);
      return canvas.toDataURL("image/jpeg", 0.8);
    },
    { label, color }
  );
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

async function main() {
  fs.rmSync(moviesDir, { recursive: true, force: true });
  fs.mkdirSync(moviesDir, { recursive: true });

  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><body></body></html>");

  for (const m of MOVIES) {
    const outDir = path.join(moviesDir, m.dir);
    fs.mkdirSync(outDir, { recursive: true });

    const webm = await recordWebm(page, m.color, m.label);
    fs.writeFileSync(path.join(outDir, m.file), webm);
    console.log(`  video  ${path.join(m.dir, m.file)}  (${webm.length} bytes)`);

    if (m.poster) {
      const jpg = await makePoster(page, m.info.title.toUpperCase(), m.color);
      fs.writeFileSync(path.join(outDir, "poster.jpg"), jpg);
      console.log(`  poster ${path.join(m.dir, "poster.jpg")}  (${jpg.length} bytes)`);
    }
    if (m.info) {
      fs.writeFileSync(path.join(outDir, "info.json"), JSON.stringify(m.info, null, 2));
      console.log(`  info   ${path.join(m.dir, "info.json")}`);
    }
  }

  await browser.close();
  console.log(`\nfixtures written to ${moviesDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
