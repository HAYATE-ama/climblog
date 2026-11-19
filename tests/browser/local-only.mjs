import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.CLIMBLOG_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),artifacts=fs.mkdtempSync(path.join(os.tmpdir(),'climblog-local-'));
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  if(!/^\/(?:index\.html|config\.js|service-worker\.js|manifest\.webmanifest|assets\/[\w./-]+)?$/.test(name)){res.writeHead(404);res.end();return;}
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  const type=/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.webmanifest')?'application/manifest+json':'text/html';
  res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store'});
  res.end(name==='/config.js'?"window.CLIMBLOG_CONFIG={supabaseUrl:'https://fixture.supabase.co'};":fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({executablePath:process.env.CLIMBLOG_BROWSER,headless:true});
  for(const [width,theme] of [[320,'dark'],[390,'light'],[1280,'dark']]){
    const ctx=await browser.newContext({viewport:{width,height:844}}),external=[],errors=[];
    ctx.on('request',req=>{if(new URL(req.url()).origin!==origin)external.push(req.url());});
    await ctx.addInitScript(theme=>{
      if(!localStorage.getItem('fixture-seeded')){
        localStorage.setItem('fixture-seeded','yes');
        localStorage.setItem('climbLogAuth:fixture:owner','fixture-user');
        localStorage.setItem('climbLogAuth:fixture:token','SYNTHETIC_DO_NOT_USE');
        localStorage.setItem('climbLogRecords',JSON.stringify([{id:'old-cache',date:'2026-11-19',kind:'gym',sends:1,tries:1}]));
        const payload={records:[{id:'local-edit',date:'2026-11-19',kind:'gym',gymName:'テストジム',place:'テストジム',grade:'2級',sends:2,tries:4,memo:'未同期の変更'}],preferences:{theme},bodyWeights:[{date:'2026-11-19',kg:60}],gyms:[{name:'テストジム',grades:[['2級','#ff6f00']]}]};
        localStorage.setItem('climbLogPendingState:fixture-user',JSON.stringify({userId:'fixture-user',revision:'fixture-1',payload}));
        localStorage.setItem('climbLogGradeCircuit:fixture-user',JSON.stringify({version:1,id:'old-circuit',date:'2026-11-19',gym:'テストジム',grade:'2級',total:1,routes:[{kind:'number',mark:'1',wall:'',tries:2,sent:true}]}));
      }
      const get=Storage.prototype.getItem;
      Storage.prototype.getItem=function(key){if(/token/.test(key))throw new Error('credential read');return get.call(this,key);};
    },theme);
    const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
    const ready=()=>p.waitForFunction(()=>window.climbLogAuthReady===true);
    await p.goto(origin);await ready();
    assert.equal(await p.locator('#authScreen').isVisible(),false);
    assert.equal(await p.locator('#authSubmit,#authPassword,#signOut').count(),0);
    assert.equal(await p.locator('#syncState').textContent(),'端末に保存済み');
    assert.deepEqual(await p.evaluate(()=>window.climbLogStateApi.get().records.map(r=>r.id)),['local-edit']);
    assert.equal(await p.evaluate(()=>JSON.parse(JSON.parse(localStorage.getItem('climbLogLocalMigrationRecovery')).local.records)[0].id),'old-cache');
    await p.evaluate(()=>navigator.serviceWorker.ready);
    await p.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    await ctx.setOffline(true);await p.reload();await ready();
    await p.locator('#calendarTab').click();await p.locator('#calendarView [data-open-workout]').click();await p.locator('[data-workout-act=grade-circuit]').click();
    const d=p.locator('dialog.gradeCircuit');
    const act=async a=>{await d.locator('[data-circuit='+a+']').click();await p.evaluate(()=>navigator.locks.request('climbLogGradeCircuit:fixture-user',()=>{}));};
    await act('sent');await act('sent');await act('fall');
    assert.match(await d.locator('.circuitCurrent').innerText(),/完登 3回.*途中落ち 2回/);
    await p.screenshot({path:path.join(artifacts,'circuit-'+width+'-'+theme+'.png')});
    assert.equal(await d.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
    await d.locator('[data-circuit=finish]').click();await d.locator('[data-circuit=save]').click();await d.waitFor({state:'hidden'});
    const circuit=await p.evaluate(()=>window.climbLogStateApi.get().records.find(r=>r.circuitRoute));
    assert.equal(circuit.sends,3);assert.equal(circuit.tries,5);
    await p.reload();await ready();
    assert.equal(await p.evaluate(()=>window.climbLogStateApi.get().records.find(r=>r.circuitRoute).sends),3);
    await p.locator('#settingsTab').click();await p.locator('#settingsData').click();
    assert.match(await p.locator('#settingsDataPanel').innerText(),/この端末に自動保存/);
    await p.screenshot({path:path.join(artifacts,'local-data-'+width+'-'+theme+'.png')});
    await p.locator('#settingsDrawerClose').click();
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    if(width===320){
      const other=await ctx.newPage();await other.goto(origin);await other.waitForFunction(()=>window.climbLogAuthReady===true);
      await p.evaluate(()=>window.climbLogStateApi.apply({records:[...window.climbLogStateApi.get().records,{id:'another-edit',date:'2026-11-19',kind:'gym',sends:1,tries:1}]}));
      const stale=await other.evaluate(()=>{try{window.climbLogStateApi.apply({records:[]});return '';}catch(e){return e.message;}});
      assert.match(stale,/別の画面/);await other.close();
      const before=await p.evaluate(()=>localStorage.getItem('climbLogRecords'));
      const failed=await p.evaluate(()=>{try{window.climbLogStateApi.apply({records:[{id:'too-large',date:'2026-11-19',kind:'gym',memo:'x'.repeat(6*1024*1024)}]});return false;}catch{return true;}});
      assert.equal(failed,true);assert.equal(await p.locator('#syncState').textContent(),'保存できませんでした');
      assert.equal(await p.evaluate(()=>localStorage.getItem('climbLogRecords')),before);
    }
    assert.deepEqual(external,[],'no auth, sync, SDK or AI requests');assert.deepEqual(errors,[]);
    await ctx.close();console.log(width,theme,'local migration / offline reopen / repeated circuit / settings passed');
  }
  // Fresh install must also open without configuration or any account.
  const ctx=await browser.newContext({serviceWorkers:'block'}),p=await ctx.newPage();
  await p.goto(origin);await p.waitForFunction(()=>window.climbLogAuthReady===true);
  assert.equal(await p.evaluate(()=>window.climbLogAccountId),'device');
  assert.equal(await p.evaluate(()=>window.climbLogStateApi.get().records.length),0);await ctx.close();
  console.log('screenshots:',artifacts);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
