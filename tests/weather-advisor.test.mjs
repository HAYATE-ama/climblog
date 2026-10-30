import test from 'node:test';
import assert from 'node:assert/strict';
import {createWeatherHandler} from '../supabase/functions/weather-advisor/handler.mjs';
import {createWeatherProvider} from '../supabase/functions/weather-advisor/provider.mjs';
import {weatherConsentVersion} from '../assets/js/outdoor-planner-model.mjs';
const user='00000000-0000-4000-8000-000000000001',time=Date.parse('2026-10-31T10:00:00+09:00');
const input={style:'comfort',candidates:[{id:'site-a:2026-10-31',crag:'テスト岩場',date:'2026-10-31',status:'unknown',issuedAt:'2026-10-31T05:00:00+09:00',reasons:['乾燥は未確認'],missing:['乾燥'],notes:''}]};
function setup({configured=true,providerError=null}={}){
 let row=null,calls=0,claims=0;const db={authenticate:async token=>token==='test-token'?user:null,today:async()=>row,async claim(args){claims++;if(row)return {action:'existing',row};row={state:'processing',input_hash:args.p_hash,input:args.p_input};return {action:'created',row};},async finish(u,d,value){Object.assign(row,value);}};
 const handler=createWeatherHandler({db,configured,allowedUsers:[user],now:()=>time,provider:async()=>{calls++;if(providerError)throw new Error(providerError);return {comparisons:[{id:input.candidates[0].id,reasonIndices:[0]}]};}});
 const send=(body,token='test-token',origin='https://hayate-ama.github.io')=>handler(new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer '+token,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
 return {send,calls:()=>calls,claims:()=>claims,row:()=>row};
}
const compare=()=>({action:'compare',input,consentVersion:weatherConsentVersion});
test('status, missing setup, auth, origin and missing consent never call AI',async()=>{
 const s=setup();assert.equal((await s.send({action:'status'})).status,200);assert.equal((await s.send(compare(),'bad')).status,401);assert.equal((await s.send(compare(),'test-token','https://evil.invalid')).status,403);assert.equal((await s.send({...compare(),consentVersion:'old-coach-consent'})).status,409);assert.equal(s.calls(),0);
 const unconfigured=setup({configured:false});assert.equal((await unconfigured.send(compare())).status,409);assert.equal(unconfigured.calls(),0);
});
test('same-day concurrent comparisons reserve once; cached data can be reopened without AI',async()=>{
 const s=setup(),responses=await Promise.all([s.send(compare()),s.send(compare())]);assert.equal(s.calls(),1);assert.ok(responses.some(r=>r.status===200));const cached=await s.send(compare());assert.equal((await cached.json()).cached,true);assert.equal(s.calls(),1);
 const changed=await s.send({...compare(),input:{...input,style:'performance'}});assert.equal((await changed.json()).code,'DAILY_LIMIT');assert.equal(s.calls(),1);
 const status=await (await s.send({action:'status'})).json();assert.equal(status.result.comparisons[0].explanation,'乾燥は未確認');
});
test('provider failure counts as an attempt and is not retried',async()=>{
 const s=setup({providerError:'PROVIDER_LIMIT'});assert.equal((await (await s.send(compare())).json()).code,'PROVIDER_LIMIT');assert.equal(s.row().state,'failed');assert.equal((await (await s.send(compare())).json()).code,'DAILY_LIMIT');assert.equal(s.calls(),1);
});
test('stale forecasts, impossible dates, no forecast and oversize inputs fail before reserving quota',async()=>{
 for(const patch of [{issuedAt:'2026-10-29T05:00:00+09:00'},{date:'2026-11-10'},{date:'2026-02-30'},{issuedAt:''}]){
  const s=setup();const response=await s.send({...compare(),input:{...input,candidates:[{...input.candidates[0],...patch}]}});assert.equal(response.status,409);assert.equal(s.claims(),0);assert.equal(s.calls(),0);
 }
});
test('provider uses server header, bounded JSON and no tools/fallback or automatic retry',async()=>{
 let calls=0,options,url;const provider=createWeatherProvider({key:'synthetic-key-not-a-secret',fetchImpl:async(u,o)=>{calls++;url=u;options=o;return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({comparisons:[{id:'test',reasonIndices:[0]}]})}]}}]})};}});
 await provider(input);assert.equal(calls,1);assert.match(url,/generativelanguage.googleapis.com/);const body=JSON.parse(options.body);assert.equal(body.tools,undefined);assert.equal(body.contents[0].parts[0].text.includes('synthetic-key'),false);assert.equal(options.headers['x-goog-api-key'],'synthetic-key-not-a-secret');
 const limited=createWeatherProvider({key:'synthetic',fetchImpl:async()=>{calls++;return {ok:false,status:429};}});await assert.rejects(()=>limited(input),/PROVIDER_LIMIT/);assert.equal(calls,2);
});

test('UTF-8 payload budget is enforced before reservation, including Japanese input',async()=>{const s=setup();const response=await s.send({...compare(),padding:'あ'.repeat(23000)});assert.equal(response.status,413);assert.equal(s.calls(),0);assert.equal(s.claims(),0);});
