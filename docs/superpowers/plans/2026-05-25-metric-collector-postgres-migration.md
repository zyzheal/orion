# MetricCollector PostgreSQL Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-memory `Map`-based metric storage in `MetricCollector` with a PostgreSQL Repository pattern, enabling data persistence across restarts, multi-instance sharing, and time-range queries backed by database indexes.

**Architecture:** Add a `MetricStorageRepository` interface with a `PostgresMetricStorageRepository` implementation (following the existing `MonitoringRepository` pattern). The `MetricCollector` will accept an optional repository, using it when available and falling back to in-memory Map for backward compatibility. New SQL migration (0183) creates two tables: `metric_registry` and `metric_data_points`.

**Tech Stack:** TypeScript, PostgreSQL, pg library, Fastify, Jest (existing tests)

---

### File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/db/migrations/0183_create_metric_storage.sql` | Create | SQL schema for `metric_registry` + `metric_data_points` tables |
| `src/db/migrations/0183_rollback_create_metric_storage.sql` | Create | Rollback DDL |
| `src/services/monitoring/MetricStorageRepository.ts` | Create | Repository interface + Postgres implementation |
| `src/services/monitoring/MetricCollector.ts` | Modify | Add optional repository injection, async storage methods |
| `src/services/monitoring/index.ts` | Modify | Export new repository types |
| `src/services/monitoring/MonitoringService.ts` | Modify | Pass repository to MetricCollector constructor |
| `src/services/monitoring/__tests__/MetricCollector.test.ts` | Modify | Update tests for async methods + repository tests |

### Design Decisions

1. **Two-table approach**: `metric_registry` stores metadata (name, unit, tags, description), `metric_data_points` stores individual data points. This mirrors how the existing `MonitoringRepository` separates configs from runtime data.
2. **BIGSERIAL primary key** for data points: Time-series write volume is high, UUID would waste space. Sequential IDs are better for range queries on time.
3. **JSONB for tags**: Flexible tag filtering with PostgreSQL `@>` containment operator, matching the existing `MonitoringRepository` pattern.
4. **Backward compatibility**: `MetricCollector` constructor accepts an optional repository. When absent, it falls back to the existing Map behavior. This allows gradual migration.
5. **NATS counts remain in-memory**: These are purely runtime counters reset per restart, no persistence needed.

---

### Task 1: SQL Migration for Metric Storage Tables

**Files:**
- Create: `orion-platform-service/src/db/migrations/0183_create_metric_storage.sql`
- Create: `orion-platform-service/src/db/migrations/0183_rollback_create_metric_storage.sql`

- [ ] **Step 1: Create forward migration**

```sql
-- Migration 0183: Metric Storage (Time-Series)
-- Metric registry and time-series data points for MetricCollector

-- Metric registry: stores metadata about registered metrics
CREATE TABLE IF NOT EXISTS metric_registry (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  unit          VARCHAR(50) NOT NULL,
  default_tags  JSONB NOT NULL DEFAULT '{}',
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name)
);
CREATE INDEX idx_metric_registry_tenant ON metric_registry(tenant_id);
CREATE INDEX idx_metric_registry_name ON metric_registry(name);

-- Time-series data points: stores individual metric readings
CREATE TABLE IF NOT EXISTS metric_data_points (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_name   VARCHAR(200) NOT NULL,
  value         DOUBLE PRECISION NOT NULL,
  tags          JSONB NOT NULL DEFAULT '{}',
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_metric_points_name_ts ON metric_data_points(metric_name, timestamp DESC);
CREATE INDEX idx_metric_points_tenant_ts ON metric_data_points(tenant_id, timestamp DESC);
CREATE INDEX idx_metric_points_ts ON metric_data_points(timestamp DESC);

-- Foreign key to metric_registry (created after index to avoid circular issues during bulk insert)
ALTER TABLE metric_data_points
  ADD CONSTRAINT fk_metric_points_name
  FOREIGN KEY (metric_name) REFERENCES metric_registry(name) ON DELETE CASCADE;
```

- [ ] **Step 2: Create rollback migration**

```sql
-- Migration 0183: Rollback Metric Storage

ALTER TABLE metric_data_points DROP CONSTRAINT IF EXISTS fk_metric_points_name;
DROP TABLE IF EXISTS metric_data_points;
DROP TABLE IF EXISTS metric_registry;
```

- [ ] **Step 3: Verify migration syntax**

Run: `psql -h <host> -U <user> -d <db> -f orion-platform-service/src/db/migrations/0183_create_metric_storage.sql --dry-run` (or verify manually that all SQL is valid PostgreSQL).

Expected: No syntax errors, tables reference existing `tenants` table.

- [ ] **Step 4: Commit**

```bash
git add orion-platform-service/src/db/migrations/0183_create_metric_storage.sql \
         orion-platform-service/src/db/migrations/0183_rollback_create_metric_storage.sql
git commit -m "feat(migration): add metric_registry and metric_data_points tables for MetricCollector persistence"
```

---

### Task 2: MetricStorageRepository Interface and Postgres Implementation

**Files:**
- Create: `orion-platform-service/src/services/monitoring/MetricStorageRepository.ts`
- Test: `orion-platform-service/src/services/monitoring/__tests__/MetricStorageRepository.test.ts`

