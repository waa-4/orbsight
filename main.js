import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {createPhysics,createOrbsightBody,updateBodySensors,driveBody,settleBody,syncBody,animateEye,destroyBody,bodyPosition} from "./physics.js";
import {setupWorld,addObject,resetMap,updateWorld} from "./world.js";
import {attachMind,updateMind,cleanupMind,debugAction,encodeOrbsightBits,decodeOrbsightBits,applyOrbsightBits} from "./mind.js";

const BUILD="0.17.2-floating-debug-window-2026-09-22";
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
function cloneSelected(){
  const src=app.selected;if(!src||app.orbs.length>=20)return null;
  const p=bodyPosition(src),o=addOrb(p.x+1.2,p.z+0.4);
  try{applyOrbsightBits(o,encodeOrbsightBits(src));o.mind.name=src.mind.name+" clone"}catch(e){console.error(e)}
  app.selected=o;refreshList();refreshBinary();return o
}
function removeSelected(){const o=app.selected;if(!o)return;cleanupMind(app,o);destroyBody(P,scene,o);const i=app.orbs.indexOf(o);if(i>=0)app.orbs.splice(i,1);app.selected=app.orbs[0]||null;refreshList()}
function removeAll(){for(const o of [...app.orbs]){cleanupMind(app,o);destroyBody(P,scene,o)}app.orbs.length=0;app.selected=null}
function reset(){removeAll();resetMap(app);addOrb(0,0);addOrb(1.5,0.4);addOrb(-1.3,0.6);app.selected=app.orbs[0];refreshList()}
function refreshList(){
  $("popCount").textContent=`(${app.orbs.length}/20)`;$("orbList").innerHTML="";
  for(const o of app.orbs){const d=document.createElement("div");d.className="orbrow"+(o===app.selected?" selected":"");const s=document.createElement("span");s.textContent=`${o.mind.name} • G${o.mind.generation}`;const actions=document.createElement("span");actions.style.display="flex";actions.style.gap="4px";
    const b=document.createElement("button");b.textContent="Select";b.onclick=()=>{app.selected=o;refreshList();if(!$("debugPanel").hidden)refreshBinary()};
    const c=document.createElement("button");c.textContent="Clone";c.onclick=()=>{app.selected=o;cloneSelected()};
    actions.append(b,c);d.append(s,actions);$("orbList").append(d)}
}
function refreshUI(){
  const o=app.selected;if(!o)return;const m=o.mind;
  $("nameT").textContent=m.name;$("thoughtT").textContent=m.thought;$("stageT").textContent=m.stageName;$("energyT").textContent=Math.round(m.energy*100)+"%";$("uprightT").textContent=Math.round((o.upright*0.5+0.5)*100)+"%";$("contactsT").textContent=o.contacts+"/4";$("genT").textContent=m.generation;$("rewardT").textContent=m.dense.toFixed(3);$("fragmentsT").textContent=m.fragments.length;$("settleT").textContent=m.development.phase;$("sleepT").textContent=m.sleep.sleeping?"sleeping":"awake";
  $("jointT").innerHTML=o.legs.map(l=>`L${l.index+1}: ${m.legs[l.index].state} • sole ${(l.solePressure*100).toFixed(0)}% • speed ${l.footSpeed.toFixed(2)} • hip ${l.angles.hip.toFixed(2)} • knee ${l.angles.knee.toFixed(2)}`).join("<br>");
  const gripCount=o.legs.filter(l=>l.grip).length;
  const muscles=o.legs.flatMap(l=>["spread","hip","knee","ankle","roll"].map(j=>l.muscle[j]));
  const avgStrength=muscles.reduce((a,b)=>a+b.strength,0)/muscles.length;
  const avgFatigue=muscles.reduce((a,b)=>a+b.fatigue,0)/muscles.length;
  const legStates=m.legs.map((l,i)=>`L${i+1}:${l.state}`).join(" ");
  $("events").textContent=`${m.development.phase} • muscle ${(avgStrength*100).toFixed(0)}% • fatigue ${(avgFatigue*100).toFixed(0)}% • crawl ${(m.development.crawlSkill*100).toFixed(0)}% • grip ${(m.development.gripSkill*100).toFixed(0)}% • grips ${gripCount}/4 • ${legStates} • ${o.runtimeError?"ERROR: "+o.runtimeError.slice(0,100):"runtime OK"}`;
  $("objCount").textContent=`${app.objects.length} objects`;$("buildT").textContent=`${BUILD} • ${app.timeScale}×`;
}

