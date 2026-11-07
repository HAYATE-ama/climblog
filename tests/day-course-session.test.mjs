import test from 'node:test';import assert from 'node:assert/strict';
import {dayCourses,makeDayCourse} from '../assets/js/day-courses.mjs';
import {normalizeWorkoutPlan,createWorkout,finishWorkoutPhase,confirmCourseResult,stopWorkout,restoreWorkoutDraft,prepareWorkoutSave,workoutPhases,workoutAsMenu,workoutFromMenu,workoutFromCourseReceipt,currentWorkoutPhase,rewindWorkout} from '../assets/js/workout-model.mjs';
import {validateBackup} from '../assets/js/backup-model.mjs';
import {previousCourseResults,courseCompletion} from '../assets/js/day-course-data.mjs';
import {reviseCourseRecord,courseRecordEditPatch} from '../assets/js/day-course-record-editor.mjs';
const before={pain:'unknown',fatigue:'unknown',outdoor:'unknown',availableMinutes:null,acknowledged:true};
const plan=()=>{const p=normalizeWorkoutPlan(makeDayCourse('day-light','short'));p.preparationSeconds=0;return p;};
const start=p=>createWorkout(p,'2026-11-07',0,'course-session',{before});
const confirm=(s,index=0,actual=1)=>confirmCourseResult(s,s.results[index].exerciseId,s.results[index].setIndex,{actual,loadKg:0,observation:{outcome:'failed',route:'sample',section:'A'}});
test('course metadata, step timing and old menu identities survive normalization and backup',()=>{const p=plan();assert.equal(p.course.id,'day-light');assert.equal(p.exercises[0].step.estimatedSeconds,900);const menu={id:'menu-a',...workoutAsMenu(p)};const out=workoutFromMenu(validateBackup({records:[],trainingMenus:[menu]}).trainingMenus[0]);assert.deepEqual(out.course,p.course);assert.deepEqual(out.exercises[0].step,p.exercises[0].step);});
test('unknown before state stays unknown, while missing acknowledgement and sharp pain block start',()=>{assert.equal(start(plan()).courseBefore.availableMinutes,null);assert.throws(()=>createWorkout(plan(),'2026-11-07',0,'bad'),/開始前|痛み/);assert.throws(()=>createWorkout(plan(),'2026-11-07',0,'bad',{before:{...before,pain:'stop'}}),/鋭い痛み/);});
test('finishing a timer or manual step does not copy prescribed actuals; explicit confirmation is required',()=>{let s=finishWorkoutPhase(start(plan()),{now:10000});assert.equal(s.results[0].actual,null);s=stopWorkout(s,10000);assert.throws(()=>prepareWorkoutSave({records:[]},s,10000),/未確定/);s=s.results.reduce((v,r,i)=>confirm(v,i,i===0?1:0),s);const out=prepareWorkoutSave({records:[]},s,10000);assert.equal(out.patch.records.length,1);assert.equal(out.patch.records[0].rpe,null);assert.equal(out.patch.records[0].courseBefore.pain,'unknown');assert.equal(out.patch.workoutReceipts[0].courseSession.plan.course.version,1);});
test('stopping an active timed set allows actual entry and preserves measured versus confirmed seconds',()=>{let s=finishWorkoutPhase(start(plan()),{now:10000});s=stopWorkout(s,40000);assert.equal(s.results.length,2);assert.equal(s.results[1].measuredWorkSeconds,30);s=confirm(confirm(s),1,20);assert.equal(s.results[1].actualWorkSeconds,20);assert.equal(s.results[1].measuredWorkSeconds,30);assert.equal(courseCompletion(s),'stopped');assert.equal(restoreWorkoutDraft(s,40000).results[1].measuredWorkSeconds,30);});
test('outdoor rest is manual even when the default seconds are zero',()=>{const p=normalizeWorkoutPlan(makeDayCourse('day-outdoor'));const phases=workoutPhases(p),rests=phases.filter(p=>p.kind==='rest');assert.equal(rests.length,3);assert.ok(rests.every(r=>r.flexible));});
test('unfinished input survives recovery without becoming confirmed',()=>{let s=finishWorkoutPhase(start(plan()),{now:10000});s.results[0].draft={actual:'1',loadKg:'',observation:{route:'sample'}};const r=restoreWorkoutDraft(s,10000).results[0];assert.equal(r.actual,null);assert.equal(r.confirmed,false);assert.equal(r.draft.actual,'1');});
test('skip remains distinct, rewind removes only unfinished result history',()=>{let s=finishWorkoutPhase(start(plan()),{skip:true,now:1000});assert.equal(s.results[0].status,'skipped');s=rewindWorkout(s,1000);assert.equal(s.results.length,0);assert.equal(s.status,'paused');});
test('same-condition history excludes instantaneous max and another route or edge',()=>{const p=normalizeWorkoutPlan(makeDayCourse('day-power')),e=p.exercises[1];const record={kind:'training',trainingMode:'routine',date:'2026-11-06',catalogExerciseId:e.catalogExerciseId,exerciseSide:e.exerciseSide,loadMethod:e.loadMethod,sessionSetResults:[{mode:e.mode,plannedTarget:1,actual:1,confirmed:true,observation:{route:'A',section:'one'}}]};assert.equal(previousCourseResults([record],e,1).length,0);assert.equal(previousCourseResults([record],e,1,{route:'B',section:'one'}).length,0);assert.equal(previousCourseResults([record],e,1,{route:'A',section:'one'}).length,1);});
test('saved edits preserve historical prescription, zero versus unknown load, and all observation fields',()=>{let s=stopWorkout(finishWorkoutPhase(start(plan()),{now:1000}),1000);s=s.results.reduce((v,r,i)=>confirm(v,i,i===0?1:0),s);const r=prepareWorkoutSave({records:[]},s,1000).patch.records[0],rows=structuredClone(r.sessionSetResults);rows[0].observation.posture='stable';rows[0].loadRecorded=false;const changed=reviseCourseRecord(r,rows,{rpe:'',memo:'edit'});assert.equal(changed.rpe,null);assert.equal(changed.sessionSetResults[0].loadRecorded,false);assert.equal(changed.course.version,1);assert.equal(changed.courseEdited,true);assert.equal(r.memo,'');});

