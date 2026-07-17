package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/iac/models"
	"orion/platform-svc-go/internal/iac/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all IaC endpoints under the given group.
// Mirrors /api/v1/iac routes from the TS source (17 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/iac")

	// --- Workspaces ---
	// GET /iac/workspaces - 列出工作区
	f.GET("/workspaces", auth.RequirePermission("iac", "read"), h.ListWorkspaces)
	// POST /iac/workspaces - 创建工作区
	f.POST("/workspaces", auth.RequirePermission("iac", "write"), h.CreateWorkspace)
	// GET /iac/workspaces/:id - 获取工作区
	f.GET("/workspaces/:id", auth.RequirePermission("iac", "read"), h.GetWorkspace)
	// PUT /iac/workspaces/:id - 更新工作区
	// DELETE /iac/workspaces/:id - 删除工作区
	f.PUT("/workspaces/:id", auth.RequirePermission("iac", "write"), h.UpdateWorkspace)

	// --- Plan & Apply ---
	// POST /iac/workspaces/:id/plan - 生成计划
	f.POST("/workspaces/:id/plan", auth.RequirePermission("iac", "execute"), h.GeneratePlan)
	// POST /iac/workspaces/:id/apply - 应用计划
	f.POST("/workspaces/:id/apply", auth.RequirePermission("iac", "execute"), h.ApplyPlan)

	// --- State & Resources ---
	// GET /iac/workspaces/:id/state - 获取当前状态
	f.GET("/workspaces/:id/state", auth.RequirePermission("iac", "read"), h.GetCurrentState)
	// GET /iac/workspaces/:id/resources - 列出资源
	f.GET("/workspaces/:id/resources", auth.RequirePermission("iac", "read"), h.ListResources)
	// POST /iac/workspaces/:id/import - 导入资源
	f.POST("/workspaces/:id/import", auth.RequirePermission("iac", "write"), h.ImportResource)

	// --- State Versions ---
	// GET /iac/workspaces/:id/state/versions - 状态版本列表
	f.GET("/workspaces/:id/state/versions", auth.RequirePermission("iac", "read"), h.ListStateVersions)
	// GET /iac/workspaces/:id/state/diff - 状态版本差异
	f.GET("/workspaces/:id/state/diff", auth.RequirePermission("iac", "read"), h.GetStateDiff)

	// --- Plan Details ---
	// GET /iac/workspaces/:id/plans - 计划列表
	f.GET("/workspaces/:id/plans", auth.RequirePermission("iac", "read"), h.ListPlans)
	// GET /iac/workspaces/:workspaceId/plans/:planId - 计划详情
	rg.GET("/iac/workspaces/:workspaceId/plans/:planId", auth.RequirePermission("iac", "read"), h.GetPlan)

	// --- Modules ---
	// GET /iac/modules - 列出模块
	f.GET("/modules", auth.RequirePermission("iac", "read"), h.ListModules)
	// POST /iac/modules - 创建模块
	f.POST("/modules", auth.RequirePermission("iac", "write"), h.CreateModule)
	// GET /iac/modules/:id - 获取模块详情
	f.GET("/modules/:id", auth.RequirePermission("iac", "read"), h.GetModule)
	// DELETE /iac/modules/:id - 删除模块
	f.DELETE("/modules/:id", auth.RequirePermission("iac", "delete"), h.DeleteModule)
}

// --- Workspace CRUD ---

func (h *Handler) ListWorkspaces(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.ListWorkspaces(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) CreateWorkspace(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateWorkspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	w, err := h.svc.CreateWorkspace(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, w)
}

func (h *Handler) GetWorkspace(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	w, err := h.svc.GetWorkspace(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workspace not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, w)
}

func (h *Handler) UpdateWorkspace(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateWorkspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	w, err := h.svc.UpdateWorkspace(c.Request.Context(), tenantID, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workspace not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, w)
}

// --- Plan & Apply ---

func (h *Handler) GeneratePlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	workspaceID := c.Param("id")
	var req models.GeneratePlanRequest
	c.ShouldBindJSON(&req)
	plan, err := h.svc.GeneratePlan(c.Request.Context(), tenantID, workspaceID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, plan)
}

func (h *Handler) ApplyPlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	workspaceID := c.Param("id")
	var req models.ApplyPlanRequest
	c.ShouldBindJSON(&req)
	plan, err := h.svc.ApplyPlan(c.Request.Context(), tenantID, workspaceID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, plan)
}

// --- State & Resources ---

func (h *Handler) GetCurrentState(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	workspaceID := c.Param("id")
	state, err := h.svc.GetCurrentState(c.Request.Context(), tenantID, workspaceID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workspace not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, state)
}

func (h *Handler) ListResources(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	workspaceID := c.Param("id")
	resources, err := h.svc.ListResources(c.Request.Context(), tenantID, workspaceID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resources)
}

func (h *Handler) ImportResource(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	workspaceID := c.Param("id")
	var req models.ImportResourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	resource, err := h.svc.ImportResource(c.Request.Context(), tenantID, workspaceID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, resource)
}

// --- State Versions ---

func (h *Handler) ListStateVersions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	workspaceID := c.Param("id")
	versions, err := h.svc.ListStateVersions(c.Request.Context(), tenantID, workspaceID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workspace not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, versions)
}

func (h *Handler) GetStateDiff(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	workspaceID := c.Param("id")
	versionA := c.Query("versionA")
	versionB := c.Query("versionB")
	if versionA == "" || versionB == "" {
		middleware.RespondBadRequest(c, "versionA and versionB query parameters are required")
		return
	}
	diff, err := h.svc.GetStateDiff(c.Request.Context(), tenantID, workspaceID, versionA, versionB)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, diff)
}

// --- Plan Details ---

func (h *Handler) ListPlans(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	workspaceID := c.Param("id")
	plans, err := h.svc.ListPlans(c.Request.Context(), tenantID, workspaceID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, plans)
}

func (h *Handler) GetPlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	workspaceID := c.Param("workspaceId")
	planID := c.Param("planId")
	plan, err := h.svc.GetPlan(c.Request.Context(), tenantID, planID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "plan not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	// Verify workspace ownership
	if plan.WorkspaceID != workspaceID {
		middleware.RespondNotFound(c, "plan not found")
		return
	}
	middleware.RespondSuccess(c, plan)
}

// --- Modules ---

func (h *Handler) ListModules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	modules, err := h.svc.ListModules(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, modules)
}

func (h *Handler) CreateModule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateModuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreateModule(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) GetModule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetModule(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "module not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) DeleteModule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteModule(c.Request.Context(), tenantID, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "module not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "module deleted"})
}
