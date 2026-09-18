import * as THREE from "three";
import RAPIER from "rapier";

const V=(x=0,y=0,z=0)=>({x,y,z});
const rand=(a,b)=>a+Math.random()*(b-a);

export function setupWorld(app){
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(72,72),new THREE.MeshStandardMaterial({color:0x202a27,roughness:1}));
  floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;app.scene.add(floor);
  const grid=new THREE.GridHelper(72,72,0x34443f,0x27342f);grid.position.y=0.006;app.scene.add(grid);
  app.floor=floor;app.grid=grid
}
function color(t){return({food:0x58cc73,bed:0xc7b7e8,wall:0x727b88,platform:0x596b63,slope:0x65756c,pushblock:0x9b7653,ball:0xd68df0,log:0x8b5e3c,plank:0xa77c50,toy:0x68a8ff})[t]||0xffffff}
function mat(t){return new THREE.MeshStandardMaterial({color:color(t),roughness:0.82})}
function sync(it){if(!it.dynamic)return;const p=it.body.translation(),q=it.body.rotation();it.mesh.position.set(p.x,p.y,p.z);it.mesh.quaternion.set(q.x,q.y,q.z,q.w)}
function fixedDesc(x,y,z){return RAPIER.RigidBodyDesc.fixed().setTranslation(x,y,z)}
function dynDesc(x,y,z){return RAPIER.RigidBodyDesc.dynamic().setTranslation(x,y,z).setLinearDamping(0.08).setAngularDamping(0.10)}

