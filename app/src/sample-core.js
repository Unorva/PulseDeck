const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function sampleResponse(sequence,metrics={},nodeCount=290){
  let seed=(sequence*2654435761+0x85ebca6b)>>>0;
  const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
  const load=Math.max(...['cpu','memory','gpu'].map(k=>Number.isFinite(metrics[k])?clamp(metrics[k]/100,0,1):0));
  return {yaw:(random()-.5)*1.5,pitch:(random()-.5)*.8,roll:(random()-.5)*.5,
    strength:.48+load*.45,indices:Array.from({length:3+Math.floor(load*3)},()=>Math.floor(random()*nodeCount))};
}
export function sampleNodeEnergy(node,bursts,time){
  let energy=0;
  for(const burst of bursts){
    const age=time-burst.time;if(age<0||age>3)continue;
    const distance=Math.hypot(node.x-burst.x,node.y-burst.y,node.z-burst.z);
    const front=age*.95;
    energy+=Math.exp(-(((distance-front)/.17)**2))*Math.exp(-age*1.0)*burst.strength;
  }
  return Math.min(1.5,energy);
}
