# API 路径一致性 (v1 前缀) 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为所有后端 API 路由添加 `/v1/` 版本前缀，消除前后端路径不一致导致的运行时 404 错误。

**Architecture:** 修改 `routes.ts` 中所有路由注册的 prefix 参数，从 `/xxx` 改为 `/v1/xxx`。前端 API 客户端已使用 `/v1/` 前缀，无需修改。

**Tech Stack:** TypeScript, Fastify, Node.js

---

## 文件映射

### 修改的文件

| 文件 | 修改内容 |
|------|---------|
| `orion-platform-service/src/api/routes.ts` | 所有 inline 路由前缀 + 子路由注册前缀添加 `/v1` |
| `orion-platform-service/src/routes-cmdb.ts` | prefix: '/cmdb' → '/v1/cmdb' |
| `orion-platform-service/src/routes-plugin.ts` | prefix: '/plugins' → '/v1/plugins' |
| `orion-platform-service/src/routes-agent.ts` | prefix: '/' → '/v1/' |

### 不需要修改的文件

- 前端 API 客户端 (`orion-frontend/src/api/*.ts`) — 已使用 `/v1/` 前缀
- 健康检查端点 (`app.ts:/healthz`) — 不需要版本化
- 子路由文件内部定义的路径 — 前缀在注册时添加

---

## 任务分解

### Task 1: 修改 routes.ts 中的 inline 路由前缀

**Files:**
- Modify: `orion-platform-service/src/api/routes.ts:141-242`

- [ ] **Step 1: 修改 Pipeline 路由前缀**

将 `routes.ts:144-176` 中的所有 Pipeline 路由路径添加 `/v1` 前缀：

```typescript
// 修改前 (line 144)
app.post('/pipelines', async (...) => { ... });

// 修改后
app.post('/v1/pipelines', async (...) => { ... });
```

具体修改：
- Line 144: `'/pipelines'` → `'/v1/pipelines'`
- Line 149: `'/pipelines'` → `'/v1/pipelines'`
- Line 154: `'/pipelines/:id'` → `'/v1/pipelines/:id'`
- Line 159: `'/pipelines/:id/versions'` → `'/v1/pipelines/:id/versions'`
- Line 164: `'/pipelines/:id'` → `'/v1/pipelines/:id'`
- Line 169: `'/pipelines/:id'` → `'/v1/pipelines/:id'`
- Line 174: `'/pipelines/validate'` → `'/v1/pipelines/validate'`

- [ ] **Step 2: 修改 PipelineRun 路由前缀**

将 `routes.ts:181-208` 中的所有 PipelineRun 路由路径添加 `/v1` 前缀：

- Line 181: `'/pipelines/:id/runs'` → `'/v1/pipelines/:id/runs'`
- Line 186: `'/pipeline-runs'` → `'/v1/pipeline-runs'`
- Line 191: `'/pipeline-runs/:id'` → `'/v1/pipeline-runs/:id'`
- Line 196: `'/pipeline-runs/:id/cancel'` → `'/v1/pipeline-runs/:id/cancel'`
- Line 201: `'/pipeline-runs/:id/stages'` → `'/v1/pipeline-runs/:id/stages'`
- Line 206: `'/pipeline-runs/:id/tasks'` → `'/v1/pipeline-runs/:id/tasks'`

- [ ] **Step 3: 修改 Stage 路由前缀**

将 `routes.ts:213-225` 中的所有 Stage 路由路径添加 `/v1` 前缀：

- Line 213: `'/stages/:id'` → `'/v1/stages/:id'`
- Line 218: `'/stages/:id/tasks'` → `'/v1/stages/:id/tasks'`
- Line 223: `'/stages/:id/retry'` → `'/v1/stages/:id/retry'`

- [ ] **Step 4: 修改 Task 路由前缀**

将 `routes.ts:230-242` 中的所有 Task 路由路径添加 `/v1` 前缀：

- Line 230: `'/tasks/:id'` → `'/v1/tasks/:id'`
- Line 235: `'/tasks/:id/log'` → `'/v1/tasks/:id/log'`
- Line 240: `'/tasks/:id/retry'` → `'/v1/tasks/:id/retry'`

