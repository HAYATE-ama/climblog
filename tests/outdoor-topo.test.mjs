import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarkHistory,emptyMarks,validateMarks,validateTopos,createTopo,toposForProblem} from '../assets/js/outdoor-topo-model.mjs';
import {validateBackup,mergeBackup} from '../assets/js/backup-model.mjs';
import {readTopos} from '../assets/js/outdoor-topo-store.mjs';
const problem={cragName:'検証岩場',routeName:'検証課題',outdoorGrade:'二段'};
const photoId='photo-'+'a'.repeat(64);
test('Topo undo/redo preserves separate gestures, notes and branching edits',()=>{
 const h=createMarkHistory(),a={...emptyMarks(),line:[[.1,.8],[.3,.5]]},b={...a,start:[.1,.8]},c={...b,goal:[.6,.2],note:'足位置'};
 assert.equal(h.canUndo(),false);h.change(a);h.change(b);h.change(c);
 assert.deepEqual(h.undo(),b);assert.deepEqual(h.undo(),a);assert.deepEqual(h.redo(),b);assert.deepEqual(h.redo(),c);
 h.undo();h.change({...b,note:'変更後'});assert.equal(h.canRedo(),false);assert.equal(h.redo().note,'変更後');
 const snapshot=h.get();snapshot.line.push([1,1]);assert.equal(h.get().line.length,2);
 assert.equal(h.change(h.get()),false);
});
test('Marks reject non-finite, off-image, oversized and script-like shapes',()=>{
 for(const patch of [{line:[[NaN,.1]]},{start:[-1,0]},{goal:[1,2]},{line:Array.from({length:301},()=>[0,0])},{note:'a'.repeat(1001)},{line:'<svg>'}])assert.throws(()=>validateMarks({...emptyMarks(),...patch}));
 assert.equal(validateMarks({...emptyMarks(),note:'<img src=x>'}).note,'<img src=x>');
});
test('Topo identity follows rock, area, problem and discipline, not grade',()=>{
 const row=createTopo(problem,photoId);assert.equal(validateTopos([row]).length,1);
 assert.equal(toposForProblem([row],{...problem,outdoorGrade:'三段'}).length,1);
 for(const patch of [{cragName:'別岩場'},{areaName:'別エリア'},{routeName:'別課題'},{discipline:'lead'}])assert.equal(toposForProblem([row],{...problem,...patch}).length,0);
 assert.throws(()=>validateTopos([row,{...row,id:'another'}]),/重複/);
 assert.throws(()=>readTopos({getItem:()=>'{broken'}));
});
test('Old backups preserve topo data; merged copies preserve identity and explicit overwrite',()=>{
 const row=createTopo(problem,photoId),current={records:[],outdoorTopos:[row]};
 assert.equal(mergeBackup(current,validateBackup({records:[]})).patch.outdoorTopos,undefined);
 const imported={...row,id:'from-another-device',marks:{...row.marks,note:'別端末から'}};
 assert.equal(validateBackup({records:[],outdoorTopos:[imported],topoPhotos:[]}).topoPhotos,undefined,'binary must not reach account/localStorage patch');
 const merged=mergeBackup(current,{records:[],outdoorTopos:[imported]});assert.deepEqual(merged.patch.outdoorTopos,[row]);
 const overwritten=mergeBackup(current,{records:[],outdoorTopos:[imported]},{overwrite:true}).patch.outdoorTopos;
 assert.equal(overwritten[0].id,row.id);assert.equal(overwritten[0].marks.note,'別端末から');
 assert.throws(()=>validateBackup({records:[],outdoorTopos:[{...row,photoId:'https://example.com/private.jpg'}]}));
});
