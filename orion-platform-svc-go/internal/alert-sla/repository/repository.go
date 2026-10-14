package repository

import (
	"context"
	"fmt"
	"strings"

	internalrepo "orion/platform-svc-go/internal/repository"
	"orion/platform-svc-go/internal/alert-sla/models"

	"github.com/jmoiron/sqlx"

	baserepo "orion/platform-svc-go/internal/repository")

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
	_, err := r.TenantAwareRepository.Exec(ctx,
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

func (r *Repository) List(ctx context.Context, tenantID string, q *baserepo.ListQuery) ([]models.AlertSLA, int, error) {
	if q == nil {
		q = baserepo.NewListQuery()
	}
	q.Normalize()

	// Build filter whitelist for this domain
	filterWhitelist := map[string]bool{
		"severity": true,
		"enabled": true,
	}

	// Filter out non-whitelisted columns
	cleanFilters := make(map[string]string)
	for k, v := range q.Filters {
		if filterWhitelist[k] {
			cleanFilters[k] = v
		}
	}

	whereStr, args := baserepo.BuildWhereClause(cleanFilters, "name", q.Search)

	// Validate sort field
	sortBy := baserepo.ValidateSortField(q.SortBy, []string{"name", "created_at", "severity", "response_time", "resolve_time"}, "created_at")
	sortDir := q.SortDir
	if sortDir != "asc" && sortDir != "desc" {
		sortDir = "desc"
	}

	var total int
	countArgs := append([]interface{}{}, args...)
	err := r.TenantAwareRepository.Get(ctx, &total,
		fmt.Sprintf(`SELECT COUNT(*) FROM alert_sla WHERE %s`, whereStr), countArgs...)
	if err != nil {
		return nil, 0, err
	}

	offset := (q.Page - 1) * q.PageSize
	listArgs := append([]interface{}{}, args...)
	listArgs = append(listArgs, q.PageSize, offset)

	var rows []models.AlertSLA
	err = r.TenantAwareRepository.Select(ctx, &rows,
		fmt.Sprintf(`SELECT * FROM alert_sla WHERE %s ORDER BY %s %s LIMIT $%d OFFSET $%d`,
			whereStr, sortBy, sortDir, len(args)+1, len(args)+2), listArgs...)
	return rows, total, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}, expectedVersion int) error {
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
	if expectedVersion > 0 {
		args = append(args, expectedVersion)
		_, err := r.TenantAwareRepository.Exec(ctx,
			fmt.Sprintf(`UPDATE alert_sla SET %s, version=version+1, updated_at=NOW() WHERE id=$%d AND tenant_id=$%d AND version=$%d`,
				strings.Join(sets, ", "), i, i+1, i+2), args...)
		return err
	}
	_, err := r.TenantAwareRepository.Exec(ctx,
		fmt.Sprintf(`UPDATE alert_sla SET %s, version=version+1, updated_at=NOW() WHERE id=$%d AND tenant_id=$%d`,
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

// WithTx wraps fn in a database transaction. All repository methods called
// on the tx-scoped Repository share the same *sqlx.Tx.
func (r *Repository) WithTx(ctx context.Context, fn func(rtx *Repository) error) error {
	return r.TenantAwareRepository.WithTx(ctx, func(txTAR internalrepo.TenantAwareRepository[any]) error {
		txRepo := &Repository{
			TenantAwareRepository: txTAR,
		}
		return fn(txRepo)
	})
}
