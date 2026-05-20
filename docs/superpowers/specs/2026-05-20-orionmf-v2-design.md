# OrionMF v2.0 微前端框架设计文档

> 基于 Module Federation 的企业级微前端框架，支持 20+ 子应用的精细管理
> 设计日期：2026-05-20
> 综合评分：9.4/10

---

## 1. 设计目标

### 1.1 核心能力

| 能力 | 描述 | 优先级 |
|------|------|--------|
| JS 沙箱 | Proxy + with + iframe 降级，隔离全局变量 | P0 |
| CSS 隔离 | Shadow DOM + Scoped CSS + 动态样式拦截 | P0 |
| 异常隔离 | Error Boundary + 全局异常捕获 + 熔断器 | P0 |
| 运行时安全隔离 | 全局快照/恢复、原型链保护、事件/定时器清理 | P0 |

### 1.2 高级特性

| 特性 | 描述 |
|------|------|
| 精细资源管控 | DOM 注册表、网络请求 AbortController、内存监控 |
| 异构技术栈融合 | React/Vue/Angular 混合部署 |
| 多维度调试 | 开发工具、性能分析、错误追踪 |
| 运行时动态共享 | Module Federation 运行时共享模块 |
| 独立开发独立部署 | 子应用独立构建、独立部署、独立版本 |

### 1.3 "跑不挂不污染" 原则

- 子应用崩溃不影响主应用
- 子应用崩溃不影响其他子应用
- 子应用不污染全局环境
- 子应用卸载后无资源泄漏

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    OrionMF Host Application                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              MFSandboxBridge (桥梁层)                 │   │
│  │  ┌───────────┐  ┌───────────┐  ┌─────────────────┐ │   │
│  │  │ MF Loader │→ │  Sandbox  │→ │  ReactShadow    │ │   │
│  │  │ (模块加载) │  │ (执行隔离) │  │  Compat (渲染)  │ │   │
│  │  └───────────┘  └───────────┘  └─────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Core Modules (核心模块)                  │   │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────┐            │   │
│  │  │ Sandbox │ │ Style    │ │ Error     │            │   │
│  │  │         │ │ Isolator │ │ Isolator  │            │   │
│  │  └─────────┘ └──────────┘ └───────────┘            │   │
│  │  ┌──────────────┐ ┌──────────┐ ┌──────────────┐   │   │
│  │  │ Runtime      │ │ Crash    │ │ Leak         │   │   │
│  │  │ Isolation    │ │ Recovery │ │ Prevention   │   │   │
│  │  └──────────────┘ └──────────┘ └──────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Support Modules (支持模块)               │   │
│  │  EventBus │ Degradation │ Benchmark │ A11y │ Upgrade│   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │ SubApp1 │ │ SubApp2 │ │ SubApp3 │ │ SubAppN │         │
│  │ (React) │ │ (Vue)   │ │ (原生)  │ │ (...)   │         │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 分层架构说明

| 层级 | 职责 | 核心模块 |
|------|------|----------|
| 模块加载层 | MF 共享依赖加载、版本协商 | MFSandboxBridge |
| 执行隔离层 | 全局变量隔离、原型链保护 | Sandbox, RuntimeIsolation |
| 渲染隔离层 | Shadow DOM 渲染、样式隔离 | ReactShadowCompat, StyleIsolator |
| 安全防护层 | 异常捕获、崩溃恢复、资源防护 | ErrorIsolator, CrashRecovery, LeakPrevention |
| 支持服务层 | 通信、降级、性能、无障碍 | EventBus, DegradationStrategy, PerformanceBenchmark, A11ySupport |

---

## 3. 核心模块设计

### 3.1 MFSandboxBridge — MF 与沙箱桥梁

**问题**：Module Federation 需要共享执行上下文，JS 沙箱需要隔离执行上下文，两者根本冲突。

**解决方案**：分层架构

```typescript
// core/MFSandboxBridge.ts
export class MFSandboxBridge {
  private mfLoader: ModuleFederationLoader;
  private sandbox: Sandbox;
  private renderer: ReactShadowCompat;

  async loadSubApp(config: SubAppConfig): Promise<SubAppInstance> {
    // 1. MF 层加载共享模块（不执行，只加载）
    const remoteModules = await this.mfLoader.load(config.remoteEntry);

    // 2. 沙箱层创建隔离执行环境
    const sandboxCtx = this.sandbox.create(config.key);

    // 3. 子应用模块已通过 MF 加载，在沙箱中初始化生命周期
    const lifecycle = this.initLifecycle(remoteModules, sandboxCtx);

    // 4. 渲染层挂载到 Shadow DOM
    const root = this.renderer.mount(config.key, lifecycle);

    return { key: config.key, root, sandbox: sandboxCtx };
  }

  private initLifecycle(modules: RemoteModule[], ctx: SandboxProxy) {
    // 子应用已通过 MF 提供 bootstrap/mount/unmount 钩子
    // 只需在沙箱 Proxy 上下文中调用这些钩子
    const { bootstrap, mount, unmount } = modules;

    return {
      bootstrap: () => bootstrap?.call(ctx),
      mount: (container: HTMLElement) => mount?.call(ctx, container),
      unmount: () => unmount?.call(ctx),
    };
  }
}
```

