# 微前端竞品功能对比与 OrionMF v2.0 差距分析

> 分析日期：2026-05-20
> 分析范围：qiankun / wujie / MicroApp / single-spa / Module Federation
> 信息来源：官方文档 + 行业知识 + GitHub 仓库
> 综合评分方法论：ICE (Impact × Confidence × Ease)

---

## 1. 功能对比表

### 1.1 核心隔离能力

| 维度 | qiankun (蚂蚁) | wujie (腾讯) | MicroApp (京东) | single-spa | Module Federation | OrionMF v2.0 当前设计 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **沙箱机制** | Proxy (LEGACY: Snapshot) | iframe (Shadow DOM 注入) | Proxy (降级: Snapshot) | 无 (依赖子应用) | 无 (依赖宿主) | **Proxy + 白名单/黑名单** |
| **CSS 隔离** | Shadow DOM (严格) / Scoped CSS (实验) | Shadow DOM 天然隔离 | Scoped CSS (默认) | 无 (依赖子应用) | 无 (依赖子应用) | **Shadow DOM + Scoped CSS + 动态拦截** |
| **JS 隔离** | Proxy 沙箱 / Snapshot 沙箱 | iframe 天然隔离 | Proxy 沙箱 | 无隔离 | 无隔离 | **Proxy + localVars 优先 + 原型链保护** |
| **localStorage 隔离** | 不支持 | iframe 天然隔离 | Scoped Storage | 不支持 | 不支持 | **ScopedStorage 命名空间** |
| **定时器/事件清理** | 部分支持 (Proxy 包装) | iframe 天然隔离 | 部分支持 | 不支持 | 不支持 | **Sandbox.destroy() 显式清理** |

### 1.2 路由与通信

| 维度 | qiankun | wujie | MicroApp | single-spa | Module Federation | OrionMF v2.0 当前设计 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **路由同步** | 基于 URL 规则 activeRule | url 同步 (props 传递) | 自动同步 (data 属性) | Application 级别路由 | 无 (依赖应用自身) | **RouterManager + popstate 拦截** |
| **pushState/replaceState 拦截** | 支持 | 支持 | 支持 | 不支持 | 不支持 | **patchHistoryAPI** |
| **通信机制** | initGlobalState (中央状态) | props + CustomEvent | CustomEvent + data 属性 | CustomEvents | 共享模块 (运行时) | **EventBus v2 + GlobalStore** |
| **通信版本控制** | 不支持 | 不支持 | 不支持 | 不支持 | 版本协商 (Webpack) | **EventBus Channel 带 version** |
| **子应用间直接通信** | 不支持 (需通过主应用) | CustomEvent 跨应用 | CustomEvent 跨应用 | 不支持 | 支持 (共享模块) | **EventBus 频道机制** |

### 1.3 性能与加载

| 维度 | qiankun | wujie | MicroApp | single-spa | Module Federation | OrionMF v2.0 当前设计 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **预加载** | prefetch (all / 白名单 / 智能) | preload (preload 属性控制) | prefetch (智能预加载) | 支持 (自定义) | 远程模块懒加载 | **未设计** |
| **懒加载** | 支持 | 支持 | 支持 | 支持 | 原生支持 | **未明确设计** |
| **缓存策略** | import-html-entry 缓存 | Shadow DOM keep-alive | 组件缓存 | 应用缓存 | 远程模块缓存 | **未设计** |
| **共享依赖** | externals (配置式) | iframe 天然共享 | externals (配置式) | 无 | **原生共享模块** | **MF 运行时共享** |
| **首次加载优化** | prefetch 策略 | preload 策略 | prefetch 策略 | import 优化 | 共享依赖减少重复 | **未设计** |

### 1.4 错误处理与降级

| 维度 | qiankun | wujie | MicroApp | single-spa | Module Federation | OrionMF v2.0 当前设计 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **错误捕获** | addGlobalUncaughtErrorHandler | iframe 天然隔离 | addGlobalUncaughtErrorHandler | onError 回调 | 依赖宿主 | **ErrorIsolator + ErrorBoundary** |
| **崩溃恢复** | 不支持 | iframe 天然隔离 | 不支持 | SKIP_BECAUSE_BROKEN 状态 | 不支持 | **CircuitBreaker 熔断器** |
| **降级策略** | 不支持 | 不支持 | 不支持 | 不支持 | 不支持 | **四级降级 (Full → Compatible → iframe → Fallback)** |
| **错误路由 (来源识别)** | 不支持 | iframe 天然隔离 | 不支持 | 不支持 | 不支持 | **filename/stack 匹配子应用** |

