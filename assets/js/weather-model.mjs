import {previousDate} from './previous-rain.mjs';
import {getJmaRegion,jmaWeatherLabels} from './jma-regions.mjs';
export const jstDate=now=>new Date(Number(now)+9*3600000).toISOString().slice(0,10);
const number=v=>typeof v==='string'&&/^\d{1,3}$/.test(v)&&Number(v)<=100?Number(v):null;
const weeklyMerged={'130020':'130100','130030':'130100','200020':'200100','200030':'200100','420010':'420100','420020':'420100','420040':'420100','460010':'460100','460020':'460100','460030':'460100'};
export function parseJmaForecast(payload,areaCode,{now=Date.now()}={}){
 const region=getJmaRegion(areaCode);if(!region||!Array.isArray(payload)||!payload.length)throw new Error('予報データの形式を確認できません。');
 const days={};let validBlocks=0;
 for(const block of payload){const issued=Date.parse(block?.reportDatetime);if(!Number.isFinite(issued)||issued>now+5*60000||now-issued>18*3600000||!Array.isArray(block.timeSeries))continue;
  for(const series of block.timeSeries){if(!Array.isArray(series.timeDefines)||!Array.isArray(series.areas))continue;
   const areas=series.areas.filter(a=>a?.area&&Array.isArray(a.weatherCodes));
   let selected=areas.find(a=>a.area.code===areaCode)||areas.find(a=>a.area.code===weeklyMerged[areaCode]);
   // A single weekly area covers the office. Never guess among several unrelated areas.
   if(!selected&&areas.length===1&&Array.isArray(areas[0].reliabilities))selected=areas[0];
   if(selected){validBlocks++;series.timeDefines.forEach((time,i)=>{if(typeof time!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(time)||!Number.isFinite(Date.parse(time)))return;const date=jstDate(Date.parse(time)),code=selected.weatherCodes[i];if(typeof code!=='string'||!/^\d{3}$/.test(code)||!Object.hasOwn(jmaWeatherLabels,code))return;const weekly=Array.isArray(selected.reliabilities),existing=days[date]||{};if(existing.issuedAt&&Date.parse(existing.issuedAt)>issued)return;
     days[date]={...existing,date,weather:weekly&&existing.shortWeather?existing.weather:jmaWeatherLabels[code],shortWeather:!weekly||existing.shortWeather,issuedAt:block.reportDatetime,forecastRegion:weekly&&existing.shortWeather?existing.forecastRegion:selected.area.name,dailyPop:weekly?number(selected.pops?.[i]):existing.dailyPop??null,reliability:weekly&&['A','B','C'].includes(selected.reliabilities[i])?selected.reliabilities[i]:existing.reliability||null,slots:existing.slots||[]};});}
   const pops=series.areas.find(a=>a?.area?.code===areaCode&&Array.isArray(a.pops)&&!a.weatherCodes);
   if(pops)series.timeDefines.forEach((time,i)=>{const start=Date.parse(time);if(!Number.isFinite(start))return;const date=jstDate(start);if(!days[date])return;days[date].slots.push({start,end:start+6*3600000,pop:number(pops.pops[i]),issuedAt:block.reportDatetime});});
  }
 }
 if(!validBlocks||!Object.keys(days).length)throw new Error('新しい地域予報を確認できません。');
 return {areaCode,days};
}
export function evaluateWeather(forecast,settings,date,{now=Date.now(),previousRain=null}={}){
 const row=forecast?.days?.[date];if(!row||date<jstDate(now)||now-Date.parse(row.issuedAt)>18*3600000)return null;
 const weekday=new Date(date+'T12:00:00+09:00').getUTCDay(); // Noon JST has the same calendar date in UTC.
 const selected=settings.weekdays.includes(weekday),start=Date.parse(date+'T'+settings.startTime+':00+09:00'),end=Date.parse(date+'T'+settings.endTime+':00+09:00');
 const slots=row.slots.filter(s=>s.start<end&&s.end>start).sort((a,b)=>a.start-b.start);let cursor=start,covered=true;const values=[];
 for(const s of slots){if(s.start>cursor||s.pop===null){covered=false;break;}cursor=Math.max(cursor,s.end);values.push(s.pop);}covered=covered&&cursor>=end&&values.length>0;
 const pop=covered?Math.max(...values):row.dailyPop,basis=covered?'活動時間帯（6時間区分）の最大降水確率':'1日全体の降水確率';
 const priorDate=previousDate(date),today=jstDate(now),limit=settings.maxPreviousRainMm??1;let priorPass=false,priorLabel='前日の雨：情報不足',priorReason='前日の雨を確認できないため要確認です。';
 if(date===today){if(previousRain?.date===priorDate&&previousRain.stationCode===settings.rainStationCode&&Number.isFinite(previousRain.amountMm)&&previousRain.amountMm>=0){priorPass=previousRain.amountMm<=limit;priorLabel='前日 '+priorDate.slice(5).replace('-','/')+' の観測降水量：'+previousRain.amountMm+'mm（条件 '+limit+'mm以下）';priorReason=priorPass?'前日の観測降水量が条件内です。':'前日の観測降水量が条件を超えています。';}}
 else{const prior=forecast.days[priorDate];if(prior&&now-Date.parse(prior.issuedAt)<=18*3600000){const ps=prior.slots.filter(s=>s.pop!==null);const whole=ps.length===4&&new Set(ps.map(s=>s.start)).size===4&&ps.every(s=>new Date(s.start+9*3600000).getUTCHours()%6===0)?Math.max(...ps.map(s=>s.pop)):null;const probability=whole??prior.dailyPop;priorPass=probability!==null&&probability<=30&&prior.reliability!=='C'&&!/雨|雪|雷/.test(prior.weather);priorLabel='前日 '+priorDate.slice(5).replace('-','/')+' の予報：'+prior.weather+' / 降水確率 '+(probability===null?'不明':probability+'％')+'（観測雨量ではありません）';priorReason=priorPass?'前日は雨・雪の予報がなく、降水確率30％以下です。':'前日の予報が雨・雪、確率が高い、または情報不足のため要確認です。';}}
 const eligible=selected&&end>now&&pop!==null,good=eligible&&pop<=30&&row.reliability!=='C'&&priorPass;
 return {...row,pop,basis,priorLabel,priorPass,status:!eligible?'none':good?'candidate':'check',reason:!selected?'指定した曜日の対象外です。':end<=now?'活動時間帯が終了しています。':pop===null?'降水確率が不足しているため候補判定しません。':row.reliability==='C'?'週間予報の信頼度Cのため要確認です。':pop>30?'当日の降水確率が30％を超えるため要確認です。':!priorPass?priorReason:'当日と前日の雨の条件に合います。'};
}