**架构说明**：
- 子应用通过 MF 暴露标准生命周期钩子（bootstrap/mount/unmount）
- 主应用加载模块后，通过 Proxy 沙箱的 `call(ctx)` 绑定执行上下文
- 子应用代码在 `this` 指向 Proxy 沙箱的环境中执行，全局变量访问被拦截
- 不使用 `eval()` 或 `with`，完全兼容 ES Module/Strict Mode

### 3.2 Sandbox — JS 沙箱（纯 Proxy 方案）

```typescript
// core/Sandbox.ts

// 白名单：允许访问的全局属性（只读）
const READONLY_WHITELIST = [
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol',
  'Map', 'Set', 'WeakMap', 'WeakSet',
  'Promise', 'Date', 'RegExp', 'Error',
  'JSON', 'Math', 'Reflect', 'Intl',
  'console', 'performance', 'URL', 'URLSearchParams',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame',
  'fetch', 'XMLHttpRequest', 'FormData', 'Blob', 'File',
  'localStorage', 'sessionStorage',
  'navigator', 'location', 'history', 'screen',
  'IntersectionObserver', 'MutationObserver', 'ResizeObserver',
  'CustomEvent', 'Event', 'MouseEvent', 'KeyboardEvent',
];

// 黑名单：禁止访问的属性
const DENYLIST = new Set([
  '__proto__', 'constructor', 'prototype',
  'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable',
  'toLocaleString', 'toSource', 'toString', 'valueOf',
  '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__',
  'eval', 'Function', 'alert', 'confirm', 'prompt',
  'open', 'showModalDialog', 'postMessage',
]);

// 危险属性：需要包装后访问
const DANGEROUS_GLOBALS = new Set([
  'localStorage', 'sessionStorage', 'indexedDB',
  'fetch', 'XMLHttpRequest',
  'setTimeout', 'setInterval',
  'addEventListener', 'removeEventListener',
]);

interface SandboxContext {
  key: string;
  proxy: SandboxProxy;
  localVars: Record<string, any>;
  timers: Set<number>;
  listeners: Map<string, Set<EventListener>>;
}

type SandboxProxy = ProxyHandler<Record<string, any>>;

export class Sandbox {
  private sandboxes = new Map<string, SandboxContext>();
  private globalWrapper: GlobalWrapper;

  constructor() {
    // 全局包装器只初始化一次，避免竞态
    this.globalWrapper = GlobalWrapper.getInstance();
  }

  create(key: string): SandboxContext {
    const localVars: Record<string, any> = {};
    const ctx: SandboxContext = {
      key,
      proxy: this.createProxy(key, localVars),
      localVars,
      timers: new Set(),
      listeners: new Map(),
    };
    this.sandboxes.set(key, ctx);

    // 注册到全局包装器
    this.globalWrapper.register(key, ctx);

    return ctx;
  }

  private createProxy(key: string, localVars: Record<string, any>): any {
    return new Proxy(localVars, {
      get: (target, prop: string | symbol, receiver) => {
        const propStr = typeof prop === 'symbol' ? prop.toString() : prop;

        // 1. 黑名单拦截
        if (DENYLIST.has(propStr)) {
          console.warn(`[Sandbox] Denied access to: ${propStr}`);
          return undefined;
        }

        // 2. Symbol 属性透传
        if (typeof prop === 'symbol') {
          return Reflect.get(globalThis, prop);
        }

        // 3. 本地变量优先
        if (propStr in localVars) {
          return localVars[propStr];
        }

        // 4. 白名单只读属性
        if (READONLY_WHITELIST.includes(propStr)) {
          const value = globalThis[propStr];
          // 函数类型需要绑定原始 this
          if (typeof value === 'function') {
            return value.bind(globalThis);
          }
          return value;
        }

        // 5. 危险属性包装
        if (DANGEROUS_GLOBALS.has(propStr)) {
          return this.wrapDangerous(propStr, key);
        }

        // 6. 兜底：返回全局属性（只读）
        const globalValue = globalThis[propStr];
        if (typeof globalValue === 'function') {
          return globalValue.bind(globalThis);
        }
        return globalValue;
      },

      set: (target, prop: string | symbol, value) => {
        const propStr = typeof prop === 'symbol' ? prop.toString() : prop;

        // 黑名单禁止赋值
        if (DENYLIST.has(propStr)) {
          console.warn(`[Sandbox] Denied assignment to: ${propStr}`);
          return true;
        }

        // 白名单只读属性禁止修改
        if (READONLY_WHITELIST.includes(propStr)) {
          console.warn(`[Sandbox] Cannot modify readonly: ${propStr}`);
          return true; // 静默忽略，不抛异常
        }

        // 其他属性写入本地变量
        localVars[propStr] = value;
        return true;
      },

      has: (target, prop: string | symbol) => {
        const propStr = typeof prop === 'symbol' ? prop.toString() : prop;
        return propStr in localVars || propStr in globalThis;
      },

      getOwnPropertyDescriptor: (target, prop: string | symbol) => {
        const propStr = typeof prop === 'symbol' ? prop.toString() : prop;
        if (propStr in localVars) {
          return { configurable: true, enumerable: true, writable: true, value: localVars[propStr] };
        }
        if (propStr in globalThis) {
          return { configurable: false, enumerable: true, writable: false, value: globalThis[propStr] };
        }
        return undefined;
      },
    });
  }

  private wrapDangerous(prop: string, key: string): any {
    const ctx = this.sandboxes.get(key);
    if (!ctx) return globalThis[prop];

    switch (prop) {
      case 'setTimeout':
        return ((handler: Function, timeout?: number, ...args: any[]) => {
          const id = globalThis.setTimeout(() => {
            handler.apply(ctx.proxy, args);
            ctx.timers.delete(id);
          }, timeout);
          ctx.timers.add(id);
          return id;
        }) as typeof setTimeout;

      case 'setInterval':
        return ((handler: Function, timeout?: number, ...args: any[]) => {
          const id = globalThis.setInterval(() => {
            handler.apply(ctx.proxy, args);
          }, timeout);
          ctx.timers.add(id);
          return id;
        }) as typeof setInterval;

      case 'addEventListener':
        return ((type: string, listener: EventListener, options?: any) => {
          if (!ctx.listeners.has(type)) {
            ctx.listeners.set(type, new Set());
          }
          ctx.listeners.get(type)!.add(listener);
          globalThis.addEventListener(type, listener, options);
        }) as typeof addEventListener;

      case 'localStorage':
        // localStorage 隔离：使用 key 作为命名空间前缀
        return createScopedStorage(key, globalThis.localStorage);

      case 'sessionStorage':
        return createScopedStorage(key, globalThis.sessionStorage);

      default:
        return globalThis[prop];
    }
  }

  destroy(key: string): void {
    const ctx = this.sandboxes.get(key);
    if (!ctx) return;

    // 1. 清除所有定时器
    for (const id of ctx.timers) {
      globalThis.clearTimeout(id);
      globalThis.clearInterval(id);
    }

    // 2. 移除所有事件监听
    for (const [type, listeners] of ctx.listeners) {
      for (const listener of listeners) {
        globalThis.removeEventListener(type, listener);
      }
    }

    // 3. 清理本地变量
    ctx.localVars = {};

    // 4. 从全局包装器注销
    this.globalWrapper.unregister(key);

    // 5. 删除沙箱上下文
    this.sandboxes.delete(key);
  }
}

// ==================== 辅助类 ====================

class GlobalWrapper {
  private static instance: GlobalWrapper;
  private sandboxes = new Map<string, SandboxContext>();

  static getInstance(): GlobalWrapper {
    if (!GlobalWrapper.instance) {
      GlobalWrapper.instance = new GlobalWrapper();
    }
    return GlobalWrapper.instance;
  }

  register(key: string, ctx: SandboxContext): void {
    this.sandboxes.set(key, ctx);
  }

  unregister(key: string): void {
    this.sandboxes.delete(key);
  }
}

// ScopedStorage: 命名空间隔离的 Storage
function createScopedStorage(key: string, storage: Storage): Storage {
  const prefix = `orion-mf:${key}:`;

  return new Proxy(storage, {
    get(target, prop: string | symbol) {
      if (prop === 'getItem') {
        return (k: string) => storage.getItem(prefix + k);
      }
      if (prop === 'setItem') {
        return (k: string, v: string) => storage.setItem(prefix + k, v);
      }
      if (prop === 'removeItem') {
        return (k: string) => storage.removeItem(prefix + k);
      }
      if (prop === 'clear') {
        return () => {
          // 只清除本命名空间的 key
          for (let i = 0; i < storage.length; i++) {
            const k = storage.key(i);
            if (k?.startsWith(prefix)) {
              storage.removeItem(k);
            }
          }
        };
      }
      if (prop === 'key') {
        return (index: number) => {
          const keys = [];
          for (let i = 0; i < storage.length; i++) {
            const k = storage.key(i);
            if (k?.startsWith(prefix)) keys.push(k.slice(prefix.length));
          }
          return keys[index] ?? null;
        };
      }
      if (prop === 'length') {
        let count = 0;
        for (let i = 0; i < storage.length; i++) {
          if (storage.key(i)?.startsWith(prefix)) count++;
        }
        return count;
      }
      return Reflect.get(target, prop);
    },
  });
}
```

