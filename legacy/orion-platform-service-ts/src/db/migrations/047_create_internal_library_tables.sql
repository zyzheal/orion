-- Migration 047: Internal Library (M30) - 二方库管理
-- Creates tables for InternalLibrary, LibraryVersion, LibraryDependent

-- InternalLibrary 二方库表
CREATE TABLE IF NOT EXISTS internal_libraries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL UNIQUE,
  display_name    VARCHAR(200),
  description     TEXT,
  language        VARCHAR(50) NOT NULL,  -- java | node | python | go | rust | dotnet
  status          VARCHAR(50) NOT NULL DEFAULT 'active',  -- active | deprecated | archived | development

  -- 基本信息
  owner           VARCHAR(100) NOT NULL,  -- 团队名称
  maintainers     JSONB DEFAULT '[]',     -- 维护者列表
  repository      VARCHAR(500) NOT NULL,  -- Git 仓库 URL
  documentation   VARCHAR(500),           -- 文档链接
  sla             VARCHAR(200),           -- SLA 声明

  -- 版本信息
  current_version   VARCHAR(50),
  latest_stable_version VARCHAR(50),
  versions         JSONB DEFAULT '[]',     -- 版本列表
  breaking_changes JSONB DEFAULT '[]',     -- Breaking Change 列表

  -- 依赖统计
  dependents_total     INT DEFAULT 0,
  dependents_teams     INT DEFAULT 0,
  dependents_using_latest INT DEFAULT 0,
  dependents_needing_upgrade INT DEFAULT 0,
  dependents_list      JSONB DEFAULT '[]',

  -- 质量指标
  quality_test_coverage   DECIMAL(5,2),
  quality_security_score  INT,
  quality_open_issues     INT DEFAULT 0,
  quality_open_prs        INT DEFAULT 0,
  quality_last_release_age INT,

  -- 发布配置
  publish_repository    VARCHAR(200),
  publish_auto_publish  BOOLEAN DEFAULT false,
  publish_require_approval BOOLEAN DEFAULT true,
  publish_approvers     JSONB DEFAULT '[]',

  -- 标签与注解
  labels          JSONB DEFAULT '{}',
  annotations     JSONB DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_internal_libraries_tenant ON internal_libraries(tenant_id);
CREATE INDEX idx_internal_libraries_name ON internal_libraries(name);
CREATE INDEX idx_internal_libraries_language ON internal_libraries(language);
CREATE INDEX idx_internal_libraries_status ON internal_libraries(status);
CREATE INDEX idx_internal_libraries_owner ON internal_libraries(owner);
COMMENT ON TABLE internal_libraries IS '二方库注册表';

-- LibraryVersion 版本表
CREATE TABLE IF NOT EXISTS library_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id      UUID NOT NULL REFERENCES internal_libraries(id) ON DELETE CASCADE,
  version         VARCHAR(50) NOT NULL,
  status          VARCHAR(50) NOT NULL DEFAULT 'stable',  -- snapshot | alpha | beta | rc | stable | deprecated
  released_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  changelog       TEXT,

  -- 安全信息
  security_score  INT,
  vulnerabilities JSONB DEFAULT '[]',

  -- 质量信息
  test_coverage   DECIMAL(5,2),

  -- 废弃信息
  eol_date        TIMESTAMPTZ,
  deprecation_reason TEXT,
  migration_guide VARCHAR(500),

  -- 发布信息
  published_to    JSONB DEFAULT '[]',
  artifact_id     UUID REFERENCES artifact_registry(id),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(library_id, version)
);
CREATE INDEX idx_library_versions_library ON library_versions(library_id);
CREATE INDEX idx_library_versions_status ON library_versions(status);
CREATE INDEX idx_library_versions_released ON library_versions(released_at DESC);
COMMENT ON TABLE library_versions IS '二方库版本表';

-- LibraryDependent 依赖关系表
CREATE TABLE IF NOT EXISTS library_dependents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id      UUID NOT NULL REFERENCES internal_libraries(id) ON DELETE CASCADE,
  repo_name       VARCHAR(200) NOT NULL,
  team_name       VARCHAR(100) NOT NULL,
  current_version VARCHAR(50) NOT NULL,
  latest_compatible_version VARCHAR(50),
  upgrade_available BOOLEAN DEFAULT false,
  upgrade_type    VARCHAR(20),  -- patch | minor | major | breaking
  last_updated    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(library_id, repo_name)
);
CREATE INDEX idx_library_dependents_library ON library_dependents(library_id);
CREATE INDEX idx_library_dependents_repo ON library_dependents(repo_name);
CREATE INDEX idx_library_dependents_upgrade ON library_dependents(upgrade_available);
COMMENT ON TABLE library_dependents IS '二方库依赖关系表';

-- Rollback:
-- DROP TABLE IF EXISTS library_dependents, library_versions, internal_libraries;