import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {createPhysics,createOrbsightBody,updateBodySensors,driveBody,settleBody,syncBody,animateEye,destroyBody,bodyPosition} from "./physics.js";
import {setupWorld,addObject,resetMap,updateWorld} from "./world.js";
import {attachMind,updateMind,cleanupMind} from "./mind.js";

const BUILD="0.15-developmental-locomotion-2026-09-18";
const $=id=>document.getElementById(id);
$("status").textContent="loading Rapier physics…";

const canvas=$("c"),renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(2,devicePixelRatio));renderer.shadowMap.enabled=true;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1016);scene.fog=new THREE.Fog(0x0b1016,38,92);
const camera=new THREE.PerspectiveCamera(55,1,0.05,130);camera.position.set(8,7,11);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.maxDistance=52;controls.target.set(0,0.8,0);
scene.add(new THREE.HemisphereLight(0xbfd8ff,0x273020,1.25));
const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(12,18,8);sun.castShadow=true;scene.add(sun);

const P=await createPhysics();
const app={scene,camera,renderer,controls,sun,P,objects:[],orbs:[],selected:null,nextOrbId:1,nextObjectId:1,simTime:0,timeScale:1,paused:false,follow:true,freeKeys:new Set()};
setupWorld(app);

function resize(){const r=canvas.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
function addOrb(x=(Math.random()-0.5)*4,z=(Math.random()-0.5)*4){if(app.orbs.length>=20)return;const o=createOrbsightBody(P,scene,app.nextOrbId++,x,z);attachMind(app,o);app.orbs.push(o);if(!app.selected)app.selected=o;refreshList();return o}
function removeSelected(){const o=app.selected;if(!o)return;cleanupMind(app,o);destroyBody(P,scene,o);const i=app.orbs.indexOf(o);if(i>=0)app.orbs.splice(i,1);app.selected=app.orbs[0]||null;refreshList()}
function removeAll(){for(const o of [...app.orbs]){cleanupMind(app,o);destroyBody(P,scene,o)}app.orbs.length=0;app.selected=null}
function reset(){removeAll();resetMap(app);addOrb(0,0);addOrb(1.5,0.4);addOrb(-1.3,0.6);app.selected=app.orbs[0];refreshList()}
function refreshList(){
  $("popCount").textContent=`(${app.orbs.length}/20)`;$("orbList").innerHTML="";
  for(const o of app.orbs){const d=document.createElement("div");d.className="orbrow"+(o===app.selected?" selected":"");const s=document.createElement("span");s.textContent=`${o.mind.name} • G${o.mind.generation}`;const b=document.createElement("button");b.textContent="Select";b.onclick=()=>{app.selected=o;refreshList()};d.append(s,b);$("orbList").append(d)}
}
function refreshUI(){
  const o=app.selected;if(!o)return;const m=o.mind;
  $("nameT").textContent=m.name;$("thoughtT").textContent=m.thought;$("stageT").textContent=m.stageName;$("energyT").textContent=Math.round(m.energy*100)+"%";$("uprightT").textContent=Math.round((o.upright*0.5+0.5)*100)+"%";$("contactsT").textContent=o.contacts+"/4";$("genT").textContent=m.generation;$("rewardT").textContent=m.dense.toFixed(3);$("fragmentsT").textContent=m.fragments.length;$("settleT").textContent=m.development.phase;$("sleepT").textContent=m.sleep.sleeping?"sleeping":"awake";
  $("jointT").innerHTML=o.legs.map(l=>`L${l.index+1}: spread ${l.angles.spread.toFixed(2)} • hip ${l.angles.hip.toFixed(2)} • knee ${l.angles.knee.toFixed(2)} • ankle ${l.angles.ankle.toFixed(2)}`).join("<br>");
  const gripCount=o.legs.filter(l=>l.grip).length;
  const muscles=o.legs.flatMap(l=>["spread","hip","knee","ankle","roll"].map(j=>l.muscle[j]));
  const avgStrength=muscles.reduce((a,b)=>a+b.strength,0)/muscles.length;
  const avgFatigue=muscles.reduce((a,b)=>a+b.fatigue,0)/muscles.length;
  $("events").textContent=`Phase: ${m.development.phase} • muscle ${(avgStrength*100).toFixed(0)}% • fatigue ${(avgFatigue*100).toFixed(0)}% • grip skill ${(m.development.gripSkill*100).toFixed(0)}% • grips ${gripCount}/4 • ${o.runtimeError?"ERROR: "+o.runtimeError.slice(0,100):"runtime OK"}`;
  $("objCount").textContent=`${app.objects.length} objects`;$("buildT").textContent=`${BUILD} • ${app.timeScale}×`;
}
$("pause").onclick=e=>{app.paused=!app.paused;e.currentTarget.textContent=app.paused?"Resume":"Pause"};
$("timeScale").onchange=e=>app.timeScale=Math.max(0.5,Math.min(15,Number(e.target.value)||1));
$("addOrb").onclick=()=>addOrb();$("removeOrb").onclick=removeSelected;$("reset").onclick=reset;
$("freecam").onclick=e=>{app.follow=!app.follow;e.currentTarget.textContent=app.follow?"Freecam":"Follow selected"};
$("addObject").onclick=()=>addObject(app,$("objectType").value,Number($("objX").value)||0,Number($("objZ").value)||0,1);
$("randomObject").onclick=()=>addObject(app,$("objectType").value,(Math.random()-0.5)*55,(Math.random()-0.5)*55,1);
window.addEventListener("keydown",e=>{if(["KeyW","KeyA","KeyS","KeyD","KeyQ","KeyE"].includes(e.code))app.freeKeys.add(e.code);if(e.code==="KeyF"){app.follow=!app.follow;$("freecam").textContent=app.follow?"Freecam":"Follow selected"}});
window.addEventListener("keyup",e=>app.freeKeys.delete(e.code));
function updateFreecam(dt){if(app.follow)return;const speed=7*dt,f=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),r=new THREE.Vector3(),m=new THREE.Vector3();camera.getWorldDirection(f);f.y=0;if(f.lengthSq())f.normalize();r.crossVectors(f,up).normalize();if(app.freeKeys.has("KeyW"))m.add(f);if(app.freeKeys.has("KeyS"))m.sub(f);if(app.freeKeys.has("KeyD"))m.add(r);if(app.freeKeys.has("KeyA"))m.sub(r);if(app.freeKeys.has("KeyE"))m.y+=1;if(app.freeKeys.has("KeyQ"))m.y-=1;if(m.lengthSq()){m.normalize().multiplyScalar(speed);camera.position.add(m);controls.target.add(m)}}

