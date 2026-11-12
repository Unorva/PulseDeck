import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultPreferences,sanitizePreferences,mergePreferences} from '../shared/preferences.mjs';
test('desktop preferences use safe clean-presentation defaults',()=>{
 const p=sanitizePreferences();assert.equal(p.wallpaperEnabled,false);assert.equal(p.startAtLogin,false);assert.equal(p.showMetrics,false);assert.equal(p.showLabels,false);assert.equal(p.interactive,true);
});
test('untrusted preference fields cannot become commands or unbounded renderer input',()=>{
 const p=sanitizePreferences({particles:Infinity,speed:99,glow:-1,mode:'javascript:evil',selectedDisplay:';calc',fps:999,executable:'powershell',startAtLogin:'true'});
 assert.equal(p.particles,defaultPreferences.particles);assert.equal(p.speed,3);assert.equal(p.glow,0);assert.equal(p.mode,'threebody');assert.equal(p.selectedDisplay,'primary');assert.equal(p.fps,60);assert.equal(p.startAtLogin,false);assert.equal(p.executable,undefined);
});
test('slider changes preserve other settings and nested thresholds',()=>{
 const p=mergePreferences({...defaultPreferences,palette:'violet'},{speed:1.4,thresholds:{cpu:65}});
 assert.equal(p.palette,'violet');assert.equal(p.speed,1.4);assert.deepEqual(p.thresholds,{cpu:65,memory:85,gpu:90});assert.equal(defaultPreferences.thresholds.cpu,85);
});
test('display selection, frame caps, particle limits and boolean choices round trip',()=>{
 const p=sanitizePreferences({selectedDisplay:'2948528',fps:30,particles:21999,wallpaperEnabled:true,interactive:false});
 assert.equal(p.selectedDisplay,'2948528');assert.equal(p.fps,30);assert.equal(p.particles,22000);assert.equal(p.wallpaperEnabled,true);assert.equal(p.interactive,false);assert.deepEqual(sanitizePreferences(JSON.parse(JSON.stringify(p))),p);
});
test('malformed preference patches are rejected',()=>{assert.throws(()=>mergePreferences(defaultPreferences,[]),TypeError);assert.throws(()=>mergePreferences(defaultPreferences,null),TypeError);});
