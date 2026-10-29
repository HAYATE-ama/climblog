// Conditional writes protect a newer snapshot saved by another device.
// No extra read, schema change, retry, or privileged key is needed.
export function nextCloudVersion(baseUpdatedAt,now=Date.now()){
 const base=Date.parse(baseUpdatedAt);
 return new Date(Math.max(now,Number.isFinite(base)?base+1:0)).toISOString();
}
export async function saveCloudSnapshot({client,userId,payload,baseUpdatedAt=null,bounded=query=>query,now=Date.now()}){
 if(typeof userId!=='string'||!userId||baseUpdatedAt!==null&&!Number.isFinite(Date.parse(baseUpdatedAt)))throw new Error('同期元の記録を確認できません。');
 const updatedAt=nextCloudVersion(baseUpdatedAt,now),table=client.from('user_app_state');
 const query=baseUpdatedAt===null?table.insert({user_id:userId,payload,updated_at:updatedAt}):table.update({payload,updated_at:updatedAt}).eq('user_id',userId).eq('updated_at',baseUpdatedAt);
 const {data,error}=await bounded(query.select('updated_at').maybeSingle());
 if(error){if(error.code==='23505')return {conflict:true};throw error;}
 if(!data?.updated_at)return {conflict:true};
 return {conflict:false,updatedAt:data.updated_at};
}
