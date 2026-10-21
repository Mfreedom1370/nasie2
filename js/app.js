// nasie-release:21
Store.load();
// Cover every action surface, including customer cards and radio/checkbox labels.
const buttonAnimations=new WeakMap();
let pressEcho=null,pressEchoAnimation=null;
function showPressEcho(rect,reduced){
 if(!rect.width||!rect.height)return;
 if(!pressEcho){pressEcho=document.createElement('span');pressEcho.className='press-echo';pressEcho.setAttribute('aria-hidden','true');document.body.appendChild(pressEcho)}
 pressEchoAnimation?.cancel();pressEcho.hidden=false;
 Object.assign(pressEcho.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
 const animation=pressEcho.animate(reduced?[{opacity:.7},{opacity:0}]:[{opacity:.7,transform:'scale(.97)'},{opacity:0,transform:'scale(1.02)'}],{duration:240,easing:'ease-out'});
 pressEchoAnimation=animation;
 animation.onfinish=()=>{if(pressEchoAnimation===animation){pressEcho.hidden=true;pressEchoAnimation=null}};
}
function buttonFeedback(event){
 if(event.type==='pointerdown'&&(event.button!==0||event.isPrimary===false))return;
 const button=event.target?.closest?.('button,[role="button"],[onclick],label.opt,.seg label,summary,a[href]');
 if(!button||button.matches(':disabled,[aria-disabled="true"]')||button.querySelector('input:disabled')||typeof button.animate!=='function')return;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 buttonAnimations.get(button)?.cancel();
 const frames=reduced?[{filter:'brightness(1.35)'},{filter:'brightness(1)'}]:
  [{transform:'scale(.96)',filter:'brightness(1.35)'},{transform:'scale(1)',filter:'brightness(1)'}];
 const animation=button.animate(frames,{duration:reduced?120:240,easing:'ease-out'});
 buttonAnimations.set(button,animation);
 animation.onfinish=()=>{if(buttonAnimations.get(button)===animation)buttonAnimations.delete(button)};
 // Keep a brief visual acknowledgement when an action immediately rebuilds its sheet.
 if(event.type==='click'){
  const rect=button.getBoundingClientRect(),sheetAtPress=document.querySelector('#sheet .sh');
  queueMicrotask(()=>{if(!button.isConnected||document.querySelector('#sheet .sh')!==sheetAtPress)showPressEcho(rect,reduced)});
 }
}
document.addEventListener('pointerdown',buttonFeedback,true);
document.addEventListener('click',buttonFeedback,true);
function storageError(e){const error=e.error||e.reason;if(!error?.storeError)return;e.preventDefault();render();toast(error.message);clearTimeout(toast.h);toast.h=setTimeout(()=>$('#toast').hidden=true,10000)}
addEventListener('error',storageError);addEventListener('unhandledrejection',storageError);

const $=s=>document.querySelector(s),esc=s=>{const d=document.createElement('div');d.textContent=s??'';return d.innerHTML.replace(/"/g,'&quot;').replace(/'/g,'&#39;')};
const fmt=n=>Math.abs(Math.round(n)).toLocaleString('fa-IR'),dt=ts=>new Date(ts).toLocaleDateString('fa-IR'),tm=ts=>new Date(ts).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'});
const lim=c=>c.limit||Store.d.set.limit,dys=c=>c.days||Store.d.set.days,find=id=>Store.d.customers.find(x=>x.id===id);
let tab='dash',pending=null,qv='',ld=new Date().setHours(0,0,0,0);
const an=c=>Ledger.analyze(c.id),age=c=>an(c).daysSinceOldestDebt||0;
const TYPE={credit:'نسیه',payment:'پرداخت',adjustment:'تعدیل'},SRC={manual:'✍️ دستی',voice:'🎤 صوتی',barcode:'📦 بارکد',import:'📥 انتقالی'};
function dueLbl(c){const a=an(c);if(a.overdueDays>0)return[`${fmt(a.overdueDays)} روز دیرکرد`,'warn'];if(a.todayDue)return['امروز سررسید','warn'];if(a.nextDue)return[`سررسید ${fmt(a.nextDue.daysLeft)} روز دیگر`,''];return['','']}
const dsLbl=d=>d.state==='overdue'?`${fmt(d.overdueDays)} روز دیرکرد`:d.state==='today'?'امروز سررسید':d.state==='notdue'?`${fmt(d.daysLeft)} روز تا سررسید`:'بدون سررسید';
const st=(c,b)=>b<=0?'ok':b>lim(c)?'bad':an(c).overdue.length?'warn':'';
const sumTx=(id,f)=>Store.live().filter(t=>t.cid===id&&f(t)).reduce((a,t)=>a+Math.abs(t.amt),0);
const LT={'c+':e=>`➕ مشتری جدید: ${e.n}`,'c~':e=>`✏️ ویرایش پروفایل: ${e.n}`,'c-':e=>`🗑 حذف مشتری: ${e.n}`,tx:e=>`${e.a>0?'🔴 نسیه':'🟢 پرداخت'} ${fmt(e.a)} — ${e.n}`,'tx-':e=>`🗑 حذف ثبت ${fmt(e.a)} — ${e.n}`,rs:e=>`♻️ بازیابی: ${e.n}`};
const logText=e=>(LT[e.t]||(()=>e.t))(e);
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,3000)}
function sheet(h){hideCmdSuggestions();if(cmd)cmd.open=false;$('#sheet').innerHTML=`<div class="sh"><div class="xrow"><button class="x" onclick="dismiss()" aria-label="بستن">✕</button></div><div class="box">${h}</div></div>`;$('#sheet').hidden=false}
function dismiss(){if(cmd&&cmd.open)cancelCmd();else closeSheet()}
function closeSheet(){if(cmd)cmd.open=false;LL=null;$('#sheet').hidden=true;render()}
let counterFrame=null,counterGeneration=0;
function anim(){if(counterFrame!==null)cancelAnimationFrame(counterFrame);counterFrame=null;const generation=++counterGeneration;
 const counters=Array.from(document.querySelectorAll('[data-n]'),el=>({el,value:Number(el.dataset.n)||0})),start=performance.now();
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const frame=now=>{if(generation!==counterGeneration)return;counterFrame=null;
  const p=reduced||document.visibilityState==='hidden'?1:Math.max(0,Math.min(1,(now-start)/800));
  for(const {el,value} of counters){if(el.isConnected===false)continue;el.classList.toggle('lg',value>=1e7);el.textContent=fmt(value*(1-(1-p)**3));}
  if(p<1&&counters.some(x=>x.el.isConnected!==false))counterFrame=requestAnimationFrame(frame);
 };frame(start);
 document.querySelectorAll('main>*').forEach((el,i)=>el.style.setProperty('--i',Math.min(i,12)));document.querySelectorAll('main .kpis').forEach(k=>[...k.children].forEach((el,j)=>el.style.setProperty('--j',j)))}
function render(){document.body.dataset.tab=tab;
 const storageMessage=Store.blocked||(!Store.writeAllowed?(Store.guardMessage||'ثبت فعلاً متوقف است'):Store.backupWarning);
 $('#storage-status').innerHTML=storageMessage?`<div class="bk">${esc(storageMessage)} <button onclick="tab='set';render()">بکاپ و بازیابی</button>${!Store.writeAllowed&&Store.acquireWriter?'<button onclick="Store.acquireWriter()">فعال‌کردن ثبت</button>':''}</div>`:'';
$('#total').innerHTML=`<span class="tl">جمع بدهی‌ها</span><b data-n="${Store.total()}"></b><span class="tl">تومان</span>`;
 document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));
 $('#view').innerHTML=({dash:vDash,list:vList,log:vLog,ai:vAI,set:vSet})[tab]();document.body.classList.toggle('ai',tab==='ai');anim()}
// ---------- داشبورد ----------
function months(){const out=[],today=J.today();
 for(let i=5;i>=0;i--){let y=today[0],m=today[1]-i;while(m<1){m+=12;y--}
  const s=J.ts([y,m,1],0),e=J.ts(m===12?[y+1,1,1]:[y,m+1,1],0),t=Store.live().filter(x=>x.ts>=s&&x.ts<e&&x.source!=='import');
  out.push({l:new Date(s).toLocaleDateString('fa-IR',{month:'short'}),d:t.filter(x=>x.amt>0).reduce((a,x)=>a+x.amt,0),p:-t.filter(x=>x.amt<0).reduce((a,x)=>a+x.amt,0),net:Store.live().filter(x=>x.ts<e).reduce((a,x)=>a+x.amt,0)})}return out}
