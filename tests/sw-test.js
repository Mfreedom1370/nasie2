// اجرا: node tests/sw-test.js — رفتار Service Worker را شبیه‌سازی می‌کند (نصب، آفلاین، آپدیت نسخه، پاک شدن کش قدیمی)
const fs=require('fs'),path=require('path'),root=path.join(__dirname,'..'),BASE='https://shop.test/nasie/';
const mime=f=>f.endsWith('.html')?'text/html':f.endsWith('.js')?'text/javascript':'application/octet-stream';
function makeEnv(src,online){const store=new Map(),L={};let net=online;
 const cacheOf=n=>{if(!store.has(n))store.set(n,new Map());const m=store.get(n);const key=r=>(typeof r==='string'?r:r.url).split('?')[0];
  return{put:async(r,res)=>{m.set(key(r),res)},match:async r=>{const x=m.get(key(r));return x?x.clone():undefined},keys:async()=>[...m.keys()]}};
 const fetchF=async r=>{if(!net)throw new TypeError('offline');const u=new URL(typeof r==='string'?r:r.url);const rel=decodeURIComponent(u.pathname.replace('/nasie/',''))||'index.html';
  const f=path.join(root,rel);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){return new Response('nf',{status:404})}return new Response(fs.readFileSync(f),{status:200,headers:{'Content-Type':mime(f)}})};
 const self={location:{href:BASE+'sw.js'},addEventListener:(t,fn)=>{L[t]=fn},skipWaiting:async()=>{self.skipped=true},clients:{claim:async()=>{self.claimed=true}}};
 const caches={open:async n=>cacheOf(n),keys:async()=>[...store.keys()],delete:async n=>store.delete(n),match:async()=>undefined};
 new Function('self','caches','fetch','Response','URL',src+'\n')(self,caches,fetchF,Response,URL);
 const ev=async(t,extra)=>{let p;const e={...extra,waitUntil:x=>{p=x},respondWith:x=>{p=x}};L[t](e);return p&&await p};
 return{store,self,setNet:v=>{net=v},install:()=>ev('install'),activate:()=>ev('activate'),req:(url,mode)=>{const r=new Request(url);Object.defineProperty(r,'mode',{value:mode||'cors'});return ev('fetch',{request:r})}}}
(async()=>{let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('  ✗',m)}};
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),m=sw.match(/const V='([^']+)'/);ok(!!m&&sw.length>500,'sw.js خالی نیست و V دارد');
 const A=makeEnv(sw,true);await A.install();await A.activate();
 const cached=[...A.store.get(m[1]).keys()].map(u=>u.replace(BASE,''));
 for(const f of['','index.html','manifest.webmanifest','css/style.css','js/store.js','js/parser.js','js/ledger.js','js/telegram.js','js/app.js','icon-192.png','icon-512.png','css/fonts/iranyekanwebregular.woff2','css/fonts/iranyekanwebbold.woff2','js/vendor/xlsx.full.min.js'])ok(cached.includes(f),'در کش نیست: '+f);
 ok(A.self.skipped&&A.self.claimed,'skipWaiting و claim');
 A.setNet(false);// ---- آفلاین ----
 let r=await A.req(BASE+'index.html','navigate');ok(r&&r.status===200&&(await r.text()).includes('دفتر نسیه'),'index.html آفلاین باز می‌شود');
 r=await A.req(BASE,'navigate');ok(r&&r.status===200,'ریشه‌ی سایت آفلاین باز می‌شود');
 for(const f of['js/app.js','js/ledger.js','css/style.css','manifest.webmanifest','icon-192.png','js/store.js?v=2']){r=await A.req(BASE+f);ok(r&&r.status===200,'آفلاین: '+f)}
 r=await A.req(BASE+'js/unknown.js');ok(r&&r.status===503,'فایل ناموجود آفلاین: پاسخ 503 مرتب');
 // ---- آپدیت نسخه ----
 const sw2=sw.replace(m[1],'nasie-v999'),B=makeEnv(sw2,true);B.store.set(m[1],new Map([['x',new Response('old')]]));B.store.set('other-app',new Map());
 await B.install();await B.activate();ok(!B.store.has(m[1]),'کش نسخه‌ی قبلی پاک شد');ok(B.store.has('nasie-v999'),'کش جدید ساخته شد');ok(B.store.has('other-app'),'کش برنامه‌های دیگر دست نخورد');
 console.log(fail?`❌ ${fail} مورد ناموفق`:'✅ تست‌های Service Worker موفق');process.exitCode=fail?1:0})();
