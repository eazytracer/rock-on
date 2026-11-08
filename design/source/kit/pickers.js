/* Rock On kit · pickers (ported from the C0 "Inputs & pickers" decision in app/spec-rows/22).
   Date  = field opens a month calendar; accent fill = selected, ring = today; typing a digit or "/" flips to MM/DD/YYYY entry.
   Time  = Google-Calendar list: every time in 15-min steps, scrolled to the current value. Typing flips to entry; a bare "6:30" offers AM / PM chips. Stored 24h.
   End   = same list starting after the start time, each with its duration in ( ). Value = duration in minutes; past midnight is allowed.
   Dur   = value with −/+ (15-min steps), click the value to type any length (2:30, 2.5, 150, 2h30); quick chips for common lengths.
   Menu  = anchored dropdown, never a native <select>. Grouped, checkmarked, optional lead (e.g. tuning pill).
   API: RP.date(id,iso) RP.time(id,hhmm) RP.end(id,startHHMM,durMin) RP.dur(id,min,quick) RP.menu(id,val,opts,ph)  → HTML strings.
   Commit fires window 'rp-change' {id,value}. Works inside any innerHTML re-render. */
(()=>{const {ic}=Rock;const p2=n=>String(n).padStart(2,'0');
const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmtD=iso=>{if(!iso)return '';const [y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})};
const fmtT=t=>{if(!t)return '';const [h,m]=t.split(':').map(Number);return `${h%12||12}:${p2(m)} ${h<12?'AM':'PM'}`};
const durG=m=>m<60?`${m} mins`:m===60?'1 hr':`${+(m/60).toFixed(2)} hrs`;
const addT=(t,m)=>{const [h,mi]=t.split(':').map(Number);const x=h*60+mi+m;return `${p2(Math.floor(x/60)%24)}:${p2(x%60)}`};
const diffT=(a,b)=>{const [h1,m1]=a.split(':').map(Number),[h2,m2]=b.split(':').map(Number);let d=h2*60+m2-(h1*60+m1);if(d<=0)d+=1440;return d};
const fmtDur=m=>{const h=Math.floor(m/60),r=m%60;return h&&r?`${h} hr ${r} min`:h?`${h} hr`:`${r} min`};
const parseD=s=>{s=s.trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/),y,mo,d;if(m){y=+m[1];mo=+m[2];d=+m[3]}else{m=s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);if(!m)return null;mo=+m[1];d=+m[2];y=m[3]?+m[3]:2026;if(y<100)y+=2000}
 const dt=new Date(y,mo-1,d);if(dt.getMonth()!==mo-1)return null;return `${y}-${p2(mo)}-${p2(d)}`};
const sugT=s=>{s=s.trim().toLowerCase().replace(/\s+/g,'');const m=s.match(/^(\d{1,2})(?::?(\d{2}))?(a|am|p|pm)?$/);if(!m)return [];const h=+m[1],mi=m[2]?+m[2]:0,ap=m[3];if(mi>59)return [];const mk=H=>`${p2(H)}:${p2(mi)}`;
 if(ap){if(h<1||h>12)return [];return [mk(h%12+(ap[0]==='p'?12:0))]}if(h>23)return [];if(h>=13||h===0)return [mk(h)];return [mk(h%12),mk(h%12+12)]};
