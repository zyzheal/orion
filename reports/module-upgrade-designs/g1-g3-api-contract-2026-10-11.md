# G1 / G2 / G3 API 契约（承接 Meta Review D6）

**评审对象**：本轮新增 3 个后端域（G1 user_role / G2 recipient / G3 notification-adapter）
**文档性质**：HTTP API 契约设计，非生产代码
**版本**：v1.0（2026-10-11）
**关联**：
- 上游：`design-set-enterprise-level-meta-review-2026-10-11.md` §3.1（P1 深度不均衡）
- 关联：`backend-g1-g3-implementation-spec-2026-10-11.md`（实现细节）
- 关联：`triage-api-contract-design-2026-10-11.md`（G4/Triage API 契约，格式对齐）
- 关联：`docs/adr/ADR-012-Factory-Handler-注册表模式.md`（G2 Resolver 注册表）

**硬约束**：
- **RC-03**：API 契约设计，不修改生产代码。
- **不估算人天/工期**。
- 与 Triage API 契约使用统一错误码前缀与响应格式。

---

## 1. API 表面总览

| 域 | 端点数 | 方法分布 | 认证模型 |
|---|---:|---|---|
| **G1 user_role** | 6 | 3 R / 2 W / 1 D | admin only |
| **G2 recipient** | 4 | 1 R / 2 W / 1 D | admin only |
| **G3 notification-adapter** | 3 | 1 R / 1 W / 1 D | internal only |
| **合计** | **13** | 5 R / 5 W / 3 D | — |

---

## 2. G1 user_role API

### 2.1 端点总览

| # | 方法 | 路径 | 权限 | 幂等 |
|---|---|---|---|---|
| 1 | `POST`   | `/api/v1/user-roles` | admin | Idempotency-Key |
| 2 | `GET`    | `/api/v1/user-roles` | admin | — |
| 3 | `GET`    | `/api/v1/user-roles/{id}` | admin | — |
| 4 | `PATCH`  | `/api/v1/user-roles/{id}` | admin | Idempotency-Key |
| 5 | `DELETE` | `/api/v1/user-roles/{id}` | admin | Idempotency-Key |
| 6 | `POST`   | `/api/v1/users/{user_id}/roles` | admin | Idempotency-Key（便捷批量） |

### 2.2 POST /api/v1/user-roles

**Grant 一个用户一个角色**。

```http
POST /api/v1/user-roles HTTP/1.1
Idempotency-Key: 0a1b2c3d-...
Content-Type: application/json

{
  "user_id": "usr_01J0Z...",
  "role": "triage_oncall",
  "tenant_id": "tnt_01J0Z...",
  "granted_by": "usr_01J0Y...",
  "granted_at": "2026-10-11T10:00:00Z",
  "expires_at": "2026-10-25T10:00:00Z",
  "reason": "值班排班临时授权"
}
```

**响应 201**：

```json
{
  "data": {
    "id": "ur_01J0Z...",
    "user_id": "usr_01J0Z...",
    "role": "triage_oncall",
    "tenant_id": "tnt_01J0Z...",
    "granted_by": "usr_01J0Y...",
    "granted_at": "2026-10-11T10:00:00Z",
    "expires_at": "2026-10-25T10:00:00Z",
    "reason": "值班排班临时授权",
    "status": "active"
  }
}
```

### 2.3 GET /api/v1/user-roles

**查询用户角色列表**（默认返回当前用户）。

```http
GET /api/v1/user-roles?user_id=usr_01J0Z...&status=active&page=1&page_size=50
```

**响应 200**：

```json
{
  "data": [ /* UserRole 数组 */ ],
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total": 3,
    "has_more": false
  }
}
```

### 2.4 PATCH /api/v1/user-roles/{id}

**修改角色属性**（仅允许修改 `expires_at`、`reason`、`status`）。

```json
{
  "expires_at": "2026-11-01T00:00:00Z",
  "reason": "延期授权",
  "status": "revoked"
}
```

### 2.5 DELETE /api/v1/user-roles/{id}

**撤销角色**（软删，`status → 'revoked'`）。

### 2.6 POST /api/v1/users/{user_id}/roles（批量）

