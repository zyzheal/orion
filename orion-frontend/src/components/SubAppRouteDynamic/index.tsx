// @ts-nocheck - @orion-mf/core 类型声明待完善
/**
 * SubAppRouteDynamic - 动态子应用路由组件
 *
 * Phase 4: 使用 Orion-MF 加载子应用
 * - 通过 useParams() 获取 subAppKey
 * - 从 SubAppStore 验证子应用是否已配置且启用
 * - 移除 Wujie 依赖，使用 Orion-MF
 */
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSubAppStore } from '@/stores/subappStore';
import { loadSubApp, getSubApp, destroySubApp } from '@orion-mf/core';
import { injectAuthState } from '@/microfront/config';
import { Loading } from '@/components/Loading';
import { Result, Button } from 'antd';

const SubAppRouteDynamic: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { subAppKey } = useParams<{ subAppKey: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const instanceRef = useRef<SubAppInstance | null>(null);

  // 从 SubAppStore 获取已配置的子应用列表
  const { apps, fetchEnabledApps } = useSubAppStore();

  // 获取当前环境的入口 URL（Orion-MF 格式）
  const appConfig = useMemo(() => {
    if (!subAppKey) return null;

    // 先尝试从 Store 获取
    const storeApp = apps.find((app) => app.key === subAppKey);
    if (storeApp && storeApp.status === 'enabled') {
      const isDev = import.meta.env.DEV;
      return {
        key: storeApp.key,
        name: storeApp.name,
        // Orion-MF 使用 remoteEntry
        remoteEntry: isDev ? storeApp.entry_dev : storeApp.entry_prod,
        keepAlive: storeApp.keep_alive,
        enabled: storeApp.status === 'enabled',
      };
    }

    return null;
  }, [subAppKey, apps]);

  // 初始化：确保子应用配置已加载
  useEffect(() => {
    if (apps.length === 0) {
      fetchEnabledApps();
    }
  }, [apps.length, fetchEnabledApps]);

  // 清理函数
  const cleanup = useRef(async () => {
    if (instanceRef.current && subAppKey) {
      try {
        await destroySubApp(subAppKey);
        console.log(`[SubAppRouteDynamic] ${subAppKey} destroyed`);
      } catch (err) {
        console.warn(`[SubAppRouteDynamic] Failed to destroy ${subAppKey}:`, err);
      }
      instanceRef.current = null;
    }

    // 清理容器 DOM
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
  });

  useEffect(() => {
    // 白名单验证：子应用必须已配置且启用
    if (!subAppKey) {
      setError('Missing sub-app key');
      setLoading(false);
      return;
    }

    if (!appConfig) {
      console.warn(`[SubAppRouteDynamic] Sub-app not found or disabled: ${subAppKey}`);
      setError(`子应用 "${subAppKey}" 未配置或已禁用`);
      setLoading(false);
      return;
    }

    // React.StrictMode 下 effect 会执行两次，使用 loadedRef 防止重复加载
    if (loadedRef.current) return;
    loadedRef.current = true;

    let cancelled = false;
    setLoading(true);
    setError(null);

    console.log(`[SubAppRouteDynamic] Loading ${subAppKey} from: ${appConfig.remoteEntry}`);

    // 确保容器 ID 正确
    const containerId = `mf-${subAppKey}`;
    if (containerRef.current) {
      containerRef.current.id = containerId;
    }

    const loadApp = async () => {
      try {
        // 检查是否已加载（支持 keepAlive 场景）
        const existingInstance = getSubApp(subAppKey);
        if (existingInstance && containerRef.current) {
          console.log(`[SubAppRouteDynamic] Reusing existing instance for ${subAppKey}`);
          instanceRef.current = existingInstance;

          // 如果存在且有 root 元素，直接挂载
          if (existingInstance.root && containerRef.current) {
            containerRef.current.appendChild(existingInstance.root);
          }

          setLoading(false);
          return;
        }

        // 加载新实例
        const instance = await loadSubApp({
          key: subAppKey,
          name: appConfig.name,
          remoteEntry: appConfig.remoteEntry,
          cssIsolation: 'shadow', // 使用 Shadow DOM 隔离
          errorBoundary: true, // 启用错误边界
        });

        if (cancelled) return;

        console.log(`[SubAppRouteDynamic] ${subAppKey} loaded successfully`);

        // 将子应用根元素添加到容器
        if (containerRef.current && instance.root) {
          containerRef.current.appendChild(instance.root);
          instanceRef.current = instance;

          // 注入认证状态到子应用
          injectAuthState();
        }
      } catch (err: any) {
        if (cancelled) return;

        console.error(`[SubAppRouteDynamic] ${subAppKey} load error:`, err);
        setError(`加载子应用 "${appConfig.name}" 失败: ${err.message || '未知错误'}`);
      } finally {
        if (!cancelled) {
          setTimeout(() => setLoading(false), 300);
        }
      }
    };

    loadApp();

    return () => {
      cancelled = true;
      // 注意：keepAlive 场景下不销毁实例
    };
  }, [subAppKey, appConfig]);

  // 无效子应用处理
  if (!appConfig && subAppKey) {
    return (
      <div style={{ padding: 40, minHeight: '100vh', background: '#f5f5f5' }}>
        <Result
          status="404"
          title="子应用未找到"
          subTitle={`子应用 "${subAppKey}" 未配置或已禁用。请联系管理员确认子应用配置。`}
          extra={
            <Button type="primary" onClick={() => navigate('/subapps')}>
              查看子应用列表
            </Button>
          }
        />
      </div>
    );
  }

  if (!subAppKey) {
    return (
      <div style={{ padding: 40, minHeight: '100vh', background: '#f5f5f5' }}>
        <Result
          status="warning"
          title="缺少子应用标识"
          subTitle="访问路径中缺少子应用标识，请检查 URL。"
          extra={
            <Button type="primary" onClick={() => navigate('/dashboard')}>
              返回首页
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        position: 'relative',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <div
        ref={containerRef}
        id={`mf-${subAppKey}`}
        className="sub-app-container"
        style={{ height: '100vh', width: '100%', margin: 0, padding: 0 }}
      />
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'white',
            zIndex: 10,
          }}
        >
          <Loading tip={`正在加载 ${appConfig?.name || subAppKey}...`} />
        </div>
      )}
    </div>
  );
};

export default SubAppRouteDynamic;