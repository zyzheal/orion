package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/go-common/pkg/otel"
	"orion/platform-svc-go/internal/ticketing/repository"

	"github.com/google/uuid"
)

type SLAService struct {
	slaRepo    repository.SLARepositoryInterface
	ticketRepo repository.TicketRepositoryInterface
}

func NewSLAService(slaRepo repository.SLARepositoryInterface, ticketRepo repository.TicketRepositoryInterface) *SLAService {
	return &SLAService{slaRepo: slaRepo, ticketRepo: ticketRepo}
}

// CreateTarget creates a new SLA target
func (s *SLAService) CreateTarget(ctx context.Context, req *models.CreateSLATargetRequest) (*models.SLATarget, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "SLAService.CreateTarget")
	defer span.End()

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	target := &models.SLATarget{
		ID:                     req.ID,
		Name:                   req.Name,
		Priority:               req.Priority,
		TargetResponseTimeMs:   req.TargetResponseTimeMs,
		TargetResolutionTimeMs: req.TargetResolutionTimeMs,
		Enabled:                enabled,
	}
	if target.ID == "" {
		target.ID = fmt.Sprintf("sla-%d", time.Now().UnixMilli())
	}

	if err := s.slaRepo.CreateTarget(ctx, target); err != nil {
		return nil, err
	}
	return target, nil
}

// CreateRecordForTicket creates an SLA record when a ticket is created
func (s *SLAService) CreateRecordForTicket(ctx context.Context, ticketID, priority string) error {
	target, err := s.slaRepo.GetTargetByPriority(ctx, priority)
	if err != nil {
		return nil // no SLA target for this priority, skip
	}

	now := time.Now()
	record := &models.SLARecord{
		ID:                   uuid.New().String(),
		TicketID:             ticketID,
		SLATargetID:          target.ID,
		Priority:             priority,
		ResponseDeadlineAt:   now.Add(time.Duration(target.TargetResponseTimeMs) * time.Millisecond),
		ResolutionDeadlineAt: now.Add(time.Duration(target.TargetResolutionTimeMs) * time.Millisecond),
	}

	return s.slaRepo.CreateRecord(ctx, record)
}

// GetTicketSLA returns the SLA record for a ticket
func (s *SLAService) GetTicketSLA(ctx context.Context, ticketID string) (*models.SLARecord, error) {
	return s.slaRepo.GetRecordByTicket(ctx, ticketID)
}

// MarkResponded marks a ticket as responded (SLA response met)
func (s *SLAService) MarkResponded(ctx context.Context, ticketID string) error {
	record, err := s.slaRepo.GetRecordByTicket(ctx, ticketID)
	if err != nil {
		return nil // no SLA record
	}
	record.RespondedAt = timePtr(time.Now())
	return s.slaRepo.UpdateRecord(ctx, record)
}

// MarkResolved marks a ticket as resolved (SLA resolution met)
func (s *SLAService) MarkResolved(ctx context.Context, ticketID string) error {
	record, err := s.slaRepo.GetRecordByTicket(ctx, ticketID)
	if err != nil {
		return nil
	}
	record.ResolvedAt = timePtr(time.Now())
	return s.slaRepo.UpdateRecord(ctx, record)
}

// PauseSLA pauses SLA tracking for a ticket
func (s *SLAService) PauseSLA(ctx context.Context, ticketID, reason string) error {
	return s.slaRepo.PauseRecord(ctx, ticketID, reason)
}

// UnpauseSLA resumes SLA tracking
func (s *SLAService) UnpauseSLA(ctx context.Context, ticketID string) error {
	return s.slaRepo.UnpauseRecord(ctx, ticketID)
}

// CheckBreaches checks all pending SLA records for breaches
func (s *SLAService) CheckBreaches(ctx context.Context) ([]models.SLARecord, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "SLAService.CheckBreaches")
	defer span.End()

	records, err := s.slaRepo.FindPendingRecords(ctx, )
	if err != nil {
		return nil, err
	}

	now := time.Now()
	var breached []models.SLARecord
	for _, rec := range records {
		if now.After(rec.ResolutionDeadlineAt) {
			rec.Breached = true
			rec.BreachType = "resolution"
			s.slaRepo.UpdateRecord(ctx, &rec)
			breached = append(breached, rec)
		} else if rec.RespondedAt == nil && now.After(rec.ResponseDeadlineAt) {
			rec.Breached = true
			rec.BreachType = "response"
			s.slaRepo.UpdateRecord(ctx, &rec)
			breached = append(breached, rec)
		}
	}

	return breached, nil
}

// GetComplianceReport returns SLA compliance statistics
func (s *SLAService) GetComplianceReport(ctx context.Context, start, end time.Time) (*models.SLAComplianceReport, error) {
	if start.IsZero() {
		start = time.Now().AddDate(0, -1, 0)
	}
	if end.IsZero() {
		end = time.Now()
	}
	return s.slaRepo.GetComplianceReport(ctx, start, end)
}

func timePtr(t time.Time) *time.Time {
	return &t
}
