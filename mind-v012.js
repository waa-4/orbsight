import * as THREE from "three";
import {tryGrip,releaseGrip,updateGrips} from "./physics-v011.js";
import {nearby} from "./world-v011.js";

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const JOINTS=["abduct","hip","knee","ankle","roll"];
const FEATURES=8;
const CHAT=[
 "Hello.","I am still learning my legs.","I think I moved!","Where are you going?","I keep falling over.",
 "This place is large.","I found something.","I almost stayed upright.","My feet are busy.","I want to climb that.",
 "I remember this area.","That block moved.","I need a rest.","I am practicing.","One leg at a time.",
 "I think this movement works.","Do you know this place?","Wait for me.","Ball!","That looked difficult."
];
const REPLIES=["Okay.","I see.","Maybe.","Same here.","Interesting.","I will try.","Be careful.","Where?","Good luck.","I noticed that too."];

function weights(scale=0.3){return Array.from({length:FEATURES},()=>rand(-scale,scale))}
function seedPolicy(){return{freq:rand(0.45,0.9),gain:rand(0.38,0.62),phase:[0,Math.PI,Math.PI,0],legs:Array.from({length:4},()=>Object.fromEntries(JOINTS.map(j=>[j,weights(j==="hip" ? 0.30 : 0.24)])))}}
function clone(x){return JSON.parse(JSON.stringify(x))}
function mutate(p,amt=0.08){
  const n=clone(p);const edits=1+Math.floor(Math.random()*3);
  for(let e=0;e<edits;e++){const li=Math.floor(Math.random()*4),j=JOINTS[Math.floor(Math.random()*JOINTS.length)],w=n.legs[li][j];for(let q=0;q<2;q++){const k=Math.floor(Math.random()*w.length);w[k]=clamp(w[k]+rand(-amt,amt),-2.5,2.5)}}
  if(Math.random()<0.2)n.freq=clamp(n.freq+rand(-amt,amt)*0.25,0.3,1.25);return n
}
function policyOut(w,f,g){let s=0;for(let i=0;i<w.length;i++)s+=w[i]*f[i];return Math.tanh(s)*g}

