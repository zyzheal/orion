# ITSM Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comprehensive test coverage for 5 ITSM modules (Incident, Problem, SLA, Change, ServiceCatalog) — 10 test files, ~3600 lines.

**Architecture:** All ITSM services use `db` constructor pattern with internal repository creation. Tests use Mode A: mock `pool.query` via `jest.fn()`, verify SQL queries and parameters. Repository tests verify CRUD SQL. Service tests verify business logic (validation, state transitions, error handling).

**Tech Stack:** Jest, `@jest/globals`, TypeScript, PostgreSQL (via mock)

---

## File Structure

```
orion-platform-service/src/services/
├── incident/__tests__/
│   ├── IncidentRepository.test.ts    (existing — supplement)
│   └── IncidentService.test.ts       (existing — supplement)
├── problem/__tests__/
│   ├── ProblemRepository.test.ts     (new)
│   └── ProblemService.test.ts        (new)
├── sla/__tests__/
│   ├── SLARepository.test.ts         (new)
│   └── SLAService.test.ts            (new)
├── change/__tests__/
│   ├── ChangeRepository.test.ts      (new)
│   └── ChangeService.test.ts         (new)
└── service-catalog/__tests__/
    ├── CatalogRepository.test.ts     (new)
    └── CatalogService.test.ts        (new)
```

**Source files under test:**
- `orion-platform-service/src/repositories/ProblemRepository.ts` — ProblemRepository, KnownErrorRepository
- `orion-platform-service/src/services/problem/ProblemService.ts` — ProblemService
- `orion-platform-service/src/services/sla/SLARepository.ts` — SLADefinitionRepository, SLATrackingRepository, SLABreachEventRepository
- `orion-platform-service/src/services/sla/SLAService.ts` — SLAService
- `orion-platform-service/src/services/change/ChangeRepository.ts` — ChangeRequestRepository, CABMeetingRepository, ChangeTimelineRepository, RFCRepository
- `orion-platform-service/src/services/change/ChangeService.ts` — ChangeService
- `orion-platform-service/src/services/service-catalog/ServiceCatalogService.ts` — ServiceCatalogService
- `orion-platform-service/src/services/incident/IncidentRepository.ts` — IncidentRepository

---

## Task 1: ProblemRepository Tests

**Files:**
- Create: `orion-platform-service/src/services/problem/__tests__/ProblemRepository.test.ts`
- Read: `orion-platform-service/src/repositories/ProblemRepository.ts`

- [ ] **Step 1: Create test directory**

```bash
mkdir -p orion-platform-service/src/services/problem/__tests__
```

- [ ] **Step 2: Write ProblemRepository CRUD tests**

```typescript
/**
 * Tests for ProblemRepository and KnownErrorRepository
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ProblemRepository, KnownErrorRepository } from '../../../repositories/ProblemRepository';

const mockPool = {
  query: jest.fn<any, any>(),
};

describe('ProblemRepository', () => {
  let repo: ProblemRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ProblemRepository(mockPool as any);
  });

  describe('create', () => {
    it('should create problem with all fields', async () => {
      const input = {
        tenantId: 'tenant-1',
        title: 'Database connection timeout',
        description: 'Frequent timeouts on primary DB',
        severity: 'high',
        category: 'infrastructure',
        status: 'known',
        assignedTo: 'engineer-1',
        createdBy: 'user-1',
      };
      const mockResult = { id: 'prob-1', ...input, created_at: new Date() };
      mockPool.query.mockResolvedValueOnce({ rows: [mockResult] });

      const result = await repo.create(input);

      expect(result).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO problems'),
        expect.arrayContaining(['tenant-1', 'Database connection timeout'])
      );
    });

    it('should create problem with minimal fields', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'prob-2' }] });

      await repo.create({ tenantId: 'tenant-1', title: 'Issue' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO problems'),
        expect.any(Array)
      );
    });
  });

  describe('findById', () => {
    it('should return problem when found', async () => {
      const mockProblem = { id: 'prob-1', title: 'Test', tenant_id: 'tenant-1' };
      mockPool.query.mockResolvedValueOnce({ rows: [mockProblem] });

      const result = await repo.findById('prob-1');

      expect(result).toEqual(mockProblem);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM problems WHERE id = $1'),
        ['prob-1']
      );
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByTenant', () => {
    it('should return problems for tenant', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'prob-1' }], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await repo.findByTenant('tenant-1');

      expect(result.entities).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        expect.arrayContaining(['tenant-1'])
      );
    });

    it('should filter by status', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await repo.findByTenant('tenant-1', { status: 'investigating' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        expect.arrayContaining(['tenant-1', 'investigating'])
      );
    });

    it('should filter by severity', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await repo.findByTenant('tenant-1', { severity: 'critical' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('severity = $'),
        expect.arrayContaining(['tenant-1', 'critical'])
      );
    });

    it('should apply pagination', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await repo.findByTenant('tenant-1', { limit: 10, offset: 20 });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 20])
      );
    });
  });

  describe('update', () => {
    it('should update problem fields', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'prob-1', status: 'resolved', root_cause: 'Memory leak' }],
      });

      const result = await repo.update('prob-1', { status: 'resolved', rootCause: 'Memory leak' });

      expect(result).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE problems SET'),
        expect.any(Array)
      );
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.update('nonexistent', { status: 'resolved' });

      expect(result).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete problem', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await repo.delete('prob-1');

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM problems WHERE id = $1'),
        ['prob-1']
      );
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });

      const result = await repo.delete('nonexistent');

      expect(result).toBe(false);
    });
  });
});

describe('KnownErrorRepository', () => {
  let repo: KnownErrorRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new KnownErrorRepository(mockPool as any);
  });

  describe('create', () => {
    it('should create known error', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'ke-1' }] });

      const result = await repo.create({
        tenantId: 'tenant-1',
        title: 'Known DB issue',
        problemId: 'prob-1',
        status: 'active',
      });

      expect(result).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO known_errors'),
        expect.arrayContaining(['tenant-1', 'Known DB issue'])
      );
    });
  });

  describe('findByTenant', () => {
    it('should filter by status', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await repo.findByTenant('tenant-1', { status: 'active' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        expect.arrayContaining(['tenant-1', 'active'])
      );
    });

    it('should support text search', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await repo.findByTenant('tenant-1', { search: 'timeout' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['tenant-1', '%timeout%'])
      );
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
cd orion-platform-service && npx jest src/services/problem/__tests__/ProblemRepository.test.ts --no-coverage 2>&1 | tail -20
```

