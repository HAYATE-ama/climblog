import {getAdventureSummary} from './home-model.mjs';
// Original code-drawn pixel room and climber. No third-party artwork.
export function paintRoom(ctx,time=0,action='idle',keepsakes=0){
 const r=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);};ctx.imageSmoothingEnabled=false;
 r(0,0,320,192,'#262c42');r(8,8,304,130,'#c6ac88');for(let y=10;y<138;y+=16){r(8,y,304,1,'#af9477');for(let x=(y%32?12:36);x<310;x+=48)r(x,y,1,16,'#b89d7e');}
 r(0,138,320,54,'#665146');for(let y=139;y<192;y+=12){r(0,y,320,1,'#483d3c');for(let x=y%24?0:30;x<320;x+=60)r(x,y,1,12,'#8a6a50');}r(6,6,308,4,'#725c51');r(6,8,4,130,'#725c51');r(310,8,4,130,'#725c51');
 // Window, mountain and drifting clouds.
 r(111,23,92,78,'#594e50');r(115,27,84,70,'#a2c9ca');r(115,70,84,27,'#6f9996');for(let i=0;i<4;i++){const x=115+((i*25+Math.floor(time/12))%70);r(x,38+i%2*10,16,4,'#e6e5cc');}r(126,72,18,25,'#597b80');r(132,62,8,12,'#597b80');r(160,68,26,29,'#527780');r(169,55,9,16,'#527780');r(169,55,9,5,'#e7dfcb');r(154,27,3,70,'#6e5b50');r(115,61,84,3,'#6e5b50');r(108,98,98,5,'#81664e');
 // Training wall.
 r(20,21,73,111,'#665d5d');r(24,25,65,103,'#b3a182');for(let y=34;y<128;y+=16)for(let x=30;x<89;x+=16)r(x,y,1,1,'#756953');[[30,111,'#ed7950'],[55,98,'#91a7ac'],[76,82,'#eece6c'],[36,69,'#7e9e71'],[62,48,'#ed7950'],[39,32,'#eece6c']].forEach(([x,y,c])=>{r(x,y,9,4,c);r(x+2,y-2,5,2,c);});r(16,135,82,11,'#758c9d');r(18,146,78,3,'#43556c');
 // Desk, book, warm lamp, shelving, chalk bag.
 r(227,104,67,6,'#654b3b');r(232,110,5,35,'#624738');r(285,110,5,35,'#624738');r(247,96,21,7,'#f0dbae');r(256,96,1,7,'#a88265');r(279,86,3,18,'#775d43');r(272,84,17,5,'#edc771');r(276,79,10,5,'#f3d88e');r(224,43,69,5,'#73513c');r(231,27,7,16,'#678b8c');r(239,30,6,13,'#cb7859');r(246,25,8,18,'#d1b86b');r(265,33,16,10,'#87683c');r(270,26,6,7,'#efd37e');r(267,23,12,4,'#efd37e');
 // Plant, stool and rug.
 r(296,126,14,17,'#b96f51');r(301,109,3,18,'#607a51');r(291,112,12,5,'#7d9b63');r(303,104,10,5,'#8aa96a');r(111,157,103,23,'#b17964');r(116,160,93,17,'#d5ae7e');r(120,163,85,1,'#a4775e');r(120,173,85,1,'#a4775e');r(242,132,24,6,'#8d6d51');r(246,138,4,15,'#685143');r(258,138,4,15,'#685143');
 if(keepsakes>0){r(212,57,9,12,'#e7c369');r(215,60,3,6,'#f9e6b2');}if(keepsakes>2){r(100,111,12,18,'#d69360');r(102,113,8,6,'#e6c4a0');}if(keepsakes>4){r(216,16,20,14,'#826651');r(219,19,14,8,'#a7c6bc');}
 let x=149,y=111;const phase=Math.floor(time/4)%2;if(action==='climb'){x=49;y=63+phase*2;}if(action==='write'){x=229;y=94;}if(action==='rest'){x=148;y=113;}if(action==='celebrate')y-=phase*5;
 ctx.save();ctx.translate(x,y);ctx.scale(1.5,1.5);x=0;y=0;
 // Small climber, orange cap, chalk bag, loose trousers.
 r(x+2,y,12,4,'#d95d31');r(x,y+4,18,3,'#ee8b43');r(x+3,y+7,11,10,'#e6b587');r(x+12,y+9,2,2,'#3e3d45');r(x+1,y+7,4,6,'#684b3d');r(x+3,y+17,11,12,'#e39a51');r(x+1,y+20,3,9,'#bf7446');r(x+4,y+29,5,10,'#546f7d');r(x+10,y+29,5,10,'#546f7d');r(x+2,y+38,7,3,'#353d4c');r(x+10,y+38,7,3,'#353d4c');r(x-2,y+24,5,7,'#ebe0bd');r(x+14,y+(action==='celebrate'?9:20),3,action==='celebrate'?12:9,'#e6b587');if(action==='climb')r(x+11,y-4,3,12,'#e6b587');
 if(action==='celebrate'){r(x-5,y-10,3,5,'#f0d57f');r(x-6,y-9,5,2,'#f0d57f');r(x+23,y-1,3,5,'#f0d57f');}if(action==='write')r(x+14,y+23+phase,9,2,'#f0dbaa');if(action==='rest'){r(x+20,y-8,5,2,'#f0dbaa');r(x+24,y-12,5,2,'#f0dbaa');}
 ctx.restore();
 // Original little bird companion.
 r(198,137,10,7,'#d6c5a3');r(204,133,7,7,'#c5b18a');r(209,135,2,2,'#303747');r(211,138,4,2,'#d5944e');r(198,141,3,5,'#a78962');r(202,144,2,3,'#725b49');
}
export function installPixelCompanion(){let canvas=null,raf=0,last=0,frame=0,action='idle',until=0,keepsakes=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)'),messages={idle:'おかえり。今日はどんな一手があった？',celebrate:'記録できたね！小さな発見も、次の力になる。',write:'今日の気づき、ノートに残しておこう。',rest:'ひと息つこう。休む時間も、大切なトレーニング。',climb:'次の一手を考え中。君のペースで進もう。'};
 function speech(){const el=document.getElementById('companionSpeech');if(el)el.textContent=messages[action]||messages.idle;}
 function loop(now){if(!canvas?.isConnected)return;raf=requestAnimationFrame(loop);if(document.hidden||document.getElementById('homeView').hidden||now-last<100)return;last=now;if(until&&Date.now()>until){action='idle';until=0;speech();}paintRoom(canvas.getContext('2d'),reduced.matches?0:frame++,action,keepsakes);}
 function mount(){cancelAnimationFrame(raf);canvas=document.getElementById('pixelRoom');frame=0;const state=window.climbLogStateApi.get();keepsakes=getAdventureSummary(state.records,state.goals,new Date().toLocaleDateString('sv-SE')).earnedCount;if(canvas){speech();raf=requestAnimationFrame(loop);}}
 window.addEventListener('climblog:homeRendered',mount);window.addEventListener('climblog:companion',e=>{action=e.detail;until=['celebrate','write','climb'].includes(action)?Date.now()+6000:0;speech();});window.addEventListener('climblog:recordSaved',e=>{action='celebrate';until=Date.now()+6000;speech();let toast=document.getElementById('recordCelebration');if(!toast){toast=document.createElement('div');toast.id='recordCelebration';toast.className='recordCelebration';toast.setAttribute('role','status');document.body.append(toast);}toast.textContent=e.detail?.isNew?'✦ 記録をノートに残しました！':'✦ 記録を更新しました';toast.hidden=false;clearTimeout(toast.hideTimer);toast.hideTimer=setTimeout(()=>toast.hidden=true,4000);});document.addEventListener('click',e=>{if(e.target.closest('[data-talk-companion]')){action=action==='climb'?'idle':'climb';until=Date.now()+6000;speech();}});mount();}
