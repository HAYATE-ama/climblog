import {outdoorProblemKey,isOutdoorSend,seasonDate} from './outdoor-season.mjs';

const newestFirst=(a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.createdAt||'').localeCompare(String(a.createdAt||''))||String(b.id||'').localeCompare(String(a.id||''));
const normalize=value=>String(value||'').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g,' ');

// A read-only projection. Saved wishes, records and photo links remain their own sources of truth.
export function outdoorRouteLibrary({records=[],outdoorWishlist=[],outdoorTopos=[]}={}){
 const groups=new Map(),wishesByKey=new Map(),wishesById=new Map(),recordKeys=new Map();let unnamedRecords=0;
 const ensure=(key,source)=>{if(!groups.has(key))groups.set(key,{key,source,wish:null,records:[],topos:[]});return groups.get(key);};
 for(const wish of outdoorWishlist){const key=outdoorProblemKey(wish);if(!key)continue;wishesByKey.set(key,wish);wishesById.set(wish.id,wish);ensure(key,wish).wish=wish;}
 for(const row of records){
  if(row.kind!=='outdoor')continue;const rawKey=outdoorProblemKey(row);if(!rawKey){unnamedRecords++;continue;}
  let wish=wishesByKey.get(rawKey);
  if(!wish&&row.outdoorWishId){const linked=wishesById.get(row.outdoorWishId);if(linked&&!linked.areaName&&outdoorProblemKey({...row,areaName:''})===outdoorProblemKey(linked))wish=linked;}
  const key=wish?outdoorProblemKey(wish):rawKey;recordKeys.set(rawKey,key);ensure(key,wish||row).records.push(row);
 }
 for(const topo of outdoorTopos){const rawKey=outdoorProblemKey(topo.problem||{});if(!rawKey)continue;ensure(recordKeys.get(rawKey)||rawKey,topo.problem).topos.push(topo);}
 const routes=[...groups.values()].map(group=>{
  const rows=[...group.records].sort(newestFirst),latest=rows[0]||null,gradeSource=rows.find(r=>r.outdoorGrade||r.grade)||group.wish||group.source;
  const source=group.wish||latest||group.source;
  const problem={cragName:source.cragName||source.place,areaName:source.areaName||'',routeName:source.routeName,discipline:source.discipline||'boulder',gradeSystem:gradeSource.gradeSystem||'',outdoorGrade:gradeSource.outdoorGrade??gradeSource.grade??''};
  const done=rows.some(isOutdoorSend),attempted=rows.some(r=>r.result==='attempt'||Number(r.tries)>0);
  return {...group,problem,records:rows,latest,status:done?'sent':attempted?'trying':rows.length?'recorded':'new',
   days:new Set(rows.filter(r=>seasonDate(r.date)).map(r=>r.date)).size,
   sendDays:new Set(rows.filter(r=>isOutdoorSend(r)&&seasonDate(r.date)).map(r=>r.date)).size};
 }).sort((a,b)=>Number(Boolean(b.wish?.starred))-Number(Boolean(a.wish?.starred))||newestFirst(a.latest||{},b.latest||{})||a.problem.cragName.localeCompare(b.problem.cragName,'ja')||a.problem.routeName.localeCompare(b.problem.routeName,'ja'));
 return {routes,unnamedRecords};
}

export function filterOutdoorRoutes(routes,{crag='',status='all',query=''}={}){
 const terms=normalize(query).split(' ').filter(Boolean);
 return routes.filter(route=>(!crag||normalize(route.problem.cragName)===normalize(crag))&&
  (status==='all'||status==='wish'&&route.wish||status===route.status)&&
  terms.every(term=>normalize([route.problem.cragName,route.problem.areaName,route.problem.routeName,route.problem.outdoorGrade].join(' ')).includes(term)));
}
