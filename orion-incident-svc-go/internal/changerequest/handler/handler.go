package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/go-common/pkg/auth"
	"orion/incident-svc-go/internal/changerequest/models"
	"orion/incident-svc-go/internal/changerequest/repository"
	"orion/incident-svc-go/internal/changerequest/service"
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
	r := rg.Group("/change-requests")
	{
		r.GET("", h.List)
		r.POST("", auth.RequirePermission("change-request", "create"), h.Create)
		r.GET("/:id", h.Get)
		r.PUT("/:id", auth.RequirePermission("change-request", "update"), h.Update)
		r.DELETE("/:id", auth.RequirePermission("change-request", "delete"), h.Delete)

		// Approval chain
		r.POST("/:id/submit", auth.RequirePermission("change-request", "update"), h.SubmitForApproval)
		r.GET("/:id/approvals", h.GetApprovalChain)
		r.POST("/:id/approvals/:approvalId/approve", auth.RequirePermission("change-request", "update"), h.Approve)
		r.POST("/:id/approvals/:approvalId/reject", auth.RequirePermission("change-request", "update"), h.Reject)

		// Execution
		r.POST("/:id/execution/start", auth.RequirePermission("change-request", "update"), h.StartExecution)
		r.GET("/:id/execution", h.GetExecution)
		r.PUT("/execution/:stepId", auth.RequirePermission("change-request", "update"), h.UpdateExecutionStep)
	}
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.CreateChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request: " + err.Error()})
		return
	}
	if req.Title == "" || req.ChangeType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "title and change_type are required"})
		return
	}

	d, err := h.svc.CreateRequest(c.Request.Context(), tenantID, &req)
	if err != nil {
		h.logger.Error("failed to create change request", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": d})
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	filters := map[string]string{
		"status":      c.Query("status"),
		"change_type": c.Query("changeType"),
		"risk_level":  c.Query("riskLevel"),
	}

	items, err := h.svc.ListRequests(c.Request.Context(), tenantID, offset, limit, filters)
	if err != nil {
		h.logger.Error("failed to list change requests", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": items})
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	d, err := h.svc.GetRequest(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": d})
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.UpdateChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request: " + err.Error()})
		return
	}

	d, err := h.svc.UpdateRequest(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		switch err {
		case service.ErrChangeRequestNotFound:
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
		case service.ErrStateConflict:
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		default:
			h.logger.Error("failed to update change request", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": d})
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.DeleteRequest(c.Request.Context(), tenantID, id); err != nil {
		switch err {
		case service.ErrChangeRequestNotFound:
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
		case service.ErrStateConflict:
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		default:
			h.logger.Error("failed to delete change request", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"deleted": true}})
}

// ── Approval Chain ────────────────────────────────────────────────────────

func (h *Handler) SubmitForApproval(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	d, err := h.svc.SubmitForApproval(c.Request.Context(), tenantID, id)
	if err != nil {
		switch err {
		case service.ErrChangeRequestNotFound:
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
		case service.ErrStateConflict:
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		default:
			h.logger.Error("failed to submit for approval", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": d})
}

func (h *Handler) GetApprovalChain(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	approvals, err := h.svc.GetApprovalChain(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": approvals})
}

func (h *Handler) Approve(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	approvalID := c.Param("approvalId")

	var req models.ApproveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request: " + err.Error()})
		return
	}

	approval, err := h.svc.ApproveRequest(c.Request.Context(), tenantID, id, approvalID, req.ApproverID, req.Comment)
	if err != nil {
		switch err {
		case service.ErrChangeRequestNotFound, service.ErrApprovalNotFound:
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		case service.ErrStateConflict:
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		default:
			h.logger.Error("failed to approve", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": approval})
}

func (h *Handler) Reject(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	approvalID := c.Param("approvalId")

	var req models.RejectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request: " + err.Error()})
		return
	}

	approval, err := h.svc.RejectRequest(c.Request.Context(), tenantID, id, approvalID, req.ApproverID, req.Comment)
	if err != nil {
		switch err {
		case service.ErrChangeRequestNotFound, service.ErrApprovalNotFound:
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		case service.ErrStateConflict:
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		default:
			h.logger.Error("failed to reject", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": approval})
}

// ── Execution ──────────────────────────────────────────────────────────────

func (h *Handler) StartExecution(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req struct {
		Steps []models.CreateExecutionStepRequest `json:"steps" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request: " + err.Error()})
		return
	}
	if len(req.Steps) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "steps array is required and must not be empty"})
		return
	}

	steps, err := h.svc.StartExecution(c.Request.Context(), tenantID, id, req.Steps)
	if err != nil {
		switch err {
		case service.ErrChangeRequestNotFound:
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
		case service.ErrStateConflict:
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		default:
			h.logger.Error("failed to start execution", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		}
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": steps})
}

func (h *Handler) GetExecution(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	progress, err := h.svc.GetExecutionProgress(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": progress})
}

func (h *Handler) UpdateExecutionStep(c *gin.Context) {
	stepID := c.Param("stepId")

	var req models.UpdateExecutionStepRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request: " + err.Error()})
		return
	}

	step, err := h.svc.UpdateExecutionStep(c.Request.Context(), stepID, &req)
	if err != nil {
		switch err {
		case service.ErrStepNotFound:
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
		default:
			h.logger.Error("failed to update execution step", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "internal error"})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": step})
}