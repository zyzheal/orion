/**
 * PipelineValidator unit tests.
 *
 * Tests YAML validation: required fields, stage validation,
 * duplicate names, dependency checks, cycle detection, conditions.
 */

import { PipelineValidator } from '../PipelineValidator';

describe('PipelineValidator', () => {
  let validator: PipelineValidator;

  beforeEach(() => {
    validator = new PipelineValidator();
  });

  // ==================== YAML parsing ====================

  describe('YAML parsing', () => {
    it('should return error for invalid YAML', () => {
      const result = validator.validate(': \n  invalid: [');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'YAML_PARSE_ERROR')).toBe(true);
    });

    it('should return error for non-object YAML', () => {
      const result = validator.validate('just a string');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_FORMAT')).toBe(true);
    });

    it('should accept valid YAML', () => {
      const validYaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: my-pipeline
spec:
  stages:
    - name: build
      type: build
      runsOn: ubuntu-latest
      steps:
        - name: compile
          uses: npm run build
`;
      const result = validator.validate(validYaml);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ==================== Required fields ====================

  describe('required fields', () => {
    it('should error when apiVersion is missing', () => {
      const yaml = `
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: build
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'MISSING_API_VERSION')).toBe(true);
    });

    it('should error when kind is missing', () => {
      const yaml = `
apiVersion: v1
metadata:
  name: test
spec:
  stages:
    - name: build
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'MISSING_KIND')).toBe(true);
    });

    it('should error when kind is not Pipeline', () => {
      const yaml = `
apiVersion: v1
kind: Task
metadata:
  name: test
spec:
  stages:
    - name: build
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'INVALID_KIND')).toBe(true);
    });

    it('should error when metadata.name is missing', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata: {}
spec:
  stages:
    - name: build
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'MISSING_NAME')).toBe(true);
    });

    it('should error when stages is missing', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'MISSING_STAGES')).toBe(true);
    });
  });

  // ==================== Stage validation ====================

  describe('stage validation', () => {
    it('should error when stage name is missing', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - type: build
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'MISSING_STAGE_NAME')).toBe(true);
    });

    it('should error when stage name is empty', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: ""
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'MISSING_STAGE_NAME')).toBe(true);
    });

    it('should warn for unknown stage type', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: build
      type: unknown-type
      steps:
        - name: run
          uses: echo
`;
      const result = validator.validate(yaml);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.code === 'UNKNOWN_STAGE_TYPE')).toBe(true);
    });

    it('should accept valid stage types', () => {
      const validTypes = ['build', 'test', 'deploy', 'lint', 'analyze', 'publish',
        'notify', 'cleanup', 'security', 'integration-test', 'e2e-test',
        'performance-test', 'approval', 'manual', 'script', 'container', 'shell'];

      for (const type of validTypes) {
        const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: stage
      type: ${type}
      steps:
        - name: run
          uses: echo
`;
        const result = validator.validate(yaml);
        expect(result.warnings.some(w => w.code === 'UNKNOWN_STAGE_TYPE')).toBe(false);
      }
    });

    it('should error for invalid timeout', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: build
      timeout: -1
      steps:
        - name: run
          uses: echo
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'INVALID_TIMEOUT')).toBe(true);
    });

    it('should error for negative retries', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: build
      retries: -1
      steps:
        - name: run
          uses: echo
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'INVALID_RETRIES')).toBe(true);
    });

    it('should warn for stages with no steps', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: build
      type: build
`;
      const result = validator.validate(yaml);
      expect(result.warnings.some(w => w.code === 'EMPTY_STAGE_STEPS')).toBe(true);
    });
  });

  // ==================== Duplicate stage names ====================

  describe('duplicate stage names', () => {
    it('should error for duplicate stage names', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: build
      steps:
        - name: run
          uses: echo
    - name: build
      steps:
        - name: run
          uses: echo
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'DUPLICATE_STAGE_NAME')).toBe(true);
      expect(result.errors.some(e => e.message.includes('"build"'))).toBe(true);
    });

    it('should pass when all stage names are unique', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: build
      steps:
        - name: run
          uses: echo
    - name: test
      dependsOn:
        - build
      steps:
        - name: run
          uses: echo
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'DUPLICATE_STAGE_NAME')).toBe(false);
    });
  });

  // ==================== Dependency validation ====================

  describe('dependency validation', () => {
    it('should error for missing dependency target', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: test
      dependsOn:
        - nonexistent
      steps:
        - name: run
          uses: echo
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'MISSING_DEPENDENCY')).toBe(true);
      expect(result.errors.some(e => e.message.includes('nonexistent'))).toBe(true);
    });

    it('should pass when all dependencies are valid', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: build
      steps:
        - name: run
          uses: echo
    - name: test
      dependsOn:
        - build
      steps:
        - name: run
          uses: echo
    - name: deploy
      dependsOn:
        - build
        - test
      steps:
        - name: run
          uses: echo
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'MISSING_DEPENDENCY')).toBe(false);
    });

    it('should warn when dependsOn is a string instead of array', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: build
      steps:
        - name: run
          uses: echo
    - name: test
      dependsOn: build
      steps:
        - name: run
          uses: echo
`;
      const result = validator.validate(yaml);
      expect(result.warnings.some(w => w.code === 'DEPENDSON_STRING')).toBe(true);
    });

    it('should error when dependsOn is not an array or string', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: test
      dependsOn: 123
      steps:
        - name: run
          uses: echo
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'INVALID_DEPENDSON')).toBe(true);
    });
  });

  // ==================== Cycle detection ====================

  describe('cycle detection', () => {
    it('should detect simple cycle A -> B -> A', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: A
      dependsOn:
        - B
      steps:
        - name: run
          uses: echo
    - name: B
      dependsOn:
        - A
      steps:
        - name: run
          uses: echo
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'CYCLIC_DEPENDENCY')).toBe(true);
      expect(result.errors.some(e => e.message.includes('A') && e.message.includes('B'))).toBe(true);
    });

    it('should detect three-node cycle A -> B -> C -> A', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: A
      dependsOn:
        - C
      steps:
        - name: run
          uses: echo
    - name: B
      dependsOn:
        - A
      steps:
        - name: run
          uses: echo
    - name: C
      dependsOn:
        - B
      steps:
        - name: run
          uses: echo
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'CYCLIC_DEPENDENCY')).toBe(true);
    });

    it('should not report cycles for valid DAG', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: A
      steps:
        - name: run
          uses: echo
    - name: B
      dependsOn:
        - A
      steps:
        - name: run
          uses: echo
    - name: C
      dependsOn:
        - A
        - B
      steps:
        - name: run
          uses: echo
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'CYCLIC_DEPENDENCY')).toBe(false);
    });

    it('should handle diamond pattern without cycles', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: A
      steps:
        - name: run
          uses: echo
    - name: B
      dependsOn:
        - A
      steps:
        - name: run
          uses: echo
    - name: C
      dependsOn:
        - A
      steps:
        - name: run
          uses: echo
    - name: D
      dependsOn:
        - B
        - C
      steps:
        - name: run
          uses: echo
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'CYCLIC_DEPENDENCY')).toBe(false);
    });
  });

  // ==================== Condition validation ====================

  describe('condition validation', () => {
    it('should error for empty condition', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: build
      if: "   "
      steps:
        - name: run
          uses: echo
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'EMPTY_CONDITION')).toBe(true);
    });

    it('should error for unsafe condition with eval()', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: build
      if: "eval('malicious')"
      steps:
        - name: run
          uses: echo
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'UNSAFE_CONDITION')).toBe(true);
      expect(result.errors.some(e => e.message.includes('eval('))).toBe(true);
    });

    it('should error for unsafe condition with require()', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: build
      if: "require('fs')"
      steps:
        - name: run
          uses: echo
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'UNSAFE_CONDITION')).toBe(true);
    });

    it('should accept valid condition expressions', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: build
      if: "branch == 'main'"
      steps:
        - name: run
          uses: echo
`;
      const result = validator.validate(yaml);
      expect(result.errors.some(e => e.code === 'UNSAFE_CONDITION')).toBe(false);
      expect(result.errors.some(e => e.code === 'EMPTY_CONDITION')).toBe(false);
    });
  });

  // ==================== Warnings ====================

  describe('warnings', () => {
    it('should warn for empty stages array', () => {
      const yaml = `
apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages: []
`;
      const result = validator.validate(yaml);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.code === 'EMPTY_STAGES')).toBe(true);
    });
  });

  // ==================== Flat format ====================

  describe('flat YAML format', () => {
    it('should validate flat format YAML', () => {
      const yaml = `
name: my-pipeline
stages:
  - name: build
    type: build
    steps:
      - name: compile
        uses: npm run build
  - name: test
    dependsOn:
      - build
    steps:
      - name: run
        uses: npm test
`;
      const result = validator.validate(yaml);
      // Should still error for missing apiVersion/kind but stages should be found
      expect(result.errors.some(e => e.code === 'MISSING_STAGES')).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_DEPENDENCY')).toBe(false);
    });
  });
});