function uiIcon(name){
 const paths={home:'M3 10l9-7 9 7v10H3z M9 20v-7h6v7',people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4',chart:'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',spark:'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',settings:'M4 7h16 M4 17h16 M8 4v6 M16 14v6',clock:'M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',arrow:'M7 17L17 7 M7 7h10v10',wallet:'M3 6h18v14H3z M3 6V3h15v3 M16 11h5v5h-5z'};
 return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[name]||paths.chart)+'"/></svg>';
}
function vDash(){
 const cs=Store.d.customers.map(c=>({c,b:Store.bal(c.id)})),db=cs.filter(x=>x.b>0),over=db.filter(x=>x.b>lim(x.c));
 const late=db.filter(x=>!x.c.guest&&an(x.c).overdue.length).sort((a,b)=>an(b.c).overdueDays-an(a.c).overdueDays);
 const gs=cs.filter(x=>x.c.guest).sort((a,b)=>b.b-a.b||a.c.name.localeCompare(b.c.name,'fa')),ms=months(),cur=ms[5],top=[...db].sort((a,b)=>b.b-a.b).slice(0,5),mx=top[0]?.b||1;
 const bk=new Date().getHours()>=Store.d.set.bkHour&&Store.d.set.lastBk!==new Date().toDateString();
 const maximum=Math.max(...ms.flatMap(x=>[x.d,x.p]),1);
 const bars=ms.map((x,i)=>`<rect x="${i*48+8}" y="${95-x.d/maximum*80}" width="16" height="${x.d/maximum*80}" rx="4" fill="var(--bad)"/><rect x="${i*48+26}" y="${95-x.p/maximum*80}" width="16" height="${x.p/maximum*80}" rx="4" fill="var(--ok)"/><text x="${i*48+24}" y="114" text-anchor="middle" font-size="10" fill="var(--mut)">${x.l}</text>`).join('');
 const metric=(label,value,target,icon,tone='')=>`<button class="metric ${tone}" onclick="listBy('${target}')"><span>${uiIcon(icon)}${label}</span><b>${fmt(value)}</b><small>${target==='debtors'?'مشتری':'تومان'}</small></button>`;
 return `<div class="dashboard-layout">
 <section class="dash-story"><span class="eyebrow">${uiIcon('wallet')} دفتر حساب‌های مغازه</span>
 <h2>حساب‌ها روشن،<br>خیالت آسوده.</h2><p>نمای امروزِ نسیه‌ها و دریافتی‌ها؛ همهٔ عددها از حساب‌های ثبت‌شدهٔ خودت.</p>
 <div class="hero-balance"><small>جمع بدهی‌ها</small><b data-n="${Store.total()}">${fmt(Store.total())}</b><span>تومان</span></div>
 <section class="temporary-customers glass-panel"><div class="panel-heading"><h3>مشتری‌های موقت</h3><small>${fmt(gs.length)} مشتری</small></div><div class="temporary-list">${gs.map(x=>`<button onclick="profile('${x.c.id}')"><span>${esc(x.c.name)}<small>${x.b>0?(dueLbl(x.c)[0]||'حساب باز'):x.b<0?'بستانکار':'تسویه‌شده'}</small></span><b class="${st(x.c,x.b)}">${x.b<0?'−':''}${fmt(x.b)}<small>تومان</small></b></button>`).join('')||'<small>مشتری موقتی ثبت نشده.</small>'}</div></section>
 <button class="story-action" onclick="tab='list';render()">مشاهدهٔ مشتریان ${uiIcon('arrow')}</button></section>
 <section class="forecast-panel glass-panel"><div class="panel-heading"><div><small>شش ماه اخیر</small><h3>روند ماندهٔ حساب‌ها</h3></div>${uiIcon('chart')}</div>${trend(ms)}<small>ماندهٔ پایان هر ماه · تومان</small></section>
 <aside class="dash-rail"><div class="glass-panel today-card"><small>${new Date().toLocaleDateString('fa-IR',{weekday:'long',day:'numeric',month:'long'})}</small><h3>نمای حساب‌ها</h3>
 <div class="rail-total"><b>${fmt(db.length)}</b><span>مشتری بدهکار</span></div><div class="rail-stats"><button onclick="listBy('late')"><b>${fmt(late.length)}</b><small>عقب‌افتاده</small></button><button onclick="listBy('over')"><b>${fmt(over.length)}</b><small>بالای حد مجاز</small></button></div></div>
 ${metric('نسیهٔ این ماه',cur.d,'mDebt','wallet','bad')}${metric('دریافتی این ماه',cur.p,'mPay','arrow','ok')}
 <button class="backup-card" onclick="backup()">${uiIcon('clock')}<span>${bk?'بکاپ امروز را بگیر':'بکاپ کامل حساب‌ها'}<small>ذخیرهٔ فایل JSON</small></span>${uiIcon('arrow')}</button></aside>
 <div class="dash-details"><section class="box2 glass-panel"><div class="panel-heading"><h3>نسیه و دریافتی ماهانه</h3>${uiIcon('chart')}</div><svg class="sv" viewBox="0 0 290 126" role="img" aria-label="نسیه و دریافتی شش ماه اخیر">${bars}</svg><div class="lg"><span><i style="background:var(--bad)"></i>نسیه</span><span><i style="background:var(--ok)"></i>دریافتی</span></div></section>
 <section class="box2 glass-panel"><h3>بیشترین بدهکاران</h3>${top.map(x=>`<button class="debt-row" onclick="profile('${x.c.id}')"><span>${esc(x.c.name)}</span><b>${fmt(x.b)}</b><i style="--progress:${x.b/mx*100}%"></i></button>`).join('')||'<p class="empty">هنوز بدهکاری ثبت نشده.</p>'}</section>
 ${riskBox()}<section class="box2 glass-panel"><h3>عقب‌افتاده‌ها</h3>${late.slice(0,6).map(x=>`<div class="lr" onclick="profile('${x.c.id}')"><span>${esc(x.c.name)}<small>${dueLbl(x.c)[0]}</small></span><b class="warn">${fmt(x.b)}</b></div>`).join('')||'<small>حساب عقب‌افتاده‌ای نیست.</small>'}</section>
 </div></div>`;
}
let LL=null;
function riskSet(){return Store.d.customers.filter(c=>Store.bal(c.id)>0||c.prevLoan||Store.live().some(t=>t.customerId===c.id)).map(c=>({c,b:Store.bal(c.id),r:Ledger.risk(c.id)}))}
function riskBox(){const all=riskSet(),n=l=>all.filter(x=>x.r.level===l).length,H=n('high'),M=n('mid'),L=n('low'),T=H+M+L||1;
 return`<div class="box2"><h3>⚖️ ریسک مشتریان</h3><div class="rb"><i style="width:${H/T*100}%;background:var(--bad)"></i><i style="width:${M/T*100}%;background:var(--warn)"></i><i style="width:${L/T*100}%;background:var(--ok)"></i></div>
 <div class="kpis" style="margin:10px 0 6px"><div class="k-bad" onclick="listBy('risk-high')"><small>پرریسک</small><b data-n="${H}"></b></div><div class="k-warn" onclick="listBy('risk-mid')"><small>متوسط</small><b data-n="${M}"></b></div><div class="k-ok" onclick="listBy('risk-low')"><small>کم‌ریسک</small><b data-n="${L}"></b></div></div>
 <small>امتیاز ریسک (۰ تا ۱۰۰) از دیرکرد، نسبت مانده به حد مجاز و سابقه‌ی پرداخت حساب می‌شود.</small></div>`}
const RL={high:'پرریسک',mid:'ریسک متوسط',low:'کم‌ریسک'};
function listBy(k){LL=k;
 if(k.startsWith('risk-')){const lv=k.slice(5),L=riskSet().filter(x=>x.r.level===lv).sort((a,b)=>b.r.score-a.r.score||b.b-a.b);
  return sheet(`<h2>${RL[lv]} <small>(${fmt(L.length)} نفر)</small></h2>${L.slice(0,150).map(x=>`<div class="card" onclick="profile('${x.c.id}')"><div><b>${esc(x.c.name)}</b> <span class="tag rk-${lv}">${fmt(x.r.score)}</span><small>${esc(x.r.reasons.join(' · '))}</small></div><div class="amt ${st(x.c,x.b)}">${fmt(x.b)}<small>تومان</small></div></div>`).join('')||'<p class="empty">موردی نیست</p>'}`)}
const cs=Store.d.customers.map(c=>({c,b:Store.bal(c.id)})),db=cs.filter(x=>x.b>0),ms=J.ts([J.today()[0],J.today()[1],1],0);
 if(k==='mDebt'||k==='mPay'){const T=Store.live().filter(t=>t.ts>=ms&&(k==='mDebt'?t.amt>0:t.amt<0)&&t.source!=='import').sort((a,b)=>b.ts-a.ts);
  return sheet(`<h2>${k==='mDebt'?'نسیه‌های این ماه':'دریافتی‌های این ماه'} <small>(${fmt(T.length)} مورد)</small></h2>${T.map(t=>`<div class="card" onclick="profile('${t.cid}')"><div><b>${esc(Store.nm(t.cid))}</b><small>${dt(t.ts)} ${esc(t.note)}</small></div><div class="amt ${t.amt<0?'ok':'bad'}">${fmt(t.amt)}<small>تومان</small></div></div>`).join('')||'<p class="empty">موردی نیست</p>'}<div class="row"><button onclick="closeSheet()">بستن</button></div>`)}
 const m={debtors:['بدهکاران',db.sort((a,b)=>b.b-a.b)],late:['عقب‌افتاده‌ها (سررسید گذشته)',db.filter(x=>!x.c.guest&&an(x.c).overdue.length).sort((a,b)=>an(b.c).overdueDays-an(a.c).overdueDays)],over:['بالای حد مجاز',db.filter(x=>x.b>lim(x.c)).sort((a,b)=>b.b-a.b)]},[t,L]=m[k];
 sheet(`<h2>${t} <small>(${fmt(L.length)} نفر)</small></h2>${L.map(x=>`<div class="card" onclick="profile('${x.c.id}')"><div><b>${esc(x.c.name)}</b>${x.c.guest?' <span class="tag gt">مهمان</span>':''}<small>${dueLbl(x.c)[0]||fmt(age(x.c))+' روز از قدیمی‌ترین بدهی'}${x.c.alias?' · «'+esc(x.c.alias)+'»':''}</small></div><div class="amt ${st(x.c,x.b)}">${fmt(x.b)}<small>تومان</small></div></div>`).join('')||'<p class="empty">موردی نیست</p>'}<div class="row"><button onclick="closeSheet()">بستن</button></div>`)}
