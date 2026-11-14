import test from 'node:test';
import assert from 'node:assert/strict';
import {addOutdoorWish,wishlistEntries} from '../assets/js/outdoor-wishlist-model.mjs';
import {validateBackup,mergeBackup} from '../assets/js/backup-model.mjs';
import {buildCloudPayload} from '../assets/js/features.mjs';
import {loadAccountPayload,writeAccountPatch} from '../assets/js/account-storage.mjs';
import {outdoorDanSummary} from '../assets/js/outdoor-season.mjs';

const attempt={id:'attempt',date:'2026-11-01',kind:'outdoor',cragName:'岩場A',routeName:'課題B',grade:'二段',memo:'核心まで',result:'attempt'};
const wishes=addOutdoorWish([],attempt);
const send={...attempt,id:'send',result:'send',date:'2026-11-03'};
test('wishlist creation does not add a climbing record or season points',()=>{
 assert.equal(wishes.length,1);assert.equal(wishes[0].outdoorGrade,'二段');
 assert.equal(wishes[0].memo,undefined);
 assert.equal(outdoorDanSummary([attempt],{from:'2026-11-01',to:'2026-12-01'}).totalDan,0);
 assert.throws(()=>addOutdoorWish(wishes,{...attempt,routeName:' 課題Ｂ '}),/すでに/);
 assert.throws(()=>addOutdoorWish([],{...attempt,cragName:'未設定'}),/岩場/);
 assert.equal(addOutdoorWish([],{...attempt,grade:'NoGrade'})[0].outdoorGrade,'NoGrade');
 assert.equal(addOutdoorWish([],{...attempt,grade:''})[0].outdoorGrade,'');
});
test('completion and latest note follow edits and removals without merging names across crags, areas or disciplines',()=>{
 const other=[{...send,cragName:'別'},{...send,areaName:'別'},{...send,discipline:'lead'}];
 assert.deepEqual(wishlistEntries(wishes,[attempt,...other])[0],{wish:wishes[0],latest:attempt,done:false});
 const later={...attempt,date:'2026-11-04',memo:'再トライ'};
 const result=wishlistEntries(wishes,[later,send,attempt])[0];assert.equal(result.latest,later);assert.ok(result.done);
 assert.equal(wishlistEntries(wishes,[attempt,{...send,result:'attempt'}])[0].done,false);
 assert.equal(wishlistEntries(wishes,[attempt])[0].done,false);
});
test('recording a previously unspecified area preserves the link; renaming the route does not complete an unrelated wish',()=>{
 const refined={...send,areaName:'岩南面',outdoorWishId:wishes[0].id};assert.ok(wishlistEntries(wishes,[refined])[0].done);
 assert.equal(wishlistEntries(wishes,[{...refined,routeName:'別ルート'}])[0].done,false);
});
test('validated backups merge independently of settings, deduplicate the route and keep the local ID',()=>{
 assert.deepEqual(validateBackup({records:[attempt],outdoorWishlist:wishes}).outdoorWishlist,wishes);
 const other={...wishes[0],id:'different',starred:true};
 assert.deepEqual(mergeBackup({records:[],outdoorWishlist:wishes},{records:[],outdoorWishlist:[other]}).patch.outdoorWishlist,wishes);
 assert.deepEqual(mergeBackup({records:[],outdoorWishlist:wishes},{records:[],outdoorWishlist:[other]},{overwrite:true}).patch.outdoorWishlist,[{...wishes[0],starred:true}]);
 const refined={...send,areaName:'追加したエリア',outdoorWishId:other.id};
 const merged=mergeBackup({records:[],outdoorWishlist:wishes},{records:[refined],outdoorWishlist:[other]}).patch;
 assert.equal(merged.records[0].outdoorWishId,wishes[0].id);assert.ok(wishlistEntries(merged.outdoorWishlist,merged.records)[0].done);
 assert.throws(()=>validateBackup({records:[],outdoorWishlist:[wishes[0],other]}),/重複/);
 assert.throws(()=>validateBackup({records:[],outdoorWishlist:[{...other,starred:'true'}]}));
 assert.deepEqual(mergeBackup({records:[],outdoorWishlist:wishes},{records:[]}).patch.outdoorWishlist,undefined);
});
test('wishlist data is included in cloud snapshots and replaced on account switch, including older empty payloads',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 writeAccountPatch(storage,{outdoorWishlist:wishes});const payload=buildCloudPayload(storage);
 assert.deepEqual(payload.outdoorWishlist,wishes);assert.deepEqual(payload.records,[]);
 loadAccountPayload(storage,{records:[]},storage.setItem,storage.removeItem);assert.deepEqual(buildCloudPayload(storage).outdoorWishlist,[]);
 loadAccountPayload(storage,payload,storage.setItem,storage.removeItem);assert.deepEqual(buildCloudPayload(storage).outdoorWishlist,wishes);
});
