// Package service provides business logic for the Runner CI task execution service.
//
// The service layer validates requests, orchestrates job lifecycle (pending → running →
// completed/failed/cancelled), and provides status management for runner agents.
//
// Translated from TS: RunnerService.ts (324 lines) — the TS version also included
// platform registration and heartbeat HTTP calls. Those runtime coordination aspects
// are handled by external orchestrators in Go; the service focuses on in-process
// business rules and job state transitions.
//
// Design decisions:
//   - No direct child_process spawning in this service (Go sandbox module handles
//     isolated code execution); the service manages job state tracking.
//   - Job status transitions are validated against allowed transitions.
//   - Agent capacity checks prevent overloading runners.
package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"orion/platform-svc-go/internal/runner/models"
	"orion/platform-svc-go/internal/runner/repository"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
)

var (
	ErrInvalidTaskType  = errors.New("invalid task type")
	ErrInvalidStatus    = errors.New("invalid job status")
	ErrInvalidStatusTxn = errors.New("invalid status transition")
	ErrAgentNotFound    = errors.New("runner agent not found")
	ErrAgentOffline     = errors.New("runner agent is offline")
	ErrAtCapacity       = errors.New("runner agent at capacity")
	ErrMissingCommand   = errors.New("task requires a command or script")
	ErrInvalidTimeout   = errors.New("invalid timeout value")
	ErrJobNotFound      = errors.New("job not found")
)

// Service provides business logic for runner agents and job execution tracking.
type Service struct {
	repo      *repository.Repository
	mu        sync.RWMutex
	platformURL string
}

// NewService creates a new Service.
func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// WithPlatformURL sets the platform callback URL for job result reporting.
// Used when the service needs to report results back to the Orion Platform.
func (s *Service) WithPlatformURL(url string) {
	s.platformURL = url
}

// ===========================================================================
// Runner Agent Management
// ===========================================================================

// RegisterAgent registers a new runner agent with the platform.
// Translated from TS RunnerService.register().
func (s *Service) RegisterAgent(ctx context.Context, tenantID string, req *models.CreateAgentRequest) (*models.RunnerAgent, error) {
	maxConcurrent := req.MaxConcurrent
	if maxConcurrent <= 0 {
		maxConcurrent = 5
	}
	if maxConcurrent > 100 {
		maxConcurrent = 100
	}

	agentID := strings.TrimSpace(req.Name)
	if agentID == "" {
		agentID = "runner-" + uuid.New().String()[:8]
	}

	metadata := models.JSONB{}
	for k, v := range req.Metadata {
		metadata[k] = v
	}

	labels := models.JSONArray(req.Labels)
	if labels == nil {
		labels = models.JSONArray{"linux", "nodejs"}
	}

	a := &models.RunnerAgent{
		AgentID:       agentID,
		TenantID:      tenantID,
		Name:          req.Name,
		Labels:        labels,
		Endpoint:      req.Endpoint,
		MaxConcurrent: maxConcurrent,
		Status:        string(models.AgentStatusRegistering),
		Metadata:      metadata,
	}

	// Check if agent already registered
	existing, err := s.repo.GetAgentByAgentID(ctx, agentID)
	if err == nil && existing != nil {
		// Re-registration: update status to online
		status := string(models.AgentStatusOnline)
		err := s.repo.UpdateAgent(ctx, existing.ID, nil, nil, &status, nil)
		if err != nil {
			return nil, fmt.Errorf("update existing agent failed: %w", err)
		}
		return existing, nil
	}

	if err := s.repo.CreateAgent(ctx, a); err != nil {
		return nil, fmt.Errorf("create agent failed: %w", err)
	}

	// Promote to online after successful registration
	status := string(models.AgentStatusOnline)
	if err := s.repo.UpdateAgent(ctx, a.ID, nil, nil, &status, nil); err != nil {
		return nil, fmt.Errorf("set agent online failed: %w", err)
	}
	a.Status = string(models.AgentStatusOnline)

	return a, nil
}

