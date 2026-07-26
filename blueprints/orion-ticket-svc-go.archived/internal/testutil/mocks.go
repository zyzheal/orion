package testutil

import (
	"context"
	"fmt"
	"time"

	"orion-ticket-svc-go/internal/models"
)

// TimeNow returns current time (helper for tests)
func TimeNow() time.Time {
	return time.Now()
}

// MockTicketRepository implements repository.TicketRepositoryInterface
type MockTicketRepository struct {
	Tickets  map[string]*models.Ticket
	CreateFn func(ticket *models.Ticket) error
	GetByIDFn func(id, tenantID string) (*models.Ticket, error)
	ListFn   func(tenantID string, q models.ListQuery) ([]models.Ticket, int, error)
	UpdateFn func(ticket *models.Ticket) error
	DeleteFn func(id, tenantID string) error
	UpdateStatusFn   func(id, tenantID, status string) error
	UpdateAssigneeFn func(id, tenantID, assignedTo string) error
	CountFn  func(ctx context.Context, tenantID string) (int, error)
}

func NewMockTicketRepository() *MockTicketRepository {
	return &MockTicketRepository{Tickets: make(map[string]*models.Ticket)}
}

func (m *MockTicketRepository) Create(ctx context.Context, ticket *models.Ticket) error {
	if m.CreateFn != nil {
		return m.CreateFn(ticket)
	}
	m.Tickets[ticket.ID] = ticket
	return nil
}

func (m *MockTicketRepository) GetByID(ctx context.Context, id, tenantID string) (*models.Ticket, error) {
	if m.GetByIDFn != nil {
		return m.GetByIDFn(id, tenantID)
	}
	t, ok := m.Tickets[id]
	if !ok || t.TenantID != tenantID {
		return nil, fmt.Errorf("ticket not found")
	}
	return t, nil
}

func (m *MockTicketRepository) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.Ticket, int, error) {
	if m.ListFn != nil {
		return m.ListFn(tenantID, q)
	}
	var result []models.Ticket
	for _, t := range m.Tickets {
		if t.TenantID == tenantID {
			result = append(result, *t)
		}
	}
	return result, len(result), nil
}

func (m *MockTicketRepository) Update(ctx context.Context, ticket *models.Ticket) error {
	if m.UpdateFn != nil {
		return m.UpdateFn(ticket)
	}
	m.Tickets[ticket.ID] = ticket
	return nil
}

func (m *MockTicketRepository) Delete(ctx context.Context, id, tenantID string) error {
	if m.DeleteFn != nil {
		return m.DeleteFn(id, tenantID)
	}
	delete(m.Tickets, id)
	return nil
}

func (m *MockTicketRepository) UpdateStatus(ctx context.Context, id, tenantID, status string) error {
	if m.UpdateStatusFn != nil {
		return m.UpdateStatusFn(id, tenantID, status)
	}
	if t, ok := m.Tickets[id]; ok {
		t.Status = status
	}
	return nil
}

func (m *MockTicketRepository) UpdateAssignee(ctx context.Context, id, tenantID, assignedTo string) error {
	if m.UpdateAssigneeFn != nil {
		return m.UpdateAssigneeFn(id, tenantID, assignedTo)
	}
	if t, ok := m.Tickets[id]; ok {
		t.AssignedTo = assignedTo
	}
	return nil
}

func (m *MockTicketRepository) Count(ctx context.Context, tenantID string) (int, error) {
	if m.CountFn != nil {
		return m.CountFn(ctx, tenantID)
	}
	count := 0
	for _, t := range m.Tickets {
		if t.TenantID == tenantID {
			count++
		}
	}
	return count, nil
}

// MockCommentRepository implements repository.CommentRepositoryInterface
type MockCommentRepository struct {
	Comments map[string][]models.TicketComment
	CreateFn func(comment *models.TicketComment) error
}

func NewMockCommentRepository() *MockCommentRepository {
	return &MockCommentRepository{Comments: make(map[string][]models.TicketComment)}
}

func (m *MockCommentRepository) Create(ctx context.Context, comment *models.TicketComment) error {
	if m.CreateFn != nil {
		return m.CreateFn(comment)
	}
	m.Comments[comment.TicketID] = append(m.Comments[comment.TicketID], *comment)
	return nil
}

func (m *MockCommentRepository) ListByTicket(ctx context.Context, ticketID string) ([]models.TicketComment, error) {
	return m.Comments[ticketID], nil
}

