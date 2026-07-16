// orion-platform-service/src/services/auth/index.ts
/**
 * Auth Service Module - Phase 1 P0 + Phase 3.8 SSO Implementation
 *
 * Exports JWT key rotation, token blacklist, and centralized key management
 * for enhanced authentication security.
 *
 * Phase 3.8 additions:
 *   - JwtKeyManager: Unified JWT secret management
 *   - initAuthMiddleware: Middleware initialization helper
 */

export { JwtKeyRotationService } from './JwtKeyRotationService';
export { TokenBlacklistService } from './TokenBlacklistService';
export { K8sSecretKeyStorage, k8sSecretStorage } from './K8sSecretKeyStorage';
export { SsoService } from './SsoService';
export { LdapService, ldapService } from './LdapService';
export { WechatWorkService, wechatWorkService } from './WechatWorkService';
export { JwtKeyManager, jwtKeyManager } from './JwtKeyManager';

export type { JwtKeyRotationConfig, JwtKey } from './JwtKeyRotationService';
export type { TokenBlacklistConfig, RevokedTokenInfo, TokenBlacklistStats } from './TokenBlacklistService';
export type { K8sSecretConfig } from './K8sSecretKeyStorage';
export type { SsoConfig, SsoUserProfile } from './SsoService';
export type { LdapConfig, LdapUserProfile } from './LdapService';
export type { WechatWorkConfig, WechatWorkUserProfile, LocalUserMapping } from './WechatWorkService';