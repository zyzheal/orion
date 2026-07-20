package service

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/plugin/models"
	"orion/platform-svc-go/internal/plugin/repository"

	"github.com/google/uuid"
)

var ErrPluginNotFound = errors.New("plugin not found")

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ===========================================================================
// Plugin CRUD (existing)
// ===========================================================================

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreatePluginRequest) (*models.Plugin, error) {
	d := &models.Plugin{ID: uuid.New().String(), TenantID: tenantID, Name: req.Name}
	return d, s.repo.Create(ctx, d)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Plugin, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Plugin, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// ===========================================================================
// Plugin management (Install / Enable / Disable / Update)
// ===========================================================================

// Install sets up a plugin with a given version and config. It mirrors the
// TS installPlugin() flow: look up (or create) the plugin and mark it
// enabled.  Returns the saved plugin record.
func (s *Service) Install(ctx context.Context, tenantID, pluginID, version string, config models.JSONB) (*models.Plugin, error) {
	// Try to locate an existing plugin so we do not duplicate; otherwise
	// create a new placeholder record keyed by pluginID.
	p, err := s.GetByID(ctx, tenantID, pluginID)
	if err != nil {
		// Not found — create a new placeholder matching the requested version.
		p = &models.Plugin{
			ID:       uuid.New().String(),
			TenantID: tenantID,
			Name:     pluginID,
			Version:  version,
			Enabled:  true,
			Config:   config,
		}
		if err := s.repo.Create(ctx, p); err != nil {
			return nil, err
		}
		// Refresh from DB so the caller sees the persisted record.
		return s.repo.GetByID(ctx, tenantID, p.ID)
	}
	// Update version/config.
	versionStr := version
	nameStr := pluginID
	_, err = s.repo.Update(ctx, tenantID, p.ID, &models.UpdatePluginRequest{
		Version: &versionStr,
		Name:    &nameStr,
		Config:  config,
	})
	if err != nil {
		return nil, err
	}
	// Ensure the plugin is enabled after install (UpdatePluginRequest does not
	// carry Enabled, so toggle it separately).
	enabled, err := s.repo.ToggleEnabled(ctx, tenantID, p.ID, true)
	if err != nil {
		return nil, err
	}
	return enabled, nil
}

// Enable marks a plugin as active.
func (s *Service) Enable(ctx context.Context, tenantID, id string) (*models.Plugin, error) {
	_, err := s.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrPluginNotFound
	}
	return s.repo.ToggleEnabled(ctx, tenantID, id, true)
}

// Disable marks a plugin as inactive.
func (s *Service) Disable(ctx context.Context, tenantID, id string) (*models.Plugin, error) {
	_, err := s.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrPluginNotFound
	}
	return s.repo.ToggleEnabled(ctx, tenantID, id, false)
}

// Update applies partial updates to an existing plugin.
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdatePluginRequest) (*models.Plugin, error) {
	return s.repo.Update(ctx, tenantID, id, req)
}

// ===========================================================================
// Executions
// ===========================================================================

// CreateExecution records a new execution attempt and returns it.
func (s *Service) CreateExecution(ctx context.Context, tenantID, pluginID string, req *models.ExecutePluginRequest) (*models.PluginExecution, error) {
	e := &models.PluginExecution{
		ID:            uuid.New().String(),
		PluginID:      pluginID,
		TenantID:      tenantID,
		TaskID:        req.TaskID,
		PipelineRunID: req.PipelineRunID,
		StageID:       req.StageID,
		Status:        "running",
		StartedAt:     time.Now(),
	}
	if err := s.repo.CreateExecution(ctx, e); err != nil {
		return nil, err
	}
	return e, nil
}

// CompleteExecution marks an execution as finished with the given result.
func (s *Service) CompleteExecution(ctx context.Context, tenantID, executionID string, result *models.ExecutionResult) error {
	return s.repo.CompleteExecution(ctx, tenantID, executionID, result)
}

// GetExecutionByTaskID returns the most recent execution for a task.
func (s *Service) GetExecutionByTaskID(ctx context.Context, tenantID, taskID string) (*models.PluginExecution, error) {
	return s.repo.GetExecutionByTaskID(ctx, tenantID, taskID)
}

// ListExecutions returns executions for a plugin, newest first.
func (s *Service) ListExecutions(ctx context.Context, tenantID, pluginID string, offset, limit int) ([]models.PluginExecution, error) {
	return s.repo.ListExecutions(ctx, tenantID, pluginID, offset, limit)
}

// GetActiveExecutionCount returns how many executions are currently running
// for a tenant (mirrors the TS pluginExecutor.getActiveExecutionCount()).
func (s *Service) GetActiveExecutionCount(ctx context.Context, tenantID string) (int, error) {
	return s.repo.GetActiveExecutionCount(ctx, tenantID)
}

// ===========================================================================
// Audit
// ===========================================================================

// CreateAuditEntry inserts an audit log record.
func (s *Service) CreateAuditEntry(ctx context.Context, e *models.AuditEntry) error {
	return s.repo.CreateAuditEntry(ctx, e)
}

// ListAuditEntries returns audit entries for a tenant (optionally scoped to a
// plugin), newest first, capped by limit.
func (s *Service) ListAuditEntries(ctx context.Context, tenantID, pluginID string, limit int) ([]models.AuditEntry, error) {
	f := &models.AuditLogFilter{TenantID: tenantID, PluginID: pluginID, Limit: limit}
	if f.Limit <= 0 || f.Limit > 500 {
		f.Limit = 50
	}
	return s.repo.ListAuditEntries(ctx, f)
}