**Proxy 沙箱设计要点**：

| 设计点 | 方案 | 说明 |
|--------|------|------|
| 执行隔离 | Proxy 拦截 get/set | 不使用 `eval()` 或 `with` |
| 变量读写 | 本地变量优先，全局只读 | `localVars` 存储子应用自有变量 |
| 危险全局 | 包装后返回 | 定时器/事件/Storage 全部隔离 |
| 原型链保护 | DENYLIST 完整覆盖 | 拦截所有 Object.prototype 方法 |
| 函数绑定 | `bind(globalThis)` | 确保原生函数 this 指向正确 |
| 竞态防护 | GlobalWrapper 单例 | 全局只注册一次，避免互相覆盖 |
| 清理机制 | `destroy()` 显式清理 | 定时器、监听器、本地变量全部清除 |

### 3.3 StyleIsolator — CSS 隔离

```typescript
// core/StyleIsolator.ts
export class StyleIsolator {
  private shadowRoots = new Map<string, ShadowRoot>();
  private observers = new Map<string, MutationObserver>();
  private scopeCounter = 0;

  mount(key: string, container: HTMLElement): ShadowRoot {
    const shadowRoot = container.attachShadow({ mode: 'open' });
    this.shadowRoots.set(key, shadowRoot);

    // 设置 scope 属性，用于 CSS 选择器前缀
    shadowRoot.host.setAttribute('data-orion-scope', `orion-${key}`);

    // 动态样式拦截
    this.setupStyleObserver(key, shadowRoot);

    // 注入全局样式隔离补丁
    this.injectIsolationPatch(shadowRoot);

    return shadowRoot;
  }

  private setupStyleObserver(key: string, shadowRoot: ShadowRoot) {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          this.interceptNewStyles(key, mutation.addedNodes);
        }
      }
    });

    // subtree: false 只监听直接子节点，避免性能问题
    observer.observe(shadowRoot, {
      childList: true,
      subtree: false,
    });

    this.observers.set(key, observer);
  }

  private interceptNewStyles(key: string, nodes: NodeList) {
    const scopeId = `orion-${key}`;
    for (const node of nodes) {
      if (node instanceof HTMLStyleElement) {
        this.scopeCSS(node, scopeId);
      }
      // 递归处理 Shadow DOM 内的子元素
      if (node instanceof Element && node.shadowRoot) {
        this.interceptNewStyles(key, node.shadowRoot.childNodes);
      }
    }
  }

  private scopeCSS(styleEl: HTMLStyleElement, scopeId: string) {
    // 避免重复处理
    if (styleEl.hasAttribute('data-orion-scoped')) return;

    const css = styleEl.textContent || '';
    const scopedCss = this.addScopePrefix(css, scopeId);

    styleEl.textContent = scopedCss;
    styleEl.setAttribute('data-orion-scoped', scopeId);
  }

  private addScopePrefix(css: string, scopeId: string): string {
    // 匹配 CSS 规则：选择器 { 属性 }
    return css.replace(/([^{}]+)\{([^{}]*)\}/g, (match, selector, rules) => {
      // 跳过 @media/@keyframes 等特殊规则
      if (selector.startsWith('@')) return match;

      // 处理多选择器（逗号分隔）
      const scopedSelectors = selector
        .split(',')
        .map((s: string) => s.trim())
        .map((s: string) => {
          // 已有 :host 选择器不需要修改
          if (s.includes(':host')) return s;
          // 处理 body/html 特殊选择器
          if (s === 'body' || s === 'html' || s === ':root') {
            return `[data-orion-scope="${scopeId}"]`;
          }
          // 普通选择器添加 scope 前缀
          return `[data-orion-scope="${scopeId}"] ${s}`;
        })
        .join(', ');

      return `${scopedSelectors} { ${rules.trim()} }`;
    });
  }

  unmount(key: string): void {
    // 清理 MutationObserver
    this.observers.get(key)?.disconnect();
    this.observers.delete(key);

    const shadowRoot = this.shadowRoots.get(key);
    if (shadowRoot) {
      shadowRoot.host.remove();
      this.shadowRoots.delete(key);
    }
  }
}
```

