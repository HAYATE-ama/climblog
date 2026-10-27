import {installOutdoorWeather} from './outdoor-weather.mjs';
import {installSettingsDrawer} from './settings-drawer.mjs';
import {installRecordViewer} from './record-viewer.mjs';
import {installWorkoutScreen} from './workout-screen.mjs';
import {installCoachScreen} from './coach-screen.mjs';
import {installTrainingStudio} from './training-studio.js';
import {installLifeTools} from './life-tools.js';
import {installPixelCompanion} from './pixel-companion.mjs';
import {installPwa} from './pwa.js';
import { prepareBodySettings } from './body-settings.mjs';
import { installRecordWorkflow } from './record-workflow.js';
import { getBodyWeightForDate } from './features.mjs';
import { RecordDrafts } from './record-drafts.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const read = (key, fallback = []) => {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const recordApi = window.climbLogRecordApi;
const localDate = () => { const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const style=document.createElement('style');
style.textContent=`
.bodyProfileForm{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:end;margin:16px 0}.bodyProfileForm label{display:block;color:var(--muted);font-size:13px}.bodyProfileForm input{width:100%;min-height:44px;margin-top:6px;padding:10px 12px;border:1px solid var(--line);border-radius:9px;background:var(--panel2);color:var(--text);font:inherit}.bodyProfileForm small{display:block;font-size:11px;margin-top:4px}.bodyProfileForm button{grid-column:1/-1;justify-self:start}.bodyWeightSection{border-top:1px solid var(--line);margin-top:24px;padding-top:12px}
.bodyProfileForm{align-items:start}.bodyWeightChart{display:block;width:100%;height:230px;border-radius:10px;background:var(--panel2)}.bodyWeightRows{display:grid;gap:5px;max-height:200px;overflow:auto;margin-top:10px}.bodyWeightRow{display:flex;justify-content:space-between;padding:8px 10px;border-bottom:1px solid var(--line);color:var(--muted)}
.batchEntry{margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--panel2)}.batchEntry ul{display:grid;gap:8px;margin:0 0 12px;padding:0;list-style:none}.batchEntry li{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;padding:9px;border:1px solid var(--line);border-radius:8px;color:var(--text);font-size:12px}.batchEntry li.isEditing{border-color:var(--orange)}.batchEntry li>span{flex:1;min-width:100px;overflow-wrap:anywhere}.batchRowActions,.batchButtons{display:flex;gap:6px;flex-wrap:wrap}.batchEntry button{min-height:40px;padding:7px 11px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--text)}.batchEntry [data-batch-add]{border-color:var(--orange);color:#ff973f}.batchEntry [data-edit]{font-weight:700}
.bodyWeightHelp{color:var(--muted);font-size:12px;margin:8px 0 4px}.batchEntry ul{margin-top:12px;max-height:300px;overflow-y:auto}.settingControl+.settingControl{margin-top:14px}.gymOutcome{margin:10px 0}#mainNavigation{grid-template-columns:repeat(3,minmax(0,1fr))}
body[data-theme="light"] .batchEntry{background:#f3f5f7;border-color:#dce1e7}body[data-theme="light"] .batchEntry button{background:#fff;border-color:#d9dee5;color:#303945}body[data-theme="light"] .batchEntry [data-batch-add]{border-color:#b94f00;color:#a94700}
@media(max-width:640px){.bodyProfileForm{gap:10px}.bodyProfileForm input{font-size:16px}.bodyProfileForm button{width:100%;min-height:44px}.bodyWeightChart{height:200px}.bodyWeightChart text{font-size:22px}.batchEntry button{min-height:44px}.batchRowActions{width:100%}.batchRowActions button{flex:1}}
`;
document.head.append(style);

// Keep four settings categories, with measurements on a separate detail page.
const settingsGrid=$('#settingsHome .settingsHomeGrid'),groups=settingsGrid.querySelectorAll('.settingGroup');
$('h3',groups[0]).textContent='表示・カレンダー';
groups[0].append($('.settingControl',groups[1]));groups[1].remove();
const bodyGroup=document.createElement('section');bodyGroup.className='card settingGroup settingLinkGroup';groups[2].classList.add('settingLinkGroup');
bodyGroup.innerHTML='<h3>身体情報</h3><p>身長・リーチと、日付ごとの体重を管理します。</p><button type="button" class="secondary" id="openBodyWeight">身体情報 <span aria-hidden="true">›</span></button>';
settingsGrid.insertBefore(bodyGroup,groups[2]);
const bodyView=document.createElement('section');bodyView.id='bodyWeightSettings';bodyView.hidden=true;
bodyView.innerHTML=`
<button type="button" class="secondary settingsBack" id="bodyWeightBack">← 設定に戻る</button><div class="heading"><div><h2>身体情報</h2><div class="sub">身長・リーチと、必要に応じて体重をまとめて保存できます。</div></div></div>
<section class="card"><form class="bodyProfileForm" id="bodyProfileForm"><h3>身長・リーチ</h3><label>身長（cm）<input id="bodyHeightCm" type="number" min="1" max="300" step="0.1" inputmode="decimal" placeholder="例：170"></label><label>リーチ（cm）<input id="bodyReachCm" type="number" min="1" max="400" step="0.1" inputmode="decimal" placeholder="例：175"><small>両腕を広げた左手指先から右手指先までの長さ</small></label>
<div class="bodyWeightSection"><h3>体重</h3><p class="sub">体重を更新するときだけ入力してください。未入力なら、保存済みの履歴をそのまま使います。</p><div class="bodyWeightFields"><label>体重を記録する日付<input type="date" id="bodyWeightDate"></label><label>体重（kg・任意）<input type="number" id="bodyWeightKg" min="1" max="500" step="0.1" inputmode="decimal" placeholder="例：62.5"></label></div></div><button type="submit" class="primary" id="saveBodySettings">身体情報を保存</button></form><p id="bodyProfileMessage" class="sub" aria-live="polite"></p><h3>体重の推移</h3><svg class="bodyWeightChart" id="bodyWeightChart" viewBox="0 0 720 230" role="img" aria-label="体重の推移"></svg><div class="bodyWeightRows" id="bodyWeightRows"></div></section>`;
$('#settingsView').append(bodyView);
$('#openBodyWeight').addEventListener('click',()=>{ $('#settingsHome').hidden=true;$('#gymSettingsView').hidden=true;bodyView.hidden=false;const p=read('climbLogBodyProfile',{});$('#bodyHeightCm').value=p.heightCm??'';$('#bodyReachCm').value=p.reachCm??'';$('#bodyWeightDate').value=localDate();$('#bodyWeightKg').value='';$('#bodyProfileMessage').textContent='';renderBodyWeights(); });
$('#bodyWeightBack').addEventListener('click',()=>{bodyView.hidden=true;$('#settingsHome').hidden=false;});
$('#settingsTab').addEventListener('click',()=>{bodyView.hidden=true;});
$('#bodyWeightDate').value=localDate();
$('#bodyProfileForm').addEventListener('input',()=>{$('#bodyProfileMessage').textContent='';});
$('#bodyProfileForm').addEventListener('submit',event=>{event.preventDefault();try{const next=prepareBodySettings({heightCm:$('#bodyHeightCm').value,reachCm:$('#bodyReachCm').value,date:$('#bodyWeightDate').value,kg:$('#bodyWeightKg').value},read('climbLogBodyProfile',{}),read('climbLogBodyWeights'));write('climbLogBodyProfile',next.profile);if(next.weightChanged)write('climbLogBodyWeights',next.history);$('#bodyWeightKg').value='';$('#bodyProfileMessage').textContent=next.weightChanged?'身体情報と体重を保存しました。':'身体情報を保存しました。';renderBodyWeights();}catch(error){$('#bodyProfileMessage').textContent=error.message||'保存できませんでした。';}});
function renderBodyWeights(){
  const rows=read('climbLogBodyWeights').filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&Number.isFinite(Number(row.kg))&&Number(row.kg)>0).sort((a,b)=>a.date.localeCompare(b.date));
  $('#bodyWeightRows').replaceChildren(...[...rows].reverse().map(row=>{const item=document.createElement('div'),date=document.createElement('span'),value=document.createElement('strong');item.className='bodyWeightRow';date.textContent=row.date;value.textContent=`${row.kg} kg`;item.append(date,value);return item;}));
  const svg=$('#bodyWeightChart');if(!rows.length){svg.innerHTML='<text x="360" y="120" text-anchor="middle" fill="currentColor" font-size="14">体重を登録すると推移を表示します</text>';return;}
  const values=rows.map(row=>Number(row.kg)),min=Math.min(...values),max=Math.max(...values),range=Math.max(1,max-min),start=Date.parse(rows[0].date),end=Date.parse(rows.at(-1).date),x=row=>start===end?360:50+(Date.parse(row.date)-start)/(end-start)*620,y=kg=>185-(kg-min+range*.12)/(range*1.24)*145;
  svg.innerHTML=`<line x1="50" y1="190" x2="670" y2="190" stroke="#888"/><polyline points="${rows.map(row=>`${x(row)},${y(Number(row.kg))}`).join(' ')}" fill="none" stroke="#ff6f00" stroke-width="3"/>${rows.map(row=>`<circle cx="${x(row)}" cy="${y(Number(row.kg))}" r="4" fill="#ff8c26"><title>${row.date}: ${row.kg} kg</title></circle>`).join('')}<text x="50" y="215" fill="currentColor" font-size="11">${rows[0].date}</text><text x="670" y="215" text-anchor="end" fill="currentColor" font-size="11">${rows.at(-1).date}</text><text x="8" y="25" fill="currentColor" font-size="11">kg</text><text x="8" y="${y(max)}" fill="currentColor" font-size="11">${max}</text><text x="8" y="${y(min)}" fill="currentColor" font-size="11">${min}</text>`;
}

