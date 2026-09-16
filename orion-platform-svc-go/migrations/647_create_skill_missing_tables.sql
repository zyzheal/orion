-- 647_create_skill_missing_tables.sql
-- skill 模块: skill_ratings 表无 CREATE TABLE。
-- skill_ratings 是评分事件流，无 id 列，仅 skill_id/rating/created_at。
-- 回滚见 647_create_skill_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS skill_ratings (
    skill_id   UUID NOT NULL,
    rating     INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_skill_ratings_skill ON skill_ratings(skill_id);
