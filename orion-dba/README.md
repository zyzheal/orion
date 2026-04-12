# orion-dba

> Orion SQL 审核插件 - 基于 Yearning 改造

---

## 概述

orion-dba 是 Orion 平台的一个可插拔 SQL 审核插件，基于 Yearning 开源项目改造而来。

**特性**:
- ✅ MySQL SQL 审核 (基于 Inception)
- ✅ SQL 在线查询 + 结果导出
- ✅ 工单流程 (提交→审核→执行→回滚)
- ✅ 审核规则自定义
- ✅ 多数据源管理
- ✅ 权限管理 (集成 Orion RBAC)
- ✅ 审计日志
- ✅ 可插拔 (安装/禁用/卸载)
- ✅ 微前端 (独立运行 or 嵌入 Orion)

---

## 项目结构

```
orion-dba/
├── plugin.yaml              # 插件描述文件
├── README.md                # 项目说明
├── backend/                 # Go 后端 (基于 Yearning 改造)
│   ├── cmd/main.go         # 主入口 (Gin 框架)
│   ├── handler/            # 业务处理器 (复制自 Yearning)
│   ├── model/              # 数据模型 (复制自 Yearning)
│   ├── router/             # 路由配置 (复制自 Yearning)
│   ├── engine/             # SQL 审核引擎 (复制自 Yearning)
│   ├── lib/                # 工具库 (复制自 Yearning)
│   ├── apis/               # API 接口 (复制自 Yearning)
│   ├── service/            # 服务层 (复制自 Yearning)
│   ├── i18n/               # 国际化 (复制自 Yearning)
│   ├── internal/           # 内部扩展 (预留)
│   └── pkg/                # 公共包 (预留)
├── frontend/                # Vue3 前端 (微前端子应用)
│   ├── src/
│   │   ├── apis/           # API 封装
│   │   ├── components/     # 公共组件
│   │   ├── config/         # 配置文件
│   │   ├── views/          # 页面组件
│   │   ├── main.ts         # 入口 (支持独立/微前端模式)
│   │   └── App.vue         # 根组件
│   ├── package.json
│   ├── vite.config.ts
│   └── README.md
├── scripts/                # 部署脚本
├── Dockerfile.backend      # 后端 Dockerfile
├── Dockerfile.frontend     # 前端 Dockerfile
└── docker-compose.yaml     # Docker Compose
```

---

## 快速开始

### 独立运行 (开发环境)

```bash
# 后端
$ cd backend
$ go run cmd/main.go
# 访问: http://localhost:8090

# 前端
$ cd frontend
$ npm install
$ npm run dev
# 访问: http://localhost:3010
```

### 嵌入 Orion (生产环境)

```bash
# 1. 构建镜像
$ docker-compose build

# 2. 启动
$ docker-compose up -d

# 3. 在 Orion 插件中心安装
# 访问: http://orion.internal/plugins → 安装 orion-dba
```

---

## 插件管理

### 安装

```bash
# 通过 plugin.yaml 安装
$ orion plugin install plugin.yaml

# 或通过 API
$ curl -X POST http://orion-api/api/v1/plugins/install \
  -H "Content-Type: application/yaml" \
  --data-binary @plugin.yaml
```

### 禁用

```bash
$ orion plugin disable orion-dba
```

### 启用

```bash
$ orion plugin enable orion-dba
```

### 卸载

```bash
$ orion plugin uninstall orion-dba
```

---

## API 文档

### SQL 审核

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/v1/db/audit/submit | POST | 提交 SQL 审核 |
| /api/v1/db/audit/review | POST | 审核 SQL |
| /api/v1/db/audit/execute | POST | 执行 SQL |
| /api/v1/db/audit/list | GET | 审核列表 |
| /api/v1/db/audit/:id | GET | 审核详情 |
| /api/v1/db/audit/:id/rollback | POST | 回滚 SQL |

### SQL 查询

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/v1/db/query/execute | POST | 执行查询 |
| /api/v1/db/query/history | GET | 查询历史 |
| /api/v1/db/query/export | GET | 导出结果 |

### SQL 工单

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/v1/db/ticket/create | POST | 创建工单 |
| /api/v1/db/ticket/list | GET | 工单列表 |
| /api/v1/db/ticket/approve | POST | 审批工单 |
| /api/v1/db/ticket/reject | POST | 拒绝工单 |

---

## 配置

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务端口 | 8090 |
| DB_HOST | MySQL 地址 | localhost |
| DB_USER | MySQL 用户 | dba |
| DB_PASSWORD | MySQL 密码 | - |
| DB_NAME | MySQL 数据库 | orion_dba |
| INCEPTION_HOST | Inception 地址 | localhost |
| INCEPTION_PORT | Inception 端口 | 6669 |
| ORION_API_URL | Orion API 地址 | http://localhost:8080 |

---

## 依赖

| 依赖 | 版本 | 说明 |
|------|------|------|
| MySQL | >= 8.0 | 元数据存储 |
| Inception | >= 2.3 | SQL 审核引擎 |
| Orion | >= 1.0.0 | 平台依赖 (生产环境) |

---

## License

Apache-2.0
