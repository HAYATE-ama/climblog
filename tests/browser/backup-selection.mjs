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
 for(const viewport of [{width:320,height:740},{width:390,height:844},{width:1280,height:1000}]){
  const context=await browser.newContext({viewport,serviceWorkers:'block'});await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(origin+'/test.html');await page.waitForFunction(()=>window.__appReady);
  await page.locator('#settingsTab').click();await page.locator('#settingsData').click();await page.locator('#openDataTools').click();
  const initial=await page.evaluate(()=>JSON.stringify(window.climbLogStateApi.get()));
  const file=(name,id)=>({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify({records:[{id,date:'2026-11-05',kind:'gym',place:'サンプル',grade:'5級',sends:1,tries:1}]}))});
  await page.locator('#backupFile').setInputFiles(file('first.json','backup-a'));await page.waitForFunction(()=>document.getElementById('restorePreview').textContent.includes('読み込みました'));await page.locator('#previewRestore').click();assert.equal(await page.locator('#applyRestore').isEnabled(),true);
  await page.locator('#backupFile').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await page.waitForFunction(()=>!document.getElementById('restorePreview').textContent.includes('追加'));
  assert.equal(await page.locator('#applyRestore').isDisabled(),true,'invalid replacement must invalidate the old preview');
  assert.equal(await page.locator('#previewRestore').isDisabled(),true);assert.equal(await page.locator('#applyRestore').isDisabled(),true);assert.equal(await page.evaluate(()=>JSON.stringify(window.climbLogStateApi.get())),initial);
  await page.locator('#backupFile').setInputFiles(file('first.json','backup-a'));await page.waitForFunction(()=>document.getElementById('restorePreview').textContent.includes('読み込みました'));await page.locator('#previewRestore').click();
  await page.locator('#backupFile').setInputFiles([]);assert.equal(await page.locator('#applyRestore').isDisabled(),true);assert.equal(await page.evaluate(()=>JSON.stringify(window.climbLogStateApi.get())),initial);
  await page.evaluate(()=>{const original=File.prototype.text;File.prototype.text=function(){return this.name==='slow.json'?new Promise(resolve=>window.__finishBackupRead=()=>original.call(this).then(resolve)):original.call(this);};});
  await page.locator('#backupFile').setInputFiles(file('slow.json','backup-slow'));assert.equal(await page.locator('#applyRestore').isDisabled(),true);assert.equal(await page.locator('#previewRestore').isDisabled(),true);
  await page.locator('#backupFile').setInputFiles(file('latest.json','backup-latest'));await page.waitForFunction(()=>document.getElementById('restorePreview').textContent.includes('読み込みました'));await page.locator('#previewRestore').click();
  await page.evaluate(()=>window.__finishBackupRead());await page.waitForTimeout(30);await page.locator('#applyRestore').click();assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().records.some(r=>r.id==='backup-latest')),true);assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().records.some(r=>r.id==='backup-slow')),false);
  // Leaving the import screen while a read is pending must discard its result.
  await page.locator('#backupFile').setInputFiles(file('slow.json','backup-left'));await page.locator('[data-data-tab=trash]').click();await page.evaluate(()=>window.__finishBackupRead());await page.waitForTimeout(30);await page.locator('[data-data-tab=import]').click();assert.equal(await page.locator('#applyRestore').isDisabled(),true);assert.equal(await page.locator('#backupFile').inputValue(),'');
  // Authentication lock must also invalidate any already-confirmed preview.
  await page.locator('#backupFile').setInputFiles(file('lock.json','backup-lock'));await page.waitForFunction(()=>document.getElementById('restorePreview').textContent.includes('読み込みました'));await page.locator('#previewRestore').click();await page.evaluate(()=>window.dispatchEvent(new Event('climblog:authLock')));assert.equal(await page.locator('#applyRestore').isDisabled(),true);
  assert.deepEqual(errors,[]);report.push({width:viewport.width,invalidFile:true,emptySelection:true,latestReadWins:true,tabChange:true,authLock:true,errors});await context.close();
 }
 console.log(JSON.stringify(report,null,2));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
