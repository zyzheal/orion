package service

import (
	"context"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/inspection/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error)
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Record, error)
	List(ctx context.Context, tenantID string) ([]models.Record, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Record, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Update(ctx, tenantID, id, req)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// RunInspection creates a new inspection record with "running" status.
func (s *Service) RunInspection(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	rec, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return map[string]interface{}{"status": "ok", "inspectionId": id}, nil
	}
	rec.Status = "running"
	_, err = s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "running"})
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"status": "running", "inspectionId": id}, nil
}

// GetResults returns the current state of an inspection record.
func (s *Service) GetResults(ctx context.Context, tenantID, id string) ([]models.Record, error) {
	rec, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return []models.Record{}, nil
	}
	return []models.Record{*rec}, nil
}

// UpdateStatus transitions an inspection record to a new status.
func (s *Service) UpdateStatus(ctx context.Context, tenantID, id string, status string) (map[string]interface{}, error) {
	_, err := s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: status})
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"status": "ok", "newStatus": status}, nil
}

// ListTemplates returns all inspection records for the tenant (same as List).
func (s *Service) ListTemplates(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

// GetStats computes aggregate statistics from inspection records.
func (s *Service) GetStats(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	stats := map[string]interface{}{
		"total":  len(records),
		"passed": 0,
		"failed": 0,
		"warnings": 0,
		"running": 0,
	}
	for _, r := range records {
		switch r.Status {
		case "passed", "passed":
			stats["passed"] = stats["passed"].(int) + 1
		case "failed":
			stats["failed"] = stats["failed"].(int) + 1
		case "warning", "warned":
			stats["warnings"] = stats["warnings"].(int) + 1
		case "running", "pending":
			stats["running"] = stats["running"].(int) + 1
		}
	}
	return stats, nil
}

// GetHistory returns inspection record names as a history timeline.
func (s *Service) GetHistory(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return []string{}, nil
	}
	names := make([]string, len(records))
	for i, r := range records {
		names[i] = r.ID + ":" + r.Name
	}
	return names, nil
}

// BatchCreate creates multiple inspection records.
func (s *Service) BatchCreate(ctx context.Context, tenantID string, items []models.CreateRequest) (map[string]interface{}, error) {
	created := 0
	errors := make([]string, 0)
	for _, item := range items {
		if _, err := s.repo.Create(ctx, tenantID, item); err != nil {
			errors = append(errors, fmt.Sprintf("%s: %v", item.Name, err))
		} else {
			created++
		}
	}
	return map[string]interface{}{
		"status":  "ok",
		"created": created,
		"errors":  strings.Join(errors, "; "),
	}, nil
}