// تبدیل تاریخ شمسی ⇄ میلادی (الگوریتم jalaali)
const J=(()=>{
 const g2j=(gy,gm,gd)=>{const gdm=[0,31,59,90,120,151,181,212,243,273,304,334];let jy=gy<=1600?0:979;gy-=gy<=1600?621:1600;
  const gy2=gm>2?gy+1:gy;let days=365*gy+Math.floor((gy2+3)/4)-Math.floor((gy2+99)/100)+Math.floor((gy2+399)/400)-80+gd+gdm[gm-1];
  jy+=33*Math.floor(days/12053);days%=12053;jy+=4*Math.floor(days/1461);days%=1461;
  if(days>365){jy+=Math.floor((days-1)/365);days=(days-1)%365}
  return[jy,days<186?1+Math.floor(days/31):7+Math.floor((days-186)/30),1+(days<186?days%31:(days-186)%30)]};
 const j2g=(jy,jm,jd)=>{jy+=1595;let days=-355668+365*jy+Math.floor(jy/33)*8+Math.floor(((jy%33)+3)/4)+jd+(jm<7?(jm-1)*31:(jm-7)*30+186);
  let gy=400*Math.floor(days/146097);days%=146097;
  if(days>36524){gy+=100*Math.floor(--days/36524);days%=36524;if(days>=365)days++}
  gy+=4*Math.floor(days/1461);days%=1461;if(days>365){gy+=Math.floor((days-1)/365);days=(days-1)%365}
  let gd=days+1;const sa=[0,31,(gy%4==0&&gy%100!=0)||gy%400==0?29:28,31,30,31,30,31,31,30,31,30,31];let gm;
  for(gm=0;gm<13&&gd>sa[gm];gm++)gd-=sa[gm];return[gy,gm,gd]};
 const pad=n=>String(n).padStart(2,'0'),fad=s=>String(s).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
 return{g2j,j2g,
  today(){const d=new Date();return g2j(d.getFullYear(),d.getMonth()+1,d.getDate())},
  ago(n){const d=new Date();d.setDate(d.getDate()-n);return g2j(d.getFullYear(),d.getMonth()+1,d.getDate())},
  str:a=>a[0]+'/'+pad(a[1])+'/'+pad(a[2]),fa:a=>fad(a[0]+'/'+pad(a[1])+'/'+pad(a[2])),fad,
  ts(a,h=12,m=0){const g=j2g(a[0],a[1],a[2]);return new Date(g[0],g[1]-1,g[2],h,m).getTime()}}})();