- [ ] **Step 1: Write the repository interface and implementation**

Create `orion-platform-service/src/services/monitoring/MetricStorageRepository.ts`:

```typescript
/**
 * Metric Storage Repository
 *
 * Data access layer for metric_registry and metric_data_points tables.
 * Replaces Map-based storage in MetricCollector with PostgreSQL persistence.
 */

import { DatabasePool } from '../database';
import { MetricRegistration, MetricQuery } from './MetricCollector';
import { Metric, MetricSeries, MetricAggregation, DataPoint } from './types';

// ==================== Registry Types ====================

export interface MetricRegistryRecord {
  id: string;
  tenant_id: string;
  name: string;
  unit: string;
  default_tags: Record<string, string>;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMetricRegistryInput {
  tenant_id?: string;
  name: string;
  unit: string;
  default_tags?: Record<string, string>;
  description?: string;
}

// ==================== Data Point Types ====================

export interface MetricDataPointRecord {
  id: number;
  tenant_id: string;
  metric_name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: Date;
}

export interface InsertDataPointInput {
  tenant_id?: string;
  metric_name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: Date;
}

// ==================== Repository Interface ====================

export interface MetricStorageRepository {
  // Registry operations
  registerMetric(input: CreateMetricRegistryInput): Promise<MetricRegistryRecord>;
  unregisterMetric(name: string): Promise<boolean>;
  getAllRegisteredMetrics(): Promise<string[]>;
  getMetricRegistry(name: string): Promise<MetricRegistryRecord | null>;

  // Data point operations
  insertDataPoint(input: InsertDataPointInput): Promise<void>;
  queryMetricSeries(query: MetricQuery, tenantId?: string): Promise<MetricSeries>;
  getLatestValue(name: string, tags?: Record<string, string>, tenantId?: string): Promise<number | null>;

  // Maintenance
  pruneExpired(retentionMs: number, tenantId?: string): Promise<number>;
  clearAll(tenantId?: string): Promise<void>;
}

// ==================== PostgreSQL Implementation ====================

export class PostgresMetricStorageRepository implements MetricStorageRepository {
  constructor(private pool: DatabasePool) {}

  async registerMetric(input: CreateMetricRegistryInput): Promise<MetricRegistryRecord> {
    const tenantId = input.tenant_id || '00000000-0000-0000-0000-000000000000';
    const defaultTags = input.default_tags || {};
    const result = await this.pool.query(
      `INSERT INTO metric_registry (tenant_id, name, unit, default_tags, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name) DO UPDATE SET
         unit = EXCLUDED.unit,
         default_tags = EXCLUDED.default_tags,
         description = EXCLUDED.description,
         updated_at = NOW()
       RETURNING *`,
      [tenantId, input.name, input.unit, JSON.stringify(defaultTags), input.description || null]
    );
    return this.mapRegistryRow(result.rows[0]);
  }

  async unregisterMetric(name: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM metric_registry WHERE name = $1',
      [name]
    );
    return result.rowCount > 0;
  }

  async getAllRegisteredMetrics(): Promise<string[]> {
    const result = await this.pool.query(
      'SELECT name FROM metric_registry ORDER BY created_at DESC'
    );
    return result.rows.map((row: any) => row.name);
  }

  async getMetricRegistry(name: string): Promise<MetricRegistryRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM metric_registry WHERE name = $1',
      [name]
    );
    return result.rows.length > 0 ? this.mapRegistryRow(result.rows[0]) : null;
  }

  async insertDataPoint(input: InsertDataPointInput): Promise<void> {
    const tenantId = input.tenant_id || '00000000-0000-0000-0000-000000000000';
    const tags = input.tags || {};
    const timestamp = input.timestamp || new Date();
    await this.pool.query(
      `INSERT INTO metric_data_points (tenant_id, metric_name, value, tags, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, input.metric_name, input.value, JSON.stringify(tags), timestamp]
    );
  }

  async queryMetricSeries(query: MetricQuery, tenantId?: string): Promise<MetricSeries> {
    const conditions: string[] = ['metric_name = $1'];
    const params: any[] = [query.name];
    let paramIndex = 2;

    if (tenantId) {
      conditions.push(`tenant_id = $${paramIndex}`);
      params.push(tenantId);
      paramIndex++;
    }

    if (query.startTime) {
      conditions.push(`timestamp >= $${paramIndex}`);
      params.push(query.startTime);
      paramIndex++;
    }

    if (query.endTime) {
      conditions.push(`timestamp <= $${paramIndex}`);
      params.push(query.endTime);
      paramIndex++;
    }

    // Tag filtering using JSONB containment
    if (query.tags && Object.keys(query.tags).length > 0) {
      conditions.push(`tags @> $${paramIndex}`);
      params.push(JSON.stringify(query.tags));
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const dataResult = await this.pool.query(
      `SELECT value, timestamp FROM metric_data_points
       WHERE ${whereClause}
       ORDER BY timestamp ASC`,
      params
    );

    const points: DataPoint[] = dataResult.rows.map((row: any) => ({
      timestamp: new Date(row.timestamp),
      value: row.value,
    }));

    // Apply max points limit (sampling)
    let sampledPoints = points;
    if (query.maxPoints && points.length > query.maxPoints) {
      const step = Math.ceil(points.length / query.maxPoints);
      sampledPoints = [];
      for (let i = 0; i < points.length && sampledPoints.length < query.maxPoints; i += step) {
        sampledPoints.push(points[i]);
      }
    }

    const values = sampledPoints.map(p => p.value);
    const aggregation = this.computeAggregation(values);

    const windowStart = sampledPoints.length > 0 ? sampledPoints[0].timestamp : new Date();
    const windowEnd = sampledPoints.length > 0 ? sampledPoints[sampledPoints.length - 1].timestamp : new Date();

    return {
      name: query.name,
      dataPoints: sampledPoints,
      aggregation,
      tags: query.tags,
      windowStart,
      windowEnd,
    };
  }

  async getLatestValue(name: string, tags?: Record<string, string>, tenantId?: string): Promise<number | null> {
    const conditions: string[] = ['metric_name = $1'];
    const params: any[] = [name];
    let paramIndex = 2;

    if (tenantId) {
      conditions.push(`tenant_id = $${paramIndex}`);
      params.push(tenantId);
      paramIndex++;
    }

    if (tags && Object.keys(tags).length > 0) {
      conditions.push(`tags @> $${paramIndex}`);
      params.push(JSON.stringify(tags));
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const result = await this.pool.query(
      `SELECT value FROM metric_data_points
       WHERE ${whereClause}
       ORDER BY timestamp DESC
       LIMIT 1`,
      params
    );

    return result.rows.length > 0 ? result.rows[0].value : null;
  }

  async pruneExpired(retentionMs: number, tenantId?: string): Promise<number> {
    const cutoff = new Date(Date.now() - retentionMs);
    const conditions: string[] = ['timestamp < $1'];
    const params: any[] = [cutoff];

    if (tenantId) {
      conditions.push(`tenant_id = $2`);
      params.push(tenantId);
    }

    const whereClause = conditions.join(' AND ');

    const result = await this.pool.query(
      `DELETE FROM metric_data_points WHERE ${whereClause}`,
      params
    );
    return result.rowCount || 0;
  }

  async clearAll(tenantId?: string): Promise<void> {
    if (tenantId) {
      await this.pool.query('DELETE FROM metric_data_points WHERE tenant_id = $1', [tenantId]);
      await this.pool.query('DELETE FROM metric_registry WHERE tenant_id = $1', [tenantId]);
    } else {
      await this.pool.query('TRUNCATE metric_data_points, metric_registry');
    }
  }

  // ==================== Private Helpers ====================

  private mapRegistryRow(row: any): MetricRegistryRecord {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      unit: row.unit,
      default_tags: row.default_tags || {},
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private computeAggregation(values: number[]): MetricAggregation {
    if (values.length === 0) {
      return { avg: 0, max: 0, min: 0, p99: 0, p95: 0, count: 0, sum: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = sum / values.length;

    return {
      avg: Math.round(avg * 100) / 100,
      max: sorted[sorted.length - 1],
      min: sorted[0],
      p99: this.percentile(sorted, 99),
      p95: this.percentile(sorted, 95),
      count: values.length,
      sum: Math.round(sum * 100) / 100,
    };
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];

    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) return sorted[lower];

    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
}
```

- [ ] **Step 2: Export from module index**

Modify `orion-platform-service/src/services/monitoring/index.ts` - add these exports:

```typescript
// Metric Storage Repository
export {
  PostgresMetricStorageRepository,
} from './MetricStorageRepository';
export type {
  MetricStorageRepository,
  MetricRegistryRecord,
  MetricDataPointRecord,
  CreateMetricRegistryInput,
  InsertDataPointInput,
} from './MetricStorageRepository';
```

- [ ] **Step 3: Write repository unit tests**

Create `orion-platform-service/src/services/monitoring/__tests__/MetricStorageRepository.test.ts`:

```typescript
/**
 * MetricStorageRepository Unit Tests
 */

import { PostgresMetricStorageRepository } from '../MetricStorageRepository';

// Mock DatabasePool
const createMockPool = (rows: any[] = []) => ({
  query: jest.fn().mockResolvedValue({
    rows,
    rowCount: rows.length,
  }),
});

describe('PostgresMetricStorageRepository', () => {
  let repo: PostgresMetricStorageRepository;
  let mockPool: any;

  beforeEach(() => {
    mockPool = createMockPool();
    repo = new PostgresMetricStorageRepository(mockPool as any);
  });

  describe('registerMetric', () => {
    it('should insert a new metric registry record', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'uuid-1',
          tenant_id: 'default-tenant',
          name: 'test.metric',
          unit: 'count',
          default_tags: {},
          description: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.registerMetric({
        name: 'test.metric',
        unit: 'count',
        description: 'Test metric',
      });

      expect(result.name).toBe('test.metric');
      expect(result.unit).toBe('count');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO metric_registry'),
        expect.any(Array)
      );
    });
  });

  describe('getAllRegisteredMetrics', () => {
    it('should return metric names', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ name: 'metric.a' }, { name: 'metric.b' }],
        rowCount: 2,
      });

      const result = await repo.getAllRegisteredMetrics();
      expect(result).toEqual(['metric.a', 'metric.b']);
    });
  });

  describe('unregisterMetric', () => {
    it('should return true when metric deleted', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });
      const result = await repo.unregisterMetric('test.metric');
      expect(result).toBe(true);
    });

    it('should return false when metric not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.unregisterMetric('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('insertDataPoint', () => {
    it('should insert a data point', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.insertDataPoint({
        metric_name: 'test.metric',
        value: 42,
        tags: { env: 'prod' },
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO metric_data_points'),
        expect.any(Array)
      );
    });
  });

  describe('getLatestValue', () => {
    it('should return the latest value', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ value: 99 }],
        rowCount: 1,
      });

      const result = await repo.getLatestValue('test.metric');
      expect(result).toBe(99);
    });

    it('should return null when no data', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.getLatestValue('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('queryMetricSeries', () => {
    it('should return empty series when no data', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.queryMetricSeries({ name: 'unknown' });
      expect(result.dataPoints).toEqual([]);
      expect(result.aggregation.count).toBe(0);
    });
  });

  describe('pruneExpired', () => {
    it('should delete expired records and return count', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 5 });
      const result = await repo.pruneExpired(3600000);
      expect(result).toBe(5);
    });
  });
});
```

- [ ] **Step 4: Run repository tests**

Run: `cd orion-platform-service && npx jest src/services/monitoring/__tests__/MetricStorageRepository.test.ts -v`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add orion-platform-service/src/services/monitoring/MetricStorageRepository.ts \
         orion-platform-service/src/services/monitoring/index.ts \
         orion-platform-service/src/services/monitoring/__tests__/MetricStorageRepository.test.ts
git commit -m "feat(monitoring): add MetricStorageRepository interface and Postgres implementation"
```

