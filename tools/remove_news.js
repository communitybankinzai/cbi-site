#!/usr/bin/env node
/**
 * news-data.json から更新履歴を1件削除する。
 *
 * GAS のメール返信「削除」→ repository_dispatch（news-delete）→ Actions から呼ばれる。
 * 追記側（add_news.js）と同じく**冪等**：一致する項目が無ければ何もせず exit 0。
 *
 * 対象の特定は次の優先順：
 *   1. NEWS_ID       掲載時と同じ id（GAS は同じ line から同じ id を計算して送る）
 *   2. NEWS_LINE     「2026-08-08 【タグ】 本文」の1行。日付+本文の一致で特定（タグは無視）
 *   3. NEWS_DATE + NEWS_TEXT
 *
 * HTML（index.html）に直書きされた項目はここでは消せない（news-data.json のみ）。
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'news-data.json');

function fail(msg) {
  console.error('エラー: ' + msg);
  process.exit(1);
}

function env(name) {
  return (process.env[name] || '').trim();
}

let date = env('NEWS_DATE');
let text = env('NEWS_TEXT');
const id = env('NEWS_ID');

const line = env('NEWS_LINE');
if (line && !date && !text) {
  const m = line.match(/^\s*(\d{4}-\d{2}-\d{2})\s+(?:【.+?】\s*)?([\s\S]+)$/);
  if (m) {
    date = m[1];
    text = m[2].trim();
  } else {
    fail('NEWS_LINE を「2026-08-08 【タグ】 本文」の形に分解できません: ' + line);
  }
}

if (!id && !(date && text)) {
  fail('NEWS_ID、NEWS_LINE、NEWS_DATE+NEWS_TEXT のいずれかを指定してください。');
}

let data;
try {
  data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
} catch (e) {
  fail('news-data.json を読めません: ' + e.message);
}
if (!data || !Array.isArray(data.items)) fail('news-data.json の形式が想定と違います（items が配列ではない）。');

const matches = (it) => {
  if (id && it.id === id) return true;
  if (date && text && it.date === date) {
    if (it.text === text) return true;
    // 本文なし・リンクのみの項目は リンクの表示文字＋後置文 で照合する
    const full = (it.text || '') + (it.link ? it.link.label || '' : '') + (it.text_after || '');
    if (full === text) return true;
  }
  return false;
};

const before = data.items.length;
const removed = data.items.filter(matches);
data.items = data.items.filter(it => !matches(it));

if (removed.length === 0) {
  console.log('一致する項目が無いため何もしません' + (id ? '（id: ' + id + '）' : '（' + date + ' / ' + text + '）') + '。');
  process.exit(0);
}

const now = env('NEWS_NOW') || new Date().toISOString();
data.updated = now.slice(0, 10);

fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
removed.forEach(it => console.log('削除しました: ' + it.date + '【' + (it.tag || '') + '】' + (it.text || (it.link && it.link.label) || '') + '（id: ' + it.id + '）'));
console.log(before + ' 件 → ' + data.items.length + ' 件');
