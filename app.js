Store.load();
const $=s=>document.querySelector(s),esc=s=>{const d=document.createElement('div');d.textContent=s??'';return d.innerHTML};
const fmt=n=>Math.abs(Math.round(n)).toLocaleString('fa-IR'),dt=ts=>new Date(ts).toLocaleDateString('fa-IR'),tm=ts=>new Date(ts).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'});
const lim=c=>c.limit||Store.d.set.limit,dys=c=>c.days||Store.d.set.days,find=id=>Store.d.customers.find(x=>x.id===id);
let tab='dash',pending=null,qv='',ld=new Date().setHours(0,0,0,0);
function age(c){return Store.daysOverdue(c.id)}
function lastPayAge(c){const x=Store.ageInfo(c.id).daysSinceLastPayment;return x==null?null:x}
function dueLabel(c){
 const i=Store.ageInfo(c.id);
 if(!i.dueAt)return 'بدون سررسید';
 return i.daysOverdue>0?`سررسید ${dt(i.dueAt)} · ${fmt(i.daysOverdue)} روز عقب‌افتاده`:`سررسید ${dt(i.dueAt)}`;
}
const st=(c,b)=>b<=0?'ok':b>lim(c)?'bad':age(c)>0?'warn':'';
const sumTx=(id,f)=>Store.d.tx.filter(t=>t.cid===id&&f(t)).reduce((a,t)=>a+Math.abs(t.amt),0);
const LT={'c+':e=>`➕ مشتری جدید: ${e.n}`,'c~':e=>`✏️ ویرایش پروفایل: ${e.n}`,'c-':e=>`🗑 حذف مشتری: ${e.n}`,tx:e=>`${e.a>0?'🔴 نسیه':'🟢 پرداخت'} ${fmt(e.a)} — ${e.n}`,'tx-':e=>`🗑 حذف ثبت ${fmt(e.a)} — ${e.n}`,rs:e=>`♻️ بازیابی: ${e.n}`};
const logText=e=>(LT[e.t]||(()=>e.t))(e);
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,3000)}
function sheet(h){$('#sheet').innerHTML=`<div class="box">${h}</div>`;$('#sheet').hidden=false}
function closeSheet(){$('#sheet').hidden=true;render()}
function anim(){document.querySelectorAll('[data-n]').forEach(el=>{const t=+el.dataset.n,s=performance.now();(function f(n){const p=Math.min(1,(n-s)/800);el.textContent=fmt(t*(1-(1-p)**3));if(p<1)requestAnimationFrame(f)})(s)});
 document.querySelectorAll('main>*,main .kpis>div').forEach((el,i)=>el.style.setProperty('--i',Math.min(i,14)))}
function render(){$('#total').innerHTML=`جمع بدهی‌ها<b data-n="${Store.total()}"></b> تومان`;
 document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));
 $('#view').innerHTML=({dash:vDash,list:vList,log:vLog,ai:vAI,set:vSet})[tab]();document.body.classList.toggle('ai',tab==='ai');anim()}
// ---------- داشبورد ----------
function months(){const out=[],n=new Date();
 for(let i=5;i>=0;i--){const s=new Date(n.getFullYear(),n.getMonth()-i,1).getTime(),e=new Date(n.getFullYear(),n.getMonth()-i+1,1).getTime(),t=Store.d.tx.filter(x=>x.ts>=s&&x.ts<e&&x.note!=='مانده‌ی انتقالی از برنامه‌ی قبلی');
  out.push({l:new Date(s).toLocaleDateString('fa-IR',{month:'short'}),d:t.filter(x=>x.amt>0).reduce((a,x)=>a+x.amt,0),p:-t.filter(x=>x.amt<0).reduce((a,x)=>a+x.amt,0),net:Store.d.tx.filter(x=>x.ts<e).reduce((a,x)=>a+x.amt,0)})}return out}