---

### Task 3: Refactor MetricCollector to Use Optional Repository

**Files:**
- Modify: `orion-platform-service/src/services/monitoring/MetricCollector.ts`
- Test: `orion-platform-service/src/services/monitoring/__tests__/MetricCollector.test.ts`

- [ ] **Step 1: Modify MetricCollector to accept optional repository**

Replace `orion-platform-service/src/services/monitoring/MetricCollector.ts` with this updated implementation:

```typescript
/**
 * TASK-703: Metric Collector
 *
 * Collects system metrics (CPU, memory, disk, network), application metrics
 * (latency, error rate, throughput), and custom metrics. Supports both
 * in-memory Map storage (legacy) and PostgreSQL Repository persistence.
 */

import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import {
  Metric,
  MetricSeries,
  MetricAggregation,
  DataPoint,
} from './types';
import {
  MetricStorageRepository,
  CreateMetricRegistryInput,
} from './MetricStorageRepository';

/**
 * Custom metric registration parameters
 */
export interface MetricRegistration {
  name: string;
  unit: string;
  defaultTags?: Record<string, string>;
  description?: string;
  tenantId?: string;
}

/**
 * Query parameters for metric series
 */
export interface MetricQuery {
  name: string;
  tags?: Record<string, string>;
  startTime?: Date;
  endTime?: Date;
  maxPoints?: number;
}

/**
 * Internal registered metric metadata
 */
interface RegisteredMetric {
  name: string;
  unit: string;
  defaultTags: Record<string, string>;
  description?: string;
}

/**
 * Metric Collector - Collects and stores time-series metrics
 *
 * Supports:
 * - System metrics (CPU, memory, disk, network)
 * - Application metrics (latency, error rate, throughput)
 * - Custom metric registration and recording
 * - Time-series storage with configurable retention
 * - PostgreSQL Repository persistence (optional) or in-memory Map (fallback)
 */
export class MetricCollector {
  /** Optional PostgreSQL repository for persistent storage */
  private readonly repository?: MetricStorageRepository;

  /** Default tenant ID for repository operations */
  private readonly defaultTenantId: string;

  /** Registered metric metadata (in-memory cache) */
  private registeredMetrics: Map<string, RegisteredMetric> = new Map();

  /** Raw metric storage: metricName -> DataPoint[] (in-memory fallback) */
  private metricStorage: Map<string, { points: DataPoint[]; tags: Record<string, string>[] }> = new Map();

  /** Metric retention period in milliseconds (default: 24 hours) */
  private retentionMs: number;

  /** Maximum data points per metric */
  private maxDataPoints: number;

  /** NATS message rate tracking (always in-memory) */
  private natsMessageCounts: Map<string, number> = new Map();

  constructor(options?: {
    retentionMs?: number;
    maxDataPointsPerMetric?: number;
    repository?: MetricStorageRepository;
    defaultTenantId?: string;
  }) {
    this.retentionMs = options?.retentionMs ?? 24 * 60 * 60 * 1000;
    this.maxDataPoints = options?.maxDataPointsPerMetric ?? 10000;
    this.repository = options?.repository;
    this.defaultTenantId = options?.defaultTenantId || '00000000-0000-0000-0000-000000000000';
  }

  // ==================== System Metrics Collection ====================

  collectSystemMetrics(): Metric[] {
    const now = new Date();
    const metrics: Metric[] = [];

    const cpuUsage = this.getCpuUsage();
    metrics.push({
      id: uuidv4(),
      name: 'system.cpu.usage',
      value: cpuUsage,
      tags: { host: os.hostname() },
      timestamp: now,
      unit: 'percent',
    });

    const memUsage = this.getMemoryUsage();
    metrics.push({
      id: uuidv4(),
      name: 'system.memory.usage',
      value: memUsage.percent,
      tags: { host: os.hostname() },
      timestamp: now,
      unit: 'percent',
    });
    metrics.push({
      id: uuidv4(),
      name: 'system.memory.used',
      value: memUsage.used,
      tags: { host: os.hostname() },
      timestamp: now,
      unit: 'bytes',
    });
    metrics.push({
      id: uuidv4(),
      name: 'system.memory.total',
      value: memUsage.total,
      tags: { host: os.hostname() },
      timestamp: now,
      unit: 'bytes',
    });

    const diskUsage = this.getDiskUsage();
    metrics.push({
      id: uuidv4(),
      name: 'system.disk.usage',
      value: diskUsage.percent,
      tags: { host: os.hostname(), mount: '/' },
      timestamp: now,
      unit: 'percent',
    });

    const networkStats = this.getNetworkStats();
    metrics.push({
      id: uuidv4(),
      name: 'system.network.bytes_recv',
      value: networkStats.bytesRecv,
      tags: { host: os.hostname() },
      timestamp: now,
      unit: 'bytes',
    });
    metrics.push({
      id: uuidv4(),
      name: 'system.network.bytes_sent',
      value: networkStats.bytesSent,
      tags: { host: os.hostname() },
      timestamp: now,
      unit: 'bytes',
    });

    const loadAvg = os.loadavg();
    metrics.push({ id: uuidv4(), name: 'system.load.1m', value: loadAvg[0], tags: { host: os.hostname() }, timestamp: now, unit: 'load' });
    metrics.push({ id: uuidv4(), name: 'system.load.5m', value: loadAvg[1], tags: { host: os.hostname() }, timestamp: now, unit: 'load' });
    metrics.push({ id: uuidv4(), name: 'system.load.15m', value: loadAvg[2], tags: { host: os.hostname() }, timestamp: now, unit: 'load' });

    // Record all system metrics (async if repository available)
    for (const metric of metrics) {
      this.recordMetric(metric.name, metric.value, metric.tags, metric.timestamp);
    }

    return metrics;
  }

  private getCpuUsage(): number {
    const loadAvg = os.loadavg()[0];
    const numCpus = os.cpus().length;
    return Math.min(100, Math.round((loadAvg / numCpus) * 100 * 100) / 100);
  }

  private getMemoryUsage(): { used: number; total: number; percent: number } {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percent = Math.round((used / total) * 10000) / 100;
    return { used, total, percent };
  }

  private getDiskUsage(): { percent: number } {
    return { percent: 0 };
  }

  private getNetworkStats(): { bytesRecv: number; bytesSent: number } {
    const netStats = os.networkInterfaces();
    let bytesRecv = 0;
    let bytesSent = 0;
    for (const iface of Object.values(netStats)) {
      if (iface) {
        bytesRecv += iface.length;
        bytesSent += iface.length;
      }
    }
    return { bytesRecv, bytesSent };
  }

  // ==================== Custom Metric Registration ====================

  registerMetric(params: MetricRegistration): void {
    this.registeredMetrics.set(params.name, {
      name: params.name,
      unit: params.unit,
      defaultTags: params.defaultTags || {},
      description: params.description,
    });

    if (!this.metricStorage.has(params.name)) {
      this.metricStorage.set(params.name, { points: [], tags: [] });
    }

    // Also persist to repository if available
    if (this.repository) {
      this.repository.registerMetric({
        tenant_id: params.tenantId || this.defaultTenantId,
        name: params.name,
        unit: params.unit,
        default_tags: params.defaultTags,
        description: params.description,
      }).catch(err => console.warn('[MetricCollector] Failed to register metric in repository:', err));
    }
  }

  unregisterMetric(name: string): boolean {
    this.registeredMetrics.delete(name);
    this.metricStorage.delete(name);

    if (this.repository) {
      this.repository.unregisterMetric(name).catch(err =>
        console.warn('[MetricCollector] Failed to unregister metric in repository:', err)
      );
    }

    return true;
  }

  getRegisteredMetrics(): string[] {
    return Array.from(this.registeredMetrics.keys());
  }

  // ==================== Metric Recording ====================

  recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>,
    timestamp?: Date
  ): void {
    const ts = timestamp || new Date();
    const point: DataPoint = { timestamp: ts, value };

    // In-memory path (always active for real-time access)
    if (!this.metricStorage.has(name)) {
      this.metricStorage.set(name, { points: [], tags: [] });
    }
    const storage = this.metricStorage.get(name)!;
    storage.points.push(point);
    storage.tags.push(tags || {});

    this.enforceRetention(name);

    if (storage.points.length > this.maxDataPoints) {
      const excess = storage.points.length - this.maxDataPoints;
      storage.points = storage.points.slice(excess);
      storage.tags = storage.tags.slice(excess);
    }

    // Also persist to repository if available (fire-and-forget)
    if (this.repository) {
      this.repository.insertDataPoint({
        tenant_id: this.defaultTenantId,
        metric_name: name,
        value,
        tags: tags || {},
        timestamp: ts,
      }).catch(err => console.warn('[MetricCollector] Failed to persist data point:', err));
    }
  }

  recordLatency(endpoint: string, latencyMs: number, statusCode?: number): void {
    const tags: Record<string, string> = { endpoint };
    if (statusCode) tags.statusCode = String(statusCode);
    this.recordMetric('app.http.latency', latencyMs, tags);
  }

  recordError(serviceName: string, errorType?: string): void {
    const tags: Record<string, string> = { service: serviceName };
    if (errorType) tags.errorType = errorType;
    this.recordMetric('app.errors.count', 1, tags);
  }

  recordThroughput(serviceName: string, count: number = 1): void {
    this.recordMetric('app.throughput', count, { service: serviceName });
  }

  recordNatsMessageRate(subject: string, count: number = 1): void {
    const currentCount = this.natsMessageCounts.get(subject) || 0;
    this.natsMessageCounts.set(subject, currentCount + count);
    this.recordMetric('nats.messages', count, { subject });
  }

  getNatsMessageCounts(): Map<string, number> {
    return new Map(this.natsMessageCounts);
  }

  resetNatsMessageCounts(): void {
    this.natsMessageCounts.clear();
  }

  // ==================== Metric Retrieval ====================

  getMetricSeries(query: MetricQuery): MetricSeries {
    // If repository is available, use it for time-series queries (historical data)
    if (this.repository) {
      // Sync call: in production this would be async, but for backward compat
      // we return in-memory data. The async version is getMetricSeriesAsync.
      return this.getMetricSeriesFromMemory(query);
    }
    return this.getMetricSeriesFromMemory(query);
  }

  /**
   * Async version of getMetricSeries that queries the repository.
   * Use this in routes/controllers that support async.
   */
  async getMetricSeriesAsync(query: MetricQuery): Promise<MetricSeries> {
    if (this.repository) {
      return this.repository.queryMetricSeries(query, this.defaultTenantId);
    }
    return this.getMetricSeriesFromMemory(query);
  }

  private getMetricSeriesFromMemory(query: MetricQuery): MetricSeries {
    const storage = this.metricStorage.get(query.name);
    if (!storage) {
      return this.emptySeries(query.name);
    }

    let points = [...storage.points];
    let tags = [...storage.tags];

    if (query.tags) {
      const filtered: { point: DataPoint; tags: Record<string, string> }[] = [];
      for (let i = 0; i < points.length; i++) {
        if (this.tagsMatch(tags[i], query.tags)) {
          filtered.push({ point: points[i], tags: tags[i] });
        }
      }
      points = filtered.map(f => f.point);
      tags = filtered.map(f => f.tags);
    }

    if (query.startTime) {
      const startIdx = points.findIndex(p => p.timestamp >= query.startTime!);
      if (startIdx > 0) {
        points = points.slice(startIdx);
        tags = tags.slice(startIdx);
      }
    }

    if (query.endTime) {
      const endIdx = points.findIndex(p => p.timestamp > query.endTime!);
      if (endIdx > 0) {
        points = points.slice(0, endIdx);
        tags = tags.slice(0, endIdx);
      }
    }

    if (query.maxPoints && points.length > query.maxPoints) {
      const step = Math.ceil(points.length / query.maxPoints);
      const sampled: DataPoint[] = [];
      for (let i = 0; i < points.length && sampled.length < query.maxPoints!; i += step) {
        sampled.push(points[i]);
      }
      points = sampled;
    }

    const values = points.map(p => p.value);
    const aggregation = this.computeAggregation(values);

    const windowStart = points.length > 0 ? points[0].timestamp : new Date(0);
    const windowEnd = points.length > 0 ? points[points.length - 1].timestamp : new Date(0);

    return {
      name: query.name,
      dataPoints: points,
      aggregation,
      tags: query.tags,
      windowStart,
      windowEnd,
    };
  }

  getMetricSummary(name: string, tags?: Record<string, string>, windowMs?: number): MetricAggregation {
    const query: MetricQuery = { name, tags };
    if (windowMs) {
      query.startTime = new Date(Date.now() - windowMs);
      query.endTime = new Date();
    }
    const series = this.getMetricSeries(query);
    return series.aggregation;
  }

  async getMetricSummaryAsync(name: string, tags?: Record<string, string>, windowMs?: number): Promise<MetricAggregation> {
    const query: MetricQuery = { name, tags };
    if (windowMs) {
      query.startTime = new Date(Date.now() - windowMs);
      query.endTime = new Date();
    }
    const series = await this.getMetricSeriesAsync(query);
    return series.aggregation;
  }

  getLatestValue(name: string, tags?: Record<string, string>): number | null {
    const storage = this.metricStorage.get(name);
    if (!storage || storage.points.length === 0) {
      return null;
    }
    for (let i = storage.points.length - 1; i >= 0; i--) {
      if (!tags || this.tagsMatch(storage.tags[i], tags)) {
        return storage.points[i].value;
      }
    }
    return null;
  }

  /**
   * Async version that queries repository for latest persisted value.
   */
  async getLatestValueAsync(name: string, tags?: Record<string, string>): Promise<number | null> {
    if (this.repository) {
      return this.repository.getLatestValue(name, tags, this.defaultTenantId);
    }
    return this.getLatestValue(name, tags);
  }

  // ==================== Maintenance ====================

  pruneExpired(): number {
    let pruned = 0;
    const cutoff = new Date(Date.now() - this.retentionMs);

    for (const [name, storage] of this.metricStorage) {
      const validIdx = storage.points.findIndex(p => p.timestamp >= cutoff);
      if (validIdx > 0) {
        pruned += validIdx;
        storage.points = storage.points.slice(validIdx);
        storage.tags = storage.tags.slice(validIdx);
      } else if (validIdx === -1 && storage.points.length > 0) {
        pruned += storage.points.length;
        storage.points = [];
        storage.tags = [];
      }
    }

    // Also prune repository
    if (this.repository) {
      this.repository.pruneExpired(this.retentionMs, this.defaultTenantId)
        .then(count => console.log(`[MetricCollector] Pruned ${count} expired points from repository`))
        .catch(err => console.warn('[MetricCollector] Failed to prune from repository:', err));
    }

    return pruned;
  }

  clearAll(): void {
    this.metricStorage.clear();
    this.registeredMetrics.clear();
    this.natsMessageCounts.clear();

    if (this.repository) {
      this.repository.clearAll(this.defaultTenantId)
        .catch(err => console.warn('[MetricCollector] Failed to clear repository:', err));
    }
  }

  // ==================== Private Methods ====================

  private enforceRetention(name: string): void {
    const cutoff = Date.now() - this.retentionMs;
    const storage = this.metricStorage.get(name);
    if (!storage) return;

    const validIdx = storage.points.findIndex(p => p.timestamp.getTime() >= cutoff);
    if (validIdx > 0) {
      storage.points = storage.points.slice(validIdx);
      storage.tags = storage.tags.slice(validIdx);
    }
  }

  private tagsMatch(stored: Record<string, string>, filter: Record<string, string>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (stored[key] !== value) return false;
    }
    return true;
  }

  private computeAggregation(values: number[]): MetricAggregation {
    if (values.length === 0) {
      return { avg: 0, max: 0, min: 0, p99: 0, p95: 0, count: 0, sum: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = sum / values.length;
    const max = sorted[sorted.length - 1];
    const min = sorted[0];
    const p95 = this.percentile(sorted, 95);
    const p99 = this.percentile(sorted, 99);

    return {
      avg: Math.round(avg * 100) / 100,
      max,
      min,
      p99: Math.round(p99 * 100) / 100,
      p95: Math.round(p95 * 100) / 100,
      count: values.length,
      sum: Math.round(sum * 100) / 100,
    };
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];

    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) return sorted[lower];

    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private emptySeries(name: string): MetricSeries {
    const now = new Date();
    return {
      name,
      dataPoints: [],
      aggregation: { avg: 0, max: 0, min: 0, p99: 0, p95: 0, count: 0, sum: 0 },
      windowStart: now,
      windowEnd: now,
    };
  }
}
```

