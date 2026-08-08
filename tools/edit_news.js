#!/usr/bin/env node
/**
 * news-data.json の既存項目の文面を差し替える。
 *
 * 管理画面の「文面を編集」→ GAS → repository_dispatch（news-edit）→ Actions から呼ばれる。
 * 追記・削除と同じく**冪等**：id が見つからない、または内容に変化が無ければ
 * 何もせず exit 0。
 *
 * 入力は環境変数：
 *   NEWS_ID    必須。編集対象の id（news-data.json の実 id）
 *   NEWS_TEXT  任意。新しい本文（指定時のみ差し替え）
 *   NEWS_TAG   任意。新しいタグ（指定時のみ差し替え）
 *   NEWS_DATE  任意。新しい日付 YYYY-MM-DD（指定時のみ差し替え。並び順も更新）
 *
 * リンク（link / text_after）はこのスクリプトでは変更しない。
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'news-data.json');
const MAX_TEXT = 200;
const MAX_TAG = 10;

function fail(msg) {
  console.error('エラー: ' + msg);
  process.exit(1);
}

function env(name) {
  return (process.env[name] || '').trim();
}

const id = env('NEWS_ID');
const newText = env('NEWS_TEXT');
const newTag = env('NEWS_TAG');
const newDate = env('NEWS_DATE');

if (!id) fail('NEWS_ID が空です。');
if (!newText && !newTag && !newDate) fail('NEWS_TEXT / NEWS_TAG / NEWS_DATE のいずれかを指定してください。');

if (newText) {
  if (newText.length > MAX_TEXT) fail('NEWS_TEXT が長すぎます（' + newText.length + '字 / 上限' + MAX_TEXT + '字）。');
  if (/[<>]/.test(newText)) fail('NEWS_TEXT に < > は使えません（HTMLは埋め込めません）。');
}
if (newTag) {
  if (newTag.length > MAX_TAG) fail('NEWS_TAG が長すぎます（上限' + MAX_TAG + '字）: ' + newTag);
  if (/[<>]/.test(newTag)) fail('NEWS_TAG に < > は使えません。');
}
if (newDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) fail('NEWS_DATE は YYYY-MM-DD で指定してください: ' + newDate);
  if (isNaN(new Date(newDate + 'T00:00:00').getTime())) fail('NEWS_DATE が日付として不正です: ' + newDate);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
} catch (e) {
  fail('news-data.json を読めません: ' + e.message);
}
if (!data || !Array.isArray(data.items)) fail('news-data.json の形式が想定と違います（items が配列ではない）。');

const item = data.items.find(it => it.id === id);
if (!item) {
  console.log('id が見つからないため何もしません（' + id + '）。');
  process.exit(0);
}

// 本文もリンクも無くなる編集は表示できないので拒否する
if (newText === '' && !newTag && !newDate) fail('NEWS_TEXT が空です。');
const changed = {};
if (newText && newText !== item.text) changed.text = newText;
if (newTag && newTag !== item.tag) changed.tag = newTag;
if (newDate && newDate !== item.date) changed.date = newDate;

if (Object.keys(changed).length === 0) {
  console.log('内容に変化が無いため何もしません（id: ' + id + '）。');
  process.exit(0);
}

const before = item.date + '【' + (item.tag || '') + '】' + (item.text || '');
Object.assign(item, changed);
// 日付を変えた場合は並び順も保ち直す
data.items.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });

const now = env('NEWS_NOW') || new Date().toISOString();
data.updated = now.slice(0, 10);

fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('編集しました（id: ' + id + '）');
console.log('  変更前: ' + before);
console.log('  変更後: ' + item.date + '【' + (item.tag || '') + '】' + (item.text || ''));
