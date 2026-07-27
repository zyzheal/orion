package testutil

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/repository"
)

// ---------------------------------------------------------------------------
// MockTicketRepository
// ---------------------------------------------------------------------------

type MockTicketRepository struct {
	Tickets map[string]*models.Ticket
}

func NewMockTicketRepository() *MockTicketRepository {
	return &MockTicketRepository{
		Tickets: make(map[string]*models.Ticket),
	}
}

func (r *MockTicketRepository) CreateTicket(ctx context.Context, t *models.Ticket) error {
	if t.ID == "" {
		t.ID = "mock-" + t.Title
	}
	r.Tickets[t.ID] = t
	return nil
}

func (r *MockTicketRepository) GetTicket(ctx context.Context, tenantID, id string) (*models.Ticket, error) {
	t, ok := r.Tickets[id]
	if !ok {
		return nil, errors.New("ticket not found")
	}
	return t, nil
}

func (r *MockTicketRepository) ListTickets(ctx context.Context, tenantID string, q models.TicketListQuery) ([]models.Ticket, error) {
	var tickets []models.Ticket
	for _, t := range r.Tickets {
		tickets = append(tickets, *t)
	}
	return tickets, nil
}

func (r *MockTicketRepository) UpdateTicket(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	return nil
}

func (r *MockTicketRepository) DeleteTicket(ctx context.Context, tenantID, id string) error {
	delete(r.Tickets, id)
	return nil
}

func (r *MockTicketRepository) UpdateTicketStatus(ctx context.Context, tenantID, id, status string) error {
	t, ok := r.Tickets[id]
	if ok {
		t.Status = status
	}
	return nil
}

func (r *MockTicketRepository) AssignTicket(ctx context.Context, tenantID, id, assigneeID string) error {
	return nil
}

func (r *MockTicketRepository) CountTickets(ctx context.Context, tenantID string) (int, error) {
	return len(r.Tickets), nil
}

func (r *MockTicketRepository) CountTicketsByStatus(ctx context.Context, tenantID string) (map[string]int, error) {
	return nil, nil
}

func (r *MockTicketRepository) CountTicketsByPriority(ctx context.Context, tenantID string) (map[string]int, error) {
	return nil, nil
}

func (r *MockTicketRepository) CountTicketsByCategory(ctx context.Context, tenantID string) (map[string]int, error) {
	return nil, nil
}

// ---------------------------------------------------------------------------
// TicketRepositoryInterface extended methods
// ---------------------------------------------------------------------------

func (r *MockTicketRepository) Create(ctx context.Context, ticket *models.Ticket) error {
	return r.CreateTicket(ctx, ticket)
}

func (r *MockTicketRepository) GetByID(ctx context.Context, id, tenantID string) (*models.Ticket, error) {
	return r.GetTicket(ctx, tenantID, id)
}

func (r *MockTicketRepository) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.Ticket, int, error) {
	tickets, err := r.ListTickets(ctx, tenantID, models.TicketListQuery{})
	return tickets, len(tickets), err
}

func (r *MockTicketRepository) Update(ctx context.Context, ticket *models.Ticket) error {
	return nil
}

func (r *MockTicketRepository) Delete(ctx context.Context, id, tenantID string) error {
	return r.DeleteTicket(ctx, tenantID, id)
}

func (r *MockTicketRepository) UpdateStatus(ctx context.Context, id, tenantID, status string) error {
	return r.UpdateTicketStatus(ctx, tenantID, id, status)
}

func (r *MockTicketRepository) UpdateAssignee(ctx context.Context, id, tenantID, assigneeID string) error {
	return nil
}

func (r *MockTicketRepository) Count(ctx context.Context, tenantID string) (int, error) {
	return r.CountTickets(ctx, tenantID)
}

// ---------------------------------------------------------------------------
// MockSLARepository
// ---------------------------------------------------------------------------

type MockSLARepository struct {
	Targets []models.SLATarget
	Records []models.SLARecord
}

func NewMockSLARepository() *MockSLARepository {
	return &MockSLARepository{}
}

func (r *MockSLARepository) CreateSLATarget(ctx context.Context, tenantID string, req models.CreateSLATargetRequest) (*models.SLATarget, error) {
	return nil, nil
}

func (r *MockSLARepository) GetSLATarget(ctx context.Context, tenantID, priority string) (*models.SLATarget, error) {
	return nil, nil
}