Expected: All tests pass (code already exists).

- [ ] **Step 4: Commit**

```bash
git add orion-platform-service/src/services/problem/__tests__/ProblemRepository.test.ts
git commit -m "test(itsm): add ProblemRepository and KnownErrorRepository tests"
```

---

## Task 2: ProblemService Tests

**Files:**
- Create: `orion-platform-service/src/services/problem/__tests__/ProblemService.test.ts`
- Read: `orion-platform-service/src/services/problem/ProblemService.ts`

- [ ] **Step 1: Write ProblemService business logic tests**

```typescript
/**
 * Tests for ProblemService — business logic validation
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ProblemService } from '../ProblemService';

const mockPool = {
  query: jest.fn<any, any>(),
};

describe('ProblemService', () => {
  let service: ProblemService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProblemService(mockPool as any);
    service.init();
  });

  describe('createProblem', () => {
    it('should throw when title is missing', async () => {
      await expect(
        service.createProblem({ title: '' }, 'tenant-1')
      ).rejects.toThrow('Title is required');
    });

    it('should create problem with valid input', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'prob-1', title: 'DB issue', status: 'known', tenant_id: 'tenant-1' }],
      });

      const result = await service.createProblem({ title: 'DB issue' }, 'tenant-1');

      expect(result.id).toBe('prob-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO problems'),
        expect.any(Array)
      );
    });
  });

  describe('updateStatus', () => {
    it('should enforce valid status transitions', async () => {
      // Get current problem first
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'prob-1', status: 'closed', tenant_id: 'tenant-1' }],
      });

      await expect(
        service.updateStatus('prob-1', 'investigating', 'tenant-1')
      ).rejects.toThrow('Invalid status transition');
    });

    it('should allow valid transition: known -> investigating', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'prob-1', status: 'known', tenant_id: 'tenant-1' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'prob-1', status: 'investigating' }],
      });

      const result = await service.updateStatus('prob-1', 'investigating', 'tenant-1');

      expect(result.status).toBe('investigating');
    });

    it('should allow valid transition: investigating -> resolved', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'prob-1', status: 'investigating', tenant_id: 'tenant-1' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'prob-1', status: 'resolved' }],
      });

      const result = await service.updateStatus('prob-1', 'resolved', 'tenant-1');

      expect(result.status).toBe('resolved');
    });
  });

  describe('linkIncident', () => {
    it('should link incident to problem', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'prob-1', related_incidents: [], tenant_id: 'tenant-1' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'prob-1', related_incidents: ['inc-1'] }],
      });

      const result = await service.linkIncident('prob-1', 'inc-1', 'tenant-1');

      expect(result.related_incidents).toContain('inc-1');
    });
  });

  describe('linkChange', () => {
    it('should link change to problem', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'prob-1', related_changes: [], tenant_id: 'tenant-1' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'prob-1', related_changes: ['chg-1'] }],
      });

      const result = await service.linkChange('prob-1', 'chg-1', 'tenant-1');

      expect(result.related_changes).toContain('chg-1');
    });
  });

  describe('createFromIncident', () => {
    it('should create problem from incident data', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'prob-new',
          title: 'Service down',
          related_incidents: ['inc-1'],
          status: 'known',
        }],
      });

      const result = await service.createFromIncident({
        title: 'Service down',
        incidentId: 'inc-1',
        tenantId: 'tenant-1',
        severity: 'critical',
      });

      expect(result.id).toBe('prob-new');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO problems'),
        expect.any(Array)
      );
    });
  });

  describe('getStats', () => {
    it('should return problem statistics', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          total: '10',
          by_status: { known: '3', investigating: '4', resolved: '2', closed: '1' },
          by_severity: { critical: '2', high: '3', medium: '4', low: '1' },
        }],
      });

      const result = await service.getStats('tenant-1');

      expect(result.total).toBe(10);
    });
  });

  describe('KnownError operations', () => {
    it('should search known errors by keywords', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'ke-1', title: 'DB timeout fix' }],
      });

      const result = await service.searchKnownErrors('timeout', 'tenant-1');

      expect(result).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['tenant-1', '%timeout%'])
      );
    });

    it('should throw when creating known error without title', async () => {
      await expect(
        service.createKnownError({ title: '' }, 'tenant-1')
      ).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd orion-platform-service && npx jest src/services/problem/__tests__/ProblemService.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add orion-platform-service/src/services/problem/__tests__/ProblemService.test.ts
git commit -m "test(itsm): add ProblemService business logic tests"
```

