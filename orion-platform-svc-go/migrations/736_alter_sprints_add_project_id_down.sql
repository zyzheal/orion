-- Rollback 736
ALTER TABLE sprints
    DROP CONSTRAINT IF EXISTS fk_sprints_project;

ALTER TABLE sprints
    DROP COLUMN IF EXISTS project_id,
    DROP COLUMN IF EXISTS goal,
    DROP COLUMN IF EXISTS capacity_points,
    DROP COLUMN IF EXISTS velocity_points,
    DROP COLUMN IF EXISTS review_status,
    DROP COLUMN IF EXISTS retrospective;
