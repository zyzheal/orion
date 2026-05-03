/**
 * TestTemplateEngine - 测试模板引擎
 *
 * 功能：
 * 1. 按语言生成测试模板
 * 2. Jest/Vitest (TypeScript/JavaScript)
 * 3. pytest (Python)
 * 4. Go testing
 * 5. JUnit (Java)
 */

import {
  TestTemplate,
  TemplateVariable,
  TestFramework,
  ProgrammingLanguage,
  TEST_FRAMEWORK_MAP,
  ChangedSymbol,
  ParameterInfo,
} from './types';

/**
 * 模板渲染上下文
 */
interface TemplateContext {
  symbolName: string;
  symbolType: string;
  parameters: ParameterInfo[];
  returnType?: string;
  filePath: string;
  importPath: string;
  mockSetup?: string;
  assertions?: string;
  [key: string]: unknown;
}

/**
 * 测试模板引擎
 */
export class TestTemplateEngine {
  private templates: Map<string, TestTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * 初始化内置模板
   */
  private initializeTemplates(): void {
    // Jest/TypeScript 单元测试模板
    this.registerTemplate({
      name: 'jest-unit-function',
      language: 'typescript',
      framework: 'jest',
      template: `import { {{symbolName}} } from '{{importPath}}';

describe('{{symbolName}}', () => {
  {{mockSetup}}

  it('should work correctly with normal input', () => {
    // Test normal case
    {{#parameters}}
    const {{name}} = {{defaultValue}};
    {{/parameters}}
    const result = {{symbolName}}({{#parameters}}{{name}}{{/parameters}});
    {{assertions}}
  });

  it('should handle edge cases', () => {
    // Test edge cases
    {{#parameters}}
    // Test with empty/min/max values for {{name}}
    {{/parameters}}
  });

  it('should handle invalid input', () => {
    // Test invalid input
    {{#parameters}}
    // Test with null/undefined for {{name}}
    {{/parameters}}
  });
});
`,
      variables: [
        { name: 'symbolName', type: 'string', required: true, description: 'Function/class name' },
        { name: 'importPath', type: 'string', required: true, description: 'Import path' },
        { name: 'parameters', type: 'array', required: false, description: 'Parameters list' },
        { name: 'returnType', type: 'string', required: false, description: 'Return type' },
        { name: 'mockSetup', type: 'string', required: false, defaultValue: '', description: 'Mock setup code' },
        { name: 'assertions', type: 'string', required: false, defaultValue: 'expect(result).toBeDefined();', description: 'Assertion code' },
      ],
      description: 'Jest unit test template for functions',
    });

    // Jest 类测试模板
    this.registerTemplate({
      name: 'jest-unit-class',
      language: 'typescript',
      framework: 'jest',
      template: `import { {{symbolName}} } from '{{importPath}}';

describe('{{symbolName}}', () => {
  let instance: {{symbolName}};
  {{mockSetup}}

  beforeEach(() => {
    instance = new {{symbolName}}();
  });

  afterEach(() => {
    // Cleanup
  });

  it('should create instance correctly', () => {
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf({{symbolName}});
  });

  it('should initialize with correct state', () => {
    // Test initial state
  });

  {{#methods}}
  it('should {{methodName}} work correctly', () => {
    // Test {{methodName}}
    const result = instance.{{methodName}}();
    {{assertions}}
  });
  {{/methods}}
});
`,
      variables: [
        { name: 'symbolName', type: 'string', required: true, description: 'Class name' },
        { name: 'importPath', type: 'string', required: true, description: 'Import path' },
        { name: 'mockSetup', type: 'string', required: false, defaultValue: '', description: 'Mock setup code' },
        { name: 'methods', type: 'array', required: false, description: 'Methods to test' },
        { name: 'assertions', type: 'string', required: false, defaultValue: 'expect(result).toBeDefined();', description: 'Assertion code' },
      ],
      description: 'Jest unit test template for classes',
    });

    // Vitest 单元测试模板
    this.registerTemplate({
      name: 'vitest-unit-function',
      language: 'typescript',
      framework: 'vitest',
      template: `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { {{symbolName}} } from '{{importPath}}';

describe('{{symbolName}}', () => {
  {{mockSetup}}

  it('should work correctly with normal input', () => {
    // Test normal case
    {{#parameters}}
    const {{name}} = {{defaultValue}};
    {{/parameters}}
    const result = {{symbolName}}({{#parameters}}{{name}}{{/parameters}});
    {{assertions}}
  });

  it('should handle edge cases', () => {
    // Test edge cases
  });

  it('should handle invalid input gracefully', () => {
    // Test invalid input
    {{#parameters}}
    expect(() => {{symbolName}}(null)).toThrow();
    {{/parameters}}
  });
});
`,
      variables: [
        { name: 'symbolName', type: 'string', required: true, description: 'Function name' },
        { name: 'importPath', type: 'string', required: true, description: 'Import path' },
        { name: 'parameters', type: 'array', required: false, description: 'Parameters list' },
        { name: 'mockSetup', type: 'string', required: false, defaultValue: '', description: 'Mock setup code' },
        { name: 'assertions', type: 'string', required: false, defaultValue: 'expect(result).toBeDefined();', description: 'Assertion code' },
      ],
      description: 'Vitest unit test template for functions',
    });

    // pytest 函数测试模板
    this.registerTemplate({
      name: 'pytest-unit-function',
      language: 'python',
      framework: 'pytest',
      template: `import pytest
from {{importPath}} import {{symbolName}}

class Test{{symbolName}}:
    """Test suite for {{symbolName}}"""

    def test_normal_case(self):
        """Test normal case"""
        {{#parameters}}
        {{name}} = {{defaultValue}}
        {{/parameters}}
        result = {{symbolName}}({{#parameters}}{{name}}{{/parameters}})
        assert result is not None

    def test_edge_cases(self):
        """Test edge cases"""
        {{#parameters}}
        # Test with boundary values for {{name}}
        {{/parameters}}

    def test_invalid_input(self):
        """Test invalid input handling"""
        {{#parameters}}
        with pytest.raises((ValueError, TypeError)):
            {{symbolName}}(None)
        {{/parameters}}

    {{#optionalParams}}
    def test_optional_parameter_{{name}}(self):
        """Test optional parameter {{name}}"""
        result = {{symbolName}}({{#requiredParams}}{{name}}{{/requiredParams}})
        assert result is not None
    {{/optionalParams}}
`,
      variables: [
        { name: 'symbolName', type: 'string', required: true, description: 'Function name' },
        { name: 'importPath', type: 'string', required: true, description: 'Import path' },
        { name: 'parameters', type: 'array', required: false, description: 'Parameters list' },
        { name: 'optionalParams', type: 'array', required: false, description: 'Optional parameters' },
        { name: 'requiredParams', type: 'array', required: false, description: 'Required parameters' },
      ],
      description: 'pytest unit test template for functions',
    });

    // pytest 类测试模板
    this.registerTemplate({
      name: 'pytest-unit-class',
      language: 'python',
      framework: 'pytest',
      template: `import pytest
from {{importPath}} import {{symbolName}}

class Test{{symbolName}}:
    """Test suite for {{symbolName}} class"""

    @pytest.fixture
    def instance(self):
        """Create instance for testing"""
        return {{symbolName}}()

    def test_initialization(self, instance):
        """Test class initialization"""
        assert instance is not None
        assert isinstance(instance, {{symbolName}})

    {{#methods}}
    def test_{{methodName}}(self, instance):
        """Test {{methodName}} method"""
        result = instance.{{methodName}}()
        assert result is not None
    {{/methods}}

    def test_state_changes(self, instance):
        """Test state changes"""
        # Test state transitions
`,
      variables: [
        { name: 'symbolName', type: 'string', required: true, description: 'Class name' },
        { name: 'importPath', type: 'string', required: true, description: 'Import path' },
        { name: 'methods', type: 'array', required: false, description: 'Methods to test' },
      ],
      description: 'pytest unit test template for classes',
    });

    // Go testing 模板
    this.registerTemplate({
      name: 'go-testing-function',
      language: 'go',
      framework: 'go-testing',
      template: `package {{packageName}}

import (
    "testing"
    "{{importPath}}"
)

func Test{{symbolName}}(t *testing.T) {
    tests := []struct {
        name string
        {{#parameters}}
        {{name}} {{type}}
        {{/parameters}}
        want {{returnType}}
        wantErr bool
    }{
        {
            name: "normal case",
            {{#parameters}}
            {{name}}: {{defaultValue}},
            {{/parameters}}
            want: {{expectedResult}},
            wantErr: false,
        },
        {
            name: "edge case",
            {{#parameters}}
            {{name}}: {{edgeValue}},
            {{/parameters}}
            want: {{expectedResult}},
            wantErr: false,
        },
        {
            name: "error case",
            {{#parameters}}
            {{name}}: {{invalidValue}},
            {{/parameters}}
            want: nil,
            wantErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := {{symbolName}}({{#parameters}}tt.{{name}}{{/parameters}})
            if (err != nil) != tt.wantErr {
                t.Errorf("{{symbolName}}() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            if got != tt.want {
                t.Errorf("{{symbolName}}() = %v, want %v", got, tt.want)
            }
        })
    }
}
`,
      variables: [
        { name: 'packageName', type: 'string', required: true, defaultValue: 'main', description: 'Package name' },
        { name: 'symbolName', type: 'string', required: true, description: 'Function name' },
        { name: 'importPath', type: 'string', required: false, description: 'Import path' },
        { name: 'parameters', type: 'array', required: false, description: 'Parameters list' },
        { name: 'returnType', type: 'string', required: false, defaultValue: 'interface{}', description: 'Return type' },
        { name: 'expectedResult', type: 'string', required: false, defaultValue: 'nil', description: 'Expected result' },
      ],
      description: 'Go testing template for functions',
    });

    // JUnit5 测试模板
    this.registerTemplate({
      name: 'junit5-unit-class',
      language: 'java',
      framework: 'junit5',
      template: `package {{packageName}};

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.*;

import {{importPath}}.{{symbolName}}

@DisplayName("{{symbolName}} Test Suite")
class {{symbolName}}Test {

    private {{symbolName}} instance;

    @BeforeEach
    void setUp() {
        instance = new {{symbolName}}();
    }

    @AfterEach
    void tearDown() {
        // Cleanup
    }

    @Test
    @DisplayName("Should create instance correctly")
    void testInitialization() {
        assertNotNull(instance);
        assertTrue(instance instanceof {{symbolName}});
    }

    {{#methods}}
    @Test
    @DisplayName("Should {{methodName}} work correctly")
    void test{{MethodName}}() {
        // Test {{methodName}}
        var result = instance.{{methodName}}();
        assertNotNull(result);
    }
    {{/methods}}

    @Test
    @DisplayName("Should handle invalid input")
    void testInvalidInput() {
        // Test invalid input handling
        assertThrows(IllegalArgumentException.class, () -> {
            // Call method with invalid input
        });
    }
}
`,
      variables: [
        { name: 'packageName', type: 'string', required: true, defaultValue: 'com.example', description: 'Package name' },
        { name: 'symbolName', type: 'string', required: true, description: 'Class name' },
        { name: 'importPath', type: 'string', required: true, description: 'Import path' },
        { name: 'methods', type: 'array', required: false, description: 'Methods to test' },
      ],
      description: 'JUnit5 unit test template for classes',
    });

    // 边界测试模板（通用）
    this.registerTemplate({
      name: 'edge-case-template',
      language: 'typescript',
      framework: 'jest',
      template: `describe('{{symbolName}} - Edge Cases', () => {
  {{#edgeCases}}
  it('should handle {{caseName}}', () => {
    {{#parameters}}
    const {{name}} = {{edgeValue}};
    {{/parameters}}
    const result = {{symbolName}}({{#parameters}}{{name}}{{/parameters}});
    {{assertions}}
  });
  {{/edgeCases}}

  // Empty/null/undefined tests
  it('should handle null input', () => {
    {{#parameters}}
    expect(() => {{symbolName}}(null)).toThrow();
    {{/parameters}}
  });

  it('should handle undefined input', () => {
    {{#parameters}}
    expect(() => {{symbolName}}(undefined)).toThrow();
    {{/parameters}}
  });

  // Type mismatch tests
  it('should handle wrong type input', () => {
    {{#parameters}}
    expect(() => {{symbolName}}(wrongTypeValue)).toThrow(TypeError);
    {{/parameters}}
  });
});
`,
      variables: [
        { name: 'symbolName', type: 'string', required: true, description: 'Function name' },
        { name: 'edgeCases', type: 'array', required: false, description: 'Edge cases list' },
        { name: 'parameters', type: 'array', required: false, description: 'Parameters list' },
        { name: 'assertions', type: 'string', required: false, defaultValue: 'expect(result).toBeDefined();', description: 'Assertion code' },
      ],
      description: 'Edge case test template',
    });
  }

