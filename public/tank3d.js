const $=id=>document.getElementById(id), lobby=$("lobby"), game=$("game");
$("back").onclick=()=>location.href="/";
let mode="coop",running=false,paused=false,last=0,elapsed=0,score=0,round=1;
const keys=new Set(), tanks=[],shots=[],enemies=[],effects=[];
const scene=new THREE.Scene();scene.background=new THREE.Color(0x9bb3c4);scene.fog=new THREE.Fog(0x9bb3c4,55,145);
scene.add(new THREE.HemisphereLight(0xe8f1ff,0x465033,2.1));
const sun=new THREE.DirectionalLight(0xffe4b5,2.3);sun.position.set(-25,40,18);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
const terrainCanvas=document.createElement("canvas");terrainCanvas.width=terrainCanvas.height=512;const tx=terrainCanvas.getContext("2d");tx.fillStyle="#596448";tx.fillRect(0,0,512,512);let seed=41;const rnd=()=>((seed=seed*1664525+1013904223>>>0)/4294967296);for(let i=0;i<15000;i++){const x=rnd()*512,y=rnd()*512,r=1+rnd()*8;tx.fillStyle=rnd()>.5?"rgba(32,47,25,.13)":"rgba(174,158,104,.09)";tx.beginPath();tx.ellipse(x,y,r,r*.55,rnd()*3,0,Math.PI*2);tx.fill()}const terrainTex=new THREE.CanvasTexture(terrainCanvas);terrainTex.wrapS=terrainTex.wrapT=THREE.RepeatWrapping;terrainTex.repeat.set(9,9);terrainTex.colorSpace=THREE.SRGBColorSpace;
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
 const roadTexCanvas=document.createElement("canvas");roadTexCanvas.width=roadTexCanvas.height=512;const c=roadTexCanvas.getContext("2d");c.fillStyle="#343a35";c.fillRect(0,0,512,512);let sd=17;const rr=()=>((sd=sd*1664525+1013904223>>>0)/4294967296);for(let i=0;i<12000;i++){const x=rr()*512,y=rr()*512;c.fillStyle=rr()>.5?"rgba(12,15,13,.24)":"rgba(170,164,139,.10)";c.beginPath();c.arc(x,y,rr()*2.5,0,Math.PI*2);c.fill()}const tex=new THREE.CanvasTexture(roadTexCanvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(1,18);tex.colorSpace=THREE.SRGBColorSpace;
 const road=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:tex,roughness:.98,side:THREE.DoubleSide}));road.receiveShadow=true;scene.add(road);
 const shoulderMat=mat(0x77745c,1),edgeMat=mat(0xbbb18b,1);
 for(let i=0;i<segments;i+=4){const p=curve.getPoint(i/segments),tan=curve.getTangent(i/segments),side=new THREE.Vector3(-tan.z,0,tan.x).normalize();for(const s of [-1,1]){const dash=new THREE.Mesh(new THREE.BoxGeometry(.13,.025,1.3),edgeMat);dash.position.copy(p).addScaledVector(side,s*5.9);dash.position.y=.075;dash.rotation.y=Math.atan2(tan.x,tan.z);scene.add(dash)}}
}
function scatter(){
 const trunkMat=mat(0x55402d),leafMats=[mat(0x203a27),mat(0x2e4c30),mat(0x405b35)],rockMat=mat(0x625f4b);
 for(let i=0;i<92;i++){let x,z;do{x=(Math.random()-.5)*145;z=(Math.random()-.5)*145}while((Math.abs(x)<13&&z<45&&z>-60)|| (Math.abs(x)<10&&Math.abs(z)<18));const tree=new THREE.Group();const h=2.1+Math.random()*2.4;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.28,h,7),trunkMat);trunk.position.y=h/2;tree.add(trunk);for(let j=0;j<3;j++){const crown=new THREE.Mesh(new THREE.ConeGeometry(1.25-j*.2,2.5,7),leafMats[(i+j)%3]);crown.position.y=h*.72+j*.72;tree.add(crown)}tree.position.set(x,0,z);tree.rotation.y=Math.random()*Math.PI;tree.scale.setScalar(.8+Math.random()*.6);tree.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});scene.add(tree);
 if(i%2===0){const bush=new THREE.Mesh(new THREE.DodecahedronGeometry(.7+Math.random()*.5,0),leafMats[i%3]);bush.position.set(x+(Math.random()-.5)*3,.45,z+(Math.random()-.5)*3);bush.scale.y=.65;scene.add(bush)}
 }
 for(let i=0;i<34;i++){const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.45+Math.random()*.8,0),rockMat);rock.position.set((Math.random()-.5)*140,.3,(Math.random()-.5)*140);rock.scale.set(1,.6,.8);rock.rotation.set(Math.random(),Math.random(),Math.random());scene.add(rock)}
}
buildRoad();scatter();
const cameras=[new THREE.PerspectiveCamera(49,1,.1,250),new THREE.PerspectiveCamera(56,1,.1,250)];
function aimCamera(cam,t,dt){const forward=new THREE.Vector3(Math.sin(t.root.rotation.y),0,Math.cos(t.root.rotation.y));const pos=t.root.position.clone().add(new THREE.Vector3(0,7.1,0)).addScaledVector(forward,-13.5);const smooth=1-Math.exp(-4.8*dt);cam.position.lerp(pos,smooth);const look=t.root.position.clone().add(new THREE.Vector3(0,1.7,0)).addScaledVector(forward,7.5);cam.userData.lookAt=cam.userData.lookAt||look.clone();cam.userData.lookAt.lerp(look,1-Math.exp(-6.5*dt));cam.lookAt(cam.userData.lookAt)}
function spawnEnemy(){const t=makeTank(0x554b36);t.root.position.set((Math.random()-.5)*34,0,-35-Math.random()*24);t.hp=65;t.maxHp=65;t.player=0;t.ai=true;t.team="red";scene.add(t.root);enemies.push(t)}
function fire(t){if(!t.alive||t.cool>0)return;t.cool=.72;if(t.barrel){t.recoil=.16;t.barrel.position.z=1.46;}const dir=new THREE.Vector3(Math.sin(t.root.rotation.y+t.turret.rotation.y),0,Math.cos(t.root.rotation.y+t.turret.rotation.y));const pos=t.root.position.clone().add(new THREE.Vector3(0,2.2,0)).addScaledVector(dir,3.3);const mesh=new THREE.Mesh(new THREE.SphereGeometry(.22,10,8),mat(0xffb84a,.25,.3));mesh.position.copy(pos);scene.add(mesh);shots.push({mesh,dir,owner:t,team:t.team,life:2.6});}
function boom(pos){const m=new THREE.Mesh(new THREE.SphereGeometry(.6,12,10),new THREE.MeshBasicMaterial({color:0xff8a28,transparent:true,opacity:.8}));m.position.copy(pos);scene.add(m);effects.push({mesh:m,life:.32})}
function controls(t,dt){
 if(!t.alive)return;
 if(t.aiAlly){const target=tanks.find(x=>x.player===1),foe=enemies.filter(x=>x.alive).sort((a,b)=>a.root.position.distanceTo(t.root.position)-b.root.position.distanceTo(t.root.position))[0];if(target){const desired=target.root.position.clone().add(new THREE.Vector3(-Math.sin(target.root.rotation.y)*6,0,-Math.cos(target.root.rotation.y)*6));const dx=desired.x-t.root.position.x,dz=desired.z-t.root.position.z,dist=Math.hypot(dx,dz);if(dist>4){const ang=Math.atan2(dx,dz);t.root.rotation.y=THREE.MathUtils.damp(t.root.rotation.y,ang,2.3,dt);t.speed=THREE.MathUtils.damp(t.speed,Math.min(7,dist)*.8,1.7,dt);t.root.position.x+=Math.sin(t.root.rotation.y)*t.speed*dt;t.root.position.z+=Math.cos(t.root.rotation.y)*t.speed*dt}else t.speed=THREE.MathUtils.damp(t.speed,0,3,dt);if(foe){const ax=foe.root.position.x-t.root.position.x,az=foe.root.position.z-t.root.position.z,ang=Math.atan2(ax,az);t.turret.rotation.y=THREE.MathUtils.damp(t.turret.rotation.y,ang-t.root.rotation.y,3,dt);t.cool=Math.max(0,t.cool-dt);if(t.cool<=0&&Math.hypot(ax,az)<42)fire(t)}}return}
 const p=t.player,forward=p===1?(keys.has("w")?1:0)-(keys.has("s")?1:0):(keys.has("ArrowUp")?1:0)-(keys.has("ArrowDown")?1:0),turn=p===1?(keys.has("d")?1:0)-(keys.has("a")?1:0):(keys.has("ArrowRight")?1:0)-(keys.has("ArrowLeft")?1:0),turret=p===1?(keys.has("q")?1:0)-(keys.has("e")?1:0):(keys.has(",")?1:0)-(keys.has(".")?1:0);
 const maxSpeed=forward<0?4.2:10.5,desired=forward*maxSpeed;
 t.speed=THREE.MathUtils.damp(t.speed,desired,forward===0?2.2:3.8,dt);
 const steerFactor=.34+Math.min(1,Math.abs(t.speed)/6)*.72;
 t.root.rotation.y+=turn*1.05*steerFactor*dt*(t.speed<0?-1:1);
 if(Math.abs(t.speed)<.25&&turn!==0)t.root.rotation.y+=turn*.35*dt;
 t.root.position.x+=Math.sin(t.root.rotation.y)*t.speed*dt;t.root.position.z+=Math.cos(t.root.rotation.y)*t.speed*dt;
 t.root.position.x=THREE.MathUtils.clamp(t.root.position.x,-72,72);t.root.position.z=THREE.MathUtils.clamp(t.root.position.z,-72,72);
 t.turret.rotation.y+=turret*1.45*dt;t.cool=Math.max(0,t.cool-dt);
 if((p===1&&keys.has(" "))||(p===2&&keys.has("Enter")))fire(t);
}
function update(dt){elapsed+=dt;for(const t of tanks){if(t.recoil>0){t.recoil=Math.max(0,t.recoil-dt*.75);if(t.barrel)t.barrel.position.z=1.62-t.recoil;}controls(t,dt)}for(const e of enemies){if(!e.alive)continue;const target=tanks.filter(t=>t.alive&&!t.aiAlly).sort((a,b)=>a.root.position.distanceTo(e.root.position)-b.root.position.distanceTo(e.root.position))[0];if(target){const dx=target.root.position.x-e.root.position.x,dz=target.root.position.z-e.root.position.z,ang=Math.atan2(dx,dz);e.root.rotation.y=THREE.MathUtils.damp(e.root.rotation.y,ang,1.4,dt);e.turret.rotation.y=0;e.speed=THREE.MathUtils.damp(e.speed,e.root.position.distanceTo(target.root.position)>12?4:0,2,dt);e.root.position.x+=Math.sin(e.root.rotation.y)*e.speed*dt;e.root.position.z+=Math.cos(e.root.rotation.y)*e.speed*dt;e.cool-=dt;if(e.cool<=0&&e.root.position.distanceTo(target.root.position)<34){e.cool=2.1;const dir=new THREE.Vector3(dx,0,dz).normalize(),pos=e.root.position.clone().add(new THREE.Vector3(0,2,0)).addScaledVector(dir,3);const mesh=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),mat(0xff5544));mesh.position.copy(pos);scene.add(mesh);shots.push({mesh,dir,owner:e,team:"red",life:3})}}}
for(let i=shots.length-1;i>=0;i--){const s=shots[i];s.mesh.position.addScaledVector(s.dir,dt*34);s.life-=dt;let hit=null;for(const t of [...tanks,...enemies])if(t!==s.owner&&t.alive&&t.team!==s.team&&s.mesh.position.distanceTo(t.root.position.clone().add(new THREE.Vector3(0,1.2,0)))<2.4){hit=t;break}if(hit){hit.hp-=s.owner.ai?12:25;boom(s.mesh.position);if(hit.hp<=0){hit.alive=false;hit.root.visible=false;if(mode==="death"&&hit.player){$("status").textContent="JOGADOR "+(hit.player===1?2:1)+" VENCEU!";paused=true}else if(hit.ai){score+=100;$("status").textContent="ALVO DESTRUÍDO · "+score+" PONTOS"}else if(mode==="death"){$("status").textContent="TANQUE DESTRUÍDO"}}scene.remove(s.mesh);shots.splice(i,1)}else if(s.life<=0||Math.abs(s.mesh.position.x)>85||Math.abs(s.mesh.position.z)>85){scene.remove(s.mesh);shots.splice(i,1)}}
for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;e.mesh.scale.multiplyScalar(1+dt*3);e.mesh.material.opacity=Math.max(0,e.life/.32);if(e.life<=0){scene.remove(e.mesh);effects.splice(i,1)}}
if((mode==="coop"||mode==="solo")&&enemies.filter(e=>e.alive).length<3&&elapsed>round*5){spawnEnemy();if(Math.floor(elapsed)%18===0)round++}
const alive=enemies.filter(e=>e.alive).length;$("status").textContent=(mode==="coop"||mode==="solo")?"INIMIGOS: "+alive+" · ABATES: "+score:"P1 "+Math.max(0,Math.ceil(tanks[0].hp))+" HP  |  P2 "+Math.max(0,Math.ceil(tanks[1].hp))+" HP";
}
const renderers=[new THREE.WebGLRenderer({canvas:$("view1"),antialias:true}),new THREE.WebGLRenderer({canvas:$("view2"),antialias:true})];for(const r of renderers){r.setPixelRatio(Math.min(devicePixelRatio,1.35));r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap}
function render(){if(!running)return;requestAnimationFrame(render);const now=performance.now(),dt=Math.min(.04,(now-last)/1000||0);last=now;if(!paused)update(dt);for(let i=0;i<2;i++){const t=tanks[i];if(!t)continue;const canvas=renderers[i].domElement,w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)continue;cameras[i].aspect=w/h;cameras[i].updateProjectionMatrix();aimCamera(cameras[i],t,dt);renderers[i].render(scene,cameras[i])}}
function start(m){mode=m;game.classList.toggle("solo",mode==="solo");$("view2Wrap").hidden=mode==="solo";$("touchControls").hidden=mode!=="solo";score=0;elapsed=0;round=1;paused=false;for(const o of [...tanks,...enemies])scene.remove(o.root);tanks.length=0;enemies.length=0;shots.forEach(s=>scene.remove(s.mesh));shots.length=0;addTank(1,-5,13,0x455735);if(mode==="solo"){const ally=addTank(2,5,13,0x455735);ally.aiAlly=true;document.querySelectorAll(".tag")[1].textContent="ALIADO IA";$("modeLabel").textContent="CAMPANHA SOLO · ALIADO IA"}else{addTank(2,5,13,mode==="death"?0x8b3028:0x455735);document.querySelectorAll(".tag")[1].textContent="JOGADOR 2"}if(mode==="coop"||mode==="solo"){for(let i=0;i<3;i++)spawnEnemy();if(mode==="coop")$("modeLabel").textContent="CAMPANHA COOPERATIVA"}else{$("modeLabel").textContent="DEATHMATCH · X1"}lobby.hidden=true;game.hidden=false;running=true;for(let i=0;i<2;i++){const c=renderers[i].domElement,w=c.clientWidth,h=c.clientHeight;if(w&&h){renderers[i].setSize(w,h,false);cameras[i].aspect=w/h;cameras[i].updateProjectionMatrix()}}last=performance.now();render()}
document.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>start(b.dataset.mode)));
$("pause").onclick=()=>{paused=!paused;$("pause").textContent=paused?"CONTINUAR":"PAUSAR"};
$("back").addEventListener("click",()=>{running=false;game.hidden=true;lobby.hidden=false});
document.querySelectorAll("#touchControls [data-key]").forEach(btn=>{const k=btn.dataset.key;const down=e=>{e.preventDefault();keys.add(k)};const up=e=>{e.preventDefault();keys.delete(k)};btn.addEventListener("pointerdown",down);btn.addEventListener("pointerup",up);btn.addEventListener("pointercancel",up);btn.addEventListener("pointerleave",up)});
addEventListener("keydown",e=>{if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault();if(e.key==="Escape"){running=false;game.hidden=true;lobby.hidden=false}keys.add(e.key===" "?" ":e.key)});
addEventListener("keyup",e=>keys.delete(e.key===" "?" ":e.key));
addEventListener("blur",()=>keys.clear());
addEventListener("resize",()=>{for(let i=0;i<2;i++){const r=renderers[i],c=r.domElement;if(c.clientWidth&&c.clientHeight){r.setSize(c.clientWidth,c.clientHeight,false);cameras[i].aspect=c.clientWidth/c.clientHeight;cameras[i].updateProjectionMatrix()}}});
