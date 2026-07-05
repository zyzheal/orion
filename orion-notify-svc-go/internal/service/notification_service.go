package service

import (
	"context"
	"errors"

	"orion/notify-svc-go/internal/models"
	"orion/notify-svc-go/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrNotificationNotFound = errors.New("notification not found")
	ErrInvalidInput         = errors.New("tenant_id and user_id are required")
)

// NotificationService provides in-app notification business logic.
// Ported from orion-platform-service NotificationService.ts
type NotificationService struct {
	repo *repository.NotificationRepository
}

func NewNotificationService(repo *repository.NotificationRepository) *NotificationService {
	return &NotificationService{repo: repo}
}

// Send creates a new in-app notification. Validates that tenant_id and user_id
// are present on the notification record.
func (s *NotificationService) Send(ctx context.Context, tenantID string, req *models.CreateNotificationRequest) (*models.Notification, error) {
	if tenantID == "" || req.UserID == "" {
		return nil, ErrInvalidInput
	}

	channel := req.Channel
	if channel == "" {
		channel = "in-app"
	}

	n := &models.Notification{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		UserID:   req.UserID,
		Type:     req.Type,
		Title:    req.Title,
		Message:  req.Message,
		Channel:  channel,
	}
	if err := s.repo.Create(ctx, n); err != nil {
		return nil, err
	}

	// NOTE: In the Node.js version, an event is published here for multi-channel
	// delivery (email, Slack, DingTalk, WeChat Work). The Go service currently
	// only persists the in-app notification. Event publishing can be added later
	// when an event bus is integrated.

	return n, nil
}

// GetNotifications returns paginated notifications for a user with total count.
func (s *NotificationService) GetNotifications(ctx context.Context, userID string, limit, page int) (*models.PaginatedResponse, error) {
	total, err := s.repo.Count(ctx, userID)
	if err != nil {
		return nil, err
	}

	if limit <= 0 {
		limit = 20
	}
	offset := 0
	if page > 1 {
		offset = (page - 1) * limit
	}

	data, err := s.repo.FindAll(ctx, userID, "", limit, offset)
	if err != nil {
		return nil, err
	}

	return &models.PaginatedResponse{Data: data, Total: total}, nil
}

// MarkAsRead marks a single notification as read. Returns error if not found.
func (s *NotificationService) MarkAsRead(ctx context.Context, id string) (*models.Notification, error) {
	// Verify the notification exists first
	_, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, ErrNotificationNotFound
	}

	updated, err := s.repo.MarkAsRead(ctx, id)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

// GetUnreadCount returns the number of unread (status='sent') notifications for a user.
func (s *NotificationService) GetUnreadCount(ctx context.Context, userID string) (int, error) {
	return s.repo.GetUnreadCount(ctx, userID)
}

// Broadcast creates a notification for each user in the list.
// Returns the number of notifications created.
func (s *NotificationService) Broadcast(ctx context.Context, tenantID string, req *models.BroadcastNotificationRequest) (int, error) {
	count := 0
	for _, userID := range req.UserIDs {
		n := &models.Notification{
			ID:       uuid.New().String(),
			TenantID: tenantID,
			UserID:   userID,
			Type:     req.Type,
			Title:    req.Title,
			Message:  req.Message,
			Channel:  "in-app",
		}
		if err := s.repo.Create(ctx, n); err != nil {
			return count, err
		}
		count++

		// NOTE: In the Node.js version, a 'notification.broadcast' event is emitted
		// here for each notification. Event publishing can be added later.
	}
	return count, nil
}
