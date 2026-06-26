/**
 * DiagnosticRepository - Database layer unit tests
 *
 * Tests CRUD operations for diagnostic sessions, rules queries,
 * and row-to-domain mapping.
 */

import { DiagnosticRepository, DiagnosticRule } from '../DiagnosticRepository';
import { DiagnosticSession, Symptom, Finding, RootCause } from '../types';

describe('DiagnosticRepository', () => {
  let repo: DiagnosticRepository;
  let mockPool: any;

  const mockSymptom: Symptom = {
    type: 'high_cpu',
    source: 'web-server',
    description: 'CPU usage > 90%',
    severity: 'critical',
    timestamp: new Date('2026-01-15T10:00:00Z'),
  };

  const mockFinding: Finding = {
    description: 'Memory leak detected in service X',
    category: 'application',
    evidence: ['heap dump analysis', 'memory growth pattern'],
    severity: 'error',
    relatedSymptoms: ['high_memory'],
  };

  const mockSession: DiagnosticSession = {
    id: 'sess-1',
    triggerType: 'incident',
    triggerId: 'inc-001',
    symptoms: [mockSymptom],
    findings: [mockFinding],
    rootCause: null,
    confidence: 0,
    status: 'running',
    createdAt: new Date('2026-01-15T10:00:00Z'),
    tenantId: 'tenant-1',
  };

  const mockDbRow = {
    id: 'sess-1',
    tenant_id: 'tenant-1',
    title: 'incident: inc-001',
    status: 'running',
    triggered_by: null,
    target_type: 'incident',
    target_id: 'inc-001',
    symptoms: [mockSymptom],
    findings: [mockFinding],
    started_at: '2026-01-15T10:00:00.000Z',
    completed_at: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = { query: jest.fn() };
    repo = new DiagnosticRepository(mockPool);
  });

  // ==================== createSession ====================

  describe('createSession', () => {
    it('should insert a diagnostic session into the database', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.createSession(mockSession);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO diagnostic_sessions'),
        expect.arrayContaining([
          'sess-1',
          'tenant-1',
          'incident: inc-001',
          'running',
        ])
      );
    });

    it('should default tenant_id to system tenant when not provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const sessionNoTenant = { ...mockSession, tenantId: undefined };

      await repo.createSession(sessionNoTenant);

      const params = mockPool.query.mock.calls[0][1];
      expect(params[1]).toBe('__system__');
    });

    it('should JSON.stringify symptoms and findings', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.createSession(mockSession);

      const params = mockPool.query.mock.calls[0][1];
      expect(typeof params[7]).toBe('string'); // symptoms
      expect(typeof params[8]).toBe('string'); // findings
      // Note: JSON.stringify converts Date to string, so we verify structure
      const parsedSymptoms = JSON.parse(params[7]);
      const parsedFindings = JSON.parse(params[8]);
      expect(parsedSymptoms).toHaveLength(1);
      expect(parsedSymptoms[0].type).toBe('high_cpu');
      expect(parsedSymptoms[0].severity).toBe('critical');
      expect(parsedFindings).toHaveLength(1);
      expect(parsedFindings[0].category).toBe('application');
    });

    it('should handle session with empty symptoms and findings', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const emptySession = { ...mockSession, symptoms: [], findings: [] };

      await repo.createSession(emptySession);

      const params = mockPool.query.mock.calls[0][1];
      expect(JSON.parse(params[7])).toEqual([]);
      expect(JSON.parse(params[8])).toEqual([]);
    });
  });

  // ==================== completeSession ====================

  describe('completeSession', () => {
    it('should update session status to completed', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.completeSession('sess-1', null, 85, [mockFinding]);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'completed'"),
        expect.arrayContaining(['sess-1'])
      );
    });

    it('should serialize findings as JSON', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.completeSession('sess-1', null, 85, [mockFinding]);

      const params = mockPool.query.mock.calls[0][1];
      expect(typeof params[0]).toBe('string');
      expect(JSON.parse(params[0])).toEqual([mockFinding]);
    });

    it('should handle empty findings array', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.completeSession('sess-1', null, 0, []);

      const params = mockPool.query.mock.calls[0][1];
      expect(JSON.parse(params[0])).toEqual([]);
    });
  });

  // ==================== getSession ====================

  describe('getSession', () => {
    it('should return mapped session when found', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDbRow] });

      const result = await repo.getSession('sess-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('sess-1');
      expect(result!.triggerType).toBe('incident');
      expect(result!.triggerId).toBe('inc-001');
      expect(result!.status).toBe('running');
      expect(result!.tenantId).toBe('tenant-1');
    });

    it('should return null when session not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.getSession('missing');
      expect(result).toBeNull();
    });

    it('should map symptoms and findings from DB row', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDbRow] });

      const result = await repo.getSession('sess-1');

      expect(result!.symptoms).toEqual([mockSymptom]);
      expect(result!.findings).toEqual([mockFinding]);
    });

    it('should handle row with null symptoms/findings gracefully', async () => {
      const rowWithNulls = { ...mockDbRow, symptoms: null, findings: null };
      mockPool.query.mockResolvedValue({ rows: [rowWithNulls] });

      const result = await repo.getSession('sess-1');

      expect(result!.symptoms).toEqual([]);
      expect(result!.findings).toEqual([]);
    });

    it('should set rootCause to null and confidence to 0', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDbRow] });

      const result = await repo.getSession('sess-1');

      expect(result!.rootCause).toBeNull();
      expect(result!.confidence).toBe(0);
    });

    it('should parse completed_at when present', async () => {
      const completedRow = {
        ...mockDbRow,
        completed_at: '2026-01-15T11:00:00.000Z',
      };
      mockPool.query.mockResolvedValue({ rows: [completedRow] });

      const result = await repo.getSession('sess-1');

      expect(result!.completedAt).toBeInstanceOf(Date);
    });

    it('should set completedAt to undefined when null', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDbRow] });

      const result = await repo.getSession('sess-1');

      expect(result!.completedAt).toBeUndefined();
    });

    it('should include title in metadata', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDbRow] });

      const result = await repo.getSession('sess-1');

      expect(result!.metadata).toBeDefined();
      expect(result!.metadata!.title).toBe('incident: inc-001');
    });

    it('should default triggerType and targetId when missing', async () => {
      const rowNoTarget = { ...mockDbRow, target_type: null, target_id: null };
      mockPool.query.mockResolvedValue({ rows: [rowNoTarget] });

      const result = await repo.getSession('sess-1');

      expect(result!.triggerType).toBe('manual');
      expect(result!.triggerId).toBe('sess-1');
    });
  });

  // ==================== getSessions ====================

  describe('getSessions', () => {
    it('should return sessions for a tenant', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDbRow, { ...mockDbRow, id: 'sess-2' }] });

      const result = await repo.getSessions('tenant-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('sess-1');
      expect(result[1].id).toBe('sess-2');
    });

    it('should use default limit of 20', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.getSessions('tenant-1');

      const params = mockPool.query.mock.calls[0][1];
      expect(params[1]).toBe(20);
    });

    it('should accept custom limit', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.getSessions('tenant-1', 50);

      const params = mockPool.query.mock.calls[0][1];
      expect(params[1]).toBe(50);
    });

    it('should return empty array when no sessions exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.getSessions('empty-tenant');
      expect(result).toEqual([]);
    });

    it('should order by started_at DESC', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.getSessions('tenant-1');

      const query = mockPool.query.mock.calls[0][0];
      expect(query).toContain('ORDER BY started_at DESC');
    });
  });

  // ==================== findRules ====================

  describe('findRules', () => {
    const mockRule: DiagnosticRule = {
      id: 'rule-1',
      name: 'High CPU Check',
      category: 'infrastructure',
      description: 'Checks for high CPU usage',
      script: 'cpu_usage > 90',
      enabled: true,
    };

    it('should return all rules when no category specified', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockRule] });

      const result = await repo.findRules();

      expect(result).toEqual([mockRule]);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM diagnostic_rules', []);
    });

    it('should filter by category when provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockRule] });

      const result = await repo.findRules('infrastructure');

      expect(result).toEqual([mockRule]);
      const query = mockPool.query.mock.calls[0][0];
      expect(query).toContain('WHERE category = $1');
      expect(mockPool.query.mock.calls[0][1]).toEqual(['infrastructure']);
    });

    it('should return empty array when no rules match', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findRules('nonexistent');
      expect(result).toEqual([]);
    });
  });
});
