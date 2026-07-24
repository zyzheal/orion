/**
 * YamlConverter unit tests.
 *
 * Tests bidirectional conversion between YAML pipeline specs
 * and JSON graph representations.
 */

import { YamlConverter } from '../YamlConverter';

describe('YamlConverter', () => {
  let converter: YamlConverter;

  beforeEach(() => {
    converter = new YamlConverter();
  });

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
        - Test
      steps:
        - name: deploy-prod
          uses: kubectl apply
`;

  // ==================== yamlToJson ====================

  describe('yamlToJson', () => {
    it('should convert valid YAML to a graph', () => {
      const result = converter.yamlToJson(sampleYaml);

      expect(result.graph.pipelineId).toBe('sample-pipeline');
      expect(result.graph.nodes.length).toBeGreaterThan(0);
      expect(result.graph.edges.length).toBeGreaterThan(0);
    });

    it('should include validation results', () => {
      const result = converter.yamlToJson(sampleYaml);

      expect(result.validation.valid).toBe(true);
      expect(result.validation.errors).toHaveLength(0);
    });

    it('should report validation errors for invalid YAML', () => {
      const invalidYaml = `
kind: Pipeline
metadata:
  name: test
`;
      const result = converter.yamlToJson(invalidYaml);

      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });

    it('should create stage nodes from YAML stages', () => {
      const result = converter.yamlToJson(sampleYaml);
      const stageNodes = result.graph.nodes.filter(n => n.type === 'stage');

      expect(stageNames(stageNodes)).toContain('Build');
      expect(stageNames(stageNodes)).toContain('Test');
      expect(stageNames(stageNodes)).toContain('Deploy');
    });

    it('should create task nodes from stage steps', () => {
      const result = converter.yamlToJson(sampleYaml);
      const taskNodes = result.graph.nodes.filter(n => n.type === 'task');

      expect(taskNodeNames(taskNodes)).toContain('install');
      expect(taskNodeNames(taskNodes)).toContain('compile');
      expect(taskNodeNames(taskNodes)).toContain('run-tests');
    });

    it('should generate correct edges between stages', () => {
      const result = converter.yamlToJson(sampleYaml);

      // Build -> Test
      expect(result.graph.edges.some(e => e.from === 'build' && e.to === 'test')).toBe(true);
      // Test -> Deploy
      expect(result.graph.edges.some(e => e.from === 'test' && e.to === 'deploy')).toBe(true);
    });
  });

  // ==================== jsonToYaml ====================

  describe('jsonToYaml', () => {
    it('should convert graph back to valid YAML', () => {
      const parseResult = converter.yamlToJson(sampleYaml);
      const yamlResult = converter.jsonToYaml(parseResult.graph);

      expect(yamlResult.yaml).toBeDefined();
      expect(typeof yamlResult.yaml).toBe('string');
      expect(yamlResult.yaml).toContain('apiVersion:');
      expect(yamlResult.yaml).toContain('kind: Pipeline');
      expect(yamlResult.yaml).toContain('stages:');
    });

    it('should include pipeline name in metadata', () => {
      const graph = {
        pipelineId: 'my-pipeline',
        nodes: [
          { id: 'build', name: 'Build', type: 'stage' as const, dependsOn: [], metadata: {} },
        ],
        edges: [],
      };

      const result = converter.jsonToYaml(graph);
      expect(result.yaml).toContain('name: my-pipeline');
    });

    it('should regenerate stage dependsOn relationships', () => {
      const graph = {
        pipelineId: 'test',
        nodes: [
          { id: 'build', name: 'Build', type: 'stage' as const, dependsOn: [], metadata: {} },
          {
            id: 'test',
            name: 'Test',
            type: 'stage' as const,
            dependsOn: ['build'],
            metadata: {},
          },
        ],
        edges: [{ from: 'build', to: 'test' }],
      };

      const result = converter.jsonToYaml(graph);
      expect(result.yaml).toContain('Build');
    });

    it('should preserve stage metadata', () => {
      const graph = {
        pipelineId: 'test',
        nodes: [
          {
            id: 'deploy',
            name: 'Deploy',
            type: 'stage' as const,
            dependsOn: [],
            metadata: {
              runsOn: 'k8s',
              type: 'deploy',
              timeout: 600,
            },
          },
        ],
        edges: [],
      };

      const result = converter.jsonToYaml(graph);
      expect(result.yaml).toContain('runsOn: k8s');
      expect(result.yaml).toContain('type: deploy');
      expect(result.yaml).toContain('timeout: 600');
    });

    it('should include tasks as steps', () => {
      const graph = {
        pipelineId: 'test',
        nodes: [
          { id: 'build', name: 'Build', type: 'stage' as const, dependsOn: [], metadata: {} },
          {
            id: 'build::compile',
            name: 'compile',
            type: 'task' as const,
            dependsOn: ['build'],
            metadata: { uses: 'npm run build' },
          },
        ],
        edges: [
          { from: 'build', to: 'build::compile' },
        ],
      };

      const result = converter.jsonToYaml(graph);
      expect(result.yaml).toContain('steps:');
      expect(result.yaml).toContain('compile');
      expect(result.yaml).toContain('npm run build');
    });

    it('should validate regenerated YAML', () => {
      const parseResult = converter.yamlToJson(sampleYaml);
      const yamlResult = converter.jsonToYaml(parseResult.graph);

      // The regenerated YAML should be valid (may have warnings but no errors)
      expect(yamlResult.validation.errors.some(e => e.code === 'MISSING_STAGES')).toBe(false);
    });
  });

  // ==================== Round-trip conversion ====================

  describe('round-trip conversion', () => {
    it('should preserve stages through yaml -> graph -> yaml -> graph cycle', () => {
      const firstParse = converter.yamlToJson(sampleYaml);
      const yamlResult = converter.jsonToYaml(firstParse.graph);
      const secondParse = converter.yamlToJson(yamlResult.yaml);

      // Both should have the same number of stage nodes
      const firstStages = firstParse.graph.nodes.filter(n => n.type === 'stage');
      const secondStages = secondParse.graph.nodes.filter(n => n.type === 'stage');

      expect(firstStages.length).toBe(secondStages.length);
    });

    it('should preserve dependency count through round-trip', () => {
      const firstParse = converter.yamlToJson(sampleYaml);
      const yamlResult = converter.jsonToYaml(firstParse.graph);
      const secondParse = converter.yamlToJson(yamlResult.yaml);

      // Stage-to-stage edge count should be the same
      const stageNodes = new Set(firstParse.graph.nodes.filter(n => n.type === 'stage').map(n => n.id));
      const firstStageEdges = firstParse.graph.edges.filter(e =>
        stageNodes.has(e.from) && stageNodes.has(e.to)
      );
      const secondStageEdges = secondParse.graph.edges.filter(e =>
        stageNodes.has(e.from) && stageNodes.has(e.to)
      );

      expect(firstStageEdges.length).toBe(secondStageEdges.length);
    });
  });

  // ==================== Edge cases ====================

  describe('edge cases', () => {
    it('should handle YAML with no steps', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: no-steps
spec:
  stages:
    - name: build
      type: build
`;
      const result = converter.yamlToJson(yaml);
      expect(result.graph.nodes.filter(n => n.type === 'stage')).toHaveLength(1);
      expect(result.graph.nodes.filter(n => n.type === 'task')).toHaveLength(0);
    });

    it('should handle graph with no edges', () => {
      const graph = {
        pipelineId: 'simple',
        nodes: [
          { id: 'a', name: 'A', type: 'stage' as const, dependsOn: [], metadata: {} },
        ],
        edges: [],
      };

      const result = converter.jsonToYaml(graph);
      expect(result.yaml).toContain('A');
    });

    it('should handle empty node list', () => {
      const graph = {
        pipelineId: 'empty',
        nodes: [],
        edges: [],
      };

      const result = converter.jsonToYaml(graph);
      expect(result.yaml).toContain('stages: []');
    });

    it('should handle complex dependency graph', () => {
      const graph = {
        pipelineId: 'complex',
        nodes: [
          { id: 'a', name: 'A', type: 'stage' as const, dependsOn: [], metadata: {} },
          { id: 'b', name: 'B', type: 'stage' as const, dependsOn: ['a'], metadata: {} },
          { id: 'c', name: 'C', type: 'stage' as const, dependsOn: ['a'], metadata: {} },
          { id: 'd', name: 'D', type: 'stage' as const, dependsOn: ['b', 'c'], metadata: {} },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'a', to: 'c' },
          { from: 'b', to: 'd' },
          { from: 'c', to: 'd' },
        ],
      };

      const result = converter.jsonToYaml(graph);
      expect(result.yaml).toBeDefined();
      expect(result.validation.valid).toBe(true);
    });
  });
});

// Helper functions
function stageNames(nodes: Array<{ name: string }>): string[] {
  return nodes.map(n => n.name);
}

function taskNodeNames(nodes: Array<{ name: string }>): string[] {
  return nodes.map(n => n.name);
}
