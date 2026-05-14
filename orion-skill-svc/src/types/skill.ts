export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  repository_url: string | null;
  documentation_url: string | null;
  icon_url: string | null;
  tags: string[];
  is_public: boolean;
  is_verified: boolean;
  status: "active" | "deprecated" | "archived";
  total_installs: number;
  average_rating: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

export interface SkillVersion {
  id: string;
  skill_id: string;
  version: string;
  changelog: string | null;
  manifest: Record<string, unknown>;
  download_url: string | null;
  checksum: string | null;
  created_at: string;
}

export interface SkillInstall {
  id: string;
  skill_id: string;
  version: string | null;
  installed_by: string | null;
  installed_at: string;
}

export interface SkillRating {
  id: string;
  skill_id: string;
  user_id: string;
  score: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSkillInput {
  name: string;
  description: string;
  category: string;
  author: string;
  repository_url?: string;
  documentation_url?: string;
  icon_url?: string;
  tags?: string[];
  is_public?: boolean;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  category?: string;
  repository_url?: string;
  documentation_url?: string;
  icon_url?: string;
  tags?: string[];
  is_public?: boolean;
  status?: "active" | "deprecated" | "archived";
}

export interface CreateVersionInput {
  version: string;
  changelog?: string;
  manifest?: Record<string, unknown>;
  download_url?: string;
  checksum?: string;
}

export interface RateSkillInput {
  user_id: string;
  score: number;
  comment?: string;
}

export interface SkillListParams {
  category?: string;
  author?: string;
  tags?: string[];
  is_public?: boolean;
  is_verified?: boolean;
  status?: string;
  search?: string;
  sort?: "name" | "total_installs" | "average_rating" | "created_at";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
  meta?: {
    timestamp: string;
    [key: string]: unknown;
  };
}
