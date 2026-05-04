// orion-platform-service/src/services/output-validation/__tests__/OutputValidator.test.ts
import { OutputValidatorService } from '../OutputValidatorService';
import { ASTValidator } from '../ASTValidator';
import { SecurityBoundaryValidator } from '../SecurityBoundaryValidator';

describe('OutputValidatorService', () => {
  let validator: OutputValidatorService;

  beforeEach(() => {
    validator = new OutputValidatorService();
  });

  describe('validateSchema', () => {
    it('should pass valid patch output', () => {
      const patch = {
        patch_id: 'patch_1234567890abcdef',
        target_files: [{ path: 'src/services/test.ts', operation: 'modify' }],
        changes: [{ file_path: 'src/services/test.ts', change_type: 'replacement', content: 'const x = 1;' }],
        metadata: { generated_by: 'llm_autofix', timestamp: new Date().toISOString() }
      };

      const result = validator.validateSchema(patch);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid patch_id format', () => {
      const patch = {
        patch_id: 'invalid_id',
        target_files: [{ path: 'src/test.ts', operation: 'modify' }],
        changes: [],
        metadata: { generated_by: 'llm_autofix', timestamp: new Date().toISOString() }
      };

      const result = validator.validateSchema(patch);
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('patch_id'))).toBe(true);
    });

    it('should reject missing required fields', () => {
      const patch = {
        patch_id: 'patch_1234567890abcdef',
        // missing target_files
        changes: [{ file_path: 'src/test.ts', change_type: 'insertion', content: 'const x = 1;' }],
        metadata: { generated_by: 'llm_autofix', timestamp: new Date().toISOString() }
      };

      const result = validator.validateSchema(patch);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid file extension', () => {
      const patch = {
        patch_id: 'patch_1234567890abcdef',
        target_files: [{ path: 'src/test.txt', operation: 'modify' }],
        changes: [{ file_path: 'src/test.txt', change_type: 'insertion', content: 'hello' }],
        metadata: { generated_by: 'llm_autofix', timestamp: new Date().toISOString() }
      };

      const result = validator.validateSchema(patch);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid generated_by value', () => {
      const patch = {
        patch_id: 'patch_1234567890abcdef',
        target_files: [{ path: 'src/test.ts', operation: 'modify' }],
        changes: [{ file_path: 'src/test.ts', change_type: 'insertion', content: 'const x = 1;' }],
        metadata: { generated_by: 'invalid_source', timestamp: new Date().toISOString() }
      };

      const result = validator.validateSchema(patch);
      expect(result.valid).toBe(false);
    });

    it('should reject content exceeding maxLength', () => {
      const longContent = 'x'.repeat(10001);
      const patch = {
        patch_id: 'patch_1234567890abcdef',
        target_files: [{ path: 'src/test.ts', operation: 'modify' }],
        changes: [{ file_path: 'src/test.ts', change_type: 'insertion', content: longContent }],
        metadata: { generated_by: 'llm_autofix', timestamp: new Date().toISOString() }
      };

      const result = validator.validateSchema(patch);
      expect(result.valid).toBe(false);
    });

    it('should reject too many target files', () => {
      const patch = {
        patch_id: 'patch_1234567890abcdef',
        target_files: Array(11).fill({ path: 'src/test.ts', operation: 'modify' }),
        changes: [],
        metadata: { generated_by: 'llm_autofix', timestamp: new Date().toISOString() }
      };

      const result = validator.validateSchema(patch);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateAST', () => {
    it('should pass syntactically correct TypeScript code', () => {
      const code = 'function add(a: number, b: number) { return a + b; }';
      const result = validator.validateAST(code, 'typescript');
      expect(result.valid).toBe(true);
    });

    it('should pass syntactically correct JavaScript code', () => {
      const code = 'function add(a, b) { return a + b; }';
      const result = validator.validateAST(code, 'javascript');
      expect(result.valid).toBe(true);
    });

    it('should reject code with unmatched braces', () => {
      const code = 'function add(a, b) { return a + b; }}';
      const result = validator.validateAST(code, 'typescript');
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('braces'))).toBe(true);
    });

    it('should reject code with unmatched parentheses', () => {
      const code = 'function add(a, b)) { return a + b; }';
      const result = validator.validateAST(code, 'typescript');
      expect(result.valid).toBe(false);
    });

    it('should reject code with missing operand', () => {
      const code = 'function add(a, b) { return a +  }';
      const result = validator.validateAST(code, 'typescript');
      expect(result.valid).toBe(false);
    });

    it('should pass Python code with correct syntax', () => {
      const code = 'def add(a, b):\n    return a + b';
      const result = validator.validateAST(code, 'python');
      expect(result.valid).toBe(true);
    });

    it('should reject Python code with missing colon', () => {
      const code = 'def add(a, b)\n    return a + b';
      const result = validator.validateAST(code, 'python');
      expect(result.valid).toBe(false);
    });

    it('should pass Go code with correct syntax', () => {
      const code = 'func add(a int, b int) int { return a + b }';
      const result = validator.validateAST(code, 'go');
      expect(result.valid).toBe(true);
    });

    it('should reject Go code with unmatched braces', () => {
      const code = 'func add(a int, b int) int { return a + b }}';
      const result = validator.validateAST(code, 'go');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateSecurityBoundary', () => {
    it('should reject patches targeting .env files', () => {
      const patch = {
        target_files: [{ path: '.env.production', operation: 'modify' }]
      };

      const result = validator.validateSecurityBoundary(patch);
      expect(result.valid).toBe(false);
      expect(result.violations?.some(v => v.includes('.env'))).toBe(true);
    });

    it('should reject patches targeting credentials files', () => {
      const patch = {
        target_files: [{ path: 'config/credentials.json', operation: 'modify' }]
      };

      const result = validator.validateSecurityBoundary(patch);
      expect(result.valid).toBe(false);
      expect(result.violations?.some(v => v.includes('credentials'))).toBe(true);
    });

    it('should reject patches targeting .pem files', () => {
      const patch = {
        target_files: [{ path: 'certs/server.pem', operation: 'modify' }]
      };

      const result = validator.validateSecurityBoundary(patch);
      expect(result.valid).toBe(false);
    });

    it('should reject patches targeting .key files', () => {
      const patch = {
        target_files: [{ path: 'secrets/private.key', operation: 'modify' }]
      };

      const result = validator.validateSecurityBoundary(patch);
      expect(result.valid).toBe(false);
    });

    it('should accept patches targeting source files', () => {
      const patch = {
        target_files: [{ path: 'src/services/auth.ts', operation: 'modify' }]
      };

      const result = validator.validateSecurityBoundary(patch);
      expect(result.valid).toBe(true);
    });

    it('should reject absolute paths', () => {
      const patch = {
        target_files: [{ path: '/etc/passwd', operation: 'modify' }]
      };

      const result = validator.validateSecurityBoundary(patch);
      expect(result.valid).toBe(false);
      expect(result.violations?.some(v => v.includes('Absolute'))).toBe(true);
    });

    it('should reject path traversal attempts', () => {
      const patch = {
        target_files: [{ path: '../../../etc/passwd', operation: 'modify' }]
      };

      const result = validator.validateSecurityBoundary(patch);
      expect(result.valid).toBe(false);
      expect(result.violations?.some(v => v.includes('traversal'))).toBe(true);
    });

    it('should warn on sensitive keywords in path', () => {
      const patch = {
        target_files: [{ path: 'src/utils/secret-helper.ts', operation: 'modify' }]
      };

      const result = validator.validateSecurityBoundary(patch);
      expect(result.warnings?.some(w => w.includes('sensitive'))).toBe(true);
    });
  });

  describe('validateFull', () => {
    it('should run all validation layers and pass', async () => {
      const patch = {
        patch_id: 'patch_valid12345678abc',
        target_files: [{ path: 'src/test.ts', operation: 'modify' }],
        changes: [{ file_path: 'src/test.ts', change_type: 'insertion', content: 'const x = 1;' }],
        metadata: { generated_by: 'llm_autofix', timestamp: new Date().toISOString() }
      };

      const result = await validator.validateFull(patch);
      expect(result.schemaValid).toBe(true);
      expect(result.astValid).toBe(true);
      expect(result.securityValid).toBe(true);
      expect(result.overallValid).toBe(true);
    });

    it('should fail on schema validation first', async () => {
      const patch = {
        patch_id: 'invalid',
        target_files: [{ path: 'src/test.ts', operation: 'modify' }],
        changes: [],
        metadata: { generated_by: 'llm_autofix', timestamp: new Date().toISOString() }
      };

      const result = await validator.validateFull(patch);
      expect(result.schemaValid).toBe(false);
      expect(result.securityValid).toBe(false); // Not validated due to early return
      expect(result.astValid).toBe(false); // Not validated due to early return
      expect(result.overallValid).toBe(false);
    });

    it('should fail on security boundary violation', async () => {
      const patch = {
        patch_id: 'patch_1234567890abcdef',
        target_files: [{ path: 'config/credentials.ts', operation: 'modify' }],
        changes: [{ file_path: 'config/credentials.ts', change_type: 'insertion', content: 'const key = "value";' }],
        metadata: { generated_by: 'llm_autofix', timestamp: new Date().toISOString() }
      };

      const result = await validator.validateFull(patch);
      expect(result.schemaValid).toBe(true);
      expect(result.securityValid).toBe(false);
      expect(result.overallValid).toBe(false);
    });

    it('should fail on AST validation error', async () => {
      const patch = {
        patch_id: 'patch_1234567890abcdef',
        target_files: [{ path: 'src/test.ts', operation: 'modify' }],
        changes: [{ file_path: 'src/test.ts', change_type: 'insertion', content: 'function incomplete() { return ' }],
        metadata: { generated_by: 'llm_autofix', timestamp: new Date().toISOString() }
      };

      const result = await validator.validateFull(patch);
      expect(result.schemaValid).toBe(true);
      expect(result.securityValid).toBe(true);
      expect(result.astValid).toBe(false);
      expect(result.overallValid).toBe(false);
    });

    it('should warn on content with hardcoded secrets', async () => {
      const patch = {
        patch_id: 'patch_1234567890abcdef',
        target_files: [{ path: 'src/config.ts', operation: 'modify' }],
        changes: [{ file_path: 'src/config.ts', change_type: 'insertion', content: 'const API_KEY = "hardcoded-key-12345";' }],
        metadata: { generated_by: 'llm_autofix', timestamp: new Date().toISOString() }
      };

      const result = await validator.validateFull(patch);
      expect(result.warnings['ast']?.some(w => w.includes('API key'))).toBe(true);
    });

    it('should validate multiple changes', async () => {
      const patch = {
        patch_id: 'patch_multiplefile12ab',
        target_files: [
          { path: 'src/a.ts', operation: 'modify' },
          { path: 'src/b.ts', operation: 'modify' }
        ],
        changes: [
          { file_path: 'src/a.ts', change_type: 'insertion', content: 'export const a = 1;' },
          { file_path: 'src/b.ts', change_type: 'insertion', content: 'export const b = 2;' }
        ],
        metadata: { generated_by: 'llm_autofix', timestamp: new Date().toISOString() }
      };

      const result = await validator.validateFull(patch);
      expect(result.overallValid).toBe(true);
    });
  });

  describe('quickValidate', () => {
    it('should pass valid patch quickly', () => {
      const patch = {
        patch_id: 'patch_quicktest12345ab',
        target_files: [{ path: 'src/test.ts', operation: 'modify' }],
        changes: [],
        metadata: { generated_by: 'llm_autofix', timestamp: new Date().toISOString() }
      };

      const result = validator.quickValidate(patch);
      expect(result.valid).toBe(true);
    });

    it('should fail quickly on security violation', () => {
      const patch = {
        patch_id: 'patch_quicktest12345ab',
        target_files: [{ path: 'config/credentials.ts', operation: 'modify' }],
        changes: [],
        metadata: { generated_by: 'llm_autofix', timestamp: new Date().toISOString() }
      };

      const result = validator.quickValidate(patch);
      expect(result.valid).toBe(false);
      expect(result.violations).toBeDefined();
    });
  });
});

