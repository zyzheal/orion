package repository

import (
	"context"
	"orion/platform-svc-go/internal/developer-portal/models"
)


// RepositoryInterface defines the data access contract for the developer-portal module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.DeveloperPortal) error
	GetByID(ctx context.Context, tenantID, id string) (*models.DeveloperPortal, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.DeveloperPortal, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]any) error
	Delete(ctx context.Context, tenantID, id string) error
	CreateDocument(ctx context.Context, doc *models.PortalDocument) error
	GetDocumentByID(ctx context.Context, tenantID, id string) (*models.PortalDocument, error)
	ListDocuments(ctx context.Context, tenantID string, page, pageSize int) ([]models.PortalDocument, error)
	SearchDocuments(ctx context.Context, tenantID, query string) ([]models.PortalDocument, error)
	UpdateDocument(ctx context.Context, tenantID string, doc *models.PortalDocument) error
	DeleteDocument(ctx context.Context, tenantID, id string) error
	IncrementViews(ctx context.Context, tenantID, id string) error
	CreateDocumentVersion(ctx context.Context, v *models.DocumentVersion) error
	GetDocumentVersions(ctx context.Context, tenantID, documentID string) ([]models.DocumentVersion, error)
	GetDocumentStats(ctx context.Context, tenantID string) (*models.DocumentStats, error)
	GetCategories(ctx context.Context, tenantID string) ([]models.CategoryInfo, error)
	GetPopularDocuments(ctx context.Context, tenantID string) ([]models.PortalDocument, error)
	RecordHelpful(ctx context.Context, tenantID, id string, helpful bool) (*models.PortalDocument, error)
	CreateMockRule(ctx context.Context, rule *models.MockRule) error
	GetMockRuleByID(ctx context.Context, tenantID, id string) (*models.MockRule, error)
	ListMockRules(ctx context.Context, tenantID string, filter models.MockRuleFilter) ([]models.MockRule, int, error)
	GetMockRuleStats(ctx context.Context, tenantID string) (*models.MockRuleStats, error)
	UpdateMockRule(ctx context.Context, tenantID string, rule *models.MockRule) error
	DeleteMockRule(ctx context.Context, tenantID, id string) error
	CreateSDKTask(ctx context.Context, task *models.SDKTask) error
	GetSDKTaskByID(ctx context.Context, tenantID, id string) (*models.SDKTask, error)
	ListSDKTasks(ctx context.Context, tenantID string, filter models.SDKTaskFilter) ([]models.SDKTask, int, error)
	GetSDKTaskStats(ctx context.Context, tenantID string) (*models.SDKTaskStats, error)
	UpdateSDKTask(ctx context.Context, tenantID string, task *models.SDKTask) error
	DeleteSDKTask(ctx context.Context, tenantID, id string) error
	CreateSubscription(ctx context.Context, sub *models.Subscription) error
	GetSubscriptionByID(ctx context.Context, tenantID, id string) (*models.Subscription, error)
	GetSubscriptionByUserAndAPI(ctx context.Context, tenantID, userID, apiName string) (*models.Subscription, error)
	ListSubscriptions(ctx context.Context, tenantID string, filter models.SubscriptionFilter) ([]models.Subscription, int, error)
	GetSubscriptionStats(ctx context.Context, tenantID string) (*models.SubscriptionStats, error)
	UpdateSubscription(ctx context.Context, tenantID string, sub *models.Subscription) error
	GetUsageRecords(ctx context.Context, tenantID, subscriptionID string, filter models.UsageRecordFilter) ([]models.UsageRecord, int, error)
	CreatePlaygroundRequest(ctx context.Context, preq *models.PlaygroundRequest) error
	GetPlaygroundRequestByID(ctx context.Context, tenantID, id string) (*models.PlaygroundRequest, error)
	ListPlaygroundRequests(ctx context.Context, tenantID, userID string, filter models.PlaygroundRequestFilter) ([]models.PlaygroundRequest, int, error)
	GetPlaygroundStats(ctx context.Context, tenantID, userID string) (*models.PlaygroundStats, error)
	UpdatePlaygroundRequest(ctx context.Context, tenantID string, preq *models.PlaygroundRequest) error
	DeletePlaygroundRequest(ctx context.Context, tenantID, id string) error
	GetResponseHistory(ctx context.Context, tenantID, requestID string, filter models.UsageRecordFilter) ([]models.ResponseHistoryEntry, int, error)
	ClearHistory(ctx context.Context, tenantID, requestID string) error
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
