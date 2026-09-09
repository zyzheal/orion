import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/providers/QueryProvider';
import { server } from './mocks/server';

// 全局为所有 render 自动包裹 QueryClientProvider，避免页面级测试
// 因缺少 Provider 触发 "No QueryClient set" 崩溃。
// 测试内若已自行包裹 Provider 属于嵌套 Provider，无害。
vi.mock('@testing-library/react', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@testing-library/react')>();
  return {
    ...mod,
    render: (ui: React.ReactElement, options?: any) =>
      mod.render(<QueryClientProvider client={getQueryClient()}>{ui}</QueryClientProvider>, options),
  };
});

// Force UTC timezone for consistent test results
process.env.TZ = 'UTC';

// 清除 QueryClient 缓存，避免不同测试间同 queryKey 互相污染
beforeEach(() => {
  getQueryClient().clear();
});

// 清理测试环境
afterEach(() => {
  cleanup();
});

// MSW 服务器生命周期
// onUnhandledRequest: 'bypass' — 未匹配的请求直接放行，避免海量 MSW 警告拖慢全量回归
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  clear: function () {
    this.store = {};
  },
  getItem: function (key: string) {
    return this.store[key] || null;
  },
  setItem: function (key: string, value: string) {
    this.store[key] = value;
  },
  removeItem: function (key: string) {
    delete this.store[key];
  },
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock matchMedia for Ant Design responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});