// Local-only Supabase table mock. Never contacts a service or uses actual accounts.
export function createMockCloudTable(){
 const read=id=>JSON.parse(localStorage.getItem('__server:'+id)||'null');
 const write=row=>{localStorage.setItem('__writes',String(Number(localStorage.getItem('__writes')||0)+1));localStorage.setItem('__server:'+row.user_id,JSON.stringify(row));return {data:{updated_at:row.updated_at},error:null};};
 const failure=()=>localStorage.getItem('__failUpsert')?{data:null,error:{message:'offline',status:0}}:null;
 return {
  select:()=>({eq:(key,userId)=>({maybeSingle:()=>Promise.resolve({data:read(userId),error:null})})}),
  update:values=>{const filters={};const q={eq:(key,value)=>{filters[key]=value;return q;},select:()=>q,maybeSingle:async()=>{const error=failure();if(error)return error;const old=read(filters.user_id);if(!old||Date.parse(old.updated_at)!==Date.parse(filters.updated_at))return {data:null,error:null};return write({...old,user_id:filters.user_id,...values});}};return q;},
  insert:row=>{const q={select:()=>q,maybeSingle:async()=>{const error=failure();if(error)return error;if(read(row.user_id))return {data:null,error:{code:'23505'}};return write(row);}};return q;},
  upsert:async row=>failure()||write(row)
 };
}
