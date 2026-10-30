// Original pixel landscape. The four small cached backdrops contain no user data.
const palettes={
 morning:{sky:['#e8bd9c','#efcfad','#f1dfbf','#dbe1ce'],sun:'#ffe7ac',far:'#b3b9ad',ridge:'#91aaa5',near:'#6a8983',snow:'#efdfbf',water:'#a8c8b9',ripple:'#cbd9c1',forest:'#507569',grass:'#526c54',ground:'#394f43',path:'#b6a284',cloud:'#f9e5c8',rock:'#7c8c88',shade:'#5a6e6c'},
 day:{sky:['#b6cfd0','#c9d9d2','#e0e3cf','#e8e7d2'],sun:'#f8e6af',far:'#a5bbb6',ridge:'#7e9e9e',near:'#5c8280',snow:'#f1e9d1',water:'#8eb7ae',ripple:'#c2d4bd',forest:'#456e60',grass:'#617957',ground:'#405b43',path:'#c2b18b',cloud:'#f0edda',rock:'#82918a',shade:'#5e7772'},
 evening:{sky:['#aa91a0','#c7a0a4','#e2b5a5','#ebc9af'],sun:'#f5d3a2',far:'#9a98a5',ridge:'#787f95',near:'#566b80',snow:'#e6c7b7',water:'#8e9fa7',ripple:'#d2b6ac',forest:'#3e605e',grass:'#59694f',ground:'#354e43',path:'#b4a087',cloud:'#e9c5b4',rock:'#7a8384',shade:'#53676d'},
 night:{sky:['#202e48','#2b3c56','#3a4d64','#536575'],sun:'#eee2b6',far:'#576e7d',ridge:'#415d6b',near:'#304c5d',snow:'#9cb2b7',water:'#3c6470',ripple:'#63868a',forest:'#253f43',grass:'#3b5147',ground:'#263e37',path:'#7d8772',cloud:'#64778b',rock:'#566d70',shade:'#354d54'}
};
const cache=new Map();
function brushes(ctx){
 const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
 const polygon=(points,c)=>{const top=Math.ceil(Math.min(...points.map(p=>p[1]))),bottom=Math.ceil(Math.max(...points.map(p=>p[1])));for(let y=top;y<bottom;y++){const hits=[];for(let i=0;i<points.length;i++){const [x1,y1]=points[i],[x2,y2]=points[(i+1)%points.length];if(y1<=y&&y2>y||y2<=y&&y1>y)hits.push(x1+(y-y1)*(x2-x1)/(y2-y1));}hits.sort((a,b)=>a-b);for(let i=0;i+1<hits.length;i+=2)rect(Math.ceil(hits[i]),y,Math.floor(hits[i+1])-Math.ceil(hits[i])+1,1,c);}};
 const disc=(x,y,size,c)=>{for(let dy=-size;dy<=size;dy++){const w=Math.floor(Math.sqrt(size*size-dy*dy));rect(x-w,y+dy,w*2+1,1,c);}};
 return {rect,polygon,disc};
}
function background(ctx,period){const p=palettes[period],{rect:r,polygon:poly,disc}=brushes(ctx);
 for(let i=0;i<4;i++)r(0,i*26,320,28,p.sky[i]);r(0,104,320,88,p.water);
 disc(245,37,13,p.sun);if(period==='night'){disc(250,32,12,p.sky[0]);for(const [x,y]of [[22,19],[62,35],[97,15],[146,29],[185,17],[286,24],[306,52],[220,65]]){r(x,y,1,1,'#cbd6d0');}r(182,15,1,5,'#cbd6d0');r(180,17,5,1,'#cbd6d0');}
 poly([[0,98],[30,78],[67,45],[104,88],[154,33],[210,93],[253,56],[320,103],[320,126],[0,126]],p.far);
 poly([[125,67],[154,33],[183,68],[170,61],[161,64],[154,56],[149,61],[142,58]],p.snow);
 poly([[42,72],[67,45],[91,75],[75,65],[68,69],[61,61],[57,68]],p.snow);
 poly([[0,115],[23,95],[63,66],[106,107],[141,92],[179,62],[230,112],[272,82],[320,113],[320,132],[0,132]],p.ridge);
 poly([[0,122],[41,106],[71,111],[111,100],[155,122],[212,105],[244,116],[286,101],[320,113],[320,136],[0,136]],p.near);
 r(0,126,320,3,p.water);r(75,132,179,1,p.ripple);r(103,139,99,1,p.ripple);r(216,133,57,1,p.ripple);
 // Small stands of conifers give the lake its scale.
 const pine=(x,y,h,c)=>{poly([[x,y],[x-h/3,y+h*.6],[x-h/6,y+h*.6],[x-h*.46,y+h],[x+h*.46,y+h],[x+h/6,y+h*.6],[x+h/3,y+h*.6]],c);r(x-1,y+h,2,5,c);};
 for(let i=0;i<12;i++)pine(i*13-6,111+(i%3)*3,10+(i*7)%13,p.forest);for(let i=0;i<8;i++)pine(235+i*13,112+(i%2)*4,13+(i*5)%11,p.forest);
 poly([[0,147],[40,140],[100,151],[173,145],[229,150],[274,139],[320,143],[320,192],[0,192]],p.grass);
 poly([[0,171],[40,163],[96,175],[155,162],[220,176],[276,163],[320,169],[320,192],[0,192]],p.ground);
 poly([[113,192],[139,175],[163,166],[180,148],[191,148],[183,167],[163,179],[151,192]],p.path);
 // A canvas tent, rope, warm entrance and rolled sleeping mat.
 poly([[29,157],[65,112],[106,157]],'#ae8d65');poly([[65,112],[93,119],[121,159],[106,157]],'#837758');poly([[33,155],[65,116],[101,155]],'#d9ba85');poly([[65,118],[68,155],[46,155]],period==='night'?'#7b613e':'#806b4c');poly([[65,118],[89,155],[68,155]],'#ebcb8b');r(29,157,78,3,'#54614d');r(35,159,77,2,'#303f36');r(64,110,2,6,'#e8d8ac');poly([[17,159],[32,135],[32,139],[19,159]],'#c3b68d');r(16,158,3,5,'#b9ab88');r(109,158,3,4,'#b9ab88');
 r(22,165,39,5,'#80908b');r(24,164,35,1,'#adb6a5');r(25,170,34,2,'#3f5d57');
 // A boulder on the other side of camp, with small readable cracks.
 poly([[256,162],[251,142],[260,119],[286,111],[307,120],[315,143],[306,163]],p.rock);poly([[285,113],[307,122],[315,143],[306,163],[285,161],[296,143]],p.shade);r(263,126,14,2,p.snow);r(260,130,7,2,p.snow);r(276,137,12,2,p.shade);r(275,137,2,13,p.shade);r(265,150,10,2,p.shade);r(298,130,3,13,p.rock);
 // Stump, backpack, lantern and a few wildflowers. No record-dependent trophies.
 r(127,160,17,4,'#b69c73');r(130,164,12,10,'#806f50');r(130,164,2,8,'#c1a879');r(118,149,8,14,'#547976');r(120,147,4,3,'#d3c297');r(120,153,4,6,'#365d60');r(119,162,9,2,'#31493f');r(143,154,2,13,'#6f7058');r(140,150,8,4,'#e2ba68');r(141,146,6,5,'#f4d88e');r(143,143,2,3,'#bd9960');
 for(let i=0;i<65;i++){const x=(i*67+19)%320,y=150+(i*37)%42;if(x>108&&x<195&&y>168)continue;r(x,y,2+(i%2),1,i%3?p.grass:'#87916b');}for(const [x,y]of [[14,173],[85,175],[219,174],[239,185]]){r(x,y,1,4,'#819268');r(x-1,y-1,3,2,period==='night'?'#b1bd96':'#ddcc91');}
}
function hero(ctx,time,action){const {rect:r,polygon:poly}=brushes(ctx);let x=175,y=119;const beat=Math.floor(time/4)%2;
 if(action==='walk')x+=Math.round(Math.sin(time/13)*9);if(action==='write'){x=141;y=118;}if(action==='climb'){x=270;y=107+beat;}if(action==='rest'){x=170;y=128;}if(action==='celebrate')y-=Math.round(Math.max(0,Math.sin(time/3))*4);
 r(x-5,169,30,3,'#273f39');ctx.save();ctx.translate(x,y);ctx.scale(1.2,1.2);const breath=action==='idle'?Math.floor(time/13)%2:0;
 r(3,-breath,12,4,'#c96939');r(1,4-breath,18,3,'#ec9c54');r(5,7-breath,11,10,'#e9bd95');r(4,7-breath,4,7,'#775b47');r(13,10-breath,2,action==='idle'&&time%64>61?1:2,'#37464d');r(16,13-breath,2,2,'#dca17c');
 r(5,17-breath,10,13+breath,'#d6c7a0');r(4,19-breath,5,12+breath,'#60766b');r(14,19-breath,3,10+breath,'#879177');r(1,20-breath,4,9,'#d6a57f');r(-1,20-breath,4,11,'#4b6d68');r(-1,23-breath,3,3,'#87a291');r(4,30,6,10,'#526b75');r(11,30,5,10,'#435c69');r(3,39,8,3,'#293e49');r(11,39,7,3,'#293e49');
 if(action==='wave'||action==='celebrate'){r(17,8-breath,3,13,'#d6a57f');r(18+(action==='wave'?beat*2:0),5-breath,4,5,'#e9bd95');}else if(action==='climb'){r(15,-3,3,19,'#e9bd95');r(3,21,3,9,'#e9bd95');}else if(action==='write'){r(16,22+beat,9,2,'#e5c695');r(21,20+beat,2,4,'#6c634d');}else r(17,20-breath,3,10,'#d6a57f');
 if(action==='rest'){r(6,9,5,1,'#775b47');r(23,2,5,1,'#d2ddcc');r(25,-2,5,1,'#d2ddcc');}if(action==='celebrate'){for(const [sx,sy]of [[-9,4],[25,-3],[2,-9]]){r(sx,sy,1,5,'#e5cf8e');r(sx-2,sy+2,5,1,'#e5cf8e');}}
 ctx.restore();
}
export function paintLandscape(ctx,time=0,action='idle',period='day'){
 const p=palettes[period]||palettes.day;period=palettes[period]?period:'day';ctx.imageSmoothingEnabled=false;
 if(!cache.has(period)){const c=ctx.canvas.ownerDocument.createElement('canvas');c.width=320;c.height=192;background(c.getContext('2d'),period);cache.set(period,c);}ctx.drawImage(cache.get(period),0,0);
 const {rect:r}=brushes(ctx);const drift=Math.floor(time/55);for(const [base,y,w]of [[22,29,24],[102,20,16],[281,53,21]]){const x=(base+drift)%350-15;r(x,y,w,3,p.cloud);r(x+5,y-3,w-10,3,p.cloud);}
 for(let i=0;i<4;i++){const x=121+i*26+Math.floor(time/15)%8;r(x,129+(i%3)*4,10+(i%2)*7,1,p.ripple);}
 if(period==='night'&&Math.floor(time/18)%2===0){r(137,154,2,1,'#e4c682');r(148,151,1,2,'#d9c582');}
 hero(ctx,time,action);const hop=Math.floor(time/19)%3===0?1:0;r(212,163-hop,8,5,'#c4b69a');r(218,160-hop,5,6,'#d8c7a6');r(221,161-hop,1,1,'#33454b');r(223,163-hop,3,1,'#d69b61');r(213,168-hop,1,3,'#8b9477');r(217,168-hop,1,3,'#8b9477');
}
