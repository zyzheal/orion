package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/chatops/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides data access for all ChatOps entities.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ==================== ChatChannel (legacy CRUD) ====================

func (r *Repository) Create(ctx context.Context, d *models.ChatChannel) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO chat_channels (id, tenant_id, name, channel, command, response, platform, metadata)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		d.ID, d.TenantID, d.Name, d.Channel, d.Command, d.Response, d.Platform, d.Metadata)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.ChatChannel, error) {
	var items []models.ChatChannel
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chat_channels WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ChatChannel, error) {
	var d models.ChatChannel
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM chat_channels WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) Update(ctx context.Context, d *models.ChatChannel) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE chat_channels SET name=$1, channel=$2, command=$3, response=$4, platform=$5, metadata=$6
		 WHERE id=$7 AND tenant_id=$8`,
		d.Name, d.Channel, d.Command, d.Response, d.Platform, d.Metadata, d.ID, d.TenantID)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chat_channels WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM chat_channels WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ==================== Command ====================

func (r *Repository) CreateCommand(ctx context.Context, d *models.ChatOpsCommand) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO chatops_commands (id, tenant_id, name, subcommand, schema_def, aliases, permission_level, examples, enabled)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		d.ID, d.TenantID, d.Name, d.Subcommand, d.SchemaDef, d.Aliases, d.PermissionLevel, d.Examples, d.Enabled)
	return err
}

func (r *Repository) GetCommandByName(ctx context.Context, tenantID, name string) (*models.ChatOpsCommand, error) {
	var d models.ChatOpsCommand
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM chatops_commands WHERE tenant_id=$1 AND name=$2`, tenantID, name)
	if err != nil {
		return nil, err
	}
	return &d, nil
}


func (r *Repository) GetCommandByID(ctx context.Context, tenantID, id string) (*models.ChatOpsCommand, error) {
	var d models.ChatOpsCommand
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM chatops_commands WHERE tenant_id=$1 AND id=$2`, tenantID, id)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) GetCommandByAlias(ctx context.Context, tenantID, alias string) (*models.ChatOpsCommand, error) {
	var items []models.ChatOpsCommand
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_commands WHERE tenant_id=$1 AND enabled=true`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, cmd := range items {
		for _, a := range cmd.Aliases {
			if a == alias {
				return &cmd, nil
			}
		}
	}
	return nil, fmt.Errorf("command not found: %s", alias)
}

func (r *Repository) ListCommands(ctx context.Context, tenantID string, offset, limit int) ([]models.ChatOpsCommand, error) {
	var items []models.ChatOpsCommand
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_commands WHERE tenant_id=$1 ORDER BY name OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) ListCommandsByPermission(ctx context.Context, tenantID, permissionLevel string) ([]models.ChatOpsCommand, error) {
	var items []models.ChatOpsCommand
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_commands WHERE tenant_id=$1 AND permission_level=$2 ORDER BY name`,
		tenantID, permissionLevel)
	return items, err
}

func (r *Repository) UpdateCommand(ctx context.Context, d *models.ChatOpsCommand) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE chatops_commands SET subcommand=$1, schema_def=$2, aliases=$3, permission_level=$4, examples=$5, enabled=$6, updated_at=$7
		 WHERE id=$8 AND tenant_id=$9`,
		d.Subcommand, d.SchemaDef, d.Aliases, d.PermissionLevel, d.Examples, d.Enabled, time.Now(), d.ID, d.TenantID)
	return err
}

func (r *Repository) DeleteCommand(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_commands WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) CountCommands(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM chatops_commands WHERE tenant_id=$1`, tenantID)
	return count, err
}

// SeedCommands inserts default commands if the table is empty for a tenant.
func (r *Repository) SeedCommands(ctx context.Context, tenantID string, commands []models.ChatOpsCommand) error {
	count, err := r.CountCommands(ctx, tenantID)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	for i := range commands {
		if err := r.CreateCommand(ctx, &commands[i]); err != nil {
			return err
		}
	}
	return nil
}

// ==================== Execution ====================

func (r *Repository) CreateExecution(ctx context.Context, d *models.ChatOpsExecution) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO chatops_executions (id, tenant_id, command_id, user_id, platform, channel, params, status, start_time, end_time, result, milestones)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		d.ID, d.TenantID, d.CommandID, d.UserID, d.Platform, d.Channel, d.Params, d.Status, d.StartTime, d.EndTime, d.Result, d.Milestones)
	return err
}

func (r *Repository) GetExecution(ctx context.Context, tenantID, id string) (*models.ChatOpsExecution, error) {
	var d models.ChatOpsExecution
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM chatops_executions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) UpdateExecutionStatus(ctx context.Context, tenantID, id, status string, endTime *time.Time, result models.JSONB) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE chatops_executions SET status=$1, end_time=$2, result=$3 WHERE id=$4 AND tenant_id=$5`,
		status, endTime, result, id, tenantID)
	return err
}

