import * as THREE from "three";
import {nearby} from "./world.js";
import {bodyPosition,bodyVelocity,createGrip,createGroundGrip,releaseGrip,updateGrips} from "./physics.js";

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const JOINTS=["spread","hip","knee","ankle","roll"];
const FEATURES=8;

const CHAT=[
  "Hello.","I am learning my legs.","I think I moved!","Where are you going?",
  "My feet are busy.","I am trying to crawl.","I found something.","I need a rest.",
  "One leg at a time.","Hold... pull...","I almost stood up.","That was difficult."
];
const REPLIES=["Okay.","I see.","Maybe.","Same here.","Interesting.","Be careful.","Good luck.","I noticed that too."];

function weights(scale=0.18){return Array.from({length:FEATURES},()=>rand(-scale,scale))}
function seedPolicy(){
  return{
    freq:rand(0.35,0.65),gain:rand(0.22,0.38),phase:[0,Math.PI,Math.PI,0],
    legs:Array.from({length:4},()=>Object.fromEntries(JOINTS.map(j=>[j,weights(j==="hip"?0.20:0.16)])))
  }
}
function clone(x){return JSON.parse(JSON.stringify(x))}
function mutate(p,amt=0.05){
  const n=clone(p),edits=1+Math.floor(Math.random()*2);
  for(let e=0;e<edits;e++){
    const li=Math.floor(Math.random()*4),j=JOINTS[Math.floor(Math.random()*JOINTS.length)],w=n.legs[li][j];
    const k=Math.floor(Math.random()*w.length);w[k]=clamp(w[k]+rand(-amt,amt),-1.6,1.6)
  }
  return n
}
function policyOut(w,f,g){let s=0;for(let i=0;i<w.length;i++)s+=w[i]*f[i];return Math.tanh(s)*g}

function bubbleSprite(app){
  const c=document.createElement("canvas");c.width=512;c.height=180;
  const tex=new THREE.CanvasTexture(c),mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false}),sprite=new THREE.Sprite(mat);
  sprite.scale.set(3.5,1.25,1);sprite.visible=false;sprite.renderOrder=50;app.scene.add(sprite);
  return{c,ctx:c.getContext("2d"),tex,sprite,timer:0,pending:null,pendingTimer:0}
}
function showBubble(o,text,dur=3){
  const b=o.mind.bubble,ctx=b.ctx;ctx.clearRect(0,0,512,180);
  ctx.fillStyle="rgba(250,250,247,.96)";ctx.strokeStyle="#20252c";ctx.lineWidth=6;
  ctx.beginPath();ctx.roundRect(10,10,492,140,24);ctx.fill();ctx.stroke();
  ctx.fillStyle="#15181d";ctx.font="600 27px system-ui";ctx.textAlign="center";
  const words=String(text).split(/\s+/),lines=[];let line="";
  for(const w of words){const t=line?line+" "+w:w;if(ctx.measureText(t).width>440&&line){lines.push(line);line=w}else line=t}
  if(line)lines.push(line);lines.slice(0,3).forEach((l,i)=>ctx.fillText(l,256,65+i*34));
  b.tex.needsUpdate=true;b.sprite.visible=true;b.timer=dur
}

function makeLegBrain(i){
  return{
    state:"relax",timer:rand(0.5,1.3),target:null,lastState:"relax",
    success:0,failed:0,contactHold:0,reachBias:rand(-0.08,0.08),
    primitiveMemory:{reach:0,plant:0,pull:0,push:0,lift:0}
  }
}

export function attachMind(app,o){
  const p=seedPolicy(),pos=bodyPosition(o);
  o.mind={
    name:`Orbsight ${o.id}`,energy:1,hunger:0,thought:"Figuring out what my legs are.",desiredHeading:0,
    personality:{curiosity:rand(0.25,0.95),patience:rand(0.15,0.9),playfulness:rand(0.1,0.95),sociability:rand(0.1,0.95)},
    policy:p,targetPolicy:clone(p),best:clone(p),bestScore:-999,generation:1,trialTime:0,trialX:pos.x,trialZ:pos.z,
    dense:0,denseAccum:0,activity:0,fragments:[],stage:0,stageName:"newborn motor discovery",
    phase:[0,0,0,0],model:Array.from({length:4},()=>Object.fromEntries(JOINTS.map(j=>[j,{forward:0,lift:0,support:0,samples:0}]))),
    prevPos:{x:pos.x,y:pos.y,z:pos.z},prevAngles:Array.from({length:4},()=>({spread:0,hip:0,knee:0,ankle:0,roll:0})),
    command:Array.from({length:4},()=>Object.fromEntries(JOINTS.map(j=>[j,{target:0,activation:0.03}]))),
    legs:[0,1,2,3].map(makeLegBrain),
    bubble:bubbleSprite(app),thoughtTimer:rand(5,11),chatTimer:rand(8,16),decisionTimer:0,
    sleep:{sleeping:false,time:0,lastGain:"—",cooldown:0},
    development:{
      phase:"newborn motor discovery",bodyMap:0,crawlSkill:0,gripSkill:0,supportSkill:0,
      balanceSkill:0,stepSkill:0,walkSkill:0,successfulPulls:0,successfulPlants:0
    },
    debug:{
      freezeBrain:false,forcePhase:null,forceLegStates:null,forceLegUntil:0,
      walkTutor:0,crawlTutor:0,lastAction:"none"
    }
  }
}

