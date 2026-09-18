import * as THREE from "three";
import {nearby} from "./world.js";
import {bodyPosition,bodyVelocity,createGrip,createGroundGrip,releaseGrip,updateGrips} from "./physics.js";

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const JOINTS=["spread","hip","knee","ankle","roll"];
const FEATURES=8;
const CHAT=[
 "Hello.","I am learning my legs.","I think I moved!","Where are you going?","This place is large.",
 "I found something.","I almost stayed upright.","My feet are busy.","I want to climb that.",
 "I remember this area.","That block moved.","I need a rest.","I am practicing.","One leg at a time.",
 "I think this movement works.","Do you know this place?","Wait for me.","Ball!","That looked difficult."
];
const REPLIES=["Okay.","I see.","Maybe.","Same here.","Interesting.","I will try.","Be careful.","Where?","Good luck.","I noticed that too."];

function weights(scale=0.24){return Array.from({length:FEATURES},()=>rand(-scale,scale))}
function seedPolicy(){return{freq:rand(0.42,0.90),gain:rand(0.42,0.68),phase:[0,Math.PI,Math.PI,0],legs:Array.from({length:4},()=>Object.fromEntries(JOINTS.map(j=>[j,weights(j==="hip"?0.28:0.22)])))}}
function clone(x){return JSON.parse(JSON.stringify(x))}
function mutate(p,amt=0.07){
  const n=clone(p);const edits=1+Math.floor(Math.random()*3);
  for(let e=0;e<edits;e++){const li=Math.floor(Math.random()*4),j=JOINTS[Math.floor(Math.random()*JOINTS.length)],w=n.legs[li][j];for(let q=0;q<2;q++){const k=Math.floor(Math.random()*w.length);w[k]=clamp(w[k]+rand(-amt,amt),-2.2,2.2)}}
  if(Math.random()<0.2)n.freq=clamp(n.freq+rand(-amt,amt)*0.2,0.25,1.1);return n
}
function policyOut(w,f,g){let s=0;for(let i=0;i<w.length;i++)s+=w[i]*f[i];return Math.tanh(s)*g}

