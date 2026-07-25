// Package service provides the JobActionExecutor and the 42 built-in action handlers.
package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/job-actions/models"
	"orion/platform-svc-go/internal/job-actions/repository"
)

var (
	ErrActionNotFound = errors.New("action not found")
	ErrHandlerNotFound = errors.New("action handler not registered")
	ErrActionDisabled = errors.New("action is disabled")
)

// ---------------------------------------------------------------------------
// IJobActionHandler — interface every action type implements
// ---------------------------------------------------------------------------

type IJobActionHandler interface {
	Name() string
	Type() string
	Category() string
	Execute(ctx context.Context, params map[string]string) (*ActionResult, error)
	Validate(ctx context.Context, params map[string]string) error
}

// ActionResult — typed output returned by action handlers
type ActionResult struct {
	Success bool              `json:"success"`
	Output  string            `json:"output"`
	Data    map[string]any    `json:"data"`
	Error   string            `json:"error"`
}

// ---------------------------------------------------------------------------
// JobActionExecutor — dispatches named actions through the handler registry
// ---------------------------------------------------------------------------

type JobActionExecutor struct {
	handlers map[string]IJobActionHandler
	repo     *repository.Repository
	logger   *zap.Logger
	mu       sync.RWMutex
}

func NewJobActionExecutor(repo *repository.Repository, logger *zap.Logger) *JobActionExecutor {
	e := &JobActionExecutor{
		handlers: make(map[string]IJobActionHandler),
		repo:     repo,
		logger:   logger,
	}
	e.registerBuiltinHandlers()
	return e
}

// RegisterHandler adds (or overrides) a custom action handler.
func (e *JobActionExecutor) RegisterHandler(h IJobActionHandler) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.handlers[h.Type()] = h
	e.logger.Info("job-action handler registered",
		zap.String("type", h.Type()),
		zap.String("category", h.Category()),
	)
}

// ListActions queries the persisted action definitions.
func (e *JobActionExecutor) ListActions(ctx context.Context, tenantID, category string) ([]models.JobAction, error) {
	resp, err := e.repo.ListActions(ctx, tenantID, category, 100, 0)
	if err != nil {
		return nil, err
	}
	return resp.Data, nil
}

// GetAction retrieves a single action definition.
func (e *JobActionExecutor) GetAction(ctx context.Context, tenantID, actionID string) (*models.JobAction, error) {
	return e.repo.GetAction(ctx, tenantID, actionID)
}

// ExecuteAction dispatches an action to its handler and records the execution.
func (e *JobActionExecutor) ExecuteAction(ctx context.Context, tenantID string, actionName string, params map[string]string) (*models.JobActionExecution, error) {
	// Lookup action definition (resolve by name within tenant)
	actions, err := e.ListActions(ctx, tenantID, "")
	if err != nil {
		return nil, err
	}

	var action *models.JobAction
	for _, a := range actions {
		if a.Name == actionName {
			action = &a
			break
		}
	}
	if action == nil {
		// Fall back to direct type dispatch
		return e.executeByType(ctx, tenantID, actionName, params)
	}

	if !action.Enabled {
		return nil, ErrActionDisabled
	}

	// Build execution record
	ex := &models.JobActionExecution{
		TenantID:  tenantID,
		ActionID:  action.ID,
		Status:    models.StatusPending,
		StartedAt: time.Now().UTC(),
	}
	if err := e.repo.CreateExecution(ctx, ex); err != nil {
		return nil, err
	}

	// Look up handler by action type
	e.mu.RLock()
	handler, ok := e.handlers[action.Type]
	e.mu.RUnlock()
	if !ok {
		err = fmt.Errorf("%w: %s", ErrHandlerNotFound, action.Type)
		e.finalizeExecution(ctx, ex, models.StatusFailed, "", err.Error(), 0)
		return ex, err
	}

	start := time.Now()
	timeout := action.Timeout
	if timeout <= 0 {
		timeout = 300
	}
	retryCount := action.RetryCount

	// Optional timeout context
	ctx2 := ctx
	if timeout > 0 {
		var cancel context.CancelFunc
		ctx2, cancel = context.WithTimeout(ctx, time.Duration(timeout)*time.Second)
		defer cancel()
	}

	result, execErr := e.runWithRetries(ctx2, handler, params, retryCount)

	durationMs := time.Since(start).Milliseconds()
	if execErr != nil {
		e.finalizeExecution(ctx, ex, models.StatusFailed, "", execErr.Error(), durationMs)
		return ex, execErr
	}

	e.finalizeExecution(ctx, ex, models.StatusCompleted, result.Output, "", durationMs)
	return ex, nil
}

