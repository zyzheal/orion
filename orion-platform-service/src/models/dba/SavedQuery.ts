/**
 * Saved Query Model
 *
 * Represents a user-saved query template that can be re-executed later.
 */

export interface SavedQuery {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  sql: string;
  params?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedQueryInput {
  name: string;
  sql: string;
  params?: Record<string, any>;
}

export interface UpdateSavedQueryInput {
  name?: string;
  sql?: string;
  params?: Record<string, any>;
}
