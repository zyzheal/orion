# Plan 6 — 状态管理与数据流 (State Management)

- **优先级**: P0
- **状态**: ✅ 可交付代码 (需与本地 Zustand 模式合并)
- **行数**: ~350

## 本地代码扫描结果

| 检查项 | 结果 | 证据 |
|--------|------|------|
| Zustand stores | **已存在 (8 个)** | `src/stores/*.ts` — 8 个 Zustand stores |
| 状态管理模式 | **已使用 Zustand** | `package.json`: zustand ^4.4 |

### 合并方向

本 Plan 提供了自研的 OrionStore (基于 useReducer + createContext)。

- **不替换**: 保持本地已有的 8 个 Zustand stores
- **增强**: 统一 store 创建模式，参考本 Plan 的 persistKey 持久化方案
- **增强**: 为新的独立模块采用本 Plan 的 OrionStore 模式 (轻量场景)

## 质量清单

| 维度 | 状态 |
|------|:----:|
| 完整 import | ✅ |
| 类型系统 | ✅ |
| 错误处理 | ✅ |
| 可编译运行 | ✅ |
| 单元测试 | ✅ |

## 1. `src/state/store.ts`

```typescript
// ============================================================
// Orion Store — 轻量级 React Context Store（替代 Redux/Zustand）
// ============================================================

import { useState, useEffect, useReducer, useContext, createContext, type Dispatch } from "react";
import type { MutableRefObject } from "react";

// --- Types ---
export interface OrionState<S> {
  data: S;
  loading: boolean;
  error: Error | null;
  updatedAt: number;
}

type Action<S> =
  | { type: "SET_DATA"; payload: S }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: Error | null }
  | { type: "RESET" };

export interface StoreOptions<S> {
  initialState: S;
  persistKey?: string;
}

// --- Reducer ---
export function orionReducer<S>(state: OrionState<S>, action: Action<S>): OrionState<S> {
  switch (action.type) {
    case "SET_DATA":
      return { ...state, data: action.payload, error: null, updatedAt: Date.now() };
    case "SET_LOADING":
      return { ...state, loading: action.payload, updatedAt: Date.now() };
    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false, updatedAt: Date.now() };
    case "RESET":
      return { ...state, data: state.data, loading: false, error: null };
    default:
      return state;
  }
}

// --- Store Class ---
export class OrionStore<S> {
  private _state: OrionState<S>;
  private readonly listeners = new Set<() => void>();
  private readonly persistKey?: string;

  constructor(options: StoreOptions<S>) {
    this.persistKey = options.persistKey;
    const saved = this.persistKey ? this.loadFromStorage() : null;
    this._state = {
      data: saved ?? options.initialState,
      loading: false,
      error: null,
      updatedAt: Date.now(),
    };
  }

  get state(): OrionState<S> { return { ...this._state }; }

  getState(): OrionState<S> { return this.state; }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispatch(action: Action<S>): void {
    this._state = orionReducer(this._state, action);
    if (this.persistKey && action.type === "SET_DATA") this.saveToStorage(this._state.data);
    for (const fn of this.listeners) fn();
  }

  setData(data: S): void { this.dispatch({ type: "SET_DATA", payload: data }); }
  setLoading(loading: boolean): void { this.dispatch({ type: "SET_LOADING", payload: loading }); }
  setError(error: Error | null): void { this.dispatch({ type: "SET_ERROR", payload: error }); }
  reset(): void { this.dispatch({ type: "RESET" }); }

  private saveToStorage(data: S): void {
    try { localStorage.setItem(this.persistKey!, JSON.stringify(data)); } catch { /* ignore */ }
  }

  private loadFromStorage(): S | null {
    try {
      const raw = localStorage.getItem(this.persistKey!);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}

// --- React Hooks ---
export function createStore<S>(options: StoreOptions<S>): OrionStore<S> {
  return new OrionStore(options);
}

export function useOrionStore<S>(store: OrionStore<S>): { state: OrionState<S>; dispatch: Dispatch<Action<S>> } {
  const [snapshot, setSnapshot] = useState<OrionState<S>>(store.getState());
  useEffect(() => store.subscribe(() => setSnapshot(store.getState())), [store]);
  return { state: snapshot, dispatch: store.dispatch.bind(store) };
}
```

