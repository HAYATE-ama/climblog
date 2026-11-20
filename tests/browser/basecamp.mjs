import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {campClips} from '../../assets/js/basecamp-model.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.CLIMBLOG_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),artifacts=fs.mkdtempSync(path.join(os.tmpdir(),'climblog-gif-'));
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  if(name==='/gif.html'){res.setHeader('Content-Type','text/html');res.end('<style>body{margin:0;background:#121212}img{width:600px;height:360px}</style><img alt="GIF test">');return;}
  if(!/^\/(?:index\.html|config\.js|service-worker\.js|manifest\.webmanifest|assets\/[\w./-]+)?$/.test(name)){res.writeHead(404);res.end();return;}
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  const type=/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.gif')?'image/gif':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.webmanifest')?'application/manifest+json':'text/html';
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});
  res.end(name==='/config.js'?'window.CLIMBLOG_CONFIG={};':fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({executablePath:process.env.CLIMBLOG_BROWSER,headless:true});
  const context=await browser.newContext({viewport:{width:620,height:400},serviceWorkers:'block'});
  await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const clip of campClips){
    await page.goto(origin+'/gif.html');
    await page.locator('img').evaluate((img,src)=>{img.src=src;},origin+'/assets/images/basecamp/'+clip.id+'.gif');
    await page.locator('img').evaluate(img=>img.decode());
    const initial=await page.locator('img').screenshot();await page.waitForTimeout(450);
    assert.notDeepEqual(await page.locator('img').screenshot(),initial,clip.id+' must visibly animate without Canvas');
    if(['tent-rain','climb-sunset','swim-sunny'].includes(clip.id)){
      await page.waitForTimeout(4500);await page.screenshot({path:path.join(artifacts,clip.id+'.png')});
    }
  }
  await context.close();
  for(const mode of ['lifecycle','reduced','missing','slow']){
    const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:mode==='reduced'?'reduce':'no-preference'});
    const external=[];let gifRequests=0;
    ctx.on('request',request=>{if(!request.url().startsWith(origin))external.push(request.url());if(request.url().endsWith('.gif'))gifRequests++;});
    await ctx.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    await ctx.addInitScript(()=>{
      const create=URL.createObjectURL,revoke=URL.revokeObjectURL;window.activeGifUrls=new Set();
      URL.createObjectURL=function(blob){const url=create.call(this,blob);activeGifUrls.add(url);return url;};
      URL.revokeObjectURL=function(url){activeGifUrls.delete(url);return revoke.call(this,url);};
    });
    if(mode==='missing')await ctx.route('**/*.gif',route=>route.abort());
    if(mode==='slow')await ctx.route('**/*.gif',async route=>{await new Promise(resolve=>setTimeout(resolve,700));await route.continue().catch(()=>{});});
    const p=await ctx.newPage();p.on('pageerror',error=>errors.push(error.message));await p.goto(origin+'/');
    await p.locator('.homeQuick').waitFor();
    assert.equal(await p.locator('.companionScene canvas,.campWeather,.homeKicker').count(),0);
    const before=await p.evaluate(()=>JSON.stringify(localStorage));
    if(mode==='missing'){
      await p.waitForFunction(()=>document.getElementById('pixelRoom').dataset.motion==='error');
      assert.equal(gifRequests,1);
      await p.locator('#calendarTab').click();await p.locator('#homeTab').click();await p.waitForTimeout(500);
      assert.equal(gifRequests,1,'no automatic retry after an error');
      assert.equal(await p.locator('.campPoster').isVisible(),true);
      await p.locator('[data-camp-pause]').click();await p.waitForFunction(()=>document.getElementById('pixelRoom').dataset.motion==='error');assert.equal(gifRequests,2);
    }else{
      if(mode==='reduced'){
        assert.equal(gifRequests,0);assert.equal(await p.locator('#pixelRoom').getAttribute('src'),null);
        await p.getByRole('button',{name:'ホームのアニメーションを再生',exact:true}).click();
      }
      if(mode==='slow'){
        await p.locator('#calendarTab').click();await p.waitForTimeout(900);
        assert.equal(await p.locator('#pixelRoom').getAttribute('src'),null);
        assert.equal(await p.evaluate(()=>activeGifUrls.size),0);
        await p.locator('#homeTab').click();
      }
      await p.waitForSelector('.companionScene[data-ready]');
      assert.equal(await p.locator('#pixelRoom').evaluate(img=>img.tagName==='IMG'&&img.naturalWidth===600),true);
      const first=await p.locator('.companionScene').screenshot();await p.waitForTimeout(450);
      assert.notDeepEqual(await p.locator('.companionScene').screenshot(),first);
      if(mode==='lifecycle'){
        const initialClip=await p.locator('#pixelRoom').getAttribute('data-clip');
        await p.waitForFunction(previous=>document.getElementById('pixelRoom').dataset.clip!==previous,initialClip,{timeout:18000});
        assert.equal(await p.evaluate(()=>activeGifUrls.size),1);
        const clip=await p.locator('#pixelRoom').getAttribute('data-clip');
        await p.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
        assert.equal(await p.locator('#pixelRoom').getAttribute('src'),null);assert.equal(await p.evaluate(()=>activeGifUrls.size),0);
        await p.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
        await p.waitForSelector('.companionScene[data-ready]');assert.equal(await p.locator('#pixelRoom').getAttribute('data-clip'),clip);
        await p.evaluate(async()=>{const {renderHomeMarkup}=await import('/assets/js/home-screen.mjs');for(let i=0;i<5;i++){document.getElementById('homeCamp').innerHTML=renderHomeMarkup();window.dispatchEvent(new Event('climblog:homeRendered'));}});
        await p.waitForSelector('.companionScene[data-ready]');assert.equal(await p.evaluate(()=>activeGifUrls.size),1);
        await p.evaluate(()=>{const spacer=document.createElement('div');spacer.style.height='2000px';document.body.append(spacer);window.scrollTo(0,2000);});
        await p.waitForFunction(()=>!document.getElementById('pixelRoom').hasAttribute('src'));assert.equal(await p.evaluate(()=>activeGifUrls.size),0);
        await p.evaluate(()=>window.scrollTo(0,0));await p.waitForSelector('.companionScene[data-ready]');
      }
      await p.screenshot({path:path.join(artifacts,'home-'+mode+'.png')});
    }
    assert.equal(await p.evaluate(()=>JSON.stringify(localStorage)),before);
    await p.locator('.homeQuick>summary').click();await p.locator('[data-home-entry=gym]').click();assert.equal(await p.locator('#modal').isVisible(),true);
    assert.deepEqual(external,[]);await ctx.close();
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({artifacts,nativeAnimatedGifs:campClips.length,randomAdvance:true,reducedMotionCanPlay:true,failedImageDoesNotBlockRecording:true,noAutomaticRetry:true,hiddenAndOffscreenUnloaded:true,cancelledLoadAndRemountSafe:true,objectUrlsReleased:true,noExternalRequests:true,errors},null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
