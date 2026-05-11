# Orion 微服务部署指南

## 1. 环境要求

- Docker 24.0+
- Docker Compose 2.20+
- 至少 8GB RAM (开发环境) / 16GB RAM (生产环境)
- 至少 20GB 磁盘空间

## 2. 环境配置

### 2.1 环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，修改以下关键变量
# - POSTGRES_PASSWORD: 生产环境使用强密码
# - REDIS_PASSWORD: 生产环境使用强密码
# - NATS_TOKEN: 生产环境使用强令牌
# - JWT_SECRET: 生产环境使用强密钥 (至少 32 字符)
# - LOG_LEVEL: 生产环境建议设为 warn 或 error
```

### 2.2 生产环境推荐配置

```env
NODE_ENV=production
POSTGRES_PASSWORD=<强密码>
REDIS_PASSWORD=<强密码>
NATS_TOKEN=<强令牌>
JWT_SECRET=<至少32字符的随机密钥>
LOG_LEVEL=warn
REDIS_MAXMEMORY=1gb
```

## 3. 部署流程

### 3.1 首次部署

```bash
# 1. 构建所有服务镜像
./scripts/build.sh v1.0.0

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env

# 3. 启动服务
./scripts/start.sh

# 4. 验证服务状态
docker compose ps

# 5. 验证健康检查
curl http://localhost:3000/health
```

### 3.2 更新部署

```bash
# 1. 构建新版本镜像
./scripts/build.sh v1.1.0

# 2. 更新 .env 中的版本标签
# GATEWAY_VERSION=v1.1.0
# PLATFORM_VERSION=v1.1.0
# ...

# 3. 滚动更新 (零停机)
docker compose up -d --no-deps orion-platform-core
docker compose up -d --no-deps orion-pipeline-svc
# ... 逐个服务更新

# 4. 验证更新
curl http://localhost:3000/health
docker compose ps
```

### 3.3 回滚

```bash
# 1. 更新 .env 中的版本到旧版本
# GATEWAY_VERSION=v1.0.0
# ...

# 2. 重新部署
docker compose up -d

# 3. 验证回滚
docker compose ps
```

## 4. 生产部署注意事项

### 4.1 数据库备份

```bash
# 备份所有数据库
for DB in platform_db pipeline_db deploy_db ticket_db monitor_db intelligence_db; do
    docker exec orion-postgres pg_dump -U orion $DB > backup_${DB}_$(date +%Y%m%d).sql
done

# 恢复数据库
docker exec -i orion-postgres psql -U orion platform_db < backup_platform_db_20240101.sql
```

### 4.2 数据卷管理

```bash
# 查看数据卷
docker volume ls | grep orion

# 备份数据卷
docker run --rm -v orion_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-data.tar.gz -C /data .

# 恢复数据卷
docker run --rm -v orion_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-data.tar.gz -C /data
```

### 4.3 日志管理

```bash
# 查看特定服务日志
docker compose logs -f orion-gateway

# 查看最近 100 行
docker compose logs --tail=100 orion-platform-core

# 导出日志
docker compose logs orion-monitor-svc > monitor.log
```

### 4.4 资源限制 (生产环境)

在生产环境中，建议在 docker-compose.yml 中添加资源限制：

```yaml
services:
  orion-gateway:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 4.5 安全加固

1. **网络隔离**: 使用 Docker swarm 或 Kubernetes 网络策略限制服务间通信
2. **TLS 终止**: 在 Gateway 前放置反向代理 (Nginx/Caddy) 处理 HTTPS
3. **密钥管理**: 使用 Docker secrets 或外部密钥管理服务
4. **镜像扫描**: 定期扫描镜像漏洞
5. **最小权限**: 容器内使用非 root 用户运行

## 5. 监控和告警

### 5.1 健康检查端点

所有服务暴露 `/health` 端点：

```bash
# 检查 Gateway
curl -s http://localhost:3000/health | jq

# 检查 Platform
curl -s http://localhost:3001/health | jq
```

### 5.2 NATS 监控

```bash
# NATS 监控端点
curl http://localhost:8222/varz
curl http://localhost:8222/connz
curl http://localhost:8222/subsz
```

### 5.3 PostgreSQL 监控

```bash
# 数据库连接数
docker exec orion-postgres psql -U orion -c "SELECT count(*) FROM pg_stat_activity;"

# 数据库大小
docker exec orion-postgres psql -U orion -c "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname)) FROM pg_database ORDER BY pg_database_size(pg_database.datname) DESC;"
```

## 6. 故障排查

### 6.1 服务无法启动

```bash
# 查看服务日志
docker compose logs <service-name>

# 检查依赖服务状态
docker compose ps

# 手动进入容器调试
docker compose exec <service-name> sh
```

### 6.2 数据库连接失败

```bash
# 检查 PostgreSQL 状态
docker compose exec postgres pg_isready

# 检查数据库是否存在
docker compose exec postgres psql -U orion -c "\l"

# 重新初始化数据库
docker compose down -v
docker compose up -d postgres
```

### 6.3 NATS 连接失败

```bash
# 检查 NATS 状态
docker compose exec nats wget -qO- http://localhost:8222/healthz

# 查看 NATS 日志
docker compose logs nats
```

## 7. CI/CD 集成

### 7.1 GitHub Actions 示例

```yaml
name: Deploy Orion

on:
  push:
    tags:
      - 'v*'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build images
        run: ./scripts/build.sh ${{ github.ref_name }}
      - name: Deploy
        run: |
          docker compose pull
          docker compose up -d
          docker compose ps
```

## 8. 扩容

### 8.1 水平扩容

对于需要水平扩容的服务，使用 Docker Swarm 或 Kubernetes：

```bash
# Docker Swarm 模式
docker service scale orion-platform-core=3

# Kubernetes 模式 (需要转换为 K8s 资源配置)
kubectl scale deployment orion-platform-core --replicas=3
```

### 8.2 垂直扩容

调整 docker-compose.yml 中的资源限制或增加宿主机资源。