function trend(ms){
 const values=ms.map(p=>p.net),lo=Math.min(0,...values),hi=Math.max(1,...values),span=hi-lo||1;
 const pts=ms.map((p,i)=>[24+i*68,145-(p.net-lo)/span*112]);
 const path=pts.reduce((d,p,i)=>i?d+' C'+(pts[i-1][0]+34)+','+pts[i-1][1]+' '+(p[0]-34)+','+p[1]+' '+p.join(','):'M'+p.join(','),'');
 return `<svg class="wave-chart" viewBox="0 0 388 200" role="img" aria-label="روند مانده کل در شش ماه اخیر"><defs><linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e7f7ff" stop-opacity=".32"/><stop offset="1" stop-color="#e7f7ff" stop-opacity="0"/></linearGradient></defs><path class="wave-area" d="${path} L364,164 L24,164Z" fill="url(#balance-fill)"/><path class="wave-line" pathLength="1" d="${path}" fill="none" stroke="currentColor" stroke-width="2.4"/>${pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="currentColor"/><text x="${p[0]}" y="185" text-anchor="middle" fill="currentColor" font-size="11">${esc(ms[i].l)}</text>`).join('')}</svg>`;
}
// ---------- مشتریان ----------
function vList(){return`<div class="srow"><input class="sr" placeholder="جستجوی نام یا اسم مستعار…" value="${esc(qv)}" oninput="qv=this.value;$('#lst').innerHTML=rows()"><button class="pri addb" onclick="editForm(null)">＋ مشتری</button></div><div id="lst">${rows()}</div>`}
function rows(){const q=norm(qv),cs=Store.d.customers.filter(c=>norm(c.name+' '+(c.alias||'')).includes(q)).map(c=>({c,b:Store.bal(c.id)})).sort((a,b)=>b.b-a.b).slice(0,150);
 if(!cs.length)return'<p class="empty">مشتری‌ای پیدا نشد.</p>';
 return cs.map(({c,b})=>`<div class="card" onclick="profile('${c.id}')"><div><b>${esc(c.name)}</b>${c.guest?' <span class="tag gt">مهمان</span>':''}<small>${c.alias?'«'+esc(c.alias)+'» · ':''}${c.phone?esc(c.phone):''}</small></div><div class="amt ${st(c,b)}">${fmt(b)}<small>تومان${b<0?' (بستانکار)':''}</small></div></div>`).join('')}
function moneyInputValue(value){
 const text=String(value).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,٬،]/g,'');
 return /^-?\d*$/.test(text)?text.replace(/\B(?=(\d{3})+(?!\d))/g,','):String(value);
}
function formatMoneyInput(input){
 const before=input.value,caret=input.selectionStart,next=moneyInputValue(before);
 if(next===before)return;
 const offset=caret==null?null:before.slice(0,caret).replace(/[,٬،]/g,'').length;
 input.value=next;
 if(offset!==null){let pos=0,count=0;while(pos<next.length&&count<offset){if(next[pos]!==',')count++;pos++}input.setSelectionRange?.(pos,pos)}
}
function profile(id){const c=find(id),b=Store.bal(id);if(!c)return;const a=an(c),[dl,dc]=dueLbl(c),od=a.oldestUnpaidDebt;
 sheet(`<div class="ph customer-header"><div class="av">${esc(c.name[0]||'؟')}</div><div class="customer-identity"><h2>${esc(c.name)}</h2><small>${c.alias?'«'+esc(c.alias)+'» · ':''}${c.guest?'مشتری موقت · ':''}${c.phone?`<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>`:'بدون شماره'}</small></div><div class="amt header-balance ${st(c,b)}"><b>${fmt(b)}</b><small>تومان${b<0?' (بستانکار)':''}</small></div></div>
 <div class="kpis"><div><small>کل نسیه</small><b>${fmt(sumTx(id,t=>t.amt>0)+(c.prevLoan||0))}</b></div><div><small>کل پرداخت</small><b>${fmt(sumTx(id,t=>t.amt<0)+(c.prevPay||0))}</b></div>
 <div><small>روز از آخرین پرداخت</small><b>${a.daysSinceLastPayment==null?'—':fmt(a.daysSinceLastPayment)}</b></div><div><small>روز از قدیمی‌ترین بدهی</small><b>${a.daysSinceOldestDebt==null?'—':fmt(a.daysSinceOldestDebt)}</b></div></div>
 ${(()=>{const k=Ledger.risk(id);return`<p class="note rk-${k.level}">ریسک: ${RL[k.level]} (${fmt(k.score)} از ۱۰۰) — ${esc(k.reasons.join(' · '))}</p>`})()}
 ${dl?`<p class="note ${dc}">${dl}${od?' · قدیمی‌ترین بدهی باز: '+dt(od.date)+' (مانده '+fmt(od.remaining)+')':''}</p>`:''}
 <small>حد بدهی: ${fmt(lim(c))} · مهلت پیش‌فرض: ${fmt(dys(c))} روز</small>${c.note?`<p class="note">${esc(c.note)}</p>`:''}
 ${a.open.length?`<label>بدهی‌های باز (پرداخت‌ها به‌ترتیب قدیمی‌ترین تسویه می‌شوند)</label>${[...a.open].reverse().sort((a,b)=>b.date-a.date||b.tx.createdAt-a.tx.createdAt).map(d=>`<div class="tx"><span>${dt(d.date)} · سررسید ${d.dueDate?dt(d.dueDate):'—'}<small class="${d.state==='overdue'||d.state==='today'?'warn':''}">${dsLbl(d)}</small></span><b>${fmt(d.remaining)} <small>از ${fmt(d.amount)}</small></b></div>`).join('')}`:''}
 <label>ثبت دستی</label><div class="row"><input id="ma" type="text" inputmode="numeric" oninput="formatMoneyInput(this)" placeholder="مبلغ (تومان)"><input id="mn" placeholder="توضیح"></div>
 <div class="row"><input id="md" type="number" inputmode="numeric" placeholder="مهلت (روز) — خالی = ${fmt(dys(c))}"></div>
 <div class="row"><button class="pri" onclick="manual('${id}',1)">+ نسیه</button><button onclick="manual('${id}',-1)">− پرداخت</button></div>
 <label>تاریخچه</label>${Store.live().filter(t=>t.customerId===id).reverse().sort((a,b)=>b.date-a.date||b.createdAt-a.createdAt).map(t=>`<div class="tx"><span>${dt(t.date)} ${TYPE[t.type]} <small>${SRC[t.source]||''}${t.source==='voice'&&t.meta&&t.meta.confirmed?' · تایید شد ✔':''} ${esc(t.description)}</small></span><b class="${t.amt<0?'ok':''}">${t.amt<0?'−':'+'}${fmt(t.amt)}</b><button onclick="delTx('${t.id}','${id}')">🗑</button></div>`).join('')||'<small>هنوز ثبتی نیست</small>'}
 <div class="row">${LL?'<button onclick="listBy(LL)">◀ بازگشت به لیست</button>':''}<button onclick="editForm('${id}')">ویرایش پروفایل</button><button onclick="closeSheet()">بستن</button></div>`)}
function manual(id,sg){const a=Number(norm($('#ma').value));if(!Number.isSafeInteger(a)||a<=0)return toast('مبلغ صحیح و بیشتر از صفر وارد کن');
 const due=$('#md').value.trim(),dd=Number(due);if(due&&(!Number.isSafeInteger(dd)||dd<=0))return toast('مهلت باید تعداد روز صحیح و مثبت باشد');const now=Date.now();
 Store.addTransaction({customerId:id,type:sg>0?'credit':'payment',amount:a,date:now,dueDate:sg>0?now+(dd||dys(find(id)))*DAY:null,description:$('#mn').value,source:'manual'});alertLimit(find(id),sg);profile(id)}
function alertLimit(c,sg){const b=Store.bal(c.id);if(sg>0&&b>lim(c))tg(`⚠️ بدهی ${c.name} به ${fmt(b)} تومان رسید (حد: ${fmt(lim(c))})`)}
function editForm(id,pre){const c=id?find(id):(pre||{});
 sheet(`${id?`<div class="customer-header"><h2>${esc(c.name)}</h2><small>ویرایش پروفایل مشتری</small></div>`:'<h2>مشتری جدید</h2>'}<label>نام</label><input id="en" value="${esc(c.name||'')}"><label>اسم مستعار (برای کسانی که نمی‌شناسی، مثلاً «آقای عینکی»)</label><input id="ea" value="${esc(c.alias||'')}">
 <label>شماره تماس</label><input id="ep" type="tel" value="${esc(c.phone||'')}"><label>یادداشت / آدرس</label><textarea id="eo" rows="2">${esc(c.note||'')}</textarea>
 <label>حد بدهی (تومان) — خالی = پیش‌فرض</label><input id="el" type="number" value="${c.limit||''}"><label>مهلت پرداخت (روز) — خالی = پیش‌فرض</label><input id="ed" type="number" value="${c.days||''}">
 <label class="opt"><input type="checkbox" id="eg" ${c.guest?'checked':''}> مشتری موقت (مهمان) — در ستون ویژه‌ی داشبورد دیده می‌شود</label>
 <div class="row"><button class="pri" onclick="saveC(${id?`'${id}'`:'null'})">ذخیره</button><button onclick="${id?`profile('${id}')`:'closeSheet()'}">انصراف</button></div>
 ${id?`<div class="row"><button class="dng" onclick="delC('${id}')">انتقال به سطل زباله</button></div>`:''}`)}
function saveC(id){const n=$('#en').value.trim(),a=$('#ea').value.trim();if(!n&&!a)return toast('نام یا اسم مستعار را وارد کن');
 const f={name:n||a,alias:a,phone:$('#ep').value.trim(),note:$('#eo').value.trim(),limit:+$('#el').value||0,days:+$('#ed').value||0,guest:$('#eg').checked};
 let c;if(id){c=find(id);Object.assign(c,f);Store.log('c~',c.name);Store.save()}else c=Store.addC(f.name,f);profile(c.id)}
function delC(id){if(!confirm('مشتری با تمام ثبت‌هایش به سطل زباله برود؟'))return;Store.delC(id);closeSheet()}
function delTx(tid,id){Store.delTx(tid);toast('به سطل زباله رفت');profile(id)}
// ---------- تغییرات روزانه ----------
let logMonth=null,logPage=0,logFrame=null;
const LOG_PAGE_SIZE=100,JM=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
function localDay(ts){const d=new Date(ts);return d.setHours(0,0,0,0)}
function followingDay(ts){const d=new Date(ts);d.setDate(d.getDate()+1);return d.setHours(0,0,0,0)}
function logJalali(ts=ld){const d=new Date(ts);return J.g2j(d.getFullYear(),d.getMonth()+1,d.getDate())}
function queueLogRender(){if(logFrame!==null)return;logFrame=requestAnimationFrame(()=>{logFrame=null;if(tab==='log')$('#view').innerHTML=vLog()})}
function selectLogDay(ts){const value=localDay(ts);if(!Number.isFinite(value))return toast('تاریخ معتبر نیست');
 const y=logJalali(value)[0];if(y<1200||y>1600)return toast('سال باید بین ۱۲۰۰ و ۱۶۰۰ باشد');
 ld=value;logMonth=null;logPage=0;queueLogRender()}
function shiftLogDay(step){const d=new Date(ld);d.setDate(d.getDate()+step);selectLogDay(d.getTime())}
function changeLogMonth(year,month){const num=s=>Number(String(s).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
 const y=num(year),m=num(month);if(!Number.isInteger(y)||y<1200||y>1600||!Number.isInteger(m)||m<1||m>12){toast('سال یا ماه معتبر نیست');queueLogRender();return}
 logMonth=[y,m];queueLogRender()}
function shiftLogMonth(step){let [y,m]=logMonth||logJalali().slice(0,2);m+=step;if(m<1){m=12;y--}if(m>12){m=1;y++}changeLogMonth(y,m)}
function pageLog(step){logPage=Math.max(0,logPage+step);queueLogRender()}
function logCalendar(){const [y,m]=logMonth||logJalali().slice(0,2),start=J.ts([y,m,1],0),end=J.ts(m===12?[y+1,1,1]:[y,m+1,1],0);
 const days=Math.round((end-start)/864e5),offset=(new Date(start).getDay()+1)%7,today=localDay(Date.now());
 const cells=Array.from({length:offset},()=>'<span aria-hidden="true"></span>');
 for(let day=1;day<=days;day++){const ts=J.ts([y,m,day],0);cells.push(`<button type="button" class="${ts===ld?'selected ':''}${ts===today?'today':''}" aria-label="${J.fa([y,m,day])}" aria-pressed="${ts===ld}" onclick="selectLogDay(${ts})">${fmt(day)}</button>`)}
 return`<section class="log-calendar box2" aria-label="تقویم شمسی"><div class="calendar-heading"><b>تقویم شمسی</b><small>برای دیدن تغییرات، روز را انتخاب کن</small></div>
 <div class="calendar-controls"><button onclick="shiftLogMonth(-1)" aria-label="ماه قبل">‹</button><select id="log-calendar-month" aria-label="ماه" onchange="changeLogMonth($('#log-calendar-year').value,this.value)">${JM.map((name,i)=>`<option value="${i+1}" ${i+1===m?'selected':''}>${name}</option>`).join('')}</select><input id="log-calendar-year" inputmode="numeric" aria-label="سال شمسی" value="${y}" onchange="changeLogMonth(this.value,$('#log-calendar-month').value)"><button onclick="shiftLogMonth(1)" aria-label="ماه بعد">›</button></div>
 <div class="calendar-grid calendar-weekdays">${['ش','ی','د','س','چ','پ','ج'].map(x=>`<span>${x}</span>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div></section>`}
function vLog(){const end=followingDay(ld),L=Store.d.log.filter(x=>x.ts>=ld&&x.ts<end).sort((a,b)=>b.ts-a.ts),s=f=>L.filter(f).reduce((a,x)=>a+Math.abs(x.a),0);
 const pages=Math.max(1,Math.ceil(L.length/LOG_PAGE_SIZE));logPage=Math.min(logPage,pages-1);const rows=L.slice(logPage*LOG_PAGE_SIZE,(logPage+1)*LOG_PAGE_SIZE);
 return`${logCalendar()}<div class="row log-day-controls"><button onclick="shiftLogDay(-1)">◀ روز قبل</button><button onclick="selectLogDay(Date.now())">امروز</button><button onclick="shiftLogDay(1)">روز بعد ▶</button></div>
 <h3 class="dayh">${new Date(ld).toLocaleDateString('fa-IR',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</h3>
 <div class="kpis"><div><small>تعداد تغییرات</small><b>${fmt(L.length)}</b></div><div class="k-bad"><small>نسیه‌ی روز</small><b>${fmt(s(x=>x.t==='tx'&&x.a>0))}</b></div><div class="k-ok"><small>دریافتی روز</small><b>${fmt(s(x=>x.t==='tx'&&x.a<0))}</b></div></div>
 <div class="box2 log-entries">${rows.map(e=>`<div class="lgr"><time>${tm(e.ts)}</time><span>${esc(logText(e))}</span></div>`).join('')||'<small>در این روز تغییری ثبت نشده</small>'}</div>${pages>1?`<div class="row log-pagination"><button onclick="pageLog(-1)" ${logPage===0?'disabled':''}>قبلی</button><small>صفحهٔ ${fmt(logPage+1)} از ${fmt(pages)}</small><button onclick="pageLog(1)" ${logPage===pages-1?'disabled':''}>بعدی</button></div>`:''}`}
// ---------- سطل زباله ----------
function trashView(){const T=[...Store.d.trash].sort((a,b)=>b.ts-a.ts);
 sheet(`<h2>🗑 سطل زباله</h2><small>هر چیزی که حذف کنی اول اینجا می‌آید و قابل بازیابی است.</small>
 ${T.map(i=>`<div class="tx"><span>${i.k==='c'?'👤':'🧾'} ${esc(i.label)}<small>${dt(i.ts)}</small></span><span><button onclick="restoreT('${i.id}')">♻️</button> <button onclick="purgeT('${i.id}')">✕</button></span></div>`).join('')||'<p class="empty">سطل زباله خالی است</p>'}
 <div class="row">${T.length?'<button class="dng" onclick="if(confirm(\'همه برای همیشه پاک شوند؟\')){Store.d.trash=[];Store.save();trashView()}">خالی کردن</button>':''}<button onclick="closeSheet()">بستن</button></div>`)}
function restoreT(id){toast(Store.restore(id)?'بازیابی شد':'مشتری این ثبت در دسترس نیست؛ اول مشتری را بازیابی کن');trashView()}
function purgeT(id){if(confirm('برای همیشه پاک شود؟')){Store.purge(id);trashView()}}
// ---------- تنظیمات و بکاپ ----------
function requestOfflineVoice(){if(window.NasieAndroid?.downloadOfflineModel)return window.NasieAndroid.downloadOfflineModel();toast('دانلود مدل از نسخهٔ APK انجام می‌شود؛ در مرورگر از تنظیمات گفتار گوشی استفاده کن')}
function vSet(){const s=Store.d.set;
 return`<section class="box2"><h3>دستیار صوتی فارسی</h3><small>با اینترنت، سرویس آنلاین گوشی استفاده می‌شود؛ بدون اینترنت، مدل آفلاین گوشی امتحان می‌شود. در حالت آنلاین ممکن است صدا برای پردازش ارسال شود.</small><div class="row"><button onclick="requestOfflineVoice()">بررسی / دانلود مدل فارسی</button></div><small id="offline-model-status">${esc(window.NasieAndroid?.lastModelStatus||'دانلود مدل به پشتیبانی سرویس گوشی بستگی دارد.')}</small><details><summary>راهنمای پوکو F5 / اندروید ۱۵</summary><p>با اینترنت مدل را بررسی کن. اگر سرویس فارسی را ارائه نکند، نصب مدل از داخل این برنامه ممکن نیست. Google و Speech Recognition &amp; Synthesis را از فروشگاه به‌روز کن؛ در تنظیمات گوشی، «تایپ صوتی Google» یا «تشخیص گفتار آفلاین» را جست‌وجو کن. اگر فارسی در فهرست زبان‌های قابل دانلود هست، دریافتش کن. افزودن صفحه‌کلید فارسی به‌تنهایی مدل صوتی آفلاین نصب نمی‌کند.</p></details></section><label>توکن ربات تلگرام</label><input value="${esc(s.token)}" onchange="setv('token',this.value)" dir="ltr"><label>Chat ID</label><input value="${esc(s.chat)}" onchange="setv('chat',this.value)" dir="ltr">
 <label>حد بدهی پیش‌فرض (تومان)</label><input type="number" value="${s.limit}" onchange="setv('limit',+this.value)"><label>مهلت پیش‌فرض پرداخت (روز)</label><input type="number" value="${s.days}" onchange="setv('days',+this.value)">
 <label>دستیار هوشمند — سرویس</label><select class="sr" onchange="aiPreset(this.value)">${[['openai','OpenAI (ChatGPT) — پولی'],['gemini','Google Gemini — دارای سطح رایگان'],['openrouter','OpenRouter — مدل‌های رایگان :free'],['custom','سفارشی']].map(([v,l])=>`<option value="${v}" ${(AIP[v]||[])[0]===s.aiUrl?'selected':''}>${l}</option>`).join('')}</select><label>آدرس سرویس (سازگار با OpenAI)</label><input value="${esc(s.aiUrl)}" onchange="setv('aiUrl',this.value)" dir="ltr"><label>کلید API</label><input type="password" value="${esc(s.aiKey)}" onchange="setv('aiKey',this.value)" dir="ltr"><label>نام مدل</label><input value="${esc(s.aiModel)}" onchange="setv('aiModel',this.value)" dir="ltr">
 <label class="opt"><input type="checkbox" ${s.aiAnon?'checked':''} onchange="setv('aiAnon',this.checked)"> نام مشتری‌ها به کد تبدیل شود (پیشنهادی؛ سرویس‌های رایگان ممکن است داده را برای بهبود محصول استفاده کنند)</label><small>خلاصه‌ی حساب‌ها برای سرویس انتخابی ارسال می‌شود.</small><label>ساعت یادآور بکاپ روزانه (۰ تا ۲۳)</label><input type="number" min="0" max="23" value="${s.bkHour}" onchange="setv('bkHour',+this.value)">
 <div class="row"><button class="pri" onclick="backup()">📦 بکاپ کامل JSON</button><button onclick="tg('✅ پیام آزمایشی دفتر نسیه').then(o=>toast(o?'ارسال شد':'ارسال نشد؛ توکن/Chat ID را بررسی کن'))">تست تلگرام</button></div>
 <small>آخرین درخواست دانلود بکاپ: ${s.lastBk||'—'}. بعد از دانلود، وجود فایل را در گوشی بررسی کن. JSON برای بازیابی کامل است؛ اکسل گزارش حساب‌هاست.</small>
 <label>حفاظت از اطلاعات</label><small>نسخه محلی روزانه تا ۳ روز دارای نسخه نگه داشته می‌شود. این نسخه‌ها با پاک‌کردن داده‌های سایت از بین می‌روند؛ JSON را بیرون از گوشی هم نگه دار.</small>
 <div class="row"><button onclick="persistStorage()">درخواست ذخیره‌سازی ماندگار</button>${Store.recoveryText('previous')?'<button onclick="recoverLocal(\'previous\')">بازیابی آخرین وضعیت سالم</button>':''}${Store.recoveryText('before')?'<button onclick="recoverLocal(\'before\')">برگشت به قبل از بازیابی</button>':''}</div>
 ${Store.localBackups().map((b,i)=>`<div class="row"><span>${dt(b.ts)} ${tm(b.ts)}</span><button onclick="downloadLocal(${i})">دانلود JSON</button><button onclick="recoverLocal('${i}')">بازیابی</button></div>`).join('')}

 ${Store.hasInternalBackup()?'<div class="row"><button onclick="if(confirm(\'داده‌ها به قبل از ارتقای ساختار برگردد؟ تغییرات بعد از ارتقا از بین می‌رود.\')&&Store.restoreInternalBackup())location.reload()">↩︎ بازگردانی بکاپ داخلی قبل از ارتقا</button></div>':''}<div class="row"><button onclick="Store.exportJson()">خروجی JSON</button><button onclick="$('#imp').click()">بازیابی JSON</button><button onclick="excelBackup()">گزارش اکسل</button><button onclick="trashView()">🗑 سطل زباله</button></div>
 <input type="file" id="imp" accept=".json" hidden onchange="importBackup(this)">`}
async function importBackup(input){const file=input.files?.[0];input.value='';if(!file)return;
 try{const data=Store.prepare(await file.text());if(!confirm(`بازیابی ${data.customers.length} مشتری و ${data.tx.length} تراکنش، حساب‌های فعلی را جایگزین می‌کند. نسخه برگشت نیز نگه داشته می‌شود. ادامه؟`))return;
 Store.replacePrepared(data);render();toast('بازیابی و ذخیره کامل شد')}catch(e){toast(e.storeError?e.message:'فایل قابل خواندن نیست؛ بازیابی انجام نشد')}}
function recoverLocal(kind){try{const raw=Store.recoveryText(kind);if(!raw)return toast('نسخه موجود نیست');const data=Store.prepare(raw);
 if(!confirm(`این نسخه شامل ${data.customers.length} مشتری و ${data.tx.length} تراکنش است. جایگزین حساب‌های فعلی شود؟`))return;
 Store.replacePrepared(data);render();toast('بازیابی کامل شد')}catch(e){toast(e.message)}}
function downloadLocal(index){const b=Store.localBackups()[index];if(b)Store.download(b.raw,'nasie-local-'+b.ts+'.json')}
async function persistStorage(){const ok=await Store.requestPersistence();toast(ok?'ذخیره‌سازی ماندگار فعال شد؛ بکاپ خارج از گوشی همچنان لازم است':'مرورگر دسترسی ماندگار نداد؛ بکاپ خارج از گوشی نگه دار')}
function setv(k,v){Store.d.set[k]=v;Store.save()}
const loadX=()=>window.XLSX?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src='js/vendor/xlsx.full.min.js';s.onload=ok;s.onerror=()=>{s.remove();const f=document.createElement('script');f.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';f.onload=ok;f.onerror=no;document.head.appendChild(f)};document.head.appendChild(s)});
async function excelBackup(){try{await loadX()}catch(e){return toast('برای ساخت اکسل یک‌بار اتصال اینترنت لازم است')}
 const D=Store.d,U=XLSX.utils,wb=U.book_new(),add=(r,n)=>U.book_append_sheet(wb,U.json_to_sheet(r),n);
 add(D.customers.map(c=>({نام:c.name,'اسم مستعار':c.alias||'',تلفن:c.phone||'',نوع:c.guest?'مهمان':'مشتری',مانده:Store.bal(c.id)})),'مشتریان');
 add(D.tx.map(t=>({تاریخ:dt(t.date),مشتری:Store.nm(t.customerId),مبلغ:t.amt,نوع:TYPE[t.type],سررسید:t.dueDate?dt(t.dueDate):'',منبع:t.source,وضعیت:t.status,توضیح:t.description})),'ثبت‌ها');
 add(D.log.map(e=>({زمان:dt(e.ts)+' '+tm(e.ts),شرح:logText(e)})),'تغییرات');
 const name=`nasie-${new Date().toISOString().slice(0,10)}.xlsx`,blob=new Blob([XLSX.write(wb,{type:'array',bookType:'xlsx'})],{type:'application/octet-stream'}),a=document.createElement('a');
 if(window.NasieAndroid)await window.NasieAndroid.exportBlob(blob,name);else{const downloadUrl=URL.createObjectURL(blob);a.href=downloadUrl;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(downloadUrl),60000)}
 const s=D.set;if(s.token&&s.chat){const f=new FormData();f.append('chat_id',s.chat);f.append('document',blob,name);
  try{const r=await fetch(`https://api.telegram.org/bot${s.token}/sendDocument`,{method:'POST',body:f});toast(r.ok?'گزارش به تلگرام ارسال شد؛ دانلود گوشی را هم بررسی کن':'دانلود گزارش درخواست شد؛ ارسال تلگرام ناموفق بود')}catch(e){toast('دانلود گزارش درخواست شد؛ تلگرام در دسترس نیست')}}else toast('دانلود گزارش اکسل درخواست شد؛ وجود فایل را بررسی کن');render()}
// ---------- دستیار هوشمند (سازگار با OpenAI) ----------
let chat=[];
async function backup(){try{Store.exportJson();if(!window.NasieAndroid&&Store.writeAllowed&&!Store.blocked)setv('lastBk',new Date().toDateString());toast(window.NasieAndroid?'محل ذخیرهٔ JSON را انتخاب کن؛ منتظر پیام ذخیرهٔ فایل بمان':'دانلود JSON درخواست شد؛ وجود فایل را بررسی کن');render()}catch(e){toast(e.message)}}
function vAI(){const s=Store.d.set;if(!s.aiKey)return'<p class="empty">برای فعال شدن، در «تنظیمات» کلید API را وارد کن.</p>';
 return`<div id="chat">${chat.map(m=>`<div class="msg ${m.r}">${esc(m.c)}</div>`).join('')||'<p class="empty">از دستیار درباره‌ی بدهی‌ها، دیرکردها و روند حساب‌ها بپرس.</p>'}</div>
 <div class="aibar"><input id="aq" placeholder="مثلا: کدام بدهکارها پرریسک‌ترند؟" onkeydown="if(event.key==='Enter')askAI()"><button class="pri" onclick="askAI()">بپرس</button></div>`}
const codeOf=c=>Store.d.set.aiAnon?'C'+(Store.d.customers.indexOf(c)+1):c.name+(c.alias?' ('+c.alias+')':'');
function anonText(t){let o=t;[...Store.d.customers].sort((a,b)=>b.name.length-a.name.length).forEach(c=>{const code='C'+(Store.d.customers.indexOf(c)+1);for(const nm of[c.name,c.alias])if(nm&&nm.length>1)o=o.split(nm).join(code)});return o}
const deAnon=t=>t.replace(/\bC(\d+)\b/g,(m,n)=>(Store.d.customers[+n-1]||{}).name||m);
function ctx(q){const cs=Store.d.customers.map(c=>({c,b:Store.bal(c.id)})),db=cs.filter(x=>x.b>0).sort((a,b)=>b.b-a.b),nq=norm(q),
 row=x=>`${codeOf(x.c)}${x.c.guest?' [مهمان]':''}: ${Math.round(x.b)} تومان، ${age(x.c)} روز از قدیمی‌ترین بدهی، ${an(x.c).overdueDays?an(x.c).overdueDays+' روز دیرکرد':'بدون دیرکرد'}`;
 let t=`امروز: ${dt(Date.now())}\nجمع بدهی: ${Math.round(Store.total())} تومان\nتعداد مشتری: ${cs.length}، بدهکار: ${db.length}\nحد پیش‌فرض: ${lim({})} تومان، مهلت پیش‌فرض: ${dys({})} روز\n۲۰ بدهکار اول:\n${db.slice(0,20).map(row).join('\n')}\nمهمان‌های بدهکار:\n${db.filter(x=>x.c.guest).map(row).join('\n')||'—'}\nپرریسک‌ترین‌ها (امتیاز ۰ تا ۱۰۰):\n${riskSet().sort((a,b)=>b.r.score-a.r.score).slice(0,8).map(x=>`${codeOf(x.c)}: ${x.r.score} (${x.r.reasons.join('، ')})`).join('\n')}\nماهانه (نسیه/دریافتی): ${months().map(m=>`${m.l}:${m.d}/${m.p}`).join(' ، ')}`;
 for(const x of cs.filter(x=>nq.includes(norm(x.c.name))||(x.c.alias&&nq.includes(norm(x.c.alias)))).slice(0,3))
  t+=`\nجزئیات ${codeOf(x.c)} (حد ${lim(x.c)}، مهلت ${dys(x.c)} روز): `+Store.live().filter(y=>y.customerId===x.c.id).sort((a,b)=>b.ts-a.ts).slice(0,15).map(y=>`${dt(y.date)} ${TYPE[y.type]} ${y.amount}${y.dueDate?' سررسید '+dt(y.dueDate):''}`).join('، ');
 return t}
async function askAI(){const q=$('#aq').value.trim(),s=Store.d.set;if(!q)return;chat.push({r:'user',c:q},{r:'assistant',c:'…'});render();
 const A=t=>s.aiAnon?anonText(t):t,sys='تو دستیار حسابداری یک فروشگاه هستی. فقط بر اساس داده‌ی زیر و گفت‌وگو پاسخ بده، هرگز عدد یا نام از خودت نساز، اگر داده کافی نیست بگو. فارسی، کوتاه و روشن جواب بده. مبالغ به تومان است.'+(s.aiAnon?' نام مشتری‌ها با کد (مثل C12) آمده؛ در پاسخ دقیقاً همان کد را بنویس.':'')+'\n\n'+ctx(q);
 try{const r=await fetch(s.aiUrl.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.aiKey},
  body:JSON.stringify({model:s.aiModel,temperature:.3,messages:[{role:'system',content:sys},...chat.slice(0,-1).slice(-8).map(m=>({role:m.r,content:A(m.c)}))]})});
  const j=await r.json();chat[chat.length-1].c=r.ok?(s.aiAnon?deAnon(j.choices[0].message.content):j.choices[0].message.content):'خطا: '+(j.error?.message||r.status)}
 catch(e){chat[chat.length-1].c='اتصال به سرویس برقرار نشد؛ اینترنت/VPN را بررسی کن یا سرویس دیگری انتخاب کن.'}
 render();$('#screen').scrollTop=$('#screen').scrollHeight}
