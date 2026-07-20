package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/deploy-enhanced/models"
	"orion/platform-svc-go/internal/deploy-enhanced/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all deploy-enhanced endpoints under the given group.
// Mirrors /api/v1/deploy routes from the TS source (15 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/deploy")

	// --- Deploy Windows ---
	// GET /deploy/windows - List deploy windows
	f.GET("/windows", auth.RequirePermission("deploy_enhanced", "read"), h.ListWindows)
	// POST /deploy/windows - Create a deploy window
	f.POST("/windows", auth.RequirePermission("deploy_enhanced", "write"), h.CreateWindow)
	// GET /deploy/windows/:id - Get window detail
	f.GET("/windows/:id", auth.RequirePermission("deploy_enhanced", "read"), h.GetWindow)
	// PUT /deploy/windows/:id - Update a deploy window
	f.PUT("/windows/:id", auth.RequirePermission("deploy_enhanced", "write"), h.UpdateWindow)
	// DELETE /deploy/windows/:id - Delete a deploy window
	f.DELETE("/windows/:id", auth.RequirePermission("deploy_enhanced", "delete"), h.DeleteWindow)
	// GET /deploy/windows/:id/check - Check if within window
	f.GET("/windows/:id/check", auth.RequirePermission("deploy_enhanced", "read"), h.CheckWindow)

	// --- Progressive Deploy ---
	// POST /deploy/:deploymentId/progressive - Create progressive deploy
	f.POST("/:deploymentId/progressive", auth.RequirePermission("deploy_enhanced", "write"), h.CreateProgressiveDeploy)
	// GET /deploy/progressive/:deployId - Get progress
	f.GET("/progressive/:deployId", auth.RequirePermission("deploy_enhanced", "read"), h.GetProgress)
	// POST /deploy/progressive/:deployId/advance - Advance to next stage
	f.POST("/progressive/:deployId/advance", auth.RequirePermission("deploy_enhanced", "write"), h.AdvanceStage)
	// POST /deploy/progressive/:deployId/rollback - Rollback a stage
	f.POST("/progressive/:deployId/rollback", auth.RequirePermission("deploy_enhanced", "write"), h.RollbackStage)

	// --- Emergency Deploy ---
	// POST /deploy/emergencies - Request emergency deploy
	f.POST("/emergencies", auth.RequirePermission("deploy_enhanced", "write"), h.RequestEmergencyDeploy)
	// GET /deploy/emergencies - List emergencies
	f.GET("/emergencies", auth.RequirePermission("deploy_enhanced", "read"), h.ListEmergencies)
	// POST /deploy/emergencies/:id/approve - Approve emergency
	f.POST("/emergencies/:id/approve", auth.RequirePermission("deploy_enhanced", "write"), h.ApproveEmergencyDeploy)
	// POST /deploy/emergencies/:id/complete - Complete emergency
	f.POST("/emergencies/:id/complete", auth.RequirePermission("deploy_enhanced", "write"), h.CompleteEmergencyDeploy)
	// POST /deploy/emergencies/:id/reject - Reject emergency
	f.POST("/emergencies/:id/reject", auth.RequirePermission("deploy_enhanced", "write"), h.RejectEmergencyDeploy)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// --- Deploy Window handlers ---

func (h *Handler) ListWindows(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListWindows")
	defer span.End()
	tenantID := h.getTenantID(c)
	environmentID := c.Query("environmentId")
	status := c.Query("status")
	envPtr := &environmentID
	if environmentID == "" {
		envPtr = nil
	}
	statusPtr := &status
	if status == "" {
		statusPtr = nil
	}
	windows, total, err := h.svc.ListWindows(ctx, tenantID, envPtr, statusPtr)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     windows,
		Total:    total,
		Page:     1,
		PageSize: total,
	})
}

func (h *Handler) GetWindow(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetWindow")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	w, err := h.svc.GetWindow(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "deploy window not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, w)
}

func (h *Handler) CreateWindow(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateWindow")
	defer span.End()
	var req models.CreateDeployWindowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	w, err := h.svc.CreateWindow(ctx, &req, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, w)
}

func (h *Handler) UpdateWindow(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateWindow")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateDeployWindowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	w, err := h.svc.UpdateWindow(ctx, id, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "deploy window not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, w)
}

func (h *Handler) DeleteWindow(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteWindow")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.DeleteWindow(ctx, id, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "deploy window not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deploy window deleted"})
}

func (h *Handler) CheckWindow(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CheckWindow")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	result, err := h.svc.CheckWindow(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "deploy window not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// --- Progressive Deploy handlers ---

func (h *Handler) CreateProgressiveDeploy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateProgressiveDeploy")
	defer span.End()
	deploymentID := c.Param("deploymentId")
	var req models.CreateProgressiveDeployRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	pd, err := h.svc.CreateProgressiveDeploy(ctx, deploymentID, &req, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, pd)
}

func (h *Handler) GetProgress(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetProgress")
	defer span.End()
	deployID := c.Param("deployId")
	tenantID := h.getTenantID(c)
	pd, err := h.svc.GetProgress(ctx, deployID, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "progressive deploy not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, pd)
}

func (h *Handler) AdvanceStage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AdvanceStage")
	defer span.End()
	deployID := c.Param("deployId")
	var req models.AdvanceStageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	pd, err := h.svc.AdvanceStage(ctx, deployID, req.StageID, req.ValidationResult, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, pd)
}

func (h *Handler) RollbackStage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RollbackStage")
	defer span.End()
	deployID := c.Param("deployId")
	var req models.RollbackStageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	pd, err := h.svc.RollbackStage(ctx, deployID, req.StageID, req.Reason, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, pd)
}

// --- Emergency Deploy handlers ---

func (h *Handler) RequestEmergencyDeploy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RequestEmergencyDeploy")
	defer span.End()
	var req models.CreateEmergencyDeployRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	ed, err := h.svc.RequestEmergencyDeploy(ctx, &req, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, ed)
}

func (h *Handler) ListEmergencies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListEmergencies")
	defer span.End()
	tenantID := h.getTenantID(c)
	status := c.Query("status")
	statusPtr := &status
	if status == "" {
		statusPtr = nil
	}
	emergencies, total, err := h.svc.ListEmergencies(ctx, tenantID, statusPtr)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     emergencies,
		Total:    total,
		Page:     1,
		PageSize: total,
	})
}

func (h *Handler) ApproveEmergencyDeploy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApproveEmergencyDeploy")
	defer span.End()
	id := c.Param("id")
	var req models.ApproveEmergencyDeployRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	ed, err := h.svc.ApproveEmergencyDeploy(ctx, id, req.ApprovedBy, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "emergency deploy not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, ed)
}

func (h *Handler) CompleteEmergencyDeploy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CompleteEmergencyDeploy")
	defer span.End()
	id := c.Param("id")
	var req models.CompleteEmergencyDeployRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	ed, err := h.svc.CompleteEmergencyDeploy(ctx, id, req.PostMortem, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "emergency deploy not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, ed)
}

func (h *Handler) RejectEmergencyDeploy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RejectEmergencyDeploy")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	ed, err := h.svc.RejectEmergencyDeploy(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "emergency deploy not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, ed)
}