func (r *MockSLARepository) CreateSLAPolicy(ctx context.Context, tenantID string, req models.CreateSLAPolicyRequest) (*models.SLAPolicy, error) {
	return nil, nil
}

func (r *MockSLARepository) ListSLAPolicies(ctx context.Context, tenantID string) ([]models.SLAPolicy, error) {
	return nil, nil
}

func (r *MockSLARepository) GetSLAPolicy(ctx context.Context, tenantID string, policyID int) (*models.SLAPolicy, error) {
	return nil, nil
}

func (r *MockSLARepository) UpdateSLAPolicy(ctx context.Context, tenantID string, policyID int, updates map[string]interface{}) error {
	return nil
}

func (r *MockSLARepository) DeleteSLAPolicy(ctx context.Context, tenantID string, policyID int) error {
	return nil
}

func (r *MockSLARepository) GetTicketSLAStatus(ctx context.Context, tenantID, ticketID string) (*models.TicketSLAStatus, error) {
	return nil, nil
}

func (r *MockSLARepository) GetSLABreaches(ctx context.Context, tenantID string) ([]models.SLABreach, error) {
	return nil, nil
}

func (r *MockSLARepository) GetSLACompliance(ctx context.Context, tenantID string, policyID int) (*models.ComplianceResult, error) {
	return nil, nil
}

func (r *MockSLARepository) UpsertSLATracking(ctx context.Context, tenantID, ticketID, priority string, targetResolutionMs int64) (*repository.TicketSLATracking, error) {
	return nil, nil
}

func (r *MockSLARepository) GetSLATracking(ctx context.Context, tenantID, ticketID string) (*repository.TicketSLATracking, error) {
	if ticketID == "nonexistent" { return nil, errors.New("not found") }
	return &repository.TicketSLATracking{Priority: "medium"}, nil
}

func (r *MockSLARepository) UpdateSLATracking(ctx context.Context, ticketID string, updates map[string]interface{}) error {
	return nil
}

func (r *MockSLARepository) RecordSLABreach(ctx context.Context, tenantID, ticketID, policyID, btype string) error {
	return nil
}

func (r *MockSLARepository) CreateTarget(ctx context.Context, req *models.CreateSLATargetRequest) (*models.SLATarget, error) {
	return nil, nil
}

func (r *MockSLARepository) FindPendingRecords(ctx context.Context) ([]models.SLARecord, error) {
	return r.Records, nil
}

func (r *MockSLARepository) FindBreachedRecords(ctx context.Context) ([]models.SLARecord, error) {
	return nil, nil
}

func (r *MockSLARepository) UpdateRecord(ctx context.Context, rec *models.SLARecord) error {
	return nil
}

func (r *MockSLARepository) GetComplianceReport(ctx context.Context, start, end time.Time) (*models.SLAComplianceReport, error) {
	return nil, nil
}

func (r *MockSLARepository) CreateRecordForTicket(ctx context.Context, ticketID, priority string) error {
	return nil
}

// ---------------------------------------------------------------------------
// MockDispatchRepository
// ---------------------------------------------------------------------------

type MockDispatchRepository struct {
	Engineers []models.EngineerProfile
	Rules     []models.DispatchRule
}

func NewMockDispatchRepository() *MockDispatchRepository {
	return &MockDispatchRepository{}
}

func (r *MockDispatchRepository) RegisterEngineer(ctx context.Context, tenantID string, req models.RegisterEngineerRequest) (*models.DispatchEngineer, error) {
	ep := &models.DispatchEngineer{
		ID:           req.ID,
		Name:         req.Name,
		UserID:       req.UserID,
		Skills:       req.Skills,
		CurrentLoad:  req.CurrentLoad,
		MaxCapacity:  req.MaxCapacity,
		Availability: req.Availability,
		IsActive:     true,
	}
	return ep, nil
}

func (r *MockDispatchRepository) ListEngineers(ctx context.Context, tenantID string) ([]models.DispatchEngineer, error) {
	return nil, nil
}

func (r *MockDispatchRepository) ListEngineersAll(ctx context.Context) ([]models.DispatchEngineer, error) {
	var engineers []models.DispatchEngineer
	for _, ep := range r.Engineers {
		engineers = append(engineers, models.DispatchEngineer{
			ID:          ep.EngineerID,
			Name:        ep.EngineerID,
			CurrentLoad: ep.CurrentLoad,
			MaxCapacity: ep.MaxCapacity,
		})
	}
	return engineers, nil
}

