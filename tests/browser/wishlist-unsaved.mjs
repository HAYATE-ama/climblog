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
  const context=await browser.newContext({viewport,serviceWorkers:'block'});await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let discard=false,confirms=0;page.on('dialog',async d=>{confirms++;await(discard?d.accept():d.dismiss());});await page.goto(origin+'/test.html');await page.waitForFunction(()=>window.__appReady);
  const wish=page.locator('#outdoorWishlist'),form=wish.locator('form[data-screen=add]');await page.locator('#openOutdoorWishlist').click();await wish.locator('[data-add]').click();const before=await page.evaluate(()=>JSON.stringify(window.climbLogStateApi.get()));
  await form.locator('[name=cragName]').fill('入力中の岩場');await form.locator('[name=routeName]').fill('入力中の課題');await page.keyboard.press('Escape');
  assert.equal(await form.isVisible(),true,'discard cancellation must keep the add form');assert.equal(await form.locator('[name=routeName]').inputValue(),'入力中の課題');assert.equal(confirms,1);assert.equal(await page.evaluate(()=>JSON.stringify(window.climbLogStateApi.get())),before);
  await wish.locator('[data-back]').click();assert.equal(await form.isVisible(),true);assert.equal(confirms,2);
  await wish.locator('[data-close]').click();assert.equal(await form.isVisible(),true);assert.equal(confirms,3);
  discard=true;await wish.locator('[data-back]').click();assert.equal(await wish.locator('[data-screen=list]').isVisible(),true);assert.equal(await page.evaluate(()=>JSON.stringify(window.climbLogStateApi.get())),before);
  await wish.locator('[data-add]').click();const clean=confirms;await wish.locator('[data-back]').click();assert.equal(confirms,clean);
  await wish.locator('[data-add]').click();await form.locator('[name=cragName]').fill('保存する岩場');await form.locator('[name=routeName]').fill('保存する課題');const beforeSave=confirms;await form.locator('button[type=submit]').click();assert.equal(confirms,beforeSave);assert.equal(await wish.locator('[data-screen=list]').isVisible(),true);assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().outdoorWishlist.filter(w=>w.routeName==='保存する課題').length),1);
  const saved=await page.evaluate(()=>JSON.stringify(window.climbLogStateApi.get()));await wish.locator('[data-add]').click();await form.locator('[name=routeName]').fill('認証解除で破棄');const beforeLock=confirms;await page.evaluate(()=>window.dispatchEvent(new Event('climblog:authLock')));assert.equal(await wish.isVisible(),false);assert.equal(confirms,beforeLock);assert.equal(await page.evaluate(()=>JSON.stringify(window.climbLogStateApi.get())),saved);
  assert.deepEqual(errors,[]);report.push({width:viewport.width,escapeCancel:true,backCancel:true,closeCancel:true,discard:true,cleanBack:true,save:true,authLock:true,errors});await context.close();
 }
 console.log(JSON.stringify(report,null,2));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
