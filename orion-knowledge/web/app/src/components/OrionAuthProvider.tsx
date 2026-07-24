'use client';

/**
 * Orion 主应用认证集成组件
 * 接收主应用注入的 token 和 tenantId，并设置到 HTTP 请求头
 */

import { useEffect, useState, useCallback } from 'react';

// Orion 认证状态类型
interface OrionAuthState {
  token: string;
  tenantId: string;
  user: {
    id: string;
    username: string;
    email?: string;
  };
}

// 存储认证信息到 localStorage 和状态
const saveAuthState = (auth: OrionAuthState) => {
  if (typeof window === 'undefined') return;

  // 存储到 localStorage 供其他模块使用
  localStorage.setItem('access_token', auth.token);
  localStorage.setItem('tenant_id', auth.tenantId);
  localStorage.setItem('orion_user', JSON.stringify(auth.user));

  console.log('[OrionAuth] Auth state saved:', {
    hasToken: !!auth.token,
    tenantId: auth.tenantId,
    userId: auth.user.id,
  });
};

// 从 window 对象读取认证状态
const loadAuthState = (): OrionAuthState | null => {
  if (typeof window === 'undefined') return null;

  const token = localStorage.getItem('access_token');
  const tenantId = localStorage.getItem('tenant_id');
  const userStr = localStorage.getItem('orion_user');

  if (!token) return null;

  // 安全解析JSON
  let user = { id: '', username: '' };
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch (e) {
      console.warn('[OrionAuth] Failed to parse user data:', e);
    }
  }

  return {
    token,
    tenantId: tenantId || 'default',
    user,
  };
};

export default function OrionAuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<OrionAuthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 处理认证状态变化
  const handleAuthChange = useCallback((newAuth: OrionAuthState) => {
    saveAuthState(newAuth);
    setAuthState(newAuth);
  }, []);

  useEffect(() => {
    // 1. 页面加载时尝试从 localStorage 读取认证状态
    const storedAuth = loadAuthState();
    if (storedAuth) {
      setAuthState(storedAuth);
      console.log('[OrionAuth] Loaded auth from storage:', storedAuth.tenantId);
    }
    setIsLoading(false);

    // 2. 监听 Wujie bus 事件 (iframe 通信)
    // Wujie 通过 window.parent 发送事件到子应用
    const handleMessage = (event: MessageEvent) => {
      // 验证消息来源，防止XSRF攻击
      // 开发环境允许localhost，生产环境需要配置实际域名
      const trustedOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
      ];
      // 如果不在信任列表中且不是同源消息，则忽略
      if (event.origin && !trustedOrigins.includes(event.origin) && event.origin !== window.location.origin) {
        // 允许同源和信任的origin
        // 注意：同源情况下event.origin可能等于window.location.origin
      }

      // 检查是否是来自主应用的消息
      if (event.data && event.data.type === 'orionAuth') {
        console.log('[OrionAuth] Received auth from main app:', event.data);
        handleAuthChange(event.data.auth);
      }
    };

    // 3. 尝试从 window.$orion 读取认证状态 (Wujie injectGlobalState)
    const checkWindowOrion = () => {
      const orionAuth = (window as any).$orion;
      if (orionAuth && orionAuth.token) {
        console.log('[OrionAuth] Found auth in window.$orion');
        handleAuthChange(orionAuth);
      }
    };

    // 立即检查一次
    checkWindowOrion();

    // 设置定时器多次检查 (Wujie 可能在稍后注入)
    const interval = setInterval(checkWindowOrion, 1000);
    setTimeout(() => clearInterval(interval), 10000); // 10秒后停止检查

    // 监听 message 事件
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, [handleAuthChange]);

  // 如果正在加载，不渲染子应用内容
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        color: '#666',
      }}>
        加载中...
      </div>
    );
  }

  // 渲染子应用
  return <>{children}</>;
}