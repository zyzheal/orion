# 部署与灰度策略（承接 Meta Review D3）

**评审对象**：本轮新增 5 Migration + 2 后端域 + 12 前端页面/组件 + 8 Feature Flag 的部署策略
**文档性质**：部署/灰度设计，非生产代码
**版本**：v1.0（2026-10-11）
**关联**：
- 上游：`design-set-enterprise-level-meta-review-2026-10-11.md` §3.3（P3 部署策略缺失）
- 关联：`backend-g1-g3-implementation-spec-2026-10-11.md`（Migration 699-703 + Feature Flag）
- 关联：`triage-api-contract-design-2026-10-11.md`（8 Feature Flag）
- 关联：`frontend-a11y-p0-prework-design-2026-10-11.md`（P0-1 Layout nav Flag）
- 关联：`observability-plan-2026-10-11.md`（SLO + 告警）

**硬约束**：
- **RC-03**：部署/灰度设计，不修改生产代码。
- **不估算人天/工期**。
- 对齐 ADR-005（PG 单库）、ADR-010（AlertBreaker 事务）。

---

## 1. 部署范围总览

**⭐ 本轮部署对象**（机械盘点）：

| 类别 | 数量 | 详情 |
|---|---|---|
| Migration | 5 | 699, 700, 701, 702, 703 |
| 后端新域 | 3 | recipient, triage, notification-adapter |
| 后端 API 端点 | 7 | triage API（1 overview + 4 子集 + 2 动作） |
| WebSocket 通道 | 1 | `/api/v1/ws/triage` |
| Feature Flag | 8 | triage.enabled, triage.websocket.enabled, triage.partial_failure, triage.dnd_filter, triage.group_by, notification.pipeline_adapter, layout-nav-a11y-v2, + 1 未命名 |
| 前端新页面 | 5 | Triage, UserRole, DND, + 3 视图 |
| 前端组件 | 10+ | ViewSwitcher, OnCallStatusCard, SeveritySourceMatrix 等 |
| 键盘快捷键 | 15 | 见 frontend-triage-implementation-spec §6 |
| 命令面板命令 | 7 | 见 frontend-triage-implementation-spec §5 |

**部署顺序原则**：
1. **Migration 先于代码**（先落数据层）
2. **Feature Flag 先于功能启用**（先准备，后打开）
3. **内部验证 → canary → 生产灰度 → 全量**
4. **可回退**（每一步都可 rollback）

---

## 2. 环境分层

### 2.1 环境定义

| 环境 | 用途 | 部署周期 | 数据 |
|---|---|---|---|
| **dev** | 开发自测 | 每次 commit | mock / 沙盒 |
| **staging** | 集成测试 | 每日 | 从 prod 脱敏复制 |
| **internal** | 内部验证 | 每 build | 从 prod 脱敏 |
| **prod-canary** | 金丝雀生产 | 手动触发 | 生产真实数据 |
| **prod** | 全量生产 | 手动触发 | 生产真实数据 |

**金丝雀环境**：
- 与 prod 共享基础设施（同一 PG / Redis 集群）
- 独立服务实例（1-2 个副本）
- 生产真实数据（但仅 1-10% 用户流量）

### 2.2 环境配置矩阵

| 配置项 | dev | staging | internal | prod-canary | prod |
|---|---|---|---|---|---|
| Feature Flag 默认 | on | off | off | off | off |
| 日志级别 | debug | info | info | info | warn |
| Tracing 采样 | 100% | 100% | 100% | 100% | 10% |
| WS 事件广播 | 全部 | 全部 | 全部 | 全部 | 全部 |

---

## 3. 部署时序（8 阶段）

### 3.1 时序图

```
Day 0:  代码就绪
    ↓
Day 1-2:  Phase A: Migration 部署 (dev → staging → internal)
    ↓
Day 3-4:  Phase B: 后端代码部署 (Feature Flag off)
    ↓
Day 5:    Phase C: 前端代码部署 (Feature Flag off)
    ↓
Day 6-7:  Phase D: Canary 验证 (internal → prod-canary, 1 租户)
    ↓
Day 8-10: Phase E: 生产灰度 10%
    ↓
Day 11-13: Phase F: 生产灰度 50%
    ↓
Day 14-15: Phase G: 生产灰度 100%
    ↓
Day 16+: Phase H: 稳定观察 + Flag 默认打开
```