// AuditTrail returns audit entries ordered by task (the TS
// audit/:taskId/trail endpoint).
func (s *Service) AuditTrail(ctx context.Context, taskID string, limit int) ([]models.AuditEntry, error) {
	f := &models.AuditLogFilter{TaskID: taskID, Limit: limit}
	if f.Limit <= 0 || f.Limit > 500 {
		f.Limit = 50
	}
	return s.repo.ListAuditEntries(ctx, f)
}

// ===========================================================================
// Debug state (in-process, not persisted — mirrors TS DebugController)
// ===========================================================================

// DebugState describes the current debug stop for a run.
type DebugState struct {
	RunID    string       `json:"run_id"`
	Status   string       `json:"status"` // "paused", "running", "stepping"
	Position models.JSONB `json:"position,omitempty"`
	Metadata models.JSONB `json:"metadata,omitempty"`
}

// GetDebugState returns the debug state for a run if one is present.
func (s *Service) GetDebugState(runID string) *DebugState {
	return debugStates.Load(runID)
}

// SetDebugState records a debug state for a run.
func (s *Service) SetDebugState(runID string, status string, position, metadata models.JSONB) {
	debugStates.Store(runID, &DebugState{
		RunID:    runID,
		Status:   status,
		Position: position,
		Metadata: metadata,
	})
}

// Pause returns the current paused debug state for a run.
func (s *Service) Pause(ctx context.Context, tenantID, runID string) *DebugState {
	s.SetDebugState(runID, "paused", nil, nil)
	return s.GetDebugState(runID)
}

// Resume clears the debug state for a run, returning a state marked "running".
func (s *Service) Resume(ctx context.Context, tenantID, runID string) {
	debugStates.Delete(runID)
	s.SetDebugState(runID, "running", nil, nil)
}

// Step marks a run as stepping through one instruction, then returns it.
func (s *Service) Step(ctx context.Context, tenantID, runID string) *DebugState {
	s.SetDebugState(runID, "stepping", nil, nil)
	return s.GetDebugState(runID)
}

// ===========================================================================
// AI Diagnosis
// ===========================================================================

// DiagnoseRequest matches the required fields the TS endpoint expects.
type DiagnoseRequest struct {
	TaskID       string       `json:"task_id"        binding:"required"`
	PluginID     string       `json:"plugin_id"      binding:"required"`
	ErrorMessage string       `json:"error_message"  binding:"required"`
	Input        models.JSONB `json:"input,omitempty"`
}

// DiagnoseResult is the diagnostic payload returned to the caller.
type DiagnoseResult struct {
	Success     bool         `json:"success"`
	TaskID      string       `json:"task_id"`
	PluginID    string       `json:"plugin_id"`
	Diagnosis   string       `json:"diagnosis"`
	Suggestions []string     `json:"suggestions,omitempty"`
	Metadata    models.JSONB `json:"metadata,omitempty"`
}

// Diagnose analyses an error context and returns a diagnosis.  It is a
// lightweight placeholder that mirrors the TS aiDiagnosis.diagnose() path
// without requiring an external LLM client; callers can wire their own
// provider in the future.
func (s *Service) Diagnose(ctx context.Context, tenantID string, req *DiagnoseRequest) (*DiagnoseResult, error) {
	result := &DiagnoseResult{
		Success:   true,
		TaskID:    req.TaskID,
		PluginID:  req.PluginID,
		Diagnosis: "Error detected in plugin execution for task " + req.TaskID,
		Suggestions: []string{
			"Review the plugin logs for " + req.PluginID,
			"Check plugin configuration and input parameters",
			"Consider retrying the task with reduced resource constraints",
		},
	}
	return result, nil
}

// ===========================================================================
// Resource Quotas
// ===========================================================================

// UpsertPluginQuota creates or updates the resource quota for a plugin.
func (s *Service) UpsertPluginQuota(ctx context.Context, pluginID string, q *models.ResourceQuota) error {
	return s.repo.UpsertPluginQuota(ctx, pluginID, q)
}

// GetPluginQuota returns the resource quota for a plugin.
func (s *Service) GetPluginQuota(ctx context.Context, pluginID string) (*models.PluginResourceQuota, error) {
	return s.repo.GetPluginQuota(ctx, pluginID)
}

// DeletePluginQuota removes the resource quota for a plugin.
func (s *Service) DeletePluginQuota(ctx context.Context, pluginID string) error {
	return s.repo.DeletePluginQuota(ctx, pluginID)
}

// ===========================================================================
// Security Events
// ===========================================================================

// CreateSecurityEvent inserts a security event.
func (s *Service) CreateSecurityEvent(ctx context.Context, e *models.SecurityEvent) error {
	return s.repo.CreateSecurityEvent(ctx, e)
}

// ListSecurityEvents returns security events for a tenant.
func (s *Service) ListSecurityEvents(ctx context.Context, f *models.SecurityEventFilter) ([]models.SecurityEvent, error) {
	if f.Limit <= 0 || f.Limit > 500 {
		f.Limit = 100
	}
	return s.repo.ListSecurityEvents(ctx, f)
}

// ===========================================================================
// Debug state storage (in-process cache mirroring TS DebugController)
// ===========================================================================

// debugStates holds in-process debug stop state keyed by run ID.
type debugStateStore struct {
	data map[string]*DebugState
}

var debugStates = &debugStateStore{data: make(map[string]*DebugState)}

func (s *debugStateStore) Load(runID string) *DebugState {
	return s.data[runID]
}

func (s *debugStateStore) Store(runID string, state *DebugState) {
	s.data[runID] = state
}

func (s *debugStateStore) Delete(runID string) {
	delete(s.data, runID)
}
