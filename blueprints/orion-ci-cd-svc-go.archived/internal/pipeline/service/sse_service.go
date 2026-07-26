package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"orion/ci-cd-svc-go/internal/pipeline/models"
)

// SSEClient represents a connected SSE client
type SSEClient struct {
	ID       string
	RunID    string
	Channel  chan []byte
	Done     chan struct{}
}

// SSEService manages Server-Sent Events for real-time pipeline log streaming
type SSEService struct {
	mu      sync.RWMutex
	clients map[string]map[string]*SSEClient // runID -> clientID -> client
}

func NewSSEService() *SSEService {
	return &SSEService{
		clients: make(map[string]map[string]*SSEClient),
	}
}

// Subscribe creates a new SSE subscription for a pipeline run
func (s *SSEService) Subscribe(runID, clientID string) *SSEClient {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.clients[runID] == nil {
		s.clients[runID] = make(map[string]*SSEClient)
	}

	client := &SSEClient{
		ID:      clientID,
		RunID:   runID,
		Channel: make(chan []byte, 100),
		Done:    make(chan struct{}),
	}
	s.clients[runID][clientID] = client
	return client
}

// Unsubscribe removes an SSE client
func (s *SSEService) Unsubscribe(runID, clientID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if clients, ok := s.clients[runID]; ok {
		if client, ok := clients[clientID]; ok {
			close(client.Done)
			delete(clients, clientID)
		}
		if len(clients) == 0 {
			delete(s.clients, runID)
		}
	}
}

// Publish sends a log entry to all subscribers of a run
func (s *SSEService) Publish(runID string, entry models.RunLogEntry) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := json.Marshal(entry)
	if err != nil {
		return
	}

	event := fmt.Sprintf("event: log\ndata: %s\n\n", data)

	if clients, ok := s.clients[runID]; ok {
		for _, client := range clients {
			select {
			case client.Channel <- []byte(event):
			default:
				// Client too slow, skip
			}
		}
	}
}

// PublishStatus sends a status change event to all subscribers
func (s *SSEService) PublishStatus(runID string, status models.PipelineRunStatus) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, _ := json.Marshal(map[string]interface{}{
		"status":    status,
		"timestamp": time.Now(),
	})

	event := fmt.Sprintf("event: status\ndata: %s\n\n", data)

	if clients, ok := s.clients[runID]; ok {
		for _, client := range clients {
			select {
			case client.Channel <- []byte(event):
			default:
			}
		}
	}
}

// PublishStageEvent sends a stage lifecycle event
func (s *SSEService) PublishStageEvent(runID string, stageName string, status models.StageStatus) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, _ := json.Marshal(map[string]interface{}{
		"stage":     stageName,
		"status":    status,
		"timestamp": time.Now(),
	})

	event := fmt.Sprintf("event: stage\ndata: %s\n\n", data)

	if clients, ok := s.clients[runID]; ok {
		for _, client := range clients {
			select {
			case client.Channel <- []byte(event):
			default:
			}
		}
	}
}

// GetSubscriberCount returns the number of active subscribers for a run
func (s *SSEService) GetSubscriberCount(runID string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if clients, ok := s.clients[runID]; ok {
		return len(clients)
	}
	return 0
}

// StreamLogs handles the SSE connection for a client
func (s *SSEService) StreamLogs(ctx context.Context, client *SSEClient) {
	defer s.Unsubscribe(client.RunID, client.ID)

	// Send initial connection event
	initEvent := fmt.Sprintf("event: connected\ndata: {\"run_id\":\"%s\"}\n\n", client.RunID)
	select {
	case client.Channel <- []byte(initEvent):
	case <-ctx.Done():
		return
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-client.Done:
			return
		}
	}
}
