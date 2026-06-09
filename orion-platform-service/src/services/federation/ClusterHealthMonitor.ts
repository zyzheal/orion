/**
 * ClusterHealthMonitor - Cluster health monitoring with tenant isolation
 *
 * Provides health checking, metrics collection, and anomaly detection
 * for federated clusters.
 * Uses PostgreSQL Repository as primary storage. In-memory Maps serve as
 * optional read-through cache for hot data.
 */
import { v4 as uuidv4 } from 'uuid';
import {
  ClusterRecordRepository,
  ClusterHealthCheckRepository,
  ClusterMetricsRepository,
  ClusterAnomalyRepository,
} from '../../repositories/ClusterHealthRepository';

export interface ClusterRecord {
  id: string;
  tenantId: string;
  name: string;
  endpoint: string;
  region: string;
  status: 'online' | 'offline' | 'maintenance' | 'degraded';
  nodeCount: number;
  createdAt: Date;
  lastHealthCheck?: Date;
}

export interface HealthCheckResult {
  clusterId: string;
  clusterName: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  apiServerReachable: boolean;
  apiServerLatencyMs: number;
  nodeCount: number;
  nodeReadyCount: number;
  podCount: number;
  cpuUsagePct: number;
  memoryUsagePct: number;
  diskUsagePct: number;
  anomalies: string[];
  checkedAt: Date;
}

export interface ClusterMetrics {
  clusterId: string;
  clusterName: string;
  timeWindow: string;
  cpuUsageAvg: number;
  cpuUsageMax: number;
  memoryUsageAvg: number;
  memoryUsageMax: number;
  networkInBytes: number;
  networkOutBytes: number;
  podCountAvg: number;
  podRestartCount: number;
  errorCount: number;
  latencyP50Ms: number;
  latencyP99Ms: number;
  collectedAt: Date;
}

export interface AnomalyDetectionResult {
  clusterId: string;
  clusterName: string;
  anomalyType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  metricsSnapshot: Record<string, any>;
}

export class ClusterHealthMonitor {
  // In-memory read-through cache (optional, populated lazily from repository)
  private clusterCache: Map<string, ClusterRecord> = new Map();
  private healthCheckCache: Map<string, HealthCheckResult[]> = new Map();
  private metricsCache: Map<string, ClusterMetrics[]> = new Map();
  private anomalyCache: Map<string, AnomalyDetectionResult[]> = new Map();
  private tenantClusterCache: Map<string, string[]> = new Map();

