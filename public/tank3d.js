import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
const $=id=>document.getElementById(id), lobby=$("lobby"), game=$("game");
$("back").onclick=()=>location.href="/";
let mode="coop",running=false,paused=false,last=0,elapsed=0,score=0,round=1;
const keys=new Set(), tanks=[],shots=[],enemies=[],effects=[],destructibles=[],trees=[];
let selectedWeapon=0,mouseDown={left:false,right:false},mouseWorld=new THREE.Vector3();
const weaponCycle=["smoke","rocket","heavy"];
const keyCodeMap={KeyW:"w",KeyA:"a",KeyS:"s",KeyD:"d",KeyQ:"q",KeyE:"e",KeyF:"f",KeyG:"g",ShiftLeft:"Shift",ShiftRight:"Shift",Space:" ",ArrowUp:"ArrowUp",ArrowDown:"ArrowDown",ArrowLeft:"ArrowLeft",ArrowRight:"ArrowRight",Enter:"Enter",ControlLeft:"Control",ControlRight:"Control",Comma:",",Period:"."};
function mappedKey(e){return keyCodeMap[e.code]??(e.key===" "?" ":e.key.toLowerCase())}
function clearKeys(){keys.clear()}
let gamepad2=null,controllerJoined=false,audioCtx=null,audioMaster=null,engineOsc=null,engineGain=null,trackNoise=null,trackGain=null,radioQueue=[],radioBusy=false,radioSeen=new Set();
function unlockAudio(){
 if(!audioCtx){const AC=window.AudioContext||window.webkitAudioContext;if(AC){audioCtx=new AC();audioMaster=audioCtx.createGain();audioMaster.gain.value=1.25;const comp=audioCtx.createDynamicsCompressor();comp.threshold.value=-12;comp.knee.value=12;comp.ratio.value=4;comp.attack.value=.004;comp.release.value=.22;audioMaster.connect(comp);comp.connect(audioCtx.destination)}}
 if(audioCtx?.state==="suspended")audioCtx.resume().catch(()=>{});
}
function noiseBurst(duration,filterFreq,volume,filterType="lowpass"){
 if(!audioCtx||!audioMaster)return;const n=Math.max(1,Math.floor(audioCtx.sampleRate*duration)),buf=audioCtx.createBuffer(1,n,audioCtx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n)**.45;
 const src=audioCtx.createBufferSource(),f=audioCtx.createBiquadFilter(),g=audioCtx.createGain();src.buffer=buf;f.type=filterType;f.frequency.value=filterFreq;f.Q.value=.8;g.gain.setValueAtTime(volume,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);src.connect(f);f.connect(g);g.connect(audioMaster);src.start();src.stop(audioCtx.currentTime+duration);
}
function tone(freq,duration,type="square",volume=.06,slide=0){
 if(!audioCtx||!audioMaster)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain(),f=audioCtx.createBiquadFilter();o.type=type;o.frequency.setValueAtTime(freq,audioCtx.currentTime);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),audioCtx.currentTime+duration);f.type="lowpass";f.frequency.value=1600;g.gain.setValueAtTime(volume,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(f);f.connect(g);g.connect(audioMaster);o.start();o.stop(audioCtx.currentTime+duration);
}
function sound(k){
 if(!audioCtx)return;
 if(k==="cannon"){noiseBurst(.42,850,.95);noiseBurst(.13,3800,.42,"highpass");tone(82,.52,"sawtooth",.65,-58);tone(43,.42,"triangle",.48,-18)}
 else if(k==="mg"){noiseBurst(.075,2600,.23,"highpass");tone(125,.065,"square",.13,-70);noiseBurst(.045,950,.13)}
 else if(k==="rocket"){noiseBurst(.3,1200,.42);tone(180,.28,"sawtooth",.3,-130)}
 else if(k==="explosion"){noiseBurst(.72,420,.9);noiseBurst(.35,2200,.42,"bandpass");tone(58,.72,"sawtooth",.62,-38);tone(31,.55,"triangle",.4,-14)}
}
function startEngineAudio(){
 if(!audioCtx||engineOsc)return;
 engineOsc=audioCtx.createOscillator();engineOsc.type="sawtooth";engineOsc.frequency.value=48;engineGain=audioCtx.createGain();engineGain.gain.value=.0001;const lp=audioCtx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=180;engineOsc.connect(lp);lp.connect(engineGain);engineGain.connect(audioMaster);engineOsc.start();
 const n=Math.floor(audioCtx.sampleRate*2),b=audioCtx.createBuffer(1,n,audioCtx.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*.5;
 trackNoise=audioCtx.createBufferSource();trackNoise.buffer=b;trackNoise.loop=true;const bp=audioCtx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=520;bp.Q.value=.7;trackGain=audioCtx.createGain();trackGain.gain.value=.0001;trackNoise.connect(bp);bp.connect(trackGain);trackGain.connect(audioMaster);trackNoise.start();engineOsc.userData={filter:lp};
}
function updateEngineAudio(){
 if(!audioCtx||!engineOsc)return;const speed=Math.max(...tanks.map(t=>Math.abs(t.speed||0)),0),moving=speed>.25,now=audioCtx.currentTime;
 engineOsc.frequency.setTargetAtTime(42+speed*7,now,.12);engineGain.gain.setTargetAtTime(moving?.12:.035,now,.18);trackGain.gain.setTargetAtTime(moving?.22:0,now,.14);
}
function stopEngineAudio(){if(engineOsc){try{engineOsc.stop()}catch(e){}engineOsc=null}if(trackNoise){try{trackNoise.stop()}catch(e){}trackNoise=null}engineGain=trackGain=null}
function radioCall(id){
 if(radioSeen.has(id)||radioQueue.length>10)return;radioSeen.add(id);
 const index=({start:1,contact:2,damage:3,kill:4,critical:5,heavy:6,area:7,warning:8,complete:9,extra:10,final:11})[id];if(!index)return;
 radioQueue.push("/audio/radio/radio_"+String(index).padStart(2,"0")+".mp3");playRadioQueue();
}
function playRadioQueue(){
 if(radioBusy||!radioQueue.length)return;radioBusy=true;const a=new Audio(radioQueue.shift());a.volume=.78;a.preload="auto";const done=()=>{radioBusy=false;playRadioQueue()};a.onended=done;a.onerror=done;a.play().catch(done);
}
const scene=new THREE.Scene();scene.background=new THREE.Color(0x9bb3c4);scene.fog=new THREE.Fog(0x9bb3c4,55,145);
scene.add(new THREE.HemisphereLight(0xe8f1ff,0x465033,2.1));
const sun=new THREE.DirectionalLight(0xffe4b5,2.3);sun.position.set(-25,40,18);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
const terrainCanvas=document.createElement("canvas");terrainCanvas.width=terrainCanvas.height=512;const tx=terrainCanvas.getContext("2d");tx.fillStyle="#596448";tx.fillRect(0,0,512,512);let seed=41;const rnd=()=>((seed=seed*1664525+1013904223>>>0)/4294967296);for(let i=0;i<3500;i++){const x=rnd()*512,y=rnd()*512,r=1+rnd()*8;tx.fillStyle=rnd()>.5?"rgba(32,47,25,.13)":"rgba(174,158,104,.09)";tx.beginPath();tx.ellipse(x,y,r,r*.55,rnd()*3,0,Math.PI*2);tx.fill()}const terrainTex=new THREE.CanvasTexture(terrainCanvas);terrainTex.wrapS=terrainTex.wrapT=THREE.RepeatWrapping;terrainTex.repeat.set(9,9);terrainTex.colorSpace=THREE.SRGBColorSpace;
const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({map:terrainTex,color:0xffffff,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(180,90,0x7b895b,0x68764f);grid.position.y=.026;grid.material.opacity=.18;grid.material.transparent=true;scene.add(grid);
const mat=(color,rough=.78,metal=0)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
const green=mat(0x455735),dark=mat(0x20251e),rubber=mat(0x171a17),metal=mat(0x78806c,.42,.7),glass=mat(0x273e37,.25,.35),red=mat(0x8f2923);
function box(parent,w,h,d,m,x,y,z){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function makeTank(color=0x455735){
 const root=new THREE.Group(),hull=new THREE.Group();root.add(hull);
 const paint=mat(color,.88,.08),paintLight=mat(0x68764b,.82,.12),paintDark=mat(0x303d24,.92,.05),camoA=mat(0x28351f),camoB=mat(0x78834a),camoC=mat(0x1d2819),edge=mat(0x92977a,.55,.38),dark=mat(0x171c16,.96,.05),rubber=mat(0x101310,.98),steel=mat(0x555c4c,.5,.62),glass=mat(0x182c2b,.22,.45),lens=mat(0x65a69a,.2,.5),lamp=mat(0xd7c995,.28,.2);
 const box=(p,w,h,d,m,x,y,z,rx=0,ry=0,rz=0)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.castShadow=true;o.receiveShadow=true;p.add(o);return o};
 const cyl=(p,r1,r2,len,m,x,y,z,rotZ=Math.PI/2,seg=20)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,len,seg),m);o.rotation.z=rotZ;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o};
 const sphere=(p,r,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(r,10,8),m);o.position.set(x,y,z);o.castShadow=true;p.add(o);return o};
 const patch=(p,pts,m,y)=>{const s=new THREE.Shape();s.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)s.lineTo(pts[i][0],pts[i][1]);s.closePath();const o=new THREE.Mesh(new THREE.ShapeGeometry(s),m);o.rotation.x=-Math.PI/2;o.position.y=y;o.castShadow=false;p.add(o);return o};
 // Sombra e casco principal angular do T-90 BRAVO.
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(3.8,32),new THREE.MeshBasicMaterial({color:0x090d08,transparent:true,opacity:.36}));shadow.rotation.x=-Math.PI/2;shadow.scale.set(1,.7,1);shadow.position.y=.035;root.add(shadow);
 box(hull,3.25,.82,5.15,paint,0,1.02,0);
 // Placa frontal inclinada, nariz reforçado e blindagem composta.
 box(hull,3.05,.28,1.55,paintLight,0,1.47,1.83,-.24,0,0);
 box(hull,2.8,.22,1.25,paintDark,0,1.43,2.22,-.25,0,0);
 box(hull,3.18,.28,1.1,paintDark,0,.72,2.05);
 box(hull,3.12,.25,1.15,paintLight,0,.78,-2.02);
 // Esteiras largas com banda exterior, elos individuais e roletes.
 for(const side of [-1,1]){
  box(hull,.58,.94,5.62,dark,side*1.82,.66,0);
  box(hull,.12,.72,5.42,steel,side*2.12,.67,0);
  for(let i=0;i<8;i++){
   const z=-2.18+i*.62;
   cyl(hull,.39,.39,.18,rubber,side*2.13,.62,z);
   cyl(hull,.22,.22,.205,steel,side*2.14,.62,z);
   cyl(hull,.095,.095,.22,dark,side*2.15,.62,z,Math.PI/2,12);
   // banda articulada e travessas visíveis sobre os roletes
   box(hull,.1,.08,.48,paintDark,side*2.18,.19,z,0,0,0);
   box(hull,.1,.08,.48,steel,side*2.18,1.08,z,0,0,0);
  }
  // Rodas tensoras e motriz.
  cyl(hull,.48,.48,.2,dark,side*2.12,.64,-2.52);
  cyl(hull,.48,.48,.2,dark,side*2.12,.64,2.52);
  // Saias blindadas segmentadas, com parafusos e reforços.
  for(let i=0;i<6;i++){
   const z=-1.95+i*.78;
   box(hull,.22,.48,.72,i%2?paint:paintLight,side*1.91,1.12,z,0,0,side*.035);
   for(const y of [.96,1.28])sphere(hull,.035,edge,side*2.035,y,z);
  }
  // Detalhes de elos externos.
  for(let i=0;i<22;i++){const z=-2.65+i*.25;box(hull,.07,.08,.16,steel,side*2.2,1.18,z)}
 }
 // Convés traseiro, grelhas do motor e painéis de manutenção.
 box(hull,2.55,.18,1.35,paintDark,0,1.48,-1.83);
 for(let i=0;i<8;i++)box(hull,.09,.035,.92,steel,-.92+i*.26,1.59,-1.82);
 for(const side of [-1,1]){box(hull,.22,.18,.88,paintLight,side*1.28,1.46,-1.15);for(let i=0;i<4;i++)sphere(hull,.045,dark,side*1.39,1.56,-1.42+i*.18)}
 // manchas geométricas de camuflagem sobre o casco, não texturas genéricas.
 patch(hull,[[-1.25,-1.35],[-.7,-1.7],[-.2,-1.2],[-.48,-.8],[-1.2,-.86]],camoA,1.49);
 patch(hull,[[.35,-1.55],[1.18,-1.32],[1.3,-.82],[.62,-.7],[.22,-1.05]],camoB,1.49);
 patch(hull,[[-1.2,.05],[-.75,-.2],[-.35,.35],[-.62,.86],[-1.32,.7]],camoC,1.49);
 patch(hull,[[.28,.18],[.8,-.1],[1.35,.3],[1.18,.85],[.55,.95]],camoA,1.49);
 // Faróis frontais, ganchos de reboque e caixas laterais.
 for(const s of [-1,1]){box(hull,.38,.2,.16,dark,s*1.18,1.13,2.55);box(hull,.22,.11,.07,lamp,s*1.18,1.18,2.64);box(hull,.32,.25,.42,paintDark,s*1.38,.65,2.22);cyl(hull,.11,.11,.18,steel,s*1.48,.52,2.56)}
 // Anel de giro e base elevada da torre.
 cyl(hull,1.34,1.34,.2,dark,0,1.58,.12,0,32);
 cyl(hull,1.18,1.18,.18,steel,0,1.69,.12,0,32);
 const turret=new THREE.Group();turret.position.set(0,1.82,.12);hull.add(turret);
 // Torre poligonal baixa, placas compostas e mantelete frontal.
 box(turret,2.55,.72,2.65,paint,0,.26,.12);
 box(turret,2.28,.2,2.28,paintLight,0,.68,.08);
 box(turret,2.18,.28,.88,paintDark,0,.24,1.28,-.18,0,0);
 box(turret,1.7,.48,.5,paint,0,.35,1.48);
 // Placas inclinadas laterais e blocos de blindagem reativa.
 for(const s of [-1,1]){
  box(turret,.24,.55,1.72,paintLight,s*1.22,.3,.02,0,0,s*-.12);
  for(let i=0;i<3;i++)box(turret,.16,.3,.38,i%2?camoA:paintDark,s*1.34,.38,-.55+i*.55,0,0,s*-.12);
  for(let i=0;i<4;i++)sphere(turret,.045,edge,s*1.28,.58,-.68+i*.42);
  // Lançadores de granadas fumígenas em bancos angulados.
  const pod=new THREE.Group();pod.position.set(s*1.02,.62,.65);pod.rotation.z=s*.32;turret.add(pod);
  for(let i=0;i<3;i++){cyl(pod,.12,.12,.38,dark,0,0,i*.24-Math.PI*.0,0,12);cyl(pod,.075,.075,.39,steel,0,0,i*.24+.025,0,12)}
 }
 // Painéis de camuflagem na parte superior da torre.
 patch(turret,[[-.98,-.68],[-.42,-.92],[.08,-.55],[-.24,-.22],[-.9,-.28]],camoA,.795);
 patch(turret,[[.18,-.82],[.9,-.64],[1,.0],[.48,.15],[.12,-.3]],camoB,.795);
 patch(turret,[[-.86,.1],[-.3,-.08],[.1,.42],[-.36,.64],[-.92,.48]],camoC,.795);
 // Escotilhas do comandante e carregador, ópticas e periscópios.
 for(const s of [-1,1]){const hatch=cyl(turret,.36,.36,.12,dark,s*.67,.78,-.28,0,20);cyl(turret,.25,.25,.13,paintLight,s*.67,.85,-.28,0,20);box(turret,.22,.06,.12,steel,s*.67,.94,-.28)}
 box(turret,.48,.12,.4,dark,.15,.84,.35);
 box(turret,.22,.1,.18,glass,.15,.92,.36);
 for(const s of [-1,1]){box(turret,.22,.12,.18,dark,s*.92,.82,.42);box(turret,.1,.08,.08,lens,s*.92,.88,.45)}
 // Cesto traseiro da torre em barras metálicas.
 for(const s of [-1,1]){box(turret,.12,.55,.12,steel,s*1.05,.15,-1.43);box(turret,.12,.55,.12,steel,s*.45,.15,-1.43)}
 box(turret,1.25,.12,.12,steel,0,.42,-1.43);
 for(let i=0;i<7;i++)box(turret,.07,.42,.07,steel,-.55+i*.18,.18,-1.43);
 // Canhão longo com tubo, extrator e freio de boca; grupo independente para recuo e mira.
 const barrel=new THREE.Group();barrel.position.set(0,.37,1.62);turret.add(barrel);
 const barrelTube=cyl(barrel,.2,.24,3.55,steel,0,0,1.8,0,20);barrelTube.rotation.x=Math.PI/2;
 const barrelCollar=cyl(barrel,.28,.28,.55,paintDark,0,0,1.95,0,20);barrelCollar.rotation.x=Math.PI/2;
 const barrelBand=cyl(barrel,.3,.3,.46,paint,0,0,2.05,0,20);barrelBand.rotation.x=Math.PI/2;
 // Freio de boca perfurado.
 box(barrel,.5,.38,.48,dark,0,0,3.66);
 box(barrel,.56,.12,.5,steel,0,.16,3.66);
 box(barrel,.56,.12,.5,steel,0,-.16,3.66);
 for(const s of [-1,1])box(barrel,.12,.2,.28,dark,s*.24,0,3.66);
 // Metralhadora remota (RCWS) sobre a torre.
 const rcws=new THREE.Group();rcws.position.set(-.72,.88,-.48);turret.add(rcws);
 box(rcws,.38,.24,.42,dark,0,0,0);box(rcws,.12,.28,.12,steel,0,.2,0);
 const rcwsTube=cyl(rcws,.055,.065,1.18,dark,0,.27,.55,0,12);rcwsTube.rotation.x=Math.PI/2;
 box(rcws,.15,.1,.2,steel,0,.27,1.1);
 box(rcws,.24,.14,.28,paintDark,0,-.13,-.08);
 // Antenas flexíveis e sensores.
 for(const s of [-1,1]){const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.012,.025,1.05,6),dark);antenna.position.set(s*1.02,.9,-.72);antenna.rotation.z=s*.08;turret.add(antenna);sphere(turret,.045,steel,s*1.02,1.43,-.72)}
 // Luzes, parafusos e placas identificadoras do blindado.
 for(const s of [-1,1]){box(turret,.12,.1,.22,lamp,s*1.16,.18,1.13);for(let i=0;i<4;i++)sphere(turret,.035,edge,s*.96,.62,-.62+i*.36)}
 return {root,hull,turret,barrel,hp:100,maxHp:100,cool:0,speed:0,turn:0,player:0,alive:true};
}
function addTank(player,x,z,color){const t=makeTank(color);t.root.position.set(x,0,z);t.player=player;t.team="blue";scene.add(t.root);tanks.push(t);return t}
function buildRoad(){
 const pts=[new THREE.Vector3(0,.045,78),new THREE.Vector3(-4,.045,58),new THREE.Vector3(-8,.045,38),new THREE.Vector3(-5,.045,18),new THREE.Vector3(3,.045,-2),new THREE.Vector3(11,.045,-23),new THREE.Vector3(9,.045,-44),new THREE.Vector3(2,.045,-78)];
 const curve=new THREE.CatmullRomCurve3(pts),segments=180,verts=[],uv=[],idx=[];
 for(let i=0;i<=segments;i++){const t=i/segments,p=curve.getPoint(t),tan=curve.getTangent(t),side=new THREE.Vector3(-tan.z,0,tan.x).normalize();for(const s of [-1,1]){const q=p.clone().addScaledVector(side,s*6.2);verts.push(q.x,q.y,q.z);uv.push(s===-1?0:1,t*18)}if(i<segments){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}}
 const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
 const roadTexCanvas=document.createElement("canvas");roadTexCanvas.width=roadTexCanvas.height=512;const c=roadTexCanvas.getContext("2d");c.fillStyle="#343a35";c.fillRect(0,0,512,512);let sd=17;const rr=()=>((sd=sd*1664525+1013904223>>>0)/4294967296);for(let i=0;i<3000;i++){const x=rr()*512,y=rr()*512;c.fillStyle=rr()>.5?"rgba(12,15,13,.24)":"rgba(170,164,139,.10)";c.beginPath();c.arc(x,y,rr()*2.5,0,Math.PI*2);c.fill()}const tex=new THREE.CanvasTexture(roadTexCanvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(1,18);tex.colorSpace=THREE.SRGBColorSpace;
 const road=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:tex,roughness:.98,side:THREE.DoubleSide}));road.receiveShadow=true;scene.add(road);
 const shoulderMat=mat(0x77745c,1),edgeMat=mat(0xbbb18b,1);
 for(let i=0;i<segments;i+=4){const p=curve.getPoint(i/segments),tan=curve.getTangent(i/segments),side=new THREE.Vector3(-tan.z,0,tan.x).normalize();for(const s of [-1,1]){const dash=new THREE.Mesh(new THREE.BoxGeometry(.13,.025,1.3),edgeMat);dash.position.copy(p).addScaledVector(side,s*5.9);dash.position.y=.075;dash.rotation.y=Math.atan2(tan.x,tan.z);scene.add(dash)}}
}
function scatter(){
 const trunkMat=mat(0x55402d),leafMats=[mat(0x203a27),mat(0x2e4c30),mat(0x405b35)],rockMat=mat(0x625f4b);
 for(let i=0;i<42;i++){let x,z;do{x=(Math.random()-.5)*145;z=(Math.random()-.5)*145}while((Math.abs(x)<13&&z<45&&z>-60)|| (Math.abs(x)<10&&Math.abs(z)<18));const tree=new THREE.Group();const h=2.1+Math.random()*2.4;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.28,h,7),trunkMat);trunk.position.y=h/2;tree.add(trunk);for(let j=0;j<3;j++){const crown=new THREE.Mesh(new THREE.ConeGeometry(1.25-j*.2,2.5,7),leafMats[(i+j)%3]);crown.position.y=h*.72+j*.72;tree.add(crown)}tree.position.set(x,0,z);tree.rotation.y=Math.random()*Math.PI;tree.scale.setScalar(.8+Math.random()*.6);tree.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});scene.add(tree);trees.push({root:tree,fallen:false,radius:2.5});
 if(i%2===0){const bush=new THREE.Mesh(new THREE.DodecahedronGeometry(.7+Math.random()*.5,0),leafMats[i%3]);bush.position.set(x+(Math.random()-.5)*3,.45,z+(Math.random()-.5)*3);bush.scale.y=.65;scene.add(bush)}
 }
 for(let i=0;i<16;i++){const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.45+Math.random()*.8,0),rockMat);rock.position.set((Math.random()-.5)*140,.3,(Math.random()-.5)*140);rock.scale.set(1,.6,.8);rock.rotation.set(Math.random(),Math.random(),Math.random());scene.add(rock)}
}
function spawnDebris(pos,type="object"){const group=new THREE.Group(),count=type==="car"?14:8;for(let i=0;i<count;i++){const piece=new THREE.Mesh(new THREE.BoxGeometry(.25+Math.random()*.6,.12+Math.random()*.35,.2+Math.random()*.5),mat(type==="car"?(i%2?0x363a37:0x6a6250):(i%2?0x4a4d40:0x8b4b2b)));piece.position.set((Math.random()-.5)*2,Math.random()*1.5,(Math.random()-.5)*2);group.add(piece)}group.position.copy(pos);scene.add(group);effects.push({mesh:group,life:5,velocity:new THREE.Vector3(0,1,0),spin:.3,detached:true})}
function addDestructibles(){
 const barrelMat=mat(0x9b4d24,.75,.2),rust=mat(0x463d31,.9),concrete=mat(0x77796f,.95),tire=mat(0x171a18,.98);
 const add=(mesh,x,z,hp,radius,type="object")=>{mesh.position.set(x,0,z);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.hp=hp;mesh.userData.maxHp=hp;mesh.userData.radius=radius;mesh.userData.type=type;scene.add(mesh);destructibles.push(mesh)};
 for(const [x,z] of [[-14,-12],[14,-18],[-20,24],[21,12],[28,-36],[-30,-42]]){const g=new THREE.Group(),drum=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,1.25,12),barrelMat);drum.position.y=.65;g.add(drum);for(const y of [.15,1.1]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.53,.055,6,12),rust);ring.rotation.x=Math.PI/2;ring.position.y=y;g.add(ring)}add(g,x,z,35,1.5,"barrel")}
 for(const [x,z,rot] of [[-25,4,.5],[24,30,-.4],[35,-12,1.2]]){const g=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(2.4,.85,4.7),rust),cabin=new THREE.Mesh(new THREE.BoxGeometry(2.05,.8,1.8),concrete);body.position.y=.75;cabin.position.set(0,1.55,-.45);g.add(body,cabin);for(const sx of [-1,1])for(const zz of [-1.5,1.5]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.22,12),tire);w.rotation.z=Math.PI/2;w.position.set(sx*1.18,.4,zz);g.add(w)}g.rotation.y=rot;add(g,x,z,65,3.1,"car")}
 for(const [x,z,rot] of [[-32,-5,.2],[31,3,-.2],[0,-54,.05]]){const g=new THREE.Group();for(let i=0;i<4;i++){const block=new THREE.Mesh(new THREE.BoxGeometry(3,.9,.8),concrete);block.position.set((i%2)*2.8,.45+Math.floor(i/2)*.9,0);g.add(block)}g.rotation.y=rot;add(g,x,z,110,3.2,"wall")}
}
buildRoad();scatter();addDestructibles();
function buildBoundary(){const water=mat(0x245c70,.25,.1),rock=mat(0x4e5549,.98);for(let i=0;i<4;i++){const z=i<2?-83:83,x=i%2===0?-83:83;const river=new THREE.Mesh(new THREE.BoxGeometry(i<2?170:12,.16,i<2?12:170),water);river.position.set(i<2?0:x,.04,i<2?z:0);scene.add(river)}for(let i=0;i<52;i++){const a=i/52*Math.PI*2,r=91+Math.random()*4,h=5+Math.random()*10,m=new THREE.Mesh(new THREE.ConeGeometry(4+Math.random()*4,h,6),rock);m.position.set(Math.cos(a)*r,h/2-1,Math.sin(a)*r);m.rotation.z=(Math.random()-.5)*.22;m.castShadow=true;scene.add(m)}}buildBoundary();
const cameras=[new THREE.PerspectiveCamera(49,1,.1,250),new THREE.PerspectiveCamera(56,1,.1,250)];
function aimCamera(cam,t,dt){const forward=new THREE.Vector3(Math.sin(t.root.rotation.y),0,Math.cos(t.root.rotation.y));const pos=t.root.position.clone().add(new THREE.Vector3(0,7.1,0)).addScaledVector(forward,-13.5);const smooth=1-Math.exp(-4.8*dt);cam.position.lerp(pos,smooth);const look=t.root.position.clone().add(new THREE.Vector3(0,1.7,0)).addScaledVector(forward,7.5);cam.userData.lookAt=cam.userData.lookAt||look.clone();cam.userData.lookAt.lerp(look,1-Math.exp(-6.5*dt));cam.lookAt(cam.userData.lookAt)}
function spawnEnemy(){const t=makeTank(0x554b36);t.root.position.set((Math.random()-.5)*34,0,-35-Math.random()*24);t.hp=65;t.maxHp=65;t.player=0;t.ai=true;t.team="red";scene.add(t.root);enemies.push(t)}
function fire(t,type="cannon"){
 if(!t.alive)return;const spec=type==="smoke"?{cool:1.5,speed:18,life:1.2,r:.1,color:0xb7b9a8,damage:0}:type==="mg"?{cool:.105,speed:96,life:1,r:.035,color:0xffe7a1,damage:4}:type==="heavy"?{cool:2.0,speed:32,life:3.2,r:.2,color:0xff7938,damage:62}:type==="rocket"?{cool:1.2,speed:48,life:2.5,r:.14,color:0xffa64a,damage:45}:{cool:.78,speed:78,life:2.5,r:.085,color:0xffd58a,damage:32};
 const cd=type+"Cool";if(t[cd]>0)return;t[cd]=spec.cool;
 if(type==="smoke"){const cloud=new THREE.Mesh(new THREE.SphereGeometry(2.2,10,8),new THREE.MeshBasicMaterial({color:0x777f7b,transparent:true,opacity:.48,depthWrite:false}));cloud.position.copy(t.root.position);scene.add(cloud);effects.push({mesh:cloud,life:5});sound("rocket");return}if(type==="cannon"&&t.barrel){t.recoil=.2;t.barrel.position.z=1.43;sound("cannon")}else if(type==="mg")sound("mg");else sound("rocket");
 const dir=new THREE.Vector3(Math.sin(t.root.rotation.y+t.turret.rotation.y),0,Math.cos(t.root.rotation.y+t.turret.rotation.y));
 const pos=t.root.position.clone().add(new THREE.Vector3(0,2.25,0)).addScaledVector(dir,type==="mg"?2.9:4.9);
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(spec.r*.72,spec.r,type==="mg"?.7:1.5,8),mat(spec.color,.25,.55));
 mesh.position.copy(pos);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);scene.add(mesh);
 const flash=new THREE.Mesh(type==="mg"?new THREE.ConeGeometry(.13,.9,8):new THREE.ConeGeometry(.48,1.8,10),new THREE.MeshBasicMaterial({color:type==="mg"?0xffe5a0:0xffa43a,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false}));
 flash.position.copy(pos).addScaledVector(dir,type==="mg"?.35:.65);flash.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);scene.add(flash);effects.push({mesh:flash,life:type==="mg"?.045:.12});
 if(type!=="mg"){const smoke=new THREE.Mesh(new THREE.SphereGeometry(.22,8,6),new THREE.MeshBasicMaterial({color:0xaaa99a,transparent:true,opacity:.36,depthWrite:false}));smoke.position.copy(pos);scene.add(smoke);effects.push({mesh:smoke,life:.48})}
 if(type==="mg"){const tracer=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,2.8,6),new THREE.MeshBasicMaterial({color:0xffedb0,transparent:true,opacity:.88}));tracer.position.copy(pos).addScaledVector(dir,1.7);tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);scene.add(tracer);effects.push({mesh:tracer,life:.055})}
 shots.push({mesh,dir,owner:t,team:t.team,life:spec.life,speed:spec.speed,damage:spec.damage,type});
}
function boom(pos,scale=.58){const m=new THREE.Mesh(new THREE.SphereGeometry(.48,10,8),new THREE.MeshBasicMaterial({color:0xff8a28,transparent:true,opacity:.7,depthWrite:false}));m.position.copy(pos);m.scale.setScalar(scale);scene.add(m);effects.push({mesh:m,life:.38});const ring=new THREE.Mesh(new THREE.RingGeometry(.25,.72,14),new THREE.MeshBasicMaterial({color:0xffa14a,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));ring.position.copy(pos);ring.rotation.x=-Math.PI/2;ring.scale.setScalar(scale);scene.add(ring);effects.push({mesh:ring,life:.24});noiseBurst(.25,700,.2)}
function destroyTank(t){
 if(t.destroyed)return;t.destroyed=true;t.alive=false;t.speed=0;
 const turret=t.turret,world=new THREE.Vector3();turret.getWorldPosition(world);t.root.remove(turret);scene.add(turret);turret.position.copy(world);turret.rotation.set(t.root.rotation.x, t.root.rotation.y+t.turret.rotation.y,0);
 const debris=new THREE.Group();for(let i=0;i<7;i++){const piece=new THREE.Mesh(new THREE.BoxGeometry(.35+Math.random()*.65,.18+Math.random()*.3,.3+Math.random()*.55),mat(i%2?0x3b4330:0x6c6b55));piece.position.set((Math.random()-.5)*3,1+Math.random()*1.5,(Math.random()-.5)*3);debris.add(piece)}debris.position.copy(t.root.position);scene.add(debris);
 effects.push({mesh:turret,life:2.8,velocity:new THREE.Vector3((Math.random()-.5)*5,5,(Math.random()-.5)*5),spin:3,detached:true});
 effects.push({mesh:debris,life:4,velocity:new THREE.Vector3(0,1,0),spin:.4,detached:true});
 const flame=new THREE.Mesh(new THREE.ConeGeometry(.8,2.6,9),new THREE.MeshBasicMaterial({color:0xff5b18,transparent:true,opacity:.7,depthWrite:false}));flame.position.copy(t.root.position).add(new THREE.Vector3(0,1.8,0));scene.add(flame);effects.push({mesh:flame,life:4,flame:true});
 boom(t.root.position.clone().add(new THREE.Vector3(0,1,0)),.9);sound("explosion");
}
function controls(t,dt){
 if(!t.alive)return;
 if(t.aiAlly){t.cannonCool=Math.max(0,(t.cannonCool||0)-dt);t.mgCool=Math.max(0,(t.mgCool||0)-dt);t.rocketCool=Math.max(0,(t.rocketCool||0)-dt);t.heavyCool=Math.max(0,(t.heavyCool||0)-dt);t.smokeCool=Math.max(0,(t.smokeCool||0)-dt);const target=tanks.find(x=>x.player===1),foe=enemies.filter(x=>x.alive).sort((a,b)=>a.root.position.distanceTo(t.root.position)-b.root.position.distanceTo(t.root.position))[0];if(target){const desired=target.root.position.clone().add(new THREE.Vector3(-Math.sin(target.root.rotation.y)*6,0,-Math.cos(target.root.rotation.y)*6));const dx=desired.x-t.root.position.x,dz=desired.z-t.root.position.z,dist=Math.hypot(dx,dz);if(dist>4){const ang=Math.atan2(dx,dz);t.root.rotation.y=THREE.MathUtils.damp(t.root.rotation.y,ang,2.3,dt);t.speed=THREE.MathUtils.damp(t.speed,Math.min(7,dist)*.8,1.7,dt);t.root.position.x+=Math.sin(t.root.rotation.y)*t.speed*dt;t.root.position.z+=Math.cos(t.root.rotation.y)*t.speed*dt}else t.speed=THREE.MathUtils.damp(t.speed,0,3,dt);if(foe){const ax=foe.root.position.x-t.root.position.x,az=foe.root.position.z-t.root.position.z,ang=Math.atan2(ax,az);t.turret.rotation.y=THREE.MathUtils.damp(t.turret.rotation.y,ang-t.root.rotation.y,3,dt);t.cool=Math.max(0,t.cool-dt);if(t.cool<=0&&Math.hypot(ax,az)<42)fire(t)}}return}
 const p=t.player,pad=p===2?gamepad2:null,forward=p===1?(keys.has("w")?1:0)-(keys.has("s")?1:0):(keys.has("ArrowUp")?1:0)-(keys.has("ArrowDown")?1:0),turn=p===1?(keys.has("d")?1:0)-(keys.has("a")?1:0):(keys.has("ArrowRight")?1:0)-(keys.has("ArrowLeft")?1:0),turret=p===1?(keys.has("e")?1:0)-(keys.has("q")?1:0):(keys.has(".")?1:0)-(keys.has(",")?1:0);
 const padForward=pad?-(Math.abs(pad.axes[1]||0)>.16?pad.axes[1]:0):0,padTurn=pad?(Math.abs(pad.axes[0]||0)>.16?pad.axes[0]:0):0,padTurret=pad?(Math.abs(pad.axes[2]||0)>.18?pad.axes[2]:0):0;const drive=pad?padForward:forward,steer=pad?padTurn:turn,aim=pad?padTurret:turret;const maxSpeed=drive<0?4.2:10.5,desired=drive*maxSpeed;
 t.speed=THREE.MathUtils.damp(t.speed,desired,drive===0?2.2:3.8,dt);
 const steerFactor=.34+Math.min(1,Math.abs(t.speed)/6)*.72;
 t.root.rotation.y-=steer*1.05*steerFactor*dt*(t.speed<0?-1:1);
 if(Math.abs(t.speed)<.25&&steer!==0)t.root.rotation.y-=steer*.35*dt;
 const ox=t.root.position.x,oz=t.root.position.z;t.root.position.x+=Math.sin(t.root.rotation.y)*t.speed*dt;t.root.position.z+=Math.cos(t.root.rotation.y)*t.speed*dt;for(const o of destructibles)if(o.visible&&Math.hypot(t.root.position.x-o.position.x,t.root.position.z-o.position.z)<o.userData.radius+1.7){t.root.position.x=ox;t.root.position.z=oz;t.speed=0;break}
 t.root.position.x=THREE.MathUtils.clamp(t.root.position.x,-74,74);t.root.position.z=THREE.MathUtils.clamp(t.root.position.z,-74,74);
 for(const tree of trees){if(!tree.fallen&&Math.hypot(t.root.position.x-tree.root.position.x,t.root.position.z-tree.root.position.z)<tree.radius+1.7&&Math.abs(t.speed)>2){tree.fallen=true;tree.root.rotation.x=(t.root.position.z<tree.root.position.z?1:-1)*Math.PI/2;tree.root.rotation.z=(t.root.position.x<tree.root.position.x?-.18:.18);tree.root.position.y=-.35}}
 for(const o of destructibles){if(!o.visible||Math.hypot(t.root.position.x-o.position.x,t.root.position.z-o.position.z)>o.userData.radius+1.8)continue;if(o.userData.type==="barrel"){o.userData.hp=0;o.visible=false;t.hp=Math.max(0,t.hp-18);boom(o.position,.75);sound("explosion");if(t.hp<=0)destroyTank(t);spawnDebris(o.position,"barrel")}else if(o.userData.type==="car"){o.visible=false;boom(o.position,.62);sound("explosion");spawnDebris(o.position,"car")}else{t.root.position.x=ox;t.root.position.z=oz;t.speed=0}}

 t.turret.rotation.y+=aim*1.45*dt;t.cool=Math.max(0,t.cool-dt);t.cannonCool=Math.max(0,(t.cannonCool||0)-dt);t.mgCool=Math.max(0,(t.mgCool||0)-dt);t.rocketCool=Math.max(0,(t.rocketCool||0)-dt);
 if(p===1){if(keys.has("Shift")||mouseDown.right)fire(t,"cannon");if(keys.has(" ")||mouseDown.left)fire(t,"mg");if(keys.has("f"))fire(t,"rocket");if(keys.has("g"))fire(t,"heavy");if(mouseDown.middle)fire(t,weaponCycle[selectedWeapon])}
 else if(pad){if(pad.buttons[7]?.pressed)fire(t,"cannon");if(pad.buttons[5]?.pressed)fire(t,"mg");if(pad.buttons[4]?.pressed)fire(t,weaponCycle[selectedWeapon]);if(pad.buttons[6]?.pressed)fire(t,"heavy");if(pad.buttons[14]?.pressed&&!pad._leftWas)selectedWeapon=(selectedWeapon+weaponCycle.length-1)%weaponCycle.length;if(pad.buttons[15]?.pressed&&!pad._rightWas)selectedWeapon=(selectedWeapon+1)%weaponCycle.length;pad._leftWas=!!pad.buttons[14]?.pressed;pad._rightWas=!!pad.buttons[15]?.pressed;const label=$("weaponLabel");if(label)label.textContent="ARMA: "+weaponCycle[selectedWeapon].toUpperCase()}
 else{if(keys.has("Enter"))fire(t,"cannon");if(keys.has("Control"))fire(t,"mg")}
}
function updateHealthHud(){
 const p1=tanks.find(t=>t.player===1),p2=tanks.find(t=>t.player===2);
 for(const [n,t] of [[1,p1],[2,p2]]){const fill=$("hp"+n+"Fill"),value=$("hp"+n+"Value");if(!fill||!value||!t)continue;const hp=Math.max(0,Math.min(100,t.hp));fill.style.width=hp+"%";fill.classList.toggle("low",hp<=30);value.textContent=Math.ceil(hp)+"%";const card=$("hp"+n+"Card");if(card)card.classList.toggle("destroyed",!t.alive)}
}
function update(dt){elapsed+=dt;updateEngineAudio();for(const t of tanks){if(t.recoil>0){t.recoil=Math.max(0,t.recoil-dt*.75);if(t.barrel)t.barrel.position.z=1.62-t.recoil;}controls(t,dt)}for(const e of enemies){e.cannonCool=Math.max(0,(e.cannonCool||0)-dt);if(!e.alive)continue;const target=tanks.filter(t=>t.alive&&!t.aiAlly).sort((a,b)=>a.root.position.distanceTo(e.root.position)-b.root.position.distanceTo(e.root.position))[0];if(target){const dx=target.root.position.x-e.root.position.x,dz=target.root.position.z-e.root.position.z,ang=Math.atan2(dx,dz);e.root.rotation.y=THREE.MathUtils.damp(e.root.rotation.y,ang,1.4,dt);e.turret.rotation.y=0;e.speed=THREE.MathUtils.damp(e.speed,e.root.position.distanceTo(target.root.position)>12?4:0,2,dt);e.root.position.x+=Math.sin(e.root.rotation.y)*e.speed*dt;e.root.position.z+=Math.cos(e.root.rotation.y)*e.speed*dt;e.cool-=dt;if(e.cool<=0&&e.root.position.distanceTo(target.root.position)<34){e.cool=2.1;const dir=new THREE.Vector3(dx,0,dz).normalize(),pos=e.root.position.clone().add(new THREE.Vector3(0,2,0)).addScaledVector(dir,3);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.9,6),mat(0xff5544));mesh.position.copy(pos);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);scene.add(mesh);shots.push({mesh,dir,owner:e,team:"red",life:3,speed:44,damage:12})}}}
for(let i=shots.length-1;i>=0;i--){const s=shots[i];s.mesh.position.addScaledVector(s.dir,dt*(s.speed||44));s.life-=dt;let hit=null;for(const t of [...tanks,...enemies])if(t!==s.owner&&t.alive&&t.team!==s.team&&s.mesh.position.distanceTo(t.root.position.clone().add(new THREE.Vector3(0,1.2,0)))<2.4){hit=t;break}if(hit){hit.hp-=s.damage||(s.owner.ai?12:25);boom(s.mesh.position);sound("explosion");if(hit.player)radioCall("damage");if(hit.hp<=0){if(hit.player)destroyTank(hit);else{hit.alive=false;hit.root.visible=false}if(mode==="death"&&hit.player){$("status").textContent="JOGADOR "+(hit.player===1?2:1)+" VENCEU!";}else if(hit.ai){score+=100;$("status").textContent="ALVO DESTRUÍDO · "+score+" PONTOS";radioCall("kill")}else if(mode==="death"){$("status").textContent="TANQUE DESTRUÍDO"}}scene.remove(s.mesh);shots.splice(i,1)}else if(s.life<=0||Math.abs(s.mesh.position.x)>85||Math.abs(s.mesh.position.z)>85){scene.remove(s.mesh);shots.splice(i,1)}}
for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;if(e.velocity){e.velocity.y-=9.8*dt;e.mesh.position.addScaledVector(e.velocity,dt);if(e.spin)e.mesh.rotation.x+=e.spin*dt}if(e.flame){e.mesh.scale.set(1+Math.sin(elapsed*18)*.12,1+Math.random()*.12,1+Math.sin(elapsed*15)*.1);e.mesh.material.opacity=.5+Math.random()*.25}else{e.mesh.scale.multiplyScalar(1+dt*(e.life>.4?1.6:3));if(e.mesh.material.opacity!==undefined)e.mesh.material.opacity=Math.max(0,e.life/.6)}if(e.life<=0){scene.remove(e.mesh);effects.splice(i,1)}}
if((mode==="coop"||mode==="solo")&&enemies.filter(e=>e.alive).length<3&&elapsed>round*5){spawnEnemy();if(Math.floor(elapsed)%18===0)round++}
for(let i=shots.length-1;i>=0;i--){const s=shots[i];if(!s)continue;const obj=destructibles.find(o=>o.visible&&Math.hypot(o.position.x-s.mesh.position.x,o.position.z-s.mesh.position.z)<o.userData.radius);if(obj){obj.userData.hp-=s.damage||20;boom(s.mesh.position,.38);sound("explosion");if(obj.userData.hp<=0){obj.visible=false;spawnDebris(obj.position,obj.userData.type);if(obj.userData.type==="barrel"){for(const t of tanks)if(t.alive&&t.root.position.distanceTo(obj.position)<9){t.hp=Math.max(0,t.hp-24);if(t.hp<=0)destroyTank(t)}for(const e of enemies)if(e.alive&&e.root.position.distanceTo(obj.position)<9){e.hp-=35;if(e.hp<=0){e.alive=false;e.root.visible=false}}boom(obj.position,.9);sound("explosion")}}scene.remove(s.mesh);shots.splice(i,1)}}
 updateHealthHud();const alive=enemies.filter(e=>e.alive).length;$("status").textContent=(mode==="coop"||mode==="solo")?"INIMIGOS: "+alive+" · ABATES: "+score:"P1 "+Math.max(0,Math.ceil(tanks[0].hp))+" HP  |  P2 "+Math.max(0,Math.ceil(tanks[1].hp))+" HP";
}
function aimTurretWithMouse(e){const t=tanks.find(x=>x.player===1&&x.alive);if(!t)return;const rect=$("view1").getBoundingClientRect(),ndc=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height)*2+1),ray=new THREE.Raycaster();ray.setFromCamera(ndc,cameras[0]);const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);if(ray.ray.intersectPlane(plane,mouseWorld)){const dx=mouseWorld.x-t.root.position.x,dz=mouseWorld.z-t.root.position.z;t.turret.rotation.y=Math.atan2(dx,dz)-t.root.rotation.y}}
const renderers=[new THREE.WebGLRenderer({canvas:$("view1"),antialias:!matchMedia("(max-width: 700px)").matches,powerPreference:"low-power"}),new THREE.WebGLRenderer({canvas:$("view2"),antialias:!matchMedia("(max-width: 700px)").matches,powerPreference:"low-power"})];for(const r of renderers){r.setPixelRatio(Math.min(devicePixelRatio,matchMedia("(max-width: 700px)").matches?1:1.25));r.shadowMap.enabled=!matchMedia("(max-width: 700px)").matches;r.shadowMap.type=THREE.PCFSoftShadowMap}
let lastFrame=0;function render(){if(!running)return;requestAnimationFrame(render);const pads=navigator.getGamepads?navigator.getGamepads():[];const connected=Array.from(pads).find(p=>p&&p.connected)||null;if(connected&&connected.buttons[0]?.pressed)controllerJoined=true;gamepad2=controllerJoined?connected:null;const now=performance.now(),mobile=matchMedia("(max-width: 700px)").matches,frameInterval=mobile?1000/30:1000/50;if(now-lastFrame<frameInterval)return;lastFrame=now;const dt=Math.min(.05,(now-last)/1000||0);last=now;if(!paused)update(dt);for(let i=0;i<2;i++){const t=tanks[i];if(!t)continue;const canvas=renderers[i].domElement,w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)continue;cameras[i].aspect=w/h;cameras[i].updateProjectionMatrix();aimCamera(cameras[i],t,dt);renderers[i].render(scene,cameras[i])}}
function start(m){unlockAudio();mode=m;selectedWeapon=0;const wl=$("weaponLabel");if(wl)wl.textContent="ARMA: FUMAÇA";for(const e of effects)scene.remove(e.mesh);effects.length=0;game.classList.toggle("solo",mode==="solo");$("view2Wrap").hidden=mode==="solo";$("touchControls").hidden=mode!=="solo";score=0;elapsed=0;round=1;paused=false;for(const o of [...tanks,...enemies])scene.remove(o.root);for(const o of destructibles){o.visible=true;o.userData.hp=o.userData.maxHp}for(const tr of trees){tr.fallen=false;tr.root.rotation.set(0,0,0);tr.root.position.y=0}tanks.length=0;enemies.length=0;shots.forEach(s=>scene.remove(s.mesh));shots.length=0;addTank(1,mode==="death"?-43:-5,mode==="death"?-43:13,0x455735);if(mode==="solo"){const ally=addTank(2,5,13,0x455735);ally.aiAlly=true;document.querySelectorAll(".tag")[1].textContent="ALIADO IA";$("modeLabel").textContent="CAMPANHA SOLO · ALIADO IA"}else{const p2=addTank(2,mode==="death"?43:5,mode==="death"?43:13,mode==="death"?0x8b3028:0x455735);if(mode==="death"){p2.root.rotation.y=Math.PI;tanks[0].root.rotation.y=0;}p2.team=mode==="death"?"red":"blue";document.querySelectorAll(".tag")[1].textContent="JOGADOR 2"}if(mode==="coop"||mode==="solo"){for(let i=0;i<3;i++)spawnEnemy();if(mode==="coop")$("modeLabel").textContent="CAMPANHA COOPERATIVA"}else{$("modeLabel").textContent="DEATHMATCH · X1"}lobby.hidden=true;game.hidden=false;running=true;updateHealthHud();unlockAudio();startEngineAudio();radioCall("start");for(let i=0;i<2;i++){const c=renderers[i].domElement,w=c.clientWidth,h=c.clientHeight;if(w&&h){renderers[i].setSize(w,h,false);cameras[i].aspect=w/h;cameras[i].updateProjectionMatrix()}}last=performance.now();lastFrame=0;render()}
document.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>start(b.dataset.mode)));
$("pause").onclick=()=>{paused=!paused;$("pause").textContent=paused?"CONTINUAR":"PAUSAR";if(paused){stopEngineAudio();clearKeys()}else{unlockAudio();startEngineAudio()}};
$("back").addEventListener("click",()=>{running=false;stopEngineAudio();clearKeys();game.hidden=true;lobby.hidden=false});
document.querySelectorAll("#touchControls [data-key]").forEach(btn=>{const k=btn.dataset.key;const down=e=>{e.preventDefault();keys.add(k)};const up=e=>{e.preventDefault();keys.delete(k)};btn.addEventListener("pointerdown",down);btn.addEventListener("pointerup",up);btn.addEventListener("pointercancel",up);btn.addEventListener("pointerleave",up)});
addEventListener("keydown",e=>{const k=mappedKey(e);if(k==="Enter"||k===" "||k==="Shift")unlockAudio();if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(k))e.preventDefault();if(k==="Escape"){running=false;stopEngineAudio();clearKeys();game.hidden=true;lobby.hidden=false;return}keys.add(k)});
addEventListener("keyup",e=>keys.delete(mappedKey(e)));
addEventListener("blur",clearKeys);document.addEventListener("visibilitychange",()=>{if(document.hidden){stopEngineAudio();clearKeys()}else if(running&&!paused){unlockAudio();startEngineAudio()}});addEventListener("gamepadconnected",e=>{gamepad2=e.gamepad;const h=$("controllerHint");if(h)h.textContent="CONTROLE CONECTADO · APERTE X PARA ENTRAR COMO JOGADOR 2"});addEventListener("gamepaddisconnected",()=>{gamepad2=null;controllerJoined=false;const h=$("controllerHint");if(h)h.textContent="CONECTE UM CONTROLE PARA O JOGADOR 2"});
const v1=$("view1");v1.addEventListener("mousemove",e=>aimTurretWithMouse(e));v1.addEventListener("mousedown",e=>{if(e.button===0)mouseDown.left=true;if(e.button===2)mouseDown.right=true;if(e.button===1){e.preventDefault();fire(tanks.find(t=>t.player===1),weaponCycle[selectedWeapon])}});addEventListener("mouseup",e=>{if(e.button===0)mouseDown.left=false;if(e.button===2)mouseDown.right=false});v1.addEventListener("contextmenu",e=>e.preventDefault());v1.addEventListener("wheel",e=>{e.preventDefault();selectedWeapon=(selectedWeapon+(e.deltaY>0?1:weaponCycle.length-1))%weaponCycle.length;$("weaponLabel").textContent="ARMA: "+weaponCycle[selectedWeapon].toUpperCase()},{passive:false});addEventListener("keydown",e=>{if(e.code==="KeyQ"||e.code==="KeyE"){} });addEventListener("resize",()=>{for(let i=0;i<2;i++){const r=renderers[i],c=r.domElement;if(c.clientWidth&&c.clientHeight){r.setSize(c.clientWidth,c.clientHeight,false);cameras[i].aspect=c.clientWidth/c.clientHeight;cameras[i].updateProjectionMatrix()}}});
