// orion-platform-service/src/services/auth/index.ts
/**
 * Auth Service Module - Phase 1 P0 Implementation
 *
 * Exports JWT key rotation and token blacklist services
 * for enhanced authentication security.
 */

export { JwtKeyRotationService } from './JwtKeyRotationService';
export { TokenBlacklistService } from './TokenBlacklistService';
export { K8sSecretKeyStorage, k8sSecretStorage } from './K8sSecretKeyStorage';
export { SsoService } from './SsoService';

export type { JwtKeyRotationConfig, JwtKey } from './JwtKeyRotationService';
export type { TokenBlacklistConfig, RevokedTokenInfo, TokenBlacklistStats } from './TokenBlacklistService';
export type { K8sSecretConfig } from './K8sSecretKeyStorage';
export type { SsoConfig, SsoUserProfile } from './SsoService';