function bubbleSprite(app){
  const c=document.createElement("canvas");c.width=512;c.height=180;const tex=new THREE.CanvasTexture(c),mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false}),sprite=new THREE.Sprite(mat);
  sprite.scale.set(3.5,1.25,1);sprite.visible=false;sprite.renderOrder=50;app.scene.add(sprite);return{c,ctx:c.getContext("2d"),tex,sprite,timer:0,pending:null,pendingTimer:0}
}
function showBubble(o,text,dur=3){
  const b=o.mind.bubble,ctx=b.ctx;ctx.clearRect(0,0,512,180);ctx.fillStyle="rgba(250,250,247,0.96)";ctx.strokeStyle="#20252c";ctx.lineWidth=6;ctx.beginPath();ctx.roundRect(10,10,492,140,24);ctx.fill();ctx.stroke();ctx.fillStyle="#15181d";ctx.font="600 27px system-ui";ctx.textAlign="center";
  const words=String(text).split(/\s+/),lines=[];let line="";for(const w of words){const t=line?line+" "+w:w;if(ctx.measureText(t).width>440&&line){lines.push(line);line=w}else line=t}if(line)lines.push(line);lines.slice(0,3).forEach((l,i)=>ctx.fillText(l,256,65+i*34));
  b.tex.needsUpdate=true;b.sprite.visible=true;b.timer=dur
}
export function attachMind(app,o){
  const p=seedPolicy();
  o.mind={
    name:`Orbsight ${o.id}`,energy:1,hunger:0,thought:"Looking around.",desiredHeading:0,
    personality:{curiosity:rand(0.25,0.95),patience:rand(0.15,0.9),playfulness:rand(0.1,0.95),sociability:rand(0.1,0.95)},
    policy:p,targetPolicy:clone(p),best:clone(p),bestScore:-999,generation:1,trialTime:0,trialX:o.shell.position.x,trialZ:o.shell.position.z,
    dense:0,denseAccum:0,activity:0,fragments:[],stage:0,stageName:"body discovery",
    evidence:{stable:0,crawl:0,transfer:0,step:0,walk:0},phase:[0,0,0,0],
    model:Array.from({length:4},()=>Object.fromEntries(JOINTS.map(j=>[j,{forward:0,lift:0,support:0,samples:0}]))),
    prevPos:o.shell.position.clone(),prevUpright:1,prevContacts:0,prevAngles:Array.from({length:4},()=>({abduct:0,hip:0,knee:0,ankle:0,roll:0})),
    babble:{timer:0,leg:0,joint:"knee",value:0,target:0},exploreTimer:0,stagnant:0,lastImprove:0,
    command:Array.from({length:4},()=>Object.fromEntries(JOINTS.map(j=>[j,{target:0,activation:0.1}]))),
    bubble:bubbleSprite(app),thoughtTimer:rand(5,11),chatTimer:rand(7,15),decisionTimer:0,
    sleep:{sleeping:false,time:0,lastGain:"—",cooldown:0},
    posture:{
      state:"normal",curlScore:0,curlTime:0,recoveryTime:0,episodes:0,
      aversion:0.35,lastEpisode:-999,uncurlSuccess:0,stanceTime:0,
      perLeg:Array.from({length:4},()=>({curl:0,time:0}))
    }
  }
}
function smoothPolicy(m,dt){
  const a=1-Math.exp(-dt*1.1),p=m.policy,t=m.targetPolicy;p.freq=THREE.MathUtils.lerp(p.freq,t.freq,a);p.gain=THREE.MathUtils.lerp(p.gain,t.gain,a);
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
  m.chatTimer-=dt;if(m.chatTimer<=0&&!m.sleep.sleeping){m.chatTimer=rand(9,19);if(Math.random()<m.personality.sociability*0.7){let other=null,bd=4;for(const q of app.orbs){if(q===o||q.mind.sleep.sleeping)continue;const d=Math.hypot(q.shell.position.x-o.shell.position.x,q.shell.position.z-o.shell.position.z);if(d<bd){bd=d;other=q}}if(other){showBubble(o,CHAT[Math.floor(Math.random()*CHAT.length)]);other.mind.bubble.pending=REPLIES[Math.floor(Math.random()*REPLIES.length)];other.mind.bubble.pendingTimer=rand(0.8,1.6)}}}
  b.sprite.position.set(o.shell.position.x,o.shell.position.y+1.28,o.shell.position.z)
}
function sleep(app,o,dt){
  const m=o.mind;m.sleep.cooldown=Math.max(0,m.sleep.cooldown-dt);const b=nearby(app,o,"bed",1.5);
  if(!m.sleep.sleeping&&m.energy<0.28&&m.sleep.cooldown<=0&&b){m.sleep.sleeping=true;m.sleep.time=0;m.thought="Sleeping.";showBubble(o,"zzz...",4);for(const leg of o.legs)releaseGrip(app.P,leg)}
  if(m.sleep.sleeping){m.sleep.time+=dt;m.energy=clamp(m.energy+dt*0.06);if(m.energy>0.97||m.sleep.time>14){m.sleep.sleeping=false;m.sleep.cooldown=8;m.energy=Math.max(m.energy,0.94);m.sleep.lastGain=m.stageName;for(const leg of o.legs)leg.muscle.knee=clamp(leg.muscle.knee+0.004,0.5,1.6);showBubble(o,`I feel a little better at ${m.stageName}.`,3.5)}}
}

