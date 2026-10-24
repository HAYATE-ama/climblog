import test from 'node:test';
import assert from 'node:assert/strict';
import { findPreviousRecords, copyRecordForDate, groupDayRecords } from '../assets/js/workflow-features.mjs';
import { getMaxTestSeries, buildCloudPayload } from '../assets/js/features.mjs';
import { getLiftHandComparisons } from '../assets/js/strength-insights.mjs';
import { InputDraftStore } from '../assets/js/input-draft-store.mjs';
import { RecordDrafts } from '../assets/js/record-drafts.mjs';

test('copy selection uses the latest earlier day for the selected gym or training mode',()=>{
  const rows=[{id:'a',kind:'gym',gymName:'A',date:'2026-10-01'},{id:'b',kind:'gym',gymName:'A',date:'2026-10-20'},{id:'c',kind:'gym',gymName:'A',date:'2026-10-20'},{id:'d',kind:'gym',gymName:'B',date:'2026-10-23'},{id:'e',kind:'gym',gymName:'A',date:'2026-10-24'},{id:'f',kind:'gym',gymName:'A',date:'2027-01-01'},
    {id:'r1',kind:'training',date:'2026-10-21',trainingMode:'routine'},{id:'r2',kind:'training',date:'2026-10-21',trainingMode:'routine'},{id:'m',kind:'training',date:'2026-10-23',trainingMode:'maxTest',maxType:'singleHandLift',liftHand:'left'}];
  assert.deepEqual(findPreviousRecords(rows,{kind:'gym',date:'2026-10-24',gymName:'A',trainingMode:'maxTest',maxType:'hangboard'}).map(row=>row.id),['b','c']);
  assert.deepEqual(findPreviousRecords(rows,{kind:'training',date:'2026-10-24'}).map(row=>row.id),['r1','r2']);
  assert.deepEqual(findPreviousRecords(rows,{kind:'training',date:'2026-10-24',trainingMode:'maxTest',maxType:'singleHandLift',liftHand:'right'}),[]);
});

test('a copied workout gets the target-date weight and a new identity at commit, without altering history',()=>{
  const old={id:'old',date:'2026-09-01',batchSessionId:'old-batch',kind:'training',trainingMode:'maxTest',maxType:'hangboard',addedWeightKg:10,bodyweightKg:80,totalLoadKg:90,memo:'前回'};
  const weights=[{date:'2026-10-01',kg:60},{date:'2027-01-01',kg:70}];
  const copy=copyRecordForDate(old,'2026-10-24',weights);
  assert.equal(copy.bodyweightKg,60);assert.equal(copy.totalLoadKg,70);assert.equal(copy.memo,'前回');
  for(const field of ['id','date','batchSessionId'])assert.equal(field in copy,false);
  assert.equal(old.bodyweightKg,80);assert.equal(old.totalLoadKg,90);
  assert.equal(copyRecordForDate({...old,maxType:'singleHandLift'},'2026-10-24',weights).totalLoadKg,10);
});

test('max history separates hold durations and missing bodyweight bases; ratios use historical weight',()=>{
  const base={kind:'training',trainingMode:'maxTest',maxType:'hangboard',date:'2026-10-20',gripType:'open',edgeDepthMm:20,addedWeightKg:15};
  const series=getMaxTestSeries([{...base,holdSeconds:7,bodyweightKg:60,totalLoadKg:75},{...base,date:'2026-10-21',holdSeconds:7,bodyweightKg:50,totalLoadKg:65},{...base,holdSeconds:10,bodyweightKg:60,totalLoadKg:75},{...base,holdSeconds:7},{...base,bodyweightKg:60,totalLoadKg:75}]);
  assert.equal(series.length,4);
  const same=series.find(group=>group.entries.length===2);
  assert.deepEqual(same.entries.map(row=>row.bodyweightRatio),[1.25,1.3]);
  assert.deepEqual(same.entries.map(row=>row.isPersonalBest),[true,false]);
  assert.equal(series.find(group=>group.entries[0].metricBasis==='external').entries[0].bodyweightRatio,null);
});

