# Orion-Knowledge 微服务改造方案

> **来源**: PandaWiki 二开（AGPL-3.0 开源协议）
> **目标**: 前后端改造为可插拔微服务，独立部署、独立启停、与 Orion 主系统松耦合
> **状态**: 设计中

---

## 一、项目重命名

### 1.1 命名映射

| 原名称 | 新名称 | 范围 |
|--------|--------|------|
| `PandaWiki` | `Orion-Knowledge` | 产品名、UI 展示名 |
| `panda-wiki` | `orion-knowledge` | 包名、镜像名、容器名、环境变量前缀 |
| `github.com/chaitin/panda-wiki` | `github.com/orion-platform/orion-knowledge` | Go module path |
| `panda-wiki-app` | `orion-knowledge-app` | 前端用户端 npm 包名 |
| `panda-wiki-admin` | `orion-knowledge-admin` | 前端管理端 npm 包名 |
| `@panda-wiki/icons` | `@orion-knowledge/icons` | 前端图标包 |
| `@panda-wiki/themes` | `@orion-knowledge/themes` | 前端主题包 |
| `@panda-wiki/ui` | `@orion-knowledge/ui` | 前端 UI 组件包 |

### 1.2 项目位置

```
orion-design/
├── orion-visor/            # 现有主系统（不变）
├── orion-knowledge/        # 知识库微服务（由 PandaWiki 改名而来）
│   ├── backend/            # Go 后端 API + Consumer
│   ├── web/
│   │   ├── admin/          # 管理端 UI（Vite + React）
│   │   ├── app/            # 用户端 Wiki UI（Next.js）
│   │   └── packages/       # 共享组件
│   ├── deploy/
│   │   ├── docker-compose.yaml
│   │   ├── .env.example
│   │   └── k8s/            # K8s manifests（可选）
│   └── docs/
```

---

