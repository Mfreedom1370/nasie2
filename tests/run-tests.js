// اجرا:  node tests/run-tests.js   (Store, Ledger, Parser و Migration را بدون مرورگر تست می‌کند)
const fs=require('fs'),path=require('path'),R=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const body=`
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('  ✗',m))};const eq=(a,b,m)=>ok(a===b,m+' (گرفت '+a+' ، انتظار '+b+')');
const D=(y,m,d)=>new Date(y,m-1,d,12).getTime(),mem={};
const reset=()=>{for(const k in mem)delete mem[k];Store.d={customers:[],tx:[],trash:[],log:[],voiceLog:[],schema:2,set:{...DEF},alerts:{}}};
// ---- ۴) Migration داده‌ی قدیمی ----
reset();const legacy={customers:[{id:'a',name:'علی',days:10},{id:'b',name:'رضا'}],tx:[{id:'t1',cid:'a',amt:5000000,note:'خرید',ts:D(2026,9,1)},{id:'t2',cid:'a',amt:-500000,note:'',ts:D(2026,9,10)},{id:'oldt9',cid:'b',amt:70000,note:'مانده‌ی انتقالی از برنامه‌ی قبلی',ts:D(2026,8,1)}],
 trash:[{id:'x',k:'tx',data:{id:'t3',cid:'a',amt:1000,note:'',ts:D(2026,9,2)},ts:1,label:'z'}],log:[{ts:1,t:'tx',n:'علی',a:5}],set:{token:'T',days:30},alerts:{}};
const raw=JSON.stringify(legacy);mem.nasie=raw;Store.load();
eq(Store.d.tx.length,3,'تعداد تراکنش بعد از migration');eq(Store.d.tx[0].type,'credit','نوع credit');eq(Store.d.tx[1].type,'payment','نوع payment');eq(Store.d.tx[1].amount,500000,'amount همیشه مثبت');
eq(Store.d.tx[0].dueDate,D(2026,9,1)+10*DAY,'سررسید بدهی قدیمی = تاریخ + مهلت مشتری');eq(Store.d.tx[2].source,'import','منبع import');eq(Store.d.tx[0].cid,'a','فیلد آینه‌ی cid');eq(Store.d.tx[1].amt,-500000,'آینه‌ی amt');
eq(Store.d.trash[0].data.type,'credit','تراکنش داخل سطل هم migrate شد');eq(mem.nasie_pre_v2_backup,raw,'بکاپ داخلی عیناً برابر داده‌ی قبل');eq(Store.d.set.token,'T','تنظیمات حفظ شد');eq(Store.d.log.length,1,'لاگ حفظ شد');eq(Store.bal('a'),4500000,'مانده‌ی علی');
Store.load();eq(Store.d.tx.length,3,'اجرای دوباره‌ی load تکراری نمی‌سازد');
// ---- ۵) ثبت credit / payment کامل و جزئی ----
reset();Store.addC('علی');const c1=Store.d.customers[0].id;Store.d.customers[0].id='A';
const T0=D(2026,9,23);// ۱ مهر ۱۴۰۵
Store.addTransaction({customerId:'A',type:'credit',amount:5000000,date:T0,dueDate:T0+14*DAY,source:'manual'});
let a=Ledger.analyze('A',T0+19*DAY);eq(a.remaining,5000000,'بدهی ثبت شد');eq(a.overdue.length,1,'۱۹ روز بعد: سررسید (۱۴ روزه) گذشته');eq(a.overdueDays,5,'۵ روز دیرکرد');
Store.addTransaction({customerId:'A',type:'payment',amount:500000,date:T0+9*DAY,source:'manual'});
a=Ledger.analyze('A',T0+19*DAY);// مثال سند: ۱ مهر بدهی، ۱۰ مهر پرداخت، ۲۰ مهر امروز
eq(a.daysSinceLastPayment,10,'daysSinceLastPayment');eq(a.daysSinceOldestDebt,19,'daysSinceOldestDebt');eq(a.remaining,4500000,'مانده');eq(a.oldestUnpaidDebt.date,T0,'قدیمی‌ترین بدهی همان ۱ مهر است');eq(a.oldestUnpaidDebt.dueDate,T0+14*DAY,'سررسید با پرداخت جزئی عوض نشد');eq(a.overdueDays,5,'دیرکرد بعد از پرداخت جزئی همان ۵ روز');
Store.addTransaction({customerId:'A',type:'payment',amount:4500000,date:T0+12*DAY,source:'manual'});
a=Ledger.analyze('A',T0+19*DAY);eq(a.remaining,0,'پرداخت کامل');eq(a.status,'clear','وضعیت clear');eq(a.oldestUnpaidDebt,null,'بدون بدهی باز');eq(Store.bal('A'),0,'bal صفر');
// ---- ۸،۹،۱۰) چند بدهی و FIFO ----
reset();Store.d.customers.push({id:'B',name:'رضا'});
Store.addTransaction({customerId:'B',type:'credit',amount:1000000,date:T0,dueDate:T0+10*DAY});
Store.addTransaction({customerId:'B',type:'credit',amount:500000,date:T0+5*DAY,dueDate:T0+30*DAY});
Store.addTransaction({customerId:'B',type:'payment',amount:300000,date:T0+6*DAY});
a=Ledger.analyze('B',T0+20*DAY);eq(a.debts[0].remaining,700000,'FIFO: بدهی #۱ باقی‌مانده ۷۰۰ هزار');eq(a.debts[1].remaining,500000,'بدهی #۲ دست‌نخورده');eq(a.oldestUnpaidDebt.id,a.debts[0].id,'oldestUnpaidDebt = بدهی #۱');
eq(a.debts[0].state,'overdue','#۱ سررسید گذشته');eq(a.debts[0].overdueDays,10,'#۱ ده روز دیرکرد');eq(a.debts[1].state,'notdue','#۲ هنوز سررسید نشده');eq(a.debts[1].daysLeft,10,'#۲ ده روز مانده');eq(a.status,'overdue','وضعیت کلی overdue');
Store.addTransaction({customerId:'B',type:'payment',amount:800000,date:T0+7*DAY});
a=Ledger.analyze('B',T0+20*DAY);eq(a.debts[0].remaining,0,'#۱ کاملاً تسویه');eq(a.debts[1].remaining,400000,'#۲ ۱۰۰ هزار از آن کم شد');eq(a.oldestUnpaidDebt.id,a.debts[1].id,'قدیمی‌ترین باز حالا #۲');eq(a.overdue.length,0,'دیگر دیرکردی نیست');
a=Ledger.analyze('B',T0+30*DAY);eq(a.todayDue,true,'امروز سررسید #۲');eq(a.status,'today','وضعیت today');
a=Ledger.analyze('B',T0+8*DAY);eq(a.daysSinceOldestDebt,3,'سن = از تاریخ قدیمی‌ترین بدهی باز (#۲ پنج روز بعد از #۱)');eq(a.oldestUnpaidDebt.remaining,400000,'مانده‌ی #۲ تا آن روز');
Store.addTransaction({customerId:'B',type:'payment',amount:900000,date:T0+31*DAY});a=Ledger.analyze('B',T0+40*DAY);eq(a.prepaid,500000,'پرداخت اضافه = بستانکار');eq(a.balance,-500000,'balance منفی');
Store.addTransaction({customerId:'B',type:'adjustment',amount:200000,date:T0+41*DAY});Store.addTransaction({customerId:'B',type:'adjustment',amount:-50000,date:T0+41*DAY});eq(Store.bal('B'),-350000,'تعدیل مثبت/منفی در مانده');
const bt=Store.addTransaction({customerId:'B',type:'credit',amount:1,date:T0+42*DAY});const b0=Store.bal('B');Store.cancelTx(bt.id);eq(Store.bal('B'),b0-1,'تراکنش cancelled محاسبه نمی‌شود');eq(Store.d.tx.some(t=>t.id===bt.id),true,'cancelled حذف فیزیکی نشد');
// ---- ۱۳،۱۴) Parser ----
reset();for(const n of['علی رضایی','محمد نصرتی','محمد نصرتی','سهیلی کیا'])Store.addC(n);Store.d.customers.push({id:'g',name:'عینکی',alias:'آقای عینکی',guest:true});
const P=s=>parseCmd(s,{source:'voice',stt:.9});
let p=P('پنجاه هزار تومان بزن به حساب سهیلی کیا');eq(p.type,'credit','credit');eq(p.amount,50000,'مبلغ');eq(p.customerName,'سهیلی کیا','نام');eq(p.source,'voice','source');ok(p.confidence>=.9&&!p.needsConfirmation,'اطمینان بالا: '+p.confidence);eq(p.rawText,'پنجاه هزار تومان بزن به حساب سهیلی کیا','rawText حفظ شد');
p=P('صد هزار تومن از حساب سهیلی کیا کم کن');eq(p.type,'payment','payment با «کم کن»');eq(p.amount,100000,'صد هزار تومن');eq(p.customerName,'سهیلی کیا','نام بدون «کم»');
p=P('سهیلی کیا دو میلیون و نیم داد');eq(p.type,'payment','«داد»');eq(p.amount,2500000,'دو میلیون و نیم');
p=P('یه میلیون بزن حساب سهیلی کیا');eq(p.amount,1000000,'یه میلیون');p=P('دویست و پنجاه هزار تومان به حساب سهیلی کیا');eq(p.amount,250000,'دویست و پنجاه هزار');
p=P('۲۵۰ هزار تومان بزن به حساب سهیلی کیا');eq(p.amount,250000,'اعداد فارسی');
p=P('صد تومن بزن به حساب سهیلی کیا');eq(p.amount,100000,'صد تومن = ۱۰۰ هزار');eq(p.colloquial,true,'colloquial');eq(p.needsConfirmation,true,'تومن محاوره‌ای تایید می‌خواهد');
p=P('پنجاه هزار تومان بزن به حساب محمد نصرتی');eq(p.customerId,null,'نام تکراری: حدس نمی‌زند');eq(p.ambiguous,true,'ambiguous');eq(p.needsConfirmation,true,'نیاز به تایید');ok(p.confidence<.9,'confidence پایین '+p.confidence);eq(p.candidates.length,2,'هر دو کاندید');
p=P('پنجاه هزار تومان بزن به حساب فلانی ناشناس');eq(p.customerId,null,'مشتری ناشناس');eq(p.needsConfirmation,true,'تایید لازم');
p=P('پنجاه هزار تومان');eq(p.needsConfirmation,true,'بدون نام: تایید لازم');
p=P('چهارصد هزار تومان بزن به حساب آقای عینکی');eq(p.customerId,'g','اسم مستعار');
p=P('پنجاه هزار تومان بزن به حساب سهیلی کیا سررسید ده روز');eq(p.dueDays,10,'سررسید ده روز');eq(p.amount,50000,'عدد سررسید جزو مبلغ نشد');
p=P('سه هزار تومنی بزن به حساب سهیلی کیا');eq(p.amount,3000,'سه هزار تومنی');
p=P('بیست و پنج میلیون بزن به حساب سهیلی کیا');eq(p.needsConfirmation,true,'مبلغ بزرگ تایید می‌خواهد');
p=P('پنجاه هزار تومان سهیلی کیا');eq(p.typeKnown,false,'نوع نامشخص');eq(p.needsConfirmation,true,'نوع نامشخص تایید می‌خواهد');
p=P('مانده حساب سهیلی کیا چقدره');eq(p.intent,'ask','پرسش مانده');p=P('برو به تغییرات روزانه');eq(p.intent,'nav','ناوبری');p=P('آخرین ثبت رو پاک کن');eq(p.intent,'undo','undo');
// ---- ۱۶) حذف/سطل زباله داده را از بین نمی‌برد ----
reset();Store.d.customers.push({id:'Z',name:'ز'});const zt=Store.addTransaction({customerId:'Z',type:'credit',amount:10,date:T0});Store.delTx(zt.id);eq(Store.d.trash.length,1,'به سطل زباله رفت');eq(Store.restore(Store.d.trash[0].id),true,'بازیابی');eq(Store.bal('Z'),10,'مانده برگشت');
// ---- ریسک مشتری ----
reset();Store.d.customers.push({id:'R1',name:'خوش‌حساب'},{id:'R2',name:'بدحساب'},{id:'R3',name:'صفر'});
Store.addTransaction({customerId:'R1',type:'credit',amount:1000000,date:Date.now()-5*DAY,dueDate:Date.now()+25*DAY});
Store.addTransaction({customerId:'R2',type:'credit',amount:6000000,date:Date.now()-120*DAY,dueDate:Date.now()-90*DAY});
Store.addTransaction({customerId:'R3',type:'credit',amount:100,date:Date.now()-10*DAY});Store.addTransaction({customerId:'R3',type:'payment',amount:100,date:Date.now()-5*DAY});
eq(Ledger.risk('R1').level,'low','بدهی عادی = کم‌ریسک');eq(Ledger.risk('R2').level,'high','دیرکرد طولانی + بالای حد = پرریسک');ok(Ledger.risk('R2').score>Ledger.risk('R1').score,'امتیاز بدحساب بیشتر');eq(Ledger.risk('R3').score,0,'بدون بدهی = امتیاز صفر');ok(Ledger.risk('R2').reasons.length>=2,'دلیل‌ها توضیح داده می‌شوند');
console.log(fail?('❌ '+fail+' تست ناموفق، '+pass+' موفق'):('✅ همه‌ی '+pass+' تست موفق'));process.exitCode=fail?1:0;
`;
const mem={};const ls={getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=v}};
// mem داخل تست هم دیده می‌شود
new Function('localStorage','mem','document',R('js/store.js')+R('js/parser.js')+R('js/ledger.js')+body.replace('const D=(y,m,d)=>new Date(y,m-1,d,12).getTime(),mem={};','const D=(y,m,d)=>new Date(y,m-1,d,12).getTime();'))(ls,mem,{});
