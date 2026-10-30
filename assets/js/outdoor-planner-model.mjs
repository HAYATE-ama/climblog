// Outdoor planning preferences; no addresses, route estimates or inferred crag locations.
export const weatherConsentVersion='weather-gemini-free-2026-10-31-v1';
const text=(v,max)=>{if(typeof v!=='string'||v.length>max||/[\u0000-\u001f\u007f]/.test(v))throw new Error('文字数・入力内容を確認してください。');return v.trim();};
const integer=(v,min,max)=>{if(!Number.isInteger(v)||v<min||v>max)throw new Error('候補日の数値設定を確認してください。');return v;};
export const defaultPlanner=()=>({version:1,origin:'',weekendTravelMinutes:180,weekdayTravelMinutes:60,dryHours:24,style:'comfort',profiles:[]});
export function validatePlanner(value,validateSite){
 if(!value||value.version!==1||!Array.isArray(value.profiles)||value.profiles.length>10)throw new Error('岩場は10か所まで登録できます。');
 const profiles=value.profiles.map(p=>{
  if(!p||!['weekend','night','both'].includes(p.period)||typeof p.id!=='string'||!/^site-[a-z0-9-]{1,60}$/.test(p.id))throw new Error('岩場の形式を確認してください。');
  const site=validateSite(p);
  if(!site.cragName)throw new Error('岩場名を入力してください。');
  return {...site,id:p.id,period:p.period,notes:text(p.notes??'',300),blocked:p.blocked===true};
 });
 if(new Set(profiles.map(p=>p.id)).size!==profiles.length)throw new Error('岩場の識別子が重複しています。');
 if(!['comfort','performance'].includes(value.style))throw new Error('比較の目的を選択してください。');
 return {version:1,origin:text(value.origin??'',100),weekendTravelMinutes:integer(value.weekendTravelMinutes,1,600),weekdayTravelMinutes:integer(value.weekdayTravelMinutes,1,600),dryHours:integer(value.dryHours,1,168),style:value.style,profiles};
}
export function evaluateOutdoorDay(legacy,settings,date,{now=Date.now(),dryHours=null,recentRain=null}={}){
 if(settings.blocked)return {date,status:'skip',label:'見送り',symbol:'×',reasons:['岩場の利用を見送る設定です。'],missing:[],reference:false};
 if(!legacy)return {date,status:'unknown',label:'判断材料不足',symbol:'?',reasons:['この日の新しい地域予報がありません。'],missing:['予報'],reference:false};
 if(legacy.status==='none'&&(/曜日の対象外|終了しています/.test(legacy.reason)))return {...legacy,status:'none',label:'対象外',symbol:'',reasons:[legacy.reason],missing:[]};
 const reasons=[],missing=['警報・雷・凍結・増水・アクセス規制の現地確認'],today=new Date(now+9*3600000).toISOString().slice(0,10),days=Math.round((Date.parse(date+'T00:00:00+09:00')-Date.parse(today+'T00:00:00+09:00'))/86400000),reference=days>=3;
 if(settings.blocked||/雷|雪/.test(legacy.weather))return {...legacy,status:'skip',label:'見送り',symbol:'×',reasons:[settings.blocked?'岩場の利用を見送る設定です。':'地域予報に雷または雪が含まれます。'],missing,reference};
 if(legacy.pop===null)missing.push('降水確率');
 if(!legacy.priorLabel||legacy.priorLabel.includes('情報不足'))missing.push('前日の雨');
 if(dryHours===null)missing.push('降雨終了時刻・乾燥時間（目安 '+settings.dryHours+'時間）');
 if(!recentRain)missing.push('直近72時間の雨量・連続降雨');
 reasons.push(legacy.basis+'：'+(legacy.pop===null?'不明':legacy.pop+'％'));
 if(legacy.priorLabel)reasons.push(legacy.priorLabel);
 if(legacy.pop>30)reasons.push('降水確率30％を超えます（優先条件）。');
 if(legacy.reliability==='C')reasons.push('週間予報の信頼度Cです。');
 if(dryHours!==null)reasons.push('降雨終了から'+dryHours+'時間（目安 '+settings.dryHours+'時間）。');
 if(recentRain)reasons.push('観測 '+(recentRain.throughDate||'前日')+' 24時までの72時間：'+recentRain.totalMm+'mm / 連続降雨 '+recentRain.wetDays+(recentRain.wetDays===3?'日以上。':'日。'));
 if(reference)reasons.push('4日目以降は参考情報です。');
 reasons.push('地域予報と岩場の標高・地形には差があります。乾燥・安全は未確認です。');
 const conditional=legacy.pop>30||legacy.reliability==='C'||legacy.priorPass===false||(dryHours!==null&&dryHours<settings.dryHours)||/雨/.test(legacy.weather);
 const status=legacy.pop===null?'unknown':conditional?'conditional':missing.length?'unknown':'recommended';
 return {...legacy,status,label:{unknown:'判断材料不足',conditional:'条件付き',recommended:'おすすめ'}[status],symbol:{unknown:'?',conditional:'△',recommended:'○'}[status],reasons,missing,reference};
}
export function weatherComparisonInput(rows,style){
 if(!['comfort','performance'].includes(style)||!Array.isArray(rows)||rows.length<1||rows.length>70)throw new Error('比較対象を確認してください。');
 const ids=new Set();
 const candidates=rows.map(r=>{
  const id=text(r.id,100);if(!/^[a-zA-Z0-9:_-]+$/.test(id)||ids.has(id))throw new Error('比較対象が重複しています。');ids.add(id);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!['recommended','conditional','skip','unknown'].includes(r.status))throw new Error('判定内容を確認してください。');
  return {id,crag:text(r.crag,100),date:r.date,status:r.status,reference:r.reference===true,notes:text(r.notes??'',300),reasons:(r.reasons||[]).slice(0,8).map(s=>text(s,300)),missing:(r.missing||[]).slice(0,8).map(s=>text(s,100)),issuedAt:text(r.issuedAt||'',40)};
 });
 return {version:1,style,candidates};
}
export function validateWeatherExplanation(draft,input){
 if(!draft||!Array.isArray(draft.comparisons)||draft.comparisons.length!==input.candidates.length)throw new Error('INVALID_AI_RESPONSE');
 const seen=new Set(),comparisons=draft.comparisons.map(c=>{const row=input.candidates.find(r=>r.id===c.id);if(!row||seen.has(c.id)||!Array.isArray(c.reasonIndices)||!c.reasonIndices.length||c.reasonIndices.length>4||new Set(c.reasonIndices).size!==c.reasonIndices.length||c.reasonIndices.some(n=>!Number.isInteger(n)||n<0||n>=row.reasons.length))throw new Error('INVALID_AI_RESPONSE');seen.add(c.id);return {id:c.id,explanation:c.reasonIndices.map(n=>row.reasons[n]).join(' / ')};});
 const rank={recommended:0,conditional:1,unknown:2,skip:3};comparisons.sort((a,b)=>rank[input.candidates.find(r=>r.id===a.id).status]-rank[input.candidates.find(r=>r.id===b.id).status]);
 return {summary:'取得済みの情報から比較した順です。判定は数値ルールを維持し、現地の乾燥・安全を保証しません。',comparisons};
}
