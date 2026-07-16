package eventstore

import (
	"encoding/json"
	"time"

	"orion/platform-svc-go/internal/domain/events"
)

type storedEvent struct {
	aggregateType string
	aggregateID   string
	eventType     string
	tenantID      string
	occurredAt    time.Time
	version       int
	correlationID string
	causationID   string
	eventData     json.RawMessage
}

func (s *storedEvent) AggregateType() string { return s.aggregateType }
func (s *storedEvent) AggregateID() string { return s.aggregateID }
func (s *storedEvent) EventType() string { return s.eventType }
func (s *storedEvent) TenantID() string { return s.tenantID }
func (s *storedEvent) OccurredAt() time.Time { return s.occurredAt }
func (s *storedEvent) Version() int { return s.version }
func (s *storedEvent) SetAggregateID(id string) { s.aggregateID = id }
func (s *storedEvent) SetTenantID(tenantID string) { s.tenantID = tenantID }
func (s *storedEvent) SetVersion(v int) { s.version = v }

var _ events.DomainEvent = (*storedEvent)(nil)
