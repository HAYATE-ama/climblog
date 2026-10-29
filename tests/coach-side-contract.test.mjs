import test from 'node:test';
import assert from 'node:assert/strict';
import {coachInstructions,proposalSchema} from '../supabase/functions/ai-coach/proposal-schema.mjs';
import {normalizeAiSettings,buildAiInput,validateDailyDraft} from '../assets/js/ai-coach-contract.mjs';
import {equipmentCatalog} from '../assets/js/exercise-registry.mjs';
const settings=normalizeAiSettings({pain:'none',fatigue:'normal',climbingType:'boulder',equipment:equipmentCatalog.map(e=>e.id)});
const candidates=buildAiInput({},settings,'2026-10-29').candidates;
function item(d,side,id=d.exerciseId){const target=d.mode==='time'?(d.category==='climbing'?60:d.finger?5:30):d.manual?1:3;return {itemId:id,exerciseId:d.exerciseId,phase:d.phases[0],side,mode:d.mode,durationSeconds:Math.max(30,target),sets:[{target,restSeconds:d.finger?60:0,loadKg:0}]};}
function draft(d,side){const warm=candidates.find(c=>c.exerciseId==='wristCircles');return {schemaVersion:1,decision:'train',title:'左右指定のテスト',reason:'候補の左右定義に従う',warnings:[],preparationSeconds:0,transitionRestSeconds:0,items:[...(d.finger?[item(warm,null,'warmup')]:[]),item(d,side)]};}

test('provider instructions describe sidedness supplied in the candidate payload rather than a missing side field',()=>{
 assert.ok(candidates.every(c=>!Object.hasOwn(c,'side')&&['both','alternatingPair','separateSides'].includes(c.sidedness)));
 assert.match(coachInstructions,/sidednessがseparateSidesならleftまたはright/);
 assert.match(coachInstructions,/それ以外（both・alternatingPair）はnull/);
 assert.doesNotMatch(coachInstructions,/exerciseId\/mode\/side\/phases/);
 assert.deepEqual(proposalSchema.properties.items.items.properties.side.enum,['left','right',null]);
});

test('every candidate accepts the instructed side mapping and rejects a conflicting side without calling an API',()=>{
 const types=new Set();
 for(const d of candidates){types.add(d.sidedness);const side=d.sidedness==='separateSides'?'left':null;assert.doesNotThrow(()=>validateDailyDraft(draft(d,side),settings),d.exerciseId);if(side==='left')assert.doesNotThrow(()=>validateDailyDraft(draft(d,'right'),settings),d.exerciseId);assert.throws(()=>validateDailyDraft(draft(d,side===null?'left':null),settings),/左右の指定/,d.exerciseId);}
 assert.deepEqual([...types].sort(),['alternatingPair','both','separateSides']);
});
