// Setlist navigation options (Nov 7 2026). Today the Setlists view nests a second list of setlists between the
// sidebar and the editor. Switching sets is rare, so three ways to give that column back to the editor:
//   a · Index, then the editor full width with ← Setlists (same pattern as the song page)
//   b · The editor full width; the setlist name is a switcher (like the context switcher)
//   ab · a with b's name switcher on top (Eric's pick, Nov 7)
//   c · The editor full width; the band's setlists sit under Setlists in the sidebar
// ?nav=a|b|c|ab picks one; with none, the demo is unchanged.
(()=>{const {S,V,app,render,SETS,toast}=DK,{ic,btn}=Rock;
const SN={mode:new URLSearchParams(location.search).get('nav')||'',open:false,dd:false,menu:false};
window.SN=SN;
const secs=d=>{const [m,s]=(d||'0:00').split(':').map(Number);return m*60+(s||0)};
const stats=set=>{let n=0,t=0,ret=0,prev=null;for(const x of set.items){if(x.sec)continue;if(x.brk){t+=x.brk*60;continue}const s=DK.byId(x);n++;t+=secs(s.dur);if(prev&&prev!==s.tun)ret++;prev=s.tun}return {n,min:Math.round(t/60),ret}};
const day=x=>{const m=/Nov (\d+)/.exec(x.show||'');return m?+m[1]:999};
const sorted=()=>[...SETS].sort((a,b)=>day(a)-day(b)||a.name.localeCompare(b.name));
const sub=x=>{const t=stats(x);return `${x.show?x.show.split(' · ')[1]+' · ':''}${t.n} songs · ${t.min} min${t.ret?` · ${t.ret} retunes`:''}`};
const orig=V.setlists;
// a · the index
V.setlists=()=>{if(!/a/.test(SN.mode)||SN.open)return orig();
 const list=sorted(),nx=list.find(x=>x.show);
 return DK.head('iPod Shuffle','Setlists',SETS.length,btn('Next show',{icon:'sort'})+btn('New setlist',{kind:'pri',icon:'plus',attr:'data-slnew'}))+
 `<div class="pane" style="flex:1"><div class="snix">${list.map(x=>{const t=stats(x);return `<div class="sncard ${x===nx?'nx':''}" data-snopen="${x.id}"><div class="top"><small>${x.show?(x===nx?'NEXT SHOW · ':'')+x.show.toUpperCase():'NOT ATTACHED TO A SHOW'}</small><span class="ibx sm" data-a="toast" data-m="Open · Duplicate · Delete">${ic('moreh')}</span></div><b>${x.name}</b><div class="st"><span><em>${t.n}</em>songs</span><span><em>${t.min}</em>min</span><span><em>${t.ret}</em>retunes</span></div><div class="tl">${x.items.filter(i=>typeof i==='string').slice(0,5).map(i=>DK.byId(i).title).join(' · ')}${x.items.length>5?' …':''}</div></div>`}).join('')}
 <div class="sncard new" data-slnew>${ic('plus')}<b>New setlist</b></div></div></div>`};
// header ⋯ for the set itself (Rename, Duplicate, Delete moved here from the list column)
const setMenu=()=>`<span class="dkw"><span class="r-ib" data-snmenu title="Setlist actions">${ic('moreh')}</span>${SN.menu?`<div class="dkm" style="right:0;min-width:200px"><div class="o" data-slren>${ic('edit')}Rename</div><div class="o" data-sldup="${S.set}">${ic('copy')}Duplicate</div><div class="o dng" data-sldel="${S.set}">${ic('trash')}Delete…</div></div>`:''}</span>`;
const dec=()=>{document.body.dataset.snmode=SN.mode;if(!SN.mode)return;
 if(S.v==='setlists'&&!(/a/.test(SN.mode)&&!SN.open)){
  app.querySelector('.sl3>.lft')?.remove();app.querySelector('.slsw')?.remove();
  const act=app.querySelector('.hd .act');if(act&&!act.querySelector('[data-snmenu]'))act.insertAdjacentHTML('beforeend',setMenu());
  const kick=app.querySelector('.hd .ttl small'),h1=app.querySelector('.hd .ttl h1'),set=SETS.find(x=>x.id===S.set);
  if(/a/.test(SN.mode)&&kick)kick.outerHTML=`<div class="snback"><span class="r-btn sm" data-snidx>${ic('back')}Setlists</span><small>${set.show||'Not attached to a show'}</small></div>`;
  if(/b/.test(SN.mode)&&h1&&!S.slren){h1.classList.add('snh1');h1.insertAdjacentHTML('beforeend',`<span class="sncar" data-sndd title="Switch setlist">${ic('down')}</span>`);
   if(SN.dd){const list=sorted();h1.parentNode.style.position='relative';h1.insertAdjacentHTML('afterend',`<div class="sndd"><div class="mg">Setlists · ${SETS.length}<span>NEXT SHOW FIRST</span></div>${list.map(x=>`<div class="o ${x.id===S.set?'on':''}" data-snpick="${x.id}"><div><b>${x.name}</b><small>${sub(x)}</small></div>${x.id===S.set?ic('check'):''}</div>`).join('')}<div class="sep"></div>${SN.mode==='ab'?`<div class="o" data-snidx>${ic('list')}<b>All setlists</b></div>`:''}<div class="o" data-slnew>${ic('plus')}<b>New setlist</b></div></div>`)}}}
 if(SN.mode==='c'){const ni=app.querySelector('.sb .ni[data-v="setlists"]');if(ni&&!app.querySelector('.snsub')){const list=sorted();
  ni.insertAdjacentHTML('afterend',`<div class="snsub">${list.map(x=>`<div class="si ${S.v==='setlists'&&x.id===S.set?'on':''}" data-set="${x.id}"><span>${x.name}</span>${x.show?`<small>${x.show.split(' · ')[1]}</small>`:''}</div>`).join('')}<div class="si add" data-slnew>${ic('plus')}New setlist</div></div>`)}}};
new MutationObserver(dec).observe(app,{childList:true});
app.addEventListener('click',e=>{const c=s=>e.target.closest(s);let x;if(!SN.mode)return;
 if(SN.dd&&!c('.sndd')&&!c('[data-sndd]')){SN.dd=false;if(!c('[data-set],[data-v]')){render();e.stopImmediatePropagation();return}}
 if(SN.menu&&!c('[data-snmenu]')&&!c('.dkm')){SN.menu=false;render();e.stopImmediatePropagation();return}
 if(c('[data-snmenu]')){SN.menu=!SN.menu;render();e.stopImmediatePropagation();return}
 if(c('[data-sndd]')){SN.dd=!SN.dd;render();e.stopImmediatePropagation();return}
 if(x=c('[data-snpick]')){S.set=x.dataset.snpick;S.slsel=null;SN.dd=false;render();e.stopImmediatePropagation();return}
 if(x=c('[data-snopen]')){if(c('[data-a]'))return;S.set=x.dataset.snopen;SN.open=true;S.slsel=null;S.v='setlists';render();e.stopImmediatePropagation();return}
 if(c('[data-snidx]')){SN.open=false;SN.dd=false;S.v='setlists';render();e.stopImmediatePropagation();return}
 if(/a/.test(SN.mode)&&c('.sb .ni[data-v="setlists"]')){SN.open=false;SN.menu=false}
 if(c('[data-slnew]'))SN.open=true;
 if(c('[data-set]'))SN.open=true;
 if(c('[data-sldup],[data-sldel],[data-slren]'))SN.menu=false},true);
// the Setlists heading keeps its accent while a set from the sub-list is open (mode c)
const st=document.createElement('style');st.textContent=`
body[data-snmode="ab"] .sl3,body[data-snmode="a"] .sl3,body[data-snmode="a"] .sl3.lib,body[data-snmode="b"] .sl3,body[data-snmode="c"] .sl3{grid-template-columns:minmax(0,1fr)}
body[data-snmode] .sl3.lib{grid-template-columns:minmax(0,1fr) 340px}
body[data-snmode] .sl3:has(.slnp){grid-template-columns:minmax(0,1fr) 340px}
.snix{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;padding:6px 28px 40px}
.sncard{background:var(--s1);border-radius:18px;padding:16px 18px 18px;cursor:pointer;display:flex;flex-direction:column;gap:6px;min-height:150px}
.sncard:hover{background:var(--s2)}
.sncard.nx{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--acc) 60%,transparent)}
.sncard .top{display:flex;align-items:center}.sncard .top small{flex:1;font-family:var(--r-fm);font-size:10.5px;letter-spacing:.1em;color:var(--mu)}
.sncard.nx .top small{color:var(--accink)}
.sncard>b{font-family:var(--r-fd);font-weight:800;text-transform:uppercase;font-size:28px;line-height:1;color:var(--tx)}
.sncard .st{display:flex;gap:16px;font-family:var(--r-fm);font-size:11px;color:var(--mu)}.sncard .st em{font-style:normal;font-size:16px;color:var(--tx);margin-right:4px}
.sncard .tl{font-size:13px;color:var(--tx2);margin-top:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sncard.new{align-items:center;justify-content:center;flex-direction:row;gap:10px;background:transparent;box-shadow:inset 0 0 0 2px var(--line);color:var(--tx2)}
.sncard.new b{font:600 15px var(--r-f);text-transform:none;color:var(--tx2)}
.snback{display:flex;align-items:center;gap:12px;margin-bottom:8px}.snback small{margin:0!important}
.snback .r-btn{height:32px;padding:0 12px 0 8px;font-size:13px}
.snh1{display:inline-flex;align-items:center;gap:8px}
.sncar{display:grid;place-items:center;width:40px;height:40px;border-radius:20px;background:var(--s1);cursor:pointer;color:var(--tx2)}
.sncar:hover{background:var(--s2)}.sncar svg.i{width:20px;height:20px}
.sndd{position:absolute;left:0;top:100%;margin-top:8px;z-index:50;width:360px;background:var(--s1);border-radius:16px;padding:6px;box-shadow:var(--shf),0 0 0 1px var(--line)}
.sndd .mg{display:flex;justify-content:space-between;font-family:var(--r-fm);font-size:10px;letter-spacing:.12em;color:var(--mu);padding:10px 10px 6px}
.sndd .o{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;cursor:pointer;color:var(--tx)}
.sndd .o:hover{background:var(--s2)}.sndd .o.on{background:color-mix(in srgb,var(--acc) 14%,var(--s1))}
.hd .ttl .sndd small{display:block;font:400 12px var(--r-f);letter-spacing:0;text-transform:none;color:var(--mu);margin:2px 0 0}
.sndd .o>div{flex:1}.sndd .o b{display:block;font-size:14.5px}.sndd .o small{font-size:12px;color:var(--mu)}
.sndd .o svg.i{width:16px;height:16px;color:var(--accink)}
.sndd .sep{height:1px;background:var(--div);margin:4px 6px}
.snsub{margin:-2px 0 6px 34px;padding-left:10px;border-left:1px solid var(--div);display:flex;flex-direction:column;gap:1px}
.snsub .si{display:flex;align-items:baseline;gap:8px;padding:6px 10px;border-radius:10px;font-size:13.5px;color:var(--tx2);cursor:pointer;white-space:nowrap}
.snsub .si span{overflow:hidden;text-overflow:ellipsis}
.snsub .si small{margin-left:auto;font-family:var(--r-fm);font-size:10px;color:var(--mu)}
.snsub .si:hover{background:var(--s2)}
.snsub .si.on{color:var(--tx);font-weight:600;background:color-mix(in srgb,var(--acc) 10%,transparent)}
.snsub .si.add{color:var(--mu);align-items:center}.snsub .si.add svg.i{width:14px;height:14px}`;
document.head.appendChild(st);
if(SN.mode){S.v='setlists';render()}
})();
