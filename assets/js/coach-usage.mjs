// No API requests here. Server time is used for display; SQL remains authoritative.
export function coachUsage({rows=[],latestAt=null,globalCount=0,limits,day,now=new Date()}){
 const today=rows.filter(r=>r.plan_date===day).length,month=rows.length;
 const next=Date.parse(latestAt),nextAvailableAt=Number.isFinite(next)?new Date(next+limits.intervalMinutes*60000).toISOString():null;
 return {day,serverNow:now.toISOString(),today,month,dailyLimit:limits.daily,monthlyLimit:limits.monthly,globalMonthlyLimit:limits.global,remainingToday:Math.max(0,limits.daily-today),remainingMonth:Math.max(0,limits.monthly-month),remainingGlobalMonth:Math.max(0,limits.global-globalCount),intervalMinutes:limits.intervalMinutes,nextAvailableAt};
}
export function usageBlock(usage,now=Date.now(),day=null){
 if(!usage)return {blocked:false,seconds:0};
 if(day&&usage.day&&day!==usage.day)return {blocked:true,seconds:0,code:'REFRESH_REQUIRED'};
 if(usage.remainingToday===0)return {blocked:true,seconds:0,code:'DAILY_LIMIT'};
 if(usage.remainingMonth===0||usage.remainingGlobalMonth===0)return {blocked:true,seconds:0,code:'MONTHLY_LIMIT'};
 const seconds=Math.max(0,Math.ceil((Date.parse(usage.nextAvailableAt)-now)/1000))||0;
 return {blocked:seconds>0,seconds,code:seconds?'RATE_LIMIT':null};
}
