import {createCampRenderer} from './home-landscape.mjs';

export function installPixelCompanion() {
  if (window.climbLogCompanion) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let canvas=null, renderer=null, frameId=0, lastFrame=null, intersecting=false;
  let ready=false, paused=false, locked=false, pageHidden=false, toastTimer=0, messageUntil=0;
  const visible = () => canvas?.isConnected && intersecting && !document.hidden && !pageHidden && !locked
    && !document.getElementById('homeView')?.hidden && !document.getElementById('appRoot')?.hidden;
  const running = () => ready && visible() && !paused && !reduced.matches;
  function speech(text) {
    if (Date.now()<messageUntil) return;
    const el=document.getElementById('companionSpeech');
    if (el && el.textContent!==text) el.textContent=text;
  }
  function feedback(text) {
    messageUntil=0;speech(text);messageUntil=Date.now()+6000;
  }
  function stop() {cancelAnimationFrame(frameId);frameId=0;lastFrame=null;}
  function paintDate() {
    const now=new Date(),el=document.getElementById('homeMoment');
    if (!el) return;
    el.dateTime=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    const label=(now.getMonth()+1)+'月'+now.getDate()+'日・'+['日','月','火','水','木','金','土'][now.getDay()]+'曜日';
    if (el.textContent!==label) el.textContent=label;
  }
  function loop(now) {
    frameId=0;
    if (!running()) {lastFrame=null;return;}
    if (lastFrame===null) lastFrame=now;
    if (now-lastFrame>=1000/24) {
      const dt=Math.min(.1,(now-lastFrame)/1000);lastFrame=now;
      renderer.render(dt);paintDate();
    }
    frameId=requestAnimationFrame(loop);
  }
  function sync() {
    stop();paintDate();
    if (canvas) canvas.dataset.motion=reduced.matches?'reduced':paused?'paused':running()?'animated':'paused';
    const button=document.querySelector('[data-camp-pause]');
    if (button) {
      button.hidden=reduced.matches || !ready;
      button.textContent=paused?'▶':'Ⅱ';
      button.setAttribute('aria-label',paused?'ホームのアニメーションを再開':'ホームのアニメーションを一時停止');
      button.title=button.getAttribute('aria-label');
      button.setAttribute('aria-pressed',String(paused));
    }
    if (running()) frameId=requestAnimationFrame(loop);
  }
  const intersection=new IntersectionObserver(entries=>{
    const entry=entries.find(entry=>entry.target===canvas?.parentElement);
    if (entry) {intersecting=entry.isIntersecting;sync();}
  });
  function mount() {
    stop();intersection.disconnect();renderer?.dispose();ready=false;intersecting=false;
    canvas=document.getElementById('pixelRoom');
    if (!canvas) {renderer=null;return;}
    const current=canvas,scene=canvas.parentElement;
    // Bound the backing store on high-DPI phones, instead of using the full device pixel ratio.
    canvas.width=Math.min(1000,Math.max(600,Math.round(scene.clientWidth*1.5)));
    canvas.height=Math.round(canvas.width*.6);
    const currentRenderer=createCampRenderer(canvas,{
      onCaption:speech,
      onWeather:label=>{const el=scene.querySelector('.campWeatherName');if(el)el.textContent=label;},
    });
    renderer=currentRenderer;intersection.observe(scene);sync();
    currentRenderer.ready.then(loaded=>{
      if (canvas!==current || renderer!==currentRenderer) return;
      ready=loaded;
      if (loaded) {scene.dataset.ready='true';currentRenderer.render(reduced.matches?10:0);}
      else speech('景色は読み込めませんでしたが、記録はいつもどおり使えます。');
      sync();
    });
  }
  window.addEventListener('climblog:homeRendered',mount);
  document.addEventListener('click',event=>{
    if (event.target.closest('[data-camp-pause]')) {paused=!paused;sync();}
  });
  // Save feedback never changes the randomly chosen weather or action.
  window.addEventListener('climblog:companion',event=>{
    if (event.detail==='write') feedback('今日の気づき、大切にしまっておこう。');
  });
  window.addEventListener('climblog:recordSaved',event=>{
    feedback('記録できたね！今日の一歩、おつかれさま。');
    if (event.detail?.recordIds?.length && document.getElementById('recordFeedback')) return;
    let toast=document.getElementById('recordCelebration');
    if (!toast) {toast=document.createElement('div');toast.id='recordCelebration';toast.className='recordCelebration';toast.setAttribute('role','status');document.body.append(toast);}
    toast.textContent=event.detail?.isNew?'✦ 記録をノートに残しました！':'✦ 記録を更新しました';
    toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,4000);
  });
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  const observer=new MutationObserver(sync);
  for (const el of [document.getElementById('homeView'),document.getElementById('appRoot')]) {
    if (el) observer.observe(el,{attributes:true,attributeFilter:['hidden']});
  }
  window.addEventListener('climblog:authLock',()=>{
    locked=true;sync();clearTimeout(toastTimer);
    const toast=document.getElementById('recordCelebration');if(toast)toast.hidden=true;
  });
  window.addEventListener('pagehide',()=>{pageHidden=true;sync();});
  window.addEventListener('pageshow',()=>{pageHidden=false;sync();});
  window.climbLogCompanion={refresh:sync};
  mount();
}
