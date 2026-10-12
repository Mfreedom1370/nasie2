// Android-only adapter, injected into packaged assets by prepare-android.cjs.
(() => {
 if (!window.NasieNative) return;
 const bridge=window.NasieNative;
 const call=(method,...args)=>{
  const result=JSON.parse(bridge[method](...args));
  if(!result.ok)throw new Error(result.error||'حافظهٔ داخلی برنامه در دسترس نیست');
  return result.value;
 };
 Object.defineProperty(window,'localStorage',{value:{
  getItem:key=>call('get',String(key)),
  setItem:(key,value)=>call('put',String(key),String(value)),
  removeItem:key=>call('remove',String(key))
 }});
 const encode=bytes=>{let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary)};
 let exportName='';
 window.NasieAndroid={
  exportText(text,name,type){call('exportFile',encode(new TextEncoder().encode(text)),name,type);exportName=name},
  async exportBlob(blob,name){call('exportFile',encode(new Uint8Array(await blob.arrayBuffer())),name,blob.type||'application/octet-stream');exportName=name},
  saved(ok){
   if(ok&&exportName.startsWith('nasie-backup-')&&typeof Store!=='undefined'&&Store.writeAllowed&&!Store.blocked){
    try{Store.d.set.lastBk=new Date().toDateString();Store.save();if(typeof render==='function')render()}catch(e){if(typeof toast==='function')toast('فایل ذخیره شد؛ ثبت تاریخ بکاپ ناموفق بود');return}
   }
   if(typeof toast==='function')toast(ok?'فایل بکاپ ذخیره شد':'فایل ذخیره نشد؛ حساب‌های داخل برنامه حفظ شده‌اند');exportName='';
  }
 };
 let session=null,sequence=0;
 class OfflineSpeech {
  start(){if(session)throw new Error('Speech busy');this.id=++sequence;session=this;bridge.startSpeech(this.id)}
  stop(){if(session===this)bridge.stopSpeech(this.id,false)}
  abort(){if(session===this){bridge.stopSpeech(this.id,true);session=null;this.onend?.()}}
 }
 window.SpeechRecognition=OfflineSpeech;
 window.NasieAndroid.speech=(id,type,payload)=>{
  const r=session;if(!r||r.id!==id)return;
  if(type==='start')r.onstart?.();
  if(type==='result'){
   const alternatives=payload.texts.map((transcript,i)=>({transcript,confidence:Math.max(0,payload.confidence?.[i]||0)}));
   alternatives.isFinal=true;r.onresult?.({results:[alternatives]});
  }
  if(type==='error')r.onerror?.({error:payload});
  if(type==='end'){session=null;r.onend?.()}
 };
 window.NasieAndroid.guard=(store,changed)=>{
  const acquire=()=>{store.load();store.writeAllowed=true;store.guardMessage='';store.checkpoint();changed()};
  const release=()=>{store.writeAllowed=false;store.guardMessage='برنامه در پس‌زمینه است؛ ثبت متوقف است';changed()};
  store.acquireWriter=acquire;store.releaseWriter=release;
  document.addEventListener('visibilitychange',()=>document.visibilityState==='hidden'?release():acquire());
  if(document.visibilityState==='hidden')release();else acquire();
 };
})();
