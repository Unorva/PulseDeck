import test from 'node:test';
import assert from 'node:assert/strict';
import {gravityAcceleration,stepGravityParticle,traceGravityStream,sampleGravityStream,createThreeBodies,bodyAccelerations,stepThreeBodies} from '../src/gravity-field.js';
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
test('coherent gravity streams begin exactly at their outlet and remain finite when sampled',()=>{
 const stream=traceGravityStream({x:-1.6,y:.15},{vx:1,vy:0},[{x:0,y:0},{x:.3,y:.4},{x:.3,y:-.4}]);
 assert.deepEqual(sampleGravityStream(stream,0),{x:-1.6,y:.15});
 for(let i=0;i<100;i++){const p=sampleGravityStream(stream,i/100);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));}
 assert.ok(stream.points.length>10);assert.ok(stream.duration>0);
});
test('mutual black-hole forces conserve total momentum',()=>{
 const bodies=createThreeBodies();bodies[0].mass=1.3;
 const forces=bodyAccelerations(bodies),sum=forces.reduce((total,a,i)=>({x:total.x+a.x*bodies[i].mass,y:total.y+a.y*bodies[i].mass}),{x:0,y:0});
 assert.ok(Math.abs(sum.x)<1e-10&&Math.abs(sum.y)<1e-10);
 const initial=bodies.reduce((p,b)=>({x:p.x+b.vx*b.mass,y:p.y+b.vy*b.mass}),{x:0,y:0});
 for(let i=0;i<200;i++)stepThreeBodies(bodies,1/120);
 const after=bodies.reduce((p,b)=>({x:p.x+b.vx*b.mass,y:p.y+b.vy*b.mass}),{x:0,y:0});
 assert.ok(Math.abs(after.x-initial.x)<1e-8&&Math.abs(after.y-initial.y)<1e-8);
});
test('moving one black hole changes the acceleration and trajectories of the other two',()=>{
 const normal=createThreeBodies(),moved=createThreeBodies();moved[0].x-=.35;moved[0].y+=.25;
 const a=bodyAccelerations(normal),b=bodyAccelerations(moved);
 for(const i of [1,2])assert.ok(Math.hypot(a[i].x-b[i].x,a[i].y-b[i].y)>.001);
 for(let i=0;i<120;i++){stepThreeBodies(normal,1/120);stepThreeBodies(moved,1/120);}
 for(const i of [1,2])assert.ok(Math.hypot(normal[i].x-moved[i].x,normal[i].y-moved[i].y)>.001);
});
test('dragging pins only the selected black hole while its partners keep responding',()=>{
 const bodies=createThreeBodies(),start=bodies.map(b=>({...b})),point={x:-.6,y:.25};
 for(let i=0;i<120;i++)stepThreeBodies(bodies,1/120,1,0,point);
 assert.equal(bodies[0].x,point.x);assert.equal(bodies[0].y,point.y);
 for(const i of [1,2])assert.ok(Math.hypot(bodies[i].x-start[i].x,bodies[i].y-start[i].y)>.01);
 stepThreeBodies(bodies,1/60);assert.ok(Math.hypot(bodies[0].vx,bodies[0].vy)>0);
});
test('the default three-body scene remains finite and visible over five simulated minutes',()=>{
 const bodies=createThreeBodies();
 for(let i=0;i<36000;i++){stepThreeBodies(bodies,1/120);for(const b of bodies)assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y)&&Math.hypot(b.x,b.y)<.8);}
});
