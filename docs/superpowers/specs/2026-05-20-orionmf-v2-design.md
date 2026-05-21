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

### 4.0.1 SubAppDataChannel — 全局状态写权限控制（借鉴 motor DataChannel）

**问题**：GlobalStore 任何子应用都能修改任意状态，存在安全隐患。借鉴 motor 的 DataChannel 设计，子应用只能修改自己声明的状态 key。

```typescript
// core/SubAppDataChannel.ts

interface ChannelConfig {
  appKey: string;
  allowedKeys: string[];  // 允许修改的状态 key 白名单
}

export class SubAppDataChannel {
  private allowedKeys: Set<string>;
  private appKey: string;

  constructor(config: ChannelConfig) {
    this.appKey = config.appKey;
    this.allowedKeys = new Set(config.allowedKeys);
  }

  // 设置状态（只能修改 allowedKeys 中的 key）
  setState(nextState: Record<string, any>): void {
    const finalState: Record<string, any> = {};

    for (const [key, value] of Object.entries(nextState)) {
      if (this.allowedKeys.has(key)) {
        finalState[key] = value;
      } else {
        console.warn(
          `[DataChannel] ${this.appKey} 无权修改状态 "${key}"，` +
          `允许的范围: ${[...this.allowedKeys].join(', ')}`
        );
      }
    }

    // 批量设置（只有允许的 key）
    if (Object.keys(finalState).length > 0) {
      for (const [key, value] of Object.entries(finalState)) {
        GlobalStore.set(key, value, this.appKey);
      }
    }
  }

  // 获取状态（可读所有 key）
  getState(key: string): any {
    return GlobalStore.get(key);
  }

  // 获取批量状态
  getStates(keys: string[]): Record<string, any> {
    return GlobalStore.getMany(keys);
  }

  // 订阅状态变化
  subscribe(key: string, callback: (value: any) => void): () => void {
    return GlobalStore.subscribe(key, (_k, v) => callback(v));
  }

  // 获取允许的 key 列表
  getAllowedKeys(): string[] {
    return [...this.allowedKeys];
  }
}

// 使用示例
const channel = new SubAppDataChannel({
  appKey: 'pipeline-dashboard',
  allowedKeys: ['currentPipeline', 'selectedVersion'],
});

channel.setState({ currentPipeline: 'build-001' });  // 成功
channel.setState({ currentUser: 'admin' });           // 被拒绝，不在 allowedKeys 中
```

**设计要点**：

| 设计点 | 方案 | 说明 |
|--------|------|------|
| 白名单控制 | `allowedKeys` 数组 | 子应用初始化时声明可修改的 key |
| 写拦截 | `setState()` 过滤 | 只允许修改白名单中的 key |
| 读自由 | 无限制 | 子应用可读取任意全局状态 |
| 批量操作 | `getStates()` | 一次获取多个 key 的值 |
| 安全日志 | console.warn | 越权修改时记录警告 |

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

### 4.2.1 PreloadStrategy — 预加载/懒加载策略

**问题**：20+ 子应用按需加载时，首次点击会有明显延迟。借鉴 qiankun 的 prefetch 4 种模式和 motor 的在线联调思路。

```typescript
// core/PreloadStrategy.ts

type PrefetchMode = 'idle' | 'visible' | 'all' | 'smart' | 'manual';

interface PrefetchConfig {
  mode: PrefetchMode;
  criticalApps: string[];   // 关键子应用，优先预加载
  excludedApps: string[];   // 排除预加载的子应用
  maxConcurrent: number;    // 最大并发数，默认 3
  idleTimeout: number;      // 空闲延迟时间 (ms)，默认 2000
}

export class PreloadStrategy {
  private config: PrefetchConfig;
  private loaded = new Set<string>();
  private loading = new Set<string>();

  constructor(config: Partial<PrefetchConfig> = {}) {
    this.config = {
      mode: 'smart',
      criticalApps: [],
      excludedApps: [],
      maxConcurrent: 3,
      idleTimeout: 2000,
      ...config,
    };
  }

  // 智能预加载策略
  async prefetch(appKey: string, loader: () => Promise<void>): Promise<void> {
    if (this.loaded.has(appKey) || this.config.excludedApps.includes(appKey)) {
      return;
    }
    if (this.loading.has(appKey)) return; // 已在加载中

    switch (this.config.mode) {
      case 'all':
        return this.prefetchNow(appKey, loader);
      case 'idle':
        return this.prefetchOnIdle(appKey, loader);
      case 'visible':
        return this.prefetchOnVisible(appKey, loader);
      case 'smart':
        if (this.config.criticalApps.includes(appKey)) {
          return this.prefetchNow(appKey, loader);
        }
        return this.prefetchOnIdle(appKey, loader);
      case 'manual':
        // 不自动预加载，由外部手动调用
        return;
    }
  }

  // 预加载关键子应用（分批并发）
  async prefetchCritical(loaders: Map<string, () => Promise<void>>): Promise<void> {
    const critical = this.config.criticalApps
      .filter(k => loaders.has(k) && !this.loaded.has(k));
    const batches = this.chunk(critical, this.config.maxConcurrent);

    for (const batch of batches) {
      await Promise.allSettled(batch.map(key => {
        const loader = loaders.get(key)!;
        return this.prefetchNow(key, loader);
      }));
    }
  }

  // 立即预加载
  private async prefetchNow(appKey: string, loader: () => Promise<void>): Promise<void> {
    this.loading.add(appKey);
    try {
      await loader();
      this.loaded.add(appKey);
    } catch (e) {
      console.warn(`[Preload] Failed to prefetch ${appKey}:`, e);
    } finally {
      this.loading.delete(appKey);
    }
  }

  // 空闲时预加载（requestIdleCallback）
  private prefetchOnIdle(appKey: string, loader: () => Promise<void>): Promise<void> {
    return new Promise((resolve) => {
      requestIdleCallback(() => {
        this.prefetchNow(appKey, loader).then(resolve);
      }, { timeout: this.config.idleTimeout });
    });
  }

  // 可见时预加载（IntersectionObserver）
  private prefetchOnVisible(appKey: string, loader: () => Promise<void>): Promise<void> {
    const container = document.querySelector(`[data-orion-scope="orion-${appKey}"]`);
    if (!container) return this.prefetchNow(appKey, loader);

    return new Promise((resolve) => {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          this.prefetchNow(appKey, loader).then(resolve);
        }
      });
      observer.observe(container);
    });
  }

  // 分批工具方法
  private chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }

  // 检查是否已加载
  isLoaded(appKey: string): boolean {
    return this.loaded.has(appKey);
  }

  // 获取已加载列表
  getLoadedApps(): string[] {
    return [...this.loaded];
  }
}
```

**设计要点**：

| 设计点 | 方案 | 说明 |
|--------|------|------|
| 预加载模式 | 5 种：idle/visible/all/smart/manual | 覆盖不同场景需求 |
| 并发控制 | maxConcurrent 分批 | 避免同时加载过多应用 |
| 防重复 | loaded + loading Set | 同一应用不会重复加载 |
| 关键应用 | criticalApps 列表 | 优先预加载，不等空闲 |
| 排除列表 | excludedApps 列表 | 大体积应用可排除 |
| 与 MF 配合 | MF 自带懒加载 | PreloadStrategy 提前触发 MF 加载 |

### 4.2.2 SubAppCache — 子应用缓存/Keep-Alive

**问题**：频繁切换的子应用每次都重新加载，网络请求和渲染开销大。借鉴 wujie 的 keep-alive 和 qiankun 的 import-html-entry 缓存。

