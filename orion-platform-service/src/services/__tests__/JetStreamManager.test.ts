/**
 * JetStreamManagerService & TypedEnvelope Types Tests
 */

import { TypedEnvelope, JetStreamConfig, ConsumerConfig, ORION_STREAMS, ORION_CONSUMERS } from '../types/event-types';
import { JetStreamManagerService, StreamDefinition, ConsumerDefinition, toNanoseconds } from '../jetstream-manager';

// ============================================================================
// TypedEnvelope Type Tests
// ============================================================================

describe('TypedEnvelope', () => {
  it('should accept valid CloudEvents 1.0 envelope', () => {
    const envelope: TypedEnvelope<{ runId: string }> = {
      id: 'uuid-1',
      source: 'pipeline-service',
      specversion: '1.0',
      type: 'orion.pipeline.run.created',
      datacontenttype: 'application/json',
      data: { runId: 'run-1' },
      time: new Date().toISOString(),
      tenantid: 'tenant-1',
    };
    expect(envelope.data.runId).toBe('run-1');
    expect(envelope.specversion).toBe('1.0');
  });

  it('should accept optional _jsmeta field', () => {
    const envelope: TypedEnvelope<{ runId: string }> = {
      id: 'uuid-1',
      source: 'pipeline-service',
      specversion: '1.0',
      type: 'orion.pipeline.run.created',
      datacontenttype: 'application/json',
      data: { runId: 'run-1' },
      time: new Date().toISOString(),
      _jsmeta: {
        stream: 'ORION_PIPELINE',
        consumer: 'pipeline-run',
        sequence: 1,
        delivered: 1,
        timestamp: Date.now(),
        pending: 0,
      },
    };
    expect(envelope._jsmeta!.stream).toBe('ORION_PIPELINE');
  });
});

// ============================================================================
// toNanoseconds Helper Tests
// ============================================================================

describe('toNanoseconds', () => {
  it('should convert milliseconds to nanoseconds', () => {
    expect(toNanoseconds('500ms')).toBe(500_000_000);
    expect(toNanoseconds('1ms')).toBe(1_000_000);
  });

  it('should convert seconds to nanoseconds', () => {
    expect(toNanoseconds('30s')).toBe(30_000_000_000);
    expect(toNanoseconds('1s')).toBe(1_000_000_000);
  });

  it('should convert minutes to nanoseconds', () => {
    expect(toNanoseconds('2m')).toBe(120_000_000_000);
  });

  it('should convert hours to nanoseconds', () => {
    expect(toNanoseconds('1h')).toBe(3_600_000_000_000);
  });

  it('should return 0 for invalid format', () => {
    expect(toNanoseconds('invalid')).toBe(0);
    expect(toNanoseconds('')).toBe(0);
  });
});

// ============================================================================
// ORION_STREAMS and ORION_CONSUMERS Constants Tests
// ============================================================================

describe('ORION_STREAMS constants', () => {
  it('should define PLATFORM stream correctly', () => {
    expect(ORION_STREAMS.PLATFORM.name).toBe('ORION_PLATFORM');
    expect(ORION_STREAMS.PLATFORM.subjects).toHaveLength(4);
    expect(ORION_STREAMS.PLATFORM.retention).toBe('limits');
    expect(ORION_STREAMS.PLATFORM.storage).toBe('file');
  });

  it('should define PIPELINE stream correctly', () => {
    expect(ORION_STREAMS.PIPELINE.name).toBe('ORION_PIPELINE');
    expect(ORION_STREAMS.PIPELINE.subjects).toHaveLength(3);
    expect(ORION_STREAMS.PIPELINE.maxMsgs).toBe(5_000_000);
  });

  it('should define DLQ stream correctly', () => {
    expect(ORION_STREAMS.DLQ.name).toBe('ORION_DLQ');
    expect(ORION_STREAMS.DLQ.subjects).toContain('*.dlq.>');
    expect(ORION_STREAMS.DLQ.maxAge).toBe('30d');
  });
});

describe('ORION_CONSUMERS constants', () => {
  it('should define PLATFORM_ALL consumer correctly', () => {
    expect(ORION_CONSUMERS.PLATFORM_ALL.name).toBe('platform-all');
    expect(ORION_CONSUMERS.PLATFORM_ALL.stream).toBe('ORION_PLATFORM');
    expect(ORION_CONSUMERS.PLATFORM_ALL.ackPolicy).toBe('explicit');
    expect(ORION_CONSUMERS.PLATFORM_ALL.maxDeliver).toBe(5);
  });

  it('should define PIPELINE_RUN consumer correctly', () => {
    expect(ORION_CONSUMERS.PIPELINE_RUN.name).toBe('pipeline-run');
    expect(ORION_CONSUMERS.PIPELINE_RUN.filterSubject).toBe('orion.pipeline.run.*');
    expect(ORION_CONSUMERS.PIPELINE_RUN.ackWait).toBe('60s');
  });

  it('should define PIPELINE_STAGE consumer correctly', () => {
    expect(ORION_CONSUMERS.PIPELINE_STAGE.name).toBe('pipeline-stage');
    expect(ORION_CONSUMERS.PIPELINE_STAGE.maxAckPending).toBe(500);
    expect(ORION_CONSUMERS.PIPELINE_STAGE.maxDeliver).toBe(3);
  });
});