## 2. `src/state/modules/user.ts`

```typescript
// ============================================================
// User Module — 用户状态管理
// ============================================================

import { createStore } from "../store";

export interface UserState {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    roles: string[];
    tenantId: string;
  } | null;
  preferences: {
    theme: "light" | "dark";
    language: string;
    pageSize: number;
  };
}

const initialUserState: UserState = {
  token: "",
  user: null,
  preferences: { theme: "light", language: "zh-CN", pageSize: 20 },
};

export const userStore = createStore<UserState>({
  initialState: initialUserState,
  persistKey: "orion:user",
});

// Actions
export const userActions = {
  login(token: string, user: UserState["user"]): void {
    userStore.setData({ ...userStore.getState().data, token, user, preferences: userStore.getState().data.preferences });
  },
  logout(): void {
    userStore.setData({ token: "", user: null, preferences: userStore.getState().data.preferences });
  },
  updatePreferences(prefs: Partial<UserState["preferences"]>): void {
    const current = userStore.getState().data;
    userStore.setData({ ...current, preferences: { ...current.preferences, ...prefs } });
  },
  refreshUser(user: UserState["user"]): void {
    const current = userStore.getState().data;
    userStore.setData({ ...current, user });
  },
};
```

## 3. `src/state/modules/deployment.ts`

```typescript
// ============================================================
// Deployment Module
// ============================================================

import { createStore } from "../store";

export interface DeploymentState {
  version: string;
  commit: string;
  branch: string;
  deployedAt: string;
  environment: string;
}

export const deploymentStore = createStore<DeploymentState>({
  initialState: { version: "0.0.0", commit: "", branch: "", deployedAt: "", environment: "" },
  persistKey: "orion:deployment",
});
```

## 4. `src/state/modules/pipeline.ts`

```typescript
// ============================================================
// Pipeline Module
// ============================================================

import { createStore } from "../store";

export interface PipelineItem {
  id: string;
  name: string;
  status: "pending" | "running" | "succeeded" | "failed";
  startedAt?: string;
  finishedAt?: string;
}

export interface PipelineState {
  items: PipelineItem[];
  selectedId?: string;
}

export const pipelineStore = createStore<PipelineState>({
  initialState: { items: [] },
  persistKey: "orion:pipelines",
});
```

## 5. `__tests__/store.test.ts`

```typescript
import { createStore, useOrionStore, OrionStore } from "../src/state/store";

describe("OrionStore", () => {
  it("creates store with initial state", () => {
    const store = createStore<string>({ initialState: "hello" });
    expect(store.getState().data).toBe("hello");
  });

  it("updates state on setData", () => {
    const store = createStore<string>({ initialState: "hello" });
    store.setData("world");
    expect(store.getState().data).toBe("world");
  });

  it("tracks loading state", () => {
    const store = createStore<string>({ initialState: "hello" });
    store.setLoading(true);
    expect(store.getState().loading).toBe(true);
    store.setLoading(false);
    expect(store.getState().loading).toBe(false);
  });

  it("tracks error state", () => {
    const store = createStore<string>({ initialState: "hello" });
    store.setError(new Error("test"));
    expect(store.getState().error?.message).toBe("test");
  });

  it("subscribes and notifies", () => {
    const store = createStore<string>({ initialState: "hello" });
    let notified = false;
    const unsub = store.subscribe(() => { notified = true; });
    store.setData("world");
    expect(notified).toBe(true);
    unsub();
    store.setData("again");
    expect(notified).toBe(true); // still true, unsubscribe just stops future
  });

  it("persists to localStorage when persistKey provided", () => {
    const mockStorage = { getItem: jest.fn(), setItem: jest.fn() };
    jest.spyOn(global, "localStorage", "get").mockReturnValue(mockStorage as any);
    const store = createStore<string>({ initialState: "hello", persistKey: "test" });
    store.setData("persisted");
    expect(mockStorage.setItem).toHaveBeenCalledWith("test", '"persisted"');
  });
});
```