// executeByType allows calling an action directly by its type (e.g. "restart_service")
// without a persisted definition — useful for auto-exec dispatch.
func (e *JobActionExecutor) executeByType(ctx context.Context, tenantID string, actionType string, params map[string]string) (*models.JobActionExecution, error) {
	e.mu.RLock()
	handler, ok := e.handlers[actionType]
	e.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrHandlerNotFound, actionType)
	}

	ex := &models.JobActionExecution{
		TenantID:  tenantID,
		ActionID:  actionType, // use type as id for ad-hoc execution
		Status:    models.StatusPending,
		StartedAt: time.Now().UTC(),
	}
	if err := e.repo.CreateExecution(ctx, ex); err != nil {
		return nil, err
	}

	start := time.Now()
	ctx2, cancel := context.WithTimeout(ctx, 300*time.Second)
	defer cancel()

	result, execErr := e.runWithRetries(ctx2, handler, params, 0)
	durationMs := time.Since(start).Milliseconds()

	if execErr != nil {
		e.finalizeExecution(ctx, ex, models.StatusFailed, "", execErr.Error(), durationMs)
		return ex, execErr
	}

	e.finalizeExecution(ctx, ex, models.StatusCompleted, result.Output, "", durationMs)
	return ex, nil
}

// ---------------------------------------------------------------------------
// retry loop
// ---------------------------------------------------------------------------

func (e *JobActionExecutor) runWithRetries(ctx context.Context, h IJobActionHandler, params map[string]string, retries int) (*ActionResult, error) {
	maxAttempts := retries + 1
	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if ctx.Err() != nil {
			return nil, fmt.Errorf("context cancelled during execution: %w", ctx.Err())
		}
		if vErr := h.Validate(ctx, params); vErr != nil {
			return nil, vErr
		}
		result, err := h.Execute(ctx, params)
		if err == nil {
			return result, nil
		}
		lastErr = err
		e.logger.Warn("action handler attempt failed",
			zap.String("type", h.Type()),
			zap.Int("attempt", attempt),
			zap.Error(err),
		)
	}
	return nil, lastErr
}

// ---------------------------------------------------------------------------
// finalize
// ---------------------------------------------------------------------------

func (e *JobActionExecutor) finalizeExecution(ctx context.Context, ex *models.JobActionExecution, status, output, er string, durationMs int64) {
	now := time.Now().UTC()
	ex.Status = status
	ex.Output = output
	ex.Error = er
	ex.DurationMs = durationMs
	ex.FinishedAt = &now
	fields := map[string]any{
		"status":      status,
		"output":      output,
		"error":       er,
		"duration_ms": durationMs,
		"finished_at": &now,
	}
	if ferr := e.repo.UpdateExecution(ctx, ex.TenantID, ex.ID, fields); ferr != nil {
		e.logger.Error("failed to finalize job-action execution",
			zap.String("id", ex.ID),
			zap.Error(ferr),
		)
	}
	e.logger.Info("job-action execution finished",
		zap.String("id", ex.ID),
		zap.String("actionID", ex.ActionID),
		zap.String("status", status),
		zap.Int64("durationMs", durationMs),
	)
}

// ---------------------------------------------------------------------------
// Built-in handler registration
// ---------------------------------------------------------------------------

func (e *JobActionExecutor) registerBuiltinHandlers() {
	handlers := []IJobActionHandler{
		NewRestartServiceHandler(),
		NewDeployCodeHandler(),
		NewBackupDBHandler(),
		NewRestoreDBHandler(),
		NewScaleInstanceHandler(),
		NewSendEmailHandler(),
		NewSendSMSHandler(),
		NewSendWebhookHandler(),
		NewRunScriptHandler(),
		NewExecuteSQLHandler(),
		NewFileCopyHandler(),
		NewFileDeleteHandler(),
		NewGitPullHandler(),
		NewGitPushHandler(),
		NewDockerPullHandler(),
		NewDockerPushHandler(),
		NewDockerRestartHandler(),
		NewDockerComposeUpHandler(),
		NewDockerComposeDownHandler(),
		NewKubectlApplyHandler(),
		NewKubectlDeleteHandler(),
		NewCurlRequestHandler(),
		NewShellCommandHandler(),
		NewArchiveFileHandler(),
		NewExtractFileHandler(),
		NewCreateDirectoryHandler(),
		NewDeleteDirectoryHandler(),
		NewModifyFileHandler(),
		NewCreateUserHandler(),
		NewDeleteUserHandler(),
		NewGrantPermissionHandler(),
		NewRevokePermissionHandler(),
		NewRotateKeyHandler(),
		NewEnableFeatureHandler(),
		NewDisableFeatureHandler(),
		NewClearCacheHandler(),
		NewSendNotificationHandler(),
		NewCreateTicketHandler(),
		NewCloseTicketHandler(),
		NewUpdateTicketHandler(),
		NewRunHealthCheckHandler(),
		NewStopServiceHandler(),
		NewStartServiceHandler(),
		NewChangeConfigHandler(),
		NewSnapshotHandler(),
		NewRollbackHandler(),
	}
	e.mu.Lock()
	for _, h := range handlers {
		e.handlers[h.Type()] = h
	}
	e.mu.Unlock()
}