function vDash(){const cs=Store.d.customers.map(c=>({c,b:Store.bal(c.id)})),db=cs.filter(x=>x.b>0),over=db.filter(x=>x.b>lim(x.c)),late=db.filter(x=>!x.c.guest&&age(x.c)>dys(x.c)).sort((a,b)=>age(b.c)-age(a.c)),
 gs=db.filter(x=>x.c.guest).sort((a,b)=>age(b.c)-age(a.c)),ms=months(),cur=ms[5],top=[...db].sort((a,b)=>b.b-a.b).slice(0,5),mx=top[0]?.b||1,now=new Date(),
 bk=now.getHours()>=Store.d.set.bkHour&&Store.d.set.lastBk!==now.toDateString();
 const m=Math.max(...ms.flatMap(x=>[x.d,x.p]),1),bars=ms.map((x,i)=>`<rect x="${i*48+8}" y="${95-x.d/m*80}" width="16" height="${x.d/m*80}" rx="3" fill="var(--bad)"/><rect x="${i*48+25}" y="${95-x.p/m*80}" width="16" height="${x.p/m*80}" rx="3" fill="var(--ok)"/><text x="${i*48+25}" y="110" text-anchor="middle" font-size="10" fill="var(--mut)">${x.l}</text>`).join('');
 const k=(c,l,v)=>`<div class="${c}"><small>${l}</small><b data-n="${v}"></b></div>`;
 return`${bk?'<div class="bk" onclick="backup()">📦 بکاپ امروز هنوز گرفته نشده — برای گرفتن لمس کن</div>':''}
 <div class="kpis">${k('k-bad','جمع بدهی‌ها',Store.total())}${k('','تعداد بدهکاران',db.length)}${k('k-warn','عقب‌افتاده',late.length)}${k('k-bad','بالای حد مجاز',over.length)}${k('','نسیه‌ی این ماه',cur.d)}${k('k-ok','دریافتی این ماه',cur.p)}</div>
 <div class="box2 gbox"><h3>👤 کاسب‌های موقت (بیشترین دیرکرد اول)</h3>${gs.map(x=>`<div class="lr" onclick="profile('${x.c.id}')"><span>${esc(x.c.name)} <small>${age(x.c)>0?fmt(age(x.c))+" روز عقب‌افتاده":dueLabel(x.c)}</small></span><b class="gv">${fmt(x.b)}</b></div>`).join('')||'<small>کاسب موقتی نیست</small>'}</div>
 <div class="box2"><h3>نسیه و دریافتی ماهانه</h3><svg class="sv" viewBox="0 0 290 118">${bars}</svg><div class="lg"><span><i style="background:var(--bad)"></i>نسیه</span><span><i style="background:var(--ok)"></i>دریافتی</span></div></div>
 <div class="box2"><h3>بیشترین بدهکاران</h3>${top.map(x=>`<div class="bar" onclick="profile('${x.c.id}')"><span>${esc(x.c.name)}</span><i style="width:${x.b/mx*100}%"></i><b>${fmt(x.b)}</b></div>`).join('')||'<p class="empty">داده‌ای نیست</p>'}</div>
 <div class="box2"><h3>عقب‌افتاده‌ها (بیشترین تاخیر)</h3>${late.slice(0,6).map(x=>`<div class="lr" onclick="profile('${x.c.id}')"><span>${esc(x.c.name)} <small>${age(x.c)>0?fmt(age(x.c))+" روز عقب‌افتاده":dueLabel(x.c)}</small></span><b class="warn">${fmt(x.b)}</b></div>`).join('')||'<small>موردی نیست 👌</small>'}</div>
 <div class="box2"><h3>روند مانده‌ی کل</h3>${trend(ms)}</div>`}
function trend(ms){const mx=Math.max(...ms.map(p=>p.net),1),xy=ms.map((p,i)=>[25+i*48,90-Math.max(p.net,0)/mx*70]);
 return`<svg class="sv" viewBox="0 0 290 118"><polyline pathLength="1" fill="none" stroke="var(--ac)" stroke-width="3" points="${xy.map(a=>a.join(',')).join(' ')}"/>${xy.map((a,i)=>`<circle cx="${a[0]}" cy="${a[1]}" r="4" fill="var(--ac)"/><text x="${a[0]}" y="110" text-anchor="middle" font-size="10" fill="var(--mut)">${ms[i].l}</text>`).join('')}</svg>`}
