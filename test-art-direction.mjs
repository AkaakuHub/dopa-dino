import assert from 'node:assert/strict';
import * as THREE from './dist/vendor/three.module.min.js';
import { AdRenderer } from './dist/ads-render.js';
import { AdSession, AD_GAMES } from './dist/ads-engine.js';
import { ART_DIRECTIONS, surface, roundedBox } from './dist/ads-visuals.js';

const make = (kind, width=390, height=844) => {
 const r = new AdRenderer({dataset:{},getBoundingClientRect:()=>({width,height})});
 r.initialize=function(){this.renderer??={setSize(){},render(){},renderLists:{dispose(){}},capabilities:{getMaxAnisotropy(){return 4}}};};
 const s=new AdSession(kind);r.render(kind,s.model);return {r,s};
};
assert.equal(Object.keys(ART_DIRECTIONS).length,10);
assert.equal(new Set(Object.values(ART_DIRECTIONS).map(x=>x.name)).size,10);
assert.equal(new Set(Object.values(ART_DIRECTIONS).map(x=>x.background)).size,10);
for(const {id:kind} of AD_GAMES){
 const {r,s}=make(kind), surfaces=new Set(),textures=new Set(),materials=new Set();
 assert.equal(r.scene.userData.artDirection,ART_DIRECTIONS[kind].name);
 assert(r.scene.environment.isDataTexture); assert.equal(r.scene.environment.mapping,THREE.EquirectangularReflectionMapping);
 assert.equal(r.scene.environment.colorSpace,THREE.LinearSRGBColorSpace);
 for(const mat of r.cache.values())materials.add(mat);
 r.scene.traverse(o=>{if(o.material)for(const mat of Array.isArray(o.material)?o.material:[o.material])materials.add(mat);});
 for(const mat of materials){
  if(mat.userData.artSurface){surfaces.add(mat.userData.artSurface);assert(mat.isMeshStandardMaterial);assert(mat.map?.isDataTexture);assert(mat.bumpMap?.isDataTexture);assert(mat.roughnessMap?.isDataTexture);assert.equal(mat.map.colorSpace,THREE.SRGBColorSpace);assert.equal(mat.bumpMap.colorSpace,THREE.NoColorSpace);assert.equal(mat.roughnessMap.colorSpace,THREE.NoColorSpace);assert.equal(mat.map.anisotropy,4);assert.equal(mat.map.image.width,128);assert.equal(mat.map.image.height,128);assert(mat.map.generateMipmaps);assert.equal(mat.map.minFilter,THREE.LinearMipmapLinearFilter);}
  for(const value of Object.values(mat))if(value?.isTexture)textures.add(value);
 }
 textures.add(r.scene.environment);assert(surfaces.size>=2,`${kind} distinct material families`);
 let bytes=0;for(const t of textures)bytes+=t.image?.data?.byteLength||0;
 assert(bytes<3*1024*1024,`${kind} procedural source textures under 3MiB`);
 const counts=[r.art.materials.size,r.art.textures.size,r.cache.size];
 for(let i=0;i<80;i++){s.model.time+=.016;r.render(kind,s.model);}
 assert.deepEqual([r.art.materials.size,r.art.textures.size,r.cache.size],counts,`${kind} allocation-free material updates`);
 assert.equal(r.art.time.value,s.model.time);r.lowMotion=true;r.render(kind,s.model);assert.equal(r.art.time.value,0);
 let disposed=0;for(const t of textures)t.addEventListener('dispose',()=>disposed++);
 r.stop();assert.equal(disposed,textures.size,`${kind} all surface/env textures dispose once`);assert.equal(r.art,null);assert.equal(r.cache.size,0);
 console.log(`PASS ${kind}: ${surfaces.size} authored surface families, ${(bytes/1024).toFixed(0)} KiB source texture data, stable materials, reduced-motion and exact-once texture disposal`);
}
// Deterministic authored maps, map cache and flowing-material shader injection.
const {r}=make('gates'),a=surface(r,'water',0x237b8d),b=surface(r,'water',0x237b8d);
assert.equal(a,b);assert.equal(a.map,surface(r,'water',0x83bccc).map);
for(const name of ['water','lava']){
 const m=surface(r,name,0x887766),shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
 const vertexCount=(shader.vertexShader.match(/#include <begin_vertex>/g)||[]).length,fragmentCount=(shader.fragmentShader.match(/#include <color_fragment>/g)||[]).length;
 assert.equal(vertexCount,1);assert.equal(fragmentCount,1);m.onBeforeCompile(shader);
 assert.equal(shader.uniforms.artTime,r.art.time);assert(shader.vertexShader.includes('vArtPosition = position;'));
 assert(shader.fragmentShader.includes('float artWave = sin('));assert(shader.fragmentShader.includes('diffuseColor.rgb *= .91 + .09 * artWave;'));
 assert(!shader.vertexShader.includes('undefined'));assert(!shader.fragmentShader.includes('undefined'));
 assert.equal(m.customProgramCacheKey(),`crafted-${name}-v1`);
}
const firstBytes=new Uint8Array(a.map.image.data);r.stop();const other=make('gates').r;
assert.deepEqual(surface(other,'water',0x237b8d).map.image.data,firstBytes);other.stop();
for(const [w,h,d] of [[1,1,1],[3,.26,2],[.2,4,.7]]){
 const geo=roundedBox(w,h,d,.08,2),box=geo.boundingBox,size=box.getSize(new THREE.Vector3());
 assert(Math.abs(size.x-w)<1e-6&&Math.abs(size.y-h)<1e-6&&Math.abs(size.z-d)<1e-6);
 for(const data of Object.values(geo.attributes))assert([...data.array].every(Number.isFinite));
 for(let i=0;i<geo.attributes.normal.count;i++){const n=new THREE.Vector3().fromBufferAttribute(geo.attributes.normal,i);assert(Math.abs(n.length()-1)<1e-6);}
 geo.dispose();
}
console.log('PASS authored maps, surface caching, rounded silhouette bounds and shader hook compatibility with vendored Three.js r180. This does not compile GLSL on a GPU or validate rendered pixels.');
