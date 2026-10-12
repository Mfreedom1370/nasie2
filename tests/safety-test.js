// Run: node tests/safety-test.js. Uses isolated fake storage; no real shop data or network.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const source=read('js/store.js')+read('js/safety.js');
function disk(raw=null){const values=new Map();if(raw!==null)values.set('nasie',raw);return {values,failKey:null,
 getItem:k=>values.has(k)?values.get(k):null,
 setItem(k,v){if(this.failKey==='*'||this.failKey===k)throw new Error('QuotaExceededError');values.set(k,String(v))}}}
function environment(storage,extra={}){const context=vm.createContext({localStorage:storage,document:{},...extra});
 vm.runInContext(source+'\nStore.load();',context);return {context,store:vm.runInContext('Store',context)}}
function fixture(){const storage=disk(),e=environment(storage);const c=e.store.addC('آزمایشی');return {...e,storage,c}}
const failure=fn=>assert.throws(fn,e=>e.storeError===true);
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS:',name)};
test('quota failure rolls back customer, transaction, balance and log',()=>{
 const {store,storage,c}=fixture(),raw=storage.getItem('nasie');storage.failKey='nasie';
 failure(()=>store.addTransaction({customerId:c.id,amount:50000}));
 assert.equal(store.bal(c.id),0);assert.equal(store.d.tx.length,0);assert.equal(storage.getItem('nasie'),raw);
 assert.equal(store.d.log.length,JSON.parse(raw).log.length);
 failure(()=>store.addC('نباید ذخیره شود'));assert.equal(store.d.customers.length,1);
});
test('customer creation and voice transaction form one durable operation',()=>{
 const {store,storage}=fixture(),raw=storage.getItem('nasie');storage.failKey='nasie';
 failure(()=>store.batch(()=>{const c=store.addC('جدید');store.addTransaction({customerId:c.id,amount:10000})}));
 assert.equal(store.d.customers.length,1);assert.equal(store.d.tx.length,0);assert.equal(storage.getItem('nasie'),raw);
 storage.failKey=null;store.batch(()=>{const c=store.addC('جدید');store.addTransaction({customerId:c.id,amount:10000})});
 assert.equal(environment(storage).store.d.tx.length,1);assert.equal(store.d.customers.length,2);
});
test('stale window cannot overwrite a newer persisted ledger',()=>{
 const {storage,c}=fixture(),a=environment(storage).store,b=environment(storage).store;
 a.addTransaction({customerId:c.id,amount:10000});const raw=storage.getItem('nasie');
 failure(()=>b.addTransaction({customerId:c.id,amount:20000}));assert.equal(storage.getItem('nasie'),raw);
 b.load();b.addTransaction({customerId:c.id,amount:20000});assert.equal(environment(storage).store.bal(c.id),30000);
});
test('malformed and unrelated imports leave live and persisted data unchanged',()=>{
 const {store,storage}=fixture(),raw=storage.getItem('nasie');
 for(const text of ['{broken','{}','[]','null','{"customers":null}',JSON.stringify({...store.d,schema:99})]){
  failure(()=>store.importJson(text));assert.equal(storage.getItem('nasie'),raw);assert.equal(JSON.stringify(store.d),raw);
 }
});
test('numeric strings, invalid IDs, duplicates and orphan transactions are rejected',()=>{
 const {store,storage,c}=fixture();store.addTransaction({customerId:c.id,amount:10000});const raw=storage.getItem('nasie');
 for(const edit of [d=>d.tx[0].amount='10000',d=>d.customers[0].id="bad'ID",d=>d.tx.push({...d.tx[0]}),d=>d.tx[0].customerId='missing']){
  const d=JSON.parse(raw);edit(d);failure(()=>store.importJson(JSON.stringify(d)));assert.equal(storage.getItem('nasie'),raw);
 }
 failure(()=>store.addTransaction({customerId:c.id,amount:-1}));failure(()=>store.addTransaction({customerId:'missing',amount:100}));
});
test('restore keeps an exact rollback copy and can reverse the replacement',()=>{
 const {store,storage,c}=fixture();store.addTransaction({customerId:c.id,amount:10000});const original=storage.getItem('nasie');
 const replacement=environment(disk()).store.d;store.importJson(JSON.stringify(replacement));
 assert.equal(store.d.customers.length,0);assert.equal(storage.getItem('nasie_before_restore'),original);
 store.importJson(store.recoveryText('before'));assert.equal(store.bal(c.id),10000);
});
test('failure to preserve the pre-restore backup prevents replacement',()=>{
 const {store,storage}=fixture(),raw=storage.getItem('nasie');storage.failKey='nasie_before_restore';
 failure(()=>store.importJson(JSON.stringify(environment(disk()).store.d)));assert.equal(storage.getItem('nasie'),raw);
 assert.equal(store.d.customers.length,1);
});
test('corrupt primary data stays intact and writes are blocked until explicit recovery',()=>{
 const {storage,c}=fixture(),good=storage.getItem('nasie');storage.setItem('nasie_last_good',good);storage.setItem('nasie','{broken');
 const store=environment(storage).store;assert.ok(store.blocked);assert.equal(store.d.customers.length,1);
 failure(()=>store.addTransaction({customerId:c.id,amount:1000}));assert.equal(storage.getItem('nasie'),'{broken');
 assert.equal(store.backupText(),'{broken');store.importJson(good);assert.equal(store.blocked,'');
 assert.equal(storage.getItem('nasie_before_restore'),'{broken');assert.equal(environment(storage).store.d.customers.length,1);
});
test('legacy load preserves source and migration backup, then commits schema 2 safely',()=>{
 const legacy={customers:[{id:'A',name:'قدیمی',days:14}],tx:[{id:'t1',cid:'A',amt:50000,ts:100000000,note:'قدیمی'}],trash:[],set:{days:30}};
 const raw=JSON.stringify(legacy),storage=disk(raw),store=environment(storage).store;
 assert.equal(storage.getItem('nasie'),raw);assert.equal(storage.getItem('nasie_pre_v2_backup'),raw);assert.equal(store.bal('A'),50000);
 store.addTransaction({customerId:'A',amount:1000,type:'payment'});assert.equal(environment(storage).store.bal('A'),49000);
 assert.equal(JSON.parse(storage.getItem('nasie')).schema,2);
});
test('local daily snapshots rotate to three days and contain complete restorable ledgers',()=>{
 const {store,storage,c}=fixture();store.addTransaction({customerId:c.id,amount:12345});
 const dates=[1,2,3,4].map(i=>({day:'old-'+i,ts:i,raw:storage.getItem('nasie')}));
 storage.setItem('nasie_daily_backups',JSON.stringify(dates));store.checkpoint();const backups=store.localBackups();
 assert.equal(backups.length,3);assert.equal(store.prepare(backups[2].raw).tx[0].amount,12345);
 store.checkpoint();assert.equal(store.localBackups().length,3);
});
test('snapshot failure does not claim a backup and does not lose committed transactions',()=>{
 const {store,storage,c}=fixture();storage.failKey='nasie_daily_backups';store.addTransaction({customerId:c.id,amount:987});
 assert.ok(store.backupWarning);assert.equal(environment(storage).store.bal(c.id),987);
});
test('direct settings edits roll back on invalid values or write failure',()=>{
 const {store,storage}=fixture(),old=store.d.set.days;store.d.set.days=-1;failure(()=>store.save());assert.equal(store.d.set.days,old);
 storage.failKey='nasie';store.d.set.days=20;failure(()=>store.save());assert.equal(store.d.set.days,old);
});

