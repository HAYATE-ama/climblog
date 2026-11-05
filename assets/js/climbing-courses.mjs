import {resolveExercise,exerciseIdentity,exerciseRegistryVersion} from './exercise-registry.mjs';
import {normalizeWorkoutPlan} from './workout-model.mjs';
const row=(name,mode,target,sets=1,rest=20)=>{const match=resolveExercise(name);if(!match||match.definition.defaultMode!==mode)throw new Error('コースの種目定義が一致しません。');return {name,mode,target,sets,rest,...exerciseIdentity(name)};};
const sides=(name,mode,target,sets=1,rest=15)=>['左','右'].map(side=>row(name+'（'+side+'）',mode,target,sets,rest));
export const courseCategories=[['climbing','登る練習'],['strength','筋トレ'],['mobility','柔軟'],['warmup','ウォーミングアップ']];
const hipItems=()=>[...sides('片膝立ちの股関節前面ストレッチ','time',30),row('バタフライストレッチ（合せき）','time',30,2,15),...sides('仰向けフィギュアフォー','time',30),row('支え付き開脚ストレッチ','time',30,2,15)];
const fingerHoldCourse=(grip,title)=>({id:'finger-max-'+grip,category:'strength',title,equipment:'エッジ・錘・接続器具・マット。重量は左右別に設定。最後に股関節をやさしく伸ばします。',items:[row('その場足踏み','time',90),row('アームサークル','time',30),row('手首回し','time',30),row('片手リフトの段階的ウォームアップ','reps',1),...sides(grip==='half'?'片手リフト保持（ハーフクリンプ）':'片手リフト保持（オープンハンド）','time',3,3,180),...hipItems()]});
export const courseScheduleOptions=[['all','すべて'],['daily','毎日・軽い柔軟'],['tuesday','火曜日・指トレAとテーマ練習'],['thursday','木曜日・指トレBとテーマ練習'],['weekend','土日どちらか・登る日']];
const scheduleFor=id=>id==='finger-max-half'?['tuesday']:id==='finger-max-open'?['thursday']:['hip-mobility','home-static','upper-mobility'].includes(id)?['daily']:id==='project-focus'?['weekend']:id==='silent-feet'?['tuesday','weekend']:id==='movement-puzzle'?['thursday','weekend']:id.startsWith('warmup')?['tuesday','thursday','weekend']:[];
const courseRows=[
 {id:'silent-feet',category:'climbing',title:'火曜の選択肢・静かな足チャレンジ',equipment:'ジムの易しい課題。指トレを行う日は軽めに。',items:[row('軽いクライミング','reps',1),row('サイレントフット練習','reps',1)]},
 {id:'movement-puzzle',category:'climbing',title:'木曜の選択肢・ムーブパズル',equipment:'ジムの短い易しい区間。違う足順を試します。',items:[row('軽いクライミング','reps',1),row('ムーブパズル練習','reps',1)]},
 {id:'project-focus',category:'climbing',title:'週末・本命課題に集中',equipment:'ジム/外岩の安全な課題。完登数は別途記録。',items:[row('その場足踏み','time',90),row('アームサークル','time',30),row('手首回し','time',30),row('軽いクライミング','reps',1),row('本命課題の集中トライ','reps',1)]},
 fingerHoldCourse('half','指の最大筋力A・ハーフクリンプ＋股関節'),
 fingerHoldCourse('open','指の最大筋力B・オープンハンド＋股関節'),
 {id:'finger-ground-lift',category:'strength',title:'指トレ・片手リフト（地面から）',equipment:'リフティングエッジ・錘・接続器具',items:sides('片手リフト（地面から）','reps',5,3,60)},
 {id:'finger-open',category:'strength',title:'指トレ・オープンハンド（足補助）',equipment:'ハングボード・両足で安定して支えられる環境',items:[row('足補助ハング（オープンハンド）','time',5,3,60)]},
 {id:'finger-half-crimp',category:'strength',title:'指トレ・ハーフクリンプ（足補助）',equipment:'ハングボード・両足で安定して支えられる環境',items:[row('足補助ハング（ハーフクリンプ）','time',5,3,60)]},
 {id:'core-control',category:'strength',title:'体幹・姿勢づくり',equipment:'マット',items:[row('プランク','time',30,2,30),...sides('サイドプランク','time',20),row('バードドッグ','reps',6,2,30),row('ヒップリフト','reps',10,2,30)]},
 {id:'pull-shoulder',category:'strength',title:'引く力・肩まわり',equipment:'懸垂バー・バンド・固定点',items:[row('自重懸垂','reps',5,2,60),row('バンドロー','reps',10,2,30),row('バンド外旋（肩）','reps',10,2,30),row('腕立て伏せ','reps',8,2,45)]},
 {id:'hip-mobility',category:'mobility',title:'股関節・足上げ',equipment:'マット・壁',items:hipItems()},
 {id:'upper-mobility',category:'mobility',title:'肩・背中・上半身',equipment:'マット・戸口',items:[...sides('ドアウェイ・チェストストレッチ','time',30),row('チャイルドポーズ','time',30),...sides('オープンブック','reps',5),...sides('手首の屈筋ストレッチ','time',20),...sides('手首の伸筋ストレッチ','time',20)]},
 {id:'home-static',category:'mobility',title:'自宅で全身・静的ストレッチ',equipment:'マット（反動をつけず各20秒保持）',items:[row('バタフライストレッチ（合せき）','time',20),...sides('仰向けフィギュアフォー','time',20),...sides('片膝立ちの股関節前面ストレッチ','time',20),row('チャイルドポーズ','time',20),...sides('手首の屈筋ストレッチ','time',20),...sides('手首の伸筋ストレッチ','time',20)]},
 {id:'warmup-free',category:'warmup',title:'道具なし・登る前の準備',equipment:'支えになる壁・クライミングウォール',items:[row('その場足踏み','time',60),row('アームサークル','time',30),...sides('レッグスイング','reps',10),row('手首回し','time',30),row('軽いクライミング','reps',1)]},
 {id:'warmup-band',category:'warmup',title:'ゴムバンドで準備',equipment:'軽いバンド・固定点・クライミングウォール',items:[row('その場足踏み','time',60),row('バンドプルアパート','reps',10),row('バンド外旋（肩）','reps',10),row('バンドロー','reps',10),row('手首回し','time',30),row('軽いクライミング','reps',1)]}
];
export const climbingCourses=Object.freeze(courseRows.map(course=>Object.freeze({...course,schedule:Object.freeze(scheduleFor(course.id)),exerciseRegistryVersion,items:Object.freeze(course.items.map(Object.freeze)),requiredEquipment:Object.freeze([...new Set(course.items.flatMap(item=>resolveExercise(item.name).definition.requiredEquipment))]),optionalEquipment:Object.freeze([...new Set(course.items.flatMap(item=>resolveExercise(item.name).definition.optionalEquipment))])})));
export function makeClimbingCourse(id,createId=()=>crypto.randomUUID()){
 const course=climbingCourses.find(c=>c.id===id);if(!course)throw new Error('コースが見つかりません。');return normalizeWorkoutPlan({title:course.title,place:['warmup','climbing'].includes(course.category)?'ジム':'自宅',preparationSeconds:5,transitionRestSeconds:course.category==='strength'?30:15,exercises:course.items.map(item=>({id:createId(),name:item.name,mode:item.mode,...(resolveExercise(item.name).definition.category==='finger'?{fingerConditions:{gripType:item.name.includes('ハーフクリンプ')?'halfCrimp':item.name.includes('オープンハンド')?'open':null,edgeDepthMm:null}}:{}),loadMethod:resolveExercise(item.name).definition.loadBasis==='externalLoadOnly'?'liftFromGround':'bodyweight',sets:Array.from({length:item.sets},()=>({target:item.target,loadKg:0,restSeconds:item.rest}))}))});
}