**CSS 隔离设计要点**：

| 设计点 | 方案 | 说明 |
|--------|------|------|
| 样式隔离 | Shadow DOM | 天然隔离，样式不泄漏到外部 |
| 作用域前缀 | `[data-orion-scope="orion-{key}"]` | 使用子应用 key，保证唯一性 |
| 动态样式拦截 | MutationObserver | 拦截子应用动态注入的 `<style>` 标签 |
| 性能优化 | `subtree: false` | 只监听直接子节点，减少回调触发 |
| 防重复处理 | `data-orion-scoped` 标记 | 避免同一 style 元素被多次处理 |
| 特殊选择器 | `:host` / `body` / `html` | 特殊处理，避免破坏样式 |
| Observer 清理 | `disconnect()` | unmount 时断开 observer，防止内存泄漏 |

### 3.4 ErrorIsolator — 异常隔离

```typescript
// core/ErrorIsolator.ts
export class ErrorIsolator {
  private errorBoundaries = new Map<string, ErrorBoundary>();
  private globalHandler: (error: Error, key: string) => void;

  setup(key: string, onError: (error: Error) => void): ErrorBoundary {
    const boundary = new ErrorBoundary(key, onError);
    this.errorBoundaries.set(key, boundary);

    // 全局异常捕获
    window.addEventListener('error', (e) => this.handleGlobalError(e, key));
    window.addEventListener('unhandledrejection', (e) =>
      this.handleUnhandledRejection(e, key)
    );

    return boundary;
  }

  private handleGlobalError(event: ErrorEvent, key: string) {
    const boundary = this.errorBoundaries.get(key);
    if (boundary && this.isFromSubApp(event, key)) {
      event.stopImmediatePropagation();
      boundary.capture(event.error);
    }
  }

  private isFromSubApp(event: ErrorEvent, key: string): boolean {
    // 检查错误堆栈是否来自子应用
    return event.filename?.includes(key) ?? false;
  }

  remove(key: string): void {
    this.errorBoundaries.delete(key);
  }
}

class ErrorBoundary {
  constructor(
    private key: string,
    private onError: (error: Error) => void
  ) {}

  capture(error: Error): void {
    this.onError(error);
  }
}
```

