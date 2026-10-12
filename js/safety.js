// nasie-release:14
// Safety layer: keep schema 2 and existing ledger APIs, commit or roll back each operation.
(() => {
 const clone=x=>JSON.parse(JSON.stringify(x));
 const original={};for(const k of ['addC','addTransaction','cancelTx','delTx','delC','restore','purge','vlog','vset'])original[k]=Store[k];
 const empty=()=>({customers:[],tx:[],trash:[],log:[],voiceLog:[],schema:2,set:{...DEF},alerts:{}});
 const fail=message=>{const e=new Error(message);e.storeError=true;throw e};
 const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
 const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
 const number=(x,min=0)=>Number.isSafeInteger(x)&&x>=min;
 const safeGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
 Object.assign(Store,{
  blocked:'',writeAllowed:true,guardMessage:'',backupWarning:'',_baseRaw:null,_lastGood:null,_depth:0,_dirty:false,
  validate(d){
   if(!plain(d)||d.schema!==2||!plain(d.set)||!plain(d.alerts))fail('ساختار فایل حساب‌ها معتبر نیست');
   for(const k of ['customers','tx','trash','log','voiceLog'])if(!Array.isArray(d[k]))fail('بخش '+k+' در فایل معتبر نیست');
   const cs=new Set(),ts=new Set();
   const customer=c=>{if(!plain(c)||!id(c.id)||typeof c.name!=='string'||!c.name.trim())fail('اطلاعات مشتری معتبر نیست');
    for(const k of ['alias','phone','note'])if(c[k]!==undefined&&typeof c[k]!=='string')fail('متن اطلاعات مشتری معتبر نیست');
    for(const k of ['limit','days'])if(c[k]!==undefined&&!number(c[k]))fail('حد بدهی یا مهلت مشتری معتبر نیست')};
   const tx=t=>{if(!plain(t)||!id(t.id)||!id(t.customerId)||!['credit','payment','adjustment'].includes(t.type)||!Number.isSafeInteger(t.amount)||(t.type!=='adjustment'&&t.amount<=0)||!number(t.date)||!number(t.createdAt)||!['active','cancelled'].includes(t.status)||!Array.isArray(t.items))fail('اطلاعات یک تراکنش معتبر نیست');
    if(t.dueDate!=null&&!number(t.dueDate))fail('سررسید تراکنش معتبر نیست')};
   for(const c of d.customers){customer(c);if(cs.has(c.id))fail('شناسه مشتری تکراری است');cs.add(c.id)}
   const balances=new Map();for(const t of d.tx){tx(t);if(ts.has(t.id)||!cs.has(t.customerId))fail('تراکنش تکراری یا بدون مشتری در فایل وجود دارد');ts.add(t.id);
    if(t.status!=='cancelled'){const balance=(balances.get(t.customerId)||0)+this.sgn(t);if(!Number.isSafeInteger(balance))fail('جمع مبلغ‌ها از محدوده دقیق محاسبه خارج است');balances.set(t.customerId,balance)}}
   if(!Number.isSafeInteger([...balances.values()].reduce((sum,x)=>sum+Math.max(0,x),0)))fail('جمع بدهی از محدوده دقیق محاسبه خارج است');
   const trashIds=new Set();for(const item of d.trash){if(!plain(item)||!id(item.id)||trashIds.has(item.id))fail('ساختار سطل زباله معتبر نیست');trashIds.add(item.id);
    if(item.k==='tx')tx(item.data);else if(item.k==='c'&&plain(item.data)&&Array.isArray(item.data.txs)){customer(item.data.c);for(const t of item.data.txs){tx(t);if(t.customerId!==item.data.c.id)fail('حساب مشتری حذف‌شده معتبر نیست')}}else fail('مورد ناشناس در سطل زباله')}
   for(const k of ['token','chat','aiKey','aiUrl','aiModel','lastBk'])if(typeof d.set[k]!=='string')fail('تنظیمات فایل معتبر نیست');
   if(!number(d.set.limit,1)||!number(d.set.days,1)||!number(d.set.bkHour)||d.set.bkHour>23)fail('حد بدهی، مهلت یا ساعت بکاپ معتبر نیست');
   if(typeof d.set.aiAnon!=='boolean')fail('تنظیمات دستیار معتبر نیست');
   return d;
  },
  prepare(txt){let x;try{x=JSON.parse(txt)}catch(e){fail('فایل JSON قابل خواندن نیست')}
   if(!plain(x)||!Array.isArray(x.customers)||!Array.isArray(x.tx)||(x.schema!==undefined&&![1,2].includes(x.schema)))fail('این فایل بکاپ معتبر دفتر نسیه نیست');
   if(x.schema===2&&(!['trash','log','voiceLog'].every(k=>Array.isArray(x[k]))||!plain(x.set)||!plain(x.alerts)))fail('بکاپ نسخه ۲ ناقص است؛ بخش‌های ضروری موجود نیستند');
   if(x.set!==undefined&&!plain(x.set))fail('تنظیمات بکاپ معتبر نیست');
   for(const t of x.tx)if(!t.type&&(!Number.isSafeInteger(Number(t.amt))||!id(t.cid)))fail('تراکنش قدیمی معتبر نیست');
   const work=Object.create(this);work.d={...empty(),...x,set:{...DEF,...x.set}};
   try{work.migrate();this.validate(work.d)}catch(e){if(e.storeError)throw e;fail('ساختار بکاپ ناقص یا خراب است')}
   return work.d;
  },
  load(){this.blocked='';this._dirty=false;this._depth=0;let raw;
   try{raw=localStorage.getItem('nasie');this._baseRaw=raw;this.d=raw===null?empty():this.prepare(raw);
    if(raw&&(JSON.parse(raw).schema||0)<2){try{if(!localStorage.getItem('nasie_pre_v2_backup'))localStorage.setItem('nasie_pre_v2_backup',raw)}catch(e){this.backupWarning='نسخه قبل از ارتقا ذخیره نشد؛ خروجی JSON بگیر'}}
   }catch(e){this._baseRaw=raw===undefined?null:raw;this.blocked='حساب‌های ذخیره‌شده قابل خواندن نیستند؛ ثبت متوقف است. از تنظیمات، بازیابی را انجام بده.';
    if(raw)try{localStorage.setItem('nasie_corrupt_backup',raw)}catch(_){}
    this.d=empty();const previous=safeGet('nasie_last_good');if(previous)try{this.d=this.prepare(previous)}catch(_){}
   }
   this._lastGood=clone(this.d);this.ver++;return !this.blocked;
  },
  ensureWrite(recovery=false){if(!this.writeAllowed)fail(this.guardMessage||'این پنجره فقط برای مشاهده است');if(this.blocked&&!recovery)fail(this.blocked)},
  rollback(){if(this._lastGood)this.d=clone(this._lastGood);this._dirty=false;this.ver++},
  save(recovery=false){if(this._depth){this._dirty=true;return true}
   try{this.ensureWrite(recovery===true);this.validate(this.d);const current=localStorage.getItem('nasie');
    if(current!==this._baseRaw)fail('حساب‌ها در پنجره دیگری تغییر کرده‌اند؛ صفحه را دوباره باز کن. این تغییر ثبت نشد.');
    const next=JSON.stringify(this.d);if(next===current){this._lastGood=clone(this.d);return true}
    // Preserve the exact previous data before replacing the main ledger.
    if(current&&!this.blocked)localStorage.setItem('nasie_last_good',current);
    localStorage.setItem('nasie',next);this._baseRaw=next;this._lastGood=clone(this.d);this.ver++;this._dirty=false;
   }catch(e){this.rollback();if(e.storeError)throw e;fail('ذخیره نشد؛ حافظه یا دسترسی ذخیره‌سازی مشکل دارد. تغییر به حساب‌ها اعمال نشد. خروجی JSON بگیر.')}
   this.checkpoint();return true;
  },
  batch(fn){if(this._depth)return fn();this.ensureWrite();const before=clone(this.d);this._depth=1;this._dirty=false;
   try{const result=fn();this._depth=0;if(this._dirty)this.save();return result}catch(e){this._depth=0;this._dirty=false;this.d=before;this.ver++;throw e}
  },
  replacePrepared(data){this.ensureWrite(true);this.validate(data);const current=localStorage.getItem('nasie');if(current!==this._baseRaw)fail('حساب‌ها تغییر کرده‌اند؛ قبل از بازیابی صفحه را دوباره باز کن');
   // A failed safety backup prevents the destructive replacement entirely.
   try{if(current!==null)localStorage.setItem('nasie_before_restore',current)}catch(e){fail('نسخه برگشت ذخیره نشد؛ بازیابی انجام نشد. ابتدا خروجی JSON بگیر و فضای حافظه را بررسی کن.')}
   const oldBlocked=this.blocked;this.d=clone(data);try{this.save(true);this.blocked='';return true}catch(e){this.blocked=oldBlocked;throw e}
  },
  importJson(txt){return this.replacePrepared(this.prepare(txt))},
  restoreInternalBackup(){const raw=safeGet('nasie_pre_v2_backup');return raw?this.importJson(raw):false},
  hasInternalBackup(){return !!safeGet('nasie_pre_v2_backup')},
  backupText(){if(this.blocked){if(typeof this._baseRaw==='string')return this._baseRaw;const raw=safeGet('nasie_corrupt_backup');if(raw!==null)return raw;fail('اطلاعات اصلی در دسترس نیست؛ خروجی خالی ساخته نشد. دسترسی حافظه را بررسی کن')}return JSON.stringify(this.validate(this.d))},
  download(text,name,type='application/json'){if(window.NasieAndroid)return window.NasieAndroid.exportText(text,name,type);const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)},
  exportJson(){this.download(this.backupText(),'nasie-backup-'+Date.now()+'.json')},
  localBackups(){try{const a=JSON.parse(safeGet('nasie_daily_backups')||'[]');return Array.isArray(a)?a.filter(x=>plain(x)&&typeof x.raw==='string'&&typeof x.day==='string'):[]}catch(e){return []}},
  checkpoint(){if(this.blocked||!this.writeAllowed||!this._baseRaw)return false;
   try{const day=new Date().toDateString(),a=this.localBackups(),entry={day,ts:Date.now(),raw:this._baseRaw};
    const last=a[a.length-1];if(last&&last.day===day&&last.raw===entry.raw)return true;
    localStorage.setItem('nasie_daily_backups',JSON.stringify([...a.filter(x=>x.day!==day),entry].slice(-3)));this.backupWarning='';return true;
   }catch(e){this.backupWarning='نسخه روزانه محلی ذخیره نشد؛ بکاپ JSON را بیرون از گوشی نگه دار';return false}
  },
  recoveryText(kind){if(kind==='previous')return safeGet('nasie_last_good');if(kind==='before')return safeGet('nasie_before_restore');return this.localBackups()[Number(kind)]?.raw||null},
  async requestPersistence(){if(window.NasieAndroid)return true;try{return !!(await navigator.storage?.persist())}catch(e){return false}},
  startGuard(changed){if(typeof navigator==='undefined')return;
   if(window.NasieAndroid)return window.NasieAndroid.guard(this,changed);
   this.writeAllowed=false;this.guardMessage='در حال آماده‌سازی ذخیره‌سازی امن';let acquiring=false,release=null,generation=0;
   const relinquish=()=>{generation++;this.writeAllowed=false;this.guardMessage='ثبت فعلاً متوقف است؛ پنجره فعال کنترل ثبت را می‌گیرد';if(release){release();release=null}changed()};
   const acquire=()=>{if(document.visibilityState==='hidden'||acquiring||release)return;
    if(!navigator.locks){this.guardMessage='برای ثبت امن، برنامه را با مرورگر به‌روز روی HTTPS باز کن؛ این پنجره فقط برای مشاهده است.';changed();return}
    acquiring=true;const token=generation;
    navigator.locks.request('nasie-ledger-writer',{ifAvailable:true},async lock=>{acquiring=false;
     if(token!==generation){if(document.visibilityState!=='hidden')setTimeout(acquire,0);return}if(document.visibilityState==='hidden')return;
     if(!lock){this.guardMessage='برنامه در پنجره دیگری باز است؛ آن را ببند و «فعال‌کردن ثبت» را بزن.';changed();return}
     const held=new Promise(resolve=>release=resolve);this.load();this.writeAllowed=true;this.guardMessage='';this.checkpoint();changed();await held;
    }).catch(()=>{acquiring=false;this.writeAllowed=false;this.guardMessage='قفل ذخیره‌سازی آماده نشد؛ برنامه را دوباره باز کن';changed()})};
   this.acquireWriter=acquire;this.releaseWriter=relinquish;
   document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')relinquish();else acquire()});
   window.addEventListener('pagehide',relinquish);window.addEventListener('pageshow',acquire);
   window.addEventListener('storage',e=>{if(e.key==='nasie'){this.load();changed();if(typeof toast==='function')toast('حساب‌ها در پنجره دیگری تغییر کردند؛ اطلاعات تازه شد')}});
   acquire();
  }
 });
 for(const [k,fn] of Object.entries(original))Store[k]=function(...args){return this.batch(()=>{
  if(k==='addTransaction'){const o=args[0];if(!this.d.customers.some(c=>c.id===o.customerId)||!['credit','payment','adjustment'].includes(o.type||'credit')||!Number.isSafeInteger(o.amount)||((o.type||'credit')!=='adjustment'&&o.amount<=0))fail('مشتری، نوع یا مبلغ تراکنش معتبر نیست')}
  return fn.apply(this,args)
 })};
})();
