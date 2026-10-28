import {createDatabase} from './database.mjs';
import {createProvider} from './provider.mjs';
import {createCoachHandler} from './handler.mjs';
import {coachServerPolicy} from './server-policy.mjs';
const env=(key:string)=>Deno.env.get(key)||'';
const policy=coachServerPolicy(env);
Deno.serve(createCoachHandler({...policy,db:createDatabase({url:env('SUPABASE_URL'),anonKey:env('SUPABASE_ANON_KEY'),serviceKey:env('SUPABASE_SERVICE_ROLE_KEY')}),provider:createProvider({key:env('GEMINI_API_KEY'),model:policy.model}),origins:['https://hayate-ama.github.io',...env('AI_ALLOWED_ORIGINS').split(',').map(s=>s.trim()).filter(Boolean)]}));