function bubbleSprite(app){
  const c=document.createElement("canvas");c.width=512;c.height=180;const tex=new THREE.CanvasTexture(c),mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false}),sprite=new THREE.Sprite(mat);
  sprite.scale.set(3.5,1.25,1);sprite.visible=false;sprite.renderOrder=50;app.scene.add(sprite);return{c,ctx:c.getContext("2d"),tex,sprite,timer:0,pending:null,pendingTimer:0}
}
function showBubble(o,text,dur=3){
  const b=o.mind.bubble,ctx=b.ctx;ctx.clearRect(0,0,512,180);ctx.fillStyle="rgba(250,250,247,.96)";ctx.strokeStyle="#20252c";ctx.lineWidth=6;ctx.beginPath();ctx.roundRect(10,10,492,140,24);ctx.fill();ctx.stroke();ctx.fillStyle="#15181d";ctx.font="600 27px system-ui";ctx.textAlign="center";
  const words=String(text).split(/\s+/),lines=[];let line="";for(const w of words){const t=line?line+" "+w:w;if(ctx.measureText(t).width>440&&line){lines.push(line);line=w}else line=t}if(line)lines.push(line);lines.slice(0,3).forEach((l,i)=>ctx.fillText(l,256,65+i*34));
  b.tex.needsUpdate=true;b.sprite.visible=true;b.timer=dur
}
export function attachMind(app,o){
  const p=seedPolicy(),pos=bodyPosition(o);
  o.mind={
    name:`Orbsight ${o.id}`,energy:1,hunger:0,thought:"Getting used to this body.",desiredHeading:0,
    personality:{curiosity:rand(0.25,0.95),patience:rand(0.15,0.9),playfulness:rand(0.1,0.95),sociability:rand(0.1,0.95)},
    policy:p,targetPolicy:clone(p),best:clone(p),bestScore:-999,generation:1,trialTime:0,trialX:pos.x,trialZ:pos.z,
    dense:0,denseAccum:0,activity:0,fragments:[],stage:0,stageName:"body discovery",evidence:{stable:0,crawl:0,transfer:0,step:0,walk:0},
    phase:[0,0,0,0],model:Array.from({length:4},()=>Object.fromEntries(JOINTS.map(j=>[j,{forward:0,lift:0,support:0,samples:0}]))),
    prevPos:{x:pos.x,y:pos.y,z:pos.z},prevAngles:Array.from({length:4},()=>({spread:0,hip:0,knee:0,ankle:0,roll:0})),
    babble:{timer:0,leg:0,joint:"knee",value:0,target:0},
    command:Array.from({length:4},()=>Object.fromEntries(JOINTS.map(j=>[j,{target:0,activation:0.1}]))),
    bubble:bubbleSprite(app),thoughtTimer:rand(5,11),chatTimer:rand(7,15),decisionTimer:0,
    sleep:{sleeping:false,time:0,lastGain:"—",cooldown:0},
    calibration:{done:false,phase:"newborn"},
    development:{
      age:0,phase:"newborn flop",crawlingSkill:0,standingSkill:0,walkingSkill:0,
      gripSkill:0,balanceSkill:0,lastContacts:0,lastGripTime:-999
    }
  }
}
function smoothPolicy(m,dt){
  const a=1-Math.exp(-dt*1.0),p=m.policy,t=m.targetPolicy;p.freq=THREE.MathUtils.lerp(p.freq,t.freq,a);p.gain=THREE.MathUtils.lerp(p.gain,t.gain,a);
  for(let i=0;i<4;i++){p.phase[i]=THREE.MathUtils.lerp(p.phase[i],t.phase[i],a);for(const j of JOINTS)for(let k=0;k<FEATURES;k++)p.legs[i][j][k]=THREE.MathUtils.lerp(p.legs[i][j][k],t.legs[i][j][k],a)}
}
function stageName(s){return["body discovery","ground support","crawling","weight transfer","stepping","walking","free locomotion"][s]||"free locomotion"}
function chooseTarget(app,o){
  const m=o.mind;if(m.energy<0.34){const b=nearby(app,o,"bed",20);if(b){m.target=b.it;m.thought="Looking for a mattress.";return}}
  const food=nearby(app,o,"food",18);if(food&&m.hunger>0.35){m.target=food.it;m.thought="Looking for food.";return}
  if(Math.random()<0.35){m.target=null;m.desiredHeading+=rand(-0.6,0.6);m.thought="Wandering around."}
  else{const candidates=app.objects.filter(x=>x.active&&["toy","ball","pushblock","platform"].includes(x.type));m.target=candidates[Math.floor(Math.random()*Math.max(1,candidates.length))]||null;m.thought=m.target?`Interested in ${m.target.type}.`:"Exploring."}
}
function social(app,o,dt){
  const m=o.mind,b=m.bubble;b.timer-=dt;if(b.timer<=0)b.sprite.visible=false;if(b.pending){b.pendingTimer-=dt;if(b.pendingTimer<=0){showBubble(o,b.pending);b.pending=null}}
  m.thoughtTimer-=dt;if(m.thoughtTimer<=0&&!m.sleep.sleeping){m.thoughtTimer=rand(7,15);if(Math.random()<0.55)showBubble(o,m.thought,rand(2.2,3.6))}
  m.chatTimer-=dt;if(m.chatTimer<=0&&!m.sleep.sleeping){m.chatTimer=rand(9,19);if(Math.random()<m.personality.sociability*0.7){let other=null,bd=4;const p=bodyPosition(o);for(const q of app.orbs){if(q===o||q.mind.sleep.sleeping)continue;const qp=bodyPosition(q),d=Math.hypot(qp.x-p.x,qp.z-p.z);if(d<bd){bd=d;other=q}}if(other){showBubble(o,CHAT[Math.floor(Math.random()*CHAT.length)]);other.mind.bubble.pending=REPLIES[Math.floor(Math.random()*REPLIES.length)];other.mind.bubble.pendingTimer=rand(0.8,1.6)}}}
  const p=bodyPosition(o);b.sprite.position.set(p.x,p.y+1.28,p.z)
}
function sleep(app,o,dt){
  const m=o.mind;m.sleep.cooldown=Math.max(0,m.sleep.cooldown-dt);const b=nearby(app,o,"bed",1.5);
  if(!m.sleep.sleeping&&m.energy<0.28&&m.sleep.cooldown<=0&&b){m.sleep.sleeping=true;m.sleep.time=0;m.thought="Sleeping.";showBubble(o,"zzz...",4)}
  if(m.sleep.sleeping){for(const leg of o.legs)releaseGrip(app.P,leg);m.sleep.time+=dt;m.energy=clamp(m.energy+dt*0.06);if(m.energy>0.97||m.sleep.time>14){m.sleep.sleeping=false;m.sleep.cooldown=8;m.energy=Math.max(m.energy,0.94);m.sleep.lastGain=m.stageName;showBubble(o,`I feel a little better at ${m.stageName}.`,3.5)}}
}
function sampleCount(m){let n=0;for(const l of m.model)for(const j of JOINTS)n+=l[j].samples;return n}
function learnBody(o,dt){
  const m=o.mind,p=bodyPosition(o),dx=p.x-m.prevPos.x,dy=p.y-m.prevPos.y,dz=p.z-m.prevPos.z;
  const forward=dx*Math.sin(m.desiredHeading)+dz*Math.cos(m.desiredHeading),h=Math.hypot(dx,dz);
  let r=Math.max(0,forward)*14+h*3.6+Math.max(0,dy)*2.8+(o.contacts>=2?0.004:0);
  // Early development should value any controlled translation, including crawling.
  if(m.stage<=2 && h>0.00015)r+=Math.min(0.018,h*9);
  m.dense=r;m.denseAccum+=r;
  for(let i=0;i<4;i++){const leg=o.legs[i];for(const j of JOINTS){const now=leg.angles[j]||0,prev=m.prevAngles[i][j],da=now-prev;if(Math.abs(da)>0.0015){const e=m.model[i][j],sg=Math.sign(da),k=0.025;e.forward=THREE.MathUtils.lerp(e.forward,clamp(forward*sg/dt,-1,1),k);e.lift=THREE.MathUtils.lerp(e.lift,clamp(dy*sg/dt,-1,1),k);e.support=THREE.MathUtils.lerp(e.support,(leg.contact?1:0)*sg,k);e.samples++}m.prevAngles[i][j]=now}}
  const ev=m.evidence;if(o.upright>0.58&&o.contacts>=2)ev.stable+=dt;if(h>0.0004&&o.contacts>=1)ev.crawl+=dt;if(o.contacts>=2&&h>0.00025)ev.transfer+=dt;if(h>0.0005)ev.step+=dt;if(h>0.0008&&o.upright>0.48)ev.walk+=dt;
  if(m.stage===0&&sampleCount(m)>80)m.stage=1;if(m.stage===1&&(ev.stable>3||ev.crawl>4))m.stage=2;if(m.stage===2&&ev.crawl>9)m.stage=3;if(m.stage===3&&ev.transfer>8)m.stage=4;if(m.stage===4&&ev.step>10)m.stage=5;if(m.stage===5&&ev.walk>16)m.stage=6;m.stageName=stageName(m.stage);
  m.prevPos={x:p.x,y:p.y,z:p.z}
}
function updatePolicy(o,dt){
  const m=o.mind;smoothPolicy(m,dt);
  m.babble.timer-=dt;if(m.babble.timer<=0){m.babble.timer=m.stage===0?rand(0.55,1.05):rand(1.5,2.8);m.babble.leg=Math.floor(Math.random()*4);m.babble.joint=JOINTS[Math.floor(Math.random()*JOINTS.length)];m.babble.target=rand(-1,1)}
  m.babble.value=THREE.MathUtils.lerp(m.babble.value,m.babble.target,1-Math.exp(-dt*1.6));
  let activity=0;
  for(let i=0;i<4;i++){
    const leg=o.legs[i],ph=(m.phase[i]+=dt*m.policy.freq*Math.PI*2)+m.policy.phase[i];
    for(const j of JOINTS){
      const a=leg.angles[j]||0,e=m.model[i][j],f=[1,Math.sin(ph),Math.cos(ph),leg.contact?1:0,a,leg.load||0,e.forward,e.lift];
      let out=policyOut(m.policy.legs[i][j],f,m.policy.gain);
      if(m.stage===0&&m.babble.leg===i&&m.babble.joint===j)out+=m.babble.value*0.52;
      out=clamp(out,-1,1);
      const ranges={spread:0.26,hip:0.40,knee:0.48,ankle:0.28,roll:0.20};
      const bases={spread:0,hip:-0.10,knee:leg.contact?0.16:0.30,ankle:0.06,roll:0};
      const target=bases[j]+out*ranges[j];
      m.command[i][j]={target,activation:0.12+0.88*Math.abs(out)};
      activity+=Math.abs(out)
    }
  }
  m.activity=activity/20
}
function evaluate(o,app){
  const m=o.mind;if(app.simTime-m.trialTime<8)return;
  const p=bodyPosition(o),dx=p.x-m.trialX,dz=p.z-m.trialZ,dist=Math.hypot(dx,dz),score=m.denseAccum*1.4+dist*(m.stage===2?1.4:0.68)+o.upright*0.45;
  if(score>m.bestScore+0.015){m.bestScore=score;m.best=clone(m.policy);m.fragments.unshift({score,leg:Math.floor(Math.random()*4)});m.fragments=m.fragments.slice(0,12)}else m.targetPolicy=clone(m.best);
  m.targetPolicy=mutate(m.targetPolicy,0.08-Math.min(0.045,m.generation*0.0007));m.generation++;m.denseAccum=0;m.trialTime=app.simTime;m.trialX=p.x;m.trialZ=p.z
}



