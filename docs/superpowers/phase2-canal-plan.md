# Phase 2: 渐进式迁移 — 切流方案

**方案版本**: v4 (71af9b00)
**编写日期**: 2026-07-12
**状态**: 待执行

---

## 1. 架构现状

### 1.1 迁移前

```
┌─────────────┐    /api/v1/*     ┌──────────────────────┐
│  API        │ ────────────────→│  orion-platform-service│
│  Gateway    │                  │  (TS, :3001)          │
│  (:3000)    │                  └──────────────────────┘
└─────────────┘                         │
                                        ▼
                                    ┌──────────┐
                                    │  PG DB   │
                                    │  (共享)  │
                                    └──────────┘
```

### 1.2 迁移后

```
┌─────────────┐    /api/v1/*     ┌──────────────────────┐
│  API        │ ────────────────→│  orion-platform-svc-go│
│  Gateway    │                  │  (Go, :8080)         │
│  (:3000)    │                  └──────────────────────┘
└─────────────┘                         │
                                        ▼
                                    ┌──────────┐
                                    │  PG DB   │
                                    │  (共享)  │
                                    └──────────┘
```

**关键差异**:
- 端口: `:3001` → `:8080`
- 运行时: Node.js → Go
- 路由层: Fastify → Gin (接口兼容, 路径不变)
- 数据库: 共享同一 PG 实例 (Schema 已对齐)

---

## 2. 切流步骤

### Step 1: 构建与打包

```bash
cd orion-platform-svc-go
go build -trimpath -ldflags="-s -w" -o /tmp/orion-platform-svc ./cmd/server
# 或使用 Docker
docker build -t orion/platform-svc:latest .
```

### Step 2: Go 服务部署

```bash
# 环境变量
export PORT=8080
export DATABASE_URL=postgresql://...  # 与 TS 相同
export REDIS_URL=redis://...          # 与 TS 相同

# 启动
./orion-platform-svc
# 或 Docker
docker run -p 8080:8080 -e DATABASE_URL=... -e REDIS_URL=... orion/platform-svc:latest
```

### Step 3: Gateway 路由切换

修改 `orion-api-gateway/src/config/index.ts`:

```typescript
// 迁移前
platform: {
  url: process.env.PLATFORM_SERVICE_URL || 'http://localhost:3001',
  timeout: parseInt(process.env.PLATFORM_TIMEOUT || '30000', 10),
},

// 迁移后
platform: {
  url: process.env.PLATFORM_GO_SERVICE_URL || 'http://localhost:8080',
  timeout: parseInt(process.env.PLATFORM_TIMEOUT || '30000', 10),
},
```

重新构建 Gateway:
```bash
cd orion-api-gateway
npm run build
# 重启 Gateway 进程
```

### Step 4: 验证

| 检查项 | 命令 | 通过标准 |
|--------|------|---------|
| 健康检查 | `curl http://localhost:8080/healthz` | `{"status":"ok"}` |
| 依赖健康 | `curl http://localhost:8080/health` | DB/Redis all healthy |
| 指标端点 | `curl http://localhost:8080/metrics` | Prometheus metrics |
| 核心端点 | `curl http://localhost:8080/api/v1/chaos/experiments` | 200 + 数据返回 |
| 路由覆盖 | 扫描所有 51 个模块端点 | 全部 200 |

### Step 5: 性能验证

```bash
# 对比 TS 基线
# /healthz:     TS P95=0.00433s → Go 应 < 0.008s
# /chaos:       TS P95=0.00262s → Go 应 < 0.005s
# /inception:   TS P95=0.00153s → Go 应 < 0.003s
# /monitoring:  TS P95=0.00150s → Go 应 < 0.003s

# 使用 hey 压测
hey -z 30s -q 100 http://localhost:8080/api/v1/chaos/experiments
```

### Step 6: TS 服务下线

- 停止 `orion-platform-service` 进程
- 验证 Gateway 不再路由到 `:3001`
- 保留 TS 代码作为备份 (git tag)

---

## 3. 金丝雀策略

| 阶段 | 流量 | 持续时间 | 监控指标 | 回滚触发条件 |
|------|------|---------|---------|-------------|
| 0 — 内部验证 | 0% | 30min | 功能正确性 | 任何 5xx |
| 1 — 灰度 | 5% | 2h | P95 延迟, 错误率 | P95 > 2× 基线 |
| 2 — 扩展灰度 | 25% | 4h | 同上 + 业务指标 | 错误率 > 1% |
| 3 — 半量 | 50% | 24h | 全量指标 | 任一指标异常 |
| 4 — 全量 | 100% | — | 持续监控 | — |

**注意**: 由于当前为单体架构（非微服务拆分），金丝雀通过 Gateway 层面的加权路由实现，而非按模块切流。

---

## 4. 回滚方案

### 4.1 一键回滚

```bash
# 1. Gateway 路由切回 TS
sed -i '' "s/localhost:8080/localhost:3001/" orion-api-gateway/src/config/index.ts

# 2. 启动 TS 服务
cd orion-platform-service && npm run start

# 3. 停止 Go 服务
pkill -f orion-platform-svc

# 4. 重启 Gateway
cd orion-api-gateway && npm run start

# 5. 验证
curl http://localhost:3001/healthz
```

### 4.2 数据一致性保障

- **共享数据库**: TS/Go 共享同一 PG 实例，回滚后数据无需迁移
- **Schema 对齐**: 47 个 migration 已统一 UUID，TS/Go 使用相同表结构
- **事务安全**: Go 回滚不影响正在执行的 TS 事务

### 4.3 回滚验证清单

- [ ] Gateway 已切回 `:3001`
- [ ] TS 服务已启动且健康检查通过
- [ ] Go 服务已停止
- [ ] 核心端点返回 200
- [ ] 数据库连接正常
- [ ] 前端页面可正常访问

---

## 5. 部署检查清单

### 前置条件
- [ ] `go build ./orion-platform-svc-go/...` 通过
- [ ] 47 个 migration 文件已就位
- [ ] PG 数据库已创建 `gen_random_uuid()` 扩展
- [ ] Redis 实例可连接
- [ ] Gateway 代码已修改端口配置

### 部署时
- [ ] Go 服务启动日志无 error
- [ ] `/healthz` 返回 ok
- [ ] `/health` DB/Redis 均为 healthy
- [ ] `/metrics` 返回 Prometheus 格式
- [ ] 至少 5 个核心端点验证通过

### 部署后
- [ ] TS 服务已停止
- [ ] Gateway 重新构建并部署
- [ ] 前端功能验证（至少 3 个页面）
- [ ] 性能对比完成（P95 < 2× TS 基线）
- [ ] Git tag 标记迁移完成
