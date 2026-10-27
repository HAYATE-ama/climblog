import {trainingVolume} from './training-model.mjs';
import { calculateTotalLoad, getBodyWeightForDate } from './features.mjs';

export function findPreviousRecords(records,{kind,date,gymName,trainingMode='routine',maxType,liftHand}){
  const candidates=records.filter(row=>row.kind===kind&&row.date<date&&(kind!=='gym'||!gymName||(row.gymName||row.place)===gymName)&&(kind!=='training'||(row.trainingMode||'routine')===trainingMode)&&(kind!=='training'||trainingMode!=='maxTest'||(!maxType||row.maxType===maxType)&&(!liftHand||maxType!=='singleHandLift'||row.liftHand===liftHand)));
  const lastDate=candidates.map(row=>row.date).sort().at(-1);
  const rows=candidates.filter(row=>row.date===lastDate);
  return (kind==='training'&&trainingMode==='maxTest'?rows.slice(-1):rows).map(row=>({...row}));
}

export function copyRecordForDate(record,date,weightHistory){
  const {id,date:oldDate,batchSessionId,createdAt,updatedAt,workoutSessionId,workoutTitle,workoutStartedAt,workoutFinishedAt,sessionSetResults,feedbackScope,...values}=record;
  values.recordSource='copy';
  if(values.kind==='gym')values.gymOutcome=values.gymOutcome||'completed';
  if(values.kind==='training'){
    values.trainingMode=values.trainingMode||'routine';
    values.rpe=0;
    values.bodyweightKg=getBodyWeightForDate(weightHistory,date);
    if(values.trainingMode==='maxTest')values.totalLoadKg=values.maxType==='singleHandLift'?Number(values.addedWeightKg):calculateTotalLoad(values.addedWeightKg,values.bodyweightKg);
  }
  return structuredClone(values);
}

export function groupDayRecords(records){
  const groups=[],byKey=new Map();
  for(const row of records){
    if(row.kind==='outdoor'){groups.push({key:`outdoor:${row.id}`,kind:'outdoor',records:[row]});continue;}
    const key=JSON.stringify([row.date,row.kind,row.kind==='gym'?(row.gymName||row.place):'']);
    if(!byKey.has(key)){const group={key,kind:row.kind,records:[]};byKey.set(key,group);groups.push(group);}
    byKey.get(key).records.push(row);
  }
  return groups.map(group=>{
    const routine=group.records.filter(row=>row.kind==='training'&&row.trainingMode!=='maxTest');
    return {...group,sets:routine.reduce((n,row)=>n+trainingVolume(row).sets,0),minutes:routine.reduce((n,row)=>n+(Number(row.durationMinutes)||0),0),reps:routine.reduce((n,row)=>n+trainingVolume(row).reps,0),routineCount:routine.length,measurementCount:group.records.filter(row=>row.trainingMode==='maxTest').length,sends:group.records.reduce((n,row)=>n+(Number(row.sends)||0),0),tries:group.records.reduce((n,row)=>n+(Number(row.tries)||0),0),failures:group.records.filter(row=>row.gymOutcome==='failed').length};
  });
}
