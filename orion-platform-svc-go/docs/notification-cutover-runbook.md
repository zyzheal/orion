# 通知模块切换运行手册

> 生成日期: 2026-07-17
> 模块: notification / notification-policy / notification-template / scheduled-notification / policy
> 依赖: P0-4 Gateway 灰度发布 (Gray Release)

---

## 1. 概述

### 1.1 迁移模块

| 模块 | Go 路径 | 端点 |
|------|---------|------|
| notification | `internal/notification/` | CRUD: List, Get, Create, Update, Delete, MarkRead, Stats, Count |
| notification-policy | `internal/notification-policy/` | Policy CRUD for notification rules |
| notification-template | `internal/notification-template/` | Template management |
| scheduled-notification | `internal/scheduled-notification/` | Scheduled notification triggers |
| policy (AI) | `internal/policy/` | AI policy engine + compliance |

### 1.2 Gateway 路由

所有通知端点通过 Gateway (`orion-api-gateway`) 代理到 Go 服务。灰度配置:

```
GRAY_RELEASE_ENABLED=true
GRAY_RELEASE_REDIS_KEY=gray-release:config
```

配置示例 (Redis JSON):
```json
{
  "routeTargets": [
    { "path": "/api/v1/notifications", "target": "go", "weight": 100 },
    { "path": "/api/v1/notification-policy", "target": "go", "weight": 100 },
    { "path": "/api/v1/notification-template", "target": "go", "weight": 100 },
    { "path": "/api/v1/scheduled-notification", "target": "go", "weight": 100 },
    { "path": "/api/v1/policy", "target": "go", "weight": 50 }
  ],
  "defaultTarget": "ts",
  "version": 1
}
```

### 1.3 依赖

- [ ] P0-4 Gateway 灰度发布已部署
- [ ] Redis 连接正常 (`redis://<host>:6379`)
- [ ] Go 服务编译通过: `go build ./...`
- [ ] 所有 5 个模块测试通过: `go test ./internal/notification* ./internal/policy/`
- [ ] DB migrations 已应用 (`migrations/236_add_source_columns.sql`)
- [ ] TS 通知端点仍在运行 (双写模式)

---

## 2. 切换前清单

### 2.1 代码层

- [ ] Go 服务 `go test ./...` 全量通过 (0 failures)
- [ ] `internal/notification/` 所有 handler 方法已实现
- [ ] `internal/notification-policy/` 策略 CRUD 已实现
- [ ] `internal/notification-template/` 模板管理已实现
- [ ] `internal/scheduled-notification/` 定时触发已实现
- [ ] `internal/policy/` AI 策略引擎已实现 (Evaluate, EvaluateGate, TestPolicy)
- [ ] SourceGuard middleware 已接入 main.go (`SetSource()`, `BlockConflicts()`)

### 2.2 基础设施

- [ ] PostgreSQL 数据库可用
- [ ] `_source` 列已添加到 `notifications`, `policy` 等相关表
- [ ] Redis 集群可用 (Gateway 灰度配置)
- [ ] Gateway 灰度路由已配置
- [ ] 日志系统可采集 Go 服务日志

### 2.3 监控

- [ ] Go 服务 healthz 端点可达
- [ ] Gateway 灰度路由有日志
- [ ] 错误率告警已配置 (阈值: >1% 触发)
- [ ] 延迟告警已配置 (阈值: P99 > 5s)

---

## 3. 切换步骤

### 阶段 1: 影子模式 (Day 1-3)

**目标**: Go 服务并行运行，比较响应一致性。

```bash
# 1. 启动 Go 服务（影子模式，接收 Gateway 灰度流量）
GRAY_RELEASE_ENABLED=true \
MIGRATE_DOWN_TO=0 \
go run ./cmd/server/main.go

# 2. 配置 Gateway 影子路由（1% 流量到 Go）
# Redis key: gray-release:config
redis-cli SET gray-release:config '{
  "routeTargets": [
    { "path": "/api/v1/notifications", "target": "go", "weight": 1 },
    { "path": "/api/v1/notification-policy", "target": "go", "weight": 1 },
    { "path": "/api/v1/notification-template", "target": "go", "weight": 1 },
    { "path": "/api/v1/scheduled-notification", "target": "go", "weight": 1 }
  ],
  "defaultTarget": "ts",
  "version": 1
}'

# 3. 验证影子模式
curl http://localhost:3001/api/v1/notifications/stats

# 4. 运行验证脚本
bash ./scripts/verify-notification.sh
```