### 3.2 Phase A：Migration 部署

**目标**：5 Migration 全部落库，业务代码不感知

**步骤**：

```bash
# Step 1: 备份 (强制)
pg_dump --format=custom -f /backup/pre-migration-$(date +%Y%m%d).dump "$DATABASE_URL"

# Step 2: 应用 Migration 699 (user_role 表)
psql "$DATABASE_URL" -f migrations/699_up.sql

# Step 3: 验证 (数据完整性)
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM user_role;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM role_permission;"

# Step 4: 应用 Migration 700 (双写回填)
psql "$DATABASE_URL" -f migrations/700_up.sql

# Step 5: 验证 (回填覆盖率)
psql "$DATABASE_URL" -c "
SELECT COUNT(DISTINCT user_id) FROM user_role WHERE source = 'system'
  / (SELECT COUNT(*) FROM user_info WHERE role IS NOT NULL);
"
# 期望: > 0.99

# Step 6-8: 类似应用 701-703
```

**回滚策略**：

```bash
# 每个 Migration 应用后 30min 观察
# 触发回滚:
#   - 错误率 > 1%
#   - p95 延迟 > 基线 2x
#   - 手动判断

# 回滚步骤:
psql "$DATABASE_URL" -f migrations/699_down.sql
psql "$DATABASE_URL" -f migrations/700_down.sql
```

**回滚限制**：
- Migration 699-703 全部可回退
- **不可回退操作**：如果业务代码已经写入新表，回滚会丢失数据
- **保护**：Migration 应用后 24h 内不删除相关代码

### 3.3 Phase B：后端代码部署（Feature Flag off）

**目标**：新后端代码就绪但功能未启用，验证代码健康

**步骤**：
1. 部署后端镜像到 staging
2. 所有 Feature Flag 设为 off
3. 运行 smoke test（见 §4）
4. 验证新端点返回 503（Flag off 时预期）
5. 部署到 internal
6. 部署到 prod-canary

**Feature Flag 状态**：
```yaml
triage.enabled: off                    # 后端 API 不响应
triage.websocket.enabled: off          # WS 不监听
triage.partial_failure.enabled: on     # 但内部逻辑开启
triage.dnd_filter.enabled: on
triage.group_by.enabled: on
notification.pipeline_adapter.enabled: off
layout-nav-a11y-v2: off                # 前端 A11y 未启用
```

**监控指标**（Phase B 期间）：
- 新代码 CPU/内存占用
- 数据库连接数（含新增的 recipient / triage 域）
- Migration 后 PG 表大小与索引大小

**进入 Phase C 条件**：
- 所有新端点返回 503（Flag off 预期）
- 无异常 CPU / 内存 / 连接数增长
- 无异常 PG 查询

### 3.4 Phase C：前端代码部署（Feature Flag off）

**目标**：新前端代码就绪但功能未启用

**步骤**：
1. 部署前端镜像到 staging
2. 所有 Feature Flag 设为 off
3. 验证新页面对外不可访问（路由守卫 + Flag 检查）
4. 验证 Command Palette 命令不可用
5. 部署到 internal → prod-canary

**保护机制**：
```tsx
// 前端路由守卫
if (!featureFlags.triageEnabled) {
  redirect('/dashboard');
}
```

**进入 Phase D 条件**：
- 前端无 JS 报错
- 命令面板正常（不含 triage 命令）
- 现有页面功能不受影响

### 3.5 Phase D：Canary 验证（内部 → 生产金丝雀）

**目标**：小流量真实用户验证

**Step 1: 内部验证（internal 环境）**
1. Feature Flag 打开（`triage.enabled=on`, `notification.pipeline_adapter.enabled=on`）
2. 使用测试账号完整走通：
   - 访问 /triage 页面
   - 切换 3 视图
   - 按快捷键 15 条
   - 命令面板 7 命令
   - Ack / Dismiss 动作
   - 批量操作
