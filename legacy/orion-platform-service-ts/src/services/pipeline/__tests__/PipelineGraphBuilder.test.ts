/**
 * PipelineGraphBuilder unit tests.
 *
 * Tests graph building from YAML, spec parsing, node/edge generation,
 * and layout position calculation.
 */

import { PipelineGraphBuilder } from '../PipelineGraphBuilder';

const sampleYaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: sample-pipeline
spec:
  stages:
    - name: Build
      runsOn: ubuntu-latest
      type: build
      steps:
        - name: install
          uses: npm install
        - name: compile
          uses: npm run build
    - name: Test
      runsOn: ubuntu-latest
      type: test
      dependsOn:
        - Build
      steps:
        - name: run-tests
          uses: npm test
      timeout: 300
    - name: Deploy
      runsOn: k8s
      type: deploy
      dependsOn:
        - Build
        - Test
      steps:
        - name: deploy-prod
          uses: kubectl apply
`;

describe('PipelineGraphBuilder', () => {
  let builder: PipelineGraphBuilder;

  beforeEach(() => {
    builder = new PipelineGraphBuilder();
  });

  // ==================== buildGraph ====================

  describe('buildGraph', () => {
    it('should build a graph from pipeline yamlDefinition', () => {
      const graph = builder.buildGraph('pipe-1', sampleYaml);

      expect(graph.pipelineId).toBe('pipe-1');
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it('should create stage nodes for each stage', () => {
      const graph = builder.buildGraph('pipe-1', sampleYaml);
      const stageNodes = graph.nodes.filter(n => n.type === 'stage');

      expect(stageNodes).toHaveLength(3);
      expect(stageNodes.map(n => n.name)).toContain('Build');
      expect(stageNodes.map(n => n.name)).toContain('Test');
      expect(stageNodes.map(n => n.name)).toContain('Deploy');
    });

    it('should create task nodes from stage steps', () => {
      const graph = builder.buildGraph('pipe-1', sampleYaml);
      const taskNodes = graph.nodes.filter(n => n.type === 'task');

      expect(taskNodes.length).toBeGreaterThan(0);
      expect(taskNodes.map(n => n.name)).toContain('install');
      expect(taskNodes.map(n => n.name)).toContain('compile');
      expect(taskNodes.map(n => n.name)).toContain('run-tests');
      expect(taskNodes.map(n => n.name)).toContain('deploy-prod');
    });

    it('should create edges from dependsOn', () => {
      const graph = builder.buildGraph('pipe-1', sampleYaml);

      // Build -> Test
      expect(graph.edges.some(e => e.from === 'build' && e.to === 'test')).toBe(true);
      // Build -> Deploy
      expect(graph.edges.some(e => e.from === 'build' && e.to === 'deploy')).toBe(true);
      // Test -> Deploy
      expect(graph.edges.some(e => e.from === 'test' && e.to === 'deploy')).toBe(true);
    });

    it('should create edges from stage to its tasks', () => {
      const graph = builder.buildGraph('pipe-1', sampleYaml);

      // Build stage -> its tasks
      expect(graph.edges.some(e => e.from === 'build' && e.to === 'build::install')).toBe(true);
      expect(graph.edges.some(e => e.from === 'build' && e.to === 'build::compile')).toBe(true);
    });

    it('should assign layout positions to stage nodes', () => {
      const graph = builder.buildGraph('pipe-1', sampleYaml);
      const stageNodes = graph.nodes.filter(n => n.type === 'stage' && n.position);

      // All stage nodes should have positions
      expect(stageNodes).toHaveLength(3);
      for (const node of stageNodes) {
        expect(node.position).toBeDefined();
        expect(node.position!.x).toBeGreaterThanOrEqual(0);
        expect(node.position!.y).toBeGreaterThanOrEqual(0);
      }
    });

    it('should place dependent stages at higher x positions', () => {
      const graph = builder.buildGraph('pipe-1', sampleYaml);
      const buildNode = graph.nodes.find(n => n.name === 'Build');
      const deployNode = graph.nodes.find(n => n.name === 'Deploy');

      expect(buildNode?.position).toBeDefined();
      expect(deployNode?.position).toBeDefined();
      expect(deployNode!.position!.x).toBeGreaterThanOrEqual(buildNode!.position!.x);
    });

    it('should include stage metadata in node metadata', () => {
      const graph = builder.buildGraph('pipe-1', sampleYaml);
      const testNode = graph.nodes.find(n => n.name === 'Test');

      expect(testNode).toBeDefined();
      expect(testNode!.metadata.runsOn).toBe('ubuntu-latest');
      expect(testNode!.metadata.type).toBe('test');
      expect(testNode!.metadata.timeout).toBe(300);
    });
  });

  // ==================== buildGraphFromYaml ====================

  describe('buildGraphFromYaml', () => {
    it('should extract pipeline name from metadata', () => {
      const graph = builder.buildGraphFromYaml(sampleYaml);
      expect(graph.pipelineId).toBe('sample-pipeline');
    });

    it('should handle flat YAML format without apiVersion wrapper', () => {
      const flatYaml = `
name: flat-pipeline
stages:
  - name: compile
    runsOn: ubuntu
    steps:
      - name: build
        uses: make
  - name: test
    runsOn: ubuntu
    dependsOn:
      - compile
    steps:
      - name: unit-test
        uses: go test
`;
      const graph = builder.buildGraphFromYaml(flatYaml);
      expect(graph.pipelineId).toBe('flat-pipeline');
      expect(graph.nodes.filter(n => n.type === 'stage')).toHaveLength(2);
    });

    it('should use untitled as default name when no metadata', () => {
      const minimalYaml = `
