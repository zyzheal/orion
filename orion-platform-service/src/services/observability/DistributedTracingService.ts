import pino from 'pino';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { TraceSpanRepository, TraceSpanEntity, TraceSearchOptions } from '../../repositories/TraceSpanRepository';
import { TraceSamplingConfigRepository, TraceSamplingConfigEntity } from '../../repositories/TraceSamplingConfigRepository';
import { OtelCollectorConfigRepository, OtelCollectorConfigEntity } from '../../repositories/OtelCollectorConfigRepository';
import { OrionError } from '../../errors';

const logger = pino({ name: 'DistributedTracingService' });

export interface CreateSpanInput {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: Date;
  endTime?: Date;
  statusCode?: string;
  statusMessage?: string;
  attributes?: Record<string, unknown>;
  events?: Array<Record<string, unknown>>;
}

export interface UpdateSamplingInput {
  serviceName: string;
  sampleRate: number;
  maxSpansPerSecond?: number;
  enabled?: boolean;
}

export interface CreateOtelConfigInput {
  name: string;
  description?: string;
  configType: string;
  configYaml: string;
  enabled?: boolean;
}

export interface TraceDetail {
  traceId: string;
  spans: TraceSpanEntity[];
  rootSpan: TraceSpanEntity | null;
  duration: number | null;
  serviceCount: number;
  errorCount: number;
}

/**
 * DistributedTracingService - Manages trace spans, sampling config, and OTel collector configs
 */
export class DistributedTracingService {
  constructor(
    private readonly spanRepo: TraceSpanRepository,
    private readonly samplingRepo: TraceSamplingConfigRepository,
    private readonly otelConfigRepo: OtelCollectorConfigRepository,
  ) {}

  // ==================== Trace Spans ====================

  async createSpan(input: CreateSpanInput): Promise<TraceSpanEntity> {
    const tenantId = getCurrentTenantId();
    const durationMs = input.endTime
      ? input.endTime.getTime() - input.startTime.getTime()
      : null;

    const span = await this.spanRepo.create({
      tenantId,
      traceId: input.traceId,
      spanId: input.spanId,
      parentSpanId: input.parentSpanId ?? null,
      operationName: input.operationName,
      serviceName: input.serviceName,
      startTime: input.startTime,
      endTime: input.endTime ?? null,
      durationMs,
      statusCode: input.statusCode ?? 'UNSET',
      statusMessage: input.statusMessage ?? null,
      attributes: input.attributes ?? {},
      events: input.events ?? [],
    });

    logger.debug({ traceId: input.traceId, spanId: input.spanId }, 'Span created');
    return span;
  }

  async getTrace(traceId: string): Promise<TraceDetail> {
    const tenantId = getCurrentTenantId();
    const spans = await this.spanRepo.findByTraceId(traceId);

    if (spans.length === 0) {
      throw new OrionError(`Trace not found: ${traceId}`, 'NOT_FOUND');
    }

    // Filter by tenant
    const tenantSpans = spans.filter((s) => s.tenantId === tenantId);
    if (tenantSpans.length === 0) {
      throw new OrionError(`Trace not found: ${traceId}`, 'NOT_FOUND');
    }

    const rootSpan = tenantSpans.find((s) => !s.parentSpanId) ?? null;
    const services = new Set(tenantSpans.map((s) => s.serviceName));
    const errorCount = tenantSpans.filter((s) => s.statusCode === 'ERROR').length;
    const duration = rootSpan?.durationMs ?? null;

    return {
      traceId,
      spans: tenantSpans,
      rootSpan,
      duration,
      serviceCount: services.size,
      errorCount,
    };
  }

  async searchTraces(options: TraceSearchOptions = {}): Promise<TraceSpanEntity[]> {
    const tenantId = getCurrentTenantId();
    return this.spanRepo.searchTraces(tenantId, options);
  }

  async getTraceList(options: { limit?: number; serviceName?: string } = {}): Promise<TraceSpanEntity[]> {
    const tenantId = getCurrentTenantId();
    if (options.serviceName) {
      return this.spanRepo.findByServiceName(tenantId, options.serviceName, options.limit ?? 50);
    }
    return this.spanRepo.searchTraces(tenantId, { limit: options.limit ?? 50 });
  }

  async deleteTrace(traceId: string): Promise<void> {
    const deleted = await this.spanRepo.deleteByTraceId(traceId);
    logger.info({ traceId, deletedSpans: deleted }, 'Trace deleted');
  }

  async cleanupOldTraces(retentionDays: number = 7): Promise<number> {
    const beforeTime = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const deleted = await this.spanRepo.deleteOlderThan(beforeTime);
    logger.info({ retentionDays, deletedSpans: deleted }, 'Old traces cleaned up');
    return deleted;
  }

  // ==================== Sampling Config ====================

  async getSamplingConfigs(): Promise<TraceSamplingConfigEntity[]> {
    const tenantId = getCurrentTenantId();
    return this.samplingRepo.findByTenant(tenantId);
  }

  async getSamplingConfig(serviceName: string): Promise<TraceSamplingConfigEntity | undefined> {
    const tenantId = getCurrentTenantId();
    return this.samplingRepo.findByServiceName(tenantId, serviceName);
  }

  async upsertSamplingConfig(input: UpdateSamplingInput): Promise<TraceSamplingConfigEntity> {
    const tenantId = getCurrentTenantId();
    logger.info({ tenantId, serviceName: input.serviceName, sampleRate: input.sampleRate }, 'Upserting sampling config');

    return this.samplingRepo.upsertByServiceName(tenantId, input.serviceName, {
      sampleRate: input.sampleRate,
      maxSpansPerSecond: input.maxSpansPerSecond,
      enabled: input.enabled,
    });
  }

  // ==================== OTel Collector Configs ====================

  async getOtelConfigs(): Promise<OtelCollectorConfigEntity[]> {
    const tenantId = getCurrentTenantId();
    return this.otelConfigRepo.findByTenant(tenantId);
  }

  async getOtelConfigsByType(configType: string): Promise<OtelCollectorConfigEntity[]> {
    const tenantId = getCurrentTenantId();
    return this.otelConfigRepo.findByType(tenantId, configType);
  }

  async createOtelConfig(input: CreateOtelConfigInput): Promise<OtelCollectorConfigEntity> {
    const tenantId = getCurrentTenantId();
    return this.otelConfigRepo.create({
      tenantId,
      name: input.name,
      description: input.description ?? null,
      configType: input.configType,
      configYaml: input.configYaml,
      enabled: input.enabled ?? true,
    });
  }

  async updateOtelConfig(id: string, input: Partial<CreateOtelConfigInput>): Promise<OtelCollectorConfigEntity> {
    const existing = await this.otelConfigRepo.findById(id);
    if (!existing) {
      throw new OrionError(`OTel collector config not found: ${id}`, 'NOT_FOUND');
    }
    return this.otelConfigRepo.update(id, input);
  }

  async deleteOtelConfig(id: string): Promise<void> {
    const existing = await this.otelConfigRepo.findById(id);
    if (!existing) {
      throw new OrionError(`OTel collector config not found: ${id}`, 'NOT_FOUND');
    }
    await this.otelConfigRepo.delete(id);
  }
}