### 1.5 生命周期与调试

| 维度 | qiankun | wujie | MicroApp | single-spa | Module Federation | OrionMF v2.0 当前设计 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **生命周期管理** | beforeLoad/Load/Mount/Unmount | beforeCreate/created/beforeMount/mounted/unmounted | beforeLoad/Load/Mounted/Unmounted/Destroyed | load/bootstrap/mount/unmount | 无标准 | **SubAppStateMachine (8 状态)** |
| **快速切换防护** | 不支持 | Shadow DOM 天然支持 | 不支持 | 不支持 | 不支持 | **cancelPending() + AbortController** |
| **状态机验证** | 不支持 | 不支持 | 不支持 | single-spa-core 状态机 | 不支持 | **VALID_TRANSITIONS 白名单** |
| **开发调试** | 不支持 | 不支持 | 不支持 | 不支持 | DevTools 插件 | **未设计** |
| **性能监控** | 不支持 | 不支持 | 不支持 | 不支持 | 不支持 | **PerformanceBenchmark (6 项指标)** |

### 1.6 部署与可观测

| 维度 | qiankun | wujie | MicroApp | single-spa | Module Federation | OrionMF v2.0 当前设计 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **独立部署** | 支持 | 支持 | 支持 | 支持 | **原生支持** | **支持** |
| **版本管理** | 不支持 | 不支持 | 不支持 | 不支持 | 版本协商 | **FrameworkUpgrade 版本兼容检查** |
| **资源泄漏防护** | 不支持 | iframe 天然隔离 | 不支持 | 不支持 | 不支持 | **LeakPrevention (DOM/网络/内存)** |
| **内存监控** | 不支持 | 不支持 | 不支持 | 不支持 | 不支持 | **performance.memory 50MB 阈值** |
| **崩溃率上报** | 不支持 | 不支持 | 不支持 | 不支持 | 不支持 | **未设计** |
| **无障碍访问** | 不支持 | 不支持 | 不支持 | 不支持 | 不支持 | **A11ySupport (Focus Trap + Screen Reader)** |
| **多实例支持** | 不支持 (singular 模式) | 支持 (iframe 天然) | 不支持 | 支持 (多 application) | 支持 | **未明确设计** |
| **技术栈兼容** | React/Vue/Angular/原生 | React/Vue/Angular/原生 | React/Vue/Angular/原生 | React/Vue/Angular/原生 | React/Vue/Angular/原生 | **React/Vue/Angular 混合部署** |
| **Codemod 迁移** | 不支持 | 不支持 | 不支持 | 不支持 | 不支持 | **FrameworkUpgrade.runCodemod** |

---

## 2. OrionMF v2.0 差距分析

基于竞品对比，以下是 OrionMF v2.0 当前设计**缺少的能力**：

### 差距 1：预加载/懒加载策略 (Preload/Prefetch Strategy)

**竞品情况**：
- qiankun: `prefetch` 支持 4 种模式 (true / 'all' / string[] / 函数控制)
- wujie: `preload` 属性控制预加载
- MicroApp: `prefetch` 智能预加载
- single-spa: 支持自定义预加载

**OrionMF 现状**：设计文档中未涉及预加载策略，MF Loader 仅为简单的 `load()` 调用。

**影响**：20+ 子应用全部按需加载时，首次点击会有明显延迟，影响用户体验。

### 差距 2：子应用缓存策略 (Caching Strategy)

**竞品情况**：
- qiankun: `import-html-entry` 提供 HTML 解析结果缓存
- wujie: Shadow DOM `keep-alive` 实现保活（卸载后 DOM 保留，切换时恢复）
- MicroApp: 组件缓存机制
- single-spa: 应用加载后可通过 `unloadApplication` 控制缓存

**OrionMF 现状**：每次 unmount 后完全销毁，下次 mount 需重新加载和初始化。

**影响**：频繁切换的子应用每次都重新加载，网络请求和渲染开销大。

### 差距 3：多实例支持 (Multi-instance Support)

**竞品情况**：
- wujie: iframe 天然支持多实例
- single-spa: 可注册多个 application 实例
- Module Federation: 远程模块可多次实例化

