// Nov 7 2026 · final pass (source/REVIEW-NOV-2.md, all recommendations applied).
// New show = blank state of the show page, edited in place (1.1) · chart editor is its own screen (1.2) ·
// desktop practice session with notes as a side panel (1.3, 2.9) · Host a jam form (1.9) · global search (§3) ·
// key picker, album, Spotify matches, "Also add to My Songs" in the song editor (§3) · add a friend (2.4) ·
// join with a code, forgot password, check email, regenerate invite, change password, instruments (§3) ·
// a States panel to preview loading / empty / error / offline on every main list (2.5).
(()=>{const {S,V,app,render,head,EV,SETS,byId,toast}=DK,{ic,btn,seg,grp,gl,tp,sw,T,NOTES:N}=Rock;const {SONGS,CHART}=DD;
const p2=n=>String(n).padStart(2,'0');const DOW=['SUN','MON','TUE','WED','THU','FRI','SAT'];
const cap=s=>s?s[0]+s.slice(1).toLowerCase():'';
const t12=t=>{if(!t)return '';const [h,m]=t.split(':').map(Number);return `${h%12||12}:${p2(m)} ${h<12?'AM':'PM'}`};
const dlg=(t,body,acts,w)=>`<div class="mscrim" data-fx></div><div class="mdlg" ${w?`style="width:min(${w}px,94vw)"`:''}><h3>${t}</h3>${body}<div class="btns" style="margin:18px 0 0;justify-content:flex-end">${acts}</div></div>`;
const F={};// overlay state for this file
const secs=d=>{const [m,s]=(d||'0:00').split(':').map(Number);return m*60+(s||0)};

// ---------- 1.1 new show: a blank show page, edited in place ----------
const setEv=e=>{if(!e.date)return;const d=new Date(e.date+'T00:00');e.m=d.toLocaleDateString('en-US',{month:'short'}).toUpperCase();e.d=String(d.getDate());e.dw=DOW[d.getDay()];};
const sub=e=>`${e.time?t12(e.time):'Time TBD'} · ${e.venue||'Venue TBD'}`;
const newShow=()=>{const id='sh'+Date.now();const e={id,ty:'show',custom:1,draft:1,t:'',venue:'',addr:'',date:'',time:'20:00',load:'',sc:'',slot:45,pay:'',contact:'',conf:false,set:null,m:'NOV',d:'—',dw:'TBD',sub:'Time TBD · Venue TBD'};
 EV.unshift(e);S.v='calendar';S.evf='';S.ev=id;S.menu=null;render();setTimeout(()=>app.querySelector('[data-shf="venue"]')?.focus(),30)};
const sfld=(e,k,l,ph,o={})=>`<div class="pfl ${o.cls||''}"><label>${l}${o.req?' <em class="rq">FILL THIS FIRST</em>':''}</label><input data-shf="${k}" value="${(e[k]||'').toString().replace(/"/g,'&quot;')}" placeholder="${ph}"></div>`;
DK.showCustom=e=>{const set=e.set&&SETS.find(s=>s.id===e.set);let st=null;if(set){let t=0,n=0;set.items.forEach(x=>{if(typeof x==='string'){n++;t+=secs(byId(x).dur)}else if(x.brk)t+=x.brk*60});st={n,min:Math.round(t/60)}}
 const tyl=`<span class="r-ty show">${ic('ticket')}SHOW</span>`;
 return `<div class="dp shed"><div class="k">${tyl} · ${e.draft?'new · fill in what you know, it saves as you go':e.cx?'cancelled':'scheduled'}</div>
<input class="h2in" data-shf="t" value="${e.t}" placeholder="${e.venue||'Show name'}">
<div class="cf" data-shconf><i style="${e.conf?'':'background:var(--s3);color:var(--mu)'}">${ic('check')}</i>Confirmed<small style="font-weight:500;color:var(--mu)">${e.conf?'venue has said yes':'tick when the venue says yes'}</small></div>
${gl('Where')}${grp(`<div class="pnf tight">${sfld(e,'venue','Venue','e.g. Neumos',{req:!e.venue})}${sfld(e,'addr','Address','Street, city')}</div>`)}
${gl('When')}${grp(`<div class="pnf tight"><div class="prow2"><div class="pfl"><label>Date</label>${RP.date('sh-date',e.date||'2026-11-28')}</div><div class="pfl"><label>Start</label>${RP.time('sh-time',e.time||'20:00')}</div></div><div class="prow3"><div class="pfl"><label>Load-in</label>${RP.time('sh-load',e.load||'18:30')}</div><div class="pfl"><label>Soundcheck</label>${RP.time('sh-sc',e.sc||'19:15')}</div><div class="pfl"><label>Set length</label><div class="stp sm wide"><span data-shslot="-5">−</span><b>${e.slot}<small>MIN</small></b><span data-shslot="5">+</span></div></div></div></div>`)}
${gl("Money and people")}${grp(`<div class="pnf tight"><div class="prow2 solo">${sfld(e,'pay','Pay','$0')}${sfld(e,'contact','Contact','Name · role · phone or email')}</div></div>`)}
${gl('Set')}${set?grp(`<div class="srow" style="font-family:var(--r-fm);font-size:12px;color:var(--mu)">${ic('copy','width:14px;height:14px')}Copied from ${set.name} · just now <span style="margin-left:auto;color:var(--accink);cursor:pointer" data-shcopy>RE-COPY</span></div><div class="srow"><span class="g" style="font-family:var(--r-fm);font-size:12px;color:var(--mu)">${st.n} SONGS · <span style="color:${st.min>e.slot?'var(--warn)':'inherit'}">${st.min} OF ${e.slot} MIN</span></span></div>`+set.items.filter(x=>typeof x==='string').slice(0,8).map((id,i)=>{const s=byId(id);return `<div class="srow"><span class="n">${i+1}</span><span class="g">${s.title}</span>${tp(s.tun,'sm')}<span class="m">${s.dur}</span></div>`}).join(''))+`<div class="btns">${btn('Open set',{kind:'pri',icon:'list',attr:'data-set="'+set.id+'"'})}</div>`
 :grp(`<div class="nb" style="color:var(--mu)">No set yet. The show gets its own copy, so edits here never change the setlist.</div><div class="sx">${btn('Copy a setlist',{kind:'pri',icon:'copy',attr:'data-shcopy'})}${btn('New set',{icon:'plus',attr:'data-shnewset'})}</div>`)}
${gl("Who's going")}${grp(`<div class="rsvp">${['Going','Maybe',"Can't"].map((l,i)=>`<span class="${(e.rsvp??0)===i?'on':''}" data-shrsvp="${i}">${l}</span>`).join('')}</div>`)}
<div class="btns" style="margin-top:6px">${e.draft?btn('Discard draft',{attr:'data-shdisc'}):btn(e.cx?'Undo cancel':'Mark cancelled',{icon:e.cx?'refresh':'x',attr:'data-shcx'})}</div></div>`};
const curEv=()=>EV.find(x=>x.id===S.ev);
const shUpd=e=>{e.sub=sub(e);if(e.venue||e.t)e.draft=0};

// ---------- 2.9 desktop practice session (stage; notes as a side panel per 1.3) ----------
const PS={songs:['mw','bl','aer','ev'],i:0,notes:true,t0:0,skip:new Set()};
const PNOTE={mw:'Breakdown at 2:40: watch Sarah for the cut.',bl:'Mike takes the second verse harmony.',aer:'New one. Slow run first at 70 BPM.',ev:'Drop D. Count in from Sarah.'};
let tick=null;
V.session=()=>{const id=PS.songs[PS.i],s=byId(id),nx=byId(PS.songs[PS.i+1]),pv=byId(PS.songs[PS.i-1]);const el=Math.floor((Date.now()-PS.t0)/1000);
 const retune=nx&&nx.tun!==s.tun;
 return `<div class="ses ${PS.notes?'wn':''}"><div class="sesh"><span class="ibx" data-sesx title="End without saving">${ic('x')}</span><div class="g"><b>Thursday run</b><span class="r-m r-muted">SONG ${PS.i+1} OF ${PS.songs.length} · <span data-sclock>${Math.floor(el/60)}:${p2(el%60)}</span> · MIKE'S GARAGE</span></div>${btn('Chart',{icon:'chordbox',attr:'data-chart="session"'})}${btn('Tune',{icon:'fork',attr:'data-v="tuner"'})}${btn(PS.notes?'Hide notes':'Notes',{icon:'doc',attr:'data-sesn'})}${btn('End practice',{attr:'data-sesend'})}</div>
<div class="sesb"><div class="sesm"><div class="k">${tp(s.tun,'lg')} <span class="r-m r-muted">KEY ${s.key} · ${s.bpm||'—'} BPM · ${s.dur}</span></div><h1>${s.title}</h1><div class="ar">${s.artist}</div>
<div class="sesn2">${ic('doc','width:16px;height:16px;color:var(--accink)')}<span><b>This practice:</b> ${PNOTE[id]||'—'}</span></div>
<div class="btns" style="margin:4px 0 0">${s.links.map(l=>btn(Rock.LINK_NAME[l],{icon:l,attr:'data-a="toast" data-m="Opens '+Rock.LINK_NAME[l]+'"'})).join('')}${btn('Click '+(s.bpm||''),{icon:'metro',attr:'data-v="metro"'})}${btn(PS.skip.has(id)?'Skipped':'Skip this one',{attr:'data-sesskip'})}</div>
${nx?`<div class="sesup ${retune?'warn':''}"><div class="g"><small>UP NEXT${retune?' · TUNING CHANGE':''}</small><b>${nx.title}</b><span>${tp(nx.tun,'sm')} ${retune?`from ${tp(s.tun,'sm')}`:''}</span></div>${retune?btn('Tune now',{kind:'pri',icon:'fork',attr:'data-v="tuner"'}):''}</div>`:`<div class="sesup"><div class="g"><small>LAST SONG</small><b>Next ends the practice</b><span>You'll see a wrap-up with what you covered.</span></div></div>`}</div>
${PS.notes?`<aside class="sesnp"><div class="k">Notes · ${s.title}</div><div class="nb"><div class="h">${ic('people')}Band notes<small>shared</small></div>${s.notes==='band'||s.notes==='both'?'<ul><li>Breakdown at 2:40: watch Sarah for the cut</li><li>Mike takes the second verse harmony</li></ul>':'<span style="color:var(--mu)">None yet.</span>'}</div><div class="nb"><div class="h">${ic('lock')}My notes<small>only you</small></div>${s.notes==='mine'||s.notes==='both'?'Capo off. Use the Les Paul.':'<span style="color:var(--mu)">None yet.</span>'}</div><p class="r-m r-muted" style="padding:10px 14px">NOTES OPEN BESIDE THE SONG, NEVER INSTEAD OF IT</p></aside>`:''}</div>
<div class="sesp"><span class="pg ${pv?'':'off'}" data-sesg="-1">${ic('back')}<span><small>PREVIOUS</small>${pv?pv.title:'—'}</span></span><span class="pg nx ${nx?'':'end'}" data-sesg="1"><span><small>${nx?'NEXT':'FINISH'}</small>${nx?nx.title:'End practice'}</span>${ic(nx?'chev':'check')}</span></div>
<div class="kbd" style="padding:6px 0 10px"><kbd>←</kbd><kbd>→</kbd> or pedal · <kbd>N</kbd> notes · screen stays awake</div></div>`+(F.wrap?wrapDlg():'')};
const wrapDlg=()=>{const el=Math.max(1,Math.round((Date.now()-PS.t0)/60000));const reached=PS.songs.slice(0,PS.i+1);
 return dlg('Wrap up',`<p>${el} min played · ${reached.length-PS.skip.size} of ${PS.songs.length} songs${PS.skip.size?` · ${PS.skip.size} skipped`:''}</p>${grp(PS.songs.map((id,i)=>{const s=byId(id),sk=PS.skip.has(id)||i>PS.i;return `<div class="lrow" style="cursor:default"><span class="ck2 ${sk?'no':''}">${sk?'':ic('check')}</span><div class="g"><b>${s.title}</b></div><span class="r-m r-muted">${sk?'skipped':'played'}</span></div>`}).join(''))}<div class="pfl"><label>Notes for the band</label><textarea rows="3" data-wrapn placeholder="What worked, what to carry to next week…"></textarea></div>`,btn('Back to practice',{attr:'data-fx'})+btn('Save to history',{kind:'pri',icon:'check',attr:'data-wrapsave'}),540)};

// ---------- 1.2 chart editor: its own screen (wide), the song editor keeps one row ----------
const chartText=()=>CHART.map(([h,ls])=>`[${h}]\n`+ls.map(l=>{let c='',w='';l.forEach(([ch,wd])=>{const p=w.length;if(ch){c=c.padEnd(p,' ')+ch+' '}w+=wd||''});return c.trimEnd()+'\n'+w.trimEnd()}).join('\n')).join('\n\n');
const CE={txt:'',mode:'full',from:'songedit',sn:'D4',title:''};
const openChart=(from)=>{const e=DK.ED;CE.from=from;CE.title=e?e.title||'New song':byId(S.sel).title;CE.txt=e&&e.chart!=null?e.chart:(e&&!e.id?'':chartText());CE.mode='full';S.v='chartedit';render()};
V.chartedit=()=>`<div class="hd" style="padding-bottom:6px"><span class="r-btn back" data-cex>${ic('back')}${CE.from==='songedit'?'Song editor':'Song'}</span></div>`+head('Chords & lyrics',CE.title,null,btn('Cancel',{attr:'data-cex'})+btn('Save chart',{kind:'pri',icon:'check',attr:'data-cesave'}))+
`<div class="split sed"><div class="pane"><div class="pnf"><div class="psh"><b>Edit</b><span class="r-m r-muted" style="margin-left:auto">CHORD LINES ABOVE LYRIC LINES · [SECTION] HEADERS · CHORDPRO WORKS TOO</span></div>
<textarea class="cetx" data-cetx spellcheck="false" placeholder="Paste from Ultimate Guitar or anywhere.">${CE.txt}</textarea>
<div class="btns" style="margin:4px 0 0">${btn('Paste',{icon:'copy',attr:'data-cepaste'})}${CE.txt?btn('Clear',{attr:'data-ceclr'}):btn('Try a sample',{attr:'data-cesample'})}${btn('Chords from Verse 1 → next verse',{attr:'data-a="toast" data-m="Copied Verse 1 chords onto Verse 2 (same syllable positions)"'})}</div>
<div class="pfl"><label>Starting note <em>for songs that open on vocals</em></label><div class="snrow"><span class="snv">${CE.sn}</span>${btn('Hear it',{icon:'speaker',attr:'data-cesn'})}<div style="width:220px">${seg(['C4','D4','E4','G4'],['C4','D4','E4','G4'].indexOf(CE.sn),'data-cesnp')}</div></div></div></div></div>
<div class="pane side"><div class="pnf"><div class="psh"><b>Preview</b><div style="width:250px;margin-left:auto">${seg(['Lyrics + chords','Chords only'],CE.mode==='full'?0:1,'data-cemode')}</div></div>${CE.txt?`<div class="pprev ${CE.mode==='full'?'':'conly'}">${DK.parsePaste(CE.txt)}</div>`:`<div class="dst" style="padding:30px 10px">${ic('chordbox')}<b>No chart yet</b><p>Paste chords over lyrics on the left. Chords snap to the word they sit over.</p></div>`}</div></div></div>`;

// ---------- song editor: chart row, key picker, album, Spotify matches, Also add to My Songs ----------
const SP=[['Everlong','Foo Fighters','The Colour and the Shape','4:10','dd','D','158'],['Plush','Stone Temple Pilots','Core','5:13','std','G♯m','74'],['Creep','Radiohead','Pablo Honey','3:58','std','G','92'],['Zombie','The Cranberries','No Need to Argue','5:06','std','Em','84'],['Song 2','Blur','Blur','2:02','std','A','130'],['Interstate Love Song','Stone Temple Pilots','Purple','3:14','half','D','150'],['Black Hole Sun','Soundgarden','Superunknown','5:18','dd','G','105'],['Brain Stew','Green Day','Insomniac','3:13','half','A','124'],['Smells Like Teen Spirit','Nirvana','Nevermind','5:01','std','Fm','117']];
const KEYS=[['C','Am'],['G','Em'],['D','Bm'],['A','F♯m'],['E','C♯m'],['B','G♯m'],['F♯','E♭m'],['D♭','B♭m'],['A♭','Fm'],['E♭','Cm'],['B♭','Gm'],['F','Dm']];
const circle=k=>{const seg2=(r0,r1,i)=>{const a0=(i*30-105)*Math.PI/180,a1=(i*30-75)*Math.PI/180,P=(r,a)=>`${150+r*Math.cos(a)},${150+r*Math.sin(a)}`;return `M${P(r1,a0)} A${r1},${r1} 0 0 1 ${P(r1,a1)} L${P(r0,a1)} A${r0},${r0} 0 0 0 ${P(r0,a0)}Z`};
 const lab=(r,i)=>{const a=(i*30-90)*Math.PI/180;return [150+r*Math.cos(a),150+r*Math.sin(a)+5]};
 return `<svg viewBox="0 0 300 300" class="cof" role="img" aria-label="Circle of fifths">${KEYS.map(([M,m],i)=>{const [x,y]=lab(122,i),[x2,y2]=lab(80,i);return `<path d="${seg2(100,145,i)}" class="${k===M?'on':''}" data-kpk="${M}"/><text x="${x}" y="${y}" class="${k===M?'on':''}">${M}</text><path d="${seg2(58,100,i)}" class="mi ${k===m?'on':''}" data-kpk="${m}"/><text x="${x2}" y="${y2}" class="mi ${k===m?'on':''}">${m}</text>`}).join('')}<circle cx="150" cy="150" r="56" class="hub"/><text x="150" y="146" class="hb">${k||'—'}</text><text x="150" y="166" class="hs">MAJOR OUT · MINOR IN</text></svg>`};
const ose=V.songedit;V.songedit=()=>{let h=ose();const e=DK.ED;if(!e)return h;
 const q=e.title.trim().toLowerCase();const m=!e.id&&!e.sp&&q.length>1?SP.filter(x=>x[0].toLowerCase().includes(q)).slice(0,3):[];
 if(m.length)h=h.replace('placeholder="e.g. Everlong"></div>',`placeholder="e.g. Everlong"><div class="spm"><small>${ic('audio','width:13px;height:13px')}SPOTIFY MATCHES · PICK ONE TO FILL THE FORM, OR KEEP TYPING</small>${m.map(x=>`<div class="o" data-spk="${SP.indexOf(x)}"><b>${x[0]}</b><span>${x[1]} · ${x[2]} · ${x[3]}</span></div>`).join('')}</div></div>`);
 h=h.replace('placeholder="e.g. Foo Fighters"></div>',`placeholder="e.g. Foo Fighters"></div><div class="pfl"><label>Album <em>optional</em></label><input data-ef="album" value="${e.album||''}" placeholder="e.g. The Colour and the Shape"></div>`);
 h=h.replace(/<input data-ef="key" value="[^"]*" placeholder="E">/,`<span class="dkw" style="display:block"><span class="kpf ${F.kp?'on':''}" data-kpo>${e.key||'<i>Pick a key</i>'}${ic('down')}</span>${F.kp?`<div class="dkm kpm">${circle(e.key)}<div class="btns" style="justify-content:space-between;margin:0;padding:4px 8px 6px">${btn('No key',{kind:'text',attr:'data-kpk=""'})}${btn('Done',{kind:'pri',attr:'data-kpo'})}</div></div>`:''}</span>`);
 h=h.replace(`${ic('plus')}Custom</span>`,`${ic('plus')}Custom</span><span class="add" data-mv="settings">${ic('gear')}Manage</span>`);
 const a=h.indexOf('<div class="pane"><div class="pnf"><div class="psh"><b>Chart</b>');if(a>0){const mi=h.indexOf('<div class="mscrim"');const end=(mi>0?mi:h.length)-6;
  const has=e.chart!=null?e.chart.trim():!!e.id;const secN=has?((e.chart!=null?e.chart:chartText()).match(/\[[^\]]+\]/g)||[]).length:0;
  h=h.slice(0,a)+`<div class="pane"><div class="pnf"><div class="psh"><b>Chords &amp; lyrics</b></div>${grp(`<div class="lrow" data-ceopen>${ic('chordbox','width:20px;height:20px;color:var(--accink)')}<div class="g"><b>${has?'Edit chords &amp; lyrics':'Add chords &amp; lyrics'}</b><small>${has?`${secN} sections · starting note ${e.sn}`:'Paste from anywhere, or type chords onto the lyrics'}</small></div>${ic('chev')}</div>`)}
<p class="r-m r-muted" style="margin:-4px 2px 10px">THE CHART IS A WORKING DOCUMENT WITH ITS OWN SCREEN. NOTES ARE EDITED ON THE SONG PAGE.</p>
${S.ctx!=='personal'?grp(`<div class="jset" data-amys style="cursor:pointer"><div class="g"><b>Also add to My Songs</b><small>A linked copy in your personal catalog, tagged "from iPod Shuffle"</small></div>${sw(e.amys!==false)}</div>`):''}</div></div>`+h.slice(end);}
 return h};

// ---------- 1.9 Host a jam: two fields to start, refinements on the planned page ----------
const HJ={name:'',date:'2026-11-24',time:'20:00',where:''};
V.jamnew=()=>`<div class="hd" style="padding-bottom:6px"><span class="r-btn back" data-jv="jam">${ic('back')}Jam</span></div>`+head('Jam','Host a jam',null,btn('Cancel',{attr:'data-jv="jam"'})+btn('Create jam',{kind:'pri',icon:'check',attr:'data-hjgo'}).replace('class="r-btn pri','class="r-btn pri '+(HJ.name?'':'dis')))+
`<div class="pane" style="flex:1"><div class="pnf" style="max-width:620px"><div class="pfl"><label>Name <em class="rq">REQUIRED</em></label><input class="big" data-hjf="name" value="${HJ.name}" placeholder="e.g. Tuesday Open Jam"></div>
<div class="prow2"><div class="pfl"><label>Date</label>${RP.date('hj-date',HJ.date)}</div><div class="pfl"><label>Start</label>${RP.time('hj-time',HJ.time)}</div></div>
<div class="pfl"><label>Where <em>optional</em></label><input data-hjf="where" value="${HJ.where}" placeholder="Bar, garage, living room…"></div>
<p class="jnote" style="margin:4px 0 0">You get a join code and QR right away. Who can join, song requests, approvals and group sets live on the jam's page, where you come back to tune them.</p></div></div>`;
const mkCode=n=>(n.replace(/[^a-z]/gi,'').slice(0,4)||'JAM').toUpperCase()+'-'+(10+Math.floor(Math.random()*89));

// ---------- global search (⌘K), scoped with "all contexts" ----------
const CTXN={band:'iPod Shuffle',ad:'Acoustic Duo',personal:'Personal'};
const pal=()=>{const q=(S.pal.q||'').toLowerCase();const scope=S.pal.all?SONGS:S.ctx==='band'?SONGS.filter(s=>!s.mine):S.ctx==='ad'?SONGS.filter(s=>['aag','bl','aat'].includes(s.id)):SONGS;
 const sg=q?scope.filter(s=>(s.title+' '+s.artist).toLowerCase().includes(q)):scope.slice(0,4);
 const sl=SETS.filter(x=>!q||x.name.toLowerCase().includes(q)||x.items.some(i=>typeof i==='string'&&byId(i)&&byId(i).title.toLowerCase().includes(q)));
 const ev=EV.filter(e=>!q||(e.t||e.venue||'').toLowerCase().includes(q)||(e.ty==='show'&&!e.custom&&SETS[0].items.some(i=>typeof i==='string'&&byId(i).title.toLowerCase().includes(q))));
 const jm=DK.J?DK.J.jams.filter(j=>!q||j.name.toLowerCase().includes(q)):[];
 const sec=(l,a)=>a.length?`<div class="mg">${l} · ${a.length}</div>`+a.join(''):'';
 const res=sec('Songs',sg.slice(0,6).map(s=>`<div class="o" data-pgo="song:${s.id}">${tp(s.tun,'sm')}<div><b>${s.title}</b><small>${s.artist}</small></div></div>`))+sec('Setlists',sl.slice(0,4).map(x=>`<div class="o" data-pgo="set:${x.id}">${ic('list')}<div><b>${x.name}</b><small>${x.show||'No show'}${q&&!x.name.toLowerCase().includes(q)?' · has a matching song':''}</small></div></div>`))+sec('Calendar',ev.slice(0,4).map(e=>`<div class="o" data-pgo="ev:${e.id}">${ic({show:'ticket',prac:'cal',evt:'party'}[e.ty])}<div><b>${e.t||e.venue||'New show'}</b><small>${e.dw} ${e.m} ${e.d} · ${e.sub}</small></div></div>`))+sec('Jams',jm.map((j,i)=>`<div class="o" data-pgo="jam:${DK.J.jams.indexOf(j)}">${ic('party')}<div><b>${j.name}</b><small>${j.when} · ${j.where}</small></div></div>`));
 return `<div class="mscrim" data-fx></div><div class="pal"><div class="palh">${ic('search')}<input data-palq value="${S.pal.q||''}" placeholder="Search songs, setlists, shows, practices and jams"><kbd>ESC</kbd></div><div class="palc"><span class="r-chip ${S.pal.all?'':'on'}" data-palall="0">${CTXN[S.ctx]}</span><span class="r-chip ${S.pal.all?'on':''}" data-palall="1">All contexts</span></div><div class="palr">${res||`<div class="ne">Nothing matches "${S.pal.q}" in ${S.pal.all?'any context':CTXN[S.ctx]}.${S.pal.all?'':' <span class="r-btn text" data-palall="1">Search all contexts</span>'}</div>`}</div></div>`};

// ---------- dialogs ----------
const FR={tab:0,q:'',sent:[]};const PEOPLE=[['Dana Ruiz','Bass, vocals · 2 mutual','DANA-1187'],['Darren Holt','Guitar · Seattle','DARR-4410'],['Kai Moreno','Drums · met at Birthday Jam','KAIM-0923'],['Lena Ortiz','Vocals, guitar','LENA-5531'],['Pete Walsh','Guitar · 1 mutual','PETE-7702']];
const D={
 friend:()=>{const q=FR.q.trim().toLowerCase();const r=FR.tab===0?(q.length>1?PEOPLE.filter(p=>p[0].toLowerCase().includes(q)):[]):(q.length>=4?PEOPLE.filter(p=>p[2].toLowerCase().startsWith(q.replace(/\s/g,''))):[]);
  return dlg('Add a friend',`<div style="margin-bottom:12px">${seg(['By name','Friend code'],FR.tab,'data-frt')}</div><div class="pfl"><input data-frq value="${FR.q}" placeholder="${FR.tab?'e.g. DANA-1187':'Search by name'}"></div>
${r.length?grp(r.map(p=>`<div class="lrow" style="cursor:default"><span class="avm">${p[0][0]}</span><div class="g"><b>${p[0]}</b><small>${p[1]}</small></div>${FR.sent.includes(p[0])?'<span class="r-m r-muted">REQUEST SENT</span>':btn('Add',{kind:'pri',attr:`data-fradd="${p[0]}"`})}</div>`).join('')):q?`<p class="r-m r-muted">${FR.tab?'NO ONE WITH THAT CODE YET':'NO ONE FINDABLE BY THAT NAME. ASK FOR THEIR CODE INSTEAD.'}</p>`:''}
<div class="k" style="margin:16px 0 6px">Or share yours</div>${grp(`<div class="jacc"><div class="qr2"><i>${ic('hand')}</i></div><div><b class="jcode">ERIC-2291</b><div class="btns" style="margin:10px 0 0">${btn('Copy',{icon:'copy',attr:'data-a="toast" data-m="Friend code copied"'})}${btn('Share link',{icon:'share',attr:'data-a="toast" data-m="Link copied: rockon.band/f/ERIC-2291"'})}</div></div></div>`)}`,btn('Done',{kind:'pri',attr:'data-fx'}),520)},
 join:()=>{const c=(F.code||'').toUpperCase().trim();const jam=/^LUCK|^MIKE|^JAM/.test(c)&&c.length>=6,band=/^ROCK|^DUO/.test(c)&&c.length>=6;
  return dlg('Join with a code',`<p>Band invite or jam code. You'll see what it is before you join.</p><div class="pfl"><input data-jcq value="${F.code||''}" placeholder="e.g. LUCK-42 or ROCK-7Q4X" style="text-transform:uppercase;font-family:var(--r-fm)"></div>
${jam?grp(`<div class="lrow" style="cursor:default"><span class="tyi evt">${ic('party')}</span><div class="g"><b>Tuesday Open Jam</b><small>Jam · Lucky's Tavern · Tue, Nov 3 · 8 PM · hosted by Eric</small></div></div>`):band?grp(`<div class="lrow" style="cursor:default"><i class="bmk" style="width:36px;height:36px;border-radius:11px;background:#2dd4bf;color:#032b26;font-family:var(--r-fd);font-weight:900;font-size:15px;display:grid;place-items:center;font-style:normal">AD</i><div class="g"><b>Acoustic Duo</b><small>Band · Sarah, Eric · 14 songs</small></div></div>`):c.length>=6?'<p class="r-m r-muted">NO JAM OR BAND WITH THAT CODE. CHECK THE LETTERS, OR ASK FOR THE LINK.</p>':''}`,
  btn('Cancel',{attr:'data-fx'})+(jam?`<a class="r-btn pri" href="Jam%20Night.html#guest" target="_blank" data-fx>${ic('arrow','width:18px;height:18px')}Open as a guest</a>`:band?btn('See the band',{kind:'pri',attr:'data-jcband'}):btn('Look up',{kind:'pri',attr:'class-dis'}).replace('r-btn pri','r-btn pri dis')),480)},
 regen:()=>dlg('Regenerate the invite code?',`<p><b>${S.bcode||'ROCK-7Q4X'}</b> and its link stop working straight away. Members who already joined stay. Anyone holding the old link will need the new one.</p>`,btn('Keep this code',{attr:'data-fx'})+btn('Regenerate',{kind:'dng',attr:'data-regengo'})),
 pwd:()=>dlg('Change password',`<div class="pfl"><label>Current password</label><input type="password" value="hunter22"></div><div class="pfl"><label>New password <em>at least 8 characters</em></label><input type="password" data-pw1 value="${F.pw||''}"></div>`,btn('Cancel',{attr:'data-fx'})+btn('Change password',{kind:'pri',attr:'data-pwgo'}).replace('r-btn pri','r-btn pri '+((F.pw||'').length>=8?'':'dis'))),
 ins:()=>{const L=S.ins||(S.ins=['Guitar','Vocals']);const ALL=['Guitar','Vocals','Bass','Drums','Keys','Harmonica','Violin','Sax','Trumpet','Banjo','Mandolin','Percussion'];
  return dlg('Instruments',`<p>In the order people see them. The first shows first. There's no "primary"; you pick a part each time you jam.</p>${grp(L.map((x,i)=>`<div class="lrow" style="cursor:default"><span class="n" style="width:18px;font-family:var(--r-fm);font-size:11px;color:var(--mu)">${i+1}</span><div class="g"><b>${x}</b></div><span class="ibx" data-insmv="${i}:-1" title="Move up">${ic('up')}</span><span class="ibx" data-insmv="${i}:1" title="Move down">${ic('down')}</span><span class="ibx" data-insrm="${i}" title="Remove">${ic('x')}</span></div>`).join(''))}<div class="tpick">${ALL.filter(a=>!L.includes(a)).map(a=>`<span class="r-chip" data-insadd="${a}">${ic('plus','width:14px;height:14px')}${a}</span>`).join('')}</div>`,btn('Done',{kind:'pri',attr:'data-fx'}),520)},
 copyset:()=>dlg('Add a set',`<p>The show gets its own copy. Edits on the show never change the setlist.</p>${grp(SETS.map(x=>{let n=0,t=0;x.items.forEach(i=>{if(typeof i==='string'){n++;t+=secs(byId(i).dur)}});return `<div class="lrow" data-shcp="${x.id}">${ic('list')}<div class="g"><b>${x.name}</b><small>${n} songs · ${Math.round(t/60)} min</small></div><span class="r-m" style="color:var(--accink)">COPY</span></div>`}).join(''))}`,btn('Cancel',{attr:'data-fx'}),500),
 pick:()=>{const L=SONGS.filter(s=>!s.mine);F.pk=F.pk||new Set(L.map(s=>s.id));return dlg('Copy band songs into My Songs',`<p>Pick the ones you want. Copies stay linked to iPod Shuffle and carry a "from iP" tag.</p>${grp(L.map(s=>`<div class="lrow" data-pk="${s.id}"><span class="ck2 ${F.pk.has(s.id)?'':'no'}">${F.pk.has(s.id)?ic('check'):''}</span><div class="g"><b>${s.title}</b><small>${s.artist}</small></div>${tp(s.tun,'sm')}</div>`).join(''))}`,btn('Cancel',{attr:'data-fx'})+btn(`Copy ${F.pk.size}`,{kind:'pri',attr:'data-pkgo'}),520)}};

// ---------- auth: forgot password + check your email ----------
V.forgot=()=>`<div class="auth"><div class="aw"><div class="tvwm"><span class="nut"></span>Rock On</div><h2 class="ah">Reset your password</h2><p class="tag">We'll email a link that works for an hour.</p><div class="pfl"><label>Email</label><input value="eric@ipodshuffle.band"></div>${btn('Send reset link',{kind:'pri',size:'lg',attr:'data-mv="checkmail"'})}<div class="arow"><span class="r-btn text" data-mv="signin">Back to sign in</span></div></div></div>`;
V.checkmail=()=>`<div class="auth"><div class="aw" style="text-align:center;align-items:center"><span class="ckm">${ic('mail')}</span><h2 class="ah">Check your email</h2><p class="tag">We sent a link to <b>eric@ipodshuffle.band</b>. Open it on this computer to carry on. It works for an hour.</p>${btn('Open mail',{kind:'pri',size:'lg',attr:'data-mv="getstarted"'}).replace('class="r-btn','class="r-btn wfull')}<div class="arow" style="justify-content:center;gap:18px"><span class="r-btn text" data-a="toast" data-m="Sent again · check spam if it's not there">Resend</span><span class="r-btn text" data-mv="signin">Use a different email</span></div></div></div>`;

// ---------- states panel (demo only): one drawn instance of every state ----------
const STV=[['songs','Songs',[['loading','Loading'],['empty','Empty'],['error','Error + Retry'],['nomatch','No matches']]],['calendar','Calendar',[['error','Error + Retry'],['empty','Empty']]],['home','Home',[['offline','Offline banner']]],['jam','Jam',[['empty','No jams yet']]],['setlists','Setlists',[['empty','Empty set']]]];
const stPanel=()=>`<div class="stp2 ${F.st?'on':''}"><span class="stb" data-stp>${ic('eye')}States</span>${F.st?`<div class="stl"><b>Preview a state</b><small>Every list has empty, loading and error. Pick one; it opens on that screen.</small>${STV.map(([v,l,ks])=>`<div class="sg"><em>${l}</em>${ks.map(([k,kl])=>`<span class="r-chip ${S.dstate&&S.dstate.v===v&&S.dstate.k===k?'on':''}" data-stv="${v}:${k}">${kl}</span>`).join('')}</div>`).join('')}${S.dstate?btn('Back to normal',{attr:'data-stv="clear"'}):''}</div>`:''}</div>`;
const oh=V.home;V.home=()=>{let h=oh();if(S.dstate&&S.dstate.v==='home')h=h.replace('<div class="pane" style="flex:1">',`<div class="ban dk">${ic('offline')}<div><b>You're offline</b>Showing what's saved on this computer. Changes you make sync when you're back.</div></div><div class="pane" style="flex:1">`);return h};

// ---------- band: invite code follows Regenerate ----------
const ob=V.band;V.band=()=>ob().replace('ROCK-7Q4X',S.bcode||'ROCK-7Q4X').replace(/<span class="r-btn  " >(<svg[^]*?<\/svg>Edit band info<\/span>)/,'<span class="r-btn" data-mv="bandnew">$1');
const of=V.friends;V.friends=()=>of().replace(`data-a="toast" data-m="Search by name or friend code"`,'data-fd="friend"').replace(/(<div class="r-gl">Sent · )1(<\/div>[\s\S]*?<\/div><\/div><\/div>)/,(m,a,b)=>a+(1+FR.sent.length)+b.replace(/(<div class="lrow"><span class="avm">L<\/span>)/,FR.sent.map(n=>`<div class="lrow"><span class="avm">${n[0]}</span><div class="g"><b>${n}</b><small>Pending · sent just now</small></div><span class="ibx" title="Cancel request">${ic('x')}</span></div>`).join('')+'$1'));

// ---------- wrap every view with this file's overlays ----------
Object.keys(V).forEach(k=>{const f=V[k];V[k]=()=>f()+(S.pal?pal():'')+(F.d&&D[F.d]?D[F.d]():'')+(['signin','getstarted','join','forgot','checkmail','jamtv','kiosk','session'].includes(S.v)?'':stPanel())});
const reRender=(sel,key)=>{const n=app.querySelector(sel);const p=n?n.selectionStart:0;render();const m=app.querySelector(sel);if(m){m.focus();try{m.setSelectionRange(p,p)}catch(_){}}};
const TOASTMAP={'Reset link sent · works for 1 hour':()=>{S.v='forgot';render()},'Join with a code: same preview as mobile':()=>{F.d='join';F.code='';render()},'Global search':()=>{S.pal={q:''};render()}};

// ---------- events ----------
app.addEventListener('click',e=>{const t=e.target,c=s=>t.closest(s);let x;const st=()=>e.stopPropagation();
 if(S.menu==='calnew'&&c('.dkm .o')){S.menu=null;setTimeout(render,0)}
 if(x=c('.ev[data-ev]')){const ev0=EV.find(z=>z.id===x.dataset.ev);if(ev0&&ev0.ty==='evt'&&DK.J){const k=DK.J.jams.findIndex(j=>j.id===ev0.id||j.name===ev0.t);if(k>=0)DK.J.sel(k)}}
 if((x=c('[data-a="toast"]'))&&TOASTMAP[x.dataset.m]){st();TOASTMAP[x.dataset.m]();return}
 if(c('[data-fx]')&&!c('.mdlg .lrow')){st();F.d=null;F.wrap=false;S.pal=null;F.kp=false;render();return}
 if(c('[data-shownew]')){st();newShow();return}
 if(c('[data-pal]')){st();S.pal={q:'',all:0};render();setTimeout(()=>app.querySelector('[data-palq]')?.focus());return}
 if(x=c('[data-palall]')){st();S.pal.all=+x.dataset.palall;reRender('[data-palq]');return}
 if(x=c('[data-pgo]')){st();const [k,v]=x.dataset.pgo.split(':');S.pal=null;if(k==='song'){S.sel=v;S.v='songs'}else if(k==='set'){S.set=v;S.v='setlists'}else if(k==='ev'){S.ev=v;S.evf='';S.v='calendar'}else{DK.J.sel(+v);S.v='jamplan'}render();return}
 if(x=c('[data-fd]')){st();F.d=x.dataset.fd;FR.q='';render();setTimeout(()=>app.querySelector('[data-frq]')?.focus());return}
 if(c('[data-joincode]')){st();F.d='join';F.code='';render();setTimeout(()=>app.querySelector('[data-jcq]')?.focus());return}
 if(c('[data-jcband]')){st();F.d=null;S.v='join';render();return}
 if(x=c('[data-frt] span')){st();FR.tab=[...x.parentNode.children].indexOf(x);FR.q='';render();return}
 if(x=c('[data-fradd]')){st();FR.sent.push(x.dataset.fradd);render();toast('Request sent to '+x.dataset.fradd);return}
 if(c('[data-regen]')){st();F.d='regen';render();return}
 if(c('[data-regengo]')){st();S.bcode='ROCK-'+Math.random().toString(36).slice(2,6).toUpperCase();F.d=null;render();toast('New code '+S.bcode+' · the old one no longer works');return}
 if(c('[data-pwd]')){st();F.d='pwd';F.pw='';render();return}
 if(x=c('[data-pwgo]')){st();if(x.classList.contains('dis'))return;F.d=null;render();toast('Password changed · other devices stay signed in');return}
 if(c('[data-insed]')){st();F.d='ins';render();return}
 if(x=c('[data-insmv]')){st();const [i,d]=x.dataset.insmv.split(':').map(Number),k=i+d,L=S.ins;if(k<0||k>=L.length)return;[L[i],L[k]]=[L[k],L[i]];render();return}
 if(x=c('[data-insrm]')){st();S.ins.splice(+x.dataset.insrm,1);render();return}
 if(x=c('[data-insadd]')){st();S.ins.push(x.dataset.insadd);render();return}
 if(c('[data-cpick]')){st();F.d='pick';F.pk=null;render();return}
 if(x=c('[data-pk]')){st();const id=x.dataset.pk;F.pk.has(id)?F.pk.delete(id):F.pk.add(id);render();return}
 if(c('[data-pkgo]')){st();S.copied=1;const n=F.pk.size;F.d=null;render();toast(n+' songs copied into My Songs');return}
 // show (edit in place)
 const ev=curEv();
 if(c('[data-shconf]')){st();ev.conf=!ev.conf;ev.cf=ev.conf;render();return}
 if(x=c('[data-shslot]')){st();ev.slot=Math.max(10,ev.slot+(+x.dataset.shslot));render();return}
 if(x=c('[data-shrsvp]')){st();ev.rsvp=+x.dataset.shrsvp;render();return}
 if(c('[data-shcopy]')){st();F.d='copyset';render();return}
 if(x=c('[data-shcp]')){st();const o=SETS.find(z=>z.id===x.dataset.shcp);const cp={id:'c'+Date.now(),name:(ev.t||ev.venue||'Show')+' set',show:`${ev.venue||'Show'} · ${cap(ev.dw)}, ${cap(ev.m)} ${ev.d}`,slot:ev.slot,items:JSON.parse(JSON.stringify(o.items))};SETS.push(cp);ev.set=cp.id;ev.draft=0;F.d=null;render();toast('Copied '+o.name+' · edits here stay on this show');return}
 if(c('[data-shnewset]')){st();const cp={id:'c'+Date.now(),name:(ev.t||ev.venue||'Show')+' set',show:`${ev.venue||'Show'} · ${cap(ev.dw)}, ${cap(ev.m)} ${ev.d}`,slot:ev.slot,items:[]};SETS.push(cp);ev.set=cp.id;ev.draft=0;S.set=cp.id;S.v='setlists';S.lib=true;render();return}
 if(c('[data-shdisc]')){st();EV.splice(EV.indexOf(ev),1);S.ev=(EV.find(z=>!z.past)||EV[0]).id;render();toast('Draft discarded');return}
 if(c('[data-shcx]')){st();ev.cx=!ev.cx;render();toast(ev.cx?'Marked cancelled · Undo':'Cancel undone');return}
 // practice session
 if(x=c('[data-sess]')){st();PS.i=0;PS.t0=Date.now();PS.skip=new Set();F.wrap=false;S.v='session';render();clearInterval(tick);tick=setInterval(()=>{if(S.v!=='session'){clearInterval(tick);return}const el=Math.floor((Date.now()-PS.t0)/1000),n=app.querySelector('[data-sclock]');if(n)n.textContent=`${Math.floor(el/60)}:${p2(el%60)}`},1000);return}
 if(x=c('[data-sesg]')){st();const d=+x.dataset.sesg;if(PS.i+d>=PS.songs.length){F.wrap=true;render();return}PS.i=Math.max(0,PS.i+d);render();return}
 if(c('[data-sesn]')){st();PS.notes=!PS.notes;render();return}
 if(c('[data-sesskip]')){st();const id=PS.songs[PS.i];PS.skip.has(id)?PS.skip.delete(id):PS.skip.add(id);render();return}
 if(c('[data-sesend]')){st();F.wrap=true;render();return}
 if(c('[data-sesx]')){st();S.v='calendar';render();toast('Left the session · nothing saved');return}
 if(c('[data-wrapsave]')){st();F.wrap=false;S.v='phist';render();toast('Saved to Practice history');return}
 // chart editor
 if(c('[data-ceopen]')){st();openChart('songedit');return}
 if(c('[data-cex]')){st();S.v=CE.from==='songedit'&&DK.ED?'songedit':'songs';render();return}
 if(c('[data-cesave]')){st();if(DK.ED)DK.ED.chart=CE.txt,DK.ED.sn=CE.sn;S.v=DK.ED?'songedit':'songs';render();toast('Chart saved');return}
 if(c('[data-cesample]')||c('[data-cepaste]')){st();CE.txt=chartText();render();toast(c('[data-cepaste]')?'Pasted · chords and sections detected':'Sample loaded');return}
 if(c('[data-ceclr]')){st();CE.txt='';render();return}
 if(c('[data-cesn]')){st();const m={C4:60,D4:62,E4:64,G4:67}[CE.sn];DK.pluck&&DK.pluck(m);return}
 if(x=c('[data-cesnp] span')){st();CE.sn=['C4','D4','E4','G4'][[...x.parentNode.children].indexOf(x)];render();return}
 if(x=c('[data-cemode] span')){st();CE.mode=[...x.parentNode.children].indexOf(x)?'conly':'full';render();return}
 // song editor extras
 if(x=c('[data-spk]')){st();const m=SP[+x.dataset.spk],E=DK.ED;Object.assign(E,{title:m[0],artist:m[1],album:m[2],dur:m[3],tun:m[4],key:m[5],bpm:m[6],sp:1});if(!E.links.includes('audio'))E.links.unshift('audio');render();toast('Filled from Spotify · check the tuning');return}
 if(c('[data-kpo]')){st();F.kp=!F.kp;render();return}
 if(x=c('[data-kpk]')){st();DK.ED.key=x.dataset.kpk;F.kp=false;render();return}
 if(c('[data-amys]')){st();DK.ED.amys=DK.ED.amys===false;render();return}
 // host a jam
 if(c('[data-hjgo]')){st();if(!HJ.name)return;const d=new Date(HJ.date+'T00:00');const J=DK.J;const j={id:'j'+Date.now(),name:HJ.name,m:d.toLocaleDateString('en-US',{month:'short'}).toUpperCase(),d:String(d.getDate()),dw:cap(DOW[d.getDay()]),when:`${cap(DOW[d.getDay()])}, ${d.toLocaleDateString('en-US',{month:'short'})} ${d.getDate()} · ${t12(HJ.time).replace(':00','')}`,where:HJ.where||'Place TBD',code:mkCode(HJ.name),who:0,reqs:1,appr:0,sets:0,data:{live:false,q:[],req:[],ppl:[['Eric','Gtr, vox','Host']],hands:[],stage:{n:'—',s:'Not started',of:''}}};
  J.jams.push(j);J.sel(J.jams.length-1);EV.push({id:j.id,m:j.m,d:j.d,dw:DOW[d.getDay()],t:j.name,sub:`${t12(HJ.time)} · ${j.where}`,ty:'evt'});Object.assign(HJ,{name:'',where:''});S.v='jamplan';render();toast(`${j.name} created · code ${j.code}`);return}
 // states panel
 if(c('[data-stp]')){st();F.st=!F.st;render();return}
 if(F.st&&!c('.stp2')){F.st=false;setTimeout(render,0)}
 if(x=c('[data-stv]')){st();const v=x.dataset.stv;if(v==='clear'){S.dstate=null;S.q='';render();return}const [vv,k]=v.split(':');S.dstate={v:vv,k};S.q='';F.st=false;
  if(vv==='songs'&&k==='nomatch'){S.dstate=null;S.q='Radiohead'}
  if(vv==='setlists'&&k==='empty'){S.dstate=null;const ns={id:'s'+Date.now(),name:'New setlist',show:'',slot:0,items:[]};SETS.push(ns);S.set=ns.id}
  S.v=vv;render();return}
},true);
app.addEventListener('input',e=>{const t=e.target;
 if(t.matches('[data-palq]')){S.pal.q=t.value;reRender('[data-palq]');return}
 if(t.matches('[data-frq]')){FR.q=t.value;reRender('[data-frq]');return}
 if(t.matches('[data-jcq]')){F.code=t.value;reRender('[data-jcq]');return}
 if(t.matches('[data-pw1]')){F.pw=t.value;reRender('[data-pw1]');return}
 if(t.matches('[data-cetx]')){CE.txt=t.value;const sc=t.scrollTop;reRender('[data-cetx]');const n=app.querySelector('[data-cetx]');if(n)n.scrollTop=sc;return}
 if(t.matches('[data-hjf]')){HJ[t.dataset.hjf]=t.value;reRender(`[data-hjf="${t.dataset.hjf}"]`);return}
 if(t.matches('[data-ef="album"]')){DK.ED.album=t.value;return}
 if(t.matches('[data-ef="title"]')&&DK.ED)DK.ED.sp=0;
 if(t.matches('[data-shf]')){const ev=curEv();ev[t.dataset.shf]=t.value;shUpd(ev);const k=t.dataset.shf;const sel=`[data-shf="${k}"]`;
  // update the agenda row live without losing focus
  const row=app.querySelector(`.ev[data-ev="${ev.id}"] .g`);if(row)row.innerHTML=`<b>${ev.t||ev.venue||'New show'}</b><small>${ev.sub}</small>`;return}});
window.addEventListener('rp-change',e=>{const {id,value}=e.detail;
 if(id.startsWith('sh-')){const ev=curEv();if(!ev)return;const k=id.slice(3);if(k==='date'){ev.date=value;setEv(ev)}else if(k==='time')ev.time=value;else if(k==='load')ev.load=value;else if(k==='sc')ev.sc=value;shUpd(ev);ev.draft=ev.draft&&!ev.venue?1:0;render();return}
 if(id==='hj-date'){HJ.date=value;render()}else if(id==='hj-time'){HJ.time=value;render()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(S.pal||F.d||F.kp)){S.pal=null;F.d=null;F.kp=false;render();return}
 if(e.key==='Enter'&&S.pal&&e.target.matches('[data-palq]')){const f=app.querySelector('[data-pgo]');if(f)f.click();return}
 if(S.v==='session'&&!e.target.matches('input,textarea')){if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();app.querySelector('[data-sesg="1"]')?.click()}else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();app.querySelector('[data-sesg="-1"]')?.click()}else if(e.key==='n'||e.key==='N'){PS.notes=!PS.notes;render()}}});
render();
})();
