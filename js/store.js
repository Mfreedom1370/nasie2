// ذخیره‌سازی محلی — نسخه‌ی ۲ (schema 2): ساختار Transaction حرفه‌ای.
// فیلدهای قدیمی cid/amt/note/ts به‌عنوان «آینه» نگه داشته می‌شوند تا داده‌ها و کدهای قدیمی خراب نشوند.
// type: credit(نسیه، +) | payment(پرداخت، −) | adjustment(تعدیل، amount علامت‌دار)
const DAY=864e5;
const DEF={token:'',chat:'',limit:5000000,days:30,bkHour:22,lastBk:'',aiUrl:'https://api.openai.com/v1',aiKey:'',aiModel:'gpt-4o-mini',aiAnon:true};
const Store={d:{customers:[],tx:[],trash:[],log:[],voiceLog:[],schema:2,set:{...DEF},alerts:{}},ver:0,
 sgn:t=>t.type==='payment'?-t.amount:t.amount,
 mirror(t){t.cid=t.customerId;t.amt=this.sgn(t);t.note=t.description||'';t.ts=t.date;return t},
 live(){return this.d.tx.filter(t=>t.status!=='cancelled')},
 dueDays(cid){const c=this.d.customers.find(x=>x.id===cid);return(c&&c.days)||this.d.set.days||30},
 // تبدیل تراکنش قدیمی {id,cid,amt,note,ts} به ساختار جدید (بدون حذف هیچ فیلدی)
 fixTx(t,days){
  if(t.type&&t.customerId!==undefined&&t.amount!==undefined){t.status=t.status||'active';t.items=t.items||[];t.createdAt=t.createdAt||t.date;t.source=t.source||'manual';return this.mirror(t)}
  const amt=+t.amt||0,ts=t.ts||t.createdAt||Date.now(),type=amt>0?'credit':amt<0?'payment':'adjustment',
   imp=String(t.id).startsWith('oldt')||String(t.note||'').startsWith('مانده‌ی انتقالی');
  return this.mirror({...t,id:t.id,customerId:t.cid,type,amount:type==='adjustment'?0:Math.abs(amt),date:ts,dueDate:type==='credit'?ts+days*DAY:null,
   description:t.note||'',items:[],createdAt:ts,source:imp?'import':'manual',status:'active'})},
 migrate(){const d=this.d,days=d.set.days||30,dd=id=>((d.customers.find(c=>c.id===id)||{}).days)||days;
  d.tx=d.tx.map(t=>this.fixTx(t,dd(t.cid)));
  d.trash.forEach(i=>{if(i.k==='tx')i.data=this.fixTx(i.data,dd(i.data.cid));else if(i.data&&i.data.txs)i.data.txs=i.data.txs.map(t=>this.fixTx(t,(i.data.c&&i.data.c.days)||days))});
  d.voiceLog=d.voiceLog||[];d.log=d.log||[];d.trash=d.trash||[];d.alerts=d.alerts||{};d.schema=2},
 load(){let raw=null;
  try{raw=localStorage.getItem('nasie');const x=JSON.parse(raw||'{}'),old=raw&&(x.schema||0)<2;
   if(old){try{if(!localStorage.getItem('nasie_pre_v2_backup'))localStorage.setItem('nasie_pre_v2_backup',raw)}catch(e){}}  // بکاپ داخلی قبل از migration
   Object.assign(this.d,x);this.d.set={...DEF,...x.set};this.migrate();if(old)this.save()}
  catch(e){try{if(raw)localStorage.setItem('nasie_corrupt_backup',raw)}catch(_){}}},
 save(){this.ver++;try{localStorage.setItem('nasie',JSON.stringify(this.d))}catch(e){if(typeof toast==='function')toast('⚠️ حافظه‌ی گوشی پر است؛ بکاپ بگیر')}},
 restoreInternalBackup(){const r=localStorage.getItem('nasie_pre_v2_backup');if(!r)return false;localStorage.setItem('nasie',r);return true},
 hasInternalBackup(){return!!localStorage.getItem('nasie_pre_v2_backup')},
 uid:()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6),
 nm(id){return(this.d.customers.find(c=>c.id===id)||{}).name||'؟'},
 bal(id){return this.live().filter(t=>t.customerId===id).reduce((a,t)=>a+this.sgn(t),0)},
 total(){return this.d.customers.reduce((a,c)=>a+Math.max(0,this.bal(c.id)),0)},
 log(t,n,a){this.d.log.push({ts:Date.now(),t,n,a});if(this.d.log.length>8000)this.d.log.splice(0,800)},
 vlog(e){const id=this.uid();this.d.voiceLog.push({id,ts:Date.now(),...e});if(this.d.voiceLog.length>300)this.d.voiceLog.splice(0,50);this.save();return id},
 vset(id,res){const v=this.d.voiceLog.find(x=>x.id===id);if(v){v.result=res;this.save()}},
 addC(name,extra){const c={id:this.uid(),name,...extra};this.d.customers.push(c);this.log('c+',name);this.save();return c},
 // ثبت تراکنش جدید با ساختار کامل
 addTransaction(o){const now=o.createdAt||Date.now(),date=o.date||now,type=o.type||'credit';
  const t=this.mirror({id:this.uid(),customerId:o.customerId,type,amount:type==='adjustment'?(+o.amount||0):Math.abs(+o.amount||0),date,
   dueDate:o.dueDate!==undefined?o.dueDate:(type==='credit'?date+this.dueDays(o.customerId)*DAY:null),
   description:o.description||'',items:o.items||[],createdAt:now,source:o.source||'manual',status:'active'});
  if(o.meta)t.meta=o.meta;this.d.tx.push(t);this.log('tx',this.nm(t.customerId),this.sgn(t));this.save();return t},
 addTx(cid,amt,note,o){return this.addTransaction({...o,customerId:cid,type:amt>0?'credit':amt<0?'payment':'adjustment',amount:Math.abs(amt),description:note})},
 cancelTx(id){const t=this.d.tx.find(x=>x.id===id);if(t){t.status='cancelled';this.log('tx-',this.nm(t.customerId),this.sgn(t));this.save()}},
 delTx(id){const t=this.d.tx.find(x=>x.id===id);if(!t)return;this.d.tx=this.d.tx.filter(x=>x.id!==id);
  this.d.trash.push({id:this.uid(),k:'tx',data:t,ts:Date.now(),label:this.nm(t.customerId)+' · '+this.sgn(t)});this.log('tx-',this.nm(t.customerId),this.sgn(t));this.save()},
 delC(id){const c=this.d.customers.find(x=>x.id===id);if(!c)return;const txs=this.d.tx.filter(t=>t.customerId===id);
  this.d.customers=this.d.customers.filter(x=>x.id!==id);this.d.tx=this.d.tx.filter(t=>t.customerId!==id);
  this.d.trash.push({id:this.uid(),k:'c',data:{c,txs},ts:Date.now(),label:c.name});this.log('c-',c.name);this.save()},
 restore(tid){const i=this.d.trash.find(x=>x.id===tid);if(!i)return false;
  if(i.k==='c'){this.d.customers.push(i.data.c);this.d.tx.push(...i.data.txs);this.log('rs',i.data.c.name)}
  else{if(!this.d.customers.some(c=>c.id===i.data.customerId))return false;this.d.tx.push(i.data);this.log('rs',this.nm(i.data.customerId))}
  this.d.trash=this.d.trash.filter(x=>x.id!==tid);this.save();return true},
 purge(tid){this.d.trash=this.d.trash.filter(x=>x.id!==tid);this.save()},
 exportJson(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(this.d)],{type:'application/json'}));a.download='nasie-backup.json';a.click()},
 importJson(txt){Object.assign(this.d,JSON.parse(txt));this.migrate();this.save()}};