**OrionMF 现状**：`SubAppStateMachine` 以 `key` 作为唯一标识，同一 key 只能有一个实例。设计文档中 `RouterManager` 的 URL 格式 `/app/{subAppKey}/*` 也暗示单实例。

**影响**：无法在同一页面展示同一子应用的多个实例（如两个不同租户的 Pipeline 看板）。

### 差距 4：开发调试工具 (DevTools)

**竞品情况**：
- Module Federation: 官方 DevTools 插件（Chrome 扩展），支持远程模块可视化、依赖图
- qiankun: 无官方 DevTools，但有社区插件
- wujie/MicroApp/single-spa: 均无官方 DevTools

**OrionMF 现状**：未设计任何调试工具。

**影响**：20+ 子应用的开发调试困难，无法直观查看子应用状态、通信消息、性能指标。

### 差距 5：子应用间直接通信 (Direct Cross-App Communication)

**竞品情况**：
- wujie: `CustomEvent` 可跨 iframe 通信（通过 window 事件）
- MicroApp: `CustomEvent` 跨子应用通信
- Module Federation: 共享模块直接引用
- qiankun: 只能通过 `initGlobalState` 经主应用中转

**OrionMF 现状**：`EventBus` 为频道机制，但文档未明确支持子应用间**直接**通信（不经主应用）。`GlobalStore` 也是主应用中心化的。

**影响**：子应用 A 触发了一个操作需要通知子应用 B 时，必须经过主应用中转，增加了延迟和复杂度。

### 差距 6：崩溃率上报与可观测性 (Observability & Crash Reporting)

**竞品情况**：
- 所有竞品均无内置可观测性（这是 OrionMF 的机会）

**OrionMF 现状**：`ErrorIsolator` 捕获错误但只做本地处理，`PerformanceBenchmark` 只在测试时运行。无运行时指标采集和上报。

**影响**：生产环境中无法知道子应用的崩溃率、加载失败率、性能分布。

### 差距 7：子应用注册中心 (SubApp Registry / Discovery)

**竞品情况**：
- qiankun: `registerMicroApps` 静态注册
- single-spa: `registerApplication` 静态注册
- Module Federation: `remotes` 配置静态声明

**OrionMF 现状**：未设计子应用注册中心，假设子应用配置在代码中硬编码。

**影响**：新增子应用需要修改主应用代码并重新部署。企业级场景需要动态注册、远程配置。

### 差距 8：共享依赖版本冲突处理 (Shared Dependency Version Conflict)

**竞品情况**：
- Module Federation: `singleton` / `requiredVersion` / `eager` 配置
- qiankun: externals 配置，需手动保证版本一致

**OrionMF 现状**：文档中提到 "版本协商机制" 但无具体设计。`FrameworkUpgrade` 只做主框架版本兼容检查，不做共享依赖版本协商。

**影响**：子应用 A 使用 React 18，子应用 B 使用 React 17，共享依赖冲突可能导致运行时错误。

### 差距 9：子应用保活 (Keep-Alive / 挂载不卸载)

**竞品情况**：
- wujie: Shadow DOM `display: none` 保活，切换时只隐藏不卸载
- qiankun: 社区插件 `qiankun-keep-alive`

**OrionMF 现状**：unmount 后完全销毁，无 keep-alive 机制。

**影响**：有表单输入、滚动位置的子应用切换后会丢失状态。

### 差距 10：安全策略配置化 (Configurable Security Policy)

**竞品情况**：
- qiankun: `sandbox` 配置 (strictStyleIsolation / experimentalStyleIsolation)
- MicroApp: `sandbox` 配置 (strict / loose)

**OrionMF 现状**：`Sandbox` 的白名单/黑名单是硬编码的常量，无法在运行时调整。

**影响**：不同子应用可能需要不同的安全级别（如内部管理工具不需要严格沙箱），当前设计不够灵活。

---

## 3. ICE 评分排序

评分标准：
- **Impact (I)**: 1-10 分，对用户体验和系统能力的影响
- **Confidence (C)**: 1-10 分，对该评分的确定程度
- **Ease (E)**: 1-10 分，实现难度（10 = 最容易）
- **ICE Score** = I × C × E / 100

