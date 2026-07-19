package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/webhook/models"
	"orion/platform-svc-go/internal/webhook/repository"

	"github.com/google/uuid"
)

// Sentinel errors for the webhook service.
var (
	ErrWebhookNotFound = errors.New("webhook not found")
	ErrWebhookDisabled = errors.New("webhook is disabled")
)

// IsNotFound returns true if the error is a webhook not-found error.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrWebhookNotFound)
}

// Service implements webhook business logic.
type Service struct {
	repo WebhookRepo
}

// NewService creates a new Service.
func NewService(repo WebhookRepo) *Service {
	return &Service{repo: repo}
}

// --- Webhook CRUD ---

// Create creates a new webhook.
func (s *Service) Create(ctx context.Context, tenantID, userID string, req *models.CreateWebhookRequest) (*models.Webhook, error) {
	secret, err := GenerateSecret()
	if err != nil {
		return nil, fmt.Errorf("generate secret: %w", err)
	}

	method := req.Method
	if method == "" {
		method = "POST"
	}

	w := &models.Webhook{
		TenantID:    tenantID,
		UserID:      userID,
		Name:        req.Name,
		URL:         req.URL,
		Method:      method,
		EventType:   req.EventType,
		Secret:      secret,
		Headers:     req.Headers,
		BodyTemplate: req.BodyTemplate,
		Enabled:     req.Enabled,
		MaxRetries:  req.MaxRetries,
		RetryInterval: req.RetryInterval,
		Timeout:     req.Timeout,
		LastDeliveryStatus: "pending",
	}

	if err := s.repo.Create(ctx, w); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, w.ID, tenantID)
}

// List returns paginated webhooks.
func (s *Service) List(ctx context.Context, tenantID string, filter *models.ListFilter, page, pageSize int) ([]models.Webhook, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	webhooks, err := s.repo.List(ctx, tenantID, filter, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	if webhooks == nil {
		webhooks = []models.Webhook{}
	}
	return webhooks, len(webhooks), nil
}

// Get returns a single webhook.
func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Webhook, error) {
	w, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrWebhookNotFound
		}
		return nil, err
	}
	return w, nil
}

// Update applies partial updates to a webhook.
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateWebhookRequest) (*models.Webhook, error) {
	existing, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrWebhookNotFound
		}
		return nil, err
	}

	// Build a webhook struct with only the fields that were provided.
	updated := &models.Webhook{
		ID:       id,
		TenantID: tenantID,
	}

	if req.Name != nil {
		updated.Name = *req.Name
	} else {
		updated.Name = existing.Name
	}
	if req.URL != nil {
		updated.URL = *req.URL
	} else {
		updated.URL = existing.URL
	}
	if req.Method != nil {
		updated.Method = *req.Method
	} else {
		updated.Method = existing.Method
	}
	if req.EventType != nil {
		updated.EventType = *req.EventType
	} else {
		updated.EventType = existing.EventType
	}
	if req.Headers != nil {
		updated.Headers = *req.Headers
	} else {
		updated.Headers = existing.Headers
	}
	if req.BodyTemplate != nil {
		updated.BodyTemplate = *req.BodyTemplate
	} else {
		updated.BodyTemplate = existing.BodyTemplate
	}
	if req.Enabled != nil {
		updated.Enabled = *req.Enabled
	} else {
		updated.Enabled = existing.Enabled
	}
	if req.MaxRetries != nil {
		updated.MaxRetries = *req.MaxRetries
	} else {
		updated.MaxRetries = existing.MaxRetries
	}
	if req.RetryInterval != nil {
		updated.RetryInterval = *req.RetryInterval
	} else {
		updated.RetryInterval = existing.RetryInterval
	}
	if req.Timeout != nil {
		updated.Timeout = *req.Timeout
	} else {
		updated.Timeout = existing.Timeout
	}

	// Preserve fields that are not updatable via the request.
	updated.Secret = existing.Secret
	updated.LastDeliveryStatus = existing.LastDeliveryStatus
	updated.LastTriggeredAt = existing.LastTriggeredAt

	if err := s.repo.Update(ctx, updated); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrWebhookNotFound
		}
		return nil, err
	}
	return s.repo.GetByID(ctx, id, tenantID)
}

