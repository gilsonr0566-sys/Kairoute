// Outside test screen check, read from the day as the traveler sees it (never from engine data).
// Screen check over saved day texts: (1) leave-by shown is never before a planned stop ends; (2) every lunch names a real place or says honestly to bring food.
const fs=require('fs'),path=require('path');
const T=s=>{const m=String(s||'').trim().match(/^(\d{1,2}):(\d\d)(?:\s*([ap])m)?$/i);if(!m)return null;let h=+m[1];if(m[3]){h=h%12+(m[3].toLowerCase()==='p'?12:0)}return h*60+ +m[2]};
function check(text){const L=String(text||'').split('\n');const out={};
 const i=L.indexOf('LEAVE BY');if(i<0)return null;let lb=null;for(let k=i+1;k<i+5;k++){const t=T(L[k]);if(t!=null&&!/all aboard|departs|flight|train/i.test(L[k])){lb=t;out.lbTxt=L[k];break}}
 out.lb=lb;out.stops=[];out.lunch=[];
 for(let k=0;k<L.length;k++){if(L[k]==='LEAVE'&&T(L[k+1])!=null&&/^(\d+|L)$/.test(L[k+2]||'')){const st={k:L[k+2],leave:T(L[k+1]),leaveTxt:L[k+1],name:L[k+3]||'',meta:L[k+4]||''};out.stops.push(st);if(st.k==='L')out.lunch.push(st)}
  if(L[k]==='UNTIL'&&T(L[k+1])!=null)out.until=T(L[k+1])}
 out.late=lb!=null?out.stops.filter(s=>s.leave>lb+1):[];
 out.badLunch=out.lunch.filter(s=>/lunch near |^(Quick )?lunch$|Your pick|on your own|find a place/i.test(s.name+' '+s.meta)&&!/bring|pack|picnic|no restaurant/i.test(s.name+' '+s.meta));
 return out}
module.exports={check,T};
