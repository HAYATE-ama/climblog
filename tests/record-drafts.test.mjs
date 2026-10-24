import test from 'node:test';
import assert from 'node:assert/strict';
import { RecordDrafts } from '../assets/js/record-drafts.mjs';
import { buildCloudPayload, migrateLegacyRecords, getBodyWeightForDate } from '../assets/js/features.mjs';

test('repeated exercises remain independent when one is edited and another removed',()=>{
  let sequence=0;const drafts=new RecordDrafts(()=>`draft-${++sequence}`);
  const first=drafts.add({exerciseName:'自重懸垂',sets:3,reps:5});
  const second=drafts.add({exerciseName:'自重懸垂',sets:4,reps:6});
  const third=drafts.add({exerciseName:'自重懸垂',sets:2,reps:8});
  drafts.update(second,{exerciseName:'自重懸垂',sets:5,reps:7});drafts.remove(first);
  assert.deepEqual(drafts.list().map(row=>[row.id,row.values.sets,row.values.reps]),[[second,5,7],[third,2,8]]);
  drafts.update(third,{exerciseName:'ハングボード（通常）',sets:6,reps:1});
  assert.equal(drafts.get(second).values.exerciseName,'自重懸垂');
  assert.equal(drafts.size,2);
  const snapshot=drafts.list();snapshot[0].values.sets=999;
  assert.equal(drafts.get(second).values.sets,5);
});

test('retiring old task links keeps dates, grades, tries and notes without mutating source',()=>{
  const old={id:'outdoor-old',kind:'outdoor',date:'2024-04-12',grade:'初段',result:'project',projectId:'p1',tries:11,sends:0,memo:'プロジェクトの次のムーブ',summary:'忍者返し · プロジェクト'};
  const gym={id:'gym-old',kind:'gym',projectId:'p2',sends:2};
  const migrated=migrateLegacyRecords([old,gym]);
  assert.equal(migrated.length,2);assert.equal(migrated[0].id,old.id);assert.equal(migrated[0].result,'attempt');
  assert.equal(migrated[0].date,old.date);assert.equal(migrated[0].grade,old.grade);assert.equal(migrated[0].tries,11);assert.equal(migrated[0].memo,old.memo);
  assert.equal('projectId' in migrated[0],false);assert.equal('projectId' in migrated[1],false);assert.equal(migrated[1].sends,2);
  assert.equal(old.result,'project');assert.equal(old.projectId,'p1');
  assert.deepEqual(migrateLegacyRecords(migrated),migrated);
});

test('height, fingertip reach and weight history are included in cloud save and backup data',()=>{
  const profile={heightCm:170.5,reachCm:178.2,updatedAt:'2026-10-24T00:00:00Z'};
  const weights=[{date:'2026-10-20',kg:63.5}];
  const values=new Map([['climbLogBodyProfile',JSON.stringify(profile)],['climbLogBodyWeights',JSON.stringify(weights)],['climbLogProjects','[{"id":"obsolete"}]'],['climbLogRecords','[{"id":"keep","kind":"gym","projectId":"obsolete"}]']]);
  const payload=buildCloudPayload({getItem:key=>values.get(key)??null});
  assert.deepEqual(payload.bodyProfile,profile);assert.deepEqual(payload.bodyWeights,weights);
  assert.equal('projects' in payload,false);assert.deepEqual(payload.records,[{id:'keep',kind:'gym'}]);
});

test('workout weight lookup excludes future measurements and invalid values',()=>{
  const history=[{date:'2026-10-24',kg:62},{date:'2026-10-01',kg:65},{date:'2026-09-01',kg:66},{date:'2026-10-10',kg:0}];
  assert.equal(getBodyWeightForDate(history,'2026-10-15'),65);
  assert.equal(getBodyWeightForDate(history,'2026-10-24'),62);
  assert.equal(getBodyWeightForDate(history,'2026-08-01'),null);
  assert.equal(history[0].date,'2026-10-24');
});