const AIP={openai:['https://api.openai.com/v1','gpt-4o-mini'],gemini:['https://generativelanguage.googleapis.com/v1beta/openai','gemini-2.5-flash'],openrouter:['https://openrouter.ai/api/v1','openrouter/free']};
function aiPreset(k){if(AIP[k]){setv('aiUrl',AIP[k][0]);setv('aiModel',AIP[k][1]);render()}}
// ---------- دستور صوتی/متنی ----------
let liveCmdMatches=[],commandChoice=-1,voiceSelection=null;
function hideCmdSuggestions(){
 const box=$('#cmd-suggestions');if(box)box.hidden=true;
 $('#cmd').setAttribute('aria-expanded','false');$('#cmd').removeAttribute?.('aria-activedescendant');commandChoice=-1;
}
function updateCmdSuggestions(){
 const text=$('#cmd').value;liveCmdMatches=customerSuggestions(text,on||text===voiceText);
 const box=$('#cmd-suggestions');if(!box)return;
 if(!liveCmdMatches.length)return hideCmdSuggestions();
 box.hidden=false;commandChoice=-1;$('#cmd').setAttribute('aria-expanded','true');
 box.innerHTML=`<div class="suggestion-heading"><span>مشتری‌های مرتبط${on?' · در حال شنیدن':''}</span><button type="button" onclick="hideCmdSuggestions()" aria-label="بستن پیشنهادها">×</button></div><div role="listbox" aria-label="مشتری‌های مرتبط">${liveCmdMatches.map((c,i)=>`<button id="cmd-option-${i}" class="cmd-option" role="option" aria-selected="false" ${on?'disabled':''} onclick="selectCmdCustomer('${c.id}')"><span><b>${esc(c.name)}</b>${c.alias?`<small>${esc(c.alias)}</small>`:''}</span><small>${fmt(Store.bal(c.id))} تومان</small></button>`).join('')}</div>`;
}
function selectCmdCustomer(id){
 if(on)return;const c=find(id);if(!c)return toast('این مشتری دیگر در فهرست نیست');
 const text=$('#cmd').value,source=voiceText&&text===voiceText?'voice':'manual',r=parseCmd(text,{source});
 hideCmdSuggestions();if(r.intent==='tx')run(text,{source,customerId:id});else profile(id);
}
function cmdKeyDown(e){
 const box=$('#cmd-suggestions'),open=box&&!box.hidden;
 if(open&&['ArrowDown','ArrowUp'].includes(e.key)){
  e.preventDefault();commandChoice=commandChoice<0?(e.key==='ArrowDown'?0:liveCmdMatches.length-1):(commandChoice+(e.key==='ArrowDown'?1:-1)+liveCmdMatches.length)%liveCmdMatches.length;
  document.querySelectorAll('.cmd-option').forEach((b,i)=>{b.classList.toggle('highlight',i===commandChoice);b.setAttribute('aria-selected',String(i===commandChoice))});
  $('#cmd').setAttribute('aria-activedescendant','cmd-option-'+commandChoice);return;
 }
 if(e.key==='Escape'){hideCmdSuggestions();return}
 if(e.key==='Enter'){e.preventDefault();if(open&&commandChoice>=0&&!on)selectCmdCustomer(liveCmdMatches[commandChoice].id);else submitCmd()}
}
function customerChoiceRows(list,handler){
 return list.map((c,i)=>`<button class="customer-choice" onclick="${handler}('${c.id}')"><span><b>${esc(c.name)}</b><small>${i===0?'نزدیک‌ترین پیشنهاد':'پیشنهاد دیگر'}${c.alias?' · '+esc(c.alias):''}</small></span><span>${fmt(Store.bal(c.id))}<small>تومان</small></span></button>`).join('');
}
function chooseVoiceCustomer(text,o={}){
 voiceSelection={text,o};const list=customerSuggestions(text,true);
 sheet(`<h2>اول مشتری را انتخاب کن</h2><small>«${esc(text)}»</small>${customerChoiceRows(list,'acceptVoiceCustomer')||'<p class="empty">نام مرتبط پیدا نشد؛ متن را اصلاح کن.</p>'}<div class="row"><button onclick="voiceSelection=null;closeSheet()">لغو</button><button onclick="acceptVoiceCustomer('')">مشتری جدید / اصلاح نام</button></div>`);
}
function acceptVoiceCustomer(id){
 const choice=voiceSelection;if(!choice)return;voiceSelection=null;closeSheet();
 run(choice.text,{...choice.o,customerId:id||undefined,customerChosen:true});
}
function run(text,o={}){if(!text.trim())return;const r=parseCmd(text,o);
 const selected=o.customerId?find(o.customerId):null;
 if(o.customerId&&!selected)return toast('مشتری انتخاب‌شده دیگر وجود ندارد');
 if(selected&&['ask','tx'].includes(r.intent)){
  r.candidates=[{id:selected.id,name:selected.name,alias:selected.alias||'',score:1},...r.candidates.filter(c=>c.id!==selected.id)];
  r.customerId=selected.id;r.customerName=selected.name;
  if(r.reasons)r.reasons=r.reasons.filter(reason=>!/(مشتری با این نام|نام مشتری|چند مشتری)/.test(reason));
 }
 if(o.source==='voice'&&!o.customerChosen&&!selected&&['ask','tx'].includes(r.intent))return chooseVoiceCustomer(text,o);
 if(r.intent==='nav'){if(r.to==='trash')return trashView();if(r.to==='backup')return backup();tab=r.to;return render()}
 if(r.intent==='total')return toast('جمع بدهی‌ها: '+fmt(Store.total())+' تومان');
 if(r.intent==='today'){const L=Store.d.log.filter(x=>x.ts>=new Date().setHours(0,0,0,0)&&x.t==='tx');return toast(`امروز: نسیه ${fmt(L.filter(x=>x.a>0).reduce((a,x)=>a+x.a,0))} · دریافتی ${fmt(L.filter(x=>x.a<0).reduce((a,x)=>a+x.a,0))} تومان`)}
 if(r.intent==='undo'){const t=[...Store.live()].sort((a,b)=>b.createdAt-a.createdAt)[0];if(!t)return toast('ثبتی نیست');
  return sheet(`<h2>حذف آخرین ثبت؟</h2><p>${TYPE[t.type]} <b>${fmt(t.amount)}</b> — ${esc(Store.nm(t.customerId))}</p><div class="row"><button class="pri" onclick="Store.delTx('${t.id}');closeSheet();toast('به سطل زباله رفت')">بله، حذف</button><button onclick="closeSheet()">لغو</button></div>`)}
 if(r.intent==='newc')return editForm(null,{name:r.name,guest:r.guest});
 if(r.intent==='ask'){const cs=r.candidates;if(!cs.length)return toast('مشتری پیدا نشد: '+(r.name||''));if(cs.length==1||cs[0].score-cs[1].score>=.06)return profile(cs[0].id);
  return sheet(`<h2>منظورتان کدام است؟</h2>${cs.map(x=>`<div class="card" onclick="profile('${x.id}')"><b>${esc(x.name)}</b><span class="amt">${fmt(Store.bal(x.id))}</span></div>`).join('')}`)}
 if(!r.name&&!r.candidates.length)return toast('نام مشتری تشخیص داده نشد');
 cmd=r;r.vid=Store.vlog({rawText:r.rawText,type:r.type,amount:r.amount,customer:r.customerName,confidence:r.confidence,source:r.source,result:'pending'});
 const cs=r.candidates,sure=!!r.customerId,one=cs.length===1&&!sure;
 sheet(`<div class="cf"><h2>تایید ثبت ${r.source==='voice'?'🎤':''}</h2><small>«${esc(r.rawText)}» · اطمینان ${fmt(r.confidence*100)}٪</small>
 ${r.needsConfirmation?`<div class="bk" style="background:var(--warn)">نیاز به بررسی: ${esc(r.reasons.join(' · ')||'لطفا موارد را بررسی کن')}</div>`:''}
 <div class="seg"><label class="s-credit"><input type="radio" name="ty" value="credit" ${r.type==='credit'?'checked':''}><span>نسیه</span></label><label class="s-pay"><input type="radio" name="ty" value="payment" ${r.type==='payment'?'checked':''}><span>پرداخت</span></label></div>
 <label for="voice-amount">مبلغ به تومان (قابل اصلاح)</label><input id="voice-amount" inputmode="numeric" oninput="formatMoneyInput(this)" value="${moneyInputValue(r.amount)}">
 ${r.colloquial?`<label class="opt"><input type="checkbox" id="kk" checked> «${fmt(r.amountRaw)} تومن» یعنی ${fmt(r.amountRaw*1000)} تومان</label>`:''}
 <label>${one?`منظورتان «${esc(cs[0].name)}» است؟`:cs.length&&!sure?'منظورتان کدام است؟':'مشتری'}</label>
 ${cs.map((x,i)=>`<label class="opt"><input type="radio" name="cs" value="${i}" ${sure&&i==0?'checked':''}> ${esc(x.name)}${x.alias?' «'+esc(x.alias)+'»':''} <small>مانده ${fmt(Store.bal(x.id))}</small></label>`).join('')}
 <label class="opt"><input type="radio" name="cs" value="new" ${cs.length?'':'checked'}> مشتری جدید</label>
 <input id="nn" placeholder="نام" value="${esc(cs.length?'':r.name)}"><input id="na" placeholder="اسم مستعار (اختیاری)" style="margin-top:6px">
 <label class="opt"><input type="checkbox" id="ng" ${r.guest?'checked':''}> مشتری موقت (مهمان)</label>
 <input id="dd" type="number" inputmode="numeric" placeholder="مهلت پرداخت (روز) — خالی = پیش‌فرض" value="${r.dueDays||''}">
 </div><div class="cf-foot"><button class="glass" onclick="cancelCmd()">لغو</button><button class="pri" onclick="okCmd()">تایید</button></div>`);cmd.open=true}