const gymFields=$('#gymFields'),sendsGroup=$('#gymSends').closest('div');
function updateOutcome(){sendsGroup.hidden=$('#gymOutcome').value==='failed';}
$('#gymOutcome').addEventListener('change',updateOutcome);
const weightInfo=document.createElement('p');weightInfo.id='bodyweightInfo';weightInfo.className='bodyWeightHelp';$('#trainingRoutineFields').insertAdjacentElement('afterend',weightInfo);
function updateTrainingWeightInfo(){const existing=recordApi.getEditingRecord(),date=window.climbLogGetSelectedDate(),kg=existing?.bodyweightKg??getBodyWeightForDate(read('climbLogBodyWeights'),date);$('#maxBodyweight').value=kg??'';$('#maxBodyweight').readOnly=true;weightInfo.textContent=kg?`${existing?'記録時':'当日'}の体重：${kg} kg`:'設定の身体情報に体重を登録すると、自動で記録に反映されます。';$('#maxBodyweight').dispatchEvent(new Event('input',{bubbles:true}));}

const states={gym:{drafts:new RecordDrafts(),editingId:null,resume:null},training:{drafts:new RecordDrafts(),editingId:null,resume:null}};
function batchPanel(parent,kind,label){const panel=document.createElement('section');panel.className='batchEntry';panel.id=`${kind}BatchEntries`;panel.innerHTML=`<h3>追加済みの${label}</h3><div class="batchButtons"><button type="button" data-batch-add>＋ ${label}を追加</button><button type="button" data-batch-cancel hidden>編集を取り消す</button></div><p class="bodyWeightHelp" data-batch-message>追加した項目は、保存前でも編集できます。</p><ul aria-live="polite"></ul>`;parent.append(panel);return panel;}
const panels={gym:batchPanel(gymFields,'gym','課題'),training:batchPanel($('#trainingFields'),'training','種目')};
const controlIds={gym:['gymName','gymGrade','gymSends','gymTries','gymMemo','gymOutcome'],training:['exerciseName','trainingPlace','trainingSets','trainingReps','trainingDuration','trainingLoad','trainingRpe','trainingMemo','routineLoadMethod','setEntryMode','setDetailsJson','rightLiftKg','leftLiftKg']};
function snapshotForm(kind){return Object.fromEntries(controlIds[kind].map(id=>[id,$('#'+id).value]));}
function setControl(id,value){const input=$('#'+id);if(input.tagName==='SELECT'&&value!==''&&![...input.options].some(option=>option.value===String(value)))input.add(new Option(String(value),String(value)));input.value=value??'';}
function syncGrade(){const select=$('#gymGrade'),option=select.selectedOptions[0];$('#gymGradeLabel').textContent=option?.textContent||'課題を選択';$('#gymGradeSwatch').style.background=option?.dataset.color||'transparent';for(const item of $('#gymGradeMenu').querySelectorAll('[data-grade]'))item.setAttribute('aria-selected',String(item.dataset.grade===select.value));}
function restoreForm(kind,values){if(kind==='gym'){setControl('gymName',values.gymName);$('#gymName').dispatchEvent(new Event('change',{bubbles:true}));}for(const [id,value] of Object.entries(values))setControl(id,value);if(kind==='gym'){syncGrade();updateOutcome();}window.dispatchEvent(new Event('climblog:formRestored'));}
function fillDraft(kind,values){
  if(kind==='gym'){restoreForm(kind,{gymName:values.gymName||values.place,gymGrade:values.gradeLabelSnapshot||values.grade,gymSends:String(values.sends||0),gymTries:String(values.tries||0),gymMemo:values.memo||'',gymOutcome:values.gymOutcome||'completed'});$('#gymGradeSwatch').style.background=values.colorSnapshot||values.swatch||'#ff6f00';}
  else restoreForm(kind,{exerciseName:values.exerciseName,trainingPlace:values.trainingPlace||values.place,trainingSets:String(values.sets||0),trainingReps:String(values.reps||0),trainingDuration:String(values.durationMinutes||0),trainingLoad:String(values.loadKg||0),trainingRpe:String(values.rpe||0),trainingMemo:values.memo||'',routineLoadMethod:values.loadMethod||'added'});window.dispatchEvent(new CustomEvent('climblog:draftLoaded',{detail:{kind,values}}));
}
function clearForm(kind){if(kind==='gym'){for(const [id,value] of Object.entries({gymGrade:'',gymSends:'0',gymTries:'0',gymMemo:'',gymOutcome:'completed'}))setControl(id,value);syncGrade();updateOutcome();}else{for(const id of ['trainingSets','trainingReps','trainingDuration','trainingLoad','trainingRpe'])setControl(id,'0');setControl('trainingMemo','');setControl('routineLoadMethod','added');}window.dispatchEvent(new CustomEvent('climblog:formCleared',{detail:kind}));}
function hasCurrent(kind){return kind==='gym'?Boolean($('#gymGrade').value):['trainingSets','trainingReps','trainingDuration','trainingLoad','trainingRpe'].some(id=>Number($('#'+id).value)>0)||Boolean($('#trainingMemo').value.trim());}
function renderDrafts(kind){
  const state=states[kind],panel=panels[kind];
  $('ul',panel).replaceChildren(...state.drafts.list().map((entry,index)=>{const item=document.createElement('li'),label=document.createElement('span'),actions=document.createElement('div');item.dataset.draftId=entry.id;item.classList.toggle('isEditing',state.editingId===entry.id);actions.className='batchRowActions';const row=entry.values;label.textContent=kind==='gym'?`${row.grade} · ${row.gymOutcome==='failed'?'敗退':`完登 ${row.sends}`} · ${row.tries}トライ`:`${row.exerciseName} · ${row.sets}セット · ${row.reps}回 · ${row.loadKg}kg · ${row.durationMinutes}分`;for(const [action,title] of [['edit','編集'],['remove','外す']]){const button=document.createElement('button');button.type='button';button.dataset[action]=entry.id;button.textContent=title;button.setAttribute('aria-label',`${index+1}件目を${title}`);actions.append(button);}item.append(label,actions);return item;}));
  $('[data-batch-add]',panel).textContent=state.editingId?'この項目を更新':`＋ ${kind==='gym'?'課題':'種目'}を追加`;
  $('[data-batch-cancel]',panel).hidden=!state.editingId;
  $('[data-batch-message]',panel).textContent=state.editingId?'入力欄で内容を変更し、「この項目を更新」を押してください。':`${state.drafts.size}件追加済み。同じ種目も何度でも追加できます。`;
}
function finishDraftEdit(kind){const state=states[kind],resume=state.resume;state.editingId=null;state.resume=null;if(resume)restoreForm(kind,resume);else clearForm(kind);renderDrafts(kind);}
function applyDraftEdit(kind){const values=recordApi.collect();if(!values)return false;states[kind].drafts.update(states[kind].editingId,values);finishDraftEdit(kind);return true;}
for(const kind of ['gym','training']){
  const panel=panels[kind],state=states[kind];
  $('[data-batch-add]',panel).addEventListener('click',()=>{if(state.editingId){applyDraftEdit(kind);return;}if(!hasCurrent(kind)){alert(kind==='gym'?'課題を選択してください。':'セット数・回数・重量・時間などを入力してください。');return;}const values=recordApi.collect();if(!values)return;state.drafts.add(values);clearForm(kind);renderDrafts(kind);});
  $('[data-batch-cancel]',panel).addEventListener('click',()=>finishDraftEdit(kind));
  panel.addEventListener('click',event=>{
    const edit=event.target.closest('[data-edit]'),remove=event.target.closest('[data-remove]');
    if(edit){if(state.editingId){alert('編集中の項目を更新するか、編集を取り消してください。');return;}const entry=state.drafts.get(edit.dataset.edit);if(!entry)return;state.resume=snapshotForm(kind);state.editingId=entry.id;fillDraft(kind,entry.values);renderDrafts(kind);$(kind==='gym'?'#gymGradeButton':'#exerciseName').focus();}
    if(remove){if(state.editingId===remove.dataset.remove)finishDraftEdit(kind);state.drafts.remove(remove.dataset.remove);renderDrafts(kind);}
  });
}
$('#save').onclick=()=>{
  const kind=$('#kind').value,isRoutine=kind==='training'&&$('#trainingMode').value==='routine';
  if(recordApi.isEditing()||kind==='outdoor'||kind==='training'&&!isRoutine){const values=recordApi.collect();if(values)recordApi.commit([values]);return;}
  const state=states[kind];if(state.editingId&&!applyDraftEdit(kind))return;
  const entries=state.drafts.list().map(entry=>entry.values);
  if(hasCurrent(kind)){const values=recordApi.collect();if(!values)return;entries.push(values);}
  if(!entries.length){alert('記録する項目を入力してください。');return;}
  const groupId=entries.length>1?crypto.randomUUID():null;
  if(recordApi.commit(entries.map(values=>groupId?{...values,batchSessionId:groupId}:values))){for(const name of ['gym','training']){states[name].drafts.clear();states[name].editingId=null;states[name].resume=null;renderDrafts(name);}}
};
let activeKind=$('#kind').value;
$('#kind').addEventListener('change',event=>{const next=event.target.value;if(states[activeKind]?.drafts.size&&next!==activeKind){alert('追加済みの項目を保存してから活動タイプを切り替えてください。');event.target.value=activeKind;event.target.dispatchEvent(new Event('change',{bubbles:true}));return;}activeKind=next;if(next==='training')updateTrainingWeightInfo();});
$('#trainingMode').addEventListener('change',event=>{if(event.target.value==='maxTest'&&states.training.drafts.size){alert('追加済みの種目を保存してから記録方法を切り替えてください。');event.target.value='routine';event.target.dispatchEvent(new Event('change',{bubbles:true}));}panels.training.hidden=recordApi.isEditing()||event.target.value!=='routine';});
window.addEventListener('climblog:recordOpened',()=>{const existing=recordApi.getEditingRecord();activeKind=$('#kind').value;for(const kind of ['gym','training']){states[kind].drafts.clear();states[kind].editingId=null;states[kind].resume=null;panels[kind].hidden=Boolean(existing)||kind==='training'&&$('#trainingMode').value!=='routine';renderDrafts(kind);}$('#gymOutcome').value=existing?.gymOutcome||'completed';updateOutcome();$('#routineLoadMethod').value=existing?.loadMethod||'added';if(activeKind==='training')updateTrainingWeightInfo();});

