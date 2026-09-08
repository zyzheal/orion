/**
 * constants.ts - TestMFLoader 常量定义
 * 抽取自 index.tsx (P2-9 Phase 229)
 */
export interface TestResult {
  appKey: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
  duration?: number;
}

export interface TestSubApp {
  key: string;
  name: string;
  remoteEntryDev: string;
  remoteEntryProd: string;
}

/**
 * 子应用配置（模拟从后端 API 获取）
 * 注意：这些是 Module Federation 远程入口 URL
 * 当前仅为测试配置，实际运行时从 SubAppStore 动态获取
 */
export const TEST_SUBAPPS: TestSubApp[] = [
  {
    key: 'dba',
    name: '数据库管理',
    // 开发环境：需要子应用配置 MF 并构建
    // 这里使用占位 URL，实际需要子应用完成 MF 改造
    remoteEntryDev: 'http://localhost:3030/orion-dba/remoteEntry.js',
    remoteEntryProd: '/orion-dba/remoteEntry.js',
  },
  {
    key: 'knowledge',
    name: '知识库',
    remoteEntryDev: 'http://localhost:5173/orion-knowledge/remoteEntry.js',
    remoteEntryProd: '/orion-knowledge/remoteEntry.js',
  },
  {
    key: 'visor',
    name: '监控中心',
    remoteEntryDev: 'http://localhost:3003/orion-visor/remoteEntry.js',
    remoteEntryProd: '/orion-visor/remoteEntry.js',
  },
];
