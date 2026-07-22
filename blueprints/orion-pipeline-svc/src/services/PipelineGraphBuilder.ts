/**
 * PipelineGraphBuilder - Build DAG graph representation from pipeline specs.
 *
 * Converts pipeline YAML/spec into a graph structure suitable for
 * frontend DAG visualization (nodes + edges with layout positions).
 */

import * as yaml from 'js-yaml';

export interface GraphNode {
  id: string;
  name: string;
  type: 'stage' | 'task';
  dependsOn: string[];  // IDs of parent dependencies
  position?: { x: number; y: number };  // suggested layout position
  metadata: Record<string, any>;  // stage/task config
}

export interface PipelineGraph {
  pipelineId: string;
  nodes: GraphNode[];
  edges: Array<{ from: string; to: string; label?: string }>;
}

export interface PipelineSpecStage {
  name: string;
  runsOn?: string;
  steps?: Array<{ name: string; uses?: string; with?: Record<string, any> }>;
  dependsOn?: string[];
  if?: string;
  timeout?: number;
  retries?: number;
  parallel?: boolean;
  type?: string;
  config?: Record<string, any>;
  matrix?: Record<string, string[]> & { exclude?: Array<Record<string, string>> };
  env?: Record<string, string>;
  cache?: any;
  artifacts?: any;
  outputs?: Record<string, string>;
}

/**
 * PipelineGraphBuilder builds a DAG graph from pipeline YAML or parsed spec.
 */
export class PipelineGraphBuilder {

  /**
   * Build a graph from a saved pipeline's yamlDefinition.
   * @param pipelineId - Pipeline identifier
   * @param yamlDefinition - YAML string of the pipeline spec
   */
  buildGraph(pipelineId: string, yamlDefinition: string): PipelineGraph {
    const parsed = this.parseYamlToSpec(yamlDefinition);
    return this.buildGraphFromSpec(pipelineId, parsed);
  }

  /**
   * Build a graph from YAML without requiring a saved pipeline.
   * @param yamlString - YAML string of the pipeline spec
   */
  buildGraphFromYaml(yamlString: string): PipelineGraph {
    const parsed = this.parseYamlToSpec(yamlString);
    const pipelineId = parsed.metadata?.name || 'untitled';
    return this.buildGraphFromSpec(pipelineId, parsed);
  }

  /**
   * Build a graph from a parsed spec object.
   */
  buildGraphFromSpec(pipelineId: string, spec: {
    metadata?: { name?: string };
    spec?: { stages?: PipelineSpecStage[] };
  }): PipelineGraph {
    const stages = spec.spec?.stages || [];
    const nodes: GraphNode[] = [];
    const edges: Array<{ from: string; to: string; label?: string }> = [];

    // Build stage nodes
    for (const stage of stages) {
      const nodeId = this.normalizeStageId(stage.name);
      const node: GraphNode = {
        id: nodeId,
        name: stage.name,
        type: 'stage',
        dependsOn: (stage.dependsOn || []).map(dep => this.normalizeStageId(dep)),
        metadata: this.extractStageMetadata(stage),
      };
      nodes.push(node);
    }

    // Build edges from dependsOn
    for (const stage of stages) {
      const toId = this.normalizeStageId(stage.name);
      for (const dep of (stage.dependsOn || [])) {
        const fromId = this.normalizeStageId(dep);
        edges.push({ from: fromId, to: toId });
      }
    }

    // Build task nodes from stage steps
    for (const stage of stages) {
      const stageId = this.normalizeStageId(stage.name);
      if (stage.steps && Array.isArray(stage.steps)) {
        for (const step of stage.steps) {
          const taskId = `${stageId}::${step.name}`;
          const taskNode: GraphNode = {
            id: taskId,
            name: step.name,
            type: 'task',
            dependsOn: [stageId],
            metadata: {
              uses: step.uses || '',
              with: step.with || {},
            },
          };
          nodes.push(taskNode);
          edges.push({ from: stageId, to: taskId });
        }
      }
    }

    // Calculate suggested layout positions
    this.calculateLayoutPositions(nodes, edges);

    return { pipelineId, nodes, edges };
  }

  /**
   * Parse YAML string into pipeline spec object.
   */
  private parseYamlToSpec(yamlString: string): {
    apiVersion?: string;
    kind?: string;
    metadata?: { name?: string };
    spec?: { stages?: PipelineSpecStage[] };
  } {
    const parsed = yaml.load(yamlString) as any;

    // Support both wrapped (apiVersion/kind/metadata/spec) and flat (stages at root) formats
    if (parsed.spec && parsed.spec.stages) {
      return parsed;
    }

    // Flat format: stages at root level
    if (parsed.stages && Array.isArray(parsed.stages)) {
      return {
        metadata: { name: parsed.name || parsed.metadata?.name || 'untitled' },
        spec: { stages: parsed.stages },
      };
    }

    return {};
  }

