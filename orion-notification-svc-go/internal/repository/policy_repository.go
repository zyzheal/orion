package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"orion/notification-svc-go/internal/models"
	"orion/go-common/pkg/database"

	"github.com/google/uuid"
)

// policyRow is used for scanning policy rows from the database.
type policyRow struct {
	ID             string    `db:"id"`
	TenantID       string    `db:"tenant_id"`
	Name           string    `db:"name"`
	Description    *string   `db:"description"`
	Conditions     []byte    `db:"conditions"`
	Channels       []byte    `db:"channels"`
	Recipients     []byte    `db:"recipients"`
	ThrottleMinutes int      `db:"throttle_minutes"`
	Enabled        bool      `db:"enabled"`
	CreatedBy      *string   `db:"created_by"`
	CreatedAt      time.Time `db:"created_at"`
	UpdatedAt      time.Time `db:"updated_at"`
}

// workflowRow is used for scanning workflow rows from the database.
type workflowRow struct {
	ID          string    `db:"id"`
	TenantID    string    `db:"tenant_id"`
	Name        string    `db:"name"`
	Description *string   `db:"description"`
	PolicyID    string    `db:"policy_id"`
	Steps       []byte    `db:"steps"`
	Enabled     bool      `db:"enabled"`
	CreatedBy   *string   `db:"created_by"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

// PolicyRepository provides data access for notification policies and workflows.
type PolicyRepository struct {
	db *database.DB
}

// NewPolicyRepository creates a new PolicyRepository.
func NewPolicyRepository(db *database.DB) *PolicyRepository {
	return &PolicyRepository{db: db}
}

// ==================== Policy CRUD ====================

// CreatePolicy inserts a new notification policy.
func (r *PolicyRepository) CreatePolicy(ctx context.Context, p *models.NotificationPolicyEntity) error {
	p.ID = uuid.New().String()
	p.CreatedAt = time.Now()
	p.UpdatedAt = time.Now()

	conditionsJSON, _ := json.Marshal(p.Conditions)
	channelsJSON, _ := json.Marshal(p.Channels)
	recipientsJSON, _ := json.Marshal(p.Recipients)

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO notification_policies
		 (id, tenant_id, name, description, conditions, channels, recipients, throttle_minutes, enabled, created_by, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		p.ID, p.TenantID, p.Name, p.Description, conditionsJSON, channelsJSON, recipientsJSON,
		p.ThrottleMinutes, p.Enabled, p.CreatedBy, p.CreatedAt, p.UpdatedAt,
	)
	return err
}

// GetPolicy returns a single policy by id and tenant.
func (r *PolicyRepository) GetPolicy(ctx context.Context, tenantID, id string) (*models.NotificationPolicyEntity, error) {
	var row policyRow
	err := r.db.GetContext(ctx, &row,
		`SELECT * FROM notification_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("policy not found: %s", id)
		}
		return nil, err
	}
	return r.mapPolicyRow(&row)
}

// FindPolicyByID returns a single policy by id (without tenant check).
func (r *PolicyRepository) FindPolicyByID(ctx context.Context, id string) (*models.NotificationPolicyEntity, error) {
	var row policyRow
	err := r.db.GetContext(ctx, &row,
		`SELECT * FROM notification_policies WHERE id=$1`, id,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("policy not found: %s", id)
		}
		return nil, err
	}
	return r.mapPolicyRow(&row)
}

// ListPolicies returns all policies for a tenant.
func (r *PolicyRepository) ListPolicies(ctx context.Context, tenantID string) ([]models.NotificationPolicyEntity, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, tenant_id, name, description, conditions, channels, recipients, throttle_minutes, enabled, created_by, created_at, updated_at
		 FROM notification_policies WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var policies []models.NotificationPolicyEntity
	for rows.Next() {
		var row policyRow
		if err := rows.Scan(&row.ID, &row.TenantID, &row.Name, &row.Description, &row.Conditions,
			&row.Channels, &row.Recipients, &row.ThrottleMinutes, &row.Enabled,
			&row.CreatedBy, &row.CreatedAt, &row.UpdatedAt); err != nil {
			return nil, err
		}
		p, err := r.mapPolicyRow(&row)
		if err != nil {
			return nil, err
		}
		policies = append(policies, *p)
	}
	return policies, rows.Err()
}

