import {gravityAcceleration,sampleGravityStream} from './gravity-field.js';
import {bezier} from './core-field.js';

// Shared gravity bends the approach. Guidance keeps each signal near its
// assigned black hole before outgoing signals fan into their metric card.
// Only moving particles draw these paths; there are no connector-line strokes.
export function traceMetricTransport(start,velocity,wells,target,strength=1,wellIndex=0,side=1){
  const well=wells[wellIndex],radius=well.radius||.058;
  const clearance=Math.max(.12,radius*1.45),entry={x:well.x-clearance*1.3,y:well.y+side*clearance};
  const state={...start,...velocity},points=[{...start}],step=.014;
  let closest=Infinity,captured=-1;
  for(let i=0;i<420;i++){
    const dx=entry.x-state.x,dy=entry.y-state.y,distance=Math.hypot(dx,dy);
    if(distance<.035)break;
    const force=gravityAcceleration(state,wells,strength);
    const speed=1.05*Math.min(1,distance/.16);
    state.vx+=(force.x*.14+(dx/Math.max(distance,.001)*speed-state.vx)*7)*step;
    state.vy+=(force.y*.14+(dy/Math.max(distance,.001)*speed-state.vy)*7)*step;
    const norm=Math.hypot(state.vx,state.vy);if(norm>1.6){state.vx*=1.6/norm;state.vy*=1.6/norm;}
    state.x+=state.vx*step;state.y+=state.vy*step;
    points.push({x:state.x,y:state.y});
    closest=Math.min(closest,Math.hypot(state.x-well.x,state.y-well.y));
    for(let j=0;j<wells.length;j++)if(Math.hypot(state.x-wells[j].x,state.y-wells[j].y)<(wells[j].radius||.058))captured=j;
    if(captured>=0)break;
  }
  const last=points[points.length-1],exit={x:well.x+clearance*1.3,y:well.y+side*clearance*.65};
  const controlA=[last.x+clearance*.7,last.y+side*clearance*.4];
  const controlB=[well.x+clearance*.3,well.y+side*clearance*1.4];
  for(let i=1;i<=35;i++){
    const [x,y]=bezier([last.x,last.y],controlA,controlB,[exit.x,exit.y],i/35);
    points.push({x,y});closest=Math.min(closest,Math.hypot(x-well.x,y-well.y));
  }
  return routeToTarget(points,target,{captured,closest,join:points.length-1});
}
export function routeToTarget(approach,target,metadata={}){
  const points=approach.map(p=>({...p})),exit=points[points.length-1];
  const before=points[Math.max(0,points.length-4)];
  const dx=exit.x-before.x,dy=exit.y-before.y,length=Math.hypot(dx,dy)||1;
  const reach=Math.max(.16,target.x-exit.x);
  const control=[exit.x+Math.max(.10,dx/length*.28),exit.y+dy/length*.28];
  const merge=[target.x-reach*.35,target.y];
  for(let i=1;i<=100;i++){
    const [x,y]=bezier([exit.x,exit.y],control,merge,[target.x,target.y],i/100);
    points.push({x,y});
  }
  const lengths=[0];
  for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
  const stream={...metadata,points,lengths,length:lengths[lengths.length-1]};
  stream.uniform=Array.from({length:256},(_,i)=>sampleGravityStream(stream,i/255));
  return stream;
}
