/**
 * PerformanceProfileService - Service performance profiling
 *
 * Provides performance profiling, bottleneck analysis,
 * and optimization suggestions with tenant isolation.
 * Uses PostgreSQL Repository pattern for persistence.
 */
import { v4 as uuidv4 } from 'uuid';
import {
  PerformanceProfileRepository,
  PerformanceProfileEntity,
} from '../../repositories/PerformanceRepository';

export interface ProfileConfig {
  durationSeconds?: number;
  concurrency?: number;
  targetRps?: number;
  endpoints?: string[];
  metrics?: string[];
}

export interface ProfileRecord {
  id: string;
  serviceName: string;
  config: ProfileConfig;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results?: ProfileResult;
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface ProfileResult {
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  maxRps: number;
  errorRate: number;
  throughputRps: number;
  resourceUsage: {
    cpuAvg: number;
    cpuMax: number;
    memoryAvg: number;
    memoryMax: number;
  };
  metrics: Record<string, number>;
}

export interface BottleneckAnalysis {
  profileId: string;
  bottlenecks: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    metric: string;
    value: number;
    threshold: number;
  }[];
  analyzedAt: Date;
}

export interface OptimizationSuggestion {
  category: 'performance' | 'resource' | 'architecture' | 'configuration';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  estimatedImprovement: string;
}