reset();$("status").textContent="v0.15 developmental locomotion running";
const clock=new THREE.Clock(),FIXED=1/180;let acc=0,uiTimer=0;
function frame(){
  requestAnimationFrame(frame);const realDt=Math.min(0.05,clock.getDelta());resize();
  for(const o of app.orbs){try{animateEye(o,performance.now()/1000)}catch(e){console.warn("eye",e)}}
  if(!app.paused){
    acc+=realDt*app.timeScale;let steps=0;
    while(acc>=FIXED&&steps<150){
      app.simTime+=FIXED;
      for(const o of app.orbs){
        try{
          o.age+=FIXED;o.settling=false;
          updateBodySensors(o,app.objects);
          const cmd=updateMind(app,o,FIXED);
          o.mind.activity=driveBody(P,o,cmd,FIXED);
          o.runtimeError="";
        }catch(e){
          o.runtimeError=String(e?.stack||e);
          console.error("Orbsight step error",e);
        }
      }
      try{P.world.step()}catch(e){console.error("Rapier world step",e);$("err").hidden=false;$("err").textContent="Rapier step error:\n"+String(e?.stack||e)}
      updateWorld(app);
      acc-=FIXED;steps++;
    }
    if(steps>=150)acc=0;
    for(const o of app.orbs){try{syncBody(o)}catch(e){console.error("syncBody",e)}}
  }
  uiTimer-=realDt;if(uiTimer<=0){refreshUI();refreshList();uiTimer=0.3}
  updateFreecam(realDt);
  if(app.follow&&app.selected){const p=bodyPosition(app.selected),des=new THREE.Vector3(p.x+7,p.y+5.2,p.z+8.2);camera.position.lerp(des,0.018);controls.target.lerp(new THREE.Vector3(p.x,p.y,p.z),0.04)}
  controls.update();renderer.render(scene,camera)
}
frame();
