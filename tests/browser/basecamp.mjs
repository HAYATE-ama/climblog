import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.CLIMBLOG_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),artifacts=fs.mkdtempSync(path.join(os.tmpdir(),'climblog-camp-'));
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  if(name==='/render.html'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(`<canvas id="scene" width="1000" height="600" style="max-width:100%"></canvas><p id="caption"></p><script type="module">import {createCampRenderer} from '/assets/js/home-landscape.mjs';window.renderer=createCampRenderer(document.querySelector('canvas'),{onCaption:text=>document.querySelector('p').textContent=text});window.ready=await renderer.ready;</script>`);return;
  }
  if(!/^\/(?:index\.html|config\.js|service-worker\.js|manifest\.webmanifest|assets\/[\w./-]+)?$/.test(name)){res.writeHead(404);res.end();return;}
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  const type=/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.webmanifest')?'application/manifest+json':'text/html';
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});
  res.end(name==='/config.js'?'window.CLIMBLOG_CONFIG={};':fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({executablePath:process.env.CLIMBLOG_BROWSER,headless:true});
  const context=await browser.newContext({viewport:{width:1024,height:740},serviceWorkers:'block'});
  await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await context.addInitScript(()=>{let seed=42;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/render.html');await page.waitForFunction(()=>window.ready);
  const activities=new Set(),weather=new Set(),pictures=new Set();
  for(let i=0;i<450;i++){
    const state=await page.evaluate(()=>{renderer.render(1);return {kind:document.querySelector('canvas').dataset.action,weather:document.querySelector('canvas').dataset.weather,caption:document.querySelector('p').textContent};});
    activities.add(state.kind);weather.add(state.weather);
    const central=/テントでのんびり|テントの中でひと休み|静かなひと休み|岩登りに夢中|遠くでコハクが泳いで|手を振って/.test(state.caption);
    if(central&&!pictures.has(state.kind)){pictures.add(state.kind);await page.screenshot({path:path.join(artifacts,state.kind+'.png')});}
  }
  assert.equal(activities.size,4);assert.equal(weather.size,6);assert.equal(pictures.size,4);
  await page.evaluate(()=>renderer.dispose());
  const disposed=await page.locator('canvas').evaluate(c=>c.toDataURL());
  await page.evaluate(()=>renderer.render(30));assert.equal(await page.locator('canvas').evaluate(c=>c.toDataURL()),disposed);
  await context.close();

  for(const mode of ['no-webgl','missing-image','lifecycle']){
    const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    const external=[];ctx.on('request',request=>{if(!request.url().startsWith(origin))external.push(request.url());});
    await ctx.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    if(mode==='no-webgl')await ctx.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl'?null:get.call(this,kind,...args);};});
    if(mode==='missing-image')await ctx.route('**/walker.webp',route=>route.abort());
    const p=await ctx.newPage();p.on('pageerror',error=>errors.push(error.message));await p.goto(origin+'/');
    await p.locator('.homeQuick').waitFor();
    if(mode==='missing-image'){
      await p.waitForFunction(()=>document.getElementById('companionSpeech').textContent.includes('読み込めません'));
      assert.equal(await p.locator('.campPoster').isVisible(),true);
    }else{
      await p.waitForSelector('.companionScene[data-ready]');
      const image=()=>p.locator('#pixelRoom').evaluate(c=>c.toDataURL());
      const initial=await image();await p.waitForTimeout(500);assert.notEqual(await image(),initial);
      if(mode==='lifecycle'){
        const before=await p.evaluate(()=>JSON.stringify(localStorage));
        await p.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
        const hidden=await image();await p.waitForTimeout(350);assert.equal(await image(),hidden);
        await p.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
        await p.waitForTimeout(350);assert.notEqual(await image(),hidden);
        // Remounts while an image promise resolves must leave only the latest canvas active.
        await p.evaluate(async()=>{const {renderHomeMarkup}=await import('/assets/js/home-screen.mjs');for(let i=0;i<5;i++){document.getElementById('homeCamp').innerHTML=renderHomeMarkup();window.dispatchEvent(new Event('climblog:homeRendered'));}});
        await p.waitForSelector('.companionScene[data-ready]');
        assert.equal(await p.locator('#pixelRoom').count(),1);
        assert.equal(await p.evaluate(()=>JSON.stringify(localStorage)),before);
        // Scrolling the scene out of view stops drawing, without changing the selected episode.
        await p.evaluate(()=>{const spacer=document.createElement('div');spacer.style.height='2000px';document.body.append(spacer);window.scrollTo(0,2000);});
        await p.waitForFunction(()=>document.getElementById('pixelRoom').dataset.motion==='paused');
        const offscreen=await image();await p.waitForTimeout(350);assert.equal(await image(),offscreen);
        await p.evaluate(()=>window.scrollTo(0,0));
        await p.waitForFunction(()=>document.getElementById('pixelRoom').dataset.motion==='animated');
      }
    }
    await p.locator('.homeQuick>summary').click();await p.locator('[data-home-entry=gym]').click();
    assert.equal(await p.locator('#modal').isVisible(),true);
    assert.deepEqual(external,[]);await ctx.close();
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({artifacts,activities:[...activities],weather:[...weather],webglFallback:true,imageFailureKeepsRecording:true,hiddenAndOffscreenPaused:true,remountCleanup:true,noExternalRequests:true,errors},null,2));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
