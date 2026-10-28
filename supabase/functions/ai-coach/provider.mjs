// Gemini free-trial adapter. No browser imports, SDK, tools or fallback provider.
import {proposalSchema,coachInstructions} from './proposal-schema.mjs';
export const freeModels=Object.freeze(['gemini-2.5-flash-lite','gemini-2.5-flash']);
export function createProvider({key,model='gemini-2.5-flash-lite',fetchImpl=fetch}){
 return async input=>{
  if(!key)throw new Error('SETUP_REQUIRED');
  if(!freeModels.includes(model))throw new Error('MODEL_NOT_ALLOWED');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try{
   const response=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{method:'POST',signal:controller.signal,headers:{'x-goog-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:coachInstructions}]},contents:[{role:'user',parts:[{text:JSON.stringify(input)}]}],generationConfig:{candidateCount:1,maxOutputTokens:4000,temperature:0.3,thinkingConfig:{thinkingBudget:0},responseMimeType:'application/json',responseJsonSchema:proposalSchema}})});
   if(!response.ok)throw new Error(response.status===429?'PROVIDER_LIMIT':response.status===401||response.status===403?'PROVIDER_AUTH':response.status===400?'PROVIDER_BAD_REQUEST':response.status===404?'PROVIDER_NOT_FOUND':response.status>=500?'PROVIDER_UNAVAILABLE':'PROVIDER_ERROR');
   let data;try{data=await response.json();}catch{throw new Error('INVALID_JSON');}if(data.promptFeedback?.blockReason)throw new Error('REFUSAL');
   const candidate=data.candidates?.[0];if(!candidate||candidate.finishReason!=='STOP')throw new Error(candidate?.finishReason==='MAX_TOKENS'?'INCOMPLETE':'REFUSAL');
   const parts=candidate.content?.parts||[];const text=parts.filter(p=>typeof p.text==='string'&&p.thought!==true).map(p=>p.text).join('');
   if(!text)throw new Error('INCOMPLETE');
   let draft;try{draft=JSON.parse(text);}catch{throw new Error('INVALID_JSON');}
   return {draft,model:data.modelVersion||model,inputTokens:data.usageMetadata?.promptTokenCount??null,outputTokens:data.usageMetadata?.candidatesTokenCount??null};
  }catch(error){if(controller.signal.aborted||error?.name==='AbortError')throw new Error('PROVIDER_TIMEOUT');if(error instanceof TypeError)throw new Error('PROVIDER_NETWORK');throw error;}finally{clearTimeout(timer);}
 };
}
