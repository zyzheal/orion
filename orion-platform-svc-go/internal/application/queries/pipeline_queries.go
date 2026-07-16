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
// Pipeline Query Handlers (CQRS Read-Side)
//
// All Pipeline queries are read-only and operate against the EventStore.
// They never emit domain events or mutate state.
// ============================================================================

// ---------------------------------------------------------------------------
// Query Definitions
// ---------------------------------------------------------------------------

// ListPipelinesQuery queries pipelines with pagination and status filter.
type ListPipelinesQuery struct {
	TenantID string
	Status   string // empty = all statuses; otherwise DRAFT/ACTIVE/DEPRECATED
	Page     int    // 1-based
	Limit    int    // default 20
}

func (q *ListPipelinesQuery) Validate() error {
	if q.TenantID == "" {
		return fmt.Errorf("%w: tenantID is required", ErrInvalidParameter)
	}
	return nil
}

// GetPipelineByIDQuery retrieves a single pipeline by its aggregate ID.
type GetPipelineByIDQuery struct {
	TenantID string
	ID       string
}

func (q *GetPipelineByIDQuery) Validate() error {
	if q.TenantID == "" {
		return fmt.Errorf("%w: tenantID is required", ErrInvalidParameter)
	}
	if q.ID == "" {
		return fmt.Errorf("%w: pipeline ID is required", ErrInvalidParameter)
	}
	return nil
}

// PipelineEventStreamQuery replays all domain events for a pipeline (used
// for audit trails and debugging).
type PipelineEventStreamQuery struct {
	TenantID   string
	ID         string
	AfterVersion int // optional: incremental replay from a given version
}

func (q *PipelineEventStreamQuery) Validate() error {
	if q.TenantID == "" {
		return fmt.Errorf("%w: tenantID is required", ErrInvalidParameter)
	}
	if q.ID == "" {
		return fmt.Errorf("%w: pipeline ID is required", ErrInvalidParameter)
	}
	return nil
}

// PipelineAggregateRebuildQuery rebuilds the current aggregate state from the
// full event stream. Used when snapshot / read-model is out of date.
type PipelineAggregateRebuildQuery struct {
	TenantID string
	ID       string
}

