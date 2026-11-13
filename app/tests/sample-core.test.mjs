import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleResponse,sampleNodeEnergy} from '../src/sample-core.js';
import {Observatory} from '../src/engine.js';

test('samples generate bounded changing orientations and localized node selections',()=>{
 const a=sampleResponse(1,{cpu:40},290),b=sampleResponse(2,{cpu:40},290);
 assert.notDeepEqual(a,b);assert.deepEqual(a,sampleResponse(1,{cpu:40},290));
 for(let i=0;i<500;i++){
  const p=sampleResponse(i,{cpu:i%101},290);
  assert.ok(Math.abs(p.yaw)<=.375&&Math.abs(p.pitch)<=.19&&Math.abs(p.roll)<=.12);
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
const core=()=>({metrics:{},config:{paused:false},nodes:Array.from({length:40},(_,i)=>({x:i/40,y:0,z:0})),sampleOrbit:{targetYaw:0,targetPitch:0,targetRoll:0},sampleBursts:[],lastSampleSequence:null,t:10});
test('the engine reacts once per new sample with no pointer or prior rendered frame',()=>{
 const engine=core();Observatory.prototype.setMetrics.call(engine,{sequence:1,cpu:65});
 assert.notEqual(engine.sampleOrbit.targetYaw,0);assert.ok(engine.sampleBursts.length>=3);
 const count=engine.sampleBursts.length,angle=engine.sampleOrbit.targetYaw;
 Observatory.prototype.setMetrics.call(engine,{sequence:1,cpu:65});
 assert.equal(engine.sampleBursts.length,count);assert.equal(engine.sampleOrbit.targetYaw,angle);
 Observatory.prototype.setMetrics.call(engine,{sequence:2,cpu:65});assert.ok(engine.sampleBursts.length>count);
});
test('paused samples stay current without accumulating light bursts or rotation',()=>{
 const engine=core();engine.config.paused=true;
 Observatory.prototype.setMetrics.call(engine,{sequence:7,cpu:90});
 assert.equal(engine.metrics.cpu,90);assert.equal(engine.sampleBursts.length,0);assert.equal(engine.sampleOrbit.targetYaw,0);
});
