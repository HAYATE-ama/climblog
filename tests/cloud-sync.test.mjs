import test from 'node:test';
import assert from 'node:assert/strict';
import {saveCloudSnapshot,nextCloudVersion} from '../assets/js/cloud-sync.mjs';
function database(initial=null){let row=initial,requests=[];return {get row(){return row;},requests,client:{from(table){assert.equal(table,'user_app_state');return {update(value){const filters={};const q={eq(key,value){filters[key]=value;return q;},select(){return q;},async maybeSingle(){requests.push({op:'update',filters:{...filters}});if(row?.user_id!==filters.user_id||row?.updated_at!==filters.updated_at)return {data:null,error:null};row={...row,...value};return {data:{updated_at:row.updated_at},error:null};}};return q;},insert(value){const q={select(){return q;},async maybeSingle(){requests.push({op:'insert'});if(row)return {data:null,error:{code:'23505'}};row=value;return {data:{updated_at:row.updated_at},error:null};}};return q;}};}}};}
const initial={user_id:'alice',payload:{records:[{id:'first'}]},updated_at:'2026-10-29T00:00:00.000Z'};
test('only one of two snapshots based on the same cloud version can win',async()=>{
 const db=database(initial),save=records=>saveCloudSnapshot({client:db.client,userId:'alice',payload:{records},baseUpdatedAt:initial.updated_at,now:Date.parse(initial.updated_at)});
 const [a,b]=await Promise.all([save([{id:'first'},{id:'phone'}]),save([{id:'first'},{id:'pc'}])]);
 assert.equal(a.conflict,false);assert.equal(b.conflict,true);assert.deepEqual(db.row.payload.records,[{id:'first'},{id:'phone'}]);assert.equal(db.requests.length,2);
});
test('missing cloud row is inserted once; concurrent first saves do not upsert over it',async()=>{
 const db=database(),a=await saveCloudSnapshot({client:db.client,userId:'alice',payload:{records:[1]}}),b=await saveCloudSnapshot({client:db.client,userId:'alice',payload:{records:[2]}});
 assert.equal(a.conflict,false);assert.equal(b.conflict,true);assert.deepEqual(db.row.payload.records,[1]);
});
test('a different owner or deleted snapshot cannot be overwritten or recreated',async()=>{
 const db=database({...initial,user_id:'bob'});assert.equal((await saveCloudSnapshot({client:db.client,userId:'alice',payload:{},baseUpdatedAt:initial.updated_at})).conflict,true);assert.equal(db.row.user_id,'bob');
 const deleted=database();assert.equal((await saveCloudSnapshot({client:deleted.client,userId:'alice',payload:{},baseUpdatedAt:initial.updated_at})).conflict,true);assert.equal(deleted.row,null);
});
test('version always advances even within a millisecond or when a device clock is behind',()=>{
 assert.equal(nextCloudVersion('2030-01-01T00:00:00.000123Z',0),'2030-01-01T00:00:00.001Z');
 assert.equal(nextCloudVersion(null,1000),'1970-01-01T00:00:01.000Z');
});
test('network/auth errors remain errors and are not retried',async()=>{
 let calls=0;const client={from:()=>({update:()=>{const q={eq:()=>q,select:()=>q,maybeSingle:async()=>{calls++;return {error:{status:401,code:'PGRST301'}};}};return q;}})};
 await assert.rejects(()=>saveCloudSnapshot({client,userId:'alice',payload:{},baseUpdatedAt:initial.updated_at}),e=>e.status===401);assert.equal(calls,1);
});
test('invalid base versions fail before sending any payload',async()=>{
 const db=database(initial);await assert.rejects(()=>saveCloudSnapshot({client:db.client,userId:'alice',payload:{},baseUpdatedAt:'bad'}));assert.equal(db.requests.length,0);
});