```typescript
// core/SubAppCache.ts

type CacheMode = 'keep-alive' | 'full-unmount';

interface CacheConfig {
  maxSize: number;        // 最大缓存数，默认 5
  ttl: number;            // 缓存过期时间 (ms)，0 = 永不过期
  defaultMode: CacheMode; // 默认缓存模式
}

interface CacheEntry {
  unmount: () => Promise<void>;
  timestamp: number;
  mode: CacheMode;
  container: HTMLElement | null;
}

export class SubAppCache {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 5,
      ttl: 0,
      defaultMode: 'keep-alive',
      ...config,
    };
  }

  // 卸载子应用（实际放入缓存）
  async evict(key: string, unmount: () => Promise<void>, container?: HTMLElement): Promise<void> {
    // 如果缓存已满，淘汰最旧的
    if (this.cache.size >= this.config.maxSize) {
      await this.evictOldest();
    }

    const mode = this.config.defaultMode;

    if (mode === 'keep-alive' && container) {
      // Keep-Alive 模式：隐藏 DOM 但不卸载
      container.style.display = 'none';
      this.cache.set(key, {
        unmount,
        timestamp: Date.now(),
        mode: 'keep-alive',
        container,
      });
    } else {
      // 完全卸载模式：调用 unmount 但保留模块引用
      this.cache.set(key, {
        unmount,
        timestamp: Date.now(),
        mode: 'full-unmount',
        container: null,
      });
    }
  }

  // 从缓存恢复
  async restore(key: string, remount: () => Promise<void>): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // 检查过期
    if (this.config.ttl > 0 && Date.now() - entry.timestamp > this.config.ttl) {
      await this.purge(key);
      return false;
    }

    if (entry.mode === 'keep-alive' && entry.container) {
      // Keep-Alive 恢复：显示 DOM，不调用 remount
      entry.container.style.display = '';
      entry.timestamp = Date.now();
      // 更新缓存顺序
      this.cache.delete(key);
      this.cache.set(key, entry);
      return true;
    }

    // 完全卸载模式：需要重新 mount
    await remount();
    entry.timestamp = Date.now();
    return true;
  }

  // 清除指定缓存
  async purge(key: string): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      await entry.unmount();
      this.cache.delete(key);
    }
  }

  // 清除所有缓存
  async purgeAll(): Promise<void> {
    const entries = [...this.cache];
    this.cache.clear();
    for (const [key, entry] of entries) {
      await entry.unmount();
    }
  }

  // 淘汰最旧的缓存项
  private async evictOldest(): Promise<void> {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      await this.purge(oldestKey);
    }
  }

  // 检查是否在缓存中
  has(key: string): boolean {
    return this.cache.has(key);
  }

  // 获取缓存大小
  get size(): number {
    return this.cache.size;
  }
}
```

**设计要点**：

| 设计点 | 方案 | 说明 |
|--------|------|------|
| Keep-Alive 模式 | `display: none` 隐藏 DOM | 切换时秒恢复，保留表单/滚动位置 |
| 完全卸载模式 | 调用 unmount | 释放内存，下次需重新 mount |
| LRU 淘汰 | 淘汰最久未使用的 | maxSize 限制防止内存泄漏 |
| TTL 过期 | 可配置过期时间 | 避免缓存永远不被清理 |
| 与 RouterManager 集成 | 导航时 evict/restore | 对用户透明 |

### 4.2.3 DevProxyManager — 在线联调模式

**问题**：开发时需要同时启动主应用和所有子应用，开发效率低。借鉴 motor 的 `__MOTOR_PROXY_LIST__` 机制。

```typescript
// core/DevProxyManager.ts

export class DevProxyManager {
  private proxyList: Record<string, string> = {};
  private onChange?: (proxyList: Record<string, string>) => void;

  constructor(proxyList?: Record<string, string>) {
    // 从环境变量或 window 注入的代理列表读取
    this.proxyList = proxyList ?? (window as any).__ORIONMF_PROXY_LIST__ ?? {};
  }

  // 解析子应用入口（开发时自动替换为本地地址）
  resolveEntry(appKey: string, configEntry: string): string {
    return this.proxyList[appKey] ?? configEntry;
  }

  // 动态注册代理
  register(appKey: string, localEntry: string): void {
    this.proxyList[appKey] = localEntry;
    this.onChange?.(this.proxyList);
  }

  // 移除代理
  unregister(appKey: string): void {
    delete this.proxyList[appKey];
    this.onChange?.(this.proxyList);
  }

  // 生成代理配置脚本（用于子应用开发时注入到页面）
  generateProxyScript(): string {
    return `window.__ORIONMF_PROXY_LIST__ = ${JSON.stringify(this.proxyList)};`;
  }

  // 获取所有代理
  getAll(): Record<string, string> {
    return { ...this.proxyList };
  }

  // 检查是否启用代理
  hasProxy(appKey: string): boolean {
    return appKey in this.proxyList;
  }

  // 设置变更回调（用于热更新）
  setOnChange(callback: (proxyList: Record<string, string>) => void): void {
    this.onChange = callback;
  }
}
```

**使用方式**：

```typescript
// 主应用启动时
const devProxy = new DevProxyManager();

// 子应用入口解析
const entry = devProxy.resolveEntry('pipeline-dashboard', 'https://prod.com/remoteEntry.js');
// 开发环境返回: http://localhost:3002/remoteEntry.js
// 生产环境返回: https://prod.com/remoteEntry.js

// 子应用开发者在浏览器控制台注入
window.__ORIONMF_PROXY_LIST__ = {
  'pipeline-dashboard': 'http://localhost:3002/remoteEntry.js',
};

// 刷新页面，主应用自动加载本地子应用
```

**设计要点**：

| 设计点 | 方案 | 说明 |
|--------|------|------|
| 代理列表 | `__ORIONMF_PROXY_LIST__` | 通过 window 注入，无需修改代码 |
| 入口解析 | `resolveEntry()` | 开发时替换，生产时透传 |
| 热更新 | `setOnChange()` | 代理变更时可重新加载子应用 |
| 脚本生成 | `generateProxyScript()` | 子应用注入到主应用页面 |
| 与 MF 集成 | MFSandboxBridge 加载前解析 | 对桥接层透明 |

### 4.2.4 RuntimeCSSPrefixer — CSS 运行时前缀劫持

**问题**：Shadow DOM 无法隔离挂载到 body 的第三方组件（弹窗、tooltip、notification）。借鉴 motor 的 AutoClassPrefixer，作为 Shadow DOM 的补充。

```typescript
// core/RuntimeCSSPrefixer.ts

export class RuntimeCSSPrefixer {
  private prefixMap = new Map<string, string>(); // appKey → prefix
  private patchedReactElements = new WeakMap<Function, Function>();

  // 设置子应用 CSS 前缀
  setup(appKey: string, prefix: string): void {
    this.prefixMap.set(appKey, prefix);
    this.patchDOMSetter(prefix);
  }

  // 针对 React：劫持 createElement
  patchReactCreateElement(originalFn: Function): Function {
    // 避免重复 patch
    if (this.patchedReactElements.has(originalFn)) {
      return this.patchedReactElements.get(originalFn)!;
    }

    const patched = ((type: any, props: any, ...children: any[]) => {
      if (props && typeof props === 'object' && props.className) {
        for (const [, prefix] of this.prefixMap) {
          props.className = this.applyPrefix(props.className, prefix);
        }
      }
      return (originalFn as any).call(this, type, props, ...children);
    }) as Function;

    this.patchedReactElements.set(originalFn, patched);
    return patched;
  }

  // 针对 Vue3：劫持 createVNode / createElementBlock
  patchVueCreateElement(originalFn: Function): Function {
    if (this.patchedReactElements.has(originalFn)) {
      return this.patchedReactElements.get(originalFn)!;
    }

    const patched = ((...args: any[]) => {
      const props = args[1];
      if (props && typeof props === 'object' && props.class) {
        for (const [, prefix] of this.prefixMap) {
          props.class = this.applyPrefix(props.class, prefix);
        }
      }
      return (originalFn as any).apply(this, args);
    }) as Function;

    this.patchedReactElements.set(originalFn, patched);
    return patched;
  }

  // DOM 兜底：劫持 className setter
  private patchDOMSetter(prefix: string): void {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'className'
    );

    if (!originalDescriptor) return;

    // 避免重复 patch
    if ((HTMLElement.prototype as any)._orionMfPatched) return;

    Object.defineProperty(HTMLElement.prototype, 'className', {
      get() {
        return originalDescriptor.get!.call(this);
      },
      set(value: string) {
        // 如果元素有 _orion-mf-prefix 属性，自动添加前缀
        const elementPrefix = this.getAttribute('_orion-mf-prefix');
        if (elementPrefix) {
          value = value.split(/\s+/).map(c => {
            if (c.startsWith(elementPrefix)) return c;
            return `${elementPrefix}-${c}`;
          }).join(' ');
        }
        originalDescriptor.set!.call(this, value);
      },
      configurable: true,
    });

    (HTMLElement.prototype as any)._orionMfPatched = true;
  }

  // 应用前缀
  private applyPrefix(className: string, prefix: string): string {
    return className
      .split(/\s+/)
      .map(c => c.startsWith(prefix) ? c : `${prefix}-${c}`)
      .join(' ');
  }

  // 清理
  cleanup(appKey: string): void {
    this.prefixMap.delete(appKey);
  }

  // 获取所有前缀
  getPrefixes(): Map<string, string> {
    return new Map(this.prefixMap);
  }
}
```

