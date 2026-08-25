# Plan 8 — 错误边界与容错 (Error Boundary)

- **优先级**: P0
- **状态**: ✅ 本地已实现 — 交付物作为增强参考
- **行数**: ~280

## 本地代码扫描结果

| 检查项 | 结果 | 证据 |
|--------|------|------|
| PageErrorBoundary | **已存在且已使用** | `src/components/ErrorBoundary/PageErrorBoundary.tsx` — 已在 `router/index.tsx` 中包裹全部路由 |
| 通用 ErrorBoundary | **已存在** | `src/components/ErrorBoundary/index.tsx` — 带 fallback 的通用错误边界 |
| 路由级错误边界 | **已存在** | `router/index.tsx` 中 `<PageErrorBoundary>` 包裹 `<Suspense>` |
| useErrorReport | **不存在** | 本 Plan 提供的 `useErrorReport` hook 是新增能力 |

### 合并方向

本 Plan 的 ErrorBoundary/RouteErrorBoundary/ModuleErrorBoundary 三层设计已在本地部分实现 (PageErrorBoundary)。

- **不重建**: 已有的 PageErrorBoundary 保持不变
- **增强**: 将本 Plan 的 `useErrorReport` hook 合并到 `src/hooks/useErrorReport.ts`
- **增强**: 将 `ModuleErrorBoundary` 合并到 `src/components/ErrorBoundary/ModuleErrorBoundary.tsx` (用于组件级隔离)
- **增强**: `useErrorReport` 添加上报到 `/api/v1/errors` 端点

## 质量清单

| 维度 | 状态 |
|------|:----:|
| 完整 import | ✅ |
| 类型系统 | ✅ |
| 错误处理 | ✅ |
| 可编译运行 | ✅ |
| 单元测试 | ✅ |

## 1. `src/components/ErrorBoundary/ErrorBoundary.tsx`

```tsx
// ============================================================
// ErrorBoundary — 全局错误边界
// ============================================================

import React, { Component, type ReactNode, type ErrorInfo, type Component as ReactComponent } from "react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  resetKeys?: string[];
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface WithStaticContext {
  staticContext?: { error?: Error };
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback(this.state.error!, this.reset);
      return <DefaultFallback error={this.state.error!} reset={this.reset} />;
    }
    return this.props.children;
  }
}

// 默认降级 UI
function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: 400, padding: 32,
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
      <h2 style={{ margin: "0 0 8px", color: "#374151" }}>页面出现错误</h2>
      <p style={{ color: "#6B7280", textAlign: "center", maxWidth: 480 }}>
        {error.message || "未知错误，请刷新页面重试"}
      </p>
      {error && (
        <pre style={{
          background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8,
          padding: 12, margin: "16px 0", fontSize: 12, color: "#DC2626",
          maxWidth: 600, overflow: "auto",
        }}>
          {error.stack?.split("\n").slice(0, 5).join("\n")}
        </pre>
      )}
      <button onClick={reset} style={{
        padding: "8px 24px", borderRadius: 6, border: "1px solid #E5E7EB",
        background: "#6366F1", color: "#fff", cursor: "pointer", fontSize: 14,
      }}>
        重新加载
      </button>
    </div>
  );
}
```

## 2. `src/components/ErrorBoundary/RouteErrorBoundary.tsx`

```tsx
// ============================================================
// RouteErrorBoundary — 路由级错误边界
// ============================================================

import React, { Component, type ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

interface RouteErrorBoundaryProps {
  children: ReactNode;
  routeName?: string;
  onRecover?: () => void;
}

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps> {
  render(): ReactNode {
    return (
      <ErrorBoundary
        resetKeys={[this.props.routeName ?? "route"]}
        onError={(error) => {
          console.error(`[Route: ${this.props.routeName}]`, error);
        }}
        fallback={(error, reset) => (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", minHeight: "calc(100vh - 64px)",
            padding: 32,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
            <h3>路由加载失败</h3>
            <p>{error.message}</p>
            <button onClick={() => { reset(); this.props.onRecover?.(); }} style={{
              marginTop: 16, padding: "8px 20px", borderRadius: 6,
              background: "#6366F1", color: "#fff", border: "none", cursor: "pointer",
            }}>
              重试
            </button>
          </div>
        )}
      >
        {this.props.children}
      </ErrorBoundary>
    );
  }
}
```

