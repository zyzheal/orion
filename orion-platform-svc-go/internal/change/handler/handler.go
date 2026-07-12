package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/change/models"
	"orion/platform-svc-go/internal/change/service"

	"github.com/gin-gonic/gin"
)

// Handler exposes the change module's HTTP endpoints.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler bound to the change service.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all change endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/change")

	// === Change Request CRUD ===
	f.GET("", auth.RequirePermission("change", "read"), h.ListChangeRequests)
	f.POST("", auth.RequirePermission("change", "write"), h.CreateChangeRequest)
	f.GET("/stats", auth.RequirePermission("change", "read"), h.GetStats)
	f.GET("/:id", auth.RequirePermission("change", "read"), h.GetChangeRequest)
	f.PUT("/:id", auth.RequirePermission("change", "write"), h.UpdateChangeRequest)
	f.DELETE("/:id", auth.RequirePermission("change", "delete"), h.DeleteChangeRequest)
	f.PATCH("/:id/status", auth.RequirePermission("change", "manage"), h.UpdateStatus)
	f.GET("/:id/timeline", auth.RequirePermission("change", "read"), h.GetTimeline)
	f.POST("/:id/timeline", auth.RequirePermission("change", "write"), h.AddTimelineEvent)

	// === RFC ===
	rfc := rg.Group("/change/rfc")
	rfc.POST("", auth.RequirePermission("change", "write"), h.CreateRFC)
	rfc.GET("/:id", auth.RequirePermission("change", "read"), h.GetRFC)
	rfc.PUT("/:id", auth.RequirePermission("change", "write"), h.UpdateRFC)
	rg.GET("/change/refs", auth.RequirePermission("change", "read"), h.ListRFCs)

	// === CAB Meetings ===
	cab := rg.Group("/change/cab")
	cab.POST("", auth.RequirePermission("change", "write"), h.CreateCABMeeting)
	cab.GET("/:id", auth.RequirePermission("change", "read"), h.GetCABMeeting)
	cab.PUT("/:id", auth.RequirePermission("change", "manage"), h.UpdateCABMeeting)
	rg.GET("/change/cabs", auth.RequirePermission("change", "read"), h.ListCABMeetings)

	// === CAB Decisions ===
	rg.POST("/change/cab/:cabID/decision", auth.RequirePermission("change", "manage"), h.AddCABDecision)
}

// ==================== Change Request CRUD ====================

func (h *Handler) ListChangeRequests(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	q := models.ChangeRequestListQuery{Limit: 20, Offset: 0}
	if s := c.Query("status"); s != "" {
	q.Status = &s
	}
	if t := c.Query("type"); t != "" {
		q.Type = &t
	}
	if p := c.Query("priority"); p != "" {
		q.Priority = &p
	}
	if r := c.Query("risk_level"); r != "" {
	q.RiskLevel = &r
	}
	if a := c.Query("assigned_to"); a != "" {
		assignedTo := a
	q.AssignedTo = &assignedTo
	}
	if req := c.Query("requester_id"); req != "" {
	q.RequesterID = &req
	}
	if l := c.DefaultQuery("limit", "20"); l != "" {
	q.Limit, _ = strconv.Atoi(l)
	}
	if o := c.DefaultQuery("offset", "0"); o != "" {
	q.Offset, _ = strconv.Atoi(o)
	}
	result, err := h.svc.ListChangeRequests(c.Request.Context(), tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) CreateChangeRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.CreateChangeRequest(c.Request.Context(), tenantID, req, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) GetChangeRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	cr, err := h.svc.GetChangeRequest(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			errors.WriteError(c, errors.ErrNotFound, "change request not found", 404)
			return
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	if cr == nil {
		errors.WriteError(c, errors.ErrNotFound, "change request not found", 404)
		return
	}
	errors.WriteSuccess(c, cr)
}

func (h *Handler) UpdateChangeRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
id := c.Param("id")
	var req models.UpdateChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.UpdateChangeRequest(c.Request.Context(), tenantID, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) DeleteChangeRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteChangeRequest(c.Request.Context(), tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "change request deleted"})
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.StatusTransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
	errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.UpdateStatus(c.Request.Context(), tenantID, id, req.Status, req.Reason)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

