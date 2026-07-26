package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"orion/lowcode-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides all database operations for the lowcode service.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ============================================================
// LowCode App (component library)
// ============================================================

// Create inserts a new LowCodeApp row.
func (r *Repository) Create(ctx context.Context, d *models.LowCodeApp) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO lowcode_apps (id, tenant_id, name, component_type, schema, preview_url, version)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		d.ID, d.TenantID, d.Name, d.ComponentType, d.Schema, d.PreviewURL, d.Version)
	return err
}

// List returns a page of LowCodeApp rows for a tenant.
func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.LowCodeApp, error) {
	var items []models.LowCodeApp
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, name, component_type, schema, preview_url, version, created_at
		 FROM lowcode_apps
		 WHERE tenant_id = $1
		 ORDER BY created_at DESC
		 OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

// GetByID returns a single LowCodeApp by id and tenant.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.LowCodeApp, error) {
	var d models.LowCodeApp
	err := r.db.GetContext(ctx, &d,
		`SELECT id, tenant_id, name, component_type, schema, preview_url, version, created_at
		 FROM lowcode_apps
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// Delete removes a LowCodeApp by id and tenant.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM lowcode_apps WHERE id = $1 AND tenant_id = $2`,
		id, tenantID)
	return err
}

// Count returns the total number of LowCodeApp rows for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM lowcode_apps WHERE tenant_id = $1`,
		tenantID)
	return count, err
}

// ============================================================
// Workflow Definition
// ============================================================

// CreateDef inserts a new workflow definition.
func (r *Repository) CreateDef(ctx context.Context, d *models.WorkflowDefinition) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO lowcode_workflow_definition
		 (id, tenant_id, name, description, version, enabled, nodes, edges, created_by, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		d.ID, d.TenantID, d.Name, d.Description, d.Version, d.Enabled,
		d.Nodes, d.Edges, d.CreatedBy, now, now)
	return err
}

// FindDefByID returns a workflow definition by its primary key.
func (r *Repository) FindDefByID(ctx context.Context, id string) (*models.WorkflowDefinition, error) {
	var d models.WorkflowDefinition
	err := r.db.GetContext(ctx, &d,
		`SELECT id, tenant_id, name, description, version, enabled, nodes, edges, created_by, created_at, updated_at
		 FROM lowcode_workflow_definition WHERE id = $1`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &d, nil
}

// FindDefsByIDs returns a map of id->name for the given definition ids.
func (r *Repository) FindDefsByIDs(ctx context.Context, ids []string) (map[string]string, error) {
	if len(ids) == 0 {
		return map[string]string{}, nil
	}
	query, args, err := sqlx.In(
		`SELECT id, name FROM lowcode_workflow_definition WHERE id IN (?)`, ids)
	if err != nil {
		return nil, err
	}
	query = r.db.Rebind(query)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]string, len(ids))
	for rows.Next() {
		var id, name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		result[id] = name
	}
	return result, rows.Err()
}

// ListDefs returns a page of workflow definitions, optionally filtered by enabled status.
func (r *Repository) ListDefs(ctx context.Context, enabled *bool, offset, limit int) ([]models.WorkflowDefinition, int, error) {
	var (
		defs  []models.WorkflowDefinition
		total int
		where string
		args  []interface{}
	)
	if enabled != nil {
		where = "WHERE enabled = $1"
		args = append(args, *enabled)
	}

	countQuery := `SELECT COUNT(*) FROM lowcode_workflow_definition ` + where
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	dataQuery := fmt.Sprintf(
		`SELECT id, tenant_id, name, description, version, enabled, nodes, edges, created_by, created_at, updated_at
		 FROM lowcode_workflow_definition %s
		 ORDER BY created_at DESC
		 OFFSET $%d LIMIT $%d`, where, len(args)+1, len(args)+2)
	args = append(args, offset, limit)

	if err := r.db.SelectContext(ctx, &defs, dataQuery, args...); err != nil {
		return nil, 0, err
	}
	return defs, total, nil
}

// FindDefsByTenant returns workflow definitions for a given tenant.
func (r *Repository) FindDefsByTenant(ctx context.Context, tenantID string, enabled *bool, offset, limit int) ([]models.WorkflowDefinition, error) {
	var (
		defs []models.WorkflowDefinition
		args []interface{}
		sb   strings.Builder
	)
	sb.WriteString(`SELECT id, tenant_id, name, description, version, enabled, nodes, edges, created_by, created_at, updated_at
	                 FROM lowcode_workflow_definition WHERE tenant_id = $1`)
	args = append(args, tenantID)
	argIdx := 2
	if enabled != nil {
		sb.WriteString(fmt.Sprintf(` AND enabled = $%d`, argIdx))
		args = append(args, *enabled)
		argIdx++
	}
	sb.WriteString(` ORDER BY created_at DESC`)
	sb.WriteString(fmt.Sprintf(` OFFSET $%d LIMIT $%d`, argIdx, argIdx+1))
	args = append(args, offset, limit)

	err := r.db.SelectContext(ctx, &defs, sb.String(), args...)
	return defs, err
}

