import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateToLocal,createLocalWriter,localProfileKey,localRecoveryKey} from '../assets/js/local-storage.mjs';
import {accountKeys} from '../assets/js/account-storage.mjs';
class Store{
  map=new Map();failKey=null;
  get length(){return this.map.size;}
  key(i){return [...this.map.keys()][i]??null;}
  getItem(k){if(/token/.test(k))throw new Error('credentials must not be read');return this.map.get(k)??null;}
  setItem(k,v){if(k===this.failKey){this.failKey=null;throw new Error('quota');}this.map.set(k,String(v));}
  removeItem(k){this.map.delete(k);}
  json(k,v){this.setItem(k,JSON.stringify(v));}
}
const pending=(s,id,payload)=>s.json('climbLogPendingState:'+id,{userId:id,revision:'revision-1',payload});
test('初回は端末保存先を作り、再起動では同じ保存先を使う',()=>{
  const s=new Store();const p=migrateToLocal(s);assert.equal(p.id,'device');assert.deepEqual(migrateToLocal(s),p);
  assert.equal(s.getItem(localRecoveryKey),null);
});
test('未同期の最後の編集・削除・設定と旧下書きの保存先を引き継ぎ、原本を保持する',()=>{
  const s=new Store();s.setItem('climbLogAuth:sample:owner','alice');s.setItem('climbLogAuth:sample:token','do-not-read');
  s.json(accountKeys.records,[{id:'deleted'},{id:'edited',memo:'old'}]);s.json(accountKeys.trainingMenus,[{id:'menu'}]);
  s.setItem('climbLogGradeCircuit:alice','existing draft');
  const rows=[{id:'edited',memo:'new'},{id:'new'}];pending(s,'alice',{records:rows,preferences:{theme:'light'},bodyWeights:[{date:'2026-11-19',kg:60}]});
  pending(s,'bob',{records:[{id:'foreign'}]});
  const p=migrateToLocal(s,{project:'sample'});assert.equal(p.id,'alice');assert.deepEqual(JSON.parse(s.getItem(accountKeys.records)),rows);
  assert.deepEqual(JSON.parse(s.getItem(accountKeys.trainingMenus)),[{id:'menu'}]);
  assert.equal(s.getItem('climbLogGradeCircuit:alice'),'existing draft');
  const backup=JSON.parse(s.getItem(localRecoveryKey));assert.equal(JSON.parse(backup.local.records)[0].id,'deleted');
  assert.ok(s.getItem('climbLogPendingState:alice'));assert.ok(s.getItem('climbLogPendingState:bob'));
  s.json(accountKeys.records,[]);migrateToLocal(s);assert.deepEqual(JSON.parse(s.getItem(accountKeys.records)),[],'legacy pending must not resurrect records');
});
test('空の未同期一覧は削除として維持し、保存先不明のデータは混ぜない',()=>{
  const s=new Store();s.setItem('climbLogAuth:p:owner','alice');s.json(accountKeys.records,[{id:'old'}]);s.json(accountKeys.gyms,[{name:'old'}]);pending(s,'alice',{records:[],gyms:null});
  migrateToLocal(s);assert.deepEqual(JSON.parse(s.getItem(accountKeys.records)),[]);assert.equal(JSON.parse(s.getItem(accountKeys.gyms)),null);
  const unknown=new Store();unknown.json(accountKeys.records,[{id:'current'}]);pending(unknown,'alice',{records:[{id:'other'}]});
  assert.match(migrateToLocal(unknown).notice,/保存先/);assert.deepEqual(JSON.parse(unknown.getItem(accountKeys.records)),[{id:'current'}]);
});
test('移行途中の容量不足は原本と完了印を巻き戻し、再実行できる',()=>{
  const s=new Store();s.setItem('climbLogAuth:p:owner','alice');s.json(accountKeys.records,[{id:'old'}]);pending(s,'alice',{records:[{id:'new'}]});
  s.failKey=localProfileKey;assert.throws(()=>migrateToLocal(s),/quota/);assert.equal(s.getItem(localProfileKey),null);assert.equal(s.getItem(localRecoveryKey),null);
  assert.deepEqual(JSON.parse(s.getItem(accountKeys.records)),[{id:'old'}]);
  migrateToLocal(s);assert.equal(JSON.parse(s.getItem(accountKeys.records))[0].id,'new');
});
test('壊れた未同期データは上書きせず保管し、複数の保存先を自動混合しない',()=>{
  const s=new Store();s.setItem('climbLogAuth:p:owner','alice');s.json(accountKeys.records,[{id:'current'}]);s.setItem('climbLogPendingState:alice','bad json');
  assert.match(migrateToLocal(s).notice,/取り込めません/);assert.ok(s.getItem(localRecoveryKey));assert.equal(JSON.parse(s.getItem(accountKeys.records))[0].id,'current');
  const multiple=new Store();multiple.setItem('climbLogAuth:p:owner','alice');multiple.setItem('climbLogAuth:q:owner','bob');
  assert.throws(()=>migrateToLocal(multiple),/複数/);assert.equal(multiple.getItem(localProfileKey),null);
});
test('端末保存の成功・容量不足・別画面の更新を区別する',()=>{
  const s=new Store();s.json(accountKeys.records,[]);let saved=0,errors=0;
  const writer=createLocalWriter(s,{onSaved:()=>saved++,onError:()=>errors++});
  writer([{key:accountKeys.records,value:'[{"id":"first"}]'}]);assert.equal(saved,1);
  s.failKey=accountKeys.preferences;
  assert.throws(()=>writer([{key:accountKeys.records,value:'[]'},{key:accountKeys.preferences,value:'{}'}]),/quota/);
  assert.equal(JSON.parse(s.getItem(accountKeys.records))[0].id,'first');assert.equal(saved,1);assert.equal(errors,1);
  s.json(accountKeys.records,[{id:'other-tab'}]);assert.throws(()=>writer([{key:accountKeys.records,value:'[]'}]),/別の画面/);
  assert.equal(JSON.parse(s.getItem(accountKeys.records))[0].id,'other-tab');
});