// ==================== Timeline ====================

func (h *Handler) GetTimeline(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
id := c.Param("id")
	limit := 20
	offset := 0
	if l := c.DefaultQuery("limit", "20"); l != "" {
		limit, _ = strconv.Atoi(l)
	}
	if o := c.DefaultQuery("offset", "0"); o != "" {
		offset, _ = strconv.Atoi(o)
	}
	events, err := h.svc.GetTimeline(c.Request.Context(), tenantID, id, limit, offset)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"events": events, "total": len(events), "limit": limit, "offset": offset})
}

func (h *Handler) AddTimelineEvent(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	changeRequestID := c.Param("id")
	userID := c.GetString("user_id")
	var req models.CreateTimelineEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
event, err := h.svc.AddTimelineEvent(c.Request.Context(), tenantID, changeRequestID, req.EventType, req.Description, req.Metadata, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, event)
}

// ==================== Statistics ====================

func (h *Handler) GetStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetStats(c.Request.Context(), tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, stats)
}

// ==================== RFC ====================

func (h *Handler) CreateRFC(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateRFCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	rfc, err := h.svc.CreateRFC(c.Request.Context(), tenantID, req, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, rfc)
}

func (h *Handler) GetRFC(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	rfc, err := h.svc.GetRFC(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
		errors.WriteError(c, errors.ErrNotFound, "RFC not found", 404)
			return
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	if rfc == nil {
		errors.WriteError(c, errors.ErrNotFound, "RFC not found", 404)
		return
	}
	errors.WriteSuccess(c, rfc)
}

func (h *Handler) UpdateRFC(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateRFCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	rfc, err := h.svc.UpdateRFC(c.Request.Context(), tenantID, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, rfc)
}

func (h *Handler) ListRFCs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit := 20
	offset := 0
	if l := c.DefaultQuery("limit", "20"); l != "" {
		limit, _ = strconv.Atoi(l)
	}
	if o := c.DefaultQuery("offset", "0"); o != "" {
		offset, _ = strconv.Atoi(o)
	}
	result, err := h.svc.ListRFCs(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

// ==================== CAB Meetings ====================

func (h *Handler) CreateCABMeeting(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateCABMeetingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
	errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	meeting, err := h.svc.CreateCABMeeting(c.Request.Context(), tenantID, req, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, meeting)
}

func (h *Handler) GetCABMeeting(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
meeting, err := h.svc.GetCABMeeting(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			errors.WriteError(c, errors.ErrNotFound, "CAB meeting not found", 404)
			return
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	if meeting == nil {
		errors.WriteError(c, errors.ErrNotFound, "CAB meeting not found", 404)
		return
	}
	errors.WriteSuccess(c, meeting)
}

func (h *Handler) UpdateCABMeeting(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateCABMeetingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
meeting, err := h.svc.UpdateCABMeeting(c.Request.Context(), tenantID, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, meeting)
}

func (h *Handler) ListCABMeetings(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	q := models.CABMeetingListQuery{Limit: 20, Offset: 0}
	if s := c.Query("status"); s != "" {
		q.Status = &s
	}
	if l := c.DefaultQuery("limit", "20"); l != "" {
		q.Limit, _ = strconv.Atoi(l)
	}
	if o := c.DefaultQuery("offset", "0"); o != "" {
	q.Offset, _ = strconv.Atoi(o)
	}
	result, err := h.svc.ListCABMeetings(c.Request.Context(), tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

// ==================== CAB Decisions ====================

func (h *Handler) AddCABDecision(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	cabID := c.Param("cabID")
	var req models.CreateCABDecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	decision, err := h.svc.AddCABDecision(c.Request.Context(), tenantID, cabID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, decision)
}
