package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"
	"orion/go-common/pkg/errors"
	"strconv"

	"orion/platform-svc-go/internal/infrastructure/digital-twin/models"
	"orion/platform-svc-go/internal/infrastructure/digital-twin/service"

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
		twins.POST("/:id/snapshots", auth.RequirePermission("digital_twin", "write"), h.CreateSnapshot)
		twins.POST("/:id/sandboxes", auth.RequirePermission("digital_twin", "write"), h.CreateSandbox)
		twins.GET("/:id/sandboxes", auth.RequirePermission("digital_twin", "read"), h.ListSandboxes)
		twins.POST("/:id/recordings", auth.RequirePermission("digital_twin", "execute"), h.StartRecording)
		twins.GET("/:id/recordings", auth.RequirePermission("digital_twin", "read"), h.ListRecordingSessions)
		twins.GET("/:id/replays", auth.RequirePermission("digital_twin", "read"), h.ListReplaySessions)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateDigitalTwinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.Create(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, d)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.List(ctx, tenantID, (page-1)*ps, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinGet")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinUpdate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateDigitalTwinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.Update(ctx, tenantID, c.Param("id"), &req)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinDelete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinCount")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

func (h *Handler) Sync(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinSync")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.Sync(ctx, tenantID, c.Param("id"))
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinMetrics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	metrics, err := h.svc.GetMetrics(ctx, tenantID, c.Param("id"))
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinCreateSnapshot")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	_ = c.Param("id") // twinId available for future use
	var req models.CreateSnapshotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	snap, err := h.svc.CreateSnapshot(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, snap)
}

func (h *Handler) ListSnapshots(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinListSnapshots")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	environment := c.Query("environment")
	status := c.Query("status")
	snaps, err := h.svc.ListSnapshots(ctx, tenantID, environment, status)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, snaps)
}

func (h *Handler) GetSnapshot(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinGetSnapshot")
	defer span.End()
	snap, err := h.svc.GetSnapshot(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, snap)
}

func (h *Handler) DeleteSnapshot(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinDeleteSnapshot")
	defer span.End()
	deleted, err := h.svc.DeleteSnapshot(ctx, c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"success": deleted})
}

func (h *Handler) RestoreSnapshot(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinRestoreSnapshot")
	defer span.End()
	var req models.RestoreSnapshotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	restoreID, status, err := h.svc.RestoreSnapshot(ctx, c.Param("id"), &req)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinExportSnapshot")
	defer span.End()
	yaml, sizeBytes, err := h.svc.ExportSnapshot(ctx, c.Param("id"))
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinCreateSandbox")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	twinID := c.Param("id")
	var req models.CreateSandboxRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	sb, err := h.svc.CreateSandbox(ctx, tenantID, twinID, &req)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinListSandboxes")
	defer span.End()
	twinID := c.Param("id")
	items, err := h.svc.ListSandboxes(ctx, twinID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetSandbox(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinGetSandbox")
	defer span.End()
	sb, err := h.svc.GetSandbox(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, sb)
}

func (h *Handler) StartSandbox(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinStartSandbox")
	defer span.End()
	sb, err := h.svc.StartSandbox(ctx, c.Param("id"))
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinStopSandbox")
	defer span.End()
	sb, err := h.svc.StopSandbox(ctx, c.Param("id"))
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinDestroySandbox")
	defer span.End()
	deleted, err := h.svc.DestroySandbox(ctx, c.Param("id"))
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinHealthCheck")
	defer span.End()
	sb, err := h.svc.HealthCheck(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, sb)
}

// ==================== Recording Session Handlers ====================

func (h *Handler) StartRecording(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinStartRecording")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	twinID := c.Param("id")
	var req models.StartRecordingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	session, err := h.svc.StartRecording(ctx, tenantID, twinID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, session)
}

func (h *Handler) ListRecordingSessions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinListRecordingSessions")
	defer span.End()
	twinID := c.Param("id")
	items, err := h.svc.ListRecordingSessions(ctx, twinID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetRecordingSession(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinGetRecordingSession")
	defer span.End()
	session, err := h.svc.GetRecordingSession(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, session)
}

func (h *Handler) PauseRecording(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinPauseRecording")
	defer span.End()
	session, err := h.svc.PauseRecording(ctx, c.Param("id"))
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinResumeRecording")
	defer span.End()
	session, err := h.svc.ResumeRecording(ctx, c.Param("id"))
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinStopRecording")
	defer span.End()
	session, err := h.svc.StopRecording(ctx, c.Param("id"))
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinRecordTraffic")
	defer span.End()
	sessionID := c.Param("id")
	// twinId is available from the recording session
	session, err := h.svc.GetRecordingSession(ctx, sessionID)
	if err != nil {
		respondNotFound(c, "recording session not found")
		return
	}

	var req models.RecordTrafficRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	entry, err := h.svc.RecordTraffic(ctx, sessionID, session.TwinID, &req)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinGetRecords")
	defer span.End()
	records, err := h.svc.GetRecords(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, records)
}

func (h *Handler) DeleteRecordingSession(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinDeleteRecordingSession")
	defer span.End()
	deleted, err := h.svc.DeleteRecordingSession(ctx, c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"success": deleted})
}

// ==================== Replay Session Handlers ====================

func (h *Handler) StartReplay(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinStartReplay")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.StartReplayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	session, err := h.svc.StartReplay(ctx, tenantID, &req)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinGetReplaySession")
	defer span.End()
	session, err := h.svc.GetReplaySession(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, session)
}

func (h *Handler) ListReplaySessions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinListReplaySessions")
	defer span.End()
	twinID := c.Param("id")
	items, err := h.svc.ListReplaySessions(ctx, twinID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) CancelReplay(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinCancelReplay")
	defer span.End()
	session, err := h.svc.CancelReplay(ctx, c.Param("id"))
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinUpdateReplayProgress")
	defer span.End()
	var req models.UpdateProgressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.UpdateReplayProgress(ctx, c.Param("id"), &req); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "progress updated"})
}

func (h *Handler) CompleteReplay(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDigitalTwinCompleteReplay")
	defer span.End()
	session, err := h.svc.CompleteReplay(ctx, c.Param("id"))
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