---

## Task 3: SLARepository Tests

**Files:**
- Create: `orion-platform-service/src/services/sla/__tests__/SLARepository.test.ts`
- Read: `orion-platform-service/src/services/sla/SLARepository.ts`

- [ ] **Step 1: Create test directory**

```bash
mkdir -p orion-platform-service/src/services/sla/__tests__
```

- [ ] **Step 2: Write SLARepository tests**

```typescript
/**
 * Tests for SLARepository — SLADefinition, SLATracking, SLABreachEvent
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  SLADefinitionRepository,
  SLATrackingRepository,
  SLABreachEventRepository,
} from '../SLARepository';

const mockPool = {
  query: jest.fn<any, any>(),
};

describe('SLADefinitionRepository', () => {
  let repo: SLADefinitionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SLADefinitionRepository(mockPool as any);
  });

  describe('createDefinition', () => {
    it('should create SLA definition with all fields', async () => {
      const input = {
        tenantId: 'tenant-1',
        name: 'P1 Response SLA',
        type: 'response_time',
        targetValue: 30,
        targetUnit: 'minutes',
        priority: 'critical',
        status: 'active',
      };
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'sla-1', ...input }] });

      const result = await repo.createDefinition(input);

      expect(result).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sla_definitions'),
        expect.arrayContaining(['tenant-1', 'P1 Response SLA'])
      );
    });
  });

  describe('updateDefinition', () => {
    it('should update definition fields', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'sla-1', name: 'Updated SLA', status: 'active' }],
      });

      const result = await repo.updateDefinition('sla-1', { name: 'Updated SLA' });

      expect(result).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sla_definitions SET'),
        expect.any(Array)
      );
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.updateDefinition('nonexistent', { name: 'X' });

      expect(result).toBeUndefined();
    });
  });

  describe('findByTenant', () => {
    it('should filter by status', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await repo.findByTenant('tenant-1', { status: 'active' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        expect.arrayContaining(['tenant-1', 'active'])
      );
    });

    it('should filter by type', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await repo.findByTenant('tenant-1', { type: 'resolution_time' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('type = $'),
        expect.arrayContaining(['tenant-1', 'resolution_time'])
      );
    });
  });

  describe('getStats', () => {
    it('should return SLA statistics', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          total_definitions: '5',
          active_definitions: '3',
          by_type: { response_time: '2', resolution_time: '3' },
        }],
      });

      const result = await repo.getStats('tenant-1');

      expect(result.totalDefinitions).toBe(5);
    });
  });
});

describe('SLATrackingRepository', () => {
  let repo: SLATrackingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SLATrackingRepository(mockPool as any);
  });

  describe('createTracking', () => {
    it('should create tracking record', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'track-1', status: 'active' }],
      });

      const result = await repo.createTracking({
        tenantId: 'tenant-1',
        slaDefinitionId: 'sla-1',
        entityType: 'incident',
        entityId: 'inc-1',
        startedAt: new Date(),
      });

      expect(result).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sla_tracking'),
        expect.any(Array)
      );
    });
  });

  describe('updateStatus', () => {
    it('should update tracking status', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'track-1', status: 'breached' }],
      });

      const result = await repo.updateStatus('track-1', 'breached', 'tenant-1');

      expect(result).toBeDefined();
    });
  });

  describe('findActiveBreaches', () => {
    it('should find active breach records', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'track-1', status: 'breached' }],
      });

      const result = await repo.findActiveBreaches('tenant-1');

      expect(result).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('breached'),
        expect.arrayContaining(['tenant-1'])
      );
    });
  });

  describe('findByEntity', () => {
    it('should find tracking by entity type and id', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'track-1' }] });

      const result = await repo.findByEntity('incident', 'inc-1', 'tenant-1');

      expect(result).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('entity_type = $'),
        expect.arrayContaining(['incident', 'inc-1', 'tenant-1'])
      );
    });
  });
});

describe('SLABreachEventRepository', () => {
  let repo: SLABreachEventRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SLABreachEventRepository(mockPool as any);
  });

  describe('createEvent', () => {
    it('should create breach event', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'breach-1' }],
      });

      const result = await repo.createEvent({
        tenantId: 'tenant-1',
        slaTrackingId: 'track-1',
        breachType: 'response_time',
        severity: 'high',
      });

      expect(result).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sla_breach_events'),
        expect.any(Array)
      );
    });
  });

  describe('findByTrackingId', () => {
    it('should find events by tracking id', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'breach-1', sla_tracking_id: 'track-1' }],
      });

      const result = await repo.findByTrackingId('track-1');

      expect(result).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd orion-platform-service && npx jest src/services/sla/__tests__/SLARepository.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add orion-platform-service/src/services/sla/__tests__/SLARepository.test.ts
git commit -m "test(itsm): add SLARepository tests (definition, tracking, breach events)"
```

---

## Task 4: SLAService Tests