let importMode="spawn";
function selectedOrMessage(){if(!app.selected){$("debugMsg").textContent="Select an Orbsight first.";return null}return app.selected}
function setDebugMsg(t){$("debugMsg").textContent=t}
function refreshBinary(){
  const o=app.selected;if(!o){$("orbBits").value="";$("binaryInfo").textContent="No selected Orbsight.";return}
  try{
    const bits=encodeOrbsightBits(o);$("orbBits").value=bits;
    const clean=bits.replace(/[^01]/g,"");
    $("binaryInfo").textContent=`${clean.length} bits • ${clean.length/8} bytes • fixed binary schema v17`;
  }catch(e){setDebugMsg("Binary encode error: "+e.message)}
}
function downloadSelectedOrb(){
  const o=selectedOrMessage();if(!o)return;
  try{
    const bits=encodeOrbsightBits(o),blob=new Blob([bits],{type:"text/plain"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    const safe=(o.mind.name||"orbsight").replace(/[^a-z0-9_-]+/gi,"_").slice(0,40);
    a.href=url;a.download=`${safe}.orb`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setDebugMsg(`Exported ${o.mind.name} as a binary .orb file.`);
  }catch(e){setDebugMsg("Export failed: "+e.message)}
}
function applyBitsFromBox(){
  const o=selectedOrMessage();if(!o)return;
  try{
    const d=applyOrbsightBits(o,$("orbBits").value);refreshList();refreshUI();refreshBinary();
    setDebugMsg(`Applied ${d.byteLength} binary bytes to ${o.mind.name}.`);
  }catch(e){setDebugMsg("Could not apply bits: "+e.message)}
}
async function loadOrbFile(file){
  try{
    const text=await file.text(),data=decodeOrbsightBits(text);
    let o;
    if(importMode==="selected"){
      o=selectedOrMessage();if(!o)return;applyOrbsightBits(o,text);
    }else{
      if(app.orbs.length>=20){setDebugMsg("Population is already at 20.");return}
      o=addOrb((Math.random()-.5)*3,(Math.random()-.5)*3);applyOrbsightBits(o,text);app.selected=o;
    }
    refreshList();refreshUI();refreshBinary();
    setDebugMsg(`Loaded ${data.name||"Orbsight"} from ${data.byteLength} bytes of 1/0 data.`);
  }catch(e){setDebugMsg("Import failed: "+e.message)}
}

$("pause").onclick=e=>{app.paused=!app.paused;e.currentTarget.textContent=app.paused?"Resume":"Pause"};
$("timeScale").onchange=e=>app.timeScale=Math.max(0.5,Math.min(15,Number(e.target.value)||1));
$("addOrb").onclick=()=>addOrb();$("removeOrb").onclick=removeSelected;$("reset").onclick=reset;
$("freecam").onclick=e=>{app.follow=!app.follow;e.currentTarget.textContent=app.follow?"Freecam":"Follow selected"};
function centerDebugWindow(){
  const panel=$("debugPanel");
  panel.style.left="50%";panel.style.top="50%";panel.style.transform="translate(-50%,-50%)";
}
function setDebugOpen(open){
  const panel=$("debugPanel"),button=$("toggleDebug"),backdrop=$("debugBackdrop");
  panel.hidden=!open;backdrop.hidden=!open;
  button.setAttribute("aria-expanded",String(open));
  button.textContent=open?"Close Debug":"Debug Panel";
  if(open){
    if(!panel.dataset.positioned){centerDebugWindow();panel.dataset.positioned="1"}
    refreshBinary();
    setDebugMsg("Floating Debug Panel opened. Drag the title bar; resize from the bottom-right corner.");
    panel.focus?.();
  }
}
$("toggleDebug").onclick=()=>setDebugOpen($("debugPanel").hidden);
$("closeDebug").onclick=()=>setDebugOpen(false);
$("centerDebug").onclick=centerDebugWindow;

{
  const panel=$("debugPanel"),handle=$("debugDragHandle");
  let drag=null;
  handle.addEventListener("pointerdown",e=>{
    if(e.target.closest("button"))return;
    const r=panel.getBoundingClientRect();
    // Remove centering transform before pixel-based dragging.
    panel.style.transform="none";
    panel.style.left=r.left+"px";panel.style.top=r.top+"px";
    drag={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top};
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  handle.addEventListener("pointermove",e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const maxX=Math.max(0,window.innerWidth-panel.offsetWidth);
    const maxY=Math.max(0,window.innerHeight-panel.offsetHeight);
    const x=Math.max(0,Math.min(maxX,e.clientX-drag.dx));
    const y=Math.max(0,Math.min(maxY,e.clientY-drag.dy));
    panel.style.left=x+"px";panel.style.top=y+"px";
  });
  const end=e=>{if(drag&&e.pointerId===drag.id){drag=null;try{handle.releasePointerCapture(e.pointerId)}catch{}}};
  handle.addEventListener("pointerup",end);handle.addEventListener("pointercancel",end);

  window.addEventListener("resize",()=>{
    if(panel.hidden)return;
    const r=panel.getBoundingClientRect();
    if(r.right<80||r.bottom<60||r.left>window.innerWidth-80||r.top>window.innerHeight-40)centerDebugWindow();
  });
}
$("debugPanel").addEventListener("click",e=>{
  const b=e.target.closest("[data-debug]");if(!b)return;
  const o=selectedOrMessage();if(!o)return;
  try{setDebugMsg(debugAction(app,o,b.dataset.debug));refreshUI();refreshBinary()}catch(err){setDebugMsg("Debug action failed: "+err.message)}
});
$("refreshBits").onclick=refreshBinary;
$("applyBits").onclick=applyBitsFromBox;
$("exportOrb").onclick=downloadSelectedOrb;
$("importOrbSpawn").onclick=()=>{importMode="spawn";$("orbFile").click()};
$("importOrbSelected").onclick=()=>{importMode="selected";$("orbFile").click()};
$("orbFile").onchange=async e=>{const f=e.target.files?.[0];if(f)await loadOrbFile(f);e.target.value=""};
$("addObject").onclick=()=>addObject(app,$("objectType").value,Number($("objX").value)||0,Number($("objZ").value)||0,1);
$("randomObject").onclick=()=>addObject(app,$("objectType").value,(Math.random()-0.5)*55,(Math.random()-0.5)*55,1);
window.addEventListener("keydown",e=>{if(["KeyW","KeyA","KeyS","KeyD","KeyQ","KeyE"].includes(e.code))app.freeKeys.add(e.code);if(e.code==="KeyF"){app.follow=!app.follow;$("freecam").textContent=app.follow?"Freecam":"Follow selected"}});
window.addEventListener("keyup",e=>app.freeKeys.delete(e.code));window.addEventListener("keydown",e=>{if(e.code==="Escape"&&!$("debugPanel").hidden)setDebugOpen(false)});
function updateFreecam(dt){if(app.follow)return;const speed=7*dt,f=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),r=new THREE.Vector3(),m=new THREE.Vector3();camera.getWorldDirection(f);f.y=0;if(f.lengthSq())f.normalize();r.crossVectors(f,up).normalize();if(app.freeKeys.has("KeyW"))m.add(f);if(app.freeKeys.has("KeyS"))m.sub(f);if(app.freeKeys.has("KeyD"))m.add(r);if(app.freeKeys.has("KeyA"))m.sub(r);if(app.freeKeys.has("KeyE"))m.y+=1;if(app.freeKeys.has("KeyQ"))m.y-=1;if(m.lengthSq()){m.normalize().multiplyScalar(speed);camera.position.add(m);controls.target.add(m)}}

reset();$("status").textContent="v0.17.2 floating debug window running";
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