```json
{
  "grants": [
    {"role": "triage_oncall", "expires_at": "2026-10-25T00:00:00Z"},
    {"role": "triage_viewer", "expires_at": "2027-01-01T00:00:00Z"}
  ],
  "granted_by": "usr_01J0Y...",
  "reason": "值班周授权"
}
```

**部分成功语义**：单个 grant 失败不影响其他 grant；返回 207 Multi-Status。

---

## 3. G2 recipient API

### 3.1 端点总览

| # | 方法 | 路径 | 权限 | 幂等 |
|---|---|---|---|---|
| 1 | `GET`  | `/api/v1/recipient-resolvers` | admin | — |
| 2 | `POST` | `/api/v1/recipient-resolve` | admin / escalation-policy 写入 | Idempotency-Key |
| 3 | `GET`  | `/api/v1/recipient-resolve/{spec_id}` | admin | — |
| 4 | `DELETE` | `/api/v1/recipient-resolve/{spec_id}` | admin | Idempotency-Key |

### 3.2 POST /api/v1/recipient-resolve

**解析 RecipientSpec**（前端调用此 API 获取「实际接收人列表」）。

```http
POST /api/v1/recipient-resolve HTTP/1.1
Content-Type: application/json

{
  "spec": {
    "kind": "oncall-duty",
    "tenant_id": "tnt_01J0Z...",
    "params": {
      "rotation_id": "rot_01J0Z...",
      "as_of": "2026-10-11T10:00:00Z"
    }
  }
}
```

**响应 200**（Resolver 展开为具体用户 ID 列表）：

```json
{
  "data": {
    "resolved_at": "2026-10-11T10:00:00Z",
    "spec_kind": "oncall-duty",
    "resolved_users": [
      {"user_id": "usr_01J0Z...", "role": "primary", "display_name": "张三"},
      {"user_id": "usr_01J0Z...", "role": "secondary", "display_name": "李四"}
    ],
    "cache_hit": false,
    "ttl_seconds": 3600
  }
}
```

### 3.3 Resolver Kind 枚举

| Kind | 参数 | 说明 |
|---|---|---|
| `user`        | `user_ids: []` | 显式指定用户列表 |
| `role`        | `role: string` | 展开为拥有该角色的用户 |
| `team`        | `team_id: string` | 展开为团队全部成员 |
| `oncall-duty` | `rotation_id, as_of` | 展开当班主/备人员 |
| `escalation`  | `policy_id, level` | 展开升级策略某级别接收人 |
| `broadcast`   | `scope: string` | 广播到全体/某范围 |

### 3.4 错误码

| HTTP | 错误码 | 场景 |
|---|---|---|
| 400 | `E_RECIP_SPEC_INVALID` | spec 结构非法 |
| 400 | `E_RECIP_KIND_UNKNOWN` | kind 未注册 |
| 400 | `E_RECIP_PARAM_MISSING` | 必填参数缺失 |
| 404 | `E_RECIP_REF_NOT_FOUND` | 引用对象不存在（如 rotation_id） |
| 409 | `E_RECIP_RESOLVE_CONFLICT` | 解析结果冲突（多版本并存） |
| 500 | `E_RECIP_RESOLVER_INTERNAL` | Resolver 内部错误 |
| 503 | `E_RECIP_RESOLVER_TIMEOUT` | Resolver 超时（10s 硬超时） |

---

## 4. G3 notification-adapter API

### 4.1 端点总览

| # | 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|---|
| 1 | `GET`  | `/api/v1/notification-adapter/status` | internal | 查看适配器状态 |
| 2 | `POST` | `/api/v1/notification-adapter/deliver` | internal | 手动触发投递 |
| 3 | `DELETE` | `/api/v1/notification-adapter/deliveries/{id}` | internal | 撤销未发送的投递 |

**⚠️ 全部为内部 API**：不对外暴露，仅供运维/管理面使用；不进入 OpenAPI 对外版本。

### 4.2 POST /api/v1/notification-adapter/deliver

**手动触发一次投递**（供运维在灰度时验证路径）。

```json
{
  "template_id": "tpl_01J0Z...",
  "channel": "wechat-work",
  "recipient_spec": {
    "kind": "user",
    "tenant_id": "tnt_01J0Z...",
    "params": {"user_ids": ["usr_01J0Z..."]}
  },
  "context": {
    "alert_id": "al_01J0Z...",
    "subject": "CPU 高",
    "body": "..."
  },
  "dry_run": true
}
```

