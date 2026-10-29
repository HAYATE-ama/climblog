import {isRecordedLoad,loadRecordedMetadata} from './training-conditions.mjs';
import {withExerciseIdentity} from './exercise-registry.mjs';
import {clone} from './data-utils.mjs';
export function normalizeSetDetails(rows){
  if(!Array.isArray(rows)||!rows.length||rows.length>200)throw new Error('セットを1〜200件で入力してください。');
  return rows.map((row,index)=>{const result={reps:Number(row.reps||0),loadKg:Number(row.loadKg||0),holdSeconds:Number(row.holdSeconds||0)};for(const [key,value] of Object.entries(result))if(!Number.isFinite(value)||value<0||value>({reps:1000,loadKg:1000,holdSeconds:3600}[key]))throw new Error(`${index+1}セット目の数値を確認してください。`);if(!Number.isInteger(result.reps))throw new Error('回数は整数で入力してください。');if(!result.reps&&!result.holdSeconds)throw new Error(`${index+1}セット目に回数か保持時間を入力してください。`);return {...result,...loadRecordedMetadata(row)};});
}
export function trainingVolume(record){
  if(Array.isArray(record.setDetails)&&record.setDetails.length){const rows=record.setDetails;return {sets:rows.length,reps:rows.reduce((n,row)=>n+(Number(row.reps)||0),0),holdSeconds:rows.reduce((n,row)=>n+(Number(row.holdSeconds)||0),0),loadTotal:rows.filter(row=>isRecordedLoad(row,record.loadMethod)).reduce((n,row)=>n+(Number(row.loadKg)||0),0),loadCount:rows.filter(row=>isRecordedLoad(row,record.loadMethod)).length};}
  const sets=Number(record.sets)||0,recorded=isRecordedLoad(record,record.loadMethod);return {sets,reps:sets*(Number(record.reps)||0),holdSeconds:0,loadTotal:recorded?(Number(record.loadKg)||0)*sets:0,loadCount:recorded?sets:0};
}
export function applySetDetails(record,rows){
  const setDetails=normalizeSetDetails(rows),volume=trainingVolume({setDetails,loadMethod:record.loadMethod}),weights=setDetails.filter(row=>isRecordedLoad(row,record.loadMethod)).map(row=>row.loadKg),reps=setDetails.map(row=>row.reps),lo=weights.length?Math.min(...weights):0,hi=weights.length?Math.max(...weights):0;
  return {...withExerciseIdentity(record),setDetails,sets:volume.sets,reps:reps.every(value=>value===reps[0])?reps[0]:0,loadKg:hi,summary:[`${volume.sets}セット`,`合計${volume.reps}回`,volume.holdSeconds?`時間式合計${volume.holdSeconds}秒`:null,weights.length?`${lo===hi&&hi===0?'重量なし':(lo===hi?hi:lo+'〜'+hi)+'kg'}${weights.length<setDetails.length?'（未記録あり）':''}`:'重量未記録',record.durationMinutes?`${record.durationMinutes}分`:null].filter(Boolean).join(' · ')};
}
export function makePairedLifts(base,right,left){
  const values=[right,left];if(values.some(value=>value==null||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>300))throw new Error('右手・左手それぞれの重量を0〜300kgで入力してください。重量なしは0を入力してください。');
  return ['right','left'].map((hand,index)=>({...clone(base),liftHand:hand,addedWeightKg:Number(values[index]),loadKg:Number(values[index]),totalLoadKg:Number(values[index]),summary:[({open:'オープン',halfCrimp:'ハーフクリンプ',fullCrimp:'フルクリンプ'}[base.gripType]||''),base.edgeDepthMm?base.edgeDepthMm+'mm':null,hand==='right'?'右手':'左手','挙上 '+Number(values[index])+'kg'].filter(Boolean).join(' · ')}));
}
export function menuEntry(record){
  const keys=['kind','trainingMode','place','trainingPlace','exerciseName','grade','sets','reps','durationMinutes','loadKg','loadRecorded','rpe','memo','loadMethod','setDetails','swatch','summary','fingerConditions','gripType','edgeDepthMm'];
  const value=Object.fromEntries(keys.filter(key=>record[key]!==undefined).map(key=>[key,clone(record[key])]));return {...value,kind:'training',trainingMode:'routine',sends:0,tries:0};
}
export function summarizeTraining(records){
  const rows=records.filter(row=>row.kind==='training'&&row.trainingMode!=='maxTest'),byExercise=new Map();
  for(const row of rows){const key=row.exerciseName||row.grade||'その他',volume=trainingVolume(row),item=byExercise.get(key)||{name:key,count:0,sets:0,reps:0,minutes:0,holdSeconds:0,rpeTotal:0,rpeCount:0,loadTotal:0,loadCount:0};item.count++;item.sets+=volume.sets;item.reps+=volume.reps;item.holdSeconds+=volume.holdSeconds;item.minutes+=Number(row.durationMinutes)||0;item.loadTotal+=volume.loadTotal;item.loadCount+=volume.loadCount;if(Number(row.rpe)>0){item.rpeTotal+=Number(row.rpe);item.rpeCount++;}byExercise.set(key,item);}
  const items=[...byExercise.values()].sort((a,b)=>b.minutes-a.minutes||b.count-a.count);
  return {rows,items,holdSeconds:items.reduce((n,item)=>n+item.holdSeconds,0),days:new Set(rows.map(row=>row.date)).size,minutes:items.reduce((n,item)=>n+item.minutes,0),sets:items.reduce((n,item)=>n+item.sets,0),reps:items.reduce((n,item)=>n+item.reps,0),rpeTotal:items.reduce((n,item)=>n+item.rpeTotal,0),rpeCount:items.reduce((n,item)=>n+item.rpeCount,0)};
}
export function renderTrainingVolumeMarkup(records){
  const data=summarizeTraining(records);if(!data.rows.length)return '<div class="emptyStats">トレーニングの記録がありません</div>';
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),max=Math.max(1,...data.items.map(item=>item.minutes));
  return `<div class="trainingMetrics"><div><small>実施日数</small><strong>${data.days}<em>日</em></strong></div><div><small>記録した種目</small><strong>${data.rows.length}<em>件</em></strong></div><div><small>合計時間</small><strong>${data.minutes}<em>分</em></strong></div><div><small>合計セット</small><strong>${data.sets}<em>セット</em></strong></div></div><div class="trainingExtraMetrics"><span>総回数 <b>${data.reps}回</b></span>${data.holdSeconds?`<span>時間式合計 <b>${data.holdSeconds}秒</b></span>`:''}<span>平均RPE <b>${data.rpeCount?(data.rpeTotal/data.rpeCount).toFixed(1):'—'}</b></span></div><div class="trainingRowsHeading"><span>種目別の量</span><small>バーは合計時間の割合</small></div>${data.items.map(item=>`<div class="trainingExercise"><div class="trainingExerciseTop"><strong>${escape(item.name)}</strong><span>${item.minutes}分 <small>(${data.minutes?Math.round(item.minutes/data.minutes*100):0}%)</small></span></div><div class="detailStatTrack"><div class="detailStatFill" style="width:${item.minutes/max*100}%;background:var(--trainingAccent)"></div></div><div class="trainingExerciseMeta"><span>${item.count}件</span><span>${item.sets}セット</span><span>${item.reps}回</span>${item.holdSeconds?`<span>時間式 ${item.holdSeconds}秒</span>`:''}${item.loadCount?`<span>平均負荷 ${(item.loadTotal/item.loadCount).toFixed(1)}kg</span>`:''}</div></div>`).join('')}`;
}