function social(app,o,dt){
  const m=o.mind,b=m.bubble;b.timer-=dt;if(b.timer<=0)b.sprite.visible=false;
  if(b.pending){b.pendingTimer-=dt;if(b.pendingTimer<=0){showBubble(o,b.pending);b.pending=null}}
  m.thoughtTimer-=dt;
  if(m.thoughtTimer<=0&&!m.sleep.sleeping){m.thoughtTimer=rand(8,16);if(Math.random()<0.48)showBubble(o,m.thought,rand(2.2,3.5))}
  m.chatTimer-=dt;
  if(m.chatTimer<=0&&!m.sleep.sleeping){
    m.chatTimer=rand(10,20);
    if(Math.random()<m.personality.sociability*0.55){
      let other=null,bd=4.2;const p=bodyPosition(o);
      for(const q of app.orbs){if(q===o||q.mind.sleep.sleeping)continue;const qp=bodyPosition(q),d=Math.hypot(qp.x-p.x,qp.z-p.z);if(d<bd){bd=d;other=q}}
      if(other){showBubble(o,CHAT[Math.floor(Math.random()*CHAT.length)]);other.mind.bubble.pending=REPLIES[Math.floor(Math.random()*REPLIES.length)];other.mind.bubble.pendingTimer=rand(0.8,1.6)}
    }
  }
  const p=bodyPosition(o);b.sprite.position.set(p.x,p.y+1.28,p.z)
}

function sleep(app,o,dt){
  const m=o.mind;m.sleep.cooldown=Math.max(0,m.sleep.cooldown-dt);
  const bed=nearby(app,o,"bed",1.5);
  if(!m.sleep.sleeping&&m.energy<0.25&&m.sleep.cooldown<=0&&bed){
    m.sleep.sleeping=true;m.sleep.time=0;m.thought="Sleeping.";showBubble(o,"zzz...",4)
  }
  if(m.sleep.sleeping){
    m.sleep.time+=dt;m.energy=clamp(m.energy+dt*0.065);
    for(const leg of o.legs)for(const j of JOINTS)leg.muscle[j].fatigue=clamp(leg.muscle[j].fatigue-dt*0.12,0,1);
    if(m.energy>0.97||m.sleep.time>15){
      m.sleep.sleeping=false;m.sleep.cooldown=8;m.energy=Math.max(m.energy,0.94);
      m.sleep.lastGain=m.development.phase;showBubble(o,"I feel stronger.",2.8)
    }
  }
}

function avgStrength(o){
  let t=0,n=0;for(const leg of o.legs)for(const j of JOINTS){t+=leg.muscle[j].strength;n++}
  return t/Math.max(1,n)
}
function avgFatigue(o){
  let t=0,n=0;for(const leg of o.legs)for(const j of JOINTS){t+=leg.muscle[j].fatigue;n++}
  return t/Math.max(1,n)
}

function phaseFor(o){
  const m=o.mind,d=m.development,s=avgStrength(o);
  if(m.debug && m.debug.forcePhase)return m.debug.forcePhase;
  if(d.bodyMap<0.22 || s<0.19)return "newborn motor discovery";
  if(d.crawlSkill<0.24 || s<0.26)return "reach + plant";
  if(d.gripSkill<0.28 || d.crawlSkill<0.42)return "grip + pull crawling";
  if(d.supportSkill<0.36 || s<0.40)return "supported crawling";
  if(d.balanceSkill<0.34 || s<0.50)return "standing practice";
  if(d.stepSkill<0.38)return "first steps";
  return "walking practice"
}

function neutralFor(leg){
  return{spread:0,hip:-0.06,knee:0.30,ankle:0.05,roll:0}
}

function setLegCommand(m,i,targets,activation=0.14){
  for(const j of JOINTS)m.command[i][j]={target:targets[j],activation}
}

function relaxLeg(o,i,amount=1){
  const n=neutralFor(o.legs[i]);
  setLegCommand(o.mind,i,n,0.025+0.025*(1-amount))
}

