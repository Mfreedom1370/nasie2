const CACHE='nasie-v2-cache-1';
const CORE=[
 './',
 './index.html',
 './css/style.css',
 './js/store.js',
 './js/parser.js',
 './js/telegram.js',
 './js/app.js',
 './js/jdate.js',
 './manifest.webmanifest',
 './icon-192.png',
 './icon-512.png'
];
self.addEventListener('install',e=>{
 e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
 e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(u.origin!==location.origin)return;
 e.respondWith(caches.match(e.request).then(cached=>{
   const network=fetch(e.request).then(r=>{
     if(r.ok && e.request.method==='GET'){
       const copy=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy));
     }
     return r;
   }).catch(()=>cached);
   return cached||network;
 }));
});