  /**
   * Normalize stage name to a stable ID.
   */
  private normalizeStageId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'unknown';
  }

  /**
   * Extract relevant metadata from a stage for the graph node.
   */
  private extractStageMetadata(stage: PipelineSpecStage): Record<string, any> {
    const metadata: Record<string, any> = {};
    if (stage.runsOn) metadata.runsOn = stage.runsOn;
    if (stage.type) metadata.type = stage.type;
    if (stage.if) metadata.condition = stage.if;
    if (stage.timeout) metadata.timeout = stage.timeout;
    if (stage.retries !== undefined) metadata.retries = stage.retries;
    if (stage.parallel) metadata.parallel = stage.parallel;
    if (stage.config) metadata.config = stage.config;
    if (stage.matrix) metadata.matrix = stage.matrix;
    if (stage.env) metadata.env = stage.env;
    if (stage.outputs) metadata.outputs = stage.outputs;
    return metadata;
  }

  /**
   * Calculate suggested grid layout positions for nodes.
   * Uses topological layering: nodes with no deps at y=0, etc.
   */
  private calculateLayoutPositions(
    nodes: GraphNode[],
    edges: Array<{ from: string; to: string }>
  ): void {
    const nodeMap = new Map<string, GraphNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // Compute layers via topological sort (only for stage nodes)
    const stageNodes = nodes.filter(n => n.type === 'stage');
    const layers = this.computeLayers(stageNodes, edges);

    // Assign positions
    const layerSpacingX = 250;
    const nodeSpacingY = 100;
    const startOffset = { x: 50, y: 50 };

    for (const [layerIndex, layerNodeIds] of layers.entries()) {
      for (const [nodeIndex, nodeId] of layerNodeIds.entries()) {
        const node = nodeMap.get(nodeId);
        if (node) {
          node.position = {
            x: startOffset.x + layerIndex * layerSpacingX,
            y: startOffset.y + nodeIndex * nodeSpacingY,
          };
        }
      }
    }

    // Position task nodes below their parent stage
    for (const node of nodes) {
      if (node.type === 'task' && node.position) {
        // Tasks are positioned below their parent stage; position is set via dependsOn[0]
        const parentStage = nodeMap.get(node.dependsOn[0]);
        if (parentStage?.position) {
          // Place task below the stage
          node.position = {
            x: parentStage.position.x,
            y: parentStage.position.y + 60,
          };
        }
      }
    }
  }

  /**
   * Compute topological layers for DAG layout.
   * Returns array of arrays, where each inner array contains node IDs at that layer.
   */
  private computeLayers(
    nodes: GraphNode[],
    edges: Array<{ from: string; to: string }>
  ): string[][] {
    const nodeMap = new Map<string, GraphNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // Build adjacency and in-degree map (only stage-to-stage edges)
    const inDegree = new Map<string, number>();
    const children = new Map<string, string[]>();

    for (const node of nodes) {
      inDegree.set(node.id, 0);
      children.set(node.id, []);
    }

    for (const edge of edges) {
      // Only consider edges between stage nodes
      if (nodeMap.has(edge.from) && nodeMap.has(edge.to)) {
        inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
        children.get(edge.from)?.push(edge.to);
      }
    }

    // Kahn's algorithm for topological layering
    const layers: string[][] = [];
    let currentLayer = nodes
      .filter(n => (inDegree.get(n.id) || 0) === 0)
      .map(n => n.id);

    const visited = new Set<string>();

    while (currentLayer.length > 0) {
      layers.push([...currentLayer]);
      const nextLayer: string[] = [];

      for (const nodeId of currentLayer) {
        visited.add(nodeId);
        for (const childId of children.get(nodeId) || []) {
          if (visited.has(childId)) continue;
          const newDegree = (inDegree.get(childId) || 1) - 1;
          inDegree.set(childId, newDegree);
          if (newDegree === 0) {
            nextLayer.push(childId);
          }
        }
      }

      currentLayer = [...new Set(nextLayer)];
    }

    // Handle any remaining unvisited nodes (cycle detection fallback)
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (layers.length === 0) layers.push([]);
        layers[layers.length - 1].push(node.id);
        visited.add(node.id);
      }
    }

    return layers;
  }
}