// UpdateDef updates a workflow definition.
func (r *Repository) UpdateDef(ctx context.Context, d *models.WorkflowDefinition) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE lowcode_workflow_definition
		 SET name = $1, description = $2, version = $3, enabled = $4,
		     nodes = $5, edges = $6, updated_at = $7
		 WHERE id = $8`,
		d.Name, d.Description, d.Version, d.Enabled,
		d.Nodes, d.Edges, time.Now(), d.ID)
	return err
}

// DeleteDef removes a workflow definition by id.
func (r *Repository) DeleteDef(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM lowcode_workflow_definition WHERE id = $1`, id)
	return err
}

// ============================================================
// Workflow Instance
// ============================================================

// CreateInst inserts a new workflow instance.
func (r *Repository) CreateInst(ctx context.Context, inst *models.WorkflowInstance) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO lowcode_workflow_instance
		 (id, workflow_id, workflow_definition_id, tenant_id, status, current_node_id,
		  variables, history, input, output, error, created_at, updated_at, completed_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
		inst.ID, inst.WorkflowID, inst.WorkflowDefinitionID, inst.TenantID,
		inst.Status, inst.CurrentNodeID,
		inst.Variables, inst.History, inst.Input, inst.Output, inst.Error,
		now, now, inst.CompletedAt)
	return err
}

// FindInstByID returns a workflow instance by its primary key.
func (r *Repository) FindInstByID(ctx context.Context, id string) (*models.WorkflowInstance, error) {
	var inst models.WorkflowInstance
	err := r.db.GetContext(ctx, &inst,
		`SELECT id, workflow_id, workflow_definition_id, tenant_id, status, current_node_id,
		        variables, history, input, output, error, created_at, updated_at, completed_at
		 FROM lowcode_workflow_instance WHERE id = $1`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &inst, nil
}

// FindInstsByWorkflowID returns instances for a workflow definition.
func (r *Repository) FindInstsByWorkflowID(ctx context.Context, workflowID string, status *string, offset, limit int) ([]models.WorkflowInstance, error) {
	var (
		insts []models.WorkflowInstance
		args  []interface{}
		sb    strings.Builder
	)
	sb.WriteString(`SELECT id, workflow_id, workflow_definition_id, tenant_id, status, current_node_id,
	                       variables, history, input, output, error, created_at, updated_at, completed_at
	                FROM lowcode_workflow_instance WHERE workflow_id = $1`)
	args = append(args, workflowID)
	argIdx := 2
	if status != nil {
		sb.WriteString(fmt.Sprintf(` AND status = $%d`, argIdx))
		args = append(args, *status)
		argIdx++
	}
	sb.WriteString(` ORDER BY created_at DESC`)
	sb.WriteString(fmt.Sprintf(` OFFSET $%d LIMIT $%d`, argIdx, argIdx+1))
	args = append(args, offset, limit)

	err := r.db.SelectContext(ctx, &insts, sb.String(), args...)
	return insts, err
}

// UpdateInst persists a full update of a workflow instance.
func (r *Repository) UpdateInst(ctx context.Context, inst *models.WorkflowInstance) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE lowcode_workflow_instance
		 SET status = $1, current_node_id = $2, variables = $3, history = $4,
		     input = $5, output = $6, error = $7, updated_at = $8, completed_at = $9
		 WHERE id = $10`,
		inst.Status, inst.CurrentNodeID, inst.Variables, inst.History,
		inst.Input, inst.Output, inst.Error, time.Now(), inst.CompletedAt, inst.ID)
	return err
}

// CleanupExpiredInsts deletes completed/failed/cancelled instances older than retentionDate.
func (r *Repository) CleanupExpiredInsts(ctx context.Context, retentionDate time.Time) (int, error) {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM lowcode_workflow_instance
		 WHERE status IN ('completed', 'failed', 'terminated')
		 AND updated_at < $1`, retentionDate)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}

// ============================================================
// Workflow Timer
// ============================================================

