export function searchRecords(records, query = "", kind = "all") {
  const term = String(query).trim().toLocaleLowerCase();
  return records.filter(record => {
    if (kind !== "all" && record.kind !== kind) return false;
    if (!term) return true;
    const searchable = [record.date, record.place, record.gymName, record.cragName, record.areaName, record.routeName, record.grade, record.exerciseName, record.memo, record.summary].filter(Boolean).join(" ").toLocaleLowerCase();
    return searchable.includes(term);
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function getMaxTestSeries(records) {
  const tests = records.filter(record => record.trainingMode === "maxTest" && record.maxType && Number.isFinite(Number(record.addedWeightKg)));
  const grouped = new Map();
  for (const record of tests) {
    const key = [record.maxType, record.gripType || "", record.edgeDepthMm || "", record.maxType === "singleHandLift" ? (record.liftHand || "right") : ""].join("|");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(record);
  }
  return [...grouped.values()].map(series => {
    series.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let best = -Infinity;
    return { key: [series[0].maxType, series[0].gripType || "", series[0].edgeDepthMm || "", series[0].maxType === "singleHandLift" ? (series[0].liftHand || "right") : ""].join("|"), entries: series.map(record => {
      const valueKg = Number(record.totalLoadKg ?? record.addedWeightKg);
      const isPersonalBest = valueKg > best;
      best = Math.max(best, valueKg);
      return { ...record, valueKg, isPersonalBest };
    }) };
  });
}

export function removeRecord(records, id) {
  return records.filter(record => record.id !== id);
}

export function calculateGoalProgress(records, goals, now = new Date()) {
  const ym = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0")].join("-");
  const year = String(now.getFullYear());
  const period = (record, prefix) => String(record.date || "").startsWith(prefix);
  const countDays = (kind, prefix) => new Set(records.filter(record => record.kind === kind && period(record, prefix)).map(record => record.date)).size;
  return [
    { key: "gymDaysMonthly", label: "ジムに行く日", current: countDays("gym", ym), target: Number(goals.gymDaysMonthly) || 0, unit: "日" },
    { key: "outdoorDaysYearly", label: "外岩に行く日", current: countDays("outdoor", year), target: Number(goals.outdoorDaysYearly) || 0, unit: "日" },
    { key: "trainingDaysMonthly", label: "トレーニング日", current: countDays("training", ym), target: Number(goals.trainingDaysMonthly) || 0, unit: "日" }
  ];
}

export function summarizeProject(project, records) {
  const linked = records.filter(record => record.projectId === project.id);
  return { sessions: linked.length, sends: linked.reduce((sum, record) => sum + (Number(record.sends) || 0), 0), lastDate: linked.map(record => record.date).sort().at(-1) || "" };
}

export function buildCloudPayload(storage) {
  return { records: JSON.parse(storage.getItem("climbLogRecords") || "[]"), gyms: JSON.parse(storage.getItem("climbLogGyms") || "null"), projects: JSON.parse(storage.getItem("climbLogProjects") || "[]"), goals: JSON.parse(storage.getItem("climbLogGoals") || "{}"), preferences: JSON.parse(storage.getItem("climbLogPreferences") || "{}") };
}

export function validateMaxTest({ maxType, addedWeightKg, bodyweightKg, edgeDepthMm, holdSeconds }) {
  const added = Number(addedWeightKg);
  if (!Number.isFinite(added) || added < 0) return "追加重量は0以上で入力してください。";
  if (bodyweightKg != null && bodyweightKg !== "" && (!Number.isFinite(Number(bodyweightKg)) || Number(bodyweightKg) < 0)) return "体重は0以上で入力してください。";
  if (["hangboard", "singleHandLift"].includes(maxType) && !(Number(edgeDepthMm) > 0)) return "ホールド・持ち手の厚さを入力してください。";
  if (maxType === "hangboard" && !(Number(holdSeconds) > 0)) return "保持時間を入力してください。";
  return "";
}
export function calculateTotalLoad(addedWeightKg, bodyweightKg) {
  const added = Number(addedWeightKg) || 0;
  return bodyweightKg === null || bodyweightKg === "" || bodyweightKg === undefined ? added : added + (Number(bodyweightKg) || 0);
}
