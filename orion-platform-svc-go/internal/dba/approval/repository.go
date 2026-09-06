package approval

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// JSONB column helper — sqlx + pq do not natively map []byte to JSONB
// in Go 1.21 without explicit drivers. We marshal/unmarshal manually
// so the code remains portable across PostgreSQL drivers.
func marshalJSON(v any) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func unmarshalJSON(s string, v any) error {
	if s == "" {
		return nil
	}
	return json.Unmarshal([]byte(s), v)
}

// Repository persists the approval module's state in PostgreSQL.
// It mirrors internal/dba/repository (sqlx.DB, sentinel.NotFound on
// missing rows, RETURNING * on updates) and stores the dynamic step
// definitions and approvals as JSONB columns so a workflow can add
// arbitrary step types without schema churn.
type Repository struct {
	db *sqlx.DB
}

// NewRepository constructs a Repository backed by the given *sqlx.DB.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---- Workflows ----

// CreateWorkflow inserts a new workflow definition. The steps slice
// is serialised to JSONB on write; the caller must have already
// validated the workflow via ValidateWorkflow.
func (r *Repository) CreateWorkflow(ctx context.Context, w *ApprovalWorkflow) error {
	if w.ID == "" {
		w.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	if w.CreatedAt.IsZero() {
		w.CreatedAt = now
	}
	w.UpdatedAt = now
	if !w.Enabled {
		// Default new workflows to enabled.
		w.Enabled = true
	}
	stepsJSON, err := marshalJSON(w.Steps)
	if err != nil {
		return fmt.Errorf("marshal steps: %w", err)
	}
	_, err = r.db.NamedExecContext(ctx,
		`INSERT INTO dba_approval_workflows
		   (id, tenant_id, name, steps, enabled, created_at, updated_at)
		 VALUES
		   (:id, :tenant_id, :name, :steps, :enabled, :created_at, :updated_at)`,
		struct {
			ID        string `db:"id"`
			TenantID  string `db:"tenant_id"`
			Name      string `db:"name"`
			Steps     string `db:"steps"`
			Enabled   bool   `db:"enabled"`
			CreatedAt time.Time `db:"created_at"`
			UpdatedAt time.Time `db:"updated_at"`
		}{w.ID, w.TenantID, w.Name, stepsJSON, w.Enabled, w.CreatedAt, w.UpdatedAt})
	if err != nil {
		return fmt.Errorf("insert workflow: %w", err)
	}
	return nil
}

// GetWorkflow fetches a single workflow by ID. Returns sentinel.NotFound
// when the row does not exist.
func (r *Repository) GetWorkflow(ctx context.Context, id string) (*ApprovalWorkflow, error) {
	var row struct {
		ID        string    `db:"id"`
		TenantID  string    `db:"tenant_id"`
		Name      string    `db:"name"`
		Steps     []byte    `db:"steps"`
		Enabled   bool      `db:"enabled"`
		CreatedAt time.Time `db:"created_at"`
		UpdatedAt time.Time `db:"updated_at"`
	}
	err := r.db.GetContext(ctx, &row,
		`SELECT id, tenant_id, name, steps, enabled, created_at, updated_at
		 FROM dba_approval_workflows WHERE id=$1`, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, fmt.Errorf("get workflow: %w", err)
	}
	w := &ApprovalWorkflow{
		ID:        row.ID,
		TenantID:  row.TenantID,
		Name:      row.Name,
		Enabled:   row.Enabled,
		CreatedAt: row.CreatedAt,
		UpdatedAt: row.UpdatedAt,
	}
	_ = unmarshalJSON(string(row.Steps), &w.Steps)
	return w, nil
}

// ListWorkflows returns all workflows visible to the tenant. Order is
// created_at DESC so newest workflows appear first.
func (r *Repository) ListWorkflows(ctx context.Context, tenantID string) ([]ApprovalWorkflow, error) {
	type row struct {
		ID        string      `db:"id"`
		TenantID  string      `db:"tenant_id"`
		Name      string      `db:"name"`
		Steps     []byte      `db:"steps"`
		Enabled   bool        `db:"enabled"`
		CreatedAt time.Time   `db:"created_at"`
		UpdatedAt time.Time   `db:"updated_at"`
	}
	var rows []row
	err := r.db.SelectContext(ctx, &rows,
		`SELECT id, tenant_id, name, steps, enabled, created_at, updated_at
		 FROM dba_approval_workflows WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list workflows: %w", err)
	}
	out := make([]ApprovalWorkflow, 0, len(rows))
	for _, r := range rows {
		w := ApprovalWorkflow{
			ID:        r.ID,
			TenantID:  r.TenantID,
			Name:      r.Name,
			Enabled:   r.Enabled,
			CreatedAt: r.CreatedAt,
			UpdatedAt: r.UpdatedAt,
		}
		_ = unmarshalJSON(string(r.Steps), &w.Steps)
		out = append(out, w)
	}
	return out, nil
}

// ---- Instances ----

// CreateInstance inserts a new instance. Steps are JSONB-encoded on
// write. ID, CreatedAt, UpdatedAt are auto-assigned when empty.
func (r *Repository) CreateInstance(ctx context.Context, inst *ApprovalInstance) error {
	if inst.ID == "" {
		inst.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	if inst.CreatedAt.IsZero() {
		inst.CreatedAt = now
	}
	inst.UpdatedAt = now
	if inst.Status == "" {
		inst.Status = StatusPending
	}
	stepsJSON, err := marshalJSON(inst.Steps)
	if err != nil {
		return fmt.Errorf("marshal steps: %w", err)
	}
	var finAt interface{}
	if inst.FinishedAt != nil {
		finAt = *inst.FinishedAt
	}
	_, err = r.db.NamedExecContext(ctx,
		`INSERT INTO dba_approval_instances
		   (id, tenant_id, order_id, workflow_id, workflow_name, current_step, status, steps, created_at, updated_at, finished_at)
		 VALUES
		   (:id, :tenant_id, :order_id, :workflow_id, :workflow_name, :current_step, :status, :steps, :created_at, :updated_at, :finished_at)`,
		struct {
			ID           string       `db:"id"`
			TenantID     string       `db:"tenant_id"`
			OrderID      string       `db:"order_id"`
			WorkflowID   string       `db:"workflow_id"`
			WorkflowName string       `db:"workflow_name"`
			CurrentStep  int          `db:"current_step"`
			Status       string       `db:"status"`
			Steps        string       `db:"steps"`
			CreatedAt    time.Time    `db:"created_at"`
			UpdatedAt    time.Time    `db:"updated_at"`
			FinishedAt   interface{}  `db:"finished_at"`
		}{inst.ID, inst.TenantID, inst.OrderID, inst.WorkflowID,
			inst.WorkflowName, inst.CurrentStep, inst.Status, stepsJSON,
			inst.CreatedAt, inst.UpdatedAt, finAt})
	if err != nil {
		return fmt.Errorf("insert instance: %w", err)
	}
	return nil
}

// GetInstance fetches a single instance. Missing rows return
// sentinel.NotFound.
func (r *Repository) GetInstance(ctx context.Context, id string) (*ApprovalInstance, error) {
	var row struct {
		ID           string     `db:"id"`
		TenantID     string     `db:"tenant_id"`
		OrderID      string     `db:"order_id"`
		WorkflowID   string     `db:"workflow_id"`
		WorkflowName string     `db:"workflow_name"`
		CurrentStep  int        `db:"current_step"`
		Status       string     `db:"status"`
		Steps        []byte     `db:"steps"`
		CreatedAt    time.Time  `db:"created_at"`
		UpdatedAt    time.Time  `db:"updated_at"`
		FinishedAt   *time.Time `db:"finished_at"`
	}
	err := r.db.GetContext(ctx, &row,
		`SELECT id, tenant_id, order_id, workflow_id, workflow_name, current_step,
		        status, steps, created_at, updated_at, finished_at
		 FROM dba_approval_instances WHERE id=$1`, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, fmt.Errorf("get instance: %w", err)
	}
	steps := []ApprovalStep{}
	_ = unmarshalJSON(string(row.Steps), &steps)
	return &ApprovalInstance{
		ID:           row.ID,
		TenantID:     row.TenantID,
		OrderID:      row.OrderID,
		WorkflowID:   row.WorkflowID,
		WorkflowName: row.WorkflowName,
		CurrentStep:  row.CurrentStep,
		Status:       row.Status,
		Steps:        steps,
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
		FinishedAt:   row.FinishedAt,
	}, nil
}

// UpdateInstance rewrites the mutable columns (current_step, status,
// steps, updated_at, finished_at) and returns the fresh row via a
// follow-up GetInstance. Identifiers and workflow references are
// immutable by design.
func (r *Repository) UpdateInstance(ctx context.Context, inst *ApprovalInstance) (*ApprovalInstance, error) {
	if inst.ID == "" {
		return nil, fmt.Errorf("update instance: id is required")
	}
	inst.UpdatedAt = time.Now().UTC()
	stepsJSON, err := marshalJSON(inst.Steps)
	if err != nil {
		return nil, fmt.Errorf("marshal steps: %w", err)
	}
	var finAt interface{}
	if inst.FinishedAt != nil {
		finAt = *inst.FinishedAt
	}
	res, err := r.db.ExecContext(ctx,
		`UPDATE dba_approval_instances
		    SET current_step=$1, status=$2, steps=$3::jsonb, updated_at=$4, finished_at=$5
		  WHERE id=$6`,
		inst.CurrentStep, inst.Status, stepsJSON, inst.UpdatedAt, finAt, inst.ID)
	if err != nil {
		return nil, fmt.Errorf("update instance: %w", err)
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return nil, sentinel.NotFound
	}
	return inst, nil
}

// ListInstancesByOrder returns all approval instances attached to a
// single order, newest first.
func (r *Repository) ListInstancesByOrder(ctx context.Context, orderID string) ([]ApprovalInstance, error) {
	if orderID == "" {
		return []ApprovalInstance{}, nil
	}
	type row struct {
		ID           string     `db:"id"`
		TenantID     string     `db:"tenant_id"`
		OrderID      string     `db:"order_id"`
		WorkflowID   string     `db:"workflow_id"`
		WorkflowName string     `db:"workflow_name"`
		CurrentStep  int        `db:"current_step"`
		Status       string     `db:"status"`
		Steps        []byte     `db:"steps"`
		CreatedAt    time.Time  `db:"created_at"`
		UpdatedAt    time.Time  `db:"updated_at"`
		FinishedAt   *time.Time `db:"finished_at"`
	}
	var rows []row
	err := r.db.SelectContext(ctx, &rows,
		`SELECT id, tenant_id, order_id, workflow_id, workflow_name, current_step,
		        status, steps, created_at, updated_at, finished_at
		 FROM dba_approval_instances WHERE order_id=$1 ORDER BY created_at DESC`, orderID)
	if err != nil {
		return nil, fmt.Errorf("list instances by order: %w", err)
	}
	out := make([]ApprovalInstance, 0, len(rows))
	for _, r := range rows {
		steps := []ApprovalStep{}
		_ = unmarshalJSON(string(r.Steps), &steps)
		out = append(out, ApprovalInstance{
			ID:           r.ID,
			TenantID:     r.TenantID,
			OrderID:      r.OrderID,
			WorkflowID:   r.WorkflowID,
			WorkflowName: r.WorkflowName,
			CurrentStep:  r.CurrentStep,
			Status:       r.Status,
			Steps:        steps,
			CreatedAt:    r.CreatedAt,
			UpdatedAt:    r.UpdatedAt,
			FinishedAt:   r.FinishedAt,
		})
	}
	return out, nil
}

// ---- Approval records ----

// InsertRecord appends a single audit row to dba_approval_records.
// It assigns an ID when empty and stamps ActionedAt when unset so
// service callers do not need to remember to fill both fields.
func (r *Repository) InsertRecord(ctx context.Context, rec *ApprovalRecord) error {
	if rec.ID == "" {
		rec.ID = uuid.New().String()
	}
	if rec.ActionedAt.IsZero() {
		rec.ActionedAt = time.Now().UTC()
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO dba_approval_records
		   (id, instance_id, step_index, user_id, action, comment, actioned_at)
		 VALUES
		   (:id, :instance_id, :step_index, :user_id, :action, :comment, :actioned_at)`,
		struct {
			ID         string    `db:"id"`
			InstanceID string    `db:"instance_id"`
			StepIndex  int       `db:"step_index"`
			UserID     string    `db:"user_id"`
			Action     string    `db:"action"`
			Comment    string    `db:"comment"`
			ActionedAt time.Time `db:"actioned_at"`
		}{rec.ID, rec.InstanceID, rec.StepIndex, rec.UserID, rec.Action, rec.Comment, rec.ActionedAt})
	if err != nil {
		return fmt.Errorf("insert approval record: %w", err)
	}
	return nil
}

// jsonFieldToString handles the two ways sqlx exposes JSONB — either
// as []byte (default) or as string when a `text` cast is applied in
// the query. Both are normalised to a Go string.
func jsonFieldToString(v interface{}) string {
	switch x := v.(type) {
	case []byte:
		return string(x)
	case string:
		return x
	case nil:
		return ""
	default:
		b, _ := json.Marshal(x)
		return string(b)
	}
}