// CreateTimer inserts a new timer record.
func (r *Repository) CreateTimer(ctx context.Context, t *models.WorkflowTimer) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO workflow_timers
		 (id, instance_id, node_id, timer_type, duration_ms, cron_expression, timezone,
		  max_executions, execution_count, scheduled_at, last_executed_at, resume_event,
		  status, output_variables, result, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
		t.ID, t.InstanceID, t.NodeID, t.TimerType, t.DurationMs, t.CronExpression,
		t.Timezone, t.MaxExecutions, 0, t.ScheduledAt, nil, t.ResumeEvent,
		"pending", t.OutputVariables, nil, now, now)
	return err
}

// FindPendingTimers atomically claims up to 100 pending timers whose scheduled time has passed.
// It sets their status to 'running' and returns them.
func (r *Repository) FindPendingTimers(ctx context.Context) ([]models.WorkflowTimer, error) {
	var timers []models.WorkflowTimer
	err := r.db.SelectContext(ctx, &timers,
		`UPDATE workflow_timers
		 SET status = 'running', updated_at = NOW()
		 WHERE id IN (
		   SELECT id FROM workflow_timers
		   WHERE status = 'pending' AND scheduled_at <= NOW()
		   LIMIT 100
		   FOR UPDATE SKIP LOCKED
		 )
		 RETURNING id, instance_id, node_id, timer_type, duration_ms, cron_expression, timezone,
		           max_executions, execution_count, scheduled_at, last_executed_at, resume_event,
		           status, output_variables, result, created_at, updated_at`)
	return timers, err
}

// UpdateTimerStatus sets the status (and optional result) of a timer.
func (r *Repository) UpdateTimerStatus(ctx context.Context, id, status string, result models.JSONB) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE workflow_timers SET status = $1, result = $2, updated_at = NOW() WHERE id = $3`,
		status, result, id)
	return err
}

// IncrementTimerExecutions bumps execution_count and returns the new value.
func (r *Repository) IncrementTimerExecutions(ctx context.Context, id string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`UPDATE workflow_timers
		 SET execution_count = execution_count + 1, last_executed_at = NOW(), updated_at = NOW()
		 WHERE id = $1
		 RETURNING execution_count`, id)
	return count, err
}

// AddSubWorkflowDep records a parent-child instance dependency.
func (r *Repository) AddSubWorkflowDep(ctx context.Context, parentInstanceID, childInstanceID, nodeID string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO workflow_sub_workflow_dependencies (id, parent_instance_id, child_instance_id, node_id, created_at)
		 VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
		parentInstanceID, childInstanceID, nodeID)
	return err
}

// GetParentChain returns the ancestor instance ids for a given instance using a recursive CTE.
func (r *Repository) GetParentChain(ctx context.Context, instanceID string) ([]string, error) {
	var ids []string
	err := r.db.SelectContext(ctx, &ids,
		`WITH RECURSIVE ancestors AS (
		   SELECT parent_instance_id
		   FROM workflow_sub_workflow_dependencies
		   WHERE child_instance_id = $1
		   UNION ALL
		   SELECT d.parent_instance_id
		   FROM workflow_sub_workflow_dependencies d
		   JOIN ancestors a ON d.child_instance_id = a.parent_instance_id
		 )
		 SELECT parent_instance_id FROM ancestors`, instanceID)
	return ids, err
}

// ============================================================
// Workflow Task
// ============================================================

// CreateTask inserts a new task record.
func (r *Repository) CreateTask(ctx context.Context, t *models.WorkflowTask) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO workflow_tasks
		 (id, instance_id, node_id, task_type, assignee_type, assignee_id,
		  candidate_users, candidate_roles, title, description, status, priority,
		  due_date, form_data, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
		t.ID, t.InstanceID, t.NodeID, t.TaskType, t.AssigneeType, t.AssigneeID,
		t.CandidateUsers, t.CandidateRoles, t.Title, t.Description, "pending", t.Priority,
		t.DueDate, t.FormData, now, now)
	return err
}

// FindOverdueTasks returns pending/assigned tasks whose due_date is before the given time.
func (r *Repository) FindOverdueTasks(ctx context.Context, before time.Time) ([]models.WorkflowTask, error) {
	var tasks []models.WorkflowTask
	err := r.db.SelectContext(ctx, &tasks,
		`SELECT id, instance_id, node_id, task_type, assignee_type, assignee_id,
		        candidate_users, candidate_roles, title, description, status, priority,
		        due_date, completed_by, completed_at, comment, result, form_data,
		        created_at, updated_at
		 FROM workflow_tasks
		 WHERE status IN ('pending', 'assigned')
		   AND due_date IS NOT NULL
		   AND due_date < $1`, before)
	return tasks, err
}

// UpdateTask updates a task's form_data.
func (r *Repository) UpdateTask(ctx context.Context, id string, formData models.JSONB) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE workflow_tasks SET form_data = $1, updated_at = NOW() WHERE id = $2`,
		formData, id)
	return err
}