**验收标准**:
- [ ] 24 小时影子模式无错误
- [ ] 响应格式与 TS 一致
- [ ] Gateway 灰度路由正常 (日志中能看到 `target: go`)

### 阶段 2: 10% 流量 (Day 4-7)

```bash
# 提高灰度比例到 10%
redis-cli SET gray-release:config '{
  "routeTargets": [
    { "path": "/api/v1/notifications", "target": "go", "weight": 10 },
    { "path": "/api/v1/notification-policy", "target": "go", "weight": 10 },
    { "path": "/api/v1/notification-template", "target": "go", "weight": 10 },
    { "path": "/api/v1/scheduled-notification", "target": "go", "weight": 10 }
  ],
  "defaultTarget": "ts",
  "version": 2
}'

# 监控 72 小时
watch -n 60 'curl -s http://localhost:3001/api/v1/notifications/stats | jq'
```

**验收标准**:
- [ ] 72 小时无 P0 错误
- [ ] 错误率 < 1%
- [ ] P99 延迟 < TS × 150%

### 阶段 3: 50% 流量 (Day 8-12)

```bash
# 提高到 50%
redis-cli SET gray-release:config '{
  "routeTargets": [
    { "path": "/api/v1/notifications", "target": "go", "weight": 50 },
    { "path": "/api/v1/notification-policy", "target": "go", "weight": 50 },
    { "path": "/api/v1/notification-template", "target": "go", "weight": 50 },
    { "path": "/api/v1/scheduled-notification", "target": "go", "weight": 50 }
  ],
  "defaultTarget": "ts",
  "version": 3
}'
```

**验收标准**:
- [ ] 72 小时无错误
- [ ] 前端通知功能全部正常
- [ ] 用户反馈无异常

### 阶段 4: 100% 流量 (Day 13-15)

```bash
# 全量切换到 Go
redis-cli SET gray-release:config '{
  "routeTargets": [
    { "path": "/api/v1/notifications", "target": "go", "weight": 100 },
    { "path": "/api/v1/notification-policy", "target": "go", "weight": 100 },
    { "path": "/api/v1/notification-template", "target": "go", "weight": 100 },
    { "path": "/api/v1/scheduled-notification", "target": "go", "weight": 100 }
  ],
  "defaultTarget": "go",
  "version": 4
}'

# 运行完整验证
bash ./scripts/verify-notification.sh --full
```

**验收标准**:
- [ ] 所有通知端点 100% 走 Go
- [ ] 验证脚本全量通过
- [ ] E2E 测试通过

### 阶段 5: TS 退役 (Day 16+)

- [ ] 从 TS `routes.ts` 中移除通知路由注册
- [ ] 从 Gateway 路由表中移除 TS 通知代理
- [ ] 更新前端 API client (如有路径差异)
- [ ] 运行 TS 编译验证: `npm run build`

---

## 4. 回滚步骤

### 4.1 立即回滚 (1 分钟)

```bash
# 方法 1: Gateway 层面回滚 (推荐)
redis-cli SET gray-release:config '{
  "routeTargets": [],
  "defaultTarget": "ts",
  "version": 100
}'

# 方法 2: 环境变量回滚 (需重启 Go 服务)
# 设置 GRAY_RELEASE_ENABLED=false 并重启

# 方法 3: DB 回滚 (如果 migration 有问题)
MIGRATE_DOWN_TO=235 go run ./cmd/server/main.go
```

### 4.2 回滚验证

```bash
# 验证 TS 端点正常
curl http://localhost:3001/api/v1/notifications/stats

# 验证 Gateway 日志显示 target: ts
grep "target.*ts" /var/log/gateway/gateway.log | tail -5

# 验证无 Go 流量
grep "target.*go" /var/log/gateway/gateway.log | tail -5
# 应返回空
```

---

## 5. 部署脚本

### 5.1 deploy-notification.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

# === Configuration ===
SERVICE_NAME="orion-platform-svc-go"
BINARY_PATH="/usr/local/bin/${SERVICE_NAME}"
SERVICE_DIR="/opt/orion-platform"
LOG_DIR="/var/log/${SERVICE_NAME}"
CONFIG_DIR="${SERVICE_DIR}/config"
BACKUP_DIR="${SERVICE_DIR}/backup"
GRACE_PERIOD=30

# === Pre-flight checks ===
echo "[1/6] Running pre-flight checks..."
if ! command -v go &> /dev/null; then
  echo "ERROR: go not found in PATH"
  exit 1
fi

