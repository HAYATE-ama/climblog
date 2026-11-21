import {accountKeys} from './account-storage.mjs';
import {validateTopos,validPhotoId} from './outdoor-topo-model.mjs';

const databaseName='climblog-topo-photos-v1',maxPhotoBytes=4*1024*1024;
export function readTopos(storage=localStorage){return validateTopos(JSON.parse(storage.getItem(accountKeys.outdoorTopos)||'[]'));}
function ownerKey(owner,id){if(typeof owner!=='string'||!owner||!validPhotoId(id))throw new Error('写真の保存先を確認できません。アプリを開き直してください。');return [owner,id];}
async function database(){
 return new Promise((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>request.result.createObjectStore('photos');request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};request.onerror=()=>reject(new Error('写真用の保存領域を開けません。端末の空き容量とブラウザー設定を確認してください。'));request.onblocked=()=>reject(new Error('別のClimbLog画面を閉じて、もう一度お試しください。'));});
}
async function transact(mode,action){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('photos',mode);let result;tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(new Error('写真を保存・取得できませんでした。端末の空き容量を確認してください。'));tx.onerror=()=>{};action(tx.objectStore('photos'),value=>result=value);});}finally{db.close();}}
export async function getTopoPhoto(owner,id){return transact('readonly',(store,done)=>{store.get(ownerKey(owner,id)).onsuccess=e=>done(e.target.result||null);});}
export async function photoIdFor(blob){const bytes=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return 'photo-'+Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');}
export async function putTopoPhotos(owner,photos){
 for(const [id,blob] of photos){ownerKey(owner,id);if(!(blob instanceof Blob)||blob.type!=='image/jpeg'||blob.size>maxPhotoBytes||await photoIdFor(blob)!==id)throw new Error('写真データが一致しません。');}
 if(photos.size)await transact('readwrite',store=>{for(const [id,blob] of photos)store.put(blob,ownerKey(owner,id));});
}
function loadImage(blob){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('この写真を開けません。JPEG・PNG・WebPの写真を選んでください。'));};img.src=url;});}
export async function optimizeTopoPhoto(file){
 if(!file||!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type))throw new Error('写真ファイルを選んでください。JPEG・PNG・WebPに対応しています。');
 if(!file.size||file.size>30*1024*1024)throw new Error('30MB以下の写真を選んでください。');
 const img=await loadImage(file),scale=Math.min(1,1920/Math.max(img.naturalWidth,img.naturalHeight));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));canvas.width=canvas.height=1;
 if(!blob||blob.size>maxPhotoBytes)throw new Error('写真を保存用に変換できませんでした。小さい写真をお試しください。');
 return {id:await photoIdFor(blob),blob};
}
async function dataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('写真の書き出しに失敗しました。'));reader.readAsDataURL(blob);});}
export async function withTopoBackup(payload,owner){
 const rows=validateTopos(payload.outdoorTopos||[]),photos=[];let bytes=0;
 for(const id of new Set(rows.map(r=>r.photoId))){const blob=await getTopoPhoto(owner,id);if(!blob)throw new Error('保存済みの写真が見つかりません。写真を含むバックアップから復元してください。');bytes+=blob.size;if(bytes>65*1024*1024)throw new Error('写真が多いためJSONにまとめられません（写真合計65MBまで）。現在の記録は保持されています。');photos.push({id,dataUrl:await dataUrl(blob)});}
 return photos.length?{...payload,topoPhotos:photos}:payload;
}
// Validate without writing. Restore stores immutable photos before committing links.
export async function prepareTopoImport(value,owner){
 const rows=validateTopos(value.outdoorTopos||[]),needed=new Set(rows.map(r=>r.photoId)),photos=new Map();
 if(value.topoPhotos!=null&&!Array.isArray(value.topoPhotos))throw new Error('バックアップの写真一覧が不正です。');
 for(const asset of value.topoPhotos||[]){
  if(!asset||!validPhotoId(asset.id)||photos.has(asset.id)||typeof asset.dataUrl!=='string'||asset.dataUrl.length>Math.ceil(maxPhotoBytes*4/3)+50||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(asset.dataUrl))throw new Error('バックアップの写真形式を確認してください。');
  const binary=atob(asset.dataUrl.split(',')[1]),blob=new Blob([Uint8Array.from(binary,c=>c.charCodeAt(0))],{type:'image/jpeg'});
  if(await photoIdFor(blob)!==asset.id)throw new Error('バックアップの写真データが一致しません。');
  const img=await loadImage(blob);if(img.naturalWidth>1920||img.naturalHeight>1920)throw new Error('バックアップの写真サイズが不正です。');
  photos.set(asset.id,blob);
 }
 for(const id of needed)if(!photos.has(id)&&!await getTopoPhoto(owner,id))throw new Error('写真が不足しています。写真を含むJSONバックアップを選んでください。');
 return new Map([...photos].filter(([id])=>needed.has(id)));
}