const parseDur=s=>{s=s.trim().toLowerCase();let m;if(m=s.match(/^(\d+):(\d{1,2})$/))return +m[1]*60+ +m[2];if(m=s.match(/^(\d+)\s*h(?:r|rs|ours?)?\s*(\d+)?\s*m?(?:in)?$/))return +m[1]*60+(+m[2]||0);if(m=s.match(/^(\d+)\s*m(?:in)?$/))return +m[1];if(m=s.match(/^(\d+(?:\.\d+)?)$/)){const v=+m[1];return v<=12?Math.round(v*60):Math.round(v)}return null};
const fire=(id,value)=>window.dispatchEvent(new CustomEvent('rp-change',{detail:{id,value}}));
const RP={};
RP.date=(id,v)=>`<div class="rp" data-rp="date" data-rpid="${id}" data-val="${v||''}"><button type="button" class="rp-f">${ic('cal')}<span>${v?fmtD(v):'<i>Select date</i>'}</span>${ic('chev')}</button></div>`;
RP.time=(id,v)=>`<div class="rp" data-rp="time" data-rpid="${id}" data-val="${v||''}"><button type="button" class="rp-f">${ic('clock')}<span>${v?fmtT(v):'<i>Select time</i>'}</span>${ic('chev')}</button></div>`;
RP.end=(id,st,d)=>`<div class="rp" data-rp="end" data-rpid="${id}" data-start="${st}" data-val="${d}"><button type="button" class="rp-f">${ic('clock')}<span>${fmtT(addT(st,d))} <em class="rp-dd">(${durG(d)})</em></span>${ic('chev')}</button></div>`;
RP.dur=(id,v,quick=[60,90,120,150,180])=>`<div class="rp rp-dur" data-rp="dur" data-rpid="${id}" data-val="${v}"><div class="rp-ds"><button type="button" class="rp-st" data-rpstep="-15" aria-label="15 minutes shorter">−</button><button type="button" class="rp-dv" data-rpdtype title="Click to type any length">${fmtDur(v)}</button><button type="button" class="rp-st" data-rpstep="15" aria-label="15 minutes longer">+</button></div><div class="rp-q">${quick.map(q=>`<span class="${q===v?'on':''}" data-rpq="${q}">${q%60?(q/60).toString().replace('.5','½'):q/60} hr</span>`).join('')}</div></div>`;
RP.menu=(id,v,opts,ph)=>{const cur=opts.find(o=>o.v===v);return `<div class="rp" data-rp="menu" data-rpid="${id}" data-val="${v||''}"><button type="button" class="rp-f rp-m ${v?'set':''}">${cur&&cur.lead||''}<span>${cur?cur.l:`<i>${ph}</i>`}</span>${ic('chev')}</button><script type="application/json">${JSON.stringify(opts).replace(/</g,'\\u003c')}</script></div>`};
let OPEN=null;
const close=()=>{if(!OPEN)return;const el=OPEN;el.querySelector('.rp-pop')?.remove();el.classList.remove('open');OPEN=null;if(el.dataset.dirty){delete el.dataset.dirty;fire(el.dataset.rpid,el.dataset.val)}};
const cal=(el,y,m)=>{const v=el.dataset.val,first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),t=new Date(),ti=`${t.getFullYear()}-${p2(t.getMonth()+1)}-${p2(t.getDate())}`;
 let c='';for(let i=0;i<first;i++)c+='<i></i>';for(let d=1;d<=days;d++){const iso=`${y}-${p2(m+1)}-${p2(d)}`;c+=`<button type="button" class="${iso===v?'sel':''} ${iso===ti?'today':''}" data-rpd="${iso}">${d}</button>`}
 return `<div class="rp-cal" data-y="${y}" data-m="${m}"><div class="rp-ch"><button type="button" data-rpmo="-1" aria-label="Previous month">${ic('back')}</button><b>${MON[m]} ${y}</b><button type="button" data-rpmo="1" aria-label="Next month">${ic('chev')}</button></div><div class="rp-dw">${'SMTWTFS'.split('').map(x=>`<span>${x}</span>`).join('')}</div><div class="rp-g">${c}</div><div class="rp-hint">${ic('edit')}Start typing for MM/DD/YYYY</div></div>`};
const tlist=el=>{const end=el.dataset.rp==='end',st=el.dataset.start;let items=[];
 if(end){const d=+el.dataset.val;for(let m=15;m<=24*60;m+=15)items.push({v:String(m),t:addT(st,m),n:durG(m),sel:m===d});if(d%15)items.push({v:String(d),t:addT(st,d),n:durG(d),sel:true});items.sort((a,b)=>+a.v-+b.v)}
 else{const v=el.dataset.val;for(let m=0;m<1440;m+=15){const t=`${p2(Math.floor(m/60))}:${p2(m%60)}`;items.push({v:t,t,sel:t===v})}if(v&&!items.some(i=>i.sel))items.push({v,t:v,sel:true}),items.sort((a,b)=>a.v.localeCompare(b.v))}
 return `<div class="rp-tl" data-rpcol="h">${items.map(i=>`<button type="button" class="${i.sel?'sel':''}" data-rpt="${i.v}"><span>${fmtT(i.t)}</span>${i.n?`<em>(${i.n})</em>`:''}${i.sel?ic('check'):''}</button>`).join('')}</div><div class="rp-hint">${ic('edit')}Start typing for an exact time</div>`};
const cols=el=>{const v=el.dataset.val||'19:00',[H,M]=v.split(':').map(Number),h12=H%12||12,pm=H>=12;
 return `<div class="rp-tc"><div class="rp-col"><small>HOUR</small><div class="rp-cb" data-rpcol="h">${Array.from({length:12},(_,i)=>i+1).map(h=>`<button type="button" class="${h===h12?'sel':''}" data-rph="${h}">${p2(h)}</button>`).join('')}</div></div><div class="rp-col"><small>MIN</small><div class="rp-cb">${[0,15,30,45].map(x=>`<button type="button" class="${x===M?'sel':''}" data-rpmi="${x}">:${p2(x)}</button>`).join('')}${[0,15,30,45].includes(M)?'':`<button type="button" class="sel">:${p2(M)}</button>`}</div></div><div class="rp-col"><small>&nbsp;</small><div class="rp-ap"><button type="button" class="${pm?'':'sel'}" data-rpap="am">AM</button><button type="button" class="${pm?'sel':''}" data-rpap="pm">PM</button></div></div></div><div class="rp-hint">${ic('edit')}Start typing for an exact time</div>`};
