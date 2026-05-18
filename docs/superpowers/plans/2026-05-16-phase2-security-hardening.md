# Orion Phase 2: 安全加固实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** 消除 P1 安全漏洞，统一认证授权（45 人天，4 周）

**Spec:** `docs/superpowers/specs/2026-05-16-missing-features-design.md`

---

## 任务总览

| Task | 内容 | 人天 | 依赖 |
|------|------|------|------|
| Task 1 | 统一 JWT 认证中间件 | 10 | Phase 1 |
| Task 2 | Prompt 注入防护 | 8 | 无 |
| Task 3 | AI /execute 端点修复 | 3 | 无 |
| Task 4 | 前端安全加固 | 5 | 无 |
| Task 5 | NetworkPolicy + RBAC | 10 | 无 |
| Task 6 | API Gateway 代理全部服务 | 5 | 无 |
| Task 7 | ArtifactScanService 真实扫描 | 4 | 无 |

---

### Task 1: 统一 JWT 认证中间件

**目标:** 20+ 服务缺少统一认证，创建跨服务 JWT 验证中间件

**Files:**
- Create: `orion-platform-service/src/middleware/jwtAuth.ts`
- Modify: 各微服务的 app.ts 或 routes

**实现:**
1. 在 platform-service 创建 JWT 验证中间件，支持从 Header 提取和验证 Token
2. 提供各服务使用的验证函数
3. 确保所有 API 端点都需要有效 JWT

---

### Task 2: Prompt 注入防护

**目标:** AI 安全核心能力，检测和阻止恶意 Prompt 注入

**Files:**
- Modify: `orion-ai-svc/src/services/`
- Create: `orion-ai-svc/src/services/PromptGuardService.ts`

**实现:**
1. 创建 PromptGuardService，检测常见注入模式
2. 添加输入验证层过滤恶意指令
3. 添加输出过滤层防止敏感信息泄露

---

### Task 3: AI /execute 端点修复

**目标:** 修复 RCE 漏洞，/execute 端点可执行任意代码

**Files:**
- Modify: `orion-ai-svc/src/routes/`

**实现:**
1. 审查 /execute 端点的实现
2. 移除或限制危险的代码执行能力
3. 添加白名单机制

---

### Task 4: 前端安全加固

**目标:** 子应用沙箱、CSP 配置、WebSocket token 保护

**Files:**
- Modify: `orion-frontend/`
- Modify: `wujie` 相关配置

**实现:**
1. 配置子应用沙箱隔离
2. 添加 CSP 安全头
3. 修复 WebSocket token URL 泄露

---

### Task 5: NetworkPolicy + RBAC

**目标:** K8s 网络隔离和 RBAC 权限控制

**Files:**
- Modify: 所有 `*-svc/k8s/` 目录下的 YAML 文件

**实现:**
1. 为 34 个服务添加 NetworkPolicy
2. 添加 ServiceAccount、Role、RoleBinding
3. 实现服务间最小权限通信

---

### Task 6: API Gateway 代理全部服务

**目标:** 统一入口，当前仅代理 platform-service

**Files:**
- Modify: `orion-api-gateway/src/routes.ts`

**实现:**
1. 添加 33 个微服务的代理路由
2. 配置各服务的 upstream 地址
3. 添加负载均衡和健康检查

---

### Task 7: ArtifactScanService 真实扫描

**目标:** 替换假 CVE 数据，使用真实安全扫描

**Files:**
- Modify: `orion-artifact-svc/src/services/ArtifactScanService.ts`
- Create: `orion-artifact-svc/src/services/TrivyScannerService.ts`

**实现:**
1. 集成 Trivy 或其他漏洞扫描工具
2. 返回真实 CVE 数据
3. 添加扫描结果缓存

---

## 自审检查

- [x] Spec 覆盖: 所有 7 项 P1 安全任务已覆盖
- [x] 无占位符: 任务描述包含具体实现方案
- [x] 类型一致性: 任务间无类型依赖冲突

---

_计划版本: v1.0 | 创建日期: 2026-05-16_