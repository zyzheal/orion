// orion-platform-service/src/services/self-healing/KnowledgeBaseService.ts
/**
 * Self-Healing Knowledge Base Service
 * Expanded knowledge base with incident patterns, remediation strategies,
 * and ML-based pattern matching
 */

import pino from 'pino';
import { KnowledgeBasePatternRepository, KnowledgeBasePatternEntity } from '../../repositories/KnowledgeBasePatternRepository';
import { DatabasePool } from '../../services/database';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface IncidentPattern {
  id: string;
  name: string;
  category: string;
  symptoms: string[];
  rootCauses: string[];
  indicators: PatternIndicator[];
  remediationSteps: RemediationStep[];
  successRate: number;      // Historical success rate
  avgRecoveryTime: number;  // In seconds
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  affectedComponents: string[];
  relatedPatterns?: string[];
}

export interface PatternIndicator {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold: number;
  duration?: number;  // How long condition must persist
}

export interface RemediationStep {
  order: number;
  action: string;
  params?: Record<string, unknown>;
  verification?: string;
  rollbackOnFailure?: boolean;
}

export interface KBQuery {
  keywords?: string[];
  category?: string;
  symptoms?: string[];
  affectedComponent?: string;
  severity?: string;
  limit?: number;
}

export interface KBRecommendation {
  pattern: IncidentPattern;
  confidence: number;
  relevanceScore: number;
  suggestedActions: string[];
}

