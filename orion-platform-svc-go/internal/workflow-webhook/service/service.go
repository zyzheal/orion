package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/workflow-webhook/models"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/workflow-webhook/repository"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Count(ctx context.Context, tenantID string) (int, error)
	Create(ctx context.Context, t *models.WebhookTrigger) error
	CreateLog(ctx context.Context, log *models.WebhookTriggerLog) error
	Delete(ctx context.Context, tenantID, id string) error
	FindByWebhookPath(ctx context.Context, webhookPath string) (*models.WebhookTrigger, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.WebhookTrigger, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.WebhookTrigger, error)
	ListLogs(ctx context.Context, triggerID string, offset, limit int) ([]models.WebhookTriggerLog, error)
	Update(ctx context.Context, t *models.WebhookTrigger) error
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

var (
	ErrWebhookNotFound  = errors.New("webhook trigger not found")
	ErrWebhookDisabled  = errors.New("webhook trigger is disabled")
	ErrInvalidSignature = errors.New("invalid webhook signature")
	ErrExpiredTimestamp = errors.New("webhook timestamp expired")
)

// MaxTimestampAge is the maximum allowed age for a webhook timestamp (5 minutes).
const MaxTimestampAge = 5 * time.Minute

// Status constants for trigger logs.
const (
	StatusPending = "pending"
	StatusRunning = "running"
	StatusSuccess = "success"
	StatusFailed  = "failed"
)

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

// Service provides business logic for workflow webhooks.
type Service struct {
	repo RepositoryInterface
}

// NewService creates a new Service.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// ---------------------------------------------------------------------------
// Webhook processing (public endpoint, no auth)
// ---------------------------------------------------------------------------

// ProcessWebhookResult holds the result of a webhook trigger processing.
type ProcessWebhookResult struct {
	Trigger      *models.WebhookTrigger
	LogID        string
	EventPayload string
}

// ProcessWebhook finds the trigger by path, verifies the signature (if secret is set),
// checks timestamp replay protection, creates a trigger log, and returns the result
// for the handler to create a workflow instance.
func (s *Service) ProcessWebhook(ctx context.Context, webhookPath string, body []byte, signatureHeader, timestampHeader string) (*ProcessWebhookResult, error) {
	// 1. Find trigger by webhook path.
	trigger, err := s.repo.FindByWebhookPath(ctx, webhookPath)
	if err != nil {
		if repository.IsNotFound(err) {
			return nil, fmt.Errorf("%w: %s", ErrWebhookNotFound, webhookPath)
		}
		return nil, fmt.Errorf("find webhook trigger: %w", err)
	}

	// 2. Check if trigger is enabled.
	if !trigger.Enabled {
		return nil, fmt.Errorf("%w: %s", ErrWebhookDisabled, trigger.Name)
	}

	// 3. Verify signature if a secret is configured on the trigger.
	if trigger.WebhookSecret != "" {
		// 3a. Check timestamp for replay protection.
		if timestampHeader == "" {
			return nil, fmt.Errorf("%w: missing x-webhook-timestamp header", ErrInvalidSignature)
		}
		ts, err := strconv.ParseInt(timestampHeader, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("%w: invalid timestamp format", ErrInvalidSignature)
		}
		eventTime := time.Unix(ts, 0)
		if time.Since(eventTime) > MaxTimestampAge {
			return nil, fmt.Errorf("%w: timestamp %d is too old", ErrExpiredTimestamp, ts)
		}

		// 3b. Verify HMAC-SHA256 signature.
		if signatureHeader == "" {
			return nil, fmt.Errorf("%w: missing x-webhook-signature header", ErrInvalidSignature)
		}
		expectedSignature := SignPayload(body, trigger.WebhookSecret, timestampHeader)
		if !VerifySignature(signatureHeader, expectedSignature) {
			return nil, fmt.Errorf("%w: signature mismatch", ErrInvalidSignature)
		}
	}

	// 4. Create trigger log entry.
	logID := uuid.New().String()
	payloadStr := string(body)
	triggerLog := &models.WebhookTriggerLog{
		ID:           logID,
		TriggerID:    trigger.ID,
		EventType:    "webhook",
		EventPayload: payloadStr,
		Status:       StatusPending,
	}
	if err := s.repo.CreateLog(ctx, triggerLog); err != nil {
		return nil, fmt.Errorf("create trigger log: %w", err)
	}

	return &ProcessWebhookResult{
		Trigger:      trigger,
		LogID:        logID,
		EventPayload: payloadStr,
	}, nil
}

