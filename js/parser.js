// nasie-release:16
// خط لوله‌ی صدا:  Audio → STT → متن خام → Normalizer → Shop Dictionary → Parser → Command ساختاری → تایید کاربر → Transaction
// Parser هرگز مستقیم تراکنش نمی‌سازد؛ فقط Command (با confidence و needsConfirmation) برمی‌گرداند.
const NW={صفر:0,یک:1,یه:1,دو:2,سه:3,چهار:4,چار:4,پنج:5,شش:6,هفت:7,هشت:8,نه:9,ده:10,یازده:11,دوازده:12,سیزده:13,چهارده:14,پونزده:15,پانزده:15,شانزده:16,شونزده:16,هفده:17,هجده:18,هیجده:18,نوزده:19,بیست:20,سی:30,چهل:40,پنجاه:50,شصت:60,هفتاد:70,هشتاد:80,نود:90,صد:100,یکصد:100,دویست:200,سیصد:300,چهارصد:400,چارصد:400,پانصد:500,پونصد:500,ششصد:600,هفتصد:700,هشتصد:800,هشصد:800,نهصد:900};
const MUL={هزار:1e3,میلیون:1e6,میلیارد:1e9};
// فرهنگ لغت مغازه: واژه‌های محاوره‌ای، افعال ثبت نسیه/پرداخت و کلمات بی‌اثر. برای آموزش لحجه‌ی خودت اینجا اضافه کن.
const SHOP_DICT={
 tokens:{تومنی:'تومان',تومن:'تومان',تومنه:'تومان',دوتا:'دو تا',سهتا:'سه تا'},
 pay:[['پرداخت','شده'],['تسویه','شده'],['واریز','شده'],['داده'],['دادم'],['پرداختم'],['گرفتم'],['واریزی'],['دریافت'],['تسویه','حساب'],['پول','داد'],['پول','داده'],['از','حساب','کم'],['کم','کن'],['کسر','کن'],['کسر'],['پرداخت','کرد'],['پرداخت'],['پرداخته'],['تسویه','کرد'],['تسویه'],['واریز','کرد'],['واریز'],['پس','داد'],['نقد'],['داد'],['دادن']],
 credit:[['بزن','به','حساب'],['بزن','رو','حساب'],['بزن','روی','حساب'],['بزن','توی','حساب'],['بزنش','حساب'],['بزن','حساب'],['به','حساب'],['اضافه','کن'],['ثبت','کن'],['نسیه'],['بدهکار'],['بنویس'],['بزن']],
 noise:new Set(['و','بزن','بزنش','به','حساب','رو','روی','را','از','اضافه','کن','ثبت','نسیه','بدهی','تومان','ریال','مبلغ','این','برای','بنویس','کرد','بذار','آقای','خانم','آقا','اقا','چقدر','چقدره','چنده','چند','مانده','مهمان','کاسب','مشتری','جدید','امروز','موقت','تا','عدد','دیگه','دیگر','بعد','کم','هم','لطفا','لطفاً','شده','کرده','کردم','کنید','بده','بدهکارش','طلب','بدهکارم','بستانکار','هست','است','داره','دارد','بدهکار','حسابش','برا','واسه','براش']),
 dueWords:{روز:1,هفته:7,ماه:30}};
const NAVW={داشبورد:'dash',مشتریان:'list',تغییرات:'log',روزانه:'log',دستیار:'ai',تنظیمات:'set',سطل:'trash',زباله:'trash',بکاپ:'backup',پشتیبان:'backup'};
const norm=s=>s.replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u064B-\u065F\u0640]/g,'').replace(/\u200c/g,' ').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/(\d)[,٬،](?=\d{3}(?:\D|$))/g,'$1').replace(/(\d)٫(?=\d)/g,'$1.').replace(/\.(?!\d)|(?<!\d)\.|[,٬،؟!?؛:]/g,' ').replace(/\s+/g,' ').trim();
function lev(a,b){const d=Array.from({length:a.length+1},(_,i)=>[i]);for(let j=1;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length]}
const sim=(a,b)=>1-lev(a,b)/Math.max(a.length,b.length,1);
// مرحله‌ی Normalizer + Dictionary: متن خام → توکن‌های استاندارد
function normalizeText(raw){const t=norm(String(raw||'')).replace(/(\d)(هزار|میلیون|میلیارد)/g,'$1 $2').replace(/(هزار|میلیون|میلیارد)(تومان|تومن)/g,'$1 $2');
 return t.split(' ').filter(Boolean).flatMap(w=>(SHOP_DICT.tokens[w]||w).split(' '))}
