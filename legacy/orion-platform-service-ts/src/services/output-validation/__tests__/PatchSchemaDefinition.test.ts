/**
 * PatchSchemaDefinition Tests
 *
 * 覆盖: PATCH_SCHEMA 和 SECURITY_BOUNDARY_SCHEMA 的结构验证
 * 确保 schema 常量格式正确、包含必要字段
 */

import { PATCH_SCHEMA, SECURITY_BOUNDARY_SCHEMA } from '../PatchSchemaDefinition';

describe('PATCH_SCHEMA', () => {
  it('should be a valid JSON Schema object', () => {
    expect(PATCH_SCHEMA).toBeDefined();
    expect(typeof PATCH_SCHEMA).toBe('object');
    expect(PATCH_SCHEMA.$schema).toBe('http://json-schema.org/draft-07/schema#');
  });

  it('should have correct title and type', () => {
    expect(PATCH_SCHEMA.title).toBe('LLM Patch Output Schema');
    expect(PATCH_SCHEMA.type).toBe('object');
  });

  it('should require all mandatory fields', () => {
    expect(PATCH_SCHEMA.required).toEqual(['patch_id', 'target_files', 'changes', 'metadata']);
  });

  it('should define patch_id with correct pattern', () => {
    const patchId = PATCH_SCHEMA.properties.patch_id;
    expect(patchId).toBeDefined();
    expect(patchId.type).toBe('string');
    expect(patchId.pattern).toBe('^patch_[a-z0-9]{16}$');
  });

  it('should define target_files as array with constraints', () => {
    const targetFiles = PATCH_SCHEMA.properties.target_files;
    expect(targetFiles.type).toBe('array');
    expect(targetFiles.minItems).toBe(1);
    expect(targetFiles.maxItems).toBe(10);
    expect(targetFiles.items.required).toEqual(['path', 'operation']);
  });

  it('should define target_files path with allowed extensions', () => {
    const pathSchema = PATCH_SCHEMA.properties.target_files.items.properties.path;
    expect(pathSchema.type).toBe('string');
    // Pattern uses escaped dots: \\.(ts|js|py|go|java)
    expect(pathSchema.pattern).toContain('ts');
    expect(pathSchema.pattern).toContain('js');
    expect(pathSchema.pattern).toContain('py');
    expect(pathSchema.pattern).toContain('go');
    expect(pathSchema.pattern).toContain('java');
  });

  it('should define target_files operation enum', () => {
    const operationSchema = PATCH_SCHEMA.properties.target_files.items.properties.operation;
    expect(operationSchema.type).toBe('string');
    expect(operationSchema.enum).toEqual(['create', 'modify', 'delete']);
  });

  it('should define changes array with required fields', () => {
    const changes = PATCH_SCHEMA.properties.changes;
    expect(changes.type).toBe('array');
    expect(changes.items.required).toEqual(['file_path', 'change_type', 'content']);
  });

  it('should define change_type enum', () => {
    const changeType = PATCH_SCHEMA.properties.changes.items.properties.change_type;
    expect(changeType.enum).toEqual(['insertion', 'deletion', 'replacement']);
  });

  it('should define content maxLength', () => {
    const content = PATCH_SCHEMA.properties.changes.items.properties.content;
    expect(content.maxLength).toBe(10000);
  });

  it('should define metadata with required fields', () => {
    const metadata = PATCH_SCHEMA.properties.metadata;
    expect(metadata.type).toBe('object');
    expect(metadata.required).toEqual(['generated_by', 'timestamp']);
  });

  it('should define metadata.generated_by enum', () => {
    const generatedBy = PATCH_SCHEMA.properties.metadata.properties.generated_by;
    expect(generatedBy.enum).toEqual(['llm_autofix', 'llm_code_review', 'llm_refactor']);
  });

  it('should define metadata.timestamp format', () => {
    const timestamp = PATCH_SCHEMA.properties.metadata.properties.timestamp;
    expect(timestamp.type).toBe('string');
    expect(timestamp.format).toBe('date-time');
  });

  it('should define metadata.confidence range', () => {
    const confidence = PATCH_SCHEMA.properties.metadata.properties.confidence;
    expect(confidence.type).toBe('number');
    expect(confidence.minimum).toBe(0);
    expect(confidence.maximum).toBe(1);
  });

  it('should define metadata.rationale maxLength', () => {
    const rationale = PATCH_SCHEMA.properties.metadata.properties.rationale;
    expect(rationale.maxLength).toBe(500);
  });
});

describe('SECURITY_BOUNDARY_SCHEMA', () => {
  it('should be a valid JSON Schema object', () => {
    expect(SECURITY_BOUNDARY_SCHEMA).toBeDefined();
    expect(typeof SECURITY_BOUNDARY_SCHEMA).toBe('object');
    expect(SECURITY_BOUNDARY_SCHEMA.$schema).toBe('http://json-schema.org/draft-07/schema#');
  });

  it('should have correct title and type', () => {
    expect(SECURITY_BOUNDARY_SCHEMA.title).toBe('Patch Security Boundary');
    expect(SECURITY_BOUNDARY_SCHEMA.type).toBe('object');
  });

  it('should require allowed_paths and disallowed_patterns', () => {
    expect(SECURITY_BOUNDARY_SCHEMA.required).toEqual(['allowed_paths', 'disallowed_patterns']);
  });

  it('should define allowed_paths as array of strings', () => {
    const allowedPaths = SECURITY_BOUNDARY_SCHEMA.properties.allowed_paths;
    expect(allowedPaths.type).toBe('array');
    expect(allowedPaths.items.type).toBe('string');
  });

  it('should have sensible default allowed_paths', () => {
    const allowedPaths = SECURITY_BOUNDARY_SCHEMA.properties.allowed_paths;
    expect(allowedPaths.default).toBeDefined();
    expect(allowedPaths.default).toContain('src/**/*.ts');
    expect(allowedPaths.default).toContain('src/**/*.js');
    expect(allowedPaths.default).toContain('lib/**/*.py');
    expect(allowedPaths.default).toContain('app/**/*.go');
  });

  it('should define disallowed_patterns as array of strings', () => {
    const disallowedPatterns = SECURITY_BOUNDARY_SCHEMA.properties.disallowed_patterns;
    expect(disallowedPatterns.type).toBe('array');
    expect(disallowedPatterns.items.type).toBe('string');
  });

  it('should have sensible default disallowed_patterns', () => {
    const disallowedPatterns = SECURITY_BOUNDARY_SCHEMA.properties.disallowed_patterns;
    expect(disallowedPatterns.default).toBeDefined();
    expect(disallowedPatterns.default).toContain('**/.env*');
    expect(disallowedPatterns.default).toContain('**/credentials*');
    expect(disallowedPatterns.default).toContain('**/secrets*');
    expect(disallowedPatterns.default).toContain('**/*.pem');
    expect(disallowedPatterns.default).toContain('**/*.key');
  });

  it('should define max_file_size with default', () => {
    const maxFileSize = SECURITY_BOUNDARY_SCHEMA.properties.max_file_size;
    expect(maxFileSize.type).toBe('integer');
    expect(maxFileSize.default).toBe(100000);
  });

  it('should define max_changes_per_patch with default', () => {
    const maxChanges = SECURITY_BOUNDARY_SCHEMA.properties.max_changes_per_patch;
    expect(maxChanges.type).toBe('integer');
    expect(maxChanges.default).toBe(10);
  });
});
