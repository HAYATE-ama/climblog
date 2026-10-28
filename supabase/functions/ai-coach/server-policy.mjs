import {freeModels,defaultGeminiModel} from './provider.mjs';
export function coachServerPolicy(env){
 const mode=env('AI_USAGE_MODE')||'free',model=env('GEMINI_MODEL')||defaultGeminiModel;
 const confirmed=mode==='free'?env('AI_FREE_TIER_CONFIRMED')==='true':mode==='paid'&&env('AI_PAID_DATA_CONFIRMED')==='true';
 const cap=(name,fallback,max)=>{const n=Number(env(name)||fallback);return Number.isInteger(n)&&n>=1&&n<=max?n:fallback;};
 const allowedUsers=(env('AI_ALLOWED_USER_IDS')||'').split(',').map(s=>s.trim()).filter(Boolean);
 return {mode,model,allowedUsers,configured:Boolean(env('GEMINI_API_KEY')&&confirmed&&allowedUsers.length&&freeModels.includes(model)),limits:{daily:cap('AI_DAILY_LIMIT',2,2),monthly:cap('AI_MONTHLY_LIMIT',30,30),global:cap('AI_GLOBAL_MONTHLY_LIMIT',30,30),intervalMinutes:cap('AI_MIN_INTERVAL_MINUTES',1,60)}};
}
