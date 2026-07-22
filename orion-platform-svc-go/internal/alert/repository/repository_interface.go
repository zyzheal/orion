package repository

import (
	"time"
	"context"
	"orion/platform-svc-go/internal/alert/models"
)


// RepositoryInterface defines the data access contract for the alert module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateAlert(ctx context.Context, a *models.Alert) error
	GetAlertByID(ctx context.Context, tenantID, id string) (*models.Alert, error)
	DeleteAlert(ctx context.Context, tenantID, id string) error
	UpdateAlert(ctx context.Context, a *models.Alert) error
	ListAlerts(ctx context.Context, tenantID string, severity, status string, limit int) ([]models.Alert, int, error)
	GetActiveGroups(ctx context.Context, tenantID string) ([]models.AlertGroup, error)
	ListByGroup(ctx context.Context, tenantID, groupID string) ([]models.Alert, int, error)
	GetStats(ctx context.Context, tenantID string) (*models.DedupStats, error)
	GetTopology(ctx context.Context, tenantID string) (*models.Topology, error)
	SetTopology(ctx context.Context, tenantID string, nodes, edges any) (*models.Topology, error)
	UpdateNodeHealth(ctx context.Context, tenantID string, node models.NodeHealth) error
	GetNodeHealth(ctx context.Context, tenantID string) ([]models.NodeHealth, error)
	AddMaintenanceWindow(ctx context.Context, mw *models.MaintenanceWindow) error
	GetActiveMaintenanceWindows(ctx context.Context, tenantID string) ([]models.MaintenanceWindow, error)
	ExpireMaintenanceWindows(ctx context.Context, tenantID string) error
	IsWithinWindow(ctx context.Context, tenantID string, name string, at time.Time) (bool, error)
	AddKnownIssue(ctx context.Context, ki *models.KnownIssue) error
	GetOpenKnownIssues(ctx context.Context, tenantID string) ([]models.KnownIssue, error)
	GetKnownIssueByPattern(ctx context.Context, tenantID, pattern string) (*models.KnownIssue, error)
	GetSuppressionStats(ctx context.Context, tenantID string) (*models.SuppressionStats, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
