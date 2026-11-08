window.DD=(()=>{
const SONGS=[
 {id:'aag',title:'About A Girl',artist:'Nirvana',tun:'std',dur:'2:48',key:'Em',bpm:'125',links:['audio','tabs'],notes:'band',added:3,next:1},
 {id:'aer',title:'Aerials',artist:'System Of A Down',tun:'dc',dur:'3:55',key:'Cm',bpm:'79',links:['audio','tabs'],notes:'both',added:7,next:1},
 {id:'aat',title:'All Along the Watchtower',artist:'Jimi Hendrix',tun:'half',dur:'4:00',key:'Cm',bpm:'107',links:['audio','video'],added:1},
 {id:'bc',title:'Basket Case',artist:'Green Day',tun:'std',dur:'3:01',key:'A',bpm:'',links:['audio'],added:5,hid:1},
 {id:'bl',title:'Black',artist:'Pearl Jam',tun:'std',dur:'5:43',key:'E',bpm:'107',links:['tabs','audio'],notes:'mine',added:4,next:1},
 {id:'bg',title:'Burn It to the Ground',artist:'Nickelback',tun:'db',dur:'3:32',key:'B',bpm:'132',links:['audio'],added:9,next:1},
 {id:'ev',title:'Everlong',artist:'Foo Fighters',tun:'dd',dur:'4:10',key:'D',bpm:'158',links:[],added:8,next:1},
 {id:'mb',title:'Man in the Box',artist:'Alice In Chains',tun:'half',dur:'4:47',key:'E♭m',bpm:'108',links:['tabs','video'],added:2,next:1},
 {id:'mw',title:'Monkey Wrench',artist:'Foo Fighters',tun:'dd',dur:'3:51',key:'B',bpm:'174',links:['tabs','audio','video'],notes:'band',added:6,next:1},
 {id:'tb',title:'Them Bones',artist:'Alice In Chains',tun:'cstd',dur:'2:30',key:'D',bpm:'128',links:['tabs'],added:10},
 {id:'wica',title:'When I Come Around',artist:'Green Day',tun:'half',dur:'2:58',key:'G♭',bpm:'98',links:['audio','tabs'],added:11},
 {id:'sn',title:'Seven Nation Army',artist:'The White Stripes',tun:'std',dur:'3:51',key:'E',bpm:'124',links:['audio','video'],notes:'mine',added:12,mine:1},
 {id:'hb',title:'Hash Pipe',artist:'Weezer',tun:'half',dur:'3:06',key:'E♭',bpm:'124',links:['audio'],added:13,mine:1}];
const SETS=[{id:'fall',name:'Fall Set',show:'The Crocodile · Sat, Nov 7',slot:45,items:[{sec:'Set 1'},'aag','mw','ev','mb',{brk:15,note:'Swap to backup kit'},{sec:'Set 2'},'wica','bg','bl','aer']},
 {id:'bday',name:'Birthday Jam',show:"Mike's Garage · Sat, Nov 14",slot:0,items:['bc','aag','bl','sn','tb']},
 {id:'ac',name:'Acoustic Sunday',show:'',slot:0,items:['aag','bl','aat']}];
const EV=[{id:'jam',m:'NOV',d:'3',dw:'TUE',t:'Tuesday Open Jam',sub:"8:00 PM · Lucky's Tavern",ty:'evt'},
 {id:'p1',m:'NOV',d:'5',dw:'THU',t:'Thursday run',sub:"7:00 PM · Mike's Garage",ty:'prac'},
 {id:'s1',m:'NOV',d:'7',dw:'SAT',t:'Fall Kickoff',sub:'8:30 PM · The Crocodile',ty:'show',cf:1},
 {id:'p2',m:'NOV',d:'12',dw:'THU',t:'Thursday run',sub:"7:00 PM · Mike's Garage",ty:'prac'},
 {id:'s2',m:'NOV',d:'21',dw:'SAT',t:'Halloween Bash (moved)',sub:'9:00 PM · Neumos',ty:'show',cx:1},
 {id:'pp',m:'OCT',d:'29',dw:'THU',t:'Thursday run',sub:'1:52 played · 5 of 6 songs',ty:'prac',past:1}];
const CHART=[['Verse 1',[[['G','A-'],['','mazing '],['G7','grace, how '],['C','sweet the '],['G','sound']],[['','That '],['G','saved a '],['Em','wretch like '],['A7','me'],['D','']],[['','I '],['G','once was '],['G7','lost, but '],['C','now am '],['G','found']],[['','Was '],['Em','blind but '],['D','now I '],['G','see']]]],
 ['Verse 2',[[['','\'Twas '],['G','grace that '],['G7','taught my '],['C','heart to '],['G','fear']],[['','And '],['G','grace my '],['Em','fears re-'],['A7','lieved'],['D','']],[['','How '],['G','precious '],['G7','did that '],['C','grace ap-'],['G','pear']],[['','The '],['Em','hour I '],['D','first be-'],['G','lieved']]]],
 ['Verse 3',[[['','Through '],['G','many '],['G7','dangers, '],['C','toils and '],['G','snares']],[['','I '],['G','have al-'],['Em','ready '],['A7','come'],['D','']],[['','\'Tis '],['G','grace hath '],['G7','brought me '],['C','safe thus '],['G','far']],[['','And '],['Em','grace will '],['D','lead me '],['G','home']]]],
 ['Verse 4',[[['','When '],['G','we\'ve been '],['G7','there ten '],['C','thousand '],['G','years']],[['','Bright '],['G','shining '],['Em','as the '],['A7','sun'],['D','']],[['','We\'ve '],['G','no less '],['G7','days to '],['C','sing God\'s '],['G','praise']],[['','Than '],['Em','when we\'d '],['D','first be-'],['G','gun']]]]];
const SHAPES={G:'320003',G7:'320001',C:'x32010',Em:'022000',A7:'x02020',D:'xx0232',A:'x02220',Am:'x02210',E:'022100',B7:'x21202',F:'133211',Bm:'x24432',Dm:'xx0231',E7:'020100',C7:'x32310',D7:'xx0212'};
return {SONGS,SETS,EV,CHART,SHAPES}})();
