package service

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/go-common/pkg/otel"
	"orion/platform-svc-go/internal/ticketing/repository"
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

	created, err := s.slaRepo.CreateTarget(ctx, req)
	if err != nil {
		return nil, err
	}
	return created, nil
}

// CreateRecordForTicket creates an SLA record when a ticket is created
func (s *SLAService) CreateRecordForTicket(ctx context.Context, ticketID, priority string) error {
	return s.slaRepo.CreateRecordForTicket(ctx, ticketID, priority)
}

// GetTicketSLA returns the SLA record for a ticket
func (s *SLAService) GetTicketSLA(ctx context.Context, ticketID string) (*models.SLARecord, error) {
	tracking, err := s.slaRepo.GetSLATracking(ctx, ticketID, ticketID)
	if tracking == nil { return nil, errors.New("sla record not found") }
	if err != nil {
		return nil, err
	}
	return &models.SLARecord{
		TicketID: ticketID,
		SLATargetID: 0,
		Priority: tracking.Priority,
	}, nil
}

// MarkResponded marks a ticket as responded (SLA response met)
func (s *SLAService) MarkResponded(ctx context.Context, ticketID string) error {
	return s.slaRepo.UpdateSLATracking(ctx, ticketID, map[string]interface{}{
		"response_ok": true,
	})
}

// MarkResolved marks a ticket as resolved (SLA resolution met)
func (s *SLAService) MarkResolved(ctx context.Context, ticketID string) error {
	return s.slaRepo.UpdateSLATracking(ctx, ticketID, map[string]interface{}{
		"resolution_ok": true,
	})
}

// PauseSLA pauses SLA tracking for a ticket
func (s *SLAService) PauseSLA(ctx context.Context, ticketID, reason string) error {
	return s.slaRepo.UpdateSLATracking(ctx, ticketID, map[string]interface{}{
		"paused": true,
		"paused_reason": reason,
	})
}

// UnpauseSLA resumes SLA tracking
func (s *SLAService) UnpauseSLA(ctx context.Context, ticketID string) error {
	return s.slaRepo.UpdateSLATracking(ctx, ticketID, map[string]interface{}{
		"paused": false,
	})
}

// CheckBreaches checks all pending SLA records for breaches
func (s *SLAService) CheckBreaches(ctx context.Context) ([]models.SLARecord, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "SLAService.CheckBreaches")
	defer span.End()

	records, err := s.slaRepo.FindBreachedRecords(ctx)
	if err != nil {
		return nil, err
	}

	now := time.Time{}
	var breached []models.SLARecord
	for _, rec := range records {
		if rec.ResolutionDeadlineAt != nil && now.After(*rec.ResolutionDeadlineAt) {
			rec.Breached = true
			rec.BreachType = "resolution"
			_ = s.slaRepo.UpdateRecord(ctx, &rec)
			breached = append(breached, rec)
		} else if rec.RespondedAt == nil && rec.ResponseDeadlineAt != nil && now.After(*rec.ResponseDeadlineAt) {
			rec.Breached = true
			rec.BreachType = "response"
			_ = s.slaRepo.UpdateRecord(ctx, &rec)
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