function primitiveTargets(o,i,state){
  const leg=o.legs[i],lb=o.mind.legs[i],n=neutralFor(leg);
  const front=leg.front,side=leg.side;
  const bias=lb.reachBias;

  if(state==="reach"){
    return{spread:side*(0.05+bias),hip:0.16+front*0.05,knee:0.18,ankle:-0.02,roll:0}
  }
  if(state==="plant"){
    return{spread:side*0.04,hip:0.06,knee:0.36,ankle:0.08,roll:0}
  }
  if(state==="pull"){
    return{spread:side*0.03,hip:-0.28,knee:0.52,ankle:0.12,roll:0}
  }
  if(state==="push"){
    return{spread:side*0.03,hip:-0.18,knee:0.10,ankle:0.03,roll:0}
  }
  if(state==="lift"){
    return{spread:side*0.02,hip:0.10,knee:0.50,ankle:-0.02,roll:0}
  }
  return n
}

function choosePrimitive(o,i){
  const m=o.mind,d=m.development,leg=o.legs[i],lb=m.legs[i];
  const phase=d.phase;

  if(m.debug?.forceLegStates && o.age < m.debug.forceLegUntil){
    return m.debug.forceLegStates[i] || "relax";
  }

  // Temporary debug tutors demonstrate useful whole-leg sequences.
  if(m.debug?.walkTutor>0){
    const beat=Math.floor(o.age*2.2)%4;
    const diagonalA=(i===0||i===3), swingA=(beat===0||beat===1);
    const swing=diagonalA?swingA:!swingA;
    if(swing)return leg.contact?"lift":"plant";
    return leg.contact?"push":"plant";
  }
  if(m.debug?.crawlTutor>0){
    const beat=Math.floor(o.age*1.6+i)%4;
    if(leg.grip)return "pull";
    if(beat===0)return "reach";
    if(beat===1)return "plant";
    if(beat===2&&leg.contact)return "push";
    return "relax";
  }

  // No oscillators. A leg chooses one discrete biological action, completes it, then changes.
  if(phase==="newborn motor discovery"){
    const r=Math.random();
    if(r<0.58)return "relax";
    if(r<0.76)return "lift";
    if(r<0.90)return "plant";
    return "reach";
  }

  if(phase==="reach + plant"){
    if(leg.contact)return Math.random()<0.48?"push":"lift";
    return Math.random()<0.62?"plant":"reach";
  }

  if(phase.includes("crawl")){
    if(leg.grip)return "pull";
    if(leg.contact)return Math.random()<0.55?"push":"lift";
    return Math.random()<0.62?"reach":"plant";
  }

  if(phase==="standing practice"){
    if(leg.contact)return Math.random()<0.75?"push":"relax";
    return "plant";
  }

  if(phase==="first steps"||phase==="walking practice"){
    if(leg.contact)return Math.random()<0.44?"push":"lift";
    return Math.random()<0.58?"plant":"reach";
  }

  return "relax"
}

function stateDuration(state,phase){
  const base={
    relax:[0.55,1.35],reach:[0.65,1.15],plant:[0.55,1.0],
    pull:[0.45,0.85],push:[0.50,0.95],lift:[0.45,0.80]
  }[state]||[0.6,1.0];
  const slow=phase==="newborn motor discovery"?1.35:1;
  return rand(base[0],base[1])*slow
}

function spinalLegController(app,o,i,dt){
  const m=o.mind,d=m.development,leg=o.legs[i],lb=m.legs[i];
  lb.timer-=dt;

  // Proprioceptive safety: fast swinging means RELAX, not another stronger command.
  if(leg.footSpeed>1.45){
    lb.state="relax";lb.timer=Math.max(lb.timer,0.45);lb.failed++;
  }

  // Sole reflex: once planted, keep it planted briefly instead of waving away instantly.
  if(leg.contact){
    lb.contactHold+=dt;
    if(lb.state==="plant"&&lb.contactHold>0.10){
      d.successfulPlants++;d.bodyMap=clamp(d.bodyMap+dt*0.010,0,1);
      lb.primitiveMemory.plant=clamp(lb.primitiveMemory.plant+dt*0.018,0,1)
    }
  }else lb.contactHold=0;

  if(lb.timer<=0){
    lb.lastState=lb.state;
    lb.state=choosePrimitive(o,i);
    lb.timer=stateDuration(lb.state,d.phase);
  }

  // Only one/two legs get meaningful authority during early life.
  const activeEarly=(i===m.activeLeg || i===m.supportLeg);
  if(d.phase==="newborn motor discovery"&&!activeEarly){
    relaxLeg(o,i);return
  }

  const targets=primitiveTargets(o,i,lb.state);
  let activation={
    relax:0.025,reach:0.12,plant:0.15,pull:0.20,push:0.18,lift:0.12
  }[lb.state]||0.04;

  // Strength/skill slowly unlock authority.
  const skill=clamp(0.30+d.bodyMap*0.30+d.crawlSkill*0.18+d.supportSkill*0.15,0.30,0.82);
  activation*=skill;

  // If supporting useful weight, hold instead of hunting a new pose.
  if(leg.contact&&leg.load>0.52&&(lb.state==="plant"||lb.state==="push")){
    activation*=0.86;
  }

  setLegCommand(m,i,targets,activation);

  // Grip decisions live above muscles but below high-level navigation.
  if(lb.state==="plant" && leg.contact && !leg.grip && d.phase!=="newborn motor discovery"){
    if(Math.random()<dt*(0.10+d.gripSkill*0.28))createGroundGrip(app.P,o,leg)
  }
  if(lb.state==="reach" && leg.gripCandidate && !leg.grip && d.phase.includes("crawl")){
    const chance=dt*(0.08+d.gripSkill*0.35+m.personality.curiosity*0.08);
    if(Math.random()<chance)createGrip(app.P,o,leg,leg.gripCandidate.object)
  }

  if(lb.state==="pull"&&!leg.grip){
    lb.state="reach";lb.timer=0.35
  }
}

