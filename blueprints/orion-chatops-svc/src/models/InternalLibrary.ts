/** InternalLibrary model */

export type LibraryLanguage = 'typescript' | 'javascript' | 'java' | 'python' | 'go' | 'rust' | 'other';
export type LibraryStatus = 'active' | 'deprecated' | 'archived' | 'experimental';

export interface InternalLibrary {
  id: string;
  name: string;
  version: string;
  description: string;
}

export interface LibraryVersion {
  id: string;
  libraryId: string;
  version: string;
  status: string;
  releasedAt: Date;
  changelog: string | null;
}

export interface LibraryDependent {
  id: string;
  libraryId: string;
  repoName: string;
  teamName: string;
  currentVersion: string;
  latestCompatibleVersion: string | null;
  upgradeAvailable: boolean;
  upgradeType: string | null;
  lastUpdated: Date;
  createdAt: Date;
}

export interface CreateLibraryInput {
  name: string;
  displayName?: string;
  description?: string;
  language: LibraryLanguage;
  owner: string;
  maintainers?: string[];
  repository?: string;
}

export interface LibraryQueryOptions {
  language?: LibraryLanguage;
  status?: LibraryStatus;
  owner?: string;
  name?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}
