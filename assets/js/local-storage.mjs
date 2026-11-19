import {accountKeys,commitStorageRows} from './account-storage.mjs';

export const localProfileKey='climbLogLocalProfile';
export const localRecoveryKey='climbLogLocalMigrationRecovery';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const objectFields=new Set(['preferences','goals','bodyProfile']);
function validField(name,value){return objectFields.has(name)?object(value):name==='gyms'&&value===null||Array.isArray(value);}
const storageKeys=storage=>Array.from({length:storage.length},(_,i)=>storage.key(i));
const readJson=(storage,key)=>{const raw=storage.getItem(key);return raw===null?null:JSON.parse(raw);};

// The old account identifier remains only as a device-local draft namespace.
// Never read authentication tokens, contact the server, or delete legacy copies.
export function migrateToLocal(storage,{project,now=new Date().toISOString()}={}){
  const existing=readJson(storage,localProfileKey);
  if(existing!==null){
    if(existing.version!==1||typeof existing.id!=='string'||!existing.id)throw new Error('端末の保存先を読み込めませんでした。サイトデータを削除せず、復旧をご相談ください。');
    return existing;
  }
  const keys=storageKeys(storage),owners=keys.filter(k=>/^climbLogAuth:[^:]+:owner$/.test(k));
  const known=project?storage.getItem('climbLogAuth:'+project+':owner'):null;
  const owner=known||(owners.length===1?storage.getItem(owners[0]):null);
  if(!owner&&owners.length>1)throw new Error('旧版の保存先が複数あります。記録を混ぜずに移行するため、保存先の確認が必要です。');
  const local=Object.fromEntries(Object.entries(accountKeys).map(([name,key])=>[name,storage.getItem(key)]));
  const pendingKey=owner?'climbLogPendingState:'+owner:null,pendingRaw=pendingKey?storage.getItem(pendingKey):null;
  const rows=[];let pending=null,notice='';
  if(pendingRaw!==null){
    try{pending=JSON.parse(pendingRaw);}catch{}
    if(!object(pending)||pending.userId!==owner||typeof pending.revision!=='string'||!object(pending.payload)||!Array.isArray(pending.payload.records)||Object.entries(pending.payload).some(([name,v])=>Object.hasOwn(accountKeys,name)&&!validField(name,v))){
      notice='旧版の未同期データを自動で取り込めませんでした。元のデータは端末内に保管しています。';pending=null;
    }
  }
  if(!owner&&keys.some(k=>k.startsWith('climbLogPendingState:')))notice='旧版の未同期データの保存先を確認できませんでした。元のデータは端末内に保管しています。';
  // A pending snapshot is the old app's last committed local edit (including
  // deletions). Do not union it with an older cloud cache and resurrect records.
  if(pending)for(const [name,value] of Object.entries(pending.payload))if(Object.hasOwn(accountKeys,name))rows.push({key:accountKeys[name],value:JSON.stringify(value)});
  const next=new Map(rows.map(r=>[r.key,r.value]));
  for(const [name,key] of Object.entries(accountKeys)){
    const raw=next.get(key)??local[name];
    if(raw!==null&&!validField(name,JSON.parse(raw)))throw new Error('端末内の記録の形式を確認できません。データを削除せず、復旧をご相談ください。');
  }
  const profile={version:1,id:owner||'device',migratedAt:now,notice};
  // Preserve the exact original values before the first migration. The marker
  // commits last; any failure restores the previous values and can be retried.
  if(Object.values(local).some(v=>v!==null)||pendingRaw!==null)rows.unshift({key:localRecoveryKey,value:JSON.stringify({version:1,createdAt:now,local,pendingRaw})});
  rows.push({key:localProfileKey,value:JSON.stringify(profile)});
  commitStorageRows(storage,rows);
  return profile;
}

export function createLocalWriter(storage,{setItem=storage.setItem,removeItem=storage.removeItem,onSaved=()=>{},onError=()=>{}}={}){
  const fingerprint=()=>JSON.stringify(Object.values(accountKeys).map(k=>storage.getItem(k)));
  let baseline=fingerprint();
  return rows=>{
    try{
      if(fingerprint()!==baseline)throw new Error('別の画面で記録が更新されました。入力を控えてから再読み込みしてください。保存はしていません。');
      commitStorageRows(storage,rows,{setItem,removeItem});baseline=fingerprint();onSaved();
    }catch(error){onError();throw error;}
  };
}
