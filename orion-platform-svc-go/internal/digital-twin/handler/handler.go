package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/digital-twin/models"
	dt_service "orion/platform-svc-go/internal/digital-twin/service"

	"errors"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *dt_service.Service
}

func NewHandler(svc *dt_service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all digital-twin endpoints under the given group.
// Mirrors /api/v1/digital-twins routes from the TS source (22 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	dt := rg.Group("/digital-twins")

	// --- Digital Twins ---
	dt.POST("", auth.RequirePermission("digital_twin", "write"), h.CreateTwin)
	dt.GET("", auth.RequirePermission("digital_twin", "read"), h.ListTwins)
	dt.GET("/:id/state", auth.RequirePermission("digital_twin", "read"), h.GetTwinState)
	dt.POST("/:id/snapshot", auth.RequirePermission("digital_twin", "write"), h.CreateSnapshot)

	// --- Sandbox Management ---
	dt.POST("/sandbox", auth.RequirePermission("digital_twin", "write"), h.CreateSandbox)
	dt.GET("/sandbox", auth.RequirePermission("digital_twin", "read"), h.ListSandboxes)
	dt.POST("/sandbox/:id/stop", auth.RequirePermission("digital_twin", "write"), h.StopSandbox)
	dt.DELETE("/sandbox/:id", auth.RequirePermission("digital_twin", "write"), h.DestroySandbox)
	dt.GET("/sandbox/:id/health", auth.RequirePermission("digital_twin", "read"), h.SandboxHealth)

	// --- Traffic Recording ---
	dt.POST("/:id/record", auth.RequirePermission("digital_twin", "write"), h.RecordTraffic)
	dt.POST("/:id/recordings/start", auth.RequirePermission("digital_twin", "write"), h.StartRecording)
	dt.GET("/:id/recordings", auth.RequirePermission("digital_twin", "read"), h.ListRecordingSessions)
	dt.POST("/recordings/:recordingId/stop", auth.RequirePermission("digital_twin", "write"), h.StopRecording)
	dt.POST("/recordings/:recordingId/pause", auth.RequirePermission("digital_twin", "write"), h.PauseRecording)
	dt.GET("/recordings/:recordingId", auth.RequirePermission("digital_twin", "read"), h.GetRecordingDetail)
	dt.GET("/recordings/:recordingId/records", auth.RequirePermission("digital_twin", "read"), h.GetRecordingRecords)

	// --- Traffic Replay ---
	dt.POST("/:id/replay", auth.RequirePermission("digital_twin", "write"), h.ReplayTraffic)
	dt.POST("/:id/replay/start", auth.RequirePermission("digital_twin", "write"), h.StartReplay)
	dt.GET("/:id/replay", auth.RequirePermission("digital_twin", "read"), h.ListReplaySessions)
	dt.GET("/replay/:replayId/status", auth.RequirePermission("digital_twin", "read"), h.GetReplayStatus)
	dt.POST("/replay/:replayId/cancel", auth.RequirePermission("digital_twin", "write"), h.CancelReplay)
	dt.GET("/replay/:replayId/report", auth.RequirePermission("digital_twin", "read"), h.GetReplayReport)
}

// --- Digital Twins ---

func (h *Handler) CreateTwin(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateDigitalTwinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreateTwin(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, twinToResponse(m))
}

