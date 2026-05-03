/**
 * TestGeneratorService Tests
 */

import { TestGeneratorService } from '../TestGeneratorService';
import { DEFAULT_TEST_GENERATION_STRATEGY } from '../types';

describe('TestGeneratorService', () => {
  let service: TestGeneratorService;

  beforeEach(() => {
    service = new TestGeneratorService();
  });

  describe('generateTests', () => {
    it('should generate tests for TypeScript function addition', async () => {
      const request = {
        change: {
          diff: `diff --git a/src/utils.ts b/src/utils.ts
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,0 +1,10 @@
+export function calculateSum(a: number, b: number): number {
+  return a + b;
+}`,
          filePath: 'src/utils.ts',
          language: 'typescript',
        },
      };

      const response = await service.generateTests(request);

      expect(response.tests.length).toBeGreaterThan(0);
      expect(response.generationId).toBeDefined();
      expect(response.generationTime).toBeGreaterThan(0);
      expect(response.modelUsage).toBeDefined();
    });

    it('should generate tests with custom strategy', async () => {
      const request = {
        change: {
          diff: `+function testFunc(): void {}`,
          filePath: 'test.ts',
          language: 'typescript',
        },
        strategy: {
          unitTests: true,
          edgeCaseTests: false,
          coverageTarget: 90,
          includeMocking: true,
        },
      };

      const response = await service.generateTests(request);

      expect(response.tests.length).toBeGreaterThan(0);
    });

    it('should generate tests for Python code', async () => {
      const request = {
        change: {
          diff: `+def calculate_sum(a: int, b: int) -> int:\n    return a + b`,
          filePath: 'app/utils.py',
          language: 'python',
        },
        targetFramework: 'pytest',
      };

      const response = await service.generateTests(request);

      expect(response.tests.length).toBeGreaterThan(0);
      expect(response.tests[0].testCode).toContain('pytest');
    });

    it('should generate tests for Go code', async () => {
      const request = {
        change: {
          diff: `+func CalculateSum(a int, b int) int {\n    return a + b\n}`,
          filePath: 'pkg/math/sum.go',
          language: 'go',
        },
      };

      const response = await service.generateTests(request);

      expect(response.tests.length).toBeGreaterThan(0);
      expect(response.tests[0].testCode).toContain('func Test');
    });

    it('should generate tests for Java code', async () => {
      const request = {
        change: {
          diff: `+public class UserService {\n    public User getUser(String id) {\n        return null;\n    }\n}`,
          filePath: 'src/main/java/UserService.java',
          language: 'java',
        },
      };

      const response = await service.generateTests(request);

      expect(response.tests.length).toBeGreaterThan(0);
      expect(response.tests[0].testCode).toContain('class UserServiceTest');
    });

    it('should generate suggestions', async () => {
      const request = {
        change: {
          diff: `+async function fetchData(): Promise<Data> {\n    const response = await fetch('/api/data');\n    return response.json();\n}`,
          filePath: 'src/api.ts',
          language: 'typescript',
        },
      };

      const response = await service.generateTests(request);

      expect(response.suggestions.length).toBeGreaterThan(0);
      expect(response.suggestions[0].type).toBeDefined();
      expect(response.suggestions[0].priority).toBeDefined();
    });

    it('should limit max tests per generation', async () => {
      const serviceWithLimit = new TestGeneratorService({
        maxTestsPerGeneration: 2,
      });

      // Create a diff with multiple functions
      const request = {
        change: {
          diff: `+function func1() {}\n+function func2() {}\n+function func3() {}\n+function func4() {}`,
          filePath: 'test.ts',
          language: 'typescript',
        },
      };

      const response = await serviceWithLimit.generateTests(request);

      expect(response.tests.length).toBeLessThanOrEqual(4); // 2 functions * 2 tests each (unit + edge)
    });

    it('should estimate coverage', async () => {
      const request = {
        change: {
          diff: `+function calculate(a: number, b: number): number {\n    return a + b;\n}`,
          filePath: 'test.ts',
          language: 'typescript',
        },
      };

      const response = await service.generateTests(request);

      expect(response.tests[0].coverage).toBeDefined();
      expect(response.tests[0].coverage.lines).toBeGreaterThanOrEqual(0);
      expect(response.tests[0].coverage.lines).toBeLessThanOrEqual(100);
    });

    it('should handle empty diff', async () => {
      const request = {
        change: {
          diff: '',
          filePath: 'empty.ts',
          language: 'typescript',
        },
      };

      const response = await service.generateTests(request);

      // Should return empty tests for empty diff
      expect(response.tests.length).toBe(0);
    });

    it('should record history', async () => {
      const request = {
        change: {
          diff: `+function test(): void {}`,
          filePath: 'test.ts',
          language: 'typescript',
        },
        prId: 'pr-123',
      };

      const response = await service.generateTests(request);

      const history = service.getGenerationHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].prId).toBe('pr-123');
    });
  });

  describe('analyzeChange', () => {
    it('should analyze TypeScript code change', async () => {
      const result = await service.analyzeChange(
        `+function newFunc(): void {}`,
        'test.ts',
        'typescript'
      );

      expect(result.filePath).toBe('test.ts');
      expect(result.language).toBe('typescript');
      expect(result.analysisId).toBeDefined();
      expect(result.changedSymbols.length).toBeGreaterThan(0);
    });

    it('should analyze Python code change', async () => {
      const result = await service.analyzeChange(
        `+def new_func(): pass`,
        'test.py',
        'python'
      );

      expect(result.language).toBe('python');
      expect(result.changedSymbols.length).toBeGreaterThan(0);
    });
  });

  describe('suggestCoverageImprovements', () => {
    it('should suggest improvements for low coverage', async () => {
      const request = {
        sourceFile: 'src/utils.ts',
        language: 'typescript',
        currentCoverage: {
          lines: 30,
          branches: 20,
          functions: 40,
        },
      };

      const response = await service.suggestCoverageImprovements(request);

      expect(response.suggestions.length).toBeGreaterThan(0);
      expect(response.estimatedImprovement.lines).toBeGreaterThan(request.currentCoverage.lines);
    });

    it('should suggest improvements with uncovered lines', async () => {
      const request = {
        sourceFile: 'src/utils.ts',
        language: 'typescript',
        currentCoverage: {
          lines: 50,
          branches: 40,
          functions: 60,
        },
        uncoveredLines: [10, 20, 30, 40, 50],
      };

      const response = await service.suggestCoverageImprovements(request);

      expect(response.suggestions.length).toBeGreaterThan(0);
      const specificSuggestion = response.suggestions.find(
        s => s.description.includes('lines')
      );
      expect(specificSuggestion).toBeDefined();
    });

    it('should generate recommended tests with source content', async () => {
      const request = {
        sourceFile: 'src/utils.ts',
        language: 'typescript',
        currentCoverage: {
          lines: 40,
          branches: 30,
          functions: 50,
        },
        sourceContent: `function add(a: number, b: number): number {\n  return a + b;\n}`,
      };

      const response = await service.suggestCoverageImprovements(request);

      expect(response.recommendedTests.length).toBeGreaterThan(0);
      expect(response.recommendedTests[0].testCode).toContain('add'); // Contains the function name
      expect(response.recommendedTests[0].testCode).toContain('describe');
    });
  });

  describe('getTemplates', () => {
    it('should return all templates grouped by language and framework', () => {
      const templates = service.getTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0].language).toBeDefined();
      expect(templates[0].framework).toBeDefined();
      expect(templates[0].templates.length).toBeGreaterThan(0);
    });

    it('should include TypeScript templates', () => {
      const templates = service.getTemplates();
      const tsTemplates = templates.filter(t => t.language === 'typescript');

      expect(tsTemplates.length).toBeGreaterThan(0);
    });

    it('should include Python templates', () => {
      const templates = service.getTemplates();
      const pyTemplates = templates.filter(t => t.language === 'python');

      expect(pyTemplates.length).toBeGreaterThan(0);
    });
  });

  describe('getGenerationHistory', () => {
    it('should return empty history initially', () => {
      const history = service.getGenerationHistory();
      expect(history.length).toBe(0);
    });

    it('should return history after generation', async () => {
      await service.generateTests({
        change: {
          diff: `+function test() {}`,
          filePath: 'test.ts',
          language: 'typescript',
        },
      });

      const history = service.getGenerationHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].id).toBeDefined();
      expect(history[0].filePath).toBe('test.ts');
      expect(history[0].testCount).toBeGreaterThan(0);
    });
  });

  describe('markAsAdopted', () => {
    it('should mark generation as adopted', async () => {
      const response = await service.generateTests({
        change: {
          diff: `+function test() {}`,
          filePath: 'test.ts',
          language: 'typescript',
        },
      });

      service.markAsAdopted(response.generationId);

      const history = service.getGenerationHistory();
      const record = history.find(h => h.id === response.generationId);

      expect(record?.adopted).toBe(true);
      expect(record?.adoptedAt).toBeDefined();
    });
  });

  describe('setAIGateway', () => {
    it('should accept AI Gateway instance', () => {
      const mockGateway = {
        execute: jest.fn().mockResolvedValue({ success: true, data: 'test' }),
      };

      service.setAIGateway(mockGateway);

      expect(service).toBeDefined();
    });
  });

  describe('generation response format', () => {
    it('should include all required fields', async () => {
      const response = await service.generateTests({
        change: {
          diff: `+function test(): void {}`,
          filePath: 'test.ts',
          language: 'typescript',
        },
      });

      expect(response).toHaveProperty('tests');
      expect(response).toHaveProperty('suggestions');
      expect(response).toHaveProperty('generationTime');
      expect(response).toHaveProperty('modelUsage');
      expect(response).toHaveProperty('generationId');
      expect(response).toHaveProperty('createdAt');
    });

    it('should include test case details', async () => {
      const response = await service.generateTests({
        change: {
          diff: `+function test(): void {}`,
          filePath: 'test.ts',
          language: 'typescript',
        },
      });

      if (response.tests.length > 0) {
        expect(response.tests[0]).toHaveProperty('testFile');
        expect(response.tests[0]).toHaveProperty('testCode');
        expect(response.tests[0]).toHaveProperty('coverage');
        expect(response.tests[0]).toHaveProperty('explanation');
        expect(response.tests[0]).toHaveProperty('testType');
        expect(response.tests[0]).toHaveProperty('priority');
      }
    });
  });

  describe('edge case generation', () => {
    it('should generate edge cases for functions with parameters', async () => {
      const request = {
        change: {
          diff: `+function divide(a: number, b: number): number {\n  return a / b;\n}`,
          filePath: 'math.ts',
          language: 'typescript',
        },
        strategy: {
          edgeCaseTests: true,
        },
      };

      const response = await service.generateTests(request);

      // Should have unit test + edge case tests
      expect(response.tests.length).toBeGreaterThan(1);

      const edgeCaseTest = response.tests.find(t => t.testType === 'edge_case');
      expect(edgeCaseTest).toBeDefined();
    });
  });
});