// ---------- مشتریان ----------
function vList(){return`<input class="sr" placeholder="جستجوی نام یا اسم مستعار…" value="${esc(qv)}" oninput="qv=this.value;$('#lst').innerHTML=rows()"><div id="lst">${rows()}</div><div class="row"><button class="pri" onclick="editForm(null)">+ مشتری جدید</button></div>`}
function rows(){const q=norm(qv),cs=Store.d.customers.filter(c=>norm(c.name+' '+(c.alias||'')).includes(q)).map(c=>({c,b:Store.bal(c.id)})).sort((a,b)=>b.b-a.b).slice(0,150);
 if(!cs.length)return'<p class="empty">مشتری‌ای پیدا نشد.</p>';
 return cs.map(({c,b})=>`<div class="card" onclick="profile('${c.id}')"><div><b>${esc(c.name)}</b>${c.guest?' <span class="tag gt">مهمان</span>':''}<small>${c.alias?'«'+esc(c.alias)+'» · ':''}${c.phone?esc(c.phone):''}</small></div><div class="amt ${st(c,b)}">${fmt(b)}<small>تومان${b<0?' (بستانکار)':''}</small></div></div>`).join('')}
function profile(id){const c=find(id),b=Store.bal(id);if(!c)return;
 sheet(`<div class="ph"><div class="av">${esc(c.name[0]||'؟')}</div><div><h2>${esc(c.name)}</h2><small>${c.alias?'«'+esc(c.alias)+'» · ':''}${c.guest?'کاسب موقت · ':''}${c.phone?`<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>`:'بدون شماره'}</small></div></div>
 <div class="amt big ${st(c,b)}">${fmt(b)} <small>تومان</small></div>
 <div class="kpis"><div><small>کل نسیه</small><b>${fmt(sumTx(id,t=>t.amt>0)+(c.prevLoan||0))}</b></div><div><small>کل پرداخت</small><b>${fmt(sumTx(id,t=>t.amt<0)+(c.prevPay||0))}</b></div><div><small>روز عقب‌افتادگی</small><b>${fmt(age(c))}</b></div></div>
 <small>حد بدهی: ${fmt(lim(c))} · مهلت: ${fmt(dys(c))} روز · ${dueLabel(c)}</small>${c.note?`<p class="note">${esc(c.note)}</p>`:''}
 <label>ثبت دستی</label><div class="row"><input id="ma" type="number" inputmode="numeric" placeholder="مبلغ (تومان)"><input id="mn" placeholder="توضیح"></div>
 <div class="row"><button class="pri" onclick="manual('${id}',1)">+ بدهی</button><button onclick="manual('${id}',-1)">− پرداخت</button></div>
 <label>تاریخچه</label>${Store.d.tx.filter(t=>t.cid===id).sort((a,b)=>b.ts-a.ts).map(t=>`<div class="tx"><span>${dt(t.ts)} ${esc(t.note)}${t.amt>0&&t.dueAt?`<small>سررسید: ${dt(t.dueAt)}${t.dueAt<Date.now()?' · گذشته':''}</small>`:''}</span><b class="${t.amt<0?'ok':''}">${t.amt<0?'−':'+'}${fmt(t.amt)}</b><button onclick="delTx('${t.id}','${id}')">🗑</button></div>`).join('')||'<small>هنوز ثبتی نیست</small>'}
 <div class="row"><button onclick="editForm('${id}')">ویرایش پروفایل</button><button onclick="closeSheet()">بستن</button></div>`)}
