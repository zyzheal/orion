package service

import (
	"context"

	"orion/notify-svc-go/internal/models"
	"orion/notify-svc-go/internal/repository"

	"github.com/google/uuid"
)

// SettingsService provides notification settings business logic.
// Ported from orion-platform-service NotificationSettingsService.ts
type SettingsService struct {
	repo *repository.SettingsRepository
}

func NewSettingsService(repo *repository.SettingsRepository) *SettingsService {
	return &SettingsService{repo: repo}
}

// defaultSettings returns a NotificationSettings struct with all default values,
// matching the Node.js ?? defaults in NotificationSettingsRepository.ts.
func defaultSettings(userID, tenantID string) *models.NotificationSettings {
	return &models.NotificationSettings{
		UserID:            userID,
		TenantID:          tenantID,
		EmailEnabled:      true,
		SmsEnabled:        false,
		WebhookEnabled:    false,
		WebhookURL:        nil,
		PipelineCompleted: true,
		PipelineFailed:    true,
		TicketAssigned:    true,
		TicketEscalated:   true,
		SlaWarning:        true,
		SlaBreached:       true,
		AlertTriggered:    true,
		DeploymentSucceed: true,
		DeploymentFailed:  true,
		SystemAlert:       true,
		CommentMention:    true,
		TransferRequest:   true,
		DigestEnabled:     false,
		DigestFrequency:   "daily",
		QuietHoursStart:   nil,
		QuietHoursEnd:     nil,
	}
}

// GetSettings returns the notification settings for a user. If no settings exist,
// creates and returns default settings (same behavior as the Node.js version).
func (s *SettingsService) GetSettings(ctx context.Context, userID, tenantID string) (*models.NotificationSettings, error) {
	settings, err := s.repo.FindByUser(ctx, userID, tenantID)
	if err == nil {
		return settings, nil
	}

	// No settings found — create defaults
	defaults := defaultSettings(userID, tenantID)
	defaults.ID = uuid.New().String()
	if err := s.repo.Upsert(ctx, defaults); err != nil {
		return nil, err
	}
	return defaults, nil
}

// UpdateSettings updates the notification settings for a user. Merges the provided
// fields with existing settings (or defaults if none exist), then upserts.
func (s *SettingsService) UpdateSettings(ctx context.Context, userID, tenantID string, req *models.UpdateNotificationSettingsRequest) (*models.NotificationSettings, error) {
	// Start with existing settings or defaults
	existing, err := s.repo.FindByUser(ctx, userID, tenantID)
	if err != nil {
		existing = defaultSettings(userID, tenantID)
		existing.ID = uuid.New().String()
	}

	// Apply partial updates — only override fields that were explicitly provided
	if req.EmailEnabled != nil {
		existing.EmailEnabled = *req.EmailEnabled
	}
	if req.SmsEnabled != nil {
		existing.SmsEnabled = *req.SmsEnabled
	}
	if req.WebhookEnabled != nil {
		existing.WebhookEnabled = *req.WebhookEnabled
	}
	if req.WebhookURL != nil {
		existing.WebhookURL = req.WebhookURL
	}
	if req.PipelineCompleted != nil {
		existing.PipelineCompleted = *req.PipelineCompleted
	}
	if req.PipelineFailed != nil {
		existing.PipelineFailed = *req.PipelineFailed
	}
	if req.TicketAssigned != nil {
		existing.TicketAssigned = *req.TicketAssigned
	}
	if req.TicketEscalated != nil {
		existing.TicketEscalated = *req.TicketEscalated
	}
	if req.SlaWarning != nil {
		existing.SlaWarning = *req.SlaWarning
	}
	if req.SlaBreached != nil {
		existing.SlaBreached = *req.SlaBreached
	}
	if req.AlertTriggered != nil {
		existing.AlertTriggered = *req.AlertTriggered
	}
	if req.DeploymentSucceed != nil {
		existing.DeploymentSucceed = *req.DeploymentSucceed
	}
	if req.DeploymentFailed != nil {
		existing.DeploymentFailed = *req.DeploymentFailed
	}
	if req.SystemAlert != nil {
		existing.SystemAlert = *req.SystemAlert
	}
	if req.CommentMention != nil {
		existing.CommentMention = *req.CommentMention
	}
	if req.TransferRequest != nil {
		existing.TransferRequest = *req.TransferRequest
	}
	if req.DigestEnabled != nil {
		existing.DigestEnabled = *req.DigestEnabled
	}
	if req.DigestFrequency != nil {
		existing.DigestFrequency = *req.DigestFrequency
	}
	if req.QuietHoursStart != nil {
		existing.QuietHoursStart = req.QuietHoursStart
	}
	if req.QuietHoursEnd != nil {
		existing.QuietHoursEnd = req.QuietHoursEnd
	}

	if err := s.repo.Upsert(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}
