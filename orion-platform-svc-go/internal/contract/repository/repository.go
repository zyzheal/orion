package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/contract/models"

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

// --- Contract ---

func (r *Repository) CreateContract(ctx context.Context, contract *models.Contract) error {
	contract.ID = uuid.New().String()
	contract.CreatedAt = time.Now().UTC()
	contract.UpdatedAt = time.Now().UTC()
	contract.Status = "draft"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO api_contracts (id, tenant_id, name, description, version, status, created_by, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :description, :version, :status, :createdBy, :createdAt, :updatedAt)`,
		contract)
	return err
}

func (r *Repository) GetContractByID(ctx context.Context, tenantID, id string) (*models.Contract, error) {
	var c models.Contract
	err := r.db.GetContext(ctx, &c,
		`SELECT * FROM api_contracts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &c, err
}

func (r *Repository) ListContracts(ctx context.Context, tenantID string, filter *models.ContractFilter) ([]models.Contract, error) {
	where := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.Status != nil && *filter.Status != "" {
			where += fmt.Sprintf(" AND status=$%d", argIdx)
			args = append(args, *filter.Status)
			argIdx++
		}
		if filter.Version != nil && *filter.Version != "" {
			where += fmt.Sprintf(" AND version=$%d", argIdx)
			args = append(args, *filter.Version)
			argIdx++
		}
		if filter.Limit > 0 {
			where += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
			args = append(args, filter.Limit, filter.Offset)
		}
	}

	var contracts []models.Contract
	err := r.db.SelectContext(ctx, &contracts,
		fmt.Sprintf(`SELECT * FROM api_contracts %s ORDER BY created_at DESC`, where), args...)
	return contracts, err
}

func (r *Repository) UpdateContract(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Contract, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()
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
		fmt.Sprintf(`UPDATE api_contracts SET %s WHERE id=$%d AND tenant_id=$%d`,
			joinSetClauses(clauses), i, i+1), args...)
	if err != nil {
		return nil, err
	}
	return r.GetContractByID(ctx, tenantID, id)
}

func (r *Repository) DeleteContract(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM api_contracts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// --- Endpoint ---

func (r *Repository) CreateEndpoint(ctx context.Context, endpoint *models.Endpoint) error {
	endpoint.ID = uuid.New().String()
	endpoint.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO contract_endpoints (id, contract_id, path, method, summary, request_schema, response_schema, auth_required, created_at)
		 VALUES (:id, :contractId, :path, :method, :summary, :requestSchema, :responseSchema, :authRequired, :createdAt)`,
		endpoint)
	return err
}

func (r *Repository) ListEndpointsByContract(ctx context.Context, tenantID, contractID string) ([]models.Endpoint, error) {
	var endpoints []models.Endpoint
	err := r.db.SelectContext(ctx, &endpoints,
		`SELECT ce.* FROM contract_endpoints ce
		 JOIN api_contracts ac ON ce.contract_id = ac.id
		 WHERE ac.tenant_id=$1 AND ce.contract_id=$2
		 ORDER BY ce.id`, tenantID, contractID)
	return endpoints, err
}

func (r *Repository) DeleteEndpoint(ctx context.Context, tenantID, contractID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM contract_endpoints
		 WHERE id=$1
		 AND contract_id IN (SELECT id FROM api_contracts WHERE id=$2 AND tenant_id=$3)`, id, contractID, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// --- Stats ---

func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.ContractStats, error) {
	stats := &models.ContractStats{}

	err := r.db.GetContext(ctx, &stats.TotalContracts,
		`SELECT COUNT(*) FROM api_contracts WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.PublishedCount,
		`SELECT COUNT(*) FROM api_contracts WHERE tenant_id=$1 AND status='published'`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.DraftCount,
		`SELECT COUNT(*) FROM api_contracts WHERE tenant_id=$1 AND status='draft'`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.DeprecatedCount,
		`SELECT COUNT(*) FROM api_contracts WHERE tenant_id=$1 AND status='deprecated'`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.TotalEndpoints,
		`SELECT COUNT(*) FROM contract_endpoints ce
		 JOIN api_contracts ac ON ce.contract_id = ac.id
		 WHERE ac.tenant_id=$1`, tenantID)

	return stats, err
}

func joinSetClauses(clauses []string) string {
	return strings.Join(clauses, ", ")
}
