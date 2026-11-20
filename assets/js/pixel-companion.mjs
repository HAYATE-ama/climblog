import {createCampPlayer} from './home-landscape.mjs';

export function installPixelCompanion() {
  if(window.climbLogCompanion)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let image=null,player=null,phase='paused',intersecting=false,paused=false,allowReduced=false;
  let locked=false,pageHidden=false,toastTimer=0,messageUntil=0;
  const visible=()=>image?.isConnected&&intersecting&&!document.hidden&&!pageHidden&&!locked
    &&!document.getElementById('homeView')?.hidden&&!document.getElementById('appRoot')?.hidden;
  const wantsMotion=()=>!paused&&(!reduced.matches||allowReduced);
  function speech(text) {
    if(Date.now()<messageUntil)return;
    const el=document.getElementById('companionSpeech');if(el&&el.textContent!==text)el.textContent=text;
  }
  function feedback(text){messageUntil=0;speech(text);messageUntil=Date.now()+6000;}
  function updateButton() {
    if(image)image.dataset.motion=reduced.matches&&!allowReduced?'reduced':phase==='playing'?'animated':phase;
    const button=document.querySelector('[data-camp-pause]');if(!button)return;
    const stopped=!wantsMotion()||phase==='error';
    button.hidden=false;button.textContent=stopped?'▶':'Ⅱ';
    button.setAttribute('aria-label',stopped?'ホームのアニメーションを再生':'ホームのアニメーションを一時停止');
    button.title=button.getAttribute('aria-label');button.setAttribute('aria-pressed',String(stopped));
  }
  function sync() {
    if(visible()&&wantsMotion()&&phase!=='error')player?.play();else player?.pause();
    updateButton();
  }
  const intersection=new IntersectionObserver(entries=>{
    const entry=entries.find(entry=>entry.target===image?.parentElement);
    if(entry){intersecting=entry.isIntersecting;sync();}
  });
  function mount() {
    const failed=phase==='error';
    intersection.disconnect();player?.dispose();phase=failed?'error':'paused';intersecting=false;
    image=document.getElementById('pixelRoom');
    if(!image){player=null;return;}
    player=createCampPlayer(image,{
      onCaption:speech,
      onState:next=>{phase=next;updateButton();},
      onError:()=>speech('景色を読み込めませんでした。記録はいつもどおり使えます。'),
    });
    if(failed)speech('景色を読み込めませんでした。記録はいつもどおり使えます。');
    intersection.observe(image.parentElement);sync();
  }
  document.addEventListener('click',event=>{
    if(!event.target.closest('[data-camp-pause]'))return;
    if(!wantsMotion()||phase==='error'){paused=false;allowReduced=true;phase='paused';}
    else paused=true;
    sync();
  });
  window.addEventListener('climblog:homeRendered',mount);
  window.addEventListener('climblog:companion',event=>{
    if(event.detail==='write')feedback('今日の気づき、大切にしまっておこう。');
  });
  window.addEventListener('climblog:recordSaved',event=>{
    feedback('記録できたね！今日の一歩、おつかれさま。');
    if(event.detail?.recordIds?.length&&document.getElementById('recordFeedback'))return;
    let toast=document.getElementById('recordCelebration');
    if(!toast){toast=document.createElement('div');toast.id='recordCelebration';toast.className='recordCelebration';toast.setAttribute('role','status');document.body.append(toast);}
    toast.textContent=event.detail?.isNew?'✦ 記録をノートに残しました！':'✦ 記録を更新しました';
    toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,4000);
  });
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',()=>{allowReduced=false;sync();});
  const observer=new MutationObserver(sync);
  for(const el of [document.getElementById('homeView'),document.getElementById('appRoot')]){
    if(el)observer.observe(el,{attributes:true,attributeFilter:['hidden']});
  }
  window.addEventListener('climblog:authLock',()=>{
    locked=true;sync();clearTimeout(toastTimer);const toast=document.getElementById('recordCelebration');if(toast)toast.hidden=true;
  });
  window.addEventListener('pagehide',()=>{pageHidden=true;sync();});
  window.addEventListener('pageshow',()=>{pageHidden=false;sync();});
  window.climbLogCompanion={refresh:sync};mount();
}
