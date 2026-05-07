/**
 * DataLineageService Tests
 *
 * 测试覆盖：
 * - ETL 流程
 * - 数据流转
 * - 血缘关系追踪
 * - 影响分析
 */

import { DataLineageService, LineageNode, LineageEdge } from '../DataLineageService';

describe('DataLineageService', () => {
  let service: DataLineageService;

  beforeEach(() => {
    service = new DataLineageService();
  });

  // ==================== recordLineage ====================

  describe('recordLineage (ETL 流程)', () => {
    it('应该记录数据血缘', async () => {
      const nodes: LineageNode[] = [
        { id: 'src-1', name: 'PostgreSQL Source', type: 'source', pipelineId: 'pipeline-1' },
        { id: 'trans-1', name: 'Transform User Data', type: 'transform', pipelineId: 'pipeline-1' },
        { id: 'sink-1', name: 'Snowflake Sink', type: 'sink', pipelineId: 'pipeline-1' },
      ];

      const edges: LineageEdge[] = [
        { id: 'edge-1', from: 'src-1', to: 'trans-1', relationship: 'produces' },
        { id: 'edge-2', from: 'trans-1', to: 'sink-1', relationship: 'transforms' },
      ];

      const record = await service.recordLineage('tenant-1', 'pipeline-1', 'exec-1', nodes, edges);

      expect(record.id).toBeDefined();
      expect(record.tenantId).toBe('tenant-1');
      expect(record.pipelineId).toBe('pipeline-1');
      expect(record.executionId).toBe('exec-1');
      expect(record.graph.nodes.length).toBe(3);
      expect(record.graph.edges.length).toBe(2);
      expect(record.recordedAt).toBeInstanceOf(Date);
    });

    it('应该记录完整的 ETL 流程', async () => {
      const nodes: LineageNode[] = [
        { id: 'extract', name: 'Extract Stage', type: 'source', stageId: 'stage-1' },
        { id: 'transform', name: 'Transform Stage', type: 'transform', stageId: 'stage-2' },
        { id: 'load', name: 'Load Stage', type: 'sink', stageId: 'stage-3' },
      ];

      const edges: LineageEdge[] = [
        { id: 'e1', from: 'extract', to: 'transform', relationship: 'produces' },
        { id: 'e2', from: 'transform', to: 'load', relationship: 'transforms' },
      ];

      const record = await service.recordLineage('tenant-1', 'pipeline-1', 'exec-1', nodes, edges);

      expect(record.graph.nodes.length).toBe(3);
      expect(record.graph.edges.length).toBe(2);
    });

    it('应该支持不同类型的节点', async () => {
      const nodeTypes: Array<'source' | 'transform' | 'sink' | 'dataset' | 'model'> =
        ['source', 'transform', 'sink', 'dataset', 'model'];

      for (const type of nodeTypes) {
        const nodes: LineageNode[] = [
          { id: `node-${type}`, name: `${type} node`, type },
        ];

        const record = await service.recordLineage('tenant-1', 'pipeline-1', `exec-${type}`, nodes, []);

        expect(record.graph.nodes[0].type).toBe(type);
      }
    });

    it('应该支持不同的关系类型', async () => {
      const relationships: Array<'produces' | 'consumes' | 'transforms' | 'derives'> =
        ['produces', 'consumes', 'transforms', 'derives'];

      for (const rel of relationships) {
        const nodes: LineageNode[] = [
          { id: 'node-1', name: 'Node 1', type: 'source' },
          { id: 'node-2', name: 'Node 2', type: 'sink' },
        ];

        const edges: LineageEdge[] = [
          { id: `edge-${rel}`, from: 'node-1', to: 'node-2', relationship: rel },
        ];

        const record = await service.recordLineage('tenant-1', 'pipeline-1', `exec-${rel}`, nodes, edges);

        expect(record.graph.edges[0].relationship).toBe(rel);
      }
    });

    it('应该支持字段映射', async () => {
      const nodes: LineageNode[] = [
        { id: 'src', name: 'Source', type: 'source', schema: { id: 'string', name: 'string' } },
        { id: 'dst', name: 'Destination', type: 'sink', schema: { user_id: 'string', user_name: 'string' } },
      ];

      const edges: LineageEdge[] = [
        {
          id: 'edge-1',
          from: 'src',
          to: 'dst',
          relationship: 'transforms',
          fieldMapping: { id: 'user_id', name: 'user_name' },
        },
      ];

      const record = await service.recordLineage('tenant-1', 'pipeline-1', 'exec-1', nodes, edges);

      expect(record.graph.edges[0].fieldMapping).toEqual({ id: 'user_id', name: 'user_name' });
    });
  });

  // ==================== getLineage ====================

  describe('getLineage', () => {
    it('应该返回指定 pipeline 的血缘图', async () => {
      const nodes: LineageNode[] = [
        { id: 'src-1', name: 'Source', type: 'source' },
      ];

      await service.recordLineage('tenant-1', 'pipeline-1', 'exec-1', nodes, []);

      const lineage = service.getLineage('pipeline-1');

      expect(lineage).not.toBeNull();
      expect(lineage?.nodes.length).toBe(1);
      expect(lineage?.pipelineId).toBe('pipeline-1');
    });

    it('应该返回最新记录的血缘图', async () => {
      const nodes1: LineageNode[] = [
        { id: 'node-v1', name: 'Node Version 1', type: 'source' },
      ];

      const nodes2: LineageNode[] = [
        { id: 'node-v2', name: 'Node Version 2', type: 'sink' },
      ];

      await service.recordLineage('tenant-1', 'pipeline-1', 'exec-1', nodes1, []);

      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      await service.recordLineage('tenant-1', 'pipeline-1', 'exec-2', nodes2, []);

      const lineage = service.getLineage('pipeline-1');

      expect(lineage?.nodes.length).toBe(1);
      expect(lineage?.nodes[0].name).toBe('Node Version 2');
    });

    it('应该返回 null 如果没有血缘记录', () => {
      const lineage = service.getLineage('nonexistent-pipeline');

      expect(lineage).toBeNull();
    });
  });

  // ==================== getLineageHistory ====================

  describe('getLineageHistory', () => {
    it('应该返回指定 pipeline 的历史记录', async () => {
      const nodes: LineageNode[] = [
        { id: 'node-1', name: 'Node 1', type: 'source' },
      ];

      await service.recordLineage('tenant-1', 'pipeline-1', 'exec-1', nodes, []);
      await service.recordLineage('tenant-1', 'pipeline-1', 'exec-2', nodes, []);
      await service.recordLineage('tenant-1', 'pipeline-1', 'exec-3', nodes, []);

      const history = service.getLineageHistory('pipeline-1');

      expect(history.length).toBe(3);
    });

    it('应该按时间倒序排列', async () => {
      const nodes: LineageNode[] = [
        { id: 'node-history', name: 'Node', type: 'source' },
      ];

      await service.recordLineage('tenant-1', 'pipeline-1', 'exec-1', nodes, []);

      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      await service.recordLineage('tenant-1', 'pipeline-1', 'exec-2', nodes, []);

      const history = service.getLineageHistory('pipeline-1');

      expect(history[0].executionId).toBe('exec-2');
      expect(history[1].executionId).toBe('exec-1');
    });

    it('应该限制返回数量', async () => {
      const nodes: LineageNode[] = [
        { id: 'node-1', name: 'Node 1', type: 'source' },
      ];

      for (let i = 0; i < 30; i++) {
        await service.recordLineage('tenant-1', 'pipeline-1', `exec-${i}`, nodes, []);
      }

      const history = service.getLineageHistory('pipeline-1', 10);

      expect(history.length).toBe(10);
    });

    it('应该返回空数组如果没有记录', () => {
      const history = service.getLineageHistory('nonexistent-pipeline');

      expect(history).toEqual([]);
    });
  });

  // ==================== addNode & addEdge ====================

  describe('addNode & addEdge', () => {
    it('应该添加节点', async () => {
      const node: LineageNode = {
        id: 'node-1',
        name: 'Test Node',
        type: 'source',
        description: 'Test source node',
      };

      await service.addNode(node);

      const lineage = service.getAllLineage('tenant-1');
      expect(lineage.nodes.find(n => n.id === 'node-1')).toBeDefined();
    });

    it('应该添加边', async () => {
      await service.addNode({ id: 'node-1', name: 'Node 1', type: 'source' });
      await service.addNode({ id: 'node-2', name: 'Node 2', type: 'sink' });

      const edge: LineageEdge = {
        id: 'edge-1',
        from: 'node-1',
        to: 'node-2',
        relationship: 'produces',
      };

      await service.addEdge(edge);

      const lineage = service.getAllLineage('tenant-1');
      expect(lineage.edges.find(e => e.id === 'edge-1')).toBeDefined();
    });
  });

  // ==================== getUpstream & getDownstream (数据流转) ====================

  describe('getUpstream & getDownstream (数据流转)', () => {
    beforeEach(async () => {
      // Setup a simple lineage graph: A -> B -> C
      await service.addNode({ id: 'A', name: 'Source A', type: 'source' });
      await service.addNode({ id: 'B', name: 'Transform B', type: 'transform' });
      await service.addNode({ id: 'C', name: 'Sink C', type: 'sink' });
      await service.addEdge({ id: 'e1', from: 'A', to: 'B', relationship: 'produces' });
      await service.addEdge({ id: 'e2', from: 'B', to: 'C', relationship: 'transforms' });
    });

    it('应该获取上游节点', () => {
      const upstream = service.getUpstream('B');

      expect(upstream.length).toBe(1);
      expect(upstream[0].id).toBe('A');
    });

    it('应该获取下游节点', () => {
      const downstream = service.getDownstream('B');

      expect(downstream.length).toBe(1);
      expect(downstream[0].id).toBe('C');
    });

    it('应该返回空数组如果没有上游节点', () => {
      const upstream = service.getUpstream('A');

      expect(upstream).toEqual([]);
    });

    it('应该返回空数组如果没有下游节点', () => {
      const downstream = service.getDownstream('C');

      expect(downstream).toEqual([]);
    });

    it('应该处理多个上游节点', async () => {
      // Add another upstream: D -> B
      await service.addNode({ id: 'D', name: 'Source D', type: 'source' });
      await service.addEdge({ id: 'e3', from: 'D', to: 'B', relationship: 'produces' });

      const upstream = service.getUpstream('B');

      expect(upstream.length).toBe(2);
      expect(upstream.map(n => n.id)).toContain('A');
      expect(upstream.map(n => n.id)).toContain('D');
    });

    it('应该处理多个下游节点', async () => {
      // Add another downstream: B -> E
      await service.addNode({ id: 'E', name: 'Sink E', type: 'sink' });
      await service.addEdge({ id: 'e4', from: 'B', to: 'E', relationship: 'transforms' });

      const downstream = service.getDownstream('B');

      expect(downstream.length).toBe(2);
      expect(downstream.map(n => n.id)).toContain('C');
      expect(downstream.map(n => n.id)).toContain('E');
    });
  });

  // ==================== getImpactAnalysis ====================

  describe('getImpactAnalysis', () => {
    beforeEach(async () => {
      // Setup a complex lineage graph:
      // A -> B -> C
      // B -> D
      await service.addNode({ id: 'A', name: 'Source A', type: 'source', pipelineId: 'pipeline-1' });
      await service.addNode({ id: 'B', name: 'Transform B', type: 'transform', pipelineId: 'pipeline-1' });
      await service.addNode({ id: 'C', name: 'Sink C', type: 'sink', pipelineId: 'pipeline-1' });
      await service.addNode({ id: 'D', name: 'Sink D', type: 'sink', pipelineId: 'pipeline-2' });
      await service.addEdge({ id: 'e1', from: 'A', to: 'B', relationship: 'produces' });
      await service.addEdge({ id: 'e2', from: 'B', to: 'C', relationship: 'transforms' });
      await service.addEdge({ id: 'e3', from: 'B', to: 'D', relationship: 'transforms' });
    });

    it('应该提供影响分析', async () => {
      const analysis = await service.getImpactAnalysis('B');

      expect(analysis.node).toBeDefined();
      expect(analysis.node?.id).toBe('B');
      expect(analysis.upstreamCount).toBe(1);
      expect(analysis.downstreamCount).toBe(2);
    });

    it('应该识别受影响的 pipeline', async () => {
      const analysis = await service.getImpactAnalysis('B');

      expect(analysis.affectedPipelines).toContain('pipeline-1');
      expect(analysis.affectedPipelines).toContain('pipeline-2');
    });

    it('应该处理不存在的节点', async () => {
      const analysis = await service.getImpactAnalysis('nonexistent');

      expect(analysis.node).toBeUndefined();
      expect(analysis.upstreamCount).toBe(0);
      expect(analysis.downstreamCount).toBe(0);
      expect(analysis.affectedPipelines).toEqual([]);
    });

    it('应该正确计算上游和下游数量', async () => {
      const analysisA = await service.getImpactAnalysis('A');
      expect(analysisA.upstreamCount).toBe(0);
      expect(analysisA.downstreamCount).toBe(1);

      const analysisC = await service.getImpactAnalysis('C');
      expect(analysisC.upstreamCount).toBe(1);
      expect(analysisC.downstreamCount).toBe(0);
    });
  });

  // ==================== getAllLineage ====================

  describe('getAllLineage', () => {
    it('应该返回所有血缘数据', async () => {
      const nodes: LineageNode[] = [
        { id: 'node-1', name: 'Node 1', type: 'source' },
        { id: 'node-2', name: 'Node 2', type: 'sink' },
      ];

      const edges: LineageEdge[] = [
        { id: 'edge-1', from: 'node-1', to: 'node-2', relationship: 'produces' },
      ];

      await service.recordLineage('tenant-1', 'pipeline-1', 'exec-1', nodes, edges);

      const lineage = service.getAllLineage('tenant-1');

      expect(lineage.nodes.length).toBe(2);
      expect(lineage.edges.length).toBe(1);
      expect(lineage.tenantId).toBe('tenant-1');
      expect(lineage.generatedAt).toBeInstanceOf(Date);
    });

    it('应该返回空图如果没有血缘数据', () => {
      const lineage = service.getAllLineage('tenant-1');

      expect(lineage.nodes).toEqual([]);
      expect(lineage.edges).toEqual([]);
    });
  });

  // ==================== Edge Cases ====================

  describe('Edge Cases', () => {
    it('应该处理没有边的血缘图', async () => {
      const nodes: LineageNode[] = [
        { id: 'node-1', name: 'Node 1', type: 'source' },
      ];

      const record = await service.recordLineage('tenant-1', 'pipeline-1', 'exec-1', nodes, []);

      expect(record.graph.edges).toEqual([]);
    });

    it('应该处理没有节点的血缘图', async () => {
      const record = await service.recordLineage('tenant-1', 'pipeline-1', 'exec-1', [], []);

      expect(record.graph.nodes).toEqual([]);
      expect(record.graph.edges).toEqual([]);
    });

    it('应该处理节点包含 schema 和 metadata', async () => {
      const nodes: LineageNode[] = [
        {
          id: 'node-1',
          name: 'Complex Node',
          type: 'dataset',
          schema: { id: 'number', name: 'string', email: 'string' },
          metadata: { rowCount: 1000, sizeBytes: 50000 },
        },
      ];

      const record = await service.recordLineage('tenant-1', 'pipeline-1', 'exec-1', nodes, []);

      expect(record.graph.nodes[0].schema).toBeDefined();
      expect(record.graph.nodes[0].metadata).toBeDefined();
    });

    it('应该处理自引用边（同一节点既是上游又是下游）', async () => {
      await service.addNode({ id: 'node-1', name: 'Node 1', type: 'transform' });
      await service.addEdge({ id: 'e1', from: 'node-1', to: 'node-1', relationship: 'transforms' });

      const upstream = service.getUpstream('node-1');
      const downstream = service.getDownstream('node-1');

      expect(upstream.find(n => n.id === 'node-1')).toBeDefined();
      expect(downstream.find(n => n.id === 'node-1')).toBeDefined();
    });

    it('应该处理多个 pipeline 的血缘数据', async () => {
      const nodes1: LineageNode[] = [
        { id: 'node-1', name: 'Node 1', type: 'source' },
      ];

      const nodes2: LineageNode[] = [
        { id: 'node-2', name: 'Node 2', type: 'sink' },
      ];

      await service.recordLineage('tenant-1', 'pipeline-1', 'exec-1', nodes1, []);
      await service.recordLineage('tenant-1', 'pipeline-2', 'exec-2', nodes2, []);

      const lineage1 = service.getLineage('pipeline-1');
      const lineage2 = service.getLineage('pipeline-2');

      expect(lineage1?.nodes[0].name).toBe('Node 1');
      expect(lineage2?.nodes[0].name).toBe('Node 2');
    });
  });

  // ==================== Complex Lineage Scenarios ====================

  describe('Complex Lineage Scenarios', () => {
    it('应该处理多层级血缘关系', async () => {
      // A -> B -> C -> D -> E
      await service.addNode({ id: 'A', name: 'Level 1', type: 'source' });
      await service.addNode({ id: 'B', name: 'Level 2', type: 'transform' });
      await service.addNode({ id: 'C', name: 'Level 3', type: 'transform' });
      await service.addNode({ id: 'D', name: 'Level 4', type: 'transform' });
      await service.addNode({ id: 'E', name: 'Level 5', type: 'sink' });

      await service.addEdge({ id: 'e1', from: 'A', to: 'B', relationship: 'produces' });
      await service.addEdge({ id: 'e2', from: 'B', to: 'C', relationship: 'transforms' });
      await service.addEdge({ id: 'e3', from: 'C', to: 'D', relationship: 'transforms' });
      await service.addEdge({ id: 'e4', from: 'D', to: 'E', relationship: 'transforms' });

      const analysis = await service.getImpactAnalysis('C');

      // Verify correct upstream and downstream counts
      expect(analysis.node?.id).toBe('C');
      expect(analysis.upstreamCount).toBeGreaterThan(0);
      expect(analysis.downstreamCount).toBeGreaterThan(0);
    });

    it('应该处理菱形依赖关系', async () => {
      // A -> B -> D
      // A -> C -> D
      await service.addNode({ id: 'A', name: 'Source A', type: 'source' });
      await service.addNode({ id: 'B', name: 'Branch B', type: 'transform' });
      await service.addNode({ id: 'C', name: 'Branch C', type: 'transform' });
      await service.addNode({ id: 'D', name: 'Merge D', type: 'sink' });

      await service.addEdge({ id: 'e1', from: 'A', to: 'B', relationship: 'produces' });
      await service.addEdge({ id: 'e2', from: 'A', to: 'C', relationship: 'produces' });
      await service.addEdge({ id: 'e3', from: 'B', to: 'D', relationship: 'transforms' });
      await service.addEdge({ id: 'e4', from: 'C', to: 'D', relationship: 'transforms' });

      const upstreamD = service.getUpstream('D');
      const downstreamA = service.getDownstream('A');

      expect(upstreamD.length).toBe(2); // B, C
      expect(downstreamA.length).toBe(2); // B, C
    });

    it('应该处理循环依赖', async () => {
      // A -> B -> C -> A
      await service.addNode({ id: 'A', name: 'Node A', type: 'transform' });
      await service.addNode({ id: 'B', name: 'Node B', type: 'transform' });
      await service.addNode({ id: 'C', name: 'Node C', type: 'transform' });

      await service.addEdge({ id: 'e1', from: 'A', to: 'B', relationship: 'transforms' });
      await service.addEdge({ id: 'e2', from: 'B', to: 'C', relationship: 'transforms' });
      await service.addEdge({ id: 'e3', from: 'C', to: 'A', relationship: 'transforms' });

      const upstreamA = service.getUpstream('A');
      const downstreamA = service.getDownstream('A');

      expect(upstreamA.find(n => n.id === 'C')).toBeDefined();
      expect(downstreamA.find(n => n.id === 'B')).toBeDefined();
    });
  });
});