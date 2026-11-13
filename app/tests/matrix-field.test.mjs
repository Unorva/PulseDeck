import test from 'node:test';
import assert from 'node:assert/strict';
import {matrixLayout,matrixNode,matrixRoute,matrixLabels} from '../src/matrix-field.js';
import {sampleGravityStream} from '../src/gravity-field.js';
test('matrix signals pass through six node columns before entering their own card',()=>{
 const core={x:350,y:300,radius:220},field={x:950,y:300,width:650,scale:220};
 const anchors=Array.from({length:5},(_,i)=>({x:1260,y:120+i*90}));
 const layout=matrixLayout(core,field,anchors,1440,650);assert.equal(matrixLabels.length,6);
 assert.ok(layout.left>core.x+core.radius&&layout.right<anchors[0].x);
 for(let band=0;band<5;band++){
  const target={x:(anchors[band].x-field.x)/field.scale,y:(anchors[band].y-field.y)/field.scale};
  const route=matrixRoute({band,v:.4,w:.3,a:1},5,core,field,layout,target);
  const end=sampleGravityStream(route,1);assert.ok(Math.hypot(end.x-target.x,end.y-target.y)<1e-9);
  assert.equal(route.rows.length,6);
  for(let column=0;column<6;column++){
   const p=matrixNode(layout,column,route.rows[column]);
   assert.ok(route.points.some(q=>Math.hypot(q.x-(p.x-field.x)/field.scale,q.y-(p.y-field.y)/field.scale)<1e-9));
  }
 }
});
