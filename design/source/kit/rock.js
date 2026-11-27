/* Rock On kit: tokens + HTML builders. Load after rock.css. Exposes window.Rock.
   Every builder returns an HTML string. Usage: el.innerHTML = Rock.phone(Rock.tpl.list({...})) */
(()=>{
const okhex=(L,C,h)=>{for(let c=C;c>=0;c-=.005){const a=c*Math.cos(h*Math.PI/180),b=c*Math.sin(h*Math.PI/180);const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;const lin=[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];if(lin.every(v=>v>=-.0005&&v<=1.0005))return '#'+lin.map(v=>{v=Math.min(1,Math.max(0,v));v=v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055;return Math.round(v*255).toString(16).padStart(2,'0')}).join('')}return '#888888'};
// tuning spine: pitch-ranked, [id, label, name, strings low→high (MIDI)]
const SPINE=[['cstd','C STD','C Standard',[36,41,46,51,55,60]],['db','B DROP','Drop B',[35,42,47,52,56,61]],['dc','C DROP','Drop C',[36,43,48,53,57,62]],['whole','D STD','Whole-step down',[38,43,48,53,57,62]],['ddb','D♭ DROP','Drop D♭',[37,44,49,54,58,63]],['od','D OPEN','Open D',[38,45,50,54,57,62]],['og','G OPEN','Open G',[38,43,50,55,59,62]],['dad','DADGAD','DADGAD',[38,45,50,55,57,62]],['half','E♭ STD','Half-step down',[39,44,49,54,58,63]],['dd','D DROP','Drop D',[38,45,50,55,59,64]],['std','E STD','Standard',[40,45,50,55,59,64]]];
const T={};SPINE.forEach((s,i)=>{const t=i/(SPINE.length-1),h=345-235*t;T[s[0]]={id:s[0],label:s[1],name:s[2],strings:s[3],dark:okhex(.64+.24*t,.16,h),light:okhex(.45+.17*t,.16,h)}});
// Nov 7 2026 decision: keep the app's existing tuning hues (muscle memory); only Drop D (was orange, clashed with the
// band accent) and Drop C (was red, clashed with danger) move. Light values are the Tailwind 700 shade of the same hue.
// SPINE above still sets order (low → high) and strings; okhex / customTuning are kept for reference only.
const PALETTE={std:['#60a5fa','#1d4ed8'],half:['#14b8a6','#0f766e'],whole:['#0ea5e9','#0369a1'],dd:['#84cc16','#4d7c0f'],ddb:['#f59e0b','#b45309'],
 dc:['#d946ef','#a21caf'],db:['#a855f7','#7e22ce'],og:['#eab308','#a16207'],od:['#ec4899','#be185d'],dad:['#10b981','#047857'],cstd:['#8b5cf6','#6d28d9']};
Object.entries(PALETTE).forEach(([k,[d,l]])=>{if(T[k]){T[k].dark=d;T[k].light=l}});
const customTuning=(midi,std=[40,45,50,55,59,64])=>{const off=(midi.reduce((a,b)=>a+b,0)-std.reduce((a,b)=>a+b,0))/midi.length;const t=Math.max(0,Math.min(1,(off+4)/5)),h=345-235*t;return {dark:okhex(.64+.24*t,.16,h),light:okhex(.45+.17*t,.16,h)}};
const NOTES=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
// icons
const ICONS={
star:'<path d="m12 3 2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.8z"/>',phone:'<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',share:'<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',qr:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12"/><circle cx="12" cy="12" r="3"/>',refresh:'<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>',out:'<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10"/>',crown:'<path d="m3 8 4 4 5-7 5 7 4-4-2 11H5z"/>',palette:'<path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.8 1.8-1.8 0-1.3-1-1.7-1-2.9 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',ticket:'<path d="M4 6h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4V7a1 1 0 0 1 1-1z"/><path d="M15 6.5v2M15 11v2M15 15.5v2"/>',party:'<path d="M4 20.5 8.3 8.7l7 7z"/><path d="M13 3.5c.6 1.6.1 3.1-1 4.2M20.5 11c-1.6-.6-3.1-.1-4.2 1M17.5 3l.4 1.8M21 7l-1.8.4M15.3 8.7l1.5-1.5"/>',guitar:'<path d="m14 10 6.5-6.5M18.5 2.5l3 3"/><path d="M14.2 9.8a4 4 0 0 0-5 .6c-.8.8-.9 1.9-1.7 2.4-.9.6-2.4.4-3.4 1.4-1.8 1.8-1.4 4.6.5 6.5s4.7 2.3 6.5.5c1-1 .8-2.5 1.4-3.4.5-.8 1.6-.9 2.4-1.7a4 4 0 0 0 .6-5"/><path d="m8.5 15.5 1 1"/>',mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',drum:'<ellipse cx="12" cy="10" rx="8" ry="3"/><path d="M4 10v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V10"/><path d="m8 2.5 3.5 6.5M17 3.5 13.5 9"/>',amp:'<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M3.5 8.5h17"/><circle cx="12" cy="14.5" r="3.5"/><path d="M7 6.3h.01M10 6.3h.01"/>',bolt:'<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>',flame:'<path d="M12 21.5c3.9 0 7-2.8 7-6.8 0-3.3-2.2-5.4-3.6-7.7-.6 2-1.7 3.2-2.9 3.5.3-3.4-1.2-6.4-3.5-8-.2 3.3-4 5.9-4 11.8 0 4.1 3.1 7.2 7 7.2z"/>',vinyl:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 6a6 6 0 0 0-6 6"/>',headph:'<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="7" rx="2"/><rect x="16.5" y="14" width="4.5" height="7" rx="2"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.5 5.7 3.5 9s-1 6.3-3.5 9c-2.5-2.7-3.5-5.7-3.5-9S9.5 5.7 12 3"/>',camera:'<rect x="3" y="6.5" width="18" height="13.5" rx="3"/><path d="M8.5 6.5 10 4h4l1.5 2.5"/><circle cx="12" cy="13" r="3.5"/>',upload:'<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.5 3.8 3.8 0 0 1-.9 7.5"/><path d="M12 12.5v8M8.8 15.5 12 12.3l3.2 3.2"/>',link2:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',metro:'<path d="M9 3h6l4 18H5z"/><path d="M12 17 16.5 6.5"/><path d="M7.5 14h9"/>',chordbox:'<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M5 8.5h14M5 13h14M9.7 3.5v17M14.3 3.5v17"/>',sliders:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',speaker:'<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',hand:'<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v6.5M14 10.5V5.5a1.5 1.5 0 0 1 3 0V13M17 11a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1.5a6 6 0 0 1-4.6-2.2L3.5 14.8a1.5 1.5 0 0 1 2.3-1.9L8 15"/>',live:'<circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',tv:'<rect x="2.5" y="4.5" width="19" height="13" rx="2"/><path d="M8 21h8"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',watch:'<circle cx="12" cy="14" r="7.5"/><path d="M12 10.5V14l2 1.5M10 2.5h4M12 2.5v4M18 7l1.5-1.5"/>',key:'<path d="M10 4 8 20M16 4l-2 16M5 9h15M4 15h15"/>',bpm:'<path d="M3 12h4l2-6 4 12 2-6h6"/>',fork:'<path d="M8 3v7a4 4 0 0 0 8 0V3M12 14v7"/>',
cal:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',doc:'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',docs:'<path d="M8 3h7l4 4v11H8z"/><path d="M15 3v4h4M5 7v14h10"/>',lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',people:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',audio:'<path d="M4 10v4M8 6.5v11M12 3.5v17M16 7.5v9M20 10.5v3"/>',
tabs:'<path d="M5 4.5h16M5 9.5h16M5 14.5h16M5 19.5h16" stroke-width="1.4"/><path d="M4 3v18" stroke-width="3.4"/><circle cx="10" cy="9.5" r="2.2" fill="currentColor" stroke="none"/><circle cx="16" cy="14.5" r="2.2" fill="currentColor" stroke="none"/>',
video:'<path d="M8 5.5v13l10.5-6.5z"/>',lyrics:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',cloud:'<path d="M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 17.8 9 4.75 4.75 0 0 1 17.5 18.5z"/>',
grip:'<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>',moreh:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',filter:'<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',sort:'<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>',
 swap:'<path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4"/>',view:'<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
plus:'<path d="M12 5v14M5 12h14"/>',bell:'<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0"/>',down:'<path d="m6 9 6 6 6-6"/>',up:'<path d="m6 15 6-6 6 6"/>',back:'<path d="M15 5l-7 7 7 7"/>',chev:'<path d="m9 6 6 6-6 6"/>',
x:'<path d="M6 6l12 12M18 6 6 18"/>',arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',play:'<path d="m7 5 12 7-12 7z" fill="currentColor"/>',home:'<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
music:'<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',list:'<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',addl:'<path d="M3 6h12M3 12h12M3 18h7M18 14v7M14.5 17.5h7"/>',copy:'<rect x="8" y="8" width="13" height="13" rx="3"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
eyeoff:'<path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-2.6 3.2M6.5 7.6C4.3 9.2 3 12 3 12s4 6 9 6a8.6 8.6 0 0 0 4.2-1.1M9.9 10a3 3 0 0 0 4.2 4.2"/>',trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
open:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',expand:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',check:'<path d="m5 12 5 5 9-10"/>',
offline:'<path d="M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 17.8 9 4.75 4.75 0 0 1 17.5 18.5zM4 4l16 16"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
voice:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',warn:'<path d="M12 3 2 20h20zM12 10v4M12 17h.01"/>'};
const sprite=()=>{if(document.getElementById('rock-sprite'))return;const d=document.createElement('div');d.id='rock-sprite';d.style.cssText='position:absolute;width:0;height:0;overflow:hidden';d.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg"><defs>${Object.entries(ICONS).map(([k,v])=>`<symbol id="ri-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('')}</defs></svg>`;document.body.prepend(d)};
if(document.body)sprite();else document.addEventListener('DOMContentLoaded',sprite);
const ic=(id,st='')=>`<svg class="i" ${st?`style="${st}"`:''}><use href="#ri-${id}"/></svg>`;
const tvars=k=>{const t=T[k]||k;return `--cd:${t.dark};--cl:${t.light}`};
// ---------- primitives ----------
const tp=(k,size='')=>`<span class="r-tp ${size}" style="${tvars(k)}">${(T[k]||{}).label||k.label}</span>`;
const dot=k=>`<span class="r-dot" style="${tvars(k)}"></span>`;
const LINK_NAME={tabs:'Tabs',audio:'Spotify',video:'YouTube',lyrics:'Lyrics',cloud:'Cloud file',link:'Link'};
const lk=t=>`<span class="r-lk ${t}" title="${LINK_NAME[t]}"><i>${ic(t)}</i></span>`;
const notes=n=>n==='band'?`<span class="r-nm" title="Band notes">${ic('doc')}</span>`:n==='mine'?`<span class="r-nm" title="My notes">${ic('doc')}<span class="lkb">${ic('lock')}</span></span>`:n==='both'?`<span class="r-nm" title="Band + my notes">${ic('docs')}</span>`:'';
const btn=(label,o={})=>`<span class="r-btn ${o.kind||''} ${o.size||''}" ${o.attr||''}>${o.icon?ic(o.icon,o.iconSt||'width:18px;height:18px'):''}${label}</span>`;
const ib=(icon,o={})=>`<span class="r-ib" ${o.attr||''}>${ic(icon)}${o.badge?'<span class="r-badge"></span>':''}</span>`;
const chip=(label,o={})=>`<span class="r-chip ${o.on?'on':''}">${o.icon?ic(o.icon):''}${label}</span>`;
const seg=(opts,on=0,attr='')=>`<div class="r-seg" ${attr}>${opts.map((o,i)=>`<span class="${i===on?'on':''}">${o}</span>`).join('')}</div>`;
const sw=on=>`<span class="r-sw ${on?'on':''}"></span>`;
const step=(val,label)=>`<div class="r-step"><span>−</span><span class="v">${val}${label?`<small>${label}</small>`:''}</span><span>+</span></div>`;
const meta=(icon,val,cls='')=>`<span class="r-meta ${cls} ${val?'':'none'}">${icon?ic(icon):''}${val||'—'}</span>`;
// ---------- patterns ----------
const grp=inner=>`<div class="r-grp">${inner}</div>`;
const gl=(label,act)=>`<div class="r-gl">${label}${act?`<span class="act">${act.icon?ic(act.icon):''}${act.label}</span>`:''}</div>`;
const item=({icon,lead,title,sub,trail})=>`<div class="r-item">${lead||''}<div class="g"><b>${title}</b>${sub?`<small>${sub}</small>`:''}</div>${trail?`<span class="tr">${ic(trail,'width:18px;height:18px')}</span>`:''}</div>`;
const fld=(k,v,o={})=>`<div class="r-fld ${o.focus?'focus':''}"><div class="g"><span class="k">${k}${o.req?'<em>REQUIRED</em>':''}</span><div class="v ${o.ph?'ph':''}">${v}</div></div>${o.chev?`<span class="chev">${ic('chev')}</span>`:''}${o.right||''}</div>`;
const sec=label=>`<div class="r-sec">${label}</div>`;
// song: {title,artist,tun,dur,key,bpm,links:[],notes}
function row(s,o={}){const cmp=o.compact;const v=Object.assign({artist:false,key:true,bpm:true,links:true},o.view||{});
 const title=`<div class="t">${o.n?`<span class="n">${o.n}</span>`:''}${s.title}${v.artist&&s.artist?` <span class="ar">· ${s.artist}</span>`:''}${notes(s.notes)}</div>`;
 const gp=o.grip?`<div class="gp" data-grip>${ic('grip')}</div>`:'';
 const cls=`r-sr ${o.grip?'ord':''} ${cmp?'cmp':''} ${o.lift?'lift':''} ${o.hidden?'hid':''}`;
 const links=v.links?`<div class="r-lks">${(s.links||[]).slice(0,cmp?1:2).map(lk).join('')}</div>`:'';
 if(cmp)return `<div class="${cls}" data-row data-t="${s.tun}">${gp}<div class="bd"><div class="l1">${title}${links}<span class="w-tun">${tp(s.tun)}</span><span class="r-meta w-time">${s.dur}</span></div></div></div>`;
 return `<div class="${cls}" data-row data-t="${s.tun}">${gp}<div class="bd"><div class="l1">${title}</div><div class="l2"><div class="sl"><span class="w-tun">${tp(s.tun)}</span>${meta('clock',s.dur,'w-time')}${v.key?meta('key',s.key,'w-key'):''}${v.bpm?meta('bpm',s.bpm,'w-bpm'):''}</div>${links}</div></div></div>`}
const retune=(a,b,o={})=>`<div class="r-retune">RETUNE ${tp(a,'sm')}${ic('arrow')}${tp(b,'sm')}${o.tune?`<span class="r-btn">${ic('fork')}Tune</span>`:''}</div>`;
const brk=(label,note)=>`<div class="r-brk">${ic('clock')}<b>${label}</b>${note?`<span class="r-muted">· ${note}</span>`:''}</div>`;
// list of songs with sections, breaks and auto retune lines. items: {sec}|{brk,note}|song
function setlist(items,o={}){let h='',buf='',prev=null,n=0;const flush=()=>{if(buf){h+=grp(buf);buf=''}};
 for(const x of items){if(x.sec){flush();h+=sec(x.sec);continue}if(x.brk){buf+=brk(x.brk,x.note);continue}n++;if(prev&&prev!==x.tun)buf+=retune(prev,x.tun,{tune:o.tune});prev=x.tun;buf+=row(x,{n,grip:o.grip!==false,view:o.view,compact:o.compact})}flush();return h}
// ---------- chrome ----------
const sb=()=>`<div class="r-sb"><span>9:41</span><span>●●● ▮</span></div>`;
const ctx=(name='iPod Shuffle',ini='iP')=>`<span class="r-ctx"><i>${ini}</i>${name}${ic('down')}</span>`;
const appbar=(o={})=>`<div class="r-ab">${o.left||ctx(o.ctxName,o.ctxIni)}<div class="grpr">${o.right||ib('bell',{badge:true})}</div></div>`;
const backbar=(label,right='')=>`<div class="r-ab">${btn(label,{kind:'back',icon:'back',iconSt:'width:20px;height:20px'})}<div class="grpr">${right}</div></div>`;
const editbar=(title,canSave=true,save='Save')=>`<div class="r-eb">${btn('Cancel',{kind:'text'})}<b class="r-h3">${title}</b>${btn(save,{kind:canSave?'pri':''})}</div>`;
const nav=on=>`<div class="r-nav">${['home','music','list','cal','moreh'].map((x,i)=>`<span class="${i===on?'on':''}">${ic(x)}</span>`).join('')}</div>`;
const title=(t,count)=>`<div class="r-ttl"><div class="r-d r-h1">${t}</div>${count!=null?`<small>${count}</small>`:''}</div>`;
const pager=()=>`<div class="r-pager"><div class="r-pg bk">${ic('up')}<small>BACK</small></div><div class="r-pg nx">${ic('down')}<small>NEXT</small></div></div>`;
// ---------- overlays ----------
const sheet=(o)=>`<div class="r-scrim"></div><div class="r-sheet">${o.title?`<h3>${o.title}</h3>`:''}${o.sub?`<div class="sub">${o.sub}</div>`:''}${o.body||''}${o.buttons?`<div class="r-btns">${o.buttons}</div>`:''}</div>`;
const srow=({icon,label,sub,aside,trail,cls=''})=>`<div class="r-row ${cls}">${icon?ic(icon):''}<div class="g">${label}${sub?`<small>${sub}</small>`:''}</div>${aside?`<span class="aside">${aside}</span>`:''}${trail||''}</div>`;
const dialog=(t,p,cancel='Cancel',act='Delete',kind='dng')=>`<div class="r-scrim"></div><div class="r-dlg"><h3>${t}</h3><p>${p}</p><div class="r-btns">${btn(cancel,{size:'lg'})}${btn(act,{kind,size:'lg'})}</div></div>`;
const toast=(msg,undo=true)=>`<div class="r-toast">${msg}${undo?'<u>Undo</u>':''}</div>`;
const banner=(icon,msg,sub,kind='')=>`<div class="r-banner ${kind}">${ic(icon)}<div class="g">${msg}${sub?`<small>${sub}</small>`:''}</div></div>`;
const empty=(icon,t,p,action)=>`<div class="r-empty"><span class="ic">${ic(icon)}</span><b>${t}</b><p>${p}</p>${action||''}</div>`;
const skelRow=()=>`<div class="r-sr"><div class="bd"><span class="r-skel" style="width:60%;height:16px"></span><div style="display:flex;gap:8px;margin-top:12px"><span class="r-skel" style="width:70px"></span><span class="r-skel" style="width:40px"></span><span class="r-skel" style="width:40px"></span></div></div></div>`;
// ---------- device + screen templates ----------
const phone=(inner,o={})=>`<div class="r-phone"><div class="r" ${o.theme?`data-theme="${o.theme}"`:''} ${o.ctx?`data-ctx="${o.ctx}"`:''} ${o.attr||''}>${sb()}${inner}</div></div>`;
const tpl={
 // tab root: context switcher, display title, search, tools, list, FAB, nav
 list:o=>`${appbar(o)}${title(o.title,o.count)}${o.search?`<div class="r-search">${ic('search')}${o.search}</div>`:''}${o.tools?`<div class="r-tools">${o.tools}</div>`:''}<div class="r-body">${o.body||''}</div>${o.fab?`<span class="r-fab">${btn(o.fab,{kind:'pri',size:'lg',icon:'plus',iconSt:'width:20px;height:20px;stroke-width:2.4'})}</span>`:''}${nav(o.nav??1)}${o.overlay||''}`,
 // pushed detail: back, kicker, display title, facts, groups, primary action docked
 detail:o=>`${backbar(o.back,o.right||'')}<div class="r-body">${o.kicker?`<div class="r-kick">${o.kicker}</div>`:''}<div class="r-d" style="font-size:52px;padding:6px 20px 12px">${o.title}</div>${o.facts||''}${o.body||''}</div>${o.cta?`<div class="r-fade"></div><div class="r-dock">${o.cta}</div>`:''}${o.overlay||''}`,
 // full-screen route for anything with fields
 editor:o=>`${editbar(o.title,o.canSave!==false,o.save)}<div class="r-body">${o.body||''}</div>${o.overlay||''}`,
 // stage: close, compact header, controls row, content, giant pager
 stage:o=>`<div class="r-ab">${ib('x')}<div style="flex:1;min-width:0"><b style="display:block;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.title}</b><span class="r-m r-muted" style="display:flex;gap:8px;align-items:center;margin-top:3px">${o.meta||''}</span></div>${o.right||''}</div>${o.controls?`<div style="display:flex;gap:8px;padding:0 14px 10px;flex-shrink:0">${o.controls}</div>`:''}<div class="r-body" style="padding:4px 20px 150px">${o.body||''}</div>${pager()}${o.overlay||''}`
};
const SONGS={
 aag:{title:'About A Girl',artist:'Nirvana',tun:'std',dur:'2:48',key:'Em',bpm:'125',links:['audio','tabs'],notes:'band'},
 aer:{title:'Aerials',artist:'System Of A Down',tun:'dc',dur:'3:55',key:'Cm',bpm:'79',links:['audio','tabs'],notes:'both'},
 aat:{title:'All Along the Watchtower',artist:'Jimi Hendrix',tun:'half',dur:'4:00',key:'Cm',bpm:'107',links:['audio','video']},
 bc:{title:'Basket Case',artist:'Green Day',tun:'std',dur:'3:01',key:'A',bpm:'',links:['audio']},
 ev:{title:'Everlong',artist:'Foo Fighters',tun:'dd',dur:'4:10',key:'D',bpm:'158',links:[]},
 mw:{title:'Monkey Wrench',artist:'Foo Fighters',tun:'dd',dur:'3:51',key:'B',bpm:'174',links:['tabs','audio','video'],notes:'band'},
 mb:{title:'Man in the Box',artist:'Alice In Chains',tun:'half',dur:'4:47',key:'E♭m',bpm:'108',links:['tabs','video']},
 bl:{title:'Black',artist:'Pearl Jam',tun:'std',dur:'5:43',key:'E',bpm:'107',links:['tabs','audio'],notes:'mine'}};
window.Rock={okhex,T,SPINE,customTuning,NOTES,ICONS,ic,tp,dot,lk,notes,btn,ib,chip,seg,sw,step,meta,grp,gl,item,fld,sec,row,retune,brk,setlist,sb,ctx,appbar,backbar,editbar,nav,title,pager,sheet,srow,dialog,toast,banner,empty,skelRow,phone,tpl,SONGS,LINK_NAME};
})();