function updateGripLearning(app,o,dt){
  const m=o.mind,d=m.development;
  updateGrips(app.P,o,dt);
  const v=bodyVelocity(o),speed=Math.hypot(v.x,v.z);

  for(let i=0;i<4;i++){
    const leg=o.legs[i],lb=m.legs[i];
    if(leg.grip&&lb.state==="pull"){
      if(speed>0.012){
        d.gripSkill=clamp(d.gripSkill+dt*0.011,0,1);
        d.crawlSkill=clamp(d.crawlSkill+dt*0.008,0,1);
        lb.primitiveMemory.pull=clamp(lb.primitiveMemory.pull+dt*0.018,0,1);
        d.successfulPulls++;
      }
      if(leg.grip.age>0.75+d.gripSkill*0.85){
        releaseGrip(app.P,leg);lb.state="relax";lb.timer=rand(0.25,0.55)
      }
    }
  }
}

function updateDevelopment(o,dt){
  const m=o.mind,d=m.development,v=bodyVelocity(o);
  const speed=Math.hypot(v.x,v.z),strength=avgStrength(o);

  if(speed>0.005)d.bodyMap=clamp(d.bodyMap+dt*0.0018,0,1);
  if(o.contacts>=1&&speed>0.008)d.crawlSkill=clamp(d.crawlSkill+dt*0.0045,0,1);
  if(o.contacts>=2&&o.upright>0.38)d.supportSkill=clamp(d.supportSkill+dt*0.0038,0,1);
  if(o.contacts>=3&&o.upright>0.55)d.balanceSkill=clamp(d.balanceSkill+dt*0.0035,0,1);
  if(o.contacts>=2&&speed>0.014&&o.upright>0.48)d.stepSkill=clamp(d.stepSkill+dt*0.0028,0,1);
  if(speed>0.022&&o.upright>0.55)d.walkSkill=clamp(d.walkSkill+dt*0.0022,0,1);

  const next=phaseFor(o);
  if(next!==d.phase){
    d.phase=next;
    m.stageName=next;
    m.thought=`I think I learned enough for ${next}.`;
    if(Math.random()<0.65)showBubble(o,`Trying ${next}.`,2.6)
  }
  m.stageName=d.phase;

  // Early development deliberately limits concurrent voluntary movement.
  if(d.phase==="newborn motor discovery"){
    if(m.activeTimer===undefined)m.activeTimer=0;
    m.activeTimer-=dt;
    if(m.activeTimer<=0){
      m.activeLeg=Math.floor(Math.random()*4);
      m.supportLeg=Math.random()<0.35?(m.activeLeg+2)%4:-1;
      m.activeTimer=rand(1.0,2.1);
    }
  }else{
    m.activeLeg=-1;m.supportLeg=-1
  }

  return{speed,strength,fatigue:avgFatigue(o)}
}

function chooseTarget(app,o){
  const m=o.mind;
  if(m.energy<0.30){const b=nearby(app,o,"bed",20);if(b){m.target=b.it;return}}
  const food=nearby(app,o,"food",18);
  if(food&&m.hunger>0.38){m.target=food.it;return}
  const candidates=app.objects.filter(x=>x.active&&["toy","ball","pushblock","platform"].includes(x.type));
  m.target=Math.random()<0.50?(candidates[Math.floor(Math.random()*Math.max(1,candidates.length))]||null):null
}

function learnBody(o,dt){
  const m=o.mind,p=bodyPosition(o),dx=p.x-m.prevPos.x,dy=p.y-m.prevPos.y,dz=p.z-m.prevPos.z;
  const h=Math.hypot(dx,dz);
  m.dense=h*4+Math.max(0,dy)*1.8+(o.contacts>=1?0.0015:0);
  m.denseAccum+=m.dense;

  for(let i=0;i<4;i++){
    const leg=o.legs[i];
    for(const j of JOINTS){
      const now=leg.angles[j]||0,prev=m.prevAngles[i][j],da=now-prev;
      if(Math.abs(da)>0.0012){
        const e=m.model[i][j],k=0.015,sg=Math.sign(da);
        e.forward=THREE.MathUtils.lerp(e.forward,clamp(h*sg/dt,-1,1),k);
        e.lift=THREE.MathUtils.lerp(e.lift,clamp(dy*sg/dt,-1,1),k);
        e.support=THREE.MathUtils.lerp(e.support,(leg.contact?1:0)*sg,k);
        e.samples++
      }
      m.prevAngles[i][j]=now
    }
  }
  m.prevPos={x:p.x,y:p.y,z:p.z}
}