// Delete removes a webhook.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	err := s.repo.Delete(ctx, id, tenantID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrWebhookNotFound
		}
		return err
	}
	return nil
}

// Count returns the total number of webhooks for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// ListDeliveries returns paginated delivery records for a webhook.
func (s *Service) ListDeliveries(ctx context.Context, webhookID string, page, pageSize int) ([]models.WebhookDelivery, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	deliveries, err := s.repo.ListByWebhook(ctx, webhookID, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	if deliveries == nil {
		deliveries = []models.WebhookDelivery{}
	}
	return deliveries, len(deliveries), nil
}

// --- Webhook Actions ---

// GenerateSecret generates a cryptographically random 32-byte hex string.
func GenerateSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// SignPayload computes an HMAC-SHA256 signature of the payload using the given secret.
func SignPayload(payload []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}

// Trigger initiates a webhook delivery by updating its last_triggered_at and
// creating a delivery log entry.
func (s *Service) Trigger(ctx context.Context, tenantID, id string) error {
	w, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrWebhookNotFound
		}
		return err
	}
	if !w.Enabled {
		return ErrWebhookDisabled
	}

	now := time.Now().UTC()
	delivery := &models.WebhookDelivery{
		WebhookID:  id,
		URL:        w.URL,
		Status:     "triggered",
		Attempt:    1,
		CreatedAt:  now,
		TriggeredAt: &now,
	}
	if err := s.repo.CreateDelivery(ctx, delivery); err != nil {
		return err
	}

	// Update last_triggered_at on the webhook.
	updates := &models.Webhook{
		ID:                id,
		TenantID:          tenantID,
		LastTriggeredAt:   &now,
		LastDeliveryStatus: "triggered",
	}
	if err := s.repo.Update(ctx, updates); err != nil {
		return err
	}
	return nil
}

// TriggerByEvent finds all enabled webhooks matching the given event type and
// creates a delivery record for each.
func (s *Service) TriggerByEvent(ctx context.Context, tenantID, eventType string) error {
	enabled := true
	filter := &models.ListFilter{
		EventType: &eventType,
		Enabled:   &enabled,
	}
	// TODO: consider fetching all matching webhooks and triggering them concurrently.
	webhooks, err := s.repo.List(ctx, tenantID, filter, 1000, 0)
	if err != nil {
		return err
	}
	for _, w := range webhooks {
		now := time.Now().UTC()
		delivery := &models.WebhookDelivery{
			WebhookID:  w.ID,
			URL:        w.URL,
			Status:     "triggered",
			Attempt:    1,
			CreatedAt:  now,
			TriggeredAt: &now,
		}
		if err := s.repo.CreateDelivery(ctx, delivery); err != nil {
			return err
		}
		updates := &models.Webhook{
			ID:                w.ID,
			TenantID:          tenantID,
			LastTriggeredAt:   &now,
			LastDeliveryStatus: "triggered",
		}
		if err := s.repo.Update(ctx, updates); err != nil {
			return err
		}
	}
	return nil
}

// RotateSecret generates a new secret for the webhook and updates it.
func (s *Service) RotateSecret(ctx context.Context, tenantID, id string) (string, error) {
	_, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return "", ErrWebhookNotFound
		}
		return "", err
	}

	secret, err := GenerateSecret()
	if err != nil {
		return "", err
	}

	updates := &models.Webhook{
		ID:       id,
		TenantID: tenantID,
		Secret:   secret,
	}
	if err := s.repo.Update(ctx, updates); err != nil {
		return "", err
	}
	return secret, nil
}

// --- Helpers ---

func newUUID() string {
	return uuid.New().String()
}