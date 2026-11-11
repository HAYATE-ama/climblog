import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.CLIMBLOG_PLAYWRIGHT_MODULE||'playwright'),root=process.cwd();
const resultDir=fs.mkdtempSync(path.join(os.tmpdir(),'climblog-dialog-'));console.log('Test artifacts: '+resultDir);
const bootstrap=`window.climbLogAccountId='record-dialog-test';document.querySelector('#authScreen').hidden=true;document.querySelector('#authScreen').style.display='none';document.querySelector('#appRoot').hidden=false;await import('/assets/js/app.js');await import('/assets/js/enhancements.js');window.__appReady=true;`;
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/test.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<script src="./config.js"></script><script type="module" src="./assets/js/cloud.js"></script>',`<script type="module">${bootstrap}</script>`));return;}const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!['.js','.mjs','.css','.svg','.png','.webmanifest'].includes(path.extname(file))){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/plain');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;let browser;const report=[];

try{
 browser=await chromium.launch({executablePath:process.env.CLIMBLOG_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 for(const width of [320,390,1280])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  const page=await context.newPage(),errors=[],alerts=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{alerts.push(d.message());await d.accept();});
  await page.goto(origin+'/test.html');await page.waitForFunction(()=>window.__appReady);await page.locator('#calendarTab').click();await page.evaluate(theme=>document.body.dataset.theme=theme,theme);
  const rows=[
   {id:'gym',date:'2026-10-31',kind:'gym',gymName:'Sample gym',place:'Sample gym',grade:'青',sends:1,tries:3,memo:'gym original'},
   {id:'outdoor',date:'2026-10-31',kind:'outdoor',cragName:'Sample crag',place:'Sample crag',routeName:'A',grade:'二段',ascentType:'new',result:'send',sends:1,tries:4,memo:'outdoor original'},
   {id:'routine',date:'2026-10-31',kind:'training',trainingMode:'routine',exerciseName:'自重懸垂',grade:'自重懸垂',sets:1,reps:3,loadKg:0,loadRecorded:false,rpe:null,bodyweightKg:60,setDetails:[{reps:3,holdSeconds:0,loadKg:0,loadRecorded:false}],sessionSetResults:[{status:'completed',actual:3,mode:'reps'}],memo:'routine original'},
   {id:'max',date:'2026-10-31',kind:'training',trainingMode:'maxTest',exerciseName:'ハングボード保持',grade:'ハングボード保持',maxType:'hangboard',gripType:'halfCrimp',edgeDepthMm:20,holdSeconds:7,addedWeightKg:10,totalLoadKg:70,bodyweightKg:60,memo:'max original'}
  ];
  await page.evaluate(records=>window.climbLogStateApi.apply({records,recordHistory:[],bodyWeights:[{date:'2026-11-01',kg:50}]}),rows);
  const originals=await page.evaluate(()=>window.climbLogStateApi.get().records);
  for(const original of originals){
   await page.evaluate(row=>window.climbLogRecordApi.open(row.kind,row.id),original);
   assert.equal(await page.locator('#recordDate').inputValue(),original.date);assert.equal(await page.locator('#recordDate').isVisible(),true);
   await page.locator('#recordDate').fill('2026-11-01');
   if(original.id==='outdoor'){
    await page.locator('#cancel').click();await page.reload();await page.waitForFunction(()=>window.__appReady);await page.locator('#calendarTab').click();await page.evaluate(theme=>document.body.dataset.theme=theme,theme);
    await page.evaluate(()=>window.climbLogRecordApi.open('outdoor','outdoor'));assert.equal(await page.locator('#recordDate').inputValue(),'2026-11-01','date draft must resume after reload');
    await page.screenshot({path:path.join(resultDir,'date-'+width+'-'+theme+'.png')});
   }
   const bounds=await page.locator('#recordDate').boundingBox();assert.ok(bounds.width>150&&bounds.height>=44&&bounds.x>=0&&bounds.x+bounds.width<=width,'date field fits viewport and is tappable');
   await page.locator('#save').click();assert.equal(await page.locator('#modal').evaluate(el=>el.classList.contains('open')),false,'save closes editor');
   const changed=await page.evaluate(id=>window.climbLogStateApi.get().records.find(r=>r.id===id),original.id);
   const {updatedAt,...saved}=changed;assert.ok(updatedAt);assert.deepEqual(saved,{...original,date:'2026-11-01'},'only date and edit timestamp change');
   assert.equal(await page.evaluate(()=>window.climbLogGetSelectedDate()),'2026-11-01');
   await page.evaluate(id=>window.climbLogRecordViewer.open(id),original.id);assert.match(await page.locator('#recordViewer').innerText(),/2026[-/]11[-/]01/);await page.keyboard.press('Escape');
  }
  assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().recordHistory.length),4);
  // Empty dates and a failed local write must retain the original record and entered form.
  await page.evaluate(()=>window.climbLogRecordApi.open('outdoor','outdoor'));await page.locator('#recordDate').fill('');await page.locator('#save').click();assert.match(alerts.pop(),/記録日/);
  assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().records.find(r=>r.id==='outdoor').date),'2026-11-01');
  await page.locator('#recordDate').fill('2026-12-01');
  await page.evaluate(()=>{window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='climbLogRecords')throw new DOMException('sample quota','QuotaExceededError');return window.__setItem.call(this,k,v);};});
  await page.locator('#save').click();assert.match(alerts.pop(),/保存できません/);assert.equal(await page.locator('#recordDate').inputValue(),'2026-12-01');assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().records.find(r=>r.id==='outdoor').date),'2026-11-01');
  await page.evaluate(()=>{Storage.prototype.setItem=window.__setItem;delete window.__setItem;});
  await page.locator('#outdoorMemo').fill('updated memo');await page.locator('#save').click();
  let row=await page.evaluate(()=>window.climbLogStateApi.get().records.find(r=>r.id==='outdoor'));assert.equal(row.date,'2026-12-01');assert.equal(row.memo,'updated memo');
  await page.evaluate(()=>window.climbLogRecordApi.open('gym',null,'2026-12-02'));assert.equal(await page.locator('#recordDate').isVisible(),false,'new records keep the selected calendar date');await page.locator('#cancel').click();
  // Use an actual course model fixture, never production records.
  const courseId=await page.evaluate(async()=>{
   const {makeDayCourse}=await import('/assets/js/day-courses.mjs'),m=await import('/assets/js/workout-model.mjs');const plan=m.normalizeWorkoutPlan(makeDayCourse('day-light','short'));plan.preparationSeconds=0;
   let s=m.createWorkout(plan,'2026-11-08',0,'date-course-sample',{before:{pain:'unknown',fatigue:'unknown',outdoor:'unknown',availableMinutes:null,acknowledged:true}});
   s=m.finishWorkoutPhase(s,{now:10000});s=m.stopWorkout(s,40000);s=s.results.reduce((v,r,i)=>m.confirmCourseResult(v,r.exerciseId,r.setIndex,{actual:i===0?1:20,loadKg:0,observation:{}}),s);
   const patch=m.prepareWorkoutSave(window.climbLogStateApi.get(),s,40000).patch;window.climbLogStateApi.apply(patch);return patch.records.find(r=>r.course).id;
  });
  const courseState=await page.evaluate(()=>window.climbLogStateApi.get()),originalCourse=courseState.records.find(r=>r.id===courseId);
  const openCourse=async()=>{await page.evaluate(id=>window.climbLogRecordViewer.open(id),courseId);await page.locator('[data-viewer-action=edit]').click();};
  await openCourse();assert.equal(await page.locator('#courseEditDate').inputValue(),'2026-11-08');await page.locator('#courseEditDate').fill('');await page.locator('#courseRecordEditor [data-save]').click();assert.match(await page.locator('#courseEditError').innerText(),/記録日/);
  await page.locator('#courseEditDate').fill('2027-01-02');await page.screenshot({path:path.join(resultDir,'course-date-'+width+'-'+theme+'.png')});
  const box=await page.locator('#courseEditDate').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.height>=44);
  await page.locator('#courseRecordEditor [data-save]').click();assert.equal(await page.locator('#courseRecordEditor').isVisible(),false);
  const after=await page.evaluate(()=>window.climbLogStateApi.get()),edited=after.records.find(r=>r.id===courseId),{updatedAt,...courseSaved}=edited;
  const {updatedAt:originalUpdatedAt,...courseBefore}=originalCourse;assert.deepEqual(courseSaved,{...courseBefore,date:'2027-01-02'});assert.deepEqual(after.workoutReceipts,courseState.workoutReceipts,'original session snapshot is retained');
  assert.deepEqual(after.records.filter(r=>r.id!==courseId),courseState.records.filter(r=>r.id!==courseId),'only the selected course record moves');
  assert.equal(await page.evaluate(()=>window.climbLogGetSelectedDate()),'2027-01-02');
  await openCourse();assert.equal(await page.locator('#courseEditDate').inputValue(),'2027-01-02');await page.locator('#courseEditDate').fill('2027-01-03');await page.locator('#courseEditMemo').fill('course updated');await page.locator('#courseRecordEditor [data-save]').click();
  row=await page.evaluate(id=>window.climbLogStateApi.get().records.find(r=>r.id===id),courseId);assert.equal(row.date,'2027-01-03');assert.equal(row.memo,'course updated');
  await page.reload();await page.waitForFunction(()=>window.__appReady);assert.equal(await page.evaluate(id=>window.climbLogStateApi.get().records.find(r=>r.id===id).date,courseId),'2027-01-03');
  assert.deepEqual(errors,[]);assert.deepEqual(alerts,[]);report.push({width,theme,dateOnly:true,draft:true,writeFailure:true,course:true});await context.close();
 }
 console.log(JSON.stringify(report));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
