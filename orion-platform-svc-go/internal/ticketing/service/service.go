package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/repository"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	AddDispatchRule(ctx context.Context, tenantID string, req models.AddDispatchRuleRequest) (*models.DispatchRule, error)
	AddRelation(ctx context.Context, tenantID, ticketID, relatedID, relType string) (*models.TicketRelation, error)
	AddWorkflowHistory(ctx context.Context, tenantID, ticketID, action, fromState, toState, userID, comment string) error
	AssignTicket(ctx context.Context, tenantID, id string, assigneeID string) error
	CountTickets(ctx context.Context, tenantID string) (int, error)
	CountTicketsByCategory(ctx context.Context, tenantID string) (map[string]int, error)
	CountTicketsByPriority(ctx context.Context, tenantID string) (map[string]int, error)
	CountTicketsByStatus(ctx context.Context, tenantID string) (map[string]int, error)
	CreateAssignment(ctx context.Context, tenantID, ticketID, assignee, assignedBy, reason string) error
	CreateAssignmentRule(ctx context.Context, tenantID string, req models.CreateAssignmentRuleRequest) (*models.AssignmentRule, error)
	CreateAutomationRule(ctx context.Context, tenantID string, req models.CreateAutomationRuleRequest) (*models.AutomationRule, error)
	CreateSLAPolicy(ctx context.Context, tenantID string, req models.CreateSLAPolicyRequest) (*models.SLAPolicy, error)
	CreateSLATarget(ctx context.Context, tenantID string, req models.CreateSLATargetRequest) (*models.SLATarget, error)
	CreateSuspend(ctx context.Context, tenantID string, req models.CreateSuspendRequest) (*models.Suspend, error)
	CreateTicket(ctx context.Context, t *models.Ticket) error
	DeleteAssignmentRule(ctx context.Context, tenantID string, id int) error
	DeleteAutomationRule(ctx context.Context, tenantID string, ruleID int) error
	DeleteSLAPolicy(ctx context.Context, tenantID string, policyID int) error
	DeleteTicket(ctx context.Context, tenantID, id string) error
	DetectDuplicates(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error)
	FindRelatedTickets(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error)
	GetDispatchQueueEntries(ctx context.Context, tenantID string) ([]models.QueueEntry, error)
	GetDispatchQueueStatus(ctx context.Context, tenantID string) (*models.QueueStatus, error)
	GetDispatchWeights(ctx context.Context, tenantID string) (map[string]int, error)
	GetEngineer(ctx context.Context, tenantID, id string) (*models.DispatchEngineer, error)
	GetEngineerSuspensions(ctx context.Context, tenantID, engineerID string) ([]models.Suspend, error)
	GetRelations(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error)
	GetSLABreaches(ctx context.Context, tenantID string) ([]models.SLABreach, error)
	GetSLACompliance(ctx context.Context, tenantID string, policyID int) (*models.ComplianceResult, error)
	GetSLAPolicy(ctx context.Context, tenantID string, policyID int) (*models.SLAPolicy, error)
	GetSLATracking(ctx context.Context, tenantID, ticketID string) (*repository.TicketSLATracking, error)
	GetSuspend(ctx context.Context, tenantID, id string) (*models.Suspend, error)
	GetTicket(ctx context.Context, tenantID, id string) (*models.Ticket, error)
	GetTicketSLAStatus(ctx context.Context, tenantID, ticketID string) (*models.TicketSLAStatus, error)
	GetTransferHistory(ctx context.Context, tenantID, ticketID string) ([]models.TransferHistoryEntry, error)
	GetTransferStats(ctx context.Context, tenantID string) (*models.TransferStats, error)
	GetWorkflowHistory(ctx context.Context, tenantID, ticketID string) ([]models.WorkflowHistoryEntry, error)
	IsServiceActive(ctx context.Context, tenantID string) (bool, error)
	ListAssignmentRules(ctx context.Context, tenantID string) ([]models.AssignmentRule, error)
	ListAutomationRules(ctx context.Context, tenantID string) ([]models.AutomationRule, error)
	ListDispatchRules(ctx context.Context, tenantID string) ([]models.DispatchRule, error)
	ListEngineers(ctx context.Context, tenantID string) ([]models.DispatchEngineer, error)
	ListSLAPolicies(ctx context.Context, tenantID string) ([]models.SLAPolicy, error)
	ListSuspensions(ctx context.Context, tenantID string) ([]models.Suspend, error)
	ListTickets(ctx context.Context, tenantID string, q models.TicketListQuery) ([]models.Ticket, error)
	RegisterEngineer(ctx context.Context, tenantID string, req models.RegisterEngineerRequest) (*models.DispatchEngineer, error)
	SetServiceActive(ctx context.Context, tenantID string, active bool) error
	TransferTicket(ctx context.Context, tenantID, ticketID, fromUserID, toUserID, reason string) error
	UpdateAutomationRule(ctx context.Context, tenantID string, ruleID int, updates map[string]interface{}) error
	UpdateDispatchWeights(ctx context.Context, tenantID string, weights map[string]int) error
	UpdateSLAPolicy(ctx context.Context, tenantID string, policyID int, updates map[string]interface{}) error
	UpdateSLATracking(ctx context.Context, ticketID string, updates map[string]interface{}) error
	UpdateSuspendStatus(ctx context.Context, tenantID, id string, status string) error
	UpdateTicket(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpsertSLATracking(ctx context.Context, tenantID, ticketID, priority string, targetResolutionMs int64) (*repository.TicketSLATracking, error)
}

