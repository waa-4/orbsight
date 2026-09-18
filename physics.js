import * as THREE from "three";
import RAPIER from "rapier";

const V=(x=0,y=0,z=0)=>({x,y,z});
const Q=(x=0,y=0,z=0,w=1)=>({x,y,z,w});
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const JOINT_LIMITS={
  spread:[-0.38,0.38],
  hip:[-0.62,0.62],
  knee:[0.00,1.02],
  ankle:[-0.38,0.46],
  roll:[-0.30,0.30]
};
const NEUTRAL={spread:0,hip:-0.08,knee:0.26,ankle:0.08,roll:0};

export async function createPhysics(){
  await RAPIER.init();
  const world=new RAPIER.World(V(0,-9.82,0));
  world.timestep=1/180;
  const ground=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,-0.03,0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(36,0.03,36).setFriction(1.0),ground);
  return{RAPIER,world,ground,JOINT_LIMITS,NEUTRAL};
}

function qFromZ(angle){
  const h=angle/2;return Q(0,0,Math.sin(h),Math.cos(h));
}
function bodyDesc(pos,rot,lin=.08,ang=.14){
  return RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x,pos.y,pos.z).setRotation(rot).setLinearDamping(lin).setAngularDamping(ang).setCanSleep(false);
}
function addDynamic(P,desc,colliderDesc){
  const b=P.world.createRigidBody(desc);P.world.createCollider(colliderDesc,b);return b
}
function meshPose(mesh,body){
  const p=body.translation(),q=body.rotation();mesh.position.set(p.x,p.y,p.z);mesh.quaternion.set(q.x,q.y,q.z,q.w)
}
function makeRevolute(P,a,b,anchorA,anchorB,axis,min,max,name){
  const data=RAPIER.JointData.revolute(anchorA,anchorB,axis);
  data.limitsEnabled=true;
  data.limits=[min,max];
  const j=P.world.createImpulseJoint(data,a,b,true);
  j.setLimits(min,max);
  j.setContactsEnabled(false);
  j.configureMotorPosition(0,18,3.6);
  return{name,joint:j,min,max,target:0,stiffness:18,damping:3.6}
}
function relAngle(bodyA,bodyB,axis){
  const qa=bodyA.rotation(),qb=bodyB.rotation();
  const A=new THREE.Quaternion(qa.x,qa.y,qa.z,qa.w);
  const B=new THREE.Quaternion(qb.x,qb.y,qb.z,qb.w);
  const R=A.clone().invert().multiply(B);
  const e=new THREE.Euler().setFromQuaternion(R,"XYZ");
  return axis==="x"?e.x:e.z
}
function cylinderMesh(len,rad,mat){
  return new THREE.Mesh(new THREE.CylinderGeometry(rad,rad,len,8),mat)
}

