/**
 * Graph Service - Type Definitions
 */

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}

export interface GraphRelationship {
  id: string;
  type: string;
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, unknown>;
}

export interface GraphPath {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

export interface TopologyNode {
  id: string;
  name: string;
  type: string;
  status: string;
  properties: Record<string, unknown>;
  connections: string[];
}

export interface GraphQuery {
  cypher: string;
  params?: Record<string, unknown>;
  tenantId?: string;
}

export interface GraphResult {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  count: number;
}
