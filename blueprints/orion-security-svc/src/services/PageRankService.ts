// orion-platform-service/src/services/risk-engine/PageRankService.ts
/**
 * PageRank Service - Graph-based root cause analysis
 * Implements weighted PageRank for service dependency analysis
 */

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ServiceNode {
  id: string;
  name: string;
  type: 'service' | 'database' | 'cache' | 'queue' | 'external';
  tier: number;                   // 0 = critical, 1 = important, 2 = standard
  metadata?: Record<string, unknown>;
}

export interface ServiceEdge {
  source: string;
  target: string;
  type: 'calls' | 'depends' | 'reads' | 'writes';
  weight: number;                 // 0-1, frequency/importance
}

export interface ServiceGraph {
  nodes: ServiceNode[];
  edges: ServiceEdge[];
}

export interface PageRankResult {
  nodeId: string;
  nodeName: string;
  rank: number;
  tier: number;
  centrality: number;
  recommendations: string[];
}

export interface RootCauseAnalysis {
  incidentId: string;
  affectedService: string;
  rootCause: PageRankResult | null;
  contributingFactors: PageRankResult[];
  blastRadius: number;
  recommendedActions: string[];
  graph: ServiceGraph;
  analysisTime: number;
}

export interface PageRankOptions {
  dampingFactor?: number;         // Default: 0.85
  maxIterations?: number;         // Default: 100
  tolerance?: number;             // Default: 1e-6
  weightMode?: 'uniform' | 'weighted' | 'inverse';
}

const DEFAULT_OPTIONS: Required<PageRankOptions> = {
  dampingFactor: 0.85,
  maxIterations: 100,
  tolerance: 1e-6,
  weightMode: 'weighted',
};

export class PageRankService {
  private graphCache: Map<string, ServiceGraph> = new Map();
  private rankCache: Map<string, PageRankResult[]> = new Map();

  constructor() {
    logger.info('[PageRank] Service initialized');
  }

  /**
   * Compute PageRank on service dependency graph
   */
  async computePageRank(graph: ServiceGraph, options?: PageRankOptions): Promise<PageRankResult[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const graphKey = this.getGraphKey(graph);
    
    // Check cache
    const cached = this.rankCache.get(graphKey);
    if (cached) {
      logger.debug('[PageRank] Cache hit');
      return cached;
    }

    const startTime = Date.now();

    // Build adjacency matrix
    const { adjMatrix, nodeIndices, nodes } = this.buildAdjacencyMatrix(graph, opts.weightMode);
    
    // Run PageRank algorithm
    const ranks = this.runPageRank(adjMatrix, nodeIndices.size, opts);
    
    // Convert to results
    const results: PageRankResult[] = ranks.map((rank, i) => {
      const node = nodes[i];
      return {
        nodeId: node.id,
        nodeName: node.name,
        rank,
        tier: node.tier,
        centrality: this.calculateCentrality(adjMatrix, i),
        recommendations: this.getRecommendations(node, rank),
      };
    });

    // Sort by rank descending
    results.sort((a, b) => b.rank - a.rank);

    // Cache results
    this.rankCache.set(graphKey, results);

    const duration = Date.now() - startTime;
    logger.info({ nodes: nodes.length, duration }, '[PageRank] Computation complete');

    return results;
  }

  /**
   * Build adjacency matrix from graph
   */
  private buildAdjacencyMatrix(
    graph: ServiceGraph, 
    weightMode: PageRankOptions['weightMode']
  ): {
    adjMatrix: number[][];
    nodeIndices: Map<string, number>;
    nodes: ServiceNode[];
  } {
    const nodes = graph.nodes;
    const n = nodes.length;
    const nodeIndices = new Map<string, number>();
    
    // Create node index
    nodes.forEach((node, i) => nodeIndices.set(node.id, i));

    // Initialize adjacency matrix
    const adjMatrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    // Fill edges
    for (const edge of graph.edges) {
      const sourceIdx = nodeIndices.get(edge.source);
      const targetIdx = nodeIndices.get(edge.target);
      
      if (sourceIdx !== undefined && targetIdx !== undefined) {
        let weight = edge.weight;
        
        if (weightMode === 'inverse') {
          // Inverse weight for incoming edges
          weight = 1 - edge.weight;
        }
        
        adjMatrix[targetIdx][sourceIdx] = weight;
      }
    }

    // Normalize columns (for PageRank)
    for (let j = 0; j < n; j++) {
      const sum = adjMatrix.reduce((acc, row) => acc + row[j], 0);
      if (sum > 0) {
        for (let i = 0; i < n; i++) {
          adjMatrix[i][j] /= sum;
        }
      }
    }

    return { adjMatrix, nodeIndices, nodes };
  }

  /**
   * Run PageRank algorithm
   */
  private runPageRank(
    adjMatrix: number[][], 
    n: number, 
    opts: Required<PageRankOptions>
  ): number[] {
    // Initialize ranks
    let ranks = Array(n).fill(1 / n);
    let newRanks = Array(n).fill(0);

    const { dampingFactor, maxIterations, tolerance } = opts;

    for (let iter = 0; iter < maxIterations; iter++) {
      // Reset new ranks
      newRanks.fill(0);

      // PageRank formula: (1-d)/n + d * M^T * ranks
      for (let i = 0; i < n; i++) {
        let incomingSum = 0;
        
        for (let j = 0; j < n; j++) {
          incomingSum += adjMatrix[i][j] * ranks[j];
        }
        
        newRanks[i] = (1 - dampingFactor) / n + dampingFactor * incomingSum;
      }

      // Check convergence
      let diff = 0;
      for (let i = 0; i < n; i++) {
        diff += Math.abs(newRanks[i] - ranks[i]);
      }

      ranks = [...newRanks];

      if (diff < tolerance) {
        logger.debug({ iterations: iter + 1 }, '[PageRank] Converged');
        break;
      }
    }

    return ranks;
  }

