-- Migration 046: ProductLine (M6) - 多分支产品线
-- Creates tables for ProductLine, ReleaseTrain, HotfixChannel

-- ProductLine 产品线表
CREATE TABLE IF NOT EXISTS product_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL UNIQUE,
  display_name    VARCHAR(200) NOT NULL,
  description     TEXT,

  -- Git 仓库配置
  git_url         VARCHAR(500) NOT NULL,
  git_provider    VARCHAR(50) DEFAULT 'github',
  git_default_branch VARCHAR(100) DEFAULT 'main',
  git_credential_ref JSONB,

  -- 分支策略
  branch_mode     VARCHAR(50) NOT NULL DEFAULT 'github-flow',  -- gitflow | github-flow | trunk-based
  protected_branches JSONB DEFAULT '[]',
  code_ownership  JSONB DEFAULT '{}',
  naming_convention JSONB DEFAULT '{}',
  merge_strategy  JSONB DEFAULT '{}',

  -- 环境映射
  default_environment VARCHAR(50) DEFAULT 'dev',
  environment_mappings JSONB NOT NULL DEFAULT '[]',
  promotion_config JSONB DEFAULT '{}',

  -- 环境配置
  environments    JSONB DEFAULT '[]',

  -- 流水线模板
  default_pipeline_template VARCHAR(100),
  pipeline_templates JSONB DEFAULT '[]',

  -- 团队绑定
  team_bindings   JSONB DEFAULT '[]',

  -- 资源配额
  resource_quotas JSONB DEFAULT '{}',

  -- 通知配置
  notifications   JSONB DEFAULT '{}',

  -- 标签与注解
  labels          JSONB DEFAULT '{}',
  annotations     JSONB DEFAULT '{}',

  -- 状态
  phase           VARCHAR(50) NOT NULL DEFAULT 'Pending',
  conditions      JSONB DEFAULT '[]',
  statistics      JSONB DEFAULT '{}',
  git_status      JSONB DEFAULT '{}',
  environment_statuses JSONB DEFAULT '[]',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_lines_tenant ON product_lines(tenant_id);
CREATE INDEX idx_product_lines_name ON product_lines(name);
CREATE INDEX idx_product_lines_phase ON product_lines(phase);
CREATE INDEX idx_product_lines_git_url ON product_lines(git_url);
COMMENT ON TABLE product_lines IS '多分支产品线配置';

-- ReleaseTrain 发布列车表
CREATE TABLE IF NOT EXISTS release_trains (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_line_id UUID NOT NULL REFERENCES product_lines(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,

  -- 发布配置
  schedule        VARCHAR(100) NOT NULL,  -- Cron expression
  target_branch   VARCHAR(100) DEFAULT 'production',
  source_branch   VARCHAR(100) DEFAULT 'main',
  auto_promote    BOOLEAN DEFAULT false,
  approval_required BOOLEAN DEFAULT true,
  approvers       JSONB DEFAULT '[]',

  -- 检查与动作
  pre_checks      JSONB DEFAULT '[]',
  post_actions    JSONB DEFAULT '[]',

  -- 状态
  last_run        TIMESTAMPTZ,
  next_run        TIMESTAMPTZ,
  state           VARCHAR(50) NOT NULL DEFAULT 'Idle',  -- Idle | Running | Completed | Failed | Skipped
  last_release    VARCHAR(100),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_release_trains_product_line ON release_trains(product_line_id);
CREATE INDEX idx_release_trains_schedule ON release_trains(schedule);
CREATE INDEX idx_release_trains_state ON release_trains(state);
COMMENT ON TABLE release_trains IS '发布列车调度配置';

-- HotfixChannel 紧急修复通道表
CREATE TABLE IF NOT EXISTS hotfix_channels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_line_id UUID NOT NULL REFERENCES product_lines(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,

  -- 紧急修复配置
  enabled         BOOLEAN DEFAULT true,
  branch_pattern  VARCHAR(200) DEFAULT '^hotfix/.*$',
  skip_stages     JSONB DEFAULT '[]',      -- 可跳过的阶段
  required_stages JSONB DEFAULT '[]',      -- 必须执行的阶段
  approval_required BOOLEAN DEFAULT true,
  approval_timeout INT DEFAULT 30,         -- 分钟
  auto_merge      BOOLEAN DEFAULT false,
  notify_on_call  BOOLEAN DEFAULT true,
  max_duration    INT DEFAULT 60,          -- 分钟

  -- 状态
  active_hotfixes INT DEFAULT 0,
  last_hotfix     VARCHAR(100),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hotfix_channels_product_line ON hotfix_channels(product_line_id);
CREATE INDEX idx_hotfix_channels_enabled ON hotfix_channels(enabled);
COMMENT ON TABLE hotfix_channels IS '紧急修复通道配置';

-- Rollback:
-- DROP TABLE IF EXISTS hotfix_channels, release_trains, product_lines;