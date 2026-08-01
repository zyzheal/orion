package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/notification/notification/models"
	"orion/platform-svc-go/internal/notification/notification/repository"
	"orion/go-common/pkg/otel"

	"go.uber.org/zap"
)

// ErrDNDNotFound is returned when DND settings lookup fails.
var ErrDNDNotFound = fmt.Errorf("DND settings not found")

// DNDService implements the do-not-disturb business logic.
type DNDService struct {
	repo     *repository.DNDRepository
	logger   *zap.Logger
	timeNow  func() time.Time // overridable for testing
}

// NewDNDService creates a new DNDService.
func NewDNDService(repo *repository.DNDRepository, logger *zap.Logger) *DNDService {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &DNDService{repo: repo, logger: logger, timeNow: time.Now}
}

// SetDND creates or updates DND settings for a user.
func (s *DNDService) SetDND(ctx context.Context, tenantID, userID string, startTime, endTime time.Time, reason *string) (*models.DoNotDisturb, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "DNDService.Set")
	defer span.End()

	if endTime.Before(startTime) || endTime.Equal(startTime) {
		return nil, fmt.Errorf("end_time must be after start_time")
	}

	dnd, err := s.repo.Upsert(ctx, tenantID, userID, startTime, endTime, reason)
	if err != nil {
		return nil, fmt.Errorf("failed to set DND: %w", err)
	}
	return dnd, nil
}

// ClearDND removes DND settings for a user.
func (s *DNDService) ClearDND(ctx context.Context, tenantID, userID string) error {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "DNDService.Clear")
	defer span.End()

	ok, err := s.repo.DeleteByUser(ctx, tenantID, userID)
	if err != nil {
		return fmt.Errorf("failed to clear DND: %w", err)
	}
	if !ok {
		return ErrDNDNotFound
	}
	return nil
}

// IsDndActive checks if DND is currently active for a user.
// Auto-clears expired DND settings.
func (s *DNDService) IsDndActive(ctx context.Context, tenantID, userID string) (bool, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "DNDService.IsActive")
	defer span.End()

	dnd, err := s.repo.FindByUser(ctx, tenantID, userID)
	if err != nil {
		return false, nil // No DND settings = not active
	}

	now := s.timeNow()
	active := now.After(dnd.StartTime) && now.Before(dnd.EndTime)
	if !active && now.After(dnd.EndTime) {
		// Auto-clear expired DND
		if _, err := s.repo.DeleteByUser(ctx, tenantID, userID); err != nil {
			s.logger.Warn("failed to auto-clear expired DND", zap.Error(err), zap.String("user_id", userID))
		}
		return false, nil
	}
	return active, nil
}

// GetDndSettings returns DND settings for a user.
func (s *DNDService) GetDndSettings(ctx context.Context, tenantID, userID string) (*models.DoNotDisturb, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "DNDService.Get")
	defer span.End()

	dnd, err := s.repo.FindByUser(ctx, tenantID, userID)
	if err != nil {
		return nil, ErrDNDNotFound
	}
	return dnd, nil
}

// GetActiveUsers returns all user IDs with currently active DND settings.
func (s *DNDService) GetActiveUsers(ctx context.Context, tenantID string) ([]string, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "DNDService.GetActiveUsers")
	defer span.End()

	users, err := s.repo.FindActiveUsers(ctx, tenantID, s.timeNow())
	if err != nil {
		return nil, fmt.Errorf("failed to get active users: %w", err)
	}
	return users, nil
}

// NewDNDServiceWithLogger creates a new DNDService with a logger (for compatibility).
func NewDNDServiceWithLogger(repo *repository.DNDRepository, logger *zap.Logger) *DNDService {
	return NewDNDService(repo, logger)
}
