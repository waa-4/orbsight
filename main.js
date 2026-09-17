
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';

const canvas=document.querySelector('#world');
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0b1016);
scene.fog=new THREE.Fog(0x0b1016,18,42);

const camera=new THREE.PerspectiveCamera(55,1,.1,100);
camera.position.set(8,7,10);

const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;

const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.target.set(0,1,0);

scene.add(new THREE.HemisphereLight(0xcdd8ff,0x203020,2.2));
const sun=new THREE.DirectionalLight(0xffffff,2.4);
sun.position.set(8,12,6);
sun.castShadow=true;
scene.add(sun);

const floor=new THREE.Mesh(new THREE.PlaneGeometry(42,42),new THREE.MeshStandardMaterial({color:0x202a27,roughness:1}));
floor.rotation.x=-Math.PI/2;
floor.receiveShadow=true;
scene.add(floor);

const grid=new THREE.GridHelper(42,42,0x34443f,0x27342f);
grid.position.y=.005;
scene.add(grid);

const worldThings=[];
function addThing(type,x,z,color,radius=.5){
  let mesh;
  if(type==='wall'){
    mesh=new THREE.Mesh(new THREE.BoxGeometry(radius*2,1.4,radius*2),new THREE.MeshStandardMaterial({color}));
    mesh.position.set(x,.7,z);
  }else{
    mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,24,16),new THREE.MeshStandardMaterial({color,roughness:.65}));
    mesh.position.set(x,radius,z);
  }
  mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh);
  const item={type,mesh,radius:type==='wall'?radius*1.15:radius};
  worldThings.push(item); return item;
}
addThing('food',-5,-3,0x58cc73,.55);
addThing('food',4,-5,0x58cc73,.48);
addThing('food',6,4,0x58cc73,.62);
addThing('danger',-6,5,0xe85c5c,.65);
addThing('danger',1,7,0xe85c5c,.52);
addThing('wall',-2,2,0x727b88,1.1);
addThing('wall',3,1,0x727b88,1.35);
addThing('wall',0,-6,0x727b88,1.0);

const orb=new THREE.Group();
scene.add(orb);

const shell=new THREE.Mesh(new THREE.SphereGeometry(1.25,40,28),new THREE.MeshStandardMaterial({color:0xd9d4c8,roughness:.78}));
shell.position.y=1.55; shell.castShadow=true; orb.add(shell);

const eyeWhite=new THREE.Mesh(new THREE.SphereGeometry(.47,32,20),new THREE.MeshStandardMaterial({color:0xf4f3ec,roughness:.55}));
eyeWhite.scale.z=.55; eyeWhite.position.set(0,1.7,1.12); orb.add(eyeWhite);

const pupil=new THREE.Mesh(new THREE.SphereGeometry(.20,24,16),new THREE.MeshStandardMaterial({color:0x101216,roughness:.45}));
pupil.scale.z=.5; pupil.position.set(0,1.72,1.48); orb.add(pupil);

const legMat=new THREE.MeshStandardMaterial({color:0x34373d,roughness:.9});
const legs=[];
for(const sx of [-1,1]){
  for(const sz of [-.65,.65]){
    const g=new THREE.Group();
    const upper=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.85,10),legMat);
    const lower=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.8,10),legMat);
    upper.rotation.z=sx*.65; upper.rotation.x=sz*.35; upper.position.set(sx*.95,.75,sz+.05);
    lower.rotation.z=sx*.15; lower.position.set(sx*1.25,.28,sz*1.15);
    g.add(upper,lower); orb.add(g); legs.push(g);
  }
}

let heading=0,targetHeading=0,speed=0,paused=false,follow=true,thought='Looking around...',curiosity=.72,fear=.08,touchPulse=0;
const ui={
  visionText:document.querySelector('#visionText'),touchText:document.querySelector('#touchText'),
  thought:document.querySelector('#thought'),seenList:document.querySelector('#seenList'),
  visionBar:document.querySelector('#visionBar'),touchBar:document.querySelector('#touchBar'),
  curiosityBar:document.querySelector('#curiosityBar'),fearBar:document.querySelector('#fearBar'),
  curiosityText:document.querySelector('#curiosityText'),fearText:document.querySelector('#fearText')
};
ui.curiosityBar.style.width=`${curiosity*100}%`; ui.fearBar.style.width=`${fear*100}%`;

const tmp=new THREE.Vector3(),forward=new THREE.Vector3(),seen=[];
function angleWrap(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}

