// Package service provides the JobActionExecutor and the 46 built-in action handlers.
//
// None of the 46 has a working backend: see unimplementedHandler below. The
// registration is real, the capability is not, and ExecuteAction records
// the difference in job_action_executions instead of claiming success.
package service

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/job-actions/models"
	"orion/platform-svc-go/internal/job-actions/repository"
)

var (
	ErrActionNotFound  = errors.New("action not found")
	ErrHandlerNotFound = errors.New("action handler not registered")
	ErrActionDisabled  = errors.New("action is disabled")
	// ErrActionNotImplemented means the action type is in the registry but no
	// backend can carry it out. It is a permanent condition: retrying it cannot
	// succeed, so runWithRetries stops at the first attempt instead of burning
	// RetryCount+1 attempts and RetryCount+1 warning lines on it.
	ErrActionNotImplemented = errors.New("action not implemented")
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
	Success bool           `json:"success"`
	Output  string         `json:"output"`
	Data    map[string]any `json:"data"`
	Error   string         `json:"error"`
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

// NewJobActionExecutor wires the registry and the audit repository. A nil
// logger is tolerated so a test or an embedder can pass a real repository only.
func NewJobActionExecutor(repo *repository.Repository, logger *zap.Logger) *JobActionExecutor {
	if logger == nil {
		logger = zap.NewNop()
	}
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

	// One clock origin for the audit row and the duration counter, so
	// duration_ms is measured from the instant the database claims the run
	// started.
	start := time.Now().UTC()
	ex := &models.JobActionExecution{
		TenantID:  tenantID,
		ActionID:  action.ID,
		Status:    models.StatusPending,
		StartedAt: start,
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

	// Work genuinely begins here, so this is the moment the row leaves 'pending'.
	// Recording 'running' is what makes a crash mid-execution distinguishable
	// from a request that never started.
	e.markRunning(ctx, ex, start)

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

	start := time.Now().UTC()
	ex := &models.JobActionExecution{
		TenantID:  tenantID,
		ActionID:  actionType, // use type as id for ad-hoc execution
		Status:    models.StatusPending,
		StartedAt: start,
	}
	if err := e.repo.CreateExecution(ctx, ex); err != nil {
		return nil, err
	}

	ctx2, cancel := context.WithTimeout(ctx, 300*time.Second)
	defer cancel()

	e.markRunning(ctx, ex, start)

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
		if errors.Is(err, ErrActionNotImplemented) {
			return nil, err
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

// markRunning moves a recorded execution out of 'pending' at the moment its
// handler actually starts. started_at is written too, so the row carries the
// same instant the executor used as its duration origin.
func (e *JobActionExecutor) markRunning(ctx context.Context, ex *models.JobActionExecution, startedAt time.Time) {
	ex.Status = models.StatusRunning
	e.errIf(e.repo.UpdateExecution(ctx, ex.TenantID, ex.ID, map[string]any{
		"status":     models.StatusRunning,
		"started_at": startedAt,
	}))
}

// errIf centralises the "log and move on" behaviour of the finalize path. The
// audit write must not fail the caller: the execution already happened.
func (e *JobActionExecutor) errIf(err error) {
	if err == nil {
		return
	}
	e.logger.Error("failed to update job-action execution", zap.Error(err))
}

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
	e.errIf(e.repo.UpdateExecution(ctx, ex.TenantID, ex.ID, fields))
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
// Unimplemented action backends
// ---------------------------------------------------------------------------

// unimplementedHandler is the backend for every built-in action type.
//
// It exists because the registry has to advertise the 46 declared types so a
// persisted definition can be created for each of them, while this repository
// owns no SSH client, Kubernetes client, database driver, message broker or
// object store that could actually carry any of them out. Executing
// 'kubectl_apply' or 'shell_command' from an HTTP endpoint would also be a
// security decision, not a stub fix, so it is deliberately not made here.
//
// The previous implementation was a stubHandler whose Execute returned
// Success: true, Output "[<type>] executed" and a ~0 ms duration. ExecuteAction
// then called finalizeExecution with models.StatusCompleted, so the audit table
// asserted a completed deployment for work that never happened at all -- a
// pipeline that read the row back would have skipped its real restart step.
//
// Now the request still flows through timeout, retry and audit recording, but
// it ends status='failed' with ErrActionNotImplemented in the error column.
// "This platform cannot run this action" is a real, queryable result.
type unimplementedHandler struct {
	name     string
	typ      string
	category string
}

func (s *unimplementedHandler) Name() string { return s.name }

func (s *unimplementedHandler) Type() string { return s.typ }

func (s *unimplementedHandler) Category() string { return s.category }

func (s *unimplementedHandler) Validate(context.Context, map[string]string) error { return nil }

func (s *unimplementedHandler) Execute(context.Context, map[string]string) (*ActionResult, error) {
	return nil, fmt.Errorf("%w: %s", ErrActionNotImplemented, s.typ)
}

// ---------------------------------------------------------------------------
// Concrete handler constructors — one per declared type
// ---------------------------------------------------------------------------

func NewRestartServiceHandler() IJobActionHandler {
	return &unimplementedHandler{name: "RestartService", typ: models.TypeRestartService, category: models.CategoryDeployment}
}

func NewDeployCodeHandler() IJobActionHandler {
	return &unimplementedHandler{name: "DeployCode", typ: models.TypeDeployCode, category: models.CategoryDeployment}
}

func NewBackupDBHandler() IJobActionHandler {
	return &unimplementedHandler{name: "BackupDB", typ: models.TypeBackupDB, category: models.CategoryData}
}

func NewRestoreDBHandler() IJobActionHandler {
	return &unimplementedHandler{name: "RestoreDB", typ: models.TypeRestoreDB, category: models.CategoryData}
}

func NewScaleInstanceHandler() IJobActionHandler {
	return &unimplementedHandler{name: "ScaleInstance", typ: models.TypeScaleInstance, category: models.CategoryInfrastructure}
}

func NewSendEmailHandler() IJobActionHandler {
	return &unimplementedHandler{name: "SendEmail", typ: models.TypeSendEmail, category: models.CategoryNotification}
}

func NewSendSMSHandler() IJobActionHandler {
	return &unimplementedHandler{name: "SendSMS", typ: models.TypeSendSMS, category: models.CategoryNotification}
}

func NewSendWebhookHandler() IJobActionHandler {
	return &unimplementedHandler{name: "SendWebhook", typ: models.TypeSendWebhook, category: models.CategoryNotification}
}

func NewRunScriptHandler() IJobActionHandler {
	return &unimplementedHandler{name: "RunScript", typ: models.TypeRunScript, category: models.CategoryInfrastructure}
}

func NewExecuteSQLHandler() IJobActionHandler {
	return &unimplementedHandler{name: "ExecuteSQL", typ: models.TypeExecuteSQL, category: models.CategoryData}
}

func NewFileCopyHandler() IJobActionHandler {
	return &unimplementedHandler{name: "FileCopy", typ: models.TypeFileCopy, category: models.CategoryInfrastructure}
}

func NewFileDeleteHandler() IJobActionHandler {
	return &unimplementedHandler{name: "FileDelete", typ: models.TypeFileDelete, category: models.CategoryInfrastructure}
}

func NewGitPullHandler() IJobActionHandler {
	return &unimplementedHandler{name: "GitPull", typ: models.TypeGitPull, category: models.CategoryDeployment}
}

func NewGitPushHandler() IJobActionHandler {
	return &unimplementedHandler{name: "GitPush", typ: models.TypeGitPush, category: models.CategoryDeployment}
}

func NewDockerPullHandler() IJobActionHandler {
	return &unimplementedHandler{name: "DockerPull", typ: models.TypeDockerPull, category: models.CategoryDeployment}
}

func NewDockerPushHandler() IJobActionHandler {
	return &unimplementedHandler{name: "DockerPush", typ: models.TypeDockerPush, category: models.CategoryDeployment}
}

func NewDockerRestartHandler() IJobActionHandler {
	return &unimplementedHandler{name: "DockerRestart", typ: models.TypeDockerRestart, category: models.CategoryInfrastructure}
}

func NewDockerComposeUpHandler() IJobActionHandler {
	return &unimplementedHandler{name: "DockerComposeUp", typ: models.TypeDockerComposeUp, category: models.CategoryInfrastructure}
}

func NewDockerComposeDownHandler() IJobActionHandler {
	return &unimplementedHandler{name: "DockerComposeDown", typ: models.TypeDockerComposeDown, category: models.CategoryInfrastructure}
}

func NewKubectlApplyHandler() IJobActionHandler {
	return &unimplementedHandler{name: "KubectlApply", typ: models.TypeKubectlApply, category: models.CategoryInfrastructure}
}

func NewKubectlDeleteHandler() IJobActionHandler {
	return &unimplementedHandler{name: "KubectlDelete", typ: models.TypeKubectlDelete, category: models.CategoryInfrastructure}
}

func NewCurlRequestHandler() IJobActionHandler {
	return &unimplementedHandler{name: "CurlRequest", typ: models.TypeCurlRequest, category: models.CategoryInfrastructure}
}

func NewShellCommandHandler() IJobActionHandler {
	return &unimplementedHandler{name: "ShellCommand", typ: models.TypeShellCommand, category: models.CategoryInfrastructure}
}

func NewArchiveFileHandler() IJobActionHandler {
	return &unimplementedHandler{name: "ArchiveFile", typ: models.TypeArchiveFile, category: models.CategoryData}
}

func NewExtractFileHandler() IJobActionHandler {
	return &unimplementedHandler{name: "ExtractFile", typ: models.TypeExtractFile, category: models.CategoryData}
}

func NewCreateDirectoryHandler() IJobActionHandler {
	return &unimplementedHandler{name: "CreateDirectory", typ: models.TypeCreateDirectory, category: models.CategoryInfrastructure}
}

func NewDeleteDirectoryHandler() IJobActionHandler {
	return &unimplementedHandler{name: "DeleteDirectory", typ: models.TypeDeleteDirectory, category: models.CategoryInfrastructure}
}

func NewModifyFileHandler() IJobActionHandler {
	return &unimplementedHandler{name: "ModifyFile", typ: models.TypeModifyFile, category: models.CategoryData}
}

func NewCreateUserHandler() IJobActionHandler {
	return &unimplementedHandler{name: "CreateUser", typ: models.TypeCreateUser, category: models.CategoryAdmin}
}

func NewDeleteUserHandler() IJobActionHandler {
	return &unimplementedHandler{name: "DeleteUser", typ: models.TypeDeleteUser, category: models.CategoryAdmin}
}

func NewGrantPermissionHandler() IJobActionHandler {
	return &unimplementedHandler{name: "GrantPermission", typ: models.TypeGrantPermission, category: models.CategoryAdmin}
}

func NewRevokePermissionHandler() IJobActionHandler {
	return &unimplementedHandler{name: "RevokePermission", typ: models.TypeRevokePermission, category: models.CategoryAdmin}
}

func NewRotateKeyHandler() IJobActionHandler {
	return &unimplementedHandler{name: "RotateKey", typ: models.TypeRotateKey, category: models.CategoryAdmin}
}

func NewEnableFeatureHandler() IJobActionHandler {
	return &unimplementedHandler{name: "EnableFeature", typ: models.TypeEnableFeature, category: models.CategoryAdmin}
}

func NewDisableFeatureHandler() IJobActionHandler {
	return &unimplementedHandler{name: "DisableFeature", typ: models.TypeDisableFeature, category: models.CategoryAdmin}
}

func NewClearCacheHandler() IJobActionHandler {
	return &unimplementedHandler{name: "ClearCache", typ: models.TypeClearCache, category: models.CategoryInfrastructure}
}

func NewSendNotificationHandler() IJobActionHandler {
	return &unimplementedHandler{name: "SendNotification", typ: models.TypeSendNotification, category: models.CategoryNotification}
}

func NewCreateTicketHandler() IJobActionHandler {
	return &unimplementedHandler{name: "CreateTicket", typ: models.TypeCreateTicket, category: models.CategoryAdmin}
}

func NewCloseTicketHandler() IJobActionHandler {
	return &unimplementedHandler{name: "CloseTicket", typ: models.TypeCloseTicket, category: models.CategoryAdmin}
}

func NewUpdateTicketHandler() IJobActionHandler {
	return &unimplementedHandler{name: "UpdateTicket", typ: models.TypeUpdateTicket, category: models.CategoryAdmin}
}

func NewRunHealthCheckHandler() IJobActionHandler {
	return &unimplementedHandler{name: "RunHealthCheck", typ: models.TypeRunHealthCheck, category: models.CategoryMonitoring}
}

func NewStopServiceHandler() IJobActionHandler {
	return &unimplementedHandler{name: "StopService", typ: models.TypeStopService, category: models.CategoryDeployment}
}

func NewStartServiceHandler() IJobActionHandler {
	return &unimplementedHandler{name: "StartService", typ: models.TypeStartService, category: models.CategoryDeployment}
}

func NewChangeConfigHandler() IJobActionHandler {
	return &unimplementedHandler{name: "ChangeConfig", typ: models.TypeChangeConfig, category: models.CategoryAdmin}
}

func NewSnapshotHandler() IJobActionHandler {
	return &unimplementedHandler{name: "Snapshot", typ: models.TypeSnapshot, category: models.CategoryData}
}

func NewRollbackHandler() IJobActionHandler {
	return &unimplementedHandler{name: "Rollback", typ: models.TypeRollback, category: models.CategoryDeployment}
}
