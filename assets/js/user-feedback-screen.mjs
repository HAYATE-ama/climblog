import {accountKeys} from './account-storage.mjs';
import {escapeHtml as esc} from './data-utils.mjs';
import {feedbackCategories,feedbackScreens,validateFeedbackEntries,makeFeedbackDraft,parseFeedbackDraft,saveFeedback,changeFeedbackStatus,selectFeedback,feedbackReport,feedbackRevision} from './user-feedback-model.mjs';

export function installUserFeedback(){
 const api=window.climbLogStateApi,owner=window.climbLogAccountId,draftKey='climbLogFeedbackDraft:'+owner;
 const dialog=document.createElement('dialog');dialog.id='appFeedback';dialog.setAttribute('aria-labelledby','appFeedbackTitle');
 dialog.innerHTML=`<div class="feedbackHead"><h2 id="appFeedbackTitle">フィードバック</h2><button type="button" data-feedback="close" aria-label="閉じる">×</button></div>
 <div class="feedbackBody"><p class="feedbackIntro">使いにくさや改善案を、この端末にためておけます。</p>
 <nav class="feedbackTabs" aria-label="フィードバックの表示"><button type="button" data-feedback="input">入力する</button><button type="button" data-feedback="list">一覧 <span data-feedback-count></span></button></nav>
 <section data-pane="input"><p class="feedbackDraftNotice" data-draft-warning hidden></p><form id="userFeedbackForm">
 <label for="userFeedbackText">気づいたこと<textarea id="userFeedbackText" name="text" rows="5" maxlength="3000" required placeholder="例：サーキットで休憩を終えるボタンが見つからない。タイマーのすぐ下にあると助かる。" aria-describedby="feedbackTextHelp"></textarea></label>
 <p id="feedbackTextHelp" class="feedbackHelp">どこで何をしたか、どうなると使いやすいかを書いてください。3,000文字まで。</p>
 <div class="feedbackFields"><label for="userFeedbackCategory">種類<select id="userFeedbackCategory" name="category">${feedbackCategories.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label>
 <label for="userFeedbackScreen">対象の画面<select id="userFeedbackScreen" name="screen">${feedbackScreens.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label></div>
 <button class="primary feedbackWide" type="submit" id="saveUserFeedback">端末に保存</button><button type="button" data-feedback="discard" class="feedbackQuiet">下書きを破棄して新しく入力</button>
 </form></section>
 <section data-pane="list" hidden><div class="feedbackListHead"><label for="feedbackFilter">表示する内容<select id="feedbackFilter"><option value="open">未対応</option><option value="resolved">対応済み</option><option value="all">すべて</option></select></label><button type="button" data-feedback="report">まとめて相談する</button></div><p class="feedbackHelp" data-list-count></p><div data-feedback-rows></div><button type="button" data-feedback="more" class="feedbackWide" hidden>もっと見る</button></section>
 <section data-pane="report" hidden><h3>内容を確認して共有</h3><p class="feedbackHelp">この文章をコピーして、ClimbLogの開発を相談しているチャットへ貼り付けてください。貼り付けるまで外部には送信されません。</p><label for="feedbackReportText">改善用レポート<textarea id="feedbackReportText" readonly rows="10" spellcheck="false"></textarea></label><div class="feedbackActions"><button type="button" class="primary" data-feedback="copy">コピーする</button><button type="button" data-feedback="download">テキストを保存</button></div><button type="button" class="feedbackQuiet" data-feedback="list">一覧へ戻る</button></section>
 <p class="feedbackMessage" role="status" aria-live="polite"></p><p class="feedbackPrivacy">保存・コピーだけで自動送信はしません。記録や身体情報は自動添付しません。パスワード・APIキーなどは入力しないでください。</p></div>`;
 document.body.append(dialog);
 const $=s=>dialog.querySelector(s),form=$('#userFeedbackForm'),fields=form.elements,message=$('.feedbackMessage');
 let pane='input',draft=null,draftRaw=null,draftLoaded=false,draftInvalid=false,draftUnsaved=false,locked=false,limit=20,report=null,reportSource='',opener=null,scroll=0,bodyStyle=null;
 const read=()=>{const raw=localStorage.getItem(accountKeys.userFeedback);return validateFeedbackEntries(raw===null?[]:JSON.parse(raw));};
 const current=()=>{if(locked||window.climbLogAccountId!==owner||window.climbLogAuthReady===false)throw new Error('保存先を確認して開き直してください。');};
 const say=text=>{message.textContent=text;};
 const source=()=>feedbackRevision(read());
 function screen(){if(document.querySelector('dialog.gradeCircuit[open]'))return 'circuit';if(document.querySelector('#modal.open'))return 'record';if(document.querySelector('#settingsDrawer[open]'))return 'settings';return [['homeView','home'],['calendarView','calendar'],['workoutView','training'],['statsView','stats'],['coachView','consultation']].find(([id])=>document.getElementById(id)?.hidden===false)?.[1]||'other';}
 function counts(){try{const rows=read();$('[data-feedback-count]').textContent='('+rows.filter(row=>row.status==='open').length+')';}catch{$('[data-feedback-count]').textContent='';}}
 function show(next){pane=next;for(const el of dialog.querySelectorAll('[data-pane]'))el.hidden=el.dataset.pane!==next;for(const el of dialog.querySelectorAll('.feedbackTabs button'))el.setAttribute('aria-pressed',String(el.dataset.feedback===next));$('.feedbackBody').scrollTop=0;say('');counts();}
 function renderDraft(){for(const key of ['text','category','screen'])fields[key].value=draft[key];$('#saveUserFeedback').textContent=draft.base?'変更を保存':'端末に保存';$('#saveUserFeedback').disabled=draftInvalid;$('[data-draft-warning]').hidden=!draftInvalid;$('[data-draft-warning]').textContent='以前の下書きを読み込めませんでした。元のデータは残しています。新しく入力する場合は、下の「下書きを破棄」を選んでください。';}
 function loadDraft(){if(draftLoaded)return;draft=makeFeedbackDraft(screen());try{draftRaw=localStorage.getItem(draftKey);if(draftRaw)draft=parseFeedbackDraft(draftRaw);}catch{draftInvalid=true;}draftLoaded=true;renderDraft();}
 function persistDraft(){
  current();if(draftInvalid)throw new Error('以前の下書きは上書きしていません。「下書きを破棄」から入力し直してください。');
  if(localStorage.getItem(draftKey)!==draftRaw)throw new Error('別の画面で下書きが変わりました。入力を控えてから再読み込みしてください。');
  const raw=JSON.stringify(draft);localStorage.setItem(draftKey,raw);draftRaw=raw;draftUnsaved=false;
 }
 function captureDraft(){for(const key of ['text','category','screen'])draft[key]=fields[key].value;draftUnsaved=true;}
 form.addEventListener('input',()=>{captureDraft();try{persistDraft();say('入力途中の内容を、この端末に保存しました。');}catch(error){say('下書きを保存できませんでした。'+error.message+' 入力はこの画面に残しています。');}});
 function discard(){current();if((draftInvalid||draft?.text.trim())&&!confirm('入力途中のフィードバックを破棄しますか？保存済みのフィードバックは残ります。'))return false;if(localStorage.getItem(draftKey)!==draftRaw)throw new Error('別の画面で下書きが変わりました。再読み込みしてください。');localStorage.removeItem(draftKey);draftRaw=null;draftInvalid=false;draftUnsaved=false;draft=makeFeedbackDraft(screen());renderDraft();return true;}
 function list(){const rows=selectFeedback(read(),$('#feedbackFilter').value),shown=rows.slice(0,limit);$('[data-list-count]').textContent=rows.length?`${rows.length}件中 ${shown.length}件を表示。相談用レポートには対象の全${rows.length}件を含めます。`:'まだフィードバックはありません。気づいたときに「入力する」から残してください。';
  $('[data-feedback-rows]').innerHTML=shown.map(row=>`<article class="feedbackEntry"><div class="feedbackEntryMeta"><span>${esc(feedbackCategories.find(([id])=>id===row.category)[1])} · ${esc(feedbackScreens.find(([id])=>id===row.screen)[1])}</span><time datetime="${esc(row.createdAt)}">${esc(new Date(row.createdAt).toLocaleDateString('ja-JP'))}</time></div><p class="feedbackEntryText">${esc(row.text.length>180?row.text.slice(0,180)+'…':row.text)}</p><div class="feedbackEntryActions"><button type="button" data-edit-feedback="${esc(row.id)}">${row.text.length>180?'全文・編集':'編集'}</button><button type="button" data-status-feedback="${esc(row.id)}" data-next-status="${row.status==='open'?'resolved':'open'}">${row.status==='open'?'対応済みにする':'未対応に戻す'}</button></div>${row.status==='resolved'?'<small class="feedbackHelp">対応済み · '+esc(new Date(row.resolvedAt).toLocaleDateString('ja-JP'))+'</small>':''}</article>`).join('');$('[data-feedback="more"]').hidden=shown.length>=rows.length;$('[data-feedback="report"]').disabled=!rows.length;
 }
 function showList(){show('list');list();}
 function reportValid(){current();if(!report||reportSource!==source())throw new Error('フィードバックが変わりました。一覧からレポートを作り直してください。');}
 function showReport(){report=feedbackReport(read(),{filter:$('#feedbackFilter').value});reportSource=source();show('report');$('#feedbackReportText').value=report.text;for(const name of ['copy','download'])$(`[data-feedback="${name}"]`).disabled=false;$('#feedbackReportText').focus({preventScroll:true});say(report.payload.feedback.length+'件をまとめました。内容を確認して共有してください。');}
 function close(){if(draftUnsaved&&!confirm('下書きを端末に保存できていません。画面を閉じますか？入力はアプリを開いている間だけ保持します。'))return;dialog.close();}
 dialog.addEventListener('close',()=>{if(bodyStyle){Object.assign(document.body.style,bodyStyle);bodyStyle=null;window.scrollTo({top:scroll,left:0,behavior:'instant'});}if(!locked&&opener?.isConnected)opener.focus({preventScroll:true});});
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const all=[...dialog.querySelectorAll('button:not(:disabled),input,select,textarea')].filter(el=>el.getClientRects().length),first=all[0],last=all.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
 async function act(event){
  const button=event.target.closest('button');if(!button)return;
  try{current();const action=button.dataset.feedback;
   if(action==='close'){close();return;}
   if(action==='input'){show('input');loadDraft();renderDraft();return;}
   if(action==='list'){limit=20;showList();return;}
   if(action==='discard'){if(discard()){show('input');say('新しく入力できます。');}return;}
   if(action==='more'){limit+=20;list();return;}
   if(action==='report'){showReport();return;}
   if(action==='copy'){reportValid();const text=report.text;try{await navigator.clipboard.writeText(text);if(!locked&&dialog.open)say('コピーしました。開発を相談しているチャットに貼り付けてください。');}catch{if(!locked&&dialog.open){$('#feedbackReportText').focus();$('#feedbackReportText').select();say('自動コピーできませんでした。選択された文章を長押しなどでコピーするか、テキストを保存してください。');}}return;}
   if(action==='download'){reportValid();const url=URL.createObjectURL(new Blob([report.text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='climblog-feedback-'+new Date().toISOString().slice(0,10)+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('改善用レポートを保存しました。チャットへ添付できます。');return;}
   if(button.dataset.editFeedback){
    const row=read().find(item=>item.id===button.dataset.editFeedback);if(!row)throw new Error('フィードバックが見つかりません。');
    if(draftInvalid)throw new Error('以前の下書きを確認し、「入力する」から破棄してから編集してください。');
    if(draft?.text.trim()&&draft.id!==row.id&&!confirm('現在の下書きを置き換えて編集しますか？保存済みのフィードバックは残ります。'))return;
    draft={version:1,id:row.id,base:row,category:row.category,screen:row.screen,text:row.text};draftUnsaved=true;show('input');renderDraft();persistDraft();say('内容を編集できます。');return;
   }
   if(button.dataset.statusFeedback){const next=button.dataset.nextStatus;api.apply({userFeedback:changeFeedbackStatus(read(),button.dataset.statusFeedback,next)});showList();say(next==='resolved'?'対応済みにしました。履歴は残っています。':'未対応に戻しました。');}
  }catch(error){say(error.message||'操作を完了できませんでした。入力を残しています。');}
 }
 dialog.addEventListener('click',act);
 form.addEventListener('submit',event=>{
  event.preventDefault();try{current();if(draftInvalid)throw new Error('読み込めない下書きは上書きできません。');captureDraft();const result=saveFeedback(read(),draft);api.apply({userFeedback:result.entries});draft.base=result.entry;draftUnsaved=false;
   let cleanup='';try{if(localStorage.getItem(draftKey)!==draftRaw)throw new Error('別の画面の下書き');localStorage.removeItem(draftKey);draftRaw=null;draft=makeFeedbackDraft(screen());renderDraft();}catch{cleanup=' 下書きの整理はできませんでしたが、同じ内容は重複登録しません。';}
   $('#feedbackFilter').value=result.entry.status;limit=20;showList();say('フィードバックをこの端末に保存しました。外部には送信していません。'+cleanup);
  }catch(error){say('保存できませんでした。'+error.message+' 入力は残しています。');}
 });
 $('#feedbackFilter').onchange=()=>{limit=20;try{list();say('');}catch(error){say(error.message);}};
 document.addEventListener('click',event=>{const button=event.target.closest('[data-open-feedback]');if(!button||locked||window.climbLogAccountId!==owner||window.climbLogAuthReady!==true)return;try{current();if(dialog.open)return;opener=button;scroll=window.scrollY;loadDraft();if(!draftRaw&&!draft.text.trim()&&!draft.base)draft.screen=screen();show('input');renderDraft();bodyStyle=Object.fromEntries(['position','top','left','right','width','overflow'].map(key=>[key,document.body.style[key]]));Object.assign(document.body.style,{position:'fixed',top:`-${scroll}px`,left:'0',right:'0',width:'100%',overflow:'hidden'});dialog.showModal();$('[data-feedback="close"]').focus({preventScroll:true});if(draft.text.trim())say('前回の下書きを表示しています。');}catch(error){if(!dialog.open)dialog.showModal();say(error.message);}});
 window.addEventListener('climblog:stateChanged',()=>{if(locked)return;counts();if(!dialog.open)return;try{if(pane==='list')list();if(pane==='report'&&reportSource!==source()){for(const name of ['copy','download'])$(`[data-feedback="${name}"]`).disabled=true;say('保存内容が変わりました。一覧からレポートを作り直してください。');}}catch(error){say(error.message);}});
 window.addEventListener('beforeunload',event=>{if(draftUnsaved){event.preventDefault();event.returnValue='';}});
 window.addEventListener('climblog:authLock',()=>{locked=true;draft=null;report=null;draftUnsaved=false;dialog.close();dialog.replaceChildren();},{once:true});
 counts();
}