- [ ] **Step 5: 运行后端测试验证路由修改**

Run: 
```bash
cd orion-platform-service && npm run test 2>&1 | head -50
```

Expected: 测试通过或已知失败（与路由无关）

- [ ] **Step 6: 提交**

```bash
git add orion-platform-service/src/api/routes.ts
git commit -m "feat(api): add /v1 prefix to inline pipeline/pipeline-run/stage/task routes"
```

---

### Task 2: 修改 routes.ts 中的子路由注册前缀

**Files:**
- Modify: `orion-platform-service/src/api/routes.ts:244-406`

- [ ] **Step 1: 批量修改所有子路由注册前缀**

将 `routes.ts:247-405` 中所有路由注册的 prefix 添加 `/v1` 前缀。

修改模式：`prefix: '/xxx'` → `prefix: '/v1/xxx'`

具体修改列表（按行号）：

| 行号 | 修改前 | 修改后 |
|------|--------|--------|
| 247 | `prefix: '/cmdb'` | `prefix: '/v1/cmdb'` |
| 252 | `'/build'` | `'/v1/build'` |
| 255 | `'/code-repo'` | `'/v1/code-repo'` |
| 258 | `prefix: '/config'` | `prefix: '/v1/config'` |
| 261 | `prefix: '/cost'` | `prefix: '/v1/cost'` |
| 264 | `prefix: '/risk'` | `prefix: '/v1/risk'` |
| 267 | `prefix: '/finops'` | `prefix: '/v1/finops'` |
| 270 | `'/ai-review'` | `'/v1/ai-review'` |
| 273 | `'/diagnostic'` | `'/v1/diagnostic'` |
| 276 | `prefix: '/test-selector'` | `prefix: '/v1/test-selector'` |
| 279 | `prefix: '/deploy'` | `prefix: '/v1/deploy'` |
| 282 | `'/monitoring'` | `'/v1/monitoring'` |
| 285 | `prefix: '/tickets'` | `prefix: '/v1/tickets'` |
| 288 | `'/self-healing'` | `'/v1/self-healing'` |
| 291 | `prefix: '/backup'` | `prefix: '/v1/backup'` |
| 294 | `prefix: '/plugins-spi'` | `prefix: '/v1/plugins-spi'` |
| 297 | `'/plugins'` | `'/v1/plugins'` |
| 300 | `'/ai-security'` | `'/v1/ai-security'` |
| 303 | `prefix: '/ai-gateway'` | `prefix: '/v1/ai-gateway'` |
| 306 | `prefix: '/alert'` | `prefix: '/v1/alert'` |
| 309 | `'/audit'` | `'/v1/audit'` |
| 312 | `'/tenant'` | `'/v1/tenant'` |
| 315 | `prefix: '/efficiency'` | `prefix: '/v1/efficiency'` |
| 318 | `prefix: '/sbom'` | `prefix: '/v1/sbom'` |
| 321 | `prefix: '/policies'` | `prefix: '/v1/policies'` |
| 324 | `prefix: '/change-intelligence'` | `prefix: '/v1/change-intelligence'` |
| 327 | `prefix: '/canary-analysis'` | `prefix: '/v1/canary-analysis'` |
| 330 | `prefix: '/skills'` | `prefix: '/v1/skills'` |
| 333 | `'/ai-cost'` | `'/v1/ai-cost'` |
| 336 | `'/iac'` | `'/v1/iac'` |
| 339 | `'/chatops'` | `'/v1/chatops'` |
| 346 | `'/confirmations'` | `'/v1/confirmations'` |
| 349 | `prefix: '/artifacts'` | `prefix: '/v1/artifacts'` |
| 352 | `'/vector-store'` | `'/v1/vector-store'` |
| 355 | `prefix: '/oncall'` | `prefix: '/v1/oncall'` |
| 359 | `prefix: '/approvals'` | `prefix: '/v1/approvals'` |
| 363 | `prefix: '/cron'` | `prefix: '/v1/cron'` |
| 366 | `'/eventbus'` | `'/v1/eventbus'` |
| 369 | `prefix: '/product-lines'` | `prefix: '/v1/product-lines'` |
| 372 | `prefix: '/internal-libraries'` | `prefix: '/v1/internal-libraries'` |
| 375 | `prefix: '/notifications'` | `prefix: '/v1/notifications'` |
| 378 | `'/roles'` | `'/v1/roles'` |
| 381 | `prefix: '/sessions'` | `prefix: '/v1/sessions'` |
| 384 | `prefix: '/webhooks'` | `prefix: '/v1/webhooks'` |
| 387 | `prefix: '/projects'` | `prefix: '/v1/projects'` |
| 390 | `prefix: '/environments'` | `prefix: '/v1/environments'` |
| 393 | `prefix: '/queue'` | `prefix: '/v1/queue'` |
| 396 | `prefix: '/knowledge'` | `prefix: '/v1/knowledge'` |
| 399 | `prefix: '/metrics'` | `prefix: '/v1/metrics'` |
| 402 | `'/users'` | `'/v1/users'` |
| 405 | `prefix: '/'` | `prefix: '/v1/'` |

