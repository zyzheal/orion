/**
 * MatrixExpander Tests
 *
 * Tests for the pipeline matrix expansion logic.
 * Covers cartesian product, exclusions, variable injection, and naming.
 */

import { MatrixExpander, type MatrixConfig, type ExpandedStage } from '../MatrixExpander';

describe('MatrixExpander', () => {
  describe('hasMatrix', () => {
    test('should return true when stage has matrix config', () => {
      const stage = {
        name: 'test',
        runsOn: 'ubuntu-latest',
        steps: [],
        matrix: { os: ['linux', 'macos'] },
      };
      expect(MatrixExpander.hasMatrix(stage)).toBe(true);
    });

    test('should return false when stage has no matrix config', () => {
      const stage = {
        name: 'test',
        runsOn: 'ubuntu-latest',
        steps: [],
      };
      expect(MatrixExpander.hasMatrix(stage)).toBe(false);
    });

    test('should return false when matrix is empty object', () => {
      const stage = {
        name: 'test',
        runsOn: 'ubuntu-latest',
        steps: [],
        matrix: {},
      };
      expect(MatrixExpander.hasMatrix(stage)).toBe(false);
    });
  });

  describe('expandMatrix - cartesian product', () => {
    test('should produce cartesian product for single dimension', () => {
      const stage = {
        name: 'test',
        runsOn: 'ubuntu-latest',
        steps: [{ name: 'run', uses: 'shell@1.0' }],
        matrix: { node: ['18', '20', '22'] },
      };

      const result = MatrixExpander.expandMatrix(stage);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('test (node=18)');
      expect(result[1].name).toBe('test (node=20)');
      expect(result[2].name).toBe('test (node=22)');
    });

    test('should produce cartesian product for two dimensions', () => {
      const stage = {
        name: 'test',
        runsOn: 'ubuntu-latest',
        steps: [{ name: 'run', uses: 'shell@1.0' }],
        matrix: { os: ['linux', 'macos'], node: ['18', '20'] },
      };

      const result = MatrixExpander.expandMatrix(stage);

      // 2 x 2 = 4 combinations
      expect(result).toHaveLength(4);
    });

    test('should produce cartesian product for three dimensions', () => {
      const stage = {
        name: 'build',
        runsOn: 'ubuntu-latest',
        steps: [{ name: 'run', uses: 'shell@1.0' }],
        matrix: { os: ['linux', 'macos'], node: ['18', '20'], arch: ['x64', 'arm64'] },
      };

      const result = MatrixExpander.expandMatrix(stage);

      // 2 x 2 x 2 = 8 combinations
      expect(result).toHaveLength(8);
    });

    test('should inject matrix variables into environment', () => {
      const stage = {
        name: 'test',
        runsOn: 'ubuntu-latest',
        steps: [{ name: 'run', uses: 'shell@1.0' }],
        matrix: { os: ['linux', 'macos'], node: ['18', '20'] },
      };

      const result = MatrixExpander.expandMatrix(stage);

      // Each expanded stage should have env with the matrix variables
      for (const expanded of result) {
        expect(expanded.stage.env).toBeDefined();
        expect(expanded.variables).toBeDefined();
      }

      // Check specific combination
      const linux18 = result.find(
        (r) => r.variables.os === 'linux' && r.variables.node === '18'
      );
      expect(linux18).toBeDefined();
      expect(linux18!.stage.env!['MATRIX_OS']).toBe('linux');
      expect(linux18!.stage.env!['MATRIX_NODE']).toBe('18');
    });
  });

  describe('expandMatrix - exclusions', () => {
    test('should exclude specified combinations', () => {
      const stage = {
        name: 'test',
        runsOn: 'ubuntu-latest',
        steps: [{ name: 'run', uses: 'shell@1.0' }],
        matrix: {
          os: ['linux', 'macos', 'windows'],
          node: ['18', '20'],
          exclude: [
            { os: 'macos', node: '18' },
            { os: 'windows', node: '20' },
          ],
        },
      };

      const result = MatrixExpander.expandMatrix(stage);

      // 3 x 2 = 6 total, minus 2 exclusions = 4
      expect(result).toHaveLength(4);

      // Verify excluded combos are not present
      const macos18 = result.find(
        (r) => r.variables.os === 'macos' && r.variables.node === '18'
      );
      expect(macos18).toBeUndefined();

      const windows20 = result.find(
        (r) => r.variables.os === 'windows' && r.variables.node === '20'
      );
      expect(windows20).toBeUndefined();
    });

    test('should handle partial exclude keys (only matching specified keys)', () => {
      const stage = {
        name: 'test',
        runsOn: 'ubuntu-latest',
        steps: [{ name: 'run', uses: 'shell@1.0' }],
        matrix: {
          os: ['linux', 'macos'],
          node: ['18', '20'],
          arch: ['x64', 'arm64'],
          exclude: [{ os: 'macos' }],
        },
      };

      const result = MatrixExpander.expandMatrix(stage);

      // All macos combinations should be excluded: 2 x 2 = 4 macos combos
      // Total: 2 x 2 x 2 = 8, minus 4 macos = 4
      expect(result).toHaveLength(4);

      // No macos results
      const macosResults = result.filter((r) => r.variables.os === 'macos');
      expect(macosResults).toHaveLength(0);
    });
  });

  describe('expandMatrix - naming', () => {
    test('should format name with single variable', () => {
      const stage = {
        name: 'build',
        runsOn: 'ubuntu-latest',
        steps: [],
        matrix: { node: ['18'] },
      };

      const result = MatrixExpander.expandMatrix(stage);
      expect(result[0].name).toBe('build (node=18)');
    });

    test('should format name with multiple variables sorted alphabetically', () => {
      const stage = {
        name: 'build',
        runsOn: 'ubuntu-latest',
        steps: [],
        matrix: { node: ['20'], os: ['linux'] },
      };

      const result = MatrixExpander.expandMatrix(stage);
      // Keys should be sorted: node, os
      expect(result[0].name).toBe('build (node=20, os=linux)');
    });

    test('should preserve original stage name as prefix', () => {
      const stage = {
        name: 'integration-test',
        runsOn: 'ubuntu-latest',
        steps: [],
        matrix: { browser: ['chrome', 'firefox'] },
      };

      const result = MatrixExpander.expandMatrix(stage);
      expect(result[0].name).toMatch(/^integration-test \(/);
      expect(result[1].name).toMatch(/^integration-test \(/);
    });
  });

  describe('expandMatrix - stage properties preservation', () => {
    test('should preserve runsOn from original stage', () => {
      const stage = {
        name: 'test',
        runsOn: 'custom-runner',
        steps: [],
        matrix: { node: ['18'] },
      };

      const result = MatrixExpander.expandMatrix(stage);
      expect(result[0].stage.runsOn).toBe('custom-runner');
    });

    test('should preserve steps from original stage', () => {
      const steps = [
        { name: 'setup', uses: 'setup@1.0' },
        { name: 'run', uses: 'shell@1.0' },
      ];
      const stage = {
        name: 'test',
        runsOn: 'ubuntu-latest',
        steps,
        matrix: { node: ['18'] },
      };

      const result = MatrixExpander.expandMatrix(stage);
      expect(result[0].stage.steps).toEqual(steps);
    });

    test('should preserve dependsOn from original stage', () => {
      const stage = {
        name: 'test',
        runsOn: 'ubuntu-latest',
        steps: [],
        dependsOn: ['build'],
        matrix: { node: ['18'] },
      };

      const result = MatrixExpander.expandMatrix(stage);
      expect(result[0].stage.dependsOn).toEqual(['build']);
    });

    test('should preserve timeout and retries from original stage', () => {
      const stage = {
        name: 'test',
        runsOn: 'ubuntu-latest',
        steps: [],
        timeout: 300,
        retries: 2,
        matrix: { node: ['18'] },
      };

      const result = MatrixExpander.expandMatrix(stage);
      expect(result[0].stage.timeout).toBe(300);
      expect(result[0].stage.retries).toBe(2);
    });

    test('should preserve cache and artifacts config', () => {
      const stage = {
        name: 'test',
        runsOn: 'ubuntu-latest',
        steps: [],
        cache: { enabled: true, key: 'npm-cache', paths: ['node_modules'] },
        artifacts: { upload: ['dist/'], expiry: 7 },
        matrix: { node: ['18'] },
      };

      const result = MatrixExpander.expandMatrix(stage);
      expect(result[0].stage.cache).toEqual({
        enabled: true,
        key: 'npm-cache',
        paths: ['node_modules'],
      });
      expect(result[0].stage.artifacts).toEqual({
        upload: ['dist/'],
        expiry: 7,
      });
    });

    test('should preserve if condition from original stage', () => {
      const stage = {
        name: 'test',
        runsOn: 'ubuntu-latest',
        steps: [],
        if: "branch == 'refs/heads/main'",
        matrix: { node: ['18'] },
      };

      const result = MatrixExpander.expandMatrix(stage);
      expect(result[0].stage.if).toBe("branch == 'refs/heads/main'");
    });
  });

  describe('expandMatrix - dependency rewriting', () => {
    test('should expand dependencies on original stage name to all expanded instances', () => {
      const stages = [
        {
          name: 'build',
          runsOn: 'ubuntu-latest',
          steps: [],
          matrix: { node: ['18', '20'] },
        },
        {
          name: 'deploy',
          runsOn: 'ubuntu-latest',
          steps: [],
          dependsOn: ['build'],
        },
      ];

      const result = MatrixExpander.expandAll(stages);

      // build expands to 2, deploy stays as 1
      expect(result).toHaveLength(3);

      // deploy should depend on both expanded build instances
      const deployStage = result.find((r) => r.originalName === 'deploy');
      expect(deployStage).toBeDefined();
      expect(deployStage!.stage.dependsOn).toContain('build (node=18)');
      expect(deployStage!.stage.dependsOn).toContain('build (node=20)');
      // Original 'build' dependency should be replaced
      expect(deployStage!.stage.dependsOn).not.toContain('build');
    });

    test('should handle multiple stages with matrix that depend on each other', () => {
      const stages = [
        {
          name: 'build',
          runsOn: 'ubuntu-latest',
          steps: [],
          matrix: { node: ['18', '20'] },
        },
        {
          name: 'test',
          runsOn: 'ubuntu-latest',
          steps: [],
          dependsOn: ['build'],
          matrix: { env: ['dev', 'staging'] },
        },
      ];

      const result = MatrixExpander.expandAll(stages);

      // build: 2 instances, test: 2 instances (each stage expands independently)
      // Total: 4 (standard matrix behavior: each stage's matrix is independent)
      expect(result).toHaveLength(4);

      // Each test instance should depend on both build instances
      const testStages = result.filter((r) => r.originalName === 'test');
      expect(testStages).toHaveLength(2);
      for (const ts of testStages) {
        expect(ts.stage.dependsOn).toContain('build (node=18)');
        expect(ts.stage.dependsOn).toContain('build (node=20)');
      }
    });

    test('should handle non-matrix stages with dependencies on matrix stages', () => {
      const stages = [
        {
          name: 'lint',
          runsOn: 'ubuntu-latest',
          steps: [],
        },
        {
          name: 'build',
          runsOn: 'ubuntu-latest',
          steps: [],
          dependsOn: ['lint'],
          matrix: { node: ['18', '20'] },
        },
        {
          name: 'deploy',
          runsOn: 'ubuntu-latest',
          steps: [],
          dependsOn: ['build'],
        },
      ];

      const result = MatrixExpander.expandAll(stages);

      // lint: 1, build: 2, deploy: 1 = 4
      expect(result).toHaveLength(4);

      // Both build instances should depend on lint
      const buildStages = result.filter((r) => r.originalName === 'build');
      for (const bs of buildStages) {
        expect(bs.stage.dependsOn).toContain('lint');
      }

      // deploy should depend on both build instances
      const deployStage = result.find((r) => r.originalName === 'deploy');
      expect(deployStage!.stage.dependsOn).toContain('build (node=18)');
      expect(deployStage!.stage.dependsOn).toContain('build (node=20)');
      expect(deployStage!.stage.dependsOn).not.toContain('build');
    });
  });

  describe('expandAll - no matrix stages', () => {
    test('should return stages unchanged when no matrix config', () => {
      const stages = [
        { name: 'build', runsOn: 'ubuntu-latest', steps: [] },
        { name: 'test', runsOn: 'ubuntu-latest', steps: [], dependsOn: ['build'] },
      ];

      const result = MatrixExpander.expandAll(stages);

      expect(result).toHaveLength(2);
      expect(result[0].originalName).toBe('build');
      expect(result[1].originalName).toBe('test');
      expect(result[1].stage.dependsOn).toEqual(['build']);
    });
  });

  describe('getMatrixDimensions', () => {
    test('should return dimensions count for cartesian product', () => {
      const matrix: MatrixConfig = {
        os: ['linux', 'macos'],
        node: ['18', '20', '22'],
      };

      const dimensions = MatrixExpander.getMatrixDimensions(matrix);
      expect(dimensions).toBe(6); // 2 x 3
    });

    test('should return 1 for single dimension', () => {
      const matrix: MatrixConfig = {
        node: ['18', '20', '22'],
      };

      const dimensions = MatrixExpander.getMatrixDimensions(matrix);
      expect(dimensions).toBe(3);
    });

    test('should return 0 for empty matrix', () => {
      const matrix: MatrixConfig = {};
      const dimensions = MatrixExpander.getMatrixDimensions(matrix);
      expect(dimensions).toBe(0);
    });
  });
});
