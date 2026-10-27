import {readVerifiedAccount,preloadAppModules} from './auth-startup.mjs';
import {accountKeys,loadAccountPayload} from './account-storage.mjs';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {buildCloudPayload,migrateLegacyRecords} from './features.mjs';
import {createAuthStorage,policyReason,sameRemoteVersion} from './auth-policy.mjs';

const config=window.CLIMBLOG_CONFIG||{},$=id=>document.getElementById(id),authScreen=$('authScreen'),authForm=$('authForm'),appRoot=$('appRoot'),syncStatus=$('syncState');
const say=text=>$('authMessage').textContent=text;
// Download public module code without executing it or reading account state.
authForm.addEventListener('focusin',()=>preloadAppModules(document),{once:true});
appRoot.hidden=true;
if(!config.supabaseUrl||!config.supabasePublishableKey||config.supabaseUrl.includes('YOUR_')){
 say('Supabase設定が未入力です。config.jsを設定してから再読み込みしてください。');$('authSubmit').disabled=true;
}else{
 const origSet=Storage.prototype.setItem,origRemove=Storage.prototype.removeItem;
 const project=new URL(config.supabaseUrl).hostname.split('.')[0],prefix='climbLogAuth:'+project,tokenKey=prefix+':token',signalKey=prefix+':event',ownerKey=prefix+':owner';
 const authStore=createAuthStorage({local:localStorage,tab:sessionStorage,prefix});
 let client,user=null,ready=false,initializing=false,signup=false,submitting=false,locking=false,loadingEpoch=0,syncTimer=null,writes=Promise.resolve(),localPayload=null,remoteVersion=null,activityWriteAt=0,previousTraining=false,appImportStarted=false;
 const pendingKey=id=>'climbLogPendingState:'+id;
 const parse=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}};
 const writeRaw=(key,value)=>origSet.call(localStorage,key,JSON.stringify(value));
 const readPending=id=>{const value=parse(pendingKey(id));return value?.userId===id&&value.payload&&Array.isArray(value.payload.records)&&typeof value.revision==='string'?value:null;};
 function hidePrivateUI(){
  window.dispatchEvent(new Event('climblog:authLock'));
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  $('modal')?.classList.remove('open');$('authPending').hidden=true;appRoot.hidden=true;appRoot.inert=true;authScreen.hidden=false;authScreen.style.display='grid';$('authPassword').value='';window.scrollTo({top:0,left:0,behavior:'instant'});
 }
 function broadcast(type){try{writeRaw(signalKey,{type,userId:user?.id||authStore.getPolicy()?.userId||null,nonce:crypto.randomUUID()});}catch{}}
 function stash(){if(!user||!localPayload)return null;const old=readPending(user.id);const value={userId:user.id,payload:localPayload,revision:crypto.randomUUID(),baseUpdatedAt:old?.baseUpdatedAt??remoteVersion,savedAt:new Date().toISOString()};writeRaw(pendingKey(user.id),value);return value;}
 function clearCache(){for(const key of Object.values(accountKeys))origRemove.call(localStorage,key);origRemove.call(localStorage,'climbLogProjects');}
 const reasons={idle:'30分間操作がなかったため、再ログインしてください。下書き・途中記録は保持しています。',absolute:'前回のログインから7日経過しました。再ログインしてください。',signedOut:'ログインが解除されました。再ログインしてください。',accountChanged:'別の画面でアカウントが変更されました。再ログインしてください。',missing:'ログイン方式を更新しました。パスワードでログインしてください。',locked:'再度パスワードを入力してログインしてください。',manual:'ログアウトしました。',authError:'認証を確認できません。接続を確認して再ログインしてください。'};
 async function lock(reason,{revoke=true,notify=true}={}){
  if(locking)return;locking=true;ready=false;initializing=false;loadingEpoch++;clearTimeout(syncTimer);hidePrivateUI();client?.auth.stopAutoRefresh?.();
  const policy=authStore.getPolicy(),owner=localStorage.getItem(ownerKey),canRevoke=revoke&&policy?.userId===user?.id&&(!owner||owner===user?.id);
  try{if(!user||policy?.userId===user.id)authStore.markLocked();}catch{}
  if(notify)broadcast('lock');
  say(reasons[reason]||reasons.locked);$('authSubmit').disabled=true;
  try{if(canRevoke)await authStore.revoke(async()=>{const result=await client.auth.signOut({scope:'local'});if(result.error)throw result.error;return result;},tokenKey);}catch{say((reasons[reason]||reasons.locked)+' この端末のログイン情報は無効化しました。');}
  finally{locking=false;$('authSubmit').disabled=false;}
 }
 async function bounded(query){
  const controller=new AbortController();let timer;try{return await Promise.race([query.abortSignal?query.abortSignal(controller.signal):query,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('通信がタイムアウトしました。'));},10000);})]);}finally{clearTimeout(timer);}
 }
 const networkFetch=async(input,init={})=>{const controller=new AbortController(),abort=()=>controller.abort(init.signal?.reason);if(init.signal?.aborted)abort();init.signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(()=>controller.abort(),10000);try{return await fetch(input,{...init,signal:controller.signal});}finally{clearTimeout(timer);init.signal?.removeEventListener('abort',abort);}};
 client=createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{storage:authStore.storage,storageKey:tokenKey,persistSession:true,autoRefreshToken:false},global:{fetch:networkFetch}});
 // Migrate away from the former indefinite session without reading or logging its token.
 for(const key of ['sb-'+project+'-auth-token','sb-'+project+'-auth-token-code-verifier','sb-'+project+'-auth-token-user'])origRemove.call(localStorage,key);
 const isTrainingActive=()=>!document.hidden&&Boolean(window.climbLogWorkout?.isRunning()||window.climbLogRestTimerRunning?.());
 function check(){
  if(!ready){if(user&&!$('authPending').hidden&&!locking){const pendingReason=policyReason(authStore.getPolicy());if(pendingReason)void lock(pendingReason);}return false;}const active=isTrainingActive(),p=authStore.getPolicy();if(p&&p.userId!==user?.id||localStorage.getItem(ownerKey)&&localStorage.getItem(ownerKey)!==user?.id){void lock('accountChanged',{revoke:false,notify:false});return false;}const hard=policyReason(p,{trainingActive:true});
  if(hard){void lock(hard);return false;}
  if(active||previousTraining){if(Date.now()-activityWriteAt>=15000||!active){try{authStore.touch();activityWriteAt=Date.now();}catch{void lock('authError');return false;}}}
  previousTraining=active;const reason=policyReason(authStore.getPolicy(),{trainingActive:active});if(reason){void lock(reason);return false;}
  const owner=localStorage.getItem(ownerKey);if(owner&&owner!==user?.id){void lock('accountChanged',{revoke:false,notify:false});return false;}return true;
 }
 async function sync(){
  if(!check()||!user)return false;const id=user.id,epoch=loadingEpoch,pending=readPending(id);if(!pending)return true;
  syncStatus.textContent='同期中';
  const send=async()=>{if(!ready||epoch!==loadingEpoch||user?.id!==id||!check())return false;const updatedAt=new Date().toISOString();try{const {error}=await bounded(client.from('user_app_state').upsert({user_id:id,payload:pending.payload,updated_at:updatedAt},{onConflict:'user_id'}));if(error)throw error;if(!ready||epoch!==loadingEpoch)return false;remoteVersion=updatedAt;const latest=readPending(id);if(latest?.revision===pending.revision)origRemove.call(localStorage,pendingKey(id));else if(latest)writeRaw(pendingKey(id),{...latest,baseUpdatedAt:updatedAt});syncStatus.textContent='同期済み';return true;}catch(error){syncStatus.textContent='未同期（この端末に保留）';if(error.status===401||error.code==='PGRST301')void lock('authError');return false;}};
  writes=writes.then(send,send);return writes;
 }
 Storage.prototype.setItem=function(key,value){
  if(this!==localStorage||!Object.values(accountKeys).includes(key))return origSet.call(this,key,value);
  if(!initializing&&!check())throw new Error('再ログインしてから保存してください。');
  origSet.call(this,key,value);localPayload=buildCloudPayload(localStorage);
  try{stash();}catch{syncStatus.textContent='未同期（端末の空き容量を確認）';}
  clearTimeout(syncTimer);syncTimer=setTimeout(()=>void sync(),500);
 };
 async function initializeApp(payload,epoch){
  const reason=policyReason(authStore.getPolicy());if(reason){await lock(reason);return;}
  loadAccountPayload(localStorage,payload,origSet,origRemove);localPayload=buildCloudPayload(localStorage);initializing=true;
  appImportStarted=true;
  try{await import('./app.js');await import('./enhancements.js');}finally{initializing=false;}
  if(epoch!==loadingEpoch||locking)return;const finalReason=policyReason(authStore.getPolicy());if(finalReason){await lock(finalReason);return;}ready=true;appRoot.inert=false;appRoot.hidden=false;authScreen.hidden=true;authScreen.style.display='none';$('authPassword').value='';client.auth.startAutoRefresh?.();activityWriteAt=Date.now();syncStatus.textContent=readPending(user.id)?'未同期（復元済み）':'同期済み';
  if(readPending(user.id))void sync();
 }
 function showPendingChoice(remote,pending,epoch){
  const authorized=()=>{const p=authStore.getPolicy();if(p?.userId!==user?.id||localStorage.getItem(ownerKey)!==user?.id){void lock('accountChanged',{revoke:false,notify:false});return false;}const reason=policyReason(p);if(reason){void lock(reason);return false;}return true;};
  const resume=async payload=>{try{await initializeApp(payload,epoch);}catch(error){hidePrivateUI();say(error.message||'画面を読み込めませんでした。再ログインしてください。');}};
  const box=$('authPending');box.hidden=false;$('authPendingMessage').textContent='この端末に未同期の変更があり、クラウド側も更新されています。両方を自動では上書きしません。';
  $('authRestorePending').onclick=async()=>{if(!authorized())return;if(!confirm('端末の未同期内容でクラウドを置き換えますか？クラウド内容を先にバックアップできます。'))return;box.hidden=true;await resume(pending.payload);};
  $('authKeepRemote').onclick=async()=>{if(!authorized())return;if(!confirm('端末の未同期データを破棄してクラウドを使いますか？必要なら先にバックアップしてください。'))return;origRemove.call(localStorage,pendingKey(user.id));box.hidden=true;await resume(remote.payload||null);};
  $('authBackupPending').onclick=()=>{if(authorized())download(pending.payload,'climblog-unsynced-backup.json');};$('authBackupRemote').onclick=()=>{if(authorized())download(remote.payload||{},'climblog-cloud-backup.json');};
 }
 async function start(session){
  const epoch=++loadingEpoch;ready=false;user=session.user;hidePrivateUI();say('本人確認と記録の読み込みを行っています…');$('authSubmit').disabled=true;
  try{
   const reason=policyReason(authStore.getPolicy());if(reason){await lock(reason);return;}
   preloadAppModules(document);
   const expectedUserId=user.id;const data=await readVerifiedAccount(expectedUserId,{verifyUser:()=>client.auth.getUser(),readRemote:()=>bounded(client.from('user_app_state').select('payload,updated_at').eq('user_id',expectedUserId).maybeSingle())});
   if(epoch!==loadingEpoch)return;remoteVersion=data?.updated_at||null;window.climbLogAccountId=user.id;origSet.call(localStorage,ownerKey,user.id);
   const remote=data?.payload?{...data.payload,records:migrateLegacyRecords(data.payload.records||[])}:null,pending=readPending(user.id);
   if(pending&&!sameRemoteVersion(pending.baseUpdatedAt,remoteVersion)){say('未同期の記録を確認してください。');showPendingChoice(data||{},pending,epoch);return;}
   await initializeApp(pending?.payload||remote,epoch);
  }catch(error){if(epoch===loadingEpoch){hidePrivateUI();say(error.message||'接続を確認して再ログインしてください。');}}
  finally{if(!locking)$('authSubmit').disabled=false;}
 }
 // Never perform awaited Supabase calls inside the auth notification callback.
 client.auth.onAuthStateChange((event,session)=>{
  if(submitting||locking)return;
  if(event==='SIGNED_OUT'&&(ready||user))setTimeout(()=>void lock('signedOut',{revoke:false}),0);
  else if(ready&&session?.user?.id!==user?.id&&['SIGNED_IN','TOKEN_REFRESHED'].includes(event))setTimeout(()=>void lock('accountChanged',{revoke:false}),0);
 });
 window.addEventListener('storage',event=>{
  if(event.key===signalKey&&ready){const signal=parse(signalKey);if(signal?.type==='lock'&&signal.userId===user?.id)void lock('signedOut',{revoke:false,notify:false});}
  if(event.key===ownerKey&&ready&&event.newValue!==user?.id)void lock('accountChanged',{revoke:false,notify:false});
 });
 for(const type of ['pointerdown','keydown','input','wheel'])document.addEventListener(type,event=>{
  if(!ready||!event.isTrusted)return;
  if(!check()){if(!authScreen.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();}return;}
  if(Date.now()-activityWriteAt>=5000){try{authStore.touch();activityWriteAt=Date.now();}catch{void lock('authError');}}
 },{capture:true,passive:false});
 for(const type of ['click','submit','keydown'])document.addEventListener(type,event=>{if(!ready&&!authScreen.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();}},true);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});window.addEventListener('pageshow',()=>check());setInterval(check,1000);
 function download(data,name){const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),...data},null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
 $('exportData').addEventListener('click',()=>{if(check())download(buildCloudPayload(localStorage),'climblog-backup-'+new Date().toISOString().slice(0,10)+'.json');});
 $('signOut').addEventListener('click',async()=>{
  if(submitting||locking)return;hidePrivateUI();say('未同期の変更を確認してログアウトしています…');$('authSubmit').disabled=true;try{await sync();}finally{await lock('manual');if(localStorage.getItem(ownerKey)===user?.id)clearCache();}
 });
 authForm.addEventListener('submit',async event=>{
  event.preventDefault();if(submitting||locking)return;submitting=true;$('authSubmit').disabled=true;say('処理中です…');$('authPending').hidden=true;
  const remember=$('authRemember').checked;authStore.setMode(remember);
  try{
   const email=$('authEmail').value.trim(),password=$('authPassword').value;
   const response=signup?await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}}):await client.auth.signInWithPassword({email,password});
   if(response.error)throw response.error;
   if(!response.data.session){say('確認メールを送信しました。メール内のリンクを開いてからログインしてください。');return;}
   authStore.activate(response.data.session.user.id,remember,tokenKey);origSet.call(localStorage,ownerKey,response.data.session.user.id);$('authPassword').value='';
   // Existing UI modules retain account-specific state. Reauthentication still rebuilds them safely.
   if(appImportStarted){location.reload();return;}
   await start(response.data.session);
  }catch(error){say(error.message||'ログインできませんでした。');}finally{submitting=false;$('authSubmit').disabled=false;}
 });
 $('authToggle').addEventListener('click',()=>{signup=!signup;$('authTitle').textContent=signup?'アカウント作成':'ログイン';$('authSubmit').textContent=signup?'登録する':'ログイン';$('authToggle').textContent=signup?'ログインに戻る':'初めての方：アカウント作成';$('authPassword').autocomplete=signup?'new-password':'current-password';say('');});
 const existingPolicy=authStore.getPolicy();$('authRemember').checked=Boolean(existingPolicy?.remember);
 const reason=policyReason(existingPolicy);if(reason){say(existingPolicy?(reasons[reason]||reasons.locked):'メールアドレスとパスワードでログインしてください。');authStore.markLocked();}
 else{try{const {data:{session},error}=await client.auth.getSession();if(error)throw error;if(session&&session.user.id===existingPolicy.userId)await start(session);else await lock('signedOut',{revoke:false});}catch{say('接続を確認して再ログインしてください。');}}
 if(!locking)$('authSubmit').disabled=false;
}