| # | 缺失能力 | Impact | Confidence | Ease | ICE Score | 优先级 |
|---|---------|:---:|:---:|:---:|:---:|:---:|
| 1 | **预加载/懒加载策略** | 9 | 10 | 7 | **6.3** | P0 |
| 2 | **子应用缓存策略 (Keep-Alive)** | 8 | 10 | 6 | **4.8** | P0 |
| 3 | **共享依赖版本冲突处理** | 9 | 9 | 4 | **3.2** | P1 |
| 4 | **多实例支持** | 7 | 9 | 4 | **2.5** | P1 |
| 5 | **子应用注册中心** | 7 | 8 | 5 | **2.8** | P1 |
| 6 | **崩溃率上报与可观测性** | 8 | 8 | 5 | **3.2** | P1 |
| 7 | **子应用间直接通信** | 5 | 8 | 6 | **2.4** | P2 |
| 8 | **开发调试工具** | 6 | 8 | 3 | **1.4** | P2 |
| 9 | **安全策略配置化** | 5 | 9 | 7 | **3.2** | P1 |
| 10 | **子应用间直接通信** | 5 | 8 | 6 | **2.4** | P2 |

### Top 5 排序 (按 ICE Score)

| 排名 | 能力 | ICE Score |
|:---:|------|:---:|
| 1 | 预加载/懒加载策略 | 6.3 |
| 2 | 子应用缓存策略 (Keep-Alive) | 4.8 |
| 3 | 共享依赖版本冲突处理 | 3.2 |
| 3 | 崩溃率上报与可观测性 | 3.2 |
| 3 | 安全策略配置化 | 3.2 |
| 5 | 子应用注册中心 | 2.8 |

> 注：第 3 名有 3 个能力并列 ICE 3.2，均列入 Top 5。

---

## 4. Top 5 建议补充

### 4.1 预加载/懒加载策略 (ICE: 6.3)

**设计建议**：

```typescript
// core/PreloadStrategy.ts

type PrefetchMode = 'idle' | 'visible' | 'all' | 'smart';

interface PrefetchConfig {
  mode: PrefetchMode;
  criticalApps: string[];  // 关键子应用，优先预加载
  excludedApps: string[];  // 排除预加载的子应用
  maxConcurrent: number;   // 最大并发数，默认 3
  delay: number;           // 空闲延迟时间 (ms)，默认 2000
}

export class PreloadStrategy {
  private config: PrefetchConfig;
  private loaded = new Set<string>();

  constructor(config: Partial<PrefetchConfig> = {}) {
    this.config = {
      mode: 'smart',
      criticalApps: [],
      excludedApps: [],
      maxConcurrent: 3,
      delay: 2000,
      ...config,
    };
  }

  // 智能预加载策略
  async prefetch(appKey: string, loader: () => Promise<void>): Promise<void> {
    if (this.loaded.has(appKey) || this.config.excludedApps.includes(appKey)) {
      return;
    }

    switch (this.config.mode) {
      case 'all':
        // 页面加载后立即预加载所有非排除应用
        return this.prefetchAll(loader);
      case 'idle':
        // 使用 requestIdleCallback 预加载
        return this.prefetchOnIdle(appKey, loader);
      case 'visible':
        // 当子应用容器进入视口时预加载 (IntersectionObserver)
        return this.prefetchOnVisible(appKey, loader);
      case 'smart':
        // 智能策略：关键应用立即加载，其他空闲时加载
        if (this.config.criticalApps.includes(appKey)) {
          return this.prefetchNow(appKey, loader);
        }
        return this.prefetchOnIdle(appKey, loader);
    }
  }

  // 预加载关键子应用
  async prefetchCritical(loaders: Map<string, () => Promise<void>>): Promise<void> {
    const critical = this.config.criticalApps.filter(k => loaders.has(k));
    const batches = this.chunk(critical, this.config.maxConcurrent);

    for (const batch of batches) {
      await Promise.all(batch.map(key => {
        const loader = loaders.get(key)!;
        return this.prefetchNow(key, loader);
      }));
    }
  }

  private prefetchOnIdle(appKey: string, loader: () => Promise<void>): Promise<void> {
    return new Promise((resolve) => {
      const id = requestIdleCallback(() => {
        this.prefetchNow(appKey, loader).then(resolve);
      }, { timeout: this.config.delay });
    });
  }

  private prefetchOnVisible(appKey: string, loader: () => Promise<void>): Promise<void> {
    const container = document.querySelector(`[data-subapp="${appKey}"]`);
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

  private async prefetchNow(appKey: string, loader: () => Promise<void>): Promise<void> {
    this.loaded.add(appKey);
    try {
      await loader();
    } catch (e) {
      console.warn(`[Preload] Failed to prefetch ${appKey}:`, e);
      this.loaded.delete(appKey);
    }
  }
}
```

