import test from 'node:test';
import assert from 'node:assert/strict';
import {outdoorDanSummary} from '../assets/js/outdoor-season.mjs';
import {buildOutdoorCharts,chartCeiling} from '../assets/js/outdoor-stats-model.mjs';
const range={from:'2026-10-01',to:'2027-03-31'};
const row=(id,date,grade='二段',extra={})=>({id,date,grade,kind:'outdoor',result:'send',cragName:'岩場A',routeName:id,ascentType:'new',...extra});
const charts=(rows,period=range)=>buildOutdoorCharts(rows,period,outdoorDanSummary(rows,period),'2026-11-20');
test('all charts share the season deduplication rules, including grades without dan points',()=>{
 const rows=[row('new','2026-10-01'),row('same-day','2026-10-01','二段',{routeName:'new',ascentType:'repeat'}),row('second-new','2026-10-02','二段',{routeName:'new'}),row('repeat','2026-11-01','二段',{routeName:'new',ascentType:'repeat'}),row('kyu','2026-11-03','1級'),row('missing','2026-11-04',''),row('fail','2026-11-01','三段',{result:'attempt'})];
 const before=structuredClone(rows),dan=outdoorDanSummary(rows,range),d=charts(rows);
 assert.equal(d.total,4);assert.equal(d.total,dan.newProblems+dan.repeatAscents);assert.equal(d.excluded,2);
 for(const groups of [d.grades,d.crags,d.months]){assert.equal(groups.reduce((n,g)=>n+g.total,0),4);assert.equal(groups.reduce((n,g)=>n+g.repeat,0),1);assert.deepEqual(groups.flatMap(g=>g.ids).sort(),['kyu','missing','new','repeat']);}
 assert.equal(dan.newDan,2);assert.equal(dan.totalDan,4);assert.equal(dan.entries.find(e=>e.id==='kyu').included,true);assert.equal(dan.entries.find(e=>e.id==='kyu').counted,false);assert.deepEqual(rows,before);
});
test('aliases group together while plus, minus, intermediate grades and systems stay separate',()=>{
 const d=charts([row('a','2026-10-01','２段＋'),row('b','2026-10-02','二段+'),row('c','2026-10-02','二段−'),row('d','2026-10-02','二/三段'),row('e','2026-10-02','V10',{gradeSystem:'V Scale'}),row('f','2026-10-02','二段',{gradeSystem:'custom',discipline:'lead'})]);
 assert.equal(d.grades.find(g=>g.label==='二段+').total,2);assert.equal(d.grades.length,5);assert.equal(d.systems.length,3);assert.equal(d.highest,'二/三段');assert.ok(d.systems[0].includes('日本（段級）'));
});
test('month buckets include both boundaries across years, preserve future records and distinguish future emptiness',()=>{
 const d=charts([row('before','2026-09-30'),row('first','2026-10-01'),row('last','2027-03-31'),row('after','2027-04-01')]);
 assert.equal(d.months.length,6);assert.equal(d.months[0].total,1);assert.equal(d.months.at(-1).total,1);assert.equal(d.months.at(-1).future,true);assert.equal(d.months[1].future,false);assert.equal(d.monthPage,0);assert.equal(charts([],{from:'2020-01-01',to:'2026-12-31'}).monthPage,13);
});
test('many crags use five segments and an inspectable remainder without losing any ascent',()=>{
 const rows=Array.from({length:10},(_,i)=>row('r'+i,'2026-10-01','初段',{cragName:'岩場'+i}));const d=charts(rows);
 assert.equal(d.crags.length,6);assert.equal(d.crags.at(-1).total,5);assert.equal(d.crags.at(-1).ids.length,5);assert.equal(d.crags.reduce((n,g)=>n+g.total,0),10);
});
test('missing problem names are kept as independent records; missing crags have a visible bucket',()=>{
 const d=charts([row('a','2026-10-01','初段',{routeName:'',cragName:''}),row('b','2026-10-01','初段',{routeName:'',cragName:''})]);assert.equal(d.total,2);assert.equal(d.crags[0].label,'岩場未設定');
});
test('empty and failed-only seasons have no invented grade or sends',()=>{
 for(const rows of [[],[row('failed','2026-10-01','三段',{result:'attempt'})]]){const d=charts(rows);assert.equal(d.total,0);assert.equal(d.highest,null);assert.equal(d.grades.length,0);assert.equal(d.crags.length,0);assert.equal(d.months.length,6);}
});
test('chart axes are integer, zero-based and accommodate counts beyond the mockup',()=>{
 for(const count of [0,1,4,5,11,99,251,1500]){const ceiling=chartCeiling([count]);assert.ok(ceiling>=count);assert.equal(ceiling%4,0);assert.ok(ceiling<=Math.max(4,count*2));}
});
