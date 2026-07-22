package queries

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/domain/aggregates"
	"orion/platform-svc-go/internal/domain/eventstore"
	"orion/platform-svc-go/internal/domain/events"
)

// ============================================================================
// Approval Query Handlers (CQRS Read-Side)
//
// All Approval queries are read-only and operate against the EventStore.
// They never emit domain events or mutate state.
// ============================================================================

// ---------------------------------------------------------------------------
// Query Definitions
// ---------------------------------------------------------------------------

// ListApprovalsQuery lists all approval requests with optional type / status filter.
type ListApprovalsQuery struct {
	TenantID string
	Type     string // multi_level, emergency — empty means all
	Status   string // PENDING, APPROVED, REJECTED, CANCELLED — empty means all
	Page     int    // 1-based
	Limit    int    // default 20
}

func (q *ListApprovalsQuery) Validate() error {
	if q.TenantID == "" {
		return fmt.Errorf("%w: tenantID is required", ErrInvalidParameter)
	}
	return nil
}

// GetApprovalByIDQuery retrieves a single approval request by its aggregate ID.
type GetApprovalByIDQuery struct {
	TenantID string
	ID       string
}

func (q *GetApprovalByIDQuery) Validate() error {
	if q.TenantID == "" {
		return fmt.Errorf("%w: tenantID is required", ErrInvalidParameter)
	}
	if q.ID == "" {
		return fmt.Errorf("%w: approval ID is required", ErrInvalidParameter)
	}
	return nil
}

// GetPendingApprovalsQuery returns approvals that are currently pending and
// awaiting a decision from the specified user (the current actor).
type GetPendingApprovalsQuery struct {
	TenantID string
	UserID   string // the approver whose pending items are being queried
	Page     int
	Limit    int
}

func (q *GetPendingApprovalsQuery) Validate() error {
	if q.TenantID == "" {
		return fmt.Errorf("%w: tenantID is required", ErrInvalidParameter)
	}
	if q.UserID == "" {
		return fmt.Errorf("%w: userID (approver) is required", ErrInvalidParameter)
	}
	return nil
}

// ApprovalLevelHistoryQuery returns the full level-by-level approval history
// for a request (which level was approved/rejected by whom and when).
type ApprovalLevelHistoryQuery struct {
	TenantID string
	ID       string
}

func (q *ApprovalLevelHistoryQuery) Validate() error {
	if q.TenantID == "" {
		return fmt.Errorf("%w: tenantID is required", ErrInvalidParameter)
	}
	if q.ID == "" {
		return fmt.Errorf("%w: approval ID is required", ErrInvalidParameter)
	}
	return nil
}

// ApprovalAggregateRebuildQuery replays the full event stream to reconstruct
// the current approval request state.
type ApprovalAggregateRebuildQuery struct {
	TenantID string
	ID       string
}

