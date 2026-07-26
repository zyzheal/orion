package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/google/uuid"

	"orion/ci-cd-svc-go/internal/pipeline/models"
)

// AuditLogRepository handles database operations for audit logs.
type AuditLogRepository struct {
	db *sqlx.DB
}

func NewAuditLogRepository(db *sqlx.DB) *AuditLogRepository {
	return &AuditLogRepository{db: db}
}

// Create inserts a single audit log entry.
func (r *AuditLogRepository) Create(ctx context.Context, log *models.AuditLog) error {
	if log.ID == "" {
		log.ID = uuid.New().String()
	}
	detailsJSON := "{}"
	if log.Details != "" {
		detailsJSON = log.Details
	}
	query := `
		INSERT INTO pipeline_audit_logs (id, tenant_id, pipeline_id, run_id, action, actor, target, target_type, details, ip_address, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING created_at
	`
	err := r.db.QueryRowContext(ctx, query,
		log.ID, log.TenantID, log.PipelineID, log.RunID, log.Action, log.Actor,
		log.Target, log.TargetType, detailsJSON, log.IPAddress, log.UserAgent,
	).Scan(&log.CreatedAt)
	return err
}

// BatchCreate inserts multiple audit log entries in a single transaction.
func (r *AuditLogRepository) BatchCreate(ctx context.Context, logs []models.AuditLog) error {
	if len(logs) == 0 {
		return nil
	}

	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO pipeline_audit_logs (id, tenant_id, pipeline_id, run_id, action, actor, target, target_type, details, ip_address, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for i := range logs {
		l := &logs[i]
		if l.ID == "" {
			l.ID = uuid.New().String()
		}
		detailsJSON := "{}"
		if l.Details != "" {
			detailsJSON = l.Details
		}
		if _, err := stmt.ExecContext(ctx,
			l.ID, l.TenantID, l.PipelineID, l.RunID, l.Action, l.Actor,
			l.Target, l.TargetType, detailsJSON, l.IPAddress, l.UserAgent,
		); err != nil {
			return fmt.Errorf("failed to insert audit log %s: %w", l.Action, err)
		}
	}

	return tx.Commit()
}

// List returns audit logs matching the given filter.
func (r *AuditLogRepository) List(ctx context.Context, filter models.AuditLogFilter) ([]models.AuditLog, int, error) {
	where := []string{"tenant_id = :tenant_id"}
	args := map[string]any{"tenant_id": filter.TenantID}

	if filter.PipelineID != "" {
		where = append(where, "pipeline_id = :pipeline_id")
		args["pipeline_id"] = filter.PipelineID
	}
	if filter.RunID != "" {
		where = append(where, "run_id = :run_id")
		args["run_id"] = filter.RunID
	}
	if filter.Actor != "" {
		where = append(where, "actor = :actor")
		args["actor"] = filter.Actor
	}
	if filter.Action != "" {
		where = append(where, "action = :action")
		args["action"] = filter.Action
	}
	if filter.StartTime != "" {
		where = append(where, "created_at >= :start_time")
		args["start_time"] = filter.StartTime
	}
	if filter.EndTime != "" {
		where = append(where, "created_at <= :end_time")
		args["end_time"] = filter.EndTime
	}

	whereClause := strings.Join(where, " AND ")
	limit := filter.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	// Count
	countQuery := "SELECT COUNT(*) FROM pipeline_audit_logs WHERE " + whereClause
	namedCount, err := r.db.PrepareNamedContext(ctx, countQuery)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to prepare count query: %w", err)
	}
	var total int
	if err := namedCount.GetContext(ctx, &total, args); err != nil {
		return nil, 0, fmt.Errorf("failed to count audit logs: %w", err)
	}

	// Query
	query := "SELECT id, tenant_id, pipeline_id, run_id, action, actor, target, target_type, details, ip_address, user_agent, created_at FROM pipeline_audit_logs WHERE " + whereClause + " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
	args["limit"] = limit
	args["offset"] = offset

	namedQuery, err := r.db.PrepareNamedContext(ctx, query)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to prepare query: %w", err)
	}

	var logs []models.AuditLog
	if err := namedQuery.SelectContext(ctx, &logs, args); err != nil {
		return nil, 0, fmt.Errorf("failed to list audit logs: %w", err)
	}

	if logs == nil {
		logs = []models.AuditLog{}
	}
	return logs, total, nil
}

// GetTrail returns audit trail entries with enhanced context for a specific pipeline or run.
func (r *AuditLogRepository) GetTrail(ctx context.Context, tenantID, pipelineID, runID string, limit, offset int) ([]models.AuditTrailEntry, int, error) {
	where := []string{"al.tenant_id = $1"}
	args := []any{tenantID}
	argIdx := 2

	if pipelineID != "" {
		where = append(where, fmt.Sprintf("al.pipeline_id = $%d", argIdx))
		args = append(args, pipelineID)
		argIdx++
	}
	if runID != "" {
		where = append(where, fmt.Sprintf("al.run_id = $%d", argIdx))
		args = append(args, runID)
		argIdx++
	}

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	whereClause := strings.Join(where, " AND ")

	// Count
	var total int
	countQuery := "SELECT COUNT(*) FROM pipeline_audit_logs al WHERE " + whereClause
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, fmt.Errorf("failed to count trail: %w", err)
	}

	// Query with optional pipeline name join
	trailQuery := fmt.Sprintf(`
		SELECT al.id, al.tenant_id, al.pipeline_id, al.run_id, al.action, al.actor,
			al.target, al.target_type, al.details, al.ip_address, al.user_agent, al.created_at,
			COALESCE(p.name, '') AS actor_name
		FROM pipeline_audit_logs al
		LEFT JOIN pipelines p ON al.pipeline_id = p.id
		WHERE %s
		ORDER BY al.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	var entries []models.AuditTrailEntry
	if err := r.db.SelectContext(ctx, &entries, trailQuery, args...); err != nil {
		return nil, 0, fmt.Errorf("failed to get audit trail: %w", err)
	}

	if entries == nil {
		entries = []models.AuditTrailEntry{}
	}
	return entries, total, nil
}

// Cleanup deletes audit logs older than the specified timestamp.
func (r *AuditLogRepository) Cleanup(ctx context.Context, tenantID string, before string) (int64, error) {
	result, err := r.db.ExecContext(ctx,
		"DELETE FROM pipeline_audit_logs WHERE tenant_id = $1 AND created_at < $2", tenantID, before)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup audit logs: %w", err)
	}
	return result.RowsAffected()
}

// marshalDetails converts a map to a JSON string for storage.
func marshalDetails(details map[string]any) string {
	if details == nil {
		return "{}"
	}
	b, err := json.Marshal(details)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// UnmarshalDetails converts a JSON string to a map for display.
func UnmarshalDetails(details string) map[string]any {
	if details == "" {
		return map[string]any{}
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(details), &m); err != nil {
		return map[string]any{}
	}
	return m
}