# Task 1.9 前置分析：前端 API 客户端 baseURL 一致性

> **任务级别**: 🔵 自动（依赖 Task 1.8 人工决策）
> **分析日期**: 2026-07-04
> **分析范围**: 245 个前端 API 客户端文件

---

## 核心发现

**241 个文件使用标准共享 `api` 对象**，路径存在 3 种模式：

| 模式 | 数量 | 说明 |
|------|------|------|
| 使用相对路径（`v1/xxx`） | 78 | axios 自动附加 baseURL，正常 |
| 使用绝对路径无 `/api`（`/v1/xxx`） | 146 | axios 合并 baseURL，正常 |
| 硬编码完整路径（`/api/v1/xxx`） | 18 | 冗余但能工作 |
| 领域直接路径（`/xxx`） | 24 | 需补全 `/api/v1/` |

## 路径示例

### 冗余模式（18 个文件）
- `ai-models.ts`: `/api/v1/ai/models`
- `canary-traffic.ts`: `/api/v1/canary/deployments`
- `pipelines.ts`: `/api/v1/pipelines`

### 需要补全的领域路径（24 个文件）
- `abac-policy.ts`: `/abac-policies` → `/api/v1/abac-policies`
- `alert-breakers.ts`: `/alert-breakers/rules/${id}`
- `cost-allocation.ts`: `/billing/usage`
- `ueba.ts`: `/ueba/user/${userId}`
- `visor.ts`: `/visor/hosts`

## 修复方案

### 方案 A：最小改动（推荐）
保持 `client.ts` baseURL 为 `/api`，统一前端路径：
- `/v1/xxx` → `/api/v1/xxx`
- `/xxx` → `/api/v1/xxx`
- `v1/xxx` → `/api/v1/xxx`
- `/api/v1/xxx` 保持不变

**工作量**：224 个文件，400-600 处路径修改

### 方案 B：baseURL 升级
将 baseURL 从 `/api` 改为 `/api/v1`，移除前端路径中的 `/v1`

**工作量**：类似，但逻辑更复杂

### 方案 C：保持现状
利用 axios baseURL 自动附加，不做修改

**缺点**：路径格式不统一

## 后端配合需求

如果选择方案 A/B，需修改 `routes.ts` 中的：
- `/code-repo` → `/api/v1/code-repo`
- `/inception` → `/api/v1/inception`

## 结论

- **风险等级**：低（纯路径格式调整）
- **建议优先级**：P1（改善可维护性）
- **阻塞依赖**：需先完成 Task 1.8 人工决策
