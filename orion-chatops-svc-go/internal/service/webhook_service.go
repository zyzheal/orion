package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"orion/chatops-svc-go/internal/models"
	"orion/chatops-svc-go/internal/repository"

	"github.com/google/uuid"
)

// WebhookService handles webhook CRUD and event delivery.
type WebhookService struct {
	repo   *repository.Repository
	client *http.Client
	wg     sync.WaitGroup
	cancel context.CancelFunc
}

func NewWebhookService(repo *repository.Repository) *WebhookService {
	ctx, cancel := context.WithCancel(context.Background())
	_ = ctx // ctx is used in Shutdown
	return &WebhookService{
		repo:   repo,
		client: &http.Client{Timeout: 30 * time.Second},
		cancel: cancel,
	}
}

// Shutdown cancels all in-flight deliveries and waits for them to finish.
func (s *WebhookService) Shutdown() {
	s.cancel()
	s.wg.Wait()
}

func (s *WebhookService) Create(ctx context.Context, tenantID string, req models.CreateWebhookRequest) (*models.ChatOpsWebhook, error) {
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	retryCount := req.RetryCount
	if retryCount <= 0 {
		retryCount = 3
	}
	retryInterval := req.RetryIntervalSeconds
	if retryInterval <= 0 {
		retryInterval = 5
	}
	timeout := req.TimeoutSeconds
	if timeout <= 0 {
		timeout = 30
	}

	h := &models.ChatOpsWebhook{
		ID:                   uuid.New().String(),
		TenantID:             tenantID,
		Name:                 req.Name,
		URL:                  req.URL,
		Events:               req.Events,
		Enabled:              enabled,
		RetryCount:           retryCount,
		RetryIntervalSeconds: retryInterval,
		TimeoutSeconds:       timeout,
		Description:          req.Description,
		CreatedBy:            req.CreatedBy,
	}
	if req.SecretKey != "" {
		h.SecretKey = &req.SecretKey
	}
	if req.Headers != nil {
		h.Headers = models.JSONB{}
		for k, v := range req.Headers {
			h.Headers[k] = v
		}
	}
	if err := s.repo.CreateWebhook(ctx, h); err != nil {
		return nil, err
	}
	return h, nil
}

func (s *WebhookService) Get(ctx context.Context, tenantID, id string) (*models.ChatOpsWebhook, error) {
	return s.repo.GetWebhook(ctx, tenantID, id)
}

func (s *WebhookService) List(ctx context.Context, tenantID string) ([]models.ChatOpsWebhook, error) {
	return s.repo.ListWebhooks(ctx, tenantID)
}