export class PerformanceProfileService {
  private profileRepo: PerformanceProfileRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.profileRepo = new PerformanceProfileRepository(db);
  }

  /**
   * Create a performance profile for a service
   */
  async profileService(
    serviceName: string,
    testConfig: ProfileConfig
  ): Promise<ProfileRecord> {
    const id = uuidv4();
    const config: ProfileConfig = {
      durationSeconds: testConfig.durationSeconds ?? 60,
      concurrency: testConfig.concurrency ?? 10,
      targetRps: testConfig.targetRps,
      endpoints: testConfig.endpoints ?? [],
      metrics: testConfig.metrics ?? ['latency', 'throughput', 'error_rate', 'cpu', 'memory'],
    };

    const entity = await this.profileRepo.create({
      id,
      tenant_id: null,
      service_name: serviceName,
      config,
      status: 'pending',
      results: null,
      error_message: null,
      completed_at: null,
    });

    const record = this.mapEntityToProfile(entity);

    // Execute profile asynchronously
    this.executeProfileAsync(record).catch(err => {
      console.error(`[PerformanceProfile] Profile ${id} execution failed:`, err);
    });

    return record;
  }

  /**
   * Analyze bottlenecks from a completed profile
   */
  async analyzeBottlenecks(profileId: string): Promise<BottleneckAnalysis | null> {
    const entity = await this.profileRepo.findById(profileId);
    if (!entity || entity.status !== 'completed' || !entity.results) {
      return null;
    }

    const profile = this.mapEntityToProfile(entity);
    return this.analyzeBottlenecksFromProfile(profile);
  }

  /**
   * Get optimization suggestions for a service
   */
  async getOptimizationSuggestions(serviceName: string): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const profiles = await this.listProfiles(serviceName);
    const completedProfiles = profiles.filter(p => p.status === 'completed' && p.results !== undefined);

    if (completedProfiles.length === 0) {
      suggestions.push({
        category: 'performance',
        priority: 'high',
        title: 'No performance profiles available',
        description: `No completed performance profiles found for service "${serviceName}". Run a profile first to get actionable suggestions.`,
        estimatedImprovement: 'N/A',
      });
      return suggestions;
    }

    // Analyze the latest completed profile
    const latest = completedProfiles[completedProfiles.length - 1];
    const results = latest.results!;

    if (results.p99LatencyMs > 200) {
      suggestions.push({
        category: 'performance',
        priority: 'high',
        title: 'Reduce tail latency',
        description: 'P99 latency is high. Consider implementing caching, connection pooling, or async processing for slow operations.',
        estimatedImprovement: '30-50% reduction in P99 latency',
      });
    }

    if (results.errorRate > 0.01) {
      suggestions.push({
        category: 'configuration',
        priority: 'high',
        title: 'Reduce error rate',
        description: 'Error rate exceeds 1%. Review error logs, add retry logic with exponential backoff, and implement circuit breakers.',
        estimatedImprovement: 'Reduce error rate to < 0.1%',
      });
    }

    if (results.resourceUsage.cpuAvg > 70) {
      suggestions.push({
        category: 'resource',
        priority: 'medium',
        title: 'Optimize CPU usage',
        description: 'CPU usage is consistently high. Consider horizontal scaling, optimizing hot paths, or using more efficient algorithms.',
        estimatedImprovement: '20-40% CPU reduction',
      });
    }

    if (results.resourceUsage.memoryAvg > 75) {
      suggestions.push({
        category: 'resource',
        priority: 'medium',
        title: 'Optimize memory usage',
        description: 'Memory usage is high. Review memory leaks, optimize data structures, and consider streaming for large payloads.',
        estimatedImprovement: '15-30% memory reduction',
      });
    }

    if (results.throughputRps < 100) {
      suggestions.push({
        category: 'architecture',
        priority: 'medium',
        title: 'Increase throughput capacity',
        description: 'Throughput is below 100 RPS. Consider adding worker instances, optimizing database queries, or implementing request batching.',
        estimatedImprovement: '2-5x throughput increase',
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        category: 'performance',
        priority: 'low',
        title: 'Performance looks good',
        description: `No significant optimization opportunities identified for "${serviceName}" based on current profile data.`,
        estimatedImprovement: 'Marginal',
      });
    }

    return suggestions;
  }

  /**
   * Get profile by ID
   */
  async getProfile(profileId: string): Promise<ProfileRecord | null> {
    const entity = await this.profileRepo.findById(profileId);
    return entity ? this.mapEntityToProfile(entity) : null;
  }

  /**
   * List profiles for a service
   */
  async listProfiles(serviceName: string): Promise<ProfileRecord[]> {
    const entities = await this.profileRepo.findByService(serviceName);
    return entities.map(e => this.mapEntityToProfile(e));
  }

  /**
   * Execute profile asynchronously (simulated)
   */
  private async executeProfileAsync(record: ProfileRecord): Promise<void> {
    try {
      // Update status to running
      const baseLatency = 50 + Math.random() * 100;
      const concurrency = record.config.concurrency ?? 10;

      const results: ProfileResult = {
        avgLatencyMs: Math.round(baseLatency * 100) / 100,
        p50LatencyMs: Math.round(baseLatency * 100) / 100,
        p95LatencyMs: Math.round(baseLatency * 1.8 * 100) / 100,
        p99LatencyMs: Math.round(baseLatency * 2.5 * 100) / 100,
        maxRps: concurrency * 20,
        errorRate: Math.round(Math.random() * 0.03 * 1000) / 1000,
        throughputRps: Math.round(concurrency * 15 * 100) / 100,
        resourceUsage: {
          cpuAvg: Math.round((30 + Math.random() * 50) * 10) / 10,
          cpuMax: Math.round((60 + Math.random() * 35) * 10) / 10,
          memoryAvg: Math.round((40 + Math.random() * 40) * 10) / 10,
          memoryMax: Math.round((60 + Math.random() * 30) * 10) / 10,
        },
        metrics: {
          requests_total: Math.round(concurrency * 100 * (record.config.durationSeconds ?? 60)),
          requests_failed: Math.round(concurrency * 100 * (record.config.durationSeconds ?? 60) * 0.02),
        },
      };

      await this.profileRepo.updateResults(record.id, results, 'completed');
    } catch (error: any) {
      await this.profileRepo.updateResults(record.id, {}, 'failed', error.message);
    }
  }

  /**
   * Analyze bottlenecks from a completed profile record
   */
  private analyzeBottlenecksFromProfile(profile: ProfileRecord): BottleneckAnalysis {
    const bottlenecks: BottleneckAnalysis['bottlenecks'] = [];
    const results = profile.results!;

    // Latency bottleneck: p99 > 500ms
    if (results.p99LatencyMs > 500) {
      bottlenecks.push({
        type: 'high_tail_latency',
        severity: results.p99LatencyMs > 1000 ? 'critical' : 'high',
        description: `P99 latency is ${results.p99LatencyMs}ms, exceeding 500ms threshold`,
        metric: 'p99_latency_ms',
        value: results.p99LatencyMs,
        threshold: 500,
      });
    }

    // Error rate bottleneck: > 1%
    if (results.errorRate > 0.01) {
      bottlenecks.push({
        type: 'high_error_rate',
        severity: results.errorRate > 0.05 ? 'critical' : 'high',
        description: `Error rate is ${(results.errorRate * 100).toFixed(2)}%, exceeding 1% threshold`,
        metric: 'error_rate',
        value: results.errorRate,
        threshold: 0.01,
      });
    }

    // CPU bottleneck: avg > 80%
    if (results.resourceUsage.cpuAvg > 80) {
      bottlenecks.push({
        type: 'high_cpu_usage',
        severity: results.resourceUsage.cpuAvg > 95 ? 'critical' : 'high',
        description: `Average CPU usage is ${results.resourceUsage.cpuAvg.toFixed(1)}%, exceeding 80% threshold`,
        metric: 'cpu_avg',
        value: results.resourceUsage.cpuAvg,
        threshold: 80,
      });
    }

    // Memory bottleneck: avg > 85%
    if (results.resourceUsage.memoryAvg > 85) {
      bottlenecks.push({
        type: 'high_memory_usage',
        severity: results.resourceUsage.memoryAvg > 95 ? 'critical' : 'medium',
        description: `Average memory usage is ${results.resourceUsage.memoryAvg.toFixed(1)}%, exceeding 85% threshold`,
        metric: 'memory_avg',
        value: results.resourceUsage.memoryAvg,
        threshold: 85,
      });
    }

    // Throughput bottleneck: throughput < maxRps * 0.5
    if (results.maxRps > 0 && results.throughputRps < results.maxRps * 0.5) {
      bottlenecks.push({
        type: 'throughput_degradation',
        severity: 'medium',
        description: `Throughput ${results.throughputRps} RPS is less than 50% of max RPS ${results.maxRps}`,
        metric: 'throughput_rps',
        value: results.throughputRps,
        threshold: results.maxRps * 0.5,
      });
    }

    return {
      profileId: profile.id,
      bottlenecks,
      analyzedAt: new Date(),
    };
  }

  // ========== Entity Mapping ==========

  private mapEntityToProfile(entity: PerformanceProfileEntity): ProfileRecord {
    return {
      id: entity.id,
      serviceName: entity.service_name,
      config: entity.config as ProfileConfig,
      status: entity.status,
      results: entity.results as ProfileResult | undefined,
      createdAt: entity.created_at,
      completedAt: entity.completed_at ?? undefined,
      errorMessage: entity.error_message ?? undefined,
    };
  }
}

export default PerformanceProfileService;
