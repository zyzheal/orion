/**
 * Tests for IncidentRepository
 *
 * Unit tests for incident CRUD operations and MTTR statistics
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { IncidentRepository } from '../IncidentRepository';

// Mock database pool
const mockPool = {
  query: jest.fn<any, any>(),
};

describe('IncidentRepository', () => {
  let repo: IncidentRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new IncidentRepository(mockPool as any);
  });

  // ==================== Find Operations ====================

  describe('findById', () => {
    it('should return incident when found', async () => {
      const mockIncident = {
        id: 'inc-123',
        tenant_id: 'tenant-1',
        type: 'service_down',
        severity: 'critical',
        status: 'open',
        detected_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockIncident] });

      const result = await repo.findById('inc-123');

      expect(result).toEqual(mockIncident);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM incidents WHERE id = $1',
        ['inc-123']
      );
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.findById('inc-nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all incidents without filters', async () => {
      const mockIncidents = [
        { id: 'inc-1', status: 'open' },
        { id: 'inc-2', status: 'resolved' },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockIncidents });

      const result = await repo.findAll();

      expect(result).toEqual(mockIncidents);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM incidents ORDER BY detected_at DESC',
        []
      );
    });

    it('should filter by tenantId', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ tenantId: 'tenant-1' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['tenant-1']
      );
    });

    it('should filter by status', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ status: 'resolved' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        ['resolved']
      );
    });

    it('should filter by since date', async () => {
      const since = new Date('2024-01-01');
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ since });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('detected_at >= $'),
        [since]
      );
    });

    it('should apply limit and offset', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ limit: 10, offset: 5 });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $'),
        expect.arrayContaining([10, 5])
      );
    });
  });

  // ==================== Create Operations ====================

  describe('create', () => {
    it('should create incident with all fields', async () => {
      const input = {
        tenant_id: 'tenant-1',
        deployment_id: 'deploy-1',
        type: 'service_down',
        severity: 'critical',
        service: 'api-gateway',
        environment: 'production',
      };

      const mockResult = {
        id: 'inc-new',
        ...input,
        status: 'open',
        detected_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockResult] });

      const result = await repo.create(input);

      expect(result).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO incidents'),
        expect.arrayContaining([
          'tenant-1',
          'deploy-1',
          null, // pipeline_run_id
          null, // commit_sha
          'service_down',
          'critical',
          'api-gateway',
          'production',
          null, // error_message
        ])
      );
    });

    it('should create incident with minimal fields', async () => {
      const input = {
        tenant_id: 'tenant-1',
        type: 'error_rate_spike',
        severity: 'medium',
      };

      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'inc-new' }] });

      await repo.create(input);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO incidents'),
        expect.arrayContaining(['tenant-1', null, null, null, 'error_rate_spike', 'medium'])
      );
    });
  });

  // ==================== Update Operations ====================

  describe('acknowledge', () => {
    it('should set status to acknowledged', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'inc-1', status: 'acknowledged' }],
      });

      const result = await repo.acknowledge('inc-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = \'acknowledged\''),
        ['inc-1']
      );
    });
  });

  describe('resolve', () => {
    it('should set status to resolved and calculate recovery time', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'inc-1', status: 'resolved', recovery_time_ms: 3600000 }],
      });

      const result = await repo.resolve('inc-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('recovery_time_ms = EXTRACT(EPOCH FROM'),
        ['inc-1']
      );
    });
  });

  // ==================== MTTR Statistics ====================

  describe('getMttrStats', () => {
    it('should return MTTR statistics', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          total_incidents: '10',
          resolved_incidents: '8',
          avg_recovery_time_ms: '1800000',
          median_recovery_time_ms: '1200000',
          p90_recovery_time_ms: '3600000',
          p99_recovery_time_ms: '7200000',
        }],
      });

      const result = await repo.getMttrStats('tenant-1');

      expect(result).toEqual({
        totalIncidents: 10,
        resolvedIncidents: 8,
        avgRecoveryTimeMs: 1800000,
        medianRecoveryTimeMs: 1200000,
        p90RecoveryTimeMs: 3600000,
        p99RecoveryTimeMs: 7200000,
      });
    });

    it('should handle empty results', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          total_incidents: null,
          resolved_incidents: null,
          avg_recovery_time_ms: null,
          median_recovery_time_ms: null,
          p90_recovery_time_ms: null,
          p99_recovery_time_ms: null,
        }],
      });

      const result = await repo.getMttrStats();

      expect(result.totalIncidents).toBe(0);
      expect(result.avgRecoveryTimeMs).toBe(0);
    });

    it('should filter by tenant', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{}] });

      await repo.getMttrStats('tenant-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['tenant-1']
      );
    });

    it('should filter by since date', async () => {
      const since = new Date('2024-01-01');
      mockPool.query.mockResolvedValueOnce({ rows: [{}] });

      await repo.getMttrStats(undefined, since);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('detected_at >= $'),
        [since]
      );
    });
  });

  // ==================== Find by Relations ====================

  describe('findByDeployment', () => {
    it('should find incidents by deployment id', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'inc-1' }] });

      await repo.findByDeployment('deploy-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('deployment_id = $'),
        ['deploy-1']
      );
    });
  });

  describe('findByPipelineRun', () => {
    it('should find incidents by pipeline run id', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'inc-1' }] });

      await repo.findByPipelineRun('run-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('pipeline_run_id = $'),
        ['run-1']
      );
    });
  });

  // ==================== Count Operations ====================

  // ==================== Update Operations ====================

  describe('update', () => {
    it('should update status', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'inc-1', status: 'acknowledged' }],
      });

      const result = await repo.update('inc-1', { status: 'acknowledged' });

      expect(result?.status).toBe('acknowledged');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        ['acknowledged', 'inc-1'],
      );
    });

    it('should update error_message', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'inc-1', error_message: 'Connection refused' }],
      });

      const result = await repo.update('inc-1', { error_message: 'Connection refused' });

      expect(result?.error_message).toBe('Connection refused');
    });

    it('should update resolved_at and auto-calculate recovery_time_ms', async () => {
      const resolvedAt = new Date();
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'inc-1', resolved_at: resolvedAt, recovery_time_ms: 3600000 }],
      });

      const result = await repo.update('inc-1', { resolved_at: resolvedAt });

      expect(result?.recovery_time_ms).toBe(3600000);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('recovery_time_ms = EXTRACT(EPOCH FROM'),
        expect.arrayContaining([resolvedAt, 'inc-1']),
      );
    });

    it('should update acknowledged_at', async () => {
      const ackAt = new Date();
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'inc-1', acknowledged_at: ackAt }],
      });

      const result = await repo.update('inc-1', { acknowledged_at: ackAt });

      expect(result?.acknowledged_at).toBe(ackAt);
    });

    it('should update multiple fields at once', async () => {
      const ackAt = new Date();
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'inc-1', status: 'acknowledged', acknowledged_at: ackAt }],
      });

      await repo.update('inc-1', { status: 'acknowledged', acknowledged_at: ackAt });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        expect.arrayContaining(['acknowledged', ackAt, 'inc-1']),
      );
    });

    it('should return existing when no fields to update', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'inc-1', status: 'open' }],
      });

      const result = await repo.update('inc-1', {});

      expect(result?.id).toBe('inc-1');
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM incidents WHERE id = $1',
        ['inc-1'],
      );
    });

    it('should return null when incident not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.update('nonexistent', { status: 'resolved' });

      expect(result).toBeNull();
    });
  });

  // ==================== Additional FindAll Filters ====================

  describe('findAll — additional filters', () => {
    it('should filter by severity', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ severity: 'critical' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('severity = $'),
        ['critical'],
      );
    });

    it('should filter by deploymentId directly', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'inc-1' }] });

      await repo.findAll({ deploymentId: 'deploy-2' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('deployment_id = $'),
        ['deploy-2'],
      );
    });

    it('should filter by pipelineRunId directly', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'inc-1' }] });

      await repo.findAll({ pipelineRunId: 'run-2' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('pipeline_run_id = $'),
        ['run-2'],
      );
    });

    it('should combine multiple filters', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ tenantId: 'tenant-1', status: 'open', severity: 'critical' });

      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('tenant_id = $1');
      expect(query).toContain('status = $2');
      expect(query).toContain('severity = $3');
      expect(params).toEqual(['tenant-1', 'open', 'critical']);
    });
  });

  // ==================== Additional Count Filters ====================

  describe('count — combined filters', () => {
    it('should count by tenant and status', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });

      const result = await repo.count({ tenantId: 'tenant-1', status: 'open' });

      expect(result).toBe(2);
      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('tenant_id = $1');
      expect(query).toContain('status = $2');
      expect(params).toEqual(['tenant-1', 'open']);
    });
  });
});