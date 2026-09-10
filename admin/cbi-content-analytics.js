(function() {
  'use strict';
  const panel=document.getElementById('tab-metaverse');
  const status=document.getElementById('cbi-analytics-status');
  const select=document.getElementById('cbi-analytics-days');
  let sequence=0, loaded=false;
  let chartRows=[], chartWidth=0;
  const chartHost=document.getElementById('cbi-analytics-charts');
  const series=[
    {key:'pv',label:'PV',color:'#2164ce'},
    {key:'vv',label:'VV',color:'#00836b'},
    {key:'legacy_sessions',label:'従来のセッション数',color:'#946021',dash:'6 4'}
  ];
  const number=n=>n===null||n===undefined?'未計測':Number(n).toLocaleString('ja-JP');
  function chart(content,title) {
    const rows=chartRows.filter(r=>r.content===content).sort((a,b)=>a.day.localeCompare(b.day));
    const section=document.createElement('section');section.className='cbi-trend';
    const heading=document.createElement('h3');heading.textContent=title;section.appendChild(heading);
    if(!rows.length){const empty=document.createElement('p');empty.textContent='この期間のデータはありません';section.appendChild(empty);return section;}
    const width=Math.max(280,chartHost.clientWidth),height=250,left=40,right=16,top=14,bottom=32;
    const max=Math.max(1,...rows.flatMap(r=>series.map(s=>Number(r[s.key])||0)));
    const base=Math.pow(10,Math.floor(Math.log10(max/4)));
    const step=Math.max(1,Math.ceil(max/4/base)*base), ceiling=step*4;
    const x=i=>left+(width-left-right)*(rows.length===1?0.5:i/(rows.length-1));
    const y=v=>top+(height-top-bottom)*(1-v/ceiling);
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',title+' 日別PV・VV・従来セッション数');
    svg.style.cssText='display:block;width:100%;height:250px;touch-action:pan-y';
    function shape(tag,attrs,text) {const el=document.createElementNS(svg.namespaceURI,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));if(text!==undefined)el.textContent=text;svg.appendChild(el);return el;}
    for(let n=0;n<=4;n++) {
      shape('line',{x1:left,x2:width-right,y1:y(n*step),y2:y(n*step),stroke:'#dce2e5'});
      shape('text',{x:left-6,y:y(n*step)+4,'text-anchor':'end',fill:'#53616b','font-size':12},String(n*step));
    }
    const tickCount=width<500?3:5, ticks=new Set();
    for(let n=0;n<tickCount;n++)ticks.add(Math.round((rows.length-1)*n/(tickCount-1)));
    ticks.forEach(i=>shape('text',{x:x(i),y:height-8,'text-anchor':'middle',fill:'#53616b','font-size':12},rows[i].day.slice(5)));
    series.forEach(s=>{
      let path='',connected=false;
      rows.forEach((r,i)=>{
        const v=r[s.key];
        // Missing historical measurements are gaps, never fabricated zeroes.
        if(v===null||v===undefined){connected=false;return;}
        path+=(connected?' L':' M')+x(i)+' '+y(Number(v));connected=true;
        shape('circle',{cx:x(i),cy:y(Number(v)),r:2.5,fill:s.color});
      });
      shape('path',{d:path,fill:'none',stroke:s.color,'stroke-width':2,'stroke-dasharray':s.dash||'none','data-series':s.key});
    });
    const cursor=shape('line',{x1:x(rows.length-1),x2:x(rows.length-1),y1:top,y2:height-bottom,stroke:'#697780','stroke-dasharray':'2 3'});
    section.appendChild(svg);
    const detail=document.createElement('output');detail.className='cbi-trend-values';detail.setAttribute('aria-live','polite');section.appendChild(detail);
    const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max=String(rows.length-1);slider.step='1';slider.value=slider.max;slider.setAttribute('aria-label',title+'の表示日');slider.style.width='100%';section.appendChild(slider);
    function show(index) {
      const r=rows[index];cursor.setAttribute('x1',x(index));cursor.setAttribute('x2',x(index));slider.value=String(index);
      slider.setAttribute('aria-valuetext',r.day);
      detail.replaceChildren();const date=document.createElement('strong');date.textContent=r.day;detail.appendChild(date);
      series.forEach(s=>{const item=document.createElement('span');item.textContent=s.label+'：'+number(r[s.key]);item.style.color=s.color;detail.appendChild(item);});
    }
    slider.addEventListener('input',()=>show(Number(slider.value)));
    svg.addEventListener('pointermove',e=>{const bounds=svg.getBoundingClientRect();const px=(e.clientX-bounds.left)*width/bounds.width;show(Math.max(0,Math.min(rows.length-1,Math.round((px-left)/(width-left-right)*(rows.length-1)))));});
    show(rows.length-1);return section;
  }
  function drawCharts() {chartHost.replaceChildren(chart('world','３Dワールド'),chart('disaster-map','防災MAP'));}
  new ResizeObserver(()=>{const width=chartHost.clientWidth;if(width>0&&width!==chartWidth){chartWidth=width;drawCharts();}}).observe(chartHost);
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
      chartRows=data.daily;drawCharts();
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
