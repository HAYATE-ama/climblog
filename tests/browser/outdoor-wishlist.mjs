import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const engines=createRequire(import.meta.url)(process.env.CLIMBLOG_PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.CLIMBLOG_BROWSER_ENGINE||'chromium',root=process.cwd(),artifacts=fs.mkdtempSync(path.join(os.tmpdir(),'climblog-routes-'));
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 if(!/^\/(?:index\.html|config\.js|service-worker\.js|manifest\.webmanifest|assets\/[\w./-]+)?$/.test(name)){res.writeHead(404);res.end();return;}
 const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.gif')?'image/gif':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html'});res.end(name==='/config.js'?'window.CLIMBLOG_CONFIG={};':fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;let browser;
const a={id:'a',kind:'outdoor',date:'2026-11-20',cragName:'恵那',routeName:'テスト課題',areaName:'',discipline:'boulder',gradeSystem:'日本（段級）',outdoorGrade:'二段',grade:'二段',result:'send',ascentType:'new',tries:2,memo:'以前のメモ'};
const wish={id:'w1',cragName:'御手洗',routeName:'未着手の課題',areaName:'',discipline:'boulder',gradeSystem:'日本（段級）',outdoorGrade:'初/二段',starred:true};
const toyota={...wish,id:'w2',cragName:'豊田',routeName:'豊田テスト',gradeSystem:'豊田式（a・b・c…）',outdoorGrade:'f',starred:false};
try{
 browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.CLIMBLOG_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 for(const [width,theme] of (engine==='webkit'?[[390,'dark']]:[[320,'dark'],[390,'light'],[1280,'dark']])){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:width===1280?'allow':'block'}),errors=[],external=[];
  await context.route('**/*',r=>(r.request().url().startsWith(origin)||r.request().url().startsWith('blob:'+origin+'/'))?r.continue():(external.push(r.request().url()),r.abort()));
  await context.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(window.__wishQuota&&key==='climbLogOutdoorWishlist')throw new DOMException('Synthetic quota','QuotaExceededError');return set.call(this,key,value);};});
  const page=await context.newPage();page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(origin);await page.waitForFunction(()=>window.climbLogAuthReady===true);
  await page.evaluate(({a,wish,toyota,theme})=>{const api=window.climbLogStateApi;api.apply({preferences:{...api.get().preferences,theme,outdoorAscentResetVersion:1},outdoorWishlist:[wish,toyota],records:[a,{...a,id:'a2',date:'2026-11-21',result:'attempt'},{...a,...toyota,id:'b',kind:'outdoor',date:'2026-11-21',result:'attempt'}, {...a,id:'c',routeName:'結果なし',tries:0,result:null},{...a,id:'unnamed',routeName:''}]});},{a,wish,toyota,theme});
  const saved=await page.evaluate(()=>window.climbLogStateApi.get().records),panel=page.locator('#outdoorWishlist');
  const open=async()=>{await page.locator('#homeTab').click();await page.locator('#openOutdoorWishlist').click();};
  const pick=name=>panel.locator('.wishRoute').filter({has:page.locator('strong',{hasText:name})}).click();
  await open();assert.equal(await panel.locator('.wishRow').count(),4);assert.match(await panel.locator('[data-unnamed]').innerText(),/1件/);
  await panel.locator('[data-filter=sent]').click();assert.equal(await panel.locator('.wishRow').count(),1);
  await panel.locator('[data-filter=trying]').click();assert.equal(await panel.locator('.wishRow').count(),1);
  await panel.locator('[data-filter=wish]').click();assert.equal(await panel.locator('.wishRow').count(),2);
  await panel.locator('[data-crag]').selectOption('豊田');assert.equal(await panel.locator('.wishRow').count(),1);
  await panel.locator('[data-search]').fill('存在しない');assert.ok(await panel.locator('[data-empty]').isVisible());
  await panel.locator('[data-close]').click();await open();assert.equal(await panel.locator('.wishRow').count(),4);assert.equal(await panel.locator('[data-crag]').inputValue(),'');assert.equal(await panel.locator('[data-search]').inputValue(),'');
  await page.screenshot({path:path.join(artifacts,width+'-'+theme+'-list.png')});
  await pick('テスト課題');assert.match(await panel.locator('[data-overview]').innerText(),/記録 2日/);assert.equal(await panel.locator('[data-history] button').count(),2);
  await panel.locator('[data-log]').click();assert.equal(await page.locator('#routeName').inputValue(),'テスト課題');assert.equal(await page.locator('#outdoorResult').inputValue(),'');assert.equal(await page.locator('#outdoorMemo').inputValue(),'');assert.equal(await page.locator('#outdoorGrade').inputValue(),'二段');
  await page.locator('#outdoorMemo').fill('課題Aの下書き');await page.locator('#cancel').click();await panel.waitFor({state:'visible'});assert.equal(await panel.locator('[data-name]').innerText(),'テスト課題');await panel.locator('[data-back]').click();
  await pick('豊田テスト');await panel.locator('[data-log]').click();assert.equal(await page.locator('#outdoorMemo').inputValue(),'');assert.equal(await page.locator('#gradeSystem').inputValue(),toyota.gradeSystem);await page.locator('#outdoorMemo').fill('課題Bの下書き');await page.locator('#cancel').click();await panel.locator('[data-back]').click();
  await pick('テスト課題');await panel.locator('[data-log]').click();assert.equal(await page.locator('#outdoorMemo').inputValue(),'課題Aの下書き');await page.locator('#outdoorSend').click();await page.locator('#save').click();await panel.waitFor({state:'visible'});assert.equal(await panel.locator('[data-history] button').count(),3);
  const current=await page.evaluate(()=>window.climbLogStateApi.get().records);assert.deepEqual(current.filter(r=>saved.some(s=>s.id===r.id)),saved);assert.equal(current.length,saved.length+1);
  await panel.locator('[data-history="a"]').click();await page.locator('#recordViewer [data-viewer-action=edit]').click();assert.ok(await panel.isHidden());assert.equal(await page.locator('#outdoorMemo').inputValue(),'以前のメモ');await page.locator('#cancel').click();assert.ok(await panel.isVisible());
  await page.evaluate(()=>window.__wishQuota=true);await panel.locator('[data-toggle-wish]').click();assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().outdoorWishlist.length),2);assert.ok((await panel.locator('.wishStatus').innerText()).length>0);await page.evaluate(()=>window.__wishQuota=false);
  await panel.locator('[data-toggle-wish]').click();assert.equal(await panel.locator('[data-toggle-wish]').getAttribute('aria-pressed'),'true');await panel.locator('[data-priority]').check();assert.ok(await panel.locator('[data-priority]').isChecked());await panel.locator('[data-remove]').click();assert.equal(await panel.locator('[data-toggle-wish]').getAttribute('aria-pressed'),'false');assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().records.length),current.length);
  await panel.locator('[data-topo]').click();assert.match(await page.locator('#outdoorTopo [data-place]').innerText(),/恵那/);await page.locator('#outdoorTopo [data-close]').click();assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#outdoorWishlist [data-topo]')),true);
  await panel.locator('.wishBody').evaluate(el=>el.scrollTop=0);await page.screenshot({path:path.join(artifacts,width+'-'+theme+'-detail.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.ok(await panel.locator('[data-topo]').evaluate(button=>{const box=button.getBoundingClientRect();return [...button.children].every(child=>child.getBoundingClientRect().right<=box.right+1);}));
  const addedRecord=current.find(r=>!saved.some(old=>old.id===r.id));await panel.locator('[data-history="'+addedRecord.id+'"]').click();await page.locator('#recordViewer [data-viewer-action=delete]').click();await page.locator('#recordViewer').waitFor({state:'hidden'});assert.equal(await panel.locator('[data-history] button').count(),2);assert.deepEqual(await page.evaluate(()=>window.climbLogStateApi.get().records),saved);
  await panel.locator('[data-back]').click();await panel.locator('[data-add]').click();await panel.locator('[name=cragName]').fill('豊田');await panel.locator('[name=routeName]').fill('追加テスト');await panel.locator('[data-toyota-grade=g]').click();await panel.locator('button[type=submit]').click();assert.ok(await panel.locator('.wishRoute').filter({hasText:'追加テスト'}).isVisible());
  await panel.locator('[data-close]').click();
  await page.evaluate(wish=>window.climbLogStateApi.apply({outdoorWishlist:Array.from({length:65},(_,i)=>({...wish,id:'long-'+i,routeName:'長い課題名 '+String(i).padStart(2,'0'),starred:false}))}),wish);
  await open();assert.equal(await panel.locator('.wishRow').count(),30);await panel.locator('[data-more]').click();assert.equal(await panel.locator('.wishRow').count(),60);
  const row=panel.locator('[data-wish-id="long-40"] .wishRoute');await row.scrollIntoViewIfNeeded();const top=await panel.locator('.wishRoutes').evaluate(el=>el.scrollTop);assert.ok(top>0);const header=await panel.locator('.wishHead').boundingBox();await row.click();await panel.locator('[data-back]').click();assert.equal(await panel.locator('.wishRoutes').evaluate(el=>el.scrollTop),top);assert.deepEqual(await panel.locator('.wishHead').boundingBox(),header);
  await panel.locator('[data-close]').click();await open();assert.equal(await panel.locator('.wishRow').count(),30);assert.equal(await panel.locator('.wishRoutes').evaluate(el=>el.scrollTop),0);
  if(width===1280){await panel.locator('[data-close]').click();await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>window.climbLogAuthReady===true&&navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.climbLogAuthReady===true);await open();assert.equal(await panel.locator('.wishRow').count(),30);}
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS '+engine+' '+width+' '+theme+' filters/history/route drafts/save/quota/topo/pagination'+(width===1280?'/offline':''));await context.close();
 }
 console.log('Screenshots: '+artifacts);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