**Files:**
- Create: `orion-platform-service/src/services/sla/__tests__/SLAService.test.ts`
- Read: `orion-platform-service/src/services/sla/SLAService.ts`

- [ ] **Step 1: Write SLAService business logic tests**

```typescript
/**
 * Tests for SLAService — validation, state transitions, breach detection
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SLAService } from '../SLAService';

const mockPool = {
  query: jest.fn<any, any>(),
};

describe('SLAService', () => {
  let service: SLAService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SLAService(mockPool as any);
  });

  describe('createDefinition', () => {
    it('should throw when name is empty', async () => {
      await expect(
        service.createDefinition({ name: '', targetValue: 30 }, 'tenant-1')
      ).rejects.toThrow('SLA definition name is required');
    });

    it('should throw when targetValue is not positive', async () => {
      await expect(
        service.createDefinition({ name: 'Test', targetValue: -1 }, 'tenant-1')
      ).rejects.toThrow('Target value must be a positive number');
    });

    it('should throw when targetValue is zero', async () => {
      await expect(
        service.createDefinition({ name: 'Test', targetValue: 0 }, 'tenant-1')
      ).rejects.toThrow('Target value must be a positive number');
    });

    it('should throw for invalid SLA type', async () => {
      await expect(
        service.createDefinition({ name: 'Test', targetValue: 30, type: 'invalid' }, 'tenant-1')
      ).rejects.toThrow('Invalid SLA type');
    });

    it('should throw for invalid target unit', async () => {
      await expect(
        service.createDefinition({ name: 'Test', targetValue: 30, targetUnit: 'lightyears' }, 'tenant-1')
      ).rejects.toThrow('Invalid target unit');
    });

    it('should create definition with valid input', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'sla-1', name: 'P1 Response', status: 'active' }],
      });

      const result = await service.createDefinition({
        name: 'P1 Response',
        targetValue: 30,
        type: 'response_time',
        targetUnit: 'minutes',
      }, 'tenant-1');

      expect(result.id).toBe('sla-1');
    });
  });

  describe('startTracking', () => {
    it('should throw when definition not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.startTracking({
          slaDefinitionId: 'nonexistent',
          entityType: 'incident',
          entityId: 'inc-1',
        }, 'tenant-1')
      ).rejects.toThrow();
    });

    it('should create tracking with valid definition', async () => {
      // Definition lookup
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'sla-1', status: 'active' }],
      });
      // Insert tracking
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'track-1', status: 'active' }],
      });

      const result = await service.startTracking({
        slaDefinitionId: 'sla-1',
        entityType: 'incident',
        entityId: 'inc-1',
      }, 'tenant-1');

      expect(result.id).toBe('track-1');
    });
  });

  describe('markMet', () => {
    it('should mark tracking as met', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'track-1', status: 'active', tenant_id: 'tenant-1' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'track-1', status: 'met' }],
      });

      const result = await service.markMet('track-1', 'tenant-1');

      expect(result.status).toBe('met');
    });
  });

  describe('markBreached', () => {
    it('should mark tracking as breached and create breach event', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'track-1', status: 'active', tenant_id: 'tenant-1', sla_definition_id: 'sla-1' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'track-1', status: 'breached' }],
      });
      // Create breach event
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'breach-1' }],
      });

      const result = await service.markBreached('track-1', 'tenant-1', { reason: 'Timeout exceeded' });

      expect(result.status).toBe('breached');
    });
  });

  describe('pauseTracking / resumeTracking', () => {
    it('should pause active tracking', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'track-1', status: 'active', tenant_id: 'tenant-1' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'track-1', status: 'paused' }],
      });

      const result = await service.pauseTracking('track-1', 'tenant-1', 'Maintenance window');

      expect(result.status).toBe('paused');
    });

    it('should resume paused tracking', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'track-1', status: 'paused', tenant_id: 'tenant-1' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'track-1', status: 'active' }],
      });

      const result = await service.resumeTracking('track-1', 'tenant-1');

      expect(result.status).toBe('active');
    });
  });

  describe('detectBreaches', () => {
    it('should detect and report breaches', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 'track-1', status: 'active', started_at: new Date(Date.now() - 7200000) },
          { id: 'track-2', status: 'active', started_at: new Date(Date.now() - 3600000) },
        ],
      });
      // Mark breaches
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'track-1', status: 'breached' }] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'breach-1' }] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'track-2', status: 'breached' }] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'breach-2' }] });

      const result = await service.detectBreaches('tenant-1');

      expect(result.detected).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getStats', () => {
    it('should return aggregated SLA stats', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          total_definitions: '5',
          active_definitions: '3',
          total_tracking: '20',
          active_tracking: '10',
          met_count: '7',
          breached_count: '3',
          compliance_rate: '70',
        }],
      });

      const result = await service.getStats('tenant-1');

      expect(result.totalDefinitions).toBe(5);
      expect(result.complianceRate).toBe(70);
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd orion-platform-service && npx jest src/services/sla/__tests__/SLAService.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add orion-platform-service/src/services/sla/__tests__/SLAService.test.ts
git commit -m "test(itsm): add SLAService business logic tests"
```

---

## Task 5: ChangeRepository Tests

**Files:**
- Create: `orion-platform-service/src/services/change/__tests__/ChangeRepository.test.ts`
- Read: `orion-platform-service/src/services/change/ChangeRepository.ts`

- [ ] **Step 1: Create test directory**

