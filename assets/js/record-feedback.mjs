// Local persistence and cloud sync are deliberately described separately.
export function installRecordFeedback(){
 const notice=document.createElement('section');notice.className='recordFeedback';notice.id='recordFeedback';notice.hidden=true;
 const message=document.createElement('p');message.id='recordFeedbackMessage';message.setAttribute('role','status');message.setAttribute('aria-live','polite');message.setAttribute('aria-atomic','true');
 const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','保存の案内を閉じる');notice.append(message,close);document.getElementById('appRoot').append(notice);
 let timer;function hide(){clearTimeout(timer);notice.hidden=true;message.textContent='';}close.onclick=hide;
 window.addEventListener('climblog:recordSaved',event=>{const count=event.detail?.recordIds?.length;if(!count)return;clearTimeout(timer);notice.hidden=false;message.textContent=`${event.detail.isNew?'記録を端末に保存':'記録を更新'}しました（${count}項目）。同期状況は画面上部で確認できます。`;timer=setTimeout(hide,8000);});
 window.addEventListener('climblog:recordOpened',hide);
 window.addEventListener('climblog:authLock',hide);
}
