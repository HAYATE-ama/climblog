// Separate identities allow repeated exercises to be edited independently.
export class RecordDrafts {
  constructor(createId = () => crypto.randomUUID()) { this.createId = createId; this.entries = []; }
  add(values) { const id=this.createId();this.entries.push({id,values:structuredClone(values)});return id; }
  get(id) { const entry=this.entries.find(item=>item.id===id);return entry?{id:entry.id,values:structuredClone(entry.values)}:null; }
  update(id,values) { const index=this.entries.findIndex(item=>item.id===id);if(index<0)return false;this.entries[index]={id,values:structuredClone(values)};return true; }
  remove(id) { const index=this.entries.findIndex(item=>item.id===id);if(index<0)return false;this.entries.splice(index,1);return true; }
  list() { return this.entries.map(entry=>({id:entry.id,values:structuredClone(entry.values)})); }
  clear() { this.entries=[]; }
  restore(entries) { const used=new Set();this.entries=(Array.isArray(entries)?entries:[]).filter(entry=>entry&&typeof entry.id==='string'&&!used.has(entry.id)&&entry.values&&typeof entry.values==='object'&&used.add(entry.id)).map(entry=>({id:entry.id,values:structuredClone(entry.values)})); }
  get size() { return this.entries.length; }
}