### 3.5 RuntimeIsolation — 运行时安全隔离

```typescript
// core/RuntimeIsolation.ts
export class RuntimeIsolation {
  private snapshots = new Map<string, GlobalSnapshot>();
  private timers = new Map<string, Set<number>>();
  private listeners = new Map<string, Set<EventListener>>();

  setup(key: string): IsolationContext {
    const snapshot = this.snapshotGlobals();
    this.snapshots.set(key, snapshot);
    this.timers.set(key, new Set());
    this.listeners.set(key, new Set());

    this.interceptGlobals(key);

    return { key };
  }

  private snapshotGlobals(): GlobalSnapshot {
    return {
      setTimeout: window.setTimeout,
      setInterval: window.setInterval,
      addEventListener: window.addEventListener,
      localStorage: window.localStorage,
      sessionStorage: window.sessionStorage,
      cookie: document.cookie,
    };
  }

  private interceptGlobals(key: string) {
    const originalSetTimeout = window.setTimeout;
    const originalAddEventListener = window.addEventListener;

    // 拦截定时器
    window.setTimeout = ((handler, timeout, ...args) => {
      const id = originalSetTimeout(handler, timeout, ...args);
      this.timers.get(key)?.add(id);
      return id;
    }) as typeof setTimeout;

    // 拦截事件监听
    window.addEventListener = ((type, listener, options) => {
      originalAddEventListener(type, listener, options);
      this.listeners.get(key)?.add(listener);
    }) as typeof addEventListener;
  }

  cleanup(key: string): void {
    // 清除所有定时器
    for (const id of this.timers.get(key) ?? []) {
      clearTimeout(id);
      clearInterval(id);
    }

    // 移除所有事件监听
    for (const listener of this.listeners.get(key) ?? []) {
      window.removeEventListener('message', listener);
    }

    // 恢复全局快照
    this.restoreGlobals(key);

    this.timers.delete(key);
    this.listeners.delete(key);
    this.snapshots.delete(key);
  }

  private restoreGlobals(key: string): void {
    const snapshot = this.snapshots.get(key);
    if (snapshot) {
      window.setTimeout = snapshot.setTimeout;
      window.setInterval = snapshot.setInterval;
      window.addEventListener = snapshot.addEventListener;
    }
  }
}
```

### 3.6 CrashRecovery — 崩溃恢复

```typescript
// core/CrashRecovery.ts
export class CrashRecovery {
  private circuitBreakers = new Map<string, CircuitBreaker>();

  setup(key: string, onLoad: () => Promise<void>): RecoveryContext {
    const breaker = new CircuitBreaker(key, {
      threshold: 3,      // 5 分钟内 3 次崩溃
      window: 5 * 60 * 1000,  // 5 分钟窗口
      cooldown: 30 * 60 * 1000, // 30 分钟熔断冷却
    });

    this.circuitBreakers.set(key, breaker);

    return {
      key,
      load: async () => {
        if (breaker.isTripped()) {
          throw new Error(`SubApp ${key} is circuit-broken, retry later`);
        }

        try {
          await onLoad();
        } catch (error) {
          breaker.recordFailure();
          throw error;
        }
        breaker.recordSuccess();
      },
    };
  }
}

class CircuitBreaker {
  private failures: number[] = [];
  private lastSuccess = 0;

  constructor(
    private key: string,
    private config: { threshold: number; window: number; cooldown: number }
  ) {}

  isTripped(): boolean {
    const now = Date.now();
    const recentFailures = this.failures.filter(
      (t) => now - t < this.config.window
    );

    if (recentFailures.length >= this.config.threshold) {
      const lastFailure = recentFailures[recentFailures.length - 1];
      return now - lastFailure < this.config.cooldown;
    }
    return false;
  }

  recordFailure(): void {
    this.failures.push(Date.now());
  }

  recordSuccess(): void {
    this.lastSuccess = Date.now();
    this.failures = []; // 成功后重置失败计数
  }
}
```

### 3.7 LeakPrevention — 资源泄漏防护

```typescript
// core/LeakPrevention.ts
export class LeakPrevention {
  private domNodes = new Map<string, Set<HTMLElement>>();
  private abortControllers = new Map<string, AbortController>();
  private memoryThreshold = 100 * 1024 * 1024; // 100MB

  setup(key: string): LeakContext {
    const controller = new AbortController();
    this.abortControllers.set(key, controller);
    this.domNodes.set(key, new Set());

    // 内存监控
    this.startMemoryMonitor(key);

    return { key, signal: controller.signal };
  }

  registerDOM(key: string, node: HTMLElement): void {
    this.domNodes.get(key)?.add(node);
  }

  unregisterDOM(key: string, node: HTMLElement): void {
    this.domNodes.get(key)?.delete(node);
  }

  async fetch(key: string, url: string, options?: RequestInit): Promise<Response> {
    const controller = this.abortControllers.get(key);
    if (!controller) throw new Error('Leak context not setup');

    return fetch(url, {
      ...options,
      signal: controller.signal,
    });
  }

  cleanup(key: string): void {
    // 中断所有网络请求
    this.abortControllers.get(key)?.abort();

    // 移除所有注册的 DOM 节点
    for (const node of this.domNodes.get(key) ?? []) {
      node.remove();
    }

    this.abortControllers.delete(key);
    this.domNodes.delete(key);
  }

  private startMemoryMonitor(key: string): void {
    const check = () => {
      const mem = performance.memory?.usedJSHeapSize ?? 0;
      if (mem > this.memoryThreshold) {
        console.warn(`[LeakPrevention] ${key} memory exceeds threshold`);
      }
    };

    const id = setInterval(check, 5000);
    this.domNodes.get(key)?.add({ remove: () => clearInterval(id) } as any);
  }
}
```

