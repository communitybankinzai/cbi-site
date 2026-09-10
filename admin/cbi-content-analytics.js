(function() {
  'use strict';
  const panel=document.getElementById('tab-metaverse');
  const status=document.getElementById('cbi-analytics-status');
  const select=document.getElementById('cbi-analytics-days');
  let sequence=0, loaded=false;
  const number=n=>n===null||n===undefined?'未計測':Number(n).toLocaleString('ja-JP');
  function table(rows,key,title) {
    const days=[...new Set(rows.map(r=>r.day))].sort().reverse();
    const wrapper=document.createElement('div');wrapper.className='mv-fixes-wrap';
    const h=document.createElement('h3');h.textContent=title;wrapper.appendChild(h);
    const t=document.createElement('table');t.className='mv-fixes-table';
    const head=t.createTHead().insertRow();
    ['日付','３Dワールド','防災MAP'].forEach(label=>{const th=document.createElement('th');th.textContent=label;head.appendChild(th);});
    const body=t.createTBody();
    days.forEach(day=>{const tr=body.insertRow();tr.insertCell().textContent=day;
      ['world','disaster-map'].forEach(content=>tr.insertCell().textContent=number(rows.find(r=>r.day===day&&r.content===content)?.[key]));});
    wrapper.appendChild(t);return wrapper;
  }
  async function load() {
    const current=++sequence;status.textContent='集計を読み込み中…';
    try {
      const res=await fetch('https://cidao.vercel.app/api/cbi-site-analytics?days='+select.value,{cache:'no-store'});
      if(!res.ok)throw new Error('HTTP '+res.status);
      const data=await res.json();if(current!==sequence)return;
      if(!Array.isArray(data.daily))throw new Error('集計データなし');
      document.getElementById('cbi-analytics-tables').replaceChildren(table(data.daily,'pv','PV（閲覧回数）'),table(data.daily,'vv','VV（訪問端末数）'));
      document.getElementById('cbi-analytics-legacy').replaceChildren(table(data.daily,'legacy_sessions','従来のセッション数'));
      status.textContent='更新 '+new Date().toLocaleString('ja-JP');loaded=true;
    } catch(e) {if(current===sequence)status.textContent='集計を取得できませんでした。更新ボタンで再試行してください。';}
  }
  select.addEventListener('change',load);document.getElementById('cbi-analytics-refresh').addEventListener('click',load);
  new MutationObserver(()=>{if(!panel.hidden&&!loaded)load();}).observe(panel,{attributes:true,attributeFilter:['hidden']});
  if(!panel.hidden)load();
  const screen=document.getElementById('screen-admin');
  let linked=false;
  function openLinkedTab() {
    if(!linked && location.hash==='#metaverse' && screen.classList.contains('active')) {
      linked=true;document.querySelector('[data-tab="metaverse"]').click();
    }
  }
  new MutationObserver(openLinkedTab).observe(screen,{attributes:true,attributeFilter:['class']});
  document.addEventListener('DOMContentLoaded',openLinkedTab);
  window.addEventListener('hashchange',()=>{linked=false;openLinkedTab();});
  setInterval(()=>{if(!panel.hidden)load();},60000);
})();
