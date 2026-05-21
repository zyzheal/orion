# OrionMF - 企业级微前端框架

> 基于 Module Federation 的企业级微前端框架，支持 20+ 子应用的精细管理

OrionMF 是一个自研的微前端框架，专注于**隔离性**和**稳定性**，确保子应用崩溃不影响主应用，子应用卸载后无资源泄漏。

[![Version](https://img.shields.io/badge/version-2.0.0-blue)](https://github.com/orion-design/orionmf)
[![Tests](https://img.shields.io/badge/tests-758%20passed-green)](https://github.com/orion-design/orionmf)
[![Coverage](https://img.shields.io/badge/coverage-95%25%2B-green)](https://github.com/orion-design/orionmf)

---

## 核心特性

| 特性 | 描述 |
|------|------|
| **JS 沙箱** | 纯 Proxy 方案，兼容 ES Module/Strict Mode，隔离全局变量 |
| **CSS 隔离** | Shadow DOM + Scoped CSS + 动态样式拦截 |
| **异常隔离** | Error Boundary + 全局异常捕获 + 熔断器 |
| **运行时安全** | 全局快照/恢复、原型链保护、事件/定时器清理 |
| **崩溃恢复** | Circuit Breaker 模式，防止反复加载失败子应用 |
| **四级降级** | Full → Compatible → Iframe → Fallback |

## "跑不挂不污染" 原则

- ✅ 子应用崩溃不影响主应用
- ✅ 子应用崩溃不影响其他子应用
- ✅ 子应用不污染全局环境
- ✅ 子应用卸载后无资源泄漏

---

## 快速开始

### 安装框架核心

```bash
npm install @orion/mf
```

### 创建子应用（脚手架）

```bash
# 即将支持: 使用脚手架创建子应用
npm create orion-subapp my-subapp
cd my-subapp
npm run dev
```

脚手架功能正在规划中，目前可手动创建符合以下结构的子应用项目。

### 子应用结构

```
my-subapp/
├── src/
│   ├── index.ts          # 子应用入口
│   ├── App.tsx           # 根组件
│   ├── bootstrap.tsx     # 启动逻辑
│   └── lifecycle.ts      # 生命周期钩子
├── webpack.config.js      # Webpack + MF 配置
├── vite.config.ts         # Vite 配置（可选）
├── package.json
└── tsconfig.json
```

### 生命周期钩子

子应用需要导出标准生命周期钩子：

```typescript
// src/lifecycle.ts
import type { SubAppProps } from '@orion/mf';

export async function bootstrap(props: SubAppProps): Promise<void> {
  console.log('[SubApp] bootstrap', props);
}

export async function mount(props: SubAppProps): Promise<void> {
  const { container } = props;
  ReactDOM.createRoot(container).render(<App />);
}

export async function unmount(props: SubAppProps): Promise<void> {
  const { container } = props;
  ReactDOM.unmountComponentAtNode(container);
}
```

---

## motor 脚手架功能对比

| 功能 | motor | OrionMF | 状态 |
|------|-------|---------|------|
| CLI 创建子应用 | `npm create motor-app` | `npm create orion-subapp` | 规划中 |
| React 模板 | ✅ | ✅ ReactShadowCompat | ✅ 已实现 |
| Vue3 模板 | ✅ plugin-vue3 | ✅ VueShadowCompat | ✅ 已实现 |
| Vue2 模板 | ✅ plugin-vue2 | ✅ | 规划中 |
| Vite 构建 | ✅ | ✅ | 规划中 |
| Webpack MF 配置 | ✅ | ✅ | 规划中 |
| 热更新 HMR | ✅ | ✅ | 规划中 |
| 在线联调 | ✅ | ✅ DevProxyManager | ✅ 已实现 |

### 基本使用

```typescript
import { MFSandboxBridge, SubAppConfig } from '@orion/mf';

const bridge = new MFSandboxBridge();

// 子应用配置
const config: SubAppConfig = {
  key: 'pipeline',
  name: 'pipeline',
  remoteEntry: 'http://localhost:3001/remoteEntry.js',
  routePath: '/pipeline',
  // 生命周期钩子（子应用提供）
  bootstrap: () => import('./bootstrap'),
  mount: (container) => import('./bootstrap').then(m => m.mount(container)),
  unmount: () => import('./bootstrap').then(m => m.unmount()),
};

// 加载子应用
const instance = await bridge.loadSubApp(config);
console.log('子应用已加载:', instance.key);

// 卸载子应用
await bridge.unmountSubApp('pipeline');
```

---

## 系统架构

### 整体架构图

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

### 分层架构

| 层级 | 职责 | 核心模块 |
|------|------|----------|
| 模块加载层 | MF 共享依赖加载、版本协商 | `MFSandboxBridge` |
| 执行隔离层 | 全局变量隔离、原型链保护 | `Sandbox`, `RuntimeIsolation` |
| 渲染隔离层 | Shadow DOM 渲染、样式隔离 | `ReactShadowCompat`, `StyleIsolator` |
| 安全防护层 | 异常捕获、崩溃恢复、资源防护 | `ErrorIsolator`, `CrashRecovery`, `LeakPrevention` |
| 支持服务层 | 通信、降级、性能、无障碍 | `EventBus`, `DegradationStrategy`, `PerformanceBenchmark`, `A11ySupport` |

---

## 核心模块

### 1. MFSandboxBridge — MF 与沙箱桥梁

负责加载子应用模块并协调各隔离层：

```typescript
const bridge = new MFSandboxBridge();

// 加载子应用
const instance = await bridge.loadSubApp({
  key: 'app-name',
  remoteEntry: 'http://localhost:3001/remoteEntry.js',
});

// 卸载子应用
await bridge.unmountSubApp('app-name');

// 预加载子应用
await bridge.preloadSubApp('app-name');
```

### 2. Sandbox — JS 沙箱

纯 Proxy 方案实现 JS 执行隔离：

```typescript
import { Sandbox, getCurrentRunningApp } from '@orion/mf';

const sandbox = new Sandbox();
const ctx = sandbox.create('my-app');

// 在沙箱上下文中执行代码
ctx.proxy.eval(`
  // 全局变量被隔离
  window.myVar = 'isolated';
  console.log(window.myVar); // 输出: undefined (访问被拦截)
`);

// 获取当前运行的子应用
const currentApp = getCurrentRunningApp();
```

**安全特性**：
- 白名单机制：只允许访问安全 API
- 黑名单机制：禁止危险操作（`eval`、`Function`、原型链攻击）
- 原型链保护：阻止 `__proto__`、`constructor` 访问

### 3. StyleIsolator — CSS 隔离

使用 Shadow DOM 实现样式隔离：

```typescript
import { StyleIsolator } from '@orion/mf';

const isolator = new StyleIsolator();
const container = document.getElementById('app-container');

// 挂载到 Shadow DOM
const shadowRoot = isolator.mount('my-app', container);

// 卸载
isolator.unmount('my-app');
```

### 4. ErrorIsolator — 异常隔离

捕获子应用运行时错误：

```typescript
import { ErrorIsolator } from '@orion/mf';

const errorHandler = new ErrorIsolator();

// 为子应用设置错误边界
const boundary = errorHandler.setup('my-app', (error) => {
  console.error('子应用错误:', error.message);
  // 上报错误
  reportError(error);
});

// 检查是否有活跃边界
if (errorHandler.hasBoundary('my-app')) {
  // 子应用受保护
}
```

### 5. CrashRecovery — 崩溃恢复

使用 Circuit Breaker 模式防止反复加载失败：

```typescript
import { CrashRecovery } from '@orion/mf';

const crashRecovery = new CrashRecovery();

// 设置子应用的崩溃恢复
const ctx = crashRecovery.setup('my-app', async () => {
  await loadSubApp();
});

// 检查是否被熔断
if (crashRecovery.isTripped('my-app')) {
  console.log('子应用正在冷却中，请稍后重试');
}
```

### 6. EventBus — 跨子应用通信

带版本控制的轻量级事件总线：

```typescript
import { eventBus } from '@orion/mf';

// 创建 Channel
const channel = eventBus.createChannel('pipeline', '1.0.0');

// 订阅事件
const unsubscribe = channel.on('data:update', (payload) => {
  console.log('收到数据:', payload.data);
});

// 发布事件
channel.emit('data:update', { id: 1, value: 'test' });

// 取消订阅
unsubscribe();

// 按所有者清理（子应用卸载时）
eventBus.cleanupByOwner('my-app');
```

### 7. GlobalStore — 全局状态管理

带版本控制和 CAS 语义的全局状态：

```typescript
import { globalStore, setGlobalState, getGlobalState, subscribeGlobalState } from '@orion/mf';

// 设置状态
setGlobalState('user', { name: '张三' }, 'my-app');

// 获取状态
const user = getGlobalState('user');

// 订阅状态变化
const unsubscribe = subscribeGlobalState('user', (key, value, meta) => {
  console.log(`状态更新: ${key} = ${value}, version: ${meta.version}`);
});

// CAS 操作（乐观锁）
const result = globalStore.set('user', { name: '李四' }, 'my-app', {
  expectedVersion: 1,
});
if (result.success) {
  console.log('更新成功');
} else {
  console.log('版本冲突，当前版本:', result.currentVersion);
}
```

### 8. DegradationStrategy — 四级降级

自动降级保证高可用：

```typescript
import { DegradationStrategy } from '@orion/mf';

const strategy = new DegradationStrategy(bridge);

// 加载子应用，失败时自动降级
const instance = await strategy.loadSubApp({
  key: 'legacy-app',
  remoteEntry: 'http://localhost:3001/remoteEntry.js',
  // 指定安全策略
  securityPolicy: 'strict', // strict | loose | none
});
```

**降级策略**：

1. **Full** - 完整沙箱隔离（Proxy）
2. **Compatible** - 兼容模式，降低隔离级别
3. **Iframe** - 使用 iframe 隔离
4. **Fallback** - 降级为静态占位

---

### 9. PreloadStrategy — 预加载/懒加载

5 种预加载模式：

```typescript
import { getPreloadStrategy } from '@orion/mf';

const strategy = getPreloadStrategy();

// 配置策略
strategy.setConfig({
  mode: 'smart',        // idle | visible | all | smart | manual
  criticalApps: ['dashboard', 'navigation'],
  excludedApps: ['heavy-report'],
  maxConcurrent: 3,
  idleTimeout: 2000,
});

// 预加载关键应用
await strategy.prefetchCritical(loaders);

// 手动触发预加载
await strategy.manualPrefetch('my-app', () => loadSubApp());
```

---

### 10. SubAppCache — Keep-Alive 缓存

子应用缓存实现秒级恢复：

```typescript
import { SubAppCache } from '@orion/mf';

const cache = new SubAppCache({
  maxSize: 5,           // 最多缓存 5 个子应用
  ttl: 5 * 60 * 1000,   // 缓存有效期 5 分钟
});

// 缓存子应用（切换到其他应用时自动缓存）
await cache.cache('my-app', instance);

// 恢复缓存的子应用（秒级切换）
const restored = await cache.restore('my-app');

// 主动清理
cache.clear();
```

---

### 11. SubAppStateMachine — 生命周期状态机

8 状态生命周期管理：

```typescript
import { SubAppStateMachine, VALID_TRANSITIONS } from '@orion/mf';

const stateMachine = new SubAppStateMachine();

// 初始化
stateMachine.init('my-app');

// 状态转换
stateMachine.transition('my-app', 'load');     // idle → loading
stateMachine.transition('my-app', 'bootstrap'); // loading → bootstrapping
stateMachine.transition('my-app', 'mount');    // bootstrapping → mounting
stateMachine.transition('my-app', 'complete'); // mounting → mounted

// 检查是否可以加载
if (stateMachine.canLoad('my-app')) {
  // 允许加载
}

// 取消待处理操作（快速切换场景）
stateMachine.cancelPending('my-app');

// 获取中止信号（用于取消异步操作）
const abortSignal = stateMachine.getAbortSignal('my-app');
```

**状态流转**：`idle → loading → bootstrapping → mounting → mounted → unmounting → unmounted → error`

---

### 12. ReactShadowCompat — React + Shadow DOM 兼容

处理 React 在 Shadow DOM 中的渲染兼容性：

```typescript
import { ReactShadowCompat } from '@orion/mf';

const reactCompat = new ReactShadowCompat();

// 为 React 子应用创建 Shadow DOM 渲染环境
const container = document.getElementById('app');
const shadowRoot = container.attachShadow({ mode: 'open' });

// 创建 React 根
const root = reactCompat.createRoot(shadowRoot);

// 渲染 React 组件
root.render(<App />);

// 事件转发（处理 Shadow DOM 边界事件问题）
reactCompat.enableEventForwarding('my-app', shadowRoot);

// 处理 React Portal
reactCompat.handlePortal(container, <Modal />);

// 卸载
root.unmount();
```

**解决的问题**：

| 问题 | 解决方案 |
|------|----------|
| React 事件委托无法穿透 Shadow DOM | 事件转发机制 |
| React Portal 挂载到 DOM 根节点 | 自定义 Portal 容器 |
| CSS-in-JS 样式丢失 | 与 StyleIsolator 集成 |

---

### VueShadowCompat — Vue 3 + Shadow DOM 兼容

处理 Vue 3 在 Shadow DOM 中的渲染：

```typescript
import { VueShadowCompat, createVueSubApp } from '@orion/mf';

const vueCompat = new VueShadowCompat({
  enableCssScope: true,
  enableEventForwarding: true,
});

// 挂载 Vue 应用
const instance = await vueCompat.mount({
  key: 'my-vue-app',
  container: document.getElementById('vue-container'),
  rootComponent: {
    template: `<div class="app">
      <h1>{{ message }}</h1>
      <button @click="onClick">Click</button>
    </div>`,
    data() {
      return { message: 'Hello Vue in Shadow DOM!' };
    },
    methods: {
      onClick() {
        console.log('Clicked!');
      },
    },
  },
});

// 卸载
vueCompat.unmount('my-vue-app');
```

**解决的问题**：

| 问题 | 解决方案 |
|------|----------|
| Vue 样式 scoped 需要特殊处理 | injectStylePatch 注入作用域补丁 |
| Vue Teleport 组件目标容器 | handleTeleport 重定向到 Shadow DOM |
| Vue 动态组件 DOM 操作 | RuntimeCSSPrefixer 已集成 patchVueCreateElement |
| 事件冒泡穿透 Shadow DOM | enableEventForwarding 事件转发 |

**Vue 3 支持已集成**：
- `patchVueCreateElement()` - 劫持 Vue 虚拟 DOM 创建
- `patchVueCreateElementBlock()` - 处理 Vue 块级虚拟 DOM
- 自动处理 `class` vs `className` 差异
| 动态插入的 DOM 属性被拦截 | 属性白名单机制 |

---

### 13. SecurityPolicyManager — 安全策略配置化

3 种预设安全策略：

```typescript
import { SecurityPolicyManager, PRESETS, applyPreset, getPolicy } from '@orion/mf';

const manager = new SecurityPolicyManager();

// 应用预设
applyPreset('my-app', 'strict');   // 严格模式
applyPreset('my-app', 'loose');    // 宽松模式
applyPreset('my-app', 'none');     // 无隔离

// 自定义策略
manager.setPolicy('my-app', {
  mode: 'strict',
  cssIsolation: 'shadow-dom',
  isolateStorage: true,
  blockEval: true,
  blockDynamicScripts: true,
});

// 检查属性是否允许
if (manager.isPropertyAllowed('my-app', 'eval')) {
  // eval 被阻止
}
```

| 预设 | cssIsolation | isolateStorage | blockEval |
|------|--------------|----------------|-----------|
| strict | shadow-dom | true | true |
| loose | scoped-css | false | true |
| none | none | false | false |

---

### 13. RuntimeCSSPrefixer — CSS 运行时前缀

处理动态样式的前缀问题：

```typescript
import { RuntimeCSSPrefixer } from '@orion/mf';

const prefixer = new RuntimeCSSPrefixer();

// 为动态插入的样式添加前缀
const prefixed = prefixer.prefix(`
  .container {
    display: flex;
    transition: all 0.3s;
  }
`);

// 输出:
// .container {
//   display: -webkit-box;
//   display: -webkit-flex;
//   display: flex;
//   -webkit-transition: all 0.3s;
//   transition: all 0.3s;
// }
```

---

### 14. ObservabilityManager — 可观测性

崩溃率上报与性能监控：

```typescript
import { ObservabilityManager } from '@orion/mf';

const obs = new ObservabilityManager({
  endpoint: '/api/observability',
  batchSize: 10,
  flushInterval: 5000,
});

// 记录事件
obs.recordEvent('subapp:load', { key: 'pipeline', duration: 150 });
obs.recordEvent('subapp:error', { key: 'pipeline', error: 'Module not found' });

// 获取统计数据
const stats = obs.getStats('pipeline');
console.log('崩溃率:', stats.errorRate);
console.log('平均加载时间:', stats.avgLoadTime);

// 导出报告
const report = obs.exportReport();
```

---

### 15. SubAppRegistry — 子应用注册中心

动态注册和管理子应用：

```typescript
import { SubAppRegistry } from '@orion/mf';

const registry = new SubAppRegistry();

// 静态注册
registry.register({
  key: 'pipeline',
  name: 'pipeline',
  remoteEntry: 'http://localhost:3001/remoteEntry.js',
  routePath: '/pipeline',
});

// 动态注册（从远程配置加载）
await registry.registerFromRemote('/api/subapps/config');

// 获取所有注册的子应用
const apps = registry.getAll();

// 检查是否已注册
if (registry.has('pipeline')) {
  // 已注册
}

// 获取子应用配置
const config = registry.get('pipeline');

// 注销
registry.unregister('pipeline');
```

---

### 16. MultiInstanceManager — 多实例支持

支持同一子应用的多个实例：

```typescript
import { MultiInstanceManager } from '@orion/mf';

const manager = new MultiInstanceManager();

// 加载多个实例
const instance1 = await manager.load('pipeline', { instanceId: 'instance-1' });
const instance2 = await manager.load('pipeline', { instanceId: 'instance-2' });

// 获取实例
const inst1 = manager.get('pipeline', 'instance-1');

// 获取所有实例
const all = manager.getAllInstances('pipeline');

// 卸载单个实例
manager.unload('pipeline', 'instance-1');

// 卸载所有实例
manager.unloadAll('pipeline');
```

---

### 17. A11ySupport — 无障碍访问

支持屏幕阅读器和键盘导航：

```typescript
import { A11ySupport } from '@orion/mf';

const a11y = new A11ySupport();

// 为子应用启用无障碍支持
a11y.enable('my-app', {
  announceRoleChanges: true,
  manageFocus: true,
  keyboardNavigation: true,
});

// 禁用
a11y.disable('my-app');

// 检查无障碍状态
if (a11y.isEnabled('my-app')) {
  // 已启用
}
```

---

### 18. FrameworkUpgrade — 框架升级（实验性）

版本兼容性检查和迁移：

```typescript
import { FrameworkUpgrade, parseVersion, compareVersions } from '@orion/mf';

const upgrade = new FrameworkUpgrade({
  currentVersion: '2.0.0',
});

// 解析版本
const v1 = parseVersion('2.1.0');
const v2 = parseVersion('2.0.0');

// 比较版本
console.log(compareVersions('2.1.0', '2.0.0')); // 1

// 检查兼容性
const result = upgrade.checkCompatibility('2.0.5');
console.log(result.compatible); // true
```

---

### 19. SubAppDataChannel — 状态写权限控制

控制子应用对全局状态的写权限：

```typescript
import { SubAppDataChannel } from '@orion/mf';

const channel = new SubAppDataChannel({
  allowedKeys: ['user.profile', 'app.settings'],
  deniedKeys: ['app.secret', 'user.token'],
});

// 设置状态（带权限检查）
channel.set('user.profile', { name: '张三' }, 'my-app'); // 允许
channel.set('app.secret', { key: 'xxx' }, 'my-app');    // 拒绝

// 批量设置
channel.setMany({
  'user.profile': { name: '李四' },
  'app.settings': { theme: 'dark' },
}, 'my-app');
```

---

### 20. LeakPrevention — 资源泄漏防护

自动清理定时器、事件监听器：

```typescript
import { LeakPrevention } from '@orion/mf';

const leak = new LeakPrevention();

// 注册需要追踪的资源
leak.register('my-app', {
  timers: [timerId1, timerId2],
  listeners: [{ target: window, type: 'resize', handler }],
  requests: [abortController],
});

// 清理所有资源
leak.cleanup('my-app');

// 定期扫描泄漏
leak.startScan(5000); // 每 5 秒扫描

leak.on('leak-detected', (app, leaked) => {
  console.warn('检测到泄漏:', app, leaked);
});
```

---

### 21. RouterManager — 路由管理

子应用路由集成：

```typescript
import { RouterManager } from '@orion/mf';

const router = new RouterManager();

// 注册子应用路由
router.registerRoute('/pipeline', {
  key: 'pipeline',
  loader: () => import('./PipelineApp'),
});

// 导航到子应用
router.navigate('/pipeline');

// 获取当前路由
const current = router.getCurrentRoute();

// 监听路由变化
router.on('route-change', (from, to) => {
  console.log('路由变化:', from, '→', to);
});

// 预加载路由对应的子应用
router.prefetchOnHover('/pipeline');
```
1. **Full** - 完整沙箱隔离
2. **Compatible** - 兼容模式，降低隔离级别
3. **Iframe** - 使用 iframe 隔离
4. **Fallback** - 降级为静态占位

---

## 配置选项

### 子应用配置

```typescript
interface SubAppConfig {
  /** 子应用唯一标识 */
  key: string;
  /** Module Federation remote entry URL */
  remoteEntry: string;
  /** 路由路径 */
  routePath: string;
  /** 生命周期钩子 */
  bootstrap?: () => Promise<any>;
  mount?: (container: HTMLElement) => Promise<void>;
  unmount?: () => Promise<void>;
  /** 安全策略 */
  securityPolicy?: 'strict' | 'loose' | 'none';
  /** CSS 隔离模式 */
  cssIsolation?: 'shadow-dom' | 'scoped-css' | 'none';
  /** 是否启用预加载 */
  preload?: boolean;
}
```

### 安全策略预设

| 预设 | mode | cssIsolation | isolateStorage | blockEval |
|------|------|--------------|----------------|-----------|
| `strict` | strict | shadow-dom | true | true |
| `loose` | loose | scoped-css | false | true |
| `none` | none | none | false | false |

---

## 生命周期

```
idle → loading → bootstrapping → mounting → mounted → unmounting → unmounted → error
```

### 状态转换

```typescript
import { SubAppStateMachine } from '@orion/mf';

const stateMachine = new SubAppStateMachine();

// 初始化
stateMachine.init('my-app');
console.log(stateMachine.getState('my-app')); // 'idle'

// 转换状态
stateMachine.transition('my-app', 'load');    // idle → loading
stateMachine.transition('my-app', 'bootstrap'); // loading → bootstrapping
stateMachine.transition('my-app', 'mount');   // bootstrapping → mounting
stateMachine.transition('my-app', 'complete'); // mounting → mounted

// 取消待处理操作
stateMachine.cancelPending('my-app');

// 获取中止信号（用于取消异步操作）
const abortSignal = stateMachine.getAbortSignal('my-app');
```

---

## 预加载策略

支持多种预加载模式：

```typescript
import { PreloadStrategy, getPreloadStrategy } from '@orion/mf';

const strategy = getPreloadStrategy();

// 配置策略
strategy.setConfig({
  mode: 'smart',      // idle | visible | all | smart | manual
  criticalApps: ['dashboard', 'navigation'],
  excludedApps: ['heavy-report'],
  maxConcurrent: 3,
  idleTimeout: 2000,
});

// 预加载关键应用
await strategy.prefetchCritical(loaders);

// 批量预加载
await strategy.prefetchBatch(['app1', 'app2', 'app3'], (key) => loaders[key]);

// 手动触发预加载
await strategy.manualPrefetch('my-app', () => loadSubApp());
```

---

## 性能基准测试

> ⚠️ **DEV-ONLY**: 此模块仅用于开发环境性能测试

```typescript
import { createPerformanceBenchmark } from '@orion/mf';

const benchmark = createPerformanceBenchmark({
  thresholds: {
    firstPaint: 1500,
    switchLatency: 300,
    sandboxOverhead: 5,
  },
  enableWarnings: true,
});

const results = await benchmark.runAll({
  key: 'perf-test',
  remoteEntry: 'http://localhost:3001/remoteEntry.js',
});

console.log('First Paint:', results.firstPaint, 'ms');
console.log('Switch Latency:', results.switchLatency, 'ms');
console.log('Sandbox Overhead:', results.sandboxOverhead, 'ms');
```

---

## 开发工具

### 在线联调模式

```typescript
import { DevProxyManager } from '@orion/mf';

const devProxy = new DevProxyManager();

// 启用在线联调
devProxy.enable({
  appKey: 'pipeline',
  localEntry: 'http://localhost:3001/remoteEntry.js',
});

// 禁用联调
devProxy.disable('pipeline');
```

### 子应用缓存 (Keep-Alive)

```typescript
import { SubAppCache } from '@orion/mf';

const cache = new SubAppCache({
  maxSize: 5,
  ttl: 5 * 60 * 1000, // 5 分钟
});

// 缓存子应用
await cache.cache('my-app', instance);

// 恢复缓存的子应用（秒级切换）
await cache.restore('my-app');

// 清理缓存
cache.clear();
```

---

## 测试

```bash
# 运行所有测试
npm test

# 运行特定模块测试
npm test -- --run tests/Sandbox.test.ts

# 生成覆盖率报告
npm test -- --coverage
```

**测试覆盖**：
- 758+ 测试用例
- 95%+ 覆盖率
- 安全测试、单元测试、集成测试、性能测试、E2E 测试

---

## 常见问题

### Q: 子应用样式污染主应用怎么办？

A: 使用 `StyleIsolator` 的 Shadow DOM 模式，或在子应用配置中设置 `cssIsolation: 'shadow-dom'`。

### Q: 子应用崩溃导致主应用白屏怎么办？

A: 使用 `ErrorIsolator` 设置 Error Boundary，配合 `CrashRecovery` 的 Circuit Breaker 防止反复加载。

### Q: 如何实现子应用间的通信？

A: 使用 `EventBus` 的 Channel 机制，支持版本控制和按所有者清理。

### Q: 子应用加载失败如何降级？

A: 使用 `DegradationStrategy` 配置四级降级策略，自动 fallback 到兼容模式或静态占位。

---

## 包体积

| 模块 | 压缩后大小 |
|------|-----------|
| 核心 (Sandbox + StyleIsolator) | ~15KB |
| 完整包 | ~45KB |
| + 全部支持模块 | ~80KB |

---

## 模块清单

OrionMF 共实现 **24 个核心模块**：

### P0 核心隔离（必须）

| 模块 | 文件 | 功能 |
|------|------|------|
| `MFSandboxBridge` | `core/MFSandboxBridge.ts` | MF 与沙箱桥梁，协调模块加载与隔离 |
| `Sandbox` | `core/Sandbox.ts` | 纯 Proxy 方案 JS 沙箱，隔离全局变量 |
| `StyleIsolator` | `core/StyleIsolator.ts` | Shadow DOM + Scoped CSS 样式隔离 |
| `ErrorIsolator` | `core/ErrorIsolator.ts` | Error Boundary 异常捕获隔离 |
| `RouterManager` | `core/RouterManager.ts` | 子应用路由管理 |
| `CrashRecovery` | `core/CrashRecovery.ts` | Circuit Breaker 崩溃恢复 |
| `LeakPrevention` | `core/LeakPrevention.ts` | 资源泄漏防护 |
| `SubAppDataChannel` | `core/SubAppDataChannel.ts` | 全局状态写权限控制 |
| `PreloadStrategy` | `core/PreloadStrategy.ts` | 预加载/懒加载策略（5 种模式） |
| `SubAppCache` | `core/SubAppCache.ts` | 子应用缓存/Keep-Alive |

### P1 高级特性（重要）

| 模块 | 文件 | 功能 |
|------|------|------|
| `ReactShadowCompat` | `core/ReactShadowCompat.ts` | React + Shadow DOM 兼容 |
| `VueShadowCompat` | `core/VueShadowCompat.ts` | Vue 3 + Shadow DOM 兼容 |
| `EventBus` | `core/EventBus.ts` | 带版本控制的跨子应用通信 |
| `DegradationStrategy` | `core/DegradationStrategy.ts` | 四级降级策略 |
| `GlobalStore` | `core/GlobalStore.ts` | 全局状态管理（CAS 支持） |
| `SubAppStateMachine` | `core/SubAppStateMachine.ts` | 8 状态生命周期状态机 |
| `DevProxyManager` | `core/DevProxyManager.ts` | 在线联调模式 |
| `RuntimeCSSPrefixer` | `core/RuntimeCSSPrefixer.ts` | CSS 运行时前缀劫持 |
| `ObservabilityManager` | `core/ObservabilityManager.ts` | 崩溃率上报与可观测性 |
| `SecurityPolicyManager` | `core/SecurityPolicyManager.ts` | 安全策略配置化（strict/loose/none） |
| `SubAppRegistry` | `core/SubAppRegistry.ts` | 子应用注册中心 |
| `MultiInstanceManager` | `core/MultiInstanceManager.ts` | 多实例支持 |

### P2 辅助功能（可选）

| 模块 | 文件 | 功能 |
|------|------|------|
| `PerformanceBenchmark` | `core/PerformanceBenchmark.ts` | 性能基准测试（DEV-ONLY） |
| `A11ySupport` | `core/A11ySupport.ts` | 无障碍访问支持 |
| `FrameworkUpgrade` | `core/FrameworkUpgrade.ts` | 框架升级支持（实验性） |

### 构建与开发工具

| 模块 | 文件 | 功能 |
|------|------|------|
| `ReactRefreshDetector` | `core/ReactRefreshDetector.ts` | React Hot Reload 独立运行检测 |
| `DOMAPIPatcher` | `core/DOMAPIPatcher.ts` | DOM API 劫持隔离 |
| `GlobalStyleCache` | `core/GlobalStyleCache.ts` | 全局样式缓存/恢复 |
| `completeReactLoader` | `build/complateReactLoader.ts` | 自动导入 React |

---

## motor 能力覆盖（最终）

| 能力 | motor | OrionMF | 状态 |
|------|-------|---------|------|
| JS 沙箱 | ✅ | ✅ | 已实现 |
| CSS 隔离 | ✅ | ✅ | 已实现 |
| 异常隔离 | ✅ | ✅ | 已实现 |
| 生命周期管理 | ✅ | ✅ | 已实现 |
| 通信机制 | ✅ | ✅ | 已实现 |
| 崩溃恢复 | ✅ | ✅ | 已实现 |
| 预加载策略 | ✅ | ✅ | 已实现 |
| Keep-Alive | ✅ | ✅ | 已实现 |
| 在线联调 | ✅ | ✅ | 已实现 |
| CSS 运行时前缀 | ✅ | ✅ | 已实现 |
| React 支持 | ✅ | ✅ | 已实现 |
| Vue3 支持 | ✅ | ✅ | 已实现 |
| React Refresh 检测 | ✅ | ✅ | 已实现 |
| 自动导入 React | ✅ | ✅ | 已实现 |
| DOM API 劫持 | ✅ | ✅ | 已实现 |
| 全局样式缓存 | ✅ | ✅ | 已实现 |
| SandBox 接口 | ✅ | ✅ | 已实现 |

---

## 参考

- [设计文档](./docs/superpowers/specs/2026-05-20-orionmf-v2-design.md)
- [Module Federation 官方文档](https://webpack.js.org/concepts/module-federation/)
- [状态机设计](./src/core/SubAppStateMachine.ts)
- [测试用例](./tests/)

---

## License

MIT