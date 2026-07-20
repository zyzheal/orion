package repository

import (
	"context"
	"orion/platform-svc-go/internal/data-quality/models"
)


// RepositoryInterface defines the data access contract for the data-quality module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateRule(ctx context.Context, rule *models.Rule) error
	GetRuleByID(ctx context.Context, tenantID, id string) (*models.Rule, error)
	ListRules(ctx context.Context, tenantID string, filter *models.RuleFilter) ([]models.Rule, error)
	UpdateRule(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Rule, error)
	DeleteRule(ctx context.Context, tenantID, id string) (bool, error)
	CreateScanResult(ctx context.Context, result *models.ScanResult) error
	ListScanResults(ctx context.Context, tenantID, ruleID string, status *string) ([]models.ScanResult, error)
	CreateAlert(ctx context.Context, alert *models.Alert) error
	GetAlertByID(ctx context.Context, tenantID, id string) (*models.Alert, error)
	ListAlerts(ctx context.Context, tenantID string, status *string) ([]models.Alert, error)
	UpdateAlert(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Alert, error)
	DeleteAlert(ctx context.Context, tenantID, id string) (bool, error)
	GetStats(ctx context.Context, tenantID string) (*models.QualityStats, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