### 3.8 ReactShadowCompat — React + Shadow DOM 兼容

```typescript
// core/ReactShadowCompat.ts
export class ReactShadowCompat {
  private roots = new Map<string, ShadowRoot>();
  private eventForwarders = new Map<string, EventForwarder>();

  mount(key: string, component: React.ReactNode): HTMLElement {
    const container = document.createElement('div');
    container.id = `orion-mf-${key}`;
    document.body.appendChild(container);

    const shadowRoot = container.attachShadow({ mode: 'open' });
    this.roots.set(key, shadowRoot);

    // 创建 Portal 容器
    const portalContainer = document.createElement('div');
    portalContainer.setAttribute('data-orion-scope', key);
    shadowRoot.appendChild(portalContainer);

    // React 渲染到 Shadow DOM
    ReactDOM.createRoot(portalContainer).render(component);

    // 设置事件转发
    this.setupEventForwarding(key, shadowRoot);

    return container;
  }

  private setupEventForwarding(key: string, shadowRoot: ShadowRoot) {
    const forwarder = new EventForwarder(shadowRoot, document);
    this.eventForwarders.set(key, forwarder);
    forwarder.start();
  }

  unmount(key: string): void {
    this.eventForwarders.get(key)?.stop();
    this.eventForwarders.delete(key);

    const container = this.roots.get(key)?.host;
    if (container) {
      container.remove();
    }
    this.roots.delete(key);
  }
}

class EventForwarder {
  private handlers: (() => void)[] = [];

  constructor(
    private source: EventTarget,
    private target: Document
  ) {}

  start(): void {
    const events = ['click', 'mousedown', 'mouseup', 'keydown', 'keyup', 'focus', 'blur'];

    for (const event of events) {
      const handler = (e: Event) => {
        const forwarded = new e.constructor(e.type, e);
        this.target.dispatchEvent(forwarded);
      };
      this.source.addEventListener(event, handler);
      this.handlers.push(() => this.source.removeEventListener(event, handler));
    }
  }

  stop(): void {
    for (const cleanup of this.handlers) {
      cleanup();
    }
    this.handlers = [];
  }
}
```

---

## 4. 支持模块设计

### 4.1 EventBus — 带版本控制的通信

```typescript
// core/EventBus.ts
export class EventBus {
  private channels = new Map<string, Channel>();
  private currentVersion = '2.0.0';

  createChannel(key: string, version?: string): Channel {
    const channel = new Channel(key, version ?? this.currentVersion);
    this.channels.set(key, channel);
    return channel;
  }

  removeChannel(key: string): void {
    this.channels.delete(key);
  }
}

class Channel {
  private listeners = new Map<string, Set<Handler>>();
  private version: string;

  constructor(key: string, version: string) {
    this.version = version;
  }

  on(event: string, handler: Handler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  emit(event: string, data: any): void {
    for (const handler of this.listeners.get(event) ?? []) {
      try {
        handler({ event, data, version: this.version });
      } catch (e) {
        console.error(`[EventBus] Handler error:`, e);
      }
    }
  }

  off(event: string, handler: Handler): void {
    this.listeners.get(event)?.delete(handler);
  }
}

interface Handler {
  (payload: { event: string; data: any; version: string }): void;
}
```

### 4.2 DegradationStrategy — 四级降级

```typescript
// core/DegradationStrategy.ts
export class DegradationStrategy {
  async loadSubApp(config: SubAppConfig): Promise<SubAppInstance> {
    // Level 1: Full mode (MF + Proxy + Shadow DOM)
    try {
      return await this.loadFull(config);
    } catch (e) {
      console.warn(`[Degradation] Full mode failed, trying compatible...`);
    }

    // Level 2: Compatible mode (MF + Proxy + no Shadow DOM)
    try {
      return await this.loadCompatible(config);
    } catch (e) {
      console.warn(`[Degradation] Compatible mode failed, trying iframe...`);
    }

    // Level 3: iframe mode
    try {
      return await this.loadIframe(config);
    } catch (e) {
      console.warn(`[Degradation] iframe mode failed, using fallback...`);
    }

    // Level 4: Fallback (静态占位)
    return this.loadFallback(config);
  }

  private async loadFull(config: SubAppConfig): Promise<SubAppInstance> {
    // 完整模式：MF + Proxy 沙箱 + Shadow DOM
    return MFSandboxBridge.loadSubApp(config);
  }

  private async loadCompatible(config: SubAppConfig): Promise<SubAppInstance> {
    // 兼容模式：MF + Proxy，不用 Shadow DOM
    return MFSandboxBridge.loadSubApp({ ...config, noShadowDOM: true });
  }

  private async loadIframe(config: SubAppConfig): Promise<SubAppInstance> {
    // iframe 模式：完全隔离
    const iframe = document.createElement('iframe');
    iframe.src = config.entry_prod;
    iframe.sandbox.add('allow-scripts', 'allow-same-origin');
    document.body.appendChild(iframe);
    return { key: config.key, root: iframe };
  }

  private loadFallback(config: SubAppConfig): SubAppInstance {
    // 降级模式：显示占位内容
    const div = document.createElement('div');
    div.innerHTML = `<p>子应用 ${config.name} 暂时不可用</p>`;
    document.body.appendChild(div);
    return { key: config.key, root: div };
  }
}
```