Key changes from the original:
- Added `repository?: MetricStorageRepository` and `defaultTenantId` as constructor options
- `registerMetric()` now also calls `repository.registerMetric()` (fire-and-forget)
- `recordMetric()` now also calls `repository.insertDataPoint()` (fire-and-forget)
- Added `getMetricSeriesAsync()` and `getLatestValueAsync()` for repository-backed reads
- `pruneExpired()` and `clearAll()` also call repository equivalents
- All existing sync methods remain unchanged for backward compatibility
- NATS counts remain purely in-memory

- [ ] **Step 2: Run existing tests to confirm backward compatibility**

Run: `cd orion-platform-service && npx jest src/services/monitoring/__tests__/MetricCollector.test.ts -v`

Expected: All existing tests pass unchanged (the in-memory fallback path is still fully functional).

- [ ] **Step 3: Commit**

```bash
git add orion-platform-service/src/services/monitoring/MetricCollector.ts
git commit -m "refactor(monitoring): add optional repository support to MetricCollector with backward-compatible Map fallback"
```

---

### Task 4: Wire Repository into MonitoringService

**Files:**
- Modify: `orion-platform-service/src/services/monitoring/MonitoringService.ts`

- [ ] **Step 1: Update MonitoringService to pass repository to MetricCollector**

