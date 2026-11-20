// Run from the repository root. Development-only dependencies are supplied via
// CLIMBLOG_PLAYWRIGHT_MODULE and CLIMBLOG_GIFENC_MODULE; nothing is loaded by the app.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {campClips,campFrameStep,campFrameDelay} from '../assets/js/basecamp-model.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CLIMBLOG_PLAYWRIGHT_MODULE||'playwright');
const {GIFEncoder,quantize,applyPalette}=require(process.env.CLIMBLOG_GIFENC_MODULE||'gifenc');
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const width=600,height=360,outDir=path.join(root,'assets/images/basecamp');
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  if(name==='/render.html'){res.setHeader('Content-Type','text/html');res.end('<canvas width="600" height="360"></canvas>');return;}
  if(!/^\/tools\/basecamp\/[\w.-]+$/.test(name)){res.writeHead(404);res.end();return;}
  const file=path.resolve(root,'.'+name);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':'image/webp');res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({executablePath:process.env.CLIMBLOG_BROWSER,headless:true,args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await page.goto(origin+'/render.html');
  await page.evaluate(async()=>{
    const {createCampRenderer}=await import('/tools/basecamp/renderer.mjs');
    window.createClip=async clip=>{window.renderer?.dispose();const canvas=document.querySelector('canvas');canvas.width=600;canvas.height=360;window.renderer=createCampRenderer(canvas,{clip});window.time=0;return renderer.ready;};
    window.pixels=at=>{renderer.render(at-time);time=at;const bytes=document.querySelector('canvas').getContext('2d').getImageData(0,0,600,360).data;let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);};
  });
  const pixels=async time=>new Uint8Array(Buffer.from(await page.evaluate(time=>window.pixels(time),time),'base64'));
  let total=0;
  for(const clip of campClips){
    assert.equal(await page.evaluate(clip=>window.createClip(clip),clip),true);
    const samples=[];
    for(const time of [0,clip.sourceSeconds*.4,clip.sourceSeconds*.8])samples.push(await pixels(time));
    const merged=new Uint8Array(samples.reduce((n,s)=>n+s.length,0));let offset=0;for(const sample of samples){merged.set(sample,offset);offset+=sample.length;}
    const colors=quantize(merged,255,{format:'rgb565'}),palette=[...colors];while(palette.length<256)palette.push([0,0,0]);
    await page.evaluate(clip=>window.createClip(clip),clip);
    const gif=GIFEncoder();let previous;
    for(let frame=0;frame<clip.frames;frame++){
      const rgba=await pixels(frame*campFrameStep),indices=applyPalette(rgba,colors,'rgb565'),full=indices.slice();
      if(previous)for(let i=0;i<indices.length;i++)if(indices[i]===previous[i])indices[i]=255;
      gif.writeFrame(indices,width,height,{...(frame===0?{palette}:{}),delay:campFrameDelay,repeat:-1,dispose:1,transparent:frame>0,transparentIndex:255});
      previous=full;
      if(clip.id==='walk-sunny'&&frame===0){
        const poster=await page.evaluate(()=>document.querySelector('canvas').toDataURL('image/webp',.9));
        fs.writeFileSync(path.join(outDir,'poster.webp'),Buffer.from(poster.split(',')[1],'base64'));
      }
    }
    gif.finish();const bytes=gif.bytes();fs.writeFileSync(path.join(outDir,clip.id+'.gif'),bytes);total+=bytes.length;
    console.log(clip.id+': '+bytes.length+' bytes / '+clip.frames+' frames');
  }
  assert.deepEqual(errors,[]);console.log('Total GIF bytes: '+total);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
