package service

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// BuildService defines the interface for build operations.
type BuildService interface {
	StartBuild(ctx context.Context, repoID, branch string) (interface{}, error)
	GetBuild(ctx context.Context, id string) (interface{}, error)
	CancelBuild(ctx context.Context, id string) error
	ListBuilds(ctx context.Context, page, size int) (interface{}, error)
}

type buildServiceImpl struct {
	DB *sql.DB
}

// NewBuildService creates a new BuildService.
func NewBuildService(db *sql.DB) BuildService {
	return &buildServiceImpl{DB: db}
}

func (s *buildServiceImpl) StartBuild(ctx context.Context, repoID, branch string) (interface{}, error) {
	if repoID == "" {
		return nil, fmt.Errorf("repo_id is required")
	}
	id := uuid.New().String()
	now := time.Now()
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO builds (id, tenant_id, project_id, pipeline_run_id, source_ref, status, created_at, updated_at)
		VALUES ($1, 'tenant-1', $2, $3, $4, 'pending', NOW(), NOW())
	`, id, repoID, repoID, branch)
	if err != nil {
		return nil, fmt.Errorf("failed to create build: %w", err)
	}
	_ = now
	return map[string]interface{}{"id": id, "status": "pending"}, nil
}

func (s *buildServiceImpl) GetBuild(ctx context.Context, id string) (interface{}, error) {
	var (
		projectID, pipelineRunID, sourceRef, status, image, tag, buildArgs, logsCol, errMsg, createdBy string
		duration                                              int64
		startedAt, completedAt                                sql.NullTime
		createdAt, updatedAt                                  sql.NullTime
	)
	err := s.DB.QueryRowContext(ctx, `
		SELECT project_id, pipeline_run_id, source_ref, status,
			COALESCE(image, ''), COALESCE(tag, ''), COALESCE(build_args, ''),
			COALESCE(logs, ''), COALESCE(error, ''), COALESCE(created_by, ''),
			COALESCE(duration, 0),
			started_at, completed_at, created_at, updated_at
		FROM builds WHERE id=$1 AND deleted_at IS NULL`, id).
		Scan(&projectID, &pipelineRunID, &sourceRef, &status, &image, &tag, &buildArgs, &logsCol, &errMsg, &createdBy,
			&duration, &startedAt, &completedAt, &createdAt, &updatedAt)
	if err != nil {
		return nil, fmt.Errorf("build not found: %w", err)
	}
	return map[string]interface{}{
		"id":            id,
		"project_id":    projectID,
		"pipeline_run_id": pipelineRunID,
		"source_ref":    sourceRef,
		"status":        status,
		"image":         image,
		"tag":           tag,
		"build_args":    buildArgs,
		"logs":          logsCol,
		"error":         errMsg,
		"duration":      duration,
		"started_at":    startedAt.Time,
		"completed_at":  completedAt.Time,
		"created_at":    createdAt.Time,
		"updated_at":    updatedAt.Time,
	}, nil
}

func (s *buildServiceImpl) CancelBuild(ctx context.Context, id string) error {
	res, err := s.DB.ExecContext(ctx, `
		UPDATE builds SET status='cancelled', completed_at=NOW(), updated_at=NOW()
		WHERE id=$1 AND deleted_at IS NULL`, id)
	if err != nil {
		return fmt.Errorf("failed to cancel build: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("build %s not found", id)
	}
	return nil
}

func (s *buildServiceImpl) ListBuilds(ctx context.Context, page, size int) (interface{}, error) {
	if page < 1 {
		page = 1
	}
	if size < 1 {
		size = 20
	}
	offset := (page - 1) * size

	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, project_id, source_ref, status, COALESCE(image,''), COALESCE(tag,''),
			COALESCE(logs,''), COALESCE(error,''), COALESCE(created_by,''),
			COALESCE(duration,0), started_at, completed_at, created_at, updated_at
		FROM builds WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2`, size, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list builds: %w", err)
	}
	defer rows.Close()

	var total int
	_ = s.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM builds WHERE deleted_at IS NULL`).Scan(&total)

	builds := make([]map[string]interface{}, 0)
	for rows.Next() {
		var (
			id, projectID, sourceRef, status, image, tag, logsCol, errMsg, createdBy string
			duration                                                        int64
			startedAt, completedAt, createdAt, updatedAt                    sql.NullTime
		)
		if err := rows.Scan(&id, &projectID, &sourceRef, &status, &image, &tag,
			&logsCol, &errMsg, &createdBy, &duration, &startedAt, &completedAt,
			&createdAt, &updatedAt); err != nil {
			continue
		}
		builds = append(builds, map[string]interface{}{
			"id":           id,
			"project_id":   projectID,
			"source_ref":   sourceRef,
			"status":       status,
			"image":        image,
			"tag":          tag,
			"logs":         logsCol,
			"error":        errMsg,
			"created_by":   createdBy,
			"duration":     duration,
			"started_at":   startedAt.Time,
			"completed_at": completedAt.Time,
			"created_at":   createdAt.Time,
			"updated_at":   updatedAt.Time,
		})
	}

	return map[string]interface{}{"data": builds, "total": total, "page": page, "size": size}, nil
}