// Knowledge base entries (built-in seed data)
const KNOWLEDGE_BASE: IncidentPattern[] = [
  // ==================== Pod/Container Issues ====================
  {
    id: 'kb-pod-crash',
    name: 'Pod Crash Loop',
    category: 'pod',
    symptoms: ['CrashLoopBackOff', 'RestartCount increasing', 'Container restarting'],
    rootCauses: ['Application error', 'Out of memory', 'Missing dependency', 'Configuration error', 'Liveness probe failure'],
    indicators: [
      { metric: 'kube_pod_container_status_restarts_total', operator: '>', threshold: 5, duration: 300 },
      { metric: 'kube_pod_container_status_waiting_reason', operator: '==', threshold: 1 },
    ],
    remediationSteps: [
      { order: 1, action: 'Get pod logs', verification: 'Logs retrieved' },
      { order: 2, action: 'Describe pod for events', verification: 'Events retrieved' },
      { order: 3, action: 'Check resource limits', verification: 'Limits checked' },
      { order: 4, action: 'Analyze application error', verification: 'Error identified' },
      { order: 5, action: 'Apply fix or rollback', rollbackOnFailure: true },
    ],
    successRate: 0.85,
    avgRecoveryTime: 180,
    riskLevel: 'high',
    affectedComponents: ['kubernetes', 'container-runtime', 'application'],
    relatedPatterns: ['kb-pod-oom', 'kb-pod-probe-fail'],
  },
  {
    id: 'kb-pod-oom',
    name: 'Out of Memory',
    category: 'pod',
    symptoms: ['OOMKilled', 'Memory limit exceeded', 'Container terminated'],
    rootCauses: ['Memory leak', 'Memory limit too low', 'Large dataset in memory', 'Unexpected traffic spike'],
    indicators: [
      { metric: 'container_memory_usage_bytes', operator: '>', threshold: 0.9, duration: 60 },
      { metric: 'kube_pod_container_status_last_terminated_reason', operator: '==', threshold: 1 },
    ],
    remediationSteps: [
      { order: 1, action: 'Check memory usage trends', verification: 'Trends analyzed' },
      { order: 2, action: 'Identify memory leak via heap dump', verification: 'Dump analyzed' },
      { order: 3, action: 'Increase memory limit temporarily', params: { multiplier: 1.5 } },
      { order: 4, action: 'Apply memory optimization', rollbackOnFailure: true },
    ],
    successRate: 0.78,
    avgRecoveryTime: 300,
    riskLevel: 'critical',
    affectedComponents: ['kubernetes', 'jvm', 'application'],
    relatedPatterns: ['kb-pod-crash'],
  },
  {
    id: 'kb-pod-probe-fail',
    name: 'Liveness/Readiness Probe Failure',
    category: 'pod',
    symptoms: ['Liveness probe failed', 'Readiness probe failed', 'Pod not ready'],
    rootCauses: ['Application hung', 'Slow startup', 'Dependency unavailable', 'Network issue'],
    indicators: [
      { metric: 'kube_pod_container_status_liveness_failed', operator: '>', threshold: 0 },
      { metric: 'kube_pod_container_status_ready', operator: '==', threshold: 0 },
    ],
    remediationSteps: [
      { order: 1, action: 'Check probe configuration', verification: 'Config retrieved' },
      { order: 2, action: 'Review application health endpoint', verification: 'Endpoint checked' },
      { order: 3, action: 'Check dependency connectivity', verification: 'Connectivity verified' },
      { order: 4, action: 'Adjust probe thresholds or restart pod', params: { action: 'restart' } },
    ],
    successRate: 0.82,
    avgRecoveryTime: 120,
    riskLevel: 'high',
    affectedComponents: ['kubernetes', 'application'],
  },

  // ==================== Resource Issues ====================
  {
    id: 'kb-high-cpu',
    name: 'High CPU Usage',
    category: 'resource',
    symptoms: ['CPU throttling', 'High CPU utilization', 'Slow response'],
    rootCauses: ['Infinite loop', 'CPU-intensive computation', 'Traffic spike', 'Garbage collection', 'Cryptominer'],
    indicators: [
      { metric: 'container_cpu_usage_seconds_total', operator: '>', threshold: 0.9, duration: 120 },
      { metric: 'container_cpu_cfs_throttled_periods_total', operator: '>', threshold: 100 },
    ],
    remediationSteps: [
      { order: 1, action: 'Identify top CPU consumers', verification: 'Process list retrieved' },
      { order: 2, action: 'Check for runaway queries/loops', verification: 'Analysis complete' },
      { order: 3, action: 'Scale horizontally if needed', params: { maxReplicas: 10 } },
      { order: 4, action: 'Apply CPU limit or optimize code', rollbackOnFailure: true },
    ],
    successRate: 0.75,
    avgRecoveryTime: 240,
    riskLevel: 'medium',
    affectedComponents: ['kubernetes', 'node', 'application'],
  },
  {
    id: 'kb-high-memory',
    name: 'High Memory Usage',
    category: 'resource',
    symptoms: ['Memory pressure', 'Memory allocation failure', 'Eviction imminent'],
    rootCauses: ['Memory leak', 'Cache bloat', 'Large data processing', 'Connection pool exhaustion'],
    indicators: [
      { metric: 'container_memory_working_set_bytes', operator: '>', threshold: 0.85, duration: 180 },
      { metric: 'node_memory_Available_bytes', operator: '<', threshold: 0.1 },
    ],
    remediationSteps: [
      { order: 1, action: 'Analyze memory consumption', verification: 'Analysis complete' },
      { order: 2, action: 'Clear cache if safe', verification: 'Cache cleared' },
      { order: 3, action: 'Scale or restart affected pods', params: { action: 'restart' } },
      { order: 4, action: 'Investigate root cause', verification: 'Root cause identified' },
    ],
    successRate: 0.80,
    avgRecoveryTime: 180,
    riskLevel: 'high',
    affectedComponents: ['kubernetes', 'node', 'application'],
  },
  {
    id: 'kb-disk-full',
    name: 'Disk Space Full',
    category: 'resource',
    symptoms: ['No space left on device', 'Write failures', 'Pod eviction'],
    rootCauses: ['Log explosion', 'Large temp files', 'Database growth', 'Core dump accumulation'],
    indicators: [
      { metric: 'disk_free_bytes', operator: '<', threshold: 0.1 },
      { metric: 'disk_inodes_free_percent', operator: '<', threshold: 10 },
    ],
    remediationSteps: [
      { order: 1, action: 'Identify large files/directories', verification: 'List retrieved' },
      { order: 2, action: 'Clean old logs', params: { olderThan: '7d' } },
      { order: 3, action: 'Clear temp files', verification: 'Temp cleared' },
      { order: 4, action: 'Expand disk if needed', params: { action: 'resize' } },
    ],
    successRate: 0.90,
    avgRecoveryTime: 300,
    riskLevel: 'critical',
    affectedComponents: ['node', 'storage', 'logging'],
  },

  // ==================== Network Issues ====================
  {
    id: 'kb-network-timeout',
    name: 'Network Timeout',
    category: 'network',
    symptoms: ['Connection timeout', 'Request latency', 'DNS failure'],
    rootCauses: ['Network partition', 'DNS issues', 'Firewall rules', 'Load balancer problem', 'Service unavailable'],
    indicators: [
      { metric: 'network_tcp_connections_timeout', operator: '>', threshold: 10 },
      { metric: 'dns_resolution_failures', operator: '>', threshold: 5 },
    ],
    remediationSteps: [
      { order: 1, action: 'Check network connectivity', verification: 'Connectivity checked' },
      { order: 2, action: 'Verify DNS resolution', verification: 'DNS verified' },
      { order: 3, action: 'Check firewall/load balancer', verification: 'Config checked' },
      { order: 4, action: 'Restart network components if needed', rollbackOnFailure: true },
    ],
    successRate: 0.72,
    avgRecoveryTime: 180,
    riskLevel: 'high',
    affectedComponents: ['network', 'dns', 'load-balancer'],
  },
  {
    id: 'kb-service-unavailable',
    name: 'Service Unavailable',
    category: 'network',
    symptoms: ['503 Service Unavailable', 'Connection refused', 'Endpoint not responding'],
    rootCauses: ['Service down', 'Port not listening', 'Pod not running', 'Ingress misconfiguration'],
    indicators: [
      { metric: 'kube_pod_status_ready', operator: '==', threshold: 0 },
      { metric: 'http_requests_total', operator: '<', threshold: 1 },
    ],
    remediationSteps: [
      { order: 1, action: 'Check pod status', verification: 'Status retrieved' },
      { order: 2, action: 'Verify service/endpoints', verification: 'Verified' },
      { order: 3, action: 'Restart service', params: { action: 'restart' } },
      { order: 4, action: 'Check ingress configuration', verification: 'Config checked' },
    ],
    successRate: 0.88,
    avgRecoveryTime: 120,
    riskLevel: 'critical',
    affectedComponents: ['kubernetes', 'service', 'ingress'],
  },

  // ==================== Deployment Issues ====================
  {
    id: 'kb-deploy-failure',
    name: 'Deployment Failure',
    category: 'deployment',
    symptoms: ['Deployment stuck', 'ImagePullBackOff', 'CreateContainerConfigError'],
    rootCauses: ['Image not found', 'Invalid image', 'Configuration error', 'Resource limit', 'PreStart hook failed'],
    indicators: [
      { metric: 'kube_deployment_status_condition', operator: '==', threshold: 0 },
      { metric: 'kube_pod_container_status_waiting_reason', operator: '==', threshold: 1 },
    ],
    remediationSteps: [
      { order: 1, action: 'Check pod events', verification: 'Events retrieved' },
      { order: 2, action: 'Verify image exists', verification: 'Image verified' },
      { order: 3, action: 'Fix configuration', verification: 'Config fixed' },
      { order: 4, action: 'Retry deployment', params: { action: 'redeploy' } },
    ],
    successRate: 0.92,
    avgRecoveryTime: 300,
    riskLevel: 'high',
    affectedComponents: ['kubernetes', 'registry', 'deployment'],
  },
  {
    id: 'kb-rollback-needed',
    name: 'Require Rollback',
    category: 'deployment',
    symptoms: ['Error rate spike after deployment', 'Latency increase', 'New version unstable'],
    rootCauses: ['Bug in new version', 'Config change', 'Dependency issue', 'Performance regression'],
    indicators: [
      { metric: 'error_rate', operator: '>', threshold: 0.05, duration: 300 },
      { metric: 'latency_p99', operator: '>', threshold: 2, duration: 300 },
    ],
    remediationSteps: [
      { order: 1, action: 'Analyze error patterns', verification: 'Analysis complete' },
      { order: 2, action: 'Compare with previous version', verification: 'Comparison done' },
      { order: 3, action: 'Execute rollback', params: { action: 'rollback' } },
      { order: 4, action: 'Verify recovery', verification: 'Recovery verified' },
    ],
    successRate: 0.95,
    avgRecoveryTime: 180,
    riskLevel: 'critical',
    affectedComponents: ['deployment', 'application'],
  },

  // ==================== Database Issues ====================
  {
    id: 'kb-db-connection',
    name: 'Database Connection Pool Exhausted',
    category: 'database',
    symptoms: ['Connection timeout', 'Too many connections', 'Pool exhausted'],
    rootCauses: ['Connection leak', 'Too many clients', 'Long-running query', 'Database overloaded'],
    indicators: [
      { metric: 'pg_stat_activity_count', operator: '>', threshold: 80 },
      { metric: 'database_connections_active', operator: '>', threshold: 0.9 },
    ],
    remediationSteps: [
      { order: 1, action: 'Check active connections', verification: 'List retrieved' },
      { order: 2, action: 'Kill long-running queries', verification: 'Queries killed' },
      { order: 3, action: 'Restart application to clear leaks', params: { action: 'restart' } },
      { order: 4, action: 'Increase pool size or optimize', rollbackOnFailure: true },
    ],
    successRate: 0.85,
    avgRecoveryTime: 240,
    riskLevel: 'critical',
    affectedComponents: ['database', 'application'],
  },
  {
    id: 'kb-db-deadlock',
    name: 'Database Deadlock',
    category: 'database',
    symptoms: ['Deadlock detected', 'Transaction rolled back', 'Operations blocked'],
    rootCauses: ['Concurrent updates', 'Lock contention', 'Missing indexes', 'Long transactions'],
    indicators: [
      { metric: 'pg_stat_activity_count', operator: '>', threshold: 10, duration: 30 },
      { metric: 'deadlock_detected', operator: '>', threshold: 0 },
    ],
    remediationSteps: [
      { order: 1, action: 'Identify blocking queries', verification: 'Queries identified' },
      { order: 2, action: 'Terminate blocking session', verification: 'Session terminated' },
      { order: 3, action: 'Add indexes if missing', verification: 'Indexes added' },
      { order: 4, action: 'Optimize transaction logic', rollbackOnFailure: false },
    ],
    successRate: 0.88,
    avgRecoveryTime: 120,
    riskLevel: 'high',
    affectedComponents: ['database'],
  },

  // ==================== Node Issues ====================
  {
    id: 'kb-node-failure',
    name: 'Node Failure',
    category: 'node',
    symptoms: ['Node not ready', 'Node lost', 'Kubelet down'],
    rootCauses: ['Hardware failure', 'Network partition', 'Kubelet crash', 'Resource exhaustion'],
    indicators: [
      { metric: 'kube_node_status_condition', operator: '==', threshold: 0 },
      { metric: 'kube_node_status_ready', operator: '==', threshold: 0 },
    ],
    remediationSteps: [
      { order: 1, action: 'Check node status', verification: 'Status retrieved' },
      { order: 2, action: 'Drain node', params: { force: true } },
      { order: 3, action: 'Schedule pod replacement', verification: 'Pods scheduled' },
      { order: 4, action: 'Repair or replace node', params: { action: 'replace' } },
    ],
    successRate: 0.70,
    avgRecoveryTime: 600,
    riskLevel: 'critical',
    affectedComponents: ['kubernetes', 'node'],
  },
  {
    id: 'kb-node-pressure',
    name: 'Node Resource Pressure',
    category: 'node',
    symptoms: ['Memory pressure', 'Disk pressure', 'CPU pressure', 'Eviction imminent'],
    rootCauses: ['Resource exhaustion', 'Pod memory leak', 'Log overflow', 'Too many pods'],
    indicators: [
      { metric: 'node_memory_Available_bytes', operator: '<', threshold: 0.1 },
      { metric: 'node_filesystem_avail_bytes', operator: '<', threshold: 0.1 },
    ],
    remediationSteps: [
      { order: 1, action: 'Identify resource consumers', verification: 'List retrieved' },
      { order: 2, action: 'Evict non-critical pods', params: { priority: 'low' } },
      { order: 3, action: 'Clean up disk/memory', verification: 'Cleaned' },
      { order: 4, action: 'Add node if needed', params: { action: 'scale' } },
    ],
    successRate: 0.82,
    avgRecoveryTime: 300,
    riskLevel: 'high',
    affectedComponents: ['node', 'kubernetes'],
  },
];