export function addObject(app,type,x,z,r=0.6,y=null){
  const P=app.P;x=Math.max(-33,Math.min(33,x));z=Math.max(-33,Math.min(33,z));r=Math.max(0.18,r);
  let mesh,body,collider,dynamic=false,meta={};
  if(type==="wall"){
    const h=1.5,py=y??h/2;body=P.world.createRigidBody(fixedDesc(x,py,z));collider=P.world.createCollider(RAPIER.ColliderDesc.cuboid(r,h/2,r).setFriction(0.8),body);mesh=new THREE.Mesh(new THREE.BoxGeometry(r*2,h,r*2),mat(type));meta={hx:r,hz:r,hy:h/2,top:py+h/2};
  }else if(type==="platform"||type==="bed"){
    const hx=type==="bed"?Math.max(0.9,r*1.4):Math.max(0.7,r*1.65),hz=type==="bed"?Math.max(0.65,r):Math.max(0.7,r*1.65),hy=type==="bed"?0.12:0.16,py=y??hy;
    body=P.world.createRigidBody(fixedDesc(x,py,z));collider=P.world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz).setFriction(type==="bed"?1.2:0.9),body);mesh=new THREE.Mesh(new THREE.BoxGeometry(hx*2,hy*2,hz*2),mat(type));meta={hx,hz,hy,top:py+hy};
  }else if(type==="pushblock"){
    dynamic=true;const h=Math.max(0.24,r*0.65),py=y??h;body=P.world.createRigidBody(dynDesc(x,py,z));collider=P.world.createCollider(RAPIER.ColliderDesc.cuboid(h,h,h).setDensity(0.35).setFriction(0.7),body);mesh=new THREE.Mesh(new THREE.BoxGeometry(h*2,h*2,h*2),mat(type));r=h;meta={hx:h,hz:h,hy:h,top:py+h};
  }else if(type==="ball"){
    dynamic=true;const rad=Math.max(0.20,r*0.72),py=y??rad;body=P.world.createRigidBody(dynDesc(x,py,z));collider=P.world.createCollider(RAPIER.ColliderDesc.ball(rad).setDensity(0.28).setFriction(0.5).setRestitution(0.12),body);mesh=new THREE.Mesh(new THREE.SphereGeometry(rad,20,14),mat(type));r=rad;
  }else if(type==="log"){
    dynamic=true;const rad=Math.max(0.18,r*0.45),len=Math.max(0.65,r*1.6),py=y??rad;body=P.world.createRigidBody(dynDesc(x,py,z).setRotation({x:0,y:0,z:Math.sin(Math.PI/4),w:Math.cos(Math.PI/4)}));collider=P.world.createCollider(RAPIER.ColliderDesc.cylinder(len/2,rad).setDensity(0.30).setFriction(0.65),body);mesh=new THREE.Mesh(new THREE.CylinderGeometry(rad,rad,len,12),mat(type));mesh.rotation.z=Math.PI/2;r=Math.max(rad,len/2);
  }else if(type==="plank"||type==="slope"){
    const hx=Math.max(0.75,r*1.35),hy=0.09,hz=0.30,py=y??0.22;dynamic=type==="plank";const angle=type==="slope"?-0.20:0,rot={x:0,y:0,z:Math.sin(angle/2),w:Math.cos(angle/2)};
    body=P.world.createRigidBody((dynamic?dynDesc(x,py,z):fixedDesc(x,py,z)).setRotation(rot));collider=P.world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz).setDensity(0.28).setFriction(0.8),body);mesh=new THREE.Mesh(new THREE.BoxGeometry(hx*2,hy*2,hz*2),mat(type));r=hx;meta={hx,hz,hy,top:py+hy};
  }else{
    const rad=r,py=y??rad;body=P.world.createRigidBody(fixedDesc(x,py,z));collider=P.world.createCollider(RAPIER.ColliderDesc.ball(rad).setFriction(0.7),body);mesh=new THREE.Mesh(new THREE.SphereGeometry(rad,18,12),mat(type));
  }
  const p=body.translation(),q=body.rotation();mesh.position.set(p.x,p.y,p.z);mesh.quaternion.set(q.x,q.y,q.z,q.w);mesh.castShadow=true;mesh.receiveShadow=true;app.scene.add(mesh);
  const it={id:app.nextObjectId++,type,mesh,body,collider,r,dynamic,active:true,meta};app.objects.push(it);return it
}
export function clearObjects(app){for(const it of app.objects){app.scene.remove(it.mesh);try{app.P.world.removeRigidBody(it.body)}catch{}}app.objects.length=0}
export function resetMap(app){
  clearObjects(app);
  addObject(app,"food",-3,-2,0.4);addObject(app,"food",3,-3,0.4);addObject(app,"toy",1,3,0.45);
  for(let i=0;i<5;i++)addObject(app,"platform",-8+i*1.7,-8,0.46,0.14+i*0.10);
  addObject(app,"slope",-1.5,-9,1,0.20);addObject(app,"ball",3,-9,0.5);
  addObject(app,"bed",-4,7,1,0.14);addObject(app,"bed",0,7,1,0.14);addObject(app,"bed",4,7,1,0.14);
  addObject(app,"platform",-14,-3,1.1,0.30);addObject(app,"platform",-14,0,1.2,0.52);addObject(app,"platform",-14,3,1.3,0.78);addObject(app,"platform",-14,6,1.4,1.02);
  addObject(app,"pushblock",10,-7,0.72);addObject(app,"pushblock",12,-7,0.72);addObject(app,"ball",9,-10,0.6);addObject(app,"ball",12,-10,0.9);addObject(app,"log",15,-8,0.85);addObject(app,"plank",14,-4,0.9);
  addObject(app,"wall",15,5,0.62);addObject(app,"platform",13.2,5,0.58,0.42);addObject(app,"platform",13.2,7,0.58,0.74);addObject(app,"platform",13.2,9,0.58,1.06);
  for(let z=-2;z<=8;z+=1.5)addObject(app,"platform",22,z,0.32,0.50);
  [[-6,21],[-3,21],[0,21],[3,21],[-6,24],[0,24],[6,24],[-3,27],[0,27],[3,27]].forEach(([x,z])=>addObject(app,"wall",x,z,0.45));
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2;addObject(app,"food",-20+Math.cos(a)*3,-18+Math.sin(a)*3,0.35)}
}
export function updateWorld(app){
  const phase=(app.simTime/160)%1,day=0.5+0.5*Math.sin(phase*Math.PI*2-Math.PI/2);
  app.sun.intensity=0.8+day*1.8;
  const bg=new THREE.Color().setHSL(0.60,0.24,0.045+day*0.055);app.scene.background.copy(bg);app.scene.fog.color.copy(bg);
  for(const it of app.objects)sync(it)
}
export function nearby(app,o,type,maxD=999){
  const p=o.shell.translation();let best=null,bd=maxD;
  for(const it of app.objects){if(!it.active||(type&&it.type!==type))continue;const q=it.body.translation(),d=Math.hypot(q.x-p.x,q.z-p.z);if(d<bd){bd=d;best=it}}
  return best?{it:best,dist:bd}:null
}
