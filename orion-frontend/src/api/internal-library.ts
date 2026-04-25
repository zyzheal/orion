/**
 * Internal Library Management API Service
 * M30 - 二方库管理
 */
import { api } from './client';

// ---- Types ----

export type LibraryLanguage = 'java' | 'node' | 'python' | 'go' | 'rust' | 'dotnet';
export type LibraryStatus = 'active' | 'deprecated' | 'archived' | 'development';
export type VersionStatus = 'snapshot' | 'alpha' | 'beta' | 'rc' | 'stable' | 'deprecated';

export interface LibraryVersion {
  version: string;
  status: VersionStatus;
  releasedAt: string;
  changelog?: string;
  securityScore?: number;
  vulnerabilities?: Array<{ severity: 'critical' | 'high' | 'medium' | 'low'; count: number }>;
  testCoverage?: number;
  eolDate?: string;
  deprecationReason?: string;
  migrationGuide?: string;
  publishedTo?: string[];
  artifactId?: string;
}

export interface BreakingChange {
  version: string;
  changes: string[];
  migrationGuide: string;
  deprecationPeriod: string;
  announcedAt: string;
  effectiveAt: string;
}

export interface LibraryDependent {
  repoName: string;
  teamName: string;
  currentVersion: string;
  latestCompatibleVersion?: string;
  upgradeAvailable: boolean;
  upgradeType?: 'patch' | 'minor' | 'major' | 'breaking';
  lastUpdated: string;
}

export interface LibraryQuality {
  testCoverage?: number;
  securityScore?: number;
  openIssues?: number;
  openPRs?: number;
  lastReleaseAge?: number;
  staleBranches?: number;
  aiReviewScore?: number;
}

export interface InternalLibrary {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  language: LibraryLanguage;
  status: LibraryStatus;
  owner: string;
  maintainers: string[];
  repository: string;
  documentation?: string;
  sla?: string;
  currentVersion: string;
  latestStableVersion: string;
  versions: LibraryVersion[];
  breakingChanges?: BreakingChange[];
  dependents: {
    totalRepos: number;
    totalTeams: number;
    reposUsingLatest: number;
    reposNeedingUpgrade: number;
    list?: LibraryDependent[];
  };
  quality?: LibraryQuality;
  publishConfig?: {
    repository?: string;
    autoPublish?: boolean;
    requireApproval?: boolean;
    approvers?: string[];
  };
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  tenantId?: string;
}

export interface DependencyCheckResult {
  libraryName: string;
  currentVersion: string;
  latestVersion: string;
  status: 'latest' | 'upgrade_available' | 'breaking_change' | 'deprecated';
  upgradeType?: 'patch' | 'minor' | 'major' | 'breaking';
  securityScore?: number;
  breakingChanges?: string[];
  migrationGuide?: string;
}

export interface CreateLibraryInput {
  name: string;
  displayName?: string;
  description?: string;
  language: LibraryLanguage;
  owner: string;
  maintainers?: string[];
  repository: string;
  documentation?: string;
  sla?: string;
  publishConfig?: {
    repository?: string;
    autoPublish?: boolean;
    requireApproval?: boolean;
    approvers?: string[];
  };
  labels?: Record<string, string>;
  tenantId?: string;
}

export interface PublishVersionInput {
  version: string;
  status?: VersionStatus;
  changelog?: string;
  artifactId?: string;
  securityScore?: number;
  testCoverage?: number;
  publishedTo?: string[];
}

export interface DeprecateLibraryInput {
  reason: string;
  eolDate: string;
  migrationGuide?: string;
  replacementLibrary?: string;
}

export interface AddDependentInput {
  repoName: string;
  teamName: string;
  version: string;
}

export interface LibraryListParams {
  language?: LibraryLanguage;
  status?: LibraryStatus;
  owner?: string;
  name?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// ---- API Functions ----

/** List internal libraries with optional filters */
export function getInternalLibraries(params?: LibraryListParams) {
  return api.get<InternalLibrary[]>('/internal-libraries', { params });
}

/** Get library detail by ID */
export function getInternalLibrary(id: string) {
  return api.get<InternalLibrary>(`/internal-libraries/${id}`);
}

/** Get library by name */
export function getInternalLibraryByName(name: string) {
  return api.get<InternalLibrary>(`/internal-libraries/name/${name}`);
}

/** List libraries by language */
export function getLibrariesByLanguage(language: LibraryLanguage) {
  return api.get<InternalLibrary[]>(`/internal-libraries/language/${language}`);
}

/** List libraries by owner/team */
export function getLibrariesByOwner(owner: string) {
  return api.get<InternalLibrary[]>(`/internal-libraries/owner/${owner}`);
}

/** Create a new internal library */
export function createInternalLibrary(data: CreateLibraryInput) {
  return api.post<InternalLibrary>('/internal-libraries', data);
}

/** Delete an internal library */
export function deleteInternalLibrary(id: string) {
  return api.delete(`/internal-libraries/${id}`);
}

/** Deprecate an internal library */
export function deprecateInternalLibrary(id: string, data: DeprecateLibraryInput) {
  return api.post<InternalLibrary>(`/internal-libraries/${id}/deprecate`, data);
}

/** Activate an internal library */
export function activateInternalLibrary(id: string) {
  return api.post<InternalLibrary>(`/internal-libraries/${id}/activate`);
}

// ---- Version Management ----

/** Publish a new version */
export function publishVersion(id: string, data: PublishVersionInput) {
  return api.post<LibraryVersion>(`/internal-libraries/${id}/versions`, data);
}

/** Get version list for a library */
export function getVersions(id: string) {
  return api.get<LibraryVersion[]>(`/internal-libraries/${id}/versions`);
}

/** Get specific version detail */
export function getVersion(id: string, version: string) {
  return api.get<LibraryVersion>(`/internal-libraries/${id}/versions/${version}`);
}

/** Deprecate a specific version */
export function deprecateVersion(id: string, version: string, reason: string, eolDate: string, migrationGuide?: string) {
  return api.post<LibraryVersion>(`/internal-libraries/${id}/versions/${version}/deprecate`, {
    reason,
    eolDate,
    migrationGuide,
  });
}

// ---- Dependency Management ----

/** Get dependents list for a library */
export function getDependents(id: string) {
  return api.get<LibraryDependent[]>(`/internal-libraries/${id}/dependents`);
}

/** Add a dependent relationship */
export function addDependent(id: string, data: AddDependentInput) {
  return api.post<LibraryDependent>(`/internal-libraries/${id}/dependents`, data);
}

/** Update dependent version */
export function updateDependent(id: string, repoName: string, version: string) {
  return api.put(`/internal-libraries/${id}/dependents/${repoName}`, { version });
}

/** Check project dependencies */
export function checkDependencies(repoName: string) {
  return api.get<DependencyCheckResult[]>(`/repositories/${repoName}/dependencies`);
}

/** Update dependency statistics */
export function updateDependentStats(id: string) {
  return api.post(`/internal-libraries/${id}/update-stats`);
}