**集成建议**：在 `MFSandboxBridge` 初始化后调用 `PreloadStrategy.prefetchCritical()`。

### 4.2 子应用缓存策略 / Keep-Alive (ICE: 4.8)

**设计建议**：

```typescript
// core/SubAppCache.ts

interface CacheConfig {
  maxSize: number;         // 最大缓存数，默认 5
  ttl: number;             // 缓存过期时间 (ms)，0 = 永不过期
  keepAlive: boolean;      // 是否保活 (DOM 保留但隐藏)
}

export class SubAppCache {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { maxSize: 5, ttl: 0, keepAlive: true, ...config };
  }

  // 卸载子应用（实际放入缓存）
  async evict(key: string, unmount: () => Promise<void>): Promise<void> {
    // 如果缓存已满，淘汰最旧的
    if (this.cache.size >= this.config.maxSize) {
      await this.evictOldest();
    }

    if (this.config.keepAlive) {
      // Keep-Alive 模式：隐藏 DOM 但不卸载
      const container = document.querySelector(`[data-subapp="${key}"]`);
      if (container) {
        (container as HTMLElement).style.display = 'none';
      }
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
      });
    }
  }

  // 从缓存恢复
  async restore(key: string, remount: () => Promise<void>): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // 检查过期
    if (this.config.ttl > 0 && Date.now() - entry.timestamp > this.config.ttl) {
      await this.evict(key, entry.unmount);
      return false;
    }

    if (entry.mode === 'keep-alive' && entry.container) {
      // Keep-Alive 恢复：显示 DOM，不调用 remount
      (entry.container as HTMLElement).style.display = '';
      entry.timestamp = Date.now();
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
    for (const [key, entry] of this.cache) {
      await this.purge(key);
    }
  }

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
}

interface CacheEntry {
  unmount: () => Promise<void>;
  timestamp: number;
  mode: 'keep-alive' | 'full-unmount';
  container?: Element | null;
}
```

**集成建议**：在 `RouterManager` 导航离开当前子应用时调用 `SubAppCache.evict()`，导航回来时调用 `restore()`。

### 4.3 共享依赖版本冲突处理 (ICE: 3.2)

**设计建议**：

```typescript
// core/DependencyResolver.ts

interface SharedDepConfig {
  singleton: boolean;       // 是否单例
  requiredVersion: string;  // 语义化版本范围
  eager: boolean;           // 是否立即加载
}

interface DependencyReport {
  appKey: string;
  dependencies: Record<string, { version: string; status: 'ok' | 'conflict' | 'missing' }>;
}

export class DependencyResolver {
  private registry = new Map<string, SharedDepConfig>();
  private loadedVersions = new Map<string, string>();

  register(name: string, config: SharedDepConfig): void {
    this.registry.set(name, config);
  }

  // 检查依赖兼容性
  checkCompatibility(deps: DependencyReport[]): ConflictReport[] {
    const conflicts: ConflictReport[] = [];

    for (const [depName] of this.registry) {
      const versions = new Map<string, string[]>();

      for (const report of deps) {
        const depInfo = report.dependencies[depName];
        if (depInfo) {
          if (!versions.has(depInfo.version)) {
            versions.set(depInfo.version, []);
          }
          versions.get(depInfo.version)!.push(report.appKey);
        }
      }

      if (versions.size > 1) {
        // 存在版本冲突
        const config = this.registry.get(depName)!;
        if (config.singleton) {
          conflicts.push({
            dependency: depName,
            versions: Object.fromEntries(versions),
            severity: 'error',
            message: `Singleton dependency "${depName}" has ${versions.size} versions`,
          });
        }
      }
    }

    return conflicts;
  }

  // 解析最佳版本
  resolveVersion(depName: string): string | null {
    const config = this.registry.get(depName);
    if (!config) return null;
    return this.loadedVersions.get(depName) ?? config.requiredVersion;
  }

  // 注册已加载的版本
  registerLoaded(depName: string, version: string): void {
    this.loadedVersions.set(depName, version);
  }
}

interface ConflictReport {
  dependency: string;
  versions: Record<string, string[]>;
  severity: 'error' | 'warning';
  message: string;
}
```