let cmd=null;
function cancelCmd(){try{if(cmd&&Store.writeAllowed&&!Store.blocked)Store.vset(cmd.vid,'cancelled')}catch(e){if(!e.storeError)throw e}closeSheet()}
function okCmd(){const r=cmd;if(!r||!r.open)return;
 const v=document.querySelector('input[name=cs]:checked')?.value,ty=document.querySelector('input[name=ty]:checked').value;
 if(v===undefined)return toast('مشتری را انتخاب کن');
 let amt=Number(norm($('#voice-amount').value));if($('#kk')&&!$('#kk').checked&&amt===r.amount)amt=r.amountRaw;
 if(!Number.isSafeInteger(amt)||amt<=0)return toast('مبلغ صحیح و بیشتر از صفر وارد کن');
 const due=$('#dd').value.trim(),dd=Number(due);if(due&&(!Number.isSafeInteger(dd)||dd<=0))return toast('مهلت باید تعداد روز صحیح و مثبت باشد');
 if(v==='new'&&!$('#nn').value.trim()&&!$('#na').value.trim())return toast('نام یا اسم مستعار را وارد کن');
 let c;const saved=Store.batch(()=>{if(v==='new'){const n=$('#nn').value.trim(),a=$('#na').value.trim();if(!n&&!a)return toast('نام یا اسم مستعار را وارد کن');c=Store.addC(n||a,{alias:a,guest:$('#ng').checked})}else c=find(r.candidates[+v]?.id);
 if(!c){toast('مشتری پیدا نشد؛ دوباره انتخاب کن');return false}const now=Date.now();
 Store.addTransaction({customerId:c.id,type:ty,amount:amt,date:now,dueDate:ty==='credit'?now+(dd||dys(c))*DAY:null,description:'',items:r.items||[],source:r.source,meta:{rawText:r.rawText,confidence:r.confidence,confirmed:true}});
 Store.vset(r.vid,'confirmed');return true});if(!saved)return;$('#cmd').value='';voiceText='';closeSheet();alertLimit(c,ty==='credit'?1:-1)}
