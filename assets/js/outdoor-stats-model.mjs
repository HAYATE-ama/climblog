import {outdoorGradeGroup,compareOutdoorGrades} from './outdoor-grades.mjs';
import {japaneseGradeKey} from './japanese-boulder-grades.mjs';
import {seasonMonthBuckets} from './outdoor-season.mjs';

const normalize=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ');
function gradeIdentity(row){
 const system=outdoorGradeGroup(row),raw=normalize(row.outdoorGrade||row.grade);
 const label=system==='グレード未設定'?'未設定':system==='日本（段級）'?japaneseGradeKey(raw):raw;
 const discipline=row.discipline||(['French','UIAA','YDS / デシマル'].includes(system)?'lead':'boulder');
 return {system,label,discipline,key:JSON.stringify([discipline,system,label])};
}
function bucket(key,label){return {key,label,fresh:0,repeat:0,total:0,ids:[]};}
function add(group,row,type){group[type==='repeat'?'repeat':'fresh']++;group.total++;group.ids.push(row.id);}

// The same accepted ascents drive the hero, every chart and its detail records.
// Grade aliases are normalized only for display grouping; saved records are never rewritten.
export function buildOutdoorCharts(rows,range,dan,today){
 const byId=new Map(rows.map(row=>[row.id,row])),grades=new Map(),crags=new Map();
 const months=seasonMonthBuckets([],range).map(b=>({...bucket(b.label.replace('/','-'),b.label),future:b.label.replace('/','-')>today.slice(0,7)}));
 const byMonth=new Map(months.map(b=>[b.key,b]));let highest=null,accepted=0;
 for(const entry of dan.entries){
  if(!entry.included)continue;
  const row=byId.get(entry.id);if(!row)continue;accepted++;
  const identity=gradeIdentity(row);
  if(!grades.has(identity.key))grades.set(identity.key,{...bucket(identity.key,identity.label),...identity,example:row});
  add(grades.get(identity.key),row,entry.type);
  const crag=normalize(row.cragName||row.place)||'岩場未設定';
  if(!crags.has(crag))crags.set(crag,bucket(crag,crag));add(crags.get(crag),row,entry.type);
  add(byMonth.get(row.date.slice(0,7)),row,entry.type);
  if(entry.dan!=null&&(!highest||compareOutdoorGrades(highest,row)<0))highest=row;
 }
 const gradeRows=[...grades.values()].sort((a,b)=>a.system.localeCompare(b.system,'ja')||a.discipline.localeCompare(b.discipline)||compareOutdoorGrades(b.example,a.example));
 const systems=[...new Set(gradeRows.map(b=>JSON.stringify([b.discipline,b.system])))].sort((a,b)=>(a.includes('日本（段級）')?-1:0)-(b.includes('日本（段級）')?-1:0)||a.localeCompare(b,'ja'));
 const cragRows=[...crags.values()].sort((a,b)=>b.total-a.total||a.label.localeCompare(b.label,'ja'));
 const rings=cragRows.length<=6?cragRows:cragRows.slice(0,5).concat(cragRows.slice(5).reduce((all,g)=>({key:'other',label:'その他 '+(cragRows.length-5)+'岩場',fresh:all.fresh+g.fresh,repeat:all.repeat+g.repeat,total:all.total+g.total,ids:all.ids.concat(g.ids)}),bucket('other','')));
 const visibleMonth=Math.max(0,months.findLastIndex(b=>b.key<=today.slice(0,7)));
 return {grades:gradeRows,systems,months,crags:rings,total:accepted,excluded:dan.entries.length-accepted,highest:highest?gradeIdentity(highest).label:null,monthPage:Math.floor(visibleMonth/6)};
}

export function chartCeiling(values){const max=Math.max(1,...values);const base=10**Math.floor(Math.log10(max/4));const step=[1,2,2.5,5,10].map(n=>n*base).find(n=>n>=max/4);return Math.max(4,Math.ceil(step)*4);}
