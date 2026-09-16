package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/ai/gateway/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, tenantID string, resp *models.GatewayResponse) (*models.GatewayResponse, error) {
	resp.ID = uuid.New().String()
	// The placeholders name the db tag, not the json tag, and the tenant comes
	// from the request context rather than the request body. Before this the
	// statement bound :tenantId, :latencyMs and :createdAt — the json tags —
	// to nothing, so POST /ai-gateway failed every request with "could not find
	// name tenantId", and the tenantID parameter was never used at all: the
	// NOT NULL tenant column would have been written as the empty string.
	resp.TenantID = tenantID
	_, err := r.db.NamedExecContext(ctx,
		"INSERT INTO ai_gateway_requests (id, tenant_id, model, provider, input, output, tokens, latency_ms, created_at) VALUES (:id, :tenant_id, :model, :provider, :input, :output, :tokens, :latency_ms, :created_at)",
		resp)
	return resp, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.GatewayResponse, error) {
	var resp models.GatewayResponse
	err := r.db.GetContext(ctx, &resp, "SELECT * FROM ai_gateway_requests WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &resp, err
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.GatewayResponse, int, error) {
	where := "tenant_id = $1"
	args := []interface{}{tenantID}
	idx := 2
	if q.Provider != "" {
		// The index is a number, not a rune, and it carries no trailing "s".
		// The old " AND provider = $" + string(rune(idx)) + "s" emitted U+0002
		// (STX) rather than the digit "2" and then the stray "s", so the query
		// read " AND provider = $\x02s" and GET /ai-gateway?provider=...
		// answered 500 for every filtered request.
		where += fmt.Sprintf(" AND provider = $%d", idx)
		args = append(args, q.Provider)
		idx++
	}
	limit := 20
	if q.Limit > 0 {
		limit = q.Limit
	}
	args = append(args, limit)

	// COUNT reuses the where clause but not the LIMIT, so it takes every arg
	// except the trailing limit. Its error must propagate: all four list routes
	// answer {"data": items, "total": total}, so swallowing it would report
	// total: 0 while still returning rows.
	var total int
	if err := r.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM ai_gateway_requests WHERE "+where, args[:len(args)-1]...); err != nil {
		return nil, 0, err
	}
	itemsQuery := fmt.Sprintf("SELECT * FROM ai_gateway_requests WHERE %s ORDER BY created_at DESC LIMIT $%d", where, len(args))
	var items []models.GatewayResponse
	err := r.db.SelectContext(ctx, &items, itemsQuery, args...)
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