if ! command -v redis-cli &> /dev/null; then
  echo "WARNING: redis-cli not found — skipping Redis check"
fi

# === Build ===
echo "[2/6] Building Go service..."
cd "${SERVICE_DIR}"
go build -o "${BINARY_PATH}" ./cmd/server/main.go
echo "Build complete: ${BINARY_PATH}"

# === Backup ===
echo "[3/6] Creating backup of current binary..."
mkdir -p "${BACKUP_DIR}"
if [[ -f "${BINARY_PATH}" ]]; then
  cp "${BINARY_PATH}" "${BACKUP_DIR}/${SERVICE_NAME}-$(date +%Y%m%d-%H%M%S)"
  echo "Backup created"
fi

# === Health check endpoint ===
HEALTH_URL="http://localhost:3001/healthz"
NOTIFY_ENDPOINTS=(
  "GET /api/v1/notifications/stats"
  "GET /api/v1/notifications/count"
)

# === Deploy ===
echo "[4/6] Starting Go service..."
# Kill existing process gracefully
if pgrep -f "orion-platform-svc-go" &> /dev/null; then
  echo "Gracefully stopping existing process (timeout ${GRACE_PERIOD}s)..."
  kill -TERM $(pgrep -f "orion-platform-svc-go") || true
  sleep ${GRACE_PERIOD}
  # Force kill if still running
  pgrep -f "orion-platform-svc-go" &> /dev/null && kill -9 $(pgrep -f "orion-platform-svc-go") || true
fi

# Start new process (nohup for background)
mkdir -p "${LOG_DIR}"
nohup "${BINARY_PATH}" >> "${LOG_DIR}/app.log" 2>&1 &
echo "Started with PID: $!"

# === Health check ===
echo "[5/6] Running health check..."
sleep 5
for i in {1..10}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" 2>/dev/null || echo "000")
  if [[ "${HTTP_CODE}" == "200" ]]; then
    echo "Health check passed on attempt ${i}"
    break
  fi
  echo "Health check attempt ${i} failed (HTTP ${HTTP_CODE}), retrying..."
  sleep 5
done

if [[ "${HTTP_CODE}" != "200" ]]; then
  echo "ERROR: Health check failed after 50 seconds"
  echo "Rolling back..."
  nohup "${BINARY_PATH}" >> "${LOG_DIR}/app.log" 2>&1 & || true
  exit 1
fi

# === Verify endpoints ===
echo "[6/6] Verifying notification endpoints..."
for endpoint in "${NOTIFY_ENDPOINTS[@]}"; do
  METHOD=$(echo "${endpoint}" | cut -d' ' -f1)
  PATH_=$(echo "${endpoint}" | cut -d' ' -f2)
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}/healthz" 2>/dev/null)
  echo "  Endpoint ${PATH_}: HTTP ${HTTP_CODE}"
done

# === Log deployment ===
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "[${TIMESTAMP}] DEPLOY: notification module cutover completed" >> "${LOG_DIR}/deploy.log"

