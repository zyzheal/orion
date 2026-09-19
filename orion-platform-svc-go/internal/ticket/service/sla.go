package service

import (
	"context"
	"fmt"
	"time"

	"orion/go-common/pkg/otel"
	"orion/platform-svc-go/internal/ticket/models"
	"orion/platform-svc-go/internal/ticket/repository"

	"github.com/google/uuid"
)

type SLAService struct {
	slaRepo    repository.SLARepositoryInterface
	ticketRepo repository.TicketRepositoryInterface
}

func NewSLAService(slaRepo repository.SLARepositoryInterface, ticketRepo repository.TicketRepositoryInterface) *SLAService {
	return &SLAService{slaRepo: slaRepo, ticketRepo: ticketRepo}
}

// CreateTarget creates a new SLA target owned by tenantID
func (s *SLAService) CreateTarget(ctx context.Context, tenantID string, req *models.CreateSLATargetRequest) (*models.SLATarget, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "SLAService.CreateTarget")
	defer span.End()

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	// TenantID has to be set here rather than left to the caller: the INSERT
	// writes whatever the struct holds, and a zero value would store an empty
	// owner that matches no tenant_id predicate.
	target := &models.SLATarget{
		ID:                     req.ID,
		TenantID:               tenantID,
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
func (s *SLAService) CreateRecordForTicket(ctx context.Context, tenantID, ticketID, priority string) error {
	target, err := s.slaRepo.GetTargetByPriority(ctx, tenantID, priority)
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

// GetTicketSLA returns the SLA record for a ticket of tenantID
func (s *SLAService) GetTicketSLA(ctx context.Context, tenantID, ticketID string) (*models.SLARecord, error) {
	return s.slaRepo.GetRecordByTicket(ctx, tenantID, ticketID)
}

// MarkResponded marks a ticket as responded (SLA response met)
func (s *SLAService) MarkResponded(ctx context.Context, tenantID, ticketID string) error {
	record, err := s.slaRepo.GetRecordByTicket(ctx, tenantID, ticketID)
	if err != nil {
		return nil // no SLA record
	}
	record.RespondedAt = timePtr(time.Now())
	return s.slaRepo.UpdateRecord(ctx, record)
}

// MarkResolved marks a ticket as resolved (SLA resolution met)
func (s *SLAService) MarkResolved(ctx context.Context, tenantID, ticketID string) error {
	record, err := s.slaRepo.GetRecordByTicket(ctx, tenantID, ticketID)
	if err != nil {
		return nil
	}
	record.ResolvedAt = timePtr(time.Now())
	return s.slaRepo.UpdateRecord(ctx, record)
}

// PauseSLA pauses SLA tracking for a ticket
func (s *SLAService) PauseSLA(ctx context.Context, tenantID, ticketID, reason string) error {
	return s.slaRepo.PauseRecord(ctx, tenantID, ticketID, reason)
}

// UnpauseSLA resumes SLA tracking
func (s *SLAService) UnpauseSLA(ctx context.Context, tenantID, ticketID string) error {
	return s.slaRepo.UnpauseRecord(ctx, tenantID, ticketID)
}

// CheckBreaches checks this tenant's pending SLA records for breaches
func (s *SLAService) CheckBreaches(ctx context.Context, tenantID string) ([]models.SLARecord, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "SLAService.CheckBreaches")
	defer span.End()

	// FindPendingRecords is scoped to tenantID: the previous call had no
	// tenant predicate at all, so a request from one tenant marked every other
	// tenant's overdue record breached and returned those rows. tenantID is
	// threaded here rather than read from the record because sla_records has no
	// tenant column to filter on after the fact.
	records, err := s.slaRepo.FindPendingRecords(ctx, tenantID)
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

// GetComplianceReport returns SLA compliance statistics for tenantID
func (s *SLAService) GetComplianceReport(ctx context.Context, tenantID string, start, end time.Time) (*models.SLAComplianceReport, error) {
	// Zero bounds are a deliberate request for the default one month window,
	// so they are filled in here and never forwarded to the repository: a
	// BETWEEN '0001-01-01' AND '0001-01-01' would match nothing and the route
	// would report an empty compliance figure no matter what the data said.
	if start.IsZero() {
		start = time.Now().AddDate(0, -1, 0)
	}
	if end.IsZero() {
		end = time.Now()
	}
	return s.slaRepo.GetComplianceReport(ctx, tenantID, start, end)
}

func timePtr(t time.Time) *time.Time {
	return &t
}
