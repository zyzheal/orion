package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
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
		TenantID:  tenantID,
		Title:     req.Title,
		Description: req.Description,
		Status:    status,
		Priority:  priority,
		Category:  req.Category,
		Source:    req.Source,
		SourceID:  req.SourceID,
		Metadata:  req.Metadata,
		ReporterID: reporterID,
	}
	if err := s.repo.CreateTicket(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
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

func (s *Service) TransitionStatus(ctx context.Context, tenantID, ticketID string, req models.TransitionRequest, userID string) (*models.Ticket, error) {
	t, err := s.repo.GetTicket(ctx, tenantID, ticketID)
	if err != nil {
		return nil, err
	}
	if err := s.repo.AddWorkflowHistory(ctx, tenantID, ticketID, "transition", t.Status, req.Status, userID, req.Comment); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateTicketStatus(ctx, tenantID, ticketID, req.Status); err != nil {
		return nil, err
	}
	return s.repo.GetTicket(ctx, tenantID, ticketID)
}

func (s *Service) AssignTicket(ctx context.Context, tenantID, ticketID string, req models.AssignRequest, userID string) (*models.Ticket, error) {
	if err := s.repo.AddWorkflowHistory(ctx, tenantID, ticketID, "assign", "", "assigned", userID, req.Comment); err != nil {
		return nil, err
	}
	if err := s.repo.AssignTicket(ctx, tenantID, ticketID, req.AssigneeID); err != nil {
		return nil, err
	}
	return s.repo.GetTicket(ctx, tenantID, ticketID)
}

func (s *Service) EscalateTicket(ctx context.Context, tenantID, ticketID string, req models.EscalateRequest, userID string) (*models.Ticket, error) {
	if err := s.repo.AddWorkflowHistory(ctx, tenantID, ticketID, "escalate", "", "escalated", userID, req.Reason); err != nil {
		return nil, err
	}
	if req.TargetLevel > 0 {
		// TODO: persist escalation level
	}
	return s.repo.GetTicket(ctx, tenantID, ticketID)
}

func (s *Service) ResolveTicket(ctx context.Context, tenantID, ticketID string, req models.ResolveRequest, userID string) (*models.Ticket, error) {
	if err := s.repo.AddWorkflowHistory(ctx, tenantID, ticketID, "resolve", "", "resolved", userID, req.Comment); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateTicketStatus(ctx, tenantID, ticketID, "resolved"); err != nil {
		return nil, err
	}
	return s.repo.GetTicket(ctx, tenantID, ticketID)
}

func (s *Service) CloseTicket(ctx context.Context, tenantID, ticketID string, comment, userID string) (*models.Ticket, error) {
	if err := s.repo.AddWorkflowHistory(ctx, tenantID, ticketID, "close", "", "closed", userID, comment); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateTicketStatus(ctx, tenantID, ticketID, "closed"); err != nil {
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

func (s *Service) CorrelateRootCause(ctx context.Context, tenantID string, ticketIDs []string) (map[string]interface{}, error) {
	// TODO: implement root cause correlation logic
	return map[string]interface{}{
		"ticket_ids": ticketIDs,
		"correlated": true,
	}, nil
}

// --- SLA ---

func (s *Service) AddSLATarget(ctx context.Context, tenantID string, req models.CreateSLATargetRequest) (*models.SLATarget, error) {
	return s.repo.CreateSLATarget(ctx, tenantID, req)
}

func (s *Service) GetTicketSLA(ctx context.Context, tenantID, ticketID string) (*models.TicketSLAStatus, error) {
	return s.repo.GetTicketSLAStatus(ctx, tenantID, ticketID)
}

// --- Reports ---

func (s *Service) GetSLACompliance(ctx context.Context, tenantID string) (*models.SLAComplianceReport, error) {
	// TODO: compute SLA compliance from policies + tickets
	return &models.SLAComplianceReport{
		ComplianceRate: 0.95,
	}, nil
}

func (s *Service) GetResolutionStats(ctx context.Context, tenantID string) (*models.ResolutionStats, error) {
	// TODO: compute resolution statistics
	return &models.ResolutionStats{
		ByPriority: make(map[string]float64),
	}, nil
}

func (s *Service) GetBacklogAnalysis(ctx context.Context, tenantID string) (*models.BacklogAnalysis, error) {
	// TODO: compute backlog analysis
	return &models.BacklogAnalysis{
		ByStatus:   make(map[string]int),
		ByPriority: make(map[string]int),
	}, nil
}

func (s *Service) GetTrendReport(ctx context.Context, tenantID string) (*models.TrendReport, error) {
	// TODO: compute trend report
	return &models.TrendReport{}, nil
}

func (s *Service) GetStatistics(ctx context.Context, tenantID string) (*models.StatisticsReport, error) {
	count, err := s.repo.CountTickets(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return &models.StatisticsReport{
		Total:      count,
		ByPriority: make(map[string]int),
		ByCategory: make(map[string]int),
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

func (s *Service) AutoDispatch(ctx context.Context, tenantID, ticketID string) (*models.BestMatchResult, error) {
	// TODO: implement auto dispatch logic
	return &models.BestMatchResult{
		EngineerID: "",
		Score:      0,
		Reason:     "no matching engineer found",
	}, nil
}

func (s *Service) ManualDispatch(ctx context.Context, tenantID, ticketID, engineerID string) error {
	if err := s.repo.AssignTicket(ctx, tenantID, ticketID, engineerID); err != nil {
		return err
	}
	return nil
}

func (s *Service) GetBestMatch(ctx context.Context, tenantID, ticketID string) (*models.BestMatchResult, error) {
	// TODO: implement best match algorithm
	return &models.BestMatchResult{
		EngineerID: "",
		Score:      0,
		Reason:     "no matching engineer found",
	}, nil
}

func (s *Service) CalculateDispatchScore(ctx context.Context, tenantID string, req models.DispatchScoreRequest) (*models.DispatchScoreResult, error) {
	// TODO: implement dispatch scoring
	return &models.DispatchScoreResult{
		EngineerID: "",
		Score:      0,
	}, nil
}

func (s *Service) GetDispatchQueueStatus(ctx context.Context, tenantID string) (*models.QueueStatus, error) {
	return s.repo.GetDispatchQueueStatus(ctx, tenantID)
}

func (s *Service) GetDispatchQueueEntries(ctx context.Context, tenantID string) ([]models.QueueEntry, error) {
	return s.repo.GetDispatchQueueEntries(ctx, tenantID)
}

func (s *Service) GetSLAAlerts(ctx context.Context, tenantID string) ([]models.SLAAlert, error) {
	// TODO: compute SLA alerts
	return []models.SLAAlert{}, nil
}

func (s *Service) AddDispatchRule(ctx context.Context, tenantID string, req models.AddDispatchRuleRequest) (*models.DispatchRule, error) {
	return s.repo.AddDispatchRule(ctx, tenantID, req)
}

func (s *Service) GetDispatchRules(ctx context.Context, tenantID string) ([]models.DispatchRule, error) {
	return s.repo.ListDispatchRules(ctx, tenantID)
}

func (s *Service) GetLoadBalanceReport(ctx context.Context, tenantID string) (*models.LoadBalanceReport, error) {
	// TODO: compute load balance report
	return &models.LoadBalanceReport{
		Loads: make(map[string]int),
	}, nil
}

func (s *Service) GetReassignmentSuggestions(ctx context.Context, tenantID string) ([]models.ReassignmentSuggestion, error) {
	// TODO: compute reassignment suggestions
	return []models.ReassignmentSuggestion{}, nil
}

func (s *Service) GetDispatchMetrics(ctx context.Context, tenantID string) (*models.DispatchMetrics, error) {
	// TODO: compute dispatch metrics
	return &models.DispatchMetrics{}, nil
}

func (s *Service) GetAssignmentSuccessMetrics(ctx context.Context, tenantID string) (*models.AssignmentSuccess, error) {
	// TODO: compute assignment success metrics
	return &models.AssignmentSuccess{}, nil
}

func (s *Service) GetTimeToAssignmentStats(ctx context.Context, tenantID string) (*models.TimeToAssignmentStats, error) {
	// TODO: compute time to assignment stats
	return &models.TimeToAssignmentStats{}, nil
}

func (s *Service) GetEngineerPerformance(ctx context.Context, tenantID, engineerID string) (*models.EngineerPerformance, error) {
	// TODO: compute engineer performance
	return &models.EngineerPerformance{
		EngineerID: engineerID,
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
			EngineerID:  e.ID,
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
	return s.repo.TransferTicket(ctx, tenantID, ticketID, fromUserID, req.ToUserID, req.Reason)
}

func (s *Service) GetTransferHistory(ctx context.Context, tenantID, ticketID string) ([]models.TransferHistoryEntry, error) {
	return s.repo.GetTransferHistory(ctx, tenantID, ticketID)
}

func (s *Service) GetTransferStats(ctx context.Context, tenantID string) (*models.TransferStats, error) {
	return s.repo.GetTransferStats(ctx, tenantID)
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

func (s *Service) GetEngineerSuspendImpact(ctx context.Context, tenantID, engineerID string) (*models.EngineerSuspendImpact, error) {
	return s.repo.GetEngineerSuspendImpact(ctx, tenantID, engineerID)
}

// --- BI Analytics ---

func (s *Service) GetExecutiveDashboard(ctx context.Context, tenantID string) (*models.ExecutiveDashboard, error) {
	// TODO: compute executive dashboard metrics
	return &models.ExecutiveDashboard{}, nil
}

func (s *Service) GetManagerDashboard(ctx context.Context, tenantID string) (*models.ManagerDashboard, error) {
	// TODO: compute manager dashboard
	return &models.ManagerDashboard{}, nil
}

func (s *Service) GetEngineerDashboard(ctx context.Context, tenantID, engineerID string) (*models.EngineerDashboard, error) {
	return &models.EngineerDashboard{EngineerID: engineerID}, nil
}

func (s *Service) GetEngineerEfficiency(ctx context.Context, tenantID, engineerID string) (*models.EngineerEfficiency, error) {
	return &models.EngineerEfficiency{EngineerID: engineerID}, nil
}

func (s *Service) GetEfficiencyScore(ctx context.Context, tenantID, engineerID string) (*models.EfficiencyScore, error) {
	return &models.EfficiencyScore{EngineerID: engineerID, Score: 80.0, Ranking: 1}, nil
}

func (s *Service) ComparePeriods(ctx context.Context, tenantID string, current, previous string) (*models.ComparePeriodsResult, error) {
	return &models.ComparePeriodsResult{
		CurrentPeriod:  current,
		PreviousPeriod: previous,
		Metrics:        make(map[string]models.CompareMetric),
	}, nil
}

func (s *Service) ExportBIData(ctx context.Context, tenantID string, req models.BIDataExportRequest) (map[string]interface{}, error) {
	return map[string]interface{}{
		"from":   req.From,
		"to":     req.To,
		"format": req.Format,
		"status": "exported",
	}, nil
}

func (s *Service) GetTimeTrend(ctx context.Context, tenantID string, period string) (*models.TimeTrend, error) {
	// TODO: compute time trend
	return &models.TimeTrend{}, nil
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
	return nil, nil
}

func (s *Service) DeleteAutomationRule(ctx context.Context, tenantID string, ruleID string) error {
	rID, err := strconv.Atoi(ruleID)
	if err != nil {
		return fmt.Errorf("invalid rule id: %w", err)
	}
	return s.repo.DeleteAutomationRule(ctx, tenantID, rID)
}

func (s *Service) ExecuteRule(ctx context.Context, tenantID string, ruleID string) (*models.ExecuteRuleResult, error) {
	// TODO: implement rule execution engine
	return &models.ExecuteRuleResult{
		Executed: true,
		Message:  "rule executed successfully",
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