// FindEnabledPolicies returns all enabled policies for a tenant.
func (r *PolicyRepository) FindEnabledPolicies(ctx context.Context, tenantID string) ([]models.NotificationPolicyEntity, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, tenant_id, name, description, conditions, channels, recipients, throttle_minutes, enabled, created_by, created_at, updated_at
		 FROM notification_policies WHERE tenant_id=$1 AND enabled=true ORDER BY name`, tenantID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var policies []models.NotificationPolicyEntity
	for rows.Next() {
		var row policyRow
		if err := rows.Scan(&row.ID, &row.TenantID, &row.Name, &row.Description, &row.Conditions,
			&row.Channels, &row.Recipients, &row.ThrottleMinutes, &row.Enabled,
			&row.CreatedBy, &row.CreatedAt, &row.UpdatedAt); err != nil {
			return nil, err
		}
		p, err := r.mapPolicyRow(&row)
		if err != nil {
			return nil, err
		}
		policies = append(policies, *p)
	}
	return policies, rows.Err()
}

// UpdatePolicy updates an existing policy.
func (r *PolicyRepository) UpdatePolicy(ctx context.Context, id string, updates map[string]interface{}) (*models.NotificationPolicyEntity, error) {
	if len(updates) == 0 {
		return r.FindPolicyByID(ctx, id)
	}

	setParts := []string{}
	var args []interface{}
	argIdx := 1

	if name, ok := updates["name"].(string); ok && name != "" {
		setParts = append(setParts, fmt.Sprintf("name=$%d", argIdx))
		args = append(args, name)
		argIdx++
	}
	if desc, ok := updates["description"].(*string); ok {
		setParts = append(setParts, fmt.Sprintf("description=$%d", argIdx))
		args = append(args, desc)
		argIdx++
	}
	if conditions, ok := updates["conditions"]; ok && conditions != nil {
		conditionsJSON, _ := json.Marshal(conditions)
		setParts = append(setParts, fmt.Sprintf("conditions=$%d", argIdx))
		args = append(args, conditionsJSON)
		argIdx++
	}
	if channels, ok := updates["channels"]; ok && channels != nil {
		channelsJSON, _ := json.Marshal(channels)
		setParts = append(setParts, fmt.Sprintf("channels=$%d", argIdx))
		args = append(args, channelsJSON)
		argIdx++
	}
	if recipients, ok := updates["recipients"]; ok && recipients != nil {
		recipientsJSON, _ := json.Marshal(recipients)
		setParts = append(setParts, fmt.Sprintf("recipients=$%d", argIdx))
		args = append(args, recipientsJSON)
		argIdx++
	}
	if throttle, ok := updates["throttle_minutes"].(int); ok {
		setParts = append(setParts, fmt.Sprintf("throttle_minutes=$%d", argIdx))
		args = append(args, throttle)
		argIdx++
	}
	if enabled, ok := updates["enabled"].(bool); ok {
		setParts = append(setParts, fmt.Sprintf("enabled=$%d", argIdx))
		args = append(args, enabled)
		argIdx++
	}

	setParts = append(setParts, fmt.Sprintf("updated_at=$%d", argIdx))
	args = append(args, time.Now())
	argIdx++

	args = append(args, id)
	query := fmt.Sprintf("UPDATE notification_policies SET %s WHERE id=$%d RETURNING *",
		strings.Join(setParts, ", "), argIdx)

	var row policyRow
	err := r.db.GetContext(ctx, &row, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("policy not found: %s", id)
		}
		return nil, err
	}
	return r.mapPolicyRow(&row)
}

// DeletePolicy removes a policy by id and tenant.
func (r *PolicyRepository) DeletePolicy(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM notification_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID,
	)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("policy not found: %s", id)
	}
	return nil
}

// ==================== Workflow CRUD ====================

// CreateWorkflow inserts a new notification workflow.
func (r *PolicyRepository) CreateWorkflow(ctx context.Context, w *models.NotificationWorkflowEntity) error {
	w.ID = uuid.New().String()
	w.CreatedAt = time.Now()
	w.UpdatedAt = time.Now()

	stepsJSON, _ := json.Marshal(w.Steps)

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO notification_workflows
		 (id, tenant_id, name, description, policy_id, steps, enabled, created_by, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		w.ID, w.TenantID, w.Name, w.Description, w.PolicyID, stepsJSON,
		w.Enabled, w.CreatedBy, w.CreatedAt, w.UpdatedAt,
	)
	return err
}

// GetWorkflow returns a single workflow by id.
func (r *PolicyRepository) GetWorkflow(ctx context.Context, id string) (*models.NotificationWorkflowEntity, error) {
	var row workflowRow
	err := r.db.GetContext(ctx, &row,
		`SELECT * FROM notification_workflows WHERE id=$1`, id,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("workflow not found: %s", id)
		}
		return nil, err
	}
	return r.mapWorkflowRow(&row)
}

// ListWorkflowsByPolicyID returns all workflows for a policy.
func (r *PolicyRepository) ListWorkflowsByPolicyID(ctx context.Context, policyID string) ([]models.NotificationWorkflowEntity, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, tenant_id, name, description, policy_id, steps, enabled, created_by, created_at, updated_at
		 FROM notification_workflows WHERE policy_id=$1 ORDER BY created_at DESC`, policyID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var workflows []models.NotificationWorkflowEntity
	for rows.Next() {
		var row workflowRow
		if err := rows.Scan(&row.ID, &row.TenantID, &row.Name, &row.Description, &row.PolicyID,
			&row.Steps, &row.Enabled, &row.CreatedBy, &row.CreatedAt, &row.UpdatedAt); err != nil {
			return nil, err
		}
		w, err := r.mapWorkflowRow(&row)
		if err != nil {
			return nil, err
		}
		workflows = append(workflows, *w)
	}
	return workflows, rows.Err()
}

