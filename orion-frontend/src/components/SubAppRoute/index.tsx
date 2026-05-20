/**
 * Sub-App Route - 子应用路由组件
 *
 * 使用 wujie 微前端加载子应用
 */
import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import { getSubAppConfig, injectGlobalState } from '@/microfront/config';
import { startApp } from 'wujie';
import { Loading } from '@/components/Loading';

const SubAppRoute: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { user } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 根据路径确定子应用 key
  const getAppKeyFromPath = (): string | null => {
    const path = location.pathname;
    if (path.startsWith('/dba')) return 'dba';
    if (path.startsWith('/knowledge')) return 'knowledge';
    if (path.startsWith('/visor')) return 'visor';
    return null;
  };

  const appKey = getAppKeyFromPath();
  const appConfig = appKey ? getSubAppConfig(appKey) : null;

  useEffect(() => {
    if (!appKey || !appConfig) {
      console.warn(`[SubAppRoute] No app config for path: ${location.pathname}`);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    console.log(`[SubAppRoute] Starting ${appKey} with url: ${appConfig.url}`);
    console.log(`[SubAppRoute] Container: ${appConfig.container}, keepAlive: ${appConfig.keepAlive}`);

    // 确保容器 ID 正确
    const containerId = appConfig.container.replace('#', '');
    if (containerRef.current) {
      containerRef.current.id = containerId;
      console.log(`[SubAppRoute] Container element set: ${containerId}`);
    }

    // 注入全局状态并传递给子应用
    const token = localStorage.getItem('access_token');
    injectGlobalState({
      token,
      user,
      getApiBase: () => '/api/v1',
    });

    // 使用 wujie 启动子应用
    console.log(`[SubAppRoute] Calling startApp for ${appKey}`);
    startApp({
      name: appKey,
      url: appConfig.url,
      el: appConfig.container,
      alive: appConfig.keepAlive,
      props: {
        $orion: {
          token,
          user,
          getApiBase: () => '/api/v1',
        },
      },
    })
      .then(() => {
        if (!cancelled) {
          console.log(`[SubAppRoute] ${appKey} started successfully`);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(`[SubAppRoute] ${appKey} start error:`, err);
          setError(`Failed to load ${appKey}: ${err.message}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTimeout(() => setLoading(false), 500);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appKey, appConfig?.url]);

  if (!appKey || !appConfig) {
    return <Loading fullscreen />;
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'red' }}>{error}</p>
        <p>子应用: {appKey}</p>
        <p>URL: {appConfig.url}</p>
        <p>容器: {appConfig.container}</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', margin: 0, padding: 0, overflow: 'hidden' }}>
      <div
        ref={containerRef}
        id={appConfig.container.replace('#', '')}
        className="sub-app-container"
        style={{ height: '100vh', width: '100%', margin: 0, padding: 0 }}
      />
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', zIndex: 10 }}>
          <Loading />
        </div>
      )}
    </div>
  );
};

export default SubAppRoute;