func (r *Repository) UpdateExecutionMilestones(ctx context.Context, tenantID, id string, milestones models.JSONB) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE chatops_executions SET milestones=$1 WHERE id=$2 AND tenant_id=$3`,
		milestones, id, tenantID)
	return err
}

func (r *Repository) ListExecutions(ctx context.Context, tenantID string, offset, limit int) ([]models.ChatOpsExecution, error) {
	var items []models.ChatOpsExecution
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_executions WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) ListExecutionsByUser(ctx context.Context, tenantID, userID string, offset, limit int) ([]models.ChatOpsExecution, error) {
	var items []models.ChatOpsExecution
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_executions WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`,
		tenantID, userID, offset, limit)
	return items, err
}

func (r *Repository) ListExecutionsByCommand(ctx context.Context, tenantID, commandID string, offset, limit int) ([]models.ChatOpsExecution, error) {
	var items []models.ChatOpsExecution
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_executions WHERE tenant_id=$1 AND command_id=$2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`,
		tenantID, commandID, offset, limit)
	return items, err
}

func (r *Repository) ListExecutionsByStatus(ctx context.Context, tenantID, status string, offset, limit int) ([]models.ChatOpsExecution, error) {
	var items []models.ChatOpsExecution
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_executions WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`,
		tenantID, status, offset, limit)
	return items, err
}

func (r *Repository) CountExecutions(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM chatops_executions WHERE tenant_id=$1`, tenantID)
	return count, err
}


// CountExecutionsInWindow counts executions for a user within a time window.
// If commandName is non-empty, only counts executions for that specific command.
func (r *Repository) CountExecutionsInWindow(ctx context.Context, tenantID, userID, commandName string, since time.Time) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM chatops_executions WHERE tenant_id=$1 AND user_id=$2 AND created_at >= $3`
	args := []interface{}{tenantID, userID, since}
	if commandName != "" {
		query += ` AND command_id IN (SELECT id FROM chatops_commands WHERE tenant_id=$1 AND name=$4)`
		args = append(args, commandName)
	}
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

// ==================== Session ====================

func (r *Repository) CreateSession(ctx context.Context, d *models.ChatOpsSession) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO chatops_sessions (id, tenant_id, session_key, user_id, channel_id, history, state)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		d.ID, d.TenantID, d.SessionKey, d.UserID, d.ChannelID, d.History, d.State)
	return err
}

func (r *Repository) GetSessionByKey(ctx context.Context, tenantID, key string) (*models.ChatOpsSession, error) {
	var d models.ChatOpsSession
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM chatops_sessions WHERE tenant_id=$1 AND session_key=$2`, tenantID, key)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) UpdateSessionState(ctx context.Context, tenantID, key string, state, history models.JSONB) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE chatops_sessions SET state=$1, history=$2, updated_at=$3 WHERE tenant_id=$4 AND session_key=$5`,
		state, history, time.Now(), tenantID, key)
	return err
}