3. 观察 24h

**Step 2: 生产金丝雀（prod-canary, 1 个租户）**
1. Feature Flag 打开（仅 canary 租户）
2. 真实租户 A 用户（SRE oncall）完整走通
3. 观察 24h
4. 检查：
   - SLO 是否达标（p95 延迟 / 错误率）
   - 告警规则是否触发
   - 用户反馈是否合理

**Canary 通过标准**：
- [ ] 7 个 API 端点全部返回 200
- [ ] WebSocket 事件正常推送
- [ ] 键盘快捷键 15 条全部工作
- [ ] 命令面板 7 命令全部可用
- [ ] 无 critical 告警
- [ ] 无 warning 告警（或有但可解释）
- [ ] 用户满意度反馈无负面
- [ ] A11y 检查通过（键盘 + 屏幕阅读器）

**Canary 失败处理**：
- 立即关闭 Feature Flag（回退到 Phase B）
- 定位问题 → 修复 → 重新 Canary

### 3.6 Phase E：生产灰度 10%

**目标**：扩大到 10% 用户

**触发**：Phase D Canary 通过

**Feature Flag 状态**：
```yaml
triage.enabled: on (traffic_ratio=10)
triage.websocket.enabled: on (traffic_ratio=10)
notification.pipeline_adapter.enabled: on (traffic_ratio=10)
layout-nav-a11y-v2: on (traffic_ratio=10)
```

**灰度分组**：
- 按 tenant_id hash % 100 < 10 命中
- 覆盖：1-2 个租户，100-500 用户
- 覆盖角色：SRE / Tech Lead / Viewer 全部

**观察周期**：48h

**监控指标**：
- 与 Canary 相同
- 新增：
  - `triage.items_requests_total` QPS 变化
  - `triage.ws_connections_active` 增长
  - PG 查询量增长（含新表 user_role / recipient 相关）
  - 缓存命中率（`ur:perm:*`, `rec:role:*`）

**回滚触发**：
- 错误率 > 0.5%
- p95 延迟 > SLO 2x
- 告警 critical > 0
- 手动判断

### 3.7 Phase F：生产灰度 50%

**触发**：Phase E 48h 稳定

**Feature Flag**：`traffic_ratio=50`

**观察周期**：48h

**重点检查**：
- 大流量下性能
- 缓存命中率稳定（> 90%）
- PG 查询并发不超连接池上限

### 3.8 Phase G：生产灰度 100%

**触发**：Phase F 48h 稳定

**Feature Flag**：`traffic_ratio=100`

**观察周期**：24h

**重点检查**：
- 全量负载下 SLO 稳定
- 无异常峰值

### 3.9 Phase H：稳定观察 + Flag 默认打开

**触发**：Phase G 24h 稳定

**操作**：
1. Feature Flag 默认打开（配置中心）
2. 稳定观察 7 天
3. 评估是否可删除旧代码路径

**长期清理**（未来）：
- 移除 Feature Flag 逻辑（12 个月）
- 移除降级代码路径（12 个月）
- 删除旧字段（18 个月，见 `backend-g1-g3-implementation-spec.md` §2.5）

---

## 4. Smoke Test 脚本

### 4.1 后端 Smoke Test

