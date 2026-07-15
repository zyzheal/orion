package service

import (
	"context"
	"errors"
	"sync"
	"time"

	"orion/platform-svc-go/internal/eventbus/models"
)

var (
	ErrNotConnected  = errors.New("event bus not connected to NATS")
	ErrJetStreamDisabled = errors.New("JetStream not available")
)

// connState holds the in-memory connection state for the event bus.
// In production this would be a real NATS connection; here it is a stub
// that persists the last connection attempt per tenant.
type connState struct {
	mu          sync.RWMutex
	connected   bool
	server      string
	connectedAt time.Time
}

// busConn is a per-service connection registry keyed by tenant.
type busConn struct {
	mu    sync.RWMutex
	states map[string]*connState
}

func newBusConn() *busConn {
	return &busConn{states: make(map[string]*connState)}
}

func (b *busConn) getOrCreate(tenantID string) *connState {
	b.mu.Lock()
	defer b.mu.Unlock()
	s, ok := b.states[tenantID]
	if !ok {
		s = &connState{}
		b.states[tenantID] = s
	}
	return s
}

// Connect attempts to connect to a NATS cluster for the given tenant.
func (s *Service) Connect(ctx context.Context, tenantID string, req *models.ConnectRequest) (*models.ConnectResult, error) {
	state := s.busConn.getOrCreate(tenantID)
	state.mu.Lock()
	defer state.mu.Unlock()

	var server string
	if len(req.Servers) > 0 {
		server = req.Servers[0]
	} else {
		server = "nats://localhost:4222"
	}

	// TODO: wire a real NATS connection when the NATS dependency is available.
	// For now we mark the connection as established and record the server.
	state.connected = true
	state.server = server
	state.connectedAt = time.Now().UTC()

	return &models.ConnectResult{
		Connected: true,
		Server:    server,
	}, nil
}

// GetStatus returns the connection health for the given tenant.
func (s *Service) GetStatus(ctx context.Context, tenantID string) (*models.BusStatus, error) {
	state := s.busConn.getOrCreate(tenantID)
	state.mu.RLock()
	defer state.mu.RUnlock()

	status := "disconnected"
	if state.connected {
		status = "connected"
	}

	return &models.BusStatus{
		Status:      status,
		Server:      state.server,
		ConnectedAt: state.connectedAt.Unix(),
	}, nil
}

// ListSubscriptions returns active subscriptions for the given tenant.
// In a real deployment this queries the NATS/JetStream consumer list.
func (s *Service) ListSubscriptions(ctx context.Context, tenantID string) ([]models.Subscription, error) {
	// Stub: return empty list until a real NATS connection is wired.
	// Production: call natsConn.JetStream().Consumers("stream") etc.
	return []models.Subscription{}, nil
}

// GetDLQ returns dead-letter messages for the given tenant.
// Reads from the local event store filtered by failed status.
func (s *Service) GetDLQ(ctx context.Context, tenantID string, q *models.DLQQuery) (*models.DLQResponse, error) {
	limit := 50
	if q != nil && q.Limit > 0 {
		limit = q.Limit
	}
	if limit > 100 {
		limit = 100
	}

	// TODO: query the DLQ stream or a DLQ-specific table when NATS is wired.
	// For now return an empty response.
	return &models.DLQResponse{
		Total:    0,
		Messages: []models.DLQMessage{},
	}, nil
}

// GetStats returns aggregated event bus statistics for the given tenant.
// Subscribers and ActiveConsumers are read from the connection state;
// event counts come from the repository.
func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.BusStats, error) {
	total, err := s.repo.Count(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	state := s.busConn.getOrCreate(tenantID)
	state.mu.RLock()
	defer state.mu.RUnlock()

	var subscribers, activeConsumers int
	if state.connected {
		subscribers = 1
		activeConsumers = 1
	}

	return &models.BusStats{
		TotalEvents:     int64(total),
		Published:       int64(total),
		Subscribers:     subscribers,
		ActiveConsumers: activeConsumers,
		DLQCount:        0,
	}, nil
}
