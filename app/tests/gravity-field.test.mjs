import test from 'node:test';
import assert from 'node:assert/strict';
import {gravityAcceleration,stepGravityParticle} from '../src/gravity-field.js';
test('each black hole attracts a nearby particle toward its center',()=>{
 const wells=[{x:0,y:0},{x:2,y:1},{x:-2,y:1}];
 for(const well of wells){const force=gravityAcceleration({x:well.x+.1,y:well.y},wells);assert.ok(force.x<0);}
});
test('three-body acceleration includes all three wells',()=>{
 const point={x:.2,y:.5},wells=[{x:-.4,y:0},{x:.4,y:0},{x:0,y:.7}];
 const total=gravityAcceleration(point,wells),sum=wells.map(w=>gravityAcceleration(point,[w])).reduce((a,b)=>({x:a.x+b.x,y:a.y+b.y}),{x:0,y:0});
 assert.ok(Math.abs(total.x-sum.x)<1e-10);assert.ok(Math.abs(total.y-sum.y)<1e-10);
});
test('gravity bends a passing stream and conserves finite state across long frames',()=>{
 const p={x:-.8,y:.2,vx:1,vy:0};for(let i=0;i<60;i++)stepGravityParticle(p,[{x:0,y:0}],1/60);
 assert.ok(p.y<.2);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.vy));
 stepGravityParticle(p,[{x:0,y:0}],4);assert.ok(Math.hypot(p.vx,p.vy)<=4.5001);
});
test('particles crossing an event horizon are captured by the matching well',()=>{
 assert.equal(stepGravityParticle({x:.3,y:.21,vx:1,vy:0},[{x:0,y:0},{x:.3,y:.2},{x:-.3,y:.1}],1/60),1);
});
