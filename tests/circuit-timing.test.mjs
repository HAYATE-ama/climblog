import test from 'node:test';
import assert from 'node:assert/strict';
import {createCircuit,enableCircuitTiming,startCircuitTry,recordCircuitTry,pauseCircuit,undoCircuitTry,circuitClock,finishCircuit,resumeCircuit,parseCircuitDraft,prepareCircuitSave,circuitHistory,circuitComparable,circuitSetKey,repeatCircuit,changeCircuitSet,circuitTime} from '../assets/js/grade-circuit.mjs';
import {validateBackup,mergeBackup} from '../assets/js/backup-model.mjs';
const make=()=>{const s=createCircuit({date:'2026-11-20',gym:'サンプル',grade:'3級',total:2,numbered:true});enableCircuitTiming(s,'11月セット');return s};
const complete=()=>{const s=make();startCircuitTry(s,0,1000);recordCircuitTry(s,0,false,11000);startCircuitTry(s,0,21000);recordCircuitTry(s,0,true,31000);startCircuitTry(s,1,51000);recordCircuitTry(s,1,true,71000);return s};
test('登攀・レストを別々に計測し、失敗も登攀に含み、全課題初回の時刻を固定する',()=>{
 const s=complete();assert.deepEqual(s.timing.milestones,[{round:1,climbMs:40000,restMs:30000}]);assert.equal(circuitClock(s,101000).restMs,60000);assert.equal(circuitClock(s,101000).climbMs,40000);
 startCircuitTry(s,0,101000);recordCircuitTry(s,0,true,111000);startCircuitTry(s,1,121000);recordCircuitTry(s,1,true,131000);
 assert.deepEqual(s.timing.milestones[0],{round:1,climbMs:40000,restMs:30000});assert.deepEqual(s.timing.milestones[1],{round:2,climbMs:60000,restMs:70000});assert(circuitComparable(s));
});
test('開始前は0、結果の先押し・別課題・二重開始・二重結果を拒否',()=>{
 const s=make();assert.equal(circuitClock(s,50000).totalMs,0);assert.throws(()=>recordCircuitTry(s,0,true,1000));startCircuitTry(s,0,1000);assert.throws(()=>startCircuitTry(s,1,2000));assert.throws(()=>recordCircuitTry(s,1,true,2000));recordCircuitTry(s,0,true,3000);assert.throws(()=>recordCircuitTry(s,0,true,4000));assert.equal(s.routes[0].sends,1);
});
test('一時停止の時間を別管理し、再開後も登攀・レストへ混入させない',()=>{
 const s=make();startCircuitTry(s,0,1000);pauseCircuit(s,11000);assert.equal(circuitClock(s,41000).climbMs,10000);assert.equal(circuitClock(s,41000).pausedMs,30000);assert.throws(()=>recordCircuitTry(s,0,true,41000));pauseCircuit(s,41000);recordCircuitTry(s,0,true,51000);assert.equal(s.timing.climbMs,20000);assert.equal(s.timing.pausedMs,30000);assert.equal(circuitComparable(s),false);
});
test('再読込・背景からの復帰で保存された開始時刻との差を回収する',()=>{
 let s=make();startCircuitTry(s,0,1000);s=parseCircuitDraft(JSON.stringify(s));assert.equal(circuitClock(s,61000).climbMs,60000);recordCircuitTry(s,0,true,61000);s=parseCircuitDraft(JSON.stringify(s));assert.equal(circuitClock(s,81000).restMs,20000);
});
test('取り消しで完登時刻も戻し、レストに誤分類した時間をトライへ戻す',()=>{
 const s=complete();undoCircuitTry(s,81000);assert.equal(s.routes[1].sends,0);assert.equal(s.timing.phase,'climb');assert.equal(s.timing.milestones.length,0);assert.equal(s.timing.climbMs,50000);assert.equal(s.timing.restMs,30000);recordCircuitTry(s,1,true,91000);assert.equal(s.timing.milestones[0].climbMs,60000);
});
test('途中終了と未確定のトライを全課題完登にしない。終了後は停止',()=>{
 const s=make();startCircuitTry(s,0,1000);recordCircuitTry(s,0,true,11000);startCircuitTry(s,1,21000);finishCircuit(s,31000);assert.equal(s.routes[1].tries,0);assert.equal(s.timing.incomplete,true);assert.equal(circuitClock(s,61000).totalMs,30000);resumeCircuit(s,61000);assert.equal(s.timing.pausedMs,30000);recordCircuitTry(s,1,true,71000);assert.equal(circuitComparable(s),false);
});
test('備考・時刻・セットを原子保存し、二重保存を防ぎ、バックアップで復元',()=>{
 const s=complete();s.memo='全体\nメモ';s.routes[0].note='課題のメモ';finishCircuit(s,81000);const saved=prepareCircuitSave({records:[],workoutReceipts:[]},s,81000).patch;
 assert.equal(saved.records[0].memo,'1番\n課題のメモ');assert.equal(saved.workoutReceipts[0].circuitSession.memo,s.memo);const valid=validateBackup(saved),restored=mergeBackup({records:[]},valid).patch;assert.equal(circuitHistory(restored)[0].comparable,true);assert.equal(prepareCircuitSave(restored,s,91000).alreadySaved,true);assert.throws(()=>prepareCircuitSave({records:saved.records},s,91000));
});
test('課題セットのコピーはIDだけ引き継ぎ、回数・時間・備考を持ち越さない',()=>{
 const a=complete();a.memo='前回';a.routes[0].note='前回の課題メモ';const b=repeatCircuit(a,'2026-11-21');assert.equal(circuitSetKey(a),circuitSetKey(b));assert.notEqual(a.id,b.id);assert.equal(b.routes[0].tries,0);assert.equal(b.routes[0].note,'');assert.equal(b.memo,'');assert.equal(b.timing.milestones.length,0);assert.equal(b.timing.phase,'ready');changeCircuitSet(b);assert.notEqual(circuitSetKey(a),circuitSetKey(b));
});
test('旧記録に時間を捏造しない。途中からの計測は比較対象にしない',()=>{
 const s=createCircuit({date:'2026-11-20',gym:'サンプル',grade:'3級',total:2,numbered:true});recordCircuitTry(s,0,true);assert.equal(parseCircuitDraft(JSON.stringify(s)).timing,undefined);enableCircuitTiming(s);startCircuitTry(s,1,1000);recordCircuitTry(s,1,true,2000);assert.equal(circuitComparable(s),false);
});
test('元記録の編集・削除は履歴比較から除外し、全削除した履歴は表示しない',()=>{
 const s=complete();finishCircuit(s,71000);const state=prepareCircuitSave({records:[]},s,71000).patch;assert(circuitHistory(state)[0].comparable);state.records[0].tries++;assert.equal(circuitHistory(state)[0].changed,true);state.records.pop();assert.equal(circuitHistory(state)[0].comparable,false);state.records=[];assert.equal(circuitHistory(state).length,0);
});
test('時計の逆行・長時間放置・壊れた計測データを比較へ混ぜない',()=>{
 const s=complete();assert(circuitClock(s,1000).clockIssue);finishCircuit(s,172800000);assert.equal(circuitComparable(s),false);for(const value of [-1,NaN,'1000']){const broken=structuredClone(s);broken.timing.climbMs=value;assert.throws(()=>parseCircuitDraft(JSON.stringify(broken)));}const broken=structuredClone(s);broken.timing.milestones[0].restMs=999999999;assert.throws(()=>parseCircuitDraft(JSON.stringify(broken)));assert.equal(circuitTime(3661000),'1:01:01');
});
