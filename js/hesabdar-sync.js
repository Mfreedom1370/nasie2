// nasie-release:30
(() => {
  const storageKey = 'nasie-hesabdar-connection';
  let connection = {}, timer, pending = false, sent = '', status = '';
  try { connection = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch {}
  const pick = (row, fields) => Object.fromEntries(fields.filter(key => row[key] !== undefined).map(key => [key, row[key]]));

  function address(value) {
    if (!value.trim()) return '';
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/')
      throw Error('نشانی باید HTTPS و فقط آدرس اصلی حسابدار باشد.');
    return url.origin;
  }

  function snapshot() {
    const {schema, customers, tx, set} = Store.d;
    return JSON.stringify({snapshot:{
      schema,
      customers: customers.map(row => pick(row, ['id','name','alias','phone','limit','days'])),
      tx: tx.map(row => pick(row, ['id','customerId','cid','type','amount','amt','date','ts','createdAt','dueDate','status','description','note','items'])),
      set: {limit:set.limit, days:set.days}
    }});
  }

  function show(message) {
    status = message;
    const output = document.getElementById('hesabdar-sync-status');
    if (output) output.textContent = message;
  }

  async function sync() {
    if (pending || connection.enabled!==true || !connection.primary || !connection.key || Store.blocked || Store.writeAllowed === false) return;
    const body = snapshot(), config = connection;
    if (body === sent) return;
    pending = true;
    show('در حال ارسال ثبت‌های دفتر…');
    try {
      for (const url of new Set([config.primary,config.lan].filter(Boolean))) {
        let response;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(()=>controller.abort(),12000);
          try { response = await fetch(url+'/api/v1/nasie/sync', {
            method:'POST',headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json'},
            body,redirect:'error',signal:controller.signal
          }); } finally { clearTimeout(timeout); }
        } catch { continue; }
        if (response.status >= 500) continue;
        const result = await response.json();
        if (!response.ok || !result.success) throw Error(result.error || 'حسابدار ثبت‌ها را نپذیرفت.');
        if (connection === config) {
          sent = body;
          show('همگام شد · '+new Date().toLocaleTimeString('fa-IR'));
        }
        return;
      }
      throw Error('حسابدار در دسترس نیست. ثبت‌ها روی گوشی محفوظ‌اند و دوباره ارسال می‌شوند.');
    } catch (error) { if (connection === config) show(error.message); }
    finally {
      pending = false;
      if (connection !== config || body !== snapshot()) schedule();
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => void sync(),750);
  }

  function restoreSettings() {
    const form = document.getElementById('hesabdar-sync-form');
    if (!form) return;
    form.elements.primary.value = connection.primary || '';
    form.elements.lan.value = connection.lan || '';
    show(status || (connection.enabled===true?'ارسال به نسخهٔ وب فعال است.':'حسابدار آفلاین از همین دفتر استفاده می‌کند.'));
  }

  function configure(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const primary = address(form.elements.primary.value), lan = address(form.elements.lan.value);
      const key = form.elements.syncKey.value.trim() || connection.key;
      if (!primary || !/^[A-Za-z0-9_-]{43}$/.test(key || '')) throw Error('نشانی اصلی و کلید اتصال حسابدار لازم است.');
      const next = {primary,lan,key,enabled:true};
      localStorage.setItem(storageKey,JSON.stringify(next));
      connection = next; sent = ''; form.elements.syncKey.value = '';
      show('تنظیمات ذخیره شد.'); schedule();
    } catch (error) { show(error.message); }
  }

  function disconnect() {
    localStorage.removeItem(storageKey);
    connection = {}; sent = ''; status = '';
    restoreSettings();
  }

  function pause() {
    connection={...connection,enabled:false};sent='';status='';
    localStorage.setItem(storageKey,JSON.stringify(connection));restoreSettings();
  }
  window.HesabdarSync = {configure,restoreSettings,disconnect,pause};
  window.addEventListener('nasie-ledger-saved',schedule);
  window.addEventListener('online',schedule);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule();});
  setInterval(()=>{if(document.visibilityState==='visible')schedule();},60000);
  schedule();
})();