func (r *Repository) DeleteSession(ctx context.Context, tenantID, key string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_sessions WHERE tenant_id=$1 AND session_key=$2`, tenantID, key)
	return err
}

// ==================== Audit Log ====================

func (r *Repository) CreateAuditLog(ctx context.Context, d *models.ChatOpsAuditLog) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO chatops_audit_logs (id, tenant_id, trace_id, actor, action, result, context)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		d.ID, d.TenantID, d.TraceID, d.Actor, d.Action, d.Result, d.Context)
	return err
}

func (r *Repository) ListAuditLogs(ctx context.Context, tenantID string, offset, limit int) ([]models.ChatOpsAuditLog, error) {
	var items []models.ChatOpsAuditLog
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_audit_logs WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) ListAuditLogsByTraceID(ctx context.Context, tenantID, traceID string) ([]models.ChatOpsAuditLog, error) {
	var items []models.ChatOpsAuditLog
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_audit_logs WHERE tenant_id=$1 AND trace_id=$2 ORDER BY created_at DESC`,
		tenantID, traceID)
	return items, err
}

func (r *Repository) CountAuditLogs(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM chatops_audit_logs WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) CountAuditLogsByResult(ctx context.Context, tenantID, result string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM chatops_audit_logs WHERE tenant_id=$1 AND result=$2`, tenantID, result)
	return count, err
}

// ==================== Webhook ====================

func (r *Repository) CreateWebhook(ctx context.Context, d *models.ChatOpsWebhook) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO chatops_webhooks (id, tenant_id, name, url, events, secret_key, enabled, retry_count, retry_interval_seconds, timeout_seconds, headers, description, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		d.ID, d.TenantID, d.Name, d.URL, d.Events, d.SecretKey, d.Enabled, d.RetryCount, d.RetryIntervalSeconds, d.TimeoutSeconds, d.Headers, d.Description, d.CreatedBy)
	return err
}

func (r *Repository) GetWebhook(ctx context.Context, tenantID, id string) (*models.ChatOpsWebhook, error) {
	var d models.ChatOpsWebhook
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM chatops_webhooks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) ListWebhooks(ctx context.Context, tenantID string) ([]models.ChatOpsWebhook, error) {
	var items []models.ChatOpsWebhook
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_webhooks WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) ListEnabledWebhooks(ctx context.Context, tenantID string) ([]models.ChatOpsWebhook, error) {
	var items []models.ChatOpsWebhook
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_webhooks WHERE tenant_id=$1 AND enabled=true ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) UpdateWebhook(ctx context.Context, d *models.ChatOpsWebhook) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE chatops_webhooks SET name=$1, url=$2, events=$3, secret_key=$4, enabled=$5, retry_count=$6, retry_interval_seconds=$7, timeout_seconds=$8, headers=$9, description=$10, updated_at=$11
		 WHERE id=$12 AND tenant_id=$13`,
		d.Name, d.URL, d.Events, d.SecretKey, d.Enabled, d.RetryCount, d.RetryIntervalSeconds, d.TimeoutSeconds, d.Headers, d.Description, time.Now(), d.ID, d.TenantID)
	return err
}

func (r *Repository) DeleteWebhook(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_webhooks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) UpdateWebhookTriggerStatus(ctx context.Context, tenantID, id, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE chatops_webhooks SET last_triggered_at=$1, last_status=$2 WHERE id=$3 AND tenant_id=$4`,
		time.Now(), status, id, tenantID)
	return err
}

// ==================== Webhook Log ====================

func (r *Repository) CreateWebhookLog(ctx context.Context, d *models.ChatOpsWebhookLog) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO chatops_webhook_logs (id, tenant_id, webhook_id, event_type, payload, response_status, response_body, error_message, retry_count)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		d.ID, d.TenantID, d.WebhookID, d.EventType, d.Payload, d.ResponseStatus, d.ResponseBody, d.ErrorMessage, d.RetryCount)
	return err
}

func (r *Repository) ListWebhookLogs(ctx context.Context, tenantID, webhookID string, limit int) ([]models.ChatOpsWebhookLog, error) {
	var items []models.ChatOpsWebhookLog
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_webhook_logs WHERE tenant_id=$1 AND webhook_id=$2 ORDER BY created_at DESC LIMIT $3`,
		tenantID, webhookID, limit)
	return items, err
}

// ==================== Rate Limit ====================

func (r *Repository) CreateRateLimit(ctx context.Context, d *models.ChatOpsRateLimit) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO chatops_rate_limits (id, tenant_id, target_type, target_id, command_name, limit_type, limit_count, window_seconds, description, enabled)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		d.ID, d.TenantID, d.TargetType, d.TargetID, d.CommandName, d.LimitType, d.LimitCount, d.WindowSeconds, d.Description, d.Enabled)
	return err
}

