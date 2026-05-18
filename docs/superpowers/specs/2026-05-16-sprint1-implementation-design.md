# Sprint 1: Three Independent Feature Implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal**: Implement 3 independent missing features identified in the 34-modules audit: Release Notes, Alert Silences, and Pipeline Budget API.

**Architecture**: Three parallel agents, each implementing one feature in a separate service. Zero file overlap between agents — deploy-svc, monitor-svc, and pipeline-svc are independent.

**Tech Stack**: TypeScript + Fastify + PostgreSQL (existing patterns in each service).

---

## Agent A: Release Notes Generator (deploy-svc)

**Goal**: Auto-generate release notes from Git commit history between two refs.

**Architecture**: Service uses `child_process.exec` to call `git log` with format options. Parses conventional commit types (feat, fix, chore, etc.). Groups by type. Generates Markdown.

**Tech Stack**: TypeScript, child_process, conventional commit parser.

### Task A1: Release Notes Service

**Files:**
- Create: `orion-deploy-svc/src/services/ReleaseNotesService.ts`
- Test: `orion-deploy-svc/src/services/__tests__/ReleaseNotesService.test.ts`

```typescript
// ReleaseNotesService.ts - core implementation

export interface ReleaseNotesOptions {
  fromRef: string;
  toRef?: string;
  repository?: string;
}

export interface ReleaseNotesSection {
  type: string;
  commits: Array<{ hash: string; message: string; author: string; date: string }>;
}

export interface ReleaseNotesResult {
  title: string;
  generatedAt: string;
  fromRef: string;
  toRef: string;
  sections: ReleaseNotesSection[];
  markdown: string;
}

const CONVENTIONAL_TYPES: Record<string, string> = {
  feat: 'Features',
  fix: 'Bug Fixes',
  refactor: 'Refactoring',
  perf: 'Performance Improvements',
  docs: 'Documentation',
  chore: 'Chores',
  test: 'Tests',
  ci: 'CI/CD',
};

export class ReleaseNotesService {
  async generate(options: ReleaseNotesOptions): Promise<ReleaseNotesResult> {
    const { fromRef, toRef = 'HEAD', repository = process.cwd() } = options;
    const format = '%H|%s|%an|%ad';
    const command = `git -C ${repository} log ${fromRef}..${toRef} --pretty=format:"${format}"`;
    const output = await this.execCommand(command);
    const commits = this.parseCommits(output);
    const sections = this.groupByType(commits);
    const markdown = this.renderMarkdown(sections, fromRef, toRef);

    return {
      title: `Release Notes ${fromRef}..${toRef}`,
      generatedAt: new Date().toISOString(),
      fromRef,
      toRef,
      sections,
      markdown,
    };
  }

  private execCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      exec(command, { timeout: 30000 }, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout.trim());
      });
    });
  }

  private parseCommits(output: string): Array<{ hash: string; message: string; author: string; date: string }> {
    if (!output) return [];
    return output.split('\n').filter(Boolean).map(line => {
      const [hash, message, author, date] = line.split('|');
      return { hash, message, author, date };
    });
  }

  private groupByType(commits: Array<{ hash: string; message: string; author: string; date: string }>): ReleaseNotesSection[] {
    const sections: Record<string, ReleaseNotesSection> = {};
    for (const commit of commits) {
      const match = commit.message.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.*)/);
      const rawType = match ? match[1] : 'other';
      const scope = match ? match[2] : undefined;
      const description = match ? match[3] : commit.message;
      const type = CONVENTIONAL_TYPES[rawType] || 'Other Changes';

      if (!sections[type]) {
        sections[type] = { type, commits: [] };
      }
      sections[type].commits.push({
        hash: commit.hash.substring(0, 7),
        message: `${scope ? `**${scope}:** ` : ''}${description}`,
        author: commit.author,
        date: commit.date,
      });
    }
    return Object.values(sections);
  }

  private renderMarkdown(sections: ReleaseNotesSection[], fromRef: string, toRef: string): string {
    let md = `# Release Notes: ${fromRef}..${toRef}\n\n`;
    md += `Generated at: ${new Date().toISOString()}\n\n`;
    for (const section of sections) {
      md += `## ${section.type}\n\n`;
      for (const commit of section.commits) {
        md += `- ${commit.message} ([${commit.hash}](../../commit/${commit.hash}))\n`;
      }
      md += '\n';
    }
    return md;
  }
}
```

- [ ] **Step 1: Write the failing test**

```typescript
// ReleaseNotesService.test.ts
import { ReleaseNotesService } from '../ReleaseNotesService';
import { exec } from 'child_process';

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

