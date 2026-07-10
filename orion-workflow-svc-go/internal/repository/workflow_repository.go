package repository

import (
	"context"
	"strconv"

	"orion/workflow-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ====== Workflow (legacy) ======

func (r *Repository) CreateWorkflow(ctx context.Context, w *models.Workflow) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO workflows (id, tenant_id, name, description, steps, status) VALUES ($1,$2,$3,$4,$5,$6)`,
		w.ID, w.TenantID, w.Name, w.Description, w.Steps, w.Status)
	return err
}

func (r *Repository) ListWorkflows(ctx context.Context, tenantID string, offset, limit int) ([]models.Workflow, error) {
	var items []models.Workflow
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM workflows WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetWorkflowByID(ctx context.Context, tenantID, id string) (*models.Workflow, error) {
	var w models.Workflow
	err := r.db.GetContext(ctx, &w, `SELECT * FROM workflows WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *Repository) DeleteWorkflow(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM workflows WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) CountWorkflows(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM workflows WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ====== WorkflowRun ======

func (r *Repository) CreateRun(ctx context.Context, run *models.WorkflowRun) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO workflow_runs (id, workflow_id, tenant_id, status, input, started_at) VALUES ($1,$2,$3,$4,$5,$6)`,
		run.ID, run.WorkflowID, run.TenantID, run.Status, run.Input, run.StartedAt)
	return err
}

func (r *Repository) GetRun(ctx context.Context, id string) (*models.WorkflowRun, error) {
	var run models.WorkflowRun
	err := r.db.GetContext(ctx, &run, `SELECT * FROM workflow_runs WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &run, nil
}

// ====== Workflow Definition ======