function manual(id,sg){
 const a=+$('#ma').value;if(!a)return toast('مبلغ را وارد کن');
 Store.addTx(id,sg*a,$('#mn').value,{source:'manual'});
 alertLimit(find(id),sg);profile(id)
}
function alertLimit(c,sg){const b=Store.bal(c.id);if(sg>0&&b>lim(c))tg(`⚠️ بدهی ${c.name} به ${fmt(b)} تومان رسید (حد: ${fmt(lim(c))})`)}
function editForm(id,pre){const c=id?find(id):(pre||{});
 sheet(`<h2>${id?'ویرایش پروفایل':'مشتری جدید'}</h2><label>نام</label><input id="en" value="${esc(c.name||'')}"><label>اسم مستعار (برای کسانی که نمی‌شناسی، مثلاً «آقای عینکی»)</label><input id="ea" value="${esc(c.alias||'')}">
 <label>شماره تماس</label><input id="ep" type="tel" value="${esc(c.phone||'')}"><label>یادداشت / آدرس</label><textarea id="eo" rows="2">${esc(c.note||'')}</textarea>
 <label>حد بدهی (تومان) — خالی = پیش‌فرض</label><input id="el" type="number" value="${c.limit||''}"><label>مهلت پرداخت (روز) — خالی = پیش‌فرض</label><input id="ed" type="number" value="${c.days||''}">
 <label class="opt"><input type="checkbox" id="eg" ${c.guest?'checked':''}> کاسب موقت (مهمان) — در ستون ویژه‌ی داشبورد دیده می‌شود</label>
 <div class="row"><button class="pri" onclick="saveC(${id?`'${id}'`:'null'})">ذخیره</button><button onclick="${id?`profile('${id}')`:'closeSheet()'}">انصراف</button></div>
 ${id?`<div class="row"><button class="dng" onclick="delC('${id}')">انتقال به سطل زباله</button></div>`:''}`)}
function saveC(id){const n=$('#en').value.trim(),a=$('#ea').value.trim();if(!n&&!a)return toast('نام یا اسم مستعار را وارد کن');
 const f={name:n||a,alias:a,phone:$('#ep').value.trim(),note:$('#eo').value.trim(),limit:+$('#el').value||0,days:+$('#ed').value||0,guest:$('#eg').checked};
 let c;if(id){c=find(id);Object.assign(c,f);Store.log('c~',c.name);Store.save()}else c=Store.addC(f.name,f);profile(c.id)}
function delC(id){if(!confirm('مشتری با تمام ثبت‌هایش به سطل زباله برود؟'))return;Store.delC(id);closeSheet()}
function delTx(tid,id){Store.delTx(tid);toast('به سطل زباله رفت');profile(id)}
// ---------- تغییرات روزانه ----------
function vLog(){const L=Store.d.log.filter(x=>x.ts>=ld&&x.ts<ld+864e5).sort((a,b)=>b.ts-a.ts),s=f=>L.filter(f).reduce((a,x)=>a+Math.abs(x.a),0);
 return`<div class="row"><button onclick="ld-=864e5;render()">◀ روز قبل</button><button onclick="ld=new Date().setHours(0,0,0,0);render()">امروز</button><button onclick="ld+=864e5;render()">روز بعد ▶</button></div>
 <h3 class="dayh">${new Date(ld).toLocaleDateString('fa-IR',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</h3>
 <div class="kpis"><div><small>تعداد تغییرات</small><b data-n="${L.length}"></b></div><div class="k-bad"><small>نسیه‌ی روز</small><b data-n="${s(x=>x.t==='tx'&&x.a>0)}"></b></div><div class="k-ok"><small>دریافتی روز</small><b data-n="${s(x=>x.t==='tx'&&x.a<0)}"></b></div></div>
 <div class="box2">${L.map(e=>`<div class="lgr"><time>${tm(e.ts)}</time><span>${esc(logText(e))}</span></div>`).join('')||'<small>در این روز تغییری ثبت نشده</small>'}</div>`}