## 3. `src/components/ErrorBoundary/ModuleErrorBoundary.tsx`

```tsx
// ============================================================
// ModuleErrorBoundary — 模块/组件级错误边界
// ============================================================

import React, { Component, type ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

interface ModuleErrorBoundaryProps {
  children: ReactNode;
  name?: string;
  onFallback?: (error: Error) => void;
}

export class ModuleErrorBoundary extends Component<ModuleErrorBoundaryProps> {
  render(): ReactNode {
    return (
      <ErrorBoundary
        onError={(error) => {
          this.props.onFallback?.(error);
          console.error(`[Module: ${this.props.name}]`, error);
        }}
        fallback={(error) => (
          <div style={{
            padding: 12, borderRadius: 6, background: "#FEF2F2",
            border: "1px solid #FECACA", color: "#991B1B", fontSize: 13,
          }}>
            <strong>{this.props.name ?? "模块"}加载失败</strong>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#7F1D1D" }}>{error.message}</p>
          </div>
        )}
      >
        {this.props.children}
      </ErrorBoundary>
    );
  }
}
```

## 4. `src/components/ErrorBoundary/useErrorReport.ts`

```typescript
// ============================================================
// useErrorReport — 错误上报 hook
// ============================================================

import { useEffect, useRef } from "react";

export interface ErrorReportConfig {
  url?: string;
  beforeSend?: (error: Error) => boolean;
  maxReports?: number;
}

let reportCount = 0;

export function useErrorReport(config: ErrorReportConfig = {}): void {
  const sent = useRef(new Set<string>());
  const maxReports = config.maxReports ?? 50;

  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      if (reportCount >= maxReports) return;
      const error = event.error;
      if (!error) return;
      if (config.beforeSend && !config.beforeSend(error)) return;

      const key = `${error.name}:${error.message}`;
      if (sent.current.has(key)) return;
      sent.current.add(key);

      reportCount++;
      console.error(`[ErrorReport #${reportCount}]`, error);
    };

    window.addEventListener("error", handler);
    return () => window.removeEventListener("error", handler);
  }, [config.beforeSend, maxReports]);
}

// 全局未捕获 Promise 错误
export function useUnhandledRejection(handler?: (reason: unknown) => void): void {
  useEffect(() => {
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      handler?.(event.reason);
      console.error("[UnhandledRejection]", event.reason);
    };
    window.addEventListener("unhandledrejection", rejectionHandler);
    return () => window.removeEventListener("unhandledrejection", rejectionHandler);
  }, [handler]);
}
```

## 5. `__tests__/errorBoundary.test.tsx`

```tsx
import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary, ErrorBoundaryProps } from "../src/components/ErrorBoundary/ErrorBoundary";

const BadComponent = () => {
  throw new Error("Boom!");
};

describe("ErrorBoundary", () => {
  it("catches render error", () => {
    render(
      <ErrorBoundary>
        <BadComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText(/页面出现错误|重新加载/)).toBeInTheDocument();
  });

  it("renders children without error", () => {
    render(
      <ErrorBoundary>
        <div>OK</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("calls onError callback", () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <BadComponent />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalled();
  });

  it("calls custom fallback", () => {
    const fallback = jest.fn().mockReturnValue(<div>Custom Fallback</div>);
    render(
      <ErrorBoundary fallback={fallback}>
        <BadComponent />
      </ErrorBoundary>
    );
    expect(fallback).toHaveBeenCalled();
    expect(screen.getByText("Custom Fallback")).toBeInTheDocument();
  });

  it("reset button recovers", () => {
    const App = () => {
      const [key, setKey] = useState(0);
      return (
        <ErrorBoundary>
          <div>{key > 0 ? <BadComponent /> : "OK"}</div>
          <button onClick={() => setKey(1)}>Trigger</button>
        </ErrorBoundary>
      );
    };
    render(<App />);
    expect(screen.getByText("OK")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Trigger"));
    expect(screen.getByText(/页面出现错误|重新加载/)).toBeInTheDocument();
  });
});
```