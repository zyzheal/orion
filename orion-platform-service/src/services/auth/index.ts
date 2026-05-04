// orion-platform-service/src/services/auth/index.ts
/**
 * Auth Service Module - Phase 1 P0 Implementation
 *
 * Exports JWT key rotation and token blacklist services
 * for enhanced authentication security.
 */

export { JwtKeyRotationService } from './JwtKeyRotationService';
export { TokenBlacklistService } from './TokenBlacklistService';

export type { JwtKeyRotationConfig, JwtKey } from './JwtKeyRotationService';
export type { TokenBlacklistConfig, RevokedTokenInfo, TokenBlacklistStats } from './TokenBlacklistService';