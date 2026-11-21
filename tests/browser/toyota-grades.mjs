import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.CLIMBLOG_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),artifacts=process.env.CLIMBLOG_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'climblog-toyota-'));
fs.mkdirSync(artifacts,{recursive:true});
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 if(!/^\/(?:index\.html|config\.js|service-worker\.js|manifest\.webmanifest|assets\/[\w./-]+)?$/.test(name)){res.writeHead(404);res.end();return;}
 const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.gif')?'image/gif':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html'});
 res.end(name==='/config.js'?'window.CLIMBLOG_CONFIG={};':fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
const system='豊田式（a・b・c…）';
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CLIMBLOG_BROWSER});
 for(const [width,theme] of [[320,'dark'],[390,'light'],[1280,'dark'],[1280,'light']]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:width===1280&&theme==='light'?'allow':'block'}),errors=[],external=[];
  await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():(external.push(r.request().url()),r.abort()));
  await context.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(window.__gradeQuota&&k==='climbLogPreferences')throw new DOMException('Synthetic quota','QuotaExceededError');return set.call(this,k,v);};});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(9000);
  await page.goto(origin);await page.waitForFunction(()=>window.climbLogAuthReady===true);
  const old={id:'historical-jp',kind:'outdoor',date:'2026-11-20',cragName:'豊田',routeName:'過去の段級記録',discipline:'boulder',gradeSystem:'日本（段級）',grade:'二段',outdoorGrade:'二段',result:'send',ascentType:'new',sends:1,tries:3};
  await page.evaluate(({old,theme})=>{const api=window.climbLogStateApi;api.apply({records:[old],preferences:{...api.get().preferences,theme,outdoorAscentResetVersion:1,outdoorSeason:{name:'検証用',from:'2026-11-01',to:'2026-11-30'}}});}, {old,theme});
  await page.evaluate(()=>window.climbLogRecordApi.open('outdoor','historical-jp'));assert.equal(await page.locator('#gradeSystem').inputValue(),'日本（段級）');assert.equal(await page.locator('#outdoorGrade').inputValue(),'二段');await page.locator('#cancel').click();
  await page.evaluate(()=>window.climbLogRecordApi.open('outdoor',null,'2026-11-21'));await page.locator('#cragName').fill('豊田');assert.equal(await page.locator('#gradeSystem').inputValue(),system);
  const picker=page.locator('#outdoorFields .toyotaGradePicker');assert.ok(await picker.isVisible());assert.ok(await page.locator('#outdoorGrade').isHidden());
  await page.locator('#routeName').fill('検証ライン');await picker.locator('[data-toyota-grade=f]').click();assert.equal(await page.locator('#outdoorGrade').inputValue(),'f');
  await picker.locator('[data-toyota-grade=custom]').click();await picker.locator('input').fill('F+');await page.locator('#outdoorSend').click();assert.equal(await page.locator('#outdoorGrade').inputValue(),'f+');
  await picker.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(artifacts,width+'-'+theme+'-record.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  for(const button of await picker.locator('.toyotaGradeLetters button').all()){const box=await button.boundingBox();assert.ok(box.width>=44&&box.height>=44);}
  await page.locator('#cancel').click();await page.evaluate(()=>window.climbLogRecordApi.open('outdoor',null,'2026-11-21'));assert.equal(await page.locator('#gradeSystem').inputValue(),system);assert.equal(await page.locator('#outdoorGrade').inputValue(),'f+');assert.equal(await picker.locator('input').inputValue(),'f+');
  await page.evaluate(()=>window.__gradeQuota=true);await page.locator('#save').click();assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().records.length),1);assert.equal(await picker.locator('input').inputValue(),'f+');await page.evaluate(()=>window.__gradeQuota=false);await page.locator('#save').click();
  const row=await page.evaluate(()=>window.climbLogStateApi.get().records.find(r=>r.routeName==='検証ライン'));assert.equal(row.gradeSystem,system);assert.equal(row.grade,'f+');assert.deepEqual(await page.evaluate(()=>window.climbLogStateApi.get().records.find(r=>r.id==='historical-jp')),old);
  await page.evaluate(id=>window.climbLogRecordViewer.open(id),row.id);assert.match(await page.locator('#recordViewerBody').innerText(),/豊田式/);await page.locator('[data-viewer-action=topo]').click();assert.match(await page.locator('#outdoorTopo [data-place]').innerText(),/f+/);await page.locator('#outdoorTopo [data-close]').click();await page.locator('[data-viewer-action=close]').click();
  await page.locator('#homeTab').click();await page.locator('#openOutdoorWishlist').click();const wish=page.locator('#outdoorWishlist');await wish.locator('[data-add]').click();const form=wish.locator('form');await form.locator('[name=cragName]').fill('豊田');assert.equal(await form.locator('[name=gradeSystem]').inputValue(),system);await form.locator('[name=routeName]').fill('登りたい検証課題');await form.locator('[data-toyota-grade=g]').click();await form.locator('[type=submit]').click();assert.match(await wish.locator('.wishRoute').innerText(),/g/);
  await wish.locator('.wishLog').click();assert.equal(await page.locator('#outdoorGrade').inputValue(),'g');assert.equal(await page.locator('#gradeSystem').inputValue(),system);assert.equal(await picker.locator('[data-toyota-grade=g]').getAttribute('aria-pressed'),'true');await page.locator('#cancel').click();await wish.locator('[data-close]').click();
  // A saved explicit Japanese choice wins next time; old Toyota records still retain their scale.
  await page.evaluate(()=>window.climbLogRecordApi.open('outdoor',null,'2026-11-22'));await page.locator('#cragName').fill('豊田');await page.locator('#routeName').fill('段級で残す検証');await page.locator('#gradeSystem').selectOption('日本（段級）');assert.ok(await picker.isHidden());await page.locator('#outdoorGrade').selectOption('初段');await page.locator('#outdoorAttempt').click();await page.locator('#save').click();
  await page.reload();await page.waitForFunction(()=>window.climbLogAuthReady===true);await page.evaluate(()=>window.climbLogRecordApi.open('outdoor',null,'2026-11-23'));await page.locator('#cragName').fill('豊田');assert.equal(await page.locator('#gradeSystem').inputValue(),'日本（段級）');
  await page.locator('#outdoorDiscipline').selectOption('lead');assert.equal(await page.locator('#gradeSystem').inputValue(),'YDS / デシマル');assert.ok(await picker.isHidden());await page.locator('#cancel').click();
  await page.evaluate(id=>window.climbLogRecordApi.open('outdoor',id),row.id);assert.equal(await page.locator('#gradeSystem').inputValue(),system);assert.equal(await picker.locator('input').inputValue(),'f+');await picker.locator('[data-toyota-grade=e]').click();await page.locator('#save').click();assert.equal(await page.evaluate(id=>window.climbLogStateApi.get().records.find(r=>r.id===id).outdoorGrade,row.id),'e');
  await page.locator('#statsTab').click();await page.locator('[data-stats-quick=outdoor]').click();assert.equal(await page.locator('#outdoorDanValue').innerText(),'2段');await page.locator('#outdoorChartScale').selectOption(JSON.stringify(['boulder',system]));assert.deepEqual(await page.locator('.outdoorGradeLabel').allTextContents(),['e']);await page.locator('.outdoorGradeBar').click();assert.equal(await page.locator('#statsSourceRecords button').count(),1);await page.locator('#outdoorStatsRecords header button').click();await page.locator('#outdoorDanSummary').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(artifacts,width+'-'+theme+'-stats.png')});
  const data=await page.evaluate(()=>window.climbLogStateApi.get());assert.equal(data.outdoorWishlist[0].outdoorGrade,'g');assert.ok(data.preferences.outdoorGradeFormats.some(p=>p.system===system));
  assert.deepEqual(await page.evaluate(async state=>{const {validateBackup}=await import('/assets/js/backup-model.mjs');return validateBackup(JSON.parse(JSON.stringify(state)));},data),data);
  if(width===390){await page.evaluate(id=>{const api=window.climbLogStateApi;api.apply({records:api.get().records.filter(r=>r.id===id)});},row.id);assert.equal(await page.locator('#outdoorChartTitle').innerText(),'豊田式の完登');assert.ok(await page.locator('#outdoorChartScaleWrap').isHidden());await page.evaluate(records=>window.climbLogStateApi.apply({records}),data.records);}
  if(width===1280&&theme==='light'){await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>window.climbLogAuthReady===true&&navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.climbLogAuthReady===true);await page.evaluate(id=>window.climbLogRecordApi.open('outdoor',id),row.id);assert.equal(await page.locator('#outdoorGrade').inputValue(),'e');assert.ok(await picker.isVisible());}
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS '+width+' '+theme+' Toyota selection / drafts / save-edit / wishlist / stats / backup compatibility');await context.close();
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
