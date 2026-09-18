import * as CANNON from "cannon-es";
import * as THREE from "three";

const GROUP={ENV:1,SHELL:2,LEG0:4,LEG1:8,LEG2:16,LEG3:32,PROP:64};
GROUP.ALL_LEGS=GROUP.LEG0|GROUP.LEG1|GROUP.LEG2|GROUP.LEG3;
GROUP.CREATURE=GROUP.SHELL|GROUP.ALL_LEGS;
const LEG_GROUPS=[GROUP.LEG0,GROUP.LEG1,GROUP.LEG2,GROUP.LEG3];

const LIMITS={
  abduct:[-0.52,0.52],
  hip:[-0.78,0.72],
  knee:[0.06,1.08],
  ankle:[-0.48,0.56],
  roll:[-0.40,0.40]
};

const cv=(x=0,y=0,z=0)=>new CANNON.Vec3(x,y,z);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const wrap=a=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a};

export function createPhysics(){
  const world=new CANNON.World({gravity:cv(0,-9.82,0)});
  world.solver.iterations=42;
  world.solver.tolerance=0.00025;
  world.broadphase=new CANNON.SAPBroadphase(world);
  world.allowSleep=true;

  const mats={
    ground:new CANNON.Material("ground"),body:new CANNON.Material("body"),
    foot:new CANNON.Material("foot"),object:new CANNON.Material("object")
  };
  world.defaultContactMaterial.friction=0.42;
  world.addContactMaterial(new CANNON.ContactMaterial(mats.foot,mats.ground,{friction:2.5,restitution:0,contactEquationStiffness:1.4e7,contactEquationRelaxation:3}));
  world.addContactMaterial(new CANNON.ContactMaterial(mats.body,mats.ground,{friction:0.5,restitution:0}));
  world.addContactMaterial(new CANNON.ContactMaterial(mats.body,mats.object,{friction:0.45,restitution:0}));
  world.addContactMaterial(new CANNON.ContactMaterial(mats.foot,mats.object,{friction:1.25,restitution:0}));
  world.addContactMaterial(new CANNON.ContactMaterial(mats.object,mats.ground,{friction:0.72,restitution:0.06}));
  world.addContactMaterial(new CANNON.ContactMaterial(mats.object,mats.object,{friction:0.48,restitution:0.08}));

  const ground=new CANNON.Body({mass:0,material:mats.ground});
  ground.addShape(new CANNON.Plane());ground.quaternion.setFromEuler(-Math.PI/2,0,0);
  ground.collisionFilterGroup=GROUP.ENV;ground.collisionFilterMask=GROUP.CREATURE|GROUP.PROP;
  world.addBody(ground);
  return{world,mats,ground,GROUP,LIMITS};
}