function decorateDetails(){const records=new Map(read('climbLogRecords').map(row=>[row.id,row]));for(const card of $('#detail').querySelectorAll('[data-record-id]')){if(card.classList.contains('compactRecord'))continue;const row=records.get(card.dataset.recordId);if(row?.kind==='gym'&&row.gymOutcome==='failed'&&!$('[data-failure-label]',card)){const badge=document.createElement('span');badge.className='badge';badge.dataset.failureLabel='true';badge.textContent='敗退';$('.sessionActions',card)?.prepend(badge);}if(row?.kind==='training'&&row.bodyweightKg&&!$('[data-bodyweight-label]',card)){const label=document.createElement('small');label.dataset.bodyweightLabel='true';label.textContent=`体重 ${row.bodyweightKg} kg`;$('.logrow',card)?.append(label);}}}
new MutationObserver(decorateDetails).observe($('#detail'),{childList:true,subtree:true});decorateDetails();

installTrainingStudio({recordApi,states,panels,setControl,fillDraft,renderDrafts});
installLifeTools();installPixelCompanion();installPwa();installCoachScreen();installWorkoutScreen();installRecordViewer();
installRecordWorkflow({recordApi,states,panels,setControl,snapshotForm,restoreForm,fillDraft,clearForm,syncGrade,updateOutcome,renderDrafts,updateTrainingWeightInfo});

installSettingsDrawer();installOutdoorWeather();
