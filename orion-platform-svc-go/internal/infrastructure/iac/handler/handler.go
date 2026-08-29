package handler

import (
	"go.opentelemetry.io/otel"
	"strconv"

	"orion/platform-svc-go/internal/infrastructure/iac/models"
	"orion/platform-svc-go/internal/infrastructure/iac/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	iac := rg.Group("/iac")
	{
		// Workspaces
		iac.GET("/workspaces", auth.RequirePermission("iac", "read"), h.ListWorkspaces)
		iac.POST("/workspaces", auth.RequirePermission("iac", "write"), h.CreateWorkspace)
		iac.GET("/workspaces/:id", auth.RequirePermission("iac", "read"), h.GetWorkspace)
		iac.PUT("/workspaces/:id", auth.RequirePermission("iac", "write"), h.UpdateWorkspace)

		// Plan & Apply
		iac.POST("/workspaces/:id/plan", auth.RequirePermission("iac", "execute"), h.GeneratePlan)
		iac.POST("/workspaces/:id/apply", auth.RequirePermission("iac", "execute"), h.ApplyPlan)
		iac.GET("/workspaces/:id/plans", auth.RequirePermission("iac", "read"), h.ListPlansByWorkspace)
		iac.GET("/workspaces/:workspaceId/plans/:planId", auth.RequirePermission("iac", "read"), h.GetPlanByID)

		// State & Resources
		iac.GET("/workspaces/:id/state", auth.RequirePermission("iac", "read"), h.GetCurrentState)
		iac.GET("/workspaces/:id/resources", auth.RequirePermission("iac", "read"), h.ListResources)
		iac.POST("/workspaces/:id/import", auth.RequirePermission("iac", "write"), h.ImportResource)

		// State Versions & Diff
		iac.GET("/workspaces/:id/state/versions", auth.RequirePermission("iac", "read"), h.ListStateVersions)
		iac.GET("/workspaces/:id/state/diff", auth.RequirePermission("iac", "read"), h.GetStateDiff)

		// Modules
		iac.GET("/modules", auth.RequirePermission("iac", "read"), h.ListModules)
		iac.POST("/modules", auth.RequirePermission("iac", "write"), h.CreateModule)
		iac.GET("/modules/:id", auth.RequirePermission("iac", "read"), h.GetModuleByID)
		iac.DELETE("/modules/:id", auth.RequirePermission("iac", "delete"), h.DeleteModule)
	}
}

// ─── Workspace Handlers ────────────────────────────────────────────────────────

func (h *Handler) CreateWorkspace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraIACCreateWorkspace")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateWorkspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	w, err := h.svc.CreateWorkspace(ctx, tenantID, &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, w)
}

func (h *Handler) ListWorkspaces(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraIACListWorkspaces")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	offset := (page - 1) * ps
	if offset < 0 {
		offset = 0
	}
	items, err := h.svc.ListWorkspaces(ctx, tenantID, offset, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetWorkspace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraIACGetWorkspace")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	w, err := h.svc.GetWorkspace(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, w)
}

func (h *Handler) UpdateWorkspace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraIACUpdateWorkspace")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateWorkspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	w, err := h.svc.UpdateWorkspace(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, w)
}

// ─── Plan & Apply Handlers ─────────────────────────────────────────────────────

func (h *Handler) GeneratePlan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraIACGeneratePlan")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	plan, err := h.svc.GeneratePlan(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, plan)
}

func (h *Handler) ApplyPlan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraIACApplyPlan")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	plan, err := h.svc.ApplyPlan(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, plan)
}

func (h *Handler) ListPlansByWorkspace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraIACListPlansByWorkspace")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListPlansByWorkspace(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetPlanByID(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraIACGetPlanByID")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	workspaceID := c.Param("workspaceId")
	planID := c.Param("planId")
	plan, err := h.svc.GetPlanByID(ctx, tenantID, workspaceID, planID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, plan)
}

// ─── State & Resource Handlers ─────────────────────────────────────────────────

func (h *Handler) GetCurrentState(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraIACGetCurrentState")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	state, err := h.svc.GetCurrentState(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, state)
}

func (h *Handler) ListResources(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraIACListResources")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListResources(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) ImportResource(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraIACImportResource")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var body struct {
		Type string `json:"type"`
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	resource, err := h.svc.ImportResource(ctx, tenantID, c.Param("id"), body.Type, body.Name)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, resource)
}

// ─── State Version Handlers ────────────────────────────────────────────────────

func (h *Handler) ListStateVersions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraIACListStateVersions")
	defer span.End()
	versions, err := h.svc.ListStateVersions(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, versions)
}

func (h *Handler) GetStateDiff(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraIACGetStateDiff")
	defer span.End()
	versionA := c.Query("versionA")
	versionB := c.Query("versionB")
	if versionA == "" || versionB == "" {
		respondBadRequest(c, "versionA and versionB query parameters are required")
		return
	}
	diff, err := h.svc.GetStateDiff(ctx, c.Param("id"), versionA, versionB)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, diff)
}

// ─── Module Handlers ───────────────────────────────────────────────────────────

func (h *Handler) CreateModule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraIACCreateModule")
	defer span.End()
	var req models.CreateModuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreateModule(ctx, &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) ListModules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraIACListModules")
	defer span.End()
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	offset := (page - 1) * ps
	if offset < 0 {
		offset = 0
	}
	items, err := h.svc.ListModules(ctx, offset, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetModuleByID(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraIACGetModuleByID")
	defer span.End()
	m, err := h.svc.GetModuleByID(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) DeleteModule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraIACDeleteModule")
	defer span.End()
	if err := h.svc.DeleteModule(ctx, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}
