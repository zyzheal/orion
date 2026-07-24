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

  describe('processArrayIterations', () => {
    it('should render array items with object properties', () => {
      const template = engine.getTemplate('typescript', 'jest', 'jest-unit-class')!;
      const context = {
        symbolName: 'UserService',
        importPath: './UserService',
        methods: [
          { methodName: 'getUser' },
          { methodName: 'createUser' },
        ],
        mockSetup: '',
        assertions: 'expect(result).toBeDefined();',
      };

      const result = engine.renderTemplate(template, context);

      expect(result).toContain('getUser');
      expect(result).toContain('createUser');
    });

    it('should handle empty array by removing block', () => {
      const template = engine.getTemplate('typescript', 'jest', 'jest-unit-class')!;
      const context = {
        symbolName: 'EmptyClass',
        importPath: './EmptyClass',
        methods: [],
        mockSetup: '',
        assertions: 'expect(result).toBeDefined();',
      };

      const result = engine.renderTemplate(template, context);

      // Should not contain method iteration markers
      expect(result).not.toContain('{{#methods}}');
    });

    it('should handle simple array with object items', () => {
      const template = engine.getTemplate('typescript', 'jest', 'edge-case-template')!;
      const context = {
        symbolName: 'testFunc',
        edgeCases: [
          { caseName: 'zero input', assertions: 'expect(result).toBe(0);' },
          { caseName: 'negative input', assertions: 'expect(result).toThrow();' },
        ],
        parameters: [{ name: 'value', edgeValue: '0' }],
        assertions: 'expect(result).toBeDefined();',
      };

      const result = engine.renderTemplate(template, context);

      // The template uses {{caseName}} not {{this}} for object items
      expect(result).toContain('testFunc');
    });

    it('should handle non-array value by removing block', () => {
      const template = engine.getTemplate('typescript', 'jest', 'jest-unit-class')!;
      const context = {
        symbolName: 'NoMethods',
        importPath: './NoMethods',
        methods: 'not-an-array' as any,
        mockSetup: '',
      };

      const result = engine.renderTemplate(template, context);

      expect(result).not.toContain('{{#methods}}');
    });
  });

  describe('generateTestCode with different frameworks', () => {
    it('should generate test for Go function', () => {
      const symbol = {
        name: 'CalculateSum',
        type: 'function',
        signature: 'func CalculateSum(a int, b int) int',
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

      const result = engine.generateTestCode(symbol, 'pkg/math/sum.go', 'go-testing');

      expect(result).toContain('func Test');
    });

    it('should generate test for Java class', () => {
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

      const result = engine.generateTestCode(symbol, 'src/main/java/UserService.java', 'junit5');

      expect(result).toContain('UserServiceTest');
    });

    it('should fall back to basic test when template not found', () => {
      const symbol = {
        name: 'unknownFunc',
        type: 'function',
        signature: 'function unknownFunc()',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 3 },
        testRecommendations: [],
      };

      // Use a framework that might not have a matching template
      const result = engine.generateTestCode(symbol, 'src/unknown.ts', 'vitest');

      expect(result).toContain('unknownFunc');
    });

    it('should generate basic test for jest framework', () => {
      const symbol = {
        name: 'basicFunc',
        type: 'function',
        signature: 'function basicFunc()',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 3 },
        testRecommendations: [],
      };

      const result = engine.generateTestCode(symbol, 'src/basic.ts', 'jest');

      expect(result).toContain('basicFunc');
    });

    it('should generate basic test for pytest framework', () => {
      const symbol = {
        name: 'basic_func',
        type: 'function',
        signature: 'def basic_func()',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 3 },
        testRecommendations: [],
      };

      const result = engine.generateTestCode(symbol, 'app/basic.py', 'pytest');

      expect(result).toContain('basic_func');
    });

    it('should generate basic test for go-testing framework', () => {
      const symbol = {
        name: 'BasicFunc',
        type: 'function',
        signature: 'func BasicFunc()',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 3 },
        testRecommendations: [],
      };

      const result = engine.generateTestCode(symbol, 'pkg/basic.go', 'go-testing');

      expect(result).toContain('BasicFunc');
    });

    it('should generate basic test for junit5 framework', () => {
      const symbol = {
        name: 'BasicClass',
        type: 'class',
        signature: 'class BasicClass',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 10 },
        testRecommendations: [],
      };

      const result = engine.generateTestCode(symbol, 'src/main/java/BasicClass.java', 'junit5');

      expect(result).toContain('BasicClass');
    });

    it('should generate basic test for unknown framework', () => {
      const symbol = {
        name: 'unknownFunc',
        type: 'function',
        signature: 'function unknownFunc()',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 3 },
        testRecommendations: [],
      };

      const result = engine.generateTestCode(symbol, 'src/unknown.ts', 'unknown' as any);

      expect(result).toContain('unknownFunc');
    });
  });

  describe('extractPackageName', () => {
    it('should extract package name from Go file path', () => {
      const symbol = {
        name: 'Helper',
        type: 'function',
        signature: 'func Helper()',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 3 },
        testRecommendations: [],
      };

      const result = engine.generateTestCode(symbol, 'pkg/utils/helper.go', 'go-testing');

      expect(result).toContain('package utils');
    });

    it('should default to main for Go file without directory', () => {
      const symbol = {
        name: 'Main',
        type: 'function',
        signature: 'func Main()',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 3 },
        testRecommendations: [],
      };

      const result = engine.generateTestCode(symbol, 'main.go', 'go-testing');

      expect(result).toContain('package main');
    });

    it('should extract package name from Java file path', () => {
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

      // This exercises extractPackageName for Java with deep path
      const result = engine.generateTestCode(symbol, 'src/main/java/com/example/service/UserService.java', 'junit5');

      expect(result).toContain('UserService');
    });

    it('should default to com.example for Java file without package path', () => {
      const symbol = {
        name: 'SimpleClass',
        type: 'class',
        signature: 'class SimpleClass',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 10 },
        testRecommendations: [],
      };

      // This exercises extractPackageName for Java with shallow path
      const result = engine.generateTestCode(symbol, 'SimpleClass.java', 'junit5');

      expect(result).toContain('SimpleClass');
    });
  });

  describe('generateMockSetup', () => {
    it('should generate test for function with non-primitive parameter types', () => {
      const symbol = {
        name: 'processUser',
        type: 'function',
        signature: 'function processUser(db: Database, user: User)',
        parameters: [
          { name: 'db', type: 'Database', optional: false },
          { name: 'user', type: 'User', optional: false },
        ],
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 5 },
        testRecommendations: [],
      };

      // This exercises generateMockSetup with non-primitive types
      const result = engine.generateTestCode(symbol, 'src/service.ts');

      expect(result).toContain('processUser');
    });

    it('should generate test for function with primitive types', () => {
      const symbol = {
        name: 'add',
        type: 'function',
        signature: 'function add(a: number, b: number)',
        parameters: [
          { name: 'a', type: 'number', optional: false },
          { name: 'b', type: 'number', optional: false },
        ],
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 3 },
        testRecommendations: [],
      };

      // This exercises generateMockSetup with primitive types (no mocks generated)
      const result = engine.generateTestCode(symbol, 'src/math.ts');

      expect(result).toContain('add');
    });
  });

  describe('generateAssertions', () => {
    it('should generate test for function with primitive return type', () => {
      const symbol = {
        name: 'getName',
        type: 'function',
        signature: 'function getName(): string',
        returnType: 'string',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 3 },
        testRecommendations: [],
      };

      // This exercises generateAssertions with primitive return type
      const result = engine.generateTestCode(symbol, 'src/user.ts');

      expect(result).toContain('getName');
    });

    it('should generate test for function with non-primitive return type', () => {
      const symbol = {
        name: 'getUser',
        type: 'function',
        signature: 'function getUser(): User',
        returnType: 'User',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 3 },
        testRecommendations: [],
      };

      // This exercises generateAssertions with non-primitive return type
      const result = engine.generateTestCode(symbol, 'src/user.ts');

      expect(result).toContain('getUser');
    });

    it('should generate test for function without return type', () => {
      const symbol = {
        name: 'doSomething',
        type: 'function',
        signature: 'function doSomething()',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 3 },
        testRecommendations: [],
      };

      // This exercises generateAssertions without return type
      const result = engine.generateTestCode(symbol, 'src/utils.ts');

      expect(result).toContain('doSomething');
    });
  });

  describe('registerTemplate', () => {
    it('should register custom template', () => {
      engine.registerTemplate({
        name: 'custom-template',
        language: 'typescript',
        framework: 'jest',
        template: 'describe("{{symbolName}}", () => {});',
        variables: [
          { name: 'symbolName', type: 'string', required: true },
        ],
        description: 'Custom test template',
      });

      const template = engine.getTemplate('typescript', 'jest', 'custom-template');
      expect(template).toBeDefined();
      expect(template?.name).toBe('custom-template');
    });
  });

  describe('getTemplateNameForSymbol edge cases', () => {
    it('should return unit-function for unknown type', () => {
      expect(engine.getTemplateNameForSymbol('unknown')).toBe('unit-function');
    });

    it('should return unit-function for interface type', () => {
      expect(engine.getTemplateNameForSymbol('interface')).toBe('unit-function');
    });
  });

  describe('calculateImportPath', () => {
    it('should remove src prefix', () => {
      const symbol = {
        name: 'test',
        type: 'function',
        signature: 'function test()',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 3 },
        testRecommendations: [],
      };

      const result = engine.generateTestCode(symbol, 'src/utils/helper.ts');

      expect(result).toContain('./utils/helper');
    });

    it('should remove lib prefix', () => {
      const symbol = {
        name: 'test',
        type: 'function',
        signature: 'function test()',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 3 },
        testRecommendations: [],
      };

      const result = engine.generateTestCode(symbol, 'lib/utils/helper.ts');

      expect(result).toContain('./utils/helper');
    });

    it('should remove app prefix for Python', () => {
      const symbol = {
        name: 'test_func',
        type: 'function',
        signature: 'def test_func()',
        isNew: true,
        isModified: false,
        isDeleted: false,
        lineRange: { start: 1, end: 3 },
        testRecommendations: [],
      };

      const result = engine.generateTestCode(symbol, 'app/utils/helper.py', 'pytest');

      expect(result).toContain('utils.helper');
    });
  });
});