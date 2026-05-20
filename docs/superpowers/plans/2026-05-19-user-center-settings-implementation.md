# 个人中心与个人设置 - 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Orion 平台实现个人中心（/profile）和个人设置（/settings）页面，包含用户档案、团队、权限、日志、基本资料、安全、通知、第三方登录、API Token 管理

**Architecture:** 前端 React + Ant Design，后端 Fastify + PostgreSQL，复用现有 UserRepository 模式，新增专用 Service 处理用户档案、Token、日志等

**Tech Stack:** React, TypeScript, Ant Design, Fastify, PostgreSQL, Design Token

---

## 文件结构规划

### 后端文件

| 文件 | 职责 |
|------|------|
| `orion-platform-service/src/services/user/UserProfileService.ts` | 用户档案、团队、权限查询 |
| `orion-platform-service/src/services/user/UserActivityService.ts` | 操作日志记录与查询 |
| `orion-platform-service/src/services/user/UserTokenService.ts` | API Token 生命周期管理 |
| `orion-platform-service/src/services/user/UserNotificationService.ts` | 通知偏好 CRUD |
| `orion-platform-service/src/api/user-profile-routes.ts` | 用户档案相关 API 路由 |
| `orion-platform-service/src/api/user-activity-routes.ts` | 操作日志 API 路由 |
| `orion-platform-service/src/api/user-token-routes.ts` | API Token 路由 |
| `orion-platform-service/src/api/user-notification-routes.ts` | 通知偏好路由 |
| `orion-platform-service/src/api/routes.ts` | 注册新路由 |

### 前端文件

| 文件 | 职责 |
|------|------|
| `orion-frontend/src/pages/UserProfile/index.tsx` | 个人中心页面 |
| `orion-frontend/src/pages/UserSettings/index.tsx` | 个人设置页面 |
| `orion-frontend/src/api/user.ts` | 用户相关 API 客户端 |
| `orion-frontend/src/router/routes.tsx` | 添加 /profile 和 /settings 路由 |

---

## 实现任务

### 阶段一：后端 API

#### Task 1: UserProfileService - 用户档案服务

**Files:**
- Create: `orion-platform-service/src/services/user/UserProfileService.ts`

- [ ] **Step 1: 创建 UserProfileService**

```typescript
import { UserRepository } from './UserRepository';
import { Pool } from 'pg';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  avatar?: string;
  phone?: string;
  status: string;
  createdAt: Date;
  teams?: UserTeam[];
  permissions?: UserPermission[];
}

export interface UserTeam {
  id: string;
  name: string;
  role: string;
}

export interface UserPermission {
  resource: string;
  actions: string[];
}

export class UserProfileService {
  constructor(private userRepository: UserRepository) {}

  async getProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  async getUserTeams(userId: string): Promise<UserTeam[]> {
    // TODO: 实现团队查询
    return [];
  }

  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    // TODO: 实现权限查询
    return [];
  }

  async updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile | null> {
    // TODO: 实现资料更新
    return null;
  }
}
```

- [ ] **Step 2: 添加单元测试**

```typescript
// orion-platform-service/src/services/user/__tests__/UserProfileService.test.ts
import { UserProfileService } from '../UserProfileService';

describe('UserProfileService', () => {
  it('should get user profile by id', async () => {
    const service = new UserProfileService({} as any);
    const profile = await service.getProfile('123');
    expect(profile).toBeDefined();
  });
});
```

- [ ] **Step 3: Commit**

---

#### Task 2: UserActivityService - 操作日志服务

**Files:**
- Create: `orion-platform-service/src/services/user/UserActivityService.ts`

- [ ] **Step 1: 创建 UserActivityService**

