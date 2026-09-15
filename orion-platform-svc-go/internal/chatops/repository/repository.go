package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/chatops/models"

	_ "github.com/lib/pq"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// getOne runs a single-row SELECT and turns the driver's sql.ErrNoRows into
// sentinel.NotFound. The handler layer switches on service.IsNotFound to answer
// 404, and - for notification and DND settings - to hand back a zero value for a
// tenant that has never saved one, which is their very first request. These
// readers used to return the raw driver error, so all twenty-one IsNotFound
// branches in the handlers were dead code and a missing row answered 500 with
// "sql: no rows" in the admin UI.
func (r *Repository) getOne(ctx context.Context, dest any, query string, args ...any) error {
	err := r.db.GetContext(ctx, dest, query, args...)
	if errors.Is(err, sql.ErrNoRows) {
		return sentinel.NotFound
	}
	return err
}

// oneRow turns an UPDATE or DELETE that matched nothing into the same sentinel.
// Without the RowsAffected check these writes reported success for ids that had
// already been deleted, so the handler answered 200 for a delete of a row that
// did not exist and the service answered "updated" with a payload it then could
// not read back.
func (r *Repository) oneRow(res sql.Result, id string) error {
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("chatops %s: %w", id, sentinel.NotFound)
	}
	return nil
}

