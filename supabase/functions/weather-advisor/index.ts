import {createWeatherDatabase} from './database.mjs';
import {createWeatherProvider} from './provider.mjs';
import {createWeatherHandler} from './handler.mjs';
import {coachServerPolicy} from '../ai-coach/server-policy.mjs';
const env=(key:string)=>Deno.env.get(key)||'';
const policy=coachServerPolicy(env);
// Reuse the explicitly confirmed free model and allowlist. No model/billing fallback.
Deno.serve(createWeatherHandler({db:createWeatherDatabase({url:env('SUPABASE_URL'),anonKey:env('SUPABASE_ANON_KEY'),serviceKey:env('SUPABASE_SERVICE_ROLE_KEY')}),provider:createWeatherProvider({key:env('GEMINI_API_KEY'),model:policy.model}),configured:policy.configured&&policy.mode==='free',allowedUsers:policy.allowedUsers,monthlyLimit:Math.min(policy.limits.monthly,policy.limits.global),intervalMinutes:policy.limits.intervalMinutes,origins:['https://hayate-ama.github.io',...env('AI_ALLOWED_ORIGINS').split(',').map(s=>s.trim()).filter(Boolean)]}));