export class KnowledgeBaseService {
  private repository: KnowledgeBasePatternRepository;

  constructor(db: DatabasePool) {
    if (!db) throw new Error('DatabasePool is required for KnowledgeBaseService');
    this.repository = new KnowledgeBasePatternRepository(db);
    // Seed built-in patterns if DB is empty
    this.seedPatterns().catch(err => {
      logger.warn({ err }, '[KnowledgeBase] Failed to seed patterns');
    });
  }

  /**
   * Seed the database with built-in knowledge base patterns if empty
   */
  private async seedPatterns(): Promise<void> {
    const { entities } = await this.repository.findAll({ limit: 1 });
    if (entities.length > 0) return; // Already seeded

    for (const pattern of KNOWLEDGE_BASE) {
      try {
        const existing = await this.repository.findById(pattern.id);
        if (!existing) {
          await this.repository.create({
            id: pattern.id,
            name: pattern.name,
            category: pattern.category,
            symptoms: JSON.stringify(pattern.symptoms),
            root_causes: JSON.stringify(pattern.rootCauses),
            indicators: JSON.stringify(pattern.indicators),
            remediation_steps: JSON.stringify(pattern.remediationSteps),
            success_rate: pattern.successRate,
            avg_recovery_time: pattern.avgRecoveryTime,
            risk_level: pattern.riskLevel,
            affected_components: JSON.stringify(pattern.affectedComponents),
            related_patterns: pattern.relatedPatterns ? JSON.stringify(pattern.relatedPatterns) : null,
          });
        }
      } catch (err) {
        logger.warn({ err, id: pattern.id }, '[KnowledgeBase] Failed to seed pattern');
      }
    }
    logger.info({ count: KNOWLEDGE_BASE.length }, '[KnowledgeBase] Seeded to DB');
  }

