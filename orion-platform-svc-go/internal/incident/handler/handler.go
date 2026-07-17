package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/incident/models"
	"orion/platform-svc-go/internal/incident/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all incident endpoints under the given group.
// Mirrors /api/v1/incidents routes from the TS source (20 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/incidents")

	// CRUD
	f.GET("", auth.RequirePermission("incident", "read"), h.List)
	f.POST("", auth.RequirePermission("incident", "write"), h.Create)
	f.GET("/stats", auth.RequirePermission("incident", "read"), h.GetStats)

	// Per-incident operations
	f.GET("/:id", auth.RequirePermission("incident", "read"), h.Get)
	f.PUT("/:id", auth.RequirePermission("incident", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("incident", "write"), h.Delete)
	f.PATCH("/:id/status", auth.RequirePermission("incident", "write"), h.UpdateStatus)
	f.PATCH("/:id/assign", auth.RequirePermission("incident", "write"), h.AssignCommander)

	// Escalation
	f.POST("/:id/escalate", auth.RequirePermission("incident", "write"), h.Escalate)
	f.GET("/:id/escalations", auth.RequirePermission("incident", "read"), h.GetEscalations)

	// SLA
	f.GET("/:id/sla", auth.RequirePermission("incident", "read"), h.CheckSla)
	f.POST("/:id/sla/breach", auth.RequirePermission("incident", "write"), h.MarkSlaBreach)

	// Timeline
	f.POST("/:id/timeline", auth.RequirePermission("incident", "write"), h.AddTimelineEvent)
	f.GET("/:id/timeline", auth.RequirePermission("incident", "read"), h.GetTimeline)

	// Postmortem
	f.POST("/:id/postmortem", auth.RequirePermission("incident", "write"), h.CreatePostmortem)
	f.GET("/:id/postmortem", auth.RequirePermission("incident", "read"), h.GetPostmortem)
	f.PUT("/:id/postmortem", auth.RequirePermission("incident", "write"), h.UpdatePostmortem)
	f.POST("/:id/postmortem/publish", auth.RequirePermission("incident", "write"), h.PublishPostmortem)
	f.POST("/:id/postmortem/archive", auth.RequirePermission("incident", "write"), h.ArchivePostmortem)

	// Knowledge recommendations
	f.GET("/:id/knowledge", auth.RequirePermission("incident", "read"), h.GetKnowledgeRecommendations)
}

// --- CRUD handlers ---

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateIncidentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Title == "" || req.Type == "" || req.Severity == "" {
		middleware.RespondBadRequest(c, "title, type, and severity are required")
		return
	}
	m, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	pm, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Incident not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, pm)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	status := c.Query("status")
	severity := c.Query("severity")
	priority := c.Query("priority")
	items, err := h.svc.List(c.Request.Context(), tenantID, models.IncidentListQuery{
		Status:   status,
		Severity: severity,
		Priority: priority,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateIncidentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Update(c.Request.Context(), tenantID, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Incident not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Incident not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

// --- Statistics ---

func (h *Handler) GetStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetStats(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

// --- Status ---

func (h *Handler) UpdateStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Status == "" {
		middleware.RespondBadRequest(c, "status is required")
		return
	}
	actorID := c.GetString("user_id")
	m, err := h.svc.UpdateStatus(c.Request.Context(), tenantID, id, req.Status, actorID, req.Reason)
	if err != nil {
		if service.IsStateConflict(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

// --- Assignment ---

func (h *Handler) AssignCommander(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.AssignCommanderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.CommanderID == "" {
		middleware.RespondBadRequest(c, "commander_id is required")
		return
	}
	m, err := h.svc.AssignCommander(c.Request.Context(), tenantID, id, req.CommanderID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

// --- Escalation ---

func (h *Handler) Escalate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.EscalateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.ToLevel == 0 || req.Reason == "" || req.EscalatedBy == "" {
		middleware.RespondBadRequest(c, "to_level, reason, and escalated_by are required")
		return
	}
	if err := h.svc.Escalate(c.Request.Context(), tenantID, id, req); err != nil {
		if service.IsValidationErr(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"escalated": true, "to_level": req.ToLevel})
}

func (h *Handler) GetEscalations(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	escalations, err := h.svc.GetEscalations(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, escalations)
}

// --- SLA ---

func (h *Handler) CheckSla(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	sla, err := h.svc.CheckSlaBreach(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, sla)
}

func (h *Handler) MarkSlaBreach(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.MarkSlaBreach(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

// --- Timeline ---

func (h *Handler) AddTimelineEvent(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.AddTimelineEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.EventType == "" || req.Content == "" {
		middleware.RespondBadRequest(c, "event_type and content are required")
		return
	}
	if req.ActorID == "" {
		req.ActorID = c.GetString("user_id")
	}
	event, err := h.svc.AddTimelineEvent(c.Request.Context(), tenantID, id, req)
	if err != nil {
		if service.IsValidationErr(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, event)
}

func (h *Handler) GetTimeline(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	timeline, err := h.svc.GetTimeline(c.Request.Context(), tenantID, id, models.TimelineQuery{
		Limit:  &limit,
		Offset: &offset,
	})
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, timeline)
}

// --- Postmortem ---

func (h *Handler) CreatePostmortem(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.CreatePostmortemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Summary == "" || req.RootCause == "" {
		middleware.RespondBadRequest(c, "summary and root_cause are required")
		return
	}
	if req.CreatedBy == "" {
		req.CreatedBy = c.GetString("user_id")
	}
	pm, err := h.svc.CreatePostmortem(c.Request.Context(), tenantID, id, req)
	if err != nil {
		if service.IsAlreadyExists(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, pm)
}

func (h *Handler) GetPostmortem(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	pm, err := h.svc.GetPostmortem(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Post-mortem not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, pm)
}

func (h *Handler) UpdatePostmortem(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdatePostmortemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	pm, err := h.svc.UpdatePostmortem(c.Request.Context(), tenantID, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		if service.IsStateConflict(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, pm)
}

func (h *Handler) PublishPostmortem(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var body struct {
		ReviewedBy *string `json:"reviewed_by"`
	}
	c.ShouldBindJSON(&body)
	pm, err := h.svc.PublishPostmortem(c.Request.Context(), tenantID, id, body.ReviewedBy)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		if service.IsStateConflict(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, pm)
}

func (h *Handler) ArchivePostmortem(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	pm, err := h.svc.ArchivePostmortem(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		if service.IsStateConflict(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, pm)
}

// --- Knowledge recommendations ---

func (h *Handler) GetKnowledgeRecommendations(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "5"))
	result, err := h.svc.GetKnowledgeRecommendations(c.Request.Context(), tenantID, id, limit)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
