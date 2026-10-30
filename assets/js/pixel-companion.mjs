import {paintLandscape} from './home-landscape.mjs';
// Retain the painter contract for existing previews and reduced-motion tests.
export function paintRoom(ctx,time=0,action='idle',keepsakes=0,period='day'){paintLandscape(ctx,time,action,period);}
export function roomPeriod(hour){return hour<5||hour>=20?'night':hour<10?'morning':hour<17?'day':'evening';}
export function installPixelCompanion(){
 if(window.climbLogCompanion)return;
 let canvas=null,raf=0,last=0,frame=0,action='idle',until=0,idleAt=0,talkIndex=0,toastTimer=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const lines=['おかえり。君のペースで、ゆっくりいこう。','会いに来てくれて、うれしいよ。','次の一手は、あわてずに。','ひと息つこう。休む時間も大切だよ。'];
 const messages={celebrate:'記録できたね！今日の一歩、おつかれさま。',write:'今日の気づき、大切にしまっておこう。',rest:lines[3],climb:'次の一手を考え中。君のペースで進もう。',walk:'少し歩いて、気分転換。',wave:lines[1]};
 const visible=()=>canvas?.isConnected&&!document.hidden&&!document.getElementById('homeView')?.hidden&&!document.getElementById('appRoot')?.hidden;
 function speech(text){const el=document.getElementById('companionSpeech');if(el)el.textContent=text||messages[action]||lines[0];}
 function paint(){if(!canvas)return;const now=new Date(),moment=document.getElementById('homeMoment'),period=roomPeriod(now.getHours()),label=(now.getMonth()+1)+'月'+now.getDate()+'日・'+({morning:'朝',day:'昼',evening:'夕方',night:'夜'})[period];if(moment){moment.dateTime=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');if(moment.textContent!==label)moment.textContent=label;}canvas.dataset.action=action;canvas.dataset.period=period;canvas.dataset.motion=reduced.matches?'reduced':'animated';paintRoom(canvas.getContext('2d'),reduced.matches?0:frame,action,0,canvas.dataset.period);}
 function expire(){if(until&&Date.now()>=until){action='idle';until=0;idleAt=Date.now();speech();}}
 function loop(now){raf=0;if(!visible())return;if(reduced.matches){paint();return;}expire();if(now-last>=125){last=now;frame++;if(!until&&Date.now()-idleAt>20000){action=['climb','write','rest','walk'][Math.floor(frame/8)%4];until=Date.now()+5000;speech();}paint();}raf=requestAnimationFrame(loop);}
 function sync(){cancelAnimationFrame(raf);raf=0;if(!visible())return;expire();paint();if(!reduced.matches)raf=requestAnimationFrame(loop);}
 function react(next,text){action=next;until=next==='idle'?0:Date.now()+6000;idleAt=Date.now();speech(text);sync();}
 function mount(){canvas=document.getElementById('pixelRoom');frame=0;idleAt=Date.now();expire();speech();sync();}
 window.addEventListener('climblog:homeRendered',mount);
 window.addEventListener('climblog:companion',e=>{if(e.detail==='idle'&&action==='celebrate'&&until>Date.now())return;if(['idle','climb','write','rest','celebrate'].includes(e.detail))react(e.detail);});
 window.addEventListener('climblog:recordSaved',e=>{react('celebrate');let toast=document.getElementById('recordCelebration');if(!toast){toast=document.createElement('div');toast.id='recordCelebration';toast.className='recordCelebration';toast.setAttribute('role','status');document.body.append(toast);}toast.textContent=e.detail?.isNew?'✦ 記録をノートに残しました！':'✦ 記録を更新しました';toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,4000);});
 document.addEventListener('click',e=>{if(e.target.closest('[data-talk-companion]'))react('wave',lines[1+(talkIndex++%3)]);});
 document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
 const home=document.getElementById('homeView'),root=document.getElementById('appRoot');const observer=new MutationObserver(sync);for(const el of [home,root])if(el)observer.observe(el,{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('climblog:authLock',()=>{cancelAnimationFrame(raf);raf=0;clearTimeout(toastTimer);const toast=document.getElementById('recordCelebration');if(toast)toast.hidden=true;});
 window.addEventListener('pageshow',sync);window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);raf=0;});
 window.climbLogCompanion={refresh:sync};mount();
}
