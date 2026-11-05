export const accountKeys={customExercises:'climbLogCustomExercises',records:'climbLogRecords',gyms:'climbLogGyms',goals:'climbLogGoals',preferences:'climbLogPreferences',bodyWeights:'climbLogBodyWeights',bodyProfile:'climbLogBodyProfile',trainingPresets:'climbLogTrainingPresets',trainingMenus:'climbLogTrainingMenus',dailyJournals:'climbLogDailyJournals',recordHistory:'climbLogRecordHistory',recycleBin:'climbLogRecycleBin',workoutReceipts:'climbLogWorkoutReceipts'};
export const extraCollections=['customExercises','trainingPresets','trainingMenus','dailyJournals','recordHistory','recycleBin','workoutReceipts'];
export function readCollection(storage,name){try{const value=JSON.parse(storage.getItem(accountKeys[name])||'[]');return Array.isArray(value)?value:[];}catch{return [];}}
const patchWriters=new WeakMap();
// A cloud-backed browser can commit account keys and its pending snapshot together.
export function registerAccountPatchWriter(storage,writer){patchWriters.set(storage,writer);}
export function commitStorageRows(storage,rows,{setItem=storage.setItem,removeItem=storage.removeItem}={}){
  const before=rows.map(row=>({key:row.key,value:storage.getItem(row.key)}));
  try{for(const row of rows)setItem.call(storage,row.key,row.value);}catch(error){for(const row of before.reverse()){try{row.value==null?removeItem.call(storage,row.key):setItem.call(storage,row.key,row.value);}catch{}}throw error;}
}
export function writeAccountPatch(storage,patch){
  const rows=Object.entries(patch).filter(([name])=>Object.hasOwn(accountKeys,name)).map(([name,value])=>({key:accountKeys[name],value:JSON.stringify(value)}));
  const writer=patchWriters.get(storage);if(writer)return writer(rows);
  commitStorageRows(storage,rows);
}
export function loadAccountPayload(storage,payload,setItem,removeItem){
  for(const [name,key] of Object.entries(accountKeys)){
    const value=payload?.[name]??(['goals','preferences','bodyProfile'].includes(name)?{}:name==='gyms'?null:[]);
    if(value===null)removeItem.call(storage,key);else setItem.call(storage,key,JSON.stringify(value));
  }
  removeItem.call(storage,'climbLogProjects');
}
