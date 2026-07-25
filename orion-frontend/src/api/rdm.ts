/**
 * RDM (Research & Development Management) API Client
 *
 * 研发管理：需求、缺陷、迭代、任务、文档、代码评审、发布、统计
 */
import apiClient from './client';

// ── Requirement ──

export interface Requirement {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'backlog' | 'pending' | 'in_progress' | 'done';
  type: 'feature' | 'bug' | 'tech_debt' | 'other';
  storyPoints: number | null;
  assignee: string | null;
  sprintId: string | null;
  parentId: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRequirementInput {
  projectId: string;
  title: string;
  description?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  type?: 'feature' | 'bug' | 'tech_debt' | 'other';
  storyPoints?: number;
  assignee?: string;
  sprintId?: string;
  parentId?: string;
  labels?: string[];
}

export const listRequirements = (params?: { status?: string; priority?: string; projectId?: string }) =>
  apiClient.get<Requirement[]>('/rdm/requirements', { params });

export const getRequirement = (id: string) =>
  apiClient.get<Requirement>(`/rdm/requirements/${id}`);

export const createRequirement = (data: CreateRequirementInput) =>
  apiClient.post<Requirement>('/rdm/requirements', data);

export const updateRequirement = (id: string, data: Partial<Requirement>) =>
  apiClient.put<Requirement>(`/rdm/requirements/${id}`, data);

export const deleteRequirement = (id: string) =>
  apiClient.delete(`/rdm/requirements/${id}`);

export const getRequirementPool = (params?: { projectId?: string }) =>
  apiClient.get<Requirement[]>('/rdm/requirements/pool', { params });

// ── Defect ──

export interface Defect {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  description: string;
  severity: 'critical' | 'major' | 'minor' | 'cosmetic';
  status: 'open' | 'in_progress' | 'fixed' | 'verified' | 'closed' | 'rejected';
  environment: string;
  reporter: string;
  assignee: string | null;
  screenshotUrl: string | null;
  stepsToReproduce: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDefectInput {
  projectId: string;
  title: string;
  description?: string;
  severity?: 'critical' | 'major' | 'minor' | 'cosmetic';
  environment?: string;
  stepsToReproduce?: string;
  labels?: string[];
}

export const listDefects = (params?: { severity?: string; status?: string; projectId?: string }) =>
  apiClient.get<Defect[]>('/rdm/defects', { params });

export const getDefect = (id: string) =>
  apiClient.get<Defect>(`/rdm/defects/${id}`);

export const createDefect = (data: CreateDefectInput) =>
  apiClient.post<Defect>('/rdm/defects', data);

export const updateDefect = (id: string, data: Partial<Defect>) =>
  apiClient.put<Defect>(`/rdm/defects/${id}`, data);

export const deleteDefect = (id: string) =>
  apiClient.delete(`/rdm/defects/${id}`);

export const getDefectStats = (params?: { projectId?: string }) =>
  apiClient.get<{ bySeverity: { severity: string; count: number }[]; byStatus: { status: string; count: number }[] }>('/rdm/defects/stats', { params });

// ── Sprint ──

export interface Sprint {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  capacity: number | null;
  totalPoints: number;
  completedPoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSprintInput {
  projectId: string;
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
  capacity?: number;
}

export const listSprints = (params?: { status?: string; projectId?: string }) =>
  apiClient.get<Sprint[]>('/rdm/sprints', { params });

export const getSprint = (id: string) =>
  apiClient.get<Sprint>(`/rdm/sprints/${id}`);

export const createSprint = (data: CreateSprintInput) =>
  apiClient.post<Sprint>('/rdm/sprints', data);

export const updateSprint = (id: string, data: Partial<Sprint>) =>
  apiClient.put<Sprint>(`/rdm/sprints/${id}`, data);

export const deleteSprint = (id: string) =>
  apiClient.delete(`/rdm/sprints/${id}`);

export const getSprintBoard = (sprintId: string) =>
  apiClient.get<{ sprint: Sprint; columns: Record<string, { id: string; title: string; priority: string; assignee: string | null }[]> }>('/rdm/sprints/' + sprintId + '/board');

// ── Task ──

export interface Task {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'high' | 'medium' | 'low';
  assignee: string | null;
  requirementId: string | null;
  storyPoints: number | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  assignee?: string;
  requirementId?: string;
  storyPoints?: number;
}

export const listTasks = (params?: { status?: string; assignee?: string; projectId?: string }) =>
  apiClient.get<Task[]>('/rdm/tasks', { params });

export const getTask = (id: string) =>
  apiClient.get<Task>(`/rdm/tasks/${id}`);

export const createTask = (data: CreateTaskInput) =>
  apiClient.post<Task>('/rdm/tasks', data);

export const updateTask = (id: string, data: Partial<Task>) =>
  apiClient.put<Task>(`/rdm/tasks/${id}`, data);

export const deleteTask = (id: string) =>
  apiClient.delete(`/rdm/tasks/${id}`);

export const getMyTasks = () =>
  apiClient.get<Task[]>('/rdm/tasks/my');

// ── Document ──

export interface Document {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  content: string;
  version: number;
  author: string;
  status: 'draft' | 'published' | 'archived';
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentInput {
  projectId: string;
  title: string;
  content?: string;
  tags?: string[];
}

export interface UpdateDocumentInput {
  title?: string;
  content?: string;
  status?: 'draft' | 'published' | 'archived';
  tags?: string[];
}

export const listDocuments = (params?: { status?: string; projectId?: string; tags?: string }) =>
  apiClient.get<Document[]>('/rdm/documents', { params });

export const getDocument = (id: string) =>
  apiClient.get<Document>(`/rdm/documents/${id}`);

export const createDocument = (data: CreateDocumentInput) =>
  apiClient.post<Document>('/rdm/documents', data);

export const updateDocument = (id: string, data: UpdateDocumentInput) =>
  apiClient.put<Document>(`/rdm/documents/${id}`, data);

export const deleteDocument = (id: string) =>
  apiClient.delete(`/rdm/documents/${id}`);

export const getDocumentVersions = (id: string) =>
  apiClient.get<Document[]>('/rdm/documents/' + id + '/versions');

// ── Code Review ──

export interface CodeReview {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  sourceBranch: string;
  targetBranch: string;
  sourceCommit: string;
  status: 'pending' | 'approved' | 'changes_requested' | 'merged' | 'closed';
  author: string;
  reviewers: string[];
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCodeReviewInput {
  projectId: string;
  title: string;
  sourceBranch: string;
  targetBranch: string;
  sourceCommit: string;
  reviewers: string[];
}

export interface CodeReviewComment {
  id: string;
  reviewId: string;
  author: string;
  content: string;
  file: string | null;
  line: number | null;
  createdAt: string;
}

export const listCodeReviews = (params?: { status?: string; projectId?: string }) =>
  apiClient.get<CodeReview[]>('/rdm/code-reviews', { params });

export const getCodeReview = (id: string) =>
  apiClient.get<CodeReview>(`/rdm/code-reviews/${id}`);

export const createCodeReview = (data: CreateCodeReviewInput) =>
  apiClient.post<CodeReview>('/rdm/code-reviews', data);

export const deleteCodeReview = (id: string) =>
  apiClient.delete(`/rdm/code-reviews/${id}`);

export const getCodeReviewComments = (reviewId: string) =>
  apiClient.get<CodeReviewComment[]>('/rdm/code-reviews/' + reviewId + '/comments');

export const addCodeReviewComment = (reviewId: string, data: { content: string; file?: string; line?: number }) =>
  apiClient.post<CodeReviewComment>('/rdm/code-reviews/' + reviewId + '/comments', data);

// ── Release ──

export interface Release {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  version: string;
  description: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  targetDate: string | null;
  releaseDate: string | null;
  requirements: string[];
  defects: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateReleaseInput {
  projectId: string;
  name: string;
  version: string;
  description?: string;
  targetDate?: string;
}

export const listReleases = (params?: { status?: string; projectId?: string }) =>
  apiClient.get<Release[]>('/rdm/releases', { params });

export const getRelease = (id: string) =>
  apiClient.get<Release>(`/rdm/releases/${id}`);

export const createRelease = (data: CreateReleaseInput) =>
  apiClient.post<Release>('/rdm/releases', data);

export const updateRelease = (id: string, data: Partial<Release>) =>
  apiClient.put<Release>(`/rdm/releases/${id}`, data);

export const deleteRelease = (id: string) =>
  apiClient.delete(`/rdm/releases/${id}`);

// ── Statistics ──

export interface BurndownPoint {
  date: string;
  remainingPoints: number;
  idealPoints: number;
}

export interface VelocityPoint {
  sprint: string;
  completedPoints: number;
}

export const getBurndownData = (sprintId: string) =>
  apiClient.get<BurndownPoint[]>('/rdm/statistics/burndown/' + sprintId);

export const getVelocityData = (params?: { projectId?: string; limit?: number }) =>
  apiClient.get<VelocityPoint[]>('/rdm/statistics/velocity', { params });

export const getDefectStatsAPI = (params?: { projectId?: string }) =>
  apiClient.get<{ bySeverity: { severity: string; count: number }[]; byStatus: { status: string; count: number }[] }>('/rdm/statistics/defects', { params });

export const getSprintStats = (params?: { projectId?: string }) =>
  apiClient.get<{ sprintId: string; sprintName: string; totalTasks: number; completedTasks: number; totalPoints: number; completedPoints: number }[]>('/rdm/statistics/sprints', { params });
