package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/pipeline-audit-log/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Record inserts a single audit log entry.
func (r *Repository) Record(ctx context.Context, log *models.AuditLog) error {
	log.ID = uuid.New().String()
	log.CreatedAt = time.Now().UTC()
	if log.Metadata == "" {
		log.Metadata = "{}"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO pipeline_audit_logs (id, tenant_id, run_id, stage_id, task_id, action, actor,
			outcome, duration_ms, input_summary, output_summary, error_message, metadata, created_at)
		 VALUES (:id, :tenantId, :runId, :stageId, :taskId, :action, :actor,
			:outcome, :durationMs, :inputSummary, :outputSummary, :errorMessage, :metadata, :createdAt)`,
		log)
	return err
}

// RecordBatch inserts multiple audit log entries.
func (r *Repository) RecordBatch(ctx context.Context, logs []*models.AuditLog) error {
	if len(logs) == 0 {
		return nil
	}
	now := time.Now().UTC()
	for _, log := range logs {
		log.ID = uuid.New().String()
		log.CreatedAt = now
		if log.Metadata == "" {
			log.Metadata = "{}"
		}
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO pipeline_audit_logs (id, tenant_id, run_id, stage_id, task_id, action, actor,
			outcome, duration_ms, input_summary, output_summary, error_message, metadata, created_at)
		 VALUES (:id, :tenantId, :runId, :stageId, :taskId, :action, :actor,
			:outcome, :durationMs, :inputSummary, :outputSummary, :errorMessage, :metadata, :createdAt)`,
		logs)
	return err
}

// Query retrieves audit logs matching the given filters.
func (r *Repository) Query(ctx context.Context, q models.AuditLogQuery) ([]models.AuditLog, int, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{q.TenantID}
	argIdx := 2

	where, args, argIdx = addFilter(where, args, argIdx, q.RunID, "run_id")
	where, args, argIdx = addFilter(where, args, argIdx, q.StageID, "stage_id")
	where, args, argIdx = addFilter(where, args, argIdx, q.TaskID, "task_id")
	where, args, argIdx = addFilter(where, args, argIdx, q.Action, "action")
	where, args, argIdx = addFilter(where, args, argIdx, q.Actor, "actor")
	where, args, argIdx = addFilter(where, args, argIdx, q.Outcome, "outcome")

	if q.StartTime != nil {
		where += fmt.Sprintf(" AND created_at >= $%d", argIdx)
		args = append(args, *q.StartTime)
		argIdx++
	}
	if q.EndTime != nil {
		where += fmt.Sprintf(" AND created_at <= $%d", argIdx)
		args = append(args, *q.EndTime)
		argIdx++
	}

	var total int
	err := r.db.GetContext(ctx, &total,
		fmt.Sprintf(`SELECT COUNT(*) FROM pipeline_audit_logs %s`, where), args...)
	if err != nil {
		return nil, 0, err
	}

	limit := q.Limit
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	offset := q.Offset
	if offset < 0 {
		offset = 0
	}

	var logs []models.AuditLog
	err = r.db.SelectContext(ctx, &logs,
		fmt.Sprintf(`SELECT * FROM pipeline_audit_logs %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			where, argIdx, argIdx+1),
		append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	if logs == nil {
		logs = []models.AuditLog{}
	}
	return logs, total, nil
}

// GetRunAuditTrail retrieves the full audit trail for a pipeline run.
func (r *Repository) GetRunAuditTrail(ctx context.Context, tenantID, runID string, limit int) (*models.AuditTrailResponse, error) {
	if limit <= 0 || limit > 1000 {
		limit = 100
	}
	var logs []models.AuditLog
	err := r.db.SelectContext(ctx, &logs,
		`SELECT * FROM pipeline_audit_logs WHERE tenant_id=$1 AND run_id=$2 ORDER BY created_at ASC LIMIT $3`,
		tenantID, runID, limit)
	if err != nil {
		return nil, err
	}
	if logs == nil {
		logs = []models.AuditLog{}
	}
	return &models.AuditTrailResponse{
		RunID:     runID,
		TenantID:  tenantID,
		TotalLogs: len(logs),
		Logs:      logs,
	}, nil
}

// CleanupExpired deletes audit logs older than retentionDays.
func (r *Repository) CleanupExpired(ctx context.Context, tenantID string, retentionDays int) (int64, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM pipeline_audit_logs
		 WHERE tenant_id=$1 AND created_at < NOW() - INTERVAL '1 day' * $2`,
		tenantID, retentionDays)
	if err != nil {
		return 0, err
	}
	n, _ := result.RowsAffected()
	return n, nil
}

// addFilter appends an equality filter if the pointer is non-nil and non-empty.
func addFilter(where string, args []interface{}, idx int, val *string, column string) (string, []interface{}, int) {
	if val != nil && *val != "" {
		where += fmt.Sprintf(" AND %s = $%d", column, idx)
		args = append(args, *val)
		idx++
	}
	return where, args, idx
}

// IsNoRows returns true if the error indicates no rows found.
func IsNoRows(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}
