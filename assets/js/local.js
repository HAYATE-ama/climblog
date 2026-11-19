import {accountKeys,registerAccountPatchWriter} from './account-storage.mjs';
import {migrateToLocal,createLocalWriter} from './local-storage.mjs';
import {prepareOutdoorAscentReset} from './outdoor-season.mjs';

const $=id=>document.getElementById(id),status=$('syncState'),screen=$('authScreen');
// An installed PWA may briefly serve the previous HTML while updating modules.
if(!$('localReload'))screen.innerHTML='<div class="authCard"><h1>記録を開いています</h1><p id="authMessage">端末の記録を読み込んでいます…</p><button type="button" id="localReload" hidden>再読み込み</button></div>';
$('signOut')?.remove();
const showSaved=()=>{status.textContent='端末に保存済み';status.title='この端末に自動保存します。クラウドへの送信は行いません。';};
try{
  let project;try{project=new URL(window.CLIMBLOG_CONFIG?.supabaseUrl).hostname.split('.')[0];}catch{}
  const migrate=()=>migrateToLocal(localStorage,{project});
  const profile=navigator.locks?await navigator.locks.request('climbLogLocalMigration',migrate):migrate();
  window.climbLogAccountId=profile.id;window.climbLogStorageMode='local';window.climbLogAuthReady=false;
  const originalSet=Storage.prototype.setItem,originalRemove=Storage.prototype.removeItem;
  const writer=createLocalWriter(localStorage,{setItem:originalSet,removeItem:originalRemove,onSaved:showSaved,onError:()=>{status.textContent='保存できませんでした';status.title='入力を残したまま端末の空き容量や他の画面の変更を確認してください。';}});
  registerAccountPatchWriter(localStorage,writer);
  Storage.prototype.setItem=function(key,value){
    if(this===localStorage&&Object.values(accountKeys).includes(String(key)))return writer([{key:String(key),value:String(value)}]);
    return originalSet.call(this,key,value);
  };
  await import('./app.js');await import('./enhancements.js');
  const reset=prepareOutdoorAscentReset(window.climbLogStateApi.get());if(reset)window.climbLogStateApi.apply(reset);
  if(profile.notice){const notice=document.createElement('p');notice.className='sub';notice.textContent=profile.notice;$('settingsDataPanel').append(notice);}
  screen.hidden=true;screen.style.display='none';$('appRoot').hidden=false;
  window.climbLogAuthReady=true;showSaved();
  window.dispatchEvent(new Event('climblog:authenticated'));
  // Persistence reduces automatic eviction where supported; it is not a backup.
  void navigator.storage?.persist?.().catch(()=>{});
  window.addEventListener('storage',event=>{if(Object.values(accountKeys).includes(event.key)){status.textContent='別の画面で更新あり';status.title='保存前に再読み込みしてください。';}});
}catch(error){
  $('appRoot').hidden=true;screen.hidden=false;
  $('authMessage').textContent=error?.message?.startsWith('旧版の保存先')?error.message:'端末の記録を読み込めませんでした。サイトデータを削除せず、空き容量と接続を確認して再読み込みしてください。元の記録は保持しています。';
  $('localReload').hidden=false;
}
$('localReload').onclick=()=>location.reload();
