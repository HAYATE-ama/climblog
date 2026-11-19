import test from 'node:test';
import assert from 'node:assert/strict';
import {addCircuitRoutes,circuitNumbers,circuitRecords,circuitStats,createCircuit,parseCircuitDraft,recordCircuitTry,undoCircuitTry} from '../assets/js/grade-circuit.mjs';
import {recordSummary} from '../assets/js/compact-records.mjs';
import {validateBackup} from '../assets/js/backup-model.mjs';
const start=(options={})=>createCircuit({date:'2026-11-18',gym:'サンプル',grade:'赤 / 2級',swatch:'#ff0000',numbered:true,total:12,...options});

test('連番を一括表示し、登録しただけの課題は記録せず、完登とトライを別々に数える',()=>{
  const s=start();assert.equal(s.routes.length,12);assert.deepEqual(circuitRecords(s),[]);
  for(const sent of [false,false,true])recordCircuitTry(s,7,sent);
  assert.deepEqual(circuitStats(s),{sends:1,tries:3,completed:1,falls:2});
  const [r]=circuitRecords(s);assert.equal(r.memo,'8番');assert.equal(r.tries,3);assert.equal(r.sends,1);
  assert.doesNotThrow(()=>validateBackup({records:[r]}));assert.throws(()=>validateBackup({records:[{...r,circuitRoute:{kind:'number',mark:'foo',wall:''}}]}));
  assert.match(recordSummary(r).title,/8番/);assert.equal(circuitRecords(s)[0].id,r.id);
  const restored=parseCircuitDraft(JSON.stringify(s));undoCircuitTry(restored);
  assert.deepEqual(circuitStats(restored),{sends:0,tries:2,completed:0,falls:2});assert.equal(circuitRecords(restored)[0].gymOutcome,'failed');
});

test('同じ課題で完登と途中落ちを繰り返し、取り消し・再読込・保存でも別々の回数を保つ',()=>{
  const s=start({total:1});
  for(const sent of [true,true,false,true,false])recordCircuitTry(s,0,sent);
  assert.deepEqual(circuitStats(s),{sends:3,tries:5,completed:1,falls:2});
  const restored=parseCircuitDraft(JSON.stringify(s));undoCircuitTry(restored);
  assert.deepEqual(circuitStats(restored),{sends:3,tries:4,completed:1,falls:1});
  const [row]=circuitRecords(restored);assert.equal(row.sends,3);assert.equal(row.tries,4);
  assert.doesNotThrow(()=>validateBackup({records:[row]}));
  assert.throws(()=>parseCircuitDraft(JSON.stringify({...s,routes:[{...s.routes[0],sends:6}]})));
});

test('旧版の完登チェックと取り消し履歴を、回数として引き継ぐ',()=>{
  const s=start({total:1});s.version=1;s.routes[0]={kind:'number',mark:'1',wall:'',tries:3,sent:true};s.undo={index:0,tries:2,sent:false};
  const restored=parseCircuitDraft(JSON.stringify(s));assert.equal(restored.version,2);
  assert.deepEqual(circuitStats(restored),{sends:1,tries:3,completed:1,falls:2});
  undoCircuitTry(restored);recordCircuitTry(restored,0,true);recordCircuitTry(restored,0,true);
  assert.equal(circuitRecords(restored)[0].sends,2);
});
test('飛び番・テープ・壁の組合せ、既存の目印、未設定の総数',()=>{
  const s=start({total:null});assert.equal(s.routes.length,0);
  assert.deepEqual(circuitNumbers('３、8、12、14-16、１５'),['3','8','12','14','15','16']);
  for(const bad of ['1-0','0','3,A','1-999',''])assert.throws(()=>circuitNumbers(bad));
  addCircuitRoutes(s,'tape',['＋'],'ルーフ左');assert.equal(addCircuitRoutes(s,'tape',['+'],'ルーフ左 ').added,0);
  addCircuitRoutes(s,'tape',['＋'],'垂壁');addCircuitRoutes(s,'tape',['×','逆L字'],'垂壁');
  addCircuitRoutes(s,'number',circuitNumbers('12'),'');assert.equal(s.routes.length,5);
  recordCircuitTry(s,1,false);assert.equal(circuitRecords(s)[0].memo,'垂壁 · ＋');
  const capped=start({total:2,numbered:false});addCircuitRoutes(capped,'number',['17'],'');
  assert.throws(()=>addCircuitRoutes(capped,'number',['18','19'],''));assert.equal(capped.routes.length,1);
  assert.throws(()=>parseCircuitDraft(JSON.stringify({...s,total:1})));
});
