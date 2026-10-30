import {weatherComparisonInput,validateWeatherExplanation,weatherConsentVersion} from '../../../assets/js/outdoor-planner-model.mjs';
export function createWeatherHandler({db,provider,configured=false,allowedUsers=[],monthlyLimit=30,intervalMinutes=1,origins=['https://hayate-ama.github.io'],now=()=>Date.now()}){
 return async request=>{
  const origin=request.headers.get('Origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(origin&&origins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{})},reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
  if(origin&&!origins.includes(origin))return reply({code:'ORIGIN_DENIED'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}});
  if(request.method!=='POST')return reply({code:'METHOD'},405);
  try{
   const token=request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];if(!token)return reply({code:'AUTH_REQUIRED'},401);
   const user=await db.authenticate(token);if(!user)return reply({code:'AUTH_REQUIRED'},401);if(!allowedUsers.includes(user))return reply({code:'NOT_ALLOWED'},403);
   const raw=await request.text();if(new TextEncoder().encode(raw).byteLength>64000)return reply({code:'INPUT_LIMIT'},413);let body;try{body=JSON.parse(raw);}catch{return reply({code:'INVALID'},400);}
   const day=new Date(now()+9*3600000).toISOString().slice(0,10);
   const publicRow=row=>({configured,used:Boolean(row),...(row?.state==='ready'?{result:row.result,inputHash:row.input_hash,inputKey:JSON.stringify(row.input)}:{})});
   if(body.action==='status')return reply(publicRow(await db.today(user,day)));
   if(body.action!=='compare')return reply({code:'INVALID'},400);
   if(!configured)return reply({code:'SETUP_REQUIRED'},409);
   if(body.consentVersion!==weatherConsentVersion)return reply({code:'CONSENT_REQUIRED'},409);
   let input;try{input=weatherComparisonInput(body.input?.candidates,body.input?.style);}catch{return reply({code:'INVALID'},400);}
   if(new TextEncoder().encode(JSON.stringify(input)).byteLength>60000)return reply({code:'INPUT_LIMIT'},400);
   if(!input.candidates.some(r=>r.issuedAt))return reply({code:'STALE_INPUT'},409);
   for(const r of input.candidates){const time=Date.parse(r.issuedAt),date=Date.parse(r.date+'T00:00:00+09:00'),base=Date.parse(day+'T00:00:00+09:00');if(!Number.isFinite(date)||r.date!==new Date(date+9*3600000).toISOString().slice(0,10)||date<base||date>base+6*86400000||r.issuedAt&&(!Number.isFinite(time)||now()-time>18*3600000||time>now()+300000))return reply({code:'STALE_INPUT'},409);}
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(input))),hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
   const reservation=await db.claim({p_user:user,p_day:day,p_hash:hash,p_input:input,p_consent:weatherConsentVersion,p_monthly:monthlyLimit,p_interval:intervalMinutes});
   if(reservation.action!=='created'){if(reservation.row?.state==='ready'&&reservation.row.input_hash===hash)return reply({...publicRow(reservation.row),cached:true});return reply({code:reservation.code||'DAILY_LIMIT'},429);}
   try{const result=validateWeatherExplanation(await provider(input),input);await db.finish(user,day,{state:'ready',result});return reply({configured,used:true,result,inputHash:hash,inputKey:JSON.stringify(input)});}
   catch(error){const code=['PROVIDER_LIMIT','PROVIDER_AUTH','PROVIDER_NOT_FOUND','PROVIDER_UNAVAILABLE','PROVIDER_TIMEOUT','INVALID_AI_RESPONSE'].includes(error.message)?error.message:'GENERATION_FAILED';await db.finish(user,day,{state:'failed',error_code:code});return reply({code},502);}
  }catch{return reply({code:'SETUP_REQUIRED'},503);}
 };
}
