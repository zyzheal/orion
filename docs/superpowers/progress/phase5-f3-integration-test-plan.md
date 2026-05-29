# Phase 5 F3: 全链路测试 + 性能基线

> **创建日期**: 2026-05-29
> **前提**: Phase 5 F1/F2 完成

## 测试策略

### 1. 服务间集成测试

每个 Go 服务需要验证：
- 启动正常（DSN 配置 + 数据库连接）
- CRUD API 端点返回正确状态码
- 租户隔离（不同 tenant_id 数据不互通）
- 错误处理（无效输入返回 400，不存在返回 404）

### 2. API Gateway 路由测试

验证 Gateway 正确路由到 Go 服务：
```bash
# 测试每个服务的 healthz 端点
curl http://localhost:3000/api/v1/auth/healthz
curl http://localhost:3000/api/v1/pipelines/healthz
curl http://localhost:3000/api/v1/deployments/healthz
# ... 所有 43 个服务
```

### 3. 数据库迁移测试

验证迁移脚本正确执行：
```bash
# 对每个服务运行迁移
for svc in orion-*-svc-go; do
  echo "Testing $svc migration..."
  psql -f $svc/migrations/001_create_*.sql $TEST_DB
done
```

### 4. 性能基线

| 指标 | 目标 | 测量方法 |
|------|------|---------|
| 启动时间 | < 3s | time 命令 |
| 内存占用 | < 50MB | RSS |
| API P50 | < 50ms | wrk/hey |
| API P99 | < 200ms | wrk/hey |
| QPS | >= 1000 | wrk/hey |

### 5. 测试覆盖

| 测试类型 | 覆盖范围 | 工具 |
|---------|---------|------|
| 单元测试 | models + service | go test |
| 集成测试 | handler + repository | go test + testcontainers |
| E2E 测试 | API 端点 | curl/httpie |
| 性能测试 | 负载 | wrk/hey |

## 执行计划

### Step 1: 服务启动验证（1 天）
- 每个服务 `go build` 成功
- 每个服务 `go test` 通过
- 每个服务可以连接数据库

### Step 2: API 端点测试（2 天）
- 每个服务的 CRUD 端点测试
- 错误处理测试
- 租户隔离测试

### Step 3: 集成测试（3 天）
- 服务间调用测试
- Gateway 路由测试
- 事件总线测试

### Step 4: 性能基线（2 天）
- 单服务性能测试
- 端到端性能测试
- 记录基线数据

### Step 5: 文档更新（1 天）
- 更新 API 文档
- 更新部署文档
- 更新运维手册

## 验收标准

- [ ] 43 个 Go 服务全部启动成功
- [ ] 所有 API 端点返回正确响应
- [ ] 租户隔离测试通过
- [ ] 性能基线达标
- [ ] E2E 测试通过
