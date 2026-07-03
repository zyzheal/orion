# 交互逻辑、错误捕获与全局问题处理分析

**生成日期**: 2026-07-02
**分析范围**: orion-platform-service/src/ + orion-frontend/src/

---

## 一、后端错误处理机制

### 1.1 统一错误类型系统

**文件**: `orion-platform-service/src/errors/index.ts`

| 组件 | 状态 | 说明 |
|------|------|------|
| ErrorCode 枚举 | ✅ | 18 种错误码分类 |
| HTTP 状态码映射 | ✅ | 1:1 映射 |
| OrionError 基类 | ✅ | message + code + recoverable + details |
| 具体错误子类 | ✅ | 9 个 (ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, BusinessError, ServiceUnavailableError, FallbackModeError, ExternalServiceError, DatabaseError) |
| handleError 函数 | ✅ | 区分 OrionError / Error / unknown |
| 错误消息推断 (inferErrorCode) | ⚠️ | 基于字符串匹配，复杂场景可能误判 |

### 1.2 全局错误处理器

**文件**: `orion-platform-service/src/app.ts` (L396-429)

```typescript
app.setErrorHandler((error: Error, request, reply) => {
  app.log.error({ error: error.name, message: error.message, ... }, 'Unhandled error');
  if (!reply.sent) {
    handleError(reply, error);
  }
});
```

**问题**：
- 结构化日志缺少 traceId（仅记录 requestId）
- 日志格式不统一

### 1.3 throw new Error() 残留

| 位置 | 数量 | 说明 |
|------|------|------|
| 核心引擎层 | 209 处 | PipelineEngine/TaskRunner/StageOrchestrator |
| 影响 | 🔴 高 | 错误码无法精确分类，走 inferErrorCode 推断路径 |

---

## 二、前端错误处理

### 2.1 API 客户端拦截器

**文件**: `orion-frontend/src/api/client.ts`

| 状态码 | 处理 | 问题 |
|--------|------|------|
| 401 | ✅ 带 refresh token 自动刷新 + 防并发 | - |
| 403 | ✅ 友好提示 + 区分 abac/rbac/relationship | - |
| 404 | ❌ 仅 console.error | 无用户提示 |
| 500+ | ❌ 仅 console.error | 无用户提示 |
| 通用 | ⚠️ Promise.reject | 依赖外层 catch |

### 2.2 ErrorBoundary 组件

**文件**: `orion-frontend/src/components/ErrorBoundary/index.tsx`

| 问题 | 严重度 |
|------|--------|
| console.error 无结构化日志 | 🟡 中 |
| 未使用 Error Logging API | 🟡 中 |
| fallback 内容不够友好 | 🟢 低 |

### 2.3 空状态处理

| 指标 | 值 |
|------|-----|
| 使用 Empty 组件的页面 | 30/202 (15%) |
| 有空状态 + 引导按钮的页面 | < 10/202 (5%) |

---

## 三、API 路径一致性

### 3.1 后端路由前缀模式

| 前缀格式 | 端点数 | 示例 |
|---------|--------|------|
| `/api/v1/<domain>/` | ~60 | `/api/v1/pipelines`, `/api/v1/deployments` |
| `/api/v1/<domain>` (无尾斜杠) | ~20 | `/api/v1/config/domains` |
| `/api/v1/` (裸路径) | ~30 | `/api/v1/auth/login`, `/api/v1/health` |
| `/api/` (无 v1) | ~5 | `/api/health` |
| 不一致 | ~60 | 混合使用 |

### 3.2 前端-后端路径匹配度

| 指标 | 值 |
|------|-----|
| 前端 API 客户端文件数 | 253 |
| 后端路由文件数 | 175 |
| 精确匹配 | ~35 (20%) |
| 命名差异 | ~50 |
| 缺失后端 | ~30 |
| 缺失前端 | ~60 |

---

## 四、结构化日志覆盖率

| 维度 | 覆盖率 | 说明 |
|------|--------|------|
| 使用结构化日志的文件 | ~20/137 (14%) | 主要覆盖 Pipeline/自愈/租户隔离 |
| 含 traceId 的日志 | ~62/380 (16%) | 全局 logger 使用率 |
| 前端请求携带追踪 ID | ❌ 0% | 无 X-Request-Id header |

---

## 五、design-constraint 规则符合度

| 审查规则 | 符合度 | 说明 |
|----------|--------|------|
| 1. 交互链完整性 | 70% | 主流页面 CRUD 完整 |
| 2. 字段读写状态 | 80% | PipelineList 等已实现编辑/删除 |
| 3. CRUD 完整性 | 75% | 25% 页面详情-编辑-保存链路中断 |
| 4. Loading/Error 反馈 | 65% | error 处理不统一（console vs message） |
| 5. 空状态引导 | 30% | 仅 30/202 页面使用 Empty 组件 |

---

## 六、关键发现

| 等级 | 问题 | 影响面 |
|------|------|--------|
| **P0** | 核心引擎层 209 处 `throw new Error()` 未使用 OrionError | 错误码无法精确分类 |
| **P0** | 前端 404/500 错误仅 console.error，无用户提示 | 用户体验差 |
| **P1** | API 路径前缀风格不统一 (175+ 路由) | 运维调试混乱 |
| **P1** | 结构化日志覆盖率仅 ~14% | 线上排查困难 |
| **P1** | TraceId 未在日志中完整输出 | 无法关联前后端请求 |
| **P2** | 空状态处理覆盖率仅 ~15% | 用户不知道何时该创建数据 |
| **P2** | ErrorBoundary 无错误上报机制 | 无法收集前端运行时崩溃数据 |

---

## 七、改进建议

### P0 立即修复
1. 核心引擎层 `throw new Error()` → `throw new OrionError()`
2. 前端 API 客户端 404/500 添加 `message.error`

### P1 短期修复
3. 全局错误日志注入 traceId
4. 前端请求携带 X-Request-Id header
5. 统一 API 路径前缀为 `/api/v1/<domain>/`

### P2 中期修复
6. ErrorBoundary 增加错误上报
7. 空状态补全（Empty + 引导按钮）
8. 结构化日志覆盖率提升至 80%+
