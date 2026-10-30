import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultPlanner,evaluateOutdoorDay,weatherComparisonInput,validateWeatherExplanation} from '../assets/js/outdoor-planner-model.mjs';
import {validateOutdoorSettings,defaultOutdoorSettings} from '../assets/js/outdoor-settings-model.mjs';
import {validateBackup} from '../assets/js/backup-model.mjs';
const now=Date.parse('2026-10-31T08:00:00+09:00'),day='2026-10-31';
const base={date:day,status:'candidate',pop:20,basis:'時間帯別',priorLabel:'前日観測雨量：0mm',priorPass:true,weather:'晴れ',reliability:'A',issuedAt:'2026-10-31T05:00:00+09:00'};
const site={...defaultOutdoorSettings(),cragName:'テスト岩場',prefecture:'東京都',forecastAreaCode:'130010',id:'site-test',period:'weekend',notes:'日陰が多い',weekdays:[0,6],maxPreviousRainMm:3};
test('multi-crag preferences and unlocated sites retain legacy and backup compatibility',()=>{
 const input={...site,planner:{...defaultPlanner(),profiles:[site,{...site,id:'site-unknown',cragName:'位置未確認',prefecture:'',forecastAreaCode:undefined}]}};
 const normalized=validateOutdoorSettings(input);assert.equal(normalized.planner.profiles.length,2);assert.equal(normalized.planner.profiles[1].forecastAreaCode,undefined);assert.equal(validateBackup({records:[],preferences:{outdoorPlanning:normalized}}).preferences.outdoorPlanning.planner.profiles.length,2);
 const copy=structuredClone(input);validateOutdoorSettings(input);assert.deepEqual(input,copy);assert.equal(validateOutdoorSettings(site).planner,undefined);
 for(const patch of [{dryHours:0},{dryHours:169},{origin:'x'.repeat(101)},{weekdayTravelMinutes:0},{style:'unsafe'},{profiles:[site,site]},{profiles:[{...site,notes:'x'.repeat(301)}]}])assert.throws(()=>validateOutdoorSettings({...input,planner:{...input.planner,...patch}}));
});
test('rain beyond preference and short drying stay conditional; missing facts are never assumed dry',()=>{
 const settings={...defaultPlanner(),...site};assert.equal(evaluateOutdoorDay({...base,priorPass:false},settings,day,{now}).status,'conditional');
 assert.equal(evaluateOutdoorDay(base,settings,day,{now,dryHours:12}).status,'conditional');
 const result=evaluateOutdoorDay(base,settings,day,{now});assert.equal(result.status,'unknown');assert.ok(result.missing.some(s=>s.includes('乾燥')));assert.ok(result.missing.some(s=>s.includes('警報')));
 assert.equal(evaluateOutdoorDay({...base,pop:null,status:'none'},settings,day,{now}).status,'unknown');
 assert.equal(evaluateOutdoorDay(null,settings,day,{now}).status,'unknown');
});
test('snow, thunder and explicit closure never become recommended; unavailable dates remain separate',()=>{
 const settings={...defaultPlanner(),...site};for(const weather of ['雪','晴後雷'])assert.equal(evaluateOutdoorDay({...base,weather},settings,day,{now}).status,'skip');
 assert.equal(evaluateOutdoorDay(base,{...settings,blocked:true},day,{now}).status,'skip');
 assert.equal(evaluateOutdoorDay({...base,status:'none',reason:'指定した曜日の対象外です。'},settings,day,{now}).status,'none');
 assert.equal(evaluateOutdoorDay(base,settings,'2026-11-03',{now}).reference,true);
});
const row={id:'site-test:2026-10-31',crag:'テスト岩場',date:day,status:'unknown',issuedAt:base.issuedAt,notes:'公開可能な特徴',reasons:['雨量0mm','現地の乾燥は不明'],missing:['乾燥時間'],origin:'送らない',bodyweight:60,records:[{private:true}]};
test('weather input allowlist excludes origin, accounts, physical information and records',()=>{
 const input=weatherComparisonInput([row],'comfort'),json=JSON.stringify(input);assert.equal(json.includes('送らない'),false);assert.equal(json.includes('bodyweight'),false);assert.equal(json.includes('records'),false);
 assert.throws(()=>weatherComparisonInput([row,row],'comfort'));assert.throws(()=>weatherComparisonInput([{...row,date:'not-date'}],'comfort'));
});
test('AI only selects existing evidence; invented IDs, numbers and unsupported prose cannot reach UI',()=>{
 const input=weatherComparisonInput([row,{...row,id:'site-test:2026-11-01',date:'2026-11-01',status:'skip'}],'comfort');
 const result=validateWeatherExplanation({comparisons:[{id:input.candidates[1].id,reasonIndices:[1]},{id:row.id,reasonIndices:[0]}]},input);
 assert.equal(result.comparisons[0].id,row.id);assert.equal(result.comparisons[0].explanation,'雨量0mm');
 for(const comparisons of [[{id:'fake',reasonIndices:[0]}],input.candidates.map(r=>({id:r.id,reasonIndices:[99]})),input.candidates.map(r=>({id:r.id,reasonIndices:[0,0]})),[]])assert.throws(()=>validateWeatherExplanation({comparisons},input));
});

import {japaneseHoliday,siteAvailable} from '../assets/js/japanese-holidays.mjs';
test('verified Japanese holidays include substitutes and citizen holidays without guessing future years',()=>{assert.equal(japaneseHoliday('2026-09-22'),true);assert.equal(japaneseHoliday('2027-03-22'),true);assert.equal(japaneseHoliday('2026-11-04'),false);assert.equal(japaneseHoliday('2028-03-20'),null);assert.equal(siteAvailable({...site,weekdays:[0,6]},'2026-11-03'),true);assert.equal(siteAvailable({...site,weekdays:[0,6],period:'night'},'2026-11-03'),false);});