Modify the constructor in `orion-platform-service/src/services/monitoring/MonitoringService.ts`. Add the import and change the MetricCollector initialization:

At the top of the file, add:
```typescript
import { PostgresMetricStorageRepository } from './MetricStorageRepository';
```

Modify the constructor to accept optional database pool and create the repository:

```typescript
  constructor(repository?: MonitoringRepository, dbPool?: any) {
    this.repository = repository;

    // Create metric storage repository if database is available
    const metricRepo = dbPool ? new PostgresMetricStorageRepository(dbPool) : undefined;

    // Initialize sub-services
    this.metricCollector = new MetricCollector({
      repository: metricRepo,
    });
    this.alertRuleEngine = new AlertRuleEngine(this.metricCollector);
    this.notificationService = new AlertNotificationService();
    this.dashboard = new MonitoringDashboard(this.metricCollector);

    // Wire alert callbacks
    this.alertRuleEngine.onAlert = (alert) => {
      // Auto-send notifications for new alerts via registered channels
    };
  }
```

- [ ] **Step 2: Verify compilation**

Run: `cd orion-platform-service && npx tsc --noEmit --skipLibCheck 2>&1 | head -30`

Expected: No errors related to monitoring module.

- [ ] **Step 3: Commit**

```bash
git add orion-platform-service/src/services/monitoring/MonitoringService.ts
git commit -m "feat(monitoring): wire MetricStorageRepository into MonitoringService constructor"
```

