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
	policyHrs := 24
	if target, ok := defaultSLATargets[t.Priority]; ok {
		policyHrs = target.ResolveH
	}
	resolutionDue := t.CreatedAt.Add(time.Duration(policyHrs) * time.Hour)
	now := time.Now().UTC()
	status := &models.TicketSLAStatus{
		TicketID:     ticketID,
		ResolutionOK: now.Before(resolutionDue),
		ResponseOK:   true,
		Breached:     tracking.Breached,
	}
	status.ResolutionDue = resolutionDue.Format(time.RFC3339)
	status.ResponseDue = t.CreatedAt.Add(1 * time.Hour).Format(time.RFC3339)
	return status, nil
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
	for i := range tickets {
		t := &tickets[i]
		if t.Status == "resolved" || t.Status == "closed" {
			byStatus[t.Status] = 0
		}
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
	byStatus, _ := s.repo.CountTicketsByStatus(ctx, tenantID)
	byPriority, _ := s.repo.CountTicketsByPriority(ctx, tenantID)
	byCategory, _ := s.repo.CountTicketsByCategory(ctx, tenantID)
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

