// 防災MAPで「よく使う機能」の一覧（2026-09-28 事業主決定A：いらない機能を見極めるため）。
// 元は CiDAO /api/cbi-site-features の GET（集計だけ）。送る側は site/assets/cbi-feature-usage.js。
(function() {
  'use strict';
  const panel=document.getElementById('tab-metaverse');
  const status=document.getElementById('cbi-features-status');
  const select=document.getElementById('cbi-features-days');
  const host=document.getElementById('cbi-features-table');
  if(!panel||!status||!select||!host)return;
  let sequence=0, loaded=false;
  // 機能の名前の頭（種類）を読みやすくする
  const KINDS=[['layer:','レイヤー'],['preset:','見たいもの'],['legend:','凡例のボタン'],['range:','⏱ 期間の中'],['rain:','💧 雨量の中'],['draw:','記録の帯'],['popup:','吹き出しを開いた'],['open:','折りたたみを開いた'],['page:','ページ'],['link:','外部リンク'],['#','ボタン'],['[','ボタン']];
  const kindOf=f=>(KINDS.find(([p])=>f.startsWith(p))||['','その他'])[1];
  const pct=(n,d)=>d?Math.round(n/d*1000)/10+'%':'—';
  function render(data) {
    const t=document.createElement('table');t.className='mv-fixes-table';
    const head=t.createTHead().insertRow();
    ['順位','機能','種類','使った訪問','割合','押した回数','うちスマホの訪問'].forEach(label=>{const th=document.createElement('th');th.textContent=label;head.appendChild(th);});
    const body=t.createTBody();
    data.ranking.forEach((r,i)=>{
      const tr=body.insertRow();
      // チェックの ON／OFF は名前の後ろに付ける（同じレイヤーの ON と OFF が別の行になる）
      const state=/:on$/.test(r.feature)?'（ONにした）':/:off$/.test(r.feature)?'（OFFにした）':'';
      const name=(r.label||r.feature)+state;
      [String(i+1),name,kindOf(r.feature),Number(r.visits).toLocaleString('ja-JP'),pct(Number(r.visits),data.visits),Number(r.uses).toLocaleString('ja-JP'),Number(r.mobile_visits).toLocaleString('ja-JP')]
        .forEach((v,j)=>{const td=tr.insertCell();td.textContent=v;if(j===1)td.title=r.feature;});
    });
    const note=document.createElement('p');note.className='meta-note';
    note.textContent=`この期間の訪問 ${Number(data.visits).toLocaleString('ja-JP')}回（計測開始 ${data.trackingSince}）。「使った訪問」は、その機能を1回以上使った訪問の数。一覧に出ない機能は、この期間に一度も使われていません。`;
    host.replaceChildren(note,...(data.ranking.length?[t]:[]));
  }
  async function load() {
    const current=++sequence;status.textContent='集計を読み込み中…';
    try {
      const res=await fetch('https://cidao.vercel.app/api/cbi-site-features?content=disaster-map&days='+select.value,{cache:'no-store'});
      if(!res.ok)throw new Error('HTTP '+res.status);
      const data=await res.json();if(current!==sequence)return;
      if(!Array.isArray(data.ranking))throw new Error('集計データなし');
      render(data);
      status.textContent='更新 '+new Date().toLocaleString('ja-JP');loaded=true;
    } catch(e) {if(current===sequence)status.textContent='集計を取得できませんでした。更新ボタンで再試行してください。';}
  }
  select.addEventListener('change',load);document.getElementById('cbi-features-refresh')?.addEventListener('click',load);
  new MutationObserver(()=>{if(!panel.hidden&&!loaded)load();}).observe(panel,{attributes:true,attributeFilter:['hidden']});
  if(!panel.hidden)load();
})();