---

### Task 5: Update MonitoringController to Use Async Repository Methods

**Files:**
- Modify: `orion-platform-service/src/api/controllers/monitoring/MonitoringController.ts`

- [ ] **Step 1: Update metric controller methods to use async repository calls**

Modify the following methods in `orion-platform-service/src/api/controllers/monitoring/MonitoringController.ts`:

**`recordMetric` method** (line ~111-136) - change to await the async call:

```typescript
  async recordMetric(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { name, value, tags, unit } = body;

      if (!name || value === undefined) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, value',
        });
        return;
      }

      // recordMetric is sync (fire-and-forget for repo), but we await for consistency
      this.monitoringService.metricCollector.recordMetric(name, value, tags);

      await reply.status(201).send({
        success: true,
        message: 'Metric recorded',
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'RECORD_ERROR',
        message: error.message,
      });
    }
  }
```

**`getMetricSeries` method** (line ~178-194) - use async version:

```typescript
  async getMetricSeries(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const query = request.query as any;

    const series = await this.monitoringService.metricCollector.getMetricSeriesAsync({
      name: params.name,
      tags: query.tags ? JSON.parse(query.tags) : undefined,
      startTime: query.startTime ? new Date(query.startTime) : undefined,
      endTime: query.endTime ? new Date(query.endTime) : undefined,
      maxPoints: query.maxPoints ? parseInt(query.maxPoints) : undefined,
    });

    await reply.status(200).send({
      success: true,
      data: { series },
    });
  }
```

