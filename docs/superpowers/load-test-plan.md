# Go 平台服务全量压测方案

**编写日期**: 2026-07-12
**状态**: 待执行（数据库/Redis 不可用）

---

## 1. 压测环境要求

| 组件 | 状态 | 说明 |
|------|------|------|
| PostgreSQL | ⏳ 待连接 | localhost:5432 |
| Redis | ⏳ 待连接 | localhost:6379 |
| Go 服务 | ⏳ 待启动 | localhost:8080 |
| 压测工具 | ✅ ab 可用 | Apache Bench |

---

## 2. 压测端点清单

| 端点 | TS P95 (s) | Go 目标 P95 | 说明 |
|------|-----------|------------|------|
| `/healthz` | 0.00433 | < 0.008 | 健康检查 |
| `/api/v1/chaos/experiments` | 0.00262 | < 0.005 | Chaos 实验列表 |
| `/api/v1/monitoring/alerts` | 0.00150 | < 0.003 | 告警列表 |
| `/api/v1/inception/records` | 0.00153 | < 0.003 | 入职记录 |
| `/api/v1/config` | — | < 0.005 | 配置列表 |
| `/api/v1/tenant/quotas` | — | < 0.005 | 配额查询 |

---

## 3. 压测配置

```bash
DURATION=30        # 压测持续时间 (秒)
CONCURRENCY=100    # 并发请求数
TARGET=http://localhost:8080
```

---

## 4. 执行方式

### 4.1 启动依赖

```bash
# PostgreSQL (Docker)
docker run --name orion-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=orion123 \
  -e POSTGRES_DB=orion \
  postgres:16-alpine

# Redis (Docker)
docker run --name orion-redis -p 6379:6379 \
  redis:7-alpine
```

### 4.2 启动 Go 服务

```bash
cd orion-platform-svc-go
go run ./cmd/server
```

### 4.3 执行压测

```bash
./docs/superpowers/scripts/load-test.sh
```

---

## 5. 通过标准

| 指标 | 通过条件 |
|------|---------|
| P95 延迟 | < TS 基线 × 2 |
| 错误率 | < 1% |
| RPS | > 100 |

---

## 6. 当前状态

- [ ] PostgreSQL 连接可用
- [ ] Redis 连接可用  
- [ ] Go 服务启动
- [ ] 压测执行
- [ ] 结果分析