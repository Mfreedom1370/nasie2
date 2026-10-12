// Full app smoke test with a fake DOM and isolated storage. No external service calls.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const nodes=new Map(),listeners={},downloads=[],timers=[];
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
 requestAnimationFrame(){},confirm:()=>false,fetch:()=>{throw new Error('Unexpected external network call')}});
const files=['js/store.js','js/safety.js','js/jdate.js','js/parser.js','js/ledger.js','js/telegram.js','js/app.js'];
vm.runInContext(files.map(read).join('\n'),context);
const execute=s=>vm.runInContext(s,context);
assert.ok(query('#view').innerHTML.includes('جمع بدهی‌ها'));
assert.equal(execute('Store.writeAllowed'),true);
execute("const customer=Store.addC('آزمایشی');");
query('#ma').value='10000';query('#md').value='10';query('#mn').value='خرید';
execute('manual(customer.id,1)');assert.equal(execute('Store.bal(customer.id)'),10000);
query('#ma').value='-500';execute('manual(customer.id,1)');assert.equal(execute('Store.bal(customer.id)'),10000);
execute("run('آزمایشی پنجاه هزار تومان پرداخت',{source:'voice'})");
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
