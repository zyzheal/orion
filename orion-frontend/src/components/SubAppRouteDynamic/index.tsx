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
import { loadSubApp, getSubApp, destroySubApp, emitReady, emitError, orionBus, emitAuthState } from '@orion-mf/core';
import { injectAuthState } from '@/microfront/config';
import { Result, Button, Progress, Skeleton, Space, Tag } from 'antd';
import { CheckCircleOutlined, LoadingOutlined, CloudServerOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';

const SubAppRouteDynamic: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { subAppKey } = useParams<{ subAppKey: string }>();
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStage, setLoadStage] = useState('');
  const [isFromCache, setIsFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const instanceRef = useRef<SubAppInstance | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // 用 ref 记录当前正在加载的 subAppKey，避免 effect 因 setState 重复执行
  const loadingKeyRef = useRef<string | null>(null);

  const { apps, fetchEnabledApps } = useSubAppStore();

  const appConfig = useMemo(() => {
    if (!subAppKey) return null;
    const storeApp = apps.find((app) => app.key === subAppKey);
    if (storeApp && storeApp.status === 'enabled') {
      const isDev = import.meta.env.DEV;
      return {
        key: storeApp.key,
        name: storeApp.name,
        remoteEntry: isDev ? storeApp.entry_dev : storeApp.entry_prod,
        keepAlive: storeApp.keep_alive,
        enabled: storeApp.status === 'enabled',
        api_domain: storeApp.api_domain,
        cssIsolation: storeApp.css_isolation || 'shadow-dom',
        useShared: storeApp.use_shared || false,
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

  // 辅助函数：销毁子应用实例 + 清理容器 DOM
  const destroyInstanceAndContainer = useCallback(async () => {
    const key = instanceRef.current ? subAppKey : null;
    if (key) {
      try {
        await destroySubApp(key);
        console.log(`[SubAppRouteDynamic] ${key} destroyed`);
      } catch (err) {
        console.warn(`[SubAppRouteDynamic] Failed to destroy ${key}:`, err);
      }
      instanceRef.current = null;
    }
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
  }, [subAppKey]);

  // 主加载 effect — 只在 subAppKey 变化时执行一次
  useEffect(() => {
    // 白名单验证
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

    // 防止同一 subAppKey 重复加载
    if (loadingKeyRef.current === subAppKey) return;
    loadingKeyRef.current = subAppKey;

    let cancelled = false;
    setLoading(true);
    setLoadProgress(0);
    setLoadStage('正在初始化...');
    setError(null);
    setIsFromCache(false);

    console.log(`[SubAppRouteDynamic] Loading ${subAppKey} from: ${appConfig.remoteEntry}`);

    // 提前设置子应用的 basename 和 poweredBy 标志
    const basePath = `/${subAppKey}`;
    (window as unknown as { __BASENAME__?: string }).__BASENAME__ = basePath;
    (window as unknown as { __POWERED_BY_ORION__?: boolean }).__POWERED_BY_ORION__ = true;

    // 提前注入主应用 token
    const mainToken = localStorage.getItem('access_token');
    const mainUserStr = localStorage.getItem('user');
    let mainUser = { id: '', username: '' };
    if (mainUserStr) { try { mainUser = JSON.parse(mainUserStr); } catch { /* ignore */ } }
    (window as unknown as { $orion?: { token: string; tenantId: string; user: { id: string; username: string; email?: string } } }).$orion = {
      token: mainToken || '',
      tenantId: localStorage.getItem('tenant_id') || '',
      user: mainUser,
    };
    (window as unknown as { __orionToken?: string }).__orionToken = mainToken || '';

    // 注入子应用 API 路由域标识（供子应用参考，不用于 URL 重写）
    const apiDomain = appConfig?.api_domain || subAppKey;
    (window as unknown as { __SUBAPP_API_BASE__?: string }).__SUBAPP_API_BASE__ = `/api/v1/${apiDomain}`;
    console.log(`[SubAppRouteDynamic] Set __SUBAPP_API_BASE__ = /api/v1/${apiDomain}`);

    // 确保容器 ID 正确
    const containerId = `mf-${subAppKey}`;
    if (containerRef.current) {
      containerRef.current.id = containerId;
    }

    const loadStartTime = Date.now();

    const loadApp = async () => {
      try {
        setLoadProgress(10);
        setLoadStage('检查缓存...');

        // 检查是否已加载（支持 keepAlive 场景）
        const existingInstance = getSubApp(subAppKey);
        if (existingInstance && containerRef.current) {
          console.log(`[SubAppRouteDynamic] Reusing existing instance for ${subAppKey}`);
          instanceRef.current = existingInstance;
          setIsFromCache(true);
          setLoadProgress(100);
          setLoadStage('从缓存恢复');

          if (existingInstance.root && containerRef.current) {
            containerRef.current.appendChild(existingInstance.root);
          }

          // 缓存恢复也上报就绪
          emitReady(subAppKey, Date.now() - loadStartTime);

          setLoading(false);
          return;
        }

        // 加载新实例
        setLoadProgress(30);
        setLoadStage('正在加载子应用...');
        const basePath = `/${subAppKey}`;
        console.log(`[SubAppRouteDynamic] Calling loadSubApp with basename: ${basePath}`);
        const instance = await loadSubApp({
          key: subAppKey,
          name: appConfig.name,
          remoteEntry: appConfig.remoteEntry,
          cssIsolation: appConfig.cssIsolation,
          useShared: appConfig.useShared,
          errorBoundary: true,
          props: {
            basename: basePath,
          },
        });

        if (cancelled) return;

        setLoadProgress(70);
        setLoadStage('初始化沙箱...');

        console.log(`[SubAppRouteDynamic] ${subAppKey} loaded successfully`);

        setLoadProgress(90);
        setLoadStage('挂载组件...');

        if (containerRef.current && instance.root) {
          containerRef.current.appendChild(instance.root);
          instanceRef.current = instance;
          injectAuthState();

          // 上报子应用就绪
          const loadDuration = Date.now() - loadStartTime;
          emitReady(subAppKey, loadDuration);
        }

        setLoadProgress(100);
        setLoadStage('加载完成');
      } catch (err: any) {
        if (cancelled) return;
        console.error(`[SubAppRouteDynamic] ${subAppKey} load error:`, err);
        // 上报错误到 OrionBus
        emitError(subAppKey, err.message || '加载失败');
        setError(`加载子应用 "${appConfig.name}" 失败: ${err.message || '未知错误'}`);
      } finally {
        if (!cancelled) {
          const t1 = setTimeout(() => {
            setLoading(false);
            const t2 = setTimeout(() => {
              setLoadProgress(0);
              setLoadStage('');
            }, 300);
            timerRef.current.push(t2);
          }, 500);
          timerRef.current.push(t1);
        }
      }
    };

    loadApp();

    return () => {
      cancelled = true;
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [subAppKey, appConfig]);

  // 组件卸载/路由离开时清理
  useEffect(() => {
    return () => {
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
      loadingKeyRef.current = null;

      if (!appConfig?.keepAlive) {
        destroyInstanceAndContainer();
      }
    };
  }, [subAppKey, appConfig?.keepAlive, destroyInstanceAndContainer]);

  // OrionBus 认证状态监听：当主应用登录态变化时同步到子应用
  useEffect(() => {
    const unsubscribe = orionBus.on('orionAuth', (payload) => {
      const auth = payload.data;
      if (auth?.token && subAppKey) {
        console.log(`[SubAppRouteDynamic] Received auth update for ${subAppKey}`);
        window.$orion = {
          token: auth.token,
          tenantId: auth.tenantId || localStorage.getItem('tenant_id') || '',
          user: auth.user || { id: '', username: '' },
        };
        // 通过 window 事件通知子应用（子应用可通过 $orion 获取最新状态）
        window.dispatchEvent(new CustomEvent('orion-auth-change', { detail: auth }));
      }
    }, `subapp-${subAppKey}`);

    // 监听主应用退出登录
    const unsubscribeLogout = orionBus.on('orionLogout', () => {
      if (subAppKey) {
        console.log(`[SubAppRouteDynamic] Received logout for ${subAppKey}`);
        (window as unknown as { $orion?: undefined }).$orion = undefined;
        window.dispatchEvent(new CustomEvent('orion-logout'));
      }
    }, `subapp-${subAppKey}`);

    return () => {
      unsubscribe();
      unsubscribeLogout();
    };
  }, [subAppKey]);

  // 无效子应用处理
  if (!appConfig && subAppKey) {
    return (
      <div style={{ padding: 40, minHeight: '100vh', background: colors.neutral[100] }}>
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
      <div style={{ padding: 40, minHeight: '100vh', background: colors.neutral[100] }}>
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
      {/* 错误状态显示 */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: colors.light.bg.primary,
            zIndex: 20,
          }}
        >
          <Result
            status="error"
            title="加载失败"
            subTitle={error}
            extra={
              <Space>
                <Button onClick={() => { setError(null); loadingKeyRef.current = null; setLoading(true); }}>
                  重试
                </Button>
                <Button type="primary" onClick={() => navigate('/dashboard')}>
                  返回首页
                </Button>
              </Space>
            }
          />
        </div>
      )}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: colors.light.bg.primary,
            zIndex: 10,
            padding: 40,
          }}
        >
          <div style={{ width: '100%', maxWidth: 400 }}>
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
              <Skeleton.Avatar active size={48} shape="square" />
              <div style={{ flex: 1 }}>
                <Skeleton.Input active style={{ width: '60%', marginBottom: 8 }} />
                <Skeleton.Input active style={{ width: '40%' }} />
              </div>
            </div>
            <Skeleton active paragraph={{ rows: 6 }} />
            <div
              style={{
                marginTop: 24,
                padding: 16,
                background: colors.light.bg.secondary,
                borderRadius: 8,
              }}
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {isFromCache && (
                  <Tag icon={<CheckCircleOutlined />} color="success">
                    从缓存加载 (已保持会话)
                  </Tag>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Progress
                    percent={loadProgress}
                    status={loadProgress === 100 ? 'success' : 'active'}
                    strokeColor={colors.primary[500]}
                    size="small"
                    style={{ flex: 1, margin: 0 }}
                  />
                  <span style={{ color: colors.neutral[500], fontSize: 12, minWidth: 80 }}>
                    {loadStage}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.neutral[500] }}>
                  <CloudServerOutlined />
                  <span style={{ fontSize: 12 }}>
                    {appConfig?.name || subAppKey}
                  </span>
                </div>
              </Space>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubAppRouteDynamic;
