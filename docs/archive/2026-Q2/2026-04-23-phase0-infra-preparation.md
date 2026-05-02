# Phase 0 — 基础设施准备 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Phase 1 持久化所需的基础设施：BaseRepository 通用基类、Query Builder、AuditRepository 持久化存储、以及 10 个补充迁移文件。

**Architecture:** `DatabasePool` 已存在于 `src/services/database.ts`（pg.Pool 封装）。本阶段在此基础上构建 Repository 层，并将 AuditLogChain 从 Map 存储迁移为数据库追加写入模式。

**Tech Stack:** TypeScript, pg (PostgreSQL), Fastify, Jest, uuid v4, pino

---

### Task 1: BaseRepository — 泛型 Repository 基类

**Files:**
- Create: `orion-platform-service/src/db/base-repository.ts`
- Test: `orion-platform-service/src/db/__tests__/base-repository.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// orion-platform-service/src/db/__tests__/base-repository.test.ts
import { BaseRepository } from '../base-repository';

interface TestEntity {
  id: string;
  name: string;
  status: string;
  created_at?: Date;
  updated_at?: Date;
}

class TestRepository extends BaseRepository<TestEntity> {
  constructor(db: any) {
    super(db, 'test_entities');
  }

  protected mapRowToEntity(row: any): TestEntity {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

describe('BaseRepository', () => {
  let repo: TestRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };
    repo = new TestRepository(mockDb);
  });

  test('findById should return entity when found', async () => {
    const mockRow = { id: '1', name: 'Test', status: 'active', created_at: new Date(), updated_at: new Date() };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

    const result = await repo.findById('1');
    expect(result).toEqual({
      id: '1',
      name: 'Test',
      status: 'active',
      created_at: mockRow.created_at,
      updated_at: mockRow.updated_at,
    });
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1'), ['1']);
  });

  test('findById should return undefined when not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await repo.findById('nonexistent');
    expect(result).toBeUndefined();
  });

  test('findAll should return entities with pagination', async () => {
    const mockRows = [
      { id: '1', name: 'Test 1', status: 'active', created_at: new Date(), updated_at: new Date() },
      { id: '2', name: 'Test 2', status: 'inactive', created_at: new Date(), updated_at: new Date() },
    ];
    mockDb.query.mockResolvedValueOnce({ rows: mockRows, rowCount: 2 });
    mockDb.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });

    const result = await repo.findAll({ limit: 10, offset: 0 });
    expect(result.entities).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  test('create should insert and return entity', async () => {
    const mockRow = { id: '1', name: 'New', status: 'active', created_at: new Date(), updated_at: new Date() };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.create({ id: '1', name: 'New', status: 'active' });
    expect(result.id).toBe('1');
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('INSERT'), expect.any(Array));
  });

  test('update should modify entity', async () => {
    const mockRow = { id: '1', name: 'Updated', status: 'active', created_at: new Date(), updated_at: new Date() };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.update('1', { name: 'Updated', status: 'active' });
    expect(result.name).toBe('Updated');
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE'), expect.any(Array));
  });

  test('delete should remove entity', async () => {
    mockDb.query.mockResolvedValue({ rowCount: 1 });

    const result = await repo.delete('1');
    expect(result).toBe(true);
  });

  test('delete should return false when not found', async () => {
    mockDb.query.mockResolvedValue({ rowCount: 0 });

    const result = await repo.delete('nonexistent');
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-platform-service && npx jest src/db/__tests__/base-repository.test.ts --no-coverage`
Expected: FAIL with "Cannot find module '../base-repository'"

- [ ] **Step 3: Write the BaseRepository implementation**

