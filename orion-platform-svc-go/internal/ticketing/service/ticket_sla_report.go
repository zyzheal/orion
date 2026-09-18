package service

import (
	"context"

	"sort"

	"time"

	"orion/platform-svc-go/internal/ticketing/models"
)

func (s *Service) AddSLATarget(ctx context.Context, tenantID string, req models.CreateSLATargetRequest) (*models.SLATarget, error) {
	return s.repo.CreateSLATarget(ctx, tenantID, req)
}

func (s *Service) GetTicketSLA(ctx context.Context, tenantID, ticketID string) (*models.TicketSLAStatus, error) {
	tracking, err := s.repo.GetSLATracking(ctx, tenantID, ticketID)
	if err != nil {
		return nil, err
	}
	t, err := s.repo.GetTicket(ctx, tenantID, ticketID)
	if err != nil {
		return nil, err
	}
	// ResponseH and ResolveH both come from defaultSLATargets through the same
	// helper CreateTicket writes with, so the reported window is the window that
	// was actually stored. ResponseDue used to be hardcoded to one hour after
	// creation, so a medium ticket whose real window is four hours was reported
	// as breached on hour one and a low ticket with a seven-day window as a
	// passed response SLA forever after.
	target := slaTargetsFor(t.Priority)
	responseHrs, resolveHrs := target.ResponseH, target.ResolveH
	responseDue := t.CreatedAt.Add(time.Duration(responseHrs) * time.Hour)
	resolutionDue := t.CreatedAt.Add(time.Duration(resolveHrs) * time.Hour)
	now := time.Now().UTC()
	// ResponseOK used to be a constant true, which reported a passed response
	// SLA for a ticket nobody had ever replied to.
	responseOK := now.Before(responseDue)
	if tracking.FirstResponseAt != nil {
		responseOK = !tracking.FirstResponseAt.After(responseDue)
	}
	if tracking.ResponseBreached {
		responseOK = false
	}
	resolutionOK := now.Before(resolutionDue)
	if tracking.ResolvedAt != nil {
		resolutionOK = !tracking.ResolvedAt.After(resolutionDue)
	}
	if tracking.Breached {
		resolutionOK = false
	}
	targetResolutionMs := int64(resolveHrs) * int64(time.Hour) / int64(time.Millisecond)
	if tracking.TargetResolutionTimeMs > 0 {
		targetResolutionMs = tracking.TargetResolutionTimeMs
	}
	return &models.TicketSLAStatus{
		TicketID:               ticketID,
		Status:                 t.Status,
		Priority:               t.Priority,
		ResponseDue:            responseDue.Format(time.RFC3339),
		ResolutionDue:          resolutionDue.Format(time.RFC3339),
		ResponseOK:             responseOK,
		ResolutionOK:           resolutionOK,
		Breached:               tracking.Breached,
		TargetResponseTimeMs:   int64(responseHrs) * int64(time.Hour) / int64(time.Millisecond),
		TargetResolutionTimeMs: targetResolutionMs,
		RespondedAt:            tracking.FirstResponseAt,
		ResolvedAt:             tracking.ResolvedAt,
	}, nil
}

// --- Reports ---

