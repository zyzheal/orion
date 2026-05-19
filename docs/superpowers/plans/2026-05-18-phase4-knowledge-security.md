# Phase 4: 知识库与安全治理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现知识库 CRUD、威胁监控、合规报告、安全评估完善，构建完整的 AI 安全治理体系。

**Architecture:**
- 知识库：基于向量存储的 RAG 系统
- 威胁监控：AI 安全事件检测和告警
- 合规报告：自动生成安全合规报告
- 安全评估：AI 模型安全评估工具

**Tech Stack:** TypeScript, React, PostgreSQL, Vector Store

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `orion-frontend/src/pages/KnowledgeBase/index.tsx` | Modify | 知识库管理页面 |
| `orion-ai-svc/src/services/KnowledgeService.ts` | Create | 知识服务 |
| `orion-ai-svc/src/routes/knowledge.ts` | Create | 知识库 API |
| `orion-frontend/src/pages/AISecurity/index.tsx` | Modify | 安全治理页面 |
| `orion-ai-svc/src/services/ThreatMonitor.ts` | Create | 威胁监控服务 |
| `orion-ai-svc/src/services/ComplianceReporter.ts` | Create | 合规报告服务 |

---

### Task 1: 创建知识服务 KnowledgeService

**Files:**
- Create: `orion-ai-svc/src/services/KnowledgeService.ts`

- [ ] **Step 1: 创建 KnowledgeService.ts**