function averageStrength(o){
  let total=0,n=0;
  for(const leg of o.legs)for(const j of JOINTS){total+=leg.muscle[j].strength;n++}
  return total/Math.max(1,n)
}
function averageFatigue(o){
  let total=0,n=0;
  for(const leg of o.legs)for(const j of JOINTS){total+=leg.muscle[j].fatigue;n++}
  return total/Math.max(1,n)
}
function developmentalPhase(o){
  const m=o.mind,d=m.development,str=averageStrength(o);
  if(o.age<5 || str<0.19)return "newborn flop";
  if(str<0.30 || d.crawlingSkill<0.24)return "reach + crawl";
  if(str<0.43 || d.standingSkill<0.26)return "supported crawl";
  if(str<0.56 || d.balanceSkill<0.34)return "stand practice";
  if(d.walkingSkill<0.42)return "first steps";
  return "walking practice"
}

function updateDevelopment(o,dt){
  const m=o.mind,d=m.development,p=bodyPosition(o),v=bodyVelocity(o);
  d.age=o.age;d.phase=developmentalPhase(o);
  const str=averageStrength(o),fat=averageFatigue(o);
  const grips=o.legs.filter(l=>l.grip).length;
  const horizontal=Math.hypot(v.x,v.z);

  // Skills grow from successful experiences rather than a fixed timer.
  if(grips>0 && horizontal>0.015)d.gripSkill=clamp(d.gripSkill+dt*0.010*grips,0,1);
  if(o.contacts>=1 && horizontal>0.012)d.crawlingSkill=clamp(d.crawlingSkill+dt*0.0075,0,1);
  if(o.contacts>=3 && o.upright>0.48)d.standingSkill=clamp(d.standingSkill+dt*0.0060,0,1);
  if(o.upright>0.60 && o.contacts>=2)d.balanceSkill=clamp(d.balanceSkill+dt*0.0055,0,1);
  if(horizontal>0.025 && o.upright>0.50 && o.contacts>=1)d.walkingSkill=clamp(d.walkingSkill+dt*0.0048,0,1);

  m.stageName=d.phase;
  if(d.phase==="newborn flop")m.stage=0;
  else if(d.phase==="reach + crawl")m.stage=1;
  else if(d.phase==="supported crawl")m.stage=2;
  else if(d.phase==="stand practice")m.stage=3;
  else if(d.phase==="first steps")m.stage=4;
  else m.stage=5;

  return{str,fat,grips,horizontal}
}

