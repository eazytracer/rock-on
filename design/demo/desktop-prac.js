// New practice editor (Duplicate opens it prefilled). Uses kit pickers (C0) + the song browser
// ported from the app's BrowseSongs: search · tuning · setlist · artist filters · sort · add all from a setlist · tap to add / remove.
(()=>{const {S,V,app,render,head,SETS,EV,byId,toast}=DK,{ic,btn,tp,T}=Rock;const {SONGS}=DD;
const DOW=['SUN','MON','TUE','WED','THU','FRI','SAT'];const p2=n=>String(n).padStart(2,'0');
const dateOf=e=>new Date(2026,e.m==='OCT'?9:e.m==='NOV'?10:11,+e.d);
const iso=d=>`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
const cap=s=>s[0]+s.slice(1).toLowerCase();
const PSONGS={p1:['mw','bl','aer','ev']};
let PN=null;const B={on:false,q:'',tun:'',set:'',art:'',sort:'title'};
const open=src=>{let d=new Date(2026,10,5),songs=[],from='',focus='',title='',dur=120;
 if(src){const e=EV.find(x=>x.id===src);d=dateOf(e);d.setDate(d.getDate()+7);songs=[...(PSONGS[src]||PSONGS.p1)];from=`${e.t} · ${cap(e.dw)} ${cap(e.m)} ${e.d}`;focus='Run the Fall Set openers. Tighten the Monkey Wrench breakdown.';title=e.t;dur=e.dur||120}
 PN={src,from,title,date:iso(d),time:'19:00',dur,place:"Mike's Garage",focus,songs};Object.assign(B,{on:!src,q:'',tun:'',set:'',art:''});S.v='pracnew';render()};
const endT=()=>{const [h,m]=PN.time.split(':').map(Number);const t=h*60+m+PN.dur;const H=Math.floor(t/60)%24;return `${H%12||12}:${p2(t%60)} ${H<12?'AM':'PM'}${t>=1440?' next day':''}`};
const secs=d=>{const [m,s]=d.split(':').map(Number);return m*60+s};
const mins=()=>Math.round(PN.songs.reduce((a,id)=>a+(byId(id)?secs(byId(id).dur):0),0)/60);
const pool=()=>S.ctx==='band'?SONGS.filter(s=>!s.mine):SONGS;
const browser=()=>{const inS=new Set(PN.songs);const P=pool();
 const sl=B.set?SETS.find(s=>s.id===B.set):null,slIds=sl?new Set(sl.items.filter(x=>typeof x==='string')):null;
 let list=P.filter(s=>(!B.q||(s.title+' '+s.artist).toLowerCase().includes(B.q.toLowerCase()))&&(!B.tun||s.tun===B.tun)&&(!slIds||slIds.has(s.id))&&(!B.art||s.artist===B.art));
 list.sort((a,b)=>B.sort==='artist'?a.artist.localeCompare(b.artist)||a.title.localeCompare(b.title):B.sort==='tun'?a.tun.localeCompare(b.tun):a.title.localeCompare(b.title));
 const tuns=[...new Set(P.map(s=>s.tun))].filter(k=>T[k]);const arts=[...new Set(P.map(s=>s.artist))].sort();
 const addable=sl?[...slIds].filter(id=>!inS.has(id)&&byId(id)):[];
 const filt=B.q||B.tun||B.set||B.art;
 return `<div class="brw"><div class="brh"><b>Add songs</b><span></span>${btn('Done',{kind:'pri',icon:'check',attr:'data-bdone'})}</div>
<div class="fs">${ic('search')}<input data-bq placeholder="Search title or artist" value="${B.q}"></div>
<div class="brf">${RP.menu('b-tun',B.tun,[{v:'',l:'All tunings'},...tuns.map(k=>({v:k,l:T[k].name,lead:tp(k,'sm'),n:P.filter(s=>s.tun===k).length}))],'Tuning')}${RP.menu('b-set',B.set,[{v:'',l:'All setlists'},...SETS.map(s=>({v:s.id,l:s.name,n:s.items.filter(x=>typeof x==='string').length}))],'Setlist')}${RP.menu('b-art',B.art,[{v:'',l:'All artists'},...arts.map(a=>({v:a,l:a,n:P.filter(s=>s.artist===a).length}))],'Artist')}${RP.menu('b-sort',B.sort,[{v:'title',l:'Sort: Title',g:'Sort'},{v:'artist',l:'Sort: Artist',g:'Sort'},{v:'tun',l:'Sort: Tuning',g:'Sort'}],'Sort')}</div>
<div class="brc">${filt?`<span>Showing <b>${list.length}</b> of ${P.length} songs</span><span class="r-btn text" data-bclr>Clear filters</span>`:`<span>All ${P.length} songs</span>`}</div>
${sl&&addable.length?`<div class="badd" data-baddall>${ic('list')}<span>Add all from <b>${sl.name}</b></span><em>${addable.length}</em></div>`:''}
<div class="brl">${list.length?list.map(s=>{const a=inS.has(s.id);return `<div class="brr ${a?'in':''}" data-btog="${s.id}" title="${a?'Click to remove':'Click to add'}"><div class="g"><b>${s.title}</b><small>${s.artist}${s.mine?' · <span class="mn">MY SONG</span>':''}</small></div>${tp(s.tun,'sm')}<span class="du">${s.dur}</span><span class="ck">${a?ic('check'):ic('plus')}</span></div>`}).join(''):`<div class="pempty">No songs match. ${filt?'<span class="r-btn text" data-bclr>Clear filters</span>':''}</div>`}</div></div>`};
V.pracnew=()=>{const p=PN;
 const left=`<div class="pane"><div class="pnf">${p.from?`<div class="pfrom">${ic('copy')}<span>Copied from <b>${p.from}</b>. Change anything; the original stays as it was.</span></div>`:''}
<div class="pfl"><label>Name <em>optional</em></label><input data-pf="title" value="${p.title}" placeholder="Falls back to the date"></div>
<div class="pfl"><label>Date</label>${RP.date('p-date',p.date)}</div>
<div class="prow2"><div class="pfl"><label>Start</label>${RP.time('p-time',p.time)}</div><div class="pfl"><label>End</label>${RP.end('p-end',p.time,p.dur)}</div></div>
<div class="pfl"><label>Where</label><input data-pf="place" value="${p.place}"></div>
<div class="pfl"><label>Focus</label><textarea data-pf="focus" rows="3" placeholder="What do you want to get out of this one?">${p.focus}</textarea></div></div></div>`;
 const rows=p.songs.length?p.songs.map((id,i)=>{const s=byId(id);return `<div class="psr"><span class="n">${i+1}</span><div class="g"><b>${s.title}</b><small>${s.artist}</small></div>${tp(s.tun,'sm')}<span class="du">${s.dur}</span><span class="ib2" data-pmv="${i}:-1" title="Move up">${ic('up')}</span><span class="ib2" data-pmv="${i}:1" title="Move down">${ic('down')}</span><span class="ib2 x" data-prm="${i}" title="Remove">${ic('x')}</span></div>`}).join(''):`<div class="pempty">No songs yet.</div>`;
 const right=`<div class="pane"><div class="pnf"><div class="psh"><b>Songs</b><span>${p.songs.length} · ${mins()} of ${Math.round(p.dur)} min</span>${B.on?'':`<div class="pact">${btn('Add songs',{icon:'plus',attr:'data-bopen'})}</div>`}</div><div class="psl">${rows}</div>${B.on?browser():''}</div></div>`;
 return head(p.src?'Duplicate practice':'Calendar','New practice',null,btn('Cancel',{attr:'data-v="calendar"'})+btn('Save practice',{kind:'pri',icon:'check',attr:'data-psave'}))+`<div class="split pnw">${left}${right}</div>`};
const save=()=>{const d=new Date(PN.date+'T00:00');const [h,m]=PN.time.split(':').map(Number);
 const ne={id:'p'+Date.now(),m:d.toLocaleDateString('en-US',{month:'short'}).toUpperCase(),d:String(d.getDate()),dw:DOW[d.getDay()],t:PN.title||d.toLocaleDateString('en-US',{weekday:'long'})+' practice',sub:`${h%12||12}:${p2(m)} ${h<12?'AM':'PM'} · ${PN.place}`,ty:'prac',dur:PN.dur};
 PSONGS[ne.id]=[...PN.songs];EV.push(ne);EV.sort((x,y)=>dateOf(x)-dateOf(y));S.ev=ne.id;S.v='calendar';render();toast('Practice saved · '+RP.fmtD(PN.date))};
window.addEventListener('rp-change',e=>{const {id,value}=e.detail;if(!PN||S.v!=='pracnew')return;
 if(id==='p-date')PN.date=value;else if(id==='p-time')PN.time=value;else if(id==='p-end')PN.dur=+value;
 else if(id==='b-tun')B.tun=value;else if(id==='b-set')B.set=value;else if(id==='b-art')B.art=value;else if(id==='b-sort')B.sort=value;else return;render()});
app.addEventListener('click',e=>{const t=e.target,c=s=>t.closest(s);let x;const st=()=>e.stopPropagation();
 if(x=c('[data-dup]')){st();open(x.dataset.dup);return}
 if(c('[data-pnew]')){st();open(null);return}
 if(S.v!=='pracnew')return;
 if(c('[data-bopen]')){st();B.on=true;render();app.querySelector('[data-bq]')?.focus();return}
 if(c('[data-bdone]')){st();B.on=false;render();return}
 if(c('[data-bclr]')){st();Object.assign(B,{q:'',tun:'',set:'',art:''});render();return}
 if(c('[data-baddall]')){st();const sl=SETS.find(s=>s.id===B.set);const ids=sl.items.filter(z=>typeof z==='string'&&!PN.songs.includes(z)&&byId(z));PN.songs.push(...ids);render();toast(`Added ${ids.length} from ${sl.name}`);return}
 if(x=c('[data-btog]')){st();const id=x.dataset.btog,i=PN.songs.indexOf(id);if(i<0){PN.songs.push(id);toast(`Added ${byId(id).title}`)}else{PN.songs.splice(i,1);toast(`Removed ${byId(id).title}`)}render();return}
 if(x=c('[data-prm]')){st();PN.songs.splice(+x.dataset.prm,1);render();return}
 if(x=c('[data-pmv]')){st();const [i,d]=x.dataset.pmv.split(':').map(Number),k=i+d;if(k<0||k>=PN.songs.length)return;[PN.songs[i],PN.songs[k]]=[PN.songs[k],PN.songs[i]];render();return}
 if(c('[data-psave]')){st();save()}},true);
app.addEventListener('input',e=>{if(!PN||S.v!=='pracnew')return;
 if(e.target.matches('[data-pf]')){PN[e.target.dataset.pf]=e.target.value;return}
 if(e.target.matches('[data-bq]')){B.q=e.target.value;const pos=e.target.selectionStart;render();const q=app.querySelector('[data-bq]');q.focus();q.setSelectionRange(pos,pos)}});
})();
