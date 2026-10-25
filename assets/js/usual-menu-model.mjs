import {workoutAsMenu} from './workout-model.mjs';
// Update by stable ID so renaming never creates another saved menu.
export function saveUsualMenu(menus,plan,editingId=null,createId=()=>crypto.randomUUID()){
 const normalized=workoutAsMenu(plan),old=editingId?menus.find(m=>m.id===editingId):null;if(editingId&&!old)throw new Error('元のメニューが見つかりません。メニュー一覧から開き直してください。');
 if(menus.some(m=>m.id!==editingId&&m.name.trim()===normalized.name))throw new Error('同じ名前のメニューがあります。別の名前を付けるか、一覧から既存メニューを開いて編集してください。');
 const saved={...old,id:old?.id||createId(),...normalized};return {saved,menus:old?menus.map(m=>m.id===old.id?saved:m):[...menus,saved]};
}
