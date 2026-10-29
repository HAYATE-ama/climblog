import {dailyCandidates,validateDailyDraft} from '../../../assets/js/ai-coach-contract.mjs';
// The sets are authoritative. Repair only a redundant, underestimated time estimate.
// Never change targets, loads or rests; validate the resulting total against the user's budget.
export function validateGeneratedDraft(value,settings){
 const draft=structuredClone(value),candidates=new Map(dailyCandidates(settings).map(d=>[d.exerciseId,d]));
 if(draft?.decision==='train'&&Array.isArray(draft.items))for(const item of draft.items){
  const d=candidates.get(item?.exerciseId);
  if(!d||item.mode!==d.mode||!Number.isInteger(item.durationSeconds)||item.durationSeconds<1||item.durationSeconds>5400||!Array.isArray(item.sets)||!item.sets.length)continue;
  if(item.sets.some(s=>!s||!Number.isInteger(s.target)||s.target<1||!Number.isInteger(s.restSeconds)||s.restSeconds<0))continue;
  const minimum=item.sets.reduce((total,set,index)=>total+(d.mode==='time'?set.target:d.manual?30:set.target*2)+(index<item.sets.length-1?set.restSeconds:0),0);
  item.durationSeconds=Math.max(item.durationSeconds,minimum);
 }
 return validateDailyDraft(draft,settings);
}
