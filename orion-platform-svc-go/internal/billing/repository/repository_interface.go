package repository

import (
	"context"
	"orion/platform-svc-go/internal/billing/models"
)


// RepositoryInterface defines the data access contract for the billing module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateAccount(ctx context.Context, account *models.Account) error
	GetAccountByID(ctx context.Context, tenantID, id string) (*models.Account, error)
	ListAccounts(ctx context.Context, tenantID string, status *string) ([]models.Account, error)
	UpdateAccount(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Account, error)
	DeleteAccount(ctx context.Context, tenantID, id string) (bool, error)
	CreateInvoice(ctx context.Context, invoice *models.Invoice) error
	GetInvoiceByID(ctx context.Context, tenantID, id string) (*models.Invoice, error)
	ListInvoices(ctx context.Context, tenantID string, filter *models.InvoiceFilter) ([]models.Invoice, int, error)
	UpdateInvoice(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Invoice, error)
	DeleteInvoice(ctx context.Context, tenantID, id string) (bool, error)
	CreateLineItem(ctx context.Context, item *models.LineItem) error
	ListLineItemsByInvoice(ctx context.Context, tenantID, invoiceID string) ([]models.LineItem, error)
	CreateSubscription(ctx context.Context, sub *models.Subscription) error
	GetSubscriptionByID(ctx context.Context, tenantID, id string) (*models.Subscription, error)
	ListSubscriptions(ctx context.Context, tenantID string, status *string) ([]models.Subscription, error)
	UpdateSubscription(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Subscription, error)
	DeleteSubscription(ctx context.Context, tenantID, id string) (bool, error)
	GetBillingStats(ctx context.Context, tenantID string) (*models.BillingStats, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
