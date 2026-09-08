// 災害時のSNS投稿に載せる、防災MAPの実画面を撮る。
//
// 合成はしない。本番URLをそのまま開き、その状況で見せるべきレイヤーだけを
// ONにして撮る。何を出すかは災害の種類で変える。
//
// 実行（GitHub Actions からも、手元からも同じように動く）:
//   node scripts/promo/shoot_disaster_map.mjs --kind rain --out <出力先>
//   --kind rain      大雨・冠水（雨雲＋キキクル＋道路冠水目安＋避難所）
//   --kind landslide 土砂災害（キキクル土砂＋土砂災害警戒区域＋避難所）
//   --kind flood     洪水（洪水浸水想定＋雨雲＋避難所）
//   --kind quake     地震（震度分布＋避難所）
//   --kind default   既定（避難所のみ）
//
// 出力: <出力先>/disaster_<kind>_<YYYYMMDDHHmm>.png と disaster_latest.png

import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const BASE = "https://communitybankinzai.github.io/cbi-site/inzai-disaster-map/";
const W = 1400;
const H = 950;

const args = process.argv.slice(2);
const argOf = (name, def) => {
  const i = args.indexOf("--" + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const kind = argOf("kind", "default");
const outDir = argOf("out", "assets/disaster");

// 災害の種類ごとに、ONにするレイヤー（data-overlay の値）。
// 多すぎると何も読み取れなくなるので、その災害で本当に要るものだけに絞る。
const LAYERS = {
  rain: ["rainNowcast", "kikikuruInund", "roadRisk", "shelters"],
  landslide: ["kikikuruLand", "landslideWarning", "shelters"],
  flood: ["floodMax", "rainNowcast", "shelters"],
  quake: ["quakeIntensity", "shelters"],
  default: ["shelters"],
};
// 既定でONになっていて、撮影時は邪魔になるもの
const TURN_OFF = ["floodMax", "floodPlan", "inland"];

fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--enable-unsafe-swiftshader", "--no-sandbox", `--window-size=${W},${H}`],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

const logs = [];
page.on("console", (m) => { if (m.type() === "error") logs.push(m.text().slice(0, 120)); });

await page.goto(BASE, { waitUntil: "networkidle2", timeout: 120000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 7000));

const want = LAYERS[kind] ?? LAYERS.default;
const applied = await page.evaluate(
  ({ want, off }) => {
    // 使い方の案内は撮影の邪魔なので閉じる
    [...document.querySelectorAll("button")]
      .filter((b) => /閉じる/.test(b.textContent || ""))
      .forEach((b) => b.click());
    const set = (name, on) => {
      const cb = document.querySelector(`[data-overlay="${name}"]`);
      if (!cb || cb.checked === on) return cb ? "同じ" : "無し";
      cb.checked = on;
      cb.dispatchEvent(new Event("change", { bubbles: true }));
      return on ? "ON" : "OFF";
    };
    const result = {};
    for (const n of off) result[n] = set(n, false);
    for (const n of want) result[n] = set(n, true);
    return result;
  },
  { want, off: TURN_OFF }
);
console.log("レイヤー:", JSON.stringify(applied, null, 0));

// 道路冠水目安（約0.4MB）とタイルの読み込みを待つ
await new Promise((r) => setTimeout(r, kind === "rain" ? 22000 : 14000));

const now = new Date(Date.now() + 9 * 3600 * 1000);
const stamp =
  now.getUTCFullYear() +
  String(now.getUTCMonth() + 1).padStart(2, "0") +
  String(now.getUTCDate()).padStart(2, "0") +
  String(now.getUTCHours()).padStart(2, "0") +
  String(now.getUTCMinutes()).padStart(2, "0");

// 投稿では左のレイヤー一覧は要らない（チェックボックスばかりで読み取れない）。
// 地図と右カラム（警報・注意報／雨量／公式発表）だけを切り出す。
// 合成ではなく、実画面から必要な範囲を取り出しているだけ。
const clip = await page.evaluate(() => {
  const map = document.getElementById('map');
  if (!map) return null;
  const r = map.getBoundingClientRect();
  const x = Math.max(0, Math.round(r.left) - 4);
  return { x, y: 0, width: Math.round(window.innerWidth - x), height: window.innerHeight };
});
const named = path.join(outDir, `disaster_${kind}_${stamp}.png`);
await page.screenshot(clip ? { path: named, clip } : { path: named });
if (clip) console.log(`切り出し: x=${clip.x} 幅=${clip.width} 高さ=${clip.height}`);
fs.copyFileSync(named, path.join(outDir, "disaster_latest.png"));
console.log("撮影:", named);
if (logs.length) console.log("ページの警告:", logs.slice(0, 3).join(" / "));

await browser.close();
console.log(JSON.stringify({ ok: true, kind, file: path.basename(named), stamp }));
