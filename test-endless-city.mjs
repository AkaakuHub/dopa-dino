import assert from 'node:assert/strict';
import {HoleCity,HelixTower} from './dist/ads-engine.js';
import {AdRenderer} from './dist/ads-render.js';
const canvas={dataset:{},getBoundingClientRect:()=>({width:390,height:844})};
const r=new AdRenderer(canvas);r.initialize=function(){this.renderer??={setSize(){},render(){},renderLists:{dispose(){}}}};
const m=new HoleCity();r.render('hole',m);const initialGeo=new Set();r.scene.traverse(o=>{if(o.geometry)initialGeo.add(o.geometry)});
for(let i=0;i<220;i++){m.player.x=(i-100)*16;m.player.z=Math.sin(i*.7)*320;m.makeCity();r.render('hole',m);assert.equal(m.chunks.size,9);assert.equal(m.items.length,234);assert.equal(r.cityTiles[0].count,9);const current=new Set();r.scene.traverse(o=>{if(o.geometry)current.add(o.geometry)});assert.equal(current.size,initialGeo.size);for(const geo of current)assert(initialGeo.has(geo),'chunk movement must never allocate new geometry');for(const parts of r.cityBatches.values())for(const mesh of parts)assert(mesh.count<=234);}
assert(m.player.x>1000);m.point(5000,-5000);assert.equal(m.player.target.x,5000);assert.equal(m.player.target.z,-5000);r.stop();
// Each smash reuses a fixed forty-piece GPU pool, including sustained rapid smashing.
const h=new HelixTower();r.render('helix',h);const shardGeometry=r.fragmentPool[0].geometry;assert(r.fragmentPool.every(p=>p.geometry===shardGeometry));for(let i=0;i<100;i++){r.shatterRing(i,h);assert(r.fragments.length<=40);assert(r.fragmentPool.every(p=>p.geometry===shardGeometry));}h.time+=2;r.render('helix',h);assert.equal(r.fragments.length,0);assert(r.fragmentPool.every(p=>!p.visible));r.stop();
console.log('PASS: 220 distant city neighborhoods retain nine chunks/234 records and exact geometry identities; unlimited target coordinates; 100 shatters reuse forty shared-geometry pieces and expire completely');