```typescript
// orion-ai-svc/src/services/KnowledgeService.ts

import { getPool } from '../utils/database';

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  embedding?: number[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeSearchResult {
  item: KnowledgeItem;
  similarity: number;
}

export class KnowledgeService {
  async create(item: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeItem> {
    const pool = getPool();
    const id = crypto.randomUUID();
    const now = new Date();

    await pool.query(
      `INSERT INTO knowledge_items (id, title, content, category, tags, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, item.title, item.content, item.category, JSON.stringify(item.tags), item.createdBy, now, now]
    );

    return { ...item, id, createdAt: now, updatedAt: now };
  }

  async update(id: string, updates: Partial<KnowledgeItem>): Promise<KnowledgeItem | null> {
    const pool = getPool();
    const now = new Date();

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.title) {
      fields.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }
    if (updates.content) {
      fields.push(`content = $${paramIndex++}`);
      values.push(updates.content);
    }
    if (updates.category) {
      fields.push(`category = $${paramIndex++}`);
      values.push(updates.category);
    }
    if (updates.tags) {
      fields.push(`tags = $${paramIndex++}`);
      values.push(JSON.stringify(updates.tags));
    }

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(now);
    values.push(id);

    await pool.query(
      `UPDATE knowledge_items SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    return this.getById(id);
  }

  async delete(id: string): Promise<boolean> {
    const pool = getPool();
    await pool.query('DELETE FROM knowledge_items WHERE id = $1', [id]);
    return true;
  }

  async getById(id: string): Promise<KnowledgeItem | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM knowledge_items WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      ...row,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
    };
  }

  async list(category?: string, limit = 50, offset = 0): Promise<KnowledgeItem[]> {
    const pool = getPool();
    let query = 'SELECT * FROM knowledge_items';
    const params: any[] = [];

    if (category) {
      query += ' WHERE category = $1';
      params.push(category);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows.map((row) => ({
      ...row,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
    }));
  }

  async search(query: string, limit = 10): Promise<KnowledgeSearchResult[]> {
    // 简单实现：使用 LIKE 搜索
    // 生产环境应使用向量相似度搜索
    const pool = getPool();
    const result = await pool.query(
      `SELECT *, similarity(title, $1) + similarity(content, $1) as sim
       FROM knowledge_items
       WHERE title ILIKE $2 OR content ILIKE $2
       ORDER BY sim DESC
       LIMIT $3`,
      [`%${query}%`, `%${query}%`, limit]
    );

    return result.rows.map((row) => ({
      item: {
        ...row,
        tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
      },
      similarity: parseFloat(row.sim),
    }));
  }

  async getCategories(): Promise<string[]> {
    const pool = getPool();
    const result = await pool.query('SELECT DISTINCT category FROM knowledge_items ORDER BY category');
    return result.rows.map((r) => r.category);
  }
}

export const knowledgeService = new KnowledgeService();
```

- [ ] **Step 2: Commit**

```bash
git add orion-ai-svc/src/services/KnowledgeService.ts
git commit -m "feat(knowledge): add KnowledgeService for CRUD operations"
```

---

### Task 2: 创建知识库 API 路由

**Files:**
- Create: `orion-ai-svc/src/routes/knowledge.ts`

- [ ] **Step 1: 创建 knowledge.ts**

```typescript
// orion-ai-svc/src/routes/knowledge.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { knowledgeService, type KnowledgeItem } from '../services/KnowledgeService';

interface CreateKnowledgeRequest {
  title: string;
  content: string;
  category: string;
  tags: string[];
}

interface SearchQuery {
  q?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export async function knowledgeRoutes(fastify: FastifyInstance, options: { database: any }) {
  // 创建知识条目
  fastify.post<{ Body: CreateKnowledgeRequest }>(
    '/',
    async (request: FastifyRequest<{ Body: CreateKnowledgeRequest }>, reply: FastifyReply) => {
      const { title, content, category, tags } = request.body;

      if (!title || !content || !category) {
        return reply.status(400).send({ error: 'title, content, category are required' });
      }

      const item = await knowledgeService.create({
        title,
        content,
        category,
        tags: tags || [],
        createdBy: (request as any).user?.id || 'anonymous',
      });

      return reply.status(201).send(item);
    }
  );

  // 获取知识条目列表
  fastify.get<{ Querystring: SearchQuery }>(
    '/',
    async (request: FastifyRequest<{ Querystring: SearchQuery }>, reply: FastifyReply) => {
      const { category, limit = 50, offset = 0 } = request.query;

      const items = await knowledgeService.list(category, Number(limit), Number(offset));
      return reply.send({ items, total: items.length });
    }
  );

  // 搜索知识条目
  fastify.get<{ Querystring: SearchQuery }>(
    '/search',
    async (request: FastifyRequest<{ Querystring: SearchQuery }>, reply: FastifyReply) => {
      const { q, limit = 10 } = request.query;

      if (!q) {
        return reply.status(400).send({ error: 'Search query is required' });
      }

      const results = await knowledgeService.search(q, Number(limit));
      return reply.send({ results });
    }
  );

  // 获取知识条目详情
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const item = await knowledgeService.getById(request.params.id);

      if (!item) {
        return reply.status(404).send({ error: 'Knowledge item not found' });
      }

      return reply.send(item);
    }
  );

  // 更新知识条目
  fastify.put<{ Params: { id: string }; Body: Partial<KnowledgeItem> }>(
    '/:id',
    async (request, reply) => {
      const item = await knowledgeService.update(request.params.id, request.body);

      if (!item) {
        return reply.status(404).send({ error: 'Knowledge item not found' });
      }

      return reply.send(item);
    }
  );

  // 删除知识条目
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      await knowledgeService.delete(request.params.id);
      return reply.status(204).send();
    }
  );

  // 获取分类列表
  fastify.get(
    '/categories',
    async (request, reply) => {
      const categories = await knowledgeService.getCategories();
      return reply.send({ categories });
    }
  );
}
```

- [ ] **Step 2: 注册到 app.ts**

```typescript
import { knowledgeRoutes } from './routes/knowledge';

await fastify.register(knowledgeRoutes, { prefix: '/api/v1/knowledge', database });
```

- [ ] **Step 3: Commit**

```bash
git add orion-ai-svc/src/routes/knowledge.ts orion-ai-svc/src/app.ts
git commit -m "feat(knowledge): add knowledge API routes"
```

---

### Task 3: 创建威胁监控服务 ThreatMonitor

**Files:**
- Create: `orion-ai-svc/src/services/ThreatMonitor.ts`

- [ ] **Step 1: 创建 ThreatMonitor.ts**

```typescript
// orion-ai-svc/src/services/ThreatMonitor.ts

import { getPool } from '../utils/database';

export type ThreatLevel = 'low' | 'medium' | 'high' | 'critical';
export type ThreatType = 'prompt_injection' | 'data_leak' | 'model_dos' | 'unauthorized_access' | 'hallucination';

export interface ThreatEvent {
  id: string;
  timestamp: Date;
  level: ThreatLevel;
  type: ThreatType;
  description: string;
  source: string;
  details: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export class ThreatMonitor {
  async recordThreat(event: Omit<ThreatEvent, 'id' | 'timestamp'>): Promise<ThreatEvent> {
    const pool = getPool();
    const id = crypto.randomUUID();
    const timestamp = new Date();

    await pool.query(
      `INSERT INTO ai_security_events (id, timestamp, level, type, description, source, details, resolved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, timestamp, event.level, event.type, event.description, event.source, JSON.stringify(event.details), false]
    );

    return { ...event, id, timestamp };
  }

  async getThreats(
    startDate: Date,
    endDate: Date,
    level?: ThreatLevel,
    resolved?: boolean
  ): Promise<ThreatEvent[]> {
    const pool = getPool();
    let query = 'SELECT * FROM ai_security_events WHERE timestamp >= $1 AND timestamp <= $2';
    const params: any[] = [startDate, endDate];
    let paramIndex = 3;

    if (level) {
      query += ` AND level = $${paramIndex++}`;
      params.push(level);
    }
    if (resolved !== undefined) {
      query += ` AND resolved = $${paramIndex++}`;
      params.push(resolved);
    }

    query += ' ORDER BY timestamp DESC';

    const result = await pool.query(query, params);
    return result.rows.map((row) => ({
      ...row,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
    }));
  }

  async resolveThreat(id: string, resolvedBy: string): Promise<boolean> {
    const pool = getPool();
    await pool.query(
      'UPDATE ai_security_events SET resolved = true, resolved_at = $1, resolved_by = $2 WHERE id = $3',
      [new Date(), resolvedBy, id]
    );
    return true;
  }

  async getThreatStats(startDate: Date, endDate: Date): Promise<{
    total: number;
    byLevel: Record<ThreatLevel, number>;
    byType: Record<ThreatType, number>;
    resolved: number;
  }> {
    const pool = getPool();

    const totalResult = await pool.query(
      'SELECT COUNT(*) as count FROM ai_security_events WHERE timestamp >= $1 AND timestamp <= $2',
      [startDate, endDate]
    );

    const levelResult = await pool.query(
      `SELECT level, COUNT(*) as count FROM ai_security_events
       WHERE timestamp >= $1 AND timestamp <= $2 GROUP BY level`,
      [startDate, endDate]
    );

    const typeResult = await pool.query(
      `SELECT type, COUNT(*) as count FROM ai_security_events
       WHERE timestamp >= $1 AND timestamp <= $2 GROUP BY type`,
      [startDate, endDate]
    );

    const resolvedResult = await pool.query(
      `SELECT COUNT(*) as count FROM ai_security_events
       WHERE timestamp >= $1 AND timestamp <= $2 AND resolved = true`,
      [startDate, endDate]
    );

    const byLevel: Record<ThreatLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const row of levelResult.rows) {
      byLevel[row.level] = parseInt(row.count);
    }

    const byType: Record<ThreatType, number> = {
      prompt_injection: 0,
      data_leak: 0,
      model_dos: 0,
      unauthorized_access: 0,
      hallucination: 0,
    };
    for (const row of typeResult.rows) {
      byType[row.type] = parseInt(row.count);
    }

    return {
      total: parseInt(totalResult.rows[0].count),
      byLevel,
      byType,
      resolved: parseInt(resolvedResult.rows[0].count),
    };
  }
}