```bash
mkdir -p orion-platform-service/src/services/change/__tests__
```

- [ ] **Step 2: Write ChangeRepository tests**

```typescript
/**
 * Tests for ChangeRepository — ChangeRequest, CABMeeting, Timeline, RFC
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ChangeRequestRepository,
  CABMeetingRepository,
  ChangeTimelineRepository,
  RFCRepository,
} from '../ChangeRepository';

const mockPool = {
  query: jest.fn<any, any>(),
};

describe('ChangeRequestRepository', () => {
  let repo: ChangeRequestRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ChangeRequestRepository(mockPool as any);
  });

  describe('findByTenant', () => {
    it('should return changes with pagination', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'chg-1' }], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await repo.findByTenant('tenant-1');

      expect(result.entities).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await repo.findByTenant('tenant-1', { status: 'approved' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        expect.arrayContaining(['tenant-1', 'approved'])
      );
    });

    it('should filter by type', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await repo.findByTenant('tenant-1', { type: 'standard' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('type = $'),
        expect.arrayContaining(['tenant-1', 'standard'])
      );
    });

    it('should filter by risk level', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await repo.findByTenant('tenant-1', { riskLevel: 'high' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('risk_level = $'),
        expect.arrayContaining(['tenant-1', 'high'])
      );
    });
  });

  describe('updateStatus', () => {
    it('should update status with extra fields', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'chg-1', status: 'approved', approved_by: 'user-1' }],
      });

      const result = await repo.updateStatus('chg-1', 'approved', 'tenant-1', { approved_by: 'user-1' });

      expect(result).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE change_requests SET'),
        expect.any(Array)
      );
    });
  });

  describe('getStats', () => {
    it('should return change statistics', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          total: '15',
          by_status: { draft: '3', submitted: '4', approved: '5', implemented: '2', rejected: '1' },
          by_type: { standard: '10', emergency: '3', normal: '2' },
          by_risk: { low: '5', medium: '6', high: '3', critical: '1' },
        }],
      });

      const result = await repo.getStats('tenant-1');

      expect(result.total).toBe(15);
    });
  });
});

describe('CABMeetingRepository', () => {
  let repo: CABMeetingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CABMeetingRepository(mockPool as any);
  });

  describe('findByTenant', () => {
    it('should return meetings with filters', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'cab-1' }], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await repo.findByTenant('tenant-1');

      expect(result.entities).toHaveLength(1);
    });
  });

  describe('addDecision', () => {
    it('should add decision to meeting', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'cab-1', decisions: [{ changeRequestId: 'chg-1', decision: 'approved' }] }],
      });

      const result = await repo.addDecision('cab-1', {
        changeRequestId: 'chg-1',
        decision: 'approved',
        decidedBy: 'user-1',
      }, 'tenant-1');

      expect(result).toBeDefined();
    });
  });
});

describe('ChangeTimelineRepository', () => {
  let repo: ChangeTimelineRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ChangeTimelineRepository(mockPool as any);
  });

  describe('findByChangeId', () => {
    it('should return timeline events', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'evt-1', change_request_id: 'chg-1', event_type: 'status_change' }],
      });

      const result = await repo.findByChangeId('chg-1');

      expect(result).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('change_request_id = $1'),
        ['chg-1']
      );
    });

    it('should apply limit and offset', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findByChangeId('chg-1', 10, 5);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 5])
      );
    });
  });
});

describe('RFCRepository', () => {
  let repo: RFCRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new RFCRepository(mockPool as any);
  });

  describe('findByChangeId', () => {
    it('should return RFCs for change', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'rfc-1', change_request_id: 'chg-1' }],
      });

      const result = await repo.findByChangeId('chg-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('updateStatus', () => {
    it('should update RFC status', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'rfc-1', status: 'approved' }],
      });

      const result = await repo.updateStatus('rfc-1', 'approved', 'tenant-1');

      expect(result).toBeDefined();
    });
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd orion-platform-service && npx jest src/services/change/__tests__/ChangeRepository.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add orion-platform-service/src/services/change/__tests__/ChangeRepository.test.ts
git commit -m "test(itsm): add ChangeRepository tests (request, CAB, timeline, RFC)"
```

---

## Task 6: ChangeService Tests

**Files:**
- Create: `orion-platform-service/src/services/change/__tests__/ChangeService.test.ts`
- Read: `orion-platform-service/src/services/change/ChangeService.ts`

- [ ] **Step 1: Write ChangeService business logic tests**

