export function normalizeNarrativeGoals(value={}){
  value=value&&typeof value==='object'?value:{};
  return {focus:typeof value.focus==='string'?value.focus:'',plan:typeof value.plan==='string'?value.plan:'',reflection:typeof value.reflection==='string'?value.reflection:'',status:['active','reviewing','achieved'].includes(value.status)?value.status:'active',...(typeof value.updatedAt==='string'?{updatedAt:value.updatedAt}:{})};
}
