// nasie-release:32
const HesabdarLocal=(()=>{
 const empty=()=>({products:{},details:{},history:[]});
 const state=()=>Store.d.hesabdarOffline??empty();
 const nameKey=value=>String(value??'').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\s\u200c]+/g,' ').trim().toLowerCase();
 const digits=value=>String(value).replace(/[۰-۹٠-٩]/g,c=>String(c.charCodeAt(0)-(c>='۰'?1776:1632))).replace(/[٬,\s]/g,'').replace(/٫/g,'.');
 function numeric(value,scale=0){
  const raw=digits(value),[whole,fraction='']=raw.split('.');
  if(raw.length>26||!/^\d+(?:\.\d+)?$/.test(raw)||fraction.length>scale)throw Error(scale?'تعداد معتبر با حداکثر سه رقم اعشار وارد کنید.':'قیمت را به تومان و بدون اعشار وارد کنید.');
  return BigInt(whole)*10n**BigInt(scale)+BigInt(fraction.padEnd(scale,'0')||'0');
 }
 const lineTotal=(quantity,price)=>(numeric(quantity,3)*numeric(price)+500n)/1000n;
 const priceText=value=>BigInt(value).toLocaleString('fa-IR')+' تومان';
 const signature=tx=>JSON.stringify([tx.customerId,tx.amount,tx.date,tx.description]);
 let selected='',query='',page='customers', productQuery='', productKey='';
 let priceDay=null, priceMonth=null;
 const productAt=(book,key)=>Object.hasOwn(book.products,key)?book.products[key]:null;
 const byName=new Intl.Collator('fa');
 function putProduct(book,key,product,before){
  Object.defineProperty(book.products,key,{value:product,enumerable:true,writable:true,configurable:true});
  if(before!==product.price)(book.history??=[]).push({key,name:product.name,before,after:product.price,at:Date.now()});
 }
 function commit(book){Store.batch(()=>{Store.d.hesabdarOffline=book;Store.save();});}
 function saveProduct(key,input){
  const book=structuredClone(state()), old=key?productAt(book,key):null;
  if(key&&!old)throw Error('کالا پیدا نشد.');
  const name=input.name.trim(), nextKey=nameKey(name);
  if(!nextKey||name.length>200)throw Error('نام کالا لازم است.');
  if(nextKey!==key&&productAt(book,nextKey))throw Error('کالا با همین نام وجود دارد.');
  const price=String(numeric(input.price)),unit=(input.unit??'').trim().slice(0,40),code=(input.code??'').trim().slice(0,50);
  if(old&&nextKey!==key){
   for(const detail of Object.values(book.details))for(const line of detail.lines)if(line.product===key)line.product=nextKey;
   for(const change of book.history??[])if(change.key===key)change.key=nextKey;
   delete book.products[key];
  }
  putProduct(book,nextKey,{name,price,unit,code},old?.price??null);
  commit(book);
 }
 function price(key,value){
  const product=productAt(state(),key);
  if(!product)throw Error('کالا پیدا نشد.');
  saveProduct(key,{...product,price:value});
 }
 function account(cid){
  const detail=state(), entries=Ledger.entries(cid).slice().sort((a,b)=>a.date-b.date||a.createdAt-b.createdAt);
  let paid=entries.reduce((sum,tx)=>sum+(tx.type==='payment'?BigInt(tx.amount):tx.type==='adjustment'&&tx.amount<0?-BigInt(tx.amount):0n),0n);
  let change=0n;
  const credits=[],adjustments=[];
  for(const tx of entries){
   if(tx.type==='payment'||tx.amount<=0)continue;
   const amount=BigInt(tx.amount),used=paid>amount?amount:paid;paid-=used;
   if(tx.type!=='credit'){adjustments.push({tx,used,remaining:amount-used});continue;}
   const saved=Object.hasOwn(detail.details,tx.id)?detail.details[tx.id]:undefined;
   const needsReview=!!saved&&saved.signature!==signature(tx);
   const lines=saved?.lines??[],remaining=amount-used;
   const delta=lines.reduce((sum,line)=>sum+lineTotal(line.quantity,detail.products[line.product].price)-lineTotal(line.quantity,line.original),0n);
   const current=remaining===0n||needsReview?remaining:remaining+delta;
   change+=current-remaining;
   credits.push({tx,lines,used,remaining,current,needsReview});
  }
  const original=BigInt(Ledger.balance(cid));
  return {original,current:original+change,credits:credits.reverse(),adjustments};
 }
 function invoiceDetails(cid,useCurrent=false){
  const balance=account(cid),book=state();
  const debts=[...balance.credits,...balance.adjustments].filter(d=>d.remaining>0n)
   .sort((a,b)=>a.tx.date-b.tx.date||a.tx.createdAt-b.tx.createdAt);
  return {balance:useCurrent?balance.current:balance.original,debts:debts.map(d=>{
   const lines=(d.needsReview?[]:d.lines??[]).map(line=>{
    const product=book.products[line.product];
    const price=useCurrent?product.price:line.original;
    return {name:product.name,quantity:line.quantity,unit:product.unit??'',price:BigInt(price),
     originalTotal:lineTotal(line.quantity,line.original),total:lineTotal(line.quantity,price)};
   });
   const amount=BigInt(d.tx.amount),remaining=useCurrent?d.current??d.remaining:d.remaining;
   const unitemized=amount-lines.reduce((sum,line)=>sum+line.originalTotal,0n);
   return {...d,lines,remaining,total:remaining+d.used,unitemized};
  })};
 }
 function save(txId,inputs){
  const tx=Store.live().find(t=>t.id===txId&&t.type==='credit');
  if(!tx)throw Error('این ثبت نسیه دیگر در دفتر فعال نیست.');
  const next=structuredClone(state());
  const lines=inputs.map(input=>{
   const name=input.name.trim(), key=nameKey(name);
   if(!key||name.length>200)throw Error('نام هر کالا را وارد کنید.');
   const quantity=digits(input.quantity),original=String(numeric(input.original));
   if(numeric(quantity,3)<=0n)throw Error('تعداد یا وزن باید مثبت باشد.');
   const old=productAt(next,key);
   const price=input.price.trim()===''?(old?.price??original):String(numeric(input.price));
   putProduct(next,key,{...old,name:old?.name??name,price},old?.price??null);
   return {product:key,quantity,original};
  });
  if(lines.reduce((sum,line)=>sum+lineTotal(line.quantity,line.original),0n)>BigInt(tx.amount))throw Error('جمع قیمت اولیهٔ اقلام از مبلغ ثبت‌شده در دفتر بیشتر است.');
  Object.defineProperty(next.details,txId,{value:{signature:signature(tx),lines},enumerable:true,writable:true,configurable:true});
  commit(next);
 }
 function heading(title,back='بازگشت'){
  return `<header class="hd-heading"><button type="button" data-action="back">‹ ${back}</button><h2>${esc(title)}</h2><button type="button" data-action="close" aria-label="بستن صفحه">×</button></header>`;
 }
 function reset(){selected='';query='';page='customers';productQuery='';priceDay=null;priceMonth=null;}
 function customers(){
  const {balances}=Ledger.index();
  const q=nameKey(query);
  return Store.d.customers.filter(c=>nameKey([c.name,c.alias,c.phone].join(' ')).includes(q))
   .map(c=>({...c,balance:balances.get(c.id)??0}))
   .sort((a,b)=>b.balance-a.balance||byName.compare(a.name,b.name));
 }
 function rows(){
  const results=customers();
  return results.slice(0,80).map(c=>`<button class="hd-row hd-customer${c.name.length>24?' hd-long-name':''}" data-customer="${esc(c.id)}" title="${esc(c.name)}">
   <b>${esc(c.name)}</b><span class="hd-customer-amount"><small>${c.balance>0?'بدهکار':c.balance<0?'بستانکار':'تسویه'}</small><strong>${priceText(Math.abs(c.balance))}</strong></span>
  </button>`).join('')+(results.length===0?'<p>مشتری پیدا نشد.</p>':results.length>80?'<p>برای پیدا کردن مشتری‌های دیگر، نام را جستجو کنید.</p>':'');
 }
 function view(){
  if(page==='catalog')return catalog();
  if(page==='product')return productForm();
  const customer=Store.d.customers.find(c=>c.id===selected);
  if(!customer)return `<section class="box2 hd">${heading('حسابدار','دفتر نسیه')}<div class="hd-actions"><button class="pri" data-action="catalog">کالاها و قیمت‌ها</button></div><label>جستجوی مشتری<input class="sr" data-hd-search type="search" placeholder="نام یا شماره" value="${esc(query)}"></label><div id="hd-results">${rows()}</div></section>`;
  const value=account(customer.id);
  return `<section class="box2 hd">${heading(customer.name)}${DebtInvoice.button(customer.id,'hesabdar')}${CounterPhotos.button(customer.id)}<div class="hd-totals"><div>ماندهٔ دفتر<strong>${priceText(value.original)}</strong></div><div>با قیمت امروز<strong>${priceText(value.current)}</strong></div></div>`+
   (value.credits.map(({tx,lines,remaining,current,needsReview})=>'<article class="hd-entry"><div class="hd-entry-head"><strong>'+dt(tx.date)+'</strong><span>'+priceText(tx.amount)+'</span></div>'+
    (tx.description?'<p>'+esc(tx.description)+'</p>':'')+'<small>'+(remaining===0n?'تسویه‌شده':'مانده با قیمت امروز '+priceText(current))+'</small>'+
    (needsReview?'<p>مبلغ، تاریخ یا شرح دفتر تغییر کرده. اقلام را بررسی و دوباره ذخیره کنید.</p>':'')+
    (lines.length?'<ul>'+lines.map(line=>'<li>'+esc(state().products[line.product].name)+' · '+esc(line.quantity)+' × '+priceText(line.original)+'</li>').join('')+'</ul>':'')+
    '<button data-entry="'+esc(tx.id)+'">'+(lines.length?'ویرایش اقلام':'افزودن اقلام')+'</button>'+CounterPhotos.button(customer.id,tx.id)+'</article>').join('')||'<p>نسیه‌ای در دفتر ثبت نشده است.</p>')+'</section>';
 }
 let itemSearchId=0;
 function searchField(kind,value,attributes){
  const id=kind==='catalog'?'hd-catalog-matches':'hd-item-matches-'+(++itemSearchId);
  return `<div class="hd-product-search"><input ${attributes} data-product-search="${kind}" value="${esc(value)}"
   aria-controls="${id}" aria-expanded="false" autocomplete="off"><div id="${id}" class="hd-product-matches" aria-label="کالاهای مشابه" hidden></div></div>`;
 }
 function itemRow(line){
  const product=line&&state().products[line.product];
  return `<fieldset class="hd-line"><div class="hd-item-label">نام کالا</div>
   ${searchField('item',product?.name??'','name="name" maxlength="200" required aria-label="نام کالا"')}
   <label>تعداد یا وزن<input name="quantity" inputmode="decimal" value="${esc(line?.quantity??'1')}" required></label>
   <label>قیمت هر واحد زمان خرید<input name="original" inputmode="numeric" required value="${esc(line?.original??'')}"></label>
   <label>قیمت امروز (اختیاری)<input name="price" inputmode="numeric" placeholder="قیمت فعلی کالا"></label><button type="button" data-action="remove">حذف این ردیف</button></fieldset>`;
 }
 function edit(txId){
  const item=account(selected).credits.find(x=>x.tx.id===txId);
  if(!item)return;
  sheet('<form class="hd" data-hd-form="items" data-id="'+esc(txId)+'"><button type="button" data-action="close-sheet">‹ بازگشت</button><h2>اقلام نسیهٔ '+dt(item.tx.date)+'</h2><p>مبلغ ثبت‌شده: '+priceText(item.tx.amount)+'</p>'+CounterPhotos.linked(txId)+'<div id="hd-lines">'+(item.lines.length?item.lines.map(itemRow).join(''):itemRow())+'</div><button type="button" data-action="add">افزودن ردیف</button> <button class="pri">ذخیرهٔ اقلام</button><p role="alert"></p></form>');
 }
 function calendar(){
  const chosen=priceDay??localDay(Date.now()),[y,m]=priceMonth??logJalali(chosen).slice(0,2);
  const first=J.ts([y,m,1],0),after=J.ts(m===12?[y+1,1,1]:[y,m+1,1],0);
  const days=Math.round((after-first)/864e5),offset=(new Date(first).getDay()+1)%7;
  const changed=new Set((state().history??[]).map(row=>localDay(row.at)));
  const cells=Array.from({length:offset},()=>'<span aria-hidden="true"></span>');
  for(let day=1;day<=days;day++){
   const ts=J.ts([y,m,day],0),active=ts===chosen;
   cells.push(`<button type="button" class="${active?'selected ':''}${changed.has(ts)?'hd-changed':''}" aria-label="${J.fa([y,m,day])}${changed.has(ts)?'، دارای تغییر قیمت':''}" aria-pressed="${active}" data-price-day="${ts}">${fmt(day)}</button>`);
  }
  return `<div class="log-calendar hd-calendar"><div class="calendar-controls">
   <button type="button" data-month="-1" aria-label="ماه قبل">‹</button>
   <select data-price-month aria-label="ماه">${JM.map((month,i)=>`<option value="${i+1}" ${i+1===m?'selected':''}>${month}</option>`).join('')}</select>
   <input data-price-year inputmode="numeric" aria-label="سال شمسی" value="${y}">
   <button type="button" data-month="1" aria-label="ماه بعد">›</button></div>
   <div class="calendar-grid calendar-weekdays">${['ش','ی','د','س','چ','پ','ج'].map(x=>`<span>${x}</span>`).join('')}</div>
   <div class="calendar-grid">${cells.join('')}</div></div>`;
 }
 function changeMonth(step){
  let [y,m]=priceMonth??logJalali(priceDay??Date.now()).slice(0,2);
  m+=step;
  if(m<1){m=12;y--;}
  if(m>12){m=1;y++;}
  if(y>=1200&&y<=1600){priceMonth=[y,m];updateHistory();}
 }
 function historyRows(){
  const selectedDay=priceDay??localDay(Date.now()),q=nameKey(productQuery),book=state();
  const history=(book.history??[]).filter(row=>{
   const product=productAt(book,row.key);
   return localDay(row.at)===selectedDay&&nameKey([row.name,product?.name,product?.code,product?.unit].join(' ')).includes(q);
  });
  return `<h3>تغییرات ${dt(selectedDay)}</h3>`+(history.reverse().map(row=>`<article class="hd-history-row"><b>${esc(row.name)}</b><small>${tm(row.at)}</small><div>${row.before==null?'قیمت اولیه':priceText(row.before)} <span aria-hidden="true">←</span> <strong>${priceText(row.after)}</strong></div></article>`).join('')||'<p>تغییر قیمتی برای این روز پیدا نشد.</p>');
 }
 function updateHistory(){
  document.querySelector('#hd-calendar').innerHTML=calendar();
  document.querySelector('#hd-history').innerHTML=historyRows();
 }
 function matchingProducts(value){
  const words=nameKey(value).split(' ').filter(Boolean);
  return Object.entries(state().products).filter(([,p])=>{
   const fields=nameKey([p.name,p.code,p.unit].join(' '));
   return words.every(word=>fields.includes(word));
  }).sort(([,a],[,b])=>byName.compare(a.name,b.name));
 }
 const searchInput='[data-product-search]';
 function hideMatches(search){
  search.querySelector('.hd-product-matches').hidden=true;
  search.querySelector(searchInput).setAttribute('aria-expanded','false');
 }
 function showMatches(input){
  const search=input.closest('.hd-product-search'),box=search.querySelector('.hd-product-matches');
  if(!input.value.trim()){hideMatches(search);return;}
  const matches=matchingProducts(input.value).slice(0,7);
  box.innerHTML=matches.map(([key,p])=>`<button type="button" data-suggestion="${esc(key)}"><b>${esc(p.name)}</b><span>${priceText(p.price)}</span></button>`).join('')||'<p>کالای مشابه پیدا نشد.</p>';
  box.hidden=false;
  input.setAttribute('aria-expanded','true');
 }
 function productRows(){
  const matches=matchingProducts(productQuery);
  return matches.slice(0,80).map(([key,p])=>`<button class="hd-row hd-product" data-product="${esc(key)}"><span><b>${esc(p.name)}</b>${p.unit?`<small>${esc(p.unit)}</small>`:''}</span><span>${priceText(p.price)}</span></button>`).join('')+(matches.length===0?'<p>کالایی پیدا نشد.</p>':matches.length>80?'<p>برای دیدن کالاهای دیگر، جستجو کنید.</p>':'');
 }
 function catalog(){
  return `<section class="box2 hd hd-catalog">${heading('کالاها و قیمت‌ها')}
   <div class="hd-catalog-tools">${searchField('catalog',productQuery,'class="sr" data-hd-product-search type="search" aria-label="جستجوی کالا" placeholder="نام، کد یا بارکد"')}<button type="button" data-action="new-product">＋ کالای جدید</button></div>
   <div class="hd-calendar-panel"><h3>تقویم شمسی</h3><div id="hd-calendar">${calendar()}</div><div id="hd-history" aria-live="polite">${historyRows()}</div></div>
   <h3>فهرست کالاها</h3><div id="hd-product-results">${productRows()}</div></section>`;
 }
 function productForm(){
  const p=productAt(state(),productKey);
  return `<section class="box2 hd">${heading(p?'ویرایش کالا':'کالای جدید')}<form data-hd-form="product">
   <label>نام کالا<input name="name" maxlength="200" required value="${esc(p?.name??'')}"></label>
   <label>قیمت فعلی (تومان)<input name="price" dir="ltr" inputmode="numeric" required value="${p?BigInt(p.price).toLocaleString('en-US'):''}"></label>
   <label>واحد (اختیاری)<input name="unit" maxlength="40" placeholder="عدد، کیلو، بسته" value="${esc(p?.unit??'')}"></label>
   <label>کد یا بارکد (اختیاری)<input name="code" dir="ltr" maxlength="50" value="${esc(p?.code??'')}"></label>
   <button class="pri">ذخیرهٔ کالا</button><p role="alert"></p></form></section>`;
 }
 function redraw(){render();document.querySelector('#screen').scrollTop=0;}
 function back(){
  if(page==='product'){page='catalog';redraw();return;}
  if(page==='catalog'){page='customers';redraw();return;}
  if(selected){selected='';redraw();return;}
  exit();
 }
 function exit(){reset();tab='list';redraw();}
 document.addEventListener('input',event=>{
  if(event.target.matches('[data-hd-search]')){query=event.target.value;document.querySelector('#hd-results').innerHTML=rows();}
  if(event.target.matches('[data-hd-product-search]')){
   productQuery=event.target.value;document.querySelector('#hd-product-results').innerHTML=productRows();
   document.querySelector('#hd-history').innerHTML=historyRows();
  }
  if(event.target.matches(searchInput))showMatches(event.target);
  if(event.target.matches('.hd input[name="original"], .hd input[name="price"]'))formatMoneyInput(event.target);
 });
 document.addEventListener('focusin',event=>{
  if(event.target.matches(searchInput))showMatches(event.target);
 });
 document.addEventListener('focusout',event=>{
  const search=event.target.closest('.hd-product-search');
  if(search&&!search.contains(event.relatedTarget))hideMatches(search);
 });
 document.addEventListener('keydown',event=>{
  const search=event.target.closest('.hd-product-search');
  if(!search)return;
  const box=search.querySelector('.hd-product-matches'),input=search.querySelector(searchInput);
  if(box.hidden)return;
  if(event.key==='Escape'){event.preventDefault();input.focus();hideMatches(search);return;}
  if(event.key==='Enter'&&event.target===input){event.preventDefault();return;}
  if(!['ArrowDown','ArrowUp'].includes(event.key))return;
  const options=[...box.querySelectorAll('button')];
  if(!options.length)return;
  event.preventDefault();
  const index=options.indexOf(event.target);
  if(index===0&&event.key==='ArrowUp'){input.focus();return;}
  options[index<0?(event.key==='ArrowDown'?0:options.length-1):Math.min(index+(event.key==='ArrowDown'?1:-1),options.length-1)].focus();
 });
 document.addEventListener('change',event=>{
  if(!event.target.matches('[data-price-month],[data-price-year]'))return;
  const y=Number(digits(document.querySelector('[data-price-year]').value)),m=Number(document.querySelector('[data-price-month]').value);
  if(!Number.isInteger(y)||y<1200||y>1600){toast('سال باید بین ۱۲۰۰ و ۱۶۰۰ باشد.');updateHistory();return;}
  priceMonth=[y,m];updateHistory();
 });
 document.addEventListener('mousedown',event=>{
  if(event.target.closest('.hd-product-matches [data-suggestion]'))event.preventDefault();
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest('.hd button');if(!button)return;
  if(button.hasAttribute('data-suggestion')){
   const key=button.dataset.suggestion,search=button.closest('.hd-product-search'),input=search.querySelector(searchInput);
   if(input.dataset.productSearch==='catalog'){productKey=key;page='product';redraw();return;}
   const row=input.closest('fieldset');
   input.value=productAt(state(),key).name;
   hideMatches(search);
   row.querySelector('[name=quantity]').focus();
   return;
  }
  if(button.dataset.customer){selected=button.dataset.customer;redraw();return;}
  if(button.hasAttribute('data-price-day')){priceDay=Number(button.dataset.priceDay);updateHistory();document.querySelector('[data-price-day="'+priceDay+'"]')?.focus({preventScroll:true});return;}
  if(button.dataset.month){changeMonth(Number(button.dataset.month));return;}
  if(button.hasAttribute('data-product')){productKey=button.dataset.product;page='product';redraw();return;}
  if(button.dataset.entry){edit(button.dataset.entry);return;}
  switch(button.dataset.action){
   case 'catalog':page='catalog';redraw();break;
   case 'new-product':productKey='';page='product';redraw();break;
   case 'back':back();break;
   case 'close':exit();break;
   case 'close-sheet':closeSheet();break;
   case 'add':document.querySelector('#hd-lines').insertAdjacentHTML('beforeend',itemRow());break;
   case 'remove':button.closest('fieldset').remove();break;
  }
 });
 document.addEventListener('submit',event=>{
  const form=event.target;if(!form.dataset.hdForm)return;
  event.preventDefault();
  const status=form.querySelector('[role=alert]');
  try{
   if(form.dataset.hdForm==='items'){
    const lines=[...form.querySelectorAll('fieldset')].map(field=>Object.fromEntries([...field.querySelectorAll('input')].map(input=>[input.name,input.value])));
    save(form.dataset.id,lines);closeSheet();toast('اقلام ذخیره شد');
   }else{saveProduct(productKey,Object.fromEntries(new FormData(form)));page='catalog';redraw();toast('کالا ذخیره شد');}
  }catch(error){status.textContent=error.message;}
 });
 return {view,account,save,price,saveProduct,customers,reset,invoiceDetails};
})();
