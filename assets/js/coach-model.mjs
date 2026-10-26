import {summarizeRoutineExercises} from './exercise-history.mjs';
import {exerciseDefinitions,equipmentCatalog} from './exercise-registry.mjs';
// Stable local contracts for the future AI adapter. This module does not send data.
import {maxConditionKey,measurementValue} from './strength-insights.mjs';
import {trainingVolume} from './training-model.mjs';
export const coachSchemaVersion=1;
export const coachPurposes=[['warmup','登る前のウォームアップ'],['strength','筋力トレーニング'],['finger','指のトレーニング'],['endurance','持久力'],['light','軽めの調整']];
export const coachEquipment=Object.freeze(equipmentCatalog.map(row=>Object.freeze([row.id,row.label])));
// v1 is retained for compatibility only; new draft validation uses the shared registry.
export const coachExerciseCatalog=Object.freeze(exerciseDefinitions.filter(d=>d.legacyCoachPhase).map(d=>Object.freeze({exerciseId:d.exerciseId,label:d.displayName,phase:d.legacyCoachPhase})));
export function isCoachDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===value;}
export function normalizeCoachOptions(input={}){
 const purpose=input.purpose??'warmup',minutes=Number(input.availableMinutes??30),location=input.location??'gym',equipment=input.equipment??[];
 if(!coachPurposes.some(([key])=>key===purpose))throw new Error('目的を選択してください。');
 if(!Number.isInteger(minutes)||minutes<5||minutes>180)throw new Error('使える時間は5〜180分で入力してください。');
 if(!['gym','home','outdoor'].includes(location))throw new Error('場所を選択してください。');
 if(!Array.isArray(equipment)||equipment.some(id=>!coachEquipment.some(([key])=>key===id)))throw new Error('器具を確認してください。');
 return {purpose,availableMinutes:minutes,location,equipment:[...new Set(equipment)]};
}
export function buildLocalCoachContext(state,{referenceDate,windowDays=28}={}){
 if(!isCoachDate(referenceDate)||!Number.isInteger(windowDays)||windowDays<1||windowDays>365)throw new Error('集計期間が不正です。');
 const start=new Date(referenceDate+'T00:00:00Z');start.setUTCDate(start.getUTCDate()-windowDays+1);const fromDate=start.toISOString().slice(0,10);
 // Allowlist numeric facts only. No names, notes, profile or free-text goals.
 const rows=(Array.isArray(state.records)?state.records:[]).filter(row=>row&&isCoachDate(row.date)&&row.date>=fromDate&&row.date<=referenceDate);
 const routines=rows.filter(r=>r.kind==='training'&&r.trainingMode!=='maxTest'),groups=new Map();
 for(const r of rows.filter(r=>r.kind==='training'&&r.trainingMode==='maxTest')){
  if(!['hangboard','singleHandLift','weightedPullup'].includes(r.maxType)||r.addedWeightKg==null||r.addedWeightKg===''||!Number.isFinite(Number(r.addedWeightKg))||Number(r.addedWeightKg)<0)continue;
  const metric=measurementValue(r);if(!Number.isFinite(metric.valueKg)||metric.valueKg<0)continue;
  const positive=v=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
  const condition={maxType:r.maxType,gripType:['open','halfCrimp','fullCrimp'].includes(r.gripType)?r.gripType:null,edgeDepthMm:positive(r.edgeDepthMm),holdSeconds:positive(r.holdSeconds),liftHand:['right','left'].includes(r.liftHand)?r.liftHand:null};
  const conditionKey=maxConditionKey(condition)+'|'+metric.metricBasis,previous=groups.get(conditionKey);
  const row={conditionKey,...condition,metricBasis:metric.metricBasis,bestKg:metric.valueKg};
  if(!previous||row.bestKg>previous.bestKg)groups.set(conditionKey,row);
 }
 return {schemaVersion:coachSchemaVersion,referenceDate,window:{fromDate,toDate:referenceDate,days:windowDays},recordCount:rows.length,climbingDays:new Set(rows.filter(r=>['gym','outdoor'].includes(r.kind)).map(r=>r.date)).size,routineCount:routines.length,routineSets:routines.reduce((n,r)=>n+trainingVolume(r).sets,0),routineReps:routines.reduce((n,r)=>n+trainingVolume(r).reps,0),measurementGroups:[...groups.values()],routineExercises:summarizeRoutineExercises(routines),hasTodayCondition:(state.dailyJournals||[]).some(r=>r?.date===referenceDate&&r.condition&&Object.values(r.condition).some(v=>v!=null&&String(v).trim()!=='')),hasWrittenGoal:Boolean(String(state.goals?.focus||'').trim())};
}
export function buildCoachRequest(state,options,referenceDate){return {schemaVersion:coachSchemaVersion,options:normalizeCoachOptions(options),context:buildLocalCoachContext(state,{referenceDate}),dataPolicy:{scope:'deviceOnly',externalTransmissionAllowed:false}};}
// A response contract, not a prescription: numerical bounds only protect the UI.
// Clinical/training load checks and explicit consent must be added before enabling an adapter.
export function validateCoachPlan(plan,{availableMinutes=180}={}){
 if(plan?.schemaVersion!==coachSchemaVersion||typeof plan.title!=='string'||!plan.title.trim()||plan.title.length>120||!Array.isArray(plan.items)||!plan.items.length||plan.items.length>30)throw new Error('メニューの形式が不正です。');
 let totalSeconds=0;const ids=new Set();
 const items=plan.items.map(item=>{
  const exercise=coachExerciseCatalog.find(row=>row.exerciseId===item.exerciseId);
  if(typeof item.itemId!=='string'||!/^[a-z0-9_-]{1,80}$/i.test(item.itemId)||ids.has(item.itemId)||!exercise||item.phase!==exercise.phase)throw new Error('メニューの種目・識別子が不正です。');ids.add(item.itemId);
  if(!Array.isArray(item.setDetails)||!item.setDetails.length||item.setDetails.length>50)throw new Error('セットの形式が不正です。');
  const setDetails=item.setDetails.map(set=>{const row={reps:set.reps,loadKg:set.loadKg,holdSeconds:set.holdSeconds};for(const [key,value] of Object.entries(row))if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>({reps:1000,loadKg:1000,holdSeconds:3600}[key]))throw new Error('セットの数値が不正です。');if(!Number.isInteger(row.reps)||!row.reps&&!row.holdSeconds)throw new Error('回数または保持時間が必要です。');return row;});
  if(!Number.isInteger(item.restSeconds)||item.restSeconds<0||item.restSeconds>3600||!Number.isInteger(item.durationSeconds)||item.durationSeconds<1||item.durationSeconds>10800)throw new Error('時間の形式が不正です。');
  const minimum=setDetails.reduce((n,s)=>n+s.holdSeconds,0)+item.restSeconds*Math.max(0,setDetails.length-1);if(item.durationSeconds<minimum)throw new Error('種目の時間が保持と休憩の合計より短くなっています。');totalSeconds+=item.durationSeconds;
  return {itemId:item.itemId,exerciseId:exercise.exerciseId,phase:exercise.phase,setDetails,restSeconds:item.restSeconds,durationSeconds:item.durationSeconds};
 });
 if(!Number.isFinite(availableMinutes)||availableMinutes<5||availableMinutes>180||totalSeconds>availableMinutes*60)throw new Error('指定時間に収まっていません。');
 return {schemaVersion:coachSchemaVersion,title:plan.title,items,totalSeconds};
}