describe('ReleaseNotesService', () => {
  const service = new ReleaseNotesService();
  const mockExec = exec as jest.MockedFunction<typeof exec>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generate', () => {
    it('should generate release notes from git log', async () => {
      const gitOutput = [
        'abc1234|feat(auth): add login page|John Doe|Mon Jan 1 12:00:00 2024 +0800',
        'def5678|fix(api): resolve timeout issue|Jane Smith|Mon Jan 1 13:00:00 2024 +0800',
        'ghi9012|chore: update dependencies|Bot User|Mon Jan 1 14:00:00 2024 +0800',
      ].join('\n');

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        cb(null, gitOutput);
      });

      const result = await service.generate({ fromRef: 'v1.0.0', toRef: 'v1.1.0' });

      expect(result.title).toBe('Release Notes v1.0.0..v1.1.0');
      expect(result.sections).toHaveLength(3);
      expect(result.sections[0].type).toBe('Features');
      expect(result.sections[1].type).toBe('Bug Fixes');
      expect(result.sections[2].type).toBe('Chores');
      expect(result.markdown).toContain('## Features');
      expect(result.markdown).toContain('## Bug Fixes');
    });

    it('should handle empty git log output', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        cb(null, '');
      });

      const result = await service.generate({ fromRef: 'v1.0.0', toRef: 'v1.0.0' });

      expect(result.sections).toHaveLength(0);
      expect(result.markdown).toContain('v1.0.0..v1.0.0');
    });

    it('should handle commits without conventional commit prefix', async () => {
      const gitOutput = 'abc1234|some random commit message|John Doe|Mon Jan 1 12:00:00 2024 +0800';
      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        cb(null, gitOutput);
      });

      const result = await service.generate({ fromRef: 'v1.0.0' });

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].type).toBe('Other Changes');
    });

    it('should reject on git command failure', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        cb(new Error('fatal: bad revision'), '');
      });

      await expect(service.generate({ fromRef: 'bad-ref' })).rejects.toThrow('bad revision');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-deploy-svc && npx jest src/services/__tests__/ReleaseNotesService.test.ts -t "should generate release notes from git log" --no-coverage`
Expected: FAIL with "ReleaseNotesService is not a constructor"

- [ ] **Step 3: Write minimal implementation**

Create `orion-deploy-svc/src/services/ReleaseNotesService.ts` with the implementation above.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-deploy-svc && npx jest src/services/__tests__/ReleaseNotesService.test.ts -v --no-coverage`
Expected: 4/4 PASS

- [ ] **Step 5: Add route handler**

**File:** Modify `orion-deploy-svc/src/routes/deploy-routes.ts`

Add route registration:
```typescript
import { ReleaseNotesService } from '../services/ReleaseNotesService';

// Inside the route registration function:
const releaseNotesService = new ReleaseNotesService();

fastify.post('/deploy/release-notes', async (request, reply) => {
  const { fromRef, toRef, repository } = request.body as { fromRef: string; toRef?: string; repository?: string };
  if (!fromRef) {
    return reply.code(400).send({ error: 'fromRef is required' });
  }
  const result = await releaseNotesService.generate({ fromRef, toRef, repository });
  return reply.send({ data: result });
});

fastify.post('/deploy/release-notes/generate', async (request, reply) => {
  // Alias endpoint for convenience
  const { fromRef, toRef, repository } = request.body as { fromRef: string; toRef?: string; repository?: string };
  if (!fromRef) {
    return reply.code(400).send({ error: 'fromRef is required' });
  }
  const result = await releaseNotesService.generate({ fromRef, toRef, repository });
  return reply.send({ data: result });
});
```

