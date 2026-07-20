package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/ueba/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateAlert(ctx context.Context, tenantID string, req *models.CreateAlertRequest) (*models.UEBAAlert, error)
	GetAlertByID(ctx context.Context, id, tenantID string) (*models.UEBAAlert, error)
	GetProfile(ctx context.Context, tenantID, entityID string) (*models.UEBAProfile, error)
	ListAlerts(ctx context.Context, tenantID string, q models.ListAlertsQuery) ([]models.UEBAAlert, error)
	ListProfiles(ctx context.Context, tenantID string) ([]models.UEBAProfile, error)
	SaveProfile(ctx context.Context, tenantID, userID, entityType, entityID, profileData string) error
	UpdateAlertStatus(ctx context.Context, id, tenantID, status string, reviewedAt *time.Time) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListAlerts(ctx context.Context, tenantID string, q models.ListAlertsQuery) ([]models.UEBAAlert, error) {
	return s.repo.ListAlerts(ctx, tenantID, q)
}

func (s *Service) GetAlert(ctx context.Context, id, tenantID string) (*models.UEBAAlert, error) {
	return s.repo.GetAlertByID(ctx, id, tenantID)
}

func (s *Service) CreateAlert(ctx context.Context, tenantID string, req *models.CreateAlertRequest) (*models.UEBAAlert, error) {
	return s.repo.CreateAlert(ctx, tenantID, req)
}

func (s *Service) DismissAlert(ctx context.Context, id, tenantID string, req *models.DismissAlertRequest) error {
	now := time.Now().UTC()
	return s.repo.UpdateAlertStatus(ctx, id, tenantID, "dismissed", &now)
}

func (s *Service) ListProfiles(ctx context.Context, tenantID string) ([]models.UEBAProfile, error) {
	return s.repo.ListProfiles(ctx, tenantID)
}

func (s *Service) GetProfile(ctx context.Context, tenantID, entityID string) (*models.UEBAProfile, error) {
	return s.repo.GetProfile(ctx, tenantID, entityID)
}

func (s *Service) SaveProfile(ctx context.Context, tenantID, userID, entityType, entityID, profileData string) error {
	return s.repo.SaveProfile(ctx, tenantID, userID, entityType, entityID, profileData)
}

func (s *Service) DetectAnomaly(ctx context.Context, tenantID string, req *models.DetectAnomalyRequest) (*models.CreateAlertRequest, error) {
	profile, err := s.repo.GetProfile(ctx, tenantID, req.EntityID)
	if err != nil && !IsNotFound(err) {
		return nil, err
	}

	score := 0.0
	for _, event := range req.Events {
		switch event {
		case "login":
			score += 0.3
		case "access_sensitive":
			score += 0.5
		case "export_data":
			score += 0.8
		default:
			score += 0.2
		}
	}
	if profile != nil {
		score *= 0.9
	}

	severity := "low"
	if score > 0.7 {
		severity = "critical"
	} else if score > 0.5 {
		severity = "high"
	} else if score > 0.3 {
		severity = "medium"
	}

	severityPtr := &severity
	alertReq := &models.CreateAlertRequest{
		UserID:      req.UserID,
		EntityType:  req.EntityType,
		EntityID:    req.EntityID,
		EventType:   "anomaly_detected",
		Severity:    severityPtr,
		AnomalyType: "behavior_deviation",
	}
	return alertReq, nil
}

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}
