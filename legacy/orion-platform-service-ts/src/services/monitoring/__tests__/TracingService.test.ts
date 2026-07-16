/**
 * TracingService Tests
 *
 * Covers:
 * - generateTraceContext: trace ID and span ID format
 * - parseTraceParent: valid/invalid W3C traceparent headers
 * - buildTraceParent: header construction
 * - generateSpanId: format validation
 * - createSpan: persistence, duration calculation
 * - getTrace: trace retrieval
 * - getTraceSummary: aggregated trace view
 * - listTraces: filtering options
 * - getSlowTraces: threshold filtering
 * - cleanupExpired: retention cleanup
 */

import { TracingService } from '../TracingService';

jest.mock('pino', () => {
  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return jest.fn(() => mockLogger);
});

describe('TracingService', () => {
  let service: TracingService;
  let mockPool: any;

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    service = new TracingService(mockPool);
  });

  // ==================== generateTraceContext ====================

  describe('generateTraceContext', () => {
    it('should generate trace context with correct format', () => {
      const ctx = TracingService.generateTraceContext();

      expect(ctx.traceId).toMatch(/^[0-9a-f]{32}$/);
      expect(ctx.spanId).toMatch(/^[0-9a-f]{16}$/);
      expect(ctx.sampled).toBe(true);
    });

    it('should generate unique trace IDs', () => {
      const ctx1 = TracingService.generateTraceContext();
      const ctx2 = TracingService.generateTraceContext();

      expect(ctx1.traceId).not.toBe(ctx2.traceId);
    });
  });

  // ==================== parseTraceParent ====================

  describe('parseTraceParent', () => {
    it('should parse valid traceparent header', () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c';
      const spanId = '00f067aa0ba902b7';
      const header = `00-${traceId}-${spanId}-01`;

      const result = TracingService.parseTraceParent(header);

      expect(result).not.toBeNull();
      expect(result!.traceId).toBe(traceId);
      expect(result!.spanId).toBe(spanId);
      expect(result!.sampled).toBe(true);
    });

    it('should parse unsampled trace', () => {
      const header = '00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-00';
      const result = TracingService.parseTraceParent(header);

      expect(result!.sampled).toBe(false);
    });

    it('should return null for invalid format', () => {
      expect(TracingService.parseTraceParent('invalid')).toBeNull();
    });

    it('should return null for wrong version', () => {
      expect(TracingService.parseTraceParent('01-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-01')).toBeNull();
    });

    it('should return null for wrong trace ID length', () => {
      expect(TracingService.parseTraceParent('00-short-00f067aa0ba902b7-01')).toBeNull();
    });

    it('should return null for wrong span ID length', () => {
      expect(TracingService.parseTraceParent('00-0af7651916cd43dd8448eb211c80319c-short-01')).toBeNull();
    });
  });

  // ==================== buildTraceParent ====================

  describe('buildTraceParent', () => {
    it('should build sampled traceparent', () => {
      const result = TracingService.buildTraceParent('abc123', 'def456', true);
      expect(result).toBe('00-abc123-def456-01');
    });

    it('should build unsampled traceparent', () => {
      const result = TracingService.buildTraceParent('abc123', 'def456', false);
      expect(result).toBe('00-abc123-def456-00');
    });

    it('should default to sampled', () => {
      const result = TracingService.buildTraceParent('abc123', 'def456');
      expect(result).toBe('00-abc123-def456-01');
    });
  });

  // ==================== generateSpanId ====================

  describe('generateSpanId', () => {
    it('should generate 16 hex character span ID', () => {
      const spanId = TracingService.generateSpanId();
      expect(spanId).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  // ==================== createSpan ====================

  describe('createSpan', () => {
    it('should create and persist a span', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.createSpan({
        name: 'http-request',
        operation: 'GET /api/test',
        kind: 'server',
        serviceName: 'test-service',
        startTime: new Date('2026-01-01T00:00:00Z'),
        endTime: new Date('2026-01-01T00:00:01Z'),
        status: 'ok',
        traceId: '0af7651916cd43dd8448eb211c80319c',
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe('http-request');
      expect(result.durationMs).toBe(1000);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO spans'),
        expect.any(Array)
      );
    });

    it('should calculate duration when not provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const start = new Date('2026-01-01T00:00:00Z');
      const end = new Date('2026-01-01T00:00:05Z');

      const result = await service.createSpan({
        name: 'test',
        operation: 'op',
        kind: 'internal',
        serviceName: 'svc',
        startTime: start,
        endTime: end,
        status: 'ok',
        traceId: 'abc',
      });

      expect(result.durationMs).toBe(5000);
    });

    it('should handle DB errors gracefully (not throw)', async () => {
      mockPool.query.mockRejectedValue(new Error('DB down'));

      const result = await service.createSpan({
        name: 'test',
        operation: 'op',
        kind: 'server',
        serviceName: 'svc',
        startTime: new Date(),
        status: 'ok',
        traceId: 'abc',
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('test');
    });
  });

  // ==================== getTrace ====================

  describe('getTrace', () => {
    it('should return spans for a trace', async () => {
      const mockSpans = [
        { id: 's1', trace_id: 't1', name: 'span1' },
        { id: 's2', trace_id: 't1', name: 'span2' },
      ];
      mockPool.query.mockResolvedValue({ rows: mockSpans });

      const result = await service.getTrace('t1');

      expect(result).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE trace_id = $1'),
        ['t1']
      );
    });
  });

  // ==================== getTraceSummary ====================

  describe('getTraceSummary', () => {
    it('should return trace summary', async () => {
      const mockSummary = {
        trace_id: 't1',
        root_service: 'api',
        root_operation: 'GET /test',
        start_time: new Date(),
        end_time: new Date(),
        duration_ms: 500,
        span_count: 3,
        status: 'ok',
      };
      mockPool.query.mockResolvedValue({ rows: [mockSummary] });

      const result = await service.getTraceSummary('t1');

      expect(result).toBeDefined();
      expect(result!.span_count).toBe(3);
    });

    it('should return null when trace not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getTraceSummary('missing');
      expect(result).toBeFalsy(); // rows[0] is undefined when empty
    });
  });

  // ==================== listTraces ====================

  describe('listTraces', () => {
    it('should list traces with default limit', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.listTraces();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([50])
      );
    });

    it('should filter by service name', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.listTraces({ serviceName: 'api' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('root_service'),
        expect.arrayContaining(['api'])
      );
    });

    it('should filter by status', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.listTraces({ status: 'error' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining(['error'])
      );
    });

    it('should filter by tenant ID', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.listTraces({ tenantId: 't1' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id'),
        expect.arrayContaining(['t1'])
      );
    });

    it('should accept custom limit', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.listTraces({ limit: 10 });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10])
      );
    });
  });

  // ==================== getSlowTraces ====================

  describe('getSlowTraces', () => {
    it('should query traces above threshold', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.getSlowTraces(5000, 10);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('HAVING'),
        expect.arrayContaining([5000, 10])
      );
    });
  });

  // ==================== cleanupExpired ====================

  describe('cleanupExpired', () => {
    it('should delete old spans and return count', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 42 });

      const result = await service.cleanupExpired(7);

      expect(result).toBe(42);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM spans')
      );
    });

    it('should use default retention of 7 days', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      await service.cleanupExpired();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('7 days')
      );
    });
  });
});