```typescript
import { Pool } from 'pg';

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export class UserActivityService {
  constructor(private pool: Pool) {}

  async logActivity(activity: Omit<UserActivity, 'id' | 'createdAt'>): Promise<UserActivity> {
    const id = crypto.randomUUID();
    const query = `
      INSERT INTO user_activities (id, user_id, action, resource_type, resource_id, details, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await this.pool.query(query, [
      id,
      activity.userId,
      activity.action,
      activity.resourceType,
      activity.resourceId,
      JSON.stringify(activity.details || {}),
      activity.ipAddress,
      activity.userAgent,
    ]);
    return result.rows[0];
  }

  async getActivities(userId: string, limit = 20, offset = 0): Promise<UserActivity[]> {
    const query = `
      SELECT * FROM user_activities
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await this.pool.query(query, [userId, limit, offset]);
    return result.rows;
  }
}
```

- [ ] **Step 2: Commit**

---

#### Task 3: UserTokenService - API Token 服务

**Files:**
- Create: `orion-platform-service/src/services/user/UserTokenService.ts`

- [ ] **Step 1: 创建 UserTokenService**

```typescript
import { Pool } from 'pg';
import * as crypto from 'crypto';

export interface UserToken {
  id: string;
  userId: string;
  name: string;
  token: string; // 仅创建时返回
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
}

export class UserTokenService {
  constructor(private pool: Pool) {}

  async createToken(userId: string, name: string, expiresInDays?: number): Promise<UserToken> {
    const id = crypto.randomUUID();
    const token = `orion_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const query = `
      INSERT INTO user_api_tokens (id, user_id, name, token_hash, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    await this.pool.query(query, [id, userId, name, tokenHash, expiresAt]);

    return {
      id,
      userId,
      name,
      token, // 仅此次返回
      expiresAt: expiresAt || undefined,
      createdAt: new Date(),
    };
  }

  async getTokens(userId: string): Promise<Omit<UserToken, 'token'>[]> {
    const query = `
      SELECT id, user_id, name, expires_at, last_used_at, created_at
      FROM user_api_tokens
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query, [userId]);
    return result.rows;
  }

  async deleteToken(userId: string, tokenId: string): Promise<boolean> {
    const query = `DELETE FROM user_api_tokens WHERE id = $1 AND user_id = $2`;
    const result = await this.pool.query(query, [tokenId, userId]);
    return (result.rowCount ?? 0) > 0;
  }
}
```

- [ ] **Step 2: Commit**

---

#### Task 4: 用户档案 API 路由

**Files:**
- Create: `orion-platform-service/src/api/user-profile-routes.ts`
- Modify: `orion-platform-service/src/api/routes.ts`

- [ ] **Step 1: 创建 user-profile-routes.ts**

```typescript
import { FastifyInstance } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';

export default async function userProfileRoutes(app: FastifyInstance) {
  // GET /api/v1/users/:id/profile
  app.get('/:id/profile', {
    onRequest: [authenticateUser],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    // 验证权限：只能查看自己的档案
    const userId = (request as any).user?.id;
    if (userId !== id) {
      return reply.status(403).send({ success: false, error: 'Forbidden' });
    }
    // TODO: 调用 UserProfileService
    return { success: true, data: {} };
  });

  // PUT /api/v1/users/:id/profile
  app.put('/:id/profile', {
    onRequest: [authenticateUser],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.id;
    if (userId !== id) {
      return reply.status(403).send({ success: false, error: 'Forbidden' });
    }
    // TODO: 调用 UserProfileService.updateProfile
    return { success: true, data: {} };
  });

  // GET /api/v1/users/:id/teams
  app.get('/:id/teams', {
    onRequest: [authenticateUser],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.id;
    if (userId !== id) {
      return reply.status(403).send({ success: false, error: 'Forbidden' });
    }
    return { success: true, data: [] };
  });

  // GET /api/v1/users/:id/permissions
  app.get('/:id/permissions', {
    onRequest: [authenticateUser],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.id;
    if (userId !== id) {
      return reply.status(403).send({ success: false, error: 'Forbidden' });
    }
    return { success: true, data: [] };
  });
}
```

- [ ] **Step 2: 注册路由到 routes.ts**

在 routes.ts 中添加:
```typescript
import userProfileRoutes from './user-profile-routes';
// 在 registerRoutes 函数中添加:
app.register(userProfileRoutes, { prefix: '/api/v1/users' });
```

- [ ] **Step 3: Commit**

---

#### Task 5: 操作日志 API 路由

**Files:**
- Create: `orion-platform-service/src/api/user-activity-routes.ts`

- [ ] **Step 1: 创建 user-activity-routes.ts**

```typescript
import { FastifyInstance } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';

