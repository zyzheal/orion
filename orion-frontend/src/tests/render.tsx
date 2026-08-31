/**
 * renderWithProviders — 页面测试统一渲染入口
 *
 * 页面迁移到 react-query 后，render(<Page />) 需要 QueryClientProvider 上下文，
 * 否则抛 "No QueryClient set, use QueryClientProvider to set one"。
 *
 * 说明：无法在 setup.ts 中全局打补丁 —— vitest 下 @testing-library/react 的
 * ESM 命名空间不可重定义（"Cannot redefine property: render"），故显式导出此 helper。
 * 约定：新增/迁移 react-query 页面测试时使用 renderWithProviders 替代 render。
 *
 * 每次调用创建独立 QueryClient，避免跨用例缓存污染；retry: false 避免拖慢用例。
 *
 * ⚠️ 返回值陷阱：本仓库锁定的 @testing-library/react 版本的 render **不返回
 * `screen`（也不返回 `user`）**。`const { screen } = render(...)` 会得到
 * `undefined`，随后 `screen.getByText(...)` 抛
 * "Cannot read properties of undefined (reading 'getByText')"。
 * 请从 '@testing-library/react' 导入模块级 `screen`：
 *   import { screen } from '@testing-library/react';
 * 键盘/点击操作用 `fireEvent`（同样不依赖 render 的返回值）。
 */
import type { ReactElement } from 'react';
import { render as rtlRender, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions,
): RenderResult {
  // 每次调用独立 client：避免跨用例缓存/状态污染
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 50, staleTime: 0, refetchOnWindowFocus: false },
    },
  });
  return rtlRender(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
    options,
  );
}
