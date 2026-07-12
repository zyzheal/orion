package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/multi-cloud/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- CloudAccount CRUD ---

func (r *Repository) CreateAccount(ctx context.Context, account *models.CloudAccount) error {
	account.ID = uuid.New().String()
	account.CreatedAt = time.Now().UTC()
	account.UpdatedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cloud_accounts (id, tenant_id, account_name, credential_type, credential_ref, region, status, created_by, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		account.ID, account.TenantID, account.AccountName, account.CredentialType,
		account.CredentialRef, account.Region, account.Status, account.CreatedBy,
		account.CreatedAt, account.UpdatedAt)
	return err
}

func (r *Repository) GetAccountByID(ctx context.Context, tenantID, id string) (*models.CloudAccount, error) {
	var account models.CloudAccount
	err := r.db.GetContext(ctx, &account,
		`SELECT * FROM cloud_accounts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &account, nil
}

func (r *Repository) ListAccounts(ctx context.Context, tenantID string) ([]models.CloudAccount, error) {
	var accounts []models.CloudAccount
	err := r.db.SelectContext(ctx, &accounts,
		`SELECT * FROM cloud_accounts WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return accounts, err
}

func (r *Repository) UpdateAccount(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.CloudAccount, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cloud_accounts SET updated_at = NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetAccountByID(ctx, tenantID, id)
}

func (r *Repository) DeleteAccount(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM cloud_accounts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	affected, _ := result.RowsAffected()
	return affected > 0, nil
}

// --- CloudResource ---

func (r *Repository) CreateResource(ctx context.Context, resource *models.CloudResource) error {
	resource.ID = uuid.New().String()
	resource.CreatedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cloud_resources (id, tenant_id, account_id, provider, resource_id, resource_type, region, name, status, monthly_cost, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		resource.ID, resource.TenantID, resource.AccountID, resource.Provider, resource.ResourceID,
		resource.ResourceType, resource.Region, resource.Name, resource.Status,
		resource.MonthlyCost, resource.CreatedAt)
	return err
}

func (r *Repository) ListResources(ctx context.Context, tenantID string) ([]models.CloudResource, error) {
	var resources []models.CloudResource
	err := r.db.SelectContext(ctx, &resources,
		`SELECT * FROM cloud_resources WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return resources, err
}

func (r *Repository) GetResourceByID(ctx context.Context, tenantID, resourceType, resourceID string) (*models.CloudResource, error) {
	var resource models.CloudResource
	err := r.db.GetContext(ctx, &resource,
		`SELECT * FROM cloud_resources WHERE tenant_id=$1 AND resource_type=$2 AND resource_id=$3`,
		tenantID, resourceType, resourceID)
	if err != nil {
		return nil, err
	}
	return &resource, nil
}

func (r *Repository) ListResourcesByAccount(ctx context.Context, tenantID, accountID string) ([]models.CloudResource, error) {
	var resources []models.CloudResource
	if accountID == "" {
		return r.ListResources(ctx, tenantID)
	}
	err := r.db.SelectContext(ctx, &resources,
		`SELECT * FROM cloud_resources WHERE tenant_id=$1 AND account_id=$2 ORDER BY created_at DESC`,
		tenantID, accountID)
	return resources, err
}

// --- SchedulingPolicy ---

func (r *Repository) CreatePolicy(ctx context.Context, policy *models.SchedulingPolicy) error {
	policy.ID = uuid.New().String()
	policy.CreatedAt = time.Now().UTC()
	policy.UpdatedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO scheduling_policies (id, tenant_id, name, strategy, constraints, priority, enabled, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		policy.ID, policy.TenantID, policy.Name, policy.Strategy, policy.Constraints,
		policy.Priority, policy.Enabled, policy.CreatedAt, policy.UpdatedAt)
	return err
}

func (r *Repository) ListPolicies(ctx context.Context, tenantID string) ([]models.SchedulingPolicy, error) {
	var policies []models.SchedulingPolicy
	err := r.db.SelectContext(ctx, &policies,
		`SELECT * FROM scheduling_policies WHERE tenant_id=$1 ORDER BY priority ASC, created_at DESC`, tenantID)
	return policies, err
}

func (r *Repository) GetPolicyByID(ctx context.Context, tenantID, id string) (*models.SchedulingPolicy, error) {
	var policy models.SchedulingPolicy
	err := r.db.GetContext(ctx, &policy,
		`SELECT * FROM scheduling_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &policy, nil
}

// --- MigrationPlan ---

func (r *Repository) CreateMigrationPlan(ctx context.Context, plan *models.MigrationPlan) error {
	plan.ID = uuid.New().String()
	plan.CreatedAt = time.Now().UTC()
	plan.UpdatedAt = time.Now().UTC()
	plan.Status = "created"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO migration_plans (id, tenant_id, name, source_provider, source_region, target_provider, target_region, resources, estimated_cost, estimated_duration, status, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :source_provider, :source_region, :target_provider, :target_region, :resources, :estimated_cost, :estimated_duration, :status, :created_at, :updated_at)`,
		plan)
	return err
}

func (r *Repository) GetMigrationPlanByID(ctx context.Context, tenantID, id string) (*models.MigrationPlan, error) {
	var plan models.MigrationPlan
	err := r.db.GetContext(ctx, &plan,
		`SELECT * FROM migration_plans WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &plan, nil
}

func (r *Repository) UpdateMigrationPlanStatus(ctx context.Context, tenantID, id, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE migration_plans SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		status, id, tenantID)
	return err
}

// --- Helper functions ---

func (r *Repository) CountResources(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM cloud_resources WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) AggregateCosts(ctx context.Context, tenantID string) (*models.CloudStats, error) {
	stats := &models.CloudStats{CalculatedAt: time.Now().UTC()}

	var totalCost float64
	err := r.db.GetContext(ctx, &totalCost,
		`SELECT COALESCE(SUM(monthly_cost), 0) FROM cloud_resources WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	stats.TotalCost = totalCost

	var totalResources int
	err = r.db.GetContext(ctx, &totalResources,
		`SELECT COUNT(*) FROM cloud_resources WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	stats.TotalResources = totalResources

	stats.ByProvider = make(map[string]float64)
	stats.ByRegion = make(map[string]float64)
	stats.ByType = make(map[string]float64)

	var rows []map[string]interface{}
	err = r.db.SelectContext(ctx, &rows,
		`SELECT provider, SUM(monthly_cost) as total FROM cloud_resources WHERE tenant_id=$1 GROUP BY provider`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		if p, ok := row["provider"]; ok {
			stats.ByProvider[fmt.Sprintf("%v", p)] = getFloat(row["total"])
		}
	}

	rows = nil
	err = r.db.SelectContext(ctx, &rows,
		`SELECT region, SUM(monthly_cost) as total FROM cloud_resources WHERE tenant_id=$1 GROUP BY region`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		if r2, ok := row["region"]; ok {
			region := fmt.Sprintf("%v", r2)
			stats.ByRegion[region] = getFloat(row["total"])
		}
	}

	rows = nil
	err = r.db.SelectContext(ctx, &rows,
		`SELECT resource_type, SUM(monthly_cost) as total FROM cloud_resources WHERE tenant_id=$1 GROUP BY resource_type`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		if t, ok := row["resource_type"]; ok {
			stats.ByType[fmt.Sprintf("%v", t)] = getFloat(row["total"])
		}
	}

	return stats, nil
}

func getFloat(v interface{}) float64 {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case float64:
		return val
	case int64:
		return float64(val)
	default:
		return 0
	}
}

func (r *Repository) GetResourceStatistics(ctx context.Context, tenantID string) (*models.ResourceStatistics, error) {
	stats := &models.ResourceStatistics{}

	var totalResources int
	err := r.db.GetContext(ctx, &totalResources,
		`SELECT COUNT(*) FROM cloud_resources WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	stats.TotalResources = totalResources

	var totalCost float64
	err = r.db.GetContext(ctx, &totalCost,
		`SELECT COALESCE(SUM(monthly_cost), 0) FROM cloud_resources WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	stats.TotalCost = totalCost

	stats.ByProvider = make(map[string]int)
	stats.ByRegion = make(map[string]int)
	stats.ByType = make(map[string]int)

	var rows []map[string]interface{}
	err = r.db.SelectContext(ctx, &rows,
		`SELECT provider, COUNT(*) as cnt FROM cloud_resources WHERE tenant_id=$1 GROUP BY provider`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		if p, ok := row["provider"]; ok {
			stats.ByProvider[fmt.Sprintf("%v", p)] = int(row["cnt"].(int64))
		}
	}

	rows = nil
	err = r.db.SelectContext(ctx, &rows,
		`SELECT region, COUNT(*) as cnt FROM cloud_resources WHERE tenant_id=$1 GROUP BY region`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		if r2, ok := row["region"]; ok {
			stats.ByRegion[fmt.Sprintf("%v", r2)] = int(row["cnt"].(int64))
		}
	}

	rows = nil
	err = r.db.SelectContext(ctx, &rows,
		`SELECT resource_type, COUNT(*) as cnt FROM cloud_resources WHERE tenant_id=$1 GROUP BY resource_type`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		if t, ok := row["resource_type"]; ok {
			stats.ByType[fmt.Sprintf("%v", t)] = int(row["cnt"].(int64))
		}
	}

	return stats, nil
}

func (r *Repository) GetResourcesByAccount(ctx context.Context, tenantID, accountID string) ([]models.CloudResource, error) {
	var resources []models.CloudResource
	if accountID == "" {
		return r.ListResources(ctx, tenantID)
	}
	err := r.db.SelectContext(ctx, &resources,
		`SELECT * FROM cloud_resources WHERE tenant_id=$1 AND account_id=$2`,
		tenantID, accountID)
	return resources, err
}

func (r *Repository) InsertSchedulingHistory(ctx context.Context, tenantID string, decision models.ScheduleDecision, policyID string) error {
	decisionJSON, _ := json.Marshal(decision)
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO scheduling_history (id, tenant_id, policy_id, decision, decision_time)
		 VALUES ($1, $2, $3, $4, $5)`,
		uuid.New().String(), tenantID, policyID, string(decisionJSON), decision.DecisionTime)
	return err
}

func (r *Repository) GetSchedulingHistory(ctx context.Context, tenantID string) ([]models.ScheduleDecision, error) {
	var decisions []models.ScheduleDecision
	var rows []map[string]interface{}
	err := r.db.SelectContext(ctx, &rows,
		`SELECT decision FROM scheduling_history WHERE tenant_id=$1 ORDER BY decision_time DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		var d models.ScheduleDecision
		if raw, ok := row["decision"]; ok {
			if s := json.RawMessage(raw.(string)); len(s) > 0 {
				_ = json.Unmarshal(s, &d)
			}
		}
		decisions = append(decisions, d)
	}
	return decisions, nil
}
