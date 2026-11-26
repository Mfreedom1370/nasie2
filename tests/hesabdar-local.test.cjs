const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
test('shared local ledger survives reload while preview reprices only eligible credits',()=>{
 const data=new Map();
 const context=vm.createContext({structuredClone,document:{addEventListener(){}},window:{dispatchEvent(){}},CustomEvent:class{},localStorage:{
  getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)
 }});
 for(const file of ['store','safety','ledger','hesabdar-local'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file+'.js'),'utf8'),context);
 const run=source=>vm.runInContext(source,context);
 run(`Store.load(); const c=Store.addC('مشتری');
 const debt=Store.addTx(c.id,100,'نسیه');
 Store.addTx(c.id,-40,'پرداخت');
 HesabdarLocal.save(debt.id,[{name:'شیر',quantity:'۱٫۲۵',original:'۸۰',price:'۱۶۰'}]); Store.load();`);
 assert.equal(run('Store.bal(c.id)'),60);
 assert.equal(run('HesabdarLocal.account(c.id).current'),160n);
 run("HesabdarLocal.price('شیر','۲۴۰')");
 assert.equal(run('HesabdarLocal.account(c.id).current'),260n);
 run("Store.addTransaction({customerId:c.id,type:'adjustment',amount:-60}); HesabdarLocal.price('شیر','۲۸۰')");
 assert.equal(run('HesabdarLocal.account(c.id).current'),0n);
 assert.equal(run('JSON.parse(localStorage.getItem("nasie")).hesabdarOffline.products["شیر"].price'),'280');
});

test('catalog prices, chronological history and balance order share a restorable ledger',()=>{
 const memory=new Map();
 const context=vm.createContext({structuredClone,document:{addEventListener(){}},window:{dispatchEvent(){}},CustomEvent:class{},localStorage:{
  getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)
 }});
 for(const file of ['store','safety','ledger','hesabdar-local'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file+'.js'),'utf8'),context);
 const run=source=>vm.runInContext(source,context);
 run(`Store.load();
 const a=Store.addC('الف'),b=Store.addC('ب'),c=Store.addC('ج');
 Store.addTx(a.id,100,'خرید'); const debt=Store.addTx(b.id,200,'خرید'); Store.addTx(c.id,-100,'پرداخت');
 HesabdarLocal.saveProduct('',{name:'شیر',price:'۱۰۰',unit:'بطری',code:'123'});
 HesabdarLocal.save(debt.id,[{name:'شیر',quantity:'2',original:'100',price:''}]);
 HesabdarLocal.saveProduct('شیر',{name:'شیر محلی',price:'۱۲۰',unit:'بطری',code:'123'});
 HesabdarLocal.price('شیر محلی','۱۲۰');
 Store.load();`);
 assert.equal(run('HesabdarLocal.customers().map(c=>c.name).join()'),'ب,الف,ج');
 assert.equal(run('HesabdarLocal.account(b.id).original'),200n);
 assert.equal(run('HesabdarLocal.account(b.id).current'),240n);
 assert.equal(run('Store.d.hesabdarOffline.history.map(x=>x.after).join()'),'100,120');
 assert.equal(run('Store.d.hesabdarOffline.products["شیر محلی"].code'),'123');
 run(`Store.addTx(b.id,-200,'تسویه'); HesabdarLocal.price('شیر محلی','۱۵۰')`);
 assert.equal(run('HesabdarLocal.account(b.id).current'),0n);
 assert.equal(run('HesabdarLocal.customers()[0].name'),'الف');
 assert.throws(()=>run(`HesabdarLocal.saveProduct('',{name:'شير محلی',price:'100'})`),/همین نام/);
});

