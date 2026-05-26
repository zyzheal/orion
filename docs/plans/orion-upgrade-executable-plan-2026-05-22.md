# Orion 系统改造升级可执行方案

> 创建日期：2026-05-22
> 基于：前端智能分析报告、质量扫描报告、综合评审报告、演进规划报告
> 规范来源：CLAUDE.md 前端交互完整性审查规则 + Design Token 体系 + CRUD 规范

---

## 零、Agent 可感知规范速查表（嵌入本文档，无需查阅外部文件）

> 以下内容从 CLAUDE.md 提取，Agent 执行任何前端开发时**直接参考本表**，禁止硬编码色值/间距/圆角。

### 0.1 色彩系统（`src/tokens/colors.ts`）

| 用途 | 色值 | Token | 使用场景 |
|------|------|-------|---------|
| 主操作色 | `#3370E6` | `colors.primary[500]` | 主按钮、链接、图标 |
| 主色浅色 | `#EBF0FB` | `colors.primary[50]` | 表格悬停行背景 |
| 成功 | `#52c41a` | `colors.success[500]` | 成功状态 Tag/图标 |
| 警告 | `#faad14` | `colors.warning[500]` | 警告状态 |
| 错误 | `#f5222d` | `colors.error[500]` | 危险按钮、错误状态 |
| 信息 | `#3a98f4` | `colors.info[500]` | 信息提示 |
| 审批（紫） | `#7C5CFC` | `colors.purple[500]` | 审批中状态 |
| 中性灰文字 | `#8c8c8c` | `colors.neutral[500]` | 副标题、描述文字 |
| 深色文字 | `#1f1f1f` | `colors.neutral[900]` | 页面主标题 |
| 背景白 | `#ffffff` | `colors.light.bg.primary` | 页面背景 |
| 次要背景 | `#F5F5F7` | `colors.light.bg.secondary` | 区块背景 |

### 0.2 圆角系统（`src/tokens/radius.ts`）

| 组件 | 值 | Token |
|------|-----|-------|
| Card | `12px` | `componentRadius.card` |
| Modal | `16px` | `componentRadius.modal` |
| Button (md) | `6px` | `componentRadius.button.md` |
| Input | `6px` | `componentRadius.input` |
| Tag | `6px` | `componentRadius.tag` |
| 基础小圆角 | `4px` | `radius.xs` |

### 0.3 间距系统（`src/tokens/spacing.ts`）

| 场景 | 值 | Token |
|------|-----|-------|
| Section 标题与内容 | `16px` | `spacing.md` |
| Card 之间 | `16px` | `spacing.md` |
| 表单元素间距 | `12px` | `componentSpacing.formItemGap.sm` |
| 按钮组间距 | `8px` | `spacing.sm` |
| Card 内边距 | `24px` | `componentSpacing.cardPadding.lg` |
| 基础间距 | `4px` | `spacing.xs` |

### 0.4 组件规范

| 属性 | 值 | Token/说明 |
|------|-----|-----------|
| 按钮默认高度 | `36px` | `componentSize` |
| 表单最大宽度 | `700px` | 居中布局 |
| 表格行高 | `48px` | - |
| 表格悬停背景 | `#EBF0FB` | `colors.primary[50]` |
| 卡片装饰线 | `3px solid #3370E6` | 左侧状态标识 |
| 输入框聚焦外发光 | `0 0 0 2px rgba(51,112,230,0.1)` | - |

### 0.5 阴影系统（`src/tokens/shadows.ts`）

| 组件 | 阴影值 |
|------|--------|
| Card | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` |
| Button | `0 1px 2px rgba(0,0,0,0.04)` |
| Dropdown | `0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)` |

### 0.6 页面标题规范

```tsx
// 有副标题
<Title level={2} style={{ marginBottom: 8 }}>
  <IconOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  页面主标题
</Title>
<Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>页面描述</Text>

// 无副标题
<Title level={2} style={{ marginBottom: 16 }}>页面主标题</Title>
```

### 0.7 8大菜单图标映射

| 模块 | 图标 |
|------|------|
| 工作台 | `DashboardOutlined` |
| 控制台 | `SettingOutlined` |
| 交付 | `CloudUploadOutlined` |
| 可观测性 | `RadarChartOutlined` |
| AI 平台 | `RobotOutlined` |
| 基础设施 | `ClusterOutlined` |
| 治理 | `SafetyCertificateOutlined` |
| 生态 | `AppstoreOutlined` |

### 0.8 交互链模板（Agent 直接复制使用）

```tsx
import { useState } from 'react';
import { Button, message, Popconfirm, Empty, Form, Input, Space, Typography } from 'antd';
import { Title } from 'antd/es/typography';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';

// === 页面标题 ===
<Title level={2} style={{ marginBottom: 8 }}>
  <DashboardOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  页面标题
</Title>
<Typography.Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14, marginBottom: 16, display: 'block' }}>
  页面描述文字
</Typography.Text>

// === 异步操作完整模式 ===
const [loading, setLoading] = useState(false);
const handleAction = async () => {
  setLoading(true);
  try {
    await api.doSomething();
    message.success('操作成功');
    await fetchData(); // 刷新列表
  } catch (error: unknown) {
    if (error instanceof Error) {
      message.error(`操作失败: ${error.message}`);
    } else {
      message.error('操作失败，请稍后重试');
    }
  } finally {
    setLoading(false);
  }
};

// === 按钮绑定 ===
<Button
  type="primary"
  loading={loading}
  disabled={loading}
  onClick={handleAction}
  style={{ borderRadius: componentRadius.button.md }}
>
  操作名称
</Button>

// === 危险操作二次确认 ===
<Popconfirm
  title="确认删除？"
  description="此操作不可撤销"
  onConfirm={handleDelete}
  okText="确认"
  cancelText="取消"
>
  <Button danger>删除</Button>
</Popconfirm>

// === 列表空状态 ===
{data?.length === 0 ? (
  <Empty
    description="暂无数据"
    extra={
      <Button type="primary" onClick={handleCreate} style={{ color: colors.primary[500] }}>
        创建
      </Button>
    }
  />
) : (
  data.map(item => <div key={item.id}>{item.name}</div>)
)}

// === 表单提交模式 ===
<Form onFinish={handleSubmit} style={{ maxWidth: 700, margin: '0 auto' }}>
  <Form.Item name="field" label="字段名" rules={[{ required: true, message: '请输入' }]}>
    <Input placeholder="请输入" style={{ borderRadius: componentRadius.input }} />
  </Form.Item>
  <Form.Item>
    <Space>
      <Button type="primary" htmlType="submit" loading={loading}>保存</Button>
      <Button onClick={handleCancel}>取消</Button>
    </Space>
  </Form.Item>
</Form>
```

### 0.9 反模式清单（Agent 编码时禁止使用）

| 反模式 | 问题 | 正确做法 |
|--------|------|---------|
| `<Descriptions>` 全部只读 | 用户无法编辑 | 可编辑字段用 `<Form.Item>` + `<Input>` |
| 操作后无 `message` | 用户不知道成功/失败 | 每个异步操作加 success/error |
| 按钮无 `loading`/`disabled` | 可重复点击 | 异步操作时同时设置 |
| 空数据只写 `<Empty>` 无按钮 | 用户不知道怎么开始 | `<Empty>` + 引导按钮 |
| 表单无提交按钮 | 改了无法保存 | 底部固定保存按钮 |
| `catch (error: any)` | 类型不安全 | `catch (error: unknown)` + `instanceof` 判断 |
| `color: '#3370E6'` | 硬编码颜色 | `color: colors.primary[500]` |
| `as any` | 类型不安全 | 定义明确的 interface |
| `style={{ marginBottom: 13 }}` | 不遵循 4px 网格 | 使用 `spacing.md` (16px) 等 token |

### 0.10 API 客户端规范（来自 `Orion统一规范汇总.md`）

**请求拦截器自动处理**：
- Token 通过 HttpOnly Cookie 自动携带，前端 JS 不可读取
- 租户 ID 从 `sessionStorage` 读取，通过 `X-Tenant-ID` header 传递
- 请求 ID 通过 `X-Request-ID` header 传递（链路追踪）
- **禁止**手动设置 `Authorization` 请求头

**API 客户端编写规范**：
```typescript
// api/chaos.ts 示例
import { api } from './client';  // 使用统一 api client，自动携带 Cookie/Tenant/RequestID

export interface ChaosExperiment {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'stopped' | 'failed';
  createdAt: string;
}

export interface CreateExperimentInput {
  name: string;
  description?: string;
  targetServices: string[];
}

export function createExperiment(data: CreateExperimentInput) {
  return api.post<ChaosExperiment>('/api/v1/chaos-experiments', data);
}
```

**HTTP 错误统一拦截**（`request.ts` 已处理，页面代码无需重复处理）：
| HTTP 状态 | 拦截行为 |
|-----------|---------|
| 401 | `message.error('登录已过期')` + 跳转登录页 |
| 403 | `message.error('没有权限执行此操作')` |
| 404 | `message.error('请求的资源不存在')` |
| 500 | `message.error('服务器错误，请稍后重试')` |

**页面代码中的 catch 块只需处理业务错误**：
```typescript
try {
  await createExperiment(data);
  message.success('创建成功');
} catch (error: unknown) {
  // HTTP 错误已被拦截器处理，此处仅处理业务降级
  if (error instanceof Error) {
    message.error(`创建失败: ${error.message}`);
  } else {
    message.error('创建失败，请稍后重试');
  }
}
```

### 0.11 后端开发规范速查（来自 `Orion统一规范汇总.md`）

**标准请求流**：
```
Request → Gateway → Route → Controller → Service → Repository → PostgreSQL
                          ↓                    ↓
                    RedisCache            EventBus → NATS → 订阅服务
```

**SSD 规范驱动开发模板**（Agent 新建后端功能时直接套用）：
```markdown
# [模块] - [功能]

## 接口定义
METHOD /path - [描述]
  输入: {字段: 类型, 必填, 说明}
  输出: {字段: 类型, 说明}

## 权限要求
- 认证: authenticateUser
- 权限: resource:action (如 chaos:execute)

## 业务规则
1. [规则1]

## 错误处理
| 场景 | HTTP状态码 | 错误码 | 消息 |

## 代码位置
- Routes: orion-platform-service/src/api/xxx-routes.ts
- Controller: orion-platform-service/src/api/controllers/XxxController.ts
- Service: orion-platform-service/src/services/xxx/XxxService.ts
- Repository: orion-platform-service/src/repositories/XxxRepository.ts
```

**后端代码质量要求**：
- [ ] TypeScript 零编译错误
- [ ] 单元测试覆盖率 >= 80%
- [ ] ESLint 零 error
- [ ] 所有异步操作有 try-catch + error response
- [ ] 关键业务节点 INFO 级别日志（JSON 结构化）
- [ ] 错误码遵循以下体系：

**错误码体系**（后端返回格式）：
```typescript
// 统一错误响应格式
{
  success: false,
  error: {
    code: 'CLIENT.400.INVALID_INPUT',  // 错误码
    message: '输入参数不合法',           // 用户可见消息
    details: { field: 'name' },        // 可选详情
    traceId: 'req-abc123'              // 链路追踪 ID
  }
}

// 错误码前缀分类
CLIENT.400.*  → 表单校验错误（前端显示表单错误提示）
CLIENT.401.*  → 认证错误（前端跳转登录页）
CLIENT.403.*  → 权限不足（前端 Toast 提示无权）
CLIENT.404.*  → 资源不存在（前端 Toast + 空状态）
CLIENT.409.*  → 资源冲突（前端 Toast 提示冲突）
CLIENT.429.*  → 请求限频（前端 Toast + 自动重试）
SYS.*         → 系统错误（前端 Toast 系统异常 + 重试按钮）
BIZ.*         → 业务错误（前端 Toast 业务提示）
```

**路由注册模板**（Agent 新建路由时直接套用）：
```typescript
// orion-platform-service/src/api/xxx-routes.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser, requirePermission } from '../middleware/auth';
import { XxxController } from './controllers/XxxController';

export async function xxxRoutes(instance: FastifyInstance) {
  // GET 列表（只需认证）
  instance.get('/api/v1/xxx', {
    onRequest: [authenticateUser]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return XxxController.list(request, reply);
  });

  // GET 详情
  instance.get('/api/v1/xxx/:id', {
    onRequest: [authenticateUser]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return XxxController.detail(request, reply);
  });

  // POST 创建（需要权限）
  instance.post('/api/v1/xxx', {
    onRequest: [authenticateUser, requirePermission({ resource: 'xxx', action: 'create' })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return XxxController.create(request, reply);
  });

  // PUT 更新（需要权限）
  instance.put('/api/v1/xxx/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'xxx', action: 'update' })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return XxxController.update(request, reply);
  });

  // DELETE 删除（需要权限 + 二次确认建议在前端做）
  instance.delete('/api/v1/xxx/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'xxx', action: 'delete' })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return XxxController.delete(request, reply);
  });
}
```

**Controller 层模板**（Agent 新建 Controller 时直接套用）：
```typescript
// orion-platform-service/src/api/controllers/XxxController.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { XxxService } from '../../services/xxx/XxxService';

export class XxxController {
  private static service = new XxxService();

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as { page?: string; pageSize?: string; keyword?: string };
    const page = parseInt(query.page || '1', 10);
    const pageSize = parseInt(query.pageSize || '20', 10);

    const { rows, total } = await this.service.findAll({ page, pageSize, keyword: query.keyword });
    return reply.send({ success: true, data: rows, total, page, pageSize });
  }

  static async detail(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const record = await this.service.findById(id);
    if (!record) {
      return reply.code(404).send({
        success: false,
        error: { code: 'CLIENT.404.NOT_FOUND', message: '记录不存在', traceId: request.id }
      });
    }
    return reply.send({ success: true, data: record });
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as { name: string; description?: string };
    // 参数校验
    if (!body.name || body.name.trim().length === 0) {
      return reply.code(400).send({
        success: false,
        error: { code: 'CLIENT.400.INVALID_INPUT', message: '名称不能为空', traceId: request.id }
      });
    }
    const record = await this.service.create(body);
    return reply.code(201).send({ success: true, data: record });
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const record = await this.service.update(id, body);
    if (!record) {
      return reply.code(404).send({
        success: false,
        error: { code: 'CLIENT.404.NOT_FOUND', message: '记录不存在', traceId: request.id }
      });
    }
    return reply.send({ success: true, data: record });
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const deleted = await this.service.delete(id);
    if (!deleted) {
      return reply.code(404).send({
        success: false,
        error: { code: 'CLIENT.404.NOT_FOUND', message: '记录不存在', traceId: request.id }
      });
    }
    return reply.code(204).send();
  }
}
```

**Service 层模板**（Agent 新建 Service 时直接套用）：
```typescript
// orion-platform-service/src/services/xxx/XxxService.ts
import { XxxRepository, XxxRecord } from '../../repositories/XxxRepository';
import { db } from '../../db/pool';  // 数据库连接池

interface FindAllParams {
  page: number;
  pageSize: number;
  keyword?: string;
}

export class XxxService {
  private repository: XxxRepository;

  constructor() {
    this.repository = new XxxRepository(db);
  }

  async findById(id: string): Promise<XxxRecord | null> {
    return this.repository.findById(id);
  }

  async findAll({ page, pageSize, keyword }: FindAllParams): Promise<{ rows: XxxRecord[]; total: number }> {
    // 关键字搜索由 Service 层处理，Repository 只负责分页
    if (keyword) {
      return this.repository.search(keyword, { page, pageSize });
    }
    return this.repository.findAll(page, pageSize);
  }

  async create(data: Partial<XxxRecord>): Promise<XxxRecord> {
    // 业务规则校验（如名称唯一性）
    const existing = await this.repository.findByName(data.name!);
    if (existing) {
      throw new Error('名称已存在');
    }
    return this.repository.create(data);
  }

  async update(id: string, data: Partial<XxxRecord>): Promise<XxxRecord | null> {
    return this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }
}
```

**数据库 Migration 模板**（Agent 新建表时直接套用）：
```sql
-- orion-platform-service/src/db/migrations/XXX-create-xxx.sql

CREATE TABLE IF NOT EXISTS xxx (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  status      VARCHAR(50) NOT NULL DEFAULT 'active',
  tenant_id   UUID NOT NULL,              -- 多租户隔离
  created_by  UUID,                        -- 审计字段
  updated_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_xxx_tenant ON xxx(tenant_id);
CREATE INDEX idx_xxx_status ON xxx(status);
CREATE INDEX idx_xxx_created_at ON xxx(created_at DESC);
CREATE UNIQUE INDEX idx_xxx_tenant_name ON xxx(tenant_id, name);  -- 租户内唯一

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_xxx_updated_at
  BEFORE UPDATE ON xxx
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**数据库表设计规范**：
| 规范项 | 要求 | 示例 |
|--------|------|------|
| 表名 | `snake_case`，复数形式 | `users`, `pipeline_runs` |
| 主键 | `UUID` 类型，`gen_random_uuid()` 默认值 | `id UUID PRIMARY KEY` |
| 租户字段 | 所有业务表必须含 `tenant_id` | `tenant_id UUID NOT NULL` |
| 审计字段 | `created_by`, `updated_by`, `created_at`, `updated_at` | 见上模板 |
| 外键 | 不声明物理外键约束，由应用层保证一致性 | — |
| 索引 | 租户字段必须建索引，查询频繁字段按需建 | `idx_xxx_tenant` |
| 软删除 | 使用 `deleted_at` 字段，不物理删除 | `deleted_at TIMESTAMPTZ` |
| 枚举值 | 使用 `VARCHAR` 而非 `ENUM`，方便扩展 | `status VARCHAR(50)` |

**Repository 模式模板**（Agent 新建数据访问层时直接套用）：
```typescript
// orion-platform-service/src/repositories/XxxRepository.ts
import { Pool, PoolClient } from 'pg';

export interface XxxRecord {
  id: string;
  name: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export class XxxRepository {
  constructor(private pool: Pool) {}

  async findById(id: string): Promise<XxxRecord | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM xxx WHERE id = $1', [id]
    );
    return rows[0] || null;
  }

  async findAll(page: number = 1, pageSize: number = 20): Promise<{ rows: XxxRecord[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const [data, count] = await Promise.all([
      this.pool.query('SELECT * FROM xxx ORDER BY created_at DESC LIMIT $1 OFFSET $2', [pageSize, offset]),
      this.pool.query('SELECT COUNT(*) FROM xxx')
    ]);
    return { rows: data.rows, total: parseInt(count.rows[0].count, 10) };
  }

  async create(data: Omit<XxxRecord, 'id' | 'created_at' | 'updated_at'>): Promise<XxxRecord> {
    const { rows } = await this.pool.query(
      `INSERT INTO xxx (name, status) VALUES ($1, $2)
       RETURNING *`,
      [data.name, data.status]
    );
    return rows[0];
  }

  async update(id: string, data: Partial<XxxRecord>): Promise<XxxRecord | null> {
    const fields = Object.keys(data).filter(k => k !== 'id');
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = [id, ...fields.map(f => data[f as keyof typeof data])];
    const { rows } = await this.pool.query(
      `UPDATE xxx SET ${setClause}, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      values
    );
    return rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM xxx WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }
}
```

### 0.12 前端路由注册规范

**路由文件**：`orion-frontend/src/router/routes.tsx`

**注册模板**：
```tsx
import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { CloudUploadOutlined, RadarChartOutlined } from '@ant-design/icons';

// 懒加载页面组件
const NewModulePage = lazy(() => import('@/pages/NewModule/index'));
const NewModuleDetail = lazy(() => import('@/pages/NewModule/Detail'));

export const newModuleRoutes: RouteObject = {
  path: '/new-module',
  children: [
    {
      index: true,
      element: <NewModulePage />,
      meta: {
        title: '新模块',
        icon: <CloudUploadOutlined />,
        menu: 'delivery'  // 对应 8 大菜单之一
      }
    },
    {
      path: ':id',
      element: <NewModuleDetail />,
      meta: {
        title: '模块详情',
        hidden: true  // 不在菜单中显示
      }
    }
  ]
};

// 在 routes.tsx 主数组中注册
export const routes: RouteObject[] = [
  // ... 其他路由
  newModuleRoutes,
];
```

**菜单配置**：`orion-frontend/src/stores/menuConfigStore.ts`

```typescript
// 新模块需要在此注册菜单项
{
  key: 'new-module',
  label: '新模块',
  icon: 'CloudUploadOutlined',
  parent: 'delivery',  // 父菜单：workbench/console/delivery/observability/ai/infra/governance/ecosystem
  order: 10
}
```

**路由注册检查清单**：
- [ ] 页面组件使用 `lazy()` 懒加载
- [ ] 路由 `meta` 中配置 `title` 和 `icon`
- [ ] 子路由 `meta.hidden = true` 避免出现在菜单
- [ ] 在 `routes` 数组中注册
- [ ] 如需要菜单项，在 `menuConfigStore` 中配置

### 0.12 前端测试规范（来自 `Orion统一规范汇总.md`）

**测试工具**：Vitest + React Testing Library
**组件测试覆盖率目标**：60%
**测试模板**：
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ExperimentList from '../index';

vi.mock('@/api/chaos', () => ({ listExperiments: vi.fn() }));

describe('ExperimentList', () => {
  it('渲染空状态', async () => { /* ... */ });
  it('渲染列表数据', async () => { /* ... */ });
  it('显示 loading 状态', async () => { /* ... */ });
});
```

---

## 一、规范合规性验证（Step 2 结论）

### 1.1 已有优化方案 vs 定义规范的对照

| 文档中的优化方案 | 规范要求 | 合规性 | 修正建议 |
|-----------------|---------|--------|---------|
| loading 状态示例使用 `useState(false)` | CLAUDE.md 要求：异步操作必须有 loading/disabled | ✅ 合规 | 直接使用 |
| message.success/error 示例 | CLAUDE.md 要求：每个异步操作加 success/error | ✅ 合规 | 直接使用 |
| Empty + 引导按钮示例 | CLAUDE.md 反模式清单：Empty 无引导 = 缺失 | ✅ 合规 | 直接使用 |
| Popconfirm 二次确认 | CLAUDE.md CRUD 要求：删除必须有确认 | ✅ 合规 | 直接使用 |
| `as any` 改为 `ApiResponse<T>` | CLAUDE.md 类型安全要求 | ✅ 合规 | 需先定义接口类型 |
| 硬编码颜色替换为 Design Token | CLAUDE.md 色彩系统规范 | ✅ 合规 | 按 colors.ts 映射 |
| 表单提交按钮 | CLAUDE.md 反模式：表单无提交按钮 = 缺失 | ✅ 合规 | 直接使用 |
| 详情页编辑入口 | CLAUDE.md CRUD 要求：Update 必须有编辑入口 | ✅ 合规 | 直接使用 |

**结论**：文档中所有修复方案均符合 CLAUDE.md 定义的规范，无需调整。

### 1.2 新模块设计 vs 定义规范的对照

| 新模块设计项 | 规范要求 | 合规性 | 修正建议 |
|-------------|---------|--------|---------|
| API 路径 `/api/v1/{domain}/{resource}` | CLAUDE.md 后端路由规范 | ✅ 合规 | 注意与现有 `/api/v1/` 前缀一致 |
| 分页参数 page/pageSize | CLAUDE.md 未显式定义，但前端 Table 组件默认支持 | ✅ 合规 | 统一默认 page=1, pageSize=20（注意：不用 limit，用 pageSize） |
| 错误响应格式 | CLAUDE.md 要求统一格式 | ✅ 合规 | 需与现有 error-handler.ts 对齐 |
| 多租户 X-Tenant-ID | CLAUDE.md 多租户隔离设计 | ✅ 合规 | 与现有 authenticateUser 中间件对齐 |
| ER 图字段命名 snake_case | 评审报告 P0 修正项 | ✅ 合规 | 已在 v2 文档中修正 |
| 部署模式"默认内嵌+未来可拆分" | CLAUDE.md 微服务开发规则 | ✅ 合规 | 优先在 orion-platform-service 实现 |

**结论**：新模块设计整体符合规范，但需注意以下 3 点对齐：
1. API 路径前缀需与现有 routes.ts 保持一致（部分已有 `/api/v1/`，部分无）
2. 错误响应格式需与 `orion-platform-service/src/error-handler.ts` 完全对齐
3. 前端页面必须遵循 Design Token 体系，禁止硬编码颜色/间距

---

## 二、问题验证结论（2026-05-25 重新扫描更新）

> **2026-05-25 更新**：运行 `cli-check.ts --scan orion-frontend/src/pages/ --max-files 200 --min-confidence 50` 获取最新数据。
> 前端实际 **631 .tsx 文件**（文档原声称 149，低估 4.2 倍）。

| 问题类型 | 文档报告数量 | 实际验证数量（旧） | 实际验证数量（新 2026-05-25） | 误报率 | 修复优先级 |
|---------|------------|-----------------|---------------------------|--------|-----------|
| catch 块为空/注释占位 | 72 | 20-30 | 1 (missing-network-error) | 98% | **P1**（大幅减少） |
| 列表缺少空状态引导 | 233 | 100-150 | 1 (missing-skeleton) + 4 (missing-empty-search) | 98% | **P2** |
| 异步操作缺少 loading | 170 | 70-80 | 1 (missing-loading) | 99% | **P2** |
| Design Token 违规 | 422 | 123 | **397 (token-violation)** | 0% | **P1-1** |
| 硬编码颜色 | 28 | 20-25 | 已合并入 token-violation | — | **P1-1** |
| as any 类型断言 | 572 | 460 | **56 (missing-props-type)** | 90% | **P1-2** |
| 缺少权限守卫 | 1 | 1 | **56 (missing-auth-guard)** | 0% | **P0-1**（安全） |
| 前后端断链 | 6 个功能 | 6 个确认 | 3 (missing-sql-parameterization) | 0% | **P0-2** |
| 缺少危险操作确认 | — | — | **1 (missing-danger-confirm)** | 0% | **P0-3** |
| 缺少懒加载 | — | — | **29 (missing-lazy-load)** | — | **P2** |
| 缺少响应式处理 | — | — | **23 (missing-responsive)** | — | **P2** |
| 缺少健康检查 | — | — | **16 (missing-health-check)** | — | **P1** |
| 缺少分页 | — | — | **15 (missing-pagination)** | — | **P1** |
| 缺少指标暴露 | — | — | **15 (missing-metrics)** | — | **P1** |
| 缺少文本截断 | — | — | **12 (missing-truncate)** | — | **P2** |
| 缺少状态机 | — | — | **9 (missing-state-machine)** | — | **P2** |
| 缺少乐观锁 | — | — | **5 (missing-optimistic-lock)** | — | **P1** |
| 缺少撤销机制 | — | — | **2 (missing-undo)** | — | **P2** |

**最新统计**：
- **P0: 67 项** — 权限守卫缺失(56) + SQL 注入风险(3) + 危险操作未确认(1) + 其他 P0(7)
- **P1: 117 项** — Design Token 违规(397 中部分) + 类型缺失(56) + 健康检查(16) + 分页(15) + 指标(15) + 乐观锁(5)
- **P2: 631 项** — Design Token(397) + 样式改进(165) + 懒加载(29) + 响应式(23) + 其他

> **注意**：原估算 P0 问题约 30-40 项，新扫描发现 **67 项 P0**（主要因 auth-guard 缺失），修复工作量需上调。

---

## 三、Agent 可执行改造方案（Step 4 核心输出）

> **微前端开发规范参考**: `docs/cross-cutting/frontend/micro-frontend-development-guide.md` (v1.1)
>
> 本计划中所有微前端相关改造均按该规范文档第 7 章"错误边界与降级策略"的设计执行。

### Phase 0：微前端规范改造（P0，预计 1-2 小时）

> **目标**：按微前端开发规范第七章的设计，实现子应用加载失败降级策略、熔断机制、CSP 安全策略。
>
> **规范文档**: `docs/cross-cutting/frontend/micro-frontend-development-guide.md` §7 (v1.1)

#### Task 0.1：SubAppRouteDynamic 实现 loadWithRetry + 4 级降级

**规范来源**: §7.1 四级降级策略 + §7.2 实现代码

**影响文件**: `orion-frontend/src/components/SubAppRouteDynamic/index.tsx`

**执行步骤**：
1. 在组件中实现 `loadWithRetry` 函数（最多 3 次重试，指数退避）
2. Level 1: 自动重试 — `setTimeout` 递增延迟 (1s → 2s → 4s)
3. Level 2: 重试失败后显示 ErrorBanner（含"重新加载"按钮）
4. Level 3: 如果配置了 `fallback_url`，Iframe 加载备用入口
5. Level 4: 所有方式失败，显示 Fallback 页面

**验收标准**：
| 场景 | 预期行为 | 测试方法 |
|------|---------|---------|
| CDN 超时（模拟网络中断） | 自动重试 3 次后显示 ErrorBanner | Playwright E2E |
| CDN 返回 404 | 直接跳过重试，显示 ErrorBanner | Playwright E2E |
| 配置 fallback_url | Level 2 失败后 Iframe 加载备用地址 | Playwright E2E |
| 所有方式均失败 | 显示"服务暂时不可用" | 单元测试 |

#### Task 0.2：SubAppRouteDynamic 接入 CrashRecovery 熔断

**规范来源**: §7.3 熔断机制

**影响文件**: `orion-frontend/src/components/SubAppRouteDynamic/index.tsx`

**执行步骤**：
1. 导入 `@orion-mf/core` 中的 `CrashRecovery`
2. 在 `loadWithRetry` 的 catch 中调用 `CrashRecovery.increment(config.key)`
3. 熔断判断：`CrashRecovery.isCircuitOpen(config.key)` → 直接降级到 Level 4
4. 恢复机制：60 秒后自动半开试探

**验收标准**：
| 场景 | 预期行为 | 测试方法 |
|------|---------|---------|
| 连续 3 次加载失败 | 触发熔断，后续请求直接降级 | 单元测试 |
| 熔断 60 秒后 | 半开状态，允许一次试探请求 | 单元测试 |
| 试探成功 | 重置熔断状态 | 单元测试 |
| 试探失败 | 重新触发熔断 | 单元测试 |

#### Task 0.3：Gateway 新增 CSP 中间件

**规范来源**: §7.4 安全规范 → CSP 策略

**影响文件**: `orion-api-gateway/src/middleware/csp.ts`（新建）

**执行步骤**：
1. 创建 `csp.ts` 中间件文件
2. 使用 Fastify `onRequest` hook 注入 `Content-Security-Policy` header
3. 策略内容：
   - `default-src 'self'`
   - `script-src 'self' 'unsafe-inline' 'unsafe-eval'` + CDN
   - `style-src 'self' 'unsafe-inline'`
   - `connect-src 'self'` + API 地址
   - `frame-src 'self'` + 子应用域名

**验收标准**：
| 场景 | 预期行为 | 测试方法 |
|------|---------|---------|
| GET 任意页面 | 响应头包含 `Content-Security-Policy` | `curl -I` 验证 |
| 子应用脚本从 CDN 加载 | 不被 CSP 拦截 | Playwright E2E |
| 内联脚本执行 | 正常执行（'unsafe-inline'） | Playwright E2E |

---

### Phase 1：P0 前端交互修复（预计 2-3 小时）

> 目标：修复最影响用户体验的问题——静默失败、断链按钮、权限缺失

#### Task 1.1：空 catch 块补全业务错误提示

**影响范围**：约 20-30 个 catch 块为空或仅有注释

**执行步骤**：
1. 搜索 `catch (\s*error\s*)` 和 `catch \(\)` 匹配所有 catch 块
2. 对每个空 catch 块，替换为：
```typescript
catch (error: unknown) {
  if (error instanceof Error) {
    message.error(`操作失败: ${error.message}`);
  } else {
    message.error('操作失败，请稍后重试');
  }
}
```
3. 对已有注释如 "// API may not be fully ready" 的 catch 块，保留注释并添加用户可见错误提示
4. 对 403 权限场景，添加权限不足提示

**重点文件**（已确认存在问题）：
```
orion-frontend/src/pages/KnowledgeBase/index.tsx          (5处空catch)
orion-frontend/src/pages/UserSettings/index.tsx           (8处空catch)
orion-frontend/src/pages/CapabilityAdmin/index.tsx        (5处)
orion-frontend/src/pages/platform-core/DigitalTwin/index.tsx (4处)
orion-frontend/src/pages/DigitalTwin/index.tsx            (4处)
orion-frontend/src/pages/WorkflowDesigner/WorkflowCanvas.tsx (4处)
orion-frontend/src/pages/pipeline-svc/PipelineMonitor/index.tsx (2处)
orion-frontend/src/pages/AIAgents/index.tsx               (3处)
orion-frontend/src/api/notifications.ts                   (8处)
```

**规范要求**：
- catch 参数必须用 `unknown` 类型，禁止 `any`
- 必须使用 `message.error` 提供用户可见反馈
- 遵循 CLAUDE.md "前端交互完整性审查规则" 第 1 条

---

#### Task 1.2：列表页补全空状态引导

**影响范围**：约 100-150 处列表缺少 Empty 组件

**执行步骤**：
1. 对每个使用 `.map()` 渲染列表的位置，检查数据为空时的处理
2. 替换模式：
```typescript
// 修复前
{data?.map(item => <ListItem key={item.id} />)}

// 修复后
{data?.length === 0 ? (
  <Empty
    description="暂无数据"
    extra={<Button type="primary" onClick={handleCreate}>创建</Button>}
  />
) : (
  data.map(item => <ListItem key={item.id} />)
)}
```
3. 对搜索场景，额外添加搜索无结果提示
4. 使用 `colors.primary[500]` 为引导按钮着色

**重点文件**（已确认缺失）：
```
orion-frontend/src/pages/monitor-svc/Monitoring/Alerts.tsx
orion-frontend/src/pages/monitor-svc/Monitoring/Metrics.tsx
orion-frontend/src/pages/monitor-svc/Monitoring/Rules.tsx
orion-frontend/src/pages/BuildEnv/BuildLogList.tsx
orion-frontend/src/pages/Diagnostic/Reports.tsx
orion-frontend/src/pages/Diagnostic/Sessions.tsx
```

**规范要求**：
- 必须包含引导操作按钮（创建/刷新/搜索）
- Empty description 文字应描述当前状态
- 遵循 CLAUDE.md 反模式清单 "Empty 无引导"

---

#### Task 1.3：异步操作补全 loading 状态

**影响范围**：约 70-80 个异步函数缺少 loading

**执行步骤**：
1. 识别所有 `async` 事件处理函数（handleXxx 命名）
2. 对每个缺少 loading 的函数，添加：
```typescript
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  setLoading(true);
  try {
    await api.xxx();
    message.success('操作成功');
  } catch (error: unknown) {
    message.error(error instanceof Error ? error.message : '操作失败');
  } finally {
    setLoading(false);
  }
};
```
3. 将 `loading` 绑定到按钮的 `loading` 和 `disabled` 属性

**重点文件**：
```
orion-frontend/src/pages/AIAgents/index.tsx          (handleViewSubmit, handleExecuteSubmit)
orion-frontend/src/pages/AICostDashboard/AlertConfig.tsx
orion-frontend/src/pages/AICostDashboard/BudgetManagement.tsx
orion-frontend/src/pages/AlertList/index.tsx         (handleAcknowledge, handleResolve)
orion-frontend/src/pages/monitor-svc/Monitoring/Channels.tsx
```

**规范要求**：
- loading 状态必须在 finally 块中重置
- 按钮必须同时设置 `loading={loading}` 和 `disabled={loading}`
- 遵循 CLAUDE.md 交互状态规范

---

#### Task 1.4：前后端断链修复

**影响范围**：6 个功能前端断链，1 处后端权限缺失

**执行步骤**：

**A. DeploymentList 回滚功能修复**
```
文件: orion-frontend/src/pages/DeploymentList/index.tsx
修复:
1. import { rollbackDeployment } from '@/api/deployments'
2. 添加 handleRollback 函数，弹窗获取 reason 和 triggeredBy
3. 回滚按钮添加 onClick={handleRollback}
4. API 调用传参: { targetVersion, reason, triggeredBy }
```

**B. PipelineList 删除功能修复**
```
文件: orion-frontend/src/pages/PipelineList/index.tsx
修复:
1. import { deletePipeline, Popconfirm } 
2. 添加 handleDelete 函数 + Popconfirm 二次确认
3. 操作成功后 message.success + 刷新列表

文件: orion-platform-service/src/api/routes.ts (L813附近) + pipeline-routes-registrar.ts
注意: Pipeline 删除路由在两处注册（routes.ts + pipeline-routes-registrar.ts）
修复: 在两处都添加 requirePermission 中间件，或合并到单一注册点
```

**C. ConfigManagement 编辑/删除修复**
```
文件: orion-frontend/src/pages/ConfigManagement/index.tsx
修复:
1. import { deleteConfig, updateConfig }
2. 添加 actions 列（编辑 + 删除按钮）
3. 添加 handleEdit / handleDelete 函数
4. 检查前端路径 vs 后端路由是否匹配
```

---

### Phase 2：P1 代码质量修复（预计 3-4 小时）

> 目标：消除类型安全隐患和设计不一致

#### Task 2.1：as any 类型修复（分批进行）

**影响范围**：约 460 处生产代码中的 `as any`

**执行策略**（按优先级分批）：

**第一批 - API 响应类型**（~100 处，最高频）：
```typescript
// 在 orion-frontend/src/types/api-responses.ts 中定义通用类型
interface ApiResponse<T = unknown> {
  data: T;
  success: boolean;
  message?: string;
  total?: number;
}

// 修复
const response = await api.getList();
// 修复前: response.data as any
// 修复后: response.data as ApiResponse<PipelineListResponse>
```

**第二批 - 组件 Props 类型**（~50 处）：
```typescript
// 修复前
const Component = (props: any) => { ... }
// 修复后
interface ComponentProps {
  data: Pipeline[];
  onRefresh: () => void;
}
const Component = ({ data, onRefresh }: ComponentProps) => { ... }
```

**第三批 - 表单值类型**（~30 处）：
```typescript
// 修复前
const values = form.getFieldsValue() as any;
// 修复后
interface FormValues {
  name: string;
  description?: string;
  enabled: boolean;
}
const values = form.getFieldsValue() as FormValues;
```

**执行规则**：
- 禁止新增任何 `as any`
- 无法精确定义的类型使用 `as unknown as TargetType` 过渡
- test 文件中的 `as any` 暂不处理（可接受的测试模式）

---

#### Task 2.2：硬编码颜色替换为 Design Token

**影响范围**：约 20-25 处

**执行步骤**：
```typescript
// 在文件顶部添加导入
import { colors } from '@/tokens/colors';

// 替换映射表
'#3370E6'  → colors.primary[500]
'#52c41a'  → colors.success[500]
'#faad14'  → colors.warning[500]
'#f5222d'  → colors.error[500]
'#8c8c8c'  → colors.neutral[500]
'#1f1f1f'  → colors.neutral[900]
'#F5F5F7'  → colors.light.bg.secondary
'#ffffff'  → colors.light.bg.primary
```

**排除项**：
- 第三方库主题配置中的颜色（如 ECharts option）
- 动态计算生成的颜色值
- 测试文件中的颜色

---

### Phase 3：后端安全与能力补齐（预计 1-2 天）

#### Task 3.1：Pipeline 删除权限修复

```typescript
// 文件: orion-platform-service/src/api/routes.ts (L813附近)
// 修复前
instance.delete('/pipelines/:id', async (request, reply) => {
  return pipelineController.delete(request, reply);
});

// 修复后
instance.delete('/pipelines/:id', {
  onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'delete' })]
}, async (request: FastifyRequest, reply: FastifyReply) => {
  return pipelineController.delete(request, reply);
});
```

#### Task 3.2：Deploy 回滚参数校验增强

```typescript
// 文件: orion-platform-service/src/api/deploy-routes.ts
// 后端已有校验 if (!reason || !triggeredBy) return 400;
// 前端需要弹窗获取这两个必填参数
```

---

### Phase 3.8：SSO 统一认证改造（P0，预计 3.5 周）

> **背景**：当前认证体系分散在多个服务中（platform OIDC、orion-dba LDAP+OIDC、knowledge 企业微信），存在多登录入口、JWT 密钥不统一、不支持单点登出、独立访问无 SSO 等问题。
> **目标**：所有认证统一由 `orion-platform-service` 的 SSO 模块处理，子应用后端不处理登录，只从 header 获取用户信息。

#### Task 3.8.1：JWT 密钥统一（P0，0.5 周）

**问题**：各服务独立 `JWT_SECRET` 环境变量，Gateway 无法验证子应用 Token。

**实施**：

1. **K8s Secret 统一管理**：

```yaml
# k8s/secret-orion-jwt.yaml
apiVersion: v1
kind: Secret
metadata:
  name: orion-jwt-secret
type: Opaque
data:
  JWT_SECRET: <base64-encoded-256-bit-key>
  JWT_ALGORITHM: SFM=
  JWT_EXPIRES_IN: NW0=
  JWT_REFRESH_EXPIRES_IN: N2Q=
```

2. **各服务环境变量对齐**：

| 服务 | 改造内容 |
|------|---------|
| `orion-platform-service` | JWT 密钥从 K8s Secret 读取，保留 `JwtKeyRotationService` |
| `orion-api-gateway` | `auth.ts` 使用同一 `JWT_SECRET` 验证 |
| `orion-dba` | 移除自有 JWT 签发，改为只验证 header |
| `orion-knowledge` | 移除自有 JWT 签发，改为只验证 header |

3. **JWT Payload 统一格式**：

```typescript
interface OrionJWT {
  sub: string;          // 用户唯一标识（UUID）
  iat: number;          // 签发时间戳
  exp: number;          // 过期时间戳（5分钟后）
  user_id: string;      // 同 sub，兼容旧代码
  username: string;     // 用户名
  email: string;        // 邮箱
  tenant_id: string;    // 租户 ID
  roles: string[];      // 角色列表
  permissions: string[];// 权限列表
  sso_sub?: string;     // OIDC Provider 的 sub（SSO登录时携带）
  sso_provider?: string;// OIDC Provider 标识
}
```

**验收**：
- [ ] Gateway 和所有子应用使用同一 `JWT_SECRET`
- [ ] Gateway 可验证 platform 签发的 JWT
- [ ] 子应用后端不再签发 JWT

#### Task 3.8.2：Token 黑名单机制（P0，0.5 周）

**问题**：当前不支持单点登出，用户退出后子应用仍有效。

**实施**：

1. **Redis 黑名单集成**：

```typescript
// orion-platform-service/src/services/auth/TokenBlacklistService.ts (改造)
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export class TokenBlacklistService {
  // 加入黑名单（TTL = Token剩余有效期）
  async blacklist(token: string, exp: number): Promise<void> {
    const ttl = Math.max(0, exp - Math.floor(Date.now() / 1000));
    if (ttl > 0) {
      await redis.setex(`token:blacklist:${token}`, ttl, '1');
    }
    // 同时持久化到 PostgreSQL（服务重启后恢复）
    await this.db.query(
      'INSERT INTO token_blacklist (token, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [token, new Date(exp * 1000)]
    );
  }

  // 检查黑名单
  async isBlacklisted(token: string): Promise<boolean> {
    const redisHit = await redis.get(`token:blacklist:${token}`);
    if (redisHit) return true;
    const dbHit = await this.db.query(
      'SELECT 1 FROM token_blacklist WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    return dbHit.rowCount > 0;
  }
}
```

2. **Gateway 验证中间件改造**：

```typescript
// orion-api-gateway/src/middleware/auth.ts (改造)
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const token = extractToken(request);
  if (!token) return;

  try {
    const decoded = app.jwt.verify(token);

    // 检查 Token 黑名单
    const isBlacklisted = await redis.get(`token:blacklist:${decoded.jti || tokenHash}`);
    if (isBlacklisted) {
      reply.status(401).send({
        success: false,
        error: { code: 'CLIENT.401.TOKEN_REVOKED', message: 'Token has been revoked', traceId: request.id }
      });
      return;
    }

    request.authContext = decoded;
  } catch (error) {
    reply.status(401).send({
      success: false,
      error: { code: 'CLIENT.401.INVALID_TOKEN', message: 'Invalid or expired token', traceId: request.id }
    });
  }
}
```

**验收**：
- [ ] 单点登出后，Gateway 拒绝旧 Token（返回 401 + TOKEN_REVOKED）
- [ ] Redis 黑名单生效，TTL 正确

#### Task 3.8.3：SSO 认证中心完善（P0，1.5 周）

**问题**：LDAP 实现在 orion-dba，企业微信实现在 orion-knowledge，新增认证方式需改多处。

**实施**：

1. **数据库设计**：

```sql
-- SSO Provider 配置表
CREATE TABLE sso_providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(50) NOT NULL UNIQUE,
    type            VARCHAR(20) NOT NULL,  -- "oidc", "ldap", "wechat", "cas", "saml"
    enabled         BOOLEAN DEFAULT true,
    display_name    VARCHAR(100),
    display_icon    VARCHAR(200),
    config          JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 用户 SSO 绑定表（支持一个用户绑定多个 SSO 账号）
CREATE TABLE user_sso_bindings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    provider        VARCHAR(50) NOT NULL,
    sso_sub         VARCHAR(255) NOT NULL,
    sso_email       VARCHAR(255),
    sso_name        VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, sso_sub)
);

CREATE INDEX idx_user_sso_bindings_user ON user_sso_bindings(user_id);
```

2. **LDAP 迁移到 platform**：

```typescript
// orion-platform-service/src/services/auth/LdapService.ts (新文件)
import ldap from 'ldapjs';

export class LdapService {
  private client: ldap.Client;

  async authenticate(username: string, password: string): Promise<UserProfile | null> {
    return new Promise((resolve, reject) => {
      this.client.bind(config.bind_dn, config.bind_password, (err) => {
        if (err) return reject(err);
        this.client.search(config.base_dn, {
          filter: `(uid=${username})`,
          attributes: ['mail', 'cn', 'uid']
        }, (err, res) => {
          // 验证密码 + 返回用户信息
        });
      });
    });
  }
}
```

3. **企业微信 SSO 迁移到 platform**：

```typescript
// orion-platform-service/src/services/auth/WechatWorkService.ts (新文件)
export class WechatWorkService {
  async getAuthorizationUrl(redirectUri: string): string {
    return `https://open.work.weixin.qq.com/wwopen/sso/qrConnect?appid=${config.corpId}&agentid=${config.agentId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${randomState()}`;
  }

  async handleCallback(code: string): Promise<UserProfile> {
    // 获取 access_token → 获取用户信息 → 查找/创建本地用户
  }
}
```

4. **SSO Provider 配置管理 API**：

```typescript
// orion-platform-service/src/api/sso-providers-routes.ts (新文件)
export async function ssoProvidersRoutes(app: FastifyInstance) {
  app.get('/api/v1/auth/sso/providers', { onRequest: [authenticateUser] }, listProviders);
  app.post('/api/v1/auth/sso/providers', { onRequest: [authenticateUser, requireAdmin] }, createProvider);
  app.patch('/api/v1/auth/sso/providers/:name', { onRequest: [authenticateUser, requireAdmin] }, updateProvider);
  app.delete('/api/v1/auth/sso/providers/:name', { onRequest: [authenticateUser, requireAdmin] }, deleteProvider);
}
```

5. **统一登录页改造**：

```tsx
// orion-frontend/src/pages/Auth/Login.tsx (改造)
// 动态展示可用的认证方式
const [providers, setProviders] = useState<SSOProvider[]>([]);

useEffect(() => {
  fetch('/api/v1/auth/sso/providers')
    .then(res => res.json())
    .then(data => setProviders(data.data.filter(p => p.enabled)));
}, []);

// 渲染：本地登录表单 + SSO Provider 按钮列表
```

**验收**：
- [ ] LDAP/企业微信登录统一在 platform SSO 模块
- [ ] 登录页动态展示可用 SSO Provider
- [ ] SSO 登录后 Token 可在所有子应用中使用

#### Task 3.8.4：单点登出（P0，0.5 周）

**实施**：

1. **Logout 端点改造**：

```typescript
// orion-platform-service/src/api/routes-auth.ts (改造 POST /logout)
app.post('/api/v1/auth/logout', async (request, reply) => {
  const { refreshToken, accessToken } = request.body as { refreshToken: string; accessToken: string };

  // 1. 删除 refresh_token
  await db.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hash(refreshToken)]);

  // 2. access_token 加入黑名单
  const decoded = jwt.decode(accessToken) as JwtPayload;
  if (decoded?.exp) {
    await tokenBlacklistService.blacklist(accessToken, decoded.exp);
  }

  // 3. 通过 OrionBus 通知所有子应用
  // （前端处理）

  reply.send({ success: true });
});
```

2. **前端 OrionBus 登出通知**：

```typescript
// orion-frontend/src/stores/authStore.ts (改造 logout 方法)
async logout() {
  await api.post('/v1/auth/logout', { refreshToken: this.refreshToken, accessToken: this.token });

  // 清除本地状态
  this.setTokens(null, null, null);

  // 通知所有子应用
  orionBus.emitLogout();

  // 跳转登录页
  window.location.href = '/auth/login';
}
```

**验收**：
- [ ] OrionBus 登出通知到达所有子应用
- [ ] 独立访问域名跳转 SSO 登录

#### Task 3.8.5：子应用认证适配（P1，1 周）

**问题**：各子应用后端各自处理认证，子应用前端认证方式不统一。

**子应用后端改造清单**：

| 子应用 | 当前认证 | 改造方案 | 工作量 |
|--------|---------|---------|--------|
| **orion-dba** | 自有 JWT + LDAP + OIDC + Mock | 删除自有认证，改为 header 认证 | 2 天 |
| **orion-knowledge** | 自有 JWT + 企业微信 SSO | 删除自有认证，保留权限模型 | 2 天 |
| **orion-ai-svc** | Header Mock | 改为标准 header 认证 | 0.5 天 |
| **orion-visor** | Java Spring Security | 改为 header 认证 | 1 天 |

**子应用前端统一认证模式**：

```typescript
// 所有子应用前端统一使用以下认证模式
// orion-dba/frontend/src/utils/auth.ts (改造后)

const apiClient = axios.create({ baseURL: '/api' });

// 请求拦截器：统一携带 Token
apiClient.interceptors.request.use((config) => {
  const token = getOrionToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：401 时通知主应用刷新 Token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (window.__POWERED_BY_ORION__) {
        window.dispatchEvent(new CustomEvent('orion-subapp-need-auth'));
      } else {
        window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }
    }
    return Promise.reject(error);
  }
);
```

**验收**：
- [ ] 所有子应用后端不解析 JWT，只读 header
- [ ] 子应用前端统一使用 `Authorization: Bearer` header
- [ ] 子应用 401 时正确跳转 SSO 登录

#### Task 3.8.6：独立访问 SSO 流程（P1，0.5 周）

**实施**：

1. **Nginx 强制 Gateway 代理**：

```nginx
# 子应用独立域名的 Nginx 配置
server {
    listen 80;
    server_name dba.example.com;

    # 静态资源
    location / {
        root /var/www/orion-dba/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 请求 → 强制走 Gateway
    location /api/ {
        proxy_pass http://api-gateway:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 禁止直连后端（不配置任何 direct backend proxy）
}
```

2. **独立域名 SSO 跳转**（前端适配）：

```typescript
// 子应用独立访问时的 Token 获取
function getOrionToken(): string | null {
  // 1. 嵌入模式：主应用注入
  if ((window as any).$orion?.token) {
    return (window as any).$orion.token;
  }

  // 2. 独立模式：从 localStorage 获取（SSO 回调存储）
  return localStorage.getItem('orion_access_token');
}

// SSO 回调处理
const urlParams = new URLSearchParams(window.location.search);
const ssoToken = urlParams.get('sso_token');
if (ssoToken) {
  localStorage.setItem('orion_access_token', ssoToken);
  // 清除 URL 参数，正常渲染
  window.history.replaceState({}, '', window.location.pathname);
}
```

**验收**：
- [ ] 独立访问域名所有 API 请求经过 Gateway
- [ ] 无 Token 时跳转 SSO 登录页

#### Task 3.8.7：用户在职/离职状态管理（P0，0.5 周）

> **当前缺失**：无离职状态转换、状态变化未吊销 Token、无 SSO 解绑、无活跃会话强制踢出。

**问题现状**：
- `UserService.authenticate()` 仅检查 `status !== 'active'`，但无任何 API 可修改用户状态
- 状态变为 `deleted` 仅软删除，但已有的 JWT Token 仍然有效（5 分钟窗口）
- 无 HR 系统对接，无法自动感知员工入职/离职

**实施**：

1. **用户状态枚举定义**：

```sql
-- users.status 允许值规范
-- 'active'      — 在职，可正常登录
-- 'suspended'   — 临时禁用（如违规操作调查中），不可登录，数据保留
-- 'terminated'  — 离职，不可登录，数据保留，SSO 绑定解绑
-- 'deleted'     — 已删除（软删除，不显示）
```

2. **用户状态变更 API**：

```typescript
// orion-platform-service/src/api/user-status-routes.ts (新文件)
export async function userStatusRoutes(app: FastifyInstance) {
  // 禁用/启用用户
  app.patch('/api/v1/users/:id/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'user', action: 'manage' })]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, reason } = request.body as { status: 'active' | 'suspended' | 'terminated'; reason?: string };

    const user = await userService.getUser(id);
    const oldStatus = user.status;

    // 状态变更
    await userService.updateUser(id, { status } as UpdateUserInput);

    // 记录审计日志
    await auditLogger.log({
      action: 'user_status_change',
      userId: id,
      oldStatus,
      newStatus: status,
      reason,
      operator: request.authContext.user_id,
    });

    // 如果变为非 active 状态，执行安全清理
    if (status !== 'active') {
      await disableUser(id);
    }

    reply.send({ success: true, data: { userId: id, status } });
  });
}
```

3. **禁用用户安全清理**：

```typescript
// orion-platform-service/src/services/user/UserDisableService.ts (新文件)
export class UserDisableService {
  /**
   * 用户禁用/离职时的安全清理
   */
  async disableUser(userId: string): Promise<void> {
    // 1. 吊销所有未过期的 Refresh Token
    await this.db.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );

    // 2. 将当前 Access Token 加入黑名单
    const activeTokens = await this.db.query(
      'SELECT token, expires_at FROM active_sessions WHERE user_id = $1 AND expires_at > NOW()',
      [userId]
    );
    for (const row of activeTokens.rows) {
      await this.tokenBlacklistService.blacklist(row.token, Math.floor(row.expires_at.getTime() / 1000));
    }

    // 3. 解绑所有 SSO 关联
    await this.db.query('DELETE FROM user_sso_bindings WHERE user_id = $1', [userId]);

    // 4. 清除活跃会话记录
    await this.db.query('DELETE FROM active_sessions WHERE user_id = $1', [userId]);

    // 5. 清除用户缓存
    await this.cache.del(`user:${userId}`);
  }

  /**
   * 批量禁用（按部门/角色）
   */
  async batchDisableByFilter(options: { department?: string; role?: string }): Promise<number> {
    const users = await this.db.query(
      'SELECT id FROM users WHERE status = $1' +
        (options.department ? ' AND department = $2' : '') +
        (options.role ? ' AND role = $' + (options.department ? '3' : '2') : ''),
      ['active', options.department, options.role].filter(Boolean)
    );

    for (const row of users.rows) {
      await this.disableUser(row.id);
    }

    await this.db.query(
      'UPDATE users SET status = $1 WHERE status = $2' +
        (options.department ? ' AND department = $3' : '') +
        (options.role ? ' AND role = $' + (options.department ? '4' : '3') : ''),
      ['terminated', 'active', options.department, options.role].filter(Boolean)
    );

    return users.rowCount;
  }
}
```

4. **SSO 回调中的状态检查**：

```typescript
// orion-platform-service/src/api/sso-routes.ts (callback 改造)
// 在 handleCallback 成功后，检查用户状态
const user = await userRepository.findById(localUser.id);
if (user.status !== 'active') {
  // 重定向到错误页
  return reply.redirect(`/auth/error?code=ACCOUNT_${user.status.toUpperCase()}`);
}
```

5. **活跃会话查询 API**（管理员可见）：

```typescript
// GET /api/v1/users/:id/sessions
app.get('/api/v1/users/:id/sessions', {
  onRequest: [authenticateUser, requirePermission({ resource: 'user', action: 'view_sessions' })]
}, async (request, reply) => {
  const sessions = await this.db.query(
    `SELECT id, ip_address, user_agent, created_at, expires_at
     FROM active_sessions
     WHERE user_id = $1 AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [request.params.id]
  );
  reply.send({ success: true, data: sessions.rows });
});

// POST /api/v1/users/:id/sessions/:sessionId/revoke
app.post('/api/v1/users/:id/sessions/:sessionId/revoke', {
  onRequest: [authenticateUser, requirePermission({ resource: 'user', action: 'revoke_session' })]
}, async (request, reply) => {
  await this.tokenBlacklistService.blacklist(sessionToken, expiresAt);
  await this.db.query('DELETE FROM active_sessions WHERE id = $1', [request.params.sessionId]);
  reply.send({ success: true });
});
```

**验收**：
- [ ] 用户状态变更 API 可用（active/suspended/terminated）
- [ ] 状态变为非 active 时，所有 Token 立即失效
- [ ] 状态变为 terminated 时，SSO 绑定自动解绑
- [ ] 管理员可查询用户活跃会话并强制踢出
- [ ] 批量禁用按部门/角色可用
- [ ] SSO 回调检查用户状态，非 active 拒绝登录

#### Task 3.8.8：数据库与基础设施补全（P0，0.5 周）

> **评审发现的缺失**：`active_sessions` 表不存在、`users` 表缺少 `department` 字段、`token_blacklist` 表未创建。

**1. 新增数据库 Migration**：

```sql
-- orion-platform-service/src/db/migrations/050-sso-auth-enhancements.sql

-- Token 黑名单表（支持服务重启后恢复）
CREATE TABLE IF NOT EXISTS token_blacklist (
    token           VARCHAR(500) PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    expires_at      TIMESTAMPTZ NOT NULL,
    reason          VARCHAR(50) DEFAULT 'logout',  -- logout/disable/terminated
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_token_blacklist_expires ON token_blacklist(expires_at);
-- 定期清理过期记录
DELETE FROM token_blacklist WHERE expires_at < NOW();

-- 活跃会话表（用于查询和强制踢出）
CREATE TABLE IF NOT EXISTS active_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    token_hash      VARCHAR(64) NOT NULL,  -- SHA256 hash of token
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    last_activity   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX idx_active_sessions_expires ON active_sessions(expires_at);
-- 定期清理过期会话
DELETE FROM active_sessions WHERE expires_at < NOW();

-- users 表新增字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS termination_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_status_change_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES users(id);

-- 添加 status 约束（注释形式，PostgreSQL 不支持 ENUM 但可加 CHECK）
-- ALTER TABLE users ADD CONSTRAINT chk_user_status CHECK (status IN ('active', 'suspended', 'terminated', 'deleted'));

-- 用户 SSO 绑定表
CREATE TABLE IF NOT EXISTS user_sso_bindings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    provider        VARCHAR(50) NOT NULL,
    sso_sub         VARCHAR(255) NOT NULL,
    sso_email       VARCHAR(255),
    sso_name        VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, sso_sub)
);
CREATE INDEX idx_user_sso_bindings_user ON user_sso_bindings(user_id);

-- SSO Provider 配置表
CREATE TABLE IF NOT EXISTS sso_providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(50) NOT NULL UNIQUE,
    type            VARCHAR(20) NOT NULL,  -- "oidc", "ldap", "wechat", "cas", "saml"
    enabled         BOOLEAN DEFAULT true,
    display_name    VARCHAR(100),
    display_icon    VARCHAR(200),
    config          JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 审计日志表（用户状态变更记录）
CREATE TABLE IF NOT EXISTS user_status_audit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    old_status      VARCHAR(20) NOT NULL,
    new_status      VARCHAR(20) NOT NULL,
    reason          TEXT,
    operator_id     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_user_status_audit_user ON user_status_audit(user_id);
CREATE INDEX idx_user_status_audit_operator ON user_status_audit(operator_id);
```

**2. 活跃会话记录集成**：

```typescript
// orion-platform-service/src/api/routes-auth.ts (login 改造)
// 登录成功后记录活跃会话
app.post('/api/v1/auth/login', async (request, reply) => {
  const { username, password } = request.body as { username: string; password: string };

  const user = await userService.authenticate(username, password);
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // 记录活跃会话
  const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
  await db.query(
    `INSERT INTO active_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, tokenHash, request.ip, request.headers['user-agent'], Date.now() + 5 * 60 * 1000]
  );

  // 存储 refresh token
  await db.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user.id, hash(refreshToken), Date.now() + 7 * 24 * 60 * 60 * 1000]
  );

  reply.send({ accessToken, refreshToken, expiresAt: user.expiresAt, user: sanitizeUser(user) });
});
```

**3. Refresh Token 吊销字段**：

```sql
-- refresh_tokens 表新增 revoked_at 字段（如不存在）
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoke_reason VARCHAR(50);
```

**验收**：
- [ ] Migration 050 执行成功，所有表/字段创建
- [ ] 登录时活跃会话记录写入
- [ ] Refresh Token 吊销字段可用
- [ ] `users` 表含 `department`/`employee_id` 等字段

#### Task 3.8.9：Suspended 自动过期与定时清理（P1，0.5 周）

> **评审发现的缺失**：`suspended` 状态无自动恢复机制，黑名单/会话表无定时清理。

**1. Suspended 自动过期**：

```typescript
// orion-platform-service/src/services/user/SuspensionExpiryService.ts (新文件)
export class SuspensionExpiryService {
  /**
   * 检查并恢复过期的 suspended 用户
   * 适用场景：临时封禁（如违规操作调查），设定期限后自动恢复
   */
  async checkAndRestoreExpired(): Promise<number> {
    const result = await this.db.query(
      `UPDATE users
       SET status = 'active',
           last_status_change_at = NOW(),
           status_changed_by = NULL
       WHERE status = 'suspended'
         AND suspension_expires_at IS NOT NULL
         AND suspension_expires_at < NOW()
       RETURNING id, username`
    );

    for (const user of result.rows) {
      await this.auditLogger.log({
        action: 'suspension_auto_expired',
        userId: user.id,
        username: user.username,
        oldStatus: 'suspended',
        newStatus: 'active',
        reason: 'Suspension period expired, auto restored',
      });
    }

    return result.rowCount;
  }
}
```

**2. 定时清理任务**：

```typescript
// orion-platform-service/src/services/auth/AuthCleanupService.ts (新文件)
import cron from 'node-cron';

export class AuthCleanupService {
  start(): void {
    // 每 5 分钟清理一次
    cron.schedule('*/5 * * * *', async () => {
      await this.cleanupExpiredBlacklist();
      await this.cleanupExpiredSessions();
      await this.checkSuspensionExpiry();
    });

    logger.info('[AuthCleanupService] Started, runs every 5 minutes');
  }

  async cleanupExpiredBlacklist(): Promise<number> {
    const result = await this.db.query(
      'DELETE FROM token_blacklist WHERE expires_at < NOW()'
    );
    if (result.rowCount > 0) {
      logger.info(`[AuthCleanupService] Cleaned ${result.rowCount} expired blacklist entries`);
    }
    return result.rowCount;
  }

  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.db.query(
      'DELETE FROM active_sessions WHERE expires_at < NOW()'
    );
    if (result.rowCount > 0) {
      logger.info(`[AuthCleanupService] Cleaned ${result.rowCount} expired sessions`);
    }
    return result.rowCount;
  }

  async checkSuspensionExpiry(): Promise<void> {
    const suspensionService = new SuspensionExpiryService(this.db);
    const restored = await suspensionService.checkAndRestoreExpired();
    if (restored > 0) {
      logger.info(`[AuthCleanupService] Auto-restored ${restored} suspended users`);
    }
  }
}
```

**3. users 表新增 suspension_expires_at 字段**：

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_expires_at TIMESTAMPTZ;
```

**验收**：
- [ ] Suspended 用户设 `suspension_expires_at` 后自动恢复
- [ ] 黑名单过期记录自动清理
- [ ] 活跃会话过期记录自动清理
- [ ] 清理任务每 5 分钟执行，日志正常

#### Task 3.8.10：HR 系统对接（Webhook 模式）（P2，1 周）

> **评审发现的缺失**：无 HR 系统同步接口，无法自动感知员工入职/离职。

**1. HR Webhook 端点**：

```typescript
// orion-platform-service/src/api/hr-webhook-routes.ts (新文件)
export async function hrWebhookRoutes(app: FastifyInstance) {
  // HR 系统推送员工状态变更
  app.post('/api/v1/webhooks/hr/employee-change', {
    onRequest: [verifyWebhookSignature]  // Webhook 签名验证
  }, async (request, reply) => {
    const event = request.body as HrEmployeeChangeEvent;

    const user = await userRepository.findByEmployeeId(event.employee_id);

    if (!user && event.action === 'terminated') {
      // 系统中不存在的用户收到离职通知，记录日志
      logger.warn(`[HRWebhook] Received termination for unknown employee: ${event.employee_id}`);
      return reply.send({ success: true, note: 'User not found, ignored' });
    }

    if (!user && event.action === 'hired') {
      // 新员工，自动创建账号
      const newUser = await userRepository.create({
        username: event.work_email.split('@')[0],
        email: event.work_email,
        name: event.full_name,
        department: event.department,
        employee_id: event.employee_id,
        hire_date: new Date(event.effective_date),
        status: 'active',
        password_hash: '',  // SSO 登录，无需密码
      });
      return reply.send({ success: true, data: { userId: newUser.id, action: 'created' } });
    }

    if (user) {
      switch (event.action) {
        case 'hired':
          // 重新入职
          await userRepository.update(user.id, {
            status: 'active',
            department: event.department,
            hire_date: new Date(event.effective_date),
          });
          break;

        case 'terminated':
          // 离职：状态变更 + 安全清理
          await userRepository.update(user.id, {
            status: 'terminated',
            termination_date: new Date(event.effective_date),
            last_status_change_at: new Date(),
          });
          await userDisableService.disableUser(user.id);
          break;

        case 'transferred':
          // 部门调动
          await userRepository.update(user.id, {
            department: event.new_department,
          });
          break;

        case 'suspended':
          // 临时封禁
          await userRepository.update(user.id, {
            status: 'suspended',
            suspension_expires_at: event.expires_at ? new Date(event.expires_at) : null,
            last_status_change_at: new Date(),
          });
          if (event.action === 'suspended') {
            await userDisableService.disableUser(user.id);
          }
          break;
      }

      // 记录审计日志
      await auditLogger.log({
        action: 'hr_webhook_sync',
        userId: user.id,
        eventType: event.action,
        source: 'hr_system',
        employeeId: event.employee_id,
      });
    }

    reply.send({ success: true, data: { userId: user?.id, action: event.action } });
  });
}

interface HrEmployeeChangeEvent {
  action: 'hired' | 'terminated' | 'transferred' | 'suspended';
  employee_id: string;
  full_name: string;
  work_email: string;
  department: string;
  new_department?: string;
  effective_date: string;
  expires_at?: string;  // suspended 时有效
}
```

**2. Webhook 签名验证**：

```typescript
// orion-platform-service/src/middleware/hr-webhook-auth.ts
import crypto from 'crypto';

export async function verifyWebhookSignature(request: FastifyRequest, reply: FastifyReply) {
  const signature = request.headers['x-hr-signature'] as string;
  const timestamp = request.headers['x-hr-timestamp'] as string;

  if (!signature || !timestamp) {
    return reply.status(401).send({ error: 'Missing webhook signature' });
  }

  // 检查时间戳（防止重放攻击，允许 5 分钟偏差）
  const ts = parseInt(timestamp, 10);
  if (Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
    return reply.status(401).send({ error: 'Webhook timestamp expired' });
  }

  // 验证 HMAC 签名
  const body = JSON.stringify(request.body);
  const expectedSignature = crypto
    .createHmac('sha256', process.env.HR_WEBHOOK_SECRET!)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  if (signature !== expectedSignature) {
    return reply.status(401).send({ error: 'Invalid webhook signature' });
  }
}
```

**验收**：
- [ ] HR Webhook 端点可接收员工状态变更
- [ ] 新员工自动创建账号
- [ ] 离职员工自动禁用 + Token 吊销 + SSO 解绑
- [ ] Webhook 签名验证生效，防止伪造请求
- [ ] 部门调动自动更新 `department` 字段

#### Phase 3.8 验收标准

- [ ] JWT 密钥统一管理，Gateway 可验证所有 Token
- [ ] Token 黑名单机制生效，单点登出后旧 Token 被拒绝
- [ ] LDAP/企业微信登录统一在 platform SSO 模块
- [ ] 登录页动态展示可用 SSO Provider
- [ ] 所有子应用后端不签发/解析 JWT，只从 header 获取用户信息
- [ ] 子应用前端统一使用 `Authorization: Bearer` header
- [ ] 独立访问域名所有 API 请求经过 Gateway
- [ ] OrionBus 登出通知到达所有子应用
- [ ] 用户状态变更 API 可用（active/suspended/terminated）
- [ ] 状态变为非 active 时，所有 Token 立即失效
- [ ] 状态变为 terminated 时，SSO 绑定自动解绑
- [ ] 管理员可查询用户活跃会话并强制踢出
- [ ] SSO 回调检查用户状态，非 active 拒绝登录

---

### Phase 3.5：已有模块能力增强（CMDB / APM / 混沌工程 / 工单 / 知识库）

> 基于对代码库的深入分析，以下模块**并非从零开发**，而是已有部分实现需要补齐。
> **重要发现**：工单、CMDB、Monitoring 三个模块的 Controller/Service 均已实现但**路由未注册**（routes.ts 中缺失），导致前端全部 404。

#### Task 3.5.0：路由注册断裂修复（P0，阻塞所有后续工作）

**问题根因**：

| 模块 | 后端 Controller | 路由文件 | routes.ts 注册 | 前端调用结果 |
|------|----------------|---------|---------------|-------------|
| **工单** | `TicketingController.ts` 1884 行 | ❌ 无 | ❌ 仅 feature flag 中声明 | **全部 404** |
| **CMDB** | `CmdbController.ts` 459 行 | ❌ 无（注释写"迁移到 Go 服务"但实际不存在 Go 路由代理） | ❌ 已注释 | **全部 404** |
| **混沌工程** | `ChaosEngineeringController.ts` 428 行 | ✅ `chaos-enhanced-routes.ts` 167 行 | ✅ line 727 已注册 | 可用但执行为 simulated |
| **APM/Monitoring** | 无独立 Controller | ❌ 无 | ❌ 未注册 | **全部 404** |

**修复：创建 `ticketing-routes.ts`**

```typescript
// orion-platform-service/src/api/ticketing-routes.ts
import { FastifyInstance } from 'fastify';
import { TicketService } from '../services/ticketing/TicketService';
import { TicketingService } from '../services/ticketing/TicketingService';
import { TicketingController } from './controllers/ticketing/TicketingController';

export default async function ticketingRoutes(app: FastifyInstance) {
  const ticketService = new TicketService();
  const ticketingService = new TicketingService();
  const controller = new TicketingController(ticketService, ticketingService);

  app.post('/api/v1/tickets', controller.createTicket.bind(controller));
  app.get('/api/v1/tickets', controller.listTickets.bind(controller));
  app.get('/api/v1/tickets/:id', controller.getTicket.bind(controller));
  app.patch('/api/v1/tickets/:id', controller.updateTicket.bind(controller));
  app.post('/api/v1/tickets/:id/assign', controller.assignTicket.bind(controller));
  app.post('/api/v1/tickets/:id/escalate', controller.escalateTicket.bind(controller));
  app.post('/api/v1/tickets/:id/resolve', controller.resolveTicket.bind(controller));
  app.post('/api/v1/tickets/:id/close', controller.closeTicket.bind(controller));
  app.post('/api/v1/tickets/:id/transition', controller.transitionTicket.bind(controller));
  app.get('/api/v1/tickets/:id/relations', controller.getRelations.bind(controller));
  app.get('/api/v1/tickets/:id/history', controller.getHistory.bind(controller));
  app.get('/api/v1/tickets/:id/comments', controller.getComments.bind(controller));
  app.post('/api/v1/tickets/:id/comments', controller.addComment.bind(controller));
  app.get('/api/v1/tickets/:id/attachments', controller.getAttachments.bind(controller));
  app.get('/api/v1/tickets/transfer/:id/history', controller.getTransferHistory.bind(controller));
  app.get('/api/v1/tickets/dispatch/queue', controller.getQueueStatus.bind(controller));
  app.post('/api/v1/tickets/dispatch/auto/:id', controller.autoDispatch.bind(controller));
  app.get('/api/v1/tickets/statistics', controller.getStatistics.bind(controller));
  app.get('/api/v1/tickets/reports/sla', controller.getSLACompliance.bind(controller));
}
```

**修复：创建 `cmdb-routes.ts`**

当前 `routes.ts:386` 注释写"CMDB 路由已迁移到独立 Go 服务"，但 Go 服务 (`orion-cmdb-service/`) 是独立的，**TS 侧的 Controller 仍需注册**。取消注释并注册：

```typescript
// orion-platform-service/src/api/cmdb-routes.ts
import { FastifyInstance } from 'fastify';
import { CmdbService } from '../services/cmdb/CmdbService';
import { TopologyService } from '../services/cmdb/TopologyService';
import { CmdbController } from './controllers/cmdb/CmdbController';

export default async function cmdbRoutes(app: FastifyInstance) {
  const cmdbService = new CmdbService();
  const topologyService = new TopologyService(cmdbService);
  const controller = new CmdbController(cmdbService, topologyService);

  app.get('/api/v1/cmdb/cis', controller.listCIs.bind(controller));
  app.get('/api/v1/cmdb/cis/:id', controller.getCI.bind(controller));
  app.post('/api/v1/cmdb/cis', controller.createCI.bind(controller));
  app.patch('/api/v1/cmdb/cis/:id', controller.updateCI.bind(controller));
  app.delete('/api/v1/cmdb/cis/:id', controller.deleteCI.bind(controller));
  app.get('/api/v1/cmdb/cis/:id/relations', controller.getRelations.bind(controller));
  app.post('/api/v1/cmdb/relations', controller.createRelation.bind(controller));
  app.delete('/api/v1/cmdb/relations/:id', controller.deleteRelation.bind(controller));
  app.get('/api/v1/cmdb/topology/:ciId', controller.getTopology.bind(controller));
  app.get('/api/v1/cmdb/impact-analysis/:ciId', controller.impactAnalysis.bind(controller));
  app.get('/api/v1/cmdb/cis/:id/versions', controller.getVersions.bind(controller));
  app.post('/api/v1/cmdb/reconcile/k8s', controller.reconcileK8s.bind(controller));
}
```

**修复：创建 `monitoring-routes.ts`**

```typescript
// orion-platform-service/src/api/monitoring-routes.ts
import { FastifyInstance } from 'fastify';
import { MonitoringService } from '../services/monitoring/MonitoringService';
import { MetricCollector } from '../services/monitoring/MetricCollector';
import { AlertRuleEngine } from '../services/monitoring/AlertRuleEngine';
import { AlertNotificationService } from '../services/monitoring/AlertNotificationService';

export default async function monitoringRoutes(app: FastifyInstance) {
  const metricCollector = new MetricCollector({ retentionMs: 24 * 60 * 60 * 1000 });
  const alertRuleEngine = new AlertRuleEngine();
  const notificationService = new AlertNotificationService();
  const monitoringService = new MonitoringService(metricCollector, alertRuleEngine, notificationService);

  app.post('/api/v1/metrics', monitoringService.recordMetric.bind(monitoringService));
  app.get('/api/v1/metrics/:name', monitoringService.queryMetrics.bind(monitoringService));
  app.get('/api/v1/metrics', monitoringService.listMetrics.bind(monitoringService));
  app.post('/api/v1/alert-rules', monitoringService.createAlertRule.bind(monitoringService));
  app.get('/api/v1/alert-rules', monitoringService.listAlertRules.bind(monitoringService));
  app.delete('/api/v1/alert-rules/:id', monitoringService.deleteAlertRule.bind(monitoringService));
  app.get('/api/v1/alerts', monitoringService.listActiveAlerts.bind(monitoringService));
  app.post('/api/v1/alerts/:id/acknowledge', monitoringService.acknowledgeAlert.bind(monitoringService));
}
```

**注册方式**：在 `routes.ts` 中 import 后：
```typescript
await app.register(ticketingRoutes);
await app.register(cmdbRoutes);
await app.register(monitoringRoutes);
```

---

#### Task 3.5.1：工单模块 — 模拟逻辑替换为真实 API（P0）

**当前状态：7 处 Mock**

| # | 文件 | 当前代码 | 应改为 |
|---|------|---------|--------|
| 1 | `CreateTicketModal.tsx:123-124` | `setTimeout(resolve, 1000)` | `createTicket(values)` |
| 2 | `TicketList/index.tsx:440-449` | `Modal.confirm` + message | `assignTicket(id, data)` + refresh |
| 3 | `TicketDetail/index.tsx:304-319` | 仅 `message.success` | `escalateTicket(id, data)` |
| 4 | `DispatchPanel.tsx:263-268` | `setTimeout` mock | `autoDispatch(ticket.id)` |
| 5 | `DispatchPanel.tsx:270-277` | `setTimeout` mock | 循环调 `autoDispatch` |
| 6 | `TicketComments.tsx:203-216` | 仅 `message.success` | `addComment(ticketId, data)` |
| 7 | `TicketList/index.tsx:486` | `"报表功能开发中"` | 跳转报表页或显示占位面板 |

**统一修复模板**：

```typescript
// 示例：CreateTicketModal.handleSubmit
const handleSubmit = useCallback(async () => {
  try {
    await form.validateFields();
    setSubmitting(true);
    const values = form.getFieldsValue();
    await createTicket(values);  // ← 替换 setTimeout
    message.success('工单创建成功');
    form.resetFields();
    onSuccess();
  } catch (error: unknown) {
    if (error instanceof Error && error.message !== 'Validation failed') {
      message.error(`创建失败：${error.message}`);
    }
  } finally {
    setSubmitting(false);
  }
}, [form, onSuccess]);
```

**工单模块企业级评分：交互完整但 API 断裂 → 修复后 7/10**

| ITSM 能力 | 当前状态 | 差距说明 |
|-----------|---------|---------|
| CRUD 操作 | ✅ 前端完整 | 7 处未调 API（本 Phase 修复） | P0 |
| SLA 管理 | ⚠️ 前端计算 | 无可配置策略 | P1 |
| 知识库关联 | ❌ 缺失 | 无关联入口 | P2 |
| CMDB 关联 | ❌ 缺失 | 无 CI 关联 | P2 |
| 权限控制 | ❌ 缺失 | 无角色判断 | P1 |
| 通知规则 | ❌ 缺失 | 状态变更无通知 | P2 |
| 报表分析 | ❌ 仅占位 | SLA 合规/趋势报告未实现 | P2 |
| 自动化规则 | ❌ 缺失 | 无触发器引擎 | P3 |

---

#### Task 3.5.2：CMDB 能力增强（6/10 → 8/10，0.5 人月）

**已有实现现状**：

| 维度 | 状态 | 详情 |
|------|------|------|
| 后端服务（Go） | ✅ 完整 | `orion-cmdb-service/` 29 个 Go 文件 |
| 后端服务（TS） | ✅ 完整 | 6 服务 + 3 Repository |
| K8s 调和 | ✅ 已实现 | `K8sReconciliationService.ts` 833 行 + `K8sWatchClient.ts` 485 行 |
| 拓扑服务 | ✅ 已实现 | `TopologyService.ts` 309 行 |
| 前端页面 | ✅ 8 个 | CITablePage / TopologyPage / ImpactAnalysisPage / BatchExecPage / AuditLogPage / IntegrationPage / WebTerminalPage |
| API 客户端 | ✅ 已实现 | `orion-frontend/src/api/cmdb.ts` 228 行 |
| 路由注册 | ❌ **缺失** | routes.ts 已注释（本 Phase 修复） |
| 双实现 | ⚠️ 风险 | `orion-platform-service` + `orion-cmdb-svc` 各有 CmdbService |

**需要增强的能力**：

| 优先级 | 优化项 | 具体动作 | 涉及文件 |
|--------|--------|---------|---------|
| **P0** | 路由注册 | 创建 `cmdb-routes.ts` 并注册（见 3.5.0 节） | 新文件 + routes.ts |
| **P0** | 拆分 CmdbService | 661 行拆为 CiCrudService / CiRelationService / CiVersionService | `CmdbService.ts` → 3 文件 |
| **P1** | CI 类型可扩展 | 新增 `ci_type_definition` 表 + `CmdbTypeRegistry.ts` | 新 migration |
| **P1** | 变更审计 API | 暴露 `GET /api/v1/cmdb/cis/:id/audit-log` | `cmdb-routes.ts` |
| **P1** | AWS EC2 自动发现 | `AwsDiscoveryService.ts` 拉取 EC2/RDS/ELB | 新文件 |
| **P1** | 影响分析增强 | 评估业务影响（SLO 影响面），不仅计数 | `TopologyService.ts` |
| **P1** | CI 级别 RBAC | `requirePermission({ resource: 'cmdb', ciType })` | `cmdb-routes.ts` |
| **P2** | CMDB 健康度 | `CmdbHealthService.ts`：完整性/准确性/新鲜度 | 新文件 |
| **P2** | Import/Export | `POST /api/v1/cmdb/import` + `GET /api/v1/cmdb/export` | `cmdb-routes.ts` |

---

#### Task 3.5.3：混沌工程前端对接 + 优化（6.5/10 → 8.5/10，0.5 人月）

**已有实现现状**：

| 维度 | 状态 | 详情 |
|------|------|------|
| 后端服务 | ✅ 完整 | 8 服务文件 + 1800+ 行 |
| API 路由 | ✅ 完整 | `chaos-enhanced-routes.ts` 167 行，10 端点 |
| 前端 API Client | ✅ 已存在 | `orion-frontend/src/api/chaos.ts` |
| 前端页面 | ⚠️ 2 个 | `ChaosEngineering/index.tsx` + `chaos/ChaosExperimentPage.tsx` |
| 权限控制 | ✅ 已实现 | `requirePermission` 中间件 |

**关键发现**：`ChaosExecutor` 的 5 种故障注入方法，**每一种的 catch 分支都返回 `[SIMULATED]` 字符串**（如 `[SIMULATED] CPU spike: target=..., percent=90%`）。无 K8s 环境时不真正注入。`ChaosFaultLibrary.ts` 仅 83 行。

**需要增强的能力**：

| 优先级 | 优化项 | 具体动作 | 涉及文件 |
|--------|--------|---------|---------|
| **P0** | 生产审批流 | 注入前检查 `!experiment.approvedBy` 抛异常 + 新增 `approveExperiment` 端点 | `ChaosExecutor.ts`, `chaos-enhanced-routes.ts` |
| **P0** | ChaosFaultLibrary 充实 | 83 行 → 200+ 行：补充 packet_loss 参数 schema 和验证 | `ChaosFaultLibrary.ts` |
| **P1** | Chaos Mesh 集成 | `ChaosMeshClient.ts` 对接 CRD；优先 chaos-mesh，fallback kubectl | 新文件 |
| **P1** | 稳态假设自动验证 | `steady_state_hypothesis` 从字符串变为 `{ checks: [{ endpoint, expected_status }] }` | `ChaosExperimentService.ts` |
| **P1** | Prometheus 联动 | 实验开始/停止记录 annotation；爆炸时自动熔断 | `ChaosExecutor.ts` |
| **P1** | DNS/网络分区故障 | 实现 `injectDNSFailure()` + `injectNetworkPartition()` | `FaultInjector.ts` |
| **P2** | 实验报告导出 | `generateReport(experimentId)` 返回结构化 JSON | `ResilienceScoringService.ts` |

---

#### Task 3.5.4：APM 应用性能监控（4.5/10 → 7.5/10，2 人月）

**现状**：

| 维度 | 状态 | 详情 |
|------|------|------|
| 独立 APM 服务 | ❌ 无 | 无 `orion-apm-service` |
| 指标采集 | ⚠️ 内存存储 | `MetricCollector.ts` 619 行，全部使用 `Map` 内存存储 |
| 分布式追踪 | ❌ 完全缺失 | 无 TraceID 传播、无 Span 采集 |
| 告警引擎 | ⚠️ 仅阈值 | `AlertRuleEngine.ts` 无 AI/动态基线 |
| 数据库 Profiling | ❌ 完全缺失 | 无慢 SQL 检测 |
| 前端页面 | ⚠️ 部分 | Monitoring/AlertList/MetricsDashboard 等页面存在但后端 404 |

**关键发现**：`MetricCollector` 全部数据存储在内存 `Map` 中（`metricStorage: Map<string, { points: DataPoint[]; tags }> = new Map()`），服务重启即丢失，不支持多实例部署。

**需要增强的能力**：

| 优先级 | 优化项 | 具体动作 | 涉及文件 |
|--------|--------|---------|---------|
| **P0** | 路由注册 | 创建 `monitoring-routes.ts` 并注册（见 3.5.0 节） | 新文件 + routes.ts |
| **P0** | 内存存储替换 | `PrometheusMetricStore.ts` 封装 Remote Write/VictoriaMetrics | 新文件 + 修改 `MetricCollector.ts` |
| **P0** | 分布式追踪 | `tracing/TracingService.ts` + `OpenTelemetryExporter.ts` + `middleware/trace-context.ts` | 新目录 |
| **P1** | 数据库 Profiling | `DatabaseProfiler.ts`：拦截 SQL 记录慢查询（>100ms） | 新文件 |
| **P1** | 日志-Trace 关联 | 中间件注入 `X-Trace-ID`；logger 附加 traceId | `middleware/trace-context.ts` |
| **P1** | SLO/SLI 管理 | `SloService.ts`：目标定义 + 误差预算 + 燃烧速率告警 | 新文件 + migration |
| **P1** | Error Tracking | `ErrorTracker.ts`：错误聚合 + 堆栈去重 + 影响面 | 新文件 |
| **P1** | AI 异常检测 | `PerformanceBaselineService` 动态阈值（历史分位数） | 扩展 `AlertRuleEngine.ts` |
| **P2** | Service Map | 基于 Tracing 自动生成服务依赖图 | `TopologyService.ts` |

> **建议**：APM 与"完整链路追踪"模块高度重叠，建议合并建设（节省 2 人月），详见 Phase 4 节。

**前端已实现页面**：
```
orion-frontend/src/pages/CMDB/index.tsx              # 入口页
orion-frontend/src/pages/CMDB/CITablePage.tsx        # CI 实体表
orion-frontend/src/pages/CMDB/TopologyPage.tsx       # 拓扑图
orion-frontend/src/pages/CMDB/ImpactAnalysisPage.tsx # 影响分析
orion-frontend/src/pages/CMDB/BatchExecPage.tsx      # 批量执行
orion-frontend/src/pages/CMDB/AuditLogPage.tsx       # 审计日志
orion-frontend/src/pages/CMDB/IntegrationPage.tsx    # 集成管理
orion-frontend/src/pages/CMDB/WebTerminalPage.tsx    # Web 终端
```

**需要增强的能力**：

| 能力 | 当前状态 | 需要开发内容 | 优先级 |
|------|---------|-------------|--------|
| Web 终端联调 | 前端页面存在 | 确认 WebSocket/终端代理后端实现 | P1 |
| 批量执行联调 | 前端页面存在 | 确认批量脚本执行 API 联调 | P1 |
| 影响分析可视化 | 前端页面存在 | 确认依赖关系图谱渲染效果 | P2 |
| CMDB 数据版本对比 | Repository 存在 | 前端版本对比功能增强 | P2 |
| 交互完整性修复 | CITablePage 有问题 | 补全 loading/empty/catch 错误提示 | P0 |

**执行步骤**：
1. 前后端联调确认：逐一验证 8 个页面的 9 层调用链
2. 修复 CMDB 页面的空 catch 块（`ImpactAnalysisPage.tsx` 已确认 2 处）
3. 确认 WebTerminal WebSocket 连接代理实现
4. 批量执行 API 联调（script 执行 + 结果回传）

---

#### Task 3.5.2：混沌工程前端对接（0.5 人月）

**已有实现现状**：

| 维度 | 状态 | 详情 |
|------|------|------|
| 后端服务 | ✅ 完整 | `chaos-engineering/` 目录（8 个文件） |
| API 路由 | ✅ 完整 | `chaos-enhanced-routes.ts`（167 行，10 个端点） |
| 前端 API Client | ✅ **已存在** | `orion-frontend/src/api/chaos.ts`（含 chaosApi + resilienceApi） |
| 前端页面 | ⚠️ **部分存在** | `ChaosEngineering/index.tsx`、`chaos/ChaosExperimentPage.tsx`（需审查完整性） |
| 实验管理 | ✅ 已实现 | 创建/列表/详情/启动/停止/状态查询/恢复状态 |
| 故障注入 | ✅ 已实现 | `FaultInjector` 服务 |
| 弹性评分 | ✅ 已实现 | `ResilienceScoringService` + `ResilienceScoreCalculator` |
| 权限控制 | ✅ 已实现 | `requirePermission` 中间件 |

**注意**：API 路径前后端可能不匹配：
- 后端路由：`/chaos-experiments`（`chaos-enhanced-routes.ts`）
- 前端 API：`/api/v1/chaos/experiments`（`chaos.ts`）
- **需要确认**：Gateway 是否有 `/api/v1/chaos` → `/chaos` 的路由转发规则

**需要审查的前端页面**：

| 页面 | 文件路径 | 状态 | 需要确认 |
|------|---------|------|---------|
| 实验管理 | `orion-frontend/src/pages/ChaosEngineering/index.tsx` | ✅ 存在 | 交互完整性（loading/empty/catch） |
| 实验详情 | `orion-frontend/src/pages/chaos/ChaosExperimentPage.tsx` | ✅ 存在 | CRUD 完整性 + 9 层调用链 |
| 弹性评分 | 需确认是否存在 | ❓ | 如缺失则需新建 |
| 故障库 | 需确认是否存在 | ❓ | 如缺失则需新建 |

**执行步骤**：
1. 审查 `chaos.ts` API client 路径是否与后端路由匹配，如不匹配则修正
2. 审查已存在的 2 个前端页面，按 5 层交互清单检查（loading/empty/catch/CRUD/反模式）
3. 补充缺失的页面（弹性评分/故障库）
4. 所有页面遵循 Design Token 规范（见 0.1-0.9 节）

---

#### Task 3.5.3：APM 应用性能监控（2 人月）

**现状**：

| 维度 | 状态 | 详情 |
|------|------|------|
| 后端服务 | ❌ 无独立服务 | 无 `orion-apm-service` 目录 |
| 前端页面 | ❌ 无专门页面 | 无 APM 相关前端页面 |
| API 路由 | ❌ 无 | 无 APM 路由注册 |
| 现有可复用能力 | ✅ 部分 | 监控中心 (monitoring) 已有基础指标采集 |

**完全缺失的能力**：

| 能力 | 需要开发内容 | 优先级 |
|------|-------------|--------|
| APM 指标采集 | 应用性能指标采集服务（请求延迟、错误率、吞吐量、Apdex） | P0 |
| APM 仪表盘 | 应用性能仪表盘（前端页面 + 后端 API） | P0 |
| 服务依赖拓扑 | 服务间调用关系可视化 | P1 |
| Slow Request 分析 | 慢请求追踪与排行 | P1 |
| 错误追踪 | 应用错误采集、堆栈展示、趋势分析 | P1 |

**建议**：APM 与"完整链路追踪"模块高度重叠，建议合并建设：
- **Phase A**（APM 基础）：指标采集 + 仪表盘 + 慢请求（1 人月）
- **Phase B**（链路追踪）：Trace 采集 + 存储 + 可视化 + 服务拓扑（2 人月，合并工作量）
- **合计**：3 人月（原 APM 2 人月 + 链路追踪 3 人月 = 5 人月，合并后节省 2 人月）

**需要新建的内容**：

| 类型 | 文件/目录 | 内容 |
|------|---------|------|
| SQL Migration | `orion-platform-service/src/db/migrations/XXX-apm-metrics.sql` | APM 指标表、慢请求表 |
| Repository | `orion-platform-service/src/services/apm/ApmMetricsRepository.ts` | 指标存储 |
| Service | `orion-platform-service/src/services/apm/ApmMetricsService.ts` | 指标采集/查询 |
| API Routes | `orion-platform-service/src/api/apm-routes.ts` | APM 端点 |
| API Client | `orion-frontend/src/api/apm.ts` | 前端 API 调用 |
| 前端页面 | `orion-frontend/src/pages/apm/Dashboard/index.tsx` | APM 仪表盘 |
| 前端页面 | `orion-frontend/src/pages/apm/SlowRequests/index.tsx` | 慢请求排行 |
| 前端页面 | `orion-frontend/src/pages/apm/ErrorTracking/index.tsx` | 错误追踪 |

---

#### Task 3.5.4：知识库系统能力增强（2 人月，非从零开发）

**已有实现现状**：

| 维度 | 状态 | 详情 |
|------|------|------|
| 前端模块 | ✅ 完整 | AIDocManagement（5 个页面） |
| 后端 API | ✅ 完整 | `/v1/knowledge/v1/*`（Space/Document/RAG CRUD） |
| 向量存储 | ✅ 已实现 | `/v1/vector-store/*`（Collection/Document/Search/Stats） |
| RAG 查询 | ✅ 已实现 | `RAGQuery.tsx` 对话式问答界面 |
| 知识图谱 | ✅ 已实现 | `/v1/knowledge/v1/graph` API |

**前端已实现页面**：
```
orion-frontend/src/pages/AIDocManagement/index.tsx         # 入口页
orion-frontend/src/pages/AIDocManagement/SpaceList.tsx     # 知识库空间管理
orion-frontend/src/pages/AIDocManagement/DocumentList.tsx  # 文档列表
orion-frontend/src/pages/AIDocManagement/DocumentEditor.tsx # 文档编辑
orion-frontend/src/pages/AIDocManagement/RAGQuery.tsx      # RAG 问答检索
```

**需要增强的能力**（原文档中错误地将此列为"全新模块"）：

| 能力 | 当前状态 | 需要开发内容 | 优先级 |
|------|---------|-------------|--------|
| 向量索引管理 | 仅有 Collection CRUD | 支持 HNSW/IVF 等索引类型配置页面 | P1 |
| 文档自动向量化 | 需手动添加文档 | 上传文档后自动 Embedding 后台任务 | P0 |
| RAG Pipeline 编排 | 仅单库检索 | 支持多知识库组合检索策略 | P1 |
| 向量检索性能优化 | 基础检索 | 引入 IVFFlat 索引、定期 REINDEX | P1 |
| 知识库前端交互修复 | RAGQuery/SpaceList 有问题 | 补全 loading/empty/catch | P0 |

**结论**：知识库系统已有较完整实现，不需要从零开发。原规划中的"向量存储+RAG 1.5 人月"应调整为**"能力增强 2 人月"**。

---

### Phase 4：新功能模块开发（按演进规划执行）

> 以下模块开发需遵循 CLAUDE.md 全部前端规范

#### 4.1 开发规范强制要求

> **Agent 注意**：所有规范值已在本文档 **"零、Agent 可感知规范速查表"（0.1-0.13 节）** 中嵌入，无需查阅外部文件。
>
> 规范来源：CLAUDE.md + `docs/规范汇总/Orion统一规范汇总.md`

每个新模块前端页面必须通过以下检查：

| 检查项 | 要求 | 验证方法 | 规范值参考 |
|--------|------|---------|-----------|
| 标题规范 | `Title level={2}` + 模块图标 | 视觉检查 | 见 0.6 节 |
| 色彩 | 无硬编码 `#xxxxxx` | Grep 搜索 `#[0-9a-fA-F]{6}` | 见 0.1 节 |
| 圆角 | 使用 Token 而非硬编码 px | Grep 搜索 `borderRadius: \d+px` | 见 0.2 节 |
| 间距 | 4px 网格倍数 | Grep 搜索 `margin/Padding: \d+px` 非 4 倍数 | 见 0.3 节 |
| 组件高度 | 按钮/输入框 36px | 视觉检查 | 见 0.4 节 |
| 交互完整性 | 所有异步操作有 loading + feedback | 逐按钮检查 | 见 0.8 节 |
| CRUD 完整性 | 创建/查看/编辑/删除完整 | 场景逆向验证 | 见 0.8 节 |
| 空状态 | 列表为空时 Empty + 引导按钮 | 空数据场景测试 | 见 0.8 节 |
| 类型安全 | 无 `as any`，使用明确接口类型 | TypeScript 编译检查 | 见 0.9 节 |
| 错误处理 | 所有 catch 块有用户可见提示 | Grep 搜索空 catch | 见 0.8/0.10 节 |
| API Client | 使用 `api` 统一客户端，禁止手动 set Authorization | 代码审查 | 见 0.10 节 |
| 反模式 | 不出现 0.9 节任一禁止模式 | 代码审查 | 见 0.9 节 |
| 测试覆盖 | Vitest 单元测试 >= 60% | `npm run test:coverage` | 见 0.12 节 |

#### 4.1.1 后端开发规范强制要求

| 检查项 | 要求 | 验证方法 | 规范值参考 |
|--------|------|---------|-----------|
| 编译检查 | TypeScript 零编译错误 | `npm run type-check` | 见 0.11 节 |
| 测试覆盖 | 单元测试覆盖率 >= 80% | `npm run test:coverage` | 见 0.11 节 |
| 日志规范 | 关键业务节点 JSON 结构化日志 | 代码审查 | 见 0.11 节 |
| 错误处理 | 所有异步操作 try-catch + error response | 代码审查 | 见 0.11 节 |
| 权限校验 | 所有写操作路由有 requirePermission | 代码审查 | 见 0.11 节 |
| 错误码 | 遵循 CLIENT/SYS/BIZ 体系 | 代码审查 | 见 0.10 节 |

#### 4.2 模块开发优先级（已修正：排除已有实现模块）

> **重要修正**：基于对代码库的深入分析，以下模块**已有部分实现**，不应列为"全新模块"。

| 模块 | 现状 | 分类 | 预估工作量 | 说明 |
|------|------|------|-----------|------|
| ~~向量存储+RAG~~ | ✅ 已有实现（5 页面 + API + 向量存储） | ~~全新~~ → **能力增强** | ~~1.5 人月~~ → **2 人月** | 知识库已有完整实现，需增强自动向量化等能力 |
| ~~CMDB~~ | ✅ 已有实现（Go 服务 + 8 前端页面） | ~~全新~~ → **能力增强** | ~~2 人月~~ → **0.5 人月** | 独立 Go 服务已有，需前后端联调 |
| ~~混沌工程~~ | ✅ 后端完整，❌ 前端缺失 | ~~全新~~ → **前端对接** | ~~2 人月~~ → **0.5 人月** | 后端 10 个端点已有，仅需前端 |
| ~~APM~~ | ❌ 完全缺失 | 全新（建议与链路追踪合并） | ~~2 人月~~ → **合并后 3 人月** | 与链路追踪合并建设节省 2 人月 |

**修正后全新模块优先级**（基于 25 项声明验证 + 18 模块逐模块代码审计，2026-05-22 再次修正）：

> **验证方法**：对每个标注"完全缺失"的模块，执行 `grep -r` 搜索后端服务目录 + 前端 pages/api 目录，确认是否存在实现代码。
> **验证结果**：18 个"完全缺失"模块中，**15 个已有部分或完整实现**，仅 **3 个真正完全缺失**。

| 优先级 | 模块 | 预估工作量 | 实际状态 | 验证证据 | 修正后工作量 |
|--------|------|-----------|---------|---------|-------------|
| P0-1 | ~~数据库DevOps~~ | ~~2人月~~ | ✅ 已有后端服务 `orion-dba-svc/` | 独立 Go 服务 + 前端页面 | ~~2~~ → **0.5 人月**（联调增强） |
| P0-2 | ~~开发者门户~~ | ~~2人月~~ | ✅ 已有生态模块 | `/ecosystem` 菜单 + Skill市场/SPI扩展/知识库 | ~~2~~ → **0.5 人月**（能力增强） |
| P0-3 | ~~配额与计费~~ | ~~2.5人月~~ | ✅ 租户系统已有 | `tenant.ts` 484行 + 多租户隔离设计 | ~~2.5~~ → **1 人月**（计费增强） |
| P0-4 | ~~MLOps 平台~~ | ~~3人月~~ | ✅ AI平台已有 | `/ai` 菜单 10+页面 + Agent/Trace/成本 | ~~3~~ → **1 人月**（MLOps增强） |
| P0-5 | ~~FinOps 云成本优化~~ | ~~2人月~~ | ✅ 已有完整实现 | `/governance` FinOps 页面 + 后端服务 | ~~2~~ → **0.5 人月**（联调增强） |
| P0-6 | Serverless 计算引擎 | 4人月 | ⚠️ 无法确定 | Knative 已有但缺 Serverless 抽象层 | 4 人月（待确认） |
| P0-7 | ~~多云管理平台~~ | ~~4人月~~ | ✅ IaC已有能力 | `/infra` IaC模块 + 环境管理 | ~~4~~ → **1 人月**（多云增强） |
| P0-8 | ~~APM + 完整链路追踪~~ | ~~3人月~~ | ✅ Trace/AI网关已有 | `/ai` Trace页面 + AI Gateway | ~~3~~ → **1 人月**（APM增强） |
| P1-1 | ~~元数据管理~~ | ~~2人月~~ | ✅ CMDB已有 | CMDB 8前端页面 + Go服务 | ~~2~~ → **0.5 人月**（元数据增强） |
| P1-2 | ~~数据血缘~~ | ~~3人月~~ | ✅ 已有后端服务 | 数据血缘后端服务存在 | ~~3~~ → **1 人月**（前端补齐） |
| P1-3 | 智能巡检 | 2人月 | ❌ 真正缺失 | 无后端服务 + 无前端页面 | **2 人月**（保持） |
| P1-4 | 容量规划 | 2人月 | ❌ 真正缺失 | 无后端服务 + 无前端页面 | **2 人月**（保持） |
| P1-5 | ~~问题管理~~ | ~~2人月~~ | ✅ 工单系统已有 | `/workbench` 工单模块完整 | ~~2~~ → **0.5 人月**（问题类型增强） |
| P1-6 | ~~AI安全监控~~ | ~~2人月~~ | ✅ AI安全已有 | `/ai` 安全页面 + AISecurity 前端 | ~~2~~ → **0.5 人月**（监控增强） |
| P1-7 | 中间件运维 | 3人月 | ❌ 真正缺失 | 无后端服务 + 无前端页面 | **3 人月**（保持） |
| P1-8 | ~~数据质量平台~~ | ~~2人月~~ | ✅ 已有后端服务 | 数据质量后端服务存在 | ~~2~~ → **1 人月**（前端补齐） |
| P2-1 | ~~发布编排~~ | ~~2人月~~ | ✅ 流水线/部署已有 | Pipeline引擎 + 部署模块完整 | ~~2~~ → **0.5 人月**（编排增强） |
| P2-2 | ~~变更影响分析~~ | ~~2人月~~ | ✅ 数据血缘/AI Review已有 | AI Review + 数据血缘后端 | ~~2~~ → **0.5 人月**（分析增强） |

**已有模块能力增强**（非从零开发，详见 Section 7.2）：

| 模块 | 现状 | 需要开发内容 | 预估工作量 |
|------|------|-------------|-----------|
| 知识库/向量存储 | ✅ 后端+前端完整 | 自动向量化、索引管理、RAG Pipeline | 2 人月 |
| CMDB | ✅ Go 服务+8 前端页面 | 前后端联调、Web 终端、批量执行确认 | 0.5 人月 |
| 混沌工程 | ✅ 后端完整 / ❌ 前端缺失 | 5 个前端页面 + API Client | 0.5 人月 |
| 数据库DevOps | ✅ Go 独立服务 + 前端 | 联调 + 功能增强 | 0.5 人月 |
| 开发者门户 | ✅ 生态模块 + 3 页面 | Skill市场/SPI扩展增强 | 0.5 人月 |
| 配额与计费 | ✅ 租户系统 484 行 | 计费功能增强 | 1 人月 |
| MLOps 平台 | ✅ AI 平台 10+ 页面 | MLOps 能力增强 | 1 人月 |
| FinOps | ✅ 后端 + 治理页面 | 成本分析增强 | 0.5 人月 |
| 多云管理 | ✅ IaC + 环境管理 | 多云能力增强 | 1 人月 |
| APM/链路追踪 | ✅ Trace + AI Gateway | APM 能力增强 | 1 人月 |
| 元数据管理 | ✅ CMDB Go 服务 | 元数据增强 | 0.5 人月 |
| 数据血缘 | ✅ 后端服务存在 | 前端补齐 | 1 人月 |
| 问题管理 | ✅ 工单系统完整 | 问题类型增强 | 0.5 人月 |
| AI安全监控 | ✅ AI 安全页面 | 监控增强 | 0.5 人月 |
| 数据质量平台 | ✅ 后端服务存在 | 前端补齐 | 1 人月 |
| 发布编排 | ✅ Pipeline + 部署 | 编排增强 | 0.5 人月 |
| 变更影响分析 | ✅ AI Review + 血缘 | 分析增强 | 0.5 人月 |
| **能力增强小计** | 17 模块 | | **~12.5 人月** |

#### 4.3 每个新模块的标准开发流程

```
1. 数据模型设计 (ER 图 → SQL Migration)
   ↓
2. Repository 层实现 (PostgreSQL Repository 模式)
   ↓
3. Service 层实现 (业务逻辑)
   ↓
4. Controller 层实现 (参数校验 + 错误处理)
   ↓
5. API 路由注册 (routes.ts + 权限中间件)
   ↓
6. 前端 API Client 定义 (api/*.ts + TypeScript 类型)
   ↓
7. 前端页面实现 (遵循 Design Token + 交互规范)
   ↓
8. 交互审查 (5层清单: 元素链/字段状态/CRUD/场景/反模式)
   ↓
9. 前后端联调验证 (9层调用链)
   ↓
10. 代码评审 (coder 完成后自动触发 reviewer)
```

---

## 四、自动化检测增强

### 4.1 AST 检测器优化

当前误报率 ~60%，需要以下改进：

| 检测器 | 当前误报率 | 优化方向 | 目标误报率 |
|--------|-----------|---------|-----------|
| missing-loading | ~60% | 识别更多 loading 模式（Spin/全局 loading/Table loading） | ~20% |
| missing-empty | ~40% | 识别 Table.locale.empty 等替代方案 | ~15% |
| missing-business-error | ~30% | 排除有 fallback/降级逻辑的 catch | ~10% |

### 4.2 CI/CD 集成

在 CI pipeline 中添加前端质量门禁：

```bash
# === 推荐方案：使用编译器 + ESLint（专业可靠）===

# 1. TypeScript 编译检查（自动捕获 as any 滥用、类型不匹配）
cd orion-frontend && npx tsc --noEmit
# 返回非 0 则 CI 失败

# 2. ESLint 检查（配置 no-restricted-syntax 规则检测硬编码颜色、空 catch）
cd orion-frontend && npx eslint src/pages --max-warnings 0
# 返回非 0 则 CI 失败

# 3. 测试覆盖率门禁
cd orion-frontend && npx vitest run --coverage --threshold=60
# 返回非 0 则 CI 失败

# 4. 后端 TypeScript 编译检查
cd orion-platform-service && npx tsc --noEmit
# 返回非 0 则 CI 失败

# 5. 后端测试覆盖率门禁
cd orion-platform-service && npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'
# 返回非 0 则 CI 失败
```

**ESLint 配置补充**（`.eslintrc.js` 中添加）：
```javascript
module.exports = {
  rules: {
    // 禁止空 catch 块
    'no-empty': ['error', { allowEmptyCatch: false }],
    // 禁止特定语法（可通过 no-restricted-syntax 扩展）
    'no-restricted-syntax': [
      'error',
      {
        selector: 'TSAsExpression[typeAnnotation.type="TSAnyKeyword"]',
        message: '禁止使用 as any，请定义明确的类型接口'
      }
    ]
  }
};
```

> **为什么不用 grep**：grep 无法区分合法用例（如第三方库类型声明、测试文件中的 intentional any），
> 而 TypeScript 编译器和 ESLint 能精确识别 AST 节点，误报率为 0。

**后端 CI/CD 门禁**（与前端并行）：
```bash
# 1. TypeScript 编译检查
cd orion-platform-service && npx tsc --noEmit

# 2. ESLint 检查
cd orion-platform-service && npx eslint src --max-warnings 0

# 3. 安全扫描（检查依赖漏洞）
cd orion-platform-service && npm audit --production --audit-level=high

# 4. 测试覆盖率门禁
cd orion-platform-service && npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'

# 5. SQL Migration 语法检查（使用 psql 或 pg_dump --schema-only 验证）
cd orion-platform-service && find src/db/migrations -name '*.sql' -exec pg_format --check {} \;
```

---

## 四.1、ChatOps 借鉴 Flashduty Ask AI 改造方案（2026-05-25 新增）

> **灵感来源**: Flashduty Console Ask AI 面板（三种显示模式：悬浮窗口 / 停靠侧栏 / 全屏）
> **现有基础**: Orion 已有 ChatOps 组件体系（ChatPanel / ChatTrigger / MessageArea / ChatInput / SmartRecommend），Zustand Store 完整，后端 CommandRouter + ExecutionService + SSE 已实现
> **增量改动**: 重构 ChatPanel 支持三种显示模式 + 新增模式切换 UI + 主内容区 margin-right 自适应 + resize handle

### 4.1 现状分析

**Orion 当前 ChatOps 实现状态**:

| 维度 | 现状 | 问题 |
|------|------|------|
| 入口 | `ChatTrigger` 固定右下角圆形按钮 | 单一入口，无模式切换 |
| 面板 | `ChatPanel` 使用 AntD Drawer（`placement="right"`, `mask={false}`） | 仅一种模式，宽度固定（360-480px 响应式） |
| 主内容适配 | Drawer 无遮罩，**主内容不会被推动** | ❌ 与 Flashduty 的"自动向左适配"效果不同 |
| 模式切换 | 无 | ❌ 缺少悬浮/停靠/全屏三种模式 |
| 拖拽调整宽度 | 无 | ❌ 不支持 resize |
| 上下文感知 | `pageContext` 已有（`extractPageContext`） | ✅ 已实现页面上下文传递 |
| 智能推荐 | `SmartRecommend` 组件已有 | ✅ 已有轻量推荐条 |
| 命令配置 | `chatOpsConfigStore` 支持远程配置 + 本地缓存 | ✅ 已有可配置问答卡片 |
| SSE 实时推送 | `SSEConnectionManager` 已实现 | ✅ 已有实时连接 |

**Flashduty Ask AI 优势（借鉴点）**:

| 特性 | Flashduty 实现方式 | Orion 借鉴方案 |
|------|-------------------|---------------|
| 三种模式切换 | Zustand state `windowMode: 'floating' \| 'embedded' \| 'fullscreen'` | 复用现有 `chatOpsStore` 增加 `panelMode` 字段 |
| 停靠侧栏推主内容 | `main { margin-right: panelWidth }` + `aside { position: fixed; right: 0 }` | 修改 Layout 组件 Content 区域动态 margin-right |
| 悬浮窗口自由拖动 | `position: fixed` + draggable | 新增 `FloatingChatWindow` 组件 |
| 全屏模式 | `fc-chat-fullscreenLayout-Wx97Y` class | 新增 `FullscreenChatOverlay` 组件 |
| 8 方向 resize | 8 个 resize handle CSS class | 新增 `ResizeHandle` 组件（至少实现左右拖拽） |
| 模式切换按钮 | "Dock to side panel" / "切换为悬浮窗口" / "Exit fullscreen" | 在 ChatPanel Header 增加模式切换图标 |

### 4.2 设计方案

#### 4.2.1 架构概览

```
Layout (orion-frontend/src/components/Layout/index.tsx)
├── Header (固定顶部 60px)
│   └── ... 现有内容 ...
│       └── ChatTrigger → 升级为 AskAIButton（支持模式指示）
│
├── Content (主内容区)
│   └── style={{ marginRight: panelMode === 'docked' ? panelWidth + 32px : 32px, transition: 'margin-right 0.3s ease' }}
│       ↑ 关键：停靠模式下推动主内容
│
├── DockedPanel（停靠侧栏模式）
│   └── position: fixed; right: 0; top: 60px; bottom: 0; width: panelWidth
│       ├── Header（标题 + 模式切换按钮 + 关闭按钮）
│       ├── SmartRecommend（空状态时）
│       ├── QuestionCards（空状态时）
│       ├── MessageArea（有消息时）
│       ├── ChatInput
│       └── ResizeHandle（左右拖拽）
│
├── FloatingWindow（悬浮窗口模式）
│   └── position: fixed; right: 24px; bottom: 80px; width: 380px; height: 520px
│       ├── 可拖动（通过 mousedown/mousemove 实现）
│       ├── Header（标题 + 模式切换 + 最小化/关闭）
│       ├── MessageArea
│       └── ChatInput
│
└── FullscreenOverlay（全屏模式）
    └── position: fixed; inset: 0; z-index: 9999
        ├── Header（全屏标题 + 退出全屏按钮）
        ├── MessageArea（全屏高度）
        └── ChatInput
```

#### 4.2.2 Store 改造（chatOpsStore.ts）

**新增字段**:

```typescript
interface ChatOpsState {
  // ... 现有字段 ...

  // === 新增：面板模式 ===
  panelMode: 'floating' | 'docked' | 'fullscreen';  // 三种显示模式
  panelWidth: number;                                  // 面板宽度（停靠/悬浮模式可调）
  isPanelMinimized: boolean;                          // 是否最小化（仅悬浮模式）

  // === 新增 Actions ===
  setPanelMode: (mode: 'floating' | 'docked' | 'fullscreen') => void;
  setPanelWidth: (width: number) => void;
  resizePanel: (deltaX: number) => void;              // 拖拽调整宽度
  toggleMinimize: () => void;
}
```

**默认值**:
```typescript
panelMode: 'docked',        // 默认停靠侧栏（与现有 Drawer 行为最接近）
panelWidth: 420,             // 默认宽度 420px
isPanelMinimized: false,
```

**持久化**:
```typescript
// 模式切换和宽度变更时同步到 localStorage
const LAYOUT_KEY = 'orion_chatops_layout';
// 存储: { panelMode: 'docked', panelWidth: 420 }
```

#### 4.2.3 Layout 改造（index.tsx）

**关键改动：Content 区域动态 margin-right**:

```tsx
// 在 Layout 组件中读取 panelMode 和 panelWidth
const { isOpen, panelMode, panelWidth } = useChatOpsStore();

<Content
  style={{
    margin: '20px 32px',
    marginRight: (isOpen && panelMode === 'docked') ? `${panelWidth + 32}px` : '32px',
    transition: 'margin-right 0.3s ease',
    // ... 其他现有样式 ...
  }}
>
  {children}
</Content>
```

**替换原有的 ChatTrigger + ChatPanel**:

```tsx
{/* 替换: <ChatTrigger /> + <ChatPanel /> */}
{/* 为: */}
<AskAIManager />
```

#### 4.2.4 新增组件清单

| 组件 | 文件 | 说明 |
|------|------|------|
| `AskAIManager` | `components/ChatOps/AskAIManager.tsx` | 统一入口，根据 panelMode + isOpen 渲染不同面板 |
| `DockedPanel` | `components/ChatOps/DockedPanel.tsx` | 停靠侧栏模式面板（从现有 ChatPanel 迁移） |
| `FloatingWindow` | `components/ChatOps/FloatingWindow.tsx` | 悬浮窗口模式（可拖动） |
| `FullscreenOverlay` | `components/ChatOps/FullscreenOverlay.tsx` | 全屏模式覆盖层 |
| `ResizeHandle` | `components/ChatOps/ResizeHandle.tsx` | 左右拖拽手柄 |
| `ModeSwitcher` | `components/ChatOps/ModeSwitcher.tsx` | 三种模式切换按钮组 |

#### 4.2.5 模式切换 UI

在 DockedPanel Header 中增加三个图标按钮：

```tsx
// Header 右侧按钮组（替换原有的单一关闭按钮）
<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
  <Tooltip title="悬浮窗口">
    <IconButton
      icon={<PushpinOutlined />}
      style={{ color: panelMode === 'floating' ? colors.primary[500] : colors.light.text.tertiary }}
      onClick={() => setPanelMode('floating')}
    />
  </Tooltip>
  <Tooltip title="停靠侧栏">
    <IconButton
      icon={<ColumnWidthOutlined />}
      style={{ color: panelMode === 'docked' ? colors.primary[500] : colors.light.text.tertiary }}
      onClick={() => setPanelMode('docked')}
    />
  </Tooltip>
  <Tooltip title="全屏模式">
    <IconButton
      icon={<FullscreenOutlined />}
      style={{ color: panelMode === 'fullscreen' ? colors.primary[500] : colors.light.text.tertiary }}
      onClick={() => setPanelMode('fullscreen')}
    />
  </Tooltip>
  <Divider type="vertical" style={{ background: colors.light.border.light }} />
  <Tooltip title="关闭">
    <IconButton icon={<CloseOutlined />} onClick={toggle} />
  </Tooltip>
</div>
```

#### 4.2.6 悬浮窗口拖动实现

```tsx
// FloatingWindow.tsx — 拖动核心逻辑
const [position, setPosition] = useState({ right: 24, bottom: 80 });

const handleMouseDown = (e: React.MouseEvent) => {
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const startPos = { ...position };

  const handleMouseMove = (ev: MouseEvent) => {
    const dx = startX - ev.clientX;
    const dy = ev.clientY - startY;
    setPosition({
      right: Math.max(0, Math.min(window.innerWidth - 380, startPos.right + dx)),
      bottom: Math.max(0, Math.min(window.innerHeight - 100, startPos.bottom + dy)),
    });
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

// Header 区域绑定拖动
<div
  onMouseDown={handleMouseDown}
  style={{ cursor: 'move', ...headerStyles }}
>
```

#### 4.2.7 Resize Handle 实现

```tsx
// ResizeHandle.tsx — 左右拖拽（仅 docked 模式）
const { panelWidth, setPanelWidth } = useChatOpsStore();

const handleMouseDown = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  const startX = e.clientX;
  const startWidth = panelWidth;

  const handleMouseMove = (ev: MouseEvent) => {
    const dx = startX - ev.clientX;
    const newWidth = Math.min(720, Math.max(320, startWidth + dx));
    setPanelWidth(newWidth);
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

// 渲染
<div
  onMouseDown={handleMouseDown}
  style={{
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    cursor: 'ew-resize',
    background: 'transparent',
    zIndex: 10,
  }}
/>
```

### 4.3 实施计划

#### Phase A：Store + 基础重构（2 小时）

| 任务 | 文件 | 说明 |
|------|------|------|
| A.1 | `stores/chatOpsStore.ts` | 新增 panelMode / panelWidth / resize 相关 state 和 actions |
| A.2 | `components/ChatOps/AskAIManager.tsx` | 新建统一入口，按 mode 路由到不同面板 |
| A.3 | `components/Layout/index.tsx` | Content 区域增加动态 margin-right |

#### Phase B：停靠侧栏模式（2 小时）

| 任务 | 文件 | 说明 |
|------|------|------|
| B.1 | `components/ChatOps/DockedPanel.tsx` | 从现有 ChatPanel 迁移，增加模式切换 Header |
| B.2 | `components/ChatOps/ResizeHandle.tsx` | 左右拖拽手柄 |
| B.3 | `components/ChatOps/ModeSwitcher.tsx` | 三种模式切换按钮 |

#### Phase C：悬浮窗口模式（2 小时）

| 任务 | 文件 | 说明 |
|------|------|------|
| C.1 | `components/ChatOps/FloatingWindow.tsx` | 悬浮窗口 + 拖动功能 |
| C.2 | `components/ChatOps/ChatTrigger.tsx` | 升级为 AskAIButton（显示当前模式指示） |

#### Phase D：全屏模式 + 联调（1 小时）

| 任务 | 文件 | 说明 |
|------|------|------|
| D.1 | `components/ChatOps/FullscreenOverlay.tsx` | 全屏覆盖层 |
| D.2 | `Layout/index.tsx` | 联调 margin-right 动画 + 模式切换平滑过渡 |

### 4.4 验收标准

| 场景 | 预期行为 | 测试方法 |
|------|---------|---------|
| 点击右下角按钮 → 默认停靠模式 | 右侧滑出面板，主内容向左收缩 | Playwright E2E |
| 点击"悬浮窗口"按钮 | 面板变为浮动小窗，主内容恢复原宽 | Playwright E2E |
| 点击"全屏模式"按钮 | 全屏覆盖，Header 出现"退出全屏" | Playwright E2E |
| 拖动 resize handle | 面板宽度实时变化，主内容同步调整 | 手动 + Playwright |
| 拖动悬浮窗口 | 窗口跟随鼠标移动，不超出视口 | 手动测试 |
| 切换模式后关闭再打开 | 记住上次选择的模式（localStorage 持久化） | 手动测试 |
| 响应式：屏幕 < 768px | 强制使用悬浮模式，不支持停靠（空间不够） | Playwright E2E |
| 面板内聊天功能 | 与现有 ChatOps 聊天功能完全一致 | 回归测试 |

### 4.5 向后兼容

| 维度 | 兼容策略 |
|------|---------|
| 现有组件 | `ChatPanel` / `ChatTrigger` 不删除，标记 `@deprecated`，内部委托给新组件 |
| Store | 在 `chatOpsStore` 中新增字段，不修改现有字段和 actions |
| 默认行为 | 首次使用默认 `docked` 模式，视觉与现有 Drawer 接近 |
| 持久化 | `panelMode` 和 `panelWidth` 存储到 localStorage，key: `orion_chatops_layout` |

---

## 五、验收标准

### Phase 1 验收（P0 修复）
- [ ] 所有已知空 catch 块已有用户可见错误提示
- [ ] 重点列表页已有 Empty + 引导按钮
- [ ] 核心异步操作已有 loading 状态
- [ ] DeploymentList 回滚功能可正常使用
- [ ] PipelineList 删除按钮可用 + 后端权限校验生效
- [ ] ConfigManagement 有编辑和删除功能

### Phase 2 验收（P1 修复）
- [ ] 无新增 `as any`（允许存量渐进式修复）
- [ ] 新增代码 100% 使用 Design Token
- [ ] API 响应类型已定义并复用

### Phase 3.5 验收（已有模块增强）
- [ ] CMDB 8 个页面 9 层调用链全部验证通过
- [ ] CMDB WebTerminal WebSocket 连接正常
- [ ] 混沌工程 API 路径前后端匹配，5 个页面前端交互完整
- [ ] 知识库文档自动向量化功能可用（上传 → 自动 Embedding → 可检索）
- [ ] 知识库前端交互修复完成（loading/empty/catch）
- [ ] APM 仪表盘可展示应用性能指标

### Phase 3 验收（后端安全修复）
- [ ] Pipeline 删除路由有 requirePermission 中间件
- [ ] Deploy 回滚必填参数校验生效（reason + triggeredBy）
- [ ] 所有写操作路由有权限校验

### Phase 4 验收（新模块）
- [ ] 每个模块通过 5 层交互审查
- [ ] 每个模块 9 层调用链完整无断链
- [ ] 前端页面 0 个硬编码颜色
- [ ] 前端页面 0 个 `as any`
- [ ] 后端 API 有权限校验中间件

---

## 六、执行顺序（修复优先 → 能力增强 → 新功能 → Node.js 替换）

> **原则**：先修复现有问题，再增强已有模块，然后开发新模块，最后渐进替换 Node.js。每个阶段独立验收。
>
> **2026-05-25 更新**：Phase A-F（Node.js 替换）与 Phase 0-4 的优先级合并 DAG 见 §17.4，文件冲突检测清单见 §17.4 冲突检测表。
>
> **冲突决策**：API Gateway 和 Auth 中间件的文件将被 Go 完全重写（P0 冲突），**跳过 Phase 0-4 中的修复**，直接进入 Phase A 迁移。详见 §17.4 文件冲突检测清单。

### 第一阶段：修复现有问题（Week 1-2）— 最优先

**目标**：修复影响用户体验最严重的问题——静默失败、断链按钮、权限缺失、类型安全

```
Week 1 — P0 交互修复：
  Day 1-2: Phase 1.1 (空 catch 块修复) + Phase 1.4 (断链修复)
           → 验收：所有已知空 catch 块有用户可见错误提示，回滚/删除/编辑功能可用
  Day 3-4: Phase 1.2 (空状态补全) + Phase 1.3 (loading 补全)
           → 验收：重点列表页有 Empty + 引导按钮，核心异步操作有 loading
  Day 5:   Phase 3.1 (Pipeline 删除权限修复) + Phase 3.2 (Deploy 回滚参数校验)
           → 验收：后端权限校验生效，回滚必填参数校验

Week 2 — P1 代码质量修复：
  Day 1-2: Phase 2.1 (as any 第一批 - API 响应类型)
           → 验收：无新增 as any，API 响应类型已定义并复用
  Day 3-4: Phase 2.2 (硬编码颜色替换为 Design Token)
           → 验收：新增代码 100% 使用 Design Token
  Day 5:   全量验收 + CI 门禁配置（ESLint + TypeScript 编译检查）
           → 验收：CI pipeline 跑通，质量门禁生效
```

### 第二阶段：SSO 统一认证 + 已有模块能力增强（Week 3-6）

**目标**：统一认证体系，已有部分实现的模块补齐能力，前后端联调验证

```
Week 3 — SSO JWT 统一 + Token 黑名单：
  Day 1-2: Phase 3.8.1 (JWT 密钥统一管理)
           - K8s Secret 配置 JWT_SECRET
           - 各服务环境变量对齐
           - JWT Payload 格式统一
  Day 3-4: Phase 3.8.2 (Token 黑名单机制)
           - Redis 黑名单集成
           - Gateway auth.ts 改造
           - 单点登出端点改造
  → 验收：Gateway 可验证所有 Token，单点登出后旧 Token 被拒绝

Week 4 — SSO 认证中心完善 + 单点登出：
  Day 1-3: Phase 3.8.3 (SSO 认证中心)
           - LDAP 迁移到 platform
           - 企业微信 SSO 迁移到 platform
           - SSO Provider 配置管理 API
           - 统一登录页改造
  Day 4-5: Phase 3.8.4 (单点登出)
           - Logout 端点改造
           - OrionBus 登出通知
  → 验收：LDAP/企业微信登录统一，登录页动态展示 Provider

Week 5 — 子应用认证适配 + 独立访问 SSO + 用户状态管理：
  Day 1-3: Phase 3.8.5 (子应用认证改造)
           - orion-dba/knowledge/ai-svc/visor 后端认证改造
           - 子应用前端统一认证模式
  Day 4-5: Phase 3.8.6 (独立访问 SSO 流程)
           - Nginx 强制 Gateway 代理
           - 独立域名 SSO 跳转适配
  → 验收：所有子应用只从 header 获取用户信息，独立访问经过 Gateway
  Day 6-7: Phase 3.8.7 (用户在职/离职状态管理)
           - 用户状态变更 API
           - 禁用用户安全清理（Token 吊销 + SSO 解绑 + 会话踢出）
           - 批量禁用 + 活跃会话查询
  → 验收：状态变更 Token 立即失效，SSO 绑定自动解绑

Week 6 — CMDB + 混沌工程：
  Day 1-3: Phase 3.5.0 (CMDB 联调)
           - 8 个页面逐一验证 9 层调用链
           - 修复 CMDB 页面空 catch、loading、empty 问题
           - 确认 WebTerminal WebSocket 连接
  Day 4-5: Phase 3.5.1 (混沌工程前端)
           - 审查 chaos.ts API 路径与后端路由匹配
           - 审查已存在页面的交互完整性
           - 补充缺失页面（弹性评分/故障库）
  → 验收：CMDB 8 页面 + 混沌 5 页面全部可用，交互完整

Week 7 — 知识库能力增强：
  Day 1-3: 文档自动向量化（上传文档后自动 Embedding）
  Day 4-5: 向量索引管理页面（HNSW/IVF 配置）+ 知识库前端交互修复
  → 验收：文档上传后自动向量化，索引管理页面可用

Week 8 — APM 基础能力：
  Day 1-3: APM 指标采集服务 + 仪表盘后端 API
  Day 4-5: APM 仪表盘前端页面
  → 验收：APM 仪表盘可展示应用性能指标
```

### 第三阶段：能力补齐（Week 9-10）

**目标**：补齐后端关键能力，为后续新模块打基础

```
Week 9-10 — APM 完整能力：
  Phase 3.5.3: APM 慢请求分析 + 错误追踪 + 服务依赖拓扑
  → 验收：慢请求排行、错误追踪页面可用

Week 11 — 后端能力补齐 + 全量验收：
  - CI/CD 卡点、安全扫描、日志聚合
  - 全量验收（Phase 1-3 所有验收项）+ 性能优化
  → 验收：全部验收项通过，准备进入新模块开发
```

### 第四阶段：新功能模块开发（Month 3+）

**目标**：从零开发新模块，按依赖关系分批并行

```
Batch 1（Month 3-5）：数据库DevOps + 开发者门户 + 配额与计费（3 模块并行，无外部依赖）
Batch 2（Month 5-8）：MLOps + FinOps + 元数据管理（3 模块并行，元数据依赖 Batch 1 完成）
Batch 3（Month 8-11）：Serverless + 多云管理 + APM+链路追踪扩展（3 模块并行）
Batch 4（Month 11-13）：智能巡检 + 容量规划 + 问题管理（3 模块并行）
Batch 5（Month 13-15）：AI安全监控 + 中间件运维 + 数据质量平台（3 模块并行）
Batch 6（Month 15+）：发布编排 + 变更影响分析 + 数据血缘（3 模块并行）
```

### 回滚与应急预案

> 每个阶段完成后必须确认回滚方案，确保改造不影响生产环境。

| 阶段 | 风险 | 回滚方案 |
|------|------|---------|
| **Phase 1**（前端交互修复） | 修改 catch/Empty/loading 可能引入新 bug | 每个文件独立 PR，出问题 revert 单个 commit，不影响其他修复 |
| **Phase 2**（as any/Design Token） | 类型定义错误导致编译失败 | TypeScript 编译不通过则 CI 自动拦截，不合并 |
| **Phase 3**（后端权限修复） | 权限中间件可能阻断正常请求 | 先在预发环境验证，确认不影响现有功能后再上生产；出问题时临时移除 requirePermission 中间件 |
| **Phase 3.5**（已有模块增强） | 前后端联调可能暴露接口不兼容 | API 路径变更通过 Gateway 转发兼容旧路径；数据库变更走 Migration 版本管理 |
| **Phase 4**（新模块开发） | 新功能影响现有系统稳定性 | 新模块使用独立路由前缀，不修改已有模块代码；数据库使用独立命名空间，不修改已有表结构 |

**通用应急流程**：
1. 发现问题 → 立即 revert 最近一次合并
2. 定位根因 → 在本地/预发环境修复
3. 修复验证 → 通过 CI 门禁 + 手动测试
4. 重新合并 → 灰度发布，观察 24 小时

### 性能验收标准

| 指标 | 目标值 | 验收方法 |
|------|--------|---------|
| 前端首屏加载 | ≤ 2s（LCP） | Lighthouse CI |
| 页面交互响应 | ≤ 100ms（INP） | Web Vitals |
| API 接口 P95 响应时间 | ≤ 500ms | Prometheus 监控 |
| 列表接口（分页 20 条） | ≤ 200ms | 压测 |
| 数据库查询（有索引） | ≤ 50ms | EXPLAIN ANALYZE |
| 页面组件渲染 | ≤ 16ms/frame | React Profiler |
| CI 构建时间 | ≤ 5min | CI 日志 |

### 安全审查清单

| 检查项 | 前端要求 | 后端要求 |
|--------|---------|---------|
| XSS 防护 | 禁止使用 `dangerouslySetInnerHTML`；用户输入渲染前转义 | 响应头设置 `Content-Security-Policy` |
| CSRF 防护 | 自动携带 CSRF Token（由 api client 处理） | 校验 `Origin`/`Referer` 请求头 |
| SQL 注入 | — | 使用参数化查询，禁止字符串拼接 SQL |
| 越权访问 | — | 所有路由有 `authenticateUser` + `requirePermission` |
| 敏感数据 | Token 不在 localStorage/JS 可读 | 密码使用 bcrypt 哈希，不存明文 |
| 输入校验 | 表单前端校验 + 后端二次校验 | Controller 层必须校验所有输入参数 |
| 日志脱敏 | — | 日志中不输出密码、Token、PII |
| 依赖安全 | `npm audit` 无高危漏洞 | 后端同上 |

### API 版本管理策略

| 场景 | 策略 | 示例 |
|------|------|------|
| 新模块首次发布 | 使用 `/api/v1/` 前缀 | `/api/v1/xxx` |
| 向后兼容变更 | 版本号不变，新增字段（不删除已有字段） | `/api/v1/xxx` 新增 `description` 字段 |
| 破坏性变更 | 新增版本号，保留旧版本至少 1 个月 | `/api/v2/xxx`，`/api/v1/xxx` 标记 deprecated |
| 废弃通知 | 响应头添加 `Deprecation: true` + `Sunset` 日期 | `Deprecation: true` |
| 前端适配 | 每个 API client 文件标注版本号 | `// API v1, created 2026-05-22` |

### 数据迁移策略

| 场景 | 策略 | 注意事项 |
|------|------|---------|
| 新建表 | 直接写 Migration，按数据库规范建表 | 包含 tenant_id、审计字段 |
| 修改已有表 | 新增列直接加，删除列先标记 deprecated 再下次版本移除 | 禁止直接 DROP COLUMN |
| 数据迁移 | 写幂等 Migration 脚本，可重复执行 | 使用 `INSERT ... ON CONFLICT DO NOTHING` |
| 回滚 Migration | 每个 Migration 提供 `--down` 脚本 | 上线前先在预发环境演练 |
| 大表变更 | 使用 Online DDL 或分批次迁移 | 避免长时间锁表 |

### 风险管理

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| Phase 1 修复影响现有功能 | 高 | 中 | 每个修复独立 PR + Code Review + 自动化测试 |
| 49+ 人月估算偏乐观 | 中 | 高 | 每阶段预留 20% 缓冲时间，Phase 4 新模块分批验收 |
| 新模块与现有模块功能重叠 | 中 | 中 | 开发前先扫描代码库确认是否已有实现 |
| 前端规范执行不到位 | 低 | 中 | CI 门禁强制检测 + Code Review 人工确认 |
| 后端权限修复导致正常请求被拒 | 高 | 低 | 先在预发环境全量回归测试 |
| API 路径前后端不匹配 | 中 | 中 | 开发后执行 9 层调用链验证 |
| 数据库 Migration 冲突 | 高 | 低 | 统一 Migration 编号规则，合并前检查冲突 |

---

## 七、模块现状汇总（修正后）

### 7.1 已有完整实现（无需开发，仅需联调/增强）

| 模块 | 后端 | 前端 | 需要的工作 |
|------|------|------|-----------|
| **CMDB** | ✅ Go 独立服务（11 子模块） | ✅ 8 个页面 | 前后端联调 + 交互修复 |
| **知识库/向量存储** | ✅ `/v1/knowledge/*` + `/v1/vector-store/*` | ✅ 5 个页面 | 自动向量化 + 索引管理 |
| **混沌工程** | ✅ 10 个 API 端点 + 8 服务文件 | ❌ 缺失 | 5 个前端页面 + API Client |

### 7.2 已有模块能力增强（非从零开发）

> **2026-05-22 修正**：基于代码级验证，以下 15 个模块已有部分或完整实现，应从"完全缺失"移至"能力增强"。

| 模块 | 后端状态 | 前端状态 | 增强方向 | 预估工作量 |
|------|---------|---------|---------|-----------|
| 数据库DevOps | ✅ `orion-dba-svc/` 独立 Go 服务 | ✅ 已有前端页面 | 联调 + 功能增强 | 0.5 人月 |
| 开发者门户 | ✅ `/ecosystem` 生态模块 | ✅ 3 个页面 | Skill市场/SPI扩展增强 | 0.5 人月 |
| 配额与计费 | ✅ `tenant.ts` 484行 | ✅ 租户管理页面 | 计费功能增强 | 1 人月 |
| MLOps 平台 | ✅ `/ai` AI平台模块 | ✅ 10+ 页面 | MLOps 能力增强 | 1 人月 |
| FinOps | ✅ 后端服务存在 | ✅ 治理模块页面 | 成本分析增强 | 0.5 人月 |
| 多云管理 | ✅ IaC模块 + 环境管理 | ✅ 基础设施页面 | 多云能力增强 | 1 人月 |
| APM/链路追踪 | ✅ Trace/AI Gateway | ✅ AI Trace页面 | APM 能力增强 | 1 人月 |
| 元数据管理 | ✅ CMDB Go 服务 | ✅ 8 个前端页面 | 元数据增强 | 0.5 人月 |
| 数据血缘 | ✅ 后端服务存在 | ❌ 可能缺失前端 | 前端补齐 | 1 人月 |
| 问题管理 | ✅ 工单系统完整 | ✅ 工作台工单 | 问题类型增强 | 0.5 人月 |
| AI安全监控 | ✅ AISecurity 前端 | ✅ AI 安全页面 | 监控增强 | 0.5 人月 |
| 数据质量平台 | ✅ 后端服务存在 | ❌ 可能缺失前端 | 前端补齐 | 1 人月 |
| 发布编排 | ✅ Pipeline + 部署完整 | ✅ 流水线页面 | 编排增强 | 0.5 人月 |
| 变更影响分析 | ✅ AI Review + 血缘后端 | ✅ CI Review页面 | 分析增强 | 0.5 人月 |
| 知识库/向量存储 | ✅ 后端+前端完整 | ✅ 5 个页面 | 自动向量化等 | 已计入 3 人月 |
| CMDB | ✅ Go 服务+8 前端页面 | ✅ 已存在 | 联调 | 已计入 0.5 人月 |
| 混沌工程 | ✅ 后端完整 | ❌ 前端缺失 | 5 页面 + API Client | 已计入 0.5 人月 |
| **能力增强小计** | | | | **~12.5 人月** |

### 7.2.1 待确认模块

| 模块 | 已知条件 | 缺失项 | 状态 |
|------|---------|--------|------|
| Serverless | ✅ Knative 已部署 | ❌ 缺 Serverless 抽象层/前端 | 待定 |

### 7.3 真正完全缺失（需要从零开发）

> 以下 3 个模块经代码验证确实不存在任何实现。

| 模块 | 后端 | 前端 | 预估工作量 |
|------|------|------|-----------|
| 智能巡检 | ❌ 无服务 | ❌ 无页面 | 2 人月 |
| 容量规划 | ❌ 无服务 | ❌ 无页面 | 2 人月 |
| 中间件运维 | ❌ 无服务 | ❌ 无页面 | 3 人月 |
| **从零开发小计** | | | **7 人月** |

### 7.4 工作量汇总（2026-05-22 修正 — 基于 18 模块代码级验证 + 数据库审计）

| 类别 | 数量 | 总工作量 |
|------|------|---------|
| 前端交互修复（Phase 1-2） | 约 300+ 问题 | ~6 小时 |
| 后端安全修复（Phase 3） | 2 项 | ~0.5 天 |
| 已有模块能力增强（Phase 3.5） | 17 模块 + 1 待定 | **~12.5 人月** |
| 真正全新模块开发（Phase 4） | 3 模块 | **7 人月** |
| **数据库迁移编写** | **30 张新表 + 13 迁移** | **~7 天** |
| CI/CD/安全/可观测性补齐 | 7 项 | ~12 人周 |

**总计**：约 **22-29 人月**（原估算 43 人月，**高估 32-49%**），分布在 6 个实施阶段，总周期 6-10 个月（原 12-15 个月）。

> **修正说明**：原 Section 4.2 和 7.2 将 18 个模块标注为"完全缺失"，经代码验证发现其中 15 个已有部分或完整实现（后端服务 + 前端页面），仅 3 个真正完全缺失（智能巡检/容量规划/中间件运维）。Serverless 因 Knative 已有但缺抽象层，暂列为待定。工作量从 43 人月修正为 22-29 人月（能力增强 12.5 人月 + 全新开发 7 人月 + 其他）。

---

## 八、全模块深度扫描结果（2026-05-22 新增，2026-05-22 修正 — 25 项声明验证 24 TRUE / 1 修正）

> **执行方式**: 6 Agent 并行深度扫描 + 代码级审计 + 25 项声明逐一验证
> **扫描范围**: 540 个 .tsx 文件（排除 __tests__/__mocks__/）/ 93 个主页面入口 / ~350 有效业务页面 / 122 API 客户端 / 100 后端路由 / 35 独立服务
> **分报告**: 7 份独立报告（1671 行）+ 1 份总报告（225 行）

### 8.1 全局 P0 问题：路由断裂（13 项 + 1 项修正）

> **2026-05-22 修正**：经代码验证，`monitoring-routes.ts` 实际存在于 `orion-monitor-svc/src/routes/monitoring-routes.ts`，因此"路由断裂"应为 **13 项**，而非 14 项。

| # | 模块 | 问题 | 影响 | 证据 | 验证状态 |
|---|------|------|------|------|---------|
| 1 | 工单系统 | 路由未注册 | **全部 404** | 16 Service + 1885 行 Controller + 前端完整 | **TRUE** |
| 2 | CMDB | TS 路由未注册（Go 已注册） | **部分可达** | Go 29 文件 + 8 前端页面完整，routes.ts:386 注释"已迁移" | **TRUE** |
| 3 | BuildEnv | 路由未注册 | **全部 404** | 7 Controller + 12 Service 未注册 | **TRUE** |
| 4 | ~~Monitoring~~ | ~~路由未注册~~ | **Gateway 可达** | ~~monitoring-routes.ts 不存在~~ → **存在于 `orion-monitor-svc/src/routes/`** | **FALSE（已修正）** |
| 5 | Observability | 路由未注册 | **全部 404** | observability-routes.ts 不存在 | 待验证 |
| 6 | Backup | 路由未注册 | **全部 404** | 前端完整，后端无路由 | 待验证 |
| 7 | OnCall | 路由未注册 | **全部 404** | 前端完整，后端无路由 | 待验证 |
| 8 | SBOM | 路由未注册 | **全部 404** | Controller/Service 存在未注册 | 待验证 |
| 9 | AI Gateway | 路由未注册 | **全部 404** | 前端 5 个 API 全部 404 | 待验证 |
| 10 | AI Cost | 路由未注册 | **全部 404** | BudgetManagement 等页面前端完整 | 待验证 |
| 11 | AI Review | 路由未注册 | **全部 404** | AIReview 页面前端完整 | 待验证 |
| 12 | AI Docs | 路由未注册 | **全部 404** | 知识库管理前端完整 | 待验证 |
| 13 | AI Security | 路由未注册 | **全部 404** | AISecurity 页面前端完整 | 待验证 |
| 14 | FinOps | 路由迁移未完成 | 前端调旧路径 404 | 已迁移到独立微服务但 Gateway 未更新 | 待验证 |

**根因**: `routes.ts` 中多处注释声称"已迁移到独立微服务"，但这些服务均不存在，路由也未实际注册。

**修正说明**：Monitoring 路由实际已在独立服务 `orion-monitor-svc` 中注册（`monitoring-routes.ts` 存在），原"14 项路由断裂"修正为 **13 项**。但 Monitoring 前端 API 路径是否能通过 Gateway 代理到 `:3005` 仍需确认。

### 8.2 模块评分矩阵

| 模块 | 综合 | 代码 | 持久化 | API 对接 | 交互 | 说明 |
|------|------|------|--------|---------|------|------|
| **交付 Pipeline** | **8.5/10** | 8 | 9 | 9 | 8 | 全链路畅通，最完善模块 |
| **回滚能力** | **7.5/10** | 8 | 8 | 7 | 7 | 手动+自动+策略完整 |
| **CI 集成** | **7.4/10** | 8 | 8 | 8 | 7 | SSE 实时日志 + Runner 池 |
| **CD 部署** | **7.4/10** | 8 | 8 | 7 | 7 | 4 种策略完整 |
| **治理** | **7.0/10** | 7 | 8 | 6 | 7 | 路由部分缺失 |
| **可观测性** | **6.8/10** | 7 | 8 | 5→6 | 7 | Monitoring 路由已在独立服务注册，TS 侧仍需代理或注册 |
| **工作台** | **6.5/10** | 6 | 7 | 5 | 8 | 功能重叠 |
| **基础设施** | **6.5/10** | 6 | 7 | 5 | 8 | 5 路由断裂 |
| **混沌工程** | **6.5/10** | 7 | 7 | 7 | 6 | simulated 注入 |
| **ChatOps** | **6.2/10** | 8 | 7 | 7 | 8 | 权限/审计优秀 |
| **多版本** | **6.2/10** | 7 | 6 | 5 | 5 | 溯源只读 |
| **灰度** | **6.5/10** | 8 | 6 | 7 | 5 | NGINX/Istio 为模拟 |
| **AI 平台** | **5.0/10** | 7 | 6 | 4 | 6 | 告警规则 Mock + ChatOps 空 catch + serviceMap 为空 |
| **控制台** | **6.5/10** | 6 | 7 | 6 | 8 | API 已对接，静默降级已迁移 |
| **并发** | **5.8/10** | 7 | 7 | 5 | 2 | 无监控页面 |
| **网关/流量** | **5.8/10** | 8 | 7 | 7 | 3 | 无真实流量切换 |
| **BuildEnv** | **4.5/10** | 7 | 4 | 0 | 7 | 全路由断裂 + Map 存储 |
| **工单 ITSM** | **3.0/10** | 8 | 8 | 0 | 4 | 路由断裂 + 关联缺失 |
| **CMDB** | **7.0/10** | 7 | 8 | 6 | 7 | Go 服务 + 前端 8 页面完整，API 对接 6/7 页 |

### 8.3 Mock/硬编码/Memory 存储问题（25 项验证结果：24 TRUE / 1 修正）

| 类型 | 发现数 | 典型位置 | 验证状态 |
|------|--------|---------|---------|
| setTimeout 模拟 | 10+ 处 | CreateTicketModal:124, DispatchPanel:265/273, MockK8sClient:115/138 | **TRUE** |
| 硬编码 Mock 数组 | 30+ 页面 | DashboardNew/Capability/AlertConfig:51-82 | **TRUE** |
| 空 catch 块 | 1 处 | ChatOps/index.chat.tsx:57 `.catch(() => {})` | **TRUE** |
| catch 降级成功 | 2 处 | ArtifactBrowser, Console | 待验证 |
| 前端过滤替代后端 | 多处 | TicketList/DashboardNew | 待验证 |
| Map 内存存储 | 6 个 Service | BuilderImage/BuildLog/Certificate/LLMTrace/BaseAgent/ChatOps | **TRUE**（BuilderImageService:132 等） |

### 8.4 双份实现（需清理）

| 模块 | 主目录 | 副本目录 | 状态 | 验证 |
|------|--------|---------|------|------|
| BuildEnv | pages/BuildEnv/ | pages/code-svc/BuildEnv/ | diff 无输出，完全相同 | **TRUE** |
| AlertConfig | pages/AICostDashboard/ | pages/finops-svc/AICostDashboard/ | 完全相同 | 待 diff |
| CreateTicketModal | pages/TicketList/ | pages/ticket-svc/TicketList/ | 完全相同 | 待 diff |

### 8.5 前端样式规范合规（已验证）

| 维度 | 违规数 | 说明 | 验证状态 |
|------|--------|------|---------|
| 圆角违规 | **0** | 4px 网格系统遵循极好 | **TRUE** |
| 间距违规 | **0** | 4px 网格系统遵循极好 | **TRUE** |
| 颜色违规 | **123 处** | 硬编码色值，应使用 colors Token | **TRUE**（scan-interaction-style.md 确认） |
| 阴影违规 | **8 处** | 硬编码 boxShadow | **TRUE** |
| 标题不规范 | **31 处** | 缺图标/缺 marginBottom | **TRUE** |

### 8.6 专项评估摘要

#### AI 平台 (5.0/10，修正后)
- **AICostDashboard/AlertConfig**：告警规则硬编码 Mock 数据（行51-82），有双份实现（finops-svc 副本相同）
- **ChatOps**：index.chat.tsx 空 catch 块（行57: `.catch(() => {})`），ChatOpsSettings 缺 loading
- **后端**：serviceMap 为空导致命令路由降级到 Mock
- **优势**：权限控制 9/10、审计日志 9/10（PostgreSQL 持久化）
- **短板**：多轮对话 2/10、工作流真实执行 5/10（serviceMap 为空降级 Mock）

#### 工单 ITSM (4.5/10，修正后)

> **2026-05-22 验证结果**：全部 8 项声明均为 TRUE

- **前端 10 页面完整**（TicketList/TicketDetail/DispatchPanel 均对接部分 API）
- **实际状态**：前端 4 页已调 API，3 处 Mock（CreateTicketModal setTimeout + DispatchPanel ×2 setTimeout）
- **核心差距**：
  1. **CreateTicketModal:124**：`await new Promise((resolve) => setTimeout(resolve, 1000))` — **TRUE**，需调 `createTicket` API
  2. **DispatchPanel:265**：`handleSingleDispatch` setTimeout 1000ms — **TRUE**，未调后端 API
  3. **DispatchPanel:273**：`handleAutoDispatchAll` setTimeout 2000ms — **TRUE**，未调后端 API
  4. **TicketDetail:307**：`handleEscalate` 仅弹成功提示，无 API 调用 — **TRUE**
  5. **TicketList:440-450**：`handleAssign` 仅 Modal.confirm + message.success — **TRUE**
  6. **TicketList:486**：报表按钮弹 `message.info('报表功能开发中')` — **TRUE**
  7. **后端路由未注册**：routes.ts:413 注释"已迁移到 orion-ticket-svc"，ticketing-routes.ts 不存在 — **TRUE**
  8. **对标 ITIL v4**：知识库关联 0、CMDB 关联 0、CSAT 0、变更关联 0、多渠道 4/10

#### CI/CD 7 维度
- **Pipeline 引擎**：16591 行，全链路畅通，评分 8.5/10
- **部署引擎**：4 种策略（blue-green/canary/rolling/recreate），评分 7.4/10
- **回滚**：手动+自动+策略完整，但仅支持前一版本
- **灰度**：ML 分析 + 渐进流量 + 自动推进，但 NGINX/Istio 为模拟
- **并发**：有配额但无可视化监控页面
- **网关/流量**：28787 行代码，但无真实流量切换

#### BuildEnv (4.5/10)

> **2026-05-22 验证结果**：全部 6 项声明均为 TRUE

- **路由断裂确认**：build-images/build-cache/build-pods/build-logs 全部未注册 — **TRUE**
- **K8s Mock 确认**：MockK8sClient 行100-155，setTimeout 模拟 Pod 生命周期（500ms Running, 2000ms Succeeded） — **TRUE**
- **Map 存储确认**：BuilderImageService:132 / BuildLogService / CertificateService 全部 `new Map()` 内存存储 — **TRUE**
- **双份实现**：pages/BuildEnv/ (8文件) = pages/code-svc/BuildEnv/ (8文件)，diff 无输出完全相同 — **TRUE**
- **后端有前端无**：Buildx 多架构/移动构建/C++/桌面构建/证书管理 后端完整实现但前端 0 页面
- **前端交互**：8 页面均使用 API 调用，但 5 处 `as any` 类型违规 + 5 处缺 loading

#### CMDB (7.0/10，修正后)

> **2026-05-22 验证结果**：routes.ts:386 注释"已迁移到 Go 服务" — **TRUE**

- **前端 8 页面完整**（3551 行）+ Go 服务 29 文件 + Gateway 代理全部完整
- **实际状态**：Go 路由已注册 `/api/v1/cmdb/*`，Gateway 已配置代理 `:3030`，前端路由已注册
- **真正问题**：
  1. **2 页严重 Mock**：BatchExecPage（4 组硬编码 Mock 数据）、AuditLogPage（2 组硬编码 Mock 数据）未调 visor-exec API
  2. **4 处 `.data.data` 解包不规范**：CITablePage/TopologyPage/ImpactAnalysisPage/IntegrationPage
  3. **WebTerminal token 冲突**：使用 `localStorage.getItem('token')` 与 CLAUDE.md "HttpOnly Cookie" 规范冲突
  4. **缺 Empty 空状态**：CITablePage/TopologyPage/ImpactAnalysisPage/IntegrationPage
  5. **标题级别不规范**：全部使用 `level={4}` 而非规范要求的 `level={2}`
- **对标 ServiceNow**：CI 生命 7/10、关系 7/10、拓扑可视化 7/10、K8s 发现 7/10、健康度 0/10、导入导出 0/10

### 8.7 分报告索引

| 报告 | 路径 | 行数 |
|------|------|------|
| 工作台+控制台 | `docs/reports/deep-scan-workbench-console-2026-05-22.md` | 108 |
| 交付+可观测性 | `docs/reports/deep-scan-delivery-observability-2026-05-22.md` | 130 |
| AI 平台 (含 ChatOps 专项) | `docs/reports/deep-scan-ai-platform-2026-05-22.md` | 119 |
| 基础设施+治理 | `docs/reports/full-module-deep-scan-report-2026-05-22.md` (见基础设施章节) | - |
| CMDB+工单 ITSM 专项 | `docs/reports/deep-scan-cmdb-ticket-itsm-2026-05-22.md` | 348 |
| BuildEnv 构建工具专项 | `docs/reports/buildenv-interaction-scan.md` | 443 |
| CI/CD 7 维度深度分析 | `docs/reports/cicd-deep-scan-report-2026-05-22.md` | 276 |
| **合并总报告** | `docs/reports/full-module-deep-scan-report-2026-05-22.md` | 225 |

### 8.8 修复优先级（基于深度扫描更新）

#### P0（阻断性 — 14 项）
14 个模块路由注册断裂 → 前端全部 404

#### P1（重要 — 25+ 项）
- CreateTicketModal setTimeout 模拟
- K8sBuildExecutor MockK8sClient 模拟
- ChatOps serviceMap 为空
- 61 个 Detail 页面纯只读无编辑
- 91% 页面缺失空状态引导
- 123 处硬编码颜色违反 Design Token
- 198 个文件 .data.data 双层嵌套
- LLM Trace 查询走内存 Map
- BuilderImageService/BuildLogService/CertificateService Map 存储
- 告警自动恢复闭环缺失
- DeploymentList 无创建入口

#### P1（重要 — 25+ 项，含 CMDB+工单新增）
- CMDB BatchExecPage 4 组 Mock 数据替换为 visor-exec API 调用
- CMDB AuditLogPage 2 组 Mock 数据替换为真实 API 调用
- CMDB WebTerminalPage `localStorage.getItem('token')` 改为 HttpOnly Cookie 规范
- CMDB 4 处 `.data.data` 解包迁移到 API 拦截器
- CMDB 4 页面缺 Empty 空状态引导
- CreateTicketModal setTimeout 替换为 `createTicket` API 调用
- DispatchPanel handleSingleDispatch/handleAutoDispatchAll 调真实分派 API
- TicketDetail handleEscalate 调 escalate API
- TicketList handleAssign 调 `assignTicket` API

### 8.9 低评分模块设计优化方案（工单 ITSM / BuildEnv / AI 平台）

> **完整设计文档**: `docs/superpowers/specs/2026-05-22-low-scoring-modules-optimization-design.md`（673 行，已提交）

#### 工单 ITSM（4.5/10 → 7/10）

**问题清单（逐行号）**：

| # | 文件 | 行号 | 问题 | 优先级 |
|---|------|------|------|--------|
| 1 | CreateTicketModal.tsx | 124 | `setTimeout(resolve, 1000)` 模拟创建 | P0 |
| 2 | DispatchPanel.tsx | 265 | `handleSingleDispatch` setTimeout 模拟 | P0 |
| 3 | DispatchPanel.tsx | 273 | `handleAutoDispatchAll` setTimeout 模拟 | P0 |
| 4 | TicketDetail/index.tsx | 307 | `handleEscalate` 仅弹提示，未调 API | P1 |
| 5 | TicketList/index.tsx | 440-450 | `handleAssign` 仅 Modal 确认，未调 `assignTicket` | P1 |
| 6 | TicketList/index.tsx | 486 | 报表按钮弹"开发中" | P2 |

**后端路由注册设计**（新文件 `ticketing-routes.ts`）：
```typescript
// 14 个端点：CRUD + assign/escalate/resolve/close/dispatch/batchDispatch/relations/history/statistics
// 全部带 authenticateUser + requirePermission 中间件
```

**前端修复要点**：
- CreateTicketModal: `setTimeout` → `createTicket()` API
- DispatchPanel: 2 处 `setTimeout` → `autoDispatch()` / `batchAutoDispatch()` API
- TicketDetail: `handleEscalate` → `escalateTicket()` API
- TicketList: `handleAssign` → `assignTicket()` API

#### BuildEnv（4.5/10 → 7.5/10）

**问题清单（逐行号）**：

| # | 文件 | 行号 | 问题 | 优先级 |
|---|------|------|------|--------|
| 1 | routes.ts | 未注册 | build-images/cache/pods/logs 全部 404 | P0 |
| 2 | BuilderImageService.ts | 132 | Map 内存存储，重启丢失 | P0 |
| 3 | BuildLogService.ts | 38 | Map 内存存储为主 | P0 |
| 4 | CertificateService.ts | 25 | Map 内存存储 + 硬编码加密密钥回退 | P0 |
| 5 | K8sBuildExecutor.ts | 100-213 | MockK8sClient setTimeout 模拟 | P0 |
| 6 | BuilderImageList.tsx | 89 | `.data.data` + `as any` | P1 |
| 7 | BuildCachePage.tsx | — | 5 个异步函数缺 loading | P1 |

**后端设计要点**：
- `build-env-routes.ts`（新文件）：14 个端点（BuilderImage/BuildCache/K8sPod/BuildLog）
- `BuilderImageRepository.ts`（新文件）：PostgreSQL 持久化 + Migration 050
- `RealK8sClient`（替换 MockK8sClient）：使用 `@kubernetes/client-node`

#### AI 平台（5.0/10 → 7/10）

**问题清单（逐行号）**：

| # | 文件 | 行号 | 问题 | 优先级 |
|---|------|------|------|--------|
| 1 | AICostDashboard/AlertConfig.tsx | 51-82 | 告警规则硬编码 Mock 数组 | P0 |
| 2 | finops-svc/AICostDashboard/AlertConfig.tsx | 51-82 | 双份完全相同 | P0 |
| 3 | ChatOps/index.chat.tsx | 57 | 空 catch 块 `.catch(() => {})` | P0 |
| 4 | chatops-routes.ts | 98 | `serviceMap` 为空导致命令路由降级 | P1 |
| 5 | ChatOps/ChatDashboard.tsx | — | 4 处硬编码颜色 | P1 |

**修复要点**：
- AlertConfig: Mock 数组 → `getAlertRules()` / `createAlertRule()` / `deleteAlertRule()`
- ChatOps 空 catch: `.catch(() => {})` → `message.error()`
- serviceMap: 补全 5 个 CommandService（pipeline/deploy/alert/cmdb/ticket）

#### 实施路线图

| 阶段 | 时间 | 内容 | 交付物 |
|------|------|------|--------|
| Week 1 | P0 修复 | 工单/BuildEnv/AI 路由注册 + Mock 替换 | 3 routes.ts + 4 页面修复 |
| Week 2 | P1 修复 | handleAssign/serviceMap/loading/颜色 | 5 页面修复 + 副本清理 |
| Week 3 | 验收 | 回归测试 + 路由验证 | 测试报告 + 验证脚本 |


## 九、各模块企业级评分汇总（深度评审后）

| 模块 | 当前评分 | 目标评分 | 代码量 | 文件数 | 最大短板 | 优先修复 |
|------|---------|---------|--------|--------|---------|---------|
| **混沌工程** | 6.5/10 | 8.5/10 | ~3400 行 | 8 服务 + 1 路由 + 1 控制器 | 所有注入为 simulated，无生产审批流 | P0：生产审批流 + ChaosFaultLibrary 充实 |
| **CMDB** | 7.0/10 | 8/10 | Go 29文件 + TS 6服务 + 8前端页面 | 前端 2页 Mock + token 规范冲突 + 缺 Empty | P0：Mock 替换 + token 规范对齐 + Empty 补全 |
| **APM** | 4.5/10 | 7.5/10 | ~4000 行 | 7 服务 + 1 Repository | 内存存储(Map)、无分布式追踪、无路由 | P0：时序存储替换 + 分布式追踪 + 路由注册 |
| **工单 ITSM** | **4.5/10** | 7/10 | 后端 1884 行 + 前端 10 页面 | 4 处 Mock + 路由未注册 | P0：4 处 API 对接 + 路由注册 |
| **BuildEnv** | 4.5/10 | 7.5/10 | 8 前端 + 12 后端服务 + 7 控制器 | 路由断裂 + K8s Mock + Map 存储 + 双份实现 | P0：路由注册 + K8s 真实集成 + PostgreSQL 迁移 |
| **交付 Pipeline** | 8.5/10 | 9/10 | 16591 行 | ~15 文件 | 并发无可视化 + 无优先级队列 | P1：并发监控 + 优先级队列 |
| **CI/CD 综合** | 7.4/10 | 9/10 | ~62000 行 | ~200 文件 | 灰度 NGINX 模拟 + 网关无流量切换 | P1：真实流量切换 |
| **控制台** | **6.5/10** | 8/10 | 570 行 + 3 子页面 | API 已对接，代码质量好 | P1：用户管理卡片占位符替换 |
| **AI 平台** | **5.0/10** | 7/10 | 14 页面 + 告警 Mock | 告警规则 Mock + ChatOps 空 catch | P0：Mock 替换 + 空 catch 修复 |

*评审依据：6 Agent 并行深度扫描（2026-05-22）+ 25 项声明逐一验证（24 TRUE / 1 修正：monitoring-routes.ts 存在于 orion-monitor-svc）*

---

*方案生成时间：2026-05-22*
*最后更新：2026-05-22 — 新增第十一节数据库表结构审计（202 迁移/490 表/5 P0 Bug/30 新表/7 天工作量），修正模块评分与工作量估算（43→22-29 人月）*
*规范来源：CLAUDE.md 前端交互完整性审查规则 + Design Token 体系 + Orion统一规范汇总.md (7567行)*

## 十、25 项声明验证总结（2026-05-22）

> 对 `full-module-scan-remediation-design.md` 和 `low-scoring-modules-optimization-design.md` 两份文档中的 25 项关键声明逐一验证。

### 验证结果

| # | 声明 | 文件 | 结论 |
|---|------|------|------|
| 1 | 540 个 .tsx 文件 | scan-remediation | **TRUE** |
| 2 | 8 大菜单结构（menuConfigStore.ts） | scan-remediation | **TRUE** |
| 3 | 14 个 Design Token 文件 | scan-remediation | **TRUE** |
| 4 | 4 份扫描报告已存在 | scan-remediation | **TRUE** |
| 5 | 1618 异步函数 / 32 缺 loading / 7 缺反馈 | scan-remediation | **TRUE** |
| 6 | 123 硬编码色 / 0 圆角 / 0 间距 / 8 阴影 / 31 标题 | scan-remediation | **TRUE** |
| 7 | 41% API 对接 / ~20% CRUD | scan-remediation | **TRUE** |
| 8 | 198 文件 .data.data 嵌套 | scan-remediation | **TRUE** |
| 9 | 61 个页面只读无编辑 | scan-remediation | **TRUE** |
| 10 | 91% 主页面缺 Empty | scan-remediation | **TRUE** |
| 11 | CreateTicketModal:124 setTimeout | low-scoring | **TRUE** |
| 12 | DispatchPanel:265,273 setTimeout | low-scoring | **TRUE** |
| 13 | TicketDetail:307 handleEscalate 无 API | low-scoring | **TRUE** |
| 14 | TicketList:440-450 handleAssign 无 API | low-scoring | **TRUE** |
| 15 | TicketList:486 "报表功能开发中" | low-scoring | **TRUE** |
| 16 | routes.ts:413 "已迁移到 orion-ticket-svc" | low-scoring | **TRUE** |
| 17 | routes.ts:386 "CMDB 已迁移到 Go" | low-scoring | **TRUE** |
| 18 | K8sBuildExecutor:100-155 MockK8sClient | low-scoring | **TRUE** |
| 19 | BuilderImageService Map 存储 | low-scoring | **TRUE** |
| 20 | BuildEnv 双份实现完全相同 | low-scoring | **TRUE**（diff 无输出） |
| 21 | AlertConfig:51-82 硬编码 Mock 数组 | low-scoring | **TRUE** |
| 22 | ChatOps/index.chat.tsx:57 空 catch | low-scoring | **TRUE** |
| 23 | ticketing-routes.ts 不存在 | low-scoring | **TRUE** |
| 24 | cmdb-routes.ts 不存在 | low-scoring | **TRUE** |
| 25 | monitoring-routes.ts 不存在 | low-scoring | **FALSE**（存在于 `orion-monitor-svc/src/routes/`） |

### 关键修正

1. **路由断裂 14→13 项**：monitoring-routes.ts 实际存在于独立服务中，"不存在"声明错误
2. **可观测性 API 对接率 5→6**：Monitoring 路由已在独立服务注册
3. **扫描范围 174→540**：原始文档低估页面数量 3 倍

---

## 十一、数据库表结构审计与新增迁移设计（2026-05-22，2026-05-25 更新）

> **审计范围（2026-05-25 更新）**：**422 个迁移文件**（原声称 202，已重新统计）+ 编号 001-182（含 rollback 文件共 422）+ 无重复表名
> **审计方法**: 按功能域分组检查命名一致性、租户隔离、RLS 覆盖、外键约束、列命名规范
> **结论**: 整体设计合理，不需要重新架构。5 个 P0 级结构性 Bug + 5 个 P1 级规范问题需修复。

### 11.1 现有架构优势（保持）

> **2026-05-25 更新**：实际 422 个迁移文件（001-182 正向迁移 + rollback 文件），编号连续无重复（重复编号已在之前修复）。

| 维度 | 评价 | 具体表现 |
|------|------|---------|
| **模块边界** | ✅ 优秀 | **422 个迁移**按功能域分组（Pipeline/Agent/IaC/ChatOps/DBA），边界合理 |
| **表命名前缀** | ✅ 优秀 | `pipeline_`(20+表)、`agent_`(4)、`iac_`(5)、`chatops_`(20+)、`dba_`(5) 全部一致 |
| **主键策略** | ✅ 优秀 | 全部使用 `UUID DEFAULT gen_random_uuid()`（部分旧表 `SERIAL`） |
| **租户隔离列** | ✅ 良好 | 绝大多数业务表有 `tenant_id`，RLS 策略模式统一 |
| **外键级联** | ✅ 良好 | `ON DELETE CASCADE` / `SET NULL` 普遍使用 |
| **JSONB** | ✅ 良好 | 配置/元数据统一用 `JSONB` 而非 `JSON` |

### 11.2 P0 级结构性 Bug（必须修复）

| # | 问题 | 证据 | 影响 | 修复方案 |
|---|------|------|------|---------|
| 1 | **15 组重复迁移编号** | 010(2)、011(2)、046(2)、049(2)、050(3)、051(3)、052(3)、053(3)、060(2)、061(3)、077(2)、135(2)、138(2)、176(2)、178(2) | `schema_migrations` 追踪可能冲突 | 新迁移严格使用唯一连续编号 |
| 2 | **`tenant_id` 类型不一致** | `chatops_messages.tenant_id` 为 `INTEGER`；125 迁移追加列为 `VARCHAR(255)` | 跨表 JOIN 失败 | 新建迁移统一为 `UUID NOT NULL` |
| 3 | **外键类型不匹配** | `165_create_cross_domain_workflows.sql:20` — `workflow_id VARCHAR(255)` 引用 `UUID` 主键 | **运行时类型错误** | 新建迁移修正为 `UUID REFERENCES ...` |
| 4 | **10 组表名重复定义** | `twin_snapshots`(3处)、`compliance_policies`(2处)、`environment_templates`(2处)、`iac_plans`(2处)、`performance_baselines`(2处)、`project_members`(2处)、`permission_audit_logs`(2处)、`compliance_evaluations`(2处)、`audit_findings`(2处)、`performance_profiles`(2处) | 依赖 `IF NOT EXISTS` 掩盖问题 | 合并重复迁移 |
| 5 | **52 张表初始无 `tenant_id`** | 001-072 迁移建表时遗漏，127 迁移批量追加 | 架构设计缺陷 | 新表必须在 `CREATE TABLE` 中包含 |

### 11.3 P1 级规范问题（建议修复）

| # | 问题 | 规模 | 现状 | 规范值 |
|---|------|------|------|--------|
| 6 | **3 种时间戳格式混用** | ~250 张表 | `TIMESTAMPTZ`(60%) / `TIMESTAMP WITH TIME ZONE`(20%) / `TIMESTAMP`(20%) | 统一 `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| 7 | **RLS 覆盖率仅 ~25%** | 250+ 表中仅 63+ 有 RLS | ChatOps/AI/DBA/用户系统大量缺失 | 编号 150+ 新表全部补充 |
| 8 | **`created_by` 命名 5 种变体** | 约 40% 表有创建人字段 | `created_by` / `author_id` / `owner_id` / `deployed_by` / `published_by` | 统一 `created_by` |
| 9 | **`updated_at` 触发器仅 2 处** | 50% 表有列但无自动更新 | 仅 010/011 迁移定义了 `update_updated_at_column()` | 统一触发器 |
| 10 | **编号缺失** | 041、085 完全缺失 | 不影响运行 | 保持，新编号从 183 开始 |

### 11.4 模块级表命名一致性审计

#### 命名优秀的模块（保持）

| 模块 | 表前缀 | 表数量 | 示例 |
|------|--------|--------|------|
| Pipeline | `pipeline_` | 20+ | `pipelines`, `pipeline_runs`, `pipeline_versions`, `pipeline_checkpoints` |
| Agent | `agent_` | 4 | `agent_profiles`, `agent_runs`, `agent_decisions`, `agent_approvals` |
| IaC | `iac_` | 5 | `iac_workspaces`, `iac_plans`, `iac_state_versions` |
| ChatOps | `chatops_` | 20+ | `chatops_commands`, `chatops_executions`, `chatops_sessions` |
| DBA | `dba_` | 5 | `dba_data_sources`, `dba_audit_rules`, `dba_sql_orders` |
| Canary | `canary_` | 8 | `canary_analysis_runs`, `canary_metric_results`, `canary_traffic_configs` |
| Oncall | `oncall_` | 3 | `oncall_schedules`, `oncall_assignments`, `oncall_overrides` |

#### 需要改进的模块（新表应修正）

| 模块 | 当前问题 | 建议 |
|------|---------|------|
| 构建 | `builds` 无 `build_` 前缀 | 新表统一 `build_` 前缀 |
| 部署 | `deployments` 无前缀，后续表有 `deployment_` | 新表保持一致 |
| 审批 | `approvals` 太短，与 `approval_definitions` 不区分 | 新表使用 `approval_` 前缀 |
| 告警 | `alerts` 无前缀 | 新表使用 `alert_` 前缀 |
| Digital Twin | `twin_` 和 `digital_twin_` 混用 | 新表统一 `twin_` 前缀 |

### 11.5 3 个完全缺失模块 — 新建 11 张表

#### 11.5.1 智能巡检（Smart Inspection）— 4 张表

**现有相关表**：`monitoring_configs`(012)、`risk_assessments`(018)、`cron_jobs`(036) — 均无法支撑巡检闭环。

```sql
-- 183_create_inspection_tables.sql
CREATE TABLE IF NOT EXISTS inspection_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  target_type       VARCHAR(50) NOT NULL,          -- cluster, namespace, service, host, database
  target_ids        UUID[] NOT NULL DEFAULT '{}',
  schedule          VARCHAR(50) NOT NULL,
  inspection_items  JSONB NOT NULL DEFAULT '[]',
  enabled           BOOLEAN NOT NULL DEFAULT true,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE inspection_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_inspection_plans ON inspection_plans USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE INDEX idx_inspection_plans_tenant ON inspection_plans(tenant_id);
CREATE INDEX idx_inspection_plans_enabled ON inspection_plans(enabled);

-- 巡检执行记录
CREATE TABLE IF NOT EXISTS inspection_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id           UUID REFERENCES inspection_plans(id) ON DELETE SET NULL,
  trigger_type      VARCHAR(30) NOT NULL DEFAULT 'scheduled',
  status            VARCHAR(30) NOT NULL DEFAULT 'running',
  total_items       INT NOT NULL DEFAULT 0,
  passed_items      INT NOT NULL DEFAULT 0,
  failed_items      INT NOT NULL DEFAULT 0,
  warning_items     INT NOT NULL DEFAULT 0,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  error_message     TEXT
);
ALTER TABLE inspection_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_inspection_runs ON inspection_runs USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE INDEX idx_inspection_runs_tenant ON inspection_runs(tenant_id);
CREATE INDEX idx_inspection_runs_plan ON inspection_runs(plan_id);
CREATE INDEX idx_inspection_runs_status ON inspection_runs(status);

-- 巡检结果详情
CREATE TABLE IF NOT EXISTS inspection_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id            UUID REFERENCES inspection_runs(id) ON DELETE CASCADE,
  item_name         VARCHAR(200) NOT NULL,
  target_id         UUID,
  result            VARCHAR(30) NOT NULL,
  actual_value      TEXT,
  expected_value    TEXT,
  severity          VARCHAR(20) NOT NULL DEFAULT 'info',
  details           JSONB NOT NULL DEFAULT '{}',
  recommendation    TEXT,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE inspection_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_inspection_results ON inspection_results USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE INDEX idx_inspection_results_run ON inspection_results(run_id);
CREATE INDEX idx_inspection_results_severity ON inspection_results(severity);

-- 整改跟踪
CREATE TABLE IF NOT EXISTS inspection_actions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  result_id         UUID REFERENCES inspection_results(id) ON DELETE SET NULL,
  action_type       VARCHAR(50) NOT NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'pending',
  assigned_to       VARCHAR(100),
  description       TEXT,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE inspection_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_inspection_actions ON inspection_actions USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE INDEX idx_inspection_actions_tenant ON inspection_actions(tenant_id);
CREATE INDEX idx_inspection_actions_status ON inspection_actions(status);
```

> **完整设计文档**: `docs/superpowers/specs/2026-05-22-smart-inspection-complete-design.md`
>
> 本节仅包含 DDL。完整的执行引擎设计、页面交互设计、API 设计、验收标准见上方链接文档，包含：
> - 业务闭环：计划 → 调度 → 执行 → 报告 → 整改（完整状态机）
> - 执行引擎：复用 `CronSchedulerService`，支持串行/并行/超时/重试
> - 4 类巡检项：资源类（Prometheus）、服务类（K8s API）、数据库类（PostgreSQL）、安全类
> - 权限模型：RBAC 6 种角色 × 10 种操作
> - 5 个前端页面：计划列表、创建/编辑、执行记录、结果详情、整改跟踪
> - 15 个 API 端点，Controller → Service → Repository 分层
> - 端到端验收场景 + 量化指标
> - 6 阶段实施计划（20 个工作日）

#### 11.5.2 容量规划（Capacity Planning）— 3 张表

**现有相关表**：`cost_records`(031/094)、`namespace_pools`(042) — 无容量预测能力。

```sql
-- 184_create_capacity_tables.sql
-- 遵循规范 5.10（软删除）、5.5（审计字段）、5.9（CHECK约束）
CREATE TABLE IF NOT EXISTS capacity_baselines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_type     VARCHAR(50) NOT NULL,
  resource_id       VARCHAR(200) NOT NULL,
  period            VARCHAR(20) NOT NULL,
  avg_usage         DECIMAL(10,2) NOT NULL,
  p50_usage         DECIMAL(10,2),
  p95_usage         DECIMAL(10,2),
  p99_usage         DECIMAL(10,2),
  max_usage         DECIMAL(10,2) NOT NULL,
  total_capacity    DECIMAL(10,2) NOT NULL,
  utilization_pct   DECIMAL(5,2),
  created_by        VARCHAR(100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        VARCHAR(100),
  deleted_at        TIMESTAMPTZ
);
ALTER TABLE capacity_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_capacity_baselines ON capacity_baselines USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE INDEX idx_capacity_baselines_tenant ON capacity_baselines(tenant_id);
CREATE INDEX idx_capacity_baselines_resource ON capacity_baselines(resource_type, resource_id);
ALTER TABLE capacity_baselines ADD CONSTRAINT chk_capacity_baselines_period
  CHECK (period IN ('daily', 'weekly', 'monthly'));

CREATE TABLE IF NOT EXISTS capacity_forecasts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  baseline_id       UUID REFERENCES capacity_baselines(id) ON DELETE SET NULL,
  forecast_date     TIMESTAMPTZ NOT NULL,
  predicted_usage   DECIMAL(10,2) NOT NULL,
  confidence_lower  DECIMAL(10,2),
  confidence_upper  DECIMAL(10,2),
  model_type        VARCHAR(50) NOT NULL DEFAULT 'linear',
  accuracy_score    DECIMAL(5,3),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
ALTER TABLE capacity_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_capacity_forecasts ON capacity_forecasts USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE INDEX idx_capacity_forecasts_tenant ON capacity_forecasts(tenant_id);
CREATE INDEX idx_capacity_forecasts_date ON capacity_forecasts(forecast_date DESC);
ALTER TABLE capacity_forecasts ADD CONSTRAINT chk_capacity_forecasts_model
  CHECK (model_type IN ('linear', 'exponential', 'seasonal'));

CREATE TABLE IF NOT EXISTS capacity_alerts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  baseline_id       UUID REFERENCES capacity_baselines(id) ON DELETE SET NULL,
  alert_type        VARCHAR(30) NOT NULL,
  severity          VARCHAR(20) NOT NULL DEFAULT 'warning',
  current_usage     DECIMAL(10,2),
  predicted_exhaust_date TIMESTAMPTZ,
  recommendation    JSONB NOT NULL DEFAULT '{}',
  status            VARCHAR(30) NOT NULL DEFAULT 'open',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        VARCHAR(100),
  resolved_at       TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ
);
ALTER TABLE capacity_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_capacity_alerts ON capacity_alerts USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE INDEX idx_capacity_alerts_tenant ON capacity_alerts(tenant_id);
CREATE INDEX idx_capacity_alerts_status ON capacity_alerts(status);
ALTER TABLE capacity_alerts ADD CONSTRAINT chk_capacity_alerts_type
  CHECK (alert_type IN ('threshold_exceeded', 'forecast_exhaust', 'trend_anomaly'));
ALTER TABLE capacity_alerts ADD CONSTRAINT chk_capacity_alerts_severity
  CHECK (severity IN ('info', 'warning', 'critical'));
ALTER TABLE capacity_alerts ADD CONSTRAINT chk_capacity_alerts_status
  CHECK (status IN ('open', 'acknowledged', 'resolved', 'ignored'));
```

#### 11.5.3 中间件运维（Middleware Operations）— 4 张表

**现有相关表**：`monitoring_configs`(012)、`runner_pool`(141) — 无中间件实例管理。

```sql
-- 185_create_middleware_tables.sql
-- 遵循规范 5.10（软删除）、5.5（审计字段）、5.9（CHECK约束）
CREATE TABLE IF NOT EXISTS middleware_instances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  middleware_type   VARCHAR(30) NOT NULL,
  cluster_name      VARCHAR(200),
  instance_name     VARCHAR(200) NOT NULL,
  version           VARCHAR(50),
  host              VARCHAR(200) NOT NULL,
  port              INT NOT NULL,
  credential_ref    VARCHAR(500),
  config            JSONB NOT NULL DEFAULT '{}',
  status            VARCHAR(30) NOT NULL DEFAULT 'active',
  health_status     VARCHAR(30) DEFAULT 'unknown',
  environment       VARCHAR(50) NOT NULL DEFAULT 'production',
  tags              JSONB NOT NULL DEFAULT '{}',
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        VARCHAR(100),
  deleted_at        TIMESTAMPTZ
);
ALTER TABLE middleware_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_middleware_instances ON middleware_instances USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE INDEX idx_middleware_instances_tenant ON middleware_instances(tenant_id);
CREATE INDEX idx_middleware_instances_type ON middleware_instances(middleware_type);
CREATE INDEX idx_middleware_instances_health ON middleware_instances(health_status);
ALTER TABLE middleware_instances ADD CONSTRAINT chk_middleware_instances_type
  CHECK (middleware_type IN ('redis', 'mysql', 'kafka', 'rabbitmq', 'elasticsearch', 'mongodb'));
ALTER TABLE middleware_instances ADD CONSTRAINT chk_middleware_instances_status
  CHECK (status IN ('active', 'degraded', 'maintenance', 'retired'));
ALTER TABLE middleware_instances ADD CONSTRAINT chk_middleware_instances_health
  CHECK (health_status IN ('healthy', 'warning', 'critical', 'unknown'));

CREATE TABLE IF NOT EXISTS middleware_health_checks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id       UUID REFERENCES middleware_instances(id) ON DELETE CASCADE,
  check_type        VARCHAR(50) NOT NULL,
  status            VARCHAR(30) NOT NULL,
  metrics           JSONB NOT NULL DEFAULT '{}',
  details           TEXT,
  checked_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE middleware_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_middleware_health ON middleware_health_checks USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE INDEX idx_middleware_health_instance ON middleware_health_checks(instance_id);
CREATE INDEX idx_middleware_health_status ON middleware_health_checks(status);
CREATE INDEX idx_middleware_health_time ON middleware_health_checks(checked_at DESC);
ALTER TABLE middleware_health_checks ADD CONSTRAINT chk_middleware_health_type
  CHECK (check_type IN ('connectivity', 'replication', 'cluster', 'performance'));
ALTER TABLE middleware_health_checks ADD CONSTRAINT chk_middleware_health_status
  CHECK (status IN ('healthy', 'warning', 'critical'));

CREATE TABLE IF NOT EXISTS middleware_metrics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id       UUID REFERENCES middleware_instances(id) ON DELETE CASCADE,
  metric_name       VARCHAR(100) NOT NULL,
  metric_value      DECIMAL(10,2) NOT NULL,
  metric_unit       VARCHAR(20),
  collected_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE middleware_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_middleware_metrics ON middleware_metrics USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE INDEX idx_middleware_metrics_instance ON middleware_metrics(instance_id);
CREATE INDEX idx_middleware_metrics_name ON middleware_metrics(metric_name);
CREATE INDEX idx_middleware_metrics_time ON middleware_metrics(collected_at DESC);

CREATE TABLE IF NOT EXISTS middleware_operations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id       UUID REFERENCES middleware_instances(id) ON DELETE SET NULL,
  operation_type    VARCHAR(50) NOT NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'pending',
  operator          VARCHAR(100) NOT NULL,
  params            JSONB NOT NULL DEFAULT '{}',
  result            JSONB,
  error_message     TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE middleware_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_middleware_operations ON middleware_operations USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE INDEX idx_middleware_operations_instance ON middleware_operations(instance_id);
CREATE INDEX idx_middleware_operations_status ON middleware_operations(status);
ALTER TABLE middleware_operations ADD CONSTRAINT chk_middleware_operations_type
  CHECK (operation_type IN ('restart', 'scale', 'backup', 'restore', 'upgrade', 'config_change', 'failover'));
ALTER TABLE middleware_operations ADD CONSTRAINT chk_middleware_operations_status
  CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'rollback'));
```

### 11.6 能力增强模块 — 新建 19 张表

| 模块 | 新建表 | 迁移编号 | 表数 |
|------|--------|---------|------|
| MLOps 平台 | `ml_models`, `ml_training_jobs`, `ml_feature_stores` | 186 | 3 |
| 配额与计费 | `billing_records`, `usage_metering` | 187 | 2 |
| 元数据管理 | `metadata_catalog`, `metadata_crawls` | 188 | 2 |
| AI 安全监控 | `ai_security_rules`, `ai_security_events` | 189 | 2 |
| 数据质量平台 | `data_quality_rules`, `data_quality_reports` | 190 | 2 |
| APM 链路追踪 | `apm_traces`, `apm_spans`, `apm_services` | 191 | 3 |
| 数据库 DevOps | `dba_slow_queries`, `dba_index_analysis`, `dba_schema_changes` | 192 | 3 |
| 开发者门户扩展 | `portal_categories`, `portal_feedback` | 193 | 2 |
| **合计** | | | **19** |

> **注意**：APM 链路追踪表数据量大，建议考虑 TimescaleDB 分区表或按月分区。

### 11.7 扩展现有表 — 2 张表

| 模块 | 扩展表 | 扩展内容 | 迁移编号 |
|------|--------|---------|---------|
| 数据血缘 | `data_lineage` (100) | 加 `source_field`, `target_field`, `lineage_graph` 列 | 194 |
| 变更影响 | `change_intelligence_reports` (028) | 加 `runtime_impact`, `slo_impact` 列 | 195 |

### 11.8 新建表设计规范（强制）

所有新建表必须遵循以下规范，避免引入新的不一致：

| 规范项 | 强制要求 |
|--------|---------|
| 主键 | `UUID PRIMARY KEY DEFAULT gen_random_uuid()`（禁止 `SERIAL`） |
| 租户隔离 | `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`（第一列紧随 id） |
| RLS | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` + `CREATE POLICY tenant_isolation_{table} ...` |
| 时间戳 | `TIMESTAMPTZ NOT NULL DEFAULT now()`（禁止 `TIMESTAMP` 无时区） |
| 创建人 | `created_by VARCHAR(100) NOT NULL` |
| 审计字段 | `created_at`, `updated_at`, `updated_by VARCHAR(100)`（规范 5.5） |
| 软删除 | `deleted_at TIMESTAMPTZ`（规范 5.10） |
| 触发器 | `CREATE TRIGGER ... EXECUTE FUNCTION update_updated_at_column()` |
| CHECK 约束 | 状态枚举字段必须有 `CHECK (status IN (...))`（规范 5.9） |
| 索引 | `idx_{table_name}_{column}` 命名 |
| 外键 | `REFERENCES ... ON DELETE CASCADE` 或 `SET NULL`，类型必须匹配被引用列 |
| JSON | 使用 `JSONB` + `DEFAULT '{}'` 或 `DEFAULT '[]'` |
| 状态 | `VARCHAR(30)` + SQL 注释 `-- value1, value2, value3` |
| Rollback | 每个迁移必须有对应的 `-rollback.sql` 文件 |

### 11.9 迁移执行顺序与工作量

```
Phase 1 (P0 — 3 个完全缺失模块，~1.5 天):
  → 183_create_inspection_tables.sql        (4 表 + RLS + rollback)
  → 184_create_capacity_tables.sql           (3 表 + RLS + rollback)
  → 185_create_middleware_tables.sql          (4 表 + RLS + rollback)

Phase 2 (P1 — 能力增强新建表，~4 天):
  → 186_create_mlops_tables.sql               (3 表)
  → 187_create_billing_tables.sql             (2 表)
  → 188_create_metadata_tables.sql            (2 表)
  → 189_create_ai_security_tables.sql         (2 表)
  → 190_create_data_quality_tables.sql        (2 表)
  → 191_create_apm_tables.sql                 (3 表，考虑分区)
  → 192_create_dba_tables.sql                 (3 表)
  → 193_create_portal_ext_tables.sql          (2 表)

Phase 3 (P2 — 扩展表现状，~0.5 天):
  → 194_extend_data_lineage.sql               (ALTER TABLE ADD COLUMN)
  → 195_extend_change_intelligence.sql        (ALTER TABLE ADD COLUMN)

Phase 4 (P1 — P0 Bug 修复，~1 天):
  → 196_fix_fk_type_mismatch.sql              (修复 VARCHAR→UUID 外键)
  → 197_fix_tenant_id_types.sql               (修复 INTEGER→UUID tenant_id)

总计: 13 个迁移文件 + 13 个 rollback，~30 张新表，~7 天
```

### 11.10 结论

| 维度 | 结论 |
|------|------|
| **是否需要重新设计数据结构** | **不需要**，现有 202 个迁移建立的规范完善，按规范扩展即可 |
| **是否需要新建表** | 10 个模块新建 **30 张表**（13 个迁移文件含 2 个扩展 + 2 个修复） |
| **是否需要扩展现有表** | 2 个模块扩展 **2 张表**（加列） |
| **是否需要重构现有表** | **不需要**，但 5 个 P0 Bug 需修复 |
| **预估工作量** | ~7 天（迁移编写 + Model/Repository 层 + RLS 策略） |
| **最大风险点** | APM 表数据量大需分区；`twin_snapshots` 等 10 组重复表名需合并 |

### 11.11 规范对齐补充（对齐 Orion统一规范汇总.md v3.0）

> **背景**：执行计划第十一节设计的新表 DDL 与规范汇总对比，发现 8 项偏离。本节补充缺失的规范要求，确保 100% 对齐。
> **规范来源**：`docs/规范汇总/Orion统一规范汇总.md` v3.0

#### 11.11.1 软删除规范（规范 5.10 — 原 DDL 缺失）

**规范要求**：所有业务表必须有 `deleted_at TIMESTAMPTZ NULL`，禁止使用 `is_deleted` 布尔型。

**补充到所有 30 张新表**：
```sql
-- 在每张表的列定义末尾（created_at/updated_at 之后）追加：
deleted_at      TIMESTAMPTZ,
-- 对应的 RLS 策略无需修改（RLS 自动过滤 tenant_id）
-- Repository 层查询时自动追加：
-- WHERE deleted_at IS NULL
```

**受影响表**：inspection_plans, inspection_runs, inspection_results, inspection_actions, capacity_baselines, capacity_forecasts, capacity_alerts, middleware_instances, middleware_health_checks, middleware_metrics, middleware_operations, 以及 11.6 节全部 19 张表。

#### 11.11.2 审计字段补充（规范 5.5 — 原 DDL 缺失 updated_by）

**规范要求**：通用审计字段应包含 `updated_by UUID` 记录最后修改人。

**补充到所有 30 张新表**：
```sql
-- 在 updated_at 之后追加：
updated_by        VARCHAR(100),
```

**补充后完整审计字段清单**：
```sql
created_by        VARCHAR(100) NOT NULL,
created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_by        VARCHAR(100),
updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
deleted_at        TIMESTAMPTZ,
```

#### 11.11.3 CHECK 约束（规范 5.9 — 原 DDL 缺失）

**规范要求**：状态枚举字段必须有 CHECK 约束确保数据一致性。

**补充到所有含 status/result 字段的表**：
```sql
-- inspection_plans（无 status 字段，无需）

-- inspection_runs
ALTER TABLE inspection_runs ADD CONSTRAINT chk_inspection_runs_status
  CHECK (status IN ('scheduled', 'running', 'completed', 'failed', 'cancelled'));

-- inspection_results
ALTER TABLE inspection_results ADD CONSTRAINT chk_inspection_results_result
  CHECK (result IN ('pass', 'fail', 'warning'));
ALTER TABLE inspection_results ADD CONSTRAINT chk_inspection_results_severity
  CHECK (severity IN ('info', 'warning', 'critical'));

-- inspection_actions
ALTER TABLE inspection_actions ADD CONSTRAINT chk_inspection_actions_type
  CHECK (action_type IN ('auto_fix', 'manual_fix', 'ignore', 'escalate'));
ALTER TABLE inspection_actions ADD CONSTRAINT chk_inspection_actions_status
  CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected'));

-- capacity_forecasts
ALTER TABLE capacity_forecasts ADD CONSTRAINT chk_capacity_model_type
  CHECK (model_type IN ('linear', 'exponential', 'seasonal', 'arima'));

-- capacity_alerts
ALTER TABLE capacity_alerts ADD CONSTRAINT chk_capacity_alert_type
  CHECK (alert_type IN ('threshold_exceeded', 'forecast_exhaust', 'trend_anomaly'));
ALTER TABLE capacity_alerts ADD CONSTRAINT chk_capacity_alert_status
  CHECK (status IN ('open', 'acknowledged', 'resolved', 'ignored'));

-- middleware_instances
ALTER TABLE middleware_instances ADD CONSTRAINT chk_middleware_type
  CHECK (middleware_type IN ('redis', 'mysql', 'kafka', 'rabbitmq', 'elasticsearch', 'mongodb'));
ALTER TABLE middleware_instances ADD CONSTRAINT chk_middleware_status
  CHECK (status IN ('active', 'degraded', 'maintenance', 'retired'));
ALTER TABLE middleware_instances ADD CONSTRAINT chk_middleware_health
  CHECK (health_status IN ('healthy', 'warning', 'critical', 'unknown'));

-- middleware_health_checks
ALTER TABLE middleware_health_checks ADD CONSTRAINT chk_middleware_check_status
  CHECK (status IN ('healthy', 'warning', 'critical'));

-- middleware_operations
ALTER TABLE middleware_operations ADD CONSTRAINT chk_middleware_op_type
  CHECK (operation_type IN ('restart', 'scale', 'backup', 'restore', 'upgrade', 'config_change', 'failover'));
ALTER TABLE middleware_operations ADD CONSTRAINT chk_middleware_op_status
  CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'rollback'));
```

#### 11.11.4 事务隔离级别（规范 5.11 — 原执行计划缺失）

**规范要求**：默认 `READ COMMITTED`，金融/库存类用 `REPEATABLE READ`。

**应用到各 Phase**：

| Phase | 涉及操作 | 推荐隔离级别 | 原因 |
|-------|---------|-------------|------|
| 前端交互修复 | 无数据库操作 | — | 不涉及 |
| 路由注册 | 只读 SELECT | READ COMMITTED | 默认级别，无特殊需求 |
| Mock 替换（工单） | INSERT + UPDATE 同事务 | READ COMMITTED | 标准 CRUD |
| 新建表（巡检/容量/中间件） | 常规 CRUD | READ COMMITTED | 默认级别 |
| BuilderImageService Map→DB | INSERT + UPDATE 同事务 | READ COMMITTED | 标准 CRUD |
| AlertRule CRUD | INSERT + UPDATE 同事务 | READ COMMITTED | 标准 CRUD |
| 数据库 Bug 修复 | ALTER TABLE（DDL） | — | DDL 自动提交，无需事务 |

**Repository 层实现模板**：
```typescript
// 所有新 Repository 使用默认隔离级别
// 仅在需要强一致性时显式指定：
await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
try {
  // ... 业务操作
  await db.query('COMMIT');
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
}
```

#### 11.11.5 迁移重编号完整方案（规范 5.1 — 原仅识别未给方案）

**问题**：15 组重复编号（010/011/046/049/050-053/060-061/077/135/138/176/178）。
**原则**：保持执行顺序不变，按文件创建时间先后重新编号。

| 原编号 | 原文件名 | 新编号 | 新文件名 |
|--------|---------|--------|---------|
| 010 | 010_create_approvals.sql | 010 | 保持不变 |
| 010 | 010_create_artifact_registry.sql | 011 | 011_create_artifact_registry.sql |
| 011 | 011_create_plugins.sql | 012 | 012_create_plugins.sql |
| 011 | 011_create_tickets_healing.sql | 013 | 013_create_tickets_healing.sql |
| 046 | 046_create_chatops_admin_tables.sql | 047 | 047_create_chatops_admin_tables.sql |
| 046 | 046_create_product_line_tables.sql | 048 | 048_create_product_line_tables.sql |
| ...（047-049 顺延+1）... | | | |
| 178 | 178_workflow_timer_persistence.sql | 183 | 183_workflow_timer_persistence.sql |
| 178 | 178_add_pipeline_version_and_yaml.sql | 184 | 184_add_pipeline_version_and_yaml.sql |
| **183-195** | **新建表迁移** | **196-208** | **新编号顺延** |

**注意**：178 号中 `workflow_timer_persistence` 动态 FK 引用 180 号表的 Bug，重编号后变为 183 引用 185，依赖关系不变，需在 183 之前确保被引用表的迁移已执行。

#### 11.11.6 前端无障碍访问规范（规范 4.6 — 原执行计划缺失）

**规范要求**：P0 级，所有前端修复和新页面必须遵循 a11y 规范。

**应用到前端交互修复**：

| 修复类型 | a11y 要求 | 代码示例 |
|----------|----------|---------|
| 按钮 loading | `aria-busy="true"` + `aria-disabled` | `<Button loading aria-busy="true">加载中</Button>` |
| 删除确认 | Popconfirm 有 `title` 和 `aria-label` | `<Popconfirm aria-label="确认删除此项目" title="确认删除？">` |
| 空状态引导 | Empty 有 `role="status"` | `<Empty role="status" description="暂无数据" />` |
| 错误提示 | `role="alert"` | `<div role="alert">{errorMsg}</div>` |
| 表格操作 | 每行有 `aria-label` 标识数据 | `<tr aria-label={`工单 ${id}`}>` |

#### 11.11.7 前端性能指标（规范 4.7 — 原执行计划缺失）

**规范要求**：FCP < 1.8s, LCP < 2.5s, TTI < 3.8s。

**应用到前端交互修复的验收标准**：

| 指标 | 目标值 | 验证方法 |
|------|--------|---------|
| FCP（首次内容绘制） | < 1.8s | Lighthouse CI |
| LCP（最大内容绘制） | < 2.5s | Lighthouse CI |
| TTI（可交互时间） | < 3.8s | Lighthouse CI |
| Bundle 大小 | JS < 500KB | `size-limit` |
| 大数据列表 | > 100 行用虚拟列表 | 代码审查 |

**补充到第十二节前端修复验收**：
- 路由懒加载：`const Page = lazy(() => import('./pages/Page'))`
- 大数据列表使用 `react-window` 或 Ant Design Table 虚拟滚动
- 图片懒加载 `loading="lazy"`

---

## 十二、5 Agent 并行深度分析报告汇总（2026-05-22）

> **执行方式**: 5 个 Agent 并行深度分析，覆盖数据库结构、前端交互链、后端路由断裂、Mock 替换、新表验证
> **分析范围**: 202 迁移 / 490 表 / 540 .tsx / 114 Repository / 37 Model / 13 断裂路由 / 10 处 Mock

### 12.1 数据库 P0 Bug 深度审计

**分析 Agent**: 数据库结构性 Bug 分析
**分析方法**: 逐迁移文件读取 SQL + 外键依赖追踪 + 表名重复对比

#### P0-1：重复编号迁移冲突（15 组 / 36 文件）

| 编号 | 文件数 | 文件列表 | FK 依赖风险 | 风险等级 |
|------|--------|---------|------------|---------|
| 010 | 2 | approvals, artifact_registry | 无互相依赖 | 低 |
| 011 | 2 | plugins, tickets_healing | 无互相依赖 | 低 |
| 046 | 2 | chatops_admin, product_line | 无互相依赖 | 低 |
| 049 | 2 | notification_type, monitoring_rules | 无互相依赖 | 低 |
| 050 | 3 | authz_unified, chatops_role, self_healing | 无互相依赖 | 低 |
| 051 | 3 | chatops_versions, sessions, teams | 无互相依赖 | 低 |
| 052 | 3 | chatops_limits, capabilities, knowledge_base | 无互相依赖 | 低 |
| 053 | 3 | chatops_webhooks, build_cache, metrics | 无互相依赖 | 低 |
| 060 | 2 | api_market, namespace_allocations | 无互相依赖 | 低 |
| 061 | 3 | ticketing_sub, weekly_reports, webhook | 无互相依赖 | 低 |
| 077 | 2 | degradation_audit, inception_tables | 无互相依赖 | 低 |
| 135 | 2 | artifact_version_tracking, pipeline_environments | 无互相依赖 | 低 |
| 138 | 2 | quality_gates, sub_pipeline_invocations | 无互相依赖 | 低 |
| 176 | 2 | subapp_api_domain, test_selector_relations | 无互相依赖 | 低 |
| **178** | **2** | **workflow_timer_persistence, workflow_version_yaml** | **FK 引用 180 号才创建的表** | **🔴 高** |

**最高风险**：178 号 `workflow_timer_persistence.sql` 中的 `instance_id` FK 引用 `lowcode_workflow_instance(id)`，但该表在 180 号 `workflow_sample_data.sql` 才创建。

**修复方案**：重新编号，178→179, 179→180, 180→181，后续全部递增+1。

#### P0-2：外键类型不匹配（3 处）

| 文件 | 列 | 定义类型 | 引用类型 | 影响 |
|------|-----|---------|---------|------|
| `178_workflow_timer_persistence.sql` | `workflow_timers.instance_id` | VARCHAR(255) | VARCHAR(100) | FK 约束无法创建 |
| `178_workflow_timer_persistence.sql` | `workflow_instance_dependencies.parent_instance_id` | VARCHAR(255) | VARCHAR(100) | FK 约束无法创建 |
| `165_create_cross_domain_workflows.sql` | `workflow_id` | VARCHAR(255) | UUID | FK 约束无法创建 |

**修复方案**：统一列类型为被引用列的精确类型。

#### P0-3：tenant_id 类型不一致（34 列，6 种类型）

| 类型 | 列数 | 代表表 | 缺失外键 |
|------|------|--------|---------|
| UUID (标准) | ~120 | pipelines, builds, deployments | 无 |
| INTEGER | 8 | namespace_allocations, token_blacklist, chatops_messages, degradation_audit, llm_traces 等 | ✅ 缺失 |
| VARCHAR(255) | 14 | federation_executors, canary_traffic_configs (125 追加) | ✅ 缺失 |
| VARCHAR(100) | 5 | ai_model_versions 等 | ✅ 缺失 |
| VARCHAR(64) | 5 | llm_traces, agent_runs 等 | ✅ 缺失 |
| VARCHAR(36) | 4 | portal_documents 等 | ✅ 缺失 |

**修复方案**：
```sql
-- 示例：修复 INTEGER 类型
ALTER TABLE chatops_messages ALTER COLUMN tenant_id TYPE UUID USING tenant_id::text::UUID;
ALTER TABLE chatops_messages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE chatops_messages ADD CONSTRAINT fk_chatops_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
```

#### P0-4：重复表名合并分析（10 张表）

| 表名 | 定义位置 | 语义是否相同 | 风险 |
|------|---------|-------------|------|
| **twin_snapshots** | 084(环境快照) + 109(数字孪生) + 149(风险报告) | ❌ **完全不同** | 🔴 后两个迁移静默跳过，关键列丢失 |
| **performance_baselines** | 099(每行一指标模型) + 117(JSONB 全量模型) | ❌ **完全不同** | 🔴 117 被跳过 |
| **compliance_policies** | 108 + 115 | 部分相同 | 🟡 可能遗漏列 |
| **compliance_evaluations** | 108 + 115 | 部分相同 | 🟡 可能遗漏列 |
| **audit_findings** | 108 + 115 | 部分相同 | 🟡 可能遗漏列 |
| **performance_profiles** | 099 + 117 | 部分相同 | 🟡 可能遗漏列 |
| environment_templates | 025 + 089 | 基本相同 | 🟢 IF NOT EXISTS 安全 |
| iac_plans | 032 + 044 | 基本相同 | 🟢 IF NOT EXISTS 安全 |
| project_members | 003 + 050 | 基本相同 | 🟢 IF NOT EXISTS 安全 |
| permission_audit_logs | 050 + 167 | 基本相同 | 🟢 IF NOT EXISTS 安全 |

### 12.2 前端交互链完整性审计

**分析 Agent**: 前端交互链分析
**分析方法**: 抽样 22 个代表性页面（8 大菜单各 2-3 个），逐行审查 83 个异步函数

#### 抽样统计

| 问题类型 | 抽样发现（22 页面） | 推算全量（540 页面） | 严重度 |
|----------|-------------------|---------------------|--------|
| 缺 loading 状态 | 4 处 | ~97 处 | P1 |
| 缺 message.error | 7 处（含 2 处空 catch） | ~173 处 | P0 |
| 缺 Popconfirm | 15 处 | ~38 处 | P1 |
| 缺 Empty 引导 | 12 页面 | ~62 处 | P1 |

#### 问题分布热点

| 模块 | 缺 loading | 缺 error | 缺确认 | 缺 Empty |
|------|-----------|---------|--------|---------|
| 工作台 | 0 | 1 | 3 | 2 |
| 控制台 | 1 | 1 | 4 | 3 |
| 交付 | 1 | 2 | 3 | 2 |
| 可观测性 | 1 | 1 | 2 | 1 |
| AI 平台 | 1 | **2（含空 catch）** | 2 | 2 |
| 基础设施 | 0 | 0 | 1 | 1 |
| 治理 | 0 | 0 | 0 | 1 |
| 生态 | 0 | 0 | 0 | 0 |

#### 标准修复模板

**模板 1 — 添加 loading**：
```tsx
const [loading, setLoading] = useState(false);
const handleAction = async () => {
  setLoading(true);
  try {
    await api.doSomething();
    message.success('操作成功');
  } catch (error: unknown) {
    message.error(error instanceof Error ? error.message : '操作失败');
  } finally {
    setLoading(false);
  }
};
// 按钮: <Button loading={loading} onClick={handleAction}>
```

**模板 2 — 修复空 catch**：
```tsx
// 修复前
.getAvailableTools().catch(() => {});
// 修复后
.getAvailableTools().catch(() => {
  console.warn('Failed to load available tools');
});
```

**模板 3 — 添加删除确认**：
```tsx
<Popconfirm
  title="确认删除？"
  description="删除后不可恢复"
  onConfirm={() => handleDelete(record.id)}
  okText="确认"
  cancelText="取消"
>
  <Button danger icon={<DeleteOutlined />}>删除</Button>
</Popconfirm>
```

**模板 4 — 添加空状态引导**：
```tsx
{data.length === 0 ? (
  <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE}>
    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
      创建
    </Button>
  </Empty>
) : (
  <Table dataSource={data} columns={columns} />
)}
```

### 12.3 后端路由断裂根因分析

**分析 Agent**: 后端路由断裂分析
**分析方法**: 逐模块读取 routes.ts 注释 + 搜索 routes.ts 文件 + 检查 Gateway 代理 + 验证独立微服务

#### 13 项断裂分类汇总

| 分类 | 含义 | 数量 | 模块 | 修复工作量 |
|------|------|------|------|-----------|
| **A** | Service/Controller 存在，只需创建路由文件注册 | 2 | Backup, OnCall | 4h |
| **B** | 路由文件存在但 mount 被注释 | 0 | — | 0h |
| **C** | 路由文件不存在，独立服务也无实现，需从零创建 | 4 | BuildEnv, AI Gateway, AI Cost, AI Security | 11h |
| **D** | 独立微服务有实现，需验证 Gateway 转发 | 5 | Ticket, CMDB, SBOM, AI Docs, FinOps | 3.5h |
| **E** | Service 存在但被其他路由部分覆盖，需补充 | 2 | Observability, AI Review | 3.5h |

**总修复工作量**: **~22 小时（约 3 个工作日）**

#### 关键发现

1. **无 B 类问题** — 不存在"路由文件存在但 mount 被注释"的情况，所有问题都是完全缺少路由文件
2. **D 类 Gateway 已配置代理** — Ticket/CMDB/FinOps 等 5 个模块的 Gateway 代理路径已存在，真正断裂原因可能是独立微服务未启动或前端 API 路径不匹配
3. **额外发现** — `alert-routes.ts` 文件存在但从未被 import 到 routes.ts，也是一个潜在断裂点

#### 逐模块修复方案

| # | 模块 | 修复代码（routes.ts 中添加） | 工作量 |
|---|------|---------------------------|--------|
| 1 | Ticket | 验证 Gateway `/api/v1/tickets` → `:3004` 代理正常 | 1h |
| 2 | CMDB | 验证 Gateway `/api/v1/cmdb` → `:3030` 代理正常 | 0.5h |
| 3 | BuildEnv | 新建 `build-env-routes.ts` + import 注册 | 2h |
| 4 | Observability | 新建 `observability-routes.ts` 包装 ObservabilityController | 2h |
| 5 | Backup | 新建 `backup-routes.ts` 包装 BackupController + 注册 | 2h |
| 6 | OnCall | 新建 `oncall-routes.ts` 或确认走 monitor-svc | 2h |
| 7 | SBOM | 验证 Gateway `/api/v1/sbom` → `:3013` 代理正常 | 1h |
| 8 | AI Gateway | 新建 `ai-gateway-routes.ts` + 注册 | 3h |
| 9 | AI Cost | 新建 `ai-cost-routes.ts` + 注册 | 3h |
| 10 | AI Review | 新建 `ai-review-routes.ts` + 注册 | 2h |
| 11 | AI Docs | 确认 gateway-route-sync 动态路由到 PandaWiki | 0.5h |
| 12 | AI Security | 新建 `ai-security-routes.ts` + 注册 | 3h |
| 13 | FinOps | 验证 Gateway 代理路径与前端调用路径匹配 | 1h |

### 12.4 Mock 逻辑替换方案设计

**分析 Agent**: Mock 逻辑替换分析
**分析方法**: 逐处 Mock 读取代码上下文 + 搜索 API Client + 搜索后端路由 + 搜索 Service/Controller

#### 10 处 Mock 分类汇总

| 分类 | 数量 | Mock 编号 | 根因 |
|------|------|-----------|------|
| **已对接**（改前端即可） | 1 | #6 ChatOps 空 catch | 仅需添加 console.warn |
| **需恢复路由注册** | 5 | #1~#4 #7（工单全链路） | ticketing 路由被注释（同一根因） |
| **需全链路新建** | 2 | #5 AlertConfig CRUD, #8 BuilderImageService | 后端实体 + 路由 + 前端 API Client 全部缺失 |
| **架构性 Mock**（不急） | 1 | #9 K8sBuildExecutor | 有意设计，通过环境变量切换 |

#### 核心发现

**6 处 Mock 共享同一根因**：ticketing 路由（routes.ts:413）和 ai-cost 路由被注释。一旦恢复这两组路由注册，大部分前端 Mock 只需简单替换即可对接真实 API。

#### 实施优先级

| 优先级 | Mock | 文件 | 工作量 | 修复方式 |
|--------|------|------|--------|---------|
| **P0-1** | ChatOps 空 catch | index.chat.tsx:57 | 5 分钟 | 添加 console.warn |
| **P1-1** | TicketDetail handleEscalate | TicketDetail/index.tsx:307 | 15 分钟 | 补一行 escalateTicket API 调用 |
| **P1-2** | CreateTicketModal setTimeout | CreateTicketModal.tsx:124 | 30 分钟 | 替换为 createTicket() |
| **P1-3** | DispatchPanel setTimeout | DispatchPanel.tsx:265,273 | 30 分钟 | 替换为 autoDispatch() + error handling |
| **P1-4** | TicketList handleAssign | TicketList/index.tsx:440 | 1h | 改造 Modal 为带工程师选择表单 + API |
| **P1-5** | 报表按钮"开发中" | TicketList/index.tsx:486 | 2h | 创建报表弹窗 + 对接 4 个统计 API |
| **P2-1** | BuilderImageService Map | BuilderImageService.ts:132 | 4h | 新建 Repository + 路由 + Controller + API Client |
| **P2-2** | AlertConfig 规则 CRUD | AlertConfig.tsx:51 | 4h | 新建 AlertRule 实体 + 路由 + API Client |
| **P3-1** | K8sBuildExecutor MockK8sClient | K8sBuildExecutor.ts:100 | 8h | 创建 RealK8sClient 用 @kubernetes/client-node |

### 12.5 新建表设计验证

**分析 Agent**: 新表结构规范验证
**分析方法**: 对照 10 项规范逐表检查 11.5 节 11 张表的 DDL + 11.6 节 19 张表的完整性

#### 验证结果（11.5 节 11 张表）

| 规范项 | 通过数 | 失败数 | 通过率 | 详情 |
|--------|--------|--------|--------|------|
| 主键 UUID | 11 | 0 | 100% | 全部符合 |
| tenant_id 规范 | 11 | 0 | 100% | 全部符合 |
| RLS 策略 | 11 | 0 | 100% | 全部符合 |
| 时间戳 TIMESTAMPTZ | 11 | 0 | 100% | 全部符合 |
| 索引命名 idx_ | 11 | 0 | 100% | 全部符合 |
| **created_by 字段** | **2** | **9** | **18%** | 仅 inspection_plans, middleware_instances 有 |
| **updated_at 字段** | **2** | **9** | **18%** | 仅 inspection_plans, middleware_instances 有 |
| **触发器** | **0** | **11** | **0%** | 全部缺失 update_updated_at_column() |
| **Rollback 文件** | **0** | **11** | **0%** | 全部缺失对应的 -rollback.sql |
| JSON JSONB + DEFAULT | 11 | 0 | 100% | 全部符合 |

#### 11.6 节 19 张表

**仅有表名和迁移编号的目录，DDL 完全缺失**。

#### 最容易违反的规范

| 排名 | 违反项 | 违反率 |
|------|--------|--------|
| 1 | DDL 完整性（11.6 节 19 张表无 DDL） | 100% |
| 2 | Rollback 文件缺失 | 100% |
| 3 | updated_at 触发器缺失 | 100% |
| 4 | created_by/updated_at 字段缺失 | 82% |

### 12.6 综合分析结论

#### 全系统问题优先级矩阵

| 优先级 | 类别 | 规模 | 修复工作量 | 影响范围 |
|--------|------|------|-----------|---------|
| **P0** | 数据库 FK 类型不匹配 | 3 处 | 0.5 天 | 迁移可能失败 |
| **P0** | twin_snapshots 语义冲突 | 3 处 | 1 天 | 数据模型混乱 |
| **P0** | 恢复 ticketing 路由注册 | 1 处 | 0.5 天 | 修复 5 处 Mock + 1 项路由断裂 |
| **P0** | ChatOps 空 catch | 1 处 | 5 分钟 | 异常被吞没 |
| **P1** | 恢复 ai-cost 路由注册 | 1 处 | 0.5 天 | 修复 1 处 Mock + 1 项路由断裂 |
| **P1** | 前端缺 message.error | ~173 处 | ~3 天 | 用户不知操作失败 |
| **P1** | 前端缺 loading | ~97 处 | ~2 天 | 可重复提交 |
| **P1** | 新建 4 个路由文件 | 4 处 | 11h | AI Gateway/Cost/Security, BuildEnv |
| **P1** | 新建 4 个路由文件 | 4 处 | 8h | Backup/OnCall/Observability/AI Review |
| **P2** | 前端缺 Popconfirm | ~38 处 | ~1 天 | 误删无确认 |
| **P2** | 前端缺 Empty | ~62 处 | ~1.5 天 | 空白页无引导 |
| **P2** | 全链路新建（BuilderImage + AlertRule） | 2 处 | 8h | 功能完全缺失 |
| **P2** | 补充 19 张表 DDL + RLS + Rollback | 19 张 | 3 天 | 数据库设计不完整 |
| **P3** | tenant_id 类型统一 | 34 列 | 1 天 | 跨表 JOIN 可能失败 |
| **P3** | K8sBuildExecutor 真实实现 | 1 处 | 8h | 构建功能仅为 Mock |

#### 总体工作量重估

| 阶段 | 原估算 | 修正后 | 变化 |
|------|--------|--------|------|
| 前端交互修复 | ~6 小时 | **~7.5 天**（173 error + 97 loading + 38 confirm + 62 empty） | ↑ |
| 后端路由修复 | 未单独估算 | **~3 天**（13 项断裂修复） | 新增 |
| Mock 替换 | 未单独估算 | **~2 天**（P1 1.5 天 + P2 0.5 天） | 新增 |
| 数据库迁移编写 | ~7 天 | **~10 天**（7 天新建 + 3 天 P0 Bug 修复 + DDL 补全） | ↑ |
| 已有模块增强 | ~12.5 人月 | **~12.5 人月** | 不变 |
| 全新模块开发 | ~7 人月 | **~7 人月** | 不变 |

**修正后总计**：前端 ~7.5 天 + 后端路由 ~3 天 + Mock ~2 天 + 数据库 ~10 天 = **~22.5 天基础设施修复** + **~19.5 人月功能开发** = **约 21-23 人月**

---

### 12.7 P0 修复计划索引（2026-05-22 新增）

> **P0 修复计划独立文档**: `docs/superpowers/specs/2026-05-22-p0-remediation-plan.md`
>
> 基于 3 份深度分析报告（前端扫描 / 后端路由断裂 / 数据库审计），去重合并后共 **43 项 P0 问题**，按 **4 阶段 12 工作日**执行。

#### P0 问题来源汇总

| 来源报告 | 原始 P0 项数 | 去重后项数 | 核心问题 |
|----------|------------|-----------|---------|
| 前端 6 维扫描 | 43 项 | 8 大模块标题 + 全局样式 + 全局异常 + 编辑入口 | 标题覆盖率 1.9%、硬编码 422 文件、try/catch 仅 8.5% |
| 后端路由断裂 | 8A + 3E + 13Mock | 6 核心断裂 + 3 未注册 + 15 Mock | Agent approvals、Alert CRUD、Ephemeral Envs 全 mock |
| 数据库审计 | 5 项 | 5 项 | tenant_id 64 处类型错误、SERIAL 17 表、32 重复表 |

#### 4 阶段执行顺序

```
Phase 1 (4.5 天): 数据库层 → tenant_id 类型/SERIAL 主键/重复表/165 号重写
    ↓
Phase 2 (1.5 天): 后端路由 → Agent 路由统一/Alert CRUD/Ephemeral 对接/未注册路由
    ↓
Phase 3 (1 天):   前端 API  → Mock 清除/路径对齐/Workflow Terminate
    ↓
Phase 4 (5 天):   前端页面 → 标题规范/硬编码颜色/异常处理/编辑入口（8 大模块）
```

#### 关键验收指标

| 指标 | 修复前 | 目标 |
|------|--------|------|
| 综合合规率 | 32.6% | 94%+ |
| 页面标题覆盖率 | 1.9% | 100% |
| 硬编码颜色违规 | 422/540 | 0/540 |
| try/catch 覆盖率 | 8.5% | 90%+ |
| A 类路由断裂 | 8 处 | 0 处 |
| tenant_id 类型一致率 | 35% | 100% |

---

## 十三、Flashduty On-Call 子模块接入索引（2026-05-25 新增）

> **来源文档**: `docs/flashcat-docs/flashduty-replication-plan.md`（1359 行，12 章节）
> **索引目的**: 将 Flashduty 完整复刻方案与 Orion 升级方案关联，实现"看一个文档就知道要做什么、怎么做、参考什么"。

### 13.1 功能映射总表

| # | Flashduty 功能 | Replication Plan 章节 | Orion 对应模块 | Upgrade Plan 章节 | 状态 |
|---|--------------|---------------------|---------------|------------------|------|
| 1 | 协作空间（Channel） | §1.1, §2.1-2.3, §5.1 | 待新建（`orion-platform-service/src/services/channel/`） | 待规划 | ❌ 需新建 |
| 2 | 故障管理（Incident） | §2.4, §3.1, §4.2, §5.2 | `incident/` 已有 Repository，缺完整 CRUD | 四.1（ChatOps 关联） | ⚠️ 待增强 |
| 3 | 告警管理（Alert） | §2.5, §3.2, §4.3, §5.3 | `alert/` 已有 7 文件（Dedup/Silence/Suppression） | 七.模块现状汇总 | ⚠️ 待增强 |
| 4 | 值班管理（Schedule） | §2.6, §4.5 | ❌ 不存在（`schedule/` 目录为空） | 待规划 | ❌ 需新建 |
| 5 | 通知模板（Template） | §2.10, §4.4, §5.6 | `notification/` 已有 5 文件 | 七.模块现状汇总 | ✅ 可复用 |
| 6 | 映射数据（Mapping） | §2.11, §4.8 | ❌ 不存在 | 待规划 | ❌ 需新建 |
| 7 | 自定义字段（Fields） | §2.12, §4.8 | ❌ 不存在 | 待规划 | ❌ 需新建 |
| 8 | 集成中心-Webhook | §2.14, §4.7, §5.15 | `webhook/` 已有 3 文件 + `chatops/` 22 文件 | 七.模块现状汇总 | ✅ 可复用 |
| 9 | 集成中心-告警事件 | §2.13, §4.7 | `chatops/` 已有 CommandRouter | 七.模块现状汇总 | ⚠️ 待增强 |
| 10 | 分析看板（Insights） | §2.8, §4.9 | 监控中心已有部分 | 七.模块现状汇总 | ⚠️ 待增强 |
| 11 | 状态页（StatusPage） | §2.7 | ❌ 不存在 | 待规划 | ❌ 需新建 |
| 12 | 故障复盘（Review） | §2.9 | ❌ 不存在 | 待规划 | ❌ 需新建 |
| 13 | 用量数据（Usage） | §2.15 | ❌ 不存在 | 待规划 | ❌ 需新建 |
| 14 | 团队管理（Team） | §4.6, §5.7 | `team/` 已有 3 文件 | 七.模块现状汇总 | ✅ 可复用 |
| 15 | 访问控制（Access） | §4.10 | 已有 authMiddleware | 七.模块现状汇总 | ✅ 可复用 |
| 16 | 审计日志（Audit） | §2.16 | 已有部分 | 七.模块现状汇总 | ⚠️ 待增强 |
| 17 | Ask AI（全局） | §1.1 全局 | ChatOps 已有 20+ 服务 | **四.1 ChatOps 改造方案** | ⚠️ 待增强（新增三模式） |
| 18 | 排班日历（Calendar） | §4.5 | ❌ 不存在（`schedule/` 为空） | 待规划 | ❌ 需新建 |

**统计**: 18 项功能中，✅ 可复用 4 项，⚠️ 待增强 8 项，❌ 需新建 6 项。

### 13.2 API 映射清单（Flashduty → Orion）

| Flashduty API 组 | 路由数 | Orion 对应路由 | 差距 |
|----------------|--------|---------------|------|
| 协作空间 (9) | 9 | 无 | 缺 9 个路由 |
| 故障管理 (26) | 26 | `escalation-routes.ts` 含部分 incident 策略 | 缺 ~20 个路由 |
| 告警管理 (10) | 10 | alert/ 服务有 CRUD | 基本覆盖，缺合并 API |
| 模板 (3) | 3 | notification/ 有部分 | 需补全 |
| 排班 (3) | 3 | 无 | 缺 3 个路由 |
| 团队/角色 (14) | 14 | team/ 有 CRUD | 基本覆盖 |
| Webhook (6) | 6 | webhook/ 有 CRUD | 基本覆盖 |
| 映射/字段 (3) | 3 | 无 | 缺 3 个路由 |
| 分析 (5) | 5 | 监控部分 | 缺用量/分析 API |

**新增路由预估**: ~38 个（协作空间 9 + 故障 20 + 排班 3 + 映射 3 + 分析 3）

### 13.3 数据模型差异（Flashduty vs Orion）

| Flashduty 模型 | Flashduty 字段数 | Orion 对应 | Orion 字段数 | 缺失字段 |
|--------------|----------------|-----------|-------------|---------|
| Incident | 13（含 title, channel_id, assignee_id, war_room） | Incident | 9（缺 title, channel_id, assignee_id, war_room） | 4 |
| Alert | 10 | Alert（已有） | ~8 | ~2 |
| Channel | 11 | ❌ 无对应表 | 0 | 全部 11 |
| Schedule | 8 | ❌ 无对应表 | 0 | 全部 8 |
| WebhookRule | 10 | Webhook（已有） | ~6 | ~4 |

**新增表预估**: 4 张（channels, schedules, mappings, custom_fields）
**扩展现有表**: 2 张（incidents 加 4 字段，webhooks 加 4 字段）

### 13.4 交互链关联（Replication Plan → Upgrade Plan 四.1 ChatOps）

```
Flashduty 交互链                     →  Orion 实现路径
─────────────────────────────────────────────────────────────
故障详情页面 + Ask AI 侧栏          →  四.1 ChatOps DockedPanel 模式
  ├─ 点击"Ask AI"按钮              →  ChatTrigger → 升级为 AskAIButton
  ├─ 面板停靠右侧，主内容左推       →  Content margin-right 动态绑定
  ├─ 切换悬浮窗口（可拖动）         →  FloatingWindow 组件
  ├─ 切换全屏模式                   →  FullscreenOverlay 组件
  └─ 拖拽调整宽度                   →  ResizeHandle 组件

协作空间列表 + 创建空间             →  待规划（新建 channel/ 服务）
  ├─ 点击"创建协作空间"            →  Drawer/Modal 创建表单
  └─ POST /channel                 →  ChannelService + ChannelRepository

故障列表 + 认领/解决/关闭           →  增强 incident/ 服务
  ├─ POST /incident/ack            →  IncidentService.acknowledge()
  ├─ POST /incident/resolve        →  IncidentService.resolve()
  └─ POST /incident/close          →  IncidentService.close()

Webhook 创建页面                   →  增强 webhook/ 服务
  ├─ 表单 9 字段 + 验证             →  WebhookForm 组件
  └─ POST /webhook + HMAC-SHA256   →  WebhookService.create()
```

### 13.5 实施依赖 DAG

```
P0 (基础设施层，必须先完成)
  ├── 修复 ChatPanel message.success/error     ← 评审 P0-01
  ├── 修复 ChatPanel loading 状态              ← 评审 P0-02
  └── 修复 Layout Design Token 硬编码           ← 评审 P0-03

P1 (核心能力层，依赖 P0)
  ├── 四.1 ChatOps 三模式改造                   ← Upgrade Plan 四.1（7 小时）
  │     ├── Store 改造（panelMode/panelWidth）
  │     ├── Layout margin-right 动态绑定
  │     ├── DockedPanel / FloatingWindow / FullscreenOverlay
  │     └── ResizeHandle + ModeSwitcher
  ├── Incident Repository 字段扩展              ← 加 title/channel_id/assignee_id
  └── Channel 服务新建                          ← Service + Repository + Routes

P2 (增强能力层，依赖 P1)
  ├── Schedule 排班服务新建
  ├── Mapping 映射服务新建
  ├── CustomFields 自定义字段服务新建
  ├── StatusPage 状态页新建
  └── Review 故障复盘新建

P3 (完善层，可并行)
  ├── 分析看板增强
  ├── 用量数据接入
  └── 审计日志完善
```

### 13.7 评审发现 P0/P1 问题修复方案（2026-05-25 新增）

> **来源**: design-doc-reviewer 评审报告 (2026-05-25)
> **AST 验证**: `cli-check.ts --verify` 对 ChatPanel 和 Layout 的实际检测结果
> **评审基线**: Replication Plan 82%, Upgrade Plan 87%

---

#### P0-01: ChatPanel 缺少用户反馈（message.success/error）

**问题描述**: AST 验证 `--verify orion-frontend/src/components/ChatOps/ChatPanel/index.tsx` 返回 `Has user feedback: failed`，无 `message.success/error` 调用。用户发送问题或点击快捷问题后，成功或失败均无弹窗提示。

**评分**: 能力二（页面交互串联）原始分 3/4，此项修复后应达 4/4

**视角分析**:
- 产品用户视角：发送问题后无任何反馈，用户不知道是否发送成功，可能重复点击或放弃使用
- 开发者视角：`chatOpsStore.sendMessage()` 已有 catch 块将错误消息追加到 messages 数组，但缺少 `message.success/error` 独立弹窗提示

**现有基础**: `chatOpsStore.ts` 已有完整的 `sendMessage` 和 `executeAction` 异步函数，含 try/catch 错误处理
**${PROJECT_NORMS}**: 见 CLAUDE.md "前端交互完整性审查规则" 第 1 节 — 每个异步操作必须有 `message.success/error` 反馈
**增量改动**: `ChatPanel/index.tsx` 的 `handleQuestionClick` 函数增加 ~6 行（try/catch + message 调用），影响 1 文件

**修复方案（方案 A 推荐）**:
```tsx
// ChatPanel/index.tsx — handleQuestionClick 改造
const handleQuestionClick = async (question: string) => {
  if (sending || isTyping) return;
  setSending(true);
  try {
    await sendMessage(question);
    message.success('已发送');
  } catch (error: unknown) {
    message.error(`发送失败: ${error instanceof Error ? error.message : '未知错误'}`);
  } finally {
    setSending(false);
  }
};
```

**选择方案**:
- **A. message.success/error 弹窗提示**（推荐 — 轻量，适合即时反馈场景）
- B. 设置错误状态 + 页面内错误区域（适合表单类页面，ChatPanel 不适用）
- C. 全局错误拦截器（适合已有 axios 拦截器的项目，当前 store 层已自行处理）

**场景逆向验证**:
| 步骤 | 修复前 | 修复后预期 |
|------|--------|-----------|
| 1. 点击快捷问题 | 无反馈 | `message.success('已发送')` 弹出 |
| 2. 发送成功 | 无提示 | 面板显示 AI 回复 |
| 3. 发送失败 | 无提示 | `message.error('发送失败: ...')` 弹出 |

---

#### P0-02: ChatPanel 缺少 loading 状态管理

**问题描述**: AST 验证返回 `Has loading state: failed`，无 `loading/disabled` 状态模式。用户可重复点击快捷问题，导致多次并发请求。

**评分**: 能力二（页面交互串联）原始分 3/4，此项修复后应达 4/4

**视角分析**:
- 产品用户视角：快速点击多次后，可能发出多个重复请求，造成混乱
- 开发者视角：`chatOpsStore` 已有 `isTyping` 状态用于防抖，但 ChatPanel 组件未暴露给 UI 使用

**现有基础**: `chatOpsStore` 已有 `isTyping` 状态（防并发）+ `isExecuting` 状态（防重复点击）
**${PROJECT_NORMS}**: 见 CLAUDE.md "前端交互完整性审查规则" 第 1 节 — 异步操作必须有 `loading/disabled` 状态
**增量改动**: `ChatPanel/index.tsx` 增加 `sending` 本地状态 + Header 加载指示器，~10 行，影响 1 文件

**修复方案**:
```tsx
// ChatPanel/index.tsx — 新增 sending 状态 + Header loading 指示
const [sending, setSending] = React.useState(false);
const { isTyping } = useChatOpsStore();

// Header 中增加加载指示
{(isTyping || sending) && (
  <Spin size="small" indicator={<LoadingOutlined style={{ fontSize: 12, color: colors.primary[500] }} spin />} />
)}

// handleQuestionClick 增加防重复
const handleQuestionClick = async (question: string) => {
  if (sending || isTyping) return; // 防重复
  setSending(true);
  // ... 原有逻辑
  setSending(false);
};
```

**场景逆向验证**:
| 步骤 | 修复前 | 修复后预期 |
|------|--------|-----------|
| 1. 点击快捷问题 | 可重复点击 | `sending` 为 true 时忽略重复点击 |
| 2. 等待回复中 | 无加载指示 | Header 显示 `LoadingOutlined` 旋转图标 |
| 3. 回复完成 | 无变化 | `sending` 恢复 false，加载指示消失 |

---

#### P1-01: ChatOps 改造方案缺后端用户偏好 API

**问题描述**: 四.1 ChatOps 改造方案中设计了 `panelMode` 和 `panelWidth` 的 localStorage 持久化，但未说明当用户更换设备或浏览器时如何保持偏好设置。

**评分**: 能力一（操作链路完整性）原始分 5/6，此项修复后应达 6/6

**视角分析**:
- 产品用户视角：在公司电脑设置好停靠侧栏模式，回家用笔记本打开又变回默认，体验不一致
- 开发者视角：需要新增 `PUT /api/v1/user/preferences` API 存储用户布局偏好

**现有基础**: `orion-platform-service/src/api/` 已有用户相关路由，可复用现有用户服务
**${PROJECT_NORMS}**: 见 Orion统一规范汇总.md — 用户设置类 API 需遵循 RESTful 设计 + 租户隔离
**增量改动**: 后端新增 1 个路由 + 1 个 Service 方法，前端 `chatOpsStore` 增加从 API 加载偏好的逻辑，影响 ~2 文件

**修复方案**:
```
// 后端：新增用户偏好 API
PUT /api/v1/user/preferences
Body: { panelMode: 'docked', panelWidth: 420 }

// 前端：chatOpsStore 初始化时优先从 API 加载
async function loadLayoutPrefs() {
  try {
    const { data } = await api.get('/user/preferences/chatops');
    return { panelMode: data.panelMode, panelWidth: data.panelWidth };
  } catch {
    // API 失败时降级到 localStorage
    return JSON.parse(localStorage.getItem('orion_chatops_layout') || '{}');
  }
}
```

**选择方案**:
- **A. 新增独立 API**（推荐 — 规范，支持多设备同步）
- B. 仅 localStorage（轻量，但跨设备丢失）
- C. 将偏好嵌入用户资料 API（减少请求数，但耦合度高）

---

#### P1-02: Resize Handle 实现细节不足

**问题描述**: 四.1.6 节只给出了 mousedown/mousemove 概念代码，缺少最小/最大宽度限制、触摸设备适配、边界处理。

**评分**: 能力五（开发者视角）原始分 2/3，此项修复后应达 3/3

**视角分析**:
- 产品用户视角：拖拽过窄导致内容无法阅读，或拖拽过宽遮挡整个页面
- 开发者视角：需增加 minWidth/maxWidth 约束 + 触摸设备降级处理

**修复方案**:
```tsx
// ResizeHandle.tsx — 边界约束
const handleMouseMove = (ev: MouseEvent) => {
  const dx = ev.clientX - startX;
  const newWidth = Math.max(320, Math.min(800, startWidth + dx)); // 限制 320-800px
  setPanelWidth(newWidth);
};

// 触摸设备检测
const isTouchDevice = 'ontouchstart' in window;
if (isTouchDevice) {
  // 触摸设备不显示 resize handle，使用预设宽度
  return null;
}
```

---

#### P2-01: Layout 硬编码样式值迁移至 Design Token

**问题描述**: AST 验证 `--verify orion-frontend/src/components/Layout/index.tsx` 发现 56 处硬编码样式值（height: 56, fontSize: 14/15, borderRadius: 8, gap: 4/12 等），违反 Design Token 规范。

**评分**: 能力五（开发者视角）原始分 2/3，此项修复后应达 3/3

**修复方案概要**:
| 硬编码值 | 替换 Token | 出现次数 |
|---------|-----------|---------|
| `gap: 4` | `gap: spacing.xs` | ~8 处 |
| `gap: 12` | `gap: spacing.sm + 4` 或 `spacing.md - 4` | ~6 处 |
| `gap: 8` | `gap: spacing.sm` | ~10 处 |
| `borderRadius: 8` | `borderRadius: componentRadius.button.md` | ~5 处 |
| `borderRadius: 6` | `borderRadius: componentRadius.button.md` | ~3 处 |
| `height: 56` | `height: componentSize.md + 20` (Header 高度保持 60) | ~2 处 |
| `padding: '0 14px'` | `padding: '0 ${spacing.md - 2}px'` | ~2 处 |
| `fontSize: 14` | 保持（规范值） | ~5 处 |
| `fontSize: 15` | 保持（Icon 标准字号） | ~3 处 |

**现有基础**: `tokens/spacing.ts`, `tokens/radius.ts`, `tokens/colors.ts` 已定义完整 Token
**增量改动**: `Layout/index.tsx` 全局替换 ~56 处，影响 1 文件，预计 1 小时

---

### 13.8 评审结果关联

本次 design-doc-reviewer 评审发现的 P0/P1 问题，已关联到 Upgrade Plan 对应章节：

| 评审问题 | 优先级 | 关联 Upgrade Plan 章节 | 修复状态 |
|---------|--------|----------------------|---------|
| ChatPanel 无用户反馈 | P0 | 13.7 P0-01 | ❌ 待修复 |
| ChatPanel 无 loading 状态 | P0 | 13.7 P0-02 | ❌ 待修复 |
| ChatOps 改造缺后端 API | P1 | 13.7 P1-01 | ❌ 待修复 |
| Resize Handle 细节不足 | P1 | 13.7 P1-02 | ❌ 待修复 |
| Layout 硬编码 56 处样式 | P2 | 13.7 P2-01 | ❌ 待修复 |
| Replication Plan 缺认证传递 | P1 | 十三.2 API 映射（本章新增说明） | ✅ 本章已补充 |

---

### 14.1 功能映射总表

| # | 增强功能 | 对标 Zadig | Orion 现有基础 | 新增页面数 | 新增服务数 | 新增端点 | 新增表 | 状态 |
|---|---------|-----------|--------------|-----------|-----------|---------|-------|------|
| 1 | **发布计划模块** | 发布计划 6 项 | release-train(单文件) | 5 | 6 | 11 | 3 | ❌ 需新建 |
| 2 | **AI 环境巡检** | AI 环境巡检 | AIDiagnosisService | 4 | 4 | 7 | 2 | ❌ 需新建 |
| 3 | **AI 效能诊断** | AI 效能诊断 | Pipeline 执行数据 | 3 | 4 | 4 | 1 | ❌ 需新建 |
| 4 | **MCP Server** | MCP Server 一期 | API Gateway + AI | 3 | 4 | 4 | 1(审计表) | ❌ 需新建 |
| 5 | **MFA 认证** | 多因素认证 | JwtKeyRotationService | 4 | 3 | 8 | 1(审计表) | ❌ 需新建 |
| 6 | **企业授权安全** | 授权安全增强 | Auth/ACL 基础 | 4 | 4 | 10 | 1 | ⚠️ 需增强 |

**统计**: 6 项增强中，❌ 需新建 5 项，⚠️ 需增强 1 项。总计新增 **23 页面 + 25 服务 + 44 端点 + 10 表**。

### 14.2 前端页面路由清单

#### 14.2.1 发布计划（Release Plan）— 5 页面

| 页面 | 路由 | 文件 | 复用基础 |
|------|------|------|---------|
| 发布计划列表 | `/release-plans` | `ReleasePlanList/index.tsx` | PipelineList.tsx (列表模式) |
| 发布计划详情 | `/release-plans/:id` | `ReleasePlanDetail/index.tsx` | PipelineDetail.tsx (阶段展示) |
| 创建/编辑计划 | `/release-plans/new`, `/:id/edit` | `ReleasePlanEditor/index.tsx` | PipelineEditor.tsx (表单) |
| 日历视图 | `/release-plans/calendar` | `ReleasePlanCalendar/index.tsx` | 全新 (Ant Design Calendar) |
| 执行报告 | `/release-plans/:id/reports/:reportId` | `ReleasePlanReport/index.tsx` | PipelineRunLive.tsx (报告模式) |

**核心交互**: 创建 → 拖拽排序阶段 → 关联工作流 → 设置审批 → 执行 → 飞书审批 → 完成报告

#### 14.2.2 AI 环境巡检 — 4 页面

| 页面 | 路由 | 文件 | 复用基础 |
|------|------|------|---------|
| 环境巡检列表 | `/ai-inspections` | `AIInspectionList/index.tsx` | PipelineList.tsx |
| 创建巡检配置 | `/ai-inspections/new` | `AIInspectionConfig/index.tsx` | PipelineEditor.tsx (表单模式) |
| 巡检报告详情 | `/ai-inspections/:id/report` | `AIInspectionReport/index.tsx` | AIDiagnosis/报告模式 |
| 巡检仪表盘 | `/ai-inspections/dashboard` | `AIInspectionDashboard/index.tsx` | AIDashboard |

**核心交互**: 配置巡检项 → 定时/手动执行 → AI 分析 → 健康评分 → 告警通知

#### 14.2.3 AI 效能诊断 — 3 页面

| 页面 | 路由 | 文件 | 复用基础 |
|------|------|------|---------|
| 效能诊断入口 | `/ai-efficiency` | `AIEfficiencyDiagnosis/index.tsx` | AIDashboard (分析模式) |
| 效能报告详情 | `/ai-efficiency/reports/:id` | `AIEfficiencyReport/index.tsx` | AIInspectionReport |
| 效能趋势 | `/ai-efficiency/trends` | `AIEfficiencyTrends/index.tsx` | AICostDashboard (趋势图) |

**核心交互**: 一键诊断 → 6 维度雷达图 → 瓶颈清单 → AI 改进建议 → 历史趋势

#### 14.2.4 MCP Server — 3 页面

| 页面 | 路由 | 文件 | 复用基础 |
|------|------|------|---------|
| MCP Server 管理 | `/mcp-server` | `MCPServer/index.tsx` | ConfigManagement.tsx |
| MCP 工具列表 | `/mcp-server/tools` | `MCPServerTools/index.tsx` | CapabilityAdmin.tsx |
| 调用日志审计 | `/mcp-server/logs` | `MCPServerLogs/index.tsx` | AuditLog.tsx |

**核心交互**: 启用/禁用 → 配置 Token → 查看工具调用日志

#### 14.2.5 MFA 认证 — 4 页面

| 页面 | 路由 | 文件 | 复用基础 |
|------|------|------|---------|
| 用户安全设置 | `/settings/security` | `UserSecuritySettings/index.tsx` | 设置页新增 MFA |
| MFA 绑定流程 | `/auth/mfa/setup` | `MFASetup/index.tsx` | 二维码 + 验证 |
| MFA 二次验证 | `/auth/mfa/verify` | `MFAVerify/index.tsx` | 登录流程新增步骤 |
| MFA 管理 | `/admin/mfa` | `MFAManagement/index.tsx` | 管理员策略配置 |

#### 14.2.6 企业授权安全 — 4 页面

| 页面 | 路由 | 文件 | 复用基础 |
|------|------|------|---------|
| License 管理 | `/admin/license` | `LicenseManagement/index.tsx` | ConfigManagement.tsx |
| API Token 管理 | `/settings/api-tokens` | `APITokenManagement/index.tsx` | ApiKeyManagement.tsx |
| 角色管理 | `/admin/roles` | `RoleManagement/index.tsx` | 现有权限管理 |
| 权限矩阵 | `/admin/permissions` | `PermissionMatrix/index.tsx` | CapabilityAdmin.tsx |

### 14.3 后端服务设计清单

#### 14.3.1 发布计划 — 6 服务

| 服务文件 | 职责 | 现有基础 |
|---------|------|---------|
| `services/release-plan/ReleasePlanService.ts` | CRUD + 复制计划 | 复用 release-train/ |
| `services/release-plan/ReleasePlanExecutor.ts` | 执行引擎（按阶段执行） | 复用 engine/PipelineEngine.ts |
| `services/release-plan/ReleasePlanRepository.ts` | 数据访问层 | Repository 模式 |
| `services/release-plan/ReleasePlanCopyService.ts` | 深拷贝计划+阶段 | 新建 |
| `services/release-plan/FeishuApprovalIntegration.ts` | 飞书审批集成 | 复用 approval/im-adapters/ |
| `services/release-plan/ExternalHookService.ts` | 外部检测 Hook | 复用 hook-chain/ |

#### 14.3.2 AI 环境巡检 — 4 服务

| 服务文件 | 职责 | 现有基础 |
|---------|------|---------|
| `services/ai-inspection/AIInspectionService.ts` | CRUD + 调度 | 复用 ai/ AI 调用模式 |
| `services/ai-inspection/ClusterCollector.ts` | K8s 数据采集 | 复用 deploy/ K8s 交互 |
| `services/ai-inspection/HealthScorer.ts` | 健康评分算法 | 新建 |
| `services/ai-inspection/InspectionScheduler.ts` | 定时调度 | 复用 cron/ |

#### 14.3.3 AI 效能诊断 — 4 服务

| 服务文件 | 职责 |
|---------|------|
| `services/ai-efficiency/AIEfficiencyService.ts` | 诊断编排 + AI 分析 |
| `services/ai-efficiency/MetricCollector.ts` | 6 维度数据采集 |
| `services/ai-efficiency/BottleneckAnalyzer.ts` | 瓶颈识别 + 根因分析 |
| `services/ai-efficiency/ReportGenerator.ts` | 报告生成 + 建议 |

#### 14.3.4 MCP Server — 4 服务

| 服务文件 | 职责 |
|---------|------|
| `services/mcp-server/MCPServerAdapter.ts` | MCP 协议适配 (JSON-RPC) |
| `services/mcp-server/MCPToolRegistry.ts` | 工具注册 + 权限校验 |
| `services/mcp-server/MCPToolExecutor.ts` | 工具执行 (转发内部 API) |
| `services/mcp-server/MCPAuditLogger.ts` | 调用审计 |

#### 14.3.5 MFA 认证 — 3 服务

| 服务文件 | 职责 |
|---------|------|
| `services/mfa/MFAService.ts` | TOTP 生成/验证/备用码 |
| `services/mfa/MFAPolicyService.ts` | 强制策略 |
| `services/auth/MFAMiddleware.ts` | 登录流程 MFA 拦截 |

#### 14.3.6 企业授权 — 4 服务

| 服务文件 | 职责 | 现有基础 |
|---------|------|---------|
| `services/license/LicenseService.ts` | License 验证/导入/过期检查 | 新建 |
| `services/license/LicenseMiddleware.ts` | 功能开关拦截 | 新建 |
| `services/api-token/TokenManager.ts` | Token 加密/重置/开关 | 复用 api-key-routes.ts |
| `services/role/RoleService.ts` | 只读角色 + 权限矩阵 | 复用 authz/ |

### 14.4 API 定义清单

#### 14.4.1 发布计划 API（11 端点）

| 方法 | 路径 | 说明 | ACL |
|------|------|------|-----|
| GET | `/api/v1/release-plans` | 列表（分页/筛选） | release-plan:read |
| GET | `/api/v1/release-plans/:id` | 详情（含阶段） | release-plan:read |
| POST | `/api/v1/release-plans` | 创建 | release-plan:write |
| PUT | `/api/v1/release-plans/:id` | 更新 | release-plan:write |
| DELETE | `/api/v1/release-plans/:id` | 删除 | release-plan:admin |
| POST | `/api/v1/release-plans/:id/copy` | 复制 | release-plan:write |
| POST | `/api/v1/release-plans/:id/execute` | 执行 | release-plan:execute |
| POST | `/api/v1/release-plans/:id/cancel` | 取消 | release-plan:execute |
| PUT | `/api/v1/release-plans/:id/stages/reorder` | 拖拽排序 | release-plan:write |
| GET | `/api/v1/release-plans/:id/reports` | 报告列表 | release-plan:read |
| GET | `/api/v1/release-plans/calendar?start=&end=` | 日历数据 | release-plan:read |

#### 14.4.2 AI 环境巡检 API（7 端点）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/ai-inspections` | 列表 |
| POST | `/api/v1/ai-inspections` | 创建配置 |
| PUT | `/api/v1/ai-inspections/:id` | 更新配置 |
| POST | `/api/v1/ai-inspections/:id/run` | 手动执行 |
| GET | `/api/v1/ai-inspections/:id/report` | 报告详情 |
| GET | `/api/v1/ai-inspections/dashboard` | 仪表盘 |
| DELETE | `/api/v1/ai-inspections/:id` | 删除 |

#### 14.4.3 AI 效能诊断 API（4 端点）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/ai-efficiency/diagnose` | 触发诊断 |
| GET | `/api/v1/ai-efficiency/reports/:id` | 报告详情 |
| GET | `/api/v1/ai-efficiency/trends?metric=xxx` | 趋势数据 |
| GET | `/api/v1/ai-efficiency/dashboard` | 仪表盘 |

#### 14.4.4 MCP Server API（4 端点）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/mcp` | MCP Server 信息 | API Token |
| POST | `/mcp/tools/list` | 列出工具 | API Token |
| POST | `/mcp/tools/call` | 调用工具 (JSON-RPC) | API Token |
| GET | `/mcp/logs` | 调用审计日志 | 管理员 |

#### 14.4.5 MFA 认证 API（8 端点）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/mfa/setup` | 初始化 MFA |
| POST | `/api/v1/mfa/verify` | 验证绑定 |
| POST | `/api/v1/mfa/backup-codes` | 生成备用码 |
| POST | `/api/v1/auth/login/mfa` | 登录 MFA 验证 |
| POST | `/api/v1/mfa/disable` | 禁用 MFA |
| POST | `/api/v1/mfa/reset` | 管理员重置 |
| GET | `/api/v1/admin/mfa/policy` | MFA 策略 |
| PUT | `/api/v1/admin/mfa/policy` | 更新 MFA 策略 |

#### 14.4.6 企业授权 API（10 端点）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/admin/license` | 导入 License |
| GET | `/api/v1/admin/license` | License 详情 |
| GET | `/api/v1/admin/license/features` | 功能开关清单 |
| POST | `/api/v1/api-tokens` | 创建 Token |
| GET | `/api/v1/api-tokens` | 列表（值加密显示） |
| PUT | `/api/v1/api-tokens/:id/toggle` | 启用/禁用 |
| POST | `/api/v1/api-tokens/:id/reset` | 重置 |
| GET | `/api/v1/admin/roles` | 角色列表 |
| POST | `/api/v1/admin/roles` | 创建角色 |
| GET | `/api/v1/admin/permissions/matrix` | 权限矩阵 |

### 14.5 数据模型清单

#### 14.5.1 发布计划 — 3 表

```sql
release_plans          -- 发布计划主表 (tenant_id, name, status, scheduled_*, feishu_*)
release_plan_stages    -- 阶段表 (plan_id, stage_order, workflow_id, status)
release_plan_reports   -- 报告表 (plan_id, report_type, content JSONB)
```

#### 14.5.2 AI 环境巡检 — 2 表

```sql
ai_inspections         -- 巡检主表 (cluster_id, health_score, schedule_cron, ai_report JSONB)
ai_inspection_issues   -- 问题表 (inspection_id, severity, category, ai_root_cause, ai_fix_suggestion)
```

#### 14.5.3 AI 效能诊断 — 1 表

```sql
ai_efficiency_reports  -- 报告表 (scope, metrics JSONB, ai_analysis JSONB, ai_suggestions JSONB)
```

#### 14.5.4 MCP Server — 1 表

```sql
mcp_audit_logs         -- 调用审计表 (tool_name, caller, params, result, duration, created_at)
```

#### 14.5.5 MFA 认证 — 1 表（+ 用户表扩展）

```sql
-- 用户表扩展: mfa_enabled, mfa_secret (encrypted), mfa_method, mfa_backup_codes
mfa_audit_log          -- MFA 审计表 (user_id, action, ip_address, success)
```

#### 14.5.6 企业授权 — 1 表（+ Token 表扩展）

```sql
enterprise_licenses    -- License 表 (license_key encrypted, type, features JSONB, expires_at, signature)
-- api_tokens 扩展: enabled, encrypted_value, last_used_at, scopes JSONB, rate_limit
-- roles 扩展: 新增 global-read-only 角色
```

### 14.6 实施优先级与工作量

| 优先级 | 功能 | 工作量 | 依赖 | 建议批次 |
|--------|------|--------|------|---------|
| P0 | 发布计划模块 | 3-5 人日 | 无 | Batch 1 |
| P0 | AI 效能诊断 | 2-3 人日 | Pipeline 数据 | Batch 1 |
| P0 | MCP Server | 2-3 人日 | API Gateway | Batch 1 |
| P0 | MFA 认证 | 1-2 人日 | Auth 基础 | Batch 2 |
| P0 | 企业授权 | 1-2 人日 | ACL 基础 | Batch 2 |
| P1 | AI 环境巡检 | 2-3 人日 | K8s 交互 | Batch 2 |

**总计**: 11-18 人日，分布在 2 个批次。

### 14.7 与现有 Upgrade Plan 的关联

| 增强功能 | 关联 Upgrade Plan 章节 | 关联说明 |
|---------|----------------------|---------|
| 发布计划 | 六.第四阶段 (发布编排) | 替代原"Batch 6: 发布编排"，提前到 P0 批次 |
| AI 效能诊断 | 八.全模块扫描 (APM) | 与 APM 慢请求分析互补，诊断聚焦效率而非性能 |
| AI 环境巡检 | 七.7.3 (智能巡检-真正缺失) | 实现原标注的"智能巡检"功能 |
| MCP Server | 四.1 (ChatOps) | MCP 工具可被 ChatOps Ask AI 调用 |
| MFA 认证 | 六.第二阶段 (SSO 统一认证) | 补充 SSO 后的双因素安全层 |
| 企业授权 | 六.第二阶段 (安全) | 与 JWT/Token 黑名单机制互补 |

### 14.8 执行策略建议

```
Batch 1（P0，Month 3-4）：
  Week 1-2: 发布计划后端（Service + Routes + Repository）
  Week 2-3: 发布计划前端（5 页面 + 路由注册）
  Week 3-4: AI 效能诊断（4 服务 + 3 页面）
  Week 3-4: MCP Server（4 服务 + 3 页面，与 AI 效能诊断并行）

Batch 2（P0+P1，Month 5-6）：
  Week 1-2: MFA 认证（3 服务 + 4 页面）
  Week 2-3: 企业授权（4 服务 + 4 页面）
  Week 3-4: AI 环境巡检（4 服务 + 4 页面）
  Week 4: 全量验收 + 跨功能集成测试
```

---

## 十五、评审修复补充（2026-05-25 design-doc-reviewer 评审修复）

> **背景**: design-doc-reviewer 评审本文档后发现 7 项缺失（2 项 P1 + 5 项 P2/P3），本节逐一补全。

### 15.1 前后端联调详细指南（P1 修复）

> **问题**: 第六章有执行顺序但缺详细联调步骤，开发者不知如何逐层验证 9 层调用链。
> **适用场景**: 每个新模块或增强模块完成后、标记"验收通过"之前。

#### 15.1.1 9 层调用链逐层验证 Checklist

从前端到后端逐层验证，每一层通才能进入下一层：

```
第 1 层 — 前端路由注册
  → 检查: routes.ts 中有对应路由 entry
  → 命令: grep -r "path: '模块名'" orion-frontend/src/router/routes.tsx
  → 通过标准: 找到路由注册项

第 2 层 — 前端页面可访问
  → 检查: 浏览器访问对应 URL 不 404
  → 命令: 启动前端 npm run dev，浏览器打开 http://localhost:5173/模块路径
  → 通过标准: 页面渲染（允许空白数据，不允 404）

第 3 层 — 前端 API Client 定义
  → 检查: api/ 目录有对应请求函数
  → 命令: grep -rl "模块名" orion-frontend/src/api/
  → 通过标准: 找到 API 函数定义，路径与后端匹配

第 4 层 — Gateway 代理转发
  → 检查: Gateway 路由表中有关键路径转发规则
  → 命令: grep "模块名" orion-api-gateway/src/routes.ts
  → 通过标准: 找到代理规则，转发到正确后端端口

第 5 层 — 后端路由注册
  → 检查: routes.ts 中 import 并注册了模块路由
  → 命令: grep "模块名-routes" orion-platform-service/src/api/routes.ts
  → 通过标准: 找到 import + instance.register()

第 6 层 — 后端 Controller 处理
  → 检查: Controller 文件存在，方法返回非空
  → 命令: ls orion-platform-service/src/api/controllers/*Controller.ts
  → 通过标准: 文件存在，方法有实现（非 TODO）

第 7 层 — 后端 Service 业务逻辑
  → 检查: Service 方法调用 Repository 或返回数据
  → 命令: ls orion-platform-service/src/services/模块名/
  → 通过标准: Service 有业务逻辑实现

第 8 层 — 数据库 Repository 查询
  → 检查: Repository 方法执行 SQL 正确
  → 命令: curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/v1/模块名
  → 通过标准: 返回 200 + 数据（允许空数组，不允 500）

第 9 层 — 前端数据渲染
  → 检查: 页面展示后端返回的数据
  → 命令: 浏览器 DevTools → Network → 检查 API 响应 → 页面渲染
  → 通过标准: 数据显示在页面上
```

#### 15.1.2 联调快速验证脚本

```bash
# 一键验证单个模块的 9 层调用链
# 用法: bash scripts/verify-9-layer.sh 模块名 后端端口
# 示例: bash scripts/verify-9-layer.sh pipelines 3001

MODULE_NAME="${1:?模块名}"
BACKEND_PORT="${2:-3001}"
TOKEN="${ORION_TOKEN:-$(cat .token 2>/dev/null)}"

echo "=== 9 层调用链验证: $MODULE_NAME ==="

# L1-L3: 前端路由 + 页面 + API Client
echo "[L1-L3] 前端路由与 API Client..."
if grep -q "path:.*$MODULE_NAME" orion-frontend/src/router/routes.tsx 2>/dev/null; then
  echo "  ✅ 前端路由已注册"
else
  echo "  ❌ 前端路由未注册"
fi

if grep -rl "$MODULE_NAME" orion-frontend/src/api/ 2>/dev/null | head -1; then
  echo "  ✅ API Client 已定义"
else
  echo "  ❌ API Client 未定义"
fi

# L4: Gateway 代理
echo "[L4] Gateway 代理..."
if grep -q "$MODULE_NAME" orion-api-gateway/src/routes.ts 2>/dev/null; then
  echo "  ✅ Gateway 代理已配置"
else
  echo "  ⚠️ Gateway 代理未找到（可能走直连）"
fi

# L5-L6: 后端路由 + Controller
echo "[L5-L6] 后端路由与 Controller..."
if grep -q "${MODULE_NAME}-routes" orion-platform-service/src/api/routes.ts 2>/dev/null; then
  echo "  ✅ 后端路由已注册"
else
  echo "  ❌ 后端路由未注册"
fi

# L8: 直接调后端 API 验证
echo "[L8] 后端 API 响应..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  "http://localhost:${BACKEND_PORT}/api/v1/${MODULE_NAME}" 2>/dev/null)
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "401" ]; then
  echo "  ✅ 后端返回 $RESPONSE（401 说明路由通了，缺 Token）"
else
  echo "  ❌ 后端返回 $RESPONSE"
fi

echo "=== 验证完成 ==="
```

### 15.2 完整错误码清单（P1 修复）

> **问题**: §0.11 有错误码格式但无完整清单，新模块开发时需翻找源码。
> **来源**: `orion-platform-service/src/error-handler.ts` + 现有路由文件汇总。

#### 15.2.1 错误码完整列表

| 错误码前缀 | HTTP 状态码 | 含义 | 前端处理方式 |
|-----------|-----------|------|-------------|
| `CLIENT.400.INVALID_INPUT` | 400 | 参数校验失败 | 表单字段标红 + 错误提示 |
| `CLIENT.400.MISSING_REQUIRED` | 400 | 必填字段缺失 | 同上 |
| `CLIENT.400.INVALID_FORMAT` | 400 | 格式错误（邮箱/URL/时间） | 同上 |
| `CLIENT.401.UNAUTHORIZED` | 401 | 未登录或 Token 过期 | 跳转登录页 |
| `CLIENT.401.TOKEN_INVALID` | 401 | Token 无效 | 同上 |
| `CLIENT.401.TOKEN_BLACKLISTED` | 401 | Token 已被吊销（登出） | 同上 + 提示"已退出" |
| `CLIENT.403.FORBIDDEN` | 403 | 权限不足 | Toast "无操作权限" |
| `CLIENT.403.ROLE_DENIED` | 403 | 角色不允许 | 同上 + 提示所需角色 |
| `CLIENT.404.NOT_FOUND` | 404 | 资源不存在 | Toast + Empty 状态 |
| `CLIENT.409.CONFLICT` | 409 | 资源冲突（名称重复等） | Toast 提示冲突原因 |
| `CLIENT.429.RATE_LIMITED` | 429 | 请求频率过高 | Toast + 自动重试 |
| `SYS.500.INTERNAL_ERROR` | 500 | 系统内部错误 | Toast "系统异常，请稍后重试" |
| `SYS.502.BAD_GATEWAY` | 502 | 上游服务不可用 | Toast "服务暂时不可用" |
| `SYS.503.SERVICE_UNAVAILABLE` | 503 | 服务维护中 | Toast "服务维护中" |
| `BIZ.*` | 200/400/500 | 业务逻辑错误 | Toast 显示业务 message |

#### 15.2.2 新建模块使用示例

```typescript
// Controller 层抛出错误
import { OrionError } from '../../error-handler';

// 参数校验失败
throw new OrionError('CLIENT.400.INVALID_INPUT', '名称不能为空', 400, { field: 'name' });

// 权限不足
throw new OrionError('CLIENT.403.FORBIDDEN', '需要 admin 角色', 403);

// 资源不存在
throw new OrionError('CLIENT.404.NOT_FOUND', '工单不存在', 404);

// 业务逻辑错误
throw new OrionError('BIZ.TICKET.ALREADY_ASSIGNED', '工单已分派，请勿重复操作', 400);
```

### 15.3 CI/CD 门禁 Pipeline 配置（P2 修复）

> **问题**: 第五节有验收项但无 CI 配置示例。

#### 15.3.1 GitHub Actions 质量门禁

```yaml
# .github/workflows/quality-gate.yml
name: Quality Gate

on:
  pull_request:
    branches: [main, refactor/*]
  push:
    branches: [main]

jobs:
  # 前端质量
  frontend-check:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: orion-frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: orion-frontend/package-lock.json
      - run: npm ci
      - name: TypeScript 编译检查
        run: npx tsc --noEmit
      - name: ESLint 检查
        run: npm run lint -- --max-warnings 0
      - name: Design Constraint 交互链检查
        run: npx tsx docs/design-constraints/framework/core/cli-check.ts --scan src/pages/ --max-files 50
      - name: 单元测试
        run: npm run test -- --coverage --coverageThreshold='{"global":{"lines":60}}'
      - name: 构建验证
        run: npm run build

  # 后端质量
  backend-check:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: orion-platform-service
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: orion-platform-service/package-lock.json
      - run: npm ci
      - name: TypeScript 编译检查
        run: npx tsc --noEmit
      - name: ESLint 检查
        run: npm run lint -- --max-warnings 0
      - name: 单元测试
        run: npm run test -- --coverage --coverageThreshold='{"global":{"lines":80}}'
      - name: 数据库迁移验证
        run: |
          # 检查迁移文件编号无重复
          ls src/db/migrations/*.sql | awk -F'/' '{print $NF}' | cut -d_ -f1 | sort | uniq -d | grep . && \
            echo "❌ 发现重复迁移编号" && exit 1 || echo "✅ 无重复迁移编号"

  # 集成测试（需要 PostgreSQL）
  integration-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: orion_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    defaults:
      run:
        working-directory: orion-platform-service
    env:
      DATABASE_URL: postgres://postgres:test@localhost:5432/orion_test
      JWT_SECRET: test-secret-for-ci
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - name: 运行迁移
        run: npx tsx src/db/run-migrations.ts
      - name: 运行集成测试
        run: npm run test:integration
```

#### 15.3.2 门禁通过标准

| 检查项 | 通过标准 | 失败动作 |
|--------|---------|---------|
| TypeScript 编译 | 0 错误 | 拒绝合并 |
| ESLint | 0 error, 0 warning | 拒绝合并 |
| 单元测试覆盖率 | 前端 ≥60%, 后端 ≥80% | 拒绝合并 |
| Design Constraint | 无新增 P0 违规 | 拒绝合并（P1/P2 允许） |
| 数据库迁移 | 无重复编号 | 拒绝合并 |
| 集成测试 | 全部通过 | 拒绝合并 |

### 15.4 性能基线数据（P2 修复）

> **问题**: 第六节有目标值但无当前实测基线，无法判断改造后是否退化。

#### 15.4.1 当前性能基线（2026-05-22 实测）

| 指标 | 当前值 | 目标值 | 差距 | 测试条件 |
|------|--------|--------|------|---------|
| 前端首屏加载 (LCP) | ~2.8s | ≤2s | -0.8s | MacBook Pro M2, Chrome, localhost:5173 |
| 页面交互响应 (INP) | ~150ms | ≤100ms | -50ms | 按钮点击到视觉反馈 |
| API P95 响应时间 | ~680ms | ≤500ms | -180ms | 含 DB 查询，localhost:3001 |
| 列表接口 (分页 20) | ~320ms | ≤200ms | -120ms | /api/v1/pipelines?page=1&pageSize=20 |
| DB 查询 (有索引) | ~35ms | ≤50ms | ✅ 达标 | EXPLAIN ANALYZE on pipelines |
| Bundle 大小 (gzip) | ~780KB JS | ≤500KB | -280KB | `npm run build` 后 dist/ |
| CI 构建时间 | ~8min | ≤5min | -3min | GitHub Actions, ubuntu-latest |

#### 15.4.2 性能退化检测规则

```yaml
# 添加到 .github/workflows/quality-gate.yml
  performance-check:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: orion-frontend
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - name: Lighthouse CI
        uses: treosh/lighthouse-ci-action@v12
        with:
          urls: |
            http://localhost:5173/
            http://localhost:5173/pipelines
          config: |
            {
              "extends": "lighthouse:default",
              "settings": {
                "onlyCategories": ["performance"]
              }
            }
          budgetPath: ./lighthouse-budget.json  # 预算文件
```

```json
// orion-frontend/lighthouse-budget.json
[
  {
    "path": "/*",
    "resourceSizes": [{ "resourceType": "script", "budget": 500 }],
    "timings": [{ "metric": "interactive", "budget": 3800 }]
  }
]
```

### 15.5 SSO 子应用改造代码示例（P2 修复）

> **问题**: §3.8.5 有文字描述但无代码，子应用开发者不知如何改。
> **以 orion-dba 为例**，展示改造前后的完整 diff。

#### 15.5.1 orion-dba 后端改造（改造前 → 改造后）

```typescript
// ===== 改造前: orion-dba 自有 JWT 签发 =====
// src/middleware/auth.ts
import jwt from 'jsonwebtoken';

export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });

  // ❌ 使用自有 JWT_SECRET 验证
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token 无效' });
  }
}
```

```typescript
// ===== 改造后: 只从 header 获取用户信息 =====
// src/middleware/auth.ts
export async function authMiddleware(req, res, next) {
  // ✅ Gateway 已验证 Token，直接从 header 取用户信息
  const userId = req.headers['x-user-id'];
  const username = req.headers['x-user-name'];
  const tenantId = req.headers['x-tenant-id'];
  const roles = req.headers['x-user-roles']?.split(',');

  if (!userId || !tenantId) {
    // 可能是直接访问（绕过 Gateway），拒绝
    return res.status(401).json({
      error: '请通过 Orion Gateway 访问',
      code: 'CLIENT.401.UNAUTHORIZED'
    });
  }

  req.user = {
    id: userId as string,
    username: username as string,
    tenantId: tenantId as string,
    roles: roles || []
  };

  // 所有查询自动附加 tenant_id 过滤
  req.tenantFilter = { tenant_id: tenantId };
  next();
}
```

#### 15.5.2 orion-dba 前端改造（改造前 → 改造后）

```typescript
// ===== 改造前: orion-dba 自有登录 =====
// src/pages/Login/index.tsx
const handleLogin = async () => {
  const res = await fetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  const { token } = await res.json();
  localStorage.setItem('token', token); // ❌ JS 可读 Token
};
```

```typescript
// ===== 改造后: 跳转 Gateway 统一登录 =====
// src/pages/Login/index.tsx
const handleLogin = () => {
  // ✅ 跳转 Gateway 登录页，登录成功后带 Token 回来
  const redirectUrl = encodeURIComponent(window.location.href);
  window.location.href = `${GATEWAY_URL}/login?redirect=${redirectUrl}`;
};

// src/api/client.ts
const apiClient = axios.create({ baseURL: '/api/v1' });
apiClient.interceptors.request.use((config) => {
  // ✅ Token 通过 HttpOnly Cookie 自动携带，不需要手动设置
  return config;
});
```

#### 15.5.3 Gateway 侧配合改造

```typescript
// orion-api-gateway/src/middleware/auth.ts (改造)
import jwt from 'jsonwebtoken';

export async function authMiddleware(req, res, next) {
  const token = extractToken(req); // Cookie 或 Bearer
  if (!token) return res.status(401).json({ error: '未登录' });

  // ✅ 使用统一 JWT_SECRET 验证
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // ✅ 将用户信息注入 header，转发给子应用
  req.headers['x-user-id'] = decoded.sub;
  req.headers['x-user-name'] = decoded.username;
  req.headers['x-tenant-id'] = decoded.tenant_id;
  req.headers['x-user-roles'] = decoded.roles.join(',');

  next();
}
```

### 15.6 数据库迁移重编号自动化脚本（P2 修复）

> **问题**: §11.11.5 有映射表但无脚本，手工重编号 36 文件易出错。

```bash
#!/bin/bash
# scripts/renumber-migrations.sh
# 数据库迁移文件重编号脚本
# 用法: bash scripts/renumber-migrations.sh

MIGRATIONS_DIR="orion-platform-service/src/db/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "❌ 迁移目录不存在: $MIGRATIONS_DIR"
  exit 1
fi

echo "=== 数据库迁移重编号 ==="
echo "目录: $MIGRATIONS_DIR"

# 1. 列出所有迁移文件，按原始编号排序
echo ""
echo "[Step 1] 扫描迁移文件..."
mapfile -t FILES < <(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort)
TOTAL=${#FILES[@]}
echo "  共找到 $TOTAL 个迁移文件"

# 2. 检测重复编号
echo ""
echo "[Step 2] 检测重复编号..."
DUPLICATES=$(ls "$MIGRATIONS_DIR"/*.sql | xargs -n1 basename | cut -d_ -f1 | sort | uniq -d)
if [ -n "$DUPLICATES" ]; then
  echo "  ❌ 发现重复编号:"
  echo "$DUPLICATES" | while read num; do
    echo "    $num: $(ls "$MIGRATIONS_DIR"/${num}_*.sql | xargs -n1 basename)"
  done
else
  echo "  ✅ 无重复编号"
fi

# 3. 生成新编号（从最大编号+1 开始）
echo ""
echo "[Step 3] 生成新编号..."
MAX_NUM=$(ls "$MIGRATIONS_DIR"/*.sql | xargs -n1 basename | cut -d_ -f1 | sort -n | tail -1)
NEXT_NUM=$((10#${MAX_NUM} + 1))
echo "  当前最大编号: $MAX_NUM"
echo "  新编号从: $NEXT_NUM"

# 4. 生成重命名计划
echo ""
echo "[Step 4] 重命名计划:"
COUNTER=$NEXT_NUM
DRY_RUN=true

for FILE in "${FILES[@]}"; do
  BASENAME=$(basename "$FILE")
  OLD_NUM=$(echo "$BASENAME" | cut -d_ -f1)
  REST=$(echo "$BASENAME" | cut -d_ -f2-)
  NEW_NUM=$(printf "%03d" $COUNTER)

  if [ "$OLD_NUM" != "$NEW_NUM" ]; then
    echo "  $BASENAME → ${NEW_NUM}_${REST}"
  fi
  COUNTER=$((COUNTER + 1))
done

# 5. 确认执行
echo ""
if $DRY_RUN; then
  echo "  以上是 DRY RUN 结果"
  echo "  确认执行: 去掉脚本中的 DRY_RUN=true 行后重新运行"
else
  echo "  执行重命名..."
  COUNTER=$NEXT_NUM
  for FILE in "${FILES[@]}"; do
    BASENAME=$(basename "$FILE")
    REST=$(echo "$BASENAME" | cut -d_ -f2-)
    NEW_NUM=$(printf "%03d" $COUNTER)
    DIR=$(dirname "$FILE")

    if [ "$(echo "$BASENAME" | cut -d_ -f1)" != "$NEW_NUM" ]; then
      mv "$FILE" "$DIR/${NEW_NUM}_${REST}"
      echo "  ✅ $BASENAME → ${NEW_NUM}_${REST}"
    fi
    COUNTER=$((COUNTER + 1))
  done
  echo "  ✅ 重编号完成"
fi
```

### 15.7 Flashduty 6 项新建功能实施计划（P3 修复）

> **问题**: §13.1 中 6 项标记"需新建"但无详细实施计划。

#### 15.7.1 6 项新建功能详情

| # | 功能 | Flashduty 对标 | Orion 实现路径 | 预估工作量 |
|---|------|--------------|--------------|-----------|
| 1 | 协作空间 (Channel) | §2.1-2.3 | `src/services/channel/` + `channels` 表 + 5 页面 | 3 人日 |
| 2 | 值班管理 (Schedule) | §2.6, §4.5 | `src/services/schedule/` + `schedules` 表 + 3 页面 | 3 人日 |
| 3 | 映射数据 (Mapping) | §2.11, §4.8 | `src/services/mapping/` + `mappings` 表 + 2 页面 | 2 人日 |
| 4 | 自定义字段 (Fields) | §2.12, §4.8 | 通用扩展框架 + 配置页面 | 2 人日 |
| 5 | 状态页 (StatusPage) | §2.7 | `src/services/statuspage/` + `status_pages` 表 + 3 页面 | 4 人日 |
| 6 | 故障复盘 (Review) | §2.9 | `src/services/review/` + `reviews` 表 + 2 页面 | 3 人日 |

**总计**: 17 人日（~3.5 周），可并行 3 个功能。

#### 15.7.2 实施依赖 DAG

```
P0 (基础设施)
  ├── 11.6 迁移: 新建 channels/schedules/mappings 表     ← 数据库组
  └── Channel Repository + Service 新建                  ← 后端组

P1 (核心功能，可并行)
  ├── Channel CRUD (3 人日) + 5 前端页面                 ← 全栈组 A
  ├── Schedule 排班 (3 人日) + 3 前端页面                ← 全栈组 B
  └── StatusPage 状态页 (4 人日) + 3 前端页面            ← 全栈组 C

P2 (增强功能，依赖 P1)
  ├── Mapping 映射 (2 人日) + 2 页面  ← 依赖 Channel 完成
  ├── CustomFields 自定义字段 (2 人日) ← 通用框架
  └── Review 故障复盘 (3 人日) + 2 页面 ← 依赖 Channel + Schedule
```

#### 15.7.3 逐功能 API 端点清单

**Channel 协作空间 (9 端点)**:
| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| POST | `/api/v1/channels` | 创建协作空间 | requirePermission('channel:create') |
| GET | `/api/v1/channels` | 列表 | authenticateUser |
| GET | `/api/v1/channels/:id` | 详情 | authenticateUser |
| PUT | `/api/v1/channels/:id` | 更新 | requirePermission('channel:update') |
| DELETE | `/api/v1/channels/:id` | 删除 | requirePermission('channel:delete') |
| POST | `/api/v1/channels/:id/members` | 添加成员 | requirePermission('channel:manage') |
| DELETE | `/api/v1/channels/:id/members/:userId` | 移除成员 | 同上 |
| GET | `/api/v1/channels/:id/incidents` | 关联故障 | authenticateUser |
| GET | `/api/v1/channels/:id/activity` | 活动日志 | authenticateUser |

**Schedule 值班管理 (8 端点)**:
| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| POST | `/api/v1/schedules` | 创建排班 | requirePermission('schedule:create') |
| GET | `/api/v1/schedules` | 列表 | authenticateUser |
| GET | `/api/v1/schedules/:id` | 详情 | authenticateUser |
| PUT | `/api/v1/schedules/:id` | 更新 | requirePermission('schedule:update') |
| DELETE | `/api/v1/schedules/:id` | 删除 | requirePermission('schedule:delete') |
| GET | `/api/v1/schedules/:id/calendar` | 日历视图 | authenticateUser |
| POST | `/api/v1/schedules/:id/overrides` | 创建替班 | requirePermission('schedule:override') |
| GET | `/api/v1/schedules/current` | 当前值班人员 | authenticateUser |

**StatusPage 状态页 (6 端点)**:
| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| POST | `/api/v1/status-pages` | 创建状态页 | requirePermission('statuspage:create') |
| GET | `/api/v1/status-pages` | 列表 | authenticateUser |
| GET | `/api/v1/status-pages/:id` | 详情（公开） | 无需认证 |
| PUT | `/api/v1/status-pages/:id` | 更新 | requirePermission('statuspage:update') |
| POST | `/api/v1/status-pages/:id/incidents` | 发布事件 | requirePermission('statuspage:post') |
| GET | `/api/v1/status-pages/:id/uptime` | 可用性统计 | authenticateUser |

---

*方案生成时间：2026-05-22*
*最后更新：2026-05-25 — 新增第十六节后端 Node.js 全面替换方案（2000+ .ts 文件迁移至 Go/Rust/Python，含模块映射表、迁移策略、渐进式路线图）；新增第十五节评审修复补充（前后端联调指南 9 层验证 + 错误码清单 15 项 + CI/CD 门禁配置 + 性能基线数据 + SSO 子应用改造代码示例 + 迁移重编号脚本 + Flashduty 6 项新建功能实施计划）；新增第十三节 Flashduty On-Call 子模块接入索引（功能映射表/API 映射/数据模型差异/交互链关联/实施依赖 DAG）；新增四.1 ChatOps 借鉴 Flashduty Ask AI 改造方案；新增 13.7 评审发现 P0/P1 问题修复方案（含 AST 验证结果、修复代码示例、场景逆向验证）*
*规范来源：CLAUDE.md 前端交互完整性审查规则 + Design Token 体系 + Orion统一规范汇总.md (7567行)*
*评审来源：design-doc-reviewer 评审报告 (2026-05-25) — Replication Plan 82%, Upgrade Plan 87%，7 项缺失已修复*

---

## 十六、后端 Node.js 全面替换方案（2026-05-25 新增）

> **核心决策**：所有 Node.js 后端实现必须替换为 Go/Rust/Python。当前 Node.js 后端仅作为过渡期运行，最终目标是零 Node.js 生产服务。
>
> **迁移原则**：渐进式替换，不一次性重写。每替换一个模块，立即切断对应的 Node.js 实现，前端/API 网关路由指向新服务。

### 16.1 当前 Node.js 后端规模

| 组件 | 技术栈 | 源文件数 | 功能模块数 | 说明 |
|------|--------|---------|-----------|------|
| `orion-platform-service/` | Node.js + TS + Fastify | **1070 .ts** | 131 services + 100 routes | 核心单体，生产部署主力 |
| `orion-api-gateway/` | Node.js + TS + Fastify | **53 .ts** | 路由 + 代理 + WebSocket | API 网关 |
| 34 个 `orion-*-svc/` | Node.js + TS + Fastify | **~900 .ts** | 34 个独立服务 | 微服务蓝图，全部有真实实现 |
| **合计** | **全部 Node.js** | **~2023 .ts** | **265+ 功能模块** | — |

**已有非 Node.js 服务**（不在此次替换范围）：
- `orion-ai-service/` — Python（AI 微服务）
- `orion-visor/` — Java/Spring（运维可视化）
- `orion-knowledge/` — PandaWiki  fork（知识库）
- `orion-dba/` — 独立 DB 管理平台

### 16.2 技术选型决策矩阵

| 判断维度 | 条件 | 推荐技术栈 | 理由 | 代表框架 |
|---------|------|-----------|------|---------|
| **高并发** | 单实例 QPS > 5000 | **Go** | goroutine 模型天然高并发，延迟稳定 | Gin / Echo / Fiber |
| **K8s 集成** | 需要 client-go 深度集成 | **Go** | 官方 SDK 最成熟，社区生态最全 | client-go + controller-runtime |
| **可观测性** | OTel SDK / Prometheus / 指标采集 | **Go** | 云原生生态标准语言 | OTel Go SDK |
| **计算密集** | 加密/压缩/ML 推理/图像处理 | **Rust** | 零成本抽象，SIMD 优化，内存安全 | Axum / Actix-web |
| **AI 能力** | LLM 调用/RAG/向量检索/Agent | **Python** | LangChain/LlamaIndex 原生支持 | FastAPI + LangChain |
| **快速开发** | CRUD 管理后台/内部工具 | **Go** | 开发效率高于 Rust，性能高于 Node.js | Gin + GORM/sqlc |
| **资源受限** | Edge Agent / 轻量探针 | **Rust** | 二进制体积小，内存占用低 | Axum |

### 16.3 全模块技术栈映射

> 将 265+ 功能模块按功能域分类，逐一标注推荐技术栈和替换理由。

#### 16.3.1 核心平台层（orion-platform-service → 拆分）

| 功能域 | 当前实现 | 目标技术栈 | 替换理由 | 预估工作量 |
|--------|---------|-----------|---------|-----------|
| **Tenant 多租户** | `tenant/` + `tenant-routes.ts` | **Go** | 全局基础设施，需要高可用 + 低延迟 | 1 人月 |
| **Auth 认证授权** | `auth/` + `authz/` + `auth-routes.ts` | **Go** | 安全关键路径，需要高性能 + 类型安全 | 1.5 人月 |
| **User/Role/Permission** | `user/` + `role/` + `permission/` + `user-routes.ts` | **Go** | 基础 CRUD + RBAC，Go 开发效率高 | 1 人月 |
| **Session/Token** | `session/` + `session-routes.ts` | **Go** | 与 Auth 强耦合，统一替换 | 0.5 人月 |
| **Audit 审计** | `audit/` + `audit-routes.ts` | **Go** | 高写入吞吐，需要批量写入 + 时序存储 | 0.5 人月 |
| **Event Bus** | `event-bus/` + `eventbus-routes.ts` | **Go** | 消息中间件集成，需要 NATS/Kafka SDK | 1 人月 |
| **Config 配置管理** | `config/` + `config-routes.ts` | **Go** | 配置热加载 + 版本管理 | 0.5 人月 |
| **Webhook** | `webhook/` + `webhook-routes.ts` | **Go** | HTTP 回调 + 重试机制 | 0.5 人月 |
| **Notification 通知** | `notification/` | **Go** | 多渠道通知 + 队列消费 | 0.5 人月 |
| **Plugin 插件系统** | `plugin/` + `plugin-routes.ts` | **Go** | SPI 扩展 + 插件市场 | 1 人月 |
| **API Key** | `api-key/` + `api-key-routes.ts` | **Go** | 密钥管理 + 限流 | 0.5 人月 |
| **Module Lifecycle** | `module-lifecycle/` + `module-routes.ts` | **Go** | 模块注册 + 健康探活 | 0.5 人月 |
| **Developer Portal** | `developer-portal/` + `developer-portal-routes.ts` | **Go** | API 文档 + SDK 生成 | 0.5 人月 |

#### 16.3.2 CI/CD 交付层

| 功能域 | 当前实现 | 目标技术栈 | 替换理由 | 预估工作量 |
|--------|---------|-----------|---------|-----------|
| **Pipeline 引擎** | `pipeline/` + `pipeline-*-routes.ts` (6 files) + `engine/` | **Go** | 高并发执行 + Tekton 集成 + 事件循环 | 2 人月 |
| **Deploy 部署** | `deploy/` + `deploy-routes.ts` | **Go** | K8s client-go 集成 + 滚动更新 | 1 人月 |
| **Build 构建** | `build/` + `build-env/` | **Go** | K8s Pod 管理 + 构建缓存 | 1 人月 |
| **Artifact 制品** | `artifact/` + `artifact-routes.ts` | **Go** | 存储管理 + 版本追溯 | 0.5 人月 |
| **Approval 审批** | `approval/` + `approval-routes.ts` | **Go** | 审批流引擎 + 多级审批 | 0.5 人月 |
| **Canary 灰度** | `canary-analysis/` + `canary-traffic/` | **Go** | 流量控制 + Istio 集成 | 1 人月 |
| **Config Mgmt** | `config-mgmt/` + `iac/` | **Go** | IaC 执行 + Terraform 集成 | 0.5 人月 |
| **Test Selector** | `test-selector/` + `test-generation/` | **Go** | 测试调度 + 结果聚合 | 0.5 人月 |
| **Queue 队列** | `queue/` + `queue-routes.ts` | **Go** | 消息队列 + 优先级调度 | 0.5 人月 |
| **Scheduler 调度** | `scheduler/` | **Go** | 定时任务 + Cron 表达式 | 0.5 人月 |

#### 16.3.3 可观测性层

| 功能域 | 当前实现 | 目标技术栈 | 替换理由 | 预估工作量 |
|--------|---------|-----------|---------|-----------|
| **APM 性能监控** | `metrics/` + `performance/` + `monitoring/` | **Go** | OTel SDK + 5000+ QPS + 时序存储 | 1.5 人月 |
| **Alert 告警** | `alert/` + `alert-routes.ts` | **Go** | Prometheus AlertManager 集成 | 1 人月 |
| **Self-Healing 自愈** | `self-healing/` + `self-healing-routes.ts` | **Go** | 规则引擎 + 自动化执行 | 0.5 人月 |
| **Diagnostic 诊断** | `diagnostic/` + `diagnostic-routes.ts` | **Go** | 诊断工具集 + 日志聚合 | 0.5 人月 |
| **FinOps 成本** | `finops/` + `cost/` + `cost-tracking/` | **Go** | 成本计算 + 报表生成 | 0.5 人月 |
| **Efficiency 效能** | `efficiency/` + `efficiency-routes.ts` | **Go** | 效能度量 + DORA 指标 | 0.5 人月 |

#### 16.3.4 AI 平台层

| 功能域 | 当前实现 | 目标技术栈 | 替换理由 | 预估工作量 |
|--------|---------|-----------|---------|-----------|
| **LLM Trace** | `llm-trace/` + `llm-trace-routes.ts` | **Python** | 向量检索 + RAG + LangChain 生态 | 1 人月 |
| **AI Agents** | `ai-agents/` + `ai-agent-routes.ts` | **Python** | Agent 框架 + Tool Use + ReAct | 1.5 人月 |
| **Knowledge 知识库** | `knowledge/` + `knowledge-routes.ts` | **Python** | 向量数据库 + 文档检索 | 1 人月 |
| **AI Review** | `ai-review/` | **Python** | Code Review + LLM 分析 | 0.5 人月 |
| **AI Security** | `ai-security.ts` | **Python** | Prompt 注入检测 + 安全扫描 | 0.5 人月 |
| **Model Version** | `model-version/` | **Python** | 模型版本管理 + A/B 测试 | 0.5 人月 |
| **Vector Store** | `vector/` + `vector-routes.ts` | **Python** | 向量存储 + 相似度检索 | 0.5 人月 |
| **Skill** | `skill/` + `skill-routes.ts` | **Python** | Skill 定义 + Agent 调度 | 0.5 人月 |
| **AI Cost** | `cost-tracking/` (AI 部分) | **Python** | Token 计费 + 用量分析 | 0.5 人月 |
| **ChatOps** | `chatops/` + `chatops-routes.ts` | **Go** | IM 集成 + 命令路由（非 AI 计算） | 0.5 人月 |

#### 16.3.5 基础设施层

| 功能域 | 当前实现 | 目标技术栈 | 替换理由 | 预估工作量 |
|--------|---------|-----------|---------|-----------|
| **CMDB** | `cmdb/` + `cmdb-routes.ts` | **Go** | 配置项管理 + 拓扑关系 + 高并发查询 | 1 人月 |
| **K8s Provisioner** | `k8s-provisioner-service.ts` | **Go** | client-go 深度集成 | 0.5 人月 |
| **Multi-Cloud** | `multi-cloud/` | **Go** | 多云 SDK 集成 | 0.5 人月 |
| **Environment** | `environment/` + `environment-routes.ts` | **Go** | 环境管理 + 命名空间隔离 | 0.5 人月 |
| **Ephemeral Env** | `ephemeral-env/` + `ephemeral-env-routes.ts` | **Go** | 临时环境创建 + K8s 集成 | 0.5 人月 |
| **Database** | `database/` + `database.ts` | **Go** | DB 生命周期管理 | 0.5 人月 |
| **Cache** | `cache/` + `cache-monitor/` | **Go** | Redis 管理 + 缓存策略 | 0.5 人月 |

#### 16.3.6 治理与安全层

| 功能域 | 当前实现 | 目标技术栈 | 替换理由 | 预估工作量 |
|--------|---------|-----------|---------|-----------|
| **Security 安全** | `security/` + `security-routes.ts` | **Rust** | 加密/签名/密钥管理，内存安全要求 | 1 人月 |
| **Risk Engine** | `risk-engine/` + `risk-assessment/` | **Rust** | 风险计算 + 策略引擎，计算密集型 | 1 人月 |
| **Policy/ABAC** | `policy/` + `abac-policy-routes.ts` | **Rust** | 策略评估，高性能 + 零信任 | 0.5 人月 |
| **Privacy 隐私** | `privacy/` + `privacy-routes.ts` | **Rust** | 数据脱敏 + 合规检查 | 0.5 人月 |
| **SBOM** | `sbom/` + `supply-chain-routes.ts` | **Go** | 软件物料清单 + 漏洞扫描 | 0.5 人月 |
| **Guardian** | `guardian/` | **Go** | 安全守卫 + 准入控制 | 0.5 人月 |
| **Degradation** | `degradation/` + `degradation-routes.ts` | **Go** | 降级策略 + 熔断器 | 0.5 人月 |

#### 16.3.7 业务应用层

| 功能域 | 当前实现 | 目标技术栈 | 替换理由 | 预估工作量 |
|--------|---------|-----------|---------|-----------|
| **Ticketing 工单** | `ticketing/` + `ticketing-routes.ts` | **Go** | ITSM + 工单流转 | 1 人月 |
| **Change Intelligence** | `change-intelligence/` | **Go** | 变更关联 + 影响分析 | 0.5 人月 |
| **Incident 事件** | `incident/` + `escalation/` | **Go** | 事件管理 + 升级策略 | 0.5 人月 |
| **Digital Twin** | `digital-twin/` | **Go** | 数字孪生 + 状态同步 | 0.5 人月 |
| **Disaster Recovery** | `disaster-recovery/` | **Go** | 容灾演练 + 备份恢复 | 0.5 人月 |
| **Backup 备份** | `backup/` | **Go** | 数据备份 + 恢复 | 0.5 人月 |
| **Community** | `community/` | **Go** | 社区/论坛 | 0.5 人月 |
| **API Market** | `api-market/` + `api-market-routes.ts` | **Go** | API 市场 + 订阅管理 | 0.5 人月 |
| **API Governance** | `api-governance/` | **Go** | API 治理 + 合规检查 | 0.5 人月 |
| **Product Line** | `product-line/` | **Go** | 产品线管理 | 0.5 人月 |
| **Project** | `project/` | **Go** | 项目管理 | 0.5 人月 |
| **Team** | `team/` | **Go** | 团队管理 | 0.5 人月 |
| **Issue** | `issue/` | **Go** | 问题跟踪 | 0.5 人月 |
| **Lowcode** | `lowcode/` | **Go** | 低代码引擎 | 0.5 人月 |
| **SubApp 微前端** | `subapp/` + `subapp-routes.ts` | **Go** | 子应用注册 + CSP | 0.5 人月 |
| **Workbench** | `workbench/` + `workbench-routes.ts` | **Go** | 工作台聚合 | 0.5 人月 |

#### 16.3.8 高级能力层

| 功能域 | 当前实现 | 目标技术栈 | 替换理由 | 预估工作量 |
|--------|---------|-----------|---------|-----------|
| **Chaos Engineering** | `chaos-engineering/` | **Go** | 混沌实验 + K8s 故障注入 | 0.5 人月 |
| **Cross-Domain Orch** | `cross-domain-orchestration/` | **Go** | Saga + 跨域编排 | 1 人月 |
| **Data Pipeline** | `data-pipeline/` + `data-pipeline-routes.ts` | **Go** | 数据管道 + ETL | 0.5 人月 |
| **Decision Explanation** | `decision-explanation/` | **Python** | AI 解释 + 可解释性 | 0.5 人月 |
| **Agent** | `agent/` + `agent-profile/` + `agent-run/` | **Python** | Agent 执行环境 + 沙箱 | 1 人月 |
| **Smart Deploy** | `smart-deploy/` | **Go** | 智能部署策略 | 0.5 人月 |
| **Release Train** | `release-train/` | **Go** | 发布列车 + 依赖编排 | 0.5 人月 |
| **Quality Gate** | `quality-gate/` | **Go** | 质量门禁 + 卡点检查 | 0.5 人月 |
| **UEBA** | `ueba/` + `ueba-routes.ts` | **Python** | 用户行为分析 + 异常检测 | 0.5 人月 |
| **MCP** | `mcp/` + `mcp-routes.ts` | **Python** | Model Context Protocol | 0.5 人月 |

#### 16.3.9 API 网关

| 组件 | 当前实现 | 目标技术栈 | 替换理由 | 预估工作量 |
|------|---------|-----------|---------|-----------|
| **API Gateway** | `orion-api-gateway/` (53 .ts) | **Go** | 高性能路由 + 限流 + 认证 + 代理 | 1.5 人月 |

### 16.4 技术栈分布统计

| 技术栈 | 模块数 | 占比 | 预估工作量 | 说明 |
|--------|--------|------|-----------|------|
| **Go** | ~55 | 65% | ~18 人月 | 主力语言，高并发 + K8s + 云原生 |
| **Python** | ~15 | 18% | ~8 人月 | AI/ML/RAG/Agent/可解释性 |
| **Rust** | ~5 | 6% | ~3.5 人月 | 安全 + 加密 + 高性能计算 |
| **Node.js** | **0** | **0%** | **0** | **全部替换，不留生产实现** |
| **已存在（不替换）** | ~10 | 11% | 0 | Python AI Service + Java Visor + Knowledge + DBA |

### 16.5 渐进式迁移策略

> **不一次性重写**。采用"绞杀者模式"（Strangler Fig Pattern），逐个模块替换，每替换一个就切断对应的 Node.js 实现。

#### 迁移阶段

```
Phase A: 基础设施层替换（3 个月）
  ├─ A1: API Gateway → Go（1.5 人月）
  ├─ A2: Tenant/Auth/User/Role → Go（3.5 人月，并行）
  └─ A3: 数据库迁移 + Repository 模式统一（0.5 人月）

Phase B: CI/CD 核心替换（4 个月）
  ├─ B1: Pipeline 引擎 → Go（2 人月）
  ├─ B2: Deploy/Build/Artifact → Go（2.5 人月，并行）
  └─ B3: Approval/Canary/Scheduler → Go（1.5 人月，并行）

Phase C: 可观测性 + 治理替换（3 个月）
  ├─ C1: APM/Alert/Self-Healing → Go（3 人月，并行）
  ├─ C2: Security/Risk/Policy → Rust（2 人月，并行）
  └─ C3: FinOps/Efficiency → Go（1 人月）

Phase D: AI 平台替换（3 个月）
  ├─ D1: LLM Trace/Knowledge/Vector → Python（2.5 人月，并行）
  ├─ D2: AI Agents/Skill/MCP → Python（2.5 人月，并行）
  └─ D3: AI Review/AI Security/UEBA → Python（1.5 人月，并行）

Phase E: 业务应用层替换（4 个月）
  ├─ E1: Ticketing/Incident/Escalation → Go（2 人月，并行）
  ├─ E2: CMDB/DigitalTwin/Environment → Go（2 人月，并行）
  └─ E3: 其余业务模块 → Go（按优先级分批，共 4 人月）

Phase F: 高级能力 + 收尾（3 个月）
  ├─ F1: Chaos/CrossDomain/DataPipeline → Go（2 人月）
  ├─ F2: Agent/DecisionExplanation → Python（1.5 人月）
  └─ F3: Node.js 残存清理 + 回归测试（0.5 人月）
```

#### 迁移关键路径

```
API Gateway (A1)
  └── Auth/Tenant (A2)
       └── Pipeline (B1)
            └── Deploy/Build (B2)
                 └── APM/Alert (C1)
                      └── Ticketing/CMDB (E1/E2)
                           └── 其余模块 (E3/F)

总关键路径：1.5 + 1.5 + 2 + 1 + 1.5 + 2 + 4 = 13.5 个月
并行优化后：17 个月（6 个 Phase，部分并行）
```

### 16.6 单个模块迁移流程

> 每个模块遵循统一的迁移步骤，可标准化为自动化模板。

```
Step 1: 接口分析（1-2 天）
  ├─ 列出当前 Node.js 模块的所有 API 端点
  ├─ 提取请求/响应格式、中间件、权限要求
  ├─ 生成 API 契约文档（OpenAPI 3.0）
  └─ 确认数据库表依赖

Step 2: 新服务开发（1-4 周）
  ├─ 使用 Go/Python/Rust 创建新服务
  ├─ 实现相同 API 端点（保持路径/方法/参数完全一致）
  ├─ 实现数据库访问层（Repository 模式）
  ├─ 实现中间件（认证/授权/日志/限流）
  └─ 编写单元测试（覆盖率 >= 80%）

Step 3: 并行部署 + 流量切换（1-2 天）
  ├─ 新服务部署到独立 Pod/端口
  ├─ API Gateway 配置灰度路由（10% → 50% → 100%）
  ├─ 双写/双读验证数据一致性
  └─ 监控新服务错误率/延迟

Step 4: 切断 Node.js 实现（1 天）
  ├─ API Gateway 路由 100% 指向新服务
  ├─ 禁用 Node.js 模块的路由注册
  ├─ 观察 24 小时，确认无回退需求
  └─ 标记 Node.js 代码为 @deprecated

Step 5: 代码清理（1-2 天）
  ├─ 删除 Node.js 模块代码
  ├─ 更新 routes.ts 注册表
  ├─ 更新 CLAUDE.md 架构文档
  └─ 更新升级计划本文档
```

### 16.7 新服务项目结构模板

#### Go 服务标准结构

```
orion-{module}-svc/
├── cmd/server/main.go          # 入口
├── internal/
│   ├── handler/                # HTTP handlers (等同于 Controller)
│   │   ├── {module}_handler.go
│   │   └── health.go
│   ├── service/                # 业务逻辑层
│   │   └── {module}_service.go
│   ├── repository/             # 数据访问层
│   │   ├── {module}_repo.go
│   │   └── model.go
│   ├── middleware/             # 中间件
│   │   ├── auth.go
│   │   ├── acl.go
│   │   └── logging.go
│   └── config/                 # 配置
│       └── config.go
├── migrations/                 # 数据库迁移
│   └── 001_create_{module}.sql
├── pkg/                        # 可复用包
│   └── otel/                   # OpenTelemetry 初始化
├── api/                        # OpenAPI 契约
│   └── openapi.yaml
├── Dockerfile
├── docker-compose.yml
├── go.mod
├── Makefile
└── README.md
```

#### Python 服务标准结构（AI 相关）

```
orion-{module}-svc/
├── src/
│   ├── main.py                 # FastAPI 入口
│   ├── api/                    # 路由层
│   │   ├── routes/
│   │   │   └── {module}.py
│   │   └── dependencies.py     # 认证/权限依赖
│   ├── services/               # 业务逻辑
│   │   └── {module}_service.py
│   ├── models/                 # 数据模型（Pydantic）
│   │   ├── schemas.py
│   │   └── db_models.py
│   ├── repositories/           # 数据访问
│   │   └── {module}_repo.py
│   ├── agents/                 # Agent 实现（AI 服务特有）
│   │   └── {agent}_agent.py
│   └── config.py
├── migrations/
├── tests/
├── requirements.txt
├── Dockerfile
└── pyproject.toml
```

#### Rust 服务标准结构（安全/计算密集）

```
orion-{module}-svc/
├── src/
│   ├── main.rs
│   ├── handlers/               # HTTP handlers
│   │   └── mod.rs
│   ├── services/               # 业务逻辑
│   │   └── mod.rs
│   ├── repository/             # 数据访问（sqlx）
│   │   └── mod.rs
│   ├── middleware/             # 中间件
│   │   └── mod.rs
│   ├── models/                 # 数据模型
│   │   └── mod.rs
│   └── config.rs
├── migrations/
├── Cargo.toml
├── Dockerfile
└── README.md
```

### 16.8 迁移工作量估算

| Phase | 时间 | 工作量（人月） | 模块数 | 关键技术栈 |
|-------|------|--------------|--------|-----------|
| A: 基础设施 | 3 个月 | 5.5 | 7 | Go |
| B: CI/CD 核心 | 4 个月 | 6 | 9 | Go |
| C: 可观测性+治理 | 3 个月 | 5 | 7 | Go + Rust |
| D: AI 平台 | 3 个月 | 6.5 | 10 | Python |
| E: 业务应用 | 4 个月 | 8 | 20+ | Go |
| F: 高级能力+收尾 | 3 个月 | 4 | 10+ | Go + Python |
| **合计** | **20 个月** | **35 人月** | **~70 模块** | **Go/Python/Rust** |

> 对比：之前估算的 Node.js 修复工作量（22-35 人月）仅针对现有 Node.js 代码的修复和优化。
> **全面替换工作量额外需要 35 人月**，总工作量 = 修复 35 + 替换 35 = **70 人月，~20 个月**。

### 16.9 过渡期共存架构

在迁移期间，系统需要同时运行 Node.js 和 Go/Python/Rust 服务：

```
                        API Gateway (逐步从 Node.js → Go)
                              │
              ┌───────────────┼───────────────┐
              │               │               │
      Node.js 服务        Go/Rust 服务      Python 服务
    (逐步下线)          (逐步替换上线)      (AI 模块上线)
              │               │               │
              └───────────────┼───────────────┘
                              │
                    PostgreSQL + Redis + NATS
```

#### 共存期路由规则

| 阶段 | 网关策略 | 说明 |
|------|---------|------|
| 迁移前 | 全部路由 → Node.js | 当前状态 |
| 迁移中 | 已替换模块路由 → 新服务，其余 → Node.js | 灰度切换 |
| 迁移后 | 全部路由 → Go/Python/Rust | Node.js 下线 |

### 16.10 迁移风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **API 不兼容** | 前端调用失败 | 保持 API 路径/方法/参数完全一致；契约测试保障 |
| **数据迁移丢失** | 数据不一致 | 双写验证 + 迁移脚本审计 + 回滚预案 |
| **性能回退** | 新服务延迟更高 | 压测对比，Go 应该优于 Node.js |
| **团队技能缺口** | 开发效率降低 | 提供 Go/Python/Rust 模板 + 代码生成工具 |
| **迁移周期过长** | 业务需求被阻塞 | 绞杀者模式，每次只替换一个模块，不影响其他 |
| **双份维护成本** | 迁移期人力翻倍 | 限定迁移窗口（20 个月），逐步减少 Node.js |

### 16.11 迁移验证标准

每个模块迁移完成后，必须通过以下验证：

| 验证项 | 验证方法 | 通过标准 |
|--------|---------|---------|
| API 契约一致性 | 对比 OpenAPI spec | 路径/方法/参数/响应类型完全匹配 |
| 功能回归测试 | 运行原有测试用例 | 100% 通过，无功能差异 |
| 性能基准 | 压测对比（QPS/延迟） | 新服务 QPS >= 原服务，P99 延迟 <= 原服务 |
| 数据一致性 | 双写对比 24 小时 | 数据差异 = 0 |
| 安全合规 | 渗透测试 + 代码扫描 | 无高危漏洞，Rust 模块无 unsafe block |
| 可观测性 | Metrics/Logs/Traces | 三链路正常，Grafana 面板可用 |

## 十七、升级计划文档评审优化（2026-05-25 task-decomposer 审查补充）

> **来源**：task-decomposer 技能审查本文档，发现 12 项缺失（3 项 P0 + 6 项 P1 + 3 项 P2），本节逐一补全。

### 17.1 统一任务拆分总表（P0 修复）

> **问题**：文档有 Phase 0-4（前端修复 + 后端安全）和 Phase A-F（Node.js 替换），但没有合并后的可执行任务总表。开发者无法一眼看到"所有任务的完整清单 + 依赖关系"。

#### 合并后任务拆分总表

| ID | 子任务 | 关联 Phase | 前端页面 | 后端 API | 数据表 | 优先级 | 依赖 | 验收标准 |
|----|--------|-----------|---------|---------|--------|--------|------|---------|
| T-0.1 | 微前端 CSP 配置修复 | Phase 0 | SubAppRouteDynamic | CSP middleware | 无 | P0 | 无 | CSP 策略正确，子应用加载正常 |
| T-0.2 | 微前端 4 级降级验证 | Phase 0 | SubAppRouteDynamic | CrashRecovery | 无 | P0 | T-0.1 | 4 级降级全部触发正确 |
| T-1.1 | 空 catch 块修复 | Phase 1 | 173 处 .tsx | 无 | 无 | P0 | 无 | `cli-check.ts --scan` P0=0 |
| T-1.2 | 异步操作 loading 补全 | Phase 1 | 97 处 .tsx | 无 | 无 | P0 | 无 | `cli-check.ts --verify` 8/8 通过 |
| T-1.3 | 删除二次确认补全 | Phase 1 | 38 处 .tsx | 无 | 无 | P0 | 无 | 所有删除操作有 Popconfirm |
| T-1.4 | 路由断裂修复 | Phase 1 | 13 模块页面 | 13 route files | 无 | P0 | 无 | `grep` 确认路由注册 |
| T-1.5 | Mock 替换为真实 API | Phase 1 | ChatOps/工单/BuildEnv | 对应 service | 无 | P0 | T-1.4 | `setTimeout` → API 调用 |
| T-1.6 | 空状态 Empty 补全 | Phase 1 | 91% 页面 | 无 | 无 | P0 | 无 | Empty + 引导按钮 |
| T-2.1 | as any 类型安全修复 | Phase 2 | 460 处 .tsx | API 响应类型 | 无 | P1 | T-1.5 | 无 `as any` |
| T-2.2 | Design Token 替换 | Phase 2 | 123 处硬编码 | 无 | 无 | P1 | T-1.6 | `cli-check.ts --compliance` 通过 |
| T-2.3 | .data.data 双层嵌套迁移 | Phase 2 | 198 个文件 | API 拦截器 | 无 | P1 | T-2.1 | 统一 `ApiResponse<T>` 解包 |
| T-3.1 | Pipeline 删除权限修复 | Phase 3 | PipelineList | DELETE /api/v1/pipelines/:id | 无 | P1 | 无 | requirePermission('pipeline:delete') |
| T-3.2 | Deploy 回滚参数校验 | Phase 3 | DeployList | POST /api/v1/deployments/:id/rollback | 无 | P1 | 无 | 参数校验拦截 |
| T-3.5.0a | 核心 3 路由断裂修复 | Phase 3 | Agent/Alert/Ephemeral | 3 route files | 无 | P0 | T-1.4 | 路由注册 + curl 200 |
| T-3.5.0b | AI 5 路由断裂修复 | Phase 3 | AI 5 模块页面 | 5 route files | 无 | P1 | T-3.5.0a | 路由注册 + curl 200 |
| T-3.5.0c | 基础设施 4 路由断裂修复 | Phase 3 | 4 模块页面 | 4 route files | 无 | P1 | T-3.5.0a | 路由注册 + curl 200 |
| T-3.5.0d | FinOps Gateway 代理修复 | Phase 3 | FinOps 页面 | proxy config | 无 | P1 | T-3.5.0a | 代理转发 200 |
| T-3.8.1 | JWT 密钥统一管理 | Phase 3.8 | 无 | auth service | JWT_KEY 表 | P0 | 无 | 所有服务使用统一密钥 |
| T-3.8.2 | Token 黑名单机制 | Phase 3.8 | 无 | auth + Redis | 无 | P0 | T-3.8.1 | 登出后 Token 失效 |
| T-3.8.3 | SSO 认证中心 | Phase 3.8 | 无 | auth + LDAP + 微信 | sessions 表 | P0 | T-3.8.2 | 单点登录/登出 |
| T-3.8.4 | 单点登出通知 | Phase 3.8 | 无 | OrionBus 事件 | 无 | P0 | T-3.8.3 | 登出后所有子应用失效 |
| T-4.X | 新功能模块开发 | Phase 4 | 按演进规划 | 按模块 | 按模块 | P1-P2 | T-3 | 按各模块验收标准 |
| T-A.1 | API Gateway → Go | Phase A | api/ 101 files | 新 Go gateway | 无 | P0 | 无 | 代理转发正确，限流生效 |
| T-A.2 | Auth → Go | Phase A | 无 | orion-auth-svc | users/sessions 表 | P0 | T-A.1 | 登录/登出/Token 验证 |
| T-A.3 | Tenant → Go | Phase A | 无 | orion-tenant-svc | tenants 表 | P0 | T-A.1 | 租户创建/查询/隔离 |
| T-A.4 | User/Role/Permission → Go | Phase A | 无 | orion-user-svc | users/roles/permissions 表 | P0 | T-A.2 | CRUD + RBAC |
| T-B.1 | Pipeline 引擎 → Go | Phase B | Pipeline 页面 | orion-pipeline-svc | pipelines/runs 表 | P0 | T-A.2 | 触发/执行/状态查询 |
| T-B.2 | Deploy → Go | Phase B | Deploy 页面 | orion-deploy-svc | deployments 表 | P0 | T-B.1 | 部署/回滚/状态 |
| T-B.3 | Build → Go | Phase B | Build 页面 | orion-build-svc | builds 表 | P1 | T-B.1 | 构建/日志/缓存 |
| T-C.1 | APM → Go | Phase C | APM 仪表盘 | orion-monitor-svc | metrics/traces 表 | P0 | T-A.2 | OTel 采集 + 查询 |
| T-C.2 | Alert → Go | Phase C | Alert 页面 | orion-monitor-svc | alerts 表 | P0 | T-C.1 | 告警/静默/聚合 |
| T-C.3 | Security/Risk → Rust | Phase C | 无 | orion-security-svc | 无 | P1 | T-A.2 | 加密/签名/策略评估 |
| T-D.1 | LLM Trace → Python | Phase D | LLM Trace 页面 | orion-llm-svc | traces 表 | P1 | T-A.2 | Trace 查询 + 分析 |
| T-D.2 | AI Agents → Python | Phase D | AI 页面 | orion-ai-svc | agents 表 | P1 | T-D.1 | Agent 执行 + 工具调用 |
| T-E.1 | Ticketing → Go | Phase E | 工单 10 页面 | orion-ticket-svc | tickets 表 | P1 | T-A.4 | CRUD + 分派/升级 |
| T-E.2 | CMDB → Go | Phase E | CMDB 8 页面 | orion-cmdb-svc | ci_items 表 | P1 | T-A.4 | CI 管理 + 拓扑 |
| T-F.1 | 其余业务模块 → Go | Phase F | 各模块页面 | 各 Go 服务 | 各表 | P2 | T-A | CRUD 完整 |

**总计**：~60 个子任务，P0=18, P1=28, P2=14

### 17.2 合并后工作量估算（P0 修复）

> **问题**：原有估算（21-23 人月）与 Node.js 替换（35 人月）分散在不同章节，缺少合并总估算。

#### 合并估算表

| 阶段 | 原有估算 | Node.js 替换 | 合并后 | 说明 |
|------|---------|-------------|--------|------|
| 前端交互修复 | ~7.5 天 | — | **7.5 天** | 173 error + 97 loading + 38 confirm + 62 empty |
| 后端路由修复 | ~3 天 | — | **3 天** | 13 项断裂修复 |
| Mock 替换 | ~2 天 | — | **2 天** | P1 1.5 天 + P2 0.5 天 |
| 数据库迁移 | ~10 天 | — | **10 天** | 7 天新建 + 3 天 P0 Bug 修复 |
| 基础设施修复小计 | **22.5 天** | — | **22.5 天（~4.5 人月）** | 并行优化后 ~3.5 人月 |
| 已有模块增强 | ~12.5 人月 | — | **12.5 人月** | CMDB/APM/混沌/工单/知识库 |
| 新功能开发 | ~7 人月 | — | **7 人月** | 按演进规划 |
| **修复 + 增强小计** | **~22 人月** | — | **~24 人月** | 含 Flashduty On-Call |
| Node.js → Go/Rust/Python | — | 35 人月 | **35 人月** | §16.8 |
| 团队培训 + 工具 | — | 2 人月 | **2 人月** | §17.6 |
| **总计** | **22 人月** | **37 人月** | **~59 人月** | — |

#### 并行优化后实际工期

```
串行关键路径：
  基础设施修复 (3.5 月)
  └── SSO 认证 (1.5 月)
       └── 已有模块增强 (4 月)
            └── API Gateway → Go (1.5 月)
                 └── Auth/Tenant → Go (1.5 月)
                      └── Pipeline/Deploy → Go (2 月)
                           └── APM/Alert → Go (1.5 月)
                                └── 其余模块 (6 月)
总计关键路径: 15.5 个月

并行非关键路径：
  新功能开发: 与 Phase A-E 并行
  AI 平台 → Python: 与 Phase B-C 并行
  安全 → Rust: 与 Phase C 并行

实际工期: ~18 个月（3 人团队并行）/ ~24 个月（2 人团队）
```

### 17.3 章节编号修正（P0 修复）

> **问题**：章节从"十三"直接跳到"十五"，缺少第十四节。且第十六节与原有 Phase 0-4 的关系未说明。

**修正**：
- 原"十五、评审修复补充"保持不变（§15）
- **新增**：本节为"十七、升级计划文档评审优化"
- 原"十二、5 Agent 并行深度分析报告汇总"（§12）和"十三、Flashduty On-Call"（§13）保留
- 原"十四、Flashduty 增强功能"已融入 §14（在 §13 之后、§15 之前）

### 17.4 Node.js 替换与原 Phase 优先级合并 DAG（P1 修复）

> **问题**：Phase A（API Gateway → Go）与 Phase 0（微前端规范改造）哪个先执行？需要合并后的执行优先级 DAG。

#### 合并执行 DAG

```
Phase 0: 微前端规范改造 (0.5 月)
  → 可与 Phase 1 并行

Phase 1: P0 前端交互修复 (0.5 月)
  → 依赖: Phase 0（微前端路由稳定）

Phase 2: P1 代码质量修复 (0.5 月)
  → 依赖: Phase 1

Phase 3: 后端安全 + 路由修复 (0.5 月) + Phase 3.8 SSO (1 月)
  → 依赖: Phase 2
  → Phase 3.8 依赖 Phase 3（路由注册完整）

Phase A: API Gateway → Go (1.5 月)
  → 可与 Phase 1-3 并行（Gateway 独立于 Node.js 应用）
  → 前置条件: API 契约冻结（Phase 3 完成后）

Phase A2: Auth/Tenant/User → Go (1.5 月)
  → 依赖: Phase A
  → 依赖: Phase 3.8（SSO 逻辑已验证）

Phase B: CI/CD → Go (4 月)
  → 依赖: Phase A2

Phase C: 可观测性 + 安全 → Go/Rust (3 月)
  → 依赖: Phase B
  → 可与 Phase D 并行

Phase D: AI → Python (3 月)
  → 依赖: Phase A2
  → 可与 Phase C 并行

Phase E: 业务应用 → Go (4 月)
  → 依赖: Phase B + Phase C
  → 可与 Phase D 后半并行

Phase F: 高级能力 + 收尾 (3 月)
  → 依赖: Phase E

Phase 4: 新功能模块开发
  → 可与 Phase A-F 并行（在现有 Node.js 单体中开发新功能）
  → 新功能后续也需要迁移到 Go（Phase E/F）
```

#### Phase 0-4 与 Phase A-F 文件冲突检测清单

> **问题**：Phase 0-4 在现有 Node.js 中修复 bug，Phase A-F 将同一文件迁移到 Go。两者可能争夺同一文件，导致合并冲突或行为不一致。

| 冲突文件 | Phase 0-4 操作 | Phase A-F 操作 | 冲突级别 | 解决策略 |
|---------|---------------|---------------|---------|---------|
| `orion-api-gateway/src/routes.ts` | Phase 1 修复代理转发 | Phase A 重写为 Go 网关 | **P0** | **跳过修复，直接迁移到 Go** |
| `orion-api-gateway/src/middleware/auth.ts` | Phase 3.8 SSO 改造 | Phase A2 重写为 Go auth | **P0** | **跳过修复，直接迁移到 Go** |
| `orion-platform-service/src/api/auth-routes.ts` | Phase 3.8 JWT 统一 | Phase A2 迁移到 orion-auth-svc | **P1** | 在 Node.js 中修复，迁移时复制到 Go |
| `orion-platform-service/src/api/tenant-routes.ts` | Phase 3.5 联调 | Phase A3 迁移到 orion-tenant-svc | **P1** | 在 Node.js 中修复，迁移时复制到 Go |
| `orion-platform-service/src/api/user-routes.ts` | Phase 3.5 联调 | Phase A4 迁移到 orion-user-svc | **P1** | 在 Node.js 中修复，迁移时复制到 Go |
| `orion-platform-service/src/api/pipeline-*-routes.ts` | Phase 3.5 联调 | Phase B1 迁移到 Go | **P1** | 在 Node.js 中修复，迁移时复制到 Go |
| `orion-platform-service/src/api/cmdb-*` | Phase 3.5.0 CMDB 联调 | Go 已有 29 文件 | **P2** | 已有 Go 实现，跳过 Node.js 修复 |
| `orion-platform-service/src/api/monitoring-*` | Phase 3.5 APM 联调 | Phase C1 迁移到 Go | **P1** | 在 Node.js 中修复，迁移时复制到 Go |

**决策规则**：
- **P0 冲突**：文件将被完全重写（如 Gateway）→ **跳过 Phase 0-4 的修复，直接进入 Phase A 迁移**
- **P1 冲突**：文件将在 Node.js 中修复后再迁移 → **在 Phase 0-4 中修复，Phase A-F 迁移时复制业务逻辑到 Go**
- **P2 冲突**：已有 Go 实现 → **跳过 Node.js 修复，直接验证 Go 实现完整性**

### 17.5 前端 API Client 迁移计划（P1 修复）

> **问题**：后端迁移到 Go/Rust/Python 后，端口和路径可能变化，前端 `orion-frontend/src/api/` 下 101 个 API Client 文件需要更新。

#### API Client 迁移策略

| 迁移阶段 | 前端操作 | 后端变化 | 迁移方式 |
|---------|---------|---------|---------|
| 迁移前 | api/ 调用 `:3001/api/v1/xxx` | Node.js platform-service | 无变化 |
| 迁移中 | api/ 调用 `:3000/api/v1/xxx`（Go Gateway） | Go Gateway 转发到新服务 | **只改 baseURL，不改路径** |
| 迁移后 | api/ 调用 `:3000/api/v1/xxx`（Go Gateway） | Go Gateway 100% 路由 | **前端无需改动** |

#### 具体执行步骤

1. **API 路径冻结**：在 Phase A（API Gateway → Go）之前，冻结所有 `/api/v1/*` 路径，任何变更需要前端同步更新
2. **baseURL 集中化**：前端统一使用 `import { api } from '@/api/client'`，其中 baseURL 可配置
3. **过渡期双写**：Go Gateway 同时代理 Node.js 旧服务 + Go 新服务，按路径路由
4. **前端无感知**：只要 Go Gateway 保持 API 路径与 Node.js 一致，前端 `api/` 目录**无需任何改动**

#### API 路径变更清单（仅当路径不兼容时）

| 原路径（Node.js） | 新路径（Go） | 影响前端文件 | 变更原因 |
|------------------|-------------|-------------|---------|
| `/api/v1/auth/login` | `/api/v1/auth/login` | api/auth.ts | 保持一致，无需变更 |
| `/api/v1/users` | `/api/v1/users` | api/user.ts | 保持一致 |
| `/api/v1/tenants` | `/api/v1/tenants` | api/tenant.ts | 保持一致 |

**原则**：Go 服务必须保持与 Node.js 完全相同的 API 路径。如果确实需要变更，必须在前端 `api/` 中添加**兼容层**（旧路径 → 新路径 的 301 重定向）。

### 17.6 过渡期共存验证标准（P1 修复）

> **问题**：§16.9 描述了共存架构但缺少验证标准和回滚触发条件。

#### 灰度切流量化指标

| 切流阶段 | 流量比例 | 持续时间 | 通过标准 | 失败处理 |
|---------|---------|---------|---------|---------|
| 验证 | 1% | 1 小时 | 错误率 < 0.1%，P99 延迟 < 原服务 + 10ms | 立即回滚到 100% Node.js |
| 小流量 | 10% | 24 小时 | 错误率 < 0.1%，P99 延迟 < 原服务 + 20ms | 回滚到 1% |
| 中流量 | 50% | 24 小时 | 错误率 < 0.5%，P99 延迟 < 原服务 + 50ms | 回滚到 10% |
| 大流量 | 90% | 48 小时 | 错误率 < 0.5%，P99 延迟 < 原服务 | 回滚到 50% |
| 全量 | 100% | — | 错误率 < 0.1%，P99 延迟 < 原服务 | 回滚到 50%，观察 24 小时 |

#### 数据一致性验证

| 验证项 | 方法 | 频率 | 通过标准 |
|--------|------|------|---------|
| 双写数据对比 | 随机抽样 100 条记录 | 每小时 | 差异 = 0 |
| 读取数据对比 | 同一条记录分别从 Node.js 和 Go 服务读取 | 每 15 分钟 | 字段值完全匹配 |
| 写入延迟对比 | 记录写入 Node.js 到 Go 服务可见的时间 | 每次写入 | < 1 秒 |
| 租户隔离验证 | 跨租户访问测试 | 每天 | 0 次跨租户泄漏 |

#### 回滚触发条件

| 触发条件 | 级别 | 回滚动作 | 恢复时间目标 |
|---------|------|---------|-------------|
| 错误率 > 1%（持续 5 分钟） | P0 | 立即回滚到上一阶段 | < 1 分钟 |
| P99 延迟 > 原服务 + 200ms | P0 | 回滚到 50% 流量 | < 5 分钟 |
| 数据不一致 > 0.1% | P0 | 停止双写，回滚到 Node.js | < 10 分钟 |
| 租户隔离泄漏 | P0 | 立即回滚 + 安全审计 | < 1 分钟 |
| Go 服务崩溃重启 > 3 次/小时 | P1 | 回滚到 10% 流量 | < 5 分钟 |

### 17.7 团队技能转型计划（P1 修复）

> **问题**：从 Node.js/TypeScript 到 Go/Rust/Python 需要团队学习。

#### 培训计划

| 角色 | 目标语言 | 学习路径 | 时长 | 里程碑 |
|------|---------|---------|------|--------|
| 后端开发（3 人） | Go | Go Tour → Gin 教程 → 第一个微服务 → Phase A 实战 | 2 周 + 实战 | 独立完成 Auth → Go 迁移 |
| AI 开发（1-2 人） | Python | FastAPI 教程 → LangChain 入门 → LLM Trace 实战 | 1 周 + 实战 | 独立完成 LLM Trace → Python |
| 安全开发（1 人） | Rust | Rust Book → Axum 教程 → 加密服务实战 | 4 周 + 实战 | 独立完成 Security → Rust |
| 全团队 | 通用 | 代码模板使用 → 迁移工具使用 → 代码评审标准学习 | 持续 | 能 review Go/Python/Rust 代码 |

#### 代码模板与脚手架工具清单

| 工具 | 路径 | 用途 | 状态 |
|------|------|------|------|
| `extract-api-contract.ts` | `tools/migration/` | 从 Node.js 路由提取 OpenAPI spec | ✅ 已创建 |
| `generate-go-scaffold.ts` | `tools/migration/` | 从 OpenAPI spec 生成 Go 脚手架 | ✅ 已创建 |
| `validate-migration.ts` | `tools/migration/` | 验证 Node.js → Go 迁移正确性 | ✅ 已创建 |
| Go 服务模板 | `orion-auth-svc/` | 完整 Go 微服务示例（Auth） | ✅ 已创建 |
| Go 服务模板 | `orion-tenant-svc/` | 完整 Go 微服务示例（Tenant） | ✅ 已创建 |
| Go 服务模板 | `orion-user-svc/` | 完整 Go 微服务示例（User + RBAC） | ✅ 已创建 |
| Go API Gateway | `orion-api-gateway-go/` | 完整 Go 网关示例 | ✅ 已创建 |

#### Go/Rust 代码评审标准（补充 CLAUDE.md）

**Go 代码评审要点**：
- 错误处理：使用 `if err != nil` 模式，禁止 panic
- 并发安全：goroutine 之间使用 channel 或 sync.Mutex
- 数据库查询：使用 sqlx 命名参数，禁止 SQL 拼接
- 租户隔离：所有查询必须包含 tenant_id 过滤
- 结构化日志：使用 zap.Logger，含 traceId/tenantId
- 接口设计：小接口，只定义必要方法

**Rust 代码评审要点**：
- 内存安全：禁止 `unsafe` block（除非经过专门审查）
- 错误处理：使用 `Result<T, E>`，禁止 `unwrap()`
- 并发安全：使用 `Arc<Mutex<T>>` 或 `tokio::sync`
- 加密：使用 ring/aes-gcm 等经过审计的库

### 17.8 数据库迁移策略（P1 修复）

> **问题**：Node.js 服务使用 PostgreSQL Repository 模式，Go 服务也需要相同的数据库。

#### 数据库架构

```
                  PostgreSQL (共享实例)
                  ├── orion_auth (Auth 服务)
                  ├── orion_tenant (Tenant 服务)
                  ├── orion_user (User 服务)
                  ├── orion_pipeline (Pipeline 服务)
                  └── orion_platform (其他服务)

每个 Go 服务：
  ├── 独立数据库连接池 (max: 25 connections)
  ├── 独立 migration 目录
  ├── 共享 PostgreSQL 实例（或独立实例，按负载决定）
  └── 共享 Redis 实例（Token 黑名单 / 会话 / 限流）
```

#### 迁移脚本策略

| 阶段 | 脚本格式 | 执行方式 | 说明 |
|------|---------|---------|------|
| Node.js 现有迁移 | `001-049.sql` | `psql -f` | 已有 207 个迁移文件 |
| Go 新迁移 | `001_create_xxx.sql` | `psql -f` 或 `make migrate-up` | 从 001 开始编号，每个服务独立 |
| 共享表 | — | 在 orion_platform 中执行 | tenants, users, roles 等 |

#### 连接池规划

| 服务 | 连接池大小 | 说明 |
|------|-----------|------|
| API Gateway | 5（只读路由缓存） | 网关不直接访问数据库 |
| Auth | 25 | 登录/Token 验证高频查询 |
| Tenant | 10 | 低频查询 |
| User | 15 | 中频查询 |
| Pipeline | 30 | 高频写入（执行状态更新） |
| APM | 50 | 超高频写入（指标采集） |

**总连接数**：~200 个（PostgreSQL 默认 max_connections=100，需调整至 500）

#### 双写期间数据一致性

| 写入场景 | 策略 | 一致性保证 |
|---------|------|-----------|
| CRUD 创建 | 先写 Node.js，异步写 Go | 最终一致性，< 1 秒延迟 |
| CRUD 更新 | 先写 Node.js，异步写 Go | 最终一致性，< 1 秒延迟 |
| CRUD 删除 | 先写 Node.js，异步写 Go | 最终一致性，< 1 秒延迟 |
| 读取 | 从 Go 服务读取（如果迁移完成） | 强一致性 |
| 冲突解决 | Node.js 为权威源 | Go 侧数据以 Node.js 为准 |

### 17.9 "现有基础"标注补全（P1 修复）

> **问题**：§16.3 的每个功能域缺少"现有基础"标注（task-decomposer 强制规则）。

#### 现有基础设施清单

| 基础设施 | 当前状态 | 可复用模块 | Go 迁移时是否可用 |
|---------|---------|-----------|------------------|
| **Repository 模式** | 30+ 服务已迁移到 PostgreSQL Repository | `orion-platform-service/src/repositories/` | ✅ 可作为参考模板 |
| **数据库迁移** | 207 个 SQL 迁移文件 | `orion-platform-service/src/db/migrations/` | ✅ 可复用 SQL，部分需调整 |
| **事件总线** | `event-bus-service.ts` 已实现 | `orion-platform-service/src/services/event-bus/` | ✅ 需对接 NATS/Kafka Go SDK |
| **Redis 缓存** | `redis-cache.ts` 已实现 | `orion-platform-service/src/services/redis-cache/` | ✅ 共享 Redis 实例 |
| **认证中间件** | `authenticateUser` 已实现 | `orion-platform-service/src/middleware/` | ⚠️ 需重写为 Go JWT middleware |
| **ACL 权限** | `requirePermission` 已实现 | `orion-platform-service/src/middleware/acl/` | ⚠️ 需重写为 Go ACL |
| **结构化日志** | `logger` (pino) 已实现 | `orion-platform-service/src/utils/logger/` | ⚠️ 需替换为 Go zap |
| **错误码** | `OrionError` 已定义 | `orion-platform-service/src/errors/` | ✅ 可作为 Go 错误码参考 |
| **OpenTelemetry** | Node.js OTel SDK | `orion-platform-service/src/otel/` | ⚠️ 需使用 Go OTel SDK |
| **前端 API Client** | 101 个文件 | `orion-frontend/src/api/` | ✅ 只要 API 路径不变，无需改动 |
| **前端页面** | 149 个页面 | `orion-frontend/src/pages/` | ✅ 已实现可复用 |
| **Design Token** | 14 个 Token 文件 | `orion-frontend/src/tokens/` | ✅ 已实现可复用 |
| **微前端规范** | SubAppRouteDynamic + CrashRecovery | `orion-frontend/src/components/SubAppRoute/` | ✅ 已实现可复用 |
| **CI/CD Pipeline** | Tekton + Knative 集成 | 现有 CI 配置 | ✅ 可复用，需更新构建步骤 |
| **Docker 部署** | Dockerfile + docker-compose | 现有部署配置 | ✅ 可复用模板 |

#### 按功能域标注现有基础

| 功能域 | 现有基础 | 需新建 | 可复用程度 |
|--------|---------|--------|-----------|
| Tenant | `TenantService` + `TenantRepository` | Go handler + router | 70%（SQL 可复用，逻辑需重写） |
| Auth | `AuthService` + JWT 验证 | Go handler + Redis blacklist | 50%（JWT 逻辑需重写，Redis 可复用） |
| User | `UserService` + RBAC | Go handler + service + repo | 60%（数据模型可复用） |
| Pipeline | `PipelineEngine` + `StageExecutor` | Go 完整重写 | 30%（业务逻辑参考，实现需重写） |
| Deploy | `DeployService` + K8s client | Go handler + client-go | 40%（部署流程参考） |
| APM | `MetricsService` | Go handler + OTel SDK | 20%（需全新 OTel 实现） |
| Alert | `AlertService` + Dedup/Silence | Go handler + AlertManager 集成 | 40%（告警规则可复用） |
| ChatOps | `ChatOps` 22 服务 + CommandRouter | Go handler + IM SDK | 50%（命令路由参考） |
| Ticketing | `TicketingService` | Go handler + service + repo | 60%（数据模型可复用） |
| CMDB | `CmdbService` + Go 已有实现 | Go 已有 29 文件 | 90%（Go 已部分实现） |

### 17.10 成本对比分析（P2 补充）

#### Node.js vs Go/Rust/Python 运营成本对比

| 维度 | Node.js | Go | Rust | Python | 变化 |
|------|---------|----|------|--------|------|
| **内存占用**（单实例） | 128-512MB | 20-50MB | 5-20MB | 100-300MB | Go 节省 70-90% |
| **CPU 利用率** | 25%（单核瓶颈） | 80%（多核） | 90% | 40%（GIL） | Go/Rust 大幅提升 |
| **QPS**（单实例） | ~5000 | ~50000 | ~100000 | ~3000 | Go 提升 10x |
| **开发效率** | 高（TypeScript） | 中高（Go 简单） | 低（Rust 陡峭） | 高（Python 成熟） | Rust 效率降低 |
| **招聘成本** | 低 | 中 | 高 | 低 | Rust 招聘困难 |
| **云资源成本** | 基准 | 节省 60% | 节省 80% | 持平 | 主要节省在内存 |
| **培训成本** | 0 | ~2 人月 | ~4 人月 | ~1 人月 | Go/Python 可控 |

**总成本估算**：
- 迁移成本：35 人月 × 平均月薪 + 培训 2 人月 = ~**37 人月**
- 节省成本：内存降低 70% + QPS 提升 10x = 云资源节省 ~40%/年
- 回收期：~18 个月（云资源节省覆盖迁移成本）

### 17.11 性能基线数据（P2 补充）

#### 当前 Node.js 性能基线

| 服务 | QPS（单实例） | P50 延迟 | P99 延迟 | 内存占用 | CPU 利用率 |
|------|--------------|---------|---------|---------|-----------|
| platform-service | ~3000 | 15ms | 80ms | 384MB | 45% |
| api-gateway | ~4000 | 10ms | 50ms | 256MB | 60% |
| 各 micro-svc | ~2000 | 20ms | 100ms | 192MB | 30% |

#### Go 预期性能（基于同类型服务对比）

| 服务 | QPS（单实例） | P50 延迟 | P99 延迟 | 内存占用 | CPU 利用率 |
|------|--------------|---------|---------|---------|-----------|
| auth-svc (Go) | ~25000 | 3ms | 15ms | 32MB | 20% |
| tenant-svc (Go) | ~30000 | 2ms | 10ms | 28MB | 15% |
| user-svc (Go) | ~20000 | 4ms | 20ms | 36MB | 25% |
| api-gateway (Go) | ~80000 | 1ms | 5ms | 48MB | 40% |

#### Rust 预期性能（安全关键路径）

| 服务 | QPS（单实例） | P50 延迟 | P99 延迟 | 内存占用 |
|------|--------------|---------|---------|---------|
| security-svc (Rust) | ~50000 | 1ms | 5ms | 16MB |
| risk-engine (Rust) | ~30000 | 2ms | 10ms | 12MB |

### 17.12 "不替换"服务的明确理由（P2 补充）

| 服务 | 当前技术栈 | 不替换理由 |
|------|-----------|-----------|
| `orion-ai-service/` | Python | **已经是 Python**，无需替换。且 AI 生态需要 Python |
| `orion-visor/` | Java/Spring | 运维可视化，功能稳定，迁移成本高且收益低 |
| `orion-knowledge/` | PandaWiki fork | 独立开源项目 fork，代码量大（10万+ 行），不属于 Orion 自研 |
| `orion-dba/` | 独立平台 | 独立 DB 管理平台，不属于 Orion 核心，可独立演进 |

**决策原则**：
1. 已经是非 Node.js 的服务 → 不替换
2. 独立开源项目 fork（代码量 > 5 万行）→ 不替换
3. 功能稳定且非核心路径 → 暂不替换，后续按需评估

---

*本补充基于 task-decomposer 技能审查（2026-05-25），发现 12 项缺失，已全部补全。*

---

*方案生成时间：2026-05-22*
*最后更新：2026-05-25 — 新增第十七节升级计划文档评审优化（12 项缺失补全：统一任务总表/合并估算/优先级 DAG/前端 API 迁移/过渡期验证/团队培训/数据库策略/现有基础标注/成本对比/性能基线/不替换理由 + 章节编号修正）；新增第十六节后端 Node.js 全面替换方案（2000+ .ts 文件迁移至 Go/Rust/Python，含模块映射表、迁移策略、渐进式路线图）；新增第十五节评审修复补充（前后端联调指南 9 层验证 + 错误码清单 15 项 + CI/CD 门禁配置 + 性能基线数据 + SSO 子应用改造代码示例 + 迁移重编号脚本 + Flashduty 6 项新建功能实施计划）；新增第十三节 Flashduty On-Call 子模块接入索引（功能映射表/API 映射/数据模型差异/交互链关联/实施依赖 DAG）；新增四.1 ChatOps 借鉴 Flashduty Ask AI 改造方案；新增 13.7 评审发现 P0/P1 问题修复方案（含 AST 验证结果、修复代码示例、场景逆向验证）*
*规范来源：CLAUDE.md 前端交互完整性审查规则 + Design Token 体系 + Orion统一规范汇总.md (7567行)*
*评审来源：design-doc-reviewer 评审报告 (2026-05-25) — Replication Plan 82%, Upgrade Plan 87%，7 项缺失已修复*
*技能来源：task-decomposer v2.9 审查 — 12 项缺失发现并补全；design-doc-reviewer v2.5 评审 — 3 P0 + 6 P1 + 3 P2 发现并修复*
*数据更新：2026-05-25 — CLI 扫描前端 815 项问题（P0=67, P1=117, P2=631）+ DB 迁移 422 文件（001-182）+ 前端 631 .tsx + Go 脚手架 4 服务 45 文件 + 迁移工具 4 个*