// GetAgent returns agent info by agent_id.
func (s *Service) GetAgent(ctx context.Context, tenantID, agentID string) (*models.AgentInfo, error) {
	a, err := s.repo.GetAgentByAgentID(ctx, agentID)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) || errors.Is(err, repository.ErrNotFound) {
			return nil, fmt.Errorf("%w: %s", ErrAgentNotFound, agentID)
		}
		return nil, fmt.Errorf("get agent failed: %w", err)
	}
	// Multi-tenant check
	if tenantID != "" && a.TenantID != tenantID {
		return nil, fmt.Errorf("%w: agent %s", ErrAgentNotFound, agentID)
	}

	activeJobs, _ := s.repo.CountActiveJobsByAgent(ctx, a.ID)

	return &models.AgentInfo{
		AgentID:       a.AgentID,
		ActiveJobs:    activeJobs,
		Status:        a.Status,
		MaxConcurrent: a.MaxConcurrent,
		Name:          a.Name,
		Endpoint:      a.Endpoint,
	}, nil
}

// ListAgents returns paginated agents.
func (s *Service) ListAgents(ctx context.Context, tenantID string, offset, limit int) ([]models.RunnerAgent, error) {
	return s.repo.ListAgents(ctx, tenantID, "", offset, limit)
}

// UpdateAgent updates agent configuration.
func (s *Service) UpdateAgent(ctx context.Context, tenantID, agentID string, req *models.UpdateAgentRequest) (*models.RunnerAgent, error) {
	a, err := s.repo.GetAgentByAgentID(ctx, agentID)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) || errors.Is(err, repository.ErrNotFound) {
			return nil, fmt.Errorf("%w: %s", ErrAgentNotFound, agentID)
		}
		return nil, err
	}
	if tenantID != "" && a.TenantID != tenantID {
		return nil, fmt.Errorf("%w: agent %s", ErrAgentNotFound, agentID)
	}

	if req.Status != nil {
		valid := models.ValidAgentStatuses[models.AgentStatus(*req.Status)]
		if !valid {
			return nil, fmt.Errorf("%w: %s", ErrInvalidStatus, *req.Status)
		}
	}

	var labels *models.JSONArray
	if req.Labels != nil {
		l := models.JSONArray(*req.Labels)
		labels = &l
	}

	err = s.repo.UpdateAgent(ctx, a.ID, labels, req.MaxConcurrent, req.Status, req.Metadata)
	if err != nil {
		return nil, fmt.Errorf("update agent failed: %w", err)
	}

	updated, err := s.repo.GetAgentByID(ctx, a.ID)
	return updated, err
}

// DeleteAgent removes an agent.
func (s *Service) DeleteAgent(ctx context.Context, tenantID, agentID string) error {
	a, err := s.repo.GetAgentByAgentID(ctx, agentID)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) || errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("%w: %s", ErrAgentNotFound, agentID)
		}
		return err
	}
	if tenantID != "" && a.TenantID != tenantID {
		return fmt.Errorf("%w: agent %s", ErrAgentNotFound, agentID)
	}
	return s.repo.DeleteAgent(ctx, a.ID)
}

// AgentHeartbeat processes an incoming heartbeat from an agent.
// Translated from TS RunnerService.startHeartbeat() logic.
func (s *Service) AgentHeartbeat(ctx context.Context, tenantID, agentID string, req *models.HeartbeatRequest) error {
	// Verify agent exists
	_, err := s.repo.GetAgentByAgentID(ctx, agentID)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) || errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("%w: %s", ErrAgentNotFound, agentID)
		}
		return err
	}

	// Update agent last heartbeat time
	if err := s.repo.UpdateAgentLastHeartbeat(ctx, agentID, time.Now().UTC()); err != nil {
		return fmt.Errorf("update heartbeat failed: %w", err)
	}

	// Record heartbeat
	hb := &models.RunnerHeartbeat{
		AgentID:     agentID,
		ActiveJobs:  req.ActiveJobs,
		CPUUsage:    req.CPUUsage,
		MemoryUsage: req.MemoryUsage,
		DiskUsage:   req.DiskUsage,
	}
	if err := s.repo.CreateHeartbeat(ctx, hb); err != nil {
		return fmt.Errorf("record heartbeat failed: %w", err)
	}

	return nil
}

