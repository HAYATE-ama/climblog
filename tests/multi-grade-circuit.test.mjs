import test from 'node:test';
import assert from 'node:assert/strict';
import {createCircuit,addCircuitRoutes,recordCircuitTry,circuitRecords,circuitStats,circuitGrades,circuitRouteLabel,circuitGradeLabel,parseCircuitDraft,setCircuitTotal,enableCircuitTiming,startCircuitTry,finishCircuit,prepareCircuitSave,circuitHistory,circuitSetKey,repeatCircuit,undoCircuitTry,circuitClock} from '../assets/js/grade-circuit.mjs';
import {validateBackup,mergeBackup} from '../assets/js/backup-model.mjs';
const make=(grades=[{grade:'4級',swatch:'#00aa00',total:2,numbered:true},{grade:'3級',swatch:'#ff6600',total:2,numbered:true}])=>createCircuit({date:'2026-11-23',gym:'サンプルジム',grades});

test('同じ番号をグレード別に区別し、各課題のグレードと色を通常記録へ保存する',()=>{
 const s=make();assert.equal(s.version,3);assert.equal(s.total,4);assert.equal(s.routes.length,4);
 assert.equal(addCircuitRoutes(s,'number',['1'],'',s.grades[0].id).added,0);
 recordCircuitTry(s,0,true);recordCircuitTry(s,0,true);recordCircuitTry(s,2,false);
 assert.deepEqual(circuitStats(s),{completed:1,sends:2,tries:3,falls:1});assert.equal(circuitStats(s,s.grades[1].id).completed,0);
 const rows=circuitRecords(s);assert.deepEqual(rows.map(r=>[r.grade,r.swatch,r.memo,r.sends,r.tries,r.circuitTotal]),[['4級','#00aa00','1番',2,2,2],['3級','#ff6600','1番',0,1,2]]);
 assert.notEqual(rows[0].id,rows[1].id);assert.equal(circuitRouteLabel(s,s.routes[2]),'3級 · 1番');assert.equal(circuitGradeLabel(s),'4級・3級');assert.deepEqual(parseCircuitDraft(JSON.stringify(s)),s);
});

test('テープ形状・壁が同じでもグレード別に追加。未知のグレードや総数超過を拒否する',()=>{
 const s=make([{grade:'4級',total:1},{grade:'3級',total:null}]);
 addCircuitRoutes(s,'tape',['＋'],'ルーフ左',s.grades[0].id);addCircuitRoutes(s,'tape',['+'],'ルーフ左',s.grades[1].id);
 assert.equal(s.routes.length,2);assert.equal(addCircuitRoutes(s,'tape',['＋'],'ルーフ左',s.grades[1].id).added,0);
 const before=JSON.stringify(s);assert.throws(()=>addCircuitRoutes(s,'tape',['×'],'',s.grades[0].id));assert.throws(()=>addCircuitRoutes(s,'number',['1'],''));assert.equal(JSON.stringify(s),before);
 assert.equal(s.total,null);setCircuitTotal(s,1,s.grades[1].id);assert.equal(s.total,2);
 assert.throws(()=>make([{grade:'4級',total:200},{grade:'3級',total:101}]));assert.throws(()=>make([{grade:'4級',total:1},{grade:'４級',total:1}]));
 const full=make([{grade:'4級',total:300},{grade:'3級',total:null}]);assert.throws(()=>addCircuitRoutes(full,'number',['1'],'',full.grades[1].id));assert.equal(full.routes.length,0);
});

test('グレードをまたいでも計測を継続し、全グレード完登時だけ到達点を記録する',()=>{
 const s=make([{grade:'4級',total:1,numbered:true},{grade:'3級',total:1,numbered:true}]);enableCircuitTiming(s);
 startCircuitTry(s,0,1000);recordCircuitTry(s,0,true,11000);assert.equal(s.timing.milestones.length,0);
 startCircuitTry(s,1,31000);recordCircuitTry(s,1,true,51000);assert.deepEqual(s.timing.milestones,[{round:1,climbMs:30000,restMs:20000}]);
 const reopened=parseCircuitDraft(JSON.stringify(s));assert.equal(circuitClock(reopened,61000).restMs,30000);undoCircuitTry(reopened,61000);assert.equal(reopened.routes[1].sends,0);assert.equal(reopened.routes[0].sends,1);assert.equal(reopened.timing.milestones.length,0);
 setCircuitTotal(s,2,s.grades[1].id);assert.equal(s.total,3);assert.equal(s.timing.milestones.length,0);assert.equal(s.timing.incomplete,true);
});

test('複数グレードの保存・バックアップ・復元・同じセットで再開と旧版互換',()=>{
 const s=make();enableCircuitTiming(s,'11月');for(let i=0;i<4;i++){startCircuitTry(s,i,1000+i*20000);recordCircuitTry(s,i,true,11000+i*20000);}finishCircuit(s,81000);
 const patch=prepareCircuitSave({records:[]},s,81000).patch,restored=mergeBackup({records:[]},validateBackup(patch)).patch;
 assert.equal(circuitHistory(restored)[0].comparable,true);assert.equal(prepareCircuitSave(restored,s).alreadySaved,true);
 const repeat=repeatCircuit(s,'2026-11-24');assert.deepEqual(repeat.grades,s.grades);assert.equal(circuitSetKey(repeat),circuitSetKey(s));assert.equal(circuitStats(repeat).tries,0);
 const different=structuredClone(repeat);different.grades[0].grade='5級';assert.notEqual(circuitSetKey(different),circuitSetKey(s));restored.records[1].grade='変更';assert.equal(circuitHistory(restored)[0].changed,true);
 const old=createCircuit({date:s.date,gym:s.gym,grade:'以前の3級',total:1,numbered:true});recordCircuitTry(old,0,true);const restoredOld=parseCircuitDraft(JSON.stringify(old));assert.equal(restoredOld.version,2);assert.equal(circuitGrades(restoredOld)[0].grade,'以前の3級');assert.deepEqual(circuitRecords(restoredOld),circuitRecords(old));
});

test('不正な所属・重複・合計不一致をバックアップと途中再開で拒否する',()=>{
 const original=make();
 for(const mutate of [s=>s.routes[0].gradeId='unknown',s=>delete s.routes[0].gradeId,s=>s.grades[1].id=s.grades[0].id,s=>s.grades[1].grade=s.grades[0].grade,s=>s.total=3,s=>s.routes.push({...s.routes[0]}),s=>s.grades[0].total=1]){
  const s=structuredClone(original);mutate(s);assert.throws(()=>parseCircuitDraft(JSON.stringify(s)));
 }
 const snapshot=JSON.stringify(original);assert.throws(()=>setCircuitTotal(original,1,original.grades[0].id));assert.equal(JSON.stringify(original),snapshot);
});
