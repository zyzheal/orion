package event

// eventInterface implements the Bus Event interface for each concrete event type.
// These methods allow the bus to query type and tenant without type switches.

func (e *AlertEvent) EventType() EventType     { return e.BaseEvent.EventType }
func (e *AlertEvent) TenantID() string         { return e.BaseEvent.TenantID }
func (e *AcknowledgedEvent) EventType() EventType { return e.BaseEvent.EventType }
func (e *AcknowledgedEvent) TenantID() string  { return e.BaseEvent.TenantID }
func (e *ResolvedEvent) EventType() EventType   { return e.BaseEvent.EventType }
func (e *ResolvedEvent) TenantID() string       { return e.BaseEvent.TenantID }
func (e *EscalatedEvent) EventType() EventType  { return e.BaseEvent.EventType }
func (e *EscalatedEvent) TenantID() string      { return e.BaseEvent.TenantID }
func (e *SuppressedEvent) EventType() EventType { return e.BaseEvent.EventType }
func (e *SuppressedEvent) TenantID() string     { return e.BaseEvent.TenantID }