func (r *Repository) GetRateLimit(ctx context.Context, tenantID, id string) (*models.ChatOpsRateLimit, error) {
	var d models.ChatOpsRateLimit
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM chatops_rate_limits WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) ListRateLimits(ctx context.Context, tenantID string) ([]models.ChatOpsRateLimit, error) {
	var items []models.ChatOpsRateLimit
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_rate_limits WHERE tenant_id=$1 ORDER BY target_type, command_name`, tenantID)
	return items, err
}

func (r *Repository) UpdateRateLimit(ctx context.Context, d *models.ChatOpsRateLimit) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE chatops_rate_limits SET target_type=$1, target_id=$2, command_name=$3, limit_type=$4, limit_count=$5, window_seconds=$6, description=$7, enabled=$8, updated_at=$9
		 WHERE id=$10 AND tenant_id=$11`,
		d.TargetType, d.TargetID, d.CommandName, d.LimitType, d.LimitCount, d.WindowSeconds, d.Description, d.Enabled, time.Now(), d.ID, d.TenantID)
	return err
}

func (r *Repository) DeleteRateLimit(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_rate_limits WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// GetRateLimitsForCommand returns all enabled rate limits that apply to the given command/user.
func (r *Repository) GetRateLimitsForCommand(ctx context.Context, tenantID, userID, commandName string) ([]models.ChatOpsRateLimit, error) {
	var items []models.ChatOpsRateLimit
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_rate_limits
		 WHERE tenant_id=$1 AND enabled=true
		 AND (
		   (target_type = 'command' AND command_name = $2)
		   OR (target_type = 'user' AND target_id IS NULL)
		   OR (target_type = 'user' AND target_id = $3)
		 )`,
		tenantID, commandName, userID)
	return items, err
}

// ==================== Question Config ====================

func (r *Repository) GetQuestionConfigs(ctx context.Context, tenantID, userID string) ([]models.ChatOpsQuestionConfig, error) {
	var items []models.ChatOpsQuestionConfig
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_question_configs WHERE tenant_id=$1 AND user_id=$2 ORDER BY sort_order`,
		tenantID, userID)
	return items, err
}

func (r *Repository) UpsertQuestionConfig(ctx context.Context, tenantID, userID string, d *models.ChatOpsQuestionConfig) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO chatops_question_configs (id, tenant_id, user_id, key, icon, title, description, question, enabled, sort_order)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		 ON CONFLICT (tenant_id, user_id, key) DO UPDATE SET
		   icon=$5, title=$6, description=$7, question=$8, enabled=$9, sort_order=$10, updated_at=NOW()`,
		d.ID, tenantID, userID, d.Key, d.Icon, d.Title, d.Description, d.Question, d.Enabled, d.SortOrder)
	return err
}

func (r *Repository) DeleteQuestionConfig(ctx context.Context, tenantID, userID, key string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_question_configs WHERE tenant_id=$1 AND user_id=$2 AND key=$3`,
		tenantID, userID, key)
	return err
}

// ==================== Command Config ====================

func (r *Repository) GetCommandConfigs(ctx context.Context, tenantID, userID string) ([]models.ChatOpsCommandConfig, error) {
	var items []models.ChatOpsCommandConfig
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_command_configs WHERE tenant_id=$1 AND user_id=$2 ORDER BY sort_order`,
		tenantID, userID)
	return items, err
}

func (r *Repository) UpsertCommandConfig(ctx context.Context, tenantID, userID string, d *models.ChatOpsCommandConfig) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO chatops_command_configs (id, tenant_id, user_id, key, label, command, enabled, sort_order)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		 ON CONFLICT (tenant_id, user_id, key) DO UPDATE SET
		   label=$5, command=$6, enabled=$7, sort_order=$8, updated_at=NOW()`,
		d.ID, tenantID, userID, d.Key, d.Label, d.Command, d.Enabled, d.SortOrder)
	return err
}

func (r *Repository) DeleteCommandConfig(ctx context.Context, tenantID, userID, key string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_command_configs WHERE tenant_id=$1 AND user_id=$2 AND key=$3`,
		tenantID, userID, key)
	return err
}