// AgentHealth returns the overall health of the service.
func (s *Service) AgentHealth(ctx context.Context) (string, error) {
	return "ok", nil
}

// ===========================================================================
// Job Execution Lifecycle
// ===========================================================================

// CreateJob dispatches a new task to a runner agent. Validates capacity and task
// parameters before creating the job record.
// Translated from TS RunnerService.executeJob() — adapted for Go (no in-process
// child_process spawning; the service tracks state, execution delegated externally).
func (s *Service) CreateJob(ctx context.Context, tenantID string, req *models.CreateJobRequest) (*models.RunnerJob, error) {
	// Validate task type
	taskType := strings.ToLower(strings.TrimSpace(req.Task.Type))
	if taskType == "" {
		return nil, ErrInvalidTaskType
	}
	if !models.ValidTaskTypes[taskType] {
		return nil, fmt.Errorf("%w: %s (allowed: shell, npm, test, build, http, pipeline, deploy)", ErrInvalidTaskType, req.Task.Type)
	}

	// Validate shell tasks have command or script
	if taskType == "shell" && req.Task.Command == "" && req.Task.Script == "" {
		return nil, ErrMissingCommand
	}

	// Validate timeout
	timeout := req.Task.Timeout
	if timeout > 0 && (timeout < 1000 || timeout > 3600000) {
		return nil, ErrInvalidTimeout
	}

	// Verify agent exists and is online
	agent, err := s.repo.GetAgentByAgentID(ctx, req.AgentID)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) || errors.Is(err, repository.ErrNotFound) {
			return nil, fmt.Errorf("%w: %s", ErrAgentNotFound, req.AgentID)
		}
		return nil, fmt.Errorf("get agent failed: %w", err)
	}
	if tenantID != "" && agent.TenantID != tenantID {
		return nil, fmt.Errorf("%w: agent %s", ErrAgentNotFound, req.AgentID)
	}
	if models.AgentStatus(agent.Status) == models.AgentStatusOffline {
		return nil, fmt.Errorf("%w: %s", ErrAgentOffline, req.AgentID)
	}

	// Check capacity (active running jobs < max concurrent)
	activeJobs, err := s.repo.CountActiveJobsByAgent(ctx, agent.ID)
	if err != nil {
		return nil, fmt.Errorf("check capacity failed: %w", err)
	}
	if activeJobs >= agent.MaxConcurrent {
		return nil, fmt.Errorf("%w: %d/%d running jobs for agent %s", ErrAtCapacity, activeJobs, agent.MaxConcurrent, req.AgentID)
	}

	// Build task parameters JSONB
	params := models.JSONB{}
	for k, v := range req.Task.Parameters {
		params[k] = v
	}
	params["command"] = req.Task.Command
	params["script"] = req.Task.Script
	params["args"] = req.Task.Args
	params["timeout"] = timeout
	params["working_dir"] = "/tmp/orion-workspace-" + uuid.New().String()

	jobID := strings.TrimSpace(req.Task.Type) + "-" + uuid.New().String()[:8]

	j := &models.RunnerJob{
		JobID:    jobID,
		AgentID:  agent.ID,
		TenantID: tenantID,
		TaskType: taskType,
		Params:   params,
		Status:   models.JobStatusPending,
	}

	if err := s.repo.CreateJob(ctx, j); err != nil {
		return nil, fmt.Errorf("create job failed: %w", err)
	}

	return j, nil
}

