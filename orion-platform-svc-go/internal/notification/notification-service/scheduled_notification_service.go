package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/notification/notification/models"
	"orion/platform-svc-go/internal/notification/notification/repository"
	"orion/go-common/pkg/otel"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ErrScheduledNotificationNotFound is returned when a scheduled notification lookup fails.
var ErrScheduledNotificationNotFound = fmt.Errorf("scheduled notification not found")

// ScheduledNotificationService implements the scheduled notification business logic.
type ScheduledNotificationService struct {
	repo   *repository.ScheduledNotificationRepository
	logger *zap.Logger
}

// NewScheduledNotificationService creates a new ScheduledNotificationService.
func NewScheduledNotificationService(repo *repository.ScheduledNotificationRepository, logger *zap.Logger) *ScheduledNotificationService {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &ScheduledNotificationService{repo: repo, logger: logger}
}

// CreateScheduledNotification creates a new scheduled notification.
func (s *ScheduledNotificationService) CreateScheduledNotification(ctx context.Context, tenantID string, req *models.CreateScheduledNotificationInput) (*models.ScheduledNotification, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "ScheduledNotificationService.Create")
	defer span.End()

	if req.UserID == "" || req.Type == "" || req.Title == "" || req.Message == "" || req.ScheduledAt.IsZero() {
		return nil, fmt.Errorf("user_id, type, title, message, and scheduled_at are required")
	}

	now := time.Now()
	scheduledAt := req.ScheduledAt
	channel := req.Channel
	if channel == "" {
		channel = models.ChannelInApp
	}

	n := &models.ScheduledNotification{
		ID:          mustGenerateID(),
		TenantID:    tenantID,
		UserID:      req.UserID,
		TemplateID:  func() *string { t := req.TemplateID; return &t }(),
		Type:        req.Type,
		Title:       req.Title,
		Message:     req.Message,
		Channel:     string(channel),
		ScheduledAt: &scheduledAt,
		Status:      models.ScheduledStatusPending,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.Create(ctx, n); err != nil {
		s.logger.Error("failed to create scheduled notification", zap.Error(err), zap.String("title", req.Title))
		return nil, fmt.Errorf("failed to create scheduled notification: %w", err)
	}

	s.logger.Info("scheduled notification created", zap.String("id", n.ID), zap.String("scheduled_at", n.ScheduledAt.Format(time.RFC3339)))
	return n, nil
}

// GetScheduledNotification returns a single scheduled notification by id.
func (s *ScheduledNotificationService) GetScheduledNotification(ctx context.Context, tenantID, id string) (*models.ScheduledNotification, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "ScheduledNotificationService.Get")
	defer span.End()

	n, err := s.repo.FindByID(ctx, tenantID, id)
	if err != nil {
		s.logger.Warn("scheduled notification not found", zap.String("id", id), zap.Error(err))
		return nil, ErrScheduledNotificationNotFound
	}
	return n, nil
}

// ListScheduledNotifications returns scheduled notifications with optional filters.
func (s *ScheduledNotificationService) ListScheduledNotifications(ctx context.Context, tenantID string, opts models.ListNotificationsQuery) ([]models.ScheduledNotification, int, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "ScheduledNotificationService.List")
	defer span.End()

	items, total, err := s.repo.FindAll(ctx, tenantID, opts)
	if err != nil {
		s.logger.Error("failed to list scheduled notifications", zap.Error(err))
		return nil, 0, fmt.Errorf("failed to list scheduled notifications: %w", err)
	}
	return items, total, nil
}

// UpdateScheduledNotification updates a scheduled notification.
func (s *ScheduledNotificationService) UpdateScheduledNotification(ctx context.Context, tenantID, id string, req *models.UpdateScheduledNotificationInput) (*models.ScheduledNotification, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "ScheduledNotificationService.Update")
	defer span.End()

	// Verify exists
	if _, err := s.repo.FindByID(ctx, tenantID, id); err != nil {
		return nil, ErrScheduledNotificationNotFound
	}

	updates := make(map[string]interface{})
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Message != nil {
		updates["message"] = *req.Message
	}
	if req.ScheduledAt != nil {
		updates["scheduled_at"] = *req.ScheduledAt
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}

	n, err := s.repo.Update(ctx, tenantID, id, updates)
	if err != nil {
		s.logger.Error("failed to update scheduled notification", zap.Error(err), zap.String("id", id))
		return nil, fmt.Errorf("failed to update scheduled notification: %w", err)
	}

	s.logger.Info("scheduled notification updated", zap.String("id", id))
	return n, nil
}

// CancelScheduledNotification cancels a scheduled notification.
func (s *ScheduledNotificationService) CancelScheduledNotification(ctx context.Context, tenantID, id string) error {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "ScheduledNotificationService.Cancel")
	defer span.End()

	ok, err := s.repo.Cancel(ctx, tenantID, id)
	if err != nil {
		s.logger.Error("failed to cancel scheduled notification", zap.Error(err), zap.String("id", id))
		return fmt.Errorf("failed to cancel: %w", err)
	}
	if !ok {
		return ErrScheduledNotificationNotFound
	}
	s.logger.Info("scheduled notification cancelled", zap.String("id", id))
	return nil
}

