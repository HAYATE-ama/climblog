import {resolveExercise,exerciseIdentity,exerciseRegistryVersion} from './exercise-registry.mjs';
import {normalizeWorkoutPlan} from './workout-model.mjs';
const row=(name,mode,target,sets=1,rest=20)=>{const match=resolveExercise(name);if(!match||match.definition.defaultMode!==mode)throw new Error('コースの種目定義が一致しません。');return {name,mode,target,sets,rest,...exerciseIdentity(name)};};
const sides=(name,mode,target,sets=1,rest=15)=>['左','右'].map(side=>row(name+'（'+side+'）',mode,target,sets,rest));
export const courseCategories=[['strength','筋トレ'],['mobility','柔軟'],['warmup','ウォーミングアップ']];
const courseRows=[
 {id:'finger-open',category:'strength',title:'指トレ・オープンハンド（足補助）',equipment:'ハングボード・両足で安定して支えられる環境',items:[row('足補助ハング（オープンハンド）','time',5,3,60)]},
 {id:'finger-half-crimp',category:'strength',title:'指トレ・ハーフクリンプ（足補助）',equipment:'ハングボード・両足で安定して支えられる環境',items:[row('足補助ハング（ハーフクリンプ）','time',5,3,60)]},
 {id:'core-control',category:'strength',title:'体幹・姿勢づくり',equipment:'マット',items:[row('プランク','time',30,2,30),...sides('サイドプランク','time',20),row('バードドッグ','reps',6,2,30),row('ヒップリフト','reps',10,2,30)]},
 {id:'pull-shoulder',category:'strength',title:'引く力・肩まわり',equipment:'懸垂バー・バンド・固定点',items:[row('自重懸垂','reps',5,2,60),row('バンドロー','reps',10,2,30),row('バンド外旋（肩）','reps',10,2,30),row('腕立て伏せ','reps',8,2,45)]},
 {id:'hip-mobility',category:'mobility',title:'股関節・足上げ',equipment:'マット・壁',items:[...sides('片膝立ちの股関節前面ストレッチ','time',30),row('バタフライストレッチ（合せき）','time',30),...sides('仰向けフィギュアフォー','time',30),...sides('カーフストレッチ','time',30)]},
 {id:'upper-mobility',category:'mobility',title:'肩・背中・上半身',equipment:'マット・戸口',items:[...sides('ドアウェイ・チェストストレッチ','time',30),row('チャイルドポーズ','time',30),...sides('オープンブック','reps',5),...sides('手首の屈筋ストレッチ','time',20),...sides('手首の伸筋ストレッチ','time',20)]},
 {id:'home-static',category:'mobility',title:'自宅で全身・静的ストレッチ',equipment:'マット（反動をつけず各20秒保持）',items:[row('バタフライストレッチ（合せき）','time',20),...sides('仰向けフィギュアフォー','time',20),...sides('片膝立ちの股関節前面ストレッチ','time',20),row('チャイルドポーズ','time',20),...sides('手首の屈筋ストレッチ','time',20),...sides('手首の伸筋ストレッチ','time',20)]},
 {id:'warmup-free',category:'warmup',title:'道具なし・登る前の準備',equipment:'支えになる壁・クライミングウォール',items:[row('その場足踏み','time',60),row('アームサークル','time',30),...sides('レッグスイング','reps',10),row('手首回し','time',30),row('軽いクライミング','reps',1)]},
 {id:'warmup-band',category:'warmup',title:'ゴムバンドで準備',equipment:'軽いバンド・固定点・クライミングウォール',items:[row('その場足踏み','time',60),row('バンドプルアパート','reps',10),row('バンド外旋（肩）','reps',10),row('バンドロー','reps',10),row('手首回し','time',30),row('軽いクライミング','reps',1)]}
];
export const climbingCourses=Object.freeze(courseRows.map(course=>Object.freeze({...course,exerciseRegistryVersion,items:Object.freeze(course.items.map(Object.freeze)),requiredEquipment:Object.freeze([...new Set(course.items.flatMap(item=>resolveExercise(item.name).definition.requiredEquipment))]),optionalEquipment:Object.freeze([...new Set(course.items.flatMap(item=>resolveExercise(item.name).definition.optionalEquipment))])})));
export function makeClimbingCourse(id,createId=()=>crypto.randomUUID()){
 const course=climbingCourses.find(c=>c.id===id);if(!course)throw new Error('コースが見つかりません。');return normalizeWorkoutPlan({title:course.title,place:course.category==='warmup'?'ジム':'自宅',preparationSeconds:5,transitionRestSeconds:course.category==='strength'?30:15,exercises:course.items.map(item=>({id:createId(),name:item.name,mode:item.mode,loadMethod:'bodyweight',sets:Array.from({length:item.sets},()=>({target:item.target,loadKg:0,restSeconds:item.rest}))}))});
}