function blendLearnedPolicy(o,dt){
  const m=o.mind,d=m.development;
  if(d.phase!=="first steps"&&d.phase!=="walking practice")return;

  // Learned policy only nudges spinal primitives; it never directly owns the whole limb.
  const authority=d.phase==="first steps"?0.08:clamp(0.10+d.walkSkill*0.18,0.10,0.28);
  for(let i=0;i<4;i++){
    const leg=o.legs[i],ph=(m.phase[i]+=dt*m.policy.freq*Math.PI*2)+m.policy.phase[i];
    for(const j of JOINTS){
      const e=m.model[i][j],a=leg.angles[j]||0;
      const f=[1,Math.sin(ph),Math.cos(ph),leg.contact?1:0,a,leg.load||0,e.forward,e.lift];
      const out=policyOut(m.policy.legs[i][j],f,m.policy.gain);
      const range={spread:0.035,hip:0.07,knee:0.09,ankle:0.05,roll:0.03}[j];
      m.command[i][j].target+=out*range*authority;
    }
  }
}

function evaluate(o,app){
  const m=o.mind;if(app.simTime-m.trialTime<10)return;
  const p=bodyPosition(o),dist=Math.hypot(p.x-m.trialX,p.z-m.trialZ);
  const score=m.denseAccum+dist*0.6+m.development.walkSkill*0.3;
  if(score>m.bestScore+0.01){m.bestScore=score;m.best=clone(m.policy)}
  else m.targetPolicy=clone(m.best);
  m.targetPolicy=mutate(m.targetPolicy,0.035);
  m.generation++;m.denseAccum=0;m.trialTime=app.simTime;m.trialX=p.x;m.trialZ=p.z
}

export function updateMind(app,o,dt){
  const m=o.mind;
  if(m.debug){
    m.debug.walkTutor=Math.max(0,m.debug.walkTutor-dt);
    m.debug.crawlTutor=Math.max(0,m.debug.crawlTutor-dt);
    if(m.debug.freezeBrain){
      m.thought="Debug: brain frozen.";
      return m.command;
    }
  }
  m.energy=clamp(m.energy-(m.sleep.sleeping?0:dt*(0.00065+m.activity*0.00065)));
  m.hunger=clamp(m.hunger+dt*0.0015);
  social(app,o,dt);sleep(app,o,dt);

  if(m.sleep.sleeping){
    for(const leg of o.legs)releaseGrip(app.P,leg);
    const rest={spread:0,hip:-0.03,knee:0.44,ankle:0.03,roll:0};
    for(let i=0;i<4;i++)setLegCommand(m,i,rest,0.015);
    m.thought="Sleeping and recovering.";
    return m.command
  }

  const dev=updateDevelopment(o,dt);
  updateGripLearning(app,o,dt);

  for(let i=0;i<4;i++)spinalLegController(app,o,i,dt);
  blendLearnedPolicy(o,dt);

  m.decisionTimer-=dt;
  if(m.decisionTimer<=0){m.decisionTimer=rand(3.5,6.5);chooseTarget(app,o)}

  if(m.target&&m.target.active){
    const p=bodyPosition(o),q=m.target.body.translation();
    m.desiredHeading=Math.atan2(q.x-p.x,q.z-p.z)
  }

  learnBody(o,dt);evaluate(o,app);

  const ph=m.development.phase;
  if(ph==="newborn motor discovery")m.thought="Tiny movements. One leg at a time.";
  else if(ph==="reach + plant")m.thought="Reach... find the ground... hold it.";
  else if(ph==="grip + pull crawling")m.thought="Grip, pull, release.";
  else if(ph==="supported crawling")m.thought="I can drag myself a little.";
  else if(ph==="standing practice")m.thought="Keep useful feet planted.";
  else if(ph==="first steps")m.thought="Lift one foot without losing the others.";
  else m.thought="Trying to make my steps smoother.";

  return m.command
}


const DEV_PHASES=[
  "newborn motor discovery","reach + plant","grip + pull crawling",
  "supported crawling","standing practice","first steps","walking practice"
];
const LEG_STATES=["relax","reach","plant","pull","push","lift"];
const MAGIC=[79,82,66,17]; // "ORB" + format 17, stored as bits in the file.