func (h *Handler) ListTwins(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListTwins(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	data := make([]gin.H, len(items))
	for i, t := range items {
		data[i] = twinToResponse(&t)
	}
	middleware.RespondSuccess(c, data)
}

func (h *Handler) GetTwinState(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	state, err := h.svc.GetTwinState(c.Request.Context(), tenantID, id)
	if err != nil {
		if dt_service.IsNotFound(err) {
			middleware.RespondNotFound(c, "digital twin not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, state)
}

func (h *Handler) CreateSnapshot(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.CreateSnapshotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	_, err := h.svc.FindTwin(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "digital twin not found")
		return
	}
	snap, err := h.svc.CreateSnapshot(c.Request.Context(), id, req.Name)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, snap)
}

// --- Sandbox ---

func (h *Handler) CreateSandbox(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateSandboxRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	sb, err := h.svc.CreateSandbox(c.Request.Context(), tenantID, req)
	if err != nil {
		if dt_service.IsNotFound(err) {
			middleware.RespondNotFound(c, "digital twin not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, sb)
}

func (h *Handler) ListSandboxes(c *gin.Context) {
	items := h.svc.ListSandboxes(c.Request.Context())
	middleware.RespondSuccess(c, items)
}

func (h *Handler) StopSandbox(c *gin.Context) {
	id := c.Param("id")
	_, err := h.svc.StopSandbox(id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"id": id, "stopped": true})
}

func (h *Handler) DestroySandbox(c *gin.Context) {
	id := c.Param("id")
	_, err := h.svc.DestroySandbox(id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"id": id, "destroyed": true})
}

func (h *Handler) SandboxHealth(c *gin.Context) {
	id := c.Param("id")
	_, err := h.svc.SandboxHealth(id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"id": id, "healthy": true})
}

// --- Traffic Recording ---

func (h *Handler) RecordTraffic(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	_, err := h.svc.FindTwin(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "digital twin not found")
		return
	}
	record, err := h.svc.RecordTraffic(c.Request.Context(), id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{
		"id":           record.ID,
		"twinId":       record.TwinID,
		"type":         record.Type,
		"requestCount": record.RequestCount,
		"duration":     record.Duration,
		"startedAt":    record.StartedAt,
	})
}

func (h *Handler) StartRecording(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var body struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	_, err := h.svc.FindTwin(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "digital twin not found")
		return
	}
	session := h.svc.StartRecording(id, body.Name)
	middleware.RespondCreated(c, session)
}

func (h *Handler) ListRecordingSessions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	_, err := h.svc.FindTwin(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "digital twin not found")
		return
	}
	sessions, err := h.svc.ListRecordingSessions(c.Request.Context(), id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, sessions)
}

func (h *Handler) StopRecording(c *gin.Context) {
	recordingID := c.Param("recordingId")
	result := h.svc.StopRecording(recordingID)
	middleware.RespondSuccess(c, result)
}

func (h *Handler) PauseRecording(c *gin.Context) {
	recordingID := c.Param("recordingId")
	result := h.svc.PauseRecording(recordingID)
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetRecordingDetail(c *gin.Context) {
	recordingID := c.Param("recordingId")
	detail := h.svc.GetRecordingDetail(recordingID)
	middleware.RespondSuccess(c, detail)
}

func (h *Handler) GetRecordingRecords(c *gin.Context) {
	recordingID := c.Param("recordingId")
	records := h.svc.GetRecordingRecords(recordingID)
	middleware.RespondSuccess(c, records)
}

// --- Traffic Replay ---

func (h *Handler) ReplayTraffic(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	_, err := h.svc.FindTwin(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "digital twin not found")
		return
	}
	result, err := h.svc.ReplayTraffic(c.Request.Context(), id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) StartReplay(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.CreateReplayStartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	_, err := h.svc.FindTwin(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "digital twin not found")
		return
	}
	session, err := h.svc.StartReplay(c.Request.Context(), id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, session)
}

func (h *Handler) ListReplaySessions(c *gin.Context) {
	id := c.Param("id")
	sessions, err := h.svc.ListReplaySessions(c.Request.Context(), id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, sessions)
}

func (h *Handler) GetReplayStatus(c *gin.Context) {
	replayID := c.Param("replayId")
	status, err := h.svc.GetReplayStatus(c.Request.Context(), replayID)
	if err != nil {
		if dt_service.IsNotFound(err) {
			middleware.RespondNotFound(c, "replay session not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, status)
}

func (h *Handler) CancelReplay(c *gin.Context) {
	replayID := c.Param("replayId")
	result, err := h.svc.CancelReplay(c.Request.Context(), replayID)
	if err != nil {
		if dt_service.IsNotFound(err) {
			middleware.RespondNotFound(c, "replay session not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetReplayReport(c *gin.Context) {
	replayID := c.Param("replayId")
	report, err := h.svc.GetReplayReport(c.Request.Context(), replayID)
	if err != nil {
		if dt_service.IsNotFound(err) {
			middleware.RespondNotFound(c, "replay session not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

// --- Helpers ---

func twinToResponse(t *models.DigitalTwin) gin.H {
	return gin.H{
		"id":            t.ID,
		"name":          t.Name,
		"serviceType":   t.ServiceType,
		"sourceService": t.SourceService,
		"status":        t.Status,
		"createdAt":     t.CreatedAt,
	}
}

// Suppress unused import errors (errors package).
func init() {
	_ = errors.New
}