function sweep(){if(!Store.writeAllowed||Store.blocked)return;const today=new Date().toDateString(),messages=[];
 Store.batch(()=>{for(const c of Store.d.customers){const a=an(c);if(a.overdue.length&&!c.guest&&Store.d.alerts[c.id]!==today&&Store.d.set.token&&Store.d.set.chat){Store.d.alerts[c.id]=today;messages.push(`⏰ ${c.name}: ${a.overdueDays} روز از سررسید گذشته، مانده ${fmt(a.remaining)} تومان`)}}
  if(messages.length)Store.save()});for(const message of messages)tg(message)}
$('#sheet').addEventListener('click',e=>{if(e.target.id==='sheet')dismiss()});
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{tab=b.dataset.t;render()});
function submitCmd(){if(on&&rec){rec.stop();return}const text=$('#cmd').value;run(text,{source:voiceText&&text===voiceText?'voice':'manual'})}
$('#go').onclick=submitCmd;$('#cmd').onkeydown=cmdKeyDown;$('#cmd').oninput=updateCmdSuggestions;$('#cmd').onfocus=updateCmdSuggestions;
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.cmd'))hideCmdSuggestions()});
const SR=window.SpeechRecognition||window.webkitSpeechRecognition,score=r=>r.intent==='tx'?r.confidence:r.intent==='ask'?(r.candidates.length?.9:.3):.95;
let rec=null,on=false,voiceDraft=[],voiceText='';
function speechChoices(results){let choices=[{text:'',confidence:0,count:0}];
 for(let i=0;i<results.length;i++){const result=results[i];if(!result.isFinal)continue;const next=[];
  for(const prior of choices)for(let j=0;j<Math.min(result.length,3);j++){const a=result[j];next.push({text:(prior.text+' '+a.transcript).trim(),confidence:prior.confidence+(a.confidence||0),count:prior.count+1})}
  choices=next.slice(0,12)}
 return choices.filter(x=>x.text).map(x=>({text:x.text,confidence:x.count?x.confidence/x.count:0}))
  .filter((x,i,a)=>a.findIndex(y=>y.text===x.text)===i)}