func (r *Repository) ListDefinitions(ctx context.Context, tenantID string, status *bool, offset, limit int) ([]models.WorkflowDefinition, error) {
	var items []models.WorkflowDefinition
	if status != nil {
		err := r.db.SelectContext(ctx, &items,
			`SELECT * FROM workflow_definitions WHERE tenant_id=$1 AND enabled=$2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`,
			tenantID, *status, offset, limit)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM workflow_definitions WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetDefinitionByID(ctx context.Context, tenantID, id string) (*models.WorkflowDefinition, error) {
	var w models.WorkflowDefinition
	err := r.db.GetContext(ctx, &w, `SELECT * FROM workflow_definitions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *Repository) CreateDefinition(ctx context.Context, d *models.WorkflowDefinition) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO workflow_definitions (id, tenant_id, name, description, nodes, edges, enabled, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		d.ID, d.TenantID, d.Name, d.Description, d.Nodes, d.Edges, d.Enabled, d.CreatedBy)
	return err
}

func (r *Repository) UpdateDefinition(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.WorkflowDefinition, error) {
	fields := []string{}
	args := []interface{}{}
	param := 1
	if v, ok := updates["name"]; ok {
		fields = append(fields, `name=$`+strconv.Itoa(param))
		args = append(args, v)
		param++
	}
	if v, ok := updates["description"]; ok {
		fields = append(fields, `description=$`+strconv.Itoa(param))
		args = append(args, v)
		param++
	}
	if v, ok := updates["nodes"]; ok {
		fields = append(fields, `nodes=$`+strconv.Itoa(param))
		args = append(args, v)
		param++
	}
	if v, ok := updates["edges"]; ok {
		fields = append(fields, `edges=$`+strconv.Itoa(param))
		args = append(args, v)
		param++
	}
	if v, ok := updates["enabled"]; ok {
		fields = append(fields, `enabled=$`+strconv.Itoa(param))
		args = append(args, v)
		param++
	}
	if len(fields) == 0 {
		return nil, nil
	}
	fields = append(fields, `updated_at = NOW()`)
	args = append(args, id, tenantID)

	var w models.WorkflowDefinition
	err := r.db.GetContext(ctx, &w,
		`UPDATE workflow_definitions SET `+joinStr(fields, ", ")+` WHERE id=$`+strconv.Itoa(param)+` AND tenant_id=$`+strconv.Itoa(param+1)+` RETURNING *`,
		args...)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *Repository) DeleteDefinition(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM workflow_definitions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ====== Workflow Instance ======

func (r *Repository) CreateInstance(ctx context.Context, inst *models.WorkflowInstance) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO workflow_instances (id, workflow_id, workflow_definition_id, tenant_id, status, input, current_node_id, triggered_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		inst.ID, inst.WorkflowID, inst.WorkflowDefinitionID, inst.TenantID, inst.Status, inst.Input, inst.CurrentNodeID, inst.TriggeredBy)
	return err
}

func (r *Repository) ListInstancesByWorkflow(ctx context.Context, workflowID string, limit int) ([]models.WorkflowInstance, error) {
	var items []models.WorkflowInstance
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM workflow_instances WHERE workflow_id=$1 ORDER BY created_at DESC LIMIT $2`,
		workflowID, limit)
	return items, err
}

func (r *Repository) GetInstanceByID(ctx context.Context, id string) (*models.WorkflowInstance, error) {
	var inst models.WorkflowInstance
	err := r.db.GetContext(ctx, &inst, `SELECT * FROM workflow_instances WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &inst, nil
}

// ====== Workflow Trigger ======

func (r *Repository) ListTriggers(ctx context.Context, tenantID string, workflowID *string, typ *models.TriggerType, enabled *bool, offset, limit int) ([]models.WorkflowTrigger, error) {
	var items []models.WorkflowTrigger
	var err error
	if workflowID != nil {
		err = r.db.SelectContext(ctx, &items,
			`SELECT * FROM workflow_triggers WHERE tenant_id=$1 AND workflow_id=$2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`,
			tenantID, *workflowID, offset, limit)
	} else if typ != nil {
		err = r.db.SelectContext(ctx, &items,
			`SELECT * FROM workflow_triggers WHERE tenant_id=$1 AND type=$2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`,
			tenantID, *typ, offset, limit)
	} else if enabled != nil {
		err = r.db.SelectContext(ctx, &items,
			`SELECT * FROM workflow_triggers WHERE tenant_id=$1 AND enabled=$2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`,
			tenantID, *enabled, offset, limit)
	} else {
		err = r.db.SelectContext(ctx, &items,
			`SELECT * FROM workflow_triggers WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
			tenantID, offset, limit)
	}
	return items, err
}

func (r *Repository) GetTriggerByID(ctx context.Context, tenantID, id string) (*models.WorkflowTrigger, error) {
	var t models.WorkflowTrigger
	err := r.db.GetContext(ctx, &t, `SELECT * FROM workflow_triggers WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) CreateTrigger(ctx context.Context, t *models.WorkflowTrigger) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO workflow_triggers (id, tenant_id, workflow_id, name, type, config, webhook_secret, webhook_path, enabled, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		t.ID, t.TenantID, t.WorkflowID, t.Name, t.Type, t.Config, t.WebhookSecret, t.WebhookPath, t.Enabled, t.CreatedBy)
	return err
}

func (r *Repository) UpdateTrigger(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.WorkflowTrigger, error) {
	fields := []string{}
	args := []interface{}{}
	param := 1
	if v, ok := updates["name"]; ok {
		fields = append(fields, `name=$`+strconv.Itoa(param))
		args = append(args, v)
		param++
	}
	if v, ok := updates["type"]; ok {
		fields = append(fields, `type=$`+strconv.Itoa(param))
		args = append(args, v)
		param++
	}
	if v, ok := updates["config"]; ok {
		fields = append(fields, `config=$`+strconv.Itoa(param))
		args = append(args, v)
		param++
	}
	if v, ok := updates["webhook_secret"]; ok {
		fields = append(fields, `webhook_secret=$`+strconv.Itoa(param))
		args = append(args, v)
		param++
	}
	if v, ok := updates["webhook_path"]; ok {
		fields = append(fields, `webhook_path=$`+strconv.Itoa(param))
		args = append(args, v)
		param++
	}
	if v, ok := updates["enabled"]; ok {
		fields = append(fields, `enabled=$`+strconv.Itoa(param))
		args = append(args, v)
		param++
	}
	if len(fields) == 0 {
		return nil, nil
	}
	fields = append(fields, `updated_at = NOW()`)
	args = append(args, id, tenantID)

	var t models.WorkflowTrigger
	err := r.db.GetContext(ctx, &t,
		`UPDATE workflow_triggers SET `+joinStr(fields, ", ")+` WHERE id=$`+strconv.Itoa(param)+` AND tenant_id=$`+strconv.Itoa(param+1)+` RETURNING *`,
		args...)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) DeleteTrigger(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM workflow_triggers WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) SetTriggerEnabled(ctx context.Context, tenantID, id string, enabled bool) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE workflow_triggers SET enabled=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		enabled, id, tenantID)
	return err
}

func (r *Repository) FindTriggerByWebhookPath(ctx context.Context, webhookPath string) (*models.WorkflowTrigger, error) {
	var t models.WorkflowTrigger
	err := r.db.GetContext(ctx, &t, `SELECT * FROM workflow_triggers WHERE webhook_path=$1 AND enabled=true`, webhookPath)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// ====== Trigger Log ======

func (r *Repository) CreateTriggerLog(ctx context.Context, log *models.TriggerLog) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO workflow_trigger_logs (id, trigger_id, event_type, event_payload, status) VALUES ($1,$2,$3,$4,$5)`,
		log.ID, log.TriggerID, log.EventType, log.EventPayload, log.Status)
	return err
}

func (r *Repository) UpdateTriggerLogStatus(ctx context.Context, id, status, errMsg string, durationMs *int) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE workflow_trigger_logs SET status=$1, error_message=$2, duration_ms=$3 WHERE id=$4`,
		status, errMsg, durationMs, id)
	return err
}

// ====== Workflow Task ======

func (r *Repository) ListTasks(ctx context.Context, tenantID string, assigneeID *string, status *models.TaskStatus, offset, limit int) ([]models.WorkflowTask, error) {
	var items []models.WorkflowTask
	var err error
	if assigneeID != nil {
		if status != nil {
			err = r.db.SelectContext(ctx, &items,
				`SELECT * FROM workflow_tasks WHERE tenant_id=$1 AND assignee_id=$2 AND status=$3 ORDER BY created_at DESC OFFSET $4 LIMIT $5`,
				tenantID, *assigneeID, *status, offset, limit)
		} else {
			err = r.db.SelectContext(ctx, &items,
				`SELECT * FROM workflow_tasks WHERE tenant_id=$1 AND assignee_id=$2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`,
				tenantID, *assigneeID, offset, limit)
		}
	} else if status != nil {
		err = r.db.SelectContext(ctx, &items,
			`SELECT * FROM workflow_tasks WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`,
			tenantID, *status, offset, limit)
	} else {
		err = r.db.SelectContext(ctx, &items,
			`SELECT * FROM workflow_tasks WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
			tenantID, offset, limit)
	}
	return items, err
}

