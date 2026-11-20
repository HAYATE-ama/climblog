import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.CLIMBLOG_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),artifacts=fs.mkdtempSync(path.join(os.tmpdir(),'climblog-outdoor-graphs-'));
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 if(!/^\/(?:index\.html|config\.js|service-worker\.js|manifest\.webmanifest|assets\/[\w./-]+)?$/.test(name)){res.writeHead(404);res.end();return;}
 const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 const type=/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html';
 res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});res.end(name==='/config.js'?'window.CLIMBLOG_CONFIG={};':fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));console.log("Artifacts: "+artifacts);const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CLIMBLOG_BROWSER,headless:true});
 for(const [width,theme] of [[320,'dark'],[390,'light'],[1280,'dark']]){
  const context=await browser.newContext({viewport:{width,height:950},hasTouch:width<600,serviceWorkers:'block'});
  await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.clock.install({time:new Date('2026-11-20T12:00:00+09:00')});
  await page.goto(origin);await page.waitForFunction(()=>window.climbLogAuthReady===true);
  await page.evaluate(theme=>{
   const r=(id,date,grade,crag,route=id,repeat=false)=>({id,date,grade,kind:'outdoor',cragName:crag,routeName:route,result:'send',ascentType:repeat?'repeat':'new',sends:1,tries:2});
   window.__graphFixture=[r('n1','2026-11-08','三段','岩場A'),r('n2','2026-10-18','二段','岩場A'),r('n3','2026-11-02','二段','岩場B'),r('n4','2026-10-05','初段','岩場A'),r('n5','2026-10-11','初段','岩場B'),r('n6','2026-10-25','初段','岩場A'),r('n7','2026-11-10','初段','岩場C'),r('r1','2026-11-12','二段','岩場A','n2',true),r('r2','2026-11-15','初段','岩場B','n5',true),r('n8','2026-11-16','二段+','岩場C'),r('n9','2026-11-17','二段-','岩場B'),r('n10','2026-10-12','1級','岩場C'),r('n11','2026-10-18','1級','岩場A'),r('dup1','2026-11-08','三段','岩場A','n1'),r('dup2','2026-11-09','三段','岩場A','n1'),{...r('failed','2026-11-10','四段','岩場C'),result:'attempt',sends:0}];
   const current=window.climbLogStateApi.get();window.climbLogStateApi.apply({records:window.__graphFixture,preferences:{...current.preferences,theme,outdoorAscentResetVersion:1,outdoorSeason:{name:'秋冬シーズン',from:'2026-10-01',to:'2027-03-31'}}});
  },theme);
  const before=await page.evaluate(()=>JSON.stringify(window.climbLogStateApi.get().records));
  await page.locator('#statsTab').click();await page.locator('[data-stats-quick=outdoor]').click();
  assert.equal(await page.locator('#outdoorDanValue').innerText(),'15段');assert.match(await page.locator('#outdoorDanSummary').innerText(),/再登込み18段/);
  assert.equal(await page.locator('.outdoorGradeBar').count(),6);assert.equal(await page.locator('.statsSourceCard').isVisible(),false);assert.equal(await page.locator('#statsOverview').isVisible(),false);
  const heights=[];
  for(const view of ['grades','months','crags']){
   await page.locator('#outdoorTab-'+view).click();heights.push((await page.locator('#outdoorChartPanel').boundingBox()).height);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await page.locator('#outdoorDanSummary').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(artifacts,`${width}-${theme}-${view}.png`)});
  }
  assert.equal(new Set(heights).size,1);
  await page.locator('#outdoorTab-grades').click();const bar=page.getByRole('button',{name:'二段、新規2課題、再登1回。記録を見る',exact:true});await bar.click();
  assert.equal(await page.locator('#statsSourceRecords button').count(),3);assert.equal(await page.locator('#outdoorStatsRecords').isVisible(),true);await page.screenshot({path:path.join(artifacts,`${width}-${theme}-details.png`)});
  await page.locator('#outdoorStatsRecords header button').press('Escape');assert.equal(await bar.evaluate(el=>el===document.activeElement),true);
  await page.locator('#outdoorTab-months').click();assert.deepEqual(await page.locator('.outdoorMonthValue').allTextContents(),['6回','7回','—','—','—','—']);await page.locator('.outdoorMonthBars button').nth(1).click();assert.equal(await page.locator('#statsSourceRecords button').count(),7);await page.locator('#outdoorStatsRecords header button').click();
  await page.locator('#outdoorTab-crags').click();await page.locator('.outdoorCragLegend button').first().click();assert.equal(await page.locator('#statsSourceRecords button').count(),6);await page.locator('#outdoorStatsRecords header button').click();
  await page.locator('#outdoorAllRecords').click();assert.equal(await page.locator('#statsSourceRecords button').count(),16);assert.equal(await page.locator('[data-stats-record=failed]').count(),1);await page.locator('#outdoorSort').selectOption('grade');assert.equal(await page.locator('#statsSourceRecords h4').first().innerText(),'日本（段級）');await page.locator('#outdoorStatsRecords header button').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(window.climbLogStateApi.get().records)),before);
  // Reading/editing returns to the actual record editor without a blocking stacked modal.
  await page.locator('#outdoorAllRecords').click();await page.locator('[data-stats-record=n8]').click();assert.equal(await page.locator('#outdoorStatsRecords').isVisible(),false);assert.equal(await page.locator('#recordViewer').isVisible(),true);await page.locator('[data-viewer-action=edit]').click();await page.locator('#outdoorGrade').selectOption('初段');await page.locator('#save').click();assert.equal(await page.locator('#outdoorDanValue').innerText(),'14段');
  await page.locator('#outdoorAllRecords').click();await page.locator('[data-stats-record=r1]').click();await page.locator('[data-viewer-action=delete]').click();if(await page.locator('#recordViewer').isVisible())await page.locator('[data-viewer-action=close]').click();assert.match(await page.locator('#outdoorDanSummary').innerText(),/再登込み15段/);
  // Custom dates still save, reject invalid ranges, and survive a reload.
  await page.locator('#outdoorSeasonSettings summary').click();await page.locator('#outdoorSeasonTo').fill('2026-09-01');await page.locator('#saveOutdoorSeason').click();assert.match(await page.locator('#outdoorSeasonStatus').innerText(),/終了日/);await page.locator('#outdoorSeasonTo').fill('2027-03-31');await page.locator('#saveOutdoorSeason').click();
  await page.reload();await page.waitForFunction(()=>window.climbLogAuthReady===true);await page.locator('#statsTab').click();await page.locator('[data-stats-quick=outdoor]').click();assert.equal(await page.locator('#outdoorSeason').inputValue(),'custom');assert.equal(await page.locator('#outdoorDanValue').innerText(),'14段');
  // More than six grades/crags, foreign scales, long names and hostile text stay inspectable.
  await page.evaluate(()=>{
   const grades=['1級','初段-','初段','初段+','初/二段','二段-','二段','二段+','二/三段','三段'];
   window.climbLogStateApi.apply({records:Array.from({length:77},(_,i)=>({id:'many'+i,date:'2026-11-01',kind:'outdoor',result:'send',ascentType:'new',grade:i===76?'V10':grades[i%10],gradeSystem:i===76?'V Scale':'日本（段級）',cragName:i===0?'<img id="outdoor-injected" src=x>':('長い岩場の名称'.repeat(5)+i%9),routeName:'課題'+i}))});
  });
  await page.locator('#outdoorTab-grades').click();assert.equal(await page.locator('.outdoorGradeBar').count(),6);await page.locator('[data-outdoor-page="1"]').click();assert.equal(await page.locator('.outdoorGradeBar').count(),4);await page.locator('#outdoorChartScale').selectOption({label:'ボルダー · V Scale'});assert.equal(await page.locator('.outdoorGradeBar').count(),1);
  await page.locator('#outdoorTab-crags').click();assert.equal(await page.locator('.outdoorCragLegend button').count(),6);assert.equal(await page.locator('#outdoor-injected').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.locator('#outdoorAllRecords').click();assert.equal(await page.locator('#statsSourceRecords button').count(),30);await page.locator('#statsMoreRecords').click();await page.locator('#statsMoreRecords').click();assert.equal(await page.locator('#statsSourceRecords button').count(),77);await page.locator('#outdoorStatsRecords header button').click();
  await page.locator('#outdoorSeason').selectOption('2026');await page.locator('#outdoorTab-months').click();assert.equal(await page.locator('.outdoorMonthBars button').count(),6);assert.match(await page.locator('#outdoorChartPager').innerText(),/7–12/);await page.locator('[data-outdoor-page="-1"]').click();assert.match(await page.locator('#outdoorChartPager').innerText(),/1–6/);
  await page.evaluate(()=>window.climbLogStateApi.apply({records:[]}));await page.locator('#outdoorTab-grades').click();assert.match(await page.locator('#outdoorChartPlot').innerText(),/完登記録はありません/);await page.locator('#outdoorAllRecords').click();assert.match(await page.locator('#statsRecordCount').innerText(),/記録はありません/);await page.locator('#outdoorStatsRecords header button').click();
  await page.locator('#statsBack').click();await page.locator('[data-stats-topic=gym]').click();assert.equal(await page.locator('.statsSourceCard').isVisible(),true);assert.equal(await page.locator('#statsOverview').isVisible(),true);assert.equal(await page.locator('#outdoorGraphs').isVisible(),false);
  assert.deepEqual(errors,[]);await context.close();console.log(JSON.stringify({width,theme,charts:true,counts:true,details:true,editing:true,deleting:true,season:true,pagination:true,empty:true,overflow:false}));
 }
 console.log('Artifacts: '+artifacts);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
