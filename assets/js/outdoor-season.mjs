// Derive season totals from records; never rewrite historical records.
export function seasonDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;}
export const displaySeasonDate=v=>v.replaceAll('-','/');
export function validateOutdoorSeason(raw){if(!raw||!seasonDate(raw.from)||!seasonDate(raw.to)||raw.from>raw.to||Number(raw.from.slice(0,4))<1900||Number(raw.to.slice(0,4))>2200)throw new Error('開始日と終了日を確認してください。終了日は開始日以降にしてください。');if(raw.name!=null&&(typeof raw.name!=='string'||raw.name.length>60))throw new Error('シーズン名は60文字以内で入力してください。');return {name:(raw.name||'').trim(),from:raw.from,to:raw.to};}
export function savedOutdoorSeason(preferences){try{return validateOutdoorSeason(preferences?.outdoorSeason);}catch{return null;}}
export function outdoorSeasonRange(raw){const s=validateOutdoorSeason(raw);return {...s,label:(s.name?s.name+' · ':'')+displaySeasonDate(s.from)+' 〜 '+displaySeasonDate(s.to)};}
export const isOutdoorSend=r=>r?.kind==='outdoor'&&['send','flash','onsight','redpoint'].includes(r.result);
const chronological=(a,b)=>a.date.localeCompare(b.date)||String(a.createdAt||'').localeCompare(String(b.createdAt||''))||String(a.id||'').localeCompare(String(b.id||''));
const name=v=>typeof v==='string'?v.normalize('NFKC').trim().replace(/\s+/g,' '):'';
export function outdoorProblemKey(r){const crag=name(r.cragName||r.place),route=name(r.routeName);return crag&&crag!=='未設定'&&route?JSON.stringify([crag,name(r.areaName),route,r.discipline||'boulder']):null;}
export function danValue(r){if(r.discipline&&r.discipline!=='boulder'||r.gradeSystem&&r.gradeSystem!=='日本（段級）')return null;const grade=name(r.outdoorGrade||r.grade),jp=['初','二','三','四','五','六','七','八','九','十'];const i=jp.findIndex(v=>grade===v+'段');if(i>=0)return i+1;const m=grade.match(/^([1-9]|10)段$/);return m?Number(m[1]):null;}
export function classifyOutdoorSends(records){const seen=new Set(),result=new Map();const sends=(records||[]).filter(r=>isOutdoorSend(r)&&seasonDate(r.date)).sort(chronological);
 for(const r of sends){const key=outdoorProblemKey(r),explicit=['new','repeat'].includes(r.ascentType),type=explicit?r.ascentType:key?(seen.has(key)?'repeat':'new'):'unknown';result.set(r.id,{type,inferred:!explicit,key});if(key)seen.add(key);}
 return result;
}
export function outdoorDanSummary(records,range){const classification=classifyOutdoorSends(records),newKeys=new Set(),repeatDays=new Set(),completeDays=new Set();let newDan=0,repeatDan=0,newProblems=0,repeatAscents=0,unknown=0,inferred=0,ungraded=0,duplicateNew=0;const entries=[];
 for(const r of (records||[]).filter(r=>isOutdoorSend(r)&&seasonDate(r.date)&&r.date>=range.from&&r.date<=range.to).sort(chronological)){
  const c=classification.get(r.id),dan=danValue(r),key=c.key||'record:'+r.id;let counted=false;const dayKey=JSON.stringify([key,r.date]),duplicate=completeDays.has(dayKey);completeDays.add(dayKey);
  if(duplicate){entries.push({id:r.id,...c,dan,counted:false,duplicate:true});continue;}
  if(c.type==='unknown')unknown++;else if(c.type==='new'){if(newKeys.has(key))duplicateNew++;else{newKeys.add(key);newProblems++;if(dan!=null){newDan+=dan;counted=true;}}}else{const daily=JSON.stringify([key,r.date]);if(!repeatDays.has(daily)){repeatDays.add(daily);repeatAscents++;if(dan!=null){repeatDan+=dan;counted=true;}}}
  if(c.inferred)inferred++;if(dan==null)ungraded++;entries.push({id:r.id,...c,dan,counted});
 }
 return {newDan,repeatDan,newProblems,repeatAscents,unknown,inferred,ungraded,duplicateNew,entries};
}
export function seasonMonthBuckets(rows,range){const buckets=new Map();let year=Number(range.from.slice(0,4)),month=Number(range.from.slice(5,7));const end=range.to.slice(0,7);for(let i=0;i<3613;i++){const key=year+'-'+String(month).padStart(2,'0');if(key>end)break;buckets.set(key,{label:year+'/'+String(month).padStart(2,'0'),value:0});if(++month>12){month=1;year++;}}for(const r of rows){const b=buckets.get(r.date.slice(0,7));if(b)b.value++;}return [...buckets.values()];}
