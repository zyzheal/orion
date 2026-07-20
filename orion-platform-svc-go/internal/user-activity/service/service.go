package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/user-activity/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateActivity(ctx context.Context, a *models.UserActivity) error
	DeleteActivity(ctx context.Context, userID, activityID string) error
	GetActivities(ctx context.Context, userID string, limit, offset int) ([]models.UserActivity, error)
	GetActivityByID(ctx context.Context, userID, activityID string) (*models.UserActivity, error)
	GetActivityCount(ctx context.Context, userID string) (int, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// GetActivities returns paginated activities for a user.
func (s *Service) GetActivities(ctx context.Context, userID string, page, pageSize int) (*models.ActivitiesResponse, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset := (page - 1) * pageSize

	activities, err := s.repo.GetActivities(ctx, userID, pageSize, offset)
	if err != nil {
		return nil, err
	}

	total, err := s.repo.GetActivityCount(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &models.ActivitiesResponse{
		Data:     activities,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// CreateActivity logs a new user activity.
func (s *Service) CreateActivity(ctx context.Context, userID, action, resourceType, resourceID string, details any, ipAddress, userAgent string) (*models.UserActivity, error) {
	a := &models.UserActivity{
		ID:           uuid.New().String(),
		UserID:       userID,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Details:      details,
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
		CreatedAt:    time.Now().UTC(),
	}
	if err := s.repo.CreateActivity(ctx, a); err != nil {
		return nil, err
	}
	return a, nil
}

// GetActivity returns a single activity by ID.
func (s *Service) GetActivity(ctx context.Context, userID, activityID string) (*models.UserActivity, error) {
	a, err := s.repo.GetActivityByID(ctx, userID, activityID)
	if err != nil {
		return nil, errors.New("activity not found")
	}
	return a, nil
}

// DeleteActivity deletes an activity by ID.
func (s *Service) DeleteActivity(ctx context.Context, userID, activityID string) error {
	return s.repo.DeleteActivity(ctx, userID, activityID)
}
