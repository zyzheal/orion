package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"strings"
	"time"

	"orion/platform-svc-go/internal/billing/models"
	"orion/platform-svc-go/internal/billing/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateAccount(ctx context.Context, account *models.Account) error
	CreateInvoice(ctx context.Context, invoice *models.Invoice) error
	CreateLineItem(ctx context.Context, item *models.LineItem) error
	CreateSubscription(ctx context.Context, sub *models.Subscription) error
	DeleteAccount(ctx context.Context, tenantID, id string) (bool, error)
	DeleteInvoice(ctx context.Context, tenantID, id string) (bool, error)
	DeleteSubscription(ctx context.Context, tenantID, id string) (bool, error)
	GetAccountByID(ctx context.Context, tenantID, id string) (*models.Account, error)
	GetBillingStats(ctx context.Context, tenantID string) (*models.BillingStats, error)
	GetInvoiceByID(ctx context.Context, tenantID, id string) (*models.Invoice, error)
	GetSubscriptionByID(ctx context.Context, tenantID, id string) (*models.Subscription, error)
	ListAccounts(ctx context.Context, tenantID string, status *string) ([]models.Account, error)
	ListInvoices(ctx context.Context, tenantID string, filter *models.InvoiceFilter) ([]models.Invoice, int, error)
	ListLineItemsByInvoice(ctx context.Context, tenantID, invoiceID string) ([]models.LineItem, error)
	ListSubscriptions(ctx context.Context, tenantID string, status *string) ([]models.Subscription, error)
	UpdateAccount(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Account, error)
	UpdateInvoice(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Invoice, error)
	UpdateSubscription(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Subscription, error)
}

var (

	ErrBadRequest = errors.New("bad request")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound) || errors.Is(err, sentinel.NotFound)
}

func IsBadRequest(err error) bool {
	return errors.Is(err, ErrBadRequest)
}

// --- Accounts ---

func (s *Service) ListAccounts(ctx context.Context, tenantID string, status *string) ([]models.Account, error) {
	return s.repo.ListAccounts(ctx, tenantID, status)
}

func (s *Service) GetAccount(ctx context.Context, tenantID, id string) (*models.Account, error) {
	account, err := s.repo.GetAccountByID(ctx, tenantID, id)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return account, nil
}

func (s *Service) CreateAccount(ctx context.Context, tenantID string, req *models.CreateAccountRequest) (*models.Account, error) {
	if req == nil || strings.TrimSpace(req.Name) == "" {
		return nil, ErrBadRequest
	}
	currency := "USD"
	if req.Currency != nil {
		currency = *req.Currency
	}
	balance := 0.0
	if req.CreditBalance != nil {
		balance = *req.CreditBalance
	}
	account := &models.Account{
		TenantID:      tenantID,
		Name:          req.Name,
		BillingEmail:  req.BillingEmail,
		PaymentMethod: req.PaymentMethod,
		Currency:      currency,
		Status:        "active",
		CreditBalance: balance,
	}
	if err := s.repo.CreateAccount(ctx, account); err != nil {
		return nil, err
	}
	return account, nil
}

func (s *Service) UpdateAccount(ctx context.Context, tenantID, id string, req *models.UpdateAccountRequest) (*models.Account, error) {
	if req == nil {
		return nil, ErrBadRequest
	}
	updates := make(map[string]interface{})
	if req.Name != nil && *req.Name != "" {
		updates["name"] = *req.Name
	}
	if req.BillingEmail != nil {
		updates["billing_email"] = *req.BillingEmail
	}
	if req.PaymentMethod != nil {
		updates["payment_method"] = *req.PaymentMethod
	}
	if req.Currency != nil {
		updates["currency"] = *req.Currency
	}
	if req.Status != nil {
		if *req.Status != "active" && *req.Status != "suspended" && *req.Status != "closed" {
			return nil, ErrBadRequest
		}
		updates["status"] = *req.Status
	}
	if req.CreditBalance != nil {
		updates["credit_balance"] = *req.CreditBalance
	}
	updated, err := s.repo.UpdateAccount(ctx, tenantID, id, updates)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return updated, nil
}