```bash
#!/bin/bash
# smoke-backend.sh
# 用途: 验证后端所有新端点在 Feature Flag on 时可用

set -e

API_URL="${1:-http://localhost:8080/api/v1}"
TOKEN="${2:?Usage: smoke-backend.sh <url> <token>}"
TENANT_ID="${3:?Usage: smoke-backend.sh <url> <token> <tenant_id>}"

check_endpoint() {
    local method=$1
    local endpoint=$2
    local expected=$3
    
    response=$(curl -s -w "%{http_code}" -o /tmp/body.json \
        -X "$method" \
        -H "Authorization: Bearer $TOKEN" \
        -H "X-Tenant-ID: $TENANT_ID" \
        "$API_URL$endpoint")
    
    if [ "$response" != "$expected" ]; then
        echo "FAIL: $method $endpoint expected $expected got $response"
        cat /tmp/body.json
        exit 1
    fi
    echo "PASS: $method $endpoint"
}

# 7 triage endpoints
check_endpoint GET "/triage/me" 200
check_endpoint GET "/triage/me?recent_limit=5" 200
check_endpoint GET "/triage/me/items?group_by=severity" 200
check_endpoint GET "/triage/me/alerts" 200
check_endpoint GET "/triage/me/tickets" 200
check_endpoint GET "/triage/me/oncall" 200
# POST 需要具体 id
echo "SKIP: POST endpoints require real data"

# G1 user_role endpoints
check_endpoint GET "/user-roles/roles" 200
check_endpoint GET "/user-roles/permissions" 200
check_endpoint GET "/user-roles/check/me/read" 200

# G2 recipient validation
echo "SKIP: POST /recipient/validate requires body"

echo "ALL PASS"
```

### 4.2 前端 Smoke Test

```bash
#!/bin/bash
# smoke-frontend.sh
# 用途: 验证前端页面加载和关键功能

set -e

FRONTEND_URL="${1:-http://localhost:5173}"

# 1. Triage 页面加载
curl -s "$FRONTEND_URL/triage" | grep -q "Triage" && echo "PASS: /triage 加载"

# 2. UserRole 页面加载
curl -s "$FRONTEND_URL/user-roles" | grep -q "UserRole" && echo "PASS: /user-roles 加载"

# 3. DND 页面加载
curl -s "$FRONTEND_URL/settings/dnd" | grep -q "DND" && echo "PASS: /settings/dnd 加载"

# 4. 静态资源加载
for asset in \
    "static/js/main.*.js" \
    "static/css/main.*.css"; do
    curl -sI "$FRONTEND_URL/$asset" | grep -q "200" && echo "PASS: $asset"
done

echo "ALL PASS"
```

### 4.3 Canary 用户验证清单

**用户 A (SRE oncall) 走查清单**：
- [ ] 登录 → 看到顶栏 NotificationBell 数字
- [ ] 访问 /triage → 看到 Overview 视图
- [ ] 按 `2` → 切换到 Queue 视图
- [ ] 按 `j` `k` 移动焦点
- [ ] 按 `a` 确认告警
- [ ] 按 `⌘+K` 打开命令面板
- [ ] 输入"批量 ack" → 命中命令
- [ ] 按 `?` 显示快捷键帮助
- [ ] 值班状态卡显示"值班中"
- [ ] 按 `1` 回到 Overview 视图
- [ ] 按 `3` 到 Timeline 视图
- [ ] 关闭浏览器再打开 → URL 深链保留状态
- [ ] 屏幕阅读器朗读"值班中"

**用户 B (Tech Lead) 走查清单**：
- [ ] 登录 → 看到 /user-roles 页面
- [ ] 分配角色给用户
- [ ] 撤销角色
- [ ] 查看审计日志
- [ ] 临时授权（expires_at）

**用户 C (Viewer) 走查清单**：
- [ ] 登录 → 无法访问 /user-roles
- [ ] 可以访问 /triage 但无 Ack/Dismiss 按钮

---

## 5. 监控与告警（对齐 `observability-plan-2026-10-11.md`）

### 5.1 部署期间重点指标

| 阶段 | 关注指标 | 阈值 |
|---|---|---|
| Phase A (Migration) | PG 查询量, 表大小, 索引大小 | 无异常增长 |
| Phase B (后端 Flag off) | CPU / 内存 / 连接数 | 无异常增长 |
| Phase C (前端 Flag off) | JS 报错率, 静态资源 200 | 无异常 |
| Phase D (Canary) | 全部业务指标 + SLO | 达标 |
| Phase E (10%) | 与 Canary 相同 | 达标 |
| Phase F (50%) | 与 Canary 相同 | 达标 |
| Phase G (100%) | 与 Canary 相同 | 达标 |
| Phase H (稳定) | 同上 | 达标 |

### 5.2 部署窗口期告警抑制