  // PostgreSQL Repositories (primary storage)
  private clusterRepo?: ClusterRecordRepository;
  private healthCheckRepo?: ClusterHealthCheckRepository;
  private metricsRepo?: ClusterMetricsRepository;
  private anomalyRepo?: ClusterAnomalyRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.clusterRepo = new ClusterRecordRepository(db);
      this.healthCheckRepo = new ClusterHealthCheckRepository(db);
      this.metricsRepo = new ClusterMetricsRepository(db);
      this.anomalyRepo = new ClusterAnomalyRepository(db);
    }
  }

  /** Whether repository (PostgreSQL) is available */
  private get hasRepository(): boolean {
    return this.clusterRepo !== undefined;
  }

  /**
   * Load all cluster data from repository into cache on startup
   */
  async loadFromRepository(): Promise<void> {
    if (!this.hasRepository || !this.clusterRepo) return;

    try {
      const allClusters = await this.clusterRepo.findAll({ limit: 1000 });
      for (const entity of allClusters.entities) {
        const cluster: ClusterRecord = {
          id: entity.id,
          tenantId: entity.tenantId,
          name: entity.name,
          endpoint: entity.endpoint,
          region: entity.region,
          status: entity.status as ClusterRecord['status'],
          nodeCount: entity.nodeCount,
          createdAt: entity.createdAt,
          lastHealthCheck: entity.lastHealthCheck || undefined,
        };
        this.clusterCache.set(cluster.id, cluster);

        const tenantClusters = this.tenantClusterCache.get(cluster.tenantId) ?? [];
        if (!tenantClusters.includes(cluster.id)) {
          tenantClusters.push(cluster.id);
        }
        this.tenantClusterCache.set(cluster.tenantId, tenantClusters);
      }
      console.log(`[ClusterHealthMonitor] Loaded ${allClusters.entities.length} clusters from repository`);
    } catch (err) {
      console.warn('[ClusterHealthMonitor] Failed to load from repository:', err);
    }
  }

  /**
   * Register a cluster.
   * Writes to PostgreSQL first (when available), then updates cache.
   */
  async registerCluster(
    tenantId: string,
    input: { name: string; endpoint: string; region: string; nodeCount?: number }
  ): Promise<ClusterRecord> {
    const id = uuidv4();
    const cluster: ClusterRecord = {
      id,
      tenantId,
      name: input.name,
      endpoint: input.endpoint,
      region: input.region,
      status: 'online',
      nodeCount: input.nodeCount ?? 3,
      createdAt: new Date(),
    };

    // Persist to repository first (primary storage)
    if (this.hasRepository && this.clusterRepo) {
      await this.clusterRepo.create({
        id,
        tenant_id: tenantId,
        name: input.name,
        endpoint: input.endpoint,
        region: input.region,
        status: 'online',
        node_count: input.nodeCount ?? 3,
        last_health_check: null,
      });
    }

    // Update cache
    this.clusterCache.set(id, cluster);
    const tenantClusters = this.tenantClusterCache.get(tenantId) ?? [];
    tenantClusters.push(id);
    this.tenantClusterCache.set(tenantId, tenantClusters);

    return cluster;
  }

  /**
   * Perform health check on a cluster.
   * Writes result to PostgreSQL first, then updates cache.
   */
  async checkClusterHealth(clusterId: string): Promise<HealthCheckResult | null> {
    const cluster = await this.getClusterById(clusterId);
    if (!cluster) {
      return null;
    }

    // Simulate health check results
    const apiServerLatencyMs = Math.round(10 + Math.random() * 200);
    const nodeReadyCount = cluster.status === 'offline' ? 0 : cluster.nodeCount - (cluster.status === 'degraded' ? Math.floor(cluster.nodeCount * 0.3) : 0);
    const cpuUsage = Math.round((30 + Math.random() * 60) * 10) / 10;
    const memoryUsage = Math.round((40 + Math.random() * 50) * 10) / 10;
    const diskUsage = Math.round((20 + Math.random() * 60) * 10) / 10;

    const apiServerReachable = cluster.status !== 'offline' && apiServerLatencyMs < 500;

    const anomalies: string[] = [];
    if (cpuUsage > 90) anomalies.push('high_cpu');
    if (memoryUsage > 85) anomalies.push('high_memory');
    if (diskUsage > 80) anomalies.push('high_disk');
    if (nodeReadyCount < cluster.nodeCount) anomalies.push('node_not_ready');
    if (!apiServerReachable) anomalies.push('api_server_unreachable');

    let status: HealthCheckResult['status'];
    if (!apiServerReachable) {
      status = 'unhealthy';
    } else if (anomalies.length > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    const result: HealthCheckResult = {
      clusterId,
      clusterName: cluster.name,
      status,
      apiServerReachable,
      apiServerLatencyMs,
      nodeCount: cluster.nodeCount,
      nodeReadyCount,
      podCount: Math.round(cluster.nodeCount * 50 + Math.random() * 100),
      cpuUsagePct: cpuUsage,
      memoryUsagePct: memoryUsage,
      diskUsagePct: diskUsage,
      anomalies,
      checkedAt: new Date(),
    };

    // Persist to repository first
    if (this.hasRepository && this.healthCheckRepo) {
      await this.healthCheckRepo.create({
        id: `${clusterId}-${Date.now()}`,
        cluster_id: clusterId,
        cluster_name: cluster.name,
        status,
        api_server_reachable: apiServerReachable,
        api_server_latency_ms: apiServerLatencyMs,
        node_count: cluster.nodeCount,
        node_ready_count: nodeReadyCount,
        pod_count: result.podCount,
        cpu_usage_pct: cpuUsage,
        memory_usage_pct: memoryUsage,
        disk_usage_pct: diskUsage,
        anomalies,
        checked_at: new Date(),
      });
    }

    // Update cluster lastHealthCheck in repository
    if (this.hasRepository && this.clusterRepo) {
      await this.clusterRepo.updateLastHealthCheck(clusterId);
    }

    // Update cache
    cluster.lastHealthCheck = new Date();
    this.clusterCache.set(clusterId, cluster);

    const history = this.healthCheckCache.get(clusterId) ?? [];
    history.push(result);
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    this.healthCheckCache.set(clusterId, history);

    return result;
  }

  /**
   * Get cluster metrics for a given time window.
   * Tries cache first, then repository, then generates simulated data.
   */
  async getClusterMetrics(clusterId: string, timeWindow: string = '1h'): Promise<ClusterMetrics | null> {
    const cluster = await this.getClusterById(clusterId);
    if (!cluster) {
      return null;
    }

    // Check cache first
    const cached = this.metricsCache.get(clusterId) ?? [];
    const matching = cached.filter((m) => m.timeWindow === timeWindow);
    if (matching.length > 0) {
      return matching[matching.length - 1];
    }

    // Check repository for existing metrics
    if (this.hasRepository && this.metricsRepo) {
      try {
        const entity = await this.metricsRepo.getLatestByClusterId(clusterId, timeWindow);
        if (entity) {
          const metrics: ClusterMetrics = {
            clusterId: entity.clusterId,
            clusterName: entity.clusterName || cluster.name,
            timeWindow: entity.timeWindow,
            cpuUsageAvg: entity.cpuUsageAvg,
            cpuUsageMax: entity.cpuUsageMax,
            memoryUsageAvg: entity.memoryUsageAvg,
            memoryUsageMax: entity.memoryUsageMax,
            networkInBytes: entity.networkInBytes,
            networkOutBytes: entity.networkOutBytes,
            podCountAvg: entity.podCountAvg,
            podRestartCount: entity.podRestartCount,
            errorCount: entity.errorCount,
            latencyP50Ms: entity.latencyP50Ms,
            latencyP99Ms: entity.latencyP99Ms,
            collectedAt: entity.collectedAt,
          };
          // Populate cache
          this.metricsCache.set(clusterId, [...cached, metrics]);
          return metrics;
        }
      } catch {
        // Fall through to generate simulated data
      }
    }

    // Generate simulated metrics
    const generated: ClusterMetrics = {
      clusterId,
      clusterName: cluster.name,
      timeWindow,
      cpuUsageAvg: Math.round((30 + Math.random() * 40) * 10) / 10,
      cpuUsageMax: Math.round((70 + Math.random() * 25) * 10) / 10,
      memoryUsageAvg: Math.round((40 + Math.random() * 35) * 10) / 10,
      memoryUsageMax: Math.round((70 + Math.random() * 25) * 10) / 10,
      networkInBytes: Math.round(Math.random() * 1000000000),
      networkOutBytes: Math.round(Math.random() * 500000000),
      podCountAvg: Math.round(cluster.nodeCount * 40 + Math.random() * 50),
      podRestartCount: Math.round(Math.random() * 10),
      errorCount: Math.round(Math.random() * 20),
      latencyP50Ms: Math.round((20 + Math.random() * 80) * 10) / 10,
      latencyP99Ms: Math.round((100 + Math.random() * 400) * 10) / 10,
      collectedAt: new Date(),
    };

    // Persist to repository first
    if (this.hasRepository && this.metricsRepo) {
      await this.metricsRepo.create({
        id: `${clusterId}-${timeWindow}-${Date.now()}`,
        cluster_id: clusterId,
        cluster_name: cluster.name,
        time_window: timeWindow,
        cpu_usage_avg: generated.cpuUsageAvg,
        cpu_usage_max: generated.cpuUsageMax,
        memory_usage_avg: generated.memoryUsageAvg,
        memory_usage_max: generated.memoryUsageMax,
        network_in_bytes: generated.networkInBytes,
        network_out_bytes: generated.networkOutBytes,
        pod_count_avg: generated.podCountAvg,
        pod_restart_count: generated.podRestartCount,
        error_count: generated.errorCount,
        latency_p50_ms: generated.latencyP50Ms,
        latency_p99_ms: generated.latencyP99Ms,
        collected_at: generated.collectedAt,
      });
    }

    // Update cache
    cached.push(generated);
    if (cached.length > 200) {
      cached.splice(0, cached.length - 200);
    }
    this.metricsCache.set(clusterId, cached);

    return generated;
  }

  /**
   * Detect anomalies for a cluster based on health data.
   * Reads latest health check from cache or repository.
   */
  async detectClusterAnomalies(clusterId: string): Promise<AnomalyDetectionResult[]> {
    const cluster = await this.getClusterById(clusterId);
    if (!cluster) {
      return [];
    }

    const anomalies: AnomalyDetectionResult[] = [];

    // Get latest health check from cache or repository
    let latest: HealthCheckResult | null = null;
    const history = this.healthCheckCache.get(clusterId) ?? [];
    if (history.length > 0) {
      latest = history[history.length - 1];
    } else if (this.hasRepository && this.healthCheckRepo) {
      try {
        const entity = await this.healthCheckRepo.getLatestByClusterId(clusterId);
        if (entity) {
          latest = {
            clusterId: entity.clusterId,
            clusterName: entity.clusterName || '',
            status: entity.status as HealthCheckResult['status'],
            apiServerReachable: entity.apiServerReachable,
            apiServerLatencyMs: entity.apiServerLatencyMs,
            nodeCount: entity.nodeCount,
            nodeReadyCount: entity.nodeReadyCount,
            podCount: entity.podCount,
            cpuUsagePct: entity.cpuUsagePct,
            memoryUsagePct: entity.memoryUsagePct,
            diskUsagePct: entity.diskUsagePct,
            anomalies: entity.anomalies,
            checkedAt: entity.checkedAt,
          };
        }
      } catch {
        // Fall through - latest stays null
      }
    }

    if (!latest) {
      anomalies.push({
        clusterId,
        clusterName: cluster.name,
        anomalyType: 'no_data',
        severity: 'medium',
        description: 'No health check data available for cluster',
        detectedAt: new Date(),
        metricsSnapshot: {},
      });
      await this.recordAnomalies(clusterId, anomalies);
      return anomalies;
    }

    // CPU anomaly (>90%)
    if (latest.cpuUsagePct > 90) {
      anomalies.push({
        clusterId,
        clusterName: cluster.name,
        anomalyType: 'high_cpu',
        severity: latest.cpuUsagePct > 95 ? 'critical' : 'high',
        description: `CPU usage at ${latest.cpuUsagePct}% exceeds 90% threshold`,
        detectedAt: new Date(),
        metricsSnapshot: { cpuUsagePct: latest.cpuUsagePct },
      });
    }

    // Memory anomaly (>85%)
    if (latest.memoryUsagePct > 85) {
      anomalies.push({
        clusterId,
        clusterName: cluster.name,
        anomalyType: 'high_memory',
        severity: latest.memoryUsagePct > 95 ? 'critical' : 'high',
        description: `Memory usage at ${latest.memoryUsagePct}% exceeds 85% threshold`,
        detectedAt: new Date(),
        metricsSnapshot: { memoryUsagePct: latest.memoryUsagePct },
      });
    }

    // Disk anomaly (>80%)
    if (latest.diskUsagePct > 80) {
      anomalies.push({
        clusterId,
        clusterName: cluster.name,
        anomalyType: 'high_disk',
        severity: latest.diskUsagePct > 90 ? 'critical' : 'medium',
        description: `Disk usage at ${latest.diskUsagePct}% exceeds 80% threshold`,
        detectedAt: new Date(),
        metricsSnapshot: { diskUsagePct: latest.diskUsagePct },
      });
    }

    // Node readiness
    if (latest.nodeReadyCount < latest.nodeCount) {
      const notReady = latest.nodeCount - latest.nodeReadyCount;
      anomalies.push({
        clusterId,
        clusterName: cluster.name,
        anomalyType: 'node_not_ready',
        severity: notReady > latest.nodeCount * 0.3 ? 'critical' : 'high',
        description: `${notReady} out of ${latest.nodeCount} nodes not ready`,
        detectedAt: new Date(),
        metricsSnapshot: { nodeCount: latest.nodeCount, nodeReadyCount: latest.nodeReadyCount },
      });
    }

    // API server unreachable
    if (!latest.apiServerReachable) {
      anomalies.push({
        clusterId,
        clusterName: cluster.name,
        anomalyType: 'api_server_down',
        severity: 'critical',
        description: 'Cluster API server is unreachable',
        detectedAt: new Date(),
        metricsSnapshot: { apiServerReachable: false, latencyMs: latest.apiServerLatencyMs },
      });
    }

    await this.recordAnomalies(clusterId, anomalies);
    return anomalies;
  }

  /**
   * Get recent anomalies for a cluster.
   * Checks cache first, then falls back to repository.
   */
  async getRecentAnomalies(clusterId: string, limit: number = 10): Promise<AnomalyDetectionResult[]> {
    // Try in-memory cache first
    const cached = this.anomalyCache.get(clusterId) ?? [];
    if (cached.length > 0) {
      return cached.slice(-limit).reverse();
    }

    // Fall back to repository
    if (this.hasRepository && this.anomalyRepo) {
      try {
        const entities = await this.anomalyRepo.findByClusterId(clusterId, limit);
        return entities.map(e => ({
          clusterId: e.clusterId,
          clusterName: e.clusterName || '',
          anomalyType: e.anomalyType,
          severity: e.severity as AnomalyDetectionResult['severity'],
          description: e.description || '',
          detectedAt: e.detectedAt,
          metricsSnapshot: e.metricsSnapshot,
        }));
      } catch {
        // Silently fall through
      }
    }

    return [];
  }

  /**
   * List clusters for a tenant.
   * Queries repository when available, falls back to cache.
   */
  async listClusters(tenantId: string): Promise<ClusterRecord[]> {
    // If repository available, query it directly (source of truth)
    if (this.hasRepository && this.clusterRepo) {
      try {
        const entities = await this.clusterRepo.findByTenantId(tenantId);
        return entities.map(e => ({
          id: e.id,
          tenantId: e.tenantId,
          name: e.name,
          endpoint: e.endpoint,
          region: e.region,
          status: e.status as ClusterRecord['status'],
          nodeCount: e.nodeCount,
          createdAt: e.createdAt,
          lastHealthCheck: e.lastHealthCheck || undefined,
        }));
      } catch {
        // Fall through to cache
      }
    }

    // Fallback: cache-only mode
    const clusterIds = this.tenantClusterCache.get(tenantId) ?? [];
    return clusterIds
      .map((id) => this.clusterCache.get(id))
      .filter((c): c is ClusterRecord => c !== undefined);
  }

  /**
   * Get cluster by ID with tenant isolation.
   * Queries repository when available, falls back to cache.
   */
  async getCluster(clusterId: string, tenantId: string): Promise<ClusterRecord | null> {
    const cluster = await this.getClusterById(clusterId);
    if (!cluster || cluster.tenantId !== tenantId) {
      return null;
    }
    return cluster;
  }

  /**
   * Get latest health check for a cluster.
   * Checks cache first, then falls back to repository.
   */
  async getLatestHealthCheck(clusterId: string): Promise<HealthCheckResult | null> {
    // Try in-memory cache first
    const history = this.healthCheckCache.get(clusterId) ?? [];
    if (history.length > 0) {
      return history[history.length - 1];
    }

    // Fall back to repository
    if (this.hasRepository && this.healthCheckRepo) {
      try {
        const entity = await this.healthCheckRepo.getLatestByClusterId(clusterId);
        if (entity) {
          return {
            clusterId: entity.clusterId,
            clusterName: entity.clusterName || '',
            status: entity.status as HealthCheckResult['status'],
            apiServerReachable: entity.apiServerReachable,
            apiServerLatencyMs: entity.apiServerLatencyMs,
            nodeCount: entity.nodeCount,
            nodeReadyCount: entity.nodeReadyCount,
            podCount: entity.podCount,
            cpuUsagePct: entity.cpuUsagePct,
            memoryUsagePct: entity.memoryUsagePct,
            diskUsagePct: entity.diskUsagePct,
            anomalies: entity.anomalies,
            checkedAt: entity.checkedAt,
          };
        }
      } catch {
        // Silently fall through
      }
    }

    return null;
  }

  // ==================== Internal methods ====================

  /**
   * Look up a cluster by ID. Checks cache first, then repository.
   * Populates cache on repository hit.
   */
  private async getClusterById(clusterId: string): Promise<ClusterRecord | null> {
    // Cache hit
    const cached = this.clusterCache.get(clusterId);
    if (cached) return cached;

    // Repository lookup
    if (this.hasRepository && this.clusterRepo) {
      try {
        const entity = await this.clusterRepo.findById(clusterId);
        if (entity) {
          const cluster: ClusterRecord = {
            id: entity.id,
            tenantId: entity.tenantId,
            name: entity.name,
            endpoint: entity.endpoint,
            region: entity.region,
            status: entity.status as ClusterRecord['status'],
            nodeCount: entity.nodeCount,
            createdAt: entity.createdAt,
            lastHealthCheck: entity.lastHealthCheck || undefined,
          };
          // Populate cache
          this.clusterCache.set(clusterId, cluster);
          return cluster;
        }
      } catch {
        // Fall through
      }
    }

    return null;
  }

  /**
   * Record anomalies to repository and cache.
   */
  private async recordAnomalies(clusterId: string, anomalies: AnomalyDetectionResult[]): Promise<void> {
    // Persist to repository first
    if (this.hasRepository && this.anomalyRepo) {
      await this.anomalyRepo.createBatch(anomalies);
    }

    // Update cache
    const existing = this.anomalyCache.get(clusterId) ?? [];
    existing.push(...anomalies);
    if (existing.length > 500) {
      existing.splice(0, existing.length - 500);
    }
    this.anomalyCache.set(clusterId, existing);
  }
}

export default ClusterHealthMonitor;