import {coachingReport} from '../assets/js/coaching-report.mjs';
function completeCourse(id,variant='normal'){
 const p=normalizeWorkoutPlan(makeDayCourse(id,variant,{grip:'halfCrimp'}));p.preparationSeconds=0;
 for(const e of p.exercises){for(const set of e.sets)if(e.loadMethod!=='bodyweight'){set.loadKg=e.exerciseSide==='左'?0:10;set.loadRecorded=true;}if(e.step?.kind==='finger')e.fingerConditions.edgeDepthMm=20;}
 let s=start(p),now=0;
 for(let n=0;s.status!=='review';n++){
  assert.ok(n<400);const phase=currentWorkoutPhase(s);now+=(phase.mode==='time'?phase.target:phase.seconds||2)*1000;s=finishWorkoutPhase(s,{now});
 }
 for(const r of s.results)s=confirmCourseResult(s,r.exerciseId,r.setIndex,{actual:r.plannedTarget,loadKg:r.loadKg,observation:{route:'sample',outcome:'success'}});
 return {session:s,state:prepareWorkoutSave({records:[]},s,now).patch,now};
}
for(const c of dayCourses)for(const variant of ['normal','short'])test(c.id+' '+variant+' saves all actuals and a versioned snapshot',()=>{
 const {session,state,now}=completeCourse(c.id,variant),copy=validateBackup(state);assert.ok(copy.records.length);assert.equal(copy.workoutReceipts[0].courseSession.plan.course.id,c.id);assert.equal(copy.workoutReceipts[0].courseSession.completion,variant==='short'?'shortened':'completed');assert.ok(copy.records.every(r=>r.sessionSetResults.every(s=>s.confirmed&&s.actual!=null)));assert.equal(prepareWorkoutSave(state,session,now).alreadySaved,true);
});
test('replaying a completed course retains the entire prescription and never copies readiness or actuals',()=>{
 const {state}=completeCourse('day-finger-strength','short'),receipt=state.workoutReceipts[0];let n=0;const p=workoutFromCourseReceipt(receipt,()=> 'replay-'+(++n));assert.deepEqual(p.course,receipt.courseSession.plan.course);assert.ok(p.exercises.every(e=>e.id.startsWith('replay-')));assert.equal(p.exercises[1].transitionRestSeconds,90);assert.throws(()=>createWorkout(p,'2026-11-07',0,'new-session'));assert.equal(createWorkout(p,'2026-11-07',0,'new-session',{before}).results.length,0);assert.throws(()=>workoutFromCourseReceipt({}));
});
test('actual edit updates session completion consistently, without rewriting the prescription',()=>{
 const {state}=completeCourse('day-light'),record=state.records.find(r=>r.coursePrescription.mode==='time'),rows=structuredClone(record.sessionSetResults);rows[0].actual=60;const next=reviseCourseRecord(record,rows,{rpe:null,memo:''}),patch=courseRecordEditPatch(state,record,next);assert.equal(next.courseCompletion,'shortened');assert.ok(patch.records.every(r=>r.courseCompletion==='shortened'));assert.equal(patch.workoutReceipts[0].courseSession.completion,'shortened');assert.deepEqual(patch.workoutReceipts[0].courseSession.plan,state.workoutReceipts[0].courseSession.plan);assert.ok(patch.recordHistory.length);validateBackup(patch);
});
test('malformed saved course snapshot is rejected before restore',()=>{
 const {state}=completeCourse('day-light');state.workoutReceipts[0].courseSession.plan.course=null;assert.throws(()=>validateBackup(state),/構成・版/);
});
test('explicit zero load remains zero in the shared report; missing actual weight remains null',()=>{
 const {state}=completeCourse('day-finger-strength','short'),record=state.records.find(r=>r.coursePrescription.step.kind==='finger'),report=coachingReport(state,{from:'',to:'2026-11-07'}).payload.records.find(r=>r.catalogExerciseId===record.catalogExerciseId&&r.exerciseSide==='左');assert.equal(report.loadRecorded,true);assert.equal(report.loadKg,0);
 const rows=structuredClone(record.sessionSetResults);rows[0].loadRecorded=false;const changed=reviseCourseRecord(record,rows,{rpe:null,memo:''});const missing=coachingReport({records:[changed]},{from:'',to:'2026-11-07'}).payload.records[0];assert.equal(missing.loadRecorded,false);assert.equal(missing.loadKg,null);
});
test('course report gates body, free text and locations independently and never exports video references',()=>{
 const {state}=completeCourse('day-long-route','short'),r=state.records[1];r.courseAfter={pain:'mild',fatigue:'strong',painArea:'private pain',quality:'mixed'};r.sessionSetResults[0].observation={route:'private route',posture:'private posture',video:'private video',outcome:'failed',moves:12};const plain=coachingReport(state,{from:'',to:'2026-11-07'}).payload;
 assert.doesNotMatch(JSON.stringify(plain),/private|courseAfter|courseBefore/);const shared=coachingReport(state,{from:'',to:'2026-11-07',body:true,notes:true,locations:true}).payload;assert.match(JSON.stringify(shared),/private pain|private route|private posture/);assert.doesNotMatch(JSON.stringify(shared),/private video/);assert.equal(shared.records[1].sessionSetResults[0].observation.outcome,'failed');
});

import {prepareRecordCommit} from '../assets/js/history-model.mjs';
import {courseResultEditor} from '../assets/js/day-course-view.mjs';
test('incompatible generic edits detach course metadata while preserving original history',()=>{
 const {state}=completeCourse('day-light'),record=state.records[0],changed=prepareRecordCommit(state.records,[{kind:'gym',gymName:'sample',grade:'sample',sends:1,tries:1}],{editingId:record.id});const next=changed.records.find(r=>r.id===record.id);assert.equal(next.course,undefined);assert.equal(next.coursePrescription,undefined);assert.ok(changed.recordHistory[0].before.course);validateBackup(changed);
});
test('restored actual input drafts are escaped in the result editor',()=>{
 const {session}=completeCourse('day-light'),r=structuredClone(session.results[0]);r.draft={actual:'" autofocus onfocus="x',loadKg:'"'};const html=courseResultEditor(session.plan.exercises[0],r);assert.ok(html.includes('&quot; autofocus onfocus=&quot;x'));assert.ok(!html.includes('value="" autofocus'));
});
