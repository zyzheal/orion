# Orion-Knowledge 部署指南

可插拔知识库模块，独立于 Orion Visor 主系统，可单独启停。

## 快速开始

```bash
# 1. 进入部署目录
cd orion-knowledge/deploy

# 2. 环境变量已就绪 (.env 已从 .env.example 复制)
#    如需修改端口或密码，编辑 .env 文件

# 3. 构建镜像 (首次或代码更新时)
cd ../backend && make dev && cd ../deploy

# 4. 启动所有服务
docker compose up -d

# 5. 查看状态
docker compose ps
```

## 可用服务

| 服务 | 说明 | 默认端口 |
|------|------|----------|
| `api` | 知识库 API (Go) | 8090 |
| `consumer` | 文档解析/向量化消费者 | (内部) |
| `admin` | 管理端 UI (React + Nginx) | 3020 |
| `app` | Wiki 用户端 (Next.js) | 3010 |
| `postgres` | PostgreSQL 16 (知识库专用) | 5433 |
| `redis` | Redis 7 (缓存/会话) | 6381 |
| `minio` | MinIO 对象存储 | 9001 (API) / 9002 (Console) |
| `nats` | NATS 消息队列 (JetStream) | 4222 |
| `minio-init` | MinIO 一次性初始化 (创建 bucket) | (自动退出) |

## 常用命令

```bash
# 启动
docker compose up -d

# 停止 (保留数据)
docker compose down

# 停止并删除数据卷
docker compose down -v

# 查看日志
docker compose logs -f           # 所有服务
docker compose logs -f api       # 仅 API
docker compose logs -f consumer  # 仅 Consumer

# 重启单个服务
docker compose restart api

# 查看服务状态
docker compose ps
```

## 端口参考

所有端口均可在 `.env` 中自定义，避免与 Orion Visor 主系统冲突。

| 环境变量 | 默认值 | 用途 |
|----------|--------|------|
| `KNOWLEDGE_API_PORT` | 8090 | API 服务 |
| `KNOWLEDGE_ADMIN_PORT` | 3020 | 管理端 UI |
| `KNOWLEDGE_WIKI_PORT` | 3010 | Wiki 用户端 |
| `KNOWLEDGE_PG_PORT` | 5433 | PostgreSQL 外部访问 |
| `KNOWLEDGE_REDIS_PORT` | 6381 | Redis 外部访问 |
| `KNOWLEDGE_MINIO_PORT` | 9001 | MinIO API |
| `KNOWLEDGE_MINIO_CONSOLE_PORT` | 9002 | MinIO Console |
| `KNOWLEDGE_NATS_PORT` | 4222 | NATS 客户端连接 |

## 环境变量参考

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `IMAGE_REGISTRY` | 镜像仓库前缀 (留空使用本地构建) | |
| `IMAGE_TAG` | 镜像标签 | `latest` |
| `KNOWLEDGE_PG_PASSWORD` | PostgreSQL 密码 | `Knowledge@123` |
| `KNOWLEDGE_REDIS_PASSWORD` | Redis 密码 | `Knowledge@123` |
| `S3_ACCESS_KEY` | MinIO 访问密钥 | `knowledge` |
| `S3_SECRET_KEY` | MinIO 密钥 | `Knowledge@123` |
| `S3_BUCKET` | MinIO Bucket 名称 | `knowledge` |
| `S3_ENDPOINT` | MinIO 内部端点 | `orion-knowledge-minio:9000` |
| `KNOWLEDGE_BASE_PATH` | URL 基础路径 (Nginx 反代时填写) | |
| `LOG_LEVEL` | 日志级别 | `info` |

## 架构说明

```
用户浏览器
    |
    +---> admin:3020  (管理端, Nginx 反代到 API)
    +---> app:3010    (Wiki 用户端, Next.js 反代到 API)
    +---> api:8090    (Go API, 核心业务逻辑)
              |
              +---> postgres:5433   (数据持久化)
              +---> redis:6381      (缓存/会话)
              +---> minio:9001      (文档/附件存储)
              +---> nats:4222       (异步消息)
                        |
                        +---> consumer  (文档解析/向量化)
```

所有服务通过 `orion-knowledge-net` 隔离网络通信，数据卷挂载在 `./data/` 下。

---

## Kubernetes 部署

### 前提条件

- Kubernetes 集群 (1.24+)
- `kubectl` 已配置
- Nginx Ingress Controller 已安装
- 持久化存储 (StorageClass) 已就绪