// UpdateTaskStatus sets a task's status and optional comment.
func (r *Repository) UpdateTaskStatus(ctx context.Context, id, status, completedBy, comment string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE workflow_tasks
		 SET status = $1, completed_by = $2, comment = $3, updated_at = NOW()
		 WHERE id = $4`,
		status, completedBy, comment, id)
	return err
}

// CompleteTask marks a task as completed and returns the updated row.
func (r *Repository) CompleteTask(ctx context.Context, id, completedBy string, result models.JSONB) (*models.WorkflowTask, error) {
	var t models.WorkflowTask
	err := r.db.GetContext(ctx, &t,
		`UPDATE workflow_tasks
		 SET status = 'completed', completed_by = $1, completed_at = NOW(), result = $2, updated_at = NOW()
		 WHERE id = $3
		 RETURNING id, instance_id, node_id, task_type, assignee_type, assignee_id,
		           candidate_users, candidate_roles, title, description, status, priority,
		           due_date, completed_by, completed_at, comment, result, form_data,
		           created_at, updated_at`,
		completedBy, result, id)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// ============================================================
// Workflow Trigger
// ============================================================

// CreateTrigger inserts a new trigger record.
func (r *Repository) CreateTrigger(ctx context.Context, t *models.WorkflowTrigger) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO workflow_triggers
		 (id, workflow_id, tenant_id, name, type, enabled, event_type, event_filter,
		  cron_expression, timezone, concurrency_limit, created_by, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
		t.ID, t.WorkflowID, t.TenantID, t.Name, t.Type, t.Enabled, t.EventType,
		t.EventFilter, t.CronExpression, t.Timezone, t.ConcurrencyLimit,
		t.CreatedBy, now, now)
	return err
}

// FindTriggerByID returns a trigger by its primary key.
func (r *Repository) FindTriggerByID(ctx context.Context, id string) (*models.WorkflowTrigger, error) {
	var t models.WorkflowTrigger
	err := r.db.GetContext(ctx, &t,
		`SELECT id, workflow_id, tenant_id, name, type, enabled, event_type, event_filter,
		        cron_expression, timezone, concurrency_limit, created_by, created_at, updated_at
		 FROM workflow_triggers WHERE id = $1`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

// FindTriggersByType returns all triggers of a given type (event or cron).
func (r *Repository) FindTriggersByType(ctx context.Context, triggerType string) ([]models.WorkflowTrigger, error) {
	var triggers []models.WorkflowTrigger
	err := r.db.SelectContext(ctx, &triggers,
		`SELECT id, workflow_id, tenant_id, name, type, enabled, event_type, event_filter,
		        cron_expression, timezone, concurrency_limit, created_by, created_at, updated_at
		 FROM workflow_triggers WHERE type = $1`, triggerType)
	return triggers, err
}

// FindTriggersByWorkflowID returns all triggers for a workflow definition.
func (r *Repository) FindTriggersByWorkflowID(ctx context.Context, workflowID string) ([]models.WorkflowTrigger, error) {
	var triggers []models.WorkflowTrigger
	err := r.db.SelectContext(ctx, &triggers,
		`SELECT id, workflow_id, tenant_id, name, type, enabled, event_type, event_filter,
		        cron_expression, timezone, concurrency_limit, created_by, created_at, updated_at
		 FROM workflow_triggers WHERE workflow_id = $1`, workflowID)
	return triggers, err
}

// ListTriggers returns a page of all triggers.
func (r *Repository) ListTriggers(ctx context.Context, offset, limit int) ([]models.WorkflowTrigger, int, error) {
	var (
		triggers []models.WorkflowTrigger
		total    int
	)
	if err := r.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM workflow_triggers`); err != nil {
		return nil, 0, err
	}
	err := r.db.SelectContext(ctx, &triggers,
		`SELECT id, workflow_id, tenant_id, name, type, enabled, event_type, event_filter,
		        cron_expression, timezone, concurrency_limit, created_by, created_at, updated_at
		 FROM workflow_triggers
		 ORDER BY created_at DESC
		 OFFSET $1 LIMIT $2`, offset, limit)
	return triggers, total, err
}

