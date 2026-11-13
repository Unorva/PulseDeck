import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleResponse,sampleNodeEnergy} from '../src/sample-core.js';
import {Observatory} from '../src/engine.js';

test('samples generate bounded changing orientations and localized node selections',()=>{
 const a=sampleResponse(1,{cpu:40},290),b=sampleResponse(2,{cpu:40},290);
 assert.notDeepEqual(a,b);assert.deepEqual(a,sampleResponse(1,{cpu:40},290));
 for(let i=0;i<500;i++){
  const p=sampleResponse(i,{cpu:i%101},290);
  assert.ok(Math.abs(p.yaw)<=.75&&Math.abs(p.pitch)<=.4&&Math.abs(p.roll)<=.25);
  assert.ok(p.indices.every(index=>index>=0&&index<290));
 }
});
test('sample illumination spreads through the sphere and fades without clicking',()=>{
 const bursts=[{x:0,y:0,z:0,time:1,strength:.8}];
 assert.ok(sampleNodeEnergy({x:0,y:0,z:0},bursts,1)>.7);
 assert.ok(sampleNodeEnergy({x:.95,y:0,z:0},bursts,2)>.2);
 assert.ok(sampleNodeEnergy({x:0,y:0,z:0},bursts,2)<.01);
 assert.equal(sampleNodeEnergy({x:.95,y:0,z:0},bursts,4.1),0);
});
const core=()=>({metrics:{},config:{paused:false},nodes:Array.from({length:40},(_,i)=>({x:i/40,y:0,z:0})),sampleOrbit:{targetYaw:0,targetPitch:0,targetRoll:0},sampleBursts:[],lastSampleSequence:null,sampleCount:0,t:10});
test('the engine reacts on every fifth fresh sample and ignores duplicates',()=>{
 const engine=core();
 for(let sequence=1;sequence<=4;sequence++)Observatory.prototype.setMetrics.call(engine,{sequence,cpu:65});
 assert.equal(engine.sampleBursts.length,0);assert.equal(engine.sampleOrbit.targetYaw,0);
 for(let i=0;i<10;i++)Observatory.prototype.setMetrics.call(engine,{sequence:4,cpu:65});
 assert.equal(engine.sampleCount,4);assert.equal(engine.sampleBursts.length,0);
 Observatory.prototype.setMetrics.call(engine,{sequence:5,cpu:65});
 assert.notEqual(engine.sampleOrbit.targetYaw,0);assert.ok(engine.sampleBursts.length>=3);
 const count=engine.sampleBursts.length,angle=engine.sampleOrbit.targetYaw;
 Observatory.prototype.setMetrics.call(engine,{sequence:5,cpu:65});
 assert.equal(engine.sampleBursts.length,count);assert.equal(engine.sampleOrbit.targetYaw,angle);
 for(let sequence=6;sequence<=9;sequence++)Observatory.prototype.setMetrics.call(engine,{sequence,cpu:65});
 assert.equal(engine.sampleBursts.length,count);
 Observatory.prototype.setMetrics.call(engine,{sequence:10,cpu:65});assert.ok(engine.sampleBursts.length>count);
});
test('fifth-sample counting also works when the collector starts at an arbitrary sequence',()=>{
 const engine=core();for(let sequence=104;sequence<=107;sequence++)Observatory.prototype.setMetrics.call(engine,{sequence,cpu:50});
 assert.equal(engine.sampleBursts.length,0);Observatory.prototype.setMetrics.call(engine,{sequence:108,cpu:50});assert.ok(engine.sampleBursts.length>0);
});
test('paused samples stay current without accumulating light bursts or rotation',()=>{
 const engine=core();engine.config.paused=true;
 for(let sequence=1;sequence<=10;sequence++)Observatory.prototype.setMetrics.call(engine,{sequence,cpu:90});
 assert.equal(engine.metrics.cpu,90);assert.equal(engine.sampleBursts.length,0);assert.equal(engine.sampleOrbit.targetYaw,0);
 engine.config.paused=false;Observatory.prototype.setMetrics.call(engine,{sequence:11,cpu:90});assert.equal(engine.sampleBursts.length,0);
});
