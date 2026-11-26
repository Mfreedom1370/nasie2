// nasie-release:31
const DebtInvoice=(()=>{
 const width=1240,height=1754,margin=76;
 const ink='#122c39', muted='#415864', line='#c6d4d9', pale='#eef5f6';
 const number=v=>BigInt(v).toLocaleString('fa-IR');
 const button=(id,source)=>`<button type="button" class="debt-invoice-button" data-debt-invoice="${esc(id)}" data-source="${source}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 3h9l3 3v15l-3-2-3 2-3-2-3 2zM9 9h6m-6 4h6"/></svg>فاکتور</button>`;
 function statement(id,source){
  const customer=Store.d.customers.find(c=>c.id===id);
  if(!customer)throw Error('مشتری پیدا نشد.');
  const current=source==='hesabdar';
  const {balance,debts}=HesabdarLocal.invoiceDetails(id,current);
  return {customer,issued:Date.now(),debts,current,payable:balance>0n?balance:0n,credit:balance<0n?-balance:0n};
 }
 function paint(ctx,text,x,y,{size=25,bold=false,color=ink,align='right',limit}={}){
  ctx.font=`${bold?'700':'400'} ${size}px IranYekan, Tahoma, sans-serif`;
  ctx.fillStyle=color;ctx.direction='rtl';ctx.textAlign=align;
  if(limit===undefined)ctx.fillText(String(text),x,y);
  else ctx.fillText(String(text),x,y,limit);
 }
 function wrap(ctx,text,max,size){
  ctx.font=`400 ${size}px IranYekan, Tahoma, sans-serif`;
  const result=[];let current='';
  for(const char of String(text)){
   if(char==='\n'||ctx.measureText(current+char).width>max){
    result.push(current.trim());current=char==='\n'?'':char;
   }else current+=char;
  }
  if(current.trim())result.push(current.trim());
  return result;
 }
 function divider(ctx,y){ctx.fillStyle=line;ctx.fillRect(margin,y,width-2*margin,1);}
 function makePages(model){
  const pages=[];let ctx,y;
  const {customer,issued,debts,payable,credit,current}=model;
  function page(){
   const canvas=document.createElement('canvas');
   canvas.width=width;canvas.height=height;
   ctx=canvas.getContext('2d');pages.push(canvas);
   if(!ctx)throw Error('این مرورگر امکان ساخت تصویر فاکتور را ندارد.');
   ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
   ctx.fillStyle='#1c6270';ctx.fillRect(margin,70,width-2*margin,10);
   paint(ctx,'صورتحساب بدهی مشتری',width-margin,145,{size:44,bold:true});
   paint(ctx,'دفتر نسیه',margin,142,{size:25,bold:true,align:'left',color:'#1c6270'});
   paint(ctx,'تاریخ صدور: '+dt(issued),margin,192,{align:'left',color:muted});
   paint(ctx,current?'نرخ روز کالاها':'نرخ ثبت‌شده در دفتر',margin,235,{align:'left',color:muted});
   paint(ctx,customer.name,width-margin,204,{size:32,bold:true,limit:620});
   if(customer.phone)paint(ctx,'شماره تماس: '+customer.phone,width-margin,246,{color:muted,limit:580});
   divider(ctx,273);y=306;
  }
  function ensure(space,heading){if(y+space>height-114){page();if(heading)heading();}}
  function debtHead(d,continued=false){
   ctx.fillStyle=pale;ctx.fillRect(margin,y,width-2*margin,96);
   paint(ctx,(d.tx.type==='adjustment'?'تعدیل بدهی':'ثبت نسیه')+' · '+dt(d.tx.date)+(continued?' · ادامه':''),width-margin-18,y+34,{bold:true});
   paint(ctx,(current?'مبلغ به نرخ روز: ':'مبلغ ثبت‌شده: ')+number(d.total)+'  |  پرداخت تخصیص‌یافته: '+number(d.used)+'  |  مانده: '+number(d.remaining)+' تومان',width-margin-18,y+73,{size:23});
   y+=115;
  }
  function labels(){
   for(const [text,x] of [['شرح کالا',1140],['تعداد / وزن',643],['قیمت واحد',416],['جمع ردیف',210]])paint(ctx,text,x,y+22,{bold:true,size:22,color:muted});
   divider(ctx,y+37);y+=46;
  }
  page();
  if(!debts.length){paint(ctx,'بدهی باز ثبت نشده است.',width-margin,y+42);y+=80;}
  for(const d of debts){
   ensure(180);debtHead(d);
   for(const text of wrap(ctx,d.tx.description??'',width-2*margin-32,22)){
    ensure(33,()=>debtHead(d,true));paint(ctx,text,width-margin-18,y+21,{size:22,color:muted});y+=32;
   }
   if(d.lines.length){
    ensure(100,()=>debtHead(d,true));labels();
    for(const row of d.lines){
     const names=wrap(ctx,row.name,440,24),rowHeight=Math.max(46,names.length*33+14);
     ensure(rowHeight,()=>{debtHead(d,true);labels();});
     names.forEach((text,i)=>paint(ctx,text,1140,y+28+i*33,{size:24}));
     paint(ctx,row.quantity.replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d])+(row.unit?' '+row.unit:''),643,y+28,{size:22,limit:188});
     paint(ctx,number(row.price),416,y+28,{size:22});
     paint(ctx,number(row.total),210,y+28,{size:22});
     divider(ctx,y+rowHeight-2);y+=rowHeight;
    }
   }
   if(d.unitemized>0n||d.needsReview){
    ensure(41,()=>debtHead(d,true));
    paint(ctx,d.needsReview?'اقلام این ثبت نیاز به بررسی دارند.':`مبلغ بدون ریز اقلام: ${number(d.unitemized)} تومان`,width-margin-18,y+24,{size:22,color:muted});
    y+=41;
   }
   y+=16;
  }
  ensure(135);
  ctx.fillStyle=pale;ctx.fillRect(margin,y,width-2*margin,110);
  paint(ctx,current?'ماندهٔ قابل پرداخت به قیمت روز':'ماندهٔ قابل پرداخت به قیمت ثبت‌شده',width-margin-20,y+43,{bold:true,size:26});
  paint(ctx,number(payable)+' تومان',margin+20,y+43,{bold:true,size:29,align:'left',color:'#1c6270'});
  if(credit>0n)paint(ctx,'بستانکاری مشتری: '+number(credit)+' تومان',width-margin-20,y+85,{size:23});
  pages.forEach((canvas,i)=>{
   const ctx=canvas.getContext('2d');divider(ctx,height-89);
   paint(ctx,'صفحهٔ '+number(i+1)+' از '+number(pages.length),margin,height-50,{align:'left',size:21,color:muted});
   paint(ctx,'تمام مبالغ به تومان است',width-margin,height-50,{size:21,color:muted});
  });
  return pages;
 }
 // JPEG page images preserve Persian joining and font appearance in any PDF reader.
 function pdf(images){
  const ascii=new TextEncoder(),chunks=[],offsets=[0];let length=0;
  const add=part=>{const bytes=typeof part==='string'?ascii.encode(part):part;chunks.push(bytes);length+=bytes.length;};
  const object=(id,parts)=>{offsets[id]=length;add(id+' 0 obj\n');parts.forEach(add);add('\nendobj\n');};
  add('%PDF-1.4\n');add(new Uint8Array([37,226,227,207,211,10]));
  object(1,['<< /Type /Catalog /Pages 2 0 R >>']);
  object(2,['<< /Type /Pages /Count '+images.length+' /Kids ['+images.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] >>']);
  images.forEach((image,i)=>{
   const id=3+i*3,cmd='q 595.28 0 0 841.89 0 0 cm /Im Do Q\n';
   object(id,[`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`]);
   object(id+1,[`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`,image,'\nendstream']);
   object(id+2,[`<< /Length ${cmd.length} >>\nstream\n`,cmd,'endstream']);
  });
  const xref=length;
  add('xref\n0 '+offsets.length+'\n0000000000 65535 f \n');
  offsets.slice(1).forEach(offset=>add(String(offset).padStart(10,'0')+' 00000 n \n'));
  add('trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
  return new Blob(chunks,{type:'application/pdf'});
 }
 const jpeg=canvas=>new Promise((resolve,reject)=>canvas.toBlob(async blob=>{
  try{if(!blob)throw Error('آماده‌سازی تصویر فاکتور ناموفق بود.');resolve(new Uint8Array(await blob.arrayBuffer()));}catch(error){reject(error);}
 },'image/jpeg',0.86));
 function download(blob,name){
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }
 async function open(id,source){
  const back=()=>source==='ledger'?profile(id):closeSheet();
  sheet('<div class="debt-invoice"><div class="debt-invoice-actions"><button type="button" data-invoice-back>‹ بازگشت</button><button type="button" data-invoice-save disabled>دریافت PDF</button><button type="button" data-invoice-share disabled>اشتراک PDF</button></div><p role="status">در حال آماده‌سازی فاکتور…</p><div class="debt-invoice-pages"></div></div>');
  const pane=document.querySelector('.debt-invoice'),status=pane.querySelector('[role=status]'),save=pane.querySelector('[data-invoice-save]'),share=pane.querySelector('[data-invoice-share]');
  pane.querySelector('[data-invoice-back]').onclick=back;
  try{
   const model=statement(id,source);
   await Promise.all([document.fonts?.load('400 25px IranYekan'),document.fonts?.load('700 25px IranYekan')]);
   if(!pane.isConnected)return;
   const pages=makePages(model);
   pane.querySelector('.debt-invoice-pages').append(...pages);
   const images=[];
   for(const page of pages)images.push(await jpeg(page));
   const blob=pdf(images);
   const name='nasie-'+id+'-'+new Date(model.issued).toISOString().slice(0,10)+(model.current?'-current':'')+'.pdf';
   const file=new File([blob],name,{type:blob.type});
   save.disabled=false;share.disabled=false;status.textContent='';
   save.onclick=async()=>{
    try{if(window.NasieAndroid?.exportBlob)await window.NasieAndroid.exportBlob(blob,name);else download(blob,name);}
    catch(error){status.textContent=error.message;}
   };
   share.onclick=async()=>{
    try{
     if(window.NasieAndroid?.sharePdf)await window.NasieAndroid.sharePdf(blob,name);
     else if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'صورتحساب بدهی مشتری'});
     else{download(blob,name);status.textContent='فایل PDF را دانلود کن و از برنامهٔ دلخواه ارسال کن.';}
    }catch(error){if(error.name!=='AbortError')status.textContent=error.message;}
   };
  }catch(error){status.textContent=error.message;}
 }
 document.addEventListener('click',event=>{
  const target=event.target.closest('[data-debt-invoice]');
  if(target)void open(target.dataset.debtInvoice,target.dataset.source);
 });
 return {button,statement,pdf};
})();
