# 权限配置页面设计方案

## 1. 设计目标

为全局 Capability 能力体系设计配套的管理页面，实现：
- 能力的可视化查看与管理
- 角色与能力的绑定配置
- 用户临时能力授权/撤销
- 能力使用审计追踪
- ChatOps 配置后台的权限保护

---

## 2. 页面结构总览

### 2.1 页面入口

```
/console                                    # 控制台（现有）
├── roles                                   # 角色管理（现有）
├── users                                   # 用户管理（现有）
├── capabilities                            # ⭐ 新增：能力管理
│   ├── /list                               # 能力列表
│   ├── /roles                              # 角色能力分配
│   └── /audit                              # 能力审计日志
├── chatops                                 # ChatOps（现有）
│   └── settings                            # 配置管理（需能力保护）
```

### 2.2 页面清单

| 页面 | 路径 | 功能 | 优先级 |
|------|------|------|--------|
| A. 能力列表页 | `/console/capabilities/list` | 查看所有能力、筛选、详情 | P0 |
| B. 角色能力分配页 | `/console/capabilities/roles` | 为角色配置能力、权限矩阵 | P0 |
| C. 用户能力覆盖页 | `/console/capabilities/users` | 临时授权/撤销用户能力 | P1 |
| D. 能力审计页 | `/console/capabilities/audit` | 查看能力使用日志 | P1 |
| E. ChatOps 配置保护 | `/ai/chatops/settings` | 各 Tab 按能力可见 | P0 |

---

## 3. 页面 A：能力列表页

### 3.1 功能描述

- 查看系统中定义的所有能力
- 按类别、风险等级筛选
- 查看能力详情（包含的子能力、关联角色）

### 3.2 UI 布局

```
┌─────────────────────────────────────────────────────────────────┐
│  能力管理                                           [刷新]       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ 全部 (32)   │ │ ChatOps (2) │ │ 运维 (7)   │ │ 安全 (3) │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  搜索: [能力名称/ID                        ] [🔍]              │
│  筛选: 风险等级 [全部▼]  分类 [全部▼]  状态 [全部▼]            │
├─────────────────────────────────────────────────────────────────┤
│  能力ID                   │ 名称          │ 分类   │ 风险 │ 状态│
│  ────────────────────────┼───────────────┼────────┼──────┼────│
│  chatops_advanced        │ ChatOps高级操作│ ChatOps│ 3    │ ✅ │
│  pipeline_operations     │ 流水线操作    │ 运维   │ 3    │ ✅ │
│  deployment_operations   │ 部署操作      │ 运维   │ 4    │ ✅ │
│  secret_operations       │ 密钥操作      │ 运维   │ 4    │ ✅ │
│  ...                     │ ...           │ ...    │ ...  │    │
├─────────────────────────────────────────────────────────────────┤
│  共 32 条记录  |  当前页 1/4  |  < 1 2 3 4 >  |  每页 10 ▼      │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 数据结构

```typescript
interface Capability {
  id: string;                    // 'deployment_operations.deploy_prod'
  name: string;                  // '生产环境部署'
  description: string;
  category: string;              // 'chatops' | 'pipeline' | 'deployment' | ...
  riskLevel: 1 | 2 | 3 | 4;
  requiresApproval: boolean;
  parentId: string | null;       // 顶级能力为 null
  enabled: boolean;
  childCount: number;            // 子能力数量
  roleCount: number;             // 绑定角色数量
  createdAt: string;
  updatedAt: string;
}
```

### 3.4 操作

| 操作 | 说明 |
|------|------|
| 查看详情 | 点击行展开，显示子能力列表、绑定角色 |
| 搜索 | 支持按 ID、名称模糊搜索 |
| 筛选 | 按风险等级、分类、状态筛选 |
| 刷新 | 重新加载能力列表 |

---

## 4. 页面 B：角色能力分配页

### 4.1 功能描述

- 以角色为单位配置能力
- 提供权限矩阵视图（角色 × 能力）
- 支持批量授予/撤销能力

### 4.2 UI 布局（Tab 切换）

#### Tab 1：角色能力列表

```
┌─────────────────────────────────────────────────────────────────┐
│  角色能力分配                                    [+ 添加角色]    │
├─────────────────────────────────────────────────────────────────┤
│  角色: [Admin        ▼]  [Developer ▼]  [+ 添加到新角色]       │
├─────────────────────────────────────────────────────────────────┤
│  已分配能力 (12)                                                 │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ ☑ chatops_advanced       ChatOps高级操作        [风险3]  ││
│  │ ☑ pipeline_operations    流水线操作              [风险3]  ││
│  │ ☑ deployment_operations  部署操作                [风险4]  ││
│  │ ☐ environment_operations 环境操作                [风险3]  ││
│  │ ...                                                        ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│  可选能力 (20)                                                   │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ ☐ backup_operations      备份操作                [风险3]  ││
│  │ ☐ disaster_recovery      灾备操作                [风险4]  ││
│  │ ...                                                        ││
│  └────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  [保存更改]                                    [取消]            │
└─────────────────────────────────────────────────────────────────┘
```

#### Tab 2：权限矩阵视图

```
┌─────────────────────────────────────────────────────────────────┐
│  权限矩阵                                            [导出]     │
├─────────────────────────────────────────────────────────────────┤
│                    │ Admin │ Developer │ SRE │ Viewer │        │
│  ──────────────────┼───────┼───────────┼─────┼────────┼────────│
│  ChatOps           │       │           │     │        │        │
│    chatops_advanced│   ✓   │     ✓     │  ✓  │    -   │        │
│    chatops_command_manage│   ✓   │     -     │  ✓  │    -   │        │
│  Pipeline          │       │           │     │        │        │
│    trigger        │   ✓   │     ✓     │  ✓  │    -   │        │
│    trigger_prod   │   ✓   │     -     │  ✓  │    -   │        │
│    delete         │   ✓   │     -     │  -  │    -   │        │
│  Deployment        │       │           │     │        │        │
│    deploy_prod    │   ✓   │     -     │  ✓  │    -   │        │
│    rollback       │   ✓   │     -     │  ✓  │    -   │        │
├─────────────────────────────────────────────────────────────────┤
│  图例: ✓ 拥有  - 未拥有  ⊙ 需审批                               │
└─────────────────────────────────────────────────────────────────┘
```

### 4.5 数据结构

```typescript
interface RoleCapability {
  roleId: string;
  roleName: string;
  capabilities: {
    capabilityId: string;
    granted: boolean;
    grantedAt?: string;
  }[];
}

