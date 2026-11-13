export const scenes = Object.freeze([
  { id:'signal', name:'信号流场', en:'SIGNAL STREAM', caption:'连续传导 / 信号随本机负载分流' },
  { id:'fusion', name:'聚变引擎', en:'STELLAR FUSION', caption:'约束与释放 / 从计算中点燃恒星' },
  { id:'threebody', name:'三体引擎', en:'THREE BODY / CHAOS', caption:'三核捕获 / 混沌交会 / 引力弹射' },
  { id:'neural', name:'推理引擎', en:'LAYERED INFERENCE', caption:'多层推理 / 信号在神经元之间传播' },
]);
export function normalizeScene(mode, fallback='threebody') {
  if(mode==='flow'||mode==='blackhole') return 'signal';
  return scenes.some(scene=>scene.id===mode) ? mode : fallback;
}