export function createOrbsightBody(P,scene,id,x=0,z=0){
  const shellY=1.42;
  const shell=addDynamic(P,
    bodyDesc(V(x,shellY,z),Q(),0.07,0.24),
    RAPIER.ColliderDesc.ball(0.62).setDensity(0.45).setFriction(0.55)
  );
  const shellMesh=new THREE.Mesh(new THREE.SphereGeometry(0.62,28,20),new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL((id*0.137)%1,0.22,0.78),roughness:0.82}));
  shellMesh.castShadow=true;scene.add(shellMesh);

  const eyeRoot=new THREE.Group();
  const eyeWhite=new THREE.Mesh(new THREE.SphereGeometry(0.30,20,14),new THREE.MeshStandardMaterial({color:0xf7f6ef,roughness:0.5}));
  const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.115,16,10),new THREE.MeshStandardMaterial({color:0x0c0e11}));
  eyeWhite.scale.z=0.55;eyeRoot.add(eyeWhite);pupil.scale.z=0.45;pupil.position.z=0.275;eyeRoot.add(pupil);scene.add(eyeRoot);

  const limbMat=new THREE.MeshStandardMaterial({color:0x383d45,roughness:0.9});
  const jointMat=new THREE.MeshStandardMaterial({color:0x505762,roughness:0.8});
  const parts=[{body:shell,mesh:shellMesh}],joints=[],legs=[];
  const defs=[[-1,1],[1,1],[-1,-1],[1,-1]];
  const L1=0.50,L2=0.46,splay=0.23,hipY=shellY-0.18;

  defs.forEach(([side,front],i)=>{
    const hip=V(x+side*0.61,hipY,z+front*0.38);
    const sx=side*Math.sin(splay),sy=-Math.cos(splay);
    const knee=V(hip.x+sx*L1,hip.y+sy*L1,hip.z);
    const ankle=V(knee.x+sx*L2,knee.y+sy*L2,knee.z);
    const rot=qFromZ(side*splay);

    const hipMount=addDynamic(P,bodyDesc(hip,rot,0.08,0.20),RAPIER.ColliderDesc.ball(0.065).setDensity(0.20).setFriction(0.55));
    const upper=addDynamic(P,bodyDesc(V((hip.x+knee.x)/2,(hip.y+knee.y)/2,hip.z),rot,0.06,0.16),RAPIER.ColliderDesc.cuboid(0.06,L1/2,0.06).setDensity(0.32).setFriction(0.55));
    const lower=addDynamic(P,bodyDesc(V((knee.x+ankle.x)/2,(knee.y+ankle.y)/2,knee.z),rot,0.06,0.17),RAPIER.ColliderDesc.cuboid(0.056,L2/2,0.056).setDensity(0.30).setFriction(0.55));
    const ankleMount=addDynamic(P,bodyDesc(ankle,rot,0.08,0.20),RAPIER.ColliderDesc.ball(0.06).setDensity(0.18).setFriction(0.65));
    const footPos=V(ankle.x+side*0.045,Math.max(0.085,ankle.y-0.045),ankle.z+front*0.13);
    const foot=addDynamic(P,bodyDesc(footPos,rot,0.10,0.26),RAPIER.ColliderDesc.cuboid(0.12,0.055,0.22).setDensity(0.36).setFriction(2.2));

    const hm=new THREE.Mesh(new THREE.SphereGeometry(0.07,10,8),jointMat);
    const um=cylinderMesh(L1,0.06,limbMat),lm=cylinderMesh(L2,0.056,limbMat);
    const am=new THREE.Mesh(new THREE.SphereGeometry(0.062,10,8),jointMat);
    const fm=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.11,0.44),limbMat);
    [hm,um,lm,am,fm].forEach(m=>{m.castShadow=true;scene.add(m)});
    parts.push({body:hipMount,mesh:hm},{body:upper,mesh:um},{body:lower,mesh:lm},{body:ankleMount,mesh:am},{body:foot,mesh:fm});

    // Because every segment starts with the same outward Z rotation, these local axes align in world-space.
    const spread=makeRevolute(P,shell,hipMount,V(side*0.61,-0.18,front*0.38),V(0,0,0),V(0,0,1),...JOINT_LIMITS.spread,"spread");
    const hipJ=makeRevolute(P,hipMount,upper,V(0,0,0),V(0,L1/2,0),V(1,0,0),...JOINT_LIMITS.hip,"hip");
    const kneeJ=makeRevolute(P,upper,lower,V(0,-L1/2,0),V(0,L2/2,0),V(1,0,0),...JOINT_LIMITS.knee,"knee");
    const ankleJ=makeRevolute(P,lower,ankleMount,V(0,-L2/2,0),V(0,0,0),V(1,0,0),...JOINT_LIMITS.ankle,"ankle");
    const roll=makeRevolute(P,ankleMount,foot,V(0,0,0),V(0,0.055,-front*0.12),V(0,0,1),...JOINT_LIMITS.roll,"roll");

    joints.push(spread,hipJ,kneeJ,ankleJ,roll);
    legs.push({
      index:i,side,front,hipMount,upper,lower,ankleMount,foot,
      joints:{spread,hip:hipJ,knee:kneeJ,ankle:ankleJ,roll},
      angles:{spread:0,hip:0,knee:0,ankle:0,roll:0},
      contact:false,load:0,
      commands:{...NEUTRAL}
    });
  });

  return{id,shell,shellMesh,eyeRoot,parts,joints,legs,contacts:0,upright:1,age:0,settling:true,engine:"Rapier revolute limits"};
}

