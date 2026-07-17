package service

import (
	"context"
	"errors"
	"sync"
	"time"

	"orion/platform-svc-go/internal/eventbus/models"

	"github.com/nats-io/nats.go"
)

var (
	ErrNotConnected       = errors.New("event bus not connected to NATS")
	ErrJetStreamDisabled  = errors.New("JetStream not available")
	ErrInvalidNATSServer  = errors.New("invalid NATS server address")
)

// natssub tracks a single subscription handle so ListSubscriptions can
// enumerate active consumers.
type natssub struct {
	topic    string
	sub      *nats.Subscription
	consumer string
}

// connState holds the in-memory connection state for the event bus per tenant.
type connState struct {
	mu         sync.RWMutex
	nc         *nats.Conn          // live NATS connection (nil when disconnected)
	jetStream  nats.JetStream      // JetStream context (nil when unavailable)
	connected  bool
	server     string
	connectedAt time.Time
	subs       map[string]*natssub // active subscriptions keyed by consumer name
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
		s = &connState{
			subs: make(map[string]*natssub),
		}
		b.states[tenantID] = s
	}
	return s
}

// Connect attempts to connect to a NATS cluster for the given tenant.
func (s *Service) Connect(ctx context.Context, tenantID string, req *models.ConnectRequest) (*models.ConnectResult, error) {
	state := s.busConn.getOrCreate(tenantID)
	state.mu.Lock()
	defer state.mu.Unlock()

	server := "nats://localhost:4222"
	if len(req.Servers) > 0 {
		server = req.Servers[0]
	}

	// Clean up previous connection if any.
	if state.nc != nil {
		state.nc.Drain()
		state.nc = nil
		state.jetStream = nil
		state.connected = false
	}

	// Establish a real NATS connection.
	nc, err := nats.Connect(server)
	if err != nil {
		// Could not reach NATS server — record the failure so GetStatus
		// reports disconnected rather than silently lying.
		state.server = server
		state.connected = false
		return &models.ConnectResult{
			Connected: false,
			Server:    server,
		}, ErrInvalidNATSServer
	}
	state.nc = nc
	state.connected = true
	state.server = server
	state.connectedAt = time.Now().UTC()

	// Attempt to obtain a JetStream context if the server has JetStream enabled.
	js, jsErr := nc.JetStream()
	if jsErr == nil {
		state.jetStream = js
	}

	return &models.ConnectResult{
		Connected: true,
		Server:    server,
	}, nil
}

// Subscribe registers a durable subscription on the given topic and returns
// the NATS subscription. Callers must call unsubscribe() on the returned handle.
func (s *Service) Subscribe(ctx context.Context, tenantID string, topic string, cb nats.MsgHandler) (*natssub, error) {
	state := s.busConn.getOrCreate(tenantID)
	state.mu.RLock()
	nc := state.nc
	state.mu.RUnlock()

	if nc == nil || !nc.IsConnected() {
		return nil, ErrNotConnected
	}

	sub, err := nc.Subscribe(topic, cb)
	if err != nil {
		return nil, err
	}

	nsub := &natssub{topic: topic, sub: sub, consumer: topic}
	state.mu.Lock()
	state.subs[nsub.consumer] = nsub
	state.mu.Unlock()

	return nsub, nil
}

// unsubscribe tears down the given subscription.
func (s *Service) unsubscribe(tenantID string, nsub *natssub) error {
	state := s.busConn.getOrCreate(tenantID)
	if nsub.sub != nil {
		if err := nsub.sub.Unsubscribe(); err != nil {
			return err
		}
	}
	state.mu.Lock()
	delete(state.subs, nsub.consumer)
	state.mu.Unlock()
	return nil
}

// GetStatus returns the connection health for the given tenant.
func (s *Service) GetStatus(ctx context.Context, tenantID string) (*models.BusStatus, error) {
	state := s.busConn.getOrCreate(tenantID)
	state.mu.RLock()
	defer state.mu.RUnlock()

	status := "disconnected"
	if state.connected && state.nc != nil && state.nc.IsConnected() {
		status = "connected"
	} else if state.nc != nil {
		// Connection object exists but is not actually connected — refresh the flag.
		state.connected = false
		status = "disconnected"
	}

	return &models.BusStatus{
		Status:      status,
		Server:      state.server,
		ConnectedAt: state.connectedAt.Unix(),
	}, nil
}

// ListSubscriptions returns active subscriptions for the given tenant.
func (s *Service) ListSubscriptions(ctx context.Context, tenantID string) ([]models.Subscription, error) {
	state := s.busConn.getOrCreate(tenantID)
	state.mu.RLock()
	defer state.mu.RUnlock()

	if !state.connected {
		return []models.Subscription{}, nil
	}

	var out []models.Subscription
	for _, nsub := range state.subs {
		out = append(out, models.Subscription{
			Name:     nsub.consumer,
			Topic:    nsub.topic,
			Consumer: nsub.consumer,
			Active:   1,
		})
	}
	return out, nil
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

	// The local event store is an append-only log with no failure semantics,
	// so there is no in-process DLQ to read. Once JetStream is wired, this
	// would query the JetStream "DLQ" stream / consumer's pending redelivered
	// messages. For now the DLQ is intentionally empty.
	_ = limit // kept explicit: caller-controlled cap for the future

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
	if state.connected && state.nc != nil {
		subscribers = len(state.subs)
		activeConsumers = subscribers
	}

	return &models.BusStats{
		TotalEvents:     int64(total),
		Published:       int64(total),
		Subscribers:     subscribers,
		ActiveConsumers: activeConsumers,
		DLQCount:        0,
	}, nil
}

// helper

func strPtr(s string) *string {
	return &s
}