  /**
   * 注册模板
   */
  registerTemplate(template: TestTemplate): void {
    const key = `${template.language}-${template.framework}-${template.name}`;
    this.templates.set(key, template);
  }

  /**
   * 获取模板
   */
  getTemplate(
    language: ProgrammingLanguage,
    framework: TestFramework,
    templateName: string
  ): TestTemplate | undefined {
    const key = `${language}-${framework}-${templateName}`;
    return this.templates.get(key);
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): TestTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 根据语言获取推荐框架
   */
  getRecommendedFramework(language: ProgrammingLanguage): TestFramework {
    switch (language) {
      case 'typescript':
        return 'jest';
      case 'javascript':
        return 'jest';
      case 'python':
        return 'pytest';
      case 'go':
        return 'go-testing';
      case 'java':
        return 'junit5';
      default:
        return 'jest';
    }
  }

  /**
   * 根据符号类型获取模板名称
   */
  getTemplateNameForSymbol(symbolType: string): string {
    switch (symbolType) {
      case 'function':
        return 'unit-function';
      case 'class':
        return 'unit-class';
      case 'method':
        return 'unit-function';
      default:
        return 'unit-function';
    }
  }

  /**
   * 渲染模板
   *
   * 使用简单模板语法：
   * - {{variable}} - 变量替换
   * - {{#array}}...{{/array}} - 数组迭代
   */
  renderTemplate(
    template: TestTemplate,
    context: TemplateContext
  ): string {
    let result = template.template;

    // 替换简单变量
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string' || typeof value === 'number') {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }
    }

