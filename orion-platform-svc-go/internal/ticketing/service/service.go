package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"

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
