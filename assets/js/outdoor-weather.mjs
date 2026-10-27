import {readOutdoorSettings} from './outdoor-settings-model.mjs';
import {getJmaRegion} from './jma-regions.mjs';
import {createWeatherService} from './weather-service.mjs';
import {parseJmaForecast,evaluateWeather} from './weather-model.mjs';
export function installOutdoorWeather(){
 const $=id=>document.getElementById(id),calendar=$('calendar'),view=$('calendarView'),service=createWeatherService();
 const summary=document.createElement('section');summary.id='outdoorWeatherSummary';summary.className='outdoorWeatherSummary';summary.hidden=true;document.querySelector('#calendarView .week').before(summary);
 const detail=document.createElement('section');detail.id='outdoorWeatherDetail';detail.className='outdoorWeatherDetail';detail.hidden=true;$('detail').before(detail);
 let forecast=null,key='',attempted=0,epoch=0,controller=null,message='',locked=false;
 const active=()=>!locked&&!view.hidden&&['all','outdoor'].includes(document.querySelector('#filters .active')?.dataset.kind);
 const settings=()=>readOutdoorSettings(window.climbLogStateApi.get().preferences);
 function clearMarks(){for(const el of calendar.querySelectorAll('.day')){el.classList.remove('weatherCandidate','weatherCheck');el.querySelector('.dayWeather')?.remove();const base=el.dataset.weatherBaseLabel;if(base){el.setAttribute('aria-label',base);delete el.dataset.weatherBaseLabel;}}detail.hidden=true;detail.replaceChildren();}
 function paint(){clearMarks();summary.replaceChildren();if(!active()){summary.hidden=true;return;}const config=settings(),region=getJmaRegion(config.forecastAreaCode);summary.hidden=!config.cragName;if(summary.hidden)return;
  const title=document.createElement('strong');title.textContent=config.cragName+' · '+(region?.name||'予報地域を設定してください');summary.append(title);
  const state=document.createElement('p');state.textContent=message;state.setAttribute('role','status');summary.append(state);
  if(!region){const open=document.createElement('button');open.type='button';open.textContent='設定を開く';open.onclick=()=>window.climbLogSettings.open();summary.append(open);return;}
  const source=document.createElement('a');source.href='https://www.jma.go.jp/bosai/forecast/#area_type=offices&area_code='+region.officeCode;source.target='_blank';source.rel='noopener noreferrer';source.textContent='出典：気象庁';const explanation=document.createElement('details'),heading=document.createElement('summary');heading.textContent='表示条件・出典';explanation.append(heading,source);summary.append(explanation);
  const note=document.createElement('small');note.textContent='○ 候補 / △ 要確認 · 降水確率30％以下が目安（ClimbLogで条件判定）。地域予報で、岩の乾き・安全の判定ではありません。';explanation.append(note);
  if(!forecast)return;
  for(const el of calendar.querySelectorAll('.day')){const result=evaluateWeather(forecast,config,el.dataset.date);if(!result)continue;const mark=document.createElement('span');mark.className='dayWeather';const badge=result.status==='candidate'?'○':result.status==='check'?'△':'';mark.textContent=badge+(result.pop===null?'予報':result.pop+'%');el.append(mark);if(result.status!=='none')el.classList.add(result.status==='candidate'?'weatherCandidate':'weatherCheck');el.dataset.weatherBaseLabel=el.getAttribute('aria-label');el.setAttribute('aria-label',el.dataset.weatherBaseLabel+' '+result.weather+' 降水確率'+(result.pop===null?'不明':result.pop+'パーセント')+(badge?' '+(badge==='○'?'候補':'要確認'):''));}
  const result=evaluateWeather(forecast,config,window.climbLogGetSelectedDate());if(result){detail.hidden=false;const h=document.createElement('strong');h.textContent=result.weather+(result.status==='candidate'?' · ○ 候補':result.status==='check'?' · △ 要確認':'');const p=document.createElement('p');p.textContent=result.basis+'：'+(result.pop===null?'未発表':result.pop+'％')+(result.reliability?' / 信頼度 '+result.reliability:'');const why=document.createElement('p');why.textContent=result.reason;const at=document.createElement('small');at.textContent='予報地域：'+result.forecastRegion+' / 発表 '+new Date(result.issuedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})+'（日本時間）';detail.append(h,p,why,at);}
 }
 async function update(){const config=settings(),region=getJmaRegion(config.forecastAreaCode),next=region?.code||'';if(next!==key){epoch++;controller?.abort();service.clear();forecast=null;attempted=0;key=next;message='';}if(!active()||!config.cragName||!region){paint();return;}if(Date.now()-attempted<30*60000){paint();return;}attempted=Date.now();const token=++epoch;controller?.abort();controller=new AbortController();message='予報を取得しています…';paint();try{const raw=await service.get(region.officeCode,{signal:controller.signal});if(token!==epoch||locked)return;forecast=parseJmaForecast(raw,region.code);const dates=Object.keys(forecast.days).sort(),issued=Object.values(forecast.days).map(row=>row.issuedAt).sort().at(-1);message='発表 '+new Date(issued).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})+'（日本時間） · '+'予報 '+dates[0].slice(5).replace('-','/')+'〜'+dates.at(-1).slice(5).replace('-','/')+' · 指定曜日の候補を表示';}catch(error){if(token!==epoch||locked)return;forecast=null;attempted=Date.now()-29*60000;message='予報を取得できません。候補表示を停止しています。接続回復時または約1分後に再確認します。';}paint();}
 new MutationObserver(()=>{if(!locked)void update();}).observe(calendar,{childList:true});
 new MutationObserver(()=>{if(!locked)void update();}).observe(view,{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('climblog:stateChanged',()=>{if(!locked)void update();});
 window.addEventListener('online',()=>{if(!locked&&active()&&!forecast){attempted=0;void update();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!locked)void update();});
 window.addEventListener('climblog:authLock',()=>{locked=true;epoch++;controller?.abort();service.clear();forecast=null;clearMarks();summary.replaceChildren();summary.hidden=true;});
 // Cloud reauthentication reloads the page; no weather request is made from the login screen.
 setInterval(()=>{if(!document.hidden&&active())void update();},60000);
 void update();
}