function addBody(P,shape,mass,material,pos,group,mask){
  const b=new CANNON.Body({mass,material,position:cv(pos.x,pos.y,pos.z),linearDamping:0.05,angularDamping:0.12,allowSleep:false});
  b.addShape(shape);b.collisionFilterGroup=group;b.collisionFilterMask=mask;P.world.addBody(b);return b
}
function makeHinge(P,a,b,pA,pB,axisArr,force,name,min,max){
  const axisA=cv(...axisArr),axisB=cv(...axisArr);
  const ref=Math.abs(axisArr[1])<0.8?cv(0,1,0):cv(1,0,0);
  const h=new CANNON.HingeConstraint(a,b,{pivotA:cv(...pA),pivotB:cv(...pB),axisA,axisB,collideConnected:false,maxForce:force});
  P.world.addConstraint(h);h.enableMotor();h.setMotorMaxForce(force);
  return{name,hinge:h,bodyA:a,bodyB:b,axisA,refA:ref.clone(),refB:ref.clone(),min,max,baseForce:force,lastAngle:0,guardHits:0}
}
export function jointAngle(j){
  const axis=cv(),va=cv(),vb=cv(),cross=cv();
  j.bodyA.quaternion.vmult(j.axisA,axis);axis.normalize();
  j.bodyA.quaternion.vmult(j.refA,va);j.bodyB.quaternion.vmult(j.refB,vb);
  let d=va.dot(axis);va.x-=axis.x*d;va.y-=axis.y*d;va.z-=axis.z*d;
  d=vb.dot(axis);vb.x-=axis.x*d;vb.y-=axis.y*d;vb.z-=axis.z*d;
  if(va.lengthSquared()<1e-9||vb.lengthSquared()<1e-9)return j.lastAngle||0;
  va.normalize();vb.normalize();va.cross(vb,cross);
  const a=Math.atan2(axis.dot(cross),va.dot(vb));j.lastAngle=a;return a
}
function relAngularSpeed(j){
  const axis=cv();j.bodyA.quaternion.vmult(j.axisA,axis);axis.normalize();
  const r=cv(j.bodyB.angularVelocity.x-j.bodyA.angularVelocity.x,j.bodyB.angularVelocity.y-j.bodyA.angularVelocity.y,j.bodyB.angularVelocity.z-j.bodyA.angularVelocity.z);
  return r.dot(axis)
}
export function driveJoint(j,target,activation,dt){
  const a=jointAngle(j),min=j.min,max=j.max,span=max-min;
  target=clamp(target,min,max);
  const rv=relAngularSpeed(j);
  const guard=span*0.14,hard=span*0.045;
  let guardDir=0;
  if(a<min+guard)guardDir=clamp((min+guard-a)/guard,0,1);
  if(a>max-guard)guardDir=-clamp((a-(max-guard))/guard,0,1);

  // Muscle is deliberately weak; the anatomical barrier is stronger than any muscle.
  let speed=wrap(target-a)*2.15-rv*0.82;
  const maxSpeed=0.75+activation*0.85;
  speed=clamp(speed,-maxSpeed,maxSpeed);

  if(a<=min+hard)speed=Math.max(speed,0.45+Math.abs(guardDir)*1.15);
  if(a>=max-hard)speed=Math.min(speed,-0.45-Math.abs(guardDir)*1.15);
  if(a<min)speed=Math.max(speed,1.55);
  if(a>max)speed=Math.min(speed,-1.55);

  const edge=Math.min((a-min)/span,(max-a)/span);
  const edgeN=clamp(edge/0.12,0,1);
  const force=j.baseForce*(0.18+0.82*activation)*(1+(1-edgeN)*2.8);
  j.hinge.setMotorMaxForce(force);j.hinge.setMotorSpeed(speed);
  if(edgeN<0.25)j.guardHits++;
  return{angle:a,rv,speed,force,guard:1-edgeN,error:wrap(target-a)}
}
function repel(a,b,minD,dt,k=18){
  let dx=a.position.x-b.position.x,dy=a.position.y-b.position.y,dz=a.position.z-b.position.z;
  let d=Math.hypot(dx,dy,dz);if(d<1e-5){dx=0.001;dz=0.001;d=Math.hypot(dx,dz)}
  if(d>=minD)return false;
  const n=1/d,p=(minD-d)*k*dt;dx*=n;dy*=n;dz*=n;
  a.velocity.x+=dx*p*0.5;a.velocity.y+=dy*p*0.5;a.velocity.z+=dz*p*0.5;
  b.velocity.x-=dx*p*0.5;b.velocity.y-=dy*p*0.5;b.velocity.z-=dz*p*0.5;
  return true
}
function keepOutOfShell(o,body,minR,dt){
  let dx=body.position.x-o.shell.position.x,dy=body.position.y-o.shell.position.y,dz=body.position.z-o.shell.position.z;
  let d=Math.hypot(dx,dy,dz);if(d<1e-5){dx=0.001;dz=0.001;d=Math.hypot(dx,dz)}
  if(d>=minR)return false;
  const n=1/d,p=(minR-d)*16*dt;
  body.velocity.x+=dx*n*p;body.velocity.y+=dy*n*p;body.velocity.z+=dz*n*p;return true
}
function hardBarrier(j,dt){
  const a=jointAngle(j),rv=relAngularSpeed(j),span=j.max-j.min,soft=span*0.14;
  let target=null;
  if(a<j.min+soft)target=j.min+soft;
  if(a>j.max-soft)target=j.max-soft;
  if(target===null)return 0;
  const err=target-a;
  const axis=cv();j.bodyA.quaternion.vmult(j.axisA,axis);axis.normalize();
  const outside=a<j.min||a>j.max;
  const corr=(err*(outside?56:23)-rv*(outside?10.0:5.4))*dt;
  j.bodyA.angularVelocity.vsub(axis.scale(corr*0.4),j.bodyA.angularVelocity);
  j.bodyB.angularVelocity.vadd(axis.scale(corr*0.6),j.bodyB.angularVelocity);
  return Math.abs(err)
}
export function createOrbsightBody(P,scene,id,x=0,z=0){
  const shellY=1.40;
  const shell=addBody(P,new CANNON.Sphere(0.62),0.46,P.mats.body,{x,y:shellY,z},GROUP.SHELL,GROUP.ENV|GROUP.PROP|GROUP.SHELL|GROUP.ALL_LEGS);
  shell.angularDamping=0.30;shell.linearDamping=0.07;
  const shellMesh=new THREE.Mesh(new THREE.SphereGeometry(0.62,28,20),new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL((id*0.137)%1,0.22,0.78),roughness:0.82}));
  shellMesh.castShadow=true;scene.add(shellMesh);

  const eyeRoot=new THREE.Group(),eyeWhite=new THREE.Mesh(new THREE.SphereGeometry(0.30,20,14),new THREE.MeshStandardMaterial({color:0xf7f6ef,roughness:0.5})),pupil=new THREE.Mesh(new THREE.SphereGeometry(0.115,16,10),new THREE.MeshStandardMaterial({color:0x0c0e11}));
  eyeWhite.scale.z=0.55;eyeRoot.add(eyeWhite);pupil.scale.z=0.45;pupil.position.z=0.275;eyeRoot.add(pupil);scene.add(eyeRoot);

  const parts=[{body:shell,mesh:shellMesh}],constraints=[],legs=[];
  const defs=[[-1,1],[1,1],[-1,-1],[1,-1]],L1=0.50,L2=0.46,hipY=-0.18;
  const limbMat=new THREE.MeshStandardMaterial({color:0x383d45,roughness:0.9}),jointMat=new THREE.MeshStandardMaterial({color:0x505762,roughness:0.8});

  defs.forEach(([side,front],i)=>{
    const group=LEG_GROUPS[i];
    // v0.10.4: non-adjacent pieces of the same leg may physically collide.
    // Directly connected neighbors remain excluded by each hinge's collideConnected:false.
    const mask=GROUP.ENV|GROUP.PROP|GROUP.SHELL|GROUP.ALL_LEGS;
    const hx=side*0.61,hz=front*0.38,hy=shellY+hipY;
    const hipMount=addBody(P,new CANNON.Sphere(0.065),0.038,P.mats.body,{x:x+hx,y:hy,z:z+hz},group,mask);
    const upper=addBody(P,new CANNON.Box(cv(0.06,L1/2,0.06)),0.082,P.mats.body,{x:x+hx+side*0.10,y:hy-L1/2,z:z+hz+front*0.02},group,mask);
    const lower=addBody(P,new CANNON.Box(cv(0.056,L2/2,0.056)),0.072,P.mats.body,{x:x+hx+side*0.18,y:hy-L1-L2/2,z:z+hz+front*0.05},group,mask);
    const ankle=addBody(P,new CANNON.Sphere(0.06),0.032,P.mats.body,{x:x+hx+side*0.23,y:hy-L1-L2,z:z+hz+front*0.08},group,mask);
    const foot=addBody(P,new CANNON.Box(cv(0.115,0.055,0.22)),0.072,P.mats.foot,{x:x+hx+side*0.26,y:0.08,z:z+hz+front*0.16},group,mask);
    hipMount.angularDamping=0.20;upper.angularDamping=0.16;lower.angularDamping=0.17;ankle.angularDamping=0.20;foot.angularDamping=0.30;

    const upperM=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.055,L1,8),limbMat);
    const lowerM=new THREE.Mesh(new THREE.CylinderGeometry(0.052,0.052,L2,8),limbMat);
    const hipM=new THREE.Mesh(new THREE.SphereGeometry(0.07,10,8),jointMat);
    const ankleM=new THREE.Mesh(new THREE.SphereGeometry(0.06,10,8),jointMat);
    const footM=new THREE.Mesh(new THREE.BoxGeometry(0.23,0.11,0.44),limbMat);
    [hipM,upperM,lowerM,ankleM,footM].forEach(m=>{m.castShadow=true;scene.add(m)});
    parts.push({body:hipMount,mesh:hipM},{body:upper,mesh:upperM},{body:lower,mesh:lowerM},{body:ankle,mesh:ankleM},{body:foot,mesh:footM});

    // Rebuilt joint axes:
    // abduct = small outward/inward motion at hip
    // hip/knee = sagittal flexion
    // ankle = smaller sagittal correction
    // roll = limited foot leveling
    const abduct=makeHinge(P,shell,hipMount,[hx,hipY,hz],[0,0,0],[0,0,1],8.8,"abduct",...LIMITS.abduct);
    const hip=makeHinge(P,hipMount,upper,[0,0,0],[0,L1/2,0],[1,0,0],9.4,"hip",...LIMITS.hip);
    const knee=makeHinge(P,upper,lower,[0,-L1/2,0],[0,L2/2,0],[1,0,0],10.2,"knee",...LIMITS.knee);
    const ankleJ=makeHinge(P,lower,ankle,[0,-L2/2,0],[0,0,0],[1,0,0],7.6,"ankle",...LIMITS.ankle);
    const roll=makeHinge(P,ankle,foot,[0,0,0],[0,0.055,-0.12],[0,0,1],6.2,"roll",...LIMITS.roll);
    constraints.push(abduct.hinge,hip.hinge,knee.hinge,ankleJ.hinge,roll.hinge);
    legs.push({index:i,side,front,hipMount,upper,lower,ankle,foot,joints:{abduct,hip,knee,ankle:ankleJ,roll},grip:null,gripTime:0,targets:{abduct:side*0.24,hip:-0.08,knee:0.34,ankle:0.08,roll:0},muscle:{abduct:0.70,hip:0.70,knee:0.72,ankle:0.68,roll:0.64}});
  });

  return{id,shell,shellMesh,eyeRoot,parts,constraints,legs,guardHits:0,foldRisk:0,contacts:0,upright:1,heading:0,selfCollision:true,legArchitecture:"v0.11-outward-plantigrade"};
}

