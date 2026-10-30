import {siteAvailable,japaneseHoliday} from './japanese-holidays.mjs';
import {getRainStation} from './jma-rain-stations.mjs';
import {parsePreviousRain,previousDate} from './previous-rain.mjs';
import {readOutdoorSettings} from './outdoor-settings-model.mjs';
import {getJmaRegion} from './jma-regions.mjs';
import {createWeatherService} from './weather-service.mjs';
import {parseJmaForecast,evaluateWeather,jstDate} from './weather-model.mjs';
import {evaluateOutdoorDay} from './outdoor-planner-model.mjs';
import {createWeatherAdvisor} from './weather-advisor-ui.mjs';
export function installOutdoorWeather(){
 const $=id=>document.getElementById(id),calendar=$('calendar'),view=$('calendarView'),service=createWeatherService();
 const summary=document.createElement('section');summary.id='outdoorWeatherSummary';summary.className='outdoorWeatherSummary';summary.hidden=true;document.querySelector('#calendarView .week').before(summary);
 const detail=document.createElement('section');detail.id='outdoorWeatherDetail';detail.className='outdoorWeatherDetail';detail.hidden=true;$('detail').before(detail);
 let data=new Map(),key='',attempted=0,epoch=0,controller=null,message='',locked=false,selectedId='',legendOpen=false;
 const rootSettings=()=>readOutdoorSettings(window.climbLogStateApi.get().preferences);
 const sites=()=>{const config=rootSettings();return config.planner?.profiles.length?config.planner.profiles:[{...config,id:'legacy'}];};
 const selected=()=>sites().find(p=>p.id===selectedId)||sites().find(p=>p.cragName===rootSettings().cragName)||sites()[0];
 const active=()=>!locked&&!view.hidden&&['all','outdoor'].includes(document.querySelector('#filters .active')?.dataset.kind);
 function dayResult(site,date){if(rootSettings().planner&&!siteAvailable(site,date))return {date,status:'none',label:'対象外',symbol:'',reasons:['指定した曜日の対象外です。'],missing:[]};const entry=data.get(site.id),legacy=evaluateWeather(entry?.forecast,rootSettings().planner&&site.period==='weekend'&&japaneseHoliday(date)===true?{...site,weekdays:[0,1,2,3,4,5,6]}:site,date,{previousRain:entry?.previousRain});return rootSettings().planner?evaluateOutdoorDay(legacy,{...rootSettings().planner,...site},date,{recentRain:entry?.recentRain}):legacy;}
 function rows(){const today=jstDate(Date.now()),planner=rootSettings().planner;if(!planner)return [];const result=[];for(const site of sites())for(let n=0;n<7;n++){const date=jstDate(Date.parse(today+'T00:00:00+09:00')+n*86400000),r=dayResult(site,date);if(r.status==='none')continue;result.push({id:site.id+':'+date,crag:site.cragName,date,status:r.status,reference:r.reference,notes:[site.notes||'', '活動時間 '+site.startTime+'〜'+site.endTime].join(' / '),reasons:r.reasons,missing:r.missing,issuedAt:r.issuedAt||''});}return result;}
 const advisor=createWeatherAdvisor({rows,style:()=>rootSettings().planner?.style||'comfort'});
 function clearMarks(){for(const el of calendar.querySelectorAll('.day')){el.classList.remove('weatherCandidate','weatherCheck','weatherSkip','weatherUnknown');el.querySelector('.dayWeather')?.remove();const base=el.dataset.weatherBaseLabel;if(base){el.setAttribute('aria-label',base);delete el.dataset.weatherBaseLabel;}}detail.hidden=true;detail.replaceChildren();}
 function addText(parent,tag,text){const el=document.createElement(tag);el.textContent=text;parent.append(el);return el;}
 function paint(){
  clearMarks();summary.replaceChildren();if(!active()){summary.hidden=true;return;}
  const root=rootSettings(),config=selected(),region=getJmaRegion(config.forecastAreaCode),entry=data.get(config.id);summary.hidden=!config.cragName;if(summary.hidden)return;
  if(root.planner){const label=document.createElement('label');label.textContent='岩場 ';const select=document.createElement('select');select.id='weatherSiteSelector';select.setAttribute('aria-label','候補日を表示する岩場');for(const site of sites())select.add(new Option(site.cragName+(site.period==='night'?' · ナイト':''),site.id));select.value=config.id;select.onchange=()=>{selectedId=select.value;paint();};label.append(select);summary.append(label);}
  addText(summary,'strong',config.cragName+' · '+(region?.name||'予報地域は未確認'));
  addText(summary,'p',message).setAttribute('role','status');
  if(!region){addText(summary,'p','? 判断材料不足：場所を推測せず、予報地域の確認を待っています。');}
  const controls=document.createElement('div');controls.className='weatherActions';const refresh=document.createElement('button');refresh.type='button';refresh.id='refreshOutdoorWeather';refresh.textContent='天気を再取得';refresh.onclick=()=>{if(Date.now()-attempted<10000)return;service.clear();attempted=0;void update();};const edit=document.createElement('button');edit.type='button';edit.textContent='場所・条件を変更';edit.onclick=()=>window.climbLogSettings.openOutdoor();controls.append(refresh,edit);summary.append(controls);
  const explanation=document.createElement('details');explanation.open=legendOpen;explanation.ontoggle=()=>{legendOpen=explanation.open;};addText(explanation,'summary','表示条件・出典');const source=document.createElement('a');source.href=region?'https://www.jma.go.jp/bosai/forecast/#area_type=offices&area_code='+region.officeCode:'https://www.jma.go.jp/bosai/forecast/';source.target='_blank';source.rel='noopener noreferrer';source.textContent='出典：気象庁ホームページをClimbLogで加工';explanation.append(source);
  addText(explanation,'small',root.planner?'○ おすすめ / △ 条件付き / × 見送り / ? 判断材料不足。直近3日を中心に、4日目以降は参考表示。降水確率30％・前日の雨量は優先条件です。警報・現地・移動経路は未確認。':'○ 候補 / △ 要確認。当日と前日の雨を確認。降水確率30％以下が目安。地域予報で、岩の乾き・安全の判定ではありません。');summary.append(explanation);
  if(root.planner){const host=document.createElement('div');summary.append(host);advisor.render(host);}
  if(!config.rainStationCode)addText(summary,'p','前日の実降水量を使うには、雨の観測地点を設定してください。');
  const today=jstDate(Date.now()),last=jstDate(Date.parse(today+'T00:00:00+09:00')+6*86400000);
  for(const el of calendar.querySelectorAll('.day')){
   if(root.planner&&(el.dataset.date<today||el.dataset.date>last))continue;
   const result=dayResult(config,el.dataset.date);if(!result||root.planner&&result.status==='none')continue;
   const mark=document.createElement('span');mark.className='dayWeather';const modern=Boolean(root.planner),badge=modern?result.symbol:result.status==='candidate'?'○':result.status==='check'?'△':'';
   mark.textContent=modern?badge+(result.pop==null?'':result.reference?'参考':result.pop+'%'):badge+(result.pop===null?'予報':result.pop+'%');
   el.append(mark);const className=modern?{recommended:'weatherCandidate',conditional:'weatherCheck',skip:'weatherSkip',unknown:'weatherUnknown'}[result.status]:result.status==='candidate'?'weatherCandidate':result.status==='check'?'weatherCheck':null;if(className)el.classList.add(className);
   el.dataset.weatherBaseLabel=el.getAttribute('aria-label');el.setAttribute('aria-label',el.dataset.weatherBaseLabel+' '+(result.weather||'予報なし')+' '+(result.label||badge)+(result.pop==null?'':' 降水確率'+result.pop+'パーセント'));
  }
  const date=window.climbLogGetSelectedDate(),result=dayResult(config,date);if(!result||root.planner&&(date<today||date>last))return;
  detail.hidden=false;addText(detail,'strong',(result.weather||'予報なし')+' · '+(result.label||(result.status==='candidate'?'○ 候補':result.status==='check'?'△ 要確認':'')));
  if(root.planner){for(const reason of result.reasons)addText(detail,'p',reason);if(result.missing.length)addText(detail,'p','未確認：'+result.missing.join('・'));addText(detail,'small','湿度・風・日照・露点は未取得。岩質・乾きやすさは登録された特徴のみを参考にします。');}
  else {addText(detail,'p',result.basis+'：'+(result.pop===null?'未発表':result.pop+'％')+(result.reliability?' / 信頼度 '+result.reliability:''));addText(detail,'p',result.priorLabel+(entry?.previousRain&&date===today?' / 観測地点：'+(getRainStation(entry.previousRain.stationCode)?.name||''):''));addText(detail,'p',result.reason);}
  if(result.issuedAt)addText(detail,'small','予報地域：'+result.forecastRegion+' / 発表 '+new Date(result.issuedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})+'（日本時間）');
 }
 async function update(){
  const config=rootSettings(),list=sites(),next=JSON.stringify(list.map(p=>[p.id,p.forecastAreaCode,p.rainStationCode]))+'|'+jstDate(Date.now());
  if(next!==key){epoch++;controller?.abort();service.clear();data=new Map();attempted=0;key=next;message='';}
  if(!active()||!config.cragName){paint();return;}
  if(Date.now()-attempted<30*60000){paint();return;}attempted=Date.now();const ticket=++epoch;controller?.abort();controller=new AbortController();message='予報を取得しています…';paint();
  const fetchSite=async site=>{const region=getJmaRegion(site.forecastAreaCode);if(!region)return [site.id,{}];let forecast=null;try{forecast=parseJmaForecast(await service.get(region.officeCode,{signal:controller.signal}),region.code);}catch{}
   const observations=[];if(site.rainStationCode){let date=jstDate(Date.now());for(let n=0;n<(config.planner?3:1);n++){try{observations.push(parsePreviousRain(await service.getRain(site.rainStationCode,date,{signal:controller.signal}),site.rainStationCode,date));}catch{}date=previousDate(date);}}
   observations.sort((a,b)=>b.date.localeCompare(a.date));const yesterday=previousDate(jstDate(Date.now())),previousRain=observations.find(r=>r.date===yesterday)||null;
   let recentRain=null;if(observations.length===3&&observations[0].date===yesterday){let wetDays=0;for(const o of observations){if(o.amountMm>0)wetDays++;else break;}recentRain={throughDate:yesterday,totalMm:observations.reduce((s,r)=>s+r.amountMm,0),wetDays};}
   return [site.id,{forecast,previousRain,recentRain}];};
  const loaded=[];for(const site of list){if(ticket!==epoch||locked)return;loaded.push(await fetchSite(site));}
  if(ticket!==epoch||locked)return;data=new Map(loaded);const forecasts=loaded.filter(([,v])=>v.forecast);message=forecasts.length?'気象庁の地域予報 · 登る日を選ぶと判定理由を表示します。':'予報を取得できません。候補表示を停止しています。接続回復時または約1分後に再確認します。';
  if(!forecasts.length)attempted=Date.now()-29*60000;paint();
 }
 new MutationObserver(()=>{if(!locked)void update();}).observe(calendar,{childList:true});
 new MutationObserver(()=>{if(!locked)void update();}).observe(view,{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('climblog:stateChanged',()=>{if(!locked)void update();});
 window.addEventListener('online',()=>{if(!locked&&active()&&![...data.values()].some(v=>v.forecast)){attempted=0;void update();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!locked)void update();});
 window.addEventListener('climblog:authLock',()=>{locked=true;epoch++;controller?.abort();service.clear();data.clear();clearMarks();summary.replaceChildren();summary.hidden=true;});
 setInterval(()=>{if(!document.hidden&&active())void update();},60000);void update();
}
