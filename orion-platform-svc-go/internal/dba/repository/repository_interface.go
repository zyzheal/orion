package repository

import (
	"context"
	"orion/platform-svc-go/internal/dba/models"
)


// RepositoryInterface defines the data access contract for the dba module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateOrder(ctx context.Context, o *models.SqlOrder) error
	GetOrder(ctx context.Context, id string) (*models.SqlOrder, error)
	ListOrders(ctx context.Context, tenantID, status string, page, limit int) ([]models.SqlOrder, int, error)
	UpdateOrderStatus(ctx context.Context, id, status string, approvedBy *string, result *string) (*models.SqlOrder, error)
	CreateDataSource(ctx context.Context, ds *models.DataSource) error
	GetDataSource(ctx context.Context, id string) (*models.DataSource, error)
	ListDataSources(ctx context.Context, tenantID string) ([]models.DataSource, error)
	UpdateDataSource(ctx context.Context, id string, updates map[string]interface{}) (*models.DataSource, error)
	DeleteDataSource(ctx context.Context, id string) error
	UpdateDataSourceStatus(ctx context.Context, id, status string) error
	CreateAuditRule(ctx context.Context, rule *models.AuditRule) error
	GetAuditRule(ctx context.Context, id string) (*models.AuditRule, error)
	ListAuditRules(ctx context.Context, tenantID string) ([]models.AuditRule, error)
	UpdateAuditRule(ctx context.Context, id string, updates map[string]interface{}) (*models.AuditRule, error)
	InsertQueryExecutionLog(ctx context.Context, rec *models.QueryExecutionRecord) error
	ListQueryLogs(ctx context.Context, tenantID string, q models.QueryLogQuery) ([]models.QueryExecutionRecord, int, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
