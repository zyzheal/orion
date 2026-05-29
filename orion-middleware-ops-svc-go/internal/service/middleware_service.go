package service

import (
	"context"
	"errors"
	"time"
	"orion/middleware-ops-svc-go/internal/models"
	"orion/middleware-ops-svc-go/internal/repository"
	"github.com/google/uuid"
)

var (
	ErrInstanceNotFound = errors.New("middleware instance not found")
	ErrBackupNotFound   = errors.New("backup record not found")
)

type Service struct {
	instanceRepo *repository.InstanceRepository
	backupRepo   *repository.BackupRepository
}

func NewService(instanceRepo *repository.InstanceRepository, backupRepo *repository.BackupRepository) *Service {
	return &Service{instanceRepo: instanceRepo, backupRepo: backupRepo}
}

func (s *Service) CreateInstance(ctx context.Context, tenantID string, req *models.CreateInstanceRequest) (*models.MiddlewareInstance, error) {
	inst := &models.MiddlewareInstance{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		Name:     req.Name,
		Type:     req.Type,
		Version:  req.Version,
		Host:     req.Host,
		Port:     req.Port,
		Status:   "active",
		Config:   req.Config,
		Labels:   req.Labels,
	}
	if err := s.instanceRepo.Create(ctx, inst); err != nil { return nil, err }
	return inst, nil
}

func (s *Service) ListInstances(ctx context.Context, tenantID string, offset, limit int) ([]models.MiddlewareInstance, error) {
	return s.instanceRepo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetInstance(ctx context.Context, tenantID, id string) (*models.MiddlewareInstance, error) {
	return s.instanceRepo.GetByID(ctx, tenantID, id)
}

func (s *Service) UpdateInstance(ctx context.Context, tenantID, id string, req *models.CreateInstanceRequest) (*models.MiddlewareInstance, error) {
	inst, err := s.instanceRepo.GetByID(ctx, tenantID, id)
	if err != nil { return nil, ErrInstanceNotFound }
	inst.Name = req.Name
	inst.Type = req.Type
	inst.Version = req.Version
	inst.Host = req.Host
	inst.Port = req.Port
	inst.Config = req.Config
	inst.Labels = req.Labels
	if err := s.instanceRepo.Update(ctx, inst); err != nil { return nil, err }
	return inst, nil
}

func (s *Service) DeleteInstance(ctx context.Context, tenantID, id string) error {
	return s.instanceRepo.Delete(ctx, tenantID, id)
}

func (s *Service) CreateBackup(ctx context.Context, tenantID string, req *models.CreateBackupRequest) (*models.BackupRecord, error) {
	rec := &models.BackupRecord{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		InstanceID: req.InstanceID,
		Status:    "running",
		StartedAt: time.Now(),
	}
	if err := s.backupRepo.Create(ctx, rec); err != nil { return nil, err }
	return rec, nil
}

func (s *Service) ListBackupsByInstance(ctx context.Context, tenantID, instanceID string) ([]models.BackupRecord, error) {
	return s.backupRepo.ListByInstance(ctx, tenantID, instanceID)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.instanceRepo.Count(ctx, tenantID)
}
