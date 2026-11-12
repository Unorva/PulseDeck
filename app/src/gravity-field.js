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
      nearest=Math.min(nearest,distance);if(distance<.034)captured=i;
    }
    if(captured>=0)return captured;
    const force=gravityAcceleration(particle,wells,strength);
    const damping=Math.exp(-step*(.035+Math.exp(-nearest*nearest/.045)*1.9));
    particle.vx=(particle.vx+force.x*step)*damping;
    particle.vy=(particle.vy+force.y*step)*damping;
    const speed=Math.hypot(particle.vx,particle.vy);
    if(speed>4.5){particle.vx*=4.5/speed;particle.vy*=4.5/speed;}
    particle.x+=particle.vx*step;particle.y+=particle.vy*step;
  }
  return -1;
}
