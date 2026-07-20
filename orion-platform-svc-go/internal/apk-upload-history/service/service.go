package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"strings"

	"orion/platform-svc-go/internal/apk-upload-history/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, m *models.ApkUploadRecord) error
	ExistsByVersion(ctx context.Context, tenantID, market, packageName, version string) (bool, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.ApkUploadRecord, error)
	List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ApkUploadRecord, int, error)
	RecentFailures(ctx context.Context, tenantID string, limit int) ([]models.ApkUploadRecord, error)
	Stats(ctx context.Context, tenantID string) (*models.ApkUploadStats, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.ApkUploadRecord, error)
}

var (

	ErrBadRequest      = errors.New("invalid request parameters")
	ErrInvalidChecksum = errors.New("invalid checksum format")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetRecord(ctx context.Context, tenantID, id string) (*models.ApkUploadRecord, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) ListRecords(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ApkUploadRecord, int, error) {
	return s.repo.List(ctx, tenantID, q)
}

func (s *Service) RecentFailures(ctx context.Context, tenantID string) ([]models.ApkUploadRecord, error) {
	return s.repo.RecentFailures(ctx, tenantID, 100)
}

func (s *Service) CreateRecord(ctx context.Context, tenantID string, record *models.ApkUploadRecord) (*models.ApkUploadRecord, error) {
	if record.Market == "" {
		return nil, ErrBadRequest
	}
	if record.PackageName == "" {
		return nil, ErrBadRequest
	}
	if record.FileName == "" {
		return nil, ErrBadRequest
	}
	record.Status = models.StatusUploaded
	if record.Checksum != "" {
		if len(record.Checksum) < 8 {
			return nil, ErrInvalidChecksum
		}
	}
	if err := s.repo.Create(ctx, tenantID, record); err != nil {
		return nil, err
	}
	return record, nil
}

func (s *Service) UpdateStatus(ctx context.Context, tenantID, id string, status models.ApkStatus, errMsg string) (*models.ApkUploadRecord, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, sentinel.NotFound
	}
	if !isValidStatus(status) {
		return nil, ErrBadRequest
	}
	updates := map[string]interface{}{"status": string(status)}
	if errMsg != "" {
		updates["error_msg"] = errMsg
	}
	return s.repo.Update(ctx, tenantID, id, updates)
}

func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.ApkUploadStats, error) {
	return s.repo.Stats(ctx, tenantID)
}

func (s *Service) CheckDuplicate(ctx context.Context, tenantID, market, packageName, version string) (bool, error) {
	return s.repo.ExistsByVersion(ctx, tenantID, market, packageName, version)
}

func isValidStatus(status models.ApkStatus) bool {
	switch status {
	case models.StatusUploaded, models.StatusFailed, models.StatusPending:
		return true
	}
	return false
}

// ValidateChecksum checks if a hex checksum is valid.
func ValidateChecksum(checksum string) bool {
	c := strings.TrimSpace(checksum)
	if len(c) == 0 || len(c) < 8 {
		return false
	}
	for _, b := range c {
		if !((b >= '0' && b <= '9') || (b >= 'a' && b <= 'f') || (b >= 'A' && b <= 'F')) {
			return false
		}
	}
	return true
}
