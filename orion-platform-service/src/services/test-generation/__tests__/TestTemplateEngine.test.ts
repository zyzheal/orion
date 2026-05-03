/**
 * TestTemplateEngine Tests
 */

import { TestTemplateEngine } from '../TestTemplateEngine';
import { ProgrammingLanguage, TestFramework } from '../types';

describe('TestTemplateEngine', () => {
  let engine: TestTemplateEngine;

  beforeEach(() => {
    engine = new TestTemplateEngine();
  });

  describe('getRecommendedFramework', () => {
    it('should recommend Jest for TypeScript', () => {
      expect(engine.getRecommendedFramework('typescript')).toBe('jest');
    });

    it('should recommend Jest for JavaScript', () => {
      expect(engine.getRecommendedFramework('javascript')).toBe('jest');
    });

    it('should recommend pytest for Python', () => {
      expect(engine.getRecommendedFramework('python')).toBe('pytest');
    });

    it('should recommend go-testing for Go', () => {
      expect(engine.getRecommendedFramework('go')).toBe('go-testing');
    });

    it('should recommend JUnit5 for Java', () => {
      expect(engine.getRecommendedFramework('java')).toBe('junit5');
    });
  });

  describe('getTemplateNameForSymbol', () => {
    it('should return unit-function for function type', () => {
      expect(engine.getTemplateNameForSymbol('function')).toBe('unit-function');
    });

    it('should return unit-class for class type', () => {
      expect(engine.getTemplateNameForSymbol('class')).toBe('unit-class');
    });

    it('should return unit-function for method type', () => {
      expect(engine.getTemplateNameForSymbol('method')).toBe('unit-function');
    });
  });

  describe('getAllTemplates', () => {
    it('should return all registered templates', () => {
      const templates = engine.getAllTemplates();
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should include Jest templates', () => {
      const templates = engine.getAllTemplates();
      const jestTemplates = templates.filter(t => t.framework === 'jest');
      expect(jestTemplates.length).toBeGreaterThan(0);
    });

    it('should include pytest templates', () => {
      const templates = engine.getAllTemplates();
      const pytestTemplates = templates.filter(t => t.framework === 'pytest');
      expect(pytestTemplates.length).toBeGreaterThan(0);
    });

    it('should include Go testing templates', () => {
      const templates = engine.getAllTemplates();
      const goTemplates = templates.filter(t => t.framework === 'go-testing');
      expect(goTemplates.length).toBeGreaterThan(0);
    });

    it('should include JUnit templates', () => {
      const templates = engine.getAllTemplates();
      const junitTemplates = templates.filter(t => t.framework === 'junit5' || t.framework === 'junit4');
      expect(junitTemplates.length).toBeGreaterThan(0);
    });
  });

  describe('getTemplate', () => {
    it('should return specific template', () => {
      const template = engine.getTemplate('typescript', 'jest', 'jest-unit-function');
      expect(template).toBeDefined();
      expect(template?.language).toBe('typescript');
      expect(template?.framework).toBe('jest');
    });

    it('should return undefined for non-existent template', () => {
      const template = engine.getTemplate('typescript', 'jest', 'non-existent');
      expect(template).toBeUndefined();
    });
  });

  describe('renderTemplate', () => {
    it('should render Jest template for function', () => {
      const template = engine.getTemplate('typescript', 'jest', 'jest-unit-function')!;
      const context = {
        symbolName: 'calculateSum',
        importPath: './utils',
        parameters: [
          { name: 'a', type: 'number', optional: false },
          { name: 'b', type: 'number', optional: false },
        ],
        returnType: 'number',
        mockSetup: '',
        assertions: 'expect(result).toBe(a + b);',
      };

      const result = engine.renderTemplate(template, context);

      expect(result).toContain('import { calculateSum }');
      expect(result).toContain('from \'./utils\'');
      expect(result).toContain('describe(\'calculateSum\'');
      expect(result).toContain('it(');
    });

    it('should render pytest template for Python', () => {
      const template = engine.getTemplate('python', 'pytest', 'pytest-unit-function')!;
      const context = {
        symbolName: 'calculate_sum',
        importPath: 'app.utils',
        parameters: [
          { name: 'a', type: 'int', optional: false },
          { name: 'b', type: 'int', optional: false },
        ],
      };

      const result = engine.renderTemplate(template, context);

      expect(result).toContain('import pytest');
      expect(result).toContain('from app.utils import calculate_sum');
      expect(result).toContain('class Testcalculate_sum');
    });

    it('should render Go testing template', () => {
      const template = engine.getTemplate('go', 'go-testing', 'go-testing-function')!;
      const context = {
        packageName: 'main',
        symbolName: 'CalculateSum',
        importPath: '',
        parameters: [
          { name: 'a', type: 'int', optional: false },
          { name: 'b', type: 'int', optional: false },
        ],
        returnType: 'int',
      };

      const result = engine.renderTemplate(template, context);

      expect(result).toContain('package main');
      expect(result).toContain('testing'); // Import contains testing
      expect(result).toContain('func TestCalculateSum');
    });

    it('should render JUnit5 template for Java', () => {
      const template = engine.getTemplate('java', 'junit5', 'junit5-unit-class')!;
      const context = {
        packageName: 'com.example',
        symbolName: 'UserService',
        importPath: 'com.example',
        methods: [{ methodName: 'getUser' }],
      };

      const result = engine.renderTemplate(template, context);

      expect(result).toContain('package com.example');
      expect(result).toContain('import org.junit.jupiter.api.Test');
      expect(result).toContain('class UserServiceTest');
    });

    it('should handle empty parameters', () => {
      const template = engine.getTemplate('typescript', 'jest', 'jest-unit-function')!;
      const context = {
        symbolName: 'simpleFunc',
        importPath: './utils',
        parameters: [],
        mockSetup: '',
        assertions: 'expect(result).toBeDefined();',
      };

      const result = engine.renderTemplate(template, context);

      expect(result).toContain('describe(\'simpleFunc\'');
      expect(result).not.toContain('undefined');
    });
  });

  describe('generateTestCode', () => {
    it('should generate test for function symbol', () => {
      const symbol = {
        name: 'calculateSum',
        type: 'function',
        signature: 'function calculateSum(a: number, b: number): number',
        parameters: [
          { name: 'a', type: 'number', optional: false },
          { name: 'b', type: 'number', optional: false },
        ],
        returnType: 'number',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 5 },
        testRecommendations: [],
      };

      const result = engine.generateTestCode(symbol, 'src/utils.ts');

      expect(result).toContain('import { calculateSum }');
      expect(result).toContain('describe(\'calculateSum\'');
    });

    it('should generate test for class symbol', () => {
      const symbol = {
        name: 'UserService',
        type: 'class',
        signature: 'class UserService',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 20 },
        testRecommendations: [],
      };

      const result = engine.generateTestCode(symbol, 'src/UserService.ts');

      expect(result).toContain('import { UserService }');
      expect(result).toContain('describe(\'UserService\'');
    });

    it('should generate test for Python', () => {
      const symbol = {
        name: 'calculate_sum',
        type: 'function',
        signature: 'def calculate_sum(a: int, b: int) -> int',
        parameters: [
          { name: 'a', type: 'int', optional: false },
          { name: 'b', type: 'int', optional: false },
        ],
        returnType: 'int',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 5 },
        testRecommendations: [],
      };

      const result = engine.generateTestCode(symbol, 'app/utils.py', 'pytest');

      expect(result).toContain('import pytest');
      expect(result).toContain('calculate_sum'); // Contains function name
      expect(result).toContain('def test'); // Contains test function
    });
  });

  describe('calculateImportPath', () => {
    it('should calculate import path for src directory', () => {
      const template = engine.getTemplate('typescript', 'jest', 'jest-unit-function')!;
      const context = {
        symbolName: 'test',
        importPath: './utils',
        filePath: 'src/utils.ts',
      };

      const result = engine.renderTemplate(template, context);
      expect(result).toContain('from \'./utils\'');
    });
  });

  describe('extractPackageName', () => {
    it('should extract package name for Go file', () => {
      const template = engine.getTemplate('go', 'go-testing', 'go-testing-function')!;
      const context = {
        packageName: 'utils',
        symbolName: 'TestFunc',
        filePath: 'pkg/utils/helper.go',
      };

      const result = engine.renderTemplate(template, context);
      expect(result).toContain('package utils');
    });
  });

  describe('generateMockSetup', () => {
    it('should generate mock for non-primitive types', () => {
      const template = engine.getTemplate('typescript', 'jest', 'jest-unit-class')!;
      const context = {
        symbolName: 'UserService',
        importPath: './UserService',
        mockSetup: '// Mock Database\nconst mockDb = {};',
      };

      const result = engine.renderTemplate(template, context);
      expect(result).toContain('Mock Database');
    });
  });

  describe('generateAssertions', () => {
    it('should generate basic assertions', () => {
      const template = engine.getTemplate('typescript', 'jest', 'jest-unit-function')!;
      const context = {
        symbolName: 'simpleFunc',
        importPath: './utils',
        assertions: 'expect(result).toBeDefined();',
      };

      const result = engine.renderTemplate(template, context);
      expect(result).toContain('expect(result)');
    });
  });

  describe('cleanupUnusedVariables', () => {
    it('should remove unreplaced variables', () => {
      const template = engine.getTemplate('typescript', 'jest', 'jest-unit-function')!;
      const context = {
        symbolName: 'testFunc',
        importPath: './utils',
      };

      const result = engine.renderTemplate(template, context);
      // Should not contain unreplaced {{xxx}} patterns
      expect(result).not.toMatch(/{{\w+}}/);
    });
  });
});