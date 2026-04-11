# Orion Frontend

Orion 平台前端基座，基于 React 18 + TypeScript + Vite 技术栈。

## 技术栈

- **React** 18.2+
- **TypeScript** 5.3+
- **Vite** 5.x
- **Ant Design** 5.x
- **Zustand** 4.x (状态管理)
- **React Router** 6.x
- **Axios** 1.x

## 项目结构

```
orion-frontend/
├── public/                 # 静态资源
├── src/
│   ├── api/                # API 层
│   │   ├── client.ts       # Axios 实例
│   │   ├── auth.ts         # 认证 API
│   │   └── types.ts        # API 类型
│   ├── assets/
│   │   └── styles/         # 全局样式
│   ├── components/         # 通用组件
│   │   ├── Layout/         # 布局组件
│   │   ├── Loading/        # 加载组件
│   │   └── ErrorBoundary/  # 错误边界
│   ├── hooks/              # 自定义 Hooks
│   │   ├── useAuth.ts
│   │   └── useFetch.ts
│   ├── pages/              # 页面组件
│   │   ├── Dashboard/      # 工作台
│   │   ├── Login/          # 登录页
│   │   └── NotFound/       # 404 页
│   ├── router/             # 路由配置
│   ├── stores/             # Zustand 状态管理
│   │   ├── authStore.ts
│   │   └── appStore.ts
│   ├── utils/              # 工具函数
│   │   ├── format.ts
│   │   └── validation.ts
│   ├── tests/              # 测试文件
│   ├── App.tsx
│   ├── main.tsx
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .eslintrc.json
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:3000

### 构建

```bash
npm run build
```

### 预览构建结果

```bash
npm run preview
```

### 代码检查

```bash
# TypeScript 类型检查
npm run type-check

# ESLint 检查
npm run lint

# ESLint 自动修复
npm run lint:fix

# Prettier 格式化
npm run format
```

### 测试

```bash
# 运行测试
npm run test

# 生成覆盖率报告
npm run test:coverage
```

## 功能特性

### 1. 用户认证
- 登录/登出
- Token 自动管理
- 路由守卫

### 2. 布局组件
- 侧边栏导航（可折叠）
- 顶部 Header
- 面包屑导航
- 内容区域

### 3. 状态管理
- 用户认证状态 (authStore)
- 应用全局状态 (appStore)
  - 主题切换（亮色/暗黑）
  - 侧边栏状态
  - 面包屑导航
  - 多标签页支持

### 4. API 层
- 统一的 Axios 实例
- 请求拦截器（自动添加 Token）
- 响应拦截器（统一错误处理）

### 5. 工具函数
- 格式化函数（日期、数字、文件大小等）
- 验证函数（邮箱、手机、密码强度等）

## 默认账号

开发环境默认账号：
- 用户名：`admin`
- 密码：`admin123`

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| VITE_API_BASE_URL | API 基础地址 | /api |
| VITE_APP_TITLE | 应用标题 | Orion Platform |
| VITE_ENABLE_MOCK | 启用 Mock | false |

## 浏览器支持

- Chrome >= 87
- Firefox >= 78
- Safari >= 14
- Edge >= 88

## License

MIT
