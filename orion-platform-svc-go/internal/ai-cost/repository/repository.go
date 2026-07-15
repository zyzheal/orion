package repository

import (
	"context"
	"database/sql"
	"errors"

	"orion/platform-svc-go/internal/ai-cost/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("cost record not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, tenantID string, record *models.CostRecord) (*models.CostRecord, error) {
	record.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		"INSERT INTO ai_cost_records (id, tenant_id, model_id, prompt_tokens, completion_tokens, cost, created_at) VALUES (:id, :tenantId, :modelId, :promptTokens, :completionTokens, :cost, :createdAt)",
		record)
	return record, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.CostRecord, error) {
	var record models.CostRecord
	err := r.db.GetContext(ctx, &record, "SELECT * FROM ai_cost_records WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &record, err
}

func (r *Repository) List(ctx context.Context, tenantID string, f models.CostFilter) ([]models.CostRecord, error) {
	query := "SELECT * FROM ai_cost_records WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	idx := 2
	if f.ModelID != "" {
		query += " AND model_id = $" + string(rune(idx)) + "s"
		args = append(args, f.ModelID)
		idx++
	}
	query += " ORDER BY created_at DESC"
	var records []models.CostRecord
	err := r.db.SelectContext(ctx, &records, query, args...)
	return records, err
}

func (r *Repository) GetSummary(ctx context.Context, tenantID string, f models.CostFilter) (*models.CostSummary, error) {
	var s models.CostSummary
	err := r.db.GetContext(ctx, &s,
		"SELECT SUM(cost) as total_cost, COUNT(*) as total_requests FROM ai_cost_records WHERE tenant_id=$1", tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return &s, nil
		}
		return nil, err
	}
	if s.TotalRequests > 0 {
		s.AvgCost = s.TotalCost / float64(s.TotalRequests)
	}
	var byModel []struct {
		Model string  `db:"model_id"`
		Cost  float64 `db:"cost_sum"`
	}
	r.db.SelectContext(ctx, &byModel, "SELECT model_id, SUM(cost) as cost_sum FROM ai_cost_records WHERE tenant_id=$1 GROUP BY model_id", tenantID)
	s.ByModel = make(map[string]float64)
	for _, m := range byModel {
		s.ByModel[m.Model] = m.Cost
	}
	var byDate []struct {
		Date string  `db:"date"`
		Cost float64 `db:"cost_sum"`
	}
	r.db.SelectContext(ctx, &byDate, "SELECT DATE(created_at) as date, SUM(cost) as cost_sum FROM ai_cost_records WHERE tenant_id=$1 GROUP BY DATE(created_at) ORDER BY date", tenantID)
	s.ByDate = make(map[string]float64)
	for _, d := range byDate {
		s.ByDate[d.Date] = d.Cost
	}
	return &s, nil
}

func (r *Repository) EnsureTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS ai_cost_records (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id VARCHAR(255) NOT NULL,
			model_id VARCHAR(255) NOT NULL,
			prompt_tokens BIGINT NOT NULL DEFAULT 0,
			completion_tokens BIGINT NOT NULL DEFAULT 0,
			cost DECIMAL(12,6) NOT NULL DEFAULT 0,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		)
	`)
	return err
}
