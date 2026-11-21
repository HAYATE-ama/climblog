import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.CLIMBLOG_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),artifacts=process.env.CLIMBLOG_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'climblog-feedback-'));
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
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CLIMBLOG_BROWSER});
 for(const [width,theme] of [[320,'dark'],[390,'light'],[1280,'dark'],[1280,'light']]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),errors=[],external=[];
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():(external.push(route.request().url()),route.abort()));
  await context.addInitScript(()=>{
   const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(window.__feedbackQuota&&String(key)==='climbLogUserFeedback')throw new DOMException('Test quota','QuotaExceededError');return set.call(this,key,value);};
   Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{if(window.__clipboardFail)throw Error('Test clipboard');window.__copiedFeedback=text;}}});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('dialog',d=>d.accept());
  await page.goto(origin);await page.waitForFunction(()=>window.climbLogAuthReady===true);
  await page.evaluate(theme=>{const state=window.climbLogStateApi.get();window.climbLogStateApi.apply({preferences:{...state.preferences,theme},records:[{id:'sample',date:'2026-11-21',kind:'gym',grade:'2級',sends:1,tries:3,memo:'RECORD_NOT_FOR_FEEDBACK'}],bodyProfile:{heightCm:173}});},theme);
  const before=await page.evaluate(()=>JSON.stringify(window.climbLogStateApi.get().records));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const header=await page.locator('#openUserFeedback').boundingBox();assert.ok(header.width>=44&&header.height>=44);
  await page.locator('#openUserFeedback').click();assert.equal(await page.locator('#appFeedback').isVisible(),true);
  assert.equal(await page.locator('#userFeedbackScreen').inputValue(),'home');
  const initialBox=await page.locator('#appFeedback').boundingBox();assert.ok(initialBox.x>=0&&initialBox.y>=0&&initialBox.y+initialBox.height<=845);
  await page.locator('#userFeedbackText').fill('サーキットで休憩を終える操作が分かりにくい。\n<img id="feedback-injected" src=x>');
  await page.locator('#userFeedbackCategory').selectOption('usability');await page.locator('#userFeedbackScreen').selectOption('circuit');
  await page.screenshot({path:path.join(artifacts,`${width}-${theme}-input.png`)});
  await page.locator('[data-feedback=close]').click();await page.reload();await page.waitForFunction(()=>window.climbLogAuthReady===true);
  await page.locator('#openUserFeedback').click();assert.match(await page.locator('#userFeedbackText').inputValue(),/休憩を終える/);assert.equal(await page.locator('#userFeedbackScreen').inputValue(),'circuit');
  // Atomic local writer failure keeps input and the saved collection unchanged.
  await page.evaluate(()=>window.__feedbackQuota=true);await page.locator('#saveUserFeedback').click();assert.match(await page.locator('.feedbackMessage').innerText(),/保存できませんでした/);
  assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().userFeedback.length),0);assert.match(await page.locator('#userFeedbackText').inputValue(),/休憩/);
  await page.evaluate(()=>window.__feedbackQuota=false);await page.locator('#saveUserFeedback').click();assert.equal(await page.locator('.feedbackEntry').count(),1);assert.equal(await page.locator('#feedback-injected').count(),0);
  await page.locator('[data-edit-feedback]').click();await page.locator('#userFeedbackText').fill('タイマーの下に大きな休憩終了ボタンが欲しい。');await page.locator('#saveUserFeedback').click();assert.equal(await page.locator('.feedbackEntry').count(),1);
  const feedbackId=await page.evaluate(()=>window.climbLogStateApi.get().userFeedback[0].id);
  await page.locator('[data-status-feedback]').click();assert.equal(await page.locator('.feedbackEntry').count(),0);await page.locator('#feedbackFilter').selectOption('resolved');assert.equal(await page.locator('.feedbackEntry').count(),1);
  await page.locator('[data-status-feedback]').click();await page.locator('#feedbackFilter').selectOption('open');assert.equal(await page.locator('.feedbackEntry').count(),1);
  // Pagination shows 20 at a time; export includes every matching entry, not just the page.
  await page.evaluate(()=>{const api=window.climbLogStateApi,rows=api.get().userFeedback,row=rows[0];api.apply({userFeedback:[...rows,...Array.from({length:21},(_,i)=>({...row,id:'sample-feedback-'+i,text:'改善案 '+i}))]});});
  assert.equal(await page.locator('.feedbackEntry').count(),20);await page.locator('[data-feedback=more]').click();assert.equal(await page.locator('.feedbackEntry').count(),22);
  await page.screenshot({path:path.join(artifacts,`${width}-${theme}-list.png`)});
  await page.locator('[data-feedback=report]').click();const report=await page.locator('#feedbackReportText').inputValue();assert.match(report,/22件/);assert.equal(report.includes('RECORD_NOT_FOR_FEEDBACK'),false);assert.equal(report.includes('heightCm'),false);
  await page.locator('[data-feedback=copy]').click();assert.equal(await page.evaluate(()=>window.__copiedFeedback),report);
  await page.evaluate(()=>window.__clipboardFail=true);await page.locator('[data-feedback=copy]').click();assert.match(await page.locator('.feedbackMessage').innerText(),/自動コピーできません/);
  const downloading=page.waitForEvent('download');await page.locator('[data-feedback=download]').click();const download=await downloading;assert.match(download.suggestedFilename(),/^climblog-feedback-.*\.txt$/);assert.equal(fs.readFileSync(await download.path(),'utf8'),report);
  await page.evaluate(()=>{const api=window.climbLogStateApi,rows=api.get().userFeedback;rows[0].text='別の更新';api.apply({userFeedback:rows});});assert.equal(await page.locator('[data-feedback=copy]').isDisabled(),true);
  await page.locator('[data-feedback=list]').first().click();await page.locator('[data-feedback=close]').press('Escape');assert.equal(await page.locator('#appFeedback').isVisible(),false);assert.equal(await page.locator('#openUserFeedback').evaluate(el=>el===document.activeElement),true);
  await page.locator('.homeFeedbackLink').click();assert.equal(await page.locator('#appFeedback').isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.locator('[data-feedback=close]').click();await page.reload();await page.waitForFunction(()=>window.climbLogAuthReady===true);
  assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().userFeedback.length),22);assert.equal(await page.evaluate(()=>JSON.stringify(window.climbLogStateApi.get().records)),before);
  const backingUp=page.waitForEvent('download');await page.evaluate(()=>document.getElementById('exportData').click());const backup=JSON.parse(fs.readFileSync(await (await backingUp).path(),'utf8'));assert.equal(backup.userFeedback.length,22);assert.equal(JSON.stringify(backup.records),before);
  if(width===320){
   // Another tab cannot be silently overwritten by an older editor.
   await page.locator('#openUserFeedback').click();await page.locator('[data-feedback=list]').first().click();await page.locator(`[data-edit-feedback="${feedbackId}"]`).click();await page.locator('#userFeedbackText').fill('古い画面の編集');
   const other=await context.newPage();await other.goto(origin);await other.waitForFunction(()=>window.climbLogAuthReady===true);
   await other.evaluate(id=>{const api=window.climbLogStateApi,rows=api.get().userFeedback;rows.find(r=>r.id===id).text='別タブの最新編集';api.apply({userFeedback:rows});},feedbackId);
   await page.locator('#saveUserFeedback').click();assert.match(await page.locator('.feedbackMessage').innerText(),/保存できませんでした/);assert.match(await page.locator('#userFeedbackText').inputValue(),/古い画面/);assert.equal(await other.evaluate(id=>window.climbLogStateApi.get().userFeedback.find(r=>r.id===id).text,feedbackId),'別タブの最新編集');await other.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await context.close();console.log(JSON.stringify({width,theme,draft:true,save:true,edit:true,history:true,report:true,quota:true,recordsPreserved:true,noExternalRequests:true}));
 }
 // The installed shell includes the new feature, even when it was never opened online.
 const offlineContext=await browser.newContext(),offlinePage=await offlineContext.newPage();
 await offlinePage.goto(origin);await offlinePage.waitForFunction(()=>window.climbLogAuthReady===true);
 await offlinePage.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 await offlineContext.setOffline(true);await offlinePage.reload();await offlinePage.waitForFunction(()=>window.climbLogAuthReady===true);
 await offlinePage.locator('#openUserFeedback').click();await offlinePage.locator('#userFeedbackText').fill('オフライン中に気づいたこと');await offlinePage.locator('#saveUserFeedback').click();
 assert.equal(await offlinePage.locator('.feedbackEntry').count(),1);await offlinePage.locator('[data-feedback=close]').click();await offlinePage.reload();await offlinePage.waitForFunction(()=>window.climbLogAuthReady===true);
 assert.equal(await offlinePage.evaluate(()=>window.climbLogStateApi.get().userFeedback[0].text),'オフライン中に気づいたこと');
 // Malformed saved data is not replaced with an empty collection by the feedback editor.
 await offlinePage.evaluate(()=>window.climbLogStateApi.apply({userFeedback:{broken:true}}));
 await offlinePage.locator('#openUserFeedback').click();await offlinePage.locator('#userFeedbackText').fill('この内容で上書きしない');await offlinePage.locator('#saveUserFeedback').click();
 assert.match(await offlinePage.locator('.feedbackMessage').innerText(),/保存できませんでした/);assert.deepEqual(await offlinePage.evaluate(()=>JSON.parse(localStorage.getItem('climbLogUserFeedback'))),{broken:true});
 await offlineContext.close();console.log('Offline reload/save and malformed-data protection passed.');
 console.log('Artifacts: '+artifacts);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
