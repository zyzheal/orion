package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/ai-decision/models"

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

func (r *Repository) Create(ctx context.Context, m *models.Decision) error {
	m.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO ai_decision (id, tenant_id, context, choice, confidence, status, created_by, created_at, updated_at) VALUES (:id, :tenant_id, :context, :choice, :confidence, :status, :created_by, NOW(), NOW())`,
		m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Decision, error) {
	var m models.Decision
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM ai_decision WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.ListDecisionsQuery) ([]models.Decision, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	var args []interface{}
	idx := 1
	where := fmt.Sprintf("tenant_id=$%d", idx)
	args = append(args, tenantID)
	idx++
	if q.Status != "" {
		where += fmt.Sprintf(" AND status=$%d", idx)
		args = append(args, q.Status)
		idx++
	}
	where += " AND deleted_at IS NULL"
	query := fmt.Sprintf("SELECT * FROM ai_decision WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", where, idx, idx+1)
	args = append(args, q.Limit, q.Offset)
	var items []models.Decision
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) Count(ctx context.Context, tenantID string, q models.ListDecisionsQuery) (int, error) {
	var args []interface{}
	idx := 1
	where := fmt.Sprintf("tenant_id=$%d", idx)
	args = append(args, tenantID)
	idx++
	if q.Status != "" {
		where += fmt.Sprintf(" AND status=$%d", idx)
		args = append(args, q.Status)
		idx++
	}
	where += " AND deleted_at IS NULL"
	query := fmt.Sprintf("SELECT COUNT(*) FROM ai_decision WHERE %s", where)
	var count int
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	sql := `UPDATE ai_decision SET choice = :choice, confidence = :confidence, status = :status, updated_by = :updated_by, updated_at = NOW() WHERE id=$1 AND tenant_id=$2`
	args := map[string]interface{}{
		"id":        id,
		"tenant_id": tenantID,
	}
	for k, v := range updates {
		args[k] = v
	}
	_, err := r.db.NamedExecContext(ctx, sql, args)
	return err
}

func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.DecisionStats, error) {
	stats := &models.DecisionStats{ByStatus: make(map[string]int), ByChoice: make(map[string]int)}

	err := r.db.GetContext(ctx, stats,
		`SELECT COUNT(*) as total, COALESCE(AVG(confidence),0) as avg_confidence FROM ai_decision WHERE tenant_id=$1 AND deleted_at IS NULL`, tenantID)
	if err != nil {
		return nil, err
	}

	var statusCounts []map[string]interface{}
	err = r.db.SelectContext(ctx, &statusCounts,
		`SELECT status, COUNT(*) as count FROM ai_decision WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY status`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range statusCounts {
		stats.ByStatus[row["status"].(string)] = int(row["count"].(int64))
	}

	var choiceCounts []map[string]interface{}
	err = r.db.SelectContext(ctx, &choiceCounts,
		`SELECT choice, COUNT(*) as count FROM ai_decision WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY choice`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range choiceCounts {
		stats.ByChoice[row["choice"].(string)] = int(row["count"].(int64))
	}

	return stats, nil
}
