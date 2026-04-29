/**
 * TypedEnvelope — Unified event envelope for all event publish/consume
 * CloudEvents 1.0 compatible with Orion extensions
 */

export interface TypedEnvelope<T = unknown> {
  /** CloudEvents 1.0 standard fields */
  id: string;
  source: string;
  specversion: '1.0';
  type: string;
  datacontenttype: 'application/json';
  data: T;
  time: string;

  /** Orion extension fields */
  tenantid?: string;
  userid?: string;
  traceid?: string;
  correlationid?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';

  /** JetStream metadata (injected on consume) */
  _jsmeta?: {
    stream: string;
    consumer: string;
    sequence: number;
    delivered: number;
    timestamp: number;
    pending: number;
  };
}

export interface JetStreamConfig {
  name: string;
  subjects: string[];
  retention?: 'limits' | 'interest' | 'workqueue';
  maxMsgs?: number;
  maxAge?: string;
  storage?: 'file' | 'memory';
  replicas?: number;
  consumers?: ConsumerConfig[];
}

export interface ConsumerConfig {
  name: string;
  filterSubject?: string;
  deliverPolicy?: 'all' | 'last' | 'new' | 'byStartSequence' | 'byStartTime';
  ackPolicy?: 'none' | 'all' | 'explicit';
  ackWait?: string;
  maxDeliver?: number;
  maxAckPending?: number;
  backOff?: string[];
  replayPolicy?: 'instant' | 'original';
}

export const ORION_STREAMS = {
  PLATFORM: {
    name: 'ORION_PLATFORM',
    subjects: ['orion.code.*', 'orion.deploy.*', 'orion.config.*', 'orion.incident.*'],
    retention: 'limits' as const,
    maxMsgs: 1_000_000,
    maxAge: '7d',
    storage: 'file' as const,
    replicas: 1,
  },
  PIPELINE: {
    name: 'ORION_PIPELINE',
    subjects: ['orion.pipeline.run.*', 'orion.pipeline.stage.*', 'orion.pipeline.task.*'],
    retention: 'limits' as const,
    maxMsgs: 5_000_000,
    maxAge: '14d',
    storage: 'file' as const,
    replicas: 1,
  },
  DLQ: {
    name: 'ORION_DLQ',
    subjects: ['*.dlq.>'],
    retention: 'limits' as const,
    maxMsgs: 500_000,
    maxAge: '30d',
    storage: 'file' as const,
    replicas: 1,
  },
} as const;

export const ORION_CONSUMERS = {
  PLATFORM_ALL: {
    name: 'platform-all',
    stream: 'ORION_PLATFORM',
    filterSubject: 'orion.*',
    deliverPolicy: 'new' as const,
    ackPolicy: 'explicit' as const,
    ackWait: '30s',
    maxDeliver: 5,
    maxAckPending: 100,
    replayPolicy: 'instant' as const,
  },
  PIPELINE_RUN: {
    name: 'pipeline-run',
    stream: 'ORION_PIPELINE',
    filterSubject: 'orion.pipeline.run.*',
    deliverPolicy: 'new' as const,
    ackPolicy: 'explicit' as const,
    ackWait: '60s',
    maxDeliver: 5,
    maxAckPending: 200,
    replayPolicy: 'instant' as const,
  },
  PIPELINE_STAGE: {
    name: 'pipeline-stage',
    stream: 'ORION_PIPELINE',
    filterSubject: 'orion.pipeline.stage.*',
    deliverPolicy: 'new' as const,
    ackPolicy: 'explicit' as const,
    ackWait: '30s',
    maxDeliver: 3,
    maxAckPending: 500,
    replayPolicy: 'instant' as const,
  },
} as const;
