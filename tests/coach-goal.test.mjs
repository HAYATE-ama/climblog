import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGoalSettings,normalizeProgram,goalDraftMetadata,programAccepted,requiredProgress} from '../assets/js/coach-goal.mjs';
import {normalizeAiSettings,restoreCoachForm,buildAiInput,validateDailyDraft,dailyDraftToPlan} from '../assets/js/ai-coach-contract.mjs';
import {createWorkout,finishWorkoutPhase,prepareWorkoutSave} from '../assets/js/workout-model.mjs';
const day='2026-10-30',goal='足使いを改善して初段を安定して登る';
const program={goal,outline:'易しい課題で足置きを練習する',weeklySchedule:'登る日と休養日を分け、必要に応じて補強する',review:'足の置き直しと疲労を振り返る'};
const settings=(extra={})=>normalizeAiSettings({planningMode:'goal',goal,goalContext:'自宅とジムで練習',dayPlan:true,pain:'none',fatigue:'normal',...extra});
const planDraft=()=>({schemaVersion:1,decision:'train',title:'今日の基本メニュー',reason:'目標に必要な内容',warnings:[],preparationSeconds:0,transitionRestSeconds:0,program,questions:[],items:[{itemId:'warm',exerciseId:'wristCircles',phase:'warmup',side:null,mode:'time',durationSeconds:10,sets:[{target:10,restSeconds:0,loadKg:0}]},{itemId:'main',exerciseId:'frontPlank',phase:'main',side:null,mode:'time',durationSeconds:10,sets:[{target:10,restSeconds:0,loadKg:0}]},{itemId:'cool',exerciseId:'wristFlexorStretch',phase:'cooldown',side:'left',mode:'time',durationSeconds:10,sets:[{target:10,restSeconds:0,loadKg:0}]}]});
const proposal=()=>({proposalId:'00000000-0000-4000-8000-000000000001',planDate:day,generatedAt:day+'T00:00:00Z',model:'mock-only',settings:settings(),draft:validateDailyDraft(planDraft(),settings())});
function completedRecords(p){let s=createWorkout(dailyDraftToPlan(p.draft,p.settings,p),day,0,'goal-session');s=finishWorkoutPhase(s,{now:10000});s=finishWorkoutPhase(s,{now:20000});s=finishWorkoutPhase(s,{now:30000});return prepareWorkoutSave({records:[]},s,30001).patch.records;}

test('legacy planning remains a 30 minute contract, while goal planning hides time behind a 90 minute ceiling',()=>{
 assert.deepEqual(normalizeGoalSettings({goal:'ignored'}),{});const legacy=normalizeAiSettings({});assert.equal(legacy.availableMinutes,30);assert.equal(legacy.planningMode,undefined);
 const s=settings({availableMinutes:''});assert.equal(s.availableMinutes,90);assert.equal(restoreCoachForm(s).goal,goal);assert.equal(restoreCoachForm(s).availableMinutes,90);
 assert.throws(()=>settings({goal:'x'.repeat(501)}));assert.throws(()=>settings({goalContext:'bad\0'}));assert.throws(()=>buildAiInput({},settings({goal:''}),day));
});

test('free mode transmits only the explicitly entered goal and approved policy, without reading stored personal state',()=>{
 const state=new Proxy({},{get(){throw new Error('Private state read');}});const input=buildAiInput(state,settings({activeProgram:program,share:{history:true,body:true,goal:true,condition:true}}),day,'free');
 assert.equal(input.goal,goal);assert.equal(input.goalContext,'自宅とジムで練習');assert.deepEqual(input.activeProgram,program);for(const key of ['history','body','condition'])assert.equal(input[key],undefined);
});

test('changing the goal invalidates an old approval and policy fields remain bounded and nonempty',()=>{
 assert.deepEqual(normalizeProgram(program),program);assert.throws(()=>normalizeProgram({...program,review:''}));assert.throws(()=>normalizeProgram({...program,outline:'x'.repeat(501)}));
 assert.deepEqual(settings({activeProgram:program}).activeProgram,program);assert.equal(settings({goal:'別の目標',activeProgram:program}).activeProgram,null);
});

test('goal clarification is bounded, contains no workout, and a training decision requires a matching policy',()=>{
 const clarify={...planDraft(),decision:'clarify',items:[],program:null,questions:['現在登れるグレードは？','週何日登れますか？']};assert.equal(validateDailyDraft(clarify,settings()).decision,'clarify');assert.throws(()=>dailyDraftToPlan(clarify,settings()));
 assert.throws(()=>validateDailyDraft({...clarify,questions:[]},settings()));assert.throws(()=>validateDailyDraft({...clarify,questions:['1','2','3','4']},settings()));assert.throws(()=>validateDailyDraft({...clarify,items:planDraft().items},settings()));
 assert.throws(()=>validateDailyDraft({...planDraft(),program:null},settings()));assert.throws(()=>validateDailyDraft({...planDraft(),program:{...program,goal:'別の目標'}},settings()));
 assert.doesNotThrow(()=>validateDailyDraft({...planDraft(),program:null},settings({activeProgram:program})));assert.throws(()=>validateDailyDraft(clarify,normalizeAiSettings({})));
});

test('only acceptance of the exact proposal policy permits a goal course; legacy proposals remain usable',()=>{
 const p=proposal();assert.equal(programAccepted(p,settings()),false);assert.equal(programAccepted(p,settings({activeProgram:program})),true);assert.equal(programAccepted(p,settings({activeProgram:{...program,review:'別の見直し'}})),false);assert.equal(programAccepted(p,settings({goal:'変更後の目標',activeProgram:program})),false);assert.equal(programAccepted({settings:normalizeAiSettings({})},normalizeAiSettings({})),true);
});

test('required course progress separates no activity, partial, modified, skipped and a fully completed single session',()=>{
 const p=proposal(),rows=completedRecords(p);assert.equal(requiredProgress(p,[]),'未実施');assert.equal(requiredProgress(p,rows.slice(0,2)),'一部実施・内容調整あり');assert.equal(requiredProgress(p,rows),'本日の計画完了');
 assert.equal(requiredProgress(p,rows.map(r=>({...r,aiPlanModified:true}))),'一部実施・内容調整あり');const skipped=structuredClone(rows);skipped[1].sessionSetResults[0].status='skipped';assert.equal(requiredProgress(p,skipped),'一部実施・内容調整あり');
 assert.equal(requiredProgress(p,rows.map(r=>({...r,date:'2026-10-29'}))),'未実施');assert.equal(requiredProgress(p,rows.map(r=>({...r,aiProposalId:'another'}))),'未実施');
 const mixed=rows.map((r,i)=>({...r,workoutSessionId:i===0?'session-a':'session-b'}));assert.equal(requiredProgress(p,mixed),'一部実施・内容調整あり');assert.equal(requiredProgress({...p,settings:normalizeAiSettings({})},rows),'');
});

test('an explicitly entered paid-mode goal is not overwritten by a separately shared stored goal',()=>{
 const s=settings({mode:'paid',share:{goal:true}}),input=buildAiInput({goals:{focus:'以前の保存目標'}},s,day,'paid');assert.equal(input.goal,goal);
});

test('correcting saved actuals cannot leave an old complete session snapshot reporting completion',()=>{
 const p=proposal(),rows=completedRecords(p);rows[1].setDetails[0].holdSeconds=5;assert.equal(requiredProgress(p,rows),'一部実施・内容調整あり');
});