- [ ] **Step 6: Verify TypeScript compilation**

Run: `cd orion-deploy-svc && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add orion-deploy-svc/src/services/ReleaseNotesService.ts orion-deploy-svc/src/services/__tests__/ReleaseNotesService.test.ts orion-deploy-svc/src/routes/deploy-routes.ts
git commit -m "feat(deploy-svc): implement release notes generator from git history"
```

---

## Agent B: Alert Silences (monitor-svc)

**Goal**: Implement alert silence rules — time-window based alert suppression for maintenance periods.

**Architecture**: Service manages silence rules in PostgreSQL. Each rule has match conditions (labels regex), time window (start/end or cron), and scope (all alerts or specific). AlertService checks silences before creating/notifying.

**Tech Stack**: TypeScript + Fastify + PostgreSQL + node-cron.

### Task B1: Alert Silence Service

**Files:**
- Create: `orion-monitor-svc/src/services/AlertSilenceService.ts`
- Create: `orion-monitor-svc/src/repositories/AlertSilenceRepository.ts`
- Create: `orion-monitor-svc/src/db/migrations/003_alert_silences.sql`
- Test: `orion-monitor-svc/src/services/__tests__/AlertSilenceService.test.ts`

```typescript
// AlertSilenceRepository.ts

export interface AlertSilence {
  id: string;
  createdBy: string;
  matchers: Array<{ name: string; pattern: string; isRegex: boolean }>;
  startsAt: Date;
  endsAt: Date | null;
  comment: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class AlertSilenceRepository {
  constructor(private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }> }) {}

  async create(data: Omit<AlertSilence, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertSilence> {
    const id = `silence-${crypto.randomUUID()}`;
    await this.db.query(
      `INSERT INTO alert_silences (id, created_by, matchers, starts_at, ends_at, comment, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, data.createdBy, JSON.stringify(data.matchers), data.startsAt, data.endsAt, data.comment, true],
    );
    return { ...data, id, createdAt: new Date(), updatedAt: new Date() };
  }

  async findAll(activeOnly?: boolean): Promise<AlertSilence[]> {
    let query = 'SELECT * FROM alert_silences';
    const params: unknown[] = [];
    if (activeOnly) {
      query += ' WHERE is_active = true AND starts_at <= NOW() AND (ends_at IS NULL OR ends_at > NOW())';
    }
    query += ' ORDER BY created_at DESC';
    const result = await this.db.query(query, params);
    return result.rows.map(this.mapRow);
  }

  async findById(id: string): Promise<AlertSilence | null> {
    const result = await this.db.query('SELECT * FROM alert_silences WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query('UPDATE alert_silences SET is_active = false WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async matchSilence(labels: Record<string, string>): Promise<AlertSilence | null> {
    const silences = await this.findAll(true);
    for (const silence of silences) {
      if (this.matchesLabels(labels, silence.matchers)) {
        return silence;
      }
    }
    return null;
  }

  private matchesLabels(labels: Record<string, string>, matchers: Array<{ name: string; pattern: string; isRegex: boolean }>): boolean {
    return matchers.every(m => {
      const value = labels[m.name];
      if (!value) return false;
      return m.isRegex ? new RegExp(m.pattern).test(value) : value === m.pattern;
    });
  }

  private mapRow(row: any): AlertSilence {
    return {
      id: row.id,
      createdBy: row.created_by,
      matchers: typeof row.matchers === 'string' ? JSON.parse(row.matchers) : row.matchers || [],
      startsAt: new Date(row.starts_at),
      endsAt: row.ends_at ? new Date(row.ends_at) : null,
      comment: row.comment || '',
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
```

```typescript
// AlertSilenceService.ts

import { AlertSilenceRepository, AlertSilence } from '../repositories/AlertSilenceRepository';

export interface CreateSilenceInput {
  createdBy: string;
  matchers: Array<{ name: string; pattern: string; isRegex: boolean }>;
  startsAt: Date;
  endsAt: Date | null;
  comment: string;
}

export class AlertSilenceService {
  constructor(private repo: AlertSilenceRepository) {}

  async create(input: CreateSilenceInput): Promise<AlertSilence> {
    return this.repo.create(input);
  }

  async listActive(): Promise<AlertSilence[]> {
    return this.repo.findAll(true);
  }

  async listAll(): Promise<AlertSilence[]> {
    return this.repo.findAll(false);
  }

  async delete(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }

  async shouldSuppress(labels: Record<string, string>): Promise<{ suppressed: boolean; silence?: AlertSilence }> {
    const silence = await this.repo.matchSilence(labels);
    if (silence) {
      return { suppressed: true, silence };
    }
    return { suppressed: false };
  }
}
```

```sql
-- 003_alert_silences.sql

CREATE TABLE IF NOT EXISTS alert_silences (
  id          VARCHAR(255) PRIMARY KEY,
  created_by  VARCHAR(255) NOT NULL,
  matchers    JSONB NOT NULL DEFAULT '[]',
  starts_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at     TIMESTAMPTZ,
  comment     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_silences_active ON alert_silences(is_active, starts_at, ends_at);
CREATE INDEX idx_silences_created ON alert_silences(created_at DESC);

-- Rollback:
-- DROP TABLE IF EXISTS alert_silences;
```

- [ ] **Step 1: Write the failing test**

```typescript
// AlertSilenceService.test.ts
import { AlertSilenceService } from '../AlertSilenceService';
import { AlertSilenceRepository } from '../repositories/AlertSilenceRepository';

describe('AlertSilenceService', () => {
  const mockRepo = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    matchSilence: jest.fn(),
  };

  const service = new AlertSilenceService(mockRepo as unknown as AlertSilenceRepository);

  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a silence rule', async () => {
      const input = {
        createdBy: 'user1',
        matchers: [{ name: 'alertname', pattern: 'HighMemory', isRegex: false }],
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600000),
        comment: 'Maintenance window',
      };
      mockRepo.create.mockResolvedValue({ ...input, id: 'silence-1', isActive: true, createdAt: new Date(), updatedAt: new Date() });

      const result = await service.create(input);

      expect(result.id).toBeDefined();
      expect(result.isActive).toBe(true);
    });
  });

  describe('shouldSuppress', () => {
    it('should suppress alerts matching active silence', async () => {
      const silence = { id: 'silence-1', createdBy: 'user1', matchers: [{ name: 'service', pattern: 'api', isRegex: false }], startsAt: new Date(), endsAt: null, comment: '', isActive: true, createdAt: new Date(), updatedAt: new Date() };
      mockRepo.matchSilence.mockResolvedValue(silence);

      const result = await service.shouldSuppress({ service: 'api', alertname: 'HighCPU' });

      expect(result.suppressed).toBe(true);
      expect(result.silence).toBe(silence);
    });

    it('should not suppress non-matching alerts', async () => {
      mockRepo.matchSilence.mockResolvedValue(null);

      const result = await service.shouldSuppress({ service: 'web', alertname: 'HighCPU' });

      expect(result.suppressed).toBe(false);
    });
  });

  describe('listActive', () => {
    it('should return only active silences', async () => {
      mockRepo.findAll.mockResolvedValue([{ id: 'silence-1' }]);

      const result = await service.listActive();

      expect(result).toHaveLength(1);
      expect(mockRepo.findAll).toHaveBeenCalledWith(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-monitor-svc && npx jest src/services/__tests__/AlertSilenceService.test.ts -v --no-coverage`
Expected: FAIL (files don't exist yet)

- [ ] **Step 3: Write minimal implementation**

Create all 4 files (repository, service, migration, test).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-monitor-svc && npx jest src/services/__tests__/AlertSilenceService.test.ts -v --no-coverage`
Expected: 4/4 PASS

- [ ] **Step 5: Add route handlers**

Create: `orion-monitor-svc/src/routes/alert-silence-routes.ts`

Register in `orion-monitor-svc/src/app.ts`.

- [ ] **Step 6: Verify TypeScript compilation**

Run: `cd orion-monitor-svc && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add orion-monitor-svc/src/services/AlertSilenceService.ts orion-monitor-svc/src/repositories/AlertSilenceRepository.ts orion-monitor-svc/src/db/migrations/003_alert_silences.sql orion-monitor-svc/src/services/__tests__/AlertSilenceService.test.ts orion-monitor-svc/src/routes/alert-silence-routes.ts orion-monitor-svc/src/app.ts
git commit -m "feat(monitor-svc): implement alert silence rules with time-window suppression"
```

### Task B2: Integrate with AlertService

Modify `orion-monitor-svc/src/services/AlertService.ts` to check silences before creating alerts.

---

## Agent C: Pipeline Budget API (pipeline-svc)

**Goal**: Pipeline run budget management — set per-pipeline budgets, track usage, auto-block when exceeded.

**Architecture**: BudgetRepository stores budget configs. PipelineBudgetService checks budget before run starts, updates usage after run completes. Integration with PipelineEngine via pre-run hook.

**Tech Stack**: TypeScript + Fastify + PostgreSQL.

### Task C1: Budget Repository and Service

**Files:**
- Create: `orion-platform-service/src/repositories/BudgetRepository.ts`
- Create: `orion-platform-service/src/services/PipelineBudgetService.ts`
- Create: `orion-platform-service/src/db/migrations/004_pipeline_budget.sql`
- Test: `orion-platform-service/src/services/__tests__/PipelineBudgetService.test.ts`

```typescript
// BudgetRepository.ts

export interface PipelineBudget {
  id: string;
  pipelineId: string;
  maxCost: number;
  currentCost: number;
  currency: string;
  blocked: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class BudgetRepository {
  constructor(private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }> }) {}

  async create(data: Omit<PipelineBudget, 'id' | 'currentCost' | 'createdAt' | 'updatedAt'>): Promise<PipelineBudget> {
    const id = `budget-${crypto.randomUUID()}`;
    await this.db.query(
      `INSERT INTO pipeline_budgets (id, pipeline_id, max_cost, current_cost, currency, blocked, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, data.pipelineId, data.maxCost, 0, data.currency || 'USD', false, data.createdBy],
    );
    return { ...data, id, currentCost: 0, createdAt: new Date(), updatedAt: new Date() };
  }

  async findByPipelineId(pipelineId: string): Promise<PipelineBudget | null> {
    const result = await this.db.query('SELECT * FROM pipeline_budgets WHERE pipeline_id = $1', [pipelineId]);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async update(pipelineId: string, updates: Partial<PipelineBudget>): Promise<PipelineBudget | null> {
    const existing = await this.findByPipelineId(pipelineId);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (updates.maxCost !== undefined) { fields.push(`max_cost = $${index++}`); values.push(updates.maxCost); }
    if (updates.currentCost !== undefined) { fields.push(`current_cost = $${index++}`); values.push(updates.currentCost); }
    if (updates.blocked !== undefined) { fields.push(`blocked = $${index++}`); values.push(updates.blocked); }

    if (fields.length === 0) return existing;

    values.push(pipelineId);
    const result = await this.db.query(
      `UPDATE pipeline_budgets SET ${fields.join(', ')}, updated_at = NOW() WHERE pipeline_id = $${index} RETURNING *`,
      values,
    );
    return this.mapRow(result.rows[0]);
  }

  async delete(pipelineId: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM pipeline_budgets WHERE pipeline_id = $1', [pipelineId]);
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: any): PipelineBudget {
    return {
      id: row.id,
      pipelineId: row.pipeline_id,
      maxCost: parseFloat(row.max_cost),
      currentCost: parseFloat(row.current_cost),
      currency: row.currency,
      blocked: row.blocked,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
```

```typescript
// PipelineBudgetService.ts

import { BudgetRepository, PipelineBudget } from '../repositories/BudgetRepository';

export class PipelineBudgetService {
  constructor(private repo: BudgetRepository) {}

  async setBudget(pipelineId: string, maxCost: number, currency: string, createdBy: string): Promise<PipelineBudget> {
    const existing = await this.repo.findByPipelineId(pipelineId);
    if (existing) {
      return this.repo.update(pipelineId, { maxCost, currency, blocked: false });
    }
    return this.repo.create({ pipelineId, maxCost, currency, blocked: false, createdBy });
  }

  async checkBudget(pipelineId: string): Promise<{ allowed: boolean; budget?: PipelineBudget; reason?: string }> {
    const budget = await this.repo.findByPipelineId(pipelineId);
    if (!budget) {
      return { allowed: true }; // No budget set = allowed
    }
    if (budget.blocked) {
      return { allowed: false, budget, reason: 'Budget manually blocked' };
    }
    if (budget.currentCost >= budget.maxCost) {
      return { allowed: false, budget, reason: `Budget exceeded: ${budget.currentCost}/${budget.maxCost}` };
    }
    return { allowed: true, budget };
  }

  async updateUsage(pipelineId: string, costDelta: number): Promise<PipelineBudget | null> {
    const budget = await this.repo.findByPipelineId(pipelineId);
    if (!budget) return null;

    const newCost = budget.currentCost + costDelta;
    const blocked = newCost >= budget.maxCost;
    return this.repo.update(pipelineId, { currentCost: newCost, blocked });
  }

  async getBudget(pipelineId: string): Promise<PipelineBudget | null> {
    return this.repo.findByPipelineId(pipelineId);
  }

  async deleteBudget(pipelineId: string): Promise<boolean> {
    return this.repo.delete(pipelineId);
  }
}
```

```sql
-- 004_pipeline_budget.sql

CREATE TABLE IF NOT EXISTS pipeline_budgets (
  id           VARCHAR(255) PRIMARY KEY,
  pipeline_id  UUID NOT NULL,
  max_cost     DECIMAL(10,2) NOT NULL,
  current_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency     VARCHAR(10) NOT NULL DEFAULT 'USD',
  blocked      BOOLEAN NOT NULL DEFAULT false,
  created_by   VARCHAR(255) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_budget_pipeline ON pipeline_budgets(pipeline_id);
CREATE INDEX idx_budget_blocked ON pipeline_budgets(blocked);

-- Rollback:
-- DROP TABLE IF EXISTS pipeline_budgets;
```

- [ ] **Step 1: Write the failing test**

```typescript
// PipelineBudgetService.test.ts
import { PipelineBudgetService } from '../PipelineBudgetService';
import { BudgetRepository, PipelineBudget } from '../repositories/BudgetRepository';

describe('PipelineBudgetService', () => {
  const mockRepo = {
    create: jest.fn(),
    findByPipelineId: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const service = new PipelineBudgetService(mockRepo as unknown as BudgetRepository);

  beforeEach(() => jest.clearAllMocks());

  describe('setBudget', () => {
    it('should create a new budget when none exists', async () => {
      mockRepo.findByPipelineId.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue({
        id: 'budget-1', pipelineId: 'pipe-1', maxCost: 100, currentCost: 0,
        currency: 'USD', blocked: false, createdBy: 'user1',
        createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.setBudget('pipe-1', 100, 'USD', 'user1');

      expect(mockRepo.create).toHaveBeenCalled();
      expect(result.maxCost).toBe(100);
    });

    it('should update existing budget', async () => {
      mockRepo.findByPipelineId.mockResolvedValue({ id: 'budget-1', pipelineId: 'pipe-1', maxCost: 50, currentCost: 10, currency: 'USD', blocked: false, createdBy: 'user1', createdAt: new Date(), updatedAt: new Date() });
      mockRepo.update.mockResolvedValue({
        id: 'budget-1', pipelineId: 'pipe-1', maxCost: 200, currentCost: 10,
        currency: 'USD', blocked: false, createdBy: 'user1',
        createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.setBudget('pipe-1', 200, 'USD', 'user1');

      expect(mockRepo.update).toHaveBeenCalled();
      expect(result.maxCost).toBe(200);
    });
  });

  describe('checkBudget', () => {
    it('should allow when no budget is set', async () => {
      mockRepo.findByPipelineId.mockResolvedValue(null);
      expect((await service.checkBudget('pipe-1')).allowed).toBe(true);
    });

    it('should allow when under budget', async () => {
      mockRepo.findByPipelineId.mockResolvedValue({ id: 'budget-1', pipelineId: 'pipe-1', maxCost: 100, currentCost: 50, currency: 'USD', blocked: false, createdBy: 'user1', createdAt: new Date(), updatedAt: new Date() });
      expect((await service.checkBudget('pipe-1')).allowed).toBe(true);
    });

    it('should block when budget exceeded', async () => {
      mockRepo.findByPipelineId.mockResolvedValue({ id: 'budget-1', pipelineId: 'pipe-1', maxCost: 100, currentCost: 120, currency: 'USD', blocked: false, createdBy: 'user1', createdAt: new Date(), updatedAt: new Date() });
      const result = await service.checkBudget('pipe-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Budget exceeded');
    });

    it('should block when manually blocked', async () => {
      mockRepo.findByPipelineId.mockResolvedValue({ id: 'budget-1', pipelineId: 'pipe-1', maxCost: 100, currentCost: 50, currency: 'USD', blocked: true, createdBy: 'user1', createdAt: new Date(), updatedAt: new Date() });
      const result = await service.checkBudget('pipe-1');
      expect(result.allowed).toBe(false);
    });
  });

  describe('updateUsage', () => {
    it('should update cost and auto-block when exceeded', async () => {
      mockRepo.findByPipelineId.mockResolvedValue({ id: 'budget-1', pipelineId: 'pipe-1', maxCost: 100, currentCost: 90, currency: 'USD', blocked: false, createdBy: 'user1', createdAt: new Date(), updatedAt: new Date() });
      mockRepo.update.mockResolvedValue({ id: 'budget-1', pipelineId: 'pipe-1', maxCost: 100, currentCost: 110, currency: 'USD', blocked: true, createdBy: 'user1', createdAt: new Date(), updatedAt: new Date() });

      const result = await service.updateUsage('pipe-1', 20);

      expect(mockRepo.update).toHaveBeenCalledWith('pipe-1', { currentCost: 110, blocked: true });
      expect(result?.blocked).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-platform-service && npx jest src/services/__tests__/PipelineBudgetService.test.ts -v --no-coverage`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Create all 4 files.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest src/services/__tests__/PipelineBudgetService.test.ts -v --no-coverage`
Expected: 8/8 PASS

- [ ] **Step 5: Add route handlers**

Create: `orion-platform-service/src/api/pipeline-budget-routes.ts`
Register in `orion-platform-service/src/api/routes.ts`.

- [ ] **Step 6: Verify TypeScript compilation**

Run: `cd orion-platform-service && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add orion-platform-service/src/repositories/BudgetRepository.ts orion-platform-service/src/services/PipelineBudgetService.ts orion-platform-service/src/db/migrations/004_pipeline_budget.sql orion-platform-service/src/services/__tests__/PipelineBudgetService.test.ts orion-platform-service/src/api/pipeline-budget-routes.ts orion-platform-service/src/api/routes.ts
git commit -m "feat(pipeline): implement budget management with usage tracking and auto-blocking"
```

---

## Execution Order (Parallel)

All 3 agents can run in parallel — they modify completely different services with zero shared files:

- **Agent A** → `orion-deploy-svc/` (deploy service)
- **Agent B** → `orion-monitor-svc/` (monitor service)
- **Agent C** → `orion-platform-service/` (platform service)

No merge conflicts possible. All 3 commits are independent.