- [ ] **Step 2: 验证修改**

检查修改后的文件确保格式正确：

```bash
cd orion-platform-service && npx tsc --noEmit 2>&1 | head -20
```

Expected: 无 TypeScript 编译错误

- [ ] **Step 3: 提交**

```bash
git add orion-platform-service/src/api/routes.ts
git commit -m "feat(api): add /v1 prefix to all sub-route registrations"
```

---

### Task 3: 修改外部路由文件前缀

**Files:**
- Modify: `orion-platform-service/src/routes-cmdb.ts`
- Modify: `orion-platform-service/src/routes-plugin.ts`
- Modify: `orion-platform-service/src/routes-agent.ts`

- [ ] **Step 1: 检查 routes-cmdb.ts 是否有内部 prefix 定义**

```bash
grep -n "prefix" orion-platform-service/src/routes-cmdb.ts
```

如果有 `prefix: '/cmdb'` 或类似定义，修改为 `prefix: '/v1/cmdb'`。

- [ ] **Step 2: 检查 routes-plugin.ts 是否有内部 prefix 定义**

```bash
grep -n "prefix" orion-platform-service/src/routes-plugin.ts
```

如果有 `prefix: '/plugins'` 或类似定义，修改为 `prefix: '/v1/plugins'`。

- [ ] **Step 3: 检查 routes-agent.ts 是否有内部 prefix 定义**

```bash
grep -n "prefix" orion-platform-service/src/routes-agent.ts
```

如果有 `prefix: '/'` 或类似定义，修改为 `prefix: '/v1/'`。

- [ ] **Step 4: 提交**

```bash
git add orion-platform-service/src/routes-cmdb.ts orion-platform-service/src/routes-plugin.ts orion-platform-service/src/routes-agent.ts 2>/dev/null
git commit -m "feat(api): update external route files prefix to /v1"
```

---

### Task 4: 验证前后端路径一致性

**Files:**
- Create: `scripts/verify-api-paths.sh`
- Test: 前端 `orion-frontend/src/api/*.ts` vs 后端 `orion-platform-service/src/api/routes.ts`

- [ ] **Step 1: 创建路径验证脚本**

```bash
mkdir -p scripts
cat > scripts/verify-api-paths.sh << 'EOF'
#!/bin/bash
# 验证前端 API 路径与后端路由一致性

echo "=== API 路径一致性验证 ==="
echo ""

# 提取前端使用的路径（去掉 /v1/ 前缀，因为后端现在也有 /v1/）
echo "--- 前端 API 路径 ---"
FRONTEND_PATHS=$(grep -roh "api\.[a-z]*(['\`]/[^'\`]*" orion-frontend/src/api/*.ts 2>/dev/null | \
  sed "s/api\.[a-z]*(['\"]//" | sed "s/['\"]//" | \
  grep -E "^/v1/" | \
  sed "s|^/v1/||" | \
  sed 's|/[^/]*$||' | \
  sort -u)

echo "$FRONTEND_PATHS" | head -30

echo ""
echo "--- 后端路由前缀 ---"
BACKEND_PREFIXES=$(grep -E "prefix:" orion-platform-service/src/api/routes.ts | \
  sed -E "s/.*prefix: '([^']+)'.*/\1/" | \
  sed "s|^/v1/||" | \
  sort -u)

echo "$BACKEND_PREFIXES" | head -30

echo ""
echo "--- 不一致项 ---"
comm -23 <(echo "$FRONTEND_PATHS") <(echo "$BACKEND_PREFIXES") | head -20

echo ""
echo "=== 验证完成 ==="
EOF
chmod +x scripts/verify-api-paths.sh
```

