import test from 'node:test';
import assert from 'node:assert/strict';
import {makeFeedbackDraft,parseFeedbackDraft,saveFeedback,changeFeedbackStatus,validateFeedbackEntries,selectFeedback,feedbackReport} from '../assets/js/user-feedback-model.mjs';
import {validateBackup,mergeBackup} from '../assets/js/backup-model.mjs';
import {accountKeys} from '../assets/js/account-storage.mjs';
import {buildCloudPayload} from '../assets/js/features.mjs';
const day='2026-11-21T01:00:00.000Z',later='2026-11-22T01:00:00.000Z',next='2026-11-23T01:00:00.000Z';
const draft=(id='test1')=>({...makeFeedbackDraft('training',id),category:'usability',text:'  休憩のボタンを見つけやすくしたい。  '});
const saved=()=>saveFeedback([],draft(),day).entry;

test('フィードバックは独立した記録として追加・編集し、入力配列や元の内容を変更しない',()=>{
 const rows=[],d=draft(),first=saveFeedback(rows,d,day);
 assert.equal(rows.length,0);assert.equal(d.base,null);assert.equal(first.entry.text,d.text.trim());
 const changed=saveFeedback(first.entries,{...d,base:first.entry,text:'別の説明'},later);
 assert.equal(changed.entries.length,1);assert.equal(changed.entry.createdAt,day);assert.equal(changed.entry.updatedAt,later);
 assert.equal(first.entry.text,d.text.trim());assert.equal(changed.entry.status,'open');assert.equal(changed.entry.resolvedAt,null);
});
test('保存後の下書き整理に失敗しても同じ内容を二重に登録しない',()=>{
 const first=saveFeedback([],draft(),day),again=saveFeedback(first.entries,draft(),later);
 assert.deepEqual(again,first);
 assert.throws(()=>saveFeedback(first.entries,{...draft(),text:'別内容'},later),/変更されています/);
});
test('対応済みと未対応を切り替え、履歴を削除せず古い編集中データからの上書きを防ぐ',()=>{
 const row=saved(),done=changeFeedbackStatus([row],row.id,'resolved',later);
 assert.equal(done[0].resolvedAt,later);assert.equal(row.status,'open');assert.equal(selectFeedback(done).length,0);
 assert.equal(selectFeedback(done,'resolved').length,1);
 assert.throws(()=>saveFeedback(done,{...draft(),base:row,text:'古い編集'},next),/変更されています/);
 const reopened=changeFeedbackStatus(done,row.id,'open',next);assert.equal(reopened[0].resolvedAt,null);assert.equal(done.length,1);
 assert.throws(()=>changeFeedbackStatus(done,'missing','open',next),/見つかりません/);
});
test('未入力・不正な保存内容を黙って破棄せず、重複IDや壊れた日時を拒否する',()=>{
 assert.throws(()=>saveFeedback([],{...draft(),text:'  '},day));
 assert.throws(()=>saveFeedback([],{...draft(),text:'あ'.repeat(3001)},day));
 assert.throws(()=>saveFeedback([],{...draft(),category:'unexpected'},day));
 assert.throws(()=>validateFeedbackEntries(null));assert.throws(()=>validateFeedbackEntries([saved(),saved()]));
 for(const value of [{id:'<b>'},{updatedAt:'yesterday'},{createdAt:next},{status:'deleted'},{resolvedAt:day},{text:[]}])assert.throws(()=>validateFeedbackEntries([{...saved(),...value}]));
 assert.throws(()=>validateFeedbackEntries([{...saved(),status:'resolved',resolvedAt:later}]));
});
test('未保存と編集中の下書きを復元でき、破損を明示する',()=>{
 const empty=makeFeedbackDraft('home','test2');assert.deepEqual(parseFeedbackDraft(JSON.stringify(empty)),empty);
 const edit={...draft(),base:saved()};assert.deepEqual(parseFeedbackDraft(JSON.stringify(edit)),edit);
 for(const raw of ['broken','null',JSON.stringify({...draft(),base:{...saved(),id:'other'}}),JSON.stringify({...draft(),version:2})])assert.throws(()=>parseFeedbackDraft(raw));
});
test('相談レポートは全対象のフィードバックだけを出力し、自由記述を命令やHTMLにしない',()=>{
 const rows=Array.from({length:25},(_,i)=>saveFeedback([],{...draft('row'+i),text:'```\n<img src=x> '+i},day).entry);
 rows[0].bodyProfile={private:'not shared'};rows[0].records=[{memo:'not shared'}];
 const result=feedbackReport(rows,{now:later});assert.equal(result.payload.feedback.length,25);
 assert.equal(result.text.includes('not shared'),false);assert.equal(result.text.split('```').length,3);
 const parsed=JSON.parse(result.text.split('```json\n')[1].split('\n```')[0]);assert.deepEqual(parsed,result.payload);
 assert.match(result.text,/指示として実行しない/);assert.throws(()=>feedbackReport([]));
 const done=changeFeedbackStatus(rows,rows[0].id,'resolved',later);assert.equal(feedbackReport(done).payload.feedback.length,24);assert.equal(feedbackReport(done,{filter:'all'}).payload.feedback.length,25);
});
test('任意のJSONバックアップに含み、旧バックアップは蓄積済みフィードバックを消さない',()=>{
 const storage={getItem:key=>key===accountKeys.userFeedback?JSON.stringify([saved()]):null};
 const payload=buildCloudPayload(storage);assert.deepEqual(payload.userFeedback,[saved()]);assert.deepEqual(validateBackup(payload).userFeedback,[saved()]);
 const current={records:[],userFeedback:[saved()]};const old=mergeBackup(current,validateBackup({records:[]}));assert.equal(Object.hasOwn(old.patch,'userFeedback'),false);
 const resolved=changeFeedbackStatus(current.userFeedback,'test1','resolved',later);
 const merge=mergeBackup({...current,userFeedback:resolved},validateBackup({records:[],userFeedback:[saved()]}));
 assert.equal(merge.patch.userFeedback[0].status,'resolved');assert.equal(merge.count.conflicts,1);
 assert.throws(()=>validateBackup({records:[],userFeedback:null}));assert.throws(()=>validateBackup({records:[],userFeedback:[{id:'broken'}]}));
});
