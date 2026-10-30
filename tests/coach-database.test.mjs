import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase} from '../supabase/functions/ai-coach/database.mjs';
import {createCoachHandler} from '../supabase/functions/ai-coach/handler.mjs';
import {normalizeAiSettings,aiConsentVersion} from '../assets/js/ai-coach-contract.mjs';
const uid='00000000-0000-4000-8000-000000000001',requestId='00000000-0000-4000-8000-000000000002';
const options={url:'https://example.invalid',anonKey:'fake-anon',serviceKey:'fake-service'};
const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});

test('PostgREST successful empty writes accept 200, 201 and 204 without JSON parsing or retry',async()=>{
 for(const status of [200,201,204]){const calls=[];const db=createDatabase({...options,fetchImpl:async(url,init)=>{calls.push({url,init});return new Response(null,{status});}});
  await assert.doesNotReject(()=>db.saveSettings(uid,{enabled:false}));
  await assert.doesNotReject(()=>db.adopt({id:requestId,user_id:uid}));
  assert.equal(calls.length,2);assert.equal(calls[0].init.headers.Prefer,'resolution=merge-duplicates,return=minimal');assert.equal(calls[1].init.headers.Prefer,'resolution=ignore-duplicates,return=minimal');
 }
});

test('database adapter retains JSON read and RPC responses',async()=>{
 const db=createDatabase({...options,fetchImpl:async url=>url.includes('/rpc/')?json({action:'created',request:{id:requestId}}):json([{settings:{enabled:false}}])});
 assert.deepEqual(await db.settings(uid),{enabled:false});assert.equal((await db.claim({})).request.id,requestId);
});

test('database adapter rejects malformed JSON and unsuccessful HTTP without leaking provider body or retrying',async()=>{
 let calls=0;const badJson=createDatabase({...options,fetchImpl:async()=>{calls++;return new Response('<html>unexpected</html>',{status:200});}});
 await assert.rejects(()=>badJson.settings(uid),SyntaxError);assert.equal(calls,1);
 for(const status of [400,401,403,500]){let count=0;const db=createDatabase({...options,fetchImpl:async()=>{count++;return new Response('private database error text',{status});}});await assert.rejects(()=>db.saveSettings(uid,{}),error=>error.message==='SETUP_REQUIRED');assert.equal(count,1);}
});

test('real database adapter handles minimal settings save then one mocked generation through the handler',async()=>{
 let settings=normalizeAiSettings({enabled:true,consentVersion:aiConsentVersion,decisionVersion:aiConsentVersion,consentDecision:'accepted',pain:'none',fatigue:'normal'}),row=null,providerCalls=0,settingsWrites=0,claims=0;
 const now=new Date('2026-10-29T03:00:00Z');
 const db=createDatabase({...options,fetchImpl:async(raw,init)=>{const url=new URL(raw),body=init.body?JSON.parse(init.body):null;
  if(url.pathname==='/auth/v1/user')return json({id:uid});
  if(url.pathname==='/rest/v1/ai_coach_settings'){if(init.method==='POST'){settings=body.settings;settingsWrites++;return new Response(null,{status:201});}return json([{settings}]);}
  if(url.pathname==='/rest/v1/ai_coach_requests'){if(url.searchParams.get('select')==='id')return json(row?[{id:row.id}]:[]);if(url.searchParams.get('select')==='requested_at')return json(row?[{requested_at:row.requested_at}]:[]);return json(row?[row]:[]);}
  if(url.pathname==='/rest/v1/rpc/ai_coach_claim_v2'){claims++;row={id:body.p_request_id,user_id:uid,plan_date:body.p_day,state:'processing',settings_snapshot:body.p_settings,requested_at:now.toISOString(),input_hash:body.p_hash};return json({action:'created',request:row});}
  if(url.pathname==='/rest/v1/rpc/ai_coach_finish'){row={...row,state:body.p_state,draft:body.p_draft,model:body.p_model,finished_at:now.toISOString()};return json(row);}
  throw new Error('Unexpected mocked database route');
 }});
 const handler=createCoachHandler({db,configured:true,allowedUsers:[uid],now:()=>now,provider:async(input)=>{providerCalls++;assert.equal(input.note,'このあと外岩に行くので、準備を中心にしたい。\n補強は軽めで。');assert.equal(input.history,undefined);assert.equal(input.body,undefined);return {model:'mock-only',draft:{schemaVersion:1,decision:'train',title:'テスト用ウォームアップ',reason:'保存後の生成経路を確認',warnings:[],preparationSeconds:0,transitionRestSeconds:0,items:[{itemId:'wrist',exerciseId:'wristCircles',phase:'warmup',side:null,mode:'time',durationSeconds:30,sets:[{target:30,restSeconds:0,loadKg:0}]}]}};}});
 const send=body=>handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer fake-token'},body:JSON.stringify(body)}));
 const saved=await send({action:'saveSettings',settings:{...settings,availableMinutes:30,note:'このあと外岩に行くので、準備を中心にしたい。\n補強は軽めで。'}});assert.equal(saved.status,200);assert.equal((await saved.json()).settings.enabled,true);assert.equal(settingsWrites,1);assert.equal(providerCalls,0);
 const generated=await send({action:'generate',requestId,force:false});assert.equal(generated.status,200);const result=await generated.json();assert.equal(result.proposal.draft.title,'テスト用ウォームアップ');assert.equal(result.proposal.proposalId,requestId);assert.equal(providerCalls,1);assert.equal(claims,1);assert.equal(result.usage.today,1);assert.equal(result.proposal.settings.note,settings.note);
});