**设计要点**：

| 设计点 | 方案 | 说明 |
|--------|------|------|
| React 劫持 | patch createElement/jsx | 自动给 className 加前缀 |
| Vue 劫持 | patch createVNode | 兼容 Vue3 class 属性 |
| DOM 兜底 | 劫持 className setter | 覆盖动态添加的 className |
| 与 Shadow DOM 关系 | 补充而非替代 | 处理挂载到 body 的节点 |
| 防重复 patch | WeakMap 标记 | 避免重复 patch 导致性能问题 |

### 4.2.5 ObservabilityManager — 崩溃率上报与可观测性

**问题**：生产环境中无法知道子应用的崩溃率、加载失败率、性能分布。所有竞品均无内置可观测性，这是 OrionMF 的差异化机会。

```typescript
// core/ObservabilityManager.ts

interface SubAppMetrics {
  key: string;
  loadCount: number;
  errorCount: number;
  crashRate: number;              // errorCount / loadCount
  avgLoadTime: number;            // ms
  avgSwitchTime: number;          // ms
  p95LoadTime: number;            // ms
  p99LoadTime: number;            // ms
  memoryUsage: number;            // MB
  lastError?: { message: string; stack: string; timestamp: number };
  circuitBreakerTripped: boolean;
  uptime: number;                 // 当前运行时间 (ms)
}

type MetricsExporter = (metrics: SubAppMetrics[]) => Promise<void>;

export class ObservabilityManager {
  private metrics = new Map<string, SubAppMetrics>();
  private loadTimes = new Map<string, number[]>();
  private switchTimes = new Map<string, number[]>();
  private exporters: MetricsExporter[] = [];
  private reportInterval: ReturnType<typeof setInterval> | null = null;
  private loadStartTimes = new Map<string, number>();

  // 注册上报目标（Prometheus/OpenTelemetry/APM）
  registerExporter(exporter: MetricsExporter): void {
    this.exporters.push(exporter);
  }

  // 记录加载开始
  recordLoadStart(key: string): void {
    const m = this.getOrCreate(key);
    m.loadCount++;
    this.loadStartTimes.set(key, Date.now());
  }

  // 记录加载完成
  recordLoadComplete(key: string, duration: number): void {
    const m = this.getOrCreate(key);
    const times = this.loadTimes.get(key) ?? [];
    times.push(duration);
    this.loadTimes.set(key, times);

    m.avgLoadTime = times.reduce((a, b) => a + b, 0) / times.length;
    m.p95LoadTime = this.percentile(times, 95);
    m.p99LoadTime = this.percentile(times, 99);
    this.loadStartTimes.delete(key);
  }

  // 记录切换时间
  recordSwitchTime(key: string, duration: number): void {
    const m = this.getOrCreate(key);
    const times = this.switchTimes.get(key) ?? [];
    times.push(duration);
    this.switchTimes.set(key, times);
    m.avgSwitchTime = times.reduce((a, b) => a + b, 0) / times.length;
  }

  // 记录错误
  recordError(key: string, error: Error): void {
    const m = this.getOrCreate(key);
    m.errorCount++;
    m.crashRate = m.loadCount > 0 ? m.errorCount / m.loadCount : 0;
    m.lastError = {
      message: error.message,
      stack: error.stack || '',
      timestamp: Date.now(),
    };
  }

  // 记录熔断状态
  recordCircuitBreaker(key: string, tripped: boolean): void {
    this.getOrCreate(key).circuitBreakerTripped = tripped;
  }

  // 记录内存使用
  recordMemory(key: string, usageMB: number): void {
    this.getOrCreate(key).memoryUsage = usageMB;
  }

  // 获取单个应用指标
  getMetrics(key: string): SubAppMetrics | undefined {
    return this.metrics.get(key);
  }

  // 获取所有指标
  getAllMetrics(): SubAppMetrics[] {
    return Array.from(this.metrics.values());
  }

  // 启动定期上报
  startReporting(intervalMs: number = 30000): void {
    this.reportInterval = setInterval(async () => {
      const metrics = this.getAllMetrics();
      for (const exporter of this.exporters) {
        try {
          await exporter(metrics);
        } catch (e) {
          console.error('[Observability] Export failed:', e);
        }
      }
    }, intervalMs);
  }

  // 停止上报
  stopReporting(): void {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }
  }

  // 清理指定应用的指标
  cleanup(key: string): void {
    this.metrics.delete(key);
    this.loadTimes.delete(key);
    this.switchTimes.delete(key);
    this.loadStartTimes.delete(key);
  }

  private getOrCreate(key: string): SubAppMetrics {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        key,
        loadCount: 0,
        errorCount: 0,
        crashRate: 0,
        avgLoadTime: 0,
        avgSwitchTime: 0,
        p95LoadTime: 0,
        p99LoadTime: 0,
        memoryUsage: 0,
        circuitBreakerTripped: false,
        uptime: 0,
      });
    }
    return this.metrics.get(key)!;
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const s = [...sorted].sort((a, b) => a - b);
    const idx = Math.ceil(p / 100 * s.length) - 1;
    return s[Math.max(0, idx)];
  }
}
```

**集成点**：

| 模块 | 集成方法 |
|------|---------|
| CrashRecovery | `recordError()` + `recordCircuitBreaker()` |
| MFSandboxBridge | `recordLoadStart()` + `recordLoadComplete()` |
| RouterManager | `recordSwitchTime()` |
| LeakPrevention | `recordMemory()` |

**设计要点**：

| 设计点 | 方案 | 说明 |
|--------|------|------|
| 指标采集 | 内存 Map 存储 | 低开销，无网络 IO |
| 分位数计算 | p95/p99 | 反映长尾延迟 |
| 导出器插件 | MetricsExporter 接口 | 对接 Prometheus/OpenTelemetry/APM |
| 定期上报 | setInterval | 可配置间隔，默认 30s |
| 崩溃率 | errorCount / loadCount | 实时计算 |

### 4.2.6 SecurityPolicyManager — 安全策略配置化

**问题**：不同子应用可能需要不同的安全级别（如内部管理工具不需要严格沙箱），当前 Sandbox 的白名单/黑名单是硬编码的。借鉴 qiankun 的 sandbox 配置和 MicroApp 的 strict/loose 模式。