// ListWorkflowsByTenant returns all workflows for a tenant.
func (r *PolicyRepository) ListWorkflowsByTenant(ctx context.Context, tenantID string) ([]models.NotificationWorkflowEntity, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, tenant_id, name, description, policy_id, steps, enabled, created_by, created_at, updated_at
		 FROM notification_workflows WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var workflows []models.NotificationWorkflowEntity
	for rows.Next() {
		var row workflowRow
		if err := rows.Scan(&row.ID, &row.TenantID, &row.Name, &row.Description, &row.PolicyID,
			&row.Steps, &row.Enabled, &row.CreatedBy, &row.CreatedAt, &row.UpdatedAt); err != nil {
			return nil, err
		}
		w, err := r.mapWorkflowRow(&row)
		if err != nil {
			return nil, err
		}
		workflows = append(workflows, *w)
	}
	return workflows, rows.Err()
}

// UpdateWorkflow updates an existing workflow.
func (r *PolicyRepository) UpdateWorkflow(ctx context.Context, id string, updates map[string]interface{}) (*models.NotificationWorkflowEntity, error) {
	if len(updates) == 0 {
		return r.GetWorkflow(ctx, id)
	}

	setParts := []string{}
	var args []interface{}
	argIdx := 1

	if name, ok := updates["name"].(string); ok && name != "" {
		setParts = append(setParts, fmt.Sprintf("name=$%d", argIdx))
		args = append(args, name)
		argIdx++
	}
	if desc, ok := updates["description"].(*string); ok {
		setParts = append(setParts, fmt.Sprintf("description=$%d", argIdx))
		args = append(args, desc)
		argIdx++
	}
	if steps, ok := updates["steps"]; ok && steps != nil {
		stepsJSON, _ := json.Marshal(steps)
		setParts = append(setParts, fmt.Sprintf("steps=$%d", argIdx))
		args = append(args, stepsJSON)
		argIdx++
	}
	if enabled, ok := updates["enabled"].(bool); ok {
		setParts = append(setParts, fmt.Sprintf("enabled=$%d", argIdx))
		args = append(args, enabled)
		argIdx++
	}

	setParts = append(setParts, fmt.Sprintf("updated_at=$%d", argIdx))
	args = append(args, time.Now())
	argIdx++

	args = append(args, id)
	query := fmt.Sprintf("UPDATE notification_workflows SET %s WHERE id=$%d RETURNING *",
		strings.Join(setParts, ", "), argIdx)

	var row workflowRow
	err := r.db.GetContext(ctx, &row, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("workflow not found: %s", id)
		}
		return nil, err
	}
	return r.mapWorkflowRow(&row)
}

// DeleteWorkflow removes a workflow by id.
func (r *PolicyRepository) DeleteWorkflow(ctx context.Context, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM notification_workflows WHERE id=$1`, id,
	)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("workflow not found: %s", id)
	}
	return nil
}

// ==================== Private Helpers ====================

func (r *PolicyRepository) mapPolicyRow(row *policyRow) (*models.NotificationPolicyEntity, error) {
	var conditions []models.PolicyCondition
	if len(row.Conditions) > 0 {
		if err := json.Unmarshal(row.Conditions, &conditions); err != nil {
			return nil, fmt.Errorf("failed to unmarshal conditions: %w", err)
		}
	}

	var channels []string
	if len(row.Channels) > 0 {
		if err := json.Unmarshal(row.Channels, &channels); err != nil {
			return nil, fmt.Errorf("failed to unmarshal channels: %w", err)
		}
	}

	var recipients []string
	if len(row.Recipients) > 0 {
		if err := json.Unmarshal(row.Recipients, &recipients); err != nil {
			return nil, fmt.Errorf("failed to unmarshal recipients: %w", err)
		}
	}

	return &models.NotificationPolicyEntity{
		ID:             row.ID,
		TenantID:       row.TenantID,
		Name:           row.Name,
		Description:    row.Description,
		Conditions:     conditions,
		Channels:       channels,
		Recipients:     recipients,
		ThrottleMinutes: row.ThrottleMinutes,
		Enabled:        row.Enabled,
		CreatedBy:      row.CreatedBy,
		CreatedAt:      row.CreatedAt,
		UpdatedAt:      row.UpdatedAt,
	}, nil
}

func (r *PolicyRepository) mapWorkflowRow(row *workflowRow) (*models.NotificationWorkflowEntity, error) {
	var steps []models.WorkflowStep
	if len(row.Steps) > 0 {
		if err := json.Unmarshal(row.Steps, &steps); err != nil {
			return nil, fmt.Errorf("failed to unmarshal steps: %w", err)
		}
	}

	return &models.NotificationWorkflowEntity{
		ID:          row.ID,
		TenantID:    row.TenantID,
		Name:        row.Name,
		Description: row.Description,
		PolicyID:    row.PolicyID,
		Steps:       steps,
		Enabled:     row.Enabled,
		CreatedBy:   row.CreatedBy,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}, nil
}
