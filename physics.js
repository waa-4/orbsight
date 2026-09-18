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
const NEUTRAL={spread:0,hip:-0.10,knee:0.14,ankle:0.06,roll:0};

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
  return RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x,pos.y,pos.z).setRotation(rot).setLinearDamping(lin).setAngularDamping(ang).setCanSleep(false).setCcdEnabled(true);
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
  j.configureMotorPosition(0,42,8.0);
  return{name,joint:j,min,max,target:0,stiffness:18,damping:3.6,bodyA:a,bodyB:b,axisLocal:{x:axis.x,y:axis.y,z:axis.z}}
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
  const shellY=1.22;
  const shell=addDynamic(P,
    bodyDesc(V(x,shellY,z),Q(),0.07,0.24),
    RAPIER.ColliderDesc.ball(0.62).setDensity(0.42).setFriction(0.70)
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
    const foot=addDynamic(P,bodyDesc(footPos,rot,0.10,0.26),RAPIER.ColliderDesc.cuboid(0.12,0.055,0.22).setDensity(0.40).setFriction(2.8));

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
      contact:false,load:0,grip:null,gripCandidate:null,
      muscle:{
        spread:{strength:0.16,fatigue:0,use:0},
        hip:{strength:0.18,fatigue:0,use:0},
        knee:{strength:0.19,fatigue:0,use:0},
        ankle:{strength:0.14,fatigue:0,use:0},
        roll:{strength:0.11,fatigue:0,use:0}
      },
      smooth:{
        spread:{target:0,activation:0},hip:{target:-0.10,activation:0},
        knee:{target:0.20,activation:0},ankle:{target:0.06,activation:0},roll:{target:0,activation:0}
      },
      commands:{...NEUTRAL}
    });
  });

  return{
    id,shell,shellMesh,eyeRoot,parts,joints,legs,contacts:0,upright:1,age:0,settling:true,
    engine:"Rapier hard limits + mind-body velocity muscles",
    bridge:{
      gains:Array.from({length:4},()=>({spread:1,hip:1,knee:1,ankle:1,roll:1})),
      measured:Array.from({length:4},()=>({spread:0,hip:0,knee:0,ankle:0,roll:0})),
      health:"connecting"
    }
  };
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

    // Touch/reach sensor for the mind: nearest climbable surface near this foot.
    leg.gripCandidate=null;
    let gd=0.58;
    for(const it of objects){
      if(!it.active || !["platform","wall","pushblock","log","plank"].includes(it.type))continue;
      const bp=it.body.translation();
      const d=Math.hypot(fp.x-bp.x,fp.y-bp.y,fp.z-bp.z)-(it.r||0.4);
      if(d<gd){gd=d;leg.gripCandidate={object:it,distance:d}}
    }
    if(leg.contact)contacts++;
  }
  o.contacts=contacts
}


function applySupportReflex(o,commands){
  const p=o.shell.translation(),v=o.shell.linvel();
  const low=clamp((0.98-p.y)/0.34,0,1);
  const falling=clamp((-v.y-0.18)/1.8,0,1);
  const need=Math.max(low,falling);
  if(need<=0)return;
  // Reflex only adds a little extensor tone. A newborn is still allowed to flop.
  for(let i=0;i<o.legs.length;i++){
    const c=commands[i];
    c.hip.target=THREE.MathUtils.lerp(c.hip.target,-0.10,need*0.18);
    c.knee.target=THREE.MathUtils.lerp(c.knee.target,0.10,need*0.24);
    c.ankle.target=THREE.MathUtils.lerp(c.ankle.target,0.05,need*0.18);
    for(const name of ["spread","hip","knee","ankle","roll"]){
      c[name].activation=Math.max(c[name].activation,0.12+need*0.18);
    }
  }
}

