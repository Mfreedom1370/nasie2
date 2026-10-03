// هسته ذخیره‌سازی. داده‌های قدیمی سازگارند؛ تراکنش‌های جدید سررسید، منبع و متادیتا دارند.
const DAY=86400000;
const DEF={token:'',chat:'',limit:5000000,days:30,bkHour:22,lastBk:'',aiUrl:'https://api.openai.com/v1',aiKey:'',aiModel:'gpt-4o-mini'};
const Store={d:{customers:[],tx:[],trash:[],log:[],set:{...DEF},alerts:{}},
 load(){
  try{
   const x=JSON.parse(localStorage.getItem('nasie')||'{}');
   this.d={...this.d,...x};
   this.d.customers=Array.isArray(this.d.customers)?this.d.customers:[];
   this.d.tx=Array.isArray(this.d.tx)?this.d.tx:[];
   this.d.trash=Array.isArray(this.d.trash)?this.d.trash:[];
   this.d.log=Array.isArray(this.d.log)?this.d.log:[];
   this.d.alerts=this.d.alerts||{};
   this.d.set={...DEF,...(x.set||{})};
   this.migrate();
  }catch(e){}
 },
 migrate(){
  this.d.tx.forEach(t=>{
   if(!t.id)t.id=this.uid();
   if(!t.ts)t.ts=Date.now();
   if(typeof t.amt!=='number')t.amt=Number(t.amt)||0;
   if(!t.source)t.source='legacy';
   if(!t.type)t.type=t.amt>=0?'credit':'payment';
   if(t.amt>0&&!t.dueAt){
    const c=this.d.customers.find(x=>x.id===t.cid),days=c?.days||this.d.set.days;
    t.dueAt=t.ts+Math.max(0,Number(days)||0)*DAY;
   }
  });
 },
 save(){localStorage.setItem('nasie',JSON.stringify(this.d))},
 uid:()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7),
 nm(id){return(this.d.customers.find(c=>c.id===id)||{}).name||'؟'},
 bal(id){return this.d.tx.filter(t=>t.cid===id).reduce((a,t)=>a+Number(t.amt||0),0)},
 total(){return this.d.customers.reduce((a,c)=>a+Math.max(0,this.bal(c.id)),0)},
 log(t,n,a,meta={}){this.d.log.push({ts:Date.now(),t,n,a,...meta});if(this.d.log.length>8000)this.d.log.splice(0,800)},
 addC(name,extra={}){const c={id:this.uid(),name,...extra};this.d.customers.push(c);this.log('c+',name);this.save();return c},
 addTx(cid,amt,note='',meta={}){
  const n=Number(amt)||0,ts=meta.ts||Date.now(),c=this.d.customers.find(x=>x.id===cid);
  const days=Math.max(0,Number(c?.days||this.d.set.days)||0);
  const t={
   id:this.uid(),cid,amt:n,note:String(note||''),ts,
   type:n>=0?'credit':'payment',
   source:meta.source||'manual',
   raw:meta.raw||'',
   dueAt:n>0?(meta.dueAt||ts+days*DAY):null,
   items:Array.isArray(meta.items)?meta.items:[],
   meta:meta.meta||{}
  };
  this.d.tx.push(t);this.log('tx',this.nm(cid),n,{source:t.source});
  this.save();return t;
 },
 ageInfo(id){
  const tx=this.d.tx.filter(t=>t.cid===id).sort((a,b)=>a.ts-b.ts);
  const debts=tx.filter(t=>Number(t.amt)>0).map(t=>({...t,remaining:Number(t.amt)}));
  let pay=tx.filter(t=>Number(t.amt)<0).reduce((s,t)=>s+Math.abs(Number(t.amt)),0);
  for(const d of debts){if(pay<=0)break;const x=Math.min(d.remaining,pay);d.remaining-=x;pay-=x}
  const open=debts.filter(t=>t.remaining>0);
  const lastPay=tx.filter(t=>Number(t.amt)<0).reduce((m,t)=>Math.max(m,t.ts),0);
  const oldest=open[0]||null;
  const dueAt=oldest?.dueAt||null;
  const daysSinceLastPayment=lastPay?Math.floor((Date.now()-lastPay)/DAY):null;
  const daysSinceDebt=oldest?Math.floor((Date.now()-oldest.ts)/DAY):0;
  const daysOverdue=dueAt?Math.max(0,Math.floor((Date.now()-dueAt)/DAY)):0;
  return {open,oldest,lastPay,dueAt,daysSinceLastPayment,daysSinceDebt,daysOverdue};
 },
 daysOverdue(id){return this.ageInfo(id).daysOverdue},
 delTx(id){const t=this.d.tx.find(x=>x.id===id);if(!t)return;this.d.tx=this.d.tx.filter(x=>x.id!==id);
  this.d.trash.push({id:this.uid(),k:'tx',data:t,ts:Date.now(),label:this.nm(t.cid)+' · '+t.amt});this.log('tx-',this.nm(t.cid),t.amt);this.save()},
 delC(id){const c=this.d.customers.find(x=>x.id===id);if(!c)return;const txs=this.d.tx.filter(t=>t.cid===id);
  this.d.customers=this.d.customers.filter(x=>x.id!==id);this.d.tx=this.d.tx.filter(t=>t.cid!==id);
  this.d.trash.push({id:this.uid(),k:'c',data:{c,txs},ts:Date.now(),label:c.name});this.log('c-',c.name);this.save()},
 restore(tid){const i=this.d.trash.find(x=>x.id===tid);if(!i)return false;
  if(i.k==='c'){this.d.customers.push(i.data.c);this.d.tx.push(...i.data.txs);this.log('rs',i.data.c.name)}
  else{if(!this.d.customers.some(c=>c.id===i.data.cid))return false;this.d.tx.push(i.data);this.log('rs',this.nm(i.data.cid))}
  this.d.trash=this.d.trash.filter(x=>x.id!==tid);this.save();return true},
 purge(tid){this.d.trash=this.d.trash.filter(x=>x.id!==tid);this.save()},
 exportJson(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(this.d,null,2)],{type:'application/json'}));a.download='nasie-backup.json';a.click()},
 importJson(txt){const x=JSON.parse(txt);if(!x||!Array.isArray(x.customers)||!Array.isArray(x.tx))throw new Error('ساختار فایل نامعتبر است');Object.assign(this.d,x);this.d.set={...DEF,...(x.set||{})};this.migrate();this.save()}
};
