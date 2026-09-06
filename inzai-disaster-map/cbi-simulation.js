/* Separate from incident recording: this module never changes observations. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const form = el('cbi-simulation-form'), status = el('cbi-simulation-status');
  if (typeof L === 'undefined' || typeof map === 'undefined' || !globalThis.CbiSimulationCore) { status.textContent = '地図の初期化に失敗しました。ページを再読み込みしてください。'; return; }
  const fields = ['cbi-rain', 'cbi-hours', 'cbi-runoff', 'cbi-drainage'];
  const show = el('cbi-show-simulation'), button = el('cbi-simulate');
  let gridPromise, overlay, revision = 0, caption = '';
  const pane = map.createPane('cbiSimulationPane');
  pane.style.zIndex = '390'; // below official hazard overlays, markers and incident records
  pane.style.pointerEvents = 'none';
  const badge = L.control({ position: 'bottomleft' });
  badge.onAdd = () => { const node = L.DomUtil.create('div', 'cbi-simulation-map-note'); node.textContent = caption; return node; };
  function hide() { if (overlay) map.removeLayer(overlay); badge.remove(); }
  function refreshVisibility() {
    if (show.checked && overlay) { overlay.addTo(map); badge.addTo(map); }
    else hide();
  }
  form.addEventListener('input', () => {
    revision++; hide(); overlay = null; show.checked = false; show.disabled = true;
    status.textContent = '条件が変更されました。「この雨量で重ねる」で再計算してください。';
  });
  show.addEventListener('change', refreshVisibility);
  el('cbi-simulation-opacity').addEventListener('input', event => overlay?.setOpacity(Number(event.target.value) / 100));
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!form.reportValidity()) return;
    const values = fields.map(id => el(id).value === '' ? NaN : Number(el(id).value));
    const token = ++revision;
    hide(); overlay = null; show.checked = false; show.disabled = true;
    button.disabled = true; status.textContent = '地形データを読み込み、参考指標を計算しています…';
    try {
      CbiSimulationCore.calculate(0, ...values);
      if (!gridPromise) gridPromise = fetch('./simulation-data/map_grid.json').then(response => {
        if (!response.ok) throw new Error('地形データを取得できませんでした');
        return response.json();
      }).then(CbiSimulationCore.validateGrid).catch(error => { gridPromise = null; throw error; });
      const grid = await gridPromise;
      if (token !== revision) return;
      const canvas = document.createElement('canvas'); canvas.width = grid.width; canvas.height = grid.height;
      const context = canvas.getContext('2d'); if (!context) throw new Error('このブラウザでは描画できません');
      const pixels = context.createImageData(grid.width, grid.height);
      const low = [224, 238, 245], high = [102, 30, 142];
      let valid = 0;
      grid.values.score.forEach((score, index) => {
        const value = CbiSimulationCore.calculate(score, ...values); if (value === null) return;
        valid++; const fraction = value / 100;
        for (let channel = 0; channel < 3; channel++) pixels.data[index * 4 + channel] = Math.round(low[channel] + (high[channel] - low[channel]) * fraction);
        pixels.data[index * 4 + 3] = 255;
      });
      if (!valid) throw new Error('有効な地形データがありません');
      context.putImageData(pixels, 0, 0);
      const [rain, hours, runoff, drainage] = values;
      caption = 'CBI独自シミュレーション｜未校正の参考指標\n' + rain + ' mm/h × ' + hours + '時間（総雨量 ' + Number((rain * hours).toFixed(2)) + ' mm）\n流出率 ' + runoff + '／排水仮定 ' + drainage + ' mm/h\n薄い→濃い：指標0→100・浸水深/確率ではありません';
      overlay = L.imageOverlay(canvas.toDataURL('image/png'), grid.bounds, { pane: 'cbiSimulationPane', opacity: Number(el('cbi-simulation-opacity').value) / 100, interactive: false, alt: 'CBI独自シミュレーション：雨量条件の未校正参考指標', className: 'cbi-simulation-raster' });
      show.disabled = false; show.checked = true; refreshVisibility();
      status.textContent = rain + ' mm/h × ' + hours + '時間を表示中（総雨量 ' + Number((rain * hours).toFixed(2)) + ' mm）。公式ハザードは別レイヤーです。重なって見にくい場合は各レイヤーを切り替えて比較してください。';
    } catch (error) {
      if (token === revision) status.textContent = '計算できませんでした。' + error.message + '。条件と通信を確認して再実行してください。';
    } finally { button.disabled = false; }
  });
})();
