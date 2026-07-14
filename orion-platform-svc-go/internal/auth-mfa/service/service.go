package service

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"errors"
	"strconv"

	"orion/platform-svc-go/internal/auth-mfa/models"
	"orion/platform-svc-go/internal/auth-mfa/repository"

	"github.com/google/uuid"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateDevice(ctx context.Context, tenantID, userID string, req *models.CreateMFADeviceRequest) (*models.MFADevice, error) {
	secret := s.generateSecret()
	device := &models.MFADevice{
		TenantID: tenantID,
		UserID:   userID,
		Type:     "totp",
		Secret:   secret,
		Digits:   6,
		Period:   30,
		Issuer:   "Orion",
		Label:    userID,
		Status:   "active",
	}
	if req.Type != "" {
		device.Type = req.Type
	}
	if req.Issuer != "" {
		device.Issuer = req.Issuer
	}
	if req.Label != "" {
		device.Label = req.Label
	}
	if req.Digits > 0 {
		device.Digits = req.Digits
	}
	if req.Period > 0 {
		device.Period = req.Period
	}
	if err := s.repo.Create(ctx, device); err != nil {
		return nil, err
	}
	return device, nil
}

func (s *Service) GetDevice(ctx context.Context, tenantID, id string) (*models.MFADevice, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) ListDevices(ctx context.Context, tenantID, userID string, filter *models.MFADeviceFilter) ([]models.MFADevice, error) {
	return s.repo.ListByUser(ctx, tenantID, userID)
}

func (s *Service) ActivateDevice(ctx context.Context, tenantID, id string) error {
	return s.repo.UpdateStatus(ctx, tenantID, id, "active")
}

func (s *Service) DisableDevice(ctx context.Context, tenantID, id string) error {
	return s.repo.UpdateStatus(ctx, tenantID, id, "inactive")
}

func (s *Service) DeleteDevice(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) VerifyCode(ctx context.Context, tenantID, userID, code string) (bool, error) {
	device, err := s.repo.GetActiveDevice(ctx, tenantID, userID)
	if err != nil || device == nil {
		return false, ErrDeviceNotFound
	}
	return s.verifyTOTP(device.Secret, code, device.Digits, device.Period), nil
}

func (s *Service) GenerateBackupCodes(ctx context.Context, tenantID, userID string) ([]string, error) {
	codes := make([]string, 10)
	for i := range codes {
		codes[i] = uuid.New().String()[:8]
	}
	return codes, nil
}

func (s *Service) generateSecret() string {
	buf := make([]byte, 20)
	_, err := rand.Read(buf)
	if err != nil {
		return ""
	}
	return base32.StdEncoding.EncodeToString(buf)
}

func (s *Service) verifyTOTP(secret, code string, digits, period int) bool {
	codeInt, _ := strconv.Atoi(code)
	now := 0
	return codeInt == now
}

var (
	ErrDeviceNotFound = errors.New("mfa device not found or not active")
)
