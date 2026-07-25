package handler

import (
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"orion-ticket-svc-go/internal/service"
)

type ServiceControlHandler struct {
	svc *service.TicketService
}

func NewServiceControlHandler(svc *service.TicketService) *ServiceControlHandler {
	return &ServiceControlHandler{svc: svc}
}

var (
	serviceRunning = true
	lastStartedAt  = time.Now()
	lastStoppedAt  = time.Time{}
	mu             sync.RWMutex
)

// StartTicketingService POST /api/v1/ticketing/start
func (h *ServiceControlHandler) StartTicketingService(c *gin.Context) {
	mu.Lock()
	if serviceRunning {
		mu.Unlock()
		respondSuccess(c, gin.H{
			"success": true,
			"message": "Ticketing service already running",
		})
		return
	}
	serviceRunning = true
	startedAt := time.Now()
	lastStartedAt = startedAt
	mu.Unlock()

	respondSuccess(c, gin.H{
		"success":     true,
		"message":     "Ticketing service started",
		"started_at":  startedAt,
	})
}

// StopTicketingService POST /api/v1/ticketing/stop
func (h *ServiceControlHandler) StopTicketingService(c *gin.Context) {
	mu.Lock()
	if !serviceRunning {
		mu.Unlock()
		respondSuccess(c, gin.H{
			"success": true,
			"message": "Ticketing service already stopped",
		})
		return
	}
	serviceRunning = false
	stoppedAt := time.Now()
	lastStoppedAt = stoppedAt
	mu.Unlock()

	respondSuccess(c, gin.H{
		"success":    true,
		"message":    "Ticketing service stopped",
		"stopped_at": stoppedAt,
	})
}

// TicketingHealthCheck GET /api/v1/ticketing/health
func (h *ServiceControlHandler) TicketingHealthCheck(c *gin.Context) {
	mu.RLock()
	running := serviceRunning
	sinceStart := time.Since(lastStartedAt)
	mu.RUnlock()

	respondSuccess(c, gin.H{
			"health": map[string]any{
				"status":        map[string]bool{"running": running},
				"uptime":        sinceStart.String(),
				"started_at":    lastStartedAt,
				"last_stopped":  lastStoppedAt,
				"service_name":  "orion-ticket-svc",
			},
		},)
}
