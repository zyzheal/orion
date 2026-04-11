# Orion 前端基座需求文档

## 功能描述
搭建 Orion 平台的前端基座，采用 React 18 + TypeScript + Vite 技术栈，为后续微前端和子应用集成提供基础框架。

## 功能要求

### 1. 项目结构
完整的 React + TypeScript 项目结构，包含 API 层、组件库、Hooks、页面、路由、状态管理等。

### 2. 核心技术栈
- React 18.2+
- TypeScript 5.3+
- Vite 5.x
- Ant Design 5.x
- Zustand 4.x (状态管理)
- React Router 6.x
- Axios 1.x

### 3. 基础功能
- [ ] 用户认证（登录/登出/Token 刷新）
- [ ] 路由守卫（鉴权）
- [ ] 全局状态管理（Zustand）
- [ ] API 请求拦截/响应拦截
- [ ] 错误边界处理
- [ ] 加载状态管理
- [ ] 暗黑模式支持

### 4. 布局组件
- [ ] 侧边栏导航
- [ ] 顶部 Header
- [ ] 多 Tab 支持
- [ ] 面包屑导航
- [ ] 内容区域

### 5. 页面组件
- [ ] 登录页（表单验证）
- [ ] 工作台 Dashboard（数据展示）
- [ ] 404 页面

## 测试用例

### TC-001: 项目启动
```bash
cd orion-frontend
npm install
npm run dev
```
预期：项目正常启动，无错误

### TC-002: TypeScript 类型检查
```bash
npm run type-check
```
预期：无类型错误

### TC-003: ESLint 检查
```bash
npm run lint
```
预期：无 lint 错误

### TC-004: 单元测试
```bash
npm run test
```
预期：所有测试通过

### TC-005: 登录页面渲染
访问 `/login` 页面
预期：登录表单正常渲染

### TC-006: 路由守卫
未登录访问 `/dashboard`
预期：重定向到 `/login`

### TC-007: API 请求拦截
发送 API 请求
预期：自动携带 Authorization Token

### TC-008: 布局组件渲染
访问 `/dashboard` 页面
预期：侧边栏、Header、面包屑正常渲染

## 验收标准
- [ ] 项目可正常启动（npm run dev）
- [ ] 路由配置正确
- [ ] 登录/登出功能可用
- [ ] 路由守卫生效
- [ ] API 请求拦截器正确携带 Token
- [ ] 全局状态管理可用
- [ ] 布局组件渲染正常
- [ ] TypeScript 类型检查通过
- [ ] ESLint 检查通过
- [ ] 单元测试通过