// ---------------------------------------------------------------------------
// stub helper
// ---------------------------------------------------------------------------

// stubHandler is a minimal implementation that logs and returns success.
type stubHandler struct {
	name     string
	typ      string
	category string
}

func (s *stubHandler) Name() string { return s.name }
func (s *stubHandler) Type() string { return s.typ }
func (s *stubHandler) Category() string { return s.category }
func (s *stubHandler) Validate(context.Context, map[string]string) error { return nil }
func (s *stubHandler) Execute(ctx context.Context, params map[string]string) (*ActionResult, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	paramsJSON, _ := json.Marshal(params)
	return &ActionResult{
		Success: true,
		Output:  fmt.Sprintf("[%s] executed", s.typ),
		Data:    map[string]any{"action": s.typ, "params": string(paramsJSON)},
	}, nil
}

// ---------------------------------------------------------------------------
// Concrete handler constructors — each 42 type
// ---------------------------------------------------------------------------

func NewRestartServiceHandler() IJobActionHandler {
	return &stubHandler{name: "RestartService", typ: models.TypeRestartService, category: models.CategoryDeployment}
}

func NewDeployCodeHandler() IJobActionHandler {
	return &stubHandler{name: "DeployCode", typ: models.TypeDeployCode, category: models.CategoryDeployment}
}

func NewBackupDBHandler() IJobActionHandler {
	return &stubHandler{name: "BackupDB", typ: models.TypeBackupDB, category: models.CategoryData}
}

func NewRestoreDBHandler() IJobActionHandler {
	return &stubHandler{name: "RestoreDB", typ: models.TypeRestoreDB, category: models.CategoryData}
}

func NewScaleInstanceHandler() IJobActionHandler {
	return &stubHandler{name: "ScaleInstance", typ: models.TypeScaleInstance, category: models.CategoryInfrastructure}
}

func NewSendEmailHandler() IJobActionHandler {
	return &stubHandler{name: "SendEmail", typ: models.TypeSendEmail, category: models.CategoryNotification}
}

func NewSendSMSHandler() IJobActionHandler {
	return &stubHandler{name: "SendSMS", typ: models.TypeSendSMS, category: models.CategoryNotification}
}

func NewSendWebhookHandler() IJobActionHandler {
	return &stubHandler{name: "SendWebhook", typ: models.TypeSendWebhook, category: models.CategoryNotification}
}

func NewRunScriptHandler() IJobActionHandler {
	return &stubHandler{name: "RunScript", typ: models.TypeRunScript, category: models.CategoryInfrastructure}
}

func NewExecuteSQLHandler() IJobActionHandler {
	return &stubHandler{name: "ExecuteSQL", typ: models.TypeExecuteSQL, category: models.CategoryData}
}

func NewFileCopyHandler() IJobActionHandler {
	return &stubHandler{name: "FileCopy", typ: models.TypeFileCopy, category: models.CategoryInfrastructure}
}

func NewFileDeleteHandler() IJobActionHandler {
	return &stubHandler{name: "FileDelete", typ: models.TypeFileDelete, category: models.CategoryInfrastructure}
}

func NewGitPullHandler() IJobActionHandler {
	return &stubHandler{name: "GitPull", typ: models.TypeGitPull, category: models.CategoryDeployment}
}

func NewGitPushHandler() IJobActionHandler {
	return &stubHandler{name: "GitPush", typ: models.TypeGitPush, category: models.CategoryDeployment}
}

func NewDockerPullHandler() IJobActionHandler {
	return &stubHandler{name: "DockerPull", typ: models.TypeDockerPull, category: models.CategoryDeployment}
}

func NewDockerPushHandler() IJobActionHandler {
	return &stubHandler{name: "DockerPush", typ: models.TypeDockerPush, category: models.CategoryDeployment}
}

func NewDockerRestartHandler() IJobActionHandler {
	return &stubHandler{name: "DockerRestart", typ: models.TypeDockerRestart, category: models.CategoryInfrastructure}
}

func NewDockerComposeUpHandler() IJobActionHandler {
	return &stubHandler{name: "DockerComposeUp", typ: models.TypeDockerComposeUp, category: models.CategoryInfrastructure}
}

func NewDockerComposeDownHandler() IJobActionHandler {
	return &stubHandler{name: "DockerComposeDown", typ: models.TypeDockerComposeDown, category: models.CategoryInfrastructure}
}

func NewKubectlApplyHandler() IJobActionHandler {
	return &stubHandler{name: "KubectlApply", typ: models.TypeKubectlApply, category: models.CategoryInfrastructure}
}

