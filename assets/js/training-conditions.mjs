import {resolveExercise} from './exercise-registry.mjs';
export const gripChoices=[['open','オープンハンド'],['halfCrimp','ハーフクリンプ'],['fullCrimp','フルクリンプ']];
export function fixedExerciseGrip(name){return ({assistedOpenHang:'open',assistedHalfCrimpHang:'halfCrimp'})[resolveExercise(name)?.definition.exerciseId]||null;}
export function normalizeFingerConditions(input={},name=''){const fixed=fixedExerciseGrip(name),grip=input?.gripType||fixed||null,raw=input?.edgeDepthMm,depth=raw==null||raw===''?null:Number(raw);if(grip!==null&&!gripChoices.some(([id])=>id===grip)||fixed&&grip!==fixed)throw new Error('種目に合う握り方を選択してください。');if(depth!==null&&(!Number.isFinite(depth)||depth<0.1||depth>100))throw new Error('エッジ深さは0.1〜100mmで入力してください。');return {gripType:grip,edgeDepthMm:depth};}
export function isRecordedLoad(set,loadMethod){if(typeof set?.loadRecorded==='boolean')return set.loadRecorded;return set?.loadKg!=null&&set.loadKg!==''&&Number.isFinite(Number(set.loadKg))&&(Number(set.loadKg)>0||Number(set.loadKg)===0&&loadMethod==='bodyweight');}
export function firstMissingWorkoutLoad(plan){for(const e of plan.exercises){if(!['added','liftFromGround'].includes(e.loadMethod))continue;const setIndex=e.sets.findIndex(s=>!isRecordedLoad(s,e.loadMethod));if(setIndex>=0)return {exerciseId:e.id,setIndex};}return null;}

export function loadRecordedMetadata(set){if(set.loadRecorded===undefined)return {};if(typeof set.loadRecorded!=='boolean')throw new Error('重量の設定状態が不正です。');return {loadRecorded:set.loadRecorded};}
