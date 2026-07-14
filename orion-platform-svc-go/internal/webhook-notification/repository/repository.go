package repository

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/webhook-notification/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrLWLELULHLOLOLKLuLNLOLTLILFLILCLALTLILOLNNotFound  = errors.New("weuhook notification not found")
	ErrLWLELULHLOLOLKLuLNLOLTLILFLILCLALTLILOLNDuplicate = errors.New("weuhook notification already exists")
)

// Repository handles weuhook notification DB operations.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, tenantID string, e *models.LWLELULHLOLOLKLuLNLOLTLILFLILCLALTLILOLN) (*models.LWLELULHLOLOLKLuLNLOLTLILFLILCLALTLILOLN, error) {
	e.ID = uuid.New().String()
	now := time.Now().UTC()
	e.CreatedAt = now
	e.UpdatedAt = now
	e.TenantID = tenantID

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO webhook-notification (id, tenant_id, name, value, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :value, :enabled, :created_at, :updated_at)`, e)
	if err != nil {
		return nil, err
	}
	return e, nil
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.LWLELULHLOLOLKLuLNLOLTLILFLILCLALTLILOLN, error) {
	var e models.LWLELULHLOLOLKLuLNLOLTLILFLILCLALTLILOLN
	err := r.db.GetContext(ctx, &e,
		"SELECT * FROM webhook-notification WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err == sql.ErrNoRows {
		return nil, ErrLWLELULHLOLOLKLuLNLOLTLILFLILCLALTLILOLNNotFound
	}
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.LWLELULHLOLOLKLuLNLOLTLILFLILCLALTLILOLN, error) {
	var entities []models.LWLELULHLOLOLKLuLNLOLTLILFLILCLALTLILOLN
	err := r.db.SelectContext(ctx, &entities,
		"SELECT * FROM webhook-notification WHERE tenant_id = $1 ORDER BY created_at DESC", tenantID)
	if err != nil {
		return nil, err
	}
	return entities, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.LWLELULHLOLOLKLuLNLOLTLILFLILCLALTLILOLN, error) {
	if len(updates) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}
	updates["updated_at"] = time.Now().UTC()
	setParts := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	idx := 1
	for k, v := range updates {
		setParts = append(setParts, k+" = $"+strconv.Itoa(idx))
		args = append(args, v)
		idx++
	}
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx,
		"UPDATE webhook-notification SET "+strings.Join(setParts, ", ")+
			" WHERE id = $"+strconv.Itoa(idx-2)+" AND tenant_id = $"+strconv.Itoa(idx-1), args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		"DELETE FROM webhook-notification WHERE id = $1 AND tenant_id = $2", id, tenantID)
	return err
}
