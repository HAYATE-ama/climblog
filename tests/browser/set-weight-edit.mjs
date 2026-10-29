import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.CLIMBLOG_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),resultDir=fs.mkdtempSync(path.join(os.tmpdir(),'climblog-ui-'));console.log('Test artifacts: '+resultDir);
const bootstrap=`
window.climbLogAccountId='dashboard-test';
const fmt=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');const now=new Date(),old=new Date(now);old.setDate(old.getDate()-3);window.__today=fmt(now);window.__oldDate=fmt(old);
window.__richRecords=[{id:'gym-note',date:window.__oldDate,kind:'gym',gymName:'B-PUMP TOKYO 秋葉原',place:'B-PUMP TOKYO 秋葉原',grade:'青テープ / 3級',sends:2,tries:6,memo:'足を置く位置を変えたら、手を離せた。'},
{id:'outdoor-send',date:window.__today,kind:'outdoor',cragName:'御岳',place:'御岳',routeName:'岩場の課題',grade:'1級',result:'send',sends:1,tries:8,memo:'ひとつずつ動きをつないで完登。'},
{id:'routine',date:window.__today,kind:'training',trainingMode:'routine',place:'自宅',exerciseName:'自重懸垂',grade:'自重懸垂',sets:4,reps:6,durationMinutes:20,loadKg:10,rpe:7,bodyweightKg:63.2,memo:'肩の位置を意識。'},
{id:'max-1',date:window.__oldDate,kind:'training',trainingMode:'maxTest',maxType:'hangboard',gripType:'halfCrimp',edgeDepthMm:20,holdSeconds:7,exerciseName:'ハングボード保持',grade:'ハングボード保持',place:'自宅',addedWeightKg:10,bodyweightKg:60,totalLoadKg:70,sets:1},
{id:'max-2',date:window.__today,kind:'training',trainingMode:'maxTest',maxType:'hangboard',gripType:'halfCrimp',edgeDepthMm:20,holdSeconds:7,exerciseName:'ハングボード保持',grade:'ハングボード保持',place:'自宅',addedWeightKg:15,bodyweightKg:60,totalLoadKg:75,sets:1}];
if(!localStorage.getItem('__dashboardSeed')){localStorage.setItem('climbLogRecords','[]');localStorage.setItem('climbLogGoals',JSON.stringify({gymDaysMonthly:8,outdoorDaysYearly:12}));localStorage.setItem('climbLogBodyProfile',JSON.stringify({heightCm:170,reachCm:178}));localStorage.setItem('climbLogBodyWeights',JSON.stringify([{date:window.__oldDate,kg:65},{date:window.__today,kg:63.2}]));localStorage.setItem('__dashboardSeed','1');}
document.querySelector('#authScreen').hidden=true;document.querySelector('#authScreen').style.display='none';document.querySelector('#appRoot').hidden=false;document.querySelector('#syncState').textContent='ローカル動作確認';await import('/assets/js/app.js');await import('/assets/js/enhancements.js');window.__appReady=true;`;
const server=http.createServer((req,res)=>{
 if(req.url==='/test.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<script src="./config.js"></script><script type="module" src="./assets/js/cloud.js"></script>',`<script type="module">${bootstrap}</script>`));return;}
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.webmanifest')?'application/manifest+json':file.endsWith('.png')?'image/png':'text/plain'});res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;let browser;const report=[];
try{
 browser=await chromium.launch({executablePath:process.env.CLIMBLOG_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'});
  await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(origin+'/test.html');await page.waitForFunction(()=>window.__appReady);
  if(width===390){await page.locator('#settingsTab').click();await page.locator('#settingsAppearance').click();await page.locator('#themeSetting').selectOption('light');await page.locator('#settingsDrawerClose').click();}
  await page.evaluate(()=>{
   window.climbLogStateApi.apply({records:[{id:'unknown-weight',date:window.__today,kind:'training',trainingMode:'routine',exerciseName:'片手リフト（地面から）（左）',grade:'片手リフト（地面から）（左）',place:'自宅',loadMethod:'liftFromGround',sets:2,reps:2,loadKg:0,durationMinutes:1,setDetails:[{reps:2,holdSeconds:0,loadKg:0,loadRecorded:false},{reps:2,holdSeconds:0,loadKg:8,loadRecorded:true}]}]});
   window.climbLogRecordApi.open('training','unknown-weight',window.__today);
  });
  await page.locator('.studioSection details').filter({hasText:'セットごとに詳しく記録'}).evaluate(el=>el.open=true);
  const weight=page.locator('[data-set-field=loadKg]').first(),reps=page.locator('[data-set-field=reps]').first();
  const collect=()=>page.evaluate(()=>window.climbLogRecordApi.collect());
  assert.equal(await weight.inputValue(),'');assert.equal((await collect()).setDetails[0].loadRecorded,false);
  await reps.fill('3');assert.equal((await collect()).setDetails[0].loadRecorded,false);
  await weight.fill('0');assert.equal((await collect()).setDetails[0].loadRecorded,true);assert.match((await collect()).summary,/重量なし|0〜8kg/);
  await weight.fill('');assert.equal((await collect()).setDetails[0].loadRecorded,false);
  await weight.fill('12.5');await page.locator('#save').click();
  const saved=await page.evaluate(()=>window.climbLogStateApi.get().records[0]);
  assert.equal(saved.setDetails[0].loadKg,12.5);assert.equal(saved.setDetails[0].loadRecorded,true);assert.equal(saved.setDetails[0].reps,3);
  assert.equal(saved.setDetails[1].loadKg,8);assert.equal(saved.setDetails[1].loadRecorded,true);
  const facts=await page.evaluate(async()=>{const {summarizeRoutineExercises}=await import('/assets/js/exercise-history.mjs');return summarizeRoutineExercises(window.climbLogStateApi.get().records)[0];});
  assert.equal(facts.weightSampleCount,2);assert.equal(facts.maxExternalKg,12.5);assert.equal(facts.minExternalKg,8);
  await page.evaluate(()=>window.climbLogRecordApi.open('training','unknown-weight',window.__today));
  await page.locator('.studioSection details').filter({hasText:'セットごとに詳しく記録'}).evaluate(el=>el.open=true);
  assert.equal(await weight.inputValue(),'12.5');await weight.fill('');await page.locator('#save').click();
  const cleared=await page.evaluate(()=>window.climbLogStateApi.get().records[0]);assert.equal(cleared.setDetails[0].loadRecorded,false);assert.equal(cleared.setDetails[0].loadKg,0);assert.equal(cleared.setDetails[1].loadKg,8);
  await page.evaluate(()=>window.climbLogRecordApi.open('training','unknown-weight',window.__today));await page.locator('.studioSection details').filter({hasText:'セットごとに詳しく記録'}).evaluate(el=>el.open=true);
  assert.equal(await weight.inputValue(),'');await weight.fill('0');await page.locator('#save').click();
  const zero=await page.evaluate(()=>window.climbLogStateApi.get().records[0]);assert.equal(zero.setDetails[0].loadRecorded,true);assert.equal(zero.setDetails[0].loadKg,0);
  // Uniform manual input confirms a displayed zero; clearing it preserves an unknown weight.
  await page.evaluate(()=>window.climbLogRecordApi.open('training',null,window.__today));await page.locator('#trainingMode').selectOption('routine');
  assert.equal((await collect()).loadRecorded,true);await page.locator('#cancel').click();
  await page.evaluate(()=>window.climbLogRecordApi.open('training','unknown-weight',window.__today));
  await page.locator('.studioSection details').filter({hasText:'セットごとに詳しく記録'}).evaluate(el=>el.open=true);
  await page.locator('#setEntryMode').selectOption('uniform');await page.locator('#trainingSets').selectOption('2');await page.locator('#trainingReps').selectOption('3');await page.locator('#trainingLoad').selectOption('0');await page.locator('#save').click();
  let uniform=await page.evaluate(()=>window.climbLogStateApi.get().records[0]);assert.equal(uniform.loadRecorded,true);assert.deepEqual(uniform.setDetails,[]);
  let uniformFacts=await page.evaluate(async()=>{const {trainingVolume}=await import('/assets/js/training-model.mjs'),{renderReadOnlyRecord}=await import('/assets/js/record-viewer.mjs');const r=window.climbLogStateApi.get().records[0];return {volume:trainingVolume(r),html:renderReadOnlyRecord(r)};});assert.equal(uniformFacts.volume.loadCount,2);assert.match(uniformFacts.html,/重量なし/);
  await page.evaluate(()=>window.climbLogRecordApi.open('training','unknown-weight',window.__today));await page.locator('#trainingLoad').evaluate(el=>{el.value='';el.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#save').click();
  uniform=await page.evaluate(()=>window.climbLogStateApi.get().records[0]);assert.equal(uniform.loadRecorded,false);assert.equal(uniform.loadKg,0);
  uniformFacts=await page.evaluate(async()=>{const {trainingVolume}=await import('/assets/js/training-model.mjs');return trainingVolume(window.climbLogStateApi.get().records[0]);});assert.equal(uniformFacts.loadCount,0);
  // Reopening an unknown uniform record must not confirm zero merely by saving a memo.
  await page.evaluate(()=>window.climbLogRecordApi.open('training','unknown-weight',window.__today));assert.equal(await page.locator('#trainingLoad').inputValue(),'');await page.locator('#trainingMemo').fill('重量はまだ未記録');await page.locator('#save').click();
  assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().records[0].loadRecorded),false);
  for(const [loadMethod,loadKg,known]of [['added',0,false],['added',10,true],['added',12.5,true],['added',120,true],['bodyweight',0,true]]){
   await page.evaluate(({loadMethod,loadKg})=>{const state=window.climbLogStateApi.get(),row={...state.records[0],loadMethod,loadKg};delete row.loadRecorded;window.climbLogStateApi.apply({records:[row]});window.climbLogRecordApi.open('training',row.id,window.__today);},{loadMethod,loadKg});
   assert.equal(await page.locator('#trainingLoad').inputValue(),known?String(loadKg):'');await page.locator('#trainingMemo').fill('以前の記録のメモだけ変更');await page.locator('#save').click();
   const row=await page.evaluate(()=>window.climbLogStateApi.get().records[0]);assert.equal(row.loadRecorded,known);assert.equal(row.loadKg,loadKg);assert.equal(row.loadMethod,loadMethod);
  }
  // Maximum tests must validate through the actual Save button, which is not native form submission.
  await page.evaluate(()=>window.climbLogRecordApi.open('training',null,window.__today));
  await page.locator('#trainingMode').selectOption('maxTest');await page.locator('#maxType').selectOption('weightedPullup');
  for(const value of ['', '301', '1e309']){await page.locator('#maxAddedWeight').fill(value);await page.locator('#save').click();assert.equal(await page.locator('#modal').evaluate(el=>el.classList.contains('open')),true);assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().records.length),1);}
  await page.locator('#maxAddedWeight').fill('0');await page.locator('#maxType').selectOption('hangboard');await page.locator('#edgeDepthMm').fill('101');await page.locator('#holdSeconds').fill('7');await page.locator('#save').click();assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().records.length),1);
  await page.locator('#edgeDepthMm').fill('20');await page.locator('#holdSeconds').fill('301');await page.locator('#save').click();assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().records.length),1);
  await page.locator('#maxAddedWeight').fill('301');await page.locator('#maxType').selectOption('singleHandLift');await page.locator('#liftHand').selectOption('both');
  for(const [right,left] of [['301','10'],['0','301']]){await page.locator('#rightLiftKg').fill(right);await page.locator('#leftLiftKg').fill(left);await page.locator('#save').click();assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().records.length),1);}
  assert.equal(await page.locator('#rightLiftKg').getAttribute('max'),'300');assert.equal(await page.locator('#leftLiftKg').getAttribute('max'),'300');
  await page.locator('#rightLiftKg').fill('0');await page.locator('#leftLiftKg').fill('10');await page.locator('#save').click();
  const lifts=await page.evaluate(()=>window.climbLogStateApi.get().records.filter(r=>r.trainingMode==='maxTest'));assert.equal(lifts.length,2);assert.deepEqual(lifts.map(r=>r.addedWeightKg),[0,10]);assert.deepEqual(lifts.map(r=>r.liftHand),['right','left']);
  assert.deepEqual(errors,[]);report.push({width,unknownBlank:true,repsEditPreservesUnknown:true,explicitZero:true,clearedWeightRemainsUnknown:true,positiveCorrectionIncludedInHistory:true,otherSetPreserved:true,maxInvalidSaveBlocked:true,pairedLiftZeroPreserved:true,hiddenSingleWeightIgnoredForPair:true,pairedUpperBoundEnforced:true,uniformExplicitZeroAndUnknownPreserved:true,uniformReopenMemoKeepsUnknown:true,legacyZeroPositiveAndBodyweightPreserved:true,errors});await context.close();
 }
 console.log(JSON.stringify(report,null,2));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
