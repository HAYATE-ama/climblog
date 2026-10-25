import test from "node:test";
import assert from "node:assert/strict";
import { searchRecords, getMaxTestSeries, buildCloudPayload, validateMaxTest, calculateTotalLoad, removeRecord } from "../assets/js/features.mjs";

test("search filters by text and activity type, newest records first", () => {
  const rows = [{ date: "2026-04-01", kind: "gym", place: "Alpha", grade: "6級" }, { date: "2026-04-03", kind: "outdoor", place: "御岳", grade: "1級" }, { date: "2026-04-02", kind: "gym", place: "御岳ジム", grade: "5級" }];
  assert.deepEqual(searchRecords(rows, "御岳", "all").map(row => row.date), ["2026-04-03", "2026-04-02"]);
  assert.deepEqual(searchRecords(rows, "御岳", "gym").map(row => row.date), ["2026-04-02"]);
});

test("max test series separates grip and edge conditions and marks new bests", () => {
  const rows = [
    { id: "a", date: "2026-01-01", trainingMode: "maxTest", maxType: "hangboard", gripType: "open", edgeDepthMm: 20, addedWeightKg: 10, totalLoadKg: 70 },
    { id: "b", date: "2026-02-01", trainingMode: "maxTest", maxType: "hangboard", gripType: "open", edgeDepthMm: 20, addedWeightKg: 12, totalLoadKg: 72 },
    { id: "c", date: "2026-03-01", trainingMode: "maxTest", maxType: "hangboard", gripType: "halfCrimp", edgeDepthMm: 20, addedWeightKg: 12, totalLoadKg: 72 },
    { id: "d", date: "2026-03-02", trainingMode: "maxTest", maxType: "singleHandLift", gripType: "open", edgeDepthMm: 20, liftHand: "right", addedWeightKg: 24, totalLoadKg: 24 },
    { id: "e", date: "2026-03-03", trainingMode: "maxTest", maxType: "singleHandLift", gripType: "open", edgeDepthMm: 20, liftHand: "left", addedWeightKg: 22, totalLoadKg: 22 }
  ];
  const series = getMaxTestSeries(rows);
  assert.equal(series.length, 4);
  assert.equal(series.filter(item => item.key.includes("singleHandLift")).length, 2);
  assert.deepEqual(series[0].entries.map(row => row.isPersonalBest), [true, true]);
  assert.equal(series[0].entries[1].valueKg, 72);
});

test("cloud payload includes all account state and defaults missing new collections", () => {
  const values = new Map([["climbLogRecords", "[1]"], ["climbLogGyms", "[2]"], ["climbLogProjects", "[3]"], ["climbLogGoals", "{\"gymDaysMonthly\":8}"]]);
  const storage = { getItem: key => values.get(key) ?? null };
  assert.deepEqual(buildCloudPayload(storage), { records: [1], gyms: [2], goals: { focus: '', plan: '', reflection: '', status: 'active' }, preferences: {}, bodyWeights: [], bodyProfile: {}, trainingPresets:[],trainingMenus:[],dailyJournals:[],recordHistory:[],recycleBin:[],workoutReceipts:[] });
  assert.deepEqual(buildCloudPayload({ getItem: () => null }), { records: [], gyms: null, goals: { focus: '', plan: '', reflection: '', status: 'active' }, preferences: {}, bodyWeights: [], bodyProfile: {}, trainingPresets:[],trainingMenus:[],dailyJournals:[],recordHistory:[],recycleBin:[],workoutReceipts:[] });
});

test("max test validation requires hangboard conditions and rejects negative load", () => {
  assert.equal(validateMaxTest({ maxType: "hangboard", addedWeightKg: "5", bodyweightKg: "65", edgeDepthMm: "20", holdSeconds: "7" }), "");
  assert.match(validateMaxTest({ maxType: "hangboard", addedWeightKg: "5", bodyweightKg: "65", edgeDepthMm: "", holdSeconds: "7" }), /ホールド/);
  assert.match(validateMaxTest({ maxType: "weightedPullup", addedWeightKg: "-1", bodyweightKg: "65" }), /追加重量/);
  assert.equal(validateMaxTest({ maxType: "singleHandLift", addedWeightKg: "24", edgeDepthMm: "20" }), "");
  assert.match(validateMaxTest({ maxType: "singleHandLift", addedWeightKg: "24", edgeDepthMm: "" }), /持ち手の厚さ/);
});

test("total load combines added weight and optional bodyweight", () => {
  assert.equal(calculateTotalLoad("12.5", "63.2"), 75.7);
  assert.equal(calculateTotalLoad("12.5", ""), 12.5);
});


test("removeRecord deletes only the selected record and leaves other history intact", () => {
  const rows = [{ id: "old-1", date: "2024-01-01" }, { id: "old-2", date: "2024-01-02" }, { id: "recent", date: "2026-10-24" }];
  assert.deepEqual(removeRecord(rows, "old-1"), [rows[1], rows[2]]);
  assert.equal(removeRecord(rows, "missing").length, 3);
});