func (s *Service) GetSLACompliance(ctx context.Context, tenantID string) (*models.SLAComplianceReport, error) {
	breaches, err := s.repo.GetSLABreaches(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	compliant := 0
	for _, t := range tickets {
		if t.Status == "resolved" || t.Status == "closed" {
			compliant++
		}
	}
	total := len(tickets)
	breached := len(breaches)
	if total == 0 {
		return &models.SLAComplianceReport{ComplianceRate: 100.0}, nil
	}
	rate := float64(compliant) / float64(total) * 100
	return &models.SLAComplianceReport{
		Total:          total,
		Compliant:      compliant,
		Breached:       breached,
		ComplianceRate: rate,
	}, nil
}

func average(vals []float64) float64 {
	if len(vals) == 0 {
		return 0
	}
	var sum float64
	for _, v := range vals {
		sum += v
	}
	return sum / float64(len(vals))
}

func median(vals []float64) float64 {
	if len(vals) == 0 {
		return 0
	}
	sorted := make([]float64, len(vals))
	copy(sorted, vals)
	sort.Float64s(sorted)
	m := len(sorted) / 2
	if len(sorted)%2 == 0 {
		return (sorted[m-1] + sorted[m]) / 2
	}
	return sorted[m]
}

func (s *Service) GetResolutionStats(ctx context.Context, tenantID string) (*models.ResolutionStats, error) {
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	var resolved []models.Ticket
	for _, t := range tickets {
		if t.Status == "resolved" || t.Status == "closed" {
			resolved = append(resolved, t)
		}
	}
	if len(resolved) == 0 {
		return &models.ResolutionStats{Total: len(tickets), ByPriority: make(map[string]float64)}, nil
	}
	var hours []float64
	byPriority := make(map[string][]float64)
	byPriorityAvg := make(map[string]float64)
	for _, t := range resolved {
		dur := t.UpdatedAt.Sub(t.CreatedAt).Hours()
		hours = append(hours, dur)
		byPriority[t.Priority] = append(byPriority[t.Priority], dur)
	}
	for p, v := range byPriority {
		byPriorityAvg[p] = average(v)
	}
	return &models.ResolutionStats{
		Total:          len(resolved),
		AvgResolutionH: average(hours),
		MedianH:        median(hours),
		ByPriority:     byPriorityAvg,
	}, nil
}

func (s *Service) GetBacklogAnalysis(ctx context.Context, tenantID string) (*models.BacklogAnalysis, error) {
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	byStatus := make(map[string]int)
	byPriority := make(map[string]int)
	var oldest *models.Ticket
	// The old code reset byStatus[t.Status] to 0 just before incrementing it for
	// resolved and closed tickets, so every resolved or closed ticket read as
	// exactly one regardless of how many there were: the count always showed 1.
	// Total still counted them, so ByStatus could never sum to Total.
	for i := range tickets {
		t := &tickets[i]
		byStatus[t.Status]++
		byPriority[t.Priority]++
		if oldest == nil || t.CreatedAt.Before(oldest.CreatedAt) {
			oldest = t
		}
	}
	return &models.BacklogAnalysis{
		ByStatus:   byStatus,
		ByPriority: byPriority,
		Oldest:     oldest,
		Total:      len(tickets),
	}, nil
}

func (s *Service) GetTrendReport(ctx context.Context, tenantID string) (*models.TrendReport, error) {
	days := 7
	periods := make([]string, days)
	created := make([]int, days)
	resolved := make([]int, days)
	escalated := make([]int, days)
	for i := range days {
		periods[i] = time.Now().AddDate(0, 0, -int(days-1)+i).Format("2006-01-02")
	}
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	for _, t := range tickets {
		for i := range days {
			d := periods[i]
			tday := t.CreatedAt.Format("2006-01-02")
			if tday == d {
				created[i]++
			}
			if t.ResolvedAt != nil && t.ResolvedAt.Format("2006-01-02") == d {
				resolved[i]++
			}
		}
	}
	return &models.TrendReport{
		Periods:   periods,
		Created:   created,
		Resolved:  resolved,
		Escalated: escalated,
	}, nil
}

func (s *Service) GetStatistics(ctx context.Context, tenantID string) (*models.StatisticsReport, error) {
	count, err := s.repo.CountTickets(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	// Each of these must propagate. GET /tickets/reports/statistics answers 200
	// from this method, and a swallowed COUNT error is indistinguishable from a
	// tenant with zero open tickets: the report comes back all zeros with a nil
	// error, so a broken database reads as an empty, healthy queue.
	byStatus, err := s.repo.CountTicketsByStatus(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	byPriority, err := s.repo.CountTicketsByPriority(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	byCategory, err := s.repo.CountTicketsByCategory(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return &models.StatisticsReport{
		Total:      count,
		Open:       byStatus["open"],
		InProgress: byStatus["in-progress"],
		Resolved:   byStatus["resolved"],
		Closed:     byStatus["closed"],
		ByPriority: byPriority,
		ByCategory: byCategory,
	}, nil
}

// --- Dispatch ---
