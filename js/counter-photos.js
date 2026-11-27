// nasie-release:32
const CounterPhotos=(()=>{
 const bridge=()=>window.NasieAndroid?.counter;
 const book=()=>Store.d.counterPhotos??{pending:{},linked:{}};
 let active=null,sequence=0;
 const photosFor=(group,key)=>Object.hasOwn(group,key)?group[key]:[];
 function button(cid,tx=''){
  return tx?linked(tx):images(photosFor(book().pending,cid));
 }
 function images(photos){
  if(!bridge()||!photos?.length)return '';
  return `<details class="counter-photos"><summary>عکس‌های پیشخوان (${fmt(photos.length)})</summary>${photos.map(photo=>
   `<div><button type="button" data-counter-view="${esc(photo.id)}">${dt(photo.at)} · ${tm(photo.at)} · نمایش عکس</button></div>`).join('')}</details>`;
 }
 function linked(tx){return images(photosFor(book().linked,tx));}
 function movePending(tx){
  if(tx.type!=='credit')return;
  if(active?.cid===tx.customerId&&!active.tx){
   const error=Error('گرفتن عکس پیشخوان در حال انجام است؛ چند ثانیه صبر کنید.');
   error.storeError=true;throw error;
  }
  const current=book();
  if(!Object.hasOwn(current.pending,tx.customerId))return;
  Object.defineProperty(current.linked,tx.id,{value:current.pending[tx.customerId],enumerable:true,writable:true,configurable:true});
  delete current.pending[tx.customerId];
 }
 function panel(back){
  const c=bridge().config();
  sheet(`<form data-counter-settings>
   ${back?'<button type="button" data-counter-back>‹ بازگشت</button>':''}
   <h2>دوربین پیشخوان</h2>
   <label>آی‌پی محلی دوربین<input name="host" required inputmode="decimal" dir="ltr" placeholder="192.168.1.…" value="${esc(c.host)}"></label>
   <label>نام کاربری محلی<input name="user" required dir="ltr" value="${esc(c.user)}"></label>
   <label>رمز محلی دوربین<input name="password" type="password" autocomplete="off" dir="ltr" ${c.configured?'placeholder="رمز ذخیره شده است"':'required'}></label>
   <label>درگاه RTSP<input name="port" type="number" min="1" max="65535" required value="${c.port}"></label>
   <label>جریان تصویر<select name="stream"><option value="0" ${c.stream===0?'selected':''}>اصلی</option><option value="1" ${c.stream===1?'selected':''}>فرعی</option></select></label>
   <p>گوشی و دوربین باید روی همان وای‌فای باشند. جریان تصویر باید H.264 باشد.</p>
   <button class="pri">ذخیرهٔ اتصال</button> <button type="button" data-counter-test>تست تصویر</button><p role="status" aria-live="polite"></p>
   <div data-counter-preview></div></form>`);
  const form=document.querySelector('[data-counter-settings]');
  form.onsubmit=event=>{
   event.preventDefault();
   const formStatus=form.querySelector('[role=status]');
   try{
    const fields=new FormData(form);
    const host=norm(String(fields.get('host'))),port=Number(fields.get('port')),stream=Number(fields.get('stream'));
    bridge().save(host,String(fields.get('user')).trim(),String(fields.get('password')),port,stream);
    form.elements.password.value='';form.elements.password.required=false;form.elements.password.placeholder='رمز ذخیره شده است';
    formStatus.textContent='اتصال ذخیره شد. برای بررسی، تست تصویر را بزنید.';
   }catch(error){formStatus.textContent=error.message;}
  };
  form.querySelector('[data-counter-test]').onclick=event=>capture(event.currentTarget,'','',form);
  if(back)form.querySelector('[data-counter-back]').onclick=back;
 }
 function loadImage(id,target,temporary=false){
  const img=document.createElement('img');
  img.className='counter-image';img.alt='عکس پیشخوان';img.src=bridge().photo(id,temporary);
  target.replaceChildren(img);
 }
 function capture(trigger,cid,tx,testForm){
  if(active){toast('گرفتن عکس قبلی هنوز تمام نشده است.');return;}
  if(!bridge().config().configured&&!testForm){
   panel(()=>{if(tab==='hesabdar')closeSheet();else profile(cid);});return;
  }
  if(!testForm)Store.ensureWrite();
  trigger.disabled=true;const label=trigger.textContent;trigger.textContent='در حال گرفتن عکس…';
  active={id:++sequence,cid,tx,trigger,label,testForm};bridge().capture(active.id);
 }
 function result(id,photo,error){
  if(active?.id!==id)return;
  const {cid,tx,trigger,label,testForm}=active;active=null;
  trigger.disabled=false;trigger.textContent=label;
  const status=testForm?.querySelector('[role=status]');
  try{
   if(!photo)throw Error(error);
   if(testForm){
    loadImage(photo,testForm.querySelector('[data-counter-preview]'),true);status.textContent='تصویر دوربین دریافت شد.';return;
   }
   if(!Store.d.customers.some(c=>c.id===cid)||(tx&&!Store.live().some(t=>t.id===tx&&t.customerId===cid&&t.type==='credit')))throw Error('این مشتری یا ثبت نسیه دیگر فعال نیست.');
   Store.batch(()=>{
    const current=book(),group=tx?current.linked:current.pending,key=tx||cid;
    if(!Object.hasOwn(group,key))Object.defineProperty(group,key,{value:[],enumerable:true,writable:true,configurable:true});
    group[key].push({id:photo,at:Date.now()});
    Store.d.counterPhotos=current;Store.save();
   });
   const old=trigger.nextElementSibling;
   if(old?.matches('.counter-photos'))old.remove();
   if(trigger.isConnected)trigger.insertAdjacentHTML('afterend',images(tx?photosFor(book().linked,tx):photosFor(book().pending,cid)));
   toast(tx?'عکس به این نسیه وصل شد.':'عکس ذخیره شد و به ثبت نسیهٔ بعدی این مشتری وصل می‌شود.');
  }catch(failure){if(status)status.textContent=failure.message;else toast(failure.message);}
 }
 document.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-counter-customer],[data-counter-view],[data-counter-options]');
  if(!trigger||!bridge())return;
  try{
   if(trigger.hasAttribute('data-counter-options')){panel();return;}
   if(trigger.hasAttribute('data-counter-view')){
    let preview=trigger.nextElementSibling;
    if(preview){preview.remove();return;}
    preview=document.createElement('div');loadImage(trigger.dataset.counterView,preview);trigger.after(preview);return;
   }
   capture(trigger,trigger.dataset.counterCustomer,trigger.dataset.counterTx);
  }catch(error){toast(error.message);}
 });
 return {button,result,movePending,linked};
})();
