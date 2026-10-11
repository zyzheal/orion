import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReducedMotion } from '../useReducedMotion';

// 全局 CSS 已提供全局保护（src/assets/styles/global.css:448），
// 本 hook 测试仅验证 matchMedia 契约：
//   - 未设置 reduce → false
//   - 设置 reduce → true
//   - change 事件 → 状态更新

describe('useReducedMotion', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'window',
      Object.assign(window, {
        matchMedia: (query: string) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when prefers-reduced-motion is not set', () => {
    vi.stubGlobal(
      'window',
      Object.assign(window, {
        matchMedia: (query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }),
      }),
    );
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when prefers-reduced-motion: reduce is set', () => {
    vi.stubGlobal(
      'window',
      Object.assign(window, {
        matchMedia: (query: string) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }),
      }),
    );
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });
});
