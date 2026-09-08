/**
 * useTestMFLoaderState.ts - TestMFLoader 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 229)
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { TEST_SUBAPPS, type TestResult, type TestSubApp } from './constants';

// 动态加载 orion-mf
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mfLoadSubApp: ((config: any) => Promise<any>) | null = null;

// 尝试从多个位置加载
const tryLoadOrionMF = async () => {
  if (mfLoadSubApp) return;

  try {
    // 尝试从 @orion-mf/core 导入
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - 动态导入
    const mod = await import('@orion-mf/core');
    mfLoadSubApp = mod.loadSubApp;
  } catch (_e1) {
    // 降级方案：在开发环境手动挂载到 window 以供测试
    if (import.meta.env.DEV) {
      // 开发环境手动挂载 window.OrionMF 供测试
      void console.debug('OrionMF not found, relying on dev environment mount');
    }
  }
};

export function useTestMFLoaderState() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  // 初始化时加载 orion-mf
  useEffect(() => {
    void tryLoadOrionMF().then(() => {
      if (!mfLoadSubApp) {
        message.error('无法加载 orion-mf 框架，请检查依赖');
      }
    });
  }, []);

  // 根据环境选择入口
  const isDev = import.meta.env.DEV;
  const getRemoteEntry = useCallback(
    (app: TestSubApp) => (isDev ? app.remoteEntryDev : app.remoteEntryProd),
    [isDev]
  );

  // 测试加载子应用
  const handleLoadSubApp = useCallback(
    async (appKey: string) => {
      const app = TEST_SUBAPPS.find((a) => a.key === appKey);
      if (!app) return;

      // 检查 orion-mf 是否已加载
      if (!mfLoadSubApp) {
        message.warning('orion-mf 框架未加载，请刷新页面重试');
        return;
      }

      const startTime = Date.now();
      setLoading(appKey);
      setTestResults((prev) => [...prev, { appKey, status: 'loading' }]);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const instance = await mfLoadSubApp!({
          key: app.key,
          name: app.name,
          remoteEntry: getRemoteEntry(app),
          // 使用 shadow DOM 隔离
          cssIsolation: 'shadow',
          // 启用错误边界
          errorBoundary: true,
        });

        // 挂载到容器
        if (containerRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          containerRef.current.appendChild(instance.root as HTMLElement);
        }

        const duration = Date.now() - startTime;
        setTestResults((prev) =>
          prev.map((r) => (r.appKey === appKey ? { ...r, status: 'success', duration } : r))
        );
        message.success(`${app.name} 加载成功 (${duration}ms)`);
      } catch (error) {
        console.error(`[TestMF] ${appKey} load error:`, error);
        const duration = Date.now() - startTime;
        setTestResults((prev) =>
          prev.map((r) =>
            r.appKey === appKey
              ? {
                  ...r,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Unknown error',
                  duration,
                }
              : r
          )
        );
        message.error(`${app.name} 加载失败: ${error}`);
      } finally {
        setLoading(null);
      }
    },
    [getRemoteEntry]
  );

  // 清理容器
  const handleClear = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    setTestResults([]);
    message.info('已清理容器');
  }, []);

  return {
    containerRef,
    testResults,
    loading,
    handleLoadSubApp,
    handleClear,
  };
}