// Check Persian month boundaries against the supplied calendar helper.
test('current-month report uses Persian month boundaries, including previous Gregorian month',()=>{
 class ClockDate extends Date{constructor(...a){super(...(a.length?a:[2026,9,11,12]))}}
 const sample=[{ts:new Date(2026,8,25,12).getTime(),amt:10000,source:'manual'},{ts:new Date(2026,9,5,12).getTime(),amt:20000,source:'manual'},{ts:new Date(2026,8,20,12).getTime(),amt:50000,source:'manual'}];
 const ctx=vm.createContext({Date:ClockDate,Store:{live:()=>sample}}),app=read('js/app.js');
 vm.runInContext(read('js/jdate.js')+app.slice(app.indexOf('function months()'),app.indexOf('function vDash()')),ctx);
 assert.equal(vm.runInContext('months()[5].d',ctx),30000);
});

async function lockTests(){
 let held=false;const locks={request:async(name,opts,callback)=>{if(held)return callback(null);held=true;try{return await callback({name})}finally{held=false}}};
 function guarded(storage){const listeners={},doc={visibilityState:'visible',addEventListener:(n,f)=>listeners[n]=f};
  const e=environment(storage,{navigator:{locks},document:doc,window:{addEventListener:(n,f)=>listeners[n]=f}});
  e.store.startGuard(()=>{});return {...e,doc,listeners}}
 const {storage,c}=fixture(),a=guarded(storage),b=guarded(storage);await new Promise(r=>setImmediate(r));
 assert.equal(a.store.writeAllowed,true);assert.equal(b.store.writeAllowed,false);
 failure(()=>b.store.addTransaction({customerId:c.id,amount:100}));
 a.store.addTransaction({customerId:c.id,amount:1000});a.doc.visibilityState='hidden';a.listeners.visibilitychange();
 await new Promise(r=>setImmediate(r));b.store.acquireWriter();await new Promise(r=>setImmediate(r));
 assert.equal(b.store.writeAllowed,true);assert.equal(b.store.bal(c.id),1000);
 b.store.addTransaction({customerId:c.id,amount:2000});assert.equal(environment(storage).store.bal(c.id),3000);
 b.store.releaseWriter();await new Promise(r=>setImmediate(r));
 const unsupported=environment(storage,{navigator:{},document:{visibilityState:'visible',addEventListener(){}},window:{addEventListener(){}}});
 unsupported.store.startGuard(()=>{});assert.equal(unsupported.store.writeAllowed,false);
 checks++;console.log('PASS: exclusive writer lock, visibility handoff, refreshed state and unsupported-browser read-only mode');
 console.log('✅ All '+checks+' safety scenarios passed');
}
lockTests().catch(e=>{console.error(e);process.exitCode=1});
