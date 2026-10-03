// تحلیل دستور فارسی: مبلغ + مشتری + نوع عملیات. خروجی شامل confidence و raw برای کنترل صوتی است.
const NW={صفر:0,یک:1,یه:1,دو:2,سه:3,چهار:4,پنج:5,شش:6,هفت:7,هشت:8,نه:9,ده:10,یازده:11,دوازده:12,سیزده:13,چهارده:14,پونزده:15,پانزده:15,شانزده:16,هفده:17,هجده:18,نوزده:19,بیست:20,سی:30,چهل:40,پنجاه:50,شصت:60,هفتاد:70,هشتاد:80,نود:90,صد:100,یکصد:100,دویست:200,سیصد:300,چهارصد:400,چارصد:400,پانصد:500,پونصد:500,هشصد:800,چار:4,شونزده:16,هیجده:18,ششصد:600,هفتصد:700,هشتصد:800,نهصد:900};
const MUL={هزار:1e3,میلیون:1e6,میلیارد:1e9};
const PAY=/(پرداخت|پرداختی|داد|تسویه|واریز|نقد|کسر|کم کن|پس داد)/;
const NOISE2=new Set(['و','بزن','بزنش','به','حساب','رو','روی','را','از','اضافه','کن','ثبت','نسیه','بدهی','تومان','تومن','تومنی','ریال','مبلغ','چقدر','چقدره','چنده','چند','مانده','مهمان','کاسب','مشتری','جدید','امروز','موقت','این','برای','بنویس','کرد','بذار','آقای','خانم','آقا','اقا','شد','تمام','تموم']);
const norm=s=>String(s||'').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/‌/g,' ').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,٬،.؟!?]/g,' ').replace(/\s+/g,' ').trim();
function lev(a,b){const d=Array.from({length:a.length+1},(_,i)=>[i]);for(let j=1;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length]}
const sim=(a,b)=>1-lev(a,b)/Math.max(a.length,b.length,1);
function parseAmt(tk){let tot=0,cur=0,mul=0,any=false;const used=new Set();
 tk.forEach((t,i)=>{if(/^\d+(\.\d+)?$/.test(t)){cur+=+t;used.add(i);any=true}
  else if(t in NW){cur+=NW[t];used.add(i);any=true}
  else if(t in MUL){tot+=(cur||1)*MUL[t];cur=0;mul=MUL[t];used.add(i);any=true}
  else if(t==='نیم'){if(mul)tot+=mul/2;else cur+=.5;used.add(i)}});
 return{amt:tot+cur,used,any}}
const NAVW={داشبورد:'dash',مشتریان:'list',تغییرات:'log',روزانه:'log',تنظیمات:'set',سطل:'trash',زباله:'trash',بکاپ:'backup',پشتیبان:'backup'};
function cands(name){const q=norm(name).split(' ').filter(Boolean),j=q.join(' ');if(!q.length)return[];
 return Store.d.customers.map(c=>{let s=0;for(const nm of[c.name,c.alias].filter(Boolean)){const f=norm(nm),nt=f.split(' ');
  let v=f===j?1:q.every(t=>nt.includes(t))?.92:q.every(t=>nt.some(x=>sim(t,x)>=.8))?.85:sim(j,f)*.8;
  if(f.replace(/ /g,'').includes(q.join('')))v=Math.max(v,.9);s=Math.max(s,v)}return{c,s}}).filter(x=>x.s>=.7).sort((a,b)=>b.s-a.s).slice(0,5)}
function parseCmd(raw){
 const t=norm(raw).replace(/(هزار|میلیون|میلیارد)(تومان|تومن)/g,'$1 $2'),tk=t.split(' ').filter(Boolean);
 const{amt,used}=parseAmt(tk),has=amt>0;
 if(!has&&/(برو|باز کن|نشون بده|نمایش|ببر)/.test(t))for(const k in NAVW)if(t.includes(k))return{intent:'nav',to:NAVW[k],raw:t,confidence:.99};
 if(!has&&/(آخرین|اخرین).*(پاک|حذف)|برگردون/.test(t))return{intent:'undo',raw:t,confidence:.98};
 if(!has&&/امروز.*(چقدر|چند|جمع)/.test(t))return{intent:'today',raw:t,confidence:.98};
 if(!has&&/(جمع|کل).*(بدهی|نسیه)/.test(t))return{intent:'total',raw:t,confidence:.98};
 const guest=/(مهمان|کاسب)/.test(t),pay=PAY.test(t);
 const name=tk.filter((x,i)=>!used.has(i)&&!NOISE2.has(x)&&!PAY.test(x)).join(' ');
 if(!has&&/(مشتری جدید|ثبت مشتری|مهمان جدید)/.test(t))return{intent:'newc',name,guest,raw:t,confidence:.97};
 if(!has)return{intent:'ask',name,cands:cands(name),raw:t,confidence:name?.8:.3};
 const cs=cands(name),best=cs[0]?.s||0;
 return{intent:'tx',amt,pay,name,guest,cands:cs,raw:t,confidence:Math.min(1,(amt?0.5:0)+(name?(best||.45)*.5:0))}}
