import {workoutPhases,finishWorkoutPhase} from './workout-model.mjs';
// Advance timed phases by their deadlines; repetition phases still require a user action.
export function advanceBackgroundWorkout(session,now=Date.now()){
 if(session?.status!=='running')return {session,changed:false,transitioned:false};
 let next=session,changed=false;const max=workoutPhases(session.plan).length;
 for(let n=0;n<max&&next.status==='running'&&next.endsAt!=null&&next.endsAt<=now;n++){
  const deadline=next.endsAt,late=now-deadline;next=finishWorkoutPhase(next,{now:deadline});if(late>3000)next.backgroundCatchup=true;changed=true;
 }
 return {session:next,changed,transitioned:changed};
}
// Bound ahead-of-time cues. These can run in the audio engine while JS timers are throttled,
// but the operating system can still suspend audio; no silent keep-alive loop is used.
export function backgroundWorkoutCues(session,now=Date.now()){
 if(session?.status!=='running'||session.endsAt==null)return [];
 const phases=workoutPhases(session.plan),out=[];let end=session.endsAt;
 for(let i=session.phaseIndex;i<phases.length&&out.length<64;i++){
  const phase=phases[i];if(phase.kind==='work'&&phase.mode==='reps')break;
  for(const second of [3,2,1]){const at=end-second*1000;if(at>now+50&&at-now<=1800000)out.push({kind:'countdown',delaySeconds:(at-now)/1000});}
  if(end>now+50&&end-now<=1800000){const next=phases[i+1];out.push({kind:!next?'complete':next.kind==='rest'?'rest':next.kind==='work'?'work':null,delaySeconds:(end-now)/1000});}
  const next=phases[i+1];if(!next||next.kind==='work'&&next.mode==='reps')break;end+=(next.kind==='work'?next.target:next.seconds)*1000;
 }
 return out.filter(c=>c.kind).slice(0,64);
}
