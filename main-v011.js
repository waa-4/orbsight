import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {createPhysics,createOrbsightBody,updateBodySensors,driveBody,enforceAnatomy,syncBody,destroyBody} from "./physics-v011.js";
import {setupWorld,addObject,resetMap,updateWorld,clearObjects} from "./world-v011.js";
import {attachMind,updateMind,cleanupMind} from "./mind-v011.js";

const BUILD="0.11-leg-architecture-rebuild-2026-09-18";
const $=id=>document.getElementById(id);
$("status").textContent="v0.11 main.js loaded — initializing…";
window.addEventListener("error",e=>{if(window.__orbBootError)window.__orbBootError((e.error&&e.error.stack)||e.message||String(e.error||e))});
window.addEventListener("unhandledrejection",e=>{if(window.__orbBootError)window.__orbBootError((e.reason&&e.reason.stack)||String(e.reason))});
const canvas=$("c"),renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(2,devicePixelRatio));renderer.shadowMap.enabled=true;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1016);scene.fog=new THREE.Fog(0x0b1016,38,92);
const camera=new THREE.PerspectiveCamera(55,1,0.05,130);camera.position.set(8,7,11);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.maxDistance=52;controls.target.set(0,0.8,0);
scene.add(new THREE.HemisphereLight(0xbfd8ff,0x273020,1.25));
const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(12,18,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);

const P=createPhysics();
const app={scene,camera,renderer,controls,sun,P,GROUP:P.GROUP,objects:[],orbs:[],selected:null,nextOrbId:1,nextObjectId:1,simTime:0,timeScale:1,paused:false,follow:true,freeKeys:new Set()};
setupWorld(app);

function resize(){const r=canvas.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);if(canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
function addOrb(x=(Math.random()-0.5)*4,z=(Math.random()-0.5)*4){if(app.orbs.length>=20)return;const o=createOrbsightBody(P,scene,app.nextOrbId++,x,z);attachMind(app,o);app.orbs.push(o);if(!app.selected)app.selected=o;refreshList();return o}
function removeSelected(){
  const o=app.selected;if(!o)return;
  cleanupMind(app,o);destroyBody(P,scene,o);
  const i=app.orbs.indexOf(o);if(i>=0)app.orbs.splice(i,1);
  app.selected=app.orbs[0]||null;
  refreshList();refreshUI();
}
function removeAllOrbs(){for(const o of [...app.orbs]){cleanupMind(app,o);destroyBody(P,scene,o)}app.orbs.length=0;app.selected=null}
function reset(){removeAllOrbs();resetMap(app);addOrb(0,0);addOrb(1.5,0.4);addOrb(-1.3,0.6);app.selected=app.orbs[0];refreshList()}
function refreshList(){
  $("popCount").textContent=`(${app.orbs.length}/20)`;$("orbList").innerHTML="";
  for(const o of app.orbs){const d=document.createElement("div");d.className="orbrow"+(o===app.selected?" selected":"");const s=document.createElement("span");s.textContent=`${o.mind.name} • G${o.mind.generation}`;const b=document.createElement("button");b.textContent="Select";b.addEventListener("click",()=>{app.selected=o;refreshList()});d.append(s,b);$("orbList").append(d)}
}
function refreshUI(){
  const o=app.selected;if(!o)return;const m=o.mind;
  $("nameT").textContent=m.name;$("thoughtT").textContent=m.thought;$("stageT").textContent=m.stageName;$("energyT").textContent=Math.round(m.energy*100)+"%";$("uprightT").textContent=Math.round((o.upright*0.5+0.5)*100)+"%";$("contactsT").textContent=o.contacts+"/4";$("genT").textContent=m.generation;$("rewardT").textContent=m.dense.toFixed(3);$("fragmentsT").textContent=m.fragments.length;$("guardsT").textContent=o.guardHits;$("foldT").textContent=o.foldRisk.toFixed(3);$("gripsT").textContent=o.legs.filter(l=>l.grip).length+"/4";$("sleepT").textContent=m.sleep.sleeping?"sleeping":"awake";
  $("jointT").innerHTML=`Architecture: ${o.legArchitecture}<br>Self-collision: ${o.selfCollision?"ON":"OFF"}<br>`+o.legs.map(l=>`L${l.index+1}: hip ${(l.angles && l.angles.hip !== undefined ? l.angles.hip : 0).toFixed(2)} • knee ${(l.angles && l.angles.knee !== undefined ? l.angles.knee : 0).toFixed(2)} • ankle ${(l.angles && l.angles.ankle !== undefined ? l.angles.ankle : 0).toFixed(2)}${l.grip?" • GRIP":""}`).join("<br>");
  $("events").textContent=`Best score: ${m.bestScore<=-900?"learning":m.bestScore.toFixed(2)} • sleep gain: ${m.sleep.lastGain}`;
  $("objCount").textContent=`${app.objects.length} objects`;
  $("buildT").textContent=`${BUILD} • ${app.timeScale}×`;
}
$("pause").addEventListener("click",e=>{app.paused=!app.paused;e.currentTarget.textContent=app.paused?"Resume":"Pause"});
$("timeScale").addEventListener("change",e=>app.timeScale=Math.max(0.5,Math.min(15,Number(e.target.value)||1)));
$("addOrb").addEventListener("click",()=>addOrb());
$("removeOrb").addEventListener("click",removeSelected);
$("freecam").addEventListener("click",e=>{app.follow=!app.follow;e.currentTarget.textContent=app.follow?"Freecam":"Follow selected";});
$("reset").addEventListener("click",reset);
$("addObject").addEventListener("click",()=>addObject(app,$("objectType").value,Number($("objX").value)||0,Number($("objZ").value)||0,1));
$("randomObject").addEventListener("click",()=>addObject(app,$("objectType").value,(Math.random()-0.5)*55,(Math.random()-0.5)*55,1));
window.addEventListener("resize",resize);
window.addEventListener("keydown",e=>{
  if(["KeyW","KeyA","KeyS","KeyD","KeyQ","KeyE"].includes(e.code)){app.freeKeys.add(e.code);if(!app.follow)e.preventDefault()}
  if(e.code==="KeyF"){app.follow=!app.follow;$("freecam").textContent=app.follow?"Freecam":"Follow selected"}
});
window.addEventListener("keyup",e=>app.freeKeys.delete(e.code));
function updateFreecam(dt){
  if(app.follow)return;
  const speed=7.0*dt,forward=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),right=new THREE.Vector3(),move=new THREE.Vector3();
  camera.getWorldDirection(forward);forward.y=0;if(forward.lengthSq()>0)forward.normalize();
  right.crossVectors(forward,up).normalize();
  if(app.freeKeys.has("KeyW"))move.add(forward);
  if(app.freeKeys.has("KeyS"))move.sub(forward);
  if(app.freeKeys.has("KeyD"))move.add(right);
  if(app.freeKeys.has("KeyA"))move.sub(right);
  if(app.freeKeys.has("KeyE"))move.y+=1;
  if(app.freeKeys.has("KeyQ"))move.y-=1;
  if(move.lengthSq()>0){move.normalize().multiplyScalar(speed);camera.position.add(move);controls.target.add(move)}
}