export default async function userActivityRoutes(app: FastifyInstance) {
  // GET /api/v1/users/:id/activities
  app.get('/:id/activities', {
    onRequest: [authenticateUser],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.id;
    if (userId !== id) {
      return reply.status(403).send({ success: false, error: 'Forbidden' });
    }
    const { page = '1', pageSize = '20' } = request.query as any;
    // TODO: 调用 UserActivityService.getActivities
    return { success: true, data: [], total: 0, page: Number(page), pageSize: Number(pageSize) };
  });
}
```

- [ ] **Step 2: 注册路由**

- [ ] **Step 3: Commit**

---

#### Task 6: API Token API 路由

**Files:**
- Create: `orion-platform-service/src/api/user-token-routes.ts`

- [ ] **Step 1: 创建 user-token-routes.ts**

```typescript
import { FastifyInstance } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';

export default async function userTokenRoutes(app: FastifyInstance) {
  // GET /api/v1/users/:id/tokens
  app.get('/:id/tokens', {
    onRequest: [authenticateUser],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.id;
    if (userId !== id) {
      return reply.status(403).send({ success: false, error: 'Forbidden' });
    }
    // TODO: 调用 UserTokenService.getTokens
    return { success: true, data: [] };
  });

  // POST /api/v1/users/:id/tokens
  app.post('/:id/tokens', {
    onRequest: [authenticateUser],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.id;
    if (userId !== id) {
      return reply.status(403).send({ success: false, error: 'Forbidden' });
    }
    const { name, expiresInDays } = request.body as any;
    // TODO: 调用 UserTokenService.createToken
    return { success: true, data: { token: '' } };
  });

  // DELETE /api/v1/users/:id/tokens/:tokenId
  app.delete('/:id/tokens/:tokenId', {
    onRequest: [authenticateUser],
  }, async (request, reply) => {
    const { id, tokenId } = request.params as { id: string; tokenId: string };
    const userId = (request as any).user?.id;
    if (userId !== id) {
      return reply.status(403).send({ success: false, error: 'Forbidden' });
    }
    // TODO: 调用 UserTokenService.deleteToken
    return { success: true };
  });
}
```

- [ ] **Step 2: 注册路由**

- [ ] **Step 3: Commit**

---

#### Task 7: 数据库迁移

**Files:**
- Create: `orion-platform-service/src/db/migrations/050_user_activities.sql`
- Create: `orion-platform-service/src/db/migrations/051_user_api_tokens.sql`
- Create: `orion-platform-service/src/db/migrations/052_user_notification_preferences.sql`
- Create: `orion-platform-service/src/db/migrations/053_user_oauth_bindings.sql`

- [ ] **Step 1: 创建迁移 SQL**

```sql
-- 050_user_activities.sql
CREATE TABLE IF NOT EXISTS user_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_created_at ON user_activities(created_at DESC);
```

```sql
-- 051_user_api_tokens.sql
CREATE TABLE IF NOT EXISTS user_api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_api_tokens_user_id ON user_api_tokens(user_id);
```

```sql
-- 052_user_notification_preferences.sql
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  email_enabled BOOLEAN DEFAULT true,
  in_app_enabled BOOLEAN DEFAULT true,
  webhook_enabled BOOLEAN DEFAULT false,
  webhook_url VARCHAR(500),
  notify_frequency VARCHAR(20) DEFAULT 'realtime',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

```sql
-- 053_user_oauth_bindings.sql
CREATE TABLE IF NOT EXISTS user_oauth_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_user_id VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_user_oauth_bindings_user_id ON user_oauth_bindings(user_id);
```

