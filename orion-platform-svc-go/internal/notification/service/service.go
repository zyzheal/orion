package service

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/platform-svc-go/internal/notification/models"
	notificationRepo "orion/platform-svc-go/internal/notification/repository"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Count(ctx context.Context, tenantID string) (int, error)
	Create(ctx context.Context, n *models.Notification) error
	Delete(ctx context.Context, id string, tenantID string) (bool, error)
	GetByID(ctx context.Context, id string, tenantID string) (*models.Notification, error)
	GetStats(ctx context.Context, tenantID string) (*models.NotificationStats, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, limit int, offset int) ([]models.Notification, error)
	MarkAllRead(ctx context.Context, tenantID string, userID string) error
	MarkRead(ctx context.Context, id string, tenantID string) error
	UpdateFields(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.Notification, error)
}

// Service provides business logic for notifications.
type Service struct {
	repo *notificationRepo.Repository
}

// NewService creates a new Service.
func NewService(repo *notificationRepo.Repository) *Service {
	return &Service{repo: repo}
}

// --- Errors ---

var (
	ErrNotFound     = errors.New("notification not found")
	ErrInvalidInput = errors.New("invalid input")
)

// IsNotFound returns true if the error indicates a not-found condition.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}

// --- Create ---

func (s *Service) Create(ctx context.Context, tenantID string, userID string, req *models.CreateNotificationRequest) (*models.Notification, error) {
	if req.Title == "" || req.Body == "" {
		return nil, ErrInvalidInput
	}
	priority := req.Priority
	if priority == "" {
		priority = "normal"
	}
	status := "pending"
	if req.Channel == "email" || req.Channel == "sms" {
		status = "sent"
	}
	now := time.Now().UTC()
	sentAt := &now
	if req.Channel == "in_app" {
		sentAt = nil
	}

	sourceID := ""
	sourceType := ""
	metadata := ""
	if req.SourceID != nil {
		sourceID = *req.SourceID
	}
	if req.SourceType != nil {
		sourceType = *req.SourceType
	}
	if req.Metadata != nil {
		metadata = *req.Metadata
	}

	n := &models.Notification{
		TenantID:         tenantID,
		UserID:           userID,
		Title:            req.Title,
		Body:             req.Body,
		NotificationType: req.NotificationType,
		Channel:          req.Channel,
		Status:           status,
		Priority:         priority,
		Read:             false,
		SourceID:         sourceID,
		SourceType:       sourceType,
		Metadata:         metadata,
		SentAt:           sentAt,
	}

	if err := s.repo.Create(ctx, n); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, n.ID, tenantID)
}

// --- List ---

func (s *Service) List(ctx context.Context, tenantID string, filter *models.ListFilter, page int, pageSize int) ([]models.Notification, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	notifications, err := s.repo.List(ctx, tenantID, filter, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	if notifications == nil {
		notifications = []models.Notification{}
	}
	total := len(notifications)
	return notifications, total, nil
}

// --- Get ---

func (s *Service) Get(ctx context.Context, tenantID string, id string) (*models.Notification, error) {
	n, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return n, nil
}

// --- Update ---

func (s *Service) Update(ctx context.Context, tenantID string, id string, req *models.UpdateNotificationRequest) (*models.Notification, error) {
	updates := map[string]interface{}{}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.Read != nil {
		updates["read"] = *req.Read
		if *req.Read {
			updates["read_at"] = time.Now().UTC()
		}
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	n, err := s.repo.UpdateFields(ctx, id, tenantID, updates)
	if err != nil {
		if err == notificationRepo.ErrNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return n, nil
}

// --- Delete ---

func (s *Service) Delete(ctx context.Context, tenantID string, id string) (bool, error) {
	return s.repo.Delete(ctx, id, tenantID)
}

// --- MarkRead ---

func (s *Service) MarkRead(ctx context.Context, tenantID string, id string) error {
	err := s.repo.MarkRead(ctx, id, tenantID)
	if err != nil {
		if err == notificationRepo.ErrNotFound {
			return ErrNotFound
		}
		return err
	}
	return nil
}

// --- MarkAllRead ---

func (s *Service) MarkAllRead(ctx context.Context, tenantID string, userID string) error {
	return s.repo.MarkAllRead(ctx, tenantID, userID)
}

// --- GetStats ---

func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.NotificationStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}

// --- Count ---

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// --- Helpers ---

func nowTimestamp() time.Time {
	return time.Now().UTC()
}

func newUUID() string {
	return uuid.New().String()
}