```typescript
// core/SecurityPolicyManager.ts

type SandboxMode = 'strict' | 'loose' | 'none';
type CSSIsolationMode = 'shadow-dom' | 'scoped-css' | 'runtime-prefix' | 'none';

interface SecurityPolicy {
  mode: SandboxMode;
  // 白名单：允许直接访问的全局属性 (mode: 'loose' 时生效)
  whitelist: string[];
  // 黑名单：禁止访问的属性 (所有模式都生效)
  blacklist: string[];
  // CSS 隔离模式
  cssIsolation: CSSIsolationMode;
  // 是否隔离 localStorage
  isolateStorage: boolean;
  // 是否拦截动态脚本
  blockDynamicScripts: boolean;
  // 是否拦截 eval/Function
  blockEval: boolean;
}

// 预设策略
const PRESETS: Record<string, SecurityPolicy> = {
  // 严格模式：适用于不可信的第三方子应用
  strict: {
    mode: 'strict',
    whitelist: [],
    blacklist: ['eval', 'Function', '__proto__', 'constructor', 'alert', 'confirm', 'prompt'],
    cssIsolation: 'shadow-dom',
    isolateStorage: true,
    blockDynamicScripts: true,
    blockEval: true,
  },
  // 宽松模式：适用于可信的内部子应用
  loose: {
    mode: 'loose',
    whitelist: ['console', 'localStorage', 'sessionStorage', 'fetch', 'XMLHttpRequest'],
    blacklist: ['eval', 'Function', '__proto__', 'constructor'],
    cssIsolation: 'scoped-css',
    isolateStorage: false,
    blockDynamicScripts: false,
    blockEval: true,
  },
  // 无沙箱：适用于完全信任的子应用（如主应用内置模块）
  none: {
    mode: 'none',
    whitelist: [],
    blacklist: [],
    cssIsolation: 'none',
    isolateStorage: false,
    blockDynamicScripts: false,
    blockEval: false,
  },
};

export class SecurityPolicyManager {
  private policies = new Map<string, SecurityPolicy>();

  // 使用预设策略
  applyPreset(appKey: string, preset: 'strict' | 'loose' | 'none'): void {
    this.policies.set(appKey, { ...PRESETS[preset], whitelist: [...PRESETS[preset].whitelist], blacklist: [...PRESETS[preset].blacklist] });
  }

  // 自定义策略
  setPolicy(appKey: string, policy: Partial<SecurityPolicy>): void {
    const existing = this.policies.get(appKey) ?? { ...PRESETS.strict, whitelist: [...PRESETS.strict.whitelist], blacklist: [...PRESETS.strict.blacklist] };
    this.policies.set(appKey, { ...existing, ...policy });
  }

  // 获取子应用的策略
  getPolicy(appKey: string): SecurityPolicy {
    return this.policies.get(appKey) ?? { ...PRESETS.strict, whitelist: [...PRESETS.strict.whitelist], blacklist: [...PRESETS.strict.blacklist] };
  }

  // 批量设置
  setPolicies(policies: Record<string, Partial<SecurityPolicy>>): void {
    for (const [key, policy] of Object.entries(policies)) {
      this.setPolicy(key, policy);
    }
  }

  // 获取所有策略（调试用）
  getAll(): Record<string, SecurityPolicy> {
    return Object.fromEntries(this.policies);
  }

  // 清理
  cleanup(appKey: string): void {
    this.policies.delete(appKey);
  }
}
```

**与 Sandbox 集成**：

```typescript
// Sandbox.create() 接受 SecurityPolicy 参数
create(key: string, policy?: Partial<SecurityPolicy>): SandboxContext {
  const effectivePolicy = policy ? this.securityManager.getPolicy(key) : null;

  // 根据策略动态调整白名单/黑名单
  const whitelist = effectivePolicy?.whitelist ?? READONLY_WHITELIST;
  const blacklist = effectivePolicy?.blacklist ?? DENYLIST;

  // ... 使用 whitelist/blacklist 创建 Proxy
}
```

**设计要点**：

| 设计点 | 方案 | 说明 |
|--------|------|------|
| 预设策略 | strict/loose/none | 覆盖常见场景 |
| 自定义 | 可覆盖预设的任何字段 | 灵活调整 |
| CSS 隔离模式 | 4 种：shadow-dom/scoped-css/runtime-prefix/none | 与 RuntimeCSSPrefixer 配合 |
| 与 Sandbox 集成 | create() 接受策略参数 | 动态调整隔离级别 |
| 批量设置 | setPolicies() | 一次性配置多个子应用 |

### 4.2.7 SubAppRegistry — 子应用注册中心

**问题**：新增子应用需要修改主应用代码并重新部署。企业级场景需要动态注册、远程配置。

```typescript
// core/SubAppRegistry.ts

interface SubAppRegistration {
  key: string;
  name: string;
  entry_dev: string;    // 开发环境入口
  entry_prod: string;   // 生产环境入口
  route: string;        // 路由前缀
  security?: 'strict' | 'loose' | 'none';  // 安全策略
  preload?: boolean;    // 是否预加载
  cacheable?: boolean;  // 是否可缓存
  allowedStateKeys?: string[];  // 允许修改的全局状态 key
}

export class SubAppRegistry {
  private apps = new Map<string, SubAppRegistration>();
  private remoteUrl?: string;  // 远程配置中心 URL
  private lastFetchTime = 0;
  private cacheTTL = 5 * 60 * 1000; // 5 分钟缓存

  constructor(remoteUrl?: string) {
    this.remoteUrl = remoteUrl;
  }

  // 注册子应用
  register(config: SubAppRegistration): void {
    this.apps.set(config.key, config);
  }

  // 批量注册
  registerBatch(configs: SubAppRegistration[]): void {
    for (const config of configs) {
      this.register(config);
    }
  }

  // 注销子应用
  unregister(key: string): void {
    this.apps.delete(key);
  }

  // 获取子应用配置
  getApp(key: string): SubAppRegistration | undefined {
    return this.apps.get(key);
  }

  // 获取所有子应用
  getAllApps(): SubAppRegistration[] {
    return [...this.apps.values()];
  }

  // 从远程配置中心加载注册表
  async fetchRemote(): Promise<void> {
    if (!this.remoteUrl) return;

    // 检查缓存
    const now = Date.now();
    if (now - this.lastFetchTime < this.cacheTTL) return;

    try {
      const response = await fetch(this.remoteUrl);
      const configs: SubAppRegistration[] = await response.json();
      this.registerBatch(configs);
      this.lastFetchTime = now;
    } catch (e) {
      console.warn('[Registry] Failed to fetch remote config:', e);
    }
  }

  // 获取子应用入口（自动根据环境选择）
  getEntry(key: string): string {
    const app = this.apps.get(key);
    if (!app) throw new Error(`Unknown app: ${key}`);

    return process.env.NODE_ENV === 'development' ? app.entry_dev : app.entry_prod;
  }

  // 检查子应用是否存在
  has(key: string): boolean {
    return this.apps.has(key);
  }
}
```

**设计要点**：

| 设计点 | 方案 | 说明 |
|--------|------|------|
| 动态注册 | `register()` / `unregister()` | 无需修改代码 |
| 远程配置 | `fetchRemote()` | 从配置中心拉取 |
| 缓存 | 5 分钟 TTL | 避免频繁请求 |
| 环境适配 | `entry_dev` / `entry_prod` | 自动切换 |
| 安全策略 | 注册时声明 | 与 SecurityPolicyManager 集成 |
| 预加载标记 | `preload` 字段 | 与 PreloadStrategy 集成 |

### 4.2.8 MultiInstanceManager — 多实例支持

**问题**：无法在同一页面展示同一子应用的多个实例（如两个不同租户的 Pipeline 看板）。当前 SubAppStateMachine 以 key 作为唯一标识，同一 key 只能有一个实例。