- [ ] **Step 2: Commit**

---

### 阶段二：前端页面

#### Task 8: 前端用户 API 客户端

**Files:**
- Create: `orion-frontend/src/api/user.ts`

- [ ] **Step 1: 创建 user.ts API 客户端**

```typescript
import request from '@/utils/request';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  avatar?: string;
  phone?: string;
  status: string;
  teams?: UserTeam[];
  permissions?: UserPermission[];
}

export interface UserTeam {
  id: string;
  name: string;
  role: string;
}

export interface UserPermission {
  resource: string;
  actions: string[];
}

export interface UserActivity {
  id: string;
  action: string;
  resourceType?: string;
  details?: Record<string, any>;
  createdAt: string;
}

export interface UserToken {
  id: string;
  name: string;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  webhookEnabled: boolean;
  webhookUrl?: string;
  notifyFrequency: string;
}

export const userApi = {
  getProfile: (userId: string) =>
    request.get(`/api/v1/users/${userId}/profile`),

  updateProfile: (userId: string, data: Partial<UserProfile>) =>
    request.put(`/api/v1/users/${userId}/profile`, data),

  getTeams: (userId: string) =>
    request.get(`/api/v1/users/${userId}/teams`),

  getPermissions: (userId: string) =>
    request.get(`/api/v1/users/${userId}/permissions`),

  getActivities: (userId: string, page = 1, pageSize = 20) =>
    request.get(`/api/v1/users/${userId}/activities`, { params: { page, pageSize } }),

  getTokens: (userId: string) =>
    request.get(`/api/v1/users/${userId}/tokens`),

  createToken: (userId: string, name: string, expiresInDays?: number) =>
    request.post(`/api/v1/users/${userId}/tokens`, { name, expiresInDays }),

  deleteToken: (userId: string, tokenId: string) =>
    request.delete(`/api/v1/users/${userId}/tokens/${tokenId}`),

  getNotificationPreferences: (userId: string) =>
    request.get(`/api/v1/users/${userId}/notifications`),

  updateNotificationPreferences: (userId: string, data: NotificationPreferences) =>
    request.put(`/api/v1/users/${userId}/notifications`, data),

  changePassword: (userId: string, oldPassword: string, newPassword: string) =>
    request.post(`/api/v1/users/${userId}/change-password`, { oldPassword, newPassword }),
};
```

- [ ] **Step 2: Commit**

---

#### Task 9: 个人中心页面

**Files:**
- Create: `orion-frontend/src/pages/UserProfile/index.tsx`

- [ ] **Step 1: 创建个人中心页面**

