import {normalizeAiSettings,coachDay,buildAiInput,inputHash,publicProposal,validateDailyDraft,restRequired,restMessage,aiRegistryVersion,dailyDraftToPlan,aiConsentVersion} from '../../../assets/js/ai-coach-contract.mjs';
import {normalizeWorkoutPlan,workoutPlanSignature} from '../../../assets/js/workout-model.mjs';
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export function createCoachHandler({db,provider,allowedUsers=[],configured=false,origins=['https://hayate-ama.github.io'],now=()=>new Date(),limits={daily:2,monthly:30,global:30}}){
 return async request=>{
  const origin=request.headers.get('Origin');const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(origin&&origins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{})};
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&!origins.includes(origin))return reply({code:'ORIGIN_DENIED'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}});
  if(request.method!=='POST')return reply({code:'METHOD'},405);
  const token=request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];if(!token)return reply({code:'AUTH_REQUIRED'},401);
  const user=await db.authenticate(token);if(!uuid(user))return reply({code:'AUTH_REQUIRED'},401);
  try{
   if(Number(request.headers.get('Content-Length')||0)>64000)return reply({code:'TOO_LARGE'},413);
   const raw=await request.text();if(raw.length>64000)return reply({code:'TOO_LARGE'},413);const body=JSON.parse(raw);
   if(!allowedUsers.includes(user))return reply({configured:false,code:allowedUsers.length?'NOT_ALLOWED':'SETUP_REQUIRED'},allowedUsers.length?403:200);
   const day=coachDay(now()),settings=normalizeAiSettings(await db.settings(user));
   const usageNow=async()=>{const rows=await db.requests(user,day);return {today:rows.filter(r=>r.plan_date===day).length,month:rows.length,dailyLimit:limits.daily,monthlyLimit:limits.monthly};};
   if(body.action==='status'){
    const rows=await db.requests(user,day),today=rows.filter(r=>r.plan_date===day),ready=today.find(r=>r.state==='ready'&&r.settings_snapshot?.consentVersion===aiConsentVersion);
    return reply({configured,settings,day,proposal:restRequired(settings)?null:publicProposal(ready),restAdvice:restRequired(settings)?restMessage(settings):null,attempted:today.length>0,pending:today.some(r=>r.state==='processing'),usage:{today:today.length,month:rows.length,dailyLimit:limits.daily,monthlyLimit:limits.monthly}});
   }
   if(body.action==='saveSettings'){const clean=normalizeAiSettings(body.settings);if(clean.enabled&&!configured)return reply({code:'SETUP_REQUIRED'},409);await db.saveSettings(user,clean);return reply({settings:clean,configured});}
   if(body.action==='adopt'){
    if(!uuid(body.id)||!uuid(body.proposalId))return reply({code:'INVALID'},400);
    const row=await db.proposal(user,body.proposalId);if(row?.state!=='ready')return reply({code:'NOT_FOUND'},404);
    const plan=normalizeWorkoutPlan(body.plan);const origin=plan.aiOrigin;if(origin?.proposalId!==row.id)return reply({code:'INVALID'},400);
    await db.adopt({id:body.id,user_id:user,proposal_id:row.id,workout_plan:plan,modified:workoutPlanSignature(plan)!==workoutPlanSignature(dailyDraftToPlan(row.draft,row.settings_snapshot))});return reply({saved:true});
   }
   if(body.action!=='generate')return reply({code:'INVALID'},400);
   if(!configured)return reply({code:'SETUP_REQUIRED'},409);
   if(!settings.enabled)return reply({code:'DISABLED'},409);
   if(restRequired(settings))return reply({restAdvice:restMessage(settings)});
   if(!uuid(body.requestId))return reply({code:'INVALID'},400);
   const input=buildAiInput({},settings,day);if(!input.candidates.length||JSON.stringify(input).length>30000)return reply({code:'INPUT_LIMIT'},400);
   const claim=await db.claim({p_user_id:user,p_request_id:body.requestId,p_day:day,p_force:body.force===true,p_hash:await inputHash(input),p_settings:settings,p_registry:aiRegistryVersion,p_daily:limits.daily,p_monthly:limits.monthly,p_global:limits.global});
   if(claim.action!=='created'){const row=claim.request;if(row?.state==='ready'&&row.settings_snapshot?.consentVersion===aiConsentVersion)return reply({proposal:publicProposal(row),cached:true,usage:await usageNow()});return reply({code:claim.code|| (row?.state==='processing'?'PENDING':claim.action==='disabled'?'DISABLED':'PREVIOUS_FAILED')},claim.action==='limited'?429:409);}
   let result;
   try{
    if(JSON.stringify(normalizeAiSettings(await db.settings(user)))!==JSON.stringify(settings))throw new Error('CONSENT_CHANGED');
    result=await provider(input);const draft=validateDailyDraft(result.draft,settings);
    const row=await db.finish({p_user_id:user,p_request_id:body.requestId,p_state:'ready',p_draft:draft,p_model:result.model,p_input:result.inputTokens,p_output:result.outputTokens,p_error:null});
    if(row.state!=='ready')return reply({code:'CONSENT_CHANGED'},409);return reply({proposal:publicProposal(row),usage:await usageNow()});
   }catch(error){
    const code=['PROVIDER_LIMIT','REFUSAL','INCOMPLETE','CONSENT_CHANGED','PROVIDER_AUTH','MODEL_NOT_ALLOWED'].includes(error.message)?error.message:'GENERATION_FAILED';
    await db.finish({p_user_id:user,p_request_id:body.requestId,p_state:'failed',p_draft:null,p_model:result?.model||null,p_input:result?.inputTokens??null,p_output:result?.outputTokens??null,p_error:code});return reply({code},502);
   }
  }catch{return reply({code:'SETUP_REQUIRED'},503);}
 };
}
