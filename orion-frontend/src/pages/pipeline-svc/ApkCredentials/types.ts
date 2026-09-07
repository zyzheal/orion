/**
 * ApkCredentials shared types
 * 抽取自 index.tsx (P2-9 Phase 137)
 */

export interface MarketOption {
  label: string;
  value: string;
  icon: string;
}

export interface CredentialField {
  name: string;
  label: string;
  placeholder: string;
  required: boolean;
  type?: 'password';
}

export interface CredentialRecord {
  id: string;
  market: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EditingCredential {
  id: string;
  market: string;
}