```typescript
import React, { useEffect, useState } from 'react';
import { Card, Avatar, Tag, Timeline, Spin, Descriptions, Row, Col, Button } from 'antd';
import { UserOutlined, TeamOutlined, SafetyOutlined, HistoryOutlined } from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import { userApi, type UserProfile, type UserActivity, type UserTeam, type UserPermission } from '@/api/user';
import { colors } from '@/tokens/colors';

export const UserProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [profileRes, activitiesRes, teamsRes, permissionsRes] = await Promise.all([
          userApi.getProfile(user.id),
          userApi.getActivities(user.id),
          userApi.getTeams(user.id),
          userApi.getPermissions(user.id),
        ]);
        setProfile(profileRes.data);
        setActivities(activitiesRes.data || []);
        setTeams(teamsRes.data || []);
        setPermissions(permissionsRes.data || []);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div style={{ padding: '0 0 24px' }}>
      <Row gutter={16}>
        <Col span={24}>
          <Card style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <Avatar
                size={80}
                src={profile?.avatar}
                icon={<UserOutlined />}
                style={{ background: `linear-gradient(135deg, ${colors.primary[500]} 0%, ${colors.purple[500]} 100%)` }}
              />
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0 }}>{profile?.username}</h2>
                <p style={{ margin: '8px 0', color: colors.neutral[500] }}>{profile?.email}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Tag color="blue">{profile?.role}</Tag>
                  <Tag color={profile?.status === 'active' ? 'green' : 'default'}>
                    {profile?.status === 'active' ? '正常' : '禁用'}
                  </Tag>
                </div>
              </div>
              <Button type="primary" href="/settings">编辑资料</Button>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card
            title={<><TeamOutlined /> 所属团队</>}
            style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          >
            {teams.length === 0 ? (
              <p style={{ color: colors.neutral[400] }}>暂无团队</p>
            ) : (
              teams.map((team) => (
                <div key={team.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <strong>{team.name}</strong>
                  <Tag style={{ marginLeft: 8 }}>{team.role}</Tag>
                </div>
              ))
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title={<><SafetyOutlined /> 权限矩阵</>}
            style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          >
            {permissions.length === 0 ? (
              <p style={{ color: colors.neutral[400] }}>暂无权限</p>
            ) : (
              permissions.map((perm) => (
                <div key={perm.resource} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <strong>{perm.resource}</strong>
                  <div style={{ marginTop: 4 }}>
                    {perm.actions.map((action) => (
                      <Tag key={action} color="green" style={{ marginRight: 4 }}>{action}</Tag>
                    ))}
                  </div>
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title={<><HistoryOutlined /> 操作日志</>}
        style={{ marginTop: 16, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      >
        <Timeline
          items={activities.map((activity) => ({
            color: 'blue',
            children: (
              <div>
                <div>{activity.action}</div>
                <div style={{ fontSize: 12, color: colors.neutral[400] }}>
                  {new Date(activity.createdAt).toLocaleString('zh-CN')}
                </div>
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  );
};

export default UserProfilePage;
```

- [ ] **Step 2: Commit**

---

#### Task 10: 个人设置页面

**Files:**
- Create: `orion-frontend/src/pages/UserSettings/index.tsx`

- [ ] **Step 1: 创建个人设置页面**

