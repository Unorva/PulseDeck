import {emissionPort,bezier} from './core-field.js';
import {routeToTarget} from './metric-transport.js';
export const matrixLabels=['输入编码','注意力','并行分支','层级路由','汇合','输出'];
export function matrixLayout(core,field,anchors,width,height){
 const left=Math.max(core.x+core.radius*1.25,width*.49);
 const right=Math.max(left+70,Math.min(width*.84,(anchors[0]?.x||width*.91)-55));
 const top=Math.max(height*.16,anchors[0]?.y||height*.22),bottom=Math.min(height*.84,anchors[4]?.y||height*.76);
 return {left,right,top,bottom,columns:6,rows:7};
}
export function matrixNode(layout,column,row){return {x:layout.left+(layout.right-layout.left)*column/5,y:layout.top+(layout.bottom-layout.top)*row/6};}
export function matrixRoute(p,time,core,field,layout,target){
 const port=emissionPort(p,time,core),start={x:port.x,y:port.y};
 const launch={x:start.x+Math.cos(port.angle)*core.radius*.22,y:start.y+Math.sin(port.angle)*core.radius*.22};
 const points=[start];for(let i=1;i<=12;i++)points.push({x:start.x+(launch.x-start.x)*i/12,y:start.y+(launch.y-start.y)*i/12});
 const input=matrixNode(layout,0,Math.round(p.band*6/4));
 for(let i=1;i<=24;i++){const [x,y]=bezier([launch.x,launch.y],[launch.x+20,launch.y],[input.x-25,input.y],[input.x,input.y],i/24);points.push({x,y});}
 const lane=Math.floor(p.v*24),rows=[Math.round(p.band*6/4)];
 for(let column=1;column<=5;column++){
  const row=column===5?Math.round(p.band*6/4):(lane*3+p.band*2+column*(lane%3+1))%7;rows.push(row);
  const a=points[points.length-1],b=matrixNode(layout,column,row);
  for(let i=1;i<=10;i++)points.push({x:a.x+(b.x-a.x)*i/10,y:a.y+(b.y-a.y)*i/10});
 }
 const normalized=points.map(p=>({x:(p.x-field.x)/field.scale,y:(p.y-field.y)/field.scale}));
 return {...routeToTarget(normalized,target),rows};
}