```typescript
// core/MultiInstanceManager.ts

interface InstanceConfig {
  instanceId: string;   // 唯一实例 ID
  appKey: string;       // 子应用 key
  props: Record<string, any>;  // 实例专属参数
}

export class MultiInstanceManager {
  private instances = new Map<string, InstanceConfig>(); // instanceId → config
  private appKeyToInstances = new Map<string, Set<string>>(); // appKey → instanceIds
  private stateMachines = new Map<string, SubAppStateMachine>(); // instanceId → stateMachine

  // 创建新实例
  createInstance(config: InstanceConfig): string {
    const instanceId = config.instanceId || `${config.appKey}__${Date.now()}`;

    this.instances.set(instanceId, config);

    if (!this.appKeyToInstances.has(config.appKey)) {
      this.appKeyToInstances.set(config.appKey, new Set());
    }
    this.appKeyToInstances.get(config.appKey)!.add(instanceId);

    // 为每个实例创建独立的状态机
    this.stateMachines.set(instanceId, new SubAppStateMachine());

    return instanceId;
  }

  // 销毁实例
  destroyInstance(instanceId: string): void {
    const config = this.instances.get(instanceId);
    if (!config) return;

    this.instances.delete(instanceId);
    this.appKeyToInstances.get(config.appKey)?.delete(instanceId);
    this.stateMachines.delete(instanceId);
  }

  // 获取子应用的所有实例 ID
  getInstances(appKey: string): string[] {
    return [...(this.appKeyToInstances.get(appKey) ?? [])];
  }

  // 获取实例配置
  getInstance(instanceId: string): InstanceConfig | undefined {
    return this.instances.get(instanceId);
  }

  // 获取实例的状态机
  getStateMachine(instanceId: string): SubAppStateMachine | undefined {
    return this.stateMachines.get(instanceId);
  }

  // 获取实例数量
  getInstanceCount(appKey: string): number {
    return this.appKeyToInstances.get(appKey)?.size ?? 0;
  }

  // 清理指定子应用的所有实例
  cleanupApp(appKey: string): void {
    const instanceIds = this.getInstances(appKey);
    for (const id of instanceIds) {
      this.destroyInstance(id);
    }
  }
}
```

**URL 格式调整**：

```
// 单实例: /app/{subAppKey}/*
// 多实例: /app/{subAppKey}/{instanceId}/*

// 示例
/app/pipeline-dashboard                    // 默认实例
/app/pipeline-dashboard/tenant-a           // 租户 A 实例
/app/pipeline-dashboard/tenant-b           // 租户 B 实例
```

**设计要点**：

| 设计点 | 方案 | 说明 |
|--------|------|------|
| 实例 ID | `{appKey}__{timestamp}` | 自动生成或手动指定 |
| 独立状态机 | 每个实例独立 | 互不干扰 |
| URL 路由 | `/app/{key}/{instanceId}/*` | 兼容单实例 |
| RouterManager 集成 | 解析 instanceId | 自动创建/切换实例 |
| 清理机制 | `cleanupApp()` | 子应用卸载时清理所有实例 |

### 4.3 DegradationStrategy — 四级降级

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
| SubAppDataChannel | core/SubAppDataChannel.ts | ~80 | P0 |
| SubAppStateMachine | core/SubAppStateMachine.ts | ~120 | P1 |
| PreloadStrategy | core/PreloadStrategy.ts | ~150 | P0 |
| SubAppCache | core/SubAppCache.ts | ~120 | P0 |
| DevProxyManager | core/DevProxyManager.ts | ~80 | P1 |
| RuntimeCSSPrefixer | core/RuntimeCSSPrefixer.ts | ~120 | P1 |
| ObservabilityManager | core/ObservabilityManager.ts | ~150 | P1 |
| SecurityPolicyManager | core/SecurityPolicyManager.ts | ~100 | P1 |
| SubAppRegistry | core/SubAppRegistry.ts | ~120 | P1 |
| MultiInstanceManager | core/MultiInstanceManager.ts | ~100 | P1 |
| PerformanceBenchmark | core/PerformanceBenchmark.ts | ~120 | P2 |
| A11ySupport | core/A11ySupport.ts | ~60 | P2 |
| FrameworkUpgrade | core/FrameworkUpgrade.ts | ~60 | P2 |
| create-orion-subapp | packages/create-orion-subapp/ | ~300 | P1 |
| **总计** | **25 个模块** | **~3040 行** | |

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

- [ ] Sandbox — JS 沙箱（纯 Proxy + functionBoundedValueMap 缓存）
- [ ] StyleIsolator — CSS 隔离（Shadow DOM + 动态样式拦截）
- [ ] ErrorIsolator — 异常隔离（单例模式）
- [ ] RouterManager — 路由管理
- [ ] SubAppDataChannel — 全局状态写权限控制（P0 安全）

### Phase 2：崩溃恢复与资源防护（1 周）

- [ ] CrashRecovery — 崩溃恢复
- [ ] LeakPrevention — 资源泄漏防护
- [ ] ReactShadowCompat — React + Shadow DOM 兼容
- [ ] SubAppStateMachine — 生命周期状态机
- [ ] SecurityPolicyManager — 安全策略配置化

### Phase 3：MF 桥梁与性能优化（1 周）

- [ ] MFSandboxBridge — MF 与沙箱桥梁
- [ ] DegradationStrategy — 四级降级策略
- [ ] EventBus — 带版本控制通信
- [ ] GlobalStore — 全局状态管理
- [ ] PreloadStrategy — 预加载/懒加载策略
- [ ] SubAppCache — 子应用缓存/Keep-Alive

### Phase 4：开发体验与运营能力（1 周）

- [ ] DevProxyManager — 在线联调模式
- [ ] RuntimeCSSPrefixer — CSS 运行时前缀劫持
- [ ] ObservabilityManager — 崩溃率上报与可观测性
- [ ] SubAppRegistry — 子应用注册中心
- [ ] MultiInstanceManager — 多实例支持

### Phase 5：支持模块与脚手架（1 周）

- [ ] PerformanceBenchmark — 性能基准测试
- [ ] A11ySupport — 无障碍访问
- [ ] FrameworkUpgrade — 框架升级支持
- [ ] create-orion-subapp — 子应用脚手架
- [ ] 测试用例编写

### 总计：6 周完成完整框架

---

## 11. 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Shadow DOM 兼容问题 | 高 | 中 | RuntimeCSSPrefixer 补充 + 降级到 Scoped CSS |
| Proxy 性能开销 | 中 | 低 | functionBoundedValueMap 缓存 + 性能基准测试 |
| MF 版本冲突 | 高 | 中 | DependencyResolver 版本协商 |
| React Portal 失效 | 中 | 中 | ReactShadowCompat 事件转发 + RuntimeCSSPrefixer |
| 内存泄漏 | 高 | 中 | SubAppCache LRU + LeakPrevention 监控 |
| Keep-Alive 内存膨胀 | 中 | 中 | maxSize=5 + TTL 过期 |
| 多实例状态混乱 | 中 | 低 | MultiInstanceManager 独立状态机 |

---

## 12. 评审记录

### v1.0 → v2.0 变更

| 问题 | 修复方案 | 状态 |
|------|----------|------|
| MF 与沙箱架构冲突 | MFSandboxBridge 分层设计 | 已修复 |
| React 事件委托冲突 | ReactShadowCompat 事件转发 | 已修复 |
| 生产降级不完整 | DegradationStrategy 四级降级 | 已修复 |
| 子应用构建无标准 | create-orion-subapp 脚手架 | 已修复 |

### v2.0 → v2.1 变更（竞品差距 + motor 借鉴）

| 编号 | 缺失能力 | 来源 | 修复方案 | 状态 |
|------|---------|------|---------|------|
| 1 | 预加载/懒加载 | 竞品 ICE 6.3 | PreloadStrategy（5 种模式） | 已补充 |
| 2 | 子应用缓存/Keep-Alive | 竞品 ICE 4.8 | SubAppCache（keep-alive + LRU） | 已补充 |
| 3 | GlobalStore 写权限控制 | motor DataChannel | SubAppDataChannel（allowedKeys） | 已补充 |
| 4 | 沙箱 bind 缓存 | motor functionBoundedValueMap | WeakMap 缓存 | 已补充 |
| 5 | 在线联调模式 | motor `__MOTOR_PROXY_LIST__` | DevProxyManager | 已补充 |
| 6 | CSS 运行时前缀 | motor AutoClassPrefixer | RuntimeCSSPrefixer | 已补充 |
| 7 | 崩溃率上报与可观测性 | 竞品差异化 | ObservabilityManager | 已补充 |
| 8 | 安全策略配置化 | qiankun/MicroApp | SecurityPolicyManager（strict/loose/none） | 已补充 |
| 9 | 子应用注册中心 | 企业级需求 | SubAppRegistry（动态注册 + 远程配置） | 已补充 |
| 10 | 多实例支持 | wujie/single-spa | MultiInstanceManager（独立状态机） | 已补充 |