```typescript
import React, { useEffect, useState } from 'react';
import { Tabs, Form, Input, Button, Card, Switch, message, Avatar, Upload, Table, Modal, Row, Col, Select } from 'antd';
import { UserOutlined, LockOutlined, BellOutlined, GithubOutlined, KeyOutlined, UploadOutlined } from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import { userApi, type NotificationPreferences } from '@/api/user';
import { colors } from '@/tokens/colors';

export const UserSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  // 基本资料
  const handleProfileUpdate = async (values: any) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await userApi.updateProfile(user.id, values);
      message.success('资料更新成功');
    } catch (error) {
      message.error('资料更新失败');
    } finally {
      setLoading(false);
    }
  };

  // 修改密码
  const handlePasswordChange = async (values: { oldPassword: string; newPassword: string }) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await userApi.changePassword(user.id, values.oldPassword, values.newPassword);
      message.success('密码修改成功');
      passwordForm.resetFields();
    } catch (error) {
      message.error('密码修改失败');
    } finally {
      setLoading(false);
    }
  };

  const tabItems = [
    {
      key: 'profile',
      label: <><UserOutlined /> 基本资料</>,
      children: (
        <Card style={{ borderRadius: 12, maxWidth: 600 }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleProfileUpdate}
            initialValues={{
              username: user?.username,
              email: user?.email,
              phone: '',
            }}
          >
            <Form.Item label="头像">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Avatar size={64} src={user?.avatar} icon={<UserOutlined />} />
                <Upload showUploadList={false}>
                  <Button icon={<UploadOutlined />}>更换头像</Button>
                </Upload>
              </div>
            </Form.Item>
            <Form.Item name="username" label="显示名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="邮箱">
              <Input disabled />
            </Form.Item>
            <Form.Item name="phone" label="手机号">
              <Input />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>保存</Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'security',
      label: <><LockOutlined /> 安全设置</>,
      children: (
        <Card style={{ borderRadius: 12, maxWidth: 600 }}>
          <Form form={passwordForm} layout="vertical" onFinish={handlePasswordChange}>
            <Form.Item name="oldPassword" label="当前密码" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
            <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 8 }]}>
              <Input.Password />
            </Form.Item>
            <Form.Item name="confirmPassword" label="确认新密码" dependencies={['newPassword']}
              rules={({ getFieldValue }) => ({
                required: true,
                validator: (_, value) => {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              })}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>修改密码</Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'notifications',
      label: <><BellOutlined /> 通知偏好</>,
      children: (
        <Card style={{ borderRadius: 12, maxWidth: 600 }}>
          <Form layout="vertical">
            <Form.Item label="邮件通知">
              <Switch defaultChecked />
            </Form.Item>
            <Form.Item label="站内信">
              <Switch defaultChecked />
            </Form.Item>
            <Form.Item label="Webhook 推送">
              <Switch />
            </Form.Item>
            <Form.Item label="Webhook URL">
              <Input placeholder="https://your-webhook-url" disabled />
            </Form.Item>
            <Form.Item label="通知频率">
              <Select defaultValue="realtime" style={{ width: 200 }}>
                <Select.Option value="realtime">实时</Select.Option>
                <Select.Option value="daily">每日汇总</Select.Option>
                <Select.Option value="weekly">每周汇总</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item>
              <Button type="primary">保存</Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'oauth',
      label: <><GithubOutlined /> 第三方登录</>,
      children: (
        <Card style={{ borderRadius: 12, maxWidth: 600 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Card hoverable style={{ textAlign: 'center' }}>
                <GithubOutlined style={{ fontSize: 32 }} />
                <p>GitHub</p>
                <Button type="link">绑定</Button>
              </Card>
            </Col>
            <Col span={12}>
              <Card hoverable style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 32 }}>🐙</span>
                <p>GitLab</p>
                <Button type="link">绑定</Button>
              </Card>
            </Col>
          </Row>
        </Card>
      ),
    },
    {
      key: 'tokens',
      label: <><KeyOutlined /> API Token</>,
      children: (
        <Card style={{ borderRadius: 12 }}>
          <div style={{ marginBottom: 16 }}>
            <Button type="primary">创建 Token</Button>
          </div>
          <Table
            columns={[
              { title: '名称', dataIndex: 'name', key: 'name' },
              { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt' },
              { title: '过期时间', dataIndex: 'expiresAt', key: 'expiresAt' },
              { title: '操作', key: 'action', render: () => <Button type="link" danger>删除</Button> },
            ]}
            dataSource={[]}
            rowKey="id"
          />
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 0 24px' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
    </div>
  );
};

export default UserSettingsPage;
```

- [ ] **Step 2: Commit**

---

#### Task 11: 路由配置

**Files:**
- Modify: `orion-frontend/src/router/routes.tsx`
- Modify: `orion-frontend/src/components/Layout/index.tsx`

- [ ] **Step 1: 添加路由到 routes.tsx**

在 routes 数组中添加:
```typescript
{
  path: '/profile',
  element: React.lazy(() => import('@/pages/UserProfile')),
  protected: true,
},
{
  path: '/settings',
  element: React.lazy(() => import('@/pages/UserSettings')),
  protected: true,
},
```

- [ ] **Step 2: 更新 Layout 用户菜单点击处理**

在 userMenuItems 的 onClick 中添加:
```typescript
{
  key: 'profile',
  icon: <UserOutlined />,
  label: '个人中心',
  onClick: () => navigate('/profile'),
},
{
  key: 'settings',
  icon: <SettingOutlined />,
  label: '个人设置',
  onClick: () => navigate('/settings'),
},
```

- [ ] **Step 3: Commit**

---

## 验收检查清单

- [ ] 后端 API 端点全部可访问
- [ ] 前端 /profile 页面展示用户档案、团队、权限、日志
- [ ] 前端 /settings 页面 5 个 Tab 可切换
- [ ] 点击 Layout 用户菜单可跳转对应页面
- [ ] 样式符合 Design Token 规范
- [ ] 权限验证正确（用户只能访问自己的数据）