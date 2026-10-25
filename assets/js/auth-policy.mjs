// Client-side reauthentication policy. This does not replace Supabase/RLS token validation.
export const idleTimeoutMs=30*60*1000;
export const absoluteTimeoutMs=7*24*60*60*1000;
export function makeLoginPolicy(userId,remember,now=Date.now()){
 if(typeof userId!=='string'||!userId)throw new Error('アカウントを確認できません。');
 return {version:1,userId,remember:Boolean(remember),authenticatedAt:now,lastActivityAt:now,requiresReauth:false};
}
export function policyReason(policy,{now=Date.now(),trainingActive=false}={}){
 if(!policy||policy.version!==1||typeof policy.userId!=='string'||typeof policy.remember!=='boolean'||!Number.isFinite(policy.authenticatedAt)||!Number.isFinite(policy.lastActivityAt)||policy.lastActivityAt<policy.authenticatedAt||policy.authenticatedAt>now+60000||policy.lastActivityAt>now+60000)return 'missing';
 if(policy.requiresReauth)return 'locked';
 if(now-policy.authenticatedAt>=absoluteTimeoutMs)return 'absolute';
 if(!trainingActive&&now-policy.lastActivityAt>=idleTimeoutMs)return 'idle';
 return null;
}
export function touchLoginPolicy(policy,now=Date.now()){return {...policy,lastActivityAt:now};}
export function sameRemoteVersion(a,b){if(a==null||b==null)return a==null&&b==null;const x=Date.parse(a),y=Date.parse(b);return Number.isFinite(x)&&x===y;}
export function createAuthStorage({local,tab,prefix,now=()=>Date.now()}){
 const tokenKeys=key=>[key,key+'-user',key+'-code-verifier'];
 const policyKey=prefix+':policy';let pendingMode=null,revocation=null;
 const parse=store=>{try{return JSON.parse(store.getItem(policyKey)||'null');}catch{return null;}};
 const selectedStore=()=>pendingMode!==null?(pendingMode?local:tab):tab.getItem(policyKey)!=null?tab:local.getItem(policyKey)!=null?local:tab;
 const getPolicy=()=>parse(selectedStore());
 const storage={
  getItem:key=>{if(revocation&&revocation.values.has(key))return revocation.values.get(key);const store=selectedStore();if(policyReason(parse(store),{now:now()}))return null;return store.getItem(key);},
  setItem:(key,value)=>{if(revocation&&revocation.values.has(key)){revocation.values.set(key,value);return;}selectedStore().setItem(key,value);},
  removeItem:key=>{if(revocation&&revocation.values.has(key)){revocation.values.set(key,null);return;}selectedStore().removeItem(key);}
 };
 return {storage,policyKey,getPolicy,setMode:remember=>{pendingMode=Boolean(remember);},
  activate:(userId,remember,tokenKey)=>{pendingMode=Boolean(remember);const store=selectedStore(),other=remember?tab:local;const policy=makeLoginPolicy(userId,remember,now());store.setItem(policyKey,JSON.stringify(policy));other.removeItem(policyKey);for(const key of tokenKeys(tokenKey))other.removeItem(key);pendingMode=null;return policy;},
  touch:()=>{const p=getPolicy();if(p&&!p.requiresReauth){const next=touchLoginPolicy(p,now());selectedStore().setItem(policyKey,JSON.stringify(next));return next;}return p;},
  markLocked:()=>{const p=getPolicy();if(p)selectedStore().setItem(policyKey,JSON.stringify({...p,requiresReauth:true}));},
  revoke:async(callback,tokenKey)=>{const store=selectedStore(),original=store.getItem(tokenKey);revocation={values:new Map(tokenKeys(tokenKey).map(key=>[key,store.getItem(key)]))};try{return await callback();}finally{revocation=null;if(store.getItem(tokenKey)===original)for(const key of tokenKeys(tokenKey))store.removeItem(key);}},
  clear:tokenKey=>{for(const store of [local,tab]){for(const key of tokenKeys(tokenKey))store.removeItem(key);store.removeItem(policyKey);}pendingMode=null;}
 };
}