// ---------- سطل زباله ----------
function trashView(){const T=[...Store.d.trash].sort((a,b)=>b.ts-a.ts);
 sheet(`<h2>🗑 سطل زباله</h2><small>هر چیزی که حذف کنی اول اینجا می‌آید و قابل بازیابی است.</small>
 ${T.map(i=>`<div class="tx"><span>${i.k==='c'?'👤':'🧾'} ${esc(i.label)}<small>${dt(i.ts)}</small></span><span><button onclick="restoreT('${i.id}')">♻️</button> <button onclick="purgeT('${i.id}')">✕</button></span></div>`).join('')||'<p class="empty">سطل زباله خالی است</p>'}
 <div class="row">${T.length?'<button class="dng" onclick="if(confirm(\'همه برای همیشه پاک شوند؟\')){Store.d.trash=[];Store.save();trashView()}">خالی کردن</button>':''}<button onclick="closeSheet()">بستن</button></div>`)}
function restoreT(id){toast(Store.restore(id)?'بازیابی شد':'مشتری این ثبت در دسترس نیست؛ اول مشتری را بازیابی کن');trashView()}
function purgeT(id){if(confirm('برای همیشه پاک شود؟')){Store.purge(id);trashView()}}
// ---------- تنظیمات و بکاپ ----------
function vSet(){const s=Store.d.set;
 return`<label>توکن ربات تلگرام</label><input value="${esc(s.token)}" onchange="setv('token',this.value)" dir="ltr"><label>Chat ID</label><input value="${esc(s.chat)}" onchange="setv('chat',this.value)" dir="ltr">
 <label>حد بدهی پیش‌فرض (تومان)</label><input type="number" value="${s.limit}" onchange="setv('limit',+this.value)"><label>مهلت پیش‌فرض پرداخت (روز)</label><input type="number" value="${s.days}" onchange="setv('days',+this.value)">
 <label>دستیار هوشمند — آدرس سرویس (OpenAI یا سازگار)</label><input value="${esc(s.aiUrl)}" onchange="setv('aiUrl',this.value)" dir="ltr"><label>کلید API</label><input type="password" value="${esc(s.aiKey)}" onchange="setv('aiKey',this.value)" dir="ltr"><label>نام مدل</label><input value="${esc(s.aiModel)}" onchange="setv('aiModel',this.value)" dir="ltr">
 <small>با فعال بودن دستیار، خلاصه‌ی حساب‌ها (شامل نام مشتری‌ها) برای سرویس انتخابی ارسال می‌شود.</small><label>ساعت یادآور بکاپ روزانه (۰ تا ۲۳)</label><input type="number" min="0" max="23" value="${s.bkHour}" onchange="setv('bkHour',+this.value)">
 <div class="row"><button class="pri" onclick="backup()">📦 بکاپ اکسل الان</button><button onclick="tg('✅ پیام آزمایشی دفتر نسیه').then(o=>toast(o?'ارسال شد':'ارسال نشد؛ توکن/Chat ID را بررسی کن'))">تست تلگرام</button></div>
 <small>آخرین بکاپ اکسل: ${s.lastBk||'—'}. فایل در گوشی ذخیره می‌شود و اگر تلگرام وصل باشد همان‌جا هم فرستاده می‌شود.</small>
 <div class="row"><button onclick="Store.exportJson()">خروجی JSON</button><button onclick="$('#imp').click()">بازیابی JSON</button><button onclick="trashView()">🗑 سطل زباله</button></div>
 <input type="file" id="imp" accept=".json" hidden onchange="this.files[0].text().then(t=>{Store.importJson(t);render();toast('بازیابی شد')})">`}
