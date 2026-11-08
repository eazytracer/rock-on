// Desktop Jam: hub · planned jam (Lineup / Requests / People → Go live) · host console · bar TV · venue kiosk.
// Same behaviour as the mobile Jam pages (demo/screens/Jam *.html); desktop swaps swipes for hover actions + right-click.
(()=>{const {S,V,app,render,head,toast}=DK,{ic,btn,seg,grp,gl,chip}=Rock;
const J={live:false,tab:0,tvs:0,menu:null,walk:false,
 q:[{n:"Dana's group",s:'Plush, Black, Everlong',p:[['Vox','Dana'],['Gtr','Tom'],['Bass','Ray'],['Drums','']],set:3},
    {n:'Frank + Sam',s:'Creep',p:[['Vox','Sam'],['Gtr','Frank'],['Bass',''],['Drums','Kai']],set:1},
    {n:'Lena',s:'Seven Nation Army',p:[['Vox','Lena'],['Gtr','Lena'],['Bass','Mo'],['Drums','Kai']],set:1},
    {n:'Pete + Mo',s:'Song 2',p:[['Vox','Pete'],['Gtr',''],['Bass','Mo'],['Drums','']],set:2}],
 stage:{n:"Lena's group",s:'Zombie',of:'song 2 of 3'},
 hands:[['Kai','Drums','Black, Creep'],['Ray','Bass','Plush, Song 2'],['Jess','Keys','Zombie']],
 house:[['Mike','Bass'],['Sarah','Drums']],
 req:[['Black','Pearl Jam',3,'needs bass'],['Creep','Radiohead',2,'needs bass'],['Song 2','Blur',1,'needs gtr, drums'],['Plush','Stone Temple Pilots',4,'ready']],
 ppl:[['Dana','Vox, bass','App'],['Tom','Gtr','App'],['Kai','Drums','Web'],['Lena','Vox, gtr','App'],['Frank','Gtr','Walk-up'],['Sam','Vox','Walk-up'],['Ray','Bass','Web'],['Mo','Bass','App']]};
// Nov 7: several jams. The working fields (q, req, ppl, hands, stage, live) belong to the open jam; selJam swaps them.
J.jams=[{id:'tue',name:'Tuesday Open Jam',m:'NOV',d:'3',dw:'Tue',when:'Tue, Nov 3 · 8 PM',where:"Lucky's Tavern",code:'LUCK-42',who:0,reqs:1,appr:0,sets:1},
 {id:'bday',name:'Birthday Jam',m:'NOV',d:'14',dw:'Sat',when:'Sat, Nov 14 · 7 PM',where:"Mike's Garage",code:'MIKE-14',who:1,reqs:1,appr:1,sets:0,data:{live:false,q:[{n:'Mike + Sarah',s:'Basket Case',p:[['Vox','Eric'],['Gtr','Eric'],['Bass','Mike'],['Drums','Sarah']],set:1}],req:[['Seven Nation Army','The White Stripes',2,'needs bass']],ppl:[['Mike','Bass','App'],['Sarah','Drums','App'],['Dana','Vox, bass','App']],hands:[],stage:{n:'—',s:'Not started',of:''}}}];
J.cur=0;const KEYS=['live','q','req','ppl','hands','stage'];
const selJam=k=>{if(k===J.cur)return;const o=J.jams[J.cur];o.data={};KEYS.forEach(f=>o.data[f]=J[f]);const n=J.jams[k];if(n.data)KEYS.forEach(f=>J[f]=n.data[f]);J.cur=k;J.tab=0};
J.sel=selJam;const CJ=()=>J.jams[J.cur];
const ty=`<span class="r-ty evt">${ic('party')}JAM</span>`;
const chipP=([p,n])=>`<span class="jp ${n?'':'no'}">${p}${n?` · ${n}`:''}</span>`;
const open=g=>g.p.filter(x=>!x[1]).map(x=>x[0]);
// ---------- hub ----------
V.jam=()=>{const st=DK.S.dstate&&DK.S.dstate.v==='jam';const host=st?[]:J.jams;const liveJ=J.jams.findIndex((j,i)=>i===J.cur?J.live:j.data&&j.data.live);
 return head(DK.S.ctx==='personal'?'Personal':'iPod Shuffle','Jam',null,btn('Join with a code',{icon:'qr',attr:'data-joincode'})+btn('Host a jam',{kind:'pri',icon:'plus',attr:'data-jv="jamnew"'}))+`<div class="pane" style="flex:1"><div class="jhub">
${liveJ>=0&&!st?`<div class="jlive" data-jsel="${liveJ}" data-jv="jamhost"><span class="lv"><i></i>LIVE NOW</span><b>${J.jams[liveJ].name}</b><small>${J.jams[liveJ].where} · ${J.q.length} in the queue · ${J.hands.length} hands up</small>${btn('Return to console',{kind:'pri',icon:'arrow'})}</div>`:''}
${host.length?`<div><div class="r-gl" style="padding-left:2px">Hosting · ${host.length}</div>${grp(host.map((j,i)=>{const d=i===J.cur?J:j.data||{q:[],req:[],ppl:[]};return `<div class="lrow" data-jsel="${i}" data-jv="jamplan"><div class="db"><small>${j.m}</small><b>${j.d}</b></div><div class="g"><b>${j.name}</b><small>${j.where} · ${j.when.split(' · ')[1]} · ${(i===J.cur?J.live:d.live)?'live':'scheduled'} · ${d.ppl.length} people · ${d.req.length} requests</small></div>${ty}${ic('chev','width:16px;height:16px;color:var(--dim)')}</div>`}).join(''))}</div>`
:`<div class="dst" style="padding-top:30px">${ic('party')}<b>No jams yet</b><p>Host one in two fields: a name and a time. Lineup, requests and access come after.</p><div class="btns" style="justify-content:center">${btn('Host a jam',{kind:'pri',icon:'plus',attr:'data-jv="jamnew"'})}${btn('Join with a code',{icon:'qr',attr:'data-joincode'})}</div></div>`}
${st?'':`<div><div class="r-gl" style="padding-left:2px">Invited · 1</div>${grp(`<a class="lrow" href="Jam%20Night.html#guest" target="_blank" style="color:inherit;text-decoration:none"><div class="db"><small>NOV</small><b>13</b></div><div class="g"><b>Sarah's house session</b><small>6 PM · Going · opens the guest view (phone / web)</small></div>${ty}${ic('open','width:16px;height:16px;color:var(--dim)')}</a>`)}</div>`}
<p class="jnote">Jam is never required: walk-ups go in by name, guests can use the web without an account, and "just tell the host" always works. <a href="Jam%20Night.html" target="_blank">Open the working jam prototype</a> to run a whole night with host and guest windows side by side.</p></div></div>`};
// ---------- planned ----------
V.jamplan=()=>{const tabs=['Lineup','Requests','People'];let body='';const j=CJ();
 const emp=(t,p)=>`<div class="jg"><div class="g"><b>${t}</b><small>${p}</small></div></div>`;
 if(J.tab===0&&!J.q.length)body=emp('No one on the lineup yet','Share the code. Approved requests and walk-ups land here.')+`<div class="jg">${btn('Add a walk-up',{icon:'plus',attr:'data-a2="walk"'})}</div>`;
 else if(J.tab===1&&!J.req.length)body=emp('No requests yet','Guests pitch songs with the parts they need. You approve them here.');
 else if(J.tab===2&&!J.ppl.length)body=emp('Nobody yet','People who join with the code, the web page or the counter iPad show up here.');
 else if(J.tab===0)body=J.q.map((g,i)=>`<div class="jg"><span class="n">${i+1}</span><div class="g"><b>${g.n}</b><small>${g.s}${g.set>1?` · ${g.set}-song set`:''}</small><div class="jps">${g.p.map(chipP).join('')}</div></div></div>`).join('');
 else if(J.tab===1)body=J.req.map(([t,a,n,st])=>`<div class="jg"><div class="g"><b>${t}</b><small>${a} · ${st}</small></div><span class="jcov"><b>${n}</b> in</span></div>`).join('');
 else body=J.ppl.map(([n,p,v])=>`<div class="jg"><span class="jav">${n[0]}</span><div class="g"><b>${n}</b><small>${p}</small></div><span class="r-m r-muted">${v.toUpperCase()}</span></div>`).join('');
 return `<div class="hd" style="padding-bottom:6px"><span class="r-btn back" data-jv="jam">${ic('back')}Jam</span></div>`+head(`Jam · ${j.when} · ${j.where}`,j.name,null,btn('Show on TV',{icon:'tv',attr:'data-jv="jamtv"'})+btn('Counter iPad',{icon:'qr',attr:'data-jv="kiosk"'})+btn(J.live?'Open console':'Go live',{kind:'pri',icon:J.live?'arrow':'play',attr:'data-a2="golive"'}))+
 `<div class="split jpl"><div class="pane"><div class="dp" style="padding-top:12px"><div style="width:360px;margin-bottom:14px">${seg(tabs,J.tab,'data-jtab')}</div>${grp(body)}</div></div>
<div class="pane side"><div class="dp"><div class="k">Access</div>${grp(`<div class="jacc"><div class="qr2"><i>${ic('hand')}</i></div><div><b class="jcode">${j.code}</b><small>rockon.band/j/${j.code}</small><div class="btns" style="margin:10px 0 0">${btn('Copy link',{icon:'copy',attr:'data-a="toast" data-m="Link copied"'})}${btn('Print table tent',{icon:'doc',attr:'data-a="toast" data-m="Table tent: print layout as mobile"'})}</div></div></div>`)}
<div class="k" style="margin-top:6px">Settings</div>${grp(`<div class="jset"><div class="g"><b>Who can join</b><small>${['Anyone with the code','Friends and bandmates'][j.who]}</small></div><div style="width:190px">${Rock.seg(['Code','Friends'],j.who,'data-jwho')}</div></div><div class="jset" data-jtg="reqs"><div class="g"><b>Song requests</b><small>Guests pitch songs with the parts they need</small></div>${Rock.sw(j.reqs)}</div><div class="jset" data-jtg="appr"><div class="g"><b>Approve requests myself</b><small>${j.appr?'Requests wait for you':'Requests go straight onto the lineup'}</small></div>${Rock.sw(j.appr)}</div><div class="jset" data-jtg="sets"><div class="g"><b>Suggest groups of 3</b><small>Shown as "song 2 of 3". Never blocks a one-song pitch.</small></div>${Rock.sw(j.sets)}</div>`)}</div></div></div>`};
// ---------- host console ----------
const nextCard=()=>{const g=J.q[0];if(!g)return `<div class="jnext empty"><div class="k">QUEUE EMPTY</div><h3>Stage is quiet</h3><p>Nudge the people who know a song that's one player away.</p>${btn('Ask the room',{kind:'pri',size:'lg',icon:'bell',attr:'data-a="toast" data-m="Nudged 6 people who can fill open songs"'})}</div>`;
 const o=open(g);return `<div class="jnext"><div class="k">UP NEXT</div><h3>${g.n}</h3><div class="s">${g.s}${g.set>1?` · ${g.set}-song set`:''}</div><div class="jps big">${g.p.map(chipP).join('')}</div>
 ${o.length?`<div class="jfill"><span>Open: <b>${o.join(', ')}</b></span>${btn('From hands',{attr:'data-jfill="hand"'})}${btn('House player',{attr:'data-jfill="house"'})}${btn('Ask the room',{attr:'data-a="toast" data-m="Asked the room for '+o.join(' + ')+'"'})}</div>`:''}
 <div class="go">${btn(o.length?'Call up anyway':'Call them up',{kind:'pri',size:'xl',icon:'arrow',attr:'data-a2="callup"'})}${btn('Skip',{size:'xl',attr:'data-qact="0:Skipped"'})}</div></div>`};
const qrow=(g,i)=>`<div class="jq" data-qi="${i}"><span class="gp">${ic('grip')}</span><div class="g"><b>${g.n}</b><small>${g.s} · ${open(g).length?'needs '+open(g).join(', ').toLowerCase():'ready'}</small></div><div class="jqa">${[['up','Up next','Next'],['check','Played','Played'],['out','Left','Left'],['x','Remove','Removed']].map(([i2,t,v])=>`<span class="ibx" title="${t}" data-qact="${i}:${v}">${ic(i2)}</span>`).join('')}</div></div>`;
V.jamhost=()=>`<div class="hd" style="padding-bottom:6px"><span class="r-btn back" data-jv="jamplan">${ic('back')}${CJ().name}</span></div>`+head(`<span class="lvk"><i></i>LIVE</span> · ${CJ().where} · ${J.ppl.length} here`,'Host console',null,btn('Walk-up',{icon:'plus',attr:'data-a2="walk"'})+btn('Show on TV',{icon:'tv',attr:'data-jv="jamtv"'})+btn('End jam',{attr:'data-a2="end"'}))+
`<div class="split jhc"><div class="pane"><div class="dp" style="padding-top:12px">
<div class="jon">${ic('music','color:var(--mu)')}<div class="g"><small>ON STAGE</small><b>${J.stage.n} · ${J.stage.s}</b></div><span class="r-m r-muted">${J.stage.of||''}</span>${btn('Mark played',{attr:'data-a2="stageDone"'})}</div>
${nextCard()}
${J.q.length>1?`<div class="r-gl" style="padding-left:2px;margin-top:18px">After that · ${J.q.length-1}</div><p class="jhint">Hover a row for actions, right-click for the menu, or drag to reorder. Nothing has to be logged: clear what already happened in one click.</p>${grp(J.q.slice(1).map((g,k)=>qrow(g,k+1)).join(''))}`:''}
${J.walk?`<div class="jwalk"><b>Walk-up</b><div class="jwf"><input placeholder="Name" value="Pete" data-wn><div class="jins">${['Vox','Gtr','Bass','Drums','Keys'].map((x,i)=>`<span class="r-chip ${i===2?'on':''}" data-wp="${x}">${x}</span>`).join('')}</div></div><div class="btns" style="margin:10px 0 0">${btn('Add after next',{attr:'data-a2="wadd"'})}${btn('Call up now',{kind:'pri',attr:'data-a2="wnow"'})}${btn('Cancel',{kind:'text',attr:'data-a2="walk"'})}</div></div>`:''}
</div></div>
<div class="pane side"><div class="dp"><div class="k">Hands up · ${J.hands.length}</div>${grp(J.hands.map(([n,p,s],i)=>`<div class="jh"><span class="jav hb">${ic('hand')}</span><div class="g"><b>${n} · ${p}</b><small>Knows ${s}</small></div>${btn('Add',{attr:`data-hadd="${i}"`})}</div>`).join('')||`<div class="jg"><div class="g"><small>No hands up</small></div></div>`)}
<div class="k">House players</div>${grp(J.house.map(([n,p])=>`<div class="jh"><span class="jav">${n[0]}</span><div class="g"><b>${n} · ${p}</b><small>On call</small></div></div>`).join(''))}
<div class="k">Looking for someone</div>${grp(J.req.filter(r=>r[3]!=='ready').map(([t,a,n,st])=>`<div class="jh"><div class="g"><b>${t}</b><small>${n} in · ${st}</small></div><span class="jlook">${ic('hand')}${st.replace('needs ','')}</span></div>`).join(''))}</div></div></div>`+
(J.menu!=null?`<div class="jmenu" style="left:${J.menu.x}px;top:${J.menu.y}px">${[['up','Move up next','Next'],['check','Played','Played'],['out','Left','Left'],['people','Edit group',''],['x','Remove','Removed']].map(([i2,t,v])=>`<div class="o ${v==='Removed'?'dng':''}" ${v?`data-qact="${J.menu.i}:${v}"`:'data-a="toast" data-m="Edit names and parts"'}>${ic(i2)}${t}</div>`).join('')}</div>`:'');
// ---------- TV (desktop-only) ----------
const tvSlides=()=>{const g=J.q[0];const sl=[];
 sl.push(`<div class="tvb"><div class="k">ON STAGE NOW</div><h2>${J.stage.s}</h2><div class="ar">${J.stage.n}${J.stage.of?' · '+J.stage.of:''}</div>${g?`<div class="tvu"><div class="k">UP NEXT</div><b>${g.n}</b><span>${g.s}</span></div>`:''}</div>`);
 const lf=J.req.filter(r=>r[3]!=='ready');if(lf.length)sl.push(`<div class="tvb"><div class="k v">LOOKING FOR SOMEONE</div><h2 style="font-size:96px">One player away</h2>${lf.map(([t,a,n,st])=>`<div class="tvr"><div><b>${t}</b><small>${a} · ${n} in</small></div><span>${ic('hand')}${st.replace('needs ','')}</span></div>`).join('')}</div>`);
 sl.push(`<div class="tvb"><div class="tvwm"><span class="nut"></span>Rock On</div><div class="k">THE STAGE IS OPEN</div><h2>Come <em>play</em>.</h2><div class="tvs"><div><i>1</i>Scan the code</div><div><i>2</i>Say what you play</div><div><i>3</i>Raise your hand</div></div><p>Get the app for your songs and history. <b>You don't need it</b>: the web works, or just tell the host.</p></div>`);return sl};
V.jamtv=()=>{const sl=tvSlides();const k=J.tvs%sl.length;return `<div class="tv"><div class="tvt"><span class="lvk"><i></i>LIVE</span><b>${CJ().name}</b><span class="vn">${CJ().where.toUpperCase()}</span><div class="dots">${sl.map((_,i)=>`<i class="${i===k?'on':''}"></i>`).join('')}</div><span class="r-btn" data-jv="jamhost">${ic('x')}Exit TV</span></div>${sl[k]}<div class="tvq"><div class="qr2 big"><i>${ic('hand')}</i></div><b>Scan to join</b><span>CODE <em>${CJ().code}</em></span></div><div class="tvf">${J.ppl.length} HERE · ${J.hands.length} HANDS UP · ROCKON.BAND/J</div><div class="tvp" style="animation-duration:9s"></div></div>`};
// ---------- kiosk (desktop / iPad only) ----------
let KS={name:'',parts:new Set(),done:false};
V.kiosk=()=>`<div class="kio"><div class="kh"><span class="tvwm sm"><span class="nut"></span>Rock On</span><b>${CJ().name} · ${CJ().where}</b><span class="r-btn" data-jv="jamplan">${ic('x')}Exit kiosk</span></div>
${KS.done?`<div class="kdone"><div class="ck">${ic('check')}</div><h2>You're on the list, ${KS.name||'friend'}.</h2><p>The host will call you up. Watch the screen.</p>${btn('Next person',{kind:'pri',size:'xl',attr:'data-a2="knext"'})}</div>`:
`<div class="kf"><div class="kl">YOUR NAME</div><input class="kin" data-kn placeholder="First name is fine" value="${KS.name}"><div class="kl">WHAT DO YOU PLAY?</div><div class="kch">${['Vocals','Guitar','Bass','Drums','Keys','Other'].map(p=>`<span class="${KS.parts.has(p)?'on':''}" data-kp="${p}">${p}</span>`).join('')}</div>
<div class="kl">PICK A SONG <em>OPTIONAL</em></div><div class="kch">${J.req.map(r=>`<span>${r[0]}</span>`).join('')}<span class="add">Something else…</span></div>
${btn('Raise my hand',{kind:'pri',size:'xl',icon:'hand',attr:'data-a2="kgo"'})}<p class="kn">No account, no app. Your name clears at the end of the night.</p></div>`}</div>`;
// ---------- events ----------
let tvT=null;const tvTick=()=>{clearInterval(tvT);if(S.v==='jamtv')tvT=setInterval(()=>{if(S.v!=='jamtv'){clearInterval(tvT);return}J.tvs++;render()},9000)};
const go=v=>{S.v=v;J.menu=null;render();tvTick()};
app.addEventListener('click',e=>{const t=e.target,c=s=>t.closest(s);let x;
 if(J.menu!=null&&!c('.jmenu')){J.menu=null;render();if(!c('[data-qact]'))return}
 if(x=c('[data-jsel]'))selJam(+x.dataset.jsel);
 if(x=c('[data-jtg]')){e.stopPropagation();const k=x.dataset.jtg;CJ()[k]=CJ()[k]?0:1;render();return}
 if(x=c('[data-jwho] span')){e.stopPropagation();CJ().who=[...x.parentNode.children].indexOf(x);render();return}
 if(x=c('[data-jv]')){e.stopPropagation();go(x.dataset.jv);return}
 if(x=c('[data-jtab] span')){e.stopPropagation();J.tab=[...x.parentNode.children].indexOf(x);render();return}
 if(x=c('[data-qact]')){e.stopPropagation();const [i,v]=x.dataset.qact.split(':');const k=+i;const g=J.q[k];if(!g)return;
  if(v==='Next'){J.q.splice(k,1);J.q.unshift(g);toast(g.n+' moved up next')}else{J.q.splice(k,1);toast(`${g.n} · ${v.toLowerCase()} · Undo`)}J.menu=null;render();return}
 if(x=c('[data-jfill]')){e.stopPropagation();const g=J.q[0],o=g.p.find(p=>!p[1]);if(!o)return;if(x.dataset.jfill==='hand'){const h=J.hands.find(h=>h[1].startsWith(o[0].slice(0,3)))||J.hands[0];o[1]=h[0];J.hands=J.hands.filter(z=>z!==h)}else{const h=J.house.find(h=>h[1].startsWith(o[0].slice(0,3)))||J.house[0];o[1]=h[0]+' (house)'}render();toast(o[0]+' filled');return}
 if(x=c('[data-hadd]')){e.stopPropagation();const h=J.hands[+x.dataset.hadd],g=J.q[0];const o=g&&g.p.find(p=>!p[1]);if(o){o[1]=h[0];J.hands.splice(+x.dataset.hadd,1);toast(`${h[0]} on ${o[0]} for ${g.n}`)}else toast('Up next is full · '+h[0]+' stays in hands');render();return}
 if(x=c('[data-kp]')){e.stopPropagation();const p=x.dataset.kp;KS.parts.has(p)?KS.parts.delete(p):KS.parts.add(p);render();return}
 if(x=c('[data-wp]')){e.stopPropagation();x.parentNode.querySelectorAll('.r-chip').forEach(z=>z.classList.toggle('on',z===x));return}
 if(x=c('[data-a2]')){e.stopPropagation();const a=x.dataset.a2;
  if(a==='golive'){J.live=true;go('jamhost');toast('Jam is live · guests can pitch and raise hands');return}
  if(a==='callup'){if(!J.q.length)return;const g=J.q.shift();J.stage={n:g.n,s:g.s.split(',')[0],of:g.set>1?'song 1 of '+g.set:''};render();toast(g.n+' is up · Undo');return}
  if(a==='stageDone'){J.stage={n:'—',s:'Between songs',of:''};render();toast('Marked played');return}
  if(a==='walk'){J.walk=!J.walk;render();return}
  if(a==='wadd'||a==='wnow'){const n=app.querySelector('[data-wn]').value||'Walk-up',p=(app.querySelector('[data-wp].on')||{}).dataset?.wp||'Gtr';J.walk=false;if(a==='wadd'){J.q.splice(1,0,{n,s:'Song TBD',p:[[p,n]],set:1});toast(n+' added after next')}else{J.stage={n,s:'Song TBD',of:''};toast(n+' is up')}render();return}
  if(a==='end'){J.live=false;go('jam');toast('Jam ended · nothing else to log');return}
  if(a==='callup'&&!J.q.length)return;
  if(a==='kgo'){KS.name=app.querySelector('[data-kn]').value;J.hands.push([KS.name||'Guest',[...KS.parts][0]||'Any','—']);KS.done=true;render();return}
  if(a==='knext'){KS={name:'',parts:new Set(),done:false};render();return}}
 if(S.v==='jamtv'&&c('.tv')&&!c('.r-btn')){J.tvs++;render();tvTick();return}
},true);
app.addEventListener('contextmenu',e=>{const r=e.target.closest('[data-qi]');if(!r||S.v!=='jamhost')return;e.preventDefault();const b=app.getBoundingClientRect();J.menu={i:+r.dataset.qi,x:e.clientX-b.left,y:e.clientY-b.top};render()});
app.addEventListener('input',e=>{if(e.target.matches('[data-kn]'))KS.name=e.target.value});
// drag reorder in the queue
app.addEventListener('dragstart',e=>{const r=e.target.closest('[data-qi]');if(r){e.dataTransfer.setData('text/q',r.dataset.qi);r.classList.add('drag')}});
app.addEventListener('dragover',e=>{if(e.target.closest('[data-qi]'))e.preventDefault()});
app.addEventListener('drop',e=>{const r=e.target.closest('[data-qi]');const f=e.dataTransfer.getData('text/q');if(!r||f==='')return;e.preventDefault();const [g]=J.q.splice(+f,1);J.q.splice(+r.dataset.qi,0,g);render()});
new MutationObserver(()=>app.querySelectorAll('.jq:not([draggable])').forEach(el=>el.setAttribute('draggable','true'))).observe(app,{childList:true,subtree:true});
const oc=V.calendar;V.calendar=()=>oc().replace(/(· scheduled<\/div><h2>[^<]*<\/h2>)/,'$1<div class="btns">'+btn('Open jam',{kind:'pri',icon:'party',attr:'data-jv="jamplan"'})+btn('Show on TV',{icon:'tv',attr:'data-jv="jamtv"'})+btn('Counter iPad',{icon:'qr',attr:'data-jv="kiosk"'})+'</div>');
DK.J=J;DK.jamGo=go;
})();