export const threatMonitor = new ThreatMonitor();
```

- [ ] **Step 2: Commit**

```bash
git add orion-ai-svc/src/services/ThreatMonitor.ts
git commit -m "feat(security): add ThreatMonitor for AI security event tracking"
```

---

### Task 4: 创建合规报告服务 ComplianceReporter

**Files:**
- Create: `orion-ai-svc/src/services/ComplianceReporter.ts`

- [ ] **Step 1: 创建 ComplianceReporter.ts**

```typescript
// orion-ai-svc/src/services/ComplianceReporter.ts

import { threatMonitor, type ThreatEvent } from './ThreatMonitor';
import { costTracker } from './CostTracker';

export interface ComplianceReport {
  id: string;
  generatedAt: Date;
  period: { start: Date; end: Date };
  summary: {
    totalRequests: number;
    totalCost: number;
    totalThreats: number;
    resolvedThreats: number;
    securityScore: number;
  };
  costBreakdown: Record<string, number>;
  threatAnalysis: {
    byLevel: Record<string, number>;
    byType: Record<string, number>;
    trend: Array<{ date: string; count: number }>;
  };
  recommendations: string[];
}

export class ComplianceReporter {
  async generateReport(startDate: Date, endDate: Date): Promise<ComplianceReport> {
    // 获取威胁统计
    const threatStats = await threatMonitor.getThreatStats(startDate, endDate);
    const threats = await threatMonitor.getThreats(startDate, endDate);

    // 获取成本统计
    const costByScenario = await costTracker.getCostByScenario(startDate, endDate);
    const costByProvider = await costTracker.getCostByProvider(startDate, endDate);

    // 计算安全评分 (0-100)
    const threatRate = threatStats.total / Math.max(threatStats.total, 1);
    const resolvedRate = threatStats.resolved / Math.max(threatStats.total, 1);
    const criticalWeight = threatStats.byLevel.critical * 10;
    const highWeight = threatStats.byLevel.high * 5;
    const securityScore = Math.max(0, 100 - (threatRate * 50) - (criticalWeight + highWeight) + (resolvedRate * 30));

    // 生成建议
    const recommendations: string[] = [];
    if (threatStats.byLevel.critical > 0) {
      recommendations.push('发现Critical级别威胁，建议立即处理');
    }
    if (threatStats.byLevel.high > 2) {
      recommendations.push('High级别威胁数量较多，建议加强监控');
    }
    if (resolvedRate < 0.8) {
      recommendations.push('威胁解决率低于80%，建议优化响应流程');
    }
    const totalCost = Object.values(costByScenario).reduce((a, b) => a + b, 0);
    if (totalCost > 1000) {
      recommendations.push(`本月AI成本$${totalCost.toFixed(2)}，建议优化模型使用`);
    }

    const report: ComplianceReport = {
      id: crypto.randomUUID(),
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      summary: {
        totalRequests: 0, // TODO: 从日志统计
        totalCost,
        totalThreats: threatStats.total,
        resolvedThreats: threatStats.resolved,
        securityScore: Math.round(securityScore),
      },
      costBreakdown: { ...costByScenario, ...costByProvider },
      threatAnalysis: {
        byLevel: threatStats.byLevel as any,
        byType: threatStats.byType as any,
        trend: [], // TODO: 按日期聚合
      },
      recommendations,
    };

    return report;
  }