**集成建议**：与 `Module Federation` 的 `shared` 配置配合使用，在构建时生成依赖报告，在运行时进行冲突检测。

### 4.4 崩溃率上报与可观测性 (ICE: 3.2)

**设计建议**：

```typescript
// core/Observability.ts

interface SubAppMetrics {
  key: string;
  loadCount: number;
  errorCount: number;
  crashRate: number;          // errorCount / loadCount
  avgLoadTime: number;        // ms
  avgSwitchTime: number;      // ms
  p95LoadTime: number;        // ms
  memoryUsage: number;        // MB
  lastError?: { message: string; stack: string; timestamp: number };
  circuitBreakerTripped: boolean;
  uptime: number;             // 当前运行时间 (ms)
}

type MetricsExporter = (metrics: SubAppMetrics[]) => Promise<void>;

export class ObservabilityManager {
  private metrics = new Map<string, SubAppMetrics>();
  private loadTimes = new Map<string, number[]>();
  private exporters: MetricsExporter[] = [];
  private reportInterval: number | null = null;

  // 注册上报目标
  registerExporter(exporter: MetricsExporter): void {
    this.exporters.push(exporter);
  }

  // 记录加载开始
  recordLoadStart(key: string): void {
    const m = this.getOrCreate(key);
    m.loadCount++;
    this.recordTimestamp(key);
  }

  // 记录加载完成
  recordLoadComplete(key: string, duration: number): void {
    const m = this.getOrCreate(key);
    const times = this.loadTimes.get(key) ?? [];
    times.push(duration);
    this.loadTimes.set(key, times);
    m.avgLoadTime = times.reduce((a, b) => a + b, 0) / times.length;
    m.p95LoadTime = this.percentile(times, 95);
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

  // 获取所有指标
  getAllMetrics(): SubAppMetrics[] {
    return Array.from(this.metrics.values());
  }

  // 启动定期上报
  startReporting(intervalMs: number = 30000): void {
    this.reportInterval = window.setInterval(async () => {
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
        memoryUsage: 0,
        circuitBreakerTripped: false,
        uptime: 0,
      });
    }
    return this.metrics.get(key)!;
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil(p / 100 * sorted.length) - 1;
    return sorted.sort((a, b) => a - b)[idx];
  }

  private recordTimestamp(key: string): void {
    // 内部使用，记录时间戳用于 uptime 计算
  }
}
```

**集成建议**：
- 在 `CrashRecovery` 的 `recordFailure()` 中调用 `recordError()`
- 在 `MFSandboxBridge.loadSubApp()` 中调用 `recordLoadStart()` / `recordLoadComplete()`
- 上报目标可对接 Prometheus Pushgateway、OpenTelemetry 或内部 APM

### 4.5 安全策略配置化 (ICE: 3.2)

**设计建议**：

```typescript
// core/SecurityPolicy.ts

type SandboxMode = 'strict' | 'loose' | 'none';

interface SecurityPolicy {
  mode: SandboxMode;
  // 白名单：允许访问的全局属性 (mode: 'loose' 时生效)
  whitelist: string[];
  // 黑名单：禁止访问的属性 (mode: 'strict' 时生效)
  blacklist: string[];
  // CSS 隔离模式
  cssIsolation: 'shadow-dom' | 'scoped-css' | 'none';
  // 是否隔离 localStorage
  isolateStorage: boolean;
  // 是否拦截动态脚本
  blockDynamicScripts: boolean;
  // 是否拦截 eval/Function
  blockEval: boolean;
}

const PRESETS: Record<string, SecurityPolicy> = {
  // 严格模式：适用于不可信的第三方子应用
  strict: {
    mode: 'strict',
    whitelist: [],
    blacklist: ['eval', 'Function', '__proto__', 'constructor', 'localStorage', 'sessionStorage'],
    cssIsolation: 'shadow-dom',
    isolateStorage: true,
    blockDynamicScripts: true,
    blockEval: true,
  },
  // 宽松模式：适用于可信的内部子应用
  loose: {
    mode: 'loose',
    whitelist: ['console', 'localStorage', 'sessionStorage', 'fetch'],
    blacklist: ['eval', 'Function', '__proto__'],
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
    this.policies.set(appKey, { ...PRESETS[preset] });
  }

  // 自定义策略
  setPolicy(appKey: string, policy: Partial<SecurityPolicy>): void {
    const existing = this.policies.get(appKey) ?? { ...PRESETS.strict };
    this.policies.set(appKey, { ...existing, ...policy });
  }

  // 获取子应用的策略
  getPolicy(appKey: string): SecurityPolicy {
    return this.policies.get(appKey) ?? { ...PRESETS.strict };
  }

  // 批量设置
  setPolicies(policies: Record<string, Partial<SecurityPolicy>>): void {
    for (const [key, policy] of Object.entries(policies)) {
      this.setPolicy(key, policy);
    }
  }
}
```