// ---------------------------------------------------------------------------
// Signature helpers
// ---------------------------------------------------------------------------

// GenerateSecret generates a cryptographically random 32-byte hex-encoded secret.
func GenerateSecret() (string, error) {
	buf := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, buf); err != nil {
		return "", fmt.Errorf("generate secret: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

// SignPayload computes an HMAC-SHA256 signature for the given payload and timestamp.
// The message to sign is: timestamp + "." + payload
// The key is the hex-decoded webhook secret.
// The result is hex-encoded.
func SignPayload(payload []byte, secret, timestamp string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	// The convention used by many webhook providers (e.g., Stripe, Svix):
	// sign "timestamp.payload" as the message.
	_, _ = mac.Write([]byte(timestamp))
	_, _ = mac.Write([]byte("."))
	_, _ = mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}

// VerifySignature performs constant-time comparison of two hex-encoded HMAC signatures.
// Returns true if they match.
func VerifySignature(provided, expected string) bool {
	// Use constant-time comparison to prevent timing attacks.
	return hmac.Equal([]byte(provided), []byte(expected))
}

// ParseSignatureHeader extracts the signature from the x-webhook-signature header.
// Supports the format: "v1=signature_hex" (similar to Svix/Stripe convention).
// If the header contains multiple signatures separated by spaces, it parses each
// "v{N}={hex}" entry and returns the list of hex values.
func ParseSignatureHeader(header string) []string {
	var sigs []string
	parts := strings.Fields(header)
	for _, part := range parts {
		if idx := strings.Index(part, "="); idx >= 0 {
			sigs = append(sigs, part[idx+1:])
		} else {
			sigs = append(sigs, part)
		}
	}
	return sigs
}

// ---------------------------------------------------------------------------
// CRUD operations (with auth)
// ---------------------------------------------------------------------------

// Create validates a create request and persists a new webhook trigger.
func (s *Service) Create(ctx context.Context, tenantID, userID string, req *models.CreateWebhookTriggerRequest) (*models.WebhookTrigger, error) {
	strategy := models.TriggerStrategy(req.TriggerStrategy)
	if strategy == "" {
		strategy = models.StrategyAsync
	}
	if strategy != models.StrategySync && strategy != models.StrategyAsync {
		return nil, fmt.Errorf("invalid trigger strategy: %s", req.TriggerStrategy)
	}

	// If a secret is provided, keep it; otherwise generate one.
	secret := req.WebhookSecret
	if secret == "" {
		generated, err := GenerateSecret()
		if err != nil {
			return nil, fmt.Errorf("generate secret: %w", err)
		}
		secret = generated
	}

	t := &models.WebhookTrigger{
		ID:              uuid.New().String(),
		TenantID:        tenantID,
		WorkflowID:      req.WorkflowID,
		Name:            req.Name,
		WebhookPath:     req.WebhookPath,
		WebhookSecret:   secret,
		TriggerStrategy: strategy,
		Enabled:         req.Enabled,
	}

	// Use a placeholder user UUID for the created_by UserID if needed; we store tenant
	// relationship via TenantID. The table does not have a user_id column.

	if err := s.repo.Create(ctx, t); err != nil {
		return nil, fmt.Errorf("create webhook trigger failed: %w", err)
	}
	return t, nil
}

// GetByID returns a single webhook trigger by id.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.WebhookTrigger, error) {
	t, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		if repository.IsNotFound(err) {
			return nil, fmt.Errorf("%w: trigger %s", ErrWebhookNotFound, id)
		}
		return nil, fmt.Errorf("get webhook trigger: %w", err)
	}
	return t, nil
}

