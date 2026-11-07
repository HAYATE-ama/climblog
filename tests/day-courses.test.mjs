import test from 'node:test';
import assert from 'node:assert/strict';
import {dayCourses,makeDayCourse,supersededCourseIds} from '../assets/js/day-courses.mjs';
import {getExerciseDefinition,resolveExercise} from '../assets/js/exercise-registry.mjs';
import {normalizeWorkoutPlan,workoutPhases,workoutAsMenu,workoutFromMenu} from '../assets/js/workout-model.mjs';
import {climbingCourses,makeClimbingCourse} from '../assets/js/climbing-courses.mjs';
const plan=(id,variant='normal',grip='open')=>{let n=0;return makeDayCourse(id,variant,{grip,createId:()=> 'day-'+(++n)});};
test('eight complete courses and one daily course have stable versions, independent variants and no fixed schedule',()=>{
 assert.equal(dayCourses.length,9);assert.equal(dayCourses.filter(c=>!c.daily).length,8);
 assert.equal(new Set(dayCourses.map(c=>c.id)).size,9);
 for(const course of dayCourses){assert.equal(course.version,1);assert.ok(course.purpose&&course.intensity&&course.stop);assert.ok(course.equipment.length);assert.ok(Object.isFrozen(course));assert.ok(!Object.hasOwn(course,'schedule'));assert.ok(!Object.hasOwn(course,'period'));for(const variant of ['normal','short']){const p=plan(course.id,variant);assert.equal(p.course.variant,variant);assert.equal(p.course.id,course.id);assert.ok(p.exercises.length<=30);assert.equal(new Set(p.exercises.map(e=>e.id)).size,p.exercises.length);assert.doesNotThrow(()=>normalizeWorkoutPlan(p));for(const e of p.exercises){const def=resolveExercise(e.name)?.definition;assert.ok(def?.guide,e.name);assert.equal(e.catalogExerciseId,def.exerciseId);assert.equal(e.mode,def.defaultMode);assert.ok(e.step.instruction);}}}
 const p=plan('day-power');p.exercises[0].sets[0].target=50;assert.equal(plan('day-power').exercises[0].sets[0].target,1);
});
test('short courses preserve the same warmup prescription and trial rest while reducing main volume',()=>{
 for(const c of dayCourses.filter(c=>!c.daily)){const normal=plan(c.id),short=plan(c.id,'short');const warms=p=>p.exercises.filter(e=>e.step.phase==='warmup').map(e=>({name:e.name,sets:e.sets,step:e.step}));assert.deepEqual(warms(short),warms(normal),c.id);for(const e of short.exercises.filter(e=>e.step.phase==='main')){const same=normal.exercises.find(n=>n.catalogExerciseId===e.catalogExerciseId&&n.step.slot===e.step.slot);assert.ok(same,c.id);assert.equal(e.sets[0].restSeconds,same.sets[0].restSeconds,c.id);}}
});
test('finger course alternates sides, preserves about three minutes between same-hand sets and starts without weight or edge',()=>{
 assert.throws(()=>makeDayCourse('day-finger-strength'),/握り/);
 for(const grip of ['open','halfCrimp'])for(const variant of ['normal','short']){const p=plan('day-finger-strength',variant,grip),rows=p.exercises.filter(e=>e.step.kind==='finger');assert.equal(rows.length,variant==='normal'?6:4);assert.deepEqual(rows.map(e=>e.exerciseSide),Array.from({length:rows.length},(_,i)=>i%2?'右':'左'));let time=0;const ends={};for(const [index,e] of rows.entries()){if(ends[e.exerciseSide]!==undefined)assert.ok(time-ends[e.exerciseSide]>=180);assert.equal(e.sets[0].target,3);assert.equal(e.sets[0].loadRecorded,false);assert.equal(e.fingerConditions.edgeDepthMm,null);assert.equal(e.fingerConditions.gripType,grip);time+=3;ends[e.exerciseSide]=time;time+=e.transitionRestSeconds;}assert.equal(p.course.version,1);}
});
test('main trial counts include unsuccessful attempts, and repeating tasks alternate A and B',()=>{
 const counts=[['day-power',6,4],['day-crux-link',4,3],['day-long-route',3,2],['day-repeat-quality',6,4],['day-roof-technique',6,3],['day-outdoor',3,2]];
 for(const [id,normal,short] of counts){for(const [variant,expected] of [['normal',normal],['short',short]]){const p=plan(id,variant);const main=p.exercises.filter(e=>e.step.attempted&&!e.step.optional&&!['dayTechniqueAttempt'].includes(e.catalogExerciseId));assert.equal(main.reduce((n,e)=>n+e.sets.length,0),expected,id);assert.ok(main.every(e=>e.sets.every(s=>s.target===1)));}}
 assert.deepEqual(plan('day-repeat-quality').exercises.filter(e=>e.step.attempted).map(e=>e.step.slot),['課題A','課題B','課題A','課題B','課題A','課題B']);
});
test('unilateral light support preserves repetitions, rest and distinct identity from the old bilateral exercise',()=>{
 const p=plan('day-finger-strength'),rows=p.exercises.filter(e=>e.step.kind==='support');assert.equal(rows.length,6);assert.deepEqual(rows.map(e=>e.sets[0].target),[12,12,12,12,10,10]);assert.ok(rows.every(e=>e.transitionRestSeconds>=45&&e.transitionRestSeconds<=60));assert.equal(getExerciseDefinition('bandExternalRotation').sidedness,'both');assert.equal(getExerciseDefinition('singleArmBandExternalRotation').sidedness,'separateSides');for(const e of rows.filter(e=>['wristExtension','forearmRotation'].includes(e.catalogExerciseId)))assert.equal(e.sets[0].loadRecorded,false);assert.equal(plan('day-finger-strength','short').exercises.filter(e=>e.step.kind==='support').length,0);
});
test('daily course and embedded hip practice use active movements and preserve per-repetition hold guidance',()=>{
 const daily=plan('daily-active-hips');assert.deepEqual(daily.exercises.map(e=>e.sets[0].target),[6,6,5,5,5,5,5,5]);assert.ok(daily.exercises.every(e=>e.step.dailyMobility));assert.match(getExerciseDefinition('supportedKneeHold').guide.count,/3秒/);
 const embedded=plan('day-power').exercises.filter(e=>e.step.dailyMobility);assert.deepEqual(embedded.map(e=>e.catalogExerciseId),['supportedKneeHold','supportedKneeHold','lowStepShift','lowStepShift']);assert.ok(embedded.every(e=>/実施済み/.test(e.step.instruction)));
});
test('outdoor courses require user-directed recovery and do not enforce a countdown between attempts',()=>{
 for(const variant of ['normal','short']){const p=plan('day-outdoor',variant);const e=p.exercises.find(e=>e.catalogExerciseId==='dayOutdoorAttempt');assert.equal(e.step.restFlexible,true);assert.ok(e.sets.every(s=>s.restSeconds===0));assert.equal(e.transitionRestSeconds,0);assert.match(p.course.intensity,/強制しません/);}
});
test('legacy course definitions and menus remain available without merging their record identities',()=>{
 for(const id of supersededCourseIds){assert.ok(climbingCourses.some(c=>c.id===id));assert.doesNotThrow(()=>workoutFromMenu(workoutAsMenu(makeClimbingCourse(id))));assert.ok(!dayCourses.some(c=>c.id===id));}
 assert.throws(()=>makeDayCourse('unknown'));assert.throws(()=>makeDayCourse('day-power','invented'));assert.throws(()=>makeDayCourse('day-finger-strength','normal',{grip:'fullCrimp'}));
});