function parseAmt(tk){let tot=0,cur=0,mul=0,any=false,hasMul=false;const used=new Set();
 tk.forEach((t,i)=>{
  if(/^\d+(\.\d+)?$/.test(t)){cur+=+t;used.add(i);any=true}
  else if(t in NW){cur+=NW[t];used.add(i);any=true}
  else if(t in MUL){const next=MUL[t];if(mul&&next>mul)tot=(tot+cur)*next;else tot+=(cur||1)*next;cur=0;mul=next;hasMul=true;used.add(i);any=true}
  else if(t==='نیم'){if(mul)tot+=mul/2;else cur+=.5;used.add(i);any=true}});
 return{amt:Math.round(tot+cur),used,any,hasMul}}
function takePhrase(tk,used,phrases){for(const p of phrases)for(let i=0;i+p.length<=tk.length;i++)
 if(p.every((w,k)=>tk[i+k]===w&&!used.has(i+k))){p.forEach((_,k)=>used.add(i+k));return p.join(' ')}return null}
function cands(name){const q=norm(name).split(' ').filter(Boolean),j=q.join(' ');if(!q.length)return[];
 return Store.d.customers.map(c=>{let s=0;for(const nm of[c.name,c.alias].filter(Boolean)){const f=norm(nm),nt=f.split(' ');
  let v=f===j?1:q.every(t=>nt.includes(t))?.92:q.every(t=>nt.some(x=>sim(t,x)>=.8))?.85:sim(j,f)*.8;
  if(f.replace(/ /g,'').includes(q.join('')))v=Math.max(v,.9);s=Math.max(s,v)}return{c,s}}).filter(x=>x.s>=.7).sort((a,b)=>b.s-a.s).slice(0,5)
  .map(x=>({id:x.c.id,name:x.c.name,alias:x.c.alias||'',score:x.s}))}
