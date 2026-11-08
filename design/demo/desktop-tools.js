// Desktop tools: Tuner, Metronome, Duplicate practice
(()=>{const {S,V,app,render,head,NN,SETS,EV,byId,toast}=DK,{ic,btn,seg,sw}=Rock;
const TSEG=i=>seg(['Tuner','Metronome','Chords'],i,'data-tools');
const TUNS=[['std','E STD',[40,45,50,55,59,64]],['half','E♭ STD',[39,44,49,54,58,63]],['dd','D DROP',[38,45,50,55,59,64]],['dc','C DROP',[36,43,48,53,57,62]],['cstd','C STD',[36,41,46,51,55,60]]];
const TU={t:0,s:0,c:-18,auto:true};
let AC=null;const ac=()=>{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();return AC};
const KS={};const pluck=m=>{const a=ac(),sr=a.sampleRate,f=440*Math.pow(2,(m-69)/12);let b=KS[m];if(!b){const n=Math.floor(sr*2.4);b=a.createBuffer(1,n,sr);const d=b.getChannelData(0),P=Math.max(2,Math.round(sr/f)),r=new Float32Array(P);for(let i=0;i<P;i++)r[i]=Math.random()*2-1;for(let q=0;q<2;q++)for(let i=0;i<P;i++)r[i]=(r[i]+r[(i+1)%P])*.5;let x=0;const dec=.996-Math.min(.004,f/50000);for(let i=0;i<n;i++){const c=r[x];r[x]=dec*.5*(c+r[(x+1)%P]);d[i]=c;x=(x+1)%P}KS[m]=b}
 const s=a.createBufferSource(),lp=a.createBiquadFilter(),g=a.createGain();s.buffer=b;lp.type='lowpass';lp.frequency.value=2300;g.gain.value=.35;s.connect(lp).connect(g).connect(a.destination);s.start()};
const nArr=c=>{const a=Math.abs(c);return a>25?3:a>10?2:a>3?1:0};
const face=()=>{const m=TUNS[TU.t][2][TU.s],c=Math.round(TU.c),n=nArr(c),ok=n===0;
 const chev=left=>Array.from({length:3},(_,i)=>`<i class="${(left?c<0:c>0)&&i<n?'on':''}">${ic('chev',left?'':'transform:rotate(180deg)')}</i>`).join('');
 return `<div class="tnf ${ok?'ok':''}"><div class="tnr"><div class="chv l">${chev(true)}</div><div class="tnn"><b>${NN[m%12]}</b><small>${Math.floor(m/12)-1}</small></div><div class="chv r">${chev(false)}</div></div>
<div class="tnm"><div class="sc">${Array.from({length:21},(_,i)=>`<i class="${i===10?'z':i%5===0?'M':''}"></i>`).join('')}</div><span class="nd" style="left:${50+Math.max(-50,Math.min(50,c))}%"></span></div>
<div class="tnc">${ok?'IN TUNE':(c<0?'TUNE UP · ':'TUNE DOWN · ')+Math.abs(c)+'¢'}</div></div>`};
V.tuner=()=>{const tu=TUNS[TU.t];return head('Tools','Tuner',null,TSEG(0))+`<div class="split tsp"><div class="pane tmain" data-tnface>${face()}<div class="tdemo"><span>No mic in this mockup. Drag to detune:</span><input type="range" min="-50" max="50" value="${Math.round(TU.c)}" data-tnc></div></div>
<div class="pane side tside"><h3>TUNING</h3><div class="tch">${TUNS.map(([k,l],i)=>`<span class="r-chip ${i===TU.t?'on':''}" data-tnt="${i}">${l}</span>`).join('')}<span class="r-chip" data-v="settings">${ic('plus','width:14px;height:14px')}Custom</span></div>
<h3>STRINGS · LOW TO HIGH</h3><div class="tst">${tu[2].map((m,i)=>`<span class="${i===TU.s?'on':''}" data-tns="${i}"><b>${NN[m%12]}</b><small>${6-i}</small></span>`).join('')}</div>
<div class="tro">${btn('Hear '+NN[tu[2][TU.s]%12],{icon:'speaker',size:'lg',attr:'data-tnp'}).replace('r-btn','r-btn w')}</div>
<div class="trow"><div><b>Auto-detect string</b><small>Follows whichever string you play</small></div><span data-tna>${sw(TU.auto)}</span></div>
<div class="tkeys">KEYS · 1–6 STRING · SPACE HEAR · ← → TUNING</div></div></div>`};
// metronome
const MT={bpm:124,sig:2,sub:0,beats:['acc','n','n','n'],on:false,flash:true,taps:[]};
const SIG=[[2,4],[3,4],[4,4],[6,8]];
const mk=b=>{let n='LENTO';for(const [v,l] of [[60,'LARGO'],[76,'ADAGIO'],[108,'ANDANTE'],[120,'MODERATO'],[156,'ALLEGRO'],[176,'VIVACE'],[200,'PRESTO']])if(b>=v)n=l;return n};
V.metro=()=>{const set=SETS.find(s=>s.id===S.set)||SETS[0];return head('Tools','Metronome',null,TSEG(1))+`<div class="split tsp"><div class="pane tmain"><div class="mtb">${MT.beats.map((b,i)=>`<span data-mb="${i}" class="${b==='acc'?'acc':b==='mute'?'mute':''}">${i+1}</span>`).join('')}</div><div class="mth">Click a beat: accent · normal · silent</div>
<div class="mtr">${btn('−',{attr:'data-mbd="-1"'})}<div class="mtn"><b data-mbpm>${MT.bpm}</b><small data-mmk>${mk(MT.bpm)}</small></div>${btn('+',{attr:'data-mbd="1"'})}</div>
<input type="range" min="30" max="260" value="${MT.bpm}" data-msl class="msl" aria-label="Tempo">
<div class="mtg">${btn('Tap',{size:'lg',attr:'data-mtap'})}${btn(MT.on?'Stop':'Start',{kind:MT.on?'':'pri',size:'lg',icon:MT.on?'':'play',attr:'data-mgo'}).replace('r-btn','r-btn mgo')}</div><div class="mfl" data-mfl></div></div>
<div class="pane side tside"><h3>TIME</h3>${seg(SIG.map(s=>s.join('/')),MT.sig,'data-msig')}<h3>CLICKS PER BEAT</h3>${seg(['1','2','3','4'],MT.sub,'data-msub')}
<div class="trow"><div><b>Flash on the beat</b><small>For loud rooms</small></div><span data-mflt>${sw(MT.flash)}</span></div>
<h3>FROM ${set.name.toUpperCase()}</h3><div class="msongs">${set.items.filter(x=>typeof x==='string').map(id=>{const s=byId(id);return s&&s.bpm?`<div class="ms" data-mset="${s.bpm}"><span>${s.title}</span><b>${s.bpm}</b></div>`:''}).join('')}</div>
<div class="tkeys">KEYS · SPACE START · T TAP · ↑ ↓ TEMPO</div></div></div>`};
let mtT=null,nx=0,step=0;
const clk=(t,k)=>{const a=ac(),o=a.createOscillator(),g=a.createGain();o.type='triangle';o.frequency.value=k==='acc'?1568:k==='sub'?784:1046;const v=k==='acc'?.4:k==='sub'?.1:.24;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.002);g.gain.exponentialRampToValueAtTime(.0001,t+.06);o.connect(g).connect(a.destination);o.start(t);o.stop(t+.08)};
const sched=()=>{const a=ac(),spb=60/MT.bpm*(SIG[MT.sig][1]===8?.5:1),p=MT.sub+1;while(nx<a.currentTime+.12){const n=MT.beats.length,bi=Math.floor(step/p)%n,sb=step%p,k=MT.beats[bi];if(k!=='mute')clk(nx,sb?'sub':k);
 if(!sb){const d=(nx-a.currentTime)*1000;setTimeout(()=>{if(!MT.on)return;app.querySelectorAll('[data-mb]').forEach((e,i)=>e.classList.toggle('hit',i===bi));const f=app.querySelector('[data-mfl]');if(f&&MT.flash&&k==='acc'){f.classList.add('on');setTimeout(()=>f.classList.remove('on'),90)}},Math.max(0,d))}nx+=spb/p;step++}};
const mStart=()=>{ac();MT.on=true;step=0;nx=AC.currentTime+.06;clearInterval(mtT);mtT=setInterval(sched,25);render()};
const mStop=()=>{MT.on=false;clearInterval(mtT);render()};
const mSet=b=>{MT.bpm=Math.max(30,Math.min(260,b));const e=app.querySelector('[data-mbpm]');if(e){e.textContent=MT.bpm;app.querySelector('[data-mmk]').textContent=mk(MT.bpm);app.querySelector('[data-msl]').value=MT.bpm}};
const setSig=i=>{MT.sig=i;MT.beats=Array.from({length:SIG[i][0]},(_,k)=>k===0||(SIG[i][1]===8&&k===3)?'acc':'n')};
// events (capture so they run before the main handler)
app.addEventListener('click',e=>{const t=e.target,c=s=>t.closest(s);let x;
 if(S.v!=='tuner'&&S.v!=='metro')return;
 const stop=()=>e.stopPropagation();
 if(x=c('[data-tnt]')){stop();TU.t=+x.dataset.tnt;TU.s=0;TU.c=-18;render();return}
 if(x=c('[data-tns]')){stop();TU.s=+x.dataset.tns;TU.c=[-22,9,-4,31,-12,2][TU.s];pluck(TUNS[TU.t][2][TU.s]);render();return}
 if(c('[data-tnp]')){stop();pluck(TUNS[TU.t][2][TU.s]);return}
 if(c('[data-tna]')){stop();TU.auto=!TU.auto;render();return}
 if(x=c('[data-mb]')){stop();const i=+x.dataset.mb;MT.beats[i]=MT.beats[i]==='acc'?'n':MT.beats[i]==='n'?'mute':'acc';render();return}
 if(x=c('[data-mbd]')){stop();mSet(MT.bpm+(+x.dataset.mbd));return}
 if(c('[data-mgo]')){stop();MT.on?mStop():mStart();return}
 if(c('[data-mtap]')){stop();const now=performance.now();MT.taps=MT.taps.filter(v=>now-v<2500);MT.taps.push(now);if(MT.taps.length>4)MT.taps.shift();if(MT.taps.length>1)mSet(Math.round(60000/((MT.taps[MT.taps.length-1]-MT.taps[0])/(MT.taps.length-1))));clk(ac().currentTime,'n');return}
 if(x=c('[data-msig] span')){stop();setSig([...x.parentNode.children].indexOf(x));step=0;render();return}
 if(x=c('[data-msub] span')){stop();MT.sub=[...x.parentNode.children].indexOf(x);render();return}
 if(c('[data-mflt]')){stop();MT.flash=!MT.flash;render();return}
 if(x=c('[data-mset]')){stop();mSet(+x.dataset.mset);toast('Tempo set to '+x.dataset.mset);return}
 if(c('[data-tools] span')&&MT.on)mStop()},true);
app.addEventListener('input',e=>{if(e.target.matches('[data-tnc]')){TU.c=+e.target.value;app.querySelector('[data-tnface] .tnf').outerHTML=face()}if(e.target.matches('[data-msl]'))mSet(+e.target.value)});
document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;
 if(S.v==='metro'){if(e.code==='Space'){e.preventDefault();MT.on?mStop():mStart()}else if(e.key==='t'||e.key==='T')app.querySelector('[data-mtap]')?.click();else if(e.key==='ArrowUp'){e.preventDefault();mSet(MT.bpm+1)}else if(e.key==='ArrowDown'){e.preventDefault();mSet(MT.bpm-1)}}
 if(S.v==='tuner'){if(/^[1-6]$/.test(e.key)){TU.s=6-(+e.key);pluck(TUNS[TU.t][2][TU.s]);render()}else if(e.code==='Space'){e.preventDefault();pluck(TUNS[TU.t][2][TU.s])}else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){TU.t=(TU.t+(e.key==='ArrowRight'?1:TUNS.length-1))%TUNS.length;render()}}});
setInterval(()=>{if(S.v!=='tuner'||!TU.auto)return;const f=app.querySelector('[data-tnface]');if(!f||document.activeElement?.matches('[data-tnc]'))return;TU.c=TU.c*.92+(Math.random()-.5)*1.6;f.querySelector('.tnf').outerHTML=face();const sl=f.querySelector('[data-tnc]');if(sl)sl.value=Math.round(TU.c)},300);
render();
})();
