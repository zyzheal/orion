/**
 * ClusterHealthMonitor - Cluster health monitoring with tenant isolation
 *
 * Provides health checking, metrics collection, and anomaly detection
 * for federated clusters.
 * Uses in-memory Map storage (can migrate to Repository later).
 */
import { v4 as uuidv4 } from 'uuid';

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
  getRecentAnomalies(clusterId: string, limit: number = 10): AnomalyDetectionResult[] {
    const allAnomalies = this.anomalies.get(clusterId) ?? [];
    return allAnomalies.slice(-limit).reverse();
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
  getLatestHealthCheck(clusterId: string): HealthCheckResult | null {
    const history = this.healthChecks.get(clusterId) ?? [];
    return history.length > 0 ? history[history.length - 1] : null;
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
  }
}

export default ClusterHealthMonitor;
