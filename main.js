import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {createPhysics,createOrbsightBody,updateBodySensors,driveBody,enforceAnatomy,syncBody,destroyBody} from "./physics.js";
import {setupWorld,addObject,resetMap,updateWorld,clearObjects} from "./world.js";
import {attachMind,updateMind,cleanupMind} from "./mind.js";

const BUILD="0.10-modular-joint-rebuild-2026-09-18";
const $=id=>document.getElementById(id);
const canvas=$("c"),renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(2,devicePixelRatio));renderer.shadowMap.enabled=true;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1016);scene.fog=new THREE.Fog(0x0b1016,38,92);
const camera=new THREE.PerspectiveCamera(55,1,.05,130);camera.position.set(8,7,11);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.maxDistance=52;controls.target.set(0,.8,0);
scene.add(new THREE.HemisphereLight(0xbfd8ff,0x273020,1.25));
const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(12,18,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);

const P=createPhysics();
const app={scene,camera,renderer,controls,sun,P,GROUP:P.GROUP,objects:[],orbs:[],selected:null,nextOrbId:1,nextObjectId:1,simTime:0,timeScale:1,paused:false};
setupWorld(app);

function resize(){const r=canvas.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);if(canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
function addOrb(x=(Math.random()-.5)*4,z=(Math.random()-.5)*4){if(app.orbs.length>=20)return;const o=createOrbsightBody(P,scene,app.nextOrbId++,x,z);attachMind(app,o);app.orbs.push(o);if(!app.selected)app.selected=o;refreshList();return o}
function removeAllOrbs(){for(const o of [...app.orbs]){cleanupMind(app,o);destroyBody(P,scene,o)}app.orbs.length=0;app.selected=null}
function reset(){removeAllOrbs();resetMap(app);addOrb(0,0);addOrb(1.5,.4);addOrb(-1.3,.6);app.selected=app.orbs[0];refreshList()}
function refreshList(){
  $("popCount").textContent=`(${app.orbs.length}/20)`;$("orbList").innerHTML="";
  for(const o of app.orbs){const d=document.createElement("div");d.className="orbrow"+(o===app.selected?" selected":"");const s=document.createElement("span");s.textContent=`${o.mind.name} • G${o.mind.generation}`;const b=document.createElement("button");b.textContent="Select";b.addEventListener("click",()=>{app.selected=o;refreshList()});d.append(s,b);$("orbList").append(d)}
}
function refreshUI(){
  const o=app.selected;if(!o)return;const m=o.mind;
  $("nameT").textContent=m.name;$("thoughtT").textContent=m.thought;$("stageT").textContent=m.stageName;$("energyT").textContent=Math.round(m.energy*100)+"%";$("uprightT").textContent=Math.round((o.upright*.5+.5)*100)+"%";$("contactsT").textContent=o.contacts+"/4";$("genT").textContent=m.generation;$("rewardT").textContent=m.dense.toFixed(3);$("fragmentsT").textContent=m.fragments.length;$("guardsT").textContent=o.guardHits;$("foldT").textContent=o.foldRisk.toFixed(3);$("gripsT").textContent=o.legs.filter(l=>l.grip).length+"/4";$("sleepT").textContent=m.sleep.sleeping?"sleeping":"awake";
  $("jointT").innerHTML=o.legs.map(l=>`L${l.index+1}: hip ${(l.angles?.hip??0).toFixed(2)} • knee ${(l.angles?.knee??0).toFixed(2)} • ankle ${(l.angles?.ankle??0).toFixed(2)}${l.grip?" • GRIP":""}`).join("<br>");
  $("events").textContent=`Best score: ${m.bestScore<=-900?"learning":m.bestScore.toFixed(2)} • sleep gain: ${m.sleep.lastGain}`;
  $("objCount").textContent=`${app.objects.length} objects`;
  $("buildT").textContent=`${BUILD} • ${app.timeScale}×`;
}
$("pause").addEventListener("click",e=>{app.paused=!app.paused;e.currentTarget.textContent=app.paused?"Resume":"Pause"});
$("timeScale").addEventListener("change",e=>app.timeScale=Math.max(.5,Math.min(15,Number(e.target.value)||1)));
$("addOrb").addEventListener("click",()=>addOrb());
$("reset").addEventListener("click",reset);
$("addObject").addEventListener("click",()=>addObject(app,$("objectType").value,Number($("objX").value)||0,Number($("objZ").value)||0,1));
$("randomObject").addEventListener("click",()=>addObject(app,$("objectType").value,(Math.random()-.5)*55,(Math.random()-.5)*55,1));
window.addEventListener("resize",resize);

reset();$("status").textContent="v0.10 modular engine running";
const clock=new THREE.Clock(),FIXED=1/180;let acc=0,uiTimer=0;
function frame(){
  requestAnimationFrame(frame);const realDt=Math.min(.05,clock.getDelta());resize();
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
  uiTimer-=realDt;if(uiTimer<=0){refreshUI();refreshList();uiTimer=.30}
  if(app.selected){const p=app.selected.shell.position,des=new THREE.Vector3(p.x+7,p.y+5.2,p.z+8.2);camera.position.lerp(des,.018);controls.target.lerp(new THREE.Vector3(p.x,p.y,p.z),.04)}
  controls.update();renderer.render(scene,camera)
}
frame();
window.addEventListener("error",e=>{$("err").hidden=false;$("err").textContent=e.error?.stack||e.message||String(e.error);$("status").textContent="startup/runtime error — see panel"});
