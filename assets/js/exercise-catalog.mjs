import {exerciseGroups,resolveExercise} from './exercise-registry.mjs';
import {escapeHtml as esc} from './data-utils.mjs';
// Names are persisted as labels; existing names must remain unchanged.
export {exerciseGroups} from './exercise-registry.mjs';
export const trainingExerciseNames=Object.freeze(exerciseGroups.flatMap(group=>group.names));
const identity=name=>String(name).normalize('NFKC').trim().toLocaleLowerCase();
export function addCustomExercise(rows,name,mode='reps',id=crypto.randomUUID()){
 const value=String(name??'').trim();if(!value||value.length>100||/[\u0000-\u001f]/.test(value)||!['time','reps'].includes(mode))throw new Error('種目名は1〜100文字で入力してください。');
 if(resolveExercise(value)||trainingExerciseNames.some(n=>identity(n)===identity(value))||(rows||[]).some(r=>identity(r.name)===identity(value)))throw new Error('同じ種目名が登録済みです。種目の一覧から選択してください。');
 if(rows.length>=200)throw new Error('自分の種目は200件までです。');return [...rows,{id,name:value,mode}];
}
export function preferredExerciseMode(name,custom=[]){return custom.find(r=>r.name===name)?.mode||resolveExercise(name)?.definition.defaultMode||null;}
export function exerciseOptionsMarkup(selected='ハングボード（通常）',custom=[]){
 const seen=new Set(trainingExerciseNames.map(identity)),names=[];for(const row of custom){if(typeof row?.name!=='string'||!row.name.trim()||row.name.length>100||seen.has(identity(row.name)))continue;seen.add(identity(row.name));names.push(row.name);}
 const groups=[...exerciseGroups,...(names.length?[{label:'自分の種目',names}]:[])];if(selected&&!groups.some(g=>g.names.includes(selected)))groups.push({label:'保存済みの種目',names:[String(selected)]});
 return groups.map(group=>`<optgroup label="${esc(group.label)}">${group.names.map(name=>`<option${name===selected?' selected':''}>${esc(name)}</option>`).join('')}</optgroup>`).join('');
}
