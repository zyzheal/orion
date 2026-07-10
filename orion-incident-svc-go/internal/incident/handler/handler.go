package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	"orion/incident-svc-go/internal/incident/config"
	"orion/incident-svc-go/internal/incident/models"
	"orion/incident-svc-go/internal/incident/repository"
	"orion/incident-svc-go/internal/incident/service"
)

// Handler handles HTTP requests for the incident service.
type Handler struct {
	incidentRepo   *repository.IncidentRepository
	timelineRepo   *repository.TimelineEventRepository
	postmortemRepo *repository.PostmortemRepository
	escalationRepo *repository.EscalationRepository
	incidentSvc    *service.IncidentService
	rdb            *redis.Client
	logger         *zap.Logger
	cfg            *config.Config
}

// New creates a new Handler with full service layer.
func New(db *database.DB, rdb *redis.Client, logger *zap.Logger, cfg *config.Config) *Handler {
	incidentRepo := repository.NewIncidentRepository(db)
	timelineRepo := repository.NewTimelineEventRepository(db)
	postmortemRepo := repository.NewPostmortemRepository(db)
	escalationRepo := repository.NewEscalationRepository(db)

	return &Handler{
		incidentRepo:   incidentRepo,
		timelineRepo:   timelineRepo,
		postmortemRepo: postmortemRepo,
		escalationRepo: escalationRepo,
		incidentSvc:    service.NewIncidentService(incidentRepo, timelineRepo, postmortemRepo, escalationRepo),
		rdb:            rdb,
		logger:         logger,
		cfg:            cfg,
	}
}

// Response is the standard API response envelope.
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func (h *Handler) success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{Code: 0, Message: "success", Data: data})
}

func (h *Handler) err(c *gin.Context, code int, message string) {
	c.JSON(code, Response{Code: code, Message: message})
}

// ── Incident CRUD ───────────────────────────────────────────────────────

