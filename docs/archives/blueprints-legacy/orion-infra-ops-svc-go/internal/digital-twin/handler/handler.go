package handler

import (
	"orion/go-common/pkg/errors"
	"net/http"
	"strconv"

	"orion/infra-ops-svc-go/internal/digital-twin/models"
	"orion/infra-ops-svc-go/internal/digital-twin/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler provides HTTP endpoints for the digital twin service.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all routes under the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Digital Twins
	twins := rg.Group("/twins")
	{
		twins.POST("", auth.RequirePermission("digital_twin", "write"), h.Create)
		twins.GET("", auth.RequirePermission("digital_twin", "read"), h.List)
		twins.GET("/count", auth.RequirePermission("digital_twin", "read"), h.Count)
		twins.GET("/:id", auth.RequirePermission("digital_twin", "read"), h.Get)
		twins.PUT("/:id", auth.RequirePermission("digital_twin", "write"), h.Update)
		twins.DELETE("/:id", auth.RequirePermission("digital_twin", "delete"), h.Delete)
		twins.POST("/:id/sync", auth.RequirePermission("digital_twin", "execute"), h.Sync)
		twins.GET("/:id/metrics", auth.RequirePermission("digital_twin", "read"), h.Metrics)

		// Nested resources under twins
		twins.POST("/:twinId/snapshots", auth.RequirePermission("digital_twin", "write"), h.CreateSnapshot)
		twins.POST("/:twinId/sandboxes", auth.RequirePermission("digital_twin", "write"), h.CreateSandbox)
		twins.GET("/:twinId/sandboxes", auth.RequirePermission("digital_twin", "read"), h.ListSandboxes)
		twins.POST("/:twinId/recordings", auth.RequirePermission("digital_twin", "execute"), h.StartRecording)
		twins.GET("/:twinId/recordings", auth.RequirePermission("digital_twin", "read"), h.ListRecordingSessions)
		twins.GET("/:twinId/replays", auth.RequirePermission("digital_twin", "read"), h.ListReplaySessions)
	}

	// Snapshots
	snapshots := rg.Group("/snapshots")
	{
		snapshots.GET("", auth.RequirePermission("digital_twin", "read"), h.ListSnapshots)
		snapshots.GET("/:id", auth.RequirePermission("digital_twin", "read"), h.GetSnapshot)
		snapshots.DELETE("/:id", auth.RequirePermission("digital_twin", "delete"), h.DeleteSnapshot)
		snapshots.POST("/:id/restore", auth.RequirePermission("digital_twin", "execute"), h.RestoreSnapshot)
		snapshots.GET("/:id/export", auth.RequirePermission("digital_twin", "read"), h.ExportSnapshot)
	}

	// Sandboxes
	sandboxes := rg.Group("/sandboxes")
	{
		sandboxes.GET("/:id", auth.RequirePermission("digital_twin", "read"), h.GetSandbox)
		sandboxes.POST("/:id/start", auth.RequirePermission("digital_twin", "execute"), h.StartSandbox)
		sandboxes.POST("/:id/stop", auth.RequirePermission("digital_twin", "execute"), h.StopSandbox)
		sandboxes.DELETE("/:id", auth.RequirePermission("digital_twin", "delete"), h.DestroySandbox)
		sandboxes.GET("/:id/health", auth.RequirePermission("digital_twin", "read"), h.HealthCheck)
	}

	// Recording Sessions
	recordings := rg.Group("/recordings")
	{
		recordings.GET("/:id", auth.RequirePermission("digital_twin", "read"), h.GetRecordingSession)
		recordings.POST("/:id/pause", auth.RequirePermission("digital_twin", "execute"), h.PauseRecording)
		recordings.POST("/:id/resume", auth.RequirePermission("digital_twin", "execute"), h.ResumeRecording)
		recordings.POST("/:id/stop", auth.RequirePermission("digital_twin", "execute"), h.StopRecording)
		recordings.POST("/:id/traffic", auth.RequirePermission("digital_twin", "write"), h.RecordTraffic)
		recordings.GET("/:id/records", auth.RequirePermission("digital_twin", "read"), h.GetRecords)
		recordings.DELETE("/:id", auth.RequirePermission("digital_twin", "delete"), h.DeleteRecordingSession)
	}

	// Replay Sessions
	replays := rg.Group("/replays")
	{
		replays.POST("", auth.RequirePermission("digital_twin", "write"), h.StartReplay)
		replays.GET("/:id", auth.RequirePermission("digital_twin", "read"), h.GetReplaySession)
		replays.POST("/:id/cancel", auth.RequirePermission("digital_twin", "execute"), h.CancelReplay)
		replays.PUT("/:id/progress", auth.RequirePermission("digital_twin", "write"), h.UpdateReplayProgress)
		replays.POST("/:id/complete", auth.RequirePermission("digital_twin", "execute"), h.CompleteReplay)
	}
}

// ==================== Digital Twin Handlers ====================

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateDigitalTwinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, d)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.List(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateDigitalTwinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrTwinNotFound {
			status = http.StatusNotFound
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), status)
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

func (h *Handler) Sync(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.Sync(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrTwinNotFound {
			status = http.StatusNotFound
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), status)
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) Metrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	metrics, err := h.svc.GetMetrics(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrTwinNotFound {
			status = http.StatusNotFound
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), status)
		return
	}
	respondSuccess(c, metrics)
}

// ==================== Snapshot Handlers ====================

func (h *Handler) CreateSnapshot(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	_ = c.Param("twinId") // twinId available for future use
	var req models.CreateSnapshotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	snap, err := h.svc.CreateSnapshot(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, snap)
}

