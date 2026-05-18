# Orion Phase 3: 内存存储持久化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** 所有服务从内存 Map 迁移到 PostgreSQL（68 人天，6 周）

**Spec:** `docs/superpowers/specs/2026-05-16-missing-features-design.md`

---

## 任务总览

| Task | 内容 | 人天 | 依赖 |
|------|------|------|------|
| Task 1 | Pipeline 执行状态持久化 | 8 | Phase 1 |
| Task 2 | Deploy 持久化 | 5 | Phase 1 |
| Task 3 | Approval 持久化 + 并发修复 | 5 | Phase 1 |
| Task 4 | Federation 持久化 | 10 | Phase 1 |
| Task 5 | Agent TaskExecutor 实现 | 10 | Phase 1 |
| Task 6 | Self-Healing 决策引擎 | 10 | Phase 1 |
| Task 7 | Risk Assessment 实现 | 8 | Phase 1 |
| Task 8 | Digital Twin 持久化 | 10 | Phase 1 |
| Task 9 | Notify DDL 创建 | 2 | 无 |

---

## 实施策略

每个任务的通用模式：
1. 检查现有 Repository 是否存在
2. 创建/修改 PostgreSQL 迁移 SQL
3. 将内存 Map 替换为 SQL 查询
4. 添加并发控制（乐观锁/悲观锁）
5. 编写测试验证

---

_计划版本: v1.0 | 创建日期: 2026-05-16_