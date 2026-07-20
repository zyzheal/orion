package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/sso-providers/models"

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

func (r *Repository) Create(ctx context.Context, provider *models.SSOProvider) error {
	provider.ID = uuid.New().String()
	provider.CreatedAt = time.Now().UTC()

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO sso_providers (id, tenant_id, name, type, enabled, config, created_at)
		VALUES (:id, :tenantId, :name, :type, :enabled, :config, :createdAt)
	`, provider)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.SSOProvider, error) {
	var provider models.SSOProvider
	err := r.db.GetContext(ctx, &provider, `SELECT * FROM sso_providers WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &provider, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, filter *models.SSOProviderFilter) ([]models.SSOProvider, int, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.Type != nil {
			where += fmt.Sprintf(" AND type = $%d", argIdx)
			args = append(args, *filter.Type)
			argIdx++
		}
		if filter.Enabled != nil {
			where += fmt.Sprintf(" AND enabled = $%d", argIdx)
			args = append(args, *filter.Enabled)
			argIdx++
		}
	}

	var providers []models.SSOProvider
	err := r.db.SelectContext(ctx, &providers, fmt.Sprintf(`SELECT * FROM sso_providers %s ORDER BY created_at DESC`, where), args...)
	if err != nil {
		return nil, 0, err
	}

	var total int
	err = r.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM sso_providers WHERE tenant_id = $1`, tenantID)
	return providers, total, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.SSOProvider, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}

	setClauses := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	for key, value := range updates {
		idx := len(setClauses) + 1
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, idx))
		args = append(args, value)
	}

	args = append(args, id, tenantID)

	_, err := r.db.ExecContext(ctx, fmt.Sprintf(`
		UPDATE sso_providers SET %s WHERE id = $%d AND tenant_id = $%d
	`, setClauses, len(args)-1, len(args)), args...)
	if err != nil {
		return nil, err
	}

	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM sso_providers WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}
