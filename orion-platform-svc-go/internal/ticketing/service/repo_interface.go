package service

import (
	"context"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/repository"
)

// ticketRepo is the interface that the Service calls into the repository.
// This allows test mocks to substitute for *repository.Repository without
// unsafe pointer casting.
type ticketRepo interface {
	// Service control
	SetServiceActive(ctx context.Context, tenantID string, active bool) error
	IsServiceActive(ctx context.Context, tenantID string) (bool, error)

	// Ticket CRUD
	CreateTicket(ctx context.Context, t *models.Ticket) error
	GetTicket(ctx context.Context, tenantID, id string) (*models.Ticket, error)
	ListTickets(ctx context.Context, tenantID string, q models.TicketListQuery) ([]models.Ticket, error)
	UpdateTicket(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteTicket(ctx context.Context, tenantID, id string) error

	// Counts
	CountTickets(ctx context.Context, tenantID string) (int, error)
	CountTicketsByStatus(ctx context.Context, tenantID string) (map[string]int, error)
	CountTicketsByPriority(ctx context.Context, tenantID string) (map[string]int, error)
	CountTicketsByCategory(ctx context.Context, tenantID string) (map[string]int, error)

	// Workflow history
	AddWorkflowHistory(ctx context.Context, tenantID, ticketID, action, fromState, toState, userID, comment string) error
	GetWorkflowHistory(ctx context.Context, tenantID, ticketID string) ([]models.WorkflowHistoryEntry, error)

	// Ticket assignment
	AssignTicket(ctx context.Context, tenantID, id, assigneeID string) error
	CreateAssignment(ctx context.Context, tenantID, ticketID, assignee, assignedBy, reason string) error

	// SLA tracking
	UpsertSLATracking(ctx context.Context, tenantID, ticketID, priority string, targetMs int64) (*repository.TicketSLATracking, error)
	GetSLATracking(ctx context.Context, tenantID, ticketID string) (*repository.TicketSLATracking, error)
	UpdateSLATracking(ctx context.Context, ticketID string, updates map[string]interface{}) error

	// SLA policies
	CreateSLATarget(ctx context.Context, tenantID string, req models.CreateSLATargetRequest) (*models.SLATarget, error)
	GetTicketSLAStatus(ctx context.Context, tenantID, ticketID string) (*models.TicketSLAStatus, error)
	GetSLABreaches(ctx context.Context, tenantID string) ([]models.SLABreach, error)
	GetSLACompliance(ctx context.Context, tenantID string, policyID int) (*models.ComplianceResult, error)
	CreateSLAPolicy(ctx context.Context, tenantID string, req models.CreateSLAPolicyRequest) (*models.SLAPolicy, error)
	ListSLAPolicies(ctx context.Context, tenantID string) ([]models.SLAPolicy, error)
	GetSLAPolicy(ctx context.Context, tenantID string, policyID int) (*models.SLAPolicy, error)
	UpdateSLAPolicy(ctx context.Context, tenantID string, policyID int, updates map[string]interface{}) error
	DeleteSLAPolicy(ctx context.Context, tenantID string, policyID int) error

	// Assignment rules
	CreateAssignmentRule(ctx context.Context, tenantID string, req models.CreateAssignmentRuleRequest) (*models.AssignmentRule, error)
	ListAssignmentRules(ctx context.Context, tenantID string) ([]models.AssignmentRule, error)
	DeleteAssignmentRule(ctx context.Context, tenantID string, id int) error

	// Relations
	AddRelation(ctx context.Context, tenantID, ticketID, relatedID, relType string) (*models.TicketRelation, error)
	GetRelations(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error)
	FindRelatedTickets(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error)
	DetectDuplicates(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error)

	// Automation rules
	CreateAutomationRule(ctx context.Context, tenantID string, req models.CreateAutomationRuleRequest) (*models.AutomationRule, error)
	ListAutomationRules(ctx context.Context, tenantID string) ([]models.AutomationRule, error)
	UpdateAutomationRule(ctx context.Context, tenantID string, ruleID int, updates map[string]interface{}) error
	DeleteAutomationRule(ctx context.Context, tenantID string, ruleID int) error

	// Dispatch engineers
	RegisterEngineer(ctx context.Context, tenantID string, req models.RegisterEngineerRequest) (*models.DispatchEngineer, error)
	ListEngineers(ctx context.Context, tenantID string) ([]models.DispatchEngineer, error)
	GetEngineer(ctx context.Context, tenantID, id string) (*models.DispatchEngineer, error)

	// Dispatch rules
	AddDispatchRule(ctx context.Context, tenantID string, req models.AddDispatchRuleRequest) (*models.DispatchRule, error)
	ListDispatchRules(ctx context.Context, tenantID string) ([]models.DispatchRule, error)

	// Dispatch weights
	UpdateDispatchWeights(ctx context.Context, tenantID string, weights map[string]int) error
	GetDispatchWeights(ctx context.Context, tenantID string) (map[string]int, error)

	// Dispatch queue
	GetDispatchQueueStatus(ctx context.Context, tenantID string) (*models.QueueStatus, error)
	GetDispatchQueueEntries(ctx context.Context, tenantID string) ([]models.QueueEntry, error)

	// Transfer
	TransferTicket(ctx context.Context, tenantID, ticketID, fromUserID, toUserID, reason string) error
	GetTransferHistory(ctx context.Context, tenantID, ticketID string) ([]models.TransferHistoryEntry, error)
	GetTransferStats(ctx context.Context, tenantID string) (*models.TransferStats, error)

	// Suspend
	CreateSuspend(ctx context.Context, tenantID string, req models.CreateSuspendRequest) (*models.Suspend, error)
	ListSuspensions(ctx context.Context, tenantID string) ([]models.Suspend, error)
	GetSuspend(ctx context.Context, tenantID, id string) (*models.Suspend, error)
	UpdateSuspendStatus(ctx context.Context, tenantID, id, status string) error
	GetEngineerSuspensions(ctx context.Context, tenantID, engineerID string) ([]models.Suspend, error)
}
