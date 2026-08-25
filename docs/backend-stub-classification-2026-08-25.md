# 后端 Stub 服务实现深度分类报告

> 扫描日期：2026-08-25
> 范围：orion-platform-svc-go/internal/ 下 303 个 Go 服务
> 目标：对 131 个"Stub 候选"（250-800 行主代码）逐类判定

---

## 一、核心结论

| 分类 | 数量 | 占比 | 说明 |
|------|------|------|------|
| **标准 CRUD 脚手架（可用）** | 113 | 86% | handler/repository/models 三层，有真实 sqlx DB 查询，tenant_id 过滤 |
| **含 service 业务逻辑层** | 115 | 88% | 在 CRUD 之上有 service 层，含校验/计算/状态管理 |
| **真 panic/return nil 桩** | 3 | 2% | repository 方法返回 nil 占位，未实现真实逻辑 |
| **工具库 / 非 HTTP 服务** | 3 | 2% | 纯工具函数（lock, dr, tenantutil），不需要 repository |
| **未分类（有 DB 引用但未命中关键词）** | 12 | 9% | 有 repo 且引用 db，但未命中 Find/Create/Update/Delete 关键词 |

**结论：131 个 Stub 候选中，86% 已是真实可用的 CRUD 脚手架，仅 3 个是真桩。**

---

## 二、3 个真 panic 桩（需修复）

> 这些是 131 个 Stub 候选中**唯一需要优先补实现**的。

| 服务 | 行数 | 问题 | 证据文件 |
|------|------|------|---------|
| **cache-monitor** | 258 | repository 全部 5 个方法返回 `return nil, nil` | `repository/repository.go:69,78,88,140,157` |
| **performance** | 262 | 一个方法返回 `return nil, nil` | `repository/repository.go:96` |
| **service-registry** | 257 | 一个分支返回 `return nil, nil` | `repository/repository.go:82` |

> 注意：`service-registry` 有 257 行主代码，但之前已确认其 handler 有 5 个真实端点 + 权限 + OpenTelemetry 追踪。`return nil, nil` 仅存在于一个边缘条件分支，主体可用。

---

## 三、全量 45 个 panic 桩在全量服务中的分布

> 131 个 Stub 候选之外，还有 42 个 panic 桩分布在**重型服务内部**（如 ai/ci-cd/notification 等大型聚合容器中的子模块）。这些不是"空壳"而是子模块，其中大部分有超过 2000 行主代码，桩存在于子模块的特定方法中。

| 重型服务 | 桩子模块 | 全量行数 | 说明 |
|---------|---------|---------|------|
| ai | security, semantic-search, code-embedding, rule-engine, task-executor | 23346 | 重型 AI 服务，部分子模块 stub |
| ci-cd | build | 21797 | 重型 CI/CD，build 子模块 stub |
| notification | notification | 15103 | 重型通知，子模块 stub |
| governance | audit, compliance, governance, risk | 9590 | 治理，部分子模块 stub |
| identity | auth, tenant, role | 80聚合 | 身份，子模块 stub |
| finops | cost | 14503 | 成本，子模块 stub |
| infrastructure | dba | 14995 | 基础设施，dba 子模块 stub |

**结论**：这些不是需要立即修复的独立空壳，而是重型服务中的**待补子模块**，优先级低于前端直接依赖的独立服务。

---

## 四、分类方法

1. **行数分级**：从全深度扫描中取 250-800 行区间
2. **DB 查询检测**：grep `sqlx.` / `.Find(` / `.Create(` / `.Update(` / `.Delete(` 在 repository/*.go 中
3. **panic 桩检测**：grep `panic("not implemented"` / `panic("todo"` / `return nil, nil` 在 repository/*.go 中
4. **service 层检测**：检查是否存在 `service/` 子目录
5. **handler 无 repo 检测**：有 handler 目录但无 repository 目录的服务
6. **人工抽样复核**：database-devops（已确认）、service-registry（已确认）、ci-cd（聚合容器）

---

## 五、修复建议

| 优先级 | 服务 | 建议操作 | 预估人天 |
|--------|------|---------|---------|
| P1 | cache-monitor | 5 个方法全部 return nil，需补 DB 查询 | 1 人天 |
| P2 | performance | 1 个方法 return nil，补实现 | 0.5 人天 |
| P2 | service-registry | 1 个边缘分支 return nil，补实现 | 0.5 人天 |
| P3 | 重型服务内子模块 stub | 按前端依赖顺序逐步实现 | 按需 |

---

## 附：修正记录

- 2026-08-25 初扫将 `ci-cd/governance/identity/workflow` 误判为"0 行空目录"，实为聚合容器，已剔除
- 2026-08-25 后端 Stub 分类发现 86% 的 Stub 候选实为"标准 CRUD 脚手架可用"，仅 3 个真桩
- `dr/lock/tenantutil` 3 个服务为工具库，无 HTTP 端点，不属于"后端服务"分类，不应标记为 stub