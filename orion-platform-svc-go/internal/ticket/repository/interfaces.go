package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/ticket/models"
)

// TicketRepositoryInterface abstracts ticket data access
type TicketRepositoryInterface interface {
	Create(ctx context.Context, ticket *models.Ticket) error
	GetByID(ctx context.Context, id, tenantID string) (*models.Ticket, error)
	List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.Ticket, int, error)
	Update(ctx context.Context, ticket *models.Ticket) error
	Delete(ctx context.Context, id, tenantID string) error
	UpdateStatus(ctx context.Context, id, tenantID, status string) error
	UpdateAssignee(ctx context.Context, id, tenantID, assignedTo string) error
	Count(ctx context.Context, tenantID string) (int, error)
}

// CommentRepositoryInterface abstracts comment data access
type CommentRepositoryInterface interface {
	Create(ctx context.Context, comment *models.TicketComment) error
	ListByTicket(ctx context.Context, ticketID string) ([]models.TicketComment, error)
	Delete(ctx context.Context, id, ticketID string) error
}

// WorkflowRepositoryInterface abstracts workflow history data access
type WorkflowRepositoryInterface interface {
	Create(ctx context.Context, history *models.WorkflowHistory) error
	ListByTicket(ctx context.Context, ticketID string) ([]models.WorkflowHistory, error)
}

// RelationRepositoryInterface abstracts ticket relation data access
type RelationRepositoryInterface interface {
	Create(ctx context.Context, relation *models.TicketRelation) error
	ListByTicket(ctx context.Context, ticketID string) ([]models.TicketRelation, error)
	Delete(ctx context.Context, id string) error
	Exists(ctx context.Context, ticketID, relatedTicketID, relationType string) (bool, error)
	FindSimilar(ctx context.Context, ticketID string, limit int) ([]models.TicketRelation, error)
}

// SLARepositoryInterface abstracts SLA data access
type SLARepositoryInterface interface {
	CreateTarget(ctx context.Context, target *models.SLATarget) error
	ListTargets(ctx context.Context) ([]models.SLATarget, error)
	GetTargetByPriority(ctx context.Context, priority string) (*models.SLATarget, error)
	DeleteTarget(ctx context.Context, id string) error
	CreateRecord(ctx context.Context, record *models.SLARecord) error
	GetRecordByTicket(ctx context.Context, ticketID string) (*models.SLARecord, error)
	UpdateRecord(ctx context.Context, record *models.SLARecord) error
	FindBreachedRecords(ctx context.Context) ([]models.SLARecord, error)
	FindPendingRecords(ctx context.Context) ([]models.SLARecord, error)
	PauseRecord(ctx context.Context, ticketID, reason string) error
	UnpauseRecord(ctx context.Context, ticketID string) error
	GetComplianceReport(ctx context.Context, start, end time.Time) (*models.SLAComplianceReport, error)
}

// DispatchRepositoryInterface abstracts dispatch data access
type DispatchRepositoryInterface interface {
	CreateEngineer(ctx context.Context, ep *models.EngineerProfile) error
	UpdateEngineer(ctx context.Context, ep *models.EngineerProfile) error
	GetEngineer(ctx context.Context, id string) (*models.EngineerProfile, error)
	ListEngineers(ctx context.Context) ([]models.EngineerProfile, error)
	IncrementLoad(ctx context.Context, engineerID string) error
	DecrementLoad(ctx context.Context, engineerID string) error
	CreateRecord(ctx context.Context, rec *models.DispatchRecord) error
	GetRecordByTicket(ctx context.Context, ticketID string) (*models.DispatchRecord, error)
	ListRecordsByEngineer(ctx context.Context, engineerID string, limit int) ([]models.DispatchRecord, error)
	CreateRule(ctx context.Context, rule *models.DispatchRule) error
	ListRules(ctx context.Context) ([]models.DispatchRule, error)
	DeleteRule(ctx context.Context, id string) error
	Enqueue(ctx context.Context, ticketID, tenantID, priority string) error
	Dequeue(ctx context.Context, limit int) ([]models.DispatchQueueEntry, error)
	RemoveFromQueue(ctx context.Context, ticketID string) error
	UpdateQueueEntry(ctx context.Context, ticketID, lastError string, attempts int) error
	GetQueueStatus(ctx context.Context) (*models.DispatchQueueStatus, error)
	GetMetrics(ctx context.Context, start, end time.Time) (*models.DispatchMetrics, error)
}

// SuspendRepositoryInterface abstracts suspend data access
type SuspendRepositoryInterface interface {
	Create(ctx context.Context, rec *models.SuspendRecord) error
	GetByID(ctx context.Context, id string) (*models.SuspendRecord, error)
	Update(ctx context.Context, rec *models.SuspendRecord) error
	ListByStatus(ctx context.Context, status string) ([]models.SuspendRecord, error)
	ListByEngineer(ctx context.Context, engineerID string) ([]models.SuspendRecord, error)
	FindActiveByEngineer(ctx context.Context, engineerID string) (*models.SuspendRecord, error)
	CountPendingByEngineer(ctx context.Context, engineerID string) (int, error)
	CountActiveByEngineer(ctx context.Context, engineerID string) (int, error)
}

// TransferRepositoryInterface abstracts transfer data access
type TransferRepositoryInterface interface {
	Create(ctx context.Context, rec *models.TransferRecord) error
	ListByTicket(ctx context.Context, ticketID string) ([]models.TransferRecord, error)
	GetStats(ctx context.Context, start, end time.Time) (map[string]any, error)
}

// AnalyticsRepositoryInterface abstracts analytics data access
type AnalyticsRepositoryInterface interface {
	GetTicketStats(ctx context.Context, tenantID string) (*models.TicketStatistics, error)
	GetResolutionStats(ctx context.Context, tenantID string) (*models.ResolutionStats, error)
	GetBacklogAnalysis(ctx context.Context, tenantID string) (*models.BacklogAnalysis, error)
	GetTrendData(ctx context.Context, tenantID string, days int, granularity string) ([]models.TrendPoint, error)
	GetExecutiveDashboard(ctx context.Context, tenantID string, start, end time.Time) (*models.ExecutiveDashboard, error)
}

// AssignmentRuleRepositoryInterface abstracts assignment rule data access
type AssignmentRuleRepositoryInterface interface {
	Create(ctx context.Context, rule *models.AssignmentRule) error
	List(ctx context.Context) ([]models.AssignmentRule, error)
	Delete(ctx context.Context, id string) error
	FindMatching(ctx context.Context, category, priority string) (*models.AssignmentRule, error)
}

// Compile-time interface compliance checks
var _ TicketRepositoryInterface = (*TicketRepository)(nil)
var _ CommentRepositoryInterface = (*CommentRepository)(nil)
var _ WorkflowRepositoryInterface = (*WorkflowRepository)(nil)
var _ RelationRepositoryInterface = (*RelationRepository)(nil)
var _ SLARepositoryInterface = (*SLARepository)(nil)
var _ DispatchRepositoryInterface = (*DispatchRepository)(nil)
var _ SuspendRepositoryInterface = (*SuspendRepository)(nil)
var _ TransferRepositoryInterface = (*TransferRepository)(nil)
var _ AnalyticsRepositoryInterface = (*AnalyticsRepository)(nil)
var _ AssignmentRuleRepositoryInterface = (*AssignmentRuleRepository)(nil)
