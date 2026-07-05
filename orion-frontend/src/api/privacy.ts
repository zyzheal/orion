/**
 * Privacy Policy API Service
 *
 * Aligned with backend /api/v1/privacy/* routes (privacy-routes.ts)
 * Covers: tenant privacy policy, compliance validation, content sanitization, secret/PII detection
 */
import { api } from './client';

// ==================== Interfaces ====================

export interface TenantPrivacyPolicy {
  tenantId: number;
  policyLevel: 'standard' | 'enhanced' | 'strict' | 'custom';
  secretSanitizationEnabled: boolean;
  piiSanitizationEnabled: boolean;
  nerModelType: 'bert-local' | 'bert-remote' | 'regex-only';
  localModelRequired?: boolean;
  sensitiveDataTypes?: string[];
  piiTypes?: string[];
  customPatterns?: Array<{ type: string; pattern: string }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface SanitizeResult {
  sanitized: string;
  secretsDetected: number;
  piiDetected: number;
}

export interface SecretDetection {
  type: string;
  value: string;
  start: number;
  end: number;
  confidence: number;
}

export interface PIIDetection {
  type: string;
  value: string;
  start: number;
  end: number;
  confidence: number;
  model?: string;
}

export interface ComplianceValidation {
  compliant: boolean;
  issues: Array<{ category: string; description: string; severity: string }>;
  score: number;
}

// ==================== Tenant Privacy Policy ====================

export const getTenantPrivacyPolicy = async (tenantId: number): Promise<TenantPrivacyPolicy> => {
  const response = await api.get<TenantPrivacyPolicy>(`/api/v1/privacy/${tenantId}/policy`);
  return response.data;
};

export const updateTenantPrivacyPolicy = async (tenantId: number, data: {
  policyLevel?: 'standard' | 'enhanced' | 'strict' | 'custom';
  secretSanitizationEnabled?: boolean;
  piiSanitizationEnabled?: boolean;
  nerModelType?: 'bert-local' | 'bert-remote' | 'regex-only';
  localModelRequired?: boolean;
  sensitiveDataTypes?: string[];
  piiTypes?: string[];
  customPatterns?: Array<{ type: string; pattern: string }>;
}): Promise<TenantPrivacyPolicy> => {
  const response = await api.put<TenantPrivacyPolicy>(`/api/v1/privacy/${tenantId}/policy`, data);
  return response.data;
};

// ==================== Compliance Validation ====================

export const validatePrivacyCompliance = async (tenantId: number): Promise<ComplianceValidation> => {
  const response = await api.get<ComplianceValidation>(`/api/v1/privacy/${tenantId}/compliance`);
  return response.data;
};

// ==================== Content Sanitization ====================

export const sanitizeContent = async (data: {
  content: string;
  options?: {
    maxLength?: number;
    preserveFormat?: boolean;
  };
}): Promise<SanitizeResult> => {
  const response = await api.post<SanitizeResult>('/api/v1/privacy/sanitize', data);
  return response.data;
};

// ==================== Secret Detection ====================

export const detectSecrets = async (data: {
  content: string;
}): Promise<{ detected: SecretDetection[]; count: number }> => {
  const response = await api.post<{ detected: SecretDetection[]; count: number }>('/api/v1/privacy/detect-secrets', data);
  return response.data;
};

// ==================== PII Detection ====================

export const detectPII = async (data: {
  content: string;
}): Promise<{ detected: PIIDetection[]; count: number }> => {
  const response = await api.post<{ detected: PIIDetection[]; count: number }>('/api/v1/privacy/detect-pii', data);
  return response.data;
};