func (q *PipelineAggregateRebuildQuery) Validate() error {
	if q.TenantID == "" {
		return fmt.Errorf("%w: tenantID is required", ErrInvalidParameter)
	}
	if q.ID == "" {
		return fmt.Errorf("%w: pipeline ID is required", ErrInvalidParameter)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Result Models (DTOs — not domain entities)
// ---------------------------------------------------------------------------

// PipelineSummary is a read-model projection of a Pipeline aggregate.
// It is built from domain events rather than read directly from a table.
type PipelineSummary struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Status       string    `json:"status"`
	Version      int       `json:"version"`
	CreatedAt    time.Time `json:"createdAt"`
	ActivatedAt  *time.Time `json:"activatedAt"`
	DeprecatedAt *time.Time `json:"deprecatedAt"`
}

// PipelineEventEntry pairs an event with its position in the stream.
type PipelineEventEntry struct {
	Index    int        `json:"index"`
	Type     string     `json:"type"`
	Data     string     `json:"data"`
	OcurredAt time.Time `json:"occurredAt"`
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// PipelineListHandler reads all pipelines for a tenant via the EventStore.
type PipelineListHandler struct {
	store eventstore.EventStore
}

func NewPipelineListHandler(store eventstore.EventStore) *PipelineListHandler {
	return &PipelineListHandler{store: store}
}

// ExecuteList queries all pipeline events for the tenant, groups them by
// aggregate ID, and returns the deduplicated list with pagination.
func (h *PipelineListHandler) ExecuteList(ctx context.Context, query Query) ([]PipelineSummary, int, error) {
	q, ok := query.(*ListPipelinesQuery)
	if !ok {
		return nil, 0, fmt.Errorf("%w: expected *ListPipelinesQuery", ErrInvalidParameter)
	}
	if err := q.Validate(); err != nil {
		return nil, 0, err
	}

	evs, err := h.store.GetByType(ctx, q.TenantID, "pipeline.created", time.Time{})
	if err != nil {
		return nil, 0, fmt.Errorf("%w: failed to list pipelines: %w", ErrQueryFailed, err)
	}

	// Group events by aggregate ID and derive the summary from each group.
	byID := groupEventsByID(evs)
	summaries := make([]PipelineSummary, 0, len(byID))
	for aggID, aggEvents := range byID {
		summary := buildPipelineSummary(aggID, aggEvents)
		if q.Status != "" && summary.Status != q.Status {
			continue
		}
		summaries = append(summaries, summary)
	}

	page, limit := q.Page, q.Limit
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	paged, total := pagination(slicesToIndexable(summaries, limit, page), page, limit)
	return paged, total, nil
}

// PipelineGetHandler reads a single pipeline aggregate by ID.
type PipelineGetHandler struct {
	store eventstore.EventStore
}

func NewPipelineGetHandler(store eventstore.EventStore) *PipelineGetHandler {
	return &PipelineGetHandler{store: store}
}

// Execute returns the full pipeline summary built from the event stream.
func (h *PipelineGetHandler) Execute(ctx context.Context, query Query) (PipelineSummary, error) {
	var result PipelineSummary
	q, ok := query.(*GetPipelineByIDQuery)
	if !ok {
		return result, fmt.Errorf("%w: expected *GetPipelineByIDQuery", ErrInvalidParameter)
	}
	if err := q.Validate(); err != nil {
		return result, err
	}

	evs, err := h.store.GetByAggregate(ctx, q.TenantID, AggregateTypePipeline, q.ID)
	if err != nil {
		return result, fmt.Errorf("%w: failed to query pipeline %s: %w", ErrQueryFailed, q.ID, err)
	}
	if len(evs) == 0 {
		return result, ErrAggregateNotFound
	}

	return buildPipelineSummary(q.ID, evs), nil
}

// PipelineEventStreamHandler returns the raw event stream for a pipeline.
type PipelineEventStreamHandler struct {
	store eventstore.EventStore
}

func NewPipelineEventStreamHandler(store eventstore.EventStore) *PipelineEventStreamHandler {
	return &PipelineEventStreamHandler{store: store}
}

// ExecuteEvents returns all events (or incremental) for the pipeline.
func (h *PipelineEventStreamHandler) ExecuteEvents(ctx context.Context, query Query) ([]events.DomainEvent, error) {
	q, ok := query.(*PipelineEventStreamQuery)
	if !ok {
		return nil, fmt.Errorf("%w: expected *PipelineEventStreamQuery", ErrInvalidParameter)
	}
	if err := q.Validate(); err != nil {
		return nil, err
	}

	if q.AfterVersion > 0 {
		reader := newEventStoreReader(h.store)
		return reader.readEventsAfterVersion(ctx, q.TenantID, AggregateTypePipeline, q.ID, q.AfterVersion)
	}

	evs, err := h.store.GetByAggregate(ctx, q.TenantID, AggregateTypePipeline, q.ID)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to query event stream: %w", ErrQueryFailed, err)
	}
	return evs, nil
}

// PipelineAggregateRebuildHandler replays the event stream onto a fresh
// PipelineAggregate and returns the reconstructed state.
type PipelineAggregateRebuildHandler struct {
	store eventstore.EventStore
}

func NewPipelineAggregateRebuildHandler(store eventstore.EventStore) *PipelineAggregateRebuildHandler {
	return &PipelineAggregateRebuildHandler{store: store}
}

// Execute replays the event stream and returns the rebuilt aggregate state.
func (h *PipelineAggregateRebuildHandler) Execute(ctx context.Context, query Query) (*PipelineSummary, error) {
	q, ok := query.(*PipelineAggregateRebuildQuery)
	if !ok {
		return nil, fmt.Errorf("%w: expected *PipelineAggregateRebuildQuery", ErrInvalidParameter)
	}
	if err := q.Validate(); err != nil {
		return nil, err
	}

	evs, err := h.store.GetByAggregate(ctx, q.TenantID, AggregateTypePipeline, q.ID)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to rebuild aggregate: %w", ErrQueryFailed, err)
	}
	if len(evs) == 0 {
		return nil, ErrAggregateNotFound
	}

	agg := &aggregates.PipelineAggregate{
		BaseAggregate: aggregates.BaseAggregate{
			AggregateID:   q.ID,
			AggregateType: AggregateTypePipeline,
			TenantID:      q.TenantID,
		},
	}
	for _, ev := range evs {
		agg.Apply(ev)
	}

	summary := &PipelineSummary{
		ID:           q.ID,
		Name:         agg.Name,
		Status:       agg.Status,
		Version:      agg.Version,
		ActivatedAt:  agg.ActivatedAt,
		DeprecatedAt: agg.DeprecatedAt,
	}
	return summary, nil
}

// ---------------------------------------------------------------------------
// Internal helpers — build projection from event stream
// ---------------------------------------------------------------------------

func buildPipelineSummary(aggID string, evs []events.DomainEvent) PipelineSummary {
	agg := &aggregates.PipelineAggregate{
		BaseAggregate: aggregates.BaseAggregate{
			AggregateID:   aggID,
			AggregateType: AggregateTypePipeline,
		},
	}
	occurredAt := time.Time{}
	for _, ev := range evs {
		agg.Apply(ev)
		if agg.UpdatedAt.IsZero() || ev.OccurredAt().After(occurredAt) {
			occurredAt = ev.OccurredAt()
		}
	}
	return PipelineSummary{
		ID:           aggID,
		Name:         agg.Name,
		Status:       agg.Status,
		Version:      agg.Version,
		CreatedAt:    occurredAt,
		ActivatedAt:  agg.ActivatedAt,
		DeprecatedAt: agg.DeprecatedAt,
	}
}

func groupEventsByID(evs []events.DomainEvent) map[string][]events.DomainEvent {
	groups := make(map[string][]events.DomainEvent)
	for _, ev := range evs {
		groups[ev.AggregateID()] = append(groups[ev.AggregateID()], ev)
	}
	return groups
}

// slicesToIndexable is a no-op helper that returns the slice as-is for pagination.
func slicesToIndexable[T any](items []T, limit, page int) []T {
	return items
}
