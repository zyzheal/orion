package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/api-consumption/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Consumption ---

func (r *Repository) CreateConsumption(ctx context.Context, cons *models.Consumption) error {
	cons.ID = uuid.New().String()
	cons.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO api_consumptions (id, tenant_id, api_key_id, endpoint_path, method, request_count, error_count, bytes_transferred, date, created_at)
		 VALUES (:id, :tenantId, :apiKeyId, :endpointPath, :method, :requestCount, :errorCount, :bytesTransferred, :date, :createdAt)`,
		cons)
	return err
}

func (r *Repository) ListConsumptions(ctx context.Context, tenantID string, filter *models.ConsumptionFilter) ([]models.Consumption, error) {
	where := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.APIKeyID != nil && *filter.APIKeyID != "" {
			where += fmt.Sprintf(" AND api_key_id=$%d", argIdx)
			args = append(args, *filter.APIKeyID)
			argIdx++
		}
		if filter.EndpointPath != nil && *filter.EndpointPath != "" {
			where += fmt.Sprintf(" AND endpoint_path=$%d", argIdx)
			args = append(args, *filter.EndpointPath)
			argIdx++
		}
		if filter.Method != nil && *filter.Method != "" {
			where += fmt.Sprintf(" AND method=$%d", argIdx)
			args = append(args, *filter.Method)
			argIdx++
		}
		if filter.DateFrom != nil && *filter.DateFrom != "" {
			where += fmt.Sprintf(" AND date>=$%d", argIdx)
			args = append(args, *filter.DateFrom)
			argIdx++
		}
		if filter.DateTo != nil && *filter.DateTo != "" {
			where += fmt.Sprintf(" AND date<=$%d", argIdx)
			args = append(args, *filter.DateTo)
			argIdx++
		}
		if filter.Limit > 0 {
			where += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
			args = append(args, filter.Limit, filter.Offset)
		}
	}

	var cons []models.Consumption
	err := r.db.SelectContext(ctx, &cons,
		fmt.Sprintf(`SELECT * FROM api_consumptions %s ORDER BY date DESC`, where), args...)
	return cons, err
}

// --- Limits ---

func (r *Repository) CreateLimit(ctx context.Context, limit *models.Limit) error {
	limit.ID = uuid.New().String()
	limit.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO usage_limits (id, tenant_id, api_key_id, endpoint_path, method, limit_count, period, limit_amount, limit_bytes, created_at)
		 VALUES (:id, :tenantId, :apiKeyId, :endpointPath, :method, :limitCount, :period, :limitAmount, :limitBytes, :createdAt)`,
		limit)
	return err
}

func (r *Repository) GetLimitByID(ctx context.Context, tenantID, id string) (*models.Limit, error) {
	var l models.Limit
	err := r.db.GetContext(ctx, &l,
		`SELECT * FROM usage_limits WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &l, err
}

func (r *Repository) ListLimits(ctx context.Context, tenantID string) ([]models.Limit, error) {
	var limits []models.Limit
	err := r.db.SelectContext(ctx, &limits,
		`SELECT * FROM usage_limits WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return limits, err
}

func (r *Repository) UpdateLimit(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Limit, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	clauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		clauses = append(clauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE usage_limits SET %s WHERE id=$%d AND tenant_id=$%d`,
			joinSetClauses(clauses), i, i+1), args...)
	if err != nil {
		return nil, err
	}
	return r.GetLimitByID(ctx, tenantID, id)
}

func (r *Repository) DeleteLimit(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM usage_limits WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// --- Stats ---

func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.ConsumptionStats, error) {
	stats := &models.ConsumptionStats{}

	err := r.db.GetContext(ctx, &stats.TotalRequests,
		`SELECT COALESCE(SUM(request_count), 0) FROM api_consumptions WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.TotalErrors,
		`SELECT COALESCE(SUM(error_count), 0) FROM api_consumptions WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.TotalBytes,
		`SELECT COALESCE(SUM(bytes_transferred), 0) FROM api_consumptions WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	// Error rate
	err = r.db.GetContext(ctx, &stats.ErrorRate,
		`SELECT CASE WHEN SUM(request_count) > 0 THEN ROUND(100.0 * SUM(error_count) / SUM(request_count), 2) ELSE 0 END FROM api_consumptions WHERE tenant_id=$1`, tenantID)

	return stats, err
}

func joinSetClauses(clauses []string) string {
	return strings.Join(clauses, ", ")
}
