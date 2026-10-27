import {normalizeWorkoutPlan,validWorkoutDate} from './workout-model.mjs';
export class WorkoutSetupStore{
 constructor(storage,accountId){if(typeof accountId!=='string'||!accountId)throw new Error('下書きのアカウントが不正です。');this.storage=storage;this.key='climbLogWorkoutSetup:'+accountId;this.lastRaw=undefined;}
 normalize(raw){if(raw?.schemaVersion!==1||!validWorkoutDate(raw.date))throw new Error('編集中のメニューの形式が不正です。');return {schemaVersion:1,date:raw.date,plan:normalizeWorkoutPlan(raw.plan),sourceMenuId:typeof raw.sourceMenuId==='string'?raw.sourceMenuId:null,setupOrigin:['menu','create','templates'].includes(raw.setupOrigin)?raw.setupOrigin:'menu'};}
 read(){const raw=this.storage.getItem(this.key);this.lastRaw=raw;return raw===null?null:this.normalize(JSON.parse(raw));}
 write(value){const clean=this.normalize({...value,schemaVersion:1});this.checkUnchanged();const raw=JSON.stringify(clean);this.storage.setItem(this.key,raw);this.lastRaw=raw;return clean;}
 checkUnchanged(){const raw=this.storage.getItem(this.key);if(this.lastRaw===undefined?raw!==null:raw!==this.lastRaw){const error=new Error('別のタブでメニューの下書きが変更されました。再読み込みして最新の下書きを確認してください。');error.code='setupConflict';throw error;}}
 remove(){this.checkUnchanged();this.storage.removeItem(this.key);this.lastRaw=null;}
}
