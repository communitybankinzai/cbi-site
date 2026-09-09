import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const container=document.querySelector('#scene'), status=document.querySelector('#status');
const scene=new THREE.Scene();scene.background=new THREE.Color('#d9dfe1');
const camera=new THREE.PerspectiveCamera(38,1,0.05,200);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
container.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=4;controls.maxDistance=40;
scene.add(new THREE.HemisphereLight(0xd9efff,0x747066,2));
for(const [position,intensity,color] of [[[4,8,5],3.2,0xfff5e1],[[-3,4,-6],2,0xd5e8ff]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);}
let model,mixer,action,request=0;
const views={threeQuarter:[10,8,13],front:[18,1.7,0],side:[0,2,19],rear:[-18,2,0],top:[0,20,0.01]};
function setView(){const pos=views[document.querySelector('#view').value];const scale=camera.aspect<1?1/camera.aspect:1;camera.position.set(...pos.map(x=>x*scale));controls.target.set(0,0,0);controls.update();}
function resize(){renderer.setSize(container.clientWidth,container.clientHeight);camera.aspect=container.clientWidth/container.clientHeight;camera.updateProjectionMatrix();setView();}
new ResizeObserver(resize).observe(container);
document.querySelector('#view').onchange=setView;
document.querySelector('#flap').onchange=()=>{if(action){action.paused=!document.querySelector('#flap').checked;if(action.paused){action.time=0;mixer.update(0);}}};
document.querySelector('#spin').onchange=e=>{controls.autoRotate=e.target.checked;};
async function load(){const id=++request,kind=document.querySelector('#species').value;status.textContent='読み込み中…';
try{const gltf=await new GLTFLoader().loadAsync('assets/tonbi/'+kind+'.glb?v=20260909-3');if(id!==request)return;
if(model){scene.remove(model);model.traverse(o=>{if(o.isMesh){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>{m.map?.dispose();m.normalMap?.dispose();m.dispose();});}});}
model=gltf.scene;scene.add(model);mixer=new THREE.AnimationMixer(model);action=mixer.clipAction(gltf.animations[0]);action.play();action.paused=!document.querySelector('#flap').checked;
document.querySelector('#download').href='assets/tonbi/'+kind+'.glb';status.textContent=kind==='kite'?'鳶':'本埜の白鳥';setView();
window.birdPreview={scene,model,camera,renderer,mixer};
}catch(e){status.textContent='モデルを読み込めませんでした';console.error(e);}}
document.querySelector('#species').onchange=load;
const clock=new THREE.Clock();renderer.setAnimationLoop(()=>{mixer?.update(Math.min(clock.getDelta(),0.05)*Number(document.querySelector('#speed').value));controls.update();renderer.render(scene,camera);});
resize();load();
