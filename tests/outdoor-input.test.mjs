import test from 'node:test';import assert from 'node:assert/strict';
import {outdoorSuggestions} from '../assets/js/outdoor-input.mjs';
const row=(date,crag,area,route)=>({date,kind:'outdoor',cragName:crag,areaName:area,routeName:route});
test('recent crags are unique, limited, ordered by record date, and do not mutate the records',()=>{
 const rows=[row('2026-01-01','岩A','エリアA','課題A'),row('2026-03-01','岩B','エリアB','課題B'),row('2026-02-01','岩A','エリアC','課題C'),row('2026-04-01','岩C','',''),row('2026-05-01','岩D','',''),{kind:'gym',date:'2026-06-01',place:'ジム'}],before=structuredClone(rows);
 assert.deepEqual(outdoorSuggestions(rows).crags,['岩D','岩C','岩B']);assert.deepEqual(rows,before);
});
test('area and route names stay inside the selected crag and optionally area, with free input preserved',()=>{
 const rows=[row('2026-01-01','岩A','エリアA','同名課題'),row('2026-02-01','岩A','エリアB','別課題'),row('2026-03-01','岩B','エリアA','他の岩場')];
 assert.deepEqual(outdoorSuggestions(rows,{crag:' 岩A '}).areas,['エリアB','エリアA']);assert.deepEqual(outdoorSuggestions(rows,{crag:'岩A',area:'エリアA'}).routes,['同名課題']);assert.deepEqual(outdoorSuggestions(rows,{crag:'新しい岩場'}).routes,[]);assert.deepEqual(outdoorSuggestions(rows,{crag:' '} ).areas,[]);
});
test('empty, legacy, duplicate and untrusted labels are returned as text without new persisted identities',()=>{
 const rows=[{kind:'outdoor',date:'2026-01-01',place:'旧岩場',routeName:'<img src=x>',areaName:'旧エリア'},row('2026-02-01','旧岩場','旧エリア','<img src=x>'),null];
 assert.deepEqual(outdoorSuggestions(rows,{crag:'旧岩場'}),{crags:['旧岩場'],areas:['旧エリア'],routes:['<img src=x>']});assert.deepEqual(outdoorSuggestions(null),{crags:[],areas:[],routes:[]});
});