// DeleteScheduledNotification deletes a scheduled notification.
func (s *ScheduledNotificationService) DeleteScheduledNotification(ctx context.Context, tenantID, id string) error {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "ScheduledNotificationService.Delete")
	defer span.End()

	ok, err := s.repo.Delete(ctx, tenantID, id)
	if err != nil {
		s.logger.Error("failed to delete scheduled notification", zap.Error(err), zap.String("id", id))
		return fmt.Errorf("failed to delete: %w", err)
	}
	if !ok {
		return ErrScheduledNotificationNotFound
	}
	s.logger.Info("scheduled notification deleted", zap.String("id", id))
	return nil
}

// ValidateCronExpression validates a cron expression and returns a human-readable description.
func (s *ScheduledNotificationService) ValidateCronExpression(cronExpression string) models.ParsedCronSchedule {
	fields := strings.Fields(cronExpression)

	if len(fields) != 5 {
		return models.ParsedCronSchedule{
			Expression: cronExpression,
			Error:      "Cron expression must have exactly 5 fields (minute hour day-of-month month day-of-week)",
		}
	}

	for _, field := range fields {
		valid, _ := regexpMatchString("^[\\d\\*\\/\\-,]+$", field)
		if !valid {
			return models.ParsedCronSchedule{
				Expression: cronExpression,
				Error:      fmt.Sprintf("Invalid field: %s", field),
			}
		}
	}

	description := buildCronDescription(fields)
	nextFire := time.Now().Add(1 * time.Minute).Truncate(time.Minute)

	return models.ParsedCronSchedule{
		Expression:   cronExpression,
		Description:  fmt.Sprintf("Runs %s", description),
		NextRuns:     []time.Time{nextFire},
	}
}

func mustGenerateID() string {
	return "sn-" + strings.ReplaceAll(uuid.New().String(), "-", "")[:12]
}

func regexpMatchString(pattern, s string) (bool, error) {
	for _, ch := range s {
		matched := (ch >= '0' && ch <= '9') || ch == '*' || ch == '/' || ch == '-' || ch == ','
		if !matched {
			return false, nil
		}
	}
	return true, nil
}

func buildCronDescription(fields []string) string {
	minute, hour, dom, month, dow := fields[0], fields[1], fields[2], fields[3], fields[4]

	parts := []string{}
	if minute == "*" && hour == "*" {
		parts = append(parts, "every minute")
	} else if hour == "*" {
		parts = append(parts, fmt.Sprintf("at minute %s of every hour", minute))
	} else if minute == "*" {
		parts = append(parts, fmt.Sprintf("every minute during hour %s", hour))
	} else {
		parts = append(parts, fmt.Sprintf("at %s:%s", hour, padLeft(minute, "0", 2)))
	}

	if dom != "*" || dow != "*" {
		domPart := ""
		if dom != "*" {
			domPart = fmt.Sprintf("on day %s of month", dom)
		}
		dowPart := ""
		if dow != "*" {
			dowPart = fmt.Sprintf("on %s", dow)
		}
		if domPart != "" && dowPart != "" {
			parts = append(parts, fmt.Sprintf("%s and %s", domPart, dowPart))
		} else if domPart != "" {
			parts = append(parts, domPart)
		} else if dowPart != "" {
			parts = append(parts, dowPart)
		}
	}

	if month != "*" {
		parts = append(parts, fmt.Sprintf("in month %s", month))
	}

	if len(parts) == 0 {
		return strings.Join(fields, " ")
	}
	return strings.Join(parts, " ")
}

func padLeft(s, pad string, length int) string {
	for len(s) < length {
		s = pad + s
	}
	return s
}

// ToggleScheduledNotification toggles the enabled/disabled status of a scheduled notification.
func (s *ScheduledNotificationService) ToggleScheduledNotification(ctx context.Context, tenantID, id string, enabled bool) (*models.ScheduledNotification, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "ScheduledNotificationService.Toggle")
	defer span.End()

	n, err := s.repo.FindByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrScheduledNotificationNotFound
	}

	var newStatus models.ScheduledNotificationStatus
	if enabled {
		newStatus = models.ScheduledStatusPending
	} else {
		newStatus = models.ScheduledStatusPaused
	}

	if n.Status == newStatus {
		return n, nil
	}

	updates := map[string]interface{}{"status": string(newStatus)}
	n, err = s.repo.Update(ctx, tenantID, id, updates)
	if err != nil {
		s.logger.Error("failed to toggle scheduled notification", zap.Error(err), zap.String("id", id))
		return nil, fmt.Errorf("failed to toggle scheduled notification: %w", err)
	}

	s.logger.Info("scheduled notification toggled", zap.String("id", id), zap.Bool("enabled", enabled), zap.String("status", string(newStatus)))
	return n, nil
}
