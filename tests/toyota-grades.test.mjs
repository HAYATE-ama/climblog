import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeSystemsFor,gradeOptionsFor,toyotaGradeSystem,preferredOutdoorSystem,withOutdoorGradeFormat,compareOutdoorGrades,outdoorGradeGroup} from '../assets/js/outdoor-grades.mjs';
import {outdoorDanSummary} from '../assets/js/outdoor-season.mjs';
import {buildOutdoorCharts} from '../assets/js/outdoor-stats-model.mjs';
import {validateBackup,mergeBackup} from '../assets/js/backup-model.mjs';
import {coachingReport} from '../assets/js/coaching-report.mjs';
test('Toyota is an explicit boulder system with lowercase defaults and no grade conversion',()=>{
 assert.ok(gradeSystemsFor('boulder').includes(toyotaGradeSystem));assert.ok(!gradeSystemsFor('lead').includes(toyotaGradeSystem));
 assert.deepEqual(gradeOptionsFor('boulder',toyotaGradeSystem),['a','b','c','d','e','f','g']);
 assert.equal(preferredOutdoorSystem(' 豊田 ','boulder'),toyotaGradeSystem);assert.equal(preferredOutdoorSystem('豊田','lead'),'YDS / デシマル');
 assert.equal(preferredOutdoorSystem('恵那','boulder'),'日本（段級）');assert.equal(preferredOutdoorSystem('豊田ではない岩場','boulder'),'日本（段級）');
 assert.equal(outdoorGradeGroup({grade:'f'}),'体系未設定','bare historical labels must not be silently reclassified');
});
test('Remembered formats are scoped to crag and discipline and survive optional backup settings',()=>{
 const initial={theme:'light'},prefs=withOutdoorGradeFormat(initial,{cragName:'豊田',discipline:'boulder',gradeSystem:'日本（段級）'});
 assert.deepEqual(initial,{theme:'light'});assert.equal(preferredOutdoorSystem('豊田','boulder',prefs),'日本（段級）');
 const other=withOutdoorGradeFormat(prefs,{cragName:'別表記の岩場',discipline:'boulder',gradeSystem:toyotaGradeSystem});
 assert.equal(preferredOutdoorSystem('別表記の岩場','boulder',other),toyotaGradeSystem);assert.equal(preferredOutdoorSystem('別表記の岩場','lead',other),'YDS / デシマル');
 const incoming=validateBackup({records:[],preferences:other});assert.deepEqual(mergeBackup({records:[]},incoming,{settings:true}).patch.preferences,other);
 assert.equal(mergeBackup({records:[]},incoming).patch.preferences,undefined);
 assert.throws(()=>validateBackup({records:[],preferences:{outdoorGradeFormats:[{cragName:'豊田',discipline:'lead',system:toyotaGradeSystem}]}}));
});
test('Toyota charts count ascents separately and never add dan points, including custom labels',()=>{
 const range={from:'2026-11-01',to:'2026-11-30'};
 const rows=['f','f+','g','h','d','f-'].map((grade,i)=>({id:'toyota-'+i,kind:'outdoor',date:'2026-11-21',cragName:'豊田',routeName:'検証'+i,discipline:'boulder',gradeSystem:toyotaGradeSystem,grade,outdoorGrade:grade,result:'send',ascentType:'new'}));
 rows.push({...rows[0],id:'jp',cragName:'恵那',gradeSystem:'日本（段級）',grade:'二段',outdoorGrade:'二段'});
 const before=structuredClone(rows),dan=outdoorDanSummary(rows,range),charts=buildOutdoorCharts(rows,range,dan,'2026-11-21');
 assert.equal(dan.newDan,2);assert.equal(dan.newProblems,7);assert.equal(charts.systems.length,2);assert.equal(charts.highest,'二段');
 assert.deepEqual(charts.grades.filter(g=>g.system===toyotaGradeSystem).map(g=>g.label),['h','g','f+','f','f-','d']);
 assert.deepEqual(rows,before);assert.ok(compareOutdoorGrades(rows[0],rows[1])<0);
});
test('Consultation export and restore retain the explicit Toyota scale without photos or location sharing',()=>{
 const row={id:'toyota-test',date:'2026-11-21',kind:'outdoor',discipline:'boulder',gradeSystem:toyotaGradeSystem,grade:'f+',outdoorGrade:'f+',cragName:'豊田',result:'send',ascentType:'new'};
 const restored=validateBackup({records:[row]});assert.deepEqual(restored.records,[row]);
 const report=coachingReport(restored,{from:'2026-11-01',to:'2026-11-30'}).payload.records[0];assert.equal(report.gradeSystem,toyotaGradeSystem);assert.equal(report.outdoorGrade,'f+');assert.equal(report.cragName,undefined);
});