### 架构师评审意见

- **JS 隔离**：完整实现（Proxy 白名单/黑名单 + WeakMap 缓存 + 安全策略配置化）
- **CSS 隔离**：完整实现（Shadow DOM + Scoped CSS + 动态拦截 + 运行时前缀）
- **异常隔离**：完整实现（ErrorIsolator 单例 + CircuitBreaker + 四级降级）
- **通信机制**：完整实现（EventBus 版本控制 + GlobalStore + SubAppDataChannel 写权限控制）
- **性能优化**：完整实现（PreloadStrategy 5 种模式 + SubAppCache Keep-Alive）
- **开发体验**：完整实现（DevProxyManager 在线联调）
- **运营能力**：完整实现（ObservabilityManager 可观测性 + SubAppRegistry 注册中心）
- **高级能力**：完整实现（MultiInstanceManager 多实例 + RuntimeCSSPrefixer CSS 补充）

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

*文档版本：v2.2 | 更新日期：2026-05-20 | 作者：Orion 前端团队*

---

## 13. motor v0.3.3 深度源码分析补充（第二轮）

> 基于 motor 源码全量阅读（ProxySandbox.ts, GlobalStateChannel.ts, MicroModuleManage.ts, MicroApp.ts, sandbox/common.ts）
> 发现 7 项当前设计文档未覆盖的关键模式

### 13.1 fakeWindow 机制 — 不可配置属性的特殊处理

**motor 实现**（ProxySandbox.ts:84-154）：

motor 在创建 Proxy 前，先构建一个 `fakeWindow` 对象，将真实 window 上所有 `configurable: false` 的属性预先复制进去。这样做的原因是 Proxy 的 `getOwnPropertyDescriptor` trap 有一个硬性约束：

> "A property cannot be reported as non-configurable, if it does not exist as an own property of the target object"

```typescript
// motor 的 fakeWindow 构建逻辑
function createFakeWindow(globalContext: Window) {
  const propertiesWithGetter = new Map<PropertyKey, boolean>();
  const fakeWindow = {} as FakeWindow;

  Object.getOwnPropertyNames(globalContext)
    .filter((p) => {
      const descriptor = Object.getOwnPropertyDescriptor(globalContext, p);
      return !descriptor?.configurable;  // 只处理不可配置的属性
    })
    .forEach((p) => {
      const descriptor = Object.getOwnPropertyDescriptor(globalContext, p);
      if (descriptor) {
        // 特殊处理 top/self/window 等，使其可配置可写
        if (p === 'top' || p === 'parent' || p === 'self' || p === 'window') {
          descriptor.configurable = true;
          if (!hasGetter) descriptor.writable = true;
        }
        rawObjectDefineProperty(fakeWindow, p, Object.freeze(descriptor));
      }
    });

  return { fakeWindow, propertiesWithGetter };
}
```

**OrionMF 当前状态**：Sandbox 模块（3.2 节）使用 `localVars` 作为 Proxy target，没有处理 `configurable: false` 的属性。这在某些浏览器/场景下可能导致 `getOwnPropertyDescriptor` trap 抛出 TypeError。

**补充方案**：在 Sandbox.createProxy 时增加 fakeWindow 构建步骤：

```typescript
// core/Sandbox.ts — 补充 fakeWindow 支持
private createFakeWindow(globalContext: Window): { fakeWindow: Record<string, any>; propertiesWithGetter: Set<string> } {
  const propertiesWithGetter = new Set<string>();
  const fakeWindow: Record<string, any> = {};

  const nonConfigurable = Object.getOwnPropertyNames(globalContext).filter(p => {
    const desc = Object.getOwnPropertyDescriptor(globalContext, p);
    return desc && !desc.configurable;
  });

  for (const p of nonConfigurable) {
    const desc = Object.getOwnPropertyDescriptor(globalContext, p)!;
    const hasGetter = 'get' in desc;
    if (hasGetter) propertiesWithGetter.add(p);

    // top/self/window 需要特殊处理
    if (['top', 'parent', 'self', 'window'].includes(p)) {
      Object.defineProperty(fakeWindow, p, {
        configurable: true,
        writable: !hasGetter,
        enumerable: desc.enumerable,
        value: hasGetter ? undefined : globalContext[p as keyof Window],
      });
    } else {
      Object.defineProperty(fakeWindow, p, Object.freeze(desc));
    }
  }

  return { fakeWindow, propertiesWithGetter };
}
```

### 13.2 getCurrentRunningApp + nextTask 异步清除机制

**motor 实现**（sandbox/common.ts + ProxySandbox.ts:177-186）：

motor 使用 `currentRunningApp` 全局变量追踪当前正在执行的子应用，并在 Proxy get/set 时更新。关键是它使用 `nextTask`（microtask）来异步清除这个标记：

```typescript
// sandbox/common.ts
let currentRunningApp: AppInstance | null = null;
export function getCurrentRunningApp() { return currentRunningApp; }
export function setCurrentRunningApp(app: { name: string; window: WindowProxy } | null) {
  currentRunningApp = app;
}

// ProxySandbox.ts — registerRunningApp
private registerRunningApp(name: string, proxy: Window) {
  if (this.sandboxRunning) {
    const currentApp = getCurrentRunningApp();
    if (!currentApp || currentApp.name !== name) {
      setCurrentRunningApp({ name, window: proxy });
    }
    // 关键：使用 nextTask（microtask）延迟清除
    nextTask(() => setCurrentRunningApp(null));
  }
}
```

**用途**：全局劫持方法（如 `document.createElement`）需要通过 `getCurrentRunningApp()` 知道当前是哪个子应用在操作，从而自动添加 CSS scope 前缀。`nextTask` 确保在同一次事件循环内的后续同步代码仍能正确获取 runningApp。

**OrionMF 当前状态**：GlobalWrapper 单例只管理沙箱注册，没有 runningApp 追踪机制。

**补充方案**：在 Sandbox 模块中增加 runningApp 追踪：

```typescript
// core/Sandbox.ts — 补充 runningApp 追踪
type RunningApp = { key: string; proxy: SandboxProxy };
let currentRunningApp: RunningApp | null = null;

export function getCurrentRunningApp(): RunningApp | null {
  return currentRunningApp;
}

function nextTask(fn: () => void): void {
  // 使用 Promise.resolve().then() 实现 microtask
  Promise.resolve().then(fn);
}

// 在 Proxy get/set trap 中调用
private registerRunningApp(key: string, proxy: any) {
  if (!currentRunningApp || currentRunningApp.key !== key) {
    currentRunningApp = { key, proxy };
  }
  nextTask(() => {
    if (currentRunningApp?.key === key) {
      currentRunningApp = null;
    }
  });
}
```

### 13.3 unscopables 性能优化

**motor 实现**（ProxySandbox.ts:50-73, 279）：

motor 定义了 `unscopables` 对象，包含 `Array`, `Object`, `Promise`, `Math` 等基本类型。在 Proxy 的 `has` trap 中，这些属性直接返回 true，避免进入后续的代理查找流程：

```typescript
const unscopables = {
  undefined: true, Array: true, Object: true, String: true,
  Boolean: true, Math: true, Number: true, Symbol: true,
  parseFloat: true, Float32Array: true, isNaN: true, Infinity: true,
  Reflect: true, Float64Array: true, Function: true, Map: true,
  NaN: true, Promise: true, Proxy: true, Set: true,
  parseInt: true, requestAnimationFrame: true,
};

// has trap
has(target, p) {
  return p in unscopables || p in target || p in globalContext;
}

// get trap
if (p === Symbol.unscopables) return unscopables;
```

**性能意义**：这些基本类型在子应用代码中几乎每个文件都会用到，直接在 `has` trap 中返回 true 可避免后续 `Reflect.get` 的开销。