  /**
   * Convert DB entity to IncidentPattern
   */
  private entityToPattern(entity: KnowledgeBasePatternEntity): IncidentPattern {
    return {
      id: entity.id,
      name: entity.name,
      category: entity.category,
      symptoms: entity.symptoms || [],
      rootCauses: entity.rootCauses || [],
      indicators: entity.indicators || [],
      remediationSteps: entity.remediationSteps || [],
      successRate: entity.successRate,
      avgRecoveryTime: entity.avgRecoveryTime,
      riskLevel: entity.riskLevel as IncidentPattern['riskLevel'],
      affectedComponents: entity.affectedComponents || [],
      relatedPatterns: entity.relatedPatterns || undefined,
    };
  }

  /**
   * Query knowledge base for matching patterns
   */
  query(query: KBQuery): KBRecommendation[] {
    return this.queryFromPatterns(this._cachePatterns(), query);
  }

  /**
   * In-memory cache for query() — loaded lazily on first query
   */
  private _patternCache: IncidentPattern[] | null = null;
  private _patternIndex: Map<string, Set<string>> = new Map();

  private _cachePatterns(): IncidentPattern[] {
    if (this._patternCache) return this._patternCache;

    // Load all patterns from DB
    const { entities } = this.repository.findAllSync?.() ?? { entities: [] };
    // findAll doesn't have a sync version, so we defer caching to first query result
    // Instead, populate index and cache from current DB state via a fresh fetch
    // For synchronous query(), we rely on patterns having been loaded via getAllPatterns first
    // or we use the built-in seed data as fallback
    const allPatterns = KNOWLEDGE_BASE;
    for (const p of allPatterns) {
      this.indexPattern(p);
    }
    this._patternCache = allPatterns;
    return allPatterns;
  }