function sense(){
  seen.length=0; forward.set(Math.sin(heading),0,Math.cos(heading));
  let nearest=null;
  for(const item of worldThings){
    tmp.copy(item.mesh.position).sub(orb.position); tmp.y=0;
    const dist=tmp.length(),dir=tmp.clone().normalize(),dot=forward.dot(dir);
    if(dist<8&&dot>.38){
      const angle=Math.acos(Math.min(1,Math.max(-1,dot)));
      seen.push({item,dist,angle});
      if(!nearest||dist<nearest.dist) nearest={item,dist,angle};
    }
  }
  seen.sort((a,b)=>a.dist-b.dist);
  if(nearest){
    ui.visionText.textContent=`${nearest.item.type} ${nearest.dist.toFixed(1)}m`;
    ui.visionBar.style.width=`${Math.max(8,100-nearest.dist*11)}%`;
  }else{
    ui.visionText.textContent='nothing'; ui.visionBar.style.width='4%';
  }
  ui.seenList.innerHTML=seen.length?seen.slice(0,5).map(s=>`<li>${s.item.type} — ${s.dist.toFixed(1)}m</li>`).join(''):'<li>none yet</li>';
  return nearest;
}

function decide(nearest){
  if(nearest&&nearest.item.type==='danger'&&nearest.dist<4.5){
    fear=Math.min(1,fear+.12); thought='Danger seen. Backing away.';
    const p=nearest.item.mesh.position;
    targetHeading=Math.atan2(orb.position.x-p.x,orb.position.z-p.z); speed=.95;
  }else if(nearest&&nearest.item.type==='food'&&curiosity>.45){
    fear=Math.max(.04,fear-.015); thought='Interesting green object. Investigating.';
    const p=nearest.item.mesh.position;
    targetHeading=Math.atan2(p.x-orb.position.x,p.z-orb.position.z); speed=.72;
  }else{
    fear=Math.max(.04,fear-.006); thought='Nothing urgent. Wandering.';
    if(Math.random()<.28) targetHeading+=(Math.random()-.5)*1.6;
    speed=.36;
  }
  ui.thought.textContent=thought;
  ui.fearText.textContent=`${Math.round(fear*100)}%`;
  ui.fearBar.style.width=`${fear*100}%`;
}

let thinkTimer=0;
function collideAndTouch(dt){
  touchPulse=Math.max(0,touchPulse-dt*2.6); let touching=null;
  for(const item of worldThings){
    const dx=orb.position.x-item.mesh.position.x,dz=orb.position.z-item.mesh.position.z;
    const dist=Math.hypot(dx,dz),minDist=1.05+item.radius;
    if(dist<minDist){
      touching=item.type; touchPulse=1;
      const nx=dx/(dist||1),nz=dz/(dist||1);
      orb.position.x=item.mesh.position.x+nx*minDist;
      orb.position.z=item.mesh.position.z+nz*minDist;
      targetHeading+=Math.PI*.65+(Math.random()-.5); speed*=.35;
    }
  }
  const edge=18.5;
  if(Math.abs(orb.position.x)>edge||Math.abs(orb.position.z)>edge){
    orb.position.x=THREE.MathUtils.clamp(orb.position.x,-edge,edge);
    orb.position.z=THREE.MathUtils.clamp(orb.position.z,-edge,edge);
    targetHeading+=Math.PI; touching='world edge'; touchPulse=1;
  }
  ui.touchText.textContent=touching||'none';
  ui.touchBar.style.width=`${touchPulse*100}%`;
}

let walkT=0;
function animateBody(dt){walkT+=dt*speed*10;legs.forEach((leg,i)=>{leg.rotation.x=Math.sin(walkT+i*Math.PI)*.12*speed;});}

const clock=new THREE.Clock();
function resize(){
  const rect=canvas.getBoundingClientRect(),w=Math.max(1,rect.width),h=Math.max(1,rect.height);
  renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
}

function tick(){
  requestAnimationFrame(tick);
  const dt=Math.min(.05,clock.getDelta());
  resize();

  if(!paused){
    thinkTimer-=dt;
    if(thinkTimer<=0){const nearest=sense();decide(nearest);thinkTimer=.65+Math.random()*.35;}
    const delta=angleWrap(targetHeading-heading);
    heading+=THREE.MathUtils.clamp(delta,-dt*2.8,dt*2.8);
    orb.rotation.y=heading;
    orb.position.x+=Math.sin(heading)*speed*dt;
    orb.position.z+=Math.cos(heading)*speed*dt;
    collideAndTouch(dt);
    animateBody(dt);
  }

  if(follow){
    const desired=new THREE.Vector3(orb.position.x+7.5,6.3,orb.position.z+9);
    camera.position.lerp(desired,.025);
    controls.target.lerp(new THREE.Vector3(orb.position.x,1.2,orb.position.z),.05);
  }

  controls.update(); renderer.render(scene,camera);
}
tick();

document.querySelector('#pauseBtn').addEventListener('click',e=>{paused=!paused;e.currentTarget.textContent=paused?'Resume':'Pause';});
document.querySelector('#followBtn').addEventListener('click',e=>{follow=!follow;e.currentTarget.textContent=`Follow: ${follow?'ON':'OFF'}`;});
document.querySelector('#resetBtn').addEventListener('click',()=>{orb.position.set(0,0,0);heading=targetHeading=0;fear=.08;thought='Looking around...';ui.thought.textContent=thought;});
window.addEventListener('resize',resize);
