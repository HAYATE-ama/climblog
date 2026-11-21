import {outdoorProblemKey} from './outdoor-season.mjs';
import {wishFromRoute,validateWish} from './outdoor-wishlist-model.mjs';

export const emptyMarks=()=>({line:[],start:null,goal:null,note:''});
const copy=value=>structuredClone(value);
export const validPhotoId=id=>typeof id==='string'&&/^photo-[a-f0-9]{64}$/.test(id);
function point(p){return Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1);}
export function validateMarks(m){
 if(!m||!Array.isArray(m.line)||m.line.length>300||m.line.some(p=>!point(p))||![m.start,m.goal].every(p=>p===null||point(p))||typeof m.note!=='string'||m.note.length>1000)throw new Error('写真のマーク・メモの形式を確認してください。');
 return {line:copy(m.line),start:copy(m.start),goal:copy(m.goal),note:m.note};
}
export function validateTopos(rows){
 if(!Array.isArray(rows))throw new Error('課題の写真一覧を読み込めません。');
 const ids=new Set(),links=new Set();
 for(const row of rows){
  if(!row||typeof row.id!=='string'||!/^[a-z0-9_:.-]{1,160}$/i.test(row.id)||ids.has(row.id)||row.version!==1||!validPhotoId(row.photoId))throw new Error('課題の写真ID・版を確認してください。');
  validateWish(row.problem);validateMarks(row.marks);
  for(const field of ['createdAt','updatedAt'])if(typeof row[field]!=='string'||!Number.isFinite(Date.parse(row[field])))throw new Error('課題の写真の保存日時を確認してください。');
  const key=topoLinkKey(row);if(links.has(key))throw new Error('同じ課題と写真の紐付けが重複しています。');ids.add(row.id);links.add(key);
 }
 return rows;
}
export const topoLinkKey=row=>JSON.stringify([outdoorProblemKey(row.problem),row.photoId]);
export function problemForTopo(source){const p={...wishFromRoute(source),starred:false};validateWish(p);return p;}
export function toposForProblem(rows,source){const key=outdoorProblemKey(source);return key?rows.filter(r=>outdoorProblemKey(r.problem)===key):[];}
export function createTopo(problem,photoId){const now=new Date().toISOString();return {id:'topo-'+crypto.randomUUID(),version:1,photoId,problem:problemForTopo(problem),marks:emptyMarks(),createdAt:now,updatedAt:now};}
// One completed pointer gesture or note edit is one undoable operation.
export function createMarkHistory(initial=emptyMarks()){
 let value=validateMarks(initial),past=[],future=[];
 return {
  get:()=>copy(value),canUndo:()=>past.length>0,canRedo:()=>future.length>0,
  change(next){next=validateMarks(next);if(JSON.stringify(next)===JSON.stringify(value))return false;past.push(value);if(past.length>100)past.shift();value=next;future=[];return true;},
  undo(){if(past.length){future.push(value);value=past.pop();}return copy(value);},
  redo(){if(future.length){past.push(value);value=future.pop();}return copy(value);}
 };
}
