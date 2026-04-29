import { JetStreamManager, StreamConfig, ConsumerConfig, RetentionPolicy, StorageType, AckPolicy, DeliverPolicy, ReplayPolicy } from 'nats';

export interface StreamDefinition {
  name: string;
  subjects: string[];
  retention?: 'limits' | 'interest' | 'workqueue';
  maxMsgs?: number;
  maxAge?: string;
  storage?: 'file' | 'memory';
  replicas?: number;
  consumers?: ConsumerDefinition[];
}

export interface ConsumerDefinition {
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

/**
 * Convert duration string (e.g., "30s", "500ms", "2m") to nanoseconds
 * for JetStream API compatibility.
 */
export function toNanoseconds(duration: string): number {
  const match = duration.match(/^(\d+)(ms|s|m|h)$/);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 'ms': return value * 1_000_000;
    case 's': return value * 1_000_000_000;
    case 'm': return value * 60 * 1_000_000_000;
    case 'h': return value * 3600 * 1_000_000_000;
    default: return 0;
  }
}

/**
 * JetStreamManagerService — manages JetStream stream and consumer lifecycle.
 * Ensures streams and consumers exist with the desired configuration.
 */
export class JetStreamManagerService {
  private jsm: JetStreamManager;

  constructor(jsm: JetStreamManager) {
    this.jsm = jsm;
  }

  /**
   * Ensure a stream exists with the given definition.
   * Creates the stream if it does not exist, then ensures all declared consumers.
   */
  async ensureStream(def: StreamDefinition): Promise<void> {
    try {
      await this.jsm.streams.info(def.name);
    } catch {
      const config: Partial<StreamConfig> = {
        name: def.name,
        subjects: def.subjects,
        retention: this.mapRetention(def.retention),
        max_msgs: def.maxMsgs || 0,
        max_age: def.maxAge ? toNanoseconds(def.maxAge) : 0,
        storage: this.mapStorage(def.storage),
        num_replicas: def.replicas || 1,
      };
      await this.jsm.streams.add(config);
    }
    for (const consumer of (def.consumers || [])) {
      await this.ensureConsumer(def.name, consumer);
    }
  }

  /**
   * Ensure a durable consumer exists on the given stream.
   * Creates the consumer if it does not exist.
   */
  async ensureConsumer(streamName: string, def: ConsumerDefinition): Promise<void> {
    try {
      await this.jsm.consumers.info(streamName, def.name);
    } catch {
      const backoffNanos = (def.backOff || []).map(toNanoseconds);
      await this.jsm.consumers.add(streamName, {
        durable_name: def.name,
        filter_subject: def.filterSubject,
        deliver_policy: this.mapDeliverPolicy(def.deliverPolicy),
        ack_policy: this.mapAckPolicy(def.ackPolicy),
        ack_wait: def.ackWait ? toNanoseconds(def.ackWait) : 0,
        max_deliver: def.maxDeliver || 5,
        max_ack_pending: def.maxAckPending || 100,
        backoff: backoffNanos.length > 0 ? backoffNanos : undefined,
        replay_policy: this.mapReplayPolicy(def.replayPolicy),
      } as ConsumerConfig);
    }
  }

  /**
   * Get stream metrics (message count, byte size, consumer count).
   */
  async getMetrics(streamName: string): Promise<{ messages: number; bytes: number; consumers: number }> {
    const info = await this.jsm.streams.info(streamName);
    const consumers = await this.jsm.consumers.list(streamName);
    let consumerCount = 0;
    for await (const _ of consumers) {
      consumerCount++;
    }
    return { messages: info.state.messages, bytes: info.state.bytes, consumers: consumerCount };
  }

  /**
   * List all consumers for a stream with their pending message counts.
   */
  async listConsumers(streamName: string): Promise<Array<{ name: string; pending: number }>> {
    const consumers = await this.jsm.consumers.list(streamName);
    const result: Array<{ name: string; pending: number }> = [];
    for await (const consumer of consumers) {
      result.push({ name: consumer.name, pending: (consumer as any).num_pending || 0 });
    }
    return result;
  }

  private mapRetention(retention?: string): RetentionPolicy {
    switch (retention) {
      case 'interest': return RetentionPolicy.Interest;
      case 'workqueue': return RetentionPolicy.Workqueue;
      default: return RetentionPolicy.Limits;
    }
  }

  private mapStorage(storage?: string): StorageType {
    return storage === 'memory' ? StorageType.Memory : StorageType.File;
  }

  private mapDeliverPolicy(policy?: string): DeliverPolicy {
    switch (policy) {
      case 'all': return DeliverPolicy.All;
      case 'last': return DeliverPolicy.Last;
      case 'new': return DeliverPolicy.New;
      case 'byStartSequence': return DeliverPolicy.StartSequence;
      case 'byStartTime': return DeliverPolicy.StartTime;
      default: return DeliverPolicy.New;
    }
  }

  private mapAckPolicy(policy?: string): AckPolicy {
    switch (policy) {
      case 'none': return AckPolicy.None;
      case 'all': return AckPolicy.All;
      case 'explicit': return AckPolicy.Explicit;
      default: return AckPolicy.Explicit;
    }
  }

  private mapReplayPolicy(policy?: string): ReplayPolicy {
    return policy === 'original' ? ReplayPolicy.Original : ReplayPolicy.Instant;
  }
}