// FindEnabledCronTriggers returns all enabled cron triggers.
func (r *Repository) FindEnabledCronTriggers(ctx context.Context) ([]models.WorkflowTrigger, error) {
	var triggers []models.WorkflowTrigger
	err := r.db.SelectContext(ctx, &triggers,
		`SELECT id, workflow_id, tenant_id, name, type, enabled, event_type, event_filter,
		        cron_expression, timezone, concurrency_limit, created_by, created_at, updated_at
		 FROM workflow_triggers
		 WHERE type = 'cron' AND enabled = true`)
	return triggers, err
}

// UpdateTrigger updates a trigger record.
func (r *Repository) UpdateTrigger(ctx context.Context, t *models.WorkflowTrigger) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE workflow_triggers
		 SET name = $1, enabled = $2, event_type = $3, event_filter = $4,
		     cron_expression = $5, timezone = $6, concurrency_limit = $7, updated_at = NOW()
		 WHERE id = $8`,
		t.Name, t.Enabled, t.EventType, t.EventFilter,
		t.CronExpression, t.Timezone, t.ConcurrencyLimit, t.ID)
	return err
}

// DeleteTrigger removes a trigger by id.
func (r *Repository) DeleteTrigger(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM workflow_triggers WHERE id = $1`, id)
	return err
}

// ============================================================
// Workflow Version
// ============================================================

// CreateVersion inserts a new version snapshot.
func (r *Repository) CreateVersion(ctx context.Context, v *models.WorkflowVersion) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO lowcode_workflow_version (id, workflow_id, tenant_id, version, nodes, edges, commit_message, created_by, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
		v.ID, v.WorkflowID, v.TenantID, v.Version, v.Nodes, v.Edges, v.CommitMsg, v.CreatedBy)
	return err
}

// FindVersionsByWorkflowID returns version snapshots for a workflow.
func (r *Repository) FindVersionsByWorkflowID(ctx context.Context, tenantID, workflowID string, offset, limit int) ([]models.WorkflowVersion, int, error) {
	var (
		versions []models.WorkflowVersion
		total    int
	)
	if err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM lowcode_workflow_version WHERE workflow_id = $1 AND tenant_id = $2`,
		workflowID, tenantID); err != nil {
		return nil, 0, err
	}
	err := r.db.SelectContext(ctx, &versions,
		`SELECT id, workflow_id, tenant_id, version, nodes, edges, commit_message, created_by, created_at
		 FROM lowcode_workflow_version
		 WHERE workflow_id = $1 AND tenant_id = $2
		 ORDER BY created_at DESC
		 OFFSET $3 LIMIT $4`,
		workflowID, tenantID, offset, limit)
	return versions, total, err
}

// ============================================================
// Workflow Template
// ============================================================

// CreateTemplate inserts a new workflow template.
func (r *Repository) CreateTemplate(ctx context.Context, t *models.WorkflowTemplate) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO lowcode_workflow_template (id, tenant_id, name, description, category, thumbnail, definition, tags, usage_count, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9)`,
		t.ID, t.TenantID, t.Name, t.Description, t.Category, t.Thumbnail, t.Definition, t.Tags, t.CreatedBy)
	return err
}

// FindTemplateByID returns a template by id and tenant.
func (r *Repository) FindTemplateByID(ctx context.Context, tenantID, id string) (*models.WorkflowTemplate, error) {
	var t models.WorkflowTemplate
	err := r.db.GetContext(ctx, &t,
		`SELECT id, tenant_id, name, description, category, thumbnail, definition, tags, usage_count, created_by, created_at
		 FROM lowcode_workflow_template
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

// ListTemplates returns a page of templates for a tenant.
func (r *Repository) ListTemplates(ctx context.Context, tenantID string, offset, limit int) ([]models.WorkflowTemplate, int, error) {
	var (
		templates []models.WorkflowTemplate
		total     int
	)
	if err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM lowcode_workflow_template WHERE tenant_id = $1`, tenantID); err != nil {
		return nil, 0, err
	}
	err := r.db.SelectContext(ctx, &templates,
		`SELECT id, tenant_id, name, description, category, thumbnail, definition, tags, usage_count, created_by, created_at
		 FROM lowcode_workflow_template
		 WHERE tenant_id = $1
		 ORDER BY created_at DESC
		 OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return templates, total, err
}

// IncrementTemplateUsage bumps usage_count for a template.
func (r *Repository) IncrementTemplateUsage(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE lowcode_workflow_template SET usage_count = usage_count + 1 WHERE id = $1`,
		id)
	return err
}
