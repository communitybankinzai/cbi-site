#!/usr/bin/env node
/**
 * news-data.json に更新履歴を1件追加する。
 *
 * GAS のメール返信承認 → repository_dispatch → Actions から呼ばれる。
 * GAS WebApp は応答だけ失われて処理が完了していることがあり、同じ内容が
 * 再送されうる。そのため**必ず冪等**にする：同じ id、または同じ 日付+本文 が
 * 既にあれば何もせず exit 0 で終了する。
 *
 * 入力は環境変数：
 *   NEWS_DATE       必須。「2026-08-08」（YYYY-MM-DD）
 *   NEWS_TEXT       必須。本文（HTMLタグ不可。そのまま textContent で表示される）
 *   NEWS_TAG        任意。表示タグ（「お知らせ」「紹介」等・10字まで）。省略時「お知らせ」
 *   NEWS_ID         任意。省略時は 日付+本文 から生成。再送時は同じ値を渡すこと
 *   NEWS_LINK_HREF  任意。リンク先（# / 相対パス / http(s) のみ）
 *   NEWS_LINK_LABEL 任意。リンクの表示文字
 *   NEWS_TEXT_AFTER 任意。リンクの後ろに置く文字（「を公開しました」など）
 *
 *   NEWS_LINE       NEWS_DATE / NEWS_TAG / NEWS_TEXT の代わりに1行で渡す形。
 *                   「2026-08-08 【お知らせ】 本文」（タグは省略可）を分解する。
 *                   GAS 側は承認された1行をそのまま投げればよい。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

let date = env('NEWS_DATE');
let text = env('NEWS_TEXT');
let tag = env('NEWS_TAG');

// NEWS_LINE 形式（「2026-08-08 【タグ】 本文」。タグは省略可）
const line = env('NEWS_LINE');
if (line && !date && !text) {
  const m = line.match(/^\s*(\d{4}-\d{2}-\d{2})\s+(?:【(.+?)】\s*)?([\s\S]+)$/);
  if (m) {
    date = m[1];
    tag = tag || (m[2] || '').trim();
    text = m[3].trim();
  } else {
    fail('NEWS_LINE を「2026-08-08 【タグ】 本文」の形に分解できません: ' + line);
  }
}

if (!date) fail('NEWS_DATE が空です。');
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('NEWS_DATE は YYYY-MM-DD で指定してください: ' + date);
if (isNaN(new Date(date + 'T00:00:00').getTime())) fail('NEWS_DATE が日付として不正です: ' + date);

if (!tag) tag = 'お知らせ';
if (tag.length > MAX_TAG) fail('NEWS_TAG が長すぎます（上限' + MAX_TAG + '字）: ' + tag);
if (/[<>]/.test(tag)) fail('NEWS_TAG に < > は使えません。');
if (text.length > MAX_TEXT) fail('NEWS_TEXT が長すぎます（' + text.length + '字 / 上限' + MAX_TEXT + '字）。');
if (/[<>]/.test(text)) fail('NEWS_TEXT に < > は使えません（HTMLは埋め込めません）。');

const linkHref = env('NEWS_LINK_HREF');
const linkLabel = env('NEWS_LINK_LABEL');
// 裸の相対パス（proposals/xxx/ 等・既存HTMLと同形式）も許可する。
// 「: を含まない」条件で javascript: 等のスキームは確実に弾く。
if (linkHref && !/^(#|\.{0,2}\/|https?:\/\/)/.test(linkHref) && linkHref.includes(':')) {
  fail('NEWS_LINK_HREF は # / 相対パス / http(s) のみ指定できます: ' + linkHref);
}

// 既存HTMLの「<a>リンク</a>を公開しました」形（リンクが文頭）に合わせ、
// リンクがあれば本文なしを許す（text 空＋link＋text_after で表現する）
if (!text && !(linkHref && linkLabel)) {
  fail('NEWS_TEXT が空です（リンクだけ載せる場合は NEWS_LINK_HREF と NEWS_LINK_LABEL を指定してください）。');
}

const id = env('NEWS_ID') ||
  date + '-' + crypto.createHash('sha1').update(date + '\n' + text + '\n' + linkHref).digest('hex').slice(0, 10);

let data;
try {
  data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
} catch (e) {
  fail('news-data.json を読めません: ' + e.message);
}
if (!data || !Array.isArray(data.items)) fail('news-data.json の形式が想定と違います（items が配列ではない）。');

// 冪等チェック：再送されても二重掲載しない
const duplicated = data.items.some(function (it) {
  return it.id === id ||
    (it.date === date && it.text === text && String(it.link ? it.link.href : '') === linkHref);
});
if (duplicated) {
  console.log('既に掲載済みのため何もしません（id: ' + id + '）。');
  process.exit(0);
}

const item = { id: id, date: date, tag: tag, text: text };
if (linkHref && linkLabel) {
  item.link = { href: linkHref, label: linkLabel };
  const after = env('NEWS_TEXT_AFTER');
  if (after) item.text_after = after;
}

data.items.unshift(item);
// 表示は日付の新しい順。同日内は追加順（unshift で先頭に来た順）を保つ
data.items.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });

const now = env('NEWS_NOW') || new Date().toISOString();
data.updated = now.slice(0, 10);

fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('掲載しました: ' + date + '【' + tag + '】' + text + '（id: ' + id + '）');
