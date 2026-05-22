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

## 二、问题验证结论（Step 1 结论汇总）

| 问题类型 | 文档报告数量 | 实际验证数量 | 误报率 | 修复优先级 |
|---------|------------|------------|--------|-----------|
| catch 块为空/注释占位 | 72 | 20-30 | 60% | **P0-1**（最严重 UX 问题） |
| 列表缺少空状态引导 | 233 | 100-150 | 40% | **P0-2** |
| 异步操作缺少 loading | 170 | 70-80 | 50% | **P0-3** |
| as any 类型断言 | 572 | 460 (生产代码) | 20% | **P1-1** |
| 硬编码颜色 | 28 | 20-25 | 10% | **P1-2** |
| 前后端断链（按钮无 onClick/API 未 import） | 6 个功能 | 6 个确认 | 0% | **P0-4** |
| 后端缺权限校验 | 1 处 | 1 处确认 | 0% | **P0-5**（安全） |

---

## 三、Agent 可执行改造方案（Step 4 核心输出）

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

**修正后全新模块优先级**（真正需要从零开发的）：

| 优先级 | 模块 | 预估工作量 | 依赖 | 备注 |
|--------|------|-----------|------|------|
| P0-1 | 数据库DevOps | 2人月 | 无（可独立启动） | 完全缺失 |
| P0-2 | 开发者门户 | 2人月 | 无 | 完全缺失 |
| P0-3 | 配额与计费 | 2.5人月 | 租户系统 | 完全缺失 |
| P0-4 | MLOps 平台 | 3人月 | 现有 AI 服务 | 完全缺失 |
| P0-5 | FinOps 云成本优化 | 2人月 | 现有监控能力 | 完全缺失 |
| P0-6 | Serverless 计算引擎 | 4人月 | 现有 Knative | 完全缺失 |
| P0-7 | 多云管理平台 | 4人月 | 现有 IaC | 完全缺失 |
| P0-8 | APM + 完整链路追踪 | 3人月 | 合并建设 | 原 APM(2) + 链路追踪(3) = 5，合并后 3 |
| P1-1 | 元数据管理 | 2人月 | 数据库DevOps | 完全缺失 |
| P1-2 | 数据血缘 | 3人月 | 元数据管理 | 完全缺失 |
| P1-3 | 智能巡检 | 2人月 | 监控中心 | 完全缺失 |
| P1-4 | 容量规划 | 2人月 | 元数据管理 | 完全缺失 |
| P1-5 | 问题管理 | 2人月 | 工单系统 | 完全缺失 |
| P1-6 | AI安全监控 | 2人月 | 现有 AI 服务 | 完全缺失 |
| P1-7 | 中间件运维 | 3人月 | 可观测性 | 完全缺失 |
| P1-8 | 数据质量平台 | 2人月 | 数据血缘 | 完全缺失 |
| P2-1 | 发布编排 | 2人月 | 部署模块 | 完全缺失 |
| P2-2 | 变更影响分析 | 2人月 | 数据血缘 | 完全缺失 |

**已有模块能力增强**（非从零开发）：

| 模块 | 现状 | 需要开发内容 | 预估工作量 |
|------|------|-------------|-----------|
| 知识库/向量存储 | ✅ 后端+前端完整 | 自动向量化、索引管理、RAG Pipeline | 2 人月 |
| CMDB | ✅ Go 服务+8 前端页面 | 前后端联调、Web 终端、批量执行确认 | 0.5 人月 |
| 混沌工程 | ✅ 后端完整 / ❌ 前端缺失 | 5 个前端页面 + API Client | 0.5 人月 |
| **能力增强小计** | | | **3 人月** |

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

## 六、执行顺序（修复优先 → 能力增强 → 新功能）

> **原则**：先修复现有问题，再增强已有模块，最后开发新模块。每个阶段独立验收。

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

### 第二阶段：已有模块能力增强（Week 3-5）

**目标**：已有部分实现的模块补齐能力，前后端联调验证

