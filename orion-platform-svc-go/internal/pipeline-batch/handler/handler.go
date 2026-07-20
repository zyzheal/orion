package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/pipeline-batch/models"
	"orion/platform-svc-go/internal/pipeline-batch/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	pg := rg.Group("/pipeline/phase-groups")

	pg.POST("/", auth.RequirePermission("pipeline", "create"), h.CreatePhaseGroup)
	pg.GET("/", auth.RequirePermission("pipeline", "read"), h.ListPhaseGroups)
	pg.GET("/:id", auth.RequirePermission("pipeline", "read"), h.GetPhaseGroup)
	pg.PUT("/:id", auth.RequirePermission("pipeline", "update"), h.UpdatePhaseGroup)
	pg.DELETE("/:id", auth.RequirePermission("pipeline", "delete"), h.DeletePhaseGroup)
	pg.POST("/:id/execute", auth.RequirePermission("pipeline", "execute"), h.StartExecution)
	pg.POST("/:id/pause", auth.RequirePermission("pipeline", "execute"), h.PauseExecution)
	pg.POST("/:id/resume", auth.RequirePermission("pipeline", "execute"), h.ResumeExecution)
	pg.POST("/:id/advance", auth.RequirePermission("pipeline", "execute"), h.AdvanceToNextBatch)
	pg.POST("/:id/rollback", auth.RequirePermission("pipeline", "execute"), h.RollbackExecution)
	pg.GET("/:id/batches", auth.RequirePermission("pipeline", "read"), h.ListBatchRuns)
	pg.POST("/:id/batches/:batchId/complete", auth.RequirePermission("pipeline", "execute"), h.CompleteBatch)
	pg.POST("/:id/batches/:batchId/fail", auth.RequirePermission("pipeline", "execute"), h.FailBatch)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) CreatePhaseGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreatePhaseGroup")
	defer span.End()
	tenantID := h.getTenantID(c)
	var req models.CreatePhaseGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	group, err := h.svc.CreatePhaseGroup(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, group)
}

func (h *Handler) ListPhaseGroups(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPhaseGroups")
	defer span.End()
	tenantID := h.getTenantID(c)
	pipelineID := c.Query("pipelineId")
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.Query("limit"))
	offset, _ := strconv.Atoi(c.Query("offset"))

	groups, total, err := h.svc.ListPhaseGroups(ctx, tenantID,
		getStrPtr(pipelineID), getStrPtr(status), &limit, &offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{Data: groups, Total: total})
}

func (h *Handler) GetPhaseGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPhaseGroup")
	defer span.End()
	tenantID := h.getTenantID(c)
	group, err := h.svc.GetPhaseGroup(ctx, c.Param("id"), tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "phase group not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, group)
}

func (h *Handler) UpdatePhaseGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdatePhaseGroup")
	defer span.End()
	tenantID := h.getTenantID(c)
	var req models.UpdatePhaseGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	group, err := h.svc.UpdatePhaseGroup(ctx, c.Param("id"), tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "phase group not found")
		} else if err == service.ErrNothingToUpdate {
			middleware.RespondBadRequest(c, err.Error())
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, group)
}

func (h *Handler) DeletePhaseGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeletePhaseGroup")
	defer span.End()
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.DeletePhaseGroup(ctx, c.Param("id"), tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "phase group not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "phase group not found")
		return
	}
	c.Status(204)
}

func (h *Handler) StartExecution(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartExecution")
	defer span.End()
	tenantID := h.getTenantID(c)
	group, err := h.svc.StartExecution(ctx, c.Param("id"), tenantID)
	if err != nil {
		if service.IsInvalidStatus(err) {
			middleware.RespondBadRequest(c, err.Error())
		} else if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "phase group not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, group)
}

func (h *Handler) PauseExecution(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PauseExecution")
	defer span.End()
	tenantID := h.getTenantID(c)
	group, err := h.svc.PauseExecution(ctx, c.Param("id"), tenantID)
	if err != nil {
		if service.IsInvalidStatus(err) {
			middleware.RespondBadRequest(c, err.Error())
		} else if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "phase group not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, group)
}

func (h *Handler) ResumeExecution(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ResumeExecution")
	defer span.End()
	tenantID := h.getTenantID(c)
	group, err := h.svc.ResumeExecution(ctx, c.Param("id"), tenantID)
	if err != nil {
		if service.IsInvalidStatus(err) {
			middleware.RespondBadRequest(c, err.Error())
		} else if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "phase group not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, group)
}

func (h *Handler) AdvanceToNextBatch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AdvanceToNextBatch")
	defer span.End()
	tenantID := h.getTenantID(c)
	group, err := h.svc.AdvanceToNextBatch(ctx, c.Param("id"), tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "phase group not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, group)
}

func (h *Handler) RollbackExecution(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RollbackExecution")
	defer span.End()
	tenantID := h.getTenantID(c)
	group, err := h.svc.RollbackExecution(ctx, c.Param("id"), tenantID)
	if err != nil {
		if service.IsInvalidStatus(err) {
			middleware.RespondBadRequest(c, err.Error())
		} else if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "phase group not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, group)
}

func (h *Handler) ListBatchRuns(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBatchRuns")
	defer span.End()
	tenantID := h.getTenantID(c)
	runs, err := h.svc.ListBatchRuns(ctx, c.Param("id"), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, runs)
}

func (h *Handler) CompleteBatch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CompleteBatch")
	defer span.End()
	tenantID := h.getTenantID(c)
	var req struct {
		Result map[string]interface{} `json:"result"`
	}
	_ = c.ShouldBindJSON(&req)
	run, err := h.svc.CompleteBatch(ctx, c.Param("id"), c.Param("batchId"), tenantID, req.Result)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "batch run not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, run)
}

func (h *Handler) FailBatch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FailBatch")
	defer span.End()
	tenantID := h.getTenantID(c)
	var req struct {
		Result map[string]interface{} `json:"result"`
	}
	_ = c.ShouldBindJSON(&req)
	run, err := h.svc.FailBatch(ctx, c.Param("id"), c.Param("batchId"), tenantID, req.Result)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "batch run not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, run)
}

func getStrPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
