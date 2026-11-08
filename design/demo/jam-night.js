// Rock On · Jam Night: a working prototype of one jam, start to finish.
// Host plans a jam, guests join with the code (app, web or the counter iPad), pitch songs and raise hands,
// the host goes live and runs the queue, the bar TV rotates. State lives in localStorage and syncs across
// tabs of this browser (BroadcastChannel), so a host window and guest windows can run side by side.
// Data shape follows design_handoff_rock_on_refresh/DATA-IMPLICATIONS.md → Jams.
(()=>{const {ic,tp}=Rock;
const app=document.getElementById('app');
const KEY='rockon-jamnight-v1',ME='rockon-jamnight-me';
const PARTS=['Vox','Gtr','Bass','Drums','Keys'];const PN={Vox:'Vocals',Gtr:'Guitar',Bass:'Bass',Drums:'Drums',Keys:'Keys'};
const COL=['#ff9a4d','#6cb8ff','#c58bff','#4ade80','#facc15','#f472b6','#2dd4bf','#e5e5e5'];
const uid=()=>Math.random().toString(36).slice(2,9);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const btn=(l,o={})=>`<button type="button" class="r-btn ${o.k||''} ${o.s||''}" ${o.a||''} ${o.dis?'disabled':''}>${o.i?ic(o.i):''}${l}</button>`;
const av=(p,sz=32)=>{if(!p)return '';const c=COL[[...p.name].reduce((a,ch)=>a+ch.charCodeAt(0),0)%COL.length];return `<span class="jav" style="--c:${c};width:${sz}px;height:${sz}px;font-size:${Math.round(sz*.42)}px" aria-hidden="true">${esc(p.name[0]).toUpperCase()}</span>`};
const t12=t=>{const [h,m]=t.split(':').map(Number);return `${h%12||12}${m?':'+String(m).padStart(2,'0'):''} ${h<12?'AM':'PM'}`};
const fmtDate=d=>new Date(d+'T00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const code=n=>(n.replace(/[^a-z]/gi,'').slice(0,4)||'JAM').toUpperCase()+'-'+(10+Math.floor(Math.random()*89));

// ---------- seed ----------
const person=(name,parts,via='app',o={})=>Object.assign({id:uid(),name,parts,via},o);
const seed=()=>{const P={eric:person('Eric',['Gtr','Vox'],'app',{host:1}),dana:person('Dana',['Bass','Vox']),kai:person('Kai',['Drums'],'web'),tom:person('Tom',['Gtr']),lena:person('Lena',['Vox','Gtr']),mike:person('Mike',['Bass'],'app',{house:1}),sarah:person('Sarah',['Drums'],'app',{house:1}),frank:person('Frank',['Vox','Gtr'],'walkup')};
 const pitch=(song,artist,by,parts,st='open')=>({id:uid(),song,artist,by:by.id,parts,cast:{},state:st,at:Date.now()});
 const j={id:uid(),name:'Tuesday Open Jam',date:'2026-11-03',time:'20:00',where:"Lucky's Tavern",code:'LUCK-42',status:'planned',who:'code',requests:true,approve:false,group:0,nudge:null,
  people:Object.values(P),
  pitches:[pitch('Black','Pearl Jam',P.eric,{Vox:[P.eric.id],Gtr:[P.tom.id],Bass:[P.dana.id],Drums:[]}),
   pitch('Interstate Love Song','Stone Temple Pilots',P.dana,{Vox:[],Gtr:[P.eric.id],Bass:[P.dana.id],Drums:[P.kai.id]}),
   pitch('Seven Nation Army','The White Stripes',P.lena,{Vox:[P.lena.id],Gtr:[P.lena.id],Drums:[P.kai.id]}),
   pitch('Mustang Sally','Wilson Pickett',P.frank,{Vox:[P.frank.id],Gtr:[P.frank.id],Bass:[],Drums:[],Keys:[]})],queue:[],stage:null,log:[]};
 return {v:1,jams:[j],cur:j.id}};
let S;const load=()=>{try{S=JSON.parse(localStorage.getItem(KEY))}catch(_){S=null}if(!S||S.v!==1)S=seed()};
let bc=null;try{bc=new BroadcastChannel(KEY)}catch(_){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(_){}bc&&bc.postMessage('x');render()};
const sync=()=>{load();render()};
if(bc)bc.onmessage=sync;window.addEventListener('storage',e=>{if(e.key===KEY)sync()});
load();
// local (per tab) UI state
const U={role:(location.hash.slice(1).split('&')[0])||'host',view:'hub',tab:'lineup',side:'hands',hj:{name:'',date:'2026-11-17',time:'20:00',where:''},walk:null,pitch:null,hand:null,kio:{name:'',parts:[],pitch:'',done:false},join:{code:'',name:'',parts:[]},tv:0,confirm:null,sim:false,toast:''};
const qcode=(location.hash.match(/code=([A-Z0-9-]+)/i)||[])[1];if(qcode)U.join.code=qcode.toUpperCase();
const me=()=>{try{return JSON.parse(sessionStorage.getItem(ME))}catch(_){return null}};
const setMe=v=>{try{v?sessionStorage.setItem(ME,JSON.stringify(v)):sessionStorage.removeItem(ME)}catch(_){}};
const J=()=>S.jams.find(j=>j.id===S.cur)||S.jams[0];
const P=(j,id)=>j.people.find(p=>p.id===id);
const cov=p=>{const ks=Object.keys(p.parts);return {f:ks.filter(k=>p.parts[k].length).length,n:ks.length}};
const open=p=>Object.keys(p.parts).filter(k=>!p.parts[k].length);
const castOf=(j,p)=>{const c={};Object.keys(p.parts).forEach(k=>{const id=p.cast[k]&&p.parts[k].includes(p.cast[k])||p.cast[k]&&P(j,p.cast[k])?.house?p.cast[k]:p.parts[k][0];c[k]=id||null});return c};
let tt;const toast=m=>{U.toast=m;clearTimeout(tt);tt=setTimeout(()=>{U.toast='';render()},2400);render()};
const log=(j,m)=>{j.log.unshift({m,at:Date.now()});j.log=j.log.slice(0,30)};

// ---------- shared bits ----------
const partChip=(j,p,k,o={})=>{const ids=p.parts[k];const c=castOf(j,p)[k];const who=c&&P(j,c);const mine=o.me&&ids.includes(o.me);
 return `<span class="pc ${ids.length?'f':''} ${mine?'me':''}" title="${PN[k]}: ${ids.length?ids.map(i=>esc(P(j,i)?.name)).join(', '):'open'}">${k}${who?` · ${esc(who.name)}`:''}${ids.length>1?`<em>+${ids.length-1}</em>`:''}</span>`};
const ptitle=(j,p)=>`<b>${esc(p.song)}</b><small>${esc(p.artist)} · pitched by ${esc(P(j,p.by)?.name||'someone')}</small>`;
const covBar=p=>{const c=cov(p);return `<span class="cov" aria-label="${c.f} of ${c.n} parts covered"><b>${c.f}/${c.n}</b>${Array.from({length:c.n},(_,i)=>`<i class="${i<c.f?'on':''}"></i>`).join('')}</span>`};
const qr=(sz=104)=>`<div class="qr" style="width:${sz}px;height:${sz}px" role="img" aria-label="QR code placeholder"><i>${ic('hand')}</i></div>`;
const ranked=j=>j.pitches.filter(p=>p.state==='open'||p.state==='pending').sort((a,b)=>{const A=cov(a),B=cov(b);return (B.f/B.n)-(A.f/A.n)||a.at-b.at});
const whenL=j=>`${fmtDate(j.date)} · ${t12(j.time)}${j.where?' · '+esc(j.where):''}`;

// ---------- top bar ----------
const ROLES=[['host','Host'],['guest','Guest'],['tv','Bar TV'],['kiosk','Counter iPad']];
const bar=()=>`<header class="jbar"><div class="wm"><span class="nut"></span>Rock On<em>Jam night · working prototype</em></div>
<nav class="r-seg roles" aria-label="Role">${ROLES.map(([k,l])=>`<button type="button" class="${U.role===k?'on':''}" data-act="role" data-arg="${k}" aria-pressed="${U.role===k}">${l}</button>`).join('')}</nav>
<div class="bt">${btn('Open a guest window',{i:'open',a:`data-act="newwin" title="Opens the guest view in a new window that shares this jam"`})}${btn('Reset',{k:'text',a:'data-act="reset"'})}</div></header>`;

// ---------- HOST ----------
const hub=()=>{const L=S.jams;return `<div class="pg"><div class="ph"><div><small class="r-label">Jam</small><h1 class="r-d">Your jams</h1></div><div class="act">${btn('Host a jam',{k:'pri',i:'plus',a:'data-act="hnew"'})}</div></div>
${L.length?`<div class="grp">${L.map(j=>`<button type="button" class="row" data-act="openjam" data-arg="${j.id}"><span class="db"><small>${new Date(j.date+'T00:00').toLocaleDateString('en-US',{month:'short'}).toUpperCase()}</small><b>${new Date(j.date+'T00:00').getDate()}</b></span><span class="g"><b>${esc(j.name)}</b><small>${whenL(j)} · ${j.people.length} people · ${j.pitches.length} songs pitched</small></span>${j.status==='live'?'<span class="lv"><i></i>LIVE</span>':j.status==='ended'?'<span class="r-label">ENDED</span>':'<span class="r-ty evt">'+ic('party')+'PLANNED</span>'}${ic('chev')}</button>`).join('')}</div>`
:`<div class="empty">${ic('party')}<b>No jams yet</b><p>Host one in two fields: a name and a time. Lineup, requests and access come after.</p>${btn('Host a jam',{k:'pri',i:'plus',a:'data-act="hnew"'})}</div>`}
<p class="note">Never required: walk-ups go in by name, guests can use the web without an account, and "just tell the host" always works.</p></div>`};
const hnew=()=>{const h=U.hj;return `<div class="pg narrow">${btn('Jam',{k:'back',i:'back',a:'data-act="hub"'})}<div class="ph"><div><small class="r-label">Jam</small><h1 class="r-d">Host a jam</h1></div></div>
<label class="fl"><span>Name <em>required</em></span><input class="big" data-f="hj.name" value="${esc(h.name)}" placeholder="e.g. Tuesday Open Jam" autocomplete="off"></label>
<div class="two"><label class="fl"><span>Date</span><input type="date" data-f="hj.date" value="${h.date}"></label><label class="fl"><span>Start</span><input type="time" data-f="hj.time" value="${h.time}" step="900"></label></div>
<label class="fl"><span>Where <em>optional</em></span><input data-f="hj.where" value="${esc(h.where)}" placeholder="Bar, garage, living room…"></label>
<p class="note">You get a join code and QR straight away. Who can join, requests, approvals and group sets live on the jam's page.</p>
<div class="dock">${btn('Create jam',{k:'pri',s:'lg',dis:!h.name.trim(),a:'data-act="hcreate"'})}</div>
<p class="note small">(The real app uses the kit's date and time pickers; this prototype uses the browser's.)</p></div>`};
const access=j=>`<div class="card acc">${qr()}<div class="g"><small class="r-label">Join code</small><b class="code">${j.code}</b><small>rockon.band/j/${j.code}</small><div class="btns">${btn('Copy link',{i:'copy',a:'data-act="copy"'})}${btn('Guest window',{i:'open',a:'data-act="newwin"'})}</div></div></div>`;
const settings=j=>`<div class="card"><div class="set"><span class="g"><b>Who can join</b><small>${j.who==='code'?'Anyone with the code or QR':'Friends and bandmates only'}</small></span><div class="r-seg sm">${[['code','Code'],['friends','Friends']].map(([k,l])=>`<button type="button" class="${j.who===k?'on':''}" data-act="jset" data-arg="who:${k}">${l}</button>`).join('')}</div></div>
${[['requests','Song requests','Guests pitch songs with the parts they need'],['approve','Approve requests myself',j.approve?'New pitches wait in Requests for you':'New pitches are open straight away'],['group','Suggest groups of 3','Shown as "song 2 of 3". Never blocks a single-song pitch.']].map(([k,l,d])=>`<button type="button" class="set" data-act="jtog" data-arg="${k}" role="switch" aria-checked="${!!j[k]}"><span class="g"><b>${l}</b><small>${d}</small></span><span class="r-sw ${j[k]?'on':''}"></span></button>`).join('')}</div>`;
const sim=j=>`<div class="card simc"><div class="simh"><b>${ic('people')}Simulate the room</b><small>For testing alone. Each button acts as a guest would.</small></div><div class="btns">${btn('3 people arrive',{a:'data-act="sim" data-arg="arrive"'})}${btn('Someone pitches a song',{a:'data-act="sim" data-arg="pitch"'})}${btn('Someone raises a hand',{a:'data-act="sim" data-arg="hand"'})}${btn('Walk-up at the counter',{a:'data-act="sim" data-arg="kiosk"'})}</div></div>`;
const pitchRow=(j,p,o={})=>`<div class="pr ${p.state==='pending'?'pend':''}"><div class="g">${ptitle(j,p)}<div class="pcs">${Object.keys(p.parts).map(k=>partChip(j,p,k)).join('')}</div></div><div class="ra">${covBar(p)}<div class="btns">${p.state==='pending'?btn('Approve',{k:'pri',a:`data-act="approve" data-arg="${p.id}"`})+btn('Decline',{a:`data-act="decline" data-arg="${p.id}"`}):btn(o.live?'Add to queue':'Add to lineup',{k:o.live?'pri':'',i:'plus',a:`data-act="queue" data-arg="${p.id}"`})}</div></div></div>`;
const qRow=(j,p,i,o={})=>`<div class="qr2" data-qid="${p.id}"><span class="n">${i+1}</span><div class="g">${ptitle(j,p)}<div class="pcs">${Object.keys(p.parts).map(k=>partChip(j,p,k)).join('')}</div></div><div class="qa" role="group" aria-label="Queue actions for ${esc(p.song)}">
<button type="button" class="ibx" data-act="qmove" data-arg="${p.id}:-1" aria-label="Move up">${ic('up')}</button><button type="button" class="ibx" data-act="qmove" data-arg="${p.id}:1" aria-label="Move down">${ic('down')}</button>${o.live?`<button type="button" class="ibx" data-act="qnext" data-arg="${p.id}" aria-label="Make up next">${ic('arrow')}</button><button type="button" class="ibx" data-act="qset" data-arg="${p.id}:left" aria-label="They left">${ic('out')}</button>`:''}<button type="button" class="ibx" data-act="qset" data-arg="${p.id}:removed" aria-label="Remove from queue">${ic('x')}</button></div></div>`;
const planned=j=>{const Q=j.queue.map(id=>j.pitches.find(p=>p.id===id)).filter(Boolean);const R=ranked(j);const pend=R.filter(p=>p.state==='pending').length;
 const tabs=[['lineup',`Lineup · ${Q.length}`],['requests',`Requests · ${R.length}${pend?` (${pend} new)`:''}`],['people',`People · ${j.people.length}`]];
 let body='';
 if(U.tab==='lineup')body=Q.length?`<div class="grp">${Q.map((p,i)=>qRow(j,p,i)).join('')}</div>`:`<div class="empty sm">${ic('list')}<b>No one on the lineup yet</b><p>Add songs from Requests, ranked by how many parts are covered. Or add a walk-up.</p></div>`;
 if(U.tab==='requests')body=R.length?`<p class="hint">Ranked by coverage: songs closest to a full band come first.</p><div class="grp">${R.map(p=>pitchRow(j,p)).join('')}</div>`:`<div class="empty sm">${ic('music')}<b>No requests yet</b><p>Guests pitch songs with the parts they need. They show up here.</p></div>`;
 if(U.tab==='people')body=`<div class="grp">${j.people.map(p=>`<div class="pp">${av(p,36)}<div class="g"><b>${esc(p.name)}${p.host?' <span class="tag hs">HOST</span>':''}${p.house?' <span class="tag">HOUSE</span>':''}${p.via==='walkup'?' <span class="tag wk">WALK-UP</span>':''}${p.via==='kiosk'?' <span class="tag wk">COUNTER</span>':''}</b><small>${p.parts.map(k=>PN[k]).join(', ')}${p.via==='web'?' · on the web, no account':''}</small></div>${p.host?'':`<button type="button" class="r-chip ${p.house?'on':''}" data-act="house" data-arg="${p.id}" aria-pressed="${!!p.house}">House player</button>`}</div>`).join('')}</div>`;
 return `<div class="pg wide">${btn('Jam',{k:'back',i:'back',a:'data-act="hub"'})}<div class="ph"><div><small class="r-label">Jam · ${whenL(j)}</small><h1 class="r-d">${esc(j.name)}</h1></div><div class="act">${btn('Walk-up',{i:'plus',a:'data-act="walk"'})}${btn('Bar TV',{i:'tv',a:'data-act="role" data-arg="tv"'})}${btn('Go live',{k:'pri',i:'play',a:'data-act="golive"'})}</div></div>
<div class="cols"><main><div class="r-seg tabs" role="tablist">${tabs.map(([k,l])=>`<button type="button" role="tab" aria-selected="${U.tab===k}" class="${U.tab===k?'on':''}" data-act="tab" data-arg="${k}">${l}</button>`).join('')}</div>${body}</main>
<aside><small class="r-label">Access</small>${access(j)}<small class="r-label">Settings</small>${settings(j)}${sim(j)}</aside></div></div>`};
const live=j=>{const Q=j.queue.map(id=>j.pitches.find(p=>p.id===id)).filter(Boolean);const st=j.stage&&j.pitches.find(p=>p.id===j.stage);const nx=Q[0];const R=ranked(j);
 const nxCard=nx?(()=>{const c=castOf(j,nx);const op=Object.keys(nx.parts).filter(k=>!c[k]);return `<div class="next"><small class="r-label">Up next</small><h2>${esc(nx.song)}</h2><div class="ar">${esc(nx.artist)}</div>
 <div class="slots">${Object.keys(nx.parts).map(k=>{const who=c[k]&&P(j,c[k]);const vols=nx.parts[k];return `<div class="slot ${who?'':'open'}"><small>${PN[k]}</small>${who?`${av(who,26)}<b>${esc(who.name)}</b>${vols.length>1?`<button type="button" class="r-btn text sm" data-act="swap" data-arg="${nx.id}:${k}">Swap</button>`:''}`:`<b>Open</b><div class="fill">${vols.length?'':j.people.some(p=>p.house&&p.parts.includes(k))?btn('House',{s:'sm',a:`data-act="fillhouse" data-arg="${nx.id}:${k}"`}):''}${btn('Ask the room',{s:'sm',a:`data-act="ask" data-arg="${nx.id}:${k}"`})}</div>`}</div>`}).join('')}</div>
 <div class="go">${btn(op.length?`Call up anyway · ${op.length} open`:'Call them up',{k:'pri',s:'xl',i:'arrow',a:`data-act="callup" data-arg="${nx.id}"`})}${btn('Skip',{s:'xl',a:`data-act="skip" data-arg="${nx.id}"`})}</div></div>`})()
 :`<div class="next quiet"><small class="r-label">Queue empty</small><h2>Stage is quiet</h2><p>Add the best-covered pitch, or nudge the room.</p><div class="go">${R[0]?btn(`Queue ${esc(R[0].song)}`,{k:'pri',s:'lg',i:'plus',a:`data-act="queue" data-arg="${R[0].id}"`}):''}${btn('Ask the room',{s:'lg',i:'bell',a:'data-act="ask" data-arg=":"'})}</div></div>`;
 const side={hands:`<div class="grp">${R.length?R.map(p=>pitchRow(j,p,{live:1})).join(''):'<div class="emp2">No open pitches. Guests can pitch from their phones.</div>'}</div>`,
  people:`<div class="grp">${j.people.map(p=>`<div class="pp">${av(p,30)}<div class="g"><b>${esc(p.name)}${p.house?' <span class="tag">HOUSE</span>':''}</b><small>${p.parts.map(k=>PN[k]).join(', ')}</small></div></div>`).join('')}</div>`,
  log:`<div class="grp">${j.log.length?j.log.map(l=>`<div class="lg">${esc(l.m)}<small>${new Date(l.at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</small></div>`).join(''):'<div class="emp2">Nothing yet. Nothing has to be logged, either.</div>'}</div>`}[U.side];
 return `<div class="pg wide">${btn('Jam',{k:'back',i:'back',a:'data-act="hub"'})}<div class="ph"><div><small class="r-label"><span class="lv"><i></i>LIVE</span> · ${esc(j.where||'')} · ${j.people.length} here</small><h1 class="r-d">${esc(j.name)}</h1></div><div class="act">${btn('Walk-up',{i:'plus',a:'data-act="walk"'})}${btn('Bar TV',{i:'tv',a:'data-act="role" data-arg="tv"'})}${btn('End jam',{a:'data-act="end"'})}</div></div>
<div class="cols"><main><div class="stage">${ic('music')}<div class="g"><small class="r-label">On stage</small>${st?`<b>${esc(st.song)}</b><small>${Object.entries(castOf(j,st)).filter(([,v])=>v).map(([k,v])=>`${k} ${esc(P(j,v)?.name)}`).join(' · ')}</small>`:'<b>Between songs</b>'}</div>${st?btn('Played',{a:`data-act="played" data-arg="${st.id}"`}):''}</div>
${nxCard}
${Q.length>1?`<small class="r-label" style="margin-top:18px;display:block">After that · ${Q.length-1}</small><div class="grp">${Q.slice(1).map((p,i)=>qRow(j,p,i+1,{live:1})).join('')}</div>`:''}</main>
<aside><div class="r-seg sm tabs">${[['hands',`Pitches · ${R.length}`],['people','People'],['log','Tonight']].map(([k,l])=>`<button type="button" class="${U.side===k?'on':''}" data-act="side" data-arg="${k}">${l}</button>`).join('')}</div>${side}${sim(j)}${access(j)}</aside></div></div>`};
const ended=j=>{const pl=j.pitches.filter(p=>p.state==='played');return `<div class="pg narrow">${btn('Jam',{k:'back',i:'back',a:'data-act="hub"'})}<div class="ph"><div><small class="r-label">Ended · ${whenL(j)}</small><h1 class="r-d">${esc(j.name)}</h1></div></div><div class="card"><div class="set"><span class="g"><b>${pl.length} songs played · ${j.people.length} people</b><small>Nothing else to log. Walk-up names clear tonight.</small></span></div></div>${pl.length?`<div class="grp">${pl.map(p=>`<div class="pr"><div class="g">${ptitle(j,p)}</div></div>`).join('')}</div>`:''}<div class="dock">${btn('Plan the next one',{k:'pri',i:'copy',a:'data-act="dupjam"'})}</div></div>`};

// ---------- GUEST (phone first; works on the web without an account) ----------
const guest=()=>{const m=me();const j=m&&S.jams.find(x=>x.id===m.jam);const p=j&&P(j,m.pid);
 if(!j||!p){const jc=S.jams.find(x=>x.code===U.join.code.trim().toUpperCase());const g=U.join;
  return `<div class="phone"><div class="pg narrow"><div class="ph"><div><small class="r-label">Join a jam</small><h1 class="r-d">Come play</h1></div></div>
<label class="fl"><span>Code</span><input data-f="join.code" value="${esc(g.code)}" placeholder="e.g. LUCK-42" class="mono" autocomplete="off"></label>
${jc?`<div class="card jprev"><span class="r-ty evt">${ic('party')}JAM</span><b>${esc(jc.name)}</b><small>${whenL(jc)} · ${jc.people.length} here</small></div>`:g.code.length>=6?'<p class="note">No jam with that code. Check the letters, or ask the host.</p>':`<p class="note">Try <button type="button" class="r-btn text inl" data-act="trycode">${esc(J().code)}</button></p>`}
${jc?`<label class="fl"><span>Your name <em>first name is fine</em></span><input data-f="join.name" value="${esc(g.name)}" placeholder="Name"></label>
<div class="fl"><span>What do you play?</span><div class="chips">${PARTS.map(k=>`<button type="button" class="r-chip ${g.parts.includes(k)?'on':''}" data-act="jpart" data-arg="${k}" aria-pressed="${g.parts.includes(k)}">${PN[k]}</button>`).join('')}</div></div>
<div class="dock">${btn(`Join ${esc(jc.name)}`,{k:'pri',s:'lg',dis:!(g.name.trim()&&g.parts.length),a:'data-act="join"'})}</div><p class="note small">No app or account needed. Your name clears at the end of the night.</p>`:''}</div></div>`}
 const Q=j.queue.map(id=>j.pitches.find(x=>x.id===id)).filter(Boolean);const st=j.stage&&j.pitches.find(x=>x.id===j.stage);
 const inCast=q=>q&&Object.values(castOf(j,q)).includes(p.id);const pos=Q.findIndex(inCast);
 const banner=st&&inCast(st)?`<div class="gb on">${ic('music')}<div><b>You're on stage</b><small>${esc(st.song)}. Have fun.</small></div></div>`:pos===0?`<div class="gb up">${ic('arrow')}<div><b>You're up next</b><small>${esc(Q[0].song)} · head to the stage</small></div></div>`:pos>0?`<div class="gb">${ic('clock')}<div><b>You're ${pos+1} in the queue</b><small>${esc(Q[pos].song)}</small></div></div>`:'';
 const nudge=j.nudge&&j.nudge.part&&p.parts.includes(j.nudge.part)&&!(j.pitches.find(x=>x.id===j.nudge.pid)?.parts[j.nudge.part]||[]).length?`<div class="gb ask">${ic('bell')}<div><b>The host is looking for ${PN[j.nudge.part].toLowerCase()}</b><small>${esc(j.pitches.find(x=>x.id===j.nudge.pid)?.song||'')}</small></div>${btn('I can',{k:'pri',s:'sm',a:`data-act="raise" data-arg="${j.nudge.pid}:${j.nudge.part}"`})}</div>`:'';
 const R=j.pitches.filter(x=>['open','queued','pending'].includes(x.state)).sort((a,b)=>(b.state==='queued')-(a.state==='queued')||cov(b).f/cov(b).n-cov(a).f/cov(a).n);
 return `<div class="phone"><div class="pg narrow"><div class="gh"><div><small class="r-label">${j.status==='live'?'<span class="lv"><i></i>LIVE</span>':'Planned · '+whenL(j)}</small><h1 class="r-d">${esc(j.name)}</h1><small class="muted">You're in as ${esc(p.name)} · ${p.parts.map(k=>PN[k]).join(', ')}</small></div>${av(p,44)}</div>
${banner}${nudge}${st&&!inCast(st)?`<div class="gb dim">${ic('music')}<div><small class="r-label">On stage</small><b>${esc(st.song)}</b></div></div>`:''}
<div class="gs"><small class="r-label">Songs tonight · tap an open part to raise your hand</small>${j.requests?btn('Pitch a song',{k:'pri',s:'sm',i:'plus',a:'data-act="gpitch"'}):''}</div>
${R.length?`<div class="grp">${R.map(x=>`<div class="gp"><div class="g">${ptitle(j,x)}${x.state==='queued'?`<span class="tag">IN THE QUEUE · #${Q.indexOf(x)+1}</span>`:x.state==='pending'?'<span class="tag">WAITING FOR THE HOST</span>':''}</div><div class="slots g2">${Object.keys(x.parts).map(k=>{const ids=x.parts[k],mine=ids.includes(p.id);return `<button type="button" class="gslot ${ids.length?'f':''} ${mine?'me':''}" data-act="${mine?'lower':'raise'}" data-arg="${x.id}:${k}" aria-pressed="${mine}"><small>${PN[k]}</small><b>${mine?'You':ids.length?esc(P(j,ids[0])?.name)+(ids.length>1?` +${ids.length-1}`:''):'Open'}</b>${mine?ic('check'):ids.length?'':ic('hand')}</button>`}).join('')}</div></div>`).join('')}</div>`:`<div class="empty sm">${ic('music')}<b>No songs yet</b><p>Pitch one: say what you'll play and what you need.</p></div>`}
<div class="gs"><small class="r-label">Here tonight · ${j.people.length}</small></div><div class="avrow">${j.people.map(x=>`<span title="${esc(x.name)}: ${x.parts.map(k=>PN[k]).join(', ')}">${av(x,34)}</span>`).join('')}</div>
<div class="dock">${btn('Leave the jam',{k:'text',a:'data-act="leave"'})}</div></div></div>`};

// ---------- BAR TV ----------
const tv=()=>{const j=J();const st=j.stage&&j.pitches.find(p=>p.id===j.stage);const Q=j.queue.map(id=>j.pitches.find(p=>p.id===id)).filter(Boolean);const lf=ranked(j).concat(Q).filter(p=>open(p).length).slice(0,3);
 const sl=[];if(st||Q[0])sl.push(`<div class="tvb"><small class="k">${st?'ON STAGE NOW':'UP FIRST'}</small><h2>${esc((st||Q[0]).song)}</h2><div class="ar">${Object.entries(castOf(j,st||Q[0])).filter(([,v])=>v).map(([k,v])=>`${esc(P(j,v)?.name)} on ${PN[k].toLowerCase()}`).join(' · ')}</div>${st&&Q[0]?`<div class="tvu"><small class="k">UP NEXT</small><b>${esc(Q[0].song)}</b></div>`:''}</div>`);
 if(lf.length)sl.push(`<div class="tvb"><small class="k v">LOOKING FOR SOMEONE</small><h2 class="m">One player away</h2>${lf.map(p=>`<div class="tvr"><b>${esc(p.song)}</b><span>${ic('hand')}${open(p).map(k=>PN[k].toLowerCase()).join(', ')}</span></div>`).join('')}</div>`);
 sl.push(`<div class="tvb"><div class="wm big"><span class="nut"></span>Rock On</div><small class="k">THE STAGE IS OPEN</small><h2>Come <em>play</em>.</h2><div class="steps"><span><i>1</i>Scan the code</span><span><i>2</i>Say what you play</span><span><i>3</i>Raise your hand</span></div><p>You don't need the app: the web works, or just tell the host.</p></div>`);
 const k=U.tv%sl.length;return `<div class="tv" data-act="tvnext"><div class="tvt">${j.status==='live'?'<span class="lv"><i></i>LIVE</span>':'<span class="r-label">STARTS '+t12(j.time)+'</span>'}<b>${esc(j.name)}</b><span class="dots">${sl.map((_,i)=>`<i class="${i===k?'on':''}"></i>`).join('')}</span><button type="button" class="r-btn sm" data-act="role" data-arg="host">${ic('x')}Exit TV</button></div>${sl[k]}<div class="tvq">${qr(150)}<b>Scan to join</b><span>CODE <em>${j.code}</em></span></div><div class="tvf">${j.people.length} HERE · ROCKON.BAND/J · FIRST NAMES AND PARTS ONLY</div></div>`};

// ---------- COUNTER iPAD ----------
const kiosk=()=>{const j=J();const k=U.kio;if(k.done)return `<div class="kio"><div class="kdone"><span class="ck">${ic('check')}</span><h2 class="r-d">You're on the list, ${esc(k.name||'friend')}.</h2><p>The host will call you up. Watch the screen.</p>${btn('Next person',{k:'pri',s:'xl',a:'data-act="knext"'})}</div></div>`;
 const R=ranked(j);return `<div class="kio"><div class="kh"><div class="wm"><span class="nut"></span>Rock On</div><b>${esc(j.name)}</b></div><div class="kf">
<label class="fl"><span>Your name</span><input class="big" data-f="kio.name" value="${esc(k.name)}" placeholder="First name is fine"></label>
<div class="fl"><span>What do you play?</span><div class="chips big">${PARTS.map(p=>`<button type="button" class="r-chip ${k.parts.includes(p)?'on':''}" data-act="kpart" data-arg="${p}" aria-pressed="${k.parts.includes(p)}">${PN[p]}</button>`).join('')}</div></div>
<div class="fl"><span>Pick a song <em>optional</em></span><div class="chips big">${R.slice(0,6).map(p=>`<button type="button" class="r-chip ${k.pitch===p.id?'on':''}" data-act="kpitch" data-arg="${p.id}" aria-pressed="${k.pitch===p.id}">${esc(p.song)}</button>`).join('')}</div></div>
${btn('Raise my hand',{k:'pri',s:'xl',i:'hand',dis:!(k.name.trim()&&k.parts.length),a:'data-act="kgo"'})}<p class="note">No account, no app. Your name clears at the end of the night.</p></div></div>`};

// ---------- overlays ----------
const sheet=(t,body,acts)=>`<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(t)}"><h3>${t}</h3>${body}<div class="btns end">${acts}</div></div>`;
const overlay=()=>{const j=J();
 if(U.walk){const w=U.walk;return sheet('Add a walk-up',`<label class="fl"><span>Name</span><input data-f="walk.name" value="${esc(w.name)}" placeholder="First name"></label><div class="fl"><span>Plays</span><div class="chips">${PARTS.map(k=>`<button type="button" class="r-chip ${w.parts.includes(k)?'on':''}" data-act="wpart" data-arg="${k}">${PN[k]}</button>`).join('')}</div></div><label class="fl"><span>Song <em>optional</em></span><input data-f="walk.song" value="${esc(w.song)}" placeholder="What do they want to play?"></label>`,btn('Cancel',{a:'data-act="close"'})+btn('Add',{k:'pri',dis:!(w.name.trim()&&w.parts.length),a:'data-act="wadd"'}))}
 if(U.pitch){const g=U.pitch;return sheet('Pitch a song',`<label class="fl"><span>Song</span><input data-f="pitch.song" value="${esc(g.song)}" placeholder="e.g. Plush"></label><label class="fl"><span>Artist</span><input data-f="pitch.artist" value="${esc(g.artist)}" placeholder="e.g. Stone Temple Pilots"></label><div class="fl"><span>You'll play</span><div class="chips">${PARTS.map(k=>`<button type="button" class="r-chip ${g.mine===k?'on':''}" data-act="pmine" data-arg="${k}">${PN[k]}</button>`).join('')}</div></div><div class="fl"><span>Parts the song needs</span><div class="chips">${PARTS.map(k=>`<button type="button" class="r-chip ${g.need.includes(k)?'on':''}" data-act="pneed" data-arg="${k}">${PN[k]}</button>`).join('')}</div></div><p class="note">${j.approve?'The host approves it, then people can raise hands.':'It goes up straight away; people raise hands for the open parts.'}</p>`,btn('Cancel',{a:'data-act="close"'})+btn('Pitch it',{k:'pri',dis:!(g.song.trim()&&g.mine),a:'data-act="pgo"'}))}
 if(U.confirm==='end')return sheet('End the jam?',`<p class="note">The queue and hands clear. Walk-up names are forgotten. Nothing else is logged.</p>`,btn('Keep going',{a:'data-act="close"'})+btn('End jam',{k:'dng',a:'data-act="endgo"'}));
 if(U.confirm==='reset')return sheet('Reset the prototype?',`<p class="note">Clears every jam in this browser and loads the sample jam again. Open guest windows reset too.</p>`,btn('Cancel',{a:'data-act="close"'})+btn('Reset',{k:'dng',a:'data-act="resetgo"'})+btn('Start empty',{a:'data-act="resetempty"'}));
 return ''};

// ---------- render ----------
const render=()=>{const ae=document.activeElement,f=ae&&ae.dataset&&ae.dataset.f,pos=f&&ae.selectionStart;
 const j=J();let body='';
 if(U.role==='host')body=!j||U.view==='hub'?hub():U.view==='new'?hnew():j.status==='live'?live(j):j.status==='ended'?ended(j):planned(j);
 else if(U.role==='guest')body=guest();else if(U.role==='tv')body=j?tv():hub();else body=j?kiosk():hub();
 app.dataset.role=U.role;app.innerHTML=(U.role==='tv'?'':bar())+`<div class="jbody">${body}</div>`+overlay()+(U.toast?`<div class="toast" role="status">${esc(U.toast)}</div>`:'');
 if(f){const n=app.querySelector(`[data-f="${f}"]`);if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(_){}}}};

// ---------- actions ----------
const pp=(j,id)=>j.pitches.find(p=>p.id===id);
const NAMES=['Jess','Ray','Mo','Sam','Pete','Nina','Omar','Tess','Leo','Ivy','Gus','Bea'];const SONGS=[['Plush','Stone Temple Pilots'],['Creep','Radiohead'],['Zombie','The Cranberries'],['Song 2','Blur'],['Basket Case','Green Day'],['Black Hole Sun','Soundgarden'],['Come As You Are','Nirvana'],['Use Somebody','Kings of Leon']];
const rnd=a=>a[Math.floor(Math.random()*a.length)];
const A={
 role:a=>{U.role=a;history.replaceState(null,'','#'+a);render()},
 newwin:()=>{window.open(location.pathname+'#guest&code='+J().code,'_blank','width=430,height=900')},
 reset:()=>{U.confirm='reset';render()},resetgo:()=>{S=seed();setMe(null);U.view='hub';U.confirm=null;save()},resetempty:()=>{S={v:1,jams:[],cur:null};setMe(null);U.view='hub';U.confirm=null;save()},
 hub:()=>{U.view='hub';render()},hnew:()=>{U.view='new';render();setTimeout(()=>app.querySelector('[data-f="hj.name"]')?.focus())},
 hcreate:()=>{const h=U.hj;if(!h.name.trim())return;const j={id:uid(),name:h.name.trim(),date:h.date,time:h.time,where:h.where.trim(),code:code(h.name),status:'planned',who:'code',requests:true,approve:false,group:0,nudge:null,people:[person('Eric',['Gtr','Vox'],'app',{host:1})],pitches:[],queue:[],stage:null,log:[]};
  S.jams.push(j);S.cur=j.id;U.view='jam';U.tab='lineup';U.hj={name:'',date:h.date,time:h.time,where:''};save();toast(`${j.name} created · code ${j.code}`)},
 openjam:a=>{S.cur=a;U.view='jam';save()},
 tab:a=>{U.tab=a;render()},side:a=>{U.side=a;render()},
 jset:a=>{const [k,v]=a.split(':');J()[k]=v;save()},jtog:a=>{const j=J();j[a]=!j[a];save()},
 copy:()=>{try{navigator.clipboard.writeText(location.href.split('#')[0]+'#guest&code='+J().code)}catch(_){}toast('Guest link copied')},
 house:a=>{const p=P(J(),a);p.house=!p.house;save()},
 queue:a=>{const j=J(),p=pp(j,a);p.state='queued';if(!j.queue.includes(a))j.queue.push(a);log(j,`${p.song} added to the ${j.status==='live'?'queue':'lineup'}`);save();toast(`${p.song} is #${j.queue.length}`)},
 approve:a=>{const p=pp(J(),a);p.state='open';save()},decline:a=>{const p=pp(J(),a);p.state='removed';save();toast(`Declined ${p.song}`)},
 qmove:a=>{const [id,d]=a.split(':');const q=J().queue,i=q.indexOf(id),k=i+(+d);if(k<0||k>=q.length)return;[q[i],q[k]]=[q[k],q[i]];save()},
 qnext:a=>{const q=J().queue;q.splice(q.indexOf(a),1);q.unshift(a);save();toast('Moved up next')},
 qset:a=>{const [id,v]=a.split(':');const j=J(),p=pp(j,id);p.state=v==='removed'?'open':v;j.queue=j.queue.filter(x=>x!==id);log(j,`${p.song}: ${v==='left'?'they left':'taken off the queue'}`);save();toast(`${p.song} ${v==='left'?'marked as left':'back in Requests'}`)},
 golive:()=>{const j=J();j.status='live';log(j,'Went live');save();toast('Live · guests can raise hands and pitch')},
 walk:()=>{U.walk={name:'',parts:[],song:''};render();setTimeout(()=>app.querySelector('[data-f="walk.name"]')?.focus())},
 wpart:a=>{const w=U.walk;w.parts=w.parts.includes(a)?w.parts.filter(x=>x!==a):[...w.parts,a];render()},
 wadd:()=>{const j=J(),w=U.walk;const p=person(w.name.trim(),w.parts,'walkup');j.people.push(p);if(w.song.trim()){const parts={};PARTS.slice(0,4).forEach(k=>parts[k]=k===w.parts[0]?[p.id]:[]);j.pitches.push({id:uid(),song:w.song.trim(),artist:'Walk-up pick',by:p.id,parts,cast:{},state:'open',at:Date.now()})}log(j,`${p.name} walked up`);U.walk=null;save();toast(`${p.name} added`)},
 swap:a=>{const [id,k]=a.split(':');const j=J(),p=pp(j,id);const c=castOf(j,p)[k],v=p.parts[k];p.cast[k]=v[(v.indexOf(c)+1)%v.length];save()},
 fillhouse:a=>{const [id,k]=a.split(':');const j=J(),p=pp(j,id);const h=j.people.find(x=>x.house&&x.parts.includes(k));if(!h)return;p.parts[k].push(h.id);p.cast[k]=h.id;save();toast(`${h.name} (house) on ${PN[k].toLowerCase()}`)},
 ask:a=>{const [id,k]=a.split(':');const j=J();j.nudge={pid:id,part:k,at:Date.now()};save();toast(k?`Asked the room for ${PN[k].toLowerCase()}`:'Nudged everyone with an open part')},
 callup:a=>{const j=J(),p=pp(j,a);if(j.stage){const o=pp(j,j.stage);if(o&&o.state==='stage')o.state='played'}p.state='stage';j.stage=a;j.queue=j.queue.filter(x=>x!==a);j.nudge=null;log(j,`${p.song} called up`);save();toast(`${p.song} is up`)},
 skip:a=>{const q=J().queue;q.splice(q.indexOf(a),1);q.splice(Math.min(1,q.length),0,a);save();toast('Skipped for now · moved down one')},
 played:a=>{const j=J(),p=pp(j,a);p.state='played';j.stage=null;log(j,`${p.song} played`);save()},
 end:()=>{U.confirm='end';render()},endgo:()=>{const j=J();j.status='ended';j.queue=[];j.stage=null;j.nudge=null;j.people=j.people.filter(p=>p.via!=='walkup'&&p.via!=='kiosk');U.confirm=null;save();toast('Jam ended · nothing else to log')},
 dupjam:()=>{const o=J();const d=new Date(o.date+'T00:00');d.setDate(d.getDate()+7);U.hj={name:o.name,date:d.toISOString().slice(0,10),time:o.time,where:o.where};U.view='new';render()},
 close:()=>{U.walk=null;U.pitch=null;U.confirm=null;render()},
 sim:a=>{const j=J();
  if(a==='arrive'){for(let i=0;i<3;i++){const used=new Set(j.people.map(p=>p.name));const n=NAMES.find(x=>!used.has(x))||'Guest '+(j.people.length+1);const pt=[rnd(PARTS)];if(Math.random()<.4)pt.push(rnd(PARTS.filter(x=>x!==pt[0])));j.people.push(person(n,pt,Math.random()<.4?'web':'app'))}log(j,'3 people arrived');save();toast('3 people joined with the code');return}
  const g=j.people.filter(p=>!p.host);if(!g.length){toast('No guests yet · try "3 people arrive"');return}
  if(a==='pitch'){const p=rnd(g);const [s,ar]=rnd(SONGS.filter(x=>!j.pitches.some(q=>q.song===x[0])))||SONGS[0];const parts={};['Vox','Gtr','Bass','Drums'].forEach(k=>parts[k]=k===p.parts[0]?[p.id]:[]);j.pitches.push({id:uid(),song:s,artist:ar,by:p.id,parts,cast:{},state:j.approve?'pending':'open',at:Date.now()});log(j,`${p.name} pitched ${s}`);save();toast(`${p.name} pitched ${s}${j.approve?' · waiting for you':''}`);return}
  if(a==='hand'){const opts=[];j.pitches.filter(x=>['open','queued'].includes(x.state)).forEach(x=>Object.keys(x.parts).forEach(k=>{g.forEach(p=>{if(p.parts.includes(k)&&!x.parts[k].includes(p.id))opts.push([x,k,p])})}));if(!opts.length){toast('Nobody here can fill an open part · add people');return}opts.sort((a,b)=>a[0].parts[a[1]].length-b[0].parts[b[1]].length);const [x,k,p]=opts[0];x.parts[k].push(p.id);log(j,`${p.name} raised a hand: ${PN[k].toLowerCase()} on ${x.song}`);save();toast(`${p.name} raised a hand for ${PN[k].toLowerCase()} on ${x.song}`);return}
  if(a==='kiosk'){const n=rnd(NAMES.filter(x=>!j.people.some(p=>p.name===x)))||'Walk-up';const p=person(n,[rnd(PARTS)],'kiosk');j.people.push(p);const x=ranked(j).find(q=>q.parts[p.parts[0]]&&!q.parts[p.parts[0]].length);if(x)x.parts[p.parts[0]].push(p.id);log(j,`${n} signed up at the counter`);save();toast(`${n} signed up at the counter${x?` · hand up for ${x.song}`:''}`)}},
 // guest
 trycode:()=>{U.join.code=J().code;render()},
 jpart:a=>{const g=U.join;g.parts=g.parts.includes(a)?g.parts.filter(x=>x!==a):[...g.parts,a];render()},
 join:()=>{const g=U.join,j=S.jams.find(x=>x.code===g.code.trim().toUpperCase());if(!j)return;const p=person(g.name.trim(),g.parts,'web');j.people.push(p);setMe({jam:j.id,pid:p.id});log(j,`${p.name} joined`);save();toast(`You're in. Raise a hand on any open part.`)},
 raise:a=>{const [id,k]=a.split(':');const m=me();const j=S.jams.find(x=>x.id===m.jam),p=pp(j,id);if(!p.parts[k].includes(m.pid))p.parts[k].push(m.pid);if(j.nudge&&j.nudge.pid===id)j.nudge=null;log(j,`${P(j,m.pid).name} raised a hand: ${PN[k].toLowerCase()} on ${p.song}`);save();toast(`Hand up for ${PN[k].toLowerCase()} on ${p.song}`)},
 lower:a=>{const [id,k]=a.split(':');const m=me();const j=S.jams.find(x=>x.id===m.jam),p=pp(j,id);p.parts[k]=p.parts[k].filter(x=>x!==m.pid);if(p.cast[k]===m.pid)delete p.cast[k];save()},
 gpitch:()=>{U.pitch={song:'',artist:'',mine:'',need:['Vox','Gtr','Bass','Drums']};render();setTimeout(()=>app.querySelector('[data-f="pitch.song"]')?.focus())},
 pmine:a=>{U.pitch.mine=a;if(!U.pitch.need.includes(a))U.pitch.need.push(a);render()},pneed:a=>{const g=U.pitch;g.need=g.need.includes(a)?g.need.filter(x=>x!==a):[...g.need,a];render()},
 pgo:()=>{const g=U.pitch,m=me();const j=S.jams.find(x=>x.id===m.jam);const parts={};g.need.forEach(k=>parts[k]=k===g.mine?[m.pid]:[]);j.pitches.push({id:uid(),song:g.song.trim(),artist:g.artist.trim()||'—',by:m.pid,parts,cast:{},state:j.approve?'pending':'open',at:Date.now()});log(j,`${P(j,m.pid).name} pitched ${g.song}`);U.pitch=null;save();toast(j.approve?'Pitched · the host will approve it':'Pitched · people can raise hands now')},
 leave:()=>{const m=me();const j=S.jams.find(x=>x.id===m.jam);if(j){j.people=j.people.filter(p=>p.id!==m.pid);j.pitches.forEach(p=>Object.keys(p.parts).forEach(k=>p.parts[k]=p.parts[k].filter(x=>x!==m.pid)))}setMe(null);save()},
 // tv / kiosk
 tvnext:()=>{U.tv++;render()},
 kpart:a=>{const k=U.kio;k.parts=k.parts.includes(a)?k.parts.filter(x=>x!==a):[...k.parts,a];render()},kpitch:a=>{U.kio.pitch=U.kio.pitch===a?'':a;render()},
 kgo:()=>{const j=J(),k=U.kio;const p=person(k.name.trim(),k.parts,'kiosk');j.people.push(p);if(k.pitch){const x=pp(j,k.pitch);const part=k.parts.find(q=>x.parts[q])||k.parts[0];if(x.parts[part])x.parts[part].push(p.id)}log(j,`${p.name} signed up at the counter`);k.done=true;save()},
 knext:()=>{U.kio={name:'',parts:[],pitch:'',done:false};render()}};
app.addEventListener('click',e=>{const x=e.target.closest('[data-act]');if(!x||x.disabled)return;const f=A[x.dataset.act];if(f){e.preventDefault();f(x.dataset.arg)}});
app.addEventListener('input',e=>{const f=e.target.dataset.f;if(!f)return;const [o,k]=f.split('.');U[o][k]=e.target.value;if(o==='join'&&k==='code')U.join.code=e.target.value.toUpperCase();render()});
app.addEventListener('keydown',e=>{if(e.key==='Escape'&&(U.walk||U.pitch||U.confirm))A.close()});
window.addEventListener('hashchange',()=>{const r=location.hash.slice(1).split('&')[0];if(r&&r!==U.role){U.role=r;render()}});
setInterval(()=>{if(U.role==='tv'){U.tv++;render()}},9000);
if(S.cur&&U.role==='host'&&J())U.view='jam';
render();
})();