function worldAxis(body,axis){
  const q=body.rotation();
  const v=new THREE.Vector3(axis.x,axis.y,axis.z);
  v.applyQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w));
  if(v.lengthSq()>0)v.normalize();
  return v
}
function applyJointActuator(info,current,target,activation,dt){
  const err=target-current;
  const impulse=clamp(err*activation*0.045,-0.006,0.006)*(dt*180);
  if(Math.abs(impulse)<0.00001)return;
  const ax=worldAxis(info.bodyA,info.axisLocal);
  const t={x:ax.x*impulse,y:ax.y*impulse,z:ax.z*impulse};
  info.bodyB.applyTorqueImpulse(t,true);
  info.bodyA.applyTorqueImpulse({x:-t.x,y:-t.y,z:-t.z},true);
}


function addVec(a,b){return{x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}}
function subVec(a,b){return{x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}}
function scaleVec(v,k){return{x:v.x*k,y:v.y*k,z:v.z*k}}

function velocityActuator(info,current,target,activation,gain=1){
  // Direct angular-velocity muscle layer. This changes velocity, never position,
  // so Rapier's joints/limits remain authoritative.
  const err=target-current;
  const desired=clamp(err*3.6,-1.8,1.8)*activation*gain;
  const axis=worldAxis(info.bodyA,info.axisLocal);
  const avA=info.bodyA.angvel(),avB=info.bodyB.angvel();
  const rel=(avB.x-avA.x)*axis.x+(avB.y-avA.y)*axis.y+(avB.z-avA.z)*axis.z;
  const delta=clamp(desired-rel,-0.10,0.10);
  const push=scaleVec(axis,delta*0.5);
  info.bodyA.setAngvel(subVec(avA,push),true);
  info.bodyB.setAngvel(addVec(avB,push),true);
}

function localPoint(body,worldPoint){
  const p=body.translation(),q=body.rotation();
  const v=new THREE.Vector3(worldPoint.x-p.x,worldPoint.y-p.y,worldPoint.z-p.z);
  v.applyQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w).invert());
  return{x:v.x,y:v.y,z:v.z}
}

export function createGrip(P,o,leg,target){
  if(leg.grip || !target || !target.active)return false;
  const fp=leg.foot.translation(),tp=target.body.translation();
  const dx=fp.x-tp.x,dy=fp.y-tp.y,dz=fp.z-tp.z;
  const dist=Math.hypot(dx,dy,dz);
  const reach=(target.r||0.6)+0.42;
  if(dist>reach)return false;
  const a1={x:0,y:0,z:0};
  const a2=localPoint(target.body,fp);
  const data=RAPIER.JointData.spherical(a1,a2);
  const joint=P.world.createImpulseJoint(data,leg.foot,target.body,true);
  joint.setContactsEnabled(false);
  leg.grip={joint,target,age:0,anchor:{x:fp.x,y:fp.y,z:fp.z}};
  return true
}


export function createGroundGrip(P,o,leg){
  if(leg.grip || !leg.contact)return false;
  const fp=leg.foot.translation();
  const data=RAPIER.JointData.spherical({x:0,y:0,z:0},{x:fp.x,y:0.0,z:fp.z});
  const joint=P.world.createImpulseJoint(data,leg.foot,P.ground,true);
  joint.setContactsEnabled(false);
  leg.grip={joint,target:null,ground:true,age:0,anchor:{x:fp.x,y:0,z:fp.z}};
  return true
}

export function releaseGrip(P,leg){
  if(!leg.grip)return;
  try{P.world.removeImpulseJoint(leg.grip.joint,true)}catch{}
  leg.grip=null
}

export function updateGrips(P,o,dt){
  for(const leg of o.legs){
    if(!leg.grip)continue;
    leg.grip.age+=dt;
    const fp=leg.foot.translation(),a=leg.grip.anchor;
    const stretch=Math.hypot(fp.x-a.x,fp.y-a.y,fp.z-a.z);
    if(stretch>0.42 || leg.grip.age>4.5 || (!leg.grip.ground && (!leg.grip.target || !leg.grip.target.active)))releaseGrip(P,leg);
  }
}

