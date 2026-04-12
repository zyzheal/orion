/**
 * 子应用路由组件
 * 根据路由动态加载对应的子应用
 */
import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import { getSubAppConfig, eventBus } from '@/microfront';
import { Loading } from '@/components/Loading';

// 扩展 window 类型以包含 $orion
declare global {
  interface Window {
    $orion?: unknown;
  }
}

const SubAppRoute: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { theme } = useAppStore();

  // 根据路径确定子应用 key
  const getAppKeyFromPath = (): string | null => {
    const path = location.pathname;
    if (path.startsWith('/dba')) return 'dba';
    if (path.startsWith('/knowledge')) return 'knowledge';
    if (path.startsWith('/visor')) return 'visor';
    return null;
  };

  const appKey = getAppKeyFromPath();

  useEffect(() => {
    if (!appKey) {
      console.error('[SubAppRoute] Could not determine app key from path');
      return;
    }

    const appConfig = getSubAppConfig(appKey);
    if (!appConfig || !containerRef.current) {
      console.error(`[SubAppRoute] App "${appKey}" not found`);
      return;
    }

    // 设置容器
    const container = containerRef.current;
    container.id = `wujie-${appKey}`;

    // 注入全局状态到 window
    const globalState = {
      user: null,
      token: localStorage.getItem('access_token'),
      theme,
      sidebarCollapsed: false,
      breadcrumbs: [],
      permissions: [],
      getApiBase: () => import.meta.env.VITE_API_BASE_URL || '/api',
      eventBus: {
        emit: (event: string, data: unknown) => eventBus.emit(event, data),
        on: (event: string, handler: (data: unknown) => void) =>
          eventBus.on(event, handler),
        off: (event: string, handler: (data: unknown) => void) =>
          eventBus.off(event, handler),
      },
    };

    window.$orion = globalState;

    // 动态导入子应用
    const loadApp = async () => {
      try {
        // 使用 wujie 加载子应用
        const { startApp } = await import('wujie');

        await startApp({
          name: appKey,
          url: appConfig.url,
          el: container,
          props: {
            $orion: globalState,
          },
        });
      } catch (error) {
        console.error(`[SubAppRoute] Failed to load app "${appKey}":`, error);
      }
    };

    loadApp();

    // 清理函数
    return () => {
      // Keep-Alive 模式下不清理容器
      if (!appConfig.keepAlive) {
        if (container) {
          container.innerHTML = '';
        }
      }
    };
  }, [appKey, theme, location.pathname]);

  if (!appKey) {
    return <Loading fullscreen />;
  }

  return (
    <div
      ref={containerRef}
      className="sub-app-container"
      style={{
        height: '100%',
        width: '100%',
      }}
    />
  );
};

export default SubAppRoute;
