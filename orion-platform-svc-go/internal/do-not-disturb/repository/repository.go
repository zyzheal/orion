package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/do-not-disturb/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("dnd schedule not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, dnd *models.DoNotDisturb) error {
	dnd.ID = uuid.New().String()
	dnd.CreatedAt = time.Now().UTC()
	if dnd.Timezone == "" {
		dnd.Timezone = "Asia/Shanghai"
	}
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO do_not_disturb (id, tenant_id, user_id, enabled, start_hour, end_hour, timezone, weekdays, created_at)
		VALUES (:id, :tenantId, :userId, :enabled, :startHour, :endHour, :timezone, :weekdays, :createdAt)
	`, dnd)
	return err
}

func (r *Repository) GetByUser(ctx context.Context, tenantID, userID string) (*models.DoNotDisturb, error) {
	var dnd models.DoNotDisturb
	err := r.db.GetContext(ctx, &dnd, `SELECT * FROM do_not_disturb WHERE tenant_id = $1 AND user_id = $2`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	return &dnd, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, userID string, updates map[string]interface{}) (*models.DoNotDisturb, error) {
	if len(updates) == 0 {
		return nil, ErrNotFound
	}
	setClauses := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	idx := 1
	for k, v := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, idx))
		args = append(args, v)
		idx++
	}
	args = append(args, tenantID, userID)
	_, err := r.db.ExecContext(ctx, fmt.Sprintf(`
		UPDATE do_not_disturb SET %s WHERE tenant_id = $%d AND user_id = $%d
	`, setClauses, len(args)-1, len(args)), args...)
	if err != nil {
		return nil, err
	}
	return r.GetByUser(ctx, tenantID, userID)
}

func (r *Repository) IsDNDActive(ctx context.Context, tenantID, userID string) (bool, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `
		SELECT COUNT(*) FROM do_not_disturb
		WHERE tenant_id = $1 AND user_id = $2 AND enabled = true
	`, tenantID, userID)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}