function q8(v,min=0,max=1){return Math.round(clamp((v-min)/(max-min),0,1)*255)}
function uq8(v,min=0,max=1){return min+(v/255)*(max-min)}
function s8(v,range=1){return Math.round(clamp(v/range,-1,1)*127)&255}
function us8(v,range=1){const n=v>127?v-256:v;return (n/127)*range}
function u16(v){v=Math.max(0,Math.min(65535,Math.round(v)));return[(v>>8)&255,v&255]}
function i16(v){v=Math.max(-32768,Math.min(32767,Math.round(v)));if(v<0)v+=65536;return[(v>>8)&255,v&255]}
function readU16(a,i){return(a[i]<<8)|a[i+1]}
function readI16(a,i){let v=readU16(a,i);return v>32767?v-65536:v}
function clonePolicyShape(p){return JSON.parse(JSON.stringify(p))}

export function debugAction(app,o,action){
  if(!o)return "No selected Orbsight.";
  const m=o.mind,d=m.development;
  const muscles=()=>o.legs.flatMap(l=>JOINTS.map(j=>l.muscle[j]));
  const setStrength=v=>muscles().forEach(x=>x.strength=clamp(v,0.07,1));
  const addStrength=v=>muscles().forEach(x=>x.strength=clamp(x.strength+v,0.07,1));
  const setFatigue=v=>muscles().forEach(x=>x.fatigue=clamp(v,0,1));
  const forceAll=state=>{m.debug.forceLegStates=[state,state,state,state];m.debug.forceLegUntil=o.age+3};

  switch(action){
    case "teach-walk":
      Object.assign(d,{bodyMap:.95,crawlSkill:.92,gripSkill:.82,supportSkill:.88,balanceSkill:.86,stepSkill:.78,walkSkill:.48});
      setStrength(.72);setFatigue(0);m.debug.walkTutor=30;m.debug.forcePhase="walking practice";m.thought="Debug tutor: practicing walking.";break;
    case "teach-crawl":
      Object.assign(d,{bodyMap:.75,crawlSkill:.52,gripSkill:.40,supportSkill:.34,balanceSkill:.18,stepSkill:.05,walkSkill:0});
      setStrength(.36);setFatigue(0);m.debug.crawlTutor=30;m.debug.forcePhase="grip + pull crawling";m.thought="Debug tutor: practicing crawling.";break;
    case "teach-grip": d.gripSkill=.95;d.crawlSkill=Math.max(d.crawlSkill,.45);break;
    case "teach-stand":
      Object.assign(d,{bodyMap:.88,crawlSkill:.70,gripSkill:.65,supportSkill:.82,balanceSkill:.62,stepSkill:.12});
      setStrength(.58);m.debug.forcePhase="standing practice";break;
    case "teach-balance": d.balanceSkill=.95;d.supportSkill=Math.max(d.supportSkill,.85);break;
    case "max-skills":
      ["bodyMap","crawlSkill","gripSkill","supportSkill","balanceSkill","stepSkill","walkSkill"].forEach(k=>d[k]=1);break;
    case "reset-learning":
      Object.assign(d,{bodyMap:0,crawlSkill:0,gripSkill:0,supportSkill:0,balanceSkill:0,stepSkill:0,walkSkill:0,successfulPulls:0,successfulPlants:0});
      setStrength(.14);setFatigue(0);m.generation=1;m.bestScore=-999;m.targetPolicy=clonePolicyShape(m.policy);m.best=clonePolicyShape(m.policy);
      for(const lb of m.legs){lb.success=0;lb.failed=0;for(const k of Object.keys(lb.primitiveMemory))lb.primitiveMemory[k]=0}
      m.debug.forcePhase=null;m.debug.walkTutor=0;m.debug.crawlTutor=0;break;
    case "strength-plus": addStrength(.10);break;
    case "strength-minus": addStrength(-.10);break;
    case "strength-max": setStrength(1);break;
    case "strength-newborn": setStrength(.14);break;
    case "fatigue-clear": setFatigue(0);break;
    case "fatigue-max": setFatigue(1);break;
    case "energy-full": m.energy=1;break;
    case "energy-low": m.energy=.15;break;
    case "hunger-clear": m.hunger=0;break;
    case "hunger-high": m.hunger=1;break;
    case "sleep": m.sleep.sleeping=true;m.sleep.time=0;break;
    case "wake": m.sleep.sleeping=false;m.sleep.cooldown=4;break;
    case "relax-all": forceAll("relax");break;
    case "plant-all": forceAll("plant");break;
    case "lift-all": forceAll("lift");break;
    case "push-all": forceAll("push");break;
    case "pull-all": forceAll("pull");break;
    case "reach-1": m.debug.forceLegStates=["reach","relax","relax","relax"];m.debug.forceLegUntil=o.age+3;break;
    case "reach-2": m.debug.forceLegStates=["relax","reach","relax","relax"];m.debug.forceLegUntil=o.age+3;break;
    case "reach-3": m.debug.forceLegStates=["relax","relax","reach","relax"];m.debug.forceLegUntil=o.age+3;break;
    case "reach-4": m.debug.forceLegStates=["relax","relax","relax","reach"];m.debug.forceLegUntil=o.age+3;break;
    case "grip-ground":
      for(const leg of o.legs)if(leg.contact&&!leg.grip)createGroundGrip(app.P,o,leg);break;
    case "release-grips": for(const leg of o.legs)releaseGrip(app.P,leg);break;
    case "stop-body":
      for(const part of o.parts){part.body.setLinvel({x:0,y:0,z:0},true);part.body.setAngvel({x:0,y:0,z:0},true)}break;
    case "nudge-forward": {
      const v=o.shell.linvel();o.shell.setLinvel({x:v.x,y:v.y,z:v.z-1.2},true);break;
    }
    case "nudge-up": {
      const v=o.shell.linvel();o.shell.setLinvel({x:v.x,y:Math.max(v.y,1.7),z:v.z},true);break;
    }
    case "curiosity-max": m.personality.curiosity=1;break;
    case "patience-max": m.personality.patience=1;break;
    case "sociability-max": m.personality.sociability=1;break;
    case "playfulness-max": m.personality.playfulness=1;break;
    case "personality-random":
      for(const k of Object.keys(m.personality))m.personality[k]=rand(.05,.98);break;
    case "generation-plus": m.generation+=50;break;
    case "freeze-brain": m.debug.freezeBrain=!m.debug.freezeBrain;break;
    case "phase-auto": m.debug.forcePhase=null;break;
    case "phase-newborn": m.debug.forcePhase=DEV_PHASES[0];break;
    case "phase-reach": m.debug.forcePhase=DEV_PHASES[1];break;
    case "phase-crawl": m.debug.forcePhase=DEV_PHASES[2];break;
    case "phase-supported": m.debug.forcePhase=DEV_PHASES[3];break;
    case "phase-stand": m.debug.forcePhase=DEV_PHASES[4];break;
    case "phase-steps": m.debug.forcePhase=DEV_PHASES[5];break;
    case "phase-walk": m.debug.forcePhase=DEV_PHASES[6];break;
    case "random-policy":
      m.policy=seedPolicy();m.targetPolicy=clonePolicyShape(m.policy);m.best=clonePolicyShape(m.policy);m.bestScore=-999;break;
    default:return `Unknown debug action: ${action}`;
  }
  m.debug.lastAction=action;
  return `Applied ${action} to ${m.name}.`;
}

