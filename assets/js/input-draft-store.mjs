// Unfinished input stays on this browser and is isolated by authenticated account.
export class InputDraftStore {
  constructor(storage,accountId){this.storage=storage;this.key=`climbLogInputDrafts:${encodeURIComponent(accountId)}`;}
  read(){try{const value=JSON.parse(this.storage.getItem(this.key)||'null');return value?.version===1&&Array.isArray(value.drafts)?value.drafts.filter(row=>row&&typeof row.key==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&row.form&&typeof row.form==='object'):[];}catch{return [];}}
  list(){return this.read().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));}
  get(key){return this.read().find(row=>row.key===key)||null;}
  save(draft){const drafts=this.read().filter(row=>row.key!==draft.key);drafts.push({...draft,updatedAt:new Date().toISOString()});this.storage.setItem(this.key,JSON.stringify({version:1,drafts}));}
  remove(key){const drafts=this.read().filter(row=>row.key!==key);if(drafts.length)this.storage.setItem(this.key,JSON.stringify({version:1,drafts}));else this.storage.removeItem(this.key);}
}
