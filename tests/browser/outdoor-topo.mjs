import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.CLIMBLOG_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),artifacts=process.env.CLIMBLOG_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'climblog-topo-'));
fs.mkdirSync(artifacts,{recursive:true});
let generation=1;
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 if(!/^\/(?:index\.html|config\.js|service-worker\.js|manifest\.webmanifest|assets\/[\w./-]+)?$/.test(name)){res.writeHead(404);res.end();return;}
 const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.gif')?'image/gif':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html'});
 res.end(name==='/config.js'?'window.CLIMBLOG_CONFIG={};':name==='/service-worker.js'?fs.readFileSync(file,'utf8').replace('climblog-shell-20261121-outdoor-topo-','climblog-shell-topo-test-'+generation+'-'):fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
const problem={id:'wish-a',cragName:'検証岩場',areaName:'',routeName:'中央ライン',discipline:'boulder',gradeSystem:'日本（段級）',outdoorGrade:'二段',starred:false};
const second={...problem,id:'wish-b',routeName:'右カンテ',outdoorGrade:'初段'};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CLIMBLOG_BROWSER});
 for(const [width,theme] of [[320,'dark'],[390,'light'],[1280,'dark'],[1280,'light']]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:width===1280&&theme==='light'?'allow':'block'}),errors=[],external=[];
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():(external.push(route.request().url()),route.abort()));
  await context.addInitScript(()=>{const open=indexedDB.open.bind(indexedDB);indexedDB.open=(...args)=>{if(window.__topoIdbFail)throw new DOMException('Synthetic photo quota','QuotaExceededError');return open(...args);};const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(window.__topoQuota&&String(key)==='climbLogOutdoorTopos')throw new DOMException('Synthetic quota','QuotaExceededError');return set.call(this,key,value);};});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(origin);await page.waitForFunction(()=>window.climbLogAuthReady===true);
  await page.evaluate(({problem,second,theme})=>{const api=window.climbLogStateApi;api.apply({preferences:{...api.get().preferences,theme},outdoorWishlist:[problem,second],records:[{...problem,id:'record-a',kind:'outdoor',date:'2026-11-21',result:'attempt',tries:2}]});},{problem,second,theme});
  const originalRecords=await page.evaluate(()=>JSON.stringify(window.climbLogStateApi.get().records));
  await page.locator('#openOutdoorWishlist').click();await page.locator('[data-wish-id="wish-a"] .wishRoute').click();await page.locator('#outdoorWishlist [data-topo]').click();
  const topo=page.locator('#outdoorTopo'),stage=topo.locator('[data-stage]');assert.ok(await topo.isVisible());assert.ok(await topo.locator('[data-empty]').isVisible());
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=900;c.height=700;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,900,700);g.addColorStop(0,'#657560');g.addColorStop(1,'#182b2d');x.fillStyle=g;x.fillRect(0,0,900,700);x.fillStyle='#a3a18b';x.beginPath();x.moveTo(180,600);x.lineTo(350,120);x.lineTo(650,210);x.lineTo(770,580);x.fill();x.fillStyle='#333d35';x.fillRect(350,300,80,15);x.fillRect(450,420,90,18);return c.toDataURL('image/png').split(',')[1];});
  const file={name:'synthetic-rock.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')};
  await topo.locator('[data-file]').setInputFiles(file);await topo.locator('[data-save]').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#outdoorTopo [data-photo]').naturalWidth>0);
  assert.ok(await topo.locator('[data-undo]').isDisabled());assert.ok(await topo.locator('[data-redo]').isDisabled());
  await stage.click({position:{x:60,y:140}});await stage.click({position:{x:100,y:90}});assert.equal(await topo.locator('polyline').count(),1);
  await topo.locator('[data-tool=start]').click();await stage.click({position:{x:60,y:140}});assert.equal(await topo.locator('svg text').allTextContents().then(x=>x.join('')),'S');
  await topo.locator('[data-tool=goal]').click();await stage.click({position:{x:140,y:40}});assert.equal(await topo.locator('svg text').allTextContents().then(x=>x.join('')),'SG');
  await topo.locator('[data-undo]').click();assert.equal(await topo.locator('svg text').allTextContents().then(x=>x.join('')),'S');
  await topo.locator('[data-redo]').click();assert.equal(await topo.locator('svg text').allTextContents().then(x=>x.join('')),'SG');
  await topo.locator('[data-undo]').click();await stage.click({position:{x:135,y:35}});assert.ok(await topo.locator('[data-redo]').isDisabled());
  await topo.locator('[data-note]').fill('右足を残す。<img id="topo-injected" src=x>');await topo.locator('[data-save]').click();await page.waitForFunction(()=>window.climbLogStateApi.get().outdoorTopos.length===1);assert.equal(await topo.locator('#topo-injected').count(),0);
  const saved=await page.evaluate(()=>window.climbLogStateApi.get().outdoorTopos[0]);assert.equal(saved.marks.line.length,2);assert.ok(saved.marks.start&&saved.marks.goal);
  await topo.locator('[data-plain]').click();assert.ok(await topo.locator('svg').isHidden());await topo.locator('[data-plain]').click();assert.ok(await topo.locator('svg').isVisible());
  await page.screenshot({path:path.join(artifacts,width+'-'+theme+'-view.png')});
  const box=await topo.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.y+box.height<=901);assert.equal(await topo.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
  await topo.locator('[data-edit]').click();await topo.locator('[data-clear]').click();assert.equal(await topo.locator('polyline').count(),0);await topo.locator('[data-undo]').click();assert.equal(await topo.locator('polyline').count(),1);await topo.locator('[data-redo]').click();assert.equal(await topo.locator('polyline').count(),0);
  await topo.locator('[data-cancel]').click();assert.equal(await topo.locator('polyline').count(),1);assert.deepEqual(await page.evaluate(()=>window.climbLogStateApi.get().outdoorTopos[0]),saved);
  await topo.locator('[data-edit]').click();await topo.locator('[data-note]').fill('編集後のメモ');await page.evaluate(()=>window.__topoQuota=true);await topo.locator('[data-save]').click();await page.waitForFunction(()=>document.querySelector('.topoMessage').textContent.includes('保存できません'));
  assert.deepEqual(await page.evaluate(()=>window.climbLogStateApi.get().outdoorTopos[0]),saved);assert.equal(await topo.locator('[data-note]').inputValue(),'編集後のメモ');
  await page.evaluate(()=>window.__topoQuota=false);await topo.locator('[data-save]').click();await page.waitForFunction(()=>window.climbLogStateApi.get().outdoorTopos[0].marks.note==='編集後のメモ');
  await topo.locator('[data-close]').click();assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#outdoorWishlist [data-topo]')),true);
  await page.locator('#outdoorWishlist [data-back]').click();await page.locator('[data-wish-id="wish-b"] .wishRoute').click();await page.locator('#outdoorWishlist [data-topo]').click();await topo.locator('[data-library] summary').click();await topo.locator('[data-existing]').selectOption(saved.photoId);await topo.locator('[data-reuse]').click();
  await topo.locator('[data-save]').waitFor({state:'visible'});assert.equal(await topo.locator('polyline').count(),0);await topo.locator('[data-tool=start]').click();await stage.click({position:{x:190,y:140}});await topo.locator('[data-save]').click();await page.waitForFunction(()=>window.climbLogStateApi.get().outdoorTopos.length===2);
  const shared=await page.evaluate(()=>window.climbLogStateApi.get().outdoorTopos);assert.equal(shared[0].photoId,shared[1].photoId);assert.notDeepEqual(shared[0].marks,shared[1].marks);
  await topo.locator('[data-routes]').selectOption(saved.id);assert.equal(await topo.locator('#topoTitle').innerText(),problem.routeName);
  await topo.locator('[data-edit]').click();await topo.locator('[data-tool=line]').click();await stage.scrollIntoViewIfNeeded();const r=await stage.boundingBox();await page.mouse.move(r.x+80,r.y+80);await page.mouse.down();await page.mouse.move(r.x+120,r.y+40,{steps:5});await page.mouse.up();await topo.locator('[data-undo]').click();await topo.locator('[data-save]').click();await page.waitForFunction(()=>document.querySelector('#outdoorTopo [data-edit-actions]').hidden);
  await topo.locator('[data-close]').click();await page.locator('#outdoorWishlist [data-close]').click();
  await page.evaluate(()=>window.climbLogRecordViewer.open('record-a'));await page.locator('[data-viewer-action=topo]').click();assert.equal(await topo.locator('#topoTitle').innerText(),problem.routeName);await page.waitForFunction(()=>document.querySelector('#outdoorTopo [data-photo]').naturalWidth>0);await topo.locator('[data-close]').click();await page.locator('[data-viewer-action=close]').click();
  if(width===390){
   // Keyboard positioning, multi-photo cancel, rejected files and stale edits.
   await page.evaluate(()=>window.climbLogTopos.open(window.climbLogStateApi.get().outdoorWishlist[0]));await page.waitForFunction(()=>document.querySelector('#outdoorTopo [data-photo]').naturalWidth>0);
   await topo.locator('[data-edit]').click();await topo.locator('[data-tool=goal]').click();await stage.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await topo.locator('[data-undo]').click();await topo.locator('[data-redo]').click();await topo.locator('[data-cancel]').click();
   await topo.locator('[data-file]').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});assert.match(await topo.locator('.topoMessage').innerText(),/写真ファイル/);
   const portrait=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=120;c.height=240;c.getContext('2d').fillRect(0,0,120,240);return c.toDataURL('image/png').split(',')[1];});
   await topo.locator('[data-file]').setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:Buffer.from(portrait,'base64')});await topo.locator('[data-save]').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#outdoorTopo [data-photo]').naturalHeight===240);await page.evaluate(()=>window.__topoIdbFail=true);await topo.locator('[data-save]').click();await page.waitForFunction(()=>document.querySelector('.topoMessage').textContent.includes('保存できません'));assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().outdoorTopos.length),2);await page.evaluate(()=>window.__topoIdbFail=false);await topo.locator('[data-save]').click();await page.waitForFunction(()=>window.climbLogStateApi.get().outdoorTopos.length===3);assert.ok(await topo.locator('[data-photos]').isVisible());
   await topo.locator('[data-photos]').selectOption(saved.id);await page.waitForFunction(()=>document.querySelector('#outdoorTopo [data-photo]').naturalHeight===700);
   await topo.locator('[data-edit]').click();await topo.locator('[data-note]').fill('この編集は保存しない');await page.evaluate(()=>{const api=window.climbLogStateApi,rows=api.get().outdoorTopos;rows[1].marks.note='別の操作で更新';api.apply({outdoorTopos:rows});});await topo.locator('[data-save]').click();await page.waitForFunction(()=>document.querySelector('.topoMessage').textContent.includes('別の操作'));assert.equal(await topo.locator('[data-note]').inputValue(),'この編集は保存しない');await topo.locator('[data-cancel]').click();
   // Owner namespaces never return another profile's photo.
   assert.equal(await page.evaluate(async id=>(await import('/assets/js/outdoor-topo-store.mjs')).getTopoPhoto('unrelated-test-profile',id),saved.photoId),null);
   await topo.locator('[data-close]').click();
  }
  // Actual optional export, then import into a fresh independent local profile.
  await page.locator('#settingsTab').click();await page.locator('#settingsData').click();const download=page.waitForEvent('download');await page.locator('#exportData').click();const downloaded=await download,backupPath=path.join(artifacts,width+'-'+theme+'-backup.json');await downloaded.saveAs(backupPath);
  const backup=JSON.parse(fs.readFileSync(backupPath));assert.equal(backup.outdoorTopos.length,width===390?3:2);assert.equal(backup.topoPhotos.length,width===390?2:1);assert.ok(backup.topoPhotos[0].dataUrl.startsWith('data:image/jpeg;base64,'));
  const restored=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});await restored.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const p2=await restored.newPage();p2.on('dialog',d=>d.accept());p2.on('pageerror',e=>errors.push(e.message));await p2.goto(origin);await p2.waitForFunction(()=>window.climbLogAuthReady===true);await p2.locator('#settingsTab').click();await p2.locator('#settingsData').click();await p2.locator('#openDataTools').click();
  await p2.locator('#backupFile').setInputFiles({name:'missing-photos.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...backup,topoPhotos:[]}))});await p2.waitForFunction(()=>document.getElementById('restorePreview').textContent.includes('写真が不足'));assert.ok(await p2.locator('#previewRestore').isDisabled());assert.equal(await p2.evaluate(()=>window.climbLogStateApi.get().records.length),0);
  await p2.locator('#backupFile').setInputFiles(backupPath);await p2.waitForFunction(()=>!document.getElementById('previewRestore').disabled);await p2.locator('#previewRestore').click();await p2.locator('#applyRestore').click();await p2.waitForFunction(()=>document.getElementById('dataStatus').textContent.includes('復元しました'));
  assert.deepEqual(await p2.evaluate(()=>window.climbLogStateApi.get().outdoorTopos),backup.outdoorTopos);
  await p2.reload();await p2.waitForFunction(()=>window.climbLogAuthReady===true);await p2.locator('#openOutdoorWishlist').click();await p2.locator('[data-wish-id="wish-a"] .wishRoute').click();await p2.locator('#outdoorWishlist [data-topo]').click();await p2.waitForFunction(()=>document.querySelector('#outdoorTopo [data-photo]').naturalWidth>0);assert.equal(await p2.locator('#outdoorTopo polyline').count(),1);
  await restored.close();
  // A changed backup hash is rejected without active record writes.
  const invalid=await page.evaluate(async backup=>{const {prepareTopoImport}=await import('/assets/js/outdoor-topo-store.mjs');backup.topoPhotos[0].id='photo-'+'0'.repeat(64);try{await prepareTopoImport(backup,window.climbLogAccountId);return 'accepted';}catch(e){return e.message;}},backup);assert.match(invalid,/一致しません/);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.climbLogStateApi.get().records)),originalRecords);
  await page.reload();await page.waitForFunction(()=>window.climbLogAuthReady===true);await page.locator('#openOutdoorWishlist').click();await page.locator('[data-wish-id="wish-a"] .wishRoute').click();await page.locator('#outdoorWishlist [data-topo]').click();await page.waitForFunction(()=>document.querySelector('#outdoorTopo [data-photo]').naturalWidth>0);
  await topo.locator('[data-edit]').click();await page.screenshot({path:path.join(artifacts,width+'-'+theme+'-edit.png')});await topo.locator('[data-cancel]').click();await topo.locator('[data-close]').click();await page.locator('#outdoorWishlist [data-close]').click();
  if(width===1280&&theme==='light'){
   await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>window.climbLogAuthReady===true&&navigator.serviceWorker.controller);generation++;await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});await page.waitForFunction(async()=>Boolean((await navigator.serviceWorker.getRegistration()).waiting));await page.locator('#updateApp').click();await page.waitForFunction(()=>window.climbLogAuthReady===true&&!document.getElementById('pwaUpdateNotice'));await page.waitForFunction(async()=>!(await navigator.serviceWorker.getRegistration()).waiting);assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().outdoorTopos.length),2);await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.climbLogAuthReady===true);
   await page.locator('#openOutdoorWishlist').click();await page.locator('[data-wish-id="wish-a"] .wishRoute').click();await page.locator('#outdoorWishlist [data-topo]').click();await page.waitForFunction(()=>document.querySelector('#outdoorTopo [data-photo]').naturalWidth>0);assert.equal(await topo.locator('polyline').count(),1);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS '+width+' '+theme+' photo editing, undo/redo, persistence, reuse, backup'+(width===1280&&theme==='light'?', offline':''));await context.close();
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
