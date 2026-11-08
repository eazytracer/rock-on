// Rock On prototype shell: shows the LOCKED source screens and links them together.
// Every screen is the real phone from source/<page>.html, so locked decisions are what you see.
window.Shell=(()=>{
const RT={
 home:['Core Navigation','1 · Home · band'],homeP:['Core Navigation','3 · Home · Personal'],homeAD:['Core Navigation','2 · Home · Acoustic Duo'],homeNew:['Core Navigation','2 · Home · Acoustic Duo'],
 ctx:['Core Navigation','4 · Context switcher'],prompt1:['Core Navigation','5 · Switch prompt'],prompt2:['Core Navigation','6 · Switch prompt'],
 search:['Core Navigation','7 · Global search · type it'],notif:['Core Navigation','9 · Notifications popout'],notifAll:['Core Navigation','10 · All notifications'],updates:['Core Navigation','11 · App updates'],
 more:['Tools on Home','4 · More'],
 songs:['Song Row','Catalog'],viewopts:['Song Row','View options'],swipe:['Song Row','Swipe left'],hold:['Song Row','Press and hold'],
 song:['Song Chart','1 · Song view'],notesFull:['Song Chart','3 · Notes, full screen'],songFromSet:['Song Editor and View','6 · Song view'],notesEdit:['Song Editor and View','7 · Editing notes'],
 chart:['Sound Tools','1 · Chart'],startnote:['Sound Tools','2 · Set the starting note'],chartEdit:['Song Chart','5 · Chords mode'],chartPaste:['Song Chart','8 · Paste'],
 songNew:['Song Editor and View','1 · Add song · typing'],songFilled:['Song Editor and View','2 · Add song · filled'],tunPick:['Song Editor and View','3 · Tuning picker'],keyPick:['Song Editor and View','4 · Key'],linkAdd:['Song Editor and View','5 · Add a link'],songCancel:['Song Editor and View','8 · Edit song'],
 tuner:['Sound Tools','3 · Tuner'],metro:['Metronome','1 · Metronome'],metroSong:['Metronome','2 · From a song'],chords:['Tools on Home','3 · Tools · Chords'],customTuning:['Custom Tuning','Dark'],
 setlists:['Setlist Editor','1 · Setlists'],setlist:['Setlist Editor','2 · Editor'],timeline:['Setlist Editor','3 · Timeline'],addSongs:['Setlist Editor','4 · Add songs'],addMenu:['Setlist Editor','5 · Add menu'],holdRow:['Setlist Editor','6 · Hold a row'],insBreak:['Setlist Editor','7 · Insert a break'],setRemove:['Setlist Editor','8 · Remove'],setEmpty:['Setlist Editor','9 · Empty setlist'],
 calendar:['Calendar and Shows','1 · Calendar · All'],calNew:['Calendar and Shows','2 · New on All'],calRow:['Calendar and Shows','4 · Row menu'],calJams:['Jam Plan','14 · Calendar · Jams'],calPrac:['Practice History','1 · Calendar · Practices'],
 show:['Calendar and Shows','5 · Show'],showCx:['Calendar and Shows','6 · Show · cancelled'],showNoSet:['Calendar and Shows','7 · Show · no set yet'],showOff:['Calendar and Shows','8 · Offline'],showDel:['Calendar and Shows','9 · Delete'],
 practice:['Practice','1 · Practice'],pracNew:['New Practice','1 · New practice'],pracDup:['New Practice','2 · Duplicate'],session:['Practice','2 · Session'],tuneAhead:['Practice','3 · Tuning change ahead'],wrap:['Practice','4 · Wrap up'],
 histP:['Practice History','2 · History · Practices'],histS:['Practice History','3 · History · Songs'],recap:['Practice History','4 · Past practice'],
 settings:['Account and Settings','5 · Settings'],tunings:['Account and Settings','6 · Tunings'],profile:['Account and Settings','7 · Profile'],push:['Account and Settings','8 · Push'],delAcct:['Account and Settings','9 · Delete account'],instr:['Account and Settings','11 · Instrument picker'],
 signin:['Account and Settings','1 · Sign in'],signinErr:['Account and Settings','2 · Wrong password'],checkMail:['Account and Settings','3 · Check your email'],forgot:['Account and Settings','10 · Forgot password'],getStarted:['Account and Settings','4 · Get started'],
 members:['Band and Friends','1 · Band members'],memberMenu:['Band and Friends','2 · Member menu'],invite:['Band and Friends','3 · Invite'],transfer:['Band and Friends','4 · Transfer'],bandNew:['Band and Friends','5 · Create a band'],bandMark:['Band and Friends','6 · Band mark'],join:['Band and Friends','7 · Join preview'],leave:['Band and Friends','9 · Leave'],
 friends:['Band and Friends','10 · Friends'],friendsPriv:['Band and Friends','11 · Friends · privacy'],bandProfile:['Band Identity','3 · Band profile'],
 jamHub:['Jam Plan','1 · Jam hub'],jamNew:['Jam Plan','2 · Host a jam'],jamLineup:['Jam Plan','3 · Planned · Lineup'],jamReq:['Jam Plan','4 · Planned · Requests'],jamPeople:['Jam Plan','5 · Planned · People'],jamWalkPlan:['Jam Plan','6 · Add a walk-up'],golive:['Jam Plan','7 · Go live'],
 gLineup:['Jam Plan','8 · Guest · lineup'],gHand:['Jam Plan','9 · Guest · raise a hand'],gReq:['Jam Plan','10 · Guest · request'],webArr:['Jam Plan','11 · Web · arriving'],webIn:['Jam Plan','12 · Web · in'],
 joining:['Jam Live','0 · Joining'],guest:['Jam Live','1 · Guest · tonight'],hand:['Jam Live','1b · Raise a hand'],compare:['Jam Live','2 · Compare'],pitch:['Jam Live','3 · Pitch a song'],hostPitches:['Jam Live','4 · Host · pitches'],quiet:['Jam Live','5 · Host · quiet stage'],nudged:['Jam Live','6 · Guest · nudged'],webGuest:['Jam Live','7 · Web guest'],
 jamHost:['Jam Host','1 · Host · now'],fillPart:['Jam Host','2 · Fill a part'],called:['Jam Host','3 · Called up'],backFrom:['Jam Host','4 · Back from playing'],clearQ:['Jam Host','4b · Clear the queue'],holdGroup:['Jam Host','4c · Hold a group'],walkup:['Jam Host','5 · Walk-up'],lock:['Jam Host','6 · Lock screen'],
 // Nov 7 final pass: these supersede the matching locked phones (see source/DECISIONS.md · Nov 7)
 calendar:['Final Pass','1 · Calendar · All'],calNew:['Final Pass','2 · New on All'],calJams:['Final Pass','3 · Calendar · Jams'],showNew:['Final Pass','4 · New show'],pracRsvp:['Final Pass','5 · Practice'],
 song:['Final Pass','6 · Song view'],session:['Final Pass','7 · Session'],sessNotes:['Final Pass','8 · Session · notes'],
 setlists:['Final Pass','9 · Setlists'],setMenu:['Final Pass','10 · Setlist menu'],setDel:['Final Pass','11 · Delete setlist'],setNotes:['Final Pass','12 · Setlist notes'],setSort:['Final Pass','23 · Setlists'],
 songsP:['Final Pass','13 · Personal'],friendAdd:['Final Pass','14 · Add a friend'],songsLoad:['Final Pass','15 · Songs · loading'],songsEmpty:['Final Pass','16 · Songs · empty'],songsNone:['Final Pass','17 · Songs · no matches'],calErr:['Final Pass','18 · Calendar · error'],homeOff:['Final Pass','19 · Home · offline'],jamEmpty:['Final Pass','20 · Jam · empty'],
 jamNew:['Final Pass','21 · Host a jam'],jamSettings:['Final Pass','22 · Jam settings']};
const idx=a=>(i)=>a[i];
const TABS=['home','songs','setlists','calendar','more'];let HOME='home',SEEN=false;const pr=()=>{const k=SEEN?'prompt2':'prompt1';SEEN=true;return k};const EVR=[['.r-item','Tuesday Open Jam','jamHost'],['.r-item','Birthday','jamLineup'],['.r-item','Sarah','gLineup'],['*','VIEW ALL',{tab:'calendar'}]];const TL=['.tools span',null,idx(['tuner','metro','chords'])],SR=['.grpr .r-ib',null,i=>i===0?'search':'notif'];
// rules: [selector, text (string|null), target (route | 'back' | fn(i,el))]
const G=[['.r-nav span, .nav>div',null,(i)=>({tab:i===0?HOME:TABS[i]})],['.r-btn.back, .ab .back',null,'back'],['.r-eb .r-btn.text',null,'back'],['.ptop>.ib:first-child, .sh>.r-ib:first-child, .r-ab>.r-ib:first-child',null,'back'],
 ['.r-ctx, .ab .ctx',null,'ctx'],['.r-ab .grpr .r-ib',null,(i,el)=>el.querySelector('.r-badge')||el.innerHTML.includes('M6 8a6')?'notif':null],['.r-retune .r-btn',null,'tuner'],['.r-eb .r-btn.pri',null,'back']];
const songT=(t)=>[['*',t,'song']];
const R={
 home:[TL,['.card',null,idx(['show','practice'])],['.qa span',null,idx(['songNew','setEmpty','pracNew','showNew'])],SR,...EVR],
 homeP:[TL,SR,['.r-btn','Create a band','bandNew'],['.r-btn','Join with a code','join'],['.st .go',null,'songNew'],['.qa span',null,idx(['songNew','jamNew','friends'])],...EVR],
 homeAD:[TL,SR,['.st .go',null,'songNew'],['.ec',null,'showNew'],['.card','Duo','practice'],['.qa span',null,idx(['songNew','setEmpty','pracNew','showNew'])]],
 ctx:[['.ctxr','Personal',{tab:'homeP'}],['.ctxr','iPod Shuffle',{tab:'home'}],['.ctxr','Acoustic Duo',{tab:'homeAD'}],['*','Create or join','bandNew'],['.ddscrim',null,'back']],
 prompt1:[['.r-btn','Switch',{tab:'homeAD'}],['.r-btn','Stay',"back"],['.r-scrim',null,'back']],prompt2:[['.r-btn','Switch',{tab:'homeAD'}],['.r-btn','Not now','back'],['.ddscrim',null,'back'],['.r-scrim',null,'back']],
 notif:[['.all',null,'notifAll'],['.ddscrim',null,'back'],['*','Hash Pipe','song'],['*','Fall Kickoff','show'],['*','Practice moved',()=>HOME==='homeAD'?'homeAD':pr()],['*','Fall Set','setlist']],
 notifAll:[['.r-seg span',null,i=>i?'updates':null],['*','Hash Pipe','song'],['*','Fall Kickoff','show'],['*','Practice moved',()=>HOME==='homeAD'?'homeAD':pr()],['*','Fall Set','setlist'],['*','friend request','friends']],
 updates:[['.r-seg span',null,i=>i?null:'notifAll']],
 search:[['.r-btn.text',null,'back'],['[data-row]',null,'song'],['.r-item','Fall Set','setlist'],['.r-item','Birthday Jam','jamLineup'],['.r-item','Acoustic Sunday','setlist'],['.r-item','Fall Kickoff','show'],['.r-item','Tuesday Open Jam','jamHost'],['.r-item','Thursday run','practice']],
 more:[['.grpr .r-ib',null,(i,el)=>el.matches('[data-thm]')?{theme:1}:'notif'],['.r-item','Members','members'],['.r-item','Band profile','bandProfile'],['.r-item','Invite','invite'],['.r-item','Eric','profile'],['.r-item','Jam','jamHub'],['.r-item','Friends','friends'],['.r-item','Settings','settings'],['.r-item','Sign out','signin']],
 songs:[['[data-row]',null,'song'],['.fab',null,'songNew'],['.chip','View','viewopts']],
 viewopts:[['.scrim',null,'back']],
 song:[['.cta2 .r-btn',null,'chartEdit'],['.r-ab .r-ib',null,(i)=>i===0?'songCancel':null],['*','FULL SCREEN','notesFull'],['.r-item','Band notes','notesEdit'],['.r-item','My notes','notesEdit'],['.r-item','Fall Set','setlist'],['.r-item','Fall Kickoff','show'],['.r-item','Thursday run','practice']],
 songFromSet:[['.cta',null,'chart'],['.pill','Edit','songCancel']],notesFull:[['.back, .ib',null,'back']],
 chart:[['.ntop',null,'notesFull']],
 tuner:[['.tseg span',null,idx([null,'metro','chords'])],['*','Custom','customTuning']],
 metro:[['.r-seg span',null,idx(['tuner',null,'chords'])]],metroSong:[['.r-seg span',null,idx(['tuner',null,'chords'])]],
 chords:[['.r-seg span',null,idx(['tuner','metro',null])]],
 setlists:[['.slc .r-ib',null,'setMenu'],['.slc','Fall Set','setlist'],['.slc','Birthday','setlist'],['.slc','Acoustic','setlist'],['.r-tools .r-chip',null,'setSort'],['.r-fab',null,'setEmpty']],
 setMenu:[['.r-row','Delete','setDel'],['.r-row','Open','setlist'],['.r-row','Duplicate',{tab:'setlists'}],['.r-scrim',null,'back']],setDel:[['.r-btn','Keep','back'],['.r-btn','Delete',{tab:'setlists'}],['.r-scrim',null,'back']],setSort:[['.r-row',null,'back'],['.r-scrim',null,'back']],setNotes:[['.r-btn','Done','back'],['.r-scrim',null,'back']],
 setlist:[['*','Songs','addSongs']],timeline:[['*','Songs','addSongs']],
 addSongs:[['.r-dock .r-btn',null,'back']],
 setEmpty:[['.r-btn','Add songs','addSongs']],
 calendar:[['.r-fab',null,'calNew'],['.r-item','Jam','jamLineup'],['.r-item','Thursday run','practice'],['.r-item','Fall Kickoff','show'],['.r-item','Halloween','showCx'],['.r-item','Birthday','jamLineup'],['.r-item','jam','jamLineup'],['.r-chip','Practices','calPrac'],['.r-chip','Jams','calJams']],
 calNew:[['.o','Show','showNew'],['.o','Practice','pracNew'],['.o','Event','jamNew'],['.o','Jam','jamNew'],['.r-scrim',null,'back']],
 calPrac:[['.hl',null,'histP'],['*','Practice history','histP'],['.r-chip','All',{tab:'calendar'}],['.r-item','Thursday run','recap']],
 calJams:[['.r-item',null,'jamLineup'],['.r-chip','All',{tab:'calendar'}],['.r-chip','Shows',{tab:'calendar'}],['.r-chip','Practices','calPrac'],['.r-chip','Join','joining'],['.r-fab',null,'jamNew']],
 showNew:[['.r-btn','Copy a setlist','showNoSet'],['.r-btn','New set','setEmpty']],
 show:[['.r-dock .r-btn',null,'timeline'],['*','EDIT SET','setlist'],['[data-row], .r-sr',null,'song']],
 practice:[['.r-ab .r-ib:last-child',null,'pracDup'],['.r-dock .r-btn',null,'session'],['[data-row], .r-sr',null,'song']],
 session:[['.r-btn','Notes','sessNotes'],['.r-btn','Chart','chart'],['.r-btn','Tune now','tuner'],['.r-btn','Tune','tuner'],['.r-btn','End','wrap'],['.r-pg.nx',null,'tuneAhead']],sessNotes:[['.r-scrim',null,'back']],tuneAhead:[['.r-btn','Tune now','tuner'],['.r-btn','End','wrap']],
 wrap:[['.r-btn','Save',{tab:'calendar'}],['.r-btn','Back','back'],['.r-scrim',null,'back']],
 histP:[['.pc',null,'recap'],['.r-seg span',null,i=>i?'histS':null]],histS:[['.r-seg span',null,i=>i?null:'histP'],['.sr',null,'song']],
 recap:[['.r-dock .r-btn',null,'pracDup']],pracNew:[['.r-eb .r-btn',null,(i,el)=>/Save/.test(el.textContent)?{tab:'calendar'}:'back']],pracDup:[['.r-eb .r-btn',null,(i,el)=>/Save/.test(el.textContent)?{tab:'calendar'}:'back']],
 settings:[['.r-item','Eric','profile'],['.r-item','Tunings','tunings'],['.r-item','Notifications','push'],['*','Delete account','delAcct'],['.r-item','Instrument','instr']],
 tunings:[['*','NEW','customTuning'],['*','Tuner','tuner'],['.r-item','Open G','customTuning'],['.r-item','DADGAD','customTuning']],
 profile:[['*','Instruments','instr'],['.ins span',null,'instr']],
 signin:[['*','Forgot','forgot'],['*','Create an account','checkMail'],['.r-btn','Sign in','signinErr'],['.r-btn','Apple','getStarted'],['.r-btn','Google','getStarted']],
 signinErr:[['*','Forgot','forgot'],['.r-btn','Sign in','getStarted']],forgot:[['.r-btn','Send','checkMail']],checkMail:[['.r-btn','Open Mail','getStarted']],
 getStarted:[['.o','Create a band','bandNew'],['.o','Join','join'],['.o','event code','joining'],['.o','solo',{tab:'homeP'}]],
 members:[['.r-item','Sarah','memberMenu'],['.r-btn','Share link','invite'],['.r-btn','QR','invite'],['*','Leave band','leave'],['*','EDIT BAND INFO','bandProfile']],
 memberMenu:[['*','Transfer','transfer'],['.r-scrim',null,'back']],invite:[['.r-scrim',null,'back']],
 bandNew:[['*','Create','bandMark']],join:[['.r-btn','Join',{tab:'home'}],['.r-btn','Not now','back']],
 friends:[['[data-priv]',null,'friendsPriv'],['.r-fab',null,'friendAdd']],friendAdd:[['.r-row','Share',null]],friendsPriv:[['[data-priv]',null,'back']],
 jamEmpty:[['.r-btn','Host a jam','jamNew'],['.r-btn','Join','joining']],jamSettings:[['.r-btn','Done','back'],['.r-scrim',null,'back']],
 jamHub:[['.r-btn','Return to jam','jamHost'],['.r-item','Tuesday Open Jam','jamLineup'],['.r-item','Birthday','jamLineup'],['.r-item','Sarah','gLineup'],['.r-btn','Host a jam','jamNew'],['.r-btn','Join with a code','joining']],
 jamNew:[['.r-eb .r-btn.pri',null,'jamLineup']],
 jamLineup:[['.r-seg span',null,idx([null,'jamReq','jamPeople'])],['.r-btn','Go live','golive'],['*','walk-up','jamWalkPlan']],
 jamReq:[['.r-seg span',null,idx(['jamLineup',null,'jamPeople'])],['.r-btn','Go live','golive']],jamPeople:[['.r-seg span',null,idx(['jamLineup','jamReq',null])],['.r-btn','Go live','golive']],
 golive:[['.r-btn','Go live','jamHost'],['.r-scrim',null,'back']],
 jamHost:[['.r-btn','Call','called'],['*','Fill','fillPart'],['.qa span',null,idx(['walkup','quiet','hostPitches'])],['.pq, .qrow, [data-qi]',null,'holdGroup'],['*','After that','clearQ']],
 fillPart:[['.r-scrim',null,'back'],['.o',null,'back']],called:[['*','Undo','back'],['.r-btn','Back','backFrom']],holdGroup:[['.r-scrim',null,'back'],['.o',null,'back']],walkup:[['.r-scrim',null,'back'],['.r-btn',null,'back']],
 joining:[['.r-dock .r-btn',null,'guest'],['.r-btn','Join','guest']],
 guest:[['.hb',null,'hand'],['.p','Dana','compare'],['.r-dock .r-btn',null,'pitch']],hand:[['.r-btn','Cancel','back'],['.r-btn','Raise','back'],['.r-scrim',null,'back']],
 compare:[['.r-btn','Pitch','pitch']],pitch:[['.r-scrim',null,'back'],['.r-btn',null,'back']],
 customTuning:[['.r-eb .r-btn.text',null,'back']]};
const PAGES={};let stack=[],theme='dark',onChange=()=>{};
const host=document.getElementById('ph');
const capFind=(doc,prefix)=>{const c=[...doc.querySelectorAll('.cap')].find(x=>x.textContent.trim().startsWith(prefix));if(!c)return null;let w=c.parentElement;let p=w.querySelector('.r-phone,.phone');while(!p&&w.parentElement){w=w.parentElement;p=w.querySelector('.r-phone,.phone')}return p};
const loadPage=name=>new Promise(res=>{if(PAGES[name]){PAGES[name].ready.then(()=>res(PAGES[name]));return}
 const f=document.createElement('iframe');f.className='pf';if(window.SCREENS&&SCREENS[name])f.srcdoc=SCREENS.build(name);else f.src='screens/'+encodeURIComponent(name)+'.html';host.appendChild(f);
 const P={f,ready:null};P.ready=new Promise(r=>f.addEventListener('load',()=>{const d=f.contentDocument;const st=d.createElement('style');st.textContent='html,body{overflow:hidden!important;scrollbar-width:none}html::-webkit-scrollbar{display:none}.pz-live{cursor:pointer!important}';d.head.appendChild(st);
  d.addEventListener('click',()=>{P.mut=P.mutN},true);P.mutN=0;new MutationObserver(rs=>{const strip=s=>(s||'').replace(/\s*pz-live/g,'').trim();if(rs.some(r=>!(r.type==='attributes'&&r.attributeName==='class'&&strip(r.oldValue)===strip(r.target.getAttribute('class')))))P.mutN++}).observe(d.body,{subtree:true,childList:true,attributes:true,attributeOldValue:true,characterData:true});d.addEventListener('scroll',()=>{P.mutN++},true);d.addEventListener('click',e=>onClick(P,e));d.addEventListener('mouseover',e=>onOver(P,e));setTimeout(r,250)}));PAGES[name]=P;P.ready.then(()=>res(P))});
const place=(P,prefix)=>{const d=P.f.contentDocument,w=P.f.contentWindow;const ph=capFind(d,prefix);if(!ph){console.warn('no phone',prefix);return null}w.scrollTo(0,0);const r=ph.getBoundingClientRect();w.scrollTo(r.left,r.top);P.phone=ph;P.prefix=prefix;applyTheme(P);return ph};
const applyTheme=P=>{const ph=P.phone;if(!ph)return;const r=ph.querySelector('.r');if(r){if(theme==='light')r.dataset.theme='light';else if(!P.prefix.includes('light')&&!/Light|light/.test(P.prefix))delete r.dataset.theme}};
let cur=null;
const show=async key=>{const rt=RT[key];if(!rt){console.warn('route?',key);return}const P=await loadPage(rt[0]);Object.values(PAGES).forEach(x=>x.f.classList.toggle('on',x===P));place(P,rt[1]);cur={key,P};onChange(key,stack)};
const go=k=>{stack.push(k);show(k)};
const back=()=>{if(stack.length>1)stack.pop();show(stack[stack.length-1])};
const tab=k=>{stack=[k];show(k)};
const run=(to,i,el)=>{if(typeof to==='function')to=to(i,el);if(to==null)return false;if(to==='back'){back();return true}if(typeof to==='object'){if(to.tab){if(/^home/.test(to.tab))HOME=to.tab;tab(to.tab);return true}if(to.theme){theme=theme==='dark'?'light':'dark';Object.values(PAGES).forEach(applyTheme);onChange(cur.key,stack);return true}}if(RT[to]&&to!==cur.key){go(to);return true}return false};
const ROWSEL='.nf,.r-item,.r-row,.r-sr,[data-row],.pc,.slc,.card,.pcard,.it,.o,.cv2,.pq2,.jrow,.wl,.sr,li';
const textEl=(t,el,ph,text)=>{const row=t.closest(ROWSEL);let x=t;while(x&&x!==ph){if(x.textContent.includes(text))return x.textContent.length<400&&(!row||row.contains(x)||x.contains(row)&&x===row)?x:null;if(row&&x===row)return null;x=x.parentElement}return null};
const BTN='.r-btn,.r-ib,.r-chip,.r-item,.r-row,.r-fab,.r-pg,.r-seg span,.chip,.pill,.ib,.fab,.cta,.o,.tg,.pg,[data-row],[data-a],[data-act],button,.r-lk,.lk,.setb,.snb';
const find=(P,t)=>{const ph=P.phone;const rules=(R[cur.key]||[]).concat(G);
 for(const [sel,text,to] of rules){let el;
  if(sel==='*'){if(!text)continue;el=textEl(t,null,ph,text);if(!el)continue}
  else{el=t.closest(sel);if(!el||!ph.contains(el))continue;if(text&&!el.textContent.includes(text))continue}
  const all=sel==='*'?[el]:[...ph.querySelectorAll(sel)];let i=all.indexOf(el);if(sel.includes('.r-nav')||sel.includes('.nav>'))i=[...el.parentElement.children].indexOf(el);
  let dest=typeof to==='function'?to(i,el):to;if(dest==null)continue;if(typeof dest==='string'&&dest!=='back'&&(!RT[dest]||dest===cur.key))continue;return {dest,i,el}}return null};
const hint=m=>{let h=document.getElementById('phint');if(!h){h=document.createElement('div');h.id='phint';document.body.appendChild(h)}h.textContent=m;h.classList.add('on');clearTimeout(hint.t);hint.t=setTimeout(()=>h.classList.remove('on'),1800)};
const HOOK=BTN+',[data-s],[data-m],[data-b],[data-sig],[data-sub],[data-tap],[data-go],[data-fl],[data-d],[data-p],[data-all],[data-pk],[data-ch],[data-q],[data-qi],[data-grip],[data-it],[data-tl],[data-n],[data-o],[data-ci],[data-hp],[data-thm],[data-priv],[data-sortopen],[data-sort],[data-dir],[data-f],[data-c],[data-col],[data-auto],[data-lt],[data-sy],[data-co],[data-photo],[data-r],[data-addmenu],[data-tlmode],[data-v] span';
let lastLive=null;
const onOver=(P,e)=>{if(!cur||cur.P!==P||!P.phone)return;const t=e.target;if(!P.phone.contains(t))return;const m=find(P,t);const el=m?m.el:t.closest(HOOK);if(lastLive&&lastLive!==el)lastLive.classList.remove('pz-live');if(el&&P.phone.contains(el)){el.classList.add('pz-live');lastLive=el}};
const onClick=(P,e)=>{if(!cur||cur.P!==P||!P.phone)return;const ph=P.phone,t=e.target;if(!ph.contains(t))return;
 setTimeout(()=>{const doc=P.f.contentDocument;if(!doc.contains(ph)){const np=capFind(doc,P.prefix);if(np)P.phone=np;applyTheme(P)}},60);
 const m=find(P,t);if(m){run(m.dest,m.i,m.el);e.preventDefault();return}
 const b=t.closest(HOOK);if(!b)return;if(b.matches('.on,[aria-pressed="true"],.pg,.r-pg')||[...b.attributes].some(a=>a.name.startsWith('data-')))return;const c0=P.mut;
 setTimeout(()=>{if(P.mutN===c0){hint('Not linked in the prototype yet');b.animate([{opacity:1},{opacity:.45},{opacity:1}],{duration:260})}},180)};
const onClickUnused=(P,e,b)=>{let changed=false;const mo=new MutationObserver(()=>changed=true);mo.observe(P.f.contentDocument.body,{subtree:true,childList:true,attributes:true,characterData:true});
 setTimeout(()=>{mo.disconnect();if(!changed){hint('Not linked in the prototype yet');b.animate([{opacity:1},{opacity:.45},{opacity:1}],{duration:260})}},180)};
const onClickOld=(P,e)=>{if(!cur||cur.P!==P||!P.phone)return;const ph=P.phone,t=e.target;if(!ph.contains(t))return;
 setTimeout(()=>{const doc=P.f.contentDocument;if(!doc.contains(ph)){const np=capFind(doc,P.prefix);if(np)P.phone=np;applyTheme(P)}},60);
 const rules=(R[cur.key]||[]).concat(G);
 for(const [sel,text,to] of rules){let el;
  if(sel==='*'){if(!text)continue;el=textEl(t,null,ph,text);if(!el)continue}
  else{el=t.closest(sel);if(!el||!ph.contains(el))continue;if(text&&!el.textContent.includes(text))continue}
  const all=sel==='*'?[el]:[...ph.querySelectorAll(sel)];let i=all.indexOf(el);if(sel.includes('.r-nav')||sel.includes('.nav>'))i=[...el.parentElement.children].indexOf(el);
  if(run(to,i,el)){e.preventDefault();return}}};
const selfTest=async()=>{const miss=[];for(const [k,[pg,cap]] of Object.entries(RT)){const P=await loadPage(pg);if(!capFind(P.f.contentDocument,cap))miss.push(k+' → '+pg+' / '+cap)}console.log('SELFTEST '+Object.keys(RT).length+' routes; missing: '+(miss.length?'\n'+miss.join('\n'):'none'))};
return {selfTest,RT,go,back,tab,show,get stack(){return stack},get theme(){return theme},onChange:f=>onChange=f,setTheme:t=>{theme=t;Object.values(PAGES).forEach(applyTheme)}}})();