// API 请求/响应
interface UpdateRoleCapabilitiesRequest {
  roleId: string;
  capabilities: Array<{
    capabilityId: string;
    granted: boolean;
  }>;
}
```

### 4.6 操作

| 操作 | 说明 |
|------|------|
| 选择角色 | 切换角色，刷新该角色的能力列表 |
| 授予能力 | 勾选能力，点击保存 |
| 撤销能力 | 取消勾选，点击保存 |
| 批量操作 | 批量授予/撤销选中能力 |
| 导出矩阵 | 导出权限矩阵为 Excel |

---

## 5. 页面 C：用户能力覆盖页

### 5.1 功能描述

- 查看用户在角色能力之外的额外能力
- 为用户临时授权/撤销能力（带过期时间）
- 查看用户有效能力（角色能力 + 用户覆盖）

### 5.2 UI 布局

```
┌─────────────────────────────────────────────────────────────────┐
│  用户能力覆盖                                    [+ 添加覆盖]   │
├─────────────────────────────────────────────────────────────────┤
│  用户: [搜索用户...                              ] [🔍]        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 👤 zhangsan (张三)                                          ││
│  │ 角色: Developer, SRE                                        ││
│  │ 有效能力数: 28                                              ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ 用户覆盖 (3)                               [+ 添加]        ││
│  │ ┌────────────────────────────────────────────────────────┐ ││
│  │ │ 能力ID                  │ 状态  │ 过期时间   │ 操作   │ ││
│  │ │ deployment_operations  │ 授予  │ 2026-05-25 │ [撤销] │ ││
│  │ │ .deploy_prod           │      │           │        │ ││
│  │ │ pipeline_operations    │ 授予  │ 永久       │ [撤销] │ ││
│  │ │ .trigger_prod          │      │           │        │ ││
│  │ └────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 👤 lisi (李四)                                              ││
│  │ ...                                                         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

#### 添加覆盖 Modal

```
┌─────────────────────────────────────────────────┐
│  添加用户能力覆盖                                │
├─────────────────────────────────────────────────┤
│  用户: [搜索用户...                      ] [🔍] │
│                                                 │
│  能力: [请选择能力                          ▼] │
│       (可搜索: deploy, pipeline...)            │
│                                                 │
│  操作: ○ 授予  ● 撤销                         │
│                                                 │
│  过期时间: [选择日期时间            ] [清除]   │
│         (留空表示永久生效)                      │
│                                                 │
│  原因: [请输入授权原因...                      │
│        (可选)                                  │
├─────────────────────────────────────────────────┤
│                              [取消]  [确定]    │
└─────────────────────────────────────────────────┘
```

