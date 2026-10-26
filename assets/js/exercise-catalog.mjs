import {escapeHtml as esc} from './data-utils.mjs';
// Names are persisted as labels; existing names must remain unchanged.
export const exerciseGroups=Object.freeze([
 {id:'training',label:'トレーニング',names:['ハングボード（通常）','加重懸垂（通常）','自重懸垂','キャンパスボード','体幹トレーニング','肩・拮抗筋の補強','クライミング持久力','有酸素トレーニング','柔軟・モビリティ','ムーブ練習','全身筋力トレーニング','片手リフト（地面から）','プランク','サイドプランク','スクワット','ランジ','腕立て伏せ','ヒップリフト','その他']},
 {id:'stretch',label:'柔軟・モビリティ',names:['ハムストリングのストレッチ','股関節のストレッチ','内転筋のストレッチ','臀部のストレッチ','ふくらはぎのストレッチ','肩・胸のストレッチ','広背筋のストレッチ','前腕・手首のストレッチ','足首のモビリティ','胸椎のモビリティ']},
 {id:'guided',label:'コースの種目',names:['バードドッグ','片膝立ちの股関節前面ストレッチ','バタフライストレッチ（合せき）','仰向けフィギュアフォー','カーフストレッチ','ドアウェイ・チェストストレッチ','チャイルドポーズ','オープンブック','手首の屈筋ストレッチ','手首の伸筋ストレッチ','その場足踏み','アームサークル','レッグスイング','手首回し']},
 {id:'warmup',label:'ウォームアップ',names:['ウォームアップ（全身）','肩甲骨のウォームアップ','指・手首のウォームアップ','軽いクライミング']},
 {id:'band',label:'ゴムバンド',names:['バンドプルアパート','バンド外旋（肩）','バンド内旋（肩）','バンドロー','バンドフェイスプル','バンドプレスダウン']}
].map(group=>Object.freeze({...group,names:Object.freeze(group.names)})));
export const trainingExerciseNames=Object.freeze(exerciseGroups.flatMap(group=>group.names));
const identity=name=>String(name).normalize('NFKC').trim().toLocaleLowerCase();
export function addCustomExercise(rows,name,mode='reps',id=crypto.randomUUID()){
 const value=String(name??'').trim();if(!value||value.length>100||/[\u0000-\u001f]/.test(value)||!['time','reps'].includes(mode))throw new Error('種目名は1〜100文字で入力してください。');
 if(trainingExerciseNames.some(n=>identity(n)===identity(value))||(rows||[]).some(r=>identity(r.name)===identity(value)))throw new Error('同じ種目名が登録済みです。種目の一覧から選択してください。');
 if(rows.length>=200)throw new Error('自分の種目は200件までです。');return [...rows,{id,name:value,mode}];
}
export function preferredExerciseMode(name,custom=[]){if(exerciseGroups.find(g=>g.id==='stretch').names.includes(name)||['プランク','サイドプランク'].includes(name))return 'time';return custom.find(r=>r.name===name)?.mode||null;}
export function exerciseOptionsMarkup(selected='ハングボード（通常）',custom=[]){
 const seen=new Set(trainingExerciseNames.map(identity)),names=[];for(const row of custom){if(typeof row?.name!=='string'||!row.name.trim()||row.name.length>100||seen.has(identity(row.name)))continue;seen.add(identity(row.name));names.push(row.name);}
 const groups=[...exerciseGroups,...(names.length?[{label:'自分の種目',names}]:[])];if(selected&&!groups.some(g=>g.names.includes(selected)))groups.push({label:'保存済みの種目',names:[String(selected)]});
 return groups.map(group=>`<optgroup label="${esc(group.label)}">${group.names.map(name=>`<option${name===selected?' selected':''}>${esc(name)}</option>`).join('')}</optgroup>`).join('');
}
