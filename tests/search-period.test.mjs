import test from 'node:test';
import assert from 'node:assert/strict';
import {searchRecords,validateSearchPeriod} from '../assets/js/features.mjs';
const rows=[{id:'a',date:'2026-10-01',kind:'gym',place:'御岳ジム'},{id:'b',date:'2026-10-31',kind:'outdoor',place:'御岳'},{id:'c',date:'2026-11-01',kind:'gym',place:'御岳ジム'}];
test('period is inclusive, combines with text and activity, leaves source order intact',()=>{
 const copy=JSON.stringify(rows);
 assert.deepEqual(searchRecords(rows,'御岳','all',{from:'2026-10-01',to:'2026-10-31'}).map(r=>r.id),['b','a']);
 assert.deepEqual(searchRecords(rows,'御岳','gym',{from:'2026-10-01',to:'2026-10-31'}).map(r=>r.id),['a']);
 assert.equal(JSON.stringify(rows),copy);
});
test('one-sided, same-day and empty periods preserve expected history',()=>{
 assert.deepEqual(searchRecords(rows,'','all',{from:'2026-10-31'}).map(r=>r.id),['c','b']);
 assert.deepEqual(searchRecords(rows,'','all',{to:'2026-10-01'}).map(r=>r.id),['a']);
 assert.deepEqual(searchRecords(rows,'','all',{from:'2026-10-31',to:'2026-10-31'}).map(r=>r.id),['b']);
 assert.equal(searchRecords(rows).length,3);
});
test('invalid and reversed dates give actionable errors rather than unfiltered history',()=>{
 for(const period of [{from:'2026-02-30'},{to:'bad'},{from:'2026-11-01',to:'2026-10-01'}]){
  assert.ok(validateSearchPeriod(period));assert.deepEqual(searchRecords(rows,'','all',period),[]);
 }
 assert.equal(validateSearchPeriod({from:'2024-02-29'}),'');
 assert.ok(validateSearchPeriod({from:'2025-02-29'}));
});