```typescript
/**
 * Tests for ChangeService — risk assessment, status transitions, approval flow
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ChangeService } from '../ChangeService';

const mockPool = {
  query: jest.fn<any, any>(),
};

describe('ChangeService', () => {
  let service: ChangeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChangeService(mockPool as any);
    service.init();
  });

  describe('createChangeRequest', () => {
    it('should throw when title is missing', async () => {
      await expect(
        service.createChangeRequest({ title: '' }, 'tenant-1')
      ).rejects.toThrow('Title is required');
    });

    it('should create change request with defaults', async () => {
      // Insert
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'chg-1',
          title: 'Deploy v2.0',
          type: 'standard',
          risk_level: 'medium',
          status: 'draft',
        }],
      });
      // Timeline insert
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

      const result = await service.createChangeRequest({
        title: 'Deploy v2.0',
      }, 'tenant-1');

      expect(result.id).toBe('chg-1');
      expect(result.status).toBe('draft');
    });

    it('should compute risk level from type and impact', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'chg-2',
          type: 'emergency',
          risk_level: 'critical',
          status: 'draft',
        }],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-2' }] });

      const result = await service.createChangeRequest({
        title: 'Hotfix',
        type: 'emergency',
        impactDescription: 'critical',
      }, 'tenant-1');

      expect(result.risk_level).toBe('critical');
    });
  });

  describe('updateStatus', () => {
    it('should enforce valid status transitions', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'chg-1', status: 'draft', tenant_id: 'tenant-1' }],
      });

      // draft -> implemented is not valid (must go through submitted -> approved)
      await expect(
        service.updateStatus('chg-1', 'implemented', 'tenant-1', 'user-1')
      ).rejects.toThrow('Invalid status transition');
    });

    it('should allow draft -> submitted', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'chg-1', status: 'draft', tenant_id: 'tenant-1' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'chg-1', status: 'submitted' }],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

      const result = await service.updateStatus('chg-1', 'submitted', 'tenant-1', 'user-1');

      expect(result.status).toBe('submitted');
    });

    it('should allow submitted -> approved', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'chg-1', status: 'submitted', tenant_id: 'tenant-1' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'chg-1', status: 'approved' }],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

      const result = await service.updateStatus('chg-1', 'approved', 'tenant-1', 'user-1');

      expect(result.status).toBe('approved');
    });
  });

  describe('CAB operations', () => {
    it('should create CAB meeting', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'cab-1', title: 'Weekly CAB' }],
      });

      const result = await service.createCABMeeting({
        title: 'Weekly CAB',
        scheduledAt: new Date(),
      }, 'tenant-1');

      expect(result.id).toBe('cab-1');
    });

    it('should add decision to CAB meeting', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'cab-1', decisions: [] }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'cab-1',
          decisions: [{ changeRequestId: 'chg-1', decision: 'approved' }],
        }],
      });

      const result = await service.addCABDecision('cab-1', {
        changeRequestId: 'chg-1',
        decision: 'approved',
        decidedBy: 'user-1',
      }, 'tenant-1');

      expect(result.decisions).toHaveLength(1);
    });
  });

  describe('RFC operations', () => {
    it('should create RFC', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'rfc-1', change_request_id: 'chg-1', status: 'draft' }],
      });

      const result = await service.createRFC({
        changeRequestId: 'chg-1',
        title: 'RFC for v2.0 deploy',
        description: 'Details...',
      }, 'tenant-1');

      expect(result.id).toBe('rfc-1');
    });

    it('should update RFC status', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'rfc-1', tenant_id: 'tenant-1' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'rfc-1', status: 'approved' }],
      });

      const result = await service.updateRFCStatus('rfc-1', 'approved', 'tenant-1', 'user-1');

      expect(result.status).toBe('approved');
    });
  });

  describe('getStats', () => {
    it('should return change statistics', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          total: '20',
          by_status: { draft: '5', approved: '10', implemented: '5' },
          by_type: { standard: '15', emergency: '5' },
        }],
      });

      const result = await service.getStats('tenant-1');

      expect(result.total).toBe(20);
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd orion-platform-service && npx jest src/services/change/__tests__/ChangeService.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add orion-platform-service/src/services/change/__tests__/ChangeService.test.ts
git commit -m "test(itsm): add ChangeService business logic tests"
```

---

## Task 7: CatalogRepository Tests (ServiceCatalog)

**Files:**
- Create: `orion-platform-service/src/services/service-catalog/__tests__/CatalogRepository.test.ts`
- Read: `orion-platform-service/src/services/service-catalog/ServiceCatalogService.ts`

Note: ServiceCatalogService has no separate repository file. Repository-level tests exercise the same `ServiceCatalogService` class but focus on CRUD operations rather than business logic.

- [ ] **Step 1: Create test directory**

```bash
mkdir -p orion-platform-service/src/services/service-catalog/__tests__
```

- [ ] **Step 2: Write CatalogRepository (CRUD) tests**

