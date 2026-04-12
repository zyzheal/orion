# orion-dba-frontend

> Orion DBA 前端 - SQL 审核平台 (基于 Yearning gemini-next 改造)

---

## 概述

orion-dba-frontend 是 Orion 平台的 DBA 插件前端，基于 Yearning 的 gemini-next 项目改造而来。

**特性**:
- ✅ 支持独立运行 (开发模式)
- ✅ 支持微前端嵌入 Orion (生产模式)
- ✅ Vue 3 + TypeScript + Ant Design Vue
- ✅ 完整的 SQL 审核/查询/管理界面
- ✅ 集成 Orion 认证和权限系统

---

## 项目结构

```
orion-dba/frontend/
├── src/
│   ├── apis/           # API 封装
│   ├── components/     # 公共组件
│   ├── config/         # 配置文件
│   ├── lang/           # 国际化
│   ├── lib/            # 工具库
│   ├── mixins/         # 混入
│   ├── socket/         # WebSocket
│   ├── store/          # 状态管理
│   ├── style/          # 样式
│   ├── views/          # 页面
│   ├── App.vue         # 根组件
│   ├── main.ts         # 入口 (支持微前端)
│   └── router.ts       # 路由配置
├── index.html
├── package.json
├── vite.config.ts      # Vite 配置 (支持微前端构建)
└── tsconfig.json
```

---

## 快速开始

### 开发环境 (独立运行)

```bash
# 安装依赖
$ yarn install

# 启动开发服务器
$ yarn dev
# 访问：http://localhost:3010
```

### 生产环境 (微前端嵌入 Orion)

```bash
# 构建微前端包
$ yarn build

# 输出目录：dist/
# 生成文件：orion-dba-app.js (UMD 格式)
```

---

## 微前端集成

### 1. 独立模式

前端独立运行，后端 API 通过 Vite 代理转发：

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:8090',
      changeOrigin: true,
    },
  },
}
```

### 2. 微前端模式

前端作为 qiankun 子应用嵌入 Orion：

```typescript
// main.ts
if (window.__POWERED_BY_ORION__) {
  // 微前端模式
  export async function mount(props) {
    instance = createApp(props);
    instance.mount('#orion-dba-app');
  }
} else {
  // 独立模式
  const app = createApp();
  app.mount('#app');
}
```

### 3. Orion 全局状态

```typescript
// 接收 Orion 传来的状态
app.config.globalProperties.$orion = {
  user: props.user,
  permissions: props.permissions,
  token: props.token,
  apiBase: props.apiBase || '/api/v1/db',
};
```

---

## API 配置

### 独立模式

```typescript
// 使用 Authorization Header
config.headers['Authorization'] = token;
```

### 微前端模式

```typescript
// 使用 X-Orion-Token Header
config.headers['X-Orion-Token'] = token;
```

---

## 构建输出

```bash
$ yarn build

dist/
├── orion-dba-app.js       # UMD 格式主包
├── orion-dba-app.js.map   # Source Map
├── assets/                # 静态资源
│   ├── icon.[hash].png
│   └── ...
└── index.html             # 独立预览页面
```

---

## 依赖

| 依赖 | 版本 | 说明 |
|------|------|------|
| Vue | 3.2.39 | 核心框架 |
| Ant Design Vue | 3.2.15 | UI 组件库 |
| TypeScript | 4.3.2 | 类型系统 |
| Vite | 3.1.0 | 构建工具 |
| Vue Router | 4 | 路由 |
| Vuex | 4 | 状态管理 |
| Axios | 0.21.1 | HTTP 客户端 |
| Monaco Editor | 0.27.0 | 代码编辑器 |

---

## 开发注意事项

1. **微前端兼容性**
   - 避免使用 `window.location`，使用 `vue-router`
   - 避免使用 `localStorage` 存储敏感信息
   - 使用 `sessionStorage` 存储临时状态

2. **样式隔离**
   - 组件样式使用 `scoped`
   - 全局样式添加前缀 `.orion-dba-`

3. **API 调用**
   - 使用 `getApiBase()` 获取 API 基础路径
   - 微前端模式下自动使用 `X-Orion-Token`

---

## License

Apache-2.0
