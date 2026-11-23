import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const engines=createRequire(import.meta.url)(process.env.CLIMBLOG_PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.CLIMBLOG_BROWSER_ENGINE||'chromium',root=process.cwd(),artifacts=fs.mkdtempSync(path.join(os.tmpdir(),'climblog-multi-circuit-'));
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 if(!/^\/(?:index\.html|config\.js|service-worker\.js|manifest\.webmanifest|assets\/[\w./-]+)?$/.test(name)){res.writeHead(404);res.end();return;}
 const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.gif')?'image/gif':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html'});res.end(name==='/config.js'?'window.CLIMBLOG_CONFIG={};':fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;let browser;
const gyms=[{name:'アルファジム',grades:[['4級','#77aa66'],['3級','#ee8833'],['2級','#7777bb']]},{name:'ベータジム',grades:[['Expert_ルーフ','#cc5555'],['Elite_ルーフ','#5588bb']]}];
try{
 browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.CLIMBLOG_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 for(const [width,theme] of (engine==='webkit'?[[390,'dark']]:[[320,'light'],[390,'dark'],[1280,'light']])){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:width===1280?'allow':'block'}),errors=[],external=[];
  await context.route('**/*',r=>(r.request().url().startsWith(origin)||r.request().url().startsWith('blob:'+origin+'/'))?r.continue():(external.push(r.request().url()),r.abort()));
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.clock.install({time:new Date('2026-11-23T10:00:00Z')});
  await page.goto(origin);await page.waitForFunction(()=>window.climbLogAuthReady===true);await page.evaluate(({gyms,theme})=>window.climbLogStateApi.apply({gyms,preferences:{...window.climbLogStateApi.get().preferences,theme}}),{gyms,theme});
  const panel=page.locator('.gradeCircuit'),flush=()=>page.evaluate(()=>navigator.locks.request('climbLogGradeCircuit:'+window.climbLogAccountId,()=>{})),act=async action=>{await panel.locator('[data-circuit="'+action+'"]').click();await flush();};
  const open=async()=>{await page.locator('#calendarTab').click();await page.locator('#calendarView [data-open-workout]').click();await page.locator('[data-workout-act=grade-circuit]').click();};
  const grade=async id=>{await panel.locator('[data-grade-id="'+id+'"]').click();await flush();};
  await open();assert.equal(await panel.locator('[name=gym]').inputValue(),gyms[0].name);
  await panel.locator('[name=grade][value="0"]').uncheck();assert.ok(await panel.locator('[data-setup-start]').isDisabled());
  await panel.locator('[name=grade][value="0"]').check();await panel.locator('[name=grade][value="1"]').check();await panel.locator('[name=total]').nth(0).fill('2');
  await panel.locator('[name=gym]').selectOption(gyms[1].name);assert.equal(await panel.locator('[data-setup-grade]').count(),1);assert.match(await panel.locator('[data-grade-choices]').innerText(),/Expert_ルーフ/);assert.equal(await panel.locator('[name=total]').inputValue(),'');
  await panel.locator('[name=gym]').selectOption(gyms[0].name);await panel.locator('[name=grade][value="1"]').check();
  await panel.locator('[name=total]').nth(0).fill('1');await panel.locator('[name=total]').nth(1).fill('1');await panel.locator('[name=grade][value="1"]').uncheck();await panel.locator('[name=grade][value="1"]').check();assert.equal(await panel.locator('[name=total]').nth(1).inputValue(),'1');
  await panel.evaluate(el=>el.scrollTop=0);await page.screenshot({path:path.join(artifacts,width+'-'+theme+'-setup.png')});
  await panel.locator('[data-setup-start]').click();await panel.locator('[data-circuit=start]').waitFor();assert.equal(await panel.locator('[data-grade-id]').count(),2);assert.match(await panel.locator('.circuitCurrent').innerText(),/4級 · 1番/);
  await act('start');assert.ok(await panel.locator('[data-grade-id="grade-1"]').isDisabled());await page.clock.fastForward(10000);await act('sent');assert.equal(await panel.locator('.circuitMilestone').count(),0);
  await panel.locator('.circuitNotes summary').click();await panel.locator('[data-note=route]').fill('4級の備考');await flush();await act('close');await page.reload();await page.waitForFunction(()=>window.climbLogAuthReady===true);await open();assert.equal(await panel.locator('[data-clock-status]').innerText(),'レスト中');
  await grade('grade-1');assert.match(await panel.locator('.circuitCurrent').innerText(),/3級 · 1番/);assert.match(await panel.locator('.circuitCurrent').innerText(),/未着手/);
  await page.clock.fastForward(20000);await act('start');await page.clock.fastForward(15000);await act('fall');await page.clock.fastForward(5000);await act('start');await page.clock.fastForward(10000);await act('sent');assert.equal(await panel.locator('.circuitMilestone').count(),1);
  await act('undo');assert.equal(await panel.locator('.circuitMilestone').count(),0);assert.equal(await panel.locator('[data-clock-status]').innerText(),'登攀中');await act('sent');
  await grade('grade-0');await act('start');await page.clock.fastForward(1000);await act('sent');assert.match(await panel.locator('.circuitCurrent').innerText(),/完登 2回/);assert.match(await panel.locator('.circuitProgress').innerText(),/2 \/ 2/);
  await panel.locator('.circuitNotes summary').click();assert.equal(await panel.locator('[data-note=route]').inputValue(),'4級の備考');await panel.locator('[data-note=session]').fill('複数グレードの全体メモ');await flush();
  assert.ok(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1));await panel.evaluate(el=>el.scrollTop=0);await page.screenshot({path:path.join(artifacts,width+'-'+theme+'-run.png')});
  await act('finish');assert.equal(await panel.locator('.circuitGradeSummary>div').count(),2);await act('save');await panel.waitFor({state:'hidden'});
  const state=await page.evaluate(()=>window.climbLogStateApi.get());assert.deepEqual(state.records.map(r=>[r.grade,r.sends,r.tries]),[['4級',2,2],['3級',1,2]]);assert.match(state.records[0].memo,/4級の備考/);assert.equal(state.workoutReceipts[0].circuitSession.grades.length,2);assert.ok(state.workoutReceipts[0].circuitSession.timing.restMs>=25000);
  await page.locator('#gymName').evaluate(el=>el.value='ベータジム');await open();assert.equal(await panel.locator('[name=gym]').inputValue(),'アルファジム');await act('history');await panel.locator('.circuitHistoryItem summary').click();assert.match(await panel.innerText(),/4級 · 1番/);assert.match(await panel.innerText(),/3級 · 1番/);
  await act('repeat');assert.equal(await panel.locator('[data-grade-id]').count(),2);assert.match(await panel.locator('.circuitProgress').innerText(),/0 \/ 2/);assert.equal(await panel.locator('[data-clock]').innerText(),'0:00');
  if(width===320){
   await panel.locator('.circuitSettings summary').click();await act('discard');
   await panel.locator('[name=grade][value="1"]').check();
   for(const row of await panel.locator('[data-setup-grade]').all()){await row.locator('summary').click();await row.locator('[name=layout]').selectOption('marks');}
   await panel.locator('.circuitSetupMore summary').click();await panel.locator('[name=timed]').uncheck();await panel.locator('[data-setup-start]').click();await panel.locator('[data-grade-id]').first().waitFor();
   for(const id of ['grade-0','grade-1']){
    await grade(id);await act('add');await act('tape');await panel.locator('[data-shape="×"]').click();await panel.locator('[name=wall]').fill('ルーフ左');await panel.locator('form button.primary').click();await panel.locator('.circuitCurrent').waitFor();await act('sent');
   }
   await act('finish');await page.evaluate(()=>{const api=window.climbLogStateApi,apply=api.apply;api.apply=patch=>{api.apply=apply;throw new Error('検証用保存失敗');};});await act('save');assert.match(await panel.locator('.circuitMessage').innerText(),/保存失敗/);assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().records.length),2);await act('save');await panel.waitFor({state:'hidden'});
   const tapeRows=await page.evaluate(()=>window.climbLogStateApi.get().records.slice(2));assert.deepEqual(tapeRows.map(r=>[r.grade,r.circuitRoute.mark]),[['4級','×'],['3級','×']]);
   // A real old-format draft stays v2 and remains editable after this release.
   await page.evaluate(()=>localStorage.setItem('climbLogGradeCircuit:'+window.climbLogAccountId,JSON.stringify({version:2,id:'legacy-sample',date:'2026-11-20',gym:'以前のジム',grade:'旧グレード',total:1,routes:[{kind:'number',mark:'1',wall:'',tries:2,sends:1}]})));
   await open();assert.match(await panel.locator('.circuitCurrent').innerText(),/完登 1回/);assert.match(await panel.locator('.circuitGradeTabs').innerText(),/旧グレード/);await act('sent');await act('close');
   const old=await page.evaluate(()=>JSON.parse(localStorage.getItem('climbLogGradeCircuit:'+window.climbLogAccountId)));assert.equal(old.version,2);assert.equal(old.routes[0].sends,2);
  }
  if(width===1280){await act('close');await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>window.climbLogAuthReady===true&&navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.climbLogAuthReady===true);await open();assert.equal(await panel.locator('[data-grade-id]').count(),2);await grade('grade-1');await act('start');await page.clock.fastForward(1000);await act('sent');await act('finish');await act('save');assert.equal(await page.evaluate(()=>window.climbLogStateApi.get().records.length),3);}
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS '+engine+' '+width+' '+theme+' gym/grades/config/reload/timer/repeated/notes/save/history/repeat'+(width===1280?'/offline':''));await context.close();
 }
 console.log('Screenshots: '+artifacts);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