func (s *Service) DeleteAccount(ctx context.Context, tenantID, id string) error {
	deleted, err := s.repo.DeleteAccount(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if !deleted {
		return sentinel.NotFound
	}
	return nil
}

// --- Invoices ---

func (s *Service) ListInvoices(ctx context.Context, tenantID string, filter *models.InvoiceFilter) ([]models.Invoice, int, error) {
	return s.repo.ListInvoices(ctx, tenantID, filter)
}

func (s *Service) GetInvoice(ctx context.Context, tenantID, id string) (*models.Invoice, error) {
	invoice, err := s.repo.GetInvoiceByID(ctx, tenantID, id)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return invoice, nil
}

func (s *Service) CreateInvoice(ctx context.Context, tenantID string, req *models.CreateInvoiceRequest) (*models.Invoice, error) {
	if req == nil || strings.TrimSpace(req.InvoiceNumber) == "" {
		return nil, ErrBadRequest
	}
	invoice := &models.Invoice{
		TenantID:      tenantID,
		AccountID:     req.AccountID,
		InvoiceNumber: req.InvoiceNumber,
		PeriodStart:   req.PeriodStart,
		PeriodEnd:     req.PeriodEnd,
		Total:         req.Total,
		Tax:           req.Tax,
		Status:        "pending",
		DueDate:       req.DueDate,
	}
	if err := s.repo.CreateInvoice(ctx, invoice); err != nil {
		return nil, err
	}
	return invoice, nil
}

func (s *Service) UpdateInvoice(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Invoice, error) {
	updated, err := s.repo.UpdateInvoice(ctx, tenantID, id, updates)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return updated, nil
}

func (s *Service) DeleteInvoice(ctx context.Context, tenantID, id string) error {
	deleted, err := s.repo.DeleteInvoice(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if !deleted {
		return sentinel.NotFound
	}
	return nil
}

// --- Line Items ---

func (s *Service) CreateLineItem(ctx context.Context, tenantID string, req *models.CreateLineItemRequest) (*models.LineItem, error) {
	if req == nil || strings.TrimSpace(req.Description) == "" || req.UnitPrice <= 0 {
		return nil, ErrBadRequest
	}
	// Verify invoice belongs to tenant
	_, err := s.GetInvoice(ctx, tenantID, req.InvoiceID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	quantity := 1.0
	if req.Quantity > 0 {
		quantity = req.Quantity
	}
	amount := quantity * req.UnitPrice
	item := &models.LineItem{
		InvoiceID:   req.InvoiceID,
		Description: req.Description,
		Quantity:    quantity,
		UnitPrice:   req.UnitPrice,
		Amount:      amount,
	}
	if err := s.repo.CreateLineItem(ctx, item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Service) ListLineItems(ctx context.Context, tenantID, invoiceID string) ([]models.LineItem, error) {
	return s.repo.ListLineItemsByInvoice(ctx, tenantID, invoiceID)
}

// --- Subscriptions ---

func (s *Service) ListSubscriptions(ctx context.Context, tenantID string, status *string) ([]models.Subscription, error) {
	return s.repo.ListSubscriptions(ctx, tenantID, status)
}

func (s *Service) GetSubscription(ctx context.Context, tenantID, id string) (*models.Subscription, error) {
	sub, err := s.repo.GetSubscriptionByID(ctx, tenantID, id)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return sub, nil
}

func (s *Service) CreateSubscription(ctx context.Context, tenantID string, req *models.CreateSubscriptionRequest) (*models.Subscription, error) {
	if req == nil || strings.TrimSpace(req.PlanName) == "" || req.Amount <= 0 {
		return nil, ErrBadRequest
	}
	interval := req.Interval
	if interval != "monthly" && interval != "yearly" {
		return nil, ErrBadRequest
	}
	now := time.Now().UTC()
	sub := &models.Subscription{
		TenantID:  tenantID,
		PlanName:  req.PlanName,
		Amount:    req.Amount,
		Interval:  interval,
		Status:    "active",
		StartedAt: &now,
	}
	if err := s.repo.CreateSubscription(ctx, sub); err != nil {
		return nil, err
	}
	return sub, nil
}

func (s *Service) UpdateSubscription(ctx context.Context, tenantID, id string, req *models.UpdateSubscriptionRequest) (*models.Subscription, error) {
	if req == nil {
		return nil, ErrBadRequest
	}
	updates := make(map[string]interface{})
	if req.Status != nil {
		status := *req.Status
		if status != "active" && status != "cancelled" && status != "past_due" && status != "paused" {
			return nil, ErrBadRequest
		}
		updates["status"] = status
	}
	updated, err := s.repo.UpdateSubscription(ctx, tenantID, id, updates)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return updated, nil
}

func (s *Service) DeleteSubscription(ctx context.Context, tenantID, id string) error {
	deleted, err := s.repo.DeleteSubscription(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if !deleted {
		return sentinel.NotFound
	}
	return nil
}

// --- Stats ---

func (s *Service) GetBillingStats(ctx context.Context, tenantID string) (*models.BillingStats, error) {
	return s.repo.GetBillingStats(ctx, tenantID)
}