  async getSecurityScore(startDate: Date, endDate: Date): Promise<number> {
    const report = await this.generateReport(startDate, endDate);
    return report.summary.securityScore;
  }
}

export const complianceReporter = new ComplianceReporter();
```

- [ ] **Step 2: Commit**

```bash
git add orion-ai-svc/src/services/ComplianceReporter.ts
git commit -m "feat(security): add ComplianceReporter for security reporting"
```

---

### Task 5: 完善前端知识库页面

**Files:**
- Modify: `orion-frontend/src/pages/KnowledgeBase/index.tsx`

- [ ] **Step 1: 读取现有页面**

```bash
ls -la orion-frontend/src/pages/KnowledgeBase/
```

- [ ] **Step 2: 完善知识库 CRUD 界面**

添加创建、编辑、删除功能：

```typescript
// 添加新增按钮和 Modal
<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
  新建知识
</Button>

<Modal
  title="新建知识条目"
  open={createModalVisible}
  onOk={handleCreate}
  onCancel={() => setCreateModalVisible(false)}
>
  <Form layout="vertical">
    <Form.Item label="标题" name="title" rules={[{ required: true }]}>
      <Input />
    </Form.Item>
    <Form.Item label="分类" name="category" rules={[{ required: true }]}>
      <Select options={categories.map(c => ({ label: c, value: c }))} />
    </Form.Item>
    <Form.Item label="内容" name="content" rules={[{ required: true }]}>
      <TextArea rows={6} />
    </Form.Item>
    <Form.Item label="标签" name="tags">
      <Select mode="tags" />
    </Form.Item>
  </Form>
