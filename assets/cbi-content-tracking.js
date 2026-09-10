(function() {
  'use strict';
  const query=new URLSearchParams(location.search);
  if (query.has('notiles') || query.has('cinema') || !location.hostname.endsWith('github.io')) return;
  let visitorId;
  try {
    visitorId=localStorage.getItem('cbi-content-visitor-v1');
    if (!visitorId || !/^[0-9a-f-]{36}$/i.test(visitorId)) {
      visitorId=crypto.randomUUID();localStorage.setItem('cbi-content-visitor-v1',visitorId);
    }
  } catch (_) { return; }
  const body=JSON.stringify({id:crypto.randomUUID(),visitorId,
    content:location.pathname.includes('/metaverse/')?'world':'disaster-map'});
  const send=()=>fetch('https://cidao.vercel.app/api/cbi-site-analytics',{
    method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true
  }).then(r=>{if(!r.ok)throw new Error('unavailable');});
  send().catch(()=>setTimeout(()=>send().catch(()=>{}),3000));
})();