export function driveBody(P,o,commands,dt){
  applySupportReflex(o,commands);
  let activity=0;
  for(let i=0;i<o.legs.length;i++){
    const leg=o.legs[i],cmd=commands[i];
    for(const name of ["spread","hip","knee","ankle","roll"]){
      const info=leg.joints[name],lim=JOINT_LIMITS[name],mus=leg.muscle[name],sm=leg.smooth[name];
      const rawTarget=clamp(cmd[name].target,lim[0],lim[1]);
      const rawActivation=clamp(cmd[name].activation,0,1);

      // Nervous-system smoothing: muscles cannot instantaneously jump to a new pose.
      const targetAlpha=1-Math.exp(-dt*(2.1+mus.strength*2.2));
      const actAlpha=1-Math.exp(-dt*3.1);
      sm.target=THREE.MathUtils.lerp(sm.target,rawTarget,targetAlpha);
      sm.activation=THREE.MathUtils.lerp(sm.activation,rawActivation,actAlpha);

      // Biological strength: newborns are weak and floppy.
      const freshness=clamp(1-mus.fatigue*0.72,0.28,1);
      const effective=clamp(mus.strength*freshness,0.05,1);
      const activation=sm.activation*effective;
      const current=leg.angles[name]||0;
      const err=sm.target-current;

      // Very compliant PD motor. Strength grows later instead of starting robotic/stiff.
      const stiffness=2.0+effective*24+activation*16;
      const damping=1.2+effective*5.5;
      const targetVel=clamp(err*(2.1+effective*3.2),-1.35-effective*1.1,1.35+effective*1.1);
      info.joint.configureMotor(sm.target,targetVel,stiffness,damping);

      // Tiny physical muscle assists. These are deliberately weak at birth.
      const bridgeGain=(o.bridge?.gains?.[i]?.[name] ?? 1);
      applyJointActuator(info,current,sm.target,activation*effective,dt);
      velocityActuator(info,current,sm.target,activation,effective*(0.65+0.35*bridgeGain));

      // Use-driven strengthening + fatigue + recovery.
      const work=Math.min(1,Math.abs(err)*1.8+Math.abs(targetVel)*0.12)*sm.activation;
      mus.use+=work*dt;
      mus.fatigue=clamp(mus.fatigue+work*dt*0.050-dt*(0.018+0.018*(1-sm.activation)),0,1);
      // Slow training; loaded legs strengthen a little faster.
      const loadBonus=leg.load?0.55:0.12;
      const train=work*(0.00030+loadBonus*0.00045);
      mus.strength=clamp(mus.strength+train*dt*180,0.08,1.0);

      info.target=sm.target;
      activity+=Math.abs(err)*sm.activation;
    }
  }
  return clamp(activity/5)
}

export function settleBody(P,o){
  for(const leg of o.legs){
    for(const name of ["spread","hip","knee","ankle","roll"]){
      const n={spread:0,hip:-0.08,knee:0.24,ankle:0.05,roll:0}[name];
      leg.joints[name].joint.configureMotor(n,0,3.0,1.8);
    }
  }
}

export function syncBody(o){
  for(const {body,mesh} of o.parts)meshPose(mesh,body);
  const p=o.shell.translation(),q=o.shell.rotation();
  o.eyeRoot.position.set(p.x,p.y+0.05,p.z+0.57);
  o.eyeRoot.quaternion.set(q.x,q.y,q.z,q.w);
}

export function animateEye(o,time){
  const pupil=o.eyeRoot.children[1];
  if(!pupil)return;
  const phase=time*0.85+o.id*1.7;
  pupil.position.x=Math.sin(phase)*0.12;
  pupil.position.y=Math.sin(phase*0.63+1.1)*0.075;
  pupil.position.z=0.275;
  o.eyeRoot.rotation.y=Math.sin(phase*0.42)*0.10;
  o.eyeRoot.rotation.x=Math.sin(phase*0.31+0.7)*0.06;
}

export function destroyBody(P,scene,o){
  for(const leg of o.legs)releaseGrip(P,leg);
  for(const j of o.joints){try{P.world.removeImpulseJoint(j.joint,true)}catch{}}
  for(const {body,mesh} of o.parts){scene.remove(mesh);try{P.world.removeRigidBody(body)}catch{}}
  scene.remove(o.eyeRoot)
}

export function bodyPosition(o){return o.shell.translation()}
export function bodyVelocity(o){return o.shell.linvel()}
