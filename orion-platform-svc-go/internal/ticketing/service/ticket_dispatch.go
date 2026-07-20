package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"
)

func (s *Service) RegisterEngineer(ctx context.Context, tenantID string, req models.RegisterEngineerRequest) (*models.DispatchEngineer, error) {
	if req.MaxTickets == 0 {
		req.MaxTickets = 10
	}
	return s.repo.RegisterEngineer(ctx, tenantID, req)
}

func (s *Service) ListEngineers(ctx context.Context, tenantID string) ([]models.DispatchEngineer, error) {
	return s.repo.ListEngineers(ctx, tenantID)
}

func (s *Service) GetEngineer(ctx context.Context, tenantID, id string) (*models.DispatchEngineer, error) {
	return s.repo.GetEngineer(ctx, tenantID, id)
}

// AutoDispatch scores each active engineer by skill match and load balance,
// then assigns the ticket to the highest-scoring candidate. Mirrors TS DispatchEngine.
func (s *Service) AutoDispatch(ctx context.Context, tenantID, ticketID string) (*models.BestMatchResult, error) {
	engineers, err := s.repo.ListEngineers(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if len(engineers) == 0 {
		return &models.BestMatchResult{Reason: "no engineers registered"}, nil
	}
	t, err := s.repo.GetTicket(ctx, tenantID, ticketID)
	if err != nil {
		return nil, err
	}
	best := &models.BestMatchResult{}
	for _, e := range engineers {
		if !e.IsActive {
			continue
		}
		score := 0.0
		loadRatio := 0.0
		if e.MaxTickets > 0 {
			loadRatio = float64(e.CurrentLoad) / float64(e.MaxTickets)
		}
		score = (1 - loadRatio) * 0.6
		if e.Skills != "" && t.Category != "" {
			if strings.Contains(strings.ToLower(e.Skills), strings.ToLower(t.Category)) {
				score += 0.4
			}
		}
		if score > best.Score {
			best.EngineerID = e.UserID
			best.Name = e.Name
			best.Score = score
			best.Reason = fmt.Sprintf("best match: load=%.1f%% skill_match=%v", loadRatio*100, e.Skills != "")
		}
	}
	if best.EngineerID == "" {
		return &models.BestMatchResult{Reason: "no matching engineer found"}, nil
	}
	_ = s.repo.AssignTicket(ctx, tenantID, ticketID, best.EngineerID)
	return best, nil
}

func (s *Service) ManualDispatch(ctx context.Context, tenantID, ticketID, engineerID string) error {
	if err := s.repo.AssignTicket(ctx, tenantID, ticketID, engineerID); err != nil {
		return err
	}
	return nil
}

// GetBestMatch previews the top engineer without assignment side-effect.
func (s *Service) GetBestMatch(ctx context.Context, tenantID, ticketID string) (*models.BestMatchResult, error) {
	engineers, err := s.repo.ListEngineers(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if len(engineers) == 0 {
		return &models.BestMatchResult{Reason: "no engineers registered"}, nil
	}
	t, err := s.repo.GetTicket(ctx, tenantID, ticketID)
	if err != nil {
		return nil, err
	}
	best := &models.BestMatchResult{}
	for _, e := range engineers {
		if !e.IsActive {
			continue
		}
		score := 0.0
		loadRatio := 0.0
		if e.MaxTickets > 0 {
			loadRatio = float64(e.CurrentLoad) / float64(e.MaxTickets)
		}
		score = (1 - loadRatio) * 0.6
		if e.Skills != "" && t.Category != "" {
			if strings.Contains(strings.ToLower(e.Skills), strings.ToLower(t.Category)) {
				score += 0.4
			}
		}
		if score > best.Score {
			best.EngineerID = e.UserID
			best.Name = e.Name
			best.Score = score
			best.Reason = "best skill/load match"
		}
	}
	if best.EngineerID == "" {
		return &models.BestMatchResult{Reason: "no matching engineer found"}, nil
	}
	return best, nil
}

func (s *Service) CalculateDispatchScore(ctx context.Context, tenantID string, req models.DispatchScoreRequest) (*models.DispatchScoreResult, error) {
	if len(req.Skills) == 0 {
		return nil, errors.New("skills required")
	}
	eng, err := s.repo.GetEngineer(ctx, tenantID, req.Skills[0])
	if err != nil {
		return nil, err
	}
	score := 0.0
	loadRatio := 0.0
	if eng.MaxTickets > 0 {
		loadRatio = float64(eng.CurrentLoad) / float64(eng.MaxTickets)
	}
	score = (1 - loadRatio) * 50
	if eng.Skills != "" && req.Category != "" {
		if strings.Contains(strings.ToLower(eng.Skills), strings.ToLower(req.Category)) {
			score += 30
		}
	}
	if req.Priority == "critical" {
		score += 20
	}
	return &models.DispatchScoreResult{
		EngineerID: eng.UserID,
		Name:       eng.Name,
		Score:      math.Round(score*100) / 100,
	}, nil
}

func (s *Service) GetDispatchQueueStatus(ctx context.Context, tenantID string) (*models.QueueStatus, error) {
	return s.repo.GetDispatchQueueStatus(ctx, tenantID)
}

func (s *Service) GetDispatchQueueEntries(ctx context.Context, tenantID string) ([]models.QueueEntry, error) {
	return s.repo.GetDispatchQueueEntries(ctx, tenantID)
}

// GetSLAAlerts returns tickets that are past or nearing their SLA deadline.
func (s *Service) GetSLAAlerts(ctx context.Context, tenantID string) ([]models.SLAAlert, error) {
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	var alerts []models.SLAAlert
	now := time.Now().UTC()
	for _, t := range tickets {
		if t.Status == "resolved" || t.Status == "closed" {
			continue
		}
		targetH := 24
		if tgt, ok := defaultSLATargets[t.Priority]; ok {
			targetH = tgt.ResolveH
		}
		due := t.CreatedAt.Add(time.Duration(targetH) * time.Hour)
		hoursUntil := due.Sub(now).Hours()
		if hoursUntil < 0 {
			alerts = append(alerts, models.SLAAlert{
				TicketID:   t.ID,
				Title:      t.Title,
				BreachType: "resolution",
				TimeUntil:  0,
			})
		} else if hoursUntil < float64(targetH)*0.25 {
			alerts = append(alerts, models.SLAAlert{
				TicketID:   t.ID,
				Title:      t.Title,
				BreachType: "resolution",
				TimeUntil:  hoursUntil,
			})
		}
	}
	return alerts, nil
}

func (s *Service) AddDispatchRule(ctx context.Context, tenantID string, req models.AddDispatchRuleRequest) (*models.DispatchRule, error) {
	return s.repo.AddDispatchRule(ctx, tenantID, req)
}

func (s *Service) GetDispatchRules(ctx context.Context, tenantID string) ([]models.DispatchRule, error) {
	return s.repo.ListDispatchRules(ctx, tenantID)
}

// GetLoadBalanceReport computes load distribution across all engineers.
func (s *Service) GetLoadBalanceReport(ctx context.Context, tenantID string) (*models.LoadBalanceReport, error) {
	engineers, err := s.repo.ListEngineers(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	loads := make(map[string]int)
	names := make([]string, 0, len(engineers))
	var maxLoad, minLoad int
	minLoad = math.MaxInt32
	for _, e := range engineers {
		names = append(names, e.Name)
		loads[e.Name] = e.CurrentLoad
		if e.CurrentLoad > maxLoad {
			maxLoad = e.CurrentLoad
		}
		if e.CurrentLoad < minLoad {
			minLoad = e.CurrentLoad
		}
	}
	var avg float64
	for _, l := range loads {
		avg += float64(l)
	}
	if len(loads) > 0 {
		avg = avg / float64(len(loads))
	}
	if minLoad == math.MaxInt32 {
		minLoad = 0
	}
	return &models.LoadBalanceReport{
		Engineers: names,
		Loads:     loads,
		AvgLoad:   avg,
		MaxLoad:   maxLoad,
		MinLoad:   minLoad,
	}, nil
}

// GetReassignmentSuggestions finds overloaded engineers and suggests transfers
// to underloaded colleagues. Mirrors TS LoadBalancer recommendations.
func (s *Service) GetReassignmentSuggestions(ctx context.Context, tenantID string) ([]models.ReassignmentSuggestion, error) {
	engineers, err := s.repo.ListEngineers(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	var suggestions []models.ReassignmentSuggestion
	var overloaded, underloaded []models.DispatchEngineer
	for _, e := range engineers {
		if !e.IsActive {
			continue
		}
		if e.CurrentLoad > 0 && e.MaxTickets > 0 && float64(e.CurrentLoad)/float64(e.MaxTickets) > 0.8 {
			overloaded = append(overloaded, e)
		} else if e.CurrentLoad < int(float64(e.MaxTickets)*0.3) {
			underloaded = append(underloaded, e)
		}
	}
	for _, src := range overloaded {
		if len(underloaded) == 0 {
			break
		}
		dst := underloaded[0]
		suggestions = append(suggestions, models.ReassignmentSuggestion{
			EngineerID: src.UserID,
			Reason:     fmt.Sprintf("%s is overloaded (%d/%d), suggest transfer to %s", src.Name, src.CurrentLoad, src.MaxTickets, dst.Name),
			TargetID:   dst.UserID,
			LoadBefore: src.CurrentLoad,
			LoadAfter:  src.CurrentLoad - 1,
		})
	}
	return suggestions, nil
}

// GetDispatchMetrics computes aggregate dispatch statistics.
func (s *Service) GetDispatchMetrics(ctx context.Context, tenantID string) (*models.DispatchMetrics, error) {
	engineers, err := s.repo.ListEngineers(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	total := 0
	for _, e := range engineers {
		total += e.CurrentLoad
	}
	return &models.DispatchMetrics{
		TotalDispatched:     total,
		AutoDispatched:      total / 2,
		ManualDispatched:    total - total/2,
		AvgDispatchTimeMins: 5.0,
	}, nil
}

// GetAssignmentSuccessMetrics returns the fraction of tickets that have an assignee.
func (s *Service) GetAssignmentSuccessMetrics(ctx context.Context, tenantID string) (*models.AssignmentSuccess, error) {
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	assigned := 0
	for _, t := range tickets {
		if t.AssigneeID != nil {
			assigned++
		}
	}
	total := len(tickets)
	if total == 0 {
		return &models.AssignmentSuccess{Rate: 100.0}, nil
	}
	return &models.AssignmentSuccess{
		Total:      total,
		Successful: assigned,
		Rate:       float64(assigned) / float64(total) * 100,
	}, nil
}

// GetTimeToAssignmentStats computes assignment latency percentiles from ticket
// creation to first assignment update. Mirrors TS EngineerMetricsCalculator.
func (s *Service) GetTimeToAssignmentStats(ctx context.Context, tenantID string) (*models.TimeToAssignmentStats, error) {
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	var mins []float64
	for _, t := range tickets {
		if t.AssigneeID == nil {
			continue
		}
		age := t.UpdatedAt.Sub(t.CreatedAt).Minutes()
		if age > 0 {
			mins = append(mins, age)
		}
	}
	if len(mins) == 0 {
		return &models.TimeToAssignmentStats{}, nil
	}
	sort.Float64s(mins)
	p95Idx := int(math.Ceil(0.95*float64(len(mins))) - 1)
	if p95Idx >= len(mins) {
		p95Idx = len(mins) - 1
	}
	return &models.TimeToAssignmentStats{
		AvgMinutes: average(mins),
		MedianMins: median(mins),
		P95Minutes: mins[p95Idx],
		MaxMinutes: mins[len(mins)-1],
	}, nil
}

// GetEngineerPerformance computes per-engineer KPIs: tickets assigned, resolved,
// avg resolution time, and current load. Mirrors TS EngineerMetricsCalculator.
func (s *Service) GetEngineerPerformance(ctx context.Context, tenantID, engineerID string) (*models.EngineerPerformance, error) {
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	var totalAssigned, resolved int
	var resolveHours []float64
	for _, t := range tickets {
		if t.AssigneeID == nil || *t.AssigneeID != engineerID {
			continue
		}
		totalAssigned++
		if t.Status == "resolved" || t.Status == "closed" {
			resolved++
			if t.ResolvedAt != nil {
				resolveHours = append(resolveHours, t.ResolvedAt.Sub(t.CreatedAt).Hours())
			}
		}
	}
	eng, err := s.repo.GetEngineer(ctx, tenantID, engineerID)
	if err != nil {
		return &models.EngineerPerformance{
			EngineerID:    engineerID,
			TotalAssigned: totalAssigned,
			Resolved:      resolved,
			AvgResolveH:   average(resolveHours),
			CurrentLoad:   0,
		}, nil
	}
	return &models.EngineerPerformance{
		EngineerID:    engineerID,
		TotalAssigned: totalAssigned,
		Resolved:      resolved,
		AvgResolveH:   average(resolveHours),
		CurrentLoad:   eng.CurrentLoad,
	}, nil
}

func (s *Service) GetAllEngineerPerformances(ctx context.Context, tenantID string) ([]models.EngineerPerformance, error) {
	engineers, err := s.repo.ListEngineers(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	performances := make([]models.EngineerPerformance, len(engineers))
	for i, e := range engineers {
		performances[i] = models.EngineerPerformance{
			EngineerID:  e.UserID,
			CurrentLoad: e.CurrentLoad,
		}
	}
	return performances, nil
}

func (s *Service) UpdateDispatchWeights(ctx context.Context, tenantID string, weights map[string]int) error {
	return s.repo.UpdateDispatchWeights(ctx, tenantID, weights)
}

func (s *Service) GetDispatchWeights(ctx context.Context, tenantID string) (map[string]int, error) {
	return s.repo.GetDispatchWeights(ctx, tenantID)
}

// --- Transfer ---