function weakBodyBabble(o,dt){
  const m=o.mind,d=m.development;
  // Slow random muscle twitches. Every leg can move independently.
  m.babble.timer-=dt;
  if(m.babble.timer<=0){
    m.babble.timer=rand(0.45,1.25);
    m.babble.leg=Math.floor(Math.random()*4);
    m.babble.joint=JOINTS[Math.floor(Math.random()*JOINTS.length)];
    m.babble.target=rand(-1,1);
  }
  m.babble.value=THREE.MathUtils.lerp(m.babble.value,m.babble.target,1-Math.exp(-dt*1.0));

  const neutral={spread:0,hip:-0.06,knee:0.34,ankle:0.05,roll:0};
  for(let i=0;i<4;i++)for(const j of JOINTS){
    let target=neutral[j];
    let activation=0.08;
    if(i===m.babble.leg && j===m.babble.joint){
      const amp={spread:0.15,hip:0.22,knee:0.28,ankle:0.17,roll:0.12}[j];
      target+=m.babble.value*amp;
      activation=0.35;
    }
    m.command[i][j]={target,activation};
  }
}

function crawlingCommands(o,dt){
  const m=o.mind,d=m.development;
  const neutral={spread:0,hip:-0.08,knee:0.28,ankle:0.05,roll:0};
  const forwardPair=[0,1],rearPair=[2,3];
  const t=o.age*0.75;

  for(let i=0;i<4;i++){
    const leg=o.legs[i],phase=t+(i%2)*Math.PI+(i>=2?0.65:0);
    // Crawl is intentionally messy: low-amplitude reaches and pulls.
    const reach=Math.sin(phase);
    const sideNoise=Math.sin(phase*0.71+i*1.4);
    m.command[i].spread={target:sideNoise*0.10,activation:0.26};
    m.command[i].hip={target:neutral.hip+reach*0.20,activation:0.38};
    m.command[i].knee={target:neutral.knee+(reach>0?-0.08:0.18),activation:0.42};
    m.command[i].ankle={target:neutral.ankle-reach*0.10,activation:0.30};
    m.command[i].roll={target:sideNoise*0.06,activation:0.18};

    if(leg.grip){
      // A gripped foot becomes an anchor. Flexing hip+knee pulls the shell toward it.
      m.command[i].hip.target=-0.30;
      m.command[i].knee.target=0.52;
      m.command[i].hip.activation=0.62;
      m.command[i].knee.activation=0.68;
      m.command[i].ankle.activation=0.42;
    }
  }
}

