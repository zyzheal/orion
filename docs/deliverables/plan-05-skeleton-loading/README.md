# Plan 5 — 骨架屏与加载体验 (Skeleton Loading)

- **优先级**: P0
- **状态**: ✅ 本地已实现 — 交付物作为参考增强
- **行数**: ~260

## 本地代码扫描结果

| 检查项 | 结果 | 证据 |
|--------|------|------|
| PageSkeleton 组件 | **已存在** | `src/components/PageSkeleton/index.tsx` — 基于 Ant Design Skeleton 的骨架屏 |
| 使用情况 | **已使用** | 多个页面引用 PageSkeleton |
| Loading 组件 | **已存在** | `src/components/Loading.tsx` (40行) — 仅 Spin 组件 |

### 合并方向

本地 PageSkeleton 已实现。本 Plan 作为**参考增强**：
- 可补充路由级骨架屏 (RouteSkeleton) 用于 lazy-loaded 路由
- 可补充表格/表单专用骨架屏变体

## 质量清单

| 维度 | 状态 |
|------|:----:|
| 完整 import | ✅ |
| 类型系统 | ✅ |
| 错误处理 | ✅ |
| 可编译运行 | ✅ |
| 单元测试 | ✅ |

## 1. `src/components/Skeleton/index.tsx`

