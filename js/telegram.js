// ارسال پیام به ربات تلگرام (توکن و chat id در تنظیمات)
async function tg(text){const s=Store.d.set;if(!s.token||!s.chat)return false;
 try{const r=await fetch(`https://api.telegram.org/bot${s.token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:s.chat,text})});return r.ok}catch(e){return false}}