stages:
  - name: only
    runsOn: ubuntu
`;
      const graph = builder.buildGraphFromYaml(minimalYaml);
      expect(graph.pipelineId).toBe('untitled');
    });
  });

  // ==================== buildGraphFromSpec ====================

  describe('buildGraphFromSpec', () => {
    it('should handle empty stages', () => {
      const graph = builder.buildGraphFromSpec('empty', {
        metadata: { name: 'empty' },
        spec: { stages: [] },
      });

      expect(graph.pipelineId).toBe('empty');
      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
    });

    it('should handle stages with no dependsOn', () => {
      const graph = builder.buildGraphFromSpec('independent', {
        metadata: { name: 'independent' },
        spec: {
          stages: [
            { name: 'A', runsOn: 'ubuntu' },
            { name: 'B', runsOn: 'ubuntu' },
            { name: 'C', runsOn: 'ubuntu' },
          ],
        },
      });

      expect(graph.nodes.filter(n => n.type === 'stage')).toHaveLength(3);
      // No edges between stages
      const stageEdges = graph.edges.filter(e =>
        graph.nodes.some(n => n.id === e.from && n.type === 'stage') &&
        graph.nodes.some(n => n.id === e.to && n.type === 'stage')
      );
      expect(stageEdges).toHaveLength(0);
    });

    it('should handle diamond dependency pattern', () => {
      const graph = builder.buildGraphFromSpec('diamond', {
        metadata: { name: 'diamond' },
        spec: {
          stages: [
            { name: 'A' },
            { name: 'B', dependsOn: ['A'] },
            { name: 'C', dependsOn: ['A'] },
            { name: 'D', dependsOn: ['B', 'C'] },
          ],
        },
      });

      expect(graph.edges.some(e => e.from === 'a' && e.to === 'b')).toBe(true);
      expect(graph.edges.some(e => e.from === 'a' && e.to === 'c')).toBe(true);
      expect(graph.edges.some(e => e.from === 'b' && e.to === 'd')).toBe(true);
      expect(graph.edges.some(e => e.from === 'c' && e.to === 'd')).toBe(true);
    });

    it('should normalize stage names to IDs consistently', () => {
      const graph = builder.buildGraphFromSpec('test', {
        metadata: { name: 'test' },
        spec: {
          stages: [
            { name: 'Build Stage' },
            { name: 'build-stage', dependsOn: ['Build Stage'] },
          ],
        },
      });

      expect(graph.edges.some(e => e.from === 'build-stage' && e.to === 'build-stage')).toBe(true);
    });

    it('should extract matrix metadata', () => {
      const graph = builder.buildGraphFromSpec('matrix', {
        metadata: { name: 'matrix' },
        spec: {
          stages: [
            {
              name: 'Matrix Build',
              matrix: {
                os: ['linux', 'windows'],
                node: ['16', '18'],
              },
            },
          ],
        },
      });

      const node = graph.nodes.find(n => n.name === 'Matrix Build');
      expect(node).toBeDefined();
      expect(node!.metadata.matrix).toBeDefined();
      expect(node!.metadata.matrix.os).toEqual(['linux', 'windows']);
    });

    it('should extract env and outputs metadata', () => {
      const graph = builder.buildGraphFromSpec('env', {
        metadata: { name: 'env' },
        spec: {
          stages: [
            {
              name: 'Setup',
              env: { NODE_ENV: 'production' },
              outputs: { version: '${tasks.build.outputs.version}' },
            },
          ],
        },
      });

      const node = graph.nodes.find(n => n.name === 'Setup');
      expect(node!.metadata.env).toEqual({ NODE_ENV: 'production' });
      expect(node!.metadata.outputs).toEqual({ version: '${tasks.build.outputs.version}' });
    });

    it('should handle missing spec gracefully', () => {
      const graph = builder.buildGraphFromSpec('broken', {
        metadata: { name: 'broken' },
        spec: undefined,
      });

      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
    });
  });

  // ==================== Layout calculation ====================

  describe('layout calculation', () => {
    it('should place independent stages in layer 0', () => {
      const graph = builder.buildGraphFromSpec('layout', {
        metadata: { name: 'layout' },
        spec: {
          stages: [
            { name: 'A' },
            { name: 'B' },
            { name: 'C', dependsOn: ['A', 'B'] },
          ],
        },
      });

      const nodeA = graph.nodes.find(n => n.name === 'A');
      const nodeB = graph.nodes.find(n => n.name === 'B');
      const nodeC = graph.nodes.find(n => n.name === 'C');

      // A and B should be at the same x level (layer 0)
      expect(nodeA?.position?.x).toBe(nodeB?.position?.x);
      // C should be at a higher x level
      expect(nodeC!.position!.x).toBeGreaterThan(nodeA!.position!.x);
    });

    it('should handle linear chain layout', () => {
      const graph = builder.buildGraphFromSpec('chain', {
        metadata: { name: 'chain' },
        spec: {
          stages: [
            { name: 'A' },
            { name: 'B', dependsOn: ['A'] },
            { name: 'C', dependsOn: ['B'] },
          ],
        },
      });

      const a = graph.nodes.find(n => n.name === 'A')!;
      const b = graph.nodes.find(n => n.name === 'B')!;
      const c = graph.nodes.find(n => n.name === 'C')!;

      expect(b.position!.x).toBeGreaterThan(a.position!.x);
      expect(c.position!.x).toBeGreaterThan(b.position!.x);
    });
  });
});
