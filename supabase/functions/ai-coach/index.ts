import {createDatabase} from './database.mjs';
import {createProvider} from './provider.mjs';
import {createCoachHandler} from './handler.mjs';
const env=(key:string)=>Deno.env.get(key)||'';
const allowedUsers=env('AI_ALLOWED_USER_IDS').split(',').map(s=>s.trim()).filter(Boolean);
const cap=(key:string,fallback:number,max:number)=>{const n=Number(env(key)||fallback);return Number.isInteger(n)&&n>0&&n<=max?n:fallback;};
Deno.serve(createCoachHandler({db:createDatabase({url:env('SUPABASE_URL'),anonKey:env('SUPABASE_ANON_KEY'),serviceKey:env('SUPABASE_SERVICE_ROLE_KEY')}),provider:createProvider({key:env('OPENAI_API_KEY'),model:env('OPENAI_MODEL')||'gpt-5.4-mini'}),allowedUsers,configured:Boolean(env('OPENAI_API_KEY')&&allowedUsers.length),origins:['https://hayate-ama.github.io',...env('AI_ALLOWED_ORIGINS').split(',').map(s=>s.trim()).filter(Boolean)],limits:{daily:cap('AI_DAILY_LIMIT',2,5),monthly:cap('AI_MONTHLY_LIMIT',30,100),global:cap('AI_GLOBAL_MONTHLY_LIMIT',30,1000)}}));
