package handler

import (
	"io"
	"net/http"

	"orion/ci-cd-svc-go/internal/pipeline/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SSEHandler struct {
	svc *service.SSEService
}

func NewSSEHandler(svc *service.SSEService) *SSEHandler {
	return &SSEHandler{svc: svc}
}

// StreamLogs handles the SSE connection for pipeline run log streaming
func (h *SSEHandler) StreamLogs(c *gin.Context) {
	runID := c.Param("runId")
	clientID := c.Query("client_id")
	if clientID == "" {
		clientID = uuid.New().String()
	}

	client := h.svc.Subscribe(runID, clientID)
	defer h.svc.Unsubscribe(runID, clientID)

	// Set SSE headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	// Start streaming in StreamLogs goroutine
	go h.svc.StreamLogs(c.Request.Context(), client)

	c.Stream(func(w io.Writer) bool {
		select {
		case <-c.Request.Context().Done():
			return false
		case <-client.Done:
			return false
		case msg, ok := <-client.Channel:
			if !ok {
				return false
			}
			w.Write(msg)
			return true
		}
	})
}

// GetSubscribers returns the number of active subscribers for a run
func (h *SSEHandler) GetSubscribers(c *gin.Context) {
	runID := c.Param("runId")
	count := h.svc.GetSubscriberCount(runID)
	c.JSON(http.StatusOK, gin.H{"run_id": runID, "subscribers": count})
}

func (h *SSEHandler) RegisterRoutes(rg *gin.RouterGroup) {
	sse := rg.Group("/runs/:runId/stream")
	{
		sse.GET("", h.StreamLogs)
		sse.GET("/subscribers", h.GetSubscribers)
	}
}
