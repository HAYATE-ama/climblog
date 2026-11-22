import test from 'node:test';
import assert from 'node:assert/strict';
import {outdoorRouteLibrary,filterOutdoorRoutes} from '../assets/js/outdoor-route-library.mjs';
const wish={id:'w1',cragName:'豊田',routeName:'テスト',areaName:'',discipline:'boulder',gradeSystem:'豊田式（a・b・c…）',outdoorGrade:'f',starred:true};
const record={...wish,id:'r1',kind:'outdoor',date:'2026-11-20',result:'attempt',tries:2};
test('library combines existing sources without changing them; multiple same-day entries count as one day',()=>{
 const state={records:[record,{...record,id:'r2',result:'send'},{...record,id:'r3',date:'2026-11-21'}],outdoorWishlist:[wish]};const before=structuredClone(state);
 const {routes}=outdoorRouteLibrary(state);assert.equal(routes.length,1);assert.equal(routes[0].records.length,3);assert.equal(routes[0].days,2);assert.equal(routes[0].sendDays,1);assert.equal(routes[0].status,'sent');assert.equal(routes[0].latest.id,'r3');assert.equal(routes[0].problem.gradeSystem,wish.gradeSystem);assert.deepEqual(state,before);
 assert.equal(outdoorRouteLibrary({records:[record]}).routes[0].status,'trying');assert.equal(outdoorRouteLibrary({outdoorWishlist:[wish]}).routes[0].status,'new');
});
test('same names in different crags, areas and disciplines stay separate; only an explicit matching wish link bridges a later area',()=>{
 const rows=[record,{...record,id:'r2',cragName:'別の岩場'},{...record,id:'r3',areaName:'南面'},{...record,id:'r4',discipline:'lead'}];
 assert.equal(outdoorRouteLibrary({records:rows,outdoorWishlist:[wish]}).routes.length,4);
 const linked={...record,areaName:'南面',outdoorWishId:'w1'};assert.equal(outdoorRouteLibrary({records:[linked],outdoorWishlist:[wish]}).routes.length,1);
 assert.equal(outdoorRouteLibrary({records:[{...linked,routeName:'別の課題'}],outdoorWishlist:[wish]}).routes.length,2);
});
test('photo-only routes remain reachable and linked area photos are associated without deleting or migrating data',()=>{
 const topo={id:'t1',problem:{...wish,areaName:'南面'}};
 const state={records:[{...record,areaName:'南面',outdoorWishId:'w1'}],outdoorWishlist:[wish],outdoorTopos:[topo]};
 assert.equal(outdoorRouteLibrary(state).routes[0].topos[0].id,'t1');
 const photoOnly=outdoorRouteLibrary({outdoorTopos:[topo]}).routes[0];assert.equal(photoOnly.status,'new');assert.equal(photoOnly.wish,null);assert.equal(photoOnly.problem.areaName,'南面');
});
test('all, wish, trying, sent and normalized search filters are independent; unnamed records are not silently grouped',()=>{
 const {routes,unnamedRecords}=outdoorRouteLibrary({records:[record,{...record,id:'done',routeName:'完登課題',result:'flash'}, {...record,id:'blank',routeName:''},{id:'gym',kind:'gym'}],outdoorWishlist:[wish]});
 assert.equal(unnamedRecords,1);assert.equal(routes.length,2);
 assert.equal(filterOutdoorRoutes(routes,{status:'wish'}).length,1);assert.equal(filterOutdoorRoutes(routes,{status:'sent'}).length,1);assert.equal(filterOutdoorRoutes(routes,{status:'trying'}).length,1);
 assert.equal(filterOutdoorRoutes(routes,{query:'豊田　ﾃｽﾄ Ｆ'}).length,1);assert.equal(filterOutdoorRoutes(routes,{crag:'別'}).length,0);
 assert.equal(outdoorRouteLibrary({records:[{...record,tries:0,result:null}]}).routes[0].status,'recorded');
});