test('debt statements retain original ledger rates and use current catalog prices in Hesabdar',()=>{
 const memory=new Map();
 const context=vm.createContext({structuredClone,document:{addEventListener(){}},window:{dispatchEvent(){}},CustomEvent:class{},localStorage:{
  getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)
 }});
 for(const file of ['store','safety','ledger','hesabdar-local','debt-invoice'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file+'.js'),'utf8'),context);
 const run=source=>vm.runInContext(source,context);
 run(`Store.load();
 const customer=Store.addC('مشتری'),paid=Store.addTx(customer.id,100,'قدیمی'),tx=Store.addTx(customer.id,850,'ثبت باز');
 Store.addTx(customer.id,-300,'پرداخت');
 HesabdarLocal.save(paid.id,[{name:'کالای تسویه‌شده',quantity:'1',original:'100',price:'500'}]);
 HesabdarLocal.save(tx.id,[{name:'برنج پاکستانی',quantity:'2.5',original:'300',price:'400'}]);
 const fromLedger=DebtInvoice.statement(customer.id,'ledger');
 const fromHesabdar=DebtInvoice.statement(customer.id,'hesabdar');`);
 assert.equal(run('fromLedger.payable'),650n);
 assert.equal(run('fromHesabdar.payable'),900n);
 assert.equal(run('fromHesabdar.debts.length'),1);
 assert.equal(run('fromLedger.debts[0].lines[0].price'),300n);
 assert.equal(run('fromHesabdar.debts[0].lines[0].price'),400n);
 assert.equal(run('fromHesabdar.debts[0].lines[0].total'),1000n);
 assert.equal(run('fromHesabdar.debts[0].unitemized'),100n);
 assert.equal(run('fromHesabdar.debts[0].used'),200n);
 assert.equal(run('Store.bal(customer.id)'),650);
 run(`HesabdarLocal.price('برنج پاکستانی','0')`);
 assert.equal(run("DebtInvoice.statement(customer.id,'hesabdar').credit"),100n);
 assert.equal(run("DebtInvoice.statement(customer.id,'ledger').payable"),650n);
});

test('a counter photo survives reload and moves only to the next credit of the selected customer',()=>{
 const memory=new Map(),captureIds=[],clicks=[];
 const context=vm.createContext({structuredClone,CustomEvent:class{},document:{addEventListener(type,fn){if(type==='click')clicks.push(fn);}},
  window:{dispatchEvent(){},NasieAndroid:{counter:{config:()=>({configured:true}),capture:id=>captureIds.push(id)}}},
  localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},
  toast(){},esc:String,dt:String,tm:String,fmt:String});
 for(const file of ['store','safety','counter-photos'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file+'.js'),'utf8'),context);
 const run=source=>vm.runInContext(source,context);
 run(`Store.load();const a=Store.addC('مشتری اول'),b=Store.addC('مشتری دوم');
 const button={disabled:false,textContent:'عکس پیشخوان',dataset:{counterCustomer:a.id,counterTx:''},hasAttribute:()=>false};`);
 clicks[0]({target:{closest:()=>run('button')}});
 assert.deepEqual(captureIds,[1]);
 assert.throws(()=>run("Store.addTx(a.id,100,'پیش از آماده شدن عکس')"),/در حال انجام/);
 assert.equal(run('Store.d.tx.length'),0);
 run(`CounterPhotos.result(1,'photo-1','');Store.load();
 Store.addTx(a.id,-10,'پرداخت');Store.addTx(b.id,100,'نسیه مشتری دوم');
 const credit=Store.addTx(a.id,100,'نسیه مشتری اول');Store.load();`);
 assert.equal(run('Store.d.counterPhotos.linked[credit.id][0].id'),'photo-1');
 assert.equal(run('Object.keys(Store.d.counterPhotos.pending).length'),0);
 assert.equal(run('Object.keys(Store.d.counterPhotos.linked).length'),1);
 run("button.dataset.counterTx=credit.id;");
 clicks[0]({target:{closest:()=>run('button')}});
 run("CounterPhotos.result(2,'photo-2','');Store.load();");
 assert.equal(run('Store.d.counterPhotos.linked[credit.id].length'),2);
});