function setv(k,v){Store.d.set[k]=v;Store.save()}
const loadX=()=>window.XLSX?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=ok;s.onerror=no;document.head.appendChild(s)});
async function backup(){try{await loadX()}catch(e){return toast('برای ساخت اکسل یک‌بار اتصال اینترنت لازم است')}
 const D=Store.d,U=XLSX.utils,wb=U.book_new(),add=(r,n)=>U.book_append_sheet(wb,U.json_to_sheet(r),n);
 add(D.customers.map(c=>({نام:c.name,'اسم مستعار':c.alias||'',تلفن:c.phone||'',نوع:c.guest?'مهمان':'مشتری',مانده:Store.bal(c.id)})),'مشتریان');
 add(D.tx.map(t=>({تاریخ:dt(t.ts),مشتری:Store.nm(t.cid),مبلغ:t.amt,نوع:t.amt>0?'نسیه':'پرداخت',توضیح:t.note})),'ثبت‌ها');
 add(D.log.map(e=>({زمان:dt(e.ts)+' '+tm(e.ts),شرح:logText(e)})),'تغییرات');
 const name=`nasie-${new Date().toISOString().slice(0,10)}.xlsx`,blob=new Blob([XLSX.write(wb,{type:'array',bookType:'xlsx'})],{type:'application/octet-stream'}),a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download=name;a.click();setv('lastBk',new Date().toDateString());
 const s=D.set;if(s.token&&s.chat){const f=new FormData();f.append('chat_id',s.chat);f.append('document',blob,name);
  try{const r=await fetch(`https://api.telegram.org/bot${s.token}/sendDocument`,{method:'POST',body:f});toast(r.ok?'بکاپ ذخیره و به تلگرام فرستاده شد':'بکاپ ذخیره شد؛ ارسال تلگرام ناموفق بود')}catch(e){toast('بکاپ ذخیره شد؛ تلگرام در دسترس نیست')}}else toast('بکاپ اکسل ذخیره شد');render()}
// ---------- دستیار هوشمند (سازگار با OpenAI) ----------
let chat=[];
function vAI(){const s=Store.d.set;if(!s.aiKey)return'<p class="empty">برای فعال شدن، در «تنظیمات» کلید API را وارد کن.</p>';
 return`<div id="chat">${chat.map(m=>`<div class="msg ${m.r}">${esc(m.c)}</div>`).join('')||'<p class="empty">از دستیار درباره‌ی بدهی‌ها، دیرکردها و روند حساب‌ها بپرس.</p>'}</div>
 <div class="aibar"><input id="aq" placeholder="مثلا: کدام بدهکارها پرریسک‌ترند؟" onkeydown="if(event.key==='Enter')askAI()"><button class="pri" onclick="askAI()">بپرس</button></div>`}
function ctx(q){const cs=Store.d.customers.map(c=>({c,b:Store.bal(c.id)})),db=cs.filter(x=>x.b>0).sort((a,b)=>b.b-a.b),nq=norm(q),
 row=x=>`${x.c.name}${x.c.alias?' ('+x.c.alias+')':''}${x.c.guest?' [مهمان]':''}: ${Math.round(x.b)} تومان، ${age(x.c)} روز عقب‌افتادگی، ${dueLabel(x.c)}`;
 let t=`امروز: ${dt(Date.now())}\nجمع بدهی: ${Math.round(Store.total())} تومان\nتعداد مشتری: ${cs.length}، بدهکار: ${db.length}\nحد پیش‌فرض: ${lim({})} تومان، مهلت پیش‌فرض: ${dys({})} روز\n۲۰ بدهکار اول:\n${db.slice(0,20).map(row).join('\n')}\nمهمان‌های بدهکار:\n${db.filter(x=>x.c.guest).map(row).join('\n')||'—'}\nماهانه (نسیه/دریافتی): ${months().map(m=>`${m.l}:${m.d}/${m.p}`).join(' ، ')}`;
 for(const x of cs.filter(x=>nq.includes(norm(x.c.name))||(x.c.alias&&nq.includes(norm(x.c.alias)))).slice(0,3))
  t+=`\nجزئیات ${x.c.name} (حد ${lim(x.c)}، مهلت ${dys(x.c)} روز): `+Store.d.tx.filter(y=>y.cid===x.c.id).sort((a,b)=>b.ts-a.ts).slice(0,15).map(y=>`${dt(y.ts)} ${y.amt}`).join('، ');
 return t}