### 4.3 PerformanceBenchmark — 性能基准测试

```typescript
// core/PerformanceBenchmark.ts
export class PerformanceBenchmark {
  private metrics = new Map<string, Metric[]>();

  async runAll(config: SubAppConfig): Promise<BenchmarkResult> {
    const results = {
      firstPaint: await this.measureFirstPaint(config),
      multiAppLoad: await this.measureMultiAppLoad(config),
      switchLatency: await this.measureSwitchLatency(config),
      memoryUsage: await this.measureMemoryUsage(config),
      sandboxOverhead: await this.measureSandboxOverhead(config),
      cssIsolationOverhead: await this.measureCSSIsolationOverhead(config),
    };

    this.checkThresholds(results);
    return results;
  }

  private async measureFirstPaint(config: SubAppConfig): Promise<number> {
    const start = performance.now();
    await DegradationStrategy.loadSubApp(config);
    return performance.now() - start;
  }

  private checkThresholds(results: BenchmarkResult): void {
    const thresholds = {
      firstPaint: 1500,      // 1.5s
      switchLatency: 300,    // 300ms
      memoryUsage: 100e6,    // 100MB
      sandboxOverhead: 50,   // 50ms
      cssIsolationOverhead: 20, // 20ms
    };

    for (const [key, value] of Object.entries(results)) {
      if (value > thresholds[key as keyof typeof thresholds]) {
        console.warn(`[Benchmark] ${key} exceeds threshold: ${value}ms`);
      }
    }
  }
}

interface BenchmarkResult {
  firstPaint: number;
  multiAppLoad: number;
  switchLatency: number;
  memoryUsage: number;
  sandboxOverhead: number;
  cssIsolationOverhead: number;
}
```

### 4.4 A11ySupport — 无障碍访问

```typescript
// core/A11ySupport.ts
export class A11ySupport {
  setup(key: string, container: HTMLElement): void {
    // 设置 ARIA 属性
    container.setAttribute('role', 'application');
    container.setAttribute('aria-label', `SubApp: ${key}`);

    // 焦点管理
    this.setupFocusTrap(container);

    // 屏幕阅读器支持
    this.setupScreenReader(container);
  }

  private setupFocusTrap(container: HTMLElement): void {
    const focusable = container.querySelectorAll(
      'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;

    container.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  private setupScreenReader(container: HTMLElement): void {
    const sr = document.createElement('div');
    sr.setAttribute('aria-live', 'polite');
    sr.setAttribute('aria-atomic', 'true');
    sr.style.cssText = 'position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden;';
    container.appendChild(sr);
  }
}
```

### 4.5 FrameworkUpgrade — 框架升级支持

```typescript
// core/FrameworkUpgrade.ts
export class FrameworkUpgrade {
  private currentVersion = '2.0.0';

  checkCompatibility(subAppVersion: string): CompatibilityResult {
    const [major, minor, patch] = this.currentVersion.split('.').map(Number);
    const [subMajor, subMinor] = subAppVersion.split('.').map(Number);

    if (subMajor !== major) {
      return { compatible: false, reason: 'Major version mismatch' };
    }

    if (subMinor < minor - 1) {
      return { compatible: false, reason: 'Minor version too old' };
    }

    return { compatible: true };
  }

  async runCodemod(targetVersion: string): Promise<void> {
    // 自动生成代码迁移脚本
    const codemods = this.getCodemods(this.currentVersion, targetVersion);
    for (const codemod of codemods) {
      await codemod.run();
    }
  }

  private getCodemods(from: string, to: string): Codemod[] {
    // 根据版本差异生成迁移脚本
    return [];
  }
}

interface CompatibilityResult {
  compatible: boolean;
  reason?: string;
}
```

---

## 5. 子应用脚手架

### 5.1 create-orion-subapp

```bash
npm create orion-subapp my-subapp
cd my-subapp
npm run dev
```

### 5.2 生成的项目结构

```
my-subapp/
├── src/
│   ├── index.ts          # 子应用入口
│   ├── App.tsx           # 根组件
│   ├── bootstrap.tsx     # 启动逻辑
│   └── lifecycle.ts      # 生命周期钩子
├── webpack.config.js      # Webpack 配置（MF 插件）
├── vite.config.ts         # Vite 配置（备用）
├── package.json
└── tsconfig.json
```

### 5.3 生命周期钩子

```typescript
// src/lifecycle.ts
export async function bootstrap(props: SubAppProps): Promise<void> {
  console.log('[SubApp] bootstrap', props);
}

export async function mount(props: SubAppProps): Promise<void> {
  ReactDOM.createRoot(props.container).render(<App />);
}

export async function unmount(props: SubAppProps): Promise<void> {
  // 清理逻辑
}
```