func (s *WebhookService) Update(ctx context.Context, tenantID, id string, req models.UpdateWebhookRequest) (*models.ChatOpsWebhook, error) {
	existing, err := s.repo.GetWebhook(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.URL != nil {
		existing.URL = *req.URL
	}
	if req.Events != nil {
		existing.Events = *req.Events
	}
	if req.SecretKey != nil {
		existing.SecretKey = req.SecretKey
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}
	if req.RetryCount != nil {
		existing.RetryCount = *req.RetryCount
	}
	if req.RetryIntervalSeconds != nil {
		existing.RetryIntervalSeconds = *req.RetryIntervalSeconds
	}
	if req.TimeoutSeconds != nil {
		existing.TimeoutSeconds = *req.TimeoutSeconds
	}
	if req.Headers != nil {
		existing.Headers = models.JSONB{}
		for k, v := range req.Headers {
			existing.Headers[k] = v
		}
	}
	if req.Description != nil {
		existing.Description = *req.Description
	}
	if err := s.repo.UpdateWebhook(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *WebhookService) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteWebhook(ctx, tenantID, id)
}

func (s *WebhookService) GetLogs(ctx context.Context, tenantID, webhookID string, limit int) ([]models.ChatOpsWebhookLog, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.repo.ListWebhookLogs(ctx, tenantID, webhookID, limit)
}

// DeliverEvent sends an event to all enabled webhooks subscribed to the event type.
func (s *WebhookService) DeliverEvent(ctx context.Context, tenantID, eventType string, payload interface{}) error {
	webhooks, err := s.repo.ListEnabledWebhooks(ctx, tenantID)
	if err != nil {
		return err
	}

	for _, wh := range webhooks {
		if !s.eventMatches(wh.Events, eventType) {
			continue
		}
		s.wg.Add(1)
		go func(w models.ChatOpsWebhook) {
			defer s.wg.Done()
			s.deliverWithRetry(w, eventType, payload)
		}(wh)
	}
	return nil
}

func (s *WebhookService) eventMatches(events []string, eventType string) bool {
	for _, e := range events {
		if e == "*" || e == eventType {
			return true
		}
	}
	return false
}

func (s *WebhookService) deliverWithRetry(wh models.ChatOpsWebhook, eventType string, payload interface{}) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(wh.RetryCount+1)*time.Duration(wh.RetryIntervalSeconds)*time.Second+time.Duration(wh.TimeoutSeconds)*time.Second)
	defer cancel()

	body, err := json.Marshal(map[string]interface{}{
		"event":     eventType,
		"payload":   payload,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		log.Printf("webhook: failed to marshal payload for %s: %v", wh.ID, err)
		return
	}

	var lastErr string
	var lastStatus int
	for attempt := 0; attempt <= wh.RetryCount; attempt++ {
		if attempt > 0 {
			timer := time.NewTimer(time.Duration(wh.RetryIntervalSeconds) * time.Second)
			select {
			case <-timer.C:
				// continue with retry
			case <-ctx.Done():
				timer.Stop()
				return
			}
		}

		req, err := http.NewRequestWithContext(ctx, "POST", wh.URL, bytes.NewReader(body))
		if err != nil {
			log.Printf("webhook: failed to create request for %s: %v", wh.ID, err)
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Orion-Event", eventType)

		// HMAC signature if secret exists
		if wh.SecretKey != nil && *wh.SecretKey != "" {
			sig := computeHMAC(body, *wh.SecretKey)
			req.Header.Set("X-Orion-Signature", sig)
		}

		// Custom headers
		if wh.Headers != nil {
			for k, v := range wh.Headers {
				if vs, ok := v.(string); ok {
					req.Header.Set(k, vs)
				}
			}
		}

		resp, err := s.client.Do(req)
		if err != nil {
			lastErr = err.Error()
			continue
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		lastStatus = resp.StatusCode
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			// Success
			if err := s.repo.UpdateWebhookTriggerStatus(ctx, wh.TenantID, wh.ID, "success"); err != nil {
				log.Printf("webhook: failed to update trigger status for %s: %v", wh.ID, err)
			}
			if err := s.repo.CreateWebhookLog(ctx, &models.ChatOpsWebhookLog{
				ID:             uuid.New().String(),
				TenantID:       wh.TenantID,
				WebhookID:      wh.ID,
				EventType:      eventType,
				Payload:        models.JSONB{"body": string(body)},
				ResponseStatus: &resp.StatusCode,
				ResponseBody:   strPtr(string(respBody)),
				RetryCount:     attempt,
			}); err != nil {
				log.Printf("webhook: failed to create log for %s: %v", wh.ID, err)
			}
			return
		}
		lastErr = fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	// All retries exhausted
	if err := s.repo.UpdateWebhookTriggerStatus(ctx, wh.TenantID, wh.ID, "failed"); err != nil {
		log.Printf("webhook: failed to update trigger status for %s: %v", wh.ID, err)
	}
	if err := s.repo.CreateWebhookLog(ctx, &models.ChatOpsWebhookLog{
		ID:             uuid.New().String(),
		TenantID:       wh.TenantID,
		WebhookID:      wh.ID,
		EventType:      eventType,
		Payload:        models.JSONB{"body": string(body)},
		ResponseStatus: &lastStatus,
		ErrorMessage:   &lastErr,
		RetryCount:     wh.RetryCount,
	}); err != nil {
		log.Printf("webhook: failed to create log for %s: %v", wh.ID, err)
	}
}

func computeHMAC(body []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func strPtr(s string) *string { return &s }

// Test sends a test payload to a webhook and returns the result.
func (s *WebhookService) Test(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	wh, err := s.repo.GetWebhook(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}

	testPayload := map[string]interface{}{
		"event":     "test",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"payload":   map[string]string{"message": "This is a test webhook notification"},
	}

	body, _ := json.Marshal(testPayload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, wh.URL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Event", "test")
	if wh.SecretKey != nil {
		req.Header.Set("X-Signature-256", computeHMAC(body, *wh.SecretKey))
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		}, nil
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	return map[string]interface{}{
		"success":    resp.StatusCode >= 200 && resp.StatusCode < 300,
		"statusCode": resp.StatusCode,
		"response":   string(respBody),
	}, nil
}
