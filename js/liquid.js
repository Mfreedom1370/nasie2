// جلوه‌ی «شیشه‌ی مایع»: برای هر عنصر [data-liquid] یک نقشه‌ی جابجایی بر پایه‌ی SDF مستطیل گرد ساخته می‌شود
// و با feDisplacementMap به‌عنوان backdrop-filter اعمال می‌شود. در مرورگرهای ناسازگار blur معمولی (از CSS) می‌ماند.
function liquidMap(w,h,r,bezel){w=Math.max(2,Math.round(w));h=Math.max(2,Math.round(h));r=Math.min(r,w/2,h/2);bezel=bezel||Math.min(w,h)*.3;
 const px=new Uint8ClampedArray(w*h*4),hx=w/2,hy=h/2,bx=hx-r,by=hy-r;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const X=x+.5-hx,Y=y+.5-hy,qx=Math.abs(X)-bx,qy=Math.abs(Y)-by,ox=Math.max(qx,0),oy=Math.max(qy,0),len=Math.hypot(ox,oy),depth=-(len+Math.min(Math.max(qx,qy),0)-r);
  let nx=0,ny=0;if(len>0){nx=ox/len*Math.sign(X);ny=oy/len*Math.sign(Y)}else if(qx>qy)nx=Math.sign(X)||1;else ny=Math.sign(Y)||1;
  const t=Math.max(0,Math.min(1,1-depth/bezel)),m=t*t,i=(y*w+x)*4;   // شکست نور فقط نزدیک لبه
  px[i]=128-nx*m*127;px[i+1]=128-ny*m*127;px[i+2]=128;px[i+3]=255}
 return{data:px,w,h}}
const Liquid={n:0,ok:false,
 init(){try{const ua=navigator.userAgent;this.ok=/Chrome\//.test(ua)&&!/Edg\/|OPR\//.test(ua)&&window.CSS&&CSS.supports('backdrop-filter','blur(1px)');if(!this.ok)return;
  const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('width','0');s.setAttribute('height','0');s.style.cssText='position:absolute;pointer-events:none';document.body.appendChild(s);this.svg=s;
  document.querySelectorAll('[data-liquid]').forEach(el=>{this.apply(el);if(window.ResizeObserver)new ResizeObserver(()=>this.apply(el)).observe(el)})}catch(e){this.ok=false}},
 apply(el){try{const w=el.offsetWidth,h=el.offsetHeight;if(!w||!h)return;const key=w+'x'+h;if(el._lk===key)return;el._lk=key;
  const r=parseFloat(getComputedStyle(el).borderTopLeftRadius)||Math.min(w,h)/2,m=liquidMap(w,h,r),c=document.createElement('canvas');c.width=m.w;c.height=m.h;
  c.getContext('2d').putImageData(new ImageData(m.data,m.w,m.h),0,0);
  const id='lq'+(el._lq=el._lq||++this.n),old=this.svg.querySelector('#'+id);if(old)old.remove();
  const f=document.createElementNS('http://www.w3.org/2000/svg','filter');f.id=id;f.setAttribute('color-interpolation-filters','sRGB');
  ['x','y'].forEach(a=>f.setAttribute(a,'0'));f.setAttribute('width',m.w);f.setAttribute('height',m.h);f.setAttribute('filterUnits','userSpaceOnUse');
  f.innerHTML=`<feImage href="${c.toDataURL()}" x="0" y="0" width="${m.w}" height="${m.h}" preserveAspectRatio="none" result="map"/><feDisplacementMap in="SourceGraphic" in2="map" scale="22" xChannelSelector="R" yChannelSelector="G"/>`;
  this.svg.appendChild(f);const v=`url(#${id}) blur(0.3px) saturate(1.3)`;el.style.backdropFilter=v;el.style.webkitBackdropFilter=v}catch(e){}}};