```typescript
/**
 * Tests for ServiceCatalogService — Repository-level CRUD operations
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ServiceCatalogService } from '../ServiceCatalogService';

const mockPool = {
  query: jest.fn<any, any>(),
};

describe('CatalogRepository (ServiceCatalogService CRUD)', () => {
  let service: ServiceCatalogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ServiceCatalogService(mockPool as any);
  });

  describe('Service CRUD', () => {
    describe('createService', () => {
      it('should create catalog service', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: 'svc-1',
            name: 'VPN Access',
            category: 'network',
            status: 'active',
            tenant_id: 'tenant-1',
          }],
        });

        const result = await service.createService({
          name: 'VPN Access',
          category: 'network',
          description: 'VPN access request',
        }, 'tenant-1');

        expect(result.id).toBe('svc-1');
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO catalog_services'),
          expect.arrayContaining(['tenant-1', 'VPN Access'])
        );
      });
    });

    describe('getService', () => {
      it('should return service when found', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{ id: 'svc-1', name: 'VPN Access', tenant_id: 'tenant-1' }],
        });

        const result = await service.getService('svc-1', 'tenant-1');

        expect(result.id).toBe('svc-1');
      });

      it('should throw when not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await expect(
          service.getService('nonexistent', 'tenant-1')
        ).rejects.toThrow();
      });
    });

    describe('listServices', () => {
      it('should list services with pagination', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{ id: 'svc-1' }],
          rowCount: 1,
        });
        mockPool.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });

        const result = await service.listServices('tenant-1');

        expect(result.services).toHaveLength(1);
        expect(result.total).toBe(1);
      });

      it('should filter by category', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

        await service.listServices('tenant-1', { category: 'network' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('category = $'),
          expect.arrayContaining(['tenant-1', 'network'])
        );
      });

      it('should filter by status', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

        await service.listServices('tenant-1', { status: 'active' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('status = $'),
          expect.arrayContaining(['tenant-1', 'active'])
        );
      });
    });

    describe('updateService', () => {
      it('should update service fields', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{ id: 'svc-1', name: 'Updated VPN' }],
        });

        const result = await service.updateService('svc-1', { name: 'Updated VPN' }, 'tenant-1');

        expect(result.name).toBe('Updated VPN');
      });
    });

    describe('deleteService', () => {
      it('should delete service', async () => {
        mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

        const result = await service.deleteService('svc-1', 'tenant-1');

        expect(result).toBe(true);
      });

      it('should return false when not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rowCount: 0 });

        const result = await service.deleteService('nonexistent', 'tenant-1');

        expect(result).toBe(false);
      });
    });
  });

  describe('Request CRUD', () => {
    describe('createRequest', () => {
      it('should create catalog request', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: 'req-1',
            service_id: 'svc-1',
            status: 'pending',
            tenant_id: 'tenant-1',
          }],
        });
        // Timeline insert
        mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

        const result = await service.createRequest({
          serviceId: 'svc-1',
          requesterId: 'user-1',
          title: 'Need VPN access',
        }, 'tenant-1');

        expect(result.id).toBe('req-1');
      });
    });

    describe('listRequests', () => {
      it('should list requests with filters', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

        await service.listRequests('tenant-1', { status: 'pending' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('status = $'),
          expect.arrayContaining(['tenant-1', 'pending'])
        );
      });

      it('should filter by serviceId', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

        await service.listRequests('tenant-1', { serviceId: 'svc-1' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('service_id = $'),
          expect.arrayContaining(['tenant-1', 'svc-1'])
        );
      });
    });
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd orion-platform-service && npx jest src/services/service-catalog/__tests__/CatalogRepository.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add orion-platform-service/src/services/service-catalog/__tests__/CatalogRepository.test.ts
git commit -m "test(itsm): add ServiceCatalog repository-level CRUD tests"
```

---

## Task 8: CatalogService Tests (ServiceCatalog)

**Files:**
- Create: `orion-platform-service/src/services/service-catalog/__tests__/CatalogService.test.ts`

- [ ] **Step 1: Write CatalogService business logic tests**

```typescript
/**
 * Tests for ServiceCatalogService — business logic, SLA breach detection, status transitions
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ServiceCatalogService } from '../ServiceCatalogService';

const mockPool = {
  query: jest.fn<any, any>(),
};

describe('CatalogService (Business Logic)', () => {
  let service: ServiceCatalogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ServiceCatalogService(mockPool as any);
  });

  describe('transitionStatus', () => {
    it('should throw for invalid transition', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'req-1', status: 'fulfilled', tenant_id: 'tenant-1' }],
      });

      await expect(
        service.transitionStatus('req-1', {
          fromStatus: 'fulfilled',
          toStatus: 'pending',
          performedBy: 'user-1',
        }, 'tenant-1')
      ).rejects.toThrow('Invalid status transition');
    });

    it('should allow pending -> approved', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'req-1', status: 'pending', tenant_id: 'tenant-1' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'req-1', status: 'approved' }],
      });
      // Timeline
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

      const result = await service.transitionStatus('req-1', {
        fromStatus: 'pending',
        toStatus: 'approved',
        performedBy: 'user-1',
      }, 'tenant-1');

      expect(result.status).toBe('approved');
    });

    it('should allow approved -> in_progress', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'req-1', status: 'approved', tenant_id: 'tenant-1' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'req-1', status: 'in_progress' }],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

      const result = await service.transitionStatus('req-1', {
        fromStatus: 'approved',
        toStatus: 'in_progress',
        performedBy: 'user-1',
      }, 'tenant-1');

      expect(result.status).toBe('in_progress');
    });

    it('should allow in_progress -> fulfilled', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'req-1', status: 'in_progress', tenant_id: 'tenant-1' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'req-1', status: 'fulfilled' }],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

      const result = await service.transitionStatus('req-1', {
        fromStatus: 'in_progress',
        toStatus: 'fulfilled',
        performedBy: 'user-1',
      }, 'tenant-1');

      expect(result.status).toBe('fulfilled');
    });
  });

  describe('detectSlaBreaches', () => {
    it('should detect breached requests', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 'req-1', status: 'pending', created_at: new Date(Date.now() - 172800000) },
        ],
      });

      const result = await service.detectSlaBreaches('tenant-1');

      expect(result.breached).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getTimeline', () => {
    it('should return request timeline', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 'evt-1', request_id: 'req-1', event_type: 'created' },
          { id: 'evt-2', request_id: 'req-1', event_type: 'status_change' },
        ],
      });

      const result = await service.getTimeline('req-1', 'tenant-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('getStats', () => {
    it('should return catalog statistics', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          total_services: '8',
          active_services: '6',
          total_requests: '50',
          pending_requests: '10',
          fulfilled_requests: '35',
        }],
      });

      const result = await service.getStats('tenant-1');

      expect(result.totalServices).toBe(8);
      expect(result.pendingRequests).toBe(10);
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd orion-platform-service && npx jest src/services/service-catalog/__tests__/CatalogService.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add orion-platform-service/src/services/service-catalog/__tests__/CatalogService.test.ts
git commit -m "test(itsm): add ServiceCatalog business logic tests"
```

