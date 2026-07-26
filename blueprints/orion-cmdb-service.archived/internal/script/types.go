package script

import "time"

// ScriptType represents the type of script
type ScriptType string

const (
	ScriptTypeBash       ScriptType = "bash"
	ScriptTypePython     ScriptType = "python"
	ScriptTypePowerShell ScriptType = "powershell"
)

// ExecutionStatus represents the status of a script execution
type ExecutionStatus string

const (
	StatusSuccess ExecutionStatus = "success"
	StatusFailed  ExecutionStatus = "failed"
	StatusTimeout ExecutionStatus = "timeout"
)

// ScriptExecutionRequest represents the input for script execution
type ScriptExecutionRequest struct {
	TargetCiIds []string          `json:"target_ci_ids" validate:"required"`
	Script      string            `json:"script" validate:"required"`
	ScriptType  ScriptType        `json:"script_type" validate:"required"`
	Timeout     int               `json:"timeout"` // milliseconds
	Parameters  map[string]string `json:"parameters"`
}

// ScriptExecutionResult represents the result of a single script execution
type ScriptExecutionResult struct {
	ExecutionID string          `json:"execution_id"`
	CiID        string          `json:"ci_id"`
	Status      ExecutionStatus `json:"status"`
	Stdout      string          `json:"stdout,omitempty"`
	Stderr      string          `json:"stderr,omitempty"`
	ExitCode    int             `json:"exit_code"`
	Duration    int64           `json:"duration_ms"`
	ExecutedAt  time.Time       `json:"executed_at"`
}

// SSHConfig represents the SSH connection configuration
type SSHConfig struct {
	Host       string
	Port       int
	Username   string
	Password   string
	PrivateKey string
	Passphrase string
}

// ScriptExecutionRecord is the database model for script execution history
type ScriptExecutionRecord struct {
	ID          int64     `json:"id" gorm:"primaryKey"`
	ExecutionID string    `json:"execution_id" gorm:"uniqueIndex;not null"`
	CiID        string    `json:"ci_id" gorm:"index;not null"`
	TenantID    int64     `json:"tenant_id" gorm:"index;not null"`
	ScriptType  string    `json:"script_type" gorm:"not null"`
	Status      string    `json:"status" gorm:"not null"`
	Stdout      string    `json:"stdout"`
	Stderr      string    `json:"stderr"`
	ExitCode    int       `json:"exit_code"`
	Duration    int64     `json:"duration_ms"`
	ExecutedBy  string    `json:"executed_by"`
	ExecutedAt  time.Time `json:"executed_at"`
}

// TableName returns the table name for ScriptExecutionRecord
func (ScriptExecutionRecord) TableName() string {
	return "cmdb_script_executions"
}