func (r *MockDispatchRepository) GetEngineer(ctx context.Context, tenantID, id string) (*models.DispatchEngineer, error) {
	for _, ep := range r.Engineers {
		if ep.EngineerID == id {
			return &models.DispatchEngineer{ID: id, Name: id}, nil
		}
	}
	return nil, errors.New("engineer not found")
}

func (r *MockDispatchRepository) GetEngineerByID(ctx context.Context, id string) (*models.DispatchEngineer, error) {
	return r.GetEngineer(ctx, "", id)
}

func (r *MockDispatchRepository) AddDispatchRule(ctx context.Context, tenantID string, req models.AddDispatchRuleRequest) (*models.DispatchRule, error) {
	rule := &models.DispatchRule{
		TenantID: tenantID,
		Name:     req.Name,
		Enabled:  true,
	}
	r.Rules = append(r.Rules, *rule)
	return rule, nil
}

func (r *MockDispatchRepository) ListDispatchRules(ctx context.Context, tenantID string) ([]models.DispatchRule, error) {
	return r.Rules, nil
}

func (r *MockDispatchRepository) UpdateDispatchWeights(ctx context.Context, tenantID string, weights map[string]int) error {
	return nil
}

func (r *MockDispatchRepository) GetDispatchWeights(ctx context.Context, tenantID string) (map[string]int, error) {
	return nil, nil
}

func (r *MockDispatchRepository) GetDispatchQueueStatus(ctx context.Context, tenantID string) (*models.QueueStatus, error) {
	return &models.QueueStatus{Pending: 0, Assigned: 0, Total: 0}, nil
}

func (r *MockDispatchRepository) GetDispatchQueueEntries(ctx context.Context, tenantID string) ([]models.QueueEntry, error) {
	return nil, nil
}

func (r *MockDispatchRepository) TransferTicket(ctx context.Context, tenantID, ticketID, fromUserID, toUserID, reason string) error {
	return nil
}

func (r *MockDispatchRepository) GetTransferHistory(ctx context.Context, tenantID, ticketID string) ([]models.TransferHistoryEntry, error) {
	return nil, nil
}

func (r *MockDispatchRepository) SetServiceActive(ctx context.Context, tenantID string, active bool) error {
	return nil
}

func (r *MockDispatchRepository) IsServiceActive(ctx context.Context, tenantID string) (bool, error) {
	return true, nil
}

func (r *MockDispatchRepository) CreateEngineer(ctx context.Context, ep *models.DispatchEngineer) error {
	return nil
}

func (r *MockDispatchRepository) Enqueue(ctx context.Context, ticketID, tenantID, priority string) error {
	return nil
}

func (r *MockDispatchRepository) CreateRecord(ctx context.Context, record *models.DispatchRecord) error {
	return nil
}

func (r *MockDispatchRepository) IncrementLoad(ctx context.Context, engineerID string) error {
	return nil
}

func (r *MockDispatchRepository) DecrementLoad(ctx context.Context, engineerID string) error {
	return nil
}

func (r *MockDispatchRepository) RemoveFromQueue(ctx context.Context, ticketID string) error {
	return nil
}

func (r *MockDispatchRepository) Dequeue(ctx context.Context, limit int) ([]models.DispatchQueueEntry, error) {
	return nil, nil
}

func (r *MockDispatchRepository) GetMetrics(ctx context.Context, start, end time.Time) (*models.DispatchMetrics, error) {
	return nil, nil
}

func (r *MockDispatchRepository) CreateRule(ctx context.Context, rule *models.DispatchRule) error {
	r.Rules = append(r.Rules, *rule)
	return nil
}

func (r *MockDispatchRepository) ListRules(ctx context.Context) ([]models.DispatchRule, error) {
	return r.Rules, nil
}

func (r *MockDispatchRepository) DeleteRule(ctx context.Context, id string) error {
	return nil
}

func (r *MockDispatchRepository) ListRecordsByEngineer(ctx context.Context, engineerID string, limit int) ([]models.DispatchRecord, error) {
	return nil, nil
}

func (r *MockDispatchRepository) GetQueueStatus(ctx context.Context) (*models.DispatchQueueStatus, error) {
	return nil, nil
}

