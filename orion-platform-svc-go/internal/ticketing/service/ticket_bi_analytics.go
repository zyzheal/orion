package service

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"
)

// --- BI Analytics ---

// GetExecutiveDashboard returns high-level KPIs: total/open/resolved tickets,
// active engineers, SLA compliance, and escalation count. Mirrors TS ExecutiveDashboardBuilder.
func (s *Service) GetExecutiveDashboard(ctx context.Context, tenantID string) (*models.ExecutiveDashboard, error) {
	// Every one of these must propagate. GET /tickets/bi/dashboard/executive
	// answers 200 from this method, and GetSLACompliance hands back a nil
	// report alongside its error, so the old "compliance, _ := ..." line
	// dereferenced nil and panicked the request instead of returning 500. A
	// swallowed CountTickets error would read as a tenant with zero tickets.
	count, err := s.repo.CountTickets(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	byStatus, err := s.repo.CountTicketsByStatus(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	today := time.Now().UTC().Format("2006-01-02")
	resolvedToday := 0
	for _, t := range tickets {
		if t.Status == "resolved" && t.UpdatedAt.Format("2006-01-02") == today {
			resolvedToday++
		}
	}
	engineers, err := s.repo.ListEngineers(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	compliance, err := s.GetSLACompliance(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return &models.ExecutiveDashboard{
		TotalTickets:    count,
		OpenTickets:     byStatus["open"] + byStatus["assigned"] + byStatus["in-progress"],
		ResolvedToday:   resolvedToday,
		ActiveEngineers: len(engineers),
		SLACompliance:   compliance.ComplianceRate,
		Escalations:     byStatus["escalated"],
	}, nil
}

// GetManagerDashboard returns team load, overdue tickets, and new tickets this week.
// Mirrors TS ManagerDashboardBuilder.
func (s *Service) GetManagerDashboard(ctx context.Context, tenantID string) (*models.ManagerDashboard, error) {
	engineers, err := s.repo.ListEngineers(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	teamLoad := make(map[string]int)
	for _, e := range engineers {
		teamLoad[e.Name] = e.CurrentLoad
	}
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	overdue := 0
	newThisWeek := 0
	weekStart := time.Now().UTC().AddDate(0, 0, -7)
	for _, t := range tickets {
		if t.Status != "resolved" && t.Status != "closed" {
			targetH := 24
			if tgt, ok := defaultSLATargets[t.Priority]; ok {
				targetH = tgt.ResolveH
			}
			if time.Now().UTC().After(t.CreatedAt.Add(time.Duration(targetH) * time.Hour)) {
				overdue++
			}
		}
		if t.CreatedAt.After(weekStart) {
			newThisWeek++
		}
	}
	return &models.ManagerDashboard{
		TeamLoad:       teamLoad,
		OverdueTickets: overdue,
		NewThisWeek:    newThisWeek,
	}, nil
}

// GetEngineerDashboard returns the engineer's personal workload and upcoming deadlines.
// Mirrors TS EngineerDashboardBuilder.
func (s *Service) GetEngineerDashboard(ctx context.Context, tenantID, engineerID string) (*models.EngineerDashboard, error) {
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	myTickets := 0
	openTickets := 0
	upcoming := make([]string, 0)
	for _, t := range tickets {
		if t.AssigneeID != nil && *t.AssigneeID == engineerID {
			myTickets++
			if t.Status != "resolved" && t.Status != "closed" {
				openTickets++
				targetH := 24
				if tgt, ok := defaultSLATargets[t.Priority]; ok {
					targetH = tgt.ResolveH
				}
				due := t.CreatedAt.Add(time.Duration(targetH) * time.Hour)
				if due.After(time.Now().UTC()) {
					upcoming = append(upcoming, fmt.Sprintf("%s: %s", t.ID, due.Format(time.RFC3339)))
				}
			}
		}
	}
	return &models.EngineerDashboard{
		EngineerID:        engineerID,
		MyTickets:         myTickets,
		OpenTickets:       openTickets,
		UpcomingDeadlines: upcoming,
	}, nil
}

// GetEngineerEfficiency returns resolved count and average resolution hours for an engineer.
// Mirrors TS EngineerMetricsCalculator.
func (s *Service) GetEngineerEfficiency(ctx context.Context, tenantID, engineerID string) (*models.EngineerEfficiency, error) {
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	var resolvedHours []float64
	for _, t := range tickets {
		if t.AssigneeID == nil || *t.AssigneeID != engineerID {
			continue
		}
		if t.Status == "resolved" || t.Status == "closed" {
			dur := t.UpdatedAt.Sub(t.CreatedAt).Hours()
			if dur > 0 {
				resolvedHours = append(resolvedHours, dur)
			}
		}
	}
	return &models.EngineerEfficiency{
		EngineerID:      engineerID,
		TicketsResolved: len(resolvedHours),
		AvgResolveH:     average(resolvedHours),
	}, nil
}

// GetEfficiencyScore returns a composite 0-100 efficiency score for an engineer.
// Components: resolved count (up to 60), resolution speed (up to 30), load balance (up to 30).
// Mirrors TS PeriodComparator efficiency scoring.
func (s *Service) GetEfficiencyScore(ctx context.Context, tenantID, engineerID string) (*models.EfficiencyScore, error) {
	eng, err := s.repo.GetEngineer(ctx, tenantID, engineerID)
	if err != nil {
		return nil, err
	}
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	// Ranking needs the rest of the team, which is the same table the manager
	// dashboard already reads.
	engineers, err := s.repo.ListEngineers(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	score, components := engineerScore(*eng, tickets)
	// Ranking was a literal 1, so every engineer on
	// GET /tickets/bi/score/:engineerId read as the top performer. Ties keep the
	// same rank, so the ordering is stable without a tie-break rule.
	ranking := 1
	for i := range engineers {
		if engineers[i].ID == eng.ID {
			continue
		}
		if s, _ := engineerScore(engineers[i], tickets); s > score {
			ranking++
		}
	}
	return &models.EfficiencyScore{
		EngineerID: eng.ID,
		Score:      score,
		Ranking:    ranking,
		Grade:      gradeFor(score),
		Components: components,
	}, nil
}

// engineerScore computes the 0-100 score and its three components for one
// engineer from the tenant's full ticket list. The math is unchanged from the
// inline version; the components were previously computed and discarded even
// though models.EfficiencyScore.Components exists to carry them.
func engineerScore(eng models.DispatchEngineer, tickets []models.Ticket) (float64, map[string]float64) {
	var resolvedHours []float64
	for _, t := range tickets {
		if t.AssigneeID != nil && *t.AssigneeID == eng.ID {
			if t.Status == "resolved" || t.Status == "closed" {
				if dur := t.UpdatedAt.Sub(t.CreatedAt).Hours(); dur > 0 {
					resolvedHours = append(resolvedHours, dur)
				}
			}
		}
	}
	volume := float64(len(resolvedHours)) * 20
	speed := 0.0
	if len(resolvedHours) > 0 {
		switch avg := average(resolvedHours); {
		case avg <= 4:
			speed = 30
		case avg <= 12:
			speed = 20
		default:
			speed = 10
		}
	}
	loadBonus := 0.0
	if eng.MaxTickets > 0 {
		if ratio := float64(eng.CurrentLoad) / float64(eng.MaxTickets); ratio < 0.5 {
			loadBonus = 30
		} else if ratio < 0.8 {
			loadBonus = 15
		}
	}
	score := volume + speed + loadBonus
	if score > 100 {
		score = 100
	}
	return score, map[string]float64{
		"resolution_volume": volume,
		"resolution_speed":  speed,
		"load_balance":      loadBonus,
	}
}

// gradeFor applies the A/B/C/D/F rubric that internal/ticket's
// GetEfficiencyScore already uses, so the two modules grade the same score the
// same way.
func gradeFor(score float64) string {
	switch {
	case score >= 90:
		return "A"
	case score >= 80:
		return "B"
	case score >= 70:
		return "C"
	case score >= 60:
		return "D"
	}
	return "F"
}

// ComparePeriods compares ticket volume between two date ranges.
// Periods are formatted as "YYYY-MM-DD..YYYY-MM-DD". Mirrors TS PeriodComparator.
func (s *Service) ComparePeriods(ctx context.Context, tenantID string, current, previous string) (*models.ComparePeriodsResult, error) {
	curRange := strings.Split(current, "..")
	prevRange := strings.Split(previous, "..")
	if len(curRange) != 2 || len(prevRange) != 2 {
		return nil, errors.New("period must be formatted as 'start..end'")
	}
	countCurrent := 0
	countPrevious := 0
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	for _, t := range tickets {
		day := t.CreatedAt.Format("2006-01-02")
		if day >= curRange[0] && day <= curRange[1] {
			countCurrent++
		}
		if day >= prevRange[0] && day <= prevRange[1] {
			countPrevious++
		}
	}
	changePct := 0.0
	if countPrevious > 0 {
		changePct = (float64(countCurrent) - float64(countPrevious)) / float64(countPrevious) * 100
	}
	return &models.ComparePeriodsResult{
		CurrentPeriod:  current,
		PreviousPeriod: previous,
		Metrics: map[string]models.CompareMetric{
			"tickets_created": {
				Current:   float64(countCurrent),
				Previous:  float64(countPrevious),
				ChangePct: changePct,
			},
		},
	}, nil
}

// ExportBIData returns filtered ticket data for the given date range and format.
// Mirrors TS BIExporter.
func (s *Service) ExportBIData(ctx context.Context, tenantID string, req models.BIDataExportRequest) (map[string]interface{}, error) {
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	var filtered []models.Ticket
	if req.From != "" && req.To != "" {
		for _, t := range tickets {
			day := t.CreatedAt.Format("2006-01-02")
			if day >= req.From && day <= req.To {
				filtered = append(filtered, t)
			}
		}
	} else {
		filtered = tickets
	}
	data := make([]map[string]interface{}, len(filtered))
	for i, t := range filtered {
		data[i] = map[string]interface{}{
			"id":          t.ID,
			"title":       t.Title,
			"status":      t.Status,
			"priority":    t.Priority,
			"created_at":  t.CreatedAt.Format(time.RFC3339),
			"updated_at":  t.UpdatedAt.Format(time.RFC3339),
			"assignee_id": t.AssigneeID,
			"reporter_id": t.ReporterID,
		}
	}
	return map[string]interface{}{
		"from":   req.From,
		"to":     req.To,
		"format": req.Format,
		"data":   data,
	}, nil
}

// GetTimeTrend returns daily ticket creation counts. Mirrors TS TimeTrendAnalyzer.
func (s *Service) GetTimeTrend(ctx context.Context, tenantID string, period string) (*models.TimeTrend, error) {
	labels := make([]string, 0)
	values := make([]int, 0)
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	dayCounts := make(map[string]int)
	for _, t := range tickets {
		dayCounts[t.CreatedAt.Format("2006-01-02")]++
	}
	days := make([]string, 0, len(dayCounts))
	for d := range dayCounts {
		days = append(days, d)
	}
	sort.Strings(days)
	for _, d := range days {
		labels = append(labels, d)
		values = append(values, dayCounts[d])
	}
	return &models.TimeTrend{
		Labels: labels,
		Values: values,
	}, nil
}
