package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/go-common/pkg/auth"
	"orion/incident-svc-go/internal/change/models"
	"orion/incident-svc-go/internal/change/repository"
	"orion/incident-svc-go/internal/change/service"
)

type Handler struct {
	svc    *service.Service
	logger *zap.Logger
}

func NewHandler(db *sqlx.DB, logger *zap.Logger) *Handler {
	repo := repository.NewRepository(db)
	svc := service.NewService(repo)
	return &Handler{svc: svc, logger: logger}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/changes")
	{
		// Change Requests
		r.GET("/requests", h.ListChangeRequests)
		r.POST("/requests", auth.RequirePermission("change-management", "write"), h.CreateChangeRequest)
		r.GET("/requests/:id", h.GetChangeRequest)
		r.PUT("/requests/:id", auth.RequirePermission("change-management", "write"), h.UpdateChangeRequest)
		r.DELETE("/requests/:id", auth.RequirePermission("change-management", "delete"), h.DeleteChangeRequest)
		r.PATCH("/requests/:id/status", auth.RequirePermission("change-management", "write"), h.UpdateStatus)
		r.GET("/requests/:id/timeline", h.GetTimeline)
		r.POST("/requests/:id/timeline", auth.RequirePermission("change-management", "write"), h.AddTimelineEvent)

		// RFCs
		r.GET("/rfcs", h.ListRFCs)
		r.POST("/rfcs", auth.RequirePermission("change-management", "write"), h.CreateRFC)
		r.GET("/rfcs/:id", h.GetRFC)
		r.PUT("/rfcs/:id", auth.RequirePermission("change-management", "write"), h.UpdateRFC)

		// CAB Meetings
		r.GET("/cab", h.ListCABMeetings)
		r.POST("/cab", auth.RequirePermission("change-management", "write"), h.CreateCABMeeting)
		r.GET("/cab/:id", h.GetCABMeeting)
		r.PUT("/cab/:id", auth.RequirePermission("change-management", "write"), h.UpdateCABMeeting)
		r.POST("/cab/:id/decisions", auth.RequirePermission("change-management", "write"), h.AddCABDecision)

		// Stats
		r.GET("/stats", h.GetStats)
	}
}

func (h *Handler) CreateChangeRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	actorID := c.GetString("actor_id")

	var req models.CreateChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request: " + err.Error()})
		return
	}
	if req.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "title is required"})
		return
	}

	d, err := h.svc.CreateChangeRequest(c.Request.Context(), tenantID, actorID, &req)
	if err != nil {
		h.logger.Error("failed to create change request", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": d})
}

func (h *Handler) ListChangeRequests(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	offset := (page - 1) * pageSize

	filters := map[string]string{
		"status":       c.Query("status"),
		"type":         c.Query("type"),
		"priority":     c.Query("priority"),
		"risk_level":   c.Query("riskLevel"),
		"assigned_to":  c.Query("assignedTo"),
		"requester_id": c.Query("requesterId"),
	}

	items, err := h.svc.ListChangeRequests(c.Request.Context(), tenantID, offset, pageSize, filters)
	if err != nil {
		h.logger.Error("failed to list change requests", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": items})
}

func (h *Handler) GetChangeRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	d, err := h.svc.GetChangeRequest(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": d})
}

func (h *Handler) UpdateChangeRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.UpdateChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request: " + err.Error()})
		return
	}

	d, err := h.svc.UpdateChangeRequest(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		if err == service.ErrChangeRequestNotFound {
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
			return
		}
		h.logger.Error("failed to update change request", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": d})
}

func (h *Handler) DeleteChangeRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.DeleteChangeRequest(c.Request.Context(), tenantID, id); err != nil {
		h.logger.Error("failed to delete change request", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"deleted": true}})
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	actorID := c.GetString("actor_id")

	var req struct {
		Status string `json:"status" binding:"required"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request: " + err.Error()})
		return
	}

	d, err := h.svc.UpdateStatus(c.Request.Context(), tenantID, id, req.Status, actorID, req.Reason)
	if err != nil {
		if err == service.ErrChangeRequestNotFound {
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
			return
		}
		h.logger.Error("failed to update status", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": d})
}

// ── Timeline ────────────────────────────────────────────────────────────

func (h *Handler) AddTimelineEvent(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	changeRequestID := c.Param("id")
	actorID := c.GetString("actor_id")

	var req models.AddTimelineEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request: " + err.Error()})
		return
	}

	e, err := h.svc.AddTimelineEvent(c.Request.Context(), tenantID, changeRequestID, req.EventType, req.Description, actorID)
	if err != nil {
		h.logger.Error("failed to add timeline event", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": e})
}

func (h *Handler) GetTimeline(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	changeRequestID := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	events, err := h.svc.GetTimeline(c.Request.Context(), tenantID, changeRequestID, offset, limit)
	if err != nil {
		h.logger.Error("failed to get timeline", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": events})
}

// ── RFCs ─────────────────────────────────────────────────────────────────

func (h *Handler) CreateRFC(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	actorID := c.GetString("actor_id")

	var req models.CreateRFCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request: " + err.Error()})
		return
	}

	d, err := h.svc.CreateRFC(c.Request.Context(), tenantID, actorID, &req)
	if err != nil {
		h.logger.Error("failed to create RFC", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": d})
}

func (h *Handler) ListRFCs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	items, err := h.svc.ListRFCs(c.Request.Context(), tenantID, offset, limit)
	if err != nil {
		h.logger.Error("failed to list RFCs", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": items})
}

func (h *Handler) GetRFC(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	d, err := h.svc.GetRFC(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": d})
}

func (h *Handler) UpdateRFC(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.UpdateRFCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request: " + err.Error()})
		return
	}

	d, err := h.svc.UpdateRFC(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		if err == service.ErrRFCNotFound {
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
			return
		}
		h.logger.Error("failed to update RFC", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": d})
}

// ── CAB Meetings ──────────────────────────────────────────────────────────

func (h *Handler) CreateCABMeeting(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	actorID := c.GetString("actor_id")

	var req models.CreateCABMeetingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request: " + err.Error()})
		return
	}

	d, err := h.svc.CreateCABMeeting(c.Request.Context(), tenantID, actorID, &req)
	if err != nil {
		h.logger.Error("failed to create CAB meeting", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": d})
}

func (h *Handler) ListCABMeetings(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	status := c.Query("status")

	items, err := h.svc.ListCABMeetings(c.Request.Context(), tenantID, offset, limit, status)
	if err != nil {
		h.logger.Error("failed to list CAB meetings", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": items})
}

func (h *Handler) GetCABMeeting(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	d, err := h.svc.GetCABMeeting(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": d})
}

func (h *Handler) UpdateCABMeeting(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.UpdateCABMeetingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request: " + err.Error()})
		return
	}

	d, err := h.svc.UpdateCABMeeting(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		if err == service.ErrCABMeetingNotFound {
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
			return
		}
		h.logger.Error("failed to update CAB meeting", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": d})
}

func (h *Handler) AddCABDecision(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	cabMeetingID := c.Param("id")

	var req models.AddCABDecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request: " + err.Error()})
		return
	}

	d, err := h.svc.AddCABDecision(c.Request.Context(), tenantID, cabMeetingID, &req)
	if err != nil {
		h.logger.Error("failed to add CAB decision", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": d})
}

// ── Stats ────────────────────────────────────────────────────────────────

func (h *Handler) GetStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	stats, err := h.svc.GetStats(c.Request.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to get stats", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": stats})
}