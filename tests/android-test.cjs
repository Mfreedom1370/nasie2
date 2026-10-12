// Mock native boundaries with the real accounting Store. No phone data or network.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const disk=new Map(),events={},exportedFiles=[],speechCalls=[];
let fail=false;
const reply=(ok,value)=>JSON.stringify({ok,value,error:ok?undefined:'disk full'});
const context=vm.createContext({TextEncoder,Uint8Array,btoa:s=>Buffer.from(s,'binary').toString('base64'),
 document:{visibilityState:'visible',addEventListener:(name,fn)=>events[name]=fn},navigator:{},
 NasieNative:{
  get:key=>reply(true,disk.get(key)??null),
  put:(key,value)=>{if(fail)return reply(false);disk.set(key,value);return reply(true)},
  remove:key=>{disk.delete(key);return reply(true)},
  exportFile:(...args)=>{exportedFiles.push(args);return reply(true)},
  startSpeech:id=>speechCalls.push(['start',id]),stopSpeech:(...args)=>speechCalls.push(['stop',...args])
 }});
vm.runInContext('window=globalThis;',context);
vm.runInContext(read('js/android.js')+read('js/store.js')+read('js/safety.js')+'\nStore.load();',context);
const store=vm.runInContext('Store',context),native=context.NasieAndroid;
const c=store.addC('آزمایش اندروید');store.addTransaction({customerId:c.id,amount:125000});
const raw=disk.get('nasie');fail=true;
assert.throws(()=>store.addTransaction({customerId:c.id,amount:5000}),e=>e.storeError);
assert.equal(store.bal(c.id),125000);assert.equal(disk.get('nasie'),raw);fail=false;
store.exportJson();assert.equal(Buffer.from(exportedFiles[0][0],'base64').toString('utf8'),raw);
native.saved(false);assert.equal(disk.get('nasie'),raw,'Cancelled export must not mark a successful backup');
native.guard(store,()=>{});context.document.visibilityState='hidden';events.visibilitychange();
assert.throws(()=>store.addC('ممنوع در پس‌زمینه'),e=>e.storeError);
context.document.visibilityState='visible';events.visibilitychange();assert.equal(store.bal(c.id),125000);
const r=new context.SpeechRecognition(),seen=[];
r.onfallback=()=>seen.push('fallback');r.onstart=()=>seen.push('start');r.onresult=e=>seen.push(e.results[0][0].transcript);r.onend=()=>seen.push('end');
r.start();const id=speechCalls[0][1];native.speech(id,'start',null);native.speech(id,'fallback',null);
native.speech(id,'result',{texts:['علی پنجاه هزار تومان نسیه','علی پانصد هزار تومان نسیه'],confidence:[.9,.3]});
native.speech(id,'end',null);native.speech(id,'result',{texts:['late event'],confidence:[]});
assert.deepEqual(seen,['start','fallback','علی پنجاه هزار تومان نسیه','end']);
const cancelled=new context.SpeechRecognition();cancelled.start();cancelled.abort();
const next=new context.SpeechRecognition();next.start();next.stop();assert.equal(speechCalls.at(-1)[0],'stop');
console.log('PASS: Android storage rollback, UTF-8 export, lifecycle guard, speech alternatives and stale events.');
