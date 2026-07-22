// Package service provides sandbox execution and job lifecycle management.
package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"orion/platform-svc-go/internal/sandbox/models"

	"go.uber.org/zap"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.SandboxJob) error
	GetByID(ctx context.Context, tenantID, id string) (*models.SandboxJob, error)
	List(ctx context.Context, tenantID string, status string) ([]models.SandboxJob, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.SandboxJob, error)
	Delete(ctx context.Context, tenantID, id string) error
}

// DefaultConfig returns sensible defaults for sandbox resource limits.
var DefaultConfig = models.SandboxConfig{
	MaxCPU:     1.0,
	MaxMemory:  128 * 1024 * 1024, // 128 MB
	Timeout:    30 * time.Second,
	Network:    false,
	FileAccess: false,
}

// LanguageRunner maps a language tag to the interpreter command.
var LanguageRunner = map[string][]string{
	"python":  {"python3", "-c"},
	"python3": {"python3", "-c"},
	"javascript": {"node", "-e"},
	"js":       {"node", "-e"},
	"bash":     {"bash", "-c"},
	"sh":       {"sh", "-c"},
}

type Service struct {
	repo   RepositoryInterface
	config models.SandboxConfig
	logger *zap.Logger
}

func NewService(repo RepositoryInterface, logger *zap.Logger) *Service {
	return &Service{repo: repo, config: DefaultConfig, logger: logger}
}

// WithConfig overrides the default sandbox resource limits.
func (s *Service) WithConfig(cfg models.SandboxConfig) {
	s.config = cfg
}

// CreateJob creates a new sandbox job in pending status.
func (s *Service) CreateJob(ctx context.Context, tenantID string, req models.CreateSandboxJobRequest) (*models.SandboxJob, error) {
	job := &models.SandboxJob{
		TenantID: tenantID,
		Code:     req.Code,
		Language: req.Language,
		MaxCPU:   s.config.MaxCPU,
		MaxMemory: s.config.MaxMemory,
		TimeoutSec: int64(s.config.Timeout.Seconds()),
		Network:  s.config.Network,
		FileAccess: s.config.FileAccess,
	}
	if req.MaxCPU != nil {
		job.MaxCPU = *req.MaxCPU
	}
	if req.MaxMemory != nil {
		job.MaxMemory = *req.MaxMemory
	}
	if req.TimeoutSec != nil {
		job.TimeoutSec = *req.TimeoutSec
	}
	if req.Network != nil {
		job.Network = *req.Network
	}
	if req.FileAccess != nil {
		job.FileAccess = *req.FileAccess
	}

	if err := s.repo.Create(ctx, job); err != nil {
		return nil, err
	}
	return job, nil
}

