package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/change/models"
	"orion/platform-svc-go/internal/change/service"


	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
	"orion/go-common/pkg/sentinel"
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListChangeRequests")
	defer span.End()
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
	result, err := h.svc.ListChangeRequests(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) CreateChangeRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateChangeRequest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.CreateChangeRequest(ctx, tenantID, req, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) GetChangeRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetChangeRequest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	cr, err := h.svc.GetChangeRequest(ctx, tenantID, id)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateChangeRequest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
id := c.Param("id")
	var req models.UpdateChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.UpdateChangeRequest(ctx, tenantID, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) DeleteChangeRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteChangeRequest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteChangeRequest(ctx, tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	middleware.RespondNoContent(c)
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.StatusTransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
	errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.UpdateStatus(ctx, tenantID, id, req.Status, req.Reason)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

// ==================== Timeline ====================

func (h *Handler) GetTimeline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTimeline")
	defer span.End()
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
	events, err := h.svc.GetTimeline(ctx, tenantID, id, limit, offset)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"events": events, "total": len(events), "limit": limit, "offset": offset})
}

func (h *Handler) AddTimelineEvent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddTimelineEvent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	changeRequestID := c.Param("id")
	userID := c.GetString("user_id")
	var req models.CreateTimelineEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
event, err := h.svc.AddTimelineEvent(ctx, tenantID, changeRequestID, req.EventType, req.Description, req.Metadata, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, event)
}

// ==================== Statistics ====================

func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetStats(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, stats)
}

// ==================== RFC ====================

func (h *Handler) CreateRFC(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateRFC")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateRFCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	rfc, err := h.svc.CreateRFC(ctx, tenantID, req, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, rfc)
}

func (h *Handler) GetRFC(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRFC")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	rfc, err := h.svc.GetRFC(ctx, tenantID, id)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateRFC")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateRFCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	rfc, err := h.svc.UpdateRFC(ctx, tenantID, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, rfc)
}

func (h *Handler) ListRFCs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRFCs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit := 20
	offset := 0
	if l := c.DefaultQuery("limit", "20"); l != "" {
		limit, _ = strconv.Atoi(l)
	}
	if o := c.DefaultQuery("offset", "0"); o != "" {
		offset, _ = strconv.Atoi(o)
	}
	result, err := h.svc.ListRFCs(ctx, tenantID, limit, offset)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

// ==================== CAB Meetings ====================

func (h *Handler) CreateCABMeeting(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateCABMeeting")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateCABMeetingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
	errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	meeting, err := h.svc.CreateCABMeeting(ctx, tenantID, req, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, meeting)
}

func (h *Handler) GetCABMeeting(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCABMeeting")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
meeting, err := h.svc.GetCABMeeting(ctx, tenantID, id)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateCABMeeting")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateCABMeetingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
meeting, err := h.svc.UpdateCABMeeting(ctx, tenantID, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, meeting)
}

func (h *Handler) ListCABMeetings(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCABMeetings")
	defer span.End()
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
	result, err := h.svc.ListCABMeetings(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

// ==================== CAB Decisions ====================

func (h *Handler) AddCABDecision(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddCABDecision")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	cabID := c.Param("cabID")
	var req models.CreateCABDecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	decision, err := h.svc.AddCABDecision(ctx, tenantID, cabID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, decision)
}
