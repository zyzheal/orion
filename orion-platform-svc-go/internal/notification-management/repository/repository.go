package repository

import (
	internalrepo "orion/platform-svc-go/internal/repository"
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/notification-management/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	internalrepo.TenantAwareRepository[any]
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{
		TenantAwareRepository: internalrepo.NewTenantAwareRepository(db),
		db:                    db,
	}
}

func (r *Repository) Create(ctx context.Context, m *models.NotificationManagement) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = m.CreatedAt
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO notification_management (id, tenant_id, name, value, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :value, :enabled, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.NotificationManagement, error) {
	var m models.NotificationManagement
	err := r.db.GetContext(ctx, &m, `SELECT * FROM notification_management WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.NotificationManagement, error) {
	var items []models.NotificationManagement
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM notification_management WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.NotificationManagement, error) {
	if len(updates) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}
	setParts := make([]string, 0, len(updates)+1)
	args := make([]interface{}, 0, len(updates)+3)
	idx := 1
	for k, v := range updates {
		setParts = append(setParts, k+" = $"+strconv.Itoa(idx))
		args = append(args, v)
		idx++
	}
	setParts = append(setParts, "updated_at = $"+strconv.Itoa(idx))
	args = append(args, time.Now().UTC())
	idx++
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx,
		"UPDATE notification_management SET "+strings.Join(setParts, ", ")+
			" WHERE id = $"+strconv.Itoa(idx-2)+" AND tenant_id = $"+strconv.Itoa(idx-1),
		args...,
	)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM notification_management WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// DeleteByTenantID hard-deletes every notification-management row owned by
// tenantID and returns the row count. Idempotent: a second call returns
// (0, nil). Used by ADR-011 §4 GDPR / 租户退租 data-subject-deletion path
// (GATE-P0-DELETE-BY-TENANT).
func (r *Repository) DeleteByTenantID(ctx context.Context, tenantID string) (int64, error) {
	if tenantID == "" {
		return 0, fmt.Errorf("tenantID is required")
	}
	res, err := r.db.ExecContext(ctx, `DELETE FROM notification_management WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return 0, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return 0, err
	}
	return affected, nil
}