- [ ] **Step 2: 运行验证脚本**

```bash
cd /Users/heal/orion-design && bash scripts/verify-api-paths.sh
```

Expected: 输出前端路径、后端路径和任何不一致项

- [ ] **Step 3: 提交验证脚本**

```bash
git add scripts/verify-api-paths.sh
git commit -m "chore: add API path consistency verification script"
```

---

### Task 5: 运行测试套件并验证

**Files:**
- Test: `orion-platform-service/src/__tests__/`
- Test: `orion-frontend/src/**/*.test.ts`

- [ ] **Step 1: 运行后端测试**

```bash
cd orion-platform-service && npm run test 2>&1 | tail -30
```

Expected: 所有测试通过（或已知失败与本次修改无关）

- [ ] **Step 2: 运行前端测试**

```bash
cd orion-frontend && npm run test 2>&1 | tail -30
```

Expected: 所有测试通过

- [ ] **Step 3: 运行类型检查**

```bash
cd orion-platform-service && npm run type-check 2>&1 | tail -20
cd orion-frontend && npm run type-check 2>&1 | tail -20
```

Expected: 无 TypeScript 编译错误

- [ ] **Step 4: 提交（如果有测试修复）**

```bash
git add -A
git commit -m "test: update tests for /v1 API path prefix"
```

---

### Task 6: 更新文档

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/architecture/当前系统架构.md`

- [ ] **Step 1: 更新 CLAUDE.md 中的 API 路径说明**

在 CLAUDE.md 中添加 API 版本化说明：

```markdown
### API 路径规范

所有 API 路由使用 `/api/v1/` 前缀：
- 后端路由注册: `prefix: '/v1/xxx'`
- 前端 API 调用: `api.get('/v1/xxx')`
- 完整路径: `http://localhost:3001/api/v1/xxx`
```

- [ ] **Step 2: 提交文档更新**

```bash
git add CLAUDE.md docs/architecture/当前系统架构.md
git commit -m "docs: update API path documentation with /v1 prefix convention"
```

---

### Task 7: 最终验证和清理

**Files:**
- Test: 手动验证关键端点

- [ ] **Step 1: 启动后端服务验证健康检查**

```bash
cd orion-platform-service && npm run dev &
sleep 5
curl -s http://localhost:3001/healthz | head -5
```

Expected: 健康检查返回 200

- [ ] **Step 2: 验证关键 API 端点**

```bash
# 验证带 /v1/ 前缀的端点
curl -s http://localhost:3001/api/v1/alert/list 2>&1 | head -3
curl -s http://localhost:3001/api/v1/pipelines 2>&1 | head -3
```

Expected: 返回数据或认证错误（不是 404）

- [ ] **Step 3: 停止后端服务**

```bash
pkill -f "tsx.*index.js" || true
```

- [ ] **Step 4: 最终提交（如果有调整）**

```bash
git status
git add -A
git commit -m "chore: final API path consistency cleanup"
```

---

## 自审

### 1. 规范覆盖检查

| 规范要求 | 对应任务 | 状态 |
|---------|---------|------|
| 所有后端路由以 `/v1/` 开头 | Task 1, 2, 3 | ✅ |
| 前端 API 调用路径与后端路由匹配 | Task 4 | ✅ |
| 运行时无 404 错误 | Task 5, 7 | ✅ |
| 测试套件通过率 100% | Task 5 | ✅ |

### 2. 占位符扫描

无 "TBD"、"TODO" 或不完整步骤。

### 3. 类型一致性

本计划不涉及类型定义修改，仅修改路由前缀字符串。

---

Plan complete and saved to `docs/superpowers/plans/2026-04-29-api-path-consistency.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