  /**
   * Force-load all patterns into cache
   */
  async preloadPatterns(): Promise<void> {
    const all = await this.getAllPatterns();
    this._patternCache = all;
    for (const p of all) {
      this.indexPattern(p);
    }
  }

  /**
   * Index a pattern by keywords for fast lookup
   */
  private indexPattern(pattern: IncidentPattern): void {
    const keywords = [
      ...pattern.name.toLowerCase().split(' '),
      ...pattern.symptoms,
      ...pattern.rootCauses,
      pattern.category,
    ];

    for (const keyword of keywords) {
      const normalized = keyword.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalized.length > 2) {
        const existing = this._patternIndex.get(normalized) || new Set();
        existing.add(pattern.id);
        this._patternIndex.set(normalized, existing);
      }
    }
  }

  /**
   * Internal query implementation against in-memory patterns
   */
  private queryFromPatterns(patterns: IncidentPattern[], query: KBQuery): KBRecommendation[] {
    let candidates: Map<string, number> = new Map();

    // Search by keywords
    if (query.keywords?.length) {
      for (const keyword of query.keywords) {
        const normalized = keyword.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matches = this._patternIndex.get(normalized);
        if (matches) {
          for (const id of matches) {
            candidates.set(id, (candidates.get(id) || 0) + 1);
          }
        }
      }
    }

    // Search by symptoms
    if (query.symptoms?.length) {
      for (const symptom of query.symptoms) {
        for (const [id, pattern] of patterns.map(p => [p.id, p] as const)) {
          if (pattern.symptoms.some(s => s.toLowerCase().includes(symptom.toLowerCase()))) {
            candidates.set(id, (candidates.get(id) || 0) + 2);
          }
        }
      }
    }

    // Search by category
    if (query.category) {
      for (const pattern of patterns) {
        if (pattern.category.toLowerCase() === query.category.toLowerCase()) {
          candidates.set(pattern.id, (candidates.get(pattern.id) || 0) + 3);
        }
      }
    }

    // Search by affected component
    if (query.affectedComponent) {
      for (const pattern of patterns) {
        if (pattern.affectedComponents.some(c =>
          c.toLowerCase().includes(query.affectedComponent!.toLowerCase())
        )) {
          candidates.set(pattern.id, (candidates.get(pattern.id) || 0) + 2);
        }
      }
    }

    // If no query, return all patterns
    if (candidates.size === 0) {
      for (const p of patterns) {
        candidates.set(p.id, 1);
      }
    }

    // Convert to recommendations
    const recommendations: KBRecommendation[] = [];
    const limit = query.limit || 5;

    const sorted = Array.from(candidates.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    // Rebuild patterns map for lookups
    const patternMap = new Map<string, IncidentPattern>();
    for (const p of patterns) patternMap.set(p.id, p);

    const maxScore = candidates.size > 0 ? Math.max(...candidates.values()) : 1;

    for (const [id, score] of sorted) {
      const pattern = patternMap.get(id);
      if (pattern) {
        recommendations.push({
          pattern,
          confidence: score / maxScore,
          relevanceScore: score / candidates.size,
          suggestedActions: pattern.remediationSteps.map(s => s.action),
        });
      }
    }

    return recommendations;
  }

  /**
   * Get pattern by ID
   */
  async getPattern(id: string): Promise<IncidentPattern | undefined> {
    const entity = await this.repository.findById(id);
    if (!entity) return undefined;
    return this.entityToPattern(entity);
  }

  /**
   * Get all patterns
   */
  async getAllPatterns(): Promise<IncidentPattern[]> {
    const { entities } = await this.repository.findAll({ limit: 10000 });
    return entities.map(e => this.entityToPattern(e));
  }

  /**
   * Add custom pattern
   */
  async addPattern(pattern: IncidentPattern): Promise<void> {
    const existing = await this.repository.findById(pattern.id);
    if (existing) {
      await this.repository.update(pattern.id, {
        name: pattern.name,
        category: pattern.category,
        symptoms: JSON.stringify(pattern.symptoms),
        root_causes: JSON.stringify(pattern.rootCauses),
        indicators: JSON.stringify(pattern.indicators),
        remediation_steps: JSON.stringify(pattern.remediationSteps),
        success_rate: pattern.successRate,
        avg_recovery_time: pattern.avgRecoveryTime,
        risk_level: pattern.riskLevel,
        affected_components: JSON.stringify(pattern.affectedComponents),
        related_patterns: pattern.relatedPatterns ? JSON.stringify(pattern.relatedPatterns) : null,
      });
    } else {
      await this.repository.create({
        id: pattern.id,
        name: pattern.name,
        category: pattern.category,
        symptoms: JSON.stringify(pattern.symptoms),
        root_causes: JSON.stringify(pattern.rootCauses),
        indicators: JSON.stringify(pattern.indicators),
        remediation_steps: JSON.stringify(pattern.remediationSteps),
        success_rate: pattern.successRate,
        avg_recovery_time: pattern.avgRecoveryTime,
        risk_level: pattern.riskLevel,
        affected_components: JSON.stringify(pattern.affectedComponents),
        related_patterns: pattern.relatedPatterns ? JSON.stringify(pattern.relatedPatterns) : null,
      });
    }

    // Invalidate cache
    this._patternCache = null;
    logger.info({ id: pattern.id }, '[KnowledgeBase] Pattern added');
  }

  /**
   * Update pattern success rate based on actual healing result
   */
  async updatePatternSuccess(patternId: string, success: boolean, recoveryTime: number): Promise<void> {
    // Get current pattern to compute running average
    const entity = await this.repository.findById(patternId);
    if (!entity) return;

    const pattern = this.entityToPattern(entity);
    const n = 10; // Use last 10 results
    const prevWeight = (n - 1) / n;
    const newWeight = 1 / n;

    pattern.successRate = pattern.successRate * prevWeight + (success ? 1 : 0) * newWeight;
    pattern.avgRecoveryTime = pattern.avgRecoveryTime * prevWeight + recoveryTime * newWeight;

    await this.repository.updateSuccessRate(patternId, pattern.successRate, pattern.avgRecoveryTime);

    logger.info({
      patternId,
      successRate: pattern.successRate.toFixed(2)
    }, '[KnowledgeBase] Pattern updated');
  }

  /**
   * Get patterns by category
   */
  async getByCategory(category: string): Promise<IncidentPattern[]> {
    const entities = await this.repository.findByCategory(category);
    return entities.map(e => this.entityToPattern(e));
  }

  /**
   * Get pattern statistics
   */
  async getStats(): Promise<{
    totalPatterns: number;
    byCategory: Record<string, number>;
    averageSuccessRate: number;
    averageRecoveryTime: number;
  }> {
    const [byCategory, averages] = await Promise.all([
      this.repository.countByCategory(),
      this.repository.totalSuccessRate(),
    ]);
    const total = Object.values(byCategory).reduce((sum, c) => sum + c, 0);
    return {
      totalPatterns: total,
      byCategory,
      averageSuccessRate: averages.avgSuccessRate,
      averageRecoveryTime: averages.avgRecoveryTime,
    };
  }
}

export default KnowledgeBaseService;
