/**
 * ASTValidator - Comprehensive Tests
 *
 * Tests for code syntax validation across TypeScript, JavaScript,
 * Python, and Go languages.
 */

import { ASTValidator } from '../ASTValidator';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('pino', () => () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ASTValidator', () => {
  let validator: ASTValidator;

  beforeEach(() => {
    validator = new ASTValidator();
  });

  // ─── General ──────────────────────────────────────────────────────────────

  describe('general validation', () => {
    it('should reject empty code', () => {
      const result = validator.validate('', 'typescript');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Empty code content');
    });

    it('should reject whitespace-only code', () => {
      const result = validator.validate('   \n\t  ', 'typescript');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Empty code content');
    });
  });

  // ─── TypeScript/JavaScript ────────────────────────────────────────────────

  describe('typescript validation', () => {
    it('should pass for valid TypeScript', () => {
      const code = `const x: number = 1;\nfunction add(a: number, b: number): number {\n  return a + b;\n}`;
      const result = validator.validate(code, 'typescript');
      expect(result.valid).toBe(true);
    });

    it('should detect unmatched braces', () => {
      const code = 'function foo() { return 1;';
      const result = validator.validate(code, 'typescript');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unmatched braces');
    });

    it('should detect unmatched parentheses', () => {
      const code = 'const x = (1 + 2;';
      const result = validator.validate(code, 'typescript');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unmatched parentheses');
    });

    it('should detect unmatched brackets', () => {
      const code = 'const arr = [1, 2, 3;';
      const result = validator.validate(code, 'typescript');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unmatched brackets');
    });

    it('should detect unmatched template literals', () => {
      const code = 'const x = `hello ${name};';
      const result = validator.validate(code, 'typescript');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unmatched template literal');
    });

    it('should pass for matched template literals', () => {
      const code = 'const x = `hello ${name}`;';
      const result = validator.validate(code, 'typescript');
      expect(result.valid).toBe(true);
    });

    it('should detect missing operand after operator', () => {
      const code = 'const x = 1 + }';
      const result = validator.validate(code, 'typescript');
      expect(result.valid).toBe(false);
    });

    it('should pass for valid class definition', () => {
      const code = `class MyClass {\n  constructor() {}\n  method(): void {}\n}`;
      const result = validator.validate(code, 'typescript');
      expect(result.valid).toBe(true);
    });

    it('should pass for valid interface definition', () => {
      const code = `interface MyInterface {\n  name: string;\n  age: number;\n}`;
      const result = validator.validate(code, 'typescript');
      expect(result.valid).toBe(true);
    });

    it('should handle nested structures', () => {
      const code = `const obj = { a: [1, 2], b: { c: 3 } };`;
      const result = validator.validate(code, 'typescript');
      expect(result.valid).toBe(true);
    });
  });

  describe('javascript validation', () => {
    it('should pass for valid JavaScript', () => {
      const code = 'const x = 1;\nfunction add(a, b) {\n  return a + b;\n}';
      const result = validator.validate(code, 'javascript');
      expect(result.valid).toBe(true);
    });

    it('should detect syntax errors in JavaScript', () => {
      const code = 'function foo() {';
      const result = validator.validate(code, 'javascript');
      expect(result.valid).toBe(false);
    });
  });

  // ─── Python ───────────────────────────────────────────────────────────────

  describe('python validation', () => {
    it('should pass for valid Python', () => {
      const code = `def add(a, b):\n    return a + b`;
      const result = validator.validate(code, 'python');
      expect(result.valid).toBe(true);
    });

    it('should detect unmatched parentheses in Python', () => {
      const code = 'x = (1 + 2';
      const result = validator.validate(code, 'python');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unmatched parentheses');
    });

    it('should detect unmatched brackets in Python', () => {
      const code = 'x = [1, 2, 3';
      const result = validator.validate(code, 'python');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unmatched brackets');
    });

    it('should detect missing colon after def', () => {
      const code = 'def add(a, b)\n    return a + b';
      const result = validator.validate(code, 'python');
      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.includes('Missing colon'))).toBe(true);
    });

    it('should detect missing colon after class', () => {
      const code = 'class MyClass\n    pass';
      const result = validator.validate(code, 'python');
      expect(result.valid).toBe(false);
    });

    it('should detect missing colon after if', () => {
      const code = 'if True\n    pass';
      const result = validator.validate(code, 'python');
      expect(result.valid).toBe(false);
    });

    it('should detect missing colon after for', () => {
      const code = 'for i in range(10)\n    print(i)';
      const result = validator.validate(code, 'python');
      expect(result.valid).toBe(false);
    });

    it('should detect missing colon after while', () => {
      const code = 'while True\n    break';
      const result = validator.validate(code, 'python');
      expect(result.valid).toBe(false);
    });

    it('should pass for valid class with colon', () => {
      const code = 'class MyClass:\n    pass';
      const result = validator.validate(code, 'python');
      expect(result.valid).toBe(true);
    });

    it('should pass for valid if/else', () => {
      const code = 'if x > 0:\n    print("positive")\nelse:\n    print("negative")';
      const result = validator.validate(code, 'python');
      expect(result.valid).toBe(true);
    });

    it('should handle nested functions', () => {
      const code = 'def outer():\n    def inner():\n        pass\n    return inner';
      const result = validator.validate(code, 'python');
      expect(result.valid).toBe(true);
    });
  });

  // ─── Go ───────────────────────────────────────────────────────────────────

  describe('go validation', () => {
    it('should pass for valid Go', () => {
      const code = `package main\n\nfunc main() {\n\tfmt.Println("hello")\n}`;
      const result = validator.validate(code, 'go');
      expect(result.valid).toBe(true);
    });

    it('should detect unmatched braces in Go', () => {
      const code = 'package main\n\nfunc main() {';
      const result = validator.validate(code, 'go');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unmatched braces');
    });

    it('should detect unmatched parentheses in Go', () => {
      const code = 'package main\n\nfunc main( {';
      const result = validator.validate(code, 'go');
      expect(result.valid).toBe(false);
    });

    it('should detect unmatched brackets in Go', () => {
      const code = 'package main\n\nvar x = [int{1, 2}';
      const result = validator.validate(code, 'go');
      expect(result.valid).toBe(false);
    });

    it('should pass for valid Go struct', () => {
      const code = 'type MyStruct struct {\n\tName string\n\tAge  int\n}';
      const result = validator.validate(code, 'go');
      expect(result.valid).toBe(true);
    });
  });

  // ─── Heuristic validation ─────────────────────────────────────────────────

  describe('heuristic validation', () => {
    it('should validate bracket matching for unknown language', () => {
      const code = 'fn main() { println!("hello"); }';
      const result = validator.validate(code, 'rust' as any);
      expect(result.valid).toBe(true);
    });

    it('should detect unmatched brackets for unknown language', () => {
      const code = 'fn main() {';
      const result = validator.validate(code, 'rust' as any);
      expect(result.valid).toBe(false);
    });
  });
});
