/**
 * SubAppRouteMF - 子应用路由组件 (Orion-MF 版本)
 *
 * 使用 orion-mf 微前端框架加载子应用
 * 支持 Shadow DOM 隔离、降级策略、错误边界
 */
import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { loadSubApp, getSubApp, destroySubApp } from '@orion-mf/core';
import type { SubAppInstance } from '@orion-mf/core';
import { useAppStore } from '@/stores/appStore';
import { getSubAppConfig } from '@/microfront/apps';
import { Loading } from '@/components/Loading';

// Orion-MF 配置接口
interface OrionMFConfig {
  key: string;
  name: string;
  remoteEntry: string;
  cssIsolation: 'shadow-dom' | 'scoped-css' | 'none';
}

const SubAppRouteMF: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const token = useAppStore((state) => state.token);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const instanceRef = useRef<SubAppInstance | null>(null);

  // 根据路径确定子应用 key
  const getAppKeyFromPath = (): string | null => {
    const path = location.pathname;
    if (path.startsWith('/dba')) return 'dba';
    if (path.startsWith('/knowledge')) return 'knowledge';
    if (path.startsWith('/visor')) return 'visor';
    return null;
  };

  const appKey = getAppKeyFromPath();

  // 获取 Orion-MF 配置
  const getMFConfig = useCallback((): OrionMFConfig | null => {
    if (!appKey) return null;

    // 尝试从配置获取
    const config = getSubAppConfig(appKey);
    if (config) {
      return {
        key: config.key,
        name: config.name,
        remoteEntry: config.url,
        cssIsolation: config.cssIsolation,
      };
    }

    // 配置未找到时返回 null，由调用方处理错误提示
    return null;
  }, [appKey]);

  const mfConfig = getMFConfig();

  // 清理函数
  const cleanup = useCallback(async () => {
    if (instanceRef.current) {
      try {
        await destroySubApp(appKey!);
        console.log(`[SubAppRouteMF] ${appKey} destroyed`);
      } catch (err) {
        console.warn(`[SubAppRouteMF] Failed to destroy ${appKey}:`, err);
      }
      instanceRef.current = null;
    }

    // 清理容器 DOM
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
  }, [appKey]);

  // 加载子应用
  useEffect(() => {
    if (!appKey) {
      setError('未识别的路径：请检查子应用配置');
      return;
    }

    if (!mfConfig) {
      setError(`子应用 "${appKey}" 未配置。请在管理页面（/console/subapps）添加配置。`);
      return;
    }

    // 防止重复加载
    if (loadedRef.current) return;
    loadedRef.current = true;

    let cancelled = false;

    const loadApp = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log(`[SubAppRouteMF] Loading ${appKey} from: ${mfConfig.remoteEntry}`);

        // 检查是否已加载（支持 keepAlive 场景）
        const existingInstance = getSubApp(appKey);
        if (existingInstance && containerRef.current) {
          console.log(`[SubAppRouteMF] Reusing existing instance for ${appKey}`);
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
          key: appKey,
          name: mfConfig.name,
          remoteEntry: mfConfig.remoteEntry,
          cssIsolation: mfConfig.cssIsolation,
          errorBoundary: true, // 启用错误边界
        });

        if (cancelled) return;

        console.log(`[SubAppRouteMF] ${appKey} loaded successfully:`, instance);

        // 将子应用根元素添加到容器
        if (containerRef.current && instance.root) {
          containerRef.current.appendChild(instance.root);
          instanceRef.current = instance;

          // 注入认证状态
          const token = localStorage.getItem('access_token');
          const tenantId = localStorage.getItem('tenant_id');

          // 子应用可以通过 window.$orion 访问主应用状态
          (window as unknown as { $orion?: { token: string; tenantId: string; user: { id: string; username: string; email?: string }; getApiBase: () => string } }).$orion = {
            token,
            tenantId,
            user,
            getApiBase: () => '/api/v1',
          };
        }
      } catch (err: any) {
        if (cancelled) return;

        console.error(`[SubAppRouteMF] ${appKey} load error:`, err);

        // 降级策略：加载失败时显示友好错误信息
        setError(`加载子应用 "${mfConfig.name}" 失败: ${err.message || '未知错误'}

可能原因：
- 网络连接问题
- 子应用服务未启动
- 资源加载超时

请检查：
1. 子应用服务是否正常运行
2. 网络连接是否正常
3. 控制台查看详细错误信息`);
      } finally {
        if (!cancelled) {
          // 延迟隐藏 loading，让用户看到加载过程
          setTimeout(() => setLoading(false), 300);
        }
      }
    };

    loadApp();

    // 组件卸载时清理
    return () => {
      cancelled = true;
      // 注意：keepAlive 场景下不销毁实例，由路由切换时手动管理
    };
  }, [appKey, mfConfig, user, location.pathname]);

  // 路径变化时重新加载
  useEffect(() => {
    // 当路径变化时，重置 loadedRef 允许重新加载
    loadedRef.current = false;
  }, [location.pathname]);

  if (!appKey || !mfConfig) {
    return <Loading fullscreen />;
  }

  if (error) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#fafafa',
        }}
      >
        <div
          style={{
            maxWidth: 500,
            padding: 24,
            background: 'white',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <h3 style={{ color: '#f5222d', marginBottom: 16 }}>子应用加载失败</h3>
          <pre
            style={{
              textAlign: 'left',
              fontSize: 14,
              color: '#595959',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: '#f5f5f5',
              padding: 12,
              borderRadius: 4,
              marginBottom: 16,
            }}
          >
            {error}
          </pre>
          <p style={{ color: '#8c8c8c', fontSize: 14 }}>
            子应用: <strong>{mfConfig.name}</strong>
          </p>
          <p style={{ color: '#8c8c8c', fontSize: 14 }}>
            入口: {mfConfig.remoteEntry}
          </p>
          <div style={{ marginTop: 24 }}>
            <button
              onClick={() => {
                setError(null);
                loadedRef.current = false;
                instanceRef.current = null;
                // 触发重新加载
                window.location.reload();
              }}
              style={{
                padding: '8px 24px',
                background: '#3370E6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              重新加载
            </button>
          </div>
        </div>
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
        id={`mf-${appKey}`}
        className="sub-app-container-mf"
        style={{
          height: '100vh',
          width: '100%',
          margin: 0,
          padding: 0,
        }}
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
          <Loading>{`正在加载 ${mfConfig.name}...`}</Loading>
        </div>
      )}
    </div>
  );
};

export default SubAppRouteMF;