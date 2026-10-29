export function createDatabase({url,anonKey,serviceKey,fetchImpl=fetch}){
 async function rest(path,{token=serviceKey,method='GET',body,prefer}={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{const res=await fetchImpl(url+path,{method,signal:controller.signal,headers:{apikey:token===serviceKey?serviceKey:anonKey,Authorization:'Bearer '+token,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});if(!res.ok)throw new Error('SETUP_REQUIRED');if(res.status===204)return null;const text=await res.text();return text.trim()===''?null:JSON.parse(text);}finally{clearTimeout(timer);}}
 const rows=(table,user,query='')=>rest('/rest/v1/'+table+'?user_id=eq.'+encodeURIComponent(user)+query);
 return {
  async authenticate(token){try{const u=await rest('/auth/v1/user',{token});return u?.id||null;}catch{return null;}},
  async settings(user){return (await rows('ai_coach_settings',user,'&select=settings'))[0]?.settings||{};},
  async saveSettings(user,settings){await rest('/rest/v1/ai_coach_settings',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:{user_id:user,settings,updated_at:new Date().toISOString()}});},
  async state(user,token){return (await rest('/rest/v1/user_app_state?user_id=eq.'+encodeURIComponent(user)+'&select=payload',{token}))[0]?.payload||{};},
  async requests(user,day){return rows('ai_coach_requests',user,'&plan_date=gte.'+day.slice(0,7)+'-01&order=requested_at.desc');},
  async globalUsage(day){const data=await rest('/rest/v1/ai_coach_requests?plan_date=gte.'+day.slice(0,7)+'-01&select=id');const last=await rest('/rest/v1/ai_coach_requests?select=requested_at&order=requested_at.desc&limit=1');return {count:data.length,latestAt:last[0]?.requested_at||null};},
  async claim(args){return rest('/rest/v1/rpc/ai_coach_claim_v2',{method:'POST',body:args});},
  async finish(args){return rest('/rest/v1/rpc/ai_coach_finish',{method:'POST',body:args});},
  async proposal(user,id){return (await rows('ai_coach_requests',user,'&id=eq.'+encodeURIComponent(id)))[0]||null;},
  async adopt(row){await rest('/rest/v1/ai_coach_adoptions?on_conflict=id',{method:'POST',prefer:'resolution=ignore-duplicates,return=minimal',body:row});}
 };
}
