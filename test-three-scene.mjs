import assert from 'node:assert/strict';
import {AdRenderer} from './dist/ads-render.js';
import {AD_GAMES,AdSession} from './dist/ads-engine.js';
import {readFileSync} from 'node:fs';
for(const [w,h] of [[1440,900],[390,844]])for(const {id:kind} of AD_GAMES){
 const canvas={dataset:{},getBoundingClientRect:()=>({width:w,height:h})};
 const r=new AdRenderer(canvas),s=new AdSession(kind);r.initialize=function(){this.renderer??={setSize(){},render(){},renderLists:{dispose(){}}}};
 r.render(kind,s.model);assert(r.scene.isScene);assert(kind==='range'?r.camera.isPerspectiveCamera:r.camera.isOrthographicCamera);let meshes=0,triangles=0,shadows=0;r.scene.traverse(o=>{if(o.isMesh){meshes++;assert((Array.isArray(o.material)?o.material:[o.material]).every(m=>m.isMaterial));assert(o.geometry.attributes.position.count>0);triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;if(o.castShadow)shadows++;}});assert(meshes>15&&meshes<800);assert(shadows>10);assert(triangles<130000);r.camera.updateMatrixWorld();
 if(!['range','pins','merge'].includes(kind))for(const [x,z] of [[0,0],[-3.8,1],[2,-3]]){const p=r.p(x,z),q=r.world(p.x,p.y);assert(Math.abs(q.x-x)<1e-7);assert(Math.abs(q.z-z)<1e-7);}
 if(kind==='helix'){for(let i=0;i<45;i++){s.model.floor++;s.model.depth++;r.render(kind,s.model);}assert.equal(r.helixRings.length,9);assert.equal(r.burst.length,16);}
 if(kind==='hole'){for(let i=0;i<3;i++){s.model.player.x+=32;s.model.makeCity();r.render(kind,s.model);}assert.equal(r.objects.size,s.model.items.filter(o=>!o.eaten).length);assert.equal(s.model.chunks.size,9);assert.equal(s.model.items.length,234);}
 const geos=new Set(),mats=new Set();r.scene.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m))});let gd=0,md=0;geos.forEach(g=>g.addEventListener('dispose',()=>gd++));mats.forEach(m=>m.addEventListener('dispose',()=>md++));r.stop();assert.equal(gd,geos.size);assert.equal(md,mats.size);assert.equal(r.scene,null);assert.equal(r.cache.size,0);console.log(`PASS ${kind} ${w}×${h}: real Three.js geometry/material/camera graph, ${meshes} meshes, ${Math.round(triangles)} triangles, bounded scene pools and complete scene disposal`);
}
const source=readFileSync('dist/ads-render.js','utf8');assert(source.includes('new THREE.WebGLRenderer'));assert(source.includes('PCFSoftShadowMap'));assert(!source.includes("getContext('2d')"));assert(!source.includes('https://'));assert(readFileSync('dist/vendor/three.module.min.js','utf8').includes('./three.core.min.js'));
console.log('Scene graph tests do not instantiate a GPU or validate browser pixels/performance. Real browser WebGL QA is separate.');
