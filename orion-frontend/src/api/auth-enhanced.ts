/**
 * Enhanced Auth API Service
 *
 * Aligned with backend /api/v1/auth/* routes (auth-enhanced-routes.ts)
 * Covers: JWT key rotation, token blacklist, security monitoring
 */
import { api } from './client';

// ==================== Interfaces ====================

export interface JwtKeyInfo {
  keyId: string;
  keyStrength: string;
  status: string;
  activatedAt?: string;
  expiresAt?: string;
}

export interface JwtKeyStatus {
  activeKey: JwtKeyInfo | null;
  verificationKeys: JwtKeyInfo[];
  keyCount: number;
}

export interface KeyRotationResult {
  newKeyId: string;
  keyStrength: string;
  activatedAt: string;
  expiresAt: string;
  nextRotationDate: string;
  rotationType: string;
}

export interface EmergencyRotationResult {
  newKeyId: string;
  activatedAt: string;
  expiresAt: string;
}

export interface TokenRevokeInput {
  token: string;
  userId: string;
  tenantId: number;
  reason: 'logout' | 'security_incident' | 'password_change' | 'admin_revocation' | 'key_rotation';
  revokedBy?: string;
}

export interface TokenRevokeResult {
  tokenHash: string;
  userId: string;
  tenantId: number;
  reason: string;
  revokedAt: string;
}

export interface TokenCheckResult {
  tokenHash: string;
  isRevoked: boolean;
  checkedAt: string;
}

export interface BatchRevokeInput {
  targetType: 'user' | 'tenant';
  targetId: string;
  reason: string;
}

export interface BatchRevokeResult {
  targetType: string;
  targetId: string;
  revokedCount: number;
  reason: string;
  revokedAt: string;
}

export interface TokenBlacklistStats {
  totalRevoked: number;
  byReason: Record<string, number>;
  byTenant: Record<string, number>;
  topUsers: Array<{ userId: string; count: number }>;
}

export interface CleanupResult {
  cleanedCount: number;
  cleanedAt: string;
}

export interface SecurityStatus {
  keyRotation: {
    activeKeyId?: string;
    keyStrength?: string;
    health: {
      hasActiveKey: boolean;
      keyExpiresSoon: boolean;
      daysUntilExpiry: number | null;
    };
  };
  blacklist: {
    totalRevoked: number;
    recentRevocations: Record<string, number>;
  };
  overall: {
    status: 'healthy' | 'warning' | 'critical';
    recommendations: string[];
  };
}

// ==================== JWT Key Rotation ====================

export const getJwtKeyStatus = async (): Promise<JwtKeyStatus> => {
  const response = await api.get<{ data: JwtKeyStatus }>('/api/v1/auth/keys');
  return response.data.data;
};

export const rotateJwtKey = async (data?: {
  rotationType?: 'scheduled' | 'manual' | 'emergency';
  reason?: string;
}): Promise<KeyRotationResult> => {
  const response = await api.post<{ data: KeyRotationResult }>('/api/v1/auth/keys/rotate', data);
  return response.data.data;
};

export const emergencyRotateJwtKey = async (): Promise<EmergencyRotationResult> => {
  const response = await api.post<{ data: EmergencyRotationResult }>('/api/v1/auth/keys/emergency-rotate');
  return response.data.data;
};

// ==================== Token Blacklist ====================

export const revokeToken = async (data: TokenRevokeInput): Promise<TokenRevokeResult> => {
  const response = await api.post<{ data: TokenRevokeResult }>('/api/v1/auth/tokens/revoke', data);
  return response.data.data;
};

export const checkTokenStatus = async (tokenHash: string): Promise<TokenCheckResult> => {
  const response = await api.get<{ data: TokenCheckResult }>(`/api/v1/auth/tokens/check/${tokenHash}`);
  return response.data.data;
};

export const batchRevokeTokens = async (data: BatchRevokeInput): Promise<BatchRevokeResult> => {
  const response = await api.post<{ data: BatchRevokeResult }>('/api/v1/auth/tokens/revoke-batch', data);
  return response.data.data;
};

export const getTokenBlacklistStats = async (): Promise<TokenBlacklistStats> => {
  const response = await api.get<{ data: TokenBlacklistStats }>('/api/v1/auth/tokens/stats');
  return response.data.data;
};

export const cleanupExpiredTokens = async (): Promise<CleanupResult> => {
  const response = await api.post<{ data: CleanupResult }>('/api/v1/auth/tokens/cleanup');
  return response.data.data;
};

// ==================== Security Monitoring ====================

export const getAuthSecurityStatus = async (): Promise<SecurityStatus> => {
  const response = await api.get<{ data: SecurityStatus }>('/api/v1/auth/security/status');
  return response.data.data;
};