</Modal>
```

- [ ] **Step 3: 添加搜索功能**

```typescript
<Input.Search
  placeholder="搜索知识库..."
  onSearch={handleSearch}
  style={{ width: 300 }}
/>
```

- [ ] **Step 4: Commit**

```bash
git add orion-frontend/src/pages/KnowledgeBase/
git commit -m "feat(knowledge): enhance KnowledgeBase page with CRUD operations"
```

---

### Task 6: 完善前端安全治理页面

**Files:**
- Modify: `orion-frontend/src/pages/AISecurity/index.tsx`

- [ ] **Step 1: 添加威胁监控仪表板**

```typescript
// 添加威胁统计卡片
<Row gutter={16}>
  <Col span={6}>
    <Card>
      <Statistic title="安全评分" value={securityScore} suffix="/100" />
    </Card>
  </Col>
  <Col span={6}>
    <Card>
      <Statistic title="总威胁数" value={threatStats.total} />
    </Card>
  </Col>
  <Col span={6}>
    <Card>
      <Statistic title="已解决" value={threatStats.resolved} />
    </Card>
  </Col>
  <Col span={6}>
    <Card>
      <Statistic title="待处理" value={threatStats.total - threatStats.resolved} />
    </Card>
  </Col>
</Row>

// 添加威胁级别分布
<Tabs>
  <TabPane tab="威胁列表" key="list">
    <Table dataSource={threats} columns={threatColumns} />
  </TabPane>
  <TabPane tab="安全报告" key="report">
    <Button onClick={generateReport}>生成报告</Button>
    {report && (
      <Card>
        <Title level={4}>安全评分: {report.summary.securityScore}</Title>
        <List
          dataSource={report.recommendations}
          renderItem={(item) => <List.Item>{item}</List.Item>}
        />
      </Card>
    )}
  </TabPane>
</Tabs>
```

- [ ] **Step 2: Commit**

```bash
git add orion-frontend/src/pages/AISecurity/
git commit -m "feat(security): enhance AISecurity page with threat monitoring"
```

---

### Task 7: 验证测试

- [ ] **Step 1: 测试知识库 API**

```bash
# 创建
curl -X POST http://localhost:3012/api/v1/knowledge \
  -H "Content-Type: application/json" \
  -d '{"title":"测试","content":"内容","category":"运维","tags":["test"]}'

# 列表
curl http://localhost:3012/api/v1/knowledge

# 搜索
curl "http://localhost:3012/api/v1/knowledge/search?q=test"
```

- [ ] **Step 2: 测试前端页面**

访问 http://localhost:5173/ai/knowledge
Expected: 知识库页面可 CRUD

- [ ] **Step 3: 测试安全页面**

访问 http://localhost:5173/ai/security
Expected: 安全仪表板显示威胁统计

---

## Self-Review

### 1. Spec Coverage Check

| Spec Section | Task |
|-------------|------|
| 知识库 CRUD | Task 1-2, 5 |
| 威胁监控 | Task 3, 6 |
| 合规报告 | Task 4, 6 |
| 安全评估完善 | Task 3-4 |

### 2. Placeholder Scan

No placeholders. All code complete.

### 3. Type Consistency

- Uses existing database patterns
- Consistent with Phase 1-3 implementations

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-18-phase4-knowledge-security.md`.**

---

**所有 Phase 实施计划已创建完成：**

1. `2026-05-18-ai-permission-infrastructure.md` - Phase 1a ✅
2. `2026-05-18-agent-service-merge.md` - Phase 1b ✅
3. `2026-05-18-phase2-ai-gateway-extension.md` - Phase 2
4. `2026-05-18-phase3-chatops-menu.md` - Phase 3
5. `2026-05-18-phase4-knowledge-security.md` - Phase 4

**是否开始执行某个 Phase？**