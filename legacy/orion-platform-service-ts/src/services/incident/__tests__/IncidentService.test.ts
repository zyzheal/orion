/**
 * Comprehensive tests for IncidentService / IncidentRepository
 *
 * Covers: update (untested in existing file), combined filters,
 * error handling, edge cases, and boundary conditions.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { IncidentRepository, CreateIncidentInput, UpdateIncidentInput } from '../IncidentRepository';

const mockPool = {
  query: jest.fn<any, any>(),
};

describe('IncidentService (IncidentRepository - Comprehensive)', () => {
  let repo: IncidentRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new IncidentRepository(mockPool as any);
  });

  // ==================== Update Operations (NEW - untested) ====================

  describe('update', () => {
    it('should update status only', async () => {
      const mockResult = { id: 'inc-1', status: 'acknowledged' };
      mockPool.query.mockResolvedValueOnce({ rows: [mockResult] });

      const result = await repo.update('inc-1', { status: 'acknowledged' });

      expect(result).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE incidents SET'),
        expect.arrayContaining(['acknowledged', 'inc-1'])
      );
    });

    it('should update acknowledged_at', async () => {
      const ackDate = new Date('2026-06-01T10:00:00Z');
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'inc-1', acknowledged_at: ackDate }] });

      await repo.update('inc-1', { acknowledged_at: ackDate });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('acknowledged_at'),
        expect.arrayContaining([ackDate, 'inc-1'])
      );
    });

    it('should update resolved_at and auto-calculate recovery_time_ms', async () => {
      const resolvedDate = new Date('2026-06-01T11:00:00Z');
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'inc-1', resolved_at: resolvedDate, recovery_time_ms: 3600000 }] });

      await repo.update('inc-1', { resolved_at: resolvedDate });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('recovery_time_ms = EXTRACT(EPOCH FROM'),
        expect.arrayContaining([resolvedDate, 'inc-1'])
      );
    });

    it('should update error_message', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'inc-1', error_message: 'Connection refused' }] });

      await repo.update('inc-1', { error_message: 'Connection refused' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('error_message'),
        expect.arrayContaining(['Connection refused', 'inc-1'])
      );
    });

    it('should update multiple fields at once', async () => {
      const resolvedDate = new Date('2026-06-01T11:00:00Z');
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'inc-1', status: 'resolved', resolved_at: resolvedDate, error_message: 'Fixed' }],
      });

      await repo.update('inc-1', {
        status: 'resolved',
        resolved_at: resolvedDate,
        error_message: 'Fixed',
      });

      const call = mockPool.query.mock.calls[0];
      expect(call[0]).toContain('status');
      expect(call[0]).toContain('resolved_at');
      expect(call[0]).toContain('error_message');
      expect(call[0]).toContain('recovery_time_ms');
    });

    it('should return incident by findById when no fields to update', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'inc-1', status: 'open' }] });

      const result = await repo.update('inc-1', {});

      expect(result).toEqual({ id: 'inc-1', status: 'open' });
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM incidents WHERE id = $1',
        ['inc-1']
      );
    });

    it('should return null when update matches no rows', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.update('nonexistent', { status: 'resolved' });

      expect(result).toBeNull();
    });

    it('should include RETURNING * in update query', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'inc-1' }] });

      await repo.update('inc-1', { status: 'acknowledged' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING *'),
        expect.any(Array)
      );
    });

    it('should build correct parameterized query with sequential indices', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{}] });

      await repo.update('inc-99', {
        status: 'resolved',
        error_message: 'timeout',
      });

      const query = mockPool.query.mock.calls[0][0] as string;
      expect(query).toContain('$1');
      expect(query).toContain('$2');
      expect(query).toContain('$3');
      expect(query).toContain('WHERE id = $');
    });
  });

  // ==================== findAll Combined Filters ====================

  describe('findAll with combined filters', () => {
    it('should combine tenantId and status', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ tenantId: 'tenant-1', status: 'open' });

      const query = mockPool.query.mock.calls[0][0] as string;
      expect(query).toContain('tenant_id = $1');
      expect(query).toContain('status = $2');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['tenant-1', 'open']
      );
    });

    it('should combine tenantId, status, and severity', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ tenantId: 'tenant-1', status: 'open', severity: 'critical' });

      const query = mockPool.query.mock.calls[0][0] as string;
      expect(query).toContain('tenant_id = $1');
      expect(query).toContain('status = $2');
      expect(query).toContain('severity = $3');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['tenant-1', 'open', 'critical']
      );
    });

    it('should combine all filters together', async () => {
      const since = new Date('2026-01-01');
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({
        tenantId: 'tenant-1',
        deploymentId: 'deploy-1',
        pipelineRunId: 'run-1',
        status: 'resolved',
        severity: 'high',
        since,
        limit: 10,
        offset: 20,
      });

      const query = mockPool.query.mock.calls[0][0] as string;
      const params = mockPool.query.mock.calls[0][1] as any[];
      expect(query).toContain('WHERE');
      expect(query).toContain('AND');
      expect(query).toContain('LIMIT');
      expect(query).toContain('OFFSET');
      expect(params).toEqual(['tenant-1', 'deploy-1', 'run-1', 'resolved', 'high', since, 10, 20]);
    });

    it('should filter by deploymentId only', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ deploymentId: 'deploy-abc' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('deployment_id = $1'),
        ['deploy-abc']
      );
    });

    it('should filter by pipelineRunId only', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ pipelineRunId: 'run-xyz' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('pipeline_run_id = $1'),
        ['run-xyz']
      );
    });

    it('should apply offset without limit', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ offset: 5 });

      const query = mockPool.query.mock.calls[0][0] as string;
      expect(query).not.toContain('LIMIT');
      expect(query).toContain('OFFSET');
    });

    it('should apply limit without offset', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ limit: 10 });

      const query = mockPool.query.mock.calls[0][0] as string;
      expect(query).toContain('LIMIT');
      expect(query).not.toContain('OFFSET');
    });

    it('should always include ORDER BY detected_at DESC', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({});

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY detected_at DESC'),
        expect.any(Array)
      );
    });

    it('should use SELECT * FROM incidents as base', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM incidents'),
        expect.any(Array)
      );
    });
  });

  // ==================== Error Handling ====================

  describe('error handling', () => {
    it('should propagate database errors from findById', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(repo.findById('inc-1')).rejects.toThrow('Connection refused');
    });

    it('should propagate database errors from create', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Unique constraint violation'));

      await expect(repo.create({
        tenant_id: 'tenant-1',
        type: 'service_down',
        severity: 'critical',
      })).rejects.toThrow('Unique constraint violation');
    });

    it('should propagate database errors from update', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Timeout'));

      await expect(repo.update('inc-1', { status: 'resolved' })).rejects.toThrow('Timeout');
    });

    it('should propagate database errors from acknowledge', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Deadlock detected'));

      await expect(repo.acknowledge('inc-1')).rejects.toThrow('Deadlock detected');
    });

    it('should propagate database errors from resolve', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Serialization failure'));

      await expect(repo.resolve('inc-1')).rejects.toThrow('Serialization failure');
    });

    it('should propagate database errors from getMttrStats', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Query timeout'));

      await expect(repo.getMttrStats()).rejects.toThrow('Query timeout');
    });

    it('should propagate database errors from count', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Table does not exist'));

      await expect(repo.count()).rejects.toThrow('Table does not exist');
    });

    it('should propagate database errors from findAll', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(repo.findAll({ tenantId: 'tenant-1' })).rejects.toThrow('Permission denied');
    });
  });

  // ==================== Edge Cases ====================

  describe('edge cases', () => {
    it('should handle findById returning undefined row', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.findById('no-such-id');

      expect(result).toBeNull();
    });

    it('should handle acknowledge returning null when incident not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.acknowledge('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle resolve returning null when incident not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.resolve('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle findAll with empty result', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.findAll({ tenantId: 'empty-tenant' });

      expect(result).toEqual([]);
    });

    it('should handle count returning zero', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await repo.count({ tenantId: 'tenant-1' });

      expect(result).toBe(0);
    });

    it('should handle create with all optional fields undefined', async () => {
      const input: CreateIncidentInput = {
        tenant_id: 'tenant-1',
        type: 'other',
        severity: 'low',
      };
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'new-inc' }] });

      const result = await repo.create(input);

      const params = mockPool.query.mock.calls[0][1] as any[];
      // deployment_id, pipeline_run_id, commit_sha, service, environment, error_message should be null
      expect(params[1]).toBeNull(); // deployment_id
      expect(params[2]).toBeNull(); // pipeline_run_id
      expect(params[3]).toBeNull(); // commit_sha
      expect(params[6]).toBeNull(); // service
      expect(params[7]).toBeNull(); // environment
      expect(params[8]).toBeNull(); // error_message
    });

    it('should handle create with all optional fields provided', async () => {
      const input: CreateIncidentInput = {
        tenant_id: 'tenant-1',
        deployment_id: 'deploy-1',
        pipeline_run_id: 'run-1',
        commit_sha: 'abc123',
        type: 'service_down',
        severity: 'critical',
        service: 'api-gateway',
        environment: 'production',
        error_message: 'Connection timeout',
      };
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'new-inc', ...input }] });

      await repo.create(input);

      const params = mockPool.query.mock.calls[0][1] as any[];
      expect(params[0]).toBe('tenant-1');
      expect(params[1]).toBe('deploy-1');
      expect(params[2]).toBe('run-1');
      expect(params[3]).toBe('abc123');
      expect(params[4]).toBe('service_down');
      expect(params[5]).toBe('critical');
      expect(params[6]).toBe('api-gateway');
      expect(params[7]).toBe('production');
      expect(params[8]).toBe('Connection timeout');
    });

    it('should use empty string as falsy for optional fields in create', async () => {
      const input: CreateIncidentInput = {
        tenant_id: 'tenant-1',
        deployment_id: '',
        pipeline_run_id: '',
        type: 'error_rate_spike',
        severity: 'medium',
        service: '',
      };
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'new-inc' }] });

      await repo.create(input);

      // Empty strings are falsy, so they should be converted to null
      const params = mockPool.query.mock.calls[0][1] as any[];
      expect(params[1]).toBeNull(); // deployment_id = '' || null
      expect(params[2]).toBeNull(); // pipeline_run_id = '' || null
    });

    it('should handle getMttrStats with zero resolved incidents', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          total_incidents: '5',
          resolved_incidents: '0',
          avg_recovery_time_ms: null,
          median_recovery_time_ms: null,
          p90_recovery_time_ms: null,
          p99_recovery_time_ms: null,
        }],
      });

      const result = await repo.getMttrStats('tenant-1');

      expect(result.totalIncidents).toBe(5);
      expect(result.resolvedIncidents).toBe(0);
      expect(result.avgRecoveryTimeMs).toBe(0);
      expect(result.medianRecoveryTimeMs).toBe(0);
    });

    it('should handle getMttrStats with both tenantId and since', async () => {
      const since = new Date('2026-01-01');
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          total_incidents: '3',
          resolved_incidents: '2',
          avg_recovery_time_ms: '1500000',
          median_recovery_time_ms: '1200000',
          p90_recovery_time_ms: '1800000',
          p99_recovery_time_ms: '2000000',
        }],
      });

      await repo.getMttrStats('tenant-1', since);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['tenant-1', since]
      );
    });

    it('should handle count with both tenantId and status combined', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });

      const result = await repo.count({ tenantId: 'tenant-1', status: 'open' });

      expect(result).toBe(2);
      const query = mockPool.query.mock.calls[0][0] as string;
      expect(query).toContain('tenant_id = $1');
      expect(query).toContain('status = $2');
    });

    it('should handle count with no options', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '100' }] });

      const result = await repo.count();

      expect(result).toBe(100);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        []
      );
    });

    it('should handle large count values', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '999999' }] });

      const result = await repo.count();

      expect(result).toBe(999999);
    });

    it('should handle findByDeployment returning multiple incidents', async () => {
      const incidents = [
        { id: 'inc-1', deployment_id: 'deploy-1' },
        { id: 'inc-2', deployment_id: 'deploy-1' },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: incidents });

      const result = await repo.findByDeployment('deploy-1');

      expect(result).toHaveLength(2);
    });

    it('should handle findByPipelineRun returning empty', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.findByPipelineRun('run-nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ==================== Query Construction ====================

  describe('query construction', () => {
    it('should build WHERE clause with correct parameter indices for multiple conditions', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({
        tenantId: 'tenant-1',
        status: 'open',
        severity: 'critical',
        since: new Date('2026-01-01'),
      });

      const query = mockPool.query.mock.calls[0][0] as string;
      // Should have $1, $2, $3, $4 for the four conditions
      expect(query).toContain('$1');
      expect(query).toContain('$2');
      expect(query).toContain('$3');
      expect(query).toContain('$4');
    });

    it('should use AND to join multiple conditions', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ tenantId: 'tenant-1', status: 'open' });

      const query = mockPool.query.mock.calls[0][0] as string;
      expect(query).toContain(' WHERE ');
      expect(query).toContain(' AND ');
    });

    it('should not include WHERE when no filters', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll();

      const query = mockPool.query.mock.calls[0][0] as string;
      expect(query).not.toContain('WHERE');
    });

    it('should include INSERT INTO with correct column order', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'new' }] });

      await repo.create({
        tenant_id: 't1',
        type: 'service_down',
        severity: 'critical',
      });

      const query = mockPool.query.mock.calls[0][0] as string;
      expect(query).toContain('INSERT INTO incidents');
      expect(query).toContain('tenant_id');
      expect(query).toContain('deployment_id');
      expect(query).toContain('pipeline_run_id');
      expect(query).toContain('commit_sha');
      expect(query).toContain('type');
      expect(query).toContain('severity');
      expect(query).toContain('service');
      expect(query).toContain('environment');
      expect(query).toContain('error_message');
      expect(query).toContain("VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, $9)");
      expect(query).toContain('RETURNING *');
    });

    it('should set default status to open on create', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'new', status: 'open' }] });

      await repo.create({
        tenant_id: 't1',
        type: 'other',
        severity: 'low',
      });

      const query = mockPool.query.mock.calls[0][0] as string;
      expect(query).toContain("'open'");
    });
  });

  // ==================== acknowledge and resolve specifics ====================

  describe('acknowledge', () => {
    it('should set acknowledged_at to NOW()', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'inc-1', status: 'acknowledged', acknowledged_at: new Date() }],
      });

      await repo.acknowledge('inc-1');

      const query = mockPool.query.mock.calls[0][0] as string;
      expect(query).toContain("status = 'acknowledged'");
      expect(query).toContain('acknowledged_at = NOW()');
    });

    it('should use RETURNING *', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'inc-1' }] });

      await repo.acknowledge('inc-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING *'),
        expect.any(Array)
      );
    });
  });

  describe('resolve', () => {
    it('should set status to resolved and resolved_at to NOW()', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'inc-1', status: 'resolved', resolved_at: new Date() }],
      });

      await repo.resolve('inc-1');

      const query = mockPool.query.mock.calls[0][0] as string;
      expect(query).toContain("status = 'resolved'");
      expect(query).toContain('resolved_at = NOW()');
    });

    it('should auto-calculate recovery_time_ms', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'inc-1', recovery_time_ms: 7200000 }],
      });

      await repo.resolve('inc-1');

      const query = mockPool.query.mock.calls[0][0] as string;
      expect(query).toContain('recovery_time_ms = EXTRACT(EPOCH FROM (NOW() - detected_at))');
    });

    it('should use RETURNING *', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'inc-1' }] });

      await repo.resolve('inc-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING *'),
        ['inc-1']
      );
    });
  });
});