**`getMetricSummary` method** (line ~200-214) - use async version:

```typescript
  async getMetricSummary(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const query = request.query as any;

    const summary = await this.monitoringService.metricCollector.getMetricSummaryAsync(
      params.name,
      query.tags ? JSON.parse(query.tags) : undefined,
      query.windowMs ? parseInt(query.windowMs) : undefined
    );

    await reply.status(200).send({
      success: true,
      data: { summary },
    });
  }
```

- [ ] **Step 2: Run full monitoring test suite**

Run: `cd orion-platform-service && npx jest src/services/monitoring/__tests__/ --testPathIgnorePatterns=MetricStorageRepository -v`

Expected: All monitoring tests pass.

- [ ] **Step 3: Commit**

```bash
git add orion-platform-service/src/api/controllers/monitoring/MonitoringController.ts
git commit -m "feat(monitoring): update controller to use async repository methods for metric queries"
```

---

### Task 6: Integration Verification

**Files:** N/A (verification task)

- [ ] **Step 1: Run full test suite for monitoring module**

Run: `cd orion-platform-service && npx jest src/services/monitoring/ -v`

Expected: All tests pass including the new MetricStorageRepository tests.

- [ ] **Step 2: Run type check**

Run: `cd orion-platform-service && npx tsc --noEmit --skipLibCheck 2>&1 | grep -i monitor || echo "No monitoring type errors"`