function updateVoiceReview(){const list=customerSuggestions($('#voice-edit').value,true);$('#voice-matches').innerHTML=customerChoiceRows(list,'acceptVoiceReview')||'<p class="empty">نام مرتبط پیدا نشد؛ متن را اصلاح کن.</p>'}
function acceptVoiceReview(id){const text=$('#voice-edit').value.trim();if(!text)return;const selected=voiceDraft.find(x=>x.text===text);voiceText=text;$('#cmd').value=text;closeSheet();run(text,{source:'voice',stt:selected?selected.confidence:0,customerId:id,customerChosen:true})}
function reviewVoice(){if(!voiceDraft.length)return;
 sheet(`<h2>اول مشتری را انتخاب کن</h2><p>پیشنهادهای نزدیک به دستور صوتی؛ پس از انتخاب، مبلغ و نوع ثبت را بررسی می‌کنی.</p><div id="voice-matches">${customerChoiceRows(customerSuggestions(voiceDraft[0].text,true),'acceptVoiceReview')||'<p class="empty">نام مرتبط پیدا نشد؛ متن را اصلاح کن.</p>'}</div>
 <label for="voice-edit">متن قابل اصلاح</label><textarea id="voice-edit" oninput="updateVoiceReview()" rows="3" style="width:100%;font:inherit;padding:12px;border-radius:12px">${esc(voiceDraft[0].text)}</textarea>
 ${voiceDraft.length>1?`<label>برداشت‌های دیگر از صدا</label>${voiceDraft.map((x,i)=>`<label class="opt"><input type="radio" name="voice-choice" value="${i}" ${i===0?'checked':''} onchange="document.querySelector('#voice-edit').value=voiceDraft[+this.value].text;updateVoiceReview()"> ${esc(x.text)}</label>`).join('')}`:''}
 <div class="row"><button onclick="closeSheet();listen()">دوباره بگو</button><button class="pri" onclick="useVoice()">بررسی دستور</button></div>`)}
