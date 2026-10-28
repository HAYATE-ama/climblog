import {createDatabase} from './database.mjs';
import {freeModels,createProvider} from './provider.mjs';
import {createCoachHandler} from './handler.mjs';
const env=(key:string)=>Deno.env.get(key)||'';
const allowedUsers=env('AI_ALLOWED_USER_IDS').split(',').map(s=>s.trim()).filter(Boolean);
const model=env('GEMINI_MODEL')||'gemini-2.5-flash-lite';
const freeConfirmed=env('AI_FREE_TIER_CONFIRMED')==='true';
const cap=(key:string,fallback:number,max:number)=>{const n=Number(env(key)||fallback);return Number.isInteger(n)&&n>0&&n<=max?n:fallback;};
Deno.serve(createCoachHandler({db:createDatabase({url:env('SUPABASE_URL'),anonKey:env('SUPABASE_ANON_KEY'),serviceKey:env('SUPABASE_SERVICE_ROLE_KEY')}),provider:createProvider({key:env('GEMINI_API_KEY'),model}),allowedUsers,configured:Boolean(env('GEMINI_API_KEY')&&allowedUsers.length&&freeConfirmed&&freeModels.includes(model)),origins:['https://hayate-ama.github.io',...env('AI_ALLOWED_ORIGINS').split(',').map(s=>s.trim()).filter(Boolean)],limits:{daily:cap('AI_DAILY_LIMIT',2,2),monthly:cap('AI_MONTHLY_LIMIT',30,30),global:cap('AI_GLOBAL_MONTHLY_LIMIT',30,30)}}));