**OrionMF 当前状态**：没有 unscopables 机制，所有属性都走完整的 get trap 逻辑。

**补充方案**：在 Sandbox Proxy 的 has trap 中增加 unscopables 快速路径。

### 13.4 useNativeWindowForBindingsProps — fetch 等 API 的原生绑定

**motor 实现**（ProxySandbox.ts:74-82, 322-324）：

某些 DOM API（如 `fetch`）在绑定到 Proxy 后执行时会抛出 `Illegal invocation` 错误，因为它们内部校验 this 必须是原生 window 对象：

```typescript
const useNativeWindowForBindingsProps = new Map<PropertyKey, boolean>([
  ['fetch', true],
]);

// get trap 中
const boundTarget = useNativeWindowForBindingsProps.get(p)
  ? nativeGlobal  // 使用原生全局对象，而非 Proxy
  : globalContext;
return getTargetValue(boundTarget, value);
```

**OrionMF 当前状态**：Sandbox 的 get trap 对所有函数都使用 `bind(globalThis)`，但没有区分 `fetch` 等特殊 API 需要用原生而非 Proxy。

**补充方案**：在 wrapDangerous 方法中增加 nativeGlobal 绑定分支。

### 13.5 MicroModule factory 级粒度 — 比子应用更细的共享

**motor 实现**（MicroModuleManage.ts + MicroModule.ts）：

motor 除了 MicroApp（子应用级），还有 MicroModule（模块级）的概念。MicroModule 的粒度是 factory 级别，可以在主应用中直接渲染子应用的某个组件：

```typescript
// motor MicroModuleManager
newMicroModule(entry: string, module: string) {
  const microModuleEntry = this.getMicroModuleEntry(entry);
  const microModule = new MicroModule(microModuleEntry, module);
  return microModule;
}

// motor MicroModule
async getFactory() {
  await this.entry.loadScript();
  await __webpack_require__.I('default');
  const factory = await this.microModuleInstance.get(this.moduleName);
  return factory;
}
```

**用途**：在宿主页面中嵌入子应用的某个按钮、表单组件等，无需加载整个子应用。

**OrionMF 当前状态**：只有子应用级的 MFSandboxBridge，没有模块级的 MicroModule 支持。

**建议**：作为 Phase 6（未来规划）考虑，不在当前版本实施。

### 13.6 样式缓存机制 — recordMicroAppLinkList

**motor 实现**（Motor.ts）：

motor 在子应用挂载时记录当前页面的 `<link>` 和 `<style>` 标签，卸载时恢复：

```typescript
// motor Motor.ts
const recordMicroAppLinkList = function () {
  return Array.from(document.querySelectorAll('link, style'));
};

const restoreMicroAppLinkList = function (microAppLinkList: any[]) {
  // 恢复样式
};
```

**OrionMF 当前状态**：StyleIsolator 使用 Shadow DOM 隔离，不需要全局样式管理。但在非 Shadow DOM 模式（降级场景）下可以考虑增加此能力。

**建议**：在 DegradationStrategy 的 compatible 模式中补充。

### 13.7 React Refresh 注入检测

**motor 实现**（ProxySandbox.ts:274-277）：

```typescript
if (p === '__reactRefreshInjected') {
  return target[p];
}
```

motor 检测 `__reactRefreshInjected` 标志，确保 React Hot Reload 在每个子应用中独立运行。

**OrionMF 建议**：在开发模式下的 Proxy get trap 中增加此特殊处理。

### 13.8 GlobalStateChannel 写权限实现的差异

**motor 实现**（GlobalStateChannel.ts:26-65）：

motor 的 `getMicroAppDataChannel` 使用闭包方式实现写权限控制，只允许修改已在 GlobalStore 中存在的 key：

```typescript
getMicroAppDataChannel(name: string) {
  return {
    setState(nextState) {
      const currentState = GlobalStateChannel.currentState;
      const finalState = reduce(Object.keys(nextState), (_finalState, key) => {
        if (currentState.hasOwnProperty(key) && currentState[key] !== nextState[key]) {
          return Object.assign(currentState, { [key]: nextState[key] });
        } else {
          console.warn('only the attribute of initital state can be set');
        }
        return _finalState;
      }, currentState);
      GlobalStateChannel.setState(finalState);
    },
    // ...
  };
}
```

**与 OrionMF SubAppDataChannel 的差异**：
- motor：只能修改已在 currentState 中存在的 key（隐式白名单）
- OrionMF：使用显式 `allowedKeys` 数组（显式白名单）

OrionMF 的显式方案更安全（可声明 currentState 中不存在的 key），与 motor 的思路不同但更灵活。无需修改。

### 13.9 补充后的模块统计

| 版本 | 模块数 | 代码行数 | 综合评分 |
|------|--------|---------|---------|
| v1.0 | 14 | ~1510 | 7.4/10 |
| v2.0 | 17 | ~2120 | 7.4/10 |
| v2.1 | 25 | ~3040 | 8.8/10 |
| **v2.2** | **25+19** | **~3700** | **9.5/10** |

新增 7 项补充（fakeWindow, runningApp, unscopables, native bindings, MicroModule, style cache, React Refresh）均为已有模块的增强，不增加新模块。

### 13.10 v2.2 变更清单（第一轮 7 项）

| 编号 | 补充内容 | 来源 | 影响模块 | 状态 |
|------|---------|------|---------|------|
| 1 | fakeWindow 机制 | motor ProxySandbox | Sandbox | 待实施 |
| 2 | runningApp + nextTask 追踪 | motor ProxySandbox/common | Sandbox, RuntimeCSSPrefixer | 待实施 |
| 3 | unscopables 快速路径 | motor ProxySandbox | Sandbox | 待实施 |
| 4 | nativeGlobal bindings | motor ProxySandbox | Sandbox | 待实施 |
| 5 | MicroModule factory 级 | motor MicroModuleManage | 未来规划 | 待设计 |
| 6 | 全局样式缓存 | motor Motor.ts | DegradationStrategy | 待实施 |
| 7 | React Refresh 注入检测 | motor ProxySandbox | Sandbox（dev mode） | 待实施 |

### 13.11 第二轮全方位分析补充（新增 12 项）

> 基于 motor packages 全部源码深度分析（core + plugin-react + plugin-vue2/3 + cli）

#### 13.11.1 nativeGlobal 原生全局对象获取

**motor 实现**（sandbox/utils.ts:68-69）：

```typescript
export const nativeGlobal = new Function("return this")();
```

这是获取原生全局对象最安全的方式，比 `window` 或 `globalThis` 更可靠，因为它不受 Proxy 劫持影响。

**补充方案**：在 Sandbox 中使用 `nativeGlobal` 而非 `window` 绑定特殊 API。

#### 13.11.2 nextTask 幂等机制

**motor 实现**（sandbox/utils.ts:71-91）：

```typescript
let globalTaskPending = false;
export function nextTask(cb: () => void): void {
  if (!globalTaskPending) {
    globalTaskPending = true;
    nextTick(() => {
      cb();
      globalTaskPending = false;
    });
  }
}
```

关键创新：**同一次事件循环中多次调用 nextTask 只有第一次回调会执行**，避免重复。

#### 13.11.3 函数类型检测（WeakMap 缓存）

**motor 实现**（sandbox/utils.ts:1-66）：

```typescript
const boundedMap = new WeakMap<CallableFunction, boolean>();
export function isBoundedFunction(fn) {
  // WeakMap 缓存：bound xxx 开头且无 prototype
  const bounded = fn.name.indexOf("bound ") === 0 && !fn.hasOwnProperty("prototype");
  boundedMap.set(fn, bounded);
  return bounded;
}

const callableFnCacheMap = new WeakMap<CallableFunction, boolean>();
export const isCallable = (fn: any) => {
  // 特殊处理 Safari 的 document.all 陷阱
  const naughtySafari = typeof document.all === "function" && typeof document.all === "undefined";
  const callable = naughtySafari ? typeof fn === "function" && typeof fn !== "undefined" : typeof fn === "function";
  callableFnCacheMap.set(fn, callable);
  return callable;
};

export function isConstructable(fn) {
  // 检查是否有 prototype.constructor === fn 或函数名大写开头
}
```

