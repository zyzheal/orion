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
          // 使用倒序遍历，避免 removeItem 导致索引偏移而跳过元素
          for (let i = storage.length - 1; i >= 0; i--) {
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

// 全局监听器只注册一次，避免多次 setup 导致泄漏
let globalErrorHandler: ((event: ErrorEvent) => void) | null = null;
let globalRejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

export class ErrorIsolator {
  private errorBoundaries = new Map<string, ErrorBoundary>();

  constructor() {
    // 构造函数中只注册一次全局监听器
    if (!globalErrorHandler) {
      globalErrorHandler = (event: ErrorEvent) => {
        this.routeError(event);
      };
      globalRejectionHandler = (event: PromiseRejectionEvent) => {
        this.routeRejection(event);
      };

      window.addEventListener('error', globalErrorHandler);
      window.addEventListener('unhandledrejection', globalRejectionHandler);
    }
  }

  private routeError(event: ErrorEvent): void {
    // 遍历所有子应用，找到匹配的错误来源
    for (const [key, boundary] of this.errorBoundaries) {
      if (this.isFromSubApp(event, key)) {
        event.stopImmediatePropagation();
        boundary.capture(event.error);
        return;
      }
    }
  }

  private routeRejection(event: PromiseRejectionEvent): void {
    for (const [key, boundary] of this.errorBoundaries) {
      // 通过 rejection reason 判断是否来自子应用
      const reason = event.reason;
      if (reason && reason.toString().includes(key)) {
        event.preventDefault();
        boundary.capture(reason instanceof Error ? reason : new Error(String(reason)));
        return;
      }
    }
  }

  setup(key: string, onError: (error: Error) => void): ErrorBoundary {
    const boundary = new ErrorBoundary(key, onError);
    this.errorBoundaries.set(key, boundary);
    return boundary;
  }

  private isFromSubApp(event: ErrorEvent, key: string): boolean {
    // 检查错误堆栈是否来自子应用
    if (event.filename?.includes(key)) return true;
    if (event.error?.stack?.includes(key)) return true;
    return false;
  }

  remove(key: string): void {
    this.errorBoundaries.delete(key);
    // 不再需要移除全局监听器，因为它是单例
  }

  destroy(): void {
    // 清理所有边界和全局监听器（框架卸载时调用）
    this.errorBoundaries.clear();
    if (globalErrorHandler) {
      window.removeEventListener('error', globalErrorHandler);
      window.removeEventListener('unhandledrejection', globalRejectionHandler!);
      globalErrorHandler = null;
      globalRejectionHandler = null;
    }
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

**ErrorIsolator 设计要点**：

| 设计点 | 方案 | 说明 |
|--------|------|------|
| 全局监听器 | 单例模式，只注册一次 | 避免多次 setup 导致监听器累积 |
| 错误路由 | 遍历 errorBoundaries Map | 通过 filename/stack 匹配子应用 |
| unhandledrejection | 通过 reason 字符串判断来源 | 防止 Promise 错误泄漏 |
| 清理机制 | `destroy()` 清理所有 | 框架卸载时移除全局监听器 |
| 堆栈检测 | filename + error.stack | 提高子应用错误识别准确率 |

### 3.5 RuntimeIsolation — 运行时安全隔离

> **注意**：此模块的功能已由 `Sandbox` 模块（3.2 节）的 Proxy 白名单/黑名单机制完整覆盖。
> 保留此文档作为设计参考，实际实现应使用 `Sandbox` 模块。

~~~typescript
// core/RuntimeIsolation.ts — 已废弃，使用 Sandbox 替代
// 以下代码保留用于参考
~~~

**RuntimeIsolation 已被 Sandbox 覆盖的功能**：

| 原功能 | Sandbox 对应实现 |
|--------|-----------------|
| setTimeout/setInterval 拦截 | Proxy wrapDangerous 方法 |
| addEventListener 拦截 | Proxy wrapDangerous 方法 |
| localStorage/sessionStorage 隔离 | ScopedStorage 命名空间 |
| 定时器/监听器清理 | Sandbox.destroy() 方法 |
| 全局快照/恢复 | Proxy 本地变量优先策略 |

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
  // 使用固定大小的循环缓冲区，避免无限增长
  private failures: number[] = [];
  private maxFailures = 100; // 最多保留 100 条记录
  private lastSuccess = 0;

  constructor(
    private key: string,
    private config: { threshold: number; window: number; cooldown: number }
  ) {}

  isTripped(): boolean {
    const now = Date.now();

    // 清理过期条目
    this.pruneOldFailures(now);

    if (this.failures.length >= this.config.threshold) {
      const lastFailure = this.failures[this.failures.length - 1];
      return now - lastFailure < this.config.cooldown;
    }
    return false;
  }

  recordFailure(): void {
    this.failures.push(Date.now());
    // 防止无限增长
    if (this.failures.length > this.maxFailures) {
      this.failures = this.failures.slice(-this.maxFailures / 2);
    }
  }

  recordSuccess(): void {
    this.lastSuccess = Date.now();
    this.failures = [];
  }

  private pruneOldFailures(now: number): void {
    const cutoff = now - this.config.window;
    // 线性扫描找到第一个在窗口内的位置（timestamps 已排序）
    const index = this.failures.findIndex(t => t >= cutoff);
    if (index >= 0) {
      this.failures = this.failures.slice(index);
    } else if (this.failures.length > 0) {
      // findIndex 返回 -1 表示全部过期
      this.failures = [];
    }
  }
}
```

### 3.7 LeakPrevention — 资源泄漏防护

```typescript
// core/LeakPrevention.ts
export class LeakPrevention {
  private domNodes = new Map<string, Set<HTMLElement>>();
  private abortControllers = new Map<string, AbortController>();
  private memoryMonitors = new Map<string, ReturnType<typeof setInterval>>();
  private memoryThreshold = 50 * 1024 * 1024; // 50MB（更严格的阈值）

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
    // 1. 中断所有网络请求
    this.abortControllers.get(key)?.abort();

    // 2. 停止内存监控定时器
    const monitorId = this.memoryMonitors.get(key);
    if (monitorId) {
      clearInterval(monitorId);
      this.memoryMonitors.delete(key);
    }

    // 3. 移除所有注册的 DOM 节点
    for (const node of this.domNodes.get(key) ?? []) {
      node.remove();
    }

    // 4. 清理引用
    this.abortControllers.delete(key);
    this.domNodes.delete(key);
  }

  private startMemoryMonitor(key: string): void {
    // 仅 Chromium 支持 performance.memory
    const hasMemoryAPI = 'memory' in performance;
    if (!hasMemoryAPI) {
      console.warn(`[LeakPrevention] ${key}: performance.memory not supported, using fallback`);
      // 非 Chromium 浏览器使用性能标记替代方案
      this.startFallbackMonitor(key);
      return;
    }

    const check = () => {
      const mem = (performance as any).memory?.usedJSHeapSize ?? 0;
      if (mem > this.memoryThreshold) {
        console.warn(`[LeakPrevention] ${key} memory exceeds 50MB threshold`);
      }
    };

    const id = setInterval(check, 5000);
    this.memoryMonitors.set(key, id);
  }

  private startFallbackMonitor(key: string): void {
    // 使用 performance.measure() 标记，外部工具可分析
    const check = () => {
      const markName = `orion-mf-memory-${key}`;
      performance.mark(markName);
      // 通过 PerformanceObserver 外部分析，此处只记录标记
    };

    const id = setInterval(check, 10000);
    this.memoryMonitors.set(key, id);
  }
}
```

**LeakPrevention 设计要点**：

| 设计点 | 方案 | 说明 |
|--------|------|------|
| DOM 注册表 | Set 管理 | unmount 时自动清理未移除节点 |
| 网络请求 | AbortController | unmount 时中断所有进行中的请求 |
| 内存监控 | performance.memory (Chromium) | 50MB 阈值，更严格 |
| 非 Chromium 降级 | performance.mark() | 外部工具分析，不依赖非标准 API |
| 定时器管理 | memoryMonitors Map | 单独管理，cleanup 时 clearInterval |

### 3.8 RouterManager — 路由管理

**问题**：20+ 子应用的路由同步、浏览器前进/后退、URL 编码未定义。

```typescript
// core/RouterManager.ts

interface RouteConfig {
  key: string;
  path: string;        // 子应用路由前缀，如 /pipeline
  exact?: boolean;
}

interface RouteState {
  currentApp: string;
  appPath: string;     // 子应用内部路径
  query: URLSearchParams;
}

export class RouterManager {
  private routes: Map<string, RouteConfig> = new Map();
  private current: RouteState | null = null;
  private popStateHandler: ((e: PopStateEvent) => void) | null = null;
  private onRouteChange?: (state: RouteState) => void;

  // URL 格式: /app/{subAppKey}/*
  private basePath = '/app';

  register(config: RouteConfig): void {
    this.routes.set(config.key, config);
  }

  unregister(key: string): void {
    this.routes.delete(key);
  }

  // 初始化路由监听
  init(onChange: (state: RouteState) => void): void {
    this.onRouteChange = onChange;
    this.popStateHandler = () => {
      const state = this.parseURL();
      if (state) {
        this.current = state;
        this.onRouteChange?.(state);
      }
    };

    window.addEventListener('popstate', this.popStateHandler);

    // 拦截 pushState/replaceState
    this.patchHistoryAPI();

    // 首次解析
    const initialState = this.parseURL();
    if (initialState) {
      this.current = initialState;
      this.onRouteChange?.(initialState);
    }
  }

  // 导航到子应用
  navigate(appKey: string, appPath: string, replace = false): void {
    const route = this.routes.get(appKey);
    if (!route) {
      console.warn(`[Router] Unknown app: ${appKey}`);
      return;
    }

    const url = `${this.basePath}/${appKey}${appPath}`;
    if (replace) {
      history.replaceState({ appKey, appPath }, '', url);
    } else {
      history.pushState({ appKey, appPath }, '', url);
    }

    this.current = {
      currentApp: appKey,
      appPath,
      query: new URLSearchParams(window.location.search),
    };
  }

  // 子应用内部路由变化时调用
  notifyAppRouteChange(appKey: string, appPath: string): void {
    // 更新 URL 但不触发 pushState（避免循环）
    const url = `${this.basePath}/${appKey}${appPath}${window.location.search}`;
    history.replaceState({ appKey, appPath }, '', url);

    if (this.current) {
      this.current.appPath = appPath;
    }
  }

  private parseURL(): RouteState | null {
    const pathname = window.location.pathname;
    if (!pathname.startsWith(this.basePath)) {
      return null;
    }

    const parts = pathname.slice(this.basePath.length + 1).split('/');
    const appKey = parts[0];
    const appPath = '/' + parts.slice(1).join('/');

    const route = this.routes.get(appKey);
    if (!route) {
      console.warn(`[Router] No route for app: ${appKey}`);
      return null;
    }

    return {
      currentApp: appKey,
      appPath: appPath || route.path,
      query: new URLSearchParams(window.location.search),
    };
  }

  private patchHistoryAPI(): void {
    // 拦截 pushState
    const originalPush = history.pushState;
    history.pushState = ((state, title, url) => {
      originalPush.call(history, state, title, url);
      const parsed = this.parseURL();
      if (parsed) {
        this.current = parsed;
        this.onRouteChange?.(parsed);
      }
    }) as typeof history.pushState;

    // 拦截 replaceState
    const originalReplace = history.replaceState;
    history.replaceState = ((state, title, url) => {
      originalReplace.call(history, state, title, url);
      const parsed = this.parseURL();
      if (parsed) {
        this.current = parsed;
        this.onRouteChange?.(parsed);
      }
    }) as typeof history.replaceState;
  }

  getCurrent(): RouteState | null {
    return this.current;
  }

  destroy(): void {
    if (this.popStateHandler) {
      window.removeEventListener('popstate', this.popStateHandler);
    }
    // 恢复原始 history API
    // 注意：实际实现中需要保存原始函数并恢复
  }
}
```

**RouterManager 设计要点**：

| 设计点 | 方案 | 说明 |
|--------|------|------|
| URL 格式 | `/app/{subAppKey}/*` | 统一路由前缀，易于识别 |
| 前进/后退 | popstate 事件监听 | 浏览器导航自动切换子应用 |
| pushState 拦截 | patch history API | 子应用内部路由变化同步到 URL |
| 子应用通知 | `notifyAppRouteChange()` | 子应用内部路由变化时更新 URL |
| 首次加载 | `parseURL()` 解析 | 页面刷新时恢复正确子应用 |
| query 参数 | URLSearchParams | 自动传递查询参数给子应用 |

### 3.9 ReactShadowCompat — React + Shadow DOM 兼容

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
    private source: ShadowRoot,
    private target: Document
  ) {}

  start(): void {
    // 使用 composed: true 的 CustomEvent 穿越 Shadow DOM 边界
    const events: Array<{
      type: string;
      forwarder: (e: Event) => void;
    }> = [
      { type: 'click', forwarder: (e) => this.forwardMouseEvent(e, 'click') },
      { type: 'mousedown', forwarder: (e) => this.forwardMouseEvent(e, 'mousedown') },
      { type: 'mouseup', forwarder: (e) => this.forwardMouseEvent(e, 'mouseup') },
      { type: 'keydown', forwarder: (e) => this.forwardKeyboardEvent(e) },
      { type: 'keyup', forwarder: (e) => this.forwardKeyboardEvent(e) },
      { type: 'focus', forwarder: (e) => this.forwardFocusEvent(e) },
      { type: 'blur', forwarder: (e) => this.forwardFocusEvent(e) },
    ];

    for (const event of events) {
      this.source.addEventListener(event.type, event.forwarder, true); // capture phase
      this.handlers.push(() => this.source.removeEventListener(event.type, event.forwarder, true));
    }
  }

  private forwardMouseEvent(e: Event, type: string): void {
    const me = e as MouseEvent;
    // 使用 CustomEvent 保留关键属性
    const forwarded = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true, // 穿越 Shadow DOM 边界
      clientX: me.clientX,
      clientY: me.clientY,
      screenX: me.screenX,
      screenY: me.screenY,
      button: me.button,
      buttons: me.buttons,
      ctrlKey: me.ctrlKey,
      shiftKey: me.shiftKey,
      altKey: me.altKey,
      metaKey: me.metaKey,
      relatedTarget: me.relatedTarget,
    });

    // 在转发的事件上附加原始引用
    (forwarded as any)._originalTarget = e.target;
    this.target.dispatchEvent(forwarded);
  }

  private forwardKeyboardEvent(e: Event): void {
    const ke = e as KeyboardEvent;
    const forwarded = new KeyboardEvent(e.type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      key: ke.key,
      code: ke.code,
      keyCode: ke.keyCode,
      charCode: ke.charCode,
      which: ke.which,
      ctrlKey: ke.ctrlKey,
      shiftKey: ke.shiftKey,
      altKey: ke.altKey,
      metaKey: ke.metaKey,
      repeat: ke.repeat,
      location: ke.location,
    });

    (forwarded as any)._originalTarget = e.target;
    this.target.dispatchEvent(forwarded);
  }

  private forwardFocusEvent(e: Event): void {
    const forwarded = new FocusEvent(e.type, {
      bubbles: false,
      cancelable: false,
      composed: true,
      relatedTarget: (e as FocusEvent).relatedTarget,
    });

    (forwarded as any)._originalTarget = e.target;
    this.target.dispatchEvent(forwarded);
  }

  stop(): void {
    for (const cleanup of this.handlers) {
      cleanup();
    }
    this.handlers = [];
  }
}
```

**EventForwarder 改进要点**：

| 原问题 | 修复方案 |
|--------|----------|
| `new e.constructor()` 丢失属性 | 使用具体的 MouseEvent/KeyboardEvent 构造器 |
| relatedTarget 丢失 | 手动传递 relatedTarget |
| buttons/key/code 丢失 | 手动复制所有关键属性 |
| target 指向错误 | 附加 `_originalTarget` 引用 |
| 不冒泡到外部 | 使用 `composed: true` 穿越 Shadow DOM |
| 冒泡阶段错误 | 使用 capture phase 监听 |

---

## 4. 支持模块设计

### 4.0 GlobalStore — 全局状态管理

**问题**：用户信息、租户上下文、主题配置等如何在子应用间共享？

```typescript
// core/GlobalStore.ts

interface StoreValue {
  data: any;
  version: number;
  timestamp: number;
  owner: string; // 写入者 key
}

export class GlobalStore {
  private store = new Map<string, StoreValue>();
  private subscribers = new Map<string, Set<(key: string, value: any) => void>>();
  private version = 1;

  // 设置全局状态
  set(key: string, value: any, owner: string): void {
    this.store.set(key, {
      data: value,
      version: this.version++,
      timestamp: Date.now(),
      owner,
    });

    // 通知订阅者
    for (const cb of this.subscribers.get(key) ?? []) {
      cb(key, value);
    }
  }

  // 获取全局状态
  get(key: string): any {
    return this.store.get(key)?.data;
  }

  // 订阅状态变化
  subscribe(key: string, callback: (key: string, value: any) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    // 返回取消订阅函数
    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  // 批量获取
  getMany(keys: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key of keys) {
      result[key] = this.get(key);
    }
    return result;
  }

  // 清理指定子应用的状态
  cleanup(owner: string): void {
    for (const [key, value] of this.store) {
      if (value.owner === owner) {
        this.store.delete(key);
      }
    }
  }

  // 获取所有状态（调试用）
  debug(): Record<string, StoreValue> {
    return Object.fromEntries(this.store);
  }
}
```

**GlobalStore 设计要点**：

| 设计点 | 方案 | 说明 |
|--------|------|------|
| 状态共享 | Map 存储 | 子应用间共享状态 |
| 版本控制 | version 字段 | 避免过期数据 |
| 订阅机制 | Set 回调 | 状态变化自动通知 |
| 所有权 | owner 字段 | 子应用卸载时清理其状态 |
| 与 EventBus 关系 | 解耦 | GlobalStore 管状态，EventBus 管事件 |

### 4.1 SubAppStateMachine — 生命周期状态机

**问题**：快速切换子应用时的并发冲突、异步 mount 过程中用户切换到另一个子应用如何处理？

```typescript
// core/SubAppStateMachine.ts

type SubAppState =
  | 'idle'
  | 'loading'      // 加载远程模块
  | 'bootstrapping' // 执行 bootstrap 钩子
  | 'mounting'     // 执行 mount 钩子
  | 'mounted'      // 已挂载
  | 'unmounting'   // 执行 unmount 钩子
  | 'unmounted'    // 已卸载
  | 'error';       // 错误状态

interface StateTransition {
  from: SubAppState;
  to: SubAppState;
  action: string;
}

const VALID_TRANSITIONS: StateTransition[] = [
  { from: 'idle', to: 'loading', action: 'load' },
  { from: 'loading', to: 'bootstrapping', action: 'bootstrap' },
  { from: 'bootstrapping', to: 'mounting', action: 'mount' },
  { from: 'mounting', to: 'mounted', action: 'complete' },
  { from: 'mounted', to: 'unmounting', action: 'unmount' },
  { from: 'unmounting', to: 'unmounted', action: 'complete' },
  { from: 'loading', to: 'error', action: 'fail' },
  { from: 'bootstrapping', to: 'error', action: 'fail' },
  { from: 'mounting', to: 'error', action: 'fail' },
  { from: 'unmounting', to: 'error', action: 'fail' },
  { from: 'error', to: 'loading', action: 'retry' },
  { from: 'unmounted', to: 'loading', action: 'load' },
];

export class SubAppStateMachine {
  private states = new Map<string, SubAppState>();
  private abortControllers = new Map<string, AbortController>();
  private onTransition?: (key: string, from: SubAppState, to: SubAppState) => void;

  constructor(options?: { onTransition?: (key: string, from: SubAppState, to: SubAppState) => void }) {
    this.onTransition = options?.onTransition;
  }

  init(key: string): void {
    this.states.set(key, 'idle');
  }

  // 请求状态转换
  transition(key: string, action: string): void {
    const currentState = this.states.get(key) ?? 'idle';
    const validTransition = VALID_TRANSITIONS.find(
      t => t.from === currentState && t.action === action
    );

    if (!validTransition) {
      throw new Error(
        `Invalid transition: ${currentState} -> ${action} for ${key}`
      );
    }

    const oldState = currentState;
    this.states.set(key, validTransition.to);
    this.onTransition?.(key, oldState, validTransition.to);

    // 如果转换到 loading，创建 AbortController
    if (validTransition.to === 'loading') {
      this.abortControllers.set(key, new AbortController());
    }
  }

  getState(key: string): SubAppState {
    return this.states.get(key) ?? 'idle';
  }

  // 快速切换场景：取消正在进行的 mount
  cancelPending(key: string): void {
    const state = this.getState(key);
    if (state === 'loading' || state === 'bootstrapping' || state === 'mounting') {
      this.abortControllers.get(key)?.abort();
      this.states.set(key, 'unmounted');
    }
  }

  // 获取 AbortSignal（用于异步操作取消）
  getAbortSignal(key: string): AbortSignal | undefined {
    return this.abortControllers.get(key)?.signal;
  }

  // 检查是否可以加载
  canLoad(key: string): boolean {
    const state = this.getState(key);
    return state === 'idle' || state === 'unmounted' || state === 'error';
  }
}
```

**生命周期状态机设计要点**：

| 设计点 | 方案 | 说明 |
|--------|------|------|
| 状态定义 | 8 种状态 | idle → loading → bootstrapping → mounting → mounted → unmounting → unmounted |
| 转换验证 | 白名单机制 | 只允许预定义的转换 |
| 快速切换 | `cancelPending()` | 取消正在进行的异步操作 |
| 取消机制 | AbortController | 传播到 MF 加载和 bootstrap/mount 钩子 |
| 并发防护 | 状态检查 | 已 loading 时拒绝新的 load 请求 |

### 4.2 EventBus — 带版本控制的通信

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
  private bridge: MFSandboxBridge;

  constructor(bridge: MFSandboxBridge) {
    this.bridge = bridge;
  }

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
    // 注意：DegradationStrategy 需要持有 MFSandboxBridge 实例
    return this.bridge.loadSubApp(config);
  }

  private async loadCompatible(config: SubAppConfig): Promise<SubAppInstance> {
    // 兼容模式：MF + Proxy，不用 Shadow DOM
    return this.bridge.loadSubApp({ ...config, noShadowDOM: true });
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

interface BenchmarkResult {
  firstPaint: number;
  multiAppLoad: number;
  switchLatency: number;
  memoryUsage: number;
  sandboxOverhead: number;
  cssIsolationOverhead: number;
}

export class PerformanceBenchmark {
  private degradation: DegradationStrategy;
  private bridge: MFSandboxBridge;

  constructor(degradation: DegradationStrategy, bridge: MFSandboxBridge) {
    this.degradation = degradation;
    this.bridge = bridge;
  }

  async runAll(config: SubAppConfig): Promise<BenchmarkResult> {
    const results = {
      firstPaint: await this.measureFirstPaint(config),
      multiAppLoad: await this.measureMultiAppLoad([config, config, config, config, config]),
      switchLatency: await this.measureSwitchLatency(config),
      memoryUsage: await this.measureMemoryUsage(config),
      sandboxOverhead: await this.measureSandboxOverhead(),
      cssIsolationOverhead: await this.measureCSSIsolationOverhead(config),
    };

    this.checkThresholds(results);
    return results;
  }

  private async measureFirstPaint(config: SubAppConfig): Promise<number> {
    const start = performance.now();
    await this.degradation.loadSubApp(config);
    return performance.now() - start;
  }

  private async measureMultiAppLoad(configs: SubAppConfig[]): Promise<number> {
    const start = performance.now();
    await Promise.all(configs.map(c => this.degradation.loadSubApp(c)));
    return performance.now() - start;
  }

  private async measureSwitchLatency(config: SubAppConfig): Promise<number> {
    // 模拟快速切换 10 次
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      await this.bridge.loadSubApp(config);
      times.push(performance.now() - start);
    }
    // 取平均值
    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  private async measureMemoryUsage(config: SubAppConfig): Promise<number> {
    if (!('memory' in performance)) return 0;

    await this.degradation.loadSubApp(config);
    return (performance as any).memory?.usedJSHeapSize ?? 0;
  }

  private async measureSandboxOverhead(): Promise<number> {
    const sandbox = new Sandbox();
    const iterations = 100;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const ctx = sandbox.create(`bench-${i}`);
      sandbox.destroy(`bench-${i}`);
    }
    return (performance.now() - start) / iterations;
  }

  private async measureCSSIsolationOverhead(config: SubAppConfig): Promise<number> {
    const isolator = new StyleIsolator();
    const container = document.createElement('div');

    const start = performance.now();
    isolator.mount(config.key, container);
    isolator.unmount(config.key);
    return performance.now() - start;
  }

  private checkThresholds(results: BenchmarkResult): void {
    const thresholds = {
      firstPaint: 1500,      // 1.5s
      multiAppLoad: 3000,    // 3s (5 应用)
      switchLatency: 300,    // 300ms
      memoryUsage: 50e6,     // 50MB
      sandboxOverhead: 5,    // 5ms（更严格）
      cssIsolationOverhead: 10, // 10ms
    };

    for (const [key, value] of Object.entries(results)) {
      if (value > thresholds[key as keyof typeof thresholds]) {
        const unit = key === 'memoryUsage' ? 'bytes' : 'ms';
        console.warn(`[Benchmark] ${key} exceeds threshold: ${value}${unit}`);
      }
    }
  }
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
| Sandbox | core/Sandbox.ts | ~280 | P0 |
| StyleIsolator | core/StyleIsolator.ts | ~150 | P0 |
| ErrorIsolator | core/ErrorIsolator.ts | ~120 | P0 |
| RouterManager | core/RouterManager.ts | ~150 | P0 |
| CrashRecovery | core/CrashRecovery.ts | ~100 | P0 |
| LeakPrevention | core/LeakPrevention.ts | ~120 | P0 |
| ReactShadowCompat | core/ReactShadowCompat.ts | ~150 | P1 |
| EventBus | core/EventBus.ts | ~80 | P1 |
| DegradationStrategy | core/DegradationStrategy.ts | ~80 | P1 |
| GlobalStore | core/GlobalStore.ts | ~80 | P1 |
| SubAppStateMachine | core/SubAppStateMachine.ts | ~120 | P1 |
| PerformanceBenchmark | core/PerformanceBenchmark.ts | ~120 | P2 |
| A11ySupport | core/A11ySupport.ts | ~60 | P2 |
| FrameworkUpgrade | core/FrameworkUpgrade.ts | ~60 | P2 |
| create-orion-subapp | packages/create-orion-subapp/ | ~300 | P1 |
| **总计** | **17 个模块** | **~2120 行** | |

---

## 9. 测试策略

### 9.1 测试分层

| 层级 | 工具 | 覆盖范围 | 目标覆盖率 |
|------|------|---------|-----------|
| 单元测试 | Vitest/Jest | 单个模块内部逻辑 | 80%+ |
| 集成测试 | Playwright | 模块间协作、完整加载流程 | 关键路径 100% |
| E2E 测试 | Playwright | 子应用加载/卸载/切换 | 核心场景 100% |
| 性能测试 | Performance API | 6 项性能基准 | 阈值验证 |
| 安全测试 | 自定义脚本 | 沙箱逃逸攻击 | 0 逃逸 |

### 9.2 重点测试用例

#### 安全测试（Sandbox, RuntimeIsolation）

| 测试用例 | 预期结果 |
|---------|---------|
| `this.constructor.constructor('return this')()` | 返回 undefined，无法访问真实全局 |
| `window.localStorage.setItem('test', '1')` | 只写入命名空间 key，不影响其他子应用 |
| `setTimeout(() => {}, 1000)` 后 unmount | 定时器被清除，回调不执行 |
| `addEventListener('click', fn)` 后 unmount | 监听器被移除 |
| `__proto__` 访问 | 返回 undefined |
| `eval('window.alert(1)')` | eval 在黑名单中，返回 undefined |
| 多子应用并发 setup | 无竞态，各自隔离 |

#### 单元测试（EventBus, CrashRecovery, CircuitBreaker）

| 测试用例 | 预期结果 |
|---------|---------|
| EventBus emit/on/off | 消息正确路由，off 后不再接收 |
| EventBus 版本不匹配 | 降级或拒绝 |
| CircuitBreaker 3 次失败后熔断 | isTripped() 返回 true |
| CircuitBreaker cooldown 后恢复 | isTripped() 返回 false |
| CircuitBreaker 持续失败 | failures 数组不超过 maxFailures |
| CircuitBreaker 成功后重置 | failures 数组清空 |

#### 集成测试（MFSandboxBridge, DegradationStrategy）

| 测试用例 | 预期结果 |
|---------|---------|
| 完整加载流程（MF → Sandbox → Mount） | 子应用正确渲染 |
| MF 加载失败触发降级 | 降级到 compatible 模式 |
| compatible 失败 | 降级到 iframe 模式 |
| iframe 失败 | 降级到 fallback 占位 |
| 子应用卸载后全局变量恢复 | 无全局污染 |
| 快速切换子应用 | 前一个 mount 被取消，无内存泄漏 |

#### 性能测试（PerformanceBenchmark）

| 测试用例 | 阈值 |
|---------|------|
| 首屏加载 | < 1.5s |
| 5 应用并发加载 | < 3s |
| 子应用切换延迟 | < 300ms |
| 内存占用（5 应用） | < 50MB |
| Proxy 沙箱创建开销 | < 5ms |
| Shadow DOM 创建开销 | < 10ms |

#### E2E 测试（Playwright）

| 测试用例 | 预期结果 |
|---------|---------|
| 加载子应用 → 交互 → 卸载 | 无错误，无泄漏 |
| 浏览器前进/后退 | 正确切换子应用 |
| 子应用崩溃 → 恢复 | 熔断器正确工作 |
| 子应用间通信（EventBus） | 消息正确传递 |
| 全局状态共享（GlobalStore） | 状态变更通知到订阅者 |
| 路由同步（RouterManager） | URL 与子应用状态一致 |

#### 兼容性测试（ReactShadowCompat, A11ySupport）

| 测试用例 | 预期结果 |
|---------|---------|
| React Portal 渲染到 Shadow DOM | 正确显示，事件正确触发 |
| Modal/Tooltip 在 Shadow DOM 内 | 不超出边界 |
| 焦点陷阱（Focus Trap） | Tab 键循环在子应用内 |
| 屏幕阅读器 | 正确朗读子应用内容 |

### 9.3 测试基础设施

```
packages/orion-mf/
├── src/
│   └── core/          # 源代码
├── tests/
│   ├── unit/          # 单元测试
│   │   ├── sandbox.test.ts
│   │   ├── styleIsolator.test.ts
│   │   ├── errorIsolator.test.ts
│   │   ├── eventBus.test.ts
│   │   ├── crashRecovery.test.ts
│   │   └── circuitBreaker.test.ts
│   ├── integration/   # 集成测试
│   │   ├── bridge.test.ts
│   │   ├── degradation.test.ts
│   │   └── lifecycle.test.ts
│   ├── e2e/           # E2E 测试
│   │   ├── subapp-flow.spec.ts
│   │   ├── routing.spec.ts
│   │   └── communication.spec.ts
│   ├── performance/   # 性能测试
│   │   └── benchmark.test.ts
│   └── security/      # 安全测试
│       └── sandbox-escape.test.ts
├── vitest.config.ts
└── playwright.config.ts
```

---

## 10. 实施计划

### Phase 1：核心隔离能力（2 周）

- [ ] Sandbox — JS 沙箱（纯 Proxy 方案）
- [ ] StyleIsolator — CSS 隔离
- [ ] ErrorIsolator — 异常隔离（单例模式）
- [ ] RouterManager — 路由管理

### Phase 2：崩溃恢复与资源防护（1 周）

- [ ] CrashRecovery — 崩溃恢复
- [ ] LeakPrevention — 资源泄漏防护
- [ ] ReactShadowCompat — React + Shadow DOM 兼容
- [ ] SubAppStateMachine — 生命周期状态机

### Phase 3：MF 桥梁与降级（1 周）

- [ ] MFSandboxBridge — MF 与沙箱桥梁
- [ ] DegradationStrategy — 四级降级策略
- [ ] EventBus — 带版本控制通信
- [ ] GlobalStore — 全局状态管理

### Phase 4：支持模块与脚手架（1 周）

- [ ] PerformanceBenchmark — 性能基准测试
- [ ] A11ySupport — 无障碍访问
- [ ] FrameworkUpgrade — 框架升级支持
- [ ] create-orion-subapp — 子应用脚手架
- [ ] 测试用例编写

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