func (m *MockCommentRepository) Delete(ctx context.Context, id, ticketID string) error {
	comments := m.Comments[ticketID]
	for i, c := range comments {
		if c.ID == id {
			m.Comments[ticketID] = append(comments[:i], comments[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("comment not found")
}

// MockWorkflowRepository implements repository.WorkflowRepositoryInterface
type MockWorkflowRepository struct {
	History []models.WorkflowHistory
	CreateFn func(history *models.WorkflowHistory) error
}

func NewMockWorkflowRepository() *MockWorkflowRepository {
	return &MockWorkflowRepository{}
}

func (m *MockWorkflowRepository) Create(ctx context.Context, history *models.WorkflowHistory) error {
	if m.CreateFn != nil {
		return m.CreateFn(history)
	}
	m.History = append(m.History, *history)
	return nil
}

func (m *MockWorkflowRepository) ListByTicket(ctx context.Context, ticketID string) ([]models.WorkflowHistory, error) {
	var result []models.WorkflowHistory
	for _, h := range m.History {
		if h.TicketID == ticketID {
			result = append(result, h)
		}
	}
	return result, nil
}

// MockAssignmentRuleRepository implements repository.AssignmentRuleRepositoryInterface
type MockAssignmentRuleRepository struct {
	Rules []models.AssignmentRule
	CreateFn func(rule *models.AssignmentRule) error
	FindMatchingFn func(category, priority string) (*models.AssignmentRule, error)
}

func NewMockAssignmentRuleRepository() *MockAssignmentRuleRepository {
	return &MockAssignmentRuleRepository{}
}

func (m *MockAssignmentRuleRepository) Create(ctx context.Context, rule *models.AssignmentRule) error {
	if m.CreateFn != nil {
		return m.CreateFn(rule)
	}
	m.Rules = append(m.Rules, *rule)
	return nil
}

func (m *MockAssignmentRuleRepository) List(ctx context.Context, ) ([]models.AssignmentRule, error) {
	return m.Rules, nil
}

func (m *MockAssignmentRuleRepository) Delete(ctx context.Context, id string) error {
	for i, r := range m.Rules {
		if r.ID == id {
			m.Rules = append(m.Rules[:i], m.Rules[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("not found")
}

func (m *MockAssignmentRuleRepository) FindMatching(ctx context.Context, category, priority string) (*models.AssignmentRule, error) {
	if m.FindMatchingFn != nil {
		return m.FindMatchingFn(category, priority)
	}
	for _, r := range m.Rules {
		if !r.Enabled {
			continue
		}
		catMatch := len(r.Categories) == 0
		for _, c := range r.Categories {
			if c == category {
				catMatch = true
				break
			}
		}
		priMatch := len(r.Priorities) == 0
		for _, p := range r.Priorities {
			if p == priority {
				priMatch = true
				break
			}
		}
		if catMatch && priMatch {
			return &r, nil
		}
	}
	return nil, nil
}

// MockRelationRepository implements repository.RelationRepositoryInterface
type MockRelationRepository struct {
	Relations []models.TicketRelation
}

func NewMockRelationRepository() *MockRelationRepository {
	return &MockRelationRepository{}
}

func (m *MockRelationRepository) Create(ctx context.Context, relation *models.TicketRelation) error {
	m.Relations = append(m.Relations, *relation)
	return nil
}

func (m *MockRelationRepository) ListByTicket(ctx context.Context, ticketID string) ([]models.TicketRelation, error) {
	var result []models.TicketRelation
	for _, r := range m.Relations {
		if r.TicketID == ticketID {
			result = append(result, r)
		}
	}
	return result, nil
}

func (m *MockRelationRepository) Delete(ctx context.Context, id string) error {
	for i, r := range m.Relations {
		if r.ID == id {
			m.Relations = append(m.Relations[:i], m.Relations[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("not found")
}

func (m *MockRelationRepository) Exists(ctx context.Context, ticketID, relatedTicketID, relationType string) (bool, error) {
	for _, r := range m.Relations {
		if r.TicketID == ticketID && r.RelatedTicketID == relatedTicketID && r.RelationType == relationType {
			return true, nil
		}
	}
	return false, nil
}

func (m *MockRelationRepository) FindSimilar(ctx context.Context, ticketID string, limit int) ([]models.TicketRelation, error) {
	var result []models.TicketRelation
	for _, r := range m.Relations {
		if r.TicketID == ticketID {
			result = append(result, r)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

// MockSLARepository implements repository.SLARepositoryInterface
type MockSLARepository struct {
	Targets []models.SLATarget
	Records []models.SLARecord
}

func NewMockSLARepository() *MockSLARepository {
	return &MockSLARepository{}
}

func (m *MockSLARepository) CreateTarget(ctx context.Context, target *models.SLATarget) error {
	m.Targets = append(m.Targets, *target)
	return nil
}

func (m *MockSLARepository) ListTargets(ctx context.Context, ) ([]models.SLATarget, error) {
	return m.Targets, nil
}

func (m *MockSLARepository) GetTargetByPriority(ctx context.Context, priority string) (*models.SLATarget, error) {
	for _, t := range m.Targets {
		if t.Priority == priority && t.Enabled {
			return &t, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (m *MockSLARepository) DeleteTarget(ctx context.Context, id string) error {
	for i, t := range m.Targets {
		if t.ID == id {
			m.Targets = append(m.Targets[:i], m.Targets[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("not found")
}

func (m *MockSLARepository) CreateRecord(ctx context.Context, record *models.SLARecord) error {
	m.Records = append(m.Records, *record)
	return nil
}

func (m *MockSLARepository) GetRecordByTicket(ctx context.Context, ticketID string) (*models.SLARecord, error) {
	for i := range m.Records {
		if m.Records[i].TicketID == ticketID {
			return &m.Records[i], nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (m *MockSLARepository) UpdateRecord(ctx context.Context, record *models.SLARecord) error {
	for i, r := range m.Records {
		if r.ID == record.ID {
			m.Records[i] = *record
			return nil
		}
	}
	return fmt.Errorf("not found")
}

func (m *MockSLARepository) FindBreachedRecords(ctx context.Context, ) ([]models.SLARecord, error) {
	var result []models.SLARecord
	for _, r := range m.Records {
		if r.Breached && r.ResolvedAt == nil {
			result = append(result, r)
		}
	}
	return result, nil
}

func (m *MockSLARepository) FindPendingRecords(ctx context.Context, ) ([]models.SLARecord, error) {
	var result []models.SLARecord
	for _, r := range m.Records {
		if !r.Breached && r.ResolvedAt == nil && !r.Paused {
			result = append(result, r)
		}
	}
	return result, nil
}

func (m *MockSLARepository) PauseRecord(ctx context.Context, ticketID, reason string) error {
	for i, r := range m.Records {
		if r.TicketID == ticketID {
			m.Records[i].Paused = true
			m.Records[i].PausedReason = reason
			now := time.Now()
			m.Records[i].PausedAt = &now
			return nil
		}
	}
	return fmt.Errorf("not found")
}

func (m *MockSLARepository) UnpauseRecord(ctx context.Context, ticketID string) error {
	for i, r := range m.Records {
		if r.TicketID == ticketID {
			m.Records[i].Paused = false
			m.Records[i].PausedReason = ""
			m.Records[i].PausedAt = nil
			return nil
		}
	}
	return fmt.Errorf("not found")
}

func (m *MockSLARepository) GetComplianceReport(ctx context.Context, start, end time.Time) (*models.SLAComplianceReport, error) {
	report := &models.SLAComplianceReport{ByPriority: make(map[string]models.SLAPriorityStats)}
	for _, r := range m.Records {
		report.TotalTickets++
		if r.Breached {
			report.BreachedCount++
		}
	}
	if report.TotalTickets > 0 {
		report.ComplianceRate = float64(report.TotalTickets-report.BreachedCount) / float64(report.TotalTickets) * 100
	}
	return report, nil
}

// MockDispatchRepository implements repository.DispatchRepositoryInterface
type MockDispatchRepository struct {
	Engineers []models.EngineerProfile
	Records   []models.DispatchRecord
	Rules     []models.DispatchRule
	Queue     []models.DispatchQueueEntry
}

func NewMockDispatchRepository() *MockDispatchRepository {
	return &MockDispatchRepository{}
}

func (m *MockDispatchRepository) CreateEngineer(ctx context.Context, ep *models.EngineerProfile) error {
	m.Engineers = append(m.Engineers, *ep)
	return nil
}

func (m *MockDispatchRepository) UpdateEngineer(ctx context.Context, ep *models.EngineerProfile) error {
	for i, e := range m.Engineers {
		if e.ID == ep.ID {
			m.Engineers[i] = *ep
			return nil
		}
	}
	return fmt.Errorf("not found")
}

func (m *MockDispatchRepository) GetEngineer(ctx context.Context, id string) (*models.EngineerProfile, error) {
	for _, e := range m.Engineers {
		if e.ID == id {
			return &e, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (m *MockDispatchRepository) ListEngineers(ctx context.Context, ) ([]models.EngineerProfile, error) {
	return m.Engineers, nil
}

func (m *MockDispatchRepository) IncrementLoad(ctx context.Context, engineerID string) error {
	for i, e := range m.Engineers {
		if e.ID == engineerID {
			m.Engineers[i].CurrentLoad++
			return nil
		}
	}
	return fmt.Errorf("not found")
}

func (m *MockDispatchRepository) DecrementLoad(ctx context.Context, engineerID string) error {
	for i, e := range m.Engineers {
		if e.ID == engineerID && m.Engineers[i].CurrentLoad > 0 {
			m.Engineers[i].CurrentLoad--
			return nil
		}
	}
	return fmt.Errorf("not found")
}

func (m *MockDispatchRepository) CreateRecord(ctx context.Context, rec *models.DispatchRecord) error {
	m.Records = append(m.Records, *rec)
	return nil
}

func (m *MockDispatchRepository) GetRecordByTicket(ctx context.Context, ticketID string) (*models.DispatchRecord, error) {
	for _, r := range m.Records {
		if r.TicketID == ticketID {
			return &r, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (m *MockDispatchRepository) ListRecordsByEngineer(ctx context.Context, engineerID string, limit int) ([]models.DispatchRecord, error) {
	var result []models.DispatchRecord
	for _, r := range m.Records {
		if r.EngineerID == engineerID {
			result = append(result, r)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *MockDispatchRepository) CreateRule(ctx context.Context, rule *models.DispatchRule) error {
	m.Rules = append(m.Rules, *rule)
	return nil
}

func (m *MockDispatchRepository) ListRules(ctx context.Context, ) ([]models.DispatchRule, error) {
	return m.Rules, nil
}

func (m *MockDispatchRepository) DeleteRule(ctx context.Context, id string) error {
	for i, r := range m.Rules {
		if r.ID == id {
			m.Rules = append(m.Rules[:i], m.Rules[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("not found")
}

func (m *MockDispatchRepository) Enqueue(ctx context.Context, ticketID, tenantID, priority string) error {
	m.Queue = append(m.Queue, models.DispatchQueueEntry{
		TicketID: ticketID, TenantID: tenantID, Priority: priority,
	})
	return nil
}

func (m *MockDispatchRepository) Dequeue(ctx context.Context, limit int) ([]models.DispatchQueueEntry, error) {
	if limit > len(m.Queue) {
		limit = len(m.Queue)
	}
	result := m.Queue[:limit]
	m.Queue = m.Queue[limit:]
	return result, nil
}

func (m *MockDispatchRepository) RemoveFromQueue(ctx context.Context, ticketID string) error {
	for i, e := range m.Queue {
		if e.TicketID == ticketID {
			m.Queue = append(m.Queue[:i], m.Queue[i+1:]...)
			return nil
		}
	}
	return nil
}

func (m *MockDispatchRepository) UpdateQueueEntry(ctx context.Context, ticketID, lastError string, attempts int) error {
	for i, e := range m.Queue {
		if e.TicketID == ticketID {
			m.Queue[i].LastError = lastError
			m.Queue[i].Attempts = attempts
			return nil
		}
	}
	return nil
}

func (m *MockDispatchRepository) GetQueueStatus(ctx context.Context, ) (*models.DispatchQueueStatus, error) {
	return &models.DispatchQueueStatus{PendingCount: len(m.Queue)}, nil
}

func (m *MockDispatchRepository) GetMetrics(ctx context.Context, start, end time.Time) (*models.DispatchMetrics, error) {
	metrics := &models.DispatchMetrics{}
	for _, r := range m.Records {
		metrics.TotalDispatches++
		if r.Method == "auto" {
			metrics.AutoDispatches++
		} else {
			metrics.ManualDispatches++
		}
	}
	return metrics, nil
}

// MockSuspendRepository implements repository.SuspendRepositoryInterface
type MockSuspendRepository struct {
	Records []models.SuspendRecord
}

func NewMockSuspendRepository() *MockSuspendRepository {
	return &MockSuspendRepository{}
}

func (m *MockSuspendRepository) Create(ctx context.Context, rec *models.SuspendRecord) error {
	m.Records = append(m.Records, *rec)
	return nil
}

func (m *MockSuspendRepository) GetByID(ctx context.Context, id string) (*models.SuspendRecord, error) {
	for _, r := range m.Records {
		if r.ID == id {
			return &r, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (m *MockSuspendRepository) Update(ctx context.Context, rec *models.SuspendRecord) error {
	for i, r := range m.Records {
		if r.ID == rec.ID {
			m.Records[i] = *rec
			return nil
		}
	}
	return fmt.Errorf("not found")
}

func (m *MockSuspendRepository) ListByStatus(ctx context.Context, status string) ([]models.SuspendRecord, error) {
	var result []models.SuspendRecord
	for _, r := range m.Records {
		if r.Status == status {
			result = append(result, r)
		}
	}
	return result, nil
}

func (m *MockSuspendRepository) ListByEngineer(ctx context.Context, engineerID string) ([]models.SuspendRecord, error) {
	var result []models.SuspendRecord
	for _, r := range m.Records {
		if r.EngineerID == engineerID {
			result = append(result, r)
		}
	}
	return result, nil
}

func (m *MockSuspendRepository) FindActiveByEngineer(ctx context.Context, engineerID string) (*models.SuspendRecord, error) {
	for _, r := range m.Records {
		if r.EngineerID == engineerID && r.Status == "active" {
			return &r, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (m *MockSuspendRepository) CountPendingByEngineer(ctx context.Context, engineerID string) (int, error) {
	count := 0
	for _, r := range m.Records {
		if r.EngineerID == engineerID && r.Status == "pending" {
			count++
		}
	}
	return count, nil
}

func (m *MockSuspendRepository) CountActiveByEngineer(ctx context.Context, engineerID string) (int, error) {
	count := 0
	for _, r := range m.Records {
		if r.EngineerID == engineerID && r.Status == "active" {
			count++
		}
	}
	return count, nil
}

// MockTransferRepository implements repository.TransferRepositoryInterface
type MockTransferRepository struct {
	Records []models.TransferRecord
}

func NewMockTransferRepository() *MockTransferRepository {
	return &MockTransferRepository{}
}

func (m *MockTransferRepository) Create(ctx context.Context, rec *models.TransferRecord) error {
	m.Records = append(m.Records, *rec)
	return nil
}

func (m *MockTransferRepository) ListByTicket(ctx context.Context, ticketID string) ([]models.TransferRecord, error) {
	var result []models.TransferRecord
	for _, r := range m.Records {
		if r.TicketID == ticketID {
			result = append(result, r)
		}
	}
	return result, nil
}

func (m *MockTransferRepository) GetStats(ctx context.Context, start, end time.Time) (map[string]any, error) {
	stats := make(map[string]any)
	stats["total_transfers"] = len(m.Records)
	stats["avg_hold_duration_ms"] = 0
	stats["top_receivers"] = map[string]int{}
	return stats, nil
}

// MockAnalyticsRepository implements repository.AnalyticsRepositoryInterface
type MockAnalyticsRepository struct {
	Stats *models.TicketStatistics
}

func NewMockAnalyticsRepository() *MockAnalyticsRepository {
	return &MockAnalyticsRepository{
		Stats: &models.TicketStatistics{
			ByPriority: make(map[string]int),
			ByCategory: make(map[string]int),
		},
	}
}

func (m *MockAnalyticsRepository) GetTicketStats(ctx context.Context, tenantID string) (*models.TicketStatistics, error) {
	return m.Stats, nil
}

func (m *MockAnalyticsRepository) GetResolutionStats(ctx context.Context, tenantID string) (*models.ResolutionStats, error) {
	return &models.ResolutionStats{
		ByPriority: make(map[string]float64),
		ByCategory: make(map[string]float64),
	}, nil
}

func (m *MockAnalyticsRepository) GetBacklogAnalysis(ctx context.Context, tenantID string) (*models.BacklogAnalysis, error) {
	return &models.BacklogAnalysis{
		ByPriority: make(map[string]int),
		ByCategory: make(map[string]int),
	}, nil
}

func (m *MockAnalyticsRepository) GetTrendData(ctx context.Context, tenantID string, days int, granularity string) ([]models.TrendPoint, error) {
	return nil, nil
}

func (m *MockAnalyticsRepository) GetExecutiveDashboard(ctx context.Context, tenantID string, start, end time.Time) (*models.ExecutiveDashboard, error) {
	return &models.ExecutiveDashboard{
		ByPriority: make(map[string]int),
		ByCategory: make(map[string]int),
	}, nil
}
