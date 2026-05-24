# 微前端开发规范 (Micro-Frontend Development Guide)

> 文档版本：1.1.0 | 创建日期：2026-04-10 | 适用项目：Orion Platform
>
> **v1.1 变更**（2026-05-24）: 新增第七章"错误边界与降级策略"，修复 Token Header 为 Authorization Bearer，更新架构描述为 Orion-MF

---

## 目录

- [一、概述](#一概述)
  - [1.1 微前端架构选型](#11-微前端架构选型)
  - [1.2 技术栈](#12-技术栈)
- [二、子应用开发规范](#二子应用开发规范)
  - [2.1 入口文件规范](#21-入口文件规范)
  - [2.2 样式隔离方案](#22-样式隔离方案)
  - [2.3 通信协议](#23-通信协议)
- [三、Orion 全局状态使用指南](#三 orion-全局状态使用指南)
  - [3.1 $orion 对象结构](#31-orion-对象结构)
  - [3.2 用户信息获取](#32-用户信息获取)
  - [3.3 权限校验](#33-权限校验)
  - [3.4 Token 使用](#34-token-使用)
- [四、API 调用规范](#四 api-调用规范)
  - [4.1 getApiBase() 使用](#41-getapibase-使用)
  - [4.2 X-Orion-Token Header](#42-x-orion-token-header)
  - [4.3 错误处理](#43-错误处理)
- [五、构建配置](#五构建配置)
  - [5.1 UMD 格式输出](#51-umd-格式输出)
  - [5.2 外部依赖配置](#52-外部依赖配置)
  - [5.3 Module Federation Shared 配置（依赖共享）](#53-module-federation-shared-配置依赖共享)
  - [5.4 代理配置](#54-代理配置)
- [六、本地开发调试](#六本地开发调试)
  - [6.1 独立模式运行](#61-独立模式运行)
  - [6.2 微前端模式调试](#62-微前端模式调试)
- [七、错误边界与降级策略](#七错误边界与降级策略)
  - [7.1 四级降级策略](#71-四级降级策略)
  - [7.2 实现代码](#72-实现代码)
  - [7.3 熔断机制](#73-熔断机制)
  - [7.4 安全规范](#74-安全规范)
  - [7.5 性能基线](#75-性能基线)
  - [7.6 多环境配置差异](#76-多环境配置差异)
  - [7.7 子应用间依赖管理](#77-子应用间依赖管理)
- [八、错误处理与日志](#八错误处理与日志)
- [九、性能优化建议](#九性能优化建议)

---

## 一、概述

### 1.1 微前端架构选型

Orion 平台采用**微前端架构**集成多个子应用，实现技术栈无关、独立开发、独立部署的能力。当前架构方案如下：

```
┌─────────────────────────────────────────────────────────┐
│                    Orion 主应用 (Shell)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ orion-dba   │  │orion-knowledge│ │ orion-visor │      │
│  │  (数据库管理) │  │  (知识库)    │  │  (监控中心)  │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────┘
```

**架构特点**：

| 特性 | 方案 | 说明 |
|------|------|------|
| 集成方式 | Orion-MF 微前端框架 | 基于 `window.__POWERED_BY_ORION__` 标识 |
| 通信机制 | Props + Custom Events + Global State | 父子应用双向通信 |
| 样式隔离 | Shadow DOM + Scoped CSS | 多重隔离策略 |
| 状态共享 | `$orion` 全局对象 | 用户信息、权限、Token 统一注入 |
| 路由管理 | 主应用统一路由 + 子应用内部路由 | 两级路由体系 |
| 构建输出 | Module Federation (remoteEntry.js) | 兼容浏览器全局变量加载 |

### 1.2 技术栈

各子应用可根据团队技术偏好选择不同框架，但推荐统一技术栈以降低维护成本：

| 子应用 | 框架 | UI 库 | 状态管理 | 构建工具 |
|--------|------|------|----------|----------|
| orion-dba | Vue 3 | Ant Design Vue | Pinia | Vite |
| orion-knowledge | React 18 | MUI | Redux Toolkit | Vite |
| orion-visor | Vue 3 | Arco Design | Pinia | Vite |

**推荐依赖版本**：

```json
{
  "vue": "^3.4.x",
  "react": "^18.2.x",
  "vite": "^5.0.x",
  "typescript": "^5.3.x"
}
```

---

## 二、子应用开发规范

### 2.1 入口文件规范

子应用必须支持**独立运行**和**微前端嵌入**双模式，通过 `window.__POWERED_BY_ORION__` 标识判断运行环境。

#### main.ts 完整示例（Vue 3）

```typescript
// src/main.ts
import { createApp } from 'vue';
import App from './App.vue';
import router from '@/router';
import { store, key } from '@/store';
import Antd from 'ant-design-vue';
import i18n from '@/lang';

// ============================================
// 微前端标识：判断是否运行在 Orion 容器中
// ============================================
const isOrionChild = !!window.__POWERED_BY_ORION__;

// ============================================
// 初始化主题
// ============================================
function initTheme() {
  const theme = localStorage.getItem('theme') ?? 'dark';
  if (theme === 'dark') {
    await import('@/style/theme.less');
  } else {
    await import('@/style/light.less');
  }
  localStorage.setItem('theme', theme);
}

// ============================================
// 创建应用实例
// ============================================
function createOrionApp(props: any = {}) {
  initTheme();

  const app = createApp(App);

  // 注入 Orion 全局状态（如果存在）
  if (props) {
    app.config.globalProperties.$orion = {
      user: props.user,
      permissions: props.permissions,
      token: props.token,
      apiBase: props.apiBase || '/api/v1/db',
      // 可选：注入主应用提供的方法
      navigateTo: props.navigateTo,
      openModal: props.openModal,
    };
  }

  // 注册插件
  app.use(i18n);
  app.use(store, key);
  app.use(Antd);
  app.use(router);

  return app;
}

// ============================================
// 独立运行模式（开发环境）
// ============================================
if (!isOrionChild) {
  const app = createOrionApp();
  app.mount('#app');
  console.log('[orion-dba] Running in standalone mode');
} else {
  // ============================================
  // 微前端子应用模式（生产环境，嵌入 Orion）
  // ============================================
  let instance: any = null;

  /**
   * 生命周期：初始化
   * 在子应用首次加载前调用，可用于全局初始化逻辑
   */
  export async function bootstrap() {
    console.log('[orion-dba] bootstrap');
    // 可在此处进行全局变量初始化、SDK 加载等
  }

  /**
   * 生命周期：挂载
   * 主应用调用此方法将子应用渲染到指定容器
   * @param props - 主应用传递的属性
   */
  export async function mount(props: any) {
    console.log('[orion-dba] mount with props:', props);

    instance = createOrionApp(props);
    // 注意：挂载点 ID 需与主应用配置一致
    instance.mount('#orion-dba-app');
  }

  /**
   * 生命周期：卸载
   * 主应用调用此方法销毁子应用实例，释放资源
   */
  export async function unmount() {
    console.log('[orion-dba] unmount');
    instance?.unmount();
    instance = null;
    // 清理事件监听器、定时器等
  }
}
```

#### main.tsx 完整示例（React 18）

```typescript
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Provider } from 'react-redux';
import { store } from './store';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from '@mui/material';

const isOrionChild = !!window.__POWERED_BY_ORION__;

let root: ReactDOM.Root | null = null;

/**
 * 渲染应用
 */
function render(props: any = {}) {
  const { container } = props;

  root = ReactDOM.createRoot(
    container ? container.querySelector('#root') : document.querySelector('#root')
  );

  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <BrowserRouter>
          <ConfigProvider>
            {/* 注入 Orion 全局状态到 Context */}
            <OrionProvider value={props}>
              <App />
            </OrionProvider>
          </ConfigProvider>
        </BrowserRouter>
      </Provider>
    </React.StrictMode>
  );
}

// 独立运行
if (!isOrionChild) {
  render();
} else {
  // 微前端模式
  export async function bootstrap() {
    console.log('[orion-knowledge] bootstrap');
  }

  export async function mount(props: any) {
    console.log('[orion-knowledge] mount');
    render(props);
  }

  export async function unmount() {
    console.log('[orion-knowledge] unmount');
    root?.unmount();
    root = null;
  }
}
```

**注意事项**：

1. **生命周期函数必须导出**：`bootstrap`、`mount`、`unmount` 必须作为 ES Module 导出
2. **挂载点隔离**：微前端模式下使用独立的容器 ID（如 `#orion-dba-app`），避免与主应用冲突
3. **资源清理**：`unmount` 中必须清理定时器、事件监听器、全局变量等，防止内存泄漏
4. **样式清理**：卸载时需移除动态注入的样式标签

---

### 2.2 样式隔离方案

微前端架构下，样式隔离是避免冲突的关键。Orion 采用**三重隔离策略**：

#### 方案一：CSS Modules（推荐）

```less
// Button.module.less
.btn-primary {
  background-color: @primary-color;
  padding: 8px 16px;
  border-radius: 4px;

  &:hover {
    background-color: @primary-color-hover;
  }
}
```

```typescript
// Button.tsx
import styles from './Button.module.less';

function Button() {
  return <button className={styles['btn-primary']}>按钮</button>;
}
```

#### 方案二：Scoped CSS（Vue）

```vue
<template>
  <div class="db-connection-panel">
    <h3>数据库连接</h3>
  </div>
</template>

<style scoped lang="less">
.db-connection-panel {
  h3 {
    color: @text-color;
  }
}
</style>
```

#### 方案三：Less 变量前缀规范

所有子应用自定义 Less 变量必须添加**应用前缀**：

```less
// orion-dba: 变量前缀 db-
@db-primary-color: #1890ff;
@db-font-size-base: 14px;

// orion-knowledge: 变量前缀 kb-
@kb-primary-color: #722ed1;
@kb-font-size-base: 14px;

// orion-visor: 变量前缀 visor-
@visor-primary-color: #13c2c2;
@visor-font-size-base: 14px;
```

#### 全局样式重置隔离

```less
// 子应用全局样式必须限定作用域
#orion-dba-app {
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  // 重置可能影响主应用的样式
  h1, h2, h3, h4, h5, h6 {
    margin: 0;
  }
}
```

**注意事项**：

1. **禁止使用全局标签选择器**：如 `body {}`、`h1 {}` 等，必须限定在应用容器内
2. **避免使用 `!important`**：除非必要，否则可能导致样式覆盖问题
3. **z-index 管理**：子应用弹窗 z-index 不应超过主应用（建议 < 1000）
4. **字体图标**：使用独立字体文件名，避免与主应用或其他子应用冲突

---

### 2.3 通信协议

Orion 微前端支持三种通信方式，根据场景选择：

#### 方式一：Props（主应用 → 子应用）

主应用通过 `mount()` 传递数据给子应用：

```typescript
// 主应用调用
await app.mount({
  user: { id: 1, name: '张三', email: 'zhangsan@example.com' },
  permissions: ['db:read', 'db:write'],
  token: 'eyJhbGc...',
  apiBase: '/api/v1/db',
  navigateTo: (path: string) => { /* 路由跳转 */ },
});
```

```typescript
// 子应用接收（Vue）
export async function mount(props: any) {
  app.config.globalProperties.$orion = props;
}

// 子应用接收（React）
function render(props: any) {
  ReactDOM.createRoot(root).render(
    <OrionContext.Provider value={props}>
      <App />
    </OrionContext.Provider>
  );
}
```

#### 方式二：Custom Events（子应用 → 主应用）

子应用通过自定义事件通知主应用：

```typescript
// 子应用发送事件
function notifyParent() {
  window.dispatchEvent(
    new CustomEvent('orion-dba-event', {
      detail: {
        type: 'NAVIGATE',
        payload: { path: '/db/list' },
      },
    })
  );
}

// 或通用事件格式
window.dispatchEvent(
  new CustomEvent('orion-child-event', {
    detail: {
      source: 'orion-dba',
      type: 'TOKEN_EXPIRED',
      data: {},
    },
  })
);
```

```typescript
// 主应用监听（由 Orion 框架统一处理）
window.addEventListener('orion-child-event', (e) => {
  const { source, type, data } = e.detail;
  // 处理事件
});
```

#### 方式三：Global State（双向共享）

通过 `$orion` 全局对象共享状态：

```typescript
// 子应用访问
const user = app.config.globalProperties.$orion.user;
const token = app.config.globalProperties.$orion.token;

// 更新全局状态（谨慎使用）
window.$orionState = {
  ...window.$orionState,
  currentModule: 'db',
};
```

**通信方式选择指南**：

| 场景 | 推荐方式 | 说明 |
|------|----------|------|
| 主应用传递配置给子应用 | Props | 初始化时一次性传递 |
| 子应用请求主应用跳转 | Custom Events | 解耦，主应用统一处理路由 |
| 用户信息、权限共享 | `$orion` 对象 | 所有子应用统一访问入口 |
| Token 刷新通知 | Custom Events | 主应用刷新后通知所有子应用 |
| 子应用间通信 | 通过主应用中转 | 避免子应用直接耦合 |

---

## 三、Orion 全局状态使用指南

### 3.1 $orion 对象结构

`$orion` 是 Orion 主应用注入到子应用的全局状态对象：

```typescript
interface OrionGlobalState {
  // 用户信息
  user: {
    id: number;
    username: string;
    email: string;
    avatar?: string;
    department?: string;
  };

  // 权限列表
  permissions: string[];

  // 认证 Token
  token: string;

  // API 基础路径
  apiBase: string;

  // 可选：主应用提供的方法
  navigateTo?: (path: string) => void;
  openModal?: (config: ModalConfig) => void;
  showMessage?: (type: 'success' | 'error', message: string) => void;
}
```

### 3.2 用户信息获取

```typescript
// Vue 3 示例
import { getCurrentInstance } from 'vue';

function getUserInfo() {
  const instance = getCurrentInstance();
  const orion = instance?.appContext.config.globalProperties.$orion;
  return orion?.user;
}

// 使用
const user = getUserInfo();
console.log(`欢迎，${user?.username}`);
```

```typescript
// React 示例
import { useContext } from 'react';
import { OrionContext } from '@/contexts/OrionContext';

function UserProfile() {
  const orion = useContext(OrionContext);
  return <div>欢迎，{orion?.user?.username}</div>;
}
```

### 3.3 权限校验

```typescript
// 权限校验工具函数
// src/utils/permission.ts

import { getCurrentInstance } from 'vue';

/**
 * 检查当前用户是否拥有指定权限
 * @param permission - 权限标识，如 'db:read'、'db:write'
 */
export function hasPermission(permission: string): boolean {
  const instance = getCurrentInstance();
  const orion = instance?.appContext.config.globalProperties.$orion;
  const permissions = orion?.permissions ?? [];
  return permissions.includes(permission);
}

/**
 * 检查是否拥有任一权限
 */
export function hasAnyPermission(permissions: string[]): boolean {
  return permissions.some(p => hasPermission(p));
}

/**
 * 检查是否拥有所有权限
 */
export function hasAllPermissions(permissions: string[]): boolean {
  return permissions.every(p => hasPermission(p));
}

// 指令方式（Vue）
// src/directives/permission.ts
export const permission = {
  mounted(el: HTMLElement, binding: any) {
    const { value } = binding;
    if (!hasPermission(value)) {
      el.parentNode?.removeChild(el);
    }
  },
};

// 使用
// <button v-permission="'db:write'">删除</button>
```

### 3.4 Token 使用

> **重要**：Orion 统一使用 `Authorization: Bearer` 标准方式传递 Token，不使用自定义 Header。这是 OAuth2 标准做法，兼容所有后端框架和安全策略。

```typescript
// API 请求自动携带 Token
// src/api/client.ts

import axios from 'axios';

const client = axios.create({
  baseURL: getApiBase(),
});

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers['X-Orion-Token'] = token;
  }
  return config;
});

function getToken(): string | null {
  // 优先从 $orion 获取
  const instance = getCurrentInstance();
  const orion = instance?.appContext.config.globalProperties.$orion;
  if (orion?.token) {
    return orion.token;
  }
  // 降级：从 localStorage 获取
  return localStorage.getItem('orion_token');
}

function getApiBase(): string {
  const instance = getCurrentInstance();
  const orion = instance?.appContext.config.globalProperties.$orion;
  return orion?.apiBase || '/api/v1/db';
}
```

**Token 刷新处理**：

```typescript
// 监听 Token 过期事件
window.addEventListener('orion-token-refresh', (e: any) => {
  const { token } = e.detail;
  // 更新本地存储
  localStorage.setItem('orion_token', token);
  // 更新 $orion 状态
  const instance = getCurrentInstance();
  if (instance?.appContext.config.globalProperties.$orion) {
    instance.appContext.config.globalProperties.$orion.token = token;
  }
});
```

---

## 四、API 调用规范

### 4.1 getApiBase() 使用

所有 API 请求必须通过 `getApiBase()` 获取基础路径，确保在独立开发和微前端模式下都能正确请求：

```typescript
// src/api/client.ts

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

let apiClient: AxiosInstance | null = null;

/**
 * 获取 API 基础路径
 * 优先从 $orion 获取，降级到环境变量
 */
export function getApiBase(): string {
  // 浏览器环境
  if (typeof window !== 'undefined') {
    const orion = (window as any).$orion;
    if (orion?.apiBase) {
      return orion.apiBase;
    }
  }

  // 降级：环境变量
  return import.meta.env.VITE_API_BASE_URL || '/api/v1/db';
}

/**
 * 获取 API 客户端实例
 */
export function getApiClient(): AxiosInstance {
  if (!apiClient) {
    apiClient = axios.create({
      baseURL: getApiBase(),
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 注册拦截器
    setupInterceptors(apiClient);
  }
  return apiClient;
}

function setupInterceptors(client: AxiosInstance) {
  // 请求拦截器
  client.interceptors.request.use(
    (config) => {
      const token = getToken();
      if (token) {
        config.headers['X-Orion-Token'] = token;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // 响应拦截器
  client.interceptors.response.use(
    (response) => {
      const { data } = response;
      // 统一处理业务错误
      if (data.code !== 0 && data.code !== 200) {
        handleError(data);
        return Promise.reject(new Error(data.message));
      }
      return data.data;
    },
    (error) => {
      // 处理 HTTP 错误
      if (error.response) {
        const { status } = error.response;
        if (status === 401) {
          handleUnauthorized();
        } else if (status === 403) {
          handleForbidden();
        } else if (status >= 500) {
          handleServerError(error);
        }
      }
      return Promise.reject(error);
    }
  );
}

function getToken(): string | null {
  if (typeof window !== 'undefined') {
    const orion = (window as any).$orion;
    if (orion?.token) {
      return orion.token;
    }
  }
  return localStorage.getItem('orion_token');
}

function handleError(data: any) {
  console.error('[API Error]', data.message);
  // 使用主应用的消息组件（如果可用）
  const orion = (window as any).$orion;
  if (orion?.showMessage) {
    orion.showMessage('error', data.message);
  }
}

function handleUnauthorized() {
  // 跳转登录或刷新 Token
  window.dispatchEvent(
    new CustomEvent('orion-unauthorized', { detail: {} })
  );
}

function handleForbidden() {
  handleError({ message: '权限不足' });
}

function handleServerError(error: any) {
  console.error('[Server Error]', error);
  handleError({ message: '服务器错误，请稍后重试' });
}
```

### 4.2 Authorization Bearer Token

所有 API 请求必须携带 `Authorization: Bearer <token>` 请求头（OAuth2 标准方式）：

```typescript
// 请求头示例
{
  "Content-Type": "application/json",
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**注意事项**：

1. **使用标准 Bearer 认证**：遵循 OAuth2 / RFC 6750 规范
2. **Token 过期处理**：401 响应应触发 Token 刷新流程，而非直接跳转登录
3. **Token 安全**：优先使用 HttpOnly Cookie 存储，不要将 Token 打印到日志

### 4.3 错误处理

```typescript
// src/utils/errorHandler.ts

/**
 * API 错误码映射
 */
const ERROR_MESSAGES: Record<number, string> = {
  400: '请求参数错误',
  401: '认证失败，请重新登录',
  403: '权限不足',
  404: '资源不存在',
  409: '资源冲突',
  422: '数据验证失败',
  429: '请求过于频繁',
  500: '服务器内部错误',
  502: '网关错误',
  503: '服务暂时不可用',
};

/**
 * 统一错误处理
 */
export function handleApiError(error: any, context?: string) {
  console.error(`[API Error${context ? ` - ${context}` : ''}]`, error);

  // Axios 错误
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.message || ERROR_MESSAGES[status] || '请求失败';
    showMessage('error', message);
    return;
  }

  // 网络错误
  if (error.message?.includes('Network Error')) {
    showMessage('error', '网络连接失败，请检查网络设置');
    return;
  }

  // 超时
  if (error.code === 'ECONNABORTED') {
    showMessage('error', '请求超时，请重试');
    return;
  }

  // 默认错误
  showMessage('error', error.message || '操作失败');
}

function showMessage(type: 'success' | 'error', message: string) {
  // 优先使用主应用的消息组件
  const orion = (window as any).$orion;
  if (orion?.showMessage) {
    orion.showMessage(type, message);
    return;
  }

  // 降级：使用子应用自己的消息组件
  if (type === 'error') {
    console.error(message);
  }
}
```

---

## 五、构建配置

### 5.1 UMD 格式输出

子应用必须构建为 UMD 格式，以便主应用通过 `<script>` 标签加载：

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import * as path from 'path';

export default defineConfig({
  base: '/front/', // 子应用基础路径
  build: {
    minify: 'esbuild',

    // 微前端：输出为 UMD 格式
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      name: 'orion-dba-app', // 全局变量名
      fileName: () => 'orion-dba-app.js',
      formats: ['umd'],
    },

    // 微前端：关闭 CSS 代码分割，所有样式打包到 JS 中
    cssCodeSplit: false,

    // 微前端：生成 sourcemap 便于调试
    sourcemap: true,

    // 输出目录
    outDir: 'dist',

    rollupOptions: {
      // 避免将 Vue 等依赖打包到库中
      external: ['vue', 'ant-design-vue'],
      output: {
        // 提供全局变量
        globals: {
          vue: 'Vue',
          'ant-design-vue': 'antd',
        },
      },
    },
  },
  // ... 其他配置
});
```

### 5.2 外部依赖配置

为减少子应用包体积，公共依赖应配置为 external，由主应用统一提供：

```typescript
// vite.config.ts
build: {
  rollupOptions: {
    external: [
      'vue',
      'vue-router',
      'pinia',
      'ant-design-vue',
      'axios',
      'dayjs',
    ],
    output: {
      globals: {
        vue: 'Vue',
        'vue-router': 'VueRouter',
        pinia: 'Pinia',
        'ant-design-vue': 'antd',
        axios: 'axios',
        dayjs: 'dayjs',
      },
    },
  },
}
```

**主应用需提供全局变量**：

```html
<!-- Orion 主应用 index.html -->
<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
<script src="https://unpkg.com/vue-router@4/dist/vue-router.global.js"></script>
<script src="https://unpkg.com/ant-design-vue@4/dist/antd.min.js"></script>
```

### 5.3 Module Federation Shared 配置（依赖共享）

#### 默认行为：无 shared（推荐）

Orion-MF **默认不启用 shared**，每个子应用打包自己的依赖副本。这是默认推荐行为：

```typescript
// 子应用 vite.config.ts — 默认配置（无需 shared）
federation({
  name: 'orion_dba',
  filename: 'remoteEntry.js',
  exposes: { './index': './src/main.ts' },
  // 无 shared：子应用打包自己的 vue/react 等依赖
})
```

**默认行为的优势**：

| 优势 | 说明 |
|------|------|
| 任意技术栈 | Vue/React/jQuery 子应用均可正常运行 |
| 零配置 | 无需主应用和子应用版本对齐 |
| 独立部署 | 子应用升级依赖不影响其他子应用 |
| 无版本冲突 | 每个子应用使用自己的依赖版本 |

**默认行为的缺点**：

| 缺点 | 影响 |
|------|------|
| 包体积增大 | 每个子应用都打包了 React/Vue 等依赖 |
| 首次加载慢 | 多个子应用切换时重复下载相同依赖 |
| 内存占用高 | 多个框架实例同时存在于内存 |

#### 何时启用 shared

当满足以下条件时，可考虑启用 shared 优化性能：

1. 子应用与主应用**使用相同框架**（如都是 React 18）
2. 子应用与主应用**框架版本一致**（或兼容范围内）
3. 子应用数量**较多**（3+ 个同技术栈子应用）
4. 对**首屏加载性能**有明确要求

#### 如何启用 shared

**步骤 1：主应用配置 shared（host 端）**

```typescript
// orion-frontend/vite.config.ts
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'orion_host',
      remotes: {
        orion_knowledge: 'http://localhost:5173/assets/remoteEntry.js',
      },
      shared: {
        react: { singleton: true, eager: true },
        'react-dom': { singleton: true, eager: true },
        'react-router-dom': { singleton: true },
      },
    }),
  ],
});
```

**步骤 2：子应用配置 shared（remote 端）**

```typescript
// orion-knowledge/web/admin/vite.config.ts
federation({
  name: 'orion_knowledge',
  filename: 'remoteEntry.js',
  exposes: { './index': './src/main.tsx' },
  shared: ['react', 'react-dom', 'react-router-dom'],
})
```

**步骤 3：在 SubAppStore 中设置 `use_shared: true`**

```json
{
  "key": "orion-knowledge",
  "name": "知识库",
  "use_shared": true,
  "css_isolation": "scoped-css"
}
```

**步骤 4：重新构建子应用**

```bash
cd orion-knowledge/web/admin
npm run build -- --mode micro-frontend
```

#### shared 配置注意事项

| 规则 | 说明 |
|------|------|
| `singleton: true` | 确保整个应用只有一个实例（React 必须有） |
| `eager: true` | 主应用启动时立即加载共享依赖（推荐用于 React） |
| 版本必须兼容 | 主应用 react@18.2.0，子应用也必须兼容此版本 |
| 不同技术栈不能共享 | Vue 子应用不能共享 React，反之亦然 |
| 启用后必须重新构建 | 修改 shared 配置后，子应用和主应用都需要重新构建 |

#### 启用 shared 的性能收益

| 指标 | 无 shared（默认） | 启用 shared | 收益 |
|------|------------------|-------------|------|
| React bundle | 每个子应用 ~42KB | 主应用加载一次 | 节省 N×42KB |
| React-DOM bundle | 每个子应用 ~130KB | 主应用加载一次 | 节省 N×130KB |
| 首次加载（3个React子应用） | ~516KB | ~172KB | **节省 67%** |
| 内存占用 | 3个 React 实例 | 1个 React 实例 | **节省 60%+** |

### 5.4 代理配置

开发环境下配置代理，解决跨域问题：

```typescript
// vite.config.ts
server: {
  port: 3010,
  cors: true, // 允许跨域
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:8090',
      changeOrigin: true,
      // 重写路径（如需要）
      // rewrite: (path) => path.replace(/^\/api/, ''),
    },
    '/login': {
      target: 'http://127.0.0.1:8090',
      changeOrigin: true,
    },
    '/static-file': {
      target: 'http://127.0.0.1:8090',
      changeOrigin: true,
    },
  },
},
```

**完整 vite.config.ts 示例**：

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import * as path from 'path';

export default defineConfig({
  base: '/front/',

  build: {
    minify: 'esbuild',

    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      name: 'orion-dba-app',
      fileName: () => 'orion-dba-app.js',
      formats: ['umd'],
    },

    cssCodeSplit: false,
    sourcemap: true,
    outDir: 'dist',

    rollupOptions: {
      external: ['vue', 'ant-design-vue'],
      output: {
        globals: {
          vue: 'Vue',
          'ant-design-vue': 'antd',
        },
      },
    },
  },

  server: {
    port: 3010,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
      '/login': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
      '/fetch': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
      '/register': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
      '/lang': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
      '/ldap': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
    },
  },

  plugins: [vue()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/'),
    },
  },

  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
        additionalData: `
          @import '@/style/variables.less';
        `,
      },
    },
  },
});
```

---

## 六、本地开发调试

### 6.1 独立 SPA 模式运行（推荐）

每个子应用**本身就是一个完整的 SPA**，可以直接通过 URL 独立访问，无需启动主应用。

#### 构建产物

子应用的 `npm run build` 命令会同时输出两种产物：

```
dist/                   ← SPA 模式（独立访问）
├── index.html
├── assets/
│   ├── main-xxx.js
│   ├── vendor-xxx.js
│   └── style-xxx.css
└── ...

dist-mf/                ← MF 模式（嵌入主应用）
├── remoteEntry.js      ← 主应用加载此文件
└── assets/
    └── ...
```

#### 如何启用独立访问

```bash
# 1. 构建子应用（同时输出 SPA + MF）
cd orion-knowledge/web/admin
npm run build

# 2. 部署 dist/ 目录到 Web 服务器
# 例如部署到 dba.example.com

# 3. 用户直接访问
# http://dba.example.com/        ← 独立 SPA 模式
# http://dba.example.com/login   ← 独立 SPA 模式（子页面）
```

#### 主应用嵌入访问

```
主应用部署后:
http://portal.example.com/dba/*  ← 加载 dist-mf/remoteEntry.js
```

#### 两种访问模式的区别

| 维度 | 独立 SPA 模式 | 嵌入主应用模式 |
|------|--------------|---------------|
| URL | `http://dba.example.com/` | `http://portal.example.com/dba/*` |
| 加载入口 | `index.html` | `remoteEntry.js` |
| Layout | 子应用自己的 Layout | 主应用提供 Layout |
| 认证 | 子应用自己的登录页 | 主应用 SSO 透传 Token |
| basename | `/` 或动态计算 | `/${subAppKey}` |
| 运行标识 | `window.__POWERED_BY_ORION__` 为 `undefined` | `window.__POWERED_BY_ORION__` 为 `true` |

#### 子应用入口文件的双模式处理

子应用的 `main.ts` / `main.tsx` 已内置双模式检测：

```typescript
// 独立 SPA 模式：自动渲染完整应用
if (!window.__POWERED_BY_ORION__) {
  createApp(App).mount('#app');
}

// 嵌入主应用模式：导出生命周期供主应用调用
export async function bootstrap() { /* ... */ }
export async function mount(props) { /* ... */ }
export async function unmount() { /* ... */ }
```

### 6.2 微前端模式调试

在微前端模式下调试子应用：

**方式一：主应用联调**

```bash
# 终端 1：启动主应用
cd orion-visor/orion-visor-ui
npm run dev

# 终端 2：启动子应用
cd orion-dba/frontend
npm run dev

# 主应用会动态加载子应用
```

**方式二：使用微前端调试工具**

```typescript
// 在子应用 main.ts 中添加调试开关
const DEBUG_MICRO_FRONTEND = true;

if (DEBUG_MICRO_FRONTEND && isOrionChild) {
  console.log('[Debug] Running in micro-frontend mode');
  console.log('[Debug] Props received:', props);
  console.log('[Debug] $orion state:', app.config.globalProperties.$orion);
}
```

**方式三：浏览器 DevTools**

```javascript
// 在控制台检查微前端状态
window.__POWERED_BY_ORION__  // true/false
window.$orion                 // 全局状态对象
```

---

## 七、错误处理与日志

### 全局错误捕获

```typescript
// src/utils/monitor.ts

import { App } from 'vue';

/**
 * 全局错误处理
 */
export default function globalErrorHandler(app: App) {
  // Vue 错误处理
  app.config.errorHandler = (err, instance, info) => {
    console.error('[Vue Error]', err, info);
    logError(err, {
      type: 'vue',
      info,
      component: instance?.$options?.name,
    });
  };

  // 全局未捕获错误
  window.addEventListener('error', (event) => {
    console.error('[Global Error]', event.error);
    logError(event.error, {
      type: 'global',
      url: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });

  // 未捕获的 Promise 错误
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Rejection]', event.reason);
    logError(event.reason, {
      type: 'promise',
    });
  });
}

/**
 * 错误日志上报
 */
function logError(error: any, context: Record<string, any>) {
  const errorData = {
    message: error?.message || String(error),
    stack: error?.stack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
    ...context,
  };

  // 开发环境：打印到控制台
  if (import.meta.env.DEV) {
    console.error('[Error Report]', errorData);
    return;
  }

  // 生产环境：上报到日志服务
  fetch('/api/v1/log/error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(errorData),
  }).catch(() => {});
}
```

### 日志级别规范

```typescript
// src/utils/logger.ts

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = `[${prefix}]`;
  }

  debug(message: string, ...args: any[]) {
    if (import.meta.env.DEV) {
      console.debug(this.prefix, message, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    console.info(this.prefix, message, ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(this.prefix, message, ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(this.prefix, message, ...args);
  }
}

// 使用
const logger = new Logger('orion-dba');
logger.info('Application mounted');
logger.error('API request failed', error);
```

---

## 七、错误边界与降级策略

> **P0 修复**：子应用加载失败时，必须有用户友好的降级策略，不能让用户看到白屏。

### 7.1 四级降级策略

```
加载失败 → 重试 (最多 3 次) → 错误提示 → Iframe 备用 → Fallback 页面
```

| 降级级别 | 触发条件 | 用户看到 | 恢复方式 |
|---------|---------|---------|---------|
| **Level 1: 重试** | 网络超时/连接失败 | Loading + "加载中，请稍后..." | 自动重试，间隔递增延迟 |
| **Level 2: 错误提示** | 重试 3 次仍失败 | 错误提示 + "重新加载"按钮 | 用户手动点击重试 |
| **Level 3: Iframe 备用** | JS 模块加载失败 | Iframe 加载子应用独立入口 | 功能完整但性能略降 |
| **Level 4: Fallback** | 所有方式均失败 | "服务暂时不可用，请稍后重试" | 需运维介入 |

### 7.2 实现代码

```typescript
// orion-frontend/src/components/SubAppRouteDynamic/index.tsx

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

function loadWithRetry(config: SubAppConfig, attempt: number = 0): Promise<void> {
  return loadSubApp(config).catch((err) => {
    if (attempt < MAX_RETRIES) {
      // Level 1: 自动重试（指数退避）
      const delay = RETRY_DELAY * Math.pow(2, attempt);
      return new Promise((resolve) => setTimeout(resolve, delay))
        .then(() => loadWithRetry(config, attempt + 1));
    }
    // Level 2: 错误提示
    if (config.fallback_url) {
      // Level 3: Iframe 备用
      return loadIframeFallback(config.fallback_url);
    }
    // Level 4: Fallback
    renderFallbackPage(err);
  });
}
```

### 7.3 熔断机制

```typescript
// 使用已有 CrashRecovery.ts（256 行）实现熔断

const CRASH_THRESHOLD = 3;          // 3 次失败触发熔断
const RECOVERY_TIMEOUT = 60000;     // 60 秒后自动恢复试探

// 在 SubAppRouteDynamic 中集成
<CrashRecovery
  onError={(err) => {
    CrashRecovery.increment(config.key);
    if (CrashRecovery.isCircuitOpen(config.key)) {
      // 熔断：直接降级
      renderFallbackPage(new Error('服务暂时不可用'));
      return;
    }
    loadWithRetry(config);
  }}
>
  <div id={`app-${config.key}`} />
</CrashRecovery>
```

### 7.4 安全规范

#### Token 存储安全

| 场景 | 做法 | 禁止行为 |
|------|------|---------|
| 主应用存储 | HttpOnly Cookie（推荐）或内存 | 明文 localStorage |
| 子应用访问 | 通过 `mount(props)` 注入 | 子应用直接从 localStorage 读取 |
| API 传输 | Authorization: Bearer (HTTPS) | URL 参数中传递 Token |
| 日志打印 | 脱敏后显示 `eyJ***...42` | 完整 Token 打印到日志 |

#### CSP 策略

```typescript
// orion-api-gateway/src/middleware/csp.ts
reply.header('Content-Security-Policy', [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.example.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "connect-src 'self' https://api.example.com",
  "frame-src 'self' https://*.example.com",
].join('; '));
```

### 7.5 性能基线

| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| 子应用首次加载时间 | ≤ 2 秒 | Performance API |
| 子应用切换时间 | ≤ 500ms | 路由切换到渲染完成 |
| 主应用首屏渲染 | ≤ 1 秒 | LCP (Largest Contentful Paint) |
| 子应用内存占用 | ≤ 50MB | Chrome DevTools Memory API |
| Gateway 中间件延迟 | ≤ 10ms | 请求进入 Gateway 到转发 |

### 7.6 多环境配置差异

| 配置项 | 开发 (dev) | 测试 (staging) | 生产 (prod) |
|--------|-----------|---------------|------------|
| 子应用入口 | `http://localhost:3010/remoteEntry.js` | `https://staging-cdn/...` | `https://cdn.example.com/...` |
| API 地址 | `/api` (Vite proxy) | `https://staging-api.example.com` | `https://api.example.com` |
| 限流开关 | 关闭 | 测试模式 | 生产模式 |

### 7.7 子应用间依赖管理

如果子应用 A 依赖子应用 B（如 DBA 需要 Visor 的监控数据）：

```json
// subapp_configs 扩展字段
{
  "key": "dba",
  "dependencies": {
    "visor": ">=2.0.0"
  }
}
```

加载顺序：按依赖图拓扑排序，被依赖的先加载。如果被依赖应用加载失败，降级为独立模式运行。

---

## 八、性能优化建议

### 8.1 代码分割

```typescript
// 路由懒加载
const routes = [
  {
    path: '/db/list',
    component: () => import('@/pages/db/DbList.vue'),
  },
  {
    path: '/db/detail/:id',
    component: () => import('@/pages/db/DbDetail.vue'),
  },
];

// 大组件懒加载
const HeavyChart = defineAsyncComponent(() => import('@/components/HeavyChart.vue'));
```

### 8.2 依赖优化

```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-vue': ['vue', 'vue-router', 'pinia'],
        'vendor-ui': ['ant-design-vue'],
        'vendor-utils': ['axios', 'dayjs', 'lodash-es'],
      },
    },
  },
}
```

### 8.3 图片优化

```typescript
// 使用 WebP 格式
<img src="@/assets/images/chart.webp" alt="图表" />

// 懒加载
<img v-lazy="imageUrl" alt="图片" />

// SVG 图标使用组件
import { IconHome } from '@arco-design/web-vue/es/icon';
```

### 8.4 渲染优化

```vue
<template>
  <!-- 列表使用 key -->
  <div v-for="item in list" :key="item.id">
    {{ item.name }}
  </div>

  <!-- 大列表使用虚拟滚动 -->
  <a-table
    :data="largeList"
    :virtual-list-props="{ height: 600 }"
  />

  <!-- 避免不必要的响应式 -->
  <script setup lang="ts">
  import { shallowRef } from 'vue';

  // 大型对象使用 shallowRef
  const largeData = shallowRef({});
  </script>
</template>
```

### 8.5 网络优化

```typescript
// API 请求缓存
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

async function fetchWithCache(url: string) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await fetch(url);
  cache.set(url, { data, timestamp: Date.now() });
  return data;
}

// 请求合并（防抖）
function debounceRequest<T>(fn: () => Promise<T>, delay: number) {
  let timer: any = null;
  let promise: Promise<T> | null = null;

  return () => {
    if (promise) return promise;

    clearTimeout(timer);
    promise = new Promise<T>((resolve, reject) => {
      timer = setTimeout(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (e) {
          reject(e);
        } finally {
          promise = null;
        }
      }, delay);
    });

    return promise;
  };
}
```

### 8.6 构建优化

```bash
# 分析打包体积
npm run build -- --analyze

# 使用 esbuild 压缩
build: {
  minify: 'esbuild',
}

# 开启 gzip 压缩
build: {
  gzipSize: true,
}
```

---

## 附录

### A. 子应用清单

| 子应用 | 仓库路径 | 技术栈 | 端口 |
|--------|----------|--------|------|
| orion-dba | `/orion-dba/frontend` | Vue 3 + Ant Design Vue | 3010 |
| orion-knowledge | `/orion-knowledge/web/admin` | React 18 + MUI | 3020 |
| orion-visor | `/orion-visor/orion-visor-ui` | Vue 3 + Arco Design | 3030 |

### B. 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器
npm run dev -- --host    # 允许外部访问

# 构建
npm run build            # 生产构建
npm run build -- --analyze  # 分析打包体积

# 检查
npm run lint             # ESLint 检查
npm run type-check       # TypeScript 类型检查

# 测试
npm run test             # 运行测试
npm run test:coverage    # 测试覆盖率
```

### C. 相关文档

- [前端架构设计](./前端架构设计.md)
- [API 层设计规范](./API 层设计规范.md)
- [前端性能优化设计](./前端性能优化设计.md)
- [微前端子应用接入与后端交互设计](../../architecture/微前端子应用接入与后端交互设计.md)
- [升级执行计划](../../plans/orion-upgrade-executable-plan-2026-05-22.md)（Phase 0/1 改造任务清单）

---

**文档维护**：Orion 前端团队  
**最后更新**：2026-05-24 (v1.1)
