// orion-platform-service/src/services/output-validation/OutputValidatorService.ts
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { PATCH_SCHEMA, SECURITY_BOUNDARY_SCHEMA } from './PatchSchemaDefinition';
import { ASTValidator } from './ASTValidator';
import { SecurityBoundaryValidator } from './SecurityBoundaryValidator';
import { createLogger } from '../../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('OutputValidatorService');

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  violations?: string[];
  warnings?: string[];
}

export interface FullValidationResult {
  schemaValid: boolean;
  astValid: boolean;
  securityValid: boolean;
  overallValid: boolean;
  errors: Record<string, string[]>;
  warnings: Record<string, string[]>;
}

export interface PatchInput {
  patch_id: string;
  target_files: Array<{
    path: string;
    operation: 'create' | 'modify' | 'delete';
    lines?: {
      start: number;
      end: number;
    };
  }>;
  changes: Array<{
    file_path: string;
    change_type: 'insertion' | 'deletion' | 'replacement';
    content: string;
    original_content?: string;
  }>;
  metadata: {
    generated_by: 'llm_autofix' | 'llm_code_review' | 'llm_refactor';
    timestamp: string;
    confidence?: number;
    rationale?: string;
  };
}

export class OutputValidatorService {
  private ajv: Ajv;
  private astValidator: ASTValidator;
  private securityValidator: SecurityBoundaryValidator;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv); // Add support for date-time and other formats
    this.astValidator = new ASTValidator();
    this.securityValidator = new SecurityBoundaryValidator();
  }

  /**
   * Validates the patch against JSON schema
   */
  validateSchema(patch: unknown): ValidationResult {
    try {
      const validate = this.ajv.compile(PATCH_SCHEMA);
      const valid = validate(patch);

      if (!valid) {
        const errors = validate.errors?.map(e => `${e.instancePath || 'root'}: ${e.message}`) || [];
        logger.warn({ errors, traceId: getCurrentTraceId() }, '[OutputValidator] Schema validation failed');
        return { valid: false, errors };
      }

      return { valid: true };
    } catch (error) {
      const message = (error as Error).message;
      logger.error({ err: error, traceId: getCurrentTraceId() }, '[OutputValidator] Schema validation error');
      return { valid: false, errors: [message] };
    }
  }

  /**
   * Validates code syntax using AST
   */
  validateAST(code: string, language: 'typescript' | 'javascript' | 'python' | 'go'): ValidationResult {
    return this.astValidator.validate(code, language);
  }

  /**
   * Validates security boundaries
   */
  validateSecurityBoundary(patch: { target_files: Array<{ path: string }> }): ValidationResult {
    const result = this.securityValidator.validate(patch);
    return {
      valid: result.valid,
      violations: result.violations,
      warnings: result.warnings,
    };
  }

  /**
   * Validates content for sensitive data
   */
  validateContent(content: string): ValidationResult {
    const result = this.securityValidator.validateContent(content);
    return {
      valid: result.valid,
      violations: result.violations,
      warnings: result.warnings,
    };
  }

  /**
   * Runs all validation layers
   */
  async validateFull(patch: unknown): Promise<FullValidationResult> {
    const result: FullValidationResult = {
      schemaValid: false,
      astValid: false,
      securityValid: false,
      overallValid: false,
      errors: {},
      warnings: {},
    };

    // Layer 1: Schema validation
    const schemaResult = this.validateSchema(patch);
    result.schemaValid = schemaResult.valid;
    if (!schemaResult.valid) {
      result.errors['schema'] = schemaResult.errors || [];
    }
    if (schemaResult.warnings) {
      result.warnings['schema'] = schemaResult.warnings;
    }

    // Early return if schema is invalid
    if (!result.schemaValid) {
      logger.warn('[OutputValidator] Schema validation failed, skipping further validation');
      result.overallValid = false;
      return result;
    }

    // Type guard for valid patch
    const p = patch as PatchInput;

    // Layer 2: Security boundary
    const securityResult = this.securityValidator.validate({ target_files: p.target_files });
    result.securityValid = securityResult.valid;
    if (!securityResult.valid) {
      result.errors['security'] = securityResult.violations;
    }
    if (securityResult.warnings && securityResult.warnings.length > 0) {
      result.warnings['security'] = securityResult.warnings;
    }

    // Early return if security boundary is violated
    if (!result.securityValid) {
      logger.warn('[OutputValidator] Security boundary violation detected');
      result.overallValid = false;
      return result;
    }

    // Layer 3: AST validation for each change
    const astErrors: string[] = [];
    const astWarnings: string[] = [];

    for (const change of p.changes || []) {
      if (change.content) {
        // Determine language from file extension
        const ext = change.file_path?.split('.').pop()?.toLowerCase() || 'ts';
        let lang: 'typescript' | 'javascript' | 'python' | 'go';

        switch (ext) {
          case 'ts':
          case 'tsx':
            lang = 'typescript';
            break;
          case 'js':
          case 'jsx':
            lang = 'javascript';
            break;
          case 'py':
            lang = 'python';
            break;
          case 'go':
            lang = 'go';
            break;
          default:
            lang = 'typescript';
        }

        const astResult = this.astValidator.validate(change.content, lang);
        if (!astResult.valid) {
          astErrors.push(`File ${change.file_path}: ${astResult.errors?.join(', ')}`);
        }
      }

      // Check content for sensitive data
      const contentResult = this.securityValidator.validateContent(change.content);
      if (!contentResult.valid) {
        astErrors.push(...(contentResult.violations || []));
      }
      if (contentResult.warnings && contentResult.warnings.length > 0) {
        astWarnings.push(...contentResult.warnings);
      }
    }

    result.astValid = astErrors.length === 0;
    if (!result.astValid) {
      result.errors['ast'] = astErrors;
    }
    if (astWarnings.length > 0) {
      result.warnings['ast'] = astWarnings;
    }

    // Calculate overall result
    result.overallValid = result.schemaValid && result.astValid && result.securityValid;

    logger.info({ overallValid: result.overallValid, traceId: getCurrentTraceId() }, '[OutputValidator] Full validation completed');

    return result;
  }

  /**
   * Quick validation for schema and security only (no AST)
   */
  quickValidate(patch: unknown): ValidationResult {
    const errors: string[] = [];
    const violations: string[] = [];

    // Schema validation
    const schemaResult = this.validateSchema(patch);
    if (!schemaResult.valid) {
      errors.push(...(schemaResult.errors || []));
    }

    // Security boundary
    if (schemaResult.valid) {
      const p = patch as PatchInput;
      const securityResult = this.validateSecurityBoundary({ target_files: p.target_files });
      if (!securityResult.valid) {
        violations.push(...(securityResult.violations || []));
      }
    }

    return {
      valid: errors.length === 0 && violations.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      violations: violations.length > 0 ? violations : undefined,
    };
  }
}