```typescript
// orion-platform-service/src/db/base-repository.ts
import pino from 'pino';

const logger = pino({ name: 'base-repository' });

export interface FindAllOptions {
  where?: Record<string, any>;
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface FindAllResult<T> {
  entities: T[];
  total: number;
}

export abstract class BaseRepository<T extends { id: string }> {
  constructor(
    protected db: any,
    protected tableName: string,
  ) {}

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<T | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all entities with optional filters and pagination
   */
  async findAll(options: FindAllOptions = {}): Promise<FindAllResult<T>> {
    const { where = {}, orderBy = 'created_at', orderDir = 'DESC', limit = 20, offset = 0 } = options;

    let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const queryParams: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(where)) {
      if (value !== undefined && value !== null) {
        query += ` AND ${key} = $${paramIndex}`;
        queryParams.push(value);
        paramIndex++;
      }
    }

    query += ` ORDER BY ${orderBy} ${orderDir} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await this.db.query(query, queryParams);

    // Get total count
    const countQuery = query.replace(/SELECT \* FROM/, 'SELECT COUNT(*) as count FROM').split(' ORDER BY ')[0];
    const countResult = await this.db.query(countQuery, queryParams.slice(0, -2));

    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Create new entity
   */
  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<T, 'id'>>): Promise<T> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update entity by ID
   */
  async update(id: string, data: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    const query = `UPDATE ${this.tableName} SET ${setClause}, updated_at = NOW() WHERE id = $${columns.length + 1} RETURNING *`;
    const result = await this.db.query(query, [...values, id]);
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Map database row to entity (must be implemented by subclass)
   */
  protected abstract mapRowToEntity(row: any): T;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest src/db/__tests__/base-repository.test.ts --no-coverage`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
cd orion-platform-service
git add src/db/base-repository.ts src/db/__tests__/base-repository.test.ts
git commit -m "feat(phase0): add BaseRepository generic base class with CRUD operations

Provides findById, findAll, create, update, delete for all repositories
to inherit. Uses parameterized queries to prevent SQL injection.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: QueryBuilder — 参数化查询构建器

**Files:**
- Create: `orion-platform-service/src/db/query-builder.ts`
- Test: `orion-platform-service/src/db/__tests__/query-builder.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// orion-platform-service/src/db/__tests__/query-builder.test.ts
import { QueryBuilder } from '../query-builder';

describe('QueryBuilder', () => {
  test('should build SELECT query with where clause', () => {
    const qb = new QueryBuilder('users');
    const { sql, params } = qb.select().where({ status: 'active', role: 'admin' }).build();

    expect(sql).toContain('SELECT * FROM users');
    expect(sql).toContain('WHERE status = $1');
    expect(sql).toContain('AND role = $2');
    expect(params).toEqual(['active', 'admin']);
  });

  test('should build SELECT query with ordering and pagination', () => {
    const qb = new QueryBuilder('users');
    const { sql, params } = qb.select()
      .orderBy('created_at', 'DESC')
      .limit(10)
      .offset(20)
      .build();

    expect(sql).toContain('ORDER BY created_at DESC');
    expect(sql).toContain('LIMIT $');
    expect(sql).toContain('OFFSET $');
  });

  test('should build INSERT query', () => {
    const qb = new QueryBuilder('users');
    const { sql, params } = qb.insert({ name: 'John', email: 'john@test.com' }).build();

    expect(sql).toContain('INSERT INTO users');
    expect(sql).toContain('(name, email)');
    expect(sql).toContain('VALUES ($1, $2)');
    expect(params).toEqual(['John', 'john@test.com']);
  });

  test('should build UPDATE query', () => {
    const qb = new QueryBuilder('users');
    const { sql, params } = qb.update({ name: 'Jane' }).where({ id: '1' }).build();

    expect(sql).toContain('UPDATE users');
    expect(sql).toContain('SET name = $1');
    expect(sql).toContain('WHERE id = $');
    expect(params).toEqual(['Jane', '1']);
  });

  test('should build DELETE query', () => {
    const qb = new QueryBuilder('users');
    const { sql, params } = qb.delete().where({ id: '1' }).build();

    expect(sql).toContain('DELETE FROM users');
    expect(sql).toContain('WHERE id = $1');
    expect(params).toEqual(['1']);
  });

  test('should prevent SQL injection in table name', () => {
    const qb = new QueryBuilder('users; DROP TABLE users;');
    expect(() => qb.select().build()).toThrow();
  });

  test('should build COUNT query', () => {
    const qb = new QueryBuilder('users');
    const { sql, params } = qb.count().where({ status: 'active' }).build();

    expect(sql).toContain('SELECT COUNT(*) as count FROM users');
    expect(sql).toContain('WHERE status = $1');
    expect(params).toEqual(['active']);
  });

  test('should support returning clause for INSERT', () => {
    const qb = new QueryBuilder('users');
    const { sql, params } = qb.insert({ name: 'John' }).returning('*').build();

    expect(sql).toContain('RETURNING *');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-platform-service && npx jest src/db/__tests__/query-builder.test.ts --no-coverage`
Expected: FAIL with "Cannot find module '../query-builder'"

- [ ] **Step 3: Write the QueryBuilder implementation**

```typescript
// orion-platform-service/src/db/query-builder.ts

// Prevent SQL injection in table/column names
const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function validateIdentifier(name: string, label: string): void {
  if (!VALID_IDENTIFIER.test(name)) {
    throw new Error(`Invalid ${label}: ${name}`);
  }
}

export interface QueryResult {
  sql: string;
  params: any[];
}

export class QueryBuilder {
  private table: string;
  private type: 'select' | 'insert' | 'update' | 'delete' | 'count' = 'select';
  private columns: string[] = ['*'];
  private whereClauses: { column: string; value: any }[] = [];
  private insertData: Record<string, any> = {};
  private updateData: Record<string, any> = {};
  private orderByClauses: { column: string; direction: 'ASC' | 'DESC' }[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private returningClause?: string;

  constructor(tableName: string) {
    validateIdentifier(tableName, 'table name');
    this.table = tableName;
  }

  /**
   * SELECT columns (default: *)
   */
  select(columns: string[] = ['*']): this {
    this.type = 'select';
    this.columns = columns;
    return this;
  }

  /**
   * COUNT(*) query
   */
  count(): this {
    this.type = 'count';
    return this;
  }

  /**
   * INSERT data
   */
  insert(data: Record<string, any>): this {
    this.type = 'insert';
    this.insertData = data;
    return this;
  }

  /**
   * UPDATE data
   */
  update(data: Record<string, any>): this {
    this.type = 'update';
    this.updateData = data;
    return this;
  }

  /**
   * DELETE
   */
  delete(): this {
    this.type = 'delete';
    return this;
  }

  /**
   * WHERE clause (multiple conditions are ANDed)
   */
  where(conditions: Record<string, any>): this {
    for (const [column, value] of Object.entries(conditions)) {
      validateIdentifier(column, 'column name');
      if (value !== undefined && value !== null) {
        this.whereClauses.push({ column, value });
      }
    }
    return this;
  }

  /**
   * ORDER BY clause
   */
  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    validateIdentifier(column, 'order column');
    this.orderByClauses.push({ column, direction });
    return this;
  }

  /**
   * LIMIT clause
   */
  limit(limit: number): this {
    this.limitValue = limit;
    return this;
  }

  /**
   * OFFSET clause
   */
  offset(offset: number): this {
    this.offsetValue = offset;
    return this;
  }

  /**
   * RETURNING clause (for INSERT/UPDATE/DELETE)
   */
  returning(columns: string): this {
    this.returningClause = columns;
    return this;
  }

  /**
   * Build the query
   */
  build(): QueryResult {
    const params: any[] = [];
    let sql = '';
    let paramIndex = 1;

    switch (this.type) {
      case 'select': {
        sql = `SELECT ${this.columns.join(', ')} FROM ${this.table}`;
        break;
      }
      case 'count': {
        sql = `SELECT COUNT(*) as count FROM ${this.table}`;
        break;
      }
      case 'insert': {
        const cols = Object.keys(this.insertData);
        const values = Object.values(this.insertData);
        const placeholders = values.map(() => `$${paramIndex + values.indexOf(values[paramIndex - 1] !== undefined ? paramIndex - 1 : 0])}`).join(', ');
        // Rebuild placeholders with correct indices
        const phs = cols.map((_, i) => `$${i + 1}`).join(', ');
        sql = `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${phs})`;
        params.push(...values);
        break;
      }
      case 'update': {
        const cols = Object.keys(this.updateData);
        const vals = Object.values(this.updateData);
        const setClause = cols.map((col, i) => `${col} = $${i + 1}`).join(', ');
        sql = `UPDATE ${this.table} SET ${setClause}`;
        params.push(...vals);
        break;
      }
      case 'delete': {
        sql = `DELETE FROM ${this.table}`;
        break;
      }
    }

    // WHERE clause
    if (this.whereClauses.length > 0) {
      const whereParts = this.whereClauses.map((clause) => {
        const idx = params.length + 1;
        params.push(clause.value);
        return `${clause.column} = $${idx}`;
      });
      sql += ` WHERE ${whereParts.join(' AND ')}`;
    }

    // ORDER BY
    if (this.orderByClauses.length > 0) {
      const orderParts = this.orderByClauses.map(o => `${o.column} ${o.direction}`);
      sql += ` ORDER BY ${orderParts.join(', ')}`;
    }

    // LIMIT / OFFSET
    if (this.limitValue !== undefined) {
      params.push(this.limitValue);
      sql += ` LIMIT $${params.length}`;
    }
    if (this.offsetValue !== undefined) {
      params.push(this.offsetValue);
      sql += ` OFFSET $${params.length}`;
    }

    // RETURNING
    if (this.returningClause) {
      sql += ` RETURNING ${this.returningClause}`;
    }

    return { sql, params };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest src/db/__tests__/query-builder.test.ts --no-coverage`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
cd orion-platform-service
git add src/db/query-builder.ts src/db/__tests__/query-builder.test.ts
git commit -m "feat(phase0): add QueryBuilder for safe parameterized query construction

Prevents SQL injection via identifier validation. Supports SELECT, INSERT,
UPDATE, DELETE, COUNT with WHERE, ORDER BY, LIMIT, OFFSET, RETURNING.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: AuditRepository — 追加模式审计存储

**Files:**
- Create: `orion-platform-service/src/repositories/AuditRepository.ts`
- Modify: `orion-platform-service/src/services/audit/AuditLogChain.ts` — 替换 Map 存储为数据库写入
- Test: `orion-platform-service/src/repositories/__tests__/AuditRepository.test.ts`

**依赖**: Task 1 (BaseRepository)

- [ ] **Step 1: Write the test file**

```typescript
// orion-platform-service/src/repositories/__tests__/AuditRepository.test.ts
import { AuditRepository } from '../AuditRepository';

describe('AuditRepository', () => {
  let repo: AuditRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new AuditRepository(mockDb);
  });

  test('should create audit log entry', async () => {
    const mockRow = {
      id: 'audit-1',
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      action: 'CREATE_PROJECT',
      resource_type: 'project',
      resource_id: 'proj-1',
      prev_hash: '0000000000000000000000000000000000000000000000000000000000000000',
      hash: 'abc123',
      request_body: { name: 'test' },
      response_code: 200,
      ip_address: '127.0.0.1',
      created_at: new Date(),
      sequence_number: 1,
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.create({
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'CREATE_PROJECT',
      resourceType: 'project',
      resourceId: 'proj-1',
      prevHash: '0'.repeat(64),
      requestBody: { name: 'test' },
      responseCode: 200,
      ipAddress: '127.0.0.1',
    });

    expect(result.id).toBe('audit-1');
    expect(result.sequenceNumber).toBe(1);
  });

  test('should get last entry for chain continuation', async () => {
    const mockRow = {
      id: 'audit-last',
      hash: 'lasthash',
      sequence_number: 42,
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.getLastEntry();
    expect(result?.hash).toBe('lasthash');
    expect(result?.sequenceNumber).toBe(42);
  });

  test('should return undefined when no entries exist', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    const result = await repo.getLastEntry();
    expect(result).toBeUndefined();
  });

  test('should get entries by range', async () => {
    const mockRows = [
      { id: '1', sequence_number: 10, action: 'A', hash: 'h1', created_at: new Date() },
      { id: '2', sequence_number: 11, action: 'B', hash: 'h2', created_at: new Date() },
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows });

    const results = await repo.getEntries({ startSequence: 10, endSequence: 15 });
    expect(results).toHaveLength(2);
  });

  test('should get next sequence number', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ max_seq: 42 }] });

    const result = await repo.getNextSequenceNumber();
    expect(result).toBe(43);
  });

  test('should verify chain integrity by scanning entries', async () => {
    const mockRows = [
      { id: '1', sequence_number: 1, prev_hash: '0'.repeat(64), hash: 'abc' },
      { id: '2', sequence_number: 2, prev_hash: 'abc', hash: 'def' },
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows });

    const result = await repo.verifyChain({ startSequence: 1, endSequence: 2 });
    expect(result.valid).toBe(true);
    expect(result.verifiedCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-platform-service && npx jest src/repositories/__tests__/AuditRepository.test.ts --no-coverage`
Expected: FAIL with "Cannot find module '../AuditRepository'"

- [ ] **Step 3: Write the AuditRepository implementation**

```typescript
// orion-platform-service/src/repositories/AuditRepository.ts
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

const logger = pino({ name: 'audit-repository' });

export interface AuditLogEntry {
  id: string;
  sequenceNumber: number;
  tenantId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestMethod?: string;
  requestPath?: string;
  requestBody?: Record<string, any>;
  responseCode?: number;
  responseBody?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  prevHash: string;
  hash: string;
  createdAt: Date;
}

export interface AuditCreateInput {
  tenantId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestMethod?: string;
  requestPath?: string;
  requestBody?: Record<string, any>;
  responseCode?: number;
  responseBody?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  verifiedCount: number;
  totalCount: number;
  breaks: Array<{
    sequenceNumber: number;
    entryId: string;
    breakType: string;
    description: string;
  }>;
}

export class AuditRepository {
  constructor(private db: any) {}

  /**
   * Create a new audit log entry (append-only)
   */
  async create(input: AuditCreateInput): Promise<AuditLogEntry> {
    // Get the last entry's hash for chain continuity
    const lastEntry = await this.getLastEntry();
    const prevHash = lastEntry?.hash ?? '0'.repeat(64);
    const nextSequence = lastEntry ? lastEntry.sequenceNumber + 1 : 1;

    const id = uuidv4();
    const content = JSON.stringify({
      id,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      sequenceNumber: nextSequence,
    });
    const hash = createHash('sha256').update(prevHash + content).digest('hex');

    const result = await this.db.query(
      `INSERT INTO audit_logs (
        id, tenant_id, user_id, action, resource_type, resource_id,
        request_method, request_path, request_body, response_code, response_body,
        ip_address, user_agent, prev_hash, hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        id,
        input.tenantId,
        input.userId || null,
        input.action,
        input.resourceType,
        input.resourceId || null,
        input.requestMethod || null,
        input.requestPath || null,
        input.requestBody ? JSON.stringify(input.requestBody) : null,
        input.responseCode || null,
        input.responseBody ? JSON.stringify(input.responseBody) : null,
        input.ipAddress || null,
        input.userAgent || null,
        prevHash,
        hash,
      ],
    );

    logger.debug({ id, sequenceNumber: nextSequence, action: input.action }, 'Audit log entry created');
    return this.mapRow(result.rows[0]);
  }

  /**
   * Get the most recent audit log entry (for chain continuation)
   */
  async getLastEntry(): Promise<AuditLogEntry | undefined> {
    const result = await this.db.query(
      `SELECT * FROM audit_logs ORDER BY sequence_number DESC LIMIT 1`,
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRow(result.rows[0]);
  }

  /**
   * Get entries within a sequence range
   */
  async getEntries(options?: {
    startSequence?: number;
    endSequence?: number;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    const start = options?.startSequence || 1;
    const end = options?.endSequence || Number.MAX_SAFE_INTEGER;
    const limit = options?.limit || 1000;

    const result = await this.db.query(
      `SELECT * FROM audit_logs WHERE sequence_number >= $1 AND sequence_number <= $2 ORDER BY sequence_number ASC LIMIT $3`,
      [start, end, limit],
    );
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Get next sequence number
   */
  async getNextSequenceNumber(): Promise<number> {
    const result = await this.db.query(
      `SELECT COALESCE(MAX(sequence_number), 0) as max_seq FROM audit_logs`,
    );
    return (result.rows[0]?.max_seq || 0) + 1;
  }

  /**
   * Verify chain integrity
   */
  async verifyChain(options?: {
    startSequence?: number;
    endSequence?: number;
  }): Promise<ChainVerificationResult> {
    const entries = await this.getEntries(options);
    const breaks: ChainVerificationResult['breaks'] = [];
    let expectedPrevHash = '0'.repeat(64);
    let verifiedCount = 0;

    for (const entry of entries) {
      if (entry.prevHash !== expectedPrevHash) {
        breaks.push({
          sequenceNumber: entry.sequenceNumber,
          entryId: entry.id,
          breakType: 'HASH_MISMATCH',
          description: `Chain hash mismatch at sequence ${entry.sequenceNumber}`,
        });
      }

      // Recompute hash
      const content = JSON.stringify({
        id: entry.id,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        sequenceNumber: entry.sequenceNumber,
      });
      const computedHash = createHash('sha256').update(entry.prevHash + content).digest('hex');
      if (computedHash !== entry.hash) {
        breaks.push({
          sequenceNumber: entry.sequenceNumber,
          entryId: entry.id,
          breakType: 'MODIFIED_CONTENT',
          description: `Content hash mismatch at sequence ${entry.sequenceNumber}`,
        });
      }

      expectedPrevHash = entry.hash;
      verifiedCount++;
    }

    return {
      valid: breaks.length === 0,
      verifiedCount,
      totalCount: entries.length,
      breaks,
    };
  }

  private mapRow(row: any): AuditLogEntry {
    return {
      id: row.id,
      sequenceNumber: row.sequence_number ?? 0,
      tenantId: row.tenant_id,
      userId: row.user_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      requestMethod: row.request_method,
      requestPath: row.request_path,
      requestBody: row.request_body,
      responseCode: row.response_code,
      responseBody: row.response_body,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      prevHash: row.prev_hash,
      hash: row.hash,
      createdAt: row.created_at,
    };
  }
}
```

- [ ] **Step 4: Update the migration to add sequence_number column**

The existing `013_create_audit_logs.sql` doesn't have `sequence_number`. Create an addendum migration.

```sql
-- orion-platform-service/src/db/migrations/034_add_audit_log_sequence.sql
-- Add sequence_number to audit_logs for chain ordering

-- Add sequence_number column if not exists
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS sequence_number BIGINT;

-- Backfill sequence numbers based on created_at ordering
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as seq
  FROM audit_logs
  WHERE sequence_number IS NULL
)
UPDATE audit_logs
SET sequence_number = numbered.seq
FROM numbered
WHERE audit_logs.id = numbered.id;

-- Make sequence_number NOT NULL after backfill
ALTER TABLE audit_logs ALTER COLUMN sequence_number SET NOT NULL;

-- Add unique constraint
ALTER TABLE audit_logs ADD CONSTRAINT uq_audit_logs_sequence UNIQUE (sequence_number);

CREATE INDEX idx_audit_logs_sequence ON audit_logs(sequence_number DESC);

-- Rollback:
-- DROP INDEX IF EXISTS idx_audit_logs_sequence;
-- ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS uq_audit_logs_sequence;
-- ALTER TABLE audit_logs DROP COLUMN IF EXISTS sequence_number;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest src/repositories/__tests__/AuditRepository.test.ts --no-coverage`
Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```bash
cd orion-platform-service
git add src/repositories/AuditRepository.ts src/repositories/__tests__/AuditRepository.test.ts src/db/migrations/034_add_audit_log_sequence.sql
git commit -m "feat(phase0): add AuditRepository with append-only chain pattern

Implements SHA256 hash chaining for tamper-evident audit logs.
Adds sequence_number column to audit_logs table.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: 补充迁移文件 — OnCall 调度

**Files:**
- Create: `orion-platform-service/src/db/migrations/035_create_oncall_tables.sql`
- Test: `orion-platform-service/src/db/__tests__/migrations.test.ts` (shared migration test)

- [ ] **Step 1: Write the migration SQL**

```sql
-- Migration 035: OnCall Scheduling
-- Creates tables for on-call schedules, assignments, overrides, and escalation rules

-- OnCall Schedule 排班表
CREATE TABLE IF NOT EXISTS oncall_schedules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(200) NOT NULL,
  timezone            VARCHAR(100) NOT NULL,
  rotation_type       VARCHAR(20) NOT NULL,          -- daily | weekly | monthly
  rotation_start_hour INT NOT NULL DEFAULT 9,
  team_members        UUID[] NOT NULL DEFAULT '{}',
  start_date          TIMESTAMPTZ NOT NULL DEFAULT now(),
  escalations         JSONB NOT NULL DEFAULT '[]',   -- EscalationRule[]
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_oncall_schedules_name ON oncall_schedules(name);

-- OnCall Assignment 值班分配表
CREATE TABLE IF NOT EXISTS oncall_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id     UUID NOT NULL REFERENCES oncall_schedules(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_oncall_assignments_schedule ON oncall_assignments(schedule_id);
CREATE INDEX idx_oncall_assignments_time ON oncall_assignments(start_time, end_time);
CREATE INDEX idx_oncall_assignments_user ON oncall_assignments(user_id);

-- OnCall Override 覆盖表
CREATE TABLE IF NOT EXISTS oncall_overrides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id       UUID NOT NULL REFERENCES oncall_schedules(id) ON DELETE CASCADE,
  original_user_id  UUID NOT NULL,
  override_user_id  UUID NOT NULL,
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ NOT NULL,
  reason            TEXT
);
CREATE INDEX idx_oncall_overrides_schedule ON oncall_overrides(schedule_id);
CREATE INDEX idx_oncall_overrides_time ON oncall_overrides(start_time, end_time);

-- Rollback:
-- DROP TABLE IF EXISTS oncall_overrides, oncall_assignments, oncall_schedules;
```

- [ ] **Step 2: Commit**

```bash
cd orion-platform-service
git add src/db/migrations/035_create_oncall_tables.sql
git commit -m "feat(phase0): add migration for oncall scheduling tables

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: 补充迁移文件 — Cron 调度

**Files:**
- Create: `orion-platform-service/src/db/migrations/036_create_cron_tables.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Migration 036: Cron Scheduler
-- Creates tables for cron jobs and execution history

-- Cron Jobs 定时任务表
CREATE TABLE IF NOT EXISTS cron_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL UNIQUE,
  schedule        VARCHAR(100) NOT NULL,               -- Cron expression
  handler         VARCHAR(200) NOT NULL,               -- Handler function/endpoint
  payload         JSONB NOT NULL DEFAULT '{}',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  last_run_status VARCHAR(20),                         -- success | failed | timeout
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cron_jobs_enabled ON cron_jobs(enabled) WHERE enabled = true;

-- Cron Executions 执行记录表
CREATE TABLE IF NOT EXISTS cron_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES cron_jobs(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'running',  -- running | success | failed | timeout
  result          JSONB,
  error_message   TEXT
);
CREATE INDEX idx_cron_executions_job ON cron_executions(job_id);
CREATE INDEX idx_cron_executions_status ON cron_executions(status);
CREATE INDEX idx_cron_executions_started ON cron_executions(started_at DESC);

-- Rollback:
-- DROP TABLE IF EXISTS cron_executions, cron_jobs;
```

- [ ] **Step 2: Commit**

```bash
cd orion-platform-service
git add src/db/migrations/036_create_cron_tables.sql
git commit -m "feat(phase0): add migration for cron scheduler tables

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: 补充迁移文件 — 告警抑制 + 工单工作流

**Files:**
- Create: `orion-platform-service/src/db/migrations/037_create_alert_suppression.sql`
- Create: `orion-platform-service/src/db/migrations/038_create_ticket_workflow.sql`

- [ ] **Step 1: Write alert_suppression migration**

```sql
-- Migration 037: Alert Suppression
-- Creates tables for alert suppression rules, maintenance windows, and known issues

-- Alert Suppression Rules 告警抑制规则表
CREATE TABLE IF NOT EXISTS alert_suppression_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  condition       JSONB NOT NULL,                    -- Matching condition for alerts to suppress
  schedule        JSONB,                             -- Active time window (cron or range)
  reason          TEXT,
  created_by      UUID,
  expires_at      TIMESTAMPTZ,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alert_suppression_tenant ON alert_suppression_rules(tenant_id);
CREATE INDEX idx_alert_suppression_enabled ON alert_suppression_rules(enabled);

-- Maintenance Windows 维护窗口表
CREATE TABLE IF NOT EXISTS maintenance_windows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL,
  affected_services TEXT[] NOT NULL DEFAULT '{}',
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_maintenance_windows_tenant ON maintenance_windows(tenant_id);
CREATE INDEX idx_maintenance_windows_time ON maintenance_windows(start_time, end_time);

-- Known Issues 已知问题表
CREATE TABLE IF NOT EXISTS known_issues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  description     TEXT,
  fingerprint     VARCHAR(255) NOT NULL,             -- Alert fingerprint for dedup
  ticket_id       UUID REFERENCES tickets(id),
  resolved        BOOLEAN NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_known_issues_tenant ON known_issues(tenant_id);
CREATE INDEX idx_known_issues_fingerprint ON known_issues(fingerprint);

-- Rollback:
-- DROP TABLE IF EXISTS known_issues, maintenance_windows, alert_suppression_rules;
```

- [ ] **Step 2: Write ticket_workflow migration**

```sql
-- Migration 038: Ticket Workflow
-- Creates tables for ticket workflow history, SLA tracking, and dispatch queue

-- Ticket Workflow History 工单工作流历史
CREATE TABLE IF NOT EXISTS ticket_workflow_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  from_status     VARCHAR(20) NOT NULL,
  to_status       VARCHAR(20) NOT NULL,
  triggered_by    UUID,                              -- User who triggered the change
  triggered_type  VARCHAR(50) NOT NULL DEFAULT 'manual', -- manual | auto | escalation
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_workflow_ticket ON ticket_workflow_history(ticket_id);
CREATE INDEX idx_ticket_workflow_created ON ticket_workflow_history(created_at DESC);

-- Ticket SLA Tracking SLA 追踪
CREATE TABLE IF NOT EXISTS ticket_sla (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE UNIQUE,
  priority        VARCHAR(20) NOT NULL,
  response_time_minutes INT NOT NULL,                -- SLA response target
  resolution_time_minutes INT NOT NULL,              -- SLA resolution target
  first_response_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  response_breached BOOLEAN NOT NULL DEFAULT false,
  resolution_breached BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_sla_breached ON ticket_sla(response_breached, resolution_breached);

-- Dispatch Queue 工单分派队列
CREATE TABLE IF NOT EXISTS dispatch_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE UNIQUE,
  assigned_to     UUID,
  queue_status    VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | assigned | in_progress | completed
  priority_score  DECIMAL(5,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dispatch_queue_status ON dispatch_queue(queue_status);

-- Engineer Load Profile 工程师负载画像
CREATE TABLE IF NOT EXISTS engineer_load (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE,
  current_load    INT NOT NULL DEFAULT 0,            -- Active ticket count
  max_capacity    INT NOT NULL DEFAULT 10,
  specialization  TEXT[] NOT NULL DEFAULT '{}',       -- Areas of expertise
  availability    VARCHAR(20) NOT NULL DEFAULT 'available', -- available | busy | away | offline
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_engineer_load_availability ON engineer_load(availability);

-- Rollback:
-- DROP TABLE IF EXISTS engineer_load, dispatch_queue, ticket_sla, ticket_workflow_history;
```

- [ ] **Step 3: Commit**

```bash
cd orion-platform-service
git add src/db/migrations/037_create_alert_suppression.sql src/db/migrations/038_create_ticket_workflow.sql
git commit -m "feat(phase0): add migrations for alert suppression and ticket workflow

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: 补充迁移文件 — 构建 + 制品 + 诊断

**Files:**
- Create: `orion-platform-service/src/db/migrations/039_create_build_tables.sql`
- Create: `orion-platform-service/src/db/migrations/040_create_diagnostic_tables.sql`

- [ ] **Step 1: Write build tables migration**

```sql
-- Migration 039: Build System
-- Creates tables for build cache, build logs, and build artifacts tracking

-- Build Cache 构建缓存表
CREATE TABLE IF NOT EXISTS build_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key       VARCHAR(500) NOT NULL UNIQUE,       -- Computed from source hash + config
  project_id      UUID,
  branch          VARCHAR(200),
  source_hash     VARCHAR(64) NOT NULL,               -- SHA256 of source files
  build_config    JSONB NOT NULL,
  artifact_path   VARCHAR(500),
  size_bytes      BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at    TIMESTAMPTZ,
  hit_count       INT NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ
);
CREATE INDEX idx_build_cache_project ON build_cache(project_id);
CREATE INDEX idx_build_cache_source ON build_cache(source_hash);

-- Build Logs 构建日志表 (large text, consider partitioning in production)
CREATE TABLE IF NOT EXISTS build_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id        VARCHAR(200) NOT NULL,              -- External build system ID
  project_id      UUID,
  stage           VARCHAR(50) NOT NULL,               -- compile | test | package | etc.
  log_content     TEXT,                               -- Full log output
  log_url         VARCHAR(500),                       -- External storage URL
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_build_logs_build ON build_logs(build_id);
CREATE INDEX idx_build_logs_project ON build_logs(project_id);

-- Build Artifact 构建制品表 (补充 artifact_registry)
CREATE TABLE IF NOT EXISTS build_artifacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id        VARCHAR(200) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  artifact_type   VARCHAR(50) NOT NULL,               -- docker_image | binary | package | etc.
  registry_url    VARCHAR(500),
  digest          VARCHAR(128),                       -- Content digest (SHA256)
  size_bytes      BIGINT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_build_artifacts_build ON build_artifacts(build_id);

-- Test Prediction History 测试预测历史
CREATE TABLE IF NOT EXISTS test_predictions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id        VARCHAR(200) NOT NULL,
  test_name       VARCHAR(500) NOT NULL,
  predicted_fail  BOOLEAN NOT NULL,
  actual_result   VARCHAR(20),                        -- passed | failed | skipped
  confidence      DECIMAL(3,2),
  features        JSONB NOT NULL DEFAULT '{}',        -- Features used for prediction
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_test_predictions_build ON test_predictions(build_id);

-- Test Dependencies 测试依赖关系
CREATE TABLE IF NOT EXISTS test_dependencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name       VARCHAR(500) NOT NULL,
  depends_on      VARCHAR(500) NOT NULL,              -- Dependent test name
  dependency_type VARCHAR(50) NOT NULL DEFAULT 'execution', -- execution | data | setup
  source_file     VARCHAR(500),                       -- Source code file that affects this test
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_test_dependencies_pair ON test_dependencies(test_name, depends_on);

-- Rollback:
-- DROP TABLE IF EXISTS test_dependencies, test_predictions, build_artifacts, build_logs, build_cache;
```

- [ ] **Step 2: Write diagnostic tables migration**

```sql
-- Migration 040: Diagnostic System
-- Creates tables for diagnostic sessions, symptoms, and agent reports

-- Diagnostic Sessions 诊断会话表
CREATE TABLE IF NOT EXISTS diagnostic_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'running',  -- running | completed | failed | cancelled
  triggered_by    UUID,
  target_type     VARCHAR(50) NOT NULL,                -- pipeline | deployment | alert | etc.
  target_id       UUID,
  symptoms        JSONB NOT NULL DEFAULT '[]',         -- List of detected symptoms
  findings        JSONB,                               -- Final findings
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_diagnostic_sessions_tenant ON diagnostic_sessions(tenant_id);
CREATE INDEX idx_diagnostic_sessions_status ON diagnostic_sessions(status);

-- Diagnostic Agents 诊断 Agent 报告表
CREATE TABLE IF NOT EXISTS diagnostic_agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
  agent_type      VARCHAR(100) NOT NULL,
  analysis_result JSONB NOT NULL,
  confidence      DECIMAL(3,2),
  recommendations TEXT[] NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_diagnostic_agents_session ON diagnostic_agents(session_id);

-- Metric Collector Data 指标采集数据 (monthly partitioning recommended)
CREATE TABLE IF NOT EXISTS metric_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_name     VARCHAR(200) NOT NULL,
  metric_value    DECIMAL(20,6) NOT NULL,
  labels          JSONB NOT NULL DEFAULT '{}',         -- Prometheus-style labels
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_metric_data_tenant ON metric_data(tenant_id);
CREATE INDEX idx_metric_data_name ON metric_data(metric_name);
CREATE INDEX idx_metric_data_timestamp ON metric_data(timestamp DESC);

-- Rollback:
-- DROP TABLE IF EXISTS metric_data, diagnostic_agents, diagnostic_sessions;
```

- [ ] **Step 3: Commit**

```bash
cd orion-platform-service
git add src/db/migrations/039_create_build_tables.sql src/db/migrations/040_create_diagnostic_tables.sql
git commit -m "feat(phase0): add migrations for build system and diagnostic tables

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: 补充迁移文件 — Namespace Pools + Skills + Plugin Executions

**Files:**
- Create: `orion-platform-service/src/db/migrations/041_create_namespace_pools.sql`
- Create: `orion-platform-service/src/db/migrations/042_create_skill_tables.sql` (check if 030 already covers)
- Create: `orion-platform-service/src/db/migrations/042_create_plugin_executions.sql` (use 043 if 042 taken)

- [ ] **Step 1: Check existing 030 skill tables**

030_create_skill_tables.sql already exists. Verify it covers the SkillService needs.

```sql
-- Check 030 content pattern (skills table):
-- CREATE TABLE IF NOT EXISTS skills (
--   id, name, description, category, commands, enabled, created_at, updated_at
-- )
```

If 030 covers skills, skip creating a new one. Otherwise create `042_create_skill_tables.sql`.

- [ ] **Step 2: Write namespace_pools migration**

```sql
-- Migration 042: Namespace Resource Pools
-- Creates table for namespace-level resource pooling

CREATE TABLE IF NOT EXISTS namespace_pools (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  namespace       VARCHAR(100) NOT NULL,
  resource_type   VARCHAR(50) NOT NULL,               -- compute | storage | network
  capacity        JSONB NOT NULL,                     -- { cpu: 100, memory: 512 }
  used            JSONB NOT NULL DEFAULT '{"cpu": 0, "memory": 0}',
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_namespace_pools_tenant ON namespace_pools(tenant_id);
CREATE INDEX idx_namespace_pools_namespace ON namespace_pools(namespace);

-- Rollback:
-- DROP TABLE IF EXISTS namespace_pools;
```

- [ ] **Step 3: Write plugin_executions migration**

```sql
-- Migration 043: Plugin Execution Tracking
-- Creates table for plugin execution history

CREATE TABLE IF NOT EXISTS plugin_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id       VARCHAR(200) NOT NULL,
  action          VARCHAR(100) NOT NULL,               -- execute | install | uninstall | configure
  input           JSONB NOT NULL DEFAULT '{}',
  output          JSONB,
  status          VARCHAR(20) NOT NULL DEFAULT 'running', -- running | success | failed | cancelled
  started_by      UUID,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  duration_ms     BIGINT
);
CREATE INDEX idx_plugin_executions_plugin ON plugin_executions(plugin_id);
CREATE INDEX idx_plugin_executions_status ON plugin_executions(status);
CREATE INDEX idx_plugin_executions_started ON plugin_executions(started_at DESC);

-- Rollback:
-- DROP TABLE IF EXISTS plugin_executions;
```

- [ ] **Step 4: Commit**

```bash
cd orion-platform-service
git add src/db/migrations/042_create_namespace_pools.sql src/db/migrations/043_create_plugin_executions.sql
git commit -m "feat(phase0): add migrations for namespace pools and plugin executions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: 补充迁移文件 — IaC Plans + Change Intelligence (Gap Fill)

**Files:**
- Create: `orion-platform-service/src/db/migrations/044_create_iac_plans.sql`
- Create: `orion-platform-service/src/db/migrations/045_create_change_intelligence.sql`

- [ ] **Step 1: Write IaC plans migration**

032_create_iac_tables.sql already exists. Check if it has `iac_plans` table. If not:

```sql
-- Migration 044: IaC Drift Detection (supplement to 032)
-- Creates table for IaC plan history and drift detection results

CREATE TABLE IF NOT EXISTS iac_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  terraform_version VARCHAR(50),
  plan_content    JSONB NOT NULL,                    -- Terraform plan output
  resources_to_add INT NOT NULL DEFAULT 0,
  resources_to_change INT NOT NULL DEFAULT 0,
  resources_to_destroy INT NOT NULL DEFAULT 0,
  applied         BOOLEAN NOT NULL DEFAULT false,
  applied_at      TIMESTAMPTZ,
  applied_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_iac_plans_applied ON iac_plans(applied);

-- IaC Drift Detection Results
CREATE TABLE IF NOT EXISTS iac_drift_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type   VARCHAR(100) NOT NULL,
  resource_id     VARCHAR(500) NOT NULL,
  expected_state  JSONB NOT NULL,                    -- Expected from Terraform state
  actual_state    JSONB NOT NULL,                    -- Actual from cloud provider
  drift_detected  BOOLEAN NOT NULL DEFAULT false,
  changed_fields  TEXT[] NOT NULL DEFAULT '{}',
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_iac_drift_resource ON iac_drift_results(resource_type, resource_id);
CREATE INDEX idx_iac_drift_detected ON iac_drift_results(drift_detected);

-- Rollback:
-- DROP TABLE IF EXISTS iac_drift_results, iac_plans;
```

- [ ] **Step 2: Write change intelligence migration**

028_create_change_intelligence_tables.sql already exists. Verify it covers the ChangeIntelligenceService needs. If it does, skip.

- [ ] **Step 3: Commit**

```bash
cd orion-platform-service
git add src/db/migrations/044_create_iac_plans.sql
git commit -m "feat(phase0): add migration for IaC plan history and drift detection

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: 共享迁移测试 + 验证所有迁移

**Files:**
- Create: `orion-platform-service/src/db/__tests__/migrations.test.ts`

- [ ] **Step 1: Write the shared migration test**

```typescript
// orion-platform-service/src/db/__tests__/migrations.test.ts
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Migration files', () => {
  const migrationsDir = join(__dirname, '..', 'migrations');

  test('all migration files should have rollback statements', () => {
    // List expected migration files based on numbered sequence
    const migrationFiles: string[] = [];
    for (let i = 1; i <= 45; i++) {
      const padded = i.toString().padStart(3, '0');
      const mainFile = join(migrationsDir, `${padded}_*.sql`);
      try {
        // Check if any file with this prefix exists
        const fs = require('fs');
        const files = fs.readdirSync(migrationsDir);
        const matching = files.filter(f => f.startsWith(`${padded}_`) && f.endsWith('.sql') && !f.includes('rollback'));
        if (matching.length > 0) {
          migrationFiles.push(join(migrationsDir, matching[0]));
        }
      } catch {
        // File doesn't exist yet, skip
      }
    }

    for (const filePath of migrationFiles) {
      const content = readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/-- Rollback:/i);
      expect(content).toMatch(/DROP TABLE/i);
    }
  });

  test('all migration files should use gen_random_uuid() for IDs', () => {
    const fs = require('fs');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql') && !f.includes('rollback'));

    for (const file of files) {
      const content = readFileSync(join(migrationsDir, file), 'utf-8');

      // Extract CREATE TABLE blocks
      const tableBlocks = content.match(/CREATE TABLE IF NOT EXISTS \w+ \([^;]+\);/gs);
      if (!tableBlocks) continue;

      for (const block of tableBlocks) {
        if (block.includes('UUID PRIMARY KEY')) {
          expect(block).toMatch(/DEFAULT gen_random_uuid\(\)/);
        }
      }
    }
  });

  test('all migration files should have proper indexes', () => {
    const fs = require('fs');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql') && !f.includes('rollback'));

    for (const file of files) {
      const content = readFileSync(join(migrationsDir, file), 'utf-8');

      // Extract table names
      const tableNames = content.match(/CREATE TABLE IF NOT EXISTS (\w+)/g);
      if (!tableNames) continue;

      for (const tableNameMatch of tableNames) {
        const tableName = tableNameMatch.replace('CREATE TABLE IF NOT EXISTS ', '');
        // Check that at least one index references this table
        expect(content).toMatch(new RegExp(`CREATE INDEX.*ON ${tableName}\\(`, 'i'));
      }
    }
  });
});
```

- [ ] **Step 2: Run all migration tests**

Run: `cd orion-platform-service && npx jest src/db/__tests__/migrations.test.ts --no-coverage`
Expected: All 3 tests PASS

- [ ] **Step 3: Run all Phase 0 tests together**

Run: `cd orion-platform-service && npx jest src/db/__tests__ src/repositories/__tests__/AuditRepository.test.ts --no-coverage`
Expected: All tests PASS (7 base-repository + 8 query-builder + 6 audit-repository + 3 migrations = 24 tests)

- [ ] **Step 4: Run type check**

Run: `cd orion-platform-service && npm run type-check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd orion-platform-service
git add src/db/__tests__/migrations.test.ts
git commit -m "test(phase0): add shared migration validation tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 0 完成标准

1. `BaseRepository<T>` 泛型类可正常实例化（通过子类），5 个 CRUD 方法可用
2. `QueryBuilder` 支持 SELECT/INSERT/UPDATE/DELETE/COUNT 参数化构建，标识符注入被拒绝
3. `AuditRepository` 支持追加写入，SHA256 链验证通过
4. 10 个新迁移文件（035-045）均已创建，含 rollback 语句，命名规范一致
5. 所有 24 个测试通过，`npm run type-check` 无错误

## 文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/db/base-repository.ts` | Create | 泛型 BaseRepository<T> |
| `src/db/query-builder.ts` | Create | 参数化查询构建器 |
| `src/db/__tests__/base-repository.test.ts` | Create | 7 tests |
| `src/db/__tests__/query-builder.test.ts` | Create | 8 tests |
| `src/db/__tests__/migrations.test.ts` | Create | 3 migration validation tests |
| `src/repositories/AuditRepository.ts` | Create | 追加模式审计仓储 |
| `src/repositories/__tests__/AuditRepository.test.ts` | Create | 6 tests |
| `src/db/migrations/034_add_audit_log_sequence.sql` | Create | 添加 sequence_number |
| `src/db/migrations/035_create_oncall_tables.sql` | Create | OnCall 调度表 |
| `src/db/migrations/036_create_cron_tables.sql` | Create | Cron 调度表 |
| `src/db/migrations/037_create_alert_suppression.sql` | Create | 告警抑制表 |
| `src/db/migrations/038_create_ticket_workflow.sql` | Create | 工单工作流表 |
| `src/db/migrations/039_create_build_tables.sql` | Create | 构建系统表 |
| `src/db/migrations/040_create_diagnostic_tables.sql` | Create | 诊断系统表 |
| `src/db/migrations/042_create_namespace_pools.sql` | Create | 命名空间池表 |
| `src/db/migrations/043_create_plugin_executions.sql` | Create | 插件执行表 |
| `src/db/migrations/044_create_iac_plans.sql` | Create | IaC 计划+漂移表 |

**总计**: 8 个新建代码文件 + 9 个新迁移文件 + 24 个测试

---

## 执行顺序

```
Task 1: BaseRepository (无依赖)
Task 2: QueryBuilder (无依赖)
Task 3: AuditRepository (依赖 Task 1 的模式)
Task 4-9: Migrations (互相无依赖，可并行)
Task 10: 迁移验证测试 (依赖 Task 4-9 完成)
```
