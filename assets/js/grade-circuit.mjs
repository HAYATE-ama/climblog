import {newId} from './data-utils.mjs';
import {validateRecordDate} from './history-model.mjs';

export const maxRoutes=300;
export const tapeShapes=[['×','バツ'],['＋','プラス'],['｜','縦線'],['Ｔ','T字']];
const clean=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/gu,' ');
const identity=route=>JSON.stringify([route.kind,clean(route.mark),clean(route.wall)]);

export function circuitNumbers(text){
  const parts=clean(text).replace(/\s*[-〜~–]\s*/gu,'-').split(/[、,\s]+/u).filter(Boolean);
  const numbers=new Set();
  for(const part of parts){
    if(!/^\d{1,3}(-\d{1,3})?$/.test(part))throw new Error('番号は1〜999で入力してください。複数は「3、8」、連番は「1-12」です。');
    const [start,end=start]=part.split('-').map(Number);
    if(start<1||end<start||end-start+1>maxRoutes)throw new Error('連番の範囲を確認してください。');
    for(let n=start;n<=end;n++)numbers.add(String(n));
    if(numbers.size>maxRoutes)throw new Error('1回のサーキットは300課題までです。');
  }
  if(!numbers.size)throw new Error('課題番号を入力してください。');
  return [...numbers];
}

export function circuitTotal(value){
  if(value==null||value==='')return null;
  const total=Number(value);
  if(!Number.isInteger(total)||total<1||total>maxRoutes)throw new Error('総課題数は1〜300で入力するか、空欄にしてください。');
  return total;
}

export function createCircuit({date,gym,grade,swatch,total,numbered}){
  if(!gym?.trim()||!grade?.trim())throw new Error('ジムとグレードを選んでください。');
  const session={version:2,id:newId(),date:validateRecordDate(date),gym,grade,swatch,total:circuitTotal(total),routes:[]};
  if(numbered&&session.total)addCircuitRoutes(session,'number',circuitNumbers('1-'+session.total),'');
  return session;
}

export function addCircuitRoutes(session,kind,marks,wall){
  if(!['number','tape'].includes(kind))throw new Error('課題の目印を選んでください。');
  const location=clean(wall),known=new Map(session.routes.map((r,i)=>[identity(r),i])),fresh=[];
  let first;
  for(const input of marks){
    let mark=clean(input);
    if(kind==='tape')mark=tapeShapes.find(([symbol])=>clean(symbol)===mark)?.[0]??mark;
    if(!mark||mark.length>32||location.length>60)throw new Error('課題の目印と壁・位置を確認してください。');
    const route={kind,mark,wall:location,tries:0,sends:0},key=identity(route);
    if(!known.has(key)){known.set(key,session.routes.length+fresh.length);fresh.push(route);}
    first??=known.get(key);
  }
  const count=session.routes.length+fresh.length;
  if(count>maxRoutes)throw new Error('1回のサーキットは300課題までです。');
  if(session.total!==null&&count>session.total)throw new Error('登録数が総課題数を超えます。「総課題数を変更」で調整してください。');
  session.routes.push(...fresh);
  return {selected:first,added:fresh.length};
}