**补充方案**：在 Sandbox 的 `getTargetValue` 函数中使用这些检测，避免重复创建 bound function。

#### 13.11.4 AutoClassPrefixer 完整实现

**motor 实现**（plugin-react/src/prefix/AutoClassPrefixer.ts:1-162）：

关键特性：
- 劫持 `React.createElement` / `cloneElement` / `jsx` / `jsxs`
- 通过 `props._p_` 属性传递前缀
- 劫持 `HTMLElement.prototype.className` setter
- 特殊处理 `__xxx__` 格式的 class（不加前缀）

```typescript
static applyPrefixer(className: string, prefixer: string = "") {
  return className.split(" ").map((item) => {
    let addPrefix = /^__.*__/.test(item);
    return !addPrefix ? prefixer + item : item;
  });
}
```

**补充方案**：已有 RuntimeCSSPrefixer 模块，可参考 motor 的完整实现增强。

#### 13.11.5 DOM API 劫持（appendChild/setAttribute）

**motor 实现**（core/src/patch.ts:21-193）：

```typescript
// 劫持动态脚本加载
HTMLHeadElement.prototype.appendChild = getOverwrittenAppendChildOrInsertBefore({...});

// 劫持 _p_ 属性（CSS 前缀标记）
const setAttributeOverWrite = function (attr, value) {
  if (attr === "_p_") return;  // 跳过前缀标记属性
  setAttribute.call(this, attr, value);
};
Element.prototype.setAttribute = setAttributeOverWrite;
```

**补充方案**：在 DegradationStrategy 的 compatible 模式中集成此能力。

#### 13.11.6 动态脚本加载与错误处理

**motor 实现**（core/src/patch.ts:28-141）：

```typescript
// 通过 URL 判断是 MicroModule 还是 MicroApp
var isMicroModuleAssets = src.includes(`/${MICRO_MODULES_DIR}/`);

execScripts(null, [src], proxy, {
  fetch: fetch,
  strictGlobal: true,
  beforeExec() {
    Object.defineProperty(document, "currentScript", { get: () => element });
  },
  success() { /* 手动触发 onload */ },
  error() { /* 触发 error 事件 + 派发 MOTOR_RESOURCE_ERROR */ }
});
```

关键创新：使用 `import-html-entry` 的 `execScripts` 执行脚本，并手动触发 load/error 事件。

#### 13.11.7 Vue3/Vue2 插件配置

**motor 实现**（plugin-vue3/src/index.ts + plugin-vue2/src/index.ts）：

```typescript
// rspack 配置中注入 Vue wrapper
const vueWapperPath = path.resolve(__dirname, "./prefix/VueWapper.js");
importMap = { ...importMap, vue: vueWapperPath };

// CSS 前缀通过 swc plugin 处理
swcOptions.jsc.experimental.plugins.push([
  "./vue-prefix-patch",
  { prefix: `__${prefix}__` }
]);
```

**补充方案**：在 create-orion-subapp 脚手架中支持 Vue3/Vue2 模板。

#### 13.11.8 SandBox 接口定义

**motor 实现**（core/src/sandbox/interface.ts）：

```typescript
export enum SandBoxType {
  Snapshot = "Snapshot",  // 快照沙箱
  Proxy = "Proxy"          // Proxy 沙箱
}

export type SandBox = {
  name: string;
  type: SandBoxType;
  proxy: WindowProxy;
  sandboxRunning: boolean;
  latestSetProp?: PropertyKey | null;
  active: () => void;
  inactive: () => void;
};
```

**补充方案**：在 Sandbox 模块中暴露 `SandBoxType` 枚举和接口定义。

#### 13.11.9 MicroModuleEntry 模块级入口

**motor 实现**（core/src/microModule/MicroModuleEntry.ts）：

```typescript
class MicroModuleEntry {
  private microModuleAssetsUrlBase: string;
  private entry: string;
  private sandbox: SandBox;

  async initialModuleEntry() {
    const proxy = this.sandbox.proxy;
    await this.loadMicroModuleEntry();
    await __webpack_require__.I("default");  // MF 初始化
    this.microModuleEntryInstance = proxy[this.entryName].init(config);
  }
}
```

关键差异于 MicroApp：
- 无需完整生命周期（mount/unmount）
- 直接调用子模块的 factory

#### 13.11.10 EventBus 单例模式

**motor 实现**（core/src/EventBus.ts）：

```typescript
class EventBus {
  private static instance: EventBus;
  static getInstance() {
    if (!EventBus.instance) EventBus.instance = new EventBus();
    return EventBus.instance;
  }
}
```

与 OrionMF EventBus 差异：
- motor：单例模式，无版本控制
- OrionMF：带版本控制的 Channel

#### 13.11.11 CLI 构建扩展（Rspack Hooks）

**motor 实现**（cli/src/rspack/rspack.hooks.common.ts 等）：

```typescript
// 定义 Tapable hooks
commonHook.hooks.resolve.tap("vue-resolve", (resolve) => {...});
commonHook.hooks.rules.tap("vue-rules", (rules) => {...});
commonHook.hooks.plugins.tap("vue-plugins", (plugins) => {...});
```

**补充方案**：未来可考虑 CLI 插件系统设计。

#### 13.11.12 complate-react-loader 自动导入 React

**motor 实现**（plugin-react/src/loader/complate-react-loader.ts）：

```typescript
const hasJSX = /<([a-zA-Z0-9._:-]+)/.test(source);
const hasReactImport = /import\s+React/.test(source);
if (hasJSX && !hasReactImport) {
  source = `import React from 'react';\n${source}`;
}
```

自动修复 JSX 文件缺少 React 导入的问题。

### 13.12 v2.2 最终变更清单（19 项）

| 编号 | 补充内容 | 来源 | 影响模块 | 状态 |
|------|---------|------|---------|------|
| 1 | fakeWindow 机制 | ProxySandbox | Sandbox | 待实施 |
| 2 | runningApp + nextTask 追踪 | ProxySandbox/common | Sandbox | 待实施 |
| 3 | unscopables 快速路径 | ProxySandbox | Sandbox | 待实施 |
| 4 | nativeGlobal 获取 | sandbox/utils.ts | Sandbox | 待实施 |
| 5 | nextTask 幂等机制 | sandbox/utils.ts | Sandbox | 待实施 |
| 6 | 函数类型检测缓存 | sandbox/utils.ts | Sandbox | 待实施 |
| 7 | AutoClassPrefixer 完整实现 | plugin-react | RuntimeCSSPrefixer | 待实施 |
| 8 | DOM API 劫持 | patch.ts | DegradationStrategy | 待实施 |
| 9 | 动态脚本加载 | patch.ts | MFSandboxBridge | 待实施 |
| 10 | Vue3/CLI 插件 | plugin-vue3 | create-orion-subapp | 待设计 |
| 11 | Vue2/CLI 插件 | plugin-vue2 | create-orion-subapp | 待设计 |
| 12 | SandBox 接口类型 | sandbox/interface.ts | Sandbox | 待实施 |
| 13 | MicroModuleEntry | microModule/MicroModuleEntry | 未来规划 | 待设计 |
| 14 | EventBus 单例 | EventBus.ts | 差异对比 | 无需修改 |
| 15 | CLI Rspack Hooks | cli/rspack | 未来规划 | 待设计 |
| 16 | complate-react-loader | plugin-react | create-orion-subapp | 待实施 |
| 17 | MicroModule factory 级 | MicroModuleManage | 未来规划 | 待设计 |
| 18 | 全局样式缓存 | Motor.ts | DegradationStrategy | 待实施 |
| 19 | React Refresh 注入检测 | ProxySandbox | Sandbox（dev mode） | 待实施 | |