async function askAI(){const q=$('#aq').value.trim(),s=Store.d.set;if(!q)return;chat.push({r:'user',c:q},{r:'assistant',c:'…'});render();
 const sys='تو دستیار حسابداری یک فروشگاه هستی. فقط بر اساس داده‌ی زیر و گفت‌وگو پاسخ بده، هرگز عدد یا نام از خودت نساز، اگر داده کافی نیست بگو. فارسی، کوتاه و روشن جواب بده. مبالغ به تومان است.\n\n'+ctx(q);
 try{const r=await fetch(s.aiUrl.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.aiKey},
  body:JSON.stringify({model:s.aiModel,temperature:.3,messages:[{role:'system',content:sys},...chat.slice(0,-1).slice(-8).map(m=>({role:m.r,content:m.c}))]})});
  const j=await r.json();chat[chat.length-1].c=r.ok?j.choices[0].message.content:'خطا: '+(j.error?.message||r.status)}
 catch(e){chat[chat.length-1].c='اتصال به سرویس برقرار نشد؛ اینترنت یا VPN را بررسی کن.'}
 render();window.scrollTo(0,document.body.scrollHeight)}
// ---------- دستور صوتی/متنی ----------
function run(text){if(!text.trim())return;const r=parseCmd(text);
 if(r.intent==='nav'){if(r.to==='trash')return trashView();if(r.to==='backup')return backup();tab=r.to;return render()}
 if(r.intent==='total')return toast('جمع بدهی‌ها: '+fmt(Store.total())+' تومان');
 if(r.intent==='today'){const L=Store.d.log.filter(x=>x.ts>=new Date().setHours(0,0,0,0)&&x.t==='tx');return toast(`امروز: نسیه ${fmt(L.filter(x=>x.a>0).reduce((a,x)=>a+x.a,0))} · دریافتی ${fmt(L.filter(x=>x.a<0).reduce((a,x)=>a+x.a,0))} تومان`)}
 if(r.intent==='undo'){const t=[...Store.d.tx].sort((a,b)=>b.ts-a.ts)[0];if(!t)return toast('ثبتی نیست');
  return sheet(`<h2>حذف آخرین ثبت؟</h2><p>${t.amt>0?'نسیه':'پرداخت'} <b>${fmt(t.amt)}</b> — ${esc(Store.nm(t.cid))}</p><div class="row"><button class="pri" onclick="Store.delTx('${t.id}');closeSheet();toast('به سطل زباله رفت')">بله، حذف</button><button onclick="closeSheet()">لغو</button></div>`)}
 if(r.intent==='newc')return editForm(null,{name:r.name,guest:r.guest});
 if(r.intent==='ask'){if(!r.cands.length)return toast('مشتری پیدا نشد: '+(r.name||''));if(r.cands.length==1||r.cands[0].s-r.cands[1].s>=.06)return profile(r.cands[0].c.id);
  return sheet(`<h2>کدام یک؟</h2>${r.cands.map(x=>`<div class="card" onclick="profile('${x.c.id}')"><b>${esc(x.c.name)}</b><span class="amt">${fmt(Store.bal(x.c.id))}</span></div>`).join('')}`)}
 if(!r.amt)return toast('مبلغ تشخیص داده نشد');if(!r.name&&!r.cands.length)return toast('نام مشتری تشخیص داده نشد');
 const cs=r.cands,sure=cs.length&&cs[0].s>=.92&&(cs.length==1||cs[0].s-cs[1].s>=.06);pending=r;
 sheet(`<h2>تایید ثبت</h2><small>«${esc(text)}»</small><small>اطمینان تشخیص: ${Math.round((r.confidence||0)*100)}٪</small><p>${r.pay?'پرداخت':'نسیه'} <b>${fmt(r.amt)}</b> تومان</p>
 ${r.amt<1000?`<label class="opt"><input type="checkbox" id="kk" checked> مبلغ به هزار تومان است (${fmt(r.amt*1000)} تومان)</label>`:''}
 <label>مشتری</label>${cs.map((x,i)=>`<label class="opt"><input type="radio" name="cs" value="${i}" ${(sure?i==0:false)?'checked':''}> ${esc(x.c.name)}${x.c.alias?' «'+esc(x.c.alias)+'»':''} <small>مانده ${fmt(Store.bal(x.c.id))}</small></label>`).join('')}
 <label class="opt"><input type="radio" name="cs" value="new" ${sure?'':'checked'}> مشتری جدید</label>
 <input id="nn" placeholder="نام" value="${esc(cs.length?'':r.name)}"><input id="na" placeholder="اسم مستعار (اختیاری)" style="margin-top:6px">
 <label class="opt"><input type="checkbox" id="ng" ${r.guest?'checked':''}> کاسب موقت (مهمان)</label>
 <div class="row"><button class="pri" onclick="okCmd()">تایید</button><button onclick="closeSheet()">لغو</button></div>`)}
