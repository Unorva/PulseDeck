// Softened Newtonian attraction. Coordinates are normalized to the field scale
// so the same interaction behaves consistently at desktop and preview sizes.
export function gravityAcceleration(point, wells, strength = 1) {
  let ax=0,ay=0;
  for(const well of wells){
    const dx=well.x-point.x,dy=well.y-point.y;
    const distance2=dx*dx+dy*dy+.0049;
    const force=.24*strength*(well.mass||1)/(distance2*Math.sqrt(distance2));
    ax+=dx*force;ay+=dy*force;
  }
  return {x:ax,y:ay};
}
export function stepGravityParticle(particle,wells,dt,strength=1){
  const steps=Math.max(1,Math.ceil(Math.min(dt,.12)/.012)),step=Math.min(dt,.12)/steps;
  for(let n=0;n<steps;n++){
    let nearest=Infinity,captured=-1;
    for(let i=0;i<wells.length;i++){
      const distance=Math.hypot(wells[i].x-particle.x,wells[i].y-particle.y);
      nearest=Math.min(nearest,distance);if(distance<(wells[i].radius||.058))captured=i;
    }
    if(captured>=0)return captured;
    const force=gravityAcceleration(particle,wells,strength);
    const damping=Math.exp(-step*(.035+Math.exp(-nearest*nearest/.045)*1.9));
    particle.vx=(particle.vx+(force.x+(nearest>.65?.10:0))*step)*damping;
    particle.vy=(particle.vy+force.y*step)*damping*Math.exp(-step*(nearest>.65?.24:0));
    const speed=Math.hypot(particle.vx,particle.vy);
    if(speed>3.0){particle.vx*=3.0/speed;particle.vy*=3.0/speed;}
    particle.x+=particle.vx*step;particle.y+=particle.vy*step;
  }
  return -1;
}
// Integrate a coherent family of streamlines through the same gravitational
// field. Staggered samples avoid synchronized respawn packets and keep the
// outlet, curved approach, and accretion region visually connected.
export function traceGravityStream(start,velocity,wells,strength=1){
  const state={...start,...velocity},points=[{x:state.x,y:state.y,time:0}],step=.014;
  let captured=-1;
  for(let i=1;i<=650;i++){
    captured=stepGravityParticle(state,wells,step,strength);
    points.push({x:state.x,y:state.y,time:i*step});
    if(captured>=0||state.x>2.75||Math.abs(state.y)>1.65)break;
  }
  return {points,captured,duration:Math.max(step,points[points.length-1].time)};
}
export function sampleGravityStream(stream,phase){
  if(stream.uniform){
    const f=Math.max(0,Math.min(1,phase))*(stream.uniform.length-1),i=Math.floor(f),mix=f-i;
    const a=stream.uniform[i],b=stream.uniform[Math.min(i+1,stream.uniform.length-1)];
    return {x:a.x+(b.x-a.x)*mix,y:a.y+(b.y-a.y)*mix};
  }
  if(stream.lengths){
    const distance=Math.max(0,Math.min(1,phase))*stream.length;
    let lo=0,hi=stream.lengths.length-1;
    while(lo+1<hi){const mid=(lo+hi)>>1;if(stream.lengths[mid]<distance)lo=mid;else hi=mid;}
    const a=stream.points[lo],b=stream.points[hi],mix=(distance-stream.lengths[lo])/Math.max(1e-9,stream.lengths[hi]-stream.lengths[lo]);
    return {x:a.x+(b.x-a.x)*mix,y:a.y+(b.y-a.y)*mix};
  }
  const f=Math.max(0,Math.min(.999999,phase))*(stream.points.length-1),index=Math.floor(f),mix=f-index;
  const a=stream.points[index],b=stream.points[Math.min(index+1,stream.points.length-1)];
  return {x:a.x+(b.x-a.x)*mix,y:a.y+(b.y-a.y)*mix};
}
export function createThreeBodies(){
  const scale=.42,velocity=Math.sqrt(.018/scale);
  return [
    {x:-.97000436*scale,y:.24308753*scale,vx:.466203685*velocity,vy:.43236573*velocity,mass:1},
    {x:.97000436*scale,y:-.24308753*scale,vx:.466203685*velocity,vy:.43236573*velocity,mass:1},
    {x:0,y:0,vx:-.93240737*velocity,vy:-.86473146*velocity,mass:1},
  ];
}
export function bodyAccelerations(bodies,strength=1){
  const result=bodies.map(()=>({x:0,y:0}));
  for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
    const dx=bodies[j].x-bodies[i].x,dy=bodies[j].y-bodies[i].y;
    const softened=dx*dx+dy*dy+.0036;
    const force=.018*strength/(softened*Math.sqrt(softened));
    result[i].x+=dx*force*bodies[j].mass;result[i].y+=dy*force*bodies[j].mass;
    result[j].x-=dx*force*bodies[i].mass;result[j].y-=dy*force*bodies[i].mass;
  }
  return result;
}
export const bodyBounds=Object.freeze({x:.66,y:.78});
export function constrainBody(body){
  const radius=Math.hypot(body.x/bodyBounds.x,body.y/bodyBounds.y);
  if(radius>1){
    body.x/=radius;body.y/=radius;
    const nx=body.x/bodyBounds.x**2,ny=body.y/bodyBounds.y**2,norm=nx*nx+ny*ny;
    const outward=body.vx*nx+body.vy*ny;
    if(outward>0){body.vx-=1.5*outward*nx/norm;body.vy-=1.5*outward*ny/norm;}
  }
  const speed=Math.hypot(body.vx,body.vy);
  if(speed>1.2){body.vx*=1.2/speed;body.vy*=1.2/speed;}
  return body;
}
function confinedAccelerations(bodies,strength){
  const forces=bodyAccelerations(bodies,strength);
  bodies.forEach((b,i)=>{
    const radius=Math.hypot(b.x/bodyBounds.x,b.y/bodyBounds.y);
    if(radius>.82){const pull=(radius-.82)*5;forces[i].x-=b.x*pull;forces[i].y-=b.y*pull;}
  });
  return forces;
}
export function stepThreeBodies(bodies,dt,strength=1,pinnedIndex=-1,pinnedPoint=null){
  const steps=Math.max(1,Math.ceil(Math.min(dt,.12)/.008)),h=Math.min(dt,.12)/steps;
  bodies.forEach(constrainBody);
  for(let step=0;step<steps;step++){
    if(pinnedIndex>=0&&pinnedPoint){bodies[pinnedIndex].x=pinnedPoint.x;bodies[pinnedIndex].y=pinnedPoint.y;bodies[pinnedIndex].vx=0;bodies[pinnedIndex].vy=0;constrainBody(bodies[pinnedIndex]);}
    const before=confinedAccelerations(bodies,strength);
    for(let i=0;i<bodies.length;i++){if(i===pinnedIndex)continue;const b=bodies[i];b.vx+=before[i].x*h*.5;b.vy+=before[i].y*h*.5;b.x+=b.vx*h;b.y+=b.vy*h;}
    const after=confinedAccelerations(bodies,strength);
    for(let i=0;i<bodies.length;i++){if(i===pinnedIndex)continue;bodies[i].vx+=after[i].x*h*.5;bodies[i].vy+=after[i].y*h*.5;constrainBody(bodies[i]);}
  }
  return bodies;
}
