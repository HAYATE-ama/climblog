import test from 'node:test';import assert from 'node:assert/strict';
import {recordSummary,routineLabel,recordLineMarkup,searchRecordMarkup,outdoorStatMarkup,recordAccessibleLabel} from '../assets/js/compact-records.mjs';
test('outdoor lines use route identity and preserve missing names and NoGrade',()=>{const r={kind:'outdoor',place:'恵那',routeName:'課題A',grade:'二段',result:'flash',attemptsRange:'6-10'};assert.deepEqual(recordSummary(r),{title:'恵那 · 課題A',value:'二段',secondary:'フラッシュ · 1回'});assert.equal(recordSummary({kind:'outdoor',place:'恵那'}).title,'恵那 · 課題名なし');assert.equal(recordSummary({kind:'outdoor'}).value,'NoGrade');});
test('gym lines retain saved grade labels, failed result and color snapshots',()=>{const r={kind:'gym',gymName:'ジム',gradeLabelSnapshot:'青 / 3級',grade:'古い表示',gymOutcome:'failed',sends:0,tries:5,colorSnapshot:'#29b6f6'};assert.equal(recordSummary(r).value,'青 / 3級');assert.match(recordSummary(r).secondary,/敗退/);assert.match(recordLineMarkup(r),/#29b6f6/);});
test('routine lines distinguish equal sets from actual variable results',()=>{assert.equal(routineLabel({sets:3,reps:10}),'10回×3セット');assert.equal(routineLabel({setDetails:[{holdSeconds:60},{holdSeconds:60}]}),'60秒×2セット');assert.equal(routineLabel({setDetails:[{reps:10},{reps:8}]}),'2セット · 合計18回');assert.equal(routineLabel({setDetails:[{holdSeconds:60},{holdSeconds:45}]}),'2セット · 合計105秒');});
test('maximum tests retain side, grip, edge and hold conditions with their load basis',()=>{const s=recordSummary({kind:'training',trainingMode:'maxTest',maxType:'singleHandLift',exerciseName:'片手リフト',addedWeightKg:30,liftHand:'left',gripType:'halfCrimp',edgeDepthMm:20});assert.equal(s.value,'挙上 30kg');assert.match(s.secondary,/ハーフクリンプ · 20mm · 左手/);assert.match(recordSummary({kind:'training',trainingMode:'maxTest',maxType:'hangboard',holdSeconds:7,addedWeightKg:10}).secondary,/7秒/);});
test('search keeps unique record identity on the same day and shows year when needed',()=>{const a={id:'a',kind:'outdoor',date:'2026-10-18',place:'恵那',routeName:'課題A'},b={...a,id:'b',routeName:'課題B'};assert.match(searchRecordMarkup(a,{year:2026,kind:'outdoor'}),/data-search-record="a"/);assert.match(searchRecordMarkup(b,{year:2026,kind:'outdoor'}),/data-search-record="b"/);assert.match(searchRecordMarkup({...a,date:'2025-10-18'},{year:2026}),/>2025-10-18<\/time>/);assert.doesNotMatch(searchRecordMarkup(a,{kind:'outdoor'}),/<span>外岩<\/span>/);assert.match(searchRecordMarkup(a),/<span>外岩<\/span>/);});
test('markup escapes untrusted record fields, identifiers and invalid swatch values',()=>{const r={id:'a" onclick="bad',kind:'gym',gymName:'<img src=x>',grade:'<script>bad</script>',colorSnapshot:'red" onclick="bad',date:'2026-10-18'};for(const html of [searchRecordMarkup(r),recordLineMarkup(r),outdoorStatMarkup(r)]){assert.doesNotMatch(html,/<img|<script| onclick="bad/);assert.match(html,/&lt;/);}assert.match(recordLineMarkup(r),/background:#ff6f00/);});
test('compact rendering does not mutate records or expose memos in lists',()=>{const r={id:'a',kind:'outdoor',date:'2026-10-18',routeName:'とても長い課題名',memo:'private note'},snapshot=JSON.stringify(r);const html=outdoorStatMarkup(r);assert.doesNotMatch(html,/private note/);assert.match(recordAccessibleLabel(r),/とても長い課題名/);assert.equal(JSON.stringify(r),snapshot);});

test('variable loads are shown as a range instead of suggesting every set used the maximum',()=>{assert.equal(recordSummary({kind:'training',setDetails:[{reps:6,loadKg:10},{reps:4,loadKg:12}],loadKg:12}).secondary,'負荷 10〜12kg');assert.equal(recordSummary({kind:'outdoor',result:'attempt',attemptsRange:'6-10'}).secondary,'トライ · 6〜10回');});


test('compact weights exclude unconfirmed values without presenting unknown samples as zero loads',()=>{
 const base={kind:'training',loadMethod:'added',exerciseName:'自重懸垂'};
 const mixed={...base,setDetails:[{reps:5,loadKg:12,loadRecorded:false},{reps:5,loadKg:5,loadRecorded:true}]},before=JSON.stringify(mixed);
 assert.equal(recordSummary(mixed).secondary,'負荷 5kg（未記録あり）');
 assert.equal(recordSummary({...base,setDetails:[{reps:5,loadKg:12,loadRecorded:false}]}).secondary,'重量未記録');
 assert.equal(recordSummary({...base,setDetails:[{reps:5,loadKg:0,loadRecorded:true},{reps:5,loadKg:12,loadRecorded:false}]}).secondary,'重量なし（未記録あり）');
 assert.equal(recordSummary({...base,loadKg:0}).secondary,'重量未記録');
 assert.equal(recordSummary({...base,loadMethod:'bodyweight',loadKg:0}).secondary,'重量なし');
 assert.equal(recordSummary({...base,loadKg:5}).secondary,'負荷 5kg');
 assert.equal(recordSummary({...base,setDetails:[{reps:5,loadKg:10},{reps:5,loadKg:12}]}).secondary,'負荷 10〜12kg');
 assert.equal(JSON.stringify(mixed),before);
});
