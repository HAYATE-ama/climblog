import {clone,stableJson,newId} from './data-utils.mjs';
const comparable=row=>{const {updatedAt,createdAt,...rest}=row;return rest;};
export function historyEntry(action,before,after,now=new Date().toISOString(),id=newId()){return {id,recordId:(after||before).id,action,before:clone(before),after:clone(after),changedAt:now};}
export function prepareRecordCommit(records,entries,{editingId=null,date,history=[],now=new Date().toISOString(),createId=newId}={}){
  if(!entries.length)throw new Error('記録する項目がありません。');
  const next=clone(records),changes=clone(history),ids=[];
  if(editingId){if(entries.length!==1)throw new Error('編集中の記録は1件ずつ更新してください。');const index=next.findIndex(row=>row.id===editingId);if(index<0)throw new Error('編集中の記録が見つかりません。');const before=next[index],after={...before,...clone(entries[0]),id:before.id,date:before.date,updatedAt:now};if(stableJson(comparable(before))!==stableJson(comparable(after)))changes.push(historyEntry('edit',before,after,now,createId()));next[index]=after;ids.push(after.id);}
  else for(const values of entries){const row={...clone(values),id:createId(),date,createdAt:now,updatedAt:now};next.push(row);ids.push(row.id);}
  return {records:next,recordHistory:changes,recordIds:ids,isNew:!editingId};
}
export function moveToTrash(records,trash,history,id,now=new Date().toISOString()){
  const row=records.find(item=>item.id===id);if(!row)throw new Error('記録が見つかりません。');return {records:records.filter(item=>item.id!==id),recycleBin:[...clone(trash),{id:newId(),record:clone(row),deletedAt:now}],recordHistory:[...clone(history),historyEntry('delete',row,null,now)]};
}
export function restoreTrash(records,trash,history,entryId,now=new Date().toISOString()){
  const entry=trash.find(item=>item.id===entryId);if(!entry)throw new Error('ゴミ箱の記録が見つかりません。');if(records.some(row=>row.id===entry.record.id))throw new Error('同じIDの記録がすでにあります。');const row={...clone(entry.record),updatedAt:now};return {records:[...clone(records),row],recycleBin:trash.filter(item=>item.id!==entryId),recordHistory:[...clone(history),historyEntry('restore',null,row,now)]};
}
export function rollbackRecord(records,trash,history,historyId,now=new Date().toISOString()){
  const entry=history.find(item=>item.id===historyId),version=entry?.before||entry?.after;if(!version)throw new Error('復元できる内容がありません。');const before=records.find(row=>row.id===version.id)||null,after={...clone(version),updatedAt:now};return {records:[...records.filter(row=>row.id!==after.id),after],recycleBin:trash.filter(item=>item.record.id!==after.id),recordHistory:[...clone(history),historyEntry('rollback',before,after,now)]};
}
