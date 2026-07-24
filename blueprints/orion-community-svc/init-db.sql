-- Community Service 数据库初始化脚本

-- 贡献表
CREATE TABLE IF NOT EXISTS contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id VARCHAR(255) NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'plugin',
  title VARCHAR(500) NOT NULL,
  description TEXT,
  repository_url VARCHAR(1000),
  documentation_url VARCHAR(1000),
  version VARCHAR(50) NOT NULL DEFAULT '0.1.0',
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  tags TEXT[] DEFAULT '{}',
  downloads_count INTEGER NOT NULL DEFAULT 0,
  stars_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 插件表
CREATE TABLE IF NOT EXISTS plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id UUID REFERENCES contributions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  author_id VARCHAR(255) NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL DEFAULT '0.1.0',
  manifest JSONB NOT NULL DEFAULT '{}',
  download_url VARCHAR(1000),
  checksum_sha256 VARCHAR(128),
  status VARCHAR(30) NOT NULL DEFAULT 'pending_review',
  category VARCHAR(100),
  tags TEXT[] DEFAULT '{}',
  downloads_count INTEGER NOT NULL DEFAULT 0,
  rating_avg NUMERIC(3, 2) DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 评论表
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  reviewer_id VARCHAR(255) NOT NULL,
  reviewer_name VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(300),
  content TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'published',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 反馈表
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'feedback',
  content TEXT NOT NULL,
  severity VARCHAR(30) NOT NULL DEFAULT 'info',
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  resolution TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 徽章表
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  icon_url VARCHAR(1000),
  category VARCHAR(100),
  criteria JSONB NOT NULL DEFAULT '{}',
  level VARCHAR(30) NOT NULL DEFAULT 'bronze',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 用户徽章表
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  awarded_by VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, badge_id)
);

-- 激励计划表
CREATE TABLE IF NOT EXISTS incentives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(300) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,
  reward_type VARCHAR(50) NOT NULL,
  reward_value NUMERIC(10, 2),
  eligibility_criteria JSONB NOT NULL DEFAULT '{}',
  budget_total NUMERIC(12, 2),
  budget_spent NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 激励奖励表
CREATE TABLE IF NOT EXISTS incentive_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incentive_id UUID REFERENCES incentives(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  reward_value NUMERIC(10, 2),
  reason TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  awarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  fulfilled_at TIMESTAMP WITH TIME ZONE
);

-- 导师表
CREATE TABLE IF NOT EXISTS mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL UNIQUE,
  user_name VARCHAR(255) NOT NULL,
  bio TEXT,
  expertise TEXT[] DEFAULT '{}',
  availability VARCHAR(100),
  rating_avg NUMERIC(3, 2) DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  mentee_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 最佳实践表
CREATE TABLE IF NOT EXISTS best_practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  author_id VARCHAR(255) NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_by VARCHAR(255),
  verified_at TIMESTAMP WITH TIME ZONE,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_contributions_author ON contributions(author_id);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status);
CREATE INDEX IF NOT EXISTS idx_plugins_status ON plugins(status);
CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_feedback_target ON feedback(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_incentive_awards_user ON incentive_awards(user_id);
CREATE INDEX IF NOT EXISTS idx_incentive_awards_incentive ON incentive_awards(incentive_id);
CREATE INDEX IF NOT EXISTS idx_best_practices_category ON best_practices(category);
CREATE INDEX IF NOT EXISTS idx_best_practices_status ON best_practices(status);
