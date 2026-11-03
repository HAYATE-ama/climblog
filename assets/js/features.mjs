import { extraCollections,readCollection } from './account-storage.mjs';
import { normalizeNarrativeGoals } from './goal-model.mjs';
import { maxConditionKey, measurementValue } from './strength-insights.mjs';
export function validateSearchPeriod({from = '', to = ''} = {}) {
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
  if ((from && !valid(from)) || (to && !valid(to))) return '日付を正しく入力してください。';
  return from && to && from > to ? '終了日は開始日以降にしてください。' : '';
}
export function searchRecords(records, query = "", kind = "all", period = {}) {
  if (validateSearchPeriod(period)) return [];
  const {from = '', to = ''} = period;
  // Normalize only comparison strings; saved names, grades and notes stay intact.
  const normalize = value => String(value).normalize('NFKC').toLocaleLowerCase();
  const terms = normalize(query).trim().split(/\s+/u).filter(Boolean);
  return records.filter(record => {
    if (kind !== "all" && record.kind !== kind) return false;
    if ((from || to) && (!/^\d{4}-\d{2}-\d{2}$/.test(record.date) || (from && record.date < from) || (to && record.date > to))) return false;
    if (!terms.length) return true;
    const searchable = normalize([record.date, record.place, record.gymName, record.cragName, record.areaName, record.routeName, record.grade, record.exerciseName, record.memo, record.summary].filter(Boolean).join(" "));
    return terms.every(term => searchable.includes(term));
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function getMaxTestSeries(records) {
  const grouped=new Map();
  for(const record of records){
    if(record.trainingMode!=='maxTest'||!record.maxType||record.addedWeightKg==null||record.addedWeightKg===''||!Number.isFinite(Number(record.addedWeightKg))||Number(record.addedWeightKg)<0)continue;
    const metric=measurementValue(record),key=maxConditionKey(record)+'|'+metric.metricBasis;
    if(!grouped.has(key))grouped.set(key,[]);
    const body=Number(record.bodyweightKg);
    grouped.get(key).push({...record,...metric,bodyweightRatio:body>0&&Number.isFinite(body)?metric.valueKg/body:null});
  }
  return [...grouped].map(([key,entries])=>{let best=-Infinity;entries.sort((a,b)=>String(a.date).localeCompare(String(b.date)));return {key,entries:entries.map(row=>{const isPersonalBest=row.valueKg>best;best=Math.max(best,row.valueKg);return {...row,isPersonalBest};})};});
}

export function removeRecord(records, id) {
  return records.filter(record => record.id !== id);
}

export function buildCloudPayload(storage) {
  return { ...Object.fromEntries(extraCollections.map(name=>[name,readCollection(storage,name)])), records: migrateLegacyRecords(JSON.parse(storage.getItem("climbLogRecords") || "[]")), gyms: JSON.parse(storage.getItem("climbLogGyms") || "null"), goals: normalizeNarrativeGoals(JSON.parse(storage.getItem("climbLogGoals") || "{}")), preferences: JSON.parse(storage.getItem("climbLogPreferences") || "{}"), bodyWeights: JSON.parse(storage.getItem("climbLogBodyWeights") || "[]"), bodyProfile: JSON.parse(storage.getItem("climbLogBodyProfile") || "{}") };
}

export function validateMaxTest({ maxType, addedWeightKg, bodyweightKg, edgeDepthMm, holdSeconds }) {
  if (!['hangboard', 'singleHandLift', 'weightedPullup'].includes(maxType)) return "測定種目を選択してください。";
  const missing=value=>value==null||String(value).trim()==='';
  const inRange=(value,min,max)=>!missing(value)&&Number.isFinite(Number(value))&&Number(value)>=min&&Number(value)<=max;
  if (!inRange(addedWeightKg,0,300)) return "追加重量は0〜300kgで入力してください。重量なしは0を入力してください。";
  if (!missing(bodyweightKg)&&!inRange(bodyweightKg,0,300)) return "体重は0〜300kgで入力してください。";
  if (["hangboard", "singleHandLift"].includes(maxType)&&!inRange(edgeDepthMm,1,100)) return "ホールド・持ち手の厚さは1〜100mmで入力してください。";
  if (maxType === "hangboard"&&!inRange(holdSeconds,1,300)) return "保持時間は1〜300秒で入力してください。";
  return "";
}
export function calculateTotalLoad(addedWeightKg, bodyweightKg) {
  const added = Number(addedWeightKg) || 0;
  return bodyweightKg === null || bodyweightKg === "" || bodyweightKg === undefined ? added : added + (Number(bodyweightKg) || 0);
}

// Retire old task links without removing climbing history or changing user notes.
export function migrateLegacyRecords(records) {
  return records.map(record => {
    if (!record || typeof record !== 'object') return record;
    if (!Object.hasOwn(record, 'projectId') && !(record.kind === 'outdoor' && record.result === 'project')) return record;
    const { projectId, ...rest } = record;
    if (rest.kind === 'outdoor' && rest.result === 'project') {
      rest.result = 'attempt'; rest.sends = 0;
      if (typeof rest.summary === 'string') rest.summary = rest.summary.replaceAll('プロジェクト', 'トライ');
    }
    return rest;
  });
}

export function getBodyWeightForDate(history, date) {
  const eligible = history.filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.date) && item.date <= date && Number.isFinite(Number(item.kg)) && Number(item.kg) > 0);
  eligible.sort((a,b)=>a.date.localeCompare(b.date));
  return eligible.length ? Number(eligible.at(-1).kg) : null;
}