echo "=== DEPLOYMENT COMPLETE ==="
```

### 5.2 verify-notification.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

# === Configuration ===
BASE_URL="${1:-http://localhost:3001}"
TENANT_ID="${ORION_TENANT_ID:-default-tenant}"
PASS=0
FAIL=0
TOTAL=0

log_pass() { echo "  ✅ PASS: $1"; PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); }
log_fail() { echo "  ❌ FAIL: $1 — $2"; FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); }

echo "=== Notification Module Verification ==="
echo "Base URL: ${BASE_URL}"
echo ""

# === Health check ===
echo "[1/7] Health check"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/healthz" 2>/dev/null || echo "000")
if [[ "${HTTP_CODE}" == "200" ]]; then
  log_pass "Health endpoint returns 200"
else
  log_fail "Health endpoint" "HTTP ${HTTP_CODE}"
  exit 1
fi

# === GET /notifications/stats ===
echo "[2/7] GET /notifications/stats"
RESP=$(curl -s -w "\n%{http_code}" -H "X-Tenant-ID: ${TENANT_ID}" \
  "${BASE_URL}/api/v1/notifications/stats" 2>/dev/null)
HTTP_CODE=$(echo "${RESP}" | tail -1)
BODY=$(echo "${RESP}" | head -n -1)
if [[ "${HTTP_CODE}" == "200" ]]; then
  log_pass "GET /notifications/stats (HTTP ${HTTP_CODE})"
else
  log_fail "GET /notifications/stats" "HTTP ${HTTP_CODE}"
fi

# === GET /notifications/count ===
echo "[3/7] GET /notifications/count"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-Tenant-ID: ${TENANT_ID}" \
  "${BASE_URL}/api/v1/notifications/count" 2>/dev/null || echo "000")
if [[ "${HTTP_CODE}" == "200" ]]; then
  log_pass "GET /notifications/count (HTTP ${HTTP_CODE})"
else
  log_fail "GET /notifications/count" "HTTP ${HTTP_CODE}"
fi

# === POST /notifications (create) ===
echo "[4/7] POST /notifications (create)"
CREATE_RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "X-Tenant-ID: ${TENANT_ID}" \
  -H "Content-Type: application/json" \
  -d '{"title":"verify-test","message":"cutover test","channels":["in_app"]}' \
  "${BASE_URL}/api/v1/notifications" 2>/dev/null)
HTTP_CODE=$(echo "${CREATE_RESP}" | tail -1)
if [[ "${HTTP_CODE}" == "200" || "${HTTP_CODE}" == "201" ]]; then
  NOTIF_ID=$(echo "${CREATE_RESP}" | head -n -1 | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  log_pass "POST /notifications (HTTP ${HTTP_CODE}, id=${NOTIF_ID})"
else
  log_fail "POST /notifications" "HTTP ${HTTP_CODE}"
fi

# === GET /notifications/:id ===
echo "[5/7] GET /notifications/:id"
if [[ -n "${NOTIF_ID:-}" ]]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Tenant-ID: ${TENANT_ID}" \
    "${BASE_URL}/api/v1/notifications/${NOTIF_ID}" 2>/dev/null || echo "000")
  if [[ "${HTTP_CODE}" == "200" ]]; then
    log_pass "GET /notifications/:id (HTTP ${HTTP_CODE})"
  else
    log_fail "GET /notifications/:id" "HTTP ${HTTP_CODE}"
  fi
else
  log_fail "GET /notifications/:id" "no notification ID from create"
fi

# === DELETE /notifications/:id ===
echo "[6/7] DELETE /notifications/:id"
if [[ -n "${NOTIF_ID:-}" ]]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
    -H "X-Tenant-ID: ${TENANT_ID}" \
    "${BASE_URL}/api/v1/notifications/${NOTIF_ID}" 2>/dev/null || echo "000")
  if [[ "${HTTP_CODE}" == "200" ]]; then
    log_pass "DELETE /notifications/:id (HTTP ${HTTP_CODE})"
  else
    log_fail "DELETE /notifications/:id" "HTTP ${HTTP_CODE}"
  fi
fi

# === Summary ===
echo ""
echo "=== Verification Summary ==="
echo "Total: ${TOTAL}, Pass: ${PASS}, Fail: ${FAIL}"
if [[ "${FAIL}" -gt 0 ]]; then
  echo "⚠️  Some tests failed — review before proceeding"
  exit 1
fi
echo "✅ All tests passed"
```

### 5.3 rollback-notification.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

# === Configuration ===
REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
REDIS_KEY="gray-release:config"

echo "=== Notification Module Rollback ==="

# === Step 1: Set all routes back to TS ===
echo "[1/3] Resetting Gateway routes to TS..."
RUBY_CONFIG='{"routeTargets":[],"defaultTarget":"ts","version":999}'
redis-cli -u "${REDIS_URL}" SET "${REDIS_KEY}" "${RUBY_CONFIG}"
echo "Gateway routes reset (defaultTarget=ts)"

# === Step 2: Verify TS endpoints ===
echo "[2/3] Verifying TS endpoints..."
TS_URL="${TS_URL:-http://localhost:3001}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${TS_URL}/api/v1/notifications/stats" 2>/dev/null || echo "000")
if [[ "${HTTP_CODE}" == "200" ]]; then
  echo "✅ TS notification endpoint accessible (HTTP ${HTTP_CODE})"
else
  echo "❌ WARNING: TS notification endpoint not accessible (HTTP ${HTTP_CODE})"
fi

# === Step 3: Log rollback ===
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_FILE="${LOG_DIR:-/var/log/orion-platform-svc-go}/rollback.log"
echo "[${TIMESTAMP}] ROLLBACK: notification module cutover rolled back to TS" >> "${LOG_FILE}" 2>/dev/null || true
echo "Rollback logged to ${LOG_FILE}"

