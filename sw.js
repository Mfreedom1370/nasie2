// Service Worker دفتر نسیه — Offline-first با نسخه‌ی کش.
// برای انتشار نسخه‌ی جدید فقط عدد V را بالا ببر؛ کش نسخه‌های قبلی در activate پاک می‌شود.
const V='nasie-v11';
const CORE=['./','index.html','manifest.webmanifest','css/style.css','js/store.js','js/parser.js','js/ledger.js','js/liquid.js','js/telegram.js','js/app.js','icon-192.png','icon-512.png','css/fonts/iranyekanwebregular.woff2','css/fonts/iranyekanwebbold.woff2'];
const OPT=['js/vendor/xlsx.full.min.js','js/jdate.js'];   // اختیاری: اگر نبودند نصب خراب نشود
const abs=p=>new URL(p,self.location.href).href;
self.addEventListener('install',e=>e.waitUntil((async()=>{
 const c=await caches.open(V);
 await Promise.all(CORE.map(async u=>{const r=await fetch(abs(u),{cache:'reload'});if(!r.ok)throw new Error('precache '+u);await c.put(abs(u),r)}));
 await Promise.all(OPT.map(u=>fetch(abs(u),{cache:'reload'}).then(r=>r.ok&&c.put(abs(u),r)).catch(()=>{})));
 await self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
 for(const k of await caches.keys())if(k.startsWith('nasie-')&&k!==V)await caches.delete(k);
 await self.clients.claim()})()));
// استراتژی: کش اول (فوری و آفلاین) + به‌روزرسانی در پس‌زمینه. درخواست‌های خارجی (تلگرام، AI) دست نمی‌خورند.
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET')return;
 if(new URL(r.url).origin!==new URL(self.location.href).origin)return;
 const key=r.mode==='navigate'?abs('index.html'):r.url;
 e.respondWith((async()=>{
  const cache=await caches.open(V),hit=await cache.match(key,{ignoreSearch:true});
  const net=fetch(r.mode==='navigate'?key:r).then(res=>{if(res&&res.ok)cache.put(key,res.clone());return res}).catch(()=>null);
  if(hit){e.waitUntil(net);return hit}
  return(await net)||new Response('آفلاین',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})})())});
