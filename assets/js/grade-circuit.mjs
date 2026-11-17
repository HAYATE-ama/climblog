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
  const session={version:1,id:newId(),date:validateRecordDate(date),gym,grade,swatch,total:circuitTotal(total),routes:[]};
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
    const route={kind,mark,wall:location,tries:0,sent:false},key=identity(route);
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
  return s.routes.reduce((a,r)=>({sends:a.sends+Number(r.sent),tries:a.tries+r.tries}),{sends:0,tries:0});
}
export function recordCircuitTry(s,index,sent){
  const r=s.routes[index];
  if(!r||r.sent)throw new Error('未完登の課題を選んでください。');
  s.undo={index,tries:r.tries,sent:r.sent};
  r.tries++;r.sent=sent;
}
export function undoCircuitTry(s){
  if(!s.undo)return;
  const {index,tries,sent}=s.undo;Object.assign(s.routes[index],{tries,sent});delete s.undo;
}

export function parseCircuitDraft(raw){
  const s=JSON.parse(raw);
  if(s?.version!==1||typeof s.id!=='string'||!s.id||typeof s.gym!=='string'||!s.gym||typeof s.grade!=='string'||!s.grade||!Array.isArray(s.routes)||s.routes.length>maxRoutes)throw new Error('下書きの形式を確認できません。');
  validateRecordDate(s.date);s.total=circuitTotal(s.total);
  if((s.total!==null&&s.routes.length>s.total)||s.routes.some(r=>!validCircuitMark(r)||!Number.isSafeInteger(r.tries)||r.tries<0||typeof r.sent!=='boolean'||(r.sent&&!r.tries))||new Set(s.routes.map(identity)).size!==s.routes.length)throw new Error('下書きの課題を確認できません。');
  if(s.undo&&(!s.routes[s.undo.index]||s.undo.tries!==s.routes[s.undo.index].tries-1||s.undo.sent!==false))delete s.undo;
  return s;
}

// One ordinary gym record per attempted problem. Stable IDs also cover a retry
// after a successful account write but before the local draft could be removed.
export function circuitRecords(s,now=new Date().toISOString()){
  return s.routes.flatMap((r,i)=>r.tries?[{
    id:'circuit-'+s.id+'-'+i,date:s.date,kind:'gym',gymName:s.gym,place:s.gym,grade:s.grade,
    gradeLabelSnapshot:s.grade,swatch:s.swatch,colorSnapshot:s.swatch,tries:r.tries,sends:Number(r.sent),
    gymOutcome:r.sent?'completed':'failed',memo:circuitLabel(r),batchSessionId:s.id,recordSource:'manual',
    circuitRoute:{kind:r.kind,mark:r.mark,wall:r.wall},circuitTotal:s.total,
    createdAt:now,updatedAt:now
  }]:[]);
}
