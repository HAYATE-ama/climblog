import {escapeHtml as esc} from './data-utils.mjs';
// Names are persisted as labels; existing names must remain unchanged.
export const exerciseGroups=Object.freeze([
 {id:'training',label:'トレーニング',names:['ハングボード（通常）','加重懸垂（通常）','自重懸垂','キャンパスボード','体幹トレーニング','肩・拮抗筋の補強','クライミング持久力','有酸素トレーニング','柔軟・モビリティ','ムーブ練習','全身筋力トレーニング','片手リフト（地面から）','その他']},
 {id:'warmup',label:'ウォームアップ',names:['ウォームアップ（全身）','肩甲骨のウォームアップ','指・手首のウォームアップ','軽いクライミング']},
 {id:'band',label:'ゴムバンド',names:['バンドプルアパート','バンド外旋（肩）','バンド内旋（肩）','バンドロー','バンドフェイスプル','バンドプレスダウン']}
].map(group=>Object.freeze({...group,names:Object.freeze(group.names)})));
export const trainingExerciseNames=Object.freeze(exerciseGroups.flatMap(group=>group.names));
export function exerciseOptionsMarkup(selected='ハングボード（通常）'){
 const groups=trainingExerciseNames.includes(selected)||!selected?exerciseGroups:[...exerciseGroups,{label:'保存済みの種目',names:[String(selected)]}];
 return groups.map(group=>`<optgroup label="${esc(group.label)}">${group.names.map(name=>`<option${name===selected?' selected':''}>${esc(name)}</option>`).join('')}</optgroup>`).join('');
}
