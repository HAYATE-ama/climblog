import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRecordCommit,rollbackRecord,validateRecordDate} from '../assets/js/history-model.mjs';
import {outdoorDanSummary} from '../assets/js/outdoor-season.mjs';
import {validateBackup} from '../assets/js/backup-model.mjs';
import {buildCloudPayload} from '../assets/js/features.mjs';
const now='2026-11-11T00:00:00.000Z';
const base={id:'sample',date:'2026-10-31',kind:'outdoor',cragName:'Sample',routeName:'A',grade:'二段',result:'send',ascentType:'new',sends:1,tries:4,memo:'keep',createdAt:'2026-10-31T10:00:00Z'};
const edit=(record,date,entry={})=>prepareRecordCommit([record],[entry],{editingId:record.id,date,now,createId:()=> 'history'});

test('record date accepts calendar dates and rejects missing or impossible dates',()=>{
 for(const date of ['2028-02-29','2026-12-31','2027-01-01'])assert.equal(validateRecordDate(date),date);
 for(const date of ['',null,undefined,'2026/11/11','2026-2-01','2026-02-29','2026-04-31','2026-13-01','not-date'])assert.throws(()=>validateRecordDate(date),/記録日/);
});
test('date corrections keep identity, original actuals, snapshots and unrecognized extension data',()=>{
 for(const kind of ['gym','outdoor','training']){
  const record={...base,kind,bodyweightKg:60,loadRecorded:false,loadKg:0,rpe:null,setDetails:[{reps:3,holdSeconds:0,loadRecorded:false,loadKg:0}],sessionSetResults:[{status:'skipped',actual:0},{status:'completed',actual:3}],course:{id:'original',version:1},workoutSessionId:'session',workoutStartedAt:100,workoutFinishedAt:300,futureExtension:{keep:true}};
  const before=structuredClone(record),out=edit(record,'2027-01-01');
  assert.deepEqual(out.records,[{...record,date:'2027-01-01',updatedAt:now}]);assert.deepEqual(record,before);
  assert.deepEqual(out.recordHistory[0].before,record);assert.deepEqual(out.recordHistory[0].after,out.records[0]);assert.equal(out.isNew,false);assert.deepEqual(out.recordIds,['sample']);
 }
});
test('moving one row never moves sibling records in the same saved session',()=>{
 const records=[{...base,workoutSessionId:'same'},{...base,id:'other',workoutSessionId:'same'}];
 const out=prepareRecordCommit(records,[{}],{editingId:'sample',date:'2026-12-01',now});assert.deepEqual(out.records[1],records[1]);assert.equal(out.recordHistory.length,1);
});
test('date and content can be edited together; omitting the date keeps legacy callers compatible',()=>{
 assert.equal(edit(base,'2026-12-01',{memo:'new note'}).records[0].memo,'new note');
 assert.equal(edit(base,undefined,{date:'2020-01-01',memo:'new note'}).records[0].date,base.date);
 const records=[base];assert.throws(()=>prepareRecordCommit(records,[{}],{editingId:base.id,date:''}),/記録日/);assert.deepEqual(records,[base]);
});
test('date correction participates in history and can be rolled back without moving other rows',()=>{
 const out=edit(base,'2026-11-01'),other={...base,id:'other'},restored=rollbackRecord([...out.records,other],[],out.recordHistory,'history',now);
 assert.equal(restored.records.find(r=>r.id===base.id).date,base.date);assert.deepEqual(restored.records.find(r=>r.id==='other'),other);
 assert.equal(edit(base,base.date).recordHistory.length,0);
});
test('season totals, backups and the cloud payload all use the corrected date',()=>{
 const oldRange={from:'2026-10-01',to:'2026-10-31'},newRange={from:'2026-11-01',to:'2026-11-30'};
 const moved=edit(base,'2026-11-01'),state={records:moved.records,recordHistory:moved.recordHistory};
 assert.equal(outdoorDanSummary([base],oldRange).newDan,2);assert.equal(outdoorDanSummary(state.records,oldRange).newDan,0);assert.equal(outdoorDanSummary(state.records,newRange).newDan,2);
 assert.deepEqual(validateBackup(state),state);
 const storage=new Map([['climbLogRecords',JSON.stringify(state.records)],['climbLogRecordHistory',JSON.stringify(state.recordHistory)]]);
 const payload=buildCloudPayload({getItem:key=>storage.get(key)});assert.equal(payload.records[0].date,'2026-11-01');assert.equal(payload.records.length,1);
});