function standingCommands(o,dt){
  const m=o.mind,d=m.development;
  const t=o.age*0.55;
  for(let i=0;i<4;i++){
    const sway=Math.sin(t+i*Math.PI*0.5);
    m.command[i].spread={target:sway*0.06,activation:0.36};
    m.command[i].hip={target:-0.10+sway*0.08,activation:0.48};
    m.command[i].knee={target:0.16+Math.abs(sway)*0.10,activation:0.55};
    m.command[i].ankle={target:0.05-sway*0.05,activation:0.40};
    m.command[i].roll={target:-sway*0.04,activation:0.28};
  }
}

function stepCommands(o,dt){
  const m=o.mind,d=m.development;
  const t=o.age*(0.80+0.45*d.walkingSkill);
  for(let i=0;i<4;i++){
    // Diagonal pairs, but still deliberately imperfect and blended with learned policy later.
    const phase=t+((i===0||i===3)?0:Math.PI);
    const lift=Math.max(0,Math.sin(phase));
    const push=Math.sin(phase);
    m.command[i].spread={target:Math.sin(phase*0.5+i)*0.05,activation:0.42};
    m.command[i].hip={target:-0.08+push*0.18,activation:0.54};
    m.command[i].knee={target:0.14+lift*0.30,activation:0.60};
    m.command[i].ankle={target:0.05-push*0.08,activation:0.46};
    m.command[i].roll={target:0,activation:0.30};
  }
}

function developmentalMotorPlan(o,dt){
  const d=o.mind.development;
  if(d.phase==="newborn flop"){weakBodyBabble(o,dt);return}
  if(d.phase==="reach + crawl" || d.phase==="supported crawl"){crawlingCommands(o,dt);return}
  if(d.phase==="stand practice"){standingCommands(o,dt);return}
  stepCommands(o,dt)
}