## 二、可插拔架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Orion 统一入口                             │
│                     (Nginx / API Gateway)                         │
│                                                                 │
│   /orion-visor/*    ──→  主系统 (Java Spring Boot)                │
│   /orion-knowledge/ ──→  知识库管理端 (Vite SPA)                   │
│   /wiki/*           ──→  知识库用户端 (Next.js)                    │
│   /api/knowledge/*  ──→  知识库 API (Go)                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
   ┌──────▼──────┐  ┌───────▼──────┐  ┌──────▼──────┐
   │ Orion Visor │  │ Orion        │  │ 共享基础设施  │
   │ (主系统)     │  │ Knowledge    │  │             │
   │             │  │ (微服务)     │  │ Nginx       │
   │ MySQL       │  │              │  │ (统一路由)   │
   │ Redis       │  │ PostgreSQL   │  │             │
   │ InfluxDB    │  │ Redis        │  └─────────────┘
   │ Guacd       │  │ MinIO (S3)   │
   └─────────────┘  │ NATS         │
                    └──────────────┘
```

### 2.2 可插拔设计原则

```
可插拔 = 独立部署 + 独立启停 + 可选依赖 + 统一注册

1. 独立部署
   ├── 知识库有独立的 docker-compose
   ├── 可与主系统分开部署到不同机器
   └── 不依赖 Orion Visor 的构建流程

2. 独立启停
   ├── docker compose up/down 不影响主系统
   ├── 健康检查自包含
   └── 优雅关闭，不丢数据

3. 可选依赖
   ├── 知识库不依赖主系统即可运行
   ├── 主系统不依赖知识库即可运行
   └── 两者通过 API 松耦合通信

4. 统一注册
   ├── 知识库启动后向 Orion 注册自身地址
   ├── Orion 通过服务发现感知知识库是否可用
   └── 前端通过 Gateway 自动路由
```

### 2.3 启用/禁用机制

```yaml
# orion-knowledge/deploy/.env
# ─────────────────────────────────────────
# 知识库开关：false 时整个知识库模块不启动
KNOWLEDGE_ENABLED=true

# 前端访问路径前缀
KNOWLEDGE_BASE_PATH=/orion-knowledge

# Wiki 用户端访问路径
WIKI_BASE_PATH=/wiki

# API 路径
API_BASE_PATH=/api/knowledge

# 与主系统 SSO 集成
SSO_ENABLED=false  # true = 接入 Orion Visor 统一认证
SSO_ORION_URL=http://orion-visor-service:9200
```

**禁用效果**：`docker compose up` 时不启动任何知识库容器，Orion 主系统自动检测知识库不可用并隐藏入口。

---

## 三、Docker Compose 设计

### 3.1 独立的 docker-compose（可插拔）

```yaml
# orion-knowledge/deploy/docker-compose.yaml
# ──────────────────────────────────────────────
# 可插拔知识库模块
# 独立于 orion-visor/docker-compose.yaml
# 使用共享网络 orion-net 或自建网络
# ──────────────────────────────────────────────

name: orion-knowledge

services:
  # ── 知识库 API ──────────────────────────
  api:
    image: ${IMAGE_REGISTRY:-}orion-knowledge-api:${IMAGE_TAG:-latest}
    container_name: orion-knowledge-api
    restart: unless-stopped
    ports:
      - "${KNOWLEDGE_API_PORT:-8090}:8000"
    environment:
      # 数据库
      PG_DSN: "host=${KNOWLEDGE_PG_HOST:-orion-knowledge-pg} user=${KNOWLEDGE_PG_USER:-knowledge} password=${KNOWLEDGE_PG_PASSWORD:-Knowledge@123} dbname=orion_knowledge port=5432 sslmode=disable TimeZone=Asia/Shanghai"
      # Redis
      REDIS_ADDR: "orion-knowledge-redis:6379"
      REDIS_PASSWORD: "${KNOWLEDGE_REDIS_PASSWORD:-Knowledge@123}"
      # MinIO
      S3_ENDPOINT: "${S3_ENDPOINT:-orion-knowledge-minio:9000}"
      S3_ACCESS_KEY: "${S3_ACCESS_KEY:-knowledge}"
      S3_SECRET_KEY: "${S3_SECRET_KEY:-Knowledge@123}"
      S3_BUCKET: "${S3_BUCKET:-knowledge}"
      S3_USE_SSL: "false"
      # NATS
      NATS_URL: "nats://orion-knowledge-nats:4222"
      # 日志
      LOG_LEVEL: "${LOG_LEVEL:-info}"
      # 基础路径（与前端对应）
      BASE_PATH: "${KNOWLEDGE_BASE_PATH:-}"
    volumes:
      - ./data/api/config:/app/config
    networks:
      - orion-knowledge-net
      - orion-net  # 可选：接入主网络
    healthcheck:
      test: ["CMD", "curl", "-f", "http://127.0.0.1:8000/api/v1/health"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 10s
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy

  # ── 知识库 Consumer（文档处理）───────────
  consumer:
    image: ${IMAGE_REGISTRY:-}orion-knowledge-consumer:${IMAGE_TAG:-latest}
    container_name: orion-knowledge-consumer
    restart: unless-stopped
    environment:
      PG_DSN: "host=orion-knowledge-pg user=knowledge password=Knowledge@123 dbname=orion_knowledge port=5432 sslmode=disable TimeZone=Asia/Shanghai"
      REDIS_ADDR: "orion-knowledge-redis:6379"
      REDIS_PASSWORD: "${KNOWLEDGE_REDIS_PASSWORD:-Knowledge@123}"
      S3_ENDPOINT: "orion-knowledge-minio:9000"
      S3_ACCESS_KEY: "knowledge"
      S3_SECRET_KEY: "${KNOWLEDGE_S3_SECRET_KEY:-Knowledge@123}"
      S3_BUCKET: "${S3_BUCKET:-knowledge}"
      S3_USE_SSL: "false"
      NATS_URL: "nats://orion-knowledge-nats:4222"
    volumes:
      - ./data/consumer/cache:/app/cache
    networks:
      - orion-knowledge-net
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      nats:
        condition: service_healthy

  # ── 知识库管理端 UI ─────────────────────
  admin:
    image: ${IMAGE_REGISTRY:-}orion-knowledge-admin:${IMAGE_TAG:-latest}
    container_name: orion-knowledge-admin
    restart: unless-stopped
    ports:
      - "${KNOWLEDGE_ADMIN_PORT:-3020}:80"
    environment:
      NGINX_API_PROXY: "http://orion-knowledge-api:8000"
      BASE_PATH: "${KNOWLEDGE_BASE_PATH:-}"
    networks:
      - orion-knowledge-net
    depends_on:
      api:
        condition: service_healthy

  # ── 知识库用户端 Wiki UI ────────────────
  app:
    image: ${IMAGE_REGISTRY:-}orion-knowledge-app:${IMAGE_TAG:-latest}
    container_name: orion-knowledge-app
    restart: unless-stopped
    ports:
      - "${KNOWLEDGE_WIKI_PORT:-3010}:3000"
    environment:
      TARGET: "http://orion-knowledge-api:8000"
      BASE_PATH: "${KNOWLEDGE_BASE_PATH:-}"
    networks:
      - orion-knowledge-net
    depends_on:
      api:
        condition: service_healthy

  # ── PostgreSQL（知识库专用）──────────────
  postgres:
    image: postgres:16-alpine
    container_name: orion-knowledge-pg
    restart: unless-stopped
    ports:
      - "${KNOWLEDGE_PG_PORT:-5433}:5432"
    environment:
      POSTGRES_DB: orion_knowledge
      POSTGRES_USER: knowledge
      POSTGRES_PASSWORD: "${KNOWLEDGE_PG_PASSWORD:-Knowledge@123}"
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U knowledge -d orion_knowledge"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - orion-knowledge-net

  # ── Redis（知识库专用）───────────────────
  redis:
    image: redis:7-alpine
    container_name: orion-knowledge-redis
    restart: unless-stopped
    ports:
      - "${KNOWLEDGE_REDIS_PORT:-6381}:6379"
    command: sh -c 'redis-server --requirepass $${KNOWLEDGE_REDIS_PASSWORD}'
    environment:
      KNOWLEDGE_REDIS_PASSWORD: "${KNOWLEDGE_REDIS_PASSWORD:-Knowledge@123}"
    volumes:
      - ./data/redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s
    networks:
      - orion-knowledge-net

  # ── MinIO（知识库专用对象存储）──────────
  minio:
    image: minio/minio:latest
    container_name: orion-knowledge-minio
    restart: unless-stopped
    ports:
      - "${KNOWLEDGE_MINIO_PORT:-9001}:9000"
      - "${KNOWLEDGE_MINIO_CONSOLE_PORT:-9002}:9001"
    environment:
      MINIO_ROOT_USER: "${S3_ACCESS_KEY:-knowledge}"
      MINIO_ROOT_PASSWORD: "${S3_SECRET_KEY:-Knowledge@123}"
    command: server /data --console-address ":9001"
    volumes:
      - ./data/minio:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://127.0.0.1:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - orion-knowledge-net

  # ── NATS（消息队列）─────────────────────
  nats:
    image: nats:2-alpine
    container_name: orion-knowledge-nats
    restart: unless-stopped
    ports:
      - "${KNOWLEDGE_NATS_PORT:-4222}:4222"
    command: "--js"
    volumes:
      - ./data/nats:/var/lib/nats
    healthcheck:
      test: ["CMD", "nats", "server", "report", "jetstream"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - orion-knowledge-net

  # ── MinIO 初始化（一次性）──────────────
  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set myminio http://orion-knowledge-minio:9000 $${S3_ACCESS_KEY:-knowledge} $${S3_SECRET_KEY:-Knowledge@123};
      mc mb --ignore-existing myminio/$${S3_BUCKET:-knowledge};
      exit 0;
      "
    environment:
      S3_ACCESS_KEY: "${S3_ACCESS_KEY:-knowledge}"
      S3_SECRET_KEY: "${S3_SECRET_KEY:-Knowledge@123}"
      S3_BUCKET: "${S3_BUCKET:-knowledge}"
    networks:
      - orion-knowledge-net

networks:
  orion-knowledge-net:
    driver: bridge
  orion-net:
    external: true
    name: orion-visor_orion-visor-net  # 接入主系统网络（可选）
```

### 3.2 环境变量（.env.example）

```bash
# ──────────────────────────────────────────
# Orion-Knowledge 环境变量
# ──────────────────────────────────────────

# 镜像配置
IMAGE_REGISTRY=
IMAGE_TAG=latest

# ── 端口配置 ──────────────────────────────
KNOWLEDGE_API_PORT=8090
KNOWLEDGE_ADMIN_PORT=3020
KNOWLEDGE_WIKI_PORT=3010
KNOWLEDGE_PG_PORT=5433
KNOWLEDGE_REDIS_PORT=6381
KNOWLEDGE_MINIO_PORT=9001
KNOWLEDGE_MINIO_CONSOLE_PORT=9002
KNOWLEDGE_NATS_PORT=4222

# ── 数据库 ────────────────────────────────
KNOWLEDGE_PG_PASSWORD=Knowledge@123
KNOWLEDGE_REDIS_PASSWORD=Knowledge@123

# ── 对象存储 ──────────────────────────────
S3_ACCESS_KEY=knowledge
S3_SECRET_KEY=Knowledge@123
S3_BUCKET=knowledge

# ── 路径配置 ──────────────────────────────
KNOWLEDGE_BASE_PATH=
LOG_LEVEL=info
```

---

## 四、与主系统集成

### 4.1 Nginx 统一路由

在 Orion Visor 的 Nginx 中添加 location 块，将流量转发到知识库：

```nginx
# orion-visor/docker/nginx/conf.d/orion.conf
# 在现有配置中追加知识库路由

# 知识库管理端
location /orion-knowledge/ {
    proxy_pass http://orion-knowledge-admin:80/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# 知识库用户端（Wiki 网站）
location /wiki/ {
    proxy_pass http://orion-knowledge-app:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# 知识库 API
location /api/knowledge/ {
    proxy_pass http://orion-knowledge-api:8000/api/v1/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

> **可插拔体现**：如果知识库未启动，Nginx 返回 `503 Service Unavailable` 或重定向到"模块未启用"页面。

### 4.2 服务发现与健康检查

Orion Visor 主系统可通过 HTTP 健康检查感知知识库状态：

```
GET /api/knowledge/health
→ 200 OK  → 知识库可用，前端显示入口
→ 503     → 知识库未启动，前端隐藏入口
```

### 4.3 SSO 集成（可选）

知识库支持接入 Orion Visor 统一认证：

```
方案 A: JWT 共享
  Orion Visor 签发 JWT → 知识库使用相同密钥验证
  实现: 知识库读取 Orion JWT_SECRET，验证 token 中的用户信息

方案 B: OAuth2
  知识库作为 OAuth2 Client → 重定向到 Orion Visor 认证
  实现: 知识库增加 /auth/orion 回调端点

方案 C: 反向代理认证
  Nginx 在转发请求到知识库时注入 X-User-Id 和 X-User-Name header
  实现: 最简单，适合内网环境
```

**推荐方案 C**（反向代理认证）作为默认，方案 A（JWT 共享）作为进阶选项。

---

## 五、前端微服务集成

### 5.1 三种集成方式

```
┌─────────────────────────────────────────────────┐
│ 方式一：iframe 嵌入（最快）                       │
│ Orion Visor 页面中 <iframe src="/orion-knowledge">│
│ 优点: 0 改造，立即可用                             │
│ 缺点: 体验割裂，样式不一致                         │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 方式二：独立页面 + Nginx 路由（推荐）             │
│ 用户访问 /orion-knowledge → 直接跳转到独立 UI      │
│ 优点: 完整体验，独立部署                          │
│ 缺点: 导航需要统一处理                            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 方式三：微前端 Module Federation（最优）          │
│ Orion Knowledge 作为 remote，Orion Visor 作为 host│
│ 优点: 无缝集成，统一导航和样式                     │
│ 缺点: 需要改造 admin 端为 Module Federation remote │
└─────────────────────────────────────────────────┘
```

**阶段推荐**：先用方式二快速上线 → 后续升级为方式三。

### 5.2 Next.js 用户端部署适配

Next.js 需要以 Node.js 运行时运行，Dockerfile 改为：

```dockerfile
# web/app/Dockerfile (修改后)
FROM node:20-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY packages ./packages
COPY app ./app
WORKDIR /app/app
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/app/.next ./.next
COPY --from=builder /app/app/public ./public
COPY --from=builder /app/app/package.json ./package.json
COPY --from=builder /app/app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## 六、后端改造清单

### 6.1 Go Module 路径替换

```bash
# 1. 修改 go.mod
#    github.com/chaitin/panda-wiki → github.com/orion-platform/orion-knowledge

# 2. 全局替换 import 路径
find backend/ -name "*.go" -exec sed -i '' \
  's|github.com/chaitin/panda-wiki|github.com/orion-platform/orion-knowledge|g' {} \;

# 3. 重新生成
cd backend && make generate
```

### 6.2 配置文件默认值替换

```go
// backend/config/config.go 中的默认 DSN:
// 旧: host=panda-wiki-postgres user=panda-wiki password=panda-wiki-secret ...
// 新: host=orion-knowledge-pg user=knowledge password=Knowledge@123 ...
```

### 6.3 环境变量支持

```go
// 所有配置通过环境变量覆盖，支持外部注入
// 这样 docker compose 可以灵活配置
PG_DSN         = env("PG_DSN", "host=orion-knowledge-pg...")
REDIS_ADDR     = env("REDIS_ADDR", "orion-knowledge-redis:6379")
S3_ENDPOINT    = env("S3_ENDPOINT", "orion-knowledge-minio:9000")
NATS_URL       = env("NATS_URL", "nats://orion-knowledge-nats:4222")
```

---

## 七、去商品化改造清单

### 7.1 前端用户端（web/app/）

| # | 文件 | 原内容 | 改为 |
|---|------|--------|------|
| 1 | `package.json` | `panda-wiki-app` | `orion-knowledge-app` |
| 2 | `src/components/QaModal/index.tsx` | `PandaWiki 提供技术支持` | `Orion-Knowledge 提供技术支持` |
| 3 | `src/components/footer/index.tsx` | `release.baizhi.cloud/panda-wiki/icon.png` | 本地 `/favicon.png` |
| 4 | 全局 | `@panda-wiki/icons` | `@orion-knowledge/icons` |
| 5 | 全局 | `@panda-wiki/ui` | `@orion-knowledge/ui` |
| 6 | 全局 | `@panda-wiki/themes` | `@orion-knowledge/themes` |
| 7 | `src/request/` | 类型名含 `ChaitinPandaWiki` | 重新生成 API 类型 |

### 7.2 前端管理端（web/admin/）

| # | 文件 | 原内容 | 改为 |
|---|------|--------|------|
| 1 | `package.json` | `panda-wiki-admin` | `orion-knowledge-admin` |
| 2 | `src/components/Sidebar/index.tsx` | `PandaWiki` 文字 | `Orion Knowledge` |
| 3 | `src/components/Sidebar/index.tsx` | GitHub `chaitin/PandaWiki` | 移除或改 |
| 4 | `src/components/Sidebar/index.tsx` | `bbs.baizhi.cloud` | 移除 |
| 5 | `src/components/Sidebar/Version.tsx` | 外部版本检查 | 移除或改为内部 |
| 6 | `src/main.tsx` | `panda-wiki.css` | `orion-knowledge.css` |
| 7 | `src/components/CustomModal/utils.ts` | 外部 logo URL | 本地 logo |
| 8 | `src/components/CreateWikiModal/steps/initData.ts` | 品牌引导文案 | 重写为 Orion 引导 |
| 9 | `src/components/.../FooterConfig.tsx` | `PandaWiki 版权信息` | `Orion Knowledge 版权信息` |

### 7.3 包名替换（web/packages/）

| 包 | 旧 name | 新 name |
|----|---------|---------|
| icons | 通过 workspace 引用 | `@orion-knowledge/icons` |
| themes | 通过 workspace 引用 | `@orion-knowledge/themes` |
| ui | 通过 workspace 引用 | `@orion-knowledge/ui` |

---

## 八、启动与验证

### 8.1 一键启动

```bash
cd orion-knowledge/deploy

# 首次：复制环境变量
cp .env.example .env

# 启动整个知识库模块
docker compose up -d

# 查看状态
docker compose ps

# 预期输出:
# orion-knowledge-api         healthy
# orion-knowledge-consumer    running
# orion-knowledge-admin       healthy
# orion-knowledge-app         running
# orion-knowledge-pg          healthy
# orion-knowledge-redis       healthy
# orion-knowledge-minio       healthy
# orion-knowledge-nats        healthy
```

### 8.2 访问验证

```bash
# 管理端
open http://localhost:3020

# Wiki 用户端
open http://localhost:3010

# API 健康检查
curl http://localhost:8090/api/v1/health
```

### 8.3 一键停止（可插拔验证）

```bash
# 停止知识库，Orion Visor 不受影响
docker compose down

# 确认主系统仍然正常
cd ../../orion-visor
docker compose ps  # 全部 running ✓
```

---

## 九、端口汇总

| 服务 | 容器端口 | 宿主机端口 | 说明 |
|------|----------|-----------|------|
| API | 8000 | 8090 | 知识库后端 API |
| Admin UI | 80 | 3020 | 管理端 |
| App UI | 3000 | 3010 | Wiki 用户端 |
| PostgreSQL | 5432 | 5433 | 知识库数据库 |
| Redis | 6379 | 6381 | 缓存 |
| MinIO API | 9000 | 9001 | 对象存储 |
| MinIO Console | 9001 | 9002 | 对象存储控制台 |
| NATS | 4222 | 4222 | 消息队列 |

> 所有端口可通过 `.env` 调整，避免与 Orion Visor 冲突。

---

## 十、AGPL-3.0 合规提醒

| 要求 | 应对 |
|------|------|
| 修改代码必须开源 | 改造后的 Orion-Knowledge 代码需保持开源 |
| 网络交互也视为分发 | 通过 API 与主系统通信即满足要求 |
| 必须保留版权声明 | 保留 PandaWiki 原始 LICENSE 和 NOTICE |
| 衍生作品同样 AGPL | Orion-Knowledge 整体仍为 AGPL-3.0 |

**建议**：在 `orion-knowledge/` 根目录保留原始 LICENSE，在 README 中注明 "Based on PandaWiki (AGPL-3.0), modified for Orion platform"。

---

## 十一、改造优先级排序

### Phase 1：核心可运行（第 1 步）
- [ ] `go.mod` 路径替换
- [ ] `config.go` 默认值替换
- [ ] `docker-compose.yaml` 编写
- [ ] `Makefile` 镜像路径替换
- [ ] 前端 package name 替换

### Phase 2：去品牌化（第 2 步）
- [ ] 前端 UI 文字替换（Sidebar/QaModal/Footer）
- [ ] 外部 URL 移除/替换
- [ ] logo 和引导图片替换
- [ ] 初始化引导文案重写
- [ ] npm packages name 替换

### Phase 3：集成主系统（第 3 步）
- [ ] Nginx 路由配置
- [ ] 健康检查端点
- [ ] SSO 集成
- [ ] 前端入口集成

### Phase 4：生产就绪（第 4 步）
- [ ] K8s manifests 编写
- [ ] 日志聚合配置
- [ ] 备份恢复脚本
- [ ] 监控告警接入
