package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/monitoring/internal/alert-silence/models"
	"orion/platform-svc-go/internal/monitoring/internal/alert-silence/repository"
	"go.uber.org/zap"
)

type AlertSilenceService struct {
	repo   *repository.AlertSilenceRepository
	logger *zap.Logger
}

func NewAlertSilenceService(repo *repository.AlertSilenceRepository, logger *zap.Logger) *AlertSilenceService {
	return &AlertSilenceService{repo: repo, logger: logger}
}

// CreateSilence creates a new silence.
func (s *AlertSilenceService) CreateSilence(ctx context.Context, tenantID uuid.UUID, req *models.CreateSilenceRequest, createdBy string) (*models.Silence, error) {
	if req.Duration < 60 {
		return nil, fmt.Errorf("duration must be at least 60 seconds")
	}
	if len(req.Reason) > 500 {
		return nil, fmt.Errorf("reason must be at most 500 characters")
	}

	silence, err := s.repo.Create(ctx, tenantID, req.AlertID, req.Matcher, req.Duration, req.Reason, createdBy)
	if err != nil {
		s.logger.Error("failed to create silence",
			zap.String("tenantId", tenantID.String()),
			zap.Error(err),
		)
		return nil, err
	}

	s.logger.Info("silence created",
		zap.String("silenceId", silence.ID.String()),
		zap.String("tenantId", tenantID.String()),
		zap.Int("duration", silence.Duration),
	)
	return silence, nil
}

// QuerySilences returns paginated silences.
func (s *AlertSilenceService) QuerySilences(ctx context.Context, tenantID uuid.UUID, status string, limit, offset int) (models.SilenceResponse, error) {
	return s.repo.Query(ctx, tenantID, status, limit, offset)
}

// GetSilence returns a single silence.
func (s *AlertSilenceService) GetSilence(ctx context.Context, tenantID, id uuid.UUID) (*models.Silence, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// DeleteSilence removes a silence.
func (s *AlertSilenceService) DeleteSilence(ctx context.Context, tenantID, id uuid.UUID) error {
	if err := s.repo.Delete(ctx, tenantID, id); err != nil {
		s.logger.Error("failed to delete silence",
			zap.String("silenceId", id.String()),
			zap.Error(err),
		)
		return err
	}
	s.logger.Info("silence deleted", zap.String("silenceId", id.String()))
	return nil
}

// IsSilenced checks if an alert is currently silenced.
func (s *AlertSilenceService) IsSilenced(ctx context.Context, tenantID, alertID uuid.UUID) (bool, error) {
	return s.repo.IsActive(ctx, tenantID, alertID)
}

// ExtendSilence extends the duration of an existing silence.
func (s *AlertSilenceService) ExtendSilence(ctx context.Context, tenantID, id uuid.UUID, extendBy int) (*models.Silence, error) {
	silence, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}

	if extendBy < 60 {
		return nil, fmt.Errorf("extension must be at least 60 seconds")
	}

err = s.repo.Extend(ctx, tenantID, id, extendBy)
	if err != nil {
		return nil, fmt.Errorf("extend silence: %w", err)
	}


	s.logger.Info("silence extended",
		zap.String("silenceId", id.String()),
		zap.Int("extendBy", extendBy),
	)
	return silence, nil
}
