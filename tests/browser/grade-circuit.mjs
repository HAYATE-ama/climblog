import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.CLIMBLOG_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),index=await readFile(path.join(root,'index.html'),'utf8');
const fixture=index.replace('<script src="./config.js"></script><script type="module" src="./assets/js/cloud.js"></script>',`<script type="module">
window.climbLogAccountId=sessionStorage.getItem('testOwner')||'test-circuit';document.querySelector('#authScreen').hidden=true;document.querySelector('#appRoot').hidden=false;
await import('/assets/js/app.js');await import('/assets/js/enhancements.js');window.testReady=true;</script>`);
assert.notEqual(index,fixture);
const url='https://circuit.test';
async function localFixture(route){
  const {pathname,origin}=new URL(route.request().url());
  if(origin!==url)return route.abort();
  if(pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:fixture});
  if(!/^\/assets\/(js|css|icons)\/[\w.-]+$/.test(pathname))return route.fulfill({status:404,body:''});
  const contentType=pathname.endsWith('.css')?'text/css':pathname.endsWith('.png')?'image/png':'text/javascript; charset=utf-8';
  return route.fulfill({contentType,body:await readFile(path.join(root,pathname))});
}
let browser;
try{
  browser=await chromium.launch({executablePath:process.env.CLIMBLOG_BROWSER,headless:true});
  for(const [width,theme] of [[320,'dark'],[390,'light'],[1280,'light']]){
    const ctx=await browser.newContext({viewport:{width,height:800},serviceWorkers:'block'});
    await ctx.route('**/*',localFixture);
    await ctx.addInitScript(theme=>localStorage.setItem('climbLogPreferences',JSON.stringify({theme})),theme);
    const p=await ctx.newPage(),errors=[];
    p.on('pageerror',err=>errors.push(err.message));
    const d=p.locator('dialog.gradeCircuit');
    const doAct=async a=>{await d.locator('[data-circuit="'+a+'"]').click();await p.evaluate(()=>navigator.locks.request('climbLogGradeCircuit:test-circuit',()=>{}));};
    const open=async()=>{await p.locator('#calendarTab').click();await p.locator('#calendarView [data-open-workout]').click();await p.locator('[data-workout-act=grade-circuit]').click()};
    await p.goto(url);await p.waitForFunction(()=>window.testReady);await open();
    await d.locator('[name=total]').fill('12');await d.locator('.circuitSetupMore summary').click();await d.locator('[name=timed]').uncheck();await d.getByRole('button',{name:'サーキットを開始'}).click();
    await d.locator('[data-route-index="11"]').waitFor();assert.equal(await d.locator('[data-route-index]').count(),12);
    const tile=i=>d.locator('[data-route-index="'+i+'"]');await tile(7).click();await doAct('fall');await doAct('fall');
    await doAct('close');await p.reload();await p.waitForFunction(()=>window.testReady);await open();
    await tile(7).click();assert.match(await d.locator('.circuitCurrent').innerText(),/2トライ/);
    await doAct('sent');await doAct('undo');await doAct('sent');await doAct('sent');await doAct('fall');await doAct('sent');
    assert.match(await d.locator('.circuitCurrent').innerText(),/完登 3回.*途中落ち 3回/);
    assert.match(await tile(7).innerText(),/3回/);await doAct('filter');
    await tile(7).waitFor({state:'detached'});assert.equal(await d.locator('[data-route-index]').count(),11);
    await d.locator('.circuitSettings summary').click();await d.locator('[name=total]').fill('');await d.getByRole('button',{name:'総課題数を変更'}).click();await d.locator('.circuitSettings summary').click();
    await doAct('add');await doAct('tape');await d.locator('[data-shape="＋"]').click();
    await d.locator('[name=wall]').fill('ルーフ左');await d.locator('form button.primary').click();
    await d.locator('.circuitCurrent').filter({hasText:'ルーフ左 · ＋'}).waitFor();await doAct('fall');
    await d.locator('.circuitSettings summary').click();await doAct('add');await d.locator('[name=wall]').fill('ルーフ左');await d.locator('form button.primary').click();
    await d.locator('.circuitCurrent').waitFor();assert.equal(await d.locator('[data-route-index]').count(),13);
    assert.deepEqual(await p.evaluate(()=>window.climbLogStateApi.get().records),[]);
    assert.ok(await d.evaluate(e=>e.scrollWidth<=e.clientWidth+1));
    if(width===320){
      await doAct('close');await p.evaluate(()=>sessionStorage.setItem('testOwner','other'));await p.reload();await p.waitForFunction(()=>window.testReady);await open();
      assert.equal(await d.locator('[data-form=setup]').count(),1);await doAct('close');
      await p.evaluate(()=>sessionStorage.removeItem('testOwner'));await p.reload();await p.waitForFunction(()=>window.testReady);await open();
      await p.evaluate(()=>{const k='climbLogGradeCircuit:test-circuit';localStorage.setItem(k,localStorage.getItem(k)+' ');});
      await tile(0).click();await doAct('fall');assert.match(await d.locator('[role=status]').innerText(),/別の画面/);
      await doAct('close');await p.locator('[data-workout-act=grade-circuit]').click();
    }
    await doAct('finish');
    if(width===390){
      await p.evaluate(()=>{const api=window.climbLogStateApi,apply=api.apply;api.apply=patch=>{api.apply=apply;throw new Error('テスト用保存失敗')};});
      await doAct('save');assert.match(await d.locator('[role=status]').innerText(),/テスト用保存失敗/);
      assert.equal(await p.evaluate(()=>window.climbLogStateApi.get().records.length),0);
    }
    await doAct('save');await d.waitFor({state:'hidden'});
    const rows=await p.evaluate(()=>window.climbLogStateApi.get().records);
    assert.deepEqual(rows.map(r=>[r.memo,r.sends,r.tries]),[['8番',3,6],['ルーフ左 · ＋',0,1]]);
    assert.equal(await p.locator('#calendarView').isVisible(),true);
    await p.locator('#detail summary').first().click();
    assert.match(await p.locator('#detail').innerText(),/8番/);assert.deepEqual(errors,[]);
    await ctx.close();console.log(width,theme,'passed');
  }
}finally{await browser?.close()}