### 5.3 数据结构

```typescript
interface UserCapabilityOverride {
  id: string;
  userId: string;
  userName: string;
  capabilityId: string;
  capabilityName: string;
  granted: boolean;
  reason?: string;
  grantedBy: string;
  grantedByName: string;
  expiresAt: string | null;  // null 表示永久
  createdAt: string;
}

// 用户有效能力（角色 + 覆盖）
interface UserEffectiveCapabilities {
  userId: string;
  userName: string;
  roles: string[];
  roleCapabilities: string[];      // 角色继承的能力
  overrides: UserCapabilityOverride[];  // 用户覆盖
  effectiveCapabilities: string[]; // 最终有效能力（角色 + 覆盖）
}
```

### 5.4 操作

| 操作 | 说明 |
|------|------|
| 搜索用户 | 按用户名/ID 搜索 |
| 添加覆盖 | 为用户授予或撤销特定能力 |
| 撤销覆盖 | 删除用户的能力覆盖 |
| 查看有效能力 | 查看用户最终拥有的能力列表 |
| 批量操作 | 批量授予/撤销多个用户的能力 |

---

## 6. 页面 D：能力审计页

### 6.1 功能描述

- 查看所有能力检查的审计日志
- 按用户、能力、时间范围筛选
- 导出审计报告

### 6.2 UI 布局

```
┌─────────────────────────────────────────────────────────────────┐
│  能力审计日志                                      [导出]       │
├─────────────────────────────────────────────────────────────────┤
│  筛选条件                                                         │
│  用户: [搜索用户...      ]  能力: [搜索能力...    ]             │
│  时间: [选择日期范围                           ]                │
│  结果: [全部▼]  操作: [全部▼]                                    │
├─────────────────────────────────────────────────────────────────┤
│  时间            │ 用户    │ 能力ID              │ 操作  │ 结果│
│  ───────────────┼─────────┼─────────────────────┼───────┼─────│
│  05-19 10:23:15 │ zhangsan│ deployment_oper...  │ check │ ✅  │
│  05-19 10:22:30 │ lisi    │ pipeline_oper...    │ check │ ❌  │
│  05-19 10:21:45 │ wangwu  │ chatops_advanced... │ grant │ ✅  │
│  05-19 10:20:10 │ zhangsan│ secret_operations   │ check │ ❌  │
│  ...            │ ...     │ ...                 │ ...   │ ... │
├─────────────────────────────────────────────────────────────────┤
│  共 1,234 条  |  当前页 1/62  |  < 1 2 3 ... 62 >              │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 数据结构

```typescript
interface CapabilityAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  capabilityId: string;
  capabilityName: string;
  action: 'check' | 'grant' | 'revoke' | 'approve' | 'deny';
  result: 'allowed' | 'denied' | 'pending_approval';
  reason?: string;
  requestIp: string;
  userAgent?: string;
  riskLevel: 1 | 2 | 3 | 4;
  duration: number;  // 毫秒
}

interface AuditExportParams {
  startDate: string;
  endDate: string;
  userIds?: string[];
  capabilityIds?: string[];
  results?: string[];
  format: 'csv' | 'xlsx' | 'pdf';
}
```

---

## 7. 页面 E：ChatOps 配置能力保护

### 7.1 功能描述

在 `/ai/chatops/settings` 的各 Tab 中，按用户能力控制可见性：

| Tab | 需要的 Capability |
|-----|-------------------|
| 问答卡片 | `chatops_card_manage` |
| 命令配置 | `chatops_command_manage` |
| 平台配置 | `chatops_platform_manage` |
| 通知与免打扰 | `chatops_notification_manage` |

### 7.2 UI 实现

```tsx
// orion-frontend/src/pages/ChatOps/ChatOpsSettings.tsx

import { CapabilityGate } from '@/components/CapabilityGate';

// 命令配置 Tab
function CommandConfigTab() {
  const { has } = useCapabilityStore();

  return (
    <CapabilityGate
      id="chatops_command_manage"
      fallback={
        <Alert
          type="info"
          message="您没有命令配置权限，仅可查看"
          showIcon
        />
      }
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={<PlusOutlined />} onClick={handleAdd}>
          添加命令
        </Button>
      </div>
      {/* 命令列表... */}
    </CapabilityGate>
  );
}