function customerSuggestions(raw,phonetic=false){
 const parsed=parseCmd(String(raw||'')),query=parsed.name||'';
 if(!['ask','tx'].includes(parsed.intent)||!query.trim())return [];
 const key=s=>norm(String(s||'')).replace(/[آأإ]/g,'ا').replace(/ؤ/g,'و').replace(/ئ/g,'ی').toLowerCase();
 const sound=s=>phonetic?s.replace(/[ثص]/g,'س').replace(/[ذضظ]/g,'ز').replace(/ط/g,'ت'):s;
 const q=key(query),qt=q.split(' ').filter(Boolean),compact=q.replace(/ /g,'');
 return Store.d.customers.map(c=>{
  let score=0;
  for(const label of [c.name,c.alias].filter(Boolean)){
   const name=key(label),nt=name.split(' '),nc=name.replace(/ /g,'');
   let value=name===q?1:nc===compact?.99:nc.includes(compact)?.94:0;
   if(compact.length>=2){
    const tokenScore=qt.reduce((sum,t)=>sum+Math.max(0,...nt.map(n=>n.startsWith(t)?.96:Math.max(sim(t,n),sim(sound(t),sound(n))*.94))),0)/qt.length;
    value=Math.max(value,tokenScore*.88,sim(sound(compact),sound(nc))*.82);
   }
   score=Math.max(score,value);
  }
  return {id:c.id,name:c.name,alias:c.alias||'',score};
 }).filter(c=>c.score>=.54).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'fa')).slice(0,6);
}
function parseCmd(raw,o={}){
 const base={rawText:raw,source:o.source||'manual'};let tk=normalizeText(raw),dueDays=null;
 // سررسید گفته‌شده: «سررسید ده روز» / «مهلت دو هفته»
 const di=tk.findIndex(w=>w==='سررسید'||w==='مهلت');
 if(di>=0){let j=di+1;while(j<tk.length&&!(tk[j] in SHOP_DICT.dueWords))j++;
  if(j<tk.length){const p=parseAmt(tk.slice(di+1,j));if(p.amt>0){dueDays=p.amt*SHOP_DICT.dueWords[tk[j]];let e=j+1;if(['دیگه','دیگر','بعد'].includes(tk[e]))e++;tk=[...tk.slice(0,di),...tk.slice(e)]}}}
 const t=tk.join(' '),pa=parseAmt(tk),has=pa.amt>0,used=pa.used;
 if(!has&&/(برو|باز کن|نشون بده|نمایش|ببر)/.test(t))for(const k in NAVW)if(t.includes(k))return{...base,intent:'nav',to:NAVW[k]};
 if(!has&&/(آخرین|اخرین).*(پاک|حذف)|برگردون/.test(t))return{...base,intent:'undo'};
 if(!has&&/امروز.*(چقدر|چند|جمع)/.test(t))return{...base,intent:'today'};
 if(!has&&/(جمع|کل).*(بدهی|نسیه)/.test(t))return{...base,intent:'total'};
 const payHit=takePhrase(tk,used,SHOP_DICT.pay),credHit=takePhrase(tk,used,SHOP_DICT.credit),typeKnown=!!(payHit||credHit),type=payHit?'payment':'credit';
 const guest=/(مهمان|کاسب)/.test(t),name=tk.filter((x,i)=>!used.has(i)&&!SHOP_DICT.noise.has(x)).join(' ');
 if(!has&&/(مشتری جدید|ثبت مشتری|مهمان جدید)/.test(t))return{...base,intent:'newc',name,guest};
 const cs=cands(name);
 if(!has)return{...base,intent:'ask',name,candidates:cs};
 // ---- ساخت Command ----
 const top=cs[0],second=cs[1],ambiguous=!!(second&&top.score-second.score<.06),sure=!!(top&&top.score>=.92&&!ambiguous),
  rial=tk.includes('ریال'),colloquial=!rial&&!pa.hasMul&&pa.amt<1000,amount=rial?pa.amt/10:colloquial?pa.amt*1000:pa.amt,reasons=[];
 if(!top)reasons.push(name?'مشتری با این نام پیدا نشد':'نام مشتری گفته نشد');else if(ambiguous)reasons.push('چند مشتری با این نام وجود دارد');else if(!sure)reasons.push('نام مشتری با اطمینان کافی تشخیص داده نشد');
 if(payHit&&credHit)reasons.push('هم پرداخت و هم نسیه گفته شده؛ نوع را بررسی کن');
 if(rial)reasons.push('مبلغ ریالی به تومان تبدیل شد');
 if(!Number.isSafeInteger(amount)||amount<=0)reasons.push('مبلغ معتبر و صحیح به تومان لازم است');
 if(!typeKnown)reasons.push('معلوم نیست نسیه است یا پرداخت');
 if(colloquial)reasons.push('مبلغ کمتر از هزار تومان بود؛ «تومن» به‌معنی هزار تومان فرض شد');
 if(amount>=2e7)reasons.push('مبلغ بزرگ است');
 let conf=.3+.5*(top?top.score:name?.35:0)+.1*(typeKnown?1:0)+.1*(o.stt>0?o.stt:.8);
 if(ambiguous)conf-=.2;if(colloquial)conf-=.08;if(!name)conf-=.2;conf=Math.max(0,Math.min(1,conf));
 return{...base,intent:'tx',type,customerId:sure?top.id:null,customerName:sure?top.name:(name||null),amount,amountRaw:pa.amt,colloquial,items:[],
  dueDays,dueDate:dueDays?Date.now()+dueDays*DAY:null,normalizedText:t,confidence:+conf.toFixed(2),needsConfirmation:!sure||!typeKnown||colloquial||conf<.9||amount>=2e7||!!(payHit&&credHit)||rial||!Number.isSafeInteger(amount),
  reasons,ambiguous,typeKnown,guest,name,candidates:cs}}