func (h *Handler) ListSnapshots(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	environment := c.Query("environment")
	status := c.Query("status")
	snaps, err := h.svc.ListSnapshots(c.Request.Context(), tenantID, environment, status)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, snaps)
}

func (h *Handler) GetSnapshot(c *gin.Context) {
	snap, err := h.svc.GetSnapshot(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, snap)
}

func (h *Handler) DeleteSnapshot(c *gin.Context) {
	deleted, err := h.svc.DeleteSnapshot(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"success": deleted})
}

func (h *Handler) RestoreSnapshot(c *gin.Context) {
	var req models.RestoreSnapshotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	restoreID, status, err := h.svc.RestoreSnapshot(c.Request.Context(), c.Param("id"), &req)
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"restore_id": restoreID, "status": status})
}

func (h *Handler) ExportSnapshot(c *gin.Context) {
	yaml, sizeBytes, err := h.svc.ExportSnapshot(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"yaml": yaml, "size_bytes": sizeBytes})
}

// ==================== Sandbox Handlers ====================

func (h *Handler) CreateSandbox(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	twinID := c.Param("twinId")
	var req models.CreateSandboxRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	sb, err := h.svc.CreateSandbox(c.Request.Context(), tenantID, twinID, &req)
	if err != nil {
		if err == service.ErrTwinNotFound || err == service.ErrNotOwner {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, sb)
}

func (h *Handler) ListSandboxes(c *gin.Context) {
	twinID := c.Param("twinId")
	items, err := h.svc.ListSandboxes(c.Request.Context(), twinID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetSandbox(c *gin.Context) {
	sb, err := h.svc.GetSandbox(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, sb)
}

func (h *Handler) StartSandbox(c *gin.Context) {
	sb, err := h.svc.StartSandbox(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		} else if err == service.ErrInvalidState {
			respondConflict(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, sb)
}

func (h *Handler) StopSandbox(c *gin.Context) {
	sb, err := h.svc.StopSandbox(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		} else if err == service.ErrInvalidState {
			respondConflict(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, sb)
}

func (h *Handler) DestroySandbox(c *gin.Context) {
	deleted, err := h.svc.DestroySandbox(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"success": deleted})
}

func (h *Handler) HealthCheck(c *gin.Context) {
	sb, err := h.svc.HealthCheck(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, sb)
}

// ==================== Recording Session Handlers ====================

func (h *Handler) StartRecording(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	twinID := c.Param("twinId")
	var req models.StartRecordingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	session, err := h.svc.StartRecording(c.Request.Context(), tenantID, twinID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, session)
}

func (h *Handler) ListRecordingSessions(c *gin.Context) {
	twinID := c.Param("twinId")
	items, err := h.svc.ListRecordingSessions(c.Request.Context(), twinID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetRecordingSession(c *gin.Context) {
	session, err := h.svc.GetRecordingSession(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, session)
}

func (h *Handler) PauseRecording(c *gin.Context) {
	session, err := h.svc.PauseRecording(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		} else if err == service.ErrInvalidState {
			respondConflict(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, session)
}

func (h *Handler) ResumeRecording(c *gin.Context) {
	session, err := h.svc.ResumeRecording(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		} else if err == service.ErrInvalidState {
			respondConflict(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, session)
}

func (h *Handler) StopRecording(c *gin.Context) {
	session, err := h.svc.StopRecording(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		} else if err == service.ErrInvalidState {
			respondConflict(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, session)
}

func (h *Handler) RecordTraffic(c *gin.Context) {
	sessionID := c.Param("id")
	// twinId is available from the recording session
	session, err := h.svc.GetRecordingSession(c.Request.Context(), sessionID)
	if err != nil {
		respondNotFound(c, "recording session not found")
		return
	}

	var req models.RecordTrafficRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	entry, err := h.svc.RecordTraffic(c.Request.Context(), sessionID, session.TwinID, &req)
	if err != nil {
		if err == service.ErrInvalidState {
			respondConflict(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	if entry == nil {
		respondSuccess(c, gin.H{"filtered": true})
		return
	}
	respondCreated(c, entry)
}

func (h *Handler) GetRecords(c *gin.Context) {
	records, err := h.svc.GetRecords(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, records)
}

func (h *Handler) DeleteRecordingSession(c *gin.Context) {
	deleted, err := h.svc.DeleteRecordingSession(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"success": deleted})
}

// ==================== Replay Session Handlers ====================

func (h *Handler) StartReplay(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.StartReplayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	session, err := h.svc.StartReplay(c.Request.Context(), tenantID, &req)
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		} else if err == service.ErrInvalidState {
			respondConflict(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, session)
}

func (h *Handler) GetReplaySession(c *gin.Context) {
	session, err := h.svc.GetReplaySession(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, session)
}

func (h *Handler) ListReplaySessions(c *gin.Context) {
	twinID := c.Param("twinId")
	items, err := h.svc.ListReplaySessions(c.Request.Context(), twinID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) CancelReplay(c *gin.Context) {
	session, err := h.svc.CancelReplay(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		} else if err == service.ErrInvalidState {
			respondConflict(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, session)
}

func (h *Handler) UpdateReplayProgress(c *gin.Context) {
	var req models.UpdateProgressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.UpdateReplayProgress(c.Request.Context(), c.Param("id"), &req); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "progress updated"})
}

func (h *Handler) CompleteReplay(c *gin.Context) {
	session, err := h.svc.CompleteReplay(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, session)
}