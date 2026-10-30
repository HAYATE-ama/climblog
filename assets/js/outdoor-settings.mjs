import {rainStations} from './jma-rain-stations.mjs';
import {jmaRegions} from './jma-regions.mjs';
import {outdoorPrefectures,readOutdoorSettings,validateOutdoorSettings} from './outdoor-settings-model.mjs';
import {defaultPlanner} from './outdoor-planner-model.mjs';
export function createOutdoorSettingsPanel(){
 const panel=document.createElement('section');panel.id='settingsOutdoorPanel';panel.hidden=true;
 panel.innerHTML=`<form id="outdoorSettingsForm" class="outdoorSettingsForm">
 <p class="sub">カレンダーに表示する岩場と、行ける条件を設定します。</p>
 <label for="outdoorProfile">登録した岩場<select id="outdoorProfile"><option value="">現在の岩場</option></select></label>
 <button type="button" id="outdoorNewSite">別の岩場を追加</button>
 <label for="outdoorCragName">岩場名<input id="outdoorCragName" type="text" maxlength="100" placeholder="岩場の名称" autocomplete="off"></label>
 <label for="outdoorPrefecture">都道府県<select id="outdoorPrefecture"><option value="">選択してください</option></select></label>
 <label for="outdoorForecastArea">予報地域<select id="outdoorForecastArea"><option value="">選択してください</option></select></label>
 <p class="sub">岩場が含まれる地域を選択。位置が不明なら予報地域を空欄にして保存できます。岩場名から推測しません。</p>
 <label for="outdoorRainStation">雨の観測地点<select id="outdoorRainStation"><option value="">選択してください</option></select></label>
 <p class="sub">岩場に近い地点を選択。標高・地形の違いがあるため、観測値は岩場そのものの状態ではありません。</p>
 <label for="outdoorPreviousRainLimit">前日の雨量の条件<select id="outdoorPreviousRainLimit"><option value="0">0mm（観測値）</option><option value="1">1mm以下</option><option value="3">3mm以下</option><option value="5">5mm以下</option></select></label>
 <fieldset><legend>行ける曜日</legend><div class="outdoorWeekdays"></div></fieldset>
 <label for="outdoorStartTime">活動開始<input id="outdoorStartTime" type="time" required value="09:00"></label>
 <label for="outdoorEndTime">活動終了<input id="outdoorEndTime" type="time" required value="16:00"></label>
 <p class="sub">日本時間・当日中の時間帯。日没時刻と移動経路は未連携です。ナイトも登れる時間帯を指定してください。</p>
 <details id="outdoorPlanningDetails"><summary>複数の岩場・比較の条件</summary>
 <label><input id="outdoorPlannerEnabled" type="checkbox"> 詳しい候補日判定を使う</label>
 <p class="sub">直近3日を中心に7日先まで参考表示。前日の雨が目安を超えても「条件付き」で残します。AI比較は手動・1日1回までです。</p>
 <label for="outdoorPeriod">この岩場へ行く機会<select id="outdoorPeriod"><option value="weekend">土日祝・日中</option><option value="night">平日ナイト</option><option value="both">どちらも</option></select></label>
 <label for="outdoorSiteNotes">岩場の特徴<input id="outdoorSiteNotes" maxlength="300" placeholder="例：日陰が多い。分からなければ空欄"></label>
 <label><input id="outdoorSiteBlocked" type="checkbox"> 閉鎖・増水などで、この岩場を見送る</label>
 <p class="sub">警報・雷・凍結・増水・アクセス規制は自動取得していません。出発前に現地と公式情報を確認してください。</p>
 <label for="outdoorOrigin">出発の基準地点<input id="outdoorOrigin" maxlength="100" placeholder="市町村・主要駅。AIには送りません"></label>
 <label for="outdoorWeekendTravel">土日祝の片道上限（分）<input id="outdoorWeekendTravel" type="number" min="1" max="600" value="180"></label>
 <label for="outdoorWeekdayTravel">平日の片道上限（分）<input id="outdoorWeekdayTravel" type="number" min="1" max="600" value="60"></label>
 <p class="sub">移動上限は計画メモです。経路・所要時間の自動計算は未連携で、範囲内であると保証しません。土日祝の岩場は内閣府の2026・2027年の祝日・休日も対象にします。以降の年は祝日情報の更新が必要です。</p>
 <label for="outdoorDryHours">乾燥時間の共通目安（時間）<input id="outdoorDryHours" type="number" min="1" max="168" value="24"></label>
 <label for="outdoorStyle">比較の目的<select id="outdoorStyle"><option value="comfort">快適に登る</option><option value="performance">課題の完登を狙う</option></select></label>
 <p class="sub">乾燥時間・湿度・風・日照・露点が取得できない場合は不明と表示します。数値や現地状況をAIが補完することはありません。</p>
 </details>
 <button class="primary" type="submit">設定を保存</button><p id="outdoorSettingsStatus" role="status"></p>
 <p class="sub outdoorSettingsNotice">気象庁の地域予報をClimbLogで条件判定します。岩の乾き・登攀の安全を保証しません。旧設定は従来の判定を維持します。</p></form>`;
 const $=id=>panel.querySelector('#'+id),form=$('outdoorSettingsForm'),status=$('outdoorSettingsStatus');
 for(const name of outdoorPrefectures)$('outdoorPrefecture').add(new Option(name,name));
 function fillRegions(code=''){const el=$('outdoorForecastArea');el.replaceChildren(new Option('未確認・選択してください',''));for(const region of jmaRegions.filter(row=>row.prefecture===$('outdoorPrefecture').value))el.add(new Option(region.name,region.code));el.value=code;const station=$('outdoorRainStation');station.replaceChildren(new Option('未確認・選択してください',''));for(const row of rainStations.filter(row=>row.prefecture===$('outdoorPrefecture').value))station.add(new Option(row.name,row.code));}
 $('outdoorPrefecture').addEventListener('change',()=>fillRegions());
 $('outdoorPeriod').addEventListener('change',()=>{const night=$('outdoorPeriod').value==='night';for(const el of form.querySelectorAll('[name=outdoorWeekday]'))el.checked=$('outdoorPeriod').value==='both'||(night?![0,6].includes(Number(el.value)):[0,6].includes(Number(el.value)));$('outdoorStartTime').value=night?'19:00':'09:00';$('outdoorEndTime').value=night?'21:00':'16:00';status.textContent='時間帯は仮の入力例です。実際に登れる時間へ変更してください。';});
 panel.querySelector('.outdoorWeekdays').innerHTML=['月','火','水','木','金','土','日'].map((name,i)=>`<label><input type="checkbox" name="outdoorWeekday" value="${(i+1)%7}"><span>${name}</span></label>`).join('');
 let profiles=[],editingId='',baseline='';
 function fillSite(value){$('outdoorCragName').value=value.cragName;$('outdoorPrefecture').value=value.prefecture;fillRegions(value.forecastAreaCode||'');$('outdoorRainStation').value=value.rainStationCode||'';$('outdoorPreviousRainLimit').value=String(value.maxPreviousRainMm??1);$('outdoorStartTime').value=value.startTime;$('outdoorEndTime').value=value.endTime;for(const el of form.querySelectorAll('[name=outdoorWeekday]'))el.checked=value.weekdays.includes(Number(el.value));$('outdoorPeriod').value=value.period||'weekend';$('outdoorSiteNotes').value=value.notes||'';$('outdoorSiteBlocked').checked=value.blocked===true;}
 function site(){return validateOutdoorSettings({cragName:$('outdoorCragName').value,prefecture:$('outdoorPrefecture').value,forecastAreaCode:$('outdoorForecastArea').value,rainStationCode:$('outdoorRainStation').value,maxPreviousRainMm:Number($('outdoorPreviousRainLimit').value),weekdays:[...form.querySelectorAll('[name=outdoorWeekday]:checked')].map(el=>Number(el.value)),startTime:$('outdoorStartTime').value,endTime:$('outdoorEndTime').value},{allowUnlocated:$('outdoorPlannerEnabled').checked});}
 function remember(){const value=site();if(!value.cragName)return;const item={...value,id:editingId||'site-'+crypto.randomUUID(),period:$('outdoorPeriod').value,notes:$('outdoorSiteNotes').value,blocked:$('outdoorSiteBlocked').checked};const index=profiles.findIndex(p=>p.id===item.id);if(index<0){if(profiles.length>=10)throw new Error('岩場は10か所までです。');profiles.push(item);}else profiles[index]=item;editingId=item.id;}
 function fillProfiles(){const select=$('outdoorProfile');select.replaceChildren(new Option('現在の岩場',''));for(const p of profiles)select.add(new Option(p.cragName,p.id));select.value=editingId;}
 const snapshot=()=>JSON.stringify({fields:[...form.querySelectorAll('input,select')].map(el=>[el.id||el.name,el.value,el.type==='checkbox'?el.checked:null]),profiles});
 function load(){const value=readOutdoorSettings(window.climbLogStateApi.get().preferences),planner=value.planner||defaultPlanner();profiles=structuredClone(planner.profiles);editingId=profiles.find(p=>p.cragName===value.cragName&&p.forecastAreaCode===value.forecastAreaCode)?.id||'';fillSite(profiles.find(p=>p.id===editingId)||value);fillProfiles();$('outdoorPlannerEnabled').checked=Boolean(value.planner);$('outdoorOrigin').value=planner.origin;$('outdoorWeekendTravel').value=planner.weekendTravelMinutes;$('outdoorWeekdayTravel').value=planner.weekdayTravelMinutes;$('outdoorDryHours').value=planner.dryHours;$('outdoorStyle').value=planner.style;status.textContent='';baseline=snapshot();}
 $('outdoorPlannerEnabled').addEventListener('change',()=>{if($('outdoorPlannerEnabled').checked)$('outdoorPreviousRainLimit').value='3';});
 $('outdoorNewSite').onclick=()=>{try{remember();$('outdoorPlannerEnabled').checked=true;editingId='';fillProfiles();fillSite({cragName:'',prefecture:'',weekdays:[0,6],startTime:'09:00',endTime:'16:00',maxPreviousRainMm:3});$('outdoorCragName').focus();status.textContent='新しい岩場を入力して、最後に設定を保存してください。';}catch(e){status.textContent=e.message;}};
 $('outdoorProfile').onchange=()=>{const id=$('outdoorProfile').value;try{remember();const target=profiles.find(p=>p.id===id);if(target){editingId=id;fillSite(target);}fillProfiles();}catch(e){status.textContent=e.message;fillProfiles();}};
 form.addEventListener('input',()=>{status.textContent='';});
 form.addEventListener('submit',event=>{event.preventDefault();try{let outdoorPlanning=site();if($('outdoorPlannerEnabled').checked){remember();outdoorPlanning=validateOutdoorSettings({...outdoorPlanning,planner:{...defaultPlanner(),origin:$('outdoorOrigin').value,weekendTravelMinutes:Number($('outdoorWeekendTravel').value),weekdayTravelMinutes:Number($('outdoorWeekdayTravel').value),dryHours:Number($('outdoorDryHours').value),style:$('outdoorStyle').value,profiles}});}else if(outdoorPlanning.cragName&&!outdoorPlanning.forecastAreaCode)throw new Error('予報地域を選択してください。');const preferences=window.climbLogStateApi.get().preferences||{};window.climbLogStateApi.apply({preferences:{...preferences,outdoorPlanning}});load();status.textContent='設定を保存しました。';}catch(error){status.textContent=error.message;}});
 return {panel,load,isDirty:()=>snapshot()!==baseline};
}
