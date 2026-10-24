export function maxConditionKey(record,includeHand=true){
  const finger=record.maxType!=='weightedPullup';
  return [record.maxType,finger?(record.gripType||'unknown'):'',finger?(record.edgeDepthMm||'unknown'):'',record.maxType==='hangboard'?(record.holdSeconds||'unknown'):'',includeHand&&record.maxType==='singleHandLift'?(record.liftHand||'unknown'):''].join('|');
}
export function measurementValue(record){
  const added=Number(record.addedWeightKg),body=Number(record.bodyweightKg),total=Number(record.totalLoadKg);
  if(record.maxType==='singleHandLift')return {valueKg:added,metricBasis:'lift'};
  if(record.totalLoadKg!=null&&record.totalLoadKg!==''&&Number.isFinite(total)&&total>0)return {valueKg:total,metricBasis:'total'};
  if(Number.isFinite(body)&&body>0)return {valueKg:added+body,metricBasis:'total'};
  return {valueKg:added,metricBasis:'external'};
}
export function getLiftHandComparisons(records){
  const groups=new Map();
  for(const row of records){
    if(row.trainingMode!=='maxTest'||row.maxType!=='singleHandLift'||!row.gripType||!(Number(row.edgeDepthMm)>0)||!['left','right'].includes(row.liftHand)||row.addedWeightKg==null||row.addedWeightKg===''||!Number.isFinite(Number(row.addedWeightKg))||Number(row.addedWeightKg)<0)continue;
    const key=`${maxConditionKey(row,false)}|${row.date}`;
    if(!groups.has(key))groups.set(key,{key,date:row.date,condition:row,leftKg:null,rightKg:null});
    const pair=groups.get(key),hand=`${row.liftHand}Kg`;pair[hand]=Math.max(pair[hand]??0,Number(row.addedWeightKg));
  }
  return [...groups.values()].map(pair=>{const both=pair.leftKg!=null&&pair.rightKg!=null,peak=Math.max(pair.leftKg??0,pair.rightKg??0);return {...pair,differenceKg:both?Math.abs(pair.leftKg-pair.rightKg):null,differencePercent:both&&peak>0?Math.abs(pair.leftKg-pair.rightKg)/peak*100:null};}).sort((a,b)=>b.date.localeCompare(a.date));
}
