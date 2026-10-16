// Full app smoke test with a fake DOM and isolated storage. No external service calls.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const nodes=new Map(),listeners={},downloads=[],timers=[],frames=new Map();let frameSequence=0;
const encode=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function node(){let text='',html='';return {value:'',checked:false,hidden:false,dataset:{},style:{setProperty(){}},classList:{toggle(){},remove(){},add(){}},
 get textContent(){return text},set textContent(v){text=String(v);html=encode(v)},get innerHTML(){return html},set innerHTML(v){html=v},
 setAttribute(){},addEventListener(){},appendChild(){},remove(){},click(){downloads.push(this.download)}}}
const query=s=>{if(s==='#kk')return null;if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)};
const document={body:node(),visibilityState:'visible',querySelector:query,querySelectorAll:()=>[],createElement:node,addEventListener:(n,fn)=>listeners[n]=fn};
const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v))};
const window={addEventListener:(n,fn)=>listeners[n]=fn};
const context=vm.createContext({document,window,localStorage:storage,Blob,URL,FormData,performance:{now:()=>0},
 navigator:{locks:{request:async(n,o,fn)=>fn({name:n})}},
 addEventListener:(n,fn)=>listeners[n]=fn,setInterval:fn=>1,setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},
 requestAnimationFrame(fn){frames.set(++frameSequence,fn);return frameSequence},cancelAnimationFrame(id){frames.delete(id)},confirm:()=>false,fetch:()=>{throw new Error('Unexpected external network call')}});
