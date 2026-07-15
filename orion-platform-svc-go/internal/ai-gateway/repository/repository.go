package repository

import (
	"context"
	"database/sql"
	"errors"

	"orion/platform-svc-go/internal/ai-gateway/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("gateway request not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, tenantID string, resp *models.GatewayResponse) (*models.GatewayResponse, error) {
	resp.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		"INSERT INTO ai_gateway_requests (id, tenant_id, model, provider, input, output, tokens, latency_ms, created_at) VALUES (:id, :tenantId, :model, :provider, :input, :output, :tokens, :latencyMs, :createdAt)",
		resp)
	return resp, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.GatewayResponse, error) {
	var resp models.GatewayResponse
	err := r.db.GetContext(ctx, &resp, "SELECT * FROM ai_gateway_requests WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &resp, err
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.GatewayResponse, int, error) {
	where := "tenant_id = $1"
	args := []interface{}{tenantID}
	idx := 2
	if q.Provider != "" {
		where += " AND provider = $" + string(rune(idx)) + "s"
		args = append(args, q.Provider)
	}
	limit := 20
	if q.Limit > 0 {
		limit = q.Limit
	}
	args = append(args, limit)
	var total int
	r.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM ai_gateway_requests WHERE "+where, args[:len(args)-1]...)
	var items []models.GatewayResponse
	err := r.db.SelectContext(ctx, &items, "SELECT * FROM ai_gateway_requests WHERE "+where+" ORDER BY created_at DESC LIMIT $"+string(rune(len(args))), args...)
	return items, total, err
}

func (r *Repository) EnsureTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS ai_gateway_requests (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id VARCHAR(255) NOT NULL,
			model VARCHAR(255) NOT NULL,
			provider VARCHAR(255),
			input TEXT NOT NULL,
			output TEXT,
			tokens INTEGER DEFAULT 0,
			latency_ms BIGINT DEFAULT 0,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		)
	`)
	return err
}