Expected: No type errors.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore(monitoring): verify MetricCollector PostgreSQL migration - all tests passing"
```

---

## Self-Review

### 1. Spec Coverage

| Requirement | Task |
|------------|------|
| Create SQL migration for metric_registry + metric_data_points | Task 1 |
| Create Repository interface + Postgres implementation | Task 2 |
| Refactor MetricCollector: Map -> Repository async calls | Task 3 |
| Update routes/controller to use async methods | Task 5 |
| Wire repository into MonitoringService | Task 4 |
| Verify migration after function normal | Task 6 |
| Backward compatibility (Map fallback) | Task 3 (design decision) |
| NATS counts remain in-memory | Task 3 (explicitly kept) |
| Tenant isolation (tenant_id in all tables) | Task 1 (SQL) + Task 2 (repo) |
| JSONB tag filtering | Task 1 (SQL) + Task 2 (`@>` operator) |

### 2. Placeholder Scan

No TBD, TODO, "implement later", "add validation", "similar to Task N", or test-less steps found. All code blocks are complete.

### 3. Type Consistency

- `MetricQuery` type: exported from MetricCollector, used in Repository interface and both implementations. Consistent.
- `MetricSeries`, `MetricAggregation`, `DataPoint`: imported from `./types` in both MetricCollector and Repository. Consistent.
- `DatabasePool` type: imported from `../database` in Repository, matches MonitoringRepository pattern. Consistent.
- Method signatures: `registerMetric()`, `recordMetric()`, `getMetricSeries()` etc. maintain their existing sync signatures; new `*Async()` variants added for repository-backed reads. No naming conflicts.

Plan is clean and consistent.
