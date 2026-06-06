package repository

import (
	"context"
	"time"

	"orion-ticket-svc-go/internal/models"
)

// TicketRepositoryInterface abstracts ticket data access
type TicketRepositoryInterface interface {
	Create(ticket *models.Ticket) error
	GetByID(id, tenantID string) (*models.Ticket, error)
	List(tenantID string, q models.ListQuery) ([]models.Ticket, int, error)
	Update(ticket *models.Ticket) error
	Delete(id, tenantID string) error
	UpdateStatus(id, tenantID, status string) error
	UpdateAssignee(id, tenantID, assignedTo string) error
	Count(ctx context.Context, tenantID string) (int, error)
}

// CommentRepositoryInterface abstracts comment data access
type CommentRepositoryInterface interface {
	Create(comment *models.TicketComment) error
	ListByTicket(ticketID string) ([]models.TicketComment, error)
	Delete(id, ticketID string) error
}

// WorkflowRepositoryInterface abstracts workflow history data access
type WorkflowRepositoryInterface interface {
	Create(history *models.WorkflowHistory) error
	ListByTicket(ticketID string) ([]models.WorkflowHistory, error)
}

// RelationRepositoryInterface abstracts ticket relation data access
type RelationRepositoryInterface interface {
	Create(relation *models.TicketRelation) error
	ListByTicket(ticketID string) ([]models.TicketRelation, error)
	Delete(id string) error
	Exists(ticketID, relatedTicketID, relationType string) (bool, error)
	FindSimilar(ticketID string, limit int) ([]models.TicketRelation, error)
}

// SLARepositoryInterface abstracts SLA data access
type SLARepositoryInterface interface {
	CreateTarget(target *models.SLATarget) error
	ListTargets() ([]models.SLATarget, error)
	GetTargetByPriority(priority string) (*models.SLATarget, error)
	DeleteTarget(id string) error
	CreateRecord(record *models.SLARecord) error
	GetRecordByTicket(ticketID string) (*models.SLARecord, error)
	UpdateRecord(record *models.SLARecord) error
	FindBreachedRecords() ([]models.SLARecord, error)
	FindPendingRecords() ([]models.SLARecord, error)
	PauseRecord(ticketID, reason string) error
	UnpauseRecord(ticketID string) error
	GetComplianceReport(start, end time.Time) (*models.SLAComplianceReport, error)
}

// DispatchRepositoryInterface abstracts dispatch data access
type DispatchRepositoryInterface interface {
	CreateEngineer(ep *models.EngineerProfile) error
	UpdateEngineer(ep *models.EngineerProfile) error
	GetEngineer(id string) (*models.EngineerProfile, error)
	ListEngineers() ([]models.EngineerProfile, error)
	IncrementLoad(engineerID string) error
	DecrementLoad(engineerID string) error
	CreateRecord(rec *models.DispatchRecord) error
	GetRecordByTicket(ticketID string) (*models.DispatchRecord, error)
	ListRecordsByEngineer(engineerID string, limit int) ([]models.DispatchRecord, error)
	CreateRule(rule *models.DispatchRule) error
	ListRules() ([]models.DispatchRule, error)
	DeleteRule(id string) error
	Enqueue(ticketID, tenantID, priority string) error
	Dequeue(limit int) ([]models.DispatchQueueEntry, error)
	RemoveFromQueue(ticketID string) error
	UpdateQueueEntry(ticketID, lastError string, attempts int) error
	GetQueueStatus() (*models.DispatchQueueStatus, error)
	GetMetrics(start, end time.Time) (*models.DispatchMetrics, error)
}

// SuspendRepositoryInterface abstracts suspend data access
type SuspendRepositoryInterface interface {
	Create(rec *models.SuspendRecord) error
	GetByID(id string) (*models.SuspendRecord, error)
	Update(rec *models.SuspendRecord) error
	ListByStatus(status string) ([]models.SuspendRecord, error)
	ListByEngineer(engineerID string) ([]models.SuspendRecord, error)
	FindActiveByEngineer(engineerID string) (*models.SuspendRecord, error)
	CountPendingByEngineer(engineerID string) (int, error)
	CountActiveByEngineer(engineerID string) (int, error)
}

// TransferRepositoryInterface abstracts transfer data access
type TransferRepositoryInterface interface {
	Create(rec *models.TransferRecord) error
	ListByTicket(ticketID string) ([]models.TransferRecord, error)
	GetStats(start, end time.Time) (map[string]any, error)
}

// AnalyticsRepositoryInterface abstracts analytics data access
type AnalyticsRepositoryInterface interface {
	GetTicketStats(tenantID string) (*models.TicketStatistics, error)
	GetResolutionStats(tenantID string) (*models.ResolutionStats, error)
	GetBacklogAnalysis(tenantID string) (*models.BacklogAnalysis, error)
	GetTrendData(tenantID string, days int, granularity string) ([]models.TrendPoint, error)
	GetExecutiveDashboard(tenantID string, start, end time.Time) (*models.ExecutiveDashboard, error)
}

// AssignmentRuleRepositoryInterface abstracts assignment rule data access
type AssignmentRuleRepositoryInterface interface {
	Create(rule *models.AssignmentRule) error
	List() ([]models.AssignmentRule, error)
	Delete(id string) error
	FindMatching(category, priority string) (*models.AssignmentRule, error)
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