// CreateIncident handles POST /api/v1/incidents
func (h *Handler) CreateIncident(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.CreateIncidentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	ctx := c.Request.Context()
	incident, err := h.incidentSvc.CreateIncident(ctx, req, tenantID)
	if err != nil {
		h.logger.Error("failed to create incident", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	c.JSON(http.StatusCreated, Response{Code: 0, Message: "success", Data: incident})
}

// ListIncidents handles GET /api/v1/incidents
func (h *Handler) ListIncidents(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	offset := (page - 1) * pageSize

	filters := models.IncidentListFilters{
		Status:   strPtrOrNil(c.Query("status")),
		Severity: strPtrOrNil(c.Query("severity")),
		Priority: strPtrOrNil(c.Query("priority")),
		Type:     strPtrOrNil(c.Query("type")),
		Limit:    pageSize,
		Offset:   offset,
	}

	ctx := c.Request.Context()
	incidents, err := h.incidentSvc.ListIncidents(ctx, tenantID, filters)
	if err != nil {
		h.logger.Error("failed to list incidents", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	c.JSON(http.StatusOK, Response{Code: 0, Message: "success", Data: incidents})
}

// GetIncident handles GET /api/v1/incidents/:id
func (h *Handler) GetIncident(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	ctx := c.Request.Context()
	incident, err := h.incidentSvc.GetIncident(ctx, id, tenantID)
	if err != nil {
		h.err(c, http.StatusNotFound, "incident not found")
		return
	}

	h.success(c, incident)
}

// UpdateIncident handles PUT /api/v1/incidents/:id
func (h *Handler) UpdateIncident(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req models.UpdateIncidentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	ctx := c.Request.Context()
	incident, err := h.incidentSvc.UpdateIncident(ctx, id, tenantID, req)
	if err != nil {
		switch err {
		case service.ErrIncidentNotFound:
			h.err(c, http.StatusNotFound, "incident not found")
		default:
			h.logger.Error("failed to update incident", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, incident)
}

// DeleteIncident handles DELETE /api/v1/incidents/:id
func (h *Handler) DeleteIncident(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	ctx := c.Request.Context()
	if err := h.incidentSvc.DeleteIncident(ctx, id, tenantID); err != nil {
		h.logger.Error("failed to delete incident", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, gin.H{"deleted": true})
}

// ── Status Management ───────────────────────────────────────────────────

// UpdateStatus handles PATCH /api/v1/incidents/:id/status
func (h *Handler) UpdateStatus(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req models.UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}
	if req.Status == "" {
		h.err(c, http.StatusBadRequest, "status is required")
		return
	}

	ctx := c.Request.Context()
	incident, err := h.incidentSvc.UpdateStatus(ctx, id, tenantID, req)
	if err != nil {
		switch err {
		case service.ErrIncidentNotFound:
			h.err(c, http.StatusNotFound, "incident not found")
		case service.ErrInvalidTransition:
			h.err(c, http.StatusBadRequest, err.Error())
		default:
			h.logger.Error("failed to update status", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, incident)
}

// AssignCommander handles PATCH /api/v1/incidents/:id/assign
func (h *Handler) AssignCommander(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		CommanderID string `json:"commander_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	ctx := c.Request.Context()
	incident, err := h.incidentSvc.AssignCommander(ctx, id, tenantID, req.CommanderID)
	if err != nil {
		switch err {
		case service.ErrIncidentNotFound:
			h.err(c, http.StatusNotFound, "incident not found")
		default:
			h.logger.Error("failed to assign commander", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, incident)
}

// ── Escalation ──────────────────────────────────────────────────────────

// EscalateIncident handles POST /api/v1/incidents/:id/escalate
func (h *Handler) EscalateIncident(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req models.EscalateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}
	if req.ToLevel <= 0 || req.Reason == "" || req.EscalatedBy == "" {
		h.err(c, http.StatusBadRequest, "to_level, reason, and escalated_by are required")
		return
	}

	ctx := c.Request.Context()
	err := h.incidentSvc.EscalateIncident(ctx, id, tenantID, req)
	if err != nil {
		switch err {
		case service.ErrIncidentNotFound:
			h.err(c, http.StatusNotFound, "incident not found")
		default:
			h.logger.Error("failed to escalate incident", zap.Error(err))
			h.err(c, http.StatusBadRequest, err.Error())
		}
		return
	}

	h.success(c, gin.H{"escalated": true, "to_level": req.ToLevel})
}

// GetEscalationHistory handles GET /api/v1/incidents/:id/escalations
func (h *Handler) GetEscalationHistory(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	ctx := c.Request.Context()
	history, err := h.incidentSvc.GetEscalationHistory(ctx, id, tenantID)
	if err != nil {
		h.logger.Error("failed to get escalation history", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, history)
}

// ── SLA ─────────────────────────────────────────────────────────────────

// CheckSLABreach handles GET /api/v1/incidents/:id/sla
func (h *Handler) CheckSLABreach(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	ctx := c.Request.Context()
	slaStatus, err := h.incidentSvc.CheckSLABreach(ctx, id, tenantID)
	if err != nil {
		switch err {
		case service.ErrIncidentNotFound:
			h.err(c, http.StatusNotFound, "incident not found")
		default:
			h.logger.Error("failed to check SLA", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, slaStatus)
}

// MarkSLABreach handles POST /api/v1/incidents/:id/sla/breach
func (h *Handler) MarkSLABreach(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	ctx := c.Request.Context()
	incident, err := h.incidentSvc.MarkSLABreach(ctx, id, tenantID)
	if err != nil {
		switch err {
		case service.ErrIncidentNotFound:
			h.err(c, http.StatusNotFound, "incident not found")
		default:
			h.logger.Error("failed to mark SLA breach", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, incident)
}

// ── Timeline ────────────────────────────────────────────────────────────

// AddTimelineEvent handles POST /api/v1/incidents/:id/timeline
func (h *Handler) AddTimelineEvent(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	actorID := c.GetString("actor_id")

	var req struct {
		EventType string                 `json:"event_type" binding:"required"`
		Content   string                 `json:"content" binding:"required"`
		Metadata  map[string]interface{} `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	ctx := c.Request.Context()
	event, err := h.incidentSvc.AddTimelineEvent(ctx, id, tenantID, req.EventType, req.Content, actorID, req.Metadata)
	if err != nil {
		switch err {
		case service.ErrIncidentNotFound:
			h.err(c, http.StatusNotFound, "incident not found")
		default:
			h.logger.Error("failed to add timeline event", zap.Error(err))
			h.err(c, http.StatusBadRequest, err.Error())
		}
		return
	}

	c.JSON(http.StatusCreated, Response{Code: 0, Message: "success", Data: event})
}

// GetTimeline handles GET /api/v1/incidents/:id/timeline
func (h *Handler) GetTimeline(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	ctx := c.Request.Context()
	events, err := h.incidentSvc.GetTimeline(ctx, id, tenantID, limit, offset)
	if err != nil {
		h.logger.Error("failed to get timeline", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, events)
}

// ── Postmortem ──────────────────────────────────────────────────────────

// CreatePostmortem handles POST /api/v1/incidents/:id/postmortem
func (h *Handler) CreatePostmortem(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req models.CreatePostmortemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	ctx := c.Request.Context()
	record, err := h.incidentSvc.CreatePostmortem(ctx, id, tenantID, req)
	if err != nil {
		switch err {
		case service.ErrIncidentNotFound:
			h.err(c, http.StatusNotFound, "incident not found")
		case service.ErrPostmortemExists:
			h.err(c, http.StatusConflict, "postmortem already exists for this incident")
		default:
			h.logger.Error("failed to create postmortem", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	c.JSON(http.StatusCreated, Response{Code: 0, Message: "success", Data: record})
}

// GetPostmortem handles GET /api/v1/incidents/:id/postmortem
func (h *Handler) GetPostmortem(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	ctx := c.Request.Context()
	record, err := h.incidentSvc.GetPostmortem(ctx, id, tenantID)
	if err != nil {
		switch err {
		case service.ErrIncidentNotFound:
			h.err(c, http.StatusNotFound, "incident not found")
		case service.ErrPostmortemNotFound:
			h.err(c, http.StatusNotFound, "postmortem not found")
		default:
			h.logger.Error("failed to get postmortem", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, record)
}

// UpdatePostmortem handles PUT /api/v1/incidents/:id/postmortem
func (h *Handler) UpdatePostmortem(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	ctx := c.Request.Context()
	record, err := h.incidentSvc.UpdatePostmortem(ctx, id, tenantID, req)
	if err != nil {
		switch err {
		case service.ErrIncidentNotFound:
			h.err(c, http.StatusNotFound, "incident not found")
		case service.ErrPostmortemNotFound:
			h.err(c, http.StatusNotFound, "postmortem not found")
		default:
			h.logger.Error("failed to update postmortem", zap.Error(err))
			h.err(c, http.StatusBadRequest, err.Error())
		}
		return
	}

	h.success(c, record)
}

// PublishPostmortem handles POST /api/v1/incidents/:id/postmortem/publish
func (h *Handler) PublishPostmortem(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	reviewedBy := c.GetString("actor_id")

	ctx := c.Request.Context()
	record, err := h.incidentSvc.PublishPostmortem(ctx, id, tenantID, reviewedBy)
	if err != nil {
		switch err {
		case service.ErrIncidentNotFound:
			h.err(c, http.StatusNotFound, "incident not found")
		case service.ErrPostmortemNotFound:
			h.err(c, http.StatusNotFound, "postmortem not found")
		default:
			h.logger.Error("failed to publish postmortem", zap.Error(err))
			h.err(c, http.StatusBadRequest, err.Error())
		}
		return
	}

	h.success(c, record)
}

// ArchivePostmortem handles POST /api/v1/incidents/:id/postmortem/archive
func (h *Handler) ArchivePostmortem(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	ctx := c.Request.Context()
	record, err := h.incidentSvc.ArchivePostmortem(ctx, id, tenantID)
	if err != nil {
		switch err {
		case service.ErrIncidentNotFound:
			h.err(c, http.StatusNotFound, "incident not found")
		case service.ErrPostmortemNotFound:
			h.err(c, http.StatusNotFound, "postmortem not found")
		default:
			h.logger.Error("failed to archive postmortem", zap.Error(err))
			h.err(c, http.StatusBadRequest, err.Error())
		}
		return
	}

	h.success(c, record)
}

// ── Statistics ──────────────────────────────────────────────────────────

// GetStats handles GET /api/v1/incidents/stats
func (h *Handler) GetStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	ctx := c.Request.Context()
	stats, err := h.incidentSvc.GetStats(ctx, tenantID)
	if err != nil {
		h.logger.Error("failed to get incident stats", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, stats)
}

// ── Postmortems ──────────────────────────────────────────────────────────

// ListPostmortems handles GET /api/v1/postmortems
func (h *Handler) ListPostmortems(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	offset := (page - 1) * pageSize

	var statusPtr *string
	if status != "" {
		statusPtr = strPtrOrNil(status)
	}

	ctx := c.Request.Context()
	records, total, err := h.incidentSvc.ListPostmortems(ctx, tenantID, statusPtr, pageSize, offset)
	if err != nil {
		h.logger.Error("failed to list postmortems", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, gin.H{
		"data":  records,
		"total": total,
	})
}

// ── Knowledge Recommendations ────────────────────────────────────────────

// GetKnowledgeRecommendations handles GET /api/v1/incidents/:id/knowledge
func (h *Handler) GetKnowledgeRecommendations(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "5"))

	ctx := c.Request.Context()
	recs, err := h.incidentSvc.GetKnowledgeRecommendations(ctx, id, tenantID, limit)
	if err != nil {
		h.logger.Error("failed to get knowledge recommendations", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, recs)
}

// ── Link to Problem / Change ─────────────────────────────────────────────

// LinkProblem handles POST /api/v1/incidents/:id/link-problem
func (h *Handler) LinkProblem(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		ProblemID string `json:"problem_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	ctx := c.Request.Context()
	incident, err := h.incidentSvc.LinkProblem(ctx, id, req.ProblemID, tenantID)
	if err != nil {
		switch err {
		case service.ErrIncidentNotFound:
			h.err(c, http.StatusNotFound, "incident not found")
		default:
			h.logger.Error("failed to link problem", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, incident)
}

// LinkChange handles POST /api/v1/incidents/:id/link-change
func (h *Handler) LinkChange(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		ChangeID string `json:"change_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	ctx := c.Request.Context()
	incident, err := h.incidentSvc.LinkChange(ctx, id, req.ChangeID, tenantID)
	if err != nil {
		switch err {
		case service.ErrIncidentNotFound:
			h.err(c, http.StatusNotFound, "incident not found")
		default:
			h.logger.Error("failed to link change", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, incident)
}

// ── Helpers ─────────────────────────────────────────────────────────────

func strPtrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
