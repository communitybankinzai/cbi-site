/* CBI rainfall sensitivity index v0.2.0 — uncalibrated, not flood depth. */
(function (root) {
  'use strict';
  function calculate(score, rain, hours, runoff, drainage) {
    if (![rain, hours, runoff, drainage].every(Number.isFinite) || rain < 0 || rain > 300 || hours <= 0 || hours > 72 || runoff < 0 || runoff > 1 || drainage < 0 || drainage > 300) throw new RangeError('入力値が範囲外です');
    if (score === null || !Number.isFinite(score) || score < 0 || score > 100) return null;
    const excess = Math.max(0, rain * runoff - drainage) * hours;
    // 50 mm is an arbitrary sensitivity scale, NOT an observed flood threshold.
    return score * excess / (excess + 50);
  }
  function validateGrid(g) {
    if (!g || !Number.isInteger(g.width) || !Number.isInteger(g.height) || g.width <= 0 || g.height <= 0 || g.width * g.height > 1000000 || !Array.isArray(g.values?.score) || g.values.score.length !== g.width * g.height || !Array.isArray(g.transform) || g.transform.length !== 4 || !g.transform.every(Number.isFinite) || g.transform[0] <= 0 || g.transform[2] >= 0 || !Array.isArray(g.bounds) || g.bounds.length !== 2 || !g.bounds.every(row => Array.isArray(row) && row.length === 2 && row.every(Number.isFinite))) throw new Error('地形データの形式を確認できません');
    if (!g.values.score.every(s => s === null || (Number.isFinite(s) && s >= 0 && s <= 100))) throw new Error('地形指標に不正値があります');
    return g;
  }
  const api = { calculate, validateGrid, version: 'cbi-rain-sensitivity-0.2.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CbiSimulationCore = api;
})(globalThis);
