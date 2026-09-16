package service

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/go-common/pkg/otel"
	"orion/platform-svc-go/internal/ticketing/models"
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

// GetTicketSLA returns the SLA record for a ticket.
//
// sla_records holds the deadlines. The old implementation read
// ticket_sla_tracking through GetSLATracking and returned a synthetic
// models.SLARecord carrying only TicketID and Priority, with SLATargetID: 0 and
// every deadline left zero, so a caller could never tell whether the ticket was
// inside its SLA. It also passed ticketID into the tenantID slot, and it checked
// tracking == nil before err != nil, so a query failure was answered with "not
// found" instead of the real error. internal/ticket's parallel GetTicketSLA
// reads the real record.
func (s *SLAService) GetTicketSLA(ctx context.Context, ticketID string) (*models.SLARecord, error) {
	record, err := s.slaRepo.GetRecordByTicket(ctx, ticketID)
	if err != nil {
		// sql.ErrNoRows means the ticket has no sla_records row at all, which is
		// normal for a priority with no SLA target. Keep the sentinel-free error
		// text the handler answers 404 with; anything else is a real failure.
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("sla record not found")
		}
		return nil, err
	}
	return record, nil
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

	// FindPendingRecords, not FindBreachedRecords: the breached query already
	// filters "WHERE breached = true", so it can only re-stamp rows that are
	// already marked and can never surface a record whose deadline just
	// passed. It also excludes paused records, which must not accrue breach
	// time. This is what internal/ticket's parallel CheckBreaches does.
	records, err := s.slaRepo.FindPendingRecords(ctx)
	if err != nil {
		return nil, err
	}

	// The zero time makes every now.After(...) call false, so the loop never
	// marked anything and GET /tickets/sla/breaches always answered
	// {"breaches": [], "count": 0} no matter how many records were overdue.
	now := time.Now().UTC()
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
