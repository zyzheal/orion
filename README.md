# Orion — AI 研发效能平台

> 站在巨人肩上 — Tekton + Knative + Prometheus + K8s
> 核心主张：不替代现有工具链，而是让现有工具链变聪明

---

## 文档导航

| 入口 | 文档 | 说明 |
|------|------|------|
| **文档索引** | [INDEX.md](INDEX.md) | 结构化文档索引 |
| **完整设计方案** | [Orion-完整设计方案.md](Orion-完整设计方案.md) | 系统全貌主文档 |
| **变更日志** | [CHANGELOG.md](CHANGELOG.md) | 文档变更记录 |
| **管理规范** | [docs/文档管理规范.md](docs/文档管理规范.md) | 命名/分类/生命周期 |
| **API 速查** | [API-QUICK-REFERENCE.md](API-QUICK-REFERENCE.md) | API 端点快速参考 |

### 核心文档

| 文档 | 说明 |
|------|------|
| [Orion-完整设计方案.md](Orion-完整设计方案.md) | 主文档，系统全貌 |
| [docs/architecture/架构重构设计.md](docs/architecture/架构重构设计.md) | 核心域 + 支撑域 |
| [docs/architecture/当前系统架构.md](docs/architecture/当前系统架构.md) | 当前实际架构 |

### 子项目

| 项目 | 说明 |
|------|------|
| [orion-api-gateway-go/](orion-api-gateway-go/) | API 网关服务（Go + Gin，替代旧 TS 版本） |
| [orion-platform-svc-go/](orion-platform-svc-go/) | 平台核心服务（Go + Gin） |
| [orion-go-common/](orion-go-common/) | 公共库（Go） |
| [orion-visor/](orion-visor/) | 运维可视化管理平台 |
| [orion-knowledge/](orion-knowledge/) | AI 知识库微服务 |
| [orion-dba/](orion-dba/) | 数据库管理平台 |
| [orion-ai-service/](orion-ai-service/) | AI 微服务（Python） |
| [orion-frontend/](orion-frontend/) | 前端（React + Vite） |
| [legacy/](legacy/) | 已归档的 TS 版本（仅存档，不再维护） |

### 服务启动

#### 1. API Gateway（Go）

```bash
cd orion-api-gateway-go
go build -o bin/api-gateway ./cmd/server
./bin/api-gateway
```

访问：http://localhost:3000/healthz

#### 2. Platform Service（Go）

```bash
cd orion-platform-svc-go
go build -o bin/server ./cmd/server
./bin/server
```

访问：http://localhost:3001/healthz

#### 3. Frontend

```bash
cd orion-frontend
npm install
npm run dev
```

访问：http://localhost:5173

#### 环境变量配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | `3000` (gateway) / `3001` (platform) |
| `REDIS_ADDR` | Redis 地址 | `localhost:6379` |
| `DB_HOST` | 数据库主机 | `localhost` |
| `GIN_MODE` | Gin 运行模式 | `debug` |

### 详细设计文档（docs/）

| 分类 | 文档数 | 说明 |
|------|--------|------|
| [adr/](docs/adr/) | 8 份 | 架构决策记录 |
| [architecture/](docs/architecture/) | 40 份 | 架构设计 |
| [services/ai/](docs/services/ai/) | 22 份 | AI/算法设计 |
| [services/security/](docs/services/security/) | 12 份 | 安全与权限 |
| [services/dba/](docs/services/dba/) | 6 份 | 数据库设计 |
| [services/monitor/](docs/services/monitor/) | 8 份 | 可观测性 |
| [services/plugin/](docs/services/plugin/) | 6 份 | 插件/工具 |
| [services/pipeline/](docs/services/pipeline/) | 8 份 | 流水线 |
| ... | ... | 更多分类见 [INDEX.md](INDEX.md) |

---

_最后更新：2026-09-25（TS→Go 完整迁移完成，API Gateway + Platform Service 均使用 Go）_
