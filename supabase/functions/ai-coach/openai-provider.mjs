// Server only. Never imported by browser modules.
import {proposalSchema,coachInstructions} from './proposal-schema.mjs';
export function createProvider({key,model='gpt-5.4-mini',fetchImpl=fetch}){return async input=>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{
  const response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',signal:controller.signal,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,store:false,max_output_tokens:4000,reasoning:{effort:'low'},instructions:coachInstructions,input:JSON.stringify(input),text:{format:{type:'json_schema',name:'dailyCourse',strict:true,schema:proposalSchema}}})});
  if(!response.ok)throw new Error(response.status===429?'PROVIDER_LIMIT':'PROVIDER_ERROR');
  const data=await response.json();if(data.status!=='completed')throw new Error('INCOMPLETE');
  const content=(data.output||[]).flatMap(o=>o.content||[]);if(content.some(c=>c.type==='refusal'))throw new Error('REFUSAL');
  const text=content.filter(c=>c.type==='output_text').map(c=>c.text).join('');
  return {draft:JSON.parse(text),model:data.model||model,inputTokens:data.usage?.input_tokens??null,outputTokens:data.usage?.output_tokens??null};
 }finally{clearTimeout(timer);}
};}