**响应 200**：

```json
{
  "data": {
    "delivery_id": "dlv_01J0Z...",
    "dry_run": true,
    "would_send_to": ["usr_01J0Z..."],
    "would_send_via": ["wechat-work"],
    "adapter_mode": "pipeline_adapter"
  }
}
```

### 4.3 GET /api/v1/notification-adapter/status

**查看适配器状态**（供运维判断走 pipeline 还是 legacy）。

```json
{
  "data": {
    "pipeline_adapter_enabled": true,
    "pipeline_available": true,
    "legacy_fallback_active": false,
    "recent_delivery_success_rate": 0.998,
    "recent_delivery_count": 15234,
    "last_switch_at": "2026-10-11T09:00:00Z"
  }
}
```

---

## 5. 通用约定

### 5.1 认证与鉴权

| 端点类别 | 认证方式 | 鉴权模型 |
|---|---|---|
| G1 user_role | Bearer Token | RBAC: admin |
| G2 recipient | Bearer Token | RBAC: admin 或 escalation_policy 写入者 |
| G3 adapter | Internal Header | 服务间内部调用 |

### 5.2 响应格式

统一使用 Triage API 契约约定的包装：

```json
{
  "data": <T>,
  "pagination": {...},
  "meta": {
    "request_id": "req_01J0Z...",
    "trace_id": "0a1b2c3d...",
    "server_time": "2026-10-11T10:00:00Z"
  }
}
```

### 5.3 错误响应

```json
{
  "error": {
    "code": "E_RECIP_SPEC_INVALID",
    "message": "spec.kind is required",
    "details": {"field": "kind"},
    "request_id": "req_01J0Z..."
  }
}
```

### 5.4 分页

统一 Cursor 分页或 Page 分页二选一，与 Triage API 保持一致。

| 端点 | 分页策略 |
|---|---|
| user-roles list | Page 分页（`page` + `page_size`） |
| recipient list | Page 分页 |

### 5.5 幂等

- 所有写操作（POST/PATCH/DELETE）必须支持 `Idempotency-Key` header
- Redis 存储 key = `idempotency:{endpoint}:{key}`，TTL = 24h
- 相同 key 返回首次结果（含 `idempotency-hit: true` header）

### 5.6 Rate Limit

| 端点类别 | 限制 |
|---|---|
| user_role 单用户 | 100 req/min |
| recipient resolve | 200 req/min |
| adapter deliver | 100 req/min（防刷） |

---

## 6. Feature Flag

| Flag | 默认 | 说明 |
|---|---|---|
| `g1.user_role.enabled` | false | G1 API 是否对外提供 |
| `g2.recipient.enabled` | false | G2 API 是否对外提供 |
| `g3.adapter.enabled` | false | G3 API 是否允许调用 |

---

## 7. 错误码总表

| Code | HTTP | 域 | 含义 |
|---|---|---|---|
| `E_ROLE_ALREADY_EXISTS` | 409 | G1 | 用户已拥有该角色 |
| `E_ROLE_REVOKED` | 410 | G1 | 角色已撤销 |
| `E_ROLE_EXPIRED` | 410 | G1 | 角色已过期 |
| `E_ROLE_GRANTED_BY_SELF` | 403 | G1 | 不能自我授权 |
| `E_ROLE_GRANTER_FORBIDDEN` | 403 | G1 | 授权者权限不足 |
| `E_RECIP_SPEC_INVALID` | 400 | G2 | spec 结构非法 |
| `E_RECIP_KIND_UNKNOWN` | 400 | G2 | kind 未注册 |
| `E_RECIP_PARAM_MISSING` | 400 | G2 | 必填参数缺失 |
| `E_RECIP_REF_NOT_FOUND` | 404 | G2 | 引用对象不存在 |
| `E_RECIP_RESOLVE_CONFLICT` | 409 | G2 | 解析冲突 |
| `E_RECIP_RESOLVER_INTERNAL` | 500 | G2 | 内部错误 |
| `E_RECIP_RESOLVER_TIMEOUT` | 503 | G2 | 超时 |
| `E_ADAPTER_DISABLED` | 503 | G3 | 适配器已禁用 |
| `E_ADAPTER_FALLBACK` | 200 | G3 | 走了 fallback（响应 meta 标记） |
| `E_ADAPTER_TEMPLATE_NOT_FOUND` | 404 | G3 | 模板不存在 |