```
Week 3 — CMDB + 混沌工程：
  Day 1-3: Phase 3.5.1 (CMDB 联调)
           - 8 个页面逐一验证 9 层调用链
           - 修复 CMDB 页面空 catch、loading、empty 问题
           - 确认 WebTerminal WebSocket 连接
  Day 4-5: Phase 3.5.2 (混沌工程前端)
           - 审查 chaos.ts API 路径与后端路由匹配
           - 审查已存在页面的交互完整性
           - 补充缺失页面（弹性评分/故障库）
  → 验收：CMDB 8 页面 + 混沌 5 页面全部可用，交互完整

Week 4 — 知识库能力增强：
  Day 1-3: 文档自动向量化（上传文档后自动 Embedding）
  Day 4-5: 向量索引管理页面（HNSW/IVF 配置）+ 知识库前端交互修复
  → 验收：文档上传后自动向量化，索引管理页面可用

Week 5 — APM 基础能力：
  Day 1-3: APM 指标采集服务 + 仪表盘后端 API
  Day 4-5: APM 仪表盘前端页面
  → 验收：APM 仪表盘可展示应用性能指标
```

### 第三阶段：能力补齐（Week 6-8）

**目标**：补齐后端关键能力，为后续新模块打基础

```
Week 6-7 — APM 完整能力：
  Phase 3.5.3: APM 慢请求分析 + 错误追踪 + 服务依赖拓扑
  → 验收：慢请求排行、错误追踪页面可用

Week 8 — 后端能力补齐 + 全量验收：
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

### 7.2 完全缺失（需要从零开发）

| 模块 | 后端 | 前端 | 预估工作量 |
|------|------|------|-----------|
| 数据库DevOps | ❌ | ❌ | 2 人月 |
| 开发者门户 | ❌ | ❌ | 2 人月 |
| 配额与计费 | ❌ | ❌ | 2.5 人月 |
| MLOps 平台 | ❌ | ❌ | 3 人月 |
| FinOps | ❌ | ❌ | 2 人月 |
| Serverless | ❌ | ❌ | 4 人月 |
| 多云管理 | ❌ | ❌ | 4 人月 |
| APM + 链路追踪 | ❌ | ❌ | 3 人月（合并） |
| 元数据管理 | ❌ | ❌ | 2 人月 |
| 数据血缘 | ❌ | ❌ | 3 人月 |
| 智能巡检 | ❌ | ❌ | 2 人月 |
| 容量规划 | ❌ | ❌ | 2 人月 |
| 问题管理 | ❌ | ❌ | 2 人月 |
| AI安全监控 | ❌ | ❌ | 2 人月 |
| 中间件运维 | ❌ | ❌ | 3 人月 |
| 数据质量平台 | ❌ | ❌ | 2 人月 |
| 发布编排 | ❌ | ❌ | 2 人月 |
| 变更影响分析 | ❌ | ❌ | 2 人月 |

### 7.3 工作量汇总（修正后）

| 类别 | 数量 | 总工作量 |
|------|------|---------|
| 前端交互修复（Phase 1-2） | 约 300+ 问题 | ~6 小时 |
| 后端安全修复（Phase 3） | 2 项 | ~0.5 天 |
| 已有模块增强（Phase 3.5） | 3 模块 | **3 人月** |
| 全新模块开发（Phase 4） | 18 模块 | **43 人月** |
| CI/CD/安全/可观测性补齐 | 7 项 | ~12 人周 |

**总计**：约 **49+ 人月**，分布在 6 个实施阶段，总周期 12-15 个月。

---

## 八、全模块深度扫描结果（2026-05-22 新增）

> **执行方式**: 6 Agent 并行深度扫描 + 代码级审计 + 代码级验证
> **扫描范围**: 174 页面 / 531 .tsx 文件 / 122 API 客户端 / 100 后端路由 / 35 独立服务
> **分报告**: 7 份独立报告（1671 行）+ 1 份总报告（225 行）

### 8.1 全局 P0 问题：路由断裂（14 项）

| # | 模块 | 问题 | 影响 | 证据 |
|---|------|------|------|------|
| 1 | 工单系统 | 路由未注册 | **全部 404** | 16 Service + 1885 行 Controller + 前端完整 |
| 2 | CMDB | Go 路由已注册但 TS 路由未注册 | **部分可达** | Go 29 文件 + 8 前端页面完整，Gateway `/api/v1/cmdb` → `:3030` 已配置，TS 侧路由未注册 |
| 3 | BuildEnv | 路由未注册 | **全部 404** | 7 Controller + 12 Service 未注册 |
| 4 | Monitoring | 路由未注册 | **全部 404** | monitoring-routes.ts 不存在 |
| 5 | Observability | 路由未注册 | **全部 404** | observability-routes.ts 不存在 |
| 6 | Backup | 路由未注册 | **全部 404** | 前端完整，后端无路由 |
| 7 | OnCall | 路由未注册 | **全部 404** | 前端完整，后端无路由 |
| 8 | SBOM | 路由未注册 | **全部 404** | Controller/Service 存在未注册 |
| 9 | AI Gateway | 路由未注册 | **全部 404** | 前端 5 个 API 全部 404 |
| 10 | AI Cost | 路由未注册 | **全部 404** | BudgetManagement 等页面前端完整 |
| 11 | AI Review | 路由未注册 | **全部 404** | AIReview 页面前端完整 |
| 12 | AI Docs | 路由未注册 | **全部 404** | 知识库管理前端完整 |
| 13 | AI Security | 路由未注册 | **全部 404** | AISecurity 页面前端完整 |
| 14 | FinOps | 路由迁移未完成 | 前端调旧路径 404 | 已迁移到独立微服务但 Gateway 未更新 |

**根因**: `routes.ts` 中多处注释声称"已迁移到独立微服务"，但这些服务均不存在，路由也未实际注册。

### 8.2 模块评分矩阵

| 模块 | 综合 | 代码 | 持久化 | API 对接 | 交互 | 说明 |
|------|------|------|--------|---------|------|------|
| **交付 Pipeline** | **8.5/10** | 8 | 9 | 9 | 8 | 全链路畅通，最完善模块 |
| **回滚能力** | **7.5/10** | 8 | 8 | 7 | 7 | 手动+自动+策略完整 |
| **CI 集成** | **7.4/10** | 8 | 8 | 8 | 7 | SSE 实时日志 + Runner 池 |
| **CD 部署** | **7.4/10** | 8 | 8 | 7 | 7 | 4 种策略完整 |
| **治理** | **7.0/10** | 7 | 8 | 6 | 7 | 路由部分缺失 |
| **可观测性** | **6.8/10** | 7 | 8 | 5 | 7 | Monitoring 路由缺失 |
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

### 8.3 Mock/硬编码/Memory 存储问题

| 类型 | 发现数 | 典型位置 |
|------|--------|---------|
| setTimeout 模拟 | 10+ 处 | CreateTicketModal, MockK8sClient, ChatOps restart |
| 硬编码 Mock 数组 | 30+ 页面 | DashboardNew/Capability/AlertConfig |
| 空 catch 块 | 1 处 | ChatOps/index.chat.tsx:57 |
| catch 降级成功 | 2 处 | ArtifactBrowser, Console |
| 前端过滤替代后端 | 多处 | TicketList/DashboardNew |
| Map 内存存储 | 6 个 Service | BuilderImage/BuildLog/Certificate/LLMTrace/BaseAgent/ChatOps |

### 8.4 双份实现（需清理）

| 模块 | 主目录 | 副本目录 | 状态 |
|------|--------|---------|------|
| BuildEnv | pages/BuildEnv/ | pages/code-svc/BuildEnv/ | 完全相同 |
| AlertConfig | pages/AICostDashboard/ | pages/finops-svc/AICostDashboard/ | 完全相同 |
| CreateTicketModal | pages/TicketList/ | pages/ticket-svc/TicketList/ | 完全相同 |

### 8.5 前端样式规范合规

| 维度 | 违规数 | 说明 |
|------|--------|------|
| 圆角违规 | **0** | 4px 网格系统遵循极好 |
| 间距违规 | **0** | 4px 网格系统遵循极好 |
| 颜色违规 | **123 处** | 硬编码色值，应使用 colors Token |
| 阴影违规 | **8 处** | 硬编码 boxShadow |
| 标题不规范 | **31 处** | 缺图标/缺 marginBottom |

### 8.6 专项评估摘要

#### AI 平台 (5.0/10，修正后)
- **AICostDashboard/AlertConfig**：告警规则硬编码 Mock 数据（行51-82），有双份实现（finops-svc 副本相同）
- **ChatOps**：index.chat.tsx 空 catch 块（行57: `.catch(() => {})`），ChatOpsSettings 缺 loading
- **后端**：serviceMap 为空导致命令路由降级到 Mock
- **优势**：权限控制 9/10、审计日志 9/10（PostgreSQL 持久化）
- **短板**：多轮对话 2/10、工作流真实执行 5/10（serviceMap 为空降级 Mock）

#### 工单 ITSM (4.5/10，修正后)
- **修正前评分 3.0/10 低估**：前端 10 页面完整（TicketList/TicketDetail/DispatchPanel 均对接 API）
- **实际状态**：前端 4 页已调 API，3 处 Mock（CreateTicketModal setTimeout + DispatchPanel ×2 setTimeout）
- **核心差距**：
  1. **CreateTicketModal**：setTimeout 模拟创建（行124），需调 `createTicket` API
  2. **DispatchPanel**：分派操作 2 处 setTimeout 模拟（行265,273），未调后端 API
  3. **TicketDetail handleEscalate**：未调 escalate API，仅弹成功提示（行304-319）
  4. **TicketList handleAssign**：Modal 确认框后仅弹提示，未调 `assignTicket` API（行440-450）
  5. **报表按钮**：弹"报表功能开发中"（行486）
  6. **后端路由未注册**：routes.ts:413 注释"已迁移到 orion-ticket-svc"，但 Go 服务未运行
  7. **对标 ITIL v4**：知识库关联 0、CMDB 关联 0、CSAT 0、变更关联 0、多渠道 4/10

#### CI/CD 7 维度
- **Pipeline 引擎**：16591 行，全链路畅通，评分 8.5/10
- **部署引擎**：4 种策略（blue-green/canary/rolling/recreate），评分 7.4/10
- **回滚**：手动+自动+策略完整，但仅支持前一版本
- **灰度**：ML 分析 + 渐进流量 + 自动推进，但 NGINX/Istio 为模拟
- **并发**：有配额但无可视化监控页面
- **网关/流量**：28787 行代码，但无真实流量切换

#### BuildEnv (4.5/10)
- **路由断裂确认**：build-images/build-cache/build-pods/build-logs 全部未注册
- **K8s Mock 确认**：MockK8sClient setTimeout 模拟 Pod 生命周期，非真实 K8s 调用
- **Map 存储确认**：BuilderImageService/BuildLogService/CertificateService 全部内存存储
- **双份实现**：pages/BuildEnv/ (8文件) = pages/code-svc/BuildEnv/ (8文件)，完全相同
- **后端有前端无**：Buildx 多架构/移动构建/C++/桌面构建/证书管理 后端完整实现但前端 0 页面
- **前端交互**：8 页面均使用 API 调用，但 5 处 `as any` 类型违规 + 5 处缺 loading

#### CMDB (7.0/10，修正后)
- **修正前评分 1.5/10 严重低估**：前端 8 页面（3551 行）+ Go 服务 29 文件 + Gateway 代理全部完整
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
| 基础设施+治理 | `docs/reports/infra-governance-deep-assessment-2026-05-22.md` | 120 |
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

*评审依据：6 Agent 并行深度扫描（2026-05-22），覆盖 531 .tsx 文件 + 122 API 客户端 + 100 后端路由 + 35 独立服务*

---

*方案生成时间：2026-05-22*
*基于文档：frontend-smart-analysis-complete, frontend-quality-scan-and-fix, orion-comprehensive-review, orion-evolution-roadmap + 全模块深度扫描（6 Agent 并行，7 份分报告 1671 行）*
*规范来源：CLAUDE.md 前端交互完整性审查规则 + Design Token 体系 + Orion统一规范汇总.md (7567行)*
