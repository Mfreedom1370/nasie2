// Immutable, scoped offline release. Core assets change together only on a new release.
const V='nasie-v20';
const PREFIX='nasie:'+new URL('.',self.location.href).pathname+':',CACHE=PREFIX+V;
const CORE=['./','PS/background.png','index.html','manifest.webmanifest','css/style.css','js/store.js','js/safety.js','js/jdate.js','js/parser.js','js/ledger.js','js/liquid.js','js/telegram.js','js/app.js','icon-192.png','icon-512.png','css/fonts/iranyekanwebregular.woff2','css/fonts/iranyekanwebbold.woff2','js/vendor/xlsx.full.min.js'];
const abs=p=>new URL(p,self.location.href).href;
self.addEventListener('install',e=>e.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{await Promise.all(CORE.map(async p=>{const r=await fetch(abs(p),{cache:'reload'});
  if(!r.ok)throw new Error('precache '+p);
  if(p.startsWith('js/')&&!p.startsWith('js/vendor/')&&!(await r.clone().text()).includes('nasie-release:20'))throw new Error('release mismatch '+p);
  if(p==='index.html'&&!(await r.clone().text()).includes('name="nasie-release" content="20"'))throw new Error('release mismatch index');
  await cache.put(abs(p),r)}))}
 catch(error){await caches.delete(CACHE);throw error}
 // Existing clients keep their previous release until they close or explicitly update.
})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('message',e=>{if(e.data?.type==='ACTIVATE_UPDATE')e.waitUntil(self.skipWaiting())});
self.addEventListener('fetch',e=>{
 const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==new URL(self.location.href).origin)return;
 const key=r.mode==='navigate'?abs('index.html'):r.url,core=CORE.some(p=>abs(p).split('?')[0]===key.split('?')[0]);
 e.respondWith((async()=>{
  const cache=await caches.open(CACHE),hit=await cache.match(key,{ignoreSearch:true});if(hit)return hit;
  if(core)return new Response('نسخه آفلاین کامل نیست؛ با اینترنت برنامه را به‌روزرسانی کن',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  try{return await fetch(r)}catch(e){return new Response('آفلاین',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})}
 })())
});