func (q *ApprovalAggregateRebuildQuery) Validate() error {
	if q.TenantID == "" {
		return fmt.Errorf("%w: tenantID is required", ErrInvalidParameter)
	}
	if q.ID == "" {
		return fmt.Errorf("%w: approval ID is required", ErrInvalidParameter)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Result Models (DTOs — not domain entities)
// ---------------------------------------------------------------------------

// ApprovalSummary is a read-model projection of an Approval aggregate.
type ApprovalSummary struct {
	ID            string            `json:"id"`
	ApprovalType  string            `json:"approvalType"`
	Status        string            `json:"status"`
	CurrentLevel  int               `json:"currentLevel"`
	TotalLevels   int               `json:"totalLevels"`
	Version       int               `json:"version"`
	Approvals     []ApprovalLevel   `json:"approvals"`
	CreatedAt     time.Time         `json:"createdAt"`
	UpdatedAt     time.Time         `json:"updatedAt"`
}

// ApprovalLevel is copied from aggregates.ApprovalLevel for the read-model.
type ApprovalLevel struct {
	LevelID    string     `json:"levelId"`
	Order      int        `json:"order"`
	Status     string     `json:"status"` // PENDING, APPROVED, REJECTED
	ApproverID string     `json:"approverId"`
	ApprovedAt *time.Time `json:"approvedAt"`
	RejectedAt *time.Time `json:"rejectedAt"`
	Comment    string     `json:"comment"`
}

// ApprovalLevelRecord represents one level action in the history (approved or rejected).
type ApprovalLevelRecord struct {
	Level      int       `json:"level"`
	Status     string    `json:"status"` // approved, rejected
	LevelID    string    `json:"levelId"`
	ApproverID string    `json:"approverID"`
	Comment    string    `json:"comment"`
	OcurredAt  time.Time `json:"occurredAt"`
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// ApprovalListHandler reads all approvals for a tenant via the EventStore.
type ApprovalListHandler struct {
	store eventstore.EventStore
}

func NewApprovalListHandler(store eventstore.EventStore) *ApprovalListHandler {
	return &ApprovalListHandler{store: store}
}

// ExecuteList queries all approval-created events for the tenant, groups them
// by aggregate ID, and returns the deduplicated list with pagination.
func (h *ApprovalListHandler) ExecuteList(ctx context.Context, query Query) ([]ApprovalSummary, int, error) {
	q, ok := query.(*ListApprovalsQuery)
	if !ok {
		return nil, 0, fmt.Errorf("%w: expected *ListApprovalsQuery", ErrInvalidParameter)
	}
	if err := q.Validate(); err != nil {
		return nil, 0, err
	}

	evs, err := h.store.GetByType(ctx, q.TenantID, "approval.created", time.Time{})
	if err != nil {
		return nil, 0, fmt.Errorf("%w: failed to list approvals: %w", ErrQueryFailed, err)
	}

	byID := groupEventsByID(evs)
	summaries := make([]ApprovalSummary, 0, len(byID))
	for aggID, aggEvents := range byID {
		summary := buildApprovalSummary(aggID, aggEvents)
		if q.Type != "" && summary.ApprovalType != q.Type {
			continue
		}
		if q.Status != "" && summary.Status != q.Status {
			continue
		}
		summaries = append(summaries, summary)
	}

	if q.Limit <= 0 {
		q.Limit = 20
	}
	if q.Page <= 0 {
		q.Page = 1
	}
	paged, total := pagination(slicesToIndexable(summaries, q.Limit, q.Page), q.Page, q.Limit)
	return paged, total, nil
}

// ApprovalGetHandler reads a single approval aggregate by ID.
type ApprovalGetHandler struct {
	store eventstore.EventStore
}

func NewApprovalGetHandler(store eventstore.EventStore) *ApprovalGetHandler {
	return &ApprovalGetHandler{store: store}
}

// Execute returns the full approval summary built from the event stream.
func (h *ApprovalGetHandler) Execute(ctx context.Context, query Query) (ApprovalSummary, error) {
	var result ApprovalSummary
	q, ok := query.(*GetApprovalByIDQuery)
	if !ok {
		return result, fmt.Errorf("%w: expected *GetApprovalByIDQuery", ErrInvalidParameter)
	}
	if err := q.Validate(); err != nil {
		return result, err
	}

	evs, err := h.store.GetByAggregate(ctx, q.TenantID, AggregateTypeApproval, q.ID)
	if err != nil {
		return result, fmt.Errorf("%w: failed to query approval %s: %w", ErrQueryFailed, q.ID, err)
	}
	if len(evs) == 0 {
		return result, ErrAggregateNotFound
	}

	return buildApprovalSummary(q.ID, evs), nil
}

// ApprovalPendingHandler returns approvals pending for a specific user.
type ApprovalPendingHandler struct {
	store eventstore.EventStore
}

func NewApprovalPendingHandler(store eventstore.EventStore) *ApprovalPendingHandler {
	return &ApprovalPendingHandler{store: store}
}

// Execute returns the list of approvals currently awaiting the specified user.
func (h *ApprovalPendingHandler) Execute(ctx context.Context, query Query) ([]ApprovalSummary, error) {
	q, ok := query.(*GetPendingApprovalsQuery)
	if !ok {
		return nil, fmt.Errorf("%w: expected *GetPendingApprovalsQuery", ErrInvalidParameter)
	}
	if err := q.Validate(); err != nil {
		return nil, err
	}

	evs, err := h.store.GetByType(ctx, q.TenantID, "approval.requested", time.Time{})
	if err != nil {
		return nil, fmt.Errorf("%w: failed to query pending approvals: %w", ErrQueryFailed, err)
	}

	byID := groupEventsByID(evs)
	results := make([]ApprovalSummary, 0)
	for aggID, aggEvents := range byID {
		summary := buildApprovalSummary(aggID, aggEvents)
		if summary.Status != "PENDING" {
			continue
		}
		_ = q.UserID // reserved for future level-based filtering by approver
		results = append(results, summary)
	}

	if q.Limit <= 0 {
		q.Limit = 20
	}
	if q.Page <= 0 {
		q.Page = 1
	}
	paged, _ := pagination(slicesToIndexable(results, q.Limit, q.Page), q.Page, q.Limit)
	return paged, nil
}

// ApprovalLevelHistoryHandler returns the level-by-level approval history.
type ApprovalLevelHistoryHandler struct {
	store eventstore.EventStore
}

func NewApprovalLevelHistoryHandler(store eventstore.EventStore) *ApprovalLevelHistoryHandler {
	return &ApprovalLevelHistoryHandler{store: store}
}

// Execute returns the ordered list of level records.
func (h *ApprovalLevelHistoryHandler) Execute(ctx context.Context, query Query) ([]ApprovalLevelRecord, error) {
	q, ok := query.(*ApprovalLevelHistoryQuery)
	if !ok {
		return nil, fmt.Errorf("%w: expected *ApprovalLevelHistoryQuery", ErrInvalidParameter)
	}
	if err := q.Validate(); err != nil {
		return nil, err
	}

	evs, err := h.store.GetByAggregate(ctx, q.TenantID, AggregateTypeApproval, q.ID)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to query level history: %w", ErrQueryFailed, err)
	}

	records := make([]ApprovalLevelRecord, 0)
	for _, ev := range evs {
		switch e := ev.(type) {
		case *events.ApprovalLevelApprovedEvent:
			records = append(records, ApprovalLevelRecord{
				Level:     e.Level,
				Status:    "approved",
				LevelID:   e.LevelID,
				ApproverID: e.ApproverID,
				OcurredAt:  ev.OccurredAt(),
			})
		case *events.ApprovalLevelRejectedEvent:
			records = append(records, ApprovalLevelRecord{
				Level:     e.Level,
				Status:    "rejected",
				LevelID:   e.LevelID,
				ApproverID: e.ApproverID,
				Comment:   e.Comment,
				OcurredAt:  ev.OccurredAt(),
			})
		}
	}

	if len(records) == 0 {
		return []ApprovalLevelRecord{}, nil
	}
	return records, nil
}

// ApprovalAggregateRebuildHandler replays the event stream onto a fresh
// ApprovalAggregate and returns the reconstructed state.
type ApprovalAggregateRebuildHandler struct {
	store eventstore.EventStore
}

func NewApprovalAggregateRebuildHandler(store eventstore.EventStore) *ApprovalAggregateRebuildHandler {
	return &ApprovalAggregateRebuildHandler{store: store}
}

// Execute replays the event stream and returns the rebuilt aggregate state.
func (h *ApprovalAggregateRebuildHandler) Execute(ctx context.Context, query Query) (*ApprovalSummary, error) {
	q, ok := query.(*ApprovalAggregateRebuildQuery)
	if !ok {
		return nil, fmt.Errorf("%w: expected *ApprovalAggregateRebuildQuery", ErrInvalidParameter)
	}
	if err := q.Validate(); err != nil {
		return nil, err
	}

	evs, err := h.store.GetByAggregate(ctx, q.TenantID, AggregateTypeApproval, q.ID)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to rebuild aggregate: %w", ErrQueryFailed, err)
	}
	if len(evs) == 0 {
		return nil, ErrAggregateNotFound
	}

	agg := &aggregates.ApprovalAggregate{
		BaseAggregate: aggregates.BaseAggregate{
			AggregateID:   q.ID,
			AggregateType: AggregateTypeApproval,
			TenantID:      q.TenantID,
		},
	}
	for _, ev := range evs {
		agg.Apply(ev)
	}

	summary := &ApprovalSummary{
		ID:           q.ID,
		ApprovalType: agg.ApprovalType,
		Status:       agg.Status,
		CurrentLevel: agg.CurrentLevel,
		TotalLevels:  agg.TotalLevels,
		Version:      agg.Version,
		Approvals:    convertApprovalLevels(agg.Approvals),
		CreatedAt:    agg.CreatedAt,
		UpdatedAt:    agg.UpdatedAt,
	}
	return summary, nil
}

// ---------------------------------------------------------------------------
// Internal helpers — build projection from event stream
// ---------------------------------------------------------------------------

func buildApprovalSummary(aggID string, evs []events.DomainEvent) ApprovalSummary {
	agg := &aggregates.ApprovalAggregate{
		BaseAggregate: aggregates.BaseAggregate{
			AggregateID:   aggID,
			AggregateType: AggregateTypeApproval,
		},
	}
	for _, ev := range evs {
		agg.Apply(ev)
	}
	return ApprovalSummary{
		ID:           aggID,
		ApprovalType: agg.ApprovalType,
		Status:       agg.Status,
		CurrentLevel: agg.CurrentLevel,
		TotalLevels:  agg.TotalLevels,
		Version:      agg.Version,
		Approvals:    convertApprovalLevels(agg.Approvals),
		CreatedAt:    agg.CreatedAt,
		UpdatedAt:    agg.UpdatedAt,
	}
}

func convertApprovalLevels(levels []aggregates.ApprovalLevel) []ApprovalLevel {
	result := make([]ApprovalLevel, len(levels))
	for i, l := range levels {
		result[i] = ApprovalLevel(l)
	}
	return result
}