// 平台配置 Tab
function PlatformConfigTab() {
  return (
    <CapabilityGate
      id="chatops_platform_manage"
      fallback={
        <Alert
          type="warning"
          message="需要平台管理权限才能修改 Webhook 和 Token"
          description="请联系管理员申请 chatops_platform_manage 能力"
          showIcon
        />
      }
    >
      <Form form={platformForm} layout="vertical">
        {/* 平台配置表单... */}
      </Form>
    </CapabilityGate>
  );
}
```

### 7.3 能力定义

```typescript
// 种子数据
const CHATOPS_CONFIG_CAPABILITIES = [
  {
    id: 'chatops_view',
    name: 'ChatOps 查看',
    category: 'chatops_config',
    riskLevel: 1,
    requiresApproval: false,
    description: '查看命令目录、执行记录、配置',
  },
  {
    id: 'chatops_card_manage',
    name: '问答卡片管理',
    category: 'chatops_config',
    riskLevel: 2,
    requiresApproval: false,
    description: '新增、编辑、删除问答卡片',
  },
  {
    id: 'chatops_command_manage',
    name: '命令配置管理',
    category: 'chatops_config',
    riskLevel: 3,
    requiresApproval: true,
    description: '新增、编辑、删除命令配置',
  },
  {
    id: 'chatops_platform_manage',
    name: '平台配置管理',
    category: 'chatops_config',
    riskLevel: 4,
    requiresApproval: true,
    description: '修改平台 Webhook、Token 等敏感配置',
  },
  {
    id: 'chatops_notification_manage',
    name: '通知设置管理',
    category: 'chatops_config',
    riskLevel: 2,
    requiresApproval: false,
    description: '修改通知偏好、免打扰设置',
  },
  {
    id: 'chatops_execution_monitor',
    name: '执行监控',
    category: 'chatops_config',
    riskLevel: 2,
    requiresApproval: false,
    description: '查看执行记录、重试',
  },
  {
    id: 'chatops_execution_cancel',
    name: '执行取消',
    category: 'chatops_config',
    riskLevel: 3,
    requiresApproval: false,
    description: '取消正在执行的命令',
  },
];
```

---

## 8. API 端点设计

### 8.1 能力管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/authz/capabilities` | 获取能力列表（分页、筛选） |
| `GET` | `/api/v1/authz/capabilities/:id` | 获取能力详情 |
| `GET` | `/api/v1/authz/capabilities/tree` | 获取能力树结构 |
| `POST` | `/api/v1/authz/capabilities` | 创建能力（系统初始化用） |
| `PATCH` | `/api/v1/authz/capabilities/:id` | 更新能力 |

### 8.2 角色能力 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/authz/roles/:roleId/capabilities` | 获取角色的能力列表 |
| `PUT` | `/api/v1/authz/roles/:roleId/capabilities` | 更新角色的能力 |
| `GET` | `/api/v1/authz/capabilities/matrix` | 获取权限矩阵（全部角色） |

### 8.3 用户能力 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/authz/users/:userId/capabilities` | 获取用户覆盖列表 |
| `POST` | `/api/v1/authz/users/:userId/capabilities` | 添加用户能力覆盖 |
| `DELETE` | `/api/v1/authz/users/:userId/capabilities/:capId` | 删除用户能力覆盖 |
| `GET` | `/api/v1/authz/users/:userId/effective` | 获取用户有效能力 |

### 8.4 审计 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/authz/capabilities/audit` | 获取审计日志 |
| `POST` | `/api/v1/authz/capabilities/audit/export` | 导出审计日志 |

---

## 9. 实施优先级

| 页面 | 优先级 | 工作量 | 依赖 |
|------|--------|--------|------|
| E. ChatOps 配置能力保护 | P0 | 0.5d | Capability 种子数据 |
| B. 角色能力分配 | P0 | 2d | CapabilityEngine 完成 |
| A. 能力列表 | P1 | 1d | 角色能力分配 |
| C. 用户能力覆盖 | P1 | 2d | 角色能力分配 |
| D. 能力审计 | P2 | 1.5d | 审计日志记录 |

---

## 10. 总结

本设计方案提供 5 个权限配置页面：

1. **能力列表页** — 可视化查看系统所有能力
2. **角色能力分配页** — 为角色配置能力，支持矩阵视图
3. **用户能力覆盖页** — 临时授权/撤销用户能力
4. **能力审计页** — 追踪能力使用记录
5. **ChatOps 配置保护** — 各 Tab 按能力可见

配合现有的 RoleManagement 和 UserManagement 页面，形成完整的权限配置体系。