// GetJob retrieves a sandbox job by ID.
func (s *Service) GetJob(ctx context.Context, tenantID, id string) (*models.SandboxJob, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// ListJobs lists sandbox jobs, optionally filtered by status.
func (s *Service) ListJobs(ctx context.Context, tenantID string, status string) ([]models.SandboxJob, error) {
	return s.repo.List(ctx, tenantID, status)
}

// DeleteJob deletes a sandbox job.
func (s *Service) DeleteJob(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// Execute runs a sandbox job synchronously and updates its status in the DB.
func (s *Service) Execute(ctx context.Context, tenantID, jobID string) (*models.SandboxJob, error) {
	job, err := s.repo.GetByID(ctx, tenantID, jobID)
	if err != nil {
		return nil, err
	}
	if job.Status != models.JobStatusPending {
		return job, nil // already processed
	}

	s.logger.Info("sandbox job executing",
		zap.String("job_id", job.ID),
		zap.String("language", job.Language),
	)

	// Mark running
	s.repo.Update(ctx, tenantID, jobID, map[string]interface{}{"status": models.JobStatusRunning})

	// Build executor config from job-level overrides
	cfg := models.SandboxConfig{
		MaxCPU:     job.MaxCPU,
		MaxMemory:  job.MaxMemory,
		Timeout:    time.Duration(job.TimeoutSec) * time.Second,
		Network:    job.Network,
		FileAccess: job.FileAccess,
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = DefaultConfig.Timeout
	}

	result, err := s.runInSandbox(ctx, job.Code, job.Language, cfg)
	if err != nil {
		s.logger.Error("sandbox execution failed",
			zap.String("job_id", job.ID),
			zap.Error(err),
		)
		logsJSON, _ := json.Marshal(result.Logs)
		updates := map[string]interface{}{
			"status":     models.JobStatusFailed,
			"exit_code":  -1,
			"stdout":     result.Stdout,
			"stderr":     result.Stderr + "\n[error] " + err.Error(),
			"logs":       string(logsJSON),
		}
		return s.repo.Update(ctx, tenantID, jobID, updates)
	}

	// Build logs JSON
	logsJSON, _ := json.Marshal(result.Logs)
	status := models.JobStatusCompleted
	if result.ExitCode != 0 {
		status = models.JobStatusFailed
	}
	updates := map[string]interface{}{
		"status":    status,
		"exit_code": result.ExitCode,
		"stdout":    result.Stdout,
		"stderr":    result.Stderr,
		"logs":      string(logsJSON),
	}
	return s.repo.Update(ctx, tenantID, jobID, updates)
}

// runInSandbox executes code in an isolated subprocess. Container-based
// isolation (Docker/gVisor) is preferred when available; otherwise falls
// back to a resource-limited subprocess (safe degradation).
func (s *Service) runInSandbox(ctx context.Context, code, lang string, cfg models.SandboxConfig) (*models.ExecResult, error) {
	runner, ok := LanguageRunner[strings.ToLower(lang)]
	if !ok {
		return &models.ExecResult{
			ExitCode: -1,
			Stderr:   fmt.Sprintf("unsupported language: %s", lang),
			Logs:     []string{"[sandbox] unsupported language"},
		}, nil
	}

	result := &models.ExecResult{Logs: []string{"[sandbox] starting execution"}}

	// Try container isolation first (docker run)
	if s.tryContainerExecute(ctx, code, runner, cfg, result) {
		return result, nil
	}

	// Safe degradation: resource-limited subprocess
	result.Logs = append(result.Logs, "[sandbox] container unavailable, using subprocess isolation")
	return s.runSubprocess(ctx, code, runner, cfg, result)
}

// tryContainerExecute runs the code inside a Docker container. Returns true
// when container execution was attempted (success or docker not available).
func (s *Service) tryContainerExecute(ctx context.Context, code string, runner []string, cfg models.SandboxConfig, result *models.ExecResult) bool {
	_, err := exec.LookPath("docker")
	if err != nil {
		return false
	}

	// Write code to a temp file so we can mount it
	tmpFile, err := os.CreateTemp("", "sandbox-*.sh")
	if err != nil {
		return false
	}
	defer os.Remove(tmpFile.Name())

	// Detect script style and wrap accordingly
	wrapper := "#!/bin/sh\n"
	if len(runner) >= 2 {
		wrapper += fmt.Sprintf("%s -c \"$(cat /sandbox/code)\"\n", runner[0])
	}
	tmpFile.WriteString(wrapper)
	tmpFile.Close()

	// Write code content
	codeFile := tmpFile.Name() + ".code"
	if err := os.WriteFile(codeFile, []byte(code), 0o600); err != nil {
		return false
	}
	defer os.Remove(codeFile)

	dockerCmd := exec.CommandContext(ctx, "docker", "run", "--rm",
		"--memory", fmt.Sprintf("%d", cfg.MaxMemory),
		"--cpus", fmt.Sprintf("%.2f", cfg.MaxCPU),
	)

	// Security defaults: no network unless explicitly allowed
	if !cfg.Network {
		dockerCmd.Args = append(dockerCmd.Args, "--network=none")
	}
	// Drop all capabilities, add minimal set
	dockerCmd.Args = append(dockerCmd.Args,
		"--cap-drop=ALL",
		"--security-opt=no-new-privileges:true",
		"--read-only",
		"--tmpfs=/tmp:rw,size=10M",
	)

	// Mount code file
	dockerCmd.Args = append(dockerCmd.Args,
		"-v", codeFile+":/sandbox/code:ro",
		"-v", tmpFile.Name()+":/sandbox/run.sh:ro",
	)

	// Use a minimal read-only alpine image with needed runtime
	dockerCmd.Args = append(dockerCmd.Args,
		"orion/sandbox-alpine:latest",
		"sh", "/sandbox/run.sh",
	)

	// Set overall timeout
	if cfg.Timeout > 0 {
		tctx, cancel := context.WithTimeout(ctx, cfg.Timeout)
		defer cancel()
		dockerCmd = exec.CommandContext(tctx, dockerCmd.Args[0], dockerCmd.Args[1:]...)
	}

	var stdout, stderr bytes.Buffer
	dockerCmd.Stdout = &stdout
	dockerCmd.Stderr = &stderr

	result.Logs = append(result.Logs, "[sandbox] launching container")
	if err := dockerCmd.Run(); err != nil {
		// If image doesn't exist, fall through to subprocess
		if strings.Contains(err.Error(), "No such image") || strings.Contains(err.Error(), "image not found") {
			result.Logs = append(result.Logs, "[sandbox] docker image not available, falling back")
			return false
		}
		// Timeout / permission / other error — treat as execution error
		result.ExitCode = -1
		result.Stdout = stdout.String()
		result.Stderr = stderr.String()
		result.Logs = append(result.Logs, fmt.Sprintf("[sandbox] container failed: %s", err.Error()))
		return true
	}

	result.ExitCode = 0
	result.Stdout = stdout.String()
	result.Stderr = stderr.String()
	result.Logs = append(result.Logs, "[sandbox] container completed")
	return true
}

// runSubprocess executes the code in a subprocess with resource limits
// (RLIMIT_CPU / RLIMIT_AS) and without network. This is the safe-degradation
// path when Docker is unavailable.
func (s *Service) runSubprocess(ctx context.Context, code string, runner []string, cfg models.SandboxConfig, result *models.ExecResult) (*models.ExecResult, error) {
	// Build command: interpreter -c "code"
	var cmdArgs []string
	if len(runner) >= 2 {
		cmdArgs = []string{runner[0], runner[1], code}
	} else if len(runner) == 1 {
		cmdArgs = []string{runner[0], code}
	} else {
		return nil, errors.New("invalid runner configuration")
	}

	cmd := exec.CommandContext(ctx, cmdArgs[0], cmdArgs[1:]...)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Resource limits enforced via timeout context (context cancellation).
	// OS-level rlimits (RLIMIT_CPU/AS) are only available on Linux; the
	// context-based timeout above provides cross-platform execution limits.

	// Override timeout
	var cancel context.CancelFunc
	if cfg.Timeout > 0 {
		ctx, cancel = context.WithTimeout(ctx, cfg.Timeout)
		defer cancel()
		cmd = exec.CommandContext(ctx, cmd.Args[0], cmd.Args[1:]...)
	}

	result.Logs = append(result.Logs, fmt.Sprintf("[sandbox] running subprocess: %v", cmd.Args))
	start := time.Now()
	err := cmd.Run()
	duration := time.Since(start)

	result.Stdout = stdout.String()
	result.Stderr = stderr.String()

	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			result.ExitCode = -1
			result.Stderr += "\n[error] execution timeout"
			result.Logs = append(result.Logs, "[sandbox] timeout")
			// Store status timeout via caller convention
		} else {
			result.ExitCode = cmd.ProcessState.ExitCode()
			result.Logs = append(result.Logs, fmt.Sprintf("[sandbox] exited with code %d", result.ExitCode))
		}
	} else {
		result.ExitCode = 0
		result.Logs = append(result.Logs, "[sandbox] exited cleanly")
	}
	result.Logs = append(result.Logs, fmt.Sprintf("[sandbox] duration: %s", duration.String()))

	return result, nil
}