export function updateBodySensors(o,objects){
  const q=o.shell.rotation();
  const up=new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w));
  o.upright=clamp(up.y,-1,1);
  let contacts=0;
  for(const leg of o.legs){
    leg.angles.spread=relAngle(o.shell,leg.hipMount,"z");
    leg.angles.hip=relAngle(leg.hipMount,leg.upper,"x");
    leg.angles.knee=Math.max(0,relAngle(leg.upper,leg.lower,"x"));
    leg.angles.ankle=relAngle(leg.lower,leg.ankleMount,"x");
    leg.angles.roll=relAngle(leg.ankleMount,leg.foot,"z");
    const fp=leg.foot.translation(),fv=leg.foot.linvel();
    let support=0;
    for(const it of objects){
      if(!it.active)continue;
      if(["platform","wall","bed","slope"].includes(it.type)){
        const bp=it.body.translation(),dx=Math.abs(fp.x-bp.x),dz=Math.abs(fp.z-bp.z);
        const hx=it.meta.hx??it.r,hz=it.meta.hz??it.r,top=it.meta.top??bp.y;
        if(dx<hx+0.14&&dz<hz+0.14)support=Math.max(support,top);
      }
    }
    leg.contact=(fp.y-support)<0.16;
    leg.load=leg.contact?clamp(1-Math.abs(fv.y)/1.8):0;
    if(leg.contact)contacts++;
  }
  o.contacts=contacts
}

export function driveBody(P,o,commands,dt){
  let activity=0;
  for(let i=0;i<o.legs.length;i++){
    const leg=o.legs[i],cmd=commands[i];
    for(const name of ["spread","hip","knee","ankle","roll"]){
      const info=leg.joints[name],lim=JOINT_LIMITS[name],target=clamp(cmd[name].target,lim[0],lim[1]);
      const activation=clamp(cmd[name].activation,0.02,1);
      // Rapier's actual limit is the final authority. The brain can request a target, but cannot exceed it.
      const stiffness=10+activation*20,damping=2.8+activation*3.0;
      info.joint.configureMotorPosition(target,stiffness,damping);
      info.target=target;
      activity+=Math.abs(target-(leg.angles[name]||0));
    }
  }
  return clamp(activity/5)
}

export function settleBody(P,o){
  for(const leg of o.legs){
    const neutral={
      spread:{target:0,activation:0.28},
      hip:{target:-0.08,activation:0.32},
      knee:{target:0.26,activation:0.34},
      ankle:{target:0.08,activation:0.28},
      roll:{target:0,activation:0.22}
    };
    for(const name of Object.keys(neutral)){
      const n=neutral[name];
      leg.joints[name].joint.configureMotorPosition(n.target,14+n.activation*18,4.6);
    }
  }
}

export function syncBody(o){
  for(const {body,mesh} of o.parts)meshPose(mesh,body);
  const p=o.shell.translation(),q=o.shell.rotation();
  o.eyeRoot.position.set(p.x,p.y+0.05,p.z+0.57);
  o.eyeRoot.quaternion.set(q.x,q.y,q.z,q.w);
}

export function destroyBody(P,scene,o){
  for(const j of o.joints){try{P.world.removeImpulseJoint(j.joint,true)}catch{}}
  for(const {body,mesh} of o.parts){scene.remove(mesh);try{P.world.removeRigidBody(body)}catch{}}
  scene.remove(o.eyeRoot)
}

export function bodyPosition(o){return o.shell.translation()}
export function bodyVelocity(o){return o.shell.linvel()}
