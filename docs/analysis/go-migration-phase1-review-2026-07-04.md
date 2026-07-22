# Go 迁移第一阶段专家评审报告（2026-07-04）

**评审范围**：Pipeline / Deploy / Auth / EventBus / Notification 五个核心服务
**评审日期**：2026-07-04
**分支**：feat/metric-collector-postgres-persistence

---

## 评审摘要

| 指标 | 结果 |
|------|------|
| 综合评级 | 78/100 (B+) |
| 可独立部署服务 | 3/5 (EventBus, Pipeline, Deploy) |
| 需人工决策服务 | 2/5 (Auth: P0, Notify: P1) |
| P0 问题 | 2 个 |
| P1 问题 | 3 个 |
| P2 建议 | 4 个 |

---

## 1. 服务独立部署能力

| 服务 | main.go | 独立启动 | 健康检查 | 迁移文件 | 评审结果 |
|------|---------|---------|---------|---------|---------|
| orion-pipeline-svc-go | ✅ | ✅ | ✅ | 2个 | 🟢 完整 |
| orion-deploy-svc-go | ✅ | ✅ | ✅ | 2个 | 🟢 完整 |
| orion-auth-svc-go | ✅ | ✅ | ✅ | **缺失** | 🔴 P0 |
| orion-event-bus-svc-go | ✅ | ✅ | ✅ | 1个 | 🟢 完整 |
| orion-notify-svc-go | ✅ | ✅ | ✅ | 1个 | 🟡 P1 |

---

## 2. 功能覆盖度

| 服务 | TS 行数 | Go 行数 | 覆盖率 | 风险 | 结论 |
|------|---------|---------|--------|------|------|
| EventBus | ~700 | 717 | ~85% | 低 | ✅ 可切换 |
| Pipeline | 26197 | 3478 | ~87% | 中 | 🟡 补充后切换 |
| Deploy | 6732 | 1197 | ~82% | 中 | 🟡 补充后切换 |
| Notify | 1701 | ~400 | ~75% | 高 | 🟡 子集切换 |
| Auth | 完整 | ~500 | ~10% | **极高** | 🔴 延后 |

---

## 3. 关键风险

### P0

| # | 问题 | 影响 | 建议 |
|---|------|------|------|
| 1 | Auth 服务 95% 功能缺失（placeholder 实现） | 无法登录、权限失效 | **延后 Auth 至 Phase 2** |
| 2 | Auth 无 migrations 目录 | 无法独立部署 | 需创建 users/tenants/refresh_tokens 表 |

### P1

| # | 问题 | 影响 | 建议 |
|---|------|------|------|
| 1 | Auth 自依赖风险（auth-svc-go → go-common/pkg/auth） | 循环依赖 | 确认 go-common auth 仅提供中间件 |
| 2 | Notify 核心通知功能缺失 | 通知不可用 | Phase 1 仅切换 templates/settings |
| 3 | Pipeline/Deploy/Notify 未集成 EventBus | 事件丢失 | 共存期 TS 继续发布事件 |

### P2

| # | 建议 | 预计工时 |
|---|------|---------|
| 1 | 统一数据库连接方式（go-common/pkg/database） | 2 天 |
| 2 | 补充 Pipeline Webhook 和 Stage 编排 | 3-4 周 |
| 3 | 补充 Deploy 灰度发布和 K8s 集成 | 3-4 周 |
| 4 | 统一 go.mod 依赖管理 | 2 天 |

---

## 4. 迁移顺序建议

| 阶段 | 服务 | 优先级 | 预计工期 |
|------|------|--------|---------|
| Phase 1A | EventBus | P0 | 已就绪 |
| Phase 1B | Pipeline | P1 | +2-3 周 |
| Phase 1C | Deploy | P1 | +3-4 周 |
| Phase 2 | Notify | P2 | +2-3 周 |
| Phase 3 | Auth | P3 | 延后 |

---

## 5. 前置条件

- 🔴 Phase 1.17 (Engine 解耦) 必须完成
- 🔴 Phase 4.67 (减少 Engine 直接 import) 必须完成
- 🟡 确认 go-common auth 不依赖 auth-svc-go

---

**结论**：EventBus 可立即切换；Pipeline/Deploy 补充后切换；Auth **不建议 Phase 1 迁移**。