**集成建议**：修改 `Sandbox.create()` 方法，接受 `SecurityPolicy` 参数，根据策略动态调整白名单/黑名单。

---

## 5. 竞品特色能力总结

| 框架 | 特色能力 | OrionMF 是否借鉴 |
|------|---------|:---:|
| **qiankun** | `import-html-entry` HTML 解析 + 资源预加载 | 部分 (MF 不需要 HTML 解析) |
| **qiankun** | `singular` 单例模式控制 | 建议 (纳入 SecurityPolicy) |
| **qiankun** | `prefetch` 智能预加载 4 种模式 | 建议 (纳入 PreloadStrategy) |
| **wujie** | iframe + Shadow DOM 双引擎 | 已有 (iframe 在降级策略中) |
| **wujie** | `keep-alive` Shadow DOM 保活 | 建议 (纳入 SubAppCache) |
| **wujie** | 天然多实例 (iframe) | 建议 (纳入架构设计) |
| **MicroApp** | 数据通信 (data 属性绑定) | 不采纳 (与 EventBus 重复) |
| **MicroApp** | Element-plus/Ant Design 组件适配 | 不采纳 (业务层处理) |
| **single-spa** | 活动函数 (activity function) 灵活激活 | 建议 (RouterManager 增强) |
| **single-spa** | 应用加载状态机 (11 种状态) | 已有 (SubAppStateMachine 8 种) |
| **Module Federation** | 共享模块版本协商 | 建议 (纳入 DependencyResolver) |
| **Module Federation** | DevTools Chrome 扩展 | 建议 (独立 Phase) |

---

## 6. 总体评估

### OrionMF v2.0 当前设计评分

| 评估维度 | 得分 (1-10) | 说明 |
|---------|:---:|------|
| JS 隔离 | 8 | Proxy 方案完整，但缺少安全策略配置化 |
| CSS 隔离 | 9 | Shadow DOM + Scoped CSS + 动态拦截，覆盖全面 |
| 异常处理 | 9 | ErrorIsolator + CircuitBreaker + 四级降级 |
| 路由管理 | 7 | RouterManager 基本完整，缺少 activity function |
| 通信机制 | 7 | EventBus + GlobalStore 完整，缺少直接跨应用通信 |
| 生命周期 | 8 | SubAppStateMachine 8 状态 + 取消机制 |
| 资源防护 | 9 | LeakPrevention DOM/网络/内存监控 |
| 性能优化 | 5 | 缺少预加载/缓存策略 |
| 可观测性 | 4 | Benchmark 仅测试用，缺少运行时指标 |
| 可维护性 | 8 | 脚手架 + 版本升级 + A11y |
| **综合** | **7.4** | 核心能力扎实，性能优化和可观测性是短板 |

### 竞品对比结论

1. **OrionMF v2.0 在隔离和防护能力上优于竞品**：Proxy 白名单/黑名单、ScopedStorage、四级降级、ErrorIsolator 错误路由等能力在竞品中均不存在。

2. **主要差距在运营能力**：预加载、缓存、可观测性是竞品普遍也在做但 OrionMF 未涉及的方向。

3. **独特机会**：没有一个竞品提供完整的可观测性方案（崩溃率、性能分布、资源使用），这是 OrionMF 可以做差异化的方向。

4. **Module Federation 是最佳基座**：相比 qiankun/wujie 的 HTML 入口解析，MF 的模块级共享更轻量、更适合现代前端工程化。OrionMF 选 MF 作为基座是正确的。

---

*分析日期：2026-05-20 | 分析人：Orion 前端团队*
*信息来源：qiankun 官方文档 API 页面 (qiankun.umijs.org/api)、wujie 官方文档、MicroApp 官方文档、single-spa 官方文档、Module Federation 官方文档 (module-federation.io)、GitHub 仓库源码*