export function circuitLabel(r){
  const mark=r.kind==='number'?r.mark+'番':r.mark;
  return [r.wall,mark].filter(Boolean).join(' · ');
}
export function validCircuitMark(r){
  return Boolean(r&&typeof r.wall==='string'&&r.wall.length<=60&&typeof r.mark==='string'&&
    (r.kind==='number'?/^[1-9]\d{0,2}$/.test(r.mark):r.kind==='tape'&&r.mark.trim().length>0&&r.mark.length<=32));
}
export function circuitStats(s){
  return s.routes.reduce((a,r)=>({sends:a.sends+r.sends,tries:a.tries+r.tries,completed:a.completed+Number(r.sends>0),falls:a.falls+r.tries-r.sends}),{sends:0,tries:0,completed:0,falls:0});
}
export function recordCircuitTry(s,index,sent,now=Date.now()){
  const r=s.routes[index];
  if(!r||typeof sent!=='boolean')throw new Error('課題を選んでください。');
  if(!Number.isSafeInteger(r.tries+1))throw new Error('記録できる回数を超えました。ここまでで終了して保存してください。');
  if(s.timing){
    if(s.timing.phase!=='climb'||s.timing.paused||s.timing.ended||s.timing.routeIndex!==index)throw new Error('この課題のトライを開始してください。');
    settleCircuitClock(s,now);
  }
  s.undo={index,tries:r.tries,sends:r.sends,...(s.timing?{timing:structuredClone(s.timing)}:{})};
  r.tries++;if(sent)r.sends++;
  if(s.timing){
    const t=s.timing,round=s.total!==null&&s.routes.length===s.total?Math.min(...s.routes.map(v=>v.sends)):0;
    if(round===t.milestones.length+1)t.milestones.push({round,climbMs:t.climbMs,restMs:t.restMs});
    else if(round>t.milestones.length)t.incomplete=true;
    t.phase='rest';t.phaseMs=0;t.routeIndex=null;
  }
}
export function undoCircuitTry(s,now=Date.now()){
  if(!s.undo)return;
  if(s.timing){
    if(s.timing.phase==='climb')throw new Error('実施中のトライの結果を先に確定してください。');
    settleCircuitClock(s,now);
    if(s.undo.timing){
      const before=s.undo.timing,current=s.timing,extra=Math.max(0,current.climbMs+current.restMs-before.climbMs-before.restMs);
      s.timing={...structuredClone(before),at:now,climbMs:before.climbMs+extra,phaseMs:before.phaseMs+extra,pausedMs:current.pausedMs,interrupted:current.interrupted,clockIssue:current.clockIssue,paused:current.paused,ended:false};
    }else{s.timing.incomplete=true;s.timing.milestones=[];}
  }
  const {index,tries,sends}=s.undo;Object.assign(s.routes[index],{tries,sends});delete s.undo;
}

export function parseCircuitDraft(raw){
  const s=JSON.parse(raw);
  if(![1,2].includes(s?.version)||typeof s.id!=='string'||!s.id||typeof s.gym!=='string'||!s.gym||typeof s.grade!=='string'||!s.grade||!Array.isArray(s.routes)||s.routes.length>maxRoutes)throw new Error('下書きの形式を確認できません。');
  if(s.version===1){
    for(const r of s.routes){if(typeof r?.sent!=='boolean')throw new Error('下書きの課題を確認できません。');r.sends=Number(r.sent);delete r.sent;}
    if(s.undo){if(typeof s.undo.sent==='boolean')s.undo.sends=Number(s.undo.sent);delete s.undo.sent;}
    s.version=2;
  }
  validateRecordDate(s.date);s.total=circuitTotal(s.total);
  if((s.total!==null&&s.routes.length>s.total)||s.routes.some(r=>!validCircuitMark(r)||!Number.isSafeInteger(r.tries)||r.tries<0||!Number.isSafeInteger(r.sends)||r.sends<0||r.sends>r.tries)||new Set(s.routes.map(identity)).size!==s.routes.length)throw new Error('下書きの課題を確認できません。');
  if(s.undo){const u=s.undo,r=s.routes[u.index];if(!r||!Number.isSafeInteger(u.index)||u.tries!==r.tries-1||!Number.isSafeInteger(u.sends)||u.sends<0||u.sends>u.tries||![0,1].includes(r.sends-u.sends))delete s.undo;}
  if(s.memo!=null&&(typeof s.memo!=='string'||s.memo.length>2000))throw new Error('サーキットの備考を確認してください。');
  if(s.routes.some(r=>r.note!=null&&(typeof r.note!=='string'||r.note.length>1000)))throw new Error('課題の備考を確認してください。');
  if(s.setId!=null&&(typeof s.setId!=='string'||!s.setId||s.setId.length>100))throw new Error('課題セットを確認してください。');
  if(s.setName!=null&&(typeof s.setName!=='string'||s.setName.length>80))throw new Error('課題セット名を確認してください。');
  if(s.timing)validateCircuitTiming(s.timing,s.routes.length);
  if(s.undo?.timing)validateCircuitTiming(s.undo.timing,s.routes.length);
  return s;
}

