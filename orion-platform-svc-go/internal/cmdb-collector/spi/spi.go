package spi

import "context"

// Transport is the SPI for CMDB collector transports.
// Implementations must be tenant-scoped.
type Transport interface {
	// ID returns the transport identifier.
	ID() string
	// Connect establishes a connection to the target system.
	Connect(ctx context.Context, tenantID string, config map[string]any) error
	// Collect gathers configuration items from the target system.
	Collect(ctx context.Context, tenantID string) ([]CollectedItem, error)
	// Close tears down the connection.
	Close(ctx context.Context) error
}

// CollectedItem is a single CI collected from a target system.
type CollectedItem struct {
	CIID      string         `json:"ciId"`
	Name      string         `json:"name"`
	CIType    string         `json:"ciType"`
	Status    string         `json:"status"`
	Attributes map[string]any `json:"attributes,omitempty"`
}

// Registry holds registered transports.
type Registry struct {
	transports map[string]Transport
}

func NewRegistry() *Registry {
	return &Registry{transports: make(map[string]Transport)}
}

func (r *Registry) Register(t Transport) {
	r.transports[t.ID()] = t
}

func (r *Registry) Get(id string) (Transport, bool) {
	t, ok := r.transports[id]
	return t, ok
}

func (r *Registry) List() []string {
	ids := make([]string, 0, len(r.transports))
	for id := range r.transports {
		ids = append(ids, id)
	}
	return ids
}
