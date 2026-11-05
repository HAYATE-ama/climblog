import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkout,finishWorkoutPhase,reviseWorkoutResult,prepareWorkoutSave} from '../assets/js/workout-model.mjs';
const state={records:[],workoutReceipts:[],bodyWeights:[]};
function session(mode='time'){
 const plan={title:'Synthetic session',place:'test',preparationSeconds:0,transitionRestSeconds:0,exercises:[{id:'e',name:mode==='time'?'プランク':'自重懸垂',mode,loadMethod:'bodyweight',sets:[{target:mode==='time'?60:10,loadKg:0,restSeconds:30},{target:mode==='time'?60:10,loadKg:0,restSeconds:0}]}]};
 let s=createWorkout(plan,'2026-11-06',0,'session');s=finishWorkoutPhase(s,{now:60000});s=finishWorkoutPhase(s,{now:90000});s=finishWorkoutPhase(s,{now:150000});return s;
}
test('edited time-based actual changes work duration while keeping measured rest',()=>{const original=session();for(const actual of [20,90]){const s=reviseWorkoutResult(original,'e',0,actual,0),r=prepareWorkoutSave(state,s,150000).patch.records[0];assert.equal(s.results[0].actualWorkSeconds,actual);assert.equal(s.results[0].actualRestSeconds,30);assert.equal(r.setDetails[0].holdSeconds,actual);assert.equal(r.sessionSetResults[0].actualWorkSeconds,actual);assert.equal(r.durationMinutes,Number(((actual+30+60)/60).toFixed(2)));}assert.equal(original.results[0].actual,60);assert.equal(original.results[0].actualWorkSeconds,60);});
test('zeroed timed sets remain omitted and do not carry their work/rest into saved volume',()=>{let s=reviseWorkoutResult(session(),'e',0,0,0);const r=prepareWorkoutSave(state,s,150000).patch.records[0];assert.equal(r.setDetails.length,1);assert.equal(r.durationMinutes,1);assert.equal(r.sessionSetResults.length,1);s=reviseWorkoutResult(s,'e',1,0,0);assert.throws(()=>prepareWorkoutSave(state,s,150000),/実施済み/);});
test('editing repetition count does not reinterpret elapsed work seconds',()=>{const s=reviseWorkoutResult(session('reps'),'e',0,5,0),r=prepareWorkoutSave(state,s,150000).patch.records[0];assert.equal(s.results[0].actualWorkSeconds,60);assert.equal(s.results[0].actualRestSeconds,30);assert.equal(r.setDetails[0].reps,5);assert.equal(r.durationMinutes,2.5);});
