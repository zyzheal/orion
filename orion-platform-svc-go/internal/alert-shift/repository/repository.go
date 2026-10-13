package repository

import (
	"context"
	"fmt"
	"strings"

	internalrepo "orion/platform-svc-go/internal/repository"
	"orion/platform-svc-go/internal/alert-shift/models"

	"github.com/jmoiron/sqlx"
)

// allowedShiftColumns is the whitelist of columns that UpdateShift may modify.
// This prevents SQL injection via map key injection.
var allowedShiftColumns = map[string]bool{
	"name": true, "team": true, "pattern": true,
	"start_time": true, "end_time": true, "weekdays": true, "enabled": true,
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

func (r *Repository) CreateShift(ctx context.Context, s *models.Shift) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO alert_shifts (id, tenant_id, name, team, pattern, start_time, end_time, weekdays, enabled, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())`,
		s.ID, s.TenantID, s.Name, s.Team, s.Pattern, s.StartTime, s.EndTime, s.Weekdays, s.Enabled)
	return err
}

func (r *Repository) GetShift(ctx context.Context, tenantID, id string) (*models.Shift, error) {
	var row models.Shift
	err := r.TenantAwareRepository.Get(ctx, &row,
		`SELECT * FROM alert_shifts WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) ListShifts(ctx context.Context, tenantID string) ([]models.Shift, error) {
	var rows []models.Shift
	err := r.TenantAwareRepository.Select(ctx, &rows,
		`SELECT * FROM alert_shifts ORDER BY created_at DESC`)
	return rows, err
}

func (r *Repository) UpdateShift(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return fmt.Errorf("no fields to update")
	}
	sets := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	i := 1
	for k, v := range updates {
		if !allowedShiftColumns[k] {
			return fmt.Errorf("column %q is not allowed in update", k)
		}
		sets = append(sets, fmt.Sprintf("%s=$%d", k, i))
		args = append(args, v)
		i++
	}
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE alert_shifts SET %s, updated_at=NOW() WHERE id=$%d AND tenant_id=$%d`,
			strings.Join(sets, ", "), i, i+1), args...)
	return err
}

func (r *Repository) DeleteShift(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.TenantAwareRepository.Exec(ctx,
		`DELETE FROM alert_shifts WHERE id=$1`, id)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// CreateAssignment inserts a shift assignment with tenant_id.
func (r *Repository) CreateAssignment(ctx context.Context, a *models.Assignment) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO alert_shift_assignments (id, tenant_id, shift_id, user_id, role, start_time, end_time, assigned, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
		a.ID, a.TenantID, a.ShiftID, a.UserID, a.Role, a.StartTime, a.EndTime, a.Assigned)
	return err
}

// ListAssignments returns assignments for a shift, tenant-scoped.
func (r *Repository) ListAssignments(ctx context.Context, tenantID, shiftID string) ([]models.Assignment, error) {
	var rows []models.Assignment
	err := r.TenantAwareRepository.Select(ctx, &rows,
		`SELECT * FROM alert_shift_assignments WHERE shift_id=$1 ORDER BY start_time ASC`, shiftID)
	return rows, err
}