export function encodeOrbsightBits(o){
  const m=o.mind,d=m.development,b=[];
  b.push(...MAGIC);

  // Name: fixed 16 ASCII bytes. Everything in the .orb is still represented as 0/1 bits.
  const name=(m.name||"Orbsight").slice(0,16);
  for(let i=0;i<16;i++)b.push(i<name.length?name.charCodeAt(i)&255:0);

  b.push(...u16(o.id),...u16(o.age*10),q8(m.energy),q8(m.hunger));
  b.push(q8(m.personality.curiosity),q8(m.personality.patience),q8(m.personality.playfulness),q8(m.personality.sociability));
  b.push(...u16(m.generation),...i16(m.bestScore*100));
  b.push(Math.max(0,DEV_PHASES.indexOf(d.phase)));
  for(const k of ["bodyMap","crawlSkill","gripSkill","supportSkill","balanceSkill","stepSkill","walkSkill"])b.push(q8(d[k]));
  b.push(...u16(d.successfulPulls),...u16(d.successfulPlants));
  b.push(q8(m.policy.freq,0,1.5),q8(m.policy.gain,0,1));

  for(let i=0;i<4;i++)b.push(...i16((m.phase[i]||0)*1000));

  // Current learned policy weights.
  for(let i=0;i<4;i++)for(const j of JOINTS)for(let k=0;k<FEATURES;k++)b.push(s8(m.policy.legs[i][j][k],1.6));

  // Primitive memories + current leg state.
  for(let i=0;i<4;i++){
    const lb=m.legs[i];
    b.push(Math.max(0,LEG_STATES.indexOf(lb.state)),s8(lb.reachBias,.2));
    b.push(...u16(lb.success),...u16(lb.failed));
    for(const k of ["reach","plant","pull","push","lift"])b.push(q8(lb.primitiveMemory[k]));
  }

  // Muscle strength + fatigue for all 20 joints.
  for(const leg of o.legs)for(const j of JOINTS)b.push(q8(leg.muscle[j].strength),q8(leg.muscle[j].fatigue));

  // Learned body model.
  for(let i=0;i<4;i++)for(const j of JOINTS){
    const e=m.model[i][j];
    b.push(s8(e.forward,1),s8(e.lift,1),s8(e.support,1),...u16(e.samples));
  }

  const groups=b.map(v=>(v&255).toString(2).padStart(8,"0"));
  const lines=[];for(let i=0;i<groups.length;i+=16)lines.push(groups.slice(i,i+16).join(" "));
  return lines.join("\n");
}

