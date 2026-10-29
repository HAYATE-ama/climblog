// Status reads only Supabase state; it must never trigger or retry generation.
export function checkCoachStatus(request,timeoutMs=15000){
 let timer;
 return new Promise((resolve,reject)=>{
  timer=setTimeout(()=>reject(new Error('STATUS_TIMEOUT')),timeoutMs);
  Promise.resolve().then(()=>request({action:'status'})).then(resolve,reject);
 }).finally(()=>clearTimeout(timer));
}