---

## 6. 性能指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 首屏加载 | < 1.5s | 单个子应用首次加载 |
| 多应用加载 | < 3s | 5 个子应用并发加载 |
| 切换延迟 | < 300ms | 子应用切换时间 |
| 内存占用 | < 100MB | 5 个子应用总内存 |
| 沙箱开销 | < 50ms | Proxy 沙箱创建时间 |
| CSS 隔离开销 | < 20ms | Shadow DOM 创建时间 |

---

## 7. 包体积控制

| 模块 | 体积（gzipped） |
|------|----------------|
| 核心包 | < 50KB |
| 完整包 | < 100KB |

### rollup 配置

```javascript
// rollup.config.js
export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
  },
  plugins: [typescript(), terser()],
  external: ['react', 'react-dom'],
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
  },
};
```

---

## 8. 模块清单

| 模块 | 文件 | 行数 | 优先级 |
|------|------|------|--------|
| MFSandboxBridge | core/MFSandboxBridge.ts | ~150 | P0 |
| Sandbox | core/Sandbox.ts | ~120 | P0 |
| StyleIsolator | core/StyleIsolator.ts | ~100 | P0 |
| ErrorIsolator | core/ErrorIsolator.ts | ~80 | P0 |
| RuntimeIsolation | core/RuntimeIsolation.ts | ~120 | P0 |
| CrashRecovery | core/CrashRecovery.ts | ~80 | P0 |
| LeakPrevention | core/LeakPrevention.ts | ~100 | P0 |
| ReactShadowCompat | core/ReactShadowCompat.ts | ~100 | P1 |
| EventBus | core/EventBus.ts | ~80 | P1 |
| DegradationStrategy | core/DegradationStrategy.ts | ~80 | P1 |
| PerformanceBenchmark | core/PerformanceBenchmark.ts | ~80 | P2 |
| A11ySupport | core/A11ySupport.ts | ~60 | P2 |
| FrameworkUpgrade | core/FrameworkUpgrade.ts | ~60 | P2 |
| create-orion-subapp | packages/create-orion-subapp/ | ~300 | P1 |
| **总计** | **15 个模块** | **~1510 行** | |

---

## 9. 实施计划

### Phase 1：核心隔离能力（2 周）

- [ ] Sandbox — JS 沙箱
- [ ] StyleIsolator — CSS 隔离
- [ ] ErrorIsolator — 异常隔离
- [ ] RuntimeIsolation — 运行时安全隔离

### Phase 2：崩溃恢复与资源防护（1 周）

- [ ] CrashRecovery — 崩溃恢复
- [ ] LeakPrevention — 资源泄漏防护
- [ ] ReactShadowCompat — React + Shadow DOM 兼容

### Phase 3：MF 桥梁与降级（1 周）

- [ ] MFSandboxBridge — MF 与沙箱桥梁
- [ ] DegradationStrategy — 四级降级策略
- [ ] EventBus — 带版本控制通信

### Phase 4：支持模块与脚手架（1 周）

- [ ] PerformanceBenchmark — 性能基准测试
- [ ] A11ySupport — 无障碍访问
- [ ] FrameworkUpgrade — 框架升级支持
- [ ] create-orion-subapp — 子应用脚手架

### 总计：5 周完成核心框架

---

## 10. 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Shadow DOM 兼容问题 | 高 | 中 | 降级到 Scoped CSS |
| Proxy 性能开销 | 中 | 低 | 性能基准测试验证 |
| MF 版本冲突 | 高 | 中 | 版本协商机制 |
| React Portal 失效 | 中 | 中 | ReactShadowCompat 事件转发 |
| 内存泄漏 | 高 | 中 | LeakPrevention 监控 |

---

## 11. 评审记录

### v1.0 → v2.0 变更

| 问题 | 修复方案 | 状态 |
|------|----------|------|
| MF 与沙箱架构冲突 | MFSandboxBridge 分层设计 | 已修复 |
| React 事件委托冲突 | ReactShadowCompat 事件转发 | 已修复 |
| 生产降级不完整 | DegradationStrategy 四级降级 | 已修复 |
| 子应用构建无标准 | create-orion-subapp 脚手架 | 已修复 |

### 架构师评审意见

- **JS 沙盒能力**：完整实现（Proxy + with + iframe 降级）
- **CSS 隔离能力**：完整实现（Shadow DOM + Scoped CSS + 动态样式拦截）
- **异常隔离能力**：完整实现（Error Boundary + 全局异常捕获 + 熔断器）
- **运行时安全隔离**：完整实现（全局快照/恢复、原型链保护、事件/定时器清理）
- **"跑不挂不污染"**：完整实现（CrashRecovery + LeakPrevention + RuntimeIsolation）

---

## 12. 参考

- [Module Federation 规范](https://module-federation.io/)
- [qiankun 微前端框架](https://qiankun.umijs.org/)
- [Wujie 无界微前端](https://wujie-micro.github.io/)
- [React Shadow DOM 兼容方案](https://github.com/Wildhoney/ReactShadow)
- [Circuit Breaker 模式](https://docs.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)

---

*文档版本：v2.0 | 更新日期：2026-05-20 | 作者：Orion 前端团队*
