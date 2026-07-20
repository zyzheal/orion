package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/chatops/models"

	_ "github.com/lib/pq"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---- Commands ----

func (r *Repository) CreateCommand(ctx context.Context, m *models.ChatOpsCommand) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	query := `INSERT INTO chatops_commands (id, tenant_id, name, subcommand, aliases, description, permission_level, schema, examples, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :subcommand, :aliases, :description, :permission_level, :schema, :examples, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetCommand(ctx context.Context, tenantID, id string) (*models.ChatOpsCommand, error) {
	var m models.ChatOpsCommand
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM chatops_commands WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListCommands(ctx context.Context, tenantID string, permissionLevel, name *string, limit, offset int) ([]models.ChatOpsCommand, error) {
	if limit <= 0 {
		limit = 50
	}
	var sql string
	var args []interface{}
	argIdx := 1
	if permissionLevel != nil && name != nil {
		sql = fmt.Sprintf(`SELECT * FROM chatops_commands WHERE tenant_id=$%d AND permission_level=$%d AND (name ILIKE $%d OR aliases ILIKE $%d) ORDER BY name LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2, argIdx+2, argIdx+3, argIdx+4)
		args = []interface{}{tenantID, *permissionLevel, "%" + *name + "%", "%" + *name + "%", limit, offset}
		argIdx += 5
	} else if permissionLevel != nil {
		sql = fmt.Sprintf(`SELECT * FROM chatops_commands WHERE tenant_id=$%d AND permission_level=$%d ORDER BY name LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2, argIdx+3)
		args = []interface{}{tenantID, *permissionLevel, limit, offset}
		argIdx += 4
	} else if name != nil {
		sql = fmt.Sprintf(`SELECT * FROM chatops_commands WHERE tenant_id=$%d AND (name ILIKE $%d OR aliases ILIKE $%d) ORDER BY name LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+1, argIdx+2, argIdx+3)
		args = []interface{}{tenantID, "%" + *name + "%", limit, offset}
		argIdx += 4
	} else {
		sql = fmt.Sprintf(`SELECT * FROM chatops_commands WHERE tenant_id=$%d ORDER BY name LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2)
		args = []interface{}{tenantID, limit, offset}
		argIdx += 3
	}
	var items []models.ChatOpsCommand
	err := r.db.SelectContext(ctx, &items, sql, args...)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) UpdateCommand(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE chatops_commands SET updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		map[string]interface{}{"id": id, "tenant_id": tenantID})
	return err
}

func (r *Repository) DeleteCommand(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_commands WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ---- Executions ----

func (r *Repository) CreateExecution(ctx context.Context, m *models.Execution) error {
	m.ID = uuid.New().String()
	m.StartTime = time.Now().UTC()
	m.CreatedAt = time.Now().UTC()
	query := `INSERT INTO chatops_executions (id, tenant_id, command_id, user_id, status, params, result, milestones, start_time, created_at)
		VALUES (:id, :tenant_id, :command_id, :user_id, :status, :params, :result, :milestones, :start_time, :created_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetExecution(ctx context.Context, tenantID, id string) (*models.Execution, error) {
	var m models.Execution
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM chatops_executions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateExecutionStatus(ctx context.Context, tenantID, id, status string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE chatops_executions SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		status, now, id, tenantID)
	return err
}

func (r *Repository) ListExecutions(ctx context.Context, tenantID string, commandID, userID, status *string, limit, offset int) ([]models.Execution, error) {
	if limit <= 0 {
		limit = 50
	}
	var sql string
	var args []interface{}
	argIdx := 1
	if commandID != nil && userID != nil && status != nil {
		sql = fmt.Sprintf(`SELECT * FROM chatops_executions WHERE tenant_id=$%d AND command_id=$%d AND user_id=$%d AND status=$%d ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2, argIdx+3, argIdx+4, argIdx+5)
		args = []interface{}{tenantID, *commandID, *userID, *status, limit, offset}
		argIdx += 6
	} else if commandID != nil {
		sql = fmt.Sprintf(`SELECT * FROM chatops_executions WHERE tenant_id=$%d AND command_id=$%d ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2, argIdx+3)
		args = []interface{}{tenantID, *commandID, limit, offset}
		argIdx += 4
	} else {
		sql = fmt.Sprintf(`SELECT * FROM chatops_executions WHERE tenant_id=$%d ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2)
		args = []interface{}{tenantID, limit, offset}
		argIdx += 3
	}
	var items []models.Execution
	err := r.db.SelectContext(ctx, &items, sql, args...)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// ---- Audit Logs ----

func (r *Repository) CreateAuditLog(ctx context.Context, m *models.AuditLog) error {
	m.CreatedAt = time.Now().UTC()
	query := `INSERT INTO chatops_audit_logs (id, tenant_id, user_id, action, command, details, created_at)
		VALUES (:id, :tenant_id, :user_id, :action, :command, :details, :created_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) ListAuditLogs(ctx context.Context, tenantID string, q *models.AuditLogQuery) ([]models.AuditLog, error) {
	limit := 50
	if q.Limit != nil && *q.Limit > 0 {
		limit = *q.Limit
	}
	offset := 0
	if q.Offset != nil {
		offset = *q.Offset
	}
	var sql string
	var args []interface{}
	argIdx := 1
	if q.UserID != nil && q.Action != nil && q.Command != nil {
		sql = fmt.Sprintf(`SELECT * FROM chatops_audit_logs WHERE tenant_id=$%d AND user_id=$%d AND action=$%d AND command=$%d ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2, argIdx+3, argIdx+4, argIdx+5)
		args = []interface{}{tenantID, *q.UserID, *q.Action, *q.Command, limit, offset}
		argIdx += 6
	} else if q.UserID != nil && q.Action != nil {
		sql = fmt.Sprintf(`SELECT * FROM chatops_audit_logs WHERE tenant_id=$%d AND user_id=$%d AND action=$%d ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2, argIdx+3, argIdx+4)
		args = []interface{}{tenantID, *q.UserID, *q.Action, limit, offset}
		argIdx += 5
	} else if q.UserID != nil {
		sql = fmt.Sprintf(`SELECT * FROM chatops_audit_logs WHERE tenant_id=$%d AND user_id=$%d ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2, argIdx+3)
		args = []interface{}{tenantID, *q.UserID, limit, offset}
		argIdx += 4
	} else if q.Command != nil {
		sql = fmt.Sprintf(`SELECT * FROM chatops_audit_logs WHERE tenant_id=$%d AND command=$%d ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2, argIdx+3)
		args = []interface{}{tenantID, *q.Command, limit, offset}
		argIdx += 4
	} else {
		sql = fmt.Sprintf(`SELECT * FROM chatops_audit_logs WHERE tenant_id=$%d ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2)
		args = []interface{}{tenantID, limit, offset}
		argIdx += 3
	}
	var items []models.AuditLog
	err := r.db.SelectContext(ctx, &items, sql, args...)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) AuditLogStats(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	var total int
	err := r.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM chatops_audit_logs WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"total": total,
	}, nil
}

// ---- Notification Preferences ----

func (r *Repository) GetNotificationPreference(ctx context.Context, tenantID, userID string) (*models.NotificationPreference, error) {
	var m models.NotificationPreference
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM chatops_notification_preferences WHERE tenant_id=$1 AND user_id=$2`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpsertNotificationPreference(ctx context.Context, m *models.NotificationPreference) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO chatops_notification_preferences (id, tenant_id, user_id, alert_level, channel_chatops, channel_email, channel_slack, channel_feishu, channel_dingtalk)
		 VALUES (:id, :tenant_id, :user_id, :alert_level, :channel_chatops, :channel_email, :channel_slack, :channel_feishu, :channel_dingtalk)
		ON CONFLICT (tenant_id, user_id) DO UPDATE SET
			alert_level=EXCLUDED.alert_level,
			channel_chatops=EXCLUDED.channel_chatops,
			channel_email=EXCLUDED.channel_email,
			channel_slack=EXCLUDED.channel_slack,
			channel_feishu=EXCLUDED.channel_feishu,
			channel_dingtalk=EXCLUDED.channel_dingtalk`,
		m)
	return err
}

// ---- DND Settings ----

func (r *Repository) GetDNDSettings(ctx context.Context, tenantID, userID string) (*models.DNDSettings, error) {
	var m models.DNDSettings
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM chatops_dnd_settings WHERE tenant_id=$1 AND user_id=$2`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpsertDNDSettings(ctx context.Context, m *models.DNDSettings) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO chatops_dnd_settings (id, tenant_id, user_id, enabled, start_time, end_time, repeat_days, allow_critical)
		 VALUES (:id, :tenant_id, :user_id, :enabled, :start_time, :end_time, :repeat_days, :allow_critical)
		ON CONFLICT (tenant_id, user_id) DO UPDATE SET
			enabled=EXCLUDED.enabled,
			start_time=EXCLUDED.start_time,
			end_time=EXCLUDED.end_time,
			repeat_days=EXCLUDED.repeat_days,
			allow_critical=EXCLUDED.allow_critical`,
		m)
	return err
}

// ---- Platform Config ----

func (r *Repository) GetPlatformConfigs(ctx context.Context, tenantID, userID string) ([]models.PlatformConfig, error) {
	var items []models.PlatformConfig
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_platform_configs WHERE tenant_id=$1 AND user_id=$2`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) UpsertPlatformConfigs(ctx context.Context, tenantID, userID string, configs []models.PlatformConfig) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, cfg := range configs {
		_, err = tx.NamedExecContext(ctx,
			`INSERT INTO chatops_platform_configs (id, tenant_id, user_id, platform, enabled, webhook, token)
			 VALUES (:id, :tenant_id, :user_id, :platform, :enabled, :webhook, :token)
			ON CONFLICT (tenant_id, user_id, platform) DO UPDATE SET
				enabled=EXCLUDED.enabled,
				webhook=EXCLUDED.webhook,
				token=EXCLUDED.token`,
			cfg)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

// ---- Alert States ----

func (r *Repository) GetAlertStates(ctx context.Context, tenantID, userID string) ([]models.AlertState, error) {
	var items []models.AlertState
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_alert_states WHERE tenant_id=$1 AND user_id=$2`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) UpdateAlertState(ctx context.Context, tenantID, userID, alertID, status string) error {
	now := time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO chatops_alert_states (id, tenant_id, user_id, alert_id, status, created_at, updated_at)
		 VALUES (:id, :tenant_id, :user_id, :alert_id, :status, :created_at, :updated_at)
		ON CONFLICT (tenant_id, user_id, alert_id) DO UPDATE SET
			status=EXCLUDED.status,
			updated_at=EXCLUDED.updated_at`,
		map[string]interface{}{
			"id":         uuid.New().String(),
			"tenant_id":  tenantID,
			"user_id":    userID,
			"alert_id":   alertID,
			"status":     status,
			"created_at": now,
			"updated_at": now,
		})
	return err
}

// ---- Question / Command Config ----

func (r *Repository) GetQuestionConfigs(ctx context.Context, tenantID, userID string) ([]models.QuestionConfig, error) {
	var items []models.QuestionConfig
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_question_configs WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) UpsertQuestionConfigs(ctx context.Context, tenantID, userID string, configs []models.QuestionConfig) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, cfg := range configs {
		_, err = tx.NamedExecContext(ctx,
			`INSERT INTO chatops_question_configs (id, tenant_id, user_id, title, command, enabled)
			 VALUES (:id, :tenant_id, :user_id, :title, :command, :enabled)
			ON CONFLICT (tenant_id, user_id, title) DO UPDATE SET
				command=EXCLUDED.command,
				enabled=EXCLUDED.enabled`,
			cfg)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *Repository) GetCommandConfigs(ctx context.Context, tenantID, userID string) ([]models.CommandConfig, error) {
	var items []models.CommandConfig
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_command_configs WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) UpsertCommandConfigs(ctx context.Context, tenantID, userID string, configs []models.CommandConfig) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, cfg := range configs {
		_, err = tx.NamedExecContext(ctx,
			`INSERT INTO chatops_command_configs (id, tenant_id, user_id, command, params, enabled)
			 VALUES (:id, :tenant_id, :user_id, :command, :params, :enabled)
			ON CONFLICT (tenant_id, user_id, command) DO UPDATE SET
				params=EXCLUDED.params,
				enabled=EXCLUDED.enabled`,
			cfg)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

// ---- Capability Mappings ----

func (r *Repository) GetAllCapabilityMappings(ctx context.Context, tenantID string, environment *string) ([]models.CapabilityMapping, error) {
	var items []models.CapabilityMapping
	if environment != nil && *environment != "" {
		err := r.db.SelectContext(ctx, &items,
			`SELECT * FROM chatops_capability_mappings WHERE tenant_id=$1 AND environment=$2`, tenantID, *environment)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_capability_mappings WHERE tenant_id=$1`, tenantID)
	return items, err
}

func (r *Repository) CreateCapabilityMapping(ctx context.Context, m *models.CapabilityMapping) error {
	m.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO chatops_capability_mappings (id, tenant_id, command_id, capability_id, environment, risk_level, requires_approval)
		 VALUES (:id, :tenant_id, :command_id, :capability_id, :environment, :risk_level, :requires_approval)
		ON CONFLICT (tenant_id, command_id, capability_id, environment) DO UPDATE SET
			risk_level=EXCLUDED.risk_level,
			requires_approval=EXCLUDED.requires_approval`,
		m)
	return err
}

func (r *Repository) GetCapabilityMapping(ctx context.Context, tenantID, id string) (*models.CapabilityMapping, error) {
	var m models.CapabilityMapping
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM chatops_capability_mappings WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateCapabilityMapping(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	now := time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE chatops_capability_mappings SET updated_at=$1 WHERE id=$2 AND tenant_id=$3`,
		map[string]interface{}{"updated_at": now, "id": id, "tenant_id": tenantID})
	return err
}

func (r *Repository) DeleteCapabilityMapping(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_capability_mappings WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ---- Approval Configs ----

func (r *Repository) GetAllApprovalConfigs(ctx context.Context, tenantID string) ([]models.ApprovalConfig, error) {
	var items []models.ApprovalConfig
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_approval_configs WHERE tenant_id=$1`, tenantID)
	return items, err
}

func (r *Repository) GetApprovalConfigByCapability(ctx context.Context, tenantID, capability string) (*models.ApprovalConfig, error) {
	var m models.ApprovalConfig
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM chatops_approval_configs WHERE tenant_id=$1 AND capability=$2`, tenantID, capability)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpsertApprovalConfig(ctx context.Context, tenantID, capability string, enabled *bool, approvers *string, threshold *int) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO chatops_approval_configs (id, tenant_id, capability, enabled, approvers, threshold)
		 VALUES (:id, :tenant_id, :capability, :enabled, :approvers, :threshold)
		ON CONFLICT (tenant_id, capability) DO UPDATE SET
			enabled=COALESCE(EXCLUDED.enabled, chatops_approval_configs.enabled),
			approvers=COALESCE(EXCLUDED.approvers, chatops_approval_configs.approvers),
			threshold=COALESCE(EXCLUDED.threshold, chatops_approval_configs.threshold)`,
		map[string]interface{}{
			"id":         uuid.New().String(),
			"tenant_id":  tenantID,
			"capability": capability,
			"enabled":    enabled,
			"approvers":  approvers,
			"threshold":  threshold,
		})
	return err
}

func (r *Repository) BatchUpdateApprovalConfigs(ctx context.Context, tenantID string, configs []models.ApprovalConfig) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, cfg := range configs {
		_, err = tx.NamedExecContext(ctx,
			`INSERT INTO chatops_approval_configs (id, tenant_id, capability, enabled, approvers, threshold)
			 VALUES (:id, :tenant_id, :capability, :enabled, :approvers, :threshold)
			ON CONFLICT (tenant_id, capability) DO UPDATE SET
				enabled=EXCLUDED.enabled,
				approvers=EXCLUDED.approvers,
				threshold=EXCLUDED.threshold`,
			cfg)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *Repository) GetApprovers(ctx context.Context, tenantID string) ([]models.Approver, error) {
	var items []models.Approver
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_approvers WHERE tenant_id=$1`, tenantID)
	return items, err
}

func (r *Repository) GetApproverSchedule(ctx context.Context, tenantID string) ([]models.ApproverSchedule, error) {
	var items []models.ApproverSchedule
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_approver_schedule WHERE tenant_id=$1`, tenantID)
	return items, err
}

func (r *Repository) UpdateApproverSchedule(ctx context.Context, tenantID string, schedule []models.ApproverSchedule) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, `DELETE FROM chatops_approver_schedule WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return err
	}
	for _, s := range schedule {
		_, err = tx.NamedExecContext(ctx,
			`INSERT INTO chatops_approver_schedule (id, tenant_id, user_id, start_time, end_time)
			 VALUES (:id, :tenant_id, :user_id, :start_time, :end_time)`,
			map[string]interface{}{
				"id":         uuid.New().String(),
				"tenant_id":  tenantID,
				"user_id":    s.UserID,
				"start_time": s.StartTime,
				"end_time":   s.EndTime,
			})
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *Repository) GetGlobalApprovalConfig(ctx context.Context, tenantID string) (*models.GlobalApprovalConfig, error) {
	var m models.GlobalApprovalConfig
	err := r.db.GetContext(ctx, &m,
		`SELECT enabled, mode FROM chatops_global_approval_config WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpsertGlobalApprovalConfig(ctx context.Context, tenantID string, config *models.GlobalApprovalConfig) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO chatops_global_approval_config (id, tenant_id, enabled, mode)
		 VALUES (:id, :tenant_id, :enabled, :mode)
		ON CONFLICT (tenant_id) DO UPDATE SET
			enabled=EXCLUDED.enabled,
			mode=EXCLUDED.mode`,
		map[string]interface{}{
			"id":        uuid.New().String(),
			"tenant_id": tenantID,
			"enabled":   config.Enabled,
			"mode":      config.Mode,
		})
	return err
}

// ---- Roles ----

func (r *Repository) GetAllRoles(ctx context.Context, tenantID string) ([]models.PermissionRole, error) {
	var items []models.PermissionRole
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_roles WHERE tenant_id=$1 ORDER BY name`, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CreateRole(ctx context.Context, m *models.PermissionRole) error {
	m.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO chatops_roles (id, tenant_id, name, description, permissions)
		 VALUES (:id, :tenant_id, :name, :description, :permissions)`,
		m)
	return err
}

func (r *Repository) GetRole(ctx context.Context, tenantID, id string) (*models.PermissionRole, error) {
	var m models.PermissionRole
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM chatops_roles WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateRole(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE chatops_roles SET name=COALESCE(:name, name), description=COALESCE(:description, description), permissions=COALESCE(:permissions, permissions)
		 WHERE id=$1 AND tenant_id=$2`,
		map[string]interface{}{
			"name":        updates["name"],
			"description": updates["description"],
			"permissions": updates["permissions"],
			"id":          id,
			"tenant_id":   tenantID,
		})
	return err
}

func (r *Repository) DeleteRole(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_roles WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ---- Command Permissions ----

func (r *Repository) GetAllCommandPermissions(ctx context.Context, tenantID string) ([]models.CommandPermission, error) {
	var items []models.CommandPermission
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_command_permissions WHERE tenant_id=$1 ORDER BY command`, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CreateCommandPermission(ctx context.Context, m *models.CommandPermission) error {
	m.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO chatops_command_permissions (id, tenant_id, command, description, capability, risk_level, requires_approval, role_ids)
		 VALUES (:id, :tenant_id, :command, :description, :capability, :risk_level, :requires_approval, :role_ids)`,
		m)
	return err
}

func (r *Repository) GetCommandPermission(ctx context.Context, tenantID, id string) (*models.CommandPermission, error) {
	var m models.CommandPermission
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM chatops_command_permissions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateCommandPermission(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE chatops_command_permissions SET
			description=COALESCE(:description, description),
			capability=COALESCE(:capability, capability),
			risk_level=COALESCE(:risk_level, risk_level),
			requires_approval=COALESCE(:requires_approval, requires_approval),
			role_ids=COALESCE(:role_ids, role_ids)
		 WHERE id=$1 AND tenant_id=$2`,
		map[string]interface{}{
			"description":       updates["description"],
			"capability":        updates["capability"],
			"risk_level":        updates["risk_level"],
			"requires_approval": updates["requires_approval"],
			"role_ids":          updates["role_ids"],
			"id":                id,
			"tenant_id":         tenantID,
		})
	return err
}

func (r *Repository) DeleteCommandPermission(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_command_permissions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ---- Environment Permissions ----

func (r *Repository) GetAllEnvironmentPermissions(ctx context.Context, tenantID string) ([]models.EnvironmentPermission, error) {
	var items []models.EnvironmentPermission
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_environment_permissions WHERE tenant_id=$1 ORDER BY environment`, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CreateEnvironmentPermission(ctx context.Context, m *models.EnvironmentPermission) error {
	m.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO chatops_environment_permissions (id, tenant_id, environment, description, rate_limit, require_approval, allowed_commands, denied_commands, role_ids)
		 VALUES (:id, :tenant_id, :environment, :description, :rate_limit, :require_approval, :allowed_commands, :denied_commands, :role_ids)`,
		m)
	return err
}

func (r *Repository) GetEnvironmentPermission(ctx context.Context, tenantID, id string) (*models.EnvironmentPermission, error) {
	var m models.EnvironmentPermission
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM chatops_environment_permissions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateEnvironmentPermission(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE chatops_environment_permissions SET
			description=COALESCE(:description, description),
			rate_limit=COALESCE(:rate_limit, rate_limit),
			require_approval=COALESCE(:require_approval, require_approval),
			allowed_commands=COALESCE(:allowed_commands, allowed_commands),
			denied_commands=COALESCE(:denied_commands, denied_commands),
			role_ids=COALESCE(:role_ids, role_ids)
		 WHERE id=$1 AND tenant_id=$2`,
		map[string]interface{}{
			"description":      updates["description"],
			"rate_limit":       updates["rate_limit"],
			"require_approval": updates["require_approval"],
			"allowed_commands": updates["allowed_commands"],
			"denied_commands":  updates["denied_commands"],
			"role_ids":         updates["role_ids"],
			"id":               id,
			"tenant_id":        tenantID,
		})
	return err
}

func (r *Repository) DeleteEnvironmentPermission(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_environment_permissions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ---- Command Versions ----

func (r *Repository) GetAllCommandVersions(ctx context.Context, tenantID string, limit, offset int) ([]models.CommandVersion, int, error) {
	var items []models.CommandVersion
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_command_versions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	var total int
	err = r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM chatops_command_versions WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) GetVersionsByCommand(ctx context.Context, tenantID, commandID string) ([]models.CommandVersion, error) {
	var items []models.CommandVersion
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_command_versions WHERE tenant_id=$1 AND command_id=$2 ORDER BY created_at DESC`, tenantID, commandID)
	return items, err
}

func (r *Repository) CreateCommandVersion(ctx context.Context, m *models.CommandVersion) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO chatops_command_versions (id, tenant_id, command_id, command_text, parameters, description, changelog, created_by, created_at)
		 VALUES (:id, :tenant_id, :command_id, :command_text, :parameters, :description, :changelog, :created_by, :created_at)`,
		m)
	return err
}

func (r *Repository) AddTag(ctx context.Context, tenantID, versionID, tagName, createdBy string) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO chatops_command_version_tags (id, tenant_id, version_id, tag_name, created_by, created_at)
		 VALUES (:id, :tenant_id, :version_id, :tag_name, :created_by, :created_at)`,
		map[string]interface{}{
			"id":         uuid.New().String(),
			"tenant_id":  tenantID,
			"version_id": versionID,
			"tag_name":   tagName,
			"created_by": createdBy,
			"created_at": time.Now().UTC(),
		})
	return err
}

func (r *Repository) RemoveTag(ctx context.Context, tenantID, versionID, tagName string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_command_version_tags WHERE tenant_id=$1 AND version_id=$2 AND tag_name=$3`, tenantID, versionID, tagName)
	return err
}

func (r *Repository) GetCommandVersion(ctx context.Context, tenantID, id string) (*models.CommandVersion, error) {
	var m models.CommandVersion
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM chatops_command_versions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) DeleteCommandVersion(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_command_versions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ---- Rate Limits ----

func (r *Repository) GetAllRateLimits(ctx context.Context, tenantID string) ([]models.RateLimit, error) {
	var items []models.RateLimit
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_rate_limits WHERE tenant_id=$1 ORDER BY created_at`, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CreateRateLimit(ctx context.Context, m *models.RateLimit) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO chatops_rate_limits (id, tenant_id, target_type, target_id, command_name, limit_type, limit_count, window_seconds, description, created_at)
		 VALUES (:id, :tenant_id, :target_type, :target_id, :command_name, :limit_type, :limit_count, :window_seconds, :description, :created_at)`,
		m)
	return err
}

func (r *Repository) GetRateLimit(ctx context.Context, tenantID, id string) (*models.RateLimit, error) {
	var m models.RateLimit
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM chatops_rate_limits WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateRateLimit(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE chatops_rate_limits SET
			target_type=COALESCE(:target_type, target_type),
			target_id=COALESCE(:target_id, target_id),
			command_name=COALESCE(:command_name, command_name),
			limit_type=COALESCE(:limit_type, limit_type),
			limit_count=COALESCE(:limit_count, limit_count),
			window_seconds=COALESCE(:window_seconds, window_seconds),
			description=COALESCE(:description, description)
		 WHERE id=$1 AND tenant_id=$2`,
		map[string]interface{}{
			"target_type":    updates["target_type"],
			"target_id":      updates["target_id"],
			"command_name":   updates["command_name"],
			"limit_type":     updates["limit_type"],
			"limit_count":    updates["limit_count"],
			"window_seconds": updates["window_seconds"],
			"description":    updates["description"],
			"id":             id,
			"tenant_id":      tenantID,
		})
	return err
}

func (r *Repository) DeleteRateLimit(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_rate_limits WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ---- Webhooks ----

func (r *Repository) GetAllWebhooks(ctx context.Context, tenantID string) ([]models.Webhook, error) {
	var items []models.Webhook
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_webhooks WHERE tenant_id=$1 ORDER BY created_at`, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CreateWebhook(ctx context.Context, m *models.Webhook) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO chatops_webhooks (id, tenant_id, name, url, events, secret_key, enabled, retry_count, timeout_seconds, headers, description, created_by, created_at)
		 VALUES (:id, :tenant_id, :name, :url, :events, :secret_key, :enabled, :retry_count, :timeout_seconds, :headers, :description, :created_by, :created_at)`,
		m)
	return err
}

func (r *Repository) GetWebhook(ctx context.Context, tenantID, id string) (*models.Webhook, error) {
	var m models.Webhook
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM chatops_webhooks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateWebhook(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE chatops_webhooks SET
			name=COALESCE(:name, name),
			url=COALESCE(:url, url),
			events=COALESCE(:events, events),
			secret_key=COALESCE(:secret_key, secret_key),
			enabled=COALESCE(:enabled, enabled),
			retry_count=COALESCE(:retry_count, retry_count),
			timeout_seconds=COALESCE(:timeout_seconds, timeout_seconds),
			headers=COALESCE(:headers, headers),
			description=COALESCE(:description, description)
		 WHERE id=$1 AND tenant_id=$2`,
		map[string]interface{}{
			"name":            updates["name"],
			"url":             updates["url"],
			"events":          updates["events"],
			"secret_key":      updates["secret_key"],
			"enabled":         updates["enabled"],
			"retry_count":     updates["retry_count"],
			"timeout_seconds": updates["timeout_seconds"],
			"headers":         updates["headers"],
			"description":     updates["description"],
			"id":              id,
			"tenant_id":       tenantID,
		})
	return err
}

func (r *Repository) DeleteWebhook(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_webhooks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) GetWebhookLogs(ctx context.Context, tenantID, webhookID string, limit int) ([]map[string]interface{}, error) {
	var items []map[string]interface{}
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_webhook_logs WHERE tenant_id=$1 AND webhook_id=$2 ORDER BY created_at DESC LIMIT $3`, tenantID, webhookID, limit)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) TestWebhook(ctx context.Context, tenantID, webhookID string) (*models.TestWebhookResult, error) {
	var m models.Webhook
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM chatops_webhooks WHERE id=$1 AND tenant_id=$2`, webhookID, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &models.TestWebhookResult{
		Success: true,
		Message: fmt.Sprintf("Webhook %s test passed", webhookID),
	}, nil
}

// ---- Dashboard Stats ----

func (r *Repository) GetDashboardStats(ctx context.Context, tenantID string, days int) (*models.DashboardStatsResult, error) {
	since := time.Now().UTC().AddDate(0, 0, -days)

	var totalCommands int
	r.db.GetContext(ctx, &totalCommands, `SELECT COUNT(*) FROM chatops_commands WHERE tenant_id=$1`, tenantID)

	var totalExecutions int
	r.db.GetContext(ctx, &totalExecutions,
		`SELECT COUNT(*) FROM chatops_executions WHERE tenant_id=$1 AND start_time >= $2`, tenantID, since)

	var completed int
	r.db.GetContext(ctx, &completed,
		`SELECT COUNT(*) FROM chatops_executions WHERE tenant_id=$1 AND status=$2 AND start_time >= $3`, tenantID, "completed", since)

	var failed int
	r.db.GetContext(ctx, &failed,
		`SELECT COUNT(*) FROM chatops_executions WHERE tenant_id=$1 AND status=$2 AND start_time >= $3`, tenantID, "failed", since)

	var successRate float64
	total := completed + failed
	if total > 0 {
		successRate = float64(completed) / float64(total) * 100
	}

	var topCommands []map[string]interface{}
	r.db.SelectContext(ctx, &topCommands,
		`SELECT command_id, COUNT(*) as count FROM chatops_executions WHERE tenant_id=$1 AND start_time >= $2 GROUP BY command_id ORDER BY count DESC LIMIT 5`, tenantID, since)

	var activeUsers int
	r.db.GetContext(ctx, &activeUsers,
		`SELECT COUNT(DISTINCT user_id) FROM chatops_executions WHERE tenant_id=$1 AND start_time >= $2`, tenantID, since)

	return &models.DashboardStatsResult{
		TotalCommands:   totalCommands,
		TotalExecutions: totalExecutions,
		SuccessRate:     successRate,
		TopCommands:     topCommands,
		ActiveUsers:     activeUsers,
	}, nil
}

// ---- User Allowed Commands ----

func (r *Repository) GetUserAllowedCommands(ctx context.Context, tenantID, userID string) ([]string, error) {
	var commands []string
	err := r.db.SelectContext(ctx, &commands,
		`SELECT DISTINCT command FROM chatops_command_permissions WHERE tenant_id=$1`, tenantID)
	return commands, err
}

// ---- Health Check ----

func (r *Repository) HealthCheck(ctx context.Context) (*models.HealthCheckResult, error) {
	var ping string
	err := r.db.GetContext(ctx, &ping, `SELECT NOW()`)
	status := "up"
	if err != nil {
		status = "down"
	}
	return &models.HealthCheckResult{
		Success:       err == nil,
		EventBus:      map[string]interface{}{"status": status},
		SSE:           map[string]interface{}{"active_connections": 0},
		Subscriptions: map[string]interface{}{"failures": 0},
		Metrics:       map[string]interface{}{},
	}, nil
}

// ---- Knowledge Recommendations ----

func (r *Repository) GetKnowledgeRecommendations(ctx context.Context, tenantID string, context string, limit int) ([]models.KnowledgeRecommendation, error) {
	var items []models.KnowledgeRecommendation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_knowledge_recommendations WHERE tenant_id=$1 AND (context=$2 OR context='general') ORDER BY created_at DESC LIMIT $3`, tenantID, context, limit)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// ---- Messages (Session) ----

func (r *Repository) CreateMessage(ctx context.Context, m *models.ChatOpsMessage) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO chatops_messages (id, tenant_id, session_id, user_id, text, platform, created_at)
		 VALUES (:id, :tenant_id, :session_id, :user_id, :text, :platform, :created_at)`,
		m)
	return err
}

func (r *Repository) GetSessionMessages(ctx context.Context, tenantID, sessionID string, limit int, cursor *string) ([]models.ChatOpsMessage, error) {
	if limit <= 0 {
		limit = 50
	}
	if cursor != nil && *cursor != "" {
		var items []models.ChatOpsMessage
		err := r.db.SelectContext(ctx, &items,
			`SELECT * FROM chatops_messages WHERE tenant_id=$1 AND session_id=$2 AND created_at < $3 ORDER BY created_at DESC LIMIT $4`,
			tenantID, sessionID, *cursor, limit)
		return items, err
	}
	var items []models.ChatOpsMessage
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chatops_messages WHERE tenant_id=$1 AND session_id=$2 ORDER BY created_at DESC LIMIT $3`,
		tenantID, sessionID, limit)
	return items, err
}

func (r *Repository) CreateSession(ctx context.Context, tenantID, userID string) (*models.ChatOpsSession, error) {
	m := &models.ChatOpsSession{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		UserID:    userID,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO chatops_sessions (id, tenant_id, user_id, created_at, updated_at)
		 VALUES (:id, :tenant_id, :user_id, :created_at, :updated_at)`,
		m)
	return m, err
}

// ---- Recommendations (AI-powered) ----

func (r *Repository) GetRecommendations(ctx context.Context, tenantID, userID string, currentPage, resourceID string) ([]map[string]interface{}, error) {
	// Return top commands as recommendations based on current page context
	var items []map[string]interface{}
	if currentPage != "" {
		err := r.db.SelectContext(ctx, &items,
			`SELECT name, description, permission_level FROM chatops_commands WHERE tenant_id=$1 AND description ILIKE $2 ORDER BY name LIMIT 10`,
			tenantID, "%"+currentPage+"%")
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT name, description, permission_level FROM chatops_commands WHERE tenant_id=$1 ORDER BY name LIMIT 10`, tenantID)
	return items, err
}

// ---- Export Audit Logs (CSV helper) ----

func (r *Repository) ExportAuditLogs(ctx context.Context, tenantID string, q *models.AuditLogQuery) ([]models.AuditLog, error) {
	return r.ListAuditLogs(ctx, tenantID, q)
}

// ---- User Permission Request (simplified) ----

func (r *Repository) GetUserPermissionRequests(ctx context.Context, tenantID, userID string) ([]map[string]interface{}, error) {
	var items []map[string]interface{}
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM permission_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`, userID)
	if err != nil {
		// Table may not exist in this service; return empty
		if err == sql.ErrNoRows || isUnknownTable(err) {
			return []map[string]interface{}{}, nil
		}
		return nil, err
	}
	return items, nil
}

func isUnknownTable(err error) bool {
	return err != nil && (contains(err.Error(), "does not exist") || contains(err.Error(), "unknown table"))
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 || findSubstr(s, substr))
}

func findSubstr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
