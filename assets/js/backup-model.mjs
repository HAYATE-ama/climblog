import {clone} from './data-utils.mjs';
import {normalizeSetDetails} from './training-model.mjs';
import {accountKeys} from './account-storage.mjs';
export function validateBackup(value){
 if(!value||typeof value!=='object'||!Array.isArray(value.records))throw new Error('ClimbLogのJSONバックアップを選んでください。');
 const walk=(v,depth=0)=>{if(depth>30)throw new Error('データの階層が深すぎます。');if(v&&typeof v==='object')for(const [k,item] of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))throw new Error('安全でない項目を含みます。');walk(item,depth+1);}};walk(value);
 for(const key of ['records','gyms','bodyWeights','trainingPresets','trainingMenus','dailyJournals','recordHistory','recycleBin'])if(value[key]!=null&&!Array.isArray(value[key]))throw new Error(key+'の形式が不正です。');
 const dateValid=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===v;};
 const idValid=v=>typeof v==='string'&&/^[a-z0-9_:.-]{1,160}$/i.test(v);
 const recordValid=row=>{if(!row||!idValid(row.id)||!dateValid(row.date)||!['gym','outdoor','training'].includes(row.kind))throw new Error('記録のID・日付・活動タイプを確認してください。');for(const key of ['place','gymName','cragName','areaName','routeName','grade','exerciseName','summary','memo'])if(row[key]!=null&&typeof row[key]!=='string')throw new Error('記録の文字列項目が不正です。');for(const key of ['sets','reps','durationMinutes','loadKg','addedWeightKg','totalLoadKg','sends','tries'])if(row[key]!=null&&(!Number.isFinite(Number(row[key]))||Number(row[key])<0))throw new Error('記録の数値項目が不正です。');if(row.setDetails?.length)normalizeSetDetails(row.setDetails);};
 for(const row of value.records)recordValid(row);
 for(const [key,list] of Object.entries(value))if(Array.isArray(list)&&['records','trainingPresets','trainingMenus','recordHistory','recycleBin'].includes(key)){const seen=new Set();for(const row of list){if(!row||!idValid(row.id)||seen.has(row.id))throw new Error(key+'に不正または重複したIDがあります。');seen.add(row.id);}}
 for(const row of value.gyms||[])if(typeof row?.name!=='string'||!row.name.trim()||!Array.isArray(row.grades)||!row.grades.length||row.grades.some(b=>!Array.isArray(b)||typeof b[0]!=='string'||!/^#[0-9a-f]{6}$/i.test(b[1])))throw new Error('ジムの色・グレードの形式が不正です。');
 for(const row of value.bodyWeights||[])if(!dateValid(row?.date)||!(Number(row.kg)>0&&Number(row.kg)<=500))throw new Error('体重履歴の形式が不正です。');
 for(const row of value.dailyJournals||[])if(!dateValid(row?.date)||!row.condition||typeof row.condition!=='object'||Array.isArray(row.condition)||[row.reflection,row.nextIdea].some(v=>v!=null&&typeof v!=='string'))throw new Error('振り返りの形式が不正です。');
 for(const row of value.trainingPresets||[])if(typeof row.name!=='string'||!row.fields||typeof row.fields!=='object'||!['hangboard','singleHandLift','weightedPullup'].includes(row.fields.maxType))throw new Error('測定条件の形式が不正です。');
 for(const row of value.trainingMenus||[]){if(typeof row.name!=='string'||!Array.isArray(row.entries)||!row.entries.length)throw new Error('メニューの形式が不正です。');for(const entry of row.entries){if(entry.kind!=='training'||entry.trainingMode!=='routine'||typeof entry.exerciseName!=='string')throw new Error('メニューの種目が不正です。');if(entry.setDetails?.length)normalizeSetDetails(entry.setDetails);}}
 for(const row of value.recycleBin||[])recordValid(row.record);
 for(const row of value.recordHistory||[]){if(!idValid(row.recordId)||!row.before&&!row.after)throw new Error('編集履歴の形式が不正です。');for(const r of [row.before,row.after])if(r){recordValid(r);if(r.id!==row.recordId)throw new Error('編集履歴のIDが一致しません。');}}
 for(const key of ['goals','preferences','bodyProfile'])if(value[key]!=null&&(typeof value[key]!=='object'||Array.isArray(value[key])))throw new Error(key+'の形式が不正です。');
 if(value.preferences?.theme&&!['dark','light','system'].includes(value.preferences.theme))throw new Error('テーマ設定が不正です。');
 for(const key of ['focus','plan','reflection'])if(value.goals?.[key]!=null&&typeof value.goals[key]!=='string')throw new Error('目標の形式が不正です。');
 for(const key of ['heightCm','reachCm'])if(value.bodyProfile?.[key]!=null&&(!Number.isFinite(Number(value.bodyProfile[key]))||Number(value.bodyProfile[key])<0||Number(value.bodyProfile[key])>300))throw new Error('身体設定の形式が不正です。');
 return Object.fromEntries(Object.keys(accountKeys).filter(k=>Object.hasOwn(value,k)).map(k=>[k,clone(value[k])]));
}
export function mergeBackup(current,incoming,{overwrite=false,settings=false}={}){
 const patch={},count={added:0,conflicts:0};
 for(const key of ['records','gyms','bodyWeights','trainingPresets','trainingMenus','dailyJournals','recordHistory','recycleBin']){
  if(!Array.isArray(incoming[key]))continue;const identity=row=>key==='gyms'?row.name:['bodyWeights','dailyJournals'].includes(key)?row.date:row.id;const map=new Map((current[key]||[]).map(row=>[identity(row),clone(row)]));
  for(const row of incoming[key]){const id=identity(row);if(!id)throw new Error(key+'にID/日付のない項目があります。');if(map.has(id)){count.conflicts++;if(overwrite)map.set(id,clone(row));}else{map.set(id,clone(row));count.added++;}}patch[key]=[...map.values()];
 }
 if(settings)for(const key of ['goals','preferences','bodyProfile'])if(incoming[key])patch[key]=clone(incoming[key]);
 const active=new Set((patch.records||current.records).map(row=>row.id));if(patch.recycleBin)patch.recycleBin=patch.recycleBin.filter(entry=>entry.record&&!active.has(entry.record.id));
 return {patch,count};
}