// ============================================================================
// JetStreamManagerService Tests
// ============================================================================

describe('JetStreamManagerService', () => {
  let mockJsm: any;
  let service: JetStreamManagerService;

  beforeEach(() => {
    mockJsm = {
      streams: {
        info: jest.fn(),
        add: jest.fn(),
      },
      consumers: {
        info: jest.fn(),
        add: jest.fn(),
        list: jest.fn(),
      },
    };
    service = new JetStreamManagerService(mockJsm);
  });

  describe('ensureStream', () => {
    it('should skip if stream already exists', async () => {
      mockJsm.streams.info.mockResolvedValue({ name: 'TEST_STREAM' });

      await service.ensureStream({
        name: 'TEST_STREAM',
        subjects: ['test.*'],
      });

      expect(mockJsm.streams.add).not.toHaveBeenCalled();
    });

    it('should create stream if it does not exist', async () => {
      mockJsm.streams.info.mockRejectedValue(new Error('stream not found'));
      mockJsm.streams.add.mockResolvedValue({ name: 'NEW_STREAM' });

      await service.ensureStream({
        name: 'NEW_STREAM',
        subjects: ['test.*', 'test.>'],
        maxMsgs: 1_000_000,
        maxAge: '7d',
      });

      expect(mockJsm.streams.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'NEW_STREAM',
          subjects: ['test.*', 'test.>'],
          max_msgs: 1_000_000,
        }),
      );
    });

    it('should create consumers when provided', async () => {
      mockJsm.streams.info.mockRejectedValue(new Error('not found'));
      mockJsm.streams.add.mockResolvedValue({});
      mockJsm.consumers.info.mockRejectedValue(new Error('not found'));
      mockJsm.consumers.add.mockResolvedValue({});

      await service.ensureStream({
        name: 'TEST_STREAM',
        subjects: ['test.*'],
        consumers: [
          { name: 'test-consumer', filterSubject: 'test.*' },
        ],
      });

      expect(mockJsm.consumers.add).toHaveBeenCalledWith(
        'TEST_STREAM',
        expect.objectContaining({ durable_name: 'test-consumer' }),
      );
    });
  });

  describe('ensureConsumer', () => {
    it('should skip if consumer already exists', async () => {
      mockJsm.consumers.info.mockResolvedValue({ name: 'existing-consumer' });

      await service.ensureConsumer('TEST_STREAM', {
        name: 'existing-consumer',
      });

      expect(mockJsm.consumers.add).not.toHaveBeenCalled();
    });

    it('should create consumer if it does not exist', async () => {
      mockJsm.consumers.info.mockRejectedValue(new Error('not found'));
      mockJsm.consumers.add.mockResolvedValue({});

      await service.ensureConsumer('TEST_STREAM', {
        name: 'new-consumer',
        filterSubject: 'test.*',
        maxDeliver: 5,
        ackWait: '30s',
      });

      expect(mockJsm.consumers.add).toHaveBeenCalledWith(
        'TEST_STREAM',
        expect.objectContaining({
          durable_name: 'new-consumer',
          filter_subject: 'test.*',
          max_deliver: 5,
        }),
      );
    });
  });

  describe('getMetrics', () => {
    it('should return stream metrics', async () => {
      mockJsm.streams.info.mockResolvedValue({
        state: { messages: 1000, bytes: 50000 },
      });
      mockJsm.consumers.list.mockImplementation(async function* () {
        yield { name: 'c1' };
        yield { name: 'c2' };
        yield { name: 'c3' };
      });

      const metrics = await service.getMetrics('TEST_STREAM');

      expect(metrics).toEqual({
        messages: 1000,
        bytes: 50000,
        consumers: 3,
      });
    });
  });

  describe('listConsumers', () => {
    it('should list consumers with pending counts', async () => {
      const mockConsumers = [
        { name: 'consumer-1', num_pending: 10 },
        { name: 'consumer-2', num_pending: 0 },
      ];

      // Mock async iterator
      mockJsm.consumers.list.mockImplementation(async function* () {
        for (const c of mockConsumers) {
          yield c;
        }
      });

      const result = await service.listConsumers('TEST_STREAM');

      expect(result).toEqual([
        { name: 'consumer-1', pending: 10 },
        { name: 'consumer-2', pending: 0 },
      ]);
    });
  });
});
