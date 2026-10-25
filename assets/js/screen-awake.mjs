// Shared ownership prevents the independent rest and workout timers releasing each other's lock.
export function createScreenAwakeController({request,isVisible=()=>true,onChange=()=>{}}={}){
 const owners=new Set();let lock=null,pending=null,status='idle',disposed=false;
 const report=value=>{if(status!==value){status=value;onChange(status);}};
 const wanted=()=>!disposed&&owners.size>0&&isVisible();
 async function refresh(){
  if(!wanted()){const old=lock;lock=null;report('idle');if(old&&!old.released)try{await old.release();}catch{}return;}
  if(lock&&!lock.released){report('active');return;}if(pending)return pending;
  if(!request){report('unsupported');return;}
  report('requesting');
  pending=Promise.resolve().then(async()=>{try{const sentinel=await request();if(!wanted()){try{await sentinel.release();}catch{}return;}lock=sentinel;sentinel.addEventListener('release',()=>{if(lock===sentinel){lock=null;report(wanted()?'released':'idle');}});report(sentinel.released?'released':'active');}catch{report(wanted()?'unavailable':'idle');}finally{pending=null;}});
  return pending;
 }
 return {setActive:(owner,active)=>{active?owners.add(owner):owners.delete(owner);return refresh();},refresh,getStatus:()=>status,dispose:async()=>{disposed=true;owners.clear();await refresh();}};
}
let controller;
export function screenAwake(){
 if(controller)return controller;
 controller=createScreenAwakeController({request:globalThis.isSecureContext&&globalThis.navigator?.wakeLock?()=>navigator.wakeLock.request('screen'):null,isVisible:()=>!document.hidden,onChange:status=>window.dispatchEvent(new CustomEvent('climblog:screenAwake',{detail:status}))});
 document.addEventListener('visibilitychange',()=>controller.refresh());window.addEventListener('pagehide',()=>controller.setActive('workout',false));return controller;
}
export const screenAwakeLabel=status=>({active:'画面の自動消灯を抑制中',requesting:'画面の消灯を抑制しています…',unsupported:'このブラウザは自動消灯の抑制に未対応です',unavailable:'自動消灯の抑制を利用できません。端末設定をご確認ください',released:'端末により自動消灯の抑制が解除されました',idle:'タイマー実行中に画面の自動消灯を抑制します'}[status]||'');