function updateGripMind(app,o,dt){
  const m=o.mind,d=m.development;
  updateGrips(app.P,o,dt);
  if(m.sleep.sleeping)return;

  for(const leg of o.legs){
    // Release after a pull or if the leg is stretched into an awkward posture.
    if(leg.grip){
      const hold=leg.grip.age;
      if(hold>0.65+0.9*d.gripSkill && Math.random()<dt*(0.75-d.gripSkill*0.35)){
        releaseGrip(app.P,leg);
      }
      continue;
    }

    // Newborns mostly paw at the ground. Crawlers learn that anchoring a foot can move the body.
    if(d.phase==="newborn flop"){
      if(leg.contact && Math.random()<dt*0.10)createGroundGrip(app.P,o,leg);
      continue;
    }

    // Ground grip for crawling.
    if(leg.contact && Math.random()<dt*(0.22+0.60*d.gripSkill)){
      if(createGroundGrip(app.P,o,leg)){
        d.lastGripTime=app.simTime;
        if(Math.random()<0.12)showBubble(o,"Hold... pull...",1.8);
      }
      continue;
    }

    // Raised surface gripping for climbing/pulling.
    if(leg.gripCandidate){
      const candidate=leg.gripCandidate.object;
      const relevant=(m.target===candidate)||d.phase==="supported crawl"||d.phase==="reach + crawl";
      if(relevant && Math.random()<dt*(0.16+0.52*d.gripSkill+m.personality.curiosity*0.18)){
        if(createGrip(app.P,o,leg,candidate)){
          d.lastGripTime=app.simTime;
          m.thought=`Holding onto ${candidate.type} and trying to pull.`;
        }
      }
    }
  }
}

function blendLearning(o,dt){
  const m=o.mind,d=m.development;
  // Learned policy is only a small modifier early. It gains authority as the animal matures.
  const authority=clamp((averageStrength(o)-0.26)/0.48,0,0.55);
  if(authority<=0)return;
  smoothPolicy(m,dt);
  for(let i=0;i<4;i++){
    const leg=o.legs[i],ph=(m.phase[i]+=dt*m.policy.freq*Math.PI*2)+m.policy.phase[i];
    for(const j of JOINTS){
      const a=leg.angles[j]||0,e=m.model[i][j];
      const f=[1,Math.sin(ph),Math.cos(ph),leg.contact?1:0,a,leg.load||0,e.forward,e.lift];
      const out=policyOut(m.policy.legs[i][j],f,m.policy.gain);
      const ranges={spread:0.09,hip:0.13,knee:0.16,ankle:0.10,roll:0.07};
      m.command[i][j].target+=out*ranges[j]*authority;
      m.command[i][j].activation=clamp(m.command[i][j].activation+Math.abs(out)*0.22*authority,0,1);
    }
  }
}


export function updateMind(app,o,dt){
  const m=o.mind;
  m.energy=clamp(m.energy-(m.sleep.sleeping?0:dt*(0.0008+m.activity*0.0010)));
  m.hunger=clamp(m.hunger+dt*0.0018);
  social(app,o,dt);sleep(app,o,dt);

  if(m.sleep.sleeping){
    for(const leg of o.legs)releaseGrip(app.P,leg);
    const rest={spread:0,hip:-0.04,knee:0.42,ankle:0.04,roll:0};
    for(let i=0;i<4;i++)for(const j of JOINTS)m.command[i][j]={target:rest[j],activation:0.025};
    m.thought="Sleeping and recovering muscle fatigue.";
    for(const leg of o.legs)for(const j of JOINTS)leg.muscle[j].fatigue=clamp(leg.muscle[j].fatigue-dt*0.10,0,1);
    return m.command
  }

  const dev=updateDevelopment(o,dt);
  developmentalMotorPlan(o,dt);
  updateGripMind(app,o,dt);

  // Only mature animals add learned policy modulation.
  if(m.stage>=2)blendLearning(o,dt);

  m.decisionTimer-=dt;
  if(m.decisionTimer<=0){
    m.decisionTimer=3.0+rand(0,3.0)+m.personality.patience*1.5;
    chooseTarget(app,o);
  }

  if(m.target&&m.target.active){
    const p=bodyPosition(o),q=m.target.body.translation();
    m.desiredHeading=Math.atan2(q.x-p.x,q.z-p.z);
  }

  learnBody(o,dt);
  evaluate(o,app);

  if(dev.str<0.24)m.thought="My muscles are weak. I am just figuring out what moves.";
  else if(m.development.phase.includes("crawl"))m.thought="I am trying to grip, pull, and crawl.";
  else if(m.development.phase==="stand practice")m.thought="I am trying to hold myself up.";
  else if(m.development.phase==="first steps")m.thought="I am trying small steps.";
  else m.thought="I am practicing walking.";

  return m.command
}

export function cleanupMind(app,o){
  if(!o.mind?.bubble)return;app.scene.remove(o.mind.bubble.sprite);o.mind.bubble.tex.dispose();o.mind.bubble.sprite.material.dispose()
}