const typing=(el,seed)=>{const k=el.dataset.rp;const pop=el.querySelector('.rp-pop');pop.innerHTML=`<div class="rp-ty"><input class="rp-in" value="${seed}" placeholder="${k==='date'?'e.g. 11/12/2026':'e.g. 6:30 or 6:30 PM'}"><div class="rp-sg"></div></div>`;const i=pop.querySelector('input');i.focus();i.setSelectionRange(i.value.length,i.value.length);
 const upd=()=>{const sg=pop.querySelector('.rp-sg');if(k==='date'){const d=parseD(i.value);sg.innerHTML=d?`<button type="button" class="rp-chip" data-rpd="${d}">${fmtD(d)}</button>`:`<span>${i.value?'Not a valid date':'MM/DD/YYYY'}</span>`}else{const s=sugT(i.value);sg.innerHTML=s.length?(s.length>1?'<span>Did you mean</span>':'')+s.map(t=>`<button type="button" class="rp-chip" data-rpt="${t}">${fmtT(t)}${k==='end'?` (${durG(diffT(el.dataset.start,t))})`:''}</button>`).join(''):`<span>${i.value?'Not a valid time':'Type a time, then pick AM or PM'}</span>`}};
 i.oninput=upd;i.onkeydown=e=>{if(e.key==='Enter'){const b=pop.querySelector('.rp-chip');if(b)b.click()}else if(e.key==='Escape')close()};upd()};
const open=el=>{close();OPEN=el;el.classList.add('open');const k=el.dataset.rp;let h='';
 if(k==='date'){const v=el.dataset.val;const [y,m]=v?v.split('-').map(Number):[2026,11];h=cal(el,y,m-1)}
 else if(k==='time'||k==='end')h=tlist(el);
 else if(k==='menu'){const o=JSON.parse(el.querySelector('script').textContent),v=el.dataset.val;let g=null;h='<div class="rp-mn">'+o.map(x=>{let s='';if(x.g&&x.g!==g){g=x.g;s+=`<div class="rp-mg">${g}</div>`}return s+`<button type="button" class="${x.v===v?'sel':''}" data-rpv="${x.v}">${x.lead||''}<span>${x.l}</span>${x.n!=null?`<em>${x.n}</em>`:''}${x.v===v?ic('check'):''}</button>`}).join('')+'</div>'}
 el.insertAdjacentHTML('beforeend',`<div class="rp-pop rp-${k==='end'?'time':k}">${h}</div>`);const sel=el.querySelector('[data-rpcol="h"] .sel')||el.querySelector('[data-rpcol="h"] button');if(sel)sel.parentNode.scrollTop=sel.offsetTop-110};
document.addEventListener('click',e=>{const t=e.target,c=s=>t.closest(s);let x;const el=c('.rp');
 if(!el){if(OPEN&&!c('.rp-pop'))close();return}
 e.stopPropagation();const id=el.dataset.rpid,k=el.dataset.rp;
 if(k==='dur'){const v=+el.dataset.val;if(x=c('[data-rpstep]')){fire(id,Math.max(15,v+(+x.dataset.rpstep)));return}if(x=c('[data-rpq]')){fire(id,+x.dataset.rpq);return}
  if(c('[data-rpdtype]')&&!el.querySelector('.rp-in')){const b=el.querySelector('[data-rpdtype]');b.outerHTML=`<input class="rp-dv rp-in" value="${Math.floor(v/60)}:${p2(v%60)}" aria-label="Length, e.g. 2:30">`;const i=el.querySelector('.rp-in');i.focus();i.select();const done=()=>{const n=parseDur(i.value);if(n&&n>0&&n<=24*60)fire(id,n);else fire(id,v)};i.onkeydown=e2=>{if(e2.key==='Enter')done();if(e2.key==='Escape')fire(id,v)};i.onblur=done}return}
 if(c('.rp-f')){OPEN===el?close():open(el);return}
 if(x=c('[data-rpmo]')){const cl=el.querySelector('.rp-cal');let y=+cl.dataset.y,m=+cl.dataset.m+(+x.dataset.rpmo);if(m<0){m=11;y--}if(m>11){m=0;y++}el.querySelector('.rp-pop').innerHTML=cal(el,y,m);return}
 if(x=c('[data-rpd]')){close();fire(id,x.dataset.rpd);return}
 if(x=c('[data-rpt]')){const v=x.dataset.rpt;close();fire(id,k==='end'&&v.includes(':')?diffT(el.dataset.start,v):k==='end'?+v:v);return}
 if(x=c('[data-rpv]')){close();fire(id,x.dataset.rpv);return}
 },true);
document.addEventListener('keydown',e=>{if(!OPEN||e.target.matches('.rp-in'))return;if(e.key==='Escape'){close();return}const k=OPEN.dataset.rp;
 if((k==='date'&&/^[0-9/]$/.test(e.key))||((k==='time'||k==='end')&&/^[0-9apAP:]$/.test(e.key))){e.preventDefault();typing(OPEN,e.key)}});
Object.assign(RP,{fmtD,fmtT,fmtDur,durG,addT,close});window.RP=RP;
})();
