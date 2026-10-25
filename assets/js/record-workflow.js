import { InputDraftStore } from './input-draft-store.mjs';
import { findPreviousRecords, copyRecordForDate } from './workflow-features.mjs';

export function installRecordWorkflow({recordApi,states,panels,setControl,snapshotForm,restoreForm,fillDraft,clearForm,syncGrade,updateOutcome,renderDrafts,updateTrainingWeightInfo}){
  const $=selector=>document.querySelector(selector),modal=$('#modal');
  const store=new InputDraftStore(localStorage,window.climbLogAccountId||'local-test');
  const style=document.createElement('style');style.textContent=`
  .recordTools{margin:10px 0 14px;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--panel2)}.recordToolsTop{display:flex;flex-wrap:wrap;gap:7px;align-items:center}.recordToolsTop small{margin-right:auto;color:var(--muted)}.recordTools button,.draftResume button{min-height:40px;padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--text)}.recordTools button:disabled{opacity:.5;cursor:default}.recordTools p{font-size:12px;color:var(--muted);margin:7px 0 0}.draftResume{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px;border:1px solid var(--orange);border-radius:10px;margin-bottom:14px;background:var(--panel)}.draftResume label{flex:1;min-width:180px;font-size:12px;color:var(--muted)}.draftResume select{display:block;width:100%;padding:9px;border:1px solid var(--line);background:var(--panel2);color:var(--text);border-radius:7px;margin-top:4px}.dayRecordGroup{border:1px solid var(--line);border-radius:10px;margin:10px 0;background:var(--panel)}.dayRecordGroup>summary{padding:12px;cursor:pointer;color:var(--text)}.dayRecordGroup>summary strong{font-size:14px}.dayRecordGroup>summary span{display:block;color:var(--muted);font-size:12px;margin-top:4px}.dayGroupRecords{padding:0 10px}.dayGroupRecords .session:last-child{padding-bottom:12px}.strengthSeries{border:1px solid var(--line);border-radius:10px;margin:10px 0;padding:10px}.strengthSeries>summary{display:flex;gap:8px;justify-content:space-between;cursor:pointer;color:var(--text);font-size:13px}.strengthSeries>summary>span:last-child{text-align:right;flex:none}.strengthSeries small,.strengthEntry small{display:block;color:var(--muted);font-size:11px;margin-top:4px}.strengthEntry{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 0;border-top:1px solid var(--line);font-size:12px}.strengthEntry>span:last-child{text-align:right}.handPair{padding:10px 0;border-top:1px solid var(--line);font-size:12px}.handPair>small{display:block;color:var(--muted);margin:4px 0}.handPairValues{display:flex;gap:6px;flex-wrap:wrap}.handPairValues span{padding:6px 9px;background:var(--panel2);border-radius:6px}.handComparison h4{margin:18px 0 6px}.dayGroupRecords .logrow{flex-wrap:wrap}
  @media(max-width:640px){.recordTools button,.draftResume button{min-height:44px}.draftResume label{flex-basis:100%}.draftResume button{flex:1}.recordToolsTop small{flex-basis:100%}.recordToolsTop button{flex:1}.strengthSeries{padding:9px}.strengthSeries>summary{font-size:12px}.strengthSeries>summary>span:first-child{min-width:0}.strengthSeries>summary strong{overflow-wrap:anywhere}.dayRecordGroup>summary{min-height:48px}}
  `;document.head.append(style);
  const banner=document.createElement('section');banner.className='draftResume';banner.id='draftResumeBanner';banner.hidden=true;
  banner.innerHTML='<label>この端末に保存した入力途中の記録<select id="draftResumeSelect" aria-label="再開する下書き"></select></label><button type="button" id="resumeInputDraft">再開</button><button type="button" id="removeInputDraft">破棄</button>';
  $('#mainNavigation').insertAdjacentElement('afterend',banner);
  const tools=document.createElement('section');tools.className='recordTools';tools.innerHTML='<div class="recordToolsTop"><small id="recordInputDate"></small><button type="button" id="copyPreviousRecord">前回の記録をコピー</button><button type="button" id="discardCurrentInput">下書きを破棄</button></div><p id="inputDraftStatus" role="status">入力途中の内容は、この端末に自動保存されます。</p>';
  $('#modalTitle').insertAdjacentElement('afterend',tools);
  const formIds=['kind',...modal.querySelectorAll('.formPanel input[id],.formPanel select[id],.formPanel textarea[id]')].map(item=>typeof item==='string'?item:item.id).filter(id=>id!=='maxBodyweight');
  const allowed=new Set(formIds);
  let target=null,baseline='',suppress=false;
  const readForm=()=>Object.fromEntries(formIds.map(id=>[id,$('#'+id).value]));
  const fingerprint=form=>JSON.stringify(form);
  function renderBanner(){
    const rows=store.list(),select=$('#draftResumeSelect'),keep=select.value;banner.hidden=!rows.length;
    select.replaceChildren(...rows.map(row=>{const form=row.form,name=form.kind==='gym'?form.gymName:form.kind==='outdoor'?(form.routeName||form.cragName):form.trainingMode==='maxTest'?({hangboard:'ハングボード',singleHandLift:'片手リフト',weightedPullup:'加重懸垂'}[form.maxType]||'測定'):form.exerciseName;return new Option(`${row.date} · ${{gym:'ジム',outdoor:'外岩',training:'トレーニング'}[form.kind]||'活動'}${name?' · '+name:''}${row.recordId?'（編集途中）':''}`,row.key);}));
    if(rows.some(row=>row.key===keep))select.value=keep;
  }
  function serialize(){return {...target,form:readForm(),states:Object.fromEntries(Object.entries(states).map(([kind,state])=>[kind,{entries:state.drafts.list(),editingId:state.editingId,resume:state.resume}]))};}
  function persist(){
    if(suppress||!target||!modal.classList.contains('open'))return;
    try{
      const draft=serialize(),hasRows=Object.values(states).some(state=>state.drafts.size);
      if(!hasRows&&fingerprint(draft.form)===baseline)store.remove(target.key);else store.save(draft);
      $('#inputDraftStatus').textContent='入力途中の内容をこの端末に保存しました。';renderBanner();
    }catch{$('#inputDraftStatus').textContent='下書きを保存できませんでした。端末の空き容量を確認してください。';}
  }
  function restoreRaw(form){
    const values=Object.fromEntries(Object.entries(form).filter(([id])=>allowed.has(id)));
    for(const id of ['kind','trainingMode','gymName','outdoorDiscipline','gradeSystem'])if(id in values){setControl(id,values[id]);$('#'+id).dispatchEvent(new Event('change',{bubbles:true}));}
    for(const [id,value] of Object.entries(values))if(!['kind','trainingMode','gymName','outdoorDiscipline','gradeSystem'].includes(id))setControl(id,value);
    syncGrade();updateOutcome();updateTrainingWeightInfo();window.dispatchEvent(new Event("climblog:formRestored"));
  }
  function restore(draft){
    suppress=true;
    try{
      restoreRaw(draft.form);
      for(const kind of ['gym','training']){
        const saved=draft.states?.[kind],state=states[kind];state.drafts.restore(saved?.entries||[]);state.editingId=state.drafts.get(saved?.editingId)?.id||null;state.resume=saved?.resume||null;renderDrafts(kind);
      }
      panels.training.hidden=recordApi.isEditing()||$('#trainingMode').value!=='routine';
      $('#inputDraftStatus').textContent='保存していた下書きを復元しました。';
    }finally{suppress=false;}
  }
  function previous(){return findPreviousRecords(recordApi.getRecords(),{kind:$('#kind').value,date:window.climbLogGetSelectedDate(),gymName:$('#gymName').value,trainingMode:$('#trainingMode').value,maxType:$('#maxType').value,liftHand:$('#liftHand').value});}
  function updateCopy(){const kind=$('#kind').value,button=$('#copyPreviousRecord'),available=previous().length>0;button.hidden=kind==='outdoor'||recordApi.isEditing();button.disabled=!available;button.textContent=available?'前回の記録をコピー':'前回の記録なし';$('#discardCurrentInput').disabled=!target;}
  window.addEventListener('climblog:recordOpened',()=>{
    suppress=true;const existing=recordApi.getEditingRecord(),date=window.climbLogGetSelectedDate();target={key:existing?'edit:'+existing.id:'new:'+date,date,recordId:existing?.id||null};
    $('#recordInputDate').textContent=`${date} の記録`;
    $('#cancel').textContent='閉じる';$('#cancel').setAttribute('aria-label','下書きを保存して閉じる');
    baseline=fingerprint(readForm());suppress=false;
    const saved=store.get(target.key);if(saved)restore(saved);else $('#inputDraftStatus').textContent='入力途中の内容は、この端末に自動保存されます。';
    updateCopy();renderBanner();
  });
  window.addEventListener('climblog:formUpdated',()=>{document.querySelector('#setDetailsJson')?.dispatchEvent(new Event('input',{bubbles:true}));});
window.addEventListener('climblog:recordSaved',event=>{try{store.remove(event.detail.draftKey);renderBanner();}catch{}target=null;});
  modal.addEventListener('input',event=>{if(allowed.has(event.target.id))persist();});
  modal.addEventListener('change',event=>{if(allowed.has(event.target.id)){updateCopy();persist();}});
  modal.addEventListener('click',event=>{if(event.target.closest('.batchEntry,#gymGradeMenu'))queueMicrotask(persist);});
  $('#cancel').addEventListener('click',persist,{capture:true});
  window.addEventListener('pagehide',persist);window.addEventListener('climblog:authLock',persist);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)persist();});
  $('#resumeInputDraft').addEventListener('click',()=>{const saved=store.get($('#draftResumeSelect').value);if(saved&&!recordApi.open(saved.form.kind,saved.recordId,saved.date))alert('編集対象の記録は削除されています。下書きを確認して破棄してください。');});
  $('#removeInputDraft').addEventListener('click',()=>{const key=$('#draftResumeSelect').value;if(key&&confirm('この端末の下書きを破棄しますか？保存済みの記録は削除されません。')){store.remove(key);renderBanner();}});
  $('#discardCurrentInput').addEventListener('click',()=>{if(target&&confirm('入力中の下書きを破棄しますか？保存済みの記録は削除されません。')){const current={...target};store.remove(current.key);recordApi.open($('#kind').value,current.recordId,current.date);renderBanner();}});
  $('#copyPreviousRecord').addEventListener('click',()=>{
    const kind=$('#kind').value,rows=previous(),state=states[kind];if(!rows.length)return;
    if(state?.editingId){alert('編集中の項目を更新するか、編集を取り消してください。');return;}
    const history=JSON.parse(localStorage.getItem('climbLogBodyWeights')||'[]'),date=window.climbLogGetSelectedDate();
    if(kind==='training'&&$('#trainingMode').value==='maxTest'){
      const value=copyRecordForDate(rows[0],date,history);
      for(const [id,data] of Object.entries({maxType:value.maxType,gripType:value.gripType||'open',edgeDepthMm:value.edgeDepthMm||'',holdSeconds:value.holdSeconds||'',maxAddedWeight:value.addedWeightKg||0,liftHand:value.liftHand||'right',trainingMemo:value.memo||''}))setControl(id,data);
      $('#maxType').dispatchEvent(new Event('change',{bubbles:true}));updateTrainingWeightInfo();
    }else{
      const meaningful=kind==='gym'?Number($('#gymSends').value)>0||Number($('#gymTries').value)>0||Boolean($('#gymMemo').value.trim()):['trainingSets','trainingReps','trainingDuration','trainingLoad','trainingRpe'].some(id=>Number($('#'+id).value)>0)||Boolean($('#trainingMemo').value.trim());
      if(meaningful){const current=recordApi.collect();if(!current)return;state.drafts.add(current);}
      for(const row of rows)state.drafts.add(copyRecordForDate(row,date,history));
      clearForm(kind);renderDrafts(kind);
    }
    persist();$('#inputDraftStatus').textContent=`${rows[0].date} の記録 ${rows.length}件をコピーしました。保存前に編集できます。`;
  });
  renderBanner();
}