const files=['js/store.js','js/safety.js','js/jdate.js','js/parser.js','js/ledger.js','js/telegram.js','js/app.js'];
vm.runInContext(files.map(read).join('\n'),context);
const execute=s=>vm.runInContext(s,context);
assert.ok(query('#view').innerHTML.includes('جمع بدهی‌ها'));
assert.equal(execute('Store.writeAllowed'),true);
// Rapid redraws keep one animation frame, including callbacks already queued by the browser.
const counter=node();counter.dataset.n='100';counter.isConnected=true;
document.querySelectorAll=s=>s==='[data-n]'?[counter]:[];
execute('anim()');const staleFrame=[...frames.values()][0];
for(let i=0;i<300;i++)execute('anim()');
assert.equal(frames.size,1,'redraws must cancel prior counter animations');
staleFrame(400);assert.equal(frames.size,1,'stale callback must not restart animation');
const finish=[...frames.values()][0];frames.clear();finish(1000);assert.equal(frames.size,0);
assert.equal(counter.textContent,'۱۰۰');document.querySelectorAll=()=>[];
// Calendar month boundaries, leap Esfand, invalid input and bounded daily log DOM.
execute("tab='log';selectLogDay(J.ts([1403,12,30],0))");
const flushFrames=()=>{const batch=[...frames.values()];frames.clear();for(const fn of batch)fn(1000)};
flushFrames();assert.ok(query('#view').innerHTML.includes('۱۴۰۳/۱۲/۳۰'));
execute('shiftLogDay(1)');flushFrames();assert.equal(execute('J.str(logJalali())'),'1404/01/01');
execute("changeLogMonth('۱۴۰۴',12)");flushFrames();
assert.equal((execute('logCalendar()').match(/onclick="selectLogDay/g)||[]).length,29);
execute('changeLogMonth(1403,12)');flushFrames();
assert.equal((execute('logCalendar()').match(/onclick="selectLogDay/g)||[]).length,30);
const validMonth=execute('JSON.stringify(logMonth)');execute("changeLogMonth('bad',99)");flushFrames();assert.equal(execute('JSON.stringify(logMonth)'),validMonth);
const originalLog=execute('Store.d.log');
if(process.env.TZ==='America/New_York'){
 assert.equal(execute('followingDay(new Date(2025,2,9).getTime())-localDay(new Date(2025,2,9).getTime())'),23*3600000);
 assert.equal(execute('followingDay(new Date(2025,10,2).getTime())-localDay(new Date(2025,10,2).getTime())'),25*3600000);
 execute("ld=localDay(new Date(2025,10,2));Store.d.log=[{ts:new Date(2025,10,2,23,30).getTime(),t:'tx',a:100,n:'late'},{ts:new Date(2025,10,3).getTime(),t:'tx',a:200,n:'next'}]");
 assert.equal((execute('vLog()').match(/class="lgr"/g)||[]).length,1,'25-hour day includes late entry and excludes next midnight');
}
execute("Store.d.log=Array.from({length:250},(_,i)=>({ts:ld+i*1000,t:'tx',a:100,n:'نمونه'}));logPage=0");
let logMarkup=execute('vLog()');assert.equal((logMarkup.match(/class="lgr"/g)||[]).length,100);assert.ok(logMarkup.includes('۲۵۰'));
execute('pageLog(2)');flushFrames();assert.equal((query('#view').innerHTML.match(/class="lgr"/g)||[]).length,50);
context.originalLog=originalLog;execute('Store.d.log=originalLog');
const persisted=storage.getItem('nasie'),startDay=execute('ld');
for(let i=0;i<1000;i++)execute(`shiftLogDay(${i%2?-1:1})`);
assert.equal(frames.size,1,'rapid day navigation coalesces into one redraw');flushFrames();
assert.equal(execute('ld'),startDay);assert.equal(storage.getItem('nasie'),persisted,'date navigation cannot change saved accounts');
execute("tab='dash';render()");
execute("const customer=Store.addC('آزمایشی');");
query('#cmd').value='آزما';execute('updateCmdSuggestions()');
assert.equal(query('#cmd-suggestions').hidden,false);
assert.ok(query('#cmd-suggestions').innerHTML.includes('آزمایشی'));
query('#cmd').value='نام کاملاً بی‌ربط';execute('updateCmdSuggestions()');
assert.equal(query('#cmd-suggestions').hidden,true);
execute("Store.addC('موقت نمونه',{guest:true});");
const dash=execute('vDash()');
assert.ok(dash.indexOf('مشتری‌های موقت')>dash.indexOf('جمع بدهی‌ها'));
assert.ok(dash.indexOf('مشتری‌های موقت')<dash.indexOf('story-action'));
assert.ok(dash.includes('موقت نمونه'),'settled temporary customer stays visible');
query('#ma').value='10000';query('#md').value='10';query('#mn').value='خرید';
execute('manual(customer.id,1)');assert.equal(execute('Store.bal(customer.id)'),10000);
execute('profile(customer.id)');assert.ok(query('#sheet').innerHTML.includes('ph customer-header'));
execute('editForm(customer.id)');assert.ok(query('#sheet').innerHTML.includes('customer-header'));
query('#ma').value='-500';execute('manual(customer.id,1)');assert.equal(execute('Store.bal(customer.id)'),10000);
execute("run('آزمایشی پنجاه هزار تومان پرداخت',{source:'voice'})");
assert.equal(execute('Store.d.tx.length'),1,'speech first waits for customer selection');
assert.ok(query('#sheet').innerHTML.includes('نزدیک‌ترین پیشنهاد'));
execute('acceptVoiceCustomer(customer.id)');
query('input[name=cs]:checked').value='0';query('input[name=ty]:checked').value='payment';
query('#voice-amount').value='50000';query('#dd').value='';
execute('okCmd();okCmd()');assert.equal(execute('Store.d.tx.length'),2);assert.equal(execute('Store.bal(customer.id)'),-40000);
const settings=execute('vSet()');
assert.ok(settings.includes('بکاپ کامل JSON'));assert.ok(settings.includes('دانلود JSON'));
assert.ok(settings.includes('بازیابی آخرین وضعیت سالم'));
// All generated inline handlers must compile, including recovery controls.
for(const match of settings.matchAll(/(?:onclick|onchange)="([^"]*)"/g)){
 const handler=match[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');new Function(handler);
}
execute("Store.addC('نام \" نقل‌قول')");assert.ok(execute('vSet()').includes('بازیابی JSON'));
execute("const guestLow=Store.addC('موقت کم',{guest:true}),guestHigh=Store.addC('موقت زیاد',{guest:true}),guestCredit=Store.addC('موقت بستانکار',{guest:true});Store.addTransaction({customerId:guestLow.id,amount:50000});Store.addTransaction({customerId:guestHigh.id,amount:150000});Store.addTransaction({customerId:guestCredit.id,amount:20000,type:'payment'});");
const temporaryMarkup=execute('vDash()').split('class="temporary-list">')[1].split('</section>')[0];
assert.ok(temporaryMarkup.indexOf('موقت زیاد')<temporaryMarkup.indexOf('موقت کم'));
assert.ok(temporaryMarkup.indexOf('موقت کم')<temporaryMarkup.indexOf('موقت نمونه'));
assert.ok(temporaryMarkup.indexOf('موقت نمونه')<temporaryMarkup.indexOf('موقت بستانکار'),'credit follows zero balances');
const before=storage.getItem('nasie');
const input={value:'backup.json',files:[{text:async()=>JSON.stringify({schema:2,customers:[],tx:[],trash:[],set:{},log:[],voiceLog:[],alerts:{}})}]};
context.testInput=input;
(async()=>{
 await execute('importBackup(testInput)');assert.equal(storage.getItem('nasie'),before,'cancelled preview leaves ledger unchanged');
 context.confirm=()=>true;await execute('importBackup(testInput)');assert.equal(execute('Store.d.customers.length'),0);
 assert.equal(storage.getItem('nasie_before_restore'),before);
 await execute('backup()');assert.equal(downloads.length,1);assert.ok(downloads[0].endsWith('.json'));
 assert.ok(query('#toast').textContent.includes('وجود فایل'));
 execute('Store.releaseWriter()');console.log('✅ Full app boot, forms, voice confirmation, settings handlers, restore preview and JSON download smoke test passed');
})().catch(e=>{console.error(e);process.exitCode=1});