func (r *Repository) GetTaskByID(ctx context.Context, tenantID, id string) (*models.WorkflowTask, error) {
	var t models.WorkflowTask
	err := r.db.GetContext(ctx, &t, `SELECT * FROM workflow_tasks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) CreateTask(ctx context.Context, t *models.WorkflowTask) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO workflow_tasks (id, tenant_id, workflow_id, workflow_instance_id, node_id, assignee_id, status, comment, form_data)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		t.ID, t.TenantID, t.WorkflowID, t.WorkflowInstanceID, t.NodeID, t.AssigneeID, t.Status, t.Comment, t.FormData)
	return err
}

func (r *Repository) UpdateTaskStatus(ctx context.Context, tenantID, id string, status models.TaskStatus, assigneeID *string, comment *string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE workflow_tasks SET status=$1, assignee_id=$2, comment=$3, updated_at=NOW() WHERE id=$4 AND tenant_id=$5`,
		status, assigneeID, comment, id, tenantID)
	return err
}

func (r *Repository) CompleteTask(ctx context.Context, tenantID, id string, status models.TaskStatus, assigneeID *string, comment *string, formData models.JSONB) (*models.WorkflowTask, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE workflow_tasks SET status=$1, assignee_id=$2, comment=$3, form_data=$4, updated_at=NOW() WHERE id=$5 AND tenant_id=$6`,
		status, assigneeID, comment, formData, id, tenantID)
	if err != nil {
		return nil, err
	}
	var t models.WorkflowTask
	err = r.db.GetContext(ctx, &t, `SELECT * FROM workflow_tasks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// ====== Dependency Analysis ======

func (r *Repository) GetAllDefinitionsForGraph(ctx context.Context, tenantID string) ([]models.WorkflowDefinition, error) {
	var items []models.WorkflowDefinition
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM workflow_definitions WHERE tenant_id=$1`, tenantID)
	return items, err
}

func joinStr(strs []string, sep string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}