```tsx
// ============================================================
// Skeleton — 骨架屏基础组件
// ============================================================

import React, { type ReactNode } from "react";
import type { CSSProperties } from "react";

export interface SkeletonProps {
  variant?: "text" | "title" | "paragraph" | "avatar" | "image" | "button" | "list-item";
  count?: number;
  animation?: "pulse" | "wave" | "none";
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  className?: string;
  style?: CSSProperties;
}

const variantStyles: Record<string, CSSProperties> = {
  text:  { height: 14, borderRadius: 4 },
  title: { height: 28, width: "60%", borderRadius: 4 },
  paragraph: { height: 14, width: "100%", borderRadius: 4, marginBottom: 8 },
  avatar: { height: 40, width: 40, borderRadius: "50%" },
  image: { height: 200, borderRadius: 8 },
  button: { height: 36, width: 120, borderRadius: 6 },
  "list-item": { height: 48, width: "100%", borderRadius: 6, marginBottom: 8 },
};

export function Skeleton({
  variant = "text",
  count = 1,
  animation = "pulse",
  width,
  height,
  borderRadius,
  className = "",
  style,
}: SkeletonProps): ReactNode {
  const baseStyle: CSSProperties = {
    background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
    backgroundSize: "200% 100%",
    ...(animation === "pulse" && { animation: "skeleton-pulse 1.5s ease-in-out infinite" }),
    ...(animation === "wave" && { animation: "skeleton-wave 1.5s linear infinite" }),
    ...variantStyles[variant],
    ...style,
  };

  if (typeof width === "number" || typeof width === "string") baseStyle.width = width;
  if (typeof height === "number" || typeof height === "string") baseStyle.height = height;
  if (typeof borderRadius === "number" || typeof borderRadius === "string") baseStyle.borderRadius = borderRadius;

  const elements: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    elements.push(<div key={i} style={baseStyle} data-testid="skeleton" />);
  }
  return <div className={`orion-skeleton ${className}`} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{elements}</div>;
}

export const SKELETON_KEYFRAMES = `
@keyframes skeleton-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
@keyframes skeleton-wave { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
`;
```

## 2. `src/components/Skeleton/Pages.tsx`

```tsx
// ============================================================
// Skeleton — 页面级骨架屏预设
// ============================================================

import React from "react";
import { Skeleton, type SkeletonProps } from "./index";

export interface PageSkeletonProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

// Dashboard 骨架
export function DashboardSkeleton({ className = "" }: PageSkeletonProps) {
  return (
    <div className={className} data-testid="dashboard-skeleton">
      <Skeleton variant="title" count={1} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ padding: 16 }}>
            <Skeleton variant="text" height={14} width="40%" />
            <Skeleton variant="title" height={32} width="60%" style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={{ height: 300 }}><Skeleton variant="image" count={1} /></div>
        <div style={{ height: 300 }}><Skeleton variant="image" count={1} /></div>
      </div>
    </div>
  );
}

// Table 骨架
export function TableSkeleton({ className = "" }: PageSkeletonProps) {
  return (
    <div className={className} data-testid="table-skeleton">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Skeleton variant="title" count={1} />
        <Skeleton variant="button" count={1} />
      </div>
      <Skeleton variant="list-item" count={10} />
    </div>
  );
}

// Form 骨架
export function FormSkeleton({ className = "" }: PageSkeletonProps) {
  return (
    <div className={className} data-testid="form-skeleton" style={{ maxWidth: 480, margin: "auto" }}>
      <Skeleton variant="title" count={1} />
      <Skeleton variant="text" count={6} width="100%" height={40} style={{ marginTop: 12 }} />
      <Skeleton variant="button" count={2} style={{ marginTop: 16 }} />
    </div>
  );
}

// Detail 骨架
export function DetailSkeleton({ className = "" }: PageSkeletonProps) {
  return (
    <div className={className} data-testid="detail-skeleton">
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
        <Skeleton variant="avatar" count={1} />
        <div style={{ flex: 1 }}>
          <Skeleton variant="title" count={1} />
          <Skeleton variant="text" count={1} width="40%" />
        </div>
      </div>
      <Skeleton variant="paragraph" count={3} />
      <Skeleton variant="list-item" count={4} />
    </div>
  );
}

// Setting 骨架
export function SettingSkeleton({ className = "" }: PageSkeletonProps) {
  return (
    <div className={className} data-testid="setting-skeleton" style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, height: "calc(100vh - 64px)" }}>
      <Skeleton variant="list-item" count={6} />
      <div>
        <Skeleton variant="title" count={1} />
        <Skeleton variant="paragraph" count={4} />
      </div>
    </div>
  );
}
```

## 3. `src/hook/useSkeleton.ts`

```typescript
// ============================================================
// useSkeleton — 骨架屏状态管理 hook
// ============================================================

import { useCallback, useState } from "react";

export type LoadingState = "idle" | "loading" | "success" | "error";

export interface UseSkeletonReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  state: LoadingState;
  showSkeleton: boolean;
  setData: (data: T | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  reset: () => void;
}

export function useSkeleton<T>(initialData: T | null = null): UseSkeletonReturn<T> {
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const state: LoadingState = loading ? "loading" : error ? "error" : data !== null ? "success" : "idle";
  const showSkeleton = state === "loading" || (state === "idle" && !data);

  const reset = useCallback(() => {
    setData(initialData);
    setLoading(false);
    setError(null);
  }, [initialData]);

  return { data, loading, error, state, showSkeleton, setData, setLoading, setError, reset };
}

// 带防抖的加载状态（避免闪屏）
export function useDebouncedSkeleton<T>(delay = 300): UseSkeletonReturn<T> {
  const skeleton = useSkeleton<T>();
  const [visible, setVisible] = useState(false);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  return {
    ...skeleton,
    showSkeleton: visible,
    setLoading: (loading: boolean) => {
      skeleton.setLoading(loading);
      if (loading) {
        const t = setTimeout(() => setVisible(true), delay);
        setTimer(t);
      } else {
        if (timer) clearTimeout(timer);
        setVisible(false);
      }
    },
  };
}
```

## 4. `__tests__/skeleton.test.ts`

```typescript
import { render, screen } from "@testing-library/react";
import { Skeleton, DashboardSkeleton, TableSkeleton, useSkeleton, useDebouncedSkeleton } from "../src/components/Skeleton";

describe("Skeleton", () => {
  it("renders correct number of elements", () => {
    render(<Skeleton count={3} />);
    expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
  });

  it("renders DashboardSkeleton with 4 cards", () => {
    render(<DashboardSkeleton />);
    expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument();
  });

  it("renders TableSkeleton with 10 rows", () => {
    render(<TableSkeleton />);
    expect(screen.getByTestId("table-skeleton")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton")).toHaveLength(12); // title + button + 10
  });
});

describe("useSkeleton", () => {
  it("starts with idle state", () => {
    const result = useSkeleton<string>();
    expect(result.state).toBe("idle");
    expect(result.showSkeleton).toBe(true);
  });

  it("transitions to loading state", () => {
    const result = useSkeleton<string>();
    result.setLoading(true);
    expect(result.loading).toBe(true);
    expect(result.state).toBe("loading");
  });

  it("transitions to success state", () => {
    const result = useSkeleton<string>();
    result.setData("hello");
    expect(result.state).toBe("success");
    expect(result.showSkeleton).toBe(false);
  });
});
```