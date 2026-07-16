// orion-platform-service/src/services/output-validation/index.ts
export { OutputValidatorService } from './OutputValidatorService';
export { ASTValidator } from './ASTValidator';
export { SecurityBoundaryValidator } from './SecurityBoundaryValidator';
export { PATCH_SCHEMA, SECURITY_BOUNDARY_SCHEMA } from './PatchSchemaDefinition';

export type { ValidationResult, FullValidationResult, PatchInput } from './OutputValidatorService';
export type { ASTValidationResult } from './ASTValidator';
export type { SecurityValidationResult, SecurityBoundaryConfig } from './SecurityBoundaryValidator';