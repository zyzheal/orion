/**
 * PandaWiki Knowledge Base API Service
 * Space and document management with search, version history, permissions, and attachments
 */
import { api } from './client';

// ─── Core Types ───────────────────────────────────────────────────

export interface WikiSpace {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  documentCount: number;
  ownerId?: string;
  ownerName?: string;
}

export interface WikiDocument {
  id: string;
  spaceId: string;
  title: string;
  content: string;
  parentId?: string;
  tags?: string[];
  attachments?: AttachmentInfo[];
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  updatedByName?: string;
  version?: number;
}

export interface CreateSpaceInput {
  name: string;
  description?: string;
}

export interface CreateDocumentInput {
  title: string;
  content: string;
  parentId?: string;
  tags?: string[];
}

export interface UpdateDocumentInput {
  title?: string;
  content?: string;
  parentId?: string;
  tags?: string[];
}

export interface SearchResult {
  id: string;
  spaceId: string;
  title: string;
  content: string;
  score: number;
}

// ─── Version History Types ────────────────────────────────────────

export interface DocumentVersion {
  id: string;
  documentId: string;
  content: string;
  title: string;
  version: number;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  changeSummary?: string;
}

// ─── Permission Types ─────────────────────────────────────────────

export type PermissionRole = 'owner' | 'editor' | 'commenter' | 'viewer';

export interface SpacePermission {
  id: string;
  spaceId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  role: PermissionRole;
  grantedAt: string;
  grantedBy?: string;
}

export interface SpaceShareLink {
  id: string;
  spaceId: string;
  url: string;
  token: string;
  role: PermissionRole;
  expiresAt?: string;
  createdAt: string;
  createdBy: string;
}

export interface SpaceMember {
  userId: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string;
}

// ─── Attachment Types ─────────────────────────────────────────────

export interface AttachmentInfo {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
}

// ─── User Search Types ────────────────────────────────────────────

export interface UserSearchResult {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

// ─── Pagination ───────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ═══════════════════════════════════════════════════════════════════
//  API Functions
// ═══════════════════════════════════════════════════════════════════

// ---- Spaces ----

export function listSpaces() {
  return api.get<WikiSpace[]>('/knowledge/spaces');
}

export function createSpace(data: CreateSpaceInput) {
  return api.post('/knowledge/spaces', data);
}

export function getSpace(id: string) {
  return api.get(`/knowledge/spaces/${id}`);
}

export function updateSpace(id: string, data: CreateSpaceInput) {
  return api.patch(`/knowledge/spaces/${id}`, data);
}

export function deleteSpace(id: string) {
  return api.delete(`/knowledge/spaces/${id}`);
}

// ---- Documents ----

export function listDocuments(spaceId: string) {
  return api.get<WikiDocument[]>(`/knowledge/spaces/${spaceId}/documents`);
}

export function createDocument(spaceId: string, data: CreateDocumentInput) {
  return api.post(`/knowledge/spaces/${spaceId}/documents`, data);
}

export function getDocument(spaceId: string, docId: string) {
  return api.get(`/knowledge/spaces/${spaceId}/documents/${docId}`);
}

export function deleteDocument(spaceId: string, docId: string) {
  return api.delete(`/knowledge/spaces/${spaceId}/documents/${docId}`);
}

export function updateDocument(spaceId: string, docId: string, data: UpdateDocumentInput) {
  return api.patch(`/knowledge/spaces/${spaceId}/documents/${docId}`, data);
}

// Move/reorder documents
export function moveDocument(spaceId: string, docId: string, targetParentId?: string, sortOrder?: number) {
  return api.patch(`/knowledge/spaces/${spaceId}/documents/${docId}/move`, {
    parentId: targetParentId,
    sortOrder,
  });
}

// ---- Version History ----

export function listDocumentVersions(spaceId: string, docId: string, params?: { limit?: number; offset?: number }) {
  return api.get<PaginatedResponse<DocumentVersion>>(
    `/knowledge/spaces/${spaceId}/documents/${docId}/versions`,
    { params }
  );
}

export function getDocumentVersion(spaceId: string, docId: string, versionId: string) {
  return api.get<DocumentVersion>(
    `/knowledge/spaces/${spaceId}/documents/${docId}/versions/${versionId}`
  );
}

export function restoreDocumentVersion(spaceId: string, docId: string, versionId: string, data?: { changeSummary?: string }) {
  return api.post(
    `/knowledge/spaces/${spaceId}/documents/${docId}/restore`,
    { versionId, ...data }
  );
}

// ---- Permissions ----

export function listSpacePermissions(spaceId: string) {
  return api.get<SpacePermission[]>(`/knowledge/spaces/${spaceId}/permissions`);
}

export function updateSpacePermission(spaceId: string, permissionId: string, data: { role: PermissionRole }) {
  return api.patch(`/knowledge/spaces/${spaceId}/permissions/${permissionId}`, data);
}

export function removeSpacePermission(spaceId: string, permissionId: string) {
  return api.delete(`/knowledge/spaces/${spaceId}/permissions/${permissionId}`);
}

export function addSpaceMember(spaceId: string, data: { userId: string; role: PermissionRole }) {
  return api.post(`/knowledge/spaces/${spaceId}/members`, data);
}

// ---- Share Links ----

export function createShareLink(spaceId: string, data: { role: PermissionRole; expiresAt?: string }) {
  return api.post<SpaceShareLink>(`/knowledge/spaces/${spaceId}/share-links`, data);
}

export function listShareLinks(spaceId: string) {
  return api.get<SpaceShareLink[]>(`/knowledge/spaces/${spaceId}/share-links`);
}

export function revokeShareLink(spaceId: string, shareLinkId: string) {
  return api.delete(`/knowledge/spaces/${spaceId}/share-links/${shareLinkId}`);
}

// ---- Attachments ----

export function uploadAttachment(spaceId: string, docId: string, formData: FormData) {
  return api.post<AttachmentInfo>(
    `/knowledge/spaces/${spaceId}/documents/${docId}/attachments`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
}

export function deleteAttachment(spaceId: string, docId: string, attachmentId: string) {
  return api.delete(`/knowledge/spaces/${spaceId}/documents/${docId}/attachments/${attachmentId}`);
}

// ---- Tags ----

export interface TagInfo {
  id: string;
  name: string;
  color: string;
  documentCount: number;
}

export function listTags(spaceId: string) {
  return api.get<TagInfo[]>(`/knowledge/spaces/${spaceId}/tags`);
}

// ---- Search ----

export function searchDocuments(query: string, spaceId?: string) {
  return api.get<SearchResult[]>('/knowledge/search', {
    params: { q: query, spaceId },
  });
}

// ---- User Search (for member management) ----

export function searchUsers(query: string) {
  return api.get<UserSearchResult[]>('/users/search', {
    params: { q: query },
  });
}

// ---- Response unwrapping helpers ----
// api.get<T>() returns AxiosResponse<T>, where response.data is unwrapped to T by the interceptor.
// T may be an array, or an object like { spaces: T[], documents: T[] } depending on backend.

export function unwrapArray<T>(response: { data: unknown }): T[] {
  const data = response.data;
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['spaces', 'documents', 'results', 'items', 'list', 'data']) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

export function unwrapSearchResults(response: { data: unknown }): SearchResult[] {
  return unwrapArray<SearchResult>(response).map((r) => ({
    ...r,
    score: typeof r.score === 'number' ? r.score : 0,
  }));
}