function passiveOutwardSpring(o,leg,dt){
  const side=leg.side;
  // Keep hip mount from collapsing inward against the shell.
  const localSide=(leg.hipMount.position.x-o.shell.position.x)*side;
  const desired=0.60;
  if(localSide<desired){
    const push=(desired-localSide)*10.5*dt;
    leg.hipMount.velocity.x+=side*push;
    leg.upper.velocity.x+=side*push*0.65;
  }

  // Keep the foot under/outside its own hip instead of tucking beneath the shell.
  const footSide=(leg.foot.position.x-o.shell.position.x)*side;
  const minFoot=0.48;
  if(footSide<minFoot){
    const push=(minFoot-footSide)*13.5*dt;
    leg.foot.velocity.x+=side*push;
    leg.ankle.velocity.x+=side*push*0.65;
    return true;
  }
  return false;
}

function curledSupportPenalty(o,leg){
  const dShell=Math.hypot(
    leg.foot.position.x-o.shell.position.x,
    leg.foot.position.y-o.shell.position.y,
    leg.foot.position.z-o.shell.position.z
  );
  const knee=jointAngle(leg.joints.knee);
  // A deeply tucked foot close to the shell should not count as useful support.
  return dShell<0.72 && knee>0.78;
}

export function enforceAnatomy(o,dt){
  let risk=0,hits=0;
  for(const leg of o.legs){
    for(const j of Object.values(leg.joints)){risk+=hardBarrier(j,dt);hits+=j.guardHits;j.guardHits=0}
    if(repel(leg.upper,leg.foot,0.22,dt,24))risk+=0.05;
    if(repel(leg.hipMount,leg.foot,0.36,dt,22))risk+=0.05;
    if(repel(leg.upper,leg.ankle,0.16,dt,20))risk+=0.04;
    if(keepOutOfShell(o,leg.lower,0.50,dt))risk+=0.04;
    if(keepOutOfShell(o,leg.ankle,0.52,dt))risk+=0.04;
    if(keepOutOfShell(o,leg.foot,0.60,dt))risk+=0.05;if(passiveOutwardSpring(o,leg,dt))risk+=0.05;
  }
  for(let i=0;i<o.legs.length;i++)for(let j=i+1;j<o.legs.length;j++){
    const a=o.legs[i],b=o.legs[j];
    if(repel(a.upper,b.upper,0.12,dt,16))risk+=0.03;
    if(repel(a.lower,b.lower,0.12,dt,16))risk+=0.03;
    if(repel(a.foot,b.foot,0.15,dt,16))risk+=0.03;
  }
  o.guardHits+=hits;o.foldRisk=risk;
  return risk
}
export function updateBodySensors(o,objects){
  const up=cv();o.shell.quaternion.vmult(cv(0,1,0),up);o.upright=clamp(up.y,-1,1);
  let contacts=0;
  for(const leg of o.legs){
    const y=leg.foot.position.y;
    let support=0;
    for(const it of objects){
      if(!it.active)continue;
      if(["platform","wall","bed","slope"].includes(it.type)){
        const dx=Math.abs(leg.foot.position.x-it.body.position.x),dz=Math.abs(leg.foot.position.z-it.body.position.z);
        const hx=(it.meta && it.meta.hx !== undefined) ? it.meta.hx : it.r;
        const hz=(it.meta && it.meta.hz !== undefined) ? it.meta.hz : it.r;
        const hy=(it.meta && it.meta.hy !== undefined) ? it.meta.hy : 0.16;
        const top=(it.meta && it.meta.top !== undefined) ? it.meta.top : (it.body.position.y+hy);
        if(dx<hx+0.15&&dz<hz+0.15)support=Math.max(support,top);
      }
    }
    leg.contact=(y-support)<0.15 && !curledSupportPenalty(o,leg);
    leg.load=leg.contact?clamp(1-Math.abs(leg.foot.velocity.y)/1.7):0;
    if(leg.contact)contacts++;
    leg.angles={
      abduct:jointAngle(leg.joints.abduct),hip:jointAngle(leg.joints.hip),knee:jointAngle(leg.joints.knee),
      ankle:jointAngle(leg.joints.ankle),roll:jointAngle(leg.joints.roll)
    };
  }
  o.contacts=contacts
}
export function driveBody(o,commands,dt){
  let activity=0;
  for(let i=0;i<o.legs.length;i++){
    const leg=o.legs[i],cmd=commands[i];
    for(const name of ["abduct","hip","knee","ankle","roll"]){
      const j=leg.joints[name],c=cmd[name];
      const r=driveJoint(j,c.target,c.activation,dt);activity+=Math.abs(r.speed);
    }
  }
  return clamp(activity/(o.legs.length*5*1.6))
}
export function syncBody(o){
  for(const {body,mesh} of o.parts){mesh.position.copy(body.position);mesh.quaternion.copy(body.quaternion)}
  o.eyeRoot.position.copy(o.shellMesh.position);o.eyeRoot.quaternion.copy(o.shellMesh.quaternion);o.eyeRoot.position.y+=0.05;o.eyeRoot.position.z+=0.57;
}
export function destroyBody(P,scene,o){
  for(const leg of o.legs)releaseGrip(P,leg);
  for(const c of o.constraints)try{P.world.removeConstraint(c)}catch{}
  for(const {body,mesh} of o.parts){try{P.world.removeBody(body)}catch{};scene.remove(mesh)}
  scene.remove(o.eyeRoot)
}
export function tryGrip(P,o,leg,it){
  if(leg.grip||!it?.active)return false;
  const jvals=Object.values(leg.joints).map(j=>({a:jointAngle(j),j}));
  if(jvals.some(({a,j})=>a<j.min+(j.max-j.min)*0.10||a>j.max-(j.max-j.min)*0.10))return false;
  const worldPoint=leg.foot.position.clone(),pivotA=cv(0,-0.04,0.03),pivotB=cv();
  it.body.pointToLocalFrame(worldPoint,pivotB);
  const c=new CANNON.PointToPointConstraint(leg.foot,pivotA,it.body,pivotB,12);
  c.collideConnected=false;P.world.addConstraint(c);leg.grip={constraint:c,it};leg.gripTime=0;return true
}
export function releaseGrip(P,leg){
  if(!leg.grip)return;try{P.world.removeConstraint(leg.grip.constraint)}catch{};leg.grip=null;leg.gripTime=0
}
export function updateGrips(P,o,dt){
  for(const leg of o.legs){
    if(!leg.grip)continue;leg.gripTime+=dt;
    const unsafe=Object.values(leg.joints).some(j=>{const a=jointAngle(j),m=(j.max-j.min)*0.085;return a<j.min+m||a>j.max-m});
    if(unsafe||leg.gripTime>1.5)releaseGrip(P,leg);
  }
}
