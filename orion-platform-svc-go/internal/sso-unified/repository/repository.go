package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/sso-unified/models"

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

func (r *Repository) Create(ctx context.Context, config *models.SSOConfig) error {
	config.ID = uuid.New().String()
	config.CreatedAt = time.Now().UTC()

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO sso_configs (id, tenant_id, provider, enabled, config, created_at)
		VALUES (:id, :tenantId, :provider, :enabled, :config, :createdAt)
	`, config)
	return err
}

func (r *Repository) GetByProvider(ctx context.Context, tenantID, provider string) (*models.SSOConfig, error) {
	var config models.SSOConfig
	err := r.db.GetContext(ctx, &config, `SELECT * FROM sso_configs WHERE tenant_id = $1 AND provider = $2`, tenantID, provider)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &config, nil
}

func (r *Repository) GetAll(ctx context.Context, tenantID string) ([]models.SSOConfig, error) {
	var configs []models.SSOConfig
	err := r.db.SelectContext(ctx, &configs, `SELECT * FROM sso_configs WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	return configs, err
}

func (r *Repository) Update(ctx context.Context, tenantID, provider string, updates map[string]interface{}) (*models.SSOConfig, error) {
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

	args = append(args, tenantID, provider)

	_, err := r.db.ExecContext(ctx, fmt.Sprintf(`
		UPDATE sso_configs SET %s WHERE tenant_id = $%d AND provider = $%d
	`, setClauses, len(args)-1, len(args)), args...)
	if err != nil {
		return nil, err
	}

	return r.GetByProvider(ctx, tenantID, provider)
}

func (r *Repository) Delete(ctx context.Context, tenantID, provider string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM sso_configs WHERE tenant_id = $1 AND provider = $2`, tenantID, provider)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}
