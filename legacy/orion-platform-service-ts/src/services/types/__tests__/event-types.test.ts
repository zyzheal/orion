/**
 * event-types.ts — Type constants and configuration tests
 *
 * Tests the runtime constants ORION_STREAMS and ORION_CONSUMERS
 * for correct structure, values, and CloudEvents 1.0 compatibility.
 */

import { ORION_STREAMS, ORION_CONSUMERS } from '../event-types';
import type { TypedEnvelope, JetStreamConfig, ConsumerConfig } from '../event-types';

describe('event-types', () => {
  describe('ORION_STREAMS', () => {
    describe('PLATFORM stream', () => {
      it('should have correct name', () => {
        expect(ORION_STREAMS.PLATFORM.name).toBe('ORION_PLATFORM');
      });

      it('should include code, deploy, config, incident subjects', () => {
        const subjects = ORION_STREAMS.PLATFORM.subjects;
        expect(subjects).toContain('orion.code.*');
        expect(subjects).toContain('orion.deploy.*');
        expect(subjects).toContain('orion.config.*');
        expect(subjects).toContain('orion.incident.*');
      });

      it('should have limits retention policy', () => {
        expect(ORION_STREAMS.PLATFORM.retention).toBe('limits');
      });

      it('should have file storage', () => {
        expect(ORION_STREAMS.PLATFORM.storage).toBe('file');
      });

      it('should have 1 replica', () => {
        expect(ORION_STREAMS.PLATFORM.replicas).toBe(1);
      });

      it('should have maxMsgs of 1 million', () => {
        expect(ORION_STREAMS.PLATFORM.maxMsgs).toBe(1_000_000);
      });

      it('should have maxAge of 7 days', () => {
        expect(ORION_STREAMS.PLATFORM.maxAge).toBe('7d');
      });
    });

    describe('PIPELINE stream', () => {
      it('should have correct name', () => {
        expect(ORION_STREAMS.PIPELINE.name).toBe('ORION_PIPELINE');
      });

      it('should include pipeline run, stage, task subjects', () => {
        const subjects = ORION_STREAMS.PIPELINE.subjects;
        expect(subjects).toContain('orion.pipeline.run.*');
        expect(subjects).toContain('orion.pipeline.stage.*');
        expect(subjects).toContain('orion.pipeline.task.*');
      });

      it('should have limits retention policy', () => {
        expect(ORION_STREAMS.PIPELINE.retention).toBe('limits');
      });

      it('should have file storage', () => {
        expect(ORION_STREAMS.PIPELINE.storage).toBe('file');
      });

      it('should have maxMsgs of 5 million', () => {
        expect(ORION_STREAMS.PIPELINE.maxMsgs).toBe(5_000_000);
      });

      it('should have maxAge of 14 days', () => {
        expect(ORION_STREAMS.PIPELINE.maxAge).toBe('14d');
      });
    });

    describe('DLQ stream', () => {
      it('should have correct name', () => {
        expect(ORION_STREAMS.DLQ.name).toBe('ORION_DLQ');
      });

      it('should use wildcard DLQ subject pattern', () => {
        expect(ORION_STREAMS.DLQ.subjects).toEqual(['*.dlq.>']);
      });

      it('should have limits retention policy', () => {
        expect(ORION_STREAMS.DLQ.retention).toBe('limits');
      });

      it('should have maxMsgs of 500k', () => {
        expect(ORION_STREAMS.DLQ.maxMsgs).toBe(500_000);
      });

      it('should have maxAge of 30 days', () => {
        expect(ORION_STREAMS.DLQ.maxAge).toBe('30d');
      });
    });

    describe('structural validity', () => {
      it('should have exactly 3 streams', () => {
        expect(Object.keys(ORION_STREAMS)).toHaveLength(3);
      });

      it('should have all required fields on each stream', () => {
        for (const [key, stream] of Object.entries(ORION_STREAMS)) {
          expect(stream).toHaveProperty('name');
          expect(stream).toHaveProperty('subjects');
          expect(stream).toHaveProperty('retention');
          expect(stream).toHaveProperty('maxMsgs');
          expect(stream).toHaveProperty('maxAge');
          expect(stream).toHaveProperty('storage');
          expect(stream).toHaveProperty('replicas');
          expect(typeof stream.name).toBe('string');
          expect(Array.isArray(stream.subjects)).toBe(true);
          expect(stream.subjects.length).toBeGreaterThan(0);
        }
      });

      it('should have unique stream names', () => {
        const names = Object.values(ORION_STREAMS).map(s => s.name);
        expect(new Set(names).size).toBe(names.length);
      });
    });
  });

  describe('ORION_CONSUMERS', () => {
    describe('PLATFORM_ALL consumer', () => {
      it('should have correct name', () => {
        expect(ORION_CONSUMERS.PLATFORM_ALL.name).toBe('platform-all');
      });

      it('should reference ORION_PLATFORM stream', () => {
        expect(ORION_CONSUMERS.PLATFORM_ALL.stream).toBe('ORION_PLATFORM');
      });

      it('should filter by orion.* subject', () => {
        expect(ORION_CONSUMERS.PLATFORM_ALL.filterSubject).toBe('orion.*');
      });

      it('should use new deliver policy', () => {
        expect(ORION_CONSUMERS.PLATFORM_ALL.deliverPolicy).toBe('new');
      });

      it('should use explicit ack policy', () => {
        expect(ORION_CONSUMERS.PLATFORM_ALL.ackPolicy).toBe('explicit');
      });

      it('should have 30s ack wait', () => {
        expect(ORION_CONSUMERS.PLATFORM_ALL.ackWait).toBe('30s');
      });

      it('should have max 5 deliveries', () => {
        expect(ORION_CONSUMERS.PLATFORM_ALL.maxDeliver).toBe(5);
      });

      it('should have max 100 pending acks', () => {
        expect(ORION_CONSUMERS.PLATFORM_ALL.maxAckPending).toBe(100);
      });

      it('should use instant replay policy', () => {
        expect(ORION_CONSUMERS.PLATFORM_ALL.replayPolicy).toBe('instant');
      });
    });

    describe('PIPELINE_RUN consumer', () => {
      it('should have correct name', () => {
        expect(ORION_CONSUMERS.PIPELINE_RUN.name).toBe('pipeline-run');
      });

      it('should reference ORION_PIPELINE stream', () => {
        expect(ORION_CONSUMERS.PIPELINE_RUN.stream).toBe('ORION_PIPELINE');
      });

      it('should filter by pipeline run subject', () => {
        expect(ORION_CONSUMERS.PIPELINE_RUN.filterSubject).toBe('orion.pipeline.run.*');
      });

      it('should have 60s ack wait', () => {
        expect(ORION_CONSUMERS.PIPELINE_RUN.ackWait).toBe('60s');
      });

      it('should have max 200 pending acks', () => {
        expect(ORION_CONSUMERS.PIPELINE_RUN.maxAckPending).toBe(200);
      });
    });

    describe('PIPELINE_STAGE consumer', () => {
      it('should have correct name', () => {
        expect(ORION_CONSUMERS.PIPELINE_STAGE.name).toBe('pipeline-stage');
      });

      it('should reference ORION_PIPELINE stream', () => {
        expect(ORION_CONSUMERS.PIPELINE_STAGE.stream).toBe('ORION_PIPELINE');
      });

      it('should filter by pipeline stage subject', () => {
        expect(ORION_CONSUMERS.PIPELINE_STAGE.filterSubject).toBe('orion.pipeline.stage.*');
      });

      it('should have max 3 deliveries', () => {
        expect(ORION_CONSUMERS.PIPELINE_STAGE.maxDeliver).toBe(3);
      });

      it('should have max 500 pending acks', () => {
        expect(ORION_CONSUMERS.PIPELINE_STAGE.maxAckPending).toBe(500);
      });
    });

    describe('structural validity', () => {
      it('should have exactly 3 consumers', () => {
        expect(Object.keys(ORION_CONSUMERS)).toHaveLength(3);
      });

      it('should have all required fields on each consumer', () => {
        for (const [key, consumer] of Object.entries(ORION_CONSUMERS)) {
          expect(consumer).toHaveProperty('name');
          expect(consumer).toHaveProperty('stream');
          expect(consumer).toHaveProperty('filterSubject');
          expect(consumer).toHaveProperty('deliverPolicy');
          expect(consumer).toHaveProperty('ackPolicy');
          expect(consumer).toHaveProperty('ackWait');
          expect(consumer).toHaveProperty('maxDeliver');
          expect(consumer).toHaveProperty('maxAckPending');
          expect(consumer).toHaveProperty('replayPolicy');
          expect(typeof consumer.name).toBe('string');
          expect(typeof consumer.stream).toBe('string');
          expect(typeof consumer.filterSubject).toBe('string');
        }
      });

      it('should have unique consumer names', () => {
        const names = Object.values(ORION_CONSUMERS).map(c => c.name);
        expect(new Set(names).size).toBe(names.length);
      });

      it('should reference valid stream names', () => {
        const streamNames = Object.values(ORION_STREAMS).map(s => s.name);
        for (const consumer of Object.values(ORION_CONSUMERS)) {
          expect(streamNames).toContain(consumer.stream);
        }
      });
    });
  });

  describe('TypedEnvelope type compatibility', () => {
    it('should accept a valid envelope object at compile time', () => {
      // Runtime validation that objects conform to the expected shape
      const envelope: TypedEnvelope<{ action: string }> = {
        id: 'evt-001',
        source: 'orion.pipeline',
        specversion: '1.0',
        type: 'orion.pipeline.run.started',
        datacontenttype: 'application/json',
        data: { action: 'started' },
        time: new Date().toISOString(),
      };

      expect(envelope.id).toBe('evt-001');
      expect(envelope.specversion).toBe('1.0');
      expect(envelope.data.action).toBe('started');
    });

    it('should accept envelope with all Orion extension fields', () => {
      const envelope: TypedEnvelope = {
        id: 'evt-002',
        source: 'orion.deploy',
        specversion: '1.0',
        type: 'orion.deploy.completed',
        datacontenttype: 'application/json',
        data: { status: 'success' },
        time: new Date().toISOString(),
        tenantid: 'tenant-1',
        userid: 'user-1',
        traceid: 'trace-abc',
        correlationid: 'corr-xyz',
        priority: 'high',
      };

      expect(envelope.tenantid).toBe('tenant-1');
      expect(envelope.userid).toBe('user-1');
      expect(envelope.traceid).toBe('trace-abc');
      expect(envelope.correlationid).toBe('corr-xyz');
      expect(envelope.priority).toBe('high');
    });

    it('should accept envelope with JetStream metadata', () => {
      const envelope: TypedEnvelope = {
        id: 'evt-003',
        source: 'orion.code',
        specversion: '1.0',
        type: 'orion.code.push',
        datacontenttype: 'application/json',
        data: { repo: 'orion' },
        time: new Date().toISOString(),
        _jsmeta: {
          stream: 'ORION_PLATFORM',
          consumer: 'platform-all',
          sequence: 42,
          delivered: 1,
          timestamp: Date.now(),
          pending: 10,
        },
      };

      expect(envelope._jsmeta?.stream).toBe('ORION_PLATFORM');
      expect(envelope._jsmeta?.sequence).toBe(42);
    });
  });

  describe('JetStreamConfig type compatibility', () => {
    it('should accept a valid stream config object', () => {
      const config: JetStreamConfig = {
        name: 'TEST_STREAM',
        subjects: ['test.*'],
        retention: 'limits',
        maxMsgs: 1000,
        maxAge: '1d',
        storage: 'memory',
        replicas: 1,
      };

      expect(config.name).toBe('TEST_STREAM');
      expect(config.subjects).toEqual(['test.*']);
    });

    it('should accept config with consumers array', () => {
      const consumer: ConsumerConfig = {
        name: 'test-consumer',
        filterSubject: 'test.events',
        deliverPolicy: 'all',
        ackPolicy: 'explicit',
        ackWait: '10s',
        maxDeliver: 3,
      };

      const config: JetStreamConfig = {
        name: 'TEST_STREAM',
        subjects: ['test.*'],
        consumers: [consumer],
      };

      expect(config.consumers).toHaveLength(1);
      expect(config.consumers![0].name).toBe('test-consumer');
    });
  });

  describe('ConsumerConfig type compatibility', () => {
    it('should accept consumer with all deliver policies', () => {
      const policies: ConsumerConfig['deliverPolicy'][] = ['all', 'last', 'new', 'byStartSequence', 'byStartTime'];
      for (const policy of policies) {
        const config: ConsumerConfig = { name: 'test', deliverPolicy: policy };
        expect(config.deliverPolicy).toBe(policy);
      }
    });

    it('should accept consumer with all ack policies', () => {
      const policies: ConsumerConfig['ackPolicy'][] = ['none', 'all', 'explicit'];
      for (const policy of policies) {
        const config: ConsumerConfig = { name: 'test', ackPolicy: policy };
        expect(config.ackPolicy).toBe(policy);
      }
    });

    it('should accept consumer with backoff array', () => {
      const config: ConsumerConfig = {
        name: 'test',
        backOff: ['1s', '5s', '30s', '2m'],
      };
      expect(config.backOff).toHaveLength(4);
    });

    it('should accept consumer with replay policies', () => {
      const instant: ConsumerConfig = { name: 'test', replayPolicy: 'instant' };
      const original: ConsumerConfig = { name: 'test', replayPolicy: 'original' };
      expect(instant.replayPolicy).toBe('instant');
      expect(original.replayPolicy).toBe('original');
    });
  });
});