export function decodeOrbsightBits(text){
  const bits=String(text).replace(/[^01]/g,"");
  if(bits.length%8!==0)throw new Error("Binary Orbsight file has an incomplete 8-bit group.");
  const a=[];for(let i=0;i<bits.length;i+=8)a.push(parseInt(bits.slice(i,i+8),2));
  if(a.length<40)throw new Error("Binary Orbsight file is too short.");
  if(MAGIC.some((v,i)=>a[i]!==v))throw new Error("Not an Orbsight binary file or unsupported version.");

  let p=4;
  let name="";for(let i=0;i<16;i++){const c=a[p++];if(c)name+=String.fromCharCode(c)}
  const data={
    name,id:readU16(a,p),age:readU16(a,p+2)/10,energy:a[p+4]/255,hunger:a[p+5]/255,
    personality:{curiosity:a[p+6]/255,patience:a[p+7]/255,playfulness:a[p+8]/255,sociability:a[p+9]/255}
  };
  p+=10;
  data.generation=readU16(a,p);p+=2;
  data.bestScore=readI16(a,p)/100;p+=2;
  data.phaseName=DEV_PHASES[a[p++]]||DEV_PHASES[0];
  data.skills={};for(const k of ["bodyMap","crawlSkill","gripSkill","supportSkill","balanceSkill","stepSkill","walkSkill"])data.skills[k]=a[p++]/255;
  data.successfulPulls=readU16(a,p);p+=2;data.successfulPlants=readU16(a,p);p+=2;
  data.policy={freq:uq8(a[p++],0,1.5),gain:uq8(a[p++],0,1),phase:[],legs:Array.from({length:4},()=>Object.fromEntries(JOINTS.map(j=>[j,Array(FEATURES).fill(0)])))};
  for(let i=0;i<4;i++){data.policy.phase[i]=readI16(a,p)/1000;p+=2}
  for(let i=0;i<4;i++)for(const j of JOINTS)for(let k=0;k<FEATURES;k++)data.policy.legs[i][j][k]=us8(a[p++],1.6);

  data.legs=[];
  for(let i=0;i<4;i++){
    const state=LEG_STATES[a[p++]]||"relax",reachBias=us8(a[p++],.2),success=readU16(a,p);p+=2;const failed=readU16(a,p);p+=2;
    const primitiveMemory={};for(const k of ["reach","plant","pull","push","lift"])primitiveMemory[k]=a[p++]/255;
    data.legs.push({state,reachBias,success,failed,primitiveMemory});
  }

  data.muscles=Array.from({length:4},()=>({}));
  for(let i=0;i<4;i++)for(const j of JOINTS)data.muscles[i][j]={strength:a[p++]/255,fatigue:a[p++]/255};

  data.model=Array.from({length:4},()=>({}));
  for(let i=0;i<4;i++)for(const j of JOINTS){
    data.model[i][j]={forward:us8(a[p++],1),lift:us8(a[p++],1),support:us8(a[p++],1),samples:readU16(a,p)};p+=2;
  }
  data.byteLength=a.length;
  return data;
}

export function applyOrbsightBits(o,text){
  const data=decodeOrbsightBits(text),m=o.mind,d=m.development;
  m.name=data.name||m.name;o.age=data.age;m.energy=data.energy;m.hunger=data.hunger;
  Object.assign(m.personality,data.personality);
  m.generation=data.generation;m.bestScore=data.bestScore;
  Object.assign(d,data.skills,{phase:data.phaseName,successfulPulls:data.successfulPulls,successfulPlants:data.successfulPlants});
  m.policy=data.policy;m.targetPolicy=clonePolicyShape(data.policy);m.best=clonePolicyShape(data.policy);
  m.phase=[...data.policy.phase];
  for(let i=0;i<4;i++){
    Object.assign(m.legs[i],data.legs[i]);
    for(const j of JOINTS){
      o.legs[i].muscle[j].strength=clamp(data.muscles[i][j].strength,.07,1);
      o.legs[i].muscle[j].fatigue=clamp(data.muscles[i][j].fatigue,0,1);
      Object.assign(m.model[i][j],data.model[i][j]);
    }
  }
  m.debug.forcePhase=null;m.debug.walkTutor=0;m.debug.crawlTutor=0;m.debug.freezeBrain=false;
  m.thought="Loaded my mind/body data from a binary Orbsight file.";
  return data;
}

export function cleanupMind(app,o){
  if(!o.mind?.bubble)return;
  app.scene.remove(o.mind.bubble.sprite);o.mind.bubble.tex.dispose();o.mind.bubble.sprite.material.dispose()
}