// ---------------------------------------------------------------------------
// MockCommentRepository
// ---------------------------------------------------------------------------

type MockCommentRepository struct{}

func NewMockCommentRepository() *MockCommentRepository {
	return &MockCommentRepository{}
}

func (r *MockCommentRepository) Create(ctx context.Context, comment *models.TicketComment) error {
	return nil
}

func (r *MockCommentRepository) ListByTicket(ctx context.Context, ticketID string) ([]models.TicketComment, error) {
	return nil, nil
}

// ---------------------------------------------------------------------------
// MockWorkflowRepository
// ---------------------------------------------------------------------------

type MockWorkflowRepository struct {
	History []models.WorkflowHistoryEntry
}

func NewMockWorkflowRepository() *MockWorkflowRepository {
	return &MockWorkflowRepository{}
}

func (r *MockWorkflowRepository) AddWorkflowHistory(ctx context.Context, tenantID, ticketID, action, fromState, toState, userID, comment string) error {
	r.History = append(r.History, models.WorkflowHistoryEntry{
		ID: len(r.History) + 1,
		TicketID: ticketID,
		FromState: fromState,
		ToState: toState,
		Action: action,
		UserID: userID,
		Comment: comment,
	})
	return nil
}

func (r *MockWorkflowRepository) GetWorkflowHistory(ctx context.Context, tenantID, ticketID string) ([]models.WorkflowHistoryEntry, error) {
	var out []models.WorkflowHistoryEntry
	for _, h := range r.History {
		if h.TicketID == ticketID {
			out = append(out, h)
		}
	}
	return out, nil
}

func (r *MockWorkflowRepository) UpdateTicketStatus(ctx context.Context, tenantID, id, status string) error {
	return nil
}

func (r *MockWorkflowRepository) GetTicket(ctx context.Context, tenantID, id string) (*models.Ticket, error) {
	return nil, nil
}

func (r *MockWorkflowRepository) Create(ctx context.Context, entry *models.WorkflowHistory) error {
	r.History = append(r.History, models.WorkflowHistoryEntry{
		ID:        len(r.History) + 1,
		TicketID:  entry.TicketID,
		FromState: entry.FromState,
		ToState:   entry.ToState,
		UserID:    entry.UserID,
		Comment:   entry.Comment,
	})
	return nil
}

// ---------------------------------------------------------------------------
// MockAssignmentRuleRepository
// ---------------------------------------------------------------------------

type MockAssignmentRuleRepository struct{}

func NewMockAssignmentRuleRepository() *MockAssignmentRuleRepository {
	return &MockAssignmentRuleRepository{}
}

func (r *MockAssignmentRuleRepository) FindMatching(ctx context.Context, category, priority string) (*models.AssignmentRule, error) {
	return nil, nil
}

func (r *MockAssignmentRuleRepository) Create(ctx context.Context, rule *models.AssignmentRule) error {
	return nil
}

func (r *MockAssignmentRuleRepository) List(ctx context.Context) ([]models.AssignmentRule, error) {
	return nil, nil
}

func (r *MockAssignmentRuleRepository) Delete(ctx context.Context, id string) error {
	return nil
}

// ---------------------------------------------------------------------------
// MockRelationRepository
// ---------------------------------------------------------------------------

type MockRelationRepository struct{}

func NewMockRelationRepository() *MockRelationRepository {
	return &MockRelationRepository{}
}

func (r *MockRelationRepository) AddRelation(ctx context.Context, tenantID, ticketID, relatedID, relType string) (*models.TicketRelation, error) {
	return nil, nil
}

func (r *MockRelationRepository) GetRelations(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error) {
	return nil, nil
}

func (r *MockRelationRepository) FindRelatedTickets(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error) {
	return nil, nil
}

func (r *MockRelationRepository) DetectDuplicates(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error) {
	return nil, nil
}

func (r *MockRelationRepository) Exists(ctx context.Context, ticketID, relatedTicketID, relationType string) (bool, error) {
	return false, nil
}

func (r *MockRelationRepository) Create(ctx context.Context, rel *models.TicketRelation) error {
	return nil
}

func (r *MockRelationRepository) ListByTicket(ctx context.Context, ticketID string) ([]models.TicketRelation, error) {
	return nil, nil
}

func (r *MockRelationRepository) FindSimilar(ctx context.Context, ticketID string, maxResults int) ([]models.TicketRelation, error) {
	return nil, nil
}
