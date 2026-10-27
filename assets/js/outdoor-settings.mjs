import {outdoorPrefectures,readOutdoorSettings,validateOutdoorSettings} from './outdoor-settings-model.mjs';
export function createOutdoorSettingsPanel(){
 const panel=document.createElement('section');panel.id='settingsOutdoorPanel';panel.hidden=true;
 panel.innerHTML=`<form id="outdoorSettingsForm" class="outdoorSettingsForm"><p class="sub">外岩へ行ける条件を登録します。対象の岩場は1か所です。</p><label for="outdoorCragName">岩場名<input id="outdoorCragName" type="text" maxlength="100" placeholder="例：御岳" autocomplete="off"></label><label for="outdoorPrefecture">都道府県<select id="outdoorPrefecture"><option value="">選択してください</option></select></label><p class="sub">予報地域を選ぶための情報です。岩場名だけで地域を自動判定しません。</p><fieldset><legend>行ける曜日</legend><div class="outdoorWeekdays"></div></fieldset><label for="outdoorStartTime">活動開始<input id="outdoorStartTime" type="time" required value="09:00"></label><label for="outdoorEndTime">活動終了<input id="outdoorEndTime" type="time" required value="16:00"></label><p class="sub">日本時間・当日中の時間帯を指定してください。</p><button class="primary" type="submit">設定を保存</button><p id="outdoorSettingsStatus" role="status"></p><p class="sub outdoorSettingsNotice">現在は設定の保存のみ対応しています。気象庁の予報取得とカレンダーへの候補日表示は、まだ行いません。</p></form>`;
 const $=id=>panel.querySelector('#'+id),form=$('outdoorSettingsForm'),status=$('outdoorSettingsStatus');
 for(const name of outdoorPrefectures)$('outdoorPrefecture').add(new Option(name,name));
 const days=['月','火','水','木','金','土','日'];
 panel.querySelector('.outdoorWeekdays').innerHTML=days.map((name,i)=>`<label><input type="checkbox" name="outdoorWeekday" value="${(i+1)%7}"><span>${name}</span></label>`).join('');
 const snapshot=()=>JSON.stringify([...form.querySelectorAll('input,select')].map(el=>[el.id||el.name,el.value,el.type==='checkbox'?el.checked:null]));
 let baseline='';
 function load(){const value=readOutdoorSettings(window.climbLogStateApi.get().preferences);$('outdoorCragName').value=value.cragName;$('outdoorPrefecture').value=value.prefecture;$('outdoorStartTime').value=value.startTime;$('outdoorEndTime').value=value.endTime;for(const el of form.querySelectorAll('[name=outdoorWeekday]'))el.checked=value.weekdays.includes(Number(el.value));status.textContent='';baseline=snapshot();}
 form.addEventListener('input',()=>{status.textContent='';});
 form.addEventListener('submit',event=>{event.preventDefault();try{const outdoorPlanning=validateOutdoorSettings({cragName:$('outdoorCragName').value,prefecture:$('outdoorPrefecture').value,weekdays:[...form.querySelectorAll('[name=outdoorWeekday]:checked')].map(el=>Number(el.value)),startTime:$('outdoorStartTime').value,endTime:$('outdoorEndTime').value});const preferences=window.climbLogStateApi.get().preferences||{};window.climbLogStateApi.apply({preferences:{...preferences,outdoorPlanning}});load();status.textContent='設定を保存しました。';}catch(error){status.textContent=error.message;}});
 return {panel,load,isDirty:()=>snapshot()!==baseline};
}
