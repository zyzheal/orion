/**
 * User Token API Service
 *
 * Aligned with backend /api/v1/users/:id/tokens/* routes (user-token-routes.ts)
 * Covers: list, create, delete API tokens for users
 */
import { api } from './client';

// ==================== Interfaces ====================

export interface UserToken {
  id: string;
  userId: string;
  name: string;
  tokenHash: string;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface CreateTokenInput {
  name: string;
  expiresInDays?: number;
}

export interface CreateTokenResult {
  token: string;
}

// ==================== Token Operations ====================

export const getUserTokens = async (userId: string): Promise<UserToken[]> => {
  const response = await api.get<{ data: UserToken[] }>(`/v1/users/${userId}/tokens`);
  return response.data.data;
};

export const createUserToken = async (userId: string, data: CreateTokenInput): Promise<CreateTokenResult> => {
  const response = await api.post<{ data: CreateTokenResult }>(`/v1/users/${userId}/tokens`, data);
  return response.data.data;
};

export const deleteUserToken = async (userId: string, tokenId: string): Promise<void> => {
  await api.delete(`/v1/users/${userId}/tokens/${tokenId}`);
};
