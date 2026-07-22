/**
 * 子应用认证策略：
 * - 微前端模式：使用主应用注入的 token，跳过登录
 * - 独立访问模式：检测无 token 时重定向到 Orion SSO 登录页
 * - SSO 登录成功后回调携带 token，子应用存储后正常渲染
 */

import router from '@/router';
import { useAppDispatch } from '@/store';
import { theme } from '@/themes';
import { ThemeProvider } from '@ctzhian/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useRoutes } from 'react-router-dom';

import { getApiV1License } from './request/pro/License';
import { setLicense } from './store/slices/config';

import '@ctzhian/tiptap/dist/index.css';

// ============================================
// SSO 配置
// ============================================
const SSO_CONFIG = {
  /** 主应用登录页地址（独立访问时跳转） */
  loginUrl: '/login',
  /** SSO 回调参数名 */
  tokenParam: 'sso_token',
  /** SSO 回调后存储到 localStorage 的 key */
  storageKey: 'orion_knowledge_token',
  /** 主应用 token 回退读取路径 */
  fallbackPaths: [
    () => (window as any)?.$orion?.token,
    () => (window as any)?.__orionToken,
    () => localStorage.getItem('access_token'), // 主应用同域部署时可共享
  ],
} as const;

/**
 * 尝试从多种渠道获取有效 token
 */
function resolveToken(): string {
  // 1. 子应用自身已存储的 token
  const stored = localStorage.getItem(SSO_CONFIG.storageKey);
  if (stored) return stored;

  // 2. 主应用通过 window 注入的 token
  for (const getter of SSO_CONFIG.fallbackPaths) {
    try {
      const token = getter();
      if (token) return token;
    } catch { /* ignore */ }
  }

  return '';
}

/**
 * 从 URL 查询参数中提取 SSO 回调 token
 */
function extractSSOToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get(SSO_CONFIG.tokenParam);
}

/**
 * 清除 URL 中的 SSO 参数（避免刷新时重复处理）
 */
function cleanSSOParams(): void {
  const params = new URLSearchParams(window.location.search);
  params.delete(SSO_CONFIG.tokenParam);
  const newSearch = params.toString();
  const newUrl = newSearch
    ? `${window.location.pathname}?${newSearch}${window.location.hash}`
    : `${window.location.pathname}${window.location.hash}`;
  window.history.replaceState({}, '', newUrl);
}

/**
 * 重定向到主应用 SSO 登录页
 */
function redirectToSSOLogin(returnUrl: string): void {
  const loginUrl = `${SSO_CONFIG.loginUrl}?redirect=${encodeURIComponent(returnUrl)}`;
  window.location.href = loginUrl;
}

function App() {
  const location = useLocation();
  const { pathname } = location;
  const dispatch = useAppDispatch();
  const routerView = useRoutes(router);
  const loginPage = pathname.includes('/login');
  const onlyAllowShareApi = loginPage;
  const isOrionChild = !!(window as any).__POWERED_BY_ORION__;

  // 用于避免 React StrictMode 下重复跳转
  const redirectingRef = useRef(false);
  const [tokenResolved, setTokenResolved] = useState(false);
  const token = resolveToken();

  // 调试日志
  useEffect(() => {
    console.log('[orion-knowledge App]', {
      pathname,
      fullUrl: window.location.href,
      basename: window.__BASENAME__,
      isOrionChild,
      hasStoredToken: !!localStorage.getItem(SSO_CONFIG.storageKey),
      hasOrionToken: !!(window as any)?.$orion?.token,
      resolvedToken: !!token,
    });
  }, [pathname]);

  // SSO 回调处理：检测 URL 中的 sso_token 参数
  useEffect(() => {
    const ssoToken = extractSSOToken();
    if (ssoToken) {
      localStorage.setItem(SSO_CONFIG.storageKey, ssoToken);
      cleanSSOParams();
      console.log('[orion-knowledge] SSO token received from callback');
      setTokenResolved(true);
    } else {
      setTokenResolved(true);
    }
  }, []);

  // License 检查（仅独立模式且有 token 时）
  useEffect(() => {
    if (token && !isOrionChild) {
      getApiV1License().then(res => {
        dispatch(setLicense(res));
      }).catch(() => {
        // license 接口不存在时静默失败
      });
    }
  }, [token, isOrionChild]);

  // 独立访问模式下的认证重定向
  const handleAuthRedirect = useCallback(() => {
    if (redirectingRef.current) return;
    if (!tokenResolved) return;

    // 子应用模式：不需要跳转
    if (isOrionChild) return;

    // 已有 token：正常渲染
    if (token) return;

    // 登录页：允许渲染
    if (loginPage || onlyAllowShareApi) return;

    // 无 token 且非登录页：跳转到 SSO 登录页
    redirectingRef.current = true;
    const returnUrl = window.location.pathname;
    console.log('[orion-knowledge] No token detected, redirecting to SSO login');
    redirectToSSOLogin(returnUrl);
  }, [tokenResolved, isOrionChild, token, loginPage, onlyAllowShareApi]);

  useEffect(() => {
    handleAuthRedirect();
  }, [handleAuthRedirect]);

  if (!token && !onlyAllowShareApi && !isOrionChild) {
    // 正在跳转中，渲染一个加载占位
    return null;
  }

  return (
    <ThemeProvider theme={theme} defaultMode='light' storageManager={null}>
      {routerView}
    </ThemeProvider>
  );
}

export default App;
