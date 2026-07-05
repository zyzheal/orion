package script

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/orion-platform/orion-cmdb/internal/cmdb"
	"gorm.io/gorm"
)

// Service handles script execution on remote hosts via SSH
type Service struct {
	cmdbService *cmdb.Service
	db          *gorm.DB
}

// NewService creates a new script execution service
func NewService(cmdbService *cmdb.Service, db *gorm.DB) *Service {
	return &Service{
		cmdbService: cmdbService,
		db:          db,
	}
}

// ExecuteScript executes a script on multiple target CIs and persists results
func (s *Service) ExecuteScript(ctx context.Context, req *ScriptExecutionRequest, tenantID int64, executedBy string) ([]ScriptExecutionResult, error) {
	results := make([]ScriptExecutionResult, 0, len(req.TargetCiIds))

	for _, ciID := range req.TargetCiIds {
		result, execErr := s.executeOnCI(ctx, ciID, req, tenantID)
		result.ExecutionID = uuid.New().String()

		// Persist execution record to database
		record := ScriptExecutionRecord{
			ExecutionID: result.ExecutionID,
			CiID:        ciID,
			TenantID:    tenantID,
			ScriptType:  string(req.ScriptType),
			Status:      string(result.Status),
			Stdout:      result.Stdout,
			Stderr:      result.Stderr,
			ExitCode:    result.ExitCode,
			Duration:    result.Duration,
			ExecutedBy:  executedBy,
			ExecutedAt:  result.ExecutedAt,
		}
		if s.db != nil {
			s.db.Create(&record)
		}

		if execErr != nil {
			result.ExecutionID = record.ExecutionID
		}
		results = append(results, result)
	}

	return results, nil
}

// executeOnCI executes a script on a single CI
func (s *Service) executeOnCI(ctx context.Context, ciID string, req *ScriptExecutionRequest, tenantID int64) (ScriptExecutionResult, error) {
	// Get CI info
	ci, err := s.cmdbService.GetCIByCiID(ciID, tenantID)
	if err != nil {
		return ScriptExecutionResult{}, fmt.Errorf("CI %s not found: %w", ciID, err)
	}

	// Build SSH config
	sshConfig := buildSSHConfig(ci)
	if sshConfig.Host == "" {
		return ScriptExecutionResult{}, fmt.Errorf("CI %s has no IP or hostname for SSH connection", ciID)
	}
	if sshConfig.Password == "" && sshConfig.PrivateKey == "" {
		return ScriptExecutionResult{}, fmt.Errorf("CI %s has no SSH credentials configured", ciID)
	}

	// Process script parameters
	processedScript := req.Script
	for key, value := range req.Parameters {
		processedScript = strings.ReplaceAll(processedScript, "${"+key+"}", value)
	}

	// Build command using heredoc for safe script passing
	command := buildScriptCommand(processedScript, req.ScriptType)

	timeout := req.Timeout
	if timeout <= 0 {
		timeout = 30000
	}

	// Execute via SSH
	return executeSSHCommand(ctx, sshConfig, command, timeout)
}

// buildSSHConfig builds SSH configuration from CI attributes
func buildSSHConfig(ci *cmdb.CI) SSHConfig {
	attrs := ci.Attributes
	if attrs == nil {
		return SSHConfig{}
	}

	username := attrs["ssh_user"]
	if username == "" {
		username = attrs["username"]
	}
	if username == "" {
		username = "root"
	}

	port := 22
	if p, ok := attrs["ssh_port"]; ok && p != "" {
		fmt.Sscanf(p, "%d", &port)
	} else if p, ok := attrs["port"]; ok && p != "" {
		fmt.Sscanf(p, "%d", &port)
	}

	return SSHConfig{
		Host:       attrs["ip"],
		Port:       port,
		Username:   username,
		Password:   attrs["ssh_password"],
		PrivateKey: attrs["ssh_private_key"],
		Passphrase: attrs["ssh_passphrase"],
	}
}

// buildScriptCommand builds a safe heredoc command to prevent injection
func buildScriptCommand(script string, scriptType ScriptType) string {
	switch scriptType {
	case ScriptTypeBash:
		return "bash << 'CMDB_SCRIPT_EOF'\n" + script + "\nCMDB_SCRIPT_EOF"
	case ScriptTypePython:
		return "python3 << 'CMDB_SCRIPT_EOF'\n" + script + "\nCMDB_SCRIPT_EOF"
	case ScriptTypePowerShell:
		return "pwsh -Command - << 'CMDB_SCRIPT_EOF'\n" + script + "\nCMDB_SCRIPT_EOF"
	default:
		return "bash << 'CMDB_SCRIPT_EOF'\n" + script + "\nCMDB_SCRIPT_EOF"
	}
}

// executeSSHCommand executes a command via SSH
func executeSSHCommand(ctx context.Context, config SSHConfig, command string, timeoutMs int) (ScriptExecutionResult, error) {
	// TODO: Implement real SSH execution using golang.org/x/crypto/ssh
	// For now, return a placeholder that indicates the SSH dependency

	startTime := time.Now()
	return ScriptExecutionResult{
		Status:     StatusFailed,
		Stderr:     "SSH execution not yet implemented - requires golang.org/x/crypto/ssh",
		ExitCode:   -1,
		Duration:   time.Since(startTime).Milliseconds(),
		ExecutedAt: startTime,
	}, nil
}
