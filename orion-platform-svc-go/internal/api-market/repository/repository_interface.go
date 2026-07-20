package repository

import (
	"context"
	"orion/platform-svc-go/internal/api-market/models"
)


// RepositoryInterface defines the data access contract for the api-market module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateProduct(ctx context.Context, product *models.Product) error
	GetProductByID(ctx context.Context, id string, tenantID string) (*models.Product, error)
	ListProducts(ctx context.Context, tenantID string) ([]models.Product, error)
	UpdateProductStatus(ctx context.Context, id string, tenantID string, status string) (*models.Product, error)
	DeleteProduct(ctx context.Context, id string, tenantID string) (bool, error)
	CreateDeveloperApp(ctx context.Context, app *models.DeveloperApp) error
	GetAppByID(ctx context.Context, id string, tenantID string) (*models.DeveloperApp, error)
	ListAppsByDeveloper(ctx context.Context, tenantID string, developerID string) ([]models.DeveloperApp, error)
	CreateAPIKey(ctx context.Context, key *models.APIKey) error
	ListAPIKeysByApp(ctx context.Context, appID string, tenantID string) ([]models.APIKey, error)
	GetAPIKeyByCredentials(ctx context.Context, tenantID string, clientID string, keyHash string) (*models.APIKey, error)
	CreateSubscription(ctx context.Context, sub *models.Subscription) error
	GetSubscription(ctx context.Context, appID string, productID string, tenantID string) (*models.Subscription, error)
	ListSubscriptionsByApp(ctx context.Context, appID string, tenantID string) ([]models.Subscription, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