try{
  $("status").textContent="v0.11 building world…";
  reset();
  $("status").textContent="v0.11 modular engine running";
}catch(e){
  if(window.__orbBootError)window.__orbBootError("Startup failed while building the world:\n\n"+(e&&e.stack?e.stack:String(e)));
  throw e;
}
const clock=new THREE.Clock(),FIXED=1/180;let acc=0,uiTimer=0;
function frame(){
  requestAnimationFrame(frame);const realDt=Math.min(0.05,clock.getDelta());resize();
  if(!app.paused){
    acc+=realDt*app.timeScale;let steps=0;
    while(acc>=FIXED&&steps<120){
      app.simTime+=FIXED;
      for(const o of app.orbs){
        updateBodySensors(o,app.objects);
        const cmd=updateMind(app,o,FIXED);
        if(!o.mind.sleep.sleeping)o.mind.activity=driveBody(o,cmd,FIXED);
        enforceAnatomy(o,FIXED);
      }
      updateWorld(app,FIXED);P.world.step(FIXED);acc-=FIXED;steps++;
    }
    if(steps>=120)acc=0;
    for(const o of app.orbs)syncBody(o);
  }
  uiTimer-=realDt;if(uiTimer<=0){refreshUI();refreshList();uiTimer=0.30}
  updateFreecam(realDt);if(app.follow&&app.selected){const p=app.selected.shell.position,des=new THREE.Vector3(p.x+7,p.y+5.2,p.z+8.2);camera.position.lerp(des,0.018);controls.target.lerp(new THREE.Vector3(p.x,p.y,p.z),0.04)}
  controls.update();renderer.render(scene,camera)
}
frame();
window.addEventListener("error",e=>{$("err").hidden=false;$("err").textContent=e.error?.stack||e.message||String(e.error);$("status").textContent="startup/runtime error — see panel"});
