// Song page proposal (docs/redesign/09-design-review-songs.md), Nov 7 2026.
// A song opens as a full page inside the app (sidebar stays). It is the one place a song is edited:
// title, facts and details edit in place and save on their own; notes edit in place with Done.
// Back is named after where you came from (Songs, a setlist, search, or Songs for a direct link),
// and ‹ › step through that same list. The list pane stays a read-only preview with Open.
(()=>{const {S,V,app,render,SETS,byId,toast}=DK,{ic,btn,tp,T,NOTES}=Rock,{SONGS}=DD;
const P={from:{k:'set',id:'fall'},id:'mw',f:null,ed:null,tab:0,log:0,menu:0,conf:0,draft:''};
const CTXN={band:'iPod Shuffle',ad:'Acoustic Duo',personal:'My songs'};
const KEYS=['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
const BAND={mw:'## Structure\nIntro → Verse → **Chorus** → Verse → **Chorus** → Bridge → **Chorus** ×2\n\n## Notes\n- Breakdown at 2:40: watch Sarah for the cut\n- Mike takes the second-verse harmony\n- Last chorus: everybody hits the stop on beat 1',
 aer:'## Notes\n- Count-in from Sarah, 4 clicks\n- Clean intro, the riff comes in on the second pass',aag:'- Acoustic intro, band comes in on bar 9\n- Keep the solo short'};
const MINE={aer:'Capo off. Use the Les Paul.',bl:'Slow the outro down. Let it breathe.'};
const SETN={fall:{mw:'Straight out of About A Girl, no gap',ev:'Sarah starts alone'}};
const LOG={mw:[['Thu, Oct 29','Mike','Nailed the breakdown. Next time: tighter ending.'],['Thu, Oct 22','Eric','Tempo drifted up in the bridge. Try 170.'],['Thu, Oct 15','Sarah','First full run.']]};
const AL={mw:'The Colour and the Shape',ev:'The Colour and the Shape',aag:'Bleach',bl:'Ten',aer:'Toxicity',mb:'Facelift',tb:'Dirt',aat:'Electric Ladyland'};
const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const md=t=>{if(!t)return '';let h='',ul=0;for(const ln of esc(t).split('\n')){let l=ln.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\*(.+?)\*/g,'<i>$1</i>');
 if(/^- /.test(l)){if(!ul){h+='<ul>';ul=1}h+=`<li>${l.slice(2)}</li>`;continue}if(ul){h+='</ul>';ul=0}
 if(/^#+ /.test(l))h+=`<h4>${l.replace(/^#+ /,'')}</h4>`;else if(l.trim())h+=`<p>${l}</p>`}return h+(ul?'</ul>':'')};
const band=id=>BAND[id]??'',mine=id=>MINE[id]??'',setNote=()=>P.from.k==='set'?((SETN[P.from.id]||{})[P.id]||''):'';
// the list you came from: Back goes there, ‹ › step through it
const origin=()=>{const f=P.from;
 if(f.k==='set'){const set=SETS.find(x=>x.id===f.id);return {label:set.name,crumb:['Setlists',set.name],list:set.items.filter(x=>typeof x==='string')}}
 const songs=SONGS.filter(s=>S.ctx==='personal'?1:!s.mine).filter(s=>!s.hid).sort((a,b)=>a.title.localeCompare(b.title)).map(s=>s.id);
 if(f.k==='search')return {label:`Search “${f.q}”`,crumb:['Search',`“${f.q}”`],list:songs.filter(id=>(byId(id).title+byId(id).artist).toLowerCase().includes(f.q))};
 if(f.k==='link')return {label:'Songs',crumb:['Songs'],list:null};
 return {label:'Songs',crumb:['Songs'],list:songs}};
const open=(id,from,ed)=>{P.id=id;P.from=from;P.f=null;P.ed=ed||null;P.tab=0;P.log=0;P.menu=0;P.conf=0;if(ed)P.draft=ed==='band'?band(id):ed==='mine'?mine(id):setNote();S.v='song';render();
 if(ed)setTimeout(()=>app.querySelector('[data-sptx]')?.focus())};
const back=()=>{const f=P.from;if(f.k==='set'){S.set=f.id;S.v='setlists';const i=SETS.find(x=>x.id===f.id).items.indexOf(P.id);S.slsel=i>=0?i:null}else{S.sel=P.id;S.v='songs'}render()};
const step=d=>{const o=origin();if(!o.list)return;const i=o.list.indexOf(P.id),n=o.list[i+d];if(!n)return;if(P.ed){toast('Finish or cancel the note first');return}P.id=n;P.f=null;P.log=0;P.menu=0;render()};
const saved=what=>toast(`${what} saved · Undo`);

// ---------- the page ----------
const fact=(k,label,val)=>`<div class="spf ${P.f===k?'on':''}" data-spf="${k}" tabindex="0" aria-label="Edit ${label}"><small>${label}</small>${P.f===k&&(k==='bpm'||k==='dur')?`<input data-spin="${k}" value="${esc(val)}" aria-label="${label}">`:`<b>${val||'—'}</b>`}${P.f===k?pop(k):''}</div>`;
const pop=k=>{const s=byId(P.id);
 if(k==='tun')return `<div class="sppop">${Object.keys(T).map(t=>`<div class="o ${s.tun===t?'on':''}" data-sptun="${t}">${tp(t,'sm')}${T[t].name}<small>${(T[t].strings||'')}</small></div>`).join('')}<div class="o" data-a="toast" data-m="New tuning opens the neck editor">${ic('plus')}New tuning…</div></div>`;
 if(k==='key')return `<div class="sppop"><div class="spkeys"><div class="mg">Major</div>${KEYS.map(n=>`<span class="${s.key===n?'on':''}" data-spkey="${n}">${n}</span>`).join('')}<div class="mg">Minor</div>${KEYS.map(n=>`<span class="${s.key===n+'m'?'on':''}" data-spkey="${n}m">${n}m</span>`).join('')}</div></div>`;
 return ''};
const noteCard=(k,icon,title,sub,text,meta)=>{const editing=P.ed===k;
 return `<div class="spnote ${k==='set'?'set':''}"><div class="spnh">${ic(icon)}${title}<small>${sub}</small>${editing?'':btn('Edit',{icon:'edit',attr:`data-sped="${k}"`})}</div>
 ${editing?`<div class="sped">${P.conf&&k==='band'?`<div class="spconf">${ic('warn')}<div class="g"><b>Mike saved a newer band note while you were typing.</b><br>Yours isn't lost. Pick which to keep.</div>${btn('Show his',{attr:'data-spconf="his"'})}${btn('Keep mine',{kind:'pri',attr:'data-spconf="mine"'})}</div>`:''}
  <div class="spbar">${P.tab?'':`<span title="Heading" data-spmd="## ">H</span><span title="Bold" data-spmd="**">B</span><span title="Italic" data-spmd="*" style="font-style:italic">I</span><i></i><span title="List" data-spmd="- ">•</span>`}<span class="sp ${P.tab?'':'on'}" data-sptab="0">Write</span><span class="${P.tab?'on':''}" data-sptab="1">Preview</span></div>
  ${P.tab?`<div class="spmd" style="padding:6px 4px 10px">${md(P.draft)||'<span class="ph">Nothing yet</span>'}</div>`:`<textarea data-sptx aria-label="${title}">${esc(P.draft)}</textarea>`}
  <div class="spedf"><small>MARKDOWN · ⌘↵ DONE · ESC CANCEL</small>${btn('Cancel',{attr:'data-spedx'})}${btn('Done',{kind:'pri',icon:'check',attr:'data-spedok'})}</div></div>`
 :`<div class="spmd" data-sped="${k}">${md(text)||`<span class="ph">${k==='mine'?'Only you see this. Click to add.':'None yet. Click to add.'}</span>`}</div>${meta||''}`}</div>`};
V.song=()=>{const s=byId(P.id),o=origin(),i=o.list?o.list.indexOf(P.id):-1,ctx=CTXN[S.ctx]||'iPod Shuffle';
 const used=SETS.filter(x=>x.items.includes(s.id));const log=LOG[s.id]||[];
 const top=`<div class="sptop"><button class="spback" data-spback>${ic('back')}${o.label}</button>
  <div class="spcr">${[ctx,...o.crumb].map(c=>`<b>${esc(c)}</b>`).join(' / ')} / ${esc(s.title)}</div>
  <div class="spnav">${o.list?`<span class="ibx ${i<=0?'off':''}" data-spstep="-1" title="Previous (K)">${ic('chev','transform:rotate(180deg)')}</span><em>${i+1} of ${o.list.length}</em><span class="ibx ${i>=o.list.length-1?'off':''}" data-spstep="1" title="Next (J)">${ic('chev')}</span>`:'<em>OPENED FROM A LINK</em>'}
  <span class="dkw"><span class="ibx" data-spmenu title="More">${ic('moreh')}</span>${P.menu?`<div class="dkm"><div class="o" data-a="toast" data-m="Duplicated · Monkey Wrench (copy)">${ic('copy')}Duplicate</div><div class="o" data-a="toast" data-m="Copied to My Songs · stays linked">${ic('music')}Copy to My Songs</div><div class="o" data-a="toast" data-m="Hidden · View → Show hidden brings it back">${ic('eyeoff')}Hide</div><div class="o" data-a="toast" data-m="Delete names what goes: 2 setlists keep their copies…" style="color:var(--danger)">${ic('trash')}Delete…</div></div>`:''}</span></div></div>`;
 const hd=`<div class="sphd"><div class="k">${P.f==='artist'?`<input class="edin" data-spin="artist" value="${esc(s.artist)}" aria-label="Artist">`:`<span class="spe" data-spf="artist" title="Click to edit">${esc(s.artist)}</span>`}</div>
  <h1>${P.f==='title'?`<input class="edin" data-spin="title" value="${esc(s.title)}" aria-label="Title">`:`<span class="spe" data-spf="title" title="Click to edit">${esc(s.title)}</span>`}</h1>
  <div class="spfacts"><div class="spf ${P.f==='tun'?'on':''}" data-spf="tun" tabindex="0" aria-label="Edit tuning"><small>TUNING</small><span>${tp(s.tun,'lg')}</span>${P.f==='tun'?pop('tun'):''}</div>${fact('key','KEY',s.key)}${fact('bpm','BPM',s.bpm)}${fact('dur','LENGTH',s.dur)}</div>
  <div class="spbtns">${btn('Chords & lyrics',{kind:'pri',icon:'chordbox',attr:'data-chart="songs"'})}${btn('Tune',{icon:'fork',attr:'data-v="tuner"'})}${btn('Click '+(s.bpm||''),{icon:'metro',attr:'data-v="metro"'})}</div></div>`;
 const setName=P.from.k==='set'?SETS.find(x=>x.id===P.from.id).name:'';
 const notes=`<div class="r-gl">Notes</div>
  ${P.from.k==='set'?noteCard('set','list','In '+setName,'this set only',setNote()):''}
  ${noteCard('band','people','Band note','shared with the band',band(s.id),`<div class="spmeta">${band(s.id)?'<span>MIKE · TUE 9:14 PM</span>':''}${log.length?`<a data-splog>PRACTICE LOG · ${log.length}</a>`:''}</div>${P.log?`<div class="splog">${log.map(([d,w,t])=>`<div><small>${d.toUpperCase()}<br>${w.toUpperCase()}</small>${esc(t)}</div>`).join('')}</div>`:''}`)}
  ${noteCard('mine','lock','My notes','only you',mine(s.id))}`;
 const row=(k,label,val,ph)=>`<div class="spdr"><small>${label}</small>${P.f===k?`<input class="edin v" data-spin="${k}" value="${esc(val||'')}" placeholder="${ph}" aria-label="${label}">`:`<span class="v spe ${val?'':'ph'}" data-spf="${k}">${esc(val||ph)}</span>`}</div>`;
 const side=`<aside class="spside"><div class="r-gl">Details</div><div class="r-grp">${row('album','Album',s.album??AL[s.id],'Add album')}${row('tags','Tags',s.tags??'90s, Opener','Add tags')}</div>
  <div class="r-gl">Links<span class="act" data-a="toast" data-m="Paste a link: the type is detected">${ic('plus')}ADD</span></div><div class="r-grp">${s.links.length?s.links.map(l=>`<div class="spdr">${Rock.lk(l)}<span class="v">${Rock.LINK_NAME[l]}</span><span class="x" data-a="toast" data-m="Edit the link inline" title="Edit">${ic('edit')}</span><span class="x" data-splrm="${l}" title="Remove">${ic('x')}</span></div>`).join(''):'<div class="spdr"><span class="v ph">No links yet. Paste one.</span></div>'}</div>
  <div class="r-gl">Used in</div><div class="r-grp">${used.length?used.map(x=>`<div class="lrow" data-set="${x.id}"><div class="g"><b>${x.name}</b><small>${x.show||'No show'}</small></div>${ic('chev')}</div>`).join(''):'<div class="spdr"><span class="v ph">Not in a setlist yet</span></div>'}</div>
  <p class="spctx">In ${ctx}. ${S.ctx==='personal'?'Your own song.':'Linked copy in My Songs: your edits here are the band\'s.'}</p>
  <div class="spkb"><kbd>ESC</kbd>BACK · <kbd>J</kbd><kbd>K</kbd>NEXT / PREV · <kbd>E</kbd>EDIT BAND NOTE</div></aside>`;
 return `<div class="spg">${top}<div class="spbody"><div class="spin">${hd}<div class="spcols"><div>${notes}</div>${side}</div></div></div></div>`};

// ---------- events (capture: runs before the demo's own handlers) ----------
const commit=()=>{const el=app.querySelector('[data-spin]');if(!el)return;const k=el.dataset.spin,s=byId(P.id),v=el.value.trim();
 if(k==='title'&&!v){toast('A song needs a title · kept the old one');P.f=null;render();return}
 const old=s[k]??(k==='album'?AL[s.id]:'');P.f=null;if(v!==String(old??'')){s[k]=v;saved({title:'Title',artist:'Artist',bpm:'BPM',dur:'Length',album:'Album',tags:'Tags'}[k])}render()};
const doneNote=()=>{const k=P.ed;if(k==='band'&&!P.conf&&P.id==='mw'&&!P.warned){P.conf=1;P.warned=1;render();return}
 if(k==='band')BAND[P.id]=P.draft;else if(k==='mine')MINE[P.id]=P.draft;else{(SETN[P.from.id]=SETN[P.from.id]||{})[P.id]=P.draft}
 P.ed=null;P.conf=0;render();saved(k==='band'?'Band note':k==='mine'?'My note':'Set note')};
app.addEventListener('click',e=>{const t=e.target,c=s=>t.closest(s);let x;
 // entry points from the existing views
 if(x=c('[data-spopen]')){e.stopImmediatePropagation();open(x.dataset.spopen,{k:'songs'},x.dataset.spnote);return}
 if(x=c('[data-spopenset]')){e.stopImmediatePropagation();open(x.dataset.spopenset,{k:'set',id:S.set});return}
 if(S.v==='songs'&&c('[data-m="Edit opens the song editor"]')){e.stopImmediatePropagation();open(S.sel,{k:'songs'});return}
 if(S.v!=='song')return;
 if(P.f&&!c(`[data-spf="${P.f}"]`)&&!c('[data-spin]')){if(app.querySelector('[data-spin]'))commit();else{P.f=null;render()}if(!c('[data-spf],[data-sped],[data-spback],[data-spstep],[data-spmenu]'))return}
 if(P.menu&&!c('[data-spmenu]')&&!c('.dkm')){P.menu=0;render();return}
 if(c('[data-spback]')){e.stopImmediatePropagation();back();return}
 if(x=c('[data-spstep]')){step(+x.dataset.spstep);return}
 if(c('[data-spmenu]')){P.menu=!P.menu;render();return}
 if(x=c('[data-sptun]')){e.stopPropagation();byId(P.id).tun=x.dataset.sptun;P.f=null;render();saved('Tuning');return}
 if(x=c('[data-spkey]')){e.stopPropagation();byId(P.id).key=x.dataset.spkey;P.f=null;render();saved('Key');return}
 if(x=c('[data-spf]')){if(c('.sppop'))return;const k=x.dataset.spf;P.f=P.f===k&&(k==='tun'||k==='key')?null:k;render();const i=app.querySelector('[data-spin]');if(i){i.focus();i.select()}return}
 if(x=c('[data-sped]')){if(P.ed){toast('Finish or cancel the note you\'re editing');return}const k=x.dataset.sped;P.ed=k;P.tab=0;P.draft=k==='band'?band(P.id):k==='mine'?mine(P.id):setNote();render();app.querySelector('[data-sptx]')?.focus();return}
 if(x=c('[data-sptab]')){P.tab=+x.dataset.sptab;render();return}
 if(x=c('[data-spmd]')){const ta=app.querySelector('[data-sptx]'),m=x.dataset.spmd,a=ta.selectionStart,b=ta.selectionEnd,v=ta.value;
  const wrap=m==='**'||m==='*';const ls=v.lastIndexOf('\n',a-1)+1;P.draft=wrap?v.slice(0,a)+m+v.slice(a,b)+m+v.slice(b):v.slice(0,ls)+m+v.slice(ls);render();const n=app.querySelector('[data-sptx]');n.focus();n.selectionStart=n.selectionEnd=b+m.length*(wrap?2:1);return}
 if(c('[data-spedx]')){P.ed=null;P.conf=0;render();return}
 if(c('[data-spedok]')){doneNote();return}
 if(x=c('[data-spconf]')){if(x.dataset.spconf==='his'){P.draft=band(P.id)+'\n- Mike: try the slower outro next week';P.conf=0;render();toast('Showing Mike\'s version · yours is in Undo')}else{P.conf=0;doneNote()}return}
 if(c('[data-splog]')){P.log=!P.log;render();return}
 if(x=c('[data-splrm]')){const s=byId(P.id);s.links=s.links.filter(l=>l!==x.dataset.splrm);render();toast('Link removed · Undo');return}
},true);
// double-click a row opens the page (the first click re-renders the list, so the demo times the two clicks itself)
let last={k:null,t:0};
app.addEventListener('click',e=>{let x,k=null,id=null,from=null;
 if(S.v==='songs'&&(x=e.target.closest('tr.row[data-song]'))){id=x.dataset.song;from={k:'songs'}}
 else if(S.v==='setlists'&&(x=e.target.closest('.it[data-i]'))&&!e.target.closest('.x')){id=SETS.find(z=>z.id===S.set).items[+x.dataset.i];from={k:'set',id:S.set}}
 if(typeof id!=='string'){last={k:null,t:0};return}k=S.v+id;const now=Date.now();
 if(last.k===k&&now-last.t<450){last={k:null,t:0};e.stopImmediatePropagation();open(id,from);return}last={k,t:now}},true);
app.addEventListener('input',e=>{if(e.target.matches('[data-sptx]'))P.draft=e.target.value});
document.addEventListener('keydown',e=>{if(S.v!=='song')return;const tg=e.target;
 if(tg.matches('[data-spin]')){if(e.key==='Enter'){e.preventDefault();commit()}else if(e.key==='Escape'){P.f=null;render()}return}
 if(tg.matches('[data-sptx]')){if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();doneNote()}else if(e.key==='Escape'){P.ed=null;P.conf=0;render()}return}
 if(tg.matches('input,textarea'))return;
 if(e.key==='Escape'){if(P.f||P.menu){P.f=null;P.menu=0;render()}else back()}else if(e.key==='j')step(1);else if(e.key==='k')step(-1);else if(e.key==='e'){e.preventDefault();app.querySelector('[data-sped="band"]')?.click()}},true);

// ---------- add the entry points to the existing list views after each render ----------
const decorate=()=>{
 if(S.v==='song'){const n=app.querySelector(`.sb .ni[data-v="${P.from.k==='set'?'setlists':'songs'}"]`);if(n)n.classList.add('on')}
 if(S.v==='songs'){const dp=app.querySelector('.dp');if(dp&&!dp.querySelector('[data-spopen]')){dp.insertAdjacentHTML('afterbegin',`<span class="spopen" data-spopen="${S.sel}" title="Open as a page (double-click a row)">${ic('expand')}Open</span>`);
   dp.querySelectorAll('.r-gl .act').forEach(a=>{if(/FULL SCREEN/.test(a.textContent)){a.dataset.spopen=S.sel;a.dataset.spnote='band';a.innerHTML=ic('expand')+'OPEN TO EDIT'}});
   dp.querySelectorAll('.nb').forEach((nb,i)=>{if(nb.querySelector('.h')){nb.dataset.spopen=S.sel;nb.dataset.spnote=i?'mine':'band';nb.style.cursor='pointer'}})}}
 if(S.v==='setlists'){const set=SETS.find(z=>z.id===S.set);app.querySelectorAll('.it[data-i]').forEach(it=>{const id=set&&set.items[+it.dataset.i];const rm=it.querySelector('[data-rm]');
   if(typeof id==='string'&&rm&&!it.querySelector('.spo'))rm.insertAdjacentHTML('beforebegin',`<span class="x spo" data-spopenset="${id}" title="Open song (double-click)">${ic('open')}</span>`)})}};
new MutationObserver(decorate).observe(app,{childList:true});

// ---------- reviewer panel: not part of the design ----------
const rv=document.createElement('div');rv.className='sprev';rv.innerHTML=`<div class="t">Proposal · 09 song page<button data-rvmin aria-label="Minimise">HIDE</button></div>
<p>One page edits the whole song. Back follows where you came from. Try each way in:</p><div class="bs">
<button data-rv="set">Open Monkey Wrench from Fall Set</button><button data-rv="songs">Open from Songs (list + pane)</button><button data-rv="search">Open from a search</button><button data-rv="link">Open from a shared link</button>
<button data-rv="list">Go to Songs: pane, double-click a row</button><button data-rv="setl">Go to Fall Set: open icon on each row</button></div>`;
document.body.appendChild(rv);
rv.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.rvmin!=null){rv.classList.toggle('min');b.textContent=rv.classList.contains('min')?'SHOW':'HIDE';return}
 const k=b.dataset.rv;S.ctx='band';
 if(k==='set')open('mw',{k:'set',id:'fall'});else if(k==='songs')open('mw',{k:'songs'});else if(k==='search')open('mw',{k:'search',q:'foo'});else if(k==='link')open('mw',{k:'link'});
 else if(k==='list'){S.v='songs';S.sel='mw';render()}else{S.set='fall';S.v='setlists';render()}});
S.v='song';render();
})();
