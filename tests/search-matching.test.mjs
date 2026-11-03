import test from 'node:test';
import assert from 'node:assert/strict';
import {searchRecords} from '../assets/js/features.mjs';
const rows=[{id:'a',date:'2026-11-01',kind:'gym',place:'御岳ジム',grade:'１級',memo:'ｽﾗﾌﾞで足を意識'},{id:'b',date:'2026-11-02',kind:'outdoor',place:'御岳',grade:'1級',memo:'スラブ'},{id:'c',date:'2026-11-03',kind:'gym',place:'Ａｌｐｈａ',grade:'5級',memo:'[右] .* Café'}];
test('width, case, kana and composed accents match without rewriting records',()=>{
 const before=JSON.stringify(rows);
 assert.deepEqual(searchRecords(rows,'1級').map(r=>r.id),['b','a']);
 assert.deepEqual(searchRecords(rows,'ａｌｐｈａ').map(r=>r.id),['c']);
 assert.deepEqual(searchRecords(rows,'スラブ').map(r=>r.id),['b','a']);
 assert.deepEqual(searchRecords(rows,'CAFE\u0301').map(r=>r.id),['c']);
 assert.equal(JSON.stringify(rows),before);
});
test('all words must match, in any order, together with kind and inclusive period',()=>{
 assert.deepEqual(searchRecords(rows,'１級　スラブ 御岳','gym',{from:'2026-11-01',to:'2026-11-01'}).map(r=>r.id),['a']);
 assert.deepEqual(searchRecords(rows,'御岳 5級'),[]);
 assert.deepEqual(searchRecords(rows,'スラブ 御岳','outdoor').map(r=>r.id),['b']);
});
test('punctuation remains literal, whitespace is optional and sorting is preserved',()=>{
 assert.deepEqual(searchRecords(rows,'[右] .*').map(r=>r.id),['c']);
 assert.deepEqual(searchRecords(rows,'.*missing'),[]);
 assert.deepEqual(searchRecords(rows,'　 \t').map(r=>r.id),['c','b','a']);
 assert.deepEqual(searchRecords(rows,' 御岳  \t スラブ ').map(r=>r.id),['b','a']);
});
