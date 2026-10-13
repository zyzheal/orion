package repository

import (
	"context"
	"fmt"
	"strings"

	internalrepo "orion/platform-svc-go/internal/repository"
	"orion/platform-svc-go/internal/alert-sla/models"

	"github.com/jmoiron/sqlx"
)

var allowedSLAColumns = map[string]bool{
	"name": true, "severity": true, "response_time": true,
	"resolve_time": true, "escalation_delay": true, "enabled": true,
}

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

func (r *Repository) Create(ctx context.Context, item *models.AlertSLA) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO alert_sla (id, tenant_id, name, severity, response_time, resolve_time, escalation_delay, enabled, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())`,
		item.ID, item.TenantID, item.Name, item.Severity, item.ResponseTime,
		item.ResolveTime, item.EscalationDelay, item.Enabled)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.AlertSLA, error) {
	var row models.AlertSLA
	err := r.TenantAwareRepository.Get(ctx, &row,
		`SELECT * FROM alert_sla WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.AlertSLA, error) {
	var rows []models.AlertSLA
	err := r.TenantAwareRepository.Select(ctx, &rows,
		`SELECT * FROM alert_sla ORDER BY created_at DESC`)
	return rows, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return fmt.Errorf("no fields to update")
	}
	sets := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	i := 1
	for k, v := range updates {
		if !allowedSLAColumns[k] {
			return fmt.Errorf("column %q is not allowed in update", k)
		}
		sets = append(sets, fmt.Sprintf("%s=$%d", k, i))
		args = append(args, v)
		i++
	}
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE alert_sla SET %s, updated_at=NOW() WHERE id=$%d AND tenant_id=$%d`,
			strings.Join(sets, ", "), i, i+1), args...)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.TenantAwareRepository.Exec(ctx,
		`DELETE FROM alert_sla WHERE id=$1`, id)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}