    // 处理数组迭代
    result = this.processArrayIterations(result, context);

    // 清理未替换的变量
    result = this.cleanupUnusedVariables(result);

    return result;
  }

  /**
   * 处理数组迭代
   */
  private processArrayIterations(template: string, context: TemplateContext): string {
    let result = template;

    // 匹配 {{#array}}...{{/array}} 模式
    const arrayPattern = /{{#(\w+)}}([\s\S]*?){{\/(\w+)}}/g;

    let match;
    while ((match = arrayPattern.exec(result)) !== null) {
      const arrayName = match[1];
      const blockContent = match[2];
      const closingTag = match[3];

      if (arrayName !== closingTag) {
        continue; // 标签不匹配，跳过
      }

      const arrayValue = context[arrayName];

      if (Array.isArray(arrayValue) && arrayValue.length > 0) {
        // 渲染数组项
        const renderedBlocks = arrayValue.map((item, index) => {
          let block = blockContent;

          if (typeof item === 'object') {
            // 对象数组：替换对象属性
            for (const [key, value] of Object.entries(item)) {
              block = block.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
            }
          } else {
            // 简单数组：替换 {{this}}
            block = block.replace(/{{this}}/g, String(item));
          }

          // 处理索引
          block = block.replace(/{{index}}/g, String(index));

          return block;
        });

        result = result.replace(match[0], renderedBlocks.join('\n'));
      } else {
        // 空数组或非数组：移除整个块
        result = result.replace(match[0], '');
      }

      // 重置正则索引
      arrayPattern.lastIndex = 0;
    }

    return result;
  }

  /**
   * 清理未替换的变量
   */
  private cleanupUnusedVariables(template: string): string {
    // 移除未替换的简单变量 {{xxx}}
    let result = template.replace(/{{(\w+)}}/g, '');

    // 移除未替换的数组块 {{#xxx}}...{{/xxx}}
    result = result.replace(/{{#(\w+)}}[\s\S]*?{{\/(\w+)}}/g, '');

    return result.trim();
  }

  /**
   * 生成测试代码
   *
   * 根据符号信息自动选择模板并渲染。
   */
  generateTestCode(
    symbol: ChangedSymbol,
    filePath: string,
    framework?: TestFramework
  ): string {
    const language = ChangeAnalyzer.detectLanguage(filePath) || 'typescript';
    const selectedFramework = framework || this.getRecommendedFramework(language);

    const templateName = this.getTemplateNameForSymbol(symbol.type);
    const fullTemplateName = templateName.replace('unit-', '');

    const template = this.getTemplate(language, selectedFramework, `${selectedFramework}-${fullTemplateName}`);

    if (!template) {
      // 如果找不到模板，使用通用模板
      const fallbackTemplate = this.getTemplate(language, selectedFramework, `jest-${fullTemplateName}`);
      if (!fallbackTemplate) {
        return this.generateBasicTest(symbol, filePath, selectedFramework);
      }
      return this.renderTemplate(fallbackTemplate, this.buildContext(symbol, filePath));
    }

    return this.renderTemplate(template, this.buildContext(symbol, filePath));
  }

  /**
   * 构建模板上下文
   */
  private buildContext(symbol: ChangedSymbol, filePath: string): TemplateContext {
    // 计算导入路径
    const importPath = this.calculateImportPath(filePath);

    // 生成 Mock 设置
    const mockSetup = this.generateMockSetup(symbol);

    // 生成断言
    const assertions = this.generateAssertions(symbol);

    return {
      symbolName: symbol.name,
      symbolType: symbol.type,
      parameters: symbol.parameters || [],
      returnType: symbol.returnType,
      filePath,
      importPath,
      mockSetup,
      assertions,
      methods: [], // TODO: 从类中提取方法列表
      packageName: this.extractPackageName(filePath, symbol),
    };
  }

  /**
   * 计算导入路径
   */
  private calculateImportPath(filePath: string): string {
    // 移除 src/ 前缀和文件扩展名
    let importPath = filePath
      .replace(/^src\//, '')
      .replace(/^lib\//, '')
      .replace(/^app\//, '')
      .replace(/\.(ts|tsx|js|jsx|py|go|java)$/, '');

    // 转换为相对导入路径
    if (!importPath.startsWith('.')) {
      importPath = './' + importPath;
    }

    return importPath;
  }

  /**
   * 提取包名（用于 Go/Java）
   */
  private extractPackageName(filePath: string, symbol: ChangedSymbol): string {
    // Go: 从目录名提取
    if (filePath.endsWith('.go')) {
      const parts = filePath.split('/');
      if (parts.length > 1) {
        return parts[parts.length - 2] || 'main';
      }
      return 'main';
    }

    // Java: 从文件路径提取包名
    if (filePath.endsWith('.java')) {
      // 假设路径格式: src/main/java/com/example/Class.java
      const javaPath = filePath.replace('src/main/java/', '').replace('src/java/', '');
      const parts = javaPath.split('/');
      if (parts.length > 1) {
        return parts.slice(0, -1).join('.');
      }
      return 'com.example';
    }

    return '';
  }

  /**
   * 生成 Mock 设置
   */
  private generateMockSetup(symbol: ChangedSymbol): string {
    const setupLines: string[] = [];

    // 如果函数有依赖，生成 Mock
    if (symbol.parameters && symbol.parameters.length > 0) {
      for (const param of symbol.parameters) {
        if (param.type && !this.isPrimitiveType(param.type)) {
          setupLines.push(`// Mock ${param.type}`);
          setupLines.push(`const mock${param.type} = {`);
          setupLines.push(`  // Mock implementation`);
          setupLines.push(`};`);
        }
      }
    }

    return setupLines.join('\n');
  }

  /**
   * 生成断言
   */
  private generateAssertions(symbol: ChangedSymbol): string {
    const assertions: string[] = [];

    if (symbol.returnType) {
      if (this.isPrimitiveType(symbol.returnType)) {
        assertions.push(`expect(typeof result).toBe('${symbol.returnType}');`);
      } else {
        assertions.push(`expect(result).toBeDefined();`);
        assertions.push(`expect(result).toBeInstanceOf(${symbol.returnType});`);
      }
    } else {
      assertions.push(`expect(result).toBeDefined();`);
    }

    return assertions.join('\n    ');
  }

  /**
   * 检查是否为原始类型
   */
  private isPrimitiveType(type: string): boolean {
    const primitives = [
      'string', 'number', 'boolean', 'null', 'undefined',
      'int', 'float', 'double', 'long', 'short', 'byte',
      'void', 'any', 'unknown', 'object',
    ];
    return primitives.includes(type.toLowerCase());
  }

  /**
   * 生成基础测试（当模板不可用时）
   */
  private generateBasicTest(
    symbol: ChangedSymbol,
    filePath: string,
    framework: TestFramework
  ): string {
    const importPath = this.calculateImportPath(filePath);

    switch (framework) {
      case 'jest':
      case 'vitest':
        return `import { ${symbol.name} } from '${importPath}';

describe('${symbol.name}', () => {
  it('should work correctly', () => {
    const result = ${symbol.name}();
    expect(result).toBeDefined();
  });
});
`;

      case 'pytest':
        return `import pytest
from ${importPath.replace('./', '').replace('/', '.')} import ${symbol.name}

def test_${symbol.name.toLowerCase()}():
    result = ${symbol.name}()
    assert result is not None
`;

      case 'go-testing':
        return `package main

import "testing"

func Test${symbol.name}(t *testing.T) {
    result := ${symbol.name}()
    if result == nil {
        t.Error("Expected non-nil result")
    }
}
`;

      case 'junit5':
      case 'junit4':
        return `import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ${symbol.name}Test {
    @Test
    void test${symbol.name}() {
        var result = new ${symbol.name}();
        assertNotNull(result);
    }
}
`;

      default:
        return `// Test for ${symbol.name}\n// TODO: Add test implementation`;
    }
  }
}

// 导入 ChangeAnalyzer 用于语言检测
import { ChangeAnalyzer } from './ChangeAnalyzer';