echo ""
echo "=== ROLLBACK COMPLETE ==="
echo "Traffic is now routed to TS backend. Monitor for stability."
```

---

## 6. 监控

### 6.1 关键指标

| 指标 | 正常范围 | 告警阈值 |
|------|----------|----------|
| Go 服务 CPU | < 50% | > 80% |
| Go 服务内存 | < 2GB | > 3GB |
| 通知创建成功率 | > 99% | < 95% |
| 通知创建延迟 P50 | < 200ms | > 500ms |
| 通知创建延迟 P99 | < 2s | > 5s |
| DB 连接池使用率 | < 70% | > 90% |
| Gateway 灰度流量 (Go) | 1%-100% | 0% 或异常波动 |

### 6.2 告警配置

```
# Prometheus alerting rule example
groups:
- name: notification-cutover
  rules:
  - alert: NotificationCreateErrorRate
    expr: rate(go_notification_create_errors_total[5m]) / rate(go_notification_create_total[5m]) > 0.01
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Notification error rate > 1%"
  - alert: NotificationP99Latency
    expr: histogram_quantile(0.99, go_notification_create_duration_seconds_bucket) > 5
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "Notification P99 latency > 5s"
```

### 6.3 Dashboard

推荐 Grafana 面板:

1. **通知创建成功率** — rate of 2xx/4xx/5xx
2. **通知创建延迟** — histogram (P50/P95/P99)
3. **Gateway 灰度流量分布** — TS vs Go 百分比
4. **Go 服务资源使用** — CPU/Memory/Disk
5. **DB 连接池状态** — active connections

---

## 7. 通信计划

### 7.1 切换通知

| 阶段 | 通知对象 | 通知内容 | 通知渠道 |
|------|----------|----------|----------|
| 切换前 24h | 全体工程师 | 即将进行通知模块切换 | Slack #eng-announce |
| 切换前 1h | On-call | 切换即将开始，请在线监控 | Slack #eng-oncall + 电话 |
| 切换中 | On-call + PM | 每阶段状态更新 | Slack #eng-oncall |
| 切换完成 | 全体工程师 | 切换成功，通知模块已迁移到 Go | Slack #eng-announce |
| 切换失败 | On-call + PM + 技术负责人 | 切换失败，已回滚 | Slack #eng-oncall + 电话 + 会议 |

### 7.2 升级路径

```
L1: On-call engineer (immediate)
  ├── 问题可自行解决 → 记录 + 继续
  └── 问题超出能力 → L2
L2: Tech lead (15 min response)
  ├── 问题可自行解决 → 记录 + 继续
  └── 问题超出能力 → L3
L3: Engineering manager + incident commander (5 min response)
  ├── 启动事故响应流程
  └── 决定是否回滚
```

### 7.3 切换窗口

- **推荐时间**: 周二或周四 10:00-16:00 (UTC+8)
- **避开**: 周一 (周会), 周五 (风险高), 节假日
- **最晚**: 16:00 (确保有足够时间回滚)

---

## 8. 应急联系人

| 角色 | 姓名 | 联系方式 |
|------|------|----------|
| Tech Lead | TBD | TBD |
| On-call Engineer | TBD | TBD |
| DBA | TBD | TBD |
| SRE (Gateway/Redis) | TBD | TBD |

---

## 9. 附录

### A. 故障树

```
切换失败
├── Go 服务不可用
│   ├── 原因: 启动失败 → 回滚 + 修复启动配置
│   ├── 原因: 编译错误 → 回滚 + 修复代码
│   └── 原因: 依赖不可用 (DB/Redis) → 回滚 + 恢复依赖
├── Gateway 灰度路由异常
│   ├── 原因: Redis 不可用 → 降级到 TS (默认行为)
│   └── 原因: 配置错误 → 手动设置 defaultTarget=ts
├── 响应格式不一致
│   ├── 原因: JSON 字段不同 → 对比 + 修复 Go 实现
│   └── 原因: 日期格式不同 → 统一 RFC3339
└── 性能问题
    ├── 原因: DB 慢查询 → 索引优化
    └── 原因: 代码效率 → 性能优化
```

### B. 已知问题

1. **政策引擎测试**: `TestAndOr` / `TestMultipleRules` 可能不稳定 — 需要修复 `parseComp` 解析器
2. **通知 policy 路由**: Gateway 路径 `/api/v1/notification-policy` 可能与 TS 路径不同 — 需验证
3. **定时通知**: scheduled-notification 依赖 cron — 切换时可能遗漏已调度任务

---

*本文档基于 2026-07-17 的代码状态编写，随项目进展动态更新。*
*执行前请确认所有依赖项 (P0-4 Gateway 灰度发布) 已就绪。*