### 快速部署

```bash
# 进入 K8s 部署目录
cd orion-knowledge/deploy/kubernetes

# 方式一: 使用 Kustomize (推荐)
kubectl apply -k .

# 方式二: 逐个应用清单
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
kubectl apply -f postgres-statefulset.yaml
kubectl apply -f redis-deployment.yaml
kubectl apply -f minio-deployment.yaml
kubectl apply -f nats-deployment.yaml
kubectl apply -f api-deployment.yaml
kubectl apply -f consumer-deployment.yaml
kubectl apply -f admin-deployment.yaml
kubectl apply -f app-deployment.yaml
kubectl apply -f ingress.yaml
kubectl apply -f networkpolicy.yaml
kubectl apply -f pdb.yaml
```

### 启用 SSO 集成

```bash
# 1. 编辑 secrets.yaml 和 oauth2-proxy.yaml 中的 OIDC 配置
#    - OAUTH2_PROXY_OIDC_ISSUER_URL: 你的 OIDC 提供商地址
#    - OAUTH2_PROXY_CLIENT_ID / CLIENT_SECRET: 应用凭证

# 2. 取消注释 kustomization.yaml 中的 oauth2-proxy.yaml
#    resources:
#      - oauth2-proxy.yaml

# 3. 取消注释 ingress.yaml 中的 OAuth2 annotations
#    annotations:
#      nginx.ingress.kubernetes.io/auth-url: "http://oauth2-proxy.orion-knowledge.svc.cluster.local/oauth2/auth"
#      nginx.ingress.kubernetes.io/auth-signin: "https://$host/oauth2/start?rd=$escaped_request_uri"

# 4. 重新应用
kubectl apply -k .
```

### 支持的 SSO 提供商

| 提供商 | Provider 值 | 说明 |
|--------|------------|------|
| Keycloak | `oidc` | 需配置 OIDC Issuer URL |
| Google | `google` | 自动发现 |
| GitHub | `github` | 需配置 Organization |
| Azure AD | `azure` | 需配置 Tenant |
| GitLab | `gitlab` | 自动发现 |
| Okta | `oidc` | 需配置 OIDC Issuer URL |

### 常用命令

```bash
# 查看状态
kubectl get all -n orion-knowledge

# 查看服务
kubectl get svc -n orion-knowledge

# 查看 Ingress
kubectl get ingress -n orion-knowledge

# 查看日志
kubectl logs -n orion-knowledge -l app.kubernetes.io/component=api -f

# 扩缩容
kubectl scale deployment orion-knowledge-api -n orion-knowledge --replicas=3

# 删除所有资源
kubectl delete -k .
```

### K8s 资源清单

| 文件 | 说明 |
|------|------|
| `namespace.yaml` | 创建 orion-knowledge Namespace |
| `configmap.yaml` | 应用配置 ConfigMap |
| `secrets.yaml` | 数据库密码、S3 密钥等 Secrets |
| `postgres-statefulset.yaml` | PostgreSQL StatefulSet + PVC + Headless Service |
| `redis-deployment.yaml` | Redis Deployment + PVC + Service |
| `minio-deployment.yaml` | MinIO Deployment + PVC + Service + 初始化 Job |
| `nats-deployment.yaml` | NATS Deployment + Service (JetStream) |
| `api-deployment.yaml` | API Deployment + Service + HPA |
| `consumer-deployment.yaml` | Consumer Deployment + HPA |
| `admin-deployment.yaml` | 管理端 Deployment + Service |
| `app-deployment.yaml` | Wiki 用户端 Deployment + Service |
| `ingress.yaml` | Ingress 资源 (/orion-knowledge/, /wiki/, /api/knowledge/) |
| `networkpolicy.yaml` | 网络策略 (微服务间通信隔离) |
| `pdb.yaml` | Pod 中断预算 |
| `oauth2-proxy.yaml` | OAuth2 Proxy (SSO/OIDC 集成) |
| `kustomization.yaml` | Kustomize 编排 |

### 架构说明

```
                    Ingress (nginx)
                    /    |    \
              /orion   /wiki  /api/knowledge
                |       |         |
              Admin    App       API
              (Nginx) (Next.js)  (Go)
                |       |      /  |  \  \
                |       |     PG  Redis MinIO NATS
                |       |                |
                +-------+------------ Consumer
                          (文档解析/向量化)
```

所有流量经过 OAuth2 Proxy (可选) 进行统一认证后转发到对应的后端服务。
