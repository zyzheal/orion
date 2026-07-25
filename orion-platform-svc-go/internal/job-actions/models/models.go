// Package models defines the domain types for the job-actions system.
//
// Job actions are atomic, reusable operations that can be executed
// programmatically (e.g. by auto-exec tasks) or via the REST API.
// 42 action types spanning deployment, infrastructure, data,
// notification, admin and monitoring categories.
package models

import "time"

// Status constants for JobActionExecution
const (
	StatusPending   = "pending"
	StatusRunning   = "running"
	StatusCompleted = "completed"
	StatusFailed    = "failed"
)

// ---------------------------------------------------------------------------
// Action type constants
// ---------------------------------------------------------------------------

const (
	TypeRestartService   = "restart_service"
	TypeDeployCode       = "deploy_code"
	TypeBackupDB         = "backup_db"
	TypeRestoreDB        = "restore_db"
	TypeScaleInstance    = "scale_instance"
	TypeSendEmail        = "send_email"
	TypeSendSMS          = "send_sms"
	TypeSendWebhook      = "send_webhook"
	TypeRunScript        = "run_script"
	TypeExecuteSQL       = "execute_sql"
	TypeFileCopy         = "file_copy"
	TypeFileDelete       = "file_delete"
	TypeGitPull          = "git_pull"
	TypeGitPush          = "git_push"
	TypeDockerPull       = "docker_pull"
	TypeDockerPush       = "docker_push"
	TypeDockerRestart    = "docker_restart"
	TypeDockerComposeUp  = "docker_compose_up"
	TypeDockerComposeDown = "docker_compose_down"
	TypeKubectlApply     = "kubectl_apply"
	TypeKubectlDelete    = "kubectl_delete"
	TypeCurlRequest      = "curl_request"
	TypeShellCommand     = "shell_command"
	TypeArchiveFile      = "archive_file"
	TypeExtractFile      = "extract_file"
	TypeCreateDirectory  = "create_directory"
	TypeDeleteDirectory  = "delete_directory"
	TypeModifyFile       = "modify_file"
	TypeCreateUser       = "create_user"
	TypeDeleteUser       = "delete_user"
	TypeGrantPermission  = "grant_permission"
	TypeRevokePermission = "revoke_permission"
	TypeRotateKey        = "rotate_key"
	TypeEnableFeature    = "enable_feature"
	TypeDisableFeature   = "disable_feature"
	TypeClearCache       = "clear_cache"
	TypeSendNotification = "send_notification"
	TypeCreateTicket     = "create_ticket"
	TypeCloseTicket      = "close_ticket"
	TypeUpdateTicket     = "update_ticket"
	TypeRunHealthCheck   = "run_health_check"
	TypeStopService      = "stop_service"
	TypeStartService     = "start_service"
	TypeChangeConfig     = "change_config"
	TypeSnapshot         = "snapshot"
	TypeRollback         = "rollback"
)

// AllActionTypes lists every supported action type.
var AllActionTypes = []string{
	TypeRestartService, TypeDeployCode, TypeBackupDB, TypeRestoreDB,
	TypeScaleInstance, TypeSendEmail, TypeSendSMS, TypeSendWebhook,
	TypeRunScript, TypeExecuteSQL, TypeFileCopy, TypeFileDelete,
	TypeGitPull, TypeGitPush, TypeDockerPull, TypeDockerPush,
	TypeDockerRestart, TypeDockerComposeUp, TypeDockerComposeDown,
	TypeKubectlApply, TypeKubectlDelete, TypeCurlRequest, TypeShellCommand,
	TypeArchiveFile, TypeExtractFile, TypeCreateDirectory, TypeDeleteDirectory,
	TypeModifyFile, TypeCreateUser, TypeDeleteUser, TypeGrantPermission,
	TypeRevokePermission, TypeRotateKey, TypeEnableFeature, TypeDisableFeature,
	TypeClearCache, TypeSendNotification, TypeCreateTicket, TypeCloseTicket,
	TypeUpdateTicket, TypeRunHealthCheck, TypeStopService, TypeStartService,
	TypeChangeConfig, TypeSnapshot, TypeRollback,
}

// ---------------------------------------------------------------------------
// Category constants
// ---------------------------------------------------------------------------

const (
	CategoryDeployment    = "deployment"
	CategoryInfrastructure = "infrastructure"
	CategoryData          = "data"
	CategoryNotification  = "notification"
	CategoryAdmin         = "admin"
	CategoryMonitoring    = "monitoring"
)

// ---------------------------------------------------------------------------
// JobAction — a reusable action definition
// ---------------------------------------------------------------------------

type JobAction struct {
	ID          string     `json:"id" db:"id"`
	TenantID    string     `json:"tenant_id" db:"tenant_id"`
	Name        string     `json:"name" db:"name"`
	Type        string     `json:"type" db:"type"`
	Description string     `json:"description" db:"description"`
	Params      string     `json:"params" db:"params"`    // JSON: parameter schema
	Category    string     `json:"category" db:"category"`
	Timeout     int        `json:"timeout" db:"timeout"`
	RetryCount  int        `json:"retry_count" db:"retry_count"`
	Enabled     bool       `json:"enabled" db:"enabled"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

// ---------------------------------------------------------------------------
// JobActionExecution — a record of a single action execution
// ---------------------------------------------------------------------------

type JobActionExecution struct {
	ID          string     `json:"id" db:"id"`
	TenantID    string     `json:"tenant_id" db:"tenant_id"`
	ActionID    string     `json:"action_id" db:"action_id"`
	Params      string     `json:"params" db:"params"`    // JSON: execution params
	Status      string     `json:"status" db:"status"`
	Output      string     `json:"output" db:"output"`
	Error       string     `json:"error" db:"error"`
	DurationMs  int64      `json:"duration_ms" db:"duration_ms"`
	StartedAt   time.Time  `json:"started_at" db:"started_at"`
	FinishedAt  *time.Time `json:"finished_at,omitempty" db:"finished_at"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

// ---------------------------------------------------------------------------
// Request / response DTOs
// ---------------------------------------------------------------------------

type CreateActionRequest struct {
	Name        string            `json:"name" binding:"required"`
	Type        string            `json:"type" binding:"required"`
	Description string            `json:"description"`
	Params      map[string]string `json:"params"`
	Category    string            `json:"category"`
	Timeout     int               `json:"timeout"`
	RetryCount  int               `json:"retry_count"`
}

type ExecuteActionRequest struct {
	Params map[string]string `json:"params"`
}

type ActionListResponse struct {
	Total int         `json:"total"`
	Data  []JobAction `json:"data"`
}

type HistoryListResponse struct {
	Total int                   `json:"total"`
	Data  []JobActionExecution  `json:"data"`
}