function legCurlScore(o,leg){
  const knee=(leg.angles && leg.angles.knee!==undefined)?leg.angles.knee:0;
  const hip=(leg.angles && leg.angles.hip!==undefined)?leg.angles.hip:0;
  const ankle=(leg.angles && leg.angles.ankle!==undefined)?leg.angles.ankle:0;
  const dx=leg.foot.position.x-o.shell.position.x;
  const dy=leg.foot.position.y-o.shell.position.y;
  const dz=leg.foot.position.z-o.shell.position.z;
  const shellDist=Math.hypot(dx,dy,dz);
  const sideDist=Math.abs(dx);
  const close=clamp((0.82-shellDist)/0.30,0,1);
  const tuckedSide=clamp((0.50-sideDist)/0.28,0,1);
  const deepKnee=clamp((knee-0.62)/0.34,0,1);
  const badHip=clamp((hip-0.35)/0.35,0,1);
  const badAnkle=clamp((Math.abs(ankle)-0.34)/0.20,0,1);
  return clamp(close*0.38+tuckedSide*0.27+deepKnee*0.24+badHip*0.07+badAnkle*0.04,0,1);
}
function updatePostureBrain(o,dt){
  const m=o.mind,p=m.posture;
  let total=0,maxCurl=0;
  for(let i=0;i<o.legs.length;i++){
    const c=legCurlScore(o,o.legs[i]);
    p.perLeg[i].curl=c;
    if(c>0.46)p.perLeg[i].time+=dt;else p.perLeg[i].time=Math.max(0,p.perLeg[i].time-dt*1.7);
    total+=c;maxCurl=Math.max(maxCurl,c);
  }
  p.curlScore=total/o.legs.length;

  const severe=maxCurl>0.72 || p.curlScore>0.50;
  const moderate=maxCurl>0.52 || p.curlScore>0.34;
  if(moderate)p.curlTime+=dt;else p.curlTime=Math.max(0,p.curlTime-dt*2.2);

  if(p.state==="normal" && (severe || p.curlTime>0.35)){
    p.state="uncurl";
    p.recoveryTime=0;
    p.episodes++;
    p.lastEpisode=performance.now()/1000;
    p.aversion=clamp(p.aversion+0.04,0.35,1);
    m.thought="My legs are curling in. I need to open my stance.";
    showBubble(o,"Legs curling — opening stance.",2.8);
  }

  if(p.state==="uncurl"){
    p.recoveryTime+=dt;
    // No exploring or climbing while the mind is deliberately recovering posture.
    m.babble.target=0;
    if(p.curlScore<0.18 && maxCurl<0.30){
      p.state="stance";
      p.recoveryTime=0;
      p.uncurlSuccess++;
      p.aversion=clamp(p.aversion+0.018,0.35,1);
      m.thought="My legs are clear again. Hold the stance.";
      showBubble(o,"Okay. Legs clear.",2.2);
    }
  }else if(p.state==="stance"){
    p.recoveryTime+=dt;
    p.stanceTime+=dt;
    if(moderate){
      p.state="uncurl";p.recoveryTime=0;
    }else if(p.recoveryTime>1.35){
      p.state="normal";p.recoveryTime=0;
      m.thought="Posture stable. Resume learning.";
    }
  }else if(!moderate){
    p.stanceTime+=dt;
    p.aversion=clamp(p.aversion-dt*0.0004,0.35,1);
  }
}
function applyPostureOverride(o){
  const m=o.mind,p=m.posture;
  for(let i=0;i<o.legs.length;i++){
    const leg=o.legs[i],c=p.perLeg[i].curl;
    if(p.state==="uncurl" || c>0.44){
      // This is an explicit brain-level anti-curl decision.
      // It does not teleport any rigid body; it commands the same muscles the learner uses.
      const strength=clamp((c-0.28)/0.55,0.35,1);
      const stance={
        abduct:leg.side*0.27,
        hip:-0.18,
        knee:0.22,
        ankle:0.08,
        roll:0
      };
      for(const j of JOINTS){
        const current=m.command[i][j]||{target:stance[j],activation:0.2};
        current.target=THREE.MathUtils.lerp(current.target,stance[j],strength*(p.state==="uncurl"?0.92:0.62));
        current.activation=Math.max(current.activation,0.62+strength*0.28);
        m.command[i][j]=current;
      }
    }else if(p.state==="stance"){
      const stance={abduct:leg.side*0.24,hip:-0.10,knee:0.30,ankle:0.07,roll:0};
      for(const j of JOINTS){
        const current=m.command[i][j];
        if(current)current.target=THREE.MathUtils.lerp(current.target,stance[j],0.16);
      }
    }
  }
}
function posturePenalty(o){
  const p=o.mind.posture;
  let severe=0;
  for(const x of p.perLeg)severe+=x.curl*x.curl;
  return (severe/o.legs.length)*(0.06+0.16*p.aversion);
}

