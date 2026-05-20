# 个人中心与个人设置 - 完整企业级设计方案

## 一、概述

**项目名称**: 用户中心与个人设置功能
**项目类型**: 前后端完整功能实现
**核心主张**: 为 Orion 平台提供完整的用户档案管理和个人配置能力

## 二、系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         前端 (React)                            │
├─────────────────────────────────────────────────────────────────┤
│  /profile                    │  /settings                      │
│  ┌─────────────────────┐     │  ┌─────────────────────────┐    │
│  │ 个人档案页面        │     │  │ 个人设置页面            │    │
│  │ - 基本信息卡片      │     │  │ - 基本配置 Tab          │    │
│  │ - 所属团队列表      │     │  │ - 安全设置 Tab          │    │
│  │ - 权限矩阵展示      │     │  │ - 通知偏好 Tab          │    │
│  │ - 操作日志时间线    │     │  │ - 第三方登录 Tab        │    │
│  └─────────────────────┘     │  │ - API Token Tab         │    │
│                              │  └─────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## 三、后端 API 设计

### 3.1 现有端点（已存在）
- `GET /api/v1/users` - 用户列表
- `GET /api/v1/users/:id` - 用户详情
- `PUT /api/v1/users/:id` - 更新用户
- `POST /api/v1/users/:id/change-password` - 修改密码

### 3.2 新增端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/users/:id/profile` | GET | 获取完整用户档案 |
| `/api/v1/users/:id/profile` | PUT | 更新个人资料 |
| `/api/v1/users/:id/teams` | GET | 获取所属团队 |
| `/api/v1/users/:id/permissions` | GET | 获取权限矩阵 |
| `/api/v1/users/:id/activities` | GET | 获取操作日志 |
| `/api/v1/users/:id/tokens` | GET | 获取 API Token 列表 |
| `/api/v1/users/:id/tokens` | POST | 创建 Token |
| `/api/v1/users/:id/tokens/:tokenId` | DELETE | 删除 Token |
| `/api/v1/users/:id/notifications` | GET | 获取通知偏好 |
| `/api/v1/users/:id/notifications` | PUT | 更新通知偏好 |
| `/api/v1/users/:id/oauth` | GET | 获取第三方绑定 |
| `/api/v1/users/:id/oauth/:provider` | POST | 绑定第三方账号 |
| `/api/v1/users/:id/oauth/:provider` | DELETE | 解绑第三方账号 |

## 四、前端设计

### 4.1 路由配置
- `/profile` - 个人中心页面
- `/settings` - 个人设置页面

### 4.2 个人中心页面结构

```
┌─────────────────────────────────────────────────────┐
│  [头像]  用户名                    [编辑资料]       │
│  邮箱 | 角色 | 状态                               │
├─────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌────────────────────┐     │
│  │ 所属团队         │  │ 权限矩阵           │     │
│  │ - Team A (Admin) │  │ ✓ pipeline:read    │     │
│  │ - Team B (Dev)   │  │ ✓ pipeline:write   │     │
│  └──────────────────┘  │ ✓ user:read        │     │
│                        └────────────────────┘     │
├─────────────────────────────────────────────────────┤
│  操作日志                                            │
│  ○ 2026-05-19 14:30 修改密码                        │
│  ○ 2026-05-19 10:15 创建 API Token                 │
│  ○ 2026-05-18 16:20 登录系统                        │
└─────────────────────────────────────────────────────┘
```

### 4.3 个人设置页面结构

使用 Tabs 组织 5 个标签页：

1. **基本资料** - 头像上传、显示名称、手机
2. **安全设置** - 修改密码、登录历史、安全评分
3. **通知偏好** - 邮件/站内信/钉钉/飞书推送开关
4. **第三方登录** - GitHub/GitLab 绑定状态
5. **API Token** - Token 列表、创建、删除

## 五、数据模型

### 5.1 新增数据库表

```sql
-- user_activities 操作日志
CREATE TABLE user_activities (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- user_api_tokens API Token
CREATE TABLE user_api_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- user_notification_preferences 通知偏好
CREATE TABLE user_notification_preferences (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) UNIQUE,
  email_enabled BOOLEAN DEFAULT true,
  in_app_enabled BOOLEAN DEFAULT true,
  webhook_enabled BOOLEAN DEFAULT false,
  webhook_url VARCHAR(500),
  notify_frequency VARCHAR(20) DEFAULT 'realtime',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- user_oauth_bindings 第三方绑定
CREATE TABLE user_oauth_bindings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  provider VARCHAR(50) NOT NULL,
  provider_user_id VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider)
);
```

## 六、实现计划

### 阶段一：后端 API
1. 扩展 UserRepository 支持新表
2. 实现 UserProfileService
3. 实现 UserActivityService
4. 实现 UserTokenService
5. 实现 UserNotificationService
6. 实现 UserOAuthService
7. 注册新路由

### 阶段二：前端页面
1. 创建 `/profile` 页面及组件
2. 创建 `/settings` 页面及组件
3. 更新 Layout 路由配置
4. 创建用户相关 API 客户端

### 阶段三：集成测试
1. 前后端联调
2. 功能验证
3. 样式适配 Design Token

## 七、设计 Token 适配

遵循 `CLAUDE.md` 中的 Frontend Design Principles：
- 卡片圆角: 12px (`componentRadius.card`)
- 按钮圆角: 6px (`componentRadius.button.md`)
- 阴影: Card 使用 `0 1px 3px rgba(0,0,0,0.06)`
- 主色: `#3370E6` (`colors.primary[500]`)
- 表格行高: 48px

## 八、验收标准

1. ✅ 个人中心页面展示完整用户档案
2. ✅ 个人设置页面可更新个人资料
3. ✅ 可修改密码
4. ✅ 可管理 API Token
5. ✅ 可配置通知偏好
6. ✅ 可绑定/解绑第三方账号
7. ✅ 操作日志正确记录
8. ✅ 所有 API 权限验证通过（用户只能访问自己的数据）
9. ✅ 样式符合 Design Token 规范