function okCmd(){const r=pending,v=document.querySelector('input[name=cs]:checked')?.value;let c;
 if(v===undefined||v==='new'){const n=$('#nn').value.trim(),a=$('#na').value.trim();if(!n&&!a)return toast('نام یا اسم مستعار را وارد کن');c=Store.addC(n||a,{alias:a,guest:$('#ng').checked})}else c=r.cands[+v].c;
 const amt=r.amt*($('#kk')?.checked?1000:1);Store.addTx(c.id,r.pay?-amt:amt,'',{source:'voice',raw:r.raw,meta:{confidence:r.confidence}});$('#cmd').value='';closeSheet();alertLimit(c,r.pay?-1:1)}
function sweep(){const today=new Date().toDateString();
 for(const c of Store.d.customers){const b=Store.bal(c.id);if(b>0&&!c.guest&&age(c)>0&&Store.d.alerts[c.id]!==today&&Store.d.set.token){Store.d.alerts[c.id]=today;tg(`⏰ ${c.name}: ${age(c)} روز از سررسید گذشته، مانده ${fmt(b)} تومان`)}}Store.save()}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{tab=b.dataset.t;render()});
$('#go').onclick=()=>run($('#cmd').value);$('#cmd').onkeydown=e=>{if(e.key==='Enter')run(e.target.value)};
const SR=window.SpeechRecognition||window.webkitSpeechRecognition,score=r=>r.intent!=='tx'?3:(r.amt?2:0)+(r.cands.length?2:r.name?.5:0);
let rec=null,on=false,retried=false;
function listen(){const r=new SR();rec=r;r.lang='fa-IR';r.interimResults=true;r.maxAlternatives=5;
 r.onstart=()=>{on=true;$('#mic').classList.add('on')};r.onend=()=>{on=false;$('#mic').classList.remove('on')};
 r.onerror=e=>{if(e.error==='network'||e.error==='service-not-allowed'){if(!retried){retried=true;return setTimeout(listen,700)}retried=false;$('#cmd').focus();
   return toast('سرویس گفتار گوگل در دسترس نیست (اینترنت/فیلتر). فعلاً از میکروفون کیبورد در همین کادر استفاده کن.')}
  if(e.error==='no-speech')return toast('صدایی شنیده نشد');if(e.error==='aborted')return;toast(e.error==='not-allowed'?'مجوز میکروفون نیست':'خطا: '+e.error)};
 r.onresult=e=>{retried=false;const R=e.results[e.results.length-1];$('#cmd').value=R[0].transcript;
  if(R.isFinal){let best=R[0].transcript,bs=-1;for(let i=0;i<R.length;i++){const s=score(parseCmd(R[i].transcript));if(s>bs){bs=s;best=R[i].transcript}}$('#cmd').value=best;run(best)}};
 try{r.start()}catch(e){}}
if(!SR)$('#mic').hidden=true;else $('#mic').onclick=()=>{if(on)return rec.stop();retried=false;listen()};
render();sweep();
