const MiB = 1024 ** 2;
export const metricChannels = [
  { key: 'cpu', label: '处理器', color: [189, 227, 234], binding: '负载 → 流速' },
  { key: 'memory', label: '内存', color: [235, 208, 158], binding: '占用 → 密度与缓流' },
  { key: 'gpu', label: '显卡', color: [180, 148, 245], binding: '负载 → 流速与密度' },
  { key: 'download', label: '下载', color: [109, 209, 179], binding: '接收 → 流速与密度' },
  { key: 'upload', label: '上传', color: [244, 164, 146], binding: '发送 → 流速与密度' },
];
export function channelActivity(metrics = {}) {
  return metricChannels.map(({ key }) => {
    const value = metrics[key], available = Number.isFinite(value) && value >= 0;
    const level = available ? Math.min(1, key === 'download' || key === 'upload'
      ? Math.log1p(value / 1024) / Math.log1p(100 * MiB / 1024)
      : value / 100) : 0;
    return { available, level,
      speed: !available ? .12 : ({cpu:.45,memory:.15,gpu:.80,download:.35,upload:.25}[key]+level*{cpu:1.2,memory:.35,gpu:1.5,download:1.3,upload:.85}[key]),
      density: !available ? .06 : key === 'cpu' ? .55 : .10 + level * .90,
    };
  });
}
export function channelColor(index, accent) {
  return metricChannels[index].color.map((v, i) => Math.round(v * .8 + accent[i] * .2));
}