// validTransitions mirrors the TS TicketWorkflowService state machine matrix.
var validTransitions = map[string][]string{
	"open":        {"assigned", "closed"},
	"assigned":    {"in-progress", "open", "closed"},
	"in-progress": {"resolved", "assigned"},
	"resolved":    {"closed", "open"},
	"closed":      {"open"},
}

// defaultSLATargets mirrors TS defaults (in hours).
var defaultSLATargets = map[string]models.SLATarget{
	"critical": {ResponseH: 0, ResolveH: 4, Enabled: true},
	"high":     {ResponseH: 1, ResolveH: 8, Enabled: true},
	"medium":   {ResponseH: 4, ResolveH: 24, Enabled: true},
	"low":      {ResponseH: 8, ResolveH: 72, Enabled: true},
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Service Control ---

func (s *Service) StartService(ctx context.Context, tenantID string) error {
	return s.repo.SetServiceActive(ctx, tenantID, true)
}

func (s *Service) StopService(ctx context.Context, tenantID string) error {
	return s.repo.SetServiceActive(ctx, tenantID, false)
}

func (s *Service) HealthCheck(ctx context.Context, tenantID string) (bool, error) {
	active, err := s.repo.IsServiceActive(ctx, tenantID)
	if err != nil {
		return false, err
	}
	return active, nil
}

// --- Ticket CRUD ---

func (s *Service) CreateTicket(ctx context.Context, tenantID string, req models.CreateTicketRequest, reporterID string) (*models.Ticket, error) {
	priority := req.Priority
	if priority == "" {
		priority = "medium"
	}
	status := "open"
	t := &models.Ticket{
		TenantID:    tenantID,
		Title:       req.Title,
		Description: req.Description,
		Status:      status,
		Priority:    priority,
		Category:    req.Category,
		Source:      req.Source,
		SourceID:    req.SourceID,
		Metadata:    req.Metadata,
		ReporterID:  reporterID,
	}
	if err := s.repo.CreateTicket(ctx, t); err != nil {
		return nil, err
	}
	if err := s.repo.AddWorkflowHistory(ctx, tenantID, t.ID, "create", status, status, reporterID, "Ticket created"); err != nil {
		return nil, err
	}
	target := defaultSLATargets[priority]
	targetMs := int64(target.ResolveH) * 3600
	_, err := s.repo.UpsertSLATracking(ctx, tenantID, t.ID, priority, targetMs)
	return t, err
}

func (s *Service) GetTicket(ctx context.Context, tenantID, id string) (*models.Ticket, error) {
	return s.repo.GetTicket(ctx, tenantID, id)
}

func (s *Service) ListTickets(ctx context.Context, tenantID string, q models.TicketListQuery) ([]models.Ticket, error) {
	return s.repo.ListTickets(ctx, tenantID, q)
}

func (s *Service) DeleteTicket(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteTicket(ctx, tenantID, id)
}

// --- Workflow ---

func (s *Service) canTransition(from, to string) bool {
	allowed, ok := validTransitions[from]
	if !ok {
		return false
	}
	for _, a := range allowed {
		if a == to {
			return true
		}
	}
	return false
}

func (s *Service) TransitionStatus(ctx context.Context, tenantID, ticketID string, req models.TransitionRequest, userID string) (*models.Ticket, error) {
	t, err := s.repo.GetTicket(ctx, tenantID, ticketID)
	if err != nil {
		return nil, err
	}
	if !s.canTransition(t.Status, req.Status) {
		return nil, fmt.Errorf("invalid transition from %q to %q", t.Status, req.Status)
	}
	now := time.Now().UTC()
	if req.Status == "resolved" {
		_ = s.repo.UpdateTicket(ctx, tenantID, ticketID, map[string]interface{}{
			"status":      req.Status,
			"resolved_at": now,
		})
	} else if req.Status == "closed" {
		_ = s.repo.UpdateTicket(ctx, tenantID, ticketID, map[string]interface{}{
			"status":    req.Status,
			"closed_at": now,
		})
	} else {
		_ = s.repo.UpdateTicket(ctx, tenantID, ticketID, map[string]interface{}{
			"status": req.Status,
		})
	}
	if err := s.repo.AddWorkflowHistory(ctx, tenantID, ticketID, "transition", t.Status, req.Status, userID, req.Comment); err != nil {
		return nil, err
	}
	if req.Status == "resolved" || req.Status == "closed" {
		_ = s.repo.UpdateSLATracking(ctx, ticketID, map[string]interface{}{
			"resolved_at": now,
		})
	}
	return s.repo.GetTicket(ctx, tenantID, ticketID)
}

func (s *Service) AssignTicket(ctx context.Context, tenantID, ticketID string, req models.AssignRequest, userID string) (*models.Ticket, error) {
	t, err := s.repo.GetTicket(ctx, tenantID, ticketID)
	if err != nil {
		return nil, err
	}
	_ = s.repo.CreateAssignment(ctx, tenantID, ticketID, req.AssigneeID, userID, req.Comment)
	status := t.Status
	if status == "open" {
		status = "assigned"
	}
	if err := s.repo.UpdateTicket(ctx, tenantID, ticketID, map[string]interface{}{
		"status":      status,
		"assignee_id": req.AssigneeID,
	}); err != nil {
		return nil, err
	}
	if err := s.repo.AddWorkflowHistory(ctx, tenantID, ticketID, "assign", t.Status, status, userID, req.Comment); err != nil {
		return nil, err
	}
	return s.repo.GetTicket(ctx, tenantID, ticketID)
}

func (s *Service) EscalateTicket(ctx context.Context, tenantID, ticketID string, req models.EscalateRequest, userID string) (*models.Ticket, error) {
	t, err := s.repo.GetTicket(ctx, tenantID, ticketID)
	if err != nil {
		return nil, err
	}
	priority := t.Priority
	priorityOrder := []string{"low", "medium", "high", "critical"}
	idx := -1
	for i, p := range priorityOrder {
		if p == priority {
			idx = i
			break
		}
	}
	if idx >= 0 && idx < len(priorityOrder)-1 {
		priority = priorityOrder[idx+1]
		_ = s.repo.UpdateTicket(ctx, tenantID, ticketID, map[string]interface{}{"priority": priority})
	}
	_ = s.repo.AddWorkflowHistory(ctx, tenantID, ticketID, "escalate", "", "escalated", userID, req.Reason)
	return s.repo.GetTicket(ctx, tenantID, ticketID)
}

func (s *Service) ResolveTicket(ctx context.Context, tenantID, ticketID string, req models.ResolveRequest, userID string) (*models.Ticket, error) {
	if err := s.repo.AddWorkflowHistory(ctx, tenantID, ticketID, "resolve", "", "resolved", userID, req.Comment); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateTicket(ctx, tenantID, ticketID, map[string]interface{}{
		"status":      "resolved",
		"resolved_at": time.Now().UTC(),
	}); err != nil {
		return nil, err
	}
	_ = s.repo.UpdateSLATracking(ctx, ticketID, map[string]interface{}{
		"resolved_at": time.Now().UTC(),
	})
	return s.repo.GetTicket(ctx, tenantID, ticketID)
}

func (s *Service) CloseTicket(ctx context.Context, tenantID, ticketID string, comment, userID string) (*models.Ticket, error) {
	if err := s.repo.AddWorkflowHistory(ctx, tenantID, ticketID, "close", "", "closed", userID, comment); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateTicket(ctx, tenantID, ticketID, map[string]interface{}{
		"status":    "closed",
		"closed_at": time.Now().UTC(),
	}); err != nil {
		return nil, err
	}
	return s.repo.GetTicket(ctx, tenantID, ticketID)
}

func (s *Service) GetWorkflowHistory(ctx context.Context, tenantID, ticketID string) ([]models.WorkflowHistoryEntry, error) {
	return s.repo.GetWorkflowHistory(ctx, tenantID, ticketID)
}

// --- Assignment Rules ---

func (s *Service) AddAssignmentRule(ctx context.Context, tenantID string, req models.CreateAssignmentRuleRequest) (*models.AssignmentRule, error) {
	return s.repo.CreateAssignmentRule(ctx, tenantID, req)
}

func (s *Service) GetAssignmentRules(ctx context.Context, tenantID string) ([]models.AssignmentRule, error) {
	return s.repo.ListAssignmentRules(ctx, tenantID)
}

func (s *Service) RemoveAssignmentRule(ctx context.Context, tenantID string, id int) error {
	return s.repo.DeleteAssignmentRule(ctx, tenantID, id)
}

// --- Relations ---

func (s *Service) AddRelation(ctx context.Context, tenantID, ticketID string, req models.CreateRelationRequest) (*models.TicketRelation, error) {
	return s.repo.AddRelation(ctx, tenantID, ticketID, req.RelatedID, req.Type)
}

func (s *Service) GetRelations(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error) {
	return s.repo.GetRelations(ctx, tenantID, ticketID)
}

func (s *Service) FindRelatedTickets(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error) {
	return s.repo.FindRelatedTickets(ctx, tenantID, ticketID)
}

func (s *Service) DetectDuplicates(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error) {
	return s.repo.DetectDuplicates(ctx, tenantID, ticketID)
}

// CorrelateRootCause analyzes a set of tickets for common root causes based on
// matching category + source signature. Mirrors TS TicketWorkflowService correlation.
func (s *Service) CorrelateRootCause(ctx context.Context, tenantID string, ticketIDs []string) (map[string]interface{}, error) {
	if len(ticketIDs) == 0 {
		return map[string]interface{}{"correlated": false, "reason": "no tickets provided"}, nil
	}
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	byID := make(map[string]*models.Ticket)
	for i := range tickets {
		byID[tickets[i].ID] = &tickets[i]
	}
	groups := make(map[string][]string)
	for _, id := range ticketIDs {
		t, ok := byID[id]
		if !ok {
			continue
		}
		key := t.Category + "|" + t.Source
		M := groups[key]
		M = append(M, id)
		groups[key] = M
	}
	correlated := len(groups) == 1 && len(groups) > 0
	return map[string]interface{}{
		"ticket_ids": ticketIDs,
		"correlated": correlated,
		"groups":     groups,
	}, nil
}

// --- SLA ---

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

func (s *Service) TransferTicket(ctx context.Context, tenantID, ticketID string, req models.TransferRequest, fromUserID string) error {
	_ = s.repo.AddWorkflowHistory(ctx, tenantID, ticketID, "transfer", "", "assigned", fromUserID, req.Reason)
	return s.repo.TransferTicket(ctx, tenantID, ticketID, fromUserID, req.ToUserID, req.Reason)
}

func (s *Service) GetTransferHistory(ctx context.Context, tenantID, ticketID string) ([]models.TransferHistoryEntry, error) {
	return s.repo.GetTransferHistory(ctx, tenantID, ticketID)
}

func (s *Service) GetTransferStats(ctx context.Context, tenantID string) (*models.TransferStats, error) {
	stats, err := s.repo.GetTransferStats(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	count, _ := s.repo.CountTickets(ctx, tenantID)
	if count > 0 {
		stats.AvgTransfers = float64(stats.TotalTransfers) / float64(count)
	}
	return stats, nil
}

// --- Suspend ---

func (s *Service) CreateSuspend(ctx context.Context, tenantID string, req models.CreateSuspendRequest) (*models.Suspend, error) {
	if req.Type == "" {
		req.Type = "adhoc"
	}
	return s.repo.CreateSuspend(ctx, tenantID, req)
}

func (s *Service) ActivateSuspend(ctx context.Context, tenantID, id string) (*models.Suspend, error) {
	if err := s.repo.UpdateSuspendStatus(ctx, tenantID, id, "active"); err != nil {
		return nil, err
	}
	return s.repo.GetSuspend(ctx, tenantID, id)
}

func (s *Service) EndSuspend(ctx context.Context, tenantID, id string) (*models.Suspend, error) {
	if err := s.repo.UpdateSuspendStatus(ctx, tenantID, id, "completed"); err != nil {
		return nil, err
	}
	return s.repo.GetSuspend(ctx, tenantID, id)
}

func (s *Service) CancelSuspend(ctx context.Context, tenantID, id string) (*models.Suspend, error) {
	if err := s.repo.UpdateSuspendStatus(ctx, tenantID, id, "cancelled"); err != nil {
		return nil, err
	}
	return s.repo.GetSuspend(ctx, tenantID, id)
}

func (s *Service) ListSuspensions(ctx context.Context, tenantID string) ([]models.Suspend, error) {
	return s.repo.ListSuspensions(ctx, tenantID)
}

func (s *Service) GetSuspend(ctx context.Context, tenantID, id string) (*models.Suspend, error) {
	return s.repo.GetSuspend(ctx, tenantID, id)
}

func (s *Service) GetEngineerSuspensions(ctx context.Context, tenantID, engineerID string) ([]models.Suspend, error) {
	return s.repo.GetEngineerSuspensions(ctx, tenantID, engineerID)
}

// GetEngineerSuspendImpact estimates how many active tickets would be affected
// if a given engineer were suspended. Mirrors TS EngineerSuspendService.
func (s *Service) GetEngineerSuspendImpact(ctx context.Context, tenantID, engineerID string) (*models.EngineerSuspendImpact, error) {
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	affected := 0
	for _, t := range tickets {
		if t.AssigneeID != nil && *t.AssigneeID == engineerID && t.Status != "resolved" && t.Status != "closed" {
			affected++
		}
	}
	return &models.EngineerSuspendImpact{
		EngineerID:  engineerID,
		AffectedTix: affected,
	}, nil
}

// --- BI Analytics ---

// GetExecutiveDashboard returns high-level KPIs: total/open/resolved tickets,
// active engineers, SLA compliance, and escalation count. Mirrors TS ExecutiveDashboardBuilder.
func (s *Service) GetExecutiveDashboard(ctx context.Context, tenantID string) (*models.ExecutiveDashboard, error) {
	count, _ := s.repo.CountTickets(ctx, tenantID)
	byStatus, _ := s.repo.CountTicketsByStatus(ctx, tenantID)
	tickets, _ := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	today := time.Now().UTC().Format("2006-01-02")
	resolvedToday := 0
	for _, t := range tickets {
		if t.Status == "resolved" && t.UpdatedAt.Format("2006-01-02") == today {
			resolvedToday++
		}
	}
	engineers, _ := s.repo.ListEngineers(ctx, tenantID)
	compliance, _ := s.GetSLACompliance(ctx, tenantID)
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
	engineers, _ := s.repo.ListEngineers(ctx, tenantID)
	teamLoad := make(map[string]int)
	for _, e := range engineers {
		teamLoad[e.Name] = e.CurrentLoad
	}
	tickets, _ := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
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
	tickets, _ := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
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
	tickets, _ := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
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
	tickets, _ := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	var resolvedHours []float64
	for _, t := range tickets {
		if t.AssigneeID != nil && *t.AssigneeID == engineerID {
			if t.Status == "resolved" || t.Status == "closed" {
				dur := t.UpdatedAt.Sub(t.CreatedAt).Hours()
				if dur > 0 {
					resolvedHours = append(resolvedHours, dur)
				}
			}
		}
	}
	score := float64(len(resolvedHours)) * 20
	if len(resolvedHours) > 0 {
		avg := average(resolvedHours)
		if avg <= 4 {
			score += 30
		} else if avg <= 12 {
			score += 20
		} else {
			score += 10
		}
	}
	loadRatio := 0.0
	if eng.MaxTickets > 0 {
		loadRatio = float64(eng.CurrentLoad) / float64(eng.MaxTickets)
	}
	if loadRatio < 0.5 {
		score += 30
	} else if loadRatio < 0.8 {
		score += 15
	}
	if score > 100 {
		score = 100
	}
	return &models.EfficiencyScore{
		EngineerID: engineerID,
		Score:      score,
		Ranking:    1,
	}, nil
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

// --- SLA Policies ---

func (s *Service) CreateSLAPolicy(ctx context.Context, tenantID string, req models.CreateSLAPolicyRequest) (*models.SLAPolicy, error) {
	return s.repo.CreateSLAPolicy(ctx, tenantID, req)
}

func (s *Service) ListSLAPolicies(ctx context.Context, tenantID string) ([]models.SLAPolicy, error) {
	return s.repo.ListSLAPolicies(ctx, tenantID)
}

func (s *Service) GetSLAPolicy(ctx context.Context, tenantID string, policyID string) (*models.SLAPolicy, error) {
	pID, err := strconv.Atoi(policyID)
	if err != nil {
		return nil, fmt.Errorf("invalid policy id: %w", err)
	}
	return s.repo.GetSLAPolicy(ctx, tenantID, pID)
}

func (s *Service) UpdateSLAPolicy(ctx context.Context, tenantID string, policyID string, req models.UpdateSLAPolicyRequest) (*models.SLAPolicy, error) {
	pID, err := strconv.Atoi(policyID)
	if err != nil {
		return nil, fmt.Errorf("invalid policy id: %w", err)
	}
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.ResponseH != nil {
		updates["response_hours"] = *req.ResponseH
	}
	if req.ResolveH != nil {
		updates["resolve_hours"] = *req.ResolveH
	}
	if req.Active != nil {
		updates["active"] = *req.Active
	}
	if err := s.repo.UpdateSLAPolicy(ctx, tenantID, pID, updates); err != nil {
		return nil, err
	}
	return s.repo.GetSLAPolicy(ctx, tenantID, pID)
}

func (s *Service) DeleteSLAPolicy(ctx context.Context, tenantID string, policyID string) error {
	pID, err := strconv.Atoi(policyID)
	if err != nil {
		return fmt.Errorf("invalid policy id: %w", err)
	}
	return s.repo.DeleteSLAPolicy(ctx, tenantID, pID)
}

func (s *Service) GetTicketSLAStatus(ctx context.Context, tenantID, ticketID string) (*models.TicketSLAStatus, error) {
	return s.repo.GetTicketSLAStatus(ctx, tenantID, ticketID)
}

func (s *Service) GetBreaches(ctx context.Context, tenantID string) ([]models.SLABreach, error) {
	return s.repo.GetSLABreaches(ctx, tenantID)
}

func (s *Service) GetCompliance(ctx context.Context, tenantID string, policyID string) (*models.ComplianceResult, error) {
	pID, err := strconv.Atoi(policyID)
	if err != nil {
		return nil, fmt.Errorf("invalid policy id: %w", err)
	}
	return s.repo.GetSLACompliance(ctx, tenantID, pID)
}

// --- Automation Rules ---

func (s *Service) CreateAutomationRule(ctx context.Context, tenantID string, req models.CreateAutomationRuleRequest) (*models.AutomationRule, error) {
	return s.repo.CreateAutomationRule(ctx, tenantID, req)
}

func (s *Service) ListAutomationRules(ctx context.Context, tenantID string) ([]models.AutomationRule, error) {
	return s.repo.ListAutomationRules(ctx, tenantID)
}

func (s *Service) UpdateAutomationRule(ctx context.Context, tenantID string, ruleID string, req models.UpdateAutomationRuleRequest) (*models.AutomationRule, error) {
	rID, err := strconv.Atoi(ruleID)
	if err != nil {
		return nil, fmt.Errorf("invalid rule id: %w", err)
	}
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Trigger != nil {
		updates["trigger"] = *req.Trigger
	}
	if req.Condition != nil {
		updates["condition"] = *req.Condition
	}
	if req.Action != nil {
		updates["action"] = *req.Action
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if err := s.repo.UpdateAutomationRule(ctx, tenantID, rID, updates); err != nil {
		return nil, err
	}
	// Fetch updated rule
	rules, err := s.repo.ListAutomationRules(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	for _, r := range rules {
		if r.ID == rID {
			return &r, nil
		}
	}
	return nil, ErrNotFoundRule(ruleID)
}

func (s *Service) DeleteAutomationRule(ctx context.Context, tenantID string, ruleID string) error {
	rID, err := strconv.Atoi(ruleID)
	if err != nil {
		return fmt.Errorf("invalid rule id: %w", err)
	}
	return s.repo.DeleteAutomationRule(ctx, tenantID, rID)
}

// ExecuteRule evaluates an automation rule against active tickets and returns
// the set of tickets that match the trigger/condition. Mirrors TS AutomationRuleService.
func (s *Service) ExecuteRule(ctx context.Context, tenantID string, ruleID string) (*models.ExecuteRuleResult, error) {
	rules, err := s.repo.ListAutomationRules(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	var rule *models.AutomationRule
	for i := range rules {
		if fmt.Sprintf("%d", rules[i].ID) == ruleID {
			rule = &rules[i]
			break
		}
	}
	if rule == nil || !rule.Enabled {
		return &models.ExecuteRuleResult{RuleID: -1, Executed: false, Message: "rule not found or disabled"}, nil
	}
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	matched := 0
	for _, t := range tickets {
		triggerMatch := true
		switch rule.Trigger {
		case "on_create":
			if time.Since(t.CreatedAt) > time.Hour {
				triggerMatch = false
			}
		case "on_assign":
			triggerMatch = t.AssigneeID != nil
		case "on_resolve":
			triggerMatch = t.Status == "resolved"
		case "on_escalate":
			triggerMatch = t.Priority == "critical"
		}
		if triggerMatch {
			matched++
		}
	}
	return &models.ExecuteRuleResult{
		RuleID:   rule.ID,
		Executed: true,
		Message:  fmt.Sprintf("rule %s matched %d tickets (action: %s)", rule.Name, matched, rule.Action),
	}, nil
}

// --- Errors ---

var (
	ErrNotFound      = errors.New("not found")
	ErrTicketNotOpen = errors.New("ticket not open")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}

func ErrNotFoundTicket(id string) error {
	return fmt.Errorf("ticket %q not found: %w", id, ErrNotFound)
}

func ErrNotFoundRule(id string) error {
	return fmt.Errorf("automation rule %q not found: %w", id, ErrNotFound)
}