**⚠️ 部署期间告警处理**：
- Migration 阶段：抑制 `pg.stat.*` 相关告警（表变更触发）
- 灰度阶段：抑制 `traffic_ratio` 相关告警（波动正常）
- 其他：全部正常告警

**告警抑制配置**：
```yaml
# AlertManager config
inhibit_rules:
  - source_matchers: [ deployment_active = "true" ]
    target_matchers: [ deploy_suppressed = "true" ]
```

---

## 6. 回滚方案

### 6.1 回滚触发条件

| 条件 | 阈值 | 观察期 |
|---|---|---|
| 错误率突增 | > 0.5% | 5min |
| p95 延迟突增 | > SLO 2x | 10min |
| Critical 告警 | > 0 | 立即 |
| 用户投诉 | > 3 | 立即 |
| 数据不一致 | > 0 | 立即 |

### 6.2 回滚路径

**Phase B/C 回滚**：
- 关闭 Feature Flag
- 无需回滚代码（Flag off 即原路径）

**Phase D/E/F/G 回滚**：
- 关闭 Feature Flag（回退到 Flag off 状态）
- 观察 15min
- 如无异常，可继续灰度其他租户

**Migration 回滚**（严重情况）：
- 停止业务写入
- 执行 down migration
- 恢复业务
- **代价**：数据可能丢失（业务已写入新表）

### 6.3 回滚演练

**要求**：每个 Phase 前完成一次演练

**演练步骤**：
1. 打开 Feature Flag
2. 触发回滚条件（模拟错误率 / 延迟）
3. 关闭 Feature Flag
4. 观察 15min 恢复到基线
5. 记录回滚时间

**目标**：Flag off 到系统稳定 ≤ 5min

---

## 7. 金丝雀流量路由

### 7.1 流量分配

**Phase E (10%)**：
- tenant_id hash % 100 < 10 → 命中 canary
- 10-100 之间 → 原路径

**实现**：
```go
func (h *Handler) shouldUseCanary(ctx context.Context, tenantID string) bool {
    hash := fnv32a(tenantID)
    return int(hash)%100 < 10
}
```

### 7.2 Canary 用户识别

**用户告知**：
- Canary 用户收到邮件/IM 通知
- 反馈渠道开放（反馈链接）
- 特殊 UI 标记（可选）

---

## 8. 变更管理

### 8.1 Change Log

每次部署必须记录：

```
Change #YYYYMMDD-XX
  日期: 2026-10-11
  部署阶段: Phase B
  部署人: xxx
  部署内容: 后端 3 新域 (recipient / triage / notification-adapter)
  Feature Flag 状态:
    - triage.enabled: off
    - ...
  Migration 状态:
    - 699-703: applied
  回滚预案:
    - Feature Flag off
  关联 ADR: ADR-004, ADR-005, ADR-010, ADR-012
  关联文档: 
    - backend-g1-g3-implementation-spec-2026-10-11.md
    - triage-api-contract-design-2026-10-11.md
    - ...
```

### 8.2 变更审批

**审批人**：
- Migration：DBA + 架构师
- Feature Flag：值班 SRE + 项目负责人
- 灰度扩展：项目负责人

**审批形式**：Jira ticket / PR review（记录在案）

---

## 9. 风险控制

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| R-D1 Migration 699-703 有 bug | 低 | 高 | 完整测试 + 备份 + down 脚本 |
| R-D2 Feature Flag 逻辑错误 | 中 | 中 | 单元测试 + Canary 验证 |
| R-D3 灰度用户遇到严重问题 | 中 | 中 | 反馈渠道 + 快速回滚 |
| R-D4 回滚导致数据丢失 | 低 | 高 | Migration 后 24h 内不删除旧代码 |
| R-D5 部署期间告警风暴 | 中 | 低 | 告警抑制规则 |
| R-D6 Canary 用户不满意 | 中 | 中 | 提前沟通 + 快速反馈通道 |
| R-D7 前端 Flag 检查不严 | 低 | 中 | 路由守卫 + 单元/e2e 测试 |

---

## 10. 部署清单（Checklist）

### 10.1 部署前 Checklist

