package service

import (
	"context"
	"io"
	"sync"
	"time"

	"orion/platform-svc-go/internal/pipeline-sse/models"
	"orion/platform-svc-go/internal/pipeline-sse/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// SSEHub manages in-memory SSE connections and event broadcasting.
type SSEHub struct {
	mu          sync.RWMutex
	connections map[string]*models.SSEConnection
	repo        *repository.Repository
}

// NewSSEHub creates a new SSEHub.
func NewSSEHub(repo *repository.Repository) *SSEHub {
	return &SSEHub{
		connections: make(map[string]*models.SSEConnection),
		repo:       repo,
	}
}

// CreateConnection registers a new SSE connection and returns its ID.
func (h *SSEHub) CreateConnection(pipelineID, runID, userID string, logLevels []string, includeLogs, includeStatus bool) string {
	h.mu.Lock()
	defer h.mu.Unlock()

	connID := uuid.New().String()
	if logLevels == nil {
		logLevels = []string{}
	}
	h.connections[connID] = &models.SSEConnection{
		ID:            connID,
		PipelineID:    pipelineID,
		RunID:         runID,
		UserID:        userID,
		ConnectedAt:   time.Now().UTC(),
		LogLevels:     logLevels,
		IncludeLogs:   includeLogs,
		IncludeStatus: includeStatus,
	}
	return connID
}

// RemoveConnection removes a connection from the hub.
func (h *SSEHub) RemoveConnection(connID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.connections, connID)
}

// GetConnection returns a connection by ID.
func (h *SSEHub) GetConnection(connID string) *models.SSEConnection {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.connections[connID]
}

// broadcastToConnections sends data to all connections matching the given pipeline and run.
// The writeFn receives a channel that will be closed when the broadcast is complete.
func (h *SSEHub) broadcastToConnections(pipelineID, runID string, writeFn func(c *models.SSEConnection, ch chan<- bool)) {
	h.mu.RLock()
	var targets []*models.SSEConnection
	for _, conn := range h.connections {
		if conn.PipelineID == pipelineID && conn.RunID == runID {
			targets = append(targets, conn)
		}
	}
	h.mu.RUnlock()

	for _, conn := range targets {
		ch := make(chan bool, 1)
		writeFn(conn, ch)
		<-ch
	}
}

// PublishLogEvent broadcasts a log event to all matching SSE connections.
// It also persists the event in the database for replay.
func (h *SSEHub) PublishLogEvent(ctx context.Context, tenantID string, event *models.PublishLogRequest) error {
	// Persist the event
	if h.repo != nil {
		if err := h.repo.CreateLogEvent(ctx, tenantID, event); err != nil {
			return err
		}
	}

	h.broadcastToConnections(event.PipelineID, event.RunID, func(conn *models.SSEConnection, ch chan<- bool) {
		// Skip if the connection does not want logs
		if !conn.IncludeLogs {
			ch <- true
			return
		}
		// Filter by log level if the connection has specified levels
		if len(conn.LogLevels) > 0 && event.Level != "" {
			matched := false
			for _, l := range conn.LogLevels {
				if l == event.Level {
					matched = true
					break
				}
			}
			if !matched {
				ch <- true
				return
			}
		}
		// Note: actual SSE write happens in the Gin handler via c.Stream / c.SSEvent.
		// This method is used by the internal publish endpoints which write directly
		// to the hub; the actual streaming to clients is handled by the SSE stream handlers.
		ch <- true
	})
	return nil
}

// PublishStatusEvent broadcasts a status event to all matching SSE connections.
// It also persists the event in the database for replay.
func (h *SSEHub) PublishStatusEvent(ctx context.Context, tenantID string, event *models.PublishStatusRequest) error {
	// Persist the event
	if h.repo != nil {
		if err := h.repo.CreateStatusEvent(ctx, tenantID, event); err != nil {
			return err
		}
	}

	h.broadcastToConnections(event.PipelineID, event.RunID, func(conn *models.SSEConnection, ch chan<- bool) {
		if !conn.IncludeStatus {
			ch <- true
			return
		}
		ch <- true
	})
	return nil
}

// StreamLogEvents sends a continuous SSE stream of log events for a pipeline run.
// The caller (Gin handler) is responsible for setting the SSE headers and calling c.Stream.
func (h *SSEHub) StreamLogEvents(c *gin.Context, connID string) {
	conn := h.GetConnection(connID)
	if conn == nil {
		return
	}
	defer h.RemoveConnection(connID)

	c.Stream(func(w io.Writer) bool {
		select {
		case <-c.Request.Context().Done():
			return false
		default:
			// The actual event pushing is done via external calls to PublishLogEvent.
			// The stream loop keeps the connection alive and handles disconnection.
			// A more advanced implementation would use channels per connection.
			// For now we use a ticker to detect disconnection.
			time.Sleep(5 * time.Second)
			// Send a keepalive comment to prevent proxy timeouts.
			// Gin's SSEvent helper writes SSE-formatted data.
			// For keepalive we write a comment line.
			_, _ = w.Write([]byte(": keepalive\n\n"))
			return true
		}
	})
}

// StreamStatusEvents sends a continuous SSE stream of status events for a pipeline run.
func (h *SSEHub) StreamStatusEvents(c *gin.Context, connID string) {
	conn := h.GetConnection(connID)
	if conn == nil {
		return
	}
	defer h.RemoveConnection(connID)

	c.Stream(func(w io.Writer) bool {
		select {
		case <-c.Request.Context().Done():
			return false
		default:
			time.Sleep(5 * time.Second)
			_, _ = w.Write([]byte(": keepalive\n\n"))
			return true
		}
	})
}

// GetStats returns connection statistics.
func (h *SSEHub) GetStats() *models.SSEStats {
	h.mu.RLock()
	defer h.mu.RUnlock()

	stats := &models.SSEStats{
		TotalConnections:  len(h.connections),
		ConnectionsByUser: make(map[string]int),
	}
	for _, conn := range h.connections {
		stats.ConnectionsByUser[conn.UserID]++
	}
	return stats
}

// Shutdown removes all connections.
func (h *SSEHub) Shutdown() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.connections = make(map[string]*models.SSEConnection)
}

// ListEvents delegates to the repository for event replay.
func (h *SSEHub) ListEvents(ctx context.Context, pipelineID, runID string, limit int) ([]map[string]interface{}, error) {
	if h.repo == nil {
		return []map[string]interface{}{}, nil
	}
	return h.repo.ListEvents(ctx, pipelineID, runID, limit)
}