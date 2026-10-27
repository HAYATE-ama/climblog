import {normalizeFingerConditions,isRecordedLoad,loadRecordedMetadata,firstMissingWorkoutLoad} from './training-conditions.mjs';
import {resolveExercise,exerciseIdentity} from './exercise-registry.mjs';
import {trainingExerciseNames} from './exercise-catalog.mjs';
import {clone} from './data-utils.mjs';
import {applySetDetails} from './training-model.mjs';
import {getBodyWeightForDate} from './features.mjs';
export const workoutExerciseNames=trainingExerciseNames;
const uid=()=>crypto.randomUUID();
const number=(value,min,max,label,integer=false)=>{const n=Number(value);if(value==null||value===''||!Number.isFinite(n)||n<min||n>max||integer&&!Number.isInteger(n))throw new Error(label+'を確認してください。');return n;};
const identifier=v=>typeof v==='string'&&/^[a-z0-9_-]{1,64}$/i.test(v);
export function validWorkoutDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;}
export function normalizeWorkoutPlan(input){
 if(!input||typeof input.title!=='string'||!input.title.trim()||input.title.length>100||!Array.isArray(input.exercises)||!input.exercises.length||input.exercises.length>30)throw new Error('メニュー名と種目を確認してください。');
 const preparationSeconds=number(input.preparationSeconds??0,0,10,'開始前カウントダウン',true);if(![0,3,5,10].includes(preparationSeconds))throw new Error('開始前カウントダウンは、なし・3秒・5秒・10秒から選択してください。');
 const ids=new Set();let total=0;
 const exercises=input.exercises.map(e=>{if(!identifier(e.id)||ids.has(e.id)||typeof e.name!=='string'||!e.name.trim()||e.name.length>100||!['time','reps'].includes(e.mode)||!Array.isArray(e.sets)||!e.sets.length||e.sets.length>100)throw new Error('種目・セットの設定が不正です。');ids.add(e.id);total+=e.sets.length;
 return {id:e.id,name:e.name.trim(),...exerciseIdentity(e.name),mode:e.mode,...(e.fingerConditions?{fingerConditions:normalizeFingerConditions(e.fingerConditions,e.name)}:{}),loadMethod:['added','liftFromGround','bodyweight'].includes(e.loadMethod)?e.loadMethod:'bodyweight',sets:e.sets.map(s=>({target:number(s.target,1,e.mode==='time'?3600:1000,'秒数・回数',true),loadKg:number(s.loadKg??0,0,1000,'重量'),...loadRecordedMetadata(s),restSeconds:number(s.restSeconds??30,0,3600,'休憩時間',true)}))};});
 if(total>300)throw new Error('1回のトレーニングは合計300セットまでです。');
 return {schemaVersion:1,preparationSeconds,title:input.title.trim(),place:typeof input.place==='string'?input.place.slice(0,100):'自宅',transitionRestSeconds:number(input.transitionRestSeconds??60,0,3600,'種目間の休憩',true),exercises};
}
export function makeWorkoutPreset(key='core'){
 const e=(name,mode,target)=>({id:uid(),name,mode,loadMethod:'bodyweight',sets:Array.from({length:3},()=>({target,loadKg:0,restSeconds:30}))});
 return normalizeWorkoutPlan({title:key==='pullup'?'懸垂の日':key==='mixed'?'体幹と懸垂':'体幹の日',place:'自宅',preparationSeconds:5,transitionRestSeconds:60,exercises:key==='pullup'?[e('自重懸垂','reps',10)]:key==='mixed'?[e('体幹トレーニング','time',60),e('自重懸垂','reps',10)]:[e('体幹トレーニング','time',60)]});
}
export function workoutFromMenu(menu){
 if(menu.workoutPlan){const p=clone(menu.workoutPlan);p.preparationSeconds??=5;p.exercises=p.exercises.map(e=>({...e,id:uid()}));return normalizeWorkoutPlan(p);}
 const exercises=(menu.entries||[]).filter(e=>e.kind==='training'&&e.trainingMode!=='maxTest').map(e=>{const detail=e.setDetails?.length?e.setDetails:Array.from({length:Math.max(1,Number(e.sets)||1)},()=>({reps:Number(e.reps)||0,holdSeconds:0,loadKg:Number(e.loadKg)||0}));const mode=detail.every(s=>Number(s.holdSeconds)>0)?'time':'reps';return {id:uid(),name:e.exerciseName||'その他',mode,...(e.fingerConditions||e.gripType||e.edgeDepthMm?{fingerConditions:normalizeFingerConditions(e.fingerConditions||e,e.exerciseName)}:{}),loadMethod:e.loadMethod||(resolveExercise(e.exerciseName)?.definition.loadBasis==='externalLoadOnly'?'liftFromGround':['bodyweight','assistedBodyweight'].includes(resolveExercise(e.exerciseName)?.definition.loadBasis)||['warmup','mobility'].includes(resolveExercise(e.exerciseName)?.definition.category)?'bodyweight':'added'),sets:detail.map(s=>({target:mode==='time'?Number(s.holdSeconds):Math.max(1,Number(s.reps)||1),loadKg:Number(s.loadKg)||0,...loadRecordedMetadata(s),restSeconds:30}))};});
 return normalizeWorkoutPlan({title:menu.name,place:menu.entries?.[0]?.place||'自宅',preparationSeconds:5,transitionRestSeconds:60,exercises});
}
export function workoutPhases(plan){const p=normalizeWorkoutPlan(plan),phases=p.preparationSeconds?[{kind:'prepare',seconds:p.preparationSeconds}]:[];p.exercises.forEach((e,ei)=>e.sets.forEach((s,si)=>{phases.push({kind:'work',exerciseId:e.id,exerciseIndex:ei,setIndex:si,mode:e.mode,target:s.target});if(si<e.sets.length-1&&s.restSeconds)phases.push({kind:'rest',seconds:s.restSeconds});else if(si===e.sets.length-1&&ei<p.exercises.length-1&&p.transitionRestSeconds)phases.push({kind:'rest',seconds:p.transitionRestSeconds,between:true});}));return phases;}
export function workoutEstimate(plan){const phases=workoutPhases(plan);return {preparationSeconds:phases.filter(p=>p.kind==='prepare').reduce((n,p)=>n+p.seconds,0),restSeconds:phases.filter(p=>p.kind==='rest').reduce((n,p)=>n+p.seconds,0),workSeconds:phases.filter(p=>p.kind==='work'&&p.mode==='time').reduce((n,p)=>n+p.target,0),hasReps:phases.some(p=>p.mode==='reps')};}
function enter(session,now){const s=clone(session),phase=workoutPhases(s.plan)[s.phaseIndex];s.phaseElapsedSeconds=0;s.phaseStartedAt=now;s.remainingSeconds=['rest','prepare'].includes(phase?.kind)?phase.seconds:phase?.mode==='time'?phase.target:null;s.endsAt=s.remainingSeconds==null?null:now+s.remainingSeconds*1000;s.status=phase?'running':'review';if(!phase){s.finishedAt=new Date(now).toISOString();s.endsAt=null;s.phaseStartedAt=null;}return s;}
export function createWorkout(plan,date,now=Date.now(),id=uid()){if(!validWorkoutDate(date)||!identifier(id))throw new Error('記録日が不正です。');if(firstMissingWorkoutLoad(plan))throw new Error('荷重を使う種目の重量を設定してください。加重なしは0を入力してください。');return enter({schemaVersion:1,id,date,plan:normalizeWorkoutPlan(plan),phaseIndex:0,status:'running',startedAt:new Date(now).toISOString(),results:[],pauseReason:null},now);}
export function currentWorkoutPhase(s){return workoutPhases(s.plan)[s.phaseIndex]||null;}
export function workoutRemaining(s,now=Date.now()){if(s.remainingSeconds==null)return null;return s.status==='running'?Math.max(0,(s.endsAt-now)/1000):Math.max(0,s.remainingSeconds);}
export function phaseElapsed(s,now=Date.now()){return Math.max(0,(Number(s.phaseElapsedSeconds)||0)+(s.status==='running'?(now-s.phaseStartedAt)/1000:0));}
export function pauseWorkout(session,reason='manual',now=Date.now()){const s=clone(session);if(s.status!=='running')return s;s.remainingSeconds=workoutRemaining(s,now);s.phaseElapsedSeconds=phaseElapsed(s,now);s.phaseStartedAt=null;s.endsAt=null;s.status='paused';s.pauseReason=reason;return s;}
export function resumeWorkout(session,now=Date.now()){const s=clone(session);if(s.status!=='paused')return s;s.status='running';s.pauseReason=null;s.phaseStartedAt=now;s.endsAt=s.remainingSeconds==null?null:now+Math.max(0,s.remainingSeconds)*1000;return s;}
function advance(session,now){const s=clone(session);s.phaseIndex++;return enter(s,now);}
export function finishWorkoutPhase(session,{now=Date.now(),skip=false}={}){
 if(session.status!=='running'&&!(session.status==='paused'&&skip))return clone(session);const s=session.status==='paused'?resumeWorkout(session,now):clone(session),p=currentWorkoutPhase(s);if(!p)return s;const elapsed=phaseElapsed(s,now);
 if(p.kind==='work')s.results.push({exerciseId:p.exerciseId,setIndex:p.setIndex,mode:p.mode,status:skip?'skipped':'completed',plannedTarget:p.target,actual:skip?0:p.mode==='time'?Number(Math.min(p.target,elapsed).toFixed(1)):p.target,loadKg:s.plan.exercises[p.exerciseIndex].sets[p.setIndex].loadKg,loadRecorded:isRecordedLoad(s.plan.exercises[p.exerciseIndex].sets[p.setIndex],s.plan.exercises[p.exerciseIndex].loadMethod),actualWorkSeconds:p.mode==='time'?Math.min(p.target,elapsed):elapsed,actualRestSeconds:0});
 else if(p.kind==='rest'){const last=s.results.at(-1);if(last)last.actualRestSeconds+=elapsed;}
 if(skip&&p.kind==='work'){const next=workoutPhases(s.plan)[s.phaseIndex+1];if(next?.kind==='rest'&&!next.between)s.phaseIndex++;}
 return advance(s,now);
}
export function tickWorkout(session,now=Date.now(),lateToleranceSeconds=3){
 if(session.status!=='running'||session.endsAt==null||now<session.endsAt)return {session,changed:false,transitioned:false};
 if(now-session.endsAt>lateToleranceSeconds*1000)return {session:pauseWorkout(session,'interrupted',now),changed:true,transitioned:false};
 return {session:finishWorkoutPhase(session,{now}),changed:true,transitioned:true};
}
export function extendWorkoutRest(session,seconds=15,now=Date.now()){const s=clone(session);if(!['running','paused'].includes(s.status)||currentWorkoutPhase(s)?.kind!=='rest')return s;number(seconds,1,600,'延長時間',true);s.remainingSeconds=(workoutRemaining(s,now)||0)+seconds;if(s.status==='running')s.endsAt=now+s.remainingSeconds*1000;return s;}
export function stopWorkout(session,now=Date.now()){const s=pauseWorkout(session,'stopped',now);s.status='review';s.finishedAt=new Date(now).toISOString();return s;}
export function reviseWorkoutResult(session,exerciseId,setIndex,actual,loadKg,{loadEdited=false}={}){const s=clone(session),r=s.results.find(r=>r.exerciseId===exerciseId&&r.setIndex===setIndex&&r.status==='completed');if(s.status!=='review'||!r)throw new Error('編集する実施結果がありません。');r.actual=number(actual,0,r.mode==='time'?3600:1000,'実施量',r.mode==='reps');r.loadKg=number(loadKg,0,1000,'重量');if(loadEdited)r.loadRecorded=true;return s;}
export function normalizeWorkoutFeedback(input={}){const rpe=input?.rpe==null||input.rpe===''?null:number(input.rpe,1,10,'きつさ',true);const memo=input?.memo??'';if(typeof memo!=='string'||memo.length>2000)throw new Error('メモは2000文字以内で入力してください。');return {rpe,memo};}
export function restoreWorkoutDraft(raw,now=Date.now()){
 if(raw?.schemaVersion!==1||!identifier(raw.id)||!validWorkoutDate(raw.date)||!['running','paused','review'].includes(raw.status)||!Number.isFinite(Date.parse(raw.startedAt))||!Array.isArray(raw.results))throw new Error('途中記録の形式が不正です。');
 const plan=normalizeWorkoutPlan(raw.plan),phases=workoutPhases(plan),phaseIndex=number(raw.phaseIndex,0,phases.length,'進行位置',true),seen=new Set();
 if(raw.status!=='review'&&phaseIndex>=phases.length)throw new Error('進行位置が不正です。');
 const results=raw.results.map(r=>{const e=plan.exercises.find(e=>e.id===r.exerciseId),key=r.exerciseId+':'+r.setIndex;if(!e||!Number.isInteger(r.setIndex)||!e.sets[r.setIndex]||seen.has(key)||!['completed','skipped'].includes(r.status)||e.mode!==r.mode)throw new Error('実施セットが不正です。');seen.add(key);return {exerciseId:e.id,setIndex:r.setIndex,mode:e.mode,status:r.status,plannedTarget:e.sets[r.setIndex].target,actual:number(r.actual,0,e.mode==='time'?3600:1000,'実施量',e.mode==='reps'),loadKg:number(r.loadKg,0,1000,'重量'),loadRecorded:isRecordedLoad(r,e.loadMethod),actualWorkSeconds:number(r.actualWorkSeconds??0,0,86400,'実施時間'),actualRestSeconds:number(r.actualRestSeconds??0,0,86400,'休憩時間')};});
 for(const r of results){const index=phases.findIndex(p=>p.kind==='work'&&p.exerciseId===r.exerciseId&&p.setIndex===r.setIndex);if(index>=phaseIndex)throw new Error('未実施のセットを含んでいます。');}
 const active=raw.status==='running';if(active&&(!Number.isFinite(raw.phaseStartedAt)||raw.remainingSeconds!=null&&!Number.isFinite(raw.endsAt)))throw new Error('タイマーの時刻が不正です。');
 const remainingSeconds=raw.remainingSeconds==null?null:number(active?Math.max(0,(Number(raw.endsAt)-now)/1000):raw.remainingSeconds,0,86400,'残り時間');
 return {schemaVersion:1,id:raw.id,date:raw.date,plan,phaseIndex,results,feedback:normalizeWorkoutFeedback(raw.feedback),status:raw.status==='review'?'review':'paused',startedAt:raw.startedAt,finishedAt:raw.finishedAt||null,remainingSeconds,endsAt:null,phaseStartedAt:null,phaseElapsedSeconds:Math.min(86400,number(raw.phaseElapsedSeconds??0,0,86400,'経過時間')+(active?Math.max(0,(now-Number(raw.phaseStartedAt))/1000):0)),pauseReason:'reload'};
}
export function prepareWorkoutSave(state,session,now=Date.now()){
 const s=restoreWorkoutDraft(session,now);if(s.status!=='review')throw new Error('実施結果を確認してから保存してください。');
 if((state.workoutReceipts||[]).some(row=>row.id===s.id))return {alreadySaved:true,recordIds:[],patch:{}};
 const completed=s.results.filter(r=>r.status==='completed'&&r.actual>0);if(!completed.length)throw new Error('実施済みのセットがありません。');
 const records=s.plan.exercises.flatMap(e=>{const rows=completed.filter(r=>r.exerciseId===e.id);if(!rows.length)return [];const id='workout-'+s.id+'-'+e.id;
 const durationMinutes=Number((rows.reduce((n,r)=>n+r.actualWorkSeconds+r.actualRestSeconds,0)/60).toFixed(2));
 const record=applySetDetails({id,date:s.date,kind:'training',trainingMode:'routine',place:s.plan.place,trainingPlace:s.plan.place,exerciseName:e.name,grade:e.name,swatch:'#b58cff',sends:0,tries:0,loadMethod:e.loadMethod,...(e.fingerConditions?{gripType:e.fingerConditions.gripType,edgeDepthMm:e.fingerConditions.edgeDepthMm}:{}),rpe:s.feedback.rpe??0,memo:s.feedback.memo,feedbackScope:'session',recordSource:'timer',durationMinutes,bodyweightKg:getBodyWeightForDate(state.bodyWeights||[],s.date),batchSessionId:s.id,workoutSessionId:s.id,workoutTitle:s.plan.title,workoutStartedAt:s.startedAt,workoutFinishedAt:s.finishedAt,sessionSetResults:clone(rows),createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()},rows.map(r=>({reps:e.mode==='reps'?r.actual:0,holdSeconds:e.mode==='time'?r.actual:0,loadKg:r.loadKg,loadRecorded:r.loadRecorded})));return [record];});
 const existing=new Set([...(state.records||[]).map(r=>r.id),...(state.recycleBin||[]).map(r=>r.record?.id)]);if(records.some(r=>existing.has(r.id)))throw new Error('この実行結果の記録がすでに存在します。再保存を中止しました。');
 return {alreadySaved:false,recordIds:records.map(r=>r.id),patch:{records:[...(state.records||[]),...records],workoutReceipts:[...(state.workoutReceipts||[]),{id:s.id,date:s.date,savedAt:new Date(now).toISOString(),recordIds:records.map(r=>r.id)}]}};
}
export function workoutAsMenu(plan){const p=normalizeWorkoutPlan(plan);return {name:p.title,workoutPlan:p,entries:p.exercises.map(e=>applySetDetails({kind:'training',trainingMode:'routine',exerciseName:e.name,grade:e.name,place:p.place,trainingPlace:p.place,loadMethod:e.loadMethod,...(e.fingerConditions?{fingerConditions:e.fingerConditions}:{}),swatch:'#b58cff',durationMinutes:0,rpe:0,sends:0,tries:0,memo:''},e.sets.map(s=>({reps:e.mode==='reps'?s.target:0,holdSeconds:e.mode==='time'?s.target:0,loadKg:s.loadKg,...loadRecordedMetadata(s)}))))};}

// Move complete exercise objects, preserving per-set values and stable exercise identity.
export function moveWorkoutExercise(plan,exerciseId,direction){
 if(direction!==-1&&direction!==1)throw new Error('移動方向を確認してください。');
 const next=normalizeWorkoutPlan(plan),index=next.exercises.findIndex(e=>e.id===exerciseId),target=index+direction;
 if(index<0||target<0||target>=next.exercises.length)throw new Error('この位置には移動できません。');
 [next.exercises[index],next.exercises[target]]=[next.exercises[target],next.exercises[index]];
 return next;
}