---

## 8. 与 Triage API 的接口对接

### 8.1 依赖关系

```
Triage Overview API
  ├─ 需要 G1 user_role：判断当前用户是否在值班
  └─ 需要 G2 recipient：解析收件人（升级路径）

Triage Assign/Unassign API
  └─ 需要 G2 recipient：解析 oncall-duty 得到当班人

Triage Handoff API
  └─ 需要 G2 recipient：解析升级策略
```

### 8.2 一致性

- **错误码前缀**：Triage = `E_TRIAGE_*`，G1 = `E_ROLE_*`，G2 = `E_RECIP_*`，G3 = `E_ADAPTER_*`
- **响应格式**：全部使用 `{data, pagination, meta}` 包装
- **认证**：全部使用 Bearer Token（除 G3 使用 internal header）
- **Idempotency-Key**：全部写操作支持
- **OpenAPI 版本**：与 Triage API 共享同一份 spec 文件

---

## 9. 复现命令

```bash
cd /Users/heal/orion-design

# 相关设计文档
ls reports/module-upgrade-designs/triage-api-contract-design-2026-10-11.md
ls reports/module-upgrade-designs/backend-g1-g3-implementation-spec-2026-10-11.md
ls reports/module-upgrade-designs/g1-g3-api-contract-2026-10-11.md

# ADR 参照
ls docs/adr/ADR-012-Factory-Handler-注册表模式.md

# 端点数汇总
grep -c '^\| `\(POST\|GET\|PATCH\|DELETE\|PUT\)`' \
  reports/module-upgrade-designs/g1-g3-api-contract-2026-10-11.md

# 错误码汇总
grep -c 'E_ROLE_\|E_RECIP_\|E_ADAPTER_' \
  reports/module-upgrade-designs/g1-g3-api-contract-2026-10-11.md
```

---

## 10. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| 1 | 3 域 API 完整（G1/G2/G3） | §2 §3 §4 |
| 2 | 端点计数明确（13 个） | §1 表格 |
| 3 | 请求/响应示例完整 | §2.2 等 |
| 4 | 错误码穷举（15 个） | §7 |
| 5 | 认证与鉴权模型明确 | §5.1 |
| 6 | 响应格式统一 | §5.2 |
| 7 | 分页与幂等约定明确 | §5.4 §5.5 |
| 8 | Feature Flag 明确 | §6 |
| 9 | 与 Triage API 对接关系明确 | §8 |
| 10 | 深度对齐 Triage API 契约 | 与 `triage-api-contract-design.md` 平行结构 |
| 11 | ⭐ 复现命令 6+ 条 | §9 |
| 12 | 未修改生产代码 | `git status --porcelain -- '*.go' '*.ts' '*.tsx'` 空 |
| 13 | 未估算人天/工期 | 全文检索禁词 |

---

## 11. 与 D1 backend-g1-g3-implementation-spec 的关系

| 文档 | 视角 | 主要内容 |
|---|---|---|
| `backend-g1-g3-implementation-spec` (D1) | **实现视角** | Migration SQL、代码结构、Resolver 实现、测试用例 |
| **`g1-g3-api-contract` (本文, D6)** | **契约视角** | 端点、请求/响应、错误码、认证、幂等 |

**不重复**：D1 侧重「怎么实现」，本文侧重「怎么用」。
**互补**：D1 §5 有简要 API 描述，本文是完整契约；D1 §5 是索引，本文是详情。

---

*本文档与 Triage API 契约共同构成本轮 3+1 域（G1/G2/G3/G4）的完整 API 表面积，
共 20 个 HTTP 端点（Triage 7 + G1 6 + G2 4 + G3 3），
统一认证 / 响应格式 / 错误码 / 幂等策略。

补齐 Meta Review §3.1 P1「G1-G3 深度不均衡」问题，
达到与 G4/Triage 相同的 API 契约文档深度。*
