/**
 * constants.ts - PipelineEditor 常量
 * 抽取自 pipeline-svc/PipelineEditor/index.tsx (P2-9 Phase 102)
 */
export const STAGE_TYPES = [
  { label: '构建 (Build)', value: 'build', icon: '🔨' },
  { label: '测试 (Test)', value: 'test', icon: '🧪' },
  { label: '代码扫描 (Scan)', value: 'scan', icon: '🔍' },
  { label: '部署 (Deploy)', value: 'deploy', icon: '🚀' },
  { label: '通知 (Notify)', value: 'notify', icon: '📢' },
  { label: '自定义 (Custom)', value: 'custom', icon: '⚙️' },
  { label: '多架构构建 (Buildx)', value: 'buildx', icon: '🏷️' },
  { label: '容器运行 (Container)', value: 'container', icon: '📦' },
];
