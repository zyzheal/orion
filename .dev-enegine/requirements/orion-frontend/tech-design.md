# Orion 前端基座技术方案

## 1. 技术栈选型

### 核心技术
- React 18.2+
- TypeScript 5.3+
- Vite 5.x

### UI 组件库
- Ant Design 5.x
- @ant-design/icons

### 状态管理
- Zustand 4.x

### 路由
- React Router 6.x

### HTTP 客户端
- Axios 1.x

### 代码质量
- ESLint
- Prettier

## 2. 项目结构

```
orion-frontend/
├── public/
├── src/
│   ├── api/                    # API 层
│   │   ├── client.ts           # Axios 实例
│   │   ├── auth.ts             # 认证 API
│   │   └── types.ts            # API 类型
│   ├── assets/                 # 静态资源
│   │   ├── styles/             # 全局样式
│   │   └── images/
│   ├── components/             # 通用组件
│   │   ├── Layout/             # 布局组件
│   │   ├── Loading/            # 加载组件
│   │   └── ErrorBoundary/      # 错误边界
│   ├── hooks/                  # 自定义 Hooks
│   │   ├── useAuth.ts
│   │   └── useFetch.ts
│   ├── pages/                  # 页面组件
│   │   ├── Dashboard/          # 工作台
│   │   ├── Login/              # 登录页
│   │   └── NotFound/           # 404 页
│   ├── router/                 # 路由配置
│   │   ├── index.tsx
│   │   └── routes.ts
│   ├── stores/                 # Zustand 状态管理
│   │   ├── authStore.ts
│   │   └── appStore.ts
│   ├── utils/                  # 工具函数
│   │   ├── format.ts
│   │   └── validation.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .eslintrc.js
```

## 3. 核心功能设计

### 3.1 API 层设计
- 统一的 Axios 实例配置
- 请求拦截器：自动添加 Token
- 响应拦截器：统一错误处理、Token 刷新

### 3.2 认证流程
- 登录：用户名密码 -> JWT Token
- 登出：清除 Token
- Token 刷新：refresh token 机制
- 路由守卫：未登录跳转登录页

### 3.3 状态管理
- authStore: 用户认证状态
- appStore: 应用全局状态（主题、侧边栏等）

### 3.4 布局设计
- Sider: 侧边栏导航
- Header: 顶部栏（用户信息、主题切换）
- Content: 内容区域
- Breadcrumb: 面包屑导航

## 4. 实现步骤

1. 项目初始化（Vite + React + TypeScript）
2. 安装依赖（Ant Design, Zustand, React Router, Axios）
3. 配置 ESLint + Prettier
4. 实现 API 层（client, auth, types）
5. 实现状态管理（authStore, appStore）
6. 实现自定义 Hooks（useAuth, useFetch）
7. 实现路由配置（routes, index）
8. 实现通用组件（Layout, Loading, ErrorBoundary）
9. 实现页面组件（Login, Dashboard, NotFound）
10. 实现工具函数（format, validation）
11. 配置全局样式和暗黑模式
12. 编写单元测试
13. 编写 README
