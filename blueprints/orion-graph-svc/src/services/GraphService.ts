/**
 * Graph Service - Core Neo4j knowledge graph wrapper
 *
 * Connects to Neo4j via Bolt protocol and exposes HTTP API for
 * graph queries, topology discovery, and knowledge graph operations.
 */

import neo4j, { Driver, Session } from 'neo4j-driver';
import { config } from '../config';
import type { GraphNode, GraphRelationship, GraphPath, GraphQuery, GraphResult, TopologyNode } from '../types/graph';

export class GraphService {
  private driver: Driver;

  constructor() {
    this.driver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.user, config.neo4j.password),
      { maxConnectionPoolSize: 50 }
    );
  }

  /**
   * Verify Neo4j connection
   */
  async checkHealth(): Promise<{ connected: boolean; serverInfo?: string; latency?: number }> {
    const start = Date.now();
    try {
      const serverInfo = await this.driver.verifyConnectivity();
      return {
        connected: true,
        serverInfo: serverInfo.address,
        latency: Date.now() - start,
      };
    } catch {
      return { connected: false };
    }
  }

  /**
   * Execute arbitrary Cypher query (safe mode)
   */
  async executeQuery(query: GraphQuery): Promise<GraphResult> {
    const session = this.driver.session({ database: config.neo4j.database });
    try {
      const result = await session.run(query.cypher, query.params || {});

      const nodes: GraphNode[] = [];
      const relationships: GraphRelationship[] = [];
      const seenNodes = new Set<string>();
      const seenRels = new Set<string>();

      for (const record of result.records) {
        for (const value of record.values()) {
          if (neo4j.isNode(value)) {
            const nodeId = value.identity.toString();
            if (!seenNodes.has(nodeId)) {
              seenNodes.add(nodeId);
              nodes.push({
                id: nodeId,
                labels: value.labels as string[],
                properties: value.properties as Record<string, unknown>,
              });
            }
          }
          if (neo4j.isRelationship(value)) {
            const relId = value.identity.toString();
            if (!seenRels.has(relId)) {
              seenRels.add(relId);
              relationships.push({
                id: relId,
                type: value.type,
                startNodeId: value.start.toString(),
                endNodeId: value.end.toString(),
                properties: value.properties as Record<string, unknown>,
              });
            }
          }
          if (neo4j.isPath(value)) {
            for (const segment of value.segments) {
              const nodeId = segment.end.identity.toString();
              if (!seenNodes.has(nodeId)) {
                seenNodes.add(nodeId);
                nodes.push({
                  id: nodeId,
                  labels: segment.end.labels as string[],
                  properties: segment.end.properties as Record<string, unknown>,
                });
              }
            }
          }
        }
      }

      return { nodes, relationships, count: nodes.length };
    } finally {
      await session.close();
    }
  }

  /**
   * Find shortest path between two nodes
   */
  async findShortestPath(startId: string, endId: string): Promise<GraphPath[]> {
    const session = this.driver.session({ database: config.neo4j.database });
    try {
      const result = await session.run(
        `MATCH path = shortestPath((a)-[*]-(b))
         WHERE id(a) = toInteger($startId) AND id(b) = toInteger($endId)
         RETURN path`,
        { startId, endId }
      );

      const paths: GraphPath[] = [];
      for (const record of result.records) {
        const path = record.get('path');
        const nodes: GraphNode[] = [];
        const relationships: GraphRelationship[] = [];

        for (const segment of path.segments) {
          const node = {
            id: segment.end.identity.toString(),
            labels: segment.end.labels as string[],
            properties: segment.end.properties as Record<string, unknown>,
          };
          if (!nodes.find((n) => n.id === node.id)) {
            nodes.push(node);
          }
          relationships.push({
            id: segment.relationship.identity.toString(),
            type: segment.relationship.type,
            startNodeId: segment.relationship.start.toString(),
            endNodeId: segment.relationship.end.toString(),
            properties: segment.relationship.properties as Record<string, unknown>,
          });
        }

        paths.push({ nodes, relationships });
      }

      return paths;
    } finally {
      await session.close();
    }
  }

  /**
   * Get service topology (all services and their connections)
   */
  async getServiceTopology(): Promise<TopologyNode[]> {
    const session = this.driver.session({ database: config.neo4j.database });
    try {
      const result = await session.run(
        `MATCH (s:Service)-[r:DEPENDS_ON|CONNECTS_TO]->(t:Service)
         RETURN s, r, t`
      );

      const nodeMap = new Map<string, TopologyNode>();

      for (const record of result.records) {
        const source = record.get('s');
        const target = record.get('t');
        const rel = record.get('r');

        const sourceId = source.identity.toString();
        const targetId = target.identity.toString();

        if (!nodeMap.has(sourceId)) {
          nodeMap.set(sourceId, {
            id: sourceId,
            name: source.properties.name as string || 'Unknown',
            type: (source.labels || []).join(','),
            status: source.properties.status as string || 'unknown',
            properties: source.properties as Record<string, unknown>,
            connections: [],
          });
        }
        if (!nodeMap.has(targetId)) {
          nodeMap.set(targetId, {
            id: targetId,
            name: target.properties.name as string || 'Unknown',
            type: (target.labels || []).join(','),
            status: target.properties.status as string || 'unknown',
            properties: target.properties as Record<string, unknown>,
            connections: [],
          });
        }

        nodeMap.get(sourceId)!.connections.push(targetId);
      }

      return Array.from(nodeMap.values());
    } finally {
      await session.close();
    }
  }

  /**
   * Create a node
   */
  async createNode(label: string, properties: Record<string, unknown>): Promise<GraphNode> {
    // Whitelist label to prevent Cypher injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(label)) {
      throw new Error(`Invalid label: ${label}. Only alphanumeric characters and underscores allowed.`);
    }
    const session = this.driver.session({ database: config.neo4j.database });
    try {
      const result = await session.run(
        `CREATE (n:${label} $props) RETURN n`,
        { props: properties }
      );

      const node = result.records[0].get('n');
      return {
        id: node.identity.toString(),
        labels: node.labels as string[],
        properties: node.properties as Record<string, unknown>,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Create a relationship between two nodes
   */
  async createRelationship(
    startId: string,
    endId: string,
    type: string,
    properties?: Record<string, unknown>
  ): Promise<GraphRelationship> {
    // Whitelist type to prevent Cypher injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(type)) {
      throw new Error(`Invalid relationship type: ${type}. Only alphanumeric characters and underscores allowed.`);
    }
    const session = this.driver.session({ database: config.neo4j.database });
    try {
      const result = await session.run(
        `MATCH (a), (b)
         WHERE id(a) = toInteger($startId) AND id(b) = toInteger($endId)
         CREATE (a)-[r:${type} $props]->(b)
         RETURN r`,
        { startId, endId, props: properties || {} }
      );

      const rel = result.records[0].get('r');
      return {
        id: rel.identity.toString(),
        type: rel.type,
        startNodeId: rel.start.toString(),
        endNodeId: rel.end.toString(),
        properties: rel.properties as Record<string, unknown>,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Close driver
   */
  async close(): Promise<void> {
    await this.driver.close();
  }
}