// TransitionJob transitions a job to a new status with optional result data.
// Enforces valid status transitions.
// Translated from TS: markRunning, markComplete, markFailed, markCancelled.
func (s *Service) TransitionJob(ctx context.Context, tenantID, jobID string, req *models.UpdateJobStatusRequest) (*models.RunnerJob, error) {
	j, err := s.repo.GetJobByJobID(ctx, jobID)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) || errors.Is(err, repository.ErrNotFound) {
			return nil, fmt.Errorf("%w: %s", ErrJobNotFound, jobID)
		}
		return nil, fmt.Errorf("get job failed: %w", err)
	}
	if tenantID != "" && j.TenantID != tenantID {
		return nil, fmt.Errorf("%w: job %s", ErrJobNotFound, jobID)
	}

	// Validate target status
	if !models.ValidJobStatuses[req.Status] {
		return nil, fmt.Errorf("%w: %s (allowed: pending, running, completed, failed, cancelled)", ErrInvalidStatus, req.Status)
	}

	// Validate transitions (only allow forward progress)
	validTransitions := map[models.JobStatus][]models.JobStatus{
		models.JobStatusPending:   {models.JobStatusRunning, models.JobStatusCancelled},
		models.JobStatusRunning:   {models.JobStatusCompleted, models.JobStatusFailed, models.JobStatusCancelled},
		models.JobStatusCompleted: {}, // terminal
		models.JobStatusFailed:    {}, // terminal
		models.JobStatusCancelled: {}, // terminal
	}
	allowed := validTransitions[j.Status]
	allowedMap := make(map[models.JobStatus]bool)
	for _, s := range allowed {
		allowedMap[s] = true
	}
	if !allowedMap[req.Status] {
		return nil, fmt.Errorf("%w: %s → %s (allowed: %v)", ErrInvalidStatusTxn, j.Status, req.Status, allowed)
	}

	var result *models.JSONB
	if req.Result != nil {
		r := *req.Result
		result = &r
	}

	switch req.Status {
	case models.JobStatusRunning:
		_, err = s.repo.MarkRunning(ctx, j.ID)
	case models.JobStatusCompleted:
		jobResult := result
		if jobResult == nil {
			jobResult = &models.JSONB{}
		}
		_, err = s.repo.MarkComplete(ctx, j.ID, *jobResult, req.Stdout, req.Stderr, req.ExitCode, req.DurationMs)
	case models.JobStatusFailed:
		errMsg := "task execution failed"
		if req.ErrMsg != nil {
			errMsg = *req.ErrMsg
		}
		_, err = s.repo.MarkFailed(ctx, j.ID, errMsg, req.Stderr, req.DurationMs)
	case models.JobStatusCancelled:
		_, err = s.repo.MarkCancelled(ctx, j.ID)
	}
	if err != nil {
		return nil, fmt.Errorf("transition job %s to %s failed: %w", jobID, req.Status, err)
	}

	updated, err := s.repo.GetJobByJobID(ctx, jobID)
	return updated, err
}

// GetJob returns job details by job_id.
func (s *Service) GetJob(ctx context.Context, tenantID, jobID string) (*models.RunnerJob, error) {
	j, err := s.repo.GetJobByJobID(ctx, jobID)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) || errors.Is(err, repository.ErrNotFound) {
			return nil, fmt.Errorf("%w: %s", ErrJobNotFound, jobID)
		}
		return nil, fmt.Errorf("get job failed: %w", err)
	}
	if tenantID != "" && j.TenantID != tenantID {
		return nil, fmt.Errorf("%w: job %s", ErrJobNotFound, jobID)
	}
	return j, nil
}

// ListJobs returns paginated jobs with optional status filter.
func (s *Service) ListJobs(ctx context.Context, tenantID, status string, offset, limit int) ([]models.RunnerJob, error) {
	return s.repo.ListJobs(ctx, tenantID, "", status, offset, limit)
}

// ListJobsByAgent returns paginated jobs for a specific agent.
func (s *Service) ListJobsByAgent(ctx context.Context, tenantID, agentID string, offset, limit int) ([]models.RunnerJob, error) {
	return s.repo.ListJobs(ctx, tenantID, agentID, "", offset, limit)
}