describe('ASTValidator', () => {
  let astValidator: ASTValidator;

  beforeEach(() => {
    astValidator = new ASTValidator();
  });

  describe('validate', () => {
    it('should validate TypeScript class declaration', () => {
      const code = 'class MyClass { private value: number; constructor(v: number) { this.value = v; } }';
      const result = astValidator.validate(code, 'typescript');
      expect(result.valid).toBe(true);
    });

    it('should validate TypeScript interface', () => {
      const code = 'interface MyInterface { name: string; age: number; }';
      const result = astValidator.validate(code, 'typescript');
      expect(result.valid).toBe(true);
    });

    it('should validate JavaScript arrow function', () => {
      const code = 'const add = (a, b) => a + b;';
      const result = astValidator.validate(code, 'javascript');
      expect(result.valid).toBe(true);
    });

    it('should validate Python function', () => {
      const code = 'def my_function(arg1, arg2):\n    result = arg1 + arg2\n    return result';
      const result = astValidator.validate(code, 'python');
      expect(result.valid).toBe(true);
    });

    it('should validate Go function', () => {
      const code = 'func myFunction(a int, b int) int {\n    return a + b\n}';
      const result = astValidator.validate(code, 'go');
      expect(result.valid).toBe(true);
    });

    it('should reject empty code', () => {
      const result = astValidator.validate('', 'typescript');
      expect(result.valid).toBe(false);
    });
  });
});

