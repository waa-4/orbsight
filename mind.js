import * as THREE from "three";
import {nearby} from "./world.js";
import {bodyPosition,bodyVelocity,createGrip,releaseGrip,updateGrips} from "./physics.js";

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
    sleep:{sleeping:false,time:0,lastGain:"—",cooldown:0},calibration:{done:false,phase:"settling"}
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


function bridgeCalibration(o,dt){
  const m=o.mind,c=m.calibration;
  const t=Math.max(0,o.age-2);
  c.phase="mind-body calibration";
  c.testLeg=Math.floor(t/1.2)%4;
  const jointIndex=Math.floor((t%1.2)/0.24)%5;
  c.testJoint=JOINTS[jointIndex];
  const neutral={spread:0,hip:-0.10,knee:0.14,ankle:0.06,roll:0};

  for(let i=0;i<4;i++)for(const j of JOINTS){
    m.command[i][j]={target:neutral[j],activation:0.42};
  }

  const i=c.testLeg,j=c.testJoint,phase=(t%0.24)/0.24;
  const amp={spread:0.24,hip:0.34,knee:0.46,ankle:0.28,roll:0.20}[j];
  const sign=((Math.floor(t/0.24)&1)===0)?1:-1;
  m.command[i][j]={target:neutral[j]+sign*amp*(0.55+0.45*Math.sin(phase*Math.PI)),activation:1};

  // Measure whether the body actually obeyed the previous command.
  const now=o.legs[i].angles[j]||0;
  const prev=o.bridge.measured[i][j]||0;
  const moved=Math.abs(now-prev);
  o.bridge.measured[i][j]=now;

  // Self-tune muscle strength if a joint looks unresponsive.
  if(moved<0.00018){
    o.bridge.gains[i][j]=clamp(o.bridge.gains[i][j]+dt*0.55,1,3.2);
  }else{
    o.bridge.gains[i][j]=THREE.MathUtils.lerp(o.bridge.gains[i][j],1.15,dt*0.35);
  }
  const allGains=o.bridge.gains.flatMap(x=>JOINTS.map(jn=>x[jn]));
  const maxGain=Math.max(...allGains);
  o.bridge.health=maxGain>2.6?"boosting weak muscles":maxGain>1.45?"calibrating":"connected";
  m.thought=`Connecting brain to leg ${i+1} ${j}.`;
  return m.command
}

function updateGripMind(app,o,dt){
  const m=o.mind;
  updateGrips(app.P,o,dt);

  // Release grip if the mind wants to step away or if this leg has returned to ground support.
  for(const leg of o.legs){
    if(leg.grip && (leg.contact || (m.target && m.target!==leg.grip.target && Math.random()<dt*0.4))){
      releaseGrip(app.P,leg);
    }
  }

  // Gripping is a learned/recovery action, not automatic glue.
  if(o.age<8 || m.sleep.sleeping)return;

  const falling=o.shell.linvel().y<-0.45 || o.upright<0.35;
  for(const leg of o.legs){
    if(leg.grip || !leg.gripCandidate)continue;
    const candidate=leg.gripCandidate.object;
    const targetIsInteresting=(m.target===candidate);
    const explore=m.stage>=2 && Math.random()<dt*(0.20+0.35*m.personality.curiosity);
    if(falling || targetIsInteresting || explore){
      if(createGrip(app.P,o,leg,candidate)){
        m.thought=`Gripping ${candidate.type} with leg ${leg.index+1}.`;
        if(Math.random()<0.35)showBubble(o,"Got a grip.",2.0);
      }
    }
  }
}

function activeBodyExperiment(o,dt){
  // Once connected, produce continual self-generated joint experiments.
  // This is not a predefined gait: every leg/joint has its own oscillator phase,
  // learned policy output, contact input, and body-model feedback.
  const m=o.mind;
  if(o.age<8 || m.sleep.sleeping)return;
  const speed=0.55+0.55*m.policy.freq;
  for(let i=0;i<4;i++){
    const leg=o.legs[i];
    const ph=m.phase[i]+o.age*speed+(i*1.37);
    // Add small exploration that disappears as useful policies improve.
    const exploreScale=m.stage<3?0.22:0.10;
    m.command[i].hip.target+=Math.sin(ph*1.13)*exploreScale;
    m.command[i].knee.target+=Math.sin(ph*1.41+0.8)*exploreScale*1.35;
    m.command[i].ankle.target+=Math.sin(ph*1.73+1.6)*exploreScale*0.75;
    m.command[i].spread.target+=Math.sin(ph*0.91+i)*exploreScale*0.55;
    if(leg.grip){
      // Pull against a grip by flexing the gripping leg while extending a supporting leg.
      m.command[i].hip.target-=0.16;
      m.command[i].knee.target+=0.18;
      m.command[i].hip.activation=1;
      m.command[i].knee.activation=1;
    }
  }
}

export function updateMind(app,o,dt){
  const m=o.mind;m.energy=clamp(m.energy-(m.sleep.sleeping?0:dt*(0.0012+m.activity*0.0015)));m.hunger=clamp(m.hunger+dt*0.0025);
  social(app,o,dt);sleep(app,o,dt);

  if(o.settling){
    m.calibration.phase="settling";
    m.thought="Standing up and letting my new joints settle.";
    const neutral={spread:0,hip:-0.10,knee:0.14,ankle:0.06,roll:0};
    for(let i=0;i<4;i++)for(const j of JOINTS)m.command[i][j]={target:neutral[j],activation:0.72};
    return m.command
  }
  if(o.age<8){
    return bridgeCalibration(o,dt);
  }else if(!m.calibration.done){
    m.calibration.done=true;m.calibration.phase="learning";o.bridge.health="connected";
    m.thought="My mind is connected to my body. Now I can experiment.";
    showBubble(o,"Okay, my legs move. Time to experiment.",3.2);
  }
  if(m.sleep.sleeping){for(const leg of o.legs)releaseGrip(app.P,leg);
    const neutral={spread:0,hip:-0.10,knee:0.20,ankle:0.06,roll:0};
    for(let i=0;i<4;i++)for(const j of JOINTS)m.command[i][j]={target:neutral[j],activation:0.08};
    return m.command
  }

  m.decisionTimer-=dt;if(m.decisionTimer<=0){m.decisionTimer=2.4+rand(0,2.8)+m.personality.patience*2;chooseTarget(app,o)}
  if(m.target&&m.target.active){const p=bodyPosition(o),q=m.target.body.translation();m.desiredHeading=Math.atan2(q.x-p.x,q.z-p.z)}
  learnBody(o,dt);updatePolicy(o,dt);activeBodyExperiment(o,dt);updateGripMind(app,o,dt);evaluate(o,app);
  return m.command
}
export function cleanupMind(app,o){
  if(!o.mind?.bubble)return;app.scene.remove(o.mind.bubble.sprite);o.mind.bubble.tex.dispose();o.mind.bubble.sprite.material.dispose()
}
