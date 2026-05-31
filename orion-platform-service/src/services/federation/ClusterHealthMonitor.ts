/**
 * ClusterHealthMonitor - Cluster health monitoring with tenant isolation
 *
 * Provides health checking, metrics collection, and anomaly detection
 * for federated clusters.
 * Uses PostgreSQL Repository as primary storage with in-memory Map as cache.
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
  private clusters: Map<string, ClusterRecord> = new Map();
  private healthChecks: Map<string, HealthCheckResult[]> = new Map();
  private metrics: Map<string, ClusterMetrics[]> = new Map();
  private anomalies: Map<string, AnomalyDetectionResult[]> = new Map();
  private clustersByTenant: Map<string, string[]> = new Map();

  // PostgreSQL Repositories (primary storage)
  private clusterRepo?: ClusterRecordRepository;
  private healthCheckRepo?: ClusterHealthCheckRepository;
  private metricsRepo?: ClusterMetricsRepository;
  private anomalyRepo?: ClusterAnomalyRepository;
  private useRepository: boolean = false;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.clusterRepo = new ClusterRecordRepository(db);
      this.healthCheckRepo = new ClusterHealthCheckRepository(db);
      this.metricsRepo = new ClusterMetricsRepository(db);
      this.anomalyRepo = new ClusterAnomalyRepository(db);
      this.useRepository = true;
    }
  }

  /**
   * Load all cluster data from repository into memory cache
   */
  async loadFromRepository(): Promise<void> {
    if (!this.useRepository || !this.clusterRepo) return;

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
        this.clusters.set(cluster.id, cluster);

        const tenantClusters = this.clustersByTenant.get(cluster.tenantId) ?? [];
        if (!tenantClusters.includes(cluster.id)) {
          tenantClusters.push(cluster.id);
        }
        this.clustersByTenant.set(cluster.tenantId, tenantClusters);
      }
      console.log(`[ClusterHealthMonitor] Loaded ${allClusters.entities.length} clusters from repository`);
    } catch (err) {
      console.warn('[ClusterHealthMonitor] Failed to load from repository:', err);
    }
  }

  /**
   * Register a cluster
   */
  registerCluster(
    tenantId: string,
    input: { name: string; endpoint: string; region: string; nodeCount?: number }
  ): ClusterRecord {
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

    this.clusters.set(id, cluster);
    this.healthChecks.set(id, []);
    this.metrics.set(id, []);
    this.anomalies.set(id, []);

    const tenantClusters = this.clustersByTenant.get(tenantId) ?? [];
    tenantClusters.push(id);
    this.clustersByTenant.set(tenantId, tenantClusters);

    // Persist to repository (fire-and-forget)
    if (this.useRepository && this.clusterRepo) {
      this.clusterRepo.create({
        id,
        tenant_id: tenantId,
        name: input.name,
        endpoint: input.endpoint,
        region: input.region,
        status: 'online',
        node_count: input.nodeCount ?? 3,
        last_health_check: null,
      }).catch(() => {});
    }

    return cluster;
  }

  /**
   * Perform health check on a cluster
   */
  checkClusterHealth(clusterId: string): HealthCheckResult | null {
    const cluster = this.clusters.get(clusterId);
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

    cluster.lastHealthCheck = new Date();

    // Store health check history
    const history = this.healthChecks.get(clusterId) ?? [];
    history.push(result);
    // Keep last 100 entries
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    this.healthChecks.set(clusterId, history);

    // Persist to repository (fire-and-forget)
    if (this.useRepository && this.healthCheckRepo) {
      this.healthCheckRepo.create({
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
      }).catch(() => {});
    }

    // Update cluster last health check in repository
    if (this.useRepository && this.clusterRepo) {
      this.clusterRepo.updateLastHealthCheck(clusterId).catch(() => {});
    }

    return result;
  }

  /**
   * Get cluster metrics for a given time window
   */
  getClusterMetrics(clusterId: string, timeWindow: string = '1h'): ClusterMetrics | null {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) {
      return null;
    }

    const allMetrics = this.metrics.get(clusterId) ?? [];
    const matching = allMetrics.filter((m) => m.timeWindow === timeWindow);
    if (matching.length > 0) {
      return matching[matching.length - 1];
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

    allMetrics.push(generated);
    if (allMetrics.length > 200) {
      allMetrics.splice(0, allMetrics.length - 200);
    }
    this.metrics.set(clusterId, allMetrics);

    // Persist to repository (fire-and-forget)
    if (this.useRepository && this.metricsRepo) {
      this.metricsRepo.create({
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
      }).catch(() => {});
    }

    return generated;
  }

  /**
   * Detect anomalies for a cluster based on health data
   */
  detectClusterAnomalies(clusterId: string): AnomalyDetectionResult[] {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) {
      return [];
    }

    const anomalies: AnomalyDetectionResult[] = [];
    const history = this.healthChecks.get(clusterId) ?? [];
    const latest = history.length > 0 ? history[history.length - 1] : null;

    if (!latest) {
      // No data available
      anomalies.push({
        clusterId,
        clusterName: cluster.name,
        anomalyType: 'no_data',
        severity: 'medium',
        description: 'No health check data available for cluster',
        detectedAt: new Date(),
        metricsSnapshot: {},
      });
      this.recordAnomalies(clusterId, anomalies);
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

    this.recordAnomalies(clusterId, anomalies);
    return anomalies;
  }

  /**
   * Get recent anomalies for a cluster
   */
  async getRecentAnomalies(clusterId: string, limit: number = 10): Promise<AnomalyDetectionResult[]> {
    // Try in-memory cache first
    const allAnomalies = this.anomalies.get(clusterId) ?? [];
    if (allAnomalies.length > 0) {
      return allAnomalies.slice(-limit).reverse();
    }

    // Fall back to repository
    if (this.useRepository && this.anomalyRepo) {
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
   * List clusters for a tenant
   */
  listClusters(tenantId: string): ClusterRecord[] {
    const clusterIds = this.clustersByTenant.get(tenantId) ?? [];
    return clusterIds
      .map((id) => this.clusters.get(id))
      .filter((c): c is ClusterRecord => c !== undefined);
  }

  /**
   * Get cluster by ID
   */
  getCluster(clusterId: string, tenantId: string): ClusterRecord | null {
    const cluster = this.clusters.get(clusterId);
    if (!cluster || cluster.tenantId !== tenantId) {
      return null;
    }
    return cluster;
  }

  /**
   * Get latest health check for a cluster
   */
  async getLatestHealthCheck(clusterId: string): Promise<HealthCheckResult | null> {
    // Try in-memory cache first
    const history = this.healthChecks.get(clusterId) ?? [];
    if (history.length > 0) {
      return history[history.length - 1];
    }

    // Fall back to repository
    if (this.useRepository && this.healthCheckRepo) {
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

  private recordAnomalies(clusterId: string, anomalies: AnomalyDetectionResult[]): void {
    const existing = this.anomalies.get(clusterId) ?? [];
    existing.push(...anomalies);
    // Keep last 500 entries
    if (existing.length > 500) {
      existing.splice(0, existing.length - 500);
    }
    this.anomalies.set(clusterId, existing);

    // Persist to repository (fire-and-forget)
    if (this.useRepository && this.anomalyRepo) {
      this.anomalyRepo.createBatch(anomalies).catch(() => {});
    }
  }
}

export default ClusterHealthMonitor;
