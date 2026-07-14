package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/cost-allocation/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Allocations ---

func (r *Repository) CreateAllocation(ctx context.Context, a *models.Allocation) error {
	a.ID = uuid.New().String()
	a.CreatedAt = time.Now().UTC()
	a.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO cost_allocations (id, tenant_id, name, description, type, status, source_account, allocation_key, allocation_rules, created_by, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :description, :type, :status, :sourceAccount, :allocationKey, :allocationRules, :createdBy, :createdAt, :updatedAt)`,
		a)
	return err
}

func (r *Repository) GetAllocationByID(ctx context.Context, tenantID, id string) (*models.Allocation, error) {
	var a models.Allocation
	err := r.db.GetContext(ctx, &a,
		`SELECT * FROM cost_allocations WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &a, err
}

func (r *Repository) ListAllocations(ctx context.Context, tenantID string, filter *models.AllocationFilter) ([]models.Allocation, error) {
	where := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2
	if filter != nil {
		if filter.Status != nil && *filter.Status != "" {
			where += fmt.Sprintf(" AND status=$%d", argIdx)
			args = append(args, *filter.Status)
			argIdx++
		}
		if filter.Type != nil && *filter.Type != "" {
			where += fmt.Sprintf(" AND type=$%d", argIdx)
			args = append(args, *filter.Type)
			argIdx++
		}
		if filter.Limit > 0 {
			where += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
			args = append(args, filter.Limit, filter.Offset)
		}
	}
	var items []models.Allocation
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT * FROM cost_allocations %s ORDER BY created_at DESC`, where), args...)
	return items, err
}

func (r *Repository) UpdateAllocation(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Allocation, error) {
	if len(updates) == 0 {
		return nil, ErrNotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	result, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE cost_allocations SET %s WHERE id=$%d AND tenant_id=$%d`,
			strings.Join(setClauses, ", "), i, i+1), args...)
	if err != nil {
		return nil, err
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return nil, ErrNotFound
	}
	return r.GetAllocationByID(ctx, tenantID, id)
}

func (r *Repository) DeleteAllocation(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM cost_allocations WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// --- Rules ---

func (r *Repository) CreateRule(ctx context.Context, rule *models.Rule) error {
	rule.ID = uuid.New().String()
	rule.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO cost_allocation_rules (id, allocation_id, condition_type, condition_value, percentage, target_services, target_tags, created_at)
		 VALUES (:id, :allocationId, :conditionType, :conditionValue, :percentage, :targetServices, :targetTags, :createdAt)`,
		rule)
	return err
}

func (r *Repository) ListRulesByAllocation(ctx context.Context, tenantID, allocationID string) ([]models.Rule, error) {
	var rules []models.Rule
	err := r.db.SelectContext(ctx, &rules,
		`SELECT r.* FROM cost_allocation_rules r
		 JOIN cost_allocations a ON r.allocation_id = a.id
		 WHERE a.tenant_id=$1 AND r.allocation_id=$2
		 ORDER BY r.id`, tenantID, allocationID)
	return rules, err
}

func (r *Repository) DeleteRule(ctx context.Context, tenantID, ruleID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM cost_allocation_rules WHERE id=$1 AND allocation_id IN (SELECT id FROM cost_allocations WHERE tenant_id=$2)`, ruleID, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// --- Reports ---

func (r *Repository) CreateReport(ctx context.Context, report *models.Report) error {
	report.ID = uuid.New().String()
	report.CreatedAt = time.Now().UTC()
	report.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO cost_allocation_reports (id, tenant_id, allocation_id, period_start, period_end, status, started_at, created_at, updated_at)
		 VALUES (:id, :tenantId, :allocationId, :periodStart, :periodEnd, :status, :startedAt, :createdAt, :updatedAt)`,
		report)
	return err
}

func (r *Repository) GetReportByID(ctx context.Context, tenantID, id string) (*models.Report, error) {
	var report models.Report
	err := r.db.GetContext(ctx, &report,
		`SELECT * FROM cost_allocation_reports WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &report, err
}

func (r *Repository) ListReports(ctx context.Context, tenantID string, filter *models.ReportFilter) ([]models.Report, error) {
	where := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2
	if filter != nil {
		if filter.AllocationID != nil && *filter.AllocationID != "" {
			where += fmt.Sprintf(" AND allocation_id=$%d", argIdx)
			args = append(args, *filter.AllocationID)
			argIdx++
		}
		if filter.Status != nil && *filter.Status != "" {
			where += fmt.Sprintf(" AND status=$%d", argIdx)
			args = append(args, *filter.Status)
			argIdx++
		}
		if filter.Limit > 0 {
			where += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
			args = append(args, filter.Limit, filter.Offset)
		}
	}
	var reports []models.Report
	err := r.db.SelectContext(ctx, &reports,
		fmt.Sprintf(`SELECT * FROM cost_allocation_reports %s ORDER BY created_at DESC`, where), args...)
	return reports, err
}

func (r *Repository) UpdateReport(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Report, error) {
	if len(updates) == 0 {
		return nil, ErrNotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	result, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE cost_allocation_reports SET %s WHERE id=$%d AND tenant_id=$%d`,
			strings.Join(setClauses, ", "), i, i+1), args...)
	if err != nil {
		return nil, err
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return nil, ErrNotFound
	}
	return r.GetReportByID(ctx, tenantID, id)
}

func (r *Repository) DeleteReport(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM cost_allocation_reports WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}