// One ordinary gym record per attempted problem. Stable IDs also cover a retry
// after a successful account write but before the local draft could be removed.
export function circuitRecords(s,now=new Date().toISOString()){
  return s.routes.flatMap((r,i)=>r.tries?[{
    id:'circuit-'+s.id+'-'+i,date:s.date,kind:'gym',gymName:s.gym,place:s.gym,grade:s.grade,
    gradeLabelSnapshot:s.grade,swatch:s.swatch,colorSnapshot:s.swatch,tries:r.tries,sends:r.sends,
    gymOutcome:r.sends?'completed':'failed',memo:[circuitLabel(r),r.note].filter(Boolean).join('\n'),batchSessionId:s.id,recordSource:'manual',
    circuitRoute:{kind:r.kind,mark:r.mark,wall:r.wall},circuitTotal:s.total,
    createdAt:now,updatedAt:now
  }]:[]);
}

// Optional timing keeps v1/v2 drafts and old untimed records readable.
export function enableCircuitTiming(s,setName=''){
  s.setId||=newId();s.setName=setName.trim().slice(0,80)||s.setName||s.date+' のセット';s.memo||='';
  s.timing={version:1,phase:'ready',at:null,climbMs:0,restMs:0,phaseMs:0,pausedMs:0,paused:false,interrupted:false,incomplete:s.routes.some(r=>r.tries>0),clockIssue:false,ended:false,routeIndex:null,milestones:[]};
  delete s.undo;
}
export function validateCircuitTiming(t,count=300){
  const numeric=['climbMs','restMs','phaseMs','pausedMs'];
  if(!t||t.version!==1||!['ready','climb','rest'].includes(t.phase)||numeric.some(k=>!Number.isSafeInteger(t[k])||t[k]<0)||!['paused','interrupted','incomplete','clockIssue','ended'].every(k=>typeof t[k]==='boolean')||(t.at!==null&&(!Number.isSafeInteger(t.at)||t.at<0))||!Array.isArray(t.milestones)||t.milestones.length>10000)throw new Error('サーキットの計測データを確認してください。');
  if((t.phase==='ready')!==(t.at===null)||(t.phase==='climb'?(!Number.isInteger(t.routeIndex)||t.routeIndex<0||t.routeIndex>=count):t.routeIndex!==null))throw new Error('トライの計測状態を確認してください。');
  let prev={climbMs:0,restMs:0};
  for(const [i,m] of t.milestones.entries()){
    if(m?.round!==i+1||!Number.isSafeInteger(m.climbMs)||!Number.isSafeInteger(m.restMs)||m.climbMs<prev.climbMs||m.restMs<prev.restMs||m.climbMs>t.climbMs||m.restMs>t.restMs)throw new Error('全課題完登の計測データを確認してください。');prev=m;
  }
  return t;
}
export function circuitClock(s,now=Date.now()){
  if(!s.timing)return null;
  const t={...s.timing},gap=t.at===null?0:now-t.at;
  // A backwards clock or an unattended session longer than a day is not comparable.
  if(gap<0||gap>86400000)t.clockIssue=true;
  const elapsed=Math.max(0,Math.min(86400000,gap));
  if(t.phase!=='ready'&&!t.ended){if(t.paused)t.pausedMs+=elapsed;else{t[t.phase==='climb'?'climbMs':'restMs']+=elapsed;t.phaseMs+=elapsed;}}
  return {...t,totalMs:t.climbMs+t.restMs};
}
function settleCircuitClock(s,now){const {totalMs,...t}=circuitClock(s,now);s.timing={...t,at:t.phase==='ready'?null:now};}
export function startCircuitTry(s,index,now=Date.now()){
  if(!s.routes[index])throw new Error('課題を選んでください。');
  if(!s.timing)enableCircuitTiming(s);
  if(s.timing.phase==='climb'||s.timing.paused||s.timing.ended)throw new Error('計測を再開するか、現在のトライ結果を確定してください。');
  settleCircuitClock(s,now);Object.assign(s.timing,{phase:'climb',at:now,phaseMs:0,routeIndex:index});delete s.undo;
}
export function pauseCircuit(s,now=Date.now()){
  if(!s.timing||s.timing.phase==='ready'||s.timing.ended)return;
  settleCircuitClock(s,now);s.timing.paused=!s.timing.paused;s.timing.interrupted=true;
}
export function finishCircuit(s,now=Date.now()){
  if(!s.timing)return;
  settleCircuitClock(s,now);s.timing.ended=true;
  if(s.timing.phase==='climb')s.timing.incomplete=true;
}
export function resumeCircuit(s,now=Date.now()){
  if(!s.timing?.ended)return;
  // Review time is a separate interruption, never silently counted as rest.
  s.timing.pausedMs+=Math.max(0,now-(s.timing.at??now));s.timing.at=s.timing.phase==='ready'?null:now;s.timing.ended=false;s.timing.paused=false;s.timing.interrupted=true;
}
export function changeCircuitSet(s){
  s.setId=newId();
  if(s.timing&&s.timing.phase!=='ready'){s.timing.incomplete=true;s.timing.milestones=[];delete s.undo;}
}
export function repeatCircuit(source,date){
  const s=parseCircuitDraft(JSON.stringify(source));
  s.id=newId();s.date=validateRecordDate(date);s.routes=s.routes.map(r=>({...r,sends:0,tries:0,note:''}));s.memo='';enableCircuitTiming(s,s.setName);return s;
}
export function circuitSetKey(s){return JSON.stringify([s.gym,s.grade,s.setId||null,s.total,s.routes.map(identity).sort()]);}
const recordIdentity=r=>JSON.stringify([r.id,r.date,r.kind,r.gymName,r.grade,r.sends,r.tries,r.circuitRoute,r.memo]);
export function circuitHistory(state){
  const records=new Map((state.records||[]).map(r=>[r.id,r]));
  return (state.workoutReceipts||[]).filter(r=>r.circuitSession).flatMap(receipt=>{
    try{
      const s=parseCircuitDraft(JSON.stringify(receipt.circuitSession)),expected=circuitRecords(s),active=expected.filter(r=>records.has(r.id));
      if(!active.length)return [];
      const changed=active.length!==expected.length||expected.some(r=>recordIdentity(r)!==recordIdentity(records.get(r.id)||{}));
      return [{receipt,session:s,changed,comparable:!changed&&circuitComparable(s)}];
    }catch{return []}
  }).sort((a,b)=>b.session.date.localeCompare(a.session.date)||(b.receipt.savedAt||'').localeCompare(a.receipt.savedAt||''));
}
export function circuitComparable(s){const t=s.timing;return Boolean(s.setId&&t?.milestones[0]&&!t.interrupted&&!t.incomplete&&!t.clockIssue);}
export function prepareCircuitSave(state,session,now=Date.now()){
  const s=parseCircuitDraft(JSON.stringify(session)),id='circuit-'+s.id;
  if((state.workoutReceipts||[]).some(r=>r.id===id))return {alreadySaved:true,patch:{}};
  if(s.timing&&!s.timing.ended)throw new Error('終了して結果を確認してください。');
  const rows=circuitRecords(s,new Date(now).toISOString());if(!rows.length)throw new Error('実施したトライがありません。');
  const seen=new Set([...(state.records||[]).map(r=>r.id),...(state.recycleBin||[]).map(r=>r.record?.id)]);
  if(rows.some(r=>seen.has(r.id)))throw new Error('このサーキットは保存済みです。二重保存を中止しました。');
  delete s.undo;
  return {alreadySaved:false,recordIds:rows.map(r=>r.id),patch:{records:[...(state.records||[]),...rows],workoutReceipts:[...(state.workoutReceipts||[]),{id,date:s.date,savedAt:new Date(now).toISOString(),recordIds:rows.map(r=>r.id),circuitSession:s}]}};
}
export function circuitTime(ms){const sec=Math.floor(Math.max(0,ms||0)/1000),m=Math.floor(sec/60);return (m>=60?Math.floor(m/60)+':'+String(m%60).padStart(2,'0'):m)+':'+String(sec%60).padStart(2,'0');}