test('hand differences compare best values only for a matching day, grip and edge',()=>{
  const base={trainingMode:'maxTest',maxType:'singleHandLift',date:'2026-10-20',gripType:'halfCrimp',edgeDepthMm:20};
  const rows=[{...base,liftHand:'right',addedWeightKg:28},{...base,liftHand:'right',addedWeightKg:30},{...base,liftHand:'left',addedWeightKg:24},{...base,date:'2026-10-21',liftHand:'left',addedWeightKg:26},{...base,edgeDepthMm:15,liftHand:'left',addedWeightKg:20}];
  const pairs=getLiftHandComparisons(rows),complete=pairs.find(pair=>pair.differenceKg!=null);
  assert.equal(complete.rightKg,30);assert.equal(complete.leftKg,24);assert.equal(complete.differenceKg,6);assert.equal(complete.differencePercent,20);
  assert.equal(pairs.filter(pair=>pair.differencePercent==null).length,2);
  assert.deepEqual(getLiftHandComparisons([{...base,edgeDepthMm:null,liftHand:'right',addedWeightKg:20}]),[]);
});

test('daily groups retain all individual records and count routine volume separately from max measurements',()=>{
  const rows=[{id:'t1',date:'2026-10-24',kind:'training',sets:3,reps:5,durationMinutes:20},{id:'t2',date:'2026-10-24',kind:'training',sets:4,reps:6,durationMinutes:10},{id:'m',date:'2026-10-24',kind:'training',trainingMode:'maxTest',sets:1,durationMinutes:0},
    {id:'g1',date:'2026-10-24',kind:'gym',gymName:'A',sends:2,tries:4},{id:'g2',date:'2026-10-24',kind:'gym',gymName:'A',sends:0,tries:5,gymOutcome:'failed'},
    {id:'o1',date:'2026-10-24',kind:'outdoor'},{id:'o2',date:'2026-10-24',kind:'outdoor'}];
  const groups=groupDayRecords(rows),training=groups.find(group=>group.kind==='training'),gym=groups.find(group=>group.kind==='gym');
  assert.equal(groups.length,4);assert.equal(training.sets,7);assert.equal(training.minutes,30);assert.equal(training.reps,39);assert.equal(training.measurementCount,1);assert.equal(training.routineCount,2);
  assert.equal(gym.sends,2);assert.equal(gym.failures,1);assert.equal(gym.tries,9);
  assert.deepEqual(groups.flatMap(group=>group.records.map(row=>row.id)).sort(),rows.map(row=>row.id).sort());
});

test('device drafts are isolated by account and target date, and never appear in cloud payload',()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const a=new InputDraftStore(storage,'account-A'),b=new InputDraftStore(storage,'account-B');
  a.save({key:'new:2026-10-24',date:'2026-10-24',form:{kind:'training',trainingSets:'3'},states:{}});
  a.save({key:'edit:old',date:'2026-10-20',recordId:'old',form:{kind:'gym'},states:{}});
  b.save({key:'new:2026-10-24',date:'2026-10-24',form:{kind:'outdoor'},states:{}});
  assert.equal(a.list().length,2);assert.equal(b.list().length,1);assert.equal(a.get('new:2026-10-24').form.kind,'training');assert.equal(b.get('new:2026-10-24').form.kind,'outdoor');
  a.remove('edit:old');assert.equal(a.list().length,1);assert.equal(b.list().length,1);
  assert.equal(JSON.stringify(buildCloudPayload(storage)).includes('trainingSets'),false);
  values.set(a.key,'{bad json');assert.deepEqual(a.list(),[]);
});

test('restoring a pending list preserves edit identity and keeps repeated exercises independent',()=>{
  const first=new RecordDrafts(()=> 'original');first.add({exerciseName:'懸垂',sets:3});
  const resumed=new RecordDrafts();resumed.restore(JSON.parse(JSON.stringify(first.list())));
  resumed.update('original',{exerciseName:'懸垂',sets:5});resumed.add({exerciseName:'懸垂',sets:4});
  assert.equal(resumed.size,2);assert.equal(resumed.get('original').values.sets,5);assert.equal(first.get('original').values.sets,3);
  const snapshot=resumed.list();snapshot[0].values.sets=999;assert.equal(resumed.get('original').values.sets,5);
});