// DeleteJob removes a job record.
func (s *Service) DeleteJob(ctx context.Context, tenantID, jobID string) error {
	j, err := s.repo.GetJobByJobID(ctx, jobID)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) || errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("%w: %s", ErrJobNotFound, jobID)
		}
		return err
	}
	if tenantID != "" && j.TenantID != tenantID {
		return fmt.Errorf("%w: job %s", ErrJobNotFound, jobID)
	}
	return s.repo.DeleteJob(ctx, j.ID)
}

// ===========================================================================
// Job Result Reporting (callback to platform)
// ===========================================================================

// ReportJobResult prepares a JobResult for callback reporting.
// The actual HTTP callback is performed asynchronously by an external orchestrator.
func (s *Service) ReportJobResult(ctx context.Context, jobID string) (*models.JobResult, error) {
	j, err := s.repo.GetJobByJobID(ctx, jobID)
	if err != nil {
		return nil, err
	}

	success := j.Status == models.JobStatusCompleted
	durationMs := 0
	if j.DurationMs != nil {
		durationMs = *j.DurationMs
	}
	exitCode := 0
	if j.ExitCode != nil {
		exitCode = *j.ExitCode
	}
	stdout := ""
	if j.Stdout != nil {
		stdout = *j.Stdout
	}
	stderr := ""
	if j.Stderr != nil {
		stderr = *j.Stderr
	}

	return &models.JobResult{
		JobID:      jobID,
		Status:     string(j.Status),
		Success:    success,
		Stdout:     stdout,
		Stderr:     stderr,
		ExitCode:   exitCode,
		DurationMs: durationMs,
	}, nil
}

// ===========================================================================
// Task validation helpers (extracted from TS test utils for Go use)
// ===========================================================================

// ValidateTaskParameters validates task type and parameters, returning errors.
// Translated from TS test file validation logic.
func ValidateTaskParameters(taskType string, command, script string, timeout int) []string {
	var errs []string
	taskType = strings.TrimSpace(taskType)
	if taskType == "" {
		errs = append(errs, "task type is required")
	}
	if taskType != "" && !models.ValidTaskTypes[taskType] {
		errs = append(errs, fmt.Sprintf("unknown task type: %s", taskType))
	}
	if taskType == "shell" && command == "" && script == "" {
		errs = append(errs, "shell task requires command or script")
	}
	if timeout > 0 && (timeout < 1000 || timeout > 3600000) {
		errs = append(errs, "timeout must be between 1000ms and 3600000ms")
	}
	return errs
}

// EstimateTaskDuration returns a suggested timeout based on task type.
// Translated from TS estimateTaskDuration().
func EstimateTaskDuration(taskType string, customTimeout int) int {
	baseTimeout := customTimeout
	if baseTimeout == 0 {
		baseTimeout = 300000 // 5 min default
	}

	switch strings.ToLower(strings.TrimSpace(taskType)) {
	case "shell":
		if baseTimeout > 60000 {
			return 60000 // Shell tasks cap at 1 min
		}
		return baseTimeout
	case "http":
		if baseTimeout > 30000 {
			return 30000 // HTTP tasks cap at 30s
		}
		return baseTimeout
	case "pipeline":
		return baseTimeout // Pipeline uses full timeout
	case "deploy":
		if baseTimeout > 600000 {
			return 600000 // Deploy tasks cap at 10 min
		}
		return baseTimeout
	default:
		return baseTimeout
	}
}

// ===========================================================================
// Cleanup helpers
// ===========================================================================

// PurgeExpiredHeartbeats removes heartbeats older than the retention period.
func (s *Service) PurgeExpiredHeartbeats(ctx context.Context, retention time.Duration) (int64, error) {
	return s.repo.PurgeExpiredHeartbeats(ctx, retention)
}

// CountJobs returns total job count for a tenant.
func (s *Service) CountJobs(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountJobs(ctx, tenantID)
}

// CountAgents returns total agent count for a tenant.
func (s *Service) CountAgents(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountAgents(ctx, tenantID)
}
