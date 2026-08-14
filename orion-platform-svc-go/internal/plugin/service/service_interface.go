package service

import (
	"context"

	"orion/platform-svc-go/internal/plugin/models"
)

// ServiceInterface abstracts every method the handler calls on *Service,
// allowing fake implementations to be injected into unit tests.
type ServiceInterface interface {
	// CRUD
	Create(ctx context.Context, tenantID string, req *models.CreatePluginRequest) (*models.Plugin, error)
	List(ctx context.Context, tenantID string, offset, limit int) ([]models.Plugin, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Plugin, error)
	Delete(ctx context.Context, tenantID, id string) error
	Count(ctx context.Context, tenantID string) (int, error)
	Update(ctx context.Context, tenantID, id string, req *models.UpdatePluginRequest) (*models.Plugin, error)

	// Management
	Install(ctx context.Context, tenantID, pluginID, version string, config models.JSONB) (*models.Plugin, error)
	Enable(ctx context.Context, tenantID, id string) (*models.Plugin, error)
	Disable(ctx context.Context, tenantID, id string) (*models.Plugin, error)

	// Audit
	ListAuditEntries(ctx context.Context, tenantID, pluginID string, limit int) ([]models.AuditEntry, error)
	AuditTrail(ctx context.Context, taskID string, limit int) ([]models.AuditEntry, error)

	// Executions
	GetExecutionByTaskID(ctx context.Context, tenantID, taskID string) (*models.PluginExecution, error)

	// Debug
	GetDebugState(runID string) *DebugState
	Pause(ctx context.Context, tenantID, runID string) *DebugState
	Resume(ctx context.Context, tenantID, runID string)
	Step(ctx context.Context, tenantID, runID string) *DebugState

	// AI Diagnosis
	Diagnose(ctx context.Context, tenantID string, req *DiagnoseRequest) (*DiagnoseResult, error)

	// Quotas
	UpsertPluginQuota(ctx context.Context, pluginID string, q *models.ResourceQuota) error
	GetPluginQuota(ctx context.Context, pluginID string) (*models.PluginResourceQuota, error)
	DeletePluginQuota(ctx context.Context, pluginID string) error

	// Security
	CreateSecurityEvent(ctx context.Context, e *models.SecurityEvent) error
	ListSecurityEvents(ctx context.Context, f *models.SecurityEventFilter) ([]models.SecurityEvent, error)
}

// Ensure *Service implements ServiceInterface at compile time.
var _ ServiceInterface = (*Service)(nil)
