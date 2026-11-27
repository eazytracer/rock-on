window.Jam=(()=>{const R=Rock,{ic,tp,item}=R;
const COL=['#ff9a4d','#6cb8ff','#c58bff','#4ade80','#facc15','#f472b6','#2dd4bf','#a3a3a3'];
const P={Eric:0,Dana:1,Kai:2,Mo:3,Lena:4,Tom:5,Jess:6,Frank:7,Ray:1,Sam:2};
const av=(n,sz)=>`<span class="jav" style="background:${COL[P[n]??([...n].reduce((a,ch)=>a+ch.charCodeAt(0),0)%7)]}${sz?`;width:${sz}px;height:${sz}px;font-size:${Math.round(sz*.4)}px`:''}">${n[0]}</span>`;
const avs=a=>`<span class="avs">${a.map(n=>av(n)).join('')}</span>`;
const live=()=>`<span class="lv"><i></i>LIVE</span>`;
const ty=()=>`<span class="r-ty evt">${ic('party')}JAM</span>`;
const PARTS=['Vox','Gtr','Bass','Drums','Keys'];
const LINEUP=[
 {title:'Black',artist:'Pearl Jam',tun:'std',by:'Eric',parts:{Vox:['Eric'],Gtr:['Tom'],Bass:['Dana','Ray'],Drums:[],Keys:null}},
 {title:'Interstate Love Song',artist:'Stone Temple Pilots',tun:'std',by:'Dana',parts:{Vox:[],Gtr:['Eric'],Bass:['Dana'],Drums:['Kai'],Keys:null}},
 {title:'Them Bones',artist:'Alice In Chains',tun:'cstd',by:'Kai',parts:{Vox:['Mo'],Gtr:['Tom','Eric'],Bass:[],Drums:['Kai'],Keys:null}},
 {title:'Mustang Sally',artist:'Wilson Pickett',tun:'std',by:'Frank',parts:{Vox:['Frank','Dana'],Gtr:['Frank'],Bass:[],Drums:['Sam'],Keys:['Jess']}},
 {title:'Seven Nation Army',artist:'The White Stripes',tun:'std',by:'Lena',parts:{Vox:['Lena'],Gtr:['Lena'],Bass:null,Drums:[],Keys:null}},
 {title:'Everlong',artist:'Foo Fighters',tun:'dd',by:'Eric',parts:{Vox:['Eric'],Gtr:['Eric','Tom'],Bass:['Ray'],Drums:['Kai','Sam'],Keys:null}}];
const chipP=(p,who,mine)=>who==null?'':`<span class="pt ${who.length?'f':''} ${mine===p?'me':''}">${p}${who.length?`<em>${who.length>1?who.length:who[0][0]}</em>`:''}</span>`;
const lrow=(s,n,o={})=>`<div class="lr">${o.grip?`<span class="gr">${ic('grip')}</span>`:''}<span class="ln">${n}</span><div class="g"><div class="t1"><b>${s.title}</b>${tp(s.tun,'sm')}</div><div class="t2">${s.artist} · <span class="by">${av(s.by,16)}${s.by}</span></div><div class="pts">${PARTS.map(p=>chipP(p,s.parts[p],o.mine)).join('')}</div></div></div>`;
const REQ=[{song:'Interstate Love Song',artist:'STP',by:'Dana',plays:'Bass',want:['Vocals','Drums'],hands:['Kai']},{song:'Mustang Sally',artist:'Wilson Pickett',by:'Frank',plays:'Vocals, Guitar',want:['Bass'],hands:[],walk:true},{song:'Plush',artist:'STP',by:'Mo',plays:'Vocals',want:['Guitar','Bass','Drums'],hands:['Tom']}];
const rqrow=r=>`<div class="rq"><div class="g"><b>${r.song}</b><small>${r.artist} · ${av(r.by,16)} ${r.by}${r.walk?' <span class="wk">WALK-UP</span>':''} plays ${r.plays}</small><div class="lf2">LOOKING FOR ${r.want.map(w=>`<span>${w}</span>`).join('')}${r.hands.length?` · <span class="hd">${ic('hand')}${r.hands.join(', ')}</span>`:''}</div></div><div class="ac"><span class="r-ib ok">${ic('check')}</span><span class="r-ib">${ic('x')}</span></div></div>`;
const PPL=[{n:'Eric',plays:'Guitar, Vocals',st:'Host',h:4},{n:'Dana',plays:'Bass, Vocals',st:'',h:3},{n:'Frank',plays:'Vocals, Guitar, Harmonica',st:'Walk-up',h:2,walk:true},{n:'Kai',plays:'Drums',st:'',h:3},{n:'Tom',plays:'Guitar',st:'',h:3},{n:'Sam',plays:'Drums',st:'Walk-up',h:2,walk:true}];
const prow=p=>`<div class="pr">${av(p.n,36)}<div class="g"><b>${p.n}${p.st?` <span class="${p.walk?'wk':'hs'}">${p.st.toUpperCase()}</span>`:''}</b><small>${p.plays}</small></div><span class="hc">${ic('hand')}${p.h}</span>${ic('moreh','width:18px;height:18px;color:var(--mu2)')}</div>`;
const parts=(s,mine)=>`<div class="pbig">${PARTS.filter(p=>s.parts[p]!==null&&s.parts[p]!==undefined).map(p=>{const w=s.parts[p];return `<div class="pb ${mine===p?'me':''}"><b>${p==='Vox'?'Vocals':p==='Gtr'?'Guitar':p}</b><span>${w.length?w.map(x=>av(x,22)).join(''):'<small>Open</small>'}</span><i>${mine===p?ic('check'):ic('hand')}</i></div>`}).join('')}</div>`;
const jrow=(m,d,dw,t,sub,badge)=>`<div class="r-item" style="min-height:64px"><div class="db"><small>${m}</small><b>${d}</b><small style="margin-top:2px">${dw}</small></div><div class="g"><b>${t}</b><small>${sub}</small></div>${badge?`<span class="bdg">${badge}</span>`:''}<span class="tr">${ic('chev','width:18px;height:18px')}</span></div>`;
return {av,avs,live,ty,PARTS,LINEUP,lrow,REQ,rqrow,PPL,prow,parts,jrow,COL}})();