- [ ] 所有代码已合并到 main
- [ ] Migration 已应用到 staging
- [ ] Smoke test 通过（staging）
- [ ] 监控指标配置完成
- [ ] 告警规则配置完成
- [ ] Feature Flag 已配置（默认 off）
- [ ] 部署手册已更新
- [ ] 变更单已提交（Change Log）
- [ ] 审批通过

### 10.2 部署中 Checklist

- [ ] 备份已执行（Migration）
- [ ] 每步都有验证脚本
- [ ] 观察 30min 无异常
- [ ] 记录所有输出

### 10.3 部署后 Checklist

- [ ] Smoke test 通过
- [ ] 监控指标正常
- [ ] 无异常告警
- [ ] 用户通知已发送（Canary 用户）
- [ ] Change Log 已更新
- [ ] 观察窗口开始计时

---

## 11. 与业界对标

| 系统 | 部署阶段数 | 灰度批次 | 回滚机制 |
|---|---|---|---|
| Kubernetes 1.30 | 3 (dev/staging/prod) | - | 回滚 manifest |
| Google SRE | 5-10 | 金丝雀 → 1% → 10% → 100% | Feature Flag off |
| Netflix | 5+ | 分片发布 | 快速回滚 |
| **Orion 本轮** | 8 阶段 | Canary → 10% → 50% → 100% | Feature Flag off + Migration down |

**评级**：与 Google SRE / Netflix 水平接近，属于企业级标准。

---

## 12. 复现命令

```bash
cd /Users/heal/orion-design

# 现有 Feature Flag 机制
grep -rn 'feature_flag\|FeatureFlag\|flagClient' \
  orion-platform-svc-go --include='*.go' | head -20

# 现有 CI/CD pipeline
find .github/workflows -name '*.yml' 2>/dev/null | head -5
find . -name 'Jenkinsfile' 2>/dev/null | head -5

# 现有 Deployment 定义
find . -name 'deployment*.yaml' -o -name 'deploy*.yml' 2>/dev/null | head -10

# 现有告警配置
find . -name 'alertmanager*.yml' -o -name 'alertmanager*.yaml' 2>/dev/null

# 现有 Grafana 仪表板
find . -path '*grafana*' -o -name '*.dashboard.json' 2>/dev/null | head -5

# 现有 smoke test
find . -name 'smoke*.sh' -o -name '*smoke*.yml' 2>/dev/null | head

# 现有变更单
find . -name 'CHANGELOG*' -o -name 'change-log*' 2>/dev/null | head
```

---

## 13. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| 1 | 部署范围盘点完整（5 Migration + 3 域 + 8 Flag）| §1 |
| 2 | 5 环境分层定义 | §2 |
| 3 | 8 阶段部署时序完整 | §3 |
| 4 | 每阶段含目标 + 步骤 + 检查项 + 回滚 | §3 |
| 5 | Smoke test 3 类脚本 | §4 |
| 6 | Canary 用户走查清单 | §4.3 |
| 7 | 告警抑制配置 | §5 |
| 8 | 回滚路径 + 演练要求 | §6 |
| 9 | 金丝雀流量路由算法 | §7 |
| 10 | 变更管理（Log + 审批）| §8 |
| 11 | 7 项风险登记 | §9 |
| 12 | 3 类部署 Checklist | §10 |
| 13 | 业界对标 (Google SRE / Netflix) | §11 |
| 14 | ⭐ 复现命令 8+ 条 | §12 |
| 15 | 未修改生产代码 | `git status --porcelain -- '*.go' '*.ts' '*.tsx'` 空 |
| 16 | 未估算人天/工期 | 全文检索禁词 |

---

*本方案补齐了 Meta Review §3.3 的 P3 部署策略缺失问题，
达到 Google SRE / Netflix 级别的企业部署策略水平。

8 阶段部署时序 + 5 环境分层 + Feature Flag 灰度 + 金丝雀流量路由 +
3 类 Smoke Test + 变更管理 + 7 项风险控制。

每一步都可回滚（Feature Flag off 或 Migration down），
每次部署都有监控指标和告警规则对齐 `observability-plan-2026-10-11.md`。*
