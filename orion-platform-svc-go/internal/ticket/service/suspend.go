package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ticket/models"
	"orion/go-common/pkg/otel"
	"orion/platform-svc-go/internal/ticket/repository"

	"github.com/google/uuid"
)

type SuspendService struct {
	suspendRepo  repository.SuspendRepositoryInterface
	dispatchRepo repository.DispatchRepositoryInterface
	slaService   *SLAService
}

func NewSuspendService(suspendRepo repository.SuspendRepositoryInterface, dispatchRepo repository.DispatchRepositoryInterface, slaService *SLAService) *SuspendService {
	return &SuspendService{suspendRepo: suspendRepo, dispatchRepo: dispatchRepo, slaService: slaService}
}

// CreateSuspend creates a new suspension record
func (s *SuspendService) CreateSuspend(ctx context.Context, req *models.CreateSuspendRequest) (*models.SuspendRecord, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "SuspendService.CreateSuspend")
	defer span.End()

	// Validate reason
	valid := false
	for _, r := range models.ValidSuspendReasons {
		if r == req.Reason {
			valid = true
			break
		}
	}
	if !valid {
		return nil, fmt.Errorf("invalid suspend reason: %s", req.Reason)
	}

	startTime, err := time.Parse(time.RFC3339, req.StartTime)
	if err != nil {
		return nil, fmt.Errorf("invalid start_time: %w", err)
	}
	endTime, err := time.Parse(time.RFC3339, req.EndTime)
	if err != nil {
		return nil, fmt.Errorf("invalid end_time: %w", err)
	}

	record := &models.SuspendRecord{
		ID:                  uuid.New().String(),
		EngineerID:          req.EngineerID,
		Reason:              req.Reason,
		Status:              "pending",
		StartTime:           startTime,
		EndTime:             endTime,
		BackupEngineerID:    req.BackupEngineerID,
		AutoReassignPending: req.AutoReassignPending,
		PauseSLAForPending:  req.PauseSLAForPending,
		Notes:               req.Notes,
		CreatedBy:           req.CreatedBy,
	}

	if err := s.suspendRepo.Create(ctx, record); err != nil {
		return nil, err
	}
	return record, nil
}

// ActivateSuspend activates a pending suspension
func (s *SuspendService) ActivateSuspend(ctx context.Context, suspendID string) (*models.SuspendRecord, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "SuspendService.ActivateSuspend")
	defer span.End()

	record, err := s.suspendRepo.GetByID(ctx, suspendID)
	if err != nil {
		return nil, fmt.Errorf("suspension not found: %w", err)
	}

	if record.Status != "pending" {
		return nil, fmt.Errorf("cannot activate suspension in status: %s", record.Status)
	}

	record.Status = "active"
	record.ActivatedAt = timePtr(time.Now())

	if err := s.suspendRepo.Update(ctx, record); err != nil {
		return nil, err
	}

	// Mark engineer as unavailable
	eng, _ := s.dispatchRepo.GetEngineer(ctx, record.EngineerID)
	if eng != nil {
		eng.Availability = models.AvailabilityUnavailable
		s.dispatchRepo.UpdateEngineer(ctx, eng)
	}

	return record, nil
}

// EndSuspend ends an active suspension
func (s *SuspendService) EndSuspend(ctx context.Context, suspendID string) (*models.SuspendRecord, error) {
	record, err := s.suspendRepo.GetByID(ctx, suspendID)
	if err != nil {
		return nil, fmt.Errorf("suspension not found: %w", err)
	}

	if record.Status != "active" {
		return nil, fmt.Errorf("cannot end suspension in status: %s", record.Status)
	}

	record.Status = "ended"
	record.EndedAt = timePtr(time.Now())

	if err := s.suspendRepo.Update(ctx, record); err != nil {
		return nil, err
	}

	// Restore engineer availability
	eng, _ := s.dispatchRepo.GetEngineer(ctx, record.EngineerID)
	if eng != nil {
		eng.Availability = models.AvailabilityAvailable
		s.dispatchRepo.UpdateEngineer(ctx, eng)
	}

	return record, nil
}

// CancelSuspend cancels a pending suspension
func (s *SuspendService) CancelSuspend(ctx context.Context, suspendID string) (*models.SuspendRecord, error) {
	record, err := s.suspendRepo.GetByID(ctx, suspendID)
	if err != nil {
		return nil, fmt.Errorf("suspension not found: %w", err)
	}

	if record.Status != "pending" {
		return nil, fmt.Errorf("cannot cancel suspension in status: %s", record.Status)
	}

	record.Status = "cancelled"
	record.CancelledAt = timePtr(time.Now())

	if err := s.suspendRepo.Update(ctx, record); err != nil {
		return nil, err
	}
	return record, nil
}

// GetSuspend returns a suspension by ID
func (s *SuspendService) GetSuspend(ctx context.Context, suspendID string) (*models.SuspendRecord, error) {
	return s.suspendRepo.GetByID(ctx, suspendID)
}

// ListSuspensions lists suspensions by status
func (s *SuspendService) ListSuspensions(ctx context.Context, status string) ([]models.SuspendRecord, error) {
	return s.suspendRepo.ListByStatus(ctx, status)
}

// GetEngineerSuspensions returns all suspensions for an engineer
func (s *SuspendService) GetEngineerSuspensions(ctx context.Context, engineerID string) ([]models.SuspendRecord, error) {
	return s.suspendRepo.ListByEngineer(ctx, engineerID)
}

// GetSuspendImpact returns the impact of an engineer's suspension
func (s *SuspendService) GetSuspendImpact(ctx context.Context, engineerID string) (*models.SuspendImpact, error) {
	record, err := s.suspendRepo.FindActiveByEngineer(ctx, engineerID)
	if err != nil {
		return nil, fmt.Errorf("engineer not currently suspended")
	}

	pending, _ := s.suspendRepo.CountPendingByEngineer(ctx, engineerID)
	active, _ := s.suspendRepo.CountActiveByEngineer(ctx, engineerID)

	impact := &models.SuspendImpact{
		EngineerID:       engineerID,
		SuspendID:        record.ID,
		PendingTickets:   pending,
		ActiveTickets:    active,
		BackupEngineerID: record.BackupEngineerID,
	}

	return impact, nil
}
