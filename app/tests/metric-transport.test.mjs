import test from 'node:test';
import assert from 'node:assert/strict';
import {traceMetricTransport} from '../src/metric-transport.js';
import {sampleGravityStream} from '../src/gravity-field.js';
import {Observatory} from '../src/engine.js';

test('each particle route begins on the ring, passes through gravity and ends at its card',()=>{
 const start={x:-1.8,y:.05},velocity={vx:1,vy:0};
 const wells=[{x:-.2,y:0,mass:1,radius:.058},{x:.3,y:.3,mass:1},{x:.3,y:-.3,mass:1}];
 for(let card=0;card<5;card++){
  const target={x:1.7,y:(card-2)*.4},stream=traceMetricTransport(start,velocity,wells,target);
  assert.deepEqual(sampleGravityStream(stream,0),start);
  const end=sampleGravityStream(stream,1);
  assert.ok(Math.hypot(end.x-target.x,end.y-target.y)<1e-9);
  assert.ok(stream.closest<.2,'route must encounter the black-hole region');
  assert.ok(stream.length>2);
  for(let i=0;i<=1000;i++){
   const p=sampleGravityStream(stream,i/1000);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
   if(i){const prev=sampleGravityStream(stream,(i-1)/1000);assert.ok(Math.hypot(p.x-prev.x,p.y-prev.y)<stream.length/1000*1.15);}
  }
 }
});
test('moving a black hole changes the incoming particle trajectory while retaining its destination',()=>{
 const start={x:-1.8,y:.2},velocity={vx:1,vy:0},target={x:1.7,y:.7};
 const a=traceMetricTransport(start,velocity,[{x:0,y:0,mass:1}],target);
 const b=traceMetricTransport(start,velocity,[{x:.2,y:-.3,mass:1}],target);
 assert.ok(Math.hypot(a.points[a.join].x-b.points[b.join].x,a.points[a.join].y-b.points[b.join].y)>.01);
 assert.deepEqual(sampleGravityStream(a,1),sampleGravityStream(b,1));
});
test('ring particles have a visible outward normal launch before gravity bends them',()=>{
 const start={x:-1.8,y:.2},angle=.4,velocity={vx:Math.cos(angle),vy:Math.sin(angle)};
 const stream=traceMetricTransport(start,velocity,[{x:0,y:0}],{x:1.7,y:.4},1,0,1,.3);
 for(let i=1;i<=12;i++){
  const dx=stream.points[i].x-start.x,dy=stream.points[i].y-start.y;
  assert.ok(Math.abs(dx*velocity.vy-dy*velocity.vx)<1e-10);
  assert.ok(dx*velocity.vx+dy*velocity.vy>0);
 }
 assert.ok(Math.abs(Math.hypot(stream.points[12].x-start.x,stream.points[12].y-start.y)-.3)<1e-10);
});
test('channel clocks advance only the matching particles on the actual renderer path',()=>{
 const streams=Array.from({length:5},(_,i)=>[traceMetricTransport({x:-1.8,y:0},{vx:1,vy:0},[{x:0,y:0}],{x:1.7,y:(i-2)*.4})]);
 const engine={channelTimes:Array(5).fill(10),metricStreams:streams,config:{paused:false}};
 const particles=Array.from({length:5},(_,band)=>({u:.2,v:.5,w:.3,band}));
 const positions=particles.map(p=>Observatory.prototype.getPosition.call(engine,p,10,900,300,600,200));
 engine.channelTimes[0]+=.2;
 const moved=particles.map(p=>Observatory.prototype.getPosition.call(engine,p,10,900,300,600,200));
 assert.notDeepEqual(moved[0],positions[0]);
 for(let i=1;i<5;i++)assert.deepEqual(moved[i],positions[i]);
});