function useVoice(){const text=$('#voice-edit').value.trim();if(!text)return toast('متن دستور را وارد کن');
 const selected=voiceDraft.find(x=>x.text===text);voiceText=text;$('#cmd').value=text;closeSheet();run(text,{source:'voice',stt:selected?selected.confidence:0})}
function micState(active){on=active;$('#mic').classList.toggle('on',active);$('#mic').setAttribute('aria-pressed',String(active));$('#mic').setAttribute('aria-label',active?'پایان ضبط':'شروع دستور صوتی');$('#mic').textContent=active?'⏹':'🎤';$('#cmd').readOnly=active;updateCmdSuggestions()}
function listen(){if(on)return;if(!SR)return toast('از میکروفون کیبورد برای نوشتن دستور استفاده کن');
 if(window.isSecureContext===false)return toast('میکروفون به آدرس HTTPS نیاز دارد');
 let r;try{r=new SR()}catch(e){return toast('میکروفون آماده نشد؛ دوباره امتحان کن')}
 rec=r;voiceDraft=[];let heard=false,failed=false,timer=null,previous=$('#cmd').value;
 r.lang='fa-IR';r.continuous=true;r.interimResults=true;r.maxAlternatives=5;micState(true);
 r.onstart=()=>{if(rec!==r)return;toast('صحبت کن؛ برای پایان، دوباره میکروفون را بزن');timer=setTimeout(()=>{if(rec===r)r.stop()},30000)};
 r.onmode=e=>{if(rec!==r)return;toast(e.mode==='offline'?'اینترنت در دسترس نیست؛ تشخیص آفلاین گوشی فعال شد':'تشخیص گفتار آنلاین فارسی فعال شد')};
 r.onfallback=()=>{if(rec===r)clearTimeout(timer)};
 r.onend=()=>{if(rec!==r)return;clearTimeout(timer);rec=null;micState(false);
  if(voiceDraft.length){$('#cmd').value=voiceDraft[0].text;voiceText=voiceDraft[0].text;reviewVoice()}
  else {if(!heard)$('#cmd').value=previous;if(!failed)toast(heard?'متن نهایی دریافت نشد؛ متن را اصلاح کن و ثبت را بزن':'صدایی شنیده نشد؛ دوباره امتحان کن')}};
 r.onerror=e=>{if(rec!==r)return;failed=true;clearTimeout(timer);
  if(e.error==='offline-unavailable')return toast('مدل فارسی آفلاین روی گوشی آماده نیست؛ از تنظیمات «بررسی / دانلود مدل فارسی» را بزن. فعلاً متن را دستی وارد کن.');
  const messages={network:'سرویس تشخیص گفتار در دسترس نیست؛ اتصال اینترنت را بررسی کن یا از میکروفون کیبورد استفاده کن.','service-not-allowed':'سرویس گفتار در این مرورگر فعال نیست؛ از میکروفون کیبورد استفاده کن.','not-allowed':'دسترسی میکروفون را در تنظیمات گوشی و مرورگر فعال کن.','audio-capture':'میکروفون در دسترس نیست؛ برنامه‌های ضبط دیگر را ببند.','no-speech':'صدایی شنیده نشد؛ نزدیک‌تر به میکروفون صحبت کن.','language-not-supported':window.NasieAndroid?'تشخیص فارسی در سرویس فعلی آماده نیست؛ از تنظیمات، مدل آفلاین را بررسی کن یا سرویس گفتار گوشی را به‌روز کن.':'سرویس صوتی فعلی فارسی را پشتیبانی نمی‌کند؛ زبان گفتار کیبورد را فارسی تنظیم کن.'};
  if(e.error!=='aborted')toast(messages[e.error]||'تشخیص صدا متوقف شد؛ دوباره امتحان کن.')};
 r.onresult=e=>{if(rec!==r)return;heard=true;voiceDraft=speechChoices(e.results);
  $('#cmd').value=Array.from(e.results,x=>x[0].transcript).join(' ').trim();
  // متن موقت هرگز عملیات حسابداری اجرا نمی‌کند.
  voiceText=$('#cmd').value;updateCmdSuggestions()};
 try{r.start()}catch(e){rec=null;micState(false);$('#cmd').value=previous;toast('شروع ضبط ممکن نشد؛ دوباره امتحان کن')} }
$('#mic').setAttribute('aria-label','شروع دستور صوتی');$('#mic').setAttribute('aria-pressed','false');
if(!SR)$('#mic').onclick=()=>toast('از میکروفون کیبورد برای نوشتن دستور استفاده کن');
else $('#mic').onclick=()=>{if(on&&rec){rec.stop();return}listen()};

render();Store.startGuard(()=>render());setInterval(()=>{if(document.visibilityState!=='hidden'&&Store.writeAllowed&&!Store.blocked){Store.checkpoint();sweep()}},60000);if(window.Liquid)Liquid.init();setTimeout(()=>document.body.classList.remove('intro'),3300);
