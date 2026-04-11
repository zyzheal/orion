# Orion — AI 研发效能平台

> 站在巨人肩上 — Tekton + Knative + Prometheus + K8s
> 核心主张：不替代现有工具链，而是让现有工具链变聪明

---

## 📚 文档导航

| 入口 | 文档 | 说明 |
|------|------|------|
| 📖 **文档索引** | [INDEX.md](INDEX.md) | 结构化文档索引（150 份文档） |
| 📋 **任务分发** | [00-文档索引与任务分发.md](00-文档索引与任务分发.md) | 44 模块任务矩阵 |
| 📝 **变更日志** | [CHANGELOG.md](CHANGELOG.md) | 文档变更记录 |
| 📐 **管理规范** | [docs/文档管理规范.md](docs/文档管理规范.md) | 命名/分类/生命周期 |
| 📊 **评审报告** | [docs/review/最终完成报告.md](docs/review/最终完成报告.md) | 专家评审改进计划总结 |

### 核心文档

| 文档 | 行数 | 说明 |
|------|------|------|
| [Orion-完整设计方案.md](Orion-完整设计方案.md) | 868 | 主文档，系统全貌 |
| [docs/architecture/架构重构设计.md](docs/architecture/架构重构设计.md) | ~600 | 核心域 + 支撑域 |
| [docs/architecture/服务拆分与数据库划分详解.md](服务拆分与数据库划分详解.md) | ~1100 | 8 微服务拆分 |
| [docs/review/最终完成报告.md](docs/review/最终完成报告.md) | ~500 | 44 问题完成情况总结 |

### 快速搜索

```bash
# 统计
./tools/search.sh --stats

# 列出 ADR
./tools/search.sh --adr

# 关键词搜索
./tools/search.sh -k "自愈引擎"

# 检查断裂链接
./tools/search.sh --broken

# 验证统计一致性
./tools/search.sh --verify-stats
```

### 子项目

| 项目 | 说明 |
|------|------|
| [orion-visor/](orion-visor/) | 运维可视化管理平台 (主系统) |
| [orion-knowledge/](orion-knowledge/) | AI 知识库微服务 (PandaWiki 二开) |
| [orion-dba/](orion-dba/) | 数据库管理平台 (原 Yearning + gemini-next) |
| [orion-api-gateway/](orion-api-gateway/) | API 网关服务 (Node.js + Fastify) |
| [orion-platform-service/](orion-platform-service/) | 平台核心服务 (Node.js + Express) |

### 服务启动

#### 1. API Gateway

```bash
cd orion-api-gateway
npm install
npm run dev
```

访问：http://localhost:3000/healthz

#### 2. Platform Service

```bash
cd orion-platform-service
npm install
npm run dev
```

访问：http://localhost:3001/healthz

#### 3. NATS 服务器

```bash
cd orion-api-gateway/infra/nats
docker-compose up -d
```

#### 环境变量配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | `3000` (gateway) / `3001` (platform) |
| `NATS_SERVERS` | NATS 服务器地址 | `nats://localhost:4222` |
| `REDIS_HOST` | Redis 主机 | `localhost` |
| `DB_HOST` | 数据库主机 | `localhost` |

### 🆕 最新补充 (2026-04-11)

**设计完成度**: 100% | **文档**: 150 份 / ~120,000 行 | **最后更新**: 2026-04-11

**核心统计**:
- 模块数：**37 个**
- 功能数：**251 个**
- AI 功能：**52 个** (23%)
- ADR 决策：**11 份**
- 评审报告：**5 份**
- 高保真设计：**23 份**

**本次补充**: 53 个功能 (AI 算法/LLM/SSO/产物/二方库/知识库/CMDB)

**详情**: [docs/requirements/需求功能更新汇总.md](docs/requirements/需求功能更新汇总.md)

---

### 详细设计文档（docs/）

| 分类 | 文档数 | 说明 |
|------|--------|------|
| [adr/](docs/adr/) | 11 份 | 架构决策记录 |
| [architecture/](docs/architecture/) | 20 份 | 架构设计 |
| [ai/](docs/ai/) | 15 份 | AI/算法设计 |
| [security/](docs/security/) | 10 份 | 安全与权限 |
| [frontend/](docs/frontend/) | 12 份 | 前端设计 |
| [db/](docs/db/) | 8 份 | 数据库设计 |
| [sre/](docs/sre/) | 8 份 | 运维/SRE |
| [requirements/](docs/requirements/) | 8 份 | 需求文档 |
| ... | ... | 更多分类见 [INDEX.md](INDEX.md) |

---

_设计完成度：100% | 文档：150 份 / ~120,000 行 | 模块：37 个 | 功能：251 个 | 最后更新：2026-04-11_