func NewKubectlDeleteHandler() IJobActionHandler {
	return &stubHandler{name: "KubectlDelete", typ: models.TypeKubectlDelete, category: models.CategoryInfrastructure}
}

func NewCurlRequestHandler() IJobActionHandler {
	return &stubHandler{name: "CurlRequest", typ: models.TypeCurlRequest, category: models.CategoryInfrastructure}
}

func NewShellCommandHandler() IJobActionHandler {
	return &stubHandler{name: "ShellCommand", typ: models.TypeShellCommand, category: models.CategoryInfrastructure}
}

func NewArchiveFileHandler() IJobActionHandler {
	return &stubHandler{name: "ArchiveFile", typ: models.TypeArchiveFile, category: models.CategoryData}
}

func NewExtractFileHandler() IJobActionHandler {
	return &stubHandler{name: "ExtractFile", typ: models.TypeExtractFile, category: models.CategoryData}
}

func NewCreateDirectoryHandler() IJobActionHandler {
	return &stubHandler{name: "CreateDirectory", typ: models.TypeCreateDirectory, category: models.CategoryInfrastructure}
}

func NewDeleteDirectoryHandler() IJobActionHandler {
	return &stubHandler{name: "DeleteDirectory", typ: models.TypeDeleteDirectory, category: models.CategoryInfrastructure}
}

func NewModifyFileHandler() IJobActionHandler {
	return &stubHandler{name: "ModifyFile", typ: models.TypeModifyFile, category: models.CategoryData}
}

func NewCreateUserHandler() IJobActionHandler {
	return &stubHandler{name: "CreateUser", typ: models.TypeCreateUser, category: models.CategoryAdmin}
}

func NewDeleteUserHandler() IJobActionHandler {
	return &stubHandler{name: "DeleteUser", typ: models.TypeDeleteUser, category: models.CategoryAdmin}
}

func NewGrantPermissionHandler() IJobActionHandler {
	return &stubHandler{name: "GrantPermission", typ: models.TypeGrantPermission, category: models.CategoryAdmin}
}

func NewRevokePermissionHandler() IJobActionHandler {
	return &stubHandler{name: "RevokePermission", typ: models.TypeRevokePermission, category: models.CategoryAdmin}
}

func NewRotateKeyHandler() IJobActionHandler {
	return &stubHandler{name: "RotateKey", typ: models.TypeRotateKey, category: models.CategoryAdmin}
}

func NewEnableFeatureHandler() IJobActionHandler {
	return &stubHandler{name: "EnableFeature", typ: models.TypeEnableFeature, category: models.CategoryAdmin}
}

func NewDisableFeatureHandler() IJobActionHandler {
	return &stubHandler{name: "DisableFeature", typ: models.TypeDisableFeature, category: models.CategoryAdmin}
}

func NewClearCacheHandler() IJobActionHandler {
	return &stubHandler{name: "ClearCache", typ: models.TypeClearCache, category: models.CategoryInfrastructure}
}

func NewSendNotificationHandler() IJobActionHandler {
	return &stubHandler{name: "SendNotification", typ: models.TypeSendNotification, category: models.CategoryNotification}
}

func NewCreateTicketHandler() IJobActionHandler {
	return &stubHandler{name: "CreateTicket", typ: models.TypeCreateTicket, category: models.CategoryAdmin}
}

func NewCloseTicketHandler() IJobActionHandler {
	return &stubHandler{name: "CloseTicket", typ: models.TypeCloseTicket, category: models.CategoryAdmin}
}

func NewUpdateTicketHandler() IJobActionHandler {
	return &stubHandler{name: "UpdateTicket", typ: models.TypeUpdateTicket, category: models.CategoryAdmin}
}

func NewRunHealthCheckHandler() IJobActionHandler {
	return &stubHandler{name: "RunHealthCheck", typ: models.TypeRunHealthCheck, category: models.CategoryMonitoring}
}

func NewStopServiceHandler() IJobActionHandler {
	return &stubHandler{name: "StopService", typ: models.TypeStopService, category: models.CategoryDeployment}
}

func NewStartServiceHandler() IJobActionHandler {
	return &stubHandler{name: "StartService", typ: models.TypeStartService, category: models.CategoryDeployment}
}

func NewChangeConfigHandler() IJobActionHandler {
	return &stubHandler{name: "ChangeConfig", typ: models.TypeChangeConfig, category: models.CategoryAdmin}
}

func NewSnapshotHandler() IJobActionHandler {
	return &stubHandler{name: "Snapshot", typ: models.TypeSnapshot, category: models.CategoryData}
}

func NewRollbackHandler() IJobActionHandler {
	return &stubHandler{name: "Rollback", typ: models.TypeRollback, category: models.CategoryDeployment}
}
