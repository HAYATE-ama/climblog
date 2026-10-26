// Local-only validation and conversion. No provider, network, persistence or execution.
import {exerciseDefinitions,equipmentCatalog,getExerciseDefinition} from './exercise-registry.mjs';
import {normalizeWorkoutPlan} from './workout-model.mjs';
import {normalizeCoachOptions} from './coach-model.mjs';
const phases=['warmup','main','cooldown'];
const integer=(n,min,max)=>typeof n==='number'&&Number.isInteger(n)&&n>=min&&n<=max;
export function buildCoachCandidates({equipment=[],phase=null}={}){
 if(!Array.isArray(equipment)||equipment.some(id=>!equipmentCatalog.some(e=>e.id===id))||phase!==null&&!phases.includes(phase))throw new Error('種目候補の条件が不正です。');
 const available=new Set(equipment);
 return exerciseDefinitions.filter(d=>d.aiDraftEligible&&(!phase||d.phases.includes(phase))&&d.requiredEquipment.every(id=>available.has(id))).map(d=>({exerciseId:d.exerciseId,displayName:d.displayName,category:d.category,mode:d.defaultMode,sidedness:d.sidedness,completionMode:d.completionMode,phases:[...d.phases],requiredEquipment:[...d.requiredEquipment],optionalEquipment:[...d.optionalEquipment],counting:d.counting,brief:d.guide.brief,steps:[...d.guide.steps],caution:d.guide.caution,reference:{...d.guide.reference}}));
}
export function validateCoachDraft(draft,options={}){
 const conditions=normalizeCoachOptions(options),allowed=new Set(buildCoachCandidates(conditions).map(d=>d.exerciseId));
 if(draft?.schemaVersion!==2||typeof draft.title!=='string'||!draft.title.trim()||draft.title.length>100||!Array.isArray(draft.items)||draft.items.length<1||draft.items.length>30)throw new Error('提案メニューの形式が不正です。');
 const preparationSeconds=draft.preparationSeconds??5,transitionRestSeconds=draft.transitionRestSeconds??15;
 if(![0,3,5,10].includes(preparationSeconds)||!integer(transitionRestSeconds,0,3600))throw new Error('提案の準備・休憩時間が不正です。');
 const seen=new Set();let previous=-1,totalSets=0;
 const items=draft.items.map(item=>{const d=getExerciseDefinition(item?.exerciseId),side=item?.side??null;
  if(!d||!allowed.has(d.exerciseId)||item.mode!=null&&item.mode!==d.defaultMode||typeof item.itemId!=='string'||!/^[a-z0-9_-]{1,64}$/i.test(item.itemId)||seen.has(item.itemId)||!d.phases.includes(item.phase)||phases.indexOf(item.phase)<previous)throw new Error('提案の種目・器具・順序を確認してください。');seen.add(item.itemId);previous=phases.indexOf(item.phase);
  if(d.sidedness==='separateSides'?!['left','right'].includes(side):side!==null)throw new Error('提案の左右指定が不正です。');
  if(!Array.isArray(item.sets)||!item.sets.length||item.sets.length>100||!integer(item.durationSeconds,1,10800))throw new Error('提案のセット・予定時間が不正です。');totalSets+=item.sets.length;
  const sets=item.sets.map(s=>{if(!integer(s.target,1,d.defaultMode==='time'?3600:1000)||!integer(s.restSeconds,0,3600)||s.loadKg!==0||d.completionMode==='manualCompletion'&&s.target!==1)throw new Error('提案の回数・秒数・重量・休憩を確認してください。');return {target:s.target,restSeconds:s.restSeconds,loadKg:0};});
  const minimum=sets.reduce((n,s,i)=>n+(d.defaultMode==='time'?s.target:1)+(i<sets.length-1?s.restSeconds:0),0);if(item.durationSeconds<minimum)throw new Error('提案の予定時間が運動・休憩より短くなっています。');
  return {itemId:item.itemId,exerciseId:d.exerciseId,phase:item.phase,side,mode:d.defaultMode,sets,durationSeconds:item.durationSeconds};
 });
 const totalSeconds=preparationSeconds+items.reduce((n,i)=>n+i.durationSeconds,0)+transitionRestSeconds*(items.length-1);
 if(totalSets>300||totalSeconds>conditions.availableMinutes*60)throw new Error('提案が利用時間またはセット上限を超えています。');
 return {schemaVersion:2,title:draft.title.trim(),preparationSeconds,transitionRestSeconds,items,totalSeconds};
}
export function coachDraftToWorkoutPlan(draft,options={},createId=()=>crypto.randomUUID()){
 const validated=validateCoachDraft(draft,options),conditions=normalizeCoachOptions(options);
 return normalizeWorkoutPlan({title:validated.title,place:({home:'自宅',gym:'ジム',outdoor:'外岩'})[conditions.location],preparationSeconds:validated.preparationSeconds,transitionRestSeconds:validated.transitionRestSeconds,exercises:validated.items.map(item=>{const d=getExerciseDefinition(item.exerciseId);return {id:createId(),name:d.name+(item.side?item.side==='left'?'（左）':'（右）':''),mode:d.defaultMode,loadMethod:'bodyweight',sets:item.sets.map(s=>({...s}))};})});
}
