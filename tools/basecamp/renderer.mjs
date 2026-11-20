import {campFrames as assets} from './frames.mjs';


let imagePromise;
function loadImages() {
  return imagePromise ||= Promise.all(['background','walker','activity'].map(name => new Promise((resolve,reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Camp illustration unavailable'));
    image.src = new URL('./' + name + '.webp', import.meta.url).href;
  }))).catch(error => {imagePromise = null; throw error;});
}

// One renderer owns its GPU context. The controller owns visibility and animation frames.
export function createCampRenderer(canvas, {onCaption = () => {}, onWeather = () => {}, clip} = {}) {
 const ctx=canvas.getContext('2d');
 if (!ctx) return {ready:Promise.resolve(false), render(){}, dispose(){}};
 let disposed=false, bg, walker, activities;
 const specs={sunny:{label:'晴れ',tint:[1,1,1],clouds:2,cloudColor:[255,252,235],rain:0,snow:0,night:0,sunset:0,sun:1},cloudy:{label:'くもり',tint:[.79,.85,.88],clouds:5,cloudColor:[193,204,205],rain:0,snow:0,night:0,sunset:0,sun:0},rain:{label:'雨',tint:[.59,.69,.77],clouds:5,cloudColor:[132,153,164],rain:1,snow:0,night:0,sunset:0,sun:0},sunset:{label:'夕暮れ',tint:[1,.79,.66],clouds:3,cloudColor:[255,204,158],rain:0,snow:0,night:0,sunset:1,sun:1},night:{label:'星空',tint:[.32,.43,.62],clouds:1,cloudColor:[82,106,144],rain:0,snow:0,night:1,sunset:0,sun:0},snow:{label:'雪',tint:[.79,.86,.94],clouds:5,cloudColor:[222,231,237],rain:0,snow:1,night:0,sunset:0,sun:0}};
 const state={weather:'sunny',motion:2.1}, sequence={next:()=>({...clip,speed:1,duration:clip.sourceSeconds})};
  const W=canvas.width,H=canvas.height,base=document.createElement('canvas');base.width=W;base.height=H;
 let gl=null;
 try {gl=base.getContext('webgl',{alpha:false,antialias:false});} catch {}
 const resources=[];
 let ready=false,program,uniforms;
 try {if(gl){
  const vs='attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}';
  const fs=`precision highp float;uniform sampler2D picture;uniform float phase;uniform float amount;varying vec2 uv;
   float edge(vec2 a,vec2 b,vec2 p){vec2 d=b-a;return ((p.x-a.x)*d.y-(p.y-a.y)*d.x)/length(d);}
   float triangle(vec2 p,vec2 a,vec2 b,vec2 c){return smoothstep(0.,.012,min(min(edge(a,b,p),edge(b,c,p)),edge(c,a,p)));}
   float band(float x,float a,float b,float f){return smoothstep(a,a+f,x)*(1.-smoothstep(b-f,b,x));}
   float sd(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.,1.));}
   void main(){vec2 p=vec2(uv.x,1.-uv.y),q=p;
    float tent=triangle(p,vec2(.190,.515),vec2(.080,.766),vec2(.335,.766));
    float cover=triangle(p,vec2(.190,.450),vec2(-.020,.835),vec2(.430,.835));
    float water=band(p.y,.612,.713,.012)*(band(p.x,.002,.10,.015)+band(p.x,.470,.722,.015));water*=1.-cover;
    water*=smoothstep(.014,.025,sd(p,vec2(-.012,.795),vec2(.190,.495)));
    water*=smoothstep(.85,1.15,length((p-vec2(.434,.700))/vec2(.033,.063)));
    water*=smoothstep(.85,1.15,length((p-vec2(.369,.746))/vec2(.043,.062)));
    float wave=sin(p.y*370.+phase*2.+sin(p.x*22.));
    q.x+=water*amount*(.0024*wave+.0013*sin(phase+p.y*120.));q.y+=water*amount*.0011*sin(p.y*230.+phase*2.);
    q.x+=tent*amount*.0055*(.66*sin(phase+p.y*29.)+.34*sin(phase*2.-p.x*34.+p.y*9.));q.y+=tent*amount*.0018*sin(phase+p.x*40.);
    vec3 color=texture2D(picture,vec2(q.x,1.-q.y)).rgb;color+=water*.014*amount*wave;color+=tent*.006*amount*sin(phase+p.x*48.+p.y*26.);
    gl_FragColor=vec4(color,1.);}`;
  function shader(type,s){const obj=gl.createShader(type);resources.push(['Shader',obj]);gl.shaderSource(obj,s);gl.compileShader(obj);if(!gl.getShaderParameter(obj,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(obj));return obj;}
  program=gl.createProgram();resources.push(['Program',program]);gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
  const b=gl.createBuffer();resources.push(['Buffer',b]);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const loc=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  uniforms={phase:gl.getUniformLocation(program,'phase'),amount:gl.getUniformLocation(program,'amount')};
 }

 } catch {releaseGL();}
 function releaseGL(){if(!gl)return;for(const [kind,resource] of resources)gl['delete'+kind](resource);gl.getExtension('WEBGL_lose_context')?.loseContext();gl=null;}
 base.addEventListener('webglcontextlost',()=>{gl=null;});
 let t=0,eTime=0,episode=null,transitionTime=2,fromSpec=specs.sunny,lastCaption='';
 function transitionSpec(){const a=Math.min(1,transitionTime/2),e=a*a*(3-2*a),target=specs[state.weather],out={};for(const k of ['clouds','rain','snow','night','sunset','sun'])out[k]=fromSpec[k]+(target[k]-fromSpec[k])*e;out.tint=fromSpec.tint.map((v,i)=>v+(target.tint[i]-v)*e);out.cloudColor=fromSpec.cloudColor.map((v,i)=>v+(target.cloudColor[i]-v)*e);return out;}
 function chooseEpisode(){const next=sequence.next(),before=episode?transitionSpec():specs[next.weather];episode=next;fromSpec=before;state.weather=next.weather;eTime=0;transitionTime=0;canvas.dataset.action=next.kind;canvas.dataset.weather=next.weather;onWeather(specs[next.weather].label);}
 const ease=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
 const blend=(a,b,u)=>a+(b-a)*u;
 const center={x:.55,y:.875};
 function drawWalk(a,b,u,heightA=.375,heightB=.375,alpha=1){const p=ease(u),x=blend(a.x,b.x,p),y=blend(a.y,b.y,p),height=blend(heightA,heightB,p),moving=Math.abs(a.x-b.x)+Math.abs(a.y-b.y)>.0001;
  const idx=moving?Math.floor(t*6)%6:6+Math.floor(t*1.7)%2,d=assets.walker.frames[idx],sc=H*height/435;
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='#23372d33';ctx.beginPath();ctx.ellipse(x*W,y*H+2,W*.027*height/.375,H*.008*height/.375,0,0,7);ctx.fill();ctx.translate(x*W,y*H);if(moving&&b.x<a.x)ctx.scale(-1,1);ctx.drawImage(walker,d.x,d.y,d.w,d.h,-d.anchorX*sc,-d.baseline*sc+(moving?Math.sin(t*6*Math.PI)*1.1:0),d.w*sc,d.h*sc);ctx.restore();
 }
 function drawPose(idx,x,y,height,alpha=1){const d=assets.activity.frames[idx],sc=H*height/340;ctx.save();ctx.globalAlpha=alpha;ctx.translate(x*W,y*H);ctx.drawImage(activities,d.x,d.y,d.w,d.h,-d.anchorX*sc,-d.baseline*sc,d.w*sc,d.h*sc);ctx.restore();}
 function tentDoor(){ctx.beginPath();ctx.moveTo(.188*W,.530*H);ctx.lineTo(.064*W,.781*H);ctx.lineTo(.195*W,.781*H);ctx.closePath();ctx.clip();}
 function drawInside(alpha=1){ctx.save();tentDoor();drawPose(3,.150,.776,.178,alpha);ctx.fillStyle='#45330f20';ctx.fillRect(.06*W,.54*H,.14*W,.25*H);ctx.restore();}
 function drawSwim(x,y,dir=1,alpha=1){const idx=4+Math.floor(t*2.4)%2,d=assets.activity.frames[idx],bw=d.bounds[2]-d.bounds[0],bh=d.bounds[3]-d.bounds[1],width=.061*W,scale=width/bw;
  ctx.save();ctx.globalAlpha=alpha;ctx.translate(x*W,y*H+Math.sin(t*3)*1.2);if(dir<0)ctx.scale(-1,1);ctx.drawImage(activities,d.x+d.bounds[0],d.y+d.bounds[1],bw,bh,-width*.5,-bh*scale,width,bh*scale);ctx.restore();
  ctx.save();ctx.strokeStyle=`rgba(223,242,237,${.65*alpha})`;ctx.lineWidth=1.2;for(let j=0;j<3;j++){const age=(t*.6+j*.33)%1;ctx.globalAlpha=alpha*(1-age);ctx.beginPath();ctx.ellipse(x*W-dir*age*W*.025,y*H+1,W*(.025+age*.016),H*(.004+age*.004),0,0,Math.PI*2);ctx.stroke();}ctx.restore();
 }
 function caption(text){if(text!==lastCaption){onCaption(text);lastCaption=text;}}
 function actorDraw(){const q=eTime*episode.speed;
  if(episode.kind==='walk'){
   const stop={x:.68,y:.877};if(q<4){drawWalk(center,stop,q/4);caption('コハクは、湖畔をお散歩。');}else if(q<8){drawWalk(stop,stop,0);caption('こちらに気づいて、手を振ってくれました。');}else if(q<12){drawWalk(stop,center,(q-8)/4);caption('のんびり、キャンプに戻っています。');}else{drawWalk(center,center,0);caption('次は何をしようかな。');}
  }else if(episode.kind==='tent'){
   const door={x:.15,y:.803};if(q<5){drawWalk(center,door,q/5);caption('コハクは、テントでひと休みするようです。');}
   else if(q<7){const p=ease((q-5)/2);drawPose(3,.15,blend(.803,.776,p),blend(.31,.178,p),1-p);drawInside(p);caption('かがんで、テントの中へ。');}
   else if(q<15){drawInside();caption(state.weather==='rain'?'雨音を聞きながら、テントでのんびり。':state.weather==='snow'?'雪の日は、テントの中でひと休み。':'ランタンのそばで、静かなひと休み。');}
   else if(q<17){const p=ease((q-15)/2);drawInside(1-p);drawPose(3,.15,blend(.776,.803,p),blend(.178,.31,p),p);caption('そろそろ、外の様子を見てみよう。');}
   else{drawWalk(door,center,(q-17)/5);caption('コハクが、テントから戻ってきました。');}
  }else if(episode.kind==='climb'){
   const foot={x:.785,y:.835};if(q<4){drawWalk(center,foot,q/4);caption('コハクは、気になる岩を見つけました。');}
   else if(q<6){const p=ease((q-4)/2);drawWalk(foot,foot,0,.375,.375,1-p);drawPose(0,.79,.823,.29,p);caption('手と足を確かめて、登り始めます。');}
   else if(q<16){const z=q-6,progress=z<4?ease(z/4):z<6?1:1-ease((z-6)/4),idx=z<4?Math.min(2,Math.floor(z/1.34)):z<6?2:Math.max(0,2-Math.floor((z-6)/1.34));drawPose(idx,blend(.790,.845,progress),blend(.823,.727,progress),.29);caption(progress>.95?'岩の上の景色、いい眺め。':z>6?'一手ずつ、ゆっくり降りてきます。':'コハクは、岩登りに夢中です。');}
   else if(q<18){const p=ease((q-16)/2);drawPose(0,.79,.823,.29,1-p);drawWalk(foot,foot,0,.375,.375,p);caption('今日の岩登りは、ここまで。');}
   else{drawWalk(foot,center,(q-18)/4);caption('満足そうに、キャンプへ戻っています。');}
  }else{
   const shore={x:.574,y:.718};if(q<5){drawWalk(center,shore,q/5,.375,.17);caption('晴れたので、湖へ出かけるようです。');}
   else if(q<7){const p=ease((q-5)/2);ctx.save();ctx.beginPath();ctx.rect(0,0,W,H*blend(.73,.662,p));ctx.clip();drawWalk(shore,{x:.58,y:.67},p,.17,.11,1-p);ctx.restore();drawSwim(.58,.662,1,p);caption('湖の向こうで、水しぶきが上がりました。');}
   else if(q<17){const z=q-7,going=z<5,p=going?ease(z/5):ease((z-5)/5),x=going?blend(.58,.69,p):blend(.69,.58,p);drawSwim(x,.652,going?1:-1);caption('よく見ると、遠くでコハクが泳いでいます。');}
   else if(q<19){const p=ease((q-17)/2);drawSwim(.58,.662,-1,1-p);drawWalk({x:.58,y:.67},shore,p,.11,.17,p);caption('ひと泳ぎして、岸へ戻っています。');}
   else{drawWalk(shore,center,(q-19)/5,.17,.375);caption('さっぱりした顔で、キャンプへ帰ってきます。');}
  }
 }
  function mix(a,b,x){return a+(b-a)*x;}
 const seeds=Array.from({length:130},(_,i)=>({x:((Math.sin(i*92.1+2)*14751)%1+1)%1,y:((Math.cos(i*37.7+7)*24731)%1+1)%1,z:((Math.sin(i*18.31+5)*34751)%1+1)%1}));
 function cloud(x,y,size,color,alpha){
  ctx.save();ctx.translate(x,y);ctx.scale(size,size);ctx.globalAlpha=alpha;ctx.filter='blur(1.6px)';
  const grad=ctx.createLinearGradient(0,-.36,0,.20);grad.addColorStop(0,`rgb(${color.map(v=>Math.min(255,v+16)).join(',')})`);grad.addColorStop(1,`rgb(${color.map(v=>Math.max(0,v-18)).join(',')})`);ctx.fillStyle=grad;
  ctx.beginPath();ctx.moveTo(-.5,.12);ctx.bezierCurveTo(-.72,.10,-.65,-.11,-.41,-.11);ctx.bezierCurveTo(-.4,-.34,-.05,-.46,.10,-.20);ctx.bezierCurveTo(.30,-.36,.47,-.15,.48,-.06);ctx.bezierCurveTo(.70,-.06,.68,.15,.45,.16);ctx.closePath();ctx.fill();ctx.restore();
 }
 function weatherSky(s){
  if(s.night>.01){ctx.save();ctx.globalAlpha=s.night;for(let i=0;i<60;i++){const p=seeds[i],x=p.x*W,y=(.015+p.y*.16)*H;ctx.fillStyle=`rgba(231,242,255,${.45+.4*Math.sin(t*.7+i)**2})`;ctx.beginPath();ctx.arc(x,y,.7+p.z*1.1,0,7);ctx.fill();}ctx.restore();}
  const sunStrength=s.sun*(1-s.night),sx=W*(.79-.06*s.sunset),sy=H*(.15+.09*s.sunset),radius=W*(.035+.003*s.sunset);
  if(sunStrength>.01){ctx.save();ctx.globalAlpha=sunStrength;const halo=ctx.createRadialGradient(sx,sy,radius*.5,sx,sy,radius*2.8);halo.addColorStop(0,'#ffe2a177');halo.addColorStop(1,'#ffda9600');ctx.fillStyle=halo;ctx.fillRect(sx-radius*3,sy-radius*3,radius*6,radius*6);const sun=ctx.createRadialGradient(sx-radius*.3,sy-radius*.3,0,sx,sy,radius);sun.addColorStop(0,s.sunset>.5?'#fff1ba':'#fff0bf');sun.addColorStop(1,s.sunset>.5?'#ffbb70':'#ffdda0');ctx.fillStyle=sun;ctx.beginPath();ctx.arc(sx,sy,radius,0,7);ctx.fill();ctx.restore();}
  if(s.night>.01){ctx.save();ctx.globalAlpha=s.night;const x=W*.79,y=H*.145,r=W*.028;const halo=ctx.createRadialGradient(x,y,0,x,y,r*3);halo.addColorStop(0,'#dbeaff55');halo.addColorStop(1,'#dbeaff00');ctx.fillStyle=halo;ctx.fillRect(x-r*3,y-r*3,r*6,r*6);ctx.fillStyle='#e6eddd';ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();ctx.fillStyle='#d1ddcf';ctx.beginPath();ctx.arc(x-r*.3,y+r*.22,r*.2,0,7);ctx.arc(x+r*.3,y-r*.3,r*.15,0,7);ctx.fill();ctx.restore();}
  for(let i=0;i<5;i++){const opacity=Math.max(0,Math.min(1,s.clouds-i));if(!opacity)continue;const x=(((i*.31+t*.012*(1+s.rain*.4))%1.45)-.22)*W,y=(.075+(i%3)*.045)*H,size=W*(.15+.035*(i%3))*(1+s.rain*.32);cloud(x,y,size,s.cloudColor,opacity*(.85-s.night*.45));}
 }

  function foregroundWeather(s){
  if(s.rain>.01){ctx.save();ctx.strokeStyle=`rgba(211,233,244,${.46*s.rain})`;ctx.lineWidth=1.1;ctx.beginPath();for(let i=0;i<95;i++){const p=seeds[i],x=((p.x-t*(.07+p.z*.03)+20)%1.25-.1)*W,y=((p.y+t*(.7+p.z*.45))%1.2-.1)*H,len=(.02+p.z*.024)*H;ctx.moveTo(x,y);ctx.lineTo(x-len*.20,y+len);}ctx.stroke();ctx.restore();
   ctx.save();ctx.lineWidth=1;for(let i=0;i<11;i++){const p=seeds[i+20],age=(t*.7+p.z)%1;ctx.strokeStyle=`rgba(225,243,246,${(1-age)*.38*s.rain})`;ctx.beginPath();ctx.ellipse(W*(.48+p.x*.23),H*(.635+p.y*.065),3+age*10,1+age*2,0,0,7);ctx.stroke();}ctx.restore();}
  if(s.snow>.01){ctx.save();for(let i=0;i<90;i++){const p=seeds[i],x=((p.x+t*.018+Math.sin(t*.6+i)*.025)%1.15-.06)*W,y=((p.y+t*(.055+p.z*.06))%1.18-.1)*H;ctx.fillStyle=`rgba(248,253,255,${s.snow*(.45+p.z*.5)})`;ctx.beginPath();ctx.arc(x,y,1+p.z*2.2,0,7);ctx.fill();}ctx.restore();}
  const glow=Math.min(1,s.night+.35*s.sunset+.2*s.rain);if(glow>.01){ctx.save();ctx.globalCompositeOperation='screen';const x=.432*W,y=.704*H,r=W*.09;const grad=ctx.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,`rgba(255,177,66,${glow*.60})`);grad.addColorStop(.35,`rgba(255,173,65,${glow*.2})`);grad.addColorStop(1,'rgba(255,173,65,0)');ctx.fillStyle=grad;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();}
  if(s.night>.5){ctx.save();for(let i=0;i<7;i++){const p=seeds[i+100],x=W*(.37+p.x*.35)+Math.sin(t*.9+i)*8,y=H*(.69+p.y*.11)+Math.cos(t*.7+i)*6;ctx.fillStyle=`rgba(255,234,155,${s.night*(.25+.65*Math.sin(t+i)**2)})`;ctx.beginPath();ctx.arc(x,y,1.4,0,7);ctx.fill();}ctx.restore();}
 }

 function draw(){if(!ready)return;const s=transitionSpec();ctx.clearRect(0,0,W,H);if(gl){gl.viewport(0,0,W,H);gl.uniform1f(uniforms.phase,t/6*Math.PI*2);gl.uniform1f(uniforms.amount,state.motion*(1+.25*s.rain));gl.drawArrays(gl.TRIANGLES,0,6);ctx.drawImage(base,0,0,W,H);}else ctx.drawImage(bg,0,0,W,H);
  actorDraw();ctx.save();ctx.globalCompositeOperation='multiply';ctx.fillStyle=`rgb(${s.tint.map(v=>Math.round(255*v)).join(',')})`;ctx.fillRect(0,0,W,H);ctx.restore();
  if(s.sunset>.01){ctx.save();const g=ctx.createLinearGradient(0,0,0,H*.5);g.addColorStop(0,`rgba(246,124,91,${.18*s.sunset})`);g.addColorStop(1,'rgba(255,200,120,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H*.5);ctx.restore();}weatherSky(s);foregroundWeather(s);
 }
 function update(dt){t+=dt;transitionTime+=dt;eTime+=dt;while(eTime>=episode.duration){const rest=eTime-episode.duration;chooseEpisode();eTime=rest;}}
 chooseEpisode();
 const readyPromise=loadImages().then(images=>{
   if(disposed)return false;
   [bg,walker,activities]=images;
   if(gl){try{const texture=gl.createTexture();resources.push(['Texture',texture]);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,bg);}catch{releaseGL();}}
   ready=true;draw();return true;
 }).catch(()=>false);
 return {
   ready:readyPromise,
   render(dt=0){if(disposed||!ready)return;if(Number.isFinite(dt)&&dt>0)update(dt);draw();},
   dispose(){disposed=true;ready=false;releaseGL();},
 };
}
