export const accountKeys={records:'climbLogRecords',gyms:'climbLogGyms',goals:'climbLogGoals',preferences:'climbLogPreferences',bodyWeights:'climbLogBodyWeights',bodyProfile:'climbLogBodyProfile',trainingPresets:'climbLogTrainingPresets',trainingMenus:'climbLogTrainingMenus',dailyJournals:'climbLogDailyJournals',recordHistory:'climbLogRecordHistory',recycleBin:'climbLogRecycleBin',workoutReceipts:'climbLogWorkoutReceipts'};
export const extraCollections=['trainingPresets','trainingMenus','dailyJournals','recordHistory','recycleBin','workoutReceipts'];
export function readCollection(storage,name){try{const value=JSON.parse(storage.getItem(accountKeys[name])||'[]');return Array.isArray(value)?value:[];}catch{return [];}}
export function writeAccountPatch(storage,patch){
  const rows=Object.entries(patch).filter(([name])=>Object.hasOwn(accountKeys,name)).map(([name,value])=>({key:accountKeys[name],value:JSON.stringify(value)}));
  const before=rows.map(row=>({key:row.key,value:storage.getItem(row.key)}));
  try{for(const row of rows)storage.setItem(row.key,row.value);}catch(error){for(const row of before){try{row.value==null?storage.removeItem(row.key):storage.setItem(row.key,row.value);}catch{}}throw error;}
}
export function loadAccountPayload(storage,payload,setItem,removeItem){
  for(const [name,key] of Object.entries(accountKeys)){
    const value=payload?.[name]??(['goals','preferences','bodyProfile'].includes(name)?{}:name==='gyms'?null:[]);
    if(value===null)removeItem.call(storage,key);else setItem.call(storage,key,JSON.stringify(value));
  }
  removeItem.call(storage,'climbLogProjects');
}
