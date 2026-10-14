package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/alert-shift/models"
	"orion/platform-svc-go/internal/eventpublisher"
	"orion/platform-svc-go/internal/auditlogger"
	"orion/platform-svc-go/internal/alert-shift/repository"
)

// Repository defines the data access interface.
type Repository interface {
	CreateShift(ctx context.Context, s *models.Shift) error
	GetShift(ctx context.Context, tenantID, id string) (*models.Shift, error)
	ListShifts(ctx context.Context, tenantID string, page, pageSize int) ([]models.Shift, int, error)
	UpdateShift(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteShift(ctx context.Context, tenantID, id string) (bool, error)
	CreateAssignment(ctx context.Context, a *models.Assignment) error
	ListAssignments(ctx context.Context, tenantID, shiftID string) ([]models.Assignment, error)
	WithTx(ctx context.Context, fn func(rtx *repository.Repository) error) error
}

type Service struct {
	repo   Repository
	logger *zap.Logger
	events eventpublisher.EventPublisher
	auditor auditlogger.AuditLogger
}

func NewService(repo Repository, logger *zap.Logger) *Service {
	return &Service{repo: repo, logger: logger}
}

// SetPublisher attaches an event publisher for domain events.
func (s *Service) SetPublisher(p eventpublisher.EventPublisher) {
	s.events = p
}

// SetAuditLogger attaches an audit logger for recording mutations.
func (s *Service) SetAuditLogger(l auditlogger.AuditLogger) {
	s.auditor = l
}

func (s *Service) CreateShift(ctx context.Context, tenantID string, req *models.CreateShiftRequest) (*models.Shift, error) {
	if tenantID == "" {
		tenantID = "default"
	}
	if req.TenantID != nil {
		tenantID = *req.TenantID
	}
	if req.Pattern == "" {
		req.Pattern = "round_robin"
	}
	if !req.Enabled {
		req.Enabled = true
	}
	if req.Weekdays == nil {
		req.Weekdays = []int{1, 2, 3, 4, 5}
	}

	now := time.Now().UTC()
	shift := &models.Shift{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Name:      req.Name,
		Team:      req.Team,
		Pattern:   req.Pattern,
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
		Weekdays:  req.Weekdays,
		Enabled:   req.Enabled,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.repo.CreateShift(ctx, shift); err != nil {
		return nil, fmt.Errorf("create shift: %w", err)
	}
	if s.events != nil {
		_ = s.events.Publish(ctx, "alert.shift.created", tenantID, map[string]any{"id": shift.ID, "name": shift.Name})
		if s.auditor != nil {
			_ = s.auditor.Log(ctx, auditlogger.AuditEntry{Action: "create", TenantID: tenantID, ResourceType: "alert.shift", ResourceID: shift.ID, Details: map[string]any{"name": shift.Name}})
		}}
	return shift, nil
}

func (s *Service) GetShift(ctx context.Context, tenantID, id string) (*models.Shift, error) {
	return s.repo.GetShift(ctx, tenantID, id)
}

func (s *Service) ListShifts(ctx context.Context, tenantID string, page, pageSize int) ([]models.Shift, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return s.repo.ListShifts(ctx, tenantID, page, pageSize)
}

func (s *Service) UpdateShift(ctx context.Context, tenantID, id string, req *models.UpdateShiftRequest) (*models.Shift, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Team != nil {
		updates["team"] = *req.Team
	}
	if req.Pattern != nil {
		updates["pattern"] = *req.Pattern
	}
	if req.StartTime != nil {
		updates["start_time"] = *req.StartTime
	}
	if req.EndTime != nil {
		updates["end_time"] = *req.EndTime
	}
	if req.Weekdays != nil {
		updates["weekdays"] = req.Weekdays
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}
	var result *models.Shift
	if err := s.repo.WithTx(ctx, func(rtx *repository.Repository) error {
		if err := rtx.UpdateShift(ctx, tenantID, id, updates); err != nil {
			return err
		}
		item, err := rtx.GetShift(ctx, tenantID, id)
		if err != nil {
			return err
		}
		result = item
		return nil
	}); err != nil {
		return nil, err
	}
	if s.auditor != nil {
		_ = s.auditor.Log(ctx, auditlogger.AuditEntry{Action: "update", TenantID: tenantID, ResourceType: "alert.shift", ResourceID: id, Details: map[string]any{"fields": updates}})
	}
	return result, nil
}

func (s *Service) DeleteShift(ctx context.Context, tenantID, id string) (bool, error) {
	ok, err := s.repo.DeleteShift(ctx, tenantID, id)
	if err != nil {
		return false, err
	}
	if ok && s.events != nil {
		_ = s.events.Publish(ctx, "alert.shift.deleted", tenantID, map[string]any{"id": id})
		if s.auditor != nil {
			_ = s.auditor.Log(ctx, auditlogger.AuditEntry{Action: "delete", TenantID: tenantID, ResourceType: "alert.shift", ResourceID: id})
		}}
	return ok, nil
}

func (s *Service) ListAssignments(ctx context.Context, tenantID, shiftID string) ([]models.Assignment, error) {
	return s.repo.ListAssignments(ctx, tenantID, shiftID)
}

func (s *Service) CreateAssignment(ctx context.Context, tenantID, shiftID string, req *models.CreateAssignmentRequest) (*models.Assignment, error) {
	role := req.Role
	if role == "" {
		role = "primary"
	}
	assignment := &models.Assignment{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		ShiftID:   shiftID,
		UserID:    req.UserID,
		Role:      role,
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
		Assigned:  true,
		CreatedAt: time.Now().UTC(),
	}
	if err := s.repo.CreateAssignment(ctx, assignment); err != nil {
		return nil, fmt.Errorf("create assignment: %w", err)
	}
	return assignment, nil
}