describe('SecurityBoundaryValidator', () => {
  let securityValidator: SecurityBoundaryValidator;

  beforeEach(() => {
    securityValidator = new SecurityBoundaryValidator();
  });

  describe('validate', () => {
    it('should reject SSH key files', () => {
      const result = securityValidator.validate({
        target_files: [{ path: '.ssh/id_rsa', operation: 'modify' }]
      });
      expect(result.valid).toBe(false);
    });

    it('should reject AWS config files', () => {
      const result = securityValidator.validate({
        target_files: [{ path: '.aws/credentials', operation: 'modify' }]
      });
      expect(result.valid).toBe(false);
    });

    it('should reject kubeconfig files', () => {
      const result = securityValidator.validate({
        target_files: [{ path: 'kubeconfig.yaml', operation: 'modify' }]
      });
      expect(result.valid).toBe(false);
    });

    it('should accept Python files', () => {
      const result = securityValidator.validate({
        target_files: [{ path: 'lib/utils.py', operation: 'modify' }]
      });
      expect(result.valid).toBe(true);
    });

    it('should accept Go files', () => {
      const result = securityValidator.validate({
        target_files: [{ path: 'app/main.go', operation: 'modify' }]
      });
      expect(result.valid).toBe(true);
    });

    it('should accept Java files', () => {
      const result = securityValidator.validate({
        target_files: [{ path: 'src/main/java/App.java', operation: 'modify' }]
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('validateContent', () => {
    it('should warn on hardcoded password', () => {
      const content = 'const config = { password: "mySecretPassword123" }';
      const result = securityValidator.validateContent(content);
      expect(result.warnings?.some(w => w.includes('password'))).toBe(true);
    });

    it('should warn on PEM private key', () => {
      const content = '-----BEGIN RSA PRIVATE KEY-----\nMIIE...';
      const result = securityValidator.validateContent(content);
      expect(result.warnings?.some(w => w.includes('PEM'))).toBe(true);
    });

    it('should reject content exceeding max size', () => {
      const largeContent = 'x'.repeat(100001);
      const result = securityValidator.validateContent(largeContent);
      expect(result.valid).toBe(false);
    });
  });

  describe('addDisallowedPattern', () => {
    it('should add custom disallowed pattern', () => {
      securityValidator.addDisallowedPattern('**/custom-sensitive/*');
      const result = securityValidator.validate({
        target_files: [{ path: 'custom-sensitive/data.json', operation: 'modify' }]
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('addAllowedExtension', () => {
    it('should add custom allowed extension', () => {
      securityValidator.addAllowedExtension('.graphql');
      const result = securityValidator.validate({
        target_files: [{ path: 'schema.graphql', operation: 'modify' }]
      });
      expect(result.valid).toBe(true);
    });
  });
});