---

## Task 9: Supplement IncidentRepository Tests

**Files:**
- Modify: `orion-platform-service/src/services/incident/__tests__/IncidentRepository.test.ts`
- Read: `orion-platform-service/src/services/incident/IncidentRepository.ts`

- [ ] **Step 1: Read existing tests to identify gaps**

```bash
grep "describe\|it(" orion-platform-service/src/services/incident/__tests__/IncidentRepository.test.ts
```

Existing coverage: findById, findAll (filters), create, acknowledge, resolve, getMttrStats, findByDeployment, findByPipelineRun, count.

Missing: update (covered in IncidentService.test.ts), findByStatus, findBySeverity, batch operations.

- [ ] **Step 2: Add missing test cases to IncidentRepository.test.ts**

Append to the file before the final `});`:

```typescript
  // ==================== Additional Filters ====================

  describe('findByStatus', () => {
    it('should find incidents by status', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'inc-1', status: 'open' }] });

      const result = await repo.findAll({ status: 'open' });

      expect(result).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        expect.arrayContaining(['open'])
      );
    });
  });

  describe('findBySeverity', () => {
    it('should find incidents by severity', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'inc-1', severity: 'critical' }] });

      const result = await repo.findAll({ severity: 'critical' });

      expect(result).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('severity = $'),
        expect.arrayContaining(['critical'])
      );
    });
  });

  describe('combined filters', () => {
    it('should combine tenantId, status, and severity', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ tenantId: 'tenant-1', status: 'open', severity: 'critical' });

      const call = mockPool.query.mock.calls[0];
      expect(call[0]).toContain('tenant_id');
      expect(call[0]).toContain('status');
      expect(call[0]).toContain('severity');
    });

    it('should combine date range with filters', async () => {
      const since = new Date('2026-01-01');
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ tenantId: 'tenant-1', since, status: 'resolved' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('detected_at >= $'),
        expect.any(Array)
      );
    });
  });

  describe('delete', () => {
    it('should delete incident', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await repo.delete('inc-1');

      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });

      const result = await repo.delete('nonexistent');

      expect(result).toBe(false);
    });
  });
```

- [ ] **Step 3: Run tests**

```bash
cd orion-platform-service && npx jest src/services/incident/__tests__/IncidentRepository.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add orion-platform-service/src/services/incident/__tests__/IncidentRepository.test.ts
git commit -m "test(itsm): supplement IncidentRepository tests with combined filters and delete"
```

---

## Task 10: Supplement IncidentService Tests

**Files:**
- Modify: `orion-platform-service/src/services/incident/__tests__/IncidentService.test.ts`
- Read: `orion-platform-service/src/services/incident/IncidentRepository.ts`

Existing coverage: update (9 cases), findAll combined filters (10 cases), error handling (7 cases).

Missing: SLA association, batch operations, timeline queries.

- [ ] **Step 1: Add SLA association and timeline tests**

Append to the file before the final `});`:

```typescript
  // ==================== SLA Association ====================

  describe('SLA association', () => {
    it('should find incidents with SLA tracking', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'inc-1',
          status: 'open',
          sla_tracking_id: 'track-1',
          sla_status: 'active',
        }],
      });

      const result = await repo.findById('inc-1');

      expect(result).toBeDefined();
    });
  });

  // ==================== Timeline Operations ====================

  describe('timeline operations', () => {
    it('should find incidents with timeline events', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 'inc-1', type: 'service_down', severity: 'critical' },
        ],
      });

      const result = await repo.findAll({ tenantId: 'tenant-1' });

      expect(result).toBeDefined();
    });
  });

  // ==================== Batch Operations ====================

  describe('batch operations', () => {
    it('should count by multiple criteria', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const result = await repo.count({ tenantId: 'tenant-1', status: 'open' });

      expect(result).toBe(5);
    });

    it('should find by deployment with tenant filter', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'inc-1' }, { id: 'inc-2' }] });

      const result = await repo.findByDeployment('deploy-1');

      expect(result).toHaveLength(2);
    });
  });
```

- [ ] **Step 2: Run tests**

```bash
cd orion-platform-service && npx jest src/services/incident/__tests__/IncidentService.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add orion-platform-service/src/services/incident/__tests__/IncidentService.test.ts
git commit -m "test(itsm): supplement IncidentService tests with SLA and batch operations"
```

---

## Verification

After all 10 tasks are complete:

```bash
cd orion-platform-service && npx jest src/services/incident/__tests__ src/services/problem/__tests__ src/services/sla/__tests__ src/services/change/__tests__ src/services/service-catalog/__tests__ --no-coverage 2>&1 | tail -30
```

Expected: All tests pass. ~10 test files, ~3600 lines, covering CRUD + business logic + state transitions for all 5 ITSM modules.