// Every SELECT below names its columns explicitly instead of using *.
//
// 020 created each chatops table with the columns these models were written
// against. 571 later added deleted_at to all of them and 572 added created_by
// and updated_by (plus created_at / updated_at to eight of them). sqlx scans in
// safe mode — go-common's database.Connect goes through sqlx.Open and never
// calls Unsafe — so `SELECT *` returned a deleted_at column that no model
// declares, and the scan failed on the very first row with
// "missing destination name deleted_at in *models.ChatOpsCommand". That error is
// not sql.ErrNoRows, so it propagated out of the repository, out of the service,
// and chatops answered 500 on every read endpoint instead of data.
//
// Naming the columns returns exactly the fields the models declare, so the extra
// soft-delete and audit columns are never handed to the scanner and no model
// change is needed for them.
const (
	commandColumns               = "id,tenant_id,name,subcommand,aliases,description,permission_level,schema,examples,created_at,updated_at"
	executionColumns             = "id,tenant_id,command_id,user_id,status,params,result,milestones,start_time,end_time,created_at"
	auditLogColumns              = "id,tenant_id,user_id,action,command,details,created_at"
	notificationColumns          = "id,tenant_id,user_id,alert_level,channel_chatops,channel_email,channel_slack,channel_feishu,channel_dingtalk"
	dndColumns                   = "id,tenant_id,user_id,enabled,start_time,end_time,repeat_days,allow_critical"
	platformConfigColumns        = "id,tenant_id,user_id,platform,enabled,webhook,token"
	alertStateColumns            = "id,tenant_id,user_id,alert_id,status,created_at,updated_at"
	questionConfigColumns        = "id,tenant_id,user_id,title,command,enabled"
	commandConfigColumns         = "id,tenant_id,user_id,command,params,enabled"
	capabilityColumns            = "id,tenant_id,command_id,capability_id,environment,risk_level,requires_approval"
	approvalConfigColumns        = "id,tenant_id,capability,enabled,approvers,threshold"
	commandPermissionColumns     = "id,tenant_id,command,description,capability,risk_level,requires_approval,role_ids"
	environmentPermissionColumns = "id,tenant_id,environment,description,rate_limit,require_approval,allowed_commands,denied_commands,role_ids"
	commandVersionColumns        = "id,tenant_id,command_id,command_text,parameters,description,changelog,created_by,created_at"
	rateLimitColumns             = "id,tenant_id,target_type,target_id,command_name,limit_type,limit_count,window_seconds,description,created_at"
	webhookColumns               = "id,tenant_id,name,url,events,secret_key,enabled,retry_count,timeout_seconds,headers,description,created_by,created_at"
	messageColumns               = "id,tenant_id,session_id,user_id,text,platform,created_at"

	// chatops_approvers, chatops_approver_schedule, chatops_webhook_logs and
	// chatops_knowledge_recommendations are created by 579, which defines them to
	// match these lists exactly. 020 never created them and no other migration
	// does, so every statement that touched them failed with
	// 'relation "chatops_approvers" does not exist' and the approver, knowledge
	// and webhook-log endpoints answered 500. 571/572 only add deleted_at /
	// created_by / updated_by to tables that already exist, so those four never
	// receive them - but naming the columns keeps them safe if that ever changes.
	//
	// chatops_permission_roles is different: 020 created it, but under a name the
	// code never used. It wrote to chatops_roles, which no migration creates, so
	// the whole role CRUD answered 500 while the real table sat empty beside it.
	roleColumns             = "id,tenant_id,name,description,permissions"
	approverColumns         = "user_id,enabled"
	approverScheduleColumns = "user_id,start_time,end_time"
	knowledgeColumns        = "id,title,context,description"
	webhookLogColumns       = "id,tenant_id,webhook_id,status,response_body,error,duration_ms,created_at"
)

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
	if err := r.getOne(ctx, &m,
		`SELECT `+commandColumns+` FROM chatops_commands WHERE id=$1 AND tenant_id=$2`, id, tenantID); err != nil {
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
		sql = fmt.Sprintf(`SELECT `+commandColumns+` FROM chatops_commands WHERE tenant_id=$%d AND permission_level=$%d AND (name ILIKE $%d OR aliases ILIKE $%d) ORDER BY name LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2, argIdx+2, argIdx+3, argIdx+4)
		args = []interface{}{tenantID, *permissionLevel, "%" + *name + "%", "%" + *name + "%", limit, offset}
		argIdx += 5
	} else if permissionLevel != nil {
		sql = fmt.Sprintf(`SELECT `+commandColumns+` FROM chatops_commands WHERE tenant_id=$%d AND permission_level=$%d ORDER BY name LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2, argIdx+3)
		args = []interface{}{tenantID, *permissionLevel, limit, offset}
		argIdx += 4
	} else if name != nil {
		sql = fmt.Sprintf(`SELECT `+commandColumns+` FROM chatops_commands WHERE tenant_id=$%d AND (name ILIKE $%d OR aliases ILIKE $%d) ORDER BY name LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+1, argIdx+2, argIdx+3)
		args = []interface{}{tenantID, "%" + *name + "%", limit, offset}
		argIdx += 4
	} else {
		sql = fmt.Sprintf(`SELECT `+commandColumns+` FROM chatops_commands WHERE tenant_id=$%d ORDER BY name LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2)
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
	res, err := r.db.NamedExecContext(ctx,
		`UPDATE chatops_commands SET
			name=COALESCE(:name, name),
			subcommand=COALESCE(:subcommand, subcommand),
			description=COALESCE(:description, description),
			permission_level=COALESCE(:permission_level, permission_level),
			schema=COALESCE(:schema, schema),
			examples=COALESCE(:examples, examples),
			updated_at=NOW()
		 WHERE id=:id AND tenant_id=:tenant_id`,
		map[string]interface{}{
			"name":             updates["name"],
			"subcommand":       updates["subcommand"],
			"description":      updates["description"],
			"permission_level": updates["permission_level"],
			"schema":           updates["schema"],
			"examples":         updates["examples"],
			"id":               id,
			"tenant_id":        tenantID,
		})
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

func (r *Repository) DeleteCommand(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_commands WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
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
	if err := r.getOne(ctx, &m,
		`SELECT `+executionColumns+` FROM chatops_executions WHERE id=$1 AND tenant_id=$2`, id, tenantID); err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateExecutionStatus(ctx context.Context, tenantID, id, status string) error {
	now := time.Now().UTC()
	res, err := r.db.ExecContext(ctx,
		`UPDATE chatops_executions SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		status, now, id, tenantID)
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

func (r *Repository) ListExecutions(ctx context.Context, tenantID string, commandID, userID, status *string, limit, offset int) ([]models.Execution, error) {
	if limit <= 0 {
		limit = 50
	}
	var sql string
	var args []interface{}
	argIdx := 1
	if commandID != nil && userID != nil && status != nil {
		sql = fmt.Sprintf(`SELECT `+executionColumns+` FROM chatops_executions WHERE tenant_id=$%d AND command_id=$%d AND user_id=$%d AND status=$%d ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2, argIdx+3, argIdx+4, argIdx+5)
		args = []interface{}{tenantID, *commandID, *userID, *status, limit, offset}
		argIdx += 6
	} else if commandID != nil {
		sql = fmt.Sprintf(`SELECT `+executionColumns+` FROM chatops_executions WHERE tenant_id=$%d AND command_id=$%d ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2, argIdx+3)
		args = []interface{}{tenantID, *commandID, limit, offset}
		argIdx += 4
	} else {
		sql = fmt.Sprintf(`SELECT `+executionColumns+` FROM chatops_executions WHERE tenant_id=$%d ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2)
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
		sql = fmt.Sprintf(`SELECT `+auditLogColumns+` FROM chatops_audit_logs WHERE tenant_id=$%d AND user_id=$%d AND action=$%d AND command=$%d ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2, argIdx+3, argIdx+4, argIdx+5)
		args = []interface{}{tenantID, *q.UserID, *q.Action, *q.Command, limit, offset}
		argIdx += 6
	} else if q.UserID != nil && q.Action != nil {
		sql = fmt.Sprintf(`SELECT `+auditLogColumns+` FROM chatops_audit_logs WHERE tenant_id=$%d AND user_id=$%d AND action=$%d ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2, argIdx+3, argIdx+4)
		args = []interface{}{tenantID, *q.UserID, *q.Action, limit, offset}
		argIdx += 5
	} else if q.UserID != nil {
		sql = fmt.Sprintf(`SELECT `+auditLogColumns+` FROM chatops_audit_logs WHERE tenant_id=$%d AND user_id=$%d ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2, argIdx+3)
		args = []interface{}{tenantID, *q.UserID, limit, offset}
		argIdx += 4
	} else if q.Command != nil {
		sql = fmt.Sprintf(`SELECT `+auditLogColumns+` FROM chatops_audit_logs WHERE tenant_id=$%d AND command=$%d ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2, argIdx+3)
		args = []interface{}{tenantID, *q.Command, limit, offset}
		argIdx += 4
	} else {
		sql = fmt.Sprintf(`SELECT `+auditLogColumns+` FROM chatops_audit_logs WHERE tenant_id=$%d ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1, argIdx+2)
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
	if err := r.getOne(ctx, &m,
		`SELECT `+notificationColumns+` FROM chatops_notification_preferences WHERE tenant_id=$1 AND user_id=$2`, tenantID, userID); err != nil {
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
	if err := r.getOne(ctx, &m,
		`SELECT `+dndColumns+` FROM chatops_dnd_settings WHERE tenant_id=$1 AND user_id=$2`, tenantID, userID); err != nil {
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
		`SELECT `+platformConfigColumns+` FROM chatops_platform_configs WHERE tenant_id=$1 AND user_id=$2`, tenantID, userID)
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
		`SELECT `+alertStateColumns+` FROM chatops_alert_states WHERE tenant_id=$1 AND user_id=$2`, tenantID, userID)
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
		`SELECT `+questionConfigColumns+` FROM chatops_question_configs WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at`, tenantID, userID)
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
		`SELECT `+commandConfigColumns+` FROM chatops_command_configs WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at`, tenantID, userID)
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
			`SELECT `+capabilityColumns+` FROM chatops_capability_mappings WHERE tenant_id=$1 AND environment=$2`, tenantID, *environment)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+capabilityColumns+` FROM chatops_capability_mappings WHERE tenant_id=$1`, tenantID)
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
	if err := r.getOne(ctx, &m,
		`SELECT `+capabilityColumns+` FROM chatops_capability_mappings WHERE id=$1 AND tenant_id=$2`, id, tenantID); err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateCapabilityMapping(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	now := time.Now().UTC()
	res, err := r.db.NamedExecContext(ctx,
		`UPDATE chatops_capability_mappings SET updated_at=:updated_at WHERE id=:id AND tenant_id=:tenant_id`,
		map[string]interface{}{"updated_at": now, "id": id, "tenant_id": tenantID})
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

func (r *Repository) DeleteCapabilityMapping(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_capability_mappings WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

// ---- Approval Configs ----

func (r *Repository) GetAllApprovalConfigs(ctx context.Context, tenantID string) ([]models.ApprovalConfig, error) {
	var items []models.ApprovalConfig
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+approvalConfigColumns+` FROM chatops_approval_configs WHERE tenant_id=$1`, tenantID)
	return items, err
}

func (r *Repository) GetApprovalConfigByCapability(ctx context.Context, tenantID, capability string) (*models.ApprovalConfig, error) {
	var m models.ApprovalConfig
	if err := r.getOne(ctx, &m,
		`SELECT `+approvalConfigColumns+` FROM chatops_approval_configs WHERE tenant_id=$1 AND capability=$2`, tenantID, capability); err != nil {
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
		`SELECT `+approverColumns+` FROM chatops_approvers WHERE tenant_id=$1`, tenantID)
	return items, err
}

func (r *Repository) GetApproverSchedule(ctx context.Context, tenantID string) ([]models.ApproverSchedule, error) {
	var items []models.ApproverSchedule
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+approverScheduleColumns+` FROM chatops_approver_schedule WHERE tenant_id=$1`, tenantID)
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
	if err := r.getOne(ctx, &m,
		`SELECT enabled, mode FROM chatops_global_approval_config WHERE tenant_id=$1`, tenantID); err != nil {
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
		`SELECT `+roleColumns+` FROM chatops_permission_roles WHERE tenant_id=$1 ORDER BY name`, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CreateRole(ctx context.Context, m *models.PermissionRole) error {
	m.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO chatops_permission_roles (id, tenant_id, name, description, permissions)
		 VALUES (:id, :tenant_id, :name, :description, :permissions)`,
		m)
	return err
}

func (r *Repository) GetRole(ctx context.Context, tenantID, id string) (*models.PermissionRole, error) {
	var m models.PermissionRole
	if err := r.getOne(ctx, &m,
		`SELECT `+roleColumns+` FROM chatops_permission_roles WHERE id=$1 AND tenant_id=$2`, id, tenantID); err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateRole(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	res, err := r.db.NamedExecContext(ctx,
		`UPDATE chatops_permission_roles SET name=COALESCE(:name, name), description=COALESCE(:description, description), permissions=COALESCE(:permissions, permissions)
		 WHERE id=:id AND tenant_id=:tenant_id`,
		map[string]interface{}{
			"name":        updates["name"],
			"description": updates["description"],
			"permissions": updates["permissions"],
			"id":          id,
			"tenant_id":   tenantID,
		})
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

func (r *Repository) DeleteRole(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_permission_roles WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

// ---- Command Permissions ----

func (r *Repository) GetAllCommandPermissions(ctx context.Context, tenantID string) ([]models.CommandPermission, error) {
	var items []models.CommandPermission
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+commandPermissionColumns+` FROM chatops_command_permissions WHERE tenant_id=$1 ORDER BY command`, tenantID)
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
	if err := r.getOne(ctx, &m,
		`SELECT `+commandPermissionColumns+` FROM chatops_command_permissions WHERE id=$1 AND tenant_id=$2`, id, tenantID); err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateCommandPermission(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	res, err := r.db.NamedExecContext(ctx,
		`UPDATE chatops_command_permissions SET
			description=COALESCE(:description, description),
			capability=COALESCE(:capability, capability),
			risk_level=COALESCE(:risk_level, risk_level),
			requires_approval=COALESCE(:requires_approval, requires_approval),
			role_ids=COALESCE(:role_ids, role_ids)
		 WHERE id=:id AND tenant_id=:tenant_id`,
		map[string]interface{}{
			"description":       updates["description"],
			"capability":        updates["capability"],
			"risk_level":        updates["risk_level"],
			"requires_approval": updates["requires_approval"],
			"role_ids":          updates["role_ids"],
			"id":                id,
			"tenant_id":         tenantID,
		})
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

func (r *Repository) DeleteCommandPermission(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_command_permissions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

// ---- Environment Permissions ----

func (r *Repository) GetAllEnvironmentPermissions(ctx context.Context, tenantID string) ([]models.EnvironmentPermission, error) {
	var items []models.EnvironmentPermission
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+environmentPermissionColumns+` FROM chatops_environment_permissions WHERE tenant_id=$1 ORDER BY environment`, tenantID)
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
	if err := r.getOne(ctx, &m,
		`SELECT `+environmentPermissionColumns+` FROM chatops_environment_permissions WHERE id=$1 AND tenant_id=$2`, id, tenantID); err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateEnvironmentPermission(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	res, err := r.db.NamedExecContext(ctx,
		`UPDATE chatops_environment_permissions SET
			description=COALESCE(:description, description),
			rate_limit=COALESCE(:rate_limit, rate_limit),
			require_approval=COALESCE(:require_approval, require_approval),
			allowed_commands=COALESCE(:allowed_commands, allowed_commands),
			denied_commands=COALESCE(:denied_commands, denied_commands),
			role_ids=COALESCE(:role_ids, role_ids)
		 WHERE id=:id AND tenant_id=:tenant_id`,
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
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

func (r *Repository) DeleteEnvironmentPermission(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_environment_permissions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

// ---- Command Versions ----

func (r *Repository) GetAllCommandVersions(ctx context.Context, tenantID string, limit, offset int) ([]models.CommandVersion, int, error) {
	var items []models.CommandVersion
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+commandVersionColumns+` FROM chatops_command_versions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
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
		`SELECT `+commandVersionColumns+` FROM chatops_command_versions WHERE tenant_id=$1 AND command_id=$2 ORDER BY created_at DESC`, tenantID, commandID)
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

// RemoveTag deliberately does not report a missing tag: a tag that is not there
// has already been removed, so the DELETE answers 200. It is the one id-scoped
// delete in the module that is meant to be idempotent, and
// TestSource_EveryIDScopedWriteChecksRowsAffected keeps the rest honest.
func (r *Repository) RemoveTag(ctx context.Context, tenantID, versionID, tagName string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_command_version_tags WHERE tenant_id=$1 AND version_id=$2 AND tag_name=$3`, tenantID, versionID, tagName)
	return err
}

func (r *Repository) GetCommandVersion(ctx context.Context, tenantID, id string) (*models.CommandVersion, error) {
	var m models.CommandVersion
	if err := r.getOne(ctx, &m,
		`SELECT `+commandVersionColumns+` FROM chatops_command_versions WHERE id=$1 AND tenant_id=$2`, id, tenantID); err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) DeleteCommandVersion(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_command_versions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

// ---- Rate Limits ----

func (r *Repository) GetAllRateLimits(ctx context.Context, tenantID string) ([]models.RateLimit, error) {
	var items []models.RateLimit
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+rateLimitColumns+` FROM chatops_rate_limits WHERE tenant_id=$1 ORDER BY created_at`, tenantID)
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
	if err := r.getOne(ctx, &m,
		`SELECT `+rateLimitColumns+` FROM chatops_rate_limits WHERE id=$1 AND tenant_id=$2`, id, tenantID); err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateRateLimit(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	res, err := r.db.NamedExecContext(ctx,
		`UPDATE chatops_rate_limits SET
			target_type=COALESCE(:target_type, target_type),
			target_id=COALESCE(:target_id, target_id),
			command_name=COALESCE(:command_name, command_name),
			limit_type=COALESCE(:limit_type, limit_type),
			limit_count=COALESCE(:limit_count, limit_count),
			window_seconds=COALESCE(:window_seconds, window_seconds),
			description=COALESCE(:description, description)
		 WHERE id=:id AND tenant_id=:tenant_id`,
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
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

func (r *Repository) DeleteRateLimit(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_rate_limits WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

// ---- Webhooks ----

func (r *Repository) GetAllWebhooks(ctx context.Context, tenantID string) ([]models.Webhook, error) {
	var items []models.Webhook
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+webhookColumns+` FROM chatops_webhooks WHERE tenant_id=$1 ORDER BY created_at`, tenantID)
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
	if err := r.getOne(ctx, &m,
		`SELECT `+webhookColumns+` FROM chatops_webhooks WHERE id=$1 AND tenant_id=$2`, id, tenantID); err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateWebhook(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	res, err := r.db.NamedExecContext(ctx,
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
		 WHERE id=:id AND tenant_id=:tenant_id`,
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
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

func (r *Repository) DeleteWebhook(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM chatops_webhooks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

// selectMaps scans every row of a SELECT into a map. sqlx will not do this for
// you: SelectContext stores the element type into isScannable, which returns
// true for a map because a map is not a struct, and scanAll then refuses a
// non-struct destination that has more than one column - "non-struct dest type
// map with >1 columns". Every reader below that handed a SELECT with two or
// more columns to SelectContext therefore failed on the first row and answered
// 500 for any tenant that had data. Scanning the rows by hand returns the same
// column names sqlx would have used, so the JSON these endpoints emit is
// unchanged. The slice is never nil so a caller that marshals it directly keeps
// emitting [] rather than null.
func (r *Repository) selectMaps(ctx context.Context, query string, args ...any) ([]map[string]interface{}, error) {
	rows, err := r.db.QueryxContext(ctx, query, args...)
	if err != nil {
		return []map[string]interface{}{}, err
	}
	defer rows.Close()
	items := []map[string]interface{}{}
	for rows.Next() {
		m := map[string]interface{}{}
		if err := rows.MapScan(m); err != nil {
			return items, err
		}
		items = append(items, m)
	}
	return items, rows.Err()
}

func (r *Repository) GetWebhookLogs(ctx context.Context, tenantID, webhookID string, limit int) ([]map[string]interface{}, error) {
	return r.selectMaps(ctx,
		`SELECT `+webhookLogColumns+` FROM chatops_webhook_logs WHERE tenant_id=$1 AND webhook_id=$2 ORDER BY created_at DESC LIMIT $3`,
		tenantID, webhookID, limit)
}

// InsertWebhookLog records one delivery attempt. Before this existed the
// relation had a reader and no writer in the whole tree, so
// GET /admin/webhooks/:id/logs could only ever return an empty slice - and
// before 579 it could not even return an empty slice, because the table did
// not exist.
func (r *Repository) InsertWebhookLog(
	ctx context.Context,
	tenantID, webhookID, status, responseBody, errMsg string,
	durationMS int64,
) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO chatops_webhook_logs (id, tenant_id, webhook_id, status, response_body, error, duration_ms, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
		uuid.New().String(), tenantID, webhookID, status, responseBody, errMsg, durationMS)
	return err
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

	topCommands, _ := r.selectMaps(ctx,
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
		`SELECT `+knowledgeColumns+` FROM chatops_knowledge_recommendations WHERE tenant_id=$1 AND (context=$2 OR context='general') ORDER BY created_at DESC LIMIT $3`, tenantID, context, limit)
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
			`SELECT `+messageColumns+` FROM chatops_messages WHERE tenant_id=$1 AND session_id=$2 AND created_at < $3 ORDER BY created_at DESC LIMIT $4`,
			tenantID, sessionID, *cursor, limit)
		return items, err
	}
	var items []models.ChatOpsMessage
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+messageColumns+` FROM chatops_messages WHERE tenant_id=$1 AND session_id=$2 ORDER BY created_at DESC LIMIT $3`,
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
	if currentPage != "" {
		return r.selectMaps(ctx,
			`SELECT name, description, permission_level FROM chatops_commands WHERE tenant_id=$1 AND description ILIKE $2 ORDER BY name LIMIT 10`,
			tenantID, "%"+currentPage+"%")
	}
	return r.selectMaps(ctx,
		`SELECT name, description, permission_level FROM chatops_commands WHERE tenant_id=$1 ORDER BY name LIMIT 10`, tenantID)
}

// ---- Export Audit Logs (CSV helper) ----

func (r *Repository) ExportAuditLogs(ctx context.Context, tenantID string, q *models.AuditLogQuery) ([]models.AuditLog, error) {
	return r.ListAuditLogs(ctx, tenantID, q)
}

// ---- User Permission Request (simplified) ----

func (r *Repository) GetUserPermissionRequests(ctx context.Context, tenantID, userID string) ([]map[string]interface{}, error) {
	items, err := r.selectMaps(ctx,
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