// List returns paginated webhook triggers for a tenant.
func (s *Service) List(ctx context.Context, tenantID string, filter *models.ListFilter, page, pageSize int) ([]models.WebhookTrigger, int, error) {
	offset := (page - 1) * pageSize
	if offset < 0 {
		offset = 0
	}

	items, err := s.repo.List(ctx, tenantID, filter, offset, pageSize)
	if err != nil {
		return nil, 0, fmt.Errorf("list webhook triggers: %w", err)
	}
	total, err := s.repo.Count(ctx, tenantID)
	if err != nil {
		return nil, 0, fmt.Errorf("count webhook triggers: %w", err)
	}
	return items, total, nil
}

// Count returns total webhook trigger count for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// Update modifies an existing webhook trigger's mutable fields.
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateWebhookTriggerRequest) (*models.WebhookTrigger, error) {
	existing, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		if repository.IsNotFound(err) {
			return nil, fmt.Errorf("%w: trigger %s", ErrWebhookNotFound, id)
		}
		return nil, fmt.Errorf("get webhook trigger: %w", err)
	}

	// Apply non-empty request fields over existing values.
	name := existing.Name
	if req.Name != nil {
		name = *req.Name
	}
	workflowID := existing.WorkflowID
	if req.WorkflowID != nil {
		workflowID = *req.WorkflowID
	}
	webhookPath := existing.WebhookPath
	if req.WebhookPath != nil {
		webhookPath = *req.WebhookPath
	}
	webhookSecret := existing.WebhookSecret
	if req.WebhookSecret != nil {
		webhookSecret = *req.WebhookSecret
	}
	strategy := existing.TriggerStrategy
	if req.TriggerStrategy != nil {
		strategy = models.TriggerStrategy(*req.TriggerStrategy)
	}
	enabled := existing.Enabled
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	updated := &models.WebhookTrigger{
		ID:              existing.ID,
		TenantID:        tenantID,
		WorkflowID:      workflowID,
		Name:            name,
		WebhookPath:     webhookPath,
		WebhookSecret:   webhookSecret,
		TriggerStrategy: strategy,
		Enabled:         enabled,
	}
	if err := s.repo.Update(ctx, updated); err != nil {
		return nil, fmt.Errorf("update webhook trigger failed: %w", err)
	}
	return updated, nil
}

// Delete removes a webhook trigger by id.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	if err := s.repo.Delete(ctx, tenantID, id); err != nil {
		if repository.IsNotFound(err) {
			return fmt.Errorf("%w: trigger %s", ErrWebhookNotFound, id)
		}
		return fmt.Errorf("delete webhook trigger: %w", err)
	}
	return nil
}

// RotateSecret generates a new secret for the given webhook trigger.
func (s *Service) RotateSecret(ctx context.Context, tenantID, id string) (string, error) {
	existing, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		if repository.IsNotFound(err) {
			return "", fmt.Errorf("%w: trigger %s", ErrWebhookNotFound, id)
		}
		return "", fmt.Errorf("get webhook trigger: %w", err)
	}

	newSecret, err := GenerateSecret()
	if err != nil {
		return "", fmt.Errorf("generate secret: %w", err)
	}

	existing.WebhookSecret = newSecret
	if err := s.repo.Update(ctx, existing); err != nil {
		return "", fmt.Errorf("update webhook trigger secret: %w", err)
	}
	return newSecret, nil
}

// ListLogs returns paginated trigger logs for a given trigger.
func (s *Service) ListLogs(ctx context.Context, triggerID string, page, pageSize int) ([]models.WebhookTriggerLog, int, error) {
	offset := (page - 1) * pageSize
	if offset < 0 {
		offset = 0
	}

	items, err := s.repo.ListLogs(ctx, triggerID, offset, pageSize)
	if err != nil {
		return nil, 0, fmt.Errorf("list trigger logs: %w", err)
	}

	// We don't have a total count endpoint for logs; return len(items) as a fallback.
	total := len(items)
	return items, total, nil
}

// IsNotFound reports whether the error wraps ErrWebhookNotFound.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrWebhookNotFound)
}