function learnBody(o,dt){
  const m=o.mind,p=o.shell.position,dx=p.x-m.prevPos.x,dy=p.y-m.prevPos.y,dz=p.z-m.prevPos.z;
  const forward=dx*Math.sin(m.desiredHeading)+dz*Math.cos(m.desiredHeading),h=Math.hypot(dx,dz);
  let r=Math.max(0,forward)*14+h*3.1+Math.max(0,dy)*3.0+(o.contacts>=2 ? 0.004 : 0);
  // Curling is now treated as a failed motor strategy, not merely a small physics penalty.
  r-=posturePenalty(o);
  if(o.mind.posture.state==="uncurl")r-=0.018;
  if(o.mind.posture.state==="stance" && o.mind.posture.curlScore<0.18)r+=0.006;
  if(o.foldRisk>0.12)r-=0.014;m.dense=r;m.denseAccum+=r;
  for(let i=0;i<4;i++){const leg=o.legs[i];for(const j of JOINTS){const now=(leg.angles && leg.angles[j] !== undefined ? leg.angles[j] : 0),prev=m.prevAngles[i][j],da=now-prev;if(Math.abs(da)>0.0015){const e=m.model[i][j],sg=Math.sign(da),k=0.025;e.forward=THREE.MathUtils.lerp(e.forward,clamp(forward*sg/dt,-1,1),k);e.lift=THREE.MathUtils.lerp(e.lift,clamp(dy*sg/dt,-1,1),k);e.support=THREE.MathUtils.lerp(e.support,(leg.contact?1:0)*sg,k);e.samples++}m.prevAngles[i][j]=now}}
  const ev=m.evidence;if(o.upright>0.58&&o.contacts>=2)ev.stable+=dt;if(h>0.0004&&o.contacts>=1)ev.crawl+=dt;if(o.contacts>=2&&h>0.00025)ev.transfer+=dt;if(h>0.0005)ev.step+=dt;if(h>0.0008&&o.upright>0.48)ev.walk+=dt;
  if(m.stage===0&&sampleCount(m)>80)m.stage=1;if(m.stage===1&&(ev.stable>3||ev.crawl>4))m.stage=2;if(m.stage===2&&ev.crawl>9)m.stage=3;if(m.stage===3&&ev.transfer>8)m.stage=4;if(m.stage===4&&ev.step>10)m.stage=5;if(m.stage===5&&ev.walk>16)m.stage=6;m.stageName=stageName(m.stage);
  m.prevPos.copy(p);m.prevUpright=o.upright;m.prevContacts=o.contacts
}
function sampleCount(m){let n=0;for(const l of m.model)for(const j of JOINTS)n+=l[j].samples;return n}
function updatePolicy(o,dt){
  const m=o.mind;smoothPolicy(m,dt);
  m.babble.timer-=dt;if(m.babble.timer<=0){m.babble.timer=m.stage===0?rand(0.5,1):rand(1.4,2.6);m.babble.leg=Math.floor(Math.random()*4);m.babble.joint=JOINTS[Math.floor(Math.random()*JOINTS.length)];m.babble.target=rand(-1,1)}
  m.babble.value=THREE.MathUtils.lerp(m.babble.value,m.babble.target,1-Math.exp(-dt*1.8));
  let activity=0;
  for(let i=0;i<4;i++){const leg=o.legs[i],ph=(m.phase[i]+=dt*m.policy.freq*Math.PI*2)+m.policy.phase[i];for(const j of JOINTS){const a=(leg.angles && leg.angles[j] !== undefined ? leg.angles[j] : 0),e=m.model[i][j],f=[1,Math.sin(ph),Math.cos(ph),leg.contact?1:0,a,(leg.load||0),e.forward,e.lift];let out=policyOut(m.policy.legs[i][j],f,m.policy.gain);
    if(m.stage===0&&m.babble.leg===i&&m.babble.joint===j&&m.posture.state==="normal")out+=m.babble.value*0.48;
    // Learned anti-curl aversion: as a leg curls, damp commands that keep flexing it inward.
    const curl=m.posture.perLeg[i].curl;
    if(curl>0.30){
      if(j==="knee" && out>0)out*=Math.max(0.05,1-curl*m.posture.aversion*1.4);
      if(j==="hip" && out>0)out*=Math.max(0.12,1-curl*m.posture.aversion);
      if(j==="abduct" && Math.sign(out)!==leg.side)out*=Math.max(0.08,1-curl*m.posture.aversion*1.2);
    }
    out=clamp(out,-1,1);let target=a+out*(j==="knee" ? 0.18 : (j==="hip" ? 0.15 : 0.10));if(j==="abduct")target=THREE.MathUtils.lerp(target,leg.side*0.22,0.08);
    if(j==="hip")target=THREE.MathUtils.lerp(target,-0.06,0.04);
    if(j==="knee")target=THREE.MathUtils.lerp(target,leg.contact ? 0.30 : 0.42,0.07);
    if(j==="ankle")target=THREE.MathUtils.lerp(target,0.06,0.05);m.command[i][j]={target,activation:0.10+0.90*Math.abs(out)};activity+=Math.abs(out)}}
  m.activity=activity/20
}
function evaluate(o,app){
  const m=o.mind;if(app.simTime-m.trialTime<8)return;const dx=o.shell.position.x-m.trialX,dz=o.shell.position.z-m.trialZ,dist=Math.hypot(dx,dz),score=m.denseAccum*1.4+dist*(m.stage===2?1.4:0.65)+o.upright*0.4-o.foldRisk*0.8-m.posture.curlScore*(1.8+2.2*m.posture.aversion);
  const postureOK=m.posture.curlScore<0.26 && m.posture.state!=="uncurl";
  if(postureOK && score>m.bestScore+0.015){
    m.bestScore=score;m.best=clone(m.policy);m.lastImprove=app.simTime;
    m.fragments.unshift({score,leg:Math.floor(Math.random()*4),posture:m.posture.curlScore});m.fragments=m.fragments.slice(0,12)
  }else{
    // A curled controller is explicitly rejected even if it managed to move.
    m.targetPolicy=clone(m.best);
  }
  m.targetPolicy=mutate(m.targetPolicy,0.10-Math.min(0.06,m.generation*0.0008));m.generation++;m.denseAccum=0;m.trialTime=app.simTime;m.trialX=o.shell.position.x;m.trialZ=o.shell.position.z
}
export function updateMind(app,o,dt){
  const m=o.mind;m.energy=clamp(m.energy-(m.sleep.sleeping?0:dt*(0.0012+m.activity*0.0016)));m.hunger=clamp(m.hunger+dt*0.0025);
  social(app,o,dt);sleep(app,o,dt);updateGrips(app.P,o,dt);if(m.posture.state==="uncurl")for(const leg of o.legs)releaseGrip(app.P,leg);
  if(m.sleep.sleeping){for(let i=0;i<4;i++)for(const j of JOINTS)m.command[i][j]={target:(o.legs[i].angles && o.legs[i].angles[j] !== undefined ? o.legs[i].angles[j] : 0),activation:0.02};return m.command}
  m.decisionTimer-=dt;if(m.decisionTimer<=0){m.decisionTimer=2.4+rand(0,2.8)+m.personality.patience*2;chooseTarget(app,o)}
  if((m.target && m.target.active))m.desiredHeading=Math.atan2(m.target.body.position.x-o.shell.position.x,m.target.body.position.z-o.shell.position.z);
  updatePostureBrain(o,dt);learnBody(o,dt);updatePolicy(o,dt);applyPostureOverride(o);evaluate(o,app);

  // Opportunistic climbing grip: only if near a ledge and no joint is near a stop.
  for(const leg of o.legs){
    if(leg.grip||leg.contact||m.posture.state!=="normal"||m.posture.curlScore>0.24)continue;
    let best=null,bd=0.34;for(const it of app.objects){if(!["platform","wall","pushblock","log"].includes(it.type))continue;const d=Math.hypot(leg.foot.position.x-it.body.position.x,leg.foot.position.y-it.body.position.y,leg.foot.position.z-it.body.position.z)-(it.r||0.4);if(d<bd){bd=d;best=it}}
    if(best&&Math.random()<dt*0.8)tryGrip(app.P,o,leg,best)
  }
  return m.command
}
export function cleanupMind(app,o){
  if(!(o.mind && o.mind.bubble))return;app.scene.remove(o.mind.bubble.sprite);o.mind.bubble.tex.dispose();o.mind.bubble.sprite.material.dispose()
}