  /**
   * Calculate centrality (degree centrality)
   */
  private calculateCentrality(adjMatrix: number[][], nodeIdx: number): number {
    const n = adjMatrix.length;
    let degree = 0;

    // Count incoming and outgoing edges
    for (let i = 0; i < n; i++) {
      if (adjMatrix[nodeIdx][i] > 0 || adjMatrix[i][nodeIdx] > 0) {
        degree++;
      }
    }

    return degree / (n - 1);
  }

  /**
   * Get recommendations based on node position
   */
  private getRecommendations(node: ServiceNode, rank: number): string[] {
    const recommendations: string[] = [];

    if (node.tier === 0) {
      recommendations.push('Critical tier service - ensure redundancy');
      recommendations.push('Implement circuit breaker pattern');
    }

    if (rank > 0.1) {
      recommendations.push('High centrality - monitor dependencies closely');
    }

    if (node.type === 'database') {
      recommendations.push('Database tier - implement connection pooling');
      recommendations.push('Enable read replicas for scaling');
    }

    if (node.type === 'external') {
      recommendations.push('External dependency - add fallback mechanism');
    }

    return recommendations;
  }

  /**
   * Analyze root cause of an incident
   */
  async analyzeRootCause(
    incidentId: string,
    affectedServiceId: string,
    graph: ServiceGraph
  ): Promise<RootCauseAnalysis> {
    const startTime = Date.now();

    // Compute PageRank
    const ranks = await this.computePageRank(graph);
    
    // Find affected service
    const affectedIdx = ranks.findIndex(r => r.nodeId === affectedServiceId);
    const affectedService = affectedIdx >= 0 ? ranks[affectedIdx] : null;

    // Find root cause (highest rank among dependencies)
    let rootCause: PageRankResult | null = null;
    const contributingFactors: PageRankResult[] = [];

    if (affectedService) {
      // Find services that the affected service depends on
      const dependencies = graph.edges
        .filter(e => e.target === affectedServiceId)
        .map(e => e.source);

      const dependencyRanks = ranks.filter(r => dependencies.includes(r.nodeId));
      dependencyRanks.sort((a, b) => b.rank - a.rank);

      rootCause = dependencyRanks[0] || null;
      contributingFactors.push(...dependencyRanks.slice(1, 4));
    }

    // Calculate blast radius
    const blastRadius = this.calculateBlastRadius(graph, affectedServiceId);

    // Generate actions
    const recommendedActions = this.generateActions(affectedService, rootCause, blastRadius);

    return {
      incidentId,
      affectedService: affectedServiceId,
      rootCause,
      contributingFactors,
      blastRadius,
      recommendedActions,
      graph,
      analysisTime: Date.now() - startTime,
    };
  }

  /**
   * Calculate blast radius (number of affected services)
   */
  private calculateBlastRadius(graph: ServiceGraph, epicenterId: string): number {
    // BFS to find all reachable nodes
    const visited = new Set<string>([epicenterId]);
    const queue = [epicenterId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      for (const edge of graph.edges) {
        if (edge.source === current && !visited.has(edge.target)) {
          visited.add(edge.target);
          queue.push(edge.target);
        }
      }
    }

    return visited.size - 1; // Exclude epicenter
  }

  /**
   * Generate recommended actions
   */
  private generateActions(
    affected: PageRankResult | null,
    rootCause: PageRankResult | null,
    blastRadius: number
  ): string[] {
    const actions: string[] = [];

    if (!affected) {
      actions.push('Unknown affected service - manual investigation required');
      return actions;
    }

    if (rootCause) {
      actions.push(`Investigate ${rootCause.nodeName} for root cause`);
    }

    if (blastRadius > 5) {
      actions.push('Large blast radius - consider implementing bulkhead pattern');
    }

    if (affected.tier === 0) {
      actions.push('Critical service affected - escalate immediately');
    }

    // Add general recommendations
    actions.push('Check recent deployments to affected services');
    actions.push('Review monitoring alerts for anomalies');
    actions.push('Verify all dependencies are healthy');

    return actions;
  }

  /**
   * Get graph key for caching
   */
  private getGraphKey(graph: ServiceGraph): string {
    const nodeIds = graph.nodes.map(n => n.id).sort().join(',');
    const edgeKeys = graph.edges.map(e => `${e.source}->${e.target}`).sort().join(',');
    return `${nodeIds}|${edgeKeys}`;
  }

  /**
   * Update graph dynamically
   */
  updateGraph(serviceGraph: ServiceGraph): void {
    const key = this.getGraphKey(serviceGraph);
    this.graphCache.set(key, serviceGraph);
    // Invalidate rank cache when graph changes
    this.rankCache.delete(key);
    logger.info({ nodes: serviceGraph.nodes.length }, '[PageRank] Graph updated');
  }

  /**
   * Get service criticality ranking
   */
  async getServiceCriticality(graph: ServiceGraph): Promise<PageRankResult[]> {
    // Apply tier weights to PageRank
    const ranks = await this.computePageRank(graph);
    
    // Adjust ranks based on tier
    const tierMultipliers = [2.0, 1.5, 1.0]; // Critical, Important, Standard
    
    return ranks.map(r => ({
      ...r,
      rank: r.rank * (tierMultipliers[r.tier] || 1),
    })).sort((a, b) => b.rank - a.rank);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    graphCacheSize: number;
    rankCacheSize: number;
  } {
    return {
      graphCacheSize: this.graphCache.size,
      rankCacheSize: this.rankCache.size,
    };
  }
